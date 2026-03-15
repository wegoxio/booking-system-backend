import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserService } from './user.service';
import { CreateTenantAdminDto } from './dto/create-tenant-admin.dto';
import { UpdateTenantAdminDto } from './dto/update-tenant-admin.dto';
import type { CurrentJwtUser } from 'src/auth/types';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class UsersController {
  constructor(private readonly usersService: UserService) {}

  @Get('tenant-admins')
  findTenantAdmins() {
    return this.usersService.findTenantAdmins();
  }

  @Get('tenant-admins/:id')
  findTenantAdminById(@Param('id') id: string) {
    return this.usersService.findTenantAdminById(id);
  }

  @Post('tenant-admins')
  createTenantAdmin(
    @Body() data: CreateTenantAdminDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.usersService.createTenantAdmin(data, currentUser);
  }

  @Patch('tenant-admins/:id')
  updateTenantAdmin(
    @Param('id') id: string,
    @Body() data: UpdateTenantAdminDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.usersService.updateTenantAdmin(id, data, currentUser);
  }

  @Delete('tenant-admins/:id')
  removeTenantAdmin(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.usersService.removeTenantAdmin(id, currentUser);
  }
}
