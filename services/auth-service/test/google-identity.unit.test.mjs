import assert from 'node:assert/strict';
import { test } from 'node:test';

test('AuthModule creates the Google verifier without unresolved Nest injection tokens', async () => {
  const { AuthModule } = await import('../dist/auth/auth.module.js');
  const { GoogleIdentityVerifier } = await import('../dist/google/google-identity.verifier.js');
  const providers = Reflect.getMetadata('providers', AuthModule);
  const registration = providers.find(
    (provider) => provider && provider.provide === GoogleIdentityVerifier,
  );

  assert.equal(typeof registration?.useFactory, 'function');
  assert.ok(registration.useFactory() instanceof GoogleIdentityVerifier);
});

test('Google verifier accepts only a verified Gmail issued for this application', async () => {
  const { GoogleIdentityVerifier } = await import('../dist/google/google-identity.verifier.js');
  const googleClient = {
    verifyIdToken: async ({ idToken, audience }) => {
      assert.equal(idToken, 'valid-google-token');
      assert.equal(audience, 'client.apps.googleusercontent.com');
      return {
        getPayload: () => ({
          sub: 'google-subject-1',
          email: 'Farmer@gmail.com',
          email_verified: true,
          name: 'Nguyễn Văn Nông',
          picture: 'https://lh3.googleusercontent.com/avatar',
        }),
      };
    },
  };
  const verifier = new GoogleIdentityVerifier('client.apps.googleusercontent.com', googleClient);

  const identity = await verifier.verify('valid-google-token');

  assert.deepEqual(identity, {
    subject: 'google-subject-1',
    email: 'farmer@gmail.com',
    fullName: 'Nguyễn Văn Nông',
    avatarUrl: 'https://lh3.googleusercontent.com/avatar',
  });
});

test('Google verifier rejects unverified or non-Gmail identities', async () => {
  const { GoogleIdentityVerifier } = await import('../dist/google/google-identity.verifier.js');
  const payloads = [
    { sub: 'subject-1', email: 'farmer@gmail.com', email_verified: false },
    { sub: 'subject-2', email: 'farmer@example.com', email_verified: true },
  ];

  for (const payload of payloads) {
    const verifier = new GoogleIdentityVerifier('client.apps.googleusercontent.com', {
      verifyIdToken: async () => ({ getPayload: () => payload }),
    });
    await assert.rejects(() => verifier.verify('token'), /Gmail|xác minh/i);
  }
});

test('repeated Google login reuses the user bound to the same Google subject', async () => {
  const { AuthService } = await import('../dist/auth/auth.service.js');
  const now = new Date('2026-09-22T00:00:00.000Z');
  const user = {
    id: 'user-1',
    email: 'farmer@gmail.com',
    passwordHash: null,
    fullName: 'Nguyễn Văn Nông',
    phone: null,
    role: 'CUSTOMER',
    status: 'ACTIVE',
    emailVerifiedAt: now,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  };
  let boundIdentity = null;
  let createdUsers = 0;
  const prisma = {
    externalIdentity: {
      findUnique: async () => (boundIdentity ? { ...boundIdentity, user } : null),
      create: async ({ data }) => {
        boundIdentity = { id: 'identity-1', ...data };
        return boundIdentity;
      },
    },
    user: {
      findUnique: async () => null,
      create: async () => {
        createdUsers += 1;
        return user;
      },
      update: async () => user,
    },
    refreshTokenSession: { create: async () => ({}) },
    $transaction: async (callback) => callback(prisma),
  };
  const jwt = {
    sign: (_payload, options) =>
      options.secret === 'test-access-secret-for-google-unit-test'
        ? 'access-token'
        : 'refresh-token',
  };
  const verifier = {
    verify: async () => ({
      subject: 'google-subject-1',
      email: user.email,
      fullName: user.fullName,
      avatarUrl: null,
    }),
  };
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-google-unit-test';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-google-unit-test';
  const service = new AuthService(prisma, jwt, {}, verifier);

  const first = await service.loginWithGoogle({ credential: 'credential' });
  const second = await service.loginWithGoogle({ credential: 'credential' });

  assert.equal(first.user.id, 'user-1');
  assert.equal(second.user.id, 'user-1');
  assert.equal(createdUsers, 1);
});
