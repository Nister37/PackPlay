import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PackingGateway } from './packing.gateway';
import { PrismaService } from '../common/prisma.service';
import { Server } from 'socket.io';

describe('PackingGateway', () => {
  let gateway: PackingGateway;
  let jwtService: any;
  let prisma: any;
  let mockServer: any;

  beforeEach(async () => {
    jwtService = {
      verify: jest.fn(),
    };

    prisma = {
      groupActivity: { findUnique: jest.fn() },
      groupMember: { findUnique: jest.fn(), findFirst: jest.fn() },
      session: { findFirst: jest.fn().mockResolvedValue({ id: 'session-1' }) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PackingGateway,
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test-secret') } },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    gateway = module.get<PackingGateway>(PackingGateway);

    // Mock the server
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      sockets: { sockets: new Map() },
    };
    gateway.server = mockServer as unknown as Server;
  });

  describe('handleConnection', () => {
    it('should authenticate client with valid token', async () => {
      const mockClient = {
        handshake: {
          headers: { authorization: 'Bearer valid-token' },
          auth: {},
        },
        data: {} as any,
        disconnect: jest.fn(),
      };

      jwtService.verify.mockReturnValue({
        sub: 'user-1',
        email: 'test@test.com',
        sid: 'session-1',
      });

      await gateway.handleConnection(mockClient as any);
      expect(mockClient.data.userId).toBe('user-1');
      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });

    it('should disconnect client with invalid token', async () => {
      const mockClient = {
        handshake: {
          headers: { authorization: 'Bearer invalid-token' },
          auth: {},
        },
        data: {} as any,
        disconnect: jest.fn(),
      };

      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await gateway.handleConnection(mockClient as any);
      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('should disconnect client without token', async () => {
      const mockClient = {
        handshake: { headers: {}, auth: {} },
        data: {} as any,
        disconnect: jest.fn(),
      };

      await gateway.handleConnection(mockClient as any);
      expect(mockClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleJoinActivity', () => {
    it('should allow member to join activity room', async () => {
      const mockClient = {
        data: { userId: 'user-1' },
        join: jest.fn(),
      };

      prisma.groupMember.findFirst.mockResolvedValue({ id: 'membership-1' });

      await gateway.handleJoinActivity(mockClient as any, { activityId: 'activity-1' });
      expect(mockClient.join).toHaveBeenCalledWith('activity:activity-1');
    });

    it('should not allow non-member to join activity room', async () => {
      const mockClient = {
        data: { userId: 'user-1' },
        join: jest.fn(),
      };

      prisma.groupMember.findFirst.mockResolvedValue(null);

      await gateway.handleJoinActivity(mockClient as any, { activityId: 'activity-1' });
      expect(mockClient.join).not.toHaveBeenCalled();
    });
  });

  describe('handleJoinGroup', () => {
    it('should allow member to join group room', async () => {
      const mockClient = {
        data: { userId: 'user-1' },
        join: jest.fn(),
      };

      prisma.groupMember.findUnique.mockResolvedValue({ userId: 'user-1', groupId: 'group-1' });

      await gateway.handleJoinGroup(mockClient as any, { groupId: 'group-1' });
      expect(mockClient.join).toHaveBeenCalledWith('group:group-1');
    });

    it('should not allow non-member to join group room', async () => {
      const mockClient = {
        data: { userId: 'user-1' },
        join: jest.fn(),
      };

      prisma.groupMember.findUnique.mockResolvedValue(null);

      await gateway.handleJoinGroup(mockClient as any, { groupId: 'group-1' });
      expect(mockClient.join).not.toHaveBeenCalled();
    });
  });

  describe('emitToActivity', () => {
    it('should emit event to the activity room', () => {
      gateway.emitToActivity('activity-1', 'shared-item.packed', {
        sharedItemId: 'item-1',
        activityId: 'activity-1',
      });

      expect(mockServer.to).toHaveBeenCalledWith('activity:activity-1');
      expect(mockServer.emit).toHaveBeenCalledWith('shared-item.packed', {
        sharedItemId: 'item-1',
        activityId: 'activity-1',
      });
    });
  });

  describe('emitToGroup', () => {
    it('should emit event to the group room', () => {
      gateway.emitToGroup('group-1', 'shared-item.claimed', {
        sharedItemId: 'item-1',
        groupId: 'group-1',
      });

      expect(mockServer.to).toHaveBeenCalledWith('group:group-1');
      expect(mockServer.emit).toHaveBeenCalledWith('shared-item.claimed', {
        sharedItemId: 'item-1',
        groupId: 'group-1',
      });
    });
  });
});
