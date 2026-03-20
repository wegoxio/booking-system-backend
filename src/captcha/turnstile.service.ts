import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

type TurnstileVerificationResponse = {
  success: boolean;
  action?: string;
  hostname?: string;
  challenge_ts?: string;
  cdata?: string;
  'error-codes'?: string[];
};

type VerifyTurnstileInput = {
  token?: string | null;
  ip?: string | null;
  expectedAction?: string | null;
};

const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_MIN_TIMEOUT_MS = 1_000;

const TURNSTILE_CONFIGURATION_ERRORS = new Set([
  'missing-input-secret',
  'invalid-input-secret',
]);

@Injectable()
export class TurnstileService {
  private readonly enabled: boolean;
  private readonly secretKey: string;
  private readonly verifyUrl: string;
  private readonly expectedHostname: string | null;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<boolean>('TURNSTILE_ENABLED', false);
    this.secretKey = this.configService
      .get<string>('TURNSTILE_SECRET_KEY', '')
      .trim();
    this.verifyUrl = this.configService.get<string>(
      'TURNSTILE_VERIFY_URL',
      TURNSTILE_VERIFY_URL,
    );
    this.expectedHostname =
      this.configService.get<string>('TURNSTILE_EXPECTED_HOSTNAME')?.trim() ||
      null;
    this.timeoutMs = Math.max(
      TURNSTILE_MIN_TIMEOUT_MS,
      this.configService.get<number>('TURNSTILE_TIMEOUT_MS', 5_000),
    );

    if (this.enabled && !this.secretKey) {
      throw new Error(
        'TURNSTILE_SECRET_KEY es requerido cuando TURNSTILE_ENABLED=true.',
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async verifyOrThrow(input: VerifyTurnstileInput): Promise<void> {
    if (!this.enabled) return;

    const token = input.token?.trim();
    if (!token) {
      throw new BadRequestException(
        'Completa la verificación captcha antes de continuar.',
      );
    }

    const response = await this.verifyToken(token, input.ip ?? null);
    const errorCodes = response['error-codes'] ?? [];

    if (!response.success) {
      if (errorCodes.some((code) => TURNSTILE_CONFIGURATION_ERRORS.has(code))) {
        throw new ServiceUnavailableException(
          'El servicio de verificación no está disponible en este momento.',
        );
      }

      throw new BadRequestException(this.toHumanReadableError(errorCodes));
    }

    const expectedAction = input.expectedAction?.trim();
    if (
      expectedAction &&
      (!response.action || response.action.trim() !== expectedAction)
    ) {
      throw new BadRequestException(
        'La verificación de seguridad no coincide con la acción solicitada.',
      );
    }

    if (this.expectedHostname) {
      const hostname = response.hostname?.trim().toLowerCase() ?? '';
      if (!hostname || hostname !== this.expectedHostname.toLowerCase()) {
        throw new BadRequestException(
          'La verificación de seguridad no es válida para este dominio.',
        );
      }
    }
  }

  private async verifyToken(
    token: string,
    ip: string | null,
  ): Promise<TurnstileVerificationResponse> {
    const payload = new URLSearchParams({
      secret: this.secretKey,
      response: token,
      idempotency_key: randomUUID(),
    });

    if (ip?.trim()) {
      payload.set('remoteip', ip.trim());
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const result = await fetch(this.verifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload.toString(),
        signal: controller.signal,
      });

      if (!result.ok) {
        throw new ServiceUnavailableException(
          'El servicio de verificación no está disponible en este momento.',
        );
      }

      return (await result.json()) as TurnstileVerificationResponse;
    } catch (error) {
      if (
        error instanceof ServiceUnavailableException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'No se pudo completar la verificación de seguridad.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private toHumanReadableError(errorCodes: string[]): string {
    if (errorCodes.includes('timeout-or-duplicate')) {
      return 'El captcha expiró o ya fue utilizado. Intenta nuevamente.';
    }
    if (errorCodes.includes('missing-input-response')) {
      return 'Completa la verificación captcha antes de continuar.';
    }
    if (errorCodes.includes('invalid-input-response')) {
      return 'El captcha no es válido. Intenta nuevamente.';
    }
    if (errorCodes.includes('bad-request')) {
      return 'No se pudo validar el captcha. Intenta nuevamente.';
    }
    if (errorCodes.includes('internal-error')) {
      return 'El servicio de verificación no responde. Intenta nuevamente.';
    }

    return 'No se pudo validar la verificación de seguridad.';
  }
}
