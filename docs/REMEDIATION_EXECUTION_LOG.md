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

