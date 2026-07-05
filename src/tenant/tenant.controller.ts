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
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

type CurrentJwtUser = {
  sub: string;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN';
  tenant_id: string | null;
};

@Controller('tenant')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('me')
  @Roles('TENANT_ADMIN')
  findCurrentTenant(@CurrentUser() currentUser: CurrentJwtUser) {
    return this.tenantService.findCurrentTenant(currentUser);
  }

  @Patch('me')
  @Roles('TENANT_ADMIN')
  updateCurrentTenant(
    @Body() data: UpdateTenantDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.tenantService.updateCurrentTenant(data, currentUser);
  }

  @Roles('SUPER_ADMIN')
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.tenantService.findAll(query);
  }

  @Roles('SUPER_ADMIN')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantService.findOne(id);
  }

  @Roles('SUPER_ADMIN')
  @Post()
  create(
    @Body() data: CreateTenantDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.tenantService.create(data, currentUser);
  }

  @Roles('SUPER_ADMIN')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() data: UpdateTenantDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.tenantService.update(id, data, currentUser);
  }
}
