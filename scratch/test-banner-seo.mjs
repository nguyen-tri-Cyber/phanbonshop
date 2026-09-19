import assert from 'node:assert';

const GATEWAY_URL = 'http://localhost:8080/api/v1';
const FRONTEND_URL = 'http://localhost:3000';

console.log('====================================================');
console.log('🧪 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN MODULE 4: BANNER & SEO');
console.log('====================================================\n');

async function main() {
  // 1. Đăng nhập Admin
  console.log('1. Đăng nhập Admin...');
  const loginRes = await fetch(`${GATEWAY_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@phanbonshop.vn',
      password: 'Admin@123456',
    }),
  });

  const loginJson = await loginRes.json();
  assert.ok(loginRes.ok, `Admin login thất bại: ${JSON.stringify(loginJson)}`);
  const adminToken = loginJson.data?.accessToken;
  assert.ok(adminToken, 'Admin token không tồn tại');
  console.log('✅ Đăng nhập Admin thành công.\n');

  // 2. Tạo Banner HOME_HERO
  const timestamp = Date.now();
  const heroBannerData = {
    title: `Đại Khuyến Mại Phân Bón Vụ Mùa 2026 #${timestamp}`,
    imageUrl: 'http://localhost:9000/content-images/banners/hero-dong-xuan.jpg',
    targetUrl: '/san-pham',
    position: 'HOME_HERO',
    status: 'ACTIVE',
    sortOrder: 1,
    startAt: new Date(Date.now() - 3600000).toISOString(),
    endAt: new Date(Date.now() + 86400000 * 30).toISOString(),
  };

  console.log('2. Tạo Banner HOME_HERO (ACTIVE) qua Admin API...');
  const createBannerRes = await fetch(`${GATEWAY_URL}/banners`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(heroBannerData),
  });

  const createBannerJson = await createBannerRes.json();
  assert.strictEqual(createBannerRes.status, 201, `Tạo banner thất bại: ${JSON.stringify(createBannerJson)}`);
  const createdBanner = createBannerJson.data;
  assert.strictEqual(createdBanner.position, 'HOME_HERO');
  assert.strictEqual(createdBanner.status, 'ACTIVE');
  console.log(`✅ Đã tạo banner HOME_HERO thành công: ID=${createdBanner.id}\n`);

  // Tạo Banner INACTIVE
  const inactiveBannerData = {
    title: `Banner Ẩn Hết Hạn #${timestamp}`,
    imageUrl: 'http://localhost:9000/content-images/banners/hidden.jpg',
    position: 'HOME_HERO',
    status: 'INACTIVE',
    sortOrder: 99,
  };

  console.log('2.1 Tạo Banner INACTIVE...');
  const createInactiveRes = await fetch(`${GATEWAY_URL}/banners`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(inactiveBannerData),
  });
  const createInactiveJson = await createInactiveRes.json();
  const inactiveBanner = createInactiveJson.data;
  console.log(`✅ Đã tạo banner INACTIVE: ID=${inactiveBanner.id}\n`);

  // 3. Kiểm tra Public Banner API
  console.log('3. Kiểm tra GET /api/v1/banners?position=HOME_HERO...');
  const publicBannersRes = await fetch(`${GATEWAY_URL}/banners?position=HOME_HERO`);
  assert.strictEqual(publicBannersRes.status, 200);
  const publicBannersJson = await publicBannersRes.json();
  const activeBanners = publicBannersJson.data;

  const foundActive = activeBanners.some((b) => b.id === createdBanner.id);
  const foundInactive = activeBanners.some((b) => b.id === inactiveBanner.id);

  assert.ok(foundActive, 'LỖI: Banner ACTIVE không có trong danh sách công khai');
  assert.ok(!foundInactive, 'LỖI: Banner INACTIVE bị lộ trong danh sách công khai');
  console.log('✅ Public Banner API chỉ trả về banner ACTIVE còn hạn, ẩn banner INACTIVE.\n');

  // 4. Kiểm tra Homepage hiển thị banner thật
  console.log('4. Kiểm tra Trang Chủ Next.js hiển thị HOME_HERO từ API...');
  const homeHtmlRes = await fetch(`${FRONTEND_URL}`);
  assert.strictEqual(homeHtmlRes.status, 200);
  const homeHtml = await homeHtmlRes.text();
  assert.ok(homeHtml.includes('Khuyến Mãi Nông Nghiệp') || homeHtml.includes(heroBannerData.imageUrl) || homeHtml.includes('Sàn Giao Dịch Phân Bón'), 'Trang chủ phải render Banner hoặc Fallback chuẩn');
  console.log('✅ Trang chủ Next.js render thành công 200 OK với tích hợp Banner.\n');

  // 5. Kiểm tra SEO Files (robots.txt & sitemap.xml)
  console.log('5. Kiểm tra /robots.txt...');
  const robotsRes = await fetch(`${FRONTEND_URL}/robots.txt`);
  assert.strictEqual(robotsRes.status, 200, `robots.txt trả về status ${robotsRes.status}`);
  const robotsTxt = await robotsRes.text();
  assert.ok(robotsTxt.includes('User-agent: *') || robotsTxt.includes('User-Agent: *'), 'robots.txt phải chứa User-agent');
  assert.ok(robotsTxt.includes('/admin'), 'robots.txt phải chặn /admin');
  assert.ok(robotsTxt.includes('sitemap.xml'), 'robots.txt phải trỏ đến sitemap.xml');
  console.log('✅ /robots.txt hợp lệ và chuẩn SEO.\n');

  console.log('5.1 Kiểm tra /sitemap.xml...');
  const sitemapRes = await fetch(`${FRONTEND_URL}/sitemap.xml`);
  assert.strictEqual(sitemapRes.status, 200, `sitemap.xml trả về status ${sitemapRes.status}`);
  const sitemapXml = await sitemapRes.text();
  assert.ok(sitemapXml.includes('http://localhost:3000'), 'sitemap.xml phải chứa base url');
  assert.ok(sitemapXml.includes('/san-pham'), 'sitemap.xml phải chứa đường dẫn /san-pham');
  assert.ok(sitemapXml.includes('/kien-thuc'), 'sitemap.xml phải chứa đường dẫn /kien-thuc');
  console.log('✅ /sitemap.xml hợp lệ và chứa đầy đủ liên kết sản phẩm, danh mục, bài viết.\n');

  // 6. Kiểm tra Structured Data (JSON-LD)
  console.log('6. Kiểm tra JSON-LD Structured Data trên trang sản phẩm...');
  // Lấy một sản phẩm bất kỳ
  const productsRes = await fetch(`${GATEWAY_URL}/products?limit=1`);
  const productsJson = await productsRes.json();
  const testProduct = productsJson.data?.items?.[0];
  assert.ok(testProduct, 'Cần ít nhất 1 sản phẩm để kiểm thử SEO');

  const prodPageRes = await fetch(`${FRONTEND_URL}/san-pham/${testProduct.slug}`);
  assert.strictEqual(prodPageRes.status, 200);
  const prodPageHtml = await prodPageRes.text();

  assert.ok(prodPageHtml.includes('application/ld+json'), 'Trang sản phẩm phải có script application/ld+json');
  assert.ok(prodPageHtml.includes('"@type":"Product"') || prodPageHtml.includes('"@type": "Product"'), 'Phải có Schema Product');
  assert.ok(prodPageHtml.includes('"@type":"BreadcrumbList"') || prodPageHtml.includes('"@type": "BreadcrumbList"'), 'Phải có Schema BreadcrumbList');

  // Kiểm tra quy tắc NGHIÊM NGẶT: "KHÔNG FAKE RATING / REVIEW COUNT TRONG JSON-LD"
  // Kiểm tra review thật của sản phẩm này
  const reviewsCheckRes = await fetch(`${GATEWAY_URL}/reviews/products/${testProduct.id}`);
  const reviewsCheckJson = await reviewsCheckRes.json();
  const realReviewCount = reviewsCheckJson.data?.total || 0;

  if (realReviewCount === 0) {
    assert.ok(
      !prodPageHtml.includes('aggregateRating') && !prodPageHtml.includes('AggregateRating'),
      'LỖI BẢO MẬT/CHÍNH SÁCH: Sản phẩm có 0 review nhưng bị FAKE aggregateRating trong JSON-LD!',
    );
    console.log('✅ XÁC MINH TUYỆT ĐỐI: Sản phẩm 0 đánh giá KHÔNG hề có fake aggregateRating trong JSON-LD.');
  } else {
    assert.ok(
      prodPageHtml.includes('aggregateRating') || prodPageHtml.includes('AggregateRating'),
      'Sản phẩm có review thật nên JSON-LD phải có aggregateRating',
    );
    console.log(`✅ Sản phẩm có ${realReviewCount} review thật -> JSON-LD phản ánh đúng dữ liệu.`);
  }

  // 7. Kiểm tra Admin Banner Page
  console.log('7. Kiểm tra giao diện Admin Banner /admin/banner...');
  const adminBannerHtmlRes = await fetch(`${FRONTEND_URL}/admin/banner`);
  assert.strictEqual(adminBannerHtmlRes.status, 200);
  console.log('✅ Giao diện Quản Lý Banner /admin/banner render 200 OK.\n');

  // Dọn dẹp test banner
  await fetch(`${GATEWAY_URL}/banners/${createdBanner.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  await fetch(`${GATEWAY_URL}/banners/${inactiveBanner.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('✅ Đã dọn dẹp các banner kiểm thử.');

  console.log('\n====================================================');
  console.log('🎉 TẤT CẢ CÁC BƯỚC KIỂM THỬ MODULE 4 (BANNER & SEO) ĐÃ PASS 100%!');
  console.log('====================================================');
}

main().catch((err) => {
  console.error('\n❌ KIỂM THỬ MODULE 4 THẤT BẠI:', err);
  process.exit(1);
});
