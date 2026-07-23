import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityType } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { AppErrorCode } from '@packplay/common';
import { SportProfilesService } from '../sport-profiles/sport-profiles.service';
import { CreateChecklistDto, UpdateChecklistDto } from './dto';

@Injectable()
export class ChecklistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sportProfilesService: SportProfilesService,
  ) {}

  async create(userId: string, dto: CreateChecklistDto) {
    // Verify the user owns the sport profile
    await this.sportProfilesService.getById(dto.sportProfileId, userId);

    return this.prisma.checklist.create({
      data: {
        userId,
        sportProfileId: dto.sportProfileId,
        name: dto.name,
        activityType: dto.activityType as ActivityType | undefined,
      },
    });
  }

  async listByUser(
    userId: string,
    filters?: { sportProfileId?: string; activityType?: string },
  ) {
    return this.prisma.checklist.findMany({
      where: {
        userId,
        ...(filters?.sportProfileId && { sportProfileId: filters.sportProfileId }),
        ...(filters?.activityType && { activityType: filters.activityType as ActivityType }),
      },
      include: {
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(checklistId: string, userId: string) {
    const checklist = await this.prisma.checklist.findUnique({
      where: { id: checklistId },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!checklist) {
      throw new NotFoundException({
        code: AppErrorCode.CHECKLIST_NOT_FOUND,
        message: 'Checklist not found',
      });
    }

    if (checklist.userId !== userId) {
      throw new ForbiddenException({
        code: AppErrorCode.NOT_CHECKLIST_OWNER,
        message: 'You do not own this checklist',
      });
    }

    return checklist;
  }

  async update(checklistId: string, userId: string, dto: UpdateChecklistDto) {
    const checklist = await this.getById(checklistId, userId);

    return this.prisma.checklist.update({
      where: { id: checklist.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.activityType !== undefined && { activityType: dto.activityType as ActivityType }),
      },
    });
  }

  async delete(checklistId: string, userId: string) {
    await this.getById(checklistId, userId);
    await this.prisma.checklist.delete({ where: { id: checklistId } });
  }

  async duplicate(checklistId: string, userId: string) {
    const original = await this.getById(checklistId, userId);

    const duplicated = await this.prisma.checklist.create({
      data: {
        userId,
        sportProfileId: original.sportProfileId,
        name: `${original.name} (copy)`,
        activityType: original.activityType,
        isTemplate: false,
        items: {
          create: original.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            category: item.category,
            isMandatory: item.isMandatory,
            notes: item.notes,
            sortOrder: item.sortOrder,
            catalogueItemId: item.catalogueItemId,
          })),
        },
      },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });

    return duplicated;
  }

  async saveAsTemplate(checklistId: string, userId: string) {
    await this.getById(checklistId, userId);

    return this.prisma.checklist.update({
      where: { id: checklistId },
      data: { isTemplate: true },
    });
  }
}
