export interface BaseAppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
}

export function getEnvString(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value !== undefined && value !== '') {
    return value;
  }
  if (defaultValue !== undefined) {
    return defaultValue;
  }
  throw new Error(`[ConfigError] Missing required environment variable: ${key}`);
}

export function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value !== undefined && value !== '') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
    throw new Error(`[ConfigError] Environment variable ${key} must be a valid number, got "${value}"`);
  }
  if (defaultValue !== undefined) {
    return defaultValue;
  }
  throw new Error(`[ConfigError] Missing required environment variable: ${key}`);
}

export function getEnvBoolean(key: string, defaultValue = false): boolean {
  const value = process.env[key];
  if (value !== undefined && value !== '') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return defaultValue;
}
