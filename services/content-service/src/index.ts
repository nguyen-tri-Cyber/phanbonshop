import { createLogger } from '@phanbonshop/logger';
import { getEnvNumber, getEnvString } from '@phanbonshop/config';

const logger = createLogger('content-service');

export function bootstrap(): void {
  const port = getEnvNumber('CONTENT_SERVICE_PORT', 4006);
  const nodeEnv = getEnvString('NODE_ENV', 'development');

  logger.info('Content service bootstrap skeleton initialized', {
    port,
    nodeEnv,
  });
}

bootstrap();
