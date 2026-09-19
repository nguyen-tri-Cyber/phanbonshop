import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { InventoryService, InventoryView } from './inventory.service.js';
import {
  ReserveInventoryDto,
  ReleaseInventoryDto,
  CommitInventoryDto,
  AdjustInventoryDto,
  InitInventoryDto,
} from './dto/inventory.dto.js';
import { InternalSecretGuard } from '../auth/guards/internal-secret.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';

@ApiTags('Inventory (Kho Hàng & Chống Oversell)')
@Controller()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // =========================================================================
  // 1. INTERNAL APIS (Dành riêng cho Order/Checkout Service qua Service Mesh)
  // =========================================================================
  @Post('internal/v1/inventory/reserve')
  @UseGuards(InternalSecretGuard)
  @ApiHeader({
    name: 'X-Internal-Secret',
    description: 'Mã bí mật xác thực giao tiếp dịch vụ nội bộ',
    required: true,
  })
  @ApiOperation({
    summary: '[Internal] Tạm giữ tồn kho chống oversell (Idempotent)',
    description: 'Sử dụng MySQL Transaction + SELECT ... FOR UPDATE khóa hàng độc quyền',
  })
  @ApiResponse({ status: 200, description: 'Tạm giữ thành công' })
  @ApiResponse({ status: 409, description: 'Không đủ tồn kho khả dụng' })
  async reserve(
    @Body() dto: ReserveInventoryDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.inventoryService.reserve(dto, requestId);
  }

  @Post('internal/v1/inventory/release')
  @UseGuards(InternalSecretGuard)
  @ApiHeader({ name: 'X-Internal-Secret', required: true })
  @ApiOperation({
    summary: '[Internal] Giải phóng tồn kho tạm giữ khi hủy đơn (Idempotent)',
  })
  async release(
    @Body() dto: ReleaseInventoryDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.inventoryService.release(dto, requestId);
  }

  @Post('internal/v1/inventory/commit')
  @UseGuards(InternalSecretGuard)
  @ApiHeader({ name: 'X-Internal-Secret', required: true })
  @ApiOperation({
    summary: '[Internal] Xuất kho trừ tồn vật lý khi thanh toán thành công (Idempotent)',
  })
  async commit(
    @Body() dto: CommitInventoryDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.inventoryService.commit(dto, requestId);
  }

  @Post('internal/v1/inventory/cleanup-expired')
  @UseGuards(InternalSecretGuard)
  @ApiHeader({ name: 'X-Internal-Secret', required: true })
  @ApiOperation({
    summary: '[Internal] Quét và giải phóng các lượt tạm giữ quá hạn (Expired cleanup)',
  })
  async cleanupExpired() {
    return this.inventoryService.releaseExpiredReservations();
  }

  @Post('internal/v1/inventory/init-stock')
  @UseGuards(InternalSecretGuard)
  @ApiHeader({ name: 'X-Internal-Secret', required: true })
  @ApiOperation({ summary: '[Internal] Khởi tạo tồn kho ban đầu cho sản phẩm' })
  async initStock(@Body() dto: InitInventoryDto) {
    return this.inventoryService.initStock(dto);
  }

  // =========================================================================
  // 2. ADMIN APIS (Quản lý kho & điều chỉnh kiểm kê)
  // =========================================================================
  @Post('api/v1/inventory/adjust')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WAREHOUSE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[Admin/Warehouse] Điều chỉnh tồn kho thủ công (Bắt buộc lý do & ghi sổ cái)',
  })
  async adjust(
    @Body() dto: AdjustInventoryDto,
    @CurrentUser() user?: AuthenticatedUser,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.inventoryService.adjust(dto, user?.email, requestId);
  }

  @Get('api/v1/inventory/low-stock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WAREHOUSE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin/Warehouse] Danh sách sản phẩm sắp hết hàng (Low stock alert)' })
  async getLowStock(): Promise<InventoryView[]> {
    return this.inventoryService.getLowStock();
  }

  @Get('api/v1/inventory')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WAREHOUSE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin/Warehouse] Lấy toàn bộ danh sách tồn kho' })
  async getAllInventory(
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.inventoryService.getAll({ search, page, limit });
  }

  @Get('api/v1/inventory/movements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WAREHOUSE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin/Warehouse] Tra cứu sổ cái biến động kho (Audit Movements)' })
  async getMovements(
    @Query('variantId') variantId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.inventoryService.getMovements(variantId, limit ? Number(limit) : 50);
  }

  // =========================================================================
  // 3. PUBLIC / READ APIS
  // =========================================================================
  @Get('api/v1/inventory/products/:productId')
  @ApiOperation({
    summary: 'Tra cứu tình trạng tồn kho khả dụng theo Product ID',
    description: 'Tính toán động: availableQuantity = stockQuantity - reservedQuantity',
  })
  async getProductInventory(
    @Param('productId') productId: string,
  ): Promise<InventoryView[]> {
    return this.inventoryService.getByProductId(productId);
  }
}
