import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, BannerStatus } from '../../generated/client/index.js';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto.js';
import { MinioService } from '../minio/minio.service.js';

@Injectable()
export class BannersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
  ) {}

  /**
   * [Public] Lấy danh sách banner công khai theo vị trí (HOME_HERO, SIDEBAR...)
   */
  async getPublicBanners(position?: string) {
    const now = new Date();
    const where: Prisma.BannerWhereInput = {
      status: BannerStatus.ACTIVE,
      AND: [
        { OR: [{ startAt: null }, { startAt: { lte: now } }] },
        { OR: [{ endAt: null }, { endAt: { gte: now } }] },
      ],
    };

    if (position) {
      where.position = position;
    }

    return this.prisma.banner.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * [Admin] Danh sách toàn bộ banner
   */
  async getAdminBanners(query: { position?: string; status?: BannerStatus }) {
    const where: Prisma.BannerWhereInput = {};
    if (query.position) where.position = query.position;
    if (query.status) where.status = query.status;

    return this.prisma.banner.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * [Admin] Tạo banner mới
   */
  async createBanner(dto: CreateBannerDto) {
    return this.prisma.banner.create({
      data: {
        title: dto.title.trim(),
        imageUrl: dto.imageUrl.trim(),
        targetUrl: dto.targetUrl?.trim() || null,
        position: dto.position?.trim() || 'HOME_HERO',
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
        status: dto.status || BannerStatus.ACTIVE,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  /**
   * [Admin] Cập nhật banner
   */
  async updateBanner(id: string, dto: UpdateBannerDto) {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy banner với ID: ${id}`);
    }

    const data: Prisma.BannerUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.imageUrl !== undefined) {
      const cleanUrl = dto.imageUrl.trim();
      if (cleanUrl !== existing.imageUrl && existing.imageUrl) {
        const oldKey = this.minioService.extractObjectKey(existing.imageUrl);
        if (oldKey) {
          await this.minioService.deleteFile(oldKey);
        }
      }
      data.imageUrl = cleanUrl;
    }
    if (dto.targetUrl !== undefined) data.targetUrl = dto.targetUrl?.trim() || null;
    if (dto.position !== undefined) data.position = dto.position.trim();
    if (dto.startAt !== undefined) data.startAt = dto.startAt ? new Date(dto.startAt) : null;
    if (dto.endAt !== undefined) data.endAt = dto.endAt ? new Date(dto.endAt) : null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    return this.prisma.banner.update({
      where: { id },
      data,
    });
  }

  /**
   * [Admin] Xóa banner
   */
  async deleteBanner(id: string) {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy banner với ID: ${id}`);
    }

    if (existing.imageUrl) {
      const objectKey = this.minioService.extractObjectKey(existing.imageUrl);
      if (objectKey) {
        await this.minioService.deleteFile(objectKey);
      }
    }

    await this.prisma.banner.delete({ where: { id } });
    return { message: 'Đã xóa banner thành công' };
  }
}
