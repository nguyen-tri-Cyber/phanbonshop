import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Stream } from 'node:stream';
import { BYPASS_TRANSFORM_KEY } from '../decorators/bypass-transform.decorator.js';

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, SuccessResponse<T> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<SuccessResponse<T> | T> {
    const isBypassed = this.reflector.getAllAndOverride<boolean>(BYPASS_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isBypassed) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // Không đóng gói nếu response là Stream, Buffer, hoặc đã theo format { success: true, ... }
        if (data instanceof Stream || Buffer.isBuffer(data)) {
          return data;
        }

        if (data && typeof data === 'object' && 'success' in data && data.success === true) {
          return data;
        }

        return {
          success: true,
          data: data === undefined ? null : data,
        };
      }),
    );
  }
}
