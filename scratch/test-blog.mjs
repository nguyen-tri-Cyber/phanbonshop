import assert from 'node:assert';

const GATEWAY_URL = 'http://localhost:8080/api/v1';
const FRONTEND_URL = 'http://localhost:3000';

console.log('====================================================');
console.log('🧪 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN MODULE 3: BLOG & CONTENT');
console.log('====================================================\n');

async function main() {
  // 1. Login Admin
  console.log('1. Đăng nhập tài khoản Admin...');
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

  // 2. Tạo bài viết PUBLISHED
  const timestamp = Date.now();
  const publishedPostData = {
    title: `Kỹ thuật bón phân NPK Đầu Trâu cho sầu riêng ra hoa đồng loạt #${timestamp}`,
    slug: `ky-thuat-bon-phan-npk-sau-rieng-${timestamp}`,
    excerpt: 'Hướng dẫn công thức bón NPK phân tầng và cân đối dinh dưỡng cho cây sầu riêng giai đoạn làm bông đón mùa vụ mới.',
    content: `Cây sầu riêng trong giai đoạn xử lý ra hoa đòi hỏi dinh dưỡng lân và kali cao nhằm kích thích mầm hoa phân hóa đều.
    
    1. Giai đoạn tạo mầm: Sử dụng NPK 10-50-10 hoặc NPK 10-60-10 phun đều tán lá.
    2. Bón gốc: Sử dụng phân bón NPK Đầu Trâu TE cân đối dinh dưỡng trung vi lượng Bo, Kẽm.
    3. Quản lý nước tưới: Xiết nước tạo khô hạn nhân tạo trong 20-25 ngày trước khi tưới nhử trở lại.
    
    Bà con chú ý tuân thủ đúng liều lượng chỉ định của kỹ sư nông nghiệp để bảo vệ bộ rễ và nâng cao năng suất xuất khẩu.`,
    coverImageUrl: 'http://localhost:9000/content-images/posts/sau-rieng-demo.jpg',
    status: 'PUBLISHED',
    seoTitle: 'Kỹ thuật bón NPK sầu riêng năng suất cao | Phân Bón Shop',
    seoDescription: 'Cẩm nang bón phân Đầu Trâu cho sầu riêng ra hoa đồng loạt, trái đồng đều đạt chuẩn xuất khẩu.',
    publishedAt: new Date().toISOString(),
  };

  console.log('2. Tạo bài viết Kiến Thức Nông Nghiệp (PUBLISHED) qua Admin API...');
  const createPubRes = await fetch(`${GATEWAY_URL}/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(publishedPostData),
  });

  const createPubJson = await createPubRes.json();
  assert.strictEqual(createPubRes.status, 201, `Tạo bài viết thất bại: ${JSON.stringify(createPubJson)}`);
  const publishedPost = createPubJson.data;
  assert.strictEqual(publishedPost.status, 'PUBLISHED');
  assert.strictEqual(publishedPost.slug, publishedPostData.slug);
  console.log(`✅ Đã tạo bài viết PUBLISHED thành công: ID=${publishedPost.id}, Slug=${publishedPost.slug}\n`);

  // 3. Tạo bài viết DRAFT
  const draftPostData = {
    title: `Bản thảo: Lưu ý khi sử dụng phân bón hữu cơ sinh học #${timestamp}`,
    slug: `ban-thao-phan-bon-huu-co-${timestamp}`,
    excerpt: 'Nội dung đang trong quá trình thử nghiệm và kiểm duyệt thực địa.',
    content: 'Nội dung bản nháp nội bộ, chưa được phát hành ra ngoài cho nông dân xem.',
    status: 'DRAFT',
  };

  console.log('3. Tạo bài viết nháp (DRAFT) qua Admin API...');
  const createDraftRes = await fetch(`${GATEWAY_URL}/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(draftPostData),
  });

  const createDraftJson = await createDraftRes.json();
  assert.strictEqual(createDraftRes.status, 201, `Tạo bản nháp thất bại: ${JSON.stringify(createDraftJson)}`);
  const draftPost = createDraftJson.data;
  assert.strictEqual(draftPost.status, 'DRAFT');
  console.log(`✅ Đã tạo bài viết DRAFT thành công: ID=${draftPost.id}, Slug=${draftPost.slug}\n`);

  // 4. Kiểm tra Public Storefront API
  console.log('4. Kiểm tra Public API /api/v1/posts...');
  const publicListRes = await fetch(`${GATEWAY_URL}/posts`);
  const publicListJson = await publicListRes.json();
  assert.strictEqual(publicListRes.status, 200);
  const items = publicListJson.data.items;
  
  const hasPublished = items.some((p) => p.slug === publishedPost.slug);
  const hasDraft = items.some((p) => p.slug === draftPost.slug);

  assert.ok(hasPublished, 'LỖI: Bài viết PUBLISHED không xuất hiện trong danh sách công khai');
  assert.ok(!hasDraft, 'LỖI BẢO MẬT: Bài viết DRAFT bị lộ trên API công khai');
  console.log('✅ Danh sách công khai chỉ trả về bài viết PUBLISHED, hoàn toàn ẩn bài DRAFT.\n');

  // 4.1 Kiểm tra chi tiết qua Slug
  console.log('4.1 Kiểm tra GET /api/v1/posts/slug/:slug...');
  const getPubSlugRes = await fetch(`${GATEWAY_URL}/posts/slug/${publishedPost.slug}`);
  assert.strictEqual(getPubSlugRes.status, 200);
  const pubSlugJson = await getPubSlugRes.json();
  assert.strictEqual(pubSlugJson.data.title, publishedPostData.title);
  console.log('✅ Lấy chi tiết bài viết PUBLISHED theo slug thành công.');

  const getDraftSlugRes = await fetch(`${GATEWAY_URL}/posts/slug/${draftPost.slug}`);
  assert.strictEqual(getDraftSlugRes.status, 404, 'LỖI: Truy cập slug bài DRAFT phải trả về 404');
  console.log('✅ Truy cập bài DRAFT qua public slug trả về 404 Not Found đúng quy chuẩn.\n');

  // 5. Kiểm tra Next.js Storefront Pages
  console.log('5. Kiểm tra giao diện Next.js Storefront: /kien-thuc...');
  const htmlListRes = await fetch(`${FRONTEND_URL}/kien-thuc`);
  assert.strictEqual(htmlListRes.status, 200, `Trang /kien-thuc trả về mã ${htmlListRes.status}`);
  const htmlList = await htmlListRes.text();
  assert.ok(htmlList.includes(publishedPost.slug), 'HTML /kien-thuc phải chứa slug bài viết');
  assert.ok(htmlList.includes('Cẩm Nang &amp; Kiến Thức Bón Phân') || htmlList.includes('Kiến Thức'), 'HTML /kien-thuc phải chứa tiêu đề trang');
  console.log('✅ Trang danh sách /kien-thuc render 200 OK và chứa bài viết vừa tạo.\n');

  console.log(`5.1 Kiểm tra giao diện bài viết chi tiết: /kien-thuc/${publishedPost.slug}...`);
  const htmlDetailRes = await fetch(`${FRONTEND_URL}/kien-thuc/${publishedPost.slug}`);
  assert.strictEqual(htmlDetailRes.status, 200, `Trang /kien-thuc/${publishedPost.slug} trả về ${htmlDetailRes.status}`);
  const htmlDetail = await htmlDetailRes.text();
  assert.ok(htmlDetail.includes('application/ld+json'), 'Trang chi tiết phải chứa Article JSON-LD Structured Data');
  assert.ok(htmlDetail.includes('schema.org'), 'JSON-LD phải có schema.org');
  assert.ok(htmlDetail.includes('Article'), 'JSON-LD phải có @type Article');
  console.log('✅ Trang chi tiết /kien-thuc/[slug] render 200 OK kèm đầy đủ Article JSON-LD Structured Data chuẩn SEO.\n');

  // 6. Kiểm tra Admin Update & Delete
  console.log('6. Kiểm tra Admin Update & Delete bài viết...');
  const updateRes = await fetch(`${GATEWAY_URL}/posts/${draftPost.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      title: `${draftPostData.title} (Đã chỉnh sửa)`,
    }),
  });
  assert.strictEqual(updateRes.status, 200);
  console.log('✅ Cập nhật bài viết qua Admin API thành công.');

  const deleteRes = await fetch(`${GATEWAY_URL}/posts/${draftPost.id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
  assert.strictEqual(deleteRes.status, 200);
  console.log('✅ Xóa bài viết qua Admin API thành công.\n');

  console.log('====================================================');
  console.log('🎉 TẤT CẢ CÁC BƯỚC KIỂM THỬ MODULE 3 (BLOG) ĐÃ PASS 100%!');
  console.log('====================================================');
}

main().catch((err) => {
  console.error('\n❌ KIỂM THỬ MODULE 3 THẤT BẠI:', err);
  process.exit(1);
});
