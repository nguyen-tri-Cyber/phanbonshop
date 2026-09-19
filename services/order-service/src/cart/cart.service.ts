import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AddCartItemDto, ChangeVariantDto, MergeCartDto } from './dto/cart.dto.js';
import { CartDTO, CartItemDTO } from '@phanbonshop/shared-types';
import { createLogger } from '@phanbonshop/logger';

const logger = createLogger('order-service:cart');
const MAX_ITEM_QUANTITY = 99;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy hoặc tạo mới giỏ hàng của người dùng theo userId
   */
  async getOrCreateCart(userId: string) {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: {
          items: true,
        },
      });
      logger.info(`Đã khởi tạo giỏ hàng mới cho user ${userId}`, { cartId: cart.id });
    }

    return cart;
  }

  /**
   * Trả về giỏ hàng định dạng chuẩn DTO
   */
  async getCart(userId: string): Promise<CartDTO> {
    const cart = await this.getOrCreateCart(userId);

    const formattedItems: CartItemDTO[] = cart.items.map((item) => ({
      id: item.id,
      cartId: item.cartId,
      variantId: item.variantId,
      productId: item.productId,
      productName: item.productName,
      productSlug: item.productSlug,
      sku: item.sku,
      packageSize: item.packageSize,
      unitPrice: Number(item.unitPrice),
      price: Number(item.unitPrice),
      imageUrl: item.imageUrl,
      quantity: item.quantity,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));

    const totalItems = formattedItems.reduce((acc, item) => acc + item.quantity, 0);
    const subtotal = formattedItems.reduce(
      (acc, item) => acc + item.unitPrice * item.quantity,
      0,
    );

    return {
      id: cart.id,
      userId: cart.userId,
      items: formattedItems,
      totalItems,
      subtotal,
      createdAt: cart.createdAt.toISOString(),
      updatedAt: cart.updatedAt.toISOString(),
    };
  }

  /**
   * Thêm sản phẩm vào giỏ hàng
   */
  async addItem(userId: string, dto: AddCartItemDto): Promise<CartDTO> {
    const cart = await this.getOrCreateCart(userId);

    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_variantId: {
          cartId: cart.id,
          variantId: dto.variantId,
        },
      },
    });

    const unitPrice = dto.unitPrice ?? dto.price ?? 0;

    if (existingItem) {
      const newQuantity = Math.min(
        existingItem.quantity + (dto.quantity || 1),
        MAX_ITEM_QUANTITY,
      );
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQuantity,
          unitPrice,
          packageSize: dto.packageSize,
          imageUrl: dto.imageUrl || existingItem.imageUrl,
        },
      });
      logger.info(`Cộng dồn số lượng variant ${dto.variantId} thành ${newQuantity}`, {
        userId,
        cartId: cart.id,
      });
    } else {
      const quantity = Math.min(dto.quantity || 1, MAX_ITEM_QUANTITY);
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId: dto.variantId,
          productId: dto.productId,
          productName: dto.productName,
          productSlug: dto.productSlug,
          sku: dto.sku,
          packageSize: dto.packageSize,
          unitPrice,
          imageUrl: dto.imageUrl,
          quantity,
        },
      });
      logger.info(`Thêm mới item variant ${dto.variantId} vào giỏ hàng`, {
        userId,
        cartId: cart.id,
      });
    }

    return this.getCart(userId);
  }

  /**
   * Cập nhật số lượng của một variant trong giỏ
   */
  async updateQuantity(
    userId: string,
    variantId: string,
    quantity: number,
  ): Promise<CartDTO> {
    const cart = await this.getOrCreateCart(userId);

    if (quantity <= 0) {
      return this.removeItem(userId, variantId);
    }

    const clampedQuantity = Math.min(quantity, MAX_ITEM_QUANTITY);

    await this.prisma.cartItem.updateMany({
      where: {
        cartId: cart.id,
        variantId,
      },
      data: {
        quantity: clampedQuantity,
      },
    });

    return this.getCart(userId);
  }

  /**
   * Xóa một variant khỏi giỏ hàng
   */
  async removeItem(userId: string, variantId: string): Promise<CartDTO> {
    const cart = await this.getOrCreateCart(userId);

    await this.prisma.cartItem.deleteMany({
      where: {
        cartId: cart.id,
        variantId,
      },
    });

    logger.info(`Đã xóa variant ${variantId} khỏi giỏ hàng user ${userId}`);
    return this.getCart(userId);
  }

  /**
   * Làm rỗng toàn bộ giỏ hàng
   */
  async clearCart(userId: string): Promise<CartDTO> {
    const cart = await this.getOrCreateCart(userId);

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    logger.info(`Đã xóa toàn bộ item trong giỏ hàng user ${userId}`);
    return this.getCart(userId);
  }

  /**
   * Thay đổi sang variant khác ngay trong giỏ hàng
   */
  async changeVariant(
    userId: string,
    oldVariantId: string,
    dto: ChangeVariantDto,
  ): Promise<CartDTO> {
    const cart = await this.getOrCreateCart(userId);

    const oldItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_variantId: {
          cartId: cart.id,
          variantId: oldVariantId,
        },
      },
    });

    if (!oldItem) {
      throw new NotFoundException(`Không tìm thấy mặt hàng với variantId: ${oldVariantId}`);
    }

    if (oldVariantId === dto.newVariantId) {
      return this.getCart(userId);
    }

    const newItemExisting = await this.prisma.cartItem.findUnique({
      where: {
        cartId_variantId: {
          cartId: cart.id,
          variantId: dto.newVariantId,
        },
      },
    });

    const unitPrice = dto.unitPrice ?? dto.price ?? 0;

    if (newItemExisting) {
      // Cùng variant đã có trong giỏ -> gộp số lượng và xóa item cũ
      const mergedQuantity = Math.min(
        newItemExisting.quantity + oldItem.quantity,
        MAX_ITEM_QUANTITY,
      );
      await this.prisma.cartItem.update({
        where: { id: newItemExisting.id },
        data: {
          quantity: mergedQuantity,
          unitPrice,
          packageSize: dto.packageSize,
          imageUrl: dto.imageUrl || newItemExisting.imageUrl,
        },
      });
      await this.prisma.cartItem.delete({
        where: { id: oldItem.id },
      });
      logger.info(
        `Đổi variant sang ${dto.newVariantId} và gộp số lượng thành ${mergedQuantity}`,
        { userId },
      );
    } else {
      // Chưa có variant này -> cập nhật thông tin dòng hiện tại
      await this.prisma.cartItem.update({
        where: { id: oldItem.id },
        data: {
          variantId: dto.newVariantId,
          sku: dto.sku,
          packageSize: dto.packageSize,
          unitPrice,
          imageUrl: dto.imageUrl || oldItem.imageUrl,
        },
      });
      logger.info(`Cập nhật variant ${oldVariantId} sang ${dto.newVariantId}`, { userId });
    }

    return this.getCart(userId);
  }

  /**
   * Gộp giỏ hàng khách vãng lai (Guest) vào giỏ hàng tài khoản (Authenticated)
   * Merge Rules:
   * - Cùng variant -> cộng dồn quantity (tối đa trần 99)
   * - Khác variant -> thêm dòng riêng
   * - Giữ trần số lượng hợp lý MAX_ITEM_QUANTITY = 99
   */
  async mergeCart(userId: string, dto: MergeCartDto): Promise<CartDTO> {
    const cart = await this.getOrCreateCart(userId);

    if (!dto.items || dto.items.length === 0) {
      return this.getCart(userId);
    }

    for (const item of dto.items) {
      const itemUnitPrice = item.unitPrice ?? item.price ?? 0;
      const existing = await this.prisma.cartItem.findUnique({
        where: {
          cartId_variantId: {
            cartId: cart.id,
            variantId: item.variantId,
          },
        },
      });

      if (existing) {
        const mergedQty = Math.min(
          existing.quantity + (item.quantity || 1),
          MAX_ITEM_QUANTITY,
        );
        await this.prisma.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: mergedQty,
            unitPrice: itemUnitPrice,
            packageSize: item.packageSize,
            imageUrl: item.imageUrl || existing.imageUrl,
          },
        });
      } else {
        const qty = Math.min(item.quantity || 1, MAX_ITEM_QUANTITY);
        await this.prisma.cartItem.create({
          data: {
            cartId: cart.id,
            variantId: item.variantId,
            productId: item.productId,
            productName: item.productName,
            productSlug: item.productSlug,
            sku: item.sku,
            packageSize: item.packageSize,
            unitPrice: itemUnitPrice,
            imageUrl: item.imageUrl,
            quantity: qty,
          },
        });
      }
    }

    logger.info(`Đã gộp ${dto.items.length} items từ guest cart vào tài khoản ${userId}`);
    return this.getCart(userId);
  }
}
