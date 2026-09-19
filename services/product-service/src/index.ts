import { createLogger } from '@phanbonshop/logger';
import { getEnvNumber, getEnvString } from '@phanbonshop/config';

const logger = createLogger('product-service');

export function bootstrap(): void {
  const port = getEnvNumber('PRODUCT_SERVICE_PORT', 4002);
  const nodeEnv = getEnvString('NODE_ENV', 'development');

  logger.info('Product service bootstrap skeleton initialized', {
    port,
    nodeEnv,
  });
}

bootstrap();
