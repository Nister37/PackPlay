import { Injectable, NotFoundException } from '@nestjs/common';
import { PackingDecisionType, SharedResponsibilityStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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

  async getGroupReadiness(activityId: string): Promise<GroupReadiness> {
    const activity = await this.prisma.groupActivity.findUnique({
      where: { id: activityId },
      include: {
        sharedItems: {
          include: { responsibilities: true },
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
      return activeCommitted >= item.requiredQuantity;
    }).length;

    const groupPercentage =
      totalSharedItems === 0
        ? 100
        : Math.round((coveredSharedItems / totalSharedItems) * 100);

    // Per-member readiness: based on their packing sessions for this activity
    const memberReadiness: MemberReadiness[] = [];

    for (const member of activity.group.members) {
      const sessions = await this.prisma.packingSession.findMany({
        where: {
          userId: member.userId,
          groupActivityId: activityId,
        },
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
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      const latestSession = sessions[0];
      if (!latestSession) {
        memberReadiness.push({
          userId: member.userId,
          userName: member.user.name,
          percentage: 0,
          packedMandatoryItems: 0,
          totalMandatoryItems: 0,
        });
        continue;
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

      memberReadiness.push({
        userId: member.userId,
        userName: member.user.name,
        percentage: pct,
        packedMandatoryItems: packed,
        totalMandatoryItems: totalMandatory,
      });
    }

    return {
      activityId,
      totalSharedItems,
      coveredSharedItems,
      groupPercentage,
      memberReadiness,
    };
  }
}
