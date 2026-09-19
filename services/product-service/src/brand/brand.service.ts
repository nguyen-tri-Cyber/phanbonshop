import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto.js';
import { Brand, Status } from '../../generated/client/index.js';
import { slugify } from '../category/category.service.js';

@Injectable()
export class BrandService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeInactive = false): Promise<Brand[]> {
    const where = includeInactive ? {} : { status: Status.ACTIVE };
    return this.prisma.brand.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string): Promise<Brand> {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: {
        products: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException(`Không tìm thấy thương hiệu có ID: ${id}`);
    }

    return brand;
  }

  async findBySlug(slug: string): Promise<Brand> {
    const brand = await this.prisma.brand.findUnique({
      where: { slug },
      include: {
        products: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException(`Không tìm thấy thương hiệu có slug: ${slug}`);
    }

    return brand;
  }

  async create(dto: CreateBrandDto): Promise<Brand> {
    const slug = dto.slug || slugify(dto.name);

    const existing = await this.prisma.brand.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException(`Thương hiệu với slug "${slug}" đã tồn tại`);
    }

    return this.prisma.brand.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        logoUrl: dto.logoUrl,
        status: dto.status || Status.ACTIVE,
      },
    });
  }

  async update(id: string, dto: UpdateBrandDto): Promise<Brand> {
    await this.findById(id);

    let slug: string | undefined = dto.slug;
    if (!slug && dto.name) {
      slug = slugify(dto.name);
    }

    if (slug) {
      const existing = await this.prisma.brand.findUnique({
        where: { slug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Thương hiệu với slug "${slug}" đã tồn tại`);
      }
    }

    return this.prisma.brand.update({
      where: { id },
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        logoUrl: dto.logoUrl,
        status: dto.status,
      },
    });
  }

  async delete(id: string): Promise<{ message: string }> {
    await this.findById(id);

    const productCount = await this.prisma.product.count({
      where: { brandId: id },
    });

    if (productCount > 0) {
      throw new ConflictException(
        `Không thể xóa thương hiệu đang có ${productCount} sản phẩm liên kết`,
      );
    }

    await this.prisma.brand.delete({
      where: { id },
    });

    return { message: `Đã xóa thương hiệu ${id} thành công` };
  }
}
