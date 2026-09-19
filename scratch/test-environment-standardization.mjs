import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Import config dist
const configDistPath = path.resolve(rootDir, 'packages/config/dist/index.js');
const {
  CANONICAL_PORTS,
  INSECURE_DEV_SECRETS,
  timingSafeCompare,
  getEnvString,
  getEnvNumber,
  getEnvBoolean,
  getServiceUrl,
  getDatabaseUrl,
  getCorsOrigins,
  validateStartupEnv,
} = await import(pathToFileURL(configDistPath).href);

console.log('=== TEST SUITE: ENVIRONMENT STANDARDIZATION & SECURITY GUARDS ===\n');

let totalTests = 0;
let passedTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
  }
}

// 1. Canonical Ports
console.log('1. Canonical Ports Verification:');
it('should define all canonical ports accurately', () => {
  assert.strictEqual(CANONICAL_PORTS.GATEWAY, 8080);
  assert.strictEqual(CANONICAL_PORTS.FRONTEND, 3000);
  assert.strictEqual(CANONICAL_PORTS.AUTH_SERVICE, 3001);
  assert.strictEqual(CANONICAL_PORTS.PRODUCT_SERVICE, 3002);
  assert.strictEqual(CANONICAL_PORTS.ORDER_SERVICE, 3003);
  assert.strictEqual(CANONICAL_PORTS.INVENTORY_SERVICE, 3004);
  assert.strictEqual(CANONICAL_PORTS.CUSTOMER_SERVICE, 3005);
  assert.strictEqual(CANONICAL_PORTS.CONTENT_SERVICE, 3006);
});

// 2. Development Mode Behavior
console.log('\n2. Development Mode Behavior (Fallback to localhost & default ports):');
it('should fallback to localhost and canonical port in development mode', () => {
  const originalEnv = { ...process.env };
  try {
    process.env.NODE_ENV = 'development';
    delete process.env.ORDER_SERVICE_URL;

    const url = getServiceUrl('ORDER_SERVICE_URL', CANONICAL_PORTS.ORDER_SERVICE);
    assert.strictEqual(url, 'http://localhost:3003');
  } finally {
    process.env = originalEnv;
  }
});

it('should fallback to default MySQL development URL', () => {
  const originalEnv = { ...process.env };
  try {
    process.env.NODE_ENV = 'development';
    delete process.env.AUTH_DATABASE_URL;

    const dbUrl = getDatabaseUrl('AUTH_DATABASE_URL', 'auth_db');
    assert.strictEqual(dbUrl, 'mysql://phanbon_user:phanbon_secret@localhost:3307/auth_db');
  } finally {
    process.env = originalEnv;
  }
});

it('should provide default CORS origins in development', () => {
  const originalEnv = { ...process.env };
  try {
    process.env.NODE_ENV = 'development';
    delete process.env.CORS_ALLOWED_ORIGINS;

    const origins = getCorsOrigins();
    assert.deepStrictEqual(origins, ['http://localhost:3000', 'http://127.0.0.1:3000']);
  } finally {
    process.env = originalEnv;
  }
});

// 3. Production Mode Hardening & Fail-Fast
console.log('\n3. Production Hardening & Fail-Fast Verification:');
it('should throw when service URL is missing in production', () => {
  const originalEnv = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.PRODUCT_SERVICE_URL;

    assert.throws(
      () => getServiceUrl('PRODUCT_SERVICE_URL', 3002),
      /Production requires explicit environment variable: PRODUCT_SERVICE_URL/
    );
  } finally {
    process.env = originalEnv;
  }
});

it('should throw when service URL points to localhost or 127.0.0.1 in production', () => {
  const originalEnv = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    process.env.INVENTORY_SERVICE_URL = 'http://localhost:3004';

    assert.throws(
      () => getServiceUrl('INVENTORY_SERVICE_URL'),
      /Production environment detected, but INVENTORY_SERVICE_URL is pointing to localhost/
    );

    process.env.INVENTORY_SERVICE_URL = 'http://127.0.0.1:3004';
    assert.throws(
      () => getServiceUrl('INVENTORY_SERVICE_URL'),
      /pointing to localhost/
    );
  } finally {
    process.env = originalEnv;
  }
});

it('should accept valid non-localhost service URLs in production', () => {
  const originalEnv = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_SERVICE_URL = 'http://auth-service.internal:3001';

    const url = getServiceUrl('AUTH_SERVICE_URL');
    assert.strictEqual(url, 'http://auth-service.internal:3001');
  } finally {
    process.env = originalEnv;
  }
});

it('should throw when database URL is missing in production', () => {
  const originalEnv = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.CUSTOMER_DATABASE_URL;

    assert.throws(
      () => getDatabaseUrl('CUSTOMER_DATABASE_URL', 'customer_db'),
      /Production requires explicit environment variable: CUSTOMER_DATABASE_URL/
    );
  } finally {
    process.env = originalEnv;
  }
});

it('should throw when database URL points to localhost or uses phanbon_secret in production', () => {
  const originalEnv = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    process.env.ORDER_DATABASE_URL = 'mysql://user:phanbon_secret@prod-db.host:3306/order_db';

    assert.throws(
      () => getDatabaseUrl('ORDER_DATABASE_URL', 'order_db'),
      /contains localhost or default development credentials/
    );
  } finally {
    process.env = originalEnv;
  }
});

it('should throw when CORS uses wildcard (*) in production', () => {
  const originalEnv = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ALLOWED_ORIGINS = '*';

    assert.throws(
      () => getCorsOrigins(),
      /Wildcard CORS origin \("\*"\) is prohibited in production/
    );
  } finally {
    process.env = originalEnv;
  }
});

it('should accept comma-separated CORS origins in production', () => {
  const originalEnv = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ALLOWED_ORIGINS = 'https://phanbonshop.vn, https://admin.phanbonshop.vn';

    const origins = getCorsOrigins();
    assert.deepStrictEqual(origins, ['https://phanbonshop.vn', 'https://admin.phanbonshop.vn']);
  } finally {
    process.env = originalEnv;
  }
});

it('validateStartupEnv should fail-fast on insecure secrets in production', () => {
  const originalEnv = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'admin123456';

    assert.throws(
      () => validateStartupEnv('TestService', { checkInsecureSecrets: true }),
      /đang sử dụng giá trị placeholder mặc định không an toàn của dev: "admin123456"/
    );
  } finally {
    process.env = originalEnv;
  }
});

// 4. Seed Safety Guards
console.log('\n4. Seed Safety & Dev Accounts:');
it('auth-service seed.ts must guard against execution in production', () => {
  const seedFile = path.resolve(rootDir, 'services/auth-service/prisma/seed.ts');
  const content = fs.readFileSync(seedFile, 'utf8');

  assert.ok(
    content.includes("process.env.NODE_ENV === 'production'"),
    'auth-service seed.ts must check for process.env.NODE_ENV === "production"'
  );
  assert.ok(
    content.includes('@local.test'),
    'auth-service seed.ts dev accounts must use @local.test domain'
  );
  assert.ok(
    content.includes('DEV_SEED_PASSWORD'),
    'auth-service seed.ts must support DEV_SEED_PASSWORD environment variable'
  );
});

it('product-service seed.ts must guard against execution in production', () => {
  const seedFile = path.resolve(rootDir, 'services/product-service/prisma/seed.ts');
  const content = fs.readFileSync(seedFile, 'utf8');

  assert.ok(
    content.includes("process.env.NODE_ENV === 'production'"),
    'product-service seed.ts must check for process.env.NODE_ENV === "production"'
  );
});

// 5. Content Service CORS
console.log('\n5. Content Service CORS Hardening:');
it('content-service main.ts must use getCorsOrigins() and not hardcode wildcard origin', () => {
  const mainFile = path.resolve(rootDir, 'services/content-service/src/main.ts');
  const content = fs.readFileSync(mainFile, 'utf8');

  assert.ok(
    content.includes('getCorsOrigins()'),
    'content-service main.ts must call getCorsOrigins()'
  );
  assert.ok(
    !content.includes("origin: '*'"),
    'content-service main.ts must not have origin: "*"'
  );
});

// 6. Prisma Generated Client Git Ignore
console.log('\n6. Prisma Generated Client Git Ignore:');
it('.gitignore must include generated/client/', () => {
  const gitignoreFile = path.resolve(rootDir, '.gitignore');
  const content = fs.readFileSync(gitignoreFile, 'utf8');

  assert.ok(
    content.includes('generated/client/'),
    '.gitignore must ignore generated/client/'
  );
});

console.log(`\n=== RESULTS: ${passedTests}/${totalTests} TESTS PASSED ===\n`);
if (passedTests !== totalTests) {
  process.exit(1);
}
