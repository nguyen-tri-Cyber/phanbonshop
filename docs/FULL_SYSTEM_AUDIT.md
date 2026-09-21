# PHANBONSHOP — BÁO CÁO TOÀN DIỆN KỸ THUẬT HỆ THỐNG (FULL SYSTEM TECHNICAL AUDIT)

> **Lưu ý trạng thái:** Đây là audit nền trước remediation. Quyết định phát hành mới nhất nằm tại
> [`PRODUCTION_READINESS_REPORT.md`](./PRODUCTION_READINESS_REPORT.md); không dùng các kết luận lịch sử
> trong tài liệu này để suy ra hệ thống đã sẵn sàng production.
*(Bản hiệu chỉnh toàn diện theo nguyên tắc Source Code là nguồn sự thật duy nhất)*

> **Ngày thực hiện kiểm toán:** 20/09/2026  
> **Phiên bản mã nguồn đối chiếu:** Branch `main` | Commit `9d1ddf598d0aa50f9062b5f86741d6d304dcc746`  
> **Mục tiêu tối cao:** Đánh giá toàn bộ hiện trạng mã nguồn thực tế, phân tách rạch ròi giữa **Mức độ nghiêm trọng kỹ thuật (Severity P0-P3)** và **Mức độ chặn phát hành (Release/Production/Local Blocker)**, phát hiện lỗ hổng tiềm ẩn và khiếm khuyết thiết kế (design gaps), ngăn chặn việc phát triển vội vã khi nền tảng cốt lõi chưa ổn định.  
> **Nguyên tắc cốt lõi:** Tuyệt đối không phỏng đoán. Mọi kết luận đều có dẫn chứng từ mã nguồn thực tế. Không thực hiện sửa đổi mã nguồn ứng dụng trong quá trình audit.

---

## 1. TỔNG QUAN ĐIỀU HÀNH (EXECUTIVE SUMMARY)

Dự án **PhanBonShop** là nền tảng thương mại điện tử chuyên ngành nông nghiệp (phân bón, thuốc BVTV, dinh dưỡng cây trồng) theo kiến trúc Microservices phân tán với 14 workspaces (6 NestJS microservices, 1 NestJS API Gateway, 1 Next.js 14 Storefront/Admin, và 6 thư viện dùng chung/cấu hình).

### Kết luận tổng quan hiện trạng:
1. **Kiến trúc Khung & Contract dữ liệu:** Rất tốt. Cấu trúc monorepo phân tách rõ ràng, typing chặt chẽ thông qua `@phanbonshop/shared-types` và `@phanbonshop/shared-utils`, ValidationPipe NestJS kích hoạt ở mức nghiêm ngặt, schema Prisma của 6 database dịch vụ được chuẩn hóa với kiểu dữ liệu tiền tệ `Decimal(12, 2)`.
2. **Các điểm nghẽn phát hành (Release Blockers) & Khiếm khuyết thiết kế (Design Gaps):**
   - **Frontend Checkout hoàn toàn bị bỏ ngỏ (Release Blocker = YES):** Giao diện `apps/frontend/src/components/customer/cart-drawer.tsx` (dòng 140) có nút "Tiến hành đặt hàng" nhưng không hề gán sự kiện `onClick` hay điều hướng. Trong toàn bộ thư mục `apps/frontend/src/app` **hoàn toàn không tồn tại trang hoặc form checkout** để khách hàng gửi đơn hàng thực tế vào backend Saga.
   - **Khiếm khuyết vòng đời giữ chỗ kho khi thanh toán Online (Online Payment Inventory Design Gap):** Quy trình hiện tại của `order-service` giữ chỗ kho 15 phút, nhưng hàm `commitInventory` chỉ được gọi khi đơn hàng hoàn tất giao hàng (`COMPLETED`). Đối với thanh toán Online (MoMo/VNPay), hệ thống chưa có thiết kế vòng đời giữ chỗ rõ ràng khi khách đang ở cổng thanh toán hoặc khi thanh toán thất bại/hết hạn.
   - **Hạ tầng Redis tách rời khỏi mã nguồn (Architecture Gap):** `docker-compose.yml` chạy `redis:7-alpine`, nhưng trong mã nguồn của cả 6 microservices và API Gateway, **không có service nào cài đặt `ioredis` hay kết nối tới Redis**. Toàn bộ Rate Limiting, Locking và Idempotency đều đang dùng in-memory hoặc truy vấn thẳng MySQL.
   - **Tiến trình bồi hoàn Saga & Dọn dẹp kho thiếu Worker tự động:** `order-service` khi gặp lỗi giải phóng kho sẽ ghi bản ghi vào bảng `compensation_tasks` trạng thái `PENDING`. Endpoint xử lý bù trừ và endpoint dọn dẹp reservation hết hạn (`cleanup-expired`) đã có sẵn, nhưng **không có background worker định kỳ thực thi**. Khi chạy đa bản sao (multi-replica), worker này còn đòi hỏi cơ chế khóa phân tán hoặc claim an toàn (`SKIP LOCKED`).
   - **Hiện trạng Thanh toán (Payment Reality):** Hệ thống chỉ mới chuẩn bị domain và hỗ trợ cơ bản luồng `COD` (chuyển trạng thái đơn hàng) và `BANK_TRANSFER` (sinh chuỗi mã VietQR tĩnh). Chưa có tích hợp cổng thanh toán trực tuyến (`MOMO`, `VNPAY` chỉ là placeholder enum).
   - **Cấu hình Nginx Production thiếu SSL Port 443 (Production Blocker = YES, Local Blocker = NO):** `docker-compose.prod.yml` ánh xạ cổng `443:443`, nhưng `docker/nginx/conf.d/default.conf` chỉ cấu hình `listen 80;` và thư mục `certs/` chỉ có file `.gitkeep`.
   - **Công cụ Sao lưu & Khôi phục (Backup & DR Tooling):** Trong repository hoàn toàn không có script tự động sao lưu MySQL hay MinIO volume nào. Trạng thái backup ngoài hạ tầng (offsite/cloud) là `UNVERIFIED`.

---

## 2. PHẠM VI KIỂM TOÁN (AUDIT SCOPE)

Audit bao gồm 100% các thành phần trong repository:
- **6 Microservices:** `auth-service`, `product-service`, `order-service`, `inventory-service`, `customer-service`, `content-service`.
- **1 API Gateway:** `api-gateway`.
- **1 Web Application:** `frontend` (Storefront & Admin).
- **6 Shared Packages & Configs:** `shared-types`, `shared-utils`, `logger`, `config`, `tsconfig`, `eslint-config`.
- **Hạ tầng Docker & Reverse Proxy:** `docker-compose.yml`, `docker-compose.prod.yml`, `docker/nginx/*`, `docker/mysql/*`, `docker/Dockerfile.*`.
- **Hệ cơ sở dữ liệu:** 6 Prisma schemas, 6 thư mục migration, script khởi tạo MySQL database.
- **Tài liệu & CI:** `README.md`, `PROJECT_STATUS.md`, `docs/*`, `.github/workflows/ci.yml`.

---

## 3. THÔNG SỐ NỀN TẢNG (REPOSITORY BASELINE)

Các thông số môi trường được ghi nhận trước khi tiến hành rà soát:

```text
Branch: main
Commit SHA: 9d1ddf598d0aa50f9062b5f86741d6d304dcc746
Node.js: v24.15.0
npm: 11.12.1
Docker: Docker version 29.5.3, build d1c06ef
Docker Compose: Docker Compose version v5.1.4
Hệ điều hành kiểm toán: Windows 11 Pro / PowerShell
Audit Date: 2026-09-20
```

---

## 4. DANH MỤC HỆ THỐNG (SYSTEM INVENTORY)

| Thành phần | Loại | Trạng thái mã nguồn | Cơ sở dữ liệu | Cổng Dev | Phụ thuộc chính | Ghi chú vận hành |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `frontend` | App (Next.js 14) | Hoạt động (Thiếu Checkout) | Không | 3000 | React 18, TailwindCSS, Zod | UI Storefront + Admin; nút checkout chưa gắn form |
| `api-gateway` | App (NestJS 10) | Hoạt động | Không | 8080 | Express-http-proxy, Axios | Reverse proxy định tuyến, inject `X-Internal-Secret` |
| `auth-service` | Service (NestJS 10) | Hoạt động | `auth_db` | 3001 | Prisma, Bcrypt (12), JWT | Đăng ký, đăng nhập, JWT + Refresh Token Rotation |
| `product-service` | Service (NestJS 10) | Hoạt động | `product_db` | 3002 | Prisma, MinIO Client | Danh mục, sản phẩm NPK, biến thể, đánh giá mua hàng |
| `order-service` | Service (NestJS 10) | Hoạt động (Thiếu Worker) | `order_db` | 3003 | Prisma, Axios | Saga Checkout, Coupon, VietQR, Compensation tasks |
| `inventory-service`| Service (NestJS 10) | Hoạt động (Thiếu Worker) | `inventory_db` | 3004 | Prisma, Raw SQL Lock | Khóa tồn `SELECT FOR UPDATE`, giữ chỗ, xuất nhập kho |
| `customer-service` | Service (NestJS 10) | Hoạt động | `customer_db` | 3005 | Prisma | Hồ sơ nông dân/đại lý, sổ địa chỉ 3 cấp VN |
| `content-service`  | Service (NestJS 10) | Hoạt động | `content_db` | 3006 | Prisma, MinIO Client | Bài viết kỹ thuật canh tác, Banner quảng cáo mùa vụ |
| `shared-types`     | Package (TS) | Hoạt động | N/A | N/A | TypeScript | DTOs, Enums, API Interfaces dùng chung |
| `shared-utils`     | Package (TS) | Hoạt động (Có unit test) | N/A | N/A | TypeScript | Tiền tệ VND, Slug tiếng Việt, Regex điện thoại VN |
| `logger`           | Package (TS) | Hoạt động | N/A | N/A | Pino | Logger cấu trúc JSON, che giấu dữ liệu nhạy cảm |
| `config`           | Package (TS) | Hoạt động | N/A | N/A | Dotenv, Zod | Nạp và kiểm thực biến môi trường |
| `MySQL 8.0`        | Hạ tầng DB | Hoạt động | 6 Logical DBs | 3307->3306 | Volume `mysql_data` | Khởi tạo qua `docker/mysql/init.sql` |
| `MinIO S3`         | Hạ tầng Media | Hoạt động | Object Storage | 9000/9001 | Volume `minio_data` | 2 Buckets: `product-images`, `content-images` |
| `Redis 7`          | Hạ tầng Cache | Chưa dùng trong Code | N/A | 6379 | Volume `redis_data` | Container chạy nhưng mã nguồn không kết nối |
| `Nginx 1.27`       | Reverse Proxy | Hoạt động (Thiếu 443) | N/A | 80 (prod: 443) | `docker/nginx/nginx.conf` | Định tuyến traffic tới Frontend và Gateway |

---

## 5. KIẾN TRÚC HIỆN TẠI (CURRENT ARCHITECTURE)

Hệ thống áp dụng mô hình **Database-per-Service Microservices**:
```text
[Khách Hàng / Trình Duyệt Web]
              │ (HTTP:80)
              ▼
       [Nginx Reverse Proxy]
        ├── /api/* ───────────────► [API Gateway (8080)]
        │                                 │ (X-Internal-Secret)
        │                                 ├──► [auth-service (3001)] ──────► [auth_db]
        │                                 ├──► [product-service (3002)] ───► [product_db]
        │                                 ├──► [order-service (3003)] ─────► [order_db]
        │                                 │        │ (Inter-service HTTP)
        │                                 │        ├──► [inventory-service (3004)] ─► [inventory_db]
        │                                 │        ├──► [customer-service (3005)] ──► [customer_db]
        │                                 │        └──► [product-service (3002)]
        │                                 ├──► [customer-service (3005)] ──► [customer_db]
        │                                 └──► [content-service (3006)] ──► [content_db]
        └── /* ───────────────────► [Frontend Next.js (3000)]
```

### Đánh giá kiến trúc:
- **Ưu điểm:** Tách biệt độc lập domain dữ liệu, không có cross-database join, giao tiếp nội bộ có xác thực khóa bí mật `X-Internal-Secret`.
- **Nhược điểm:** Giao tiếp giữa các microservices hoàn toàn là **Synchronous HTTP** qua Axios. Chưa có Message Broker (RabbitMQ/Kafka) hay cơ chế Circuit Breaker. Khi `inventory-service` bị chậm hoặc nghẽn, `order-service` sẽ nghẽn theo.

---

## 6. KẾT QUẢ KIỂM THỰC BUILD (BUILD VALIDATION)

Kiểm thực thực tế trên môi trường dòng lệnh:

| Lệnh thực thi | Kết quả | Chi tiết & Mã thoát (Exit Code) |
| :--- | :---: | :--- |
| `npm run prisma:validate` | **PASS** | Exit code 0. Toàn bộ 6 Prisma schemas hợp lệ 100%. |
| `npm run lint` | **PASS** | Exit code 0. Chạy ESLint trên toàn bộ 13 workspaces không phát hiện lỗi syntax/formatting. |
| `npm run typecheck` | **PASS** | Exit code 0. TypeScript Compiler (`tsc --noEmit`) vượt qua trên tất cả các dịch vụ và packages. |
| `npm run test` | **PASS** | Exit code 0. Chạy 15 test cases (8 shared-utils, 3 inventory, 4 order). 9 workspace còn lại không có test. |
| `docker compose config` | **PASS** | Exit code 0. Cú pháp `docker-compose.yml` hợp lệ, cấu hình mạng và volume đồng bộ. |
| `docker compose -f docker-compose.prod.yml config` | **PASS** | Exit code 0. Cú pháp `docker-compose.prod.yml` hợp lệ. |
| `npm run build` | **PARTIAL** | **Backend PASS, Frontend STALLED**. 11 packages/services backend compile `tsc` thành công ra `dist/`. Tuy nhiên, `next build` của `apps/frontend` bị treo khi chạy ngoài Docker do `sitemap.ts` gọi fetch chặn tới domain `gateway:8080` không tồn tại trên host local và cờ `outputFileTracingRoot` quét toàn bộ monorepo. |

---

## 7. ĐÁNH GIÁ CHẤT LƯỢNG TEST (TEST ASSESSMENT)

### Ma trận Độ phủ Kiểm thử (Test Coverage Gap Matrix):

| Thành phần | Real Unit Tests | Mock/In-memory Logic | Integration Tests | E2E Tests | Luồng quan trọng được test | Đánh giá chất lượng |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| `shared-utils` | 8 | 0 | 0 | 0 | VND format, VN phone regex, slug | ✅ Real unit test chuẩn xác |
| `order-service` | 0 | 4 | 0 | 0 | Giảm giá coupon, State Machine | 🟡 Chỉ test hàm tự viết lại trong file test |
| `inventory-service` | 0 | 3 | 0 | 0 | Tính `availableQuantity` | 🟡 Chỉ test logic toán học, không test DB |
| `auth-service` | 0 | 0 | 0 | 0 | Không có test | 🔴 Khoảng trống nghiêm trọng |
| `product-service` | 0 | 0 | 0 | 0 | Không có test | 🔴 Khoảng trống nghiêm trọng |
| `customer-service`| 0 | 0 | 0 | 0 | Không có test | 🔴 Khoảng trống nghiêm trọng |
| `content-service` | 0 | 0 | 0 | 0 | Không có test | 🔴 Khoảng trống |
| `api-gateway` | 0 | 0 | 0 | 0 | Không có test | 🔴 Khoảng trống |
| `frontend` | 0 | 0 | 0 | 0 | Không có test (không có script test) | 🔴 Khoảng trống |

**Bằng chứng kiểm tra mã test:**
File `services/order-service/test/order.unit.test.mjs` và `services/inventory-service/test/inventory.unit.test.mjs` không hề import `CheckoutService`, `OrderService`, hay `PrismaService` mà tự định nghĩa các hàm độc lập để test toán học. Do đó, **0% logic thực tế của NestJS Services được bảo vệ bởi test tự động**.

---

## 8. PHÁT HIỆN HỆ CƠ SỞ DỮ LIỆU (DATABASE FINDINGS)

### Đánh giá Schema & Data Integrity:
1. **Kiểu dữ liệu tiền tệ:** Đã được định nghĩa chuẩn xác bằng `@db.Decimal(12, 2)` trong tất cả các bảng (`products`, `product_variants`, `orders`, `order_items`, `coupons`). Không sử dụng kiểu float/double tránh sai lệch số học.
2. **Khóa ngoại phân tán:** Các dịch vụ tuân thủ mô hình Database-per-Service. Bảng `orders` trong `order_db` lưu `customerId` và `shippingAddressId` dưới dạng `VARCHAR(36)` thay vì foreign key cứng tới `customer_db`.
3. **Chỉ mục (Indexes):**
   - Đầy đủ unique indexes trên các trường định danh: `users.email`, `users.phone`, `products.slug`, `product_variants.sku`, `coupons.code`, `idempotency_records.idempotencyKey`.
   - Index trên các cột tìm kiếm và lọc: `orders.status`, `inventory_items.sku`, `inventory_reservations.status`.
4. **Migrations:** Cả 6 dịch vụ đều có migration `20260919000000_init` và file `migration_lock.toml`.

---

## 9. PHÁT HIỆN VỀ XÁC THỰC (AUTHENTICATION FINDINGS)

- **Cơ chế Hash mật khẩu:** Sử dụng `bcrypt` với cost factor là 12 (`services/auth-service/src/auth/auth.service.ts`), đảm bảo độ an toàn cao chống tấn công vét cạn.
- **Vòng đời JWT:**
  - `JWT_ACCESS_SECRET`: Hết hạn sau 15 phút.
  - `JWT_REFRESH_SECRET`: Hết hạn sau 7 ngày.
- **Refresh Token Rotation:** Khi cấp mới Access Token, Refresh Token cũ bị thu hồi (`revokedAt = new Date()`) và Refresh Token mới được ghi nhận trong `refresh_tokens`.
- **Lỗ hổng Token Reuse:**
  - *Vị trí:* `services/auth-service/src/auth/auth.service.ts` dòng 162.
  - *Hiện trạng:* Khi phát hiện Refresh Token đã bị thu hồi (`tokenRecord.revokedAt !== null`), service ném lỗi `UnauthorizedException('Refresh token has been revoked')`.
  - *Thiếu sót:* Hệ thống **không tự động vô hiệu hóa toàn bộ họ token (token family)** của tài khoản này. Kẻ tấn công nếu có được Refresh Token hợp lệ khác thuộc cùng phiên vẫn có thể tiếp tục sử dụng cho đến khi người dùng gọi `logoutAll`.

---

## 10. PHÁT HIỆN VỀ PHÂN QUYỀN (AUTHORIZATION / RBAC FINDINGS)

### Ma trận Quyền hạn (RBAC Permission Matrix):

| Role | Khách hàng (Storefront) | Xem/Sửa Đơn cá nhân | Quản lý Kho (Inventory) | Quản lý Đơn (Admin Order) | Quản lý Sản phẩm / Bài viết | Cấu hình Hệ thống |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `CUSTOMER` | ✅ | ✅ (Chính chủ) | ❌ | ❌ | ❌ | ❌ |
| `STAFF` | ✅ | ❌ | ❌ | ✅ (Xem, duyệt đơn) | ❌ | ❌ |
| `WAREHOUSE`| ✅ | ❌ | ✅ (Nhập xuất, chỉnh tồn)| ✅ (Chuyển trạng thái xuất) | ❌ | ❌ |
| `MANAGER`  | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| `ADMIN`    | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `SUPER_ADMIN`| ✅ | ❌ | ✅ | ✅ | ✅ | ✅ (Toàn quyền) |

- **Bảo vệ Backend:** Các controller quản trị đều được gắn `@UseGuards(JwtAuthGuard, RolesGuard)` và `@Roles(...)`. Không có admin endpoint bị mở public.
- **Bảo vệ IDOR:** Trong `customer-service` và `order-service`, các truy vấn người dùng đối chiếu `req.user.sub` với `customerId` của bản ghi, ngăn ngừa việc người dùng A đọc hoặc sửa dữ liệu của người dùng B.

---

## 11. PHÁT HIỆN VỀ API GATEWAY (GATEWAY FINDINGS)

- **Cơ chế Reverse Proxy:** `api-gateway` sử dụng Express middleware và `express-http-proxy` để định tuyến các tiền tố URL tới downstream microservices.
- **Bảo vệ `X-Internal-Secret`:** API Gateway tự động chèn header `X-Internal-Secret: process.env.INTERNAL_SERVICE_SECRET` khi chuyển tiếp request vào mạng nội bộ. Các endpoint nội bộ (`/internal/v1/*`) từ chối request không có secret này.
- **Lỗ hổng:** Rate Limiting trên Gateway được thực hiện bằng `express-rate-limit` sử dụng bộ nhớ in-memory (`MemoryStore`). Khi triển khai nhiều container Gateway trên production, rate limit bị phân mảnh theo từng instance.

---

## 12. GIAO TIẾP DỊCH VỤ NỘI BỘ (INTERNAL SERVICE COMMUNICATION)

### Đồ thị phụ thuộc giao tiếp đồng bộ:
```text
[order-service]
       │───► customer-service (Xác thực địa chỉ giao hàng) [Timeout: 5s, No Circuit Breaker]
       │───► product-service (Kiểm tra giá & biến thể)      [Timeout: 5s, No Circuit Breaker]
       └───► inventory-service (Giữ chỗ & Commit kho)       [Timeout: 5s, No Circuit Breaker]
```
- **Rủi ro Cascading Failure:** Nếu `customer-service` hoặc `inventory-service` bị quá tải hoặc phản hồi chậm quá 5 giây, toàn bộ luồng checkout của `order-service` sẽ ném lỗi `ServiceUnavailableException`. Không có cơ chế fallback hoặc hàng đợi lưu tạm request.

---

## 13. PHÁT HIỆN VỀ LUỒNG CHECKOUT (CHECKOUT AUDIT)

Luồng xử lý tại `services/order-service/src/checkout/checkout.service.ts`:
1. **Kiểm tra Idempotency:** Đọc bảng `idempotency_records` theo `Idempotency-Key` và SHA-256 hash của body. Nếu trùng key + trùng body đang xử lý, trả về lỗi 409 hoặc response đã lưu.
2. **Xác minh địa chỉ khách hàng:** Gọi nội bộ `GET http://customer:3005/internal/v1/customers/addresses/{id}`.
3. **Tính toán lại giá độc lập:** Backend duyệt từng item trong giỏ hàng, gọi `product-service` lấy giá gốc và tính toán tổng tiền (`subtotal`). Client không thể tự sửa giá.
4. **Áp dụng Coupon:** Kiểm tra ngày hiệu lực, giá trị đơn tối thiểu (`minOrderValue`), giới hạn lượt dùng (`maxUsage`, `usedCount`), tính số tiền giảm (`discountAmount`).
5. **Giữ chỗ tồn kho (Reservation):** Gọi `POST http://inventory:3004/internal/v1/inventory/reservations`.
6. **Tạo Đơn Hàng:** Thực thi transaction tạo bản ghi `orders` và `order_items` với trạng thái `PENDING`.
7. **Bảo hiểm bồi hoàn (Saga Compensation):** Nếu tạo đơn thất bại, phát lệnh release reservation. Nếu release thất bại do lỗi mạng, lưu vào bảng `compensation_tasks` trạng thái `PENDING`.

---

## 14. PHÁT HIỆN VỀ QUẢN LÝ TỒN KHO (INVENTORY AUDIT)

- **Cơ chế chống Race Condition:** Trong `services/inventory-service/src/inventory/inventory.service.ts`, các phương thức thao tác tồn kho sử dụng:
  ```sql
  SELECT id, stockQuantity, reservedQuantity FROM inventory_items WHERE sku = ? FOR UPDATE;
  ```
  *Đánh giá chính xác:* Khóa dòng bi quan (Pessimistic row locking) đã được cài đặt để phòng ngừa bán vượt tồn kho đồng thời. Tuy nhiên, hiệu quả thực tế cần được xác minh qua integration test đa luồng.
- **Lỗ hổng Giữ chỗ mồ côi (Orphan Reservations):** Bảng `inventory_reservations` có trường `expiresAt` (mặc định 15 phút). Tuy nhiên, **không có cron service tự động quét dọn**. Nếu đơn hàng bị bỏ dở, số lượng `reservedQuantity` không tự động trả về `availableQuantity` cho đến khi có người gọi tay endpoint `/cleanup-expired`.

---

## 15. KHIẾM KHUYẾT THIẾT KẾ GIỮ CHỖ KHO THANH TOÁN ONLINE (ONLINE PAYMENT INVENTORY DESIGN GAP)

> **PHÁT HIỆN QUAN TRỌNG:** Hệ thống hiện tại có sự lệch pha giữa Vòng đời Đơn hàng, Vòng đời Giữ chỗ kho (TTL 15 phút) và Vòng đời Thanh toán.

### Phân tích hiện trạng mã nguồn:
- Trong `checkout.service.ts`: Khi khách checkout, hệ thống gọi `inventory-service` tạo một reservation với TTL mặc định 15 phút (`expiresAt = NOW() + 15m`).
- Trong `orders.service.ts` dòng 152-156: Hàm `commitInventory` (chuyển từ reserved sang trừ hẳn stock) chỉ được gọi khi đơn hàng chuyển sang trạng thái `COMPLETED` (tức là sau khi đã giao hàng thành công, có thể mất 2-3 ngày!).
- Nếu đơn hàng thanh toán COD hoặc chuyển khoản VietQR ở trạng thái `PENDING` quá 15 phút, khi tiến trình cleanup kho hết hạn chạy, reservation sẽ bị coi là hết hạn và giải phóng kho, dẫn đến nguy cơ bán trùng hàng cho khách khác dù đơn hàng cũ vẫn đang chờ xử lý!

### Thiết kế mục tiêu bắt buộc cho Thanh toán Online (MoMo / VNPay):
```text
1. Khách bấm Thanh toán Online
         │
         ▼
2. Reserve Inventory (TTL: 15 phút)
         │
         ▼
3. Create Order (status: PENDING_PAYMENT)
         │
         ▼
4. Create Payment Record (status: PENDING)
         │
         ▼
5. Redirect khách sang MoMo / Hiển thị QR MoMo
         │
         ├───► Trường hợp A: Khách thanh toán thành công (MoMo gửi Webhook IPN verified)
         │           │
         │           ▼
         │     Cập nhật Payment: SUCCESS
         │     Cập nhật Order: CONFIRMED / PROCESSING
         │     Chuyển Inventory Reservation sang ĐÃ PHÂN BỔ (Allocated / Committed)
         │
         └───► Trường hợp B: Khách hủy, thất bại, hoặc quá hạn 15 phút (TIMEOUT / CANCEL)
                     │
                     ▼
               Cập nhật Payment: FAILED / EXPIRED
               Cập nhật Order: CANCELLED
               Kích hoạt Release Inventory Reservation ngay lập tức
```
*Kết luận:* Trước khi tích hợp MoMo, `order-service` và `inventory-service` phải tái cấu trúc vòng đời reservation để hỗ trợ trạng thái thanh toán online này.

---

## 16. PHÁT HIỆN VỀ TÍNH BẢO LƯU (IDEMPOTENCY AUDIT)

- Bảng `idempotency_records` trong `order_db` lưu trữ: `idempotencyKey`, `requestPath`, `requestHash`, `responseStatus`, `responseBody`, `createdAt`, `expiresAt`.
- **Đánh giá:** Logic kiểm tra claim và hash rất cẩn thận. Tuy nhiên, việc reservation kho xảy ra ở `inventory-service` trước khi transaction tạo đơn hàng trong `order-service` hoàn tất có nghĩa là: nếu request 1 tạo reservation xong rồi bị crash trước khi ghi idempotency completed, request 2 có thể gặp trạng thái in-progress hoặc failed reclaim.
- **Trạng thái:** `Needs Verification` cho đến khi vượt qua bài kiểm tra tích hợp chạy 10 request đồng thời cùng key.

---

## 17. HIỆN TRẠNG CHỨC NĂNG THANH TOÁN (PAYMENT AUDIT)

> **XÁC NHẬN:** Dự án hoàn toàn **CHƯA CÓ HỆ THỐNG THANH TOÁN HOÀN CHỈNH END-TO-END**.

### Bảng phân định trạng thái thành phần thanh toán:

| Thành phần thanh toán | Hiện trạng thực tế trong mã nguồn | Đánh giá phân loại |
| :--- | :--- | :--- |
| **Payment Method Support** | Hỗ trợ khai báo COD và BANK_TRANSFER | 🟡 Domain Preparation |
| **Payment Data Model** | Chưa có bảng `payments` độc lập; thông tin nằm trong bảng `orders` và bảng con `payment_records` nội bộ | 🟡 Sơ khai |
| **COD Workflow** | Có state transition trong `orders.service.ts`, nhưng thiếu trang Checkout frontend để kích hoạt | 🔴 Incomplete End-to-End |
| **Bank Transfer (VietQR)** | Sinh chuỗi mã VietQR NAPAS247 chuẩn, nhưng thiếu hiển thị frontend và thiếu webhook đối soát | 🔴 Incomplete End-to-End |
| **Payment Gateway (MoMo)** | Chỉ có giá trị enum `MOMO` trong shared-types/Prisma. Hoàn toàn không có code kết nối API MoMo | ⚪ Placeholder Only |
| **Payment Gateway (VNPay)**| Chỉ có giá trị enum `VNPAY` trong shared-types/Prisma. Hoàn toàn không có code kết nối | ⚪ Placeholder Only |
| **Payment Confirmation** | Hoàn toàn thủ công qua Admin bấm duyệt đơn | 🟡 Manual Only |
| **Reconciliation & Refund** | Không có bảng lưu lịch sử giao dịch đối soát hoặc logic hoàn tiền | ⚪ Chưa có |
| **Webhook / IPN** | Không có controller hoặc route nào tiếp nhận IPN từ cổng thanh toán | ⚪ Chưa có |

---

## 18. PHÁT HIỆN VỀ PRODUCT SERVICE

- **Đặc thù Nông Nghiệp:** Hỗ trợ đầy đủ các trường chuyên ngành cây trồng: `npkRatio` (ví dụ: 16-16-8, 20-20-15), `form` (hạt, lỏng, bột), `activeIngredients`, `cropSuitability` (lúa, sầu riêng, thanh long), `usageStage` (bón lót, bón thúc), `dosageInstructions`.
- **Đánh giá sản phẩm (Product Reviews):** Endpoint `POST /api/v1/products/{id}/reviews` gọi sang `order-service` để kiểm tra khách hàng đã có đơn hàng hoàn thành (`COMPLETED`) chứa sản phẩm này hay chưa (`verifiedPurchase`).

---

## 19. PHÁT HIỆN VỀ CUSTOMER SERVICE

- **Địa chính Việt Nam:** Sổ địa chỉ hỗ trợ chuẩn hóa 3 cấp hành chính Việt Nam: Tỉnh/Thành phố (`provinceId`, `provinceName`), Quận/Huyện (`districtId`, `districtName`), Phường/Xã (`wardId`, `wardName`).
- **Xác thực số điện thoại:** Sử dụng regex chuẩn di động 10 số Việt Nam (`0[3|5|7|8|9]xxxxxxxx`) từ `@phanbonshop/shared-utils`.

---

## 20. PHÁT HIỆN VỀ CONTENT SERVICE & KIỂM THỰC XSS

- **Kiểm thực Render Frontend:** File `apps/frontend/src/app/(customer)/kien-thuc/[slug]/page.tsx` dòng 218-220 render nội dung bài viết dưới dạng:
  ```tsx
  <article className="prose prose-slate max-w-none text-gray-800 text-sm sm:text-base leading-relaxed mb-12 space-y-4 whitespace-pre-line">
    {post.content}
  </article>
  ```
- **Kết luận:** Frontend hiển thị `{post.content}` dưới dạng chuỗi văn bản (text node) được React tự động escape, **hoàn toàn KHÔNG dùng `dangerouslySetInnerHTML`**.
- Do đó, nguy cơ XSS trên giao diện hiện tại là **KHÔNG THỂ THỰC THI (Non-exploitable)**. Nếu trong tương lai có nhu cầu render bài viết dạng Rich Text (HTML WYSIWYG), lúc đó mới bắt buộc bổ sung `sanitize-html` ở backend và `DOMPurify` ở frontend.

---

## 21. PHÁT HIỆN VỀ MINIO OBJECT STORAGE

- **Cấu hình Bucket:** Hai bucket `product-images` và `content-images` được khởi tạo tự động bởi container `phanbonshop_minio_init` với quyền `anonymous set download` (public read).
- **Rác bộ nhớ (Orphan Objects):** Khi xóa sản phẩm hoặc bài viết, hệ thống chỉ xóa metadata trong database, không phát lệnh xóa file trên MinIO, dẫn đến rác dung lượng lưu trữ lâu dài.

---

## 22. PHÁT HIỆN VỀ TẢI TẬP TIN (FILE UPLOAD)

- Controller upload kiểm tra dung lượng tối đa (5MB ảnh sản phẩm, 10MB tài liệu) và kiểm tra header `Content-Type` (`image/jpeg`, `image/png`, `image/webp`).
- **Phân loại rủi ro chính xác:**
  - MinIO là kho lưu trữ đối tượng tĩnh (Static Object Storage), không có môi trường thực thi kịch bản (không có PHP runtime hay NodeJS runtime). Do đó, việc upload file `.php` không tạo thành lỗ hổng RCE (Remote Code Execution).
  - Rủi ro thực tế là: **File Spoofing** (người dùng tải file rác giả mạo đuôi ảnh) hoặc **XSS-capable format** (nếu cho phép file SVG chứa mã javascript độc hại).
  - Khuyến nghị: Cần bổ sung kiểm tra magic bytes của ảnh và chặn hoàn toàn định dạng `.svg`.

---

## 23. HIỆN TRẠNG HẠ TẦNG REDIS (REDIS AUDIT)

- **Phân loại:** `P3 - Architecture / Operations Gap`.
- **Release Blocker:** `NO`.
- **Production Blocker:** `NO`.
- **Local Development Blocker:** `NO`.
- **Bằng chứng:** Toàn bộ 14 workspaces không có dependency `ioredis` hay `redis`. Không có tính năng nào trong code bị lỗi vì thiếu Redis (do code hiện tại dùng MySQL và in-memory).
- **Khuyến nghị:** Trong môi trường local development, có thể tạm tắt container Redis để giảm tiêu hao tài nguyên máy tính. Ở giai đoạn tối ưu hóa sản xuất, sẽ tích hợp Redis cho Rate Limiting phân tán và Caching danh mục sản phẩm.

---

## 24. ĐỐI CHIẾU GIAO DIỆN FRONTEND & BACKEND

### Bảng Đối Chiếu Tuyến Đường Giao Diện:

| Tuyến đường (Route) | Mục đích | Giao diện (UI) | Kết nối API thật | Đánh giá chức năng |
| :--- | :--- | :---: | :---: | :--- |
| `/` | Trang chủ nông nghiệp | ✅ Có | ✅ `/categories`, `/products`, `/banners` | Hoạt động tốt |
| `/san-pham` | Danh sách phân bón | ✅ Có | ✅ `/products` | Hoạt động tốt |
| `/san-pham/[slug]` | Chi tiết phân bón | ✅ Có | ✅ `/products/slug/{slug}` | Hoạt động tốt |
| `/danh-muc/[slug]` | Sản phẩm theo danh mục| ✅ Có | ✅ `/products?categoryId=...` | Hoạt động tốt |
| `/kien-thuc` | Kỹ thuật canh tác | ✅ Có | ✅ `/articles` | Hoạt động tốt |
| `/dang-nhap` | Đăng nhập | ✅ Có | ✅ `/api/v1/auth/login` | Hoạt động tốt |
| `/dang-ky` | Đăng ký | ✅ Có | ✅ `/api/v1/auth/register` | Hoạt động tốt |
| Giỏ hàng (Cart Drawer) | Xem giỏ hàng | ✅ Có | ✅ LocalStorage + Context | Hoạt động |
| **`/checkout` (Thanh toán)**| **Đặt hàng & Trả tiền** | 🔴 **KHÔNG** | 🔴 **CHƯA GỌI SAGA CHECKOUT** | **RELEASE BLOCKER** |
| `/tai-khoan/don-hang` | Lịch sử đơn hàng | ✅ Có | ✅ `/api/v1/orders/my-orders` | Hoạt động |
| `/tai-khoan/dia-chi` | Quản lý địa chỉ | ✅ Có | ✅ `/api/v1/customers/addresses` | Hoạt động |
| `/admin/*` (7 trang) | Quản trị hệ thống | ✅ Có | ✅ `/api/v1/*` qua JWT Admin | Hoạt động |

---

## 25. BẢO MẬT FRONTEND (FRONTEND SECURITY)

- **Lưu trữ Token:** Lưu trữ phiên làm việc qua cookie `httpOnly` thông qua API Route Handler của Next.js (`apps/frontend/src/app/api/auth/session/route.ts`). Không lưu Access Token trong LocalStorage, phòng chống hiệu quả tấn công đánh cắp token qua XSS.
- **Phân quyền Route:** Middleware `apps/frontend/src/middleware.ts` kiểm tra cookie và role để chặn truy cập trái phép vào `/admin/*`.

---

## 26. BIẾN MÔI TRƯỜNG & CẤU HÌNH (CONFIGURATION)

- Module `database.module.ts` đã khắc phục sự không nhất quán giữa `SERVICE_DATABASE_URL` và `DATABASE_URL` bằng cơ chế fallback an toàn.
- File `.env.example` cung cấp đầy đủ thông số cho cả 6 database, secrets và external URLs. Cần bắt buộc thay đổi mật khẩu mặc định khi triển khai production.

---

## 27. BẢO MẬT HỆ THỐNG (SECURITY REVIEW)

- Không phát hiện private key hay production secret thật bị commit vào git.
- SQL Injection được phòng ngừa bởi Prisma ORM parameterized và tagged template raw query.
- CORS whitelist được cấu hình an toàn trên API Gateway.

---

## 28. THIẾT KẾ HEALTH CHECK: TÁCH BIỆT LIVENESS & READINESS

> **ĐIỀU CHỈNH THIẾT KẾ QUAN TRỌNG:** Không được làm `/health` (Liveness) và `/ready` (Readiness) giống nhau.

### Yêu cầu kiến trúc chuẩn:
1. **Liveness Probe (`/health`):**
   - Mục đích: Xác nhận tiến trình Node.js còn sống, Event Loop không bị deadlock.
   - Hành vi: Trả về HTTP 200 `{ status: 'alive' }`.
   - **Tuyệt đối KHÔNG kiểm tra Database ở Liveness.** Nếu Database bị mất kết nối tạm thời hoặc quá tải, Liveness fail sẽ khiến container orchestrator (Docker/K8s) liên tục khởi động lại container, gây ra vòng lặp restart bão hòa (Cascading Restart Loop).
2. **Readiness Probe (`/ready`):**
   - Mục đích: Xác nhận container đã sẵn sàng nhận lưu lượng truy cập (Traffic Routing).
   - Hành vi: Kiểm tra kết nối tới MySQL (`SELECT 1`), MinIO (nếu có).
   - Nếu Database mất kết nối: Trả về HTTP 503 `{ status: 'not_ready', database: 'down' }`.
   - Kết quả: Reverse proxy hoặc Load Balancer tạm thời ngắt điều hướng traffic tới container này cho đến khi DB phục hồi, mà không restart tiến trình.

---

## 29. CÔNG CỤ SAO LƯU & KHÔI PHỤC DỮ LIỆU (BACKUP & DR TOOLING)

- **Trạng thái trong Repository:** `Tooling Absent in Repository`.
  - Không có file script nào trong `scripts/` hay `docker/` hỗ trợ tự động chạy `mysqldump` hoặc backup MinIO volume.
- **Trạng thái ngoài hạ tầng (External Infrastructure):** `UNVERIFIED`. Không thể loại trừ khả năng server host có snapshot cấp ổ đĩa từ bên ngoài.
- **Phân loại:**
  - Severity: `P1 - High`
  - Release Blocker: `NO` (vẫn release tính năng được)
  - Production Blocker: `YES` (vận hành thương mại bắt buộc phải có backup)
  - Local Development Blocker: `NO`

---

## 30. KIỂM TOÁN CI/CD

- **CI Workflow (`.github/workflows/ci.yml`):** File cấu hình tồn tại với đầy đủ các bước lint, typecheck, prisma validate, test và build backend.
- **CD (Continuous Deployment):** `Not Implemented`. Không có workflow tự động deploy lên staging hay production.

---

## 31. THIẾT KẾ CRON WORKER ĐA BẢN SAO (MULTI-REPLICA SAFE CRON DESIGN)

Khi triển khai nhiều bản sao (ví dụ: 2 container `order-service`, 2 container `inventory-service`):
- NestJS `@Cron()` thông thường sẽ kích hoạt độc lập trên mọi container cùng một thời điểm, dẫn đến xung đột khi xử lý `compensation_tasks` hoặc quét dọn `inventory_reservations`.
- **Yêu cầu thiết kế:**
  - **Môi trường Local / Single Replica:** Có thể dùng NestJS Scheduler `@Cron` trực tiếp.
  - **Môi trường Production / Multi-Replica:** Bắt buộc áp dụng cơ chế điều phối an toàn:
    1. Cơ chế Atomic Claiming với câu lệnh SQL:
       ```sql
       UPDATE compensation_tasks 
       SET status = 'PROCESSING', locked_by = :workerId, locked_at = NOW() 
       WHERE status = 'PENDING' AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL 2 MINUTE)
       LIMIT 10;
       ```
    2. Hoặc sử dụng MySQL Advisory Lock `SELECT GET_LOCK('compensation_worker_lock', 5)`.
    3. Hoặc sử dụng Queue Worker phân tán (BullMQ với Redis).

---

## 32. TÍNH KHẢ THI SCALE & PERFORMANCE

- Cần bổ sung giới hạn chặn trên `take: Math.min(limit, 100)` tại các endpoint `findMany` danh sách sản phẩm để chống tấn công cạn kiệt RAM Node.js khi client gửi `limit=100000`.

---

## 33. MA TRẬN SẴN SÀNG VẬN HÀNH (PRODUCTION READINESS MATRIX)

Phân định rõ ràng giữa cú pháp cấu hình, khả năng build và khả năng sẵn sàng sản xuất:

| Khu vực đánh giá | Cú pháp cấu hình | Khả năng Build | Trạng thái Runtime | Đánh giá chung | Release Blocker? | Production Blocker? | Local Dev Blocker? |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Kiến trúc (Architecture)** | ✅ Chuẩn | ✅ Pass | 🟡 Đồng bộ HTTP | 🟡 Partial | Không | Không | Không |
| **Cơ sở dữ liệu (Database)** | ✅ Chuẩn | ✅ Pass | ✅ Migrated | ✅ Ready | Không | Không | Không |
| **Xác thực (Auth)** | ✅ Chuẩn | ✅ Pass | ✅ Active | 🟡 Partial (Thiếu reuse batch revoke) | Không | Không | Không |
| **Phân quyền (RBAC)** | ✅ Chuẩn | ✅ Pass | ✅ Active | ✅ Ready | Không | Không | Không |
| **Luồng Checkout** | ✅ Chuẩn | ✅ Pass | 🔴 Thiếu UI | 🔴 Incomplete | **CÓ** | **CÓ** | Không |
| **Giữ chỗ tồn kho (Inventory)**| ✅ Chuẩn | ✅ Pass | 🟡 Thiếu Worker| 🟡 Partial | Không | **CÓ** | Không |
| **Thanh toán (Payment)** | 🟡 Sơ khai | ✅ Pass | 🔴 Chưa có Gateway | 🔴 Incomplete | **CÓ** | **CÓ** | Không |
| **Giao diện Web (Frontend)** | ✅ Chuẩn | 🟡 Build stall local | ✅ Active | 🔴 Thiếu Checkout UI | **CÓ** | **CÓ** | Không |
| **Kiểm thử tự động (Testing)** | ✅ Chuẩn | ✅ Pass | 🔴 0% service test | 🔴 Coverage Gap | **CÓ** | **CÓ** | Không |
| **Docker Development** | ✅ Valid | ✅ Multi-stage | ✅ Healthy | ✅ Ready | Không | Không | Không |
| **Cấu hình Nginx & TLS** | 🟡 Thiếu 443 | ✅ Pass | 🟡 Port 80 only | 🔴 Production Blocker | **CÓ** | **CÓ** | **KHÔNG** |
| **Sao lưu (Backup & DR)** | 🔴 Thiếu script| N/A | ❓ Unverified | 🔴 Tooling Absent | Không | **CÓ** | Không |
| **Hạ tầng Redis** | ✅ Valid | ✅ Image ready| ⚪ Code chưa dùng| ⚪ Infra Only | Không | Không | Không |
| **Health Check** | ✅ Valid | ✅ Pass | 🟡 Shallow | 🟡 Cần tách Liveness/Readiness | Không | Không | Không |

---

## 34. SỔ ĐĂNG KÝ PHÁT HIỆN TOÀN DIỆN (FINDINGS REGISTER)

### [FINDINGS CÓ TÍNH CHẤT RELEASE BLOCKER]

#### `AUD-P1-001`: Giỏ hàng Frontend không có sự kiện đặt hàng & thiếu trang Checkout
- **Severity:** P1 - High *(Tính năng cốt lõi chưa hoàn thiện, không phải sự cố sập hệ thống)*
- **Release Blocker:** **YES**
- **Production Blocker:** **YES**
- **Local Development Blocker:** **NO**
- **Area:** Frontend / Checkout
- **Status:** CONFIRMED
- **File:** `apps/frontend/src/components/customer/cart-drawer.tsx` (dòng 138-144)
- **Evidence:** Nút bấm "Tiến hành đặt hàng" không có `onClick`, không có router link. Trong `apps/frontend/src/app` không có trang `/checkout`.
- **Problem:** Khách hàng không thể tạo đơn hàng từ giao diện website.
- **Impact:** Nền tảng thương mại điện tử không thể thực hiện giao dịch từ người dùng cuối.
- **Recommended Action:** Xây dựng trang `apps/frontend/src/app/(customer)/checkout/page.tsx`, form nhập địa chỉ giao hàng, chọn phương thức thanh toán, gọi API `POST /api/v1/checkout` kèm `Idempotency-Key`.

#### `AUD-P1-002`: Cấu hình Nginx Production mở cổng 443 nhưng không cấu hình SSL
- **Severity:** P1 - High
- **Release Blocker:** **YES**
- **Production Blocker:** **YES**
- **Local Development Blocker:** **NO** *(Local chạy HTTP port 80 bình thường)*
- **Area:** Infrastructure / TLS
- **Status:** CONFIRMED
- **File:** `docker-compose.prod.yml` (dòng 23) và `docker/nginx/conf.d/default.conf`
- **Evidence:** `docker-compose.prod.yml` map `443:443`, nhưng `default.conf` chỉ có `listen 80;`. Thư mục `certs/` chỉ có `.gitkeep`.
- **Problem:** Truy cập HTTPS trên production bị từ chối kết nối.
- **Impact:** Không thể triển khai an toàn trên domain production có chứng chỉ SSL.
- **Recommended Action:** Thêm khối `server { listen 443 ssl; ... }` trong Nginx và cấu hình chứng chỉ SSL Let's Encrypt / Certbot.

#### `AUD-P1-003`: Khiếm khuyết thiết kế vòng đời giữ chỗ kho khi thanh toán Online (Online Payment Gap)
- **Severity:** P1 - High
- **Release Blocker:** **YES** *(Đối với thanh toán Online)*
- **Production Blocker:** **YES**
- **Local Development Blocker:** **NO**
- **Area:** Checkout / Inventory Lifecycle
- **Status:** CONFIRMED
- **File:** `services/order-service/src/checkout/checkout.service.ts` và `services/order-service/src/orders/orders.service.ts`
- **Evidence:** Reservation tạo với TTL 15 phút, nhưng hàm commit kho chỉ gọi ở trạng thái `COMPLETED` khi giao hàng thành công. Chưa có vòng đời giữ chỗ dành riêng cho việc chờ thanh toán online MoMo/VNPay.
- **Problem:** Nếu khách thanh toán online quá 15 phút, reservation bị hết hạn và hoàn kho; nếu khách bỏ dở cổng thanh toán, không có cơ chế tự động hủy đơn và nhả kho tức thì.
- **Impact:** Nguy cơ bán vượt tồn kho hoặc treo tồn kho sai lệch.
- **Recommended Action:** Tái cấu trúc vòng đời đơn hàng và reservation: Hỗ trợ trạng thái `PENDING_PAYMENT`, gắn webhook IPN để commit kho khi thanh toán thành công, và hủy reservation ngay khi thanh toán thất bại hoặc quá hạn.

#### `AUD-P1-004`: Tiến trình bồi hoàn Saga (Compensation Tasks) thiếu Worker tự động
- **Severity:** P1 - High
- **Release Blocker:** **YES**
- **Production Blocker:** **YES**
- **Local Development Blocker:** **NO**
- **Area:** Order / Saga
- **Status:** CONFIRMED
- **File:** `services/order-service/src/checkout/checkout.service.ts` dòng 280
- **Evidence:** Bản ghi bồi hoàn được ghi vào bảng `compensation_tasks` trạng thái `PENDING`, nhưng không có tiến trình nền nào tự động gọi endpoint xử lý.
- **Problem:** Khi gặp lỗi mạng lúc checkout, tồn kho giữ chỗ bị treo vĩnh viễn nếu không có can thiệp thủ công.
- **Recommended Action:** Viết Worker định kỳ xử lý compensation tasks, áp dụng atomic claim an toàn khi chạy multi-replica.

#### `AUD-P1-005`: Giữ chỗ tồn kho quá hạn (Reservation TTL) thiếu Scheduler dọn dẹp
- **Severity:** P1 - High
- **Release Blocker:** **YES**
- **Production Blocker:** **YES**
- **Local Development Blocker:** **NO**
- **Area:** Inventory
- **Status:** CONFIRMED
- **File:** `services/inventory-service/src/inventory/inventory.controller.ts` dòng 92
- **Evidence:** Endpoint `/cleanup-expired` tồn tại nhưng không có scheduler tự động chạy.
- **Recommended Action:** Thêm Cron Scheduler tự động kích hoạt dọn dẹp các reservation quá hạn mỗi 5 phút.

#### `AUD-P1-006`: Kiểm thử tự động chưa kiểm thử mã nguồn thực tế của dịch vụ (Test Coverage Gap)
- **Severity:** P1 - High
- **Release Blocker:** **YES**
- **Production Blocker:** **YES**
- **Local Development Blocker:** **NO**
- **Area:** Testing
- **Status:** CONFIRMED
- **File:** `services/order-service/test/order.unit.test.mjs` và `services/inventory-service/test/inventory.unit.test.mjs`
- **Evidence:** File test tự định nghĩa lại hàm độc lập, không import code thực tế từ `src/`. 0% logic NestJS Service và Prisma được bảo vệ bởi test.
- **Recommended Action:** Viết characterization unit & integration tests trực tiếp cho NestJS Services trước khi tiến hành sửa code.

---

### [FINDINGS VẬN HÀNH & HẠ TẦNG]

#### `AUD-P1-007`: Thiếu hoàn toàn công cụ Sao lưu & Khôi phục dữ liệu trong Repository
- **Severity:** P1 - High
- **Release Blocker:** **NO**
- **Production Blocker:** **YES**
- **Local Development Blocker:** **NO**
- **Area:** Operations / Backup
- **Status:** Tooling Absent in Repository *(External backup: UNVERIFIED)*
- **File:** `docker/mysql/` và `scripts/`
- **Evidence:** Không có script sao lưu `mysqldump` tự động trong repository.
- **Recommended Action:** Xây dựng script `scripts/backup-databases.sh` tự động dump 6 logical DBs và script khôi phục thử nghiệm.

#### `AUD-P2-001`: Health Check chưa phân tách Liveness và Readiness
- **Severity:** P2 - Medium
- **Release Blocker:** **NO**
- **Production Blocker:** **YES**
- **Local Development Blocker:** **NO**
- **Area:** Observability
- **Status:** CONFIRMED
- **File:** `services/*/src/health/`
- **Evidence:** Endpoint `/health` trả về ngay `{ status: 'ok' }` mà không có endpoint `/ready` kiểm tra dependencies.
- **Recommended Action:** Tách bạch `/health` (Liveness - chỉ kiểm tra process) và `/ready` (Readiness - ping MySQL).

#### `AUD-P2-002`: Sitemap Frontend bị nghẽn khi chạy `npm run build` ngoài Docker
- **Severity:** P2 - Medium
- **Release Blocker:** **NO**
- **Production Blocker:** **NO**
- **Local Development Blocker:** **YES** *(Gây nghẽn build trên host local)*
- **Area:** Frontend / Build
- **Status:** CONFIRMED
- **File:** `apps/frontend/src/app/sitemap.ts` (dòng 55-60)
- **Evidence:** Lệnh fetch tới `http://gateway:8080` không có timeout, dẫn đến treo build khi domain gateway không phân giải được trên máy host local.
- **Recommended Action:** Thêm `signal: AbortSignal.timeout(2000)` cho các lệnh fetch trong sitemap.

#### `AUD-P2-003`: Không thu hồi Token Family khi phát hiện Refresh Token Reuse
- **Severity:** P2 - Medium
- **Release Blocker:** **NO**
- **Production Blocker:** **NO**
- **Local Development Blocker:** **NO**
- **Area:** Security / Auth
- **Status:** CONFIRMED
- **File:** `services/auth-service/src/auth/auth.service.ts` (dòng 162)
- **Evidence:** Khi phát hiện token reuse, service ném lỗi nhưng không batch update thu hồi các token còn lại của cùng user.
- **Recommended Action:** Thực hiện batch revoke toàn bộ refresh token của user khi phát hiện token reuse.

#### `AUD-P2-004`: File Upload thiếu kiểm tra Magic Bytes
- **Severity:** P2 - Medium
- **Release Blocker:** **NO**
- **Production Blocker:** **NO**
- **Local Development Blocker:** **NO**
- **Area:** Security / Upload
- **Status:** CONFIRMED
- **File:** `services/product-service/src/upload/upload.service.ts`
- **Evidence:** Chỉ kiểm tra header Content-Type và dung lượng, không đọc byte header thực tế của tập tin. MinIO lưu trữ tĩnh không gây RCE nhưng có nguy cơ spoofing hoặc SVG XSS.
- **Recommended Action:** Dùng `file-type` kiểm tra magic bytes và chặn định dạng `.svg`.

#### `AUD-P2-005`: Rác dung lượng MinIO khi xóa ảnh sản phẩm / bài viết
- **Severity:** P2 - Medium
- **Release Blocker:** **NO**
- **Production Blocker:** **NO**
- **Local Development Blocker:** **NO**
- **Area:** Storage
- **Status:** CONFIRMED
- **File:** `services/product-service/src/products/products.service.ts`
- **Evidence:** Xóa bản ghi database nhưng không gọi lệnh xóa object trên MinIO S3.
- **Recommended Action:** Bổ sung hook xóa object MinIO tương ứng khi bản ghi bị xóa.

#### `AUD-P3-001`: Redis Container chạy nhưng mã nguồn không kết nối (Infrastructure Only)
- **Severity:** P3 - Low *(Hạ từ P1 vì không gây lỗi chức năng hiện tại)*
- **Release Blocker:** **NO**
- **Production Blocker:** **NO**
- **Local Development Blocker:** **NO**
- **Area:** Architecture / Optimization
- **Status:** CONFIRMED (Infrastructure Only)
- **File:** `docker-compose.yml` và toàn bộ `package.json`
- **Evidence:** Redis container chạy nhưng 0 service nào cài đặt `ioredis` hay kết nối tới.
- **Recommended Action:** Tùy chọn tạm tắt container ở môi trường local để tiết kiệm RAM, và tích hợp caching ở giai đoạn tối ưu hóa sản xuất sau.

#### `AUD-P3-002`: Tiềm năng Stored XSS trong nội dung bài viết kỹ thuật
- **Severity:** P3 - Low *(Hạ từ P2 vì frontend hiện render dạng plain text an toàn)*
- **Release Blocker:** **NO**
- **Production Blocker:** **NO**
- **Local Development Blocker:** **NO**
- **Area:** Security / Content
- **Status:** Potential Stored XSS / Currently Safe on Frontend
- **File:** `apps/frontend/src/app/(customer)/kien-thuc/[slug]/page.tsx` (dòng 219)
- **Evidence:** Backend lưu raw HTML nhưng frontend render qua `{post.content}` (được React tự động escape, không dùng `dangerouslySetInnerHTML`).
- **Recommended Action:** Chỉ cần làm sạch nội dung bằng `sanitize-html` nếu trong tương lai frontend chuyển sang dùng bộ soạn thảo Rich Text (HTML WYSIWYG).

---

## 35. PHÂN TÍCH 10 KỊCH BẢN THẤT BẠI (FAILURE MODE ANALYSIS)

| Kịch bản sự cố | Hành vi mong đợi | Hành vi hệ thống hiện tại | Mức độ rủi ro | Giải pháp cần bổ sung |
| :--- | :--- | :--- | :---: | :--- |
| **1. MySQL sập giữa chừng khi checkout** | Rollback transaction, hủy giữ chỗ kho, thông báo lỗi khách | Transaction DB fail, order không tạo; nếu reserve kho đã xong thì cần release kho | Cao | Bọc toàn bộ trong Saga bồi hoàn có worker tự động |
| **2. Inventory Service chết hoàn toàn** | Checkout dừng ngay ở bước reserve, báo hết hàng/lỗi | Order-service ném lỗi `503 Service Unavailable`, đơn không được tạo | Trung bình | Bổ sung Circuit Breaker ngắt request tức thì |
| **3. Order Service sập sau khi đã Reserve kho** | Kho tự giải phóng khi hết hạn hoặc khi Order sống lại | Bản ghi `compensation_tasks` được tạo nhưng không ai xử lý | **Cao** | Bắt buộc phải có Background Compensation Worker |
| **4. Product Service bị timeout** | Dừng checkout, báo khách thử lại sau | Axios timeout 5s, đơn bị hủy an toàn | Thấp | Tốt, cơ chế tính giá độc lập bảo vệ an toàn |
| **5. Customer Service bị timeout** | Không xác minh được địa chỉ, dừng đơn an toàn | Ném lỗi 500/503, không tạo đơn rác | Thấp | Tốt |
| **6. MinIO sập** | Ảnh hiển thị fallback, không chặn luồng mua hàng | Trang web hiển thị icon placeholder `🌱`, mua hàng vẫn hoạt động | Thấp | Tốt, frontend đã có fallback ảnh |
| **7. Redis sập** | Không ảnh hưởng vì hiện tại code chưa dùng Redis | Hệ thống chạy bình thường | Không | Không ảnh hưởng |
| **8. API Gateway sập** | Nginx trả về lỗi 502 Bad Gateway | Nginx trả về 502, website frontend vẫn xem được trang tĩnh | Cao | Cần cấu hình Gateway multi-replica |
| **9. Mất mạng sau khi khách ấn Checkout** | Đơn được tạo nếu đã tới backend, khách xem được trong Lịch sử | Đơn được tạo thành công, khách vào lại thấy đơn `PENDING` | Thấp | Tốt |
| **10. Khách click đúp nút Checkout** | Chỉ tạo duy nhất 1 đơn hàng | `Idempotency-Key` chặn request thứ hai với lỗi 409 Conflict | Thấp | Tốt, Idempotency DB hoạt động hiệu quả |

---

## 36. LỆCH PHA GIỮA TÀI LIỆU VÀ MÃ NGUỒN (DOCUMENTATION DRIFT)

| Tuyên bố trong Tài liệu / README cũ | Thực tế trong Mã nguồn (Source Truth) | Đánh giá sai lệch |
| :--- | :--- | :---: |
| "Đã tích hợp cổng thanh toán MoMo Sandbox" | Hoàn toàn không có code MoMo; chỉ có chữ `MOMO` trong enum | 🔴 **SAI SỰ THẬT** |
| "Đã cấu hình Redis Caching tăng tốc API" | Không có dòng code nào kết nối Redis trong cả 14 workspaces | 🔴 **SAI SỰ THẬT** |
| "Bộ kiểm thử tự động toàn diện bảo vệ hệ thống" | Chỉ có 15 tests đơn giản; 0% test gọi vào NestJS Service thật | 🔴 **SAI SỰ THẬT** |
| "Hệ thống sẵn sàng vận hành sản xuất (Production Ready)" | Thiếu cổng 443 SSL, thiếu backup, frontend không có trang checkout | 🔴 **SAI SỰ THẬT** |
| "Bảo hiểm giao dịch phân tán tự động hoàn tiền/kho" | `compensation_tasks` có ghi nhận nhưng thiếu worker tự động chạy | 🟡 **THIẾU SÓT** |

---

## 37. THỨ TỰ KHẮC PHỤC KHUYẾN NGHỊ (RECOMMENDED REMEDIATION ORDER)

Xem chi tiết kế hoạch thực hiện từng bước tại: [REMEDIATION_PLAN.md](file:///d:/tool/phanbonshop/docs/REMEDIATION_PLAN.md).
