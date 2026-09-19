import { createLogger } from '@phanbonshop/logger';
import { getEnvNumber, getEnvString } from '@phanbonshop/config';

const logger = createLogger('customer-service');

export function bootstrap(): void {
  const port = getEnvNumber('CUSTOMER_SERVICE_PORT', 4005);
  const nodeEnv = getEnvString('NODE_ENV', 'development');

  logger.info('Customer service bootstrap skeleton initialized', {
    port,
    nodeEnv,
  });
}

bootstrap();
