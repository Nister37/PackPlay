import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../common/prisma.service';
import { EventRecurrenceService } from './event-recurrence.service';

describe('EventRecurrenceService', () => {
  let service: EventRecurrenceService;
  const prisma = {
    groupActivity: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        EventRecurrenceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(EventRecurrenceService);
  });

  it('rejects recurrence for an event without a start time', async () => {
    prisma.groupActivity.findUnique.mockResolvedValue({
      id: 'event-1',
      groupId: 'group-1',
      date: null,
      recurrenceSeriesId: null,
      sharedItems: [],
      roles: [],
    });

    await expect(
      service.create('group-1', 'event-1', 'user-1', {
        frequency: 'WEEKLY',
        timezone: 'Europe/Warsaw',
        count: 4,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a custom series with no future occurrence', async () => {
    prisma.groupActivity.findUnique.mockResolvedValue({
      id: 'event-1',
      groupId: 'group-1',
      date: new Date('2026-08-10T10:00:00Z'),
      recurrenceSeriesId: null,
      sharedItems: [],
      roles: [],
    });

    await expect(
      service.create('group-1', 'event-1', 'user-1', {
        frequency: 'CUSTOM',
        timezone: 'Europe/Warsaw',
        occurrenceDates: ['2026-08-01T10:00:00Z'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
