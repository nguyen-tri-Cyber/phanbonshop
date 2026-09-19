import { HealthController } from './health/health.controller.js';
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { MinioModule } from './minio/minio.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PostsModule } from './posts/posts.module.js';
import { BannersModule } from './banners/banners.module.js';

@Module({
  controllers: [HealthController],
  imports: [
    PrismaModule,
    MinioModule,
    AuthModule,
    PostsModule,
    BannersModule,
  ],
})
export class AppModule {}
