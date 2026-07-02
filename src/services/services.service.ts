import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, ILike, In, Repository } from 'typeorm';

import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { AuditService } from '../audit/audit.service';
import { Service } from './entity/service.entity';
import { ToggleServiceStatusDto } from './dto/toggle-service.dto';
import { Employee } from '../employees/entities/employee.entity';
import {
  PaginatedResponse,
  PaginationQueryDto,
} from '../common/dto/pagination-query.dto';
import {
  normalizeCurrency,
  normalizeMoney,
} from '../common/money/money.util';

type CurrentJwtUser = {
  sub: string;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN';
  tenant_id: string | null;
};

type CapacityConfig = {
  minPartySize: number;
  maxPartySize: number;
  slotCapacity: number;
};

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly servicesRepository: Repository<Service>,
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  async create(
    dto: CreateServiceDto,
    currentUser: CurrentJwtUser,
  ): Promise<Service> {
    if (!currentUser.tenant_id) {
      throw new BadRequestException('El contexto del negocio es obligatorio.');
    }

    const normalizedName = dto.name.trim();

    const existing = await this.servicesRepository.findOne({
      where: {
        tenant_id: currentUser.tenant_id,
        name: normalizedName,
      },
    });

    if (existing) {
      throw new ConflictException('Ya existe un servicio con ese nombre.');
    }

    const employees = await this.resolveTenantEmployees(
      dto.employee_ids,
      currentUser.tenant_id,
    );
    const capacity = this.resolveCapacityConfig(dto);

    const service = this.servicesRepository.create({
      tenant_id: currentUser.tenant_id,
      name: normalizedName,
      description: dto.description?.trim() ?? null,
      instructions: dto.instructions?.trim() ?? null,
      duration_minutes: dto.duration_minutes,
      buffer_before_minutes: dto.buffer_before_minutes ?? 0,
      buffer_after_minutes: dto.buffer_after_minutes ?? 0,
      capacity: capacity.slotCapacity,
      min_capacity: capacity.minPartySize,
      max_capacity: capacity.maxPartySize,
      min_party_size: capacity.minPartySize,
      max_party_size: capacity.maxPartySize,
      slot_capacity: capacity.slotCapacity,
      pricing_model: dto.pricing_model ?? 'FLAT',
      price: normalizeMoney(dto.price),
      currency: normalizeCurrency(dto.currency ?? 'USD'),
      is_active: dto.is_active ?? true,
      sort_order: dto.sort_order ?? 0,
      requires_confirmation: dto.requires_confirmation ?? false,
      min_notice_minutes: dto.min_notice_minutes ?? 0,
      booking_window_days: dto.booking_window_days ?? 60,
      employees,
    });

    const saved = await this.servicesRepository.save(service);

    await this.auditService.log({
      actor_user_id: currentUser.sub,
      tenant_id: currentUser.tenant_id,
      action: 'SERVICE_CREATED',
      entity: 'service',
      entity_id: saved.id,
      metadata: {
        name: saved.name,
        duration_minutes: saved.duration_minutes,
        price: saved.price,
        currency: saved.currency,
        employee_ids: saved.employees.map((employee) => employee.id),
      },
    });

    return saved;
  }

  async findAll(
    currentUser: CurrentJwtUser,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<Service>> {
    if (!currentUser.tenant_id) {
      throw new BadRequestException('El contexto del negocio es obligatorio.');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const search = query.q?.trim();
    const [data, total] = await this.servicesRepository.findAndCount({
      where: {
        tenant_id: currentUser.tenant_id,
        ...(search ? { name: ILike(`%${search}%`) } : {}),
      },
      relations: { employees: true },
      order: {
        sort_order: 'ASC',
        created_at: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, currentUser: CurrentJwtUser): Promise<Service> {
    if (!currentUser.tenant_id) {
      throw new BadRequestException('El contexto del negocio es obligatorio.');
    }

    const service = await this.servicesRepository.findOne({
      where: {
        id,
        tenant_id: currentUser.tenant_id,
      },
      relations: { employees: true },
    });

    if (!service) {
      throw new NotFoundException('No se encontró el servicio.');
    }

    return service;
  }

  async update(
    id: string,
    dto: UpdateServiceDto,
    currentUser: CurrentJwtUser,
  ): Promise<Service> {
    if (!currentUser.tenant_id) {
      throw new BadRequestException('El contexto del negocio es obligatorio.');
    }

    await this.dataSource.transaction(async (manager) => {
      const service = await manager
        .getRepository(Service)
        .createQueryBuilder('service')
        .setLock('pessimistic_write')
        .where('service.id = :id', { id })
        .andWhere('service.tenant_id = :tenantId', {
          tenantId: currentUser.tenant_id!,
        })
        .getOne();
      if (!service) throw new NotFoundException('No se encontró el servicio.');

      if (dto.name !== undefined) {
        const normalizedName = dto.name.trim();
        const duplicate = await manager.getRepository(Service).findOne({
          where: { tenant_id: currentUser.tenant_id!, name: normalizedName },
        });
        if (duplicate && duplicate.id !== service.id) {
          throw new ConflictException('Ya existe un servicio con ese nombre.');
        }
        service.name = normalizedName;
      }
      if (dto.description !== undefined) service.description = dto.description?.trim() || null;
      if (dto.instructions !== undefined) service.instructions = dto.instructions?.trim() || null;
      if (dto.duration_minutes !== undefined) service.duration_minutes = dto.duration_minutes;
      if (dto.buffer_before_minutes !== undefined) service.buffer_before_minutes = dto.buffer_before_minutes;
      if (dto.buffer_after_minutes !== undefined) service.buffer_after_minutes = dto.buffer_after_minutes;

      if (
        dto.capacity !== undefined ||
        dto.min_capacity !== undefined ||
        dto.max_capacity !== undefined ||
        dto.min_party_size !== undefined ||
        dto.max_party_size !== undefined ||
        dto.slot_capacity !== undefined
      ) {
        const capacity = this.resolveCapacityConfig(dto, service);
        await this.assertFutureCapacityCompatible(manager, service, capacity);
        service.capacity = capacity.slotCapacity;
        service.min_capacity = capacity.minPartySize;
        service.max_capacity = capacity.maxPartySize;
        service.min_party_size = capacity.minPartySize;
        service.max_party_size = capacity.maxPartySize;
        service.slot_capacity = capacity.slotCapacity;
      }

      if (dto.price !== undefined) service.price = normalizeMoney(dto.price);
      if (dto.currency !== undefined) service.currency = normalizeCurrency(dto.currency);
      if (dto.pricing_model !== undefined) service.pricing_model = dto.pricing_model;
      if (dto.is_active !== undefined) service.is_active = dto.is_active;
      if (dto.sort_order !== undefined) service.sort_order = dto.sort_order;
      if (dto.requires_confirmation !== undefined) service.requires_confirmation = dto.requires_confirmation;
      if (dto.min_notice_minutes !== undefined) service.min_notice_minutes = dto.min_notice_minutes;
      if (dto.booking_window_days !== undefined) service.booking_window_days = dto.booking_window_days;
      if (dto.employee_ids !== undefined) {
        service.employees = await this.resolveTenantEmployees(
          dto.employee_ids,
          currentUser.tenant_id!,
          manager.getRepository(Employee),
        );
      }
      return manager.getRepository(Service).save(service);
    });

    const hydrated = await this.findOne(id, currentUser);
    await this.auditService.log({
      actor_user_id: currentUser.sub,
      tenant_id: currentUser.tenant_id!,
      action: 'SERVICE_UPDATED',
      entity: 'service',
      entity_id: hydrated.id,
      metadata: {
        updated_fields: Object.keys(dto),
      },
    });

    return hydrated;
  }

  async toggleStatus(
    id: string,
    dto: ToggleServiceStatusDto,
    currentUser: CurrentJwtUser,
  ): Promise<Service> {
    const service = await this.findOne(id, currentUser);

    service.is_active = dto.is_active;

    const updated = await this.servicesRepository.save(service);

    await this.auditService.log({
      actor_user_id: currentUser.sub,
      tenant_id: currentUser.tenant_id!,
      action: dto.is_active ? 'SERVICE_ENABLED' : 'SERVICE_DISABLED',
      entity: 'service',
      entity_id: updated.id,
      metadata: {
        is_active: updated.is_active,
        name: updated.name,
      },
    });

    return updated;
  }

  private async resolveTenantEmployees(
    employeeIds: string[],
    tenantId: string,
    repository: Repository<Employee> = this.employeesRepository,
  ): Promise<Employee[]> {
    const uniqueIds = Array.from(new Set(employeeIds));

    if (uniqueIds.length === 0) {
      throw new BadRequestException('Debes asignar al menos un profesional.');
    }

    const employees = await repository.find({
      where: {
        tenant_id: tenantId,
        id: In(uniqueIds),
        is_active: true,
      },
    });

    if (employees.length !== uniqueIds.length) {
      throw new BadRequestException(
        'Alguno de los profesionales seleccionados no existe, está inactivo o no pertenece a este negocio.',
      );
    }

    return employees;
  }

  private resolveCapacityConfig(
    dto: Pick<
      CreateServiceDto,
      | 'capacity'
      | 'min_capacity'
      | 'max_capacity'
      | 'min_party_size'
      | 'max_party_size'
      | 'slot_capacity'
    >,
    existing?: Service,
  ): CapacityConfig {
    const minPartySize =
      dto.min_party_size ?? dto.min_capacity ?? existing?.min_party_size ?? existing?.min_capacity ?? 1;
    const maxPartySize =
      dto.max_party_size ?? dto.max_capacity ?? existing?.max_party_size ?? existing?.max_capacity ?? minPartySize;
    const slotCandidate =
      dto.slot_capacity ?? dto.capacity ?? existing?.slot_capacity ?? existing?.capacity ?? maxPartySize;
    const slotCapacity =
      dto.slot_capacity !== undefined
        ? slotCandidate
        : Math.max(slotCandidate, maxPartySize);

    if (maxPartySize < minPartySize || slotCapacity < maxPartySize) {
      throw new BadRequestException(
        'La capacidad máxima debe ser mayor o igual a la capacidad mínima.',
      );
    }

    return {
      minPartySize,
      maxPartySize,
      slotCapacity,
    };
  }

  private async assertFutureCapacityCompatible(
    manager: EntityManager,
    service: Service,
    capacity: CapacityConfig,
  ): Promise<void> {
    const rows = await manager.query<
      Array<{ occupied_capacity: string; largest_party: string }>
    >(
      `SELECT COALESCE(MAX(session.occupied_capacity), 0)::text AS occupied_capacity,
              COALESCE(MAX(session.largest_party), 0)::text AS largest_party
       FROM (
         SELECT SUM(booking.party_size) AS occupied_capacity,
                MAX(booking.party_size) AS largest_party
         FROM bookings booking
         INNER JOIN booking_items item ON item.booking_id = booking.id
         WHERE booking.tenant_id = $1
           AND item.service_id = $2
           AND booking.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
           AND booking.start_at_utc >= NOW()
         GROUP BY booking.employee_id, booking.start_at_utc, booking.end_at_utc
       ) session`,
      [service.tenant_id, service.id],
    );
    const occupied = Number(rows[0]?.occupied_capacity ?? 0);
    const largestParty = Number(rows[0]?.largest_party ?? 0);
    if (occupied > capacity.slotCapacity || largestParty > capacity.maxPartySize) {
      throw new ConflictException(
        `Existen reservas futuras: slot_capacity debe ser al menos ${occupied} y max_party_size al menos ${largestParty}.`,
      );
    }
  }
}
