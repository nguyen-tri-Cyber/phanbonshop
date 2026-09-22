import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { loadSource } from './load-source.mjs';

for (const [provinceCode, subtotal, expectedFee] of [
  ['79', 1200000, 60000],
  ['92', 500000, 50000],
  ['01', 500000, 80000],
  ['79', 2000000, 0],
]) {
  test(`checkout quotes ${expectedFee} shipping for province ${provinceCode}, subtotal ${subtotal}`, async () => {
    const address = {
      id: 'address',
      isDefault: true,
      provinceCode,
      recipientName: 'Local Test',
      phone: '0912345678',
    };
    const user = { id: 'customer' };
    const { default: Checkout } = loadSource('src/app/(customer)/checkout/page.tsx', {
      'next/navigation': { useRouter: () => ({ push() {} }) },
      'next/link': {
        default: ({ children }) => React.createElement('a', null, children),
        __esModule: true,
      },
      '../../../contexts/auth-context': { useAuth: () => ({ user, isLoading: false }) },
      '../../../contexts/cart-context': {
        useCart: () => ({
          items: [{ variantId: 'v1', productId: 'p1', quantity: 1, price: subtotal }],
          totalPrice: subtotal,
          clearCart: async () => {},
        }),
      },
      '../../../lib/api-client': { apiClient: async () => ({ success: true, data: [address] }) },
    });
    let renderer;
    try {
      await act(async () => {
        renderer = create(React.createElement(Checkout));
      });
      const text = JSON.stringify(renderer.toJSON());
      const formatted = (subtotal + expectedFee).toLocaleString('vi-VN');
      assert.ok(text.includes(formatted), `Expected quoted total ${formatted}`);
    } finally {
      await act(async () => renderer?.unmount());
    }
  });
}
