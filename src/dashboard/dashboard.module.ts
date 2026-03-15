import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from 'src/audit/entities/audit-log.entity';
import { Booking } from 'src/bookings/entities/booking.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { Service } from 'src/services/entity/service.entity';
import { Tenant } from 'src/tenant/entities/tenant.entity';
import { User } from 'src/users/entities/user.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, User, Booking, Employee, Service, AuditLog]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

