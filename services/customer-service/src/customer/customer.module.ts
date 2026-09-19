import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller.js';
import { CustomerInternalController } from './customer-internal.controller.js';
import { CustomerService } from './customer.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CustomerController, CustomerInternalController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
