import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../common/prisma.service';
import { EquipmentCatalogueService } from './equipment-catalogue.service';

describe('EquipmentCatalogueService', () => {
  let service: EquipmentCatalogueService;
  const prisma = {
    equipmentSuggestionPreference: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    equipmentCatalogueItem: { findMany: jest.fn() },
    groupMember: { findUnique: jest.fn() },
    teamEquipmentUsage: { upsert: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        EquipmentCatalogueService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(EquipmentCatalogueService);
    prisma.equipmentSuggestionPreference.findUnique.mockResolvedValue(null);
  });

  it('keeps exact aliases ahead of approximate matches', async () => {
    prisma.equipmentCatalogueItem.findMany.mockResolvedValue([
      {
        id: 'football',
        canonicalName: 'Football',
        category: 'balls',
        sports: ['football'],
        roles: [],
        aliases: [{ alias: 'soccer ball' }],
        teamUsage: [],
      },
      {
        id: 'basketball',
        canonicalName: 'Basketball',
        category: 'balls',
        sports: ['basketball'],
        roles: [],
        aliases: [],
        teamUsage: [],
      },
    ]);

    const result = await service.search('user-1', { query: 'soccer ball' });

    expect(result[0]).toMatchObject({
      id: 'football',
      approximate: false,
      matchedTerm: 'soccer ball',
    });
  });

  it('returns a marked approximate match for a minor misspelling', async () => {
    prisma.equipmentCatalogueItem.findMany.mockResolvedValue([
      {
        id: 'football',
        canonicalName: 'Football',
        category: 'balls',
        sports: ['football'],
        roles: [],
        aliases: [],
        teamUsage: [],
      },
    ]);

    const result = await service.search('user-1', { query: 'fotball' });

    expect(result[0]).toMatchObject({ id: 'football', approximate: true });
  });

  it('does not expose team usage to a non-member', async () => {
    prisma.groupMember.findUnique.mockResolvedValue(null);

    await expect(
      service.search('user-1', {
        query: 'ball',
        groupId: '00000000-0000-4000-8000-000000000001',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.equipmentCatalogueItem.findMany).not.toHaveBeenCalled();
  });

  describe('ItemCreatedEvent subscription', () => {
    it('records team usage when an item with catalogueItemId is created', async () => {
      const { EventBusService } = await import('../common/event-bus.service');
      const { ItemCreatedEvent } = await import('../common/domain-events');
      const eventBus = new EventBusService();

      const module = await Test.createTestingModule({
        providers: [
          EquipmentCatalogueService,
          { provide: PrismaService, useValue: prisma },
          { provide: EventBusService, useValue: eventBus },
        ],
      }).compile();

      const subService = module.get(EquipmentCatalogueService);
      subService.onModuleInit();

      prisma.teamEquipmentUsage.upsert.mockResolvedValue({});

      eventBus.publish(
        new ItemCreatedEvent({
          activityId: 'act-1',
          itemId: 'item-1',
          groupId: 'grp-1',
          catalogueItemId: 'cat-item-1',
          createdById: 'user-1',
        }),
      );

      // Allow microtask to process
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(prisma.teamEquipmentUsage.upsert).toHaveBeenCalledWith({
        where: { groupId_catalogueItemId: { groupId: 'grp-1', catalogueItemId: 'cat-item-1' } },
        create: { groupId: 'grp-1', catalogueItemId: 'cat-item-1', useCount: 1 },
        update: { useCount: { increment: 1 }, lastUsedAt: expect.any(Date) },
      });

      subService.onModuleDestroy();
    });

    it('does not record team usage when catalogueItemId is missing', async () => {
      const { EventBusService } = await import('../common/event-bus.service');
      const { ItemCreatedEvent } = await import('../common/domain-events');
      const eventBus = new EventBusService();

      const module = await Test.createTestingModule({
        providers: [
          EquipmentCatalogueService,
          { provide: PrismaService, useValue: prisma },
          { provide: EventBusService, useValue: eventBus },
        ],
      }).compile();

      const subService = module.get(EquipmentCatalogueService);
      subService.onModuleInit();

      eventBus.publish(
        new ItemCreatedEvent({
          activityId: 'act-1',
          itemId: 'item-1',
          groupId: 'grp-1',
          createdById: 'user-1',
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(prisma.teamEquipmentUsage.upsert).not.toHaveBeenCalled();
      subService.onModuleDestroy();
    });
  });
});

