import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GroupMemberRole } from '@prisma/client';
import { GroupsService } from './groups.service';
import { PrismaService } from '../common/prisma.service';
import { GroupMemberRoleDto } from './dto';

describe('GroupsService', () => {
  let service: GroupsService;
  let prisma: jest.Mocked<any>;

  beforeEach(async () => {
    const mockPrisma = {
      group: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      groupMember: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<GroupsService>(GroupsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createGroup', () => {
    it('should create a group and add creator as OWNER', async () => {
      const userId = 'user-1';
      const dto = { name: 'Test Group', sportType: 'football' };
      const expected = {
        id: 'group-1',
        name: 'Test Group',
        sportType: 'football',
        members: [{ userId, role: 'OWNER' }],
      };

      prisma.group.create.mockResolvedValue(expected);

      const result = await service.createGroup(userId, dto);

      expect(result).toEqual(expected);
      expect(prisma.group.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Group',
          description: undefined,
          sportType: 'football',
          members: {
            create: { userId, role: GroupMemberRole.OWNER },
          },
        },
        include: {
          members: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });
    });
  });

  describe('listUserGroups', () => {
    it('should return groups the user is a member of', async () => {
      const memberships = [
        {
          role: 'MEMBER',
          joinedAt: new Date(),
          group: { id: 'g1', name: 'Group 1', _count: { members: 3 } },
        },
      ];
      prisma.groupMember.findMany.mockResolvedValue(memberships);

      const result = await service.listUserGroups('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].memberCount).toBe(3);
      expect(result[0].role).toBe('MEMBER');
    });
  });

  describe('getGroupDetails', () => {
    it('should throw NotFoundException when group does not exist', async () => {
      prisma.group.findUnique.mockResolvedValue(null);

      await expect(service.getGroupDetails('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return group with members', async () => {
      const group = {
        id: 'g1',
        name: 'Group 1',
        members: [{ userId: 'u1', role: 'OWNER' }],
        _count: { members: 1 },
      };
      prisma.group.findUnique.mockResolvedValue(group);

      const result = await service.getGroupDetails('g1');
      expect(result).toEqual(group);
    });
  });

  describe('removeMember', () => {
    it('should throw NotFoundException when member not found', async () => {
      prisma.groupMember.findUnique.mockResolvedValue(null);

      await expect(
        service.removeMember('g1', 'member-1', 'requesting-user'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when trying to remove owner', async () => {
      prisma.groupMember.findUnique.mockResolvedValue({
        id: 'member-1',
        groupId: 'g1',
        role: GroupMemberRole.OWNER,
      });

      await expect(
        service.removeMember('g1', 'member-1', 'requesting-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should remove a member successfully', async () => {
      prisma.groupMember.findUnique.mockResolvedValue({
        id: 'member-1',
        groupId: 'g1',
        role: GroupMemberRole.MEMBER,
      });
      prisma.groupMember.delete.mockResolvedValue({});

      await service.removeMember('g1', 'member-1', 'requesting-user');
      expect(prisma.groupMember.delete).toHaveBeenCalledWith({ where: { id: 'member-1' } });
    });
  });

  describe('updateMemberRole', () => {
    it('should throw ForbiddenException when changing owner role', async () => {
      prisma.groupMember.findUnique.mockResolvedValue({
        id: 'member-1',
        groupId: 'g1',
        role: GroupMemberRole.OWNER,
      });

      await expect(
        service.updateMemberRole('g1', 'member-1', GroupMemberRoleDto.ADMIN),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update member role', async () => {
      prisma.groupMember.findUnique.mockResolvedValue({
        id: 'member-1',
        groupId: 'g1',
        role: GroupMemberRole.MEMBER,
      });
      const updated = { id: 'member-1', role: 'ADMIN' };
      prisma.groupMember.update.mockResolvedValue(updated);

      const result = await service.updateMemberRole('g1', 'member-1', GroupMemberRoleDto.ADMIN);
      expect(result).toEqual(updated);
    });
  });

  describe('leaveGroup', () => {
    it('should throw NotFoundException when not a member', async () => {
      prisma.groupMember.findUnique.mockResolvedValue(null);

      await expect(service.leaveGroup('g1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when sole owner tries to leave', async () => {
      prisma.groupMember.findUnique.mockResolvedValue({
        groupId: 'g1',
        userId: 'user-1',
        role: GroupMemberRole.OWNER,
      });
      prisma.groupMember.count.mockResolvedValue(1);

      await expect(service.leaveGroup('g1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow regular member to leave', async () => {
      prisma.groupMember.findUnique.mockResolvedValue({
        groupId: 'g1',
        userId: 'user-1',
        role: GroupMemberRole.MEMBER,
      });
      prisma.groupMember.delete.mockResolvedValue({});

      await service.leaveGroup('g1', 'user-1');
      expect(prisma.groupMember.delete).toHaveBeenCalledWith({
        where: { groupId_userId: { groupId: 'g1', userId: 'user-1' } },
      });
    });
  });
});
