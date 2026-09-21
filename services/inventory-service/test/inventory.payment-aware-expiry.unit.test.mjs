import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InventoryService } from '../dist/inventory/inventory.service.js';

process.env.INTERNAL_SERVICE_SECRET ||= 'runtime-unit-test-internal-secret';
process.env.ORDER_SERVICE_URL ||= 'http://127.0.0.1:3003';

test('expiry cleanup commits instead of releasing a paid order reservation', async () => {
  const expired = {
    id: 'reservation-row-1',
    reservationId: 'reservation-1-variant-1',
    variantId: 'variant-1',
    quantity: 2,
    referenceType: 'ORDER',
    referenceId: 'DH-PAID-1',
    expiresAt: new Date(Date.now() - 60_000),
  };
  let releaseTransactions = 0;
  let commits = 0;
  const prisma = {
    inventoryReservation: { findMany: async () => [expired] },
    $transaction: async () => {
      releaseTransactions += 1;
    },
  };
  const service = new InventoryService(prisma);
  service.getOrderInventoryDisposition = async () => 'COMMIT';
  service.commit = async ({ reservationId, referenceId }) => {
    assert.equal(reservationId, expired.reservationId);
    assert.equal(referenceId, expired.referenceId);
    commits += 1;
    return { success: true };
  };

  const result = await service.releaseExpiredReservations();

  assert.equal(commits, 1);
  assert.equal(releaseTransactions, 0);
  assert.equal(result.releasedCount, 0);
});

test('expiry cleanup fails closed when order disposition is unavailable', async () => {
  const expired = {
    id: 'reservation-row-2',
    reservationId: 'reservation-2-variant-1',
    variantId: 'variant-1',
    quantity: 2,
    referenceType: 'ORDER',
    referenceId: 'DH-UNKNOWN-1',
    expiresAt: new Date(Date.now() - 60_000),
  };
  let releaseTransactions = 0;
  const prisma = {
    inventoryReservation: { findMany: async () => [expired] },
    $transaction: async () => {
      releaseTransactions += 1;
    },
  };
  const service = new InventoryService(prisma);
  service.getOrderInventoryDisposition = async () => 'HOLD';

  const result = await service.releaseExpiredReservations();

  assert.equal(releaseTransactions, 0);
  assert.equal(result.releasedCount, 0);
});

test('commit rejects impossible stock/reservation state instead of clamping to zero', async () => {
  const reservation = {
    id: 'reservation-row-3',
    reservationId: 'reservation-3',
    variantId: 'variant-1',
    quantity: 5,
    status: 'ACTIVE',
    referenceType: 'ORDER',
    referenceId: 'DH-INVARIANT-1',
  };
  const tx = {
    inventoryReservation: {
      findUnique: async () => reservation,
      update: async () => reservation,
    },
    $queryRaw: async () => [{
      id: 'inventory-1',
      productId: 'product-1',
      variantId: 'variant-1',
      stockQuantity: 10,
      reservedQuantity: 2,
      reorderLevel: 0,
    }],
    inventory: { update: async () => ({}) },
    inventoryMovement: { create: async () => ({}) },
  };
  const service = new InventoryService({ $transaction: async (callback) => callback(tx) });

  await assert.rejects(
    service.commit({ reservationId: reservation.reservationId, referenceId: reservation.referenceId }),
    /RESERVATION_INVARIANT_VIOLATION|bất biến tồn kho/i,
  );
});
