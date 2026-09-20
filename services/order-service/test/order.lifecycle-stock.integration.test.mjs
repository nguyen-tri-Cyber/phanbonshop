import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { PrismaService as OrderPrismaService } from '../dist/prisma/prisma.service.js';
import { OrdersService } from '../dist/orders/orders.service.js';
import { CompensationService } from '../dist/compensation/compensation.service.js';
import { OrderStatus, PaymentStatus, PaymentMethod, CompensationTaskStatus } from '../generated/client/index.js';

import { PrismaService as InventoryPrismaService } from '../../inventory-service/dist/prisma/prisma.service.js';
import { InventoryService } from '../../inventory-service/dist/inventory/inventory.service.js';
import { ReservationStatus } from '../../inventory-service/generated/client/index.js';

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

describe('Phase 2.5 — Order Status Lifecycle & Inventory Synchronization (Real MySQL)', () => {
  let orderPrisma;
  let invPrisma;
  let inventoryService;
  let ordersService;
  let compensationService;
  let originalFetch;
  let simulateInventoryFailure = false;

  before(async () => {
    orderPrisma = new OrderPrismaService();
    invPrisma = new InventoryPrismaService();
    await orderPrisma.$connect();
    await invPrisma.$connect();

    inventoryService = new InventoryService(invPrisma);
    compensationService = new CompensationService(orderPrisma);
    ordersService = new OrdersService(orderPrisma, compensationService);

    // Forward internal HTTP calls between order-service and inventory-service
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options = {}) => {
      const urlStr = String(url);

      if (urlStr.includes('/internal/v1/inventory/commit')) {
        if (simulateInventoryFailure) {
          return new Response(JSON.stringify({ success: false, message: 'Simulated downstream error' }), {
            status: 503,
          });
        }
        const body = JSON.parse(options.body || '{}');
        try {
          const res = await inventoryService.commit(body, options.headers?.['X-Request-Id']);
          return new Response(JSON.stringify(res), { status: 200 });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, message: err.message }), {
            status: err.status || 400,
          });
        }
      }

      if (urlStr.includes('/internal/v1/inventory/release') || urlStr.includes('/internal/v1/inventory/rollback')) {
        if (simulateInventoryFailure) {
          return new Response(JSON.stringify({ success: false, message: 'Simulated downstream error' }), {
            status: 503,
          });
        }
        const body = JSON.parse(options.body || '{}');
        try {
          const res = await inventoryService.rollbackOrRelease(body, options.headers?.['X-Request-Id']);
          return new Response(JSON.stringify(res), { status: 200 });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, message: err.message }), {
            status: err.status || 400,
          });
        }
      }

      return originalFetch(url, options);
    };
  });

  after(async () => {
    globalThis.fetch = originalFetch;
    if (compensationService) compensationService.onModuleDestroy();
    if (inventoryService) inventoryService.onModuleDestroy();
    if (orderPrisma) await orderPrisma.$disconnect();
    if (invPrisma) await invPrisma.$disconnect();
  });

  beforeEach(async () => {
    simulateInventoryFailure = false;

    await orderPrisma.compensationTask.deleteMany({});
    await orderPrisma.orderStatusHistory.deleteMany({});
    await orderPrisma.orderItem.deleteMany({});
    await orderPrisma.orderShippingAddress.deleteMany({});
    await orderPrisma.order.deleteMany({});

    await invPrisma.inventoryMovement.deleteMany({});
    await invPrisma.inventoryReservation.deleteMany({});
    await invPrisma.inventory.deleteMany({});
  });

  it('2.5.1: PENDING -> CONFIRMED commits inventory and deducts physical stock', async () => {
    const productId = `prod-conf-${crypto.randomUUID().slice(0, 8)}`;
    const variantId = `var-conf-${crypto.randomUUID().slice(0, 8)}`;
    const customerId = `cust-${crypto.randomUUID().slice(0, 8)}`;
    const reservationId = `res-order-${crypto.randomUUID().slice(0, 8)}`;
    const itemReservationId = `${reservationId}-${variantId}`;

    // 1. Khởi tạo tồn kho ban đầu: 10 cái, 2 tạm giữ (giả lập bước Checkout đã tạo reservation)
    await invPrisma.inventory.create({
      data: {
        productId,
        variantId,
        stockQuantity: 10,
        reservedQuantity: 2,
        reorderLevel: 2,
      },
    });

    await invPrisma.inventoryReservation.create({
      data: {
        reservationId: itemReservationId,
        variantId,
        quantity: 2,
        referenceType: 'ORDER',
        referenceId: reservationId,
        status: ReservationStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    // 2. Tạo đơn hàng PENDING trong order_db
    const orderNumber = ordersService.generateOrderNumber();
    const order = await orderPrisma.order.create({
      data: {
        orderNumber,
        customerId,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.COD,
        subtotal: 500000,
        discountAmount: 0,
        shippingFee: 30000,
        totalAmount: 530000,
        reservationId,
        items: {
          create: [
            {
              productId,
              variantId,
              productName: 'Phân Bón NPK Test',
              variantName: 'Bao 50kg',
              sku: 'NPK-TEST-50KG',
              unitPrice: 250000,
              quantity: 2,
              lineTotal: 500000,
            },
          ],
        },
      },
      include: { items: true },
    });

    // 3. Admin / Hệ thống xác nhận đơn hàng: PENDING -> CONFIRMED
    const updatedOrder = await ordersService.updateStatus(order.id, OrderStatus.CONFIRMED, 'Nhân viên xác nhận đơn');
    assert.equal(updatedOrder.status, OrderStatus.CONFIRMED);

    // 4. Kiểm tra tác động tồn kho trong test_inventory_db:
    // - stockQuantity phải giảm từ 10 xuống 8
    // - reservedQuantity phải giảm từ 2 xuống 0
    // - availableQuantity phải giữ nguyên 8 (8 - 0 = 8)
    const inv = await invPrisma.inventory.findUnique({
      where: { variantId },
    });
    assert.equal(inv.stockQuantity, 8, 'Physical stock must be decremented to 8');
    assert.equal(inv.reservedQuantity, 0, 'Reserved quantity must be decremented to 0');
    assert.equal(inv.stockQuantity - inv.reservedQuantity, 8, 'Available stock remains 8');

    // - Reservation status phải chuyển sang COMMITTED
    const resRecord = await invPrisma.inventoryReservation.findUnique({
      where: { reservationId: itemReservationId },
    });
    assert.equal(resRecord.status, ReservationStatus.COMMITTED, 'Reservation must be COMMITTED');
  });

  it('2.5.2: CONFIRMED -> CANCELLED rolls back stock (restocks physical inventory)', async () => {
    const productId = `prod-cancel-conf-${crypto.randomUUID().slice(0, 8)}`;
    const variantId = `var-cancel-conf-${crypto.randomUUID().slice(0, 8)}`;
    const customerId = `cust-${crypto.randomUUID().slice(0, 8)}`;
    const reservationId = `res-cancel-conf-${crypto.randomUUID().slice(0, 8)}`;
    const itemReservationId = `${reservationId}-${variantId}`;

    // 1. Khởi tạo tồn kho sau khi đã commit đơn (stock=8, reserved=0)
    await invPrisma.inventory.create({
      data: {
        productId,
        variantId,
        stockQuantity: 8,
        reservedQuantity: 0,
        reorderLevel: 2,
      },
    });

    await invPrisma.inventoryReservation.create({
      data: {
        reservationId: itemReservationId,
        variantId,
        quantity: 2,
        referenceType: 'ORDER',
        referenceId: reservationId,
        status: ReservationStatus.COMMITTED,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    // 2. Tạo đơn CONFIRMED trong order_db
    const orderNumber = ordersService.generateOrderNumber();
    const order = await orderPrisma.order.create({
      data: {
        orderNumber,
        customerId,
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.COD,
        subtotal: 500000,
        discountAmount: 0,
        shippingFee: 30000,
        totalAmount: 530000,
        reservationId,
        items: {
          create: [
            {
              productId,
              variantId,
              productName: 'Phân Bón Hữu Cơ Test',
              variantName: 'Bao 25kg',
              sku: 'ORG-TEST-25KG',
              unitPrice: 250000,
              quantity: 2,
              lineTotal: 500000,
            },
          ],
        },
      },
      include: { items: true },
    });

    // 3. Hủy đơn hàng đã xác nhận: CONFIRMED -> CANCELLED
    const updatedOrder = await ordersService.updateStatus(order.id, OrderStatus.CANCELLED, 'Khách đổi ý hủy đơn');
    assert.equal(updatedOrder.status, OrderStatus.CANCELLED);

    // 4. Kiểm tra tồn kho vật lý trong test_inventory_db:
    // - stockQuantity phải được HOÀN TRẢ từ 8 về lại 10 (+2)
    // - reservedQuantity giữ nguyên 0
    // - availableQuantity trở về 10
    const inv = await invPrisma.inventory.findUnique({
      where: { variantId },
    });
    assert.equal(inv.stockQuantity, 10, 'Physical stock must be refunded back to 10');
    assert.equal(inv.reservedQuantity, 0);
    assert.equal(inv.stockQuantity - inv.reservedQuantity, 10);

    // - Reservation status chuyển sang RELEASED
    const resRecord = await invPrisma.inventoryReservation.findUnique({
      where: { reservationId: itemReservationId },
    });
    assert.equal(resRecord.status, ReservationStatus.RELEASED);
  });

  it('2.5.3: Downstream failure on cancellation persists CompensationTask for background retry', async () => {
    const productId = `prod-down-${crypto.randomUUID().slice(0, 8)}`;
    const variantId = `var-down-${crypto.randomUUID().slice(0, 8)}`;
    const customerId = `cust-${crypto.randomUUID().slice(0, 8)}`;
    const reservationId = `res-down-${crypto.randomUUID().slice(0, 8)}`;
    const itemReservationId = `${reservationId}-${variantId}`;

    // 1. Tạo đơn PENDING
    const orderNumber = ordersService.generateOrderNumber();
    const order = await orderPrisma.order.create({
      data: {
        orderNumber,
        customerId,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.COD,
        subtotal: 300000,
        discountAmount: 0,
        shippingFee: 30000,
        totalAmount: 330000,
        reservationId,
        items: {
          create: [
            {
              productId,
              variantId,
              productName: 'Phân Bón Vi Lượng',
              variantName: 'Chai 1L',
              sku: 'MIC-TEST-1L',
              unitPrice: 150000,
              quantity: 2,
              lineTotal: 300000,
            },
          ],
        },
      },
      include: { items: true },
    });

    // 2. Giả lập Inventory Service bị lỗi mạng (503) khi hủy đơn
    simulateInventoryFailure = true;

    // 3. Hủy đơn hàng -> cập nhật DB thành công, nhưng lệnh gọi release thất bại
    await ordersService.updateStatus(order.id, OrderStatus.CANCELLED, 'Hủy đơn khi downstream lỗi');

    // 4. Kiểm tra: Bắt buộc phải có 1 CompensationTask được tạo với status PENDING
    const tasks = await orderPrisma.compensationTask.findMany({});
    assert.equal(tasks.length, 1, 'Exactly 1 CompensationTask must be persisted in DB');
    assert.equal(tasks[0].status, CompensationTaskStatus.PENDING);
    const payload = JSON.parse(tasks[0].payload);
    assert.equal(payload.reservationId, itemReservationId);
  });
});
