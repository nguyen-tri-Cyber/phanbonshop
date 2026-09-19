# DỰ ÁN PHÂN BÓN SHOP (PHANBONSHOP) - TÀI LIỆU TRẠNG THÁI TOÀN DIỆN (PROJECT STATUS)

> **Dự án**: Sàn thương mại điện tử chuyên ngành Phân bón Nông nghiệp Việt Nam  
> **Kiến trúc**: Microservices Monorepo (Node.js 20+, NestJS 10, Next.js 14 App Router, Prisma ORM, MySQL 8, Redis 7, MinIO S3)  
> **Trạng thái**: Hoàn tất toàn bộ các giai đoạn phát triển, hardening bảo mật, kiểm thử concurrency/saga/idempotency và hoàn thiện tài liệu.

---

## 1. TỔNG QUAN KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE)

```
                       [ Trình duyệt Khách hàng & Quản trị viên ]
                                         │
                    ┌────────────────────┴────────────────────┐
                    │                                         │
                    ▼                                         ▼
         [ Frontend Next.js 14 ]                   [ API Gateway NestJS ]
             (Port: 3000)                              (Port: 8080)
                                                              │
               ┌──────────────────────────────────────────────┼──────────────────────────────┐
               │                                              │                              │
               ▼                                              ▼                              ▼
      [ auth-service ]                              [ product-service ]            [ order-service ]
        (Port: 3001)                                  (Port: 3002)                   (Port: 3003)
             │                                              │                              │
             ▼                                              ▼                              ▼
         (auth_db)                                     (product_db)                   (order_db)
               │                                              │                              │
               ├──────────────────────────────────────────────┼──────────────────────────────┤
               │                                              │                              │
               ▼                                              ▼                              ▼
    [ inventory-service ]                         [ customer-service ]           [ content-service ]
        (Port: 3004)                                  (Port: 3005)                   (Port: 4006)
             │                                              │                              │
             ▼                                              ▼                              ▼
       (inventory_db)                                 (customer_db)                  (content_db)
               │                                              │                              │
               └──────────────────────┬───────────────────────┴──────────────────────────────┘
                                      │
                      ┌───────────────┴───────────────┐
                      │                               │
                      ▼                               ▼
                 [ Redis 7 ]                  [ MinIO Object Storage ]
                (Port: 6379)                     (Port: 9000/9001)
```

---

## 2. DANH SÁCH DỊCH VỤ, CỔNG & CƠ SỞ DỮ LIỆU (SERVICES & PORTS)

| Dịch vụ / Ứng dụng | Cổng (Port) | Cơ sở dữ liệu | Mục đích / Chức năng chính |
| :--- | :--- | :--- | :--- |
| **API Gateway** | `8080` | - | Đơn điểm truy cập, phân phối request, gán `x-request-id`, Rate Limiting, Proxy |
| **Storefront & Admin Web** | `3000` | - | Ứng dụng Next.js 14 App Router, Server Components, SEO JSON-LD, Admin UI |
| **auth-service** | `3001` | `auth_db` | Đăng ký, đăng nhập, JWT Access/Refresh Token, Token Rotation, Logout-All |
| **product-service** | `3002` | `product_db` | Danh mục, thương hiệu, sản phẩm, biến thể (SKU), ảnh MinIO, đánh giá (Reviews) |
| **order-service** | `3003` | `order_db` | Giỏ hàng, Checkout Saga, Quản lý đơn hàng, Thanh toán COD/Chuyển khoản, Coupons |
| **inventory-service** | `3004` | `inventory_db` | Quản lý kho, Tạm giữ chống Oversell (`FOR UPDATE`), Sổ cái biến động kho |
| **customer-service** | `3005` | `customer_db` | Hồ sơ khách hàng, sổ địa chỉ nhận hàng, dữ liệu hành chính Tỉnh/Huyện/Xã VN |
| **content-service** | `4006` | `content_db` | Bài viết kiến thức nông nghiệp (Blog), Banner quảng cáo, nội dung tĩnh |
| **MySQL 8.0** | `3307` | 6 Logical DBs | Lưu trữ dữ liệu quan hệ ACID biệt lập theo Service Mesh |
| **Redis 7.0** | `6379` | DB 0..5 | Cache dữ liệu, Rate Limiting, Session Blacklist, Phân tán Lock |
| **MinIO Storage** | `9000` / `9001` | S3 Buckets | Lưu trữ ảnh sản phẩm (`product-images`), ảnh bài viết & banner (`content-images`) |

---

## 3. BIẾN MÔI TRƯỜNG & HẠ TẦNG (ENVIRONMENT & INFRASTRUCTURE)

File cấu hình chung đặt tại thư mục gốc `.env` (mẫu tại `.env.example`):

```bash
# Cổng ứng dụng
PORT_API_GATEWAY=8080
PORT_FRONTEND=3000

# Cơ sở dữ liệu (MySQL 8)
AUTH_DATABASE_URL=mysql://phanbon_user:phanbon_secret@localhost:3307/auth_db
PRODUCT_DATABASE_URL=mysql://phanbon_user:phanbon_secret@localhost:3307/product_db
ORDER_DATABASE_URL=mysql://phanbon_user:phanbon_secret@localhost:3307/order_db
INVENTORY_DATABASE_URL=mysql://phanbon_user:phanbon_secret@localhost:3307/inventory_db
CUSTOMER_DATABASE_URL=mysql://phanbon_user:phanbon_secret@localhost:3307/customer_db
CONTENT_DATABASE_URL=mysql://phanbon_user:phanbon_secret@localhost:3307/content_db

# Redis 7
REDIS_URL=redis://:redis_secret@localhost:6379

# MinIO Object Storage
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=admin123456
MINIO_BUCKET_PRODUCTS=product-images
MINIO_BUCKET_CONTENT=content-images

# Token & Service Mesh Secret
JWT_ACCESS_SECRET=your_jwt_access_secret_key_phanbonshop_32chars_min
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_phanbonshop_32chars_min
INTERNAL_SERVICE_SECRET=your_internal_service_mesh_shared_secret_2026
```

### Quản lý Hạ tầng Docker:
```bash
# Khởi động toàn bộ Database, Redis, MinIO
docker compose up -d

# Kiểm tra trạng thái sức khỏe
docker compose ps

# Tắt hạ tầng
docker compose down
```

---

## 4. QUY TRÌNH SETUP, MIGRATE & SEED DỮ LIỆU

### Cài đặt dependencies toàn monorepo:
```bash
npm install
```

### Đẩy schema Prisma vào từng database:
```bash
# Chạy đồng loạt hoặc trong từng service:
npm run prisma:generate --workspaces
npm run prisma:push --workspaces
```

### Nạp dữ liệu mồi khởi tạo (Seeding):
```bash
npm run seed --workspace=@phanbonshop/product-service
npm run seed --workspace=@phanbonshop/inventory-service
npm run seed --workspace=@phanbonshop/order-service
npm run seed --workspace=@phanbonshop/content-service
```

### Tài khoản mặc định hệ thống:
- **SUPER_ADMIN**: `admin@phanbonshop.vn` / `Admin@123456`
- **STAFF**: `staff@phanbonshop.vn` / `Admin@123456`
- **CUSTOMER**: `customer@phanbonshop.vn` / `Admin@123456`

---

## 5. LỆNH KIỂM CHUẨN BUILD & TEST (CI/CD READY)

Hệ thống đạt trạng thái 100% không lỗi trên toàn bộ các câu lệnh tiêu chuẩn:

```bash
# 1. Linting toàn workspace (0 errors, 0 warnings)
npm run lint

# 2. Typecheck chặt chẽ toàn workspace (0 errors)
npm run typecheck

# 3. Unit test toàn workspace (15/15 tests pass)
npm run test

# 4. Production Build toàn bộ 12 packages & services (Compiled 26 routes)
npm run build
```

---

## 6. TÀI LIỆU API & SWAGGER ENDPOINTS

Mỗi microservice hỗ trợ OpenAPI/Swagger tài liệu hóa chi tiết:
- **API Gateway (Hợp nhất)**: [http://localhost:8080/docs](http://localhost:8080/docs)
- **Auth Service**: [http://localhost:3001/docs](http://localhost:3001/docs)
- **Product Service**: [http://localhost:3002/docs](http://localhost:3002/docs)
- **Order Service**: [http://localhost:3003/docs](http://localhost:3003/docs)
- **Inventory Service**: [http://localhost:3004/docs](http://localhost:3004/docs)
- **Customer Service**: [http://localhost:3005/docs](http://localhost:3005/docs)
- **Content Service**: [http://localhost:4006/docs](http://localhost:4006/docs)

---

## 7. CƠ CHẾ NGHIỆP VỤ CỐT LÕI (CORE BUSINESS FLOWS)

### 7.1. Chu trình Xác thực & Phân quyền (Auth & Security)
- **Access Token**: JWT hạn ngắn (15-60 phút), chứa `userId`, `email`, `role`.
- **Refresh Token Rotation**: Mỗi lần refresh, token cũ bị thu hồi ngay lập tức và cấp 1 cặp token mới.
- **Phát hiện tái sử dụng Token (Token Reuse Detection)**: Nếu phát hiện token cũ đã bị rotate được gửi lại, hệ thống lập tức thu hồi toàn bộ token family của user đó để ngăn chặn rò rỉ.
- **Role-Based Access Control (RBAC)**: Phân tầng 5 cấp vai trò: `CUSTOMER`, `STAFF`, `WAREHOUSE`, `MANAGER`, `ADMIN`, `SUPER_ADMIN`. Khách hàng gọi API nội bộ hoặc admin đều bị chặn với mã lỗi `403 Forbidden`.

### 7.2. Tồn kho & Cơ chế Chống Oversell (Inventory Anti-Oversell)
- Sử dụng **Khóa bi quan (Pessimistic Locking)** với câu lệnh MySQL:
  ```sql
  SELECT id, productId, variantId, stockQuantity, reservedQuantity, reorderLevel
  FROM inventory
  WHERE variantId = ?
  FOR UPDATE;
  ```
- **Tính toán khả dụng**: `availableQuantity = stockQuantity - reservedQuantity`.
- **Độc lập giao dịch**: Khóa hàng độc quyền ngăn chặn 2 giao dịch đồng thời tạm giữ vượt quá số lượng vật lý. Khi bắn 20 requests đồng thời chỉ còn 10 hàng, chính xác 10 requests thành công, 10 requests thất bại với mã lỗi `409 Conflict`.
- **Idempotent Reservation/Release/Commit**: Cho phép gọi lại nhiều lần mà không trừ đúp hoặc cộng sai tồn kho.

### 7.3. Phối hợp Giao dịch Phân tán (Distributed Saga Checkout Orchestrator)
Quá trình Đặt hàng diễn ra qua các bước điều phối nghiêm ngặt:
1. **Kiểm tra Idempotency-Key**: Nếu có trùng lặp đang xử lý đồng thời, gom chung promise để trả về cùng 1 kết quả duy nhất. Nếu đã tạo xong trước đó, trả lại snapshot từ bảng `idempotency_records`.
2. **Thẩm định giá Server-side**: Bỏ qua toàn bộ giá client gửi (Price Tampering Protection). Lấy giá niêm yết trực tiếp từ `product_db`.
3. **Thẩm định Coupon Server-side**: Kiểm tra thời hạn, đơn tối thiểu, giới hạn lượt dùng, tính số tiền giảm giá chính xác.
4. **Saga Step 1 (Reserve)**: Tạm giữ tồn kho qua `inventory-service` với `referenceId = batchReservationId`.
5. **Saga Step 2 (Create Order)**: Lưu Order, OrderItems, ShippingAddress snapshot và tạo lịch sử đơn trong `order_db`.
6. **Saga Compensation (Bồi hoàn tự động)**: Nếu bước lưu đơn hàng database thất bại, hệ thống tự động gọi API `internal/v1/inventory/release` giải phóng hàng đã giữ, không để tồn kho bị treo.
7. **Saga Step 3 (Payment)**: Khởi tạo bản ghi thanh toán `PENDING` theo phương thức (COD hoặc BANK_TRANSFER).

### 7.4. Thanh toán COD & Chuyển khoản (Bank Transfer)
- **COD**: Đặt hàng tạo bản ghi Payment `PENDING`. Chỉ chuyển sang `PAID` khi giao hàng thành công (DELIVERED/COMPLETED).
- **BANK_TRANSFER**: 
  - Khách hàng nhận thông tin tài khoản ngân hàng chính thức, VietQR và nội dung chuyển khoản bắt buộc chứa mã đơn hàng (ví dụ: `DH-20260919-XXXXXX`).
  - Quản trị viên đối soát sao kê ngân hàng và xác nhận thủ công qua `POST /api/v1/payments/:id/confirm`.
  - Nghiệp vụ kiểm tra số tiền khớp với tổng đơn, cập nhật `PAID`, tự động chuyển đơn sang `CONFIRMED` và ghi sổ cái `audit_logs`.

### 7.5. Xác thực Đánh giá Đã Mua Hàng (Verified Purchase Review)
- Khi khách hàng gửi đánh giá (`POST /api/v1/reviews`), backend gọi API nội bộ sang `order-service` kiểm tra:
  1. Khách hàng có sở hữu đơn hàng hợp lệ không?
  2. Đơn hàng đó đã ở trạng thái `COMPLETED` chưa?
  3. Đơn hàng đó có thực sự chứa sản phẩm/biến thể đang đánh giá hay không?
- Chỉ khi thỏa mãn cả 3 điều kiện, backend mới tự động gán `verifiedPurchase = true`. Client gửi trường `verifiedPurchase` giả mạo sẽ bị Validation Pipe từ chối ngay lập tức.

---

## 8. SỔ CÁI AUDIT LOG & GIÁM SÁT (AUDIT LOGS & OBSERVABILITY)

- **AuditLog Model**: Tích hợp trên cả 4 database nghiệp vụ (`order_db`, `product_db`, `inventory_db`, `auth_db`).
- **Ghi nhận tự động**:
  - `PRICE_CHANGE`: Ghi nhận biến động giá niêm yết của biến thể sản phẩm.
  - `INVENTORY_ADJUST`: Ghi nhận điều chỉnh kho thủ công (bắt buộc lý do).
  - `ORDER_STATUS_CHANGE`: Ghi nhận mọi bước dịch chuyển trạng thái đơn hàng.
  - `PAYMENT_CONFIRM`: Ghi nhận người duyệt thanh toán, số tiền và mã biên lai ngân hàng.
- **Traceability (`x-request-id`)**: API Gateway sinh mã UUID cho mọi request và truyền qua HTTP header `x-request-id` đến toàn bộ microservices hạ tầng.
- **Masking Bảo mật**: Logger tự động ẩn mật khẩu, bearer token và thông tin nhạy cảm.

---

## 9. CÁC HẠN CHẾ & KHUYẾN NGHỊ TRIỂN KHAI PRODUCTION (PRODUCTION ROADMAP)

1. **Service Mesh & API Gateway**:
   - Hiện tại đang sử dụng NestJS Reverse Proxy Controller. Trong môi trường Kubernetes production, khuyến nghị triển khai **Traefik**, **Kong Gateway** hoặc **Envoy** để tối ưu hóa SSL offloading, Circuit Breaking và WebSockets.
2. **Cron Job Tự Động Quét Tồn Kho Quá Hạn (TTL Cleanup)**:
   - Đã có API `POST /internal/v1/inventory/cleanup-expired`. Cần cấu hình Kubernetes CronJob hoặc Redis BullMQ chạy định kỳ 5 phút/lần để thu hồi các lượt tạm giữ quá hạn (abandoned carts).
3. **Thanh toán Trực tuyến Nâng cao**:
   - Kiến trúc hiện tại sẵn sàng mở rộng module cổng thanh toán (VNPay, MoMo, ZaloPay, PayOS) thông qua adapter pattern trong `payments.service.ts`.
4. **Giám sát Phân tán (Distributed Tracing & Metrics)**:
   - Tích hợp **OpenTelemetry**, **Prometheus** và **Grafana** để theo dõi thời gian đáp ứng (latency), tỷ lệ lỗi và số lượng giao dịch theo thời gian thực.
