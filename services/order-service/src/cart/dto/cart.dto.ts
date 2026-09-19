import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AddCartItemDto {
  @ApiProperty({ description: 'ID của variant phân bón' })
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @ApiProperty({ description: 'ID của sản phẩm' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'Tên sản phẩm snapshot' })
  @IsString()
  @IsNotEmpty()
  productName!: string;

  @ApiProperty({ description: 'Slug sản phẩm' })
  @IsString()
  @IsNotEmpty()
  productSlug!: string;

  @ApiProperty({ description: 'Mã SKU snapshot' })
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @ApiProperty({ description: 'Quy cách đóng gói snapshot' })
  @IsString()
  @IsNotEmpty()
  packageSize!: string;

  @ApiProperty({ description: 'Đơn giá snapshot (VNĐ)', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitPrice?: number;

  @ApiProperty({ description: 'Đơn giá snapshot (VNĐ) alias', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiProperty({ description: 'URL ảnh sản phẩm snapshot', required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ description: 'Số lượng mua (1 - 99)', default: 1 })
  @IsNumber()
  @Min(1)
  @Max(99)
  quantity: number = 1;
}

export class UpdateCartQuantityDto {
  @ApiProperty({ description: 'Số lượng mới (0 để xóa, tối đa 99)' })
  @IsNumber()
  @Min(0)
  @Max(99)
  quantity!: number;
}

export class ChangeVariantDto {
  @ApiProperty({ description: 'ID của variant mới cần đổi sang' })
  @IsString()
  @IsNotEmpty()
  newVariantId!: string;

  @ApiProperty({ description: 'Mã SKU của variant mới' })
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @ApiProperty({ description: 'Quy cách của variant mới' })
  @IsString()
  @IsNotEmpty()
  packageSize!: string;

  @ApiProperty({ description: 'Đơn giá của variant mới (VNĐ)', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitPrice?: number;

  @ApiProperty({ description: 'Đơn giá của variant mới (VNĐ) alias', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiProperty({ description: 'Ảnh mới snapshot', required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;
}

export class MergeCartDto {
  @ApiProperty({ description: 'Danh sách các mục từ giỏ hàng guest', type: [AddCartItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddCartItemDto)
  items!: AddCartItemDto[];
}
