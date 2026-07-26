import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../common/prisma.service';
import { EventActivityLogService } from './event-activity-log.service';

describe('EventActivityLogService', () => {
  let service: EventActivityLogService;
  const prisma = {
    groupActivity: { findUnique: jest.fn() },
    eventActivityLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        EventActivityLogService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(EventActivityLogService);
  });

  describe('list', () => {
    it('returns paginated activity log entries', async () => {
      prisma.groupActivity.findUnique.mockResolvedValue({
        groupId: 'group-1',
      });
      const entries = [
        { id: 'log-1', action: 'ITEM_ADDED', actorId: 'user-1', actor: { id: 'user-1', name: 'Alice' } },
        { id: 'log-2', action: 'ITEM_REMOVED', actorId: 'user-2', actor: { id: 'user-2', name: 'Bob' } },
      ];
      prisma.eventActivityLog.findMany.mockResolvedValue(entries);
      prisma.eventActivityLog.count.mockResolvedValue(2);

      const result = await service.list('group-1', 'activity-1', {});

      expect(result.data).toEqual(entries);
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 50, totalPages: 1 });
    });

    it('filters by memberId when provided', async () => {
      prisma.groupActivity.findUnique.mockResolvedValue({
        groupId: 'group-1',
      });
      prisma.eventActivityLog.findMany.mockResolvedValue([]);
      prisma.eventActivityLog.count.mockResolvedValue(0);

      await service.list('group-1', 'activity-1', { memberId: 'user-1' });

      const findManyCall = prisma.eventActivityLog.findMany.mock.calls[0][0];
      expect(findManyCall.where.actorId).toBe('user-1');
    });

    it('filters by itemId when provided', async () => {
      prisma.groupActivity.findUnique.mockResolvedValue({
        groupId: 'group-1',
      });
      prisma.eventActivityLog.findMany.mockResolvedValue([]);
      prisma.eventActivityLog.count.mockResolvedValue(0);

      await service.list('group-1', 'activity-1', { itemId: 'item-1' });

      const findManyCall = prisma.eventActivityLog.findMany.mock.calls[0][0];
      expect(findManyCall.where.itemId).toBe('item-1');
    });

    it('throws NotFoundException when activity does not exist', async () => {
      prisma.groupActivity.findUnique.mockResolvedValue(null);

      await expect(
        service.list('group-1', 'nonexistent', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when activity belongs to a different group', async () => {
      prisma.groupActivity.findUnique.mockResolvedValue({
        groupId: 'other-group',
      });

      await expect(
        service.list('group-1', 'activity-1', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('respects pagination parameters', async () => {
      prisma.groupActivity.findUnique.mockResolvedValue({
        groupId: 'group-1',
      });
      prisma.eventActivityLog.findMany.mockResolvedValue([]);
      prisma.eventActivityLog.count.mockResolvedValue(150);

      const result = await service.list('group-1', 'activity-1', { page: 3, limit: 20 });

      const findManyCall = prisma.eventActivityLog.findMany.mock.calls[0][0];
      expect(findManyCall.skip).toBe(40);
      expect(findManyCall.take).toBe(20);
      expect(result.meta).toEqual({ total: 150, page: 3, limit: 20, totalPages: 8 });
    });
  });
});
