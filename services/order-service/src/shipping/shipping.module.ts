import { Module } from '@nestjs/common';
import { ShippingService } from './shipping.service.js';

@Module({
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
