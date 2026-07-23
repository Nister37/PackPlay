import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppErrorCode } from '@packplay/common';
import { PrismaService } from '../common/prisma.service';
import {
  AcceptSmartDraftDto,
  AcceptedSmartDraftItemDto,
  SmartDraftItemTarget,
} from './dto';

@Injectable()
export class SmartDraftsService {
  constructor(private readonly prisma: PrismaService) {}

  async accept(activityId: string, userId: string, dto: AcceptSmartDraftDto) {
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

    const personal = dto.acceptedItems.filter(
      (item) => item.target === SmartDraftItemTarget.PERSONAL,
    );
    if (personal.some((item) => !item.checklistId)) {
      throw new BadRequestException({
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'Personal Smart Add items require a checklistId',
      });
    }
    const checklistIds = [...new Set(personal.map((item) => item.checklistId!))];
    const checklists = checklistIds.length
      ? await this.prisma.checklist.findMany({
          where: { id: { in: checklistIds }, userId },
          include: { items: true },
        })
      : [];
    if (checklists.length !== checklistIds.length) {
      throw new NotFoundException({
        code: AppErrorCode.CHECKLIST_NOT_FOUND,
        message: 'Checklist not found',
      });
    }
    const sharedExisting = await this.prisma.sharedItem.findMany({
      where: { groupActivityId: activityId },
      select: { name: true },
    });

    const duplicates: AcceptedSmartDraftItemDto[] = [];
    const accepted: AcceptedSmartDraftItemDto[] = [];
    const namesByChecklist = new Map(
      checklists.map((checklist) => [
        checklist.id,
        new Set(checklist.items.map((item) => this.normalize(item.name))),
      ]),
    );
    const sharedNames = new Set(
      sharedExisting.map((item) => this.normalize(item.name)),
    );
    for (const item of dto.acceptedItems) {
      const targetNames =
        item.target === SmartDraftItemTarget.SHARED
          ? sharedNames
          : namesByChecklist.get(item.checklistId!);
      const normalized = this.normalize(item.name);
      if (!targetNames || targetNames.has(normalized)) {
        duplicates.push(item);
      } else {
        targetNames.add(normalized);
        accepted.push(item);
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const results: unknown[] = [];
      for (const item of accepted) {
        if (item.target === SmartDraftItemTarget.SHARED) {
          results.push(
            await tx.sharedItem.create({
              data: {
                groupActivityId: activityId,
                name: item.name,
                requiredQuantity: item.quantity ?? 1,
                category: item.category,
                isMandatory: item.isMandatory ?? true,
                notes: item.reason,
                catalogueItemId: item.catalogueItemId,
                createdById: userId,
              },
            }),
          );
          if (item.catalogueItemId) {
            await tx.teamEquipmentUsage.upsert({
              where: {
                groupId_catalogueItemId: {
                  groupId: activity.groupId,
                  catalogueItemId: item.catalogueItemId,
                },
              },
              create: {
                groupId: activity.groupId,
                catalogueItemId: item.catalogueItemId,
                useCount: 1,
              },
              update: {
                useCount: { increment: 1 },
                lastUsedAt: new Date(),
              },
            });
          }
        } else {
          const lastItem = await tx.equipmentItem.findFirst({
            where: { checklistId: item.checklistId! },
            orderBy: { sortOrder: 'desc' },
            select: { sortOrder: true },
          });
          results.push(
            await tx.equipmentItem.create({
              data: {
                checklistId: item.checklistId!,
                name: item.name,
                quantity: item.quantity ?? 1,
                category: item.category,
                isMandatory: item.isMandatory ?? true,
                notes: item.reason,
                catalogueItemId: item.catalogueItemId,
                sortOrder: (lastItem?.sortOrder ?? -1) + 1,
              },
            }),
          );
        }
      }
      return results;
    });

    return {
      created,
      duplicates: duplicates.map((item) => ({
        name: item.name,
        target: item.target,
        checklistId: item.checklistId,
      })),
    };
  }

  private normalize(value: string) {
    return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  }
}
