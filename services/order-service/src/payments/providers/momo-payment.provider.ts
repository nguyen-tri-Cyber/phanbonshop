import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import crypto from 'node:crypto';
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
import { createLogger } from '@phanbonshop/logger';

const logger = createLogger('order-service:momo-provider');

export interface MomoConfig {
  partnerCode: string;
  accessKey: string;
  secretKey: string;
  apiEndpoint: string;
  queryEndpoint: string;
  redirectUrl: string;
  ipnUrl: string;
  partnerName?: string;
  storeId?: string;
}

export interface PublicMomoConfig {
  enabled: boolean;
  provider: 'MOMO';
  environment: 'sandbox' | 'production';
}

@Injectable()
export class MomoPaymentProvider implements PaymentProvider {
  readonly providerName = 'MOMO';
  readonly supportedMethod = PaymentMethod.MOMO;

  private readonly config: MomoConfig;
  private readonly enabled: boolean;
  private readonly isProduction = process.env.NODE_ENV === 'production';

  constructor() {
    this.enabled = ['1', 'true', 'yes'].includes(
      String(process.env.MOMO_ENABLED || 'false').toLowerCase(),
    );

    const requiredWhenEnabled = [
      'MOMO_PARTNER_CODE',
      'MOMO_ACCESS_KEY',
      'MOMO_SECRET_KEY',
      'MOMO_API_ENDPOINT',
      'MOMO_QUERY_ENDPOINT',
      'MOMO_REDIRECT_URL',
      'MOMO_IPN_URL',
    ];
    if (this.enabled) {
      const missing = requiredWhenEnabled.filter(
        (key) => !process.env[key] || process.env[key]?.trim() === '',
      );
      if (missing.length > 0) {
        throw new Error(
          `[ConfigError] MoMo is enabled but required variables are missing: ${missing.join(', ')}`,
        );
      }
    }

    this.config = {
      partnerCode: process.env.MOMO_PARTNER_CODE || '',
      accessKey: process.env.MOMO_ACCESS_KEY || '',
      secretKey: process.env.MOMO_SECRET_KEY || '',
      apiEndpoint: process.env.MOMO_API_ENDPOINT || '',
      queryEndpoint: process.env.MOMO_QUERY_ENDPOINT || '',
      redirectUrl: process.env.MOMO_REDIRECT_URL || '',
      ipnUrl: process.env.MOMO_IPN_URL || '',
      partnerName: process.env.MOMO_PARTNER_NAME || 'Phan Bón Shop',
      storeId: process.env.MOMO_STORE_ID || 'PhanBonShop',
    };
  }

  getConfig(): MomoConfig {
    return { ...this.config };
  }

  getPublicConfig(): PublicMomoConfig {
    return {
      enabled: this.enabled,
      provider: 'MOMO',
      environment: this.config.apiEndpoint.includes('test-payment') || !this.isProduction
        ? 'sandbox'
        : 'production',
    };
  }

  /**
   * Tạo chữ ký số HMAC-SHA256 theo chuẩn MoMo Payment Gateway
   */
  createHmacSignature(rawString: string): string {
    return crypto
      .createHmac('sha256', this.config.secretKey)
      .update(rawString)
      .digest('hex');
  }

  /**
   * Static helper tạo chữ ký MoMo
   */
  static generateSignature(rawString: string, secretKey: string): string {
    return crypto.createHmac('sha256', secretKey).update(rawString).digest('hex');
  }

  /**
   * So sánh an toàn hằng số thời gian (Timing-safe comparison) để chống tấn công Timing Attack
   */
  private compareSignatures(a: string, b: string): boolean {
    if (!a || !b) return false;
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * Khởi tạo giao dịch thanh toán MoMo (All-in-one / QR / App redirect)
   */
  async createPayment(payload: OrderPaymentPayload): Promise<PaymentCreationResult> {
    if (!this.enabled) {
      throw new ServiceUnavailableException('MoMo payment is not enabled');
    }
    const requestId = `${payload.orderNumber}_${Date.now()}`;
    const orderId = payload.orderNumber;
    const amount = Math.round(payload.amount);
    const orderInfo = payload.description || `Thanh toan don hang ${payload.orderNumber}`;
    const redirectUrl = payload.returnUrl || this.config.redirectUrl;
    const ipnUrl = this.config.ipnUrl;
    const requestType = 'captureWallet';
    const extraData = '';

    // Định dạng chuỗi ký chuẩn của MoMo Create Payment
    const rawSignature = `accessKey=${this.config.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${this.config.partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
    const signature = this.createHmacSignature(rawSignature);

    const requestBody = {
      partnerCode: this.config.partnerCode,
      partnerName: this.config.partnerName,
      storeId: this.config.storeId,
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      lang: 'vi',
      extraData,
      requestType,
      signature,
    };

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Gửi yêu cầu tới MoMo Gateway (hỗ trợ timeout & fallback sandbox ngoại tuyến)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const responseData = (await response.json()) as Record<string, unknown>;
        if (Number(responseData.resultCode) === 0 && responseData.payUrl) {
          logger.info(`Đã khởi tạo MoMo payment URL cho đơn ${payload.orderNumber}`);
          return {
            provider: this.providerName,
            method: this.supportedMethod,
            status: PaymentStatus.PENDING,
            transactionReference: `MOMO-${payload.orderNumber}`,
            transactionId: String(responseData.requestId || requestId),
            providerOrderId: orderId,
            providerRequestId: String(responseData.requestId || requestId),
            payUrl: String(responseData.payUrl),
            qrCodeUrl: String(responseData.qrCodeUrl || responseData.payUrl),
            instruction:
              'Quét mã MoMo hoặc nhấp liên kết để thanh toán qua cổng MoMo Sandbox.',
            expiresAt,
            paymentDetails: {
              ...responseData,
              expiresAt: expiresAt.toISOString(),
            },
          };
        }
      }
    } catch (err) {
      if (this.isProduction) {
        throw new ServiceUnavailableException(
          `MoMo Gateway is unavailable: ${(err as Error).message}`,
        );
      }
      logger.warn(
        `Không thể kết nối MoMo Gateway trực tiếp (${(err as Error).message}), chuyển sang cơ chế MoMo Sandbox Offline Fallback.`,
      );
    }

    if (this.isProduction) {
      throw new ServiceUnavailableException(
        'MoMo Gateway rejected the payment creation request',
      );
    }

    // Cơ chế Deterministic Mock Fallback khi offline hoặc môi trường test không có mạng ngoài
    const mockPayUrl = `https://test-payment.momo.vn/v2/gateway/pay?token=sandbox_${requestId}`;
    const mockQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(mockPayUrl)}`;

    return {
      provider: this.providerName,
      method: this.supportedMethod,
      status: PaymentStatus.PENDING,
      transactionReference: `MOMO-${payload.orderNumber}`,
      transactionId: requestId,
      providerOrderId: orderId,
      providerRequestId: requestId,
      payUrl: mockPayUrl,
      qrCodeUrl: mockQrUrl,
      instruction:
        'Quét mã MoMo hoặc nhấp liên kết để thanh toán qua cổng MoMo Sandbox.',
      expiresAt,
      paymentDetails: {
        partnerCode: this.config.partnerCode,
        orderId: payload.orderNumber,
        requestId,
        amount,
        payUrl: mockPayUrl,
        qrCodeUrl: mockQrUrl,
        isSandboxMock: true,
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  /**
   * Xác thực IPN Webhook gửi từ MoMo Gateway
   */
  async verifyWebhook(
    _headers: Record<string, string>,
    body: unknown,
  ): Promise<PaymentWebhookResult> {
    const data = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

    if (!this.enabled) {
      logger.warn('PAYMENT_WEBHOOK_PROVIDER_DISABLED', {
        provider: this.providerName,
      });
      return {
        isValid: false,
        status: PaymentStatus.FAILED,
        isPaid: false,
        isFailed: true,
        isExpired: false,
        errorMessage: 'MoMo payment is not enabled',
        rawResponse: data,
      };
    }

    const accessKey = this.config.accessKey;
    const amount = Number(data.amount || 0);
    const extraData = String(data.extraData ?? '');
    const message = String(data.message ?? '');
    const orderId = String(data.orderId ?? '');
    const orderInfo = String(data.orderInfo ?? '');
    const orderType = String(data.orderType ?? '');
    const partnerCode = String(data.partnerCode ?? '');
    const payType = String(data.payType ?? '');
    const requestId = String(data.requestId ?? '');
    const responseTime = Number(data.responseTime ?? 0);
    const resultCode = Number(data.resultCode ?? -1);
    const transId = String(data.transId ?? '');
    const signature = String(data.signature ?? '');

    // Chuỗi ký IPN chuẩn của MoMo
    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

    const expectedSignature = this.createHmacSignature(rawSignature);
    const isSignatureValid = this.compareSignatures(signature, expectedSignature);

    if (!isSignatureValid) {
      logger.warn('PAYMENT_WEBHOOK_INVALID_SIGNATURE', {
        provider: this.providerName,
        providerOrderId: orderId,
        providerRequestId: requestId,
      });
      return {
        isValid: false,
        status: PaymentStatus.FAILED,
        isPaid: false,
        isFailed: true,
        isExpired: false,
        errorMessage: 'Chữ ký số MoMo HMAC-SHA256 không hợp lệ (Signature Mismatch)',
        rawResponse: data,
      };
    }

    if (!orderId || amount <= 0) {
      return {
        isValid: false,
        status: PaymentStatus.FAILED,
        isPaid: false,
        isFailed: true,
        isExpired: false,
        errorMessage: 'Thông tin đơn hàng hoặc số tiền giao dịch MoMo không hợp lệ',
        rawResponse: data,
      };
    }

    // resultCode === 0: Giao dịch MoMo thành công
    if (resultCode === 0) {
      return {
        isValid: true,
        orderNumber: orderId,
        orderId: (data.customOrderId as string) || undefined,
        transactionId: transId || requestId,
        transactionReference: `MOMO-${orderId}`,
        providerOrderId: orderId,
        providerRequestId: requestId,
        providerTransactionId: transId,
        amount,
        status: PaymentStatus.PAID,
        isPaid: true,
        isFailed: false,
        isExpired: false,
        paidAt: responseTime ? new Date(responseTime) : new Date(),
        rawResponse: data,
      };
    }

    // resultCode === 1006 hoặc 1007: Người dùng hủy / hết thời gian thanh toán
    if (resultCode === 1006 || resultCode === 1007) {
      return {
        isValid: true,
        orderNumber: orderId,
        transactionId: transId || requestId,
        transactionReference: `MOMO-${orderId}`,
        providerOrderId: orderId,
        providerRequestId: requestId,
        providerTransactionId: transId || undefined,
        amount,
        status: PaymentStatus.EXPIRED,
        isPaid: false,
        isFailed: false,
        isExpired: true,
        errorMessage:
          message || 'Người dùng hủy thanh toán hoặc phiên giao dịch đã hết hạn',
        rawResponse: data,
      };
    }

    // Các lỗi giao dịch khác (số dư không đủ, lỗi ngân hàng thẻ...)
    return {
      isValid: true,
      orderNumber: orderId,
      transactionId: transId || requestId,
      transactionReference: `MOMO-${orderId}`,
      providerOrderId: orderId,
      providerRequestId: requestId,
      providerTransactionId: transId || undefined,
      amount,
      status: PaymentStatus.FAILED,
      isPaid: false,
      isFailed: true,
      isExpired: false,
      errorMessage: message || `Thanh toán MoMo thất bại với mã lỗi ${resultCode}`,
      rawResponse: data,
    };
  }

  /**
   * Tra cứu trạng thái giao dịch từ MoMo (Query Transaction Status)
   */
  async checkStatus(transactionId: string): Promise<PaymentStatusResult> {
    const requestId = `QUERY_${Date.now()}`;
    const rawSignature = `accessKey=${this.config.accessKey}&orderId=${transactionId}&partnerCode=${this.config.partnerCode}&requestId=${requestId}`;
    const signature = this.createHmacSignature(rawSignature);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(this.config.queryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerCode: this.config.partnerCode,
          requestId,
          orderId: transactionId,
          signature,
          lang: 'vi',
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        const resultCode = Number(data.resultCode);
        return {
          transactionId,
          transactionReference: `MOMO-${transactionId}`,
          status: resultCode === 0 ? PaymentStatus.PAID : PaymentStatus.PENDING,
          amount: Number(data.amount || 0),
          isPaid: resultCode === 0,
          metadata: data,
        };
      }
    } catch {
      // offline fallback
    }

    return {
      transactionId,
      transactionReference: `MOMO-${transactionId}`,
      status: PaymentStatus.PENDING,
      amount: 0,
      isPaid: false,
    };
  }

  async initialize(params: PaymentInitParams): Promise<PaymentInitResult> {
    return this.createPayment(params);
  }

  async verify(params: PaymentVerifyParams): Promise<PaymentVerifyResult> {
    const statusResult = await this.checkStatus(params.transactionReference);
    return {
      success: statusResult.isPaid,
      transactionReference: params.transactionReference,
      amount: statusResult.amount || params.amount || 0,
      paidAt: statusResult.paidAt,
    };
  }
}
