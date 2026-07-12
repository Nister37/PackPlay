import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EquipmentItemsService } from './equipment-items.service';
import { PrismaService } from '../common/prisma.service';
import { ChecklistsService } from '../checklists/checklists.service';

describe('EquipmentItemsService', () => {
  let service: EquipmentItemsService;
  let prisma: jest.Mocked<any>;
  let checklistsService: jest.Mocked<any>;

  beforeEach(async () => {
    const mockPrisma = {
      equipmentItem: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockChecklistsService = {
      getById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipmentItemsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ChecklistsService, useValue: mockChecklistsService },
      ],
    }).compile();

    service = module.get<EquipmentItemsService>(EquipmentItemsService);
    prisma = module.get(PrismaService);
    checklistsService = module.get(ChecklistsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addItem', () => {
    it('should add item with auto-incremented sortOrder', async () => {
      checklistsService.getById.mockResolvedValue({ id: 'cl-1', userId: 'user-1', items: [] });
      prisma.equipmentItem.findFirst.mockResolvedValue({ sortOrder: 2 });

      const expected = { id: 'item-1', name: 'Ball', sortOrder: 3 };
      prisma.equipmentItem.create.mockResolvedValue(expected);

      const result = await service.addItem('cl-1', 'user-1', { name: 'Ball' });

      expect(result.sortOrder).toBe(3);
      expect(prisma.equipmentItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          checklistId: 'cl-1',
          name: 'Ball',
          sortOrder: 3,
        }),
      });
    });

    it('should start with sortOrder 0 when checklist is empty', async () => {
      checklistsService.getById.mockResolvedValue({ id: 'cl-1', userId: 'user-1', items: [] });
      prisma.equipmentItem.findFirst.mockResolvedValue(null);

      prisma.equipmentItem.create.mockResolvedValue({ id: 'item-1', name: 'Ball', sortOrder: 0 });

      await service.addItem('cl-1', 'user-1', { name: 'Ball' });

      expect(prisma.equipmentItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ sortOrder: 0 }),
      });
    });
  });

  describe('updateItem', () => {
    it('should update item fields', async () => {
      checklistsService.getById.mockResolvedValue({ id: 'cl-1', userId: 'user-1', items: [] });
      prisma.equipmentItem.findUnique.mockResolvedValue({
        id: 'item-1',
        checklistId: 'cl-1',
        name: 'Ball',
      });

      const updated = { id: 'item-1', name: 'New Ball', quantity: 2 };
      prisma.equipmentItem.update.mockResolvedValue(updated);

      const result = await service.updateItem('cl-1', 'item-1', 'user-1', {
        name: 'New Ball',
        quantity: 2,
      });

      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException when item does not belong to checklist', async () => {
      checklistsService.getById.mockResolvedValue({ id: 'cl-1', userId: 'user-1', items: [] });
      prisma.equipmentItem.findUnique.mockResolvedValue({
        id: 'item-1',
        checklistId: 'cl-other',
      });

      await expect(
        service.updateItem('cl-1', 'item-1', 'user-1', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when item does not exist', async () => {
      checklistsService.getById.mockResolvedValue({ id: 'cl-1', userId: 'user-1', items: [] });
      prisma.equipmentItem.findUnique.mockResolvedValue(null);

      await expect(
        service.updateItem('cl-1', 'item-999', 'user-1', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorderItems', () => {
    it('should update sort orders in a transaction', async () => {
      checklistsService.getById.mockResolvedValue({ id: 'cl-1', userId: 'user-1', items: [] });

      const reorderDto = {
        items: [
          { id: 'item-1', sortOrder: 1 },
          { id: 'item-2', sortOrder: 0 },
        ],
      };

      prisma.$transaction.mockResolvedValue([]);
      prisma.equipmentItem.findMany.mockResolvedValue([
        { id: 'item-2', sortOrder: 0 },
        { id: 'item-1', sortOrder: 1 },
      ]);

      const result = await service.reorderItems('cl-1', 'user-1', reorderDto);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });
});
