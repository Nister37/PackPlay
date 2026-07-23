import { PrismaService } from '../common/prisma.service';
import { CalendarImportsService } from './calendar-imports.service';
import { CalendarParserService } from './calendar-parser.service';
import { CalendarSecurityService } from './calendar-security.service';

describe('CalendarImportsService', () => {
  it('imports a reviewed file as inactive local events', async () => {
    const transaction = {
      calendarImportedEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      groupActivity: {
        create: jest.fn().mockResolvedValue({ id: 'activity-1' }),
      },
    };
    const prisma = {
      calendarFeed: {
        create: jest.fn().mockResolvedValue({
          id: 'feed-1',
          groupId: 'group-1',
          createdById: 'user-1',
        }),
        findFirstOrThrow: jest.fn().mockResolvedValue({
          id: 'feed-1',
          active: false,
        }),
      },
      $transaction: jest.fn((callback: (client: typeof transaction) => Promise<void>) =>
        callback(transaction),
      ),
    };
    const parser = {
      parse: jest.fn().mockReturnValue([
        {
          uid: 'event-1',
          recurrenceId: '',
          title: 'Training',
          startsAt: new Date('2026-08-01T10:00:00Z'),
          sequence: 0,
          cancelled: false,
          sourceHash: 'source-hash',
        },
      ]),
    };
    const security = {
      encryptUrl: jest.fn().mockReturnValue('encrypted-marker'),
      urlHash: jest.fn().mockReturnValue('unique-upload-hash'),
    };
    const service = new CalendarImportsService(
      prisma as unknown as PrismaService,
      parser as unknown as CalendarParserService,
      security as unknown as CalendarSecurityService,
    );

    const result = await service.importFile(
      'group-1',
      'user-1',
      'Autumn schedule',
      'BEGIN:VCALENDAR...',
    );

    expect(prisma.calendarFeed.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        groupId: 'group-1',
        active: false,
        name: 'Autumn schedule',
      }),
    });
    expect(transaction.groupActivity.create).toHaveBeenCalled();
    expect(result).toMatchObject({ created: 1, total: 1 });
  });
});
