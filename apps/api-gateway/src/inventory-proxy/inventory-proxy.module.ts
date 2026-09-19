import { Module } from '@nestjs/common';
import { InventoryProxyController } from './inventory-proxy.controller.js';

@Module({
  controllers: [InventoryProxyController],
})
export class InventoryProxyModule {}
