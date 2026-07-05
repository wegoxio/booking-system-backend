import { Controller, Get, Param } from '@nestjs/common';
import { TenantSettingsService } from './tenant-settings.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Public settings')
@Controller('public/businesses/:businessSlug/settings')
export class TenantSettingsPublicController {
  constructor(private readonly tenantSettingsService: TenantSettingsService) {}

  @Get()
  findPublicByBusinessSlug(@Param('businessSlug') businessSlug: string) {
    return this.tenantSettingsService.findPublicByBusinessSlug(businessSlug);
  }
}
