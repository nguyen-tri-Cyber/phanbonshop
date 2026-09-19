import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CouponType, Prisma } from '../../generated/client/index.js';
import { createLogger } from '@phanbonshop/logger';
import { CreateCouponInput, UpdateCouponInput } from './dto/coupon.dto.js';

const logger = createLogger('order-service:coupons');

export interface CouponValidationResult {
  valid: boolean;
  couponId: string;
  code: string;
  type: CouponType;
  value: number;
  discountAmount: number;
  isFreeShipping: boolean;
  message: string;
}

@Injectable()
export class CouponsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedInitialCoupons();
  }

  /**
   * Khởi tạo các mã giảm giá nông nghiệp mẫu
   */
  async seedInitialCoupons() {
    const defaultCoupons = [
      {
        code: 'PHANBON50K',
        description: 'Giảm 50.000đ cho đơn hàng phân bón từ 500.000đ',
        type: CouponType.FIXED_AMOUNT,
        value: 50000,
        minOrderAmount: 500000,
        maxDiscountAmount: 50000,
        enabled: true,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2028-12-31'),
        usageLimit: 1000,
        usagePerCustomer: 5,
      },
      {
        code: 'MUAVU10',
        description: 'Ưu đãi mùa vụ: Giảm 10% tối đa 200.000đ cho đơn từ 1.000.000đ',
        type: CouponType.PERCENTAGE,
        value: 10,
        minOrderAmount: 1000000,
        maxDiscountAmount: 200000,
        enabled: true,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2028-12-31'),
        usageLimit: 500,
        usagePerCustomer: 2,
      },
      {
        code: 'FREESHIP',
        description: 'Miễn phí vận chuyển toàn quốc cho đơn từ 2.000.000đ',
        type: CouponType.FREE_SHIPPING,
        value: 0,
        minOrderAmount: 2000000,
        enabled: true,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2028-12-31'),
        usageLimit: 2000,
        usagePerCustomer: 10,
      },
    ];

    for (const c of defaultCoupons) {
      await this.prisma.coupon.upsert({
        where: { code: c.code },
        create: c,
        update: {},
      });
    }
    logger.info('Đã hoàn tất khởi tạo các mã coupon ưu đãi mặc định.');
  }

  /**
   * [Admin-Only] Tạo mã coupon mới cho sàn
   */
  async createCoupon(dto: CreateCouponInput) {
    const rawCode = dto.code || '';
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      throw new BadRequestException('Mã coupon không được để trống.');
    }

    const existing = await this.prisma.coupon.findUnique({
      where: { code },
    });
    if (existing) {
      throw new BadRequestException(`Mã coupon "${code}" đã tồn tại trên hệ thống.`);
    }

    const type = (dto.type || dto.discountType || CouponType.FIXED_AMOUNT) as CouponType;
    const value = Number(dto.value ?? dto.discountValue ?? 0);
    const minOrderAmount = Number(dto.minOrderAmount ?? dto.minimumOrder ?? dto.minOrderValue ?? 0);
    const maxDiscountAmount = dto.maxDiscountAmount ?? dto.maximumDiscount ?? null;
    const rawStart = dto.startDate || dto.startAt;
    const startDate = rawStart ? new Date(rawStart) : new Date();
    const rawEnd = dto.endDate || dto.endAt;
    const endDate = rawEnd ? new Date(rawEnd) : new Date(Date.now() + 30 * 86400000);
    const usageLimit = dto.usageLimit ? Number(dto.usageLimit) : null;
    const usagePerCustomer = dto.usagePerCustomer ? Number(dto.usagePerCustomer) : 1;
    const enabled = dto.enabled !== undefined ? Boolean(dto.enabled) : true;

    let applicableCategories: string | null = null;
    if (dto.applicableCategories) {
      applicableCategories = Array.isArray(dto.applicableCategories)
        ? JSON.stringify(dto.applicableCategories)
        : String(dto.applicableCategories);
    }

    let applicableProducts: string | null = null;
    if (dto.applicableProducts) {
      applicableProducts = Array.isArray(dto.applicableProducts)
        ? JSON.stringify(dto.applicableProducts)
        : String(dto.applicableProducts);
    }

    return this.prisma.coupon.create({
      data: {
        code,
        description: dto.description || `Mã giảm giá ${code}`,
        type,
        value,
        minOrderAmount,
        maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
        startDate,
        endDate,
        usageLimit,
        usagePerCustomer,
        enabled,
        applicableCategories,
        applicableProducts,
      },
    });
  }

  /**
   * [Admin-Only] Danh sách toàn bộ mã giảm giá kèm tìm kiếm, bộ lọc và phân trang
   */
  async getAdminCoupons(query: {
    page?: number;
    limit?: number;
    search?: string;
    enabled?: string | boolean;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.CouponWhereInput = {};

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { code: { contains: s } },
        { description: { contains: s } },
      ];
    }

    if (query.enabled !== undefined && query.enabled !== '') {
      where.enabled = String(query.enabled) === 'true';
    }

    const [items, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { usages: true },
          },
        },
      }),
      this.prisma.coupon.count({ where }),
    ]);

    const now = new Date();
    const formatted = items.map((c) => {
      let status: 'ACTIVE' | 'EXPIRED' | 'DISABLED' | 'OUT_OF_LIMIT' = 'ACTIVE';
      if (!c.enabled) {
        status = 'DISABLED';
      } else if (now > c.endDate) {
        status = 'EXPIRED';
      } else if (c.usageLimit !== null && c.usedCount >= c.usageLimit) {
        status = 'OUT_OF_LIMIT';
      }

      return {
        id: c.id,
        code: c.code,
        description: c.description,
        type: c.type,
        value: Number(c.value),
        minOrderAmount: Number(c.minOrderAmount || 0),
        maxDiscountAmount: c.maxDiscountAmount ? Number(c.maxDiscountAmount) : null,
        startDate: c.startDate,
        endDate: c.endDate,
        usageLimit: c.usageLimit,
        usedCount: c.usedCount,
        usagePerCustomer: c.usagePerCustomer,
        enabled: c.enabled,
        applicableCategories: c.applicableCategories,
        applicableProducts: c.applicableProducts,
        status,
        actualUsagesCount: c._count?.usages || 0,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    });

    return {
      items: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * [Admin-Only] Chi tiết mã coupon theo ID hoặc Code
   */
  async getCouponById(idOrCode: string) {
    const coupon = await this.prisma.coupon.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode.toUpperCase() }],
      },
      include: {
        usages: {
          take: 20,
          orderBy: { usedAt: 'desc' },
        },
        _count: {
          select: { usages: true },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException(`Không tìm thấy mã giảm giá: ${idOrCode}`);
    }

    return {
      ...coupon,
      value: Number(coupon.value),
      minOrderAmount: Number(coupon.minOrderAmount || 0),
      maxDiscountAmount: coupon.maxDiscountAmount ? Number(coupon.maxDiscountAmount) : null,
    };
  }

  /**
   * [Admin-Only] Cập nhật mã giảm giá
   */
  async updateCoupon(id: string, dto: UpdateCouponInput) {
    const existing = await this.prisma.coupon.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Không tìm thấy mã giảm giá với ID: ${id}`);
    }

    const data: Prisma.CouponUpdateInput = {};

    if (dto.code && dto.code.trim()) {
      const code = dto.code.trim().toUpperCase();
      if (code !== existing.code) {
        const dup = await this.prisma.coupon.findUnique({ where: { code } });
        if (dup) {
          throw new BadRequestException(`Mã coupon "${code}" đã tồn tại.`);
        }
        data.code = code;
      }
    }

    if (dto.description !== undefined) data.description = dto.description;
    if (dto.type || dto.discountType) data.type = dto.type || dto.discountType;
    if (dto.value !== undefined || dto.discountValue !== undefined) {
      data.value = Number(dto.value ?? dto.discountValue);
    }
    if (dto.minOrderAmount !== undefined || dto.minimumOrder !== undefined || dto.minOrderValue !== undefined) {
      data.minOrderAmount = Number(dto.minOrderAmount ?? dto.minimumOrder ?? dto.minOrderValue);
    }
    if (dto.maxDiscountAmount !== undefined || dto.maximumDiscount !== undefined) {
      const maxVal = dto.maxDiscountAmount ?? dto.maximumDiscount;
      data.maxDiscountAmount = maxVal ? Number(maxVal) : null;
    }
    const rawStart = dto.startDate || dto.startAt;
    if (rawStart) {
      data.startDate = new Date(rawStart);
    }
    const rawEnd = dto.endDate || dto.endAt;
    if (rawEnd) {
      data.endDate = new Date(rawEnd);
    }
    if (dto.usageLimit !== undefined) {
      data.usageLimit = dto.usageLimit ? Number(dto.usageLimit) : null;
    }
    if (dto.usagePerCustomer !== undefined) {
      data.usagePerCustomer = Number(dto.usagePerCustomer);
    }
    if (dto.enabled !== undefined) {
      data.enabled = Boolean(dto.enabled);
    }
    if (dto.applicableCategories !== undefined) {
      data.applicableCategories = Array.isArray(dto.applicableCategories)
        ? JSON.stringify(dto.applicableCategories)
        : (dto.applicableCategories ? String(dto.applicableCategories) : null);
    }
    if (dto.applicableProducts !== undefined) {
      data.applicableProducts = Array.isArray(dto.applicableProducts)
        ? JSON.stringify(dto.applicableProducts)
        : (dto.applicableProducts ? String(dto.applicableProducts) : null);
    }

    return this.prisma.coupon.update({
      where: { id },
      data,
    });
  }

  /**
   * [Admin-Only] Xóa hoặc vô hiệu hóa coupon
   */
  async deleteCoupon(id: string) {
    const existing = await this.prisma.coupon.findUnique({
      where: { id },
      include: { _count: { select: { usages: true } } },
    });

    if (!existing) {
      throw new NotFoundException(`Không tìm thấy mã giảm giá với ID: ${id}`);
    }

    // Nếu đã có lịch sử sử dụng, vô hiệu hóa thay vì xóa cứng để giữ toàn vẹn dữ liệu kế toán
    if (existing._count.usages > 0) {
      await this.prisma.coupon.update({
        where: { id },
        data: { enabled: false },
      });
      return {
        message: `Mã coupon "${existing.code}" đã có lịch sử sử dụng nên được chuyển sang trạng thái Vô hiệu hóa (disabled).`,
        disabled: true,
      };
    }

    await this.prisma.coupon.delete({ where: { id } });
    return {
      message: `Đã xóa thành công mã coupon "${existing.code}".`,
      deleted: true,
    };
  }

  /**
   * Danh sách coupon công khai đang hoạt động
   */
  async listActiveCoupons() {
    const now = new Date();
    return this.prisma.coupon.findMany({
      where: {
        enabled: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      select: {
        id: true,
        code: true,
        description: true,
        type: true,
        value: true,
        minOrderAmount: true,
        maxDiscountAmount: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Thẩm định coupon nghiêm ngặt ở Server-side
   */
  async validateCoupon(
    code: string,
    subtotal: number,
    customerId?: string,
    items?: Array<{ productId: string }>,
  ): Promise<CouponValidationResult> {
    const cleanCode = code.trim().toUpperCase();
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: cleanCode },
    });

    if (!coupon || !coupon.enabled) {
      throw new NotFoundException(`Mã giảm giá "${cleanCode}" không tồn tại hoặc đã bị vô hiệu`);
    }

    const now = new Date();
    if (now < coupon.startDate) {
      throw new BadRequestException(`Mã giảm giá "${cleanCode}" chưa đến thời gian áp dụng`);
    }
    if (now > coupon.endDate) {
      throw new BadRequestException(`Mã giảm giá "${cleanCode}" đã hết hạn`);
    }

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException(`Mã giảm giá "${cleanCode}" đã hết lượt sử dụng`);
    }

    if (customerId) {
      const userUsageCount = await this.prisma.couponUsage.count({
        where: {
          couponId: coupon.id,
          customerId,
        },
      });
      if (userUsageCount >= coupon.usagePerCustomer) {
        throw new BadRequestException(
          `Bạn đã đạt giới hạn sử dụng mã "${cleanCode}" (${coupon.usagePerCustomer} lần)`,
        );
      }
    }

    // Kiểm tra phạm vi áp dụng sản phẩm nếu có cấu hình
    if (coupon.applicableProducts && items && items.length > 0) {
      try {
        const allowedProducts: string[] = JSON.parse(coupon.applicableProducts);
        if (Array.isArray(allowedProducts) && allowedProducts.length > 0) {
          const hasEligibleProduct = items.some((item) =>
            allowedProducts.includes(item.productId),
          );
          if (!hasEligibleProduct) {
            throw new BadRequestException(
              `Mã giảm giá "${cleanCode}" chỉ áp dụng cho một số sản phẩm chỉ định`,
            );
          }
        }
      } catch {
        // Bỏ qua nếu json parse không hợp lệ
      }
    }

    const minOrder = Number(coupon.minOrderAmount || 0);
    if (subtotal < minOrder) {
      throw new BadRequestException(
        `Đơn hàng cần đạt tối thiểu ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(minOrder)} để áp dụng mã này`,
      );
    }

    let discountAmount = 0;
    const value = Number(coupon.value);
    const maxDiscount = coupon.maxDiscountAmount ? Number(coupon.maxDiscountAmount) : Infinity;

    if (coupon.type === CouponType.PERCENTAGE) {
      discountAmount = Math.min((subtotal * value) / 100, maxDiscount);
    } else if (coupon.type === CouponType.FIXED_AMOUNT) {
      discountAmount = Math.min(value, subtotal);
    }

    return {
      valid: true,
      couponId: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value,
      discountAmount: Math.round(discountAmount),
      isFreeShipping: coupon.type === CouponType.FREE_SHIPPING,
      message: 'Áp dụng mã giảm giá thành công',
    };
  }
}
