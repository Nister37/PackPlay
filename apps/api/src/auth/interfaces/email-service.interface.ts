export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
}

export interface EmailService {
  send(payload: EmailPayload): Promise<void>;
}

export const EMAIL_SERVICE = Symbol('EMAIL_SERVICE');
