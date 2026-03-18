import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from 'src/audit/audit.service';
import { normalizePhoneInput } from 'src/common/phone/phone.util';
import { Employee } from './entities/employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

type CurrentJwtUser = {
  sub: string;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN';
  tenant_id: string | null;
};

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateEmployeeDto, currentUser: CurrentJwtUser): Promise<Employee> {
    if (!currentUser.tenant_id) {
      throw new BadRequestException('Tenant context is required');
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await this.employeesRepository.findOne({
      where: { tenant_id: currentUser.tenant_id, email: normalizedEmail },
    });

    if (existing) {
      throw new ConflictException('An employee with this email already exists');
    }

    const normalizedPhone = normalizePhoneInput({
      countryIso2: dto.phone_country_iso2,
      nationalNumber: dto.phone_national_number,
      legacyPhone: dto.phone,
    });

    const employee = this.employeesRepository.create({
      tenant_id: currentUser.tenant_id,
      name: dto.name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone.display,
      phone_country_iso2: normalizedPhone.countryIso2,
      phone_national_number: normalizedPhone.nationalNumber,
      phone_e164: normalizedPhone.e164,
    });

    const saved = await this.employeesRepository.save(employee);

    await this.auditService.log({
      actor_user_id: currentUser.sub,
      tenant_id: currentUser.tenant_id,
      action: 'EMPLOYEE_CREATED',
      entity: 'employee',
      entity_id: saved.id,
      metadata: { name: saved.name, email: saved.email },
    });

    return saved;
  }

  async findAll(currentUser: CurrentJwtUser): Promise<Employee[]> {
    if (!currentUser.tenant_id) {
      throw new BadRequestException('Tenant context is required');
    }

    return this.employeesRepository.find({
      where: { tenant_id: currentUser.tenant_id },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, currentUser: CurrentJwtUser): Promise<Employee> {
    if (!currentUser.tenant_id) {
      throw new BadRequestException('Tenant context is required');
    }

    const employee = await this.employeesRepository.findOne({
      where: { id, tenant_id: currentUser.tenant_id },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return employee;
  }

  async update(
    id: string,
    dto: UpdateEmployeeDto,
    currentUser: CurrentJwtUser,
  ): Promise<Employee> {
    const employee = await this.findOne(id, currentUser);

    if (dto.email !== undefined) {
      const normalizedEmail = dto.email.trim().toLowerCase();
      const duplicate = await this.employeesRepository.findOne({
        where: {
          tenant_id: currentUser.tenant_id!,
          email: normalizedEmail,
        },
      });

      if (duplicate && duplicate.id !== employee.id) {
        throw new ConflictException('An employee with this email already exists');
      }

      employee.email = normalizedEmail;
    }

    if (dto.name !== undefined) {
      employee.name = dto.name.trim();
    }

    if (
      dto.phone !== undefined ||
      dto.phone_country_iso2 !== undefined ||
      dto.phone_national_number !== undefined
    ) {
      const normalizedPhone = normalizePhoneInput({
        countryIso2: dto.phone_country_iso2,
        nationalNumber: dto.phone_national_number,
        legacyPhone: dto.phone,
      });

      employee.phone = normalizedPhone.display;
      employee.phone_country_iso2 = normalizedPhone.countryIso2;
      employee.phone_national_number = normalizedPhone.nationalNumber;
      employee.phone_e164 = normalizedPhone.e164;
    }

    if (dto.is_active !== undefined) {
      employee.is_active = dto.is_active;
    }

    const updated = await this.employeesRepository.save(employee);

    await this.auditService.log({
      actor_user_id: currentUser.sub,
      tenant_id: currentUser.tenant_id!,
      action: 'EMPLOYEE_UPDATED',
      entity: 'employee',
      entity_id: updated.id,
      metadata: { updated_fields: Object.keys(dto) },
    });

    return updated;
  }
}
