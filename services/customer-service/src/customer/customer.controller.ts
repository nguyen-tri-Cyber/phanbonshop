import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CustomerService } from './customer.service.js';
import {
  CreateAddressDto,
  UpdateProfileDto,
  UpdateAddressDto,
} from './dto/customer.dto.js';
import { CustomerProfile, Address } from '../../generated/client/index.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../auth/decorators/current-user.decorator.js';

@ApiTags('Customer')
@Controller('api/v1/customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  // =========================================================================
  // 1. ADMIN APIS (Roles: STAFF, MANAGER, ADMIN, SUPER_ADMIN)
  // =========================================================================
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Lấy danh sách khách hàng toàn sàn kèm thông tin tổng hợp' })
  async getAdminCustomers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.customerService.getAdminCustomers({ page, limit, search });
  }

  @Get('admin/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Xem chi tiết hồ sơ, sổ địa chỉ và lịch sử mua hàng của khách' })
  async getAdminCustomerDetail(@Param('userId') userId: string) {
    return this.customerService.getAdminCustomerDetail(userId);
  }

  // =========================================================================
  // 2. Dữ liệu hành chính Tỉnh / Thành / Quận / Huyện / Phường / Xã Việt Nam (Public)
  // =========================================================================
  @Get('divisions')
  @ApiOperation({ summary: 'Lấy bộ dữ liệu hành chính Tỉnh/Thành Việt Nam cục bộ' })
  getDivisions() {
    return this.customerService.getDivisions();
  }

  // 2. Hồ sơ cá nhân (Authenticated)
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy hồ sơ cá nhân và danh sách địa chỉ của khách hàng đang đăng nhập' })
  @ApiResponse({ status: 200, description: 'Hồ sơ và địa chỉ' })
  async getMyProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomerProfile & { addresses: Address[] }> {
    return this.customerService.getProfile(user.userId, {
      fullName: user.fullName,
      phone: user.phone,
    });
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật hồ sơ cá nhân của khách hàng' })
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<CustomerProfile> {
    return this.customerService.updateProfile(user.userId, dto);
  }

  // 3. Quản lý sổ địa chỉ giao hàng (Authenticated)
  @Get('me/addresses')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách địa chỉ giao hàng' })
  async getMyAddresses(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Address[]> {
    return this.customerService.getAddresses(user.userId);
  }

  @Post('me/addresses')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thêm địa chỉ giao hàng mới' })
  async addMyAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAddressDto,
  ): Promise<Address> {
    return this.customerService.addAddress(user.userId, dto);
  }

  @Put('me/addresses/:addressId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật địa chỉ giao hàng' })
  async updateMyAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<Address> {
    return this.customerService.updateAddress(user.userId, addressId, dto);
  }

  @Delete('me/addresses/:addressId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa địa chỉ giao hàng' })
  async deleteMyAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('addressId') addressId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.customerService.deleteAddress(user.userId, addressId);
  }

  @Patch('me/addresses/:addressId/default')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thiết lập địa chỉ làm mặc định' })
  async setDefaultAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('addressId') addressId: string,
  ): Promise<Address> {
    return this.customerService.setDefaultAddress(user.userId, addressId);
  }
}
