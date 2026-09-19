import assert from 'node:assert/strict';

const GATEWAY_URL = 'http://localhost:8080/api/v1';

async function postJson(url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  assert.ok(res.ok, `POST ${url} failed with ${res.status}: ${JSON.stringify(json)}`);
  return json.data || json;
}

async function patchJson(url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  assert.ok(res.ok, `PATCH ${url} failed with ${res.status}: ${JSON.stringify(json)}`);
  return json.data || json;
}

async function getJson(url, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  const json = await res.json().catch(() => ({}));
  assert.ok(res.ok, `GET ${url} failed with ${res.status}: ${JSON.stringify(json)}`);
  return json.data || json;
}

async function run() {
  console.log('====================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ: FULL LOCAL SUCCESS FLOW (27 BƯỚC THẬT)');
  console.log('====================================================\n');

  const uniqueSuffix = Date.now();

  // ----------------------------------------------------
  // BƯỚC 1: Đăng nhập SUPER_ADMIN
  // ----------------------------------------------------
  console.log('1. [SUPER_ADMIN] Đăng nhập hệ thống...');
  const adminLoginData = await postJson(`${GATEWAY_URL}/auth/login`, {
    email: 'admin@phanbonshop.vn',
    password: 'Admin@123456',
  });
  const adminToken = adminLoginData.accessToken;
  assert.ok(adminToken, 'Admin token không tồn tại');
  console.log('   ✅ Đăng nhập SUPER_ADMIN thành công.\n');

  // ----------------------------------------------------
  // BƯỚC 2: Tạo Danh mục sản phẩm mới
  // ----------------------------------------------------
  console.log('2. [SUPER_ADMIN] Tạo Danh mục sản phẩm mới...');
  const catData = await postJson(
    `${GATEWAY_URL}/categories`,
    {
      name: `Phân Bón Hữu Cơ Sinh Học Đặc Biệt ${uniqueSuffix}`,
      slug: `phan-bon-huu-co-${uniqueSuffix}`,
      description: 'Danh mục phân bón sinh học phục vụ khảo nghiệm vụ mùa',
    },
    adminToken,
  );
  const categoryId = catData.id;
  console.log(`   ✅ Đã tạo Category: ID=${categoryId}, Name="${catData.name}"\n`);

  // ----------------------------------------------------
  // BƯỚC 3: Tạo Thương hiệu mới
  // ----------------------------------------------------
  console.log('3. [SUPER_ADMIN] Tạo Thương hiệu phân bón mới...');
  const brandData = await postJson(
    `${GATEWAY_URL}/brands`,
    {
      name: `Bio-Agri Corp ${uniqueSuffix}`,
      slug: `bio-agri-corp-${uniqueSuffix}`,
      description: 'Thương hiệu phân bón công nghệ vi sinh chất lượng cao',
    },
    adminToken,
  );
  const brandId = brandData.id;
  console.log(`   ✅ Đã tạo Brand: ID=${brandId}, Name="${brandData.name}"\n`);

  // ----------------------------------------------------
  // BƯỚC 4: Tạo Sản phẩm mới
  // ----------------------------------------------------
  console.log('4. [SUPER_ADMIN] Tạo Sản phẩm phân bón mới...');
  const prodData = await postJson(
    `${GATEWAY_URL}/products`,
    {
      name: `Phân Bón Sinh Học Trichoderma Đặc Hiệu ${uniqueSuffix}`,
      slug: `phan-bon-trichoderma-${uniqueSuffix}`,
      sku: `PROD-SKU-${uniqueSuffix}`,
      price: 500000,
      description: 'Chế phẩm vi sinh Trichoderma giúp cải tạo đất, rễ khỏe, kháng nấm bệnh',
      categoryId,
      brandId,
      status: 'ACTIVE',
    },
    adminToken,
  );
  const productId = prodData.id;
  console.log(`   ✅ Đã tạo Product: ID=${productId}, Name="${prodData.name}"\n`);

  // ----------------------------------------------------
  // BƯỚC 5: Tạo Biến thể sản phẩm (Variant)
  // ----------------------------------------------------
  console.log('5. [SUPER_ADMIN] Tạo Biến thể sản phẩm (Variant)...');
  const varData = await postJson(
    `${GATEWAY_URL}/products/${productId}/variants`,
    {
      sku: `TRI-BIO-${uniqueSuffix}-25KG`,
      packageSize: '25kg',
      unit: 'Bao',
      price: 500000,
      compareAtPrice: 550000,
      status: 'ACTIVE',
    },
    adminToken,
  );
  const variantId = varData.id;
  console.log(`   ✅ Đã tạo Variant: ID=${variantId}, SKU="${varData.sku}", Price=500.000đ\n`);

  // ----------------------------------------------------
  // BƯỚC 6: Tải ảnh sản phẩm lên MinIO Object Storage
  // ----------------------------------------------------
  console.log('6. [SUPER_ADMIN] Tải ảnh sản phẩm lên MinIO Object Storage...');
  const fakePngBuffer = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
    'hex',
  );
  const formData = new FormData();
  const fileBlob = new Blob([fakePngBuffer], { type: 'image/png' });
  formData.append('file', fileBlob, 'trichoderma-sample.png');
  formData.append('altText', 'Ảnh mô tả chế phẩm sinh học Trichoderma');

  const uploadRes = await fetch(`${GATEWAY_URL}/products/${productId}/images/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: formData,
  });
  const uploadJson = await uploadRes.json().catch(() => ({}));
  assert.ok(uploadRes.ok, `Upload image failed: ${JSON.stringify(uploadJson)}`);
  const uploadedImage = uploadJson.data || uploadJson;
  console.log(`   ✅ Đã tải ảnh lên MinIO: URL=${uploadedImage.url || uploadedImage.imageUrl}\n`);

  // ----------------------------------------------------
  // BƯỚC 7: Khởi tạo tồn kho ban đầu (Stock = 50, Reserved = 0)
  // ----------------------------------------------------
  console.log('7. [SUPER_ADMIN] Khởi tạo tồn kho ban đầu (Stock = 50, Reserved = 0)...');
  await postJson(
    `${GATEWAY_URL}/inventory/adjust`,
    {
      productId,
      variantId,
      quantityChange: 50,
      reason: 'Nhập kho lô đầu kỳ phục vụ khách hàng',
    },
    adminToken,
  );

  const invItems = await getJson(`${GATEWAY_URL}/inventory/products/${productId}`);
  const initInv = invItems.find((i) => i.variantId === variantId);
  assert.strictEqual(initInv.stockQuantity, 50, 'Stock phải là 50');
  assert.strictEqual(initInv.reservedQuantity, 0, 'Reserved phải là 0');
  assert.strictEqual(initInv.availableQuantity, 50, 'Available phải là 50');
  console.log('   ✅ Tồn kho ban đầu: Stock=50, Reserved=0, Available=50\n');

  // ----------------------------------------------------
  // BƯỚC 8: Đăng ký tài khoản Khách hàng mới (CUSTOMER)
  // ----------------------------------------------------
  console.log('8. [CUSTOMER] Đăng ký tài khoản khách hàng mới...');
  const customerEmail = `farmer-${uniqueSuffix}@dongthap.vn`;
  const customerPassword = 'Password@123456';
  const customerPhone = `09${String(uniqueSuffix).slice(-8)}`;
  await postJson(`${GATEWAY_URL}/auth/register`, {
    email: customerEmail,
    password: customerPassword,
    fullName: 'Bác Ba Nông Dân Đồng Tháp',
    phone: customerPhone,
  });
  console.log(`   ✅ Đăng ký tài khoản CUSTOMER thành công: ${customerEmail} (SĐT: ${customerPhone})\n`);

  // ----------------------------------------------------
  // BƯỚC 9: Khách hàng đăng nhập hệ thống
  // ----------------------------------------------------
  console.log('9. [CUSTOMER] Khách hàng đăng nhập hệ thống...');
  const custLoginData = await postJson(`${GATEWAY_URL}/auth/login`, {
    email: customerEmail,
    password: customerPassword,
  });
  const custToken = custLoginData.accessToken;
  const customerId = custLoginData.user?.id;
  assert.ok(custToken, 'Customer token không tồn tại');
  console.log(`   ✅ Đăng nhập CUSTOMER thành công. UserID=${customerId}\n`);

  // ----------------------------------------------------
  // BƯỚC 10: Khách hàng lấy thông tin hồ sơ cá nhân
  // ----------------------------------------------------
  console.log('10. [CUSTOMER] Lấy thông tin hồ sơ cá nhân...');
  const profileData = await getJson(`${GATEWAY_URL}/customers/me`, custToken);
  assert.ok(profileData.fullName.includes('Bác Ba'), 'Tên khách hàng phải chính xác');
  console.log(`   ✅ Thông tin hồ sơ: Tên="${profileData.fullName}", Số điện thoại="${profileData.phone}"\n`);

  // ----------------------------------------------------
  // BƯỚC 11: Khách hàng duyệt Danh mục & Thương hiệu
  // ----------------------------------------------------
  console.log('11. [CUSTOMER] Duyệt danh mục và thương hiệu trên giao diện...');
  const cats = await getJson(`${GATEWAY_URL}/categories`);
  assert.ok(cats.some((c) => c.id === categoryId), 'Phải nhìn thấy category vừa tạo');

  const brands = await getJson(`${GATEWAY_URL}/brands`);
  assert.ok(brands.some((b) => b.id === brandId), 'Phải nhìn thấy brand vừa tạo');
  console.log(`   ✅ Đã duyệt và nhìn thấy ${cats.length} danh mục và ${brands.length} thương hiệu.\n`);

  // ----------------------------------------------------
  // BƯỚC 12: Khách hàng tìm kiếm và xem chi tiết sản phẩm
  // ----------------------------------------------------
  console.log('12. [CUSTOMER] Tìm kiếm và xem chi tiết sản phẩm...');
  const searchProdsData = await getJson(`${GATEWAY_URL}/products?keyword=${encodeURIComponent(uniqueSuffix)}`);
  const searchProds = searchProdsData.items || searchProdsData;
  assert.ok(searchProds.length > 0, 'Phải tìm thấy sản phẩm theo từ khóa');

  const prodDetail = await getJson(`${GATEWAY_URL}/products/${productId}`);
  assert.strictEqual(prodDetail.id, productId, 'Chi tiết sản phẩm phải khớp ID');
  assert.ok(prodDetail.variants.length > 0, 'Sản phẩm phải có biến thể');
  console.log(`   ✅ Đã tìm thấy sản phẩm "${prodDetail.name}", số lượng biến thể: ${prodDetail.variants.length}\n`);

  // ----------------------------------------------------
  // BƯỚC 13: Kiểm tra tồn kho khả dụng trước khi đặt
  // ----------------------------------------------------
  console.log('13. [CUSTOMER] Kiểm tra tồn kho khả dụng...');
  const invItemsBefore = await getJson(`${GATEWAY_URL}/inventory/products/${productId}`);
  const invBefore = invItemsBefore.find((i) => i.variantId === variantId);
  assert.ok(invBefore.availableQuantity >= 1, 'Sản phẩm phải còn hàng khả dụng');
  console.log(`   ✅ Tồn kho khả dụng của sản phẩm: ${invBefore.availableQuantity} bao\n`);

  // ----------------------------------------------------
  // BƯỚC 14: Thêm sản phẩm vào giỏ hàng
  // ----------------------------------------------------
  console.log('14. [CUSTOMER] Thêm sản phẩm vào giỏ hàng...');
  await postJson(
    `${GATEWAY_URL}/cart/items`,
    {
      productId,
      variantId,
      productName: prodDetail.name,
      productSlug: prodDetail.slug,
      sku: varData.sku,
      packageSize: varData.packageSize,
      unitPrice: 500000,
      quantity: 1,
    },
    custToken,
  );
  console.log('   ✅ Đã thêm 1 bao phân bón vào giỏ hàng.\n');

  // ----------------------------------------------------
  // BƯỚC 15: Xem giỏ hàng
  // ----------------------------------------------------
  console.log('15. [CUSTOMER] Xem lại giỏ hàng...');
  const cartData = await getJson(`${GATEWAY_URL}/cart`, custToken);
  assert.strictEqual(cartData.items.length, 1, 'Giỏ hàng phải có đúng 1 mục');
  assert.strictEqual(cartData.items[0].variantId, variantId, 'Mặt hàng trong giỏ phải khớp variant');
  console.log(`   ✅ Giỏ hàng hiện có: ${cartData.items.length} món, Tổng tạm tính: ${cartData.subtotal}đ\n`);

  // ----------------------------------------------------
  // BƯỚC 16: Tạo Địa chỉ giao hàng mới cho khách
  // ----------------------------------------------------
  console.log('16. [CUSTOMER] Tạo Địa chỉ giao hàng mới...');
  const addressData = await postJson(
    `${GATEWAY_URL}/customers/me/addresses`,
    {
      recipientName: 'Bác Ba Nông Dân',
      phone: customerPhone,
      provinceCode: '87',
      provinceName: 'Tỉnh Đồng Tháp',
      districtCode: '866',
      districtName: 'Thành phố Cao Lãnh',
      wardCode: '30001',
      wardName: 'Phường 1',
      addressLine: 'Ấp Mỹ Hưng, Xã Mỹ Trà',
      isDefault: true,
    },
    custToken,
  );
  const addressId = addressData.id;
  console.log(`   ✅ Đã lưu địa chỉ giao hàng: ID=${addressId}, Người nhận="${addressData.recipientName}"\n`);

  // ----------------------------------------------------
  // BƯỚC 17: Thẩm định và áp dụng mã Coupon giảm giá
  // ----------------------------------------------------
  console.log('17. [CUSTOMER] Áp dụng mã Coupon ưu đãi "PHANBON50K"...');
  const couponData = await postJson(
    `${GATEWAY_URL}/coupons/validate`,
    {
      code: 'PHANBON50K',
      subtotal: 500000,
    },
    custToken,
  );
  assert.strictEqual(couponData.code, 'PHANBON50K');
  assert.strictEqual(couponData.discountAmount, 50000, 'Giảm giá phải là 50.000đ');
  console.log(`   ✅ Coupon "${couponData.code}" hợp lệ: Giảm ngay ${couponData.discountAmount}đ\n`);

  // ----------------------------------------------------
  // BƯỚC 18: Đặt hàng (Checkout) với BANK_TRANSFER
  // ----------------------------------------------------
  console.log('18. [CUSTOMER] Tiến hành Đặt Hàng (Checkout) với BANK_TRANSFER...');
  const checkoutPayload = {
    items: [
      {
        productId,
        variantId,
        quantity: 1,
      },
    ],
    couponCode: 'PHANBON50K',
    paymentMethod: 'BANK_TRANSFER',
    shippingAddress: {
      recipientName: 'Bác Ba Nông Dân',
      phone: customerPhone,
      provinceCode: '87',
      provinceName: 'Tỉnh Đồng Tháp',
      districtCode: '866',
      districtName: 'Thành phố Cao Lãnh',
      wardCode: '30001',
      wardName: 'Phường 1',
      addressLine: 'Ấp Mỹ Hưng, Xã Mỹ Trà',
    },
    customerNote: 'Giao giờ hành chính, gọi trước khi đến',
  };

  const checkoutRes = await fetch(`${GATEWAY_URL}/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${custToken}`,
      'Idempotency-Key': `flow-checkout-${uniqueSuffix}`,
    },
    body: JSON.stringify(checkoutPayload),
  });
  const checkoutJson = await checkoutRes.json().catch(() => ({}));
  assert.ok(checkoutRes.ok, `Checkout failed: ${JSON.stringify(checkoutJson)}`);
  const createdOrder = checkoutJson.data?.order || checkoutJson.data;
  const orderId = createdOrder.orderId || createdOrder.id;
  const orderNumber = createdOrder.orderNumber;
  const paymentRecord = createdOrder.payment;

  console.log(`   ✅ Đặt hàng thành công:`);
  console.log(`      - Mã đơn hàng: ${orderNumber}`);
  console.log(`      - Trạng thái đơn: ${createdOrder.status}`);
  console.log(`      - Trạng thái thanh toán: ${createdOrder.paymentStatus}`);
  console.log(`      - Tiền hàng: ${createdOrder.subtotal}đ - Giảm giá: ${createdOrder.discountAmount}đ + Vận chuyển: ${createdOrder.shippingFee}đ = Tổng: ${createdOrder.totalAmount}đ`);
  assert.strictEqual(createdOrder.status, 'PENDING');
  assert.strictEqual(createdOrder.paymentStatus, 'PENDING');
  assert.strictEqual(createdOrder.paymentMethod, 'BANK_TRANSFER');
  assert.ok(paymentRecord, 'Bản ghi thanh toán phải được tạo');
  assert.strictEqual(paymentRecord.status, 'PENDING');
  console.log(`      - Hướng dẫn chuyển khoản: ${createdOrder.paymentInstruction || 'Chuyển khoản kèm mã ' + orderNumber}\n`);

  // ----------------------------------------------------
  // BƯỚC 19: Xác minh trạng thái tồn kho sau Checkout
  // ----------------------------------------------------
  console.log('19. [HỆ THỐNG] Kiểm tra biến động tồn kho sau khi tạo đơn...');
  const invItemsAfter = await getJson(`${GATEWAY_URL}/inventory/products/${productId}`);
  const invAfterCheckout = invItemsAfter.find((i) => i.variantId === variantId);
  console.log(`   Tồn kho hiện tại: Stock=${invAfterCheckout.stockQuantity}, Reserved=${invAfterCheckout.reservedQuantity}, Available=${invAfterCheckout.availableQuantity}`);
  assert.strictEqual(invAfterCheckout.stockQuantity, 50, 'Stock vật lý vẫn là 50');
  assert.strictEqual(invAfterCheckout.reservedQuantity, 1, 'Reserved tăng lên 1 do Saga giữ hàng');
  assert.strictEqual(invAfterCheckout.availableQuantity, 49, 'Available giảm còn 49 để chống oversell');
  console.log('   ✅ Đảm bảo chống Oversell thành công: Reserved=1, Available=49\n');

  // ----------------------------------------------------
  // BƯỚC 20: Khách hàng xem chi tiết đơn hàng & thanh toán
  // ----------------------------------------------------
  console.log('20. [CUSTOMER] Xem chi tiết đơn hàng và giao dịch thanh toán...');
  const custOrderDetail = await getJson(`${GATEWAY_URL}/orders/${orderId}`, custToken);
  assert.strictEqual(custOrderDetail.orderNumber, orderNumber);

  const paymentDetails = await getJson(`${GATEWAY_URL}/payments/orders/${orderId}`, custToken);
  const paymentObj = Array.isArray(paymentDetails) ? paymentDetails[0] : paymentDetails;
  const paymentId = paymentObj?.id || paymentRecord?.id;
  assert.ok(paymentId, 'Payment ID phải tồn tại');
  console.log(`   ✅ Đã tra cứu giao dịch thanh toán ID=${paymentId}, Trạng thái=${paymentObj?.status || 'PENDING'}\n`);

  // ----------------------------------------------------
  // BƯỚC 21: Quản trị viên xem danh sách đơn hàng
  // ----------------------------------------------------
  console.log('21. [ADMIN] Quản trị viên tra cứu danh sách đơn hàng...');
  const adminOrders = await getJson(
    `${GATEWAY_URL}/orders/admin?search=${encodeURIComponent(orderNumber)}`,
    adminToken,
  );
  assert.ok(adminOrders.items.some((o) => o.orderNumber === orderNumber), 'Admin phải tìm thấy đơn hàng vừa tạo');
  console.log(`   ✅ Admin tìm thấy đơn hàng "${orderNumber}" trong danh sách quản trị.\n`);

  // ----------------------------------------------------
  // BƯỚC 22: Quản trị viên xác nhận thanh toán BANK_TRANSFER
  // ----------------------------------------------------
  console.log('22. [ADMIN] Quản trị viên xác nhận thanh toán chuyển khoản thủ công...');
  const confirmResult = await postJson(
    `${GATEWAY_URL}/payments/${paymentId}/confirm`,
    {
      amount: Number(createdOrder.totalAmount),
      transactionReference: `BANK-TXN-${uniqueSuffix}`,
      note: 'Kế toán đã kiểm tra và nhận đủ tiền vào tài khoản Vietcombank',
    },
    adminToken,
  );
  const confirmedPayment = confirmResult.payment || confirmResult;
  assert.strictEqual(confirmedPayment.status, 'PAID', 'Trạng thái thanh toán phải là PAID');
  console.log(`   ✅ Đã xác nhận thanh toán thành công: Payment Status=PAID, Ref=${confirmedPayment.transactionReference}\n`);

  // ----------------------------------------------------
  // BƯỚC 23: Admin chuyển trạng thái CONFIRMED -> PROCESSING
  // ----------------------------------------------------
  console.log('23. [ADMIN] Chuyển trạng thái đơn hàng sang PROCESSING...');
  await patchJson(
    `${GATEWAY_URL}/orders/admin/${orderId}/status`,
    {
      status: 'PROCESSING',
      note: 'Đang chuyển lệnh sang bộ phận kho xử lý',
    },
    adminToken,
  );
  console.log('   ✅ Đã chuyển đơn hàng sang PROCESSING thành công.\n');

  // ----------------------------------------------------
  // BƯỚC 24: Chuyển trạng thái PROCESSING -> PACKING
  // ----------------------------------------------------
  console.log('24. [ADMIN] Chuyển trạng thái đơn hàng sang PACKING...');
  await patchJson(
    `${GATEWAY_URL}/orders/admin/${orderId}/status`,
    {
      status: 'PACKING',
      note: 'Thủ kho đang đóng gói bao bì phân bón chuyên dụng',
    },
    adminToken,
  );
  console.log('   ✅ Đã chuyển đơn hàng sang PACKING thành công.\n');

  // ----------------------------------------------------
  // BƯỚC 25: Chuyển trạng thái PACKING -> SHIPPED
  // ----------------------------------------------------
  console.log('25. [ADMIN] Chuyển trạng thái đơn hàng sang SHIPPED...');
  await patchJson(
    `${GATEWAY_URL}/orders/admin/${orderId}/status`,
    {
      status: 'SHIPPED',
      note: 'Đã giao cho đối tác vận chuyển hàng nông nghiệp cồng kềnh',
    },
    adminToken,
  );
  console.log('   ✅ Đã chuyển đơn hàng sang SHIPPED thành công.\n');

  // ----------------------------------------------------
  // BƯỚC 26: Chuyển trạng thái SHIPPED -> DELIVERED
  // ----------------------------------------------------
  console.log('26. [ADMIN] Chuyển trạng thái đơn hàng sang DELIVERED...');
  await patchJson(
    `${GATEWAY_URL}/orders/admin/${orderId}/status`,
    {
      status: 'DELIVERED',
      note: 'Khách hàng đã nhận đủ bao phân bón và ký biên bản giao nhận',
    },
    adminToken,
  );
  console.log('   ✅ Đã chuyển đơn hàng sang DELIVERED thành công.\n');

  // ----------------------------------------------------
  // BƯỚC 27: Chuyển trạng thái DELIVERED -> COMPLETED
  // (Kích hoạt xuất kho vật lý + xác thực đánh giá + cập nhật dashboard thật)
  // ----------------------------------------------------
  console.log('27. [ADMIN & SYSTEM] Chuyển trạng thái DELIVERED -> COMPLETED (Hoàn tất chu trình)...');
  await patchJson(
    `${GATEWAY_URL}/orders/admin/${orderId}/status`,
    {
      status: 'COMPLETED',
      note: 'Đơn hàng hoàn tất mỹ mãn, kích hoạt xuất kho vật lý',
    },
    adminToken,
  );
  console.log('   ✅ Đơn hàng đã chuyển sang trạng thái: COMPLETED');

  // Chờ 1.5 giây để commit asynchronous inventory hoàn tất
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // 27.1: Kiểm tra tồn kho vật lý sau commit
  console.log('   👉 Kiểm tra tồn kho sau COMPLETED (Yêu cầu: Stock=49, Reserved=0, Available=49)...');
  const invItemsFinal = await getJson(`${GATEWAY_URL}/inventory/products/${productId}`);
  const invFinal = invItemsFinal.find((i) => i.variantId === variantId);
  console.log(`      Tồn kho thực tế: Stock=${invFinal.stockQuantity}, Reserved=${invFinal.reservedQuantity}, Available=${invFinal.availableQuantity}`);
  assert.strictEqual(invFinal.stockQuantity, 49, 'Stock vật lý phải trừ còn 49');
  assert.strictEqual(invFinal.reservedQuantity, 0, 'Reserved phải về 0 do đã xuất kho');
  assert.strictEqual(invFinal.availableQuantity, 49, 'Available phải là 49');
  console.log('      ✅ Tồn kho vật lý đã được xuất kho chuẩn xác (Stock=49, Reserved=0, Available=49)');

  // 27.2: Khách hàng viết Đánh giá (Review) cho sản phẩm vừa mua
  console.log('   👉 Khách hàng gửi Đánh giá (Review) cho sản phẩm vừa mua...');
  const orderItemsList = custOrderDetail.items || [];
  const orderItemId = orderItemsList[0]?.id;

  const reviewData = await postJson(
    `${GATEWAY_URL}/reviews`,
    {
      productId,
      orderItemId,
      rating: 5,
      comment: 'Phân bón sinh học Trichoderma rất hiệu quả, rễ cây lúa ra trắng xóa sau 3 ngày bón!',
    },
    custToken,
  );
  console.log(`      Đánh giá: ID=${reviewData.id}, Rating=${reviewData.rating} sao, VerifiedPurchase=${reviewData.verifiedPurchase}`);
  assert.strictEqual(reviewData.verifiedPurchase, true, 'Backend PHẢI tự động xác thực verifiedPurchase = true');
  console.log('      ✅ Backend tự động chứng thực verifiedPurchase = true thành công!');

  // 27.3: Kiểm tra Dashboard Quản trị cập nhật doanh thu THẬT
  console.log('   👉 Kiểm tra Dashboard Quản trị với số liệu doanh thu THẬT...');
  const dashData = await getJson(`${GATEWAY_URL}/orders/admin/dashboard`, adminToken);
  console.log(`      Dashboard thực tế:`);
  console.log(`      - Doanh thu hôm nay: ${dashData.revenueToday.toLocaleString('vi-VN')} đ`);
  console.log(`      - Doanh thu tháng: ${dashData.revenueMonth.toLocaleString('vi-VN')} đ`);
  console.log(`      - Số đơn hôm nay: ${dashData.ordersToday}`);
  console.log(`      - Giá trị trung bình đơn (AOV): ${dashData.averageOrderValue.toLocaleString('vi-VN')} đ`);
  assert.ok(dashData.revenueToday >= Number(createdOrder.totalAmount), 'Doanh thu hôm nay phải bao gồm đơn hàng vừa thanh toán');
  console.log('      ✅ Doanh thu Dashboard được tính toán chuẩn xác từ dữ liệu thật, không có số liệu giả lập!\n');

  console.log('====================================================');
  console.log('🎉🎉🎉 CHÚC MỪNG: TOÀN BỘ 27 BƯỚC CỦA LUỒNG NGHIỆP VỤ THẬT ĐÃ HOÀN TẤT THÀNH CÔNG 100%!');
  console.log('====================================================');
}

run().catch((err) => {
  console.error('❌ Kiểm thử luồng thật thất bại:', err);
  process.exit(1);
});
