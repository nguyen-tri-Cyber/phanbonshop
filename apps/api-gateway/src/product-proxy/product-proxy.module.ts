import { Module } from '@nestjs/common';
import { ProductProxyController } from './product-proxy.controller.js';

@Module({
  controllers: [ProductProxyController],
})
export class ProductProxyModule {}
