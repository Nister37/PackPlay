import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { PrismaService } from '../common/prisma.service';
import { hashToken } from '../auth/token.util';

describe('InvitationsService', () => {
  let service: InvitationsService;
  let prisma: jest.Mocked<any>;

  beforeEach(async () => {
    const mockPrisma = {
      groupInvitation: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      groupMember: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<InvitationsService>(InvitationsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createInvitation', () => {
    it('should generate a token and store its hash', async () => {
      prisma.groupInvitation.create.mockResolvedValue({
        id: 'inv-1',
        expiresAt: new Date('2026-07-14'),
        maxUses: null,
      });

      const result = await service.createInvitation('group-1', 'user-1', {});

      expect(result.token).toBeDefined();
      expect(result.token.length).toBe(64); // 32 bytes hex = 64 chars
      expect(result.id).toBe('inv-1');

      // Verify the hash was stored, not the raw token
      const createCall = prisma.groupInvitation.create.mock.calls[0][0];
      expect(createCall.data.tokenHash).not.toBe(result.token);
      expect(createCall.data.tokenHash).toBe(hashToken(result.token));
    });

    it('should use custom expiresInHours', async () => {
      prisma.groupInvitation.create.mockResolvedValue({
        id: 'inv-1',
        expiresAt: new Date('2026-07-13'),
        maxUses: 5,
      });

      const result = await service.createInvitation('group-1', 'user-1', {
        expiresInHours: 24,
        maxUses: 5,
      });

      const createCall = prisma.groupInvitation.create.mock.calls[0][0];
      expect(createCall.data.maxUses).toBe(5);
      expect(result.maxUses).toBe(5);
    });
  });

  describe('getInvitationInfo', () => {
    it('should throw NotFoundException for invalid token', async () => {
      prisma.groupInvitation.findUnique.mockResolvedValue(null);

      await expect(service.getInvitationInfo('invalid-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for revoked invitation', async () => {
      prisma.groupInvitation.findUnique.mockResolvedValue({
        revokedAt: new Date(),
        expiresAt: new Date('2099-01-01'),
        maxUses: null,
        useCount: 0,
        group: { name: 'Test', sportType: 'football', _count: { members: 3 } },
      });

      await expect(service.getInvitationInfo('some-token')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException for expired invitation', async () => {
      prisma.groupInvitation.findUnique.mockResolvedValue({
        revokedAt: null,
        expiresAt: new Date('2020-01-01'),
        maxUses: null,
        useCount: 0,
        group: { name: 'Test', sportType: 'football', _count: { members: 3 } },
      });

      await expect(service.getInvitationInfo('some-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when max uses reached', async () => {
      prisma.groupInvitation.findUnique.mockResolvedValue({
        revokedAt: null,
        expiresAt: new Date('2099-01-01'),
        maxUses: 5,
        useCount: 5,
        group: { name: 'Test', sportType: 'football', _count: { members: 3 } },
      });

      await expect(service.getInvitationInfo('some-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return group info for valid invitation', async () => {
      prisma.groupInvitation.findUnique.mockResolvedValue({
        revokedAt: null,
        expiresAt: new Date('2099-01-01'),
        maxUses: null,
        useCount: 0,
        group: { name: 'Sunday Football', sportType: 'football', _count: { members: 7 } },
      });

      const result = await service.getInvitationInfo('valid-token');

      expect(result).toEqual({
        groupName: 'Sunday Football',
        sportType: 'football',
        memberCount: 7,
      });
    });
  });

  describe('joinGroup', () => {
    it('should throw ConflictException if already a member', async () => {
      prisma.groupInvitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        groupId: 'g1',
        revokedAt: null,
        expiresAt: new Date('2099-01-01'),
        maxUses: null,
        useCount: 0,
        group: { id: 'g1' },
      });
      prisma.groupMember.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.joinGroup('token', 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create membership and increment use count', async () => {
      prisma.groupInvitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        groupId: 'g1',
        revokedAt: null,
        expiresAt: new Date('2099-01-01'),
        maxUses: null,
        useCount: 0,
        group: { id: 'g1' },
      });
      prisma.groupMember.findUnique.mockResolvedValue(null);

      const newMember = { id: 'member-1', groupId: 'g1', userId: 'user-1', role: 'MEMBER' };
      prisma.$transaction.mockResolvedValue([newMember, {}]);

      const result = await service.joinGroup('token', 'user-1');

      expect(result).toEqual(newMember);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('revokeInvitation', () => {
    it('should throw NotFoundException if invitation not found', async () => {
      prisma.groupInvitation.findUnique.mockResolvedValue(null);

      await expect(
        service.revokeInvitation('g1', 'inv-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should set revokedAt timestamp', async () => {
      prisma.groupInvitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        groupId: 'g1',
      });
      prisma.groupInvitation.update.mockResolvedValue({});

      await service.revokeInvitation('g1', 'inv-1');

      expect(prisma.groupInvitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('listActiveInvitations', () => {
    it('should return only non-revoked, non-expired invitations', async () => {
      const invitations = [{ id: 'inv-1' }];
      prisma.groupInvitation.findMany.mockResolvedValue(invitations);

      const result = await service.listActiveInvitations('g1');

      expect(result).toEqual(invitations);
      const queryArgs = prisma.groupInvitation.findMany.mock.calls[0][0];
      expect(queryArgs.where.revokedAt).toBeNull();
      expect(queryArgs.where.expiresAt).toEqual({ gt: expect.any(Date) });
    });
  });
});
