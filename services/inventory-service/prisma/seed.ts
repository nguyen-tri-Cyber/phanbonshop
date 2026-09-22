import { PrismaClient as InventoryPrisma, MovementType } from '../generated/client/index.js';
import { PrismaClient as ProductPrisma } from '../../product-service/generated/client/index.js';

const inventoryPrisma = new InventoryPrisma({
  datasources: {
    db: {
      url:
        process.env.INVENTORY_DATABASE_URL ||
        'mysql://phanbon_user:phanbon_secret@localhost:3307/inventory_db',
    },
  },
});

const productPrisma = new ProductPrisma({
  datasources: {
    db: {
      url:
        process.env.PRODUCT_DATABASE_URL ||
        'mysql://phanbon_user:phanbon_secret@localhost:3307/product_db',
    },
  },
});

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[SECURITY FATAL] Refusing to seed database in PRODUCTION environment! Database seeding is strictly for development and testing.',
    );
  }

  console.log('--- [SEED] Bắt đầu đồng bộ tồn kho mẫu cho inventory_db ---');

  // 1. Lấy danh sách toàn bộ sản phẩm và biến thể hợp lệ từ product_db
  const products = await productPrisma.product.findMany({
    where: {
      status: { in: ['ACTIVE', 'DRAFT'] },
      NOT: {
        name: { startsWith: 'LOCAL COD' },
      },
    },
    include: {
      variants: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Tìm thấy ${products.length} sản phẩm thực tế trong product_db.`);

  // Thu thập danh sách variantId hợp lệ
  const validVariantIds = new Set<string>();
  for (const p of products) {
    for (const v of p.variants) {
      validVariantIds.add(v.id);
    }
  }

  // 2. Dọn dẹp các bản ghi tồn kho mồ côi (orphaned) không còn tồn tại trong product_db
  const currentInventories = await inventoryPrisma.inventory.findMany();
  let orphanedCount = 0;
  for (const inv of currentInventories) {
    if (!validVariantIds.has(inv.variantId)) {
      await inventoryPrisma.inventoryMovement.deleteMany({
        where: { variantId: inv.variantId },
      });
      await inventoryPrisma.inventoryReservation.deleteMany({
        where: { variantId: inv.variantId },
      });
      await inventoryPrisma.inventory.delete({
        where: { id: inv.id },
      });
      orphanedCount++;
    }
  }
  if (orphanedCount > 0) {
    console.log(`Đã dọn dẹp ${orphanedCount} bản ghi tồn kho cũ/mồ côi trong inventory_db.`);
  }

  // 3. Khởi tạo / cập nhật tồn kho cho từng biến thể thực tế
  let createdCount = 0;
  let updatedCount = 0;

  for (let pIdx = 0; pIdx < products.length; pIdx++) {
    const product = products[pIdx];

    for (let vIdx = 0; vIdx < product.variants.length; vIdx++) {
      const variant = product.variants[vIdx];

      // Tính toán lượng tồn kho thực tế dồi dào cho bà con nông dân đặt mua (từ 50 đến 120 bao/can)
      const stockQuantity = 50 + ((pIdx * 11 + vIdx * 17) % 70);

      const existing = await inventoryPrisma.inventory.findUnique({
        where: { variantId: variant.id },
      });

      if (!existing) {
        await inventoryPrisma.inventory.create({
          data: {
            productId: product.id,
            variantId: variant.id,
            stockQuantity,
            reservedQuantity: 0,
            reorderLevel: 10,
          },
        });

        await inventoryPrisma.inventoryMovement.create({
          data: {
            productId: product.id,
            variantId: variant.id,
            type: MovementType.PURCHASE,
            quantity: stockQuantity,
            stockBefore: 0,
            stockAfter: stockQuantity,
            reservedBefore: 0,
            reservedAfter: 0,
            reason: `Nhập kho vụ mùa 2026 cho biến thể ${variant.sku} (${variant.packageSize})`,
            referenceType: 'INITIAL_STOCK_SEED',
            referenceId: `SEED-${variant.sku}`,
            performedBy: 'SYSTEM_SEED',
          },
        });

        createdCount++;
      } else if (existing.stockQuantity <= 0) {
        // Nếu trước đó đang 0 (hết hàng), bù tồn kho
        await inventoryPrisma.inventory.update({
          where: { id: existing.id },
          data: {
            stockQuantity,
            reservedQuantity: 0,
          },
        });

        await inventoryPrisma.inventoryMovement.create({
          data: {
            productId: product.id,
            variantId: variant.id,
            type: MovementType.ADJUSTMENT,
            quantity: stockQuantity,
            stockBefore: existing.stockQuantity,
            stockAfter: stockQuantity,
            reservedBefore: existing.reservedQuantity,
            reservedAfter: 0,
            reason: `Tái bổ sung tồn kho vụ mùa 2026 cho biến thể ${variant.sku}`,
            referenceType: 'RESTOCK_SEED',
            referenceId: `RESTOCK-${variant.sku}`,
            performedBy: 'SYSTEM_SEED',
          },
        });

        updatedCount++;
      }
    }
  }

  console.log(
    `--- [SEED] Hoàn tất đồng bộ tồn kho: Tạo mới ${createdCount}, Cập nhật ${updatedCount} biến thể. ---`,
  );
}

main()
  .catch((e) => {
    console.error('[SEED ERROR]', e);
    process.exit(1);
  })
  .finally(async () => {
    await inventoryPrisma.$disconnect();
    await productPrisma.$disconnect();
  });
