import { Module } from '@nestjs/common';
import { EMAIL_PROVIDER } from './email.provider.js';
import { DevEmailProvider } from './dev-email.provider.js';
import { EmailService } from './email.service.js';

/**
 * EmailModule
 *
 * Đăng ký DevEmailProvider làm provider mặc định cho EMAIL_PROVIDER token.
 * Khi chuyển sang production SMTP, chỉ cần thay DevEmailProvider bằng
 * SmtpEmailProvider tại đây mà không ảnh hưởng đến AuthService.
 */
@Module({
  providers: [
    {
      provide: EMAIL_PROVIDER,
      useClass: DevEmailProvider,
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
