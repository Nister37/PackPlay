import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPublicKey,
  randomBytes,
  verify,
} from 'crypto';
import { AppErrorCode } from '@packplay/common';

interface GoogleClaims {
  iss: string;
  aud: string | string[];
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  nonce: string;
  exp: number;
}

interface GoogleKey extends Record<string, unknown> {
  kid: string;
  kty: string;
  alg?: string;
  n?: string;
  e?: string;
  use?: string;
}

@Injectable()
export class SsoCryptoService {
  private keys?: { expiresAt: number; values: GoogleKey[] };

  constructor(private readonly config: ConfigService) {}

  randomValue(bytes = 32) {
    return randomBytes(bytes).toString('base64url');
  }

  hash(value: string) {
    return createHash('sha256').update(value).digest('base64url');
  }

  encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  decrypt(value: string) {
    try {
      const [iv, tag, encrypted] = value.split('.');
      const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(iv, 'base64url'));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(encrypted, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new BadRequestException({
        code: AppErrorCode.INVALID_TOKEN,
        message: 'The SSO request can no longer be completed',
      });
    }
  }

  async validateGoogleIdToken(token: string, expectedNonceHash: string) {
    const parts = token.split('.');
    if (parts.length !== 3) this.invalidToken();
    let header: { alg?: string; kid?: string };
    let claims: GoogleClaims;
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
      this.invalidToken();
    }
    if (header!.alg !== 'RS256' || !header!.kid) this.invalidToken();
    const key = (await this.googleKeys()).find((item) => item.kid === header!.kid);
    if (!key || !key.n || !key.e) this.invalidToken();
    const validSignature = verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      createPublicKey({
        key: key as import('crypto').JsonWebKey,
        format: 'jwk',
      }),
      Buffer.from(parts[2], 'base64url'),
    );
    const clientId = this.required('GOOGLE_CLIENT_ID');
    const audiences = Array.isArray(claims!.aud) ? claims!.aud : [claims!.aud];
    if (
      !validSignature ||
      !['https://accounts.google.com', 'accounts.google.com'].includes(claims!.iss) ||
      !audiences.includes(clientId) ||
      claims!.exp * 1000 <= Date.now() ||
      !claims!.sub ||
      !claims!.email ||
      claims!.email_verified !== true ||
      this.hash(claims!.nonce) !== expectedNonceHash
    ) {
      this.invalidToken();
    }
    return claims!;
  }

  required(name: string) {
    const value = this.config.get<string>(name);
    if (!value || value.length < (name.endsWith('_KEY') ? 16 : 1)) {
      throw new ServiceUnavailableException(`${name} is not configured`);
    }
    return value;
  }

  private async googleKeys() {
    if (this.keys && this.keys.expiresAt > Date.now()) return this.keys.values;
    let response: Response;
    try {
      response = await fetch('https://www.googleapis.com/oauth2/v3/certs', {
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ServiceUnavailableException('Google sign-in is unavailable');
    }
    if (!response.ok) {
      throw new ServiceUnavailableException('Google sign-in is unavailable');
    }
    const body = (await response.json()) as { keys?: GoogleKey[] };
    if (!body.keys?.length) {
      throw new ServiceUnavailableException('Google sign-in keys are unavailable');
    }
    const maxAge = Number.parseInt(
      response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] ?? '3600',
      10,
    );
    this.keys = {
      values: body.keys,
      expiresAt: Date.now() + Math.min(maxAge, 86_400) * 1000,
    };
    return body.keys;
  }

  private key() {
    return createHash('sha256').update(this.required('SSO_STATE_ENCRYPTION_KEY')).digest();
  }

  private invalidToken(): never {
    throw new UnauthorizedException({
      code: AppErrorCode.INVALID_TOKEN,
      message: 'Google identity token validation failed',
    });
  }
}
