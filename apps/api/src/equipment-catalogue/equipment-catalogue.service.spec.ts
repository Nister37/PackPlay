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
});
