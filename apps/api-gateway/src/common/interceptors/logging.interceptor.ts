import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';
import { createLogger } from '@phanbonshop/logger';
import { RequestWithId } from '../middleware/request-id.middleware.js';

const logger = createLogger('api-gateway');

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithId>();
    const res = http.getResponse<Response>();

    const startTime = Date.now();
    const method = req.method;
    const url = req.originalUrl || req.url;
    const requestId = req.requestId || '';

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startTime;
          const statusCode = res.statusCode;

          logger.info(`[HTTP] ${method} ${url} ${statusCode} - ${durationMs}ms`, {
            requestId,
            method,
            url,
            statusCode,
            durationMs,
          });
        },
        error: (error: Error | unknown) => {
          const durationMs = Date.now() - startTime;
          logger.error(`[HTTP-ERR] ${method} ${url} failed after ${durationMs}ms`, error, {
            requestId,
            method,
            url,
            durationMs,
          });
        },
      }),
    );
  }
}
