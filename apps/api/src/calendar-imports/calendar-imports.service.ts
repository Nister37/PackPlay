import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ActivityType, CalendarProvider, GroupActivityStatus } from '@prisma/client';
import { AppErrorCode } from '@packplay/common';
import { PrismaService } from '../common/prisma.service';
import { CalendarParserService, ParsedCalendarEvent } from './calendar-parser.service';
import { CalendarSecurityService } from './calendar-security.service';
import { ConnectCalendarFeedDto } from './dto';

@Injectable()
export class CalendarImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: CalendarParserService,
    private readonly security: CalendarSecurityService,
  ) {}

  async previewUrl(url: string) {
    return this.preview(await this.security.fetchCalendar(url));
  }

  preview(content: string) {
    const events = this.parser.parse(content);
    return {
      count: events.length,
      events: events.slice(0, 100),
      truncated: events.length > 100,
    };
  }

  async connect(groupId: string, userId: string, dto: ConnectCalendarFeedDto) {
    const hash = this.security.urlHash(dto.url);
    const existing = await this.prisma.calendarFeed.findUnique({
      where: { urlHash: hash },
    });
    if (existing) {
      throw new ConflictException({
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'This calendar feed is already connected',
      });
    }
    const feed = await this.prisma.calendarFeed.create({
      data: {
        groupId,
        createdById: userId,
        name: dto.name,
        provider: dto.provider ?? CalendarProvider.GENERIC,
        encryptedUrl: this.security.encryptUrl(dto.url),
        urlHash: hash,
      },
      select: this.feedSelect(),
    });
    await this.syncFeed(groupId, feed.id);
    return this.getFeed(groupId, feed.id);
  }

  listFeeds(groupId: string) {
    return this.prisma.calendarFeed.findMany({
      where: { groupId },
      select: this.feedSelect(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async disconnect(groupId: string, feedId: string) {
    await this.requireFeed(groupId, feedId);
    return this.prisma.calendarFeed.update({
      where: { id: feedId },
      data: { active: false },
      select: this.feedSelect(),
    });
  }

  async syncFeed(groupId: string, feedId: string) {
    const feed = await this.requireFeed(groupId, feedId);
    try {
      const content = await this.security.fetchCalendar(
        this.security.decryptUrl(feed.encryptedUrl),
      );
      const events = this.parser.parse(content);
      const result = await this.persist(feed.id, feed.groupId, feed.createdById, events);
      await this.prisma.calendarFeed.update({
        where: { id: feed.id },
        data: {
          lastSyncedAt: new Date(),
          lastSuccessfulAt: new Date(),
          lastError: null,
        },
      });
      return result;
    } catch (error) {
      await this.prisma.calendarFeed.update({
        where: { id: feed.id },
        data: {
          lastSyncedAt: new Date(),
          lastError: this.errorMessage(error).slice(0, 1000),
        },
      });
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async syncActiveFeeds() {
    const feeds = await this.prisma.calendarFeed.findMany({
      where: { active: true },
      select: { id: true, groupId: true },
    });
    for (const feed of feeds) {
      await this.syncFeed(feed.groupId, feed.id).catch(() => undefined);
    }
  }

  private async persist(
    feedId: string,
    groupId: string,
    createdById: string,
    events: ParsedCalendarEvent[],
  ) {
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    const seenAt = new Date();
    await this.prisma.$transaction(async (transaction) => {
      for (const event of events) {
        const key = {
          feedId_externalUid_recurrenceId: {
            feedId,
            externalUid: event.uid,
            recurrenceId: event.recurrenceId,
          },
        };
        const imported = await transaction.calendarImportedEvent.findUnique({
          where: key,
        });
        if (!imported) {
          const activity = await transaction.groupActivity.create({
            data: this.activityData(groupId, createdById, event),
          });
          await transaction.calendarImportedEvent.create({
            data: {
              feedId,
              activityId: activity.id,
              externalUid: event.uid,
              recurrenceId: event.recurrenceId,
              sequence: event.sequence,
              sourceHash: event.sourceHash,
              lastSeenAt: seenAt,
            },
          });
          created += 1;
        } else if (
          event.sequence >= imported.sequence &&
          event.sourceHash !== imported.sourceHash
        ) {
          await transaction.groupActivity.update({
            where: { id: imported.activityId },
            data: this.activityData(groupId, createdById, event),
          });
          await transaction.calendarImportedEvent.update({
            where: { id: imported.id },
            data: {
              sequence: event.sequence,
              sourceHash: event.sourceHash,
              lastSeenAt: seenAt,
            },
          });
          updated += 1;
        } else {
          await transaction.calendarImportedEvent.update({
            where: { id: imported.id },
            data: { lastSeenAt: seenAt },
          });
          unchanged += 1;
        }
      }
    });
    return { created, updated, unchanged, total: events.length };
  }

  private activityData(groupId: string, createdById: string, event: ParsedCalendarEvent) {
    return {
      groupId,
      createdById,
      name: event.title,
      description: event.description,
      venueName: event.location,
      date: event.startsAt,
      endAt: event.endsAt,
      activityType: this.activityType(event.title),
      status: event.cancelled ? GroupActivityStatus.CANCELLED : GroupActivityStatus.PUBLISHED,
    };
  }

  private activityType(title: string) {
    const value = title.toLowerCase();
    if (/(game|match|competition|tournament|fixture)/.test(value)) {
      return ActivityType.COMPETITION;
    }
    if (/(travel|flight|bus|departure)/.test(value)) return ActivityType.TRAVEL;
    if (/(training|practice|session)/.test(value)) return ActivityType.TRAINING;
    return ActivityType.CASUAL;
  }

  private async requireFeed(groupId: string, feedId: string) {
    const feed = await this.prisma.calendarFeed.findFirst({
      where: { id: feedId, groupId },
    });
    if (!feed) {
      throw new NotFoundException({
        code: AppErrorCode.NOT_FOUND,
        message: 'Calendar feed not found',
      });
    }
    return feed;
  }

  private async getFeed(groupId: string, feedId: string) {
    return this.prisma.calendarFeed.findFirstOrThrow({
      where: { id: feedId, groupId },
      select: this.feedSelect(),
    });
  }

  private feedSelect() {
    return {
      id: true,
      groupId: true,
      provider: true,
      name: true,
      active: true,
      lastSyncedAt: true,
      lastSuccessfulAt: true,
      lastError: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { importedEvents: true } },
    } as const;
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Calendar synchronization failed';
  }
}
