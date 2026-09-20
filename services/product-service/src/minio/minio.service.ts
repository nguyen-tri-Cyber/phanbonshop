import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common';
import * as Minio from 'minio';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createLogger } from '@phanbonshop/logger';
import { getEnvString } from '@phanbonshop/config';
import { validateImageMagicBytes } from '@phanbonshop/shared-utils';

const logger = createLogger('product-service:minio');

export interface UploadResult {
  objectKey: string;
  url: string;
}

export interface UploadedFileDto {
  fieldname?: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class MinioService implements OnModuleInit {
  private client!: Minio.Client;
  public readonly bucketName = process.env.MINIO_BUCKET_PRODUCTS || 'product-images';
  private readonly endPoint = getEnvString(
    'MINIO_ENDPOINT',
    process.env.NODE_ENV === 'production' ? undefined : 'localhost',
  );
  private readonly port = Number(process.env.MINIO_PORT) || 9000;
  private readonly useSSL = process.env.MINIO_USE_SSL === 'true';

  async onModuleInit(): Promise<void> {
    this.client = new Minio.Client({
      endPoint: this.endPoint,
      port: this.port,
      useSSL: this.useSSL,
      accessKey: process.env.MINIO_ROOT_USER || 'admin',
      secretKey: getEnvString(
        'MINIO_ROOT_PASSWORD',
        process.env.NODE_ENV === 'production' ? undefined : 'admin123456',
      ),
    });

    try {
      const exists = await this.client.bucketExists(this.bucketName);
      if (!exists) {
        await this.client.makeBucket(this.bucketName);
        logger.info(`Bucket ${this.bucketName} đã được tạo mới trên MinIO`);

        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetBucketLocation', 's3:ListBucket'],
              Resource: [`arn:aws:s3:::${this.bucketName}`],
            },
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucketName}/*`],
            },
          ],
        };
        await this.client.setBucketPolicy(this.bucketName, JSON.stringify(policy));
      }
      logger.info(`Kết nối thành công tới MinIO bucket: ${this.bucketName}`);
    } catch (err) {
      logger.warn(`Không thể khởi tạo hoặc kiểm tra bucket ${this.bucketName} trên MinIO`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async uploadFile(
    file: UploadedFileDto,
    folder = 'products',
  ): Promise<UploadResult> {
    // 1. Kiểm tra Magic Bytes và chặn SVG (AUD-P2-004)
    const validation = validateImageMagicBytes(file.buffer, file.originalname, file.mimetype);
    if (!validation.valid) {
      throw new BadRequestException(validation.error || 'Tập tin hình ảnh không hợp lệ');
    }

    const ext = path.extname(file.originalname).toLowerCase() || `.${validation.detectedFormat || 'jpg'}`;
    const filename = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
    const objectKey = `${folder}/${filename}`;

    await this.client.putObject(
      this.bucketName,
      objectKey,
      file.buffer,
      file.size,
      {
        'Content-Type': validation.mimeType || file.mimetype,
      },
    );

    const protocol = this.useSSL ? 'https' : 'http';
    const url = `${protocol}://${this.endPoint}:${this.port}/${this.bucketName}/${objectKey}`;

    logger.info(`Tải tệp tin lên MinIO thành công: ${objectKey}`);
    return { objectKey, url };
  }

  extractObjectKey(urlOrKey: string): string | null {
    if (!urlOrKey) return null;
    if (!urlOrKey.startsWith('http://') && !urlOrKey.startsWith('https://')) {
      return urlOrKey;
    }
    const marker = `/${this.bucketName}/`;
    const idx = urlOrKey.indexOf(marker);
    if (idx !== -1) {
      return urlOrKey.slice(idx + marker.length);
    }
    return null;
  }

  async deleteFile(objectKey: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucketName, objectKey);
      logger.info(`Đã xóa tệp tin trên MinIO: ${objectKey}`);
    } catch (err) {
      logger.warn(`Lỗi khi xóa tệp tin ${objectKey} trên MinIO`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

