import { Test } from '@nestjs/testing';
import { PrismaService } from '../common/prisma.service';
import { EventMembersService } from './event-members.service';

describe('EventMembersService', () => {
  let service: EventMembersService;
  const prisma = {
    groupActivity: { findUnique: jest.fn() },
    eventMemberRole: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        EventMembersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(EventMembersService);
  });

  it('removes only the role assignment so existing packing decisions remain intact', async () => {
    prisma.groupActivity.findUnique.mockResolvedValue({
      id: 'event-1',
      groupId: 'group-1',
    });
    prisma.eventMemberRole.findUnique.mockResolvedValue({
      id: 'assignment-1',
      eventRole: { activityId: 'event-1' },
    });

    await service.removeRole('group-1', 'event-1', 'role-1', 'user-1');

    expect(prisma.eventMemberRole.delete).toHaveBeenCalledWith({
      where: { id: 'assignment-1' },
    });
    expect(Object.keys(prisma)).not.toContain('packingDecision');
  });
});
