import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service.js';
import { ConfirmPaymentDto } from './dto/payment.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';
import { PaymentMethod } from '../../generated/client/index.js';

@ApiTags('Payments (Thanh Toán)')
@Controller('api/v1/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('settings/bank-transfer')
  @ApiOperation({
    summary: 'Lấy thông tin tài khoản ngân hàng thụ hưởng chính thức của sàn (VietQR)',
  })
  async getBankTransferSettings() {
    return this.paymentsService.getBankTransferSettings();
  }

  @Get('settings/momo')
  @ApiOperation({
    summary: 'Lấy thông tin cấu hình cổng thanh toán MoMo Sandbox',
  })
  async getMomoSettings() {
    return this.paymentsService.getMomoSettings();
  }

  @Get('orders/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin thanh toán của một đơn hàng' })
  async getOrderPayment(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.getPaymentByOrderId(orderId, user);
  }

  @Get('orders/:orderId/transactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy lịch sử tất cả các lần thử thanh toán của đơn hàng' })
  async getOrderTransactions(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.getOrderTransactions(orderId, user);
  }

  @Post('orders/:orderId/retry')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Khách hàng tạo phiên thanh toán mới khi lần trước thất bại hoặc đổi phương thức' })
  async retryPayment(
    @Param('orderId') orderId: string,
    @Body('method') method: PaymentMethod,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.createPaymentAttempt(orderId, method, user);
  }

  @Post('webhook/:provider')
  @ApiOperation({
    summary: 'Điểm tiếp nhận Webhook / IPN thanh toán từ các cổng (VietQR, MoMo, VNPay)',
    description: 'Endpoint công khai không qua JWT để các cổng đối tác gọi thông báo trạng thái thanh toán.',
  })
  async handleWebhook(
    @Param('provider') provider: string,
    @Headers() headers: Record<string, string>,
    @Body() body: unknown,
  ) {
    return this.paymentsService.handlePaymentWebhook(provider, headers, body);
  }

  @Post('momo/ipn')
  @ApiOperation({
    summary: 'Điểm tiếp nhận IPN Webhook chính thức từ MoMo Payment Gateway',
    description: 'Endpoint công khai tiếp nhận thông báo kết quả giao dịch tức thời từ MoMo.',
  })
  async handleMomoIpn(
    @Headers() headers: Record<string, string>,
    @Body() body: unknown,
  ) {
    return this.paymentsService.handlePaymentWebhook('MOMO', headers, body);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xem chi tiết một giao dịch thanh toán' })
  async getPaymentDetail(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.getPaymentById(id, user);
  }

  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[Admin/Manager/Staff] Xác nhận thanh toán thủ công (Role Guard + Audit)',
    description:
      'Chỉ nhân viên/quản trị viên mới có quyền xác nhận. Khách hàng gọi vào sẽ nhận mã lỗi 403 Forbidden.',
  })
  async confirmPayment(
    @Param('id') id: string,
    @Body() dto: ConfirmPaymentDto,
    @CurrentUser('email') userEmail: string,
    @CurrentUser('role') userRole: string,
  ) {
    return this.paymentsService.confirmPayment(id, userEmail, userRole, dto);
  }
}
