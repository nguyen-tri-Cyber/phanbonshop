import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '../../../generated/client/index.js';

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus, description: 'Trạng thái đơn hàng mới' })
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status!: OrderStatus;

  @ApiPropertyOptional({ description: 'Ghi chú lý do chuyển trạng thái' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CancelOrderDto {
  @ApiPropertyOptional({ description: 'Lý do hủy đơn hàng', example: 'Đổi ý không mua nữa' })
  @IsOptional()
  @IsString()
  reason?: string;
}
