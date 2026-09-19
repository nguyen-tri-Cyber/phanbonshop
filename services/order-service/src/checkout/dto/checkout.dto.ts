import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../../../generated/client/index.js';

export class CheckoutItemDto {
  @ApiProperty({ description: 'ID của variant phân bón cần mua' })
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @ApiProperty({ description: 'ID sản phẩm phân bón' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'Số lượng mua (1 - 99)', default: 1 })
  @IsNumber()
  @Min(1)
  @Max(99)
  quantity!: number;

  // Các trường client có thể gửi giả mạo/nhầm lẫn -> backend cho phép parse nhưng HOÀN TOÀN BỎ QUA
  @IsOptional()
  price?: unknown;

  @IsOptional()
  unitPrice?: unknown;

  @IsOptional()
  subtotal?: unknown;

  @IsOptional()
  total?: unknown;

  @IsOptional()
  totalAmount?: unknown;
}

export class CheckoutShippingAddressDto {
  @ApiProperty({ description: 'Họ và tên người nhận' })
  @IsString()
  @IsNotEmpty()
  recipientName!: string;

  @ApiProperty({ description: 'Số điện thoại nhận hàng' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ description: 'Mã tỉnh/thành phố' })
  @IsString()
  @IsNotEmpty()
  provinceCode!: string;

  @ApiProperty({ description: 'Tên tỉnh/thành phố snapshot' })
  @IsString()
  @IsNotEmpty()
  provinceName!: string;

  @ApiProperty({ description: 'Mã quận/huyện' })
  @IsString()
  @IsNotEmpty()
  districtCode!: string;

  @ApiProperty({ description: 'Tên quận/huyện snapshot' })
  @IsString()
  @IsNotEmpty()
  districtName!: string;

  @ApiProperty({ description: 'Mã phường/xã' })
  @IsString()
  @IsNotEmpty()
  wardCode!: string;

  @ApiProperty({ description: 'Tên phường/xã snapshot' })
  @IsString()
  @IsNotEmpty()
  wardName!: string;

  @ApiProperty({ description: 'Địa chỉ chi tiết (Thôn/Ấp/Xứ đồng/Số nhà)' })
  @IsString()
  @IsNotEmpty()
  addressLine!: string;
}

export class CheckoutDto {
  @ApiPropertyOptional({
    description: 'Danh sách mặt hàng cần mua (Nếu bỏ trống sẽ lấy từ giỏ hàng hiện tại)',
    type: [CheckoutItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items?: CheckoutItemDto[];

  @ApiPropertyOptional({ description: 'ID địa chỉ đã lưu của khách hàng' })
  @IsOptional()
  @IsString()
  addressId?: string;

  @ApiPropertyOptional({
    description: 'Thông tin địa chỉ giao hàng trực tiếp',
    type: CheckoutShippingAddressDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutShippingAddressDto)
  shippingAddress?: CheckoutShippingAddressDto;

  @ApiPropertyOptional({ description: 'Mã coupon giảm giá nếu có', example: 'PHANBON50K' })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    description: 'Phương thức thanh toán',
    default: PaymentMethod.COD,
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod = PaymentMethod.COD;

  @ApiPropertyOptional({ description: 'Ghi chú của khách hàng khi giao hàng' })
  @IsOptional()
  @IsString()
  customerNote?: string;

  // Các trường client có thể gửi giả mạo/nhầm lẫn -> backend cho phép parse nhưng HOÀN TOÀN BỎ QUA
  @IsOptional()
  price?: unknown;

  @IsOptional()
  subtotal?: unknown;

  @IsOptional()
  discount?: unknown;

  @IsOptional()
  shippingFee?: unknown;

  @IsOptional()
  total?: unknown;

  @IsOptional()
  totalAmount?: unknown;
}
