import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { createLogger } from '@phanbonshop/logger';

const logger = createLogger('api-gateway');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const reflector = app.get(Reflector);

  // 1. Security Headers (Helmet)
  // Cấu hình contentSecurityPolicy linh hoạt để Swagger UI tại /docs load được assets
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // 2. CORS: Cho phép local frontend http://localhost:3000
  app.enableCors({
    origin: ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Internal-Secret'],
    exposedHeaders: ['X-Request-ID'],
    credentials: true,
  });

  // 3. Global Interceptors
  app.useGlobalInterceptors(
    new TimeoutInterceptor(15000),
    new LoggingInterceptor(),
    new TransformInterceptor(reflector),
  );

  // 4. Global Validation Pipe
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

  // 5. Global Exception Filter (Chuẩn error response & ẩn stack trace)
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 6. Swagger OpenAPI Documentation tại /docs
  const config = new DocumentBuilder()
    .setTitle('Phan Bon Shop - API Gateway')
    .setDescription('Tài liệu API trung tâm cho nền tảng TMĐT Phân bón Việt Nam')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // 7. Lắng nghe Port 8080
  const port = Number(process.env.GATEWAY_PORT) || 8080;
  await app.listen(port, '0.0.0.0');

  logger.info(`API Gateway đã khởi động thành công trên cổng ${port}`, {
    port,
    healthEndpoint: `http://localhost:${port}/health`,
    readyEndpoint: `http://localhost:${port}/ready`,
    swaggerDocs: `http://localhost:${port}/docs`,
  });
}

bootstrap().catch((error) => {
  logger.error('Khởi động API Gateway thất bại', error);
  process.exit(1);
});
