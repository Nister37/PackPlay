import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../common/prisma.service';
import { InventoryOperationsService } from './inventory-operations.service';

describe('InventoryOperationsService', () => {
  let service: InventoryOperationsService;
  const tx = {
    inventoryBatch: {
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    inventoryAsset: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    inventoryReservation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    inventoryMovement: { create: jest.fn() },
    inventoryCustody: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    inventoryDamageReport: { create: jest.fn() },
    groupMember: { findUnique: jest.fn() },
  };
  const prisma = {
    sharedItem: { findUnique: jest.fn() },
    groupMember: { findUnique: jest.fn() },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        InventoryOperationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(InventoryOperationsService);
    prisma.sharedItem.findUnique.mockResolvedValue({
      groupActivity: { groupId: 'group-1' },
    });
  });

  it('atomically decrements batch availability when reserving stock', async () => {
    tx.inventoryBatch.updateMany.mockResolvedValue({ count: 1 });
    tx.inventoryReservation.create.mockResolvedValue({
      id: 'reservation-1',
      quantity: 2,
    });
    tx.inventoryMovement.create.mockResolvedValue({});

    await service.reserve('group-1', 'user-1', {
      sharedItemId: 'shared-1',
      batchId: 'batch-1',
      quantity: 2,
    });

    expect(tx.inventoryBatch.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ availableQuantity: { gte: 2 } }),
        data: { availableQuantity: { decrement: 2 } },
      }),
    );
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'RESERVATION', quantity: 2 }),
      }),
    );
  });

  it('rejects a concurrent reservation after availability is exhausted', async () => {
    tx.inventoryBatch.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.reserve('group-1', 'user-1', {
        sharedItemId: 'shared-1',
        batchId: 'batch-1',
        quantity: 2,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.inventoryReservation.create).not.toHaveBeenCalled();
  });

  it('allows only a holder or organizer to return custody', async () => {
    tx.inventoryCustody.findUnique.mockResolvedValue({
      id: 'custody-1',
      holderId: 'holder-1',
      returnedAt: null,
      quantity: 1,
      batchId: 'batch-1',
      assetId: null,
      activityId: null,
      batch: { inventoryItem: { groupId: 'group-1' } },
      asset: null,
    });
    tx.groupMember.findUnique.mockResolvedValue({ role: 'MEMBER' });

    await expect(
      service.returnCustody('group-1', 'custody-1', 'other-user', {}),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(tx.inventoryBatch.update).not.toHaveBeenCalled();
  });
});
