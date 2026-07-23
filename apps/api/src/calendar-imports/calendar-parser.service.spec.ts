import { BadRequestException } from '@nestjs/common';
import { CalendarParserService } from './calendar-parser.service';

describe('CalendarParserService', () => {
  const service = new CalendarParserService();

  it('unfolds and unescapes event fields', () => {
    const [event] = service.parse(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:event-1
SUMMARY:Team\\, training
DESCRIPTION:Bring boots\\nAnd water
LOCATION:North\\; pitch
DTSTART:20260724T180000Z
DTEND:20260724T193000Z
SEQUENCE:2
END:VEVENT
END:VCALENDAR`);

    expect(event).toMatchObject({
      uid: 'event-1',
      title: 'Team, training',
      description: 'Bring boots\nAnd water',
      location: 'North; pitch',
      sequence: 2,
      recurrenceId: '',
      cancelled: false,
    });
    expect(event.startsAt.toISOString()).toBe('2026-07-24T18:00:00.000Z');
  });

  it('expands weekly recurrence and honors exclusions and overrides', () => {
    const events = service.parse(
      `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:series-1
SUMMARY:Practice
DTSTART:20260720T180000Z
DTEND:20260720T190000Z
RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4
EXDATE:20260722T180000Z
END:VEVENT
BEGIN:VEVENT
UID:series-1
RECURRENCE-ID:20260727T180000Z
SUMMARY:Moved practice
DTSTART:20260727T190000Z
DTEND:20260727T200000Z
SEQUENCE:3
END:VEVENT
END:VCALENDAR`,
      new Date('2026-07-01T00:00:00Z'),
    );

    expect(events).toHaveLength(4);
    expect(events.map((event) => event.title)).toContain('Moved practice');
    expect(events.map((event) => event.recurrenceId)).not.toContain('2026-07-22T18:00:00.000Z');
  });

  it('preserves cancelled recurrence overrides', () => {
    const events = service.parse(
      `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:series-2
SUMMARY:Match
DTSTART:20260801T100000Z
RRULE:FREQ=DAILY;COUNT=2
END:VEVENT
BEGIN:VEVENT
UID:series-2
RECURRENCE-ID:20260802T100000Z
SUMMARY:Match
DTSTART:20260802T100000Z
STATUS:CANCELLED
END:VEVENT
END:VCALENDAR`,
      new Date('2026-07-01T00:00:00Z'),
    );

    expect(events).toHaveLength(2);
    expect(events[1].cancelled).toBe(true);
  });

  it('rejects malformed documents', () => {
    expect(() => service.parse('not a calendar')).toThrow(BadRequestException);
  });
});
