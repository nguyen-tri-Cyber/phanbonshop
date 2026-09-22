import { PrismaClient, PostStatus, BannerStatus } from '../generated/client/index.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.CONTENT_DATABASE_URL ||
        'mysql://phanbon_user:phanbon_secret@localhost:3307/content_db',
    },
  },
});

async function main(): Promise<void> {
  // BẢO VỆ AN TOÀN TUYỆT ĐỐI CHO PRODUCTION: Từ chối chạy seed trên production!
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[SECURITY FATAL] Refusing to seed database in PRODUCTION environment! Database seeding is strictly for development and testing.',
    );
  }

  console.log('--- [SEED] Bắt đầu khởi tạo dữ liệu mẫu cho content_db ---');

  // 1. Dọn sạch dữ liệu cũ
  await prisma.post.deleteMany();
  await prisma.banner.deleteMany();

  // 2. Tạo Banners
  console.log('Tạo banners tiếp thị trang chủ & sidebar...');
  await prisma.banner.createMany({
    data: [
      {
        title: 'Ưu Đãi Vụ Mùa 2026 — Miễn Phí Vận Chuyển Đơn Hàng Từ 2.000.000đ',
        imageUrl: 'http://localhost:9000/content-images/banners/banner-hero-1.webp',
        targetUrl: '/san-pham',
        position: 'HOME_HERO',
        status: BannerStatus.ACTIVE,
        sortOrder: 1,
      },
      {
        title: 'Phân Bón NPK Chính Hãng — Tăng Năng Suất, Bội Thu Mùa Vàng',
        imageUrl: 'http://localhost:9000/content-images/banners/banner-hero-2.webp',
        targetUrl: '/danh-muc/phan-bon-npk-hon-hop',
        position: 'HOME_HERO',
        status: BannerStatus.ACTIVE,
        sortOrder: 2,
      },
      {
        title: 'Cẩm Nang Nhà Nông — Kỹ Thuật Bón Phân Hiệu Quả',
        imageUrl: 'http://localhost:9000/content-images/banners/banner-sidebar-1.webp',
        targetUrl: '/kien-thuc',
        position: 'SIDEBAR',
        status: BannerStatus.ACTIVE,
        sortOrder: 1,
      },
    ],
  });

  // 3. Tạo Bài Viết Blog Kiến Thức Nông Nghiệp
  console.log('Tạo các bài viết cẩm nang nông nghiệp thực tế...');
  const posts = [
    {
      title: 'Kỹ Thuật Bón Phân NPK Cân Đối Cho Lúa Vụ Đông Xuân Đạt Năng Suất Cao',
      slug: 'ky-thuat-bon-phan-npk-can-doi-cho-lua-vu-dong-xuan',
      excerpt: 'Hướng dẫn chi tiết lịch bón phân lót, bón thúc đợt 1, đợt 2 và bón đón đòng cho cây lúa vụ Đông Xuân giúp lúa đẻ nhánh khỏe, bông to chắc hạt.',
      content: `
# Kỹ Thuật Bón Phân NPK Cân Đối Cho Lúa Vụ Đông Xuân

Vụ Đông Xuân là vụ lúa quan trọng nhất trong năm với tiềm năng năng suất cao nhất. Để đạt được hiệu quả tối ưu, bà con nông dân cần nắm vững nguyên tắc bón phân cân đối giữa Đạm (N), Lân (P) và Kali (K).

## 1. Giai đoạn bón lót (Trước khi sạ/cấy)
- **Mục tiêu:** Cung cấp dinh dưỡng ban đầu giúp bộ rễ phát triển sâu và hạ phèn nhanh chóng.
- **Loại phân khuyên dùng:** Phân lân nung chảy hoặc NPK 16-16-8 với liều lượng 150 - 200 kg/ha.

## 2. Giai đoạn bón thúc đẻ nhánh (7 - 10 ngày sau sạ)
- **Mục tiêu:** Kích thích cây lúa đẻ nhánh sớm, tập trung, tăng số chồi hữu hiệu.
- **Loại phân khuyên dùng:** NPK có hàm lượng đạm cao như NPK 20-20-15 hoặc Urê kết hợp DAP.

## 3. Giai đoạn đón đòng (40 - 45 ngày sau sạ)
- **Mục tiêu:** Nuôi đòng to, tăng số hạt trên bông và tỷ lệ hạt chắc.
- **Loại phân khuyên dùng:** Bổ sung Kali clorua kết hợp NPK cân đối để cứng cây, chống đổ ngã.
      `.trim(),
      coverImageUrl: 'http://localhost:9000/content-images/posts/post-lua-dong-xuan.webp',
      status: PostStatus.PUBLISHED,
      seoTitle: 'Kỹ thuật bón phân NPK cho lúa vụ Đông Xuân năng suất cao',
      seoDescription: 'Cẩm nang bón phân lúa Đông Xuân theo từng thời kỳ: bón lót, đẻ nhánh, đón đòng.',
      publishedAt: new Date(),
    },
    {
      title: 'Hướng Dẫn Bón Phân Hữu Cơ Vi Sinh Phục Hồi Sầu Riêng Sau Thu Hoạch',
      slug: 'huong-dan-bon-phan-huu-co-vi-sinh-phuc-hoi-sau-rieng-sau-thu-hoach',
      excerpt: 'Cây sầu riêng sau vụ thu hoạch thường bị kiệt sức, rễ tơ hư hại. Quy trình phục hồi bằng phân hữu cơ sinh học và trichoderma giúp tái tạo cơi đọt mới.',
      content: `
# Phục Hồi Vườn Sầu Riêng Sau Thu Hoạch

Sau một mùa nuôi trái kéo dài, cây sầu riêng bị suy giảm nghiêm trọng lượng dinh dưỡng dự trữ trong thân lá. Việc phục hồi kịp thời là yếu tố quyết định cho vụ mùa năm sau.

## Bước 1: Rửa vườn và tỉa cành tạo tán
Cắt bỏ các cuống trái cũ, cành tăm, cành sâu bệnh để cây thông thoáng và hạn chế nấm Phytophthora.

## Bước 2: Bón phân hữu cơ vi sinh
- Bón xung quanh tán cây từ 10 - 20 kg phân hữu cơ vi sinh ủ hoai mục (như hữu cơ Bỉ, hữu cơ Úc hoặc phân gà nở).
- Bổ sung nấm đối kháng Trichoderma để ức chế nấm bệnh tuyến trùng hại rễ.

## Bước 3: Kích thích ra rễ mới và đi cơi đọt
Tưới gốc bằng Humic Acid kết hợp Fulvic để giải độc phèn và kích rễ tơ phát triển mạnh mẽ.
      `.trim(),
      coverImageUrl: 'http://localhost:9000/content-images/posts/post-sau-rieng.webp',
      status: PostStatus.PUBLISHED,
      seoTitle: 'Bón phân hữu cơ phục hồi sầu riêng sau thu hoạch chuẩn kỹ thuật',
      seoDescription: 'Bí quyết phục hồi vườn sầu riêng sau thu hoạch: tỉa cành, bón hữu cơ, kích rễ.',
      publishedAt: new Date(),
    },
    {
      title: 'Nguyên Tắc 4 Đúng Trong Sử Dụng Phân Bón Nông Nghiệp Hiệu Quả & Tiết Kiệm',
      slug: 'nguyen-tac-4-dung-trong-su-dung-phan-bon-nong-nghiep',
      excerpt: 'Áp dụng nguyên tắc Đúng Loại, Đúng Liều, Đúng Lúc và Đúng Cách giúp nâng cao hiệu suất hấp thu của cây trồng và giảm chi phí đầu vào đến 25%.',
      content: `
# Nguyên Tắc 4 Đúng Trong Canh Tác Hiện Đại

Phân bón chiếm tới 30 - 40% chi phí sản xuất nông nghiệp. Sử dụng đúng phương pháp không chỉ tiết kiệm tiền bạc mà còn bảo vệ đất đai lâu bền.

1. **Đúng Loại:** Lựa chọn công thức phân phù hợp với từng thời kỳ sinh trưởng và loại đất.
2. **Đúng Liều Lượng:** Tránh bón thừa đạm gây lốp đổ, sâu bệnh hoặc bón thiếu làm còi cọc.
3. **Đúng Thời Điểm:** Bón khi rễ cây đang phát triển mạnh, tránh bón vào lúc trưa nắng gắt hoặc mưa lớn rửa trôi.
4. **Đúng Phương Pháp:** Xới nhẹ, vùi lấp phân hoặc tưới gốc hòa tan, không rải phân lên mặt đất khô nứt.
      `.trim(),
      coverImageUrl: 'http://localhost:9000/content-images/posts/post-4-dung.webp',
      status: PostStatus.PUBLISHED,
      seoTitle: 'Nguyên tắc 4 đúng trong sử dụng phân bón cây trồng',
      seoDescription: 'Nguyên tắc 4 đúng: Đúng loại, Đúng liều, Đúng lúc, Đúng cách trong bón phân.',
      publishedAt: new Date(),
    },
  ];

  for (const p of posts) {
    await prisma.post.create({ data: p });
  }

  console.log(`--- [SEED] Hoàn tất nạp dữ liệu mẫu content_db (${posts.length} bài viết, 3 banners)! ---`);
}

main()
  .catch((e) => {
    console.error('[DEV SEED ERROR]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
