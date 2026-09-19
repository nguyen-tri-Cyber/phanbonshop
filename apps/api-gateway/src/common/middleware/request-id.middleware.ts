import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

export interface RequestWithId extends Request {
  requestId?: string;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const existingId = req.headers['x-request-id'];
    const requestId = (typeof existingId === 'string' && existingId.trim() !== '') 
      ? existingId 
      : randomUUID();

    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  }
}
