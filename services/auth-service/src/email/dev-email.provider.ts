import { Injectable, Logger } from '@nestjs/common';
import type { EmailProvider } from './email.provider.js';

/**
 * DevEmailProvider - Provider dùng cho môi trường development/test.
 *
 * Bảo mật:
 * - Trong production (NODE_ENV === 'production'): KHÔNG BAO GIỜ log plaintext token.
 *   Chỉ log metadata an toàn (masked email, timestamp).
 * - Trong development/test: Log token để developer/test script có thể lấy dùng.
 *
 * Lưu ý: Provider này cũng expose `lastSentToken` để automated test có thể truy xuất
 * token mà không cần parse log. Giá trị này chỉ được gán khi KHÔNG phải production.
 */
@Injectable()
export class DevEmailProvider implements EmailProvider {
  private readonly logger = new Logger(DevEmailProvider.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  /**
   * Token gửi gần nhất (chỉ lưu ở development/test, production luôn là null).
   * Được sử dụng bởi automated test scripts.
   */
  public lastSentToken: string | null = null;
  public lastSentEmail: string | null = null;

  async sendPasswordReset(
    email: string,
    resetToken: string,
    options?: { fullName?: string },
  ): Promise<void> {
    if (this.isProduction) {
      // Production: chỉ log metadata an toàn, KHÔNG log token
      const maskedEmail = this.maskEmail(email);
      this.logger.log(
        `[PASSWORD_RESET_EMAIL] Sent to ${maskedEmail} at ${new Date().toISOString()}`,
      );
      this.lastSentToken = null;
      this.lastSentEmail = null;
    } else {
      // Development/Test: log đầy đủ để debug và test
      const name = options?.fullName || 'Người dùng';
      this.logger.log('──────────────────────────────────────────────');
      this.logger.log(`📧 [DEV] Password Reset Email`);
      this.logger.log(`   To: ${email}`);
      this.logger.log(`   Name: ${name}`);
      this.logger.log(`   Token: ${resetToken}`);
      this.logger.log(`   Link: http://localhost:3000/reset-password?token=${resetToken}`);
      this.logger.log('──────────────────────────────────────────────');

      // Lưu lại để test script truy xuất
      this.lastSentToken = resetToken;
      this.lastSentEmail = email;
    }
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***@***';
    if (local.length <= 2) return `${local[0]}***@${domain}`;
    return `${local[0]}${local[1]}***@${domain}`;
  }
}
