import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { SharedResponsibilityStatus } from '@prisma/client';
import { SharedEquipmentService } from './shared-equipment.service';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

describe('SharedEquipmentService', () => {
  let service: SharedEquipmentService;
  let prisma: jest.Mocked<any>;

  beforeEach(async () => {
    const mockPrisma = {
      groupActivity: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      sharedItem: {
        create: jest.fn(),
        findUnique: jest.fn(),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharedEquipmentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<SharedEquipmentService>(SharedEquipmentService);
    prisma = module.get(PrismaService);
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

      await expect(service.getActivity('grp-1', 'act-999')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if activity belongs to different group', async () => {
      prisma.groupActivity.findUnique.mockResolvedValue({
        id: 'act-1',
        groupId: 'grp-other',
      });

      await expect(service.getActivity('grp-1', 'act-1')).rejects.toThrow(
        NotFoundException,
      );
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

      await expect(
        service.releaseResponsibility('item-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
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

      await expect(
        service.releaseResponsibility('item-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
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

      await expect(
        service.takeOver('item-1', 'user-1', { quantity: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ALREADY_CLAIMED if user already has active responsibility', async () => {
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
        };
        return fn(tx);
      });

      await expect(
        service.takeOver('item-1', 'user-1', { quantity: 1 }),
      ).rejects.toThrow(ConflictException);
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
  });
});
