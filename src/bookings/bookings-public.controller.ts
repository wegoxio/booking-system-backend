import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { EligibleEmployeesQueryDto } from './dto/eligible-employees-query.dto';
import { BookingsService } from './bookings.service';

@Controller('public/tenants/:tenantSlug/bookings')
export class BookingsPublicController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('services')
  listServices(@Param('tenantSlug') tenantSlug: string) {
    return this.bookingsService.listPublicServicesByTenantSlug(tenantSlug);
  }

  @Get('eligible-employees')
  findEligibleEmployees(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: EligibleEmployeesQueryDto,
  ) {
    return this.bookingsService.findPublicEligibleEmployeesByTenantSlug(
      tenantSlug,
      query,
    );
  }

  @Get('availability')
  getAvailability(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.bookingsService.getPublicAvailabilityByTenantSlug(
      tenantSlug,
      query,
    );
  }

  @Post()
  create(@Param('tenantSlug') tenantSlug: string, @Body() dto: CreateBookingDto) {
    return this.bookingsService.createPublicBookingByTenantSlug(tenantSlug, dto);
  }
}

