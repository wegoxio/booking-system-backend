import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { ToggleServiceStatusDto } from './dto/toggle-service.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

type CurrentJwtUser = {
  sub: string;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN';
  tenant_id: string | null;
};

@ApiTags('Services')
@ApiBearerAuth('access-token')
@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TENANT_ADMIN')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  create(
    @Body() dto: CreateServiceDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.servicesService.create(dto, currentUser);
  }

  @Get()
  findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.servicesService.findAll(currentUser, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: CurrentJwtUser) {
    return this.servicesService.findOne(id, currentUser);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.servicesService.update(id, dto, currentUser);
  }

  @Patch(':id/status')
  toggleStatus(
    @Param('id') id: string,
    @Body() dto: ToggleServiceStatusDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.servicesService.toggleStatus(id, dto, currentUser);
  }
}
