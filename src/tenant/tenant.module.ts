import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { AuditModule } from '../audit/audit.module';
import { TenantSetting } from '../tenant-settings/entities/tenant-setting.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, TenantSetting]),
    AuditModule,
  ],
  controllers: [TenantController],
  providers: [TenantService],
})
export class TenantModule { }
