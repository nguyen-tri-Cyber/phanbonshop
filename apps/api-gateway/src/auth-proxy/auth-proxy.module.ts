import { Module } from '@nestjs/common';
import { AuthProxyController } from './auth-proxy.controller.js';

@Module({
  controllers: [AuthProxyController],
})
export class AuthProxyModule {}
