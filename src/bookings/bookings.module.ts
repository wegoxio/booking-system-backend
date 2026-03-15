import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from 'src/audit/audit.module';
import { Employee } from 'src/employees/entities/employee.entity';
import { Service } from 'src/services/entity/service.entity';
import { Tenant } from 'src/tenant/entities/tenant.entity';
import { BookingsController } from './bookings.controller';
import { BookingsPublicController } from './bookings-public.controller';
import { BookingsService } from './bookings.service';
import { Booking } from './entities/booking.entity';
import { BookingItem } from './entities/booking-item.entity';
import { EmployeeScheduleRule } from './entities/employee-schedule-rule.entity';
import { EmployeeScheduleBreak } from './entities/employee-schedule-break.entity';
import { EmployeeTimeOff } from './entities/employee-time-off.entity';
import { CaptchaModule } from 'src/captcha/captcha.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      BookingItem,
      EmployeeScheduleRule,
      EmployeeScheduleBreak,
      EmployeeTimeOff,
      Employee,
      Service,
      Tenant,
    ]),
    AuditModule,
    CaptchaModule,
    NotificationsModule,
  ],
  controllers: [BookingsController, BookingsPublicController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
