import jwt from 'jsonwebtoken';

async function run() {
  const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'phanbonshop_jwt_access_secret_super_secure_key_2026';
  const token = jwt.sign(
    {
      sub: '33944fdc-8b69-4907-bc78-5d7fe2c88d10',
      email: 'admin@local.test',
      role: 'SUPER_ADMIN'
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  console.log('Generated SUPER_ADMIN Token for testing');

    console.log('\n--- 1. Testing Admin Low Stock (/api/v1/inventory/low-stock) ---');
    const lowStockRes = await fetch('http://localhost:8080/api/v1/inventory/low-stock?threshold=10', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const lowStockData = await lowStockRes.json();
    console.log('Low stock status:', lowStockRes.status);
    console.log('Low stock data:', JSON.stringify(lowStockData, null, 2));

    console.log('\n--- 2. Testing Admin Stock Adjustment (/api/v1/inventory/adjust) ---');
    // Test adjustment without reason (should fail validation)
    const badAdjustRes = await fetch('http://localhost:8080/api/v1/inventory/adjust', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        productId: 'test-product-npk',
        variantId: 'test-variant-npk-101',
        quantityChange: 5
        // reason omitted
      })
    });
    const badAdjustData = await badAdjustRes.json();
    console.log('Missing reason adjustment status:', badAdjustRes.status, 'Error message:', badAdjustData.error?.message);

    // Test adjustment with valid reason
    const goodAdjustRes = await fetch('http://localhost:8080/api/v1/inventory/adjust', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        productId: 'test-product-npk',
        variantId: 'test-variant-npk-101',
        quantityChange: 5,
        reason: 'Kiểm kê định kỳ tháng 9 - nhập bổ sung từ kho dự trữ',
        referenceType: 'AUDIT',
        referenceId: 'AUDIT-20260918-01'
      })
    });
    const goodAdjustData = await goodAdjustRes.json();
    console.log('Valid adjustment status:', goodAdjustRes.status);
    console.log('Adjusted inventory:', JSON.stringify(goodAdjustData, null, 2));

    console.log('\n--- 3. Testing Movements Ledger (/api/v1/inventory/movements) ---');
    const movementsRes = await fetch('http://localhost:8080/api/v1/inventory/movements?variantId=test-variant-npk-101', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const movementsData = await movementsRes.json();
    console.log('Movements status:', movementsRes.status);
    console.log('Movements raw response:', JSON.stringify(movementsData, null, 2));
}

run();
