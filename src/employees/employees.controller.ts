import {
  Body,
  Controller,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

type CurrentJwtUser = {
  sub: string;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN';
  tenant_id: string | null;
};

const MAX_EMPLOYEE_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;

type UploadedAssetFile = {
  buffer: Buffer;
  mimetype: string;
  size?: number;
  originalname?: string;
};

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TENANT_ADMIN')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() currentUser: CurrentJwtUser) {
    return this.employeesService.create(dto, currentUser);
  }

  @Get()
  findAll(@CurrentUser() currentUser: CurrentJwtUser) {
    return this.employeesService.findAll(currentUser);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: CurrentJwtUser) {
    return this.employeesService.findOne(id, currentUser);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.employeesService.update(id, dto, currentUser);
  }

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_EMPLOYEE_AVATAR_SIZE_BYTES }),
        ],
        fileIsRequired: true,
      }),
    )
    file: UploadedAssetFile,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.employeesService.uploadAvatar(id, file, currentUser);
  }
}
