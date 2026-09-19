import { createLogger } from '@phanbonshop/logger';
import { getEnvNumber, getEnvString } from '@phanbonshop/config';

const logger = createLogger('order-service');

export function bootstrap(): void {
  const port = getEnvNumber('ORDER_SERVICE_PORT', 4003);
  const nodeEnv = getEnvString('NODE_ENV', 'development');

  logger.info('Order service bootstrap skeleton initialized', {
    port,
    nodeEnv,
  });
}

bootstrap();
