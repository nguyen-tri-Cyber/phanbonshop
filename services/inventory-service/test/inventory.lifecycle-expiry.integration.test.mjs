import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { PrismaService } from '../dist/prisma/prisma.service.js';
import { InventoryService } from '../dist/inventory/inventory.service.js';
import { ReservationStatus, MovementType } from '../generated/client/index.js';

// ============================================================================
// SAFETY GUARD: Section 9 - Test Database Safety
// ============================================================================
const TEST_INVENTORY_DB_URL =
  process.env.INVENTORY_DATABASE_URL ||
  'mysql://phanbon_user:phanbon_secret@127.0.0.1:3307/test_inventory_db';

if (!TEST_INVENTORY_DB_URL.includes('test_inventory_db')) {
  throw new Error('[FATAL] Safety Check Failed: Integration tests MUST run on test_inventory_db.');
}

process.env.NODE_ENV = 'test';
process.env.INVENTORY_DATABASE_URL = TEST_INVENTORY_DB_URL;

describe('Phase 2.1 & 2.4 — Inventory Lifecycle & Expiry Worker Integration Tests (Real MySQL)', () => {
  let prisma;
  let inventoryService;

  before(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    inventoryService = new InventoryService(prisma);
  });

  after(async () => {
    inventoryService.onModuleDestroy();
    if (prisma) await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.inventoryMovement.deleteMany({});
    await prisma.inventoryReservation.deleteMany({});
    await prisma.inventory.deleteMany({});
  });

  it('2.4.1: Expiry Worker correctly cleans up expired reservation and restores available stock', async () => {
    const productId = `prod-exp-${crypto.randomUUID().slice(0, 8)}`;
    const variantId = `var-exp-${crypto.randomUUID().slice(0, 8)}`;
    const reservationId = `res-exp-${crypto.randomUUID().slice(0, 8)}`;

    // 1. Khởi tạo tồn kho: stock = 10, reserved = 0
    await prisma.inventory.create({
      data: {
        productId,
        variantId,
        stockQuantity: 10,
        reservedQuantity: 3, // Giả lập đã giữ 3 cái
        reorderLevel: 2,
      },
    });

    // 2. Tạo một lượt reservation đã hết hạn (expiresAt trong quá khứ 2 phút trước)
    const expiredAt = new Date(Date.now() - 120_000);
    await prisma.inventoryReservation.create({
      data: {
        reservationId,
        variantId,
        quantity: 3,
        referenceType: 'ORDER',
        referenceId: 'ORD-EXPIRED-01',
        status: ReservationStatus.ACTIVE,
        expiresAt: expiredAt,
      },
    });

    // 3. Kích hoạt Expiry Worker
    const result = await inventoryService.releaseExpiredReservations();
    assert.equal(result.releasedCount, 1, 'Worker should release exactly 1 expired reservation');

    // 4. Kiểm tra trạng thái trong DB:
    // - Reservation phải chuyển sang EXPIRED
    const updatedRes = await prisma.inventoryReservation.findUnique({
      where: { reservationId },
    });
    assert.equal(updatedRes.status, ReservationStatus.EXPIRED, 'Status must transition to EXPIRED');

    // - Tồn kho: reservedQuantity phải giảm từ 3 về 0, stockQuantity giữ nguyên 10
    const updatedInv = await prisma.inventory.findUnique({
      where: { variantId },
    });
    assert.equal(updatedInv.stockQuantity, 10, 'Stock quantity must remain 10');
    assert.equal(updatedInv.reservedQuantity, 0, 'Reserved quantity must be restored to 0');
    assert.equal(updatedInv.stockQuantity - updatedInv.reservedQuantity, 10, 'Available stock is back to 10');

    // - Sổ cái movement phải ghi nhận RELEASE_RESERVATION
    const movement = await prisma.inventoryMovement.findFirst({
      where: { variantId, type: MovementType.RELEASE_RESERVATION },
    });
    assert.ok(movement, 'Movement log must record RELEASE_RESERVATION');
    assert.equal(movement.quantity, 3);
  });

  it('2.4.2: Expiry Worker is Multi-Replica Safe (Concurrent workers do not double decrement)', async () => {
    const productId = `prod-multi-${crypto.randomUUID().slice(0, 8)}`;
    const variantId = `var-multi-${crypto.randomUUID().slice(0, 8)}`;

    await prisma.inventory.create({
      data: {
        productId,
        variantId,
        stockQuantity: 10,
        reservedQuantity: 4, // 2 reservations x 2 units
        reorderLevel: 2,
      },
    });

    // Tạo 2 reservation hết hạn
    const expiredAt = new Date(Date.now() - 60_000);
    await prisma.inventoryReservation.createMany({
      data: [
        {
          reservationId: `res-multi-1-${crypto.randomUUID().slice(0, 8)}`,
          variantId,
          quantity: 2,
          referenceType: 'ORDER',
          referenceId: 'ORD-MULTI-01',
          status: ReservationStatus.ACTIVE,
          expiresAt: expiredAt,
        },
        {
          reservationId: `res-multi-2-${crypto.randomUUID().slice(0, 8)}`,
          variantId,
          quantity: 2,
          referenceType: 'ORDER',
          referenceId: 'ORD-MULTI-02',
          status: ReservationStatus.ACTIVE,
          expiresAt: expiredAt,
        },
      ],
    });

    // Giả lập 3 worker replicas chạy song song tại cùng một thời điểm
    const [res1, res2, res3] = await Promise.all([
      inventoryService.releaseExpiredReservations(),
      inventoryService.releaseExpiredReservations(),
      inventoryService.releaseExpiredReservations(),
    ]);

    const totalReleased = res1.releasedCount + res2.releasedCount + res3.releasedCount;
    assert.equal(totalReleased, 2, 'Exactly 2 reservations should be claimed across all workers');

    // Kiểm tra DB không bao giờ bị trừ âm
    const inv = await prisma.inventory.findUnique({
      where: { variantId },
    });
    assert.equal(inv.reservedQuantity, 0, 'Reserved quantity must be exactly 0, never negative');
    assert.equal(inv.stockQuantity, 10, 'Stock quantity must remain 10');
  });

  it('2.5.1: Rollback of COMMITTED reservation safely restocks physical inventory and is idempotent', async () => {
    const productId = `prod-roll-${crypto.randomUUID().slice(0, 8)}`;
    const variantId = `var-roll-${crypto.randomUUID().slice(0, 8)}`;
    const reservationId = `res-roll-${crypto.randomUUID().slice(0, 8)}`;

    // 1. Tạo tồn kho ban đầu: 10 cái
    await prisma.inventory.create({
      data: {
        productId,
        variantId,
        stockQuantity: 10,
        reservedQuantity: 0,
        reorderLevel: 2,
      },
    });

    // 2. Tạm giữ 4 cái (Reserve) -> stock=10, reserved=4
    const reserveRes = await inventoryService.reserve({
      reservationId,
      productId,
      variantId,
      quantity: 4,
      referenceType: 'ORDER',
      referenceId: 'ORD-ROLL-01',
    });
    assert.equal(reserveRes.inventory.reservedQuantity, 4);
    assert.equal(reserveRes.inventory.availableQuantity, 6);

    // 3. Xác nhận đơn hàng (Commit) -> stock=6, reserved=0
    const commitRes = await inventoryService.commit({
      reservationId,
      referenceId: 'ORD-ROLL-01',
    });
    assert.equal(commitRes.inventory.stockQuantity, 6, 'Stock decremented to 6 upon commit');
    assert.equal(commitRes.inventory.reservedQuantity, 0, 'Reserved quantity decremented to 0');
    assert.equal(commitRes.inventory.availableQuantity, 6, 'Available quantity remains 6');
    assert.equal(commitRes.reservation.status, ReservationStatus.COMMITTED);

    // 4. Hủy đơn sau khi đã xác nhận -> Gọi rollbackOrRelease để hoàn tồn kho vật lý
    const rollbackRes = await inventoryService.rollbackOrRelease({
      reservationId,
      reason: 'Khách hàng yêu cầu hủy đơn đã xác nhận',
    });

    assert.equal(rollbackRes.success, true);
    assert.equal(rollbackRes.inventory.stockQuantity, 10, 'Physical stock restored back to 10');
    assert.equal(rollbackRes.inventory.reservedQuantity, 0);
    assert.equal(rollbackRes.inventory.availableQuantity, 10, 'Available stock restored to 10');

    // Kiểm tra DB
    const resInDb = await prisma.inventoryReservation.findUnique({
      where: { reservationId },
    });
    assert.equal(resInDb.status, ReservationStatus.RELEASED, 'Reservation status updated to RELEASED');

    // Kiểm tra movement log có type CANCELLED_ORDER
    const rollbackMovement = await prisma.inventoryMovement.findFirst({
      where: { variantId, type: MovementType.CANCELLED_ORDER },
    });
    assert.ok(rollbackMovement, 'Must log CANCELLED_ORDER movement');
    assert.equal(rollbackMovement.quantity, 4);
    assert.equal(rollbackMovement.stockBefore, 6);
    assert.equal(rollbackMovement.stockAfter, 10);

    // 5. Idempotent: Gọi rollback lần thứ hai không tăng tồn kho lặp lại
    const secondRollback = await inventoryService.rollbackOrRelease({
      reservationId,
      reason: 'Gọi lặp lại lần 2',
    });
    assert.equal(secondRollback.success, true);
    assert.equal(secondRollback.inventory.stockQuantity, 10, 'Stock must stay 10, not become 14');
  });
});
