import { Injectable } from '@nestjs/common';
import {
  PaymentProvider,
  PaymentInitParams,
  PaymentInitResult,
  OrderPaymentPayload,
  PaymentCreationResult,
  PaymentWebhookResult,
  PaymentStatusResult,
  PaymentVerifyParams,
  PaymentVerifyResult,
} from './payment-provider.interface.js';
import { PaymentMethod, PaymentStatus } from '../../../generated/client/index.js';

@Injectable()
export class CodPaymentProvider implements PaymentProvider {
  readonly providerName = 'COD';
  readonly supportedMethod = PaymentMethod.COD;

  async createPayment(payload: OrderPaymentPayload): Promise<PaymentCreationResult> {
    return {
      provider: this.providerName,
      method: this.supportedMethod,
      status: PaymentStatus.PENDING,
      transactionReference: `COD-${payload.orderNumber}`,
      instruction:
        'Quý khách thanh toán tiền mặt trực tiếp cho nhân viên vận tải khi xe giao phân bón đến tận vườn/kho.',
      paymentDetails: {
        note: 'Thu hộ tiền mặt (COD)',
        collectAmount: payload.amount,
      },
    };
  }

  async verifyWebhook(_headers: Record<string, string>, _body: unknown): Promise<PaymentWebhookResult> {
    return {
      isValid: false,
      status: PaymentStatus.PENDING,
      isPaid: false,
      isFailed: false,
      isExpired: false,
      errorMessage: 'Phương thức thanh toán COD không hỗ trợ Webhook tự động.',
    };
  }

  async checkStatus(transactionId: string): Promise<PaymentStatusResult> {
    return {
      transactionId,
      status: PaymentStatus.PENDING,
      amount: 0,
      isPaid: false,
    };
  }

  async initialize(params: PaymentInitParams): Promise<PaymentInitResult> {
    return this.createPayment(params);
  }

  async verify(params: PaymentVerifyParams): Promise<PaymentVerifyResult> {
    return {
      success: true,
      transactionReference: params.transactionReference,
      amount: params.amount || 0,
      paidAt: new Date(),
    };
  }
}
