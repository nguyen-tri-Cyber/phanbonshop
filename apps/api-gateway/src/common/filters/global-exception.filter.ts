import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { createLogger } from '@phanbonshop/logger';
import { RequestWithId } from '../middleware/request-id.middleware.js';

const logger = createLogger('api-gateway');

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();
    const requestId = request.requestId || '';

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let errorMessage = 'Đã có lỗi hệ thống xảy ra, vui lòng thử lại sau';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        errorMessage = exceptionResponse;
        errorCode = this.getErrorCodeFromStatus(statusCode);
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resObj = exceptionResponse as Record<string, unknown>;

        // Trích xuất error message (đặc biệt là mảng validation messages từ ValidationPipe)
        if (Array.isArray(resObj.message)) {
          errorMessage = resObj.message.join('; ');
          errorCode = 'VALIDATION_ERROR';
        } else if (typeof resObj.message === 'string') {
          errorMessage = resObj.message;
          errorCode = (resObj.code as string) || this.getErrorCodeFromStatus(statusCode);
        } else {
          errorCode = this.getErrorCodeFromStatus(statusCode);
        }
      }
    } else if (exception instanceof Error) {
      // Đối với lỗi không xác định (Internal Server Error)
      logger.error(`[UnhandledError] ${exception.message}`, exception, {
        requestId,
        url: request.originalUrl || request.url,
        method: request.method,
      });

      if (process.env.NODE_ENV !== 'production') {
        errorMessage = exception.message;
      }
    }

    response.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
      },
      requestId,
    });
  }

  private getErrorCodeFromStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.REQUEST_TIMEOUT:
        return 'REQUEST_TIMEOUT';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
