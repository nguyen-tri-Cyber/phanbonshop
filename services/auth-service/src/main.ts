import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { createLogger } from '@phanbonshop/logger';
import { validateStartupEnv, CANONICAL_PORTS } from '@phanbonshop/config';

const logger = createLogger('auth-service');

async function bootstrap(): Promise<void> {
  // 0. Startup Environment Validation
  validateStartupEnv('auth-service', {
    requiredVars: ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'INTERNAL_SERVICE_SECRET'],
    requiredDatabaseUrl: 'AUTH_DATABASE_URL',
  });

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

  const port = Number(process.env.AUTH_SERVICE_PORT) || CANONICAL_PORTS.AUTH_SERVICE;
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
