import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { ToggleServiceStatusDto } from './dto/toggle-service.dto';

type CurrentJwtUser = {
  sub: string;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN';
  tenant_id: string | null;
};

@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TENANT_ADMIN')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  create(@Body() dto: CreateServiceDto, @CurrentUser() currentUser: CurrentJwtUser) {
    return this.servicesService.create(dto, currentUser);
  }

  @Get()
  findAll(@CurrentUser() currentUser: CurrentJwtUser) {
    return this.servicesService.findAll(currentUser);
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