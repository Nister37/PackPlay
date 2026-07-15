import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailService, EmailPayload } from '../interfaces';

/**
 * SMTP-based email service using Nodemailer.
 * Configure via env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */
@Injectable()
export class SmtpEmailService implements EmailService {
  private readonly logger = new Logger(SmtpEmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>('SMTP_FROM', 'noreply@packplay.app');

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: this.configService.get<number>('SMTP_PORT', 587) === 465,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async send(payload: EmailPayload): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: payload.to,
        subject: payload.subject,
        text: payload.body,
      });
      this.logger.log(`Email sent to ${payload.to}: ${payload.subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${payload.to}`, (error as Error).stack);
      throw error;
    }
  }
}
