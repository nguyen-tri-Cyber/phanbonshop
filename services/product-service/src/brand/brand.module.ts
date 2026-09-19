import { Module } from '@nestjs/common';
import { BrandController } from './brand.controller.js';
import { BrandService } from './brand.service.js';

@Module({
  controllers: [BrandController],
  providers: [BrandService],
  exports: [BrandService],
})
export class BrandModule {}
