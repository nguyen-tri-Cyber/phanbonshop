import { Module } from '@nestjs/common';
import { BannersController } from './banners.controller.js';
import { BannersService } from './banners.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { MinioModule } from '../minio/minio.module.js';

@Module({
  imports: [AuthModule, MinioModule],
  controllers: [BannersController],
  providers: [BannersService],
  exports: [BannersService],
})
export class BannersModule {}
