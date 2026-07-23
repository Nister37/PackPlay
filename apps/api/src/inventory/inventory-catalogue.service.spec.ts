import { Test } from '@nestjs/testing';
import { PrismaService } from '../common/prisma.service';
import { InventoryCatalogueService } from './inventory-catalogue.service';

describe('InventoryCatalogueService', () => {
  let service: InventoryCatalogueService;
  const prisma = {
    inventoryItem: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        InventoryCatalogueService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(InventoryCatalogueService);
  });

  it('excludes damaged and retired batch quantities from availability', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue({
      id: 'item-1',
      groupId: 'group-1',
      trackingType: 'BATCH',
      batches: [
        { availableQuantity: 4, condition: 'GOOD' },
        { availableQuantity: 3, condition: 'DAMAGED' },
        { availableQuantity: 2, condition: 'RETIRED' },
      ],
      assets: [],
    });

    const result = await service.getItem('group-1', 'item-1');

    expect(result.availableQuantity).toBe(4);
  });

  it('treats an asset with an unknown holder as unavailable when checked out', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue({
      id: 'item-1',
      groupId: 'group-1',
      trackingType: 'ASSET',
      batches: [],
      assets: [
        { condition: 'GOOD', holderId: null },
        { condition: 'GOOD', holderId: 'user-1' },
        { condition: 'DAMAGED', holderId: null },
      ],
    });

    const result = await service.getItem('group-1', 'item-1');

    expect(result.availableQuantity).toBe(1);
  });
});
