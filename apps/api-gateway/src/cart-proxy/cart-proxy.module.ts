import { Module } from '@nestjs/common';
import { CartProxyController } from './cart-proxy.controller.js';

@Module({
  controllers: [CartProxyController],
})
export class CartProxyModule {}
