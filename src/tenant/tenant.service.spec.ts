import { Test, TestingModule } from '@nestjs/testing';
import { TenantService } from './tenant.service';

describe('TenantService', () => {
  let service: TenantService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantService],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get<TenantService>(TenantService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
