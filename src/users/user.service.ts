import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { EntityManager, ILike, IsNull, MoreThan, Repository } from 'typeorm';
import { Tenant } from '../tenant/entities/tenant.entity';
import { CreateTenantAdminDto } from './dto/create-tenant-admin.dto';
import { UpdateTenantAdminDto } from './dto/update-tenant-admin.dto';
import { AuditService } from '../audit/audit.service';
import { CurrentJwtUser } from '../auth/types';
import { AccountAccessService } from '../auth/account-access.service';
import { AuthSession } from '../auth/entities/auth-session.entity';
import {
  PaginatedResponse,
  PaginationQueryDto,
} from '../common/dto/pagination-query.dto';

type TenantAdminResponse = {
  id: string;
  created_at: Date;
  updated_at: Date;
  name: string;
  email: string;
  role: 'TENANT_ADMIN';
  tenant_id: string;
  is_active: boolean;
  invited_at: Date | null;
  email_verified_at: Date | null;
  onboarding_completed_at: Date | null;
  access_state: 'INVITED' | 'PENDING_SETUP' | 'ACTIVE';
  tenant: {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
  } | null;
};

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    private readonly auditService: AuditService,
    private readonly accountAccessService: AccountAccessService,
  ) {}

  async findTenantAdmins(
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<TenantAdminResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const search = query.q?.trim();
    const [tenantAdmins, total] = await this.usersRepo.findAndCount({
      where: search
        ? [
            { role: 'TENANT_ADMIN', name: ILike(`%${search}%`) },
            { role: 'TENANT_ADMIN', email: ILike(`%${search}%`) },
          ]
        : { role: 'TENANT_ADMIN' },
      relations: { tenant: true },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: tenantAdmins.map((tenantAdmin) =>
        this.toTenantAdminResponse(tenantAdmin),
      ),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findTenantAdminById(id: string): Promise<TenantAdminResponse> {
    const tenantAdmin = await this.findTenantAdminEntityById(id);
    return this.toTenantAdminResponse(tenantAdmin);
  }

  async createTenantAdmin(
    dto: CreateTenantAdminDto,
    currentUser: CurrentJwtUser,
  ): Promise<TenantAdminResponse> {
    const email = dto.email.toLowerCase().trim();
    const existingEmail = await this.usersRepo.findOneBy({ email });
    if (existingEmail) {
      throw new ConflictException('Ya existe un usuario con ese correo.');
    }

    await this.ensureTenantExists(dto.tenant_id);

    const newTenantAdmin = this.usersRepo.create({
      name: dto.name.trim(),
      email,
      password_hash: null,
      role: 'TENANT_ADMIN',
      tenant_id: dto.tenant_id,
      invited_at: new Date(),
      email_verified_at: null,
      onboarding_completed_at: null,
    });

    const created = await this.usersRepo.save(newTenantAdmin);

    try {
      await this.accountAccessService.issueTenantAdminInvitation(
        created,
        currentUser,
      );
    } catch (error) {
      await this.usersRepo.delete(created.id);
      throw error;
    }

    const tenantAdmin = await this.findTenantAdminEntityById(created.id);

    await this.auditService.log({
      actor_user_id: currentUser.sub,
      tenant_id: tenantAdmin.tenant_id,
      action: 'TENANT_ADMIN_CREATED',
      entity: 'user',
      entity_id: tenantAdmin.id,
      metadata: {
        name: tenantAdmin.name,
        email: tenantAdmin.email,
        tenant_id: tenantAdmin.tenant_id,
        access_state: this.resolveAccessState(tenantAdmin),
      },
    });

    return this.toTenantAdminResponse(tenantAdmin);
  }

  async updateTenantAdmin(
    id: string,
    dto: UpdateTenantAdminDto,
    currentUser: CurrentJwtUser,
  ): Promise<TenantAdminResponse> {
    const result = await this.usersRepo.manager.transaction(async (manager) => {
      const usersRepo = manager.getRepository(User);
      const tenantAdmin = await usersRepo.findOne({
        where: { id, role: 'TENANT_ADMIN' },
        relations: { tenant: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!tenantAdmin) {
        throw new NotFoundException('Administrador del negocio no encontrado.');
      }

      const previousIsActive = tenantAdmin.is_active;
      const previousEmail = tenantAdmin.email;
      const now = new Date();
      let emailChanged = false;

      if (dto.email !== undefined) {
        const normalizedEmail = dto.email.trim().toLowerCase();
        const existingEmail = await usersRepo.findOneBy({
          email: normalizedEmail,
        });
        if (existingEmail && existingEmail.id !== tenantAdmin.id) {
          throw new ConflictException('Ya existe un usuario con ese correo.');
        }

        emailChanged = normalizedEmail !== previousEmail;
        if (emailChanged) {
          tenantAdmin.email = normalizedEmail;
          tenantAdmin.password_hash = null;
          tenantAdmin.email_verified_at = null;
          tenantAdmin.onboarding_completed_at = null;
          tenantAdmin.invited_at = now;
        }
      }

      if (dto.name !== undefined) {
        tenantAdmin.name = dto.name.trim();
      }

      if (dto.is_active !== undefined) {
        tenantAdmin.is_active = dto.is_active;
      }

      const disabled = previousIsActive && tenantAdmin.is_active === false;
      const shouldRevokeSessions = emailChanged || disabled;
      let revokedSessions = 0;

      if (shouldRevokeSessions) {
        tenantAdmin.token_version = (tenantAdmin.token_version ?? 0) + 1;
        revokedSessions = await this.revokeActiveSessionsForUser(
          manager,
          tenantAdmin.id,
          emailChanged ? 'EMAIL_CHANGED' : 'USER_DISABLED',
        );
      }

      await usersRepo.save(tenantAdmin);

      return {
        tenantAdminId: tenantAdmin.id,
        previousIsActive,
        emailChanged,
        revokedSessions,
      };
    });

    const updatedTenantAdmin = await this.findTenantAdminEntityById(
      result.tenantAdminId,
    );
    const statusChanged =
      dto.is_active !== undefined &&
      result.previousIsActive !== updatedTenantAdmin.is_active;
    const action = statusChanged
      ? updatedTenantAdmin.is_active
        ? 'TENANT_ADMIN_ENABLED'
        : 'TENANT_ADMIN_DISABLED'
      : result.emailChanged
        ? 'TENANT_ADMIN_EMAIL_CHANGED'
        : 'TENANT_ADMIN_UPDATED';

    if (result.emailChanged && updatedTenantAdmin.is_active) {
      try {
        await this.accountAccessService.issueTenantAdminInvitation(
          updatedTenantAdmin,
          currentUser,
        );
      } catch (error) {
        await this.auditService.log({
          actor_user_id: currentUser.sub,
          tenant_id: updatedTenantAdmin.tenant_id,
          action: 'TENANT_ADMIN_INVITATION_FAILED',
          entity: 'user',
          entity_id: updatedTenantAdmin.id,
          metadata: {
            email: updatedTenantAdmin.email,
            reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
          },
        });
        throw error;
      }
    }

    await this.auditService.log({
      actor_user_id: currentUser.sub,
      tenant_id: updatedTenantAdmin.tenant_id,
      action,
      entity: 'user',
      entity_id: updatedTenantAdmin.id,
      metadata: {
        name: updatedTenantAdmin.name,
        email: updatedTenantAdmin.email,
        is_active: updatedTenantAdmin.is_active,
        updated_fields: Object.keys(dto),
        email_changed: result.emailChanged,
        sessions_revoked: result.revokedSessions,
        access_state: this.resolveAccessState(updatedTenantAdmin),
      },
    });

    return this.toTenantAdminResponse(updatedTenantAdmin);
  }

  private async ensureTenantExists(tenantId: string): Promise<void> {
    const existingTenant = await this.tenantRepo.findOneBy({
      id: tenantId,
    });
    if (!existingTenant) {
      throw new NotFoundException('No existe un negocio con ese ID.');
    }
  }

  private async findTenantAdminEntityById(id: string): Promise<User> {
    const tenantAdmin = await this.usersRepo.findOne({
      where: { id, role: 'TENANT_ADMIN' },
      relations: { tenant: true },
    });

    if (!tenantAdmin) {
      throw new NotFoundException('Administrador del negocio no encontrado.');
    }

    return tenantAdmin;
  }

  private async revokeActiveSessionsForUser(
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

  private toTenantAdminResponse(user: User): TenantAdminResponse {
    if (!user.tenant_id) {
      throw new NotFoundException(
        'Administrador del negocio sin negocio asignado.',
      );
    }

    return {
      id: user.id,
      created_at: user.created_at,
      updated_at: user.updated_at,
      name: user.name,
      email: user.email,
      role: 'TENANT_ADMIN',
      tenant_id: user.tenant_id,
      is_active: user.is_active,
      invited_at: user.invited_at,
      email_verified_at: user.email_verified_at,
      onboarding_completed_at: user.onboarding_completed_at,
      access_state: this.resolveAccessState(user),
      tenant: user.tenant
        ? {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
            is_active: user.tenant.is_active,
          }
        : null,
    };
  }

  private resolveAccessState(
    user: User,
  ): 'INVITED' | 'PENDING_SETUP' | 'ACTIVE' {
    if (!user.email_verified_at) {
      return 'INVITED';
    }

    if (!user.password_hash || !user.onboarding_completed_at) {
      return 'PENDING_SETUP';
    }

    return 'ACTIVE';
  }
}
