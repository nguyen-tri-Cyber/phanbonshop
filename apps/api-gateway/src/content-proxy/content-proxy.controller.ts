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

const logger = createLogger('api-gateway:content-proxy');

@ApiTags('Content, Blog & Banners (Proxy)')
@Controller('api/v1')
export class ContentProxyController {
  private readonly contentServiceUrl =
    process.env.CONTENT_SERVICE_URL || 'http://localhost:4006';

  @All(['posts', 'posts/*'])
  async handlePosts(
    @Req() req: RequestWithId,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    return this.forward(req, res);
  }

  @All(['banners', 'banners/*'])
  async handleBanners(
    @Req() req: RequestWithId,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    return this.forward(req, res);
  }

  private async forward(req: RequestWithId, res: Response): Promise<unknown> {
    const targetUrl = `${this.contentServiceUrl}${req.originalUrl || req.url}`;
    const method = req.method;

    const headers: Record<string, string> = {};
    const contentType = req.headers['content-type'] as string | undefined;

    if (contentType) {
      headers['content-type'] = contentType;
    } else if (method !== 'GET' && method !== 'HEAD') {
      headers['content-type'] = 'application/json';
    }

    if (req.headers['authorization']) {
      headers['authorization'] = req.headers['authorization'] as string;
    }

    if (req.headers['x-internal-secret']) {
      headers['x-internal-secret'] = req.headers['x-internal-secret'] as string;
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

    let body: RequestInit['body'] = undefined;
    const isMultipart = contentType && contentType.includes('multipart/form-data');

    if (method !== 'GET' && method !== 'HEAD') {
      if (isMultipart) {
        body = req as unknown as RequestInit['body'];
      } else if (req.body) {
        body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }
    }

    try {
      const fetchOptions: RequestInit & { duplex?: string } = {
        method,
        headers,
        body,
      };

      if (isMultipart) {
        fetchOptions.duplex = 'half';
      }

      const upstreamRes = await fetch(targetUrl, fetchOptions);

      res.status(upstreamRes.status);

      const upstreamContentType = upstreamRes.headers.get('content-type') || '';
      let data: unknown;
      if (upstreamContentType.includes('application/json')) {
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
      logger.error(`Forwarding request to content-service failed: ${targetUrl}`, err);
      throw new HttpException(
        {
          code: 'BAD_GATEWAY',
          message: 'Không thể kết nối tới dịch vụ nội dung (Content Service)',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
