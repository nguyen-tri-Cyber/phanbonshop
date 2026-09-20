import {
  Injectable,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { CouponsService } from '../coupons/coupons.service.js';
import { ShippingService } from '../shipping/shipping.service.js';
import { CartService } from '../cart/cart.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { CheckoutDto, CheckoutShippingAddressDto } from './dto/checkout.dto.js';
import {
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  IdempotencyStatus,
  CompensationTaskType,
} from '../../generated/client/index.js';
import { CompensationService } from '../compensation/compensation.service.js';
import { createLogger } from '@phanbonshop/logger';
import { getEnvString, getServiceUrl, CANONICAL_PORTS } from '@phanbonshop/config';
import crypto from 'node:crypto';

const logger = createLogger('order-service:checkout');

/**
 * Chuẩn hóa JSON một cách xác định (deterministic canonicalization)
 * bằng cách sắp xếp đệ quy các khóa của object.
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalizeJson(item)).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const parts: string[] = [];
  for (const k of sortedKeys) {
    const val = (obj as Record<string, unknown>)[k];
    if (val !== undefined) {
      parts.push(`${JSON.stringify(k)}:${canonicalizeJson(val)}`);
    }
  }
  return '{' + parts.join(',') + '}';
}

/**
 * Tính toán SHA-256 digest của payload đã được canonicalize
 */
export function computeRequestHash(payload: unknown): string {
  const canonical = canonicalizeJson(payload);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export interface ProcessCheckoutOptions {
  bypassInMemoryLock?: boolean;
}

interface CatalogVariant {
  id: string;
  sku: string;
  price: number | string;
  packageSize?: string;
  unit?: string;
  status: string;
}

interface CatalogProduct {
  id: string;
  name: string;
  status: string;
  variants?: CatalogVariant[];
}

interface ValidatedOrderItem {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

@Injectable()
export class CheckoutService {
  private readonly productServiceUrl = getServiceUrl(
    'PRODUCT_SERVICE_URL',
    CANONICAL_PORTS.PRODUCT_SERVICE,
  );
  private readonly inventoryServiceUrl = getServiceUrl(
    'INVENTORY_SERVICE_URL',
    CANONICAL_PORTS.INVENTORY_SERVICE,
  );
  private readonly customerServiceUrl = getServiceUrl(
    'CUSTOMER_SERVICE_URL',
    CANONICAL_PORTS.CUSTOMER_SERVICE,
  );
  private readonly internalSecret = getEnvString('INTERNAL_SERVICE_SECRET');

  private readonly inFlightRequests = new Map<string, Promise<unknown>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly couponsService: CouponsService,
    private readonly shippingService: ShippingService,
    private readonly cartService: CartService,
    private readonly paymentsService: PaymentsService,
    private readonly compensationService: CompensationService,
  ) {}

  /**
   * Tiến trình Checkout Saga Orchestrator:
   * 1. Check Idempotency (CustomerId + Idempotency-Key)
   * 2. Lấy & Validate danh sách sản phẩm
   * 3. Gọi Product Service lấy giá niêm yết hiện hành (bỏ qua giá client gửi)
   * 4. Tính toán Subtotal Server-side
   * 5. Thẩm định Coupon & Tính Discount Server-side
   * 6. Tính Phí Vận Chuyển Server-side theo vùng miền
   * 7. Tính Total Server-side
   * 8. Saga Step 1: Reserve tồn kho qua Inventory Service
   * 9. Saga Step 2: Tạo Order, Item Snapshot, Shipping Snapshot trong local MySQL transaction
   *    (Nếu fail -> Kích hoạt Bồi hoàn Compensation giải phóng kho)
   * 10. Saga Step 3: Tạo Payment Record
   * 11. Lưu Idempotency Record & Trả về kết quả
   */
  /**
   * Cố gắng claim quyền xử lý IdempotencyRecord trong database (Distributed Atomic Claim)
   */
  async claimIdempotencyRecord(
    customerId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<{ isOwner: boolean; isCompleted: boolean; recordId?: string; response?: unknown }> {
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000); // 24h

    // 1. Thử INSERT nguyên tử với status = PROCESSING
    try {
      const created = await this.prisma.idempotencyRecord.create({
        data: {
          customerId,
          idempotencyKey,
          requestPath: '/api/v1/checkout',
          requestHash,
          status: IdempotencyStatus.PROCESSING,
          expiresAt,
        },
      });
      return { isOwner: true, isCompleted: false, recordId: created.id };
    } catch (err: unknown) {
      // Bắt lỗi Unique Constraint Violation (P2002 của Prisma hoặc duplicate key của MySQL)
      const isUniqueConflict =
        (err as { code?: string })?.code === 'P2002' ||
        String(err).includes('Unique constraint failed') ||
        String(err).includes('ER_DUP_ENTRY');

      if (!isUniqueConflict) {
        throw err;
      }
    }

    // 2. Nếu gặp Unique Conflict: Load bản ghi hiện có từ Database
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        customerId_idempotencyKey: {
          customerId,
          idempotencyKey,
        },
      },
    });

    if (!existing) {
      // Trường hợp hiếm: bản ghi vừa bị xóa giữa create và findUnique -> đệ quy thử lại 1 lần
      return this.claimIdempotencyRecord(customerId, idempotencyKey, requestHash);
    }

    // 2.1. Kiểm tra Request Hash có khớp không
    if (existing.requestHash !== requestHash) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',
        message: 'Idempotency-Key đã được sử dụng cho một yêu cầu thanh toán khác với nội dung khác.',
      });
    }

    // 2.2. Nếu đã hoàn tất (COMPLETED): Trả lại response đã lưu
    if (existing.status === IdempotencyStatus.COMPLETED) {
      if (!existing.responseBody) {
        throw new InternalServerErrorException('Bản ghi hoàn tất nhưng không có dữ liệu phản hồi');
      }
      return {
        isOwner: false,
        isCompleted: true,
        response: JSON.parse(existing.responseBody),
      };
    }

    // 2.3. Nếu đang xử lý (PROCESSING):
    if (existing.status === IdempotencyStatus.PROCESSING) {
      const isStale = existing.updatedAt.getTime() < Date.now() - 120_000; // Quá 2 phút coi như stale
      if (!isStale) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_IN_PROGRESS',
          message: 'Yêu cầu thanh toán đang được xử lý, vui lòng không gửi lặp lại.',
        });
      }

      // Stale record: Thử atomic reclaim
      logger.warn(`IdempotencyRecord [${idempotencyKey}] bị kẹt PROCESSING quá 2 phút, tiến hành reclaim...`);
      const reclaimStale = await this.prisma.idempotencyRecord.updateMany({
        where: {
          id: existing.id,
          status: IdempotencyStatus.PROCESSING,
          updatedAt: existing.updatedAt,
        },
        data: {
          status: IdempotencyStatus.PROCESSING,
          requestHash,
          updatedAt: new Date(),
          responseBody: null,
          statusCode: null,
          orderId: null,
        },
      });

      if (reclaimStale.count > 0) {
        return { isOwner: true, isCompleted: false, recordId: existing.id };
      } else {
        throw new ConflictException({
          code: 'IDEMPOTENCY_IN_PROGRESS',
          message: 'Yêu cầu thanh toán đang được xử lý bởi một phiên khác.',
        });
      }
    }

    // 2.4. Nếu thất bại trước đó (FAILED): Policy retry an toàn
    if (existing.status === IdempotencyStatus.FAILED) {
      logger.info(`IdempotencyRecord [${idempotencyKey}] trước đó bị FAILED, tiến hành retry an toàn...`);
      const reclaimFailed = await this.prisma.idempotencyRecord.updateMany({
        where: {
          id: existing.id,
          status: IdempotencyStatus.FAILED,
          updatedAt: existing.updatedAt,
        },
        data: {
          status: IdempotencyStatus.PROCESSING,
          requestHash,
          updatedAt: new Date(),
          responseBody: null,
          statusCode: null,
          orderId: null,
        },
      });

      if (reclaimFailed.count > 0) {
        return { isOwner: true, isCompleted: false, recordId: existing.id };
      } else {
        throw new ConflictException({
          code: 'IDEMPOTENCY_IN_PROGRESS',
          message: 'Yêu cầu thanh toán đang được xử lý bởi một phiên khác.',
        });
      }
    }

    throw new ConflictException({
      code: 'IDEMPOTENCY_IN_PROGRESS',
      message: 'Trạng thái idempotency không xác định.',
    });
  }

  /**
   * Dọn dẹp các IdempotencyRecord ở trạng thái PROCESSING quá lâu (mặc định > 2 phút)
   * do worker/server instance bị crash đột ngột.
   */
  async cleanupStaleProcessingRecords(olderThanMs: number = 120_000): Promise<number> {
    const staleThreshold = new Date(Date.now() - olderThanMs);
    const result = await this.prisma.idempotencyRecord.updateMany({
      where: {
        status: IdempotencyStatus.PROCESSING,
        updatedAt: { lt: staleThreshold },
      },
      data: {
        status: IdempotencyStatus.FAILED,
        statusCode: 504,
        responseBody: JSON.stringify({
          success: false,
          error: {
            code: 'PROCESSING_TIMEOUT',
            message: 'Yêu cầu xử lý đã hết thời gian chờ (stale processing timeout)',
          },
        }),
      },
    });

    if (result.count > 0) {
      logger.info(`Đã dọn dẹp ${result.count} bản ghi idempotency PROCESSING quá hạn.`);
    }

    return result.count;
  }

  /**
   * Tiến trình Checkout Saga Orchestrator:
   * 1. Check Idempotency (CustomerId + Idempotency-Key) qua Database Distributed Lock
   * 2. Lấy & Validate danh sách sản phẩm
   * 3. Gọi Product Service lấy giá niêm yết hiện hành (bỏ qua giá client gửi)
   * 4. Tính toán Subtotal Server-side
   * 5. Thẩm định Coupon & Tính Discount Server-side
   * 6. Tính Phí Vận Chuyển Server-side theo vùng miền
   * 7. Tính Total Server-side
   * 8. Saga Step 1: Reserve tồn kho qua Inventory Service
   * 9. Saga Step 2: Tạo Order, Item Snapshot, Shipping Snapshot trong local MySQL transaction
   * 10. Saga Step 3: Tạo Payment Record & Cập nhật IdempotencyRecord -> COMPLETED
   *    (Nếu fail -> Kích hoạt Bồi hoàn Compensation giải phóng kho & cập nhật IdempotencyRecord -> FAILED)
   */
  async processCheckout(
    customerId: string,
    dto: CheckoutDto,
    idempotencyKey?: string,
    options?: ProcessCheckoutOptions,
  ) {
    if (idempotencyKey) {
      const lockKey = `${customerId}:${idempotencyKey}`;

      if (!options?.bypassInMemoryLock) {
        const inFlight = this.inFlightRequests.get(lockKey);
        if (inFlight) {
          logger.info(
            `Idempotency-Key [${idempotencyKey}] đang được xử lý đồng thời trong tiến trình này...`,
            { customerId },
          );
          return inFlight;
        }
      }

      const executionPromise = (async () => {
        const requestHash = computeRequestHash(dto);
        const claim = await this.claimIdempotencyRecord(customerId, idempotencyKey, requestHash);

        if (claim.isCompleted) {
          logger.info(
            `Idempotency-Key trùng lặp [${idempotencyKey}]. Trả lại kết quả đơn hàng đã tạo trước đó.`,
            { customerId },
          );
          return claim.response;
        }

        if (!claim.isOwner || !claim.recordId) {
          throw new ConflictException({
            code: 'IDEMPOTENCY_IN_PROGRESS',
            message: 'Yêu cầu thanh toán đang được xử lý, vui lòng không gửi lặp lại.',
          });
        }

        return this.executeCheckout(customerId, dto, idempotencyKey, claim.recordId);
      })();

      if (!options?.bypassInMemoryLock) {
        this.inFlightRequests.set(lockKey, executionPromise);
      }

      try {
        return await executionPromise;
      } finally {
        if (!options?.bypassInMemoryLock) {
          this.inFlightRequests.delete(lockKey);
        }
      }
    }

    return this.executeCheckout(customerId, dto);
  }

  private async executeCheckout(
    customerId: string,
    dto: CheckoutDto,
    idempotencyKey?: string,
    idempotencyRecordId?: string,
  ) {
    const requestId = idempotencyKey || `req-${crypto.randomUUID().slice(0, 8)}`;
    const reservedVariantIds: string[] = [];
    let batchReservationId: string | null = null;

    try {
      // 2. Xác định danh sách mặt hàng cần mua
      let rawItems = dto.items;
      if (!rawItems || rawItems.length === 0) {
        // Lấy từ giỏ hàng hiện tại của khách
        const userCart = await this.cartService.getOrCreateCart(customerId);
        if (!userCart.items || userCart.items.length === 0) {
          throw new BadRequestException(
            'Giỏ hàng của bạn đang trống. Vui lòng thêm sản phẩm trước khi thanh toán.',
          );
        }
        rawItems = userCart.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        }));
      }

      // 3. Xác định địa chỉ nhận hàng
      let shippingAddress: CheckoutShippingAddressDto | undefined = dto.shippingAddress;
      if (!shippingAddress && dto.addressId) {
        shippingAddress = await this.fetchCustomerAddress(customerId, dto.addressId);
      }
      if (!shippingAddress) {
        throw new BadRequestException(
          'Vui lòng cung cấp địa chỉ giao hàng (shippingAddress hoặc addressId).',
        );
      }

      // 4. Lấy giá niêm yết hiện hành từ Product Service & validate catalog
      // (Bỏ qua hoàn toàn price/subtotal/total do frontend gửi lên)
      const validatedItems: ValidatedOrderItem[] = [];
      let subtotal = 0;

      for (const item of rawItems) {
        const productData = await this.fetchProductCatalog(item.productId);
        if (!productData) {
          throw new BadRequestException(`Không tìm thấy sản phẩm ID: ${item.productId}`);
        }

        if (productData.status !== 'ACTIVE') {
          throw new BadRequestException(
            `Sản phẩm "${productData.name}" hiện không mở bán (Trạng thái: ${productData.status}).`,
          );
        }

        const variant = productData.variants?.find(
          (v: { id: string }) => v.id === item.variantId,
        );
        if (!variant) {
          throw new BadRequestException(
            `Không tìm thấy quy cách đóng gói (variant: ${item.variantId}) của sản phẩm "${productData.name}".`,
          );
        }

        if (variant.status !== 'ACTIVE') {
          throw new BadRequestException(
            `Quy cách đóng gói "${variant.packageSize}" của sản phẩm "${productData.name}" hiện tạm hết hàng hoặc ngừng kinh doanh.`,
          );
        }

        const officialUnitPrice = Number(variant.price);
        const quantity = Math.min(Math.max(1, item.quantity), 99);
        const lineTotal = officialUnitPrice * quantity;

        subtotal += lineTotal;

        validatedItems.push({
          productId: productData.id,
          variantId: variant.id,
          productName: productData.name,
          variantName: variant.packageSize || variant.unit || 'Tiêu chuẩn',
          sku: variant.sku,
          unitPrice: officialUnitPrice,
          quantity,
          lineTotal,
        });
      }

      // 5. Thẩm định Coupon & Tính Discount Server-side
      let discountAmount = 0;
      let isFreeShippingCoupon = false;
      let validatedCouponId: string | null = null;
      let validatedCouponCode: string | null = null;

      if (dto.couponCode && dto.couponCode.trim()) {
        const couponResult = await this.couponsService.validateCoupon(
          dto.couponCode,
          subtotal,
          customerId,
        );
        discountAmount = couponResult.discountAmount;
        isFreeShippingCoupon = couponResult.isFreeShipping;
        validatedCouponId = couponResult.couponId;
        validatedCouponCode = couponResult.code;
      }

      // 6. Tính Phí Vận Chuyển Server-side theo vùng miền nông nghiệp
      const shippingResult = this.shippingService.calculateShippingFee({
        provinceCode: shippingAddress.provinceCode,
        subtotal,
        isFreeShippingCoupon,
      });
      const shippingFee = shippingResult.shippingFee;

      // 7. Tính Tổng Thanh Toán Server-side
      const totalAmount = Math.max(0, subtotal - discountAmount + shippingFee);

      // 8. SAGA STEP 1: Reserve Inventory qua Inventory Service
      batchReservationId =
        'res-' + (idempotencyKey || crypto.randomUUID().replace(/-/g, ''));

      for (const item of validatedItems) {
        const itemReservationId = `${batchReservationId}-${item.variantId}`;
        const reserveSuccess = await this.reserveInventoryItem(
          {
            reservationId: itemReservationId,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            referenceType: 'ORDER',
            referenceId: batchReservationId,
          },
          requestId,
        );

        if (!reserveSuccess) {
          // Tồn kho không đủ -> Bồi hoàn giải phóng các item đã tạm giữ trước đó
          logger.warn(
            `Tạm giữ kho thất bại cho variant ${item.sku}. Kích hoạt bồi hoàn cho các item trước đó.`,
            { requestId, batchReservationId, failedVariantId: item.variantId },
          );
          for (const prevVariantId of reservedVariantIds) {
            const itemResId = `${batchReservationId}-${prevVariantId}`;
            const reason = 'Rollback do không đủ tồn kho mặt hàng khác';
            const released = await this.releaseInventoryItem(itemResId, reason, requestId);
            if (!released) {
              await this.compensationService.createTask(
                CompensationTaskType.RELEASE_INVENTORY,
                {
                  reservationId: itemResId,
                  reason,
                  requestId,
                },
              );
            }
          }
          throw new ConflictException(
            `Mặt hàng "${item.productName} (${item.variantName})" không đủ số lượng tồn kho khả dụng để phục vụ đơn hàng.`,
          );
        }

        reservedVariantIds.push(item.variantId);
      }

      // 9. SAGA STEP 2 & 3: Tạo Order trong order_db (Local Transaction)
      const orderNumber = this.ordersService.generateOrderNumber();

      const transactionResult = await this.prisma.$transaction(async (tx) => {
        // Tạo Order
        const order = await tx.order.create({
          data: {
            orderNumber,
            customerId,
            status: OrderStatus.PENDING,
            paymentStatus: PaymentStatus.PENDING,
            paymentMethod: dto.paymentMethod || PaymentMethod.COD,
            subtotal,
            discountAmount,
            shippingFee,
            totalAmount,
            couponCode: validatedCouponCode,
            customerNote: dto.customerNote || null,
            reservationId: batchReservationId,
          },
        });

        // Tạo OrderItems
        for (const item of validatedItems) {
          await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: item.productId,
              variantId: item.variantId,
              productName: item.productName,
              variantName: item.variantName,
              sku: item.sku,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              lineTotal: item.lineTotal,
            },
          });
        }

        // Tạo Shipping Address Snapshot
        await tx.orderShippingAddress.create({
          data: {
            orderId: order.id,
            recipientName: shippingAddress.recipientName,
            phone: shippingAddress.phone,
            provinceCode: shippingAddress.provinceCode,
            provinceName: shippingAddress.provinceName,
            districtCode: shippingAddress.districtCode,
            districtName: shippingAddress.districtName,
            wardCode: shippingAddress.wardCode,
            wardName: shippingAddress.wardName,
            addressLine: shippingAddress.addressLine,
          },
        });

        // Tạo Status History
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: null,
            toStatus: OrderStatus.PENDING,
            changedBy: 'CUSTOMER',
            note: 'Khởi tạo đơn hàng thành công qua Checkout',
          },
        });

        // Ghi nhận Coupon Usage nếu có
        if (validatedCouponId && validatedCouponCode) {
          const coupon = await tx.coupon.findUnique({
            where: { id: validatedCouponId },
          });

          if (!coupon || !coupon.enabled) {
            throw new BadRequestException(
              `Mã giảm giá "${validatedCouponCode}" không tồn tại hoặc đã bị vô hiệu`,
            );
          }

          const consumeResult = await tx.coupon.updateMany({
            where: {
              id: coupon.id,
              enabled: true,
              OR: [
                { usageLimit: null },
                { usedCount: { lt: coupon.usageLimit ?? 0 } },
              ],
            },
            data: { usedCount: { increment: 1 } },
          });

          if (consumeResult.count !== 1) {
            throw new BadRequestException(
              `Mã giảm giá "${validatedCouponCode}" đã hết lượt sử dụng`,
            );
          }

          await tx.couponUsage.create({
            data: {
              couponId: coupon.id,
              customerId,
              orderId: order.id,
            },
          });
        }

        // Tạo Payment Record qua PaymentsService
        const paymentResult = await this.paymentsService.createPaymentRecord(
          {
            orderId: order.id,
            orderNumber: order.orderNumber,
            amount: totalAmount,
            customerId,
          },
          dto.paymentMethod || PaymentMethod.COD,
          tx,
        );

        // Dọn sạch giỏ hàng của user
        await tx.cartItem.deleteMany({
          where: {
            cart: { userId: customerId },
          },
        });

        const responsePayload = {
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          subtotal: Number(order.subtotal),
          discountAmount: Number(order.discountAmount),
          shippingFee: Number(order.shippingFee),
          totalAmount: Number(order.totalAmount),
          couponCode: order.couponCode,
          reservationId: order.reservationId,
          items: validatedItems.map((i) => ({
            id: i.variantId,
            productId: i.productId,
            variantId: i.variantId,
            productName: i.productName,
            variantName: i.variantName,
            sku: i.sku,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            lineTotal: i.lineTotal,
          })),
          shippingAddress: {
            recipientName: shippingAddress.recipientName,
            phone: shippingAddress.phone,
            provinceCode: shippingAddress.provinceCode,
            provinceName: shippingAddress.provinceName,
            districtCode: shippingAddress.districtCode,
            districtName: shippingAddress.districtName,
            wardCode: shippingAddress.wardCode,
            wardName: shippingAddress.wardName,
            addressLine: shippingAddress.addressLine,
          },
          payment: paymentResult?.paymentRecord
            ? {
                id: paymentResult.paymentRecord.id,
                provider: paymentResult.paymentRecord.provider,
                method: paymentResult.paymentRecord.method,
                amount: Number(paymentResult.paymentRecord.amount),
                status: paymentResult.paymentRecord.status,
                transactionReference:
                  paymentResult.paymentRecord.transactionReference,
              }
            : null,
          paymentDetails: paymentResult?.paymentDetails || null,
          paymentInstruction: paymentResult?.instruction || null,
          payUrl:
            paymentResult?.payUrl ||
            (paymentResult?.paymentDetails as Record<string, unknown>)?.payUrl ||
            null,
          qrCodeUrl:
            paymentResult?.qrCodeUrl ||
            (paymentResult?.paymentDetails as Record<string, unknown>)?.qrCodeUrl ||
            null,
          createdAt: order.createdAt.toISOString(),
        };

        // 10. Cập nhật IdempotencyRecord -> COMPLETED ngay trong transaction
        if (idempotencyRecordId) {
          await tx.idempotencyRecord.update({
            where: { id: idempotencyRecordId },
            data: {
              status: IdempotencyStatus.COMPLETED,
              statusCode: 201,
              orderId: order.id,
              responseBody: JSON.stringify(responsePayload),
            },
          });
        }

        return { order, paymentResult, responsePayload };
      });

      return transactionResult.responsePayload;
    } catch (err: unknown) {
      // SAGA COMPENSATION: Giải phóng tồn kho nếu đã tạm giữ
      if (batchReservationId && reservedVariantIds.length > 0) {
        logger.error('Lỗi khi thực hiện Checkout Saga. Kích hoạt bồi hoàn giải phóng kho:', {
          requestId,
          batchReservationId,
          reservedCount: reservedVariantIds.length,
          error: err instanceof Error ? err.message : String(err),
        });
        for (const variantId of reservedVariantIds) {
          const itemResId = `${batchReservationId}-${variantId}`;
          const reason = 'Bồi hoàn do Checkout Saga thất bại';
          const released = await this.releaseInventoryItem(itemResId, reason, requestId);
          if (!released) {
            // Immediate release thất bại -> Persist CompensationTask PENDING vào DB để worker retry sau
            await this.compensationService.createTask(
              CompensationTaskType.RELEASE_INVENTORY,
              {
                reservationId: itemResId,
                reason,
                requestId,
              },
            );
          }
        }
      }

      // Cập nhật IdempotencyRecord sang FAILED nếu đã claim
      if (idempotencyRecordId) {
        try {
          const safeMessage = err instanceof Error ? err.message : 'Lỗi hệ thống';
          const statusCode = (err as { status?: number })?.status || 500;
          const errorCode =
            ((err as { response?: { code?: string } })?.response?.code) || 'CHECKOUT_FAILED';

          await this.prisma.idempotencyRecord.update({
            where: { id: idempotencyRecordId },
            data: {
              status: IdempotencyStatus.FAILED,
              statusCode,
              responseBody: JSON.stringify({
                success: false,
                error: {
                  code: errorCode,
                  message: safeMessage,
                },
              }),
            },
          });
        } catch (updateErr) {
          logger.warn('Không thể cập nhật IdempotencyRecord sang FAILED', {
            error: String(updateErr),
          });
        }
      }

      if (
        err instanceof BadRequestException ||
        err instanceof ConflictException ||
        err instanceof InternalServerErrorException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(
        `Không thể hoàn tất đơn hàng: ${errMsg || 'Lỗi hệ thống'}`,
      );
    }
  }

  /**
   * Gọi Product Service lấy thông tin sản phẩm và biến thể
   */
  private async fetchProductCatalog(productId: string): Promise<CatalogProduct | null> {
    try {
      const res = await fetch(`${this.productServiceUrl}/api/v1/products/${productId}`);
      if (!res.ok) {
        return null;
      }
      const data = (await res.json()) as { data?: CatalogProduct } & CatalogProduct;
      return data.data || data;
    } catch (err) {
      logger.error(`Lỗi kết nối product-service cho ID ${productId}:`, err);
      return null;
    }
  }

  /**
   * Lấy địa chỉ của khách hàng từ Customer Service qua endpoint nội bộ an toàn (chống IDOR)
   */
  private async fetchCustomerAddress(
    customerId: string,
    addressId: string,
  ): Promise<CheckoutShippingAddressDto> {
    let res: Response;
    try {
      res = await fetch(
        `${this.customerServiceUrl}/internal/v1/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addressId)}`,
        {
          headers: {
            'x-internal-secret': this.internalSecret,
          },
        },
      );
    } catch (err) {
      logger.error('Không thể kết nối đến Customer Service để xác thực địa chỉ:', err);
      throw new InternalServerErrorException(
        'Không thể kết nối đến Customer Service để xác thực địa chỉ.',
      );
    }

    if (res.status === 404) {
      throw new BadRequestException(
        'Địa chỉ giao hàng không hợp lệ hoặc không thuộc về tài khoản của bạn.',
      );
    }

    if (res.status === 403) {
      logger.error('Lỗi xác thực internal-secret khi gọi customer-service: 403 Forbidden');
      throw new InternalServerErrorException('Lỗi xác thực giao tiếp dịch vụ nội bộ.');
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      logger.error(`Lỗi từ Customer Service (${res.status}): ${errText}`);
      throw new BadRequestException('Không thể xác thực thông tin địa chỉ giao hàng.');
    }

    const json = (await res.json()) as Record<string, unknown>;
    const addr = (json.data || json) as Record<string, unknown>;

    return {
      recipientName: String(addr.recipientName || ''),
      phone: String(addr.phone || ''),
      provinceCode: String(addr.provinceCode || ''),
      provinceName: String(addr.provinceName || ''),
      districtCode: String(addr.districtCode || ''),
      districtName: String(addr.districtName || ''),
      wardCode: String(addr.wardCode || ''),
      wardName: String(addr.wardName || ''),
      addressLine: String(addr.addressLine || ''),
    };
  }

  /**
   * Gọi internal API của Inventory Service để tạm giữ tồn kho (Reserve)
   */
  private async reserveInventoryItem(
    payload: {
      reservationId: string;
      productId: string;
      variantId: string;
      quantity: number;
      referenceType: string;
      referenceId: string;
    },
    requestId?: string,
  ): Promise<boolean> {
    try {
      const res = await fetch(`${this.inventoryServiceUrl}/internal/v1/inventory/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': this.internalSecret,
          ...(requestId ? { 'X-Request-Id': requestId } : {}),
        },
        body: JSON.stringify(payload),
      });

      return res.ok;
    } catch (err) {
      logger.error('Lỗi khi gọi inventory-service reserve:', {
        requestId,
        reservationId: payload.reservationId,
        error: String(err),
      });
      return false;
    }
  }

  /**
   * Gọi internal API của Inventory Service để giải phóng tồn kho (Compensation Release)
   * Non-2xx được xem là thất bại và ủy quyền xử lý bồi hoàn.
   */
  private async releaseInventoryItem(
    reservationId: string,
    reason: string,
    requestId?: string,
  ): Promise<boolean> {
    return this.compensationService.callInventoryRelease(reservationId, reason, requestId);
  }
}
