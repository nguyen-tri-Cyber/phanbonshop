import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CodPaymentProvider } from './providers/cod-payment.provider.js';
import { BankTransferPaymentProvider } from './providers/bank-transfer-payment.provider.js';
import { PaymentInitParams } from './providers/payment-provider.interface.js';
import { ConfirmPaymentDto } from './dto/payment.dto.js';
import { PaymentMethod, PaymentStatus, OrderStatus, Prisma, PaymentRecord } from '../../generated/client/index.js';
import { createLogger } from '@phanbonshop/logger';

const logger = createLogger('order-service:payments');

export interface CreatedPaymentResult {
  paymentRecord: PaymentRecord;
  paymentDetails?: Record<string, unknown>;
  instruction?: string;
}

const ALLOWED_CONFIRM_ROLES = new Set(['ADMIN', 'MANAGER', 'STAFF', 'SUPER_ADMIN']);

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codProvider: CodPaymentProvider,
    private readonly bankTransferProvider: BankTransferPaymentProvider,
  ) {}

  /**
   * Lấy cấu hình tài khoản ngân hàng thụ hưởng (VietQR)
   */
  getBankTransferSettings() {
    return this.bankTransferProvider.getConfig();
  }

  /**
   * Khởi tạo bản ghi thanh toán theo phương thức đã chọn qua Provider
   */
  async createPaymentRecord(
    params: PaymentInitParams,
    method: PaymentMethod,
    tx?: Prisma.TransactionClient,
  ): Promise<CreatedPaymentResult> {
    let initResult;

    switch (method) {
      case PaymentMethod.BANK_TRANSFER:
        initResult = await this.bankTransferProvider.initialize(params);
        break;
      case PaymentMethod.COD:
      default:
        initResult = await this.codProvider.initialize(params);
        break;
    }

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

    logger.info(
      `Đã khởi tạo bản ghi thanh toán ${paymentRecord.id} cho đơn ${params.orderNumber} (Phương thức: ${method}, Trạng thái: ${paymentRecord.status})`,
    );

    return {
      paymentRecord,
      paymentDetails: initResult.paymentDetails,
      instruction: initResult.instruction,
    };
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
      },
    });

    if (!payment) {
      throw new NotFoundException(`Không tìm thấy giao dịch thanh toán ID: ${paymentId}`);
    }

    return payment;
  }

  /**
   * Admin xác nhận thanh toán thủ công (Role Guard + Idempotent + Audit Log)
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

    // 2. Idempotency Check: Nếu đã thanh toán rồi thì trả về kết quả cũ, không tạo duplicate audit
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

    // 3. Amount Validation: Không cho xác nhận số tiền khác tổng đơn
    const expectedAmount = Number(payment.amount);
    if (dto.amount !== undefined && dto.amount !== expectedAmount) {
      throw new BadRequestException(
        `Số tiền xác nhận (${dto.amount}đ) không khớp với tổng tiền đơn hàng (${expectedAmount}đ). Không thể xác nhận thanh toán lệch số tiền.`,
      );
    }

    // 4. Cập nhật trạng thái trong Transaction
    return this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.paymentRecord.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.PAID,
          paidAt: new Date(),
          transactionReference:
            dto.transactionReference || payment.transactionReference,
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

      return {
        success: true,
        message: 'Xác nhận thanh toán thành công',
        payment: updatedPayment,
        order: updatedOrder,
      };
    });
  }
}
