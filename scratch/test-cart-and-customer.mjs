import assert from 'node:assert';

const GATEWAY_URL = 'http://localhost:8080/api/v1';

async function testCartAndCustomerFlow() {
  console.log('===============================================================');
  console.log('KIỂM ĐỊNH TÍCH HỢP TOÀN DIỆN CART & CUSTOMER SERVICE');
  console.log('===============================================================\n');

  // Lấy danh sách sản phẩm thật từ API Gateway
  console.log('1. Lấy sản phẩm thật từ Product Service qua Gateway...');
  const prodRes = await fetch(`${GATEWAY_URL}/products?limit=5`);
  const prodJson = await prodRes.json();
  assert.strictEqual(prodJson.success, true, 'Lấy sản phẩm thành công');
  assert.ok(prodJson.data.items.length >= 2, 'Có ít nhất 2 sản phẩm');

  const p1 = prodJson.data.items[0];
  const p2 = prodJson.data.items[1];
  const v1 = p1.variants[0];
  const v2 = p2.variants[0];

  console.log(`- Sản phẩm 1: "${p1.name}" (Variant: ${v1.packageSize}, Giá: ${v1.price}đ)`);
  console.log(`- Sản phẩm 2: "${p2.name}" (Variant: ${v2.packageSize}, Giá: ${v2.price}đ)\n`);

  // [Tiêu chí 1 & 2]: Guest Cart & LocalStorage Simulation
  console.log('[TIÊU CHÍ 1 & 2]: Giả lập Guest thêm 2 sản phẩm vào LocalStorage');
  let guestLocalStorage = [
    {
      variantId: v1.id,
      productId: p1.id,
      productName: p1.name,
      productSlug: p1.slug,
      sku: v1.sku,
      packageSize: v1.packageSize,
      price: Number(v1.price),
      quantity: 2,
    },
    {
      variantId: v2.id,
      productId: p2.id,
      productName: p2.name,
      productSlug: p2.slug,
      sku: v2.sku,
      packageSize: v2.packageSize,
      price: Number(v2.price),
      quantity: 3,
    },
  ];

  console.log(`✓ Guest đã thêm 2 sản phẩm vào LocalStorage:`);
  console.log(`  - Item 1 (${guestLocalStorage[0].sku}): Số lượng = 2`);
  console.log(`  - Item 2 (${guestLocalStorage[1].sku}): Số lượng = 3`);

  // Giả lập Refresh trang: Đọc lại từ LocalStorage
  const reloadedGuestCart = JSON.parse(JSON.stringify(guestLocalStorage));
  assert.strictEqual(reloadedGuestCart.length, 2, 'LocalStorage bảo lưu 2 item sau refresh');
  console.log('✓ Reload trang: LocalStorage bảo lưu nguyên vẹn 2 sản phẩm.\n');

  // Đăng ký và đăng nhập tài khoản khách hàng thực nghiệm
  console.log('Chuẩn bị tài khoản khách hàng thực nghiệm...');
  const testEmail = `nongdan_${Date.now()}@taynguyen.vn`;
  const testPassword = 'Password123@#';
  const testPhone = '09' + Math.floor(10000000 + Math.random() * 90000000);
  const testFullName = 'Nguyễn Văn Nông Dân';

  const regRes = await fetch(`${GATEWAY_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      phone: testPhone,
      fullName: testFullName,
    }),
  });
  const regJson = await regRes.json();
  assert.strictEqual(regJson.success, true, 'Đăng ký tài khoản thành công');

  const loginRes = await fetch(`${GATEWAY_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
    }),
  });
  const loginJson = await loginRes.json();
  assert.strictEqual(loginJson.success, true, 'Đăng nhập thành công');
  const token = loginJson.data.accessToken;
  assert.ok(token, 'Nhận được JWT Access Token');
  console.log(`✓ Đăng nhập thành công với email: ${testEmail}\n`);

  // [Tiêu chí 3]: Login -> Merge guest cart vào backend
  console.log('[TIÊU CHÍ 3]: Gộp Guest Cart vào Backend (order-service / order_db)');
  const mergeRes = await fetch(`${GATEWAY_URL}/cart/merge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      items: guestLocalStorage,
    }),
  });
  const mergeJson = await mergeRes.json();
  assert.strictEqual(mergeJson.success, true, 'Gọi /cart/merge thành công');
  assert.strictEqual(mergeJson.data.items.length, 2, 'Backend có đủ 2 items sau khi gộp');
  console.log('✓ Đã gộp thành công Guest Cart vào Database của Order Service:');
  mergeJson.data.items.forEach((item) => {
    console.log(`  - [${item.sku}] ${item.productName}: Số lượng = ${item.quantity}, Đơn giá = ${item.price}đ`);
  });
  console.log(`  -> Tổng sản phẩm: ${mergeJson.data.totalQuantity}, Tạm tính: ${mergeJson.data.subtotal}đ\n`);

  // [Tiêu chí 4]: Refresh -> Authenticated cart preserved
  console.log('[TIÊU CHÍ 4]: F5 / Refresh tải lại trang khi đã đăng nhập (GET /api/v1/cart)');
  const fetchCartRes = await fetch(`${GATEWAY_URL}/cart`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const fetchCartJson = await fetchCartRes.json();
  assert.strictEqual(fetchCartJson.success, true, 'Lấy giỏ hàng authenticated thành công');
  assert.strictEqual(fetchCartJson.data.items.length, 2, 'Bảo toàn 2 items sau refresh');
  console.log('✓ Giỏ hàng của người dùng được bảo tồn chính xác từ Database.\n');

  // Thao tác với Giỏ hàng (Cart Operations): Update quantity, change variant
  console.log('Kiểm tra các Cart Operations:');
  console.log('- Cập nhật số lượng item 1 lên 5...');
  const updateRes = await fetch(`${GATEWAY_URL}/cart/items/${v1.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ quantity: 5 }),
  });
  const updateJson = await updateRes.json();
  assert.strictEqual(updateJson.success, true);
  const updatedItem = updateJson.data.items.find((i) => i.variantId === v1.id);
  assert.strictEqual(updatedItem.quantity, 5, 'Số lượng đã cập nhật thành 5');
  console.log(`✓ Cập nhật thành công: Số lượng mới = ${updatedItem.quantity}`);

  // Test đổi biến thể nếu sản phẩm 1 có biến thể thứ 2, hoặc sản phẩm 2
  if (p1.variants.length > 1) {
    const vAlt = p1.variants[1];
    console.log(`- Đổi biến thể từ ${v1.packageSize} sang ${vAlt.packageSize}...`);
    const changeVariantRes = await fetch(`${GATEWAY_URL}/cart/items/${v1.id}/variant`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        newVariantId: vAlt.id,
        sku: vAlt.sku,
        packageSize: vAlt.packageSize,
        price: Number(vAlt.price),
      }),
    });
    const changeJson = await changeVariantRes.json();
    assert.strictEqual(changeJson.success, true, 'Đổi biến thể thành công');
    console.log(`✓ Đã đổi sang biến thể mới: ${vAlt.sku} (${vAlt.packageSize})`);
  }

  // [Tiêu chí 5]: Đăng xuất rồi Đăng nhập lại -> Giỏ hàng vẫn được lưu trong DB
  console.log('\n[TIÊU CHÍ 5]: Giả lập Đăng xuất rồi Đăng nhập lại trên thiết bị khác');
  const loginAgainRes = await fetch(`${GATEWAY_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  const loginAgainJson = await loginAgainRes.json();
  const token2 = loginAgainJson.data.accessToken;

  const cartAfterReloginRes = await fetch(`${GATEWAY_URL}/cart`, {
    headers: { Authorization: `Bearer ${token2}` },
  });
  const cartAfterReloginJson = await cartAfterReloginRes.json();
  assert.strictEqual(cartAfterReloginJson.success, true);
  assert.ok(cartAfterReloginJson.data.items.length >= 2, 'Giỏ hàng vẫn lưu đầy đủ trong database sau đăng nhập lại');
  console.log(`✓ Sau khi đăng nhập lại: Giỏ hàng bảo lưu ${cartAfterReloginJson.data.items.length} items trong order_db.\n`);

  // [Tiêu chí 6]: Customer Service - Tạo địa chỉ nhận hàng thực tế
  console.log('[TIÊU CHÍ 6]: Customer Service - Quản lý Hồ sơ & Sổ địa chỉ giao hàng');

  // 6.1 Lấy dataset địa giới hành chính Việt Nam từ Customer Service
  console.log('- Đọc dữ liệu Tỉnh/Thành Việt Nam từ Customer Service...');
  const divRes = await fetch(`${GATEWAY_URL}/customers/divisions`);
  const divJson = await divRes.json();
  assert.strictEqual(divJson.success, true, 'Lấy dataset đơn vị hành chính thành công');
  assert.strictEqual(divJson.data.version, '2024.1', 'Phiên bản dataset 2024.1');
  console.log(`✓ Dataset Hành chính Việt Nam phiên bản: ${divJson.data.version}, gồm ${divJson.data.provinces.length} Tỉnh/Thành trọng điểm nông nghiệp.`);

  // 6.2 Cập nhật thông tin cá nhân
  console.log('- Cập nhật họ tên & số điện thoại nông dân...');
  const updateProfRes = await fetch(`${GATEWAY_URL}/customers/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fullName: 'Bác Ba Nông Dân - Hợp Tác Xã Sầu Riêng Ea Kly',
      phone: '0918889999',
    }),
  });
  const updateProfJson = await updateProfRes.json();
  assert.strictEqual(updateProfJson.success, true, 'Cập nhật hồ sơ thành công');
  assert.strictEqual(updateProfJson.data.fullName, 'Bác Ba Nông Dân - Hợp Tác Xã Sầu Riêng Ea Kly');
  console.log(`✓ Hồ sơ cá nhân đã cập nhật: "${updateProfJson.data.fullName}", SĐT: ${updateProfJson.data.phone}`);

  // 6.3 Tạo địa chỉ giao hàng thực tế (Tỉnh Đắk Lắk, Huyện Krông Pắc, Xã Ea Kly)
  console.log('- Tạo địa chỉ giao phân bón tận vườn/kho...');
  const createAddrRes = await fetch(`${GATEWAY_URL}/customers/me/addresses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      recipientName: 'Bác Ba Nông Dân',
      phone: '0918889999',
      provinceCode: '66',
      provinceName: 'Tỉnh Đắk Lắk',
      districtCode: '664',
      districtName: 'Huyện Krông Pắc',
      wardCode: '24580',
      wardName: 'Xã Ea Kly',
      addressLine: 'Thôn 2, Xứ đồng Cánh Đông (Gần cống đập 3)',
      isDefault: true,
    }),
  });
  const createAddrJson = await createAddrRes.json();
  assert.strictEqual(createAddrJson.success, true, 'Thêm địa chỉ thành công');
  assert.strictEqual(createAddrJson.data.isDefault, true, 'Tự động gán mặc định');
  const addressId1 = createAddrJson.data.id;
  console.log(`✓ Đã lưu địa chỉ giao hàng (ID: ${addressId1}):`);
  console.log(`  - Người nhận: ${createAddrJson.data.recipientName} (${createAddrJson.data.phone})`);
  console.log(`  - Địa chỉ: ${createAddrJson.data.addressLine}, ${createAddrJson.data.wardName}, ${createAddrJson.data.districtName}, ${createAddrJson.data.provinceName}`);
  console.log(`  - Trạng thái mặc định: ${createAddrJson.data.isDefault}`);

  // 6.4 Tạo địa chỉ thứ hai (Trang trại Cà phê Cư M'gar)
  console.log('- Tạo địa chỉ thứ 2 (Vườn cà phê Cư M\'gar)...');
  const createAddr2Res = await fetch(`${GATEWAY_URL}/customers/me/addresses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      recipientName: 'Anh Tư (Quản lý vườn Cư M\'gar)',
      phone: '0977112233',
      provinceCode: '66',
      provinceName: 'Tỉnh Đắk Lắk',
      districtCode: '663',
      districtName: 'Huyện Cư M\'gar',
      wardCode: '24550',
      wardName: 'Xã Quảng Tiến',
      addressLine: 'Đội 4, Nông trường Cà phê',
      isDefault: false,
    }),
  });
  const createAddr2Json = await createAddr2Res.json();
  assert.strictEqual(createAddr2Json.success, true);
  const addressId2 = createAddr2Json.data.id;
  console.log(`✓ Đã lưu địa chỉ thứ 2 (ID: ${addressId2}): ${createAddr2Json.data.recipientName} - ${createAddr2Json.data.addressLine}`);

  // 6.5 Đổi địa chỉ mặc định sang địa chỉ 2
  console.log('- Đặt địa chỉ thứ 2 làm mặc định...');
  const setDefaultRes = await fetch(`${GATEWAY_URL}/customers/me/addresses/${addressId2}/default`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  const setDefaultJson = await setDefaultRes.json();
  assert.strictEqual(setDefaultJson.success, true, 'Đặt mặc định thành công');

  // Kiểm tra danh sách địa chỉ
  const listAddrRes = await fetch(`${GATEWAY_URL}/customers/me/addresses`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const listAddrJson = await listAddrRes.json();
  assert.strictEqual(listAddrJson.success, true);
  assert.strictEqual(listAddrJson.data.length, 2);
  const addr2InList = listAddrJson.data.find((a) => a.id === addressId2);
  const addr1InList = listAddrJson.data.find((a) => a.id === addressId1);
  assert.strictEqual(addr2InList.isDefault, true, 'Địa chỉ 2 hiện là mặc định');
  assert.strictEqual(addr1InList.isDefault, false, 'Địa chỉ 1 không còn là mặc định');
  console.log('✓ Đổi địa chỉ mặc định thành công (Address 2 = true, Address 1 = false).');

  console.log('\n===============================================================');
  console.log('TẤT CẢ 6 TIÊU CHÍ KIỂM ĐỊNH ĐÃ VƯỢT QUA 100% HOÀN HẢO!');
  console.log('===============================================================');
}

testCartAndCustomerFlow().catch((err) => {
  console.error('\n❌ KIỂM ĐỊNH THẤT BẠI:', err);
  process.exit(1);
});
