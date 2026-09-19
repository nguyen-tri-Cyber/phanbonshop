import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MinioService, UploadedFileDto } from '../minio/minio.service.js';
import {
  CreateProductDto,
  UpdateProductDto,
  QueryProductsDto,
  CreateVariantDto,
  UpdateVariantDto,
  ReorderImagesDto,
} from './dto/product.dto.js';
import {
  Product,
  ProductVariant,
  ProductImage,
  ProductStatus,
  Prisma,
} from '../../generated/client/index.js';
import { slugify } from '../category/category.service.js';
import { createLogger } from '@phanbonshop/logger';

const logger = createLogger('product-service:product');

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
  ) {}

  async findAll(query: QueryProductsDto): Promise<PaginatedProducts> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    // Mặc định cho Public API: Không hiển thị sản phẩm ARCHIVED
    where.status = { not: ProductStatus.ARCHIVED };

    // Lọc theo Category (ID hoặc Slug)
    if (query.category) {
      where.OR = [
        { categoryId: query.category },
        { category: { slug: query.category } },
      ];
    }

    // Lọc theo Brand (ID hoặc Slug)
    if (query.brand) {
      if (where.OR) {
        where.AND = [
          {
            OR: [
              { brandId: query.brand },
              { brand: { slug: query.brand } },
            ],
          },
        ];
      } else {
        where.OR = [
          { brandId: query.brand },
          { brand: { slug: query.brand } },
        ];
      }
    }

    // Lọc theo khoảng giá
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {};
      if (query.minPrice !== undefined) {
        where.price.gte = new Prisma.Decimal(query.minPrice);
      }
      if (query.maxPrice !== undefined) {
        where.price.lte = new Prisma.Decimal(query.maxPrice);
      }
    }

    // Tìm kiếm từ khóa theo tên, SKU, mô tả ngắn
    if (query.keyword) {
      const keywordFilter: Prisma.ProductWhereInput = {
        OR: [
          { name: { contains: query.keyword } },
          { sku: { contains: query.keyword } },
          { shortDescription: { contains: query.keyword } },
        ],
      };

      if (where.AND && Array.isArray(where.AND)) {
        where.AND.push(keywordFilter);
      } else if (where.AND) {
        where.AND = [where.AND as Prisma.ProductWhereInput, keywordFilter];
      } else {
        where.AND = [keywordFilter];
      }
    }

    // Sản phẩm nổi bật / bán chạy
    if (query.featured !== undefined) {
      where.featured = query.featured;
    }
    if (query.bestSeller !== undefined) {
      where.bestSeller = query.bestSeller;
    }

    // Lọc theo thuộc tính nông nghiệp (Agricultural Attributes)
    const agriculturalFilters: Prisma.AgriculturalAttributeWhereInput[] = [];
    if (query.crop) {
      agriculturalFilters.push({
        attributeType: 'CROP',
        value: { contains: query.crop },
      });
    }
    if (query.growthStage) {
      agriculturalFilters.push({
        attributeType: 'GROWTH_STAGE',
        value: { contains: query.growthStage },
      });
    }
    if (query.applicationMethod) {
      agriculturalFilters.push({
        attributeType: 'APPLICATION_METHOD',
        value: { contains: query.applicationMethod },
      });
    }
    if (query.nutrientType) {
      agriculturalFilters.push({
        attributeType: 'NUTRIENT_TYPE',
        value: { contains: query.nutrientType },
      });
    }

    if (agriculturalFilters.length > 0) {
      where.agriculturalAttrs = {
        some: {
          OR: agriculturalFilters,
        },
      };
    }

    // Sắp xếp
    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
    if (query.sort === 'price_asc') {
      orderBy = { price: 'asc' };
    } else if (query.sort === 'price_desc') {
      orderBy = { price: 'desc' };
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
          brand: {
            select: { id: true, name: true, slug: true, logoUrl: true },
          },
          variants: {
            where: { status: 'ACTIVE' },
            orderBy: { price: 'asc' },
          },
          images: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          },
          agriculturalAttrs: true,
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findBySlug(slug: string): Promise<Product> {
    let product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        brand: true,
        variants: {
          orderBy: { price: 'asc' },
        },
        images: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        },
        agriculturalAttrs: true,
      },
    });

    if (!product) {
      // Thử tìm theo ID nếu slug là UUID
      product = await this.prisma.product.findUnique({
        where: { id: slug },
        include: {
          category: true,
          brand: true,
          variants: {
            orderBy: { price: 'asc' },
          },
          images: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          },
          agriculturalAttrs: true,
        },
      });
    }

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với slug/ID: ${slug}`);
    }

    return product;
  }

  async findById(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
        variants: true,
        images: true,
        agriculturalAttrs: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với ID: ${id}`);
    }

    return product;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const slug = dto.slug || slugify(dto.name);

    // Kiểm tra tính duy nhất của slug và SKU
    const [existingSlug, existingSku] = await Promise.all([
      this.prisma.product.findUnique({ where: { slug } }),
      this.prisma.product.findUnique({ where: { sku: dto.sku } }),
    ]);

    if (existingSlug) {
      throw new ConflictException(`Sản phẩm với slug "${slug}" đã tồn tại`);
    }
    if (existingSku) {
      throw new ConflictException(`Sản phẩm với mã SKU "${dto.sku}" đã tồn tại`);
    }

    // Xác thực danh mục và thương hiệu nếu được cung cấp
    if (dto.categoryId) {
      const cat = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!cat) throw new NotFoundException(`Không tìm thấy danh mục ID: ${dto.categoryId}`);
    }
    if (dto.brandId) {
      const brand = await this.prisma.brand.findUnique({ where: { id: dto.brandId } });
      if (!brand) throw new NotFoundException(`Không tìm thấy thương hiệu ID: ${dto.brandId}`);
    }

    const createdProduct = await this.prisma.product.create({
      data: {
        name: dto.name,
        slug,
        sku: dto.sku,
        shortDescription: dto.shortDescription,
        description: dto.description,
        composition: dto.composition,
        usageInstructions: dto.usageInstructions,
        storageInstructions: dto.storageInstructions,
        warningInformation: dto.warningInformation,
        manufacturer: dto.manufacturer,
        origin: dto.origin,
        brandId: dto.brandId,
        categoryId: dto.categoryId,
        price: new Prisma.Decimal(dto.price),
        compareAtPrice: dto.compareAtPrice ? new Prisma.Decimal(dto.compareAtPrice) : null,
        status: dto.status || ProductStatus.DRAFT,
        featured: dto.featured ?? false,
        bestSeller: dto.bestSeller ?? false,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        variants: dto.variants && dto.variants.length > 0
          ? {
              create: dto.variants.map((v) => ({
                sku: v.sku,
                unit: v.unit,
                packageSize: v.packageSize,
                price: new Prisma.Decimal(v.price),
                compareAtPrice: v.compareAtPrice ? new Prisma.Decimal(v.compareAtPrice) : null,
                status: v.status || 'ACTIVE',
              })),
            }
          : undefined,
        agriculturalAttrs: dto.agriculturalAttrs && dto.agriculturalAttrs.length > 0
          ? {
              create: dto.agriculturalAttrs.map((a) => ({
                attributeType: a.attributeType,
                value: a.value,
                code: a.code || slugify(a.value),
              })),
            }
          : undefined,
      },
      include: {
        category: true,
        brand: true,
        variants: true,
        agriculturalAttrs: true,
      },
    });

    logger.info(`Đã tạo mới sản phẩm: ${createdProduct.name} (${createdProduct.sku})`);
    return createdProduct;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    await this.findById(id);

    let slug = dto.slug;
    if (!slug && dto.name) {
      slug = slugify(dto.name);
    }

    if (slug) {
      const existing = await this.prisma.product.findUnique({ where: { slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Sản phẩm với slug "${slug}" đã tồn tại`);
      }
    }

    if (dto.sku) {
      const existingSku = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
      if (existingSku && existingSku.id !== id) {
        throw new ConflictException(`Sản phẩm với SKU "${dto.sku}" đã tồn tại`);
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        slug,
        sku: dto.sku,
        shortDescription: dto.shortDescription,
        description: dto.description,
        composition: dto.composition,
        usageInstructions: dto.usageInstructions,
        storageInstructions: dto.storageInstructions,
        warningInformation: dto.warningInformation,
        manufacturer: dto.manufacturer,
        origin: dto.origin,
        brandId: dto.brandId,
        categoryId: dto.categoryId,
        price: dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
        compareAtPrice: dto.compareAtPrice !== undefined ? new Prisma.Decimal(dto.compareAtPrice) : undefined,
        status: dto.status,
        featured: dto.featured,
        bestSeller: dto.bestSeller,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
      },
      include: {
        category: true,
        brand: true,
        variants: true,
        images: true,
        agriculturalAttrs: true,
      },
    });
  }

  async delete(id: string): Promise<{ message: string }> {
    const product = await this.findById(id);

    // Xóa toàn bộ ảnh liên quan trên MinIO
    if (product && 'images' in product && Array.isArray(product.images)) {
      for (const img of product.images) {
        await this.minioService.deleteFile(img.objectKey);
      }
    }

    await this.prisma.product.delete({ where: { id } });
    return { message: `Đã xóa sản phẩm ${id} thành công` };
  }

  // --- Quản lý Biến thể (Variants) ---
  async addVariant(productId: string, dto: CreateVariantDto): Promise<ProductVariant> {
    await this.findById(productId);

    const existingSku = await this.prisma.productVariant.findUnique({
      where: { sku: dto.sku },
    });
    if (existingSku) {
      throw new ConflictException(`Mã SKU biến thể "${dto.sku}" đã tồn tại`);
    }

    return this.prisma.productVariant.create({
      data: {
        productId,
        sku: dto.sku,
        unit: dto.unit,
        packageSize: dto.packageSize,
        price: new Prisma.Decimal(dto.price),
        compareAtPrice: dto.compareAtPrice ? new Prisma.Decimal(dto.compareAtPrice) : null,
        status: dto.status || 'ACTIVE',
      },
    });
  }

  async updateVariant(
    productId: string,
    variantId: string,
    dto: UpdateVariantDto,
  ): Promise<ProductVariant> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });

    if (!variant) {
      throw new NotFoundException(`Không tìm thấy biến thể ${variantId} thuộc sản phẩm ${productId}`);
    }

    if (dto.sku && dto.sku !== variant.sku) {
      const existingSku = await this.prisma.productVariant.findUnique({
        where: { sku: dto.sku },
      });
      if (existingSku) {
        throw new ConflictException(`Mã SKU biến thể "${dto.sku}" đã tồn tại`);
      }
    }

    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        sku: dto.sku,
        unit: dto.unit,
        packageSize: dto.packageSize,
        price: dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
        compareAtPrice: dto.compareAtPrice !== undefined ? new Prisma.Decimal(dto.compareAtPrice) : undefined,
        status: dto.status,
      },
    });

    if (dto.price !== undefined && Number(dto.price) !== Number(variant.price)) {
      try {
        await this.prisma.auditLog.create({
          data: {
            actorId: 'ADMIN',
            actorRole: 'ADMIN',
            action: 'PRICE_CHANGE',
            entityType: 'PRODUCT_VARIANT',
            entityId: variantId,
            oldValue: JSON.stringify({ price: Number(variant.price) }),
            newValue: JSON.stringify({ price: Number(dto.price) }),
          },
        });
      } catch {
        // Non-blocking audit log
      }
    }

    return updated;
  }

  async deleteVariant(productId: string, variantId: string): Promise<{ message: string }> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });

    if (!variant) {
      throw new NotFoundException(`Không tìm thấy biến thể ${variantId} thuộc sản phẩm ${productId}`);
    }

    await this.prisma.productVariant.delete({
      where: { id: variantId },
    });

    return { message: `Đã xóa biến thể ${variantId} thành công` };
  }

  // --- Quản lý Hình ảnh MinIO (Image Management) ---
  async uploadImage(
    productId: string,
    file: UploadedFileDto,
    altText?: string,
  ): Promise<ProductImage> {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn tệp tin hình ảnh');
    }

    // Kiểm tra mimeType hợp lệ
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Định dạng tệp không được hỗ trợ. Chỉ chấp nhận JPG, PNG, WEBP, GIF');
    }

    await this.findById(productId);

    // Upload lên MinIO
    const { objectKey, url } = await this.minioService.uploadFile(file, `products/${productId}`);

    // Kiểm tra xem đây có phải là ảnh đầu tiên hay không
    const count = await this.prisma.productImage.count({ where: { productId } });
    const isPrimary = count === 0;

    return this.prisma.productImage.create({
      data: {
        productId,
        objectKey,
        url,
        altText: altText || null,
        sortOrder: count,
        isPrimary,
      },
    });
  }

  async deleteImage(productId: string, imageId: string): Promise<{ message: string }> {
    // Validate ownership: đảm bảo ảnh tồn tại và thuộc về đúng productId
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });

    if (!image) {
      throw new NotFoundException(
        `Không tìm thấy hình ảnh ${imageId} thuộc sản phẩm ${productId} (Quyền sở hữu không hợp lệ)`,
      );
    }

    // Xóa object từ MinIO
    await this.minioService.deleteFile(image.objectKey);

    // Xóa record từ MySQL
    await this.prisma.productImage.delete({
      where: { id: imageId },
    });

    // Nếu ảnh vừa xóa là ảnh chính, tự động đặt ảnh tiếp theo làm ảnh chính
    if (image.isPrimary) {
      const nextImage = await this.prisma.productImage.findFirst({
        where: { productId },
        orderBy: { sortOrder: 'asc' },
      });
      if (nextImage) {
        await this.prisma.productImage.update({
          where: { id: nextImage.id },
          data: { isPrimary: true },
        });
      }
    }

    return { message: `Đã xóa hình ảnh ${imageId} thành công` };
  }

  async reorderImages(productId: string, dto: ReorderImagesDto): Promise<{ message: string }> {
    await this.findById(productId);

    for (const item of dto.imageOrders) {
      await this.prisma.productImage.updateMany({
        where: { id: item.id, productId },
        data: {
          sortOrder: item.sortOrder,
          isPrimary: item.isPrimary ?? false,
        },
      });
    }

    return { message: 'Đã cập nhật thứ tự hình ảnh thành công' };
  }
}
