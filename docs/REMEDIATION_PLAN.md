# PHANBONSHOP — KẾ HOẠCH KHẮC PHỤC HỆ THỐNG (REMEDIATION PLAN)
*(Bản hiệu chỉnh toàn diện theo nguyên tắc kiểm thử trước - sửa code sau)*

> **Mục đích:** Thiết lập lộ trình kỹ thuật chuẩn xác để giải quyết triệt để tất cả các điểm nghẽn phát hành, khiếm khuyết thiết kế và rủi ro vận hành được phát hiện trong [FULL_SYSTEM_AUDIT.md](file:///d:/tool/phanbonshop/docs/FULL_SYSTEM_AUDIT.md).  
> **Nguyên tắc cốt lõi:**
> 1. **Testing First:** Xây dựng Harness Test mô phỏng hành vi hiện tại trước khi chạm vào mã nguồn core.
> 2. **Phân tách rạch ròi:** Sửa lỗi tính đúng đắn dữ liệu (Correctness) trước khi làm giao diện (UI) và tính năng mới (MoMo).
> 3. **An toàn đa bản sao (Multi-replica safe):** Mọi background worker đều phải được thiết kế an toàn chống chạy trùng lặp khi scale nhiều container.

---

## 1. ĐỒ THỊ PHỤ THUỘC SỬA LỖI (DEPENDENCY GRAPH)

```text
[PHASE 0: AUDIT & BUILD BASELINE]
  - Sửa timeout build sitemap Frontend
  - Xác thực toàn bộ npm run build & docker compose
         │
         ▼
[PHASE 1: CRITICAL TEST HARNESS (KIỂM THỬ TRƯỚC HẾT)]
  - Inventory Concurrency Integration Test (SELECT FOR UPDATE)
  - Checkout Saga Failure & Compensation Rollback Test
  - Idempotency Concurrency Test (10 concurrent requests)
  - Auth Refresh Token Rotation & Reuse Detection Test
         │
         ▼
[PHASE 2: CORE CORRECTNESS (TÍNH ĐÚNG ĐẮN CỐT LÕI)]
  - Compensation Task Worker (Idempotent & Safe Claiming)
  - Expired Reservation Cleanup Worker
  - Khắc phục vòng đời giữ chỗ kho (Align TTL & Commit)
         │
         ▼
[PHASE 3: FRONTEND CHECKOUT (GIAO DIỆN ĐẶT HÀNG)]
  - Xây dựng trang /checkout (Địa chỉ, Coupon, COD/VietQR)
  - Gắn sự kiện từ giỏ hàng & sinh Idempotency-Key
  - Xác thực lịch sử đơn hàng
         │
         ▼
[PHASE 4: SECURITY & DATA INTEGRITY]
  - Token Family Batch Revocation khi reuse
  - Upload Magic Bytes & chặn SVG
  - MinIO Object Lifecycle (Dọn dẹp ảnh mồ côi)
         │
         ▼
[PHASE 5: OPERATIONS & RELIABILITY]
  - Tách bạch Liveness (/health) và Readiness (/ready)
  - Script tự động sao lưu & khôi phục MySQL / MinIO
  - Quyết định hạ tầng Redis (Tích hợp hoặc tắt ở local)
         │
         ▼
[PHASE 6: PRODUCTION HARDENING]
  - Cấu hình Nginx Listen 443 SSL & Certbot
  - Quản lý Secret production & Production Smoke Tests
         │
         ▼
[PHASE 7: PAYMENT ARCHITECTURE (THIẾT KẾ NỀN TẢNG THANH TOÁN)]
  - PaymentTransaction Model & State Machine
  - Xử lý giữ chỗ kho khi thanh toán PENDING
  - Webhook Event & Idempotency Specification
         │
         ▼
[PHASE 8: MOMO SANDBOX (TÍCH HỢP CỔNG MOMO)]
  - Triển khai MoMo API & IPN Webhook Receiver
```

---

## 2. MA TRẬN ĐIỂM ƯU TIÊN (PRIORITY SCORING MATRIX)

Công thức tính mức độ ưu tiên:
$$\text{Priority Score} = \frac{\text{Impact (1-5)} \times \text{Likelihood (1-5)}}{\text{Effort (1-5)}}$$

| Mã Nhiệm Vụ | Mô tả tóm tắt | Impact | Likelihood | Effort | Priority Score | Giai đoạn thực hiện |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `TASK-P0-01` | Sửa Sitemap Timeout và ổn định Build Baseline | 4 | 5 | 1 | **20.0** | **Phase 0 — Build Baseline** |
| `TASK-P1-01` | Viết Test Concurrency Tồn kho (`FOR UPDATE`) | 5 | 5 | 2 | **12.5** | **Phase 1 — Test Harness** |
| `TASK-P1-02` | Viết Test Concurrency Idempotency (10 reqs) | 5 | 4 | 2 | **10.0** | **Phase 1 — Test Harness** |
| `TASK-P1-03` | Viết Test Bồi hoàn Saga Rollback khi lỗi | 5 | 4 | 2 | **10.0** | **Phase 1 — Test Harness** |
| `TASK-P2-01` | Xây dựng Worker xử lý `compensation_tasks` | 5 | 4 | 2 | **10.0** | **Phase 2 — Core Correctness** |
| `TASK-P2-02` | Xây dựng Worker dọn dẹp Reservation hết hạn | 4 | 4 | 1 | **16.0** | **Phase 2 — Core Correctness** |
| `TASK-P2-03` | Chuẩn hóa vòng đời giữ chỗ kho (Align TTL) | 5 | 4 | 2 | **10.0** | **Phase 2 — Core Correctness** |
| `TASK-P3-01` | Xây dựng trang Checkout Frontend & liên kết giỏ | 5 | 5 | 3 | **8.3** | **Phase 3 — Frontend Checkout** |
| `TASK-P4-01` | Thu hồi Token Family khi phát hiện Token Reuse | 4 | 2 | 1 | **8.0** | **Phase 4 — Security** |
| `TASK-P4-02` | Kiểm tra Magic Bytes upload ảnh & chặn SVG | 3 | 3 | 1 | **9.0** | **Phase 4 — Security** |
| `TASK-P5-01` | Tách biệt Liveness (`/health`) & Readiness (`/ready`) | 4 | 3 | 1 | **12.0** | **Phase 5 — Operations** |
| `TASK-P5-02` | Viết Script tự động sao lưu & khôi phục MySQL | 5 | 3 | 2 | **7.5** | **Phase 5 — Operations** |
| `TASK-P5-03` | Ra quyết định cấu hình Redis (Tắt ở local) | 2 | 4 | 1 | **8.0** | **Phase 5 — Operations** |
| `TASK-P6-01` | Cấu hình Nginx Listen 443 SSL cho Production | 5 | 4 | 2 | **10.0** | **Phase 6 — Production Hardening** |
| `TASK-P7-01` | Thiết kế kiến trúc nền tảng Payment & State | 5 | 4 | 3 | **6.7** | **Phase 7 — Payment Architecture** |
| `TASK-P8-01` | Tích hợp MoMo Sandbox & Webhook IPN | 4 | 4 | 3 | **5.3** | **Phase 8 — MoMo Sandbox** |

---

## 3. CHI TIẾT CÁC GIAI ĐOẠN TRIỂN KHAI (IMPLEMENTATION PHASES)

### GIAI ĐOẠN 0: XÁC LẬP BUILD BASELINE (AUDIT & BUILD BASELINE)

- **Mục tiêu:** Đảm bảo `npm run build` và `docker compose` thực thi trơn tru 100% trên máy phát triển cục bộ và CI.
- **Các bước thực hiện:**
  1. Thêm `AbortSignal.timeout(2000)` vào các lệnh fetch trong `apps/frontend/src/app/sitemap.ts` để loại trừ nguy cơ treo build khi chạy ngoài Docker.
  2. Tối ưu cấu hình `outputFileTracingRoot` trong `next.config.mjs`.
  3. Chạy kiểm thực toàn diện: `npm run lint`, `npm run typecheck`, `npm run build`, `docker compose config`.

---

### GIAI ĐOẠN 1: THIẾT LẬP BỘ KIỂM THỬ TRỌNG YẾU (CRITICAL TEST HARNESS)

> **NGUYÊN TẮC:** Bắt buộc viết test xác nhận hành vi hiện tại TRƯỚC KHI thay đổi bất kỳ dòng code nghiệp vụ nào của Saga, Inventory hay Auth.

- **Nhiệm vụ 1.1: Inventory Concurrency Integration Test (`TASK-P1-01`)**
  - Giả lập 10 requests đồng thời mua 1 SKU chỉ còn tồn kho 1 (`stockQuantity: 1, reservedQuantity: 0`).
  - Kiểm tra xem câu lệnh `SELECT ... FOR UPDATE` có thực sự chặn được việc tạo 2 reservation đồng thời hay không.
  - Kỳ vọng: Đúng 1 request thành công nhận reservation, 9 requests còn lại nhận lỗi `409 Conflict`.
- **Nhiệm vụ 1.2: Idempotency Concurrency Test (`TASK-P1-02`)**
  - Bắn 10 requests đồng thời với **cùng một `Idempotency-Key`** và **cùng một payload** vào endpoint Checkout.
  - Kỳ vọng:
    - Đúng 1 request thực thi side effect (tạo đơn, giữ kho).
    - Không phát sinh 2 bản ghi order trong database.
    - Không trừ tồn kho 2 lần.
    - Các request còn lại chờ và nhận kết quả nhất quán hoặc lỗi `409 Conflict / In-Progress`.
- **Nhiệm vụ 1.3: Checkout Saga Failure & Compensation Rollback Test (`TASK-P1-03`)**
  - Giả lập kịch bản: Giữ chỗ kho thành công, nhưng bước tạo đơn hàng trong database bị ném lỗi.
  - Kiểm tra xem lệnh giải phóng kho có được kích hoạt bồi hoàn tự động hay không.
- **Nhiệm vụ 1.4: Auth Refresh Token Rotation & Reuse Detection Test (`TASK-P1-04`)**
  - Test luồng: Cấp mới token, sử dụng token đã revoked, kiểm tra mã lỗi và trạng thái bản ghi DB.

---

### GIAI ĐOẠN 2: TÍNH ĐÚNG ĐẮN CỐT LÕI (CORE CORRECTNESS)

- **Nhiệm vụ 2.1: Xây dựng Worker xử lý Compensation Task (`TASK-P2-01`)**
  - Tạo service chạy nền xử lý các bản ghi `PENDING` trong bảng `compensation_tasks`.
  - **Thiết kế an toàn Multi-replica:**
    - Local / Single Replica: Dùng NestJS `@Cron(CronExpression.EVERY_30_SECONDS)`.
    - Production / Multi-Replica: Áp dụng câu lệnh Atomic Claiming với thời gian timeout:
      ```sql
      UPDATE compensation_tasks
      SET status = 'PROCESSING', locked_by = :workerId, locked_at = NOW()
      WHERE status = 'PENDING' AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL 2 MINUTE)
      LIMIT 5;
      ```
    - Worker phải idempotent: Nếu lệnh release kho đã được thực thi trước đó, trả về thành công an toàn.
- **Nhiệm vụ 2.2: Xây dựng Worker dọn dẹp Reservation hết hạn (`TASK-P2-02`)**
  - Tự động quét và chuyển trạng thái các reservation quá hạn (`expiresAt < NOW()`) sang `EXPIRED`, giải phóng số lượng `reservedQuantity` về lại `availableQuantity`.
- **Nhiệm vụ 2.3: Chuẩn hóa Vòng đời Giữ chỗ kho (Align TTL & Commit) (`TASK-P2-03`)**
  - Tách bạch rõ ràng giữa:
    - *Tạm giữ ngắn hạn (Holding TTL 15 phút):* Áp dụng khi đang checkout hoặc chờ cổng thanh toán online.
    - *Phân bổ đơn hàng đã xác nhận (Committed for Order):* Khi đơn COD được duyệt hoặc thanh toán thành công, số lượng kho chuyển hẳn từ `reserved` sang trừ `stockQuantity` ngay thời điểm xác nhận, không chờ tới khi giao hàng xong (`COMPLETED`).

---

### GIAI ĐOẠN 3: HOÀN THIỆN GIAO DIỆN ĐẶT HÀNG (FRONTEND CHECKOUT)

- **Nhiệm vụ 3.1: Xây dựng trang Checkout (`apps/frontend/src/app/(customer)/checkout/page.tsx`)**
  - Form nhập thông tin người nhận: Họ tên, số điện thoại, chọn 3 cấp Tỉnh/Thành, Quận/Huyện, Phường/Xã từ API `customer-service`.
  - Khung tóm tắt đơn hàng: Danh sách sản phẩm từ Cart Context, phí vận chuyển tính từ vùng miền, nhập và thẩm định mã giảm giá (Coupon).
  - Lựa chọn phương thức thanh toán hỗ trợ thực tế:
    - `COD`: Thanh toán tiền mặt khi nhận hàng.
    - `BANK_TRANSFER`: Chuyển khoản ngân hàng qua mã VietQR.
  - Tự động sinh `Idempotency-Key` (UUIDv4) gắn vào header mỗi lần bấm Đặt hàng.
- **Nhiệm vụ 3.2: Gắn kết Giỏ hàng & Trang hoàn tất đơn**
  - Cập nhật nút "Tiến hành đặt hàng" trong `cart-drawer.tsx` điều hướng sang `/checkout`.
  - Xây dựng trang `/checkout/thanh-cong` hiển thị mã đơn hàng, thông tin chuyển khoản VietQR (nếu chọn chuyển khoản) và link theo dõi đơn hàng.

---

### GIAI ĐOẠN 4: BẢO MẬT & DỮ LIỆU (SECURITY & DATA INTEGRITY)

- **Nhiệm vụ 4.1: Thu hồi Token Family khi phát hiện Token Reuse (`TASK-P4-01`)**
  - Trong `auth.service.ts`: Khi phát hiện `tokenRecord.revokedAt !== null`, lập tức thực hiện batch revoke toàn bộ refresh token còn lại của user đó:
    ```ts
    await this.prisma.refreshToken.updateMany({
      where: { userId: tokenRecord.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    ```
- **Nhiệm vụ 4.2: Kiểm tra Magic Bytes Upload & Chặn SVG (`TASK-P4-02`)**
  - Dùng `file-type` đọc byte header kiểm tra định dạng ảnh JPEG/PNG/WebP thực tế.
  - Từ chối upload file `.svg` để loại trừ nguy cơ XSS.
- **Nhiệm vụ 4.3: Dọn dẹp Object MinIO mồ côi (`TASK-P4-03`)**
  - Thêm hook gọi `minioClient.removeObject()` khi sản phẩm hoặc bài viết bị xóa khỏi cơ sở dữ liệu.

---

### GIAI ĐOẠN 5: VẬN HÀNH & ĐỘ TIN CẬY (OPERATIONS & RELIABILITY)

- **Nhiệm vụ 5.1: Tách bạch Liveness & Readiness Probes (`TASK-P5-01`)**
  - `/health` (Liveness): Trả về HTTP 200 `{ status: 'alive' }` (chỉ kiểm tra process Node.js).
  - `/ready` (Readiness): Thực hiện `SELECT 1` kiểm tra MySQL và MinIO. Nếu mất kết nối, trả về HTTP 503 để ngắt điều hướng traffic mà không restart container.
- **Nhiệm vụ 5.2: Bộ công cụ Sao lưu & Khôi phục dữ liệu (`TASK-P5-02`)**
  - Tạo script `scripts/backup-databases.sh`: Chạy `mysqldump` xuất 6 logical database (`auth_db`, `product_db`, `order_db`, `inventory_db`, `customer_db`, `content_db`), nén gzip với timestamp.
  - Tạo script `scripts/restore-databases.sh`: Phục vụ diễn tập khôi phục thảm họa (Disaster Recovery Drill).
- **Nhiệm vụ 5.3: Quyết định Hạ tầng Redis (`TASK-P5-03`)**
  - Local Development: Tùy chọn comment out service `redis` trong `docker-compose.yml` để giải phóng RAM máy cá nhân nếu chưa có nhu cầu caching.

---

### GIAI ĐOẠN 6: GIA CỐ MÔI TRƯỜNG PRODUCTION (PRODUCTION HARDENING)

- **Nhiệm vụ 6.1: Cấu hình Nginx Listen 443 SSL (`TASK-P6-01`)**
  - Cập nhật `docker/nginx/conf.d/default.conf` bổ sung server block `listen 443 ssl;` với giao thức TLSv1.2, TLSv1.3, ciphers bảo mật và chuyển hướng HTTP sang HTTPS.
  - Cung cấp chứng chỉ SSL tự ký cho staging và script Let's Encrypt Certbot cho production domain thật.
- **Nhiệm vụ 6.2: Quản lý Bí mật Sản xuất & Smoke Tests**
  - Đảm bảo toàn bộ mật khẩu mặc định trong `.env.example` được thay thế bằng chuỗi ngẫu nhiên mạnh trên production.

---

### GIAI ĐOẠN 7: THIẾT KẾ NỀN TẢNG THANH TOÁN (PAYMENT ARCHITECTURE)

> **BẮT BUỘC:** Hoàn thiện kiến trúc thanh toán trừu tượng trước khi viết bất kỳ dòng code kết nối MoMo nào.

- **Nhiệm vụ 7.1: Xây dựng Model Giao Dịch Chuyên Biệt (`payment_transactions`)**
  - Tách biệt lịch sử giao dịch thanh toán khỏi bảng đơn hàng:
    - Hỗ trợ 1 đơn hàng có thể có nhiều lần thanh toán thử (payment attempts).
    - Lưu mã giao dịch đối tác (`transactionId`), số tiền, phương thức, trạng thái (`PENDING`, `SUCCESS`, `FAILED`, `EXPIRED`), payload phản hồi gốc (`rawResponse`).
- **Nhiệm vụ 7.2: State Machine Thanh toán & Giao diện Provider Trừu tượng**
  - Định nghĩa interface trừu tượng:
    ```ts
    interface PaymentProvider {
      createPayment(order: OrderPayload): Promise<PaymentCreationResult>;
      verifyWebhook(headers: Record<string, string>, body: any): Promise<PaymentWebhookResult>;
      checkStatus(transactionId: string): Promise<PaymentStatusResult>;
    }
    ```
  - Thiết kế luồng xử lý tồn kho: Giữ chỗ có TTL trong lúc thanh toán `PENDING`, commit xuất kho khi IPN `SUCCESS`, và nhả giữ chỗ kho ngay lập tức khi thanh toán `FAILED` hoặc `EXPIRED`.

---

### GIAI ĐOẠN 8: TÍCH HỢP CỔNG THANH TOÁN MOMO (MOMO SANDBOX)

- **Mục tiêu:** Cho phép khách hàng thanh toán thực tế qua ví điện tử MoMo.
- **Các bước thực hiện:**
  1. Triển khai `MomoPaymentProvider` thực thi interface từ Phase 7.
  2. Tạo liên kết thanh toán `POST https://test-payment.momo.vn/v2/gateway/api/create` ký số HMAC SHA256.
  3. Xây dựng Webhook IPN Receiver (`POST /api/v1/payments/momo/ipn`):
     - Xác thực chữ ký số HMAC SHA256 từ MoMo.
     - Áp dụng Idempotency: Xử lý an toàn khi MoMo gửi lặp lại webhook nhiều lần.
     - Cập nhật trạng thái đơn hàng sang `PAID` và chuyển trạng thái tồn kho tương ứng trong một transaction an toàn.

---

## 4. TIÊU CHÍ HOÀN THÀNH TOÀN DIỆN (DEFINITION OF DONE)

Hệ thống được coi là hoàn tất khắc phục và sẵn sàng vận hành sản xuất khi:
- [ ] `npm run build` hoàn thành với mã thoát 0 trên cả máy local và Docker.
- [ ] Bộ Characterization Tests (Inventory Concurrency, Idempotency, Saga Compensation) chạy PASS 100%.
- [ ] Khách hàng có thể thao tác hoàn chỉnh từ: Giỏ hàng ──► Điền địa chỉ tại `/checkout` ──► Chọn COD/VietQR ──► Tạo đơn thành công.
- [ ] Khi gặp sự cố mạng, Worker tự động bù trừ kho trong vòng 60 giây và an toàn khi chạy multi-replica.
- [ ] Reservation kho quá hạn được tự động dọn dẹp mỗi 5 phút.
- [ ] Cấu hình Nginx lắng nghe cổng 443 SSL an toàn.
- [ ] Script sao lưu tự động MySQL được lưu trong repository và thử nghiệm khôi phục thành công.
- [ ] Tách biệt hoàn toàn Liveness (`/health`) và Readiness (`/ready`).
