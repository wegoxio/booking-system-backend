import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { Tenant } from 'src/tenant/entities/tenant.entity';
import { CreateTenantAdminDto } from './dto/create-tenant-admin.dto';
import { UpdateTenantAdminDto } from './dto/update-tenant-admin.dto';
import { AuditService } from 'src/audit/audit.service';
import { CurrentJwtUser } from 'src/auth/types';
import { AccountAccessService } from 'src/auth/account-access.service';

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

  async findTenantAdmins(): Promise<TenantAdminResponse[]> {
    const tenantAdmins = await this.usersRepo.find({
      where: { role: 'TENANT_ADMIN' },
      relations: { tenant: true },
      order: { created_at: 'DESC' },
    });

    return tenantAdmins.map((tenantAdmin) => this.toTenantAdminResponse(tenantAdmin));
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
      await this.accountAccessService.issueTenantAdminInvitation(created, currentUser);
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
    const tenantAdmin = await this.findTenantAdminEntityById(id);

    if (dto.email !== undefined) {
      const normalizedEmail = dto.email.trim().toLowerCase();
      const existingEmail = await this.usersRepo.findOneBy({ email: normalizedEmail });
      if (existingEmail && existingEmail.id !== tenantAdmin.id) {
        throw new ConflictException('Ya existe un usuario con ese correo.');
      }

      tenantAdmin.email = normalizedEmail;
    }

    if (dto.name !== undefined) {
      tenantAdmin.name = dto.name.trim();
    }

    if (dto.tenant_id !== undefined) {
      await this.ensureTenantExists(dto.tenant_id);
      tenantAdmin.tenant_id = dto.tenant_id;
    }

    if (dto.is_active !== undefined) {
      tenantAdmin.is_active = dto.is_active;
    }

    await this.usersRepo.save(tenantAdmin);
    const updatedTenantAdmin = await this.findTenantAdminEntityById(tenantAdmin.id);

    await this.auditService.log({
      actor_user_id: currentUser.sub,
      tenant_id: updatedTenantAdmin.tenant_id,
      action: 'TENANT_ADMIN_UPDATED',
      entity: 'user',
      entity_id: updatedTenantAdmin.id,
      metadata: {
        updated_fields: Object.keys(dto),
      },
    });

    return this.toTenantAdminResponse(updatedTenantAdmin);
  }

  async removeTenantAdmin(
    id: string,
    currentUser: CurrentJwtUser,
  ): Promise<{ id: string }> {
    const tenantAdmin = await this.findTenantAdminEntityById(id);
    await this.usersRepo.remove(tenantAdmin);

    await this.auditService.log({
      actor_user_id: currentUser.sub,
      tenant_id: tenantAdmin.tenant_id,
      action: 'TENANT_ADMIN_DELETED',
      entity: 'user',
      entity_id: tenantAdmin.id,
      metadata: {
        name: tenantAdmin.name,
        email: tenantAdmin.email,
      },
    });

    return { id };
  }

  private async ensureTenantExists(tenantId: string): Promise<void> {
    const existingTenant = await this.tenantRepo.findOneBy({
      id: tenantId,
    });
    if (!existingTenant) {
      throw new NotFoundException('No existe un tenant con ese ID.');
    }
  }

  private async findTenantAdminEntityById(id: string): Promise<User> {
    const tenantAdmin = await this.usersRepo.findOne({
      where: { id, role: 'TENANT_ADMIN' },
      relations: { tenant: true },
    });

    if (!tenantAdmin) {
      throw new NotFoundException('Tenant admin no encontrado.');
    }

    return tenantAdmin;
  }

  private toTenantAdminResponse(user: User): TenantAdminResponse {
    if (!user.tenant_id) {
      throw new NotFoundException('Tenant admin sin tenant asignado.');
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
