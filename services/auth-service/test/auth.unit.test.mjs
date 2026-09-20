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

  describe('Health & Readiness Probes (TASK-P5-01 / AUD-P2-001)', () => {
    test('checkHealth returns alive status without touching database', async () => {
      const { HealthController } = await import('../dist/health/health.controller.js');
      // Dummy prisma that would throw if touched
      const throwingPrisma = {
        $queryRaw: () => {
          throw new Error('Should not touch DB in liveness probe!');
        },
      };

      const controller = new HealthController(throwingPrisma);
      const res = controller.checkHealth();

      assert.strictEqual(res.status, 'alive');
      assert.strictEqual(res.service, 'auth-service');
      assert.ok(typeof res.uptime === 'number');
      assert.ok(res.timestamp);
    });

    test('checkReady returns ready status when database is healthy', async () => {
      const { HealthController } = await import('../dist/health/health.controller.js');
      const mockPrisma = {
        $queryRaw: async () => [{ 1: 1 }],
      };

      const controller = new HealthController(mockPrisma);
      const res = await controller.checkReady();

      assert.strictEqual(res.status, 'ready');
      assert.strictEqual(res.service, 'auth-service');
      assert.strictEqual(res.checks.database, 'up');
    });

    test('checkReady throws ServiceUnavailableException (503) when database is down', async () => {
      const { HealthController } = await import('../dist/health/health.controller.js');
      const mockPrisma = {
        $queryRaw: async () => {
          throw new Error('ECONNREFUSED 127.0.0.1:3306');
        },
      };

      const controller = new HealthController(mockPrisma);
      await assert.rejects(
        async () => {
          await controller.checkReady();
        },
        (err) => {
          assert.strictEqual(err.status, 503);
          const response = err.getResponse();
          assert.strictEqual(response.status, 'not_ready');
          assert.strictEqual(response.checks.database, 'down');
          return true;
        },
      );
    });
  });
});
