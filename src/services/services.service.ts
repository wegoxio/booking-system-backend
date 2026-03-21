import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { AuditService } from '../audit/audit.service';
import { Service } from './entity/service.entity';
import { ToggleServiceStatusDto } from './dto/toggle-service.dto';
import { Employee } from '../employees/entities/employee.entity';

type CurrentJwtUser = {
    sub: string;
    role: 'SUPER_ADMIN' | 'TENANT_ADMIN';
    tenant_id: string | null;
};

@Injectable()
export class ServicesService {
    constructor(
        @InjectRepository(Service)
        private readonly servicesRepository: Repository<Service>,
        @InjectRepository(Employee)
        private readonly employeesRepository: Repository<Employee>,
        private readonly auditService: AuditService,
    ) { }

    async create(dto: CreateServiceDto, currentUser: CurrentJwtUser): Promise<Service> {
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

        const service = this.servicesRepository.create({
            tenant_id: currentUser.tenant_id,
            name: normalizedName,
            description: dto.description?.trim() ?? null,
            instructions: dto.instructions?.trim() ?? null,
            duration_minutes: dto.duration_minutes,
            buffer_before_minutes: dto.buffer_before_minutes ?? 0,
            buffer_after_minutes: dto.buffer_after_minutes ?? 0,
            capacity: dto.capacity ?? 1,
            price: dto.price.toFixed(2),
            currency: (dto.currency ?? 'USD').trim().toUpperCase(),
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

    async findAll(currentUser: CurrentJwtUser): Promise<Service[]> {
        if (!currentUser.tenant_id) {
            throw new BadRequestException('El contexto del negocio es obligatorio.');
        }

        return this.servicesRepository.find({
            where: { tenant_id: currentUser.tenant_id },
            relations: { employees: true },
            order: {
                sort_order: 'ASC',
                created_at: 'DESC',
            },
        });
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
        const service = await this.findOne(id, currentUser);

        if (dto.name !== undefined) {
            const normalizedName = dto.name.trim();

            const duplicate = await this.servicesRepository.findOne({
                where: {
                    tenant_id: currentUser.tenant_id!,
                    name: normalizedName,
                },
            });

            if (duplicate && duplicate.id !== service.id) {
                throw new ConflictException('Ya existe un servicio con ese nombre.');
            }

            service.name = normalizedName;
        }

        if (dto.description !== undefined) {
            service.description = dto.description?.trim() || null;
        }

        if (dto.instructions !== undefined) {
            service.instructions = dto.instructions?.trim() || null;
        }

        if (dto.duration_minutes !== undefined) {
            service.duration_minutes = dto.duration_minutes;
        }

        if (dto.buffer_before_minutes !== undefined) {
            service.buffer_before_minutes = dto.buffer_before_minutes;
        }

        if (dto.buffer_after_minutes !== undefined) {
            service.buffer_after_minutes = dto.buffer_after_minutes;
        }

        if (dto.capacity !== undefined) {
            service.capacity = dto.capacity;
        }

        if (dto.price !== undefined) {
            service.price = dto.price.toFixed(2);
        }

        if (dto.currency !== undefined) {
            service.currency = dto.currency.trim().toUpperCase();
        }

        if (dto.is_active !== undefined) {
            service.is_active = dto.is_active;
        }

        if (dto.sort_order !== undefined) {
            service.sort_order = dto.sort_order;
        }

        if (dto.requires_confirmation !== undefined) {
            service.requires_confirmation = dto.requires_confirmation;
        }

        if (dto.min_notice_minutes !== undefined) {
            service.min_notice_minutes = dto.min_notice_minutes;
        }

        if (dto.booking_window_days !== undefined) {
            service.booking_window_days = dto.booking_window_days;
        }

        if (dto.employee_ids !== undefined) {
            service.employees = await this.resolveTenantEmployees(
                dto.employee_ids,
                currentUser.tenant_id!,
            );
        }

        const updated = await this.servicesRepository.save(service);

        await this.auditService.log({
            actor_user_id: currentUser.sub,
            tenant_id: currentUser.tenant_id!,
            action: 'SERVICE_UPDATED',
            entity: 'service',
            entity_id: updated.id,
            metadata: {
                updated_fields: Object.keys(dto),
            },
        });

        return updated;
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
    ): Promise<Employee[]> {
        const uniqueIds = Array.from(new Set(employeeIds));

        if (uniqueIds.length === 0) {
            throw new BadRequestException('Debes asignar al menos un profesional.');
        }

        const employees = await this.employeesRepository.find({
            where: {
                tenant_id: tenantId,
                id: In(uniqueIds),
                is_active: true,
            },
        });

        if (employees.length !== uniqueIds.length) {
            throw new BadRequestException(
                'Some employees are invalid, inactive, or not part of this tenant',
            );
        }

        return employees;
    }
}
