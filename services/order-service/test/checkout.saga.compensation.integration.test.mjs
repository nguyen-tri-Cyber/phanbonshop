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
import { CheckoutService } from '../dist/checkout/checkout.service.js';
import { CompensationTaskStatus } from '../generated/client/index.js';

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

describe('Phase 1.5 — Saga Compensation Integration Tests (Real MySQL)', () => {
  let orderPrisma;
  let invPrisma;
  let inventoryService;
  let checkoutService;
  let compensationService;
  let originalFetch;

  // Test control flags
  let simulateReleaseFailure = false;
  let failOrderCreation = false;

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

    // Intercept $transaction on orderPrisma when failOrderCreation is set
    const originalTransaction = orderPrisma.$transaction.bind(orderPrisma);
    orderPrisma.$transaction = async (fn, ...args) => {
      if (failOrderCreation) {
        throw new Error('SIMULATED_ORDER_TRANSACTION_FAILURE: Crash after inventory reservation');
      }
      return originalTransaction(fn, ...args);
    };

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

      // 3. Real Inventory Service Forwarding
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
        if (simulateReleaseFailure) {
          return new Response(
            JSON.stringify({ success: false, message: 'Inventory service network down' }),
            { status: 503 },
          );
        }
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
    simulateReleaseFailure = false;
    failOrderCreation = false;
    mockCatalog.clear();
    mockAddresses.clear();

    // Clean databases
    await orderPrisma.compensationTask.deleteMany({});
    await orderPrisma.paymentRecord.deleteMany({});
    await orderPrisma.orderItem.deleteMany({});
    await orderPrisma.orderShippingAddress.deleteMany({});
    await orderPrisma.orderStatusHistory.deleteMany({});
    await orderPrisma.idempotencyRecord.deleteMany({});
    await orderPrisma.order.deleteMany({});

    await invPrisma.inventoryMovement.deleteMany({});
    await invPrisma.inventoryReservation.deleteMany({});
    await invPrisma.inventory.deleteMany({});
  });

  it('1.5a: Reserve SUCCESS + Order creation FAIL -> Immediate release SUCCESS', async () => {
    const productId = `prod-saga-15a-${crypto.randomUUID().slice(0, 8)}`;
    const variantId = `var-saga-15a-${crypto.randomUUID().slice(0, 8)}`;
    const customerId = `cust-${crypto.randomUUID().slice(0, 8)}`;
    const addressId = `addr-${crypto.randomUUID().slice(0, 8)}`;
    const idempotencyKey = `idem-saga-15a-${crypto.randomUUID()}`;

    // 1. Setup inventory: 10 stock, 0 reserved
    await invPrisma.inventory.create({
      data: {
        productId,
        variantId,
        stockQuantity: 10,
        reservedQuantity: 0,
        reorderLevel: 2,
      },
    });

    // 2. Setup mock catalog
    mockCatalog.set(productId, {
      id: productId,
      name: 'Phân Bón NPK Saga 15a',
      status: 'ACTIVE',
      variants: [
        {
          id: variantId,
          sku: 'NPK-SAGA-15A',
          packageSize: 'Bao 25kg',
          price: 250000,
          status: 'ACTIVE',
        },
      ],
    });

    // 3. Setup mock address
    mockAddresses.set(addressId, {
      recipientName: 'Trần Văn Nông',
      phone: '0901234567',
      provinceCode: 'VN-57',
      provinceName: 'Bình Thuận',
      districtCode: 'VN-57-01',
      districtName: 'Hàm Thuận Nam',
      wardCode: 'VN-57-01-01',
      wardName: 'Hàm Mỹ',
      addressLine: 'Thôn Phú Mỹ',
    });

    // 4. Configure failure: Order creation transaction fails, but immediate release succeeds
    failOrderCreation = true;
    simulateReleaseFailure = false;

    const checkoutPayload = {
      items: [{ productId, variantId, quantity: 2 }],
      addressId,
      paymentMethod: 'COD',
    };

    // 5. Execute checkout -> should reject due to transaction failure
    await assert.rejects(
      async () => {
        await checkoutService.processCheckout(customerId, checkoutPayload, idempotencyKey);
      },
      (err) => {
        assert.match(err.message, /SIMULATED_ORDER_TRANSACTION_FAILURE/);
        return true;
      },
      'Expected checkout to fail at order creation step',
    );

    // 6. Verify in test_inventory_db:
    // - Reservation status must be 'RELEASED'
    // - reservedQuantity must be restored back to 0
    // - stockQuantity must remain 10
    const expectedResId = `res-${idempotencyKey}-${variantId}`;
    const reservation = await invPrisma.inventoryReservation.findUnique({
      where: { reservationId: expectedResId },
    });
    assert.ok(reservation, 'Reservation record must exist in inventory_reservations');
    assert.equal(reservation.status, 'RELEASED', 'Reservation must be RELEASED by immediate compensation');

    const inv = await invPrisma.inventory.findUnique({
      where: { variantId },
    });
    assert.equal(inv.stockQuantity, 10, 'Stock quantity must remain 10');
    assert.equal(inv.reservedQuantity, 0, 'Reserved quantity must be back to 0');

    // 7. Verify in test_order_db:
    // - No order was created
    // - Idempotency record is FAILED
    // - No pending CompensationTask was created because immediate release succeeded
    const orderCount = await orderPrisma.order.count({});
    assert.equal(orderCount, 0, 'No order should be created');

    const taskCount = await orderPrisma.compensationTask.count({});
    assert.equal(taskCount, 0, 'No compensation task needed since immediate release succeeded');

    const idem = await orderPrisma.idempotencyRecord.findUnique({
      where: {
        customerId_idempotencyKey: {
          customerId,
          idempotencyKey,
        },
      },
    });
    assert.ok(idem, 'Idempotency record should exist');
    assert.equal(idem.status, 'FAILED', 'Idempotency record should transition to FAILED');
  });

  it('1.5b: Reserve SUCCESS + Order creation FAIL + Release FAIL -> Compensation Task PENDING -> Worker processes to COMPLETED', async () => {
    const productId = `prod-saga-15b-${crypto.randomUUID().slice(0, 8)}`;
    const variantId = `var-saga-15b-${crypto.randomUUID().slice(0, 8)}`;
    const customerId = `cust-${crypto.randomUUID().slice(0, 8)}`;
    const addressId = `addr-${crypto.randomUUID().slice(0, 8)}`;
    const idempotencyKey = `idem-saga-15b-${crypto.randomUUID()}`;

    // 1. Setup inventory: 10 stock, 0 reserved
    await invPrisma.inventory.create({
      data: {
        productId,
        variantId,
        stockQuantity: 10,
        reservedQuantity: 0,
        reorderLevel: 2,
      },
    });

    // 2. Setup mock catalog & address
    mockCatalog.set(productId, {
      id: productId,
      name: 'Phân Bón Hữu Cơ Saga 15b',
      status: 'ACTIVE',
      variants: [
        {
          id: variantId,
          sku: 'ORG-SAGA-15B',
          packageSize: 'Bao 50kg',
          price: 450000,
          status: 'ACTIVE',
        },
      ],
    });

    mockAddresses.set(addressId, {
      recipientName: 'Lê Nông Dân',
      phone: '0912345678',
      provinceCode: 'VN-57',
      provinceName: 'Bình Thuận',
      districtCode: 'VN-57-02',
      districtName: 'Bắc Bình',
      wardCode: 'VN-57-02-01',
      wardName: 'Chợ Lầu',
      addressLine: 'Khu phố 1',
    });

    // 3. Configure failure: Order creation transaction fails AND immediate release fails (network 503)
    failOrderCreation = true;
    simulateReleaseFailure = true;

    const checkoutPayload = {
      items: [{ productId, variantId, quantity: 3 }],
      addressId,
      paymentMethod: 'COD',
    };

    // 4. Execute checkout -> should reject due to transaction failure
    await assert.rejects(
      async () => {
        await checkoutService.processCheckout(customerId, checkoutPayload, idempotencyKey);
      },
      (err) => {
        assert.match(err.message, /SIMULATED_ORDER_TRANSACTION_FAILURE/);
        return true;
      },
      'Expected checkout to fail at order creation step',
    );

    const expectedResId = `res-${idempotencyKey}-${variantId}`;

    // 5. Verify state immediately after crash:
    // In test_inventory_db:
    // - Reservation is STILL ACTIVE (because release network failed)
    // - reservedQuantity is 3
    const reservationBeforeRecovery = await invPrisma.inventoryReservation.findUnique({
      where: { reservationId: expectedResId },
    });
    assert.ok(reservationBeforeRecovery, 'Reservation record must exist');
    assert.equal(
      reservationBeforeRecovery.status,
      'ACTIVE',
      'Reservation must remain ACTIVE since immediate release failed',
    );

    const invBeforeRecovery = await invPrisma.inventory.findUnique({
      where: { variantId },
    });
    assert.equal(invBeforeRecovery.reservedQuantity, 3, 'Reserved quantity is still held (3)');

    // In test_order_db:
    // - CompensationTask was persisted with status PENDING
    const tasks = await orderPrisma.compensationTask.findMany({});
    assert.equal(tasks.length, 1, 'Exactly 1 CompensationTask must be persisted in DB');
    const task = tasks[0];
    assert.equal(task.status, CompensationTaskStatus.PENDING, 'Task status must be PENDING');
    const payload = JSON.parse(task.payload);
    assert.equal(payload.reservationId, expectedResId, 'Task payload must contain reservationId');

    // 6. Now simulate Inventory Service RECOVERY
    simulateReleaseFailure = false;

    // 7. Trigger the Compensation Worker Processor
    const processResult = await compensationService.processPendingTasks();
    assert.equal(processResult.processed, 1, 'Worker should process 1 task');
    assert.equal(processResult.succeeded, 1, 'Worker should succeed on 1 task');
    assert.equal(processResult.failed, 0, 'Worker should have 0 failed tasks');

    // 8. Verify post-recovery state:
    // In test_order_db:
    // - CompensationTask status transitioned to COMPLETED
    const completedTask = await orderPrisma.compensationTask.findUnique({
      where: { id: task.id },
    });
    assert.equal(completedTask.status, CompensationTaskStatus.COMPLETED, 'Task must now be COMPLETED');
    assert.ok(completedTask.completedAt, 'completedAt must be populated');
    assert.equal(completedTask.lastError, null, 'lastError must be null');

    // In test_inventory_db:
    // - Reservation transitioned to RELEASED
    // - reservedQuantity is restored back to 0
    const reservationAfterRecovery = await invPrisma.inventoryReservation.findUnique({
      where: { reservationId: expectedResId },
    });
    assert.equal(
      reservationAfterRecovery.status,
      'RELEASED',
      'Reservation must now be RELEASED by the compensation worker',
    );

    const invAfterRecovery = await invPrisma.inventory.findUnique({
      where: { variantId },
    });
    assert.equal(invAfterRecovery.reservedQuantity, 0, 'Reserved quantity must be back to 0');
    assert.equal(invAfterRecovery.stockQuantity, 10, 'Stock quantity must remain 10');
  });
});
