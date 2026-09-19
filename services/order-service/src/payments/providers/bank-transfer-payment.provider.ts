import { Injectable } from '@nestjs/common';
import {
  PaymentProvider,
  PaymentInitParams,
  PaymentInitResult,
  PaymentVerifyParams,
  PaymentVerifyResult,
} from './payment-provider.interface.js';
import { PaymentMethod, PaymentStatus } from '../../../generated/client/index.js';

export interface BankTransferConfig {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
  branch: string;
  transferInstruction: string;
}

@Injectable()
export class BankTransferPaymentProvider implements PaymentProvider {
  readonly providerName = 'MANUAL';
  readonly supportedMethod = PaymentMethod.BANK_TRANSFER;

  // Cấu hình tài khoản ngân hàng thụ hưởng chính thức của sàn
  private readonly config: BankTransferConfig = {
    bankName: 'Ngân Hàng TMCP Ngoại Thương Việt Nam (Vietcombank)',
    bankCode: 'VCB',
    accountNumber: '0123456789',
    accountHolder: 'CONG TY TNHH PHAN BON SHOP VIET NAM',
    branch: 'Chi nhánh Đắk Lắk - Buôn Ma Thuột',
    transferInstruction:
      'Quý khách vui lòng chuyển khoản đúng số tiền và ghi nội dung chuyển khoản chứa mã đơn hàng để hệ thống xác nhận tự động.',
  };

  getConfig(): BankTransferConfig {
    return { ...this.config };
  }

  async initialize(params: PaymentInitParams): Promise<PaymentInitResult> {
    const transferContent = params.orderNumber;
    const qrImageUrl = `https://img.vietqr.io/image/${this.config.bankCode}-${this.config.accountNumber}-compact2.png?amount=${params.amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(this.config.accountHolder)}`;

    return {
      provider: this.providerName,
      method: this.supportedMethod,
      status: PaymentStatus.PENDING,
      transactionReference: `BT-${params.orderNumber}`,
      instruction: this.config.transferInstruction,
      paymentDetails: {
        bankName: this.config.bankName,
        accountNumber: this.config.accountNumber,
        accountHolder: this.config.accountHolder,
        branch: this.config.branch,
        amount: params.amount,
        transferContent,
        memo: transferContent,
        qrImageUrl,
        transferInstruction: this.config.transferInstruction,
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
