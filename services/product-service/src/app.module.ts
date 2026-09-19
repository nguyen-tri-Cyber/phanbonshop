import { HealthController } from './health/health.controller.js';
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { MinioModule } from './minio/minio.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CategoryModule } from './category/category.module.js';
import { BrandModule } from './brand/brand.module.js';
import { ProductModule } from './product/product.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';

@Module({
  controllers: [HealthController],
  imports: [
    PrismaModule,
    MinioModule,
    AuthModule,
    CategoryModule,
    BrandModule,
    ProductModule,
    ReviewsModule,
  ],
})
export class AppModule {}
