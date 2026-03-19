import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from 'src/audit/audit.service';
import { normalizePhoneInput } from 'src/common/phone/phone.util';
import { S3StorageService } from 'src/tenant-settings/services/s3-storage.service';
import { Employee } from './entities/employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

type CurrentJwtUser = {
  sub: string;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN';
  tenant_id: string | null;
};

type UploadedAssetFile = {
  buffer: Buffer;
  mimetype: string;
  size?: number;
  originalname?: string;
};

type DetectedAvatarFormat = 'png' | 'jpg' | 'webp';

type ValidatedAvatarFile = {
  extension: string;
  contentType: string;
};

const MAX_EMPLOYEE_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_EMPLOYEE_AVATAR_MIME_TYPES = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
    private readonly auditService: AuditService,
    private readonly s3StorageService: S3StorageService,
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

  async uploadAvatar(
    id: string,
    file: UploadedAssetFile,
    currentUser: CurrentJwtUser,
  ): Promise<Employee> {
    const employee = await this.findOne(id, currentUser);
    const validatedFile = this.validateUploadedAvatar(file);
    const objectKey = this.buildAvatarObjectKey(
      employee.tenant_id,
      employee.id,
      validatedFile.extension,
      file.originalname,
    );
    const previousKey = employee.avatar_key;

    const avatarUrl = await this.s3StorageService.uploadObject({
      key: objectKey,
      body: file.buffer,
      contentType: validatedFile.contentType,
    });

    let updated: Employee;
    try {
      employee.avatar_url = avatarUrl;
      employee.avatar_key = objectKey;
      updated = await this.employeesRepository.save(employee);
    } catch (error) {
      await this.safeDeleteAvatarObject(objectKey);
      throw error;
    }

    await this.safeDeletePreviousAvatar(previousKey, objectKey);

    await this.auditService.log({
      actor_user_id: currentUser.sub,
      tenant_id: currentUser.tenant_id!,
      action: 'EMPLOYEE_AVATAR_UPLOADED',
      entity: 'employee',
      entity_id: updated.id,
      metadata: {
        avatar_key: objectKey,
      },
    });

    return updated;
  }

  private validateUploadedAvatar(file: UploadedAssetFile): ValidatedAvatarFile {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Image file is required');
    }

    const fileSizeBytes =
      typeof file.size === 'number' ? file.size : file.buffer.length;
    if (fileSizeBytes > MAX_EMPLOYEE_AVATAR_SIZE_BYTES) {
      throw new BadRequestException(
        `Avatar file too large. Maximum allowed is ${this.formatBytes(MAX_EMPLOYEE_AVATAR_SIZE_BYTES)}.`,
      );
    }

    const detectedFormat = this.detectAvatarFormat(file.buffer);
    if (!detectedFormat) {
      throw new BadRequestException(
        'Unsupported avatar format. Allowed formats: PNG, JPG, WEBP.',
      );
    }

    const declaredMime = file.mimetype?.trim().toLowerCase();
    if (declaredMime) {
      if (!ALLOWED_EMPLOYEE_AVATAR_MIME_TYPES.has(declaredMime)) {
        throw new BadRequestException('Unsupported avatar MIME type');
      }

      if (!this.isMimeCompatibleWithFormat(declaredMime, detectedFormat)) {
        throw new BadRequestException(
          'Avatar MIME type does not match the actual file content.',
        );
      }
    }

    return {
      extension: this.extensionFromFormat(detectedFormat),
      contentType: this.mimeFromFormat(detectedFormat),
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${Math.round(bytes / 1024)} KB`;
  }

  private detectAvatarFormat(buffer: Buffer): DetectedAvatarFormat | null {
    if (
      this.startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ) {
      return 'png';
    }

    if (this.startsWithBytes(buffer, [0xff, 0xd8, 0xff])) {
      return 'jpg';
    }

    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'webp';
    }

    return null;
  }

  private startsWithBytes(buffer: Buffer, signature: number[]): boolean {
    if (buffer.length < signature.length) {
      return false;
    }

    return signature.every((byte, index) => buffer[index] === byte);
  }

  private isMimeCompatibleWithFormat(
    mimeType: string,
    format: DetectedAvatarFormat,
  ): boolean {
    switch (format) {
      case 'png':
        return mimeType === 'image/png';
      case 'jpg':
        return mimeType === 'image/jpeg';
      case 'webp':
        return mimeType === 'image/webp';
      default:
        return false;
    }
  }

  private extensionFromFormat(format: DetectedAvatarFormat): string {
    switch (format) {
      case 'png':
        return 'png';
      case 'jpg':
        return 'jpg';
      case 'webp':
        return 'webp';
      default:
        throw new BadRequestException('Unsupported avatar format');
    }
  }

  private mimeFromFormat(format: DetectedAvatarFormat): string {
    switch (format) {
      case 'png':
        return 'image/png';
      case 'jpg':
        return 'image/jpeg';
      case 'webp':
        return 'image/webp';
      default:
        throw new BadRequestException('Unsupported avatar format');
    }
  }

  private buildAvatarObjectKey(
    tenantId: string,
    employeeId: string,
    extension: string,
    originalName?: string,
  ): string {
    const normalizedBaseName = this.sanitizeAssetBaseName(
      originalName,
      `employee-${employeeId}`,
    );
    return `tenants/${tenantId}/employees/${employeeId}/avatar/${normalizedBaseName}-${randomUUID()}.${extension}`;
  }

  private sanitizeAssetBaseName(
    originalName: string | undefined,
    fallbackName: string,
  ): string {
    const rawBaseName = originalName?.trim().replace(/\.[^.]+$/, '') || fallbackName;
    const normalized = rawBaseName
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);

    return normalized || fallbackName.toLowerCase();
  }

  private async safeDeletePreviousAvatar(
    previousKey: string | null,
    currentKey: string,
  ): Promise<void> {
    if (!previousKey || previousKey === currentKey) {
      return;
    }

    await this.safeDeleteAvatarObject(previousKey);
  }

  private async safeDeleteAvatarObject(key: string): Promise<void> {
    try {
      await this.s3StorageService.deleteObject(key);
    } catch (error) {
      this.logger.warn(
        `Unable to delete stale employee avatar ${key}: ${String(error)}`,
      );
    }
  }
}
