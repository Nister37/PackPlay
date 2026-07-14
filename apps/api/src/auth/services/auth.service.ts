import {
  Injectable,
  Inject,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma.service';
import { generateToken, hashToken } from '../token.util';
import { EMAIL_SERVICE, EmailService } from '../interfaces';
import { AppErrorCode } from '@packplay/common';

const BCRYPT_ROUNDS = 10;
const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
const RESET_TOKEN_EXPIRY_HOURS = 1;
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult extends TokenPair {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
  ) {}

  private get requireEmailVerification(): boolean {
    const value = this.configService.get<string>('REQUIRE_EMAIL_VERIFICATION');
    return value !== 'false';
  }

  async register(
    email: string,
    password: string,
    name?: string,
  ): Promise<{ userId: string }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException({
        code: AppErrorCode.EMAIL_ALREADY_EXISTS,
        message: 'An account with this email already exists',
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        emailVerified: !this.requireEmailVerification,
        identity: {
          create: { passwordHash },
        },
      },
    });

    if (this.requireEmailVerification) {
      await this.createAndSendVerificationToken(user.id, user.email);
    }

    this.logger.log(`User registered: ${user.id}`);
    return { userId: user.id };
  }

  async verifyEmail(token: string): Promise<void> {
    const tokenHash = hashToken(token);

    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    if (!record) {
      throw new BadRequestException({
        code: AppErrorCode.INVALID_TOKEN,
        message: 'Invalid verification token',
      });
    }

    if (record.usedAt) {
      throw new BadRequestException({
        code: AppErrorCode.INVALID_TOKEN,
        message: 'Token has already been used',
      });
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException({
        code: AppErrorCode.TOKEN_EXPIRED,
        message: 'Verification token has expired',
      });
    }

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: true },
      }),
    ]);

    this.logger.log(`Email verified for user: ${record.userId}`);
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Silent return to not leak user existence or verification status
    if (!user || user.emailVerified) return;

    await this.createAndSendVerificationToken(user.id, user.email);
  }

  async login(
    email: string,
    password: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { identity: true },
    });

    if (!user || !user.identity) {
      throw new UnauthorizedException({
        code: AppErrorCode.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }

    const passwordValid = await bcrypt.compare(
      password,
      user.identity.passwordHash,
    );
    if (!passwordValid) {
      throw new UnauthorizedException({
        code: AppErrorCode.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }

    if (this.requireEmailVerification && !user.emailVerified) {
      throw new UnauthorizedException({
        code: AppErrorCode.EMAIL_NOT_VERIFIED,
        message: 'Please verify your email before logging in',
      });
    }

    const tokens = await this.createSession(user.id, user.email, userAgent);
    this.logger.log(`User logged in: ${user.id}`);
    return {
      ...tokens,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
    });

    if (!session) return;

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Session revoked: ${session.id}`);
  }

  async refresh(
    refreshToken: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const tokenHash = hashToken(refreshToken);

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException({
        code: AppErrorCode.INVALID_TOKEN,
        message: 'Invalid refresh token',
      });
    }

    if (session.revokedAt) {
      throw new UnauthorizedException({
        code: AppErrorCode.SESSION_REVOKED,
        message: 'Session has been revoked',
      });
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: AppErrorCode.TOKEN_EXPIRED,
        message: 'Refresh token has expired',
      });
    }

    // Revoke old session
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    // Create new session (token rotation)
    const tokens = await this.createSession(
      session.userId,
      session.user.email,
      userAgent,
    );

    return tokens;
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Silent return to not leak user existence
    if (!user) return;

    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + RESET_TOKEN_EXPIRY_HOURS);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:4200');
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    try {
      await this.emailService.send({
        to: user.email,
        subject: 'PackPlay - Password Reset',
        body: `Click the link below to reset your password:\n\n${resetLink}\n\nOr use this token manually: ${rawToken}\nThis token expires in ${RESET_TOKEN_EXPIRY_HOURS} hour(s).`,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${user.email}.`,
        (error as Error).message,
      );
    }

    this.logger.log(`Password reset requested for user: ${user.id}`);
  }

  async confirmPasswordReset(
    token: string,
    newPassword: string,
  ): Promise<void> {
    const tokenHash = hashToken(token);

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record) {
      throw new BadRequestException({
        code: AppErrorCode.INVALID_TOKEN,
        message: 'Invalid reset token',
      });
    }

    if (record.usedAt || record.revokedAt) {
      throw new BadRequestException({
        code: AppErrorCode.INVALID_TOKEN,
        message: 'Token has already been used or revoked',
      });
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException({
        code: AppErrorCode.TOKEN_EXPIRED,
        message: 'Reset token has expired',
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.identity.update({
        where: { userId: record.userId },
        data: { passwordHash },
      }),
      // Revoke all active sessions for security
      this.prisma.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    this.logger.log(`Password reset completed for user: ${record.userId}`);
  }

  async validateJwtPayload(payload: JwtPayload): Promise<{ id: string; email: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: AppErrorCode.UNAUTHORIZED,
        message: 'User not found',
      });
    }

    return { id: user.id, email: user.email };
  }

  // --- Private helpers ---

  private async createSession(
    userId: string,
    email: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const rawRefreshToken = generateToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        userAgent: userAgent?.substring(0, 512),
        expiresAt,
      },
    });

    const accessToken = this.jwtService.sign(
      { sub: userId, email } satisfies JwtPayload,
    );

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private async createAndSendVerificationToken(
    userId: string,
    email: string,
  ): Promise<void> {
    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setHours(
      expiresAt.getHours() + VERIFICATION_TOKEN_EXPIRY_HOURS,
    );

    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:4200');
    const verifyLink = `${frontendUrl}/verify-email?token=${rawToken}`;

    try {
      await this.emailService.send({
        to: email,
        subject: 'PackPlay - Verify Your Email',
        body: `Click the link below to verify your email:\n\n${verifyLink}\n\nOr use this token manually: ${rawToken}\nThis token expires in ${VERIFICATION_TOKEN_EXPIRY_HOURS} hours.`,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${email}. Token was created — user can request resend.`,
        (error as Error).message,
      );
    }
  }
}
