import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Order Service Unit Tests', () => {
  // 1. Subtotal calculation
  function calculateSubtotal(items) {
    return items.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
  }

  // 2. Coupon discount calculation
  function calculateDiscount(coupon, subtotal) {
    if (!coupon || !coupon.enabled) return 0;
    if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) return 0;

    let discount = 0;
    if (coupon.type === 'PERCENTAGE') {
      discount = (subtotal * coupon.value) / 100;
      if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
        discount = coupon.maxDiscountAmount;
      }
    } else if (coupon.type === 'FIXED_AMOUNT') {
      discount = Math.min(subtotal, coupon.value);
    }
    return Math.round(discount);
  }

  // 3. Order state transitions validation
  const ALLOWED_TRANSITIONS = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['PACKING', 'CANCELLED'],
    PACKING: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['DELIVERED', 'RETURN_REQUESTED'],
    DELIVERED: ['COMPLETED', 'RETURN_REQUESTED'],
    COMPLETED: [],
    CANCELLED: [],
  };

  function canTransition(from, to) {
    const allowed = ALLOWED_TRANSITIONS[from] || [];
    return allowed.includes(to);
  }

  test('Subtotal correctly sums line items price x quantity', () => {
    const items = [
      { unitPrice: 150000, quantity: 2 }, // 300,000
      { unitPrice: 500000, quantity: 1 }, // 500,000
      { unitPrice: 80000, quantity: 3 },  // 240,000
    ];
    assert.strictEqual(calculateSubtotal(items), 1040000);
  });

  test('Percentage coupon calculates correct discount capped by maximumDiscount', () => {
    const coupon = {
      type: 'PERCENTAGE',
      value: 10, // 10%
      minOrderAmount: 200000,
      maxDiscountAmount: 50000,
      enabled: true,
    };

    // Subtotal 400,000 -> 10% is 40,000 (< 50,000 max) -> 40,000
    assert.strictEqual(calculateDiscount(coupon, 400000), 40000);

    // Subtotal 1,000,000 -> 10% is 100,000 (> 50,000 max) -> capped at 50,000
    assert.strictEqual(calculateDiscount(coupon, 1000000), 50000);

    // Subtotal 150,000 -> under minOrderAmount 200,000 -> 0
    assert.strictEqual(calculateDiscount(coupon, 150000), 0);
  });

  test('Fixed amount coupon caps at subtotal to prevent negative totals', () => {
    const coupon = {
      type: 'FIXED_AMOUNT',
      value: 50000,
      minOrderAmount: 0,
      enabled: true,
    };
    assert.strictEqual(calculateDiscount(coupon, 100000), 50000);
    assert.strictEqual(calculateDiscount(coupon, 30000), 30000);
  });

  test('Order state machine enforces sequential valid transitions', () => {
    assert.strictEqual(canTransition('PENDING', 'CONFIRMED'), true);
    assert.strictEqual(canTransition('PENDING', 'CANCELLED'), true);
    assert.strictEqual(canTransition('PENDING', 'COMPLETED'), false); // Cannot jump straight to COMPLETED

    assert.strictEqual(canTransition('CONFIRMED', 'PROCESSING'), true);
    assert.strictEqual(canTransition('PROCESSING', 'PACKING'), true);
    assert.strictEqual(canTransition('PACKING', 'SHIPPED'), true);
    assert.strictEqual(canTransition('SHIPPED', 'DELIVERED'), true);
    assert.strictEqual(canTransition('DELIVERED', 'COMPLETED'), true);

    assert.strictEqual(canTransition('COMPLETED', 'CANCELLED'), false); // Completed order cannot be cancelled
  });
});
