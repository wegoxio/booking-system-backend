import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';
import { DashboardService } from './dashboard.service';
import type { CurrentJwtUser } from 'src/auth/types';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'TENANT_ADMIN')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  overview(
    @Query() query: DashboardOverviewQueryDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.dashboardService.getOverview(currentUser, query);
  }
}

