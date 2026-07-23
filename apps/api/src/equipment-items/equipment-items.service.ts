import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AppErrorCode } from '@packplay/common';
import { ChecklistsService } from '../checklists/checklists.service';
import { CreateEquipmentItemDto, UpdateEquipmentItemDto, ReorderItemsDto } from './dto';

@Injectable()
export class EquipmentItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checklistsService: ChecklistsService,
  ) {}

  async addItem(checklistId: string, userId: string, dto: CreateEquipmentItemDto) {
    // Verify ownership
    await this.checklistsService.getById(checklistId, userId);

    // Get the next sort order
    const lastItem = await this.prisma.equipmentItem.findFirst({
      where: { checklistId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const nextSortOrder = lastItem ? lastItem.sortOrder + 1 : 0;

    return this.prisma.equipmentItem.create({
      data: {
        checklistId,
        name: dto.name,
        quantity: dto.quantity ?? 1,
        category: dto.category,
        isMandatory: dto.isMandatory ?? false,
        notes: dto.notes,
        sortOrder: dto.sortOrder ?? nextSortOrder,
        catalogueItemId: dto.catalogueItemId,
      },
    });
  }

  async updateItem(
    checklistId: string,
    itemId: string,
    userId: string,
    dto: UpdateEquipmentItemDto,
  ) {
    await this.checklistsService.getById(checklistId, userId);

    const item = await this.prisma.equipmentItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.checklistId !== checklistId) {
      throw new NotFoundException({
        code: AppErrorCode.EQUIPMENT_ITEM_NOT_FOUND,
        message: 'Equipment item not found',
      });
    }

    return this.prisma.equipmentItem.update({
      where: { id: itemId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.isMandatory !== undefined && { isMandatory: dto.isMandatory }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async deleteItem(checklistId: string, itemId: string, userId: string) {
    await this.checklistsService.getById(checklistId, userId);

    const item = await this.prisma.equipmentItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.checklistId !== checklistId) {
      throw new NotFoundException({
        code: AppErrorCode.EQUIPMENT_ITEM_NOT_FOUND,
        message: 'Equipment item not found',
      });
    }

    await this.prisma.equipmentItem.delete({ where: { id: itemId } });
  }

  async reorderItems(checklistId: string, userId: string, dto: ReorderItemsDto) {
    await this.checklistsService.getById(checklistId, userId);

    const updates = dto.items.map((entry) =>
      this.prisma.equipmentItem.updateMany({
        where: { id: entry.id, checklistId },
        data: { sortOrder: entry.sortOrder },
      }),
    );

    await this.prisma.$transaction(updates);

    return this.prisma.equipmentItem.findMany({
      where: { checklistId },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
