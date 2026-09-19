import { Injectable, NestMiddleware } from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { RequestWithId } from './request-id.middleware.js';

@Injectable()
export class InternalGuardMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const path = req.originalUrl || req.url;
    const isInternalPath = path.startsWith('/internal') || path.includes('/internal/');

    if (isInternalPath) {
      const configuredSecret = process.env.INTERNAL_SERVICE_SECRET || 'your_internal_service_mesh_shared_secret_2026';
      const incomingSecret = req.headers['x-internal-secret'];

      if (!incomingSecret || incomingSecret !== configuredSecret) {
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
    }

    next();
  }
}
