import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { getEnvString } from '@phanbonshop/config';
import { JwtStrategy } from './jwt.strategy.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { InternalSecretGuard } from './guards/internal-secret.guard.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getEnvString('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  providers: [JwtStrategy, JwtAuthGuard, RolesGuard, InternalSecretGuard],
  exports: [PassportModule, JwtModule, JwtAuthGuard, RolesGuard, InternalSecretGuard],
})
export class AuthModule {}
