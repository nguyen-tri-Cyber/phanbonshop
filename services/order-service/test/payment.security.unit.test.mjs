import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '../generated/client/index.js';
import { CodPaymentProvider } from '../dist/payments/providers/cod-payment.provider.js';
import { BankTransferPaymentProvider } from '../dist/payments/providers/bank-transfer-payment.provider.js';
import { MomoPaymentProvider } from '../dist/payments/providers/momo-payment.provider.js';
import { PaymentsService } from '../dist/payments/payments.service.js';

const momoEnvKeys = [
  'NODE_ENV',
  'MOMO_ENABLED',
  'MOMO_PARTNER_CODE',
  'MOMO_ACCESS_KEY',
  'MOMO_SECRET_KEY',
  'MOMO_API_ENDPOINT',
  'MOMO_QUERY_ENDPOINT',
  'MOMO_REDIRECT_URL',
  'MOMO_IPN_URL',
  'INTERNAL_SERVICE_SECRET',
  'VIETQR_WEBHOOK_SECRET',
  'BANK_NAME',
  'BANK_CODE',
  'BANK_ACCOUNT_NUMBER',
  'BANK_ACCOUNT_HOLDER',
  'BANK_BRANCH',
];

const originalEnv = Object.fromEntries(momoEnvKeys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of momoEnvKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function configureMomo(overrides = {}) {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MOMO_ENABLED: 'true',
    MOMO_PARTNER_CODE: 'test-partner',
    MOMO_ACCESS_KEY: 'test-access',
    MOMO_SECRET_KEY: 'runtime-test-secret',
    MOMO_API_ENDPOINT: 'https://example.test/create',
    MOMO_QUERY_ENDPOINT: 'https://example.test/query',
    MOMO_REDIRECT_URL: 'https://shop.example.test/payment-return',
    MOMO_IPN_URL: 'https://api.example.test/api/v1/payments/momo/ipn',
    INTERNAL_SERVICE_SECRET: 'unit-test-internal-service-secret',
    ...overrides,
  });
}

const validBankWebhook = {
  content: 'Thanh toan DH-20260920-WEBHOOK-ABCDEF123456',
  amount: 500000,
  transactionId: 'bank-tx-1',
};

function createService() {
  const order = {
    id: 'order-a',
    orderNumber: 'DH-OWNER-A',
    customerId: 'user-a',
    status: 'PENDING',
    paymentStatus: PaymentStatus.PENDING,
    paymentMethod: PaymentMethod.COD,
    totalAmount: 500000,
    payments: [{ id: 'payment-a', orderId: 'order-a' }],
  };
  const payment = {
    id: 'payment-a',
    orderId: order.id,
    status: PaymentStatus.PENDING,
    order,
    transactions: [],
    auditLogs: [],
  };
  const prisma = {
    order: { findUnique: async () => order },
    paymentRecord: {
      findFirst: async () => payment,
      findUnique: async () => payment,
    },
    paymentTransaction: { findMany: async () => [] },
  };
  configureMomo();
  const momo = new MomoPaymentProvider();
  const service = new PaymentsService(
    prisma,
    new CodPaymentProvider(),
    new BankTransferPaymentProvider(),
    momo,
    { createTask: async () => ({ id: 'task' }) },
  );
  return { service, momo };
}

describe('payment public configuration', () => {
  test('returns only non-secret MoMo capability fields', () => {
    const { service, momo } = createService();
    const expected = { enabled: true, provider: 'MOMO', environment: 'sandbox' };

    assert.deepEqual(momo.getPublicConfig(), expected);
    assert.deepEqual(service.getMomoSettings(), expected);
    const serialized = JSON.stringify(service.getMomoSettings());
    for (const forbidden of ['secretKey', 'accessKey', 'password', 'privateKey', 'internalSecret']) {
      assert.ok(!serialized.includes(forbidden), `public config must omit ${forbidden}`);
    }
  });

  test('fails fast when MoMo is enabled in production without credentials', () => {
    configureMomo({ NODE_ENV: 'production' });
    delete process.env.MOMO_SECRET_KEY;

    assert.throws(() => new MomoPaymentProvider(), /MOMO_SECRET_KEY/);
  });

  test('rejects MoMo webhooks when the provider is disabled', async () => {
    configureMomo({
      MOMO_ENABLED: 'false',
      MOMO_PARTNER_CODE: '',
      MOMO_ACCESS_KEY: '',
      MOMO_SECRET_KEY: '',
    });
    const provider = new MomoPaymentProvider();
    const body = {
      amount: 500000,
      extraData: '',
      message: 'Successful.',
      orderId: 'DH-20260921-DISABLED',
      orderInfo: 'Thanh toan don hang',
      orderType: 'momo_wallet',
      partnerCode: '',
      payType: 'qr',
      requestId: 'request-disabled',
      responseTime: Date.now(),
      resultCode: 0,
      transId: 'provider-tx-disabled',
    };
    const rawSignature = `accessKey=&amount=${body.amount}&extraData=${body.extraData}&message=${body.message}&orderId=${body.orderId}&orderInfo=${body.orderInfo}&orderType=${body.orderType}&partnerCode=${body.partnerCode}&payType=${body.payType}&requestId=${body.requestId}&responseTime=${body.responseTime}&resultCode=${body.resultCode}&transId=${body.transId}`;
    body.signature = MomoPaymentProvider.generateSignature(rawSignature, '');

    const result = await provider.verifyWebhook({}, body);

    assert.equal(result.isValid, false);
    assert.equal(result.isPaid, false);
  });
});

describe('bank transfer webhook authentication', () => {
  test('fails fast in production when bank account configuration is missing', () => {
    process.env.NODE_ENV = 'production';
    for (const key of [
      'BANK_NAME',
      'BANK_CODE',
      'BANK_ACCOUNT_NUMBER',
      'BANK_ACCOUNT_HOLDER',
    ]) {
      delete process.env[key];
    }

    assert.throws(() => new BankTransferPaymentProvider(), /BANK_/);
  });

  test('fails closed when no VietQR webhook secret is configured', async () => {
    delete process.env.VIETQR_WEBHOOK_SECRET;
    const provider = new BankTransferPaymentProvider();

    const result = await provider.verifyWebhook({}, validBankWebhook);

    assert.equal(result.isValid, false);
    assert.equal(result.isPaid, false);
  });

  test('rejects an incorrect VietQR webhook secret', async () => {
    process.env.VIETQR_WEBHOOK_SECRET = 'correct-test-webhook-secret';
    const provider = new BankTransferPaymentProvider();

    const result = await provider.verifyWebhook(
      { 'x-vietqr-webhook-secret': 'wrong-test-webhook-secret' },
      validBankWebhook,
    );

    assert.equal(result.isValid, false);
    assert.equal(result.isPaid, false);
  });

  test('accepts a valid VietQR webhook secret', async () => {
    process.env.VIETQR_WEBHOOK_SECRET = 'correct-test-webhook-secret';
    const provider = new BankTransferPaymentProvider();

    const result = await provider.verifyWebhook(
      { 'x-vietqr-webhook-secret': 'correct-test-webhook-secret' },
      validBankWebhook,
    );

    assert.equal(result.isValid, true);
    assert.equal(result.isPaid, true);
    assert.equal(result.providerOrderId, 'DH-20260920-WEBHOOK-ABCDEF123456');
    assert.equal(result.providerRequestId, 'ABCDEF123456');
  });

  test('binds each bank transfer attempt to a unique transfer reference', async () => {
    process.env.VIETQR_WEBHOOK_SECRET = 'correct-test-webhook-secret';
    const provider = new BankTransferPaymentProvider();
    const payload = {
      orderId: 'order-1',
      orderNumber: 'DH-20260920-WEBHOOK',
      amount: 500000,
      customerId: 'user-1',
    };

    const first = await provider.createPayment(payload);
    const second = await provider.createPayment(payload);

    assert.notEqual(first.providerOrderId, second.providerOrderId);
    assert.notEqual(first.providerRequestId, second.providerRequestId);
    assert.equal(first.paymentDetails.transferContent, first.providerOrderId);

    const verified = await provider.verifyWebhook(
      { 'x-vietqr-webhook-secret': 'correct-test-webhook-secret' },
      {
        content: first.paymentDetails.transferContent,
        amount: payload.amount,
        transactionId: 'bank-tx-exact-attempt',
      },
    );
    assert.equal(verified.providerOrderId, first.providerOrderId);
    assert.equal(verified.providerRequestId, first.providerRequestId);
  });
});

describe('payment object authorization', () => {
  test('allows the owning customer to read payment data', async () => {
    const { service } = createService();
    const actor = { userId: 'user-a', role: 'CUSTOMER' };

    assert.equal((await service.getPaymentByOrderId('order-a', actor)).id, 'payment-a');
    assert.equal((await service.getPaymentById('payment-a', actor)).id, 'payment-a');
    assert.deepEqual(await service.getOrderTransactions('order-a', actor), []);
  });

  test('denies a different customer for payment, history, and detail reads', async () => {
    const { service } = createService();
    const actor = { userId: 'user-b', role: 'CUSTOMER' };

    await assert.rejects(service.getPaymentByOrderId('order-a', actor), ForbiddenException);
    await assert.rejects(service.getPaymentById('payment-a', actor), ForbiddenException);
    await assert.rejects(service.getOrderTransactions('order-a', actor), ForbiddenException);
  });

  test('allows an existing privileged role to read payment data', async () => {
    const { service } = createService();
    assert.equal(
      (await service.getPaymentByOrderId('order-a', { userId: 'staff-1', role: 'STAFF' })).id,
      'payment-a',
    );
  });
});

describe('manual payment confirmation concurrency', () => {
  test('does not report success when a competing transition did not end in PAID', async () => {
    const order = {
      id: 'order-conflict',
      orderNumber: 'DH-20260921-CONFLICT',
      customerId: 'user-a',
      status: 'PENDING',
      paymentStatus: PaymentStatus.PENDING,
      reservationId: null,
      items: [],
    };
    const payment = {
      id: 'payment-conflict',
      orderId: order.id,
      provider: 'VIETQR',
      method: PaymentMethod.BANK_TRANSFER,
      amount: 500000,
      status: PaymentStatus.PENDING,
      transactionReference: null,
      order,
      transactions: [],
      auditLogs: [],
    };
    const prisma = {
      paymentRecord: { findUnique: async () => payment },
      $transaction: async (callback) => callback({
        paymentRecord: {
          updateMany: async () => ({ count: 0 }),
          findUnique: async () => ({ ...payment, status: PaymentStatus.FAILED }),
        },
        order: { findUnique: async () => order },
      }),
    };
    configureMomo();
    const service = new PaymentsService(
      prisma,
      new CodPaymentProvider(),
      new BankTransferPaymentProvider(),
      new MomoPaymentProvider(),
      { createTask: async () => ({ id: 'task' }) },
    );

    await assert.rejects(
      service.confirmPayment('payment-conflict', 'admin@example.test', 'ADMIN', {}),
      /không thể xác nhận là PAID/,
    );
  });

  test('creates financial side effects exactly once for concurrent confirmations', async () => {
    let paymentStatus = PaymentStatus.PENDING;
    let transactionCreates = 0;
    let auditCreates = 0;
    const order = {
      id: 'order-concurrent',
      orderNumber: 'DH-20260920-CONCURRENT',
      customerId: 'user-a',
      status: 'PENDING',
      paymentStatus: PaymentStatus.PENDING,
      reservationId: null,
      items: [],
    };
    const stalePaymentSnapshot = () => ({
      id: 'payment-concurrent',
      orderId: order.id,
      provider: 'VIETQR',
      method: PaymentMethod.BANK_TRANSFER,
      amount: 500000,
      status: PaymentStatus.PENDING,
      transactionReference: null,
      order,
      transactions: [],
      auditLogs: [],
    });
    const tx = {
      paymentRecord: {
        update: async ({ data }) => {
          paymentStatus = data.status;
          return { ...stalePaymentSnapshot(), ...data };
        },
        updateMany: async () => {
          if (paymentStatus === PaymentStatus.PAID) return { count: 0 };
          paymentStatus = PaymentStatus.PAID;
          return { count: 1 };
        },
        findUnique: async () => ({ ...stalePaymentSnapshot(), status: paymentStatus }),
      },
      paymentTransaction: {
        create: async () => {
          transactionCreates += 1;
          return {};
        },
      },
      paymentAuditLog: {
        create: async () => {
          auditCreates += 1;
          return {};
        },
      },
      auditLog: { create: async () => ({}) },
      order: {
        update: async ({ data }) => Object.assign(order, data),
        findUnique: async () => order,
      },
      compensationTask: { upsert: async () => ({}) },
      orderStatusHistory: { create: async () => ({}) },
    };
    const prisma = {
      paymentRecord: { findUnique: async () => stalePaymentSnapshot() },
      $transaction: async (callback) => callback(tx),
    };
    configureMomo();
    const service = new PaymentsService(
      prisma,
      new CodPaymentProvider(),
      new BankTransferPaymentProvider(),
      new MomoPaymentProvider(),
      { createTask: async () => ({ id: 'task' }) },
    );

    const results = await Promise.all([
      service.confirmPayment('payment-concurrent', 'admin@example.test', 'ADMIN', {}),
      service.confirmPayment('payment-concurrent', 'admin@example.test', 'ADMIN', {}),
    ]);

    assert.ok(results.every((result) => result.success));
    assert.equal(transactionCreates, 1);
    assert.equal(auditCreates, 1);
  });
});
