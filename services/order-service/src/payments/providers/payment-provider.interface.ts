import { PaymentMethod, PaymentStatus } from '../../../generated/client/index.js';

export interface PaymentInitParams {
  orderId: string;
  orderNumber: string;
  amount: number;
  customerId: string;
  customerPhone?: string;
  customerEmail?: string;
  customerName?: string;
  description?: string;
  ipAddress?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface PaymentInitResult {
  provider: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionReference?: string;
  transactionId?: string;
  payUrl?: string;
  qrCodeUrl?: string;
  paymentDetails?: Record<string, unknown>;
  instruction?: string;
  expiresAt?: Date;
}

export type OrderPaymentPayload = PaymentInitParams;
export type PaymentCreationResult = PaymentInitResult;

export interface PaymentVerifyParams {
  transactionReference: string;
  amount?: number;
}

export interface PaymentVerifyResult {
  success: boolean;
  transactionReference: string;
  amount: number;
  paidAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface PaymentWebhookResult {
  isValid: boolean;
  orderNumber?: string;
  orderId?: string;
  transactionId?: string;
  transactionReference?: string;
  amount?: number;
  status: PaymentStatus;
  isPaid: boolean;
  isFailed: boolean;
  isExpired: boolean;
  paidAt?: Date;
  rawResponse?: Record<string, unknown> | string;
  errorMessage?: string;
}

export interface PaymentStatusResult {
  transactionId: string;
  transactionReference?: string;
  status: PaymentStatus;
  amount: number;
  isPaid: boolean;
  paidAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Giao diện trừu tượng hóa cho toàn bộ cổng/phương thức thanh toán (COD, VietQR, MoMo, VNPay)
 * Cho phép cắm thêm bất kỳ provider nào mà không làm xáo trộn core order saga
 */
export interface PaymentProvider {
  readonly providerName: string;
  readonly supportedMethod: PaymentMethod;

  createPayment(payload: OrderPaymentPayload): Promise<PaymentCreationResult>;
  verifyWebhook(headers: Record<string, string>, body: unknown): Promise<PaymentWebhookResult>;
  checkStatus(transactionId: string): Promise<PaymentStatusResult>;

  // Tương thích ngược với các caller cũ
  initialize(params: PaymentInitParams): Promise<PaymentInitResult>;
  verify(params: PaymentVerifyParams): Promise<PaymentVerifyResult>;
}
