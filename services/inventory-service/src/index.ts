import { createLogger } from '@phanbonshop/logger';
import { getEnvNumber, getEnvString } from '@phanbonshop/config';

const logger = createLogger('inventory-service');

export function bootstrap(): void {
  const port = getEnvNumber('INVENTORY_SERVICE_PORT', 4004);
  const nodeEnv = getEnvString('NODE_ENV', 'development');

  logger.info('Inventory service bootstrap skeleton initialized', {
    port,
    nodeEnv,
  });
}

bootstrap();
