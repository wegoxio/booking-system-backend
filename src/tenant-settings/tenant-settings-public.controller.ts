import { Controller, Get, Param } from '@nestjs/common';
import { TenantSettingsService } from './tenant-settings.service';

@Controller('public/businesses/:businessSlug/settings')
export class TenantSettingsPublicController {
  constructor(private readonly tenantSettingsService: TenantSettingsService) {}

  @Get()
  findPublicByBusinessSlug(@Param('businessSlug') businessSlug: string) {
    return this.tenantSettingsService.findPublicByBusinessSlug(businessSlug);
  }
}

