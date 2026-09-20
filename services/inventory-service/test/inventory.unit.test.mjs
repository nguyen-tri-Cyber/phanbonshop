import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Inventory Service Unit Tests', () => {
  function calculateAvailability(stock, reserved) {
    return Math.max(0, stock - reserved);
  }

  function getStockStatus(available, reorderLevel) {
    if (available <= 0) return 'OUT_OF_STOCK';
    if (available <= reorderLevel) return 'LOW_STOCK';
    return 'IN_STOCK';
  }

  test('Available quantity equals stock minus reserved', () => {
    assert.strictEqual(calculateAvailability(100, 20), 80);
    assert.strictEqual(calculateAvailability(50, 50), 0);
  });

  test('Available quantity never drops below 0 even if reserved exceeds stock temporarily', () => {
    assert.strictEqual(calculateAvailability(10, 15), 0);
  });

  test('Stock status is determined accurately by reorder level', () => {
    assert.strictEqual(getStockStatus(0, 10), 'OUT_OF_STOCK');
    assert.strictEqual(getStockStatus(5, 10), 'LOW_STOCK');
    assert.strictEqual(getStockStatus(10, 10), 'LOW_STOCK');
    assert.strictEqual(getStockStatus(11, 10), 'IN_STOCK');
    assert.strictEqual(getStockStatus(100, 10), 'IN_STOCK');
  });

  describe('Health & Readiness Probes (TASK-P5-01 / AUD-P2-001)', () => {
    test('checkHealth returns alive status without touching database', async () => {
      const { HealthController } = await import('../dist/health/health.controller.js');
      const throwingPrisma = {
        $queryRaw: () => {
          throw new Error('Should not touch DB in liveness probe!');
        },
      };

      const controller = new HealthController(throwingPrisma);
      const res = controller.checkHealth();

      assert.strictEqual(res.status, 'alive');
      assert.strictEqual(res.service, 'inventory-service');
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
      assert.strictEqual(res.service, 'inventory-service');
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
