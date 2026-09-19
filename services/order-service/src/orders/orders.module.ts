import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller.js';
import { InternalOrdersController } from './internal-orders.controller.js';
import { OrdersService } from './orders.service.js';
import { CompensationModule } from '../compensation/compensation.module.js';

@Module({
  imports: [CompensationModule],
  controllers: [OrdersController, InternalOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
