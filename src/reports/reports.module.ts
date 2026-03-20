import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from 'src/bookings/entities/booking.entity';
import { BookingItem } from 'src/bookings/entities/booking-item.entity';
import { BookingReminder } from 'src/reminders/entities/booking-reminder.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, BookingItem, BookingReminder])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
