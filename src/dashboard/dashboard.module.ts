import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Employee } from '../employees/entities/employee.entity';
import { Service } from '../services/entity/service.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { TenantSetting } from '../tenant-settings/entities/tenant-setting.entity';
import { User } from '../users/entities/user.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      TenantSetting,
      User,
      Booking,
      Employee,
      Service,
      AuditLog,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

