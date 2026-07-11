import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './services/auth.service';
import { PrismaService } from '../common/prisma.service';
import { EMAIL_SERVICE, EmailService } from './interfaces';
import { hashToken } from './token.util';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let emailService: jest.Mocked<EmailService>;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    identity: {
      update: jest.fn(),
    },
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    emailVerificationToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    passwordResetToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-access-token'),
  };

  const mockEmailService: jest.Mocked<EmailService> = {
    send: jest.fn().mockResolvedValue(undefined),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EMAIL_SERVICE, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
    emailService = module.get(EMAIL_SERVICE);
  });

  describe('register', () => {
    it('should register a new user and send verification email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});

      const result = await service.register('Test@Example.com', 'password123', 'Test');

      expect(result.userId).toBe('user-1');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@example.com',
            name: 'Test',
          }),
        }),
      );
      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: expect.stringContaining('Verify'),
        }),
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register('test@example.com', 'password123'),
      ).rejects.toThrow(ConflictException);
    });

    it('should hash passwords with bcrypt', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: null,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});

      await service.register('test@example.com', 'password123');

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      const storedHash = createCall.data.identity.create.passwordHash;
      const isValid = await bcrypt.compare('password123', storedHash);
      expect(isValid).toBe(true);
    });
  });

  describe('login', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      emailVerified: true,
      identity: {
        passwordHash: '',
      },
    };

    beforeEach(async () => {
      mockUser.identity.passwordHash = await bcrypt.hash('password123', 10);
    });

    it('should return token pair on valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.session.create.mockResolvedValue({});

      const result = await service.login('test@example.com', 'password123', 'Mozilla/5.0');

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken.length).toBe(64); // 32 bytes hex
      expect(mockPrisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            userAgent: 'Mozilla/5.0',
          }),
        }),
      );
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.login('test@example.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login('nonexistent@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if email not verified', async () => {
      const unverifiedUser = { ...mockUser, emailVerified: false };
      mockPrisma.user.findUnique.mockResolvedValue(unverifiedUser);

      await expect(
        service.login('test@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      const rawToken = 'valid-token-hex-string-1234567890ab';
      const tokenHash = hashToken(rawToken);

      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        tokenHash,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      });
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.verifyEmail(rawToken);

      expect(mockPrisma.emailVerificationToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue(null);

      await expect(service.verifyEmail('invalid-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for expired token', async () => {
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() - 3600000), // expired
        usedAt: null,
      });

      await expect(service.verifyEmail('some-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for already used token', async () => {
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: new Date(), // already used
      });

      await expect(service.verifyEmail('some-token')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('refresh', () => {
    it('should rotate refresh token and return new token pair', async () => {
      const rawToken = 'refresh-token-hex-string-1234567890ab';
      const tokenHash = hashToken(rawToken);

      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        tokenHash,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        user: { id: 'user-1', email: 'test@example.com' },
      });
      mockPrisma.session.update.mockResolvedValue({});
      mockPrisma.session.create.mockResolvedValue({});

      const result = await service.refresh(rawToken);

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      // Old session should be revoked
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should throw UnauthorizedException for revoked session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        revokedAt: new Date(), // revoked
        expiresAt: new Date(Date.now() + 86400000),
      });

      await expect(service.refresh('some-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for expired session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 3600000), // expired
      });

      await expect(service.refresh('some-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('password reset', () => {
    it('should create reset token and send email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });
      mockPrisma.passwordResetToken.create.mockResolvedValue({});

      await service.requestPasswordReset('test@example.com');

      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            tokenHash: expect.any(String),
          }),
        }),
      );
      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: expect.stringContaining('Password Reset'),
        }),
      );
    });

    it('should silently succeed for non-existent email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.requestPasswordReset('nonexistent@example.com'),
      ).resolves.toBeUndefined();
      expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('should reset password with valid token', async () => {
      const rawToken = 'reset-token-hex-string-1234567890ab';
      const tokenHash = hashToken(rawToken);

      mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'reset-1',
        userId: 'user-1',
        tokenHash,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
        revokedAt: null,
      });
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.confirmPasswordReset(rawToken, 'newPassword123');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      const transactionCalls = mockPrisma.$transaction.mock.calls[0][0];
      expect(transactionCalls.length).toBe(3); // update token, update identity, revoke sessions
    });

    it('should throw BadRequestException for invalid reset token', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmPasswordReset('invalid-token', 'newPassword123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('logout', () => {
    it('should revoke session', async () => {
      const rawToken = 'refresh-token-hex-string-1234567890ab';
      const tokenHash = hashToken(rawToken);

      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        tokenHash,
      });
      mockPrisma.session.update.mockResolvedValue({});

      await service.logout(rawToken);

      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should silently succeed if session not found', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(service.logout('unknown-token')).resolves.toBeUndefined();
    });
  });
});
