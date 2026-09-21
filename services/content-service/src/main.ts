import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { createLogger } from '@phanbonshop/logger';
import {
  validateStartupEnv,
  getCorsOrigins,
  CANONICAL_PORTS,
} from '@phanbonshop/config';

const logger = createLogger('content-service');

async function bootstrap(): Promise<void> {
  // 1. Startup Environment Validation
  validateStartupEnv('content-service', {
    requiredVars: ['JWT_ACCESS_SECRET', 'INTERNAL_SERVICE_SECRET'],
    requiredDatabaseUrl: 'CONTENT_DATABASE_URL',
  });

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // 2. CORS: Whitelist domain cụ thể (không dùng wildcard '*' kèm credentials: true)
  app.enableCors({
    origin: getCorsOrigins(),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
  const config = new DocumentBuilder()
    .setTitle('Phan Bon Shop - Content Service')
    .setDescription('Dịch vụ quản lý nội dung kiến thức nông nghiệp, tin tức kỹ thuật và banner khuyến mãi')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  }

  const port = Number(process.env.CONTENT_SERVICE_PORT) || CANONICAL_PORTS.CONTENT_SERVICE;
  await app.listen(port, '0.0.0.0');

  logger.info(`Content Service đã khởi động thành công trên cổng ${port}`, {
    port,
    database: 'content_db',
    swagger: process.env.NODE_ENV === 'production' ? 'disabled' : `http://localhost:${port}/docs`,
  });
}

bootstrap().catch((err) => {
  logger.error('Khởi động Content Service thất bại', err);
  process.exit(1);
});
