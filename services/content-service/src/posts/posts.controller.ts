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
import { PostsService } from './posts.service.js';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto.js';
import { MinioService } from '../minio/minio.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { PostStatus } from '../../generated/client/index.js';

@ApiTags('Posts & Agricultural Blog (Kiến Thức & Tin Tức Nông Nghiệp)')
@Controller('api/v1/posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly minioService: MinioService,
  ) {}

  // =========================================================================
  // 1. PUBLIC STOREFRONT APIS
  // =========================================================================
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách bài viết kiến thức nông nghiệp đã xuất bản' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getPublicPosts(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.postsService.getPublicPosts({ page, limit, search });
  }

  // =========================================================================
  // 2. ADMIN APIS (Roles: STAFF, MANAGER, ADMIN, SUPER_ADMIN)
  // =========================================================================
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF', 'MANAGER', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Danh sách toàn bộ bài viết kèm phân trang & bộ lọc' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: PostStatus })
  async getAdminPosts(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: PostStatus,
  ) {
    return this.postsService.getAdminPosts({ page, limit, search, status });
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF', 'MANAGER', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Chi tiết bài viết theo ID' })
  async getAdminPostById(@Param('id') id: string) {
    return this.postsService.getAdminPostById(id);
  }

  @Post('upload-cover')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF', 'MANAGER', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '[Admin] Upload ảnh bìa bài viết lên MinIO' })
  async uploadCover(
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file hình ảnh để upload');
    }
    return this.minioService.uploadFile(
      {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      },
      'posts',
    );
  }

  @Post('upload-image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF', 'MANAGER', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '[Admin] Upload ảnh bài viết lên MinIO' })
  async uploadImage(
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.uploadCover(file);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF', 'MANAGER', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Tạo bài viết kiến thức nông nghiệp mới' })
  async createPost(@Body() dto: CreatePostDto) {
    return this.postsService.createPost(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF', 'MANAGER', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Cập nhật bài viết' })
  async updatePost(@Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.postsService.updatePost(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Xóa bài viết' })
  async deletePost(@Param('id') id: string) {
    return this.postsService.deletePost(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Xem chi tiết bài viết nông nghiệp theo Slug' })
  async getPostBySlugExplicit(@Param('slug') slug: string) {
    return this.postsService.getPostBySlug(slug);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Xem chi tiết bài viết nông nghiệp theo Slug' })
  async getPostBySlug(@Param('slug') slug: string) {
    return this.postsService.getPostBySlug(slug);
  }
}
