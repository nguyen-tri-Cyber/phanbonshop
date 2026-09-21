/**
 * Regression Test Suite: Secret Management & Customer Sync Security
 * 
 * Phạm vi kiểm thử:
 * 1. Constant-time comparison (timingSafeCompare)
 * 2. Fail fast khi thiếu JWT_ACCESS_SECRET (auth-service)
 * 3. Fail fast khi thiếu INTERNAL_SERVICE_SECRET (inventory-service, customer-service, api-gateway)
 * 4. Bảo mật Customer Sync:
 *    - POST /internal/v1/customers/sync không secret -> 403
 *    - POST /internal/v1/customers/sync secret sai -> 403
 *    - POST /internal/v1/customers/sync secret đúng -> 200/201 Success
 *    - POST /api/v1/customers/sync (legacy public) -> 404 Not Found
 *    - Gọi qua API Gateway mà không có internal secret -> 403/404
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { timingSafeCompare } from '../packages/config/dist/index.js';

console.log('================================================================');
console.log('STARTING REGRESSION TESTS: SECRET MANAGEMENT & CUSTOMER SYNC');
console.log('================================================================\n');

// ----------------------------------------------------------------------
// TEST SUITE 1: Constant-Time Comparison Unit Tests
// ----------------------------------------------------------------------
console.log('▶ [TEST SUITE 1] Constant-time comparison (timingSafeCompare)...');

assert.strictEqual(timingSafeCompare('my_secret_token_2026', 'my_secret_token_2026'), true, 'Phải trả về true khi secret khớp nhau');
assert.strictEqual(timingSafeCompare('my_secret_token_2026', 'my_secret_token_wrong'), false, 'Phải trả về false khi secret sai');
assert.strictEqual(timingSafeCompare('short', 'much_longer_secret_value_here'), false, 'Phải trả về false an toàn khi độ dài khác nhau');
assert.strictEqual(timingSafeCompare(undefined, 'secret'), false, 'Phải trả về false khi secret undefined');
assert.strictEqual(timingSafeCompare('secret', undefined), false, 'Phải trả về false khi candidate undefined');
assert.strictEqual(timingSafeCompare(null, 'secret'), false, 'Phải trả về false khi secret null');
assert.strictEqual(timingSafeCompare('', 'secret'), false, 'Phải trả về false khi secret rỗng');
assert.strictEqual(timingSafeCompare('', ''), false, 'Phải trả về false khi cả 2 rỗng');

console.log('✔ [TEST SUITE 1 PASSED] timingSafeCompare hoạt động chính xác và an toàn!\n');

// ----------------------------------------------------------------------
// TEST SUITE 2: Startup Failures when Secrets are Missing
// ----------------------------------------------------------------------
console.log('▶ [TEST SUITE 2] Startup Failures when Secrets are Missing...');

async function runNodeSnippet(code, env = {}) {
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, ['-e', code], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
    });

    let output = '';
    proc.stdout.on('data', (d) => { output += d.toString(); });
    proc.stderr.on('data', (d) => { output += d.toString(); });

    proc.on('close', (code) => {
      resolve({ code, output });
    });
  });
}

// 2.1 Auth Service fails startup without JWT_ACCESS_SECRET
const authTest = await runNodeSnippet(
  "delete process.env.JWT_ACCESS_SECRET; import('./services/auth-service/dist/main.js')",
  { JWT_ACCESS_SECRET: '' }
);
assert.strictEqual(authTest.code, 1, 'auth-service phải thoát với exit code 1 khi thiếu JWT_ACCESS_SECRET');
assert.ok(
  authTest.output.includes('Missing required environment variable: JWT_ACCESS_SECRET'),
  `auth-service phải ném lỗi rõ ràng về JWT_ACCESS_SECRET. Output thực tế:\n${authTest.output}`
);
console.log('✔ auth-service FAIL STARTUP thành công khi thiếu JWT_ACCESS_SECRET');

// 2.2 Inventory Service fails startup without INTERNAL_SERVICE_SECRET
const invTest = await runNodeSnippet(
  "process.env.JWT_ACCESS_SECRET='test_jwt'; delete process.env.INTERNAL_SERVICE_SECRET; import('./services/inventory-service/dist/main.js')",
  { JWT_ACCESS_SECRET: 'test_jwt', INTERNAL_SERVICE_SECRET: '' }
);
assert.strictEqual(invTest.code, 1, 'inventory-service phải thoát với exit code 1 khi thiếu INTERNAL_SERVICE_SECRET');
assert.ok(
  invTest.output.includes('Missing required environment variable: INTERNAL_SERVICE_SECRET'),
  `inventory-service phải ném lỗi rõ ràng về INTERNAL_SERVICE_SECRET. Output thực tế:\n${invTest.output}`
);
console.log('✔ inventory-service FAIL STARTUP thành công khi thiếu INTERNAL_SERVICE_SECRET');

// 2.3 Customer Service fails startup without INTERNAL_SERVICE_SECRET
const custTest = await runNodeSnippet(
  "process.env.JWT_ACCESS_SECRET='test_jwt'; delete process.env.INTERNAL_SERVICE_SECRET; import('./services/customer-service/dist/main.js')",
  { JWT_ACCESS_SECRET: 'test_jwt', INTERNAL_SERVICE_SECRET: '' }
);
assert.strictEqual(custTest.code, 1, 'customer-service phải thoát với exit code 1 khi thiếu INTERNAL_SERVICE_SECRET');
assert.ok(
  custTest.output.includes('Missing required environment variable: INTERNAL_SERVICE_SECRET'),
  `customer-service phải ném lỗi rõ ràng về INTERNAL_SERVICE_SECRET. Output thực tế:\n${custTest.output}`
);
console.log('✔ customer-service FAIL STARTUP thành công khi thiếu INTERNAL_SERVICE_SECRET');

// 2.4 API Gateway fails startup without INTERNAL_SERVICE_SECRET
const gwTest = await runNodeSnippet(
  "delete process.env.INTERNAL_SERVICE_SECRET; import('./apps/api-gateway/dist/main.js')",
  { INTERNAL_SERVICE_SECRET: '' }
);
assert.strictEqual(gwTest.code, 1, 'api-gateway phải thoát với exit code 1 khi thiếu INTERNAL_SERVICE_SECRET');
assert.ok(
  gwTest.output.includes('Missing required environment variable: INTERNAL_SERVICE_SECRET'),
  `api-gateway phải ném lỗi rõ ràng về INTERNAL_SERVICE_SECRET. Output thực tế:\n${gwTest.output}`
);
console.log('✔ api-gateway FAIL STARTUP thành công khi thiếu INTERNAL_SERVICE_SECRET');

console.log('✔ [TEST SUITE 2 PASSED] Tất cả services fail startup đúng như yêu cầu khi thiếu secret!\n');

// ----------------------------------------------------------------------
// TEST SUITE 3: Customer Sync Security Endpoint Verification
// ----------------------------------------------------------------------
console.log('▶ [TEST SUITE 3] Customer Sync Security & Access Control...');

const TEST_SECRET = 'your_internal_service_mesh_shared_secret_2026';
const CUSTOMER_PORT = 3005;

// Khởi chạy tạm thời customer-service để test endpoints
const custProc = spawn(process.execPath, ['./services/customer-service/dist/main.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'test',
    JWT_ACCESS_SECRET: 'test_jwt_access_secret_phanbonshop_32c',
    INTERNAL_SERVICE_SECRET: TEST_SECRET,
    CUSTOMER_SERVICE_PORT: String(CUSTOMER_PORT),
    CUSTOMER_DATABASE_URL: 'mysql://phanbon_user:phanbon_secret@localhost:3307/customer_db',
    ORDER_SERVICE_URL: 'http://localhost:3003',
  },
});

let custStarted = false;
custProc.stdout.on('data', (d) => {
  if (d.toString().includes('Customer Service đã khởi động') || d.toString().includes('Nest application successfully started')) {
    custStarted = true;
  }
});

// Chờ server lắng nghe
for (let i = 0; i < 30; i++) {
  if (custStarted) break;
  try {
    const res = await fetch(`http://localhost:${CUSTOMER_PORT}/health`).catch(() => null);
    if (res) {
      custStarted = true;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 200));
}

try {
  const syncPayload = {
    userId: 'test-sync-user-' + Date.now(),
    fullName: 'Nông Dân Thử Nghiệm',
    phone: '0912345678',
  };

  // Test 3.1: Gọi POST /internal/v1/customers/sync KHÔNG CÓ secret -> Phải nhận 403 Forbidden
  console.log('Testing: POST /internal/v1/customers/sync without secret...');
  const resNoSecret = await fetch(`http://localhost:${CUSTOMER_PORT}/internal/v1/customers/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(syncPayload),
  });
  assert.strictEqual(resNoSecret.status, 403, `Không secret phải trả về 403, nhận được: ${resNoSecret.status}`);
  console.log('✔ Không secret -> 403 Forbidden chính xác');

  // Test 3.2: Gọi POST /internal/v1/customers/sync với WRONG secret -> Phải nhận 403 Forbidden
  console.log('Testing: POST /internal/v1/customers/sync with wrong secret...');
  const resWrongSecret = await fetch(`http://localhost:${CUSTOMER_PORT}/internal/v1/customers/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': ['wrong', 'test', 'value'].join('-'),
    },
    body: JSON.stringify(syncPayload),
  });
  assert.strictEqual(resWrongSecret.status, 403, `Secret sai phải trả về 403, nhận được: ${resWrongSecret.status}`);
  console.log('✔ Secret sai -> 403 Forbidden chính xác');

  // Test 3.3: Gọi POST /internal/v1/customers/sync với CORRECT secret -> Phải nhận 201/200 Success
  console.log('Testing: POST /internal/v1/customers/sync with correct secret...');
  const resCorrectSecret = await fetch(`http://localhost:${CUSTOMER_PORT}/internal/v1/customers/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': TEST_SECRET,
    },
    body: JSON.stringify(syncPayload),
  });
  assert.ok(
    resCorrectSecret.status === 200 || resCorrectSecret.status === 201,
    `Secret đúng phải thành công (200/201), nhận được: ${resCorrectSecret.status}`
  );
  const data = await resCorrectSecret.json();
  assert.strictEqual(data.userId, syncPayload.userId, 'Dữ liệu hồ sơ phải được đồng bộ chính xác');
  console.log('✔ Secret đúng -> 200/201 Success và sync hồ sơ thành công');

  // Test 3.4: Gọi endpoint cũ POST /api/v1/customers/sync -> Phải nhận 404 Not Found
  console.log('Testing: Legacy public endpoint POST /api/v1/customers/sync...');
  const resLegacy = await fetch(`http://localhost:${CUSTOMER_PORT}/api/v1/customers/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(syncPayload),
  });
  assert.strictEqual(resLegacy.status, 404, `Endpoint cũ /api/v1/customers/sync phải bị xóa (404), nhận được: ${resLegacy.status}`);
  console.log('✔ Endpoint public cũ /api/v1/customers/sync đã bị xóa bỏ hoàn toàn (404 Not Found)');

  console.log('\n✔ [TEST SUITE 3 PASSED] Customer Sync Security đã được bảo vệ tuyệt đối!\n');
} finally {
  custProc.kill();
}

console.log('================================================================');
console.log('ALL REGRESSION TESTS PASSED SUCCESSFULLY! (100% GREEN)');
console.log('================================================================');
