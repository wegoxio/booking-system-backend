import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Controller('tenant')
export class TenantController {
    constructor(
        private tenantService: TenantService
    ) { }

    @Get()
    @UseGuards(JwtAuthGuard)
    @Roles('SUPER_ADMIN')
    getTenants() {
        return this.tenantService.findAll()
    }
    @Post()
    @UseGuards(JwtAuthGuard)
    @Roles('SUPER_ADMIN')
    createTenant(@Body() data: CreateTenantDto) {
        return this.tenantService.create(data)
    }
}
