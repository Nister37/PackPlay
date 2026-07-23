import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  EventEnvironment,
  Prisma,
  WeatherSuggestionStatus,
  WeatherSuggestionTarget,
} from '@prisma/client';
import { createHash } from 'crypto';
import { AppErrorCode } from '@packplay/common';
import { PrismaService } from '../common/prisma.service';
import { ReviewWeatherSuggestionDto, UpdateWeatherRuleDto } from './dto';
import { OpenMeteoClient } from './open-meteo.client';
import { WeatherRulesService } from './weather-rules.service';

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: OpenMeteoClient,
    private readonly rules: WeatherRulesService,
  ) {}

  async refresh(groupId: string, activityId: string) {
    const activity = await this.prisma.groupActivity.findUnique({
      where: { id: activityId },
      include: {
        group: true,
        sharedItems: { select: { name: true } },
        weatherSnapshots: { orderBy: { fetchedAt: 'desc' }, take: 1 },
      },
    });
    if (!activity || activity.groupId !== groupId) this.activityNotFound();
    if (
      activity!.environment !== EventEnvironment.OUTDOOR &&
      activity!.environment !== EventEnvironment.COVERED_OUTDOOR
    ) {
      throw new BadRequestException({
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'Weather forecasts are only relevant to outdoor events',
      });
    }
    if (!activity!.date || activity!.latitude === null || activity!.longitude === null) {
      throw new BadRequestException({
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'Outdoor events require a start time and coordinates',
      });
    }

    const forecast = await this.client.forecastAt(
      Number(activity!.latitude),
      Number(activity!.longitude),
      activity!.date,
    );
    const evaluated = this.rules.evaluate(forecast, {
      sport: activity!.group.sportType,
      surface: activity!.surface,
    });
    const preferences = await this.prisma.teamWeatherRulePreference.findMany({
      where: { groupId, enabled: false },
      select: { ruleKey: true },
    });
    const disabled = new Set(preferences.map((item) => item.ruleKey));
    const activeRules = evaluated.filter(
      (rule) =>
        !disabled.has(rule.ruleKey) &&
        !disabled.has(rule.ruleKey.split('-')[0]),
    );
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          time: forecast.forecastTime.toISOString(),
          temperature: this.round(forecast.temperature),
          apparent: this.round(forecast.apparentTemperature),
          precipitation: this.round(forecast.precipitation),
          wind: this.round(forecast.windSpeed),
          uv: this.round(forecast.uvIndex),
        }),
      )
      .digest('hex');
    const snapshot = await this.prisma.weatherSnapshot.upsert({
      where: {
        activityId_fingerprint: { activityId, fingerprint },
      },
      create: {
        activityId,
        forecastTime: forecast.forecastTime,
        temperature: forecast.temperature,
        apparentTemperature: forecast.apparentTemperature,
        precipitation: forecast.precipitation,
        windSpeed: forecast.windSpeed,
        uvIndex: forecast.uvIndex,
        fingerprint,
        raw: {
          ...forecast.raw,
          activeRuleKeys: activeRules.map((rule) => rule.ruleKey),
        },
      },
      update: {},
    });

    const existing = await this.prisma.weatherSuggestion.findMany({
      where: { activityId },
      orderBy: { createdAt: 'desc' },
    });
    const previousRuleKeys = this.snapshotRuleKeys(activity!.weatherSnapshots[0]?.raw);
    const sharedNames = new Set(
      activity!.sharedItems.map((item) => this.normalize(item.name)),
    );
    const created = [];
    for (const rule of activeRules) {
      if (
        rule.target === WeatherSuggestionTarget.SHARED &&
        sharedNames.has(this.normalize(rule.itemName))
      ) {
        continue;
      }
      const latestForRule = existing.find((item) => item.ruleKey === rule.ruleKey);
      if (
        latestForRule?.status === WeatherSuggestionStatus.PENDING ||
        latestForRule?.status === WeatherSuggestionStatus.ACCEPTED ||
        (latestForRule?.status === WeatherSuggestionStatus.DISMISSED &&
          previousRuleKeys.has(rule.ruleKey))
      ) {
        continue;
      }
      created.push(
        await this.prisma.weatherSuggestion.create({
          data: {
            activityId,
            snapshotId: snapshot.id,
            ruleKey: rule.ruleKey,
            itemName: rule.itemName,
            reason: rule.reason,
            quantity: rule.quantity,
            target: rule.target,
          },
        }),
      );
    }
    return {
      snapshot,
      suggestions: created,
      evaluatedAt: snapshot.fetchedAt,
      source: snapshot.source,
    };
  }

  async get(groupId: string, activityId: string) {
    await this.assertActivity(groupId, activityId);
    const snapshot = await this.prisma.weatherSnapshot.findFirst({
      where: { activityId },
      orderBy: { fetchedAt: 'desc' },
    });
    const suggestions = await this.prisma.weatherSuggestion.findMany({
      where: { activityId },
      orderBy: { createdAt: 'desc' },
    });
    return { snapshot, suggestions, sourceAttribution: 'Open-Meteo' };
  }

  async accept(
    groupId: string,
    activityId: string,
    suggestionId: string,
    userId: string,
    dto: ReviewWeatherSuggestionDto,
  ) {
    const suggestion = await this.getSuggestion(groupId, activityId, suggestionId);
    if (suggestion.status !== WeatherSuggestionStatus.PENDING) {
      throw new ConflictException({
        code: AppErrorCode.CONCURRENT_MODIFICATION,
        message: 'Weather suggestion has already been reviewed',
      });
    }
    const target = dto.target ?? suggestion.target;
    const itemName = dto.itemName ?? suggestion.itemName;
    const quantity = dto.quantity ?? suggestion.quantity;

    return this.prisma.$transaction(async (tx) => {
      let acceptedItemId: string;
      if (target === WeatherSuggestionTarget.SHARED) {
        const duplicate = await tx.sharedItem.findFirst({
          where: { groupActivityId: activityId, name: itemName },
        });
        if (duplicate) {
          throw new ConflictException({
            code: AppErrorCode.VALIDATION_ERROR,
            message: 'The suggested shared item already exists',
          });
        }
        const item = await tx.sharedItem.create({
          data: {
            groupActivityId: activityId,
            name: itemName,
            requiredQuantity: quantity,
            isMandatory: true,
            notes: suggestion.reason,
            createdById: userId,
          },
        });
        acceptedItemId = item.id;
      } else {
        if (!dto.checklistId) {
          throw new BadRequestException({
            code: AppErrorCode.VALIDATION_ERROR,
            message: 'A checklistId is required for a personal suggestion',
          });
        }
        const checklist = await tx.checklist.findFirst({
          where: { id: dto.checklistId, userId },
        });
        if (!checklist) {
          throw new NotFoundException({
            code: AppErrorCode.CHECKLIST_NOT_FOUND,
            message: 'Checklist not found',
          });
        }
        const duplicate = await tx.equipmentItem.findFirst({
          where: { checklistId: dto.checklistId, name: itemName },
          orderBy: { sortOrder: 'desc' },
        });
        if (duplicate) {
          throw new ConflictException({
            code: AppErrorCode.VALIDATION_ERROR,
            message: 'The suggested personal item already exists',
          });
        }
        const last = await tx.equipmentItem.findFirst({
          where: { checklistId: dto.checklistId },
          orderBy: { sortOrder: 'desc' },
        });
        const item = await tx.equipmentItem.create({
          data: {
            checklistId: dto.checklistId,
            name: itemName,
            quantity,
            isMandatory: true,
            notes: suggestion.reason,
            sortOrder: (last?.sortOrder ?? -1) + 1,
          },
        });
        acceptedItemId = item.id;
      }
      const claimed = await tx.weatherSuggestion.updateMany({
        where: { id: suggestionId, status: WeatherSuggestionStatus.PENDING },
        data: {
          status: WeatherSuggestionStatus.ACCEPTED,
          target,
          itemName,
          quantity,
          reviewedById: userId,
          reviewedAt: new Date(),
          acceptedItemId,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException({
          code: AppErrorCode.CONCURRENT_MODIFICATION,
          message: 'Weather suggestion was reviewed concurrently',
        });
      }
      return tx.weatherSuggestion.findUnique({ where: { id: suggestionId } });
    });
  }

  async dismiss(
    groupId: string,
    activityId: string,
    suggestionId: string,
    userId: string,
  ) {
    const suggestion = await this.getSuggestion(groupId, activityId, suggestionId);
    if (suggestion.status !== WeatherSuggestionStatus.PENDING) {
      throw new ConflictException({
        code: AppErrorCode.CONCURRENT_MODIFICATION,
        message: 'Weather suggestion has already been reviewed',
      });
    }
    return this.prisma.weatherSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: WeatherSuggestionStatus.DISMISSED,
        reviewedById: userId,
        reviewedAt: new Date(),
      },
    });
  }

  async updateRule(
    groupId: string,
    ruleKey: string,
    dto: UpdateWeatherRuleDto,
  ) {
    return this.prisma.teamWeatherRulePreference.upsert({
      where: { groupId_ruleKey: { groupId, ruleKey } },
      create: { groupId, ruleKey, enabled: dto.enabled },
      update: { enabled: dto.enabled },
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async refreshUpcomingOutdoorEvents() {
    const now = new Date();
    const horizon = new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000);
    const activities = await this.prisma.groupActivity.findMany({
      where: {
        environment: {
          in: [EventEnvironment.OUTDOOR, EventEnvironment.COVERED_OUTDOOR],
        },
        date: { gte: now, lte: horizon },
        latitude: { not: null },
        longitude: { not: null },
        status: { notIn: ['CANCELLED', 'ARCHIVED'] },
      },
      select: { id: true, groupId: true },
    });
    for (const activity of activities) {
      try {
        await this.refresh(activity.groupId, activity.id);
      } catch (error) {
        this.logger.warn(
          `Weather refresh failed for activity ${activity.id}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }
  }

  private async getSuggestion(groupId: string, activityId: string, suggestionId: string) {
    await this.assertActivity(groupId, activityId);
    const suggestion = await this.prisma.weatherSuggestion.findUnique({
      where: { id: suggestionId },
    });
    if (!suggestion || suggestion.activityId !== activityId) {
      throw new NotFoundException({
        code: AppErrorCode.NOT_FOUND,
        message: 'Weather suggestion not found',
      });
    }
    return suggestion;
  }

  private async assertActivity(groupId: string, activityId: string) {
    const activity = await this.prisma.groupActivity.findUnique({
      where: { id: activityId },
    });
    if (!activity || activity.groupId !== groupId) this.activityNotFound();
    return activity!;
  }

  private activityNotFound(): never {
    throw new NotFoundException({
      code: AppErrorCode.ACTIVITY_NOT_FOUND,
      message: 'Activity not found',
    });
  }

  private snapshotRuleKeys(raw: Prisma.JsonValue | null | undefined) {
    if (!raw || Array.isArray(raw) || typeof raw !== 'object') return new Set<string>();
    const value = (raw as Record<string, Prisma.JsonValue>).activeRuleKeys;
    return new Set(Array.isArray(value) ? value.map(String) : []);
  }

  private normalize(value: string) {
    return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  }

  private round(value: number) {
    return Math.round(value * 10) / 10;
  }
}
