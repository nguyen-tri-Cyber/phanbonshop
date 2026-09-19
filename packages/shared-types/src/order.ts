/**
 * Order service contracts and DTOs
 */

import { AddressVN } from './common.js';
import { FertilizerPackageUnit } from './product.js';

export enum OrderStatus {
  PENDING_CONFIRMATION = 'PENDING_CONFIRMATION',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPING = 'SHIPPING',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  COD = 'COD',                       // Thanh toán khi nhận hàng
  BANK_TRANSFER = 'BANK_TRANSFER',   // Chuyển khoản ngân hàng (VietQR)
  VNPAY = 'VNPAY',                   // Cổng VNPAY
  MOMO = 'MOMO',                     // Ví điện tử MoMo
  DEBT_PERIOD = 'DEBT_PERIOD',       // Công nợ đại lý (theo chu kỳ mùa vụ)
}

export enum PaymentStatus {
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
}

export interface OrderItemDTO {
  id: string;
  variantId: string;
  productName: string;
  sku: string;
  unit: FertilizerPackageUnit;
  quantity: number;
  unitPriceVND: number;
  totalPriceVND: number;
}

export interface OrderDTO {
  id: string;
  orderCode: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  shippingAddress: AddressVN;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  items: OrderItemDTO[];
  subtotalVND: number;
  shippingFeeVND: number;
  discountVND: number;
  totalVND: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItemDTO {
  id?: string;
  cartId?: string;
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  sku: string;
  packageSize: string;
  unitPrice: number;
  price?: number;
  imageUrl?: string | null;
  quantity: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartDTO {
  id: string;
  userId: string;
  items: CartItemDTO[];
  totalItems: number;
  subtotal: number;
  createdAt: string;
  updatedAt: string;
}
