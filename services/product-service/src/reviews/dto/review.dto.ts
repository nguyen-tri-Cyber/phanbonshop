import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewStatus } from '../../../generated/client/index.js';

export class CreateReviewDto {
  @ApiProperty({ description: 'ID sản phẩm đánh giá' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'Điểm đánh giá sao từ 1 đến 5', minimum: 1, maximum: 5, example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ description: 'Nội dung nhận xét về sản phẩm', example: 'Phân bón rất tốt, lúa bén rễ nhanh' })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ description: 'Mã orderItem liên quan nếu đánh giá từ đơn hàng' })
  @IsOptional()
  @IsString()
  orderItemId?: string;

  // Cố ý không cho phép client gán verifiedPurchase! Backend hoàn toàn tự xác thực.
}

export class UpdateReviewStatusDto {
  @ApiProperty({ enum: ReviewStatus, example: ReviewStatus.APPROVED })
  @IsEnum(ReviewStatus)
  status!: ReviewStatus;
}
