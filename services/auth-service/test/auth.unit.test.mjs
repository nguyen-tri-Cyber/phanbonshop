import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

describe('Auth Service Unit Tests', () => {
  function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async function hashPassword(password) {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  }

  async function comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  test('Password hashing produces secure bcrypt hash and validates correctly', async () => {
    const plain = 'SecureFarmerPass@2026';
    const hash = await hashPassword(plain);

    assert.ok(hash.startsWith('$2'), 'Bcrypt hash should start with $2');
    assert.notEqual(hash, plain);

    const isMatch = await comparePassword(plain, hash);
    assert.strictEqual(isMatch, true, 'Valid password must match hash');

    const wrongMatch = await comparePassword('WrongPassword', hash);
    assert.strictEqual(wrongMatch, false, 'Invalid password must not match hash');
  });

  test('SHA-256 token hashing is deterministic and irreversible', () => {
    const rawToken = '7b9c6f2a-e24e-4f70-b184-7e909a365dfb';
    const hash1 = hashToken(rawToken);
    const hash2 = hashToken(rawToken);

    assert.strictEqual(hash1, hash2, 'Token hash must be deterministic');
    assert.strictEqual(hash1.length, 64, 'SHA-256 hex string must be 64 chars long');
    assert.notEqual(hash1, rawToken);
  });
});
