import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { createLogger } from '@phanbonshop/logger';

const logger = createLogger('content-service');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.enableCors({
    origin: '*',
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

  const config = new DocumentBuilder()
    .setTitle('Phan Bon Shop - Content Service')
    .setDescription('Dịch vụ quản lý nội dung kiến thức nông nghiệp, tin tức kỹ thuật và banner khuyến mãi')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.CONTENT_SERVICE_PORT) || 4006;
  await app.listen(port, '0.0.0.0');

  logger.info(`Content Service đã khởi động thành công trên cổng ${port}`, {
    port,
    database: 'content_db',
    swagger: `http://localhost:${port}/docs`,
  });
}

bootstrap().catch((err) => {
  logger.error('Khởi động Content Service thất bại', err);
  process.exit(1);
});
