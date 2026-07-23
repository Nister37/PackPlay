import { Test } from '@nestjs/testing';
import { PrismaService } from '../common/prisma.service';
import { PreparationTemplatesService } from './preparation-templates.service';

describe('PreparationTemplatesService', () => {
  let service: PreparationTemplatesService;
  const prisma = {
    groupActivity: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    preparationTemplate: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    preparationTemplateVersion: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        PreparationTemplatesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(PreparationTemplatesService);
  });

  it('captures shared requirements and roles in the first template version', async () => {
    prisma.groupActivity.findUnique.mockResolvedValue({
      id: 'event-1',
      groupId: 'group-1',
      activityType: 'TRAINING',
      sportProfileId: null,
      description: null,
      venueName: 'Pitch',
      environment: 'OUTDOOR',
      surface: 'GRASS',
      date: new Date('2026-08-01T10:00:00Z'),
      endAt: new Date('2026-08-01T12:00:00Z'),
      responsibilityDeadline: new Date('2026-08-01T08:00:00Z'),
      sharedItems: [
        {
          name: 'Ball',
          requiredQuantity: 2,
          category: 'balls',
          isMandatory: true,
          notes: null,
        },
      ],
      roles: [{ name: 'Goalkeeper', requirements: [{ name: 'Gloves' }] }],
    });
    prisma.preparationTemplate.create.mockResolvedValue({ id: 'template-1' });

    await service.createFromEvent('group-1', 'event-1', 'user-1', {
      name: 'Weekly training',
    });

    expect(prisma.preparationTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          versions: {
            create: expect.objectContaining({
              version: 1,
              snapshot: expect.objectContaining({
                durationMinutes: 120,
                deadlineOffsetMinutes: 120,
                sharedItems: [expect.objectContaining({ name: 'Ball' })],
                roles: [expect.objectContaining({ name: 'Goalkeeper' })],
              }),
            }),
          },
        }),
      }),
    );
  });

  it('creates an independent draft from the selected template version', async () => {
    prisma.preparationTemplate.findUnique.mockResolvedValue({
      id: 'template-1',
      groupId: 'group-1',
      versions: [
        {
          version: 2,
          snapshot: {
            activityType: 'TRAINING',
            sportProfileId: null,
            description: null,
            venueName: 'Pitch',
            environment: 'OUTDOOR',
            surface: 'GRASS',
            durationMinutes: 60,
            deadlineOffsetMinutes: 30,
            sharedItems: [{ name: 'Ball', requiredQuantity: 2, isMandatory: true }],
            roles: [{ name: 'Coach', requirements: [] }],
          },
        },
      ],
    });
    prisma.groupActivity.create.mockResolvedValue({ id: 'event-2' });

    await service.createEvent('group-1', 'template-1', 'user-1', {
      name: 'Tuesday training',
      date: '2026-08-04T18:00:00Z',
    });

    expect(prisma.groupActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Tuesday training',
          status: 'DRAFT',
          sharedItems: { create: [expect.objectContaining({ name: 'Ball' })] },
          roles: { create: [expect.objectContaining({ name: 'Coach' })] },
        }),
      }),
    );
  });
});
