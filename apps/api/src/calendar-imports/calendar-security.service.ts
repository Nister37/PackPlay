import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { AppErrorCode } from '@packplay/common';

@Injectable()
export class CalendarSecurityService {
  constructor(private readonly config: ConfigService) {}

  encryptUrl(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  decryptUrl(value: string) {
    const [ivValue, tagValue, ciphertextValue] = value.split('.');
    if (!ivValue || !tagValue || !ciphertextValue) {
      throw new BadRequestException('Stored calendar feed is invalid');
    }
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key(),
        Buffer.from(ivValue, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextValue, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new BadRequestException('Stored calendar feed cannot be decrypted');
    }
  }

  urlHash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  async fetchCalendar(value: string): Promise<string> {
    let current = new URL(value);
    for (let redirect = 0; redirect <= 3; redirect += 1) {
      await this.assertSafeUrl(current);
      let response: Response;
      try {
        response = await fetch(current, {
          redirect: 'manual',
          signal: AbortSignal.timeout(15_000),
          headers: {
            Accept: 'text/calendar, application/ics, text/plain;q=0.8',
          },
        });
      } catch {
        throw new ServiceUnavailableException('Calendar feed is unavailable');
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location || redirect === 3) {
          throw new BadRequestException('Calendar feed has an invalid redirect');
        }
        current = new URL(location, current);
        continue;
      }
      if (!response.ok) {
        throw new ServiceUnavailableException(`Calendar feed returned HTTP ${response.status}`);
      }
      const contentLength = Number(response.headers.get('content-length') ?? 0);
      if (contentLength > 5_000_000) {
        throw new BadRequestException('Calendar feed exceeds the 5 MB limit');
      }
      const text = await response.text();
      if (Buffer.byteLength(text, 'utf8') > 5_000_000) {
        throw new BadRequestException('Calendar feed exceeds the 5 MB limit');
      }
      return text;
    }
    throw new BadRequestException('Calendar feed redirect limit exceeded');
  }

  private async assertSafeUrl(url: URL) {
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      (url.port && url.port !== '443')
    ) {
      throw new BadRequestException({
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'Calendar feed must use HTTPS without credentials or custom ports',
      });
    }
    const addresses = await lookup(url.hostname, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some((entry) => this.isPrivateAddress(entry.address))) {
      throw new BadRequestException({
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'Calendar feed host is not publicly routable',
      });
    }
  }

  private isPrivateAddress(address: string) {
    const version = isIP(address);
    if (version === 4) {
      const [a, b] = address.split('.').map(Number);
      return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127) ||
        a >= 224
      );
    }
    const normalized = address.toLocaleLowerCase();
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb') ||
      normalized.startsWith('::ffff:127.') ||
      normalized.startsWith('::ffff:10.') ||
      normalized.startsWith('::ffff:192.168.')
    );
  }

  private key() {
    const secret =
      this.config.get<string>('CALENDAR_FEED_ENCRYPTION_KEY') ??
      this.config.get<string>('JWT_SECRET');
    if (!secret || secret.length < 16) {
      throw new ServiceUnavailableException('Calendar feed encryption is not configured');
    }
    return createHash('sha256').update(secret).digest();
  }
}
