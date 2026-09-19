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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { BannersService } from './banners.service.js';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto.js';
import { MinioService } from '../minio/minio.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { BannerStatus } from '../../generated/client/index.js';

@ApiTags('Banners (Quản Lý Banner Quảng Cáo & Khuyến Mãi)')
@Controller('api/v1/banners')
export class BannersController {
  constructor(
    private readonly bannersService: BannersService,
    private readonly minioService: MinioService,
  ) {}

  // =========================================================================
  // 1. PUBLIC STOREFRONT APIS
  // =========================================================================
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách banner đang hoạt động cho trang chủ/storefront' })
  @ApiQuery({ name: 'position', required: false, example: 'HOME_HERO' })
  async getPublicBanners(@Query('position') position?: string) {
    return this.bannersService.getPublicBanners(position);
  }

  // =========================================================================
  // 2. ADMIN APIS (Roles: STAFF, MANAGER, ADMIN, SUPER_ADMIN)
  // =========================================================================
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF', 'MANAGER', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Danh sách toàn bộ banner kèm bộ lọc' })
  @ApiQuery({ name: 'position', required: false })
  @ApiQuery({ name: 'status', required: false, enum: BannerStatus })
  async getAdminBanners(
    @Query('position') position?: string,
    @Query('status') status?: BannerStatus,
  ) {
    return this.bannersService.getAdminBanners({ position, status });
  }

  @Post('upload-image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF', 'MANAGER', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '[Admin] Upload file ảnh banner lên MinIO' })
  async uploadBannerImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file hình ảnh');
    }
    return this.minioService.uploadFile(
      {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      },
      'banners',
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF', 'MANAGER', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Tạo banner mới' })
  async createBanner(@Body() dto: CreateBannerDto) {
    return this.bannersService.createBanner(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF', 'MANAGER', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Cập nhật banner' })
  async updateBanner(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.bannersService.updateBanner(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Xóa banner' })
  async deleteBanner(@Param('id') id: string) {
    return this.bannersService.deleteBanner(id);
  }
}
