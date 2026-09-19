import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmPaymentDto {
  @ApiPropertyOptional({
    description: 'Số tiền thực nhận (Nếu truyền vào phải khớp chính xác với tổng đơn)',
    example: 1480000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Mã tham chiếu giao dịch ngân hàng / biên lai',
    example: 'FT2626291901234',
  })
  @IsOptional()
  @IsString()
  transactionReference?: string;

  @ApiPropertyOptional({
    description: 'Ghi chú của kế toán / admin khi xác nhận',
    example: 'Đã nhận đủ tiền từ tài khoản Vietcombank',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
