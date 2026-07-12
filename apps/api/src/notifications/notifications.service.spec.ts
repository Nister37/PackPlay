import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../common/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('createNotification', () => {
    it('should create a notification', async () => {
      const input = {
        userId: 'user-1',
        groupId: 'group-1',
        type: 'ITEM_MISSING',
        payload: { sharedItemId: 'item-1', reason: 'FORGOT' },
      };

      prisma.notification.create.mockResolvedValue({
        id: 'notif-1',
        ...input,
        isRead: false,
        createdAt: new Date(),
      });

      const result = await service.createNotification(input);
      expect(result.id).toBe('notif-1');
      expect(result.isRead).toBe(false);
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          groupId: 'group-1',
          type: 'ITEM_MISSING',
          payload: input.payload,
        },
      });
    });

    it('should create a notification without groupId', async () => {
      const input = {
        userId: 'user-1',
        type: 'READINESS_UPDATED',
        payload: { percentage: 75 },
      };

      prisma.notification.create.mockResolvedValue({
        id: 'notif-2',
        userId: 'user-1',
        groupId: null,
        type: 'READINESS_UPDATED',
        payload: input.payload,
        isRead: false,
      });

      const result = await service.createNotification(input);
      expect(result.groupId).toBeNull();
    });
  });

  describe('listNotifications', () => {
    it('should return paginated notifications', async () => {
      const notifications = [
        { id: 'n1', type: 'ITEM_MISSING' },
        { id: 'n2', type: 'ITEM_PACKED' },
      ];
      prisma.notification.findMany.mockResolvedValue(notifications);
      prisma.notification.count.mockResolvedValue(5);

      const result = await service.listNotifications('user-1', 1, 2);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(5);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(2);
      expect(result.meta.totalPages).toBe(3);
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        isRead: false,
      });

      prisma.notification.update.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        isRead: true,
      });

      const result = await service.markAsRead('user-1', 'notif-1');
      expect(result.isRead).toBe(true);
    });

    it('should throw if notification not found', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);
      await expect(service.markAsRead('user-1', 'bad')).rejects.toThrow(NotFoundException);
    });

    it('should throw if notification belongs to another user', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'notif-1',
        userId: 'other-user',
      });
      await expect(service.markAsRead('user-1', 'notif-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.markAllAsRead('user-1');
      expect(result.message).toBe('All notifications marked as read');
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
        data: { isRead: true },
      });
    });
  });
});
