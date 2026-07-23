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
    return this.prisma.eventActivityLog.findMany({
      where: {
        activityId,
        ...(query.memberId && { actorId: query.memberId }),
        ...(query.itemId && { itemId: query.itemId }),
      },
      include: {
        actor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
