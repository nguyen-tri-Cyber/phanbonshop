import { createLogger } from '@phanbonshop/logger';
import { getEnvNumber, getEnvString } from '@phanbonshop/config';

const logger = createLogger('auth-service');

export function bootstrap(): void {
  const port = getEnvNumber('AUTH_SERVICE_PORT', 4001);
  const nodeEnv = getEnvString('NODE_ENV', 'development');

  logger.info('Auth service bootstrap skeleton initialized', {
    port,
    nodeEnv,
  });
}

bootstrap();
