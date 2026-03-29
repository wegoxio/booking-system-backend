import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { Repository } from 'typeorm';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { AuditService } from '../audit/audit.service';
import { TenantSetting } from '../tenant-settings/entities/tenant-setting.entity';

type CurrentJwtUser = {
  sub: string;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN';
  tenant_id: string | null;
};

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant) private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(TenantSetting)
    private readonly tenantSettingsRepository: Repository<TenantSetting>,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateTenantDto, currentUser: CurrentJwtUser): Promise<Tenant> {
    const normalizedSlug = dto.slug.trim().toLowerCase();
    const existingTenant = await this.findBySlug(normalizedSlug);
    if (existingTenant) {
      throw new ConflictException('Ya existe un negocio con ese slug.');
    }

    const newTenant = this.tenantRepository.create({
      name: dto.name.trim(),
      slug: normalizedSlug,
    });
    const savedTenant = await this.tenantRepository.save(newTenant);

    await this.auditService.log({
      actor_user_id: currentUser.sub,
      tenant_id: null,
      action: 'TENANT_CREATED',
      entity: 'tenant',
      entity_id: savedTenant.id,
      metadata: {
        name: savedTenant.name,
        slug: savedTenant.slug,
      },
    });

    return savedTenant;
  }

  async findBySlug(slug: string) {
    return this.tenantRepository.findOneBy({ slug: slug.trim().toLowerCase() });
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOneBy({ id });
    if (!tenant) {
      throw new NotFoundException('Negocio no encontrado.');
    }
    return tenant;
  }

  async findAll(): Promise<Array<Tenant & { tenant_logo_url: string | null }>> {
    const tenants = await this.tenantRepository.find({
      order: { created_at: 'DESC' },
    });

    const logosByTenant = await this.getTenantLogosByTenantId(
      tenants.map((tenant) => tenant.id),
    );

    return tenants.map((tenant) => ({
      ...tenant,
      tenant_logo_url: logosByTenant.get(tenant.id) ?? null,
    }));
  }

  async update(
    id: string,
    dto: UpdateTenantDto,
    currentUser: CurrentJwtUser,
  ): Promise<Tenant> {
    const tenant = await this.findOne(id);
    const previousIsActive = tenant.is_active;

    if (dto.slug !== undefined) {
      const normalizedSlug = dto.slug.trim().toLowerCase();
      const existingTenant = await this.findBySlug(normalizedSlug);

      if (existingTenant && existingTenant.id !== tenant.id) {
        throw new ConflictException('Ya existe un negocio con ese slug.');
      }

      tenant.slug = normalizedSlug;
    }

    if (dto.name !== undefined) {
      tenant.name = dto.name.trim();
    }

    if (dto.is_active !== undefined) {
      tenant.is_active = dto.is_active;
    }

    const updated = await this.tenantRepository.save(tenant);
    const statusChanged = dto.is_active !== undefined && previousIsActive !== updated.is_active;
    const action = statusChanged
      ? updated.is_active
        ? 'TENANT_ENABLED'
        : 'TENANT_DISABLED'
      : 'TENANT_UPDATED';

    await this.auditService.log({
      actor_user_id: currentUser.sub,
      tenant_id: null,
      action,
      entity: 'tenant',
      entity_id: updated.id,
      metadata: {
        name: updated.name,
        slug: updated.slug,
        is_active: updated.is_active,
        updated_fields: Object.keys(dto),
      },
    });

    return updated;
  }

  private async getTenantLogosByTenantId(
    tenantIds: string[],
  ): Promise<Map<string, string | null>> {
    if (tenantIds.length === 0) {
      return new Map();
    }

    const rows = await this.tenantSettingsRepository
      .createQueryBuilder('settings')
      .select('settings.tenant_id', 'tenant_id')
      .addSelect('settings.logo_url', 'logo_url')
      .where('settings.tenant_id IN (:...tenantIds)', { tenantIds })
      .getRawMany<{
        tenant_id: string;
        logo_url: string | null;
      }>();

    return new Map(rows.map((row) => {
      const normalizedLogo = row.logo_url?.trim() || null;
      const logoUrl =
        normalizedLogo && normalizedLogo !== '/wegox-logo.svg'
          ? normalizedLogo
          : null;
      return [row.tenant_id, logoUrl];
    }));
  }
}
