import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ReserveInventoryDto,
  ReleaseInventoryDto,
  CommitInventoryDto,
  AdjustInventoryDto,
  InitInventoryDto,
} from './dto/inventory.dto.js';
import {
  ReservationStatus,
  MovementType,
  InventoryReservation,
  Prisma,
} from '../../generated/client/index.js';
import { createLogger } from '@phanbonshop/logger';

const logger = createLogger('inventory-service');

export interface InventoryView {
  id?: string;
  productId: string;
  variantId: string;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  reorderLevel: number;
  updatedAt?: Date;
}

interface RawInventoryRow {
  id: string;
  productId: string;
  variantId: string;
  stockQuantity: number;
  reservedQuantity: number;
  reorderLevel: number;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // --- 1. TẠM GIỮ TỒN KHO (RESERVE) - CHỐNG OVERSELL VỚI SELECT ... FOR UPDATE ---
  async reserve(
    dto: ReserveInventoryDto,
    requestId?: string,
  ): Promise<{
    success: boolean;
    message: string;
    reservation: InventoryReservation;
    inventory: {
      stockQuantity: number;
      reservedQuantity: number;
      availableQuantity: number;
    };
  }> {
    return this.prisma.$transaction(async (tx) => {
      // 1. KHÓA BI QUAN: SELECT ... FOR UPDATE trên hàng của variantId
      const rows = await tx.$queryRaw<RawInventoryRow[]>`
        SELECT id, productId, variantId, stockQuantity, reservedQuantity, reorderLevel
        FROM inventory
        WHERE variantId = ${dto.variantId}
        FOR UPDATE
      `;

      const inv = rows[0];
      if (!inv) {
        throw new NotFoundException(
          `Không tìm thấy dữ liệu tồn kho cho biến thể: ${dto.variantId}`,
        );
      }

      // 2. Kiểm tra Idempotency sau khi đã giữ lock
      const existing = await tx.inventoryReservation.findUnique({
        where: { reservationId: dto.reservationId },
      });

      if (existing) {
        if (existing.status === ReservationStatus.ACTIVE) {
          logger.info(`[Idempotent] Reservation ${dto.reservationId} đã tồn tại và đang ACTIVE`);
          return {
            success: true,
            message: 'Yêu cầu tạm giữ đã được xử lý trước đó (Idempotent)',
            reservation: existing,
            inventory: {
              stockQuantity: inv.stockQuantity,
              reservedQuantity: inv.reservedQuantity,
              availableQuantity: inv.stockQuantity - inv.reservedQuantity,
            },
          };
        }
        throw new ConflictException(
          `Mã đặt giữ ${dto.reservationId} đã kết thúc với trạng thái: ${existing.status}`,
        );
      }

      const availableQuantity = inv.stockQuantity - inv.reservedQuantity;

      // 3. Kiểm tra tồn kho khả dụng
      if (availableQuantity < dto.quantity) {
        logger.warn(
          `Không đủ tồn kho khả dụng cho variant ${dto.variantId}. Yêu cầu: ${dto.quantity}, Khả dụng: ${availableQuantity} (Stock: ${inv.stockQuantity}, Reserved: ${inv.reservedQuantity})`,
        );
        throw new ConflictException(
          `Không đủ tồn kho khả dụng cho sản phẩm. Yêu cầu: ${dto.quantity}, Khả dụng: ${availableQuantity}`,
        );
      }

      // 4. Cập nhật số lượng tạm giữ
      const newReserved = inv.reservedQuantity + dto.quantity;
      await tx.inventory.update({
        where: { variantId: dto.variantId },
        data: { reservedQuantity: newReserved },
      });

      // 5. Tạo bản ghi Reservation
      const expiresAt = new Date(Date.now() + (dto.ttlMinutes || 15) * 60 * 1000);
      const reservation = await tx.inventoryReservation.create({
        data: {
          reservationId: dto.reservationId,
          variantId: dto.variantId,
          quantity: dto.quantity,
          referenceType: dto.referenceType,
          referenceId: dto.referenceId,
          status: ReservationStatus.ACTIVE,
          expiresAt,
        },
      });

      // 6. Ghi sổ cái biến động kho (Audit Movement)
      await tx.inventoryMovement.create({
        data: {
          productId: dto.productId,
          variantId: dto.variantId,
          type: MovementType.RESERVATION,
          quantity: dto.quantity,
          stockBefore: inv.stockQuantity,
          stockAfter: inv.stockQuantity,
          reservedBefore: inv.reservedQuantity,
          reservedAfter: newReserved,
          reason: `Tạm giữ hàng cho đơn ${dto.referenceId} (${dto.reservationId})`,
          referenceType: dto.referenceType,
          referenceId: dto.referenceId,
          requestId: requestId || null,
        },
      });

      return {
        success: true,
        message: 'Tạm giữ tồn kho thành công',
        reservation,
        inventory: {
          stockQuantity: inv.stockQuantity,
          reservedQuantity: newReserved,
          availableQuantity: inv.stockQuantity - newReserved,
        },
      };
    });
  }

  // --- 2. GIẢI PHÓNG TỒN KHO TẠM GIỮ (RELEASE) - IDEMPOTENT ---
  async release(
    dto: ReleaseInventoryDto,
    requestId?: string,
  ): Promise<{
    success: boolean;
    message: string;
    reservation: InventoryReservation;
    inventory: {
      stockQuantity: number;
      reservedQuantity: number;
      availableQuantity: number;
    };
  }> {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.inventoryReservation.findUnique({
        where: { reservationId: dto.reservationId },
      });

      if (!reservation) {
        throw new NotFoundException(
          `Không tìm thấy lượt tạm giữ với mã: ${dto.reservationId}`,
        );
      }

      // Idempotent: Nếu đã release trước đó, trả về thành công mà không trừ tiếp
      if (reservation.status === ReservationStatus.RELEASED) {
        logger.info(`[Idempotent] Reservation ${dto.reservationId} đã RELEASED trước đó`);
        const inv = await tx.inventory.findUnique({
          where: { variantId: reservation.variantId },
        });
        return {
          success: true,
          message: 'Lượt tạm giữ đã được giải phóng trước đó (Idempotent)',
          reservation,
          inventory: {
            stockQuantity: inv?.stockQuantity || 0,
            reservedQuantity: inv?.reservedQuantity || 0,
            availableQuantity:
              (inv?.stockQuantity || 0) - (inv?.reservedQuantity || 0),
          },
        };
      }

      if (reservation.status === ReservationStatus.COMMITTED) {
        throw new BadRequestException(
          `Không thể giải phóng lượt tạm giữ đã hoàn tất xuất kho (COMMITTED)`,
        );
      }

      // Khóa dòng inventory
      const rows = await tx.$queryRaw<RawInventoryRow[]>`
        SELECT id, productId, variantId, stockQuantity, reservedQuantity, reorderLevel
        FROM inventory
        WHERE variantId = ${reservation.variantId}
        FOR UPDATE
      `;

      const inv = rows[0];
      if (!inv) {
        throw new NotFoundException(`Không tìm thấy tồn kho cho variant: ${reservation.variantId}`);
      }

      const newReserved = Math.max(0, inv.reservedQuantity - reservation.quantity);

      await tx.inventory.update({
        where: { variantId: reservation.variantId },
        data: { reservedQuantity: newReserved },
      });

      const updatedReservation = await tx.inventoryReservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.RELEASED },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: inv.productId,
          variantId: reservation.variantId,
          type: MovementType.RELEASE_RESERVATION,
          quantity: reservation.quantity,
          stockBefore: inv.stockQuantity,
          stockAfter: inv.stockQuantity,
          reservedBefore: inv.reservedQuantity,
          reservedAfter: newReserved,
          reason: dto.reason || `Giải phóng tạm giữ cho reservation ${dto.reservationId}`,
          referenceType: reservation.referenceType,
          referenceId: reservation.referenceId,
          requestId: requestId || null,
        },
      });

      return {
        success: true,
        message: 'Giải phóng tồn kho tạm giữ thành công',
        reservation: updatedReservation,
        inventory: {
          stockQuantity: inv.stockQuantity,
          reservedQuantity: newReserved,
          availableQuantity: inv.stockQuantity - newReserved,
        },
      };
    });
  }

  // --- 3. XUẤT KHO HOÀN TẤT ĐƠN HÀNG (COMMIT) - IDEMPOTENT ---
  async commit(
    dto: CommitInventoryDto,
    requestId?: string,
  ): Promise<{
    success: boolean;
    message: string;
    reservation: InventoryReservation;
    inventory: {
      stockQuantity: number;
      reservedQuantity: number;
      availableQuantity: number;
    };
  }> {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.inventoryReservation.findUnique({
        where: { reservationId: dto.reservationId },
      });

      if (!reservation) {
        throw new NotFoundException(
          `Không tìm thấy lượt tạm giữ với mã: ${dto.reservationId}`,
        );
      }

      // Idempotent: Nếu đã commit trước đó, trả về thành công mà không trừ stock lần 2
      if (reservation.status === ReservationStatus.COMMITTED) {
        logger.info(`[Idempotent] Reservation ${dto.reservationId} đã COMMITTED trước đó`);
        const inv = await tx.inventory.findUnique({
          where: { variantId: reservation.variantId },
        });
        return {
          success: true,
          message: 'Lượt xuất kho đã được xác nhận trước đó (Idempotent)',
          reservation,
          inventory: {
            stockQuantity: inv?.stockQuantity || 0,
            reservedQuantity: inv?.reservedQuantity || 0,
            availableQuantity:
              (inv?.stockQuantity || 0) - (inv?.reservedQuantity || 0),
          },
        };
      }

      if (
        reservation.status === ReservationStatus.RELEASED ||
        reservation.status === ReservationStatus.EXPIRED
      ) {
        throw new BadRequestException(
          `Không thể xuất kho: Lượt tạm giữ không còn hiệu lực (Trạng thái: ${reservation.status})`,
        );
      }

      // Khóa dòng inventory
      const rows = await tx.$queryRaw<RawInventoryRow[]>`
        SELECT id, productId, variantId, stockQuantity, reservedQuantity, reorderLevel
        FROM inventory
        WHERE variantId = ${reservation.variantId}
        FOR UPDATE
      `;

      const inv = rows[0];
      if (!inv) {
        throw new NotFoundException(`Không tìm thấy tồn kho cho variant: ${reservation.variantId}`);
      }

      const newStock = Math.max(0, inv.stockQuantity - reservation.quantity);
      const newReserved = Math.max(0, inv.reservedQuantity - reservation.quantity);

      await tx.inventory.update({
        where: { variantId: reservation.variantId },
        data: {
          stockQuantity: newStock,
          reservedQuantity: newReserved,
        },
      });

      const updatedReservation = await tx.inventoryReservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.COMMITTED },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: inv.productId,
          variantId: reservation.variantId,
          type: MovementType.SALE,
          quantity: reservation.quantity,
          stockBefore: inv.stockQuantity,
          stockAfter: newStock,
          reservedBefore: inv.reservedQuantity,
          reservedAfter: newReserved,
          reason: `Xuất kho giao hàng cho đơn ${dto.referenceId || reservation.referenceId}`,
          referenceType: reservation.referenceType,
          referenceId: dto.referenceId || reservation.referenceId,
          requestId: requestId || null,
        },
      });

      return {
        success: true,
        message: 'Xuất kho và xác nhận thanh toán thành công',
        reservation: updatedReservation,
        inventory: {
          stockQuantity: newStock,
          reservedQuantity: newReserved,
          availableQuantity: newStock - newReserved,
        },
      };
    });
  }

  // --- 4. ĐIỀU CHỈNH TỒN KHO THỦ CÔNG (ADJUST) - BẮT BUỘC REASON & AUDIT MOVEMENT ---
  async adjust(
    dto: AdjustInventoryDto,
    performedBy?: string,
    requestId?: string,
  ): Promise<{
    success: boolean;
    message: string;
    inventory: InventoryView;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<RawInventoryRow[]>`
        SELECT id, productId, variantId, stockQuantity, reservedQuantity, reorderLevel
        FROM inventory
        WHERE variantId = ${dto.variantId}
        FOR UPDATE
      `;

      let currentStock = 0;
      let currentReserved = 0;
      let reorderLevel = 5;

      const firstRow = rows[0];
      if (firstRow) {
        currentStock = firstRow.stockQuantity;
        currentReserved = firstRow.reservedQuantity;
        reorderLevel = firstRow.reorderLevel;
      }

      const newStock = currentStock + dto.quantityChange;
      if (newStock < 0) {
        throw new BadRequestException(
          `Số lượng tồn kho sau điều chỉnh không thể âm (Hiện tại: ${currentStock}, Thay đổi: ${dto.quantityChange})`,
        );
      }

      if (newStock < currentReserved) {
        throw new BadRequestException(
          `Tồn kho sau điều chỉnh (${newStock}) không được nhỏ hơn số lượng đang tạm giữ (${currentReserved})`,
        );
      }

      const updated = await tx.inventory.upsert({
        where: { variantId: dto.variantId },
        create: {
          productId: dto.productId,
          variantId: dto.variantId,
          stockQuantity: newStock,
          reservedQuantity: 0,
          reorderLevel,
        },
        update: {
          stockQuantity: newStock,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: dto.productId,
          variantId: dto.variantId,
          type: MovementType.ADJUSTMENT,
          quantity: dto.quantityChange,
          stockBefore: currentStock,
          stockAfter: newStock,
          reservedBefore: currentReserved,
          reservedAfter: currentReserved,
          reason: dto.reason,
          referenceType: dto.referenceType || 'MANUAL_ADJUSTMENT',
          referenceId: dto.referenceId || null,
          performedBy: performedBy || 'SYSTEM',
          requestId: requestId || null,
        },
      });

      try {
        await tx.auditLog.create({
          data: {
            actorId: performedBy || 'SYSTEM',
            actorRole: 'WAREHOUSE',
            action: 'INVENTORY_ADJUST',
            entityType: 'INVENTORY',
            entityId: dto.variantId,
            oldValue: JSON.stringify({ stockQuantity: currentStock, reservedQuantity: currentReserved }),
            newValue: JSON.stringify({ stockQuantity: newStock, reservedQuantity: currentReserved }),
            ipAddress: null,
            requestId: requestId || null,
          },
        });
      } catch {
        // Non-blocking audit log
      }

      return {
        success: true,
        message: 'Điều chỉnh tồn kho thành công',
        inventory: {
          id: updated.id,
          productId: updated.productId,
          variantId: updated.variantId,
          stockQuantity: updated.stockQuantity,
          reservedQuantity: updated.reservedQuantity,
          availableQuantity: updated.stockQuantity - updated.reservedQuantity,
          reorderLevel: updated.reorderLevel,
          updatedAt: updated.updatedAt,
        },
      };
    });
  }

  // --- 5. KHỞI TẠO TỒN KHO BAN ĐẦU (INITIALIZE STOCK) ---
  async initStock(
    dto: InitInventoryDto,
    performedBy = 'SYSTEM',
  ): Promise<InventoryView> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.inventory.findUnique({
        where: { variantId: dto.variantId },
      });

      const stockBefore = existing?.stockQuantity || 0;
      const reservedBefore = existing?.reservedQuantity || 0;

      const record = await tx.inventory.upsert({
        where: { variantId: dto.variantId },
        create: {
          productId: dto.productId,
          variantId: dto.variantId,
          stockQuantity: dto.stockQuantity,
          reservedQuantity: 0,
          reorderLevel: dto.reorderLevel ?? 5,
        },
        update: {
          stockQuantity: dto.stockQuantity,
          reorderLevel: dto.reorderLevel ?? 5,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: dto.productId,
          variantId: dto.variantId,
          type: MovementType.PURCHASE,
          quantity: dto.stockQuantity,
          stockBefore,
          stockAfter: dto.stockQuantity,
          reservedBefore,
          reservedAfter: reservedBefore,
          reason: dto.reason || 'Khởi tạo tồn kho ban đầu',
          performedBy,
        },
      });

      return {
        id: record.id,
        productId: record.productId,
        variantId: record.variantId,
        stockQuantity: record.stockQuantity,
        reservedQuantity: record.reservedQuantity,
        availableQuantity: record.stockQuantity - record.reservedQuantity,
        reorderLevel: record.reorderLevel,
        updatedAt: record.updatedAt,
      };
    });
  }

  // --- 6. GIẢI PHÓNG CÁC RESERVATION HẾT HẠN (EXPIRED RESERVATION CLEANUP) ---
  async releaseExpiredReservations(): Promise<{ releasedCount: number }> {
    const expiredReservations = await this.prisma.inventoryReservation.findMany({
      where: {
        status: ReservationStatus.ACTIVE,
        expiresAt: { lte: new Date() },
      },
    });

    let count = 0;
    for (const res of expiredReservations) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const rows = await tx.$queryRaw<RawInventoryRow[]>`
            SELECT id, productId, variantId, stockQuantity, reservedQuantity, reorderLevel
            FROM inventory
            WHERE variantId = ${res.variantId}
            FOR UPDATE
          `;

          const inv = rows[0];
          if (inv) {
            const newReserved = Math.max(0, inv.reservedQuantity - res.quantity);

            await tx.inventory.update({
              where: { variantId: res.variantId },
              data: { reservedQuantity: newReserved },
            });

            await tx.inventoryReservation.update({
              where: { id: res.id },
              data: { status: ReservationStatus.EXPIRED },
            });

            await tx.inventoryMovement.create({
              data: {
                productId: inv.productId,
                variantId: res.variantId,
                type: MovementType.RELEASE_RESERVATION,
                quantity: res.quantity,
                stockBefore: inv.stockQuantity,
                stockAfter: inv.stockQuantity,
                reservedBefore: inv.reservedQuantity,
                reservedAfter: newReserved,
                reason: `Hết hạn tạm giữ (Tự động giải phóng sau ${res.expiresAt.toISOString()})`,
                referenceType: res.referenceType,
                referenceId: res.referenceId,
              },
            });
            count++;
          }
        });
      } catch (err) {
        logger.warn(`Lỗi khi giải phóng reservation hết hạn: ${res.reservationId}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info(`Đã giải phóng ${count} lượt tạm giữ tồn kho hết hạn`);
    return { releasedCount: count };
  }

  // --- 7. PUBLIC API: XEM TỒN KHO THEO SẢN PHẨM ---
  async getByProductId(productId: string): Promise<InventoryView[]> {
    const items = await this.prisma.inventory.findMany({
      where: { productId },
    });

    return items.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      stockQuantity: item.stockQuantity,
      reservedQuantity: item.reservedQuantity,
      availableQuantity: item.stockQuantity - item.reservedQuantity,
      reorderLevel: item.reorderLevel,
      updatedAt: item.updatedAt,
    }));
  }

  // --- 8. ADMIN API: CẢNH BÁO TỒN KHO THẤP (LOW STOCK) ---
  async getLowStock(): Promise<InventoryView[]> {
    const items = await this.prisma.inventory.findMany();

    return items
      .filter((item) => item.stockQuantity - item.reservedQuantity <= item.reorderLevel)
      .map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        stockQuantity: item.stockQuantity,
        reservedQuantity: item.reservedQuantity,
        availableQuantity: item.stockQuantity - item.reservedQuantity,
        reorderLevel: item.reorderLevel,
        updatedAt: item.updatedAt,
      }));
  }

  // --- 9. XEM LỊCH SỬ BIẾN ĐỘNG KHO (MOVEMENTS) ---
  async getMovements(variantId?: string, limit = 50) {
    return this.prisma.inventoryMovement.findMany({
      where: variantId ? { variantId } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // --- 10. ADMIN API: LẤY TOÀN BỘ TỒN KHO KÈM PHÂN TRANG & TÌM KIẾM ---
  async getAll(query?: { search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryWhereInput = {};
    if (query?.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { productId: { contains: s } },
        { variantId: { contains: s } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.inventory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.inventory.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        stockQuantity: item.stockQuantity,
        reservedQuantity: item.reservedQuantity,
        availableQuantity: item.stockQuantity - item.reservedQuantity,
        reorderLevel: item.reorderLevel,
        updatedAt: item.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}
