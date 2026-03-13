import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateTenantAdminDto } from './create-tenant-admin.dto';

export class UpdateTenantAdminDto extends PartialType(CreateTenantAdminDto) {
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
