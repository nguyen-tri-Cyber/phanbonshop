import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ProductService, PaginatedProducts } from './product.service.js';
import { UploadedFileDto } from '../minio/minio.service.js';
import {
  CreateProductDto,
  UpdateProductDto,
  QueryProductsDto,
  CreateVariantDto,
  UpdateVariantDto,
  ReorderImagesDto,
} from './dto/product.dto.js';
import { Product, ProductVariant, ProductImage } from '../../generated/client/index.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@ApiTags('Products')
@Controller('api/v1/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // --- Public APIs ---
  @Get()
  @ApiOperation({
    summary: 'Tìm kiếm, lọc và phân trang danh sách sản phẩm phân bón',
    description:
      'Hỗ trợ lọc theo category, brand, minPrice, maxPrice, keyword, featured, bestSeller, thuộc tính nông nghiệp (crop, growthStage, applicationMethod, nutrientType) và sắp xếp (newest, price_asc, price_desc)',
  })
  async getProducts(@Query() query: QueryProductsDto): Promise<PaginatedProducts> {
    return this.productService.findAll(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết sản phẩm theo slug' })
  async getProductBySlug(@Param('slug') slug: string): Promise<Product> {
    return this.productService.findBySlug(slug);
  }

  // --- Admin APIs (Yêu cầu quyền ADMIN, MANAGER hoặc SUPER_ADMIN) ---
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Thêm mới sản phẩm phân bón' })
  @ApiResponse({ status: 201, description: 'Tạo sản phẩm thành công' })
  async createProduct(@Body() dto: CreateProductDto): Promise<Product> {
    return this.productService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Cập nhật thông tin sản phẩm' })
  async updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<Product> {
    return this.productService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Xóa sản phẩm' })
  async deleteProduct(@Param('id') id: string): Promise<{ message: string }> {
    return this.productService.delete(id);
  }

  // --- Variant APIs ---
  @Post(':productId/variants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Thêm biến thể quy cách đóng gói (bao/chai/can)' })
  async addVariant(
    @Param('productId') productId: string,
    @Body() dto: CreateVariantDto,
  ): Promise<ProductVariant> {
    return this.productService.addVariant(productId, dto);
  }

  @Put(':productId/variants/:variantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Cập nhật biến thể' })
  async updateVariant(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ): Promise<ProductVariant> {
    return this.productService.updateVariant(productId, variantId, dto);
  }

  @Delete(':productId/variants/:variantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Xóa biến thể' })
  async deleteVariant(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
  ): Promise<{ message: string }> {
    return this.productService.deleteVariant(productId, variantId);
  }

  // --- Image APIs (MinIO Object Storage) ---
  @Post(':productId/images/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '[Admin] Tải ảnh sản phẩm lên MinIO Object Storage' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        altText: {
          type: 'string',
          nullable: true,
        },
      },
    },
  })
  async uploadImage(
    @Param('productId') productId: string,
    @UploadedFile() file: UploadedFileDto,
    @Body('altText') altText?: string,
  ): Promise<ProductImage> {
    return this.productService.uploadImage(productId, file, altText);
  }

  @Delete(':productId/images/:imageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[Admin] Xóa ảnh sản phẩm khỏi MinIO & Database',
    description: 'Xác thực chặt chẽ quyền sở hữu (ownership validation) giữa productId và imageId',
  })
  async deleteImage(
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ): Promise<{ message: string }> {
    return this.productService.deleteImage(productId, imageId);
  }

  @Patch(':productId/images/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Sắp xếp thứ tự hiển thị và đặt ảnh chính' })
  async reorderImages(
    @Param('productId') productId: string,
    @Body() dto: ReorderImagesDto,
  ): Promise<{ message: string }> {
    return this.productService.reorderImages(productId, dto);
  }
}
