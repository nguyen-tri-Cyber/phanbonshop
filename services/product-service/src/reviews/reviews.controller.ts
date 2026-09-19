import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service.js';
import { CreateReviewDto, UpdateReviewStatusDto } from './dto/review.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ReviewStatus } from '../../generated/client/index.js';

@ApiTags('Product Reviews (Đánh Giá & Nhận Xét Sản Phẩm)')
@Controller('api/v1/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // =========================================================================
  // 1. PUBLIC APIS
  // =========================================================================
  @Get('products/:productId')
  @ApiOperation({ summary: 'Xem các đánh giá đã duyệt của một sản phẩm' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'rating', required: false, type: Number })
  async getProductReviews(
    @Param('productId') productId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('rating') rating?: number,
  ) {
    return this.reviewsService.getProductReviews(productId, { page, limit, rating });
  }

  // =========================================================================
  // 2. CUSTOMER APIS (Khách hàng gửi đánh giá)
  // =========================================================================
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Gửi đánh giá sản phẩm (Backend tự động xác thực verifiedPurchase)',
  })
  async createReview(
    @CurrentUser('userId') customerId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createReview(customerId, dto);
  }

  // =========================================================================
  // 3. ADMIN APIS (Kiểm duyệt & Quản trị)
  // =========================================================================
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'STAFF', 'MANAGER')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Danh sách đánh giá toàn sàn phục vụ kiểm duyệt' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ReviewStatus })
  @ApiQuery({ name: 'productId', required: false, type: String })
  async getAdminReviews(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: ReviewStatus,
    @Query('productId') productId?: string,
  ) {
    return this.reviewsService.getAdminReviews({ page, limit, status, productId });
  }

  @Patch('admin/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Cập nhật trạng thái kiểm duyệt đánh giá (APPROVED / REJECTED)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReviewStatusDto,
  ) {
    return this.reviewsService.updateReviewStatus(id, dto.status);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Xóa vĩnh viễn đánh giá vi phạm' })
  async deleteReview(@Param('id') id: string) {
    return this.reviewsService.deleteReview(id, undefined, true);
  }
}
