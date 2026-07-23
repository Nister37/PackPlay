import { Injectable, NotFoundException } from '@nestjs/common';
import { PackingDecisionType, SharedResponsibilityStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { AppErrorCode } from '@packplay/common';

export interface PersonalReadiness {
  sessionId: string;
  totalMandatoryItems: number;
  packedMandatoryItems: number;
  percentage: number;
}

export interface MemberReadiness {
  userId: string;
  userName: string | null;
  percentage: number;
  packedMandatoryItems: number;
  totalMandatoryItems: number;
}

export interface GroupReadiness {
  activityId: string;
  totalSharedItems: number;
  coveredSharedItems: number;
  groupPercentage: number;
  memberReadiness: MemberReadiness[];
}

@Injectable()
export class ReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getPersonalReadiness(userId: string, sessionId: string): Promise<PersonalReadiness> {
    const session = await this.prisma.packingSession.findUnique({
      where: { id: sessionId },
      include: {
        checklist: {
          include: {
            items: { where: { isMandatory: true }, select: { id: true } },
          },
        },
        decisions: {
          where: { equipmentItemId: { not: null } },
          select: { equipmentItemId: true, decision: true },
        },
      },
    });

    if (!session || session.userId !== userId) {
      throw new NotFoundException({
        code: AppErrorCode.SESSION_NOT_FOUND,
        message: 'Packing session not found',
      });
    }

    const totalMandatoryItems = session.checklist.items.length;
    const mandatoryItemIds = new Set(session.checklist.items.map((i) => i.id));

    const packedMandatoryItems = session.decisions.filter(
      (d) =>
        d.equipmentItemId &&
        mandatoryItemIds.has(d.equipmentItemId) &&
        d.decision === PackingDecisionType.PACKED,
    ).length;

    const percentage =
      totalMandatoryItems === 0
        ? 100
        : Math.round((packedMandatoryItems / totalMandatoryItems) * 100);

    return {
      sessionId,
      totalMandatoryItems,
      packedMandatoryItems,
      percentage,
    };
  }

  async getGroupReadiness(activityId: string, userId: string): Promise<GroupReadiness> {
    const membership = await this.prisma.groupMember.findFirst({
      where: { userId, group: { activities: { some: { id: activityId } } } },
      select: { id: true },
    });
    if (!membership) {
      throw new NotFoundException({
        code: AppErrorCode.ACTIVITY_NOT_FOUND,
        message: 'Activity not found',
      });
    }

    const cacheKey = `readiness:activity:${activityId}`;
    const cached = await this.redis.get<GroupReadiness>(cacheKey);
    if (cached) {
      return cached;
    }

    const activity = await this.prisma.groupActivity.findUnique({
      where: { id: activityId },
      include: {
        sharedItems: {
          include: {
            responsibilities: true,
            inventoryReservations: {
              where: { status: { in: ['ACTIVE', 'FULFILLED'] } },
            },
          },
        },
        group: {
          include: {
            members: {
              include: {
                user: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!activity) {
      throw new NotFoundException({
        code: AppErrorCode.ACTIVITY_NOT_FOUND,
        message: 'Activity not found',
      });
    }

    const totalSharedItems = activity.sharedItems.length;

    // A shared item is "covered" if its committed+packed quantity >= requiredQuantity
    const coveredSharedItems = activity.sharedItems.filter((item) => {
      const activeCommitted = item.responsibilities
        .filter(
          (r) =>
            r.status === SharedResponsibilityStatus.COMMITTED ||
            r.status === SharedResponsibilityStatus.PACKED,
        )
        .reduce((sum, r) => sum + r.committedQuantity, 0);
      const inventoryReserved = (item.inventoryReservations ?? []).reduce(
        (sum, reservation) => sum + reservation.quantity,
        0,
      );
      return activeCommitted + inventoryReserved >= item.requiredQuantity;
    }).length;

    const groupPercentage =
      totalSharedItems === 0 ? 100 : Math.round((coveredSharedItems / totalSharedItems) * 100);

    // Per-member readiness: fetch latest session per member in a SINGLE query
    const memberUserIds = activity.group.members.map((m) => m.userId);

    const latestSessions = await this.prisma.packingSession.findMany({
      where: {
        groupActivityId: activityId,
        userId: { in: memberUserIds },
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['userId'],
      include: {
        checklist: {
          include: {
            items: { where: { isMandatory: true }, select: { id: true } },
          },
        },
        decisions: {
          where: { equipmentItemId: { not: null } },
          select: { equipmentItemId: true, decision: true },
        },
      },
    });

    const sessionsByUser = new Map(latestSessions.map((s) => [s.userId, s]));

    const memberReadiness: MemberReadiness[] = activity.group.members.map((member) => {
      const latestSession = sessionsByUser.get(member.userId);

      if (!latestSession) {
        return {
          userId: member.userId,
          userName: member.user.name,
          percentage: 0,
          packedMandatoryItems: 0,
          totalMandatoryItems: 0,
        };
      }

      const totalMandatory = latestSession.checklist.items.length;
      const mandatoryItemIds = new Set(latestSession.checklist.items.map((i) => i.id));
      const packed = latestSession.decisions.filter(
        (d) =>
          d.equipmentItemId &&
          mandatoryItemIds.has(d.equipmentItemId) &&
          d.decision === PackingDecisionType.PACKED,
      ).length;

      const pct = totalMandatory === 0 ? 100 : Math.round((packed / totalMandatory) * 100);

      return {
        userId: member.userId,
        userName: member.user.name,
        percentage: pct,
        packedMandatoryItems: packed,
        totalMandatoryItems: totalMandatory,
      };
    });

    const result: GroupReadiness = {
      activityId,
      totalSharedItems,
      coveredSharedItems,
      groupPercentage,
      memberReadiness,
    };

    await this.redis.set(cacheKey, result, 30);

    return result;
  }
}
