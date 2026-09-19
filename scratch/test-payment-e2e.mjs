import assert from 'node:assert';
import jwt from 'jsonwebtoken';

const GATEWAY_URL = 'http://localhost:8080/api/v1';
const JWT_SECRET =
  process.env.JWT_ACCESS_SECRET ||
  'your_jwt_access_secret_key_phanbonshop_32chars_min';

async function runPaymentE2ETests() {
  console.log('======================================================================');
  console.log('KIỂM ĐỊNH TOÀN TRÌNH E2E PAYMENT MODULE (PHASE 11)');
  console.log('======================================================================\n');

  // Chuẩn bị 1: Tạo Customer thật qua API Gateway
  const uniquePhone = '09' + Math.floor(10000000 + Math.random() * 90000000);
  const testCustomer = {
    email: `nongdan_pay_${Date.now()}@eakly.vn`,
    password: 'Password123@#',
    fullName: 'Lê Văn Lúa - Nông Dân Đắk Lắk',
    phone: uniquePhone,
  };

  console.log('0. Khởi tạo tài khoản thực nghiệm:');
  const regRes = await fetch(`${GATEWAY_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testCustomer),
  });
  const regJson = await regRes.json();
  assert.strictEqual(regJson.success, true, 'Đăng ký khách hàng thành công');

  const loginRes = await fetch(`${GATEWAY_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testCustomer.email,
      password: testCustomer.password,
    }),
  });
  const loginJson = await loginRes.json();
  assert.strictEqual(loginJson.success, true, 'Đăng nhập khách hàng thành công');
  const customerToken = loginJson.data.accessToken;
  const customerId = loginJson.data.user.id;
  console.log(`✓ Khách hàng: ${testCustomer.fullName} (ID: ${customerId})`);

  // Chuẩn bị 2: Tạo Admin JWT token
  const adminToken = jwt.sign(
    {
      sub: 'adm-eakly-001',
      email: 'admin_audit@phanbonshop.vn',
      role: 'ADMIN',
      fullName: 'Nguyễn Quản Trị Viên',
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
  console.log('✓ Token Quản trị viên (ADMIN) đã khởi tạo.\n');

  // Lấy một sản phẩm thật còn đủ tồn cho cả COD (1) và BANK_TRANSFER (2).
  const prodRes = await fetch(`${GATEWAY_URL}/products?limit=20`);
  const prodJson = await prodRes.json();
  assert.ok(prodJson.data.items.length >= 1, 'Cần ít nhất 1 sản phẩm');

  let p1;
  let v1;
  for (const product of prodJson.data.items) {
    const inventoryRes = await fetch(`${GATEWAY_URL}/inventory/products/${product.id}`);
    const inventoryJson = await inventoryRes.json().catch(() => ({}));
    const inventoryRows = inventoryJson.data || inventoryJson.items || inventoryJson || [];
    const rows = Array.isArray(inventoryRows) ? inventoryRows : [];
    const stockedVariant = product.variants.find((variant) => {
      const row = rows.find((item) => item.variantId === variant.id);
      return row && Number(row.availableQuantity) >= 3;
    });
    if (stockedVariant) {
      p1 = product;
      v1 = stockedVariant;
      break;
    }
  }

  assert.ok(p1 && v1, 'Cần ít nhất 1 variant còn availableQuantity >= 3 để test payment');
  console.log(`- Sản phẩm thử nghiệm: "${p1.name}" (${v1.packageSize}) - ${v1.price}đ\n`);

  // ----------------------------------------------------------------------------------
  // [TEST 1]: Tạo order COD -> Payment status PENDING
  // ----------------------------------------------------------------------------------
  console.log('--- [TEST 1]: Tạo đơn hàng COD -> Payment status PENDING ---');
  const codCheckoutPayload = {
    items: [
      {
        productId: p1.id,
        variantId: v1.id,
        quantity: 1,
      },
    ],
    shippingAddress: {
      recipientName: 'Bác Ba COD',
      phone: '0918112233',
      provinceCode: '66',
      provinceName: 'Tỉnh Đắk Lắk',
      districtCode: '664',
      districtName: 'Huyện Krông Pắc',
      wardCode: '24580',
      wardName: 'Xã Ea Kly',
      addressLine: 'Thôn 2, Xứ đồng Cánh Đông',
    },
    paymentMethod: 'COD',
    customerNote: 'Thanh toán tiền mặt khi nhận phân bón',
  };

  const codRes = await fetch(`${GATEWAY_URL}/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
      'Idempotency-Key': `cod-test-${Date.now()}`,
    },
    body: JSON.stringify(codCheckoutPayload),
  });

  const codJson = await codRes.json();
  assert.strictEqual(codJson.success, true, 'Checkout COD thành công');
  const codOrder = codJson.data;

  assert.ok(codOrder.orderId, 'Order ID phải tồn tại');
  assert.strictEqual(codOrder.paymentMethod, 'COD', 'Phương thức thanh toán phải là COD');
  assert.strictEqual(codOrder.paymentStatus, 'PENDING', 'Trạng thái thanh toán của Order phải là PENDING');
  assert.ok(codOrder.payment, 'Bản ghi payment phải được trả về');
  assert.strictEqual(codOrder.payment.method, 'COD', 'Payment method = COD');
  assert.strictEqual(codOrder.payment.status, 'PENDING', 'Payment record status = PENDING');
  assert.strictEqual(codOrder.payment.amount, codOrder.totalAmount, 'Số tiền payment phải khớp tổng đơn');

  console.log(`✓ Đơn hàng COD: ${codOrder.orderNumber} (Tổng: ${codOrder.totalAmount}đ)`);
  console.log(`✓ Payment Record: ID=${codOrder.payment.id}, Status=${codOrder.payment.status}, Method=${codOrder.payment.method}`);
  console.log('✓ [TEST 1 ĐẠT]: Tạo order COD -> Payment status PENDING chính xác.\n');

  // ----------------------------------------------------------------------------------
  // [TEST 2]: Tạo order BANK_TRANSFER -> Hiển thị thông tin ngân hàng, số tiền, memo, VietQR
  // ----------------------------------------------------------------------------------
  console.log('--- [TEST 2]: Tạo order BANK_TRANSFER -> Hiển thị VietQR, memo chứa orderNumber ---');
  const bankCheckoutPayload = {
    items: [
      {
        productId: p1.id,
        variantId: v1.id,
        quantity: 2,
      },
    ],
    shippingAddress: {
      recipientName: 'Bác Tư Chuyển Khoản',
      phone: '0918334455',
      provinceCode: '66',
      provinceName: 'Tỉnh Đắk Lắk',
      districtCode: '664',
      districtName: 'Huyện Krông Pắc',
      wardCode: '24580',
      wardName: 'Xã Ea Kly',
      addressLine: 'Thôn 4, Cánh đồng mẫu lớn',
    },
    paymentMethod: 'BANK_TRANSFER',
    customerNote: 'Thanh toán quét mã VietQR',
  };

  const bankRes = await fetch(`${GATEWAY_URL}/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
      'Idempotency-Key': `bank-test-${Date.now()}`,
    },
    body: JSON.stringify(bankCheckoutPayload),
  });

  const bankJson = await bankRes.json();
  assert.strictEqual(bankJson.success, true, 'Checkout BANK_TRANSFER thành công');
  const bankOrder = bankJson.data;

  assert.ok(bankOrder.orderId, 'Order ID phải tồn tại');
  assert.strictEqual(bankOrder.paymentMethod, 'BANK_TRANSFER');
  assert.strictEqual(bankOrder.paymentStatus, 'PENDING');
  assert.ok(bankOrder.payment, 'Payment object phải tồn tại');
  assert.strictEqual(bankOrder.payment.status, 'PENDING');

  const details = bankOrder.paymentDetails;
  assert.ok(details.bankName && typeof details.bankName === 'string', 'Tên ngân hàng phải có');
  assert.ok(details.accountNumber && typeof details.accountNumber === 'string', 'Số tài khoản phải có');
  assert.ok(details.accountHolder && typeof details.accountHolder === 'string', 'Chủ tài khoản phải có');
  assert.strictEqual(details.amount, bankOrder.totalAmount, 'Số tiền chuyển khoản phải đúng số tiền đơn hàng');
  assert.ok(
    details.memo.includes(bankOrder.orderNumber),
    `Nội dung chuyển khoản "${details.memo}" phải chứa orderNumber "${bankOrder.orderNumber}"`,
  );
  assert.ok(
    details.qrImageUrl.includes('vietqr.io') && details.qrImageUrl.includes(String(bankOrder.totalAmount)),
    `URL VietQR "${details.qrImageUrl}" phải hợp lệ và chứa số tiền đơn`,
  );

  console.log(`✓ Đơn hàng Chuyển khoản: ${bankOrder.orderNumber} (Tổng: ${bankOrder.totalAmount}đ)`);
  console.log(`✓ Ngân hàng: ${details.bankName} - Số TK: ${details.accountNumber} - Chủ TK: ${details.accountHolder}`);
  console.log(`✓ Nội dung chuyển khoản (Memo): "${details.memo}"`);
  console.log(`✓ VietQR URL: ${details.qrImageUrl}`);
  console.log('✓ [TEST 2 ĐẠT]: Thông tin tài khoản, VietQR, nội dung chứa mã đơn hiển thị chuẩn xác.\n');

  const paymentIdToConfirm = bankOrder.payment.id;
  const orderIdToConfirm = bankOrder.orderId;

  // ----------------------------------------------------------------------------------
  // [TEST 5]: CUSTOMER gọi API xác nhận thanh toán -> Nhận 403 Forbidden
  // ----------------------------------------------------------------------------------
  console.log('--- [TEST 5]: CUSTOMER cố tình gọi API xác nhận thanh toán -> 403 Forbidden ---');
  const customerConfirmRes = await fetch(
    `${GATEWAY_URL}/payments/${paymentIdToConfirm}/confirm`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        amount: bankOrder.totalAmount,
        note: 'Khách hàng tự bấm xác nhận gian lận',
      }),
    },
  );

  assert.strictEqual(
    customerConfirmRes.status,
    403,
    'Khách hàng không có quyền và phải nhận lỗi 403 Forbidden',
  );
  const forbiddenBody = await customerConfirmRes.json();
  console.log(`✓ Response Status: 403 Forbidden. Message: "${forbiddenBody.message || forbiddenBody.error}"`);
  console.log('✓ [TEST 5 ĐẠT]: Role Guard bảo vệ nghiêm ngặt, chặn đứng customer giả mạo xác nhận.\n');

  // ----------------------------------------------------------------------------------
  // [KIỂM TRA BỔ SUNG]: Admin xác nhận số tiền lệch -> 400 Bad Request
  // ----------------------------------------------------------------------------------
  console.log('--- [KIỂM TRA BỔ SUNG]: Admin xác nhận sai số tiền -> 400 Bad Request ---');
  const mismatchRes = await fetch(
    `${GATEWAY_URL}/payments/${paymentIdToConfirm}/confirm`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        amount: bankOrder.totalAmount - 10000, // Lệch 10k
        note: 'Chuyển thiếu 10k',
      }),
    },
  );
  assert.strictEqual(mismatchRes.status, 400, 'Xác nhận sai số tiền phải bị từ chối với 400');
  const mismatchBody = await mismatchRes.json();
  console.log(`✓ Response Status: 400 Bad Request. Lỗi: "${mismatchBody.message}"`);
  console.log('✓ [BỔ SUNG ĐẠT]: Hệ thống từ chối xác nhận số tiền lệch.\n');

  // ----------------------------------------------------------------------------------
  // [TEST 3]: Admin xác nhận thanh toán -> Payment PAID, Order paymentStatus = PAID, Order CONFIRMED
  // ----------------------------------------------------------------------------------
  console.log('--- [TEST 3]: Admin xác nhận thanh toán hợp lệ ---');
  const adminConfirmRes = await fetch(
    `${GATEWAY_URL}/payments/${paymentIdToConfirm}/confirm`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        amount: bankOrder.totalAmount,
        transactionReference: `FT260919${Date.now()}`,
        note: 'Đối soát sao kê ngân hàng MBBank khớp 100%',
      }),
    },
  );

  const adminConfirmJson = await adminConfirmRes.json();
  assert.strictEqual(
    adminConfirmRes.status,
    201,
    'Admin xác nhận thanh toán thành công (201)',
  );
  assert.strictEqual(adminConfirmJson.success, true);
  assert.strictEqual(
    adminConfirmJson.payment.status,
    'PAID',
    'Payment status phải chuyển sang PAID',
  );
  assert.ok(adminConfirmJson.payment.paidAt, 'paidAt phải được ghi nhận');
  assert.strictEqual(
    adminConfirmJson.order.paymentStatus,
    'PAID',
    'Order paymentStatus phải chuyển sang PAID',
  );
  assert.strictEqual(
    adminConfirmJson.order.status,
    'CONFIRMED',
    'Order status phải tự động chuyển từ PENDING sang CONFIRMED',
  );

  // Kiểm tra Payment Audit Logs
  const paymentQueryRes = await fetch(
    `${GATEWAY_URL}/payments/${paymentIdToConfirm}`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    },
  );
  const paymentQueryJson = await paymentQueryRes.json();
  const paymentData = paymentQueryJson.data || paymentQueryJson;
  assert.ok(paymentData.auditLogs && paymentData.auditLogs.length >= 1, 'Phải có ít nhất 1 Audit Log');
  const audit = paymentData.auditLogs[0];
  assert.strictEqual(audit.action, 'CONFIRM_PAID');
  assert.strictEqual(audit.actorRole, 'ADMIN');
  console.log(`✓ Payment đã chuyển sang: ${paymentData.status}, PaidAt: ${paymentData.paidAt}`);
  console.log(`✓ Đơn hàng đã chuyển sang: paymentStatus=${adminConfirmJson.order.paymentStatus}, status=${adminConfirmJson.order.status}`);
  console.log(`✓ Audit Log ghi nhận: Actor=${audit.actorId} (${audit.actorRole}), Action=${audit.action}, Note="${audit.note}"`);
  console.log('✓ [TEST 3 ĐẠT]: Admin xác nhận thanh toán thành công, ghi log audit đầy đủ.\n');

  // ----------------------------------------------------------------------------------
  // [TEST 4]: Thử xác nhận lại lần 2 -> Idempotent, không duplicate side effect
  // ----------------------------------------------------------------------------------
  console.log('--- [TEST 4]: Thử xác nhận lại lần 2 (Idempotency) ---');
  const initialAuditCount = paymentData.auditLogs.length;

  const secondConfirmRes = await fetch(
    `${GATEWAY_URL}/payments/${paymentIdToConfirm}/confirm`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        amount: bankOrder.totalAmount,
        note: 'Bấm xác nhận lần 2',
      }),
    },
  );

  const secondConfirmJson = await secondConfirmRes.json();
  assert.strictEqual(secondConfirmRes.status, 201);
  assert.strictEqual(secondConfirmJson.success, true);
  assert.ok(
    secondConfirmJson.message.includes('Idempotent') ||
      secondConfirmJson.payment.status === 'PAID',
    'Phản hồi thông báo idempotent thành công',
  );

  // Kiểm tra số lượng audit logs không bị tăng lên (không duplicate side effects)
  const verifyAuditRes = await fetch(
    `${GATEWAY_URL}/payments/${paymentIdToConfirm}`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    },
  );
  const verifyAuditJson = await verifyAuditRes.json();
  const verifyPaymentData = verifyAuditJson.data || verifyAuditJson;
  assert.strictEqual(
    verifyPaymentData.auditLogs.length,
    initialAuditCount,
    'Số lượng audit log không được tăng lên khi gọi lại thao tác idempotent',
  );
  console.log(`✓ Gọi lại lần 2 trả về: "${secondConfirmJson.message}"`);
  console.log(`✓ Số bản ghi Audit Log trước: ${initialAuditCount}, sau: ${verifyPaymentData.auditLogs.length} (Không duplicate side-effect)`);
  console.log('✓ [TEST 4 ĐẠT]: Tính toán Idempotent hoạt động hoàn hảo.\n');

  console.log('======================================================================');
  console.log('TẤT CẢ 5 BÀI KIỂM ĐỊNH E2E PAYMENT ĐÃ HOÀN TẤT VÀ VƯỢT QUA 100%!');
  console.log('======================================================================');
}

runPaymentE2ETests().catch((err) => {
  console.error('\n❌ KIỂM ĐỊNH THẤT BẠI:', err);
  process.exit(1);
});
