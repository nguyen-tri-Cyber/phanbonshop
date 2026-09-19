// scratch/test-review.mjs
// Automated verification script for Module 2: Review & verifiedPurchase

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

async function runReviewTests() {
  console.log('=== BẮT ĐẦU KIỂM THỬ MODULE 2: REVIEW & VERIFIED PURCHASE ===\n');

  // 1. Đăng nhập ADMIN và CUSTOMER
  console.log('1. Đăng nhập tài khoản ADMIN và CUSTOMER...');
  const adminToken = await login('admin@phanbonshop.vn', 'Admin@123456');
  const customerToken = await login('customer@phanbonshop.vn', 'Admin@123456');
  console.log('   ✅ Đã lấy thành công JWT Token cho ADMIN và CUSTOMER\n');

  // 2. Lấy 2 sản phẩm khác nhau từ DB (Product A để mua thật, Product B để thử fake)
  console.log('2. Lấy 2 sản phẩm khác nhau từ DB để chuẩn bị test...');
  const productsRes = await request(`${BASE_URL}/products?limit=5`);
  if (!productsRes.ok || !productsRes.data?.items?.length || productsRes.data.items.length < 2) {
    throw new Error('Cần tối thiểu 2 sản phẩm trong DB để kiểm thử');
  }

  const productA = productsRes.data.items[0];
  const variantA = productA.variants?.[0];
  const productB = productsRes.data.items[1];
  console.log(`   Sản phẩm A (sẽ mua thật): [${productA.id}] ${productA.name}`);
  console.log(`   Sản phẩm B (chưa từng mua): [${productB.id}] ${productB.name}\n`);

  // 3. Tạo một đơn hàng thật chứa Product A và hoàn tất (COMPLETED)
  console.log('3. Khách hàng đặt đơn hàng chứa Sản phẩm A...');
  const checkoutRes = await request(`${BASE_URL}/checkout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({
      items: [{ productId: productA.id, variantId: variantA.id, quantity: 1 }],
      shippingAddress: {
        recipientName: 'Khách Hàng Mua Review',
        phone: '0988776655',
        provinceCode: '79',
        provinceName: 'Thành phố Hồ Chí Minh',
        districtCode: '760',
        districtName: 'Quận 1',
        wardCode: '26734',
        wardName: 'Phường Bến Nghé',
        addressLine: '456 Phân Bón',
      },
      paymentMethod: 'COD',
    }),
  });

  if (!checkoutRes.ok) {
    throw new Error(`Checkout sản phẩm A thất bại: ${JSON.stringify(checkoutRes.data)}`);
  }
  const orderId = checkoutRes.data.orderId || checkoutRes.data.id;
  const orderNumber = checkoutRes.data.orderNumber;
  console.log(`   Đã tạo đơn hàng thành công: ${orderNumber} (ID: ${orderId})`);

  // Chuyển trạng thái đơn hàng sang COMPLETED (qua Admin status transition: PENDING -> CONFIRMED -> SHIPPING -> COMPLETED)
  console.log('   Admin chuyển trạng thái đơn hàng sang COMPLETED...');
  const steps = [
    { to: 'CONFIRMED', note: 'Xác nhận đơn' },
    { to: 'PROCESSING', note: 'Đang xử lý đơn' },
    { to: 'PACKING', note: 'Đang đóng gói hàng' },
    { to: 'SHIPPED', note: 'Đã bàn giao đơn vị vận chuyển' },
    { to: 'DELIVERED', note: 'Giao hàng thành công' },
    { to: 'COMPLETED', note: 'Khách xác nhận đã nhận hàng hoàn tất' },
  ];

  for (const step of steps) {
    const updateRes = await request(`${BASE_URL}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        status: step.to,
        note: step.note,
      }),
    });
    if (!updateRes.ok) {
      throw new Error(`Chuyển trạng thái sang ${step.to} thất bại: ${JSON.stringify(updateRes.data)}`);
    }
  }
  console.log('   ✅ Đơn hàng đã chuyển sang trạng thái COMPLETED thành công!\n');

  // 4. TEST THẬT 1: Tạo review cho sản phẩm A (đã mua trong COMPLETED order)
  console.log('4. TEST THẬT 1: Khách hàng gửi đánh giá cho Sản phẩm A (đã mua thật)...');
  const reviewARes = await request(`${BASE_URL}/reviews`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({
      productId: productA.id,
      rating: 5,
      comment: 'Phân bón rất hiệu quả, lúa đẻ nhánh khỏe và lá xanh mướt!',
    }),
  });

  if (!reviewARes.ok) {
    throw new Error(`Gửi review sản phẩm A thất bại: ${JSON.stringify(reviewARes.data)}`);
  }
  const reviewA = reviewARes.data;
  console.log('   Review A trả về:', {
    id: reviewA.id,
    productId: reviewA.productId,
    rating: reviewA.rating,
    verifiedPurchase: reviewA.verifiedPurchase,
    status: reviewA.status,
  });

  if (reviewA.verifiedPurchase !== true) {
    throw new Error(
      `LỖI: Khách đã mua đơn COMPLETED nhưng backend không cấp verifiedPurchase = true!`,
    );
  }
  console.log('   ✅ TEST 1 ĐẠT: Backend tự xác minh và cấp verifiedPurchase = true thành công!\n');

  // 5. TEST THẬT 2: Thử FAKE verifiedPurchase cho sản phẩm B (chưa mua) -> Bị chặn
  console.log('5. TEST THẬT 2: Thử FAKE verifiedPurchase cho sản phẩm B...');
  console.log('   5a. Client cố tình truyền { verifiedPurchase: true } trong request body...');
  const fakeInjectRes = await request(`${BASE_URL}/reviews`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({
      productId: productB.id,
      rating: 4,
      comment: 'Cố tình hack verified purchase',
      verifiedPurchase: true,
    }),
  });

  if (fakeInjectRes.status !== 400) {
    throw new Error(
      `LỖI: Client truyền verifiedPurchase=true phải bị ValidationPipe từ chối 400, nhưng nhận ${fakeInjectRes.status}`,
    );
  }
  console.log('   ✅ Đạt 5a: Client bị từ chối 400 khi cố truyền verifiedPurchase!');

  console.log('   5b. Khách gửi đánh giá hợp lệ cho Sản phẩm B (chưa mua)...');
  const unpurchasedReviewRes = await request(`${BASE_URL}/reviews`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({
      productId: productB.id,
      rating: 4,
      comment: 'Đánh giá dạo sản phẩm chưa mua',
    }),
  });

  if (!unpurchasedReviewRes.ok) {
    throw new Error(`Gửi review sản phẩm B thất bại: ${JSON.stringify(unpurchasedReviewRes.data)}`);
  }
  const unpurchasedReview = unpurchasedReviewRes.data;
  console.log('   Review B trả về:', {
    id: unpurchasedReview.id,
    productId: unpurchasedReview.productId,
    rating: unpurchasedReview.rating,
    verifiedPurchase: unpurchasedReview.verifiedPurchase,
    status: unpurchasedReview.status,
  });

  if (unpurchasedReview.verifiedPurchase === true) {
    throw new Error(
      `LỖI BẢO MẬT: Sản phẩm B chưa mua nhưng lại được cấp verifiedPurchase = true!`,
    );
  }
  console.log('   ✅ Đạt 5b: Backend kiểm tra và chỉ định verifiedPurchase = false chính xác!\n');

  // 6. Kiểm tra xem Public Reviews & Thống kê Rating của Sản phẩm A
  console.log('6. Kiểm tra API công khai lấy danh sách đánh giá của sản phẩm A...');
  const pubReviewsRes = await request(`${BASE_URL}/reviews/products/${productA.id}`);
  if (!pubReviewsRes.ok) {
    throw new Error(`Lấy public reviews thất bại: ${pubReviewsRes.status}`);
  }
  const pubData = pubReviewsRes.data;
  console.log('   Thống kê đánh giá sản phẩm A:', pubData.stats);
  console.log(`   Số lượng review hiển thị: ${pubData.reviews?.length}`);
  const foundA = pubData.reviews?.find((r) => r.id === reviewA.id);
  if (!foundA) {
    throw new Error('Không tìm thấy review vừa tạo trong public reviews!');
  }
  console.log('   ✅ Public reviews hiển thị đầy đủ đánh giá cùng thống kê sao!\n');

  // 7. Kiểm tra Moderation: Admin từ chối review (REJECTED) -> Public không hiển thị nữa
  console.log('7. Kiểm duyệt đánh giá: Admin từ chối (REJECTED) Review A...');
  const rejectRes = await request(`${BASE_URL}/reviews/admin/${reviewA.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'REJECTED' }),
  });
  if (!rejectRes.ok) {
    throw new Error(`Admin reject review thất bại: ${JSON.stringify(rejectRes.data)}`);
  }
  console.log('   Đã chuyển trạng thái Review A sang REJECTED');

  const afterRejectPubRes = await request(`${BASE_URL}/reviews/products/${productA.id}`);
  const afterRejectReviews = afterRejectPubRes.data?.reviews || [];
  const stillFoundA = afterRejectReviews.find((r) => r.id === reviewA.id);
  if (stillFoundA) {
    throw new Error('Đánh giá bị REJECTED nhưng vẫn hiển thị ở public API!');
  }
  console.log('   ✅ Đánh giá bị REJECTED đã ẩn khỏi public reviews thành công!\n');

  // Khôi phục lại APPROVED
  await request(`${BASE_URL}/reviews/admin/${reviewA.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'APPROVED' }),
  });

  console.log('================================================================');
  console.log('🎉 TẤT CẢ KIỂM THỬ CHO MODULE 2: REVIEW ĐỀU THÀNH CÔNG RỰC RỠ!');
  console.log('================================================================');
}

runReviewTests().catch((err) => {
  console.error('\n❌ KIỂM THỬ MODULE 2 THẤT BẠI:', err);
  process.exit(1);
});
