import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from 'src/audit/audit.module';
import { Tenant } from 'src/tenant/entities/tenant.entity';
import { TenantSetting } from './entities/tenant-setting.entity';
import { PlatformSetting } from './entities/platform-setting.entity';
import { TenantSettingsController } from './tenant-settings.controller';
import { TenantSettingsPublicController } from './tenant-settings-public.controller';
import { TenantSettingsService } from './tenant-settings.service';
import { S3StorageService } from './services/s3-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantSetting, PlatformSetting, Tenant]),
    AuditModule,
  ],
  controllers: [TenantSettingsController, TenantSettingsPublicController],
  providers: [TenantSettingsService, S3StorageService],
  exports: [TenantSettingsService],
})
export class TenantSettingsModule {}
