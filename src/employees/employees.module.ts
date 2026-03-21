import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { TenantSettingsModule } from '../tenant-settings/tenant-settings.module';
import { Employee } from './entities/employee.entity';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  imports: [TypeOrmModule.forFeature([Employee]), AuditModule, TenantSettingsModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
