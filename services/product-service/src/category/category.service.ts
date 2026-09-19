import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';
import { Category, Status } from '../../generated/client/index.js';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeInactive = false): Promise<Category[]> {
    const where = includeInactive ? {} : { status: Status.ACTIVE };
    return this.prisma.category.findMany({
      where,
      include: {
        children: {
          where,
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findTree(): Promise<Category[]> {
    // Trả về cây danh mục cha (parentId = null) kèm danh mục con lồng nhau
    return this.prisma.category.findMany({
      where: {
        parentId: null,
        status: Status.ACTIVE,
      },
      include: {
        children: {
          where: { status: Status.ACTIVE },
          orderBy: { sortOrder: 'asc' },
          include: {
            children: {
              where: { status: Status.ACTIVE },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findById(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
      },
    });

    if (!category) {
      throw new NotFoundException(`Không tìm thấy danh mục có ID: ${id}`);
    }

    return category;
  }

  async findBySlug(slug: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        parent: true,
        children: true,
      },
    });

    if (!category) {
      throw new NotFoundException(`Không tìm thấy danh mục có slug: ${slug}`);
    }

    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const slug = dto.slug || slugify(dto.name);

    const existing = await this.prisma.category.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException(`Danh mục với slug "${slug}" đã tồn tại`);
    }

    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Không tìm thấy danh mục cha có ID: ${dto.parentId}`);
      }
    }

    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        parentId: dto.parentId || null,
        status: dto.status || Status.ACTIVE,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: {
        parent: true,
        children: true,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    await this.findById(id);

    let slug: string | undefined = dto.slug;
    if (!slug && dto.name) {
      slug = slugify(dto.name);
    }

    if (slug) {
      const existing = await this.prisma.category.findUnique({
        where: { slug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Danh mục với slug "${slug}" đã tồn tại`);
      }
    }

    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new ConflictException('Danh mục không thể làm cha của chính mình');
      }
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Không tìm thấy danh mục cha có ID: ${dto.parentId}`);
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        parentId: dto.parentId !== undefined ? dto.parentId : undefined,
        status: dto.status,
        sortOrder: dto.sortOrder,
      },
      include: {
        parent: true,
        children: true,
      },
    });
  }

  async delete(id: string): Promise<{ message: string }> {
    await this.findById(id);

    // Kiểm tra xem danh mục có sản phẩm không
    const productCount = await this.prisma.product.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      throw new ConflictException(
        `Không thể xóa danh mục đang có ${productCount} sản phẩm trực thuộc. Vui lòng chuyển sản phẩm sang danh mục khác trước`,
      );
    }

    await this.prisma.category.delete({
      where: { id },
    });

    return { message: `Đã xóa danh mục ${id} thành công` };
  }
}
