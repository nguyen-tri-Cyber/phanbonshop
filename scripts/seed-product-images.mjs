import { Client as MinioClient } from 'minio';
import { PrismaClient } from '../services/product-service/generated/client/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const brainDir = 'C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\2df3de69-0e69-441e-9f33-d89e89afc583';

const productDatabaseUrl =
  process.env.PRODUCT_DATABASE_URL ||
  'mysql://phanbon_user:phanbon_secret@localhost:3307/product_db';

const prisma = new PrismaClient({
  datasources: {
    db: { url: productDatabaseUrl },
  },
});

const minio = new MinioClient({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: Number(process.env.MINIO_PORT) || 9000,
  useSSL: false,
  accessKey: process.env.MINIO_ROOT_USER || 'admin',
  secretKey: process.env.MINIO_ROOT_PASSWORD || 'admin123456',
});

const BUCKET_NAME = 'product-images';

const imageMapping = {
  'DT-NPK-202015TE': 'dau_trau_npk_202015_1790094003007.jpg',
  'DT-NPK-161616': 'dau_trau_npk_202015_1790094003007.jpg',
  'PM-UREA-463': 'dam_phu_my_urea_1790094023354.jpg',
  'PM-NPK-151515': 'npk_phu_my_151515_1790094169389.jpg',
  'CM-UREA-DUC46': 'dam_ca_mau_duc_1790094145567.jpg',
  'CM-NPK-16168': 'npk_camau_poly_1790094804448.jpg',
  'DT-BIO-RICH': 'dau_trau_biorich_1790094191350.jpg',
  'PM-HUMIC-K': 'dau_trau_biorich_1790094191350.jpg',
  'DT-MK-501': 'dau_trau_mk501_1790094221492.jpg',
  'DT-MK-701': 'dau_trau_mk701_1790094246774.jpg',
  'DT-MK-901': 'dau_trau_mk901_1790094269897.jpg',
  'PM-CABO-ZN': 'canxi_bo_kem_1790094754423.jpg',
  'CM-CAL-SILIC': 'voi_cal_silic_1790094859363.jpg',
  'PM-KALI-MOP60': 'kali_phu_my_mop_1790094777953.jpg',
  'NB-FMP-LAN': 'lan_ninh_binh_1790094832478.jpg',
  'CM-NPK-201010': 'npk_camau_poly_1790094804448.jpg',
};

async function main() {
  console.log('--- Bắt đầu đồng bộ và tải hình ảnh sản phẩm lên MinIO & Database ---');

  // 1. Kiểm tra bucket MinIO
  const bucketExists = await minio.bucketExists(BUCKET_NAME);
  if (!bucketExists) {
    await minio.makeBucket(BUCKET_NAME);
    console.log(`Đã tạo mới bucket MinIO: ${BUCKET_NAME}`);
  }

  // Đảm bảo bucket public download
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetBucketLocation', 's3:ListBucket'],
        Resource: [`arn:aws:s3:::${BUCKET_NAME}`],
      },
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
      },
    ],
  };
  try {
    await minio.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
  } catch (err) {
    console.warn('Cảnh báo thiết lập policy bucket:', err.message);
  }

  // 2. Thư mục public trên frontend
  const publicDir = path.join(rootDir, 'apps', 'frontend', 'public', 'images', 'products');
  fs.mkdirSync(publicDir, { recursive: true });

  // 3. Lấy toàn bộ sản phẩm trong product_db
  const products = await prisma.product.findMany();
  console.log(`Tìm thấy ${products.length} sản phẩm trong product_db.`);

  let updatedCount = 0;

  for (const product of products) {
    const imageName = imageMapping[product.sku];
    if (!imageName) {
      console.warn(`Không tìm thấy ánh xạ ảnh cho SKU: ${product.sku}`);
      continue;
    }

    const sourcePath = path.join(brainDir, imageName);
    if (!fs.existsSync(sourcePath)) {
      console.error(`Tệp ảnh không tồn tại: ${sourcePath}`);
      continue;
    }

    const imageBuffer = fs.readFileSync(sourcePath);
    const objectKey = `products/${product.sku}.jpg`;

    // A. Tải lên MinIO
    await minio.putObject(BUCKET_NAME, objectKey, imageBuffer, imageBuffer.length, {
      'Content-Type': 'image/jpeg',
    });

    // B. Lưu bản sao vào public static frontend
    const localPublicPath = path.join(publicDir, `${product.sku}.jpg`);
    fs.writeFileSync(localPublicPath, imageBuffer);

    // C. Cập nhật bản ghi trong product_images (Xóa cũ nếu có và thêm mới)
    await prisma.productImage.deleteMany({
      where: { productId: product.id },
    });

    // URL sử dụng đường dẫn chuẩn qua reverse-proxy Nginx: /product-images/products/...
    const imageUrl = `/product-images/${objectKey}`;

    await prisma.productImage.create({
      data: {
        productId: product.id,
        objectKey,
        url: imageUrl,
        altText: `Hình ảnh bao bì ${product.name}`,
        sortOrder: 0,
        isPrimary: true,
      },
    });

    updatedCount++;
    console.log(` -> [${updatedCount}/${products.length}] Đã cập nhật ảnh cho ${product.name} (${product.sku}) -> ${imageUrl}`);
  }

  console.log(`\n Hoàn tất nạp hình ảnh thành công cho ${updatedCount}/${products.length} sản phẩm!`);
}

main()
  .catch((e) => {
    console.error('Lỗi khi nạp ảnh sản phẩm:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
