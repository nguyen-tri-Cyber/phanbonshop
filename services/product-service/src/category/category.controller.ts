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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CategoryService } from './category.service.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';
import { Category } from '../../generated/client/index.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@ApiTags('Categories')
@Controller('api/v1/categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách nhóm phân bón / danh mục sản phẩm' })
  @ApiQuery({ name: 'tree', required: false, type: Boolean, description: 'Trả về cấu trúc cây phân cấp cha-con' })
  async getCategories(@Query('tree') tree?: string): Promise<Category[]> {
    if (tree === 'true' || tree === '1') {
      return this.categoryService.findTree();
    }
    return this.categoryService.findAll();
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết danh mục theo ID hoặc Slug' })
  async getCategory(@Param('idOrSlug') idOrSlug: string): Promise<Category> {
    if (idOrSlug.includes('-') && idOrSlug.length > 30) {
      // UUID thông thường
      try {
        return await this.categoryService.findById(idOrSlug);
      } catch {
        return this.categoryService.findBySlug(idOrSlug);
      }
    }
    return this.categoryService.findBySlug(idOrSlug);
  }

  // Admin APIs
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Tạo mới danh mục sản phẩm' })
  @ApiResponse({ status: 201, description: 'Tạo danh mục thành công' })
  async createCategory(@Body() dto: CreateCategoryDto): Promise<Category> {
    return this.categoryService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Cập nhật thông tin danh mục' })
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.categoryService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Xóa danh mục sản phẩm' })
  async deleteCategory(@Param('id') id: string): Promise<{ message: string }> {
    return this.categoryService.delete(id);
  }
}
