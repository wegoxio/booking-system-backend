import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { InjectRepository } from '@nestjs/typeorm';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'crypto';
import { EntityManager, IsNull, MoreThan, Repository } from 'typeorm';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { AuthSession } from './entities/auth-session.entity';
import { AuthMfaChallenge } from './entities/auth-mfa-challenge.entity';
import {
  AuthMfaChallengeResponse,
  AuthTokensBundle,
  CurrentJwtUser,
  JwtPayload,
  MfaChallengePayload,
  RefreshJwtPayload,
} from './types';

type AuthRequestContext = {
  ip?: string | null;
  user_agent?: string | null;
};

type NormalizedAuthRequestContext = {
  ip: string | null;
  user_agent: string | null;
};

const REFRESH_TOKEN_MIN_SECONDS = 60;
const DEFAULT_REFRESH_TOKEN_EXP_SECONDS = 60 * 60 * 24 * 30;
const ROTATED_REFRESH_REPLAY_GRACE_MS = 10_000;
const MFA_SETUP_EXPIRES_MS = 10 * 60_000;
const MFA_CHALLENGE_EXPIRES_IN = '5m';
const MFA_CHALLENGE_MAX_ATTEMPTS = 5;
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
type JwtExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;

@Injectable()
export class AuthService {
  private readonly refreshTokenSecret: string;
  private readonly refreshTokenExpiresIn: JwtExpiresIn;
  private readonly maxFailedAttempts: number;
  private readonly lockMinutes: number;
  private readonly failedAttemptsResetMinutes: number;
  private readonly mfaEncryptionKey: Buffer;
  private readonly mfaChallengeSecret: string;
  private readonly mfaIssuer: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwt: JwtService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(AuthSession)
    private readonly authSessionsRepo: Repository<AuthSession>,
    @InjectRepository(AuthMfaChallenge)
    private readonly authMfaChallengesRepo: Repository<AuthMfaChallenge>,
    private readonly auditService: AuditService,
  ) {
    this.refreshTokenSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      this.configService.get<string>('JWT_SECRET', '');
    this.refreshTokenExpiresIn = this.toJwtExpiresIn(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN'),
      '30d',
    );
    this.maxFailedAttempts = Math.max(
      1,
      this.configService.get<number>('AUTH_MAX_FAILED_ATTEMPTS', 5),
    );
    this.lockMinutes = Math.max(
      1,
      this.configService.get<number>('AUTH_LOCK_MINUTES', 15),
    );
    this.failedAttemptsResetMinutes = Math.max(
      1,
      this.configService.get<number>('AUTH_FAILED_RESET_MINUTES', 30),
    );
    this.mfaEncryptionKey = this.resolveMfaEncryptionKey();
    this.mfaChallengeSecret =
      this.configService.get<string>('MFA_CHALLENGE_SECRET') ??
      this.configService.get<string>('JWT_SECRET', '');
    this.mfaIssuer =
      this.configService.get<string>('MFA_ISSUER')?.trim() || 'Bukky';
  }

  async login(
    dto: LoginDto,
    context?: AuthRequestContext,
  ): Promise<AuthTokensBundle | AuthMfaChallengeResponse> {
    const normalizedContext = this.normalizeContext(context);
    const email = dto.email.toLowerCase().trim();

    const user = await this.usersRepo.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('Credenciales inválidas.');

    if (this.isUserLocked(user)) {
      await this.auditService.log({
        actor_user_id: user.id,
        tenant_id: user.tenant_id ?? null,
        action: 'AUTH_LOGIN_BLOCKED',
        entity: 'auth',
        entity_id: user.id,
        metadata: {
          reason: 'ACCOUNT_LOCKED',
          locked_until: user.locked_until?.toISOString() ?? null,
        },
        ip: normalizedContext.ip,
        user_agent: normalizedContext.user_agent,
      });
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    if (!user.is_active) {
      await this.auditService.log({
        actor_user_id: user.id,
        tenant_id: user.tenant_id ?? null,
        action: 'AUTH_LOGIN_BLOCKED',
        entity: 'auth',
        entity_id: user.id,
        metadata: {
          reason: 'USER_DISABLED',
        },
        ip: normalizedContext.ip,
        user_agent: normalizedContext.user_agent,
      });
      throw new ForbiddenException('Credenciales inválidas.');
    }

    if (!user.password_hash) {
      await this.auditService.log({
        actor_user_id: user.id,
        tenant_id: user.tenant_id ?? null,
        action: 'AUTH_LOGIN_BLOCKED',
        entity: 'auth',
        entity_id: user.id,
        metadata: {
          reason: 'PASSWORD_NOT_SET',
        },
        ip: normalizedContext.ip,
        user_agent: normalizedContext.user_agent,
      });
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    if (user.role === 'TENANT_ADMIN' && !user.email_verified_at) {
      await this.auditService.log({
        actor_user_id: user.id,
        tenant_id: user.tenant_id ?? null,
        action: 'AUTH_LOGIN_BLOCKED',
        entity: 'auth',
        entity_id: user.id,
        metadata: {
          reason: 'EMAIL_NOT_VERIFIED',
        },
        ip: normalizedContext.ip,
        user_agent: normalizedContext.user_agent,
      });
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const passwordMatches = await argon2.verify(
      user.password_hash,
      dto.password,
    );
    if (!passwordMatches) {
      await this.registerFailedLoginAttempt(user.id, normalizedContext);
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const validatedUser = await this.ensureUserAndTenantContextForSession(
      user.id,
    );

    if (validatedUser.mfa_enabled_at) {
      await this.auditService.log({
        actor_user_id: validatedUser.id,
        tenant_id: validatedUser.tenant_id ?? null,
        action: 'AUTH_MFA_CHALLENGE_CREATED',
        entity: 'auth',
        entity_id: validatedUser.id,
        metadata: {
          role: validatedUser.role,
        },
        ip: normalizedContext.ip,
        user_agent: normalizedContext.user_agent,
      });

      return this.createMfaChallenge(validatedUser, normalizedContext);
    }

    const updatedUser = await this.resetLoginSecurityState(validatedUser.id);

    const { tokens, session } = await this.createSessionTokens(
      updatedUser,
      normalizedContext,
    );

    await this.auditService.log({
      actor_user_id: updatedUser.id,
      tenant_id: updatedUser.tenant_id ?? null,
      action: 'AUTH_LOGIN_SUCCESS',
      entity: 'auth',
      entity_id: updatedUser.id,
      metadata: {
        role: updatedUser.role,
        session_id: session.id,
      },
      ip: normalizedContext.ip,
      user_agent: normalizedContext.user_agent,
    });

    return tokens;
  }

  async refresh(
    refreshToken: string,
    csrfToken: string,
    context?: AuthRequestContext,
  ): Promise<AuthTokensBundle> {
    const normalizedContext = this.normalizeContext(context);
    const token = refreshToken.trim();
    const payload = this.verifyRefreshToken(token);
    const now = new Date();

    const user = await this.ensureUserAndTenantContextForSession(payload.sub);
    if (payload.token_version !== user.token_version) {
      await this.auditService.log({
        actor_user_id: user.id,
        tenant_id: user.tenant_id ?? null,
        action: 'AUTH_REFRESH_FAILED',
        entity: 'auth',
        entity_id: user.id,
        metadata: {
          reason: 'TOKEN_VERSION_MISMATCH',
          token_version_payload: payload.token_version,
          token_version_current: user.token_version,
        },
        ip: normalizedContext.ip,
        user_agent: normalizedContext.user_agent,
      });
      throw new UnauthorizedException('Sesión inválida.');
    }

    return this.authSessionsRepo.manager.transaction(async (manager) => {
      const sessionsRepo = manager.getRepository(AuthSession);

      const currentSession = await sessionsRepo.findOne({
        where: { id: payload.sid, user_id: user.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!currentSession) {
        await this.auditService.log({
          actor_user_id: user.id,
          tenant_id: user.tenant_id ?? null,
          action: 'AUTH_REFRESH_FAILED',
          entity: 'auth',
          entity_id: user.id,
          metadata: {
            reason: 'SESSION_NOT_FOUND',
            session_id: payload.sid,
          },
          ip: normalizedContext.ip,
          user_agent: normalizedContext.user_agent,
        });
        throw new UnauthorizedException('Sesión inválida.');
      }

      if (!this.csrfTokenMatches(csrfToken, currentSession.csrf_token_hash)) {
        await this.auditService.log({
          actor_user_id: user.id,
          tenant_id: user.tenant_id ?? null,
          action: 'AUTH_REFRESH_FAILED',
          entity: 'auth',
          entity_id: user.id,
          metadata: {
            reason: 'CSRF_MISMATCH',
            session_id: currentSession.id,
          },
          ip: normalizedContext.ip,
          user_agent: normalizedContext.user_agent,
        });
        throw new UnauthorizedException('Sesión inválida.');
      }

      if (currentSession.revoked_at) {
        const isBenignRotatedReplay = this.isBenignRotatedRefreshReplay(
          currentSession,
          normalizedContext,
          now,
        );

        if (isBenignRotatedReplay) {
          await this.auditService.log({
            actor_user_id: user.id,
            tenant_id: user.tenant_id ?? null,
            action: 'AUTH_REFRESH_DUPLICATE_REJECTED',
            entity: 'auth',
            entity_id: user.id,
            metadata: {
              replayed_session_id: currentSession.id,
              replaced_by_session_id: currentSession.replaced_by_session_id,
              reason: currentSession.revocation_reason ?? 'ROTATED',
            },
            ip: normalizedContext.ip,
            user_agent: normalizedContext.user_agent,
          });

          throw new UnauthorizedException(
            'La sesión ya fue rotada. Reintenta con la cookie actual.',
          );
        }

        if (currentSession.revocation_reason === 'ROTATED') {
          await this.revokeAllActiveSessionsForUser(
            manager,
            user.id,
            'REUSE_DETECTED',
          );
        }

        await this.auditService.log({
          actor_user_id: user.id,
          tenant_id: user.tenant_id ?? null,
          action: 'AUTH_REFRESH_REUSE_DETECTED',
          entity: 'auth',
          entity_id: user.id,
          metadata: {
            session_id: currentSession.id,
            reason:
              currentSession.revocation_reason ?? 'SESSION_ALREADY_REVOKED',
          },
          ip: normalizedContext.ip,
          user_agent: normalizedContext.user_agent,
        });
        throw new UnauthorizedException('Sesión inválida.');
      }

      if (currentSession.token_jti !== payload.jti) {
        await this.revokeAllActiveSessionsForUser(
          manager,
          user.id,
          'REUSE_DETECTED',
        );
        await this.auditService.log({
          actor_user_id: user.id,
          tenant_id: user.tenant_id ?? null,
          action: 'AUTH_REFRESH_REUSE_DETECTED',
          entity: 'auth',
          entity_id: user.id,
          metadata: {
            session_id: currentSession.id,
            reason: 'TOKEN_JTI_MISMATCH',
          },
          ip: normalizedContext.ip,
          user_agent: normalizedContext.user_agent,
        });
        throw new UnauthorizedException('Sesión inválida.');
      }

      if (currentSession.expires_at.getTime() <= now.getTime()) {
        currentSession.revoked_at = now;
        currentSession.revocation_reason = 'EXPIRED';
        currentSession.last_used_at = now;
        await sessionsRepo.save(currentSession);

        await this.auditService.log({
          actor_user_id: user.id,
          tenant_id: user.tenant_id ?? null,
          action: 'AUTH_REFRESH_FAILED',
          entity: 'auth',
          entity_id: user.id,
          metadata: {
            reason: 'SESSION_EXPIRED',
            session_id: currentSession.id,
          },
          ip: normalizedContext.ip,
          user_agent: normalizedContext.user_agent,
        });
        throw new UnauthorizedException('Sesión expirada.');
      }

      const refreshTokenMatches = await argon2.verify(
        currentSession.refresh_token_hash,
        token,
      );
      if (!refreshTokenMatches) {
        await this.revokeAllActiveSessionsForUser(
          manager,
          user.id,
          'REUSE_DETECTED',
        );
        await this.auditService.log({
          actor_user_id: user.id,
          tenant_id: user.tenant_id ?? null,
          action: 'AUTH_REFRESH_REUSE_DETECTED',
          entity: 'auth',
          entity_id: user.id,
          metadata: {
            session_id: currentSession.id,
            reason: 'HASH_MISMATCH',
          },
          ip: normalizedContext.ip,
          user_agent: normalizedContext.user_agent,
        });
        throw new UnauthorizedException('Sesión inválida.');
      }

      const { tokens, session } = await this.createSessionTokens(
        user,
        normalizedContext,
        manager,
      );

      currentSession.revoked_at = now;
      currentSession.revocation_reason = 'ROTATED';
      currentSession.replaced_by_session_id = session.id;
      currentSession.last_used_at = now;
      await sessionsRepo.save(currentSession);

      await this.auditService.log({
        actor_user_id: user.id,
        tenant_id: user.tenant_id ?? null,
        action: 'AUTH_REFRESH_SUCCESS',
        entity: 'auth',
        entity_id: user.id,
        metadata: {
          previous_session_id: currentSession.id,
          new_session_id: session.id,
        },
        ip: normalizedContext.ip,
        user_agent: normalizedContext.user_agent,
      });

      return tokens;
    });
  }

  async logout(
    refreshToken: string | null,
    csrfToken: string,
    context?: AuthRequestContext,
  ): Promise<{ success: true }> {
    const normalizedContext = this.normalizeContext(context);
    const token = refreshToken?.trim();
    if (!token) {
      return { success: true };
    }

    let payload: RefreshJwtPayload;
    try {
      payload = this.verifyRefreshToken(token);
    } catch {
      return { success: true };
    }

    const result = await this.authSessionsRepo.manager.transaction(
      async (manager) => {
        const session = await manager.getRepository(AuthSession).findOne({
          where: { id: payload.sid, user_id: payload.sub },
          lock: { mode: 'pessimistic_write' },
        });
        if (!session) return null;

        if (!this.csrfTokenMatches(csrfToken, session.csrf_token_hash)) {
          throw new UnauthorizedException('Sesión inválida.');
        }

        const now = new Date();
        let revokedSessions = 0;
        if (!session.revoked_at) {
          session.revoked_at = now;
          session.revocation_reason = 'LOGOUT';
          session.last_used_at = now;
          await manager.getRepository(AuthSession).save(session);
          revokedSessions = 1;
        } else if (session.revocation_reason === 'ROTATED') {
          revokedSessions = await this.revokeAllActiveSessionsForUser(
            manager,
            payload.sub,
            'LOGOUT_RACE',
          );
        }
        return { sessionId: session.id, revokedSessions };
      },
    );

    if (!result) {
      return { success: true };
    }

    const user = await this.usersRepo.findOne({
      where: { id: payload.sub },
    });

    await this.auditService.log({
      actor_user_id: payload.sub,
      tenant_id: user?.tenant_id ?? null,
      action: 'AUTH_LOGOUT',
      entity: 'auth',
      entity_id: payload.sub,
      metadata: {
        session_id: result.sessionId,
        revoked_sessions: result.revokedSessions,
      },
      ip: normalizedContext.ip,
      user_agent: normalizedContext.user_agent,
    });

    return { success: true };
  }

  async logoutAll(
    currentUser: CurrentJwtUser,
    context?: AuthRequestContext,
  ): Promise<{ success: true; revoked_sessions: number }> {
    const normalizedContext = this.normalizeContext(context);

    const result = await this.usersRepo.manager.transaction(async (manager) => {
      const usersRepo = manager.getRepository(User);
      const lockedUser = await usersRepo.findOne({
        where: { id: currentUser.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedUser) {
        throw new UnauthorizedException('Usuario inválido.');
      }

      lockedUser.token_version = (lockedUser.token_version ?? 0) + 1;
      await usersRepo.save(lockedUser);

      const revokedCount = await this.revokeAllActiveSessionsForUser(
        manager,
        currentUser.id,
        'LOGOUT_ALL',
      );

      return {
        success: true,
        revoked_sessions: revokedCount,
        new_token_version: lockedUser.token_version,
      };
    });

    await this.auditService.log({
      actor_user_id: currentUser.id,
      tenant_id: currentUser.tenant_id ?? null,
      action: 'AUTH_LOGOUT_ALL',
      entity: 'auth',
      entity_id: currentUser.id,
      metadata: {
        revoked_sessions: result.revoked_sessions,
        new_token_version: result.new_token_version,
      },
      ip: normalizedContext.ip,
      user_agent: normalizedContext.user_agent,
    });

    return {
      success: true,
      revoked_sessions: result.revoked_sessions,
    };
  }

  async completeMfaLogin(
    challengeToken: string,
    code: string | undefined,
    recoveryCode: string | undefined,
    context?: AuthRequestContext,
  ): Promise<AuthTokensBundle> {
    const normalizedContext = this.normalizeContext(context);
    const payload = this.verifyMfaChallengeToken(challengeToken);
    const user = await this.ensureUserAndTenantContextForSession(payload.sub);
    const challenge = await this.authMfaChallengesRepo.findOne({
      where: {
        user_id: user.id,
        token_jti_hash: this.hashMfaChallengeJti(payload.jti),
      },
    });

    if (
      !challenge ||
      challenge.used_at ||
      challenge.expires_at.getTime() <= Date.now() ||
      challenge.failed_attempts >= MFA_CHALLENGE_MAX_ATTEMPTS
    ) {
      throw new UnauthorizedException(
        'Verificación expirada. Inicia sesión nuevamente.',
      );
    }

    if (!user.mfa_enabled_at || !user.mfa_totp_secret_encrypted) {
      throw new UnauthorizedException('La verificación en dos pasos no está activa.');
    }

    try {
      await this.verifyMfaCredentialOrThrow(user, code, recoveryCode, {
        consumeRecoveryCode: true,
        context: normalizedContext,
        action: 'AUTH_MFA_LOGIN_FAILED',
      });
    } catch (error) {
      challenge.failed_attempts += 1;
      await this.authMfaChallengesRepo.save(challenge);
      throw error;
    }

    challenge.used_at = new Date();
    await this.authMfaChallengesRepo.save(challenge);

    const updatedUser = await this.resetLoginSecurityState(user.id);
    updatedUser.mfa_last_used_at = new Date();
    await this.usersRepo.save(updatedUser);

    const { tokens, session } = await this.createSessionTokens(
      updatedUser,
      normalizedContext,
    );

    await this.auditService.log({
      actor_user_id: updatedUser.id,
      tenant_id: updatedUser.tenant_id ?? null,
      action: 'AUTH_LOGIN_SUCCESS',
      entity: 'auth',
      entity_id: updatedUser.id,
      metadata: {
        role: updatedUser.role,
        session_id: session.id,
        mfa: true,
      },
      ip: normalizedContext.ip,
      user_agent: normalizedContext.user_agent,
    });

    return tokens;
  }

  async getMfaStatus(currentUser: CurrentJwtUser) {
    const user = await this.usersRepo.findOne({ where: { id: currentUser.id } });
    if (!user) throw new UnauthorizedException('Usuario inválido.');

    return {
      enabled: !!user.mfa_enabled_at,
      enabled_at: user.mfa_enabled_at?.toISOString() ?? null,
      last_used_at: user.mfa_last_used_at?.toISOString() ?? null,
      recovery_codes_remaining: user.mfa_recovery_code_hashes?.length ?? 0,
      pending_setup_expires_at:
        user.mfa_pending_expires_at &&
        user.mfa_pending_expires_at.getTime() > Date.now()
          ? user.mfa_pending_expires_at.toISOString()
          : null,
    };
  }

  async startMfaSetup(currentUser: CurrentJwtUser) {
    const user = await this.usersRepo.findOne({ where: { id: currentUser.id } });
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Usuario inválido.');
    }

    if (user.mfa_enabled_at) {
      throw new BadRequestException('La verificación en dos pasos ya está activa.');
    }

    const secret = this.generateTotpSecret();
    const expiresAt = new Date(Date.now() + MFA_SETUP_EXPIRES_MS);
    user.mfa_pending_secret_encrypted = this.encryptMfaSecret(secret);
    user.mfa_pending_expires_at = expiresAt;
    await this.usersRepo.save(user);

    await this.auditService.log({
      actor_user_id: user.id,
      tenant_id: user.tenant_id ?? null,
      action: 'AUTH_MFA_SETUP_STARTED',
      entity: 'auth',
      entity_id: user.id,
      metadata: { expires_at: expiresAt.toISOString() },
    });

    return {
      secret,
      otpauth_url: this.buildOtpAuthUrl(user, secret),
      expires_at: expiresAt.toISOString(),
    };
  }

  async enableMfa(
    currentUser: CurrentJwtUser,
    code: string | undefined,
    context?: AuthRequestContext,
  ) {
    const normalizedContext = this.normalizeContext(context);
    const user = await this.usersRepo.findOne({ where: { id: currentUser.id } });
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Usuario inválido.');
    }

    if (user.mfa_enabled_at) {
      throw new BadRequestException('La verificación en dos pasos ya está activa.');
    }

    if (
      !user.mfa_pending_secret_encrypted ||
      !user.mfa_pending_expires_at ||
      user.mfa_pending_expires_at.getTime() <= Date.now()
    ) {
      throw new BadRequestException('El código de configuración expiró. Genera un nuevo QR.');
    }

    const normalizedCode = this.normalizeTotpCode(code);
    const secret = this.decryptMfaSecret(user.mfa_pending_secret_encrypted);
    if (!this.verifyTotpCode(secret, normalizedCode)) {
      await this.auditService.log({
        actor_user_id: user.id,
        tenant_id: user.tenant_id ?? null,
        action: 'AUTH_MFA_ENABLE_FAILED',
        entity: 'auth',
        entity_id: user.id,
        metadata: { reason: 'INVALID_CODE' },
        ip: normalizedContext.ip,
        user_agent: normalizedContext.user_agent,
      });
      throw new UnauthorizedException('El código de verificación no es válido.');
    }

    const recoveryCodes = this.generateRecoveryCodes();
    user.mfa_enabled_at = new Date();
    user.mfa_totp_secret_encrypted = user.mfa_pending_secret_encrypted;
    user.mfa_recovery_code_hashes = await Promise.all(
      recoveryCodes.map((recoveryCode) => argon2.hash(recoveryCode)),
    );
    user.mfa_pending_secret_encrypted = null;
    user.mfa_pending_expires_at = null;
    user.mfa_last_used_at = new Date();
    await this.usersRepo.save(user);

    await this.auditService.log({
      actor_user_id: user.id,
      tenant_id: user.tenant_id ?? null,
      action: 'AUTH_MFA_ENABLED',
      entity: 'auth',
      entity_id: user.id,
      metadata: { recovery_codes: recoveryCodes.length },
      ip: normalizedContext.ip,
      user_agent: normalizedContext.user_agent,
    });

    return {
      success: true,
      enabled_at: user.mfa_enabled_at.toISOString(),
      recovery_codes: recoveryCodes,
    };
  }

  async disableMfa(
    currentUser: CurrentJwtUser,
    code: string | undefined,
    recoveryCode: string | undefined,
    context?: AuthRequestContext,
  ) {
    const normalizedContext = this.normalizeContext(context);
    const user = await this.usersRepo.findOne({ where: { id: currentUser.id } });
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Usuario inválido.');
    }

    if (!user.mfa_enabled_at || !user.mfa_totp_secret_encrypted) {
      throw new BadRequestException('La verificación en dos pasos no está activa.');
    }

    await this.verifyMfaCredentialOrThrow(user, code, recoveryCode, {
      consumeRecoveryCode: true,
      context: normalizedContext,
      action: 'AUTH_MFA_DISABLE_FAILED',
    });

    user.mfa_enabled_at = null;
    user.mfa_totp_secret_encrypted = null;
    user.mfa_recovery_code_hashes = null;
    user.mfa_pending_secret_encrypted = null;
    user.mfa_pending_expires_at = null;
    user.mfa_last_used_at = null;
    await this.usersRepo.save(user);

    const revokedSessions = await this.revokeOtherActiveSessions(
      currentUser.id,
      currentUser.session_id,
      'MFA_DISABLED',
    );

    await this.auditService.log({
      actor_user_id: user.id,
      tenant_id: user.tenant_id ?? null,
      action: 'AUTH_MFA_DISABLED',
      entity: 'auth',
      entity_id: user.id,
      metadata: { revoked_sessions: revokedSessions },
      ip: normalizedContext.ip,
      user_agent: normalizedContext.user_agent,
    });

    return { success: true, revoked_sessions: revokedSessions };
  }

  async regenerateRecoveryCodes(
    currentUser: CurrentJwtUser,
    code: string | undefined,
    recoveryCode: string | undefined,
    context?: AuthRequestContext,
  ) {
    const normalizedContext = this.normalizeContext(context);
    const user = await this.usersRepo.findOne({ where: { id: currentUser.id } });
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Usuario inválido.');
    }

    if (!user.mfa_enabled_at || !user.mfa_totp_secret_encrypted) {
      throw new BadRequestException('Activa primero la verificación en dos pasos.');
    }

    await this.verifyMfaCredentialOrThrow(user, code, recoveryCode, {
      consumeRecoveryCode: true,
      context: normalizedContext,
      action: 'AUTH_MFA_RECOVERY_CODES_FAILED',
    });

    const recoveryCodes = this.generateRecoveryCodes();
    user.mfa_recovery_code_hashes = await Promise.all(
      recoveryCodes.map((nextCode) => argon2.hash(nextCode)),
    );
    await this.usersRepo.save(user);

    await this.auditService.log({
      actor_user_id: user.id,
      tenant_id: user.tenant_id ?? null,
      action: 'AUTH_MFA_RECOVERY_CODES_REGENERATED',
      entity: 'auth',
      entity_id: user.id,
      metadata: { recovery_codes: recoveryCodes.length },
      ip: normalizedContext.ip,
      user_agent: normalizedContext.user_agent,
    });

    return { success: true, recovery_codes: recoveryCodes };
  }

  async listSessions(currentUser: CurrentJwtUser) {
    const now = new Date();
    const sessions = await this.authSessionsRepo.find({
      where: {
        user_id: currentUser.id,
        revoked_at: IsNull(),
        expires_at: MoreThan(now),
      },
      order: { last_used_at: 'DESC', created_at: 'DESC' },
      take: 50,
    });

    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        current: session.id === currentUser.session_id,
        created_at: session.created_at.toISOString(),
        last_used_at: session.last_used_at?.toISOString() ?? null,
        expires_at: session.expires_at.toISOString(),
        ip: session.ip,
        user_agent: session.user_agent,
      })),
    };
  }

  async revokeSession(
    currentUser: CurrentJwtUser,
    sessionId: string,
    context?: AuthRequestContext,
  ) {
    const normalizedContext = this.normalizeContext(context);
    const session = await this.authSessionsRepo.findOne({
      where: { id: sessionId, user_id: currentUser.id },
    });

    if (!session || session.revoked_at || session.expires_at.getTime() <= Date.now()) {
      throw new NotFoundException('La sesión no existe o ya fue cerrada.');
    }

    if (session.id === currentUser.session_id) {
      throw new BadRequestException('Para cerrar esta sesión usa el botón Cerrar sesión.');
    }

    session.revoked_at = new Date();
    session.revocation_reason = 'USER_REVOKED';
    session.last_used_at = session.revoked_at;
    await this.authSessionsRepo.save(session);

    await this.auditService.log({
      actor_user_id: currentUser.id,
      tenant_id: currentUser.tenant_id ?? null,
      action: 'AUTH_SESSION_REVOKED',
      entity: 'auth',
      entity_id: currentUser.id,
      metadata: { session_id: session.id },
      ip: normalizedContext.ip,
      user_agent: normalizedContext.user_agent,
    });

    return { success: true };
  }

  async revokeOtherSessions(
    currentUser: CurrentJwtUser,
    context?: AuthRequestContext,
  ) {
    const normalizedContext = this.normalizeContext(context);
    const revokedSessions = await this.revokeOtherActiveSessions(
      currentUser.id,
      currentUser.session_id,
      'USER_REVOKED_OTHERS',
    );

    await this.auditService.log({
      actor_user_id: currentUser.id,
      tenant_id: currentUser.tenant_id ?? null,
      action: 'AUTH_OTHER_SESSIONS_REVOKED',
      entity: 'auth',
      entity_id: currentUser.id,
      metadata: { revoked_sessions: revokedSessions },
      ip: normalizedContext.ip,
      user_agent: normalizedContext.user_agent,
    });

    return { success: true, revoked_sessions: revokedSessions };
  }

  async markTenantDashboardTourCompleted(
    currentUser: CurrentJwtUser,
  ): Promise<{ success: true; completed_at: string | null }> {
    const result = await this.usersRepo.manager.transaction(async (manager) => {
      const usersRepo = manager.getRepository(User);
      const lockedUser = await usersRepo.findOne({
        where: { id: currentUser.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedUser || !lockedUser.is_active) {
        throw new UnauthorizedException('Usuario inválido.');
      }

      if (lockedUser.role !== 'TENANT_ADMIN') {
        return {
          completed_at: lockedUser.tenant_dashboard_tour_completed_at,
          did_mark: false,
          tenant_id: lockedUser.tenant_id ?? null,
        };
      }

      if (lockedUser.tenant_dashboard_tour_completed_at) {
        return {
          completed_at: lockedUser.tenant_dashboard_tour_completed_at,
          did_mark: false,
          tenant_id: lockedUser.tenant_id ?? null,
        };
      }

      const now = new Date();
      lockedUser.tenant_dashboard_tour_completed_at = now;
      await usersRepo.save(lockedUser);

      return {
        completed_at: now,
        did_mark: true,
        tenant_id: lockedUser.tenant_id ?? null,
      };
    });

    if (result.did_mark) {
      await this.auditService.log({
        actor_user_id: currentUser.id,
        tenant_id: result.tenant_id,
        action: 'AUTH_TENANT_DASHBOARD_TOUR_COMPLETED',
        entity: 'auth',
        entity_id: currentUser.id,
        metadata: {
          completed_at: result.completed_at?.toISOString() ?? null,
        },
      });
    }

    return {
      success: true,
      completed_at: result.completed_at?.toISOString() ?? null,
    };
  }

  private async createMfaChallenge(
    user: User,
    context: NormalizedAuthRequestContext,
  ): Promise<AuthMfaChallengeResponse> {
    const payload: MfaChallengePayload = {
      sub: user.id,
      purpose: 'mfa_login',
      jti: randomUUID(),
    };

    const challengeToken = this.jwt.sign(payload, {
      secret: this.mfaChallengeSecret,
      expiresIn: MFA_CHALLENGE_EXPIRES_IN,
    });
    const decoded = this.jwt.decode(challengeToken);
    const expiresAt =
      typeof decoded?.exp === 'number'
        ? new Date(decoded.exp * 1000)
        : new Date(Date.now() + 5 * 60_000);

    await this.authMfaChallengesRepo.save(
      this.authMfaChallengesRepo.create({
        user_id: user.id,
        token_jti_hash: this.hashMfaChallengeJti(payload.jti),
        expires_at: expiresAt,
        used_at: null,
        failed_attempts: 0,
        ip: context.ip,
        user_agent: context.user_agent,
      }),
    );

    return {
      mfa_required: true,
      challenge_token: challengeToken,
      expires_at: expiresAt.toISOString(),
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  private verifyMfaChallengeToken(token: string): MfaChallengePayload {
    try {
      const payload = this.jwt.verify<MfaChallengePayload>(token, {
        secret: this.mfaChallengeSecret,
      });

      if (
        !payload?.sub ||
        payload.purpose !== 'mfa_login' ||
        !payload.jti
      ) {
        throw new UnauthorizedException('Verificación expirada.');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Verificación expirada. Inicia sesión nuevamente.');
    }
  }

  private async verifyMfaCredentialOrThrow(
    user: User,
    code: string | undefined,
    recoveryCode: string | undefined,
    options: {
      consumeRecoveryCode: boolean;
      context: NormalizedAuthRequestContext;
      action: string;
    },
  ): Promise<void> {
    if (!user.mfa_totp_secret_encrypted) {
      throw new UnauthorizedException('La verificación en dos pasos no está activa.');
    }

    const normalizedCode = code ? this.normalizeTotpCode(code) : null;
    if (normalizedCode) {
      const secret = this.decryptMfaSecret(user.mfa_totp_secret_encrypted);
      if (this.verifyTotpCode(secret, normalizedCode)) {
        return;
      }
    }

    const normalizedRecoveryCode = recoveryCode
      ? this.normalizeRecoveryCode(recoveryCode)
      : null;
    if (normalizedRecoveryCode && user.mfa_recovery_code_hashes?.length) {
      const remainingHashes: string[] = [];
      let matched = false;

      for (const hash of user.mfa_recovery_code_hashes) {
        if (!matched && (await argon2.verify(hash, normalizedRecoveryCode))) {
          matched = true;
          if (!options.consumeRecoveryCode) {
            remainingHashes.push(hash);
          }
          continue;
        }
        remainingHashes.push(hash);
      }

      if (matched) {
        if (options.consumeRecoveryCode) {
          user.mfa_recovery_code_hashes = remainingHashes;
          await this.usersRepo.save(user);
        }
        return;
      }
    }

    await this.auditService.log({
      actor_user_id: user.id,
      tenant_id: user.tenant_id ?? null,
      action: options.action,
      entity: 'auth',
      entity_id: user.id,
      metadata: {
        reason: 'INVALID_MFA_CREDENTIAL',
        used_recovery_code: !!normalizedRecoveryCode,
      },
      ip: options.context.ip,
      user_agent: options.context.user_agent,
    });

    throw new UnauthorizedException('El código de verificación no es válido.');
  }

  private normalizeTotpCode(code?: string): string {
    const normalized = code?.replace(/\s+/g, '').trim() ?? '';
    if (!/^\d{6}$/.test(normalized)) {
      throw new BadRequestException('Ingresa un código de 6 dígitos.');
    }
    return normalized;
  }

  private normalizeRecoveryCode(code: string): string {
    return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  private generateRecoveryCodes(): string[] {
    return Array.from({ length: 10 }, () => {
      const raw = randomBytes(9).toString('base64url').replace(/[^A-Z0-9]/gi, '');
      return raw
        .toUpperCase()
        .slice(0, 12)
        .replace(/(.{4})(?=.)/g, '$1-');
    });
  }

  private generateTotpSecret(): string {
    return this.toBase32(randomBytes(20));
  }

  private buildOtpAuthUrl(user: User, secret: string): string {
    const label = encodeURIComponent(`${this.mfaIssuer}:${user.email}`);
    const issuer = encodeURIComponent(this.mfaIssuer);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
  }

  private verifyTotpCode(secret: string, code: string): boolean {
    const nowCounter = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS);
    for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset += 1) {
      if (this.generateTotpCode(secret, nowCounter + offset) === code) {
        return true;
      }
    }
    return false;
  }

  private generateTotpCode(secret: string, counter: number): string {
    const key = this.fromBase32(secret);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    counterBuffer.writeUInt32BE(counter >>> 0, 4);

    const hmac = createHmac('sha1', key).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
  }

  private toBase32(buffer: Buffer): string {
    let bits = '';
    for (const byte of buffer) {
      bits += byte.toString(2).padStart(8, '0');
    }

    let output = '';
    for (let i = 0; i < bits.length; i += 5) {
      const chunk = bits.slice(i, i + 5).padEnd(5, '0');
      output += BASE32_ALPHABET[Number.parseInt(chunk, 2)];
    }
    return output;
  }

  private fromBase32(secret: string): Buffer {
    const cleanSecret = secret.toUpperCase().replace(/=+$/g, '');
    let bits = '';
    for (const char of cleanSecret) {
      const value = BASE32_ALPHABET.indexOf(char);
      if (value === -1) throw new BadRequestException('Secreto MFA inválido.');
      bits += value.toString(2).padStart(5, '0');
    }

    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
    }
    return Buffer.from(bytes);
  }

  private encryptMfaSecret(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.mfaEncryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  private decryptMfaSecret(payload: string): string {
    const [ivEncoded, tagEncoded, encryptedEncoded] = payload.split('.');
    if (!ivEncoded || !tagEncoded || !encryptedEncoded) {
      throw new UnauthorizedException('Configuración MFA inválida.');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.mfaEncryptionKey,
      Buffer.from(ivEncoded, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedEncoded, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private resolveMfaEncryptionKey(): Buffer {
    const configured = this.configService.get<string>('MFA_ENCRYPTION_KEY');
    if (configured?.trim()) {
      const raw = configured.trim();
      const decoded = Buffer.from(raw, 'base64');
      if (decoded.length === 32) return decoded;
      if (raw.length >= 32) return createHash('sha256').update(raw).digest();
    }

    const fallback =
      this.configService.get<string>('JWT_SECRET') ??
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      'local-development-only';
    return createHash('sha256')
      .update(`bukky-mfa:${fallback}`)
      .digest();
  }

  private async revokeOtherActiveSessions(
    userId: string,
    currentSessionId: string | null,
    reason: string,
  ): Promise<number> {
    const now = new Date();
    const query = this.authSessionsRepo
      .createQueryBuilder()
      .update(AuthSession)
      .set({
        revoked_at: now,
        revocation_reason: reason,
        last_used_at: now,
      })
      .where('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL')
      .andWhere('expires_at > :now', { now });

    if (currentSessionId) {
      query.andWhere('id <> :currentSessionId', { currentSessionId });
    }

    const result = await query.execute();
    return result.affected ?? 0;
  }

  private verifyRefreshToken(token: string): RefreshJwtPayload {
    try {
      const payload = this.jwt.verify<RefreshJwtPayload>(token, {
        secret: this.refreshTokenSecret,
      });

      if (
        !payload?.sub ||
        !payload.sid ||
        !payload.jti ||
        typeof payload.token_version !== 'number'
      ) {
        throw new UnauthorizedException('Sesión inválida.');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Sesión inválida.');
    }
  }

  private async ensureUserAndTenantContextForSession(
    userId: string,
  ): Promise<User> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: { tenant: true },
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedException('Usuario inválido.');
    }

    if (user.role === 'TENANT_ADMIN') {
      if (!user.tenant_id || !user.tenant) {
        throw new ForbiddenException('Falta el contexto del negocio.');
      }

      if (!user.tenant.is_active) {
        throw new ForbiddenException('El negocio está deshabilitado.');
      }

      if (!user.email_verified_at) {
        throw new ForbiddenException(
          'El correo electrónico no está verificado.',
        );
      }
    }

    return user;
  }

  private async resetLoginSecurityState(userId: string): Promise<User> {
    return this.usersRepo.manager.transaction(async (manager) => {
      const usersRepo = manager.getRepository(User);
      const lockedUser = await usersRepo.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedUser) {
        throw new UnauthorizedException('Usuario inválido.');
      }

      lockedUser.failed_login_attempts = 0;
      lockedUser.last_failed_login_at = null;
      lockedUser.locked_until = null;
      lockedUser.last_login_at = new Date();
      await usersRepo.save(lockedUser);

      return lockedUser;
    });
  }

  private isUserLocked(user: User): boolean {
    if (!user.locked_until) return false;
    return user.locked_until.getTime() > Date.now();
  }

  private shouldResetFailedAttempts(
    lastFailedAt: Date | null,
    now: Date,
  ): boolean {
    if (!lastFailedAt) return false;
    const resetThresholdMs = this.failedAttemptsResetMinutes * 60_000;
    return now.getTime() - lastFailedAt.getTime() >= resetThresholdMs;
  }

  private async registerFailedLoginAttempt(
    userId: string,
    context: NormalizedAuthRequestContext,
  ): Promise<void> {
    const now = new Date();

    const result = await this.usersRepo.manager.transaction(async (manager) => {
      const usersRepo = manager.getRepository(User);
      const lockedUser = await usersRepo.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedUser) return;

      let attempts = lockedUser.failed_login_attempts ?? 0;
      if (
        this.shouldResetFailedAttempts(lockedUser.last_failed_login_at, now)
      ) {
        attempts = 0;
      }

      attempts += 1;
      lockedUser.failed_login_attempts = attempts;
      lockedUser.last_failed_login_at = now;

      let accountLocked = false;
      if (attempts >= this.maxFailedAttempts) {
        lockedUser.locked_until = new Date(
          now.getTime() + this.lockMinutes * 60_000,
        );
        accountLocked = true;
      }

      await usersRepo.save(lockedUser);

      return {
        actor_user_id: lockedUser.id,
        tenant_id: lockedUser.tenant_id ?? null,
        attempts,
        accountLocked,
        locked_until: lockedUser.locked_until?.toISOString() ?? null,
      };
    });

    if (!result) {
      return;
    }

    await this.auditService.log({
      actor_user_id: result.actor_user_id,
      tenant_id: result.tenant_id,
      action: 'AUTH_LOGIN_FAILED',
      entity: 'auth',
      entity_id: result.actor_user_id,
      metadata: {
        failed_attempts: result.attempts,
        max_failed_attempts: this.maxFailedAttempts,
        locked_until: result.locked_until,
      },
      ip: context.ip,
      user_agent: context.user_agent,
    });

    if (result.accountLocked) {
      await this.auditService.log({
        actor_user_id: result.actor_user_id,
        tenant_id: result.tenant_id,
        action: 'AUTH_ACCOUNT_LOCKED',
        entity: 'auth',
        entity_id: result.actor_user_id,
        metadata: {
          failed_attempts: result.attempts,
          lock_minutes: this.lockMinutes,
          locked_until: result.locked_until,
        },
        ip: context.ip,
        user_agent: context.user_agent,
      });
    }
  }

  private buildAccessPayload(user: User, sessionId: string): JwtPayload {
    return {
      sub: user.id,
      role: user.role,
      tenant_id: user.tenant_id ?? null,
      sid: sessionId,
      token_version: user.token_version ?? 0,
    };
  }

  private buildRefreshPayload(
    user: User,
    session: AuthSession,
  ): RefreshJwtPayload {
    return {
      sub: user.id,
      sid: session.id,
      jti: session.token_jti,
      token_version: user.token_version ?? 0,
    };
  }

  private getRefreshTokenExpirationDate(refreshToken: string): Date {
    const decoded = this.jwt.decode(refreshToken);
    if (typeof decoded?.exp !== 'number') {
      return new Date(Date.now() + DEFAULT_REFRESH_TOKEN_EXP_SECONDS * 1000);
    }

    const expDate = new Date(decoded.exp * 1000);
    const minDate = new Date(Date.now() + REFRESH_TOKEN_MIN_SECONDS * 1000);
    return expDate.getTime() > minDate.getTime() ? expDate : minDate;
  }

  private async createSessionTokens(
    user: User,
    context: NormalizedAuthRequestContext,
    manager?: EntityManager,
  ): Promise<{ tokens: AuthTokensBundle; session: AuthSession }> {
    const sessionRepo = (
      manager ?? this.authSessionsRepo.manager
    ).getRepository(AuthSession);
    const now = new Date();

    const session = sessionRepo.create({
      id: randomUUID(),
      user_id: user.id,
      token_jti: randomUUID(),
      refresh_token_hash: '',
      csrf_token_hash: '',
      expires_at: now,
      revoked_at: null,
      revocation_reason: null,
      replaced_by_session_id: null,
      ip: context.ip,
      user_agent: context.user_agent,
      last_used_at: now,
    });

    const accessToken = this.jwt.sign(
      this.buildAccessPayload(user, session.id),
    );
    const refreshToken = this.jwt.sign(
      this.buildRefreshPayload(user, session),
      {
        secret: this.refreshTokenSecret,
        expiresIn: this.refreshTokenExpiresIn,
      },
    );
    const csrfToken = this.generateCsrfToken();

    session.expires_at = this.getRefreshTokenExpirationDate(refreshToken);
    session.refresh_token_hash = await argon2.hash(refreshToken);
    session.csrf_token_hash = this.hashCsrfToken(csrfToken);

    const savedSession = await sessionRepo.save(session);

    return {
      session: savedSession,
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        csrf_token: csrfToken,
        refresh_expires_at: session.expires_at,
      },
    };
  }

  private async revokeAllActiveSessionsForUser(
    manager: EntityManager,
    userId: string,
    reason: string,
  ): Promise<number> {
    const now = new Date();
    const result = await manager.getRepository(AuthSession).update(
      {
        user_id: userId,
        revoked_at: IsNull(),
        expires_at: MoreThan(now),
      },
      {
        revoked_at: now,
        revocation_reason: reason,
        last_used_at: now,
      },
    );

    return result.affected ?? 0;
  }

  private isBenignRotatedRefreshReplay(
    session: AuthSession,
    context: NormalizedAuthRequestContext,
    now: Date,
  ): boolean {
    if (
      !session.revoked_at ||
      session.revocation_reason !== 'ROTATED' ||
      !session.replaced_by_session_id
    ) {
      return false;
    }

    const revokedAgoMs = now.getTime() - session.revoked_at.getTime();
    if (revokedAgoMs < 0 || revokedAgoMs > ROTATED_REFRESH_REPLAY_GRACE_MS) {
      return false;
    }

    return (
      session.ip === context.ip && session.user_agent === context.user_agent
    );
  }

  private normalizeContext(
    context?: AuthRequestContext,
  ): NormalizedAuthRequestContext {
    const ip = context?.ip?.trim() ?? '';
    const userAgent = context?.user_agent?.trim() ?? '';

    return {
      ip: ip ? ip.slice(0, 64) : null,
      user_agent: userAgent ? userAgent.slice(0, 512) : null,
    };
  }

  private generateCsrfToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashCsrfToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashMfaChallengeJti(jti: string): string {
    return createHash('sha256').update(`mfa:${jti}`).digest('hex');
  }

  private csrfTokenMatches(token: string, storedHash: string): boolean {
    const tokenHash = this.hashCsrfToken(token);
    const left = Buffer.from(tokenHash, 'utf8');
    const right = Buffer.from(storedHash, 'utf8');

    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }

  private toJwtExpiresIn(
    value: string | undefined,
    fallback: JwtExpiresIn,
  ): JwtExpiresIn {
    if (!value?.trim()) return fallback;

    const normalized = value.trim();
    if (/^\d+$/.test(normalized)) {
      return Number(normalized);
    }

    return normalized as JwtExpiresIn;
  }
}
