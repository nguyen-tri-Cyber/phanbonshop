import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';
import { OrdersModule } from '../orders/orders.module.js';
import { CouponsModule } from '../coupons/coupons.module.js';
import { ShippingModule } from '../shipping/shipping.module.js';
import { CartModule } from '../cart/cart.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { CompensationModule } from '../compensation/compensation.module.js';

@Module({
  imports: [
    OrdersModule,
    CouponsModule,
    ShippingModule,
    CartModule,
    AuthModule,
    PaymentsModule,
    CompensationModule,
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
