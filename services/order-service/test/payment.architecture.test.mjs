import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient, PaymentMethod, PaymentStatus, PaymentTransactionStatus, OrderStatus } from '../generated/client/index.js';
import { PaymentStateMachine } from '../dist/payments/payment-state-machine.js';
import { CodPaymentProvider } from '../dist/payments/providers/cod-payment.provider.js';
import { BankTransferPaymentProvider } from '../dist/payments/providers/bank-transfer-payment.provider.js';
import { PaymentsService } from '../dist/payments/payments.service.js';

// Khởi tạo Prisma Client kết nối database test_order_db (MySQL port 3307)
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.ORDER_DATABASE_URL || 'mysql://phanbon_user:phanbon_secret@localhost:3307/test_order_db',
    },
  },
});

describe('Phase 7 — Payment Architecture & Integrity Tests', () => {
  const codProvider = new CodPaymentProvider();
  const bankTransferProvider = new BankTransferPaymentProvider();

  // Mock CompensationService
  const mockCompensationService = {
    createTask: async () => ({ id: 'mock-comp-id' }),
  };

  const paymentsService = new PaymentsService(
    prisma,
    codProvider,
    bankTransferProvider,
    mockCompensationService,
  );

  const testOrderIds = [];

  after(async () => {
    // Dọn dẹp dữ liệu test
    if (testOrderIds.length > 0) {
      await prisma.paymentTransaction.deleteMany({
        where: { orderId: { in: testOrderIds } },
      });
      await prisma.paymentAuditLog.deleteMany({
        where: { payment: { orderId: { in: testOrderIds } } },
      });
      await prisma.paymentRecord.deleteMany({
        where: { orderId: { in: testOrderIds } },
      });
      await prisma.orderItem.deleteMany({
        where: { orderId: { in: testOrderIds } },
      });
      await prisma.orderStatusHistory.deleteMany({
        where: { orderId: { in: testOrderIds } },
      });
      await prisma.order.deleteMany({
        where: { id: { in: testOrderIds } },
      });
    }
    await prisma.$disconnect();
  });

  // ============================================================================
  // 1. Payment State Machine Transition Matrix Tests
  // ============================================================================
  describe('7.1: Payment State Machine & Invariant Tests', () => {
    test('Hợp lệ: Các bước chuyển trạng thái thanh toán đúng quy tắc nghiệp vụ', () => {
      // PENDING transitions
      assert.equal(PaymentStateMachine.canTransition(PaymentStatus.PENDING, PaymentStatus.PROCESSING), true);
      assert.equal(PaymentStateMachine.canTransition(PaymentStatus.PENDING, PaymentStatus.PAID), true);
      assert.equal(PaymentStateMachine.canTransition(PaymentStatus.PENDING, PaymentStatus.FAILED), true);
      assert.equal(PaymentStateMachine.canTransition(PaymentStatus.PENDING, PaymentStatus.EXPIRED), true);
      assert.equal(PaymentStateMachine.canTransition(PaymentStatus.PENDING, PaymentStatus.CANCELLED), true);

      // PROCESSING transitions
      assert.equal(PaymentStateMachine.canTransition(PaymentStatus.PROCESSING, PaymentStatus.PAID), true);
      assert.equal(PaymentStateMachine.canTransition(PaymentStatus.PROCESSING, PaymentStatus.FAILED), true);
      assert.equal(PaymentStateMachine.canTransition(PaymentStatus.PROCESSING, PaymentStatus.EXPIRED), true);

      // PAID transitions (chỉ cho phép hoàn tiền)
      assert.equal(PaymentStateMachine.canTransition(PaymentStatus.PAID, PaymentStatus.REFUNDED), true);
      assert.equal(PaymentStateMachine.canTransition(PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED), true);
    });

    test('Bất hợp lệ: Từ chối chuyển đổi vi phạm quy tắc an toàn', () => {
      // Đã thanh toán (PAID) không thể quay ngược lại PENDING hoặc FAILED
      assert.equal(PaymentStateMachine.canTransition(PaymentStatus.PAID, PaymentStatus.PENDING), false);
      assert.equal(PaymentStateMachine.canTransition(PaymentStatus.PAID, PaymentStatus.FAILED), false);

      // Đã FAILED hoặc EXPIRED là terminal, không thể tự chuyển sang PAID mà không qua phiên mới
      assert.equal(PaymentStateMachine.canTransition(PaymentStatus.FAILED, PaymentStatus.PAID), false);
      assert.equal(PaymentStateMachine.canTransition(PaymentStatus.EXPIRED, PaymentStatus.PAID), false);
      assert.equal(PaymentStateMachine.canTransition(PaymentStatus.CANCELLED, PaymentStatus.PAID), false);

      // assertTransition ném lỗi BadRequestException khi vi phạm
      assert.throws(
        () => PaymentStateMachine.assertTransition(PaymentStatus.PAID, PaymentStatus.PENDING),
        /Chuyển đổi trạng thái thanh toán không hợp lệ/,
      );
      assert.throws(
        () => PaymentStateMachine.assertTransition(PaymentStatus.FAILED, PaymentStatus.PAID),
        /Chuyển đổi trạng thái thanh toán không hợp lệ/,
      );
    });

    test('State Machine Helper: Nhận diện chính xác trạng thái kết thúc và chỉ thị kho', () => {
      assert.equal(PaymentStateMachine.isTerminalStatus(PaymentStatus.PAID), false);
      assert.equal(PaymentStateMachine.isTerminalStatus(PaymentStatus.FAILED), true);
      assert.equal(PaymentStateMachine.isTerminalStatus(PaymentStatus.EXPIRED), true);
      assert.equal(PaymentStateMachine.isTerminalStatus(PaymentStatus.CANCELLED), true);
      assert.equal(PaymentStateMachine.isTerminalStatus(PaymentStatus.REFUNDED), true);

      // Chỉ thị commit tồn kho khi thanh toán thành công
      assert.equal(PaymentStateMachine.shouldCommitInventory(PaymentStatus.PAID), true);
      assert.equal(PaymentStateMachine.shouldCommitInventory(PaymentStatus.PENDING), false);

      // Chỉ thị giải phóng tồn kho khi thất bại hoặc hết hạn
      assert.equal(PaymentStateMachine.shouldReleaseInventory(PaymentStatus.FAILED), true);
      assert.equal(PaymentStateMachine.shouldReleaseInventory(PaymentStatus.EXPIRED), true);
      assert.equal(PaymentStateMachine.shouldReleaseInventory(PaymentStatus.CANCELLED), true);
      assert.equal(PaymentStateMachine.shouldReleaseInventory(PaymentStatus.PAID), false);
    });
  });

  // ============================================================================
  // 2. Abstract Payment Providers Contract Tests
  // ============================================================================
  describe('7.2: Abstract Payment Provider Interface Compliance', () => {
    test('CodPaymentProvider: Tuân thủ đầy đủ giao thức createPayment, verifyWebhook, checkStatus', async () => {
      const payload = {
        orderId: 'order-cod-01',
        orderNumber: 'DH-20260920-COD001',
        amount: 500000,
        customerId: 'cust-01',
      };

      const result = await codProvider.createPayment(payload);
      assert.equal(result.provider, 'COD');
      assert.equal(result.method, PaymentMethod.COD);
      assert.equal(result.status, PaymentStatus.PENDING);
      assert.ok(result.transactionReference.includes('COD-'));
      assert.ok(result.instruction.includes('tiền mặt'));

      const webhook = await codProvider.verifyWebhook({}, {});
      assert.equal(webhook.isValid, false);
      assert.equal(webhook.isPaid, false);

      const status = await codProvider.checkStatus('COD-DH-20260920-COD001');
      assert.equal(status.status, PaymentStatus.PENDING);
    });

    test('BankTransferPaymentProvider (VietQR): Sinh mã QR chuẩn và thẩm tra Webhook', async () => {
      const payload = {
        orderId: 'order-bt-01',
        orderNumber: 'DH-20260920-BT0001',
        amount: 1500000,
        customerId: 'cust-01',
      };

      const result = await bankTransferProvider.createPayment(payload);
      assert.equal(result.provider, 'VIETQR');
      assert.equal(result.method, PaymentMethod.BANK_TRANSFER);
      assert.equal(result.status, PaymentStatus.PENDING);
      assert.ok(result.qrCodeUrl.includes('img.vietqr.io'));
      assert.ok(result.qrCodeUrl.includes('1500000'));
      assert.ok(result.expiresAt instanceof Date);

      // Webhook hợp lệ khớp mã đơn
      const validWebhook = await bankTransferProvider.verifyWebhook(
        {},
        {
          transferContent: 'Thanh toan don hang DH-20260920-BT0001',
          amount: 1500000,
          transactionId: 'VNPAY-TX-998811',
        },
      );
      assert.equal(validWebhook.isValid, true);
      assert.equal(validWebhook.isPaid, true);
      assert.equal(validWebhook.orderNumber, 'DH-20260920-BT0001');
      assert.equal(validWebhook.amount, 1500000);

      // Webhook không chứa mã đơn hợp lệ
      const invalidWebhook = await bankTransferProvider.verifyWebhook(
        {},
        {
          transferContent: 'Tien an trua cho ban',
          amount: 50000,
        },
      );
      assert.equal(invalidWebhook.isValid, false);
      assert.equal(invalidWebhook.isPaid, false);
    });
  });

  // ============================================================================
  // 3. Database Persistence & Multiple Payment Attempts Tests
  // ============================================================================
  describe('7.3: Multiple Payment Attempts & PaymentTransaction Audit (Real MySQL)', () => {
    test('Hỗ trợ nhiều lần thử thanh toán (Attempts) cho cùng 1 đơn hàng', async () => {
      const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
      const orderNumber = `DH-20260920-${suffix}`;
      const customerId = `cust-${crypto.randomUUID().slice(0, 8)}`;

      // 1. Tạo đơn hàng PENDING trong DB
      const order = await prisma.order.create({
        data: {
          orderNumber,
          customerId,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          subtotal: 1000000,
          totalAmount: 1000000,
        },
      });
      testOrderIds.push(order.id);

      // 2. Khởi tạo PaymentRecord và Attempt 1 (VIETQR)
      const initResult = await paymentsService.createPaymentRecord(
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          amount: 1000000,
          customerId,
        },
        PaymentMethod.BANK_TRANSFER,
      );

      assert.ok(initResult.paymentRecord.id);
      assert.ok(initResult.paymentTransaction.id);
      assert.equal(initResult.paymentTransaction.status, PaymentTransactionStatus.PENDING);

      // 3. Khách hàng đổi ý hoặc chuyển khoản thất bại -> Đổi sang COD (Attempt 2)
      const retryResult = await paymentsService.createPaymentAttempt(
        order.id,
        PaymentMethod.COD,
        customerId,
      );

      assert.ok(retryResult.paymentTransaction.id);
      assert.notEqual(retryResult.paymentTransaction.id, initResult.paymentTransaction.id);
      assert.equal(retryResult.paymentTransaction.method, PaymentMethod.COD);
      assert.equal(retryResult.paymentRecord.method, PaymentMethod.COD);

      // 4. Kiểm tra toàn bộ lịch sử các lần thử thanh toán
      const transactions = await paymentsService.getOrderTransactions(order.id);
      assert.equal(transactions.length, 2);
      assert.equal(transactions[0].id, retryResult.paymentTransaction.id); // Attempt mới nhất ở đầu
      assert.equal(transactions[1].id, initResult.paymentTransaction.id); // Attempt ban đầu

      // 5. Admin xác nhận thanh toán thành công
      const confirmResult = await paymentsService.confirmPayment(
        retryResult.paymentRecord.id,
        'admin-01',
        'ADMIN',
        { amount: 1000000, note: 'Thu tiền mặt tận nơi thành công' },
      );

      assert.equal(confirmResult.success, true);
      assert.equal(confirmResult.payment.status, PaymentStatus.PAID);
      assert.equal(confirmResult.order.paymentStatus, PaymentStatus.PAID);
      assert.equal(confirmResult.order.status, OrderStatus.CONFIRMED);

      // 6. Kiểm tra lại transactions: Đã có thêm bản ghi SUCCESS ghi nhận thời điểm thanh toán
      const finalTransactions = await paymentsService.getOrderTransactions(order.id);
      assert.ok(finalTransactions.some((t) => t.status === PaymentTransactionStatus.SUCCESS));
    });
  });

  // ============================================================================
  // 4. Webhook Idempotency & Automatic Order Confirmation
  // ============================================================================
  describe('7.4: Webhook Idempotency & Order Auto-Confirmation (Real MySQL)', () => {
    test('Xử lý Webhook VietQR tự động cập nhật đơn hàng và an toàn Idempotent 100%', async () => {
      const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
      const orderNumber = `DH-20260920-${suffix}`;
      const customerId = `cust-${crypto.randomUUID().slice(0, 8)}`;

      // 1. Tạo đơn hàng
      const order = await prisma.order.create({
        data: {
          orderNumber,
          customerId,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          subtotal: 750000,
          totalAmount: 750000,
        },
      });
      testOrderIds.push(order.id);

      await paymentsService.createPaymentRecord(
        {
          orderId: order.id,
          orderNumber,
          amount: 750000,
          customerId,
        },
        PaymentMethod.BANK_TRANSFER,
      );

      const webhookBody = {
        transferContent: `Chuyen khoan don ${orderNumber}`,
        amount: 750000,
        transactionId: `TX-BANK-${suffix}`,
      };

      // 2. Bắn Webhook lần 1: Đơn hàng chuyển sang PAID và CONFIRMED
      const res1 = await paymentsService.handlePaymentWebhook('VIETQR', {}, webhookBody);
      assert.equal(res1.success, true);
      assert.equal(res1.transactionId, `TX-BANK-${suffix}`);

      const updatedOrder1 = await prisma.order.findUnique({ where: { id: order.id } });
      assert.equal(updatedOrder1.paymentStatus, PaymentStatus.PAID);
      assert.equal(updatedOrder1.status, OrderStatus.CONFIRMED);

      // 3. Bắn Webhook lần 2 (Cổng thanh toán retry do timeout mạng): Idempotent
      const res2 = await paymentsService.handlePaymentWebhook('VIETQR', {}, webhookBody);
      assert.equal(res2.success, true);
      assert.ok(res2.message.includes('Idempotent'));

      // Đảm bảo trạng thái vẫn là PAID/CONFIRMED, không bị lỗi lặp
      const updatedOrder2 = await prisma.order.findUnique({ where: { id: order.id } });
      assert.equal(updatedOrder2.paymentStatus, PaymentStatus.PAID);
      assert.equal(updatedOrder2.status, OrderStatus.CONFIRMED);
    });
  });
});
