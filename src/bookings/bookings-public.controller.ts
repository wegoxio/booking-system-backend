import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { EligibleEmployeesQueryDto } from './dto/eligible-employees-query.dto';
import { BookingsService } from './bookings.service';
import { Throttle } from '@nestjs/throttler';
import { CreatePublicBookingDto } from './dto/create-public-booking.dto';
import { TurnstileService } from '../captcha/turnstile.service';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { ReschedulePublicBookingDto } from './dto/reschedule-public-booking.dto';
import { PublicBookingManagementAvailabilityQueryDto } from './dto/public-booking-management-availability-query.dto';
import { ApiHeader, ApiTags } from '@nestjs/swagger';

@ApiTags('Public bookings')
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
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Clave de idempotencia entre 16 y 128 caracteres seguros para evitar reservas duplicadas.',
  })
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  async create(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreatePublicBookingDto,
    @Req() req: Request,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const normalizedIdempotencyKey = idempotencyKey?.trim() ?? '';
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(normalizedIdempotencyKey)) {
      throw new BadRequestException(
        'Idempotency-Key es obligatorio y debe contener entre 16 y 128 caracteres seguros.',
      );
    }
    await this.turnstileService.verifyOrThrow({
      token: dto.captcha_token,
      ip: req.ip ?? null,
      expectedAction: this.configService.get<string>(
        'TURNSTILE_BOOKING_ACTION',
        'booking_create',
      ),
    });

    const bookingPayload = { ...dto };
    delete bookingPayload.captcha_token;

    return this.bookingsService.createPublicBookingByTenantSlug(
      tenantSlug,
      bookingPayload as CreateBookingDto,
      normalizedIdempotencyKey,
    );
  }
}

@ApiTags('Public booking management')
@Controller('public/bookings/manage/:token')
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class PublicBookingManagementController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly turnstileService: TurnstileService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  findOne(@Param('token') token: string) {
    return this.bookingsService.findPublicBookingManagementByToken(token);
  }

  @Get('availability')
  getAvailability(
    @Param('token') token: string,
    @Query() query: PublicBookingManagementAvailabilityQueryDto,
  ) {
    return this.bookingsService.getPublicBookingManagementAvailability(
      token,
      query,
    );
  }

  @Patch('reschedule')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Clave de idempotencia entre 16 y 128 caracteres seguros para evitar reprogramaciones duplicadas.',
  })
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async reschedule(
    @Param('token') token: string,
    @Body() dto: ReschedulePublicBookingDto,
    @Req() req: Request,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const normalizedIdempotencyKey = idempotencyKey?.trim() ?? '';
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(normalizedIdempotencyKey)) {
      throw new BadRequestException(
        'Idempotency-Key es obligatorio y debe contener entre 16 y 128 caracteres seguros.',
      );
    }

    await this.turnstileService.verifyOrThrow({
      token: dto.captcha_token,
      ip: req.ip ?? null,
      expectedAction: this.configService.get<string>(
        'TURNSTILE_BOOKING_RESCHEDULE_ACTION',
        'booking_reschedule',
      ),
    });

    const bookingPayload = { ...dto };
    delete bookingPayload.captcha_token;

    return this.bookingsService.reschedulePublicBookingByManagementToken(
      token,
      bookingPayload,
    );
  }
}
