import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Order Service Unit Tests', () => {
  // 1. Subtotal calculation
  function calculateSubtotal(items) {
    return items.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
  }

  // 2. Coupon discount calculation
  function calculateDiscount(coupon, subtotal) {
    if (!coupon || !coupon.enabled) return 0;
    if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) return 0;

    let discount = 0;
    if (coupon.type === 'PERCENTAGE') {
      discount = (subtotal * coupon.value) / 100;
      if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
        discount = coupon.maxDiscountAmount;
      }
    } else if (coupon.type === 'FIXED_AMOUNT') {
      discount = Math.min(subtotal, coupon.value);
    }
    return Math.round(discount);
  }

  // 3. Order state transitions validation
  const ALLOWED_TRANSITIONS = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['PACKING', 'CANCELLED'],
    PACKING: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['DELIVERED', 'RETURN_REQUESTED'],
    DELIVERED: ['COMPLETED', 'RETURN_REQUESTED'],
    COMPLETED: [],
    CANCELLED: [],
  };

  function canTransition(from, to) {
    const allowed = ALLOWED_TRANSITIONS[from] || [];
    return allowed.includes(to);
  }

  test('Subtotal correctly sums line items price x quantity', () => {
    const items = [
      { unitPrice: 150000, quantity: 2 }, // 300,000
      { unitPrice: 500000, quantity: 1 }, // 500,000
      { unitPrice: 80000, quantity: 3 },  // 240,000
    ];
    assert.strictEqual(calculateSubtotal(items), 1040000);
  });

  test('Percentage coupon calculates correct discount capped by maximumDiscount', () => {
    const coupon = {
      type: 'PERCENTAGE',
      value: 10, // 10%
      minOrderAmount: 200000,
      maxDiscountAmount: 50000,
      enabled: true,
    };

    // Subtotal 400,000 -> 10% is 40,000 (< 50,000 max) -> 40,000
    assert.strictEqual(calculateDiscount(coupon, 400000), 40000);

    // Subtotal 1,000,000 -> 10% is 100,000 (> 50,000 max) -> capped at 50,000
    assert.strictEqual(calculateDiscount(coupon, 1000000), 50000);

    // Subtotal 150,000 -> under minOrderAmount 200,000 -> 0
    assert.strictEqual(calculateDiscount(coupon, 150000), 0);
  });

  test('Fixed amount coupon caps at subtotal to prevent negative totals', () => {
    const coupon = {
      type: 'FIXED_AMOUNT',
      value: 50000,
      minOrderAmount: 0,
      enabled: true,
    };
    assert.strictEqual(calculateDiscount(coupon, 100000), 50000);
    assert.strictEqual(calculateDiscount(coupon, 30000), 30000);
  });

  test('Order state machine enforces sequential valid transitions', () => {
    assert.strictEqual(canTransition('PENDING', 'CONFIRMED'), true);
    assert.strictEqual(canTransition('PENDING', 'CANCELLED'), true);
    assert.strictEqual(canTransition('PENDING', 'COMPLETED'), false); // Cannot jump straight to COMPLETED

    assert.strictEqual(canTransition('CONFIRMED', 'PROCESSING'), true);
    assert.strictEqual(canTransition('PROCESSING', 'PACKING'), true);
    assert.strictEqual(canTransition('PACKING', 'SHIPPED'), true);
    assert.strictEqual(canTransition('SHIPPED', 'DELIVERED'), true);
    assert.strictEqual(canTransition('DELIVERED', 'COMPLETED'), true);

    assert.strictEqual(canTransition('COMPLETED', 'CANCELLED'), false); // Completed order cannot be cancelled
  });

  describe('Health & Readiness Probes (TASK-P5-01 / AUD-P2-001)', () => {
    test('checkHealth returns alive status without touching database', async () => {
      const { HealthController } = await import('../dist/health/health.controller.js');
      const throwingPrisma = {
        $queryRaw: () => {
          throw new Error('Should not touch DB in liveness probe!');
        },
      };

      const controller = new HealthController(throwingPrisma);
      const res = controller.checkHealth();

      assert.strictEqual(res.status, 'alive');
      assert.strictEqual(res.service, 'order-service');
      assert.ok(typeof res.uptime === 'number');
      assert.ok(res.timestamp);
    });

    test('checkReady returns ready status when database is healthy', async () => {
      const { HealthController } = await import('../dist/health/health.controller.js');
      const mockPrisma = {
        $queryRaw: async () => [{ 1: 1 }],
      };

      const controller = new HealthController(mockPrisma);
      const res = await controller.checkReady();

      assert.strictEqual(res.status, 'ready');
      assert.strictEqual(res.service, 'order-service');
      assert.strictEqual(res.checks.database, 'up');
    });

    test('checkReady throws ServiceUnavailableException (503) when database is down', async () => {
      const { HealthController } = await import('../dist/health/health.controller.js');
      const mockPrisma = {
        $queryRaw: async () => {
          throw new Error('ECONNREFUSED 127.0.0.1:3306');
        },
      };

      const controller = new HealthController(mockPrisma);
      await assert.rejects(
        async () => {
          await controller.checkReady();
        },
        (err) => {
          assert.strictEqual(err.status, 503);
          const response = err.getResponse();
          assert.strictEqual(response.status, 'not_ready');
          assert.strictEqual(response.checks.database, 'down');
          return true;
        },
      );
    });
  });

  describe('Order Cancellation & Coupon Rollback (TASK-BIZ-01)', () => {
    test('Cancelling an order deletes CouponUsage and decrements coupon usedCount', async () => {
      process.env.INTERNAL_SERVICE_SECRET = 'test-internal-secret-for-orders-service';
      const { OrdersService } = await import('../dist/orders/orders.service.js');

      let deletedCouponUsageId = null;
      let decrementedCouponId = null;
      let updatedOrderStatus = null;
      let updatedPaymentStatus = null;
      let paymentRecordStatus = null;

      const orderData = {
        id: 'order-coupon-1',
        orderNumber: 'DH-COUPON-001',
        customerId: 'customer-1',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        reservationId: null,
        items: [],
      };

      const mockTx = {
        paymentRecord: {
          updateMany: async ({ data }) => {
            paymentRecordStatus = data.status;
            return { count: 1 };
          },
        },
        paymentTransaction: {
          updateMany: async () => ({ count: 1 }),
        },
        couponUsage: {
          findMany: async ({ where }) => {
            if (where.orderId === 'order-coupon-1') {
              return [
                {
                  id: 'usage-1',
                  couponId: 'coupon-50k',
                  customerId: 'customer-1',
                  orderId: 'order-coupon-1',
                },
              ];
            }
            return [];
          },
          delete: async ({ where }) => {
            deletedCouponUsageId = where.id;
            return {};
          },
        },
        coupon: {
          updateMany: async ({ where }) => {
            if (where.id === 'coupon-50k') {
              decrementedCouponId = where.id;
            }
            return { count: 1 };
          },
        },
        order: {
          update: async ({ data }) => {
            updatedOrderStatus = data.status;
            updatedPaymentStatus = data.paymentStatus;
            return { ...orderData, ...data };
          },
        },
        orderStatusHistory: {
          create: async () => ({}),
        },
        auditLog: {
          create: async () => ({}),
        },
      };

      const mockPrisma = {
        order: {
          findFirst: async () => orderData,
          findUnique: async () => orderData,
        },
        $transaction: async (cb) => cb(mockTx),
      };

      const ordersService = new OrdersService(mockPrisma);
      await ordersService.cancelOrder('order-coupon-1', 'customer-1', 'Đổi ý không mua nữa');

      assert.strictEqual(updatedOrderStatus, 'CANCELLED');
      assert.strictEqual(updatedPaymentStatus, 'CANCELLED');
      assert.strictEqual(paymentRecordStatus, 'CANCELLED');
      assert.strictEqual(deletedCouponUsageId, 'usage-1');
      assert.strictEqual(decrementedCouponId, 'coupon-50k');
    });
  });

  describe('Order Return & Inventory Restock (TASK-BIZ-02)', () => {
    test('Updating status to RETURNED triggers releaseInventoryCompensation for restocking', async () => {
      process.env.INTERNAL_SERVICE_SECRET = 'test-internal-secret-for-orders-service';
      const { OrdersService } = await import('../dist/orders/orders.service.js');

      let compensationCalled = false;
      let compensationReason = '';
      let updatedOrderStatus = null;

      const orderData = {
        id: 'order-return-1',
        orderNumber: 'DH-RETURN-001',
        customerId: 'customer-1',
        status: 'RETURN_REQUESTED',
        paymentStatus: 'PAID',
        reservationId: 'res-return-1',
        items: [{ variantId: 'var-1' }],
      };

      const mockTx = {
        order: {
          update: async ({ data }) => {
            updatedOrderStatus = data.status;
            return { ...orderData, ...data };
          },
        },
        orderStatusHistory: { create: async () => ({}) },
        auditLog: { create: async () => ({}) },
      };

      const mockPrisma = {
        order: {
          findUnique: async () => orderData,
        },
        $transaction: async (cb) => cb(mockTx),
      };

      const ordersService = new OrdersService(mockPrisma);
      ordersService.releaseInventoryCompensation = async (resId, reason) => {
        compensationCalled = true;
        compensationReason = reason;
      };

      await ordersService.updateStatus('order-return-1', 'RETURNED', 'STAFF', 'Khách hàng gửi trả hàng');

      assert.strictEqual(updatedOrderStatus, 'RETURNED');
      assert.strictEqual(compensationCalled, true);
      assert.ok(compensationReason.includes('Khách trả hàng'));
    });
  });

  describe('Order Refund & Payment Synchronization (TASK-BIZ-03)', () => {
    test('Throws BadRequestException if attempting to REFUND an unpaid order', async () => {
      process.env.INTERNAL_SERVICE_SECRET = 'test-internal-secret-for-orders-service';
      const { OrdersService } = await import('../dist/orders/orders.service.js');

      const unpaidOrder = {
        id: 'order-unpaid-1',
        orderNumber: 'DH-UNPAID-001',
        customerId: 'customer-1',
        status: 'RETURNED',
        paymentStatus: 'PENDING',
        reservationId: null,
        items: [],
      };

      const mockPrisma = {
        order: {
          findUnique: async () => unpaidOrder,
        },
      };

      const ordersService = new OrdersService(mockPrisma);
      await assert.rejects(
        async () => {
          await ordersService.updateStatus('order-unpaid-1', 'REFUNDED', 'ADMIN', 'Hoàn tiền');
        },
        /Chỉ có thể hoàn tiền cho đơn hàng đã thanh toán thành công/,
      );
    });

    test('Updating status to REFUNDED syncs paymentStatus, paymentRecords, auditLog and rolls back coupon', async () => {
      process.env.INTERNAL_SERVICE_SECRET = 'test-internal-secret-for-orders-service';
      const { OrdersService } = await import('../dist/orders/orders.service.js');

      let updatedOrderStatus = null;
      let updatedPaymentStatus = null;
      let paymentRecordStatus = null;
      let paymentAuditLogEntry = null;
      let deletedCouponUsageId = null;
      let decrementedCouponId = null;

      const paidOrder = {
        id: 'order-refund-1',
        orderNumber: 'DH-REFUND-001',
        customerId: 'customer-1',
        status: 'RETURNED',
        paymentStatus: 'PAID',
        reservationId: null,
        items: [],
      };

      const mockTx = {
        paymentRecord: {
          findMany: async () => [
            { id: 'pr-1', orderId: 'order-refund-1', status: 'PAID', amount: 500000 },
          ],
          updateMany: async ({ data }) => {
            paymentRecordStatus = data.status;
            return { count: 1 };
          },
        },
        paymentAuditLog: {
          create: async ({ data }) => {
            paymentAuditLogEntry = data;
            return { id: 'pal-1', ...data };
          },
        },
        couponUsage: {
          findMany: async () => [
            { id: 'cu-1', couponId: 'coupon-vip', customerId: 'customer-1', orderId: 'order-refund-1' },
          ],
          delete: async ({ where }) => {
            deletedCouponUsageId = where.id;
            return {};
          },
        },
        coupon: {
          updateMany: async ({ where }) => {
            if (where.id === 'coupon-vip') decrementedCouponId = where.id;
            return { count: 1 };
          },
        },
        order: {
          update: async ({ data }) => {
            updatedOrderStatus = data.status;
            updatedPaymentStatus = data.paymentStatus;
            return { ...paidOrder, ...data };
          },
        },
        orderStatusHistory: { create: async () => ({}) },
        auditLog: { create: async () => ({}) },
      };

      const mockPrisma = {
        order: {
          findUnique: async () => paidOrder,
        },
        $transaction: async (cb) => cb(mockTx),
      };

      const ordersService = new OrdersService(mockPrisma);
      await ordersService.updateStatus('order-refund-1', 'REFUNDED', 'ADMIN', 'Hoàn tiền cho khách qua ngân hàng');

      assert.strictEqual(updatedOrderStatus, 'REFUNDED');
      assert.strictEqual(updatedPaymentStatus, 'REFUNDED');
      assert.strictEqual(paymentRecordStatus, 'REFUNDED');
      assert.strictEqual(paymentAuditLogEntry.action, 'REFUND');
      assert.strictEqual(paymentAuditLogEntry.paymentId, 'pr-1');
      assert.strictEqual(deletedCouponUsageId, 'cu-1');
      assert.strictEqual(decrementedCouponId, 'coupon-vip');
    });
  });

  describe('Order Completion & COD Payment Auto-Resolution (TASK-BIZ-04)', () => {
    test('Blocks transitioning unpaid non-COD order to COMPLETED', async () => {
      process.env.INTERNAL_SERVICE_SECRET = 'test-internal-secret-for-orders-service';
      const { OrdersService } = await import('../dist/orders/orders.service.js');

      const unpaidBankOrder = {
        id: 'order-bank-1',
        orderNumber: 'DH-BANK-001',
        customerId: 'customer-1',
        status: 'DELIVERED',
        paymentMethod: 'BANK_TRANSFER',
        paymentStatus: 'PENDING',
        reservationId: null,
        items: [],
      };

      const mockPrisma = {
        order: {
          findUnique: async () => unpaidBankOrder,
        },
      };

      const ordersService = new OrdersService(mockPrisma);
      await assert.rejects(
        async () => {
          await ordersService.updateStatus('order-bank-1', 'COMPLETED', 'STAFF');
        },
        /Không thể hoàn tất đơn hàng thanh toán qua "BANK_TRANSFER" khi chưa thanh toán thành công/,
      );
    });

    test('Auto-marks COD order as PAID upon transition to COMPLETED', async () => {
      process.env.INTERNAL_SERVICE_SECRET = 'test-internal-secret-for-orders-service';
      const { OrdersService } = await import('../dist/orders/orders.service.js');

      let updatedOrderStatus = null;
      let updatedPaymentStatus = null;
      let paymentRecordStatus = null;
      let paymentTxData = null;
      let paymentAuditLogEntry = null;

      const codOrder = {
        id: 'order-cod-1',
        orderNumber: 'DH-COD-001',
        customerId: 'customer-1',
        status: 'DELIVERED',
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        totalAmount: 350000,
        reservationId: null,
        items: [],
      };

      const mockTx = {
        paymentRecord: {
          findFirst: async () => ({ id: 'pr-cod-1', orderId: 'order-cod-1', status: 'PENDING' }),
          findMany: async () => [],
          updateMany: async ({ data }) => {
            paymentRecordStatus = data.status;
            return { count: 1 };
          },
        },
        paymentTransaction: {
          create: async ({ data }) => {
            paymentTxData = data;
            return { id: 'pt-cod-1', ...data };
          },
        },
        paymentAuditLog: {
          create: async ({ data }) => {
            paymentAuditLogEntry = data;
            return { id: 'pal-cod-1', ...data };
          },
        },
        couponUsage: {
          findMany: async () => [],
        },
        order: {
          update: async ({ data }) => {
            updatedOrderStatus = data.status;
            updatedPaymentStatus = data.paymentStatus;
            return { ...codOrder, ...data };
          },
        },
        orderStatusHistory: { create: async () => ({}) },
        auditLog: { create: async () => ({}) },
      };

      const mockPrisma = {
        order: {
          findUnique: async () => codOrder,
        },
        $transaction: async (cb) => cb(mockTx),
      };

      const ordersService = new OrdersService(mockPrisma);
      await ordersService.updateStatus('order-cod-1', 'COMPLETED', 'STAFF', 'Khách đã nhận hàng và thanh toán tiền mặt');

      assert.strictEqual(updatedOrderStatus, 'COMPLETED');
      assert.strictEqual(updatedPaymentStatus, 'PAID');
      assert.strictEqual(paymentRecordStatus, 'PAID');
      assert.strictEqual(paymentTxData.status, 'SUCCESS');
      assert.strictEqual(paymentTxData.provider, 'COD');
      assert.strictEqual(paymentAuditLogEntry.action, 'PAID');
      assert.strictEqual(paymentAuditLogEntry.paymentId, 'pr-cod-1');
    });
  });

  describe('Commit Inventory Compensation Fallback (TASK-BIZ-05)', () => {
    test('Creates COMMIT_INVENTORY CompensationTask when HTTP commit fails', async () => {
      process.env.INTERNAL_SERVICE_SECRET = 'test-internal-secret-for-orders-service';
      const { OrdersService } = await import('../dist/orders/orders.service.js');

      let compensationTaskCreated = null;

      const confirmedOrder = {
        id: 'order-commit-fail-1',
        orderNumber: 'DH-COMMIT-FAIL-001',
        customerId: 'customer-1',
        status: 'PENDING',
        paymentStatus: 'PAID',
        reservationId: 'res-commit-1',
        items: [{ variantId: 'var-1' }],
      };

      const mockCompensationService = {
        createTask: async (type, payload, options) => {
          compensationTaskCreated = { type, payload, options };
          return { id: 'task-1' };
        },
      };

      const mockTx = {
        paymentRecord: {
          findMany: async () => [],
        },
        couponUsage: {
          findMany: async () => [],
        },
        order: {
          update: async ({ data }) => ({ ...confirmedOrder, ...data }),
        },
        orderStatusHistory: { create: async () => ({}) },
        auditLog: { create: async () => ({}) },
      };

      const mockPrisma = {
        order: {
          findUnique: async () => confirmedOrder,
        },
        $transaction: async (cb) => cb(mockTx),
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url) => {
        if (typeof url === 'string' && url.includes('/internal/v1/inventory/commit')) {
          return {
            ok: false,
            status: 503,
            text: async () => 'Service Unavailable',
          };
        }
        return originalFetch(url);
      };

      try {
        const ordersService = new OrdersService(mockPrisma, mockCompensationService);
        await ordersService.updateStatus('order-commit-fail-1', 'CONFIRMED', 'STAFF');

        assert.ok(compensationTaskCreated, 'Expected CompensationTask to be created');
        assert.strictEqual(compensationTaskCreated.type, 'COMMIT_INVENTORY');
        assert.strictEqual(compensationTaskCreated.payload.reservationId, 'res-commit-1-var-1');
        assert.strictEqual(compensationTaskCreated.payload.referenceId, 'DH-COMMIT-FAIL-001');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('Paid Order Cancellation & Refund Transition (TASK-BIZ-06)', () => {
    test('Rejects customer self-cancelling an order that has already been PAID', async () => {
      process.env.INTERNAL_SERVICE_SECRET = 'test-internal-secret-for-orders-service';
      const { OrdersService } = await import('../dist/orders/orders.service.js');

      const paidOrder = {
        id: 'order-paid-cust-1',
        orderNumber: 'DH-PAID-CUST-001',
        customerId: 'customer-1',
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        reservationId: null,
        items: [],
      };

      const mockPrisma = {
        order: {
          findFirst: async () => paidOrder,
          findUnique: async () => paidOrder,
        },
      };

      const ordersService = new OrdersService(mockPrisma);
      await assert.rejects(
        async () => {
          await ordersService.cancelOrder('order-paid-cust-1', 'customer-1', 'Tôi muốn hủy đơn');
        },
        /Đơn hàng đã được thanh toán thành công. Quý khách vui lòng liên hệ hotline/,
      );
    });

    test('Allows Admin to transition CANCELLED order to REFUNDED when PAID', async () => {
      process.env.INTERNAL_SERVICE_SECRET = 'test-internal-secret-for-orders-service';
      const { OrdersService } = await import('../dist/orders/orders.service.js');

      let updatedOrderStatus = null;
      let updatedPaymentStatus = null;
      let paymentRecordStatus = null;
      let paymentAuditLogAction = null;

      const cancelledPaidOrder = {
        id: 'order-cancelled-paid-1',
        orderNumber: 'DH-CANCEL-PAID-001',
        customerId: 'customer-1',
        status: 'CANCELLED',
        paymentStatus: 'PAID',
        reservationId: null,
        items: [],
      };

      const mockTx = {
        paymentRecord: {
          findMany: async () => [
            { id: 'pr-cancelled-1', orderId: 'order-cancelled-paid-1', status: 'PAID', amount: 450000 },
          ],
          updateMany: async ({ data }) => {
            paymentRecordStatus = data.status;
            return { count: 1 };
          },
        },
        paymentAuditLog: {
          create: async ({ data }) => {
            paymentAuditLogAction = data.action;
            return { id: 'pal-cancelled-1', ...data };
          },
        },
        couponUsage: {
          findMany: async () => [],
        },
        order: {
          update: async ({ data }) => {
            updatedOrderStatus = data.status;
            updatedPaymentStatus = data.paymentStatus;
            return { ...cancelledPaidOrder, ...data };
          },
        },
        orderStatusHistory: { create: async () => ({}) },
        auditLog: { create: async () => ({}) },
      };

      const mockPrisma = {
        order: {
          findUnique: async () => cancelledPaidOrder,
        },
        $transaction: async (cb) => cb(mockTx),
      };

      const ordersService = new OrdersService(mockPrisma);
      await ordersService.updateStatus(
        'order-cancelled-paid-1',
        'REFUNDED',
        'ADMIN',
        'Đã chuyển khoản hoàn tiền cho khách',
      );

      assert.strictEqual(updatedOrderStatus, 'REFUNDED');
      assert.strictEqual(updatedPaymentStatus, 'REFUNDED');
      assert.strictEqual(paymentRecordStatus, 'REFUNDED');
      assert.strictEqual(paymentAuditLogAction, 'REFUND');
    });

    test('Rejects transitioning CANCELLED order to REFUNDED when unpaid', async () => {
      process.env.INTERNAL_SERVICE_SECRET = 'test-internal-secret-for-orders-service';
      const { OrdersService } = await import('../dist/orders/orders.service.js');

      const cancelledUnpaidOrder = {
        id: 'order-cancelled-unpaid-1',
        orderNumber: 'DH-CANCEL-UNPAID-001',
        customerId: 'customer-1',
        status: 'CANCELLED',
        paymentStatus: 'CANCELLED',
        reservationId: null,
        items: [],
      };

      const mockPrisma = {
        order: {
          findUnique: async () => cancelledUnpaidOrder,
        },
      };

      const ordersService = new OrdersService(mockPrisma);
      await assert.rejects(
        async () => {
          await ordersService.updateStatus('order-cancelled-unpaid-1', 'REFUNDED', 'ADMIN');
        },
        /Chỉ có thể hoàn tiền cho đơn hàng đã thanh toán thành công/,
      );
    });
  });
});
