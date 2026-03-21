import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { CurrentJwtUser } from '../auth/types'; 
import { Tenant } from '../tenant/entities/tenant.entity';
import { TenantSetting } from './entities/tenant-setting.entity';
import { PlatformSetting } from './entities/platform-setting.entity';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  DEFAULT_BRANDING_SETTINGS,
  PLATFORM_ASSET_MAX_SIZE_BYTES,
  PLATFORM_SETTINGS_SCOPE,
  TENANT_ASSET_MAX_SIZE_BYTES,
  TenantSettingsAssetType,
} from './tenant-settings.constants';
import {
  applyBrandingSettings,
  applyDefaultSettings,
  applyThemeMode,
  applyThemeOverrides,
  applyThemeSettings,
  ensureSettingsDefaults,
  serializeSettings,
} from './tenant-settings.mapper';
import { normalizeThemeSettings } from './tenant-theme.utils';
import { S3StorageService } from './services/s3-storage.service';
import {
  PublicBusinessSettingsResponse,
  TenantSettingsResponse,
} from './tenant-settings.types';

type UploadedAssetFile = {
  buffer: Buffer;
  mimetype: string;
  size?: number;
  originalname?: string;
};

type DetectedAssetFormat = 'png' | 'jpg' | 'webp' | 'ico';

type ValidatedAssetFile = {
  extension: string;
  contentType: string;
};

@Injectable()
export class TenantSettingsService {
  private readonly logger = new Logger(TenantSettingsService.name);

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

  async findPlatform(): Promise<TenantSettingsResponse> {
    const settings = await this.getOrCreatePlatformSettings();
    return serializeSettings(settings);
  }

  async updatePlatform(
    dto: UpdateTenantSettingsDto,
    currentUser: CurrentJwtUser,
  ): Promise<TenantSettingsResponse> {
    const settings = await this.getOrCreatePlatformSettings();

    if (dto.theme) {
      applyThemeSettings(
        settings,
        normalizeThemeSettings({
          ...serializeSettings(settings).theme,
          ...dto.theme,
        }),
      );
    }

    if (dto.themeMode) {
      applyThemeMode(settings, dto.themeMode);
    }

    if (dto.themeOverrides) {
      applyThemeOverrides(settings, dto.themeOverrides);
    }

    if (dto.branding) {
      applyBrandingSettings(settings, dto.branding);
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

    return serializeSettings(updated);
  }

  async uploadPlatformAsset(
    assetType: TenantSettingsAssetType,
    file: UploadedAssetFile,
    currentUser: CurrentJwtUser,
  ): Promise<TenantSettingsResponse> {
    const validatedFile = this.validateUploadedAsset(file, assetType, 'platform');

    const settings = await this.getOrCreatePlatformSettings();
    const extension = validatedFile.extension;
    const objectKey = this.buildPlatformAssetObjectKey(
      assetType,
      extension,
      file.originalname,
    );

    const previousKey =
      assetType === TenantSettingsAssetType.LOGO
        ? settings.logo_key
        : settings.favicon_key;

    const assetUrl = await this.s3StorageService.uploadObject({
      key: objectKey,
      body: file.buffer,
      contentType: validatedFile.contentType,
    });
    let updated: PlatformSetting;

    try {
      applyBrandingSettings(
        settings,
        assetType === TenantSettingsAssetType.LOGO
          ? { logoUrl: assetUrl }
          : { faviconUrl: assetUrl },
      );

      if (assetType === TenantSettingsAssetType.LOGO) {
        settings.logo_key = objectKey;
      } else {
        settings.favicon_key = objectKey;
      }

      updated = await this.platformSettingsRepository.save(settings);
    } catch (error) {
      await this.safeDeleteAssetObject(objectKey);
      throw error;
    }

    await this.safeDeletePreviousAsset(previousKey, objectKey);

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

    return serializeSettings(updated);
  }

  async findMine(currentUser: CurrentJwtUser): Promise<TenantSettingsResponse> {
    if (!currentUser.tenant_id) {
      throw new BadRequestException('El contexto del negocio es obligatorio.');
    }

    const settings = await this.getOrCreateByTenantId(currentUser.tenant_id);
    return serializeSettings(settings);
  }

  async findByTenantId(tenantId: string): Promise<TenantSettingsResponse> {
    const settings = await this.getOrCreateByTenantId(tenantId);
    return serializeSettings(settings);
  }

  async findPublicByBusinessSlug(
    businessSlug: string,
  ): Promise<PublicBusinessSettingsResponse> {
    const normalizedSlug = businessSlug.trim().toLowerCase();
    if (!normalizedSlug) {
      throw new BadRequestException('El slug del negocio es obligatorio.');
    }

    const business = await this.tenantsRepository.findOne({
      where: { slug: normalizedSlug },
    });

    if (!business || !business.is_active) {
      throw new NotFoundException('No se encontró el negocio');
    }

    const tenantSettings = await this.tenantSettingsRepository.findOne({
      where: { tenant_id: business.id },
    });

    if (tenantSettings) {
      ensureSettingsDefaults(tenantSettings);
      return this.toPublicBusinessSettings(
        { ...serializeSettings(tenantSettings), tenant_id: business.id },
        business,
      );
    }

    const platformSettings = await this.getOrCreatePlatformSettings();
    const serialized = serializeSettings(platformSettings);

    return this.toPublicBusinessSettings(
      {
        ...serialized,
        tenant_id: business.id,
      },
      business,
    );
  }

  async updateMine(
    dto: UpdateTenantSettingsDto,
    currentUser: CurrentJwtUser,
  ): Promise<TenantSettingsResponse> {
    if (!currentUser.tenant_id) {
      throw new BadRequestException('El contexto del negocio es obligatorio.');
    }

    return this.updateByTenantId(currentUser.tenant_id, dto, currentUser);
  }

  async updateByTenantId(
    tenantId: string,
    dto: UpdateTenantSettingsDto,
    currentUser: CurrentJwtUser,
  ): Promise<TenantSettingsResponse> {
    const settings = await this.getOrCreateByTenantId(tenantId);

    if (dto.theme) {
      applyThemeSettings(
        settings,
        normalizeThemeSettings({
          ...serializeSettings(settings).theme,
          ...dto.theme,
        }),
      );
    }

    if (dto.themeMode) {
      applyThemeMode(settings, dto.themeMode);
    }

    if (dto.themeOverrides) {
      applyThemeOverrides(settings, dto.themeOverrides);
    }

    if (dto.branding) {
      applyBrandingSettings(settings, dto.branding);
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

    return serializeSettings(updated);
  }

  async uploadMineAsset(
    assetType: TenantSettingsAssetType,
    file: UploadedAssetFile,
    currentUser: CurrentJwtUser,
  ): Promise<TenantSettingsResponse> {
    if (!currentUser.tenant_id) {
      throw new BadRequestException('El contexto del negocio es obligatorio.');
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
  ): Promise<TenantSettingsResponse> {
    const validatedFile = this.validateUploadedAsset(file, assetType, 'tenant');

    const settings = await this.getOrCreateByTenantId(tenantId);
    const extension = validatedFile.extension;
    const objectKey = this.buildTenantAssetObjectKey(
      tenantId,
      assetType,
      extension,
      file.originalname,
    );

    const previousKey =
      assetType === TenantSettingsAssetType.LOGO
        ? settings.logo_key
        : settings.favicon_key;

    const assetUrl = await this.s3StorageService.uploadObject({
      key: objectKey,
      body: file.buffer,
      contentType: validatedFile.contentType,
    });
    let updated: TenantSetting;

    try {
      applyBrandingSettings(
        settings,
        assetType === TenantSettingsAssetType.LOGO
          ? { logoUrl: assetUrl }
          : { faviconUrl: assetUrl },
      );

      if (assetType === TenantSettingsAssetType.LOGO) {
        settings.logo_key = objectKey;
      } else {
        settings.favicon_key = objectKey;
      }

      updated = await this.tenantSettingsRepository.save(settings);
    } catch (error) {
      await this.safeDeleteAssetObject(objectKey);
      throw error;
    }

    await this.safeDeletePreviousAsset(previousKey, objectKey);

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

    return serializeSettings(updated);
  }

  private async getOrCreateByTenantId(tenantId: string): Promise<TenantSetting> {
    await this.ensureTenantExists(tenantId);

    const existingSettings = await this.tenantSettingsRepository.findOne({
      where: { tenant_id: tenantId },
    });

    if (existingSettings) {
      ensureSettingsDefaults(existingSettings);
      return existingSettings;
    }

    const settings = this.tenantSettingsRepository.create({
      tenant_id: tenantId,
      logo_key: null,
      favicon_key: null,
    });
    applyDefaultSettings(settings);

    return this.tenantSettingsRepository.save(settings);
  }

  private async getOrCreatePlatformSettings(): Promise<PlatformSetting> {
    const existingSettings = await this.platformSettingsRepository.findOne({
      where: { scope: PLATFORM_SETTINGS_SCOPE },
    });

    if (existingSettings) {
      ensureSettingsDefaults(existingSettings);
      return existingSettings;
    }

    const settings = this.platformSettingsRepository.create({
      scope: PLATFORM_SETTINGS_SCOPE,
      logo_key: null,
      favicon_key: null,
    });
    applyDefaultSettings(settings);

    return this.platformSettingsRepository.save(settings);
  }

  private async ensureTenantExists(tenantId: string): Promise<void> {
    const tenant = await this.tenantsRepository.findOneBy({ id: tenantId });
    if (!tenant) {
      throw new NotFoundException('No se encontró el negocio.');
    }
  }

  private validateUploadedAsset(
    file: UploadedAssetFile,
    assetType: TenantSettingsAssetType,
    scope: 'platform' | 'tenant',
  ): ValidatedAssetFile {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Debes enviar un archivo de imagen.');
    }

    const fileSizeBytes = typeof file.size === 'number' ? file.size : file.buffer.length;
    const maxSizeBytes = this.resolveMaxAssetSizeBytes(scope, assetType);

    if (fileSizeBytes > maxSizeBytes) {
      throw new BadRequestException(
        `File too large for ${assetType}. Maximum allowed is ${this.formatBytes(maxSizeBytes)}.`,
      );
    }

    const detectedFormat = this.detectAssetFormat(file.buffer);
    if (!detectedFormat) {
      throw new BadRequestException(
        'Unsupported image file. Allowed formats: PNG, JPG, WEBP, ICO.',
      );
    }

    const declaredMime = file.mimetype?.trim().toLowerCase();
    if (declaredMime) {
      if (!ALLOWED_IMAGE_MIME_TYPES.has(declaredMime)) {
        throw new BadRequestException('El tipo MIME de la imagen no es compatible.');
      }

      if (!this.isMimeCompatibleWithFormat(declaredMime, detectedFormat)) {
        throw new BadRequestException(
          'File MIME type does not match the actual file content.',
        );
      }
    }

    return {
      extension: this.extensionFromFormat(detectedFormat),
      contentType: this.mimeFromFormat(detectedFormat),
    };
  }

  private resolveMaxAssetSizeBytes(
    scope: 'platform' | 'tenant',
    assetType: TenantSettingsAssetType,
  ): number {
    const maxSizeByAssetType =
      scope === 'platform' ? PLATFORM_ASSET_MAX_SIZE_BYTES : TENANT_ASSET_MAX_SIZE_BYTES;

    return maxSizeByAssetType[assetType];
  }

  private formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
  }

  private detectAssetFormat(buffer: Buffer): DetectedAssetFormat | null {
    if (this.startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
      return 'png';
    }

    if (this.startsWithBytes(buffer, [0xff, 0xd8, 0xff])) {
      return 'jpg';
    }

    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'webp';
    }

    if (this.startsWithBytes(buffer, [0x00, 0x00, 0x01, 0x00])) {
      return 'ico';
    }

    return null;
  }

  private startsWithBytes(buffer: Buffer, signature: number[]): boolean {
    if (buffer.length < signature.length) {
      return false;
    }

    return signature.every((byte, index) => buffer[index] === byte);
  }

  private isMimeCompatibleWithFormat(
    mimeType: string,
    format: DetectedAssetFormat,
  ): boolean {
    switch (format) {
      case 'png':
        return mimeType === 'image/png';
      case 'jpg':
        return mimeType === 'image/jpeg';
      case 'webp':
        return mimeType === 'image/webp';
      case 'ico':
        return mimeType === 'image/x-icon' || mimeType === 'image/vnd.microsoft.icon';
      default:
        return false;
    }
  }

  private extensionFromFormat(format: DetectedAssetFormat): string {
    switch (format) {
      case 'png':
        return 'png';
      case 'jpg':
        return 'jpg';
      case 'webp':
        return 'webp';
      case 'ico':
        return 'ico';
      default:
        throw new BadRequestException('El formato de la imagen no es compatible.');
    }
  }

  private mimeFromFormat(format: DetectedAssetFormat): string {
    switch (format) {
      case 'png':
        return 'image/png';
      case 'jpg':
        return 'image/jpeg';
      case 'webp':
        return 'image/webp';
      case 'ico':
        return 'image/x-icon';
      default:
        throw new BadRequestException('El formato de la imagen no es compatible.');
    }
  }

  private toPublicBusinessSettings(
    settings: TenantSettingsResponse,
    business: Tenant,
  ): PublicBusinessSettingsResponse {
    const normalizedBusinessName = business.name.trim();
    const branding = { ...settings.branding };

    if (
      !branding.appName?.trim() ||
      branding.appName.trim().toLowerCase() ===
        DEFAULT_BRANDING_SETTINGS.appName.toLowerCase()
    ) {
      branding.appName = normalizedBusinessName;
    }

    if (
      !branding.windowTitle?.trim() ||
      branding.windowTitle.trim() === DEFAULT_BRANDING_SETTINGS.windowTitle
    ) {
      branding.windowTitle = `${normalizedBusinessName} | Reserva online`;
    }

    return {
      ...settings,
      branding,
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
      },
    };
  }

  private buildPlatformAssetObjectKey(
    assetType: TenantSettingsAssetType,
    extension: string,
    originalName?: string,
  ): string {
    const fileName = this.buildVersionedAssetFileName(
      assetType,
      extension,
      originalName,
    );
    return `platform/${PLATFORM_SETTINGS_SCOPE.toLowerCase()}/assets/${assetType}/${fileName}`;
  }

  private buildTenantAssetObjectKey(
    tenantId: string,
    assetType: TenantSettingsAssetType,
    extension: string,
    originalName?: string,
  ): string {
    const fileName = this.buildVersionedAssetFileName(
      assetType,
      extension,
      originalName,
    );
    return `tenants/${tenantId}/assets/${assetType}/${fileName}`;
  }

  private buildVersionedAssetFileName(
    assetType: TenantSettingsAssetType,
    extension: string,
    originalName?: string,
  ): string {
    const normalizedBaseName = this.sanitizeAssetBaseName(
      originalName,
      assetType,
    );
    return `${normalizedBaseName}-${randomUUID()}.${extension}`;
  }

  private sanitizeAssetBaseName(
    originalName: string | undefined,
    fallbackName: string,
  ): string {
    const rawBaseName = originalName?.trim().replace(/\.[^.]+$/, '') || fallbackName;
    const normalized = rawBaseName
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);

    return normalized || fallbackName.toLowerCase();
  }

  private async safeDeletePreviousAsset(
    previousKey: string | null,
    currentKey: string,
  ): Promise<void> {
    if (!previousKey || previousKey === currentKey) {
      return;
    }

    await this.safeDeleteAssetObject(previousKey);
  }

  private async safeDeleteAssetObject(key: string): Promise<void> {
    try {
      await this.s3StorageService.deleteObject(key);
    } catch (error) {
      this.logger.warn(
        `Unable to delete stale asset object ${key}: ${String(error)}`,
      );
    }
  }
}
