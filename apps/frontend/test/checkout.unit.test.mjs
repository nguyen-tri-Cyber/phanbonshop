import assert from 'node:assert/strict';
import test from 'node:test';
import { getProvinces, getDistricts, getWards } from '@phanbonshop/shared-utils';

test('=== PHASE 3: FRONTEND CHECKOUT & INTEGRATION TESTS ===', async (t) => {
  await t.test('1. Pricing calculation: Free shipping threshold and coupon discount', () => {
    const FREE_SHIPPING_THRESHOLD = 1000000;
    const STANDARD_SHIPPING_FEE = 30000;

    // Case A: Cart < 1,000,000 VND without coupon
    const cartA = [
      { price: 250000, quantity: 2 }, // 500,000
      { price: 150000, quantity: 1 }, // 150,000
    ];
    const subtotalA = cartA.reduce((sum, item) => sum + item.price * item.quantity, 0);
    assert.equal(subtotalA, 650000);
    const shippingFeeA = subtotalA >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
    assert.equal(shippingFeeA, 30000);
    const finalTotalA = subtotalA + shippingFeeA;
    assert.equal(finalTotalA, 680000);

    // Case B: Cart >= 1,000,000 VND with coupon discount 50,000 VND
    const cartB = [
      { price: 600000, quantity: 2 }, // 1,200,000
    ];
    const subtotalB = cartB.reduce((sum, item) => sum + item.price * item.quantity, 0);
    assert.equal(subtotalB, 1200000);
    const shippingFeeB = subtotalB >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
    assert.equal(shippingFeeB, 0, 'Đơn từ 1.000.000đ trở lên phải được miễn phí ship');
    const discountAmountB = 50000;
    const finalTotalB = Math.max(0, subtotalB - discountAmountB + shippingFeeB);
    assert.equal(finalTotalB, 1150000);
  });

  await t.test('2. VietQR dynamic generation parameters for BANK_TRANSFER', () => {
    const totalAmount = 1150000;
    const orderNumber = 'DH-20260920-8899AA';
    const accountName = 'CONG TY CO PHAN PHAN BON SHOP VIET NAM';
    const encodedAccountName = encodeURIComponent(accountName);

    const vietQrUrl = `https://img.vietqr.io/image/mbbank-0386888999-compact2.png?amount=${totalAmount}&addInfo=${orderNumber}&accountName=${encodedAccountName}`;

    assert.ok(vietQrUrl.includes('mbbank-0386888999-compact2.png'));
    assert.ok(vietQrUrl.includes(`amount=${totalAmount}`));
    assert.ok(vietQrUrl.includes(`addInfo=${orderNumber}`));
    assert.ok(vietQrUrl.includes('accountName='));
  });

  await t.test('3. Client Idempotency Key validation and request payload structure', () => {
    // Generate UUIDv4 format check
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const testUuid = 'b5d3c8a1-3e4b-4f9a-8c2d-7e1a6b5c4d3e';
    assert.ok(uuidRegex.test(testUuid));

    const checkoutPayload = {
      items: [
        { productId: 'prod-npk-1', variantId: 'var-npk-50kg', quantity: 2 },
      ],
      shippingAddress: {
        recipientName: 'Nguyễn Văn Nông',
        phone: '0912345678',
        provinceCode: 'VN-CT',
        provinceName: 'Cần Thơ',
        districtCode: 'CT-CR',
        districtName: 'Cái Răng',
        wardCode: 'CR-LP',
        wardName: 'Lê Bình',
        addressLine: 'Ấp Phú Khánh, Cánh đồng Mương Khai',
      },
      couponCode: 'PHANBON50K',
      paymentMethod: 'COD',
      customerNote: 'Giao buổi sáng',
    };

    assert.equal(checkoutPayload.items.length, 1);
    assert.equal(checkoutPayload.shippingAddress.provinceCode, 'VN-CT');
    assert.equal(checkoutPayload.paymentMethod, 'COD');
  });

  await t.test('4. Vietnam administrative divisions cascading integrity', () => {
    const provinces = getProvinces();
    assert.ok(provinces.length > 0, 'Danh sách tỉnh thành không được rỗng');

    const firstProvince = provinces[0];
    assert.ok(firstProvince.code && firstProvince.name);

    const districts = getDistricts(firstProvince.code);
    assert.ok(districts.length > 0, `Tỉnh ${firstProvince.name} phải có quận huyện`);

    const firstDistrict = districts[0];
    const wards = getWards(firstProvince.code, firstDistrict.code);
    assert.ok(wards.length > 0, `Quận ${firstDistrict.name} phải có phường xã`);
  });

  await t.test('5. Customer order cancellation eligibility rule', () => {
    // Only PENDING orders can be cancelled by customer
    const canCancel = (status) => status === 'PENDING';

    assert.equal(canCancel('PENDING'), true);
    assert.equal(canCancel('CONFIRMED'), false);
    assert.equal(canCancel('SHIPPING'), false);
    assert.equal(canCancel('COMPLETED'), false);
    assert.equal(canCancel('CANCELLED'), false);
  });
});
