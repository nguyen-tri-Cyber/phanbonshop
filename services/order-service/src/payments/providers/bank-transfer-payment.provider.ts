import { Injectable } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'node:crypto';
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
  readonly providerName = 'VIETQR';
  readonly supportedMethod = PaymentMethod.BANK_TRANSFER;

  private readonly config: BankTransferConfig;

  constructor() {
    const requiredProductionConfig = {
      BANK_NAME: process.env.BANK_NAME,
      BANK_CODE: process.env.BANK_CODE,
      BANK_ACCOUNT_NUMBER: process.env.BANK_ACCOUNT_NUMBER,
      BANK_ACCOUNT_HOLDER: process.env.BANK_ACCOUNT_HOLDER,
    };
    if (process.env.NODE_ENV === 'production') {
      const missing = Object.entries(requiredProductionConfig)
        .filter(([, value]) => !value || value.startsWith('CHANGE_ME'))
        .map(([key]) => key);
      if (missing.length > 0) {
        throw new Error(`[ConfigError] Missing required bank configuration: ${missing.join(', ')}`);
      }
    }

    this.config = {
      bankName:
        process.env.BANK_NAME || 'Ngân Hàng TMCP Ngoại Thương Việt Nam (Vietcombank)',
      bankCode: process.env.BANK_CODE || 'VCB',
      accountNumber: process.env.BANK_ACCOUNT_NUMBER || '0123456789',
      accountHolder:
        process.env.BANK_ACCOUNT_HOLDER || 'CONG TY TNHH PHAN BON SHOP VIET NAM',
      branch: process.env.BANK_BRANCH || 'Chi nhánh Đắk Lắk - Buôn Ma Thuột',
      transferInstruction:
        'Quý khách vui lòng chuyển đúng số tiền và giữ nguyên mã tham chiếu để hệ thống đối soát chính xác.',
    };
  }

  getConfig(): BankTransferConfig {
    return { ...this.config };
  }

  async createPayment(payload: OrderPaymentPayload): Promise<PaymentCreationResult> {
    const providerRequestId = randomBytes(6).toString('hex').toUpperCase();
    const transferContent = `${payload.orderNumber}-${providerRequestId}`;
    const qrImageUrl = `https://img.vietqr.io/image/${this.config.bankCode}-${this.config.accountNumber}-compact2.png?amount=${payload.amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(this.config.accountHolder)}`;
    // Thời hạn giữ mã VietQR mặc định 15 phút đồng bộ với Reservation TTL
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    return {
      provider: this.providerName,
      method: this.supportedMethod,
      status: PaymentStatus.PENDING,
      transactionReference: `BT-${transferContent}`,
      providerOrderId: transferContent,
      providerRequestId,
      qrCodeUrl: qrImageUrl,
      instruction: this.config.transferInstruction,
      expiresAt,
      paymentDetails: {
        bankName: this.config.bankName,
        accountNumber: this.config.accountNumber,
        accountHolder: this.config.accountHolder,
        branch: this.config.branch,
        amount: payload.amount,
        transferContent,
        memo: transferContent,
        qrImageUrl,
        transferInstruction: this.config.transferInstruction,
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  async verifyWebhook(
    headers: Record<string, string>,
    body: unknown,
  ): Promise<PaymentWebhookResult> {
    const data = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

    // Bank transfers are reconciled manually unless an upstream integration is
    // explicitly configured with a dedicated shared webhook secret. Never trust
    // order/amount/transaction fields from an unauthenticated public request.
    const expectedSecret = process.env.VIETQR_WEBHOOK_SECRET;
    const receivedSecret = headers['x-vietqr-webhook-secret'];
    const expectedBuffer = Buffer.from(expectedSecret || '');
    const receivedBuffer = Buffer.from(receivedSecret || '');
    const authenticated =
      expectedBuffer.length > 0 &&
      expectedBuffer.length === receivedBuffer.length &&
      timingSafeEqual(expectedBuffer, receivedBuffer);

    if (!authenticated) {
      return {
        isValid: false,
        status: PaymentStatus.FAILED,
        isPaid: false,
        isFailed: true,
        isExpired: false,
        errorMessage: 'Webhook chuyển khoản không được xác thực',
        rawResponse: data,
      };
    }

    // Hỗ trợ webhook chuẩn ngân hàng / VietQR Payment Gateway
    const transferContent = String(
      data.content || data.description || data.memo || data.transferContent || '',
    );
    const amount = Number(data.amount || data.transferAmount || 0);
    const transactionId = String(
      data.transactionId || data.referenceCode || data.id || '',
    );

    // Mã tham chiếu gồm mã đơn và nonce riêng của payment attempt.
    const match = transferContent.match(/(DH-\d{8}-[A-Z0-9]+)-([A-F0-9]{12})/i);
    const orderNumber = match?.[1]?.toUpperCase();
    const providerRequestId = match?.[2]?.toUpperCase();
    const providerOrderId = match?.[0]?.toUpperCase();

    if (
      !orderNumber ||
      !providerOrderId ||
      !providerRequestId ||
      !transactionId ||
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      return {
        isValid: false,
        status: PaymentStatus.FAILED,
        isPaid: false,
        isFailed: true,
        isExpired: false,
        errorMessage: 'Nội dung chuyển khoản hoặc số tiền webhook không hợp lệ',
        rawResponse: data,
      };
    }

    return {
      isValid: true,
      orderNumber,
      transactionId,
      transactionReference: `BT-${providerOrderId}`,
      providerOrderId,
      providerRequestId,
      providerTransactionId: transactionId,
      amount,
      status: PaymentStatus.PAID,
      isPaid: true,
      isFailed: false,
      isExpired: false,
      paidAt: new Date(),
      rawResponse: data,
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
