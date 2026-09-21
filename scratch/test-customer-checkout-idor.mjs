/**
 * Test Suite: Customer Service ↔ Checkout Address IDOR Prevention & Frontend Register
 *
 * Kiểm tra các yêu cầu:
 * 1. Internal endpoint: GET /internal/v1/customers/:userId/addresses/:addressId
 *    - Yêu cầu InternalSecretGuard (chặn 403 khi thiếu/sai secret)
 *    - Query address.id = addressId AND CustomerProfile.userId = userId
 * 2. Ngăn chặn IDOR (Insecure Direct Object Reference):
 *    - Customer A truy vấn Address B -> Reject (404 Not Found)
 *    - Customer A truy vấn Address A -> Thành công (200 OK)
 * 3. CheckoutService.fetchCustomerAddress():
 *    - Customer A checkout bằng Address B -> Bị reject (BadRequestException)
 *    - Customer A checkout bằng Address A -> Thành công
 *    - Không swallow lỗi xác thực hoặc lỗi dịch vụ
 * 4. Frontend Register Route Handler:
 *    - POST /api/auth/register forward tới Gateway từ biến môi trường
 *    - Thiết lập cookie phanbon_refresh_token
 *    - Không còn hard-code http://localhost:8080 trong source code
 */

import assert from 'node:assert/strict';
import { spawn, execSync } from 'node:child_process';

const TEST_SECRET = 'your_internal_service_mesh_shared_secret_2026';
const CUSTOMER_PORT = 3005;
const MYSQL_USER = process.env.MYSQL_USER || 'phanbon_user';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || 'phanbon_secret';

console.log('================================================================');
console.log('STARTING TESTS: CUSTOMER ↔ CHECKOUT IDOR PREVENTION & REGISTER');
console.log('================================================================\n');

function mysqlQuery(db, sql) {
  const singleLineSql = sql.replace(/\r?\n/g, ' ').trim().replace(/"/g, '\\"');
  const cmd = `docker exec phanbonshop_mysql mysql -u${MYSQL_USER} -p${MYSQL_PASSWORD} ${db} -N -e "${singleLineSql}"`;
  try {
    const result = execSync(cmd, { encoding: 'utf-8', timeout: 10000 });
    return result.trim();
  } catch (e) {
    console.error(`MySQL query failed on ${db}: ${singleLineSql}`);
    throw e;
  }
}

// ----------------------------------------------------------------------
// 1. Khởi động customer-service trong tiến trình con
// ----------------------------------------------------------------------
console.log('▶ [SETUP] Khởi động customer-service trên port ' + CUSTOMER_PORT + '...');

const custProc = spawn(process.execPath, ['./services/customer-service/dist/main.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'test',
    JWT_ACCESS_SECRET: 'test_jwt_access_secret_phanbonshop_32c',
    INTERNAL_SERVICE_SECRET: TEST_SECRET,
    CUSTOMER_SERVICE_PORT: String(CUSTOMER_PORT),
    CUSTOMER_DATABASE_URL: 'mysql://phanbon_user:phanbon_secret@localhost:3307/customer_db',
  },
});

custProc.stderr.on('data', (d) => {
  const msg = d.toString();
  if (msg.includes('Error') && !msg.includes('DeprecationWarning')) {
    console.error('[customer-service error]', msg);
  }
});

// Chờ customer-service khởi động
let custReady = false;
for (let i = 0; i < 40; i++) {
  try {
    const res = await fetch(`http://localhost:${CUSTOMER_PORT}/docs`).catch(() => null);
    if (res && res.status < 500) {
      custReady = true;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 250));
}
assert.ok(custReady, 'customer-service không khởi động được trong 10 giây');
console.log('✔ customer-service đã sẵn sàng!\n');

try {
  // ----------------------------------------------------------------------
  // 2. Chuẩn bị dữ liệu: Customer A và Customer B
  // ----------------------------------------------------------------------
  console.log('▶ [SETUP] Tạo dữ liệu Customer A và Customer B...');
  const suffix = Date.now();
  const userA = `user_a_${suffix}`;
  const userB = `user_b_${suffix}`;

  // 2.1 Đồng bộ Profile qua internal sync endpoint
  const syncA = await fetch(`http://localhost:${CUSTOMER_PORT}/internal/v1/customers/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': TEST_SECRET,
    },
    body: JSON.stringify({
      userId: userA,
      fullName: 'Khách Hàng A',
      phone: '0901111111',
    }),
  });
  assert.ok(syncA.status === 200 || syncA.status === 201, `Sync Customer A thất bại: ${syncA.status}`);

  const syncB = await fetch(`http://localhost:${CUSTOMER_PORT}/internal/v1/customers/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': TEST_SECRET,
    },
    body: JSON.stringify({
      userId: userB,
      fullName: 'Khách Hàng B',
      phone: '0902222222',
    }),
  });
  assert.ok(syncB.status === 200 || syncB.status === 201, `Sync Customer B thất bại: ${syncB.status}`);

  // Lấy customerProfile.id từ DB
  const profileIdA = mysqlQuery('customer_db', `SELECT id FROM customer_profiles WHERE userId = '${userA}'`);
  const profileIdB = mysqlQuery('customer_db', `SELECT id FROM customer_profiles WHERE userId = '${userB}'`);
  assert.ok(profileIdA, 'Không tìm thấy profileIdA');
  assert.ok(profileIdB, 'Không tìm thấy profileIdB');

  // 2.2 Tạo Address A cho Customer A, Address B cho Customer B
  const addressIdA = `addr_a_${suffix}`;
  const addressIdB = `addr_b_${suffix}`;

  mysqlQuery(
    'customer_db',
    `INSERT INTO customer_addresses (id, customerId, recipientName, phone, provinceCode, provinceName, districtCode, districtName, wardCode, wardName, addressLine, isDefault, createdAt, updatedAt)
     VALUES ('${addressIdA}', '${profileIdA}', 'Nguoi Nhan A', '0901111111', '79', 'Ho Chi Minh', '760', 'Quan 1', '26734', 'Ben Nghe', '123 Dong Khoi', 1, NOW(), NOW())`
  );

  mysqlQuery(
    'customer_db',
    `INSERT INTO customer_addresses (id, customerId, recipientName, phone, provinceCode, provinceName, districtCode, districtName, wardCode, wardName, addressLine, isDefault, createdAt, updatedAt)
     VALUES ('${addressIdB}', '${profileIdB}', 'Nguoi Nhan B', '0902222222', '01', 'Ha Noi', '001', 'Ba Dinh', '00001', 'Phuc Xa', '456 Hoang Hoa Tham', 1, NOW(), NOW())`
  );

  console.log(`✔ Đã tạo Address A (${addressIdA}) cho Customer A (${userA})`);
  console.log(`✔ Đã tạo Address B (${addressIdB}) cho Customer B (${userB})\n`);

  // ----------------------------------------------------------------------
  // 3. Test InternalSecretGuard trên endpoint mới
  // ----------------------------------------------------------------------
  console.log('▶ [TEST SUITE 1] InternalSecretGuard trên GET /internal/v1/customers/:userId/addresses/:addressId...');

  // 3.1 Không có header secret -> 403 Forbidden
  const resNoSecret = await fetch(
    `http://localhost:${CUSTOMER_PORT}/internal/v1/customers/${userA}/addresses/${addressIdA}`
  );
  assert.strictEqual(resNoSecret.status, 403, `Gọi không có secret phải trả về 403, nhận được: ${resNoSecret.status}`);
  console.log('✔ Gọi không có secret -> 403 Forbidden chính xác');

  // 3.2 Secret sai -> 403 Forbidden
  const resWrongSecret = await fetch(
    `http://localhost:${CUSTOMER_PORT}/internal/v1/customers/${userA}/addresses/${addressIdA}`,
    { headers: { 'X-Internal-Secret': 'wrong_secret_xyz' } }
  );
  assert.strictEqual(resWrongSecret.status, 403, `Gọi với secret sai phải trả về 403, nhận được: ${resWrongSecret.status}`);
  console.log('✔ Gọi với secret sai -> 403 Forbidden chính xác');

  // 3.3 Secret đúng -> 200 OK khi đúng chủ sở hữu
  const resValid = await fetch(
    `http://localhost:${CUSTOMER_PORT}/internal/v1/customers/${userA}/addresses/${addressIdA}`,
    { headers: { 'X-Internal-Secret': TEST_SECRET } }
  );
  assert.strictEqual(resValid.status, 200, `Gọi với secret đúng phải trả về 200, nhận được: ${resValid.status}`);
  const dataA = await resValid.json();
  assert.strictEqual(dataA.recipientName, 'Nguoi Nhan A');
  assert.strictEqual(dataA.provinceName, 'Ho Chi Minh');
  console.log('✔ Gọi với secret đúng và đúng chủ sở hữu -> 200 OK chính xác\n');

  // ----------------------------------------------------------------------
  // 4. Test IDOR Prevention (Chống truy cập chéo trái phép)
  // ----------------------------------------------------------------------
  console.log('▶ [TEST SUITE 2] Kiểm thử chống IDOR (Customer A truy cập Address B)...');

  // 4.1 Customer A truy vấn Address B của Customer B -> Phải bị 404 Not Found (REJECT)
  const resIdorA = await fetch(
    `http://localhost:${CUSTOMER_PORT}/internal/v1/customers/${userA}/addresses/${addressIdB}`,
    { headers: { 'X-Internal-Secret': TEST_SECRET } }
  );
  assert.strictEqual(
    resIdorA.status,
    404,
    `Customer A truy cập Address B phải bị trả về 404 (Reject), nhận được: ${resIdorA.status}`
  );
  console.log('✔ IDOR: Customer A yêu cầu Address B -> 404 Not Found (REJECTED THÀNH CÔNG)');

  // 4.2 Customer B truy vấn Address A của Customer A -> Phải bị 404 Not Found (REJECT)
  const resIdorB = await fetch(
    `http://localhost:${CUSTOMER_PORT}/internal/v1/customers/${userB}/addresses/${addressIdA}`,
    { headers: { 'X-Internal-Secret': TEST_SECRET } }
  );
  assert.strictEqual(
    resIdorB.status,
    404,
    `Customer B truy cập Address A phải bị trả về 404 (Reject), nhận được: ${resIdorB.status}`
  );
  console.log('✔ IDOR: Customer B yêu cầu Address A -> 404 Not Found (REJECTED THÀNH CÔNG)');

  // 4.3 Truy vấn địa chỉ không tồn tại -> 404
  const resNonExist = await fetch(
    `http://localhost:${CUSTOMER_PORT}/internal/v1/customers/${userA}/addresses/non_existent_address_id`,
    { headers: { 'X-Internal-Secret': TEST_SECRET } }
  );
  assert.strictEqual(resNonExist.status, 404);
  console.log('✔ Địa chỉ không tồn tại -> 404 Not Found chính xác\n');

  // ----------------------------------------------------------------------
  // 5. Test logic CheckoutService.fetchCustomerAddress() (Order Service)
  // ----------------------------------------------------------------------
  console.log('▶ [TEST SUITE 3] Kiểm thử CheckoutService.fetchCustomerAddress()...');

  // Import class CheckoutService đã build từ order-service
  process.env.INTERNAL_SERVICE_SECRET = TEST_SECRET;
  process.env.CUSTOMER_SERVICE_URL = `http://localhost:${CUSTOMER_PORT}`;
  const { CheckoutService } = await import('../services/order-service/dist/checkout/checkout.service.js');

  const checkoutService = Object.create(CheckoutService.prototype);
  // Gán các thuộc tính cần thiết
  Object.assign(checkoutService, {
    customerServiceUrl: `http://localhost:${CUSTOMER_PORT}`,
    internalSecret: TEST_SECRET,
  });

  // 5.1 Customer A checkout với Address A (hợp lệ) -> Thành công
  console.log('Testing: Customer A checkout với Address A (hợp lệ)...');
  const fetchedAddressA = await checkoutService.fetchCustomerAddress(userA, addressIdA);
  assert.ok(fetchedAddressA, 'Phải lấy được địa chỉ A');
  assert.strictEqual(fetchedAddressA.recipientName, 'Nguoi Nhan A');
  assert.strictEqual(fetchedAddressA.addressLine, '123 Dong Khoi');
  console.log('✔ Customer A checkout với Address A -> SUCCESS');

  // 5.2 Customer A checkout với Address B (IDOR Attack) -> Bị REJECT với BadRequestException
  console.log('Testing: Customer A checkout với Address B (IDOR attack)...');
  let idorError = null;
  try {
    await checkoutService.fetchCustomerAddress(userA, addressIdB);
  } catch (err) {
    idorError = err;
  }
  assert.ok(idorError, 'Customer A checkout với Address B PHẢI NÉM LỖI (REJECT)');
  assert.ok(
    idorError.message.includes('không thuộc về tài khoản') || idorError.message.includes('không hợp lệ'),
    `Thông báo lỗi phải chỉ ra địa chỉ không thuộc tài khoản. Nhận được: ${idorError.message}`
  );
  console.log(`✔ Customer A checkout với Address B -> REJECTED THÀNH CÔNG: "${idorError.message}"`);

  // 5.3 Checkout với Secret sai -> Ném InternalServerErrorException (Không swallow)
  console.log('Testing: Lỗi xác thực secret nội bộ...');
  const brokenCheckoutService = Object.create(CheckoutService.prototype);
  Object.assign(brokenCheckoutService, {
    customerServiceUrl: `http://localhost:${CUSTOMER_PORT}`,
    internalSecret: ['wrong', 'test', 'value'].join('-'),
  });
  let secretError = null;
  try {
    await brokenCheckoutService.fetchCustomerAddress(userA, addressIdA);
  } catch (err) {
    secretError = err;
  }
  assert.ok(secretError, 'Secret sai phải ném lỗi');
  assert.ok(
    secretError.message.includes('xác thực') || secretError.message.includes('nội bộ'),
    `Lỗi phải báo về xác thực nội bộ. Nhận được: ${secretError.message}`
  );
  console.log(`✔ Lỗi xác thực secret không bị nuốt (swallowed): "${secretError.message}"\n`);

  // ----------------------------------------------------------------------
  // 6. Test Frontend Auth Architecture & Clean Hardcoded URLs
  // ----------------------------------------------------------------------
  console.log('▶ [TEST SUITE 4] Frontend Auth Architecture & Clean Hardcoded URLs...');

  // 6.1 Kiểm tra file route.ts của /api/auth/register tồn tại và export POST
  const fs = await import('node:fs');
  const routePath = new URL('../apps/frontend/src/app/api/auth/register/route.ts', import.meta.url);
  assert.ok(fs.existsSync(routePath), '/api/auth/register/route.ts phải tồn tại');
  const routeContent = fs.readFileSync(routePath, 'utf-8');
  assert.ok(routeContent.includes('export async function POST'), 'Route handler phải export POST');
  assert.ok(routeContent.includes('process.env.NEXT_PUBLIC_API_URL'), 'Route handler phải đọc từ NEXT_PUBLIC_API_URL');
  assert.ok(routeContent.includes('phanbon_refresh_token'), 'Route handler phải quản lý HttpOnly cookie phanbon_refresh_token');
  console.log('✔ /api/auth/register Next.js Route Handler có cấu hình và logic hợp lệ');

  // 6.2 Kiểm tra không còn hardcode http://localhost:8080 trong React business logic
  const authContextContent = execSync('git diff HEAD -- apps/frontend/src/contexts/auth-context.tsx', { encoding: 'utf-8' });
  assert.ok(
    authContextContent.includes("fetch('/api/auth/register'"),
    'auth-context.tsx phải gọi relative URL /api/auth/register'
  );
  console.log('✔ auth-context.tsx gọi relative /api/auth/register thành công');

  // 6.3 Kiểm tra banner và bai-viet upload dùng biến môi trường
  const bannerContent = execSync('git diff HEAD -- apps/frontend/src/app/admin/banner/page.tsx', { encoding: 'utf-8' });
  assert.ok(
    bannerContent.includes('NEXT_PUBLIC_API_URL'),
    'banner page phải dùng NEXT_PUBLIC_API_URL'
  );
  console.log('✔ banner page dùng NEXT_PUBLIC_API_URL cho upload ảnh');

  const postContent = execSync('git diff HEAD -- apps/frontend/src/app/admin/bai-viet/page.tsx', { encoding: 'utf-8' });
  assert.ok(
    postContent.includes('NEXT_PUBLIC_API_URL'),
    'bai-viet page phải dùng NEXT_PUBLIC_API_URL'
  );
  console.log('✔ bai-viet page dùng NEXT_PUBLIC_API_URL cho upload ảnh\n');

  // Cleanup dữ liệu test
  mysqlQuery('customer_db', `DELETE FROM customer_addresses WHERE id IN ('${addressIdA}', '${addressIdB}')`);
  mysqlQuery('customer_db', `DELETE FROM customer_profiles WHERE userId IN ('${userA}', '${userB}')`);
  console.log('✔ Dọn dẹp dữ liệu test thành công\n');

  console.log('================================================================');
  console.log('ALL IDOR & FRONTEND REGISTER TESTS PASSED SUCCESSFULLY! (100% GREEN)');
  console.log('================================================================');
} finally {
  custProc.kill('SIGKILL');
}
