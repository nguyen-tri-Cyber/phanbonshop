import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { createLogger } from '@phanbonshop/logger';

const logger = createLogger('auth-service');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.AUTH_SERVICE_PORT) || 3001;
  await app.listen(port, '0.0.0.0');

  logger.info(`Auth Service đã khởi động thành công trên cổng ${port}`, {
    port,
    database: 'auth_db',
  });
}

bootstrap().catch((err) => {
  logger.error('Khởi động Auth Service thất bại', err);
  process.exit(1);
});
