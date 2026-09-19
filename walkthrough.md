# Walkthrough: Production Container Architecture & CI/CD Pipeline

Chúng ta đã hoàn thành việc thiết kế, xây dựng và chuẩn hóa toàn diện **Kiến trúc Container Production** và **CI/CD Pipeline** cho toàn bộ 8 ứng dụng/dịch vụ trong hệ sinh thái **Phan Bon Shop** (`frontend`, `api-gateway`, `auth-service`, `product-service`, `order-service`, `inventory-service`, `customer-service`, `content-service`) cùng hạ tầng cơ sở dữ liệu và lưu trữ (`mysql`, `redis`, `minio`, `nginx`).

---

## 1. Các Hạng Mục Kỹ Thuật Đã Triển Khai

### A. Multi-Stage Dockerfile Chuẩn Production
- **Không sao chép `node_modules` từ máy host**:
  - File [.dockerignore](file:///d:/tool/phanbonshop/.dockerignore) loại bỏ triệt để `node_modules`, `dist`, `.next`, `build`, file chứng chỉ `*.key`, `*.pem`, `*.crt`, và toàn bộ file môi trường bí mật `.env*` (ngoại trừ `.env.example`).
  - Sử dụng `npm ci --ignore-scripts` trong môi trường build cô lập để đảm bảo tính tái lập và bảo mật.
- **Thực thi Non-Root**:
  - Tất cả các container (`frontend`, `api-gateway`, và 6 microservices) đều chuyển quyền sang user hệ thống không có đặc quyền: `USER node:node` (UID/GID 1000).
- **Không chạy Dev Server trong Production**:
  - Frontend Next.js được build ở chế độ `standalone` (tối ưu hóa qua `experimental.outputFileTracingRoot`) và chạy qua `node apps/frontend/server.js`.
  - Toàn bộ backend microservices biên dịch qua `tsc` và khởi chạy trực tiếp bằng `node dist/main.js`.
- **Hệ thống Dockerfile độc lập và tái sử dụng**:
  - [apps/frontend/Dockerfile](file:///d:/tool/phanbonshop/apps/frontend/Dockerfile) (3-stage: `deps`, `builder`, `runner`)
  - [apps/api-gateway/Dockerfile](file:///d:/tool/phanbonshop/apps/api-gateway/Dockerfile)
  - [services/auth-service/Dockerfile](file:///d:/tool/phanbonshop/services/auth-service/Dockerfile)
  - [services/product-service/Dockerfile](file:///d:/tool/phanbonshop/services/product-service/Dockerfile)
  - [services/order-service/Dockerfile](file:///d:/tool/phanbonshop/services/order-service/Dockerfile)
  - [services/inventory-service/Dockerfile](file:///d:/tool/phanbonshop/services/inventory-service/Dockerfile)
  - [services/customer-service/Dockerfile](file:///d:/tool/phanbonshop/services/customer-service/Dockerfile)
  - [services/content-service/Dockerfile](file:///d:/tool/phanbonshop/services/content-service/Dockerfile)
  - [docker/Dockerfile.backend](file:///d:/tool/phanbonshop/docker/Dockerfile.backend) (Dockerfile parameterized cho Docker Compose).

---

### B. Reverse Proxy & Định Tuyến An Toàn (Nginx)
- Tạo cấu hình Nginx chuẩn L7 Gateway tại:
  - [docker/nginx/nginx.conf](file:///d:/tool/phanbonshop/docker/nginx/nginx.conf): Tối ưu hóa gzip, worker processes, proxy buffer 256k, và các security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection`, `client_max_body_size: 25M`).
  - [docker/nginx/conf.d/default.conf](file:///d:/tool/phanbonshop/docker/nginx/conf.d/default.conf):
    - `GET /healthz` ➔ Trả về HTTP 200 `healthy` cho container orchestrator / load balancer probe.
    - `/api/*` ➔ Chuyển tiếp về API Gateway (`gateway:8080`).
    - `/_next/static/*` ➔ Cache 365 ngày với header `immutable` cho static assets.
    - `/*` ➔ Chuyển tiếp về Next.js Frontend (`frontend:3000`) hỗ trợ WebSocket Upgrade.
    - Tích hợp **Docker embedded DNS resolver (`127.0.0.11`)** động: Giúp Nginx khởi động trơn tru mà không bị crash nếu một upstream service đang trong quá trình boot.
  - **Kiểm thử thực tế**: Kiểm tra cú pháp trực tiếp bằng container `nginx:1.27-alpine` (`nginx -t`) ➔ **PASS 100%**.

---

### C. Docker Compose Production ([docker-compose.prod.yml](file:///d:/tool/phanbonshop/docker-compose.prod.yml))
Bao gồm đầy đủ 12 services và 2 phân vùng mạng:
1. `reverse-proxy`: Nginx 1.27 Alpine (duy nhất publish cổng `80:80` và `443:443`).
2. `frontend`: Next.js Standalone (Port 3000 nội bộ).
3. `gateway`: API Gateway NestJS (Port 8080 nội bộ).
4. `auth`: Auth Service (Port 3001 nội bộ).
5. `product`: Product Service (Port 3002 nội bộ).
6. `order`: Order Service (Port 3003 nội bộ).
7. `inventory`: Inventory Service (Port 3004 nội bộ).
8. `customer`: Customer Service (Port 3005 nội bộ).
9. `content`: Content Service (Port 3006 nội bộ).
10. `mysql`: MySQL 8.0 (Port 3306 nội bộ).
11. `redis`: Redis 7 Alpine (Port 6379 nội bộ).
12. `minio`: MinIO Object Storage (Port 9000 & 9001 nội bộ).
- **Phân tách mạng (Network Isolation)**:
  - `phanbonshop_public_network`: Cầu nối giữa Internet và Nginx reverse proxy.
  - `phanbonshop_internal_network`: Cấu hình cờ `internal: true`. Toàn bộ MySQL, Redis, MinIO và 7 services nội bộ **tuyệt đối không mở port ra host (No published ports)**, ngăn chặn hoàn toàn nguy cơ quét cổng hoặc thâm nhập từ bên ngoài.
- **Healthchecks**: Mọi container đều có bộ dò health check tự động (`mysqladmin ping`, `redis-cli ping`, `curl minio live`, `fetch() /health` cho Node services, `wget /healthz` cho Nginx).
- **Kiểm thử**: Lệnh `docker compose -f docker-compose.prod.yml config` đã xác thực cú pháp và đồ thị phụ thuộc (`depends_on: service_healthy`) hoàn toàn hợp lệ.

---

### D. Tài Liệu Hướng Dẫn Triển Khai Production ([docs/PRODUCTION_DEPLOYMENT.md](file:///d:/tool/phanbonshop/docs/PRODUCTION_DEPLOYMENT.md))
- **Quy chuẩn HTTPS / TLS**:
  - Hướng dẫn cấu hình Let's Encrypt / Certbot tự động cấp phát và gia hạn chứng chỉ.
  - Cấu hình Nginx SSL block với TLS 1.2, TLS 1.3, HSTS (`Strict-Transport-Security`), OCSP Stapling.
  - **Chính sách bảo mật**: Nghiêm cấm commit file Private Key (`*.key`) hoặc chứng chỉ (`*.crt`, `*.pem`) vào Git repository hoặc nướng vào Docker image.
- **Quản lý biến môi trường & Secrets**: Bảng tra cứu các biến môi trường nhạy cảm (`MYSQL_ROOT_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`, `INTERNAL_SERVICE_SECRET`, v.v.) và cơ chế fail-fast khi thiếu biến ở production.
- **Thứ tự khởi động hệ thống**:
  1. Khởi động DB & Storage (`mysql`, `redis`, `minio`).
  2. Chạy migration deploy (`npm run migrate:deploy`).
  3. Khởi động Microservices (`auth`, `product`, `order`, `inventory`, `customer`, `content`).
  4. Khởi động API Gateway và Frontend.
  5. Khởi động Reverse Proxy (Nginx).

---

### E. GitHub Actions CI/CD Pipeline ([.github/workflows/ci.yml](file:///d:/tool/phanbonshop/.github/workflows/ci.yml))
Thiết lập quy trình tích hợp liên tục tự động hóa khi có `push` hoặc `pull_request` vào `main`, `master`, `develop`:
1. **Job `lint-and-typecheck`**: Kiểm tra validate Prisma schemas, chạy ESLint và TypeScript typecheck toàn diện trên 12 packages/services.
2. **Job `unit-tests`**: Chạy toàn bộ test suites đơn vị.
3. **Job `build`**: Kiểm tra khả năng biên dịch production của toàn bộ monorepo.
4. **Job `integration-tests`**: Sử dụng **Service Containers** chính thức trong GitHub Actions:
   - `mysql:8.0`
   - `redis:7-alpine`
   - `quay.io/minio/minio:latest`
   - Kiểm thử việc chạy `prisma migrate deploy` trên database MySQL 8 sạch và kiểm tra tính idempotent khi chạy lại lần 2.
   - **Bảo mật**: Sử dụng isolated test credentials (`ci_root_secret`, `ci_user`, `ci_test_*`), không sử dụng credential môi trường dev hoặc prod thật.
5. **Job `docker-build-test`**:
   - Xác thực cú pháp `docker compose -f docker-compose.prod.yml config`.
   - Kiểm tra cú pháp Nginx `nginx -t`.
   - Build thử nghiệm các Dockerfile (`apps/frontend/Dockerfile`, `apps/api-gateway/Dockerfile`, `services/auth-service/Dockerfile`).
6. **PR Gating**: Bất kỳ bước nào trong 5 jobs trên thất bại sẽ đánh dấu đỏ và chặn merge Pull Request.

---

## 2. Kết Quả Kiểm Thử Toàn Diện (100% Green)

### A. Container Architecture Test Suite
Thực thi kiểm thử tự động tại [scratch/test-container-prod-architecture.mjs](file:///d:/tool/phanbonshop/scratch/test-container-prod-architecture.mjs):
```text
================================================================
STARTING TESTS: PRODUCTION CONTAINER ARCHITECTURE & CI/CD PIPELINE
================================================================

▶ [TEST 1] Kiểm tra .dockerignore quy chuẩn an toàn...
  ✔ PASS: .dockerignore phải tồn tại ở root repo
  ✔ PASS: .dockerignore phải chặn node_modules
  ✔ PASS: .dockerignore phải chặn file bí mật .env
  ✔ PASS: .dockerignore phải chặn private keys *.key
  ✔ PASS: .dockerignore phải chặn certs *.pem
  ✔ PASS: .dockerignore phải chặn certs *.crt
  ✔ PASS: .dockerignore phải chặn dist host artifacts
  ✔ PASS: .dockerignore phải chặn .next host artifacts

▶ [TEST 2] Kiểm tra Multi-stage Dockerfiles (Non-root, không dev server)...
  ✔ PASS: Dockerfile [frontend] phải tồn tại
  ✔ PASS: [frontend] phải dùng Multi-stage build
  ✔ PASS: [frontend] phải chạy container non-root (USER node)
  ✔ PASS: [frontend] phải khởi chạy production qua server.js
  ✔ PASS: [frontend] tuyệt đối không chạy dev server trong production
  ✔ PASS: Dockerfile [api-gateway] phải tồn tại
  ✔ PASS: [api-gateway] phải dùng Multi-stage build
  ✔ PASS: [api-gateway] phải chạy container non-root (USER node)
  ✔ PASS: [api-gateway] phải khởi chạy production qua dist/main.js
  ✔ PASS: [api-gateway] tuyệt đối không chạy dev server trong production
  ✔ PASS: Dockerfile [auth-service] phải tồn tại
  ✔ PASS: [auth-service] phải dùng Multi-stage build
  ✔ PASS: [auth-service] phải chạy container non-root (USER node)
  ✔ PASS: [auth-service] phải khởi chạy production qua dist/main.js
  ✔ PASS: [auth-service] tuyệt đối không chạy dev server trong production
  ✔ PASS: Dockerfile [product-service] phải tồn tại
  ✔ PASS: [product-service] phải dùng Multi-stage build
  ✔ PASS: [product-service] phải chạy container non-root (USER node)
  ✔ PASS: [product-service] phải khởi chạy production qua dist/main.js
  ✔ PASS: [product-service] tuyệt đối không chạy dev server trong production
  ✔ PASS: Dockerfile [order-service] phải tồn tại
  ✔ PASS: [order-service] phải dùng Multi-stage build
  ✔ PASS: [order-service] phải chạy container non-root (USER node)
  ✔ PASS: [order-service] phải khởi chạy production qua dist/main.js
  ✔ PASS: [order-service] tuyệt đối không chạy dev server trong production
  ✔ PASS: Dockerfile [inventory-service] phải tồn tại
  ✔ PASS: [inventory-service] phải dùng Multi-stage build
  ✔ PASS: [inventory-service] phải chạy container non-root (USER node)
  ✔ PASS: [inventory-service] phải khởi chạy production qua dist/main.js
  ✔ PASS: [inventory-service] tuyệt đối không chạy dev server trong production
  ✔ PASS: Dockerfile [customer-service] phải tồn tại
  ✔ PASS: [customer-service] phải dùng Multi-stage build
  ✔ PASS: [customer-service] phải chạy container non-root (USER node)
  ✔ PASS: [customer-service] phải khởi chạy production qua dist/main.js
  ✔ PASS: [customer-service] tuyệt đối không chạy dev server trong production
  ✔ PASS: Dockerfile [content-service] phải tồn tại
  ✔ PASS: [content-service] phải dùng Multi-stage build
  ✔ PASS: [content-service] phải chạy container non-root (USER node)
  ✔ PASS: [content-service] phải khởi chạy production qua dist/main.js
  ✔ PASS: [content-service] tuyệt đối không chạy dev server trong production
  ✔ PASS: Dockerfile [Dockerfile.backend] phải tồn tại
  ✔ PASS: [Dockerfile.backend] phải dùng Multi-stage build
  ✔ PASS: [Dockerfile.backend] phải chạy container non-root (USER node)
  ✔ PASS: [Dockerfile.backend] phải khởi chạy production qua dist/main.js
  ✔ PASS: [Dockerfile.backend] tuyệt đối không chạy dev server trong production

▶ [TEST 3] Kiểm tra Nginx Reverse Proxy & Routing...
  ✔ PASS: nginx.conf phải tồn tại
  ✔ PASS: conf.d/default.conf phải tồn tại
  ✔ PASS: Nginx phải cho phép upload tối đa 25M
  ✔ PASS: Nginx phải có header nosniff
  ✔ PASS: Nginx phải có header X-Frame-Options
  ✔ PASS: Nginx phải có endpoint /healthz
  ✔ PASS: Nginx phải route /api/ tới gateway
  ✔ PASS: Nginx phải route / tới frontend
  ✔ PASS: Nginx phải hỗ trợ WebSocket upgrade

▶ [TEST 4] Kiểm tra docker-compose.prod.yml an toàn kiến trúc...
  ✔ PASS: docker-compose.prod.yml phải tồn tại
  ✔ PASS: docker-compose.prod.yml phải chứa service [reverse-proxy]
  ✔ PASS: docker-compose.prod.yml phải chứa service [frontend]
  ✔ PASS: docker-compose.prod.yml phải chứa service [gateway]
  ✔ PASS: docker-compose.prod.yml phải chứa service [auth]
  ✔ PASS: docker-compose.prod.yml phải chứa service [product]
  ✔ PASS: docker-compose.prod.yml phải chứa service [order]
  ✔ PASS: docker-compose.prod.yml phải chứa service [inventory]
  ✔ PASS: docker-compose.prod.yml phải chứa service [customer]
  ✔ PASS: docker-compose.prod.yml phải chứa service [content]
  ✔ PASS: docker-compose.prod.yml phải chứa service [mysql]
  ✔ PASS: docker-compose.prod.yml phải chứa service [redis]
  ✔ PASS: docker-compose.prod.yml phải chứa service [minio]
  ✔ PASS: Phải định nghĩa mạng nội bộ internal_network
  ✔ PASS: internal_network phải cấu hình internal: true để chặn truy cập trực tiếp từ bên ngoài
  ✔ PASS: Phải định nghĩa public_network cho reverse proxy
  ✔ PASS: Chỉ reverse-proxy được cấu hình ports:
  ✔ PASS: Service [frontend] KHÔNG ĐƯỢC publish host ports ra công cộng
  ✔ PASS: Service [gateway] KHÔNG ĐƯỢC publish host ports ra công cộng
  ✔ PASS: Service [auth] KHÔNG ĐƯỢC publish host ports ra công cộng
  ✔ PASS: Service [product] KHÔNG ĐƯỢC publish host ports ra công cộng
  ✔ PASS: Service [order] KHÔNG ĐƯỢC publish host ports ra công cộng
  ✔ PASS: Service [inventory] KHÔNG ĐƯỢC publish host ports ra công cộng
  ✔ PASS: Service [customer] KHÔNG ĐƯỢC publish host ports ra công cộng
  ✔ PASS: Service [content] KHÔNG ĐƯỢC publish host ports ra công cộng
  ✔ PASS: Service [mysql] KHÔNG ĐƯỢC publish host ports ra công cộng
  ✔ PASS: Service [redis] KHÔNG ĐƯỢC publish host ports ra công cộng
  ✔ PASS: Service [minio] KHÔNG ĐƯỢC publish host ports ra công cộng

▶ [TEST 5] Kiểm tra GitHub Actions .github/workflows/ci.yml...
  ✔ PASS: .github/workflows/ci.yml phải tồn tại
  ✔ PASS: CI workflow phải trigger khi push
  ✔ PASS: CI workflow phải trigger khi pull_request
  ✔ PASS: CI workflow phải có job lint-and-typecheck
  ✔ PASS: CI workflow phải có job unit-tests
  ✔ PASS: CI workflow phải có job build
  ✔ PASS: CI workflow phải có job integration-tests
  ✔ PASS: CI workflow phải có job docker-build-test
  ✔ PASS: CI integration job phải dùng mysql:8.0 service container
  ✔ PASS: CI integration job phải dùng redis:7-alpine service container
  ✔ PASS: CI integration job phải dùng MinIO service container
  ✔ PASS: CI phải dùng isolated test credentials, không dùng dev/prod keys

▶ [TEST 6] Kiểm tra tài liệu docs/PRODUCTION_DEPLOYMENT.md...
  ✔ PASS: docs/PRODUCTION_DEPLOYMENT.md phải tồn tại
  ✔ PASS: Tài liệu phải hướng dẫn thiết lập Let's Encrypt / Certbot
  ✔ PASS: Tài liệu phải cảnh báo không commit cert/key vào git
  ✔ PASS: Tài liệu phải hướng dẫn thứ tự khởi động (startup ordering)
  ✔ PASS: Tài liệu phải yêu cầu chạy migrate:deploy trước khi start code mới

================================================================
ALL PRODUCTION ARCHITECTURE TESTS PASSED (107/107) 100% GREEN!
================================================================
```

### B. CI Quality Checks (Local Simulation)
- `npm run lint`: **PASS (100% Clean across all 12 packages & services)**.
- `npm run typecheck`: **PASS (Exit code 0)**.
- `npm run test`: **PASS (100% Unit tests pass)**.
- `docker compose -f docker-compose.prod.yml config`: **PASS (Valid Compose configuration)**.
- `docker run --rm nginx:1.27-alpine nginx -t`: **PASS (Syntax OK)**.
