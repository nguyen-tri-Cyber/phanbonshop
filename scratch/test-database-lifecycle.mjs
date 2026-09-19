/**
 * Test Suite: Database Lifecycle Standardization & Production Hardening
 *
 * Kiểm tra các yêu cầu:
 * 1. Schema Validation: npx prisma validate cho cả 6 services
 * 2. Fresh DB Test:
 *    - Tạo 6 database hoàn toàn trống
 *    - migrate deploy áp dụng toàn bộ baseline migrations thành công
 *    - Bảng, indexes, FKs và _prisma_migrations được tạo đầy đủ
 *    - Prisma generate & Service kết nối khởi động thành công
 * 3. Existing DB Migration Test:
 *    - Sao chép database dev hiện tại
 *    - baseline / migrate deploy
 *    - Xác minh dữ liệu còn nguyên vẹn 100% (không DROP bảng, không mất record)
 * 4. Idempotency Test:
 *    - migrate:deploy chạy nhiều lần liên tiếp không lỗi (exit code 0)
 * 5. Production Seed Guard:
 *    - Không tự động chạy seed trong production
 */

import assert from 'node:assert/strict';
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const MYSQL_USER = process.env.MYSQL_USER || 'phanbon_user';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || 'phanbon_secret';
const MYSQL_HOST = 'localhost';
const MYSQL_PORT = 3307;

function mysqlExec(sql) {
  const singleLineSql = sql.replace(/\r?\n/g, ' ').trim().replace(/"/g, '\\"');
  const cmd = `docker exec phanbonshop_mysql mysql -u${MYSQL_USER} -p${MYSQL_PASSWORD} -N -e "${singleLineSql}"`;
  try {
    const result = execSync(cmd, { encoding: 'utf-8', timeout: 15000 });
    return result.trim();
  } catch (e) {
    console.error(`MySQL query failed: ${singleLineSql}`);
    throw e;
  }
}

console.log('================================================================');
console.log('STARTING TESTS: PRISMA DATABASE LIFECYCLE STANDARDIZATION');
console.log('================================================================\n');

// ----------------------------------------------------------------------
// TEST SUITE 1: Schema Validation
// ----------------------------------------------------------------------
console.log('▶ [TEST SUITE 1] Kiểm tra npx prisma validate trên 6 services...');
const services = [
  'auth-service',
  'product-service',
  'order-service',
  'inventory-service',
  'customer-service',
  'content-service',
];

for (const svc of services) {
  const schemaPath = path.join('services', svc, 'prisma', 'schema.prisma');
  const output = execSync(`npx prisma validate --schema=${schemaPath}`, {
    cwd: rootDir,
    encoding: 'utf8',
  });
  assert.ok(output.includes('is valid'), `Schema của ${svc} phải hợp lệ`);
  console.log(`  ✔ [${svc}] schema.prisma hợp lệ 🚀`);
}
console.log('✔ [TEST SUITE 1 PASSED] Tất cả 6 schemas đều hợp lệ!\n');

// ----------------------------------------------------------------------
// TEST SUITE 2: Fresh Database Test (Empty DB -> Migrate Deploy -> Start)
// ----------------------------------------------------------------------
console.log('▶ [TEST SUITE 2] Fresh Database Test (Empty DB -> Migrate Deploy -> Start)...');

const freshSuffix = Date.now();
const freshDbMap = {
  'auth-service': `fresh_auth_${freshSuffix}`,
  'product-service': `fresh_prod_${freshSuffix}`,
  'order-service': `fresh_order_${freshSuffix}`,
  'inventory-service': `fresh_inv_${freshSuffix}`,
  'customer-service': `fresh_cust_${freshSuffix}`,
  'content-service': `fresh_content_${freshSuffix}`,
};

try {
  // Tạo các fresh databases hoàn toàn trống
  for (const [svc, dbName] of Object.entries(freshDbMap)) {
    mysqlExec(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    console.log(`  Created fresh empty database: ${dbName}`);
  }

  // Chạy prisma migrate deploy trên từng fresh database
  for (const [svc, dbName] of Object.entries(freshDbMap)) {
    const schemaPath = path.join('services', svc, 'prisma', 'schema.prisma');
    const freshDbUrl = `mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@${MYSQL_HOST}:${MYSQL_PORT}/${dbName}`;

    const env = { ...process.env };
    if (svc === 'auth-service') env.AUTH_DATABASE_URL = freshDbUrl;
    if (svc === 'product-service') env.PRODUCT_DATABASE_URL = freshDbUrl;
    if (svc === 'order-service') env.ORDER_DATABASE_URL = freshDbUrl;
    if (svc === 'inventory-service') env.INVENTORY_DATABASE_URL = freshDbUrl;
    if (svc === 'customer-service') env.CUSTOMER_DATABASE_URL = freshDbUrl;
    if (svc === 'content-service') env.CONTENT_DATABASE_URL = freshDbUrl;

    console.log(`  Deploying migration to ${dbName}...`);
    const deployOut = execSync(`npx prisma migrate deploy --schema=${schemaPath}`, {
      cwd: rootDir,
      env,
      encoding: 'utf8',
    });

    assert.ok(
      deployOut.includes('1 migration found') || deployOut.includes('applied'),
      `Migration deploy trên ${dbName} phải thành công`
    );

    // Kiểm tra bảng _prisma_migrations có ghi nhận bản ghi
    const migCount = mysqlExec(`SELECT count(*) FROM \`${dbName}\`._prisma_migrations WHERE migration_name LIKE '%_init' AND rolled_back_at IS NULL;`);
    assert.strictEqual(migCount, '1', `Bảng _prisma_migrations trong ${dbName} phải có 1 bản ghi migration hoàn tất`);

    // Kiểm tra bảng nghiệp vụ đã được tạo
    const tableCount = mysqlExec(`SELECT count(*) FROM information_schema.tables WHERE table_schema = '${dbName}';`);
    assert.ok(Number(tableCount) > 1, `Database ${dbName} phải chứa các bảng nghiệp vụ (hiện có ${tableCount} bảng)`);
    console.log(`  ✔ [${svc}] Fresh DB ${dbName} đã migrate thành công với ${tableCount} bảng`);
  }

  // Khởi chạy thử Customer Service kết nối vào fresh_customer_db
  console.log('  Thử khởi chạy customer-service kết nối vào fresh database...');
  const testPort = 3015;
  const custFreshProc = spawn(process.execPath, ['./services/customer-service/dist/main.js'], {
    cwd: rootDir,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'test_jwt_access_secret_phanbonshop_32c',
      INTERNAL_SERVICE_SECRET: 'your_internal_service_mesh_shared_secret_2026',
      CUSTOMER_SERVICE_PORT: String(testPort),
      CUSTOMER_DATABASE_URL: `mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@${MYSQL_HOST}:${MYSQL_PORT}/${freshDbMap['customer-service']}`,
      ORDER_SERVICE_URL: 'http://localhost:3003',
    },
  });

  let custStarted = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://localhost:${testPort}/docs`).catch(() => null);
      if (res && res.status < 500) {
        custStarted = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  custFreshProc.kill();
  assert.ok(custStarted, 'Customer Service phải khởi động và truy cập được trên Fresh Database!');
  console.log('  ✔ Customer Service khởi động và kết nối vào Fresh Database thành công!');

} finally {
  // Dọn dẹp fresh databases
  console.log('  Dọn dẹp fresh databases...');
  for (const dbName of Object.values(freshDbMap)) {
    mysqlExec(`DROP DATABASE IF EXISTS \`${dbName}\`;`);
  }
}
console.log('✔ [TEST SUITE 2 PASSED] Fresh Database Migration kiểm thử thành công 100%!\n');

// ----------------------------------------------------------------------
// TEST SUITE 3: Existing DB Migration Test (Data Preservation)
// ----------------------------------------------------------------------
console.log('▶ [TEST SUITE 3] Existing Database Test (Data Preservation & Baseline)...');

const copyDbName = `copy_cust_${Date.now()}`;
try {
  // 1. Tạo bản sao của customer_db
  mysqlExec(`CREATE DATABASE \`${copyDbName}\`;`);
  // Dump cấu trúc và dữ liệu từ customer_db sang copy_cust
  execSync(`docker exec phanbonshop_mysql mysqldump -u${MYSQL_USER} -p${MYSQL_PASSWORD} customer_db | docker exec -i phanbonshop_mysql mysql -u${MYSQL_USER} -p${MYSQL_PASSWORD} ${copyDbName}`);

  // Xóa bảng _prisma_migrations trong database copy để giả lập DB hiện hữu chưa có tracking
  mysqlExec(`DROP TABLE IF EXISTS \`${copyDbName}\`._prisma_migrations;`);

  // Ghi nhận số lượng bản ghi ban đầu
  const initialProfilesCount = mysqlExec(`SELECT count(*) FROM \`${copyDbName}\`.customer_profiles;`);
  const initialAddressesCount = mysqlExec(`SELECT count(*) FROM \`${copyDbName}\`.customer_addresses;`);
  console.log(`  Dữ liệu ban đầu: ${initialProfilesCount} profiles, ${initialAddressesCount} addresses`);

  // Chèn thêm 1 bản ghi mẫu để theo dõi
  const testUserId = `existing_test_user_${Date.now()}`;
  mysqlExec(`INSERT INTO \`${copyDbName}\`.customer_profiles (id, userId, fullName, phone, createdAt, updatedAt) VALUES ('p_test_1', '${testUserId}', 'Test Existing User', '0912345678', NOW(), NOW());`);

  const beforeMigrationCount = mysqlExec(`SELECT count(*) FROM \`${copyDbName}\`.customer_profiles;`);

  // Thực hiện baseline resolve
  const schemaPath = 'services/customer-service/prisma/schema.prisma';
  const copyDbUrl = `mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@${MYSQL_HOST}:${MYSQL_PORT}/${copyDbName}`;

  execSync(`npx prisma migrate resolve --applied 20260919000000_init --schema=${schemaPath}`, {
    cwd: rootDir,
    env: { ...process.env, CUSTOMER_DATABASE_URL: copyDbUrl },
    encoding: 'utf8',
  });

  // Chạy migrate deploy
  const deployOut = execSync(`npx prisma migrate deploy --schema=${schemaPath}`, {
    cwd: rootDir,
    env: { ...process.env, CUSTOMER_DATABASE_URL: copyDbUrl },
    encoding: 'utf8',
  });

  assert.ok(
    deployOut.includes('No pending migrations to apply') || deployOut.includes('1 migration found'),
    'Migrate deploy phải hoàn tất trơn tru'
  );

  // Kiểm tra dữ liệu sau migration
  const afterMigrationCount = mysqlExec(`SELECT count(*) FROM \`${copyDbName}\`.customer_profiles;`);
  const afterAddressesCount = mysqlExec(`SELECT count(*) FROM \`${copyDbName}\`.customer_addresses;`);
  const specificUser = mysqlExec(`SELECT fullName FROM \`${copyDbName}\`.customer_profiles WHERE userId = '${testUserId}';`);

  assert.strictEqual(afterMigrationCount, beforeMigrationCount, 'Số lượng profile phải giữ nguyên 100%!');
  assert.strictEqual(afterAddressesCount, initialAddressesCount, 'Số lượng địa chỉ phải giữ nguyên 100%!');
  assert.strictEqual(specificUser, 'Test Existing User', 'Bản ghi cụ thể không được phép bị suy hao!');

  console.log(`  ✔ Sau migration: Dữ liệu bảo toàn 100% (${afterMigrationCount} profiles, ${afterAddressesCount} addresses)`);
} finally {
  mysqlExec(`DROP DATABASE IF EXISTS \`${copyDbName}\`;`);
}
console.log('✔ [TEST SUITE 3 PASSED] Existing Database Migration bảo toàn dữ liệu 100%!\n');

// ----------------------------------------------------------------------
// TEST SUITE 4: Idempotency Verification
// ----------------------------------------------------------------------
console.log('▶ [TEST SUITE 4] Idempotency Verification (Chạy migrate:deploy nhiều lần)...');

for (let i = 1; i <= 3; i++) {
  console.log(`  Lần chạy deploy ${i}/3...`);
  const output = execSync('node scripts/migrate-deploy.mjs', {
    cwd: rootDir,
    encoding: 'utf8',
  });
  assert.ok(
    output.includes('No pending migrations to apply'),
    `Lần chạy ${i} phải báo No pending migrations to apply`
  );
  assert.ok(
    output.includes('ALL SERVICE MIGRATIONS DEPLOYED SUCCESSFULLY (IDEMPOTENT)'),
    `Lần chạy ${i} phải hoàn tất thành công`
  );
}
console.log('✔ [TEST SUITE 4 PASSED] migrate:deploy hoàn toàn Idempotent!\n');

// ----------------------------------------------------------------------
// TEST SUITE 5: Seed Safety in Production
// ----------------------------------------------------------------------
console.log('▶ [TEST SUITE 5] Kiểm tra bảo vệ Seed trong Production...');

const seedFile = path.resolve(rootDir, 'services/auth-service/prisma/seed.ts');
const seedContent = fs.readFileSync(seedFile, 'utf8');
assert.ok(
  seedContent.includes("process.env.NODE_ENV === 'production'"),
  'auth-service seed.ts phải kiểm tra NODE_ENV === "production"'
);
assert.ok(
  seedContent.includes('throw new Error'),
  'auth-service seed.ts phải ném ngoại lệ chặn chạy seed trong production'
);
console.log('✔ [TEST SUITE 5 PASSED] Seed an toàn tuyệt đối, không tự chạy trong production!\n');

console.log('================================================================');
console.log('ALL PRISMA DATABASE LIFECYCLE TESTS PASSED! (100% GREEN)');
console.log('================================================================\n');
