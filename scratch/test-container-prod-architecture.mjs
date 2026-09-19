import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('================================================================');
console.log('STARTING TESTS: PRODUCTION CONTAINER ARCHITECTURE & CI/CD PIPELINE');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  ✖ FAIL: ${message}`);
    throw new Error(message);
  }
  passedTests++;
  console.log(`  ✔ PASS: ${message}`);
}

// -----------------------------------------------------------------------------
// TEST 1: Kiểm tra .dockerignore
// -----------------------------------------------------------------------------
console.log('▶ [TEST 1] Kiểm tra .dockerignore quy chuẩn an toàn...');
const dockerignorePath = path.resolve(rootDir, '.dockerignore');
assert(fs.existsSync(dockerignorePath), '.dockerignore phải tồn tại ở root repo');
const dockerignoreContent = fs.readFileSync(dockerignorePath, 'utf8');
assert(dockerignoreContent.includes('node_modules'), '.dockerignore phải chặn node_modules');
assert(dockerignoreContent.includes('.env'), '.dockerignore phải chặn file bí mật .env');
assert(dockerignoreContent.includes('*.key'), '.dockerignore phải chặn private keys *.key');
assert(dockerignoreContent.includes('*.pem'), '.dockerignore phải chặn certs *.pem');
assert(dockerignoreContent.includes('*.crt'), '.dockerignore phải chặn certs *.crt');
assert(dockerignoreContent.includes('dist'), '.dockerignore phải chặn dist host artifacts');
assert(dockerignoreContent.includes('.next'), '.dockerignore phải chặn .next host artifacts');

// -----------------------------------------------------------------------------
// TEST 2: Kiểm tra Multi-stage Dockerfiles cho toàn bộ 8 services & apps
// -----------------------------------------------------------------------------
console.log('\n▶ [TEST 2] Kiểm tra Multi-stage Dockerfiles (Non-root, không dev server)...');
const dockerfiles = [
  { path: 'apps/frontend/Dockerfile', name: 'frontend', startCmd: 'server.js' },
  { path: 'apps/api-gateway/Dockerfile', name: 'api-gateway', startCmd: 'dist/main.js' },
  { path: 'services/auth-service/Dockerfile', name: 'auth-service', startCmd: 'dist/main.js' },
  { path: 'services/product-service/Dockerfile', name: 'product-service', startCmd: 'dist/main.js' },
  { path: 'services/order-service/Dockerfile', name: 'order-service', startCmd: 'dist/main.js' },
  { path: 'services/inventory-service/Dockerfile', name: 'inventory-service', startCmd: 'dist/main.js' },
  { path: 'services/customer-service/Dockerfile', name: 'customer-service', startCmd: 'dist/main.js' },
  { path: 'services/content-service/Dockerfile', name: 'content-service', startCmd: 'dist/main.js' },
  { path: 'docker/Dockerfile.backend', name: 'Dockerfile.backend', startCmd: 'dist/main.js' },
];

for (const df of dockerfiles) {
  const fullPath = path.resolve(rootDir, df.path);
  assert(fs.existsSync(fullPath), `Dockerfile [${df.name}] phải tồn tại`);
  const content = fs.readFileSync(fullPath, 'utf8');
  assert(content.includes('AS builder') || content.includes('AS deps'), `[${df.name}] phải dùng Multi-stage build`);
  assert(content.includes('USER node'), `[${df.name}] phải chạy container non-root (USER node)`);
  assert(content.includes(df.startCmd), `[${df.name}] phải khởi chạy production qua ${df.startCmd}`);
  assert(!content.includes('npm run dev'), `[${df.name}] tuyệt đối không chạy dev server trong production`);
}

// -----------------------------------------------------------------------------
// TEST 3: Kiểm tra cấu hình Nginx Reverse Proxy
// -----------------------------------------------------------------------------
console.log('\n▶ [TEST 3] Kiểm tra Nginx Reverse Proxy & Routing...');
const nginxConfPath = path.resolve(rootDir, 'docker/nginx/nginx.conf');
const defaultConfPath = path.resolve(rootDir, 'docker/nginx/conf.d/default.conf');
assert(fs.existsSync(nginxConfPath), 'nginx.conf phải tồn tại');
assert(fs.existsSync(defaultConfPath), 'conf.d/default.conf phải tồn tại');

const nginxConf = fs.readFileSync(nginxConfPath, 'utf8');
assert(nginxConf.includes('client_max_body_size 25M'), 'Nginx phải cho phép upload tối đa 25M');
assert(nginxConf.includes('X-Content-Type-Options "nosniff"'), 'Nginx phải có header nosniff');
assert(nginxConf.includes('X-Frame-Options "SAMEORIGIN"'), 'Nginx phải có header X-Frame-Options');

const defaultConf = fs.readFileSync(defaultConfPath, 'utf8');
assert(defaultConf.includes('location /healthz'), 'Nginx phải có endpoint /healthz');
assert(defaultConf.includes('location /api/'), 'Nginx phải route /api/ tới gateway');
assert(defaultConf.includes('location /'), 'Nginx phải route / tới frontend');
assert(defaultConf.includes('proxy_set_header Upgrade $http_upgrade'), 'Nginx phải hỗ trợ WebSocket upgrade');

// -----------------------------------------------------------------------------
// TEST 4: Kiểm tra docker-compose.prod.yml (Network & Port Isolation)
// -----------------------------------------------------------------------------
console.log('\n▶ [TEST 4] Kiểm tra docker-compose.prod.yml an toàn kiến trúc...');
const composePath = path.resolve(rootDir, 'docker-compose.prod.yml');
assert(fs.existsSync(composePath), 'docker-compose.prod.yml phải tồn tại');
const composeContent = fs.readFileSync(composePath, 'utf8');

const requiredServices = [
  'reverse-proxy', 'frontend', 'gateway', 'auth', 'product',
  'order', 'inventory', 'customer', 'content', 'mysql', 'redis', 'minio'
];
for (const svc of requiredServices) {
  assert(composeContent.includes(`${svc}:`), `docker-compose.prod.yml phải chứa service [${svc}]`);
}

assert(composeContent.includes('internal_network:'), 'Phải định nghĩa mạng nội bộ internal_network');
assert(composeContent.includes('internal: true'), 'internal_network phải cấu hình internal: true để chặn truy cập trực tiếp từ bên ngoài');
assert(composeContent.includes('public_network:'), 'Phải định nghĩa public_network cho reverse proxy');

// Kiểm tra chỉ duy nhất reverse-proxy được publish ports ra host
const lines = composeContent.split('\n');
let currentService = '';
let servicePorts = {};
for (const line of lines) {
  const matchSvc = line.match(/^  ([a-zA-Z0-9_-]+):/);
  if (matchSvc) {
    currentService = matchSvc[1];
  }
  if (line.trim().startsWith('ports:')) {
    servicePorts[currentService] = true;
  }
}
assert(servicePorts['reverse-proxy'] === true, 'Chỉ reverse-proxy được cấu hình ports:');
for (const svc of requiredServices) {
  if (svc !== 'reverse-proxy') {
    assert(!servicePorts[svc], `Service [${svc}] KHÔNG ĐƯỢC publish host ports ra công cộng`);
  }
}

// -----------------------------------------------------------------------------
// TEST 5: Kiểm tra GitHub Actions CI/CD Pipeline
// -----------------------------------------------------------------------------
console.log('\n▶ [TEST 5] Kiểm tra GitHub Actions .github/workflows/ci.yml...');
const ciPath = path.resolve(rootDir, '.github/workflows/ci.yml');
assert(fs.existsSync(ciPath), '.github/workflows/ci.yml phải tồn tại');
const ciContent = fs.readFileSync(ciPath, 'utf8');

assert(ciContent.includes('push:'), 'CI workflow phải trigger khi push');
assert(ciContent.includes('pull_request:'), 'CI workflow phải trigger khi pull_request');
assert(ciContent.includes('lint-and-typecheck:'), 'CI workflow phải có job lint-and-typecheck');
assert(ciContent.includes('unit-tests:'), 'CI workflow phải có job unit-tests');
assert(ciContent.includes('build:'), 'CI workflow phải có job build');
assert(ciContent.includes('integration-tests:'), 'CI workflow phải có job integration-tests');
assert(ciContent.includes('docker-build-test:'), 'CI workflow phải có job docker-build-test');
assert(ciContent.includes('mysql:8.0'), 'CI integration job phải dùng mysql:8.0 service container');
assert(ciContent.includes('redis:7-alpine'), 'CI integration job phải dùng redis:7-alpine service container');
assert(ciContent.includes('quay.io/minio/minio:latest'), 'CI integration job phải dùng MinIO service container');
assert(ciContent.includes('ci_test_') || ciContent.includes('ci_root_secret'), 'CI phải dùng isolated test credentials, không dùng dev/prod keys');

// -----------------------------------------------------------------------------
// TEST 6: Kiểm tra tài liệu Production Deployment
// -----------------------------------------------------------------------------
console.log('\n▶ [TEST 6] Kiểm tra tài liệu docs/PRODUCTION_DEPLOYMENT.md...');
const docPath = path.resolve(rootDir, 'docs/PRODUCTION_DEPLOYMENT.md');
assert(fs.existsSync(docPath), 'docs/PRODUCTION_DEPLOYMENT.md phải tồn tại');
const docContent = fs.readFileSync(docPath, 'utf8');

assert(docContent.includes('Let\'s Encrypt'), 'Tài liệu phải hướng dẫn thiết lập Let\'s Encrypt / Certbot');
assert(docContent.includes('Tuyệt đối không commit file Private Key'), 'Tài liệu phải cảnh báo không commit cert/key vào git');
assert(docContent.includes('Thứ Tự Khởi Động'), 'Tài liệu phải hướng dẫn thứ tự khởi động (startup ordering)');
assert(docContent.includes('migrate:deploy'), 'Tài liệu phải yêu cầu chạy migrate:deploy trước khi start code mới');

console.log('\n================================================================');
console.log(`ALL PRODUCTION ARCHITECTURE TESTS PASSED (${passedTests}/${totalTests}) 100% GREEN!`);
console.log('================================================================\n');
