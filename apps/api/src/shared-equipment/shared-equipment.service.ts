import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  GroupActivityStatus,
  NotificationType,
  Prisma,
  ResponsibilityTransferStatus,
  SharedResponsibilityStatus,
} from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { AppErrorCode } from '@packplay/common';
import { CreateGroupActivityDto } from './dto/create-group-activity.dto';
import { CreateSharedItemDto } from './dto/create-shared-item.dto';
import { UpdateSharedItemDto } from './dto/update-shared-item.dto';
import { UpdateGroupActivityDto } from './dto/update-group-activity.dto';
import { ListGroupActivitiesQueryDto } from './dto/list-group-activities-query.dto';
import {
  ClaimResponsibilityDto,
  ExtraResponsibilityDto,
  PackResponsibilityDto,
  ReportMissingDto,
  TakeOverDto,
  TransferResponsibilityDto,
} from './dto/responsibility.dto';
import { calculateCoverage } from './coverage.util';
import { ItemCoverage } from './models/item-coverage';
import { NotificationsService } from '../notifications/notifications.service';
import { EventActivityLogService } from '../event-planning/event-activity-log.service';
import { GroupsService } from '../groups/groups.service';
import { EventBusService } from '../common/event-bus.service';
import {
  ItemCreatedEvent,
  ItemPackedEvent,
  CustodyTransferredEvent,
} from '../common/domain-events';

@Injectable()
export class SharedEquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notificationsService: NotificationsService,
    @Optional() private readonly groupsService?: GroupsService,
    @Optional() private readonly eventLog?: EventActivityLogService,
    @Optional() private readonly eventBus?: EventBusService,
  ) {}

  // ─── Group Activities ─────────────────────────────────────────────────

  async createActivity(groupId: string, userId: string, dto: CreateGroupActivityDto) {
    this.validateActivityDates(dto);
    return this.prisma.groupActivity.create({
      data: {
        groupId,
        name: dto.name,
        description: dto.description,
        activityType: dto.activityType,
        sportProfileId: dto.sportProfileId,
        status: dto.status,
        date: dto.date ? new Date(dto.date) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
        venueName: dto.venueName,
        latitude: dto.latitude,
        longitude: dto.longitude,
        environment: dto.environment,
        surface: dto.surface,
        responsibilityDeadline: dto.responsibilityDeadline
          ? new Date(dto.responsibilityDeadline)
          : null,
        createdById: userId,
      },
    });
  }

  async listActivities(groupId: string, query: ListGroupActivitiesQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const date: Prisma.DateTimeNullableFilter | undefined =
      query.from || query.to
        ? {
            ...(query.from && { gte: new Date(query.from) }),
            ...(query.to && { lte: new Date(query.to) }),
          }
        : undefined;

    const where: Prisma.GroupActivityWhereInput = {
      groupId,
      ...(query.status
        ? { status: query.status }
        : { status: { not: GroupActivityStatus.ARCHIVED } }),
      ...(date && { date }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search } },
          { venueName: { contains: query.search } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.groupActivity.findMany({
        where,
        orderBy: [{ date: 'asc' }, { createdAt: 'desc' }],
        include: {
          _count: { select: { sharedItems: true } },
        },
        skip,
        take: limit,
      }),
      this.prisma.groupActivity.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateActivity(
    groupId: string,
    activityId: string,
    dto: UpdateGroupActivityDto,
  ) {
    const activity = await this.getActivity(groupId, activityId);
    this.validateActivityDates(dto, activity.date, activity.endAt);

    return this.prisma.groupActivity.update({
      where: { id: activityId },
      data: {
        ...dto,
        ...(dto.date !== undefined && { date: dto.date ? new Date(dto.date) : null }),
        ...(dto.endAt !== undefined && {
          endAt: dto.endAt ? new Date(dto.endAt) : null,
        }),
        ...(dto.responsibilityDeadline !== undefined && {
          responsibilityDeadline: dto.responsibilityDeadline
            ? new Date(dto.responsibilityDeadline)
            : null,
        }),
      },
    });
  }

  async duplicateActivity(groupId: string, activityId: string, userId: string) {
    const original = await this.getActivity(groupId, activityId);
    return this.prisma.groupActivity.create({
      data: {
        groupId,
        name: `${original.name} (copy)`,
        description: original.description,
        sportProfileId: original.sportProfileId,
        activityType: original.activityType,
        status: GroupActivityStatus.DRAFT,
        venueName: original.venueName,
        latitude: original.latitude,
        longitude: original.longitude,
        environment: original.environment,
        surface: original.surface,
        createdById: userId,
        sharedItems: {
          create: original.sharedItems.map((item) => ({
            name: item.name,
            requiredQuantity: item.requiredQuantity,
            category: item.category,
            isMandatory: item.isMandatory,
            notes: item.notes,
            createdById: userId,
          })),
        },
      },
      include: { sharedItems: true },
    });
  }

  async archiveActivity(groupId: string, activityId: string) {
    await this.getActivity(groupId, activityId);
    return this.prisma.groupActivity.update({
      where: { id: activityId },
      data: { status: GroupActivityStatus.ARCHIVED, archivedAt: new Date() },
    });
  }

  async deleteActivity(groupId: string, activityId: string) {
    await this.getActivity(groupId, activityId);
    await this.prisma.groupActivity.delete({
      where: { id: activityId },
    });
    await this.invalidateActivityCache(activityId);
  }

  async broadcastGearReminder(groupId: string, activityId: string, userId: string) {
    const activity = await this.prisma.groupActivity.findUnique({
      where: { id: activityId },
      include: {
        group: {
          include: {
            members: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        },
        sharedItems: {
          include: {
            responsibilities: true,
          },
        },
      },
    });

    if (!activity || activity.groupId !== groupId) {
      throw new NotFoundException({
        code: AppErrorCode.ACTIVITY_NOT_FOUND,
        message: 'Activity not found',
      });
    }

    const callerMembership = activity.group.members.find((m) => m.userId === userId);
    if (!callerMembership) {
      throw new ForbiddenException({
        code: AppErrorCode.NOT_A_MEMBER,
        message: 'You are not a member of this squad',
      });
    }

    const uncoveredItems = activity.sharedItems.filter((item) => {
      const committedQty = item.responsibilities
        .filter(
          (r) =>
            r.status === SharedResponsibilityStatus.COMMITTED ||
            r.status === SharedResponsibilityStatus.PACKED,
        )
        .reduce((sum, r) => sum + r.committedQuantity, 0);
      return committedQty < item.requiredQuantity;
    });

    const otherMembers = activity.group.members.filter((m) => m.userId !== userId);
    const callerName = callerMembership.user?.name || 'A squad member';

    const uncoveredCount = uncoveredItems.length;
    const itemNames = uncoveredItems.map((i) => i.name).slice(0, 5);

    if (otherMembers.length > 0) {
      await this.notificationsService.createNotificationsBatch(
        otherMembers.map((m) => ({
          userId: m.userId,
          groupId,
          type: NotificationType.ITEM_MISSING,
          payload: {
            title: `Gear Reminder: ${activity.name}`,
            body:
              uncoveredCount > 0
                ? `${callerName} broadcasted a gear reminder. ${uncoveredCount} item(s) needed: ${itemNames.join(', ')}`
                : `${callerName} checked the manifest for ${activity.name}. All items currently covered!`,
            activityId,
            activityName: activity.name,
            groupId,
            groupName: activity.group.name,
            uncoveredCount,
            uncoveredItems: itemNames,
            senderName: callerName,
          },
        })),
      );
    }

    return {
      success: true,
      notifiedCount: otherMembers.length,
      uncoveredCount,
      uncoveredItems: itemNames,
      activityName: activity.name,
    };
  }

  async getActivity(groupId: string, activityId: string) {
    const activity = await this.prisma.groupActivity.findUnique({
      where: { id: activityId },
      include: {
        group: true,
        sportProfile: true,
        sharedItems: {
          include: {
            responsibilities: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!activity || activity.groupId !== groupId) {
      throw new NotFoundException({
        code: AppErrorCode.ACTIVITY_NOT_FOUND,
        message: 'Activity not found',
      });
    }

    return activity;
  }

  private validateActivityDates(
    dto: Pick<
      UpdateGroupActivityDto,
      'date' | 'endAt' | 'responsibilityDeadline'
    >,
    existingStart: Date | null = null,
    existingEnd: Date | null = null,
  ): void {
    const start = dto.date !== undefined ? (dto.date ? new Date(dto.date) : null) : existingStart;
    const end = dto.endAt !== undefined ? (dto.endAt ? new Date(dto.endAt) : null) : existingEnd;
    const deadline = dto.responsibilityDeadline
      ? new Date(dto.responsibilityDeadline)
      : null;

    if (start && end && end <= start) {
      throw new BadRequestException({
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'Event end time must be after its start time',
      });
    }
    if (start && deadline && deadline >= start) {
      throw new BadRequestException({
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'Responsibility deadline must be before the event starts',
      });
    }
  }

  // ─── Shared Items ─────────────────────────────────────────────────────

  async addSharedItem(activityId: string, userId: string, dto: CreateSharedItemDto) {
    const activity = await this.assertActivityGroupMember(activityId, userId);

    const item = await this.prisma.sharedItem.create({
      data: {
        groupActivityId: activity.id,
        name: dto.name,
        requiredQuantity: dto.requiredQuantity ?? 1,
        category: dto.category,
        isMandatory: dto.isMandatory ?? true,
        notes: dto.notes,
        catalogueItemId: dto.catalogueItemId,
        createdById: userId,
      },
    });

    await this.invalidateActivityCache(activityId);
    if (this.eventBus) {
      this.eventBus.publish(
        new ItemCreatedEvent({
          activityId: activity.id,
          itemId: item.id,
          groupId: activity.groupId,
          catalogueItemId: dto.catalogueItemId,
          createdById: userId,
        }),
      );
    }

    return item;
  }

  async updateSharedItem(
    activityId: string,
    itemId: string,
    userId: string,
    dto: UpdateSharedItemDto,
  ) {
    await this.assertActivityGroupMember(activityId, userId);
    const item = await this.findSharedItemOrThrow(activityId, itemId);

    const updated = await this.prisma.sharedItem.update({
      where: { id: item.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.requiredQuantity !== undefined && { requiredQuantity: dto.requiredQuantity }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.isMandatory !== undefined && { isMandatory: dto.isMandatory }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    await this.invalidateActivityCache(activityId);
    return updated;
  }

  async deleteSharedItem(activityId: string, itemId: string, userId: string) {
    const activity = await this.assertActivityGroupMember(activityId, userId);
    const item = await this.findSharedItemOrThrow(activityId, itemId);

    const canManage = this.groupsService
      ? await this.groupsService.canUserManageGroup(activity.groupId, userId)
      : false;
    const canDelete = canManage || item.createdById === userId;

    if (!canDelete) {
      throw new ForbiddenException({
        code: AppErrorCode.FORBIDDEN,
        message: 'You do not have permission to remove this equipment item',
      });
    }

    await this.prisma.sharedItem.delete({ where: { id: itemId } });
    await this.invalidateActivityCache(activityId);
  }

  async listSharedItems(activityId: string, userId: string) {
    await this.assertActivityGroupMember(activityId, userId);
    const cacheKey = `shared-items:activity:${activityId}`;
    const cached = await this.redis.get<unknown[]>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.findActivityOrThrow(activityId);

    const items = await this.prisma.sharedItem.findMany({
      where: { groupActivityId: activityId },
      include: {
        responsibilities: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        inventoryReservations: {
          where: { status: { in: ['ACTIVE', 'FULFILLED'] } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const result = items.map((item) => ({
      ...item,
      coverage: calculateCoverage(
        item.requiredQuantity,
        item.responsibilities,
        item.inventoryReservations.reduce(
          (sum, reservation) => sum + reservation.quantity,
          0,
        ),
      ),
    }));

    await this.redis.set(cacheKey, result, 60);

    return result;
  }

  // ─── Cache helpers ─────────────────────────────────────────────────────

  private async invalidateActivityCache(activityId: string): Promise<void> {
    await Promise.all([
      this.redis.del(`shared-items:activity:${activityId}`),
      this.redis.del(`readiness:activity:${activityId}`),
    ]);
  }

  private async getActivityIdForItem(itemId: string): Promise<string | null> {
    const item = await this.prisma.sharedItem.findUnique({
      where: { id: itemId },
      select: { groupActivityId: true },
    });
    return item?.groupActivityId ?? null;
  }

  // ─── Responsibilities ─────────────────────────────────────────────────

  async claimResponsibility(itemId: string, userId: string, dto: ClaimResponsibilityDto) {
    await this.assertItemGroupMember(itemId, userId);
    const quantity = dto.quantity ?? 1;

    const activityId = await this.getActivityIdForItem(itemId);

    const result = await this.prisma.$transaction(async (tx) => {
      const item = await tx.sharedItem.findUnique({
        where: { id: itemId },
        include: { responsibilities: true },
      });

      if (!item) {
        throw new NotFoundException({
          code: AppErrorCode.SHARED_ITEM_NOT_FOUND,
          message: 'Shared item not found',
        });
      }

      const coverage = ItemCoverage.fromItem(item.requiredQuantity, item.responsibilities);
      coverage.assertCanClaim(userId, quantity);

      return tx.sharedResponsibility.create({
        data: {
          sharedItemId: itemId,
          userId,
          committedQuantity: quantity,
          status: SharedResponsibilityStatus.COMMITTED,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    });

    if (activityId) await this.invalidateActivityCache(activityId);
    await this.recordEventAction(activityId, userId, 'RESPONSIBILITY_CLAIMED', itemId, quantity);
    return result;
  }

  async releaseResponsibility(itemId: string, userId: string) {
    const activityId = await this.getActivityIdForItem(itemId);

    const result = await this.prisma.$transaction(async (tx) => {
      const responsibility = await tx.sharedResponsibility.findUnique({
        where: { sharedItemId_userId: { sharedItemId: itemId, userId } },
      });

      if (!responsibility) {
        throw new NotFoundException({
          code: AppErrorCode.RESPONSIBILITY_NOT_FOUND,
          message: 'No responsibility found for this item',
        });
      }

      const coverage = ItemCoverage.fromItem(0, [responsibility]);
      coverage.assertCanRelease(userId);

      return tx.sharedResponsibility.update({
        where: { id: responsibility.id },
        data: { status: SharedResponsibilityStatus.RELEASED },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    });

    if (activityId) await this.invalidateActivityCache(activityId);
    await this.recordEventAction(
      activityId,
      userId,
      'RESPONSIBILITY_RELEASED',
      itemId,
      result.committedQuantity,
    );
    return result;
  }

  async packResponsibility(itemId: string, userId: string, dto: PackResponsibilityDto) {
    const activityId = await this.getActivityIdForItem(itemId);
    const result = await this.prisma.$transaction(async (tx) => {
      const responsibility = await tx.sharedResponsibility.findUnique({
        where: { sharedItemId_userId: { sharedItemId: itemId, userId } },
      });

      if (!responsibility) {
        throw new NotFoundException({
          code: AppErrorCode.RESPONSIBILITY_NOT_FOUND,
          message: 'No responsibility found for this item',
        });
      }

      const packQuantity = dto.quantity ?? responsibility.committedQuantity;
      const coverage = ItemCoverage.fromItem(0, [responsibility]);
      coverage.assertCanPack(userId, packQuantity);

      return tx.sharedResponsibility.update({
        where: { id: responsibility.id },
        data: {
          status: SharedResponsibilityStatus.PACKED,
          packedQuantity: packQuantity,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    });

    if (this.eventBus) {
      this.eventBus.publish(
        new ItemPackedEvent({
          activityId: activityId ?? '',
          itemId,
          userId,
          timestamp: new Date(),
        }),
      );
    }
    await this.recordEventAction(
      activityId,
      userId,
      'RESPONSIBILITY_PACKED',
      itemId,
      result.packedQuantity,
    );
    return result;
  }

  async addExtra(itemId: string, userId: string, dto: ExtraResponsibilityDto) {
    const quantity = dto.quantity ?? 1;

    return this.prisma.$transaction(async (tx) => {
      const responsibility = await tx.sharedResponsibility.findUnique({
        where: { sharedItemId_userId: { sharedItemId: itemId, userId } },
      });

      if (!responsibility) {
        throw new NotFoundException({
          code: AppErrorCode.RESPONSIBILITY_NOT_FOUND,
          message: 'No responsibility found for this item',
        });
      }

      return tx.sharedResponsibility.update({
        where: { id: responsibility.id },
        data: {
          extraQuantity: responsibility.extraQuantity + quantity,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    });
  }

  async reportMissing(itemId: string, userId: string, dto: ReportMissingDto) {
    await this.assertItemGroupMember(itemId, userId);
    const result = await this.prisma.$transaction(async (tx) => {
      const responsibility = await tx.sharedResponsibility.findUnique({
        where: { sharedItemId_userId: { sharedItemId: itemId, userId } },
      });

      if (!responsibility) {
        throw new NotFoundException({
          code: AppErrorCode.RESPONSIBILITY_NOT_FOUND,
          message: 'No responsibility found for this item',
        });
      }

      const statusMap: Record<string, SharedResponsibilityStatus> = {
        FORGOT: SharedResponsibilityStatus.FORGOT,
        COULD_NOT_BRING: SharedResponsibilityStatus.COULD_NOT_BRING,
        REPLACEMENT_ARRANGED: SharedResponsibilityStatus.REPLACEMENT_ARRANGED,
      };

      return tx.sharedResponsibility.update({
        where: { id: responsibility.id },
        data: { status: statusMap[dto.reason] },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    });

    const item = await this.prisma.sharedItem.findUnique({
      where: { id: itemId },
      select: {
        name: true,
        groupActivityId: true,
        groupActivity: {
          select: {
            groupId: true,
            group: { select: { members: { select: { userId: true } } } },
          },
        },
      },
    });

    if (item) {
      await this.notificationsService.createNotificationsBatch(
        item.groupActivity.group.members
          .filter((member) => member.userId !== userId)
          .map((member) => ({
            userId: member.userId,
            groupId: item.groupActivity.groupId,
            type: 'ITEM_MISSING',
            payload: {
              sharedItemId: itemId,
              sharedItemName: item.name,
              activityId: item.groupActivityId,
              reportedByUserId: userId,
              reason: dto.reason,
            },
          })),
      );
      await this.recordEventAction(
        item.groupActivityId,
        userId,
        'RESPONSIBILITY_MISSING',
        itemId,
        result.committedQuantity,
        { reason: dto.reason },
      );
    }

    return result;
  }

  async takeOver(itemId: string, userId: string, dto: TakeOverDto) {
    await this.assertItemGroupMember(itemId, userId);
    const quantity = dto.quantity ?? 1;
    const activityId = await this.getActivityIdForItem(itemId);

    const result = await this.prisma.$transaction(async (tx) => {
      const item = await tx.sharedItem.findUnique({
        where: { id: itemId },
        include: { responsibilities: true },
      });

      if (!item) {
        throw new NotFoundException({
          code: AppErrorCode.SHARED_ITEM_NOT_FOUND,
          message: 'Shared item not found',
        });
      }

      const coverage = ItemCoverage.fromItem(item.requiredQuantity, item.responsibilities);
      coverage.assertCanTakeOver(userId, quantity);

      // Verify there is a missing responsibility to take over
      const missingResponsibilities = item.responsibilities.filter(
        (r) =>
          r.status === SharedResponsibilityStatus.FORGOT ||
          r.status === SharedResponsibilityStatus.COULD_NOT_BRING,
      );

      // Check if user already has an active claim
      const existing = item.responsibilities.find(
        (r) =>
          r.userId === userId &&
          (r.status === SharedResponsibilityStatus.COMMITTED ||
            r.status === SharedResponsibilityStatus.PACKED),
      );

      // Mark the first missing responsibility as REPLACEMENT_ARRANGED
      await tx.sharedResponsibility.update({
        where: { id: missingResponsibilities[0].id },
        data: { status: SharedResponsibilityStatus.REPLACEMENT_ARRANGED },
      });

      if (existing) {
        return tx.sharedResponsibility.update({
          where: { id: existing.id },
          data: {
            committedQuantity: existing.committedQuantity + quantity,
            status: SharedResponsibilityStatus.COMMITTED,
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        });
      }

      // Create or update responsibility for the taking-over user
      const existingReleasedOrMissing = item.responsibilities.find(
        (r) =>
          r.userId === userId &&
          r.status !== SharedResponsibilityStatus.COMMITTED &&
          r.status !== SharedResponsibilityStatus.PACKED,
      );

      if (existingReleasedOrMissing) {
        return tx.sharedResponsibility.update({
          where: { id: existingReleasedOrMissing.id },
          data: {
            committedQuantity: quantity,
            status: SharedResponsibilityStatus.COMMITTED,
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        });
      }

      return tx.sharedResponsibility.create({
        data: {
          sharedItemId: itemId,
          userId,
          committedQuantity: quantity,
          status: SharedResponsibilityStatus.COMMITTED,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    });

    if (activityId) await this.invalidateActivityCache(activityId);
    await this.recordEventAction(
      activityId,
      userId,
      'RESPONSIBILITY_TAKEN_OVER',
      itemId,
      quantity,
    );
    return result;
  }

  async transferResponsibility(itemId: string, userId: string, dto: TransferResponsibilityDto) {
    await this.assertItemGroupMember(itemId, userId);
    return this.prisma.$transaction(async (tx) => {
      const responsibility = await tx.sharedResponsibility.findUnique({
        where: { sharedItemId_userId: { sharedItemId: itemId, userId } },
      });

      if (!responsibility) {
        throw new NotFoundException({
          code: AppErrorCode.RESPONSIBILITY_NOT_FOUND,
          message: 'No responsibility found for this item',
        });
      }

      // Verify the item belongs to an activity in a group and target user is a member
      const item = await tx.sharedItem.findUnique({
        where: { id: itemId },
        include: {
          groupActivity: {
            include: {
              group: { include: { members: true } },
            },
          },
        },
      });

      if (!item) {
        throw new NotFoundException({
          code: AppErrorCode.SHARED_ITEM_NOT_FOUND,
          message: 'Shared item not found',
        });
      }

      let targetIsMember = false;
      if (this.groupsService && item.groupActivity?.groupId) {
        const member = await this.groupsService.getMember(
          item.groupActivity.groupId,
          dto.targetUserId,
        );
        targetIsMember = Boolean(member);
      }
      if (!targetIsMember && item.groupActivity?.group?.members) {
        targetIsMember = item.groupActivity.group.members.some(
          (m: { userId: string }) => m.userId === dto.targetUserId,
        );
      }

      if (!targetIsMember) {
        throw new BadRequestException({
          code: AppErrorCode.TRANSFER_TARGET_NOT_MEMBER,
          message: 'Transfer target is not a member of the group',
        });
      }

      const targetExisting = await tx.sharedResponsibility.findUnique({
        where: {
          sharedItemId_userId: { sharedItemId: itemId, userId: dto.targetUserId },
        },
      });

      const coverage = ItemCoverage.fromItem(item.requiredQuantity ?? 0, [
        { ...responsibility, userId },
        ...(targetExisting ? [{ ...targetExisting, userId: dto.targetUserId }] : []),
      ]);
      coverage.assertCanTransfer(userId, dto.targetUserId, dto.quantity);

      const transferQuantity = dto.quantity ?? responsibility.committedQuantity;

      await tx.responsibilityTransfer.updateMany({
        where: {
          sharedItemId: itemId,
          fromUserId: userId,
          status: ResponsibilityTransferStatus.PENDING,
        },
        data: { status: ResponsibilityTransferStatus.CANCELLED, respondedAt: new Date() },
      });

      return tx.responsibilityTransfer.create({
        data: {
          sharedItemId: itemId,
          fromUserId: userId,
          toUserId: dto.targetUserId,
          quantity: transferQuantity,
        },
        include: {
          fromUser: { select: { id: true, name: true } },
          toUser: { select: { id: true, name: true } },
        },
      });
    });
  }

  async acceptTransfer(itemId: string, transferId: string, userId: string) {
    await this.assertItemGroupMember(itemId, userId);
    const result = await this.prisma.$transaction(async (tx) => {
      const transfer = await tx.responsibilityTransfer.findUnique({ where: { id: transferId } });
      if (
        !transfer ||
        transfer.sharedItemId !== itemId ||
        transfer.toUserId !== userId ||
        transfer.status !== ResponsibilityTransferStatus.PENDING
      ) {
        throw new NotFoundException('Pending transfer not found');
      }
      const source = await tx.sharedResponsibility.findUnique({
        where: { sharedItemId_userId: { sharedItemId: itemId, userId: transfer.fromUserId } },
      });
      if (
        !source ||
        source.status !== SharedResponsibilityStatus.COMMITTED ||
        source.committedQuantity < transfer.quantity
      ) {
        throw new ConflictException('The original responsibility is no longer available');
      }

      const remaining = source.committedQuantity - transfer.quantity;
      await tx.sharedResponsibility.update({
        where: { id: source.id },
        data: {
          committedQuantity: Math.max(remaining, 1),
          status:
            remaining === 0
              ? SharedResponsibilityStatus.RELEASED
              : SharedResponsibilityStatus.COMMITTED,
        },
      });
      await tx.sharedResponsibility.upsert({
        where: { sharedItemId_userId: { sharedItemId: itemId, userId } },
        create: {
          sharedItemId: itemId,
          userId,
          committedQuantity: transfer.quantity,
          status: SharedResponsibilityStatus.COMMITTED,
        },
        update: {
          committedQuantity: transfer.quantity,
          status: SharedResponsibilityStatus.COMMITTED,
        },
      });
      return tx.responsibilityTransfer.update({
        where: { id: transferId },
        data: { status: ResponsibilityTransferStatus.ACCEPTED, respondedAt: new Date() },
      });
    });

    const bus = this.eventBus;
    if (bus) {
      const activityId = await this.getActivityIdForItem(itemId);
      bus.publish(
        new CustodyTransferredEvent({
          activityId: activityId ?? '',
          itemId,
          fromUserId: result.fromUserId,
          toUserId: result.toUserId,
          quantity: result.quantity,
        }),
      );
    }

    return result;
  }

  async getCoverage(itemId: string, userId: string) {
    await this.assertItemGroupMember(itemId, userId);
    const item = await this.prisma.sharedItem.findUnique({
      where: { id: itemId },
      include: {
        responsibilities: { include: { user: { select: { id: true, name: true, email: true } } } },
        groupActivity: {
          include: {
            group: {
              include: {
                members: { include: { user: { select: { id: true, name: true, email: true } } } },
              },
            },
          },
        },
        responsibilityTransfers: {
          where: { status: ResponsibilityTransferStatus.PENDING },
          include: {
            fromUser: { select: { id: true, name: true } },
            toUser: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException({
        code: AppErrorCode.SHARED_ITEM_NOT_FOUND,
        message: 'Shared item not found',
      });
    }

    const coverage = calculateCoverage(item.requiredQuantity, item.responsibilities);
    return {
      ...coverage,
      item: {
        id: item.id,
        name: item.name,
        category: item.category ?? undefined,
        description: item.notes,
        requiredQuantity: item.requiredQuantity,
        unit: 'unit(s)',
      },
      responsibilities: item.responsibilities.map((responsibility) => ({
        ...responsibility,
        quantity: responsibility.committedQuantity,
      })),
      coveredQuantity: coverage.committedQuantity,
      missingQuantity: coverage.uncoveredQuantity,
      isCovered: coverage.uncoveredQuantity === 0,
      coverage,
      eligibleMembers: item.groupActivity.group.members.map((member) => member.user),
      pendingTransfers: item.responsibilityTransfers,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private async findActivityOrThrow(activityId: string) {
    const activity = await this.prisma.groupActivity.findUnique({
      where: { id: activityId },
    });

    if (!activity) {
      throw new NotFoundException({
        code: AppErrorCode.ACTIVITY_NOT_FOUND,
        message: 'Activity not found',
      });
    }

    return activity;
  }

  private async assertActivityGroupMember(activityId: string, userId: string) {
    const activity = await this.prisma.groupActivity.findFirst({
      where: {
        id: activityId,
        group: { members: { some: { userId } } },
      },
    });

    if (!activity) {
      throw new NotFoundException({
        code: AppErrorCode.ACTIVITY_NOT_FOUND,
        message: 'Activity not found',
      });
    }

    return activity;
  }

  private async assertItemGroupMember(itemId: string, userId: string): Promise<void> {
    const item = await this.prisma.sharedItem.findUnique({
      where: { id: itemId },
      select: {
        groupActivity: {
          select: {
            groupId: true,
            group: { select: { members: { where: { userId }, select: { id: true }, take: 1 } } },
          },
        },
      },
    });
    if (!item?.groupActivity) {
      throw new NotFoundException({
        code: AppErrorCode.SHARED_ITEM_NOT_FOUND,
        message: 'Shared item not found',
      });
    }

    let isMember = false;
    if (this.groupsService && item.groupActivity.groupId) {
      const member = await this.groupsService.getMember(item.groupActivity.groupId, userId);
      isMember = Boolean(member);
    }
    if (!isMember && item.groupActivity.group?.members?.length) {
      isMember = true;
    }

    if (!isMember) {
      throw new NotFoundException({
        code: AppErrorCode.SHARED_ITEM_NOT_FOUND,
        message: 'Shared item not found',
      });
    }
  }

  private async findSharedItemOrThrow(activityId: string, itemId: string) {
    const item = await this.prisma.sharedItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.groupActivityId !== activityId) {
      throw new NotFoundException({
        code: AppErrorCode.SHARED_ITEM_NOT_FOUND,
        message: 'Shared item not found',
      });
    }

    return item;
  }

  private async recordEventAction(
    activityId: string | null,
    actorId: string,
    action: string,
    itemId: string,
    quantity?: number,
    details?: Prisma.InputJsonValue,
  ): Promise<void> {
    if (!activityId || !this.eventLog) return;
    await this.eventLog.record({
      activityId,
      actorId,
      action,
      itemId,
      quantity,
      details,
    });
  }
}
