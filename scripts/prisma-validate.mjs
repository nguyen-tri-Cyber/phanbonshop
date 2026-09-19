import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Tự động nạp biến môi trường từ .env ở root nếu process.env chưa có
const envPath = path.resolve(rootDir, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/(^['"]|['"]$)/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const services = [
  { name: 'auth-service', schema: 'services/auth-service/prisma/schema.prisma' },
  { name: 'product-service', schema: 'services/product-service/prisma/schema.prisma' },
  { name: 'order-service', schema: 'services/order-service/prisma/schema.prisma' },
  { name: 'inventory-service', schema: 'services/inventory-service/prisma/schema.prisma' },
  { name: 'customer-service', schema: 'services/customer-service/prisma/schema.prisma' },
  { name: 'content-service', schema: 'services/content-service/prisma/schema.prisma' },
];

console.log('================================================================');
console.log('VALIDATING ALL PRISMA SCHEMAS');
console.log('================================================================\n');

let failed = false;

for (const svc of services) {
  try {
    const output = execSync(`npx prisma validate --schema=${svc.schema}`, {
      cwd: rootDir,
      env: process.env,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    console.log(`✔ [${svc.name}] Schema is valid 🚀`);
  } catch (error) {
    console.error(`✖ [${svc.name}] Schema validation FAILED!`);
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    failed = true;
    break;
  }
}

if (failed) {
  console.error('\nPRISMA SCHEMA VALIDATION FAILED!');
  process.exit(1);
} else {
  console.log('\n================================================================');
  console.log('ALL 6 PRISMA SCHEMAS VALIDATED SUCCESSFULLY!');
  console.log('================================================================');
}
