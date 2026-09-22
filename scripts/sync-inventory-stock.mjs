import { PrismaClient as InventoryPrisma } from '../services/inventory-service/generated/client/index.js';
import { PrismaClient as ProductPrisma } from '../services/product-service/generated/client/index.js';

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

async function main() {
  console.log('=== ĐỒNG BỘ TỒN KHO CHO TOÀN BỘ SẢN PHẨM CATALOG ===');

  const products = await productPrisma.product.findMany({
    where: {
      status: { in: ['ACTIVE', 'DRAFT'] },
      NOT: { name: { startsWith: 'LOCAL COD' } },
    },
    include: { variants: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Tìm thấy ${products.length} sản phẩm thực tế trong product_db.`);

  let createdCount = 0;
  let updatedCount = 0;

  for (let pIdx = 0; pIdx < products.length; pIdx++) {
    const product = products[pIdx];

    for (let vIdx = 0; vIdx < product.variants.length; vIdx++) {
      const variant = product.variants[vIdx];
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
            type: 'PURCHASE',
            quantity: stockQuantity,
            stockBefore: 0,
            stockAfter: stockQuantity,
            reservedBefore: 0,
            reservedAfter: 0,
            reason: `Đồng bộ tồn kho catalog: ${variant.sku}`,
            referenceType: 'SYNC_CATALOG',
            referenceId: `SYNC-${variant.sku}`,
            performedBy: 'SYSTEM_SYNC',
          },
        });

        createdCount++;
      } else if (existing.stockQuantity <= 0) {
        await inventoryPrisma.inventory.update({
          where: { id: existing.id },
          data: {
            stockQuantity,
            reservedQuantity: 0,
          },
        });
        updatedCount++;
      }
    }
  }

  console.log(`Đã đồng bộ xong tồn kho: Thêm mới ${createdCount}, Cập nhật ${updatedCount}.`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await inventoryPrisma.$disconnect();
    await productPrisma.$disconnect();
  });
