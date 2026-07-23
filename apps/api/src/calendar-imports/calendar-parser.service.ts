import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { AppErrorCode } from '@packplay/common';

export interface ParsedCalendarEvent {
  uid: string;
  recurrenceId: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: Date;
  endsAt?: Date;
  sequence: number;
  cancelled: boolean;
  sourceHash: string;
}

interface Property {
  name: string;
  parameters: Record<string, string>;
  value: string;
}

@Injectable()
export class CalendarParserService {
  parse(content: string, now = new Date()): ParsedCalendarEvent[] {
    if (!content.includes('BEGIN:VCALENDAR')) {
      this.invalid('Content is not an iCalendar document');
    }
    const blocks = this.unfold(content).match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
    const raw = blocks.map((block) => this.parseBlock(block));
    const overrides = new Map(
      raw
        .filter((event) => event.recurrenceId)
        .map((event) => [`${event.uid}\0${event.recurrenceId}`, event]),
    );
    const result: ParsedCalendarEvent[] = [];
    const horizon = new Date(now);
    horizon.setUTCFullYear(horizon.getUTCFullYear() + 2);

    for (const event of raw) {
      if (event.recurrenceId) continue;
      const occurrences = this.expand(event, horizon);
      for (const occurrence of occurrences) {
        const replacement = overrides.get(
          `${event.uid}\0${occurrence.recurrenceId}`,
        );
        result.push(replacement ?? occurrence);
      }
    }
    for (const event of raw) {
      if (
        event.recurrenceId &&
        !result.some(
          (item) =>
            item.uid === event.uid && item.recurrenceId === event.recurrenceId,
        )
      ) {
        result.push(event);
      }
    }
    return result.sort(
      (left, right) => left.startsAt.getTime() - right.startsAt.getTime(),
    );
  }

  private parseBlock(block: string) {
    const properties = block
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('BEGIN:') && !line.startsWith('END:'))
      .map((line) => this.property(line));
    const get = (name: string) => properties.find((item) => item.name === name);
    const uid = get('UID')?.value.trim();
    const start = get('DTSTART');
    if (!uid || !start) this.invalid('Every calendar event needs UID and DTSTART');
    const startsAt = this.date(start!);
    const end = get('DTEND');
    const recurrence = get('RECURRENCE-ID');
    const title = this.text(get('SUMMARY')?.value ?? 'Imported event').slice(0, 200);
    const sequence = Number.parseInt(get('SEQUENCE')?.value ?? '0', 10);
    const event = {
      uid: uid!.slice(0, 500),
      recurrenceId: recurrence
        ? this.date(recurrence).toISOString()
        : '',
      title,
      description: this.optionalText(get('DESCRIPTION')?.value),
      location: this.optionalText(get('LOCATION')?.value)?.slice(0, 200),
      startsAt,
      endsAt: end ? this.date(end) : undefined,
      sequence: Number.isFinite(sequence) ? Math.max(0, sequence) : 0,
      cancelled: get('STATUS')?.value.toUpperCase() === 'CANCELLED',
      rrule: get('RRULE')?.value,
      exdates: properties
        .filter((item) => item.name === 'EXDATE')
        .flatMap((item) =>
          item.value.split(',').map((value) => this.date({ ...item, value })),
        ),
    };
    return {
      ...event,
      sourceHash: this.hash(event),
    };
  }

  private expand(
    event: ReturnType<CalendarParserService['parseBlock']>,
    horizon: Date,
  ): ParsedCalendarEvent[] {
    if (!event.rrule) return [this.publicEvent(event)];
    const rule = Object.fromEntries(
      event.rrule.split(';').map((part) => {
        const [key, ...value] = part.split('=');
        return [key.toUpperCase(), value.join('=')];
      }),
    );
    const interval = Math.max(1, Number.parseInt(rule.INTERVAL ?? '1', 10) || 1);
    const count = Math.min(1000, Number.parseInt(rule.COUNT ?? '1000', 10) || 1000);
    const until = rule.UNTIL
      ? this.date({ name: 'UNTIL', parameters: {}, value: rule.UNTIL })
      : horizon;
    const limit = new Date(Math.min(until.getTime(), horizon.getTime()));
    const duration = event.endsAt
      ? event.endsAt.getTime() - event.startsAt.getTime()
      : undefined;
    const excluded = new Set(event.exdates.map((date) => date.toISOString()));
    const result: ParsedCalendarEvent[] = [];
    let cursor = new Date(event.startsAt);
    const byDays = (rule.BYDAY ?? '')
      .split(',')
      .map((day) => this.weekday(day))
      .filter((day): day is number => day !== undefined);

    while (result.length < count && cursor <= limit) {
      const elapsedDays = Math.floor(
        (cursor.getTime() - event.startsAt.getTime()) / 86_400_000,
      );
      const include =
        rule.FREQ === 'DAILY'
          ? elapsedDays % interval === 0
          : rule.FREQ === 'WEEKLY'
            ? Math.floor(elapsedDays / 7) % interval === 0 &&
              (byDays.length === 0
                ? cursor.getUTCDay() === event.startsAt.getUTCDay()
                : byDays.includes(cursor.getUTCDay()))
            : result.length === 0;
      if (include && !excluded.has(cursor.toISOString())) {
        const occurrence = {
          ...event,
          startsAt: new Date(cursor),
          endsAt:
            duration === undefined
              ? undefined
              : new Date(cursor.getTime() + duration),
          recurrenceId: cursor.toISOString(),
        };
        result.push(this.publicEvent({ ...occurrence, sourceHash: this.hash(occurrence) }));
      }
      if (!['DAILY', 'WEEKLY'].includes(rule.FREQ)) break;
      cursor = new Date(cursor.getTime() + 86_400_000);
    }
    return result;
  }

  private publicEvent(
    event: ReturnType<CalendarParserService['parseBlock']>,
  ): ParsedCalendarEvent {
    const { rrule: _rule, exdates: _dates, ...value } = event;
    return value;
  }

  private property(line: string): Property {
    const separator = line.indexOf(':');
    if (separator < 1) this.invalid('Calendar contains a malformed property');
    const [name, ...parameterParts] = line.slice(0, separator).split(';');
    return {
      name: name.toUpperCase(),
      parameters: Object.fromEntries(
        parameterParts.map((part) => {
          const [key, ...value] = part.split('=');
          return [key.toUpperCase(), value.join('=').replace(/^"|"$/g, '')];
        }),
      ),
      value: line.slice(separator + 1),
    };
  }

  private date(property: Property): Date {
    const raw = property.value.trim();
    if (/^\d{8}$/.test(raw)) {
      return new Date(
        Date.UTC(+raw.slice(0, 4), +raw.slice(4, 6) - 1, +raw.slice(6, 8)),
      );
    }
    const match = raw.match(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/,
    );
    if (!match) this.invalid(`Unsupported calendar date: ${raw}`);
    const parts = match!.slice(1, 7).map(Number);
    const tentative = Date.UTC(
      parts[0],
      parts[1] - 1,
      parts[2],
      parts[3],
      parts[4],
      parts[5],
    );
    if (match![7] || !property.parameters.TZID) return new Date(tentative);
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: property.parameters.TZID,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      });
      const displayed = Object.fromEntries(
        formatter
          .formatToParts(new Date(tentative))
          .filter((item) => item.type !== 'literal')
          .map((item) => [item.type, Number(item.value)]),
      );
      const offset =
        Date.UTC(
          displayed.year,
          displayed.month - 1,
          displayed.day,
          displayed.hour,
          displayed.minute,
          displayed.second,
        ) - tentative;
      return new Date(tentative - offset);
    } catch {
      this.invalid(`Unsupported calendar timezone: ${property.parameters.TZID}`);
    }
  }

  private unfold(content: string) {
    return content.replace(/\r?\n[ \t]/g, '');
  }

  private text(value: string) {
    return value
      .replace(/\\[nN]/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  }

  private optionalText(value?: string) {
    return value ? this.text(value) : undefined;
  }

  private weekday(value: string) {
    const index = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].indexOf(
      value.slice(-2),
    );
    return index < 0 ? undefined : index;
  }

  private hash(value: object) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private invalid(message: string): never {
    throw new BadRequestException({
      code: AppErrorCode.VALIDATION_ERROR,
      message,
    });
  }
}
