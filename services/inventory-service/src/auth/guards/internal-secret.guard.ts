import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class InternalSecretGuard implements CanActivate {
  private readonly internalSecret =
    process.env.INTERNAL_SERVICE_SECRET ||
    'your_internal_service_mesh_shared_secret_2026';

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const secret = request.headers['x-internal-secret'];

    if (!secret || secret !== this.internalSecret) {
      throw new ForbiddenException(
        'Từ chối truy cập: API nội bộ yêu cầu khóa xác thực hệ thống hợp lệ (X-Internal-Secret)',
      );
    }

    return true;
  }
}
