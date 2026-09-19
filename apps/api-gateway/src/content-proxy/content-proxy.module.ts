import { Module } from '@nestjs/common';
import { ContentProxyController } from './content-proxy.controller.js';

@Module({
  controllers: [ContentProxyController],
})
export class ContentProxyModule {}
