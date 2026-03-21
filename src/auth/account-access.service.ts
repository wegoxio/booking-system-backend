import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { EntityManager, IsNull, MoreThan, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Tenant } from '../tenant/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import type { CurrentJwtUser } from './types';
import { AuthSession } from './entities/auth-session.entity';
import {
  UserAccessToken,
  type UserAccessTokenType,
} from './entities/user-access-token.entity';

type AuthRequestContext = {
  ip?: string | null;
  user_agent?: string | null;
};

type NormalizedAuthRequestContext = {
  ip: string | null;
  user_agent: string | null;
};

const DEFAULT_INVITATION_EXPIRES_HOURS = 72;
const DEFAULT_PASSWORD_RESET_EXPIRES_MINUTES = 60;

@Injectable()
export class AccountAccessService {
  private readonly appPublicUrl: string;
  private readonly invitationExpiresMs: number;
  private readonly passwordResetExpiresMs: number;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(UserAccessToken)
    private readonly userAccessTokensRepo: Repository<UserAccessToken>,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {
    this.appPublicUrl = this.configService
      .get<string>('APP_PUBLIC_URL', '')
      .replace(/\/+$/, '');
    this.invitationExpiresMs =
      Math.max(
        1,
        this.configService.get<number>(
          'AUTH_TENANT_ADMIN_INVITE_EXPIRES_HOURS',
          DEFAULT_INVITATION_EXPIRES_HOURS,
        ),
      ) *
      60 *
      60 *
      1000;
    this.passwordResetExpiresMs =
      Math.max(
        1,
        this.configService.get<number>(
          'AUTH_PASSWORD_RESET_EXPIRES_MINUTES',
          DEFAULT_PASSWORD_RESET_EXPIRES_MINUTES,
        ),
      ) *
      60 *
      1000;
  }

  async issueTenantAdminInvitation(
    user: User,
    requestedBy: CurrentJwtUser,
  ): Promise<{ expires_at: Date }> {
    const freshUser = await this.loadUserWithTenant(user.id);
    return this.sendTenantAdminSetupLink(freshUser, {
      requestedByUserId: requestedBy.sub,
      auditAction: 'TENANT_ADMIN_INVITATION_SENT',
      auditMetadata: {
        requested_by_user_id: requestedBy.sub,
      },
    });
  }

  async requestPasswordRecovery(
    email: string,
    context?: AuthRequestContext,
  ): Promise<{ success: true }> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return { success: true };
    }

    const normalizedContext = this.normalizeContext(context);
    const user = await this.usersRepo.findOne({
      where: { email: normalizedEmail },
      relations: { tenant: true },
    });

    if (!user || !user.is_active) {
      return { success: true };
    }

    if (
      user.role === 'TENANT_ADMIN' &&
      (!user.tenant_id || !user.tenant || !user.tenant.is_active)
    ) {
      return { success: true };
    }

    if (
      user.role === 'TENANT_ADMIN' &&
      (!user.email_verified_at || !user.password_hash || !user.onboarding_completed_at)
    ) {
      await this.sendTenantAdminSetupLink(user, {
        requestedByUserId: null,
        auditAction: 'AUTH_ACCESS_SETUP_LINK_SENT',
        auditMetadata: {
          reason: 'PENDING_ONBOARDING',
        },
      });

      return { success: true };
    }

    const createdToken = await this.createAccessToken(user, {
      type: 'PASSWORD_RESET',
      requestedByUserId: null,
      expiresInMs: this.passwordResetExpiresMs,
    });
    const resetUrl = this.buildPublicUrl(
      `/reset-password?token=${encodeURIComponent(createdToken.rawToken)}`,
    );

    await this.notificationsService.sendPasswordResetEmail({
      email: user.email,
      name: user.name,
      businessName: user.tenant?.name ?? 'Wegox Booking',
      resetUrl,
      expiresAt: createdToken.expiresAt,
      idempotencyKey: this.buildEmailIdempotencyKey(
        'password-reset',
        user.id,
        createdToken.expiresAt,
      ),
    });

    await this.auditService.log({
      actor_user_id: user.id,
      tenant_id: user.tenant_id ?? null,
      action: 'AUTH_PASSWORD_RESET_REQUESTED',
      entity: 'auth',
      entity_id: user.id,
      metadata: {
        email: user.email,
      },
      ip: normalizedContext.ip,
      user_agent: normalizedContext.user_agent,
    });

    return { success: true };
  }

  async resolveTenantAdminOnboarding(rawToken: string): Promise<{
    email: string;
    name: string;
    tenant: {
      id: string;
      name: string;
      slug: string;
    };
    expires_at: Date;
    email_verified_at: Date;
  }> {
    const result = await this.userAccessTokensRepo.manager.transaction(async (manager) => {
      const token = await this.findActiveTokenForUpdate(
        manager,
        'TENANT_ADMIN_INVITATION',
        rawToken,
      );
      const user = await this.loadTokenUserForUpdate(manager, token.user_id);

      this.assertTenantAdminSetupUser(user, token.email_snapshot);

      const now = new Date();
      let didVerifyEmail = false;
      if (!user.email_verified_at) {
        user.email_verified_at = now;
        await manager.getRepository(User).save(user);
        didVerifyEmail = true;
      }

      return {
        email: user.email,
        name: user.name,
        tenant: {
          id: user.tenant!.id,
          name: user.tenant!.name,
          slug: user.tenant!.slug,
        },
        expires_at: token.expires_at,
        email_verified_at: user.email_verified_at ?? now,
        did_verify_email: didVerifyEmail,
        user_id: user.id,
        tenant_id: user.tenant_id ?? null,
      };
    });

    if (result.did_verify_email) {
      await this.auditService.log({
        actor_user_id: result.user_id,
        tenant_id: result.tenant_id,
        action: 'AUTH_EMAIL_VERIFIED',
        entity: 'auth',
        entity_id: result.user_id,
        metadata: {
          via: 'TENANT_ADMIN_INVITATION',
        },
      });
    }

    return {
      email: result.email,
      name: result.name,
      tenant: result.tenant,
      expires_at: result.expires_at,
      email_verified_at: result.email_verified_at,
    };
  }

  async completeTenantAdminOnboarding(
    input: {
      token: string;
      name: string;
      password: string;
    },
    context?: AuthRequestContext,
  ): Promise<{ success: true; email: string }> {
    const normalizedContext = this.normalizeContext(context);

    const result = await this.userAccessTokensRepo.manager.transaction(async (manager) => {
      const token = await this.findActiveTokenForUpdate(
        manager,
        'TENANT_ADMIN_INVITATION',
        input.token,
      );
      const usersRepo = manager.getRepository(User);
      const user = await this.loadTokenUserForUpdate(manager, token.user_id);

      this.assertTenantAdminSetupUser(user, token.email_snapshot);

      const now = new Date();
      user.name = input.name.trim();
      user.password_hash = await argon2.hash(input.password);
      user.email_verified_at = user.email_verified_at ?? now;
      user.onboarding_completed_at = now;
      user.failed_login_attempts = 0;
      user.last_failed_login_at = null;
      user.locked_until = null;
      await usersRepo.save(user);

      token.consumed_at = now;
      await manager.getRepository(UserAccessToken).save(token);
      await this.invalidateOtherActiveTokens(manager, user.id, now, token.id);

      return {
        success: true,
        email: user.email,
        user_id: user.id,
        tenant_id: user.tenant_id ?? null,
      };
    });

    await this.auditService.log({
      actor_user_id: result.user_id,
      tenant_id: result.tenant_id,
      action: 'AUTH_TENANT_ADMIN_ONBOARDING_COMPLETED',
      entity: 'auth',
      entity_id: result.user_id,
      metadata: {
        email: result.email,
      },
      ip: normalizedContext.ip,
      user_agent: normalizedContext.user_agent,
    });

    return {
      success: true,
      email: result.email,
    };
  }

  async resolvePasswordReset(rawToken: string): Promise<{
    email: string;
    name: string;
    expires_at: Date;
  }> {
    const token = await this.findActiveTokenByValue('PASSWORD_RESET', rawToken);
    const user = await this.usersRepo.findOne({
      where: { id: token.user_id },
    });

    if (!user || !user.is_active || token.email_snapshot !== user.email) {
      throw new UnauthorizedException('Enlace inválido o expirado.');
    }

    return {
      email: user.email,
      name: user.name,
      expires_at: token.expires_at,
    };
  }

  async completePasswordReset(
    input: {
      token: string;
      password: string;
    },
    context?: AuthRequestContext,
  ): Promise<{ success: true; email: string }> {
    const normalizedContext = this.normalizeContext(context);

    const result = await this.userAccessTokensRepo.manager.transaction(async (manager) => {
      const token = await this.findActiveTokenForUpdate(
        manager,
        'PASSWORD_RESET',
        input.token,
      );
      const usersRepo = manager.getRepository(User);
      const user = await usersRepo.findOne({
        where: { id: token.user_id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user || !user.is_active || token.email_snapshot !== user.email) {
        throw new UnauthorizedException('Enlace inválido o expirado.');
      }

      const now = new Date();
      user.password_hash = await argon2.hash(input.password);
      user.failed_login_attempts = 0;
      user.last_failed_login_at = null;
      user.locked_until = null;
      user.token_version = (user.token_version ?? 0) + 1;
      await usersRepo.save(user);

      token.consumed_at = now;
      await manager.getRepository(UserAccessToken).save(token);
      await this.invalidateOtherActiveTokens(manager, user.id, now, token.id);
      await this.revokeAllActiveSessionsForUser(manager, user.id, 'PASSWORD_RESET');

      return {
        success: true,
        email: user.email,
        user_id: user.id,
        tenant_id: user.tenant_id ?? null,
      };
    });

    await this.auditService.log({
      actor_user_id: result.user_id,
      tenant_id: result.tenant_id,
      action: 'AUTH_PASSWORD_RESET_COMPLETED',
      entity: 'auth',
      entity_id: result.user_id,
      metadata: {
        email: result.email,
      },
      ip: normalizedContext.ip,
      user_agent: normalizedContext.user_agent,
    });

    return {
      success: true,
      email: result.email,
    };
  }

  private async sendTenantAdminSetupLink(
    user: User,
    input: {
      requestedByUserId: string | null;
      auditAction: string;
      auditMetadata?: Record<string, unknown> | null;
    },
  ): Promise<{ expires_at: Date }> {
    const freshUser = await this.loadUserWithTenant(user.id);
    this.assertTenantAdminSetupUser(freshUser, freshUser.email);

    const createdToken = await this.createAccessToken(freshUser, {
      type: 'TENANT_ADMIN_INVITATION',
      requestedByUserId: input.requestedByUserId,
      expiresInMs: this.invitationExpiresMs,
    });

    const setupUrl = this.buildPublicUrl(
      `/activate-account?token=${encodeURIComponent(createdToken.rawToken)}`,
    );

    await this.notificationsService.sendTenantAdminInvitationEmail({
      email: freshUser.email,
      name: freshUser.name,
      tenantName: freshUser.tenant!.name,
      setupUrl,
      expiresAt: createdToken.expiresAt,
      idempotencyKey: this.buildEmailIdempotencyKey(
        'tenant-admin-invitation',
        freshUser.id,
        createdToken.expiresAt,
      ),
    });

    await this.auditService.log({
      actor_user_id: input.requestedByUserId ?? freshUser.id,
      tenant_id: freshUser.tenant_id ?? null,
      action: input.auditAction,
      entity: 'user',
      entity_id: freshUser.id,
      metadata: {
        email: freshUser.email,
        expires_at: createdToken.expiresAt.toISOString(),
        ...(input.auditMetadata ?? {}),
      },
    });

    return {
      expires_at: createdToken.expiresAt,
    };
  }

  private async createAccessToken(
    user: User,
    input: {
      type: UserAccessTokenType;
      requestedByUserId: string | null;
      expiresInMs: number;
    },
  ): Promise<{ rawToken: string; expiresAt: Date }> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + input.expiresInMs);
    const rawToken = this.generateRawToken();
    const tokenHash = this.hashToken(rawToken);

    await this.userAccessTokensRepo.manager.transaction(async (manager) => {
      await this.invalidateActiveTokensByType(
        manager,
        user.id,
        input.type,
        now,
      );

      const repo = manager.getRepository(UserAccessToken);
      const token = repo.create({
        user_id: user.id,
        type: input.type,
        token_hash: tokenHash,
        email_snapshot: user.email,
        requested_by_user_id: input.requestedByUserId,
        expires_at: expiresAt,
        consumed_at: null,
        invalidated_at: null,
        metadata:
          input.type === 'TENANT_ADMIN_INVITATION'
            ? {
                tenant_id: user.tenant_id,
              }
            : null,
      });

      await repo.save(token);
    });

    return {
      rawToken,
      expiresAt,
    };
  }

  private async findActiveTokenByValue(
    type: UserAccessTokenType,
    rawToken: string,
  ): Promise<UserAccessToken> {
    const tokenHash = this.hashToken(rawToken.trim());
    const token = await this.userAccessTokensRepo.findOne({
      where: {
        type,
        token_hash: tokenHash,
        consumed_at: IsNull(),
        invalidated_at: IsNull(),
        expires_at: MoreThan(new Date()),
      },
    });

    if (!token) {
      throw new UnauthorizedException('Enlace inválido o expirado.');
    }

    return token;
  }

  private async findActiveTokenForUpdate(
    manager: EntityManager,
    type: UserAccessTokenType,
    rawToken: string,
  ): Promise<UserAccessToken> {
    const tokenHash = this.hashToken(rawToken.trim());
    const token = await manager.getRepository(UserAccessToken).findOne({
      where: {
        type,
        token_hash: tokenHash,
      },
      lock: { mode: 'pessimistic_write' },
    });

    const now = new Date();
    if (
      !token ||
      token.consumed_at ||
      token.invalidated_at ||
      token.expires_at.getTime() <= now.getTime()
    ) {
      throw new UnauthorizedException('Enlace inválido o expirado.');
    }

    return token;
  }

  private async loadTokenUserForUpdate(
    manager: EntityManager,
    userId: string,
  ): Promise<User> {
    const user = await manager.getRepository(User).findOne({
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!user) {
      throw new UnauthorizedException('Enlace inválido o expirado.');
    }

    user.tenant = user.tenant_id
      ? await manager.getRepository(Tenant).findOne({
          where: { id: user.tenant_id },
        })
      : null;

    return user;
  }

  private async loadUserWithTenant(userId: string): Promise<User> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario inválido.');
    }

    return user;
  }

  private assertTenantAdminSetupUser(user: User, expectedEmail: string): void {
    if (
      !user.is_active ||
      user.role !== 'TENANT_ADMIN' ||
      !user.tenant_id ||
      !user.tenant ||
      !user.tenant.is_active ||
      user.email !== expectedEmail
    ) {
      throw new UnauthorizedException('Enlace inválido o expirado.');
    }
  }

  private buildPublicUrl(pathname: string): string {
    if (!this.appPublicUrl) {
      throw new InternalServerErrorException('APP_PUBLIC_URL no configurada.');
    }

    return new URL(pathname, `${this.appPublicUrl}/`).toString();
  }

  private buildEmailIdempotencyKey(
    prefix: string,
    userId: string,
    expiresAt: Date,
  ): string {
    return `${prefix}/${userId}/${expiresAt.toISOString()}`.slice(0, 256);
  }

  private generateRawToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async invalidateActiveTokensByType(
    manager: EntityManager,
    userId: string,
    type: UserAccessTokenType,
    now: Date,
  ): Promise<void> {
    await manager.getRepository(UserAccessToken).update(
      {
        user_id: userId,
        type,
        consumed_at: IsNull(),
        invalidated_at: IsNull(),
        expires_at: MoreThan(now),
      },
      {
        invalidated_at: now,
      },
    );
  }

  private async invalidateOtherActiveTokens(
    manager: EntityManager,
    userId: string,
    now: Date,
    excludedTokenId: string,
  ): Promise<void> {
    const tokens = await manager.getRepository(UserAccessToken).find({
      where: {
        user_id: userId,
        consumed_at: IsNull(),
        invalidated_at: IsNull(),
        expires_at: MoreThan(now),
      },
    });

    const activeTokenIds = tokens
      .map((token) => token.id)
      .filter((tokenId) => tokenId !== excludedTokenId);

    if (activeTokenIds.length === 0) {
      return;
    }

    await manager.getRepository(UserAccessToken).update(
      activeTokenIds,
      {
        invalidated_at: now,
      },
    );
  }

  private async revokeAllActiveSessionsForUser(
    manager: EntityManager,
    userId: string,
    reason: string,
  ): Promise<void> {
    const now = new Date();

    await manager.getRepository(AuthSession).update(
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
}
