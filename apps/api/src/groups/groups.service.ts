import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GroupMemberRole } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { AppErrorCode } from '@packplay/common';
import { CreateGroupDto, UpdateGroupDto, GroupMemberRoleDto } from './dto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async createGroup(userId: string, dto: CreateGroupDto) {
    const group = await this.prisma.group.create({
      data: {
        name: dto.name,
        description: dto.description,
        sportType: dto.sportType,
        members: {
          create: {
            userId,
            role: GroupMemberRole.OWNER,
          },
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    return group;
  }

  async listUserGroups(userId: string) {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map((m) => ({
      ...m.group,
      memberCount: m.group._count.members,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  async getGroupDetails(groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { joinedAt: 'asc' },
        },
        _count: { select: { members: true } },
      },
    });

    if (!group) {
      throw new NotFoundException({
        code: AppErrorCode.GROUP_NOT_FOUND,
        message: 'Group not found',
      });
    }

    return group;
  }

  async updateGroup(groupId: string, dto: UpdateGroupDto) {
    const group = await this.prisma.group.update({
      where: { id: groupId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.sportType !== undefined && { sportType: dto.sportType }),
      },
    });

    return group;
  }

  async deleteGroup(groupId: string) {
    await this.prisma.group.delete({ where: { id: groupId } });
  }

  async listMembers(groupId: string) {
    return this.prisma.groupMember.findMany({
      where: { groupId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async removeMember(groupId: string, memberId: string, requestingUserId: string) {
    const targetMember = await this.prisma.groupMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.groupId !== groupId) {
      throw new NotFoundException({
        code: AppErrorCode.NOT_A_MEMBER,
        message: 'Member not found in this group',
      });
    }

    if (targetMember.role === GroupMemberRole.OWNER) {
      throw new ForbiddenException({
        code: AppErrorCode.CANNOT_REMOVE_OWNER,
        message: 'Cannot remove the group owner',
      });
    }

    await this.prisma.groupMember.delete({ where: { id: memberId } });
  }

  async updateMemberRole(groupId: string, memberId: string, role: GroupMemberRoleDto) {
    const targetMember = await this.prisma.groupMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.groupId !== groupId) {
      throw new NotFoundException({
        code: AppErrorCode.NOT_A_MEMBER,
        message: 'Member not found in this group',
      });
    }

    if (targetMember.role === GroupMemberRole.OWNER) {
      throw new ForbiddenException({
        code: AppErrorCode.CANNOT_REMOVE_OWNER,
        message: 'Cannot change the owner role',
      });
    }

    return this.prisma.groupMember.update({
      where: { id: memberId },
      data: { role: role as unknown as GroupMemberRole },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async leaveGroup(groupId: string, userId: string) {
    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    if (!membership) {
      throw new NotFoundException({
        code: AppErrorCode.NOT_A_MEMBER,
        message: 'You are not a member of this group',
      });
    }

    if (membership.role === GroupMemberRole.OWNER) {
      const ownerCount = await this.prisma.groupMember.count({
        where: { groupId, role: GroupMemberRole.OWNER },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException({
          code: AppErrorCode.CANNOT_LEAVE_AS_SOLE_OWNER,
          message: 'Cannot leave group as the sole owner. Transfer ownership first.',
        });
      }
    }

    await this.prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId } },
    });
  }

  async transferOwnership(groupId: string, currentUserId: string, targetUserId: string) {
    const targetMembership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });

    if (!targetMembership) {
      throw new BadRequestException({
        code: AppErrorCode.TRANSFER_TARGET_NOT_MEMBER,
        message: 'Target user is not a member of this group',
      });
    }

    const [updatedCurrent, updatedTarget] = await this.prisma.$transaction([
      this.prisma.groupMember.update({
        where: { groupId_userId: { groupId, userId: currentUserId } },
        data: { role: GroupMemberRole.ADMIN },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.groupMember.update({
        where: { groupId_userId: { groupId, userId: targetUserId } },
        data: { role: GroupMemberRole.OWNER },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    return [updatedCurrent, updatedTarget];
  }
}
