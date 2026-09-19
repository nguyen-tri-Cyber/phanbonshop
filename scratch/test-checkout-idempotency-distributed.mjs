/**
 * Distributed Multi-Instance Checkout Idempotency Test Suite
 *
 * Kiểm tra các yêu cầu:
 * 1. 10 requests đồng thời chạy trên các instance độc lập (bypass shared memory lock)
 *    cùng customerId + Idempotency-Key + payload:
 *    - Đúng 1 Order được tạo trong order_db
 *    - Đúng 1 Logical Reservation được gọi
 *    - Đúng 1 PaymentRecord được tạo trong order_db
 *    - 9 requests còn lại bị chặn bởi Database Unique Constraint (409 IDEMPOTENCY_IN_PROGRESS)
 * 2. Gửi request cùng Idempotency-Key nhưng payload khác (mismatch):
 *    - Ném lỗi 409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST
 *    - Không tạo thêm order
 * 3. Gửi lại request sau khi COMPLETED:
 *    - Trả lại kết quả cached từ Database
 * 4. Stale PROCESSING lock (>2 phút) và FAILED retry policy:
 *    - Cho phép atomic reclaim an toàn
 * 5. Cleanup stale records method
 * 6. Tuyệt đối không dùng sleep/timing để làm pass test concurrency.
 */

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

const MYSQL_USER = process.env.MYSQL_USER || 'phanbon_user';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || 'phanbon_secret';
const DB_URL = 'mysql://phanbon_user:phanbon_secret@localhost:3307/order_db';

process.env.ORDER_DATABASE_URL = DB_URL;
process.env.INTERNAL_SERVICE_SECRET = 'your_internal_service_mesh_shared_secret_2026';

console.log('================================================================');
console.log('STARTING TESTS: DATABASE-BACKED DISTRIBUTED CHECKOUT IDEMPOTENCY');
console.log('================================================================\n');

function mysqlQuery(sql) {
  const singleLineSql = sql.replace(/\r?\n/g, ' ').trim().replace(/"/g, '\\"');
  const cmd = `docker exec phanbonshop_mysql mysql -u${MYSQL_USER} -p${MYSQL_PASSWORD} order_db -N -e "${singleLineSql}"`;
  try {
    const result = execSync(cmd, { encoding: 'utf-8', timeout: 10000 });
    return result.trim();
  } catch (e) {
    console.error(`MySQL query failed on order_db: ${singleLineSql}`);
    throw e;
  }
}

// ----------------------------------------------------------------------
// Load modules từ order-service dist
// ----------------------------------------------------------------------
const { PrismaClient } = await import('../services/order-service/generated/client/index.js');
const { CheckoutService, canonicalizeJson, computeRequestHash } = await import(
  '../services/order-service/dist/checkout/checkout.service.js'
);
const { OrdersService } = await import('../services/order-service/dist/orders/orders.service.js');
const { CouponsService } = await import('../services/order-service/dist/coupons/coupons.service.js');
const { ShippingService } = await import('../services/order-service/dist/shipping/shipping.service.js');
const { CartService } = await import('../services/order-service/dist/cart/cart.service.js');
const { PaymentsService } = await import('../services/order-service/dist/payments/payments.service.js');

const { CodPaymentProvider } = await import(
  '../services/order-service/dist/payments/providers/cod-payment.provider.js'
);
const { BankTransferPaymentProvider } = await import(
  '../services/order-service/dist/payments/providers/bank-transfer-payment.provider.js'
);

const prisma = new PrismaClient({
  datasources: { db: { url: DB_URL } },
});

// Factory tạo CheckoutService instance độc lập (mô phỏng các replica pod/instance riêng biệt)
function createIndependentInstance(spyCounters) {
  const ordersService = new OrdersService(prisma);
  const couponsService = new CouponsService(prisma);
  const shippingService = new ShippingService();
  const cartService = new CartService(prisma);
  const codProvider = new CodPaymentProvider();
  const bankTransferProvider = new BankTransferPaymentProvider();
  const paymentsService = new PaymentsService(prisma, codProvider, bankTransferProvider);

  const instance = new CheckoutService(
    prisma,
    ordersService,
    couponsService,
    shippingService,
    cartService,
    paymentsService,
  );

  // Stub các network call tới external services để kiểm tra logic nội tại của Saga & DB
  instance['fetchCustomerAddress'] = async () => ({
    recipientName: 'Nguyen Van Nong Dan',
    phone: '0901234567',
    provinceCode: '79',
    provinceName: 'Ho Chi Minh',
    districtCode: '760',
    districtName: 'Quan 1',
    wardCode: '26734',
    wardName: 'Ben Nghe',
    addressLine: '123 Nguyen Hue',
  });

  instance['fetchProductCatalog'] = async (productId) => ({
    id: productId,
    name: 'Phan Bon NPK 20-20-15 Dau Trau',
    status: 'ACTIVE',
    variants: [
      {
        id: 'var-npk-50kg',
        sku: 'NPK-DT-50KG',
        price: 750000,
        packageSize: 'Bao 50kg',
        unit: 'BAO',
        status: 'ACTIVE',
      },
    ],
  });

  instance['reserveInventoryItem'] = async () => {
    spyCounters.reservationCalls++;
    return true; // reserve thành công
  };

  instance['releaseInventoryItem'] = async () => {
    spyCounters.releaseCalls++;
  };

  return instance;
}

try {
  // ======================================================================
  // TEST SUITE 1: Deterministic Canonical JSON & Hashing
  // ======================================================================
  console.log('▶ [TEST SUITE 1] Kiểm tra Canonical JSON và SHA-256 Hashing...');

  const payload1 = {
    items: [{ productId: 'p1', variantId: 'v1', quantity: 2 }],
    couponCode: 'GIAM50K',
    paymentMethod: 'COD',
    customerNote: 'Giao gio hanh chinh',
  };

  // Đảo lộn thứ tự các key trong object
  const payload1Reordered = {
    customerNote: 'Giao gio hanh chinh',
    paymentMethod: 'COD',
    items: [{ quantity: 2, variantId: 'v1', productId: 'p1' }],
    couponCode: 'GIAM50K',
  };

  const hash1 = computeRequestHash(payload1);
  const hash1Reordered = computeRequestHash(payload1Reordered);

  assert.strictEqual(
    hash1,
    hash1Reordered,
    'Hai payload cùng nội dung nhưng khác thứ tự key PHẢI tạo ra hash giống hệt nhau'
  );
  assert.strictEqual(hash1.length, 64, 'Hash phải là SHA-256 hex digest 64 ký tự');

  const payloadDifferent = { ...payload1, customerNote: 'Giao buoi toi' };
  const hashDifferent = computeRequestHash(payloadDifferent);
  assert.notStrictEqual(hash1, hashDifferent, 'Payload khác nội dung phải tạo ra hash khác nhau');

  console.log('✔ Canonical JSON & SHA-256 hashing hoạt động hoàn toàn xác định và chính xác!\n');

  // ======================================================================
  // TEST SUITE 2: Multi-Instance Concurrent Simulation (10 concurrent requests)
  // ======================================================================
  console.log('▶ [TEST SUITE 2] Multi-Instance Concurrency Test (10 requests đồng thời)...');

  const testSuffix = Date.now();
  const customerId = `cust_concurrent_${testSuffix}`;
  const idempotencyKey = `idem_key_${testSuffix}`;

  const checkoutDto = {
    items: [{ productId: 'prod-npk-001', variantId: 'var-npk-50kg', quantity: 2 }],
    addressId: 'addr-test-123',
    paymentMethod: 'COD',
    customerNote: 'Don hang dong thoi 10 requests',
  };

  const spyCounters = {
    reservationCalls: 0,
    releaseCalls: 0,
  };

  // Tạo 10 CheckoutService instance hoàn toàn riêng biệt (10 server replicas không chung RAM)
  const instances = Array.from({ length: 10 }, () => createIndependentInstance(spyCounters));

  console.log('Bắn 10 request đồng thời tại cùng 1 thời điểm qua Promise.all()...');

  // Bắn 10 request cùng 1 lúc với bypassInMemoryLock: true
  const results = await Promise.allSettled(
    instances.map((inst) =>
      inst.processCheckout(customerId, checkoutDto, idempotencyKey, { bypassInMemoryLock: true })
    )
  );

  let successCount = 0;
  let inProgressCount = 0;
  let otherErrorCount = 0;

  for (const r of results) {
    if (r.status === 'fulfilled') {
      successCount++;
    } else {
      const err = r.reason;
      const code = err?.response?.code || err?.code || '';
      const status = err?.status || err?.statusCode || 0;
      if (status === 409 && (code === 'IDEMPOTENCY_IN_PROGRESS' || err.message?.includes('đang được xử lý'))) {
        inProgressCount++;
      } else {
        console.error('Lỗi không mong đợi:', err);
        otherErrorCount++;
      }
    }
  }

  console.log(`Kết quả: ${successCount} thành công, ${inProgressCount} bị chặn 409 IN_PROGRESS, ${otherErrorCount} lỗi khác`);

  // Phải có ít nhất 1 thành công (Owner)
  assert.ok(successCount >= 1, `Phải có ít nhất 1 request hoàn tất thành công. Thực tế: ${successCount}`);
  assert.strictEqual(otherErrorCount, 0, 'Không được có lỗi không xác định');

  // Kiểm tra database: ĐÚNG 1 ORDER ĐƯỢC TẠO
  const orderCount = parseInt(
    mysqlQuery(`SELECT COUNT(*) FROM orders WHERE customerId = '${customerId}'`),
    10
  );
  assert.strictEqual(orderCount, 1, `DATABASE CHỈ ĐƯỢC PHÉP CÓ ĐÚNG 1 ORDER! Thực tế có: ${orderCount}`);
  console.log('✔ Database verification: Đúng 1 Order duy nhất được tạo trong order_db!');

  // Kiểm tra database: ĐÚNG 1 PAYMENT RECORD ĐƯỢC TẠO
  const paymentCount = parseInt(
    mysqlQuery(
      `SELECT COUNT(*) FROM payment_records WHERE orderId IN (SELECT id FROM orders WHERE customerId = '${customerId}')`
    ),
    10
  );
  assert.strictEqual(paymentCount, 1, `DATABASE CHỈ ĐƯỢC PHÉP CÓ ĐÚNG 1 PAYMENT RECORD! Thực tế có: ${paymentCount}`);
  console.log('✔ Database verification: Đúng 1 PaymentRecord duy nhất được tạo trong order_db!');

  // Kiểm tra inventory reserve: ĐÚNG 1 LẦN GỌI
  assert.strictEqual(
    spyCounters.reservationCalls,
    1,
    `LOGICAL INVENTORY RESERVATION CHỈ ĐƯỢC GỌI ĐÚNG 1 LẦN! Thực tế gọi: ${spyCounters.reservationCalls}`
  );
  console.log('✔ Saga verification: Đúng 1 Logical Reservation được gọi tới Inventory Service!');

  // Kiểm tra trạng thái IdempotencyRecord trong DB: phải là COMPLETED
  const recordStatus = mysqlQuery(
    `SELECT status FROM idempotency_records WHERE customerId = '${customerId}' AND idempotencyKey = '${idempotencyKey}'`
  );
  assert.strictEqual(recordStatus, 'COMPLETED', 'IdempotencyRecord phải ở trạng thái COMPLETED sau khi hoàn tất');
  console.log('✔ IdempotencyRecord committed với trạng thái COMPLETED trong DB!\n');

  // ======================================================================
  // TEST SUITE 3: Reused Key with Different Payload -> 409 Mismatch
  // ======================================================================
  console.log('▶ [TEST SUITE 3] Kiểm tra gửi cùng Idempotency-Key nhưng payload khác...');

  const modifiedDto = {
    ...checkoutDto,
    customerNote: 'Ghi chu da bi thay doi de test payload mismatch attack',
    items: [{ productId: 'prod-npk-001', variantId: 'var-npk-50kg', quantity: 5 }],
  };

  const testInstance = createIndependentInstance(spyCounters);
  let mismatchError = null;

  try {
    await testInstance.processCheckout(customerId, modifiedDto, idempotencyKey, {
      bypassInMemoryLock: true,
    });
  } catch (err) {
    mismatchError = err;
  }

  assert.ok(mismatchError, 'Phải ném lỗi khi tái sử dụng key với payload khác');
  assert.strictEqual(mismatchError.status, 409, 'Phải trả về HTTP 409 Conflict');
  const errCode = mismatchError?.response?.code || '';
  assert.strictEqual(
    errCode,
    'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',
    `Mã lỗi phải là IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST. Nhận được: ${errCode}`
  );

  // Đảm bảo không có thêm order nào được tạo
  const orderCountAfterMismatch = parseInt(
    mysqlQuery(`SELECT COUNT(*) FROM orders WHERE customerId = '${customerId}'`),
    10
  );
  assert.strictEqual(orderCountAfterMismatch, 1, 'Số lượng Order trong DB không được thay đổi');
  console.log('✔ Tái sử dụng key với payload khác -> Bị từ chối 409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST chính xác!\n');

  // ======================================================================
  // TEST SUITE 4: Retry with Same Key and Same Payload -> Return Cached Response
  // ======================================================================
  console.log('▶ [TEST SUITE 4] Kiểm tra gửi lại cùng key và payload khi đã COMPLETED...');

  const cachedResult = await testInstance.processCheckout(customerId, checkoutDto, idempotencyKey, {
    bypassInMemoryLock: true,
  });

  assert.ok(cachedResult, 'Phải nhận được kết quả cached');
  assert.ok(cachedResult.orderId, 'Kết quả phải chứa orderId');
  assert.ok(cachedResult.orderNumber, 'Kết quả phải chứa orderNumber');

  const orderCountAfterCacheHit = parseInt(
    mysqlQuery(`SELECT COUNT(*) FROM orders WHERE customerId = '${customerId}'`),
    10
  );
  assert.strictEqual(orderCountAfterCacheHit, 1, 'Không được tạo thêm order khi đọc từ cache');
  console.log(`✔ Trả lại đúng kết quả của đơn hàng ${cachedResult.orderNumber} từ bản ghi COMPLETED!\n`);

  // ======================================================================
  // TEST SUITE 5: FAILED Record Safe Retry Policy
  // ======================================================================
  console.log('▶ [TEST SUITE 5] Kiểm tra policy retry an toàn cho bản ghi FAILED...');

  const failedKey = `failed_key_${testSuffix}`;
  const failedHash = computeRequestHash(checkoutDto);

  // Tạo thủ công 1 bản ghi FAILED trong DB
  mysqlQuery(
    `INSERT INTO idempotency_records (id, customerId, idempotencyKey, requestPath, requestHash, status, statusCode, responseBody, createdAt, updatedAt)
     VALUES (UUID(), '${customerId}', '${failedKey}', '/api/v1/checkout', '${failedHash}', 'FAILED', 500, '{"error":"Network timeout"}', NOW(), NOW())`
  );

  // Gửi request retry với cùng payload
  const retryResult = await testInstance.processCheckout(customerId, checkoutDto, failedKey, {
    bypassInMemoryLock: true,
  });

  assert.ok(retryResult, 'Request retry cho bản ghi FAILED phải thành công');
  assert.ok(retryResult.orderId, 'Order mới phải được tạo khi retry FAILED record');

  const newStatus = mysqlQuery(
    `SELECT status FROM idempotency_records WHERE customerId = '${customerId}' AND idempotencyKey = '${failedKey}'`
  );
  assert.strictEqual(newStatus, 'COMPLETED', 'Bản ghi FAILED phải được chuyển thành COMPLETED sau khi retry thành công');
  console.log('✔ Policy retry an toàn cho bản ghi FAILED hoạt động chính xác!\n');

  // ======================================================================
  // TEST SUITE 6: Stale PROCESSING Recovery & Cleanup
  // ======================================================================
  console.log('▶ [TEST SUITE 6] Kiểm tra phục hồi và dọn dẹp stale PROCESSING (> 2 phút)...');

  const staleKey = `stale_key_${testSuffix}`;
  const staleHash = computeRequestHash(checkoutDto);

  // Tạo 1 bản ghi PROCESSING bị kẹt từ 5 phút trước (stale instance crash)
  mysqlQuery(
    `INSERT INTO idempotency_records (id, customerId, idempotencyKey, requestPath, requestHash, status, createdAt, updatedAt)
     VALUES (UUID(), '${customerId}', '${staleKey}', '/api/v1/checkout', '${staleHash}', 'PROCESSING', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 MINUTE), DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 MINUTE))`
  );

  // Request mới phải reclaim được lock bị stale và hoàn tất thành công
  const staleRecoverResult = await testInstance.processCheckout(customerId, checkoutDto, staleKey, {
    bypassInMemoryLock: true,
  });

  assert.ok(staleRecoverResult, 'Request phải reclaim được stale lock');
  assert.ok(staleRecoverResult.orderId, 'Order mới phải được tạo sau khi reclaim stale lock');

  // Test cleanupStaleProcessingRecords method
  const timeoutKey = `timeout_key_${testSuffix}`;
  mysqlQuery(
    `INSERT INTO idempotency_records (id, customerId, idempotencyKey, requestPath, requestHash, status, createdAt, updatedAt)
     VALUES (UUID(), '${customerId}', '${timeoutKey}', '/api/v1/checkout', 'some_hash', 'PROCESSING', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE), DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))`
  );

  const cleanedCount = await testInstance.cleanupStaleProcessingRecords(120_000);
  assert.ok(cleanedCount >= 1, `Phải dọn dẹp ít nhất 1 bản ghi stale. Thực tế: ${cleanedCount}`);

  const timeoutStatus = mysqlQuery(
    `SELECT status FROM idempotency_records WHERE customerId = '${customerId}' AND idempotencyKey = '${timeoutKey}'`
  );
  assert.strictEqual(timeoutStatus, 'FAILED', 'Bản ghi stale PROCESSING phải được đánh dấu FAILED bởi cleanup');
  console.log('✔ Phục hồi và dọn dẹp stale PROCESSING records hoạt động chính xác!\n');

  // ======================================================================
  // CLEANUP
  // ======================================================================
  console.log('▶ [CLEANUP] Dọn dẹp dữ liệu kiểm thử...');
  mysqlQuery(`DELETE FROM idempotency_records WHERE customerId = '${customerId}'`);
  mysqlQuery(`DELETE FROM payment_records WHERE orderId IN (SELECT id FROM orders WHERE customerId = '${customerId}')`);
  mysqlQuery(`DELETE FROM order_shipping_addresses WHERE orderId IN (SELECT id FROM orders WHERE customerId = '${customerId}')`);
  mysqlQuery(`DELETE FROM order_status_history WHERE orderId IN (SELECT id FROM orders WHERE customerId = '${customerId}')`);
  mysqlQuery(`DELETE FROM order_items WHERE orderId IN (SELECT id FROM orders WHERE customerId = '${customerId}')`);
  mysqlQuery(`DELETE FROM orders WHERE customerId = '${customerId}'`);
  console.log('✔ Dọn dẹp hoàn tất!\n');

  console.log('================================================================');
  console.log('ALL DISTRIBUTED IDEMPOTENCY TESTS PASSED SUCCESSFULLY! (100% GREEN)');
  console.log('================================================================');
} finally {
  await prisma.$disconnect();
}
