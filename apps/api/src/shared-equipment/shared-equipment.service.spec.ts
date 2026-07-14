import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ResponsibilityTransferStatus, SharedResponsibilityStatus } from '@prisma/client';
import { SharedEquipmentService } from './shared-equipment.service';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('SharedEquipmentService', () => {
  let service: SharedEquipmentService;
  let prisma: jest.Mocked<any>;
  let redis: jest.Mocked<any>;
  let notifications: jest.Mocked<any>;

  beforeEach(async () => {
    const mockPrisma = {
      groupActivity: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      sharedItem: {
        create: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ groupActivity: { group: { members: [{ id: 'member-1' }] } } }),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      sharedResponsibility: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    const mockNotifications = {
      createNotificationsBatch: jest.fn().mockResolvedValue({ count: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharedEquipmentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<SharedEquipmentService>(SharedEquipmentService);
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
    notifications = module.get(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createActivity', () => {
    it('should create a group activity', async () => {
      const expected = {
        id: 'act-1',
        groupId: 'grp-1',
        name: 'Training',
        activityType: 'TRAINING',
        createdById: 'user-1',
      };
      prisma.groupActivity.create.mockResolvedValue(expected);

      const result = await service.createActivity('grp-1', 'user-1', {
        name: 'Training',
        activityType: 'TRAINING' as any,
      });

      expect(result).toEqual(expected);
    });
  });

  describe('getActivity', () => {
    it('should throw NotFoundException if activity not found', async () => {
      prisma.groupActivity.findUnique.mockResolvedValue(null);

      await expect(service.getActivity('grp-1', 'act-999')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if activity belongs to different group', async () => {
      prisma.groupActivity.findUnique.mockResolvedValue({
        id: 'act-1',
        groupId: 'grp-other',
      });

      await expect(service.getActivity('grp-1', 'act-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('claimResponsibility', () => {
    it('should claim responsibility within transaction', async () => {
      const mockItem = {
        id: 'item-1',
        requiredQuantity: 3,
        responsibilities: [],
      };

      const expected = {
        id: 'resp-1',
        sharedItemId: 'item-1',
        userId: 'user-1',
        committedQuantity: 2,
        status: SharedResponsibilityStatus.COMMITTED,
      };

      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          sharedItem: { findUnique: jest.fn().mockResolvedValue(mockItem) },
          sharedResponsibility: { create: jest.fn().mockResolvedValue(expected) },
        };
        return fn(tx);
      });

      const result = await service.claimResponsibility('item-1', 'user-1', {
        quantity: 2,
      });

      expect(result).toEqual(expected);
    });

    it('should throw ALREADY_CLAIMED if user has active claim', async () => {
      const mockItem = {
        id: 'item-1',
        requiredQuantity: 3,
        responsibilities: [
          {
            userId: 'user-1',
            committedQuantity: 1,
            status: SharedResponsibilityStatus.COMMITTED,
          },
        ],
      };

      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          sharedItem: { findUnique: jest.fn().mockResolvedValue(mockItem) },
        };
        return fn(tx);
      });

      await expect(
        service.claimResponsibility('item-1', 'user-1', { quantity: 1 }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw SHARED_ITEM_ALREADY_COVERED if claim exceeds required', async () => {
      const mockItem = {
        id: 'item-1',
        requiredQuantity: 2,
        responsibilities: [
          {
            userId: 'user-2',
            committedQuantity: 2,
            status: SharedResponsibilityStatus.COMMITTED,
          },
        ],
      };

      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          sharedItem: { findUnique: jest.fn().mockResolvedValue(mockItem) },
        };
        return fn(tx);
      });

      await expect(
        service.claimResponsibility('item-1', 'user-1', { quantity: 1 }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw SHARED_ITEM_NOT_FOUND if item does not exist', async () => {
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          sharedItem: { findUnique: jest.fn().mockResolvedValue(null) },
        };
        return fn(tx);
      });

      await expect(
        service.claimResponsibility('item-999', 'user-1', { quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('releaseResponsibility', () => {
    it('should release a committed responsibility', async () => {
      const mockResp = {
        id: 'resp-1',
        sharedItemId: 'item-1',
        userId: 'user-1',
        status: SharedResponsibilityStatus.COMMITTED,
      };

      const expected = { ...mockResp, status: SharedResponsibilityStatus.RELEASED };

      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          sharedResponsibility: {
            findUnique: jest.fn().mockResolvedValue(mockResp),
            update: jest.fn().mockResolvedValue(expected),
          },
        };
        return fn(tx);
      });

      const result = await service.releaseResponsibility('item-1', 'user-1');
      expect(result.status).toBe(SharedResponsibilityStatus.RELEASED);
    });

    it('should throw CANNOT_RELEASE_PACKED if status is PACKED', async () => {
      const mockResp = {
        id: 'resp-1',
        sharedItemId: 'item-1',
        userId: 'user-1',
        status: SharedResponsibilityStatus.PACKED,
      };

      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          sharedResponsibility: {
            findUnique: jest.fn().mockResolvedValue(mockResp),
          },
        };
        return fn(tx);
      });

      await expect(service.releaseResponsibility('item-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw RESPONSIBILITY_NOT_FOUND if no responsibility exists', async () => {
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          sharedResponsibility: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return fn(tx);
      });

      await expect(service.releaseResponsibility('item-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('takeOver', () => {
    it('should take over a missing responsibility', async () => {
      const mockItem = {
        id: 'item-1',
        requiredQuantity: 2,
        responsibilities: [
          {
            id: 'resp-1',
            userId: 'user-2',
            committedQuantity: 1,
            status: SharedResponsibilityStatus.FORGOT,
          },
        ],
      };

      const expected = {
        id: 'resp-new',
        sharedItemId: 'item-1',
        userId: 'user-1',
        committedQuantity: 1,
        status: SharedResponsibilityStatus.COMMITTED,
      };

      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          sharedItem: { findUnique: jest.fn().mockResolvedValue(mockItem) },
          sharedResponsibility: {
            update: jest.fn().mockResolvedValue({
              ...mockItem.responsibilities[0],
              status: SharedResponsibilityStatus.REPLACEMENT_ARRANGED,
            }),
            create: jest.fn().mockResolvedValue(expected),
          },
        };
        return fn(tx);
      });

      const result = await service.takeOver('item-1', 'user-1', { quantity: 1 });
      expect(result.status).toBe(SharedResponsibilityStatus.COMMITTED);
    });

    it('should throw CANNOT_TAKE_OVER_COVERED if no missing responsibilities', async () => {
      const mockItem = {
        id: 'item-1',
        requiredQuantity: 2,
        responsibilities: [
          {
            id: 'resp-1',
            userId: 'user-2',
            committedQuantity: 2,
            status: SharedResponsibilityStatus.COMMITTED,
          },
        ],
      };

      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          sharedItem: { findUnique: jest.fn().mockResolvedValue(mockItem) },
        };
        return fn(tx);
      });

      await expect(service.takeOver('item-1', 'user-1', { quantity: 1 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should add the takeover quantity to an existing active responsibility', async () => {
      const mockItem = {
        id: 'item-1',
        requiredQuantity: 2,
        responsibilities: [
          {
            id: 'resp-1',
            userId: 'user-2',
            committedQuantity: 1,
            status: SharedResponsibilityStatus.FORGOT,
          },
          {
            id: 'resp-2',
            userId: 'user-1',
            committedQuantity: 1,
            status: SharedResponsibilityStatus.COMMITTED,
          },
        ],
      };

      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          sharedItem: { findUnique: jest.fn().mockResolvedValue(mockItem) },
          sharedResponsibility: {
            update: jest
              .fn()
              .mockResolvedValueOnce({
                ...mockItem.responsibilities[0],
                status: SharedResponsibilityStatus.REPLACEMENT_ARRANGED,
              })
              .mockResolvedValueOnce({
                ...mockItem.responsibilities[1],
                committedQuantity: 2,
                status: SharedResponsibilityStatus.COMMITTED,
              }),
          },
        };
        return fn(tx);
      });

      const result = await service.takeOver('item-1', 'user-1', { quantity: 1 });
      expect(result.committedQuantity).toBe(2);
      expect(result.status).toBe(SharedResponsibilityStatus.COMMITTED);
    });
  });

  describe('cache invalidation', () => {
    const ACTIVITY_ID = 'act-cache-1';
    const ITEM_CACHE_KEY = `shared-items:activity:${ACTIVITY_ID}`;
    const READINESS_CACHE_KEY = `readiness:activity:${ACTIVITY_ID}`;

    it('invalidates shared-items and readiness cache after claimResponsibility', async () => {
      prisma.sharedItem.findUnique.mockResolvedValue({ groupActivityId: ACTIVITY_ID, groupActivity: { group: { members: [{ id: 'member-1' }] } } });

      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          sharedItem: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'item-1',
              requiredQuantity: 2,
              responsibilities: [],
            }),
          },
          sharedResponsibility: {
            create: jest
              .fn()
              .mockResolvedValue({ id: 'resp-1', status: SharedResponsibilityStatus.COMMITTED }),
          },
        };
        return fn(tx);
      });

      await service.claimResponsibility('item-1', 'user-1', { quantity: 1 });

      expect(redis.del).toHaveBeenCalledWith(ITEM_CACHE_KEY);
      expect(redis.del).toHaveBeenCalledWith(READINESS_CACHE_KEY);
    });

    it('invalidates cache after releaseResponsibility', async () => {
      prisma.sharedItem.findUnique.mockResolvedValue({ groupActivityId: ACTIVITY_ID, groupActivity: { group: { members: [{ id: 'member-1' }] } } });

      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          sharedResponsibility: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'resp-1',
              status: SharedResponsibilityStatus.COMMITTED,
            }),
            update: jest.fn().mockResolvedValue({
              id: 'resp-1',
              status: SharedResponsibilityStatus.RELEASED,
            }),
          },
        };
        return fn(tx);
      });

      await service.releaseResponsibility('item-1', 'user-1');

      expect(redis.del).toHaveBeenCalledWith(ITEM_CACHE_KEY);
      expect(redis.del).toHaveBeenCalledWith(READINESS_CACHE_KEY);
    });

    it('invalidates shared-items and readiness cache after takeOver', async () => {
      prisma.sharedItem.findUnique.mockResolvedValue({ groupActivityId: ACTIVITY_ID, groupActivity: { group: { members: [{ id: 'member-1' }] } } });

      prisma.$transaction.mockImplementation(async (fn: any) => {
        const missingResponsibility = {
          id: 'resp-missing',
          userId: 'user-2',
          committedQuantity: 1,
          status: SharedResponsibilityStatus.COULD_NOT_BRING,
        };
        const tx = {
          sharedItem: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'item-1',
              requiredQuantity: 1,
              responsibilities: [missingResponsibility],
            }),
          },
          sharedResponsibility: {
            update: jest.fn().mockResolvedValue(missingResponsibility),
            create: jest.fn().mockResolvedValue({
              id: 'resp-takeover',
              status: SharedResponsibilityStatus.COMMITTED,
            }),
          },
        };
        return fn(tx);
      });

      await service.takeOver('item-1', 'user-1', { quantity: 1 });

      expect(redis.del).toHaveBeenCalledWith(ITEM_CACHE_KEY);
      expect(redis.del).toHaveBeenCalledWith(READINESS_CACHE_KEY);
    });

    it('does NOT invalidate cache when claimResponsibility throws', async () => {
      prisma.sharedItem.findUnique.mockResolvedValue({ groupActivityId: ACTIVITY_ID, groupActivity: { group: { members: [{ id: 'member-1' }] } } });

      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          sharedItem: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return fn(tx);
      });

      await expect(
        service.claimResponsibility('item-999', 'user-1', { quantity: 1 }),
      ).rejects.toThrow(NotFoundException);

      expect(redis.del).not.toHaveBeenCalledWith(ITEM_CACHE_KEY);
    });
  });

  describe('transferResponsibility', () => {
    it('should throw RESPONSIBILITY_NOT_FOUND if no responsibility exists', async () => {
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          sharedResponsibility: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return fn(tx);
      });

      await expect(
        service.transferResponsibility('item-1', 'user-1', {
          targetUserId: 'user-2',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw TRANSFER_TARGET_NOT_MEMBER if target is not a group member', async () => {
      const mockResp = {
        id: 'resp-1',
        sharedItemId: 'item-1',
        userId: 'user-1',
        committedQuantity: 1,
        status: SharedResponsibilityStatus.COMMITTED,
      };

      const mockItem = {
        id: 'item-1',
        groupActivity: {
          group: {
            members: [{ userId: 'user-1' }],
          },
        },
      };

      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          sharedResponsibility: {
            findUnique: jest.fn().mockResolvedValue(mockResp),
          },
          sharedItem: { findUnique: jest.fn().mockResolvedValue(mockItem) },
        };
        return fn(tx);
      });

      await expect(
        service.transferResponsibility('item-1', 'user-1', {
          targetUserId: 'user-external',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should keep the source assignment active until the target accepts', async () => {
      const source = { id: 'resp-1', committedQuantity: 2, status: SharedResponsibilityStatus.COMMITTED };
      const created = { id: 'transfer-1', status: ResponsibilityTransferStatus.PENDING };
      const updateMany = jest.fn().mockResolvedValue({ count: 0 });
      const create = jest.fn().mockResolvedValue(created);
      const updateSource = jest.fn();
      prisma.$transaction.mockImplementation((fn: any) => fn({
        sharedResponsibility: {
          findUnique: jest.fn().mockResolvedValueOnce(source).mockResolvedValueOnce(null),
          update: updateSource,
        },
        sharedItem: { findUnique: jest.fn().mockResolvedValue({ groupActivity: { group: { members: [{ userId: 'user-2' }] } } }) },
        responsibilityTransfer: { updateMany, create },
      }));

      const result = await service.transferResponsibility('item-1', 'user-1', { targetUserId: 'user-2', quantity: 1 });

      expect(result).toEqual(created);
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fromUserId: 'user-1', toUserId: 'user-2' }) }));
      expect(updateSource).not.toHaveBeenCalled();
    });
  });

  describe('acceptTransfer security', () => {
    it('does not reveal or accept a transfer addressed to another user', async () => {
      prisma.$transaction.mockImplementation((fn: any) => fn({
        responsibilityTransfer: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'transfer-1', sharedItemId: 'item-1', fromUserId: 'user-1', toUserId: 'user-2', quantity: 1, status: ResponsibilityTransferStatus.PENDING,
          }),
        },
      }));

      await expect(service.acceptTransfer('item-1', 'transfer-1', 'attacker')).rejects.toThrow(NotFoundException);
    });
  });
});
