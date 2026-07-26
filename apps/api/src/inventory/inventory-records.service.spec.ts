import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { InventoryRecordsService } from './inventory-records.service';

describe('InventoryRecordsService', () => {
  let service: InventoryRecordsService;
  const prisma = {
    inventoryMovement: { findMany: jest.fn(), count: jest.fn().mockResolvedValue(0) },
    inventoryBatch: { findUnique: jest.fn(), update: jest.fn() },
    inventoryAsset: { findUnique: jest.fn(), update: jest.fn() },
    groupMember: { findUnique: jest.fn() },
  };
  const config = { get: jest.fn((_key: string, fallback: string) => fallback) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        InventoryRecordsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(InventoryRecordsService);
  });

  it('does not reveal QR inventory to a non-member', async () => {
    prisma.inventoryBatch.findUnique.mockResolvedValue({
      id: 'batch-1',
      inventoryItem: { groupId: 'group-1' },
    });
    prisma.groupMember.findUnique.mockResolvedValue(null);

    await expect(service.resolveQr('secret-token', 'outsider')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('exports movement history with safely quoted CSV fields', async () => {
    prisma.inventoryMovement.findMany.mockResolvedValue([
      {
        createdAt: new Date('2026-08-01T10:00:00Z'),
        type: 'RETURN',
        batch: { inventoryItem: { name: 'Balls, match' } },
        asset: null,
        batchId: 'batch-1',
        assetId: null,
        quantity: 2,
        fromHolderId: 'user-1',
        toHolderId: null,
        activityId: 'event-1',
        actor: { id: 'user-1', name: 'Coach "A"' },
      },
    ]);

    const csv = await service.exportCsv('group-1', {});

    expect(csv).toContain('"Balls, match"');
    expect(csv).toContain('"Coach ""A"""');
  });
});
