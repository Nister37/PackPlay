import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ResponsibilityTransferStatus, SharedResponsibilityStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { AppErrorCode } from '@packplay/common';
import { CreateGroupActivityDto } from './dto/create-group-activity.dto';
import { CreateSharedItemDto } from './dto/create-shared-item.dto';
import { UpdateSharedItemDto } from './dto/update-shared-item.dto';
import {
  ClaimResponsibilityDto,
  ExtraResponsibilityDto,
  PackResponsibilityDto,
  ReportMissingDto,
  TakeOverDto,
  TransferResponsibilityDto,
} from './dto/responsibility.dto';
import { calculateCoverage } from './coverage.util';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SharedEquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Group Activities ─────────────────────────────────────────────────

  async createActivity(groupId: string, userId: string, dto: CreateGroupActivityDto) {
    return this.prisma.groupActivity.create({
      data: {
        groupId,
        name: dto.name,
        activityType: dto.activityType,
        sportProfileId: dto.sportProfileId,
        date: dto.date ? new Date(dto.date) : null,
        createdById: userId,
      },
    });
  }

  async listActivities(groupId: string) {
    return this.prisma.groupActivity.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { sharedItems: true } },
      },
    });
  }

  async getActivity(groupId: string, activityId: string) {
    const activity = await this.prisma.groupActivity.findUnique({
      where: { id: activityId },
      include: {
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
        createdById: userId,
      },
    });

    await this.invalidateActivityCache(activityId);

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
    await this.assertActivityGroupMember(activityId, userId);
    await this.findSharedItemOrThrow(activityId, itemId);
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

    if (quantity < 1) {
      throw new BadRequestException({
        code: AppErrorCode.INVALID_QUANTITY,
        message: 'Quantity must be at least 1',
      });
    }

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

      // Check if user already has an active responsibility
      const existing = item.responsibilities.find(
        (r) =>
          r.userId === userId &&
          (r.status === SharedResponsibilityStatus.COMMITTED ||
            r.status === SharedResponsibilityStatus.PACKED),
      );

      if (existing) {
        throw new ConflictException({
          code: AppErrorCode.ALREADY_CLAIMED,
          message: 'You have already claimed this item',
        });
      }

      // Check if claim would exceed required quantity
      const currentCommitted = item.responsibilities
        .filter(
          (r) =>
            r.status === SharedResponsibilityStatus.COMMITTED ||
            r.status === SharedResponsibilityStatus.PACKED,
        )
        .reduce((sum, r) => sum + r.committedQuantity, 0);

      if (currentCommitted + quantity > item.requiredQuantity) {
        throw new ConflictException({
          code: AppErrorCode.SHARED_ITEM_ALREADY_COVERED,
          message: 'Claiming this quantity would exceed the required amount',
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

      if (responsibility.status === SharedResponsibilityStatus.PACKED) {
        throw new BadRequestException({
          code: AppErrorCode.CANNOT_RELEASE_PACKED,
          message: 'Cannot release a responsibility that is already packed',
        });
      }

      return tx.sharedResponsibility.update({
        where: { id: responsibility.id },
        data: { status: SharedResponsibilityStatus.RELEASED },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    });

    if (activityId) await this.invalidateActivityCache(activityId);
    return result;
  }

  async packResponsibility(itemId: string, userId: string, dto: PackResponsibilityDto) {
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

      const packQuantity = dto.quantity ?? responsibility.committedQuantity;

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

      // Verify there is a missing responsibility to take over
      const missingResponsibilities = item.responsibilities.filter(
        (r) =>
          r.status === SharedResponsibilityStatus.FORGOT ||
          r.status === SharedResponsibilityStatus.COULD_NOT_BRING,
      );

      if (missingResponsibilities.length === 0) {
        throw new BadRequestException({
          code: AppErrorCode.CANNOT_TAKE_OVER_COVERED,
          message: 'No missing responsibilities to take over',
        });
      }

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

      const targetIsMember = item.groupActivity.group.members.some(
        (m) => m.userId === dto.targetUserId,
      );

      if (!targetIsMember) {
        throw new BadRequestException({
          code: AppErrorCode.TRANSFER_TARGET_NOT_MEMBER,
          message: 'Transfer target is not a member of the group',
        });
      }

      if (dto.targetUserId === userId) {
        throw new BadRequestException('Responsibility must be transferred to another member');
      }

      // Check if target already has an active responsibility
      const targetExisting = await tx.sharedResponsibility.findUnique({
        where: {
          sharedItemId_userId: { sharedItemId: itemId, userId: dto.targetUserId },
        },
      });

      if (
        targetExisting &&
        (targetExisting.status === SharedResponsibilityStatus.COMMITTED ||
          targetExisting.status === SharedResponsibilityStatus.PACKED)
      ) {
        throw new ConflictException({
          code: AppErrorCode.ALREADY_CLAIMED,
          message: 'Target user already has an active responsibility for this item',
        });
      }

      const transferQuantity = dto.quantity ?? responsibility.committedQuantity;
      if (transferQuantity > responsibility.committedQuantity) {
        throw new BadRequestException('Transfer quantity exceeds current responsibility');
      }

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
    return this.prisma.$transaction(async (tx) => {
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
            group: { select: { members: { where: { userId }, select: { id: true }, take: 1 } } },
          },
        },
      },
    });
    if (!item?.groupActivity?.group?.members?.length) {
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
}
