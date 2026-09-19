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
}

export interface PaymentInitResult {
  provider: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionReference?: string;
  paymentDetails?: Record<string, unknown>;
  instruction?: string;
}

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

/**
 * Giao diện trừu tượng hóa cho toàn bộ cổng/phương thức thanh toán
 * Cho phép cắm thêm VNPay, MoMo, ZaloPay, Stripe trong tương lai mà không sửa đổi core order logic
 */
export interface PaymentProvider {
  readonly providerName: string;
  readonly supportedMethod: PaymentMethod;

  initialize(params: PaymentInitParams): Promise<PaymentInitResult>;
  verify(params: PaymentVerifyParams): Promise<PaymentVerifyResult>;
}
