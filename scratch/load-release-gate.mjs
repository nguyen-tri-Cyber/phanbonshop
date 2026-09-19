import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:8080/api/v1';
const VUS = Number(process.env.LOAD_VUS || 8);

const failures = [];

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status >= 500) {
    failures.push({ path, status: res.status, data });
  }
  return { res, data };
}

async function findVariant(requiredQuantity) {
  const products = await request('/products?limit=20');
  assert.ok(products.res.ok, `browse product failed: ${JSON.stringify(products.data)}`);

  for (const product of products.data.data.items) {
    const detail = await request(`/products/${product.slug || product.id}`);
    assert.ok(detail.res.ok, `product detail failed for ${product.id}`);

    const inventory = await request(`/inventory/products/${product.id}`);
    const rows = Array.isArray(inventory.data.data) ? inventory.data.data : [];
    for (const variant of product.variants || []) {
      const row = rows.find((item) => item.variantId === variant.id);
      if (row && Number(row.availableQuantity) >= requiredQuantity) {
        return {
          product,
          variant,
          before: {
            stockQuantity: Number(row.stockQuantity),
            reservedQuantity: Number(row.reservedQuantity),
            availableQuantity: Number(row.availableQuantity),
          },
        };
      }
    }
  }

  throw new Error(`No variant has availableQuantity >= ${requiredQuantity}`);
}

async function userFlow(index, product, variant) {
  const suffix = `${Date.now()}-${index}-${Math.floor(Math.random() * 1_000_000)}`;
  const email = `load_${suffix}@phanbonshop.vn`;
  const password = 'Customer@123456';

  const register = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      fullName: `Load User ${index}`,
      phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
    }),
  });
  assert.ok(register.res.ok, `register failed for user ${index}: ${JSON.stringify(register.data)}`);

  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert.ok(login.res.ok, `login failed for user ${index}: ${JSON.stringify(login.data)}`);
  const token = login.data.data?.accessToken || login.data.accessToken;

  const cart = await request('/cart/items', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      productId: product.id,
      variantId: variant.id,
      productName: product.name,
      productSlug: product.slug,
      sku: variant.sku,
      packageSize: variant.packageSize,
      price: Number(variant.price),
      quantity: 1,
    }),
  });
  assert.ok(cart.res.ok, `cart failed for user ${index}: ${JSON.stringify(cart.data)}`);

  const checkout = await request('/checkout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': `load-${suffix}`,
    },
    body: JSON.stringify({
      shippingAddress: {
        recipientName: `Load User ${index}`,
        phone: '0912345678',
        provinceCode: '79',
        provinceName: 'Thành phố Hồ Chí Minh',
        districtCode: '760',
        districtName: 'Quận 1',
        wardCode: '26734',
        wardName: 'Phường Bến Nghé',
        addressLine: '123 Load Test',
      },
      paymentMethod: 'COD',
    }),
  });
  assert.ok(checkout.res.ok, `checkout failed for user ${index}: ${JSON.stringify(checkout.data)}`);
  return checkout.data.data || checkout.data;
}

async function run() {
  console.log('================================================================');
  console.log(`STARTING LOAD RELEASE GATE: ${VUS} concurrent browse/login/cart/checkout flows`);
  console.log('================================================================\n');

  const { product, variant, before } = await findVariant(VUS);
  console.log(`Using product=${product.id}, variant=${variant.id}, available=${before.availableQuantity}`);

  const orders = await Promise.all(
    Array.from({ length: VUS }, (_, index) => userFlow(index + 1, product, variant)),
  );

  assert.deepStrictEqual(failures, [], `Unexpected 5xx responses: ${JSON.stringify(failures)}`);

  const orderNumbers = orders.map((order) => order.orderNumber);
  assert.strictEqual(new Set(orderNumbers).size, VUS, 'No duplicate orderNumber under load');

  const afterInventory = await request(`/inventory/products/${product.id}`);
  assert.ok(afterInventory.res.ok, `inventory after load failed: ${JSON.stringify(afterInventory.data)}`);
  const after = afterInventory.data.data.find((item) => item.variantId === variant.id);
  assert.ok(after, 'variant inventory must exist after load');

  const stock = Number(after.stockQuantity);
  const reserved = Number(after.reservedQuantity);
  const available = Number(after.availableQuantity);
  assert.ok(reserved <= stock, `reservedQuantity must never exceed stockQuantity: ${reserved}/${stock}`);
  assert.ok(available >= 0, `availableQuantity must never be negative: ${available}`);
  assert.strictEqual(
    reserved,
    before.reservedQuantity + VUS,
    'reservedQuantity should increase exactly by successful checkout count',
  );

  console.log('Orders:', orderNumbers.join(', '));
  console.log(`Inventory after load: stock=${stock}, reserved=${reserved}, available=${available}`);
  console.log('\nLOAD RELEASE GATE PASSED: no 5xx, no oversell, no duplicate orders, no data corruption.');
}

run().catch((err) => {
  console.error('\nLOAD RELEASE GATE FAILED:', err);
  process.exit(1);
});
