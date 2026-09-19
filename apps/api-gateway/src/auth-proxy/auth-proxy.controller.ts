import {
  Controller,
  All,
  Req,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { RequestWithId } from '../common/middleware/request-id.middleware.js';
import { createLogger } from '@phanbonshop/logger';
import { getServiceUrl, CANONICAL_PORTS } from '@phanbonshop/config';

const logger = createLogger('api-gateway:auth-proxy');

@ApiTags('Authentication (Proxy)')
@Controller('api/v1/auth')
export class AuthProxyController {
  private readonly authServiceUrl = getServiceUrl(
    'AUTH_SERVICE_URL',
    CANONICAL_PORTS.AUTH_SERVICE,
  );

  @All()
  async handleRoot(
    @Req() req: RequestWithId,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    return this.forward(req, res);
  }

  @All('*')
  async handleWildcard(
    @Req() req: RequestWithId,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    return this.forward(req, res);
  }

  private async forward(
    req: RequestWithId,
    res: Response,
  ): Promise<unknown> {
    const targetUrl = `${this.authServiceUrl}${req.originalUrl || req.url}`;
    const method = req.method;

    const headers: Record<string, string> = {};
    if (req.headers['content-type']) {
      headers['content-type'] = req.headers['content-type'] as string;
    } else if (method !== 'GET' && method !== 'HEAD') {
      headers['content-type'] = 'application/json';
    }

    if (req.headers['authorization']) {
      headers['authorization'] = req.headers['authorization'] as string;
    }

    if (req.requestId) {
      headers['x-request-id'] = req.requestId;
    } else if (req.headers['x-request-id']) {
      headers['x-request-id'] = req.headers['x-request-id'] as string;
    }

    if (req.headers['cookie']) {
      headers['cookie'] = req.headers['cookie'] as string;
    }

    if (req.headers['user-agent']) {
      headers['user-agent'] = req.headers['user-agent'] as string;
    }

    const clientIp =
      (req.headers['x-forwarded-for'] as string) ||
      req.ip ||
      req.socket?.remoteAddress;
    if (clientIp) {
      headers['x-forwarded-for'] = clientIp;
    }

    let body: string | undefined;
    if (method !== 'GET' && method !== 'HEAD' && req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    try {
      const upstreamRes = await fetch(targetUrl, {
        method,
        headers,
        body,
      });

      // Forward Set-Cookie header if provided by auth-service
      const setCookie = upstreamRes.headers.get('set-cookie');
      if (setCookie) {
        res.setHeader('set-cookie', setCookie);
      }

      res.status(upstreamRes.status);

      const contentType = upstreamRes.headers.get('content-type') || '';
      let data: unknown;
      if (contentType.includes('application/json')) {
        data = await upstreamRes.json();
      } else {
        data = await upstreamRes.text();
      }

      if (!upstreamRes.ok) {
        throw new HttpException(
          data as Record<string, unknown> | string,
          upstreamRes.status,
        );
      }

      return data;
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        throw err;
      }
      logger.error(`Forwarding request to auth-service failed: ${targetUrl}`, err);
      throw new HttpException(
        {
          code: 'BAD_GATEWAY',
          message: 'Không thể kết nối tới dịch vụ xác thực (Auth Service)',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
