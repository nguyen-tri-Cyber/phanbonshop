import {
  PrismaClient,
  Status,
  ProductStatus,
  VariantStatus,
  AgriculturalAttributeType,
} from '../generated/client/index.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.PRODUCT_DATABASE_URL ||
        'mysql://phanbon_user:phanbon_secret@localhost:3307/product_db',
    },
  },
});

async function main(): Promise<void> {
  console.log('--- [SEED] Bắt đầu khởi tạo dữ liệu mẫu cho product_db ---');

  // 1. Dọn sạch dữ liệu cũ theo thứ tự ràng buộc
  await prisma.agriculturalAttribute.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();

  // 2. Tạo 5 Danh mục (Categories)
  console.log('Tạo 5 danh mục phân bón...');
  const catNPK = await prisma.category.create({
    data: {
      name: 'Phân bón NPK & Hỗn hợp',
      slug: 'phan-bon-npk-hon-hop',
      description: 'Các dòng phân khoáng hỗn hợp chứa đầy đủ ba thành phần dinh dưỡng Đạm (N), Lân (P), Kali (K) cùng các phụ gia vi lượng cao cấp.',
      status: Status.ACTIVE,
      sortOrder: 1,
    },
  });

  const catHuuCo = await prisma.category.create({
    data: {
      name: 'Phân bón Hữu cơ Vi sinh & Sinh học',
      slug: 'phan-bon-huu-co-vi-sinh',
      description: 'Phân hữu cơ giàu mùn, axit humic, axit fulvic và tập đoàn vi sinh vật có ích giúp cải tạo đất bạc màu, kích thích rễ phát triển.',
      status: Status.ACTIVE,
      sortOrder: 2,
    },
  });

  const catPhanLa = await prisma.category.create({
    data: {
      name: 'Phân bón Lá & Kích thích sinh trưởng',
      slug: 'phan-bon-la-kich-thich-sinh-truong',
      description: 'Dinh dưỡng hòa tan cao cấp hấp thụ trực tiếp qua khí khổng lá, thúc đẩy bung chồi, kéo đọt, tăng khả năng quang hợp.',
      status: Status.ACTIVE,
      sortOrder: 3,
    },
  });

  const catTrungViLuong = await prisma.category.create({
    data: {
      name: 'Phân bón Trung Vi lượng & Cải tạo đất',
      slug: 'phan-bon-trung-vi-luong',
      description: 'Bổ sung Canxi, Magie, Silic, Kẽm, Bo, Sắt dạng Chelate giúp hạ phèn, khử chua, chống nứt trái và rụng hoa non.',
      status: Status.ACTIVE,
      sortOrder: 4,
    },
  });

  const catPhanDon = await prisma.category.create({
    data: {
      name: 'Phân bón Đơn & Khoáng chất',
      slug: 'phan-bon-don-khoang-chat',
      description: 'Các sản phẩm phân bón đơn nguyên chất: Đạm Urea hạt trong/hạt đục, Lân nung chảy, Kali Clorua (MOP), Kali Sunfat (SOP).',
      status: Status.ACTIVE,
      sortOrder: 5,
    },
  });

  // 3. Tạo 3 Thương hiệu (Brands)
  console.log('Tạo 3 thương hiệu phân bón Việt Nam...');
  const brandBinhDien = await prisma.brand.create({
    data: {
      name: 'Phân Bón Bình Điền (Đầu Trâu)',
      slug: 'binh-dien-dau-trau',
      description: 'Công ty Cổ phần Phân bón Bình Điền - Nhà sản xuất phân bón NPK chuyên dùng hàng đầu Việt Nam với thương hiệu Đầu Trâu danh tiếng.',
      logoUrl: 'http://localhost:9000/product-images/brands/binh-dien.png',
      status: Status.ACTIVE,
    },
  });

  const brandPhuMy = await prisma.brand.create({
    data: {
      name: 'Đạm Phú Mỹ (PVFCCo)',
      slug: 'dam-phu-my',
      description: 'Tổng công ty Phân bón và Hóa chất Dầu khí - Đơn vị sản xuất Đạm Phú Mỹ, NPK Phú Mỹ đạt chuẩn chất lượng quốc tế.',
      logoUrl: 'http://localhost:9000/product-images/brands/phu-my.png',
      status: Status.ACTIVE,
    },
  });

  const brandCaMau = await prisma.brand.create({
    data: {
      name: 'Phân Bón Cà Mau (PVCFC)',
      slug: 'phan-bon-ca-mau',
      description: 'Công ty Cổ phần Phân bón Dầu khí Cà Mau - Tiên phong với dòng Đạm hạt đục, NPK công nghệ Polyphosphate tân tiến.',
      logoUrl: 'http://localhost:9000/product-images/brands/ca-mau.png',
      status: Status.ACTIVE,
    },
  });

  // 4. Tạo 16 Sản phẩm chi tiết (Products + Variants + Agricultural Attributes)
  console.log('Tạo 16 sản phẩm phân bón và các biến thể...');

  const productsData = [
    // 1
    {
      name: 'Đầu Trâu NPK 20-20-15+TE Cao Cấp',
      slug: 'dau-trau-npk-20-20-15-te',
      sku: 'DT-NPK-202015TE',
      shortDescription: 'Phân bón đa lượng NPK chuyên dùng cho giai đoạn đẻ nhánh, làm đòng trên lúa và nuôi trái trên cây ăn trái.',
      description: 'Sản phẩm bổ sung đầy đủ Đạm, Lân, Kali cùng các vi lượng Kẽm (Zn), Bo (B), Đồng (Cu) dạng chelate hòa tan nhanh, cây trồng hấp thụ tức thì.',
      composition: 'Đạm (Nts): 20%, Lân (P2O5hh): 20%, Kali (K2Ohh): 15%, Bo: 100ppm, Kẽm: 100ppm, Độ ẩm: 2%',
      usageInstructions: 'Cây ăn trái: Bón 0.5 - 1.5 kg/cây/lần vào giai đoạn nuôi trái. Cây lúa: Bón 100 - 150 kg/ha vào thời kỳ đẻ nhánh rộ.',
      storageInstructions: 'Để nơi khô ráo thoáng mát, buộc kín miệng bao sau khi sử dụng dở dang.',
      warningInformation: 'Mang găng tay và khẩu trang bảo hộ khi bón phân, rửa tay sạch sau khi tiếp xúc.',
      manufacturer: 'Công ty Cổ phần Phân bón Bình Điền',
      origin: 'Việt Nam',
      brandId: brandBinhDien.id,
      categoryId: catNPK.id,
      price: 890000,
      compareAtPrice: 950000,
      status: ProductStatus.ACTIVE,
      featured: true,
      bestSeller: true,
      variants: [
        { sku: 'DT-NPK-202015TE-25KG', unit: 'Bao', packageSize: '25kg', price: 460000, compareAtPrice: 490000 },
        { sku: 'DT-NPK-202015TE-50KG', unit: 'Bao', packageSize: '50kg', price: 890000, compareAtPrice: 950000 },
      ],
      attrs: [
        { attributeType: AgriculturalAttributeType.CROP, value: 'Sầu riêng', code: 'sau_rieng' },
        { attributeType: AgriculturalAttributeType.CROP, value: 'Lúa', code: 'lua' },
        { attributeType: AgriculturalAttributeType.GROWTH_STAGE, value: 'Nuôi trái', code: 'nuoi_trai' },
        { attributeType: AgriculturalAttributeType.APPLICATION_METHOD, value: 'Bón gốc', code: 'bon_goc' },
        { attributeType: AgriculturalAttributeType.NUTRIENT_TYPE, value: 'NPK Đa lượng', code: 'npk' },
      ],
    },
    // 2
    {
      name: 'Đầu Trâu Tea NPK 16-16-16 Chuyên Cây Công Nghiệp',
      slug: 'dau-trau-tea-npk-16-16-16',
      sku: 'DT-NPK-161616',
      shortDescription: 'Cân bằng ba yếu tố Đạm - Lân - Kali, dưỡng cành khỏe, củ to, hạt chắc cho cà phê, tiêu và chè.',
      description: 'Phân bón NPK ba số 16 một màu công nghệ tháp cao, tan hoàn toàn, không để lại cặn lắng, cung cấp dinh dưỡng đồng đều.',
      composition: 'Đạm: 16%, Lân: 16%, Kali: 16%, S: 2%, Bo: 50ppm',
      usageInstructions: 'Cà phê, Hồ tiêu: Bón 400 - 600 kg/ha/năm chia làm 3 đợt bón đầu, giữa và cuối mùa mưa.',
      storageInstructions: 'Để trên kệ gỗ cách mặt đất 20cm, trong kho có mái che.',
      warningInformation: 'Tránh xa tầm tay trẻ em, nguồn thực phẩm và nguồn nước sinh hoạt.',
      manufacturer: 'Công ty Cổ phần Phân bón Bình Điền',
      origin: 'Việt Nam',
      brandId: brandBinhDien.id,
      categoryId: catNPK.id,
      price: 810000,
      compareAtPrice: 870000,
      status: ProductStatus.ACTIVE,
      featured: false,
      bestSeller: true,
      variants: [
        { sku: 'DT-NPK-161616-50KG', unit: 'Bao', packageSize: '50kg', price: 810000, compareAtPrice: 870000 },
      ],
      attrs: [
        { attributeType: AgriculturalAttributeType.CROP, value: 'Cà phê', code: 'ca_phe' },
        { attributeType: AgriculturalAttributeType.CROP, value: 'Hồ tiêu', code: 'ho_tieu' },
        { attributeType: AgriculturalAttributeType.GROWTH_STAGE, value: 'Kiến thiết cơ bản', code: 'kien_thiet' },
        { attributeType: AgriculturalAttributeType.APPLICATION_METHOD, value: 'Bón gốc', code: 'bon_goc' },
        { attributeType: AgriculturalAttributeType.NUTRIENT_TYPE, value: 'NPK Đa lượng', code: 'npk' },
      ],
    },
    // 3
    {
      name: 'Đạm Phú Mỹ Hạt Trong (Urea 46.3%)',
      slug: 'dam-phu-my-hat-trong-urea',
      sku: 'PM-UREA-463',
      shortDescription: 'Phân đạm trắng hạt trong truyền thống, tan cực nhanh, giúp cây trồng đâm chồi đẻ nhánh mãnh liệt.',
      description: 'Đạm Phú Mỹ sản xuất từ khí tự nhiên mỏ Bạch Hổ theo công nghệ của Đan Mạch và Ý, hàm lượng đạm ổn định tối thiểu 46.3%, biuret thấp dưới 1%.',
      composition: 'Đạm tổng số (Nts): 46.3%, Biuret: tối đa 0.99%, Độ ẩm: tối đa 0.4%',
      usageInstructions: 'Bón lót và bón thúc cây ngắn ngày 50 - 100 kg/ha. Bón thúc cây ăn trái 200 - 400g/cây/lần.',
      storageInstructions: 'Để nơi khô ráo, không để dưới trời nắng hoặc nơi có độ ẩm cao.',
      warningInformation: 'Không bón lúc trời nắng gắt tránh thất thoát đạm do bay hơi amoniac.',
      manufacturer: 'Tổng công ty Phân bón và Hóa chất Dầu khí',
      origin: 'Việt Nam',
      brandId: brandPhuMy.id,
      categoryId: catPhanDon.id,
      price: 580000,
      compareAtPrice: 620000,
      status: ProductStatus.ACTIVE,
      featured: true,
      bestSeller: true,
      variants: [
        { sku: 'PM-UREA-50KG', unit: 'Bao', packageSize: '50kg', price: 580000, compareAtPrice: 620000 },
      ],
      attrs: [
        { attributeType: AgriculturalAttributeType.CROP, value: 'Lúa', code: 'lua' },
        { attributeType: AgriculturalAttributeType.CROP, value: 'Rau màu', code: 'rau_mau' },
        { attributeType: AgriculturalAttributeType.GROWTH_STAGE, value: 'Đẻ nhánh', code: 'de_nhanh' },
        { attributeType: AgriculturalAttributeType.APPLICATION_METHOD, value: 'Bón gốc', code: 'bon_goc' },
        { attributeType: AgriculturalAttributeType.NUTRIENT_TYPE, value: 'Đạm Urea', code: 'dam' },
      ],
    },
    // 4
    {
      name: 'NPK Phú Mỹ 15-15-15 Tháp Cao Hạt Tròn',
      slug: 'npk-phu-my-15-15-15-thap-cao',
      sku: 'PM-NPK-151515',
      shortDescription: 'Sản xuất bằng công nghệ hóa lỏng hiện đại bậc nhất, hạt tròn đều, tan nhanh hoàn toàn.',
      description: 'Dinh dưỡng đồng đều trong từng hạt phân bón, giúp rễ hấp thu toàn diện cả 3 nguyên tố mà không gây cháy rễ non.',
      composition: 'Nts: 15%, P2O5hh: 15%, K2Ohh: 15%, TE bổ sung',
      usageInstructions: 'Thanh long, cam, bưởi: Bón 200 - 400g/gốc/tháng trong giai đoạn ra hoa kết trái.',
      storageInstructions: 'Bảo quản nơi khô mát, kê cao cách tường 50cm.',
      warningInformation: 'Không hít phải bụi phân, rửa kỹ mắt nếu tiếp xúc.',
      manufacturer: 'Tổng công ty Phân bón và Hóa chất Dầu khí',
      origin: 'Việt Nam',
      brandId: brandPhuMy.id,
      categoryId: catNPK.id,
      price: 760000,
      compareAtPrice: 820000,
      status: ProductStatus.ACTIVE,
      featured: false,
      bestSeller: false,
      variants: [
        { sku: 'PM-NPK-151515-50KG', unit: 'Bao', packageSize: '50kg', price: 760000, compareAtPrice: 820000 },
      ],
      attrs: [
        { attributeType: AgriculturalAttributeType.CROP, value: 'Cây ăn trái', code: 'cay_an_trai' },
        { attributeType: AgriculturalAttributeType.CROP, value: 'Thanh long', code: 'thanh_long' },
        { attributeType: AgriculturalAttributeType.GROWTH_STAGE, value: 'Ra hoa', code: 'ra_hoa' },
        { attributeType: AgriculturalAttributeType.APPLICATION_METHOD, value: 'Bón gốc', code: 'bon_goc' },
        { attributeType: AgriculturalAttributeType.NUTRIENT_TYPE, value: 'NPK Đa lượng', code: 'npk' },
      ],
    },
    // 5
    {
      name: 'Đạm Hạt Đục Cà Mau (Urea N46+ Bổ Sung Kẽm & Bo)',
      slug: 'dam-hat-duc-ca-mau-urea-n46',
      sku: 'CM-UREA-DUC46',
      shortDescription: 'Hạt to tròn, phủ lớp chậm tan giúp tiết kiệm 20% lượng phân bón, chống thất thoát rửa trôi.',
      description: 'Hạt đục kích thước 2.5 - 4.5mm chống vỡ nát, tan từ từ theo nhu cầu sinh trưởng của bộ rễ, giải phóng dinh dưỡng liên tục.',
      composition: 'Đạm tổng số: 46%, Kẽm (Zn): 150ppm, Bo: 100ppm',
      usageInstructions: 'Cây lúa: Bón đón đòng 80 - 120 kg/ha. Mía, ngô: Bón thúc 150 - 200 kg/ha.',
      storageInstructions: 'Nơi có mái che thông thoáng, tránh nguồn nhiệt cao.',
      warningInformation: 'Đeo trang bị bảo hộ khi thao tác bón phân trên diện tích rộng.',
      manufacturer: 'Công ty Cổ phần Phân bón Dầu khí Cà Mau',
      origin: 'Việt Nam',
      brandId: brandCaMau.id,
      categoryId: catPhanDon.id,
      price: 610000,
      compareAtPrice: 650000,
      status: ProductStatus.ACTIVE,
      featured: true,
      bestSeller: true,
      variants: [
        { sku: 'CM-UREA-DUC-50KG', unit: 'Bao', packageSize: '50kg', price: 610000, compareAtPrice: 650000 },
      ],
      attrs: [
        { attributeType: AgriculturalAttributeType.CROP, value: 'Lúa', code: 'lua' },
        { attributeType: AgriculturalAttributeType.CROP, value: 'Mía', code: 'mia' },
        { attributeType: AgriculturalAttributeType.GROWTH_STAGE, value: 'Đẻ nhánh', code: 'de_nhanh' },
        { attributeType: AgriculturalAttributeType.APPLICATION_METHOD, value: 'Bón gốc', code: 'bon_goc' },
        { attributeType: AgriculturalAttributeType.NUTRIENT_TYPE, value: 'Đạm Urea', code: 'dam' },
      ],
    },
    // 6
    {
      name: 'NPK Cà Mau 16-16-8+TE Chuyên Lúa & Hoa Màu',
      slug: 'npk-ca-mau-16-16-8-te',
      sku: 'CM-NPK-16168',
      shortDescription: 'Tỷ lệ đạm và lân vượt trội, thúc rễ ăn sâu, nở bụi to, cứng cây hạn chế đổ ngã khi gặp mưa bão.',
      description: 'Phân bón phức hợp giàu chất dinh dưỡng khoáng dễ tiêu, tăng sức chống chịu với sâu bệnh hại và điều kiện phèn mặn.',
      composition: 'Nts: 16%, P2O5hh: 16%, K2Ohh: 8%, Vi lượng Bo, Kẽm',
      usageInstructions: 'Bón lót và bón thúc đợt 1 cho lúa từ 7 - 10 ngày sau sạ (150 - 200kg/ha).',
      storageInstructions: 'Bảo quản nơi khô ráo, che chắn cẩn thận.',
      warningInformation: 'Không để gần gia súc, gia cầm.',
      manufacturer: 'Công ty Cổ phần Phân bón Dầu khí Cà Mau',
      origin: 'Việt Nam',
      brandId: brandCaMau.id,
      categoryId: catNPK.id,
      price: 680000,
      compareAtPrice: 720000,
      status: ProductStatus.ACTIVE,
      featured: false,
      bestSeller: false,
      variants: [
        { sku: 'CM-NPK-16168-50KG', unit: 'Bao', packageSize: '50kg', price: 680000, compareAtPrice: 720000 },
      ],
      attrs: [
        { attributeType: AgriculturalAttributeType.CROP, value: 'Lúa', code: 'lua' },
        { attributeType: AgriculturalAttributeType.GROWTH_STAGE, value: 'Đẻ nhánh', code: 'de_nhanh' },
        { attributeType: AgriculturalAttributeType.APPLICATION_METHOD, value: 'Bón gốc', code: 'bon_goc' },
        { attributeType: AgriculturalAttributeType.NUTRIENT_TYPE, value: 'NPK Đa lượng', code: 'npk' },
      ],
    },
    // 7
    {
      name: 'Phân Bón Hữu Cơ Sinh Học Đầu Trâu Bio-Rich',
      slug: 'phan-bon-huu-co-sinh-hoc-dau-trau-bio-rich',
      sku: 'DT-BIO-RICH',
      shortDescription: 'Cung cấp 65% chất hữu cơ ủ hoai mục kết hợp chủng vi sinh Trichoderma đối kháng nấm bệnh.',
      description: 'Làm tơi xốp đất, phục hồi bộ rễ hư tổn sau thu hoạch, kích thích giun đất phát triển và tăng dung lượng hấp thu dinh dưỡng của keo đất.',
      composition: 'Chất hữu cơ: 65%, Axit Humic: 5%, Trichoderma spp: 10^6 CFU/g, Nts: 3%, P2O5: 2%, K2O: 2%',
      usageInstructions: 'Bón lót 1 - 2 tấn/ha hoặc bón quanh tán cây ăn trái từ 3 - 5kg/gốc.',
      storageInstructions: 'Bảo quản nơi mát, tránh ánh nắng chiếu trực tiếp làm suy giảm mật độ vi sinh.',
      warningInformation: 'Sản phẩm thân thiện môi trường, an toàn cho con người.',
      manufacturer: 'Công ty Cổ phần Phân bón Bình Điền',
      origin: 'Việt Nam',
      brandId: brandBinhDien.id,
      categoryId: catHuuCo.id,
      price: 320000,
      compareAtPrice: 350000,
      status: ProductStatus.ACTIVE,
      featured: true,
      bestSeller: true,
      variants: [
        { sku: 'DT-BIO-RICH-25KG', unit: 'Bao', packageSize: '25kg', price: 320000, compareAtPrice: 350000 },
      ],
      attrs: [
        { attributeType: AgriculturalAttributeType.CROP, value: 'Sầu riêng', code: 'sau_rieng' },
        { attributeType: AgriculturalAttributeType.CROP, value: 'Cà phê', code: 'ca_phe' },
        { attributeType: AgriculturalAttributeType.GROWTH_STAGE, value: 'Sau thu hoạch', code: 'sau_thu_hoach' },
        { attributeType: AgriculturalAttributeType.APPLICATION_METHOD, value: 'Bón gốc', code: 'bon_goc' },
        { attributeType: AgriculturalAttributeType.NUTRIENT_TYPE, value: 'Hữu cơ vi sinh', code: 'huu_co' },
      ],
    },
    // 8
    {
      name: 'Phân Hữu Cơ Khoáng Phú Mỹ Humic+K',
      slug: 'phan-huu-co-khoang-phu-my-humic-k',
      sku: 'PM-HUMIC-K',
      shortDescription: 'Phối trộn Axit Humic đậm đặc nhập khẩu với Kali hữu cơ, giúp giải độc phèn mặn tức thì.',
      description: 'Kích thích ra rễ tơ cực mạnh, tăng độ ngọt (Brix) và mẫu mã bóng đẹp cho các loại trái cây xuất khẩu.',
      composition: 'Chất hữu cơ: 25%, Axit Humic: 12%, K2O: 8%, Fulvic: 3%',
      usageInstructions: 'Hòa nước tưới gốc: 1kg pha 400 lít nước tưới cho 20 - 30 gốc cây ăn trái.',
      storageInstructions: 'Bảo quản nơi khô ráo, đậy kín sau khi mở bao.',
      warningInformation: 'Có thể hòa tan cùng hệ thống tưới nhỏ giọt tự động.',
      manufacturer: 'Tổng công ty Phân bón và Hóa chất Dầu khí',
      origin: 'Việt Nam',
      brandId: brandPhuMy.id,
      categoryId: catHuuCo.id,
      price: 450000,
      compareAtPrice: 480000,
      status: ProductStatus.ACTIVE,
      featured: false,
      bestSeller: false,
      variants: [
        { sku: 'PM-HUMIC-K-10KG', unit: 'Túi', packageSize: '10kg', price: 450000, compareAtPrice: 480000 },
      ],
      attrs: [
        { attributeType: AgriculturalAttributeType.CROP, value: 'Sầu riêng', code: 'sau_rieng' },
        { attributeType: AgriculturalAttributeType.CROP, value: 'Cây ăn trái', code: 'cay_an_trai' },
        { attributeType: AgriculturalAttributeType.GROWTH_STAGE, value: 'Nuôi trái', code: 'nuoi_trai' },
        { attributeType: AgriculturalAttributeType.APPLICATION_METHOD, value: 'Tưới gốc', code: 'tuoi_goc' },
        { attributeType: AgriculturalAttributeType.NUTRIENT_TYPE, value: 'Hữu cơ khoáng', code: 'huu_co' },
      ],
    },
    // 9
    {
      name: 'Phân Bón Lá Đầu Trâu MK 501 Siêu Nảy Chồi Phát Đọt',
      slug: 'phan-bon-la-dau-trau-mk-501',
      sku: 'DT-MK-501',
      shortDescription: 'Dạng phân bón lá chuyên dùng thời kỳ cây non, sau cắt tỉa cành hoặc cần phục hồi tán lá.',
      description: 'Công thức NPK 30-10-10 hòa tan 100%, hấp thụ nhanh qua bề mặt lá, lá xanh dày, bóng mượt, bản lá to.',
      composition: 'Đạm: 30%, Lân: 10%, Kali: 10%, Fe: 50ppm, Mn: 50ppm, Zn: 100ppm',
      usageInstructions: 'Pha 20 - 30g cho bình 16 - 25 lít nước, phun ướt đều 2 mặt lá vào sáng sớm hoặc chiều mát.',
      storageInstructions: 'Để nơi thoáng gió, không để gần nguồn nhiệt.',
      warningInformation: 'Không phun khi trời sắp mưa to hoặc đang nắng gắt giữa trưa.',
      manufacturer: 'Công ty Cổ phần Phân bón Bình Điền',
      origin: 'Việt Nam',
      brandId: brandBinhDien.id,
      categoryId: catPhanLa.id,
      price: 65000,
      compareAtPrice: 75000,
      status: ProductStatus.ACTIVE,
      featured: false,
      bestSeller: true,
      variants: [
        { sku: 'DT-MK-501-500G', unit: 'Hũ', packageSize: '500g', price: 65000, compareAtPrice: 75000 },
        { sku: 'DT-MK-501-1KG', unit: 'Hũ', packageSize: '1kg', price: 120000, compareAtPrice: 135000 },
      ],
      attrs: [
        { attributeType: AgriculturalAttributeType.CROP, value: 'Cây ăn trái', code: 'cay_an_trai' },
        { attributeType: AgriculturalAttributeType.CROP, value: 'Rau màu', code: 'rau_mau' },
        { attributeType: AgriculturalAttributeType.GROWTH_STAGE, value: 'Kiến thiết cơ bản', code: 'kien_thiet' },
        { attributeType: AgriculturalAttributeType.APPLICATION_METHOD, value: 'Phun qua lá', code: 'phun_la' },
        { attributeType: AgriculturalAttributeType.NUTRIENT_TYPE, value: 'Phân bón lá NPK', code: 'phan_la' },
      ],
    },
    // 10
    {
      name: 'Phân Bón Lá Đầu Trâu MK 701 Kích Ra Hoa Đồng Loạt',
      slug: 'phan-bon-la-dau-trau-mk-701',
      sku: 'DT-MK-701',
      shortDescription: 'Hàm lượng Lân và Kali cao chuyên tạo mầm hoa, phân hóa mầm hoa mạnh mẽ, chống rụng hoa.',
      description: 'Công thức NPK 10-30-20 bổ sung Bo sữa giúp hạt phấn sống lâu, tăng tỷ lệ thụ phấn và đậu trái non.',
      composition: 'Đạm: 10%, Lân: 30%, Kali: 20%, Bo: 200ppm, Mg: 100ppm',
      usageInstructions: 'Pha 30g/bình 20 lít nước, phun 2 lần cách nhau 7 ngày trước thời điểm xiết nước làm bông.',
      storageInstructions: 'Nơi khô ráo, tránh ánh sáng trực xạ.',
      warningInformation: 'Mang kính và khẩu trang bảo hộ khi phun thuốc/phân bón qua lá.',
      manufacturer: 'Công ty Cổ phần Phân bón Bình Điền',
      origin: 'Việt Nam',
      brandId: brandBinhDien.id,
      categoryId: catPhanLa.id,
      price: 68000,
      compareAtPrice: 78000,
      status: ProductStatus.ACTIVE,
      featured: true,
      bestSeller: false,
      variants: [
        { sku: 'DT-MK-701-500G', unit: 'Hũ', packageSize: '500g', price: 68000, compareAtPrice: 78000 },
      ],
      attrs: [
        { attributeType: AgriculturalAttributeType.CROP, value: 'Sầu riêng', code: 'sau_rieng' },
        { attributeType: AgriculturalAttributeType.CROP, value: 'Cây ăn trái', code: 'cay_an_trai' },
        { attributeType: AgriculturalAttributeType.GROWTH_STAGE, value: 'Ra hoa', code: 'ra_hoa' },
        { attributeType: AgriculturalAttributeType.APPLICATION_METHOD, value: 'Phun qua lá', code: 'phun_la' },
        { attributeType: AgriculturalAttributeType.NUTRIENT_TYPE, value: 'Phân bón lá NPK', code: 'phan_la' },
      ],
    },
    // 11
    {
      name: 'Đầu Trâu MK 901 Dưỡng Trái Lớn Nhanh Đẹp Màu',
      slug: 'dau-trau-mk-901-duong-trai',
      sku: 'DT-MK-901',
      shortDescription: 'Công thức giàu Kali và vi lượng chống nứt da, méo trái, tăng hàm lượng đường và kéo dài bảo quản.',
      description: 'Dinh dưỡng NPK 15-20-25 kết hợp vi lượng chelate chuyên dùng nuôi trái lớn, cơm dày, múi vàng thơm ngát.',
      composition: 'Nts: 15%, P2O5: 20%, K2O: 25%, Canxi: 50ppm, Bo: 100ppm',
      usageInstructions: 'Pha 25g cho bình 20 lít nước, phun định kỳ 10 - 15 ngày/lần trong suốt giai đoạn nuôi trái.',
      storageInstructions: 'Để nơi râm mát, đậy chặt nắp sau khi múc dùng.',
      warningInformation: 'Không pha chung với các chế phẩm chứa đồng (Cu) nồng độ cao.',
      manufacturer: 'Công ty Cổ phần Phân bón Bình Điền',
      origin: 'Việt Nam',
      brandId: brandBinhDien.id,
      categoryId: catPhanLa.id,
      price: 70000,
      compareAtPrice: 80000,
      status: ProductStatus.ACTIVE,
      featured: false,
      bestSeller: true,
      variants: [
        { sku: 'DT-MK-901-500G', unit: 'Hũ', packageSize: '500g', price: 70000, compareAtPrice: 80000 },
      ],
      attrs: [
        { attributeType: AgriculturalAttributeType.CROP, value: 'Sầu riêng', code: 'sau_rieng' },
        { attributeType: AgriculturalAttributeType.CROP, value: 'Thanh long', code: 'thanh_long' },
        { attributeType: AgriculturalAttributeType.GROWTH_STAGE, value: 'Nuôi trái', code: 'nuoi_trai' },
        { attributeType: AgriculturalAttributeType.APPLICATION_METHOD, value: 'Phun qua lá', code: 'phun_la' },
        { attributeType: AgriculturalAttributeType.NUTRIENT_TYPE, value: 'Phân bón lá NPK', code: 'phan_la' },
      ],
    },
    // 12
    {
      name: 'Phân Bón Canxi Bo Kẽm Siêu Chống Rụng Trái Non',
      slug: 'phan-bon-canxi-bo-kem-chong-rung-trai',
      sku: 'PM-CABO-ZN',
      shortDescription: 'Bổ sung Canxi sinh học và Bo hữu cơ ngăn ngừa thối đít trái, nứt trái và teo trái non.',
      description: 'Sản phẩm dạng lỏng phân tử nano thẩm thấu siêu tốc qua thành tế bào, làm dai cuống hoa và cuống trái.',
      composition: 'Canxi (Ca): 12%, Bo (B): 25,000ppm, Kẽm (Zn): 1,000ppm',
      usageInstructions: 'Pha 250ml cho phuy 200 lít nước, phun khi hoa vừa nhú mắt cua và sau khi cánh hoa rụng 80%.',
      storageInstructions: 'Để nơi thoáng mát nhiệt độ phòng dưới 35 độ C.',
      warningInformation: 'Lắc đều chai trước khi rót ra đong.',
      manufacturer: 'Tổng công ty Phân bón và Hóa chất Dầu khí',
      origin: 'Việt Nam',
      brandId: brandPhuMy.id,
      categoryId: catTrungViLuong.id,
      price: 135000,
      compareAtPrice: 155000,
      status: ProductStatus.ACTIVE,
      featured: true,
      bestSeller: true,
      variants: [
        { sku: 'PM-CABO-500ML', unit: 'Chai', packageSize: '500ml', price: 135000, compareAtPrice: 155000 },
        { sku: 'PM-CABO-1L', unit: 'Chai', packageSize: '1 lít', price: 240000, compareAtPrice: 270000 },
      ],
      attrs: [
        { attributeType: AgriculturalAttributeType.CROP, value: 'Sầu riêng', code: 'sau_rieng' },
        { attributeType: AgriculturalAttributeType.CROP, value: 'Cây ăn trái', code: 'cay_an_trai' },
        { attributeType: AgriculturalAttributeType.GROWTH_STAGE, value: 'Ra hoa', code: 'ra_hoa' },
        { attributeType: AgriculturalAttributeType.APPLICATION_METHOD, value: 'Phun qua lá', code: 'phun_la' },
        { attributeType: AgriculturalAttributeType.NUTRIENT_TYPE, value: 'Trung vi lượng', code: 'trung_vi_luong' },
      ],
    },
    // 13
    {
      name: 'Vôi Cải Tạo Đất & Hạ Phèn Cà Mau Cal-Silic',
      slug: 'voi-cai-tao-dat-ha-phen-ca-mau-cal-silic',
      sku: 'CM-CAL-SILIC',
      shortDescription: 'Cung cấp Canxi và Silic hoạt tính trung hòa độ chua pH đất, giải phóng dinh dưỡng bị cố định.',
      description: 'Bột mịn tan nhanh trong đất phèn đồng bằng sông Cửu Long và đất đỏ bazan Tây Nguyên, ức chế nấm khuẩn gây bệnh rễ.',
      composition: 'CaO: 45%, SiO2 hữu hiệu: 25%, MgO: 5%',
      usageInstructions: 'Bón rải 500 - 1000 kg/ha vào đầu mùa mưa hoặc trước khi làm đất gieo sạ.',
      storageInstructions: 'Để nơi khô ráo tuyệt đối, tránh ẩm làm đông vón tảng.',
      warningInformation: 'Tránh để bột vôi dính vào mắt.',
      manufacturer: 'Công ty Cổ phần Phân bón Dầu khí Cà Mau',
      origin: 'Việt Nam',
      brandId: brandCaMau.id,
      categoryId: catTrungViLuong.id,
      price: 180000,
      compareAtPrice: 200000,
      status: ProductStatus.ACTIVE,
      featured: false,
      bestSeller: false,
      variants: [
        { sku: 'CM-CAL-SILIC-50KG', unit: 'Bao', packageSize: '50kg', price: 180000, compareAtPrice: 200000 },
      ],
      attrs: [
        { attributeType: AgriculturalAttributeType.CROP, value: 'Lúa', code: 'lua' },
        { attributeType: AgriculturalAttributeType.CROP, value: 'Cà phê', code: 'ca_phe' },
        { attributeType: AgriculturalAttributeType.GROWTH_STAGE, value: 'Kiến thiết cơ bản', code: 'kien_thiet' },
        { attributeType: AgriculturalAttributeType.APPLICATION_METHOD, value: 'Bón gốc', code: 'bon_goc' },
        { attributeType: AgriculturalAttributeType.NUTRIENT_TYPE, value: 'Trung vi lượng', code: 'trung_vi_luong' },
      ],
    },
    // 14
    {
      name: 'Kali Clorua Phú Mỹ (MOP 60% Đỏ Chuẩn Hạt)',
      slug: 'kali-clorua-phu-my-mop-60',
      sku: 'PM-KALI-MOP60',
      shortDescription: 'Nguồn Kali hàm lượng cao giúp vận chuyển tinh bột và đường về củ quả, hạt mẩy no tròn.',
      description: 'Nhập khẩu và đóng bao tiêu chuẩn công nghiệp bởi PVFCCo, hạt đỏ hồng đồng nhất, dễ phối trộn phân NPK.',
      composition: 'Kali hữu hiệu (K2Ohh): 60%, Độ ẩm: 1%',
      usageInstructions: 'Cây lúa: Bón đón đòng 40 - 60 kg/ha. Cây mía, bắp: Bón 80 - 120 kg/ha.',
      storageInstructions: 'Bảo quản nơi khô ráo, che phủ bạt kín.',
      warningInformation: 'Rửa tay sau khi dùng, tránh xa tầm tay trẻ nhỏ.',
      manufacturer: 'Tổng công ty Phân bón và Hóa chất Dầu khí',
      origin: 'Việt Nam',
      brandId: brandPhuMy.id,
      categoryId: catPhanDon.id,
      price: 690000,
      compareAtPrice: 740000,
      status: ProductStatus.ACTIVE,
      featured: false,
      bestSeller: true,
      variants: [
        { sku: 'PM-KALI-MOP-50KG', unit: 'Bao', packageSize: '50kg', price: 690000, compareAtPrice: 740000 },
      ],
      attrs: [
        { attributeType: AgriculturalAttributeType.CROP, value: 'Lúa', code: 'lua' },
        { attributeType: AgriculturalAttributeType.CROP, value: 'Mía', code: 'mia' },
        { attributeType: AgriculturalAttributeType.GROWTH_STAGE, value: 'Nuôi trái', code: 'nuoi_trai' },
        { attributeType: AgriculturalAttributeType.APPLICATION_METHOD, value: 'Bón gốc', code: 'bon_goc' },
        { attributeType: AgriculturalAttributeType.NUTRIENT_TYPE, value: 'Kali Đơn', code: 'kali' },
      ],
    },
    // 15
    {
      name: 'Phân Bón Lân Nung Chảy Ninh Bình Siêu Tan',
      slug: 'phan-bon-lan-nung-chay-ninh-binh',
      sku: 'NB-FMP-LAN',
      shortDescription: 'Phân lân nung chảy chứa nhiều Canxi, Magie không làm chua đất, kích rễ bén đất tức thì.',
      description: 'Thích hợp nhất cho vùng đất phèn chua, đất đồi dốc bạc màu, giúp rễ cây cứng cáp vượt qua khô hạn.',
      composition: 'P2O5 hữu hiệu: 16%, CaO: 30%, MgO: 15%, SiO2: 24%',
      usageInstructions: 'Bón lót đáy hố trồng hoặc rải mặt ruộng trước khi gieo cấy 300 - 500 kg/ha.',
      storageInstructions: 'Bảo quản trong kho có mái che, chống dột ướt.',
      warningInformation: 'Tránh hít phải bụi lân khi rải phân.',
      manufacturer: 'Công ty Cổ phần Phân bón Bình Điền phân phối',
      origin: 'Việt Nam',
      brandId: brandBinhDien.id,
      categoryId: catPhanDon.id,
      price: 290000,
      compareAtPrice: 320000,
      status: ProductStatus.ACTIVE,
      featured: false,
      bestSeller: false,
      variants: [
        { sku: 'NB-FMP-LAN-50KG', unit: 'Bao', packageSize: '50kg', price: 290000, compareAtPrice: 320000 },
      ],
      attrs: [
        { attributeType: AgriculturalAttributeType.CROP, value: 'Lúa', code: 'lua' },
        { attributeType: AgriculturalAttributeType.CROP, value: 'Cà phê', code: 'ca_phe' },
        { attributeType: AgriculturalAttributeType.GROWTH_STAGE, value: 'Kiến thiết cơ bản', code: 'kien_thiet' },
        { attributeType: AgriculturalAttributeType.APPLICATION_METHOD, value: 'Bón gốc', code: 'bon_goc' },
        { attributeType: AgriculturalAttributeType.NUTRIENT_TYPE, value: 'Lân Đơn', code: 'lan' },
      ],
    },
    // 16
    {
      name: 'Phân Bón NPK Cà Mau Polyphosphate 20-10-10+TE',
      slug: 'phan-bon-npk-ca-mau-polyphosphate-20-10-10',
      sku: 'CM-NPK-201010',
      shortDescription: 'Công nghệ Polyphosphate chuỗi dài bảo vệ phân tử lân không bị đất giữ chặt, hiệu suất sử dụng tăng 35%.',
      description: 'Tăng cường đạm và lân chuỗi dài kích rễ khỏe, chồi mập, phát triển thân lá vượt bậc cho rau ăn lá và cây chè.',
      composition: 'Nts: 20%, P2O5hh: 10%, K2Ohh: 10%, Bo: 50ppm, Zn: 100ppm',
      usageInstructions: 'Bón thúc cây rau màu 100 - 150 kg/ha sau gieo trồng 10 - 15 ngày.',
      storageInstructions: 'Nơi râm mát, khô ráo, đậy kín sau khi sử dụng.',
      warningInformation: 'Để xa tầm với của trẻ nhỏ.',
      manufacturer: 'Công ty Cổ phần Phân bón Dầu khí Cà Mau',
      origin: 'Việt Nam',
      brandId: brandCaMau.id,
      categoryId: catNPK.id,
      price: 740000,
      compareAtPrice: 790000,
      status: ProductStatus.ACTIVE,
      featured: true,
      bestSeller: false,
      variants: [
        { sku: 'CM-NPK-201010-50KG', unit: 'Bao', packageSize: '50kg', price: 740000, compareAtPrice: 790000 },
      ],
      attrs: [
        { attributeType: AgriculturalAttributeType.CROP, value: 'Rau màu', code: 'rau_mau' },
        { attributeType: AgriculturalAttributeType.CROP, value: 'Lúa', code: 'lua' },
        { attributeType: AgriculturalAttributeType.GROWTH_STAGE, value: 'Đẻ nhánh', code: 'de_nhanh' },
        { attributeType: AgriculturalAttributeType.APPLICATION_METHOD, value: 'Bón gốc', code: 'bon_goc' },
        { attributeType: AgriculturalAttributeType.NUTRIENT_TYPE, value: 'NPK Đa lượng', code: 'npk' },
      ],
    },
  ];

  for (const p of productsData) {
    const created = await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        shortDescription: p.shortDescription,
        description: p.description,
        composition: p.composition,
        usageInstructions: p.usageInstructions,
        storageInstructions: p.storageInstructions,
        warningInformation: p.warningInformation,
        manufacturer: p.manufacturer,
        origin: p.origin,
        brandId: p.brandId,
        categoryId: p.categoryId,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        status: p.status,
        featured: p.featured,
        bestSeller: p.bestSeller,
        variants: {
          create: p.variants.map((v) => ({
            sku: v.sku,
            unit: v.unit,
            packageSize: v.packageSize,
            price: v.price,
            compareAtPrice: v.compareAtPrice,
            status: VariantStatus.ACTIVE,
          })),
        },
        agriculturalAttrs: {
          create: p.attrs.map((a) => ({
            attributeType: a.attributeType,
            value: a.value,
            code: a.code,
          })),
        },
      },
    });
    console.log(` -> Đã tạo sản phẩm: ${created.name} (${created.sku})`);
  }

  console.log('--- [SEED] Hoàn tất nạp dữ liệu mẫu product_db thành công! ---');
}

main()
  .catch((e) => {
    console.error('[SEED ERROR]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
