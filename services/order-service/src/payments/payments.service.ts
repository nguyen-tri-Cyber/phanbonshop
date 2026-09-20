import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CodPaymentProvider } from './providers/cod-payment.provider.js';
import { BankTransferPaymentProvider } from './providers/bank-transfer-payment.provider.js';
import {
  PaymentProvider,
  PaymentInitParams,
  PaymentCreationResult,
  PaymentWebhookResult,
} from './providers/payment-provider.interface.js';
import { ConfirmPaymentDto } from './dto/payment.dto.js';
import {
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionStatus,
  OrderStatus,
  Prisma,
  PaymentRecord,
  PaymentTransaction,
  CompensationTaskType,
} from '../../generated/client/index.js';
import { PaymentStateMachine } from './payment-state-machine.js';
import { CompensationService } from '../compensation/compensation.service.js';
import { createLogger } from '@phanbonshop/logger';

const logger = createLogger('order-service:payments');

export interface CreatedPaymentResult {
  paymentRecord: PaymentRecord;
  paymentTransaction?: PaymentTransaction;
  paymentDetails?: Record<string, unknown>;
  instruction?: string;
  qrCodeUrl?: string;
}

const ALLOWED_CONFIRM_ROLES = new Set(['ADMIN', 'MANAGER', 'STAFF', 'SUPER_ADMIN']);

@Injectable()
export class PaymentsService {
  private readonly inventoryServiceUrl =
    process.env.INVENTORY_SERVICE_URL || 'http://localhost:3004';
  private readonly internalSecret =
    process.env.INTERNAL_SERVICE_SECRET || 'phanbon_internal_secret';

  constructor(
    private readonly prisma: PrismaService,
    private readonly codProvider: CodPaymentProvider,
    private readonly bankTransferProvider: BankTransferPaymentProvider,
    private readonly compensationService: CompensationService,
  ) {}

  /**
   * Lấy cấu hình tài khoản ngân hàng thụ hưởng (VietQR)
   */
  getBankTransferSettings() {
    return this.bankTransferProvider.getConfig();
  }

  /**
   * Tìm Provider tương ứng với PaymentMethod
   */
  getProvider(method: PaymentMethod): PaymentProvider {
    switch (method) {
      case PaymentMethod.BANK_TRANSFER:
        return this.bankTransferProvider;
      case PaymentMethod.COD:
      default:
        return this.codProvider;
    }
  }

  /**
   * Khởi tạo bản ghi thanh toán và giao dịch đầu tiên qua Provider
   */
  async createPaymentRecord(
    params: PaymentInitParams,
    method: PaymentMethod,
    tx?: Prisma.TransactionClient,
  ): Promise<CreatedPaymentResult> {
    const provider = this.getProvider(method);
    const initResult: PaymentCreationResult = await provider.createPayment(params);

    const client = tx || this.prisma;
    const paymentRecord = await client.paymentRecord.create({
      data: {
        orderId: params.orderId,
        provider: initResult.provider,
        method: initResult.method,
        amount: params.amount,
        status: initResult.status,
        transactionReference: initResult.transactionReference,
        metadata: initResult.paymentDetails
          ? JSON.stringify(initResult.paymentDetails)
          : null,
      },
    });

    // Tạo bản ghi PaymentTransaction đầu tiên (Attempt 1)
    const paymentTransaction = await client.paymentTransaction.create({
      data: {
        orderId: params.orderId,
        paymentRecordId: paymentRecord.id,
        provider: initResult.provider,
        method: initResult.method,
        amount: params.amount,
        status: PaymentTransactionStatus.PENDING,
        transactionId: initResult.transactionReference,
        rawRequest: JSON.stringify(params),
        rawResponse: initResult.paymentDetails
          ? JSON.stringify(initResult.paymentDetails)
          : null,
        expiredAt: initResult.expiresAt || null,
      },
    });

    logger.info(
      `Đã khởi tạo bản ghi thanh toán ${paymentRecord.id} và giao dịch ${paymentTransaction.id} cho đơn ${params.orderNumber} (Phương thức: ${method}, Trạng thái: ${paymentRecord.status})`,
    );

    return {
      paymentRecord,
      paymentTransaction,
      paymentDetails: initResult.paymentDetails,
      instruction: initResult.instruction,
      qrCodeUrl: initResult.qrCodeUrl,
    };
  }

  /**
   * Tạo lần thử thanh toán mới cho đơn hàng (Multiple Payment Attempts)
   * Khi lần thanh toán trước thất bại hoặc hết hạn, khách hàng có thể đổi phương thức và thử lại
   */
  async createPaymentAttempt(
    orderId: string,
    method: PaymentMethod,
    customerId: string,
  ): Promise<CreatedPaymentResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng ID: ${orderId}`);
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên đơn hàng này');
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Đơn hàng đã được thanh toán thành công, không thể tạo phiên thanh toán mới');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Đơn hàng đã bị hủy, không thể tiếp tục thanh toán');
    }

    const provider = this.getProvider(method);
    const initResult = await provider.createPayment({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: Number(order.totalAmount),
      customerId: order.customerId,
    });

    return this.prisma.$transaction(async (tx) => {
      // Tìm hoặc cập nhật PaymentRecord
      let paymentRecord = order.payments?.[0];
      if (paymentRecord) {
        paymentRecord = await tx.paymentRecord.update({
          where: { id: paymentRecord.id },
          data: {
            method: initResult.method,
            provider: initResult.provider,
            status: PaymentStatus.PENDING,
            transactionReference: initResult.transactionReference,
            metadata: initResult.paymentDetails
              ? JSON.stringify(initResult.paymentDetails)
              : null,
          },
        });
      } else {
        paymentRecord = await tx.paymentRecord.create({
          data: {
            orderId: order.id,
            provider: initResult.provider,
            method: initResult.method,
            amount: order.totalAmount,
            status: PaymentStatus.PENDING,
            transactionReference: initResult.transactionReference,
            metadata: initResult.paymentDetails
              ? JSON.stringify(initResult.paymentDetails)
              : null,
          },
        });
      }

      // Tạo bản ghi PaymentTransaction mới cho lần thử này
      const paymentTransaction = await tx.paymentTransaction.create({
        data: {
          orderId: order.id,
          paymentRecordId: paymentRecord.id,
          provider: initResult.provider,
          method: initResult.method,
          amount: order.totalAmount,
          status: PaymentTransactionStatus.PENDING,
          transactionId: initResult.transactionReference,
          rawRequest: JSON.stringify({ orderId, method, customerId }),
          rawResponse: initResult.paymentDetails
            ? JSON.stringify(initResult.paymentDetails)
            : null,
          expiredAt: initResult.expiresAt || null,
        },
      });

      // Cập nhật lại phương thức thanh toán mới trên Order
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentMethod: method,
          paymentStatus: PaymentStatus.PENDING,
        },
      });

      logger.info(
        `Khách hàng ${customerId} đã tạo lần thử thanh toán mới (Tx: ${paymentTransaction.id}) cho đơn ${order.orderNumber} qua ${method}`,
      );

      return {
        paymentRecord,
        paymentTransaction,
        paymentDetails: initResult.paymentDetails,
        instruction: initResult.instruction,
        qrCodeUrl: initResult.qrCodeUrl,
      };
    });
  }

  /**
   * Lấy bản ghi thanh toán của một đơn hàng
   */
  async getPaymentByOrderId(orderId: string) {
    return this.prisma.paymentRecord.findFirst({
      where: { orderId },
      include: {
        auditLogs: {
          orderBy: { createdAt: 'desc' },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * Lấy chi tiết bản ghi thanh toán theo ID
   */
  async getPaymentById(paymentId: string) {
    const payment = await this.prisma.paymentRecord.findUnique({
      where: { id: paymentId },
      include: {
        order: true,
        auditLogs: {
          orderBy: { createdAt: 'desc' },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Không tìm thấy giao dịch thanh toán ID: ${paymentId}`);
    }

    return payment;
  }

  /**
   * Lấy toàn bộ lịch sử các lần thử thanh toán của một đơn hàng
   */
  async getOrderTransactions(orderId: string): Promise<PaymentTransaction[]> {
    return this.prisma.paymentTransaction.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Admin xác nhận thanh toán thủ công (Role Guard + Idempotent + State Machine + Commit Inventory)
   */
  async confirmPayment(
    paymentId: string,
    actorId: string,
    actorRole: string,
    dto: ConfirmPaymentDto = {},
  ) {
    // 1. Role Guard: Khách hàng không được phép xác nhận
    if (!ALLOWED_CONFIRM_ROLES.has(actorRole)) {
      throw new ForbiddenException(
        'Bạn không có quyền xác nhận thanh toán cho đơn hàng này (Yêu cầu vai trò ADMIN, MANAGER hoặc STAFF)',
      );
    }

    const payment = await this.getPaymentById(paymentId);
    const order = payment.order;

    // 2. Idempotency Check: Nếu đã thanh toán rồi thì trả về kết quả cũ
    if (payment.status === PaymentStatus.PAID) {
      logger.info(
        `[Idempotent] Giao dịch thanh toán ${paymentId} đã được xác nhận PAID trước đó`,
        { actorId },
      );
      return {
        success: true,
        message: 'Thanh toán đã được xác nhận trước đó (Idempotent)',
        payment,
        order,
      };
    }

    // 3. State Machine Validation: Xác thực chuyển đổi trạng thái
    PaymentStateMachine.assertTransition(payment.status, PaymentStatus.PAID);

    // 4. Amount Validation: Không cho xác nhận số tiền khác tổng đơn
    const expectedAmount = Number(payment.amount);
    if (dto.amount !== undefined && dto.amount !== expectedAmount) {
      throw new BadRequestException(
        `Số tiền xác nhận (${dto.amount}đ) không khớp với tổng tiền đơn hàng (${expectedAmount}đ). Không thể xác nhận thanh toán lệch số tiền.`,
      );
    }

    // 5. Cập nhật trạng thái trong Transaction
    const transactionResult = await this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.paymentRecord.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.PAID,
          paidAt: new Date(),
          transactionReference:
            dto.transactionReference || payment.transactionReference,
        },
      });

      // Cập nhật hoặc tạo mới PaymentTransaction sang SUCCESS
      await tx.paymentTransaction.create({
        data: {
          orderId: order.id,
          paymentRecordId: paymentId,
          provider: payment.provider,
          method: payment.method,
          amount: payment.amount,
          status: PaymentTransactionStatus.SUCCESS,
          transactionId: dto.transactionReference || payment.transactionReference,
          rawRequest: JSON.stringify(dto),
          rawResponse: JSON.stringify({ actorId, actorRole, confirmedAt: new Date() }),
          paidAt: new Date(),
        },
      });

      // Tạo Audit Log cho thao tác xác nhận
      await tx.paymentAuditLog.create({
        data: {
          paymentId,
          action: 'CONFIRM_PAID',
          actorId,
          actorRole,
          amount: payment.amount,
          note:
            dto.note ||
            `Xác nhận thanh toán thành công bởi ${actorRole} (${actorId})`,
        },
      });

      try {
        await tx.auditLog.create({
          data: {
            actorId,
            actorRole,
            action: 'PAYMENT_CONFIRM',
            entityType: 'PAYMENT',
            entityId: paymentId,
            oldValue: JSON.stringify({ status: payment.status }),
            newValue: JSON.stringify({ status: PaymentStatus.PAID, amount: expectedAmount, note: dto.note }),
            ipAddress: null,
            requestId: null,
          },
        });
      } catch {
        // Non-blocking audit log
      }

      // Cập nhật Order paymentStatus sang PAID
      let nextOrderStatus = order.status;
      if (order.status === OrderStatus.PENDING) {
        nextOrderStatus = OrderStatus.CONFIRMED;
      }

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: PaymentStatus.PAID,
          status: nextOrderStatus,
        },
      });

      // Ghi lịch sử đơn hàng
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: nextOrderStatus,
          changedBy: actorId,
          note: `Thanh toán thành công qua ${payment.method}. Cập nhật paymentStatus: PAID.`,
        },
      });

      logger.info(
        `Admin ${actorId} (${actorRole}) đã xác nhận thanh toán thành công cho đơn ${order.orderNumber} (Số tiền: ${expectedAmount}đ)`,
      );

      return { updatedPayment, updatedOrder };
    });

    // 6. Cam kết xuất kho vật lý (Commit Inventory) để tránh bị Expiry Worker dọn dẹp nhầm
    await this.commitOrderInventory(order.id, order.orderNumber);

    return {
      success: true,
      message: 'Xác nhận thanh toán thành công',
      payment: transactionResult.updatedPayment,
      order: transactionResult.updatedOrder,
    };
  }

  /**
   * Tiếp nhận và xử lý Webhook / IPN thanh toán tự động (Idempotent + State Machine)
   */
  async handlePaymentWebhook(
    providerName: string,
    headers: Record<string, string>,
    body: unknown,
  ): Promise<{ success: boolean; message: string; transactionId?: string }> {
    let provider: PaymentProvider;
    const normalizedProvider = providerName.toUpperCase();

    if (normalizedProvider.includes('VIETQR') || normalizedProvider.includes('BANK')) {
      provider = this.bankTransferProvider;
    } else if (normalizedProvider.includes('COD')) {
      provider = this.codProvider;
    } else {
      throw new BadRequestException(`Cổng thanh toán "${providerName}" chưa được hỗ trợ`);
    }

    // 1. Xác thực Webhook qua Provider
    const webhookResult: PaymentWebhookResult = await provider.verifyWebhook(headers, body);

    if (!webhookResult.isValid) {
      logger.warn(`Webhook không hợp lệ từ cổng ${providerName}`, {
        error: webhookResult.errorMessage,
      });
      return {
        success: false,
        message: webhookResult.errorMessage || 'Webhook verification failed',
      };
    }

    // 2. Tìm đơn hàng liên kết
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { orderNumber: webhookResult.orderNumber },
          { id: webhookResult.orderId },
        ],
      },
      include: { payments: true },
    });

    if (!order) {
      logger.error(`Webhook nhận được mã đơn không tồn tại: ${webhookResult.orderNumber}`);
      return {
        success: false,
        message: `Không tìm thấy đơn hàng tương ứng với webhook: ${webhookResult.orderNumber}`,
      };
    }

    // 3. Idempotency Check: Nếu đơn đã PAID trước đó, trả về thành công không chạy lại side-effect
    if (order.paymentStatus === PaymentStatus.PAID) {
      logger.info(
        `[Idempotent] Đơn hàng ${order.orderNumber} đã thanh toán PAID trước đó. Bỏ qua webhook trùng lặp.`,
        { transactionId: webhookResult.transactionId },
      );
      return {
        success: true,
        message: 'Đơn hàng đã được thanh toán trước đó (Idempotent webhook)',
        transactionId: webhookResult.transactionId,
      };
    }

    // 4. Xử lý theo kết quả xác thực
    if (webhookResult.isPaid) {
      await this.prisma.$transaction(async (tx) => {
        // Cập nhật PaymentRecord
        const paymentRecord = order.payments?.[0];
        if (paymentRecord) {
          await tx.paymentRecord.update({
            where: { id: paymentRecord.id },
            data: {
              status: PaymentStatus.PAID,
              paidAt: webhookResult.paidAt || new Date(),
              transactionReference:
                webhookResult.transactionId || webhookResult.transactionReference,
            },
          });
        }

        // Tạo bản ghi PaymentTransaction SUCCESS
        await tx.paymentTransaction.create({
          data: {
            orderId: order.id,
            paymentRecordId: paymentRecord?.id,
            provider: provider.providerName,
            method: provider.supportedMethod,
            amount: webhookResult.amount || order.totalAmount,
            status: PaymentTransactionStatus.SUCCESS,
            transactionId: webhookResult.transactionId,
            rawRequest: JSON.stringify({ headers, body }),
            rawResponse: JSON.stringify(webhookResult.rawResponse || {}),
            paidAt: webhookResult.paidAt || new Date(),
          },
        });

        // Cập nhật đơn hàng sang CONFIRMED và PAID
        const nextStatus =
          order.status === OrderStatus.PENDING ? OrderStatus.CONFIRMED : order.status;

        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: PaymentStatus.PAID,
            status: nextStatus,
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: nextStatus,
            changedBy: `WEBHOOK:${provider.providerName}`,
            note: `Tự động xác nhận thanh toán qua Webhook ${provider.providerName} (Tx: ${webhookResult.transactionId})`,
          },
        });
      });

      // Cam kết xuất kho vật lý (Commit Inventory)
      await this.commitOrderInventory(order.id, order.orderNumber);

      logger.info(
        `Webhook thành công: Đơn hàng ${order.orderNumber} đã thanh toán thành công (Tx: ${webhookResult.transactionId})`,
      );

      return {
        success: true,
        message: 'Xử lý thanh toán webhook thành công',
        transactionId: webhookResult.transactionId,
      };
    }

    if (webhookResult.isFailed || webhookResult.isExpired) {
      const targetStatus = webhookResult.isExpired
        ? PaymentTransactionStatus.EXPIRED
        : PaymentTransactionStatus.FAILED;

      await this.prisma.paymentTransaction.create({
        data: {
          orderId: order.id,
          provider: provider.providerName,
          method: provider.supportedMethod,
          amount: webhookResult.amount || order.totalAmount,
          status: targetStatus,
          transactionId: webhookResult.transactionId,
          errorMessage: webhookResult.errorMessage,
          rawRequest: JSON.stringify({ headers, body }),
          rawResponse: JSON.stringify(webhookResult.rawResponse || {}),
        },
      });

      if (webhookResult.isExpired) {
        // Hết hạn thanh toán: Giải phóng reservation kho
        await this.releaseOrderInventory(order.id, 'Hết hạn thời gian thanh toán');
      }

      return {
        success: true,
        message: `Ghi nhận trạng thái ${targetStatus} từ Webhook`,
        transactionId: webhookResult.transactionId,
      };
    }

    return {
      success: true,
      message: 'Ghi nhận Webhook thành công',
    };
  }

  /**
   * Gọi commit sang inventory-service để xuất kho vật lý khi thanh toán thành công
   */
  async commitOrderInventory(orderId: string, orderNumber: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order || !order.reservationId) {
      return;
    }

    for (const item of order.items) {
      const itemReservationId = `${order.reservationId}-${item.variantId}`;
      try {
        logger.info(`Kích hoạt commit tồn kho cho reservationId: ${itemReservationId}`);
        const res = await fetch(`${this.inventoryServiceUrl}/internal/v1/inventory/commit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Secret': this.internalSecret,
          },
          body: JSON.stringify({
            reservationId: itemReservationId,
            referenceId: orderNumber,
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          logger.error(`Lỗi commit tồn kho: ${res.status} - ${text}`);
        } else {
          logger.info(`Đã commit tồn kho thành công cho reservationId: ${itemReservationId}`);
        }
      } catch (err) {
        logger.error('Không thể kết nối inventory-service để commit tồn kho:', err);
      }
    }
  }

  /**
   * Gọi release bồi hoàn sang inventory-service khi thanh toán thất bại hoặc hết hạn
   */
  async releaseOrderInventory(orderId: string, reason: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order || !order.reservationId) {
      return;
    }

    for (const item of order.items) {
      const itemReservationId = `${order.reservationId}-${item.variantId}`;
      let success = false;
      try {
        logger.info(`Kích hoạt bồi hoàn giải phóng kho cho reservationId: ${itemReservationId}`);
        const res = await fetch(`${this.inventoryServiceUrl}/internal/v1/inventory/release`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Secret': this.internalSecret,
          },
          body: JSON.stringify({
            reservationId: itemReservationId,
            reason,
            allowRollback: true,
          }),
        });

        if (res.ok) {
          success = true;
          logger.info(`Đã giải phóng kho thành công cho reservationId: ${itemReservationId}`);
        } else {
          const text = await res.text();
          logger.error(`Lỗi giải phóng kho: ${res.status} - ${text}`);
        }
      } catch (err) {
        logger.error('Không thể kết nối inventory-service để giải phóng kho:', err);
      }

      if (!success && this.compensationService) {
        try {
          await this.compensationService.createTask(
            CompensationTaskType.RELEASE_INVENTORY,
            {
              reservationId: itemReservationId,
              reason,
              requestId: `pay-fail-${crypto.randomUUID().slice(0, 8)}`,
            },
          );
        } catch (taskErr) {
          logger.error('Không thể tạo CompensationTask khi giải phóng kho thất bại:', taskErr);
        }
      }
    }
  }
}
