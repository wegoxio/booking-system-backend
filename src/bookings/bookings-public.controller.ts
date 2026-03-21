import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { EligibleEmployeesQueryDto } from './dto/eligible-employees-query.dto';
import { BookingsService } from './bookings.service';
import { Throttle } from '@nestjs/throttler';
import { CreatePublicBookingDto } from './dto/create-public-booking.dto';
import { TurnstileService } from '../captcha/turnstile.service';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Controller('public/tenants/:tenantSlug/bookings')
@Throttle({ default: { limit: 90, ttl: 60_000 } })
export class BookingsPublicController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly turnstileService: TurnstileService,
    private readonly configService: ConfigService,
  ) {}

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
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  async create(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreatePublicBookingDto,
    @Req() req: Request,
  ) {
    await this.turnstileService.verifyOrThrow({
      token: dto.captcha_token,
      ip: req.ip ?? null,
      expectedAction: this.configService.get<string>(
        'TURNSTILE_BOOKING_ACTION',
        'booking_create',
      ),
    });

    const { captcha_token: _captchaToken, ...bookingPayload } = dto;

    return this.bookingsService.createPublicBookingByTenantSlug(
      tenantSlug,
      bookingPayload as CreateBookingDto,
    );
  }
}
