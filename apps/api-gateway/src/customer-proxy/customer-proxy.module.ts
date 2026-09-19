import { Module } from '@nestjs/common';
import { CustomerProxyController } from './customer-proxy.controller.js';

@Module({
  controllers: [CustomerProxyController],
})
export class CustomerProxyModule {}
