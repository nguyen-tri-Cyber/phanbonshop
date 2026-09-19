import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { OrdersService } from './orders.service.js';
import { InternalSecretGuard } from '../auth/guards/internal-secret.guard.js';

@ApiTags('Internal Orders Verification')
@Controller('internal/v1/orders')
@UseGuards(InternalSecretGuard)
@ApiHeader({ name: 'X-Internal-Secret', required: true })
export class InternalOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('verify-purchase')
  @ApiOperation({
    summary: '[Internal] Xác thực khách hàng đã mua sản phẩm trong đơn hoàn tất (COMPLETED)',
  })
  async verifyPurchase(
    @Query('customerId') customerId: string,
    @Query('productId') productId: string,
    @Query('orderItemId') orderItemId?: string,
  ) {
    return this.ordersService.verifyCustomerPurchase({
      customerId,
      productId,
      orderItemId,
    });
  }
}
