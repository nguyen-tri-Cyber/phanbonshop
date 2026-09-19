import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw (
        err ||
        new UnauthorizedException('Yêu cầu xác thực tài khoản qua Bearer Token')
      );
    }
    return user;
  }
}
