import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReserveInventoryDto {
  @ApiProperty({ description: 'Mã định danh duy nhất của lượt tạm giữ (Idempotency Key)', example: 'order-123-variant-456' })
  @IsString()
  @IsNotEmpty()
  reservationId!: string;

  @ApiProperty({ description: 'ID sản phẩm', example: 'prod-001' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'ID biến thể sản phẩm cần tạm giữ tồn kho', example: 'var-001' })
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @ApiProperty({ description: 'Số lượng cần tạm giữ', example: 2 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ description: 'Loại tham chiếu (ORDER, CART, MANUAL)', example: 'ORDER' })
  @IsString()
  @IsNotEmpty()
  referenceType!: string;

  @ApiProperty({ description: 'Mã tham chiếu nghiệp vụ (mã đơn hàng / mã giỏ hàng)', example: 'ORD-2026-001' })
  @IsString()
  @IsNotEmpty()
  referenceId!: string;

  @ApiPropertyOptional({ description: 'Thời gian tạm giữ tính theo phút (Mặc định 15 phút)', default: 15 })
  @IsOptional()
  @IsInt()
  @Min(1)
  ttlMinutes?: number = 15;
}

export class ReleaseInventoryDto {
  @ApiProperty({ description: 'Mã lượt tạm giữ cần giải phóng', example: 'order-123-variant-456' })
  @IsString()
  @IsNotEmpty()
  reservationId!: string;

  @ApiPropertyOptional({ description: 'Lý do giải phóng tồn kho', example: 'Khách hàng hủy thanh toán' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Tự động hoàn tồn kho nếu reservation đã COMMITTED', default: true })
  @IsOptional()
  allowRollback?: boolean;
}

export class RollbackInventoryDto {
  @ApiProperty({ description: 'Mã lượt tạm giữ cần hoàn tồn kho (dành cho đơn đã COMMITTED hoặc ACTIVE)', example: 'order-123-variant-456' })
  @IsString()
  @IsNotEmpty()
  reservationId!: string;

  @ApiPropertyOptional({ description: 'Lý do hủy đơn / hoàn tồn kho', example: 'Khách hàng hủy đơn hàng đã xác nhận' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CommitInventoryDto {
  @ApiProperty({ description: 'Mã lượt tạm giữ cần xuất kho hoàn tất thanh toán', example: 'order-123-variant-456' })
  @IsString()
  @IsNotEmpty()
  reservationId!: string;

  @ApiPropertyOptional({ description: 'Mã tham chiếu đơn hàng xuất kho', example: 'ORD-2026-001' })
  @IsOptional()
  @IsString()
  referenceId?: string;
}

export class AdjustInventoryDto {
  @ApiProperty({ description: 'ID sản phẩm', example: 'prod-001' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'ID biến thể cần điều chỉnh', example: 'var-001' })
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @ApiProperty({ description: 'Số lượng điều chỉnh (Dương: nhập thêm, Âm: kiểm kê giảm / hao hụt)', example: 10 })
  @IsInt()
  quantityChange!: number;

  @ApiProperty({ description: 'Lý do bắt buộc điều chỉnh kho', example: 'Nhập hàng từ nhà máy Bình Điền' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional({ description: 'Loại chứng từ (PURCHASE, INVENTORY_AUDIT, DAMAGED)', example: 'PURCHASE' })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({ description: 'Mã phiếu nhập / biên bản kiểm kê', example: 'PN-2026-001' })
  @IsOptional()
  @IsString()
  referenceId?: string;
}

export class InitInventoryDto {
  @ApiProperty({ example: 'prod-001' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ example: 'var-001' })
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @ApiProperty({ example: 50 })
  @IsInt()
  @Min(0)
  stockQuantity!: number;

  @ApiPropertyOptional({ example: 5, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number = 5;

  @ApiPropertyOptional({ example: 'Khởi tạo số dư đầu kỳ' })
  @IsOptional()
  @IsString()
  reason?: string;
}
