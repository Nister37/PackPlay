import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PackingSessionsService } from './packing-sessions.service';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PackingGateway } from '../realtime/packing.gateway';
import { PackingSessionStatus, SharedResponsibilityStatus } from '@prisma/client';

describe('PackingSessionsService', () => {
  let service: PackingSessionsService;
  let prisma: any;
  let notificationsService: any;
  let gateway: any;

  beforeEach(async () => {
    prisma = {
      checklist: { findUnique: jest.fn() },
      groupActivity: { findUnique: jest.fn() },
      packingSession: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      packingDecision: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
      equipmentItem: {
        findMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ id: 'item-1' }),
      },
      sharedResponsibility: { findUnique: jest.fn(), update: jest.fn() },
      sharedItem: { findUnique: jest.fn(), findFirst: jest.fn() },
      groupMember: { findUnique: jest.fn() },
    };

    notificationsService = {
      createNotification: jest.fn(),
      createNotificationsBatch: jest.fn(),
    };

    gateway = {
      emitToActivity: jest.fn(),
      emitToGroup: jest.fn(),
      emitToUser: jest.fn(),
    };

    const redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PackingSessionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: PackingGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get<PackingSessionsService>(PackingSessionsService);
  });

  describe('startSession', () => {
    it('should create a new packing session', async () => {
      const userId = 'user-1';
      const dto = { checklistId: 'checklist-1' };

      prisma.checklist.findUnique.mockResolvedValue({ id: 'checklist-1', userId });
      prisma.packingSession.create.mockResolvedValue({
        id: 'session-1',
        userId,
        checklistId: 'checklist-1',
        status: 'IN_PROGRESS',
      });

      const result = await service.startSession(userId, dto);
      expect(result.status).toBe('IN_PROGRESS');
      expect(prisma.packingSession.create).toHaveBeenCalled();
    });

    it('should throw if checklist not found', async () => {
      prisma.checklist.findUnique.mockResolvedValue(null);
      await expect(service.startSession('user-1', { checklistId: 'bad' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if checklist belongs to another user', async () => {
      prisma.checklist.findUnique.mockResolvedValue({ id: 'checklist-1', userId: 'other-user' });
      await expect(service.startSession('user-1', { checklistId: 'checklist-1' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('completeSession', () => {
    it('should complete session when all mandatory items resolved', async () => {
      const sessionId = 'session-1';
      const userId = 'user-1';

      prisma.packingSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId,
        checklistId: 'checklist-1',
        groupActivityId: null,
        status: PackingSessionStatus.IN_PROGRESS,
      });

      prisma.equipmentItem.findMany.mockResolvedValue([{ id: 'item-1' }, { id: 'item-2' }]);

      prisma.packingDecision.findMany.mockResolvedValue([
        { equipmentItemId: 'item-1', decision: 'PACKED' },
        { equipmentItemId: 'item-2', decision: 'NOT_PACKED' },
      ]);

      prisma.packingSession.update.mockResolvedValue({
        id: sessionId,
        status: PackingSessionStatus.COMPLETED,
        completedAt: new Date(),
      });

      const result = await service.completeSession(userId, sessionId);
      expect(result.status).toBe(PackingSessionStatus.COMPLETED);
    });

    it('should throw if mandatory items are unresolved', async () => {
      const sessionId = 'session-1';
      const userId = 'user-1';

      prisma.packingSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId,
        checklistId: 'checklist-1',
        groupActivityId: null,
        status: PackingSessionStatus.IN_PROGRESS,
      });

      prisma.equipmentItem.findMany.mockResolvedValue([
        { id: 'item-1' },
        { id: 'item-2' },
        { id: 'item-3' },
      ]);

      prisma.packingDecision.findMany.mockResolvedValue([
        { equipmentItemId: 'item-1', decision: 'PACKED' },
      ]);

      await expect(service.completeSession(userId, sessionId)).rejects.toThrow(BadRequestException);
    });

    it('should throw if session is already completed', async () => {
      prisma.packingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        status: PackingSessionStatus.COMPLETED,
      });

      await expect(service.completeSession('user-1', 'session-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if session not found', async () => {
      prisma.packingSession.findUnique.mockResolvedValue(null);

      await expect(service.completeSession('user-1', 'no-session')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('recordDecision', () => {
    it('should record a PACKED decision', async () => {
      prisma.packingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        checklistId: 'checklist-1',
        groupActivityId: null,
        status: PackingSessionStatus.IN_PROGRESS,
      });

      prisma.packingDecision.findFirst.mockResolvedValue(null);
      prisma.packingDecision.create.mockResolvedValue({
        id: 'decision-1',
        equipmentItemId: 'item-1',
        decision: 'PACKED',
      });

      const result = await service.recordDecision('user-1', 'session-1', {
        equipmentItemId: 'item-1',
        decision: 'PACKED',
      });

      expect(result.decision).toBe('PACKED');
    });

    it('should throw if decision already made for item', async () => {
      prisma.packingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        checklistId: 'checklist-1',
        groupActivityId: null,
        status: PackingSessionStatus.IN_PROGRESS,
      });

      prisma.packingDecision.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.recordDecision('user-1', 'session-1', {
          equipmentItemId: 'item-1',
          decision: 'PACKED',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should require reason for NOT_PACKED decision', async () => {
      prisma.packingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        checklistId: 'checklist-1',
        groupActivityId: null,
        status: PackingSessionStatus.IN_PROGRESS,
      });

      await expect(
        service.recordDecision('user-1', 'session-1', {
          equipmentItemId: 'item-1',
          decision: 'NOT_PACKED',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require at least one item reference', async () => {
      prisma.packingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        checklistId: 'checklist-1',
        groupActivityId: null,
        status: PackingSessionStatus.IN_PROGRESS,
      });

      await expect(
        service.recordDecision('user-1', 'session-1', {
          decision: 'PACKED',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a decision for a shared item not assigned to the user', async () => {
      prisma.packingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        checklistId: 'checklist-1',
        groupActivityId: 'activity-1',
        status: PackingSessionStatus.IN_PROGRESS,
      });
      prisma.sharedItem.findFirst.mockResolvedValue(null);

      await expect(
        service.recordDecision('user-1', 'session-1', {
          sharedItemId: 'shared-item-1',
          decision: 'PACKED',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.sharedItem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            responsibilities: {
              some: {
                userId: 'user-1',
                status: { not: SharedResponsibilityStatus.RELEASED },
              },
            },
          }),
        }),
      );
    });
  });

  describe('abandonSession', () => {
    it('should abandon an active session', async () => {
      prisma.packingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        status: PackingSessionStatus.IN_PROGRESS,
      });

      prisma.packingSession.update.mockResolvedValue({
        id: 'session-1',
        status: PackingSessionStatus.ABANDONED,
      });

      const result = await service.abandonSession('user-1', 'session-1');
      expect(result.status).toBe(PackingSessionStatus.ABANDONED);
    });
  });
});
