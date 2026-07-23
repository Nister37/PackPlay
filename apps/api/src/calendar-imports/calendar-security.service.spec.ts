import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalendarSecurityService } from './calendar-security.service';

describe('CalendarSecurityService', () => {
  const service = new CalendarSecurityService({
    get: jest.fn().mockReturnValue('test-calendar-secret'),
  } as unknown as ConfigService);

  it('encrypts feed URLs with authenticated encryption', () => {
    const url = 'https://calendar.example.test/team.ics?private=token';
    const encrypted = service.encryptUrl(url);

    expect(encrypted).not.toContain(url);
    expect(service.decryptUrl(encrypted)).toBe(url);
    expect(service.encryptUrl(url)).not.toBe(encrypted);
  });

  it('produces stable non-reversible URL hashes', () => {
    const url = 'https://calendar.example.test/team.ics';
    expect(service.urlHash(url)).toBe(service.urlHash(url));
    expect(service.urlHash(url)).not.toContain('calendar.example');
  });

  it('rejects insecure URLs before making a request', async () => {
    await expect(service.fetchCalendar('http://127.0.0.1/feed')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects private HTTPS destinations before making a request', async () => {
    await expect(service.fetchCalendar('https://127.0.0.1/feed')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
