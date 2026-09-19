import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { CustomerModule } from './customer/customer.module.js';

@Module({
  imports: [PrismaModule, CustomerModule],
})
export class AppModule {}
