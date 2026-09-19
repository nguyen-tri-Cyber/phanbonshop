import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';
import { AuthModule } from '../auth/auth.module.js';

import { MinioModule } from '../minio/minio.module.js';

@Module({
  imports: [AuthModule, MinioModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
