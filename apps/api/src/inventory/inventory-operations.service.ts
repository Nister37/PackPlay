import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryCondition,
  InventoryMovementType,
  InventoryReservationStatus,
  Prisma,
} from '@prisma/client';
import { AppErrorCode } from '@packplay/common';
import { PrismaService } from '../common/prisma.service';
import {
  CheckoutInventoryDto,
  ReserveInventoryDto,
  ReturnInventoryDto,
  TransferCustodyDto,
} from './dto';

const USABLE: InventoryCondition[] = [
  InventoryCondition.GOOD,
  InventoryCondition.NEEDS_ATTENTION,
];

@Injectable()
export class InventoryOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async reserve(groupId: string, userId: string, dto: ReserveInventoryDto) {
    this.assertSingleTarget(dto.batchId, dto.assetId);
    const quantity = dto.quantity ?? 1;
    await this.assertSharedItem(groupId, dto.sharedItemId);

    return this.prisma.$transaction(
      async (tx) => {
        if (dto.batchId) {
          const updated = await tx.inventoryBatch.updateMany({
            where: {
              id: dto.batchId,
              inventoryItem: { groupId },
              condition: { in: USABLE },
              availableQuantity: { gte: quantity },
            },
            data: { availableQuantity: { decrement: quantity } },
          });
          if (updated.count !== 1) this.stockUnavailable();
        } else {
          const asset = await tx.inventoryAsset.findFirst({
            where: {
              id: dto.assetId,
              inventoryItem: { groupId },
              holderId: null,
              condition: { in: USABLE },
              reservations: {
                none: { status: InventoryReservationStatus.ACTIVE },
              },
            },
          });
          if (!asset) this.stockUnavailable();
        }

        const reservation = await tx.inventoryReservation.create({
          data: {
            sharedItemId: dto.sharedItemId,
            batchId: dto.batchId,
            assetId: dto.assetId,
            quantity,
          },
        });
        await tx.inventoryMovement.create({
          data: {
            groupId,
            batchId: dto.batchId,
            assetId: dto.assetId,
            type: InventoryMovementType.RESERVATION,
            quantity,
            actorId: userId,
            details: { reservationId: reservation.id },
          },
        });
        return reservation;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async releaseReservation(groupId: string, reservationId: string, userId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const reservation = await tx.inventoryReservation.findUnique({
          where: { id: reservationId },
          include: {
            batch: { include: { inventoryItem: true } },
            asset: { include: { inventoryItem: true } },
          },
        });
        const reservationGroup =
          reservation?.batch?.inventoryItem.groupId ??
          reservation?.asset?.inventoryItem.groupId;
        if (
          !reservation ||
          reservationGroup !== groupId ||
          reservation.status !== InventoryReservationStatus.ACTIVE
        ) {
          throw new NotFoundException({
            code: AppErrorCode.NOT_FOUND,
            message: 'Active reservation not found',
          });
        }
        if (reservation.batchId) {
          await tx.inventoryBatch.update({
            where: { id: reservation.batchId },
            data: { availableQuantity: { increment: reservation.quantity } },
          });
        }
        const released = await tx.inventoryReservation.update({
          where: { id: reservation.id },
          data: {
            status: InventoryReservationStatus.RELEASED,
            releasedAt: new Date(),
          },
        });
        await tx.inventoryMovement.create({
          data: {
            groupId,
            batchId: reservation.batchId,
            assetId: reservation.assetId,
            type: InventoryMovementType.RESERVATION_RELEASE,
            quantity: reservation.quantity,
            actorId: userId,
            details: { reservationId },
          },
        });
        return released;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async checkout(groupId: string, userId: string, dto: CheckoutInventoryDto) {
    this.assertSingleTarget(dto.batchId, dto.assetId);
    const quantity = dto.quantity ?? 1;
    await this.assertMember(groupId, dto.holderId);

    return this.prisma.$transaction(
      async (tx) => {
        let reservation:
          | {
              id: string;
              batchId: string | null;
              assetId: string | null;
              quantity: number;
              status: InventoryReservationStatus;
            }
          | null = null;
        if (dto.reservationId) {
          reservation = await tx.inventoryReservation.findUnique({
            where: { id: dto.reservationId },
          });
          if (
            !reservation ||
            reservation.status !== InventoryReservationStatus.ACTIVE ||
            reservation.batchId !== (dto.batchId ?? null) ||
            reservation.assetId !== (dto.assetId ?? null) ||
            reservation.quantity < quantity
          ) {
            throw new ConflictException({
              code: AppErrorCode.VALIDATION_ERROR,
              message: 'Reservation does not cover this checkout',
            });
          }
        } else if (dto.batchId) {
          const updated = await tx.inventoryBatch.updateMany({
            where: {
              id: dto.batchId,
              inventoryItem: { groupId },
              condition: { in: USABLE },
              availableQuantity: { gte: quantity },
            },
            data: { availableQuantity: { decrement: quantity } },
          });
          if (updated.count !== 1) this.stockUnavailable();
        } else {
          const updated = await tx.inventoryAsset.updateMany({
            where: {
              id: dto.assetId,
              inventoryItem: { groupId },
              holderId: null,
              condition: { in: USABLE },
              reservations: {
                none: { status: InventoryReservationStatus.ACTIVE },
              },
            },
            data: { holderId: dto.holderId, locationId: null },
          });
          if (updated.count !== 1) this.stockUnavailable();
        }

        if (reservation) {
          await tx.inventoryReservation.update({
            where: { id: reservation.id },
            data: { status: InventoryReservationStatus.FULFILLED },
          });
          if (dto.assetId) {
            await tx.inventoryAsset.update({
              where: { id: dto.assetId },
              data: { holderId: dto.holderId, locationId: null },
            });
          }
        }

        const custody = await tx.inventoryCustody.create({
          data: {
            batchId: dto.batchId,
            assetId: dto.assetId,
            holderId: dto.holderId,
            activityId: dto.activityId,
            quantity,
            purpose: dto.purpose,
            dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
          },
        });
        await tx.inventoryMovement.create({
          data: {
            groupId,
            batchId: dto.batchId,
            assetId: dto.assetId,
            type: InventoryMovementType.CHECKOUT,
            quantity,
            toHolderId: dto.holderId,
            activityId: dto.activityId,
            actorId: userId,
            details: { custodyId: custody.id, purpose: dto.purpose ?? null },
          },
        });
        return custody;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async returnCustody(
    groupId: string,
    custodyId: string,
    userId: string,
    dto: ReturnInventoryDto,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const custody = await tx.inventoryCustody.findUnique({
          where: { id: custodyId },
          include: {
            batch: { include: { inventoryItem: true } },
            asset: { include: { inventoryItem: true } },
          },
        });
        const custodyGroup =
          custody?.batch?.inventoryItem.groupId ?? custody?.asset?.inventoryItem.groupId;
        if (!custody || custodyGroup !== groupId || custody.returnedAt) {
          throw new NotFoundException({
            code: AppErrorCode.NOT_FOUND,
            message: 'Active inventory custody not found',
          });
        }
        await this.assertCustodyActor(tx, groupId, userId, custody.holderId);
        const quantity = dto.quantity ?? custody.quantity;
        if (quantity > custody.quantity || (!custody.batchId && quantity !== 1)) {
          throw new BadRequestException({
            code: AppErrorCode.INVALID_QUANTITY,
            message: 'Return quantity exceeds checked-out quantity',
          });
        }
        const condition = dto.condition ?? InventoryCondition.GOOD;
        const usable = USABLE.includes(condition);

        if (custody.batchId) {
          await tx.inventoryBatch.update({
            where: { id: custody.batchId },
            data: {
              condition,
              locationId: dto.locationId,
              ...(usable && { availableQuantity: { increment: quantity } }),
            },
          });
        } else if (custody.assetId) {
          await tx.inventoryAsset.update({
            where: { id: custody.assetId },
            data: { condition, locationId: dto.locationId, holderId: null },
          });
        }
        const remaining = custody.quantity - quantity;
        const updatedCustody = await tx.inventoryCustody.update({
          where: { id: custody.id },
          data:
            remaining === 0
              ? { returnedAt: new Date() }
              : { quantity: remaining },
        });
        if (dto.condition || dto.note || dto.photoUrl) {
          await tx.inventoryDamageReport.create({
            data: {
              batchId: custody.batchId,
              assetId: custody.assetId,
              condition,
              note: dto.note,
              photoUrl: dto.photoUrl,
              reporterId: userId,
            },
          });
        }
        await tx.inventoryMovement.create({
          data: {
            groupId,
            batchId: custody.batchId,
            assetId: custody.assetId,
            type: InventoryMovementType.RETURN,
            quantity,
            fromHolderId: custody.holderId,
            toLocationId: dto.locationId,
            activityId: custody.activityId,
            actorId: userId,
            details: {
              custodyId,
              condition,
              missingQuantity: remaining,
              note: dto.note ?? null,
            },
          },
        });
        return updatedCustody;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async transferCustody(
    groupId: string,
    custodyId: string,
    userId: string,
    dto: TransferCustodyDto,
  ) {
    await this.assertMember(groupId, dto.holderId);
    return this.prisma.$transaction(async (tx) => {
      const custody = await tx.inventoryCustody.findUnique({
        where: { id: custodyId },
        include: {
          batch: { include: { inventoryItem: true } },
          asset: { include: { inventoryItem: true } },
        },
      });
      const custodyGroup =
        custody?.batch?.inventoryItem.groupId ?? custody?.asset?.inventoryItem.groupId;
      if (!custody || custodyGroup !== groupId || custody.returnedAt) {
        throw new NotFoundException({
          code: AppErrorCode.NOT_FOUND,
          message: 'Active inventory custody not found',
        });
      }
      await this.assertCustodyActor(tx, groupId, userId, custody.holderId);
      const updated = await tx.inventoryCustody.update({
        where: { id: custody.id },
        data: { holderId: dto.holderId },
      });
      if (custody.assetId) {
        await tx.inventoryAsset.update({
          where: { id: custody.assetId },
          data: { holderId: dto.holderId },
        });
      }
      await tx.inventoryMovement.create({
        data: {
          groupId,
          batchId: custody.batchId,
          assetId: custody.assetId,
          type: InventoryMovementType.TRANSFER,
          quantity: custody.quantity,
          fromHolderId: custody.holderId,
          toHolderId: dto.holderId,
          activityId: custody.activityId,
          actorId: userId,
          details: { custodyId },
        },
      });
      return updated;
    });
  }

  private assertSingleTarget(batchId?: string, assetId?: string) {
    if (Boolean(batchId) === Boolean(assetId)) {
      throw new BadRequestException({
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'Exactly one batchId or assetId is required',
      });
    }
  }

  private stockUnavailable(): never {
    throw new ConflictException({
      code: AppErrorCode.CONCURRENT_MODIFICATION,
      message: 'Inventory is unavailable or already reserved',
    });
  }

  private async assertMember(groupId: string, userId: string) {
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

  private async assertSharedItem(groupId: string, sharedItemId: string) {
    const item = await this.prisma.sharedItem.findUnique({
      where: { id: sharedItemId },
      select: { groupActivity: { select: { groupId: true } } },
    });
    if (!item || item.groupActivity.groupId !== groupId) {
      throw new NotFoundException({
        code: AppErrorCode.SHARED_ITEM_NOT_FOUND,
        message: 'Shared item not found',
      });
    }
  }

  private async assertCustodyActor(
    tx: Prisma.TransactionClient,
    groupId: string,
    actorId: string,
    holderId: string,
  ) {
    if (actorId === holderId) return;
    const membership = await tx.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: actorId } },
      select: { role: true },
    });
    if (!membership || membership.role === 'MEMBER') {
      throw new ForbiddenException({
        code: AppErrorCode.INSUFFICIENT_ROLE,
        message: 'Only the current holder or an organizer can change custody',
      });
    }
  }
}
