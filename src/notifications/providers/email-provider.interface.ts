import type { EmailSendInput } from '../notifications.types';

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export interface EmailProvider {
  send(input: EmailSendInput): Promise<void>;
}
