import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  PrismaClient,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionStatus,
  OrderStatus,
} from '../generated/client/index.js';
import { CodPaymentProvider } from '../dist/payments/providers/cod-payment.provider.js';
import { BankTransferPaymentProvider } from '../dist/payments/providers/bank-transfer-payment.provider.js';
import { MomoPaymentProvider } from '../dist/payments/providers/momo-payment.provider.js';
import { PaymentsService } from '../dist/payments/payments.service.js';

// Khởi tạo Prisma Client kết nối database test_order_db (MySQL port 3307)
const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.ORDER_DATABASE_URL ||
        'mysql://phanbon_user:phanbon_secret@localhost:3307/test_order_db',
    },
  },
});

describe('Phase 8 — MoMo Sandbox Integration Tests', () => {
  const codProvider = new CodPaymentProvider();
  const bankTransferProvider = new BankTransferPaymentProvider();
  const momoProvider = new MomoPaymentProvider();

  // Mock CompensationService
  const mockCompensationService = {
    createTask: async () => ({ id: 'mock-comp-id' }),
  };

  const paymentsService = new PaymentsService(
    prisma,
    codProvider,
    bankTransferProvider,
    momoProvider,
    mockCompensationService,
  );

  const testOrderIds = [];

  after(async () => {
    // Dọn dẹp dữ liệu test trong MySQL
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
  // 1. MoMo HMAC-SHA256 Signature Specification Tests
  // ============================================================================
  describe('8.1: MoMo HMAC-SHA256 Signature Specification & Verification', () => {
    test('Tạo chữ ký HMAC-SHA256 chính xác theo quy chuẩn MoMo Gateway', () => {
      const secretKey = 'at67qH6mk8w5Y1nAyMoYKMWACiEi2Aca';
      const rawData =
        'accessKey=klm05TvNBzhg7h7j&amount=50000&extraData=&ipnUrl=http://localhost:3003/api/v1/payments/momo/ipn&orderId=DH-TEST-001&orderInfo=Thanh toan don hang DH-TEST-001&partnerCode=MOMOBKUN20180529&redirectUrl=http://localhost:3000/checkout/thanh-cong&requestId=DH-TEST-001_123456&requestType=captureWallet';

      const expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(rawData)
        .digest('hex');

      const computedSignature = MomoPaymentProvider.generateSignature(
        rawData,
        secretKey,
      );

      assert.equal(computedSignature, expectedSignature);
      assert.equal(computedSignature.length, 64); // SHA256 hex string luôn 64 ký tự
    });

    test('Bất kỳ sự thay đổi nào trên payload đều làm sai lệch chữ ký (Tamper Proof)', () => {
      const secretKey = 'at67qH6mk8w5Y1nAyMoYKMWACiEi2Aca';
      const rawData =
        'accessKey=klm05TvNBzhg7h7j&amount=50000&extraData=&ipnUrl=http://localhost:3003/api/v1/payments/momo/ipn&orderId=DH-TEST-001&orderInfo=Thanh toan don hang DH-TEST-001&partnerCode=MOMOBKUN20180529&redirectUrl=http://localhost:3000/checkout/thanh-cong&requestId=DH-TEST-001_123456&requestType=captureWallet';
      const tamperedData = rawData.replace('amount=50000', 'amount=500000');

      const originalSignature = MomoPaymentProvider.generateSignature(
        rawData,
        secretKey,
      );
      const tamperedSignature = MomoPaymentProvider.generateSignature(
        tamperedData,
        secretKey,
      );

      assert.notEqual(originalSignature, tamperedSignature);
    });
  });

  // ============================================================================
  // 2. MomoPaymentProvider Unit Tests
  // ============================================================================
  describe('8.2: MomoPaymentProvider Unit Tests (createPayment, verifyWebhook)', () => {
    test('createPayment: Khởi tạo URL thanh toán và mã QR MoMo Sandbox hợp lệ', async () => {
      const payload = {
        orderId: 'order-uuid-001',
        orderNumber: 'DH-20260920-MOMO01',
        amount: 350000,
        customerId: 'customer-uuid-001',
        description: 'Thanh toan don hang NPK',
      };

      const result = await momoProvider.createPayment(payload);

      assert.equal(result.provider, 'MOMO');
      assert.equal(result.method, PaymentMethod.MOMO);
      assert.equal(result.status, PaymentStatus.PENDING);
      assert.equal(result.transactionReference, 'MOMO-DH-20260920-MOMO01');
      assert.ok(result.payUrl, 'Phải có payUrl thanh toán MoMo');
      assert.ok(result.qrCodeUrl, 'Phải có qrCodeUrl');
      assert.ok(result.expiresAt, 'Phải có thời hạn giao dịch');
      assert.ok(result.expiresAt > new Date());
    });

    test('verifyWebhook: Xác thực IPN thành công khi resultCode = 0 và chữ ký hợp lệ', async () => {
      const config = momoProvider.getConfig();
      const orderId = 'DH-20260920-MOMO02';
      const amount = 500000;
      const transId = '2456789123';
      const requestId = `${orderId}_12345`;
      const responseTime = Date.now();
      const resultCode = 0;
      const message = 'Giao dịch thành công.';
      const extraData = '';
      const orderInfo = `Thanh toan don hang ${orderId}`;
      const orderType = 'momo_wallet';
      const partnerCode = config.partnerCode;
      const payType = 'qr';

      const rawSignature = `accessKey=${config.accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
      const signature = momoProvider.createHmacSignature(rawSignature);

      const ipnBody = {
        partnerCode,
        orderId,
        requestId,
        amount,
        orderInfo,
        orderType,
        transId,
        resultCode,
        message,
        payType,
        responseTime,
        extraData,
        signature,
      };

      const verifyResult = await momoProvider.verifyWebhook({}, ipnBody);

      assert.equal(verifyResult.isValid, true);
      assert.equal(verifyResult.isPaid, true);
      assert.equal(verifyResult.isFailed, false);
      assert.equal(verifyResult.status, PaymentStatus.PAID);
      assert.equal(verifyResult.orderNumber, orderId);
      assert.equal(verifyResult.amount, amount);
      assert.equal(verifyResult.transactionId, transId);
    });

    test('verifyWebhook: Xử lý khi người dùng hủy hoặc phiên MoMo hết hạn (resultCode = 1006)', async () => {
      const config = momoProvider.getConfig();
      const orderId = 'DH-20260920-MOMO03';
      const amount = 250000;
      const transId = '2456789124';
      const requestId = `${orderId}_99999`;
      const responseTime = Date.now();
      const resultCode = 1006;
      const message = 'Người dùng đã hủy giao dịch.';
      const extraData = '';
      const orderInfo = `Thanh toan don hang ${orderId}`;
      const orderType = 'momo_wallet';
      const partnerCode = config.partnerCode;
      const payType = 'app';

      const rawSignature = `accessKey=${config.accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
      const signature = momoProvider.createHmacSignature(rawSignature);

      const ipnBody = {
        partnerCode,
        orderId,
        requestId,
        amount,
        orderInfo,
        orderType,
        transId,
        resultCode,
        message,
        payType,
        responseTime,
        extraData,
        signature,
      };

      const verifyResult = await momoProvider.verifyWebhook({}, ipnBody);

      assert.equal(verifyResult.isValid, true);
      assert.equal(verifyResult.isPaid, false);
      assert.equal(verifyResult.isExpired, true);
      assert.equal(verifyResult.status, PaymentStatus.EXPIRED);
    });

    test('verifyWebhook: Từ chối khi chữ ký bị làm giả hoặc bị sửa đổi (Signature Mismatch)', async () => {
      const config = momoProvider.getConfig();
      const ipnBody = {
        partnerCode: config.partnerCode,
        orderId: 'DH-20260920-MOMO04',
        requestId: 'DH-20260920-MOMO04_123',
        amount: 100000,
        orderInfo: 'Thanh toan don hang DH-20260920-MOMO04',
        orderType: 'momo_wallet',
        transId: '9999999',
        resultCode: 0,
        message: 'Thành công giả mạo',
        payType: 'qr',
        responseTime: Date.now(),
        extraData: '',
        signature: 'fake_tampered_signature_hex_1234567890abcdef1234567890abcdef12345678',
      };

      const verifyResult = await momoProvider.verifyWebhook({}, ipnBody);

      assert.equal(verifyResult.isValid, false);
      assert.equal(verifyResult.isPaid, false);
      assert.match(verifyResult.errorMessage, /Signature Mismatch/);
    });
  });

  // ============================================================================
  // 3. MoMo Webhook End-to-End Processing & State Synchronization
  // ============================================================================
  describe('8.3: MoMo IPN End-to-End Webhook & Order State Synchronization (MySQL)', () => {
    test('Nhận MoMo IPN hợp lệ -> Tự động xác nhận đơn CONFIRMED, cập nhật PAID và ghi nhận Transaction SUCCESS', async () => {
      const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
      const orderNumber = `DH-20260920-${suffix}`;
      const customerId = `cust-${crypto.randomUUID().slice(0, 8)}`;
      const totalAmount = 750000;

      // 1. Tạo đơn hàng PENDING trong DB với paymentMethod = MOMO
      const order = await prisma.order.create({
        data: {
          orderNumber,
          customerId,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          paymentMethod: PaymentMethod.MOMO,
          subtotal: totalAmount,
          totalAmount: totalAmount,
        },
      });
      testOrderIds.push(order.id);

      // 2. Khởi tạo bản ghi thanh toán MoMo
      const initResult = await paymentsService.createPaymentRecord(
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          amount: totalAmount,
          customerId,
        },
        PaymentMethod.MOMO,
      );

      assert.equal(initResult.paymentRecord.provider, 'MOMO');
      assert.equal(initResult.paymentRecord.method, PaymentMethod.MOMO);
      assert.equal(initResult.paymentRecord.status, PaymentStatus.PENDING);
      assert.ok(initResult.payUrl);

      // 3. Giả lập MoMo gửi IPN Webhook thanh toán thành công
      const config = momoProvider.getConfig();
      const transId = `MOMO_TX_${Date.now()}`;
      const requestId = `${orderNumber}_${Date.now()}`;
      const responseTime = Date.now();
      const resultCode = 0;
      const message = 'Giao dịch MoMo thành công.';
      const extraData = '';
      const orderInfo = `Thanh toan don hang ${orderNumber}`;
      const orderType = 'momo_wallet';
      const partnerCode = config.partnerCode;
      const payType = 'qr';

      const rawSignature = `accessKey=${config.accessKey}&amount=${totalAmount}&extraData=${extraData}&message=${message}&orderId=${orderNumber}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
      const signature = momoProvider.createHmacSignature(rawSignature);

      const momoIpnBody = {
        partnerCode,
        orderId: orderNumber,
        requestId,
        amount: totalAmount,
        orderInfo,
        orderType,
        transId,
        resultCode,
        message,
        payType,
        responseTime,
        extraData,
        signature,
      };

      // 4. Xử lý Webhook qua PaymentsService
      const webhookResponse = await paymentsService.handlePaymentWebhook(
        'MOMO',
        {},
        momoIpnBody,
      );

      assert.equal(webhookResponse.success, true);
      assert.equal(webhookResponse.transactionId, transId);

      // 5. Kiểm tra trạng thái đơn hàng sau khi nhận IPN
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: { payments: true },
      });

      assert.equal(updatedOrder.status, OrderStatus.CONFIRMED);
      assert.equal(updatedOrder.paymentStatus, PaymentStatus.PAID);

      // 6. Kiểm tra PaymentRecord
      const paymentRecord = updatedOrder.payments[0];
      assert.equal(paymentRecord.status, PaymentStatus.PAID);
      assert.ok(paymentRecord.paidAt);

      // 7. Kiểm tra PaymentTransaction đã ghi nhận SUCCESS
      const transactions = await prisma.paymentTransaction.findMany({
        where: { orderId: order.id },
        orderBy: { createdAt: 'desc' },
      });

      assert.equal(transactions.length, 2); // 1 PENDING ban đầu + 1 SUCCESS từ Webhook
      assert.equal(transactions[0].status, PaymentTransactionStatus.SUCCESS);
      assert.equal(transactions[0].provider, 'MOMO');
      assert.equal(transactions[0].transactionId, transId);
    });

    test('MoMo IPN Idempotency: Gửi lặp lại cùng một Webhook không gây duplicate side-effects', async () => {
      const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
      const orderNumber = `DH-20260920-${suffix}`;
      const customerId = `cust-${crypto.randomUUID().slice(0, 8)}`;
      const totalAmount = 600000;

      // 1. Tạo đơn hàng
      const order = await prisma.order.create({
        data: {
          orderNumber,
          customerId,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          paymentMethod: PaymentMethod.MOMO,
          subtotal: totalAmount,
          totalAmount: totalAmount,
        },
      });
      testOrderIds.push(order.id);

      await paymentsService.createPaymentRecord(
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          amount: totalAmount,
          customerId,
        },
        PaymentMethod.MOMO,
      );

      // 2. Tạo IPN payload
      const config = momoProvider.getConfig();
      const transId = `MOMO_TX_IDEM_${Date.now()}`;
      const requestId = `${orderNumber}_req`;
      const responseTime = Date.now();
      const resultCode = 0;
      const message = 'Thành công';
      const rawSignature = `accessKey=${config.accessKey}&amount=${totalAmount}&extraData=&message=${message}&orderId=${orderNumber}&orderInfo=Thanh toan&orderType=momo_wallet&partnerCode=${config.partnerCode}&payType=qr&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
      const signature = momoProvider.createHmacSignature(rawSignature);

      const ipnPayload = {
        partnerCode: config.partnerCode,
        orderId: orderNumber,
        requestId,
        amount: totalAmount,
        orderInfo: 'Thanh toan',
        orderType: 'momo_wallet',
        transId,
        resultCode,
        message,
        payType: 'qr',
        responseTime,
        extraData: '',
        signature,
      };

      // 3. Gửi Webhook lần 1 -> Thành công
      const res1 = await paymentsService.handlePaymentWebhook(
        'MOMO',
        {},
        ipnPayload,
      );
      assert.equal(res1.success, true);

      // 4. Gửi Webhook lần 2 với cùng dữ liệu -> Phải xử lý Idempotent
      const res2 = await paymentsService.handlePaymentWebhook(
        'MOMO',
        {},
        ipnPayload,
      );
      assert.equal(res2.success, true);
      assert.match(res2.message, /Idempotent/i);

      // 5. Số lượng transactions không bị nhân đôi một cách vô nghĩa
      const transactions = await prisma.paymentTransaction.findMany({
        where: { orderId: order.id },
      });
      assert.equal(transactions.length, 2); // 1 PENDING ban đầu + 1 SUCCESS từ lần gọi 1
    });
  });
});
