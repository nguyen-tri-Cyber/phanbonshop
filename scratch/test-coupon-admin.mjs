// scratch/test-coupon-admin.mjs
// Automated verification script for Module 1: Coupon Admin

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
  const data =
    raw && typeof raw === 'object' && 'data' in raw && raw.data !== undefined && raw.success === true
      ? raw.data
      : raw;
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
  return res.data?.accessToken || res.raw?.data?.accessToken;
}

async function runCouponTests() {
  console.log('=== BẮT ĐẦU KIỂM THỬ MODULE 1: COUPON ADMIN ===\n');

  // 1. Đăng nhập ADMIN và CUSTOMER
  console.log('1. Đăng nhập tài khoản ADMIN và CUSTOMER...');
  const adminToken = await login('admin@phanbonshop.vn', 'Admin@123456');
  const customerToken = await login('customer@phanbonshop.vn', 'Admin@123456');
  console.log('   ✅ Đã lấy thành công JWT Token cho ADMIN và CUSTOMER\n');

  // 2. Admin tạo Coupon ưu đãi mới
  const validCouponCode = `TESTPROMO${Date.now().toString().slice(-6)}`;
  console.log(`2. Admin tạo mã ưu đãi mới: ${validCouponCode} (Giảm 15%, đơn tối thiểu 100k, tối đa 200k)...`);
  const createRes = await request(`${BASE_URL}/coupons`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      code: validCouponCode,
      description: 'Khuyến mãi kiểm thử Module 1',
      type: 'PERCENTAGE',
      value: 15,
      minOrderAmount: 100000,
      maxDiscountAmount: 200000,
      startDate: new Date(Date.now() - 3600000).toISOString(), // Bắt đầu 1 giờ trước
      endDate: new Date(Date.now() + 86400000 * 10).toISOString(), // Còn hạn 10 ngày
      usageLimit: 50,
      usagePerCustomer: 2,
      enabled: true,
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Admin tạo coupon thất bại: ${JSON.stringify(createRes.data)}`);
  }
  const createdCoupon = createRes.data;
  console.log('   ✅ Đã tạo thành công coupon ID:', createdCoupon.id, 'Code:', createdCoupon.code);

  // 3. Admin tra cứu danh sách coupon
  console.log('\n3. Admin tra cứu danh sách coupon (/coupons/admin)...');
  const listRes = await request(`${BASE_URL}/coupons/admin?search=${validCouponCode}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!listRes.ok) {
    throw new Error(`Admin lấy danh sách coupon thất bại: ${listRes.status}`);
  }
  const foundCoupon = listRes.data?.items?.find((c) => c.code === validCouponCode);
  if (!foundCoupon) {
    throw new Error(`Không tìm thấy mã ${validCouponCode} trong danh sách admin trả về!`);
  }
  console.log('   ✅ Tìm thấy coupon trong danh sách Admin:', {
    code: foundCoupon.code,
    type: foundCoupon.type,
    value: foundCoupon.value,
    status: foundCoupon.status,
  });

  // 4. Lấy một sản phẩm và variant thật để test checkout
  console.log('\n4. Lấy sản phẩm trong DB để test checkout áp dụng coupon...');
  const productsRes = await request(`${BASE_URL}/products?limit=1`);
  if (!productsRes.ok || !productsRes.data?.items?.length) {
    throw new Error('Không tìm thấy sản phẩm nào trong DB');
  }
  const product = productsRes.data.items[0];
  const variant = product.variants?.[0];
  if (!variant) {
    throw new Error('Sản phẩm không có variant để test');
  }
  const unitPrice = Number(variant.price);
  console.log(`   Sản phẩm: "${product.name}", Variant: ${variant.packageSize}, Giá: ${unitPrice}`);

  // 5. Customer Checkout với coupon vừa tạo
  console.log(`\n5. Khách hàng thực hiện Checkout với mã: "${validCouponCode}"...`);
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
        recipientName: 'Nong Dan Test Coupon',
        phone: '0912345678',
        provinceCode: '79',
        provinceName: 'Thành phố Hồ Chí Minh',
        districtCode: '760',
        districtName: 'Quận 1',
        wardCode: '26734',
        wardName: 'Phường Bến Nghé',
        addressLine: '123 Đường Nông Nghiệp',
      },
      paymentMethod: 'COD',
      couponCode: validCouponCode,
    }),
  });

  if (!checkoutRes.ok) {
    throw new Error(`Checkout với coupon thất bại: ${JSON.stringify(checkoutRes.data)}`);
  }

  const orderData = checkoutRes.data;
  console.log('   Kết quả Checkout:', {
    orderNumber: orderData.orderNumber,
    subtotal: orderData.subtotal,
    discountAmount: orderData.discountAmount,
    shippingFee: orderData.shippingFee,
    totalAmount: orderData.totalAmount,
    couponCode: orderData.couponCode,
  });

  // Kiểm tra tính toán giảm giá 15% server-side
  const expectedDiscount = Math.round(Math.min((orderData.subtotal * 15) / 100, 200000));
  if (orderData.discountAmount !== expectedDiscount) {
    throw new Error(
      `Giảm giá server tính sai: kỳ vọng ${expectedDiscount}, thực tế ${orderData.discountAmount}`,
    );
  }
  if (orderData.couponCode !== validCouponCode) {
    throw new Error(`Coupon code không được lưu vào order!`);
  }
  if (orderData.totalAmount !== orderData.subtotal - orderData.discountAmount + orderData.shippingFee) {
    throw new Error(`Tổng thanh toán tính sai!`);
  }
  console.log('   ✅ Khách hàng dùng coupon thành công, mức giảm 15% được tính toán server-side chính xác!');

  // 6. Test Coupon Hết Hạn -> Mong đợi REJECT server-side
  const expiredCode = `EXPIRED${Date.now().toString().slice(-6)}`;
  console.log(`\n6. Admin tạo coupon ĐÃ HẾT HẠN: ${expiredCode} (Hết hạn từ năm 2024)...`);
  const createExpiredRes = await request(`${BASE_URL}/coupons`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      code: expiredCode,
      description: 'Mã đã hết hạn',
      type: 'FIXED_AMOUNT',
      value: 50000,
      minOrderAmount: 10000,
      startDate: new Date('2024-01-01').toISOString(),
      endDate: new Date('2024-02-01').toISOString(), // Quá khứ
      usageLimit: 100,
      enabled: true,
    }),
  });

  if (!createExpiredRes.ok) {
    throw new Error(`Tạo coupon hết hạn thất bại: ${JSON.stringify(createExpiredRes.data)}`);
  }
  console.log('   Đã tạo mã hết hạn:', expiredCode);

  console.log(`   Khách hàng thử Checkout với mã hết hạn: "${expiredCode}"...`);
  const expiredCheckoutRes = await request(`${BASE_URL}/checkout`, {
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
        recipientName: 'Nong Dan Test Coupon',
        phone: '0912345678',
        provinceCode: '79',
        provinceName: 'Thành phố Hồ Chí Minh',
        districtCode: '760',
        districtName: 'Quận 1',
        wardCode: '26734',
        wardName: 'Phường Bến Nghé',
        addressLine: '123 Đường Nông Nghiệp',
      },
      paymentMethod: 'COD',
      couponCode: expiredCode,
    }),
  });

  console.log(`   Status khi checkout với mã hết hạn: ${expiredCheckoutRes.status}`);
  if (expiredCheckoutRes.status !== 400) {
    throw new Error(`Kỳ vọng 400 Bad Request cho coupon hết hạn, nhưng nhận ${expiredCheckoutRes.status}`);
  }
  console.log('   Error response:', expiredCheckoutRes.data?.error || expiredCheckoutRes.data);
  console.log('   ✅ Coupon hết hạn bị REJECT thành công!');

  // 7. Test Admin cập nhật / vô hiệu hóa Coupon (enabled: false)
  console.log(`\n7. Admin cập nhật vô hiệu hóa mã: ${validCouponCode}...`);
  const disableRes = await request(`${BASE_URL}/coupons/${createdCoupon.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ enabled: false }),
  });
  if (!disableRes.ok) {
    throw new Error(`Cập nhật coupon thất bại: ${JSON.stringify(disableRes.data)}`);
  }
  console.log('   Đã vô hiệu hóa mã thành công.');

  console.log(`   Khách hàng thử Checkout với mã vừa bị vô hiệu: "${validCouponCode}"...`);
  const disabledCheckoutRes = await request(`${BASE_URL}/checkout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({
      items: [{ productId: product.id, variantId: variant.id, quantity: 1 }],
      shippingAddress: {
        recipientName: 'Test Disabled',
        phone: '0912345678',
        provinceCode: '79',
        provinceName: 'Thành phố Hồ Chí Minh',
        districtCode: '760',
        districtName: 'Quận 1',
        wardCode: '26734',
        wardName: 'Phường Bến Nghé',
        addressLine: '123 Test',
      },
      paymentMethod: 'COD',
      couponCode: validCouponCode,
    }),
  });

  if (disabledCheckoutRes.status !== 400 && disabledCheckoutRes.status !== 404) {
    throw new Error(`Kỳ vọng lỗi khi dùng mã bị vô hiệu, nhưng nhận ${disabledCheckoutRes.status}`);
  }
  console.log('   ✅ Mã bị vô hiệu hóa cũng bị REJECT thành công!');

  console.log('\n================================================================');
  console.log('🎉 TẤT CẢ KIỂM THỬ CHO MODULE 1: COUPON ADMIN ĐỀU THÀNH CÔNG RỰC RỠ!');
  console.log('================================================================');
}

runCouponTests().catch((err) => {
  console.error('\n❌ KIỂM THỬ MODULE 1 THẤT BẠI:', err);
  process.exit(1);
});
