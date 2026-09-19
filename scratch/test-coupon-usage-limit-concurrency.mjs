import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:8080/api/v1';

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function registerCustomer(label) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const email = `coupon_limit_${label}_${suffix}@phanbonshop.vn`;
  const password = 'Customer@123456';
  const phone = `09${Math.floor(10000000 + Math.random() * 90000000)}`;

  const reg = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      fullName: `Coupon Limit ${label}`,
      phone,
    }),
  });
  assert.ok(reg.res.ok, `register ${label} phải thành công: ${JSON.stringify(reg.data)}`);

  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert.ok(login.res.ok, `login ${label} phải thành công: ${JSON.stringify(login.data)}`);
  return login.data.data?.accessToken || login.data.accessToken;
}

async function findStockedVariant(requiredQuantity) {
  const products = await request('/products?limit=20');
  assert.ok(products.res.ok, `lấy product list phải thành công: ${JSON.stringify(products.data)}`);

  for (const product of products.data.data.items) {
    const inventory = await request(`/inventory/products/${product.id}`);
    const rows = Array.isArray(inventory.data.data) ? inventory.data.data : [];
    for (const variant of product.variants || []) {
      const row = rows.find((item) => item.variantId === variant.id);
      if (row && Number(row.availableQuantity) >= requiredQuantity) {
        return { product, variant };
      }
    }
  }

  throw new Error(`Không tìm thấy variant còn availableQuantity >= ${requiredQuantity}`);
}

function checkoutPayload(product, variant, couponCode) {
  return {
    items: [{ productId: product.id, variantId: variant.id, quantity: 1 }],
    shippingAddress: {
      recipientName: 'Coupon Concurrency',
      phone: '0912345678',
      provinceCode: '79',
      provinceName: 'Thành phố Hồ Chí Minh',
      districtCode: '760',
      districtName: 'Quận 1',
      wardCode: '26734',
      wardName: 'Phường Bến Nghé',
      addressLine: '123 Test Coupon Limit',
    },
    paymentMethod: 'COD',
    couponCode,
  };
}

async function run() {
  console.log('================================================================');
  console.log('STARTING TEST: COUPON usageLimit=1 CONCURRENT CHECKOUT');
  console.log('================================================================\n');

  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@phanbonshop.vn', password: 'Admin@123456' }),
  });
  assert.ok(adminLogin.res.ok, `admin login phải thành công: ${JSON.stringify(adminLogin.data)}`);
  const adminToken = adminLogin.data.data?.accessToken || adminLogin.data.accessToken;

  const [customerAToken, customerBToken] = await Promise.all([
    registerCustomer('a'),
    registerCustomer('b'),
  ]);

  const code = `LIMIT1${Date.now().toString().slice(-8)}`;
  const coupon = await request('/coupons', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      code,
      type: 'FIXED_AMOUNT',
      value: 10000,
      minOrderAmount: 0,
      usageLimit: 1,
      usagePerCustomer: 1,
      startDate: new Date(Date.now() - 60_000).toISOString(),
      endDate: new Date(Date.now() + 86_400_000).toISOString(),
      enabled: true,
    }),
  });
  assert.ok(coupon.res.ok, `admin tạo coupon phải thành công: ${JSON.stringify(coupon.data)}`);
  const couponId = coupon.data.data?.id || coupon.data.id;
  console.log(`Created coupon ${code} (${couponId}) with usageLimit=1`);

  const { product, variant } = await findStockedVariant(2);
  console.log(`Using variant ${variant.id} (${variant.packageSize}) with coupon ${code}`);

  const [resultA, resultB] = await Promise.all([
    request('/checkout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerAToken}`,
        'Idempotency-Key': `coupon-limit-a-${Date.now()}`,
      },
      body: JSON.stringify(checkoutPayload(product, variant, code)),
    }),
    request('/checkout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerBToken}`,
        'Idempotency-Key': `coupon-limit-b-${Date.now()}`,
      },
      body: JSON.stringify(checkoutPayload(product, variant, code)),
    }),
  ]);

  const successes = [resultA, resultB].filter((item) => item.res.ok);
  const failures = [resultA, resultB].filter((item) => !item.res.ok);
  console.log('Concurrent results:', [resultA, resultB].map((item) => ({
    status: item.res.status,
    message: item.data.error?.message || item.data.message || 'OK',
  })));

  assert.strictEqual(successes.length, 1, 'usageLimit=1 chỉ cho phép đúng 1 checkout thành công');
  assert.strictEqual(failures.length, 1, 'checkout còn lại phải bị reject');

  const detail = await request(`/coupons/admin/${couponId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.ok(detail.res.ok, `lấy coupon detail phải thành công: ${JSON.stringify(detail.data)}`);
  const usedCount = Number((detail.data.data || detail.data).usedCount);
  assert.strictEqual(usedCount, 1, 'usedCount không được vượt usageLimit=1');

  console.log('\nALL COUPON usageLimit CONCURRENCY TESTS PASSED!');
}

run().catch((err) => {
  console.error('\nCOUPON usageLimit CONCURRENCY TEST FAILED:', err);
  process.exit(1);
});
