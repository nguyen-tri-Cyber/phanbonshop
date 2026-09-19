import { Controller, Get, Post, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { OrdersService } from './orders.service.js';
import { CompensationService } from '../compensation/compensation.service.js';
import { InternalSecretGuard } from '../auth/guards/internal-secret.guard.js';
import {
  CompensationTaskStatus,
  CompensationTaskType,
} from '../../generated/client/index.js';

@ApiTags('Internal Orders Verification')
@Controller('internal/v1/orders')
@UseGuards(InternalSecretGuard)
@ApiHeader({ name: 'X-Internal-Secret', required: true })
export class InternalOrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly compensationService: CompensationService,
  ) {}

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

  @Get('customer-summary/:customerId')
  @ApiOperation({
    summary: '[Internal] Lấy tóm tắt số đơn và tổng chi tiêu của khách hàng qua Service Mesh',
  })
  async getCustomerSummary(@Param('customerId') customerId: string) {
    return this.ordersService.getCustomerOrderSummary(customerId);
  }

  @Get('compensation-tasks')
  @ApiOperation({
    summary: '[Internal] Giám sát danh sách Compensation Tasks (PENDING / PROCESSING / COMPLETED / FAILED)',
  })
  async getCompensationTasks(
    @Query('status') status?: CompensationTaskStatus,
    @Query('type') type?: CompensationTaskType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.compensationService.getTasks({
      status,
      type,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Post('compensation-tasks/process')
  @ApiOperation({
    summary: '[Internal] Kích hoạt worker xử lý các Compensation Tasks đang chờ (PENDING)',
  })
  async triggerProcessTasks(@Query('limit') limit?: string) {
    return this.compensationService.processPendingTasks(
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
