import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  GroupActivityStatus,
  Prisma,
  RecurrenceFrequency,
} from '@prisma/client';
import { AppErrorCode } from '@packplay/common';
import { PrismaService } from '../common/prisma.service';
import { CreateRecurrenceDto, UpdateFutureEventsDto } from './dto';

@Injectable()
export class EventRecurrenceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    groupId: string,
    activityId: string,
    userId: string,
    dto: CreateRecurrenceDto,
  ) {
    const source = await this.prisma.groupActivity.findUnique({
      where: { id: activityId },
      include: { sharedItems: true, roles: true },
    });
    if (!source || source.groupId !== groupId) {
      throw new NotFoundException({
        code: AppErrorCode.ACTIVITY_NOT_FOUND,
        message: 'Activity not found',
      });
    }
    if (!source.date) {
      throw new BadRequestException({
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'A recurring event requires a start time',
      });
    }
    if (source.recurrenceSeriesId) {
      throw new BadRequestException({
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'Event already belongs to a recurrence series',
      });
    }

    const dates = this.generateDates(source.date, dto);
    const duration = source.endAt
      ? source.endAt.getTime() - source.date.getTime()
      : null;
    const deadlineOffset = source.responsibilityDeadline
      ? source.date.getTime() - source.responsibilityDeadline.getTime()
      : null;

    return this.prisma.$transaction(async (tx) => {
      const series = await tx.eventRecurrenceSeries.create({
        data: {
          groupId,
          frequency: dto.frequency,
          interval: dto.interval ?? 1,
          daysOfWeek: dto.daysOfWeek ?? Prisma.JsonNull,
          customRule:
            dto.frequency === RecurrenceFrequency.CUSTOM
              ? { occurrenceDates: dto.occurrenceDates ?? [] }
              : Prisma.JsonNull,
          timezone: dto.timezone,
          until: dto.until ? new Date(dto.until) : null,
          count: dto.count,
          createdById: userId,
        },
      });
      await tx.groupActivity.update({
        where: { id: source.id },
        data: { recurrenceSeriesId: series.id, occurrenceIndex: 0 },
      });

      for (const [offset, date] of dates.entries()) {
        await tx.groupActivity.create({
          data: {
            groupId,
            name: source.name,
            description: source.description,
            sportProfileId: source.sportProfileId,
            activityType: source.activityType,
            status: source.status,
            date,
            endAt: duration === null ? null : new Date(date.getTime() + duration),
            venueName: source.venueName,
            latitude: source.latitude,
            longitude: source.longitude,
            environment: source.environment,
            surface: source.surface,
            responsibilityDeadline:
              deadlineOffset === null
                ? null
                : new Date(date.getTime() - deadlineOffset),
            recurrenceSeriesId: series.id,
            occurrenceIndex: offset + 1,
            createdById: userId,
            sharedItems: {
              create: source.sharedItems.map((item) => ({
                name: item.name,
                requiredQuantity: item.requiredQuantity,
                category: item.category,
                isMandatory: item.isMandatory,
                notes: item.notes,
                createdById: userId,
              })),
            },
            roles: {
              create: source.roles.map((role) => ({
                name: role.name,
                requirements:
                  role.requirements === null
                    ? Prisma.JsonNull
                    : (role.requirements as Prisma.InputJsonValue),
              })),
            },
          },
        });
      }
      return tx.eventRecurrenceSeries.findUnique({
        where: { id: series.id },
        include: { activities: { orderBy: { occurrenceIndex: 'asc' } } },
      });
    });
  }

  async updateFuture(
    groupId: string,
    seriesId: string,
    fromActivityId: string,
    dto: UpdateFutureEventsDto,
  ) {
    const from = await this.prisma.groupActivity.findUnique({
      where: { id: fromActivityId },
    });
    if (
      !from ||
      from.groupId !== groupId ||
      from.recurrenceSeriesId !== seriesId ||
      from.occurrenceIndex === null
    ) {
      throw new NotFoundException({
        code: AppErrorCode.ACTIVITY_NOT_FOUND,
        message: 'Recurring event occurrence not found',
      });
    }
    return this.prisma.groupActivity.updateMany({
      where: {
        groupId,
        recurrenceSeriesId: seriesId,
        occurrenceIndex: { gte: from.occurrenceIndex },
      },
      data: dto,
    });
  }

  async cancelOccurrence(groupId: string, activityId: string) {
    const event = await this.prisma.groupActivity.findUnique({ where: { id: activityId } });
    if (!event || event.groupId !== groupId || !event.recurrenceSeriesId) {
      throw new NotFoundException({
        code: AppErrorCode.ACTIVITY_NOT_FOUND,
        message: 'Recurring event occurrence not found',
      });
    }
    return this.prisma.groupActivity.update({
      where: { id: activityId },
      data: { status: GroupActivityStatus.CANCELLED },
    });
  }

  private generateDates(start: Date, dto: CreateRecurrenceDto): Date[] {
    const limit = dto.count ?? 366;
    const until = dto.until ? new Date(dto.until) : null;
    let dates: Date[] = [];

    if (dto.frequency === RecurrenceFrequency.CUSTOM) {
      dates = (dto.occurrenceDates ?? [])
        .map((value) => new Date(value))
        .filter((value) => value > start)
        .sort((a, b) => a.getTime() - b.getTime());
      if (dates.length === 0) {
        throw new BadRequestException({
          code: AppErrorCode.VALIDATION_ERROR,
          message: 'Custom recurrence requires future occurrence dates',
        });
      }
    } else if (dto.frequency === RecurrenceFrequency.DAILY) {
      const interval = dto.interval ?? 1;
      for (let index = 1; index < limit; index += 1) {
        const next = new Date(start);
        next.setUTCDate(next.getUTCDate() + interval * index);
        if (until && next > until) break;
        dates.push(next);
      }
    } else {
      const weekdays = new Set(dto.daysOfWeek?.length ? dto.daysOfWeek : [start.getUTCDay()]);
      const interval = dto.interval ?? 1;
      let cursor = new Date(start);
      while (dates.length < limit - 1) {
        cursor = new Date(cursor);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        if (until && cursor > until) break;
        const dayOffset = Math.floor(
          (Date.UTC(
            cursor.getUTCFullYear(),
            cursor.getUTCMonth(),
            cursor.getUTCDate(),
          ) -
            Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())) /
            86_400_000,
        );
        const weekOffset = Math.floor(dayOffset / 7);
        if (weekOffset % interval === 0 && weekdays.has(cursor.getUTCDay())) {
          dates.push(cursor);
        }
        if (!until && dayOffset > 3660) break;
      }
    }

    const capped = dates.filter((date) => !until || date <= until).slice(0, limit - 1);
    if (capped.length === 0) {
      throw new BadRequestException({
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'Recurrence must create at least one future occurrence',
      });
    }
    return capped;
  }
}
