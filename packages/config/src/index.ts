import crypto from 'node:crypto';

export interface BaseAppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
}

/**
 * Danh sách cổng Canonical được chuẩn hóa toàn hệ thống
 */
export const CANONICAL_PORTS = {
  GATEWAY: 8080,
  FRONTEND: 3000,
  AUTH_SERVICE: 3001,
  PRODUCT_SERVICE: 3002,
  ORDER_SERVICE: 3003,
  INVENTORY_SERVICE: 3004,
  CUSTOMER_SERVICE: 3005,
  CONTENT_SERVICE: 3006,
} as const;

export type ServiceUrlKey =
  | 'AUTH_SERVICE_URL'
  | 'PRODUCT_SERVICE_URL'
  | 'ORDER_SERVICE_URL'
  | 'INVENTORY_SERVICE_URL'
  | 'CUSTOMER_SERVICE_URL'
  | 'CONTENT_SERVICE_URL';

export type DatabaseUrlKey =
  | 'AUTH_DATABASE_URL'
  | 'PRODUCT_DATABASE_URL'
  | 'ORDER_DATABASE_URL'
  | 'INVENTORY_DATABASE_URL'
  | 'CUSTOMER_DATABASE_URL'
  | 'CONTENT_DATABASE_URL';

/**
 * Danh sách các secret/password mẫu mặc định của development.
 * Tuyệt đối không được phép sử dụng trong môi trường production!
 */
export const INSECURE_DEV_SECRETS = [
  'admin123456',
  'root_secret',
  'redis_secret',
  'phanbon_secret',
  'your_jwt_access_secret_key_phanbonshop_32chars_min',
  'your_jwt_refresh_secret_key_phanbonshop_32chars_min',
  'your_internal_service_mesh_shared_secret_2026',
] as const;

/**
 * So sánh 2 chuỗi bí mật an toàn với timing attacks bằng constant-time comparison
 */
export function timingSafeCompare(a?: string | null, b?: string | null): boolean {
  if (!a || !b) {
    return false;
  }
  const hashA = crypto.createHash('sha256').update(String(a)).digest();
  const hashB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
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

export function getRequiredEnv(key: string): string {
  return getEnvString(key);
}

export function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value !== undefined && value !== '') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
    throw new Error(
      `[ConfigError] Environment variable ${key} must be a valid number, got "${value}"`,
    );
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

export const DEFAULT_SERVICE_PORTS: Record<ServiceUrlKey, number> = {
  AUTH_SERVICE_URL: CANONICAL_PORTS.AUTH_SERVICE,
  PRODUCT_SERVICE_URL: CANONICAL_PORTS.PRODUCT_SERVICE,
  ORDER_SERVICE_URL: CANONICAL_PORTS.ORDER_SERVICE,
  INVENTORY_SERVICE_URL: CANONICAL_PORTS.INVENTORY_SERVICE,
  CUSTOMER_SERVICE_URL: CANONICAL_PORTS.CUSTOMER_SERVICE,
  CONTENT_SERVICE_URL: CANONICAL_PORTS.CONTENT_SERVICE,
};

/**
 * Đọc Service URL nội bộ giữa các microservices hoặc từ API Gateway.
 * - Trong production: Bắt buộc cấu hình qua biến môi trường. Tuyệt đối cấm fallback về localhost.
 * - Trong development/test: Cho phép fallback về localhost với port canonical tương ứng.
 */
export function getServiceUrl(key: ServiceUrlKey, defaultLocalPort?: number): string {
  const val = process.env[key];
  const isProduction = process.env.NODE_ENV === 'production';

  if (val && val.trim() !== '') {
    const trimmed = val.trim();
    if (isProduction && (trimmed.includes('localhost') || trimmed.includes('127.0.0.1'))) {
      throw new Error(
        `[ConfigError] Production environment detected, but ${key} is pointing to localhost (${trimmed}). Production requires explicit inter-service domain or DNS.`,
      );
    }
    return trimmed;
  }

  if (isProduction) {
    throw new Error(
      `[ConfigError] Production requires explicit environment variable: ${key}. Localhost fallback is strictly prohibited in production.`,
    );
  }

  const fallbackPort = defaultLocalPort ?? DEFAULT_SERVICE_PORTS[key];
  if (fallbackPort !== undefined) {
    return `http://localhost:${fallbackPort}`;
  }

  throw new Error(`[ConfigError] Missing required service URL for ${key}`);
}

/**
 * Đọc Database URL cho các service.
 * - Trong production: Bắt buộc cấu hình qua biến môi trường. Tuyệt đối cấm fallback về localhost hoặc password mặc định phanbon_secret.
 * - Trong development/test: Cho phép fallback về MySQL local port 3307.
 */
export function getDatabaseUrl(key: DatabaseUrlKey, defaultDbName: string): string {
  const val = process.env[key];
  const isProduction = process.env.NODE_ENV === 'production';

  if (val && val.trim() !== '') {
    const trimmed = val.trim();
    if (isProduction && (trimmed.includes('localhost') || trimmed.includes('127.0.0.1') || trimmed.includes('phanbon_secret'))) {
      throw new Error(
        `[ConfigError] Production environment detected, but ${key} contains localhost or default development credentials. Production requires dedicated production database credentials.`,
      );
    }
    return trimmed;
  }

  if (isProduction) {
    throw new Error(
      `[ConfigError] Production requires explicit environment variable: ${key}. Localhost fallback is strictly prohibited in production.`,
    );
  }

  return `mysql://phanbon_user:phanbon_secret@localhost:3307/${defaultDbName}`;
}

/**
 * Trả về danh sách domain được phép truy cập CORS.
 * - Trong production: Đọc từ CORS_ALLOWED_ORIGINS (phân tách dấu phẩy), bắt buộc phải có domain cụ thể.
 * - Trong development/test: Mặc định http://localhost:3000 và http://127.0.0.1:3000.
 */
export function getCorsOrigins(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS;
  const isProduction = process.env.NODE_ENV === 'production';

  if (raw && raw.trim() !== '') {
    const origins = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (origins.length > 0) {
      if (isProduction && origins.includes('*')) {
        throw new Error(
          '[ConfigError] Wildcard CORS origin ("*") is prohibited in production when credentials are enabled.',
        );
      }
      return origins;
    }
  }

  if (isProduction) {
    throw new Error(
      '[ConfigError] Missing required CORS_ALLOWED_ORIGINS in production environment. Specify comma-separated allowed domains.',
    );
  }

  return ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

export interface ValidateStartupEnvOptions {
  requiredVars?: string[];
  requiredServiceUrls?: ServiceUrlKey[];
  requiredDatabaseUrl?: DatabaseUrlKey;
  checkInsecureSecrets?: boolean;
}

/**
 * Kiểm tra xác thực biến môi trường khi ứng dụng khởi động (Startup Validation).
 * Dừng ngay tiến trình (fail fast) nếu phát hiện thiếu biến môi trường hoặc dùng secret mặc định trong production.
 */
export function validateStartupEnv(
  serviceName: string,
  options: ValidateStartupEnvOptions = {},
): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const errors: string[] = [];

  // 1. Kiểm tra các biến bắt buộc chung
  if (options.requiredVars) {
    for (const varName of options.requiredVars) {
      const val = process.env[varName];
      if (!val || val.trim() === '') {
        errors.push(`Missing required environment variable: ${varName}`);
      }
    }
  }

  // 2. Kiểm tra Database URL nếu service có dùng DB
  if (options.requiredDatabaseUrl) {
    try {
      getDatabaseUrl(options.requiredDatabaseUrl, 'db_check');
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  // 3. Kiểm tra các Service URLs downstream
  if (options.requiredServiceUrls) {
    for (const urlKey of options.requiredServiceUrls) {
      try {
        getServiceUrl(urlKey);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
  }

  // 4. Trong Production: Quét và chặn các insecure dev secrets
  if (isProduction && options.checkInsecureSecrets !== false) {
    const secretVarsToCheck = [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'INTERNAL_SERVICE_SECRET',
      'MYSQL_PASSWORD',
      'MYSQL_ROOT_PASSWORD',
      'REDIS_PASSWORD',
      'MINIO_ROOT_PASSWORD',
    ];

    for (const sVar of secretVarsToCheck) {
      const val = process.env[sVar];
      if (val && INSECURE_DEV_SECRETS.includes(val as (typeof INSECURE_DEV_SECRETS)[number])) {
        errors.push(
          `Biến môi trường ${sVar} đang sử dụng giá trị placeholder mặc định không an toàn của dev: "${val}". Cấm sử dụng trong production!`,
        );
      }
    }
  }

  if (errors.length > 0) {
    const message = `[FATAL STARTUP ERROR] Khởi động ${serviceName} thất bại do vi phạm cấu hình môi trường:\n- ${errors.join('\n- ')}`;
    console.error(message);
    throw new Error(message);
  }
}
