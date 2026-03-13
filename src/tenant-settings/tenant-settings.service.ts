import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from 'src/audit/audit.service';
import type { CurrentJwtUser } from 'src/auth/strategies/jwt.strategy';
import { Tenant } from 'src/tenant/entities/tenant.entity';
import { TenantSetting } from './entities/tenant-setting.entity';
import { PlatformSetting } from './entities/platform-setting.entity';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  DEFAULT_BRANDING_SETTINGS,
  DEFAULT_THEME_SETTINGS,
  PLATFORM_SETTINGS_SCOPE,
  TenantSettingsAssetType,
} from './tenant-settings.constants';
import { S3StorageService } from './services/s3-storage.service';

type UploadedAssetFile = {
  buffer: Buffer;
  mimetype: string;
};

@Injectable()
export class TenantSettingsService {
  constructor(
    @InjectRepository(TenantSetting)
    private readonly tenantSettingsRepository: Repository<TenantSetting>,
    @InjectRepository(PlatformSetting)
    private readonly platformSettingsRepository: Repository<PlatformSetting>,
    @InjectRepository(Tenant)
    private readonly tenantsRepository: Repository<Tenant>,
    private readonly auditService: AuditService,
    private readonly s3StorageService: S3StorageService,
  ) {}

  async findPlatform(): Promise<PlatformSetting> {
    return this.getOrCreatePlatformSettings();
  }

  async updatePlatform(
    dto: UpdateTenantSettingsDto,
    currentUser: CurrentJwtUser,
  ): Promise<PlatformSetting> {
    const settings = await this.getOrCreatePlatformSettings();

    if (dto.theme) {
      settings.theme = {
        ...DEFAULT_THEME_SETTINGS,
        ...(settings.theme ?? {}),
        ...dto.theme,
      };
    }

    if (dto.branding) {
      settings.branding = {
        ...DEFAULT_BRANDING_SETTINGS,
        ...(settings.branding ?? {}),
        ...dto.branding,
      };
    }

    const updated = await this.platformSettingsRepository.save(settings);

    await this.auditService.log({
      actor_user_id: currentUser.sub,
      tenant_id: null,
      action: 'PLATFORM_SETTINGS_UPDATED',
      entity: 'platform_settings',
      entity_id: updated.id,
      metadata: {
        updated_fields: Object.keys(dto),
      },
    });

    return updated;
  }

  async uploadPlatformAsset(
    assetType: TenantSettingsAssetType,
    file: UploadedAssetFile,
    currentUser: CurrentJwtUser,
  ): Promise<PlatformSetting> {
    if (!file?.buffer || !file.mimetype) {
      throw new BadRequestException('Image file is required');
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Unsupported image MIME type');
    }

    const settings = await this.getOrCreatePlatformSettings();
    const extension = this.resolveFileExtension(file.mimetype);
    const objectKey = `platform/${PLATFORM_SETTINGS_SCOPE.toLowerCase()}/assets/${assetType}.${extension}`;

    const previousKey =
      assetType === TenantSettingsAssetType.LOGO
        ? settings.logo_key
        : settings.favicon_key;

    if (previousKey && previousKey !== objectKey) {
      await this.s3StorageService.deleteObject(previousKey);
    }

    const assetUrl = await this.s3StorageService.uploadObject({
      key: objectKey,
      body: file.buffer,
      contentType: file.mimetype,
    });

    settings.branding = {
      ...DEFAULT_BRANDING_SETTINGS,
      ...(settings.branding ?? {}),
      ...(assetType === TenantSettingsAssetType.LOGO
        ? { logoUrl: assetUrl }
        : { faviconUrl: assetUrl }),
    };

    if (assetType === TenantSettingsAssetType.LOGO) {
      settings.logo_key = objectKey;
    } else {
      settings.favicon_key = objectKey;
    }

    const updated = await this.platformSettingsRepository.save(settings);

    await this.auditService.log({
      actor_user_id: currentUser.sub,
      tenant_id: null,
      action: 'PLATFORM_SETTINGS_ASSET_UPLOADED',
      entity: 'platform_settings',
      entity_id: updated.id,
      metadata: {
        asset_type: assetType,
        key: objectKey,
      },
    });

    return updated;
  }

  async findMine(currentUser: CurrentJwtUser): Promise<TenantSetting> {
    if (!currentUser.tenant_id) {
      throw new BadRequestException('Tenant context is required');
    }

    return this.getOrCreateByTenantId(currentUser.tenant_id);
  }

  async findByTenantId(tenantId: string): Promise<TenantSetting> {
    return this.getOrCreateByTenantId(tenantId);
  }

  async updateMine(
    dto: UpdateTenantSettingsDto,
    currentUser: CurrentJwtUser,
  ): Promise<TenantSetting> {
    if (!currentUser.tenant_id) {
      throw new BadRequestException('Tenant context is required');
    }

    return this.updateByTenantId(currentUser.tenant_id, dto, currentUser);
  }

  async updateByTenantId(
    tenantId: string,
    dto: UpdateTenantSettingsDto,
    currentUser: CurrentJwtUser,
  ): Promise<TenantSetting> {
    const settings = await this.getOrCreateByTenantId(tenantId);

    if (dto.theme) {
      settings.theme = {
        ...DEFAULT_THEME_SETTINGS,
        ...(settings.theme ?? {}),
        ...dto.theme,
      };
    }

    if (dto.branding) {
      settings.branding = {
        ...DEFAULT_BRANDING_SETTINGS,
        ...(settings.branding ?? {}),
        ...dto.branding,
      };
    }

    const updated = await this.tenantSettingsRepository.save(settings);

    await this.auditService.log({
      actor_user_id: currentUser.sub,
      tenant_id: tenantId,
      action: 'TENANT_SETTINGS_UPDATED',
      entity: 'tenant_settings',
      entity_id: updated.id,
      metadata: {
        updated_fields: Object.keys(dto),
      },
    });

    return updated;
  }

  async uploadMineAsset(
    assetType: TenantSettingsAssetType,
    file: UploadedAssetFile,
    currentUser: CurrentJwtUser,
  ): Promise<TenantSetting> {
    if (!currentUser.tenant_id) {
      throw new BadRequestException('Tenant context is required');
    }

    return this.uploadAssetByTenantId(
      currentUser.tenant_id,
      assetType,
      file,
      currentUser,
    );
  }

  async uploadAssetByTenantId(
    tenantId: string,
    assetType: TenantSettingsAssetType,
    file: UploadedAssetFile,
    currentUser: CurrentJwtUser,
  ): Promise<TenantSetting> {
    if (!file?.buffer || !file.mimetype) {
      throw new BadRequestException('Image file is required');
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Unsupported image MIME type');
    }

    const settings = await this.getOrCreateByTenantId(tenantId);
    const extension = this.resolveFileExtension(file.mimetype);
    const objectKey = `tenants/${tenantId}/assets/${assetType}.${extension}`;

    const previousKey =
      assetType === TenantSettingsAssetType.LOGO
        ? settings.logo_key
        : settings.favicon_key;

    if (previousKey && previousKey !== objectKey) {
      await this.s3StorageService.deleteObject(previousKey);
    }

    const assetUrl = await this.s3StorageService.uploadObject({
      key: objectKey,
      body: file.buffer,
      contentType: file.mimetype,
    });

    settings.branding = {
      ...DEFAULT_BRANDING_SETTINGS,
      ...(settings.branding ?? {}),
      ...(assetType === TenantSettingsAssetType.LOGO
        ? { logoUrl: assetUrl }
        : { faviconUrl: assetUrl }),
    };

    if (assetType === TenantSettingsAssetType.LOGO) {
      settings.logo_key = objectKey;
    } else {
      settings.favicon_key = objectKey;
    }

    const updated = await this.tenantSettingsRepository.save(settings);

    await this.auditService.log({
      actor_user_id: currentUser.sub,
      tenant_id: tenantId,
      action: 'TENANT_SETTINGS_ASSET_UPLOADED',
      entity: 'tenant_settings',
      entity_id: updated.id,
      metadata: {
        asset_type: assetType,
        key: objectKey,
      },
    });

    return updated;
  }

  private async getOrCreateByTenantId(tenantId: string): Promise<TenantSetting> {
    await this.ensureTenantExists(tenantId);

    const existingSettings = await this.tenantSettingsRepository.findOne({
      where: { tenant_id: tenantId },
    });

    if (existingSettings) {
      if (!existingSettings.theme || Object.keys(existingSettings.theme).length === 0) {
        existingSettings.theme = {
          ...DEFAULT_THEME_SETTINGS,
        };
      }
      if (
        !existingSettings.branding ||
        Object.keys(existingSettings.branding).length === 0
      ) {
        existingSettings.branding = {
          ...DEFAULT_BRANDING_SETTINGS,
        };
      }
      return existingSettings;
    }

    const settings = this.tenantSettingsRepository.create({
      tenant_id: tenantId,
      theme: {
        ...DEFAULT_THEME_SETTINGS,
      },
      branding: {
        ...DEFAULT_BRANDING_SETTINGS,
      },
      logo_key: null,
      favicon_key: null,
    });

    return this.tenantSettingsRepository.save(settings);
  }

  private async getOrCreatePlatformSettings(): Promise<PlatformSetting> {
    const existingSettings = await this.platformSettingsRepository.findOne({
      where: { scope: PLATFORM_SETTINGS_SCOPE },
    });

    if (existingSettings) {
      if (!existingSettings.theme || Object.keys(existingSettings.theme).length === 0) {
        existingSettings.theme = {
          ...DEFAULT_THEME_SETTINGS,
        };
      }
      if (
        !existingSettings.branding ||
        Object.keys(existingSettings.branding).length === 0
      ) {
        existingSettings.branding = {
          ...DEFAULT_BRANDING_SETTINGS,
        };
      }
      return existingSettings;
    }

    const settings = this.platformSettingsRepository.create({
      scope: PLATFORM_SETTINGS_SCOPE,
      theme: {
        ...DEFAULT_THEME_SETTINGS,
      },
      branding: {
        ...DEFAULT_BRANDING_SETTINGS,
      },
      logo_key: null,
      favicon_key: null,
    });

    return this.platformSettingsRepository.save(settings);
  }

  private async ensureTenantExists(tenantId: string): Promise<void> {
    const tenant = await this.tenantsRepository.findOneBy({ id: tenantId });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
  }

  private resolveFileExtension(mimeType: string): string {
    switch (mimeType) {
      case 'image/png':
        return 'png';
      case 'image/jpeg':
        return 'jpg';
      case 'image/webp':
        return 'webp';
      case 'image/svg+xml':
        return 'svg';
      case 'image/x-icon':
      case 'image/vnd.microsoft.icon':
        return 'ico';
      default:
        throw new BadRequestException('Unsupported image MIME type');
    }
  }
}
