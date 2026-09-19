import { Injectable } from '@nestjs/common';
import {
  PaymentProvider,
  PaymentInitParams,
  PaymentInitResult,
  PaymentVerifyParams,
  PaymentVerifyResult,
} from './payment-provider.interface.js';
import { PaymentMethod, PaymentStatus } from '../../../generated/client/index.js';

@Injectable()
export class CodPaymentProvider implements PaymentProvider {
  readonly providerName = 'MANUAL';
  readonly supportedMethod = PaymentMethod.COD;

  async initialize(params: PaymentInitParams): Promise<PaymentInitResult> {
    return {
      provider: this.providerName,
      method: this.supportedMethod,
      status: PaymentStatus.PENDING,
      transactionReference: `COD-${params.orderNumber}`,
      instruction:
        'Quý khách thanh toán tiền mặt trực tiếp cho nhân viên vận tải khi xe giao phân bón đến tận vườn/kho.',
      paymentDetails: {
        note: 'Thu hộ tiền mặt (COD)',
        collectAmount: params.amount,
      },
    };
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
