import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, PostStatus } from '../../generated/client/index.js';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto.js';
import { toVietnameseSlug } from '@phanbonshop/shared-utils';
import { MinioService } from '../minio/minio.service.js';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
  ) {}

  /**
   * [Admin] Tạo bài viết blog mới
   */
  async createPost(dto: CreatePostDto) {
    const rawSlug = dto.slug ? toVietnameseSlug(dto.slug) : toVietnameseSlug(dto.title);
    let finalSlug = rawSlug;
    let counter = 1;

    while (await this.prisma.post.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${rawSlug}-${counter++}`;
    }

    const status = dto.status || PostStatus.DRAFT;
    const publishedAt =
      status === PostStatus.PUBLISHED
        ? dto.publishedAt
          ? new Date(dto.publishedAt)
          : new Date()
        : dto.publishedAt
        ? new Date(dto.publishedAt)
        : null;

    return this.prisma.post.create({
      data: {
        title: dto.title.trim(),
        slug: finalSlug,
        excerpt: dto.excerpt?.trim() || null,
        content: dto.content,
        coverImageUrl: dto.coverImageUrl?.trim() || null,
        status,
        seoTitle: dto.seoTitle?.trim() || dto.title.trim(),
        seoDescription: dto.seoDescription?.trim() || dto.excerpt?.trim() || null,
        publishedAt,
      },
    });
  }

  /**
   * [Storefront] Danh sách bài viết kiến thức công khai
   */
  async getPublicPosts(query: { page?: number; limit?: number; search?: string }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 12));
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: Prisma.PostWhereInput = {
      status: PostStatus.PUBLISHED,
      publishedAt: { lte: now },
    };

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { title: { contains: s } },
        { excerpt: { contains: s } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImageUrl: true,
          status: true,
          publishedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * [Storefront] Chi tiết bài viết theo Slug
   */
  async getPostBySlug(slug: string) {
    const now = new Date();
    const post = await this.prisma.post.findFirst({
      where: {
        slug,
        status: PostStatus.PUBLISHED,
        publishedAt: { lte: now },
      },
    });

    if (!post) {
      throw new NotFoundException(`Không tìm thấy bài viết kiến thức với slug: ${slug}`);
    }

    return post;
  }

  /**
   * [Admin] Danh sách toàn bộ bài viết kèm phân trang, tìm kiếm & trạng thái
   */
  async getAdminPosts(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: PostStatus;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.PostWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { title: { contains: s } },
        { slug: { contains: s } },
        { excerpt: { contains: s } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * [Admin] Xem chi tiết bài viết theo ID
   */
  async getAdminPostById(id: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Không tìm thấy bài viết ID: ${id}`);
    }
    return post;
  }

  /**
   * [Admin] Cập nhật bài viết
   */
  async updatePost(id: string, dto: UpdatePostDto) {
    const existing = await this.prisma.post.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy bài viết ID: ${id}`);
    }

    const data: Prisma.PostUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.slug !== undefined) {
      const cleanSlug = toVietnameseSlug(dto.slug);
      if (cleanSlug !== existing.slug) {
        const dup = await this.prisma.post.findUnique({ where: { slug: cleanSlug } });
        if (dup) {
          throw new BadRequestException(`Slug "${cleanSlug}" đã tồn tại trên bài viết khác`);
        }
        data.slug = cleanSlug;
      }
    }
    if (dto.excerpt !== undefined) data.excerpt = dto.excerpt?.trim() || null;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.coverImageUrl !== undefined) {
      const cleanUrl = dto.coverImageUrl?.trim() || null;
      if (cleanUrl !== existing.coverImageUrl && existing.coverImageUrl) {
        const oldKey = this.minioService.extractObjectKey(existing.coverImageUrl);
        if (oldKey) {
          await this.minioService.deleteFile(oldKey);
        }
      }
      data.coverImageUrl = cleanUrl;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === PostStatus.PUBLISHED && !existing.publishedAt && !dto.publishedAt) {
        data.publishedAt = new Date();
      }
    }
    if (dto.seoTitle !== undefined) data.seoTitle = dto.seoTitle?.trim() || null;
    if (dto.seoDescription !== undefined) data.seoDescription = dto.seoDescription?.trim() || null;
    if (dto.publishedAt !== undefined) {
      data.publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : null;
    }

    return this.prisma.post.update({
      where: { id },
      data,
    });
  }

  /**
   * [Admin] Xóa bài viết
   */
  async deletePost(id: string) {
    const existing = await this.prisma.post.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy bài viết ID: ${id}`);
    }

    if (existing.coverImageUrl) {
      const objectKey = this.minioService.extractObjectKey(existing.coverImageUrl);
      if (objectKey) {
        await this.minioService.deleteFile(objectKey);
      }
    }

    await this.prisma.post.delete({ where: { id } });
    return { message: 'Đã xóa bài viết thành công' };
  }
}
