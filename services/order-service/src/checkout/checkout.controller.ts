import { Controller, Post, Body, Headers, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { CheckoutService } from './checkout.service.js';
import { CheckoutDto } from './dto/checkout.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@ApiTags('Checkout (Đặt Hàng & Thanh Toán)')
@Controller('api/v1/checkout')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  @ApiOperation({
    summary: 'Tiến hành đặt hàng và thanh toán (Saga Transaction + Idempotent)',
    description:
      'Thực thi chuỗi Saga phân tán: kiểm tra Idempotency -> lấy giá niêm yết -> tính toán -> tạm giữ kho -> tạo đơn hàng -> tạo bản ghi thanh toán. Hỗ trợ bồi hoàn giải phóng kho nếu có lỗi.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Khóa chống tạo đơn trùng lặp (khuyên dùng UUID)',
    required: false,
  })
  async checkout(
    @Body() dto: CheckoutDto,
    @CurrentUser('userId') customerId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('Idempotency-Key') idempotencyKeyAlt?: string,
  ) {
    const effectiveKey = idempotencyKey || idempotencyKeyAlt;
    return this.checkoutService.processCheckout(customerId, dto, effectiveKey);
  }
}
