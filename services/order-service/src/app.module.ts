import { HealthController } from './health/health.controller.js';
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CartModule } from './cart/cart.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { CouponsModule } from './coupons/coupons.module.js';
import { ShippingModule } from './shipping/shipping.module.js';
import { CheckoutModule } from './checkout/checkout.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { CompensationModule } from './compensation/compensation.module.js';

@Module({
  controllers: [HealthController],
  imports: [
    PrismaModule,
    AuthModule,
    CartModule,
    OrdersModule,
    CouponsModule,
    ShippingModule,
    CheckoutModule,
    PaymentsModule,
    CompensationModule,
  ],
})
export class AppModule {}
