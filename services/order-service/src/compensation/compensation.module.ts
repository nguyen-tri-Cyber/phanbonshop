import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CompensationService } from './compensation.service.js';

@Module({
  imports: [PrismaModule],
  providers: [CompensationService],
  exports: [CompensationService],
})
export class CompensationModule {}
