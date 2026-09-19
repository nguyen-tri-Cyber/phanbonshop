import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { createLogger } from '@phanbonshop/logger';
import { validateStartupEnv, CANONICAL_PORTS } from '@phanbonshop/config';

const logger = createLogger('order-service');

async function bootstrap(): Promise<void> {
  // 0. Startup Environment Validation
  validateStartupEnv('order-service', {
    requiredVars: ['JWT_ACCESS_SECRET', 'INTERNAL_SERVICE_SECRET'],
    requiredDatabaseUrl: 'ORDER_DATABASE_URL',
    requiredServiceUrls: [
      'PRODUCT_SERVICE_URL',
      'INVENTORY_SERVICE_URL',
      'CUSTOMER_SERVICE_URL',
    ],
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

  const config = new DocumentBuilder()
    .setTitle('Phan Bon Shop - Order & Cart Service')
    .setDescription('Microservice quản lý giỏ hàng, gộp giỏ hàng và xử lý đơn hàng phân bón')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.ORDER_SERVICE_PORT) || CANONICAL_PORTS.ORDER_SERVICE;
  await app.listen(port, '0.0.0.0');

  logger.info(`Order & Cart Service đã khởi động thành công trên cổng ${port}`, {
    port,
    database: 'order_db',
    swagger: `http://localhost:${port}/docs`,
  });
}

bootstrap().catch((err) => {
  logger.error('Khởi động Order Service thất bại', err);
  process.exit(1);
});
