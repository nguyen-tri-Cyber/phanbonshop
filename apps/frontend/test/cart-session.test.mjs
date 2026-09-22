import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { loadSource } from './load-source.mjs';

const item = { productId: 'p1', variantId: 'v1', productName: 'NPK', quantity: 2, price: 100000 };

test('guest cart survives session restoration and a page remount', async () => {
  const storage = new Map([['phanbon_cart', JSON.stringify([item])]]);
  const oldStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k),
  };
  let auth = { user: null, isLoading: true };
  const { CartProvider, useCart } = loadSource('src/contexts/cart-context.tsx', {
    './auth-context': { useAuth: () => auth },
    '../lib/api-client': {
      apiClient: () => {
        throw new Error('Guest must not call API');
      },
    },
  });
  let cart;
  function Consumer() {
    cart = useCart();
    return null;
  }
  const tree = () => React.createElement(CartProvider, null, React.createElement(Consumer));
  let renderer;
  try {
    await act(async () => {
      renderer = create(tree());
    });
    auth = { user: null, isLoading: false };
    await act(async () => {
      renderer.update(tree());
    });
    assert.deepEqual(cart.items, [item]);
    assert.deepEqual(JSON.parse(storage.get('phanbon_cart')), [item]);
    await act(async () => {
      renderer.unmount();
    });
    await act(async () => {
      renderer = create(tree());
    });
    assert.deepEqual(cart.items, [item]);
  } finally {
    await act(async () => renderer?.unmount());
    globalThis.localStorage = oldStorage;
  }
});

test('failed guest merge keeps the local cart available for retry', async () => {
  const storage = new Map([['phanbon_cart', JSON.stringify([item])]]);
  const oldStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k),
  };
  const { CartProvider, useCart } = loadSource('src/contexts/cart-context.tsx', {
    './auth-context': { useAuth: () => ({ user: { id: 'customer' }, isLoading: false }) },
    '../lib/api-client': {
      apiClient: async (endpoint) =>
        endpoint === '/cart/merge'
          ? { success: false, error: { message: 'Unavailable' } }
          : { success: true, data: { items: [] } },
    },
  });
  let cart;
  function Consumer() {
    cart = useCart();
    return null;
  }
  let renderer;
  try {
    await act(async () => {
      renderer = create(React.createElement(CartProvider, null, React.createElement(Consumer)));
    });
    assert.deepEqual(JSON.parse(storage.get('phanbon_cart')), [item]);
    assert.match(cart.error, /Unavailable/);
  } finally {
    await act(async () => renderer?.unmount());
    globalThis.localStorage = oldStorage;
  }
});

test('successful registration immediately establishes the customer session', async () => {
  const oldFetch = globalThis.fetch;
  const user = { id: 'new-customer', role: 'CUSTOMER', email: 'local@example.test' };
  let token;
  globalThis.fetch = async (url) => ({
    ok: true,
    json: async () =>
      url.endsWith('/register')
        ? { success: true, data: { user, accessToken: 'test-access' } }
        : { success: false },
  });
  const { AuthProvider, useAuth } = loadSource('src/contexts/auth-context.tsx', {
    '../lib/api-client': {
      setAccessToken: (value) => {
        token = value;
      },
    },
  });
  let auth;
  function Consumer() {
    auth = useAuth();
    return null;
  }
  let renderer;
  try {
    await act(async () => {
      renderer = create(React.createElement(AuthProvider, null, React.createElement(Consumer)));
    });
    await act(async () => {
      await auth.register({
        email: user.email,
        fullName: 'Local',
        phone: '0912345678',
        password: 'TestPass123',
      });
    });
    assert.deepEqual(auth.user, user);
    assert.equal(token, 'test-access');
  } finally {
    await act(async () => renderer?.unmount());
    globalThis.fetch = oldFetch;
  }
});

test('successful Google login immediately establishes the customer session', async () => {
  const oldFetch = globalThis.fetch;
  const user = { id: 'google-customer', role: 'CUSTOMER', email: 'farmer@gmail.com' };
  let token;
  globalThis.fetch = async (url, options) => ({
    ok: true,
    json: async () => {
      assert.equal(url, '/api/auth/google');
      assert.equal(options.headers['X-Google-Identity'], '1');
      assert.deepEqual(JSON.parse(options.body), { credential: 'google-id-token' });
      return { success: true, data: { user, accessToken: 'google-access' } };
    },
  });
  const { AuthProvider, useAuth } = loadSource('src/contexts/auth-context.tsx', {
    '../lib/api-client': {
      setAccessToken: (value) => {
        token = value;
      },
    },
  });
  let auth;
  function Consumer() {
    auth = useAuth();
    return null;
  }
  let renderer;
  try {
    await act(async () => {
      renderer = create(React.createElement(AuthProvider, null, React.createElement(Consumer)));
    });
    await act(async () => {
      const result = await auth.loginWithGoogle('google-id-token');
      assert.equal(result.success, true);
    });
    assert.deepEqual(auth.user, user);
    assert.equal(token, 'google-access');
  } finally {
    await act(async () => renderer?.unmount());
    globalThis.fetch = oldFetch;
  }
});
