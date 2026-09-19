import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OrdersService } from './orders.service.js';
import { UpdateOrderStatusDto, CancelOrderDto } from './dto/order.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { OrderStatus, PaymentStatus } from '../../generated/client/index.js';

@ApiTags('Orders (Đơn Hàng Phân Bón)')
@Controller('api/v1/orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // =========================================================================
  // 1. ADMIN APIS (Bảo vệ bởi RolesGuard: STAFF, MANAGER, ADMIN, SUPER_ADMIN)
  // =========================================================================
  @Get('admin/dashboard')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'SUPER_ADMIN')
  @ApiOperation({ summary: '[Admin] Thống kê dashboard chỉ số thực tế (Doanh thu, số đơn, AOV, tồn thấp)' })
  async getAdminDashboardStats() {
    return this.ordersService.getAdminDashboardStats();
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'SUPER_ADMIN')
  @ApiOperation({ summary: '[Admin] Danh sách đơn hàng toàn sàn kèm phân trang & bộ lọc' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  @ApiQuery({ name: 'paymentStatus', required: false, enum: PaymentStatus })
  async getAdminOrders(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: OrderStatus,
    @Query('paymentStatus') paymentStatus?: PaymentStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.ordersService.getAdminOrders({
      page,
      limit,
      search,
      status,
      paymentStatus,
      startDate,
      endDate,
    });
  }

  @Get('admin/customer-summary/:customerId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'SUPER_ADMIN')
  @ApiOperation({ summary: '[Admin] Thống kê lịch sử đơn và tổng chi tiêu của khách hàng' })
  async getCustomerSummary(@Param('customerId') customerId: string) {
    return this.ordersService.getCustomerOrderSummary(customerId);
  }

  @Get('admin/:idOrNumber')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'SUPER_ADMIN')
  @ApiOperation({ summary: '[Admin] Xem chi tiết bất kỳ đơn hàng nào' })
  async getAdminOrderDetail(@Param('idOrNumber') idOrNumber: string) {
    return this.ordersService.getAdminOrderDetail(idOrNumber);
  }

  // =========================================================================
  // 2. CUSTOMER & SHARED APIS
  // =========================================================================
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách đơn hàng của khách hàng đang đăng nhập' })
  async getMyOrders(@CurrentUser('userId') customerId: string) {
    return this.ordersService.findCustomerOrders(customerId);
  }

  @Get(':idOrNumber')
  @ApiOperation({ summary: 'Xem chi tiết đơn hàng theo ID hoặc OrderNumber' })
  async getOrderDetail(
    @Param('idOrNumber') idOrNumber: string,
    @CurrentUser('userId') customerId: string,
  ) {
    return this.ordersService.findOrderByIdOrNumber(idOrNumber, customerId);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Khách hàng hủy đơn hàng (khi đang PENDING/CONFIRMED)' })
  async cancelOrder(
    @Param('id') id: string,
    @CurrentUser('userId') customerId: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrder(id, customerId, dto.reason);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'SUPER_ADMIN')
  @ApiOperation({ summary: '[Admin/Staff] Cập nhật trạng thái đơn hàng (tuân thủ State Machine)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser('email') userEmail: string,
  ) {
    return this.ordersService.updateStatus(id, dto.status, userEmail, dto.note);
  }

  @Patch('admin/:id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'SUPER_ADMIN')
  @ApiOperation({ summary: '[Admin/Staff] Cập nhật trạng thái đơn hàng alias' })
  async updateStatusAdmin(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser('email') userEmail: string,
  ) {
    return this.ordersService.updateStatus(id, dto.status, userEmail, dto.note);
  }
}
