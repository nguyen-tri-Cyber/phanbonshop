# PHANBONSHOP — NHẬT KÝ THỰC THI KHẮC PHỤC HỆ THỐNG (REMEDIATION EXECUTION LOG)

> **Mục tiêu:** Ghi chép minh bạch, chính xác từng bước kiểm tra, tái hiện lỗi, kiểm thử và khắc phục của từng Phase theo đúng cam kết không làm tắt, không hallucinate, và có bằng chứng cụ thể.

---

## 1. THÔNG SỐ KHÓA BASELINE BAN ĐẦU (STARTING BASELINE)

- **Starting commit:** `9d1ddf598d0aa50f9062b5f86741d6d304dcc746`
- **Branch:** `main`
- **Node.js:** `v24.15.0`
- **npm:** `11.12.1`
- **Docker:** `Docker version 29.5.3, build d1c06ef`
- **Docker Compose:** `Docker Compose version v5.1.4`
- **Start date:** `2026-09-20T12:45:00+07:00`
- **Working Tree State:**
  - Untracked files: `docs/FULL_SYSTEM_AUDIT.md`, `docs/REMEDIATION_PLAN.md` (Tài liệu kiểm toán hợp lệ từ lượt audit).
  - Không có thay đổi uncommitted nào trong mã nguồn ứng dụng.

---

## 2. NHẬT KÝ THỰC THI TỪNG PHASE

### PHASE 0 — BUILD & RUNTIME BASELINE

#### Task ID: `TASK-PHASE0-01`
- **Finding:** `AUD-P2-002` — Lệnh `npm run build` bị nghẽn (stall) vô hạn trên môi trường host local do `apps/frontend/src/app/sitemap.ts` thực hiện fetch không có timeout tới downstream API URL (`http://gateway:8080/api/v1` hoặc `/api/v1`), kết hợp với cơ chế dọn dẹp thư mục `.next` (`cleanDistDir: true`) bị nghẽn trên Windows khi file lock bởi background processes.
- **Files affected:**
  - `apps/frontend/src/app/sitemap.ts`
  - `apps/frontend/next.config.mjs`
  - `.gitignore`
- **Root cause:**
  1. `sitemap.ts` gọi trực tiếp `fetch()` với URL mặc định `http://gateway:8080/api/v1` mà không thiết lập timeout (`AbortController`). Khi build ngoài Docker trên máy host local, hostname `gateway` không phân giải được qua DNS/LLMNR/NetBIOS, gây nghẽn kết nối mạng trong quá trình sinh sitemap tĩnh.
  2. Môi trường Windows IDE giữ file handle đối với các file kiểu `.next/types/**/*.ts`, khiến hàm `recursiveDelete` mặc định của Next.js bị nghẽn/lỗi `EPERM` khi dọn dẹp thư mục `.next` trước build.
- **Test before fix:**
  - Chạy: `npm run build --workspace=@phanbonshop/frontend`
- **Result before fix:**
  - Quá trình build bị treo (stall) vô hạn sau khi hiển thị banner `▲ Next.js 14.2.35`, không tiến hành compile và emit sitemap.
- **Implementation:**
  1. Bổ sung hàm `safeFetchJson<T>(url, timeoutMs = 1500)` trong `apps/frontend/src/app/sitemap.ts` sử dụng `AbortController` với timeout 1500ms, chỉ fetch khi URL là HTTP(S) tuyệt đối hợp lệ, và graceful fallback trả về danh sách static routes (`/`, `/san-pham`, `/kien-thuc`) khi downstream offline hoặc timeout.
  2. Thêm `cleanDistDir: false` trong `apps/frontend/next.config.mjs` để tránh Windows EPERM/file-locking stall khi dọn dẹp thư mục `.next`.
  3. Cập nhật `.gitignore` bỏ qua `.next*/` và `*.tsbuildinfo`.
- **Test after fix:**
  - Chạy: `npm run build --workspace=@phanbonshop/frontend`
- **Result after fix:**
  - Build frontend hoàn tất thành công 100% trong ~15 giây với exit code 0. Toàn bộ 27 routes (bao gồm `/sitemap.xml` và `/robots.txt`) được pre-render chính xác.
- **Regression risk:** Thấp. Khi gateway hoạt động (trong Docker), sitemap vẫn fetch đầy đủ dữ liệu; khi gateway offline hoặc khi build local, sitemap fallback an toàn về các route tĩnh mà không gây crash hay stall.
- **Status:** PASS

---

#### Task ID: `TASK-PHASE0-02`
- **Finding:** Xác thực toàn bộ validation scripts của repository (`prisma:validate`, `prisma:generate`, `lint`, `typecheck`, `test`, `build`) trước khi can thiệp logic nghiệp vụ.
- **Files affected:** None (kiểm tra validation toàn diện)
- **Root cause:** N/A (Baseline validation gate)
- **Commands executed & Results:**
  1. `npm run prisma:validate` -> Exit code: **0** (Toàn bộ 6 Prisma schemas hợp lệ 100%).
  2. `npm run prisma:generate` -> Exit code: **0** (Generate thành công Prisma Client cho 6 microservices).
  3. `npm run lint` -> Exit code: **0** (Không có lỗi ESLint trên toàn bộ packages/services/apps).
  4. `npm run typecheck` -> Exit code: **0** (TypeScript kiểm tra kiểu dữ liệu thành công 100% trên toàn bộ monorepo).
  5. `npm run test` -> Exit code: **0** (15 tests unit hiện hữu đều PASS: 8 shared-utils, 3 inventory-service, 4 order-service).
  6. `npm run build` -> Exit code: **0** (Toàn bộ 12 workspaces gồm 4 shared packages, 6 NestJS backend services, 1 API gateway và Next.js frontend compile thành công ra `dist/` và `.next/`).
- **Regression risk:** Không có.
- **Status:** PASS

---

#### Task ID: `TASK-PHASE0-03`
- **Finding:** Xác minh Docker runtime thực tế cho toàn bộ stack (không chỉ kiểm tra config).
- **Files affected:** `docker-compose.yml`
- **Commands executed & Results:**
  1. `docker compose config --quiet` -> Exit code: **0** (Cấu hình Docker Compose hợp lệ).
  2. `docker compose ps` -> Toàn bộ 12 containers đang hoạt động ổn định và đạt trạng thái `(healthy)`:
     - `phanbonshop_mysql`: Up (healthy) - Port 3307->3306
     - `phanbonshop_redis`: Up (healthy) - Port 6379->6379
     - `phanbonshop_minio`: Up (healthy) - Ports 9000, 9001
     - `phanbonshop_auth`: Up (healthy) - Port 3001
     - `phanbonshop_product`: Up (healthy) - Port 3002
     - `phanbonshop_order`: Up (healthy) - Port 3003
     - `phanbonshop_inventory`: Up (healthy) - Port 3004
     - `phanbonshop_customer`: Up (healthy) - Port 3005
     - `phanbonshop_content`: Up (healthy) - Port 3006
     - `phanbonshop_gateway`: Up (healthy) - Port 8080
     - `phanbonshop_frontend`: Up (healthy) - Port 3000
     - `phanbonshop_proxy`: Up (healthy) - Port 80
  3. Kiểm tra startup logs: Tất cả 6 backend services kết nối thành công tới database logical riêng biệt và MinIO (nếu cần), gateway nhận health probe 200 OK định kỳ, frontend khởi động thành công trong 234ms. Không có bất kỳ restart loop hay silent crash nào.
- **Regression risk:** Không có.
- **Status:** PASS

---

### PHASE 1 — CRITICAL TEST HARNESS

#### Task ID: `TASK-PHASE1-01`
- **Finding:** Thiết lập bộ kiểm thử Concurrency thực tế trên MySQL (`test_inventory_db`) cho `inventory-service` (1.1).
- **Files affected:**
  - `services/inventory-service/test/inventory.concurrency.integration.test.mjs`
  - `services/inventory-service/package.json`
- **Implementation & Scenarios tested:**
  1. **10 concurrent reservation requests against `stockQuantity=1`**: Gửi đồng thời 10 promises `inventoryService.reserve()` cùng lúc vào 1 variant có tồn kho = 1.
     - Kết quả: Đúng 1 request thành công (200), 9 request còn lại bị từ chối chính xác do không đủ tồn kho khả dụng.
     - Sau kiểm thử: `stockQuantity = 1`, `reservedQuantity = 1`, `available = 0`. Tuyệt đối không bị âm kho (negative stock) hay race condition.
  2. **Idempotent reservation retry**: Gửi lặp lại cùng `reservationId` đã active -> service nhận diện idempotent record, trả về kết quả thành công mà không trừ thêm tồn kho (`reservedQuantity` giữ nguyên 1).
  3. **Release reservation idempotency**: Gọi release reservation -> `reservedQuantity` giảm về 0, status chuyển `RELEASED`. Gửi release lần thứ 2 với cùng `reservationId` -> service xử lý an toàn idempotent, không giảm âm kho.
- **Commands executed & Results:**
  - `npm run test:integration --workspace=@phanbonshop/inventory-service` -> **3/3 PASS** (287ms).
- **Status:** PASS

---

#### Task ID: `TASK-PHASE1-02`
- **Finding:** Thiết lập bộ kiểm thử Checkout Idempotency Concurrency, Request Body Hash Validation, Crash/Retry trên Real MySQL (`test_order_db`) (1.2, 1.3, 1.4).
- **Files affected:**
  - `services/order-service/src/checkout/checkout.service.ts`
  - `services/order-service/test/checkout.idempotency.concurrency.integration.test.mjs`
  - `services/order-service/package.json`
- **Root cause & Fix:**
  - Khi chạy 10 concurrent requests cùng một `idempotencyKey` trong cùng một tiến trình, trong code cũ của `CheckoutService.processCheckout`, việc gán `this.inFlightRequests.set(lockKey, executionPromise)` được thực hiện *sau* khi đã `await this.claimIdempotencyRecord()`. Do đó, cả 10 concurrent requests đồng thời vượt qua bước kiểm tra `this.inFlightRequests.get(lockKey)` và cùng chạy vào DB, khiến 9 request chạm lỗi duplicate key của MySQL và ném ra 409 `IDEMPOTENCY_IN_PROGRESS` thay vì cùng chia sẻ (await) kết quả của đơn hàng đang tạo.
  - Khắc phục: Khởi tạo và lưu ngay `executionPromise` vào `this.inFlightRequests` đồng bộ trước bất kỳ thao tác `await` nào, đảm bảo 9 request đến sau lập tức await vào shared promise của request đầu tiên.
- **Implementation & Scenarios tested:**
  1. **1.2 Idempotency concurrency**: 10 concurrent checkout requests với cùng một `idempotencyKey` -> Đúng 1 Order được tạo ra trong `order_db`, đúng 1 reservation trong `inventory_db`, cả 10 callers đều nhận cùng 1 payload đơn hàng hợp lệ.
  2. **1.3 Same key — different body**: Request thứ 2 gửi cùng `idempotencyKey` nhưng thay đổi payload đơn hàng -> Bị từ chối ngay lập tức với HTTP 409 Conflict (`IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST`).
  3. **1.4 Crash/retry idempotency**: Trường hợp request đầu tiên bị FAILED (do crash/lỗi hệ thống), lượt gửi retry an toàn phát hiện trạng thái FAILED, giải phóng lock cũ và hoàn tất đơn hàng an toàn mà không gây double reservation hay duplicate side-effects.
- **Commands executed & Results:**
  - `npm run test:integration --workspace=@phanbonshop/order-service` -> **3/3 PASS** (634ms).
- **Status:** PASS

---

#### Task ID: `TASK-PHASE1-03`
- **Finding:** Thiết lập bộ kiểm thử Saga Compensation Integration Test (1.5) kiểm chứng cơ chế bồi hoàn hai pha giữa `order-service` và `inventory-service` trên real MySQL databases (`test_order_db`, `test_inventory_db`).
- **Files affected:**
  - `services/order-service/test/checkout.saga.compensation.integration.test.mjs`
  - `services/order-service/package.json`
- **Implementation & Scenarios tested:**
  1. **1.5a Immediate Release Success**: Tạm giữ kho thành công -> Giao dịch tạo đơn hàng local MySQL gặp sự cố (simulate DB failure) -> Hệ thống lập tức kích hoạt bồi hoàn tức thời (Immediate release) sang `inventory-service`.
     - Kiểm chứng: Bản ghi `InventoryReservation` chuyển sang `RELEASED`, `reservedQuantity` trở về 0, `stockQuantity` giữ nguyên, không tạo rác bản ghi pending compensation trong `order_db`.
  2. **1.5b Downstream Network Failure & Worker Recovery**: Tạm giữ kho thành công -> Giao dịch tạo đơn fail -> Lệnh immediate release sang `inventory-service` thất bại do lỗi mạng downstream (simulate HTTP 503).
     - Kiểm chứng trạng thái kẹt: `InventoryReservation` vẫn `ACTIVE`, tồn kho vẫn tạm giữ (reservedQuantity = 3), và một bản ghi `CompensationTask` được tạo bền vững trong bảng `compensation_tasks` của `test_order_db` với trạng thái `PENDING`.
     - Kiểm chứng phục hồi: Khi `inventory-service` online trở lại, kích hoạt `compensationService.processPendingTasks()` -> Worker atomic claim task `PENDING` -> `PROCESSING` -> gọi release thành công -> cập nhật trạng thái task thành `COMPLETED` kèm timestamp `completedAt`, giải phóng `reservedQuantity` về 0 và `InventoryReservation` thành `RELEASED`.
- **Commands executed & Results:**
  - Chạy suite: `node --test test/checkout.saga.compensation.integration.test.mjs` -> **2/2 PASS** (456ms).
- **Status:** PASS

---

#### Task ID: `TASK-PHASE1-04`
- **Finding:** Thiết lập bộ kiểm thử Auth Critical Flows trên production code kết nối trực tiếp MySQL (`test_auth_db`) (1.6).
- **Files affected:**
  - `services/auth-service/test/auth.critical-flow.integration.test.mjs`
  - `services/auth-service/test/auth.unit.test.mjs`
  - `services/auth-service/package.json`
- **Implementation & Scenarios tested:**
  1. **1.6.1 Register success & Unique constraints**: Đăng ký tài khoản mới thành công, mật khẩu băm bcrypt salt 12. Từ chối trùng email với `ConflictException` (409) và từ chối trùng số điện thoại với `ConflictException` (409).
  2. **1.6.2 Login & Authentication**: Đăng nhập đúng mật khẩu thành công, trả về cặp JWT tokens và cập nhật `lastLoginAt`. Đăng nhập sai mật khẩu ném `UnauthorizedException` (401). Đăng nhập email không tồn tại ném `UnauthorizedException` (401).
  3. **1.6.3 Refresh Token Rotation & Session Security**: Gọi `/refresh` cấp cặp token mới, thu hồi token cũ (`revokedAt` được set). Tái sử dụng token cũ đã bị thu hồi bị từ chối ngay lập tức với `UnauthorizedException` (401 - Token reuse detection).
  4. **1.6.4 Logout & Logout All**: Logout đơn lẻ thu hồi chính xác session hiện tại. Logout all thu hồi toàn bộ sessions đang active của user.
  5. **1.6.5 Password Reset Flow, Expiry & Used Token Rejection**: Yêu cầu quên mật khẩu sinh token mã hóa ngẫu nhiên an toàn thời hạn 15 phút, gửi email qua `DevEmailProvider`. Đặt lại mật khẩu thành công, vô hiệu hóa toàn bộ sessions cũ. Tái sử dụng token đã dùng bị ném `BadRequestException` (400). Sử dụng token đã hết hạn (`expiresAt < now`) bị ném `BadRequestException` (400).
- **Commands executed & Results:**
  - `npm run test:unit --workspace=@phanbonshop/auth-service` -> **2/2 PASS** (735ms).
  - `npm run test:integration --workspace=@phanbonshop/auth-service` -> **5/5 PASS** (2910ms).
- **Status:** PASS

---

#### Task ID: `TASK-PHASE1-05`
- **Finding:** Chạy Full Regression Suite sau khi hoàn tất Phase 1 Harness.
- **Commands executed & Results:**
  1. `npm run lint` -> Exit code: **0** (0 errors).
  2. `npm run typecheck` -> Exit code: **0** (0 type errors trên toàn bộ 12 workspaces).
  3. `npm run test` -> Exit code: **0** (Tất cả unit tests trong monorepo đều PASS).
  4. `npm run build` -> Exit code: **0** (Toàn bộ 12 packages/services/apps compile thành công, Next.js frontend sinh 27/27 pages).
- **Status:** PASS


