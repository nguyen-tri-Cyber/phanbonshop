import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  SyncCustomerProfileDto,
  CreateAddressDto,
  UpdateProfileDto,
  UpdateAddressDto,
} from './dto/customer.dto.js';
import { CustomerProfile, Address, Prisma } from '../../generated/client/index.js';
import { VIETNAM_DIVISIONS } from '@phanbonshop/shared-utils';
import { createLogger } from '@phanbonshop/logger';

const logger = createLogger('customer-service');

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Đồng bộ hoặc khởi tạo hồ sơ người dùng
   */
  async syncProfile(dto: SyncCustomerProfileDto): Promise<CustomerProfile> {
    return this.prisma.customerProfile.upsert({
      where: { userId: dto.userId },
      create: {
        userId: dto.userId,
        fullName: dto.fullName,
        phone: dto.phone || null,
        avatarUrl: dto.avatarUrl || null,
      },
      update: {
        fullName: dto.fullName,
        phone: dto.phone || undefined,
        avatarUrl: dto.avatarUrl || undefined,
      },
    });
  }

  /**
   * Lấy hoặc tự động khởi tạo hồ sơ nếu chưa có
   */
  async getOrCreateProfile(
    userId: string,
    initialData?: { fullName?: string; phone?: string },
  ): Promise<CustomerProfile> {
    let profile = await this.prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      profile = await this.prisma.customerProfile.create({
        data: {
          userId,
          fullName: initialData?.fullName || 'Khách Hàng',
          phone: initialData?.phone || null,
        },
      });
      logger.info(`Đã tự động khởi tạo hồ sơ khách hàng cho userId: ${userId}`);
    }

    return profile;
  }

  /**
   * Lấy chi tiết hồ sơ cá nhân kèm danh sách địa chỉ
   */
  async getProfile(
    userId: string,
    initialData?: { fullName?: string; phone?: string },
  ): Promise<CustomerProfile & { addresses: Address[] }> {
    const profile = await this.getOrCreateProfile(userId, initialData);

    const fullProfile = await this.prisma.customerProfile.findUnique({
      where: { id: profile.id },
      include: {
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    return fullProfile!;
  }

  /**
   * Cập nhật thông tin cá nhân
   */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<CustomerProfile> {
    const profile = await this.getOrCreateProfile(userId);

    return this.prisma.customerProfile.update({
      where: { id: profile.id },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      },
    });
  }

  /**
   * Lấy danh sách địa chỉ giao hàng của khách hàng
   */
  async getAddresses(userId: string): Promise<Address[]> {
    const profile = await this.getOrCreateProfile(userId);

    return this.prisma.address.findMany({
      where: { customerId: profile.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Thêm địa chỉ giao hàng mới
   */
  async addAddress(userId: string, dto: CreateAddressDto): Promise<Address> {
    const profile = await this.getOrCreateProfile(userId);

    const addressCount = await this.prisma.address.count({
      where: { customerId: profile.id },
    });

    // Nếu là địa chỉ đầu tiên hoặc được đánh dấu default, đặt isDefault = true
    const shouldBeDefault = addressCount === 0 || dto.isDefault === true;

    if (shouldBeDefault && addressCount > 0) {
      await this.prisma.address.updateMany({
        where: { customerId: profile.id },
        data: { isDefault: false },
      });
    }

    const created = await this.prisma.address.create({
      data: {
        customerId: profile.id,
        recipientName: dto.recipientName,
        phone: dto.phone,
        provinceCode: dto.provinceCode,
        provinceName: dto.provinceName,
        districtCode: dto.districtCode,
        districtName: dto.districtName,
        wardCode: dto.wardCode,
        wardName: dto.wardName,
        addressLine: dto.addressLine,
        isDefault: shouldBeDefault,
      },
    });

    logger.info(`Đã thêm địa chỉ mới cho user ${userId}`, { addressId: created.id });
    return created;
  }

  /**
   * Cập nhật địa chỉ giao hàng
   */
  async updateAddress(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ): Promise<Address> {
    const profile = await this.getOrCreateProfile(userId);

    const existing = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        customerId: profile.id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy địa chỉ này');
    }

    if (dto.isDefault === true) {
      await this.prisma.address.updateMany({
        where: { customerId: profile.id },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.update({
      where: { id: addressId },
      data: {
        ...(dto.recipientName !== undefined ? { recipientName: dto.recipientName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.provinceCode !== undefined ? { provinceCode: dto.provinceCode } : {}),
        ...(dto.provinceName !== undefined ? { provinceName: dto.provinceName } : {}),
        ...(dto.districtCode !== undefined ? { districtCode: dto.districtCode } : {}),
        ...(dto.districtName !== undefined ? { districtName: dto.districtName } : {}),
        ...(dto.wardCode !== undefined ? { wardCode: dto.wardCode } : {}),
        ...(dto.wardName !== undefined ? { wardName: dto.wardName } : {}),
        ...(dto.addressLine !== undefined ? { addressLine: dto.addressLine } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      },
    });
  }

  /**
   * Xóa địa chỉ giao hàng
   */
  async deleteAddress(
    userId: string,
    addressId: string,
  ): Promise<{ success: boolean; message: string }> {
    const profile = await this.getOrCreateProfile(userId);

    const existing = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        customerId: profile.id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy địa chỉ này');
    }

    const wasDefault = existing.isDefault;

    await this.prisma.address.delete({
      where: { id: addressId },
    });

    // Nếu địa chỉ bị xóa là mặc định, gán địa chỉ kế tiếp làm mặc định
    if (wasDefault) {
      const remainingAddress = await this.prisma.address.findFirst({
        where: { customerId: profile.id },
        orderBy: { createdAt: 'desc' },
      });

      if (remainingAddress) {
        await this.prisma.address.update({
          where: { id: remainingAddress.id },
          data: { isDefault: true },
        });
      }
    }

    logger.info(`Đã xóa địa chỉ ${addressId} của user ${userId}`);
    return { success: true, message: 'Đã xóa địa chỉ giao hàng' };
  }

  /**
   * Đặt địa chỉ làm mặc định
   */
  async setDefaultAddress(userId: string, addressId: string): Promise<Address> {
    const profile = await this.getOrCreateProfile(userId);

    const existing = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        customerId: profile.id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy địa chỉ này');
    }

    await this.prisma.address.updateMany({
      where: { customerId: profile.id },
      data: { isDefault: false },
    });

    return this.prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    });
  }

  /**
   * Lấy bộ dữ liệu hành chính Tỉnh/Thành/Quận/Huyện/Phường/Xã Việt Nam
   */
  getDivisions() {
    return VIETNAM_DIVISIONS;
  }

  /**
   * [Admin] Lấy danh sách khách hàng toàn sàn kèm thông tin tổng hợp
   * Tuyệt đối không trả: passwordHash, refreshToken, tokenHash, secrets
   */
  async getAdminCustomers(query: { page?: number; limit?: number; search?: string }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerProfileWhereInput = {};
    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { fullName: { contains: s } },
        { phone: { contains: s } },
        { userId: { contains: s } },
      ];
    }

    const [profiles, total] = await Promise.all([
      this.prisma.customerProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          addresses: true,
        },
      }),
      this.prisma.customerProfile.count({ where }),
    ]);

    const orderServiceUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:3003';
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET || 'your_internal_service_mesh_shared_secret_2026';

    const items = await Promise.all(
      profiles.map(async (p) => {
        let orderCount = 0;
        let totalSpend = 0;
        try {
          const res = await fetch(`${orderServiceUrl}/api/v1/orders/admin/customer-summary/${p.userId}`, {
            headers: {
              'x-internal-secret': internalSecret,
            },
          });
          if (res.ok) {
            const data = (await res.json()) as {
              data?: { orderCount?: number; totalSpend?: number };
              orderCount?: number;
              totalSpend?: number;
            };
            const summary = data.data || data;
            orderCount = summary.orderCount || 0;
            totalSpend = summary.totalSpend || 0;
          }
        } catch {
          // Graceful fallback
        }

        return {
          id: p.id,
          userId: p.userId,
          fullName: p.fullName,
          phone: p.phone,
          avatarUrl: p.avatarUrl,
          addressCount: p.addresses.length,
          orderCount,
          totalSpend,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        };
      }),
    );

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * [Admin] Xem chi tiết một khách hàng: hồ sơ, sổ địa chỉ và lịch sử đơn hàng
   * Tuyệt đối không trả: passwordHash, refreshToken, tokenHash, secrets
   */
  async getAdminCustomerDetail(userId: string) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      include: { addresses: true },
    });

    if (!profile) {
      throw new NotFoundException(`Không tìm thấy hồ sơ khách hàng với ID: ${userId}`);
    }

    const orderServiceUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:3003';
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET || 'your_internal_service_mesh_shared_secret_2026';

    let orderCount = 0;
    let totalSpend = 0;
    let orders: unknown[] = [];

    try {
      const res = await fetch(`${orderServiceUrl}/api/v1/orders/admin/customer-summary/${userId}`, {
        headers: {
          'x-internal-secret': internalSecret,
        },
      });
      if (res.ok) {
        const data = (await res.json()) as {
          data?: { orderCount?: number; totalSpend?: number; orders?: unknown[] };
          orderCount?: number;
          totalSpend?: number;
          orders?: unknown[];
        };
        const summary = data.data || data;
        orderCount = summary.orderCount || 0;
        totalSpend = summary.totalSpend || 0;
        orders = summary.orders || [];
      }
    } catch {
      // Graceful fallback
    }

    return {
      profile: {
        id: profile.id,
        userId: profile.userId,
        fullName: profile.fullName,
        phone: profile.phone,
        avatarUrl: profile.avatarUrl,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
      addresses: profile.addresses,
      orderCount,
      totalSpend,
      orders,
    };
  }
}
