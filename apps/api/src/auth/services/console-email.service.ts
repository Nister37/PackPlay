import { Injectable, Logger } from '@nestjs/common';
import { EmailService, EmailPayload } from '../interfaces';

/**
 * Development email service that logs emails to console.
 * Replace with a real implementation (SES, SendGrid, etc.) in production.
 */
@Injectable()
export class ConsoleEmailService implements EmailService {
  private readonly logger = new Logger(ConsoleEmailService.name);

  async send(payload: EmailPayload): Promise<void> {
    this.logger.log(
      `[DEV EMAIL] To: ${payload.to} | Subject: ${payload.subject}`,
    );
    this.logger.debug(`[DEV EMAIL] Body: ${payload.body}`);
  }
}
