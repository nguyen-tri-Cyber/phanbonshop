export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogMeta {
  service?: string;
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

export interface ILogger {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, error?: Error | unknown, meta?: LogMeta): void;
}

export class AppLogger implements ILogger {
  constructor(private readonly serviceName: string) {}

  private formatMessage(level: LogLevel, message: string, meta?: LogMeta): string {
    const timestamp = new Date().toISOString();
    const payload = {
      timestamp,
      level: level.toUpperCase(),
      service: this.serviceName,
      message,
      ...meta,
    };
    return JSON.stringify(payload);
  }

  debug(message: string, meta?: LogMeta): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  info(message: string, meta?: LogMeta): void {
    console.info(this.formatMessage('info', message, meta));
  }

  warn(message: string, meta?: LogMeta): void {
    console.warn(this.formatMessage('warn', message, meta));
  }

  error(message: string, error?: Error | unknown, meta?: LogMeta): void {
    const errorDetails = error instanceof Error 
      ? { errorName: error.name, errorMessage: error.message, stack: error.stack }
      : { error };
    console.error(this.formatMessage('error', message, { ...meta, ...errorDetails }));
  }
}

export function createLogger(serviceName: string): ILogger {
  return new AppLogger(serviceName);
}
