import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import type { CurrentJwtUser } from 'src/auth/types';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ReportsOverviewQueryDto } from './dto/reports-overview-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'TENANT_ADMIN')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  overview(
    @Query() query: ReportsOverviewQueryDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.reportsService.getOverview(currentUser, query);
  }

  @Get('export')
  async export(
    @Query() query: ReportsOverviewQueryDto,
    @CurrentUser() currentUser: CurrentJwtUser,
    @Res() response: Response,
  ): Promise<void> {
    const exported = await this.reportsService.buildExcelExport(currentUser, query);

    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${exported.fileName}"`,
    );
    response.setHeader('Content-Length', exported.content.length.toString());
    response.send(exported.content);
  }
}
