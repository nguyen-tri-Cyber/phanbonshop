import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  CompensationTaskType,
} from '../../generated/client/index.js';
import { CompensationService } from '../compensation/compensation.service.js';
import { createLogger } from '@phanbonshop/logger';
import { getEnvString, getServiceUrl, CANONICAL_PORTS } from '@phanbonshop/config';
import crypto from 'node:crypto';

const logger = createLogger('order-service:orders');

const ALLOWED_STATE_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.PACKING, OrderStatus.CANCELLED],
  [OrderStatus.PACKING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.RETURN_REQUESTED],
  [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED, OrderStatus.RETURN_REQUESTED],
  [OrderStatus.RETURN_REQUESTED]: [OrderStatus.RETURNED, OrderStatus.COMPLETED],
  [OrderStatus.RETURNED]: [OrderStatus.REFUNDED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};

@Injectable()
export class OrdersService {
  private readonly inventoryServiceUrl = getServiceUrl(
    'INVENTORY_SERVICE_URL',
    CANONICAL_PORTS.INVENTORY_SERVICE,
  );
  private readonly internalSecret = getEnvString('INTERNAL_SERVICE_SECRET');

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly compensationService?: CompensationService,
  ) {}

  /**
   * Sinh mã đơn hàng theo định dạng: DH-YYYYMMDD-XXXXXX
   * Không dùng sequential ID để bảo mật doanh số
   */
  generateOrderNumber(): string {
    const now = new Date();
    // Chuyển sang múi giờ VN (Asia/Ho_Chi_Minh)
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dateStr = formatter.format(now).replace(/-/g, ''); // 20260919

    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const bytes = crypto.randomBytes(6);
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      const byteVal = bytes[i];
      if (byteVal !== undefined) {
        randomPart += chars[byteVal % chars.length];
      }
    }

    return `DH-${dateStr}-${randomPart}`;
  }

  /**
   * Lấy danh sách đơn hàng của khách hàng
   */
  async findCustomerOrders(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId },
      include: {
        items: true,
        shippingAddress: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Lấy chi tiết đơn hàng theo ID hoặc OrderNumber
   */
  async findOrderByIdOrNumber(idOrNumber: string, customerId?: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }],
      },
      include: {
        items: true,
        shippingAddress: true,
        statusHistory: {
          orderBy: { createdAt: 'asc' },
        },
        payments: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với mã: ${idOrNumber}`);
    }

    if (customerId && order.customerId !== customerId) {
      throw new ForbiddenException('Bạn không có quyền truy cập đơn hàng này');
    }

    return order;
  }

  /**
   * Cập nhật trạng thái đơn hàng tuân thủ nghiêm ngặt State Machine
   */
  async updateStatus(
    orderId: string,
    toStatus: OrderStatus,
    changedBy: string = 'STAFF',
    note?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng ID: ${orderId}`);
    }

    const currentStatus = order.status;
    if (currentStatus === toStatus) {
      return order;
    }

    const allowedNextStatuses = ALLOWED_STATE_TRANSITIONS[currentStatus] || [];
    if (!allowedNextStatuses.includes(toStatus)) {
      throw new BadRequestException(
        `Chuyển đổi trạng thái không hợp lệ: Không thể chuyển đơn hàng từ "${currentStatus}" sang "${toStatus}". Các bước hợp lệ tiếp theo: [${allowedNextStatuses.join(', ')}]`,
      );
    }

    // Nếu chuyển sang CANCELLED: Kích hoạt Compensation release tồn kho cho từng variant
    if (toStatus === OrderStatus.CANCELLED && order.reservationId) {
      for (const item of order.items) {
        const itemReservationId = `${order.reservationId}-${item.variantId}`;
        await this.releaseInventoryCompensation(
          itemReservationId,
          `Đơn hàng ${order.orderNumber} bị hủy: ${note || 'Hủy đơn'}`,
        );
      }
    }

    // Nếu chuyển sang CONFIRMED: Commit xuất kho vật lý (chuyển từ reserved sang trừ stockQuantity)
    if (toStatus === OrderStatus.CONFIRMED && order.reservationId) {
      for (const item of order.items) {
        const itemReservationId = `${order.reservationId}-${item.variantId}`;
        await this.commitInventory(
          itemReservationId,
          order.orderNumber,
        );
      }
    }

    // Nếu chuyển sang COMPLETED: Đảm bảo commit nếu trước đó chưa commit
    if (toStatus === OrderStatus.COMPLETED && order.reservationId) {
      for (const item of order.items) {
        const itemReservationId = `${order.reservationId}-${item.variantId}`;
        await this.commitInventory(
          itemReservationId,
          order.orderNumber,
        );
      }
    }

    // Cập nhật database với transaction cục bộ
    return this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: toStatus },
        include: {
          items: true,
          shippingAddress: true,
          statusHistory: true,
          payments: true,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: currentStatus,
          toStatus,
          changedBy,
          note: note || `Chuyển trạng thái từ ${currentStatus} sang ${toStatus}`,
        },
      });

      try {
        await tx.auditLog.create({
          data: {
            actorId: changedBy || 'ADMIN',
            actorRole: 'ADMIN',
            action: 'ORDER_STATUS_CHANGE',
            entityType: 'ORDER',
            entityId: orderId,
            oldValue: JSON.stringify({ status: currentStatus }),
            newValue: JSON.stringify({ status: toStatus, note }),
            ipAddress: null,
            requestId: null,
          },
        });
      } catch {
        // Non-blocking audit log
      }

      logger.info(
        `Đơn hàng ${order.orderNumber} đã chuyển trạng thái: ${currentStatus} -> ${toStatus}`,
        { changedBy, note },
      );

      return updatedOrder;
    });
  }

  /**
   * Khách hàng hoặc Admin hủy đơn hàng
   */
  async cancelOrder(
    orderId: string,
    customerId?: string,
    reason: string = 'Khách hàng yêu cầu hủy đơn',
  ) {
    const order = await this.findOrderByIdOrNumber(orderId, customerId);

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException(
        `Không thể hủy đơn hàng ở trạng thái "${order.status}". Vui lòng liên hệ hotline hỗ trợ.`,
      );
    }

    return this.updateStatus(
      order.id,
      OrderStatus.CANCELLED,
      customerId ? 'CUSTOMER' : 'ADMIN',
      reason,
    );
  }

  /**
   * Lấy chi tiết đơn hàng cho quản trị viên (không giới hạn quyền sở hữu customerId)
   */
  async getAdminOrderDetail(idOrNumber: string) {
    return this.findOrderByIdOrNumber(idOrNumber);
  }

  /**
   * Danh sách đơn hàng cho Admin kèm phân trang, tìm kiếm và bộ lọc
   */
  async getAdminOrders(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    startDate?: string;
    endDate?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {};

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { orderNumber: { contains: s } },
        { customerId: { contains: s } },
        { shippingAddress: { recipientName: { contains: s } } },
        { shippingAddress: { phone: { contains: s } } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.paymentStatus) {
      where.paymentStatus = query.paymentStatus;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          shippingAddress: true,
          payments: {
            include: { auditLogs: true },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: items.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerId: o.customerId,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        subtotal: Number(o.subtotal),
        discountAmount: Number(o.discountAmount),
        shippingFee: Number(o.shippingFee),
        totalAmount: Number(o.totalAmount),
        couponCode: o.couponCode,
        itemCount: o.items.length,
        items: o.items,
        shippingAddress: o.shippingAddress,
        payments: o.payments,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Thống kê số liệu thực tế cho Dashboard Quản trị (Không dữ liệu fake)
   * Định nghĩa doanh thu: CHỈ tính các đơn hàng có paymentStatus === 'PAID'
   */
  async getAdminDashboardStats() {
    const now = new Date();
    const vnFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayStr = vnFormatter.format(now); // YYYY-MM-DD
    const startOfDay = new Date(`${todayStr}T00:00:00+07:00`);
    const [yearStr, monthStr] = todayStr.split('-');
    const startOfMonth = new Date(`${yearStr}-${monthStr}-01T00:00:00+07:00`);

    // 1. Số đơn tạo hôm nay
    const ordersToday = await this.prisma.order.count({
      where: { createdAt: { gte: startOfDay } },
    });

    // 2. Đơn chờ xử lý (PENDING)
    const pendingOrders = await this.prisma.order.count({
      where: { status: OrderStatus.PENDING },
    });

    // 3. Doanh thu hôm nay (chỉ tính đơn PAID)
    const paidTodayOrders = await this.prisma.order.findMany({
      where: {
        paymentStatus: PaymentStatus.PAID,
        createdAt: { gte: startOfDay },
      },
      select: { totalAmount: true },
    });
    const revenueToday = paidTodayOrders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0,
    );

    // 4. Doanh thu tháng này (chỉ tính đơn PAID)
    const paidMonthOrders = await this.prisma.order.findMany({
      where: {
        paymentStatus: PaymentStatus.PAID,
        createdAt: { gte: startOfMonth },
      },
      select: { totalAmount: true },
    });
    const revenueMonth = paidMonthOrders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0,
    );

    // 5. Giá trị trung bình đơn hàng (Average Order Value - AOV)
    const averageOrderValue =
      paidMonthOrders.length > 0
        ? Math.round(revenueMonth / paidMonthOrders.length)
        : 0;

    // 6. Đơn hàng mới nhất
    const recentOrdersRaw = await this.prisma.order.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        shippingAddress: true,
        payments: true,
      },
    });
    const recentOrders = recentOrdersRaw.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      totalAmount: Number(o.totalAmount),
      recipientName: o.shippingAddress?.recipientName || 'Khách Hàng',
      phone: o.shippingAddress?.phone || '',
      createdAt: o.createdAt,
    }));

    // 7. Top sản phẩm bán chạy (dựa trên orderItem của các đơn hợp lệ)
    let topProducts: Array<{
      productId: string;
      productName: string;
      totalSold: number;
      totalRevenue: number;
    }> = [];
    try {
      const groupedItems = await this.prisma.orderItem.groupBy({
        by: ['productId', 'productName'],
        where: {
          order: {
            paymentStatus: PaymentStatus.PAID,
          },
        },
        _sum: {
          quantity: true,
          lineTotal: true,
        },
        orderBy: {
          _sum: {
            quantity: 'desc',
          },
        },
        take: 5,
      });

      topProducts = groupedItems.map((g) => ({
        productId: g.productId,
        productName: g.productName,
        totalSold: g._sum.quantity || 0,
        totalRevenue: Number(g._sum.lineTotal || 0),
      }));
    } catch {
      topProducts = [];
    }

    // 8. Tồn kho thấp từ inventory-service
    let lowStock: unknown[] = [];
    try {
      const invRes = await fetch(`${this.inventoryServiceUrl}/api/v1/inventory/low-stock`, {
        headers: {
          'x-internal-secret': this.internalSecret,
        },
      });
      if (invRes.ok) {
        const invJson = (await invRes.json()) as { data?: unknown[] } | unknown[];
        if (Array.isArray(invJson)) {
          lowStock = invJson;
        } else if (invJson && Array.isArray(invJson.data)) {
          lowStock = invJson.data;
        }
      }
    } catch {
      lowStock = [];
    }

    return {
      revenueToday,
      revenueMonth,
      ordersToday,
      pendingOrders,
      averageOrderValue,
      recentOrders,
      topProducts,
      lowStockCount: lowStock.length,
      lowStockItems: lowStock.slice(0, 5),
    };
  }

  /**
   * Tổng hợp lịch sử đơn và chi tiêu của khách hàng
   */
  async getCustomerOrderSummary(customerId: string) {
    const orders = await this.prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: { items: true, payments: true },
    });

    const paidOrders = orders.filter((o) => o.paymentStatus === PaymentStatus.PAID);
    const totalSpend = paidOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

    return {
      orderCount: orders.length,
      paidOrderCount: paidOrders.length,
      totalSpend,
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        totalAmount: Number(o.totalAmount),
        createdAt: o.createdAt,
      })),
    };
  }

  /**
   * Gọi compensation sang inventory-service để giải phóng reservation
   */
  private async releaseInventoryCompensation(
    reservationId: string,
    reason: string,
  ): Promise<void> {
    let success = false;
    try {
      logger.info(`Kích hoạt bù trừ giải phóng kho cho reservationId: ${reservationId}`);
      const res = await fetch(`${this.inventoryServiceUrl}/internal/v1/inventory/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': this.internalSecret,
        },
        body: JSON.stringify({
          reservationId,
          reason,
          allowRollback: true,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        logger.error(`Lỗi bồi hoàn giải phóng kho: ${res.status} - ${text}`);
      } else {
        logger.info(`Đã bồi hoàn giải phóng kho thành công cho reservationId: ${reservationId}`);
        success = true;
      }
    } catch (err) {
      logger.error('Không thể kết nối inventory-service để bồi hoàn:', err);
    }

    if (!success && this.compensationService) {
      try {
        await this.compensationService.createTask(
          CompensationTaskType.RELEASE_INVENTORY,
          {
            reservationId,
            reason,
            requestId: `cancel-${crypto.randomUUID().slice(0, 8)}`,
          },
        );
      } catch (taskErr) {
        logger.error('Không thể tạo CompensationTask khi bồi hoàn thất bại:', taskErr);
      }
    }
  }

  /**
   * Gọi commit sang inventory-service để xuất kho vật lý khi hoàn tất đơn hàng
   */
  private async commitInventory(
    reservationId: string,
    orderNumber: string,
  ): Promise<void> {
    try {
      logger.info(`Kích hoạt xuất kho vật lý cho reservationId: ${reservationId}`);
      const res = await fetch(`${this.inventoryServiceUrl}/internal/v1/inventory/commit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': this.internalSecret,
        },
        body: JSON.stringify({
          reservationId,
          referenceId: orderNumber,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        logger.error(`Lỗi xuất kho: ${res.status} - ${text}`);
      } else {
        logger.info(`Đã xuất kho thành công cho reservationId: ${reservationId}`);
      }
    } catch (err) {
      logger.error('Không thể kết nối inventory-service để xuất kho:', err);
    }
  }

  /**
   * [Internal Service-to-Service] Xác thực khách hàng đã mua sản phẩm trong đơn hoàn thành (COMPLETED)
   */
  async verifyCustomerPurchase(query: {
    customerId: string;
    productId: string;
    orderItemId?: string;
  }): Promise<{ verifiedPurchase: boolean; orderItemId?: string; orderNumber?: string }> {
    const { customerId, productId, orderItemId } = query;
    if (!customerId || !productId) {
      return { verifiedPurchase: false };
    }

    const whereItem: Prisma.OrderItemWhereInput = {
      productId,
      order: {
        customerId,
        status: OrderStatus.COMPLETED,
      },
    };

    if (orderItemId) {
      whereItem.id = orderItemId;
    }

    const item = await this.prisma.orderItem.findFirst({
      where: whereItem,
      include: {
        order: {
          select: { orderNumber: true },
        },
      },
      orderBy: { id: 'desc' },
    });

    if (!item) {
      return { verifiedPurchase: false };
    }

    return {
      verifiedPurchase: true,
      orderItemId: item.id,
      orderNumber: item.order.orderNumber,
    };
  }
}

