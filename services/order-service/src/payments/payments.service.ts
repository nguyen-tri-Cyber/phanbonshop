import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CodPaymentProvider } from './providers/cod-payment.provider.js';
import { BankTransferPaymentProvider } from './providers/bank-transfer-payment.provider.js';
import { MomoPaymentProvider } from './providers/momo-payment.provider.js';
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
import { getEnvString } from '@phanbonshop/config';

const logger = createLogger('order-service:payments');

export interface CreatedPaymentResult {
  paymentRecord: PaymentRecord;
  paymentTransaction?: PaymentTransaction;
  paymentDetails?: Record<string, unknown>;
  instruction?: string;
  qrCodeUrl?: string;
  payUrl?: string;
}

export interface PaymentActor {
  userId: string;
  role: string;
}

const ALLOWED_CONFIRM_ROLES = new Set(['ADMIN', 'MANAGER', 'STAFF', 'SUPER_ADMIN']);
const PRIVILEGED_PAYMENT_ROLES = ALLOWED_CONFIRM_ROLES;

@Injectable()
export class PaymentsService {
  private readonly inventoryServiceUrl =
    process.env.INVENTORY_SERVICE_URL || 'http://localhost:3004';
  private readonly internalSecret = getEnvString('INTERNAL_SERVICE_SECRET');

  constructor(
    private readonly prisma: PrismaService,
    private readonly codProvider: CodPaymentProvider,
    private readonly bankTransferProvider: BankTransferPaymentProvider,
    private readonly momoProvider: MomoPaymentProvider,
    private readonly compensationService: CompensationService,
  ) {}

  /**
   * Lấy cấu hình tài khoản ngân hàng thụ hưởng (VietQR)
   */
  getBankTransferSettings() {
    return this.bankTransferProvider.getConfig();
  }

  /**
   * Lấy cấu hình cổng MoMo Sandbox
   */
  getMomoSettings() {
    return this.momoProvider.getPublicConfig();
  }

  private assertOrderAccess(
    order: { customerId: string },
    actor: PaymentActor,
  ): void {
    if (
      !PRIVILEGED_PAYMENT_ROLES.has(actor.role) &&
      order.customerId !== actor.userId
    ) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên đơn hàng này');
    }
  }

  /**
   * Tìm Provider tương ứng với PaymentMethod
   */
  getProvider(method: PaymentMethod): PaymentProvider {
    switch (method) {
      case PaymentMethod.MOMO:
        return this.momoProvider;
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
        providerOrderId: initResult.providerOrderId,
        providerRequestId: initResult.providerRequestId,
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
      payUrl: initResult.payUrl,
    };
  }

  /**
   * Tạo lần thử thanh toán mới cho đơn hàng (Multiple Payment Attempts)
   * Khi lần thanh toán trước thất bại hoặc hết hạn, khách hàng có thể đổi phương thức và thử lại
   */
  async createPaymentAttempt(
    orderId: string,
    method: PaymentMethod,
    actor: PaymentActor,
  ): Promise<CreatedPaymentResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng ID: ${orderId}`);
    }

    this.assertOrderAccess(order, actor);

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
          providerOrderId: initResult.providerOrderId,
          providerRequestId: initResult.providerRequestId,
          rawRequest: JSON.stringify({ orderId, method, actorId: actor.userId }),
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
        `Actor ${actor.userId} đã tạo lần thử thanh toán mới (Tx: ${paymentTransaction.id}) cho đơn ${order.orderNumber} qua ${method}`,
      );

      return {
        paymentRecord,
        paymentTransaction,
        paymentDetails: initResult.paymentDetails,
        instruction: initResult.instruction,
        qrCodeUrl: initResult.qrCodeUrl,
        payUrl: initResult.payUrl,
      };
    });
  }

  /**
   * Lấy bản ghi thanh toán của một đơn hàng
   */
  async getPaymentByOrderId(orderId: string, actor: PaymentActor) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng ID: ${orderId}`);
    }
    this.assertOrderAccess(order, actor);
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
  async getPaymentById(paymentId: string, actor: PaymentActor) {
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

    this.assertOrderAccess(payment.order, actor);

    return payment;
  }

  /**
   * Lấy toàn bộ lịch sử các lần thử thanh toán của một đơn hàng
   */
  async getOrderTransactions(
    orderId: string,
    actor: PaymentActor,
  ): Promise<PaymentTransaction[]> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng ID: ${orderId}`);
    }
    this.assertOrderAccess(order, actor);
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

    const payment = await this.getPaymentById(paymentId, {
      userId: actorId,
      role: actorRole,
    });
    const order = payment.order;

    // 2. Order & Payment Status Guard: Không cho phép xác nhận đơn đã hủy hoặc kết thúc
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException(
        `Không thể xác nhận thanh toán cho đơn hàng đã bị hủy (${order.orderNumber}).`,
      );
    }
    if (order.status === OrderStatus.RETURNED || order.status === OrderStatus.REFUNDED) {
      throw new BadRequestException(
        `Không thể xác nhận thanh toán cho đơn hàng ở trạng thái ${order.status} (${order.orderNumber}).`,
      );
    }
    if (
      payment.status === PaymentStatus.CANCELLED ||
      payment.status === PaymentStatus.REFUNDED ||
      order.paymentStatus === PaymentStatus.CANCELLED ||
      order.paymentStatus === PaymentStatus.REFUNDED
    ) {
      const reason =
        payment.status === PaymentStatus.REFUNDED || order.paymentStatus === PaymentStatus.REFUNDED
          ? 'đã hoàn tiền'
          : 'đã bị hủy';
      throw new BadRequestException(
        `Giao dịch thanh toán của đơn hàng ${order.orderNumber} ${reason} và không thể xác nhận thành công.`,
      );
    }

    // 3. Idempotency Check: Nếu đã thanh toán rồi thì trả về kết quả cũ
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

    // 4. State Machine Validation: Xác thực chuyển đổi trạng thái
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
      const claim = await tx.paymentRecord.updateMany({
        where: { id: paymentId, status: payment.status },
        data: {
          status: PaymentStatus.PAID,
          paidAt: new Date(),
          transactionReference:
            dto.transactionReference || payment.transactionReference,
        },
      });

      if (claim.count === 0) {
        const [existingPayment, existingOrder] = await Promise.all([
          tx.paymentRecord.findUnique({ where: { id: paymentId } }),
          tx.order.findUnique({ where: { id: order.id } }),
        ]);
        if (!existingPayment || !existingOrder) {
          throw new NotFoundException(`Không tìm thấy thanh toán hoặc đơn hàng ${paymentId}`);
        }
        if (existingPayment.status !== PaymentStatus.PAID) {
          throw new ConflictException(
            `Thanh toán ${paymentId} đã chuyển sang trạng thái ${existingPayment.status} và không thể xác nhận là PAID`,
          );
        }
        return {
          updatedPayment: existingPayment,
          updatedOrder: existingOrder,
          duplicate: true,
        };
      }

      const updatedPayment = await tx.paymentRecord.findUnique({
        where: { id: paymentId },
      });
      if (!updatedPayment) {
        throw new NotFoundException(`Không tìm thấy giao dịch thanh toán ID: ${paymentId}`);
      }

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

      const orderWithItems = await tx.order.findUnique({
        where: { id: order.id },
        include: { items: true },
      });
      if (orderWithItems?.reservationId && nextOrderStatus !== OrderStatus.CANCELLED) {
        for (const item of orderWithItems.items) {
          const reservationId = `${orderWithItems.reservationId}-${item.variantId}`;
          await tx.compensationTask.upsert({
            where: { idempotencyKey: `commit:${reservationId}` },
            create: {
              type: CompensationTaskType.COMMIT_INVENTORY,
              idempotencyKey: `commit:${reservationId}`,
              payload: JSON.stringify({
                reservationId,
                referenceId: order.orderNumber,
                orderId: order.id,
                paymentId,
                requestId: `manual-${paymentId}`,
              }),
              status: 'PENDING',
              maxRetries: 60,
              nextAttemptAt: new Date(),
            },
            update: {},
          });
        }
      }

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

      return { updatedPayment, updatedOrder, duplicate: false };
    });

    return {
      success: true,
      message: transactionResult.duplicate
        ? 'Thanh toán đã được xác nhận trước đó (Idempotent)'
        : 'Xác nhận thanh toán thành công',
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
    } else if (normalizedProvider.includes('MOMO')) {
      provider = this.momoProvider;
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

    const providerOrderId =
      webhookResult.providerOrderId || webhookResult.orderNumber;
    const providerRequestId = webhookResult.providerRequestId;
    const providerTransactionId =
      webhookResult.providerTransactionId || webhookResult.transactionId;

    if (!providerOrderId) {
      return {
        success: false,
        message: 'Webhook không có provider order identifier',
      };
    }

    // A successful financial transition is one database transaction: resolve the
    // exact attempt, validate the expected amount, claim it once, mark paid, and
    // persist inventory commit intent before acknowledging the provider.
    if (webhookResult.isPaid) {
      if (!providerTransactionId || webhookResult.amount === undefined) {
        return {
          success: false,
          message: 'Webhook thanh toán thiếu transaction id hoặc amount',
        };
      }

      try {
        const outcome = await this.prisma.$transaction(async (tx) => {
          const attempt = await tx.paymentTransaction.findFirst({
            where: {
              provider: provider.providerName,
              providerOrderId,
              ...(providerRequestId ? { providerRequestId } : {}),
            },
            include: {
              order: { include: { items: true } },
              paymentRecord: true,
            },
            orderBy: { createdAt: 'desc' },
          });

          if (!attempt) {
            return { kind: 'rejected' as const, message: 'Không tìm thấy payment attempt tương ứng' };
          }

          const expectedAmount = Number(attempt.amount);
          const receivedAmount = webhookResult.amount;
          if (
            !Number.isSafeInteger(receivedAmount) ||
            receivedAmount !== expectedAmount
          ) {
            await tx.auditLog.create({
              data: {
                actorId: `WEBHOOK:${provider.providerName}`,
                actorRole: 'SYSTEM',
                action: 'PAYMENT_AMOUNT_MISMATCH',
                entityType: 'PAYMENT_TRANSACTION',
                entityId: attempt.id,
                oldValue: JSON.stringify({ expectedAmount }),
                newValue: JSON.stringify({ receivedAmount }),
                requestId: providerRequestId,
              },
            });
            return { kind: 'rejected' as const, message: 'Số tiền webhook không khớp payment attempt' };
          }

          const claim = await tx.paymentTransaction.updateMany({
            where: {
              id: attempt.id,
              status: {
                in: [
                  PaymentTransactionStatus.PENDING,
                  PaymentTransactionStatus.FAILED,
                  PaymentTransactionStatus.EXPIRED,
                ],
              },
              OR: [
                {
                  status: {
                    in: [
                      PaymentTransactionStatus.FAILED,
                      PaymentTransactionStatus.EXPIRED,
                    ],
                  },
                },
                { providerTransactionId: null },
                { providerTransactionId },
              ],
            },
            data: {
              status: PaymentTransactionStatus.SUCCESS,
              transactionId: providerTransactionId,
              providerTransactionId,
              rawRequest: JSON.stringify({ body }),
              rawResponse: JSON.stringify(webhookResult.rawResponse || {}),
              errorMessage: null,
              paidAt: webhookResult.paidAt || new Date(),
            },
          });

          if (claim.count === 0) {
            return { kind: 'duplicate' as const, order: attempt.order };
          }

          if (!attempt.paymentRecordId) {
            throw new Error(`Payment attempt ${attempt.id} is not bound to a PaymentRecord`);
          }

          const paymentRecordClaim = await tx.paymentRecord.updateMany({
            where: {
              id: attempt.paymentRecordId,
              status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
            },
            data: {
              status: PaymentStatus.PAID,
              paidAt: webhookResult.paidAt || new Date(),
              transactionReference: providerTransactionId,
            },
          });

          const order = attempt.order;
          if (paymentRecordClaim.count === 0) {
            const currentPaymentRecord = await tx.paymentRecord.findUnique({
              where: { id: attempt.paymentRecordId },
              select: { status: true },
            });
            if (currentPaymentRecord?.status === PaymentStatus.PAID) {
              return { kind: 'duplicate' as const, order };
            }
            throw new Error(
              `PaymentRecord ${attempt.paymentRecordId} could not be transitioned to PAID`,
            );
          }

          const nextStatus =
            order.status === OrderStatus.PENDING ? OrderStatus.CONFIRMED : order.status;
          await tx.order.updateMany({
            where: { id: order.id, paymentStatus: { not: PaymentStatus.PAID } },
            data: { paymentStatus: PaymentStatus.PAID, status: nextStatus },
          });

          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: nextStatus,
              changedBy: `WEBHOOK:${provider.providerName}`,
              note: `Tự động xác nhận payment attempt ${attempt.id} (provider tx: ${providerTransactionId})`,
            },
          });

          if (order.reservationId && nextStatus !== OrderStatus.CANCELLED) {
            for (const item of order.items) {
              const reservationId = `${order.reservationId}-${item.variantId}`;
              await tx.compensationTask.upsert({
                where: { idempotencyKey: `commit:${reservationId}` },
                create: {
                  type: CompensationTaskType.COMMIT_INVENTORY,
                  idempotencyKey: `commit:${reservationId}`,
                  payload: JSON.stringify({
                    reservationId,
                    referenceId: order.orderNumber,
                    orderId: order.id,
                    paymentAttemptId: attempt.id,
                    providerTransactionId,
                    requestId: providerRequestId,
                  }),
                  status: 'PENDING',
                  maxRetries: 60,
                  nextAttemptAt: new Date(),
                },
                update: {},
              });
            }
          }

          return { kind: 'processed' as const, order };
        });

        if (outcome.kind === 'rejected') {
          logger.warn('PAYMENT_AMOUNT_MISMATCH', {
            provider: provider.providerName,
            providerOrderId,
            providerRequestId,
            providerTransactionId,
            receivedAmount: webhookResult.amount,
          });
          return { success: false, message: outcome.message };
        }

        if (outcome.kind === 'duplicate') {
          logger.info('PAYMENT_DUPLICATE_WEBHOOK', {
            provider: provider.providerName,
            providerTransactionId,
            orderId: outcome.order.id,
          });
          return {
            success: true,
            message: 'Webhook đã được xử lý trước đó (Idempotent)',
            transactionId: providerTransactionId,
          };
        }

        logger.info('PAYMENT_PAID', {
          provider: provider.providerName,
          providerTransactionId,
          orderId: outcome.order.id,
          orderNumber: outcome.order.orderNumber,
        });
        return {
          success: true,
          message: 'Xử lý thanh toán webhook thành công',
          transactionId: providerTransactionId,
        };
      } catch (err) {
        if ((err as { code?: string }).code === 'P2002') {
          const existingProviderTransaction =
            await this.prisma.paymentTransaction.findFirst({
              where: {
                provider: provider.providerName,
                providerTransactionId,
              },
              select: { id: true },
            });
          if (!existingProviderTransaction) {
            throw err;
          }
          logger.info('PAYMENT_DUPLICATE_WEBHOOK', {
            provider: provider.providerName,
            providerTransactionId,
          });
          return {
            success: true,
            message: 'Webhook đã được xử lý trước đó (Idempotent)',
            transactionId: providerTransactionId,
          };
        }
        throw err;
      }
    }

    if (webhookResult.isFailed || webhookResult.isExpired) {
      const targetStatus = webhookResult.isExpired
        ? PaymentTransactionStatus.EXPIRED
        : PaymentTransactionStatus.FAILED;

      const attempt = await this.prisma.paymentTransaction.findFirst({
        where: {
          provider: provider.providerName,
          providerOrderId,
          ...(providerRequestId ? { providerRequestId } : {}),
        },
        include: { order: true },
        orderBy: { createdAt: 'desc' },
      });
      if (!attempt) {
        return { success: false, message: 'Không tìm thấy payment attempt tương ứng' };
      }

      const claim = await this.prisma.paymentTransaction.updateMany({
        where: { id: attempt.id, status: PaymentTransactionStatus.PENDING },
        data: {
          status: targetStatus,
          transactionId: providerTransactionId,
          errorMessage: webhookResult.errorMessage,
          rawRequest: JSON.stringify({ body }),
          rawResponse: JSON.stringify(webhookResult.rawResponse || {}),
        },
      });

      // Do not release inventory directly from a provider callback. A verified
      // PAID callback may race or arrive after FAILED/EXPIRED. The inventory
      // expiry worker owns release and checks the order payment disposition
      // before changing reservation state.

      return {
        success: true,
        message:
          claim.count === 1
            ? `Ghi nhận trạng thái ${targetStatus} từ Webhook`
            : 'Webhook không làm thay đổi payment attempt đã hoàn tất',
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
