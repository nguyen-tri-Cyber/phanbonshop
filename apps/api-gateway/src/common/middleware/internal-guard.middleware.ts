import { Injectable, NestMiddleware } from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { RequestWithId } from './request-id.middleware.js';
import { getEnvString, timingSafeCompare } from '@phanbonshop/config';

@Injectable()
export class InternalGuardMiddleware implements NestMiddleware {
  private readonly configuredSecret: string;

  constructor() {
    this.configuredSecret = getEnvString('INTERNAL_SERVICE_SECRET');
  }

  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const path = req.originalUrl || req.url;
    const isInternalPath = path.startsWith('/internal') || path.includes('/internal/');

    if (isInternalPath) {
      const incomingSecret = (req.headers['x-internal-secret'] || req.headers['X-Internal-Secret']) as string | undefined;

      if (!incomingSecret || !timingSafeCompare(incomingSecret, this.configuredSecret)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Đường dẫn nội bộ không cho phép truy cập trực tiếp từ Public Internet',
          },
          requestId: req.requestId || '',
        });
        return;
      }
    } else if (req.headers['x-internal-secret']) {
      // Bảo mật Ingress: Không cho phép client công khai giả mạo x-internal-secret
      delete req.headers['x-internal-secret'];
      delete req.headers['X-Internal-Secret'];
    }

    next();
  }
}
