import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GroupMemberRole } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { generateToken, hashToken } from '../auth/token.util';
import { AppErrorCode } from '@packplay/common';
import { CreateInvitationDto } from './dto';

const DEFAULT_EXPIRY_HOURS = 72;

@Injectable()
export class InvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createInvitation(groupId: string, userId: string, dto: CreateInvitationDto) {
    const expiresInHours = dto.expiresInHours ?? DEFAULT_EXPIRY_HOURS;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const token = generateToken();
    const tokenHash = hashToken(token);

    const invitation = await this.prisma.groupInvitation.create({
      data: {
        groupId,
        tokenHash,
        expiresAt,
        maxUses: dto.maxUses ?? null,
        createdById: userId,
      },
    });

    return {
      id: invitation.id,
      token,
      expiresAt: invitation.expiresAt,
      maxUses: invitation.maxUses,
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

    // Join and increment use count in a transaction
    const [member] = await this.prisma.$transaction([
      this.prisma.groupMember.create({
        data: {
          groupId: invitation.groupId,
          userId,
          role: GroupMemberRole.MEMBER,
        },
        include: {
          group: { select: { id: true, name: true, sportType: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.groupInvitation.update({
        where: { id: invitation.id },
        data: { useCount: { increment: 1 } },
      }),
    ]);

    return member;
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
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
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
