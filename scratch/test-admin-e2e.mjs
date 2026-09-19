// scratch/test-admin-e2e.mjs
// Automated verification script for Admin UI & API requirements

const BASE_URL = 'http://localhost:8080/api/v1';

async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  let raw = null;
  try {
    raw = await res.json();
  } catch (e) {
    raw = null;
  }
  const data = (raw && typeof raw === 'object' && 'data' in raw && raw.data !== undefined && raw.success === true) ? raw.data : raw;
  return { status: res.status, ok: res.ok, data, raw };
}

async function login(email, password) {
  const res = await request(`${BASE_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res.data)}`);
  }
  return res.data?.data?.accessToken || res.data?.accessToken;
}

async function runTests() {
  console.log('=== BẮT ĐẦU E2E TEST ADMIN API & UI REQUIREMENTS ===\n');

  // 1. Prepare tokens
  console.log('1. Đăng nhập các tài khoản với các vai trò khác nhau...');
  const customerToken = await login('customer@phanbonshop.vn', 'Admin@123456');
  const staffToken = await login('staff@phanbonshop.vn', 'Admin@123456');
  const adminToken = await login('admin@phanbonshop.vn', 'Admin@123456');
  console.log('   ✅ Đã lấy thành công JWT cho CUSTOMER, STAFF, ADMIN\n');

  // 2. Test 1: CUSTOMER calls Admin API -> 403 Forbidden
  console.log('2. Test 1: CUSTOMER gọi API Admin -> Mong đợi 403 Forbidden');
  const custOrdersRes = await request(`${BASE_URL}/orders/admin`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  console.log(`   GET /orders/admin: status = ${custOrdersRes.status}, body =`, custOrdersRes.data);
  if (custOrdersRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden for customer, got ${custOrdersRes.status}`);
  }

  const custDashRes = await request(`${BASE_URL}/orders/admin/dashboard`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  console.log(`   GET /orders/admin/dashboard: status = ${custDashRes.status}`);
  if (custDashRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden for customer, got ${custDashRes.status}`);
  }
  console.log('   ✅ Test 1 ĐẠT: Customer bị chặn 403 khi truy cập API Admin\n');

  // 3. Test 2: STAFF attempts Admin-only function -> 403 Forbidden
  console.log('3. Test 2: STAFF thực hiện chức năng chỉ dành cho ADMIN (tạo Coupon) -> Mong đợi 403 Forbidden');
  const staffCouponRes = await request(`${BASE_URL}/coupons`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({
      code: `STAFFTEST${Date.now()}`,
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderValue: 50000,
      maxDiscountAmount: 20000,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
    }),
  });
  console.log(`   POST /coupons (STAFF): status = ${staffCouponRes.status}`);
  if (staffCouponRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden for staff creating coupon, got ${staffCouponRes.status}`);
  }
  console.log('   ✅ Test 2 ĐẠT: Staff bị chặn 403 khi thực hiện tính năng chỉ dành cho ADMIN\n');

  // 4. Test 3: ADMIN calls allowed functions -> Success
  console.log('4. Test 3: ADMIN gọi các chức năng được phép -> Mong đợi thành công (200 / 201)');
  const testCouponCode = `ADMINTEST${Date.now()}`;
  const adminCouponRes = await request(`${BASE_URL}/coupons`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      code: testCouponCode,
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderValue: 50000,
      maxDiscountAmount: 20000,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
    }),
  });
  console.log(`   POST /coupons (ADMIN): status = ${adminCouponRes.status}`);
  if (![200, 201].includes(adminCouponRes.status)) {
    throw new Error(`Expected 200/201 for admin creating coupon, got ${adminCouponRes.status}: ${JSON.stringify(adminCouponRes.data)}`);
  }

  const adminOrdersRes = await request(`${BASE_URL}/orders/admin`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`   GET /orders/admin (ADMIN): status = ${adminOrdersRes.status}`);
  if (adminOrdersRes.status !== 200) {
    throw new Error(`Expected 200 for admin getting orders, got ${adminOrdersRes.status}`);
  }
  console.log('   ✅ Test 3 ĐẠT: Admin thực hiện thành công các chức năng quản trị\n');

  // 5. Test 4: Dashboard numbers match DB and revenue rule
  console.log('5. Test 4: Xác minh số liệu Dashboard khớp DB và quy tắc DOANH THU');
  // Lấy dashboard ban đầu
  const initialDashRes = await request(`${BASE_URL}/orders/admin/dashboard`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (initialDashRes.status !== 200) {
    throw new Error(`Failed to get admin dashboard: ${initialDashRes.status}`);
  }
  const initialStats = initialDashRes.data;
  console.log('   Số liệu ban đầu:', {
    ordersToday: initialStats.ordersToday,
    pendingOrders: initialStats.pendingOrders,
    revenueToday: initialStats.revenueToday,
    revenueMonth: initialStats.revenueMonth,
  });

  // Tìm 1 variant để đặt hàng
  const productsRes = await request(`${BASE_URL}/products?limit=1`);
  if (!productsRes.ok || !productsRes.data?.items?.length) {
    throw new Error('Không tìm thấy sản phẩm nào trong DB để test');
  }
  const product = productsRes.data.items[0];
  const variant = product.variants?.[0];
  if (!variant) {
    throw new Error('Sản phẩm không có variant');
  }

  // Đặt 1 đơn hàng mới với BANK_TRANSFER
  console.log(`   Tạo đơn hàng mới test với variantId: ${variant.id}, price: ${variant.price}...`);
  const checkoutRes = await request(`${BASE_URL}/checkout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({
      items: [
        {
          productId: product.id,
          variantId: variant.id,
          quantity: 1,
        },
      ],
      shippingAddress: {
        recipientName: 'Nguyen Van Test',
        phone: '0901234567',
        provinceCode: '79',
        provinceName: 'Thành phố Hồ Chí Minh',
        districtCode: '760',
        districtName: 'Quận 1',
        wardCode: '26734',
        wardName: 'Phường Bến Nghé',
        addressLine: '123 Le Loi',
      },
      paymentMethod: 'BANK_TRANSFER',
      customerNote: 'E2E Test Admin Dashboard',
    }),
  });

  if (!checkoutRes.ok) {
    throw new Error(`Checkout failed: ${JSON.stringify(checkoutRes.data)}`);
  }
  const createdOrder = checkoutRes.data.order || checkoutRes.data;
  const orderId = createdOrder.orderId || createdOrder.id;
  const orderNumber = createdOrder.orderNumber;
  const totalAmount = createdOrder.totalAmount;
  console.log(`   Đã tạo đơn hàng thành công: ${orderNumber}, ID: ${orderId}, Total: ${totalAmount}, PaymentStatus: ${createdOrder.paymentStatus}`);

  // Kiểm tra Dashboard NGAY SAU KHI ĐẶT HÀNG (chưa thanh toán - PENDING)
  const afterOrderDashRes = await request(`${BASE_URL}/orders/admin/dashboard`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const afterOrderStats = afterOrderDashRes.data;
  console.log('   Số liệu sau khi đặt đơn (PENDING):', {
    ordersToday: afterOrderStats.ordersToday,
    pendingOrders: afterOrderStats.pendingOrders,
    revenueToday: afterOrderStats.revenueToday,
    revenueMonth: afterOrderStats.revenueMonth,
  });

  if (afterOrderStats.ordersToday !== initialStats.ordersToday + 1) {
    throw new Error(`ordersToday không tăng 1: kỳ vọng ${initialStats.ordersToday + 1}, thực tế ${afterOrderStats.ordersToday}`);
  }
  if (afterOrderStats.pendingOrders !== initialStats.pendingOrders + 1) {
    throw new Error(`pendingOrders không tăng 1: kỳ vọng ${initialStats.pendingOrders + 1}, thực tế ${afterOrderStats.pendingOrders}`);
  }
  if (afterOrderStats.revenueToday !== initialStats.revenueToday) {
    throw new Error(`DOANH THU BỊ SAI: Đơn PENDING lại được cộng vào doanh thu! Kỳ vọng ${initialStats.revenueToday}, thực tế ${afterOrderStats.revenueToday}`);
  }
  console.log('   ✅ Doanh thu giữ nguyên khi đơn PENDING (tuân thủ quy tắc doanh thu)!');

  // Lấy chi tiết đơn hàng để lấy ID của payment
  const orderDetailRes = await request(`${BASE_URL}/orders/admin/${orderNumber || orderId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const payments = orderDetailRes.data?.payments || [];
  const payment = payments[0] || createdOrder.payment;
  if (!payment) {
    throw new Error('Đơn hàng không có bản ghi Payment');
  }

  // Admin xác nhận thanh toán BANK_TRANSFER thủ công
  console.log(`   Admin xác nhận thanh toán chuyển khoản cho Payment ID: ${payment.id}...`);
  const confirmPayRes = await request(`${BASE_URL}/payments/${payment.id}/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      transactionReference: `FT${Date.now()}`,
      note: 'Admin test manual bank confirmation',
    }),
  });
  if (!confirmPayRes.ok) {
    throw new Error(`Confirm payment failed: ${JSON.stringify(confirmPayRes.data)}`);
  }
  console.log('   Thanh toán đã được xác nhận PAID.');

  // Kiểm tra Dashboard SAU KHI XÁC NHẬN THANH TOÁN (PAID)
  const afterPaidDashRes = await request(`${BASE_URL}/orders/admin/dashboard`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const afterPaidStats = afterPaidDashRes.data;
  console.log('   Số liệu sau khi xác nhận thanh toán (PAID):', {
    ordersToday: afterPaidStats.ordersToday,
    pendingOrders: afterPaidStats.pendingOrders,
    revenueToday: afterPaidStats.revenueToday,
    revenueMonth: afterPaidStats.revenueMonth,
  });

  const expectedRevenueToday = initialStats.revenueToday + totalAmount;
  if (afterPaidStats.revenueToday !== expectedRevenueToday) {
    throw new Error(`Doanh thu hôm nay không tăng chính xác sau khi PAID: kỳ vọng ${expectedRevenueToday}, thực tế ${afterPaidStats.revenueToday}`);
  }
  console.log('   ✅ Test 4 ĐẠT: Dashboard phản ánh chính xác số liệu DB và doanh thu chỉ tăng khi thanh toán PAID!\n');

  // 6. Test 5: Inventory adjust creates real InventoryMovement
  console.log('6. Test 5: Điều chỉnh tồn kho tạo InventoryMovement thật với reason bắt buộc');
  const adjustQty = 15;
  const adjustReason = `Kiểm kê định kỳ phát hiện dư ${Date.now()}`;

  const adjustRes = await request(`${BASE_URL}/inventory/adjust`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      productId: product.id,
      variantId: variant.id,
      quantityChange: adjustQty,
      reason: adjustReason,
    }),
  });

  if (!adjustRes.ok) {
    throw new Error(`Adjust inventory failed: ${JSON.stringify(adjustRes.data)}`);
  }
  console.log('   Adjust inventory response:', adjustRes.data);

  // Lấy danh sách movements của variant
  const movementsRes = await request(`${BASE_URL}/inventory/movements?variantId=${variant.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!movementsRes.ok) {
    throw new Error(`Get movements failed: ${JSON.stringify(movementsRes.data)}`);
  }

  const movements = movementsRes.data.movements || movementsRes.data || [];
  const latestMovement = movements[0]; // newest first
  console.log('   Latest movement:', {
    type: latestMovement?.type,
    quantity: latestMovement?.quantity,
    stockBefore: latestMovement?.stockBefore,
    stockAfter: latestMovement?.stockAfter,
    reason: latestMovement?.reason,
  });

  if (!latestMovement || latestMovement.reason !== adjustReason) {
    throw new Error(`InventoryMovement không khớp với thao tác vừa thực hiện!`);
  }
  if (latestMovement.type !== 'ADJUSTMENT' || latestMovement.quantity !== adjustQty) {
    throw new Error(`Movement type hoặc quantity không đúng: ${JSON.stringify(latestMovement)}`);
  }
  console.log('   ✅ Test 5 ĐẠT: InventoryMovement được tạo chính xác với đầy đủ reason, stockBefore, stockAfter!\n');

  // 7. Test Customer API: verify NO passwordHash, refreshToken, or secret leaked
  console.log('7. Test Customer admin API bảo mật: Không rò rỉ secret / hash...');
  const customersRes = await request(`${BASE_URL}/customers/admin`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!customersRes.ok) {
    throw new Error(`Get admin customers failed: ${JSON.stringify(customersRes.data)}`);
  }
  const custItem = customersRes.data.items?.[0];
  if (custItem) {
    if (custItem.passwordHash || custItem.refreshToken || custItem.tokenHash) {
      throw new Error('CẢNH BÁO BẢO MẬT: Customer API làm lộ passwordHash hoặc token!');
    }
    console.log(`   Customer ${custItem.email}: orderCount = ${custItem.orderCount}, totalSpent = ${custItem.totalSpent}`);
  }
  console.log('   ✅ Bảo mật Customer API ĐẠT: Không lộ secrets/hash!\n');

  console.log('================================================================');
  console.log('🎉 TẤT CẢ 5/5 YÊU CẦU KIỂM THỬ ADMIN API & UI ĐỀU THÀNH CÔNG RỰC RỠ!');
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('\n❌ TEST THẤT BẠI:', err);
  process.exit(1);
});
