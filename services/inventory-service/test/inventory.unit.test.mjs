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
});
