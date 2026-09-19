import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { InventoryModule } from './inventory/inventory.module.js';

@Module({
  imports: [PrismaModule, AuthModule, InventoryModule],
})
export class AppModule {}
