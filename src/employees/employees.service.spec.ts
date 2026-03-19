import { BadRequestException } from '@nestjs/common';
import { AuditService } from 'src/audit/audit.service';
import { S3StorageService } from 'src/tenant-settings/services/s3-storage.service';
import { EmployeesService } from './employees.service';
import { Employee } from './entities/employee.entity';

type MockRepo<T> = {
  findOne: jest.Mock;
  find: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
};

function createRepoMock<T>(): MockRepo<T> {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn((input) => input),
  };
}

function createEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'employee-1',
    created_at: new Date('2026-03-10T10:00:00.000Z'),
    updated_at: new Date('2026-03-10T10:00:00.000Z'),
    tenant_id: 'tenant-1',
    tenant: undefined as never,
    name: 'Ana',
    email: 'ana@example.com',
    phone: null,
    phone_country_iso2: null,
    phone_national_number: null,
    phone_e164: null,
    avatar_url: null,
    avatar_key: null,
    schedule_timezone: 'America/Caracas',
    slot_interval_minutes: 15,
    is_active: true,
    services: [],
    ...overrides,
  };
}

describe('EmployeesService avatar uploads', () => {
  let employeesRepository: MockRepo<Employee>;
  let auditService: { log: jest.Mock };
  let s3StorageService: { uploadObject: jest.Mock; deleteObject: jest.Mock };
  let service: EmployeesService;

  beforeEach(() => {
    employeesRepository = createRepoMock<Employee>();
    auditService = { log: jest.fn() };
    s3StorageService = {
      uploadObject: jest.fn(),
      deleteObject: jest.fn(),
    };

    service = new EmployeesService(
      employeesRepository as never,
      auditService as unknown as AuditService,
      s3StorageService as unknown as S3StorageService,
    );
  });

  it('uploads a valid avatar and stores the resulting URL', async () => {
    const employee = createEmployee();
    employeesRepository.findOne.mockResolvedValue(employee);
    employeesRepository.save.mockImplementation(async (input) => input);
    s3StorageService.uploadObject.mockResolvedValue(
      'https://cdn.example.com/avatar.png',
    );

    const result = await service.uploadAvatar(
      employee.id,
      {
        buffer: Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
        ]),
        mimetype: 'image/png',
        originalname: 'avatar.png',
      },
      {
        sub: 'user-1',
        role: 'TENANT_ADMIN',
        tenant_id: 'tenant-1',
      },
    );

    expect(result.avatar_url).toBe('https://cdn.example.com/avatar.png');
    expect(s3StorageService.uploadObject).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EMPLOYEE_AVATAR_UPLOADED',
      }),
    );
  });

  it('rejects an invalid avatar file before uploading', async () => {
    employeesRepository.findOne.mockResolvedValue(createEmployee());

    await expect(
      service.uploadAvatar(
        'employee-1',
        {
          buffer: Buffer.from('not-an-image'),
          mimetype: 'image/png',
          originalname: 'avatar.png',
        },
        {
          sub: 'user-1',
          role: 'TENANT_ADMIN',
          tenant_id: 'tenant-1',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(s3StorageService.uploadObject).not.toHaveBeenCalled();
  });
});
