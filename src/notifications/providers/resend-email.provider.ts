import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmailProvider } from './email-provider.interface';
import type { EmailAttachment, EmailSendInput } from '../notifications.types';

type ResendSendEmailResponse = {
  id?: string;
  message?: string;
  name?: string;
};

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ResendEmailProvider.name);
  private readonly apiKey: string | null;
  private readonly fromEmail: string;
  private readonly fromNameFallback: string;
  private readonly minIntervalMs: number;
  private lastRequestAt = 0;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('RESEND_API_KEY') ?? null;
    this.fromEmail = this.configService.get<string>('MAIL_FROM_EMAIL', '');
    this.fromNameFallback = this.configService.get<string>(
      'MAIL_FROM_NAME',
      'Wegox Booking',
    );
    this.minIntervalMs = Math.max(
      0,
      this.configService.get<number>('MAIL_RESEND_MIN_INTERVAL_MS', 650),
    );
  }

  async send(input: EmailSendInput): Promise<void> {
    if (!this.apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    if (!this.fromEmail) {
      throw new Error('MAIL_FROM_EMAIL is not configured');
    }

    await this.waitForRateLimitWindow();

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < 3) {
      attempt += 1;
      const attachments = input.attachments?.map((attachment) =>
        this.toResendAttachment(attachment),
      );
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': input.idempotencyKey,
        },
        body: JSON.stringify({
          from: `${input.fromName?.trim() || this.fromNameFallback} <${this.fromEmail}>`,
          to: [input.to.email],
          subject: input.subject,
          html: input.html,
          text: input.text,
          attachments: attachments?.length ? attachments : undefined,
          reply_to: input.replyTo ?? undefined,
        }),
      });

      this.lastRequestAt = Date.now();

      if (response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | ResendSendEmailResponse
          | null;

        this.logger.debug(
          `Email sent to ${input.to.email}${payload?.id ? ` (${payload.id})` : ''}`,
        );
        return;
      }

      const payload = (await response.json().catch(() => null)) as
        | ResendSendEmailResponse
        | null;
      const reason =
        payload?.message ||
        payload?.name ||
        `Resend error ${response.status}: ${response.statusText}`;

      if (response.status === 429 && attempt < 3) {
        const retryAfterMs = this.resolveRetryAfterMs(response);
        this.logger.warn(
          `Rate limited by Resend while sending to ${input.to.email}. Retrying in ${retryAfterMs}ms.`,
        );
        await this.sleep(retryAfterMs);
        lastError = new Error(reason);
        continue;
      }

      throw new Error(reason);
    }

    throw lastError ?? new Error('Unknown Resend delivery error');
  }

  private async waitForRateLimitWindow(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed >= this.minIntervalMs) {
      return;
    }

    await this.sleep(this.minIntervalMs - elapsed);
  }

  private resolveRetryAfterMs(response: Response): number {
    const retryAfterHeader = response.headers.get('retry-after');
    if (retryAfterHeader) {
      const retryAfterSeconds = Number(retryAfterHeader);
      if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
        return Math.ceil(retryAfterSeconds * 1000);
      }
    }

    const resetHeader =
      response.headers.get('x-ratelimit-reset') ??
      response.headers.get('ratelimit-reset');
    if (resetHeader) {
      const resetSeconds = Number(resetHeader);
      if (Number.isFinite(resetSeconds) && resetSeconds > 0) {
        return Math.max(1000, Math.ceil(resetSeconds * 1000));
      }
    }

    return 1200;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private toResendAttachment(attachment: EmailAttachment): {
    filename: string;
    content: string;
    content_type?: string;
  } {
    return {
      filename: attachment.filename,
      content: Buffer.from(attachment.content, 'utf8').toString('base64'),
      content_type: attachment.contentType ?? undefined,
    };
  }
}
