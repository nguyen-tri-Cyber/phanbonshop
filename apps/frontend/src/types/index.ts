export type UserRole =
  | 'CUSTOMER'
  | 'STAFF'
  | 'WAREHOUSE'
  | 'MANAGER'
  | 'ADMIN'
  | 'SUPER_ADMIN';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'SUSPENDED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface AuthSession {
  user: User;
  accessToken: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  requestId?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
  requestId?: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string | null;
  status: string;
  sortOrder: number;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string | null;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  unit: string;
  packageSize: string;
  price: string | number;
  compareAtPrice?: string | number | null;
  status: string;
}

export interface ProductImage {
  id: string;
  productId: string;
  objectKey: string;
  url: string;
  altText?: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface AgriculturalAttribute {
  id: string;
  productId: string;
  attributeType: 'CROP' | 'GROWTH_STAGE' | 'APPLICATION_METHOD' | 'NUTRIENT_TYPE';
  value: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription?: string | null;
  description?: string | null;
  composition?: string | null;
  usageInstructions?: string | null;
  storageInstructions?: string | null;
  warningInformation?: string | null;
  manufacturer?: string | null;
  origin?: string | null;
  price: string | number;
  compareAtPrice?: string | number | null;
  status: string;
  featured: boolean;
  bestSeller: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  category?: Category;
  brand?: Brand;
  variants?: ProductVariant[];
  images?: ProductImage[];
  agriculturalAttrs?: AgriculturalAttribute[];
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  productId: string;
  variantId: string;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  reorderLevel: number;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  variantId: string;
  type: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  reservedBefore: number;
  reservedAfter: number;
  reason: string;
  referenceType?: string | null;
  referenceId?: string | null;
  performedBy?: string | null;
  requestId?: string | null;
  createdAt: string;
}

export interface CartItem {
  id?: string;
  cartId?: string;
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  sku: string;
  packageSize: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface Cart {
  id: string;
  customerId?: string;
  items: CartItem[];
  subtotal: number;
  totalQuantity: number;
  updatedAt?: string;
}

export interface CustomerAddress {
  id: string;
  customerId?: string;
  recipientName: string;
  phone: string;
  provinceCode: string;
  provinceName: string;
  districtCode: string;
  districtName: string;
  wardCode: string;
  wardName: string;
  addressLine: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  addresses?: CustomerAddress[];
}

export interface VietnamWard {
  code: string;
  name: string;
}

export interface VietnamDistrict {
  code: string;
  name: string;
  wards: VietnamWard[];
}

export interface VietnamProvince {
  code: string;
  name: string;
  districts: VietnamDistrict[];
}

export interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  targetUrl: string | null;
  position: string;
  startAt: string | null;
  endAt: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPING'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export type PaymentMethod =
  | 'COD'
  | 'BANK_TRANSFER'
  | 'MOMO'
  | 'VNPAY'
  | 'CREDIT_CARD';

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  unitPrice: number | string;
  quantity: number;
  lineTotal: number | string;
}

export interface OrderShippingAddress {
  id?: string;
  orderId?: string;
  recipientName: string;
  phone: string;
  provinceCode: string;
  provinceName: string;
  districtCode: string;
  districtName: string;
  wardCode: string;
  wardName: string;
  addressLine: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  subtotal: number | string;
  discountAmount: number | string;
  shippingFee: number | string;
  totalAmount: number | string;
  couponCode?: string | null;
  customerNote?: string | null;
  cancelReason?: string | null;
  items?: OrderItem[];
  shippingAddress?: OrderShippingAddress | null;
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutItemPayload {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface CheckoutShippingAddressPayload {
  recipientName: string;
  phone: string;
  provinceCode: string;
  provinceName: string;
  districtCode: string;
  districtName: string;
  wardCode: string;
  wardName: string;
  addressLine: string;
}

export interface CheckoutPayload {
  items?: CheckoutItemPayload[];
  addressId?: string;
  shippingAddress?: CheckoutShippingAddressPayload;
  couponCode?: string;
  paymentMethod?: PaymentMethod;
  customerNote?: string;
}

export interface CheckoutResult {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  totalAmount: number;
  couponCode?: string | null;
  items: Array<{
    id: string;
    productId: string;
    variantId: string;
    productName: string;
    variantName: string;
    sku: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
  shippingAddress: CheckoutShippingAddressPayload;
  payment?: {
    id: string;
    provider: string;
    method: string;
    amount: number;
    status: string;
    transactionReference?: string;
  };
  paymentDetails?: Record<string, unknown> | null;
  payUrl?: string | null;
  qrCodeUrl?: string | null;
}

export interface CouponValidationResult {
  isFreeShipping?: boolean;
  valid: boolean;
  couponId?: string;
  code: string;
  name: string;
  discountType: 'PERCENT' | 'FIXED_AMOUNT';
  discountValue: number;
  discountAmount: number;
  maxDiscount?: number | null;
  minOrderValue?: number | null;
  message?: string;
}

