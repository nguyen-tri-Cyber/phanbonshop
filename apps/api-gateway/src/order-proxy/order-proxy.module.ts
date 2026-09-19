import { Module } from '@nestjs/common';
import { OrderProxyController } from './order-proxy.controller.js';

@Module({
  controllers: [OrderProxyController],
})
export class OrderProxyModule {}
