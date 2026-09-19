import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CouponType } from '../../../generated/client/index.js';

export class ValidateCouponDto {
  @ApiProperty({ description: 'Mã giảm giá', example: 'PHANBON50K' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'Tạm tính giỏ hàng để kiểm tra điều kiện', example: 500000 })
  @IsNumber()
  @Min(0)
  subtotal!: number;
}

export class CreateCouponDto {
  @ApiProperty({ description: 'Mã coupon viết hoa', example: 'GIAM10' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiPropertyOptional({ description: 'Mô tả coupon', example: 'Giảm 10% tối đa 50k cho đơn từ 200k' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: CouponType, example: CouponType.PERCENTAGE })
  @IsEnum(CouponType)
  type!: CouponType;

  @ApiProperty({ description: 'Mức giảm giá (% hoặc số tiền VND)', example: 10 })
  @IsNumber()
  @Min(0)
  value!: number;

  @ApiPropertyOptional({ description: 'Giá trị đơn tối thiểu (VND)', example: 200000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @ApiPropertyOptional({ description: 'Mức giảm tối đa với phần trăm (VND)', example: 50000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscountAmount?: number;

  @ApiPropertyOptional({ description: 'Thời điểm bắt đầu áp dụng' })
  @IsOptional()
  startDate?: string | Date;

  @ApiPropertyOptional({ description: 'Thời điểm kết thúc áp dụng' })
  @IsOptional()
  endDate?: string | Date;

  @ApiPropertyOptional({ description: 'Tổng số lượt sử dụng tối đa', example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional({ description: 'Số lượt sử dụng tối đa mỗi khách hàng', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  usagePerCustomer?: number;

  @ApiPropertyOptional({ description: 'Trạng thái kích hoạt', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Danh mục áp dụng (JSON string hoặc phân tách dấu phẩy)' })
  @IsOptional()
  @IsString()
  applicableCategories?: string;

  @ApiPropertyOptional({ description: 'Sản phẩm áp dụng (JSON string hoặc phân tách dấu phẩy)' })
  @IsOptional()
  @IsString()
  applicableProducts?: string;
}

export class UpdateCouponDto {
  @ApiPropertyOptional({ description: 'Mã coupon' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Mô tả coupon' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: CouponType })
  @IsOptional()
  @IsEnum(CouponType)
  type?: CouponType;

  @ApiPropertyOptional({ description: 'Mức giảm giá' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @ApiPropertyOptional({ description: 'Giá trị đơn tối thiểu' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @ApiPropertyOptional({ description: 'Mức giảm tối đa' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscountAmount?: number;

  @ApiPropertyOptional({ description: 'Thời điểm bắt đầu' })
  @IsOptional()
  startDate?: string | Date;

  @ApiPropertyOptional({ description: 'Thời điểm kết thúc' })
  @IsOptional()
  endDate?: string | Date;

  @ApiPropertyOptional({ description: 'Tổng số lượt dùng tối đa' })
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional({ description: 'Số lượt dùng tối đa mỗi khách' })
  @IsOptional()
  @IsInt()
  @Min(1)
  usagePerCustomer?: number;

  @ApiPropertyOptional({ description: 'Trạng thái kích hoạt' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Danh mục áp dụng' })
  @IsOptional()
  @IsString()
  applicableCategories?: string;

  @ApiPropertyOptional({ description: 'Sản phẩm áp dụng' })
  @IsOptional()
  @IsString()
  applicableProducts?: string;
}

export type CreateCouponInput = Partial<CreateCouponDto> & {
  code?: string;
  type?: CouponType;
  discountType?: CouponType;
  value?: number;
  discountValue?: number;
  minOrderAmount?: number;
  minimumOrder?: number;
  minOrderValue?: number;
  maxDiscountAmount?: number;
  maximumDiscount?: number;
  startDate?: string | Date;
  startAt?: string | Date;
  endDate?: string | Date;
  endAt?: string | Date;
  usageLimit?: number;
  usagePerCustomer?: number;
  enabled?: boolean;
  applicableCategories?: string[] | string;
  applicableProducts?: string[] | string;
  description?: string;
};

export type UpdateCouponInput = Partial<UpdateCouponDto> & {
  code?: string;
  type?: CouponType;
  discountType?: CouponType;
  value?: number;
  discountValue?: number;
  minOrderAmount?: number;
  minimumOrder?: number;
  minOrderValue?: number;
  maxDiscountAmount?: number;
  maximumDiscount?: number;
  startDate?: string | Date;
  startAt?: string | Date;
  endDate?: string | Date;
  endAt?: string | Date;
  usageLimit?: number;
  usagePerCustomer?: number;
  enabled?: boolean;
  applicableCategories?: string[] | string;
  applicableProducts?: string[] | string;
  description?: string;
};
