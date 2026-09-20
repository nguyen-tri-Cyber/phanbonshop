import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaService } from '../dist/prisma/prisma.service.js';
import { InventoryService } from '../dist/inventory/inventory.service.js';

// ============================================================================
// SAFETY GUARD: Section 9 - Test Database Safety
// ============================================================================
const TEST_DB_URL =
  process.env.INVENTORY_DATABASE_URL ||
  'mysql://phanbon_user:phanbon_secret@127.0.0.1:3307/test_inventory_db';

if (!TEST_DB_URL.includes('test_inventory_db')) {
  throw new Error(
    `[FATAL] Safety Check Failed: Integration tests MUST run on test_inventory_db. Found: ${TEST_DB_URL}`,
  );
}

process.env.NODE_ENV = 'test';
process.env.INVENTORY_DATABASE_URL = TEST_DB_URL;

describe('Phase 1.1 — Inventory Concurrency Integration Tests (Real MySQL)', () => {
  let prisma;
  let inventoryService;

  before(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    inventoryService = new InventoryService(prisma);
  });

  after(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  beforeEach(async () => {
    // Clean up test database between tests
    await prisma.inventoryMovement.deleteMany({});
    await prisma.inventoryReservation.deleteMany({});
    await prisma.inventory.deleteMany({});
  });

  it('10 concurrent reservation requests against stockQuantity=1 -> Exactly 1 success, 9 rejected', async () => {
    const productId = `prod-${crypto.randomUUID()}`;
    const variantId = `var-${crypto.randomUUID()}`;

    // 1. Khởi tạo kho: stockQuantity = 1, reservedQuantity = 0
    await prisma.inventory.create({
      data: {
        productId,
        variantId,
        stockQuantity: 1,
        reservedQuantity: 0,
        reorderLevel: 2,
      },
    });

    // 2. Chuẩn bị 10 yêu cầu tạm giữ đồng thời (mỗi yêu cầu đặt 1 đơn vị, reservationId riêng biệt)
    const CONCURRENCY = 10;
    const requests = Array.from({ length: CONCURRENCY }, (_, i) => {
      const reservationId = `res-concurrent-${i}-${crypto.randomUUID().slice(0, 8)}`;
      return inventoryService.reserve(
        {
          reservationId,
          productId,
          variantId,
          quantity: 1,
          referenceType: 'ORDER',
          referenceId: `order-ref-${i}`,
          ttlMinutes: 15,
        },
        `req-trace-${i}`,
      );
    });

    // 3. Bắn đồng thời 10 requests qua Promise.allSettled
    const results = await Promise.allSettled(requests);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // 4. Kỳ vọng: Đúng 1 thành công, 9 thất bại
    assert.strictEqual(
      fulfilled.length,
      1,
      `Kỳ vọng đúng 1 request thành công, thực tế: ${fulfilled.length}`,
    );
    assert.strictEqual(
      rejected.length,
      CONCURRENCY - 1,
      `Kỳ vọng đúng ${CONCURRENCY - 1} requests bị từ chối, thực tế: ${rejected.length}`,
    );

    // Xác minh lỗi trả về từ 9 request bị từ chối là ConflictException (hết hàng khả dụng)
    for (const rej of rejected) {
      assert.match(
        rej.reason.message || String(rej.reason),
        /Không đủ tồn kho khả dụng/i,
        'Request bị từ chối phải báo lỗi không đủ tồn kho khả dụng',
      );
    }

    // 5. QUAN TRỌNG NHẤT: Đọc trạng thái từ MySQL thật để đối chiếu tính toàn vẹn dữ liệu
    const finalInventory = await prisma.inventory.findUnique({
      where: { variantId },
    });

    assert.ok(finalInventory, 'Bản ghi inventory phải tồn tại');
    assert.strictEqual(
      finalInventory.stockQuantity,
      1,
      'stockQuantity không được thay đổi khi chỉ tạm giữ (phải là 1)',
    );
    assert.strictEqual(
      finalInventory.reservedQuantity,
      1,
      'reservedQuantity cuối cùng phải chính xác là 1 (không bị double-increment)',
    );
    const available = finalInventory.stockQuantity - finalInventory.reservedQuantity;
    assert.strictEqual(available, 0, 'Tồn kho khả dụng phải chính xác là 0');

    // 6. Kiểm tra bảng inventory_reservations trong MySQL
    const reservations = await prisma.inventoryReservation.findMany({
      where: { variantId },
    });
    assert.strictEqual(
      reservations.length,
      1,
      'Chỉ được tồn tại duy nhất 1 bản ghi reservation trong DB',
    );
    assert.strictEqual(reservations[0].status, 'ACTIVE');
    assert.strictEqual(reservations[0].quantity, 1);

    // 7. Kiểm tra sổ cái inventory_movements
    const movements = await prisma.inventoryMovement.findMany({
      where: { variantId },
    });
    assert.strictEqual(
      movements.length,
      1,
      'Chỉ được ghi nhận duy nhất 1 movement RESERVATION trong DB',
    );
  });

  it('Idempotent reservation retry: Gửi lại cùng reservationId không bị trừ tồn kho lần hai', async () => {
    const productId = `prod-${crypto.randomUUID()}`;
    const variantId = `var-${crypto.randomUUID()}`;
    const reservationId = `res-idempotent-${crypto.randomUUID()}`;

    await prisma.inventory.create({
      data: {
        productId,
        variantId,
        stockQuantity: 5,
        reservedQuantity: 0,
      },
    });

    // Lần 1: Reserve thành công
    const firstRes = await inventoryService.reserve({
      reservationId,
      productId,
      variantId,
      quantity: 2,
      referenceType: 'ORDER',
      referenceId: 'order-101',
    });
    assert.strictEqual(firstRes.success, true);
    assert.strictEqual(firstRes.inventory.reservedQuantity, 2);

    // Lần 2: Retry cùng reservationId và cùng variant
    const secondRes = await inventoryService.reserve({
      reservationId,
      productId,
      variantId,
      quantity: 2,
      referenceType: 'ORDER',
      referenceId: 'order-101',
    });
    assert.strictEqual(secondRes.success, true);
    assert.match(secondRes.message, /Idempotent/i);

    // Kiểm tra DB: reservedQuantity vẫn là 2, không thành 4
    const inv = await prisma.inventory.findUnique({ where: { variantId } });
    assert.strictEqual(inv.reservedQuantity, 2);
  });

  it('Release reservation: Giải phóng tồn kho chính xác và an toàn idempotent', async () => {
    const productId = `prod-${crypto.randomUUID()}`;
    const variantId = `var-${crypto.randomUUID()}`;
    const reservationId = `res-release-${crypto.randomUUID()}`;

    await prisma.inventory.create({
      data: {
        productId,
        variantId,
        stockQuantity: 10,
        reservedQuantity: 3,
      },
    });

    await prisma.inventoryReservation.create({
      data: {
        reservationId,
        variantId,
        quantity: 3,
        referenceType: 'ORDER',
        referenceId: 'order-202',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    // Lần 1: Release
    const rel1 = await inventoryService.release({ reservationId });
    assert.strictEqual(rel1.success, true);

    const invAfter1 = await prisma.inventory.findUnique({ where: { variantId } });
    assert.strictEqual(invAfter1.reservedQuantity, 0);

    // Lần 2: Release lại cùng reservationId (Idempotent test)
    const rel2 = await inventoryService.release({ reservationId });
    assert.strictEqual(rel2.success, true);
    assert.match(rel2.message, /Idempotent/i);

    // Không bị âm kho
    const invAfter2 = await prisma.inventory.findUnique({ where: { variantId } });
    assert.strictEqual(invAfter2.reservedQuantity, 0);
  });
});
