import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { getEnvString, timingSafeCompare } from '@phanbonshop/config';

@Injectable()
export class InternalSecretGuard implements CanActivate {
  private readonly internalSecret: string;

  constructor() {
    this.internalSecret = getEnvString('INTERNAL_SERVICE_SECRET');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const secret = (request.headers['x-internal-secret'] || request.headers['X-Internal-Secret']) as string | undefined;

    if (!secret || !timingSafeCompare(secret, this.internalSecret)) {
      throw new ForbiddenException(
        'Từ chối truy cập: API nội bộ yêu cầu khóa xác thực hệ thống hợp lệ (X-Internal-Secret)',
      );
    }

    return true;
  }
}
