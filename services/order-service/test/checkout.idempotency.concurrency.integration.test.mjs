import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { PrismaService as OrderPrismaService } from '../dist/prisma/prisma.service.js';
import { OrdersService } from '../dist/orders/orders.service.js';
import { CouponsService } from '../dist/coupons/coupons.service.js';
import { ShippingService } from '../dist/shipping/shipping.service.js';
import { CartService } from '../dist/cart/cart.service.js';
import { PaymentsService } from '../dist/payments/payments.service.js';
import { CodPaymentProvider } from '../dist/payments/providers/cod-payment.provider.js';
import { BankTransferPaymentProvider } from '../dist/payments/providers/bank-transfer-payment.provider.js';
import { CompensationService } from '../dist/compensation/compensation.service.js';
import { CheckoutService, computeRequestHash } from '../dist/checkout/checkout.service.js';

// Real Inventory Service from inventory-service dist
import { PrismaService as InventoryPrismaService } from '../../inventory-service/dist/prisma/prisma.service.js';
import { InventoryService } from '../../inventory-service/dist/inventory/inventory.service.js';

// ============================================================================
// SAFETY GUARD: Section 9 - Test Database Safety
// ============================================================================
const TEST_ORDER_DB_URL =
  process.env.ORDER_DATABASE_URL ||
  'mysql://phanbon_user:phanbon_secret@127.0.0.1:3307/test_order_db';
const TEST_INVENTORY_DB_URL =
  process.env.INVENTORY_DATABASE_URL ||
  'mysql://phanbon_user:phanbon_secret@127.0.0.1:3307/test_inventory_db';

if (!TEST_ORDER_DB_URL.includes('test_order_db') || !TEST_INVENTORY_DB_URL.includes('test_inventory_db')) {
  throw new Error('[FATAL] Safety Check Failed: Integration tests MUST run on test_* databases.');
}

process.env.NODE_ENV = 'test';
process.env.INTERNAL_SERVICE_SECRET =
  process.env.INTERNAL_SERVICE_SECRET || 'your_internal_service_mesh_shared_secret_2026';
process.env.ORDER_DATABASE_URL = TEST_ORDER_DB_URL;
process.env.INVENTORY_DATABASE_URL = TEST_INVENTORY_DB_URL;

describe('Phase 1.2, 1.3, 1.4 — Checkout & Idempotency Integration Tests (Real MySQL)', () => {
  let orderPrisma;
  let invPrisma;
  let inventoryService;
  let checkoutService;
  let compensationService;
  let originalFetch;

  const mockCatalog = new Map();
  const mockAddresses = new Map();

  before(async () => {
    orderPrisma = new OrderPrismaService();
    invPrisma = new InventoryPrismaService();
    await orderPrisma.$connect();
    await invPrisma.$connect();

    inventoryService = new InventoryService(invPrisma);

    const ordersService = new OrdersService(orderPrisma);
    const couponsService = new CouponsService(orderPrisma);
    const shippingService = new ShippingService();
    const cartService = new CartService(orderPrisma);
    const codProvider = new CodPaymentProvider();
    const bankTransferProvider = new BankTransferPaymentProvider();
    const paymentsService = new PaymentsService(orderPrisma, codProvider, bankTransferProvider);
    compensationService = new CompensationService(orderPrisma);

    checkoutService = new CheckoutService(
      orderPrisma,
      ordersService,
      couponsService,
      shippingService,
      cartService,
      paymentsService,
      compensationService,
    );

    // Intercept network calls to Product, Customer, and Inventory Services
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options = {}) => {
      const urlStr = String(url);

      // 1. Mock Product Service
      if (urlStr.includes('/api/v1/products/')) {
        const productId = urlStr.split('/api/v1/products/')[1]?.split('?')[0];
        const product = mockCatalog.get(productId);
        if (!product) {
          return new Response(JSON.stringify({ success: false, message: 'Not found' }), {
            status: 404,
          });
        }
        return new Response(JSON.stringify({ success: true, data: product }), { status: 200 });
      }

      // 2. Mock Customer Service (Address verification)
      if (urlStr.includes('/internal/v1/customers/')) {
        const parts = urlStr.split('/addresses/');
        const addressId = parts[1]?.split('?')[0];
        const addr = mockAddresses.get(addressId);
        if (!addr) {
          return new Response(JSON.stringify({ success: false, message: 'Address not found' }), {
            status: 404,
          });
        }
        return new Response(JSON.stringify({ success: true, data: addr }), { status: 200 });
      }

      // 3. Real Inventory Service Forwarding (Preserving network boundary contract)
      if (urlStr.includes('/internal/v1/inventory/reserve')) {
        const body = JSON.parse(options.body || '{}');
        try {
          const res = await inventoryService.reserve(body, options.headers?.['X-Request-Id']);
          return new Response(JSON.stringify(res), { status: 200 });
        } catch (err) {
          const status = err.status || 409;
          return new Response(JSON.stringify({ success: false, message: err.message }), { status });
        }
      }

      if (urlStr.includes('/internal/v1/inventory/release')) {
        const body = JSON.parse(options.body || '{}');
        try {
          const res = await inventoryService.release(body, options.headers?.['X-Request-Id']);
          return new Response(JSON.stringify(res), { status: 200 });
        } catch (err) {
          const status = err.status || 400;
          return new Response(JSON.stringify({ success: false, message: err.message }), { status });
        }
      }

      return originalFetch(url, options);
    };
  });

  after(async () => {
    globalThis.fetch = originalFetch;
    if (compensationService) compensationService.onModuleDestroy();
    if (orderPrisma) await orderPrisma.$disconnect();
    if (invPrisma) await invPrisma.$disconnect();
  });

  beforeEach(async () => {
    // Clear order DB tables
    await orderPrisma.idempotencyRecord.deleteMany({});
    await orderPrisma.compensationTask.deleteMany({});
    await orderPrisma.paymentRecord.deleteMany({});
    await orderPrisma.orderStatusHistory.deleteMany({});
    await orderPrisma.orderShippingAddress.deleteMany({});
    await orderPrisma.orderItem.deleteMany({});
    await orderPrisma.order.deleteMany({});

    // Clear inventory DB tables
    await invPrisma.inventoryMovement.deleteMany({});
    await invPrisma.inventoryReservation.deleteMany({});
    await invPrisma.inventory.deleteMany({});

    mockCatalog.clear();
    mockAddresses.clear();
  });

  it('1.2 Idempotency concurrency: 10 concurrent requests with same key -> 1 Order, 1 Reservation, exact stock', async () => {
    const customerId = `cust-${crypto.randomUUID()}`;
    const productId = `prod-${crypto.randomUUID()}`;
    const variantId = `var-${crypto.randomUUID()}`;
    const idempotencyKey = `idem-checkout-${crypto.randomUUID()}`;

    // Seed mock product catalog
    mockCatalog.set(productId, {
      id: productId,
      name: 'Phân Bón NPK Cao Cấp',
      status: 'ACTIVE',
      variants: [
        {
          id: variantId,
          sku: 'NPK-50KG',
          price: 450000,
          packageSize: 'Bao 50kg',
          status: 'ACTIVE',
        },
      ],
    });

    // Seed real MySQL inventory: stock=5, reserved=0
    await invPrisma.inventory.create({
      data: {
        productId,
        variantId,
        stockQuantity: 5,
        reservedQuantity: 0,
      },
    });

    const checkoutPayload = {
      items: [
        {
          productId,
          variantId,
          quantity: 2,
        },
      ],
      shippingAddress: {
        recipientName: 'Nguyễn Văn Nông',
        phone: '0912345678',
        provinceCode: '80', // Long An
        provinceName: 'Long An',
        districtCode: '801',
        districtName: 'Bến Lức',
        wardCode: '80101',
        wardName: 'Thị trấn Bến Lức',
        addressLine: '123 Đường Tỉnh Lộ 824',
      },
      paymentMethod: 'COD',
    };

    // Bắn đồng thời 10 checkout requests với cùng idempotencyKey
    const CONCURRENCY = 10;
    const checkoutRequests = Array.from({ length: CONCURRENCY }, () =>
      checkoutService.processCheckout(customerId, checkoutPayload, idempotencyKey),
    );

    const responses = await Promise.all(checkoutRequests);

    // 1. Xác minh tất cả 10 callers đều nhận được kết quả thành công
    assert.strictEqual(responses.length, CONCURRENCY);
    const firstOrderId = responses[0].orderId;
    assert.ok(firstOrderId, 'orderId phải tồn tại');

    // Tất cả 10 request phải trả về CÙNG một orderId và orderNumber
    for (const res of responses) {
      assert.strictEqual(res.orderId, firstOrderId);
      assert.strictEqual(res.orderNumber, responses[0].orderNumber);
      assert.strictEqual(res.totalAmount, responses[0].totalAmount);
    }

    // 2. Kiểm tra Database order_db thật: CHỈ CÓ ĐÚNG 1 ORDER ĐƯỢC TẠO
    const ordersInDb = await orderPrisma.order.findMany({});
    assert.strictEqual(
      ordersInDb.length,
      1,
      `Chỉ được tạo duy nhất 1 Order trong order_db, thực tế: ${ordersInDb.length}`,
    );
    assert.strictEqual(ordersInDb[0].id, firstOrderId);

    // 3. Kiểm tra Idempotency Record
    const idemRecords = await orderPrisma.idempotencyRecord.findMany({});
    assert.strictEqual(idemRecords.length, 1);
    assert.strictEqual(idemRecords[0].status, 'COMPLETED');
    assert.strictEqual(idemRecords[0].orderId, firstOrderId);

    // 4. KIỂM TRA SIDE EFFECTS TẠI INVENTORY_DB THẬT:
    // Không được chỉ kiểm tra orders.count === 1 mà bỏ qua Inventory
    const invInDb = await invPrisma.inventory.findUnique({
      where: { variantId },
    });
    assert.ok(invInDb);
    assert.strictEqual(
      invInDb.stockQuantity,
      5,
      'stockQuantity phải giữ nguyên 5 khi mới tạm giữ',
    );
    assert.strictEqual(
      invInDb.reservedQuantity,
      2,
      `reservedQuantity phải là 2 (tương ứng với duy nhất 1 đơn hàng đặt 2 bao), thực tế: ${invInDb.reservedQuantity}`,
    );

    // Kiểm tra số lượng bản ghi reservation tại inventory_db: chỉ đúng 1 bản ghi
    const reservationsInDb = await invPrisma.inventoryReservation.findMany({
      where: { variantId },
    });
    assert.strictEqual(
      reservationsInDb.length,
      1,
      'Chỉ được tạo duy nhất 1 bản ghi reservation trong inventory_db',
    );
    assert.strictEqual(reservationsInDb[0].quantity, 2);
    assert.strictEqual(reservationsInDb[0].status, 'ACTIVE');
  });

  it('1.3 Same key — different body: Request thứ 2 với body khác phải bị từ chối với 409 Conflict', async () => {
    const customerId = `cust-${crypto.randomUUID()}`;
    const productId = `prod-${crypto.randomUUID()}`;
    const variantId1 = `var1-${crypto.randomUUID()}`;
    const variantId2 = `var2-${crypto.randomUUID()}`;
    const idempotencyKey = `idem-conflict-${crypto.randomUUID()}`;

    mockCatalog.set(productId, {
      id: productId,
      name: 'Phân Bón Hữu Cơ Sinh Học',
      status: 'ACTIVE',
      variants: [
        { id: variantId1, sku: 'HC-25KG', price: 200000, packageSize: '25kg', status: 'ACTIVE' },
        { id: variantId2, sku: 'HC-50KG', price: 380000, packageSize: '50kg', status: 'ACTIVE' },
      ],
    });

    await invPrisma.inventory.createMany({
      data: [
        { productId, variantId: variantId1, stockQuantity: 10, reservedQuantity: 0 },
        { productId, variantId: variantId2, stockQuantity: 10, reservedQuantity: 0 },
      ],
    });

    const payloadA = {
      items: [{ productId, variantId: variantId1, quantity: 1 }],
      shippingAddress: {
        recipientName: 'Khách Hàng A',
        phone: '0901111111',
        provinceCode: '80',
        provinceName: 'Long An',
        districtCode: '801',
        districtName: 'Bến Lức',
        wardCode: '80101',
        wardName: 'Thị trấn Bến Lức',
        addressLine: 'Ấp 1',
      },
      paymentMethod: 'COD',
    };

    const payloadB = {
      items: [{ productId, variantId: variantId2, quantity: 2 }], // Payload khác biệt
      shippingAddress: {
        recipientName: 'Khách Hàng B (Payload Khác)',
        phone: '0902222222',
        provinceCode: '82',
        provinceName: 'Tiền Giang',
        districtCode: '821',
        districtName: 'Châu Thành',
        wardCode: '82101',
        wardName: 'Thị trấn Tân Hiệp',
        addressLine: 'Ấp 2',
      },
      paymentMethod: 'BANK_TRANSFER',
    };

    // 1. Request A hoàn tất thành công
    const resA = await checkoutService.processCheckout(customerId, payloadA, idempotencyKey);
    assert.ok(resA.orderId);

    // 2. Request B gửi cùng key nhưng khác payload -> Bắt buộc bị từ chối
    await assert.rejects(
      async () => {
        await checkoutService.processCheckout(customerId, payloadB, idempotencyKey);
      },
      (err) => {
        assert.strictEqual(err.status, 409);
        const code = err.response?.code;
        assert.strictEqual(code, 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
        return true;
      },
      'Request B với payload khác phải bị từ chối với mã IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',
    );
  });

  it('1.4 Crash/retry idempotency: Gặp lỗi FAILED trong lần chạy đầu, retry an toàn không tạo side-effect kép', async () => {
    const customerId = `cust-${crypto.randomUUID()}`;
    const productId = `prod-${crypto.randomUUID()}`;
    const variantId = `var-${crypto.randomUUID()}`;
    const idempotencyKey = `idem-retry-${crypto.randomUUID()}`;

    mockCatalog.set(productId, {
      id: productId,
      name: 'Phân Ure Hạt Đục',
      status: 'ACTIVE',
      variants: [
        { id: variantId, sku: 'URE-50KG', price: 600000, packageSize: '50kg', status: 'ACTIVE' },
      ],
    });

    await invPrisma.inventory.create({
      data: {
        productId,
        variantId,
        stockQuantity: 10,
        reservedQuantity: 0,
      },
    });

    const checkoutPayload = {
      items: [{ productId, variantId, quantity: 1 }],
      shippingAddress: {
        recipientName: 'Bác Ba Phi',
        phone: '0988888888',
        provinceCode: '80',
        provinceName: 'Long An',
        districtCode: '801',
        districtName: 'Bến Lức',
        wardCode: '80101',
        wardName: 'Thị trấn Bến Lức',
        addressLine: 'Vườn Chanh Bến Lức',
      },
      paymentMethod: 'COD',
    };

    // Mô phỏng: Giả lập lần gọi đầu tiên bị FAILED (ví dụ do database gián đoạn hoặc lỗi coupon)
    // Tạo sẵn IdempotencyRecord trạng thái FAILED
    const requestHash = computeRequestHash(checkoutPayload);
    await orderPrisma.idempotencyRecord.create({
      data: {
        customerId,
        idempotencyKey,
        requestPath: '/api/v1/checkout',
        requestHash,
        status: 'FAILED',
        statusCode: 500,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });

    // Client retry cùng Idempotency-Key
    const res = await checkoutService.processCheckout(customerId, checkoutPayload, idempotencyKey);
    assert.ok(res.orderId);

    // Kiểm tra order_db: đúng 1 order
    const orders = await orderPrisma.order.findMany({ where: { customerId } });
    assert.strictEqual(orders.length, 1);

    // Kiểm tra inventory_db: reservedQuantity đúng bằng 1
    const inv = await invPrisma.inventory.findUnique({ where: { variantId } });
    assert.strictEqual(inv.reservedQuantity, 1);
  });
});
