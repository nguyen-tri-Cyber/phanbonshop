import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service.js';
import { ConfirmPaymentDto } from './dto/payment.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

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

  @Get('orders/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin thanh toán của một đơn hàng' })
  async getOrderPayment(@Param('orderId') orderId: string) {
    return this.paymentsService.getPaymentByOrderId(orderId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xem chi tiết một giao dịch thanh toán' })
  async getPaymentDetail(@Param('id') id: string) {
    return this.paymentsService.getPaymentById(id);
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
