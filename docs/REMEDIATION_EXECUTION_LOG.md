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

---

### PHASE 2 — CORE DATA INTEGRITY & RACE CONDITIONS

#### Task ID: `TASK-PHASE2-01`
- **Finding:** Khắc phục thiếu hụt Expiry Worker và bảo đảm an toàn đa bản sao (Multi-Replica Safe) cho việc thu hồi các lượt tạm giữ quá hạn (`expiresAt <= NOW()`) trong `inventory-service` (2.4).
- **Files affected:**
  - `services/inventory-service/src/inventory/inventory.service.ts`
  - `services/inventory-service/test/inventory.lifecycle-expiry.integration.test.mjs`
  - `services/inventory-service/package.json`
- **Root cause & Fix:**
  - `inventory-service` trước đây chỉ có endpoint `POST /internal/v1/inventory/cleanup-expired` nhưng không có background timer/worker tự động quét định kỳ.
  - Trong logic quét cũ của `releaseExpiredReservations`, câu lệnh query lấy danh sách rồi lặp qua từng bản ghi nhưng không kiểm tra trạng thái nguyên tử `ACTIVE`, dẫn đến nếu 2 worker replicas cùng chạy song song thì cả 2 đều thực thi lệnh trừ `reservedQuantity`, gây lỗi trừ âm kho (negative reserved).
  - Khắc phục:
    1. Triển khai lifecycle hooks `OnModuleInit` và `OnModuleDestroy` trong `InventoryService`, tự động kích hoạt timer nền chạy định kỳ mỗi 60 giây (tùy chỉnh qua `RESERVATION_CLEANUP_INTERVAL_MS`).
    2. Tái thiết kế `releaseExpiredReservations` với cơ chế Atomic Claiming: `updateMany({ where: { id: res.id, status: ReservationStatus.ACTIVE }, data: { status: ReservationStatus.EXPIRED } })`. Chỉ worker replica nào claim thành công `count === 1` mới được quyền khóa dòng tồn kho và trừ `reservedQuantity`.
- **Implementation & Scenarios tested:**
  - `2.4.1`: Tạo reservation với `expiresAt` quá hạn 2 phút trước -> Kích hoạt Expiry Worker -> Chuyển trạng thái sang `EXPIRED`, `reservedQuantity` giảm về 0, `availableQuantity` phục hồi về 10, ghi nhận `MovementType.RELEASE_RESERVATION`.
  - `2.4.2`: Chạy đồng thời 3 worker replicas song song trên 2 bản ghi hết hạn -> Đảm bảo đúng 2 bản ghi được giải phóng, không có hiện tượng double-decrement.
- **Commands executed & Results:**
  - `npm run test:integration --workspace=@phanbonshop/inventory-service` -> **6/6 PASS** (580ms).
- **Status:** PASS

---

#### Task ID: `TASK-PHASE2-02`
- **Finding:** Chuẩn hóa Mô hình Vòng đời Tồn kho — Đơn hàng (Reserve-on-Checkout / Commit-on-Confirm / Restock-on-Cancel) và khắc phục lỗi không thể hoàn tồn kho khi hủy đơn đã xác nhận (2.5).
- **Files affected:**
  - `docs/INVENTORY_LIFECYCLE.md`
  - `services/inventory-service/src/inventory/dto/inventory.dto.ts`
  - `services/inventory-service/src/inventory/inventory.service.ts`
  - `services/inventory-service/src/inventory/inventory.controller.ts`
  - `services/order-service/src/orders/orders.service.ts`
  - `services/order-service/package.json`
  - `services/order-service/test/order.lifecycle-stock.integration.test.mjs`
- **Root cause & Fix:**
  - Trước đây, `OrdersService` chỉ gọi `commitInventory` khi đơn chuyển sang `COMPLETED`. Điều này dẫn đến lỗ hổng: đơn hàng ở trạng thái `CONFIRMED` hoặc `PROCESSING` kéo dài quá thời hạn 15 phút của reservation sẽ bị Expiry Worker dọn dẹp nhầm, khiến đơn hàng mất giữ chỗ.
  - Ngược lại, khi đơn hàng đã qua bước xuất kho bị hủy (`CANCELLED`), `inventory-service` ném lỗi `400 BadRequestException: Không thể giải phóng lượt tạm giữ đã hoàn tất xuất kho (COMMITTED)`, khiến số lượng hàng không được hoàn trả lại kho vật lý.
  - Khắc phục:
    1. Soạn thảo tài liệu chuẩn hóa kiến trúc [`docs/INVENTORY_LIFECYCLE.md`](file:///d:/tool/phanbonshop/docs/INVENTORY_LIFECYCLE.md).
    2. Bổ sung endpoint `POST /internal/v1/inventory/rollback` và hàm `rollbackOrRelease()` trong `inventory-service`:
       - Nếu reservation là `COMMITTED`: Tự động cộng lại `stockQuantity = stockQuantity + quantity`, ghi movement `MovementType.CANCELLED_ORDER`, chuyển reservation sang `RELEASED`.
       - Nếu reservation là `ACTIVE`: Giảm `reservedQuantity`, ghi movement `MovementType.RELEASE_RESERVATION`.
       - Nếu reservation đã `RELEASED` hoặc `EXPIRED`: Trả về thành công an toàn idempotent.
    3. Cập nhật `OrdersService.updateStatus`:
       - Khi chuyển sang `CONFIRMED`: Lập tức gọi `commitInventory()` để cam kết trừ `stockQuantity` và `reservedQuantity`.
       - Khi chuyển sang `CANCELLED`: Gọi `releaseInventoryCompensation()`, tự động hoàn kho vật lý hoặc giải phóng tạm giữ tương ứng.
- **Commands executed & Results:**
  - `node --test test/order.lifecycle-stock.integration.test.mjs` -> **3/3 PASS** (587ms).
- **Status:** PASS

---

#### Task ID: `TASK-PHASE2-03`
- **Finding:** Tích hợp Outbox Bồi hoàn Bền vững (`CompensationTask`) khi hủy đơn hàng gặp sự cố downstream (2.3).
- **Files affected:**
  - `services/order-service/src/orders/orders.service.ts`
- **Implementation & Fix:**
  - Inject `CompensationService` vào `OrdersService`.
  - Trong hàm `releaseInventoryCompensation()`, nếu lệnh gọi HTTP sang `inventory-service` thất bại (HTTP 503 hoặc Timeout), hệ thống không nuốt lỗi mà lập tức ghi một nhiệm vụ `CompensationTask` vào database với trạng thái `PENDING` và type `RELEASE_INVENTORY`.
  - Worker nền của `CompensationService` sẽ tự động quét và bồi hoàn lại khi `inventory-service` phục hồi.
- **Commands executed & Results:**
  - Test `2.5.3` trong `order.lifecycle-stock.integration.test.mjs` -> **PASS** (104ms).
- **Status:** PASS

---

---

### PHASE 3 — FRONTEND CHECKOUT & INTEGRATION

#### Task ID: `TASK-PHASE3-01`
- **Finding:** Trang đặt hàng `/checkout` và luồng thanh toán end-to-end trên Frontend hoàn toàn bị khuyết thiếu (3.1).
- **Files affected:**
  - `apps/frontend/src/types/index.ts`
  - `apps/frontend/src/components/customer/cart-drawer.tsx`
  - `apps/frontend/src/app/(customer)/checkout/page.tsx`
- **Implementation & Fix:**
  1. Mở rộng TypeScript contract trong `types/index.ts` với đầy đủ các types: `Order`, `OrderItem`, `OrderStatus`, `PaymentStatus`, `PaymentMethod`, `CheckoutPayload`, `CheckoutResult`, `CouponValidationResult`.
  2. Nâng cấp `cart-drawer.tsx`: Gắn router navigation cho nút "Tiến hành đặt hàng" để đóng Drawer và chuyển hướng mượt mà sang `/checkout`.
  3. Xây dựng trang `/checkout` (`checkout/page.tsx`):
     - Kiểm tra trạng thái đăng nhập: Nếu chưa đăng nhập, hiển thị form Đăng nhập / Đăng ký nhanh tiện lợi ngay tại chỗ (bảo toàn giỏ hàng).
     - Sổ địa chỉ nhận phân bón: Nạp danh sách địa chỉ từ `GET /customers/me/addresses` hoặc hỗ trợ nhập địa chỉ mới tận ruộng/vườn.
     - Dữ liệu hành chính 3 cấp Việt Nam: Cascading dropdowns chuẩn (Tỉnh/Thành phố -> Quận/Huyện -> Phường/Xã) sử dụng `@phanbonshop/shared-utils`.
     - Phương thức thanh toán: Lựa chọn `COD` (Thanh toán tiền mặt khi nhận hàng) hoặc `BANK_TRANSFER` (Chuyển khoản ngân hàng qua mã VietQR).
     - Thẩm định mã giảm giá (Coupon): Gọi API `POST /coupons/validate` theo thời gian thực, tự động trừ tiền giảm giá vào tổng đơn.
     - Biểu phí vận chuyển minh bạch: Miễn phí vận chuyển từ 1.000.000đ trở lên, tiêu chuẩn 30.000đ cho đơn nhỏ hơn.
     - Idempotency Key: Tự động sinh khóa UUIDv4 qua `crypto.randomUUID()` gắn vào header `Idempotency-Key` của request `POST /checkout` để bảo vệ chống đặt hàng trùng lặp.
     - Xử lý lỗi toàn diện: Hiển thị lỗi trực quan khi hết hàng (`409 Conflict`), mã giảm giá quá hạn, hoặc sự cố mạng.
     - Tự động gọi `clearCart()` và chuyển hướng sang `/checkout/thanh-cong` khi hoàn tất.
- **Commands executed & Results:**
  - `npm test --workspace=@phanbonshop/frontend` -> **6/6 PASS**.
- **Status:** PASS

---

#### Task ID: `TASK-PHASE3-02`
- **Finding:** Trang xác nhận đặt hàng thành công `/checkout/thanh-cong` và hướng dẫn thanh toán VietQR (3.2).
- **Files affected:**
  - `apps/frontend/src/app/(customer)/checkout/thanh-cong/page.tsx`
- **Implementation & Fix:**
  1. Nhận `orderNumber` và `orderId` từ URL search parameters (được bọc trong React `Suspense` boundary).
  2. Gọi `GET /orders/:idOrNumber` nạp thông tin chi tiết đơn hàng đã xác nhận.
  3. Hiển thị banner thành công chuyên nghiệp, mã đơn hàng kèm nút Copy tiện lợi.
  4. Nếu phương thức thanh toán là `BANK_TRANSFER`: Tự động render khung thanh toán VietQR chuyên biệt với thông tin MB Bank, STK `0386 888 999`, chủ tài khoản `CTCP PHAN BON SHOP VN`, số tiền chính xác, nội dung chuyển khoản là mã đơn hàng và hình ảnh dynamic VietQR code.
  5. Cung cấp nút In đơn hàng (`window.print()`), Xem đơn hàng của tôi (`/tai-khoan?tab=orders`), và Tiếp tục mua sắm (`/san-pham`).
- **Status:** PASS

---

#### Task ID: `TASK-PHASE3-03`
- **Finding:** Tab "Đơn hàng mùa vụ" trong `/tai-khoan` chưa kết nối API thực tế, hiển thị placeholder giả (3.3).
- **Files affected:**
  - `apps/frontend/src/app/(customer)/tai-khoan/page.tsx`
- **Implementation & Fix:**
  1. Hỗ trợ query parameter `?tab=orders` tự động chuyển sang tab lịch sử đơn hàng.
  2. Gọi API `GET /orders` lấy danh sách đơn hàng thực tế của khách hàng từ database.
  3. Hiển thị từng đơn hàng theo dạng Card trực quan: Mã đơn hàng, ngày đặt, danh sách sản phẩm, số lượng, quy cách, tổng tiền, địa chỉ nhận hàng, và các badge trạng thái (PENDING, CONFIRMED, PROCESSING, SHIPPING, COMPLETED, CANCELLED).
  4. Bổ sung nút "Hủy Đơn" cho các đơn hàng ở trạng thái `PENDING`: Hỏi lý do hủy và gọi `POST /orders/:id/cancel`, kích hoạt chuỗi bồi hoàn tồn kho tự động.
  5. Bọc toàn bộ `AccountContent` trong `Suspense` để đảm bảo tuân thủ tiêu chuẩn Next.js App Router SSR.
- **Status:** PASS

---

#### Task ID: `TASK-PHASE3-04`
- **Finding:** Thực thi kiểm thử hồi quy toàn diện Monorepo sau Phase 3.
- **Commands executed & Results:**
  1. `npm run lint` -> Exit code: **0** (0 errors, 0 warnings trên toàn bộ monorepo).
  2. `npm run typecheck` -> Exit code: **0** (0 type errors trên toàn bộ 12 workspaces).
  3. `npm test` -> Exit code: **0** (23 unit tests PASS, bao gồm 6 test mới của frontend checkout).
  4. `npm run test:integration --workspace=@phanbonshop/inventory-service` -> Exit code: **0** (6/6 tests PASS).
  5. `npm run test:integration --workspace=@phanbonshop/order-service` -> Exit code: **0** (8/8 tests PASS).
  6. `npm run test:integration --workspace=@phanbonshop/auth-service` -> Exit code: **0** (5/5 tests PASS).
  7. `npm run build` -> Exit code: **0** (Toàn bộ 12 packages/services/apps compile thành công, Next.js frontend sinh 29/29 routes).
- **Status:** PASS

---

---

### PHASE 4 — SECURITY & DATA INTEGRITY

#### Task ID: `TASK-PHASE4-01`
- **Finding:** Khắc phục lỗ hổng Token Reuse không thu hồi toàn bộ Token Family trong `auth-service` (`AUD-P2-003`).
- **Files affected:**
  - `services/auth-service/src/auth/auth.service.ts`
  - `services/auth-service/test/auth.critical-flow.integration.test.mjs`
- **Root cause & Fix:**
  - Theo khuyến nghị bảo mật OAuth 2.0 / RFC 6819, khi phát hiện một Refresh Token đã bị thu hồi (`revokedAt !== null`) được gửi lên để xin cấp mới token, đây là dấu hiệu rõ ràng của hành vi đánh cắp token hoặc replay attack.
  - Trước đây, `AuthService.refresh()` chỉ ném lỗi `UnauthorizedException` cho chính session đó mà không vô hiệu hóa các session hợp lệ khác đang hoạt động của cùng người dùng, khiến kẻ tấn công hoặc phiên đăng nhập bị xâm nhập vẫn tiếp tục duy trì quyền truy cập.
  - Khắc phục:
    1. Trong `AuthService.refresh()`: Khi phát hiện `session.revokedAt !== null`, ghi cảnh báo bảo mật (`logger.warn`) và thực thi batch update:
       ```typescript
       await this.prisma.refreshTokenSession.updateMany({
         where: {
           userId: session.userId,
           revokedAt: null,
         },
         data: {
           revokedAt: new Date(),
         },
       });
       ```
       Đảm bảo toàn bộ Token Family (tất cả các phiên đăng nhập của người dùng) bị hủy bỏ ngay lập tức, ép buộc người dùng phải đăng nhập lại và đổi mật khẩu nếu cần.
    2. Cập nhật integration test `1.6.3` trong `auth.critical-flow.integration.test.mjs`: Kiểm tra khi token cũ bị reuse, không chỉ token đó bị từ chối mà session anh em (sibling session) cũng bị thu hồi ngay lập tức trong database thực tế.
- **Commands executed & Results:**
  - `npm run test:integration --workspace=@phanbonshop/auth-service` -> **5/5 PASS** (3428ms trên MySQL test_auth_db).
- **Status:** PASS

---

#### Task ID: `TASK-PHASE4-02`
- **Finding:** Xác thực Magic Bytes nhị phân cho tệp tải lên và triệt để chặn tệp SVG chống Stored XSS / MIME Spoofing (`AUD-P2-004`).
- **Files affected:**
  - `packages/shared-utils/src/validation.ts`
  - `packages/shared-utils/test/utils.test.mjs`
  - `services/product-service/src/minio/minio.service.ts`
  - `services/content-service/src/minio/minio.service.ts`
- **Root cause & Fix:**
  - Trước đây, hệ thống chỉ dựa vào `file.mimetype` và phần mở rộng do client gửi lên (dễ dàng bị làm giả qua curl/Postman). Nếu attacker tải lên file SVG chứa mã độc `<script>` hoặc file HTML ngụy trang bằng đuôi `.jpg`, tệp tin sẽ được lưu thẳng lên MinIO và phân phát công khai, gây nguy cơ Stored XSS nghiêm trọng.
  - Khắc phục:
    1. Xây dựng tiện ích xác thực chuẩn `validateImageMagicBytes()` trong `@phanbonshop/shared-utils`:
       - Chặn tuyệt đối phần mở rộng `.svg` / `.svgz` và MIME type `image/svg+xml`.
       - Kiểm tra Magic Bytes nhị phân thuần trên buffer:
         - **JPEG**: `0xFF, 0xD8, 0xFF`
         - **PNG**: `0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A`
         - **GIF**: `GIF87a` hoặc `GIF89a`
         - **WebP**: `RIFF` (bytes 0..3) kết hợp `WEBP` (bytes 8..11)
       - Quét 512 bytes đầu tiên để phát hiện và ngăn chặn mã SVG/XML ẩn danh (`<?xml`, `<svg`, `<!DOCTYPE svg`) được ngụy trang dưới đuôi ảnh raster.
    2. Tích hợp `validateImageMagicBytes` vào `MinioService.uploadFile()` của cả `product-service` và `content-service`, ném `BadRequestException` với thông điệp rõ ràng nếu tệp vi phạm.
    3. Viết 9 unit tests chuyên biệt trong `packages/shared-utils/test/utils.test.mjs` bao phủ các ca kiểm thử: JPEG, PNG, GIF, WebP hợp lệ; chặn file .svg; chặn SVG ngụy trang thành PNG; chặn XML ngụy trang thành JPEG; chặn file nhị phân/shell script rác; và chặn buffer dưới 12 bytes.
- **Commands executed & Results:**
  - `npm test --workspace=@phanbonshop/shared-utils` -> **17/17 PASS** (25ms).
- **Status:** PASS

---

#### Task ID: `TASK-PHASE4-03`
- **Finding:** Thu dọn tệp rác mồ côi (Orphan Object Cleanup) trên MinIO S3 khi bài viết, banner hoặc ảnh sản phẩm bị xóa hoặc cập nhật (`AUD-P2-005`).
- **Files affected:**
  - `services/product-service/src/minio/minio.service.ts`
  - `services/product-service/src/product/product.service.ts`
  - `services/content-service/src/minio/minio.service.ts`
  - `services/content-service/src/posts/posts.service.ts`
  - `services/content-service/src/banners/banners.service.ts`
- **Root cause & Fix:**
  - Trong `content-service`, khi bài viết blog (`Post`) hoặc banner quảng cáo (`Banner`) bị xóa qua API `DELETE`, bản ghi database bị xóa nhưng ảnh bìa tương ứng trên MinIO không hề được dọn dẹp, gây lãng phí dung lượng lưu trữ lâu dài. Tương tự, khi ảnh bìa được cập nhật thay thế bằng ảnh mới, ảnh cũ cũng bị bỏ rơi trên bucket.
  - Khắc phục:
    1. Bổ sung hàm tiện ích `extractObjectKey(urlOrKey: string): string | null` trong cả hai `MinioService` (`product-service` và `content-service`), hỗ trợ bóc tách objectKey chính xác dù dữ liệu lưu là URL tuyệt đối (`http://localhost:9000/content-images/posts/...`) hay object key tương đối.
    2. Trong `services/content-service/src/posts/posts.service.ts`:
       - Inject `MinioService`.
       - Trong `deletePost(id)`: Tự động trích xuất key và gọi `minioService.deleteFile(objectKey)` nếu `existing.coverImageUrl` tồn tại.
       - Trong `updatePost(id, dto)`: Tự động xóa ảnh cũ trên MinIO khi người dùng thay đổi ảnh bìa mới.
    3. Trong `services/content-service/src/banners/banners.service.ts`:
       - Inject `MinioService`.
       - Trong `deleteBanner(id)`: Tự động trích xuất key và gọi `minioService.deleteFile(objectKey)` nếu `existing.imageUrl` tồn tại.
       - Trong `updateBanner(id, dto)`: Tự động xóa ảnh cũ trên MinIO khi cập nhật URL ảnh mới.
    4. Kiểm tra và xác nhận `product-service`: Hàm `delete(id)` đã có logic duyệt qua `product.images` và gọi `minioService.deleteFile(img.objectKey)`, cũng như `deleteImage(id, imageId)` xóa đúng tệp trên MinIO.
- **Status:** PASS

---

#### Task ID: `TASK-PHASE4-04`
- **Finding:** Thực thi kiểm thử hồi quy toàn diện Monorepo sau Phase 4.
- **Commands executed & Results:**
  1. `npm run lint` -> Exit code: **0** (0 errors, 0 warnings trên toàn bộ monorepo).
  2. `npm run typecheck` -> Exit code: **0** (0 type errors trên toàn bộ 12 workspaces).
  3. `npm test` -> Exit code: **0** (Toàn bộ 32 unit tests PASS trên tất cả các package/service/frontend).
  4. `npm run test:integration --workspace=@phanbonshop/auth-service` -> Exit code: **0** (5/5 tests PASS).
  5. `npm run test:integration --workspace=@phanbonshop/inventory-service` -> Exit code: **0** (6/6 tests PASS).
  6. `npm run test:integration --workspace=@phanbonshop/order-service` -> Exit code: **0** (8/8 tests PASS).
  7. `npm run build` -> Exit code: **0** (Toàn bộ 12 packages/services/apps compile thành công, Next.js frontend sinh 29/29 routes).
- **Status:** PASS





