import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SharedResponsibilityStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
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
import { calculateCoverage, CoverageResult } from './coverage.util';

@Injectable()
export class SharedEquipmentService {
  constructor(private readonly prisma: PrismaService) {}

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
    const activity = await this.findActivityOrThrow(activityId);

    return this.prisma.sharedItem.create({
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
  }

  async updateSharedItem(activityId: string, itemId: string, dto: UpdateSharedItemDto) {
    const item = await this.findSharedItemOrThrow(activityId, itemId);

    return this.prisma.sharedItem.update({
      where: { id: item.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.requiredQuantity !== undefined && { requiredQuantity: dto.requiredQuantity }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.isMandatory !== undefined && { isMandatory: dto.isMandatory }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async deleteSharedItem(activityId: string, itemId: string) {
    await this.findSharedItemOrThrow(activityId, itemId);
    await this.prisma.sharedItem.delete({ where: { id: itemId } });
  }

  async listSharedItems(activityId: string) {
    await this.findActivityOrThrow(activityId);

    const items = await this.prisma.sharedItem.findMany({
      where: { groupActivityId: activityId },
      include: {
        responsibilities: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return items.map((item) => ({
      ...item,
      coverage: calculateCoverage(item.requiredQuantity, item.responsibilities),
    }));
  }

  // ─── Responsibilities ─────────────────────────────────────────────────

  async claimResponsibility(itemId: string, userId: string, dto: ClaimResponsibilityDto) {
    const quantity = dto.quantity ?? 1;

    if (quantity < 1) {
      throw new BadRequestException({
        code: AppErrorCode.INVALID_QUANTITY,
        message: 'Quantity must be at least 1',
      });
    }

    return this.prisma.$transaction(async (tx) => {
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
  }

  async releaseResponsibility(itemId: string, userId: string) {
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
  }

  async takeOver(itemId: string, userId: string, dto: TakeOverDto) {
    const quantity = dto.quantity ?? 1;

    return this.prisma.$transaction(async (tx) => {
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

      if (existing) {
        throw new ConflictException({
          code: AppErrorCode.ALREADY_CLAIMED,
          message: 'You already have an active responsibility for this item',
        });
      }

      // Mark the first missing responsibility as REPLACEMENT_ARRANGED
      await tx.sharedResponsibility.update({
        where: { id: missingResponsibilities[0].id },
        data: { status: SharedResponsibilityStatus.REPLACEMENT_ARRANGED },
      });

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
  }

  async transferResponsibility(
    itemId: string,
    userId: string,
    dto: TransferResponsibilityDto,
  ) {
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

      // Release the current responsibility
      await tx.sharedResponsibility.update({
        where: { id: responsibility.id },
        data: { status: SharedResponsibilityStatus.RELEASED },
      });

      // Create or update target's responsibility
      if (targetExisting) {
        return tx.sharedResponsibility.update({
          where: { id: targetExisting.id },
          data: {
            committedQuantity: transferQuantity,
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
          userId: dto.targetUserId,
          committedQuantity: transferQuantity,
          status: SharedResponsibilityStatus.COMMITTED,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    });
  }

  async getCoverage(itemId: string): Promise<CoverageResult> {
    const item = await this.prisma.sharedItem.findUnique({
      where: { id: itemId },
      include: { responsibilities: true },
    });

    if (!item) {
      throw new NotFoundException({
        code: AppErrorCode.SHARED_ITEM_NOT_FOUND,
        message: 'Shared item not found',
      });
    }

    return calculateCoverage(item.requiredQuantity, item.responsibilities);
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
