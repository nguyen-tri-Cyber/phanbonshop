/**
 * Email Provider Interface
 *
 * Abstraction layer cho dịch vụ gửi email.
 * Production có thể dùng SMTP (Nodemailer, SendGrid, SES,...).
 * Local dev dùng DevEmailProvider hoặc Mailpit/MailHog.
 */

export interface EmailProvider {
  sendPasswordReset(
    email: string,
    resetToken: string,
    options?: { fullName?: string },
  ): Promise<void>;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
