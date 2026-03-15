import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { EntityManager, IsNull, MoreThan, Repository } from 'typeorm';
import { LoginDto } from './dto/login.dto';
import { User } from 'src/users/entities/user.entity';
import { AuditService } from 'src/audit/audit.service';
import { AuthSession } from './entities/auth-session.entity';
import {
  AuthTokensBundle,
  CurrentJwtUser,
  JwtPayload,
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
type JwtExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;

@Injectable()
export class AuthService {
  private readonly refreshTokenSecret: string;
  private readonly refreshTokenExpiresIn: JwtExpiresIn;
  private readonly maxFailedAttempts: number;
  private readonly lockMinutes: number;
  private readonly failedAttemptsResetMinutes: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwt: JwtService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(AuthSession)
    private readonly authSessionsRepo: Repository<AuthSession>,
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
  }

  async login(
    dto: LoginDto,
    context?: AuthRequestContext,
  ): Promise<AuthTokensBundle> {
    const normalizedContext = this.normalizeContext(context);
    const email = dto.email.toLowerCase().trim();

    const user = await this.usersRepo.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('Credenciales Invalidas.');

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
      throw new UnauthorizedException('Credenciales Invalidas.');
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
      throw new ForbiddenException('Credenciales Invalidas.');
    }

    const passwordMatches = await argon2.verify(user.password_hash, dto.password);
    if (!passwordMatches) {
      await this.registerFailedLoginAttempt(user.id, normalizedContext);
      throw new UnauthorizedException('Credenciales Invalidas.');
    }

    const validatedUser = await this.ensureUserAndTenantContextForSession(user.id);
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
      throw new UnauthorizedException('Sesion invalida.');
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
        throw new UnauthorizedException('Sesion invalida.');
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
        throw new UnauthorizedException('Sesion invalida.');
      }

      if (currentSession.revoked_at) {
        await this.revokeAllActiveSessionsForUser(manager, user.id, 'REUSE_DETECTED');
        await this.auditService.log({
          actor_user_id: user.id,
          tenant_id: user.tenant_id ?? null,
          action: 'AUTH_REFRESH_REUSE_DETECTED',
          entity: 'auth',
          entity_id: user.id,
          metadata: {
            session_id: currentSession.id,
            reason: 'SESSION_ALREADY_REVOKED',
          },
          ip: normalizedContext.ip,
          user_agent: normalizedContext.user_agent,
        });
        throw new UnauthorizedException('Sesion invalida.');
      }

      if (currentSession.token_jti !== payload.jti) {
        await this.revokeAllActiveSessionsForUser(manager, user.id, 'REUSE_DETECTED');
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
        throw new UnauthorizedException('Sesion invalida.');
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
        throw new UnauthorizedException('Sesion expirada.');
      }

      const refreshTokenMatches = await argon2.verify(
        currentSession.refresh_token_hash,
        token,
      );
      if (!refreshTokenMatches) {
        await this.revokeAllActiveSessionsForUser(manager, user.id, 'REUSE_DETECTED');
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
        throw new UnauthorizedException('Sesion invalida.');
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

    const now = new Date();
    const session = await this.authSessionsRepo.findOne({
      where: { id: payload.sid, user_id: payload.sub },
    });

    if (!session) {
      return { success: true };
    }

    if (!this.csrfTokenMatches(csrfToken, session.csrf_token_hash)) {
      throw new UnauthorizedException('Sesion invalida.');
    }

    if (!session.revoked_at) {
      session.revoked_at = now;
      session.revocation_reason = 'LOGOUT';
      session.last_used_at = now;
      await this.authSessionsRepo.save(session);
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
        session_id: session.id,
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

    return this.usersRepo.manager.transaction(async (manager) => {
      const usersRepo = manager.getRepository(User);
      const lockedUser = await usersRepo.findOne({
        where: { id: currentUser.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedUser) {
        throw new UnauthorizedException('Usuario invalido.');
      }

      lockedUser.token_version = (lockedUser.token_version ?? 0) + 1;
      await usersRepo.save(lockedUser);

      const revokedCount = await this.revokeAllActiveSessionsForUser(
        manager,
        currentUser.id,
        'LOGOUT_ALL',
      );

      await this.auditService.log({
        actor_user_id: currentUser.id,
        tenant_id: currentUser.tenant_id ?? null,
        action: 'AUTH_LOGOUT_ALL',
        entity: 'auth',
        entity_id: currentUser.id,
        metadata: {
          revoked_sessions: revokedCount,
          new_token_version: lockedUser.token_version,
        },
        ip: normalizedContext.ip,
        user_agent: normalizedContext.user_agent,
      });

      return {
        success: true,
        revoked_sessions: revokedCount,
      };
    });
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
        throw new UnauthorizedException('Sesion invalida.');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Sesion invalida.');
    }
  }

  private async ensureUserAndTenantContextForSession(userId: string): Promise<User> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: { tenant: true },
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedException('Usuario invalido.');
    }

    if (user.role === 'TENANT_ADMIN') {
      if (!user.tenant_id || !user.tenant) {
        throw new ForbiddenException('Tenant context missing');
      }

      if (!user.tenant.is_active) {
        throw new ForbiddenException('Tenant disabled');
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
        throw new UnauthorizedException('Usuario invalido.');
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

  private shouldResetFailedAttempts(lastFailedAt: Date | null, now: Date): boolean {
    if (!lastFailedAt) return false;
    const resetThresholdMs = this.failedAttemptsResetMinutes * 60_000;
    return now.getTime() - lastFailedAt.getTime() >= resetThresholdMs;
  }

  private async registerFailedLoginAttempt(
    userId: string,
    context: NormalizedAuthRequestContext,
  ): Promise<void> {
    const now = new Date();

    await this.usersRepo.manager.transaction(async (manager) => {
      const usersRepo = manager.getRepository(User);
      const lockedUser = await usersRepo.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedUser) return;

      let attempts = lockedUser.failed_login_attempts ?? 0;
      if (this.shouldResetFailedAttempts(lockedUser.last_failed_login_at, now)) {
        attempts = 0;
      }

      attempts += 1;
      lockedUser.failed_login_attempts = attempts;
      lockedUser.last_failed_login_at = now;

      let accountLocked = false;
      if (attempts >= this.maxFailedAttempts) {
        lockedUser.locked_until = new Date(now.getTime() + this.lockMinutes * 60_000);
        accountLocked = true;
      }

      await usersRepo.save(lockedUser);

      await this.auditService.log({
        actor_user_id: lockedUser.id,
        tenant_id: lockedUser.tenant_id ?? null,
        action: 'AUTH_LOGIN_FAILED',
        entity: 'auth',
        entity_id: lockedUser.id,
        metadata: {
          failed_attempts: attempts,
          max_failed_attempts: this.maxFailedAttempts,
          locked_until: lockedUser.locked_until?.toISOString() ?? null,
        },
        ip: context.ip,
        user_agent: context.user_agent,
      });

      if (accountLocked) {
        await this.auditService.log({
          actor_user_id: lockedUser.id,
          tenant_id: lockedUser.tenant_id ?? null,
          action: 'AUTH_ACCOUNT_LOCKED',
          entity: 'auth',
          entity_id: lockedUser.id,
          metadata: {
            failed_attempts: attempts,
            lock_minutes: this.lockMinutes,
            locked_until: lockedUser.locked_until?.toISOString() ?? null,
          },
          ip: context.ip,
          user_agent: context.user_agent,
        });
      }
    });
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

  private buildRefreshPayload(user: User, session: AuthSession): RefreshJwtPayload {
    return {
      sub: user.id,
      sid: session.id,
      jti: session.token_jti,
      token_version: user.token_version ?? 0,
    };
  }

  private getRefreshTokenExpirationDate(refreshToken: string): Date {
    const decoded = this.jwt.decode(refreshToken) as { exp?: number } | null;
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
    const sessionRepo = (manager ?? this.authSessionsRepo.manager).getRepository(AuthSession);
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

    const accessToken = this.jwt.sign(this.buildAccessPayload(user, session.id));
    const refreshToken = this.jwt.sign(this.buildRefreshPayload(user, session), {
      secret: this.refreshTokenSecret,
      expiresIn: this.refreshTokenExpiresIn,
    });
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

  private normalizeContext(context?: AuthRequestContext): NormalizedAuthRequestContext {
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
