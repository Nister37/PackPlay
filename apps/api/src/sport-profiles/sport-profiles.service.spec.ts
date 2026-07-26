import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../common/prisma.service';
import { SportProfilesService } from './sport-profiles.service';

describe('SportProfilesService', () => {
  let service: SportProfilesService;
  const prisma = {
    sportProfile: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        SportProfilesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(SportProfilesService);
  });

  describe('create', () => {
    it('creates a sport profile for the user', async () => {
      const created = {
        id: 'profile-1',
        userId: 'user-1',
        name: 'Football',
        activityTypes: ['TRAINING', 'COMPETITION'],
        createdAt: new Date(),
      };
      prisma.sportProfile.create.mockResolvedValue(created);

      const result = await service.create('user-1', {
        name: 'Football',
        activityTypes: ['TRAINING', 'COMPETITION'] as any,
      });

      expect(result).toEqual(created);
      expect(prisma.sportProfile.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          name: 'Football',
          activityTypes: ['TRAINING', 'COMPETITION'],
        },
      });
    });
  });

  describe('listByUser', () => {
    it('returns all profiles for the user ordered by creation date', async () => {
      const profiles = [
        { id: 'profile-2', name: 'Basketball', createdAt: new Date() },
        { id: 'profile-1', name: 'Football', createdAt: new Date() },
      ];
      prisma.sportProfile.findMany.mockResolvedValue(profiles);

      const result = await service.listByUser('user-1');

      expect(result).toEqual(profiles);
      expect(prisma.sportProfile.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getById', () => {
    it('returns the profile when it belongs to the user', async () => {
      const profile = { id: 'profile-1', userId: 'user-1', name: 'Football' };
      prisma.sportProfile.findFirst.mockResolvedValue(profile);

      const result = await service.getById('profile-1', 'user-1');

      expect(result).toEqual(profile);
    });

    it('throws NotFoundException when profile does not exist', async () => {
      prisma.sportProfile.findFirst.mockResolvedValue(null);

      await expect(
        service.getById('nonexistent', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates the profile name', async () => {
      const profile = { id: 'profile-1', userId: 'user-1', name: 'Football' };
      prisma.sportProfile.findFirst.mockResolvedValue(profile);
      prisma.sportProfile.update.mockResolvedValue({ ...profile, name: 'Soccer' });

      const result = await service.update('profile-1', 'user-1', { name: 'Soccer' });

      expect(result.name).toBe('Soccer');
      expect(prisma.sportProfile.update).toHaveBeenCalledWith({
        where: { id: 'profile-1' },
        data: { name: 'Soccer' },
      });
    });

    it('throws NotFoundException for another user profile', async () => {
      prisma.sportProfile.findFirst.mockResolvedValue(null);

      await expect(
        service.update('profile-1', 'other-user', { name: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes the profile', async () => {
      const profile = { id: 'profile-1', userId: 'user-1', name: 'Football' };
      prisma.sportProfile.findFirst.mockResolvedValue(profile);
      prisma.sportProfile.delete.mockResolvedValue(profile);

      await service.delete('profile-1', 'user-1');

      expect(prisma.sportProfile.delete).toHaveBeenCalledWith({
        where: { id: 'profile-1' },
      });
    });

    it('throws NotFoundException when deleting another user profile', async () => {
      prisma.sportProfile.findFirst.mockResolvedValue(null);

      await expect(
        service.delete('profile-1', 'other-user'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
