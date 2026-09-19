import * as Minio from 'minio';
import { PrismaClient as ProductPrisma } from '../services/product-service/generated/client/index.js';
import { PrismaClient as InventoryPrisma } from '../services/inventory-service/generated/client/index.js';

const productPrisma = new ProductPrisma({
  datasources: {
    db: {
      url: process.env.PRODUCT_DATABASE_URL || 'mysql://phanbon_user:phanbon_secret@localhost:3307/product_db',
    },
  },
});

const inventoryPrisma = new InventoryPrisma({
  datasources: {
    db: {
      url: process.env.INVENTORY_DATABASE_URL || 'mysql://phanbon_user:phanbon_secret@localhost:3307/inventory_db',
    },
  },
});

const minioClient = new Minio.Client({
  endPoint: 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: process.env.MINIO_ROOT_USER || 'admin',
  secretKey: process.env.MINIO_ROOT_PASSWORD || 'admin123456',
});

const BUCKET = 'product-images';

function generateSvgBag(name, brandName, spec, color1, color2) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="2" dy="4" stdDeviation="4" flood-opacity="0.2"/>
    </filter>
  </defs>
  
  <rect width="400" height="400" fill="#f8fafc"/>
  
  <!-- Bao phân bón -->
  <g filter="url(#shadow)">
    <path d="M 100 80 L 300 80 L 320 340 L 80 340 Z" fill="url(#grad)" rx="12"/>
    <!-- Nếp gấp bao trên -->
    <path d="M 90 70 L 310 70 L 300 85 L 100 85 Z" fill="#ffffff" opacity="0.3"/>
    <line x1="90" y1="75" x2="310" y2="75" stroke="#ffffff" stroke-width="2" stroke-dasharray="4,4"/>
  </g>

  <!-- Logo mầm cây -->
  <circle cx="200" cy="150" r="36" fill="#ffffff" opacity="0.95" filter="url(#shadow)"/>
  <path d="M 200 130 C 185 145, 185 165, 200 170 C 215 165, 215 145, 200 130 Z" fill="${color1}"/>
  <path d="M 200 150 C 215 140, 225 150, 220 162" fill="none" stroke="${color1}" stroke-width="3" stroke-linecap="round"/>

  <!-- Nhãn hiệu -->
  <rect x="110" y="200" width="180" height="70" rx="8" fill="#ffffff" opacity="0.95" filter="url(#shadow)"/>
  <text x="200" y="222" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#64748b" text-anchor="middle" letter-spacing="1">
    ${brandName.toUpperCase()}
  </text>
  <text x="200" y="246" font-family="Arial, sans-serif" font-size="15" font-weight="900" fill="#0f172a" text-anchor="middle">
    ${name.length > 20 ? name.substring(0, 18) + '...' : name}
  </text>
  <text x="200" y="262" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="${color1}" text-anchor="middle">
    CHẤT LƯỢNG MÙA VÀNG
  </text>

  <!-- Quy cách -->
  <rect x="160" y="285" width="80" height="24" rx="12" fill="#0f172a" opacity="0.85"/>
  <text x="200" y="301" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">
    ${spec || '50 KG'}
  </text>
</svg>`;
}

async function main() {
  console.log('=== KHỞI TẠO DỮ LIỆU THẬT: MINIO IMAGES & INVENTORY ===');

  // 1. Kiểm tra bucket MinIO
  const bucketExists = await minioClient.bucketExists(BUCKET);
  if (!bucketExists) {
    await minioClient.makeBucket(BUCKET);
    console.log(`Đã tạo bucket [${BUCKET}] trên MinIO`);
  }

  // Set public read policy on bucket
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetBucketLocation', 's3:ListBucket'],
        Resource: [`arn:aws:s3:::${BUCKET}`],
      },
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${BUCKET}/*`],
      },
    ],
  };
  await minioClient.setBucketPolicy(BUCKET, JSON.stringify(policy));
  console.log(`Đã cấu hình quyền tải công khai cho bucket [${BUCKET}]`);

  // 2. Lấy toàn bộ 16 sản phẩm từ product_db
  const products = await productPrisma.product.findMany({
    include: {
      brand: true,
      variants: true,
      images: true,
    },
  });

  console.log(`Tìm thấy ${products.length} sản phẩm trong product_db`);

  const colors = [
    { c1: '#16a34a', c2: '#15803d' }, // Xanh lá NPK
    { c1: '#d97706', c2: '#92400e' }, // Nâu vàng Hữu cơ
    { c1: '#0284c7', c2: '#0369a1' }, // Xanh dương Đạm
    { c1: '#7c3aed', c2: '#5b21b6' }, // Tím Vi lượng
  ];

  let imageCreatedCount = 0;
  let inventoryCreatedCount = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const brandName = p.brand?.name || 'Phân Bón Việt Nam';
    const color = colors[i % colors.length];

    // Upload image nếu sản phẩm chưa có ảnh
    if (!p.images || p.images.length === 0) {
      const primaryVariant = p.variants[0];
      const spec = primaryVariant?.packageSize || '50kg';

      const svgContent = generateSvgBag(p.name, brandName, spec, color.c1, color.c2);
      const objectKey = `products/${p.id}/main.svg`;

      await minioClient.putObject(
        BUCKET,
        objectKey,
        Buffer.from(svgContent, 'utf-8'),
        svgContent.length,
        { 'Content-Type': 'image/svg+xml' },
      );

      const url = `http://localhost:9000/${BUCKET}/${objectKey}`;

      await productPrisma.productImage.create({
        data: {
          productId: p.id,
          objectKey,
          url,
          altText: `Hình ảnh bao bì phân bón ${p.name}`,
          sortOrder: 0,
          isPrimary: true,
        },
      });

      // Tạo thêm 1 ảnh chi tiết mặt sau bao bì (detail)
      const detailSvg = generateSvgBag(`${p.name} (Mặt sau)`, brandName, 'Tem Kỹ Thuật', color.c2, color.c1);
      const detailKey = `products/${p.id}/detail.svg`;
      await minioClient.putObject(
        BUCKET,
        detailKey,
        Buffer.from(detailSvg, 'utf-8'),
        detailSvg.length,
        { 'Content-Type': 'image/svg+xml' },
      );

      await productPrisma.productImage.create({
        data: {
          productId: p.id,
          objectKey: detailKey,
          url: `http://localhost:9000/${BUCKET}/${detailKey}`,
          altText: `Tem hướng dẫn kỹ thuật ${p.name}`,
          sortOrder: 1,
          isPrimary: false,
        },
      });

      imageCreatedCount += 2;
    }

    // 3. Khởi tạo tồn kho trong inventory_db cho từng variant
    for (let vIdx = 0; vIdx < p.variants.length; vIdx++) {
      const v = p.variants[vIdx];
      // Kiểm tra xem đã có tồn kho chưa
      const existing = await inventoryPrisma.inventory.findUnique({
        where: { variantId: v.id },
      });

      if (!existing) {
        // Cho 1 biến thể duy nhất hết hàng (stock = 0) để kiểm thử out-of-stock
        const isOutOfStockTest = (i === 3 && vIdx === 1);
        const stockQuantity = isOutOfStockTest ? 0 : (50 + ((i * 7 + vIdx * 13) % 80));

        await inventoryPrisma.inventory.create({
          data: {
            productId: p.id,
            variantId: v.id,
            stockQuantity,
            reservedQuantity: 0,
            reorderLevel: 10,
          },
        });

        // Ghi nhận biến động kho PURCHASE
        await inventoryPrisma.inventoryMovement.create({
          data: {
            productId: p.id,
            variantId: v.id,
            type: 'PURCHASE',
            quantity: stockQuantity,
            stockBefore: 0,
            stockAfter: stockQuantity,
            reservedBefore: 0,
            reservedAfter: 0,
            reason: `Nhập kho vụ mùa Đông Xuân 2026 cho biến thể ${v.sku}`,
            referenceType: 'PURCHASE_ORDER',
            referenceId: `PO-2026-${v.sku}`,
            performedBy: 'SYSTEM_SEED',
          },
        });

        inventoryCreatedCount++;
      }
    }
  }

  console.log(`Đã tạo mới ${imageCreatedCount} ảnh sản phẩm trên MinIO & product_db.`);
  console.log(`Đã khởi tạo tồn kho thực tế cho ${inventoryCreatedCount} biến thể trong inventory_db.`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await productPrisma.$disconnect();
    await inventoryPrisma.$disconnect();
    process.exit(0);
  });
