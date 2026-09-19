import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CouponsService } from './coupons.service.js';
import { ValidateCouponDto, CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@ApiTags('Coupons (Mã Giảm Giá Phân Bón)')
@Controller('api/v1/coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  // =========================================================================
  // 1. PUBLIC APIS
  // =========================================================================
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách mã giảm giá đang phát hành công khai' })
  async listCoupons() {
    return this.couponsService.listActiveCoupons();
  }

  @Post('validate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thẩm định và tính thử số tiền giảm của mã giảm giá' })
  async validateCoupon(
    @Body() dto: ValidateCouponDto,
    @CurrentUser('userId') customerId: string,
  ) {
    return this.couponsService.validateCoupon(dto.code, dto.subtotal, customerId);
  }

  // =========================================================================
  // 2. ADMIN APIS (Roles: ADMIN, SUPER_ADMIN, MANAGER)
  // =========================================================================
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Danh sách toàn bộ mã giảm giá kèm tìm kiếm & phân trang' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'enabled', required: false, type: Boolean })
  async getAdminCoupons(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('enabled') enabled?: string | boolean,
  ) {
    return this.couponsService.getAdminCoupons({ page, limit, search, enabled });
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Lấy chi tiết một mã giảm giá' })
  async getCouponDetail(@Param('id') id: string) {
    return this.couponsService.getCouponById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin-Only] Tạo mã giảm giá ưu đãi mới cho sàn' })
  async createCoupon(@Body() dto: CreateCouponDto) {
    return this.couponsService.createCoupon(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin-Only] Cập nhật thông tin mã giảm giá' })
  async updateCoupon(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.couponsService.updateCoupon(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin-Only] Xóa hoặc vô hiệu hóa mã giảm giá' })
  async deleteCoupon(@Param('id') id: string) {
    return this.couponsService.deleteCoupon(id);
  }
}
