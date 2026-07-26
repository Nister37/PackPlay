import { Test } from '@nestjs/testing';
import { PrismaService } from './prisma.service';
import { CleanupService } from './cleanup.service';

describe('CleanupService', () => {
  let service: CleanupService;
  const prisma = {
    session: { deleteMany: jest.fn() },
    emailVerificationToken: { deleteMany: jest.fn() },
    passwordResetToken: { deleteMany: jest.fn() },
    ssoAuthorization: { deleteMany: jest.fn() },
    groupInvitation: { deleteMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CleanupService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(CleanupService);
  });

  it('deletes expired sessions', async () => {
    prisma.session.deleteMany.mockResolvedValue({ count: 3 });
    prisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 1 });
    prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 2 });
    prisma.ssoAuthorization.deleteMany.mockResolvedValue({ count: 0 });
    prisma.groupInvitation.deleteMany.mockResolvedValue({ count: 1 });

    await service.handleTokenCleanup();

    expect(prisma.session.deleteMany).toHaveBeenCalledTimes(1);
    const sessionWhere = prisma.session.deleteMany.mock.calls[0][0].where;
    expect(sessionWhere.OR).toHaveLength(2);
    // First condition: expired sessions
    expect(sessionWhere.OR[0]).toHaveProperty('expiresAt');
    // Second condition: long-revoked sessions
    expect(sessionWhere.OR[1]).toHaveProperty('revokedAt');
  });

  it('deletes expired or used email verification tokens', async () => {
    prisma.session.deleteMany.mockResolvedValue({ count: 0 });
    prisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 5 });
    prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
    prisma.ssoAuthorization.deleteMany.mockResolvedValue({ count: 0 });
    prisma.groupInvitation.deleteMany.mockResolvedValue({ count: 0 });

    await service.handleTokenCleanup();

    expect(prisma.emailVerificationToken.deleteMany).toHaveBeenCalledTimes(1);
    const where = prisma.emailVerificationToken.deleteMany.mock.calls[0][0].where;
    expect(where.OR).toHaveLength(2);
    // expired or already used
    expect(where.OR[0]).toHaveProperty('expiresAt');
    expect(where.OR[1]).toHaveProperty('usedAt');
  });

  it('deletes expired, used, or revoked password reset tokens', async () => {
    prisma.session.deleteMany.mockResolvedValue({ count: 0 });
    prisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 });
    prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 4 });
    prisma.ssoAuthorization.deleteMany.mockResolvedValue({ count: 0 });
    prisma.groupInvitation.deleteMany.mockResolvedValue({ count: 0 });

    await service.handleTokenCleanup();

    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledTimes(1);
    const where = prisma.passwordResetToken.deleteMany.mock.calls[0][0].where;
    expect(where.OR).toHaveLength(3);
  });

  it('deletes expired SSO authorizations', async () => {
    prisma.session.deleteMany.mockResolvedValue({ count: 0 });
    prisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 });
    prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
    prisma.ssoAuthorization.deleteMany.mockResolvedValue({ count: 2 });
    prisma.groupInvitation.deleteMany.mockResolvedValue({ count: 0 });

    await service.handleTokenCleanup();

    expect(prisma.ssoAuthorization.deleteMany).toHaveBeenCalledTimes(1);
    const where = prisma.ssoAuthorization.deleteMany.mock.calls[0][0].where;
    expect(where.OR).toHaveLength(2);
  });

  it('deletes old revoked/expired invitations after 30-day audit period', async () => {
    prisma.session.deleteMany.mockResolvedValue({ count: 0 });
    prisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 });
    prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
    prisma.ssoAuthorization.deleteMany.mockResolvedValue({ count: 0 });
    prisma.groupInvitation.deleteMany.mockResolvedValue({ count: 7 });

    await service.handleTokenCleanup();

    expect(prisma.groupInvitation.deleteMany).toHaveBeenCalledTimes(1);
    const where = prisma.groupInvitation.deleteMany.mock.calls[0][0].where;
    expect(where.OR).toHaveLength(2);
  });
});
