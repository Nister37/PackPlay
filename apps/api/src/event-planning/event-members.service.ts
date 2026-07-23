import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppErrorCode } from '@packplay/common';
import { PrismaService } from '../common/prisma.service';
import {
  AssignEventRoleDto,
  CreateEventRoleDto,
  UpdateEventMemberDto,
} from './dto';

@Injectable()
export class EventMembersService {
  constructor(private readonly prisma: PrismaService) {}

  async createRole(groupId: string, activityId: string, dto: CreateEventRoleDto) {
    await this.assertActivity(groupId, activityId);
    return this.prisma.eventRole.create({
      data: {
        activityId,
        name: dto.name,
        requirements: dto.requirements
          ? (dto.requirements as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  }

  async assignRole(
    groupId: string,
    activityId: string,
    roleId: string,
    dto: AssignEventRoleDto,
  ) {
    const role = await this.prisma.eventRole.findUnique({
      where: { id: roleId },
      include: { activity: true },
    });
    if (!role || role.activityId !== activityId || role.activity.groupId !== groupId) {
      throw new NotFoundException({
        code: AppErrorCode.NOT_FOUND,
        message: 'Event role not found',
      });
    }
    await this.assertGroupMember(groupId, dto.userId);
    return this.prisma.$transaction(async (tx) => {
      await tx.eventMember.upsert({
        where: { activityId_userId: { activityId, userId: dto.userId } },
        create: { activityId, userId: dto.userId },
        update: {},
      });
      return tx.eventMemberRole.upsert({
        where: { eventRoleId_userId: { eventRoleId: roleId, userId: dto.userId } },
        create: { eventRoleId: roleId, userId: dto.userId },
        update: {},
        include: { eventRole: true },
      });
    });
  }

  async removeRole(
    groupId: string,
    activityId: string,
    roleId: string,
    userId: string,
  ) {
    await this.assertActivity(groupId, activityId);
    const assignment = await this.prisma.eventMemberRole.findUnique({
      where: { eventRoleId_userId: { eventRoleId: roleId, userId } },
      include: { eventRole: true },
    });
    if (!assignment || assignment.eventRole.activityId !== activityId) {
      throw new NotFoundException({
        code: AppErrorCode.NOT_FOUND,
        message: 'Event role assignment not found',
      });
    }
    await this.prisma.eventMemberRole.delete({ where: { id: assignment.id } });
  }

  async updateSelf(
    groupId: string,
    activityId: string,
    userId: string,
    dto: UpdateEventMemberDto,
  ) {
    const activity = await this.assertActivity(groupId, activityId);
    await this.assertGroupMember(groupId, userId);
    const packingAt = dto.packingAt ? new Date(dto.packingAt) : undefined;
    const leavingAt = dto.leavingAt ? new Date(dto.leavingAt) : undefined;
    if (activity.date) {
      if (packingAt && packingAt >= activity.date) {
        throw new BadRequestException({
          code: AppErrorCode.VALIDATION_ERROR,
          message: 'Packing time must be before the event',
        });
      }
      if (leavingAt && leavingAt >= activity.date) {
        throw new BadRequestException({
          code: AppErrorCode.VALIDATION_ERROR,
          message: 'Leaving time must be before the event',
        });
      }
    }
    return this.prisma.eventMember.upsert({
      where: { activityId_userId: { activityId, userId } },
      create: {
        activityId,
        userId,
        attendanceStatus: dto.attendanceStatus,
        packingAt,
        leavingAt,
      },
      update: {
        attendanceStatus: dto.attendanceStatus,
        packingAt,
        leavingAt,
      },
    });
  }

  async list(groupId: string, activityId: string) {
    await this.assertActivity(groupId, activityId);
    return this.prisma.eventMember.findMany({
      where: { activityId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async personalRequirements(groupId: string, activityId: string, userId: string) {
    await this.assertActivity(groupId, activityId);
    const assignments = await this.prisma.eventMemberRole.findMany({
      where: { userId, eventRole: { activityId } },
      include: { eventRole: true },
    });
    const requirements = assignments.flatMap((assignment) =>
      Array.isArray(assignment.eventRole.requirements)
        ? assignment.eventRole.requirements
        : [],
    );
    return { activityId, userId, requirements };
  }

  private async assertActivity(groupId: string, activityId: string) {
    const activity = await this.prisma.groupActivity.findUnique({
      where: { id: activityId },
    });
    if (!activity || activity.groupId !== groupId) {
      throw new NotFoundException({
        code: AppErrorCode.ACTIVITY_NOT_FOUND,
        message: 'Activity not found',
      });
    }
    return activity;
  }

  private async assertGroupMember(groupId: string, userId: string) {
    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member) {
      throw new NotFoundException({
        code: AppErrorCode.NOT_A_MEMBER,
        message: 'Group member not found',
      });
    }
  }
}
