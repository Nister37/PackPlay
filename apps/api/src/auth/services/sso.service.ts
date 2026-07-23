import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SsoIntent, SsoProvider } from '@prisma/client';
import { AppErrorCode } from '@packplay/common';
import { PrismaService } from '../../common/prisma.service';
import { AuthService } from './auth.service';
import { SsoCryptoService } from './sso-crypto.service';

@Injectable()
export class SsoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly crypto: SsoCryptoService,
    private readonly auth: AuthService,
  ) {}

  async start(intent: SsoIntent, userId?: string, requestedReturnUrl?: string) {
    const state = this.crypto.randomValue();
    const nonce = this.crypto.randomValue();
    const codeVerifier = this.crypto.randomValue(48);
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    const returnUrl = this.safeReturnUrl(requestedReturnUrl);
    await this.prisma.ssoAuthorization.create({
      data: {
        stateHash: this.crypto.hash(state),
        provider: SsoProvider.GOOGLE,
        intent,
        userId,
        encryptedCodeVerifier: this.crypto.encrypt(codeVerifier),
        nonceHash: this.crypto.hash(nonce),
        returnUrl,
        expiresAt,
      },
    });
    const query = new URLSearchParams({
      client_id: this.crypto.required('GOOGLE_CLIENT_ID'),
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: this.crypto.hash(codeVerifier),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    return {
      authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${query}`,
      expiresAt,
    };
  }

  async callback(code: string, state: string, userAgent?: string) {
    const authorization = await this.prisma.ssoAuthorization.findUnique({
      where: { stateHash: this.crypto.hash(state) },
    });
    if (!authorization || authorization.usedAt || authorization.expiresAt <= new Date()) {
      throw new ConflictException({
        code: AppErrorCode.INVALID_TOKEN,
        message: 'The SSO request is invalid, expired, or already used',
      });
    }
    const consumed = await this.prisma.ssoAuthorization.updateMany({
      where: { id: authorization.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new ConflictException({
        code: AppErrorCode.INVALID_TOKEN,
        message: 'The SSO request has already been used',
      });
    }
    const idToken = await this.exchangeCode(
      code,
      this.crypto.decrypt(authorization.encryptedCodeVerifier),
    );
    const claims = await this.crypto.validateGoogleIdToken(idToken, authorization.nonceHash);
    const email = claims.email.toLowerCase();
    const existingIdentity = await this.prisma.externalIdentity.findUnique({
      where: {
        provider_subject: {
          provider: SsoProvider.GOOGLE,
          subject: claims.sub,
        },
      },
      include: { user: true },
    });

    if (authorization.intent === SsoIntent.LINK) {
      if (!authorization.userId) {
        throw new ConflictException({
          code: AppErrorCode.INVALID_TOKEN,
          message: 'The linking request has no account',
        });
      }
      if (existingIdentity && existingIdentity.userId !== authorization.userId) {
        throw new ConflictException({
          code: AppErrorCode.SSO_IDENTITY_ALREADY_LINKED,
          message: 'This Google identity belongs to another account',
        });
      }
      if (!existingIdentity) {
        const providerAlreadyLinked = await this.prisma.externalIdentity.findUnique({
          where: {
            userId_provider: {
              userId: authorization.userId,
              provider: SsoProvider.GOOGLE,
            },
          },
        });
        if (providerAlreadyLinked) {
          throw new ConflictException({
            code: AppErrorCode.SSO_IDENTITY_ALREADY_LINKED,
            message: 'A Google identity is already connected',
          });
        }
        await this.prisma.externalIdentity.create({
          data: {
            userId: authorization.userId,
            provider: SsoProvider.GOOGLE,
            subject: claims.sub,
            email,
          },
        });
      }
      return { linked: true, provider: SsoProvider.GOOGLE, returnUrl: authorization.returnUrl };
    }

    if (existingIdentity) {
      return {
        ...(await this.auth.createLoginSession(
          existingIdentity.user.id,
          existingIdentity.user.email,
          userAgent,
        )),
        user: this.user(existingIdentity.user),
        returnUrl: authorization.returnUrl,
      };
    }
    const matchingUser = await this.prisma.user.findUnique({ where: { email } });
    if (matchingUser) {
      throw new ConflictException({
        code: AppErrorCode.SSO_LINK_REQUIRED,
        message: 'Sign in with your existing method, then connect Google from account settings',
      });
    }
    const user = await this.prisma.user.create({
      data: {
        email,
        emailVerified: true,
        name: claims.name?.slice(0, 200),
        externalIdentities: {
          create: {
            provider: SsoProvider.GOOGLE,
            subject: claims.sub,
            email,
          },
        },
      },
    });
    return {
      ...(await this.auth.createLoginSession(user.id, user.email, userAgent)),
      user: this.user(user),
      returnUrl: authorization.returnUrl,
    };
  }

  async listMethods(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { identity: true, externalIdentities: true },
    });
    return [
      ...(user.identity ? [{ type: 'PASSWORD', email: user.email }] : []),
      ...user.externalIdentities.map((identity) => ({
        type: 'SSO',
        provider: identity.provider,
        email: identity.email,
        connectedAt: identity.createdAt,
      })),
    ];
  }

  async unlink(userId: string, provider: SsoProvider) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { identity: true, externalIdentities: true },
    });
    const identity = user.externalIdentities.find((item) => item.provider === provider);
    if (!identity) {
      throw new NotFoundException({
        code: AppErrorCode.NOT_FOUND,
        message: 'Connected sign-in method not found',
      });
    }
    if (!user.identity && user.externalIdentities.length === 1) {
      throw new ConflictException({
        code: AppErrorCode.LAST_SIGN_IN_METHOD,
        message: 'Add another sign-in method before disconnecting this one',
      });
    }
    await this.prisma.externalIdentity.delete({ where: { id: identity.id } });
    return { disconnected: true, provider };
  }

  private async exchangeCode(code: string, codeVerifier: string) {
    let response: Response;
    try {
      response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.crypto.required('GOOGLE_CLIENT_ID'),
          client_secret: this.crypto.required('GOOGLE_CLIENT_SECRET'),
          redirect_uri: this.redirectUri(),
          grant_type: 'authorization_code',
          code_verifier: codeVerifier,
        }),
      });
    } catch {
      throw new ServiceUnavailableException('Google sign-in is unavailable');
    }
    if (!response.ok) {
      throw new ConflictException({
        code: AppErrorCode.INVALID_TOKEN,
        message: 'Google rejected the authorization code',
      });
    }
    const tokens = (await response.json()) as { id_token?: string };
    if (!tokens.id_token) {
      throw new ServiceUnavailableException('Google did not return an identity token');
    }
    return tokens.id_token;
  }

  private redirectUri() {
    return this.config.get<string>(
      'GOOGLE_REDIRECT_URI',
      'http://localhost:3000/api/auth/sso/google/callback',
    );
  }

  private safeReturnUrl(value?: string) {
    if (!value) return undefined;
    const frontend = new URL(this.config.get<string>('FRONTEND_URL', 'http://localhost:4200'));
    const requested = new URL(value);
    return requested.origin === frontend.origin ? requested.toString() : frontend.toString();
  }

  private user(user: { id: string; email: string; name: string | null }) {
    return { id: user.id, email: user.email, name: user.name };
  }
}
