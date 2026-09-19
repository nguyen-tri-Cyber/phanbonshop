/**
 * End-to-End Test Suite: Production-Grade Password Reset
 *
 * Kịch bản kiểm thử:
 * 1. Generic Response khi email không tồn tại (chống Email Enumeration)
 * 2. Quên mật khẩu với email hợp lệ -> response giống Test 1
 * 3. Đặt lại mật khẩu với token hợp lệ -> thành công
 * 4. Đăng nhập bằng mật khẩu mới -> thành công
 * 5. Đăng nhập bằng mật khẩu cũ -> thất bại 401
 * 6. Tái sử dụng token đã dùng -> thất bại 400
 * 7. Token hết hạn -> thất bại 400
 * 8. Refresh token cũ bị revoke sau password reset -> thất bại 401
 *
 * Test script sử dụng thuần API calls + MySQL CLI cho DB queries.
 * Yêu cầu: auth-service chạy tại port 3001, MySQL tại localhost:3307.
 */

import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { execSync } from 'node:child_process';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
const MYSQL_PORT = process.env.MYSQL_PORT || '3307';
const MYSQL_USER = process.env.MYSQL_USER || 'phanbon_user';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || 'phanbon_secret';

console.log('================================================================');
console.log('STARTING E2E TESTS: PRODUCTION-GRADE PASSWORD RESET');
console.log(`AUTH_SERVICE_URL: ${AUTH_URL}`);
console.log('================================================================\n');

// ---- Helpers ----

async function post(path, body) {
  const res = await fetch(`${AUTH_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

function mysqlQuery(sql) {
  const cmd = `docker exec phanbonshop_mysql mysql -u${MYSQL_USER} -p${MYSQL_PASSWORD} auth_db -N -e "${sql.replace(/"/g, '\\"')}"`;
  try {
    const result = execSync(cmd, { encoding: 'utf-8', timeout: 10000 });
    return result.trim();
  } catch (e) {
    console.error(`MySQL query failed: ${sql}`);
    throw e;
  }
}

// ---- Unique test user ----
const TEST_SUFFIX = Date.now();
const TEST_EMAIL = `pw_reset_test_${TEST_SUFFIX}@phanbonshop.vn`;
const ORIGINAL_PASSWORD = 'OriginalPass@2026';
const NEW_PASSWORD = 'NewSecurePass@2026';
let testUserId = null;
let capturedResetToken = null;
let refreshTokenBeforeReset = null;

// ======================================================================
// SETUP: Tạo user thử nghiệm
// ======================================================================
console.log('▶ [SETUP] Đăng ký user thử nghiệm...');
const registerRes = await post('/api/v1/auth/register', {
  email: TEST_EMAIL,
  password: ORIGINAL_PASSWORD,
  fullName: 'Test Password Reset User',
});
assert.ok(
  registerRes.status === 200 || registerRes.status === 201,
  `Đăng ký user thất bại: status=${registerRes.status}, data=${JSON.stringify(registerRes.data)}`,
);
testUserId = registerRes.data.user?.id;
assert.ok(testUserId, 'Không lấy được userId sau đăng ký');
console.log(`✔ Tạo user thành công: ${TEST_EMAIL} (ID: ${testUserId})`);

// Đăng nhập để lấy refresh token (sẽ dùng ở Test 8)
const loginForRefresh = await post('/api/v1/auth/login', {
  email: TEST_EMAIL,
  password: ORIGINAL_PASSWORD,
});
assert.ok(loginForRefresh.status === 200 || loginForRefresh.status === 201);
refreshTokenBeforeReset = loginForRefresh.data.refreshToken;
assert.ok(refreshTokenBeforeReset, 'Không lấy được refresh token trước khi reset');
console.log('✔ Lấy refresh token trước reset thành công\n');

// ======================================================================
// TEST 1: Generic Response khi email không tồn tại
// ======================================================================
console.log('▶ [TEST 1] Generic Response khi email không tồn tại...');
const test1Res = await post('/api/v1/auth/forgot-password', {
  email: `nonexistent_${TEST_SUFFIX}@example.com`,
});
assert.ok(
  test1Res.status === 200 || test1Res.status === 201,
  `Expected 200/201, got ${test1Res.status}`,
);
assert.ok(
  test1Res.data.message && test1Res.data.message.includes('Nếu email tồn tại'),
  `Response phải chứa generic message. Nhận: ${test1Res.data.message}`,
);

// Kiểm tra DB: không có token nào cho email không tồn tại
const tokenCountNonExist = mysqlQuery(
  `SELECT COUNT(*) FROM password_reset_tokens prt INNER JOIN users u ON prt.userId = u.id WHERE u.email = 'nonexistent_${TEST_SUFFIX}@example.com'`
);
assert.strictEqual(tokenCountNonExist, '0', 'Không được tạo token cho email không tồn tại');
console.log('✔ [TEST 1 PASSED] Generic response, không rò rỉ thông tin, không tạo token\n');

// ======================================================================
// TEST 2: Quên mật khẩu với email hợp lệ
// ======================================================================
console.log('▶ [TEST 2] Quên mật khẩu với email hợp lệ...');
const test2Res = await post('/api/v1/auth/forgot-password', {
  email: TEST_EMAIL,
});
assert.ok(
  test2Res.status === 200 || test2Res.status === 201,
  `Expected 200/201, got ${test2Res.status}`,
);
assert.ok(
  test2Res.data.message && test2Res.data.message.includes('Nếu email tồn tại'),
  `Response phải giống generic message. Nhận: ${test2Res.data.message}`,
);

// Kiểm tra DB: token hash phải được tạo
const tokenInfo = mysqlQuery(
  `SELECT tokenHash, expiresAt, usedAt FROM password_reset_tokens WHERE userId = '${testUserId}' AND usedAt IS NULL ORDER BY createdAt DESC LIMIT 1`
);
assert.ok(tokenInfo.length > 0, 'Phải có bản ghi password_reset_tokens trong DB');
const tokenHash = tokenInfo.split('\t')[0];
assert.ok(
  tokenHash && tokenHash.length === 64,
  `tokenHash phải là SHA-256 (64 hex chars). Nhận length=${tokenHash?.length}`,
);

// Để lấy plaintext token cho test tiếp theo, tạo token mới trực tiếp trong DB
// (vì DevEmailProvider log ở in-process, ta không truy cập được từ test script bên ngoài)
const testPlainToken = randomBytes(32).toString('hex');
const testTokenHash = sha256(testPlainToken);
const expiresAtMs = Date.now() + 15 * 60 * 1000;
const expiresAtStr = new Date(expiresAtMs).toISOString().slice(0, 19).replace('T', ' ');

// Invalidate token từ forgot-password call, rồi insert token ta kiểm soát
mysqlQuery(
  `UPDATE password_reset_tokens SET usedAt = NOW() WHERE userId = '${testUserId}' AND usedAt IS NULL`
);
mysqlQuery(
  `INSERT INTO password_reset_tokens (id, userId, tokenHash, expiresAt, createdAt) VALUES (UUID(), '${testUserId}', '${testTokenHash}', '${expiresAtStr}', NOW())`
);
capturedResetToken = testPlainToken;

console.log('✔ [TEST 2 PASSED] Token hash tạo trong DB, response generic chống enumeration\n');

// ======================================================================
// TEST 3: Đặt lại mật khẩu với token hợp lệ
// ======================================================================
console.log('▶ [TEST 3] Đặt lại mật khẩu với token hợp lệ...');
const test3Res = await post('/api/v1/auth/reset-password', {
  resetToken: capturedResetToken,
  newPassword: NEW_PASSWORD,
});
assert.ok(
  test3Res.status === 200 || test3Res.status === 201,
  `Expected 200/201, got ${test3Res.status}. Data: ${JSON.stringify(test3Res.data)}`,
);
assert.ok(
  test3Res.data.message && test3Res.data.message.includes('thành công'),
  `Response phải chứa thông báo thành công. Nhận: ${test3Res.data.message}`,
);

// Kiểm tra DB: usedAt phải được gán
const usedAt = mysqlQuery(
  `SELECT usedAt FROM password_reset_tokens WHERE tokenHash = '${testTokenHash}'`
);
assert.ok(usedAt && usedAt !== 'NULL', 'usedAt phải được gán sau khi reset');

// Kiểm tra DB: audit log ghi PASSWORD_RESET
const auditCount = mysqlQuery(
  `SELECT COUNT(*) FROM audit_logs WHERE actorId = '${testUserId}' AND action = 'PASSWORD_RESET'`
);
assert.ok(parseInt(auditCount) > 0, 'Phải có audit log PASSWORD_RESET');

console.log('✔ [TEST 3 PASSED] Mật khẩu đặt lại thành công, token marked as used, audit logged\n');

// ======================================================================
// TEST 4: Đăng nhập bằng mật khẩu mới -> thành công
// ======================================================================
console.log('▶ [TEST 4] Đăng nhập bằng mật khẩu mới...');
const test4Res = await post('/api/v1/auth/login', {
  email: TEST_EMAIL,
  password: NEW_PASSWORD,
});
assert.ok(
  test4Res.status === 200 || test4Res.status === 201,
  `Expected 200/201 khi đăng nhập bằng mật khẩu mới, got ${test4Res.status}. Data: ${JSON.stringify(test4Res.data)}`,
);
assert.ok(test4Res.data.accessToken, 'Phải nhận được accessToken');
assert.ok(test4Res.data.refreshToken, 'Phải nhận được refreshToken');
console.log('✔ [TEST 4 PASSED] Đăng nhập bằng mật khẩu mới thành công\n');

// ======================================================================
// TEST 5: Đăng nhập bằng mật khẩu cũ -> thất bại 401
// ======================================================================
console.log('▶ [TEST 5] Đăng nhập bằng mật khẩu cũ -> 401...');
const test5Res = await post('/api/v1/auth/login', {
  email: TEST_EMAIL,
  password: ORIGINAL_PASSWORD,
});
assert.strictEqual(test5Res.status, 401, `Expected 401 khi dùng mật khẩu cũ, got ${test5Res.status}`);
console.log('✔ [TEST 5 PASSED] Mật khẩu cũ bị từ chối 401 Unauthorized\n');

// ======================================================================
// TEST 6: Tái sử dụng token đã dùng -> thất bại 400
// ======================================================================
console.log('▶ [TEST 6] Tái sử dụng token đã dùng -> 400...');
const test6Res = await post('/api/v1/auth/reset-password', {
  resetToken: capturedResetToken,
  newPassword: 'AnotherPass@999',
});
assert.strictEqual(test6Res.status, 400, `Expected 400, got ${test6Res.status}`);
assert.ok(
  test6Res.data.message && test6Res.data.message.includes('đã được sử dụng'),
  `Message phải nói token đã dùng. Nhận: ${test6Res.data.message}`,
);
console.log('✔ [TEST 6 PASSED] Token reuse bị từ chối 400 Bad Request\n');

// ======================================================================
// TEST 7: Token hết hạn -> thất bại 400
// ======================================================================
console.log('▶ [TEST 7] Token hết hạn -> 400...');
const expiredPlainToken = randomBytes(32).toString('hex');
const expiredTokenHash = sha256(expiredPlainToken);
const expiredAtStr = new Date(Date.now() - 10 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

mysqlQuery(
  `INSERT INTO password_reset_tokens (id, userId, tokenHash, expiresAt, createdAt) VALUES (UUID(), '${testUserId}', '${expiredTokenHash}', '${expiredAtStr}', NOW())`
);

const test7Res = await post('/api/v1/auth/reset-password', {
  resetToken: expiredPlainToken,
  newPassword: 'ExpiredTest@123',
});
assert.strictEqual(test7Res.status, 400, `Expected 400, got ${test7Res.status}`);
assert.ok(
  test7Res.data.message && test7Res.data.message.includes('hết hạn'),
  `Message phải nói token hết hạn. Nhận: ${test7Res.data.message}`,
);
console.log('✔ [TEST 7 PASSED] Token hết hạn bị từ chối 400 Bad Request\n');

// ======================================================================
// TEST 8: Refresh token cũ bị revoke sau password reset -> 401
// ======================================================================
console.log('▶ [TEST 8] Refresh token cũ bị revoke sau password reset -> 401...');
const test8Res = await post('/api/v1/auth/refresh', {
  refreshToken: refreshTokenBeforeReset,
});
assert.strictEqual(
  test8Res.status,
  401,
  `Expected 401 cho refresh token cũ đã bị revoke, got ${test8Res.status}`,
);
console.log('✔ [TEST 8 PASSED] Refresh token cũ bị revoke, trả về 401 Unauthorized\n');

// ======================================================================
// CLEANUP: Xóa user thử nghiệm
// ======================================================================
console.log('▶ [CLEANUP] Xóa user thử nghiệm...');
mysqlQuery(`DELETE FROM audit_logs WHERE actorId = '${testUserId}'`);
mysqlQuery(`DELETE FROM password_reset_tokens WHERE userId = '${testUserId}'`);
mysqlQuery(`DELETE FROM refresh_token_sessions WHERE userId = '${testUserId}'`);
mysqlQuery(`DELETE FROM users WHERE id = '${testUserId}'`);
console.log('✔ Cleanup hoàn tất\n');

console.log('================================================================');
console.log('ALL E2E PASSWORD RESET TESTS PASSED SUCCESSFULLY! (8/8 GREEN)');
console.log('================================================================');
