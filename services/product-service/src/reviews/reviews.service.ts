import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, ReviewStatus } from '../../generated/client/index.js';
import { CreateReviewDto } from './dto/review.dto.js';
import { createLogger } from '@phanbonshop/logger';

const logger = createLogger('product-service:reviews');

@Injectable()
export class ReviewsService {
  private readonly orderServiceUrl =
    process.env.ORDER_SERVICE_URL || 'http://localhost:3003';
  private readonly internalSecret =
    process.env.INTERNAL_SERVICE_SECRET ||
    'your_internal_service_mesh_shared_secret_2026';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tạo đánh giá sản phẩm mới kèm xác minh verifiedPurchase từ order-service
   */
  async createReview(
    customerId: string,
    dto: CreateReviewDto & { verifiedPurchase?: boolean },
  ) {
    if (!customerId) {
      throw new ForbiddenException('Bạn cần đăng nhập để gửi đánh giá');
    }

    // 1. Kiểm tra sản phẩm tồn tại
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true, name: true },
    });
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với ID: ${dto.productId}`);
    }

    // 2. Tự động xác minh verifiedPurchase qua order-service
    // CLIENT KHÔNG THỂ TỰ SET verifiedPurchase: backend luôn ghi đè dựa trên kiểm tra thực tế
    let verifiedPurchase = false;
    let verifiedOrderItemId: string | null = null;

    try {
      const verifyUrl = new URL(`${this.orderServiceUrl}/internal/v1/orders/verify-purchase`);
      verifyUrl.searchParams.set('customerId', customerId);
      verifyUrl.searchParams.set('productId', dto.productId);
      if (dto.orderItemId) {
        verifyUrl.searchParams.set('orderItemId', dto.orderItemId);
      }

      const res = await fetch(verifyUrl.toString(), {
        headers: {
          'X-Internal-Secret': this.internalSecret,
        },
      });

      if (res.ok) {
        const checkData = (await res.json()) as {
          data?: { verifiedPurchase?: boolean; orderItemId?: string };
          verifiedPurchase?: boolean;
          orderItemId?: string;
        };
        const verifyResult = checkData.data !== undefined ? checkData.data : checkData;
        if (verifyResult && verifyResult.verifiedPurchase === true) {
          verifiedPurchase = true;
          verifiedOrderItemId = verifyResult.orderItemId || dto.orderItemId || null;
        }
      }
    } catch (err: unknown) {
      logger.warn('Không thể xác minh verifiedPurchase từ order-service', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return this.prisma.review.create({
      data: {
        customerId,
        productId: dto.productId,
        orderItemId: verifiedOrderItemId,
        rating: dto.rating,
        comment: dto.comment,
        status: ReviewStatus.APPROVED,
        verifiedPurchase,
      },
    });
  }

  /**
   * Lấy danh sách đánh giá công khai của sản phẩm (chỉ APPROVED)
   */
  async getProductReviews(
    productId: string,
    query: { page?: number; limit?: number; rating?: number },
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {
      productId,
      status: ReviewStatus.APPROVED,
    };

    if (query.rating) {
      where.rating = Number(query.rating);
    }

    const [reviews, total, allApproved] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where: { productId, status: ReviewStatus.APPROVED },
        select: { rating: true },
      }),
    ]);

    // Tính toán thống kê đánh giá thật
    const totalApproved = allApproved.length;
    let averageRating = 0;
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    if (totalApproved > 0) {
      const sum = allApproved.reduce((acc, curr) => {
        ratingDistribution[curr.rating] = (ratingDistribution[curr.rating] || 0) + 1;
        return acc + curr.rating;
      }, 0);
      averageRating = Number((sum / totalApproved).toFixed(1));
    }

    return {
      reviews,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      stats: {
        averageRating,
        totalReviews: totalApproved,
        ratingDistribution,
      },
    };
  }

  /**
   * [Admin] Danh sách đánh giá toàn sàn phục vụ kiểm duyệt
   */
  async getAdminReviews(query: {
    page?: number;
    limit?: number;
    status?: ReviewStatus;
    productId?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.productId) where.productId = query.productId;

    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: { id: true, name: true, slug: true, sku: true },
          },
        },
      }),
      this.prisma.review.count({ where }),
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
   * [Admin] Cập nhật trạng thái kiểm duyệt đánh giá
   */
  async updateReviewStatus(id: string, status: ReviewStatus) {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy đánh giá với ID: ${id}`);
    }

    return this.prisma.review.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * [Admin / User] Xóa đánh giá
   */
  async deleteReview(id: string, userId?: string, isAdmin?: boolean) {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy đánh giá với ID: ${id}`);
    }

    if (!isAdmin && existing.customerId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xóa đánh giá này');
    }

    await this.prisma.review.delete({ where: { id } });
    return { message: 'Đã xóa đánh giá thành công' };
  }
}
