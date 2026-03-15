import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { BookingsService } from './bookings.service';
import { EligibleEmployeesQueryDto } from './dto/eligible-employees-query.dto';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { SetEmployeeScheduleDto } from './dto/set-employee-schedule.dto';
import { CreateEmployeeTimeOffDto } from './dto/create-employee-time-off.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import type { CurrentJwtUser } from 'src/auth/types';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TENANT_ADMIN')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('eligible-employees')
  findEligibleEmployees(
    @Query() query: EligibleEmployeesQueryDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.bookingsService.findEligibleEmployees(query, currentUser);
  }

  @Get('availability')
  getAvailability(
    @Query() query: AvailabilityQueryDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.bookingsService.getAvailability(query, currentUser);
  }

  @Put('employees/:employeeId/schedule')
  setEmployeeSchedule(
    @Param('employeeId') employeeId: string,
    @Body() dto: SetEmployeeScheduleDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.bookingsService.setEmployeeSchedule(employeeId, dto, currentUser);
  }

  @Get('employees/:employeeId/schedule')
  getEmployeeSchedule(
    @Param('employeeId') employeeId: string,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.bookingsService.getEmployeeSchedule(employeeId, currentUser);
  }

  @Post('employees/:employeeId/time-off')
  createEmployeeTimeOff(
    @Param('employeeId') employeeId: string,
    @Body() dto: CreateEmployeeTimeOffDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.bookingsService.createEmployeeTimeOff(employeeId, dto, currentUser);
  }

  @Delete('employees/:employeeId/time-off/:timeOffId')
  removeEmployeeTimeOff(
    @Param('employeeId') employeeId: string,
    @Param('timeOffId') timeOffId: string,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.bookingsService.removeEmployeeTimeOff(
      employeeId,
      timeOffId,
      currentUser,
    );
  }

  @Post()
  create(
    @Body() dto: CreateBookingDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.bookingsService.createBooking(dto, currentUser);
  }

  @Get()
  list(
    @Query() query: ListBookingsQueryDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.bookingsService.listBookings(query, currentUser);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: CurrentJwtUser) {
    return this.bookingsService.findOne(id, currentUser);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.bookingsService.updateStatus(id, dto, currentUser);
  }
}
