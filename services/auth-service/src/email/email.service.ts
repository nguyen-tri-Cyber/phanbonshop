import { Inject, Injectable } from '@nestjs/common';
import { EMAIL_PROVIDER, type EmailProvider } from './email.provider.js';

/**
 * EmailService - Wrapper service tiêm EmailProvider qua DI.
 * Cung cấp giao diện nghiệp vụ cho AuthService gọi gửi email.
 */
@Injectable()
export class EmailService {
  constructor(
    @Inject(EMAIL_PROVIDER)
    private readonly provider: EmailProvider,
  ) {}

  async sendPasswordReset(
    email: string,
    resetToken: string,
    options?: { fullName?: string },
  ): Promise<void> {
    return this.provider.sendPasswordReset(email, resetToken, options);
  }
}
