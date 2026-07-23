import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityType,
  EventEnvironment,
  GroupActivityStatus,
  Prisma,
} from '@prisma/client';
import { AppErrorCode } from '@packplay/common';
import { PrismaService } from '../common/prisma.service';
import {
  CreateEventFromTemplateDto,
  CreateTemplateFromEventDto,
} from './dto';

interface TemplateSnapshot {
  activityType: ActivityType;
  sportProfileId: string | null;
  description: string | null;
  venueName: string | null;
  environment: EventEnvironment | null;
  surface: string | null;
  durationMinutes: number | null;
  deadlineOffsetMinutes: number | null;
  sharedItems: Array<{
    name: string;
    requiredQuantity: number;
    category: string | null;
    isMandatory: boolean;
    notes: string | null;
  }>;
  roles: Array<{
    name: string;
    requirements: Prisma.JsonValue | null;
  }>;
}

@Injectable()
export class PreparationTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async createFromEvent(
    groupId: string,
    activityId: string,
    userId: string,
    dto: CreateTemplateFromEventDto,
  ) {
    const snapshot = await this.snapshotEvent(groupId, activityId);
    return this.prisma.preparationTemplate.create({
      data: {
        groupId,
        name: dto.name,
        description: dto.description,
        createdById: userId,
        versions: {
          create: {
            version: 1,
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
            createdById: userId,
          },
        },
      },
      include: { versions: true },
    });
  }

  async addVersion(
    groupId: string,
    templateId: string,
    activityId: string,
    userId: string,
  ) {
    const template = await this.getTemplate(groupId, templateId);
    const snapshot = await this.snapshotEvent(groupId, activityId);
    const latestVersion = template.versions[0]?.version ?? 0;

    return this.prisma.preparationTemplateVersion.create({
      data: {
        templateId,
        version: latestVersion + 1,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        createdById: userId,
      },
    });
  }

  list(groupId: string) {
    return this.prisma.preparationTemplate.findMany({
      where: { groupId },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
        _count: { select: { versions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getTemplate(groupId: string, templateId: string) {
    const template = await this.prisma.preparationTemplate.findUnique({
      where: { id: templateId },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
    if (!template || template.groupId !== groupId) {
      throw new NotFoundException({
        code: AppErrorCode.NOT_FOUND,
        message: 'Preparation template not found',
      });
    }
    return template;
  }

  async createEvent(
    groupId: string,
    templateId: string,
    userId: string,
    dto: CreateEventFromTemplateDto,
  ) {
    const template = await this.getTemplate(groupId, templateId);
    const selected = dto.version
      ? template.versions.find((version) => version.version === dto.version)
      : template.versions[0];
    if (!selected) {
      throw new NotFoundException({
        code: AppErrorCode.NOT_FOUND,
        message: 'Preparation template version not found',
      });
    }

    const snapshot = selected.snapshot as unknown as TemplateSnapshot;
    const start = new Date(dto.date);
    const end = dto.endAt
      ? new Date(dto.endAt)
      : snapshot.durationMinutes
        ? new Date(start.getTime() + snapshot.durationMinutes * 60_000)
        : null;
    const deadline = snapshot.deadlineOffsetMinutes
      ? new Date(start.getTime() - snapshot.deadlineOffsetMinutes * 60_000)
      : null;

    return this.prisma.groupActivity.create({
      data: {
        groupId,
        name: dto.name,
        description: snapshot.description,
        activityType: snapshot.activityType,
        sportProfileId: snapshot.sportProfileId,
        status: dto.status ?? GroupActivityStatus.DRAFT,
        date: start,
        endAt: end,
        venueName: snapshot.venueName,
        environment: snapshot.environment,
        surface: snapshot.surface,
        responsibilityDeadline: deadline,
        createdById: userId,
        sharedItems: {
          create: snapshot.sharedItems.map((item) => ({
            ...item,
            createdById: userId,
          })),
        },
        roles: {
          create: snapshot.roles.map((role) => ({
            name: role.name,
            requirements:
              role.requirements === null
                ? Prisma.JsonNull
                : (role.requirements as Prisma.InputJsonValue),
          })),
        },
      },
      include: { sharedItems: true, roles: true },
    });
  }

  private async snapshotEvent(
    groupId: string,
    activityId: string,
  ): Promise<TemplateSnapshot> {
    const activity = await this.prisma.groupActivity.findUnique({
      where: { id: activityId },
      include: { sharedItems: true, roles: true },
    });
    if (!activity || activity.groupId !== groupId) {
      throw new NotFoundException({
        code: AppErrorCode.ACTIVITY_NOT_FOUND,
        message: 'Activity not found',
      });
    }

    return {
      activityType: activity.activityType,
      sportProfileId: activity.sportProfileId,
      description: activity.description,
      venueName: activity.venueName,
      environment: activity.environment,
      surface: activity.surface,
      durationMinutes:
        activity.date && activity.endAt
          ? Math.round((activity.endAt.getTime() - activity.date.getTime()) / 60_000)
          : null,
      deadlineOffsetMinutes:
        activity.date && activity.responsibilityDeadline
          ? Math.round(
              (activity.date.getTime() - activity.responsibilityDeadline.getTime()) /
                60_000,
            )
          : null,
      sharedItems: activity.sharedItems.map((item) => ({
        name: item.name,
        requiredQuantity: item.requiredQuantity,
        category: item.category,
        isMandatory: item.isMandatory,
        notes: item.notes,
      })),
      roles: activity.roles.map((role) => ({
        name: role.name,
        requirements: role.requirements,
      })),
    };
  }
}
