import assert from 'node:assert/strict';

const GATEWAY_URL = 'http://localhost:8080/api/v1';

async function run() {
  console.log('====================================================');
  console.log('🔒 BẮT ĐẦU KIỂM THỬ AN NINH: AUTHENTICATION & RBAC (8 & 9)');
  console.log('====================================================\n');

  // --- 8. AUTHENTICATION SECURITY TESTS ---
  console.log('1. Kiểm tra đăng nhập với sai mật khẩu...');
  const wrongPassRes = await fetch(`${GATEWAY_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@phanbonshop.vn',
      password: 'WrongPassword@999',
    }),
  });
  assert.strictEqual(wrongPassRes.status, 401, 'Đăng nhập sai mật khẩu phải trả về 401 Unauthorized');
  console.log('✅ Đăng nhập sai mật khẩu bị từ chối 401 chính xác.\n');

  console.log('2. Đăng ký tài khoản Customer test để thử nghiệm bảo mật token...');
  const testEmail = `auth.test.${Date.now()}@phanbonshop.vn`;
  const regRes = await fetch(`${GATEWAY_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'Customer@123456',
      fullName: 'Khách Hàng Bảo Mật Test',
      phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
    }),
  });
  assert.ok(regRes.ok, `Đăng ký customer test phải thành công, status=${regRes.status}`);
  const regData = await regRes.json();
  const customerToken = regData.data?.accessToken || regData.accessToken;
  const refreshToken1 = regData.data?.refreshToken || regData.refreshToken;
  assert.ok(customerToken && refreshToken1, 'Phải nhận được accessToken và refreshToken');
  console.log('✅ Đã đăng ký customer test và nhận cặp tokens.\n');

  console.log('3. Kiểm tra token giả mạo / không hợp lệ...');
  const fakeTokenRes = await fetch(`${GATEWAY_URL}/customers/me`, {
    headers: { Authorization: 'Bearer fake.invalid.jwt.token' },
  });
  assert.strictEqual(fakeTokenRes.status, 401, 'Access token giả mạo phải trả về 401');
  console.log('✅ Access token không hợp lệ bị từ chối 401.\n');

  console.log('4. Kiểm tra xoay vòng Refresh Token (Token Rotation)...');
  const refreshRes1 = await fetch(`${GATEWAY_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refreshToken1 }),
  });
  assert.ok(refreshRes1.ok, 'Lần refresh đầu tiên phải thành công');
  const refreshData1 = await refreshRes1.json();
  const refreshToken2 = refreshData1.data?.refreshToken || refreshData1.refreshToken;
  assert.ok(refreshToken2, 'Phải nhận được refreshToken mới sau xoay vòng');
  assert.notStrictEqual(refreshToken1, refreshToken2, 'Refresh token mới phải khác refresh token cũ');
  console.log('✅ Xoay vòng Refresh token thành công, nhận refreshToken mới.\n');

  console.log('5. Kiểm tra phát hiện tái sử dụng Refresh token cũ (Rotated Token Reuse Detection)...');
  const reuseRes = await fetch(`${GATEWAY_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refreshToken1 }),
  });
  assert.strictEqual(reuseRes.status, 401, 'Dùng lại refresh token cũ đã bị thu hồi/xoay vòng phải bị từ chối 401');
  console.log('✅ Phát hiện tái sử dụng refresh token cũ thành công (trả về 401).\n');

  console.log('6. Kiểm tra Logout-All (thu hồi toàn bộ phiên đăng nhập)...');
  const logoutAllRes = await fetch(`${GATEWAY_URL}/auth/logout-all`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${refreshData1.data?.accessToken || refreshData1.accessToken}`,
    },
  });
  assert.ok(logoutAllRes.ok, 'Logout-all phải thành công');
  
  // Sau logout-all, refresh token 2 cũng phải bị từ chối
  const refreshAfterLogoutAll = await fetch(`${GATEWAY_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refreshToken2 }),
  });
  assert.strictEqual(refreshAfterLogoutAll.status, 401, 'Sau logout-all, toàn bộ refresh tokens đều bị vô hiệu hóa 401');
  console.log('✅ Logout-all thu hồi toàn bộ phiên đăng nhập thành công.\n');

  // --- 9. AUTHORIZATION (RBAC) TESTS ---
  console.log('--- BẮT ĐẦU KIỂM THỬ PHÂN QUYỀN RBAC (CUSTOMER GỌI CÁC ROUTE ADMIN) ---');

  // Đăng nhập lại lấy token Customer
  const custLogin = await fetch(`${GATEWAY_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'Customer@123456',
    }),
  });
  const custLoginData = await custLogin.json();
  const activeCustomerToken = custLoginData.data?.accessToken || custLoginData.accessToken;

  console.log('7. CUSTOMER gọi POST /products (Admin tạo sản phẩm) -> Mong đợi 403 Forbidden...');
  const prodRes = await fetch(`${GATEWAY_URL}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${activeCustomerToken}`,
    },
    body: JSON.stringify({
      name: 'Sản phẩm hack',
      slug: 'san-pham-hack',
      categoryId: 'any-cat-id',
      brandId: 'any-brand-id',
      description: 'Test hack',
      variants: [],
    }),
  });
  assert.strictEqual(prodRes.status, 403, 'Customer gọi tạo sản phẩm phải bị chặn 403');
  console.log('✅ RBAC: Customer tạo sản phẩm bị chặn 403 Forbidden.');

  console.log('8. CUSTOMER gọi POST /inventory/adjust (Admin điều chỉnh tồn kho) -> Mong đợi 403 Forbidden...');
  const invRes = await fetch(`${GATEWAY_URL}/inventory/adjust`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${activeCustomerToken}`,
    },
    body: JSON.stringify({
      productId: 'any-prod-id',
      variantId: 'any-var-id',
      quantityChange: 100,
      reason: 'Hack tồn kho',
    }),
  });
  assert.strictEqual(invRes.status, 403, 'Customer gọi điều chỉnh tồn kho phải bị chặn 403');
  console.log('✅ RBAC: Customer điều chỉnh tồn kho bị chặn 403 Forbidden.');

  console.log('9. CUSTOMER gọi POST /payments/:id/confirm (Admin xác nhận thanh toán) -> Mong đợi 403 Forbidden...');
  const payRes = await fetch(`${GATEWAY_URL}/payments/any-payment-id/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${activeCustomerToken}`,
    },
    body: JSON.stringify({
      transactionReference: 'HACK123',
    }),
  });
  assert.strictEqual(payRes.status, 403, 'Customer gọi xác nhận thanh toán phải bị chặn 403');
  console.log('✅ RBAC: Customer xác nhận thanh toán bị chặn 403 Forbidden.');

  console.log('10. CUSTOMER gọi PATCH /orders/admin/:id/status (Admin chuyển trạng thái đơn) -> Mong đợi 403 Forbidden...');
  const ordRes = await fetch(`${GATEWAY_URL}/orders/admin/any-order-id/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${activeCustomerToken}`,
    },
    body: JSON.stringify({
      status: 'CONFIRMED',
    }),
  });
  assert.strictEqual(ordRes.status, 403, 'Customer gọi cập nhật trạng thái đơn admin phải bị chặn 403');
  console.log('✅ RBAC: Customer cập nhật trạng thái đơn hàng bị chặn 403 Forbidden.');

  console.log('\n====================================================');
  console.log('🎉 TẤT CẢ CÁC BƯỚC KIỂM THỬ AUTHENTICATION & RBAC ĐÃ PASS 100%!');
  console.log('====================================================');
}

run().catch((err) => {
  console.error('❌ Kiểm thử Authentication & RBAC thất bại:', err);
  process.exit(1);
});
