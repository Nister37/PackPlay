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
  risks: ReadinessRisk[];
}

export interface ReadinessRisk {
  type:
    | 'UNCOVERED_MANDATORY_ITEM'
    | 'MISSING_QUANTITY'
    | 'ABSENT_RESPONSIBLE_MEMBER'
    | 'UNSTAFFED_ROLE'
    | 'DAMAGED_RESERVED_ASSET';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  message: string;
  itemId?: string;
  memberId?: string;
  missingQuantity?: number;
  actionUrl: string;
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
              include: {
                batch: { select: { id: true, condition: true } },
                asset: { select: { id: true, condition: true } },
              },
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
        eventMembers: true,
        roles: { include: { assignments: true } },
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
      const inventoryReserved = (item.inventoryReservations ?? [])
        .filter((reservation) => this.usableReservation(reservation))
        .reduce((sum, reservation) => sum + reservation.quantity, 0);
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

    const attendanceByUser = new Map(
      (activity.eventMembers ?? []).map((member) => [member.userId, member.attendanceStatus]),
    );
    const deadlinePassed = Boolean(
      activity.responsibilityDeadline && activity.responsibilityDeadline.getTime() < Date.now(),
    );
    const risks: ReadinessRisk[] = [];

    for (const item of activity.sharedItems) {
      const activeResponsibilities = item.responsibilities.filter(
        (responsibility) =>
          responsibility.status === SharedResponsibilityStatus.COMMITTED ||
          responsibility.status === SharedResponsibilityStatus.PACKED,
      );
      const committed = activeResponsibilities.reduce(
        (sum, responsibility) => sum + responsibility.committedQuantity,
        0,
      );
      const inventoryReserved = (item.inventoryReservations ?? [])
        .filter((reservation) => this.usableReservation(reservation))
        .reduce((sum, reservation) => sum + reservation.quantity, 0);
      const missingQuantity = Math.max(0, item.requiredQuantity - committed - inventoryReserved);
      if (item.isMandatory && missingQuantity > 0) {
        risks.push({
          type: committed === 0 ? 'UNCOVERED_MANDATORY_ITEM' : 'MISSING_QUANTITY',
          severity: deadlinePassed ? 'CRITICAL' : committed === 0 ? 'HIGH' : 'MEDIUM',
          message:
            committed === 0
              ? `${item.name} has no responsible member`
              : `${item.name} is short by ${missingQuantity}`,
          itemId: item.id,
          missingQuantity,
          actionUrl: `/groups/${activity.groupId}/equipment/${item.id}`,
        });
      }

      for (const reservation of item.inventoryReservations ?? []) {
        if (!this.usableReservation(reservation)) {
          const stockId = reservation.asset?.id ?? reservation.batch?.id;
          risks.push({
            type: 'DAMAGED_RESERVED_ASSET',
            severity: 'CRITICAL',
            message: `Reserved inventory for ${item.name} is no longer usable`,
            itemId: item.id,
            actionUrl: `/groups/${activity.groupId}/inventory/${stockId ?? ''}`,
          });
        }
      }

      for (const responsibility of activeResponsibilities) {
        if (attendanceByUser.get(responsibility.userId) === 'NOT_ATTENDING') {
          risks.push({
            type: 'ABSENT_RESPONSIBLE_MEMBER',
            severity: deadlinePassed ? 'CRITICAL' : 'HIGH',
            message: `An absent member is responsible for ${item.name}`,
            itemId: item.id,
            memberId: responsibility.userId,
            actionUrl: `/groups/${activity.groupId}/equipment/${item.id}`,
          });
        }
      }
    }

    for (const role of activity.roles ?? []) {
      const attendingAssignments = role.assignments.filter(
        (assignment) => attendanceByUser.get(assignment.userId) !== 'NOT_ATTENDING',
      );
      if (role.assignments.length === 0 || attendingAssignments.length === 0) {
        risks.push({
          type: 'UNSTAFFED_ROLE',
          severity: deadlinePassed ? 'HIGH' : 'MEDIUM',
          message: `${role.name} has no attending member`,
          actionUrl: `/groups/${activity.groupId}/events/${activity.id}/members`,
        });
      }
    }

    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 } as const;
    risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const result: GroupReadiness = {
      activityId,
      totalSharedItems,
      coveredSharedItems,
      groupPercentage,
      memberReadiness,
      risks,
    };

    await this.redis.set(cacheKey, result, 120);

    return result;
  }

  private usableReservation(reservation: {
    batch?: { condition: string } | null;
    asset?: { condition: string } | null;
  }) {
    const condition = reservation.asset?.condition ?? reservation.batch?.condition;
    return condition === undefined || ['GOOD', 'NEEDS_ATTENTION'].includes(condition);
  }
}
