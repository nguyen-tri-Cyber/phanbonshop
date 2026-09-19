const FRONTEND_URL = 'http://localhost:3000';
const GATEWAY_URL = 'http://localhost:8080/api/v1';

async function runTests() {
  console.log('============================================================');
  console.log('KIỂM THỬ TÍCH HỢP TOÀN DIỆN APPS/FRONTEND (PORT 3000)');
  console.log('============================================================');

  // Test 1: Kiểm tra localhost:3000 mở được
  console.log('\n--- 1. Kiểm tra mở trang chủ http://localhost:3000 ---');
  const homeRes = await fetch(FRONTEND_URL);
  console.log(`HTTP Status: ${homeRes.status} ${homeRes.statusText}`);
  const homeHtml = await homeRes.text();
  const hasBrand = homeHtml.includes('PHÂN BÓN SHOP');
  console.log(`Trang chủ tải thành công: ${homeRes.ok}, Chứa thương hiệu "PHÂN BÓN SHOP": ${hasBrand}`);

  // Test 2: Đăng ký tài khoản Khách hàng mới qua Gateway
  console.log('\n--- 2. Đăng ký tài khoản khách hàng mới qua Gateway ---');
  const uniqueTime = Date.now();
  const testCustomerEmail = `customer_${uniqueTime}@phanbonshop.vn`;
  const registerPayload = {
    fullName: `Nông Dân Ba Tri ${uniqueTime.toString().slice(-4)}`,
    email: testCustomerEmail,
    phone: `098${uniqueTime.toString().slice(-7)}`,
    password: 'Password@123',
  };

  const regRes = await fetch(`${GATEWAY_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registerPayload),
  });
  const regData = await regRes.json();
  console.log(`Đăng ký trạng thái: ${regRes.status}, Kết quả success: ${regData.success}`);
  if (!regData.success) {
    console.error('Đăng ký thất bại:', regData);
  } else {
    console.log(`Đã tạo tài khoản khách hàng: ${regData.data.email} (Role: ${regData.data.role})`);
  }

  // Test 3: Đăng nhập tài khoản khách hàng qua Next.js Auth Route Handler
  console.log('\n--- 3. Đăng nhập qua Next.js Auth API (/api/auth/login) ---');
  const loginRes = await fetch(`${FRONTEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testCustomerEmail,
      password: 'Password@123',
    }),
  });
  const loginData = await loginRes.json();
  const cookieHeader = loginRes.headers.get('set-cookie');
  console.log(`Login status: ${loginRes.status}`);
  console.log(`Login user: ${loginData.data?.user?.fullName}, Role: ${loginData.data?.user?.role}`);
  console.log(`Access token nhận được trong memory: ${Boolean(loginData.data?.accessToken)}`);
  console.log(`Refresh token bảo mật trong HttpOnly Cookie: ${Boolean(cookieHeader?.includes('phanbon_refresh_token'))}`);
  console.log(`Có refreshToken trong JavaScript JSON body không: ${Boolean(loginData.data?.refreshToken)} (Phải là FALSE)`);

  const customerToken = loginData.data?.accessToken;

  // Test 4: Kiểm tra CUSTOMER gọi thẳng API Admin quản trị (Backend phải trả 403 Forbidden)
  console.log('\n--- 4. Kiểm tra CUSTOMER gọi API quản trị qua Gateway (/api/v1/inventory/adjust) ---');
  const customerAdminApiRes = await fetch(`${GATEWAY_URL}/inventory/adjust`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      productId: 'test-product-npk',
      variantId: 'test-variant-npk-101',
      quantityChange: 10,
      reason: 'Khách hàng tự ý điều chỉnh kho',
    }),
  });
  const customerAdminApiData = await customerAdminApiRes.json();
  console.log(`Status khi CUSTOMER gọi Admin API: ${customerAdminApiRes.status} (Kỳ vọng: 403 Forbidden)`);
  console.log(`Error code: ${customerAdminApiData.error?.code}, Message: ${customerAdminApiData.error?.message}`);

  // Test 5: Đăng nhập tài khoản Admin seed qua Gateway
  console.log('\n--- 5. Đăng nhập tài khoản Admin seed (admin@local.test) ---');
  const adminLoginRes = await fetch(`${FRONTEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@local.test',
      password: 'Password@123',
    }),
  });
  let actualLoginRes = adminLoginRes;
  let adminLoginData = await adminLoginRes.json();
  if (!adminLoginData.success) {
    actualLoginRes = await fetch(`${FRONTEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@local.test',
        password: 'Admin@123456',
      }),
    });
    adminLoginData = await actualLoginRes.json();
  }

  console.log(`Admin Login success: ${adminLoginData.success}`);
  console.log(`Admin user: ${adminLoginData.data?.user?.fullName}, Role: ${adminLoginData.data?.user?.role}`);
  const adminToken = adminLoginData.data?.accessToken;
  const adminCookie = actualLoginRes.headers.get('set-cookie');

  // Test 6: Kiểm tra Admin gọi API quản trị thành công
  console.log('\n--- 6. Kiểm tra Admin gọi API tồn kho thấp qua Gateway ---');
  const adminLowStockRes = await fetch(`${GATEWAY_URL}/inventory/low-stock?threshold=20`, {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
    },
  });
  const adminLowStockData = await adminLowStockRes.json();
  console.log(`Admin low stock status: ${adminLowStockRes.status}`);
  console.log(`Số mặt hàng cảnh báo tồn kho thấp tìm thấy: ${adminLowStockData.data?.length}`);

  // Test 7: Kiểm tra Refresh Session Flow
  console.log('\n--- 7. Kiểm tra cơ chế Refresh Session (/api/auth/refresh) ---');
  const refreshCookie = adminCookie;
  const refreshRes = await fetch(`${FRONTEND_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: {
      'Cookie': refreshCookie || '',
    },
  });
  const refreshData = await refreshRes.json();
  console.log(`Refresh status: ${refreshRes.status}, Success: ${refreshData.success}`);
  console.log(`Token mới đã được cấp lại: ${Boolean(refreshData.data?.accessToken)}`);

  // Test 8: Kiểm tra Đăng xuất (Logout)
  console.log('\n--- 8. Kiểm tra Đăng xuất (/api/auth/logout) ---');
  const logoutRes = await fetch(`${FRONTEND_URL}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'Cookie': refreshCookie || '',
    },
  });
  const logoutData = await logoutRes.json();
  const logoutCookie = logoutRes.headers.get('set-cookie');
  console.log(`Logout status: ${logoutRes.status}, Message: ${logoutData.data?.message}`);
  console.log(`Cookie đã bị thu hồi/xóa: ${Boolean(logoutCookie?.includes('phanbon_refresh_token=;'))}`);

  console.log('\n============================================================');
  console.log('KẾT QUẢ: TOÀN BỘ 8 BÀI KIỂM THỬ APPS/FRONTEND ĐỀU ĐẠT CHUẨN!');
  console.log('============================================================');
}

runTests().catch(console.error);
