import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { PaymentMethod, PaymentStatus, PaymentTransactionStatus } from '../generated/client/index.js';
import { CodPaymentProvider } from '../dist/payments/providers/cod-payment.provider.js';
import { PaymentsService } from '../dist/payments/payments.service.js';

process.env.INTERNAL_SERVICE_SECRET ||= 'unit-test-internal-service-secret';

function createHarness(receivedAmount = 500000) {
  const state = {
    paymentStatus: PaymentStatus.PENDING,
    paidRecordUpdates: 0,
    paidOrderUpdates: 0,
    successCreates: 0,
    attemptClaims: 0,
    commitTasks: 0,
    auditActions: [],
    lastAttemptWhere: null,
    lastClaimWhere: null,
  };
  const order = {
    id: 'order-1',
    orderNumber: 'DH-20260920-WEBHOOK',
    customerId: 'user-1',
    status: 'PENDING',
    paymentStatus: state.paymentStatus,
    totalAmount: 500000,
    reservationId: 'reservation-1',
    items: [{ variantId: 'variant-1' }],
    payments: [{ id: 'payment-1', status: PaymentStatus.PENDING }],
  };
  const attempt = {
    id: 'attempt-1',
    orderId: order.id,
    paymentRecordId: 'payment-1',
    provider: 'MOMO',
    method: PaymentMethod.MOMO,
    amount: 500000,
    status: PaymentTransactionStatus.PENDING,
    providerOrderId: order.orderNumber,
    providerRequestId: 'request-1',
    providerTransactionId: null,
    order,
    paymentRecord: order.payments[0],
  };

  const paymentTransaction = {
    findFirst: async ({ where } = {}) => {
      if (where) state.lastAttemptWhere = where;
      return attempt;
    },
    findUnique: async () => attempt,
    updateMany: async ({ where }) => {
      state.lastClaimWhere = where;
      if (
        where.id === attempt.id &&
        attempt.status === PaymentTransactionStatus.PENDING &&
        !attempt.providerTransactionId
      ) {
        attempt.status = PaymentTransactionStatus.SUCCESS;
        attempt.providerTransactionId = 'provider-tx-1';
        state.attemptClaims += 1;
        return { count: 1 };
      }
      return { count: 0 };
    },
    create: async () => {
      state.successCreates += 1;
      return attempt;
    },
  };
  const tx = {
    order: {
      findUnique: async () => order,
      update: async ({ data }) => {
        if (data.paymentStatus === PaymentStatus.PAID) state.paidOrderUpdates += 1;
        Object.assign(order, data);
        return order;
      },
      updateMany: async ({ data }) => {
        if (order.paymentStatus === PaymentStatus.PAID) return { count: 0 };
        if (data.paymentStatus === PaymentStatus.PAID) state.paidOrderUpdates += 1;
        Object.assign(order, data);
        return { count: 1 };
      },
    },
    paymentRecord: {
      update: async ({ data }) => {
        if (data.status === PaymentStatus.PAID) state.paidRecordUpdates += 1;
        return { id: 'payment-1', ...data };
      },
      updateMany: async ({ data }) => {
        if (data.status === PaymentStatus.PAID) state.paidRecordUpdates += 1;
        return { count: 1 };
      },
      findUnique: async () => ({ id: 'payment-1', status: state.paymentStatus }),
    },
    paymentTransaction,
    orderStatusHistory: { create: async () => ({}) },
    compensationTask: {
      create: async () => {
        state.commitTasks += 1;
        return { id: 'commit-task-1' };
      },
      upsert: async () => {
        state.commitTasks += 1;
        return { id: 'commit-task-1' };
      },
    },
    auditLog: {
      create: async ({ data }) => {
        state.auditActions.push(data.action);
        return data;
      },
    },
  };
  const prisma = {
    order: {
      findFirst: async () => ({ ...order, paymentStatus: state.paymentStatus }),
      findUnique: async () => order,
    },
    paymentTransaction,
    paymentRecord: tx.paymentRecord,
    orderStatusHistory: tx.orderStatusHistory,
    compensationTask: tx.compensationTask,
    auditLog: tx.auditLog,
    $transaction: async (callback) => callback(tx),
  };
  const momoProvider = {
    providerName: 'MOMO',
    supportedMethod: PaymentMethod.MOMO,
    verifyWebhook: async () => ({
      isValid: true,
      providerOrderId: order.orderNumber,
      providerRequestId: 'request-1',
      providerTransactionId: 'provider-tx-1',
      orderNumber: order.orderNumber,
      transactionId: 'provider-tx-1',
      amount: receivedAmount,
      status: PaymentStatus.PAID,
      isPaid: true,
      isFailed: false,
      isExpired: false,
      rawResponse: {},
    }),
    getPublicConfig: () => ({ enabled: true, provider: 'MOMO', environment: 'sandbox' }),
  };
  const service = new PaymentsService(
    prisma,
    new CodPaymentProvider(),
    {},
    momoProvider,
    { createTask: async () => ({ id: 'task' }) },
  );
  return { service, state };
}

describe('payment webhook financial integrity', () => {
  test('rejects a signed paid webhook whose amount does not exactly match the attempt', async () => {
    const { service, state } = createHarness(1);

    const result = await service.handlePaymentWebhook('MOMO', {}, {});

    assert.equal(result.success, false);
    assert.equal(state.paidRecordUpdates, 0);
    assert.equal(state.paidOrderUpdates, 0);
    assert.equal(state.successCreates, 0);
    assert.equal(state.attemptClaims, 0);
    assert.equal(state.commitTasks, 0);
    assert.ok(state.auditActions.includes('PAYMENT_AMOUNT_MISMATCH'));
  });

  test('atomically persists a durable inventory commit intent with a paid transition', async () => {
    const { service, state } = createHarness(500000);

    const result = await service.handlePaymentWebhook('MOMO', {}, {});

    assert.equal(result.success, true);
    assert.equal(state.attemptClaims, 1);
    assert.equal(state.paidRecordUpdates, 1);
    assert.equal(state.paidOrderUpdates, 1);
    assert.equal(state.successCreates, 0, 'the existing attempt must transition instead of creating a detached success row');
    assert.equal(state.commitTasks, 1);
  });

  test('rolls back when the payment record cannot be claimed as paid', async () => {
    const { service, state } = createHarness(500000);
    service.prisma.paymentRecord.updateMany = async () => ({ count: 0 });
    service.prisma.paymentRecord.findUnique = async () => ({
      id: 'payment-1',
      status: PaymentStatus.FAILED,
    });

    await assert.rejects(
      service.handlePaymentWebhook('MOMO', {}, {}),
      /could not be transitioned to PAID/,
    );
    assert.equal(state.paidOrderUpdates, 0);
    assert.equal(state.commitTasks, 0);
  });

  test('does not hide an unrelated unique-constraint failure as a duplicate webhook', async () => {
    const { service } = createHarness(500000);
    const uniqueError = Object.assign(new Error('unrelated unique violation'), { code: 'P2002' });
    service.prisma.$transaction = async () => {
      throw uniqueError;
    };
    service.prisma.paymentTransaction.findFirst = async () => null;

    await assert.rejects(
      service.handlePaymentWebhook('MOMO', {}, {}),
      (error) => error === uniqueError,
    );
  });

  test('acknowledges a unique violation only when the provider transaction already exists', async () => {
    const { service } = createHarness(500000);
    const uniqueError = Object.assign(new Error('duplicate provider transaction'), { code: 'P2002' });
    service.prisma.$transaction = async () => {
      throw uniqueError;
    };
    service.prisma.paymentTransaction.findFirst = async ({ where }) =>
      where.provider === 'MOMO' && where.providerTransactionId === 'provider-tx-1'
        ? { id: 'already-processed' }
        : null;

    const result = await service.handlePaymentWebhook('MOMO', {}, {});

    assert.equal(result.success, true);
    assert.match(result.message, /trước đó/);
  });

  test('binds the webhook to the exact provider order and request identifiers', async () => {
    const { service, state } = createHarness(500000);

    await service.handlePaymentWebhook('MOMO', {}, {});

    assert.equal(state.lastAttemptWhere.provider, 'MOMO');
    assert.equal(state.lastAttemptWhere.providerOrderId, 'DH-20260920-WEBHOOK');
    assert.equal(state.lastAttemptWhere.providerRequestId, 'request-1');
  });

  test('processes concurrent duplicate webhooks exactly once', async () => {
    const { service, state } = createHarness(500000);

    const results = await Promise.all([
      service.handlePaymentWebhook('MOMO', {}, {}),
      service.handlePaymentWebhook('MOMO', {}, {}),
    ]);

    assert.ok(results.every((result) => result.success));
    assert.equal(state.attemptClaims, 1);
    assert.equal(state.paidRecordUpdates, 1);
    assert.equal(state.paidOrderUpdates, 1);
    assert.equal(state.commitTasks, 1);
  });

  test('does not release inventory for a stale expired callback after payment succeeded', async () => {
    let releaseCalls = 0;
    const paidAttempt = {
      id: 'attempt-paid',
      orderId: 'order-paid',
      status: PaymentTransactionStatus.SUCCESS,
      provider: 'MOMO',
      providerOrderId: 'provider-order-paid',
      providerRequestId: 'request-paid',
      order: { id: 'order-paid', paymentStatus: PaymentStatus.PAID },
    };
    const prisma = {
      paymentTransaction: {
        findFirst: async () => paidAttempt,
        updateMany: async () => ({ count: 0 }),
      },
    };
    const momoProvider = {
      providerName: 'MOMO',
      verifyWebhook: async () => ({
        isValid: true,
        providerOrderId: paidAttempt.providerOrderId,
        providerRequestId: paidAttempt.providerRequestId,
        status: PaymentStatus.EXPIRED,
        isPaid: false,
        isFailed: false,
        isExpired: true,
      }),
    };
    const service = new PaymentsService(
      prisma,
      new CodPaymentProvider(),
      {},
      momoProvider,
      { createTask: async () => ({ id: 'task' }) },
    );
    service.releaseOrderInventory = async () => {
      releaseCalls += 1;
    };

    const result = await service.handlePaymentWebhook('MOMO', {}, {});

    assert.equal(result.success, true);
    assert.equal(releaseCalls, 0);
  });

  test('allows a verified paid callback to recover the same failed attempt', async () => {
    const { service, state } = createHarness(500000);
    const originalTransaction = service.prisma.paymentTransaction;
    const attempt = await originalTransaction.findFirst();
    attempt.status = PaymentTransactionStatus.FAILED;
    attempt.providerTransactionId = 'failed-provider-tx';
    originalTransaction.updateMany = async ({ where, data }) => {
      state.lastClaimWhere = where;
      const allowedStatuses = Array.isArray(where.status?.in) ? where.status.in : [where.status];
      if (
        where.id === attempt.id &&
        allowedStatuses.includes(attempt.status)
      ) {
        attempt.status = data.status;
        attempt.providerTransactionId = data.providerTransactionId;
        state.attemptClaims += 1;
        return { count: 1 };
      }
      return { count: 0 };
    };

    const result = await service.handlePaymentWebhook('MOMO', {}, {});

    assert.equal(result.success, true);
    assert.equal(state.attemptClaims, 1);
    assert.equal(state.paidRecordUpdates, 1);
    assert.equal(state.paidOrderUpdates, 1);
    assert.ok(
      state.lastClaimWhere.OR.some((condition) =>
        condition.status?.in?.includes(PaymentTransactionStatus.FAILED),
      ),
      'a verified paid callback must supersede a prior failed provider result',
    );
  });
});
