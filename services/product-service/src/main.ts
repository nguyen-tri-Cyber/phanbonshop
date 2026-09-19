import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { createLogger } from '@phanbonshop/logger';

const logger = createLogger('product-service');

async function bootstrap(): Promise<void> {
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
    .setTitle('Phan Bon Shop - Product Service')
    .setDescription('Microservice quản lý danh mục sản phẩm, biến thể, hình ảnh và thuộc tính nông nghiệp')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PRODUCT_SERVICE_PORT) || 3002;
  await app.listen(port, '0.0.0.0');

  logger.info(`Product Service đã khởi động thành công trên cổng ${port}`, {
    port,
    database: 'product_db',
    swagger: `http://localhost:${port}/docs`,
  });
}

bootstrap().catch((err) => {
  logger.error('Khởi động Product Service thất bại', err);
  process.exit(1);
});
