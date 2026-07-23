import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from './prisma.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs daily at 3 AM to prune expired/revoked tokens and sessions.
   */
  @Cron('0 3 * * *')
  async handleTokenCleanup() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Delete expired or long-revoked sessions
    const sessions = await this.prisma.session.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { revokedAt: { not: null, lt: sevenDaysAgo } }],
      },
    });

    // Delete expired or used email verification tokens
    const verificationTokens = await this.prisma.emailVerificationToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }],
      },
    });

    // Delete expired, used, or revoked password reset tokens
    const resetTokens = await this.prisma.passwordResetToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }, { revokedAt: { not: null } }],
      },
    });

    const ssoAuthorizations = await this.prisma.ssoAuthorization.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }],
      },
    });

    // Delete old revoked/expired invitations (keep for 30 days for audit)
    const invitations = await this.prisma.groupInvitation.deleteMany({
      where: {
        OR: [{ revokedAt: { not: null, lt: thirtyDaysAgo } }, { expiresAt: { lt: thirtyDaysAgo } }],
      },
    });

    this.logger.log(
      JSON.stringify({
        event: 'token_cleanup',
        deleted: {
          sessions: sessions.count,
          verificationTokens: verificationTokens.count,
          resetTokens: resetTokens.count,
          ssoAuthorizations: ssoAuthorizations.count,
          invitations: invitations.count,
        },
      }),
    );
  }
}
