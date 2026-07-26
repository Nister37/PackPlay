import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppErrorCode } from '@packplay/common';
import { PrismaService } from '../common/prisma.service';
import { EventLogQueryDto } from './dto';

export interface RecordEventAction {
  activityId: string;
  actorId?: string | null;
  action: string;
  itemId?: string | null;
  quantity?: number | null;
  details?: Prisma.InputJsonValue;
}

@Injectable()
export class EventActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  record(entry: RecordEventAction) {
    return this.prisma.eventActivityLog.create({
      data: {
        activityId: entry.activityId,
        actorId: entry.actorId,
        action: entry.action,
        itemId: entry.itemId,
        quantity: entry.quantity,
        details: entry.details,
      },
    });
  }

  async list(groupId: string, activityId: string, query: EventLogQueryDto) {
    const activity = await this.prisma.groupActivity.findUnique({
      where: { id: activityId },
      select: { groupId: true },
    });
    if (!activity || activity.groupId !== groupId) {
      throw new NotFoundException({
        code: AppErrorCode.ACTIVITY_NOT_FOUND,
        message: 'Activity not found',
      });
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where = {
      activityId,
      ...(query.memberId && { actorId: query.memberId }),
      ...(query.itemId && { itemId: query.itemId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.eventActivityLog.findMany({
        where,
        include: {
          actor: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.eventActivityLog.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
