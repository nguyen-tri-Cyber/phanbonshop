import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { CodPaymentProvider } from './providers/cod-payment.provider.js';
import { BankTransferPaymentProvider } from './providers/bank-transfer-payment.provider.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    CodPaymentProvider,
    BankTransferPaymentProvider,
  ],
  exports: [PaymentsService, CodPaymentProvider, BankTransferPaymentProvider],
})
export class PaymentsModule {}
