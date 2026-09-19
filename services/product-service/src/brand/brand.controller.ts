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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BrandService } from './brand.service.js';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto.js';
import { Brand } from '../../generated/client/index.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@ApiTags('Brands')
@Controller('api/v1/brands')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các thương hiệu / nhà sản xuất phân bón' })
  async getBrands(): Promise<Brand[]> {
    return this.brandService.findAll();
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Lấy chi tiết thương hiệu theo ID hoặc Slug' })
  async getBrand(@Param('idOrSlug') idOrSlug: string): Promise<Brand> {
    if (idOrSlug.includes('-') && idOrSlug.length > 30) {
      try {
        return await this.brandService.findById(idOrSlug);
      } catch {
        return this.brandService.findBySlug(idOrSlug);
      }
    }
    return this.brandService.findBySlug(idOrSlug);
  }

  // Admin APIs
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Thêm mới thương hiệu phân bón' })
  @ApiResponse({ status: 201, description: 'Tạo thương hiệu thành công' })
  async createBrand(@Body() dto: CreateBrandDto): Promise<Brand> {
    return this.brandService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Cập nhật thông tin thương hiệu' })
  async updateBrand(
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
  ): Promise<Brand> {
    return this.brandService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Xóa thương hiệu' })
  async deleteBrand(@Param('id') id: string): Promise<{ message: string }> {
    return this.brandService.delete(id);
  }
}
