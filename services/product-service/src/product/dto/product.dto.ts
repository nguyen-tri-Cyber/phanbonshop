import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ProductStatus,
  VariantStatus,
  AgriculturalAttributeType,
} from '../../../generated/client/index.js';

export class AgriculturalAttributeInputDto {
  @ApiProperty({ enum: AgriculturalAttributeType })
  @IsEnum(AgriculturalAttributeType)
  attributeType!: AgriculturalAttributeType;

  @ApiProperty({ example: 'Sầu riêng' })
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiPropertyOptional({ example: 'sau_rieng' })
  @IsOptional()
  @IsString()
  code?: string;
}

export class CreateVariantDto {
  @ApiProperty({ example: 'NPK202015-50KG' })
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @ApiProperty({ example: 'Bao' })
  @IsString()
  @IsNotEmpty()
  unit!: string;

  @ApiProperty({ example: '50kg' })
  @IsString()
  @IsNotEmpty()
  packageSize!: string;

  @ApiProperty({ example: 850000 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ example: 920000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @ApiPropertyOptional({ enum: VariantStatus, default: VariantStatus.ACTIVE })
  @IsOptional()
  @IsEnum(VariantStatus)
  status?: VariantStatus;
}

export class UpdateVariantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  packageSize?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @ApiPropertyOptional({ enum: VariantStatus })
  @IsOptional()
  @IsEnum(VariantStatus)
  status?: VariantStatus;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Phân Bón NPK Đầu Trâu 20-20-15+TE' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'dau-trau-npk-20-20-15-te' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty({ example: 'DT-NPK-20-20-15' })
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @ApiPropertyOptional({ example: 'Cung cấp dinh dưỡng toàn diện cân đối đạm - lân - kali và vi lượng' })
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @ApiPropertyOptional({ example: 'Chi tiết mô tả sản phẩm...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'N: 20%, P2O5: 20%, K2O: 15%, Zn: 50ppm, B: 100ppm' })
  @IsOptional()
  @IsString()
  composition?: string;

  @ApiPropertyOptional({ example: 'Bón từ 150-250kg/ha vào thời kỳ đẻ nhánh và nuôi trái' })
  @IsOptional()
  @IsString()
  usageInstructions?: string;

  @ApiPropertyOptional({ example: 'Bảo quản nơi khô ráo thoáng mát, tránh ánh nắng trực tiếp' })
  @IsOptional()
  @IsString()
  storageInstructions?: string;

  @ApiPropertyOptional({ example: 'Để xa tầm tay trẻ em, rửa sạch tay sau khi bón' })
  @IsOptional()
  @IsString()
  warningInformation?: string;

  @ApiPropertyOptional({ example: 'Công ty Cổ phần Phân bón Bình Điền' })
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiPropertyOptional({ example: 'Việt Nam' })
  @IsOptional()
  @IsString()
  origin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ example: 850000 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ example: 920000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @ApiPropertyOptional({ enum: ProductStatus, default: ProductStatus.DRAFT })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  bestSeller?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoDescription?: string;

  @ApiPropertyOptional({ type: () => [CreateVariantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants?: CreateVariantDto[];

  @ApiPropertyOptional({ type: () => [AgriculturalAttributeInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgriculturalAttributeInputDto)
  agriculturalAttrs?: AgriculturalAttributeInputDto[];
}

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  composition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  usageInstructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storageInstructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warningInformation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  origin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  bestSeller?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoDescription?: string;

  @ApiPropertyOptional({ type: () => [AgriculturalAttributeInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgriculturalAttributeInputDto)
  agriculturalAttrs?: AgriculturalAttributeInputDto[];
}

export class QueryProductsDto {
  @ApiPropertyOptional({ description: 'Lọc theo slug hoặc id danh mục' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Lọc theo slug hoặc id thương hiệu' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ description: 'Giá tối thiểu' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Giá tối đa' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tên, mã SKU hoặc mô tả' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: 'Lọc sản phẩm nổi bật' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true || value === '1')
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ description: 'Lọc sản phẩm bán chạy' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true || value === '1')
  @IsBoolean()
  bestSeller?: boolean;

  @ApiPropertyOptional({ description: 'Lọc theo cây trồng (vd: lúa, sầu riêng, cà phê)' })
  @IsOptional()
  @IsString()
  crop?: string;

  @ApiPropertyOptional({ description: 'Lọc theo giai đoạn sinh trưởng (vd: kiến thiết, ra hoa, nuôi trái)' })
  @IsOptional()
  @IsString()
  growthStage?: string;

  @ApiPropertyOptional({ description: 'Lọc theo phương thức bón (vd: bón gốc, phun lá, tưới rễ)' })
  @IsOptional()
  @IsString()
  applicationMethod?: string;

  @ApiPropertyOptional({ description: 'Lọc theo loại dinh dưỡng (vd: NPK, hữu cơ, vi lượng)' })
  @IsOptional()
  @IsString()
  nutrientType?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Sắp xếp kết quả',
    enum: ['newest', 'price_asc', 'price_desc'],
    default: 'newest',
  })
  @IsOptional()
  @IsString()
  sort?: 'newest' | 'price_asc' | 'price_desc' = 'newest';
}

export class ImageOrderItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty()
  @IsNumber()
  sortOrder!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class ReorderImagesDto {
  @ApiProperty({ type: () => [ImageOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageOrderItemDto)
  imageOrders!: ImageOrderItemDto[];
}
