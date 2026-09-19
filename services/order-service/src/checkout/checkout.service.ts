import {
  Injectable,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { CouponsService } from '../coupons/coupons.service.js';
import { ShippingService } from '../shipping/shipping.service.js';
import { CartService } from '../cart/cart.service.js';
import { PaymentsService, CreatedPaymentResult } from '../payments/payments.service.js';
import { CheckoutDto, CheckoutShippingAddressDto } from './dto/checkout.dto.js';
import {
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  Order,
} from '../../generated/client/index.js';
import { createLogger } from '@phanbonshop/logger';
import crypto from 'node:crypto';

const logger = createLogger('order-service:checkout');

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
  private readonly productServiceUrl =
    process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';
  private readonly inventoryServiceUrl =
    process.env.INVENTORY_SERVICE_URL || 'http://localhost:3004';
  private readonly customerServiceUrl =
    process.env.CUSTOMER_SERVICE_URL || 'http://localhost:3005';
  private readonly internalSecret =
    process.env.INTERNAL_SERVICE_SECRET ||
    'your_internal_service_mesh_shared_secret_2026';

  private readonly inFlightRequests = new Map<string, Promise<unknown>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly couponsService: CouponsService,
    private readonly shippingService: ShippingService,
    private readonly cartService: CartService,
    private readonly paymentsService: PaymentsService,
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
  async processCheckout(
    customerId: string,
    dto: CheckoutDto,
    idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      const lockKey = `${customerId}:${idempotencyKey}`;
      const inFlight = this.inFlightRequests.get(lockKey);
      if (inFlight) {
        logger.info(
          `Idempotency-Key [${idempotencyKey}] đang được xử lý đồng thời, chờ request đầu hoàn tất...`,
          { customerId },
        );
        return inFlight;
      }

      const existingRecord = await this.prisma.idempotencyRecord.findUnique({
        where: {
          customerId_idempotencyKey: {
            customerId,
            idempotencyKey,
          },
        },
      });

      if (existingRecord) {
        logger.info(
          `Idempotency-Key trùng lặp [${idempotencyKey}]. Trả lại kết quả đơn hàng đã tạo trước đó.`,
          { customerId },
        );
        return JSON.parse(existingRecord.responseBody);
      }

      const checkoutPromise = this.executeCheckout(customerId, dto, idempotencyKey);
      this.inFlightRequests.set(lockKey, checkoutPromise);
      try {
        return await checkoutPromise;
      } finally {
        this.inFlightRequests.delete(lockKey);
      }
    }

    return this.executeCheckout(customerId, dto);
  }

  private async executeCheckout(
    customerId: string,
    dto: CheckoutDto,
    idempotencyKey?: string,
  ) {

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
      const fetched = await this.fetchCustomerAddress(customerId, dto.addressId);
      if (fetched) {
        shippingAddress = fetched;
      }
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
    let validatedCouponCode: string | null = null;

    if (dto.couponCode && dto.couponCode.trim()) {
      const couponResult = await this.couponsService.validateCoupon(
        dto.couponCode,
        subtotal,
        customerId,
      );
      discountAmount = couponResult.discountAmount;
      isFreeShippingCoupon = couponResult.isFreeShipping;
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
    const batchReservationId =
      'res-' + (idempotencyKey || crypto.randomUUID().replace(/-/g, ''));
    const reservedVariantIds: string[] = [];

    for (const item of validatedItems) {
      const itemReservationId = `${batchReservationId}-${item.variantId}`;
      const reserveSuccess = await this.reserveInventoryItem({
        reservationId: itemReservationId,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        referenceType: 'ORDER',
        referenceId: batchReservationId,
      });

      if (!reserveSuccess) {
        // Tồn kho không đủ -> Bồi hoàn giải phóng các item đã tạm giữ trước đó
        logger.warn(
          `Tạm giữ kho thất bại cho variant ${item.sku}. Kích hoạt bồi hoàn cho các item trước đó.`,
        );
        for (const prevVariantId of reservedVariantIds) {
          await this.releaseInventoryItem(
            `${batchReservationId}-${prevVariantId}`,
            'Rollback do không đủ tồn kho mặt hàng khác',
          );
        }
        throw new ConflictException(
          `Mặt hàng "${item.productName} (${item.variantName})" không đủ số lượng tồn kho khả dụng để phục vụ đơn hàng.`,
        );
      }

      reservedVariantIds.push(item.variantId);
    }

    // 9. SAGA STEP 2: Tạo Order trong order_db (Local Transaction)
    const orderNumber = this.ordersService.generateOrderNumber();
    let transactionResult: { order: Order; paymentResult: CreatedPaymentResult | null };

    try {
      transactionResult = await this.prisma.$transaction(async (tx) => {
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
        if (validatedCouponCode) {
          const coupon = await tx.coupon.findUnique({
            where: { code: validatedCouponCode },
          });
          if (coupon) {
            await tx.couponUsage.create({
              data: {
                couponId: coupon.id,
                customerId,
                orderId: order.id,
              },
            });
            await tx.coupon.update({
              where: { id: coupon.id },
              data: { usedCount: { increment: 1 } },
            });
          }
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

        return { order, paymentResult };
      });
    } catch (err: unknown) {
      // SAGA COMPENSATION: Giải phóng tồn kho nếu tạo DB thất bại
      logger.error('Lỗi khi lưu đơn hàng vào database. Kích hoạt bồi hoàn giải phóng kho:', err);
      for (const variantId of reservedVariantIds) {
        await this.releaseInventoryItem(
          `${batchReservationId}-${variantId}`,
          'Bồi hoàn do lưu đơn hàng database thất bại',
        );
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(
        `Không thể hoàn tất đơn hàng: ${errMsg || 'Lỗi hệ thống'}`,
      );
    }

    const { order: createdOrder, paymentResult: createdPaymentResult } = transactionResult;

    // Lấy lại đầy đủ thông tin đơn hàng vừa tạo
    const fullOrder = await this.ordersService.findOrderByIdOrNumber(
      createdOrder.id,
      customerId,
    );

    const responsePayload = {
      orderId: fullOrder.id,
      orderNumber: fullOrder.orderNumber,
      status: fullOrder.status,
      paymentStatus: fullOrder.paymentStatus,
      paymentMethod: fullOrder.paymentMethod,
      subtotal: Number(fullOrder.subtotal),
      discountAmount: Number(fullOrder.discountAmount),
      shippingFee: Number(fullOrder.shippingFee),
      totalAmount: Number(fullOrder.totalAmount),
      couponCode: fullOrder.couponCode,
      reservationId: fullOrder.reservationId,
      items: fullOrder.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        variantId: i.variantId,
        productName: i.productName,
        variantName: i.variantName,
        sku: i.sku,
        unitPrice: Number(i.unitPrice),
        quantity: i.quantity,
        lineTotal: Number(i.lineTotal),
      })),
      shippingAddress: fullOrder.shippingAddress,
      payment: createdPaymentResult?.paymentRecord
        ? {
            id: createdPaymentResult.paymentRecord.id,
            provider: createdPaymentResult.paymentRecord.provider,
            method: createdPaymentResult.paymentRecord.method,
            amount: Number(createdPaymentResult.paymentRecord.amount),
            status: createdPaymentResult.paymentRecord.status,
            transactionReference:
              createdPaymentResult.paymentRecord.transactionReference,
          }
        : null,
      paymentDetails: createdPaymentResult?.paymentDetails || null,
      paymentInstruction: createdPaymentResult?.instruction || null,
      createdAt: fullOrder.createdAt.toISOString(),
    };

    // 11. Lưu Idempotency Record
    if (idempotencyKey) {
      try {
        await this.prisma.idempotencyRecord.create({
          data: {
            customerId,
            idempotencyKey,
            requestPath: '/api/v1/checkout',
            responseBody: JSON.stringify(responsePayload),
            statusCode: 201,
            orderId: fullOrder.id,
          },
        });
      } catch (e) {
        // Không block response nếu lưu idempotency record lỗi
        logger.warn(
          `Không thể lưu bản ghi Idempotency: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    return responsePayload;
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
   * Lấy địa chỉ của khách hàng từ Customer Service
   */
  private async fetchCustomerAddress(
    _customerId: string,
    addressId: string,
  ): Promise<CheckoutShippingAddressDto | null> {
    try {
      const res = await fetch(
        `${this.customerServiceUrl}/api/v1/customers/addresses/${addressId}`,
        {
          headers: {
            'X-Internal-Secret': this.internalSecret,
          },
        },
      );
      if (!res.ok) {
        return null;
      }
      const json = (await res.json()) as Record<string, unknown>;
      return (json.data || json) as unknown as CheckoutShippingAddressDto;
    } catch {
      return null;
    }
  }

  /**
   * Gọi internal API của Inventory Service để tạm giữ tồn kho (Reserve)
   */
  private async reserveInventoryItem(payload: {
    reservationId: string;
    productId: string;
    variantId: string;
    quantity: number;
    referenceType: string;
    referenceId: string;
  }): Promise<boolean> {
    try {
      const res = await fetch(`${this.inventoryServiceUrl}/internal/v1/inventory/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': this.internalSecret,
        },
        body: JSON.stringify(payload),
      });

      return res.ok;
    } catch (err) {
      logger.error('Lỗi khi gọi inventory-service reserve:', err);
      return false;
    }
  }

  /**
   * Gọi internal API của Inventory Service để giải phóng tồn kho (Compensation Release)
   */
  private async releaseInventoryItem(
    reservationId: string,
    reason: string,
  ): Promise<void> {
    try {
      await fetch(`${this.inventoryServiceUrl}/internal/v1/inventory/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': this.internalSecret,
        },
        body: JSON.stringify({ reservationId, reason }),
      });
    } catch (err) {
      logger.error('Lỗi khi giải phóng tồn kho bồi hoàn:', err);
    }
  }
}
