import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { CustomerService } from './customer.service.js';
import { SyncCustomerProfileDto } from './dto/customer.dto.js';
import { CustomerProfile, Address } from '../../generated/client/index.js';
import { InternalSecretGuard } from '../auth/guards/internal-secret.guard.js';

@ApiTags('Customer (Internal)')
@Controller('internal/v1/customers')
@UseGuards(InternalSecretGuard)
@ApiHeader({
  name: 'X-Internal-Secret',
  description: 'Mã bí mật xác thực giao tiếp dịch vụ nội bộ',
  required: true,
})
export class CustomerInternalController {
  constructor(private readonly customerService: CustomerService) {}

  @Post('sync')
  @ApiOperation({ summary: '[Internal] Đồng bộ hồ sơ từ auth-service bảo vệ bởi InternalSecretGuard' })
  @ApiResponse({ status: 200, description: 'Đồng bộ hồ sơ thành công' })
  @ApiResponse({ status: 403, description: 'Từ chối truy cập do thiếu hoặc sai secret nội bộ' })
  async syncProfile(@Body() dto: SyncCustomerProfileDto): Promise<CustomerProfile> {
    return this.customerService.syncProfile(dto);
  }

  @Get(':userId/addresses/:addressId')
  @ApiOperation({ summary: '[Internal] Tra cứu địa chỉ giao hàng của khách hàng phục vụ checkout (chống IDOR)' })
  @ApiResponse({ status: 200, description: 'Thông tin địa chỉ giao hàng' })
  @ApiResponse({ status: 403, description: 'Từ chối truy cập do thiếu hoặc sai secret nội bộ' })
  @ApiResponse({ status: 404, description: 'Địa chỉ không tồn tại hoặc không thuộc sở hữu của user' })
  async getCustomerAddress(
    @Param('userId') userId: string,
    @Param('addressId') addressId: string,
  ): Promise<Address> {
    const address = await this.customerService.getAddressForCustomer(userId, addressId);
    if (!address) {
      throw new NotFoundException('Không tìm thấy địa chỉ giao hàng hợp lệ cho khách hàng này');
    }
    return address;
  }
}
