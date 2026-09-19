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

const logger = createLogger('api-gateway:product-proxy');

@ApiTags('Products, Categories & Brands (Proxy)')
@Controller('api/v1')
export class ProductProxyController {
  private readonly productServiceUrl = getServiceUrl(
    'PRODUCT_SERVICE_URL',
    CANONICAL_PORTS.PRODUCT_SERVICE,
  );

  @All(['products', 'products/*'])
  async handleProducts(
    @Req() req: RequestWithId,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    return this.forward(req, res);
  }

  @All(['categories', 'categories/*'])
  async handleCategories(
    @Req() req: RequestWithId,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    return this.forward(req, res);
  }

  @All(['brands', 'brands/*'])
  async handleBrands(
    @Req() req: RequestWithId,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    return this.forward(req, res);
  }

  @All(['reviews', 'reviews/*'])
  async handleReviews(
    @Req() req: RequestWithId,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    return this.forward(req, res);
  }

  private async forward(req: RequestWithId, res: Response): Promise<unknown> {
    const targetUrl = `${this.productServiceUrl}${req.originalUrl || req.url}`;
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
        // Cho phép truyền thẳng luồng tải file nhị phân
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
      logger.error(`Forwarding request to product-service failed: ${targetUrl}`, err);
      throw new HttpException(
        {
          code: 'BAD_GATEWAY',
          message: 'Không thể kết nối tới dịch vụ sản phẩm (Product Service)',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
