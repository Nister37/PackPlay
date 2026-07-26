import { Injectable, NotFoundException } from '@nestjs/common';
import { InventoryCondition, InventoryTrackingType, Prisma } from '@prisma/client';
import { AppErrorCode } from '@packplay/common';
import { PrismaService } from '../common/prisma.service';
import {
  CreateInventoryAssetDto,
  CreateInventoryBatchDto,
  CreateInventoryItemDto,
  CreateStorageLocationDto,
  InventoryQueryDto,
  UpdateInventoryItemDto,
} from './dto';

const UNAVAILABLE_CONDITIONS: InventoryCondition[] = [
  InventoryCondition.DAMAGED,
  InventoryCondition.INCOMPLETE,
  InventoryCondition.RETIRED,
];

@Injectable()
export class InventoryCatalogueService {
  constructor(private readonly prisma: PrismaService) {}

  createItem(groupId: string, dto: CreateInventoryItemDto) {
    return this.prisma.inventoryItem.create({
      data: { groupId, ...dto },
    });
  }

  async updateItem(groupId: string, itemId: string, dto: UpdateInventoryItemDto) {
    await this.getItem(groupId, itemId);
    return this.prisma.inventoryItem.update({
      where: { id: itemId },
      data: dto,
    });
  }

  async archiveItem(groupId: string, itemId: string) {
    await this.getItem(groupId, itemId);
    return this.prisma.inventoryItem.update({
      where: { id: itemId },
      data: { archivedAt: new Date() },
    });
  }

  async list(groupId: string, query: InventoryQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const stockFilter: Prisma.InventoryBatchWhereInput = {
      ...(query.locationId && { locationId: query.locationId }),
      ...(query.holderId && { holderId: query.holderId }),
    };
    const assetFilter: Prisma.InventoryAssetWhereInput = {
      ...(query.locationId && { locationId: query.locationId }),
      ...(query.holderId && { holderId: query.holderId }),
    };
    const where: Prisma.InventoryItemWhereInput = {
      groupId,
      archivedAt: null,
      ...(query.category && { category: query.category }),
      ...(query.search && { name: { contains: query.search } }),
      ...((query.locationId || query.holderId) && {
        OR: [
          { batches: { some: stockFilter } },
          { assets: { some: assetFilter } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        include: {
          batches: {
            where: stockFilter,
            include: { location: true, holder: { select: { id: true, name: true } } },
          },
          assets: {
            where: assetFilter,
            include: { location: true, holder: { select: { id: true, name: true } } },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getItem(groupId: string, itemId: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: {
        batches: { include: { location: true, holder: true } },
        assets: { include: { location: true, holder: true } },
      },
    });
    if (!item || item.groupId !== groupId) {
      throw new NotFoundException({
        code: AppErrorCode.NOT_FOUND,
        message: 'Inventory item not found',
      });
    }
    return {
      ...item,
      availableQuantity:
        item.trackingType === InventoryTrackingType.BATCH
          ? item.batches
              .filter((batch) => !UNAVAILABLE_CONDITIONS.includes(batch.condition))
              .reduce((sum, batch) => sum + batch.availableQuantity, 0)
          : item.assets.filter(
              (asset) =>
                !UNAVAILABLE_CONDITIONS.includes(asset.condition) && !asset.holderId,
            ).length,
    };
  }

  createLocation(groupId: string, dto: CreateStorageLocationDto) {
    return this.prisma.inventoryStorageLocation.create({
      data: { groupId, ...dto },
    });
  }

  listLocations(groupId: string) {
    return this.prisma.inventoryStorageLocation.findMany({
      where: { groupId },
      orderBy: { name: 'asc' },
    });
  }

  async createBatch(
    groupId: string,
    itemId: string,
    dto: CreateInventoryBatchDto,
  ) {
    const item = await this.getItem(groupId, itemId);
    if (item.trackingType !== InventoryTrackingType.BATCH) {
      throw new NotFoundException({
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'This inventory item uses individual asset tracking',
      });
    }
    await this.assertLocation(groupId, dto.locationId);
    return this.prisma.inventoryBatch.create({
      data: {
        inventoryItemId: itemId,
        quantity: dto.quantity,
        availableQuantity: UNAVAILABLE_CONDITIONS.includes(
          dto.condition ?? InventoryCondition.GOOD,
        )
          ? 0
          : dto.quantity,
        condition: dto.condition,
        locationId: dto.locationId,
      },
    });
  }

  async createAsset(
    groupId: string,
    itemId: string,
    dto: CreateInventoryAssetDto,
  ) {
    const item = await this.getItem(groupId, itemId);
    if (item.trackingType !== InventoryTrackingType.ASSET) {
      throw new NotFoundException({
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'This inventory item uses quantity batch tracking',
      });
    }
    await this.assertLocation(groupId, dto.locationId);
    return this.prisma.inventoryAsset.create({
      data: { inventoryItemId: itemId, ...dto },
    });
  }

  private async assertLocation(groupId: string, locationId?: string) {
    if (!locationId) return;
    const location = await this.prisma.inventoryStorageLocation.findUnique({
      where: { id: locationId },
    });
    if (!location || location.groupId !== groupId) {
      throw new NotFoundException({
        code: AppErrorCode.NOT_FOUND,
        message: 'Inventory location not found',
      });
    }
  }
}
