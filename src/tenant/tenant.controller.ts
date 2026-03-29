import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

type CurrentJwtUser = {
  sub: string;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN';
  tenant_id: string | null;
};

@Controller('tenant')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  findAll() {
    return this.tenantService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantService.findOne(id);
  }

  @Post()
  create(
    @Body() data: CreateTenantDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.tenantService.create(data, currentUser);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() data: UpdateTenantDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.tenantService.update(id, data, currentUser);
  }
}
