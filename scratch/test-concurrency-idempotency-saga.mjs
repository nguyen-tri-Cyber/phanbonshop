import assert from 'node:assert/strict';

const GATEWAY_URL = 'http://localhost:8080/api/v1';

async function run() {
  console.log('====================================================');
  console.log('⚡ BẮT ĐẦU KIỂM THỬ: CONCURRENCY, IDEMPOTENCY, SAGA & PRICE TAMPERING');
  console.log('====================================================\n');

  // Đăng nhập Admin & Customer
  const adminRes = await fetch(`${GATEWAY_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@phanbonshop.vn', password: 'Admin@123456' }),
  });
  const adminData = await adminRes.json();
  const adminToken = adminData.data?.accessToken || adminData.accessToken;

  const custRes = await fetch(`${GATEWAY_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@phanbonshop.vn', password: 'Admin@123456' }),
  });
  const custData = await custRes.json();
  const custToken = custData.data?.accessToken || custData.accessToken;

  // --- 14. INVENTORY CONCURRENCY TEST ---
  console.log('--- 14. INVENTORY CONCURRENCY TEST ---');
  console.log('Tạo một biến thể sản phẩm riêng cho bài test concurrency: Initial stock = 10, reserved = 0');
  
  // Lấy một sản phẩm thật để thêm biến thể test
  const prodListRes = await fetch(`${GATEWAY_URL}/products?limit=1`);
  const prodListData = await prodListRes.json();
  const testProduct = (prodListData.data?.items || prodListData.items || prodListData.data)[0];

  const uniqueSuffix = Date.now();
  const createVarRes = await fetch(`${GATEWAY_URL}/products/${testProduct.id}/variants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      sku: `CONCURRENCY-SKU-${uniqueSuffix}`,
      packageSize: '10kg',
      unit: 'Bao',
      price: 150000,
      compareAtPrice: 180000,
      status: 'ACTIVE',
    }),
  });
  assert.ok(createVarRes.ok, 'Tạo variant test concurrency phải thành công');
  const varData = await createVarRes.json();
  const testVariant = varData.data || varData;
  console.log(`Đã tạo variant test: ID=${testVariant.id}, SKU=${testVariant.sku}`);

  // Thiết lập tồn kho ban đầu: stock = 10, reserved = 0
  const initInvRes = await fetch(`${GATEWAY_URL}/inventory/adjust`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      productId: testProduct.id,
      variantId: testVariant.id,
      quantityChange: 10,
      reason: 'Khởi tạo 10 tồn kho cho bài test concurrency',
    }),
  });
  assert.ok(initInvRes.ok, 'Khởi tạo tồn kho phải thành công');
  console.log('Đã set tồn kho: stock = 10, reserved = 0, available = 10.\n');

  console.log('Bắn đồng thời 20 requests giữ hàng (reserve quantity = 1)...');
  const reservePromises = [];
  for (let i = 1; i <= 20; i++) {
    const reservationId = `concurrency-res-${uniqueSuffix}-${i}`;
    reservePromises.push(
      fetch(`http://localhost:8080/internal/v1/inventory/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': 'your_internal_service_mesh_shared_secret_2026',
        },
        body: JSON.stringify({
          reservationId,
          productId: testProduct.id,
          variantId: testVariant.id,
          quantity: 1,
          referenceType: 'TEST_CONCURRENCY',
          referenceId: `REF-${uniqueSuffix}-${i}`,
        }),
      }).then(async (res) => ({
        index: i,
        status: res.status,
        body: await res.json().catch(() => ({})),
      })),
    );
  }

  const results = await Promise.all(reservePromises);
  const successes = results.filter((r) => r.status === 200 || r.status === 201);
  const failures = results.filter((r) => r.status === 400 || r.status === 409);

  console.log(`Kết quả 20 concurrent reserves: ${successes.length} thành công, ${failures.length} thất bại.`);
  assert.strictEqual(successes.length, 10, 'Chính xác 10 request phải thành công');
  assert.strictEqual(failures.length, 10, 'Chính xác 10 request phải thất bại do hết hàng');

  // Kiểm tra tồn kho cuối cùng
  const checkInvRes = await fetch(`${GATEWAY_URL}/inventory/products/${testProduct.id}`);
  const checkInvData = await checkInvRes.json();
  const invList = checkInvData.data || checkInvData;
  const invFinal = invList.find((item) => item.variantId === testVariant.id);
  console.log(`Tồn kho cuối cùng: stock=${invFinal.stockQuantity}, reserved=${invFinal.reservedQuantity}, available=${invFinal.availableQuantity}`);
  assert.strictEqual(invFinal.stockQuantity, 10, 'stockQuantity phải là 10');
  assert.strictEqual(invFinal.reservedQuantity, 10, 'reservedQuantity phải là 10');
  assert.strictEqual(invFinal.availableQuantity, 0, 'availableQuantity phải là 0');
  console.log('✅ Inventory Concurrency test PASSED 100% (10 thành công, 10 thất bại, available = 0).\n');

  // --- 15. INVENTORY IDEMPOTENCY TEST ---
  console.log('--- 15. INVENTORY IDEMPOTENCY TEST ---');
  const sampleResId = `concurrency-res-${uniqueSuffix}-1`;

  console.log(`Gọi release lần 1 cho reservation ${sampleResId}...`);
  const rel1 = await fetch(`http://localhost:8080/internal/v1/inventory/release`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': 'your_internal_service_mesh_shared_secret_2026',
    },
    body: JSON.stringify({ reservationId: sampleResId, reason: 'Test release 1' }),
  });
  assert.ok(rel1.ok, 'Release lần 1 phải thành công');

  const invListAfterRel1 = (await (await fetch(`${GATEWAY_URL}/inventory/products/${testProduct.id}`)).json()).data;
  const invAfterRel1 = invListAfterRel1.find((item) => item.variantId === testVariant.id);
  assert.strictEqual(invAfterRel1.reservedQuantity, 9, 'reservedQuantity phải giảm còn 9');
  assert.strictEqual(invAfterRel1.availableQuantity, 1, 'availableQuantity phải tăng lên 1');

  console.log(`Gọi release lần 2 cho CÙNG reservation ${sampleResId}...`);
  const rel2 = await fetch(`http://localhost:8080/internal/v1/inventory/release`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': 'your_internal_service_mesh_shared_secret_2026',
    },
    body: JSON.stringify({ reservationId: sampleResId, reason: 'Test release 2 (duplicate)' }),
  });
  // Lần 2 phải không làm tăng available sai lần nữa
  const invListAfterRel2 = (await (await fetch(`${GATEWAY_URL}/inventory/products/${testProduct.id}`)).json()).data;
  const invAfterRel2 = invListAfterRel2.find((item) => item.variantId === testVariant.id);
  assert.strictEqual(invAfterRel2.reservedQuantity, 9, 'reservedQuantity KHÔNG được giảm lần 2');
  assert.strictEqual(invAfterRel2.availableQuantity, 1, 'availableQuantity KHÔNG được tăng sai lần 2');
  console.log('✅ Inventory Idempotency: Double release an toàn, không cộng sai tồn kho.\n');

  // Commit idempotency:
  const sampleResIdToCommit = `concurrency-res-${uniqueSuffix}-2`;
  console.log(`Gọi commit lần 1 cho reservation ${sampleResIdToCommit}...`);
  const com1 = await fetch(`http://localhost:8080/internal/v1/inventory/commit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': 'your_internal_service_mesh_shared_secret_2026',
    },
    body: JSON.stringify({ reservationId: sampleResIdToCommit, referenceId: 'any-order-id' }),
  });
  assert.ok(com1.ok, 'Commit lần 1 phải thành công');
  const invListAfterCom1 = (await (await fetch(`${GATEWAY_URL}/inventory/products/${testProduct.id}`)).json()).data;
  const invAfterCom1 = invListAfterCom1.find((item) => item.variantId === testVariant.id);
  assert.strictEqual(invAfterCom1.stockQuantity, 9, 'stockQuantity phải giảm còn 9');
  assert.strictEqual(invAfterCom1.reservedQuantity, 8, 'reservedQuantity phải giảm còn 8');

  console.log(`Gọi commit lần 2 cho CÙNG reservation ${sampleResIdToCommit}...`);
  const com2 = await fetch(`http://localhost:8080/internal/v1/inventory/commit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': 'your_internal_service_mesh_shared_secret_2026',
    },
    body: JSON.stringify({ reservationId: sampleResIdToCommit, referenceId: 'any-order-id' }),
  });
  const invListAfterCom2 = (await (await fetch(`${GATEWAY_URL}/inventory/products/${testProduct.id}`)).json()).data;
  const invAfterCom2 = invListAfterCom2.find((item) => item.variantId === testVariant.id);
  assert.strictEqual(invAfterCom2.stockQuantity, 9, 'stockQuantity KHÔNG được trừ đúp lần 2');
  assert.strictEqual(invAfterCom2.reservedQuantity, 8, 'reservedQuantity KHÔNG được trừ đúp lần 2');
  console.log('✅ Inventory Idempotency: Double commit an toàn, không trừ lặp stock.\n');

  // --- 16. CHECKOUT IDEMPOTENCY TEST ---
  console.log('--- 16. CHECKOUT IDEMPOTENCY TEST ---');
  // Tạo variant riêng cho checkout test
  const checkoutVarRes = await fetch(`${GATEWAY_URL}/products/${testProduct.id}/variants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      sku: `CHECKOUT-SKU-${uniqueSuffix}`,
      packageSize: '25kg',
      unit: 'Bao',
      price: 350000,
      compareAtPrice: 380000,
      status: 'ACTIVE',
    }),
  });
  assert.ok(checkoutVarRes.ok, 'Tạo checkout variant phải thành công');
  const checkoutVarData = await checkoutVarRes.json();
  const checkoutVar = checkoutVarData.data || checkoutVarData;

  // Khởi tạo tồn kho 100
  const initCheckoutInv = await fetch(`${GATEWAY_URL}/inventory/adjust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      productId: testProduct.id,
      variantId: checkoutVar.id,
      quantityChange: 100,
      reason: 'Bơm tồn kho cho checkout idempotency test',
    }),
  });
  assert.ok(initCheckoutInv.ok, 'Bơm tồn kho cho checkout test phải thành công');

  const sharedIdempotencyKey = `idemp-key-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  console.log(`Gửi 10 concurrent requests checkout với CÙNG Idempotency-Key: ${sharedIdempotencyKey}...`);

  const checkoutPayload = {
    items: [
      {
        productId: testProduct.id,
        variantId: checkoutVar.id,
        quantity: 1,
      },
    ],
    paymentMethod: 'COD',
    shippingAddress: {
      recipientName: 'Nguyễn Văn Idempotent',
      phone: '0988776655',
      provinceCode: '79',
      provinceName: 'TP. Hồ Chí Minh',
      districtCode: '760',
      districtName: 'Quận 1',
      wardCode: '26740',
      wardName: 'Phường Bến Nghé',
      addressLine: '123 Đường Idempotent, Q1, TP.HCM',
    },
  };

  const checkoutPromises = [];
  for (let i = 0; i < 10; i++) {
    checkoutPromises.push(
      fetch(`${GATEWAY_URL}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${custToken}`,
          'Idempotency-Key': sharedIdempotencyKey,
        },
        body: JSON.stringify(checkoutPayload),
      }).then(async (res) => ({
        status: res.status,
        data: await res.json().catch(() => ({})),
      })),
    );
  }

  const checkoutResults = await Promise.all(checkoutPromises);
  console.log('Checkout results summary:', checkoutResults.map((r) => ({ status: r.status, msg: r.data?.error?.message || r.data?.message || 'OK' })));
  const okCheckouts = checkoutResults.filter((r) => r.status === 200 || r.status === 201);
  const inProgressCheckouts = checkoutResults.filter((r) => r.status === 409);
  console.log(`Số phản hồi thành công (200/201): ${okCheckouts.length}/10`);
  assert.strictEqual(okCheckouts.length, 1, 'Chỉ 1 request concurrent được quyền tạo checkout cho cùng Idempotency-Key');
  assert.strictEqual(
    inProgressCheckouts.length,
    9,
    '9 request concurrent còn lại phải bị chặn an toàn bằng 409 để không tạo side effect trùng lặp',
  );

  // Lấy ra danh sách orderId từ các kết quả
  const orderIds = new Set(
    okCheckouts.map((r) => (r.data.data?.order?.id || r.data.data?.id || r.data.order?.id || r.data.id)),
  );
  console.log(`Số lượng Order duy nhất được tạo ra: ${orderIds.size}`);
  assert.strictEqual(orderIds.size, 1, 'Chính xác CHỈ CÓ 1 Order được tạo ra cho cùng Idempotency-Key');
  console.log('✅ Checkout Idempotency: 10 concurrent requests chỉ tạo đúng 1 đơn hàng duy nhất.\n');

  // --- 17. PRICE TAMPERING TEST ---
  console.log('--- 17. PRICE TAMPERING TEST ---');
  console.log('Client cố ý gửi: price = 1đ, subtotal = 1đ, total = 1đ, discount = 999999đ...');
  const tamperingPayload = {
    items: [
      {
        productId: testProduct.id,
        variantId: checkoutVar.id,
        quantity: 2,
        price: 1, // GIÁ GIẢ MẠO
        subtotal: 2, // GIÁ GIẢ MẠO
        total: 2, // GIÁ GIẢ MẠO
      },
    ],
    price: 1,
    subtotal: 2,
    discount: 999999,
    shippingFee: 0,
    total: 2,
    paymentMethod: 'COD',
    shippingAddress: {
      recipientName: 'Tester Price Tampering',
      phone: '0912345678',
      provinceCode: '79',
      provinceName: 'TP. Hồ Chí Minh',
      districtCode: '760',
      districtName: 'Quận 1',
      wardCode: '26740',
      wardName: 'Phường Bến Nghé',
      addressLine: '123 Đường An Ninh',
    },
  };

  const tamperRes = await fetch(`${GATEWAY_URL}/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${custToken}`,
    },
    body: JSON.stringify(tamperingPayload),
  });
  assert.ok(tamperRes.ok, 'Checkout phải thành công và server tự tính giá');
  const tamperData = await tamperRes.json();
  const orderCreated = tamperData.data?.order || tamperData.data || tamperData.order;

  console.log(`Giá trị đơn hàng server-side tạo ra: subtotal=${orderCreated.subtotal}, total=${orderCreated.totalAmount}`);
  assert.notStrictEqual(Number(orderCreated.totalAmount), 2, 'Server tuyệt đối KHÔNG nhận giá 2đ từ client');
  assert.ok(Number(orderCreated.totalAmount) >= 700000, 'Server phải tính giá thật theo giá catalog trong DB');
  console.log('✅ Price Tampering: Backend hoàn toàn bỏ qua giá client gửi, tính giá chuẩn xác từ DB.\n');

  // --- 18. SAGA COMPENSATION TEST ---
  console.log('--- 18. SAGA COMPENSATION TEST ---');
  console.log('Mô phỏng: Reservation tồn kho thành công nhưng luồng tạo đơn thất bại -> Kiểm tra compensation release kho...');
  
  const initList = (await (await fetch(`${GATEWAY_URL}/inventory/products/${testProduct.id}`)).json()).data;
  const initialInv = initList.find((i) => i.variantId === checkoutVar.id);
  console.log(`Tồn kho trước khi test Saga: stock=${initialInv.stockQuantity}, reserved=${initialInv.reservedQuantity}, available=${initialInv.availableQuantity}`);

  // Gửi checkout với địa chỉ rỗng/sai để cố tình gây lỗi trong quá trình tạo đơn (sau khi reserve hoặc kiểm tra)
  const failCheckoutRes = await fetch(`${GATEWAY_URL}/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${custToken}`,
    },
    body: JSON.stringify({
      items: [
        {
          productId: testProduct.id,
          variantId: checkoutVar.id,
          quantity: 1,
        },
      ],
      paymentMethod: 'COD',
      shippingAddress: null, // LỖI CỐ TÌNH: địa chỉ null
    }),
  });
  assert.strictEqual(failCheckoutRes.status, 400, 'Request thiếu địa chỉ phải bị 400');

  // Kiểm tra tồn kho sau khi thất bại: reservedQuantity KHÔNG ĐƯỢC tăng treo
  const finalList = (await (await fetch(`${GATEWAY_URL}/inventory/products/${testProduct.id}`)).json()).data;
  const finalInv = finalList.find((i) => i.variantId === checkoutVar.id);
  console.log(`Tồn kho sau khi thất bại: stock=${finalInv.stockQuantity}, reserved=${finalInv.reservedQuantity}, available=${finalInv.availableQuantity}`);
  assert.strictEqual(finalInv.reservedQuantity, initialInv.reservedQuantity, 'Tồn kho reserved KHÔNG bị treo sau khi tạo đơn thất bại');
  console.log('✅ Saga Compensation: Không để tồn kho treo khi có sự cố giao dịch.\n');

  console.log('====================================================');
  console.log('🎉 TẤT CẢ CÁC BƯỚC KIỂM THỬ CONCURRENCY, IDEMPOTENCY, SAGA ĐÃ PASS 100%!');
  console.log('====================================================');
}

run().catch((err) => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});
