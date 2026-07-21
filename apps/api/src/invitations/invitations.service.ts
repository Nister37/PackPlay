import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GroupMemberRole } from '@prisma/client';
import * as QRCode from 'qrcode';
import { PrismaService } from '../common/prisma.service';
import { generateToken, hashToken } from '../auth/token.util';
import { AppErrorCode } from '@packplay/common';
import { CreateInvitationDto } from './dto';

const DEFAULT_EXPIRY_HOURS = 72;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async createInvitation(groupId: string, userId: string, dto: CreateInvitationDto) {
    const expiresInHours = dto.expiresInHours ?? DEFAULT_EXPIRY_HOURS;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const token = generateToken();
    const tokenHash = hashToken(token);

    const invitation = await this.prisma.groupInvitation.create({
      data: {
        groupId,
        token,
        tokenHash,
        expiresAt,
        maxUses: dto.maxUses ?? null,
        createdById: userId,
      },
    });

    const qrDataUrl = await this.generateQrDataUrl(token);

    return {
      id: invitation.id,
      token,
      expiresAt: invitation.expiresAt,
      maxUses: invitation.maxUses,
      qrDataUrl,
    };
  }

  async regenerateInvitation(groupId: string, userId: string, dto: CreateInvitationDto) {
    const expiresInHours = dto.expiresInHours ?? DEFAULT_EXPIRY_HOURS;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    const token = generateToken();
    const tokenHash = hashToken(token);

    const invitation = await this.prisma.$transaction(async (tx) => {
      await tx.groupInvitation.updateMany({
        where: { groupId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return tx.groupInvitation.create({
        data: {
          groupId,
          token,
          tokenHash,
          expiresAt,
          maxUses: dto.maxUses ?? null,
          createdById: userId,
        },
      });
    });

    return {
      id: invitation.id,
      token,
      expiresAt: invitation.expiresAt,
      maxUses: invitation.maxUses,
      qrDataUrl: await this.generateQrDataUrl(token),
    };
  }

  async getInvitationInfo(token: string) {
    const tokenHash = hashToken(token);

    const invitation = await this.prisma.groupInvitation.findUnique({
      where: { tokenHash },
      include: {
        group: {
          include: { _count: { select: { members: true } } },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException({
        code: AppErrorCode.NOT_FOUND,
        message: 'Invitation not found',
      });
    }

    this.validateInvitation(invitation);

    return {
      groupName: invitation.group.name,
      sportType: invitation.group.sportType,
      memberCount: invitation.group._count.members,
    };
  }

  async joinGroup(token: string, userId: string) {
    const tokenHash = hashToken(token);

    const invitation = await this.prisma.groupInvitation.findUnique({
      where: { tokenHash },
      include: { group: true },
    });

    if (!invitation) {
      throw new NotFoundException({
        code: AppErrorCode.NOT_FOUND,
        message: 'Invitation not found',
      });
    }

    this.validateInvitation(invitation);

    // Check if user is already a member
    const existing = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: invitation.groupId, userId } },
    });

    if (existing) {
      throw new ConflictException({
        code: AppErrorCode.ALREADY_A_MEMBER,
        message: 'You are already a member of this group',
      });
    }

    // Consume capacity and join atomically so concurrent requests cannot exceed maxUses.
    return this.prisma.$transaction(async (tx) => {
      const consumed = await tx.groupInvitation.updateMany({
        where: {
          id: invitation.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          ...(invitation.maxUses !== null && { useCount: { lt: invitation.maxUses } }),
        },
        data: { useCount: { increment: 1 } },
      });
      if (consumed.count !== 1) {
        throw new ForbiddenException({
          code: AppErrorCode.INVITATION_MAX_USES_REACHED,
          message: 'This invitation is no longer available',
        });
      }

      return tx.groupMember.create({
        data: {
          groupId: invitation.groupId,
          userId,
          role: GroupMemberRole.MEMBER,
        },
        include: {
          group: { select: { id: true, name: true, sportType: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });
    });
  }

  async revokeInvitation(groupId: string, invitationId: string) {
    const invitation = await this.prisma.groupInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.groupId !== groupId) {
      throw new NotFoundException({
        code: AppErrorCode.NOT_FOUND,
        message: 'Invitation not found',
      });
    }

    await this.prisma.groupInvitation.update({
      where: { id: invitationId },
      data: { revokedAt: new Date() },
    });
  }

  async listActiveInvitations(groupId: string) {
    return this.prisma.groupInvitation.findMany({
      where: {
        groupId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        token: true,
        expiresAt: true,
        maxUses: true,
        useCount: true,
        createdAt: true,
        group: {
          select: { id: true, name: true, sportType: true },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvitationForQr(groupId: string, invitationId: string): Promise<string> {
    const invitation = await this.prisma.groupInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.groupId !== groupId) {
      throw new NotFoundException({
        code: AppErrorCode.NOT_FOUND,
        message: 'Invitation not found',
      });
    }

    this.validateInvitation(invitation);
    return invitation.token;
  }

  async generateQrBuffer(token: string): Promise<Buffer> {
    const corsOrigin = this.configService.get<string>('CORS_ORIGIN', 'http://localhost:4200');
    const url = `${corsOrigin}/invitations/${token}/join`;
    return QRCode.toBuffer(url, { type: 'png', width: 300 });
  }

  private async generateQrDataUrl(token: string): Promise<string> {
    const corsOrigin = this.configService.get<string>('CORS_ORIGIN', 'http://localhost:4200');
    const url = `${corsOrigin}/invitations/${token}/join`;
    return QRCode.toDataURL(url, { type: 'image/png', width: 300 });
  }

  private validateInvitation(invitation: {
    revokedAt: Date | null;
    expiresAt: Date;
    maxUses: number | null;
    useCount: number;
  }) {
    if (invitation.revokedAt) {
      throw new ForbiddenException({
        code: AppErrorCode.INVITATION_REVOKED,
        message: 'This invitation has been revoked',
      });
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException({
        code: AppErrorCode.INVITATION_EXPIRED,
        message: 'This invitation has expired',
      });
    }

    if (invitation.maxUses !== null && invitation.useCount >= invitation.maxUses) {
      throw new BadRequestException({
        code: AppErrorCode.INVITATION_MAX_USES_REACHED,
        message: 'This invitation has reached its maximum number of uses',
      });
    }
  }
}
