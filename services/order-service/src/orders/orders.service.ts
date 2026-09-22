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
  PaymentMethod,
  PaymentTransactionStatus,
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
  [OrderStatus.RETURNED]: [OrderStatus.REFUNDED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [OrderStatus.REFUNDED],
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

  async getInventoryDisposition(orderNumber: string): Promise<{
    orderId: string;
    orderNumber: string;
    disposition: 'COMMIT' | 'RELEASE' | 'HOLD';
  }> {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      select: { id: true, orderNumber: true, status: true, paymentStatus: true },
    });
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng: ${orderNumber}`);
    }

    let disposition: 'COMMIT' | 'RELEASE' | 'HOLD' = 'HOLD';
    if (order.paymentStatus === PaymentStatus.PAID) {
      disposition = 'COMMIT';
    } else if (
      order.status === OrderStatus.CANCELLED ||
      new Set<PaymentStatus>([
        PaymentStatus.FAILED,
        PaymentStatus.CANCELLED,
        PaymentStatus.EXPIRED,
        PaymentStatus.REFUNDED,
      ]).has(order.paymentStatus)
    ) {
      disposition = 'RELEASE';
    }

    return { orderId: order.id, orderNumber: order.orderNumber, disposition };
  }

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

    // Kiểm tra điều kiện hoàn tiền: Chỉ cho phép khi đơn hàng đã thanh toán
    if (toStatus === OrderStatus.REFUNDED) {
      if (
        order.paymentStatus !== PaymentStatus.PAID &&
        order.paymentStatus !== PaymentStatus.PARTIALLY_REFUNDED
      ) {
        throw new BadRequestException(
          `Chỉ có thể hoàn tiền cho đơn hàng đã thanh toán thành công (trạng thái thanh toán hiện tại là "${order.paymentStatus}"). Đối với đơn chưa thanh toán, vui lòng chọn Hủy đơn hàng.`,
        );
      }
    }

    // Kiểm tra điều kiện hoàn thành: Đơn không phải COD bắt buộc phải thanh toán thành công trước khi hoàn tất
    if (toStatus === OrderStatus.COMPLETED) {
      if (
        order.paymentMethod !== PaymentMethod.COD &&
        order.paymentStatus !== PaymentStatus.PAID
      ) {
        throw new BadRequestException(
          `Không thể hoàn tất đơn hàng thanh toán qua "${order.paymentMethod}" khi chưa thanh toán thành công (paymentStatus must be PAID).`,
        );
      }
    }

    // Nếu chuyển sang CANCELLED hoặc RETURNED: Kích hoạt hoàn trả tồn kho cho từng variant
    if ((toStatus === OrderStatus.CANCELLED || toStatus === OrderStatus.RETURNED) && order.reservationId) {
      for (const item of order.items) {
        const itemReservationId = `${order.reservationId}-${item.variantId}`;
        const reason = toStatus === OrderStatus.RETURNED
          ? `Khách trả hàng đơn ${order.orderNumber}: ${note || 'Hoàn trả nhập lại kho'}`
          : `Đơn hàng ${order.orderNumber} bị hủy: ${note || 'Hủy đơn'}`;
        await this.releaseInventoryCompensation(
          itemReservationId,
          reason,
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
      const isCancelled = toStatus === OrderStatus.CANCELLED;
      const isRefunded = toStatus === OrderStatus.REFUNDED;
      const isCompleted = toStatus === OrderStatus.COMPLETED;
      const shouldCancelPayment =
        isCancelled &&
        order.paymentStatus !== PaymentStatus.PAID &&
        order.paymentStatus !== PaymentStatus.REFUNDED;
      const shouldRefundPayment = isRefunded;
      const shouldMarkCodPaid =
        isCompleted &&
        order.paymentMethod === PaymentMethod.COD &&
        order.paymentStatus !== PaymentStatus.PAID;

      if (isCancelled) {
        await tx.paymentRecord.updateMany({
          where: {
            orderId,
            status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
          },
          data: {
            status: PaymentStatus.CANCELLED,
          },
        });

        await tx.paymentTransaction.updateMany({
          where: {
            orderId,
            status: 'PENDING',
          },
          data: {
            status: 'FAILED',
          },
        });
      }

      if (isRefunded) {
        const paidPayments = await tx.paymentRecord.findMany({
          where: {
            orderId,
            status: { in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED] },
          },
        });

        await tx.paymentRecord.updateMany({
          where: {
            orderId,
            status: { in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED] },
          },
          data: {
            status: PaymentStatus.REFUNDED,
          },
        });

        for (const p of paidPayments) {
          await tx.paymentAuditLog.create({
            data: {
              paymentId: p.id,
              action: 'REFUND',
              actorId: changedBy || 'ADMIN',
              actorRole: 'ADMIN',
              amount: p.amount,
              note: note || `Hoàn tiền toàn phần cho đơn hàng ${order.orderNumber}`,
            },
          });
        }
      }

      // Tự động xác nhận thanh toán cho đơn COD khi hoàn tất giao hàng (COMPLETED)
      if (shouldMarkCodPaid) {
        const pendingPaymentRecord = await tx.paymentRecord.findFirst({
          where: {
            orderId,
            status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
          },
        });

        await tx.paymentRecord.updateMany({
          where: {
            orderId,
            status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
          },
          data: {
            status: PaymentStatus.PAID,
            paidAt: new Date(),
          },
        });

        await tx.paymentTransaction.create({
          data: {
            orderId,
            paymentRecordId: pendingPaymentRecord?.id || null,
            provider: 'COD',
            method: PaymentMethod.COD,
            amount: order.totalAmount,
            status: PaymentTransactionStatus.SUCCESS,
            transactionId: `COD-${order.orderNumber}`,
            paidAt: new Date(),
          },
        });

        if (pendingPaymentRecord) {
          await tx.paymentAuditLog.create({
            data: {
              paymentId: pendingPaymentRecord.id,
              action: 'PAID',
              actorId: changedBy || 'SYSTEM',
              actorRole:
                changedBy === 'STAFF' || changedBy === 'ADMIN' ? changedBy : 'SYSTEM',
              amount: order.totalAmount,
              note:
                note ||
                `Tự động xác nhận thu tiền COD khi hoàn tất đơn hàng ${order.orderNumber}`,
            },
          });
        }

        logger.info(
          `Đã tự động xác nhận thu tiền COD cho đơn hàng ${order.orderNumber} khi chuyển trạng thái sang COMPLETED`,
        );
      }

      // Hoàn trả lượt sử dụng Coupon nếu đơn hàng có áp dụng mã khuyến mãi (khi Hủy hoặc Hoàn tiền)
      if (isCancelled || isRefunded) {
        const couponUsages = await tx.couponUsage.findMany({
          where: { orderId },
        });

        for (const usage of couponUsages) {
          await tx.couponUsage.delete({
            where: { id: usage.id },
          });

          await tx.coupon.updateMany({
            where: { id: usage.couponId, usedCount: { gt: 0 } },
            data: { usedCount: { decrement: 1 } },
          });

          logger.info(
            `Đã hoàn trả lượt sử dụng coupon ${usage.couponId} cho khách hàng ${usage.customerId} sau khi ${isCancelled ? 'hủy' : 'hoàn tiền'} đơn hàng ${order.orderNumber}`,
          );
        }
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: toStatus,
          ...(shouldCancelPayment ? { paymentStatus: PaymentStatus.CANCELLED } : {}),
          ...(shouldRefundPayment ? { paymentStatus: PaymentStatus.REFUNDED } : {}),
          ...(shouldMarkCodPaid ? { paymentStatus: PaymentStatus.PAID } : {}),
        },
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
            oldValue: JSON.stringify({ status: currentStatus, paymentStatus: order.paymentStatus }),
            newValue: JSON.stringify({
              status: toStatus,
              paymentStatus: shouldRefundPayment
                ? PaymentStatus.REFUNDED
                : shouldCancelPayment
                ? PaymentStatus.CANCELLED
                : shouldMarkCodPaid
                ? PaymentStatus.PAID
                : order.paymentStatus,
              note,
            }),
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

    // Chặn khách hàng tự hủy đơn hàng đã thanh toán thành công
    if (customerId && order.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException(
        'Đơn hàng đã được thanh toán thành công. Quý khách vui lòng liên hệ hotline hỗ trợ để được tiếp nhận yêu cầu hủy và xử lý hoàn tiền.',
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
    let success = false;
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
        success = true;
      }
    } catch (err) {
      logger.error('Không thể kết nối inventory-service để xuất kho:', err);
    }

    if (!success && this.compensationService) {
      try {
        await this.compensationService.createTask(
          CompensationTaskType.COMMIT_INVENTORY,
          {
            reservationId,
            referenceId: orderNumber,
            requestId: `commit-${crypto.randomUUID().slice(0, 8)}`,
          },
          { maxRetries: 60 },
        );
        logger.warn(
          `Đã tạo CompensationTask (COMMIT_INVENTORY) để retry xuất kho cho reservationId: ${reservationId}`,
        );
      } catch (taskErr) {
        logger.error('Không thể tạo CompensationTask khi commit kho thất bại:', taskErr);
      }
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
