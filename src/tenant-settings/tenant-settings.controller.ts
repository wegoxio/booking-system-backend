import {
  Body,
  Controller,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseEnumPipe,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import type { CurrentJwtUser } from 'src/auth/types'; 
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { TenantSettingsService } from './tenant-settings.service';
import { TenantSettingsAssetType } from './tenant-settings.constants';

const MAX_ASSET_SIZE_BYTES = 2 * 1024 * 1024;
type UploadedAssetFile = {
  buffer: Buffer;
  mimetype: string;
  size?: number;
};

@Controller('tenant-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantSettingsController {
  constructor(private readonly tenantSettingsService: TenantSettingsService) {}

  @Get('platform/me')
  @Roles('SUPER_ADMIN')
  findPlatform() {
    return this.tenantSettingsService.findPlatform();
  }

  @Patch('platform/me')
  @Roles('SUPER_ADMIN')
  updatePlatform(
    @Body() dto: UpdateTenantSettingsDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.tenantSettingsService.updatePlatform(dto, currentUser);
  }

  @Post('platform/me/assets/:assetType')
  @Roles('SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  uploadPlatformAsset(
    @Param('assetType', new ParseEnumPipe(TenantSettingsAssetType))
    assetType: TenantSettingsAssetType,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_ASSET_SIZE_BYTES })],
        fileIsRequired: true,
      }),
    )
    file: UploadedAssetFile,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.tenantSettingsService.uploadPlatformAsset(
      assetType,
      file,
      currentUser,
    );
  }

  @Get('me')
  @Roles('TENANT_ADMIN')
  findMine(@CurrentUser() currentUser: CurrentJwtUser) {
    return this.tenantSettingsService.findMine(currentUser);
  }

  @Patch('me')
  @Roles('TENANT_ADMIN')
  updateMine(
    @Body() dto: UpdateTenantSettingsDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.tenantSettingsService.updateMine(dto, currentUser);
  }

  @Post('me/assets/:assetType')
  @Roles('TENANT_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  uploadMineAsset(
    @Param('assetType', new ParseEnumPipe(TenantSettingsAssetType))
    assetType: TenantSettingsAssetType,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_ASSET_SIZE_BYTES })],
        fileIsRequired: true,
      }),
    )
    file: UploadedAssetFile,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.tenantSettingsService.uploadMineAsset(assetType, file, currentUser);
  }

  @Get(':tenantId')
  @Roles('SUPER_ADMIN')
  findByTenantId(@Param('tenantId', new ParseUUIDPipe()) tenantId: string) {
    return this.tenantSettingsService.findByTenantId(tenantId);
  }

  @Patch(':tenantId')
  @Roles('SUPER_ADMIN')
  updateByTenantId(
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Body() dto: UpdateTenantSettingsDto,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.tenantSettingsService.updateByTenantId(tenantId, dto, currentUser);
  }

  @Post(':tenantId/assets/:assetType')
  @Roles('SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  uploadAssetByTenantId(
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Param('assetType', new ParseEnumPipe(TenantSettingsAssetType))
    assetType: TenantSettingsAssetType,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_ASSET_SIZE_BYTES })],
        fileIsRequired: true,
      }),
    )
    file: UploadedAssetFile,
    @CurrentUser() currentUser: CurrentJwtUser,
  ) {
    return this.tenantSettingsService.uploadAssetByTenantId(
      tenantId,
      assetType,
      file,
      currentUser,
    );
  }
}
