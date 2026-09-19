import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CartService } from './cart.service.js';
import {
  AddCartItemDto,
  UpdateCartQuantityDto,
  ChangeVariantDto,
  MergeCartDto,
} from './dto/cart.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../auth/decorators/current-user.decorator.js';
import { CartDTO } from '@phanbonshop/shared-types';

@ApiTags('Cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy thông tin giỏ hàng của người dùng hiện tại' })
  @ApiResponse({ status: 200, description: 'Thông tin giỏ hàng chi tiết' })
  async getCart(@CurrentUser() user: AuthenticatedUser): Promise<CartDTO> {
    return this.cartService.getCart(user.userId);
  }

  @Post('items')
  @ApiOperation({ summary: 'Thêm sản phẩm/variant vào giỏ hàng' })
  @ApiResponse({ status: 201, description: 'Đã thêm vào giỏ hàng' })
  async addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddCartItemDto,
  ): Promise<CartDTO> {
    return this.cartService.addItem(user.userId, dto);
  }

  @Put('items/:variantId')
  @ApiOperation({ summary: 'Cập nhật số lượng của variant trong giỏ' })
  async updateQuantity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateCartQuantityDto,
  ): Promise<CartDTO> {
    return this.cartService.updateQuantity(user.userId, variantId, dto.quantity);
  }

  @Delete('items/:variantId')
  @ApiOperation({ summary: 'Xóa variant khỏi giỏ hàng' })
  async removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('variantId') variantId: string,
  ): Promise<CartDTO> {
    return this.cartService.removeItem(user.userId, variantId);
  }

  @Delete()
  @ApiOperation({ summary: 'Xóa toàn bộ sản phẩm trong giỏ hàng' })
  async clearCart(@CurrentUser() user: AuthenticatedUser): Promise<CartDTO> {
    return this.cartService.clearCart(user.userId);
  }

  @Post('items/:variantId/change-variant')
  @ApiOperation({ summary: 'Đổi quy cách/variant cho một mục trong giỏ' })
  async changeVariant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('variantId') variantId: string,
    @Body() dto: ChangeVariantDto,
  ): Promise<CartDTO> {
    return this.cartService.changeVariant(user.userId, variantId, dto);
  }

  @Post('merge')
  @ApiOperation({ summary: 'Gộp giỏ hàng khách vãng lai (Guest) vào giỏ hàng tài khoản' })
  @ApiResponse({ status: 200, description: 'Giỏ hàng đã được gộp thành công' })
  async mergeCart(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MergeCartDto,
  ): Promise<CartDTO> {
    return this.cartService.mergeCart(user.userId, dto);
  }
}
