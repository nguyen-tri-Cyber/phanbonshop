import { HealthController } from './health/health.controller.js';
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';

@Module({
  controllers: [HealthController],
  imports: [PrismaModule, AuthModule],
})
export class AppModule {}
