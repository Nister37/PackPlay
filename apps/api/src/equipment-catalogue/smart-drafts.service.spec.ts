import { Test } from '@nestjs/testing';
import { PrismaService } from '../common/prisma.service';
import { SmartDraftItemTarget } from './dto';
import { SmartDraftsService } from './smart-drafts.service';

describe('SmartDraftsService', () => {
  let service: SmartDraftsService;
  const tx = {
    sharedItem: { create: jest.fn() },
    equipmentItem: { findFirst: jest.fn(), create: jest.fn() },
    teamEquipmentUsage: { upsert: jest.fn() },
  };
  const prisma = {
    groupActivity: { findFirst: jest.fn() },
    checklist: { findMany: jest.fn() },
    sharedItem: { findMany: jest.fn() },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        SmartDraftsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(SmartDraftsService);
    prisma.groupActivity.findFirst.mockResolvedValue({
      id: 'activity-1',
      groupId: 'group-1',
    });
    prisma.checklist.findMany.mockResolvedValue([]);
    prisma.sharedItem.findMany.mockResolvedValue([]);
  });

  it('persists only the explicitly accepted structured items', async () => {
    tx.sharedItem.create.mockResolvedValue({ id: 'shared-1', name: 'Cones' });

    const result = await service.accept('activity-1', 'user-1', {
      acceptedItems: [
        {
          target: SmartDraftItemTarget.SHARED,
          name: 'Cones',
          quantity: 12,
          reason: 'Warm-up drills',
        },
      ],
    });

    expect(tx.sharedItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Cones',
        requiredQuantity: 12,
        notes: 'Warm-up drills',
      }),
    });
    expect(result.created).toHaveLength(1);
  });

  it('reports case-insensitive duplicates without saving them', async () => {
    prisma.sharedItem.findMany.mockResolvedValue([{ name: 'Match Ball' }]);

    const result = await service.accept('activity-1', 'user-1', {
      acceptedItems: [
        {
          target: SmartDraftItemTarget.SHARED,
          name: '  match   ball ',
        },
      ],
    });

    expect(tx.sharedItem.create).not.toHaveBeenCalled();
    expect(result.duplicates).toEqual([
      expect.objectContaining({ name: '  match   ball ' }),
    ]);
  });
});
