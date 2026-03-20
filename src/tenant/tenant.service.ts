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
import { AuditService } from 'src/audit/audit.service';

type CurrentJwtUser = {
  sub: string;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN';
  tenant_id: string | null;
};

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant) private readonly tenantRepository: Repository<Tenant>,
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

  async findAll(): Promise<Tenant[]> {
    return this.tenantRepository.find({
      order: { created_at: 'DESC' },
    });
  }

  async update(
    id: string,
    dto: UpdateTenantDto,
    currentUser: CurrentJwtUser,
  ): Promise<Tenant> {
    const tenant = await this.findOne(id);

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

    await this.auditService.log({
      actor_user_id: currentUser.sub,
      tenant_id: null,
      action: 'TENANT_UPDATED',
      entity: 'tenant',
      entity_id: updated.id,
      metadata: {
        updated_fields: Object.keys(dto),
      },
    });

    return updated;
  }

  async remove(id: string, currentUser: CurrentJwtUser): Promise<{ id: string }> {
    const tenant = await this.findOne(id);
    await this.tenantRepository.remove(tenant);

    await this.auditService.log({
      actor_user_id: currentUser.sub,
      tenant_id: null,
      action: 'TENANT_DELETED',
      entity: 'tenant',
      entity_id: id,
      metadata: {
        name: tenant.name,
        slug: tenant.slug,
      },
    });

    return { id };
  }
}
