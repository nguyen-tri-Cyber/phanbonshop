import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { createLogger } from '@phanbonshop/logger';
import { validateStartupEnv, CANONICAL_PORTS } from '@phanbonshop/config';

const logger = createLogger('customer-service');

async function bootstrap(): Promise<void> {
  // 0. Startup Environment Validation
  validateStartupEnv('customer-service', {
    requiredVars: ['JWT_ACCESS_SECRET', 'INTERNAL_SERVICE_SECRET'],
    requiredDatabaseUrl: 'CUSTOMER_DATABASE_URL',
    requiredServiceUrls: ['ORDER_SERVICE_URL'],
  });

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
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
    .setTitle('Phan Bon Shop - Customer Service')
    .setDescription('Dịch vụ quản lý hồ sơ khách hàng, đại lý, nông dân và sổ địa chỉ giao hàng')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  }

  const port = Number(process.env.CUSTOMER_SERVICE_PORT) || CANONICAL_PORTS.CUSTOMER_SERVICE;
  await app.listen(port, '0.0.0.0');

  logger.info(`Customer Service đã khởi động thành công trên cổng ${port}`, {
    port,
    database: 'customer_db',
    swagger: process.env.NODE_ENV === 'production' ? 'disabled' : `http://localhost:${port}/docs`,
  });
}

bootstrap().catch((err) => {
  logger.error('Khởi động Customer Service thất bại', err);
  process.exit(1);
});
