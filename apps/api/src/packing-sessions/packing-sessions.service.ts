import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PackingDecisionReason,
  PackingDecisionType,
  PackingSessionStatus,
  Prisma,
  SharedResponsibilityStatus,
} from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { AppErrorCode } from '@packplay/common';
import { RecordDecisionDto, StartPackingSessionDto } from './dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PackingGateway } from '../realtime/packing.gateway';

@Injectable()
export class PackingSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notificationsService: NotificationsService,
    private readonly packingGateway: PackingGateway,
  ) {}

  async startSession(userId: string, dto: StartPackingSessionDto) {
    if (!dto.checklistId && !dto.groupActivityId) {
      throw new BadRequestException({
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'Either checklistId or groupActivityId must be provided',
      });
    }

    let checklistId = dto.checklistId;

    // Verify activity exists if provided
    if (dto.groupActivityId) {
      const activity = await this.prisma.groupActivity.findUnique({
        where: { id: dto.groupActivityId },
      });
      if (!activity) {
        throw new NotFoundException({
          code: AppErrorCode.ACTIVITY_NOT_FOUND,
          message: 'Activity not found',
        });
      }

      // Auto-resolve checklist from activity's sport profile if not explicitly provided
      if (!checklistId && activity.sportProfileId) {
        const checklist = await this.prisma.checklist.findFirst({
          where: { userId, sportProfileId: activity.sportProfileId },
          orderBy: { updatedAt: 'desc' },
        });
        if (checklist) {
          checklistId = checklist.id;
        } else {
          // Auto-create a checklist for this sport so packing can proceed
          const sportProfile = await this.prisma.sportProfile.findUnique({
            where: { id: activity.sportProfileId },
          });
          const newChecklist = await this.prisma.checklist.create({
            data: {
              userId,
              sportProfileId: activity.sportProfileId,
              name: sportProfile ? `${sportProfile.name} Checklist` : 'Packing Checklist',
            },
          });
          checklistId = newChecklist.id;
        }
      }

      // If activity has no sport profile, create a generic checklist
      if (!checklistId && !activity.sportProfileId) {
        const newChecklist = await this.prisma.checklist.create({
          data: {
            userId,
            sportProfileId: await this.getOrCreateDefaultSportProfile(userId),
            name: `${activity.name ?? 'Activity'} Checklist`,
          },
        });
        checklistId = newChecklist.id;
      }
    }

    if (!checklistId) {
      throw new BadRequestException({
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'Could not resolve a checklist for this session. Please provide a checklistId.',
      });
    }

    // Verify checklist belongs to user
    const checklist = await this.prisma.checklist.findUnique({
      where: { id: checklistId },
    });

    if (!checklist || checklist.userId !== userId) {
      throw new NotFoundException({
        code: AppErrorCode.CHECKLIST_NOT_FOUND,
        message: 'Checklist not found',
      });
    }

    return this.prisma.packingSession.create({
      data: {
        userId,
        checklistId,
        groupActivityId: dto.groupActivityId ?? null,
        status: PackingSessionStatus.IN_PROGRESS,
      },
      include: {
        checklist: { select: { id: true, name: true } },
        groupActivity: { select: { id: true, name: true } },
      },
    });
  }

  async listSessions(userId: string, status?: string) {
    const where: Prisma.PackingSessionWhereInput = { userId };
    if (status) {
      where.status = status as PackingSessionStatus;
    }

    return this.prisma.packingSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        checklist: { select: { id: true, name: true } },
        groupActivity: { select: { id: true, name: true } },
        _count: { select: { decisions: true } },
      },
    });
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.prisma.packingSession.findUnique({
      where: { id: sessionId },
      include: {
        checklist: {
          select: { id: true, name: true },
        },
        groupActivity: { select: { id: true, name: true } },
        decisions: {
          include: {
            equipmentItem: { select: { id: true, name: true, category: true } },
            sharedItem: { select: { id: true, name: true, category: true } },
          },
          orderBy: { decidedAt: 'desc' },
        },
      },
    });

    if (!session || session.userId !== userId) {
      throw new NotFoundException({
        code: AppErrorCode.SESSION_NOT_FOUND,
        message: 'Packing session not found',
      });
    }

    return session;
  }

  async recordDecision(userId: string, sessionId: string, dto: RecordDecisionDto) {
    const session = await this.findActiveSession(userId, sessionId);

    // Validate at least one item reference
    if (!dto.equipmentItemId && !dto.sharedItemId) {
      throw new BadRequestException({
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'Either equipmentItemId or sharedItemId must be provided',
      });
    }

    // Validate reason is required for NOT_PACKED
    if (dto.decision === 'NOT_PACKED' && !dto.reason) {
      throw new BadRequestException({
        code: AppErrorCode.INVALID_DECISION_REASON,
        message: 'Reason is required when decision is NOT_PACKED',
      });
    }

    // Check for duplicate decision
    const existingDecision = await this.prisma.packingDecision.findFirst({
      where: {
        packingSessionId: sessionId,
        ...(dto.equipmentItemId && { equipmentItemId: dto.equipmentItemId }),
        ...(dto.sharedItemId && { sharedItemId: dto.sharedItemId }),
      },
    });

    if (existingDecision) {
      throw new ConflictException({
        code: AppErrorCode.DECISION_ALREADY_MADE,
        message: 'A decision has already been made for this item in this session',
      });
    }

    const decision = await this.prisma.packingDecision.create({
      data: {
        packingSessionId: sessionId,
        equipmentItemId: dto.equipmentItemId ?? null,
        sharedItemId: dto.sharedItemId ?? null,
        decision: dto.decision as PackingDecisionType,
        reason: dto.reason ? (dto.reason as PackingDecisionReason) : null,
        notes: dto.notes ?? null,
      },
      include: {
        equipmentItem: { select: { id: true, name: true } },
        sharedItem: { select: { id: true, name: true } },
      },
    });

    // Handle shared item side effects
    if (
      dto.sharedItemId &&
      dto.decision === 'NOT_PACKED' &&
      (dto.reason === 'FORGOT' || dto.reason === 'COULD_NOT_BRING')
    ) {
      await this.handleSharedItemMissing(userId, dto.sharedItemId, dto.reason, session.groupActivityId);
    }

    // Emit progress update
    if (session.groupActivityId) {
      this.packingGateway.emitToActivity(session.groupActivityId, 'packing.progress-updated', {
        sessionId,
        userId,
        activityId: session.groupActivityId,
      });

      await this.redis.del(`readiness:activity:${session.groupActivityId}`);
    }

    return decision;
  }

  async completeSession(userId: string, sessionId: string) {
    const session = await this.findActiveSession(userId, sessionId);

    // Get all mandatory items from the checklist
    const mandatoryItems = await this.prisma.equipmentItem.findMany({
      where: { checklistId: session.checklistId, isMandatory: true },
      select: { id: true },
    });

    // Get decisions made in this session
    const decisions = await this.prisma.packingDecision.findMany({
      where: { packingSessionId: sessionId },
      select: { equipmentItemId: true, decision: true },
    });

    const decidedItemIds = new Set(
      decisions
        .filter((d) => d.equipmentItemId)
        .map((d) => d.equipmentItemId),
    );

    const unresolvedMandatory = mandatoryItems.filter(
      (item) => !decidedItemIds.has(item.id),
    );

    if (unresolvedMandatory.length > 0) {
      throw new BadRequestException({
        code: AppErrorCode.MANDATORY_ITEMS_UNRESOLVED,
        message: `${unresolvedMandatory.length} mandatory item(s) have not been resolved`,
      });
    }

    const completed = await this.prisma.packingSession.update({
      where: { id: sessionId },
      data: {
        status: PackingSessionStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    if (session.groupActivityId) {
      this.packingGateway.emitToActivity(session.groupActivityId, 'readiness.updated', {
        activityId: session.groupActivityId,
        userId,
        sessionId,
      });

      await this.redis.del(`readiness:activity:${session.groupActivityId}`);
    }

    return completed;
  }

  async abandonSession(userId: string, sessionId: string) {
    await this.findActiveSession(userId, sessionId);

    return this.prisma.packingSession.update({
      where: { id: sessionId },
      data: { status: PackingSessionStatus.ABANDONED },
    });
  }

  async getRemainingItems(userId: string, sessionId: string) {
    const session = await this.prisma.packingSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new NotFoundException({
        code: AppErrorCode.SESSION_NOT_FOUND,
        message: 'Packing session not found',
      });
    }

    const mandatoryItems = await this.prisma.equipmentItem.findMany({
      where: { checklistId: session.checklistId, isMandatory: true },
    });

    const decisions = await this.prisma.packingDecision.findMany({
      where: { packingSessionId: sessionId },
      select: { equipmentItemId: true },
    });

    const decidedIds = new Set(decisions.map((d) => d.equipmentItemId));

    return mandatoryItems.filter((item) => !decidedIds.has(item.id));
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private async findActiveSession(userId: string, sessionId: string) {
    const session = await this.prisma.packingSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new NotFoundException({
        code: AppErrorCode.SESSION_NOT_FOUND,
        message: 'Packing session not found',
      });
    }

    if (session.status !== PackingSessionStatus.IN_PROGRESS) {
      throw new BadRequestException({
        code: AppErrorCode.SESSION_ALREADY_COMPLETED,
        message: 'This session is no longer active',
      });
    }

    return session;
  }

  private async handleSharedItemMissing(
    userId: string,
    sharedItemId: string,
    reason: string,
    groupActivityId: string | null,
  ) {
    // Update SharedResponsibility status
    const statusMap: Record<string, SharedResponsibilityStatus> = {
      FORGOT: SharedResponsibilityStatus.FORGOT,
      COULD_NOT_BRING: SharedResponsibilityStatus.COULD_NOT_BRING,
    };

    const responsibility = await this.prisma.sharedResponsibility.findUnique({
      where: { sharedItemId_userId: { sharedItemId, userId } },
    });

    if (responsibility) {
      await this.prisma.sharedResponsibility.update({
        where: { id: responsibility.id },
        data: { status: statusMap[reason] },
      });
    }

    if (!groupActivityId) return;

    // Find the activity and notify group members
    const activity = await this.prisma.groupActivity.findUnique({
      where: { id: groupActivityId },
      include: {
        group: { include: { members: true } },
      },
    });

    if (!activity) return;

    const sharedItem = await this.prisma.sharedItem.findUnique({
      where: { id: sharedItemId },
      select: { id: true, name: true },
    });

    // Create notifications for other group members (batch)
    const otherMembers = activity.group.members.filter((m) => m.userId !== userId);
    await this.notificationsService.createNotificationsBatch(
      otherMembers.map((member) => ({
        userId: member.userId,
        groupId: activity.groupId,
        type: 'ITEM_MISSING',
        payload: {
          sharedItemId,
          sharedItemName: sharedItem?.name,
          activityId: groupActivityId,
          reportedByUserId: userId,
          reason,
        },
      })),
    );

    // Emit socket event
    this.packingGateway.emitToActivity(groupActivityId, 'shared-item.missing', {
      sharedItemId,
      sharedItemName: sharedItem?.name,
      activityId: groupActivityId,
      userId,
      reason,
    });
  }

  private async getOrCreateDefaultSportProfile(userId: string): Promise<string> {
    const existing = await this.prisma.sportProfile.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) return existing.id;

    const profile = await this.prisma.sportProfile.create({
      data: {
        userId,
        name: 'General',
        activityTypes: [],
      },
    });
    return profile.id;
  }
}
