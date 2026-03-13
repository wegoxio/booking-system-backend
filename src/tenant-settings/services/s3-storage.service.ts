import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type UploadObjectInput = {
  key: string;
  body: Buffer;
  contentType: string;
};

@Injectable()
export class S3StorageService {
  private readonly s3Client: S3Client | null;
  private readonly bucketName: string | null;
  private readonly region: string | null;
  private readonly publicBaseUrl: string | null;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    const bucketName = this.configService.get<string>('AWS_S3_BUCKET');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const sessionToken = this.configService.get<string>('AWS_SESSION_TOKEN');
    const forcePathStyle = this.envBool(
      this.configService.get('AWS_S3_FORCE_PATH_STYLE'),
      false,
    );

    this.publicBaseUrl =
      this.configService.get<string>('AWS_S3_PUBLIC_BASE_URL')?.trim() || null;

    if (!region || !bucketName || !accessKeyId || !secretAccessKey) {
      this.region = null;
      this.bucketName = null;
      this.s3Client = null;
      return;
    }

    this.region = region;
    this.bucketName = bucketName;
    this.s3Client = new S3Client({
      region,
      forcePathStyle,
      credentials: {
        accessKeyId,
        secretAccessKey,
        ...(sessionToken ? { sessionToken } : {}),
      },
    });
  }

  async uploadObject(input: UploadObjectInput): Promise<string> {
    this.ensureConfigured();
    await this.s3Client!.send(
      new PutObjectCommand({
        Bucket: this.bucketName!,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return this.buildPublicUrl(input.key);
  }

  async deleteObject(key: string): Promise<void> {
    if (!key) return;
    this.ensureConfigured();
    await this.s3Client!.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName!,
        Key: key,
      }),
    );
  }

  private buildPublicUrl(key: string): string {
    if (this.publicBaseUrl) {
      const normalizedBaseUrl = this.publicBaseUrl.replace(/\/+$/, '');
      return `${normalizedBaseUrl}/${key}`;
    }

    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }

  private ensureConfigured(): void {
    if (!this.s3Client || !this.bucketName || !this.region) {
      throw new ServiceUnavailableException(
        'S3 is not configured. Set AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.',
      );
    }
  }

  private envBool(value: unknown, defaultValue = false): boolean {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    return ['true', '1', 'yes'].includes(normalized);
  }
}
