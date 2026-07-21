import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReadinessService } from './readiness.service';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

describe('ReadinessService', () => {
  let service: ReadinessService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      packingSession: { findUnique: jest.fn(), findMany: jest.fn() },
      groupActivity: { findUnique: jest.fn() },
      groupMember: { findFirst: jest.fn().mockResolvedValue({ id: 'member-1' }) },
    };

    const redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadinessService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<ReadinessService>(ReadinessService);
  });

  describe('getPersonalReadiness', () => {
    it('should calculate 100% when all mandatory items are packed', async () => {
      prisma.packingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        checklist: {
          items: [{ id: 'item-1' }, { id: 'item-2' }],
        },
        decisions: [
          { equipmentItemId: 'item-1', decision: 'PACKED' },
          { equipmentItemId: 'item-2', decision: 'PACKED' },
        ],
      });

      const result = await service.getPersonalReadiness('user-1', 'session-1');
      expect(result.percentage).toBe(100);
      expect(result.packedMandatoryItems).toBe(2);
      expect(result.totalMandatoryItems).toBe(2);
    });

    it('should calculate 50% when half the mandatory items are packed', async () => {
      prisma.packingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        checklist: {
          items: [{ id: 'item-1' }, { id: 'item-2' }],
        },
        decisions: [
          { equipmentItemId: 'item-1', decision: 'PACKED' },
          { equipmentItemId: 'item-2', decision: 'NOT_PACKED' },
        ],
      });

      const result = await service.getPersonalReadiness('user-1', 'session-1');
      expect(result.percentage).toBe(50);
      expect(result.packedMandatoryItems).toBe(1);
    });

    it('should return 0% when no items are packed', async () => {
      prisma.packingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        checklist: {
          items: [{ id: 'item-1' }, { id: 'item-2' }],
        },
        decisions: [],
      });

      const result = await service.getPersonalReadiness('user-1', 'session-1');
      expect(result.percentage).toBe(0);
    });

    it('should return 100% when there are no mandatory items', async () => {
      prisma.packingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        checklist: { items: [] },
        decisions: [],
      });

      const result = await service.getPersonalReadiness('user-1', 'session-1');
      expect(result.percentage).toBe(100);
    });

    it('should throw if session not found', async () => {
      prisma.packingSession.findUnique.mockResolvedValue(null);
      await expect(service.getPersonalReadiness('user-1', 'bad')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if session belongs to another user', async () => {
      prisma.packingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'other-user',
        checklist: { items: [] },
        decisions: [],
      });

      await expect(service.getPersonalReadiness('user-1', 'session-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should only count items from the mandatory list', async () => {
      prisma.packingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        checklist: {
          items: [{ id: 'item-1' }], // only item-1 is mandatory
        },
        decisions: [
          { equipmentItemId: 'item-1', decision: 'PACKED' },
          { equipmentItemId: 'item-99', decision: 'PACKED' }, // non-mandatory, should be ignored
        ],
      });

      const result = await service.getPersonalReadiness('user-1', 'session-1');
      expect(result.totalMandatoryItems).toBe(1);
      expect(result.packedMandatoryItems).toBe(1);
      expect(result.percentage).toBe(100);
    });
  });

  describe('getGroupReadiness', () => {
    it('should calculate group readiness from shared item coverage', async () => {
      prisma.groupActivity.findUnique.mockResolvedValue({
        id: 'activity-1',
        groupId: 'group-1',
        sharedItems: [
          {
            id: 'shared-1',
            requiredQuantity: 2,
            responsibilities: [{ committedQuantity: 2, status: 'COMMITTED' }],
          },
          {
            id: 'shared-2',
            requiredQuantity: 1,
            responsibilities: [{ committedQuantity: 1, status: 'PACKED' }],
          },
          {
            id: 'shared-3',
            requiredQuantity: 3,
            responsibilities: [{ committedQuantity: 1, status: 'COMMITTED' }],
          },
        ],
        group: {
          members: [
            { userId: 'user-1', user: { id: 'user-1', name: 'Alice' } },
            { userId: 'user-2', user: { id: 'user-2', name: 'Bob' } },
          ],
        },
      });

      // Single findMany call returns no sessions for any member
      prisma.packingSession.findMany.mockResolvedValue([]);

      const result = await service.getGroupReadiness('activity-1', 'user-1');
      expect(result.totalSharedItems).toBe(3);
      expect(result.coveredSharedItems).toBe(2); // shared-1 and shared-2 are covered
      expect(result.groupPercentage).toBe(67); // Math.round(2/3 * 100)
    });

    it('should return 100% when all shared items are covered', async () => {
      prisma.groupActivity.findUnique.mockResolvedValue({
        id: 'activity-1',
        groupId: 'group-1',
        sharedItems: [
          {
            id: 'shared-1',
            requiredQuantity: 1,
            responsibilities: [{ committedQuantity: 1, status: 'PACKED' }],
          },
        ],
        group: {
          members: [{ userId: 'user-1', user: { id: 'user-1', name: 'Alice' } }],
        },
      });

      prisma.packingSession.findMany.mockResolvedValue([]);

      const result = await service.getGroupReadiness('activity-1', 'user-1');
      expect(result.groupPercentage).toBe(100);
    });

    it('should return 100% when there are no shared items', async () => {
      prisma.groupActivity.findUnique.mockResolvedValue({
        id: 'activity-1',
        groupId: 'group-1',
        sharedItems: [],
        group: { members: [] },
      });

      prisma.packingSession.findMany.mockResolvedValue([]);

      const result = await service.getGroupReadiness('activity-1', 'user-1');
      expect(result.groupPercentage).toBe(100);
    });

    it('should throw if activity not found', async () => {
      prisma.groupMember.findFirst.mockResolvedValue(null);
      await expect(service.getGroupReadiness('bad', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should include per-member readiness from their latest session', async () => {
      prisma.groupActivity.findUnique.mockResolvedValue({
        id: 'activity-1',
        groupId: 'group-1',
        sharedItems: [],
        group: {
          members: [{ userId: 'user-1', user: { id: 'user-1', name: 'Alice' } }],
        },
      });

      // Single findMany with distinct: ['userId'] returns the latest session per user
      prisma.packingSession.findMany.mockResolvedValue([
        {
          id: 'session-1',
          userId: 'user-1',
          checklist: {
            items: [{ id: 'item-1' }, { id: 'item-2' }],
          },
          decisions: [{ equipmentItemId: 'item-1', decision: 'PACKED' }],
        },
      ]);

      const result = await service.getGroupReadiness('activity-1', 'user-1');
      expect(result.memberReadiness).toHaveLength(1);
      expect(result.memberReadiness[0].percentage).toBe(50);
      expect(result.memberReadiness[0].packedMandatoryItems).toBe(1);
      expect(result.memberReadiness[0].totalMandatoryItems).toBe(2);
    });
  });
});
