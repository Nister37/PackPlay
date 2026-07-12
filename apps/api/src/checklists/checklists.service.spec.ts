import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChecklistsService } from './checklists.service';
import { PrismaService } from '../common/prisma.service';
import { SportProfilesService } from '../sport-profiles/sport-profiles.service';
import { ActivityTypeDto } from '../sport-profiles/dto';

describe('ChecklistsService', () => {
  let service: ChecklistsService;
  let prisma: jest.Mocked<any>;
  let sportProfilesService: jest.Mocked<any>;

  beforeEach(async () => {
    const mockPrisma = {
      checklist: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const mockSportProfilesService = {
      getById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChecklistsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SportProfilesService, useValue: mockSportProfilesService },
      ],
    }).compile();

    service = module.get<ChecklistsService>(ChecklistsService);
    prisma = module.get(PrismaService);
    sportProfilesService = module.get(SportProfilesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a checklist after verifying profile ownership', async () => {
      const userId = 'user-1';
      const dto = {
        name: 'Match day',
        sportProfileId: 'profile-1',
        activityType: ActivityTypeDto.COMPETITION,
      };
      const expected = { id: 'checklist-1', ...dto, userId };

      sportProfilesService.getById.mockResolvedValue({ id: 'profile-1', userId });
      prisma.checklist.create.mockResolvedValue(expected);

      const result = await service.create(userId, dto);

      expect(sportProfilesService.getById).toHaveBeenCalledWith('profile-1', userId);
      expect(result).toEqual(expected);
    });

    it('should throw if user does not own the sport profile', async () => {
      sportProfilesService.getById.mockRejectedValue(
        new ForbiddenException({ code: 'NOT_PROFILE_OWNER', message: 'Not owner' }),
      );

      await expect(
        service.create('user-1', { name: 'Test', sportProfileId: 'profile-2' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getById', () => {
    it('should return checklist with items when user is owner', async () => {
      const checklist = {
        id: 'cl-1',
        userId: 'user-1',
        sportProfileId: 'sp-1',
        name: 'Test',
        items: [{ id: 'item-1', name: 'Ball', sortOrder: 0 }],
      };
      prisma.checklist.findUnique.mockResolvedValue(checklist);

      const result = await service.getById('cl-1', 'user-1');
      expect(result).toEqual(checklist);
    });

    it('should throw NotFoundException when checklist does not exist', async () => {
      prisma.checklist.findUnique.mockResolvedValue(null);

      await expect(service.getById('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user is not owner', async () => {
      prisma.checklist.findUnique.mockResolvedValue({
        id: 'cl-1',
        userId: 'user-2',
        items: [],
      });

      await expect(service.getById('cl-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('duplicate', () => {
    it('should create a deep copy of checklist with all items', async () => {
      const original = {
        id: 'cl-1',
        userId: 'user-1',
        sportProfileId: 'sp-1',
        name: 'Original',
        activityType: 'TRAINING',
        isTemplate: false,
        items: [
          { id: 'i1', name: 'Ball', quantity: 1, category: 'Sport', isMandatory: true, notes: null, sortOrder: 0 },
          { id: 'i2', name: 'Shoes', quantity: 1, category: 'Footwear', isMandatory: false, notes: 'Size 42', sortOrder: 1 },
        ],
      };
      prisma.checklist.findUnique.mockResolvedValue(original);

      const duplicated = {
        id: 'cl-2',
        userId: 'user-1',
        sportProfileId: 'sp-1',
        name: 'Original (copy)',
        activityType: 'TRAINING',
        isTemplate: false,
        items: [
          { id: 'i3', name: 'Ball', sortOrder: 0 },
          { id: 'i4', name: 'Shoes', sortOrder: 1 },
        ],
      };
      prisma.checklist.create.mockResolvedValue(duplicated);

      const result = await service.duplicate('cl-1', 'user-1');

      expect(result.name).toBe('Original (copy)');
      expect(prisma.checklist.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Original (copy)',
            isTemplate: false,
            items: {
              create: [
                expect.objectContaining({ name: 'Ball', sortOrder: 0 }),
                expect.objectContaining({ name: 'Shoes', sortOrder: 1 }),
              ],
            },
          }),
        }),
      );
    });
  });

  describe('saveAsTemplate', () => {
    it('should set isTemplate to true', async () => {
      const checklist = {
        id: 'cl-1',
        userId: 'user-1',
        name: 'Test',
        items: [],
      };
      prisma.checklist.findUnique.mockResolvedValue(checklist);
      prisma.checklist.update.mockResolvedValue({ ...checklist, isTemplate: true });

      const result = await service.saveAsTemplate('cl-1', 'user-1');

      expect(prisma.checklist.update).toHaveBeenCalledWith({
        where: { id: 'cl-1' },
        data: { isTemplate: true },
      });
      expect(result.isTemplate).toBe(true);
    });
  });
});
