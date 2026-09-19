import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { InternalSecretGuard } from './guards/internal-secret.guard.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret:
        process.env.JWT_ACCESS_SECRET ||
        'your_jwt_access_secret_key_phanbonshop_32chars_min',
    }),
  ],
  providers: [JwtStrategy, JwtAuthGuard, RolesGuard, InternalSecretGuard],
  exports: [
    PassportModule,
    JwtModule,
    JwtAuthGuard,
    RolesGuard,
    InternalSecretGuard,
  ],
})
export class AuthModule {}
