import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { HealthModule } from './health/health.module.js';
import { TestModule } from './test-sample/test.module.js';
import { AuthProxyModule } from './auth-proxy/auth-proxy.module.js';
import { ProductProxyModule } from './product-proxy/product-proxy.module.js';
import { InventoryProxyModule } from './inventory-proxy/inventory-proxy.module.js';
import { CartProxyModule } from './cart-proxy/cart-proxy.module.js';
import { CustomerProxyModule } from './customer-proxy/customer-proxy.module.js';
import { OrderProxyModule } from './order-proxy/order-proxy.module.js';
import { ContentProxyModule } from './content-proxy/content-proxy.module.js';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';
import { InternalGuardMiddleware } from './common/middleware/internal-guard.middleware.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 giây
        limit: 100, // Tối đa 100 requests / phút
      },
    ]),
    HealthModule,
    ...(process.env.NODE_ENV === 'production' ? [] : [TestModule]),
    AuthProxyModule,
    ProductProxyModule,
    InventoryProxyModule,
    CartProxyModule,
    CustomerProxyModule,
    OrderProxyModule,
    ContentProxyModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware, InternalGuardMiddleware)
      .forRoutes('*');
  }
}
