# PhanBonShop — Báo Cáo Kỹ Thuật & Tài Liệu Kiến Trúc Hệ Thống

> **Dự án**: Nền tảng Thương Mại Điện Tử Chuyên Ngành Phân Bón & Vật Tư Nông Nghiệp Việt Nam  
> **Kiến trúc**: Microservices Monorepo (Node.js 20+, NestJS 10, Next.js 14 App Router, Prisma ORM, MySQL 8.0, Redis 7.0, MinIO S3, Nginx Reverse Proxy)  
> **Phiên bản tài liệu**: 1.0.0 (Cập nhật và đối soát toàn diện trực tiếp từ mã nguồn thực tế)

---

## Mục Lục (Table of Contents)

1. [1. Project Overview (Tổng Quan Dự Án)](#1-project-overview-tổng-quan-dự-án)
2. [2. Problem Statement (Bài Toán & Thách Thức Nghiệp Vụ)](#2-problem-statement-bài-toán--thách-thức-nghiệp-vụ)
3. [3. Project Objectives (Mục Tiêu Dự Án)](#3-project-objectives-mục-tiêu-dự-án)
4. [4. Scope (Phạm Vi Hệ Thống)](#4-scope-phạm-vi-hệ-thống)
5. [5. Key Features (Tính Năng Cốt Lõi)](#5-key-features-tính-năng-cốt-lõi)
6. [6. User Roles (Phân Hệ Người Dùng & Vai Trò)](#6-user-roles-phân-hệ-người-dùng--vai-trò)
7. [7. Technology Stack (Ngăn Xếp Công Nghệ Thực Tế)](#7-technology-stack-ngăn-xếp-công-nghệ-thực-tế)
8. [8. System Architecture (Kiến Trúc Tổng Thể Hệ Thống)](#8-system-architecture-kiến-trúc-tổng-thể-hệ-thống)
9. [9. Architecture Diagram (Sơ Đồ Kiến Trúc Hệ Thống)](#9-architecture-diagram-sơ-đồ-kiến-trúc-hệ-thống)
10. [10. Monorepo Architecture (Kiến Trúc Monorepo)](#10-monorepo-architecture-kiến-trúc-monorepo)
11. [11. Project Structure (Cấu Trúc Thư Mục Thực Tế)](#11-project-structure-cấu-trúc-thư-mục-thực-tế)
12. [12. Components Overview (Chi Tiết Các Ứng Dụng & Dịch Vụ)](#12-components-overview-chi-tiết-các-ứng-dụng--dịch-vụ)
    * [12.1. Frontend Storefront & Admin Portal](#121-frontend-storefront--admin-portal)
    * [12.2. API Gateway](#122-api-gateway)
    * [12.3. Auth Service](#123-auth-service)
    * [12.4. Product Service](#124-product-service)
    * [12.5. Order Service](#125-order-service)
    * [12.6. Inventory Service](#126-inventory-service)
    * [12.7. Customer Service](#127-customer-service)
    * [12.8. Content Service](#128-content-service)
13. [13. Shared Packages (Thư Viện Dùng Chung)](#13-shared-packages-thư-viện-dùng-chung)
14. [14. Database Architecture (Kiến Trúc Cơ Sở Dữ Liệu)](#14-database-architecture-kiến-trúc-cơ-sở-dữ-liệu)
15. [15. Domain Model (Mô Hình Nghiệp Vụ & Thực Thể Dữ Liệu)](#15-domain-model-mô-hình-nghiệp-vụ--thực-thể-dữ-liệu)
16. [16. Service Communication (Giao Tiếp Giữa Các Dịch Vụ)](#16-service-communication-giao-tiếp-giữa-các-dịch-vụ)
17. [17. Core Business Flows (Các Luồng Nghiệp Vụ Chính)](#17-core-business-flows-các-luồng-nghiệp-vụ-chính)
    * [17.1. Chu trình Xác thực & Phiên Đăng Nhập](#171-chu-trình-xác-thực--phiên-đăng-nhập)
    * [17.2. Tìm kiếm, Duyệt & Quản lý Danh Mục Sản Phẩm](#172-tìm-kiếm-duyệt--quản-lý-danh-mục-sản-phẩm)
    * [17.3. Quản lý Giỏ Hàng](#173-quản-lý-giỏ-hàng)
    * [17.4. Quy trình Đặt Hàng & Checkout Orchestration](#174-quy-trình-đặt-hàng--checkout-orchestration)
    * [17.5. Luồng Tồn Kho & Vòng Đời Giữ Hàng](#175-luồng-tồn-kho--vòng-đời-giữ-hàng)
    * [17.6. Xử lý & Xác Nhận Thanh Toán](#176-xử-lý--xác-nhận-thanh-toán)
    * [17.7. Dịch Chuyển Trạng Thái Đơn Hàng](#177-dịch-chuyển-trạng-thái-đơn-hàng)
    * [17.8. Đánh Giá Sản Phẩm Có Xác Minh Mua Hàng](#178-đánh-giá-sản-phẩm-có-xác-minh-mua-hàng)
    * [17.9. Quản Trị Hệ Thống Toàn Diện](#179-quản-trị-hệ-thống-toàn-diện)
18. [18. API Architecture (Kiến Trúc & Bảng Tra Cứu API)](#18-api-architecture-kiến-trúc--bảng-tra-cứu-api)
19. [19. Authentication & Authorization (Xác Thực & Phân Quyền)](#19-authentication--authorization-xác-thực--phân-quyền)
20. [20. Security (Phân Tích Cơ Chế Bảo Mật Toàn Diện)](#20-security-phân-tích-cơ-chế-bảo-mật-toàn-diện)
21. [21. Inventory Concurrency & Anti-Oversell (Đồng Thời & Chống Bán Quá Tồn)](#21-inventory-concurrency--anti-oversell-đồng-thời--chống-bán-quá-tồn)
22. [22. Distributed Transaction / Saga (Điều Phối Giao Dịch Phân Tán)](#22-distributed-transaction--saga-điều-phối-giao-dịch-phân-tán)
23. [23. Idempotency (Cơ Chế Xử Lý Bất Biến Lặp Lại)](#23-idempotency-cơ-chế-xử-lý-bất-biến-lặp-lại)
24. [24. File & Object Storage (Lưu Trữ Tệp Tin & Hình Ảnh với MinIO)](#24-file--object-storage-lưu-trữ-tệp-tin--hình-ảnh-với-minio)
25. [25. Redis Usage (Hiện Trạng Triển Khai & Khuyến Nghị Redis)](#25-redis-usage-hiện-trạng-triển-khai--khuyến-nghị-redis)
26. [26. Audit Logging (Ghi Nhận Nhật Ký Kiểm Toán Nghiệp Vụ)](#26-audit-logging-ghi-nhận-nhật-ký-kiểm-toán-nghiệp-vụ)
27. [27. Error Handling (Xử Lý Ngoại Lệ & Lỗi Hệ Thống)](#27-error-handling-xử-lý-ngoại-lệ--lỗi-hệ-thống)
28. [28. Observability (Khả Năng Quan Sát & Giám Sát Vận Hành)](#28-observability-khả-năng-quan-sát--giám-sát-vận-hành)
29. [29. Docker Architecture (Kiến Trúc Container Hóa)](#29-docker-architecture-kiến-trúc-container-hóa)
30. [30. Local Development Environment (Môi Trường Phát Triển Cục Bộ)](#30-local-development-environment-môi-trường-phát-triển-cục-bộ)
31. [31. Installation (Hướng Dẫn Cài Đặt Từng Bước)](#31-installation-hướng-dẫn-cài-đặt-từng-bước)
32. [32. Environment Configuration (Cấu Hình Biến Môi Trường)](#32-environment-configuration-cấu-hình-biến-môi-trường)
33. [33. Running the Application (Khởi Chạy Hệ Thống)](#33-running-the-application-khởi-chạy-hệ-thống)
34. [34. Database Migration (Quy Trình Di Trú Cơ Sở Dữ Liệu)](#34-database-migration-quy-trình-di-trú-cơ-sở-dữ-liệu)
35. [35. Seed Data (Nạp Dữ Liệu Khởi Tạo)](#35-seed-data-nạp-dữ-liệu-khởi-tạo)
36. [36. API Documentation (Tài Liệu Swagger / OpenAPI)](#36-api-documentation-tài-liệu-swagger--openapi)
37. [37. Testing (Hiện Trạng Kiểm Thử Toàn Hệ Thống)](#37-testing-hiện-trạng-kiểm-thử-toàn-hệ-thống)
38. [38. Build, Lint and Typecheck (Kiểm Chuẩn Mã Nguồn)](#38-build-lint-and-typecheck-kiểm-chuẩn-mã-nguồn)
39. [39. Production Deployment (Triển Khai Môi Trường Sản Xuất)](#39-production-deployment-triển-khai-môi-trường-sản-xuất)
40. [40. Production Readiness Assessment (Đánh Giá Độ Sẵn Sàng Vận Hành)](#40-production-readiness-assessment-đánh-giá-độ-sẵn-sàng-vận-hành)
41. [41. Known Limitations (Các Hạn Chế Kỹ Thuật Hiện Hữu)](#41-known-limitations-các-hạn-chế-kỹ-thuật-hiện-hữu)
42. [42. Roadmap (Lộ Trình Phát Triển Tiếp Theo)](#42-roadmap-lộ-trình-phát-triển-tiếp-theo)
43. [43. Troubleshooting (Khắc Phục Sự Cố Thường Gặp)](#43-troubleshooting-khắc-phục-sự-cố-thường-gặp)
44. [44. Repository Conventions (Quy Ước Đóng Góp & Phát Triển)](#44-repository-conventions-quy-ước-đóng-góp--phát-triển)
45. [45. Conclusion (Kết Luận)](#45-conclusion-kết-luận)
46. [46. License (Giấy Phép Sử Dụng)](#46-license-giấy-phép-sử-dụng)

---

## 1. Project Overview (Tổng Quan Dự Án)

**PhanBonShop** là một nền tảng thương mại điện tử chuyên ngành phục vụ chuỗi cung ứng, phân phối và bán lẻ phân bón, thuốc bảo vệ thực vật, và vật tư nông nghiệp tại thị trường Việt Nam. Hệ thống hướng đến các nhóm đối tượng cốt lõi: hộ nông dân canh tác cá thể, trang trại nông nghiệp, đại lý vật tư nông nghiệp cấp 1 và cấp 2, cùng đội ngũ kỹ sư nông học và cán bộ quản lý bán hàng.

Dự án được thiết kế theo kiến trúc **Monorepo Microservices**, chia tách ranh giới nghiệp vụ (Bounded Contexts) thành các dịch vụ độc lập, đảm bảo tính khả dụng cao, khả năng mở rộng quy mô linh hoạt và quản trị dữ liệu biệt lập theo từng phân hệ.

---

## 2. Problem Statement (Bài Toán & Thách Thức Nghiệp Vụ)

Thương mại điện tử trong ngành vật tư nông nghiệp Việt Nam mang những đặc thù phức tạp mà các nền tảng bán lẻ thông thường khó đáp ứng:

1. **Quy cách bao bì & đơn vị tính đa dạng**: Phân bón có quy cách từ gói nhỏ (100g, 500g), chai/can dung dịch (500ml, 1L, 5L) đến các bao tải khối lượng lớn (25kg, 50kg, tấn), đòi hỏi quản lý giá và tồn kho theo từng biến thể (SKU).
2. **Thuộc tính canh tác nông học**: Người mua tìm kiếm sản phẩm theo cây trồng (lúa, sầu riêng, cà phê, cây ăn trái), giai đoạn sinh trưởng (bón lót, đẻ nhánh, nuôi trái), phương thức bón (bón gốc, phun qua lá, tưới nhỏ giọt) và nhóm dinh dưỡng (Đạm, Lân, Kali, NPK, Hữu cơ vi sinh, Trung vi lượng).
3. **Bài toán đồng thời và chống bán quá tồn (Anti-Overselling)**: Vào các đợt cao điểm mùa vụ hoặc khuyến mãi trợ giá phân bón, lượng đặt hàng tăng đột biến. Nếu không có cơ chế khóa hàng đồng thời chặt chẽ, việc trừ tồn ảo sẽ dẫn đến tình trạng hủy đơn hàng loạt do không đủ hàng vật lý trong kho.
4. **Phối hợp giao dịch phân tán (Distributed Transaction)**: Quy trình đặt hàng yêu cầu xác minh giá niêm yết từ danh mục, tạm giữ tồn kho, áp dụng mã giảm giá và khởi tạo thanh toán qua nhiều dịch vụ độc lập mà không được làm rò rỉ dữ liệu hoặc sai lệch tài nguyên khi xảy ra lỗi bất ngờ.
5. **Giao tiếp nội bộ và bảo mật dữ liệu**: Cần phân tách rõ ràng lưu lượng truy cập công cộng (Public Internet) và lưu lượng giao tiếp nội bộ giữa các microservices để ngăn chặn tấn công giả mạo (spoofing) và truy cập trái phép.

---

## 3. Project Objectives (Mục Tiêu Dự Án)

* **Thiết lập kiến trúc Microservices Monorepo chuẩn mực**: Sử dụng npm Workspaces kết hợp TypeScript strict mode, chia sẻ an toàn các bộ thư viện contracts, cấu hình, logger và tiện ích.
* **Đảm bảo tính nhất quán dữ liệu (Data Consistency)**: Áp dụng mô hình Database-per-service kết hợp với Saga Orchestration Pattern để giải quyết bài toán giao dịch phân tán.
* **Xử lý đồng thời ở mức kho bãi**: Ứng dụng Khóa bi quan (Pessimistic Locking `SELECT ... FOR UPDATE`) trong MySQL để kiểm soát tồn kho khả dụng và ngăn chặn triệt để hiện tượng oversell.
* **Bảo mật nhiều lớp (Defense-in-Depth)**: Bảo vệ Ingress bằng Nginx reverse proxy, API Gateway kiểm soát Rate Limiting, xác thực JWT kép (Access + Refresh Token Rotation), phân quyền theo vai trò (RBAC) và bảo vệ API nội bộ bằng shared secret đối soát thời gian thực (`timingSafeCompare`).
* **Sẵn sàng cho hạ tầng Container**: Đóng gói toàn bộ 14 thành phần hệ thống bằng multi-stage Dockerfiles chuẩn production, chạy người dùng không đặc quyền (`USER node`), hỗ trợ kiểm tra sức khỏe tự động (Health Checks) và phân lập mạng nội bộ.

---

## 4. Scope (Phạm Vi Hệ Thống)

* **Phạm vi hoàn thiện**:
  * Mã nguồn backend microservices (NestJS 10).
  * API Gateway trung tâm và bộ định tuyến reverse proxy (apps/api-gateway).
  * Mô hình dữ liệu và di trú cơ sở dữ liệu trên 6 logical databases (MySQL 8.0).
  * Lưu trữ tệp tin và ảnh nhị phân đối tượng (MinIO S3).
  * Giao diện người dùng Web Storefront & Trang quản trị Admin Portal (Next.js 14).
  * Bộ kiểm chuẩn CI/CD tự động trên GitHub Actions.
  * Cấu hình Docker Compose cho cả môi trường phát triển cục bộ và triển khai sản xuất.
* **Phạm vi chưa bao gồm / Nằm trong lộ trình**:
  * Tích hợp cổng thanh toán trực tuyến bên thứ ba (VNPay, MoMo, ZaloPay, PayOS) qua webhook thực tế.
  * Hàng đợi phân tán cho cron job dọn dẹp nền (BullMQ / RabbitMQ / Kafka).
  * Bộ công cụ giám sát tập trung (Prometheus, Grafana, OpenTelemetry, Loki).

---

## 5. Key Features (Tính Năng Cốt Lõi)

Hệ thống được phân loại trạng thái triển khai dựa trên bằng chứng kiểm tra mã nguồn thực tế:
* ✅ **Implemented**: Đã được hiện thực hóa đầy đủ trong source code và controllers/services.
* 🟡 **Partial / In Progress**: Đã có một phần logic (ví dụ backend API đã xong nhưng UI chưa hoàn tất kết nối, hoặc logic cần bổ sung scheduler).
* ⚪ **Planned / Roadmap**: Đã có định nghĩa enum/contract hoặc khuyến nghị kiến trúc nhưng chưa có mã nguồn xử lý.
* ❌ **Not Implemented**: Chưa được triển khai.

| Nhóm Tính Năng | Mô Tả Nghiệp Vụ | Trạng Thái Thực Tế | Thành Phần Thực Thi |
| :--- | :--- | :---: | :--- |
| **Đăng Ký & Đăng Nhập** | Đăng ký tài khoản, đăng nhập email/mật khẩu, mã hóa bcrypt (cost 12), trả về cặp JWT Access/Refresh tokens | ✅ Implemented | `services/auth-service` |
| **Đăng Nhập Bằng Gmail (Google Identity)** | Xác thực tài khoản Gmail thật qua Google Identity Services, xác minh ID token bằng `google-auth-library`, liên kết qua Google `sub` duy nhất, chống tạo tài khoản trùng lặp | ✅ Implemented | `services/auth-service` |
| **Refresh Token Rotation** | Cấp mới Access Token khi hết hạn, thu hồi Refresh Token cũ (One-time use) | ✅ Implemented | `services/auth-service` |
| **Phát Hiện Tái Sử Dụng Token** | Phát hiện token đã bị thu hồi và từ chối cấp phát tiếp với mã lỗi `401 Unauthorized` | ✅ Implemented | `services/auth-service` |
| **Đăng Xuất Đa Thiết Bị** | Đăng xuất phiên hiện tại hoặc thu hồi toàn bộ session đăng nhập trên tất cả thiết bị | ✅ Implemented | `services/auth-service` |
| **Khôi Phục Mật Khẩu** | Tạo mã reset token SHA-256 có thời hạn, gửi email mô phỏng, đổi mật khẩu mới | ✅ Implemented | `services/auth-service` |
| **Danh Mục & Thương Hiệu** | Quản lý danh mục phân cấp cây cha-con, quản lý thương hiệu phân bón, slug SEO tiếng Việt | ✅ Implemented | `services/product-service` |
| **Sản Phẩm & Biến Thể (SKU)** | Quản lý sản phẩm phân bón, quy cách đóng gói (bao/chai/can), giá niêm yết, giá so sánh | ✅ Implemented | `services/product-service` |
| **Thuộc Tính Canh Tác** | Gán nhãn nông nghiệp: cây trồng (lúa, cây ăn trái), giai đoạn bón, phương pháp bón, loại dưỡng chất | ✅ Implemented | `services/product-service` |
| **Lưu Trữ Ảnh Sản Phẩm** | Upload ảnh đa kích thước lên MinIO S3 bucket `product-images`, quản lý ảnh đại diện và thứ tự | ✅ Implemented | `services/product-service` |
| **Đánh Giá Có Xác Minh** | Khách hàng đánh giá sản phẩm; backend tự động gọi `order-service` kiểm tra trạng thái mua hàng thực tế | ✅ Implemented | `services/product-service` |
| **Giỏ Hàng (Cart)** | Thêm, sửa, xóa số lượng món hàng, đồng bộ giỏ hàng theo User ID trong cơ sở dữ liệu | ✅ Implemented | `services/order-service` |
| **Checkout Saga Orchestrator** | Điều phối giao dịch phân tán: chống giá giả, kiểm tra coupon, giữ kho, tạo đơn, tạo thanh toán, bồi hoàn tự động | ✅ Implemented | `services/order-service` |
| **Xử Lý Bất Biến (Idempotency)** | Hỗ trợ header `Idempotency-Key` kết hợp bảng `idempotency_records` chống trừ tiền hoặc tạo đơn trùng lặp | ✅ Implemented | `services/order-service` |
| **Thanh Toán COD** | Khởi tạo đơn hàng nhận tiền khi giao hàng, tự động chuyển `PAID` khi đơn `COMPLETED`, chặn `COMPLETED` nếu đơn online chưa thanh toán | ✅ Implemented | `services/order-service` |
| **Thanh Toán Chuyển Khoản (VietQR)** | Sinh thông tin tài khoản ngân hàng và mã đối soát; cho phép quản trị viên đối soát sao kê và duyệt thủ công | ✅ Implemented | `services/order-service` |
| **Bảo Vệ Thanh Toán Đơn Đã Hủy** | Chặn xác nhận thanh toán (`confirmPayment`) cho đơn hàng đã `CANCELLED`, `RETURNED`, `REFUNDED`; đồng bộ `paymentStatus = CANCELLED` khi hủy đơn | ✅ Implemented | `services/order-service` |
| **Hoàn Trả Coupon Khi Hủy Đơn** | Tự động xóa `couponUsage` và giảm `usedCount` khi đơn hàng bị hủy hoặc hoàn tiền, trả lại lượt sử dụng mã giảm giá cho khách hàng | ✅ Implemented | `services/order-service` |
| **Hoàn Kho Vật Lý Khi Trả Hàng** | Tự động nhập lại kho vật lý (`MovementType.RETURN`) khi đơn hàng chuyển sang `RETURNED`, cộng lại `stockQuantity` | ✅ Implemented | `services/order-service`, `services/inventory-service` |
| **Đồng Bộ Hoàn Tiền (REFUNDED)** | Chặn hoàn tiền đơn chưa thanh toán, đồng bộ `paymentStatus = REFUNDED`, ghi vết `PaymentAuditLog`, hoàn trả coupon | ✅ Implemented | `services/order-service` |
| **Chặn Hủy Đơn Đã Thanh Toán** | Ngăn khách hàng tự hủy đơn đã `PAID` qua API, cho phép Admin chuyển `CANCELLED → REFUNDED` để hoàn tiền an toàn | ✅ Implemented | `services/order-service` |
| **Bồi Hoàn Xuất Kho Tự Động (Outbox)** | Khi xuất kho `commitInventory` gặp sự cố mạng, tự động tạo `CompensationTask` kiểu `COMMIT_INVENTORY` với retry `maxRetries: 60` | ✅ Implemented | `services/order-service` |
| **Quản Lý Vòng Đời Đơn Hàng** | State machine kiểm soát chặt chẽ 11 trạng thái dịch chuyển của đơn hàng kèm lịch sử thay đổi | ✅ Implemented | `services/order-service` |
| **Khóa Bi Quan Chống Oversell** | Dùng `SELECT ... FOR UPDATE` trong transaction khóa hàng độc quyền, tính `availableQuantity` | ✅ Implemented | `services/inventory-service` |
| **Sổ Cái Biến Động Kho** | Ghi nhận chi tiết lịch sử nhập, xuất, tạm giữ, giải phóng và điều chỉnh kiểm kê thủ công | ✅ Implemented | `services/inventory-service` |
| **Cảnh Báo Sắp Hết Hàng** | Truy vấn các mặt hàng có tồn kho khả dụng dưới ngưỡng tái đặt hàng (`reorderLevel`) | ✅ Implemented | `services/inventory-service` |
| **Hồ Sơ & Sổ Địa Chỉ** | Quản lý thông tin khách hàng, số điện thoại, sổ địa chỉ giao hàng và dữ liệu hành chính Tỉnh/Huyện/Xã VN | ✅ Implemented | `services/customer-service` |
| **Bài Viết Nông Nghiệp & Banner** | Quản lý cẩm nang kỹ thuật bón phân, bài viết tin tức, banner quảng cáo khuyến mãi trên MinIO S3 | ✅ Implemented | `services/content-service` |
| **Định Tuyến & Bảo Vệ Gateway** | Phân phối API, kiểm soát Rate Limiting, gán `x-request-id`, loại bỏ header giả mạo từ bên ngoài | ✅ Implemented | `apps/api-gateway` |
| **Giao Diện Checkout Frontend** | Trang Checkout đầy đủ: chọn địa chỉ, phương thức thanh toán (COD/Chuyển khoản), áp dụng mã giảm giá, tính phí vận chuyển, đặt hàng với `Idempotency-Key` | ✅ Implemented | `apps/frontend` |
| **Đăng Bán Sản Phẩm Mới (Admin)** | Modal form chuyên sâu phân bón: SKU tự sinh thông minh, đa quy cách đóng gói (Bao/Can/Chai), thuộc tính nông nghiệp, upload ảnh MinIO, tự động khởi tạo tồn kho ban đầu qua `POST /inventory/adjust` | ✅ Implemented | `apps/frontend`, `services/product-service`, `services/inventory-service` |
| **Thu Hồi Giữ Kho Quá Hạn (TTL)** | API dọn dẹp đã sẵn sàng (`POST /internal/v1/inventory/cleanup-expired`), cần cron job định kỳ | 🟡 Partial | `services/inventory-service` |
| **Cổng Thanh Toán Trực Tuyến** | VNPay, MoMo, ZaloPay, PayOS (Hiện mới chỉ có enum và kiến trúc adapter provider) | ⚪ Planned | `services/order-service` |
| **Phân Tán Cache Với Redis** | Hạ tầng Redis 7 đã chạy container nhưng mã nguồn app chưa gọi lệnh cache | ⚪ Planned | Toàn hệ thống |

---

## 6. User Roles (Phân Hệ Người Dùng & Vai Trò)

Cơ chế phân quyền của hệ thống được xây dựng dựa trên enum `Role` (được lưu tại `auth_db` và kiểm tra qua `RolesGuard`):

| Vai Trò (Role) | Mô Tả Nghiệp Vụ | Quyền Hạn Thực Tế Được Cấp Phép | Bằng Chứng Mã Nguồn |
| :--- | :--- | :--- | :--- |
| **CUSTOMER** | Khách hàng mua sắm (Hộ nông dân, chủ trang trại, người mua lẻ) | * Xem danh mục, sản phẩm, bài viết, banner công khai<br>* Quản lý giỏ hàng cá nhân, tiến hành checkout<br>* Quản lý hồ sơ cá nhân và sổ địa chỉ (`/me`)<br>* Xem lịch sử đơn hàng của chính mình, yêu cầu hủy đơn ở trạng thái PENDING/CONFIRMED<br>* Gửi đánh giá sản phẩm | `auth.controller.ts`<br>`customer.controller.ts`<br>`cart.controller.ts`<br>`checkout.controller.ts` |
| **STAFF** | Nhân viên bán hàng & chăm sóc khách hàng | * Tất cả quyền của CUSTOMER<br>* Tra cứu danh sách đơn hàng toàn sàn<br>* Cập nhật trạng thái đơn hàng (duyệt, đóng gói, giao hàng)<br>* Xác nhận thanh toán chuyển khoản ngân hàng<br>* Xem danh sách khách hàng và lịch sử mua sắm<br>* Quản lý nội dung bài viết tin tức nông nghiệp và banner | `orders.controller.ts`<br>`payments.controller.ts`<br>`customer.controller.ts`<br>`posts.controller.ts`<br>`banners.controller.ts` |
| **WAREHOUSE** | Thủ kho & nhân viên logistics | * Xem toàn bộ danh sách tồn kho vật lý và tồn kho khả dụng<br>* Nhận cảnh báo sản phẩm sắp hết hàng (`/low-stock`)<br>* Thực hiện điều chỉnh kiểm kê tồn kho thủ công (`/adjust`) kèm lý do bắt buộc<br>* Xem sổ cái biến động kho (`/movements`) | `inventory.controller.ts` |
| **MANAGER** | Cán bộ quản lý kinh doanh | * Tất cả quyền của STAFF và WAREHOUSE<br>* Thêm mới, chỉnh sửa, ẩn/hiện sản phẩm và biến thể quy cách bao bì<br>* Quản lý danh mục cha-con và thương hiệu<br>* Tạo và quản lý mã giảm giá (coupons)<br>* Duyệt các khiếu nại hoàn trả hàng | `product.controller.ts`<br>`category.controller.ts`<br>`brand.controller.ts`<br>`coupons.controller.ts` |
| **ADMIN** | Quản trị viên hệ thống | * Toàn quyền vận hành nghiệp vụ trên toàn bộ các phân hệ<br>* Quản lý cấu hình, xem nhật ký kiểm toán (Audit Logs)<br>* Xóa sản phẩm, biến thể, bài viết, banner | Toàn bộ Controllers |
| **SUPER_ADMIN** | Quản trị viên cấp cao nhất | * Sở hữu toàn bộ quyền hạn của ADMIN<br>* Quyền truy cập các endpoint đặc quyền quản trị cấp cao nhất | `auth.controller.ts` (`admin-only`) |

---

## 7. Technology Stack (Ngăn Xếp Công Nghệ Thực Tế)

Dưới đây là danh mục công nghệ thực tế được xác minh trực tiếp từ các file `package.json` và cấu hình hệ thống:

```
+---------------------------------------------------------------------------------------+
|                                    NGĂN XẾP CÔNG NGHỆ                                 |
+---------------------------------------------------------------------------------------+
| Frontend Layer       : Next.js 14.2.24 (App Router), React 18.3.1, Tailwind CSS 3.4   |
| API Gateway          : NestJS 10.3.9, Express, Axios/Fetch, Helmet 7.1, Throttler 5.1 |
| Microservices        : NestJS 10.3.9, TypeScript 5.5.4 (Strict Mode)                  |
| Database & ORM       : MySQL 8.0 (Community Server), Prisma ORM 5.15.0               |
| Caching & Messaging  : Redis 7.0 (Alpine Container - Infrastructure Prepared)          |
| Object Storage       : MinIO S3 (Quay.io Official), MinIO Node.js Client 8.0.2        |
| Ingress & Proxy      : Nginx 1.27 (Alpine) L7 Reverse Proxy                           |
| Validation & Parsing : class-validator 0.14.1, class-transformer 0.5.1, Zod 3.23.8    |
| Security & Auth      : Passport 0.7.0, Passport-JWT 4.0.1, bcryptjs 2.4.3             |
| Documentation        : Swagger / OpenAPI 7.3.1 (@nestjs/swagger)                      |
| Containerization     : Multi-stage Dockerfiles, Docker Compose v2+                    |
| CI/CD Pipeline       : GitHub Actions (.github/workflows/ci.yml)                      |
+---------------------------------------------------------------------------------------+
```

### Chi Tiết Lý Do Lựa Chọn & Phạm Vi Áp Dụng:

1. **TypeScript 5.5.4 & Node.js 20+**:
   * *Nơi sử dụng*: Toàn bộ 14 packages, apps và services trong repository.
   * *Giải quyết vấn đề*: Cung cấp hệ thống kiểm tra kiểu dữ liệu tĩnh nghiêm ngặt (Strict Mode), giảm thiểu lỗi runtime TypeError, chuẩn hóa mô hình lập trình bất đồng bộ hiện đại.
2. **Next.js 14 (App Router) & React 18**:
   * *Nơi sử dụng*: `apps/frontend`.
   * *Giải quyết vấn đề*: Tối ưu hóa SEO cho các sản phẩm nông nghiệp thông qua Server-Side Rendering (SSR) và sinh Sitemap động; cung cấp trải nghiệm mượt mà cho cả người mua (Storefront) và quản trị viên (Admin Portal).
3. **NestJS 10**:
   * *Nơi sử dụng*: `apps/api-gateway` và 6 backend microservices (`services/*`).
   * *Giải quyết vấn đề*: Cung cấp kiến trúc module hóa hướng đối tượng vững chắc (IoC/DI), chuẩn hóa Middleware, Exception Filters, Interceptors, Pipes và Guards trên toàn hệ thống.
4. **Prisma ORM 5.15.0**:
   * *Nơi sử dụng*: 6 microservices backend nghiệp vụ.
   * *Giải quyết vấn đề*: Đảm bảo Type-safety từ tầng database schema đến mã nguồn TypeScript, sinh migration SQL tự động, hỗ trợ truy vấn raw `$queryRaw` cho các transaction khóa bi quan phức tạp.
5. **MySQL 8.0**:
   * *Nơi sử dụng*: Cơ sở dữ liệu chính của hệ thống (port 3307 trên host, 3306 nội bộ).
   * *Giải quyết vấn đề*: Lưu trữ dữ liệu quan hệ ACID vững chắc, hỗ trợ bảng mã tiếng Việt `utf8mb4_unicode_ci`, múi giờ chuẩn Việt Nam `+07:00` và tính năng khóa hàng `FOR UPDATE`.
6. **MinIO Object Storage**:
   * *Nơi sử dụng*: `services/product-service` (quản lý ảnh bao bì sản phẩm) và `services/content-service` (quản lý ảnh bài viết và banner).
   * *Giải quyết vấn đề*: Tương thích hoàn toàn chuẩn AWS S3 API, tách rời lưu trữ nhị phân (ảnh) khỏi cơ sở dữ liệu quan hệ, giúp database duy trì kích thước gọn nhẹ và sao lưu nhanh chóng.
7. **Nginx 1.27 Alpine**:
   * *Nơi sử dụng*: Cổng vào công cộng duy nhất (cổng 80/443).
   * *Giải quyết vấn đề*: Đóng vai trò L7 Ingress Reverse Proxy, nén Gzip tĩnh và động, gán Security Headers, phân phối lưu lượng giữa Frontend SSR và API Gateway, hỗ trợ DNS dynamic resolving chống sập khi container khởi động.

---

## 8. System Architecture (Kiến Trúc Tổng Thể Hệ Thống)

PhanBonShop được xây dựng dựa trên nguyên tắc **Microservices Architecture**:
* **Phân tách ranh giới nghiệp vụ (Bounded Contexts)**: Mỗi dịch vụ chịu trách nhiệm độc quyền cho một miền nghiệp vụ riêng biệt.
* **Database-per-Service**: Mỗi microservice sở hữu một cơ sở dữ liệu logic độc lập trong cụm MySQL (`auth_db`, `product_db`, `order_db`, `inventory_db`, `customer_db`, `content_db`). Tuyệt đối không có truy vấn chéo (cross-database queries) giữa các dịch vụ.
* **API Gateway Pattern**: Ứng dụng client (Browser/Mobile) không gọi trực tiếp vào các microservices bên trong mà đi qua một điểm tiếp nhận duy nhất là API Gateway (thông qua Nginx Reverse Proxy).
* **Bảo vệ giao tiếp nội bộ (Internal Service Mesh Security)**: Các API nội bộ (`/internal/v1/*`) được bảo vệ bằng header bí mật `X-Internal-Secret`, xác thực bằng thuật toán constant-time comparison, và bị API Gateway loại bỏ triệt để nếu có client bên ngoài cố tình gửi vào.

---

## 9. Architecture Diagram (Sơ Đồ Kiến Trúc Hệ Thống)

```mermaid
flowchart TB
    subgraph Clients["Trình Duyệt & Thiết Bị Người Dùng"]
        Browser["Khách Hàng & Quản Trị Viên (Web Browser)"]
    end

    subgraph EdgeLayer["Tầng Ingress & Reverse Proxy"]
        Nginx["Nginx Reverse Proxy (Port 80/443)"]
    end

    subgraph ApplicationLayer["Tầng Ứng Dụng Monorepo"]
        Frontend["Next.js 14 Frontend (Port 3000)"]
        Gateway["NestJS API Gateway (Port 8080)"]
    end

    subgraph MicroservicesLayer["Tầng Dịch Vụ Nghiệp Vụ (Microservices)"]
        AuthSvc["Auth Service\n(Port 3001)"]
        ProductSvc["Product Service\n(Port 3002)"]
        OrderSvc["Order Service\n(Port 3003)"]
        InventorySvc["Inventory Service\n(Port 3004)"]
        CustomerSvc["Customer Service\n(Port 3005)"]
        ContentSvc["Content Service\n(Port 3006)"]
    end

    subgraph DataLayer["Tầng Dữ Liệu & Hạ Tầng Lưu Trữ"]
        DB_Auth[("auth_db (MySQL)")]
        DB_Product[("product_db (MySQL)")]
        DB_Order[("order_db (MySQL)")]
        DB_Inventory[("inventory_db (MySQL)")]
        DB_Customer[("customer_db (MySQL)")]
        DB_Content[("content_db (MySQL)")]
        MinIO["MinIO Object Storage (Port 9000/9001)"]
        Redis["Redis 7 (Port 6379 - Infra Ready)"]
    end

    %% Client routing
    Browser -->|HTTP Requests| Nginx
    Nginx -->|Route /*| Frontend
    Nginx -->|Route /api/*| Gateway

    %% Frontend calling Gateway
    Frontend -.->|API Requests| Gateway

    %% Gateway forwarding
    Gateway -->|/api/v1/auth/*| AuthSvc
    Gateway -->|/api/v1/products/*, /categories/*, /brands/*, /reviews/*| ProductSvc
    Gateway -->|/api/v1/orders/*, /cart/*, /checkout/*, /coupons/*, /payments/*| OrderSvc
    Gateway -->|/api/v1/inventory/*| InventorySvc
    Gateway -->|/api/v1/customers/*| CustomerSvc
    Gateway -->|/api/v1/posts/*, /banners/*| ContentSvc

    %% Database Ownership (Strict Database per Service)
    AuthSvc --> DB_Auth
    ProductSvc --> DB_Product
    OrderSvc --> DB_Order
    InventorySvc --> DB_Inventory
    CustomerSvc --> DB_Customer
    ContentSvc --> DB_Content

    %% Object Storage
    ProductSvc -->|Upload/Delete Product Images| MinIO
    ContentSvc -->|Upload/Delete Post & Banner Images| MinIO
```

---

## 10. Monorepo Architecture (Kiến Trúc Monorepo)

Hệ thống sử dụng cơ chế **npm Workspaces** bản địa, được khai báo tại file gốc `package.json`:

```json
"workspaces": [
  "packages/*",
  "services/*",
  "apps/*"
]
```

### Lợi Ích Đối Với Dự Án:
1. **Chia sẻ Type-safe hợp đồng (Contracts Sharing)**: Package `@phanbonshop/shared-types` định nghĩa DTOs, Enums và Interfaces chung, giúp Frontend và Backend đồng nhất định dạng dữ liệu mà không sợ lệch pha.
2. **Cấu hình chuẩn hóa tập trung**: Mọi thay đổi trong `@phanbonshop/tsconfig` hoặc `@phanbonshop/eslint-config` đều được tự động áp dụng đồng loạt cho 8 ứng dụng và dịch vụ.
3. **Tiết kiệm tài nguyên ổ đĩa**: npm thực hiện cơ chế hoisting các dependencies phổ biến (`typescript`, `@types/node`, `eslint`) lên thư mục `node_modules` ở thư mục gốc.
4. **Quy trình Build có trật tự phụ thuộc**: Script `npm run build` tự động biên dịch các thư viện nền tảng (`packages/*`) trước, sau đó mới biên dịch các dịch vụ thực thi.

---

## 11. Project Structure (Cấu Trúc Thư Mục Thực Tế)

Dưới đây là cấu trúc thư mục thực tế của repository (đã loại bỏ các thư mục sinh ra khi build như `node_modules`, `dist`, `.next`):

```text
phanbonshop/
├── apps/
│   ├── api-gateway/                 # Ứng dụng API Gateway (NestJS)
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── auth-proxy/          # Forwarding /api/v1/auth/*
│   │       ├── cart-proxy/          # Forwarding /api/v1/cart/*
│   │       ├── product-proxy/       # Forwarding /api/v1/products, categories, brands, reviews
│   │       ├── order-proxy/         # Forwarding /api/v1/orders, checkout, coupons, payments
│   │       ├── inventory-proxy/     # Forwarding /api/v1/inventory & /internal/v1/inventory
│   │       ├── customer-proxy/      # Forwarding /api/v1/customers
│   │       ├── content-proxy/       # Forwarding /api/v1/posts, banners
│   │       ├── common/              # Middlewares (request-id, internal-guard), filters, interceptors
│   │       ├── health/              # /health & /ready probes
│   │       └── main.ts
│   └── frontend/                    # Web Storefront & Admin Portal (Next.js 14)
│       ├── Dockerfile
│       ├── package.json
│       ├── next.config.mjs
│       ├── tailwind.config.ts
│       └── src/
│           ├── app/
│           │   ├── (auth)/          # Đăng nhập (/dang-nhap), Đăng ký (/dang-ky)
│           │   ├── (customer)/      # Trang chủ, Sản phẩm (/san-pham), Danh mục, Tài khoản
│           │   └── admin/           # Quản trị sản phẩm, đơn hàng, kho bãi, bài viết, banner
│           ├── components/          # UI components (Header, Footer, CartDrawer, ProductCard)
│           ├── contexts/            # React Contexts (auth-context, cart-context)
│           └── lib/                 # API Client, formatters (VND, ngày tháng)
├── services/
│   ├── auth-service/                # Quản lý tài khoản, JWT, RBAC
│   │   ├── Dockerfile
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # Database: auth_db
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   └── src/ (auth, email, health, prisma)
│   ├── product-service/             # Quản lý danh mục, sản phẩm, quy cách NPK, MinIO
│   │   ├── Dockerfile
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # Database: product_db
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   └── src/ (product, category, brand, reviews, minio, health)
│   ├── order-service/               # Giỏ hàng, Checkout Saga, Đơn hàng, Thanh toán
│   │   ├── Dockerfile
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # Database: order_db
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── test/
│   │   │   └── order.unit.test.mjs  # Unit test giỏ hàng, giảm giá, state machine
│   │   └── src/ (orders, checkout, cart, coupons, payments, compensation)
│   ├── inventory-service/           # Tồn kho, Khóa bi quan FOR UPDATE, Sổ cái
│   │   ├── Dockerfile
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # Database: inventory_db
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── test/
│   │   │   └── inventory.unit.test.mjs # Unit test tính khả dụng & mức cảnh báo tồn
│   │   └── src/ (inventory, health)
│   ├── customer-service/            # Hồ sơ khách hàng, sổ địa chỉ, dữ liệu hành chính VN
│   │   ├── Dockerfile
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # Database: customer_db
│   │   │   └── migrations/
│   │   └── src/ (customer, health)
│   └── content-service/             # Cẩm nang kỹ thuật bón phân, banner quảng cáo
│       ├── Dockerfile
│       ├── prisma/
│       │   ├── schema.prisma        # Database: content_db
│       │   └── migrations/
│       └── src/ (posts, banners, minio, health)
├── packages/
│   ├── tsconfig/                    # Shared TypeScript configs
│   ├── eslint-config/               # Shared ESLint rules
│   ├── shared-types/                # Shared interfaces, contracts & enums
│   ├── shared-utils/                # Utilities: formatVND, toVietnameseSlug, validatePhone
│   │   └── test/utils.test.mjs      # Unit test 8 cases
│   ├── config/                      # Validate biến môi trường, canonical ports, timingSafeCompare
│   └── logger/                      # Structured logger masking thông tin nhạy cảm
├── docker/
│   ├── Dockerfile.backend           # Base Dockerfile tham số hóa cho các dịch vụ
│   ├── Dockerfile.migrate           # Container một lần chạy migration tự động
│   ├── mysql/init.sql               # Script khởi tạo 6 logical databases & quyền
│   └── nginx/                       # Cấu hình reverse proxy & load balancer
├── .github/workflows/ci.yml         # CI/CD Pipeline 5 jobs tự động hóa
├── scripts/
│   ├── prisma-validate.mjs          # Kiểm tra tính hợp lệ của 6 schema Prisma
│   └── migrate-deploy.mjs           # Chạy prisma migrate deploy an toàn
├── docker-compose.yml               # Cấu hình phát triển (Infrastructure + App Services)
├── docker-compose.prod.yml          # Cấu hình triển khai Production (Phân lập mạng nội bộ)
├── .env.example                     # Mẫu biến môi trường chuẩn
└── package.json                     # Root orchestrator scripts
```

---

## 12. Components Overview (Chi Tiết Các Ứng Dụng & Dịch Vụ)

### 12.1. Frontend Storefront & Admin Portal
* **Đường dẫn**: `apps/frontend`
* **Công nghệ**: Next.js 14.2.24 (App Router), React 18.3.1, Tailwind CSS 3.4, React Hook Form, Zod.
* **Cấu trúc tuyến đường (Routing)**:
  * Phân hệ Khách hàng (`src/app/(customer)`): Trang chủ (`page.tsx`), Danh mục (`danh-muc/[slug]`), Thương hiệu (`thuong-hieu/[slug]`), Danh sách & chi tiết sản phẩm (`san-pham`, `san-pham/[slug]`), Tìm kiếm (`tim-kiem`), Cẩm nang nông nghiệp (`kien-thuc`), Trang tài khoản & sổ địa chỉ cá nhân (`tai-khoan`).
  * Phân hệ Xác thực (`src/app/(auth)`): Đăng nhập (`dang-nhap`), Đăng ký tài khoản (`dang-ky`).
  * Phân hệ Quản trị (`src/app/admin`): Tổng quan báo cáo Dashboard, Quản lý sản phẩm, Danh mục, Thương hiệu, Đơn hàng, Khách hàng, Kho hàng & Tồn kho, Mã giảm giá, Bài viết, Banner.
* **Quản lý trạng thái (State Management)**:
  * `auth-context.tsx`: Lưu trữ phiên người dùng, đồng bộ token qua LocalStorage/Cookies.
  * `cart-context.tsx`: Quản lý giỏ hàng cục bộ, hỗ trợ thêm, cập nhật số lượng, xóa món hàng và tính tổng tạm tính.
  * `cart-drawer.tsx`: Giao diện giỏ hàng dạng ngăn kéo trượt (Slide-out Drawer).

### 12.2. API Gateway
* **Đường dẫn**: `apps/api-gateway`
* **Cổng mặc định**: `8080` (Canonical: `CANONICAL_PORTS.GATEWAY`)
* **Trách nhiệm chính**:
  * Đơn điểm tiếp nhận (Single Point of Contact) cho toàn bộ API hệ thống.
  * Định tuyến và chuyển tiếp các yêu cầu HTTP (Reverse Proxy) tới đúng microservice đích qua `fetch()`.
  * Gán và luân chuyển mã định danh yêu cầu `X-Request-ID` qua `RequestIdMiddleware`.
  * Bảo vệ Ingress qua `InternalGuardMiddleware`: Chặn các cuộc gọi ngoài cố tình truy cập vào prefix `/internal/*` nếu không có `X-Internal-Secret` hợp lệ, đồng thời xóa bỏ header `x-internal-secret` do client công khai gửi lên để chống giả mạo.
  * Giới hạn tần suất gọi API (Rate Limiting) với `@nestjs/throttler` (Mặc định 100 requests / 60 giây).
  * Bảo mật tiêu đề HTTP với `helmet` và cấu hình `CORS` theo whitelist tên miền.

### 12.3. Auth Service
* **Đường dẫn**: `services/auth-service`
* **Cổng mặc định**: `3001` (Canonical: `CANONICAL_PORTS.AUTH_SERVICE`)
* **Cơ sở dữ liệu sở hữu**: `auth_db`
* **Trách nhiệm chính**:
  * Đăng ký tài khoản khách hàng mới, kiểm tra trùng lặp email và số điện thoại.
  * Mã hóa mật khẩu một chiều bằng thuật toán `bcrypt` với cost factor 12.
  * Đăng nhập xác thực và cấp phát cặp token: Access Token (JWT thời hạn ngắn) và Refresh Token (JWT thời hạn 7 ngày).
  * **Đăng nhập bằng Gmail thật (Google Identity Services)**: Xác minh ID token từ Google bằng thư viện chính thức `google-auth-library`, trích xuất `sub` (định danh Google duy nhất), liên kết tài khoản qua bảng `external_identities` (Prisma model). Chống tạo trùng tài khoản khi cùng một người dùng Google đăng nhập đồng thời hoặc nhiều lần. Hỗ trợ tự động tạo tài khoản mới nếu chưa tồn tại (auto-register).
  * Refresh Token Rotation: Lưu trữ SHA-256 hash của Refresh Token trong bảng `refresh_token_sessions`; khi refresh, thu hồi token cũ ngay lập tức và cấp cặp token mới.
  * Phát hiện tái sử dụng token (Reuse Detection): Từ chối các token đã có `revokedAt`.
  * Đăng xuất phiên hiện tại hoặc đăng xuất toàn bộ thiết bị (`logoutAll`).

### 12.4. Product Service
* **Đường dẫn**: `services/product-service`
* **Cổng mặc định**: `3002` (Canonical: `CANONICAL_PORTS.PRODUCT_SERVICE`)
* **Cơ sở dữ liệu sở hữu**: `product_db`
* **Trách nhiệm chính**:
  * Quản lý danh mục sản phẩm hỗ trợ cây phân cấp cha-con (`Category`).
  * Quản lý thương hiệu vật tư nông nghiệp (`Brand`).
  * Quản lý thông tin chi tiết sản phẩm phân bón: thành phần hóa học, hướng dẫn bón lót/bón thúc, bảo quản, an toàn sử dụng.
  * Quản lý các biến thể quy cách bao bì (`ProductVariant`): bao 25kg, bao 50kg, chai 1 lít, can 5 lít, kèm giá niêm yết chính thức.
  * Gán nhãn thuộc tính canh tác chuyên sâu (`AgriculturalAttribute`): Cây trồng (CROP), Giai đoạn sinh trưởng (GROWTH_STAGE), Phương thức bón (APPLICATION_METHOD), Nhóm dinh dưỡng (NUTRIENT_TYPE).
  * Quản lý hình ảnh với MinIO S3 bucket `product-images`.
  * Quản lý đánh giá sản phẩm (`Review`), kết nối qua service mesh tới `order-service` để tự động xác nhận đánh giá của người đã mua hàng (`verifiedPurchase`).

### 12.5. Order Service
* **Đường dẫn**: `services/order-service`
* **Cổng mặc định**: `3003` (Canonical: `CANONICAL_PORTS.ORDER_SERVICE`)
* **Cơ sở dữ liệu sở hữu**: `order_db`
* **Trách nhiệm chính**:
  * Quản lý giỏ hàng lưu trữ máy chủ (`Cart` và `CartItem`).
  * Bộ điều phối đặt hàng phân tán (`CheckoutService` - Saga Orchestrator): Chống sửa giá client, thẩm định mã giảm giá, tính phí vận chuyển theo vùng miền Việt Nam, tạm giữ kho, tạo đơn, tạo thanh toán và kích hoạt bồi hoàn nếu gặp lỗi.
  * Cơ chế Idempotency với bảng `idempotency_records` và in-memory locking.
  * Quản lý vòng đời đơn hàng (`OrdersService`) tuân thủ nghiêm ngặt State Machine 11 trạng thái.
  * Quản lý thanh toán (`PaymentsService`): Hỗ trợ COD và Chuyển khoản ngân hàng (VietQR).
  * Outbox bồi hoàn phân tán (`CompensationService`) lưu vào bảng `compensation_tasks` để tự động giải phóng kho khi gặp sự cố.

### 12.6. Inventory Service
* **Đường dẫn**: `services/inventory-service`
* **Cổng mặc định**: `3004` (Canonical: `CANONICAL_PORTS.INVENTORY_SERVICE`)
* **Cơ sở dữ liệu sở hữu**: `inventory_db`
* **Trách nhiệm chính**:
  * Quản lý số lượng tồn kho vật lý (`stockQuantity`) và số lượng đang bị tạm giữ (`reservedQuantity`).
  * Kiểm soát đồng thời và chống bán quá tồn (Anti-Overselling) bằng Khóa bi quan `SELECT ... FOR UPDATE`.
  * Tạm giữ tồn kho (`reserve`) với thời hạn TTL (mặc định 15 phút).
  * Giải phóng tồn kho (`release`) khi đơn hàng bị hủy hoặc quá trình thanh toán thất bại.
  * Xuất kho thực tế (`commit`) khi đơn hàng chuyển sang trạng thái hoàn tất (`COMPLETED`).
  * Điều chỉnh tồn kho kiểm kê thủ công (`adjust`) dành cho quản trị viên và thủ kho.
  * Ghi nhận sổ cái biến động kho chi tiết (`InventoryMovement`) cho từng lượt thay đổi.

### 12.7. Customer Service
* **Đường dẫn**: `services/customer-service`
* **Cổng mặc định**: `3005` (Canonical: `CANONICAL_PORTS.CUSTOMER_SERVICE`)
* **Cơ sở dữ liệu sở hữu**: `customer_db`
* **Trách nhiệm chính**:
  * Quản lý hồ sơ cá nhân của khách hàng (`CustomerProfile`), liên kết logic với `userId` từ `auth-service`.
  * Quản lý sổ địa chỉ nhận hàng (`Address`), hỗ trợ thiết lập địa chỉ mặc định.
  * Cung cấp bộ dữ liệu hành chính Tỉnh / Thành phố / Quận / Huyện / Phường / Xã Việt Nam cục bộ (`VIETNAM_DIVISIONS`).
  * API nội bộ (`/internal/v1/customers/:userId/addresses/:addressId`) phục vụ `order-service` tra cứu thông tin giao hàng an toàn, ngăn chặn lỗi IDOR (Insecure Direct Object Reference).

### 12.8. Content Service
* **Đường dẫn**: `services/content-service`
* **Cổng mặc định**: `3006` (Canonical: `CANONICAL_PORTS.CONTENT_SERVICE`)
* **Cơ sở dữ liệu sở hữu**: `content_db`
* **Trách nhiệm chính**:
  * Quản lý các bài viết cẩm nang kỹ thuật canh tác nông nghiệp, hướng dẫn phòng trừ sâu bệnh (`Post`).
  * Quản lý các banner quảng cáo, chương trình khuyến mãi theo mùa vụ (`Banner`).
  * Upload và lưu trữ ảnh bìa bài viết và banner lên MinIO S3 bucket `content-images`.

---

## 13. Shared Packages (Thư Viện Dùng Chung)

Các thư viện nền tảng được đặt trong thư mục `packages/` và đóng vai trò xương sống kiến trúc:

| Package | Trách Nhiệm Kỹ Thuật | Phụ Thuộc Chính |
| :--- | :--- | :--- |
| `@phanbonshop/shared-types` | Chứa toàn bộ Data Contracts, Enums (`UserRole`, `ActiveStatus`), Interfaces phân trang (`PaginationQuery`, `PaginationMeta`), Response wrapper (`ApiResponse`, `ApiErrorResponse`), Domain Types (`MoneyVND`, `AddressVN`). Hoàn toàn độc lập, không dính líu đến ORM. | Không có |
| `@phanbonshop/shared-utils` | Tiện ích thuần: Định dạng tiền Việt Nam (`formatVND`), sinh slug SEO tiếng Việt có dấu (`toVietnameseSlug`), kiểm tra và chuẩn hóa số điện thoại di động Việt Nam (`isValidVNPhoneNumber`, `normalizeVNPhoneNumber`), danh mục phân cấp hành chính 63 tỉnh thành Việt Nam. Được kiểm chuẩn bằng 8 unit tests. | Không có |
| `@phanbonshop/config` | Bộ xử lý biến môi trường an toàn: Chuẩn hóa cổng canonical (`CANONICAL_PORTS`), hàm so sánh chuỗi bảo vệ chống tấn công thời gian (`timingSafeCompare`), hàm kiểm chuẩn môi trường khi khởi động (`validateStartupEnv`) giúp fail-fast nếu thiếu biến hoặc phát hiện dùng mật khẩu mặc định trên production. | `node:crypto` |
| `@phanbonshop/logger` | Structured Logger dựa trên tiêu chuẩn JSON, tự động ẩn (mask) các trường nhạy cảm (`password`, `token`, `secret`, `authorization`, `cookie`, `refreshToken`), ghi nhận ngữ cảnh `requestId` và hỗ trợ các cấp độ log (`info`, `warn`, `error`, `debug`). | Không có |
| `@phanbonshop/tsconfig` | Bộ cấu hình TypeScript Strict Mode kế thừa chung (`tsconfig.base.json`, `tsconfig.node.json`, `tsconfig.next.json`), bật toàn bộ các cờ an toàn kiểu dữ liệu. | `typescript` |
| `@phanbonshop/eslint-config` | Quy chuẩn cú pháp mã nguồn dùng chung cho toàn monorepo, tích hợp Prettier và TypeScript-ESLint. | `eslint` |

---

## 14. Database Architecture (Kiến Trúc Cơ Sở Dữ Liệu)

Hệ thống tuân thủ nguyên tắc **Database-per-Service** với 6 cơ sở dữ liệu logic độc lập cùng chạy trên cụm MySQL 8.0:

| Cơ Sở Dữ Liệu | Dịch Vụ Sở Hữu | Các Bảng Chính (Tables) | Trách Nhiệm Nghiệp Vụ |
| :--- | :--- | :--- | :--- |
| `auth_db` | `auth-service` | `users`, `refresh_token_sessions`, `password_reset_tokens`, `audit_logs` | Quản lý danh tính, tài khoản, mật khẩu băm, phiên token JWT và lịch sử đăng nhập |
| `product_db` | `product-service` | `categories`, `brands`, `products`, `product_variants`, `product_images`, `agricultural_attributes`, `reviews`, `audit_logs` | Quản lý danh mục, thương hiệu, sản phẩm phân bón, quy cách bao bì, thuộc tính cây trồng và đánh giá |
| `order_db` | `order-service` | `carts`, `cart_items`, `orders`, `order_items`, `order_shipping_addresses`, `order_status_history`, `coupons`, `coupon_usages`, `idempotency_records`, `payment_records`, `payment_audit_logs`, `compensation_tasks`, `audit_logs` | Quản lý giỏ hàng, vòng đời đơn hàng, địa chỉ giao hàng, mã giảm giá, bản ghi idempotency, thanh toán và bồi hoàn Saga |
| `inventory_db` | `inventory-service` | `inventory`, `inventory_reservations`, `inventory_movements`, `audit_logs` | Quản lý số lượng tồn vật lý, số lượng tạm giữ, các phiên đặt giữ có hạn và sổ cái biến động kho |
| `customer_db` | `customer-service` | `customer_profiles`, `customer_addresses` | Quản lý thông tin cá nhân khách hàng và danh bạ địa chỉ nhận hàng giao tận ruộng/nhà |
| `content_db` | `content-service` | `posts`, `banners` | Quản lý bài viết kiến thức nông học và banner quảng bá khuyến mãi |

---

## 15. Domain Model (Mô Hình Nghiệp Vụ & Thực Thể Dữ Liệu)

Dưới đây là mô hình chi tiết các thực thể dữ liệu cốt lõi phản ánh chính xác từ các file `schema.prisma`:

### 15.1. Phân Hệ Xác Thực (`auth_db`)
* **User**: Khóa chính `id` (UUID), `email` (Unique), `passwordHash` (Bcrypt 12), `fullName`, `phone` (Unique), `role` (`CUSTOMER`, `STAFF`, `WAREHOUSE`, `MANAGER`, `ADMIN`, `SUPER_ADMIN`), `status` (`ACTIVE`, `INACTIVE`, `LOCKED`, `SUSPENDED`), `lastLoginAt`.
* **RefreshTokenSession**: Khóa chính `id`, `userId` (FK -> User Cascade), `tokenHash` (SHA-256 Unique), `deviceInfo`, `ipAddress`, `expiresAt`, `revokedAt`.

### 15.2. Phân Hệ Sản Phẩm (`product_db`)
* **Category**: Khóa chính `id`, `name`, `slug` (Unique), `parentId` (FK -> Category tự tham chiếu SetNull), `status` (`ACTIVE`, `INACTIVE`), `sortOrder`.
* **Brand**: Khóa chính `id`, `name`, `slug` (Unique), `logoUrl`, `status`.
* **Product**: Khóa chính `id`, `name`, `slug` (Unique), `sku` (Unique), `composition` (Thành phần hóa học N-P-K), `usageInstructions` (Cách bón), `storageInstructions` (Bảo quản), `brandId` (FK), `categoryId` (FK), `price` (Decimal 12,2), `compareAtPrice`, `status` (`DRAFT`, `ACTIVE`, `OUT_OF_STOCK`, `DISCONTINUED`, `ARCHIVED`), `featured`, `bestSeller`.
* **ProductVariant**: Khóa chính `id`, `productId` (FK -> Product Cascade), `sku` (Unique), `unit` (Bao/Chai/Can), `packageSize` (50kg, 25kg, 1L, 5L), `price` (Decimal 12,2), `status` (`ACTIVE`, `INACTIVE`, `OUT_OF_STOCK`).
* **AgriculturalAttribute**: Khóa chính `id`, `productId` (FK), `attributeType` (`CROP`, `GROWTH_STAGE`, `APPLICATION_METHOD`, `NUTRIENT_TYPE`), `value` (Ví dụ: "Lúa", "Bón lót", "NPK"). Ràng buộc duy nhất `@@unique([productId, attributeType, value])`.
* **Review**: Khóa chính `id`, `customerId`, `productId` (FK), `orderItemId`, `rating` (1-5), `comment`, `status` (`PENDING`, `APPROVED`, `REJECTED`), `verifiedPurchase` (Boolean).

### 15.3. Phân Hệ Đơn Hàng & Thanh Toán (`order_db`)
* **Order**: Khóa chính `id`, `orderNumber` (Định dạng: `DH-YYYYMMDD-XXXXXX` Unique), `customerId`, `status` (`OrderStatus`), `paymentStatus` (`PaymentStatus`), `paymentMethod` (`COD`, `BANK_TRANSFER`, `VNPAY`, `MOMO`, `DEBT_PERIOD`), `subtotal`, `discountAmount`, `shippingFee`, `totalAmount` (Decimal 12,2), `couponCode`, `reservationId`.
* **OrderItem**: Khóa chính `id`, `orderId` (FK -> Order Cascade), `productId`, `variantId`, `productName`, `variantName`, `sku`, `unitPrice`, `quantity`, `lineTotal`.
* **OrderShippingAddress**: Khóa chính `id`, `orderId` (FK Unique), `recipientName`, `phone`, `provinceCode`, `provinceName`, `districtCode`, `districtName`, `wardCode`, `wardName`, `addressLine`.
* **OrderStatusHistory**: Khóa chính `id`, `orderId` (FK), `fromStatus`, `toStatus`, `changedBy`, `note`, `createdAt`.
* **Coupon**: Khóa chính `id`, `code` (Unique), `type` (`PERCENTAGE`, `FIXED_AMOUNT`, `FREE_SHIPPING`), `value`, `minOrderAmount`, `maxDiscountAmount`, `enabled`, `startDate`, `endDate`, `usageLimit`, `usedCount`.
* **IdempotencyRecord**: Khóa chính `id`, `customerId`, `idempotencyKey`, `requestPath`, `requestHash`, `status` (`PROCESSING`, `COMPLETED`, `FAILED`), `responseBody` (JSON LongText), `statusCode`, `orderId`. Ràng buộc `@@unique([customerId, idempotencyKey])`.
* **PaymentRecord**: Khóa chính `id`, `orderId` (FK), `provider`, `method`, `amount`, `status`, `transactionReference`, `paidAt`, `metadata`.
* **CompensationTask**: Khóa chính `id`, `type` (`RELEASE_INVENTORY`), `payload` (JSON LongText), `status` (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`), `retryCount`, `maxRetries` (5), `nextAttemptAt`, `lastError`.

### 15.4. Phân Hệ Tồn Kho (`inventory_db`)
* **Inventory**: Khóa chính `id`, `productId`, `variantId` (Unique), `stockQuantity` (Số lượng vật lý), `reservedQuantity` (Số lượng tạm giữ), `reorderLevel` (Ngưỡng cảnh báo hết hàng, mặc định 5).
* **InventoryReservation**: Khóa chính `id`, `reservationId` (Unique), `variantId`, `quantity`, `referenceType` (ORDER), `referenceId`, `status` (`ACTIVE`, `RELEASED`, `COMMITTED`, `EXPIRED`), `expiresAt`.
* **InventoryMovement**: Khóa chính `id`, `productId`, `variantId`, `type` (`PURCHASE`, `SALE`, `RETURN`, `ADJUSTMENT`, `DAMAGED`, `RESERVATION`, `RELEASE_RESERVATION`, `CANCELLED_ORDER`), `quantity`, `stockBefore`, `stockAfter`, `reservedBefore`, `reservedAfter`, `reason`, `referenceId`, `performedBy`, `requestId`.

### 15.5. Phân Hệ Khách Hàng (`customer_db`)
* **CustomerProfile**: Khóa chính `id`, `userId` (Unique - liên kết logic với auth-service), `fullName`, `phone`, `avatarUrl`.
* **Address**: Khóa chính `id`, `customerId` (FK -> CustomerProfile Cascade), `recipientName`, `phone`, `provinceCode`, `provinceName`, `districtCode`, `districtName`, `wardCode`, `wardName`, `addressLine`, `isDefault`.

---

## 16. Service Communication (Giao Tiếp Giữa Các Dịch Vụ)

Hệ thống giao tiếp nội bộ thông qua HTTP/REST đồng bộ kết hợp cơ chế Outbox Task để đảm bảo tính nhất quán cuối cùng:

```mermaid
flowchart LR
    subgraph Gateway["API Gateway"]
        GW["apps/api-gateway"]
    end

    subgraph OrderSvc["order-service"]
        Order["Order & Checkout"]
        Comp["Compensation Outbox"]
    end

    subgraph ProductSvc["product-service"]
        Product["Catalog & Reviews"]
    end

    subgraph InventorySvc["inventory-service"]
        Inventory["Stock & Reservations"]
    end

    subgraph CustomerSvc["customer-service"]
        Customer["Customer Profile"]
    end

    %% Ingress routing
    GW --> Order
    GW --> Product
    GW --> Inventory
    GW --> Customer

    %% Checkout Orchestration
    Order -->|1. GET /api/v1/products/:id\n(Kiểm tra giá niêm yết)| Product
    Order -->|2. GET /internal/v1/customers/.../addresses/...\n(Lấy địa chỉ giao hàng)| Customer
    Order -->|3. POST /internal/v1/inventory/reserve\n(Tạm giữ hàng qua FOR UPDATE)| Inventory
    Order -->|4. (Nếu lỗi) POST /internal/v1/inventory/release\n(Bồi hoàn giải phóng kho)| Inventory
    Comp -->|Retry giải phóng kho thất bại| Inventory

    %% Review Verification
    Product -->|GET /internal/v1/orders/verify-purchase\n(Kiểm tra đơn hàng hoàn tất)| Order

    %% Customer Summary
    Customer -->|GET /internal/v1/orders/customer-summary/:id\n(Thống kê chi tiêu)| Order
```

---

## 17. Core Business Flows (Các Luồng Nghiệp Vụ Chính)

### 17.1. Chu trình Xác thực & Phiên Đăng Nhập

```mermaid
sequenceDiagram
    autonumber
    actor U as Người Dùng
    participant G as API Gateway
    participant A as Auth Service
    participant DB as auth_db

    U->>G: POST /api/v1/auth/login { email, password }
    G->>A: Forward request
    A->>DB: Tìm User theo email
    DB-->>A: Bản ghi User & passwordHash
    A->>A: Kiểm tra mật khẩu (bcrypt.compare)
    A->>A: Sinh Access Token (15-60m) & Refresh Token (7d)
    A->>DB: Lưu SHA-256 hash của Refresh Token vào refresh_token_sessions
    A-->>G: Trả về { user, accessToken, refreshToken }
    G-->>U: Trả về kết quả đăng nhập

    Note over U,DB: Khi Access Token hết hạn:
    U->>G: POST /api/v1/auth/refresh { refreshToken }
    G->>A: Forward request
    A->>DB: Tìm session theo tokenHash
    alt Token đã bị thu hồi (revokedAt != null)
        A-->>G: 401 Unauthorized (Phát hiện token reuse)
        G-->>U: Buộc đăng nhập lại
    else Token hợp lệ
        A->>DB: Đánh dấu revokedAt = now() (Thu hồi token cũ)
        A->>A: Cấp phát cặp tokens mới
        A->>DB: Tạo bản ghi session mới
        A-->>G: Trả về cặp tokens mới
        G-->>U: Cập nhật token thành công
    end
```

### 17.2. Tìm kiếm, Duyệt & Quản lý Danh Mục Sản Phẩm
1. **Khách hàng** truy cập trang chủ hoặc danh mục:
   * Next.js Server Components gửi request tới `GET /api/v1/products` kèm bộ lọc (`categoryId`, `brandId`, `minPrice`, `maxPrice`, `crop`, `growthStage`).
   * `product-service` thực hiện truy vấn tối ưu với Prisma, áp dụng phân trang (`page`, `limit`) và trả về danh sách sản phẩm kèm ảnh chính và khoảng giá các biến thể.
2. **Quản trị viên** tạo sản phẩm:
   * Gửi `POST /api/v1/products` với thông tin sản phẩm và các biến thể quy cách bao bì.
   * Upload hình ảnh qua `POST /api/v1/products/:id/images/upload` (lưu file trực tiếp lên MinIO S3 bucket `product-images` và lưu URL cùng `objectKey` vào database).
   * Mọi thao tác đổi giá hoặc xóa sản phẩm đều tự động sinh bản ghi trong bảng `audit_logs`.

### 17.3. Quản lý Giỏ Hàng
* Người dùng chọn quy cách đóng gói (ví dụ: Bao 50kg) và số lượng.
* Frontend cập nhật giỏ hàng cục bộ trong `cart-context.tsx` đồng thời đồng bộ về máy chủ qua `POST /api/v1/cart/items`.
* Dữ liệu giỏ hàng được lưu trong bảng `carts` và `cart_items` tại `order_db`, đảm bảo giỏ hàng không bị mất khi chuyển đổi thiết bị.

### 17.4. Quy trình Đặt Hàng & Checkout Orchestration

Quá trình Checkout được điều phối tập trung bởi `CheckoutService` trong `order-service`:

```mermaid
sequenceDiagram
    autonumber
    actor C as Khách Hàng
    participant G as API Gateway
    participant O as Order Service (Saga Orchestrator)
    participant P as Product Service
    participant Cust as Customer Service
    participant I as Inventory Service
    participant ODB as order_db

    C->>G: POST /api/v1/checkout (Header: Idempotency-Key)
    G->>O: Forward request kèm X-Request-ID

    O->>ODB: 1. Claim IdempotencyRecord (Distributed Lock)
    alt Idempotency-Key đã xử lý thành công trước đó
        ODB-->>O: Trả về kết quả cũ đã lưu
        O-->>G-->>C: Trả lại đơn hàng cũ ngay lập tức (200 OK)
    end

    O->>P: 2. Lấy giá niêm yết chính thức từng mặt hàng
    P-->>O: Trả về giá chuẩn của từng SKU (Bỏ qua giá client gửi)

    O->>Cust: 3. Lấy địa chỉ giao hàng hợp lệ của user (Chống IDOR)
    Cust-->>O: Trả về chi tiết địa chỉ giao hàng

    O->>O: 4. Thẩm định Coupon & Tính phí vận chuyển theo tỉnh/thành

    loop Từng mặt hàng trong đơn hàng
        O->>I: 5. SAGA STEP 1: POST /internal/v1/inventory/reserve
        Note over I: SELECT ... FOR UPDATE<br/>Khóa hàng độc quyền
        alt Không đủ tồn kho khả dụng
            I-->>O: 409 Conflict
            O->>I: Kích hoạt Bồi hoàn giải phóng các mặt hàng đã giữ trước đó
            O->>ODB: Đánh dấu IdempotencyRecord = FAILED
            O-->>G-->>C: Báo lỗi hết hàng
        else Tạm giữ thành công
            I-->>O: 200 OK (Reservation Created)
        end
    end

    O->>ODB: 6. SAGA STEP 2: Tạo Order, OrderItems, ShippingAddress trong MySQL Transaction
    alt Lỗi lưu đơn hàng vào database
        ODB-->>O: Transaction Rollback
        O->>I: Bồi hoàn: POST /internal/v1/inventory/release
        opt Nếu cuộc gọi release gặp sự cố mạng
            O->>ODB: Tạo CompensationTask (PENDING) để worker retry sau
        end
        O->>ODB: Cập nhật IdempotencyRecord = FAILED
        O-->>G-->>C: Báo lỗi hệ thống
    else Lưu đơn thành công
        O->>ODB: 7. SAGA STEP 3: Tạo PaymentRecord (COD hoặc BANK_TRANSFER)
        O->>ODB: Xóa các món trong giỏ hàng (Cart Items)
        O->>ODB: Cập nhật IdempotencyRecord = COMPLETED
        O-->>G-->>C: Trả về kết quả tạo đơn hàng thành công (201 Created)
    end
```

### 17.5. Luồng Tồn Kho & Vòng Đời Giữ Hàng

```
+---------------------------------------------------------------------------------------+
|                              VÒNG ĐỜI TỒN KHO & ĐẶT GIỮ                               |
+---------------------------------------------------------------------------------------+
|                                                                                       |
|   [ Tồn Kho Vật Lý: stockQuantity ]                                                    |
|                  │                                                                    |
|                  ▼                                                                    |
|   [ Tồn Kho Khả Dụng: availableQuantity = stockQuantity - reservedQuantity ]          |
|                  │                                                                    |
|                  │ (Khi Checkout: SELECT ... FOR UPDATE)                              |
|                  ▼                                                                    |
|   [ Trạng Thái ACTIVE: reservedQuantity tăng thêm ] ──(Hết hạn TTL 15m)──┐            |
|                  │                                                       │            |
|       ┌──────────┴──────────┐                                            │            |
|       │                     │                                            ▼            |
| (Đơn Hủy / Lỗi)      (Giao Hàng Thành Công: COMPLETED)          [ Trạng Thái EXPIRED ]|
|       │                     │                                            │            |
|       ▼                     ▼                                            │            |
| [ Trạng Thái RELEASED ] [ Trạng Thái COMMITTED ]                         │            |
| (reservedQuantity giảm) (reservedQuantity giảm                           │            |
|                         và stockQuantity giảm)                           │            |
|       ▲                                                                  │            |
|       └──────────────────────(Quét cleanupExpired)───────────────────────┘            |
|                                                                                       |
+---------------------------------------------------------------------------------------+
```

### 17.6. Xử lý & Xác Nhận Thanh Toán
* **Phương thức COD**:
  * Đơn hàng khởi tạo với `PaymentRecord` ở trạng thái `PENDING`.
  * Chỉ khi đơn hàng được giao thành công và chuyển sang trạng thái `COMPLETED`, nhân viên cập nhật thanh toán thành `PAID`.
* **Phương thức Chuyển khoản ngân hàng (Bank Transfer)**:
  * Sau khi đặt hàng, khách hàng nhận thông tin tài khoản ngân hàng thụ hưởng, mã VietQR và mã nội dung chuyển khoản bắt buộc trùng khớp với mã đơn hàng (`DH-YYYYMMDD-XXXXXX`).
  * Nhân viên đối soát sao kê ngân hàng và gọi `POST /api/v1/payments/:id/confirm`.
  * Hệ thống kiểm tra số tiền khớp với tổng đơn, chuyển trạng thái thanh toán sang `PAID`, tự động nâng trạng thái đơn hàng từ `PENDING` sang `CONFIRMED`, đồng thời ghi nhận nhật ký vào `payment_audit_logs`.

### 17.7. Dịch Chuyển Trạng Thái Đơn Hàng

Hệ thống quản lý trạng thái đơn hàng thông qua máy trạng thái hữu hạn (State Machine) được định nghĩa chặt chẽ trong mã nguồn `orders.service.ts`:

```mermaid
stateDiagram-v2
    [*] --> PENDING: Khách đặt hàng thành công

    PENDING --> CONFIRMED: Duyệt đơn / Thanh toán thành công
    PENDING --> CANCELLED: Khách hoặc Admin hủy đơn

    CONFIRMED --> PROCESSING: Chuyển sang xử lý
    CONFIRMED --> CANCELLED: Hủy đơn trước khi đóng gói

    PROCESSING --> PACKING: Đang đóng bao / thùng
    PROCESSING --> CANCELLED: Hết hàng đột xuất

    PACKING --> SHIPPED: Bàn giao đơn vị vận chuyển
    PACKING --> CANCELLED: Hủy đơn

    SHIPPED --> DELIVERED: Giao hàng thành công
    SHIPPED --> RETURN_REQUESTED: Giao thất bại / Khách từ chối

    DELIVERED --> COMPLETED: Khách xác nhận nhận hàng
    DELIVERED --> RETURN_REQUESTED: Khách yêu cầu đổi trả

    RETURN_REQUESTED --> RETURNED: Hàng đã chuyển về kho
    RETURN_REQUESTED --> COMPLETED: Bác bỏ yêu cầu đổi trả

    RETURNED --> REFUNDED: Hoàn tiền thành công

    COMPLETED --> [*]
    CANCELLED --> [*]
    REFUNDED --> [*]
```

### 17.8. Đánh Giá Sản Phẩm Có Xác Minh Mua Hàng
1. Khách hàng gửi đánh giá kèm điểm sao (1-5) và bình luận qua `POST /api/v1/reviews`.
2. `product-service` gửi yêu cầu nội bộ sang `order-service` qua endpoint `GET /internal/v1/orders/verify-purchase?customerId=...&productId=...`.
3. `order-service` kiểm tra xem khách hàng có sở hữu đơn hàng nào ở trạng thái `COMPLETED` chứa sản phẩm đó hay không.
4. Nếu thỏa mãn, `verifiedPurchase` được gán thành `true`. Khách hàng gửi trường này trong body sẽ bị ValidationPipe tự động loại bỏ để chống gian lận.

### 17.9. Quản Trị Hệ Thống Toàn Diện
* Đăng nhập trang Admin Portal bằng tài khoản có vai trò `STAFF`, `MANAGER`, `ADMIN` hoặc `SUPER_ADMIN`.
* Cập nhật tồn kho, duyệt thanh toán, xuất bản bài viết cẩm nang và quản lý banner khuyến mãi theo mùa vụ.
* **Đăng bán sản phẩm mới**: Admin sử dụng giao diện Modal chuyên sâu tại `/admin/san-pham` để tạo sản phẩm phân bón mới kèm đa quy cách đóng gói (Bao 25kg, Can 5L, Chai 1L...). Hệ thống tự động sinh mã SKU thông minh, tải ảnh sản phẩm lên MinIO S3, và kích hoạt `POST /inventory/adjust` để khởi tạo tồn kho ban đầu cho từng biến thể mà không cần thao tác thủ công trên module kho.
* **Bảo vệ nghiệp vụ thanh toán & đơn hàng**:
  * Chặn xác nhận thanh toán cho đơn hàng đã bị hủy hoặc hoàn trả.
  * Tự động đồng bộ `paymentStatus` khi đơn hàng dịch chuyển trạng thái (`CANCELLED`, `REFUNDED`, `COMPLETED`).
  * Tự động hoàn trả lượt sử dụng mã khuyến mãi khi đơn bị hủy hoặc hoàn tiền.
  * Tự động nhập lại kho vật lý khi đơn hàng bị trả (`RETURNED`).
  * Chặn khách hàng tự hủy đơn đã thanh toán, chỉ Admin mới có quyền chuyển `CANCELLED → REFUNDED`.

---

## 18. API Architecture (Kiến Trúc & Bảng Tra Cứu API)

Bảng tổng hợp các API cốt lõi của hệ thống được trích xuất trực tiếp từ các controllers thực tế:

| HTTP Method | Tuyến Đường (Endpoint) | Dịch Vụ Đích | Xác Thực | Quyền Hạn (Roles) | Mô Tả Nghiệp Vụ |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `GET` | `/health` | API Gateway | Public | Mọi người | Kiểm tra liveness của Gateway |
| `GET` | `/ready` | API Gateway | Public | Mọi người | Kiểm tra readiness và uptime của Gateway |
| `POST` | `/api/v1/auth/register` | `auth-service` | Public | Mọi người | Đăng ký tài khoản khách hàng mới |
| `POST` | `/api/v1/auth/login` | `auth-service` | Public | Mọi người | Đăng nhập hệ thống, cấp Access & Refresh tokens |
| `POST` | `/api/v1/auth/google` | `auth-service` | Public | Mọi người | Đăng nhập/đăng ký bằng Gmail thật qua Google Identity Services |
| `POST` | `/api/v1/auth/refresh` | `auth-service` | Public | Mọi người | Cấp mới Access Token qua Refresh Token Rotation |
| `POST` | `/api/v1/auth/logout` | `auth-service` | Public | Mọi người | Thu hồi Refresh Token phiên hiện tại |
| `POST` | `/api/v1/auth/logout-all` | `auth-service` | JWT | Mọi user đã đăng nhập | Thu hồi toàn bộ phiên đăng nhập trên tất cả thiết bị |
| `GET` | `/api/v1/auth/me` | `auth-service` | JWT | Mọi user đã đăng nhập | Lấy thông tin tài khoản đang đăng nhập |
| `POST` | `/api/v1/auth/change-password` | `auth-service` | JWT | Mọi user đã đăng nhập | Đổi mật khẩu tài khoản |
| `POST` | `/api/v1/auth/forgot-password` | `auth-service` | Public | Mọi người (Throttled) | Yêu cầu mã khôi phục mật khẩu qua email |
| `POST` | `/api/v1/auth/reset-password` | `auth-service` | Public | Mọi người (Throttled) | Đặt lại mật khẩu mới với reset token |
| `GET` | `/api/v1/products` | `product-service` | Public | Mọi người | Tìm kiếm, lọc và phân trang danh mục sản phẩm |
| `GET` | `/api/v1/products/:slug` | `product-service` | Public | Mọi người | Xem chi tiết sản phẩm và các biến thể bao bì |
| `POST` | `/api/v1/products` | `product-service` | JWT + RBAC | `ADMIN`, `MANAGER`, `SUPER_ADMIN` | Thêm mới sản phẩm phân bón |
| `PUT` | `/api/v1/products/:id` | `product-service` | JWT + RBAC | `ADMIN`, `MANAGER`, `SUPER_ADMIN` | Cập nhật thông tin sản phẩm |
| `DELETE` | `/api/v1/products/:id` | `product-service` | JWT + RBAC | `ADMIN`, `MANAGER`, `SUPER_ADMIN` | Xóa sản phẩm và ảnh trên MinIO |
| `POST` | `/api/v1/products/:id/variants`| `product-service`| JWT + RBAC | `ADMIN`, `MANAGER`, `SUPER_ADMIN` | Thêm biến thể quy cách đóng gói (bao/chai) |
| `POST` | `/api/v1/products/:id/images/upload` | `product-service` | JWT + RBAC | `ADMIN`, `MANAGER`, `SUPER_ADMIN` | Upload hình ảnh sản phẩm lên MinIO S3 |
| `GET` | `/api/v1/categories` | `product-service` | Public | Mọi người | Lấy danh sách cây danh mục phân bón |
| `POST` | `/api/v1/reviews` | `product-service` | JWT | Mọi user đã đăng nhập | Gửi đánh giá sản phẩm (tự động xác minh mua hàng) |
| `GET` | `/api/v1/cart` | `order-service` | JWT | Mọi user đã đăng nhập | Lấy thông tin giỏ hàng hiện tại của user |
| `POST` | `/api/v1/cart/items` | `order-service` | JWT | Mọi user đã đăng nhập | Thêm sản phẩm vào giỏ hàng |
| `POST` | `/api/v1/checkout` | `order-service` | JWT | Mọi user đã đăng nhập | Đặt hàng phân tán (Hỗ trợ Header Idempotency-Key) |
| `GET` | `/api/v1/orders/me` | `order-service` | JWT | Mọi user đã đăng nhập | Xem danh sách đơn hàng cá nhân |
| `GET` | `/api/v1/orders/:id` | `order-service` | JWT | Chủ đơn hoặc Staff/Admin | Xem chi tiết đơn hàng và tiến trình vận chuyển |
| `PATCH`| `/api/v1/orders/:id/status`| `order-service` | JWT + RBAC | `STAFF`, `MANAGER`, `ADMIN`, `SUPER_ADMIN` | Cập nhật trạng thái đơn (State Machine) |
| `POST` | `/api/v1/orders/:id/cancel`| `order-service` | JWT | Chủ đơn hoặc Staff/Admin | Hủy đơn hàng và kích hoạt bồi hoàn kho |
| `POST` | `/api/v1/payments/:id/confirm` | `order-service` | JWT + RBAC | `STAFF`, `MANAGER`, `ADMIN`, `SUPER_ADMIN` | Đối soát và xác nhận thanh toán chuyển khoản |
| `POST` | `/internal/v1/inventory/reserve` | `inventory-service` | Service Secret | Dịch vụ nội bộ | Tạm giữ kho chống oversell (`FOR UPDATE`) |
| `POST` | `/internal/v1/inventory/release` | `inventory-service` | Service Secret | Dịch vụ nội bộ | Bồi hoàn giải phóng lượng hàng đã tạm giữ |
| `POST` | `/internal/v1/inventory/commit` | `inventory-service` | Service Secret | Dịch vụ nội bộ | Xuất kho trừ tồn vật lý khi giao hàng xong |
| `POST` | `/api/v1/inventory/adjust` | `inventory-service` | JWT + RBAC | `WAREHOUSE`, `MANAGER`, `ADMIN`, `SUPER_ADMIN` | Điều chỉnh kiểm kê kho thủ công kèm lý do |
| `GET` | `/api/v1/inventory/low-stock` | `inventory-service` | JWT + RBAC | `WAREHOUSE`, `MANAGER`, `ADMIN`, `SUPER_ADMIN` | Danh sách mặt hàng chạm ngưỡng báo động hết hàng |
| `GET` | `/api/v1/customers/me` | `customer-service` | JWT | Mọi user đã đăng nhập | Lấy hồ sơ cá nhân và danh sách sổ địa chỉ |
| `POST` | `/api/v1/customers/me/addresses` | `customer-service` | JWT | Mọi user đã đăng nhập | Thêm địa chỉ nhận hàng mới |
| `GET` | `/api/v1/customers/divisions` | `customer-service` | Public | Mọi người | Danh mục Tỉnh/Thành/Quận/Huyện/Xã Việt Nam |
| `GET` | `/api/v1/posts` | `content-service` | Public | Mọi người | Danh sách bài viết kiến thức canh tác nông nghiệp |
| `GET` | `/api/v1/banners` | `content-service` | Public | Mọi người | Danh sách banner quảng cáo trang chủ |

---

## 19. Authentication & Authorization (Xác Thực & Phân Quyền)

Hệ thống triển khai mô hình bảo mật phân tầng theo chuẩn doanh nghiệp:

```
+---------------------------------------------------------------------------------------+
|                               MÔ HÌNH XÁC THỰC & PHÂN QUYỀN                           |
+---------------------------------------------------------------------------------------+
|                                                                                       |
|   1. Xác thực Danh tính (Authentication):                                             |
|      - Access Token: Ký bằng thuật toán HMAC SHA-256 (JWT), chứa userId, email, role. |
|        Thời gian sống ngắn (15 - 60 phút).                                            |
|      - Refresh Token: Ký bằng JWT riêng biệt, thời gian sống 7 ngày.                   |
|      - Refresh Token Rotation: Mỗi lần đổi token, token cũ bị thu hồi ngay lập tức,  |
|        chống tấn công phát lại (Replay Attacks).                                      |
|      - Lưu trữ bảo mật: Không bao giờ lưu plaintext Refresh Token; database chỉ lưu   |
|        chuỗi băm SHA-256 (tokenHash).                                                 |
|                                                                                       |
|   1b. Xác thực Bên thứ ba (Google Identity Services):                                 |
|      - Người dùng đăng nhập qua nút "Đăng nhập bằng Gmail" trên giao diện Next.js.   |
|      - Frontend chuyển Google ID token (credential) về backend qua POST /auth/google.  |
|      - Backend xác minh token bằng thư viện google-auth-library chính thức.            |
|      - Trích xuất Google `sub` (định danh duy nhất) làm khóa liên kết ngoài.           |
|      - Lưu liên kết tại bảng `external_identities` (provider, providerUserId, userId). |
|      - Nếu tài khoản chưa tồn tại: tự động đăng ký (auto-register) với email Google. |
|      - Nếu đã liên kết: đăng nhập trực tiếp, cấp cặp JWT Access/Refresh tokens.      |
|                                                                                       |
|   2. Phân Quyền Theo Vai Trò (Role-Based Access Control - RBAC):                      |
|      - Sử dụng Custom Decorator `@Roles(...)` kết hợp NestJS `RolesGuard`.            |
|      - Phân cấp vai trò:                                                              |
|        CUSTOMER < STAFF < WAREHOUSE < MANAGER < ADMIN < SUPER_ADMIN                   |
|      - Người dùng không có vai trò hợp lệ sẽ bị từ chối với mã HTTP `403 Forbidden`.   |
|                                                                                       |
+---------------------------------------------------------------------------------------+
```

---

## 20. Security (Phân Tích Cơ Chế Bảo Mật Toàn Diện)

Bảng tổng hợp các biện pháp kiểm soát an toàn thông tin được triển khai thực tế trong mã nguồn:

| Cơ Chế Kiểm Soát Bảo Mật | Trạng Thái | Vị Trí Hiện Thực Trong Mã Nguồn | Mục Đích & Hiệu Quả Bảo Vệ |
| :--- | :---: | :--- | :--- |
| **Mã Hóa Mật Khẩu (Bcrypt)** | ✅ | `services/auth-service/src/auth/auth.service.ts` | Sử dụng bcrypt với salt rounds = 12 để băm mật khẩu, chống tấn công từ điển và Rainbow Table |
| **JWT Access & Refresh Token** | ✅ | `services/auth-service` & `@phanbonshop/config` | Tách biệt quyền truy cập ngắn hạn và duy trì phiên dài hạn |
| **Refresh Token Rotation** | ✅ | `services/auth-service/src/auth/auth.service.ts` | Vô hiệu hóa Refresh Token ngay sau một lần sử dụng |
| **Phát Hiện Tái Sử Dụng Token** | ✅ | `services/auth-service/src/auth/auth.service.ts` | Phát hiện token đã bị thu hồi (`revokedAt !== null`), từ chối cấp token mới |
| **Constant-time Secret Comparison** | ✅ | `@phanbonshop/config/src/index.ts` | Dùng `crypto.timingSafeEqual` đối soát chuỗi bí mật, triệt tiêu lỗ hổng Timing Attack |
| **Bảo Vệ Ingress Nội Bộ** | ✅ | `apps/api-gateway/src/common/middleware/internal-guard.middleware.ts` | Chặn truy cập vào `/internal/*` từ bên ngoài, xóa header giả mạo `x-internal-secret` |
| **Bảo Vệ Dịch Vụ Nội Bộ (Guard)** | ✅ | `services/*/src/auth/guards/internal-secret.guard.ts` | Bảo vệ các API giao tiếp giữa các microservices bằng shared secret |
| **Chống Giả Mạo Giá (Price Tampering)** | ✅ | `services/order-service/src/checkout/checkout.service.ts` | Bỏ qua hoàn toàn giá client gửi, truy vấn giá niêm yết trực tiếp từ `product-service` |
| **Chống Đặt Lặp (Idempotency Key)** | ✅ | `services/order-service/src/checkout/checkout.service.ts` | Khóa phân tán và lưu snapshot đơn hàng, ngăn ngừa trừ tiền trùng lặp |
| **Chống Bán Quá Tồn (Anti-Oversell)** | ✅ | `services/inventory-service/src/inventory/inventory.service.ts` | Khóa hàng độc quyền `SELECT ... FOR UPDATE` trong transaction MySQL |
| **Chống Thao Tác IDOR Địa Chỉ** | ✅ | `services/customer-service/src/customer/customer-internal.controller.ts` | Xác minh quyền sở hữu địa chỉ theo đúng `userId` của phiên đăng nhập |
| **Ẩn Dữ Liệu Nhạy Cảm (Log Masking)** | ✅ | `packages/logger/src/index.ts` | Tự động ẩn `password`, `token`, `secret`, `cookie` trước khi ghi ra stdout/file |
| **Bảo Vệ Tiêu Đề HTTP (Helmet)** | ✅ | `apps/api-gateway/src/main.ts` & `docker/nginx/nginx.conf` | Bật HSTS, X-Content-Type-Options: nosniff, X-Frame-Options: SAMEORIGIN |
| **CORS Whitelist** | ✅ | `apps/api-gateway/src/main.ts` | Giới hạn domain truy cập theo cấu hình biến môi trường `CORS_ALLOWED_ORIGINS` |
| **Chặn Mật Khẩu Dev Trên Production** | ✅ | `packages/config/src/index.ts` | Hàm `validateStartupEnv` chặn đứng các mật khẩu mặc định khi chạy production |
| **Chạy Container Không Đặc Quyền** | ✅ | `docker/Dockerfile.backend`, `apps/frontend/Dockerfile` | Thực thi ứng dụng với user không có quyền root (`USER node:node` UID 1000) |
| **Phân Vùng Mạng Nội Bộ Docker** | ✅ | `docker-compose.prod.yml` | MySQL, Redis, MinIO và các microservices chạy trong `internal_network` không publish port ra host |
| **Giới Hạn Tần Suất (Rate Limiting)** | ✅ | `apps/api-gateway/src/app.module.ts` | Giới hạn 100 requests / 60 giây trên Gateway, giới hạn khôi phục mật khẩu 5 req/phút |
| **Dọn Dẹp Giữ Kho Quá Hạn Tự Động** | 🟡 | `services/inventory-service` | API quét đã có (`cleanup-expired`), cần cấu hình thêm CronJob / Worker tự động |
| **Quản Lý Bí Mật Tập Trung** | 🟡 | Toàn hệ thống | Hiện đang dùng `.env` và Docker Secrets; khuyến nghị Vault hoặc AWS Secrets Manager cho Cloud |

---

## 21. Inventory Concurrency & Anti-Oversell (Đồng Thời & Chống Bán Quá Tồn)

Một trong những thách thức lớn nhất của sàn thương mại điện tử là xử lý đồng thời khi nhiều người cùng đặt mua một mặt hàng có số lượng tồn kho có hạn.

### Cơ Chế Khóa Bi Quan (Pessimistic Locking):
Trong `services/inventory-service/src/inventory/inventory.service.ts`, nghiệp vụ tạm giữ tồn kho được thực thi bên trong một transaction tương tác:

```typescript
return this.prisma.$transaction(async (tx) => {
  // 1. KHÓA BI QUAN: SELECT ... FOR UPDATE trên hàng của variantId
  const rows = await tx.$queryRaw<RawInventoryRow[]>`
    SELECT id, productId, variantId, stockQuantity, reservedQuantity, reorderLevel
    FROM inventory
    WHERE variantId = ${dto.variantId}
    FOR UPDATE
  `;

  const inv = rows[0];
  if (!inv) {
    throw new NotFoundException(`Không tìm thấy tồn kho cho variant: ${dto.variantId}`);
  }

  // 2. TÍNH TOÁN TỒN KHO KHẢ DỤNG THỰC TẾ
  const availableQuantity = inv.stockQuantity - inv.reservedQuantity;

  // 3. KIỂM TRA ĐIỀU KIỆN
  if (availableQuantity < dto.quantity) {
    throw new ConflictException(
      `Không đủ tồn kho khả dụng. Yêu cầu: ${dto.quantity}, Khả dụng: ${availableQuantity}`
    );
  }

  // 4. CẬP NHẬT TẠM GIỮ & TẠO BẢN GHI SỔ CÁI
  await tx.inventory.update({
    where: { variantId: dto.variantId },
    data: { reservedQuantity: { increment: dto.quantity } },
  });
  ...
});
```

### Tại Sao Cơ Chế Này Chống Được Oversell?
1. Khi Transaction A thực hiện `SELECT ... FOR UPDATE`, cơ sở dữ liệu MySQL đặt một **Exclusive Lock (X-Lock)** trên dòng dữ liệu của biến thể đó.
2. Nếu Transaction B đồng thời gửi yêu cầu mua cùng biến thể, Transaction B sẽ bị tạm dừng (block) tại tầng database cho đến khi Transaction A commit hoặc rollback.
3. Khi Transaction B được giải phóng, nó đọc được dữ liệu mới nhất (sau khi `reservedQuantity` đã được tăng bởi Transaction A). Nếu lúc này số lượng khả dụng không còn đủ, Transaction B sẽ bị từ chối ngay lập tức với mã lỗi `409 Conflict`.
4. Không bao giờ xảy ra tình trạng 2 tiến trình cùng đọc một giá trị tồn kho cũ rồi cùng thực hiện trừ hàng (Lost Update Problem).

---

## 22. Distributed Transaction / Saga (Điều Phối Giao Dịch Phân Tán)

Hệ thống áp dụng **Saga Orchestration Pattern** do `order-service` làm nhạc trưởng điều phối quy trình đặt hàng:

### Các Bước Thực Hiện (Forward Steps):
1. **Thẩm định danh mục**: Kiểm tra sản phẩm và lấy giá niêm yết từ `product-service`.
2. **Thẩm định địa chỉ**: Lấy thông tin người nhận từ `customer-service`.
3. **Thẩm định mã giảm giá**: Kiểm tra điều kiện và tính mức chiết khấu.
4. **Saga Step 1 (Reserve)**: Tạm giữ tồn kho qua `inventory-service` (`POST /internal/v1/inventory/reserve`).
5. **Saga Step 2 (Create Order)**: Lưu đơn hàng, chi tiết đơn, địa chỉ giao hàng vào `order_db` trong transaction cục bộ.
6. **Saga Step 3 (Payment)**: Khởi tạo bản ghi thanh toán `PENDING` (COD hoặc Chuyển khoản VietQR).

### Cơ Chế Bồi Hoàn (Compensating Transactions):
* Nếu quá trình tạm giữ một mặt hàng thất bại (do hết hàng), hệ thống tự động gọi API giải phóng các mặt hàng đã tạm giữ thành công trước đó trong cùng đơn.
* Nếu bước lưu đơn hàng vào MySQL thất bại, khối lệnh `catch` lập tức kích hoạt hàm giải phóng kho:
  ```typescript
  for (const variantId of reservedVariantIds) {
    const itemResId = `${batchReservationId}-${variantId}`;
    const released = await this.releaseInventoryItem(itemResId, reason, requestId);
    if (!released) {
      // Nếu gọi mạng thất bại -> Lưu CompensationTask PENDING vào DB để retry
      await this.compensationService.createTask(
        CompensationTaskType.RELEASE_INVENTORY,
        { reservationId: itemResId, reason, requestId }
      );
    }
  }
  ```
* Bằng cách kết hợp **Bồi hoàn tức thì (Immediate Compensation)** và **Nhiệm vụ bồi hoàn bền vững (Persistent Outbox Task)**, hệ thống đảm bảo tồn kho không bao giờ bị phong tỏa vĩnh viễn ngay cả khi xảy ra sự cố mạng.

---

## 23. Idempotency (Cơ Chế Xử Lý Bất Biến Lặp Lại)

Nhằm ngăn chặn tình trạng khách hàng nhấn nút thanh toán nhiều lần hoặc lỗi mạng khiến client gửi lại yêu cầu tạo đơn, `order-service` tích hợp cơ chế Idempotency 2 cấp:

1. **Khóa trong bộ nhớ (In-Memory Request Lock)**:
   * Giữ một bảng băm `inFlightRequests` ánh xạ `${customerId}:${idempotencyKey}`.
   * Nếu có một request cùng key đang trong quá trình thực thi, request thứ hai sẽ cùng chờ (await) chung một Promise và trả về cùng một kết quả, không chạy lại nghiệp vụ lần 2.
2. **Khóa bền vững trong Cơ sở dữ liệu (`idempotency_records`)**:
   * Khi bắt đầu xử lý, hệ thống tạo một bản ghi với trạng thái `PROCESSING`.
   * Bảng có ràng buộc duy nhất `@@unique([customerId, idempotencyKey])`. Bất kỳ tiến trình nào cố gắng tạo trùng key sẽ bị chặn ngay tại database.
   * Khi hoàn tất đơn hàng, hệ thống lưu toàn bộ kết quả trả về (`responseBody`) và `orderId` vào bản ghi và đổi trạng thái sang `COMPLETED`.
   * Các request lặp lại trong tương lai sẽ nhận lại trực tiếp payload đã lưu mà không tạo thêm đơn hàng mới.

---

## 24. File & Object Storage (Lưu Trữ Tệp Tin & Hình Ảnh với MinIO)

Hệ thống sử dụng **MinIO Object Storage** (chuẩn tương thích Amazon S3) để quản lý toàn bộ tệp tin hình ảnh tĩnh:

* **Phân định trách nhiệm rõ ràng**:
  * *MySQL*: Chỉ lưu trữ metadata (ID, tên tệp tin, đường dẫn `objectKey`, `url`, `altText`, thứ tự sắp xếp và cờ `isPrimary`).
  * *MinIO S3*: Lưu trữ dữ liệu nhị phân (Binary Object) thực tế của tệp tin ảnh.
* **Các Bucket Được Khởi Tạo Tự Động**:
  1. `product-images`: Lưu trữ ảnh sản phẩm phân bón, tem nhãn, bao bì, giấy chứng nhận lưu hành.
  2. `content-images`: Lưu trữ ảnh bìa bài viết cẩm nang kỹ thuật canh tác và banner quảng cáo.
* **Chính Sách Truy Cập Công Khai (Public Download Policy)**:
  * Trong `docker-compose.yml`, container `minio-init-buckets` tự động cấu hình quyền tải công khai thông qua MinIO Client:
    ```bash
    mc anonymous set download myminio/product-images
    mc anonymous set download myminio/content-images
    ```
  * Trình duyệt của khách hàng có thể tải trực tiếp ảnh từ URL của MinIO mà không cần thông qua xác thực backend, tối ưu hóa tốc độ tải trang.
* **Cơ Chế Dọn Rác Tự Động**:
  * Khi quản trị viên xóa một ảnh hoặc xóa một sản phẩm, backend tự động gọi `this.minioService.deleteFile(objectKey)` để xóa file vật lý trên MinIO, ngăn ngừa tình trạng chiếm dụng dung lượng đĩa thừa thãi.

---

## 25. Redis Usage (Hiện Trạng Triển Khai & Khuyến Nghị Redis)

> [!IMPORTANT]
> **ĐỐI SOÁT MÃ NGUỒN THỰC TẾ VỀ REDIS:**
> Mặc dù container `redis:7-alpine` đã được cấu hình trong `docker-compose.yml` và `docker-compose.prod.yml`, đồng thời các biến môi trường (`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`) đã được định nghĩa và kiểm tra trong `@phanbonshop/config`, **hiện tại mã nguồn ứng dụng chưa import client `redis` hoặc `ioredis` để thực hiện caching dữ liệu**.
> * Rate Limiting hiện tại sử dụng bộ nhớ trong của NestJS Throttler.
> * Idempotency sử dụng bảng MySQL `idempotency_records`.
> * Khóa đồng thời chống oversell sử dụng MySQL `SELECT ... FOR UPDATE`.
> * Session token sử dụng bảng MySQL `refresh_token_sessions`.
> 
> **Kết luận**: Redis hiện ở trạng thái **Hạ tầng đã sẵn sàng (Infrastructure Prepared)**, được lên kế hoạch (Planned) để nâng cấp hiệu năng ở giai đoạn tiếp theo.

### Lộ Trình Tích Hợp Ứng Dụng Với Redis:
1. Tích hợp `@nestjs/throttler-storage-redis` để chia sẻ bộ đếm Rate Limit khi chạy nhiều instance API Gateway.
2. Cache danh mục sản phẩm và chi tiết sản phẩm phân bón bằng Redis Key-Value (TTL 10 phút) để giảm tải cho `product_db`.
3. Tích hợp thư viện BullMQ trên Redis để chạy các CronJob nền dọn dẹp các lượt đặt giữ tồn kho quá hạn (`cleanup-expired`).

---

## 26. Audit Logging (Ghi Nhận Nhật Ký Kiểm Toán Nghiệp Vụ)

Nhật ký kiểm toán là yếu tố then chốt đối với sàn thương mại điện tử chuyên ngành để tra cứu trách nhiệm khi có biến động giá hoặc thay đổi hàng tồn:

* **Mô hình `AuditLog`**: Được tích hợp độc lập trên cả 4 database nghiệp vụ (`auth_db`, `product_db`, `order_db`, `inventory_db`).
* **Các hành động được ghi vết tự động**:
  * `PRICE_CHANGE`: Ghi nhận biến động giá niêm yết của biến thể sản phẩm, lưu rõ giá cũ (`oldValue`) và giá mới (`newValue`).
  * `INVENTORY_ADJUST`: Ghi nhận thao tác điều chỉnh kho thủ công của thủ kho kèm số lượng và lý do giải trình bắt buộc.
  * `ORDER_STATUS_CHANGE`: Ghi nhận mọi bước dịch chuyển trạng thái của đơn hàng và người thực hiện (`changedBy`).
  * `PAYMENT_CONFIRM`: Ghi nhận người duyệt thanh toán, số tiền và mã biên lai ngân hàng.
* **Ghi vết phân tán (`X-Request-ID`)**:
  * API Gateway tự động sinh mã UUID cho mọi request gửi tới hệ thống và gán vào header HTTP `X-Request-ID`.
  * Header này được truyền xuyên suốt qua tất cả các microservices và được lưu trữ trong các bản ghi `AuditLog`, cho phép kỹ sư vận hành truy vết chính xác nguồn gốc của mọi thay đổi dữ liệu.

---

## 27. Error Handling (Xử Lý Ngoại Lệ & Lỗi Hệ Thống)

* **Global Exception Filter (`GlobalExceptionFilter`)**:
  * Được đăng ký toàn cục trên API Gateway và các microservices.
  * Chuẩn hóa toàn bộ cấu trúc phản hồi lỗi theo format thống nhất:
    ```json
    {
      "success": false,
      "message": "Thông điệp lỗi chi tiết",
      "statusCode": 400,
      "errors": [{ "field": "email", "message": "Email không hợp lệ" }],
      "timestamp": "2026-09-20T11:00:00.000Z"
    }
    ```
  * **Che giấu Stack Trace**: Trong môi trường `production`, toàn bộ chi tiết lỗi nội bộ hoặc câu lệnh database truy vấn thất bại đều bị ẩn đi, chỉ ghi log nội bộ để tránh làm lộ cấu trúc hệ thống.
* **Validation Pipe**:
  * Sử dụng `class-validator` với các cờ `whitelist: true`, `forbidNonWhitelisted: true`.
  * Tự động loại bỏ hoặc từ chối các trường lạ không được khai báo trong DTO để ngăn chặn tấn công Mass Assignment.
* **Timeout Interceptor**:
  * Thiết lập ngưỡng ngắt kết nối tự động (mặc định 15 giây) trên API Gateway nếu một dịch vụ microservice phía sau không phản hồi, ngăn chặn tình trạng cạn kiệt tài nguyên thread pool.

---

## 28. Observability (Khả Năng Quan Sát & Giám Sát Vận Hành)

### Trạng Thái Hiện Tại (Đã Hoàn Thành):
* **Structured JSON Logging**: Toàn bộ log được định dạng JSON chuẩn qua package `@phanbonshop/logger`, tự động đính kèm tên service, môi trường, thời gian và `requestId`.
* **Data Masking**: Tự động che giấu mật khẩu, token và thông tin cá nhân trên console log.
* **Health Check Endpoints**:
  * `GET /health`: Kiểm tra liveness của từng container.
  * `GET /ready`: Kiểm tra readiness tiếp nhận traffic.
  * `GET /healthz` (Nginx): Trả về HTTP 200 cho load balancer thăm dò.
* **Docker Healthchecks**: Mọi container trong Compose đều có healthcheck tự động định kỳ 5-10s (`mysqladmin ping`, `redis-cli ping`, `curl minio live`, `fetch /health`).

### Lộ Trình Nâng Cấp (Roadmap):
* Triển khai **Prometheus** để thu thập số liệu RED (Rate, Errors, Duration).
* Triển khai **Grafana** để trực quan hóa biểu đồ lưu lượng và tài nguyên hệ thống.
* Tích hợp **OpenTelemetry** để theo dõi vết giao dịch phân tán (Distributed Tracing) xuyên suốt các microservices.

---

## 29. Docker Architecture (Kiến Trúc Container Hóa)

Hệ thống cung cấp 2 file điều phối container chuyên biệt:
1. `docker-compose.yml`: Dành cho phát triển cục bộ và kiểm thử tích hợp (publish các cổng ra host).
2. `docker-compose.prod.yml`: Dành cho môi trường sản xuất (cô lập hoàn toàn mạng nội bộ).

### Bảng Danh Mục 14 Containers Hệ Thống:

| Tên Container | Hình Ảnh (Image) / Dockerfile | Cổng Nội Bộ | Cổng Public (Host) | Phụ Thuộc (Dependencies) | Mục Đích Sử Dụng |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `phanbonshop_proxy` | `nginx:1.27-alpine` | `80`, `443` | `80:80`, `443:443` | `frontend`, `gateway` | Điểm tiếp nhận lưu lượng công cộng L7 Reverse Proxy |
| `phanbonshop_frontend` | `apps/frontend/Dockerfile` (Standalone) | `3000` | Không publish | `gateway` | Ứng dụng Next.js Storefront & Admin Portal |
| `phanbonshop_gateway` | `apps/api-gateway` (Multi-stage) | `8080` | `8080:8080` (Dev only) | `auth`, `product`, `order`, `inventory`, `customer`, `content`, `redis` | API Gateway trung tâm định tuyến yêu cầu |
| `phanbonshop_auth` | `services/auth-service` (Multi-stage) | `3001` | Không publish | `migrate`, `redis` | Quản lý tài khoản, JWT tokens, RBAC |
| `phanbonshop_product` | `services/product-service` (Multi-stage) | `3002` | Không publish | `migrate`, `redis` | Quản lý danh mục, sản phẩm NPK, biến thể bao bì |
| `phanbonshop_order` | `services/order-service` (Multi-stage) | `3003` | Không publish | `migrate`, `redis`, `inventory`, `customer` | Giỏ hàng, Checkout Saga, Quản lý đơn hàng, Thanh toán |
| `phanbonshop_inventory`| `services/inventory-service` (Multi-stage) | `3004` | Không publish | `migrate`, `redis` | Quản lý kho bãi, Khóa bi quan chống oversell |
| `phanbonshop_customer` | `services/customer-service` (Multi-stage) | `3005` | Không publish | `migrate`, `redis` | Hồ sơ khách hàng, sổ địa chỉ nhận hàng VN |
| `phanbonshop_content` | `services/content-service` (Multi-stage) | `3006` | Không publish | `migrate`, `redis`, `minio` | Bài viết kiến thức nông học và banner quảng cáo |
| `phanbonshop_mysql` | `mysql:8.0` | `3306` | `3307:3306` (Dev only) | Không có | Hệ quản trị cơ sở dữ liệu quan hệ ACID (6 DBs) |
| `phanbonshop_redis` | `redis:7-alpine` | `6379` | `6379:6379` (Dev only) | Không có | Hạ tầng lưu trữ bộ đệm và khóa phân tán |
| `phanbonshop_minio` | `quay.io/minio/minio:latest` | `9000`, `9001` | `9000:9000`, `9001:9001` (Dev) | Không có | Kho lưu trữ đối tượng S3 cho hình ảnh |
| `phanbonshop_minio_init`| `quay.io/minio/mc:latest` | - | Không có | `minio` (healthy) | Container một lần tự động tạo buckets & phân quyền |
| `phanbonshop_migrate` | `docker/Dockerfile.migrate` | - | Không có | `mysql` (healthy) | Container một lần chạy `prisma migrate deploy` |

### Sơ Đồ Trình Tự Khởi Động (Startup Order Flow):

```
MySQL 8.0 (healthy) ──────────┐
Redis 7.0 (healthy) ──────────┼──> Migration Container (Chạy migrate deploy 6 DBs)
MinIO S3  (healthy) ──────────┘                 │
       │                                        ▼ (Completed Successfully)
       ▼                               6 Microservices Backend
MinIO Init Buckets                     (auth, product, order, inventory, customer, content)
(Tạo product-images,                            │
 content-images & phân quyền)                   ▼ (All Services Healthy)
                                          API Gateway
                                                │
                                                ▼ (Healthy)
                                        Next.js Frontend
                                                │
                                                ▼ (Healthy)
                                     Nginx Reverse Proxy
                                                │
                                                ▼
                              [ RELEASE GATES REQUIRED — SEE READINESS REPORT ]
```

---

## 30. Local Development Environment (Môi Trường Phát Triển Cục Bộ)

### Yêu Cầu Cài Đặt (Prerequisites):
* **Node.js**: Phiên bản `>= 20.14.0` (Khuyến nghị Node.js 20 LTS hoặc 22/24).
* **npm**: Phiên bản `>= 10.x` (Hỗ trợ native npm workspaces).
* **Docker Desktop**: Docker Engine 24+ và Docker Compose v2+.
* **Git**: `>= 2.40.x`.
* **Lưu ý Port mạng trên máy Host**:
  * MySQL của dự án được cấu hình mặc định ánh xạ sang cổng **`3307`** trên host (`3307:3306`) để tránh xung đột nếu máy bạn đã có sẵn MySQL chạy ở cổng 3306.
  * MinIO S3 API sử dụng cổng **`9000`** và MinIO Web Console sử dụng cổng **`9001`**.
  * API Gateway sử dụng cổng **`8080`**.
  * Nginx Reverse Proxy sử dụng cổng **`80`**.

---

## 31. Installation (Hướng Dẫn Cài Đặt Từng Bước)

Thực hiện theo các bước chuẩn mực sau từ thư mục gốc của repository:

### Bước 1: Clone mã nguồn dự án
```bash
git clone https://github.com/nguyen-tri-Cyber/phanbonshop.git
cd phanbonshop
```

### Bước 2: Thiết lập file cấu hình môi trường
```bash
# Sao chép file cấu hình mẫu sang file môi trường cục bộ
cp .env.example .env
```

### Bước 3: Cài đặt toàn bộ dependencies cho toàn monorepo
```bash
# Lệnh này tự động cài đặt dependencies cho root, packages, services và apps
npm install
```

### Bước 4: Khởi tạo Prisma Client cho tất cả các microservices
```bash
npm run prisma:generate
```

### Bước 5: Biên dịch các thư viện dùng chung (Packages)
```bash
npm run build:packages
```

---

## 32. Environment Configuration (Cấu Hình Biến Môi Trường)

Bảng tra cứu toàn bộ biến môi trường từ file chuẩn `.env.example`:

| Tên Biến Môi Trường | Giá Trị Mặc Định (Dev) | Bắt Buộc | Mục Đích Sử Dụng |
| :--- | :--- | :---: | :--- |
| `NODE_ENV` | `development` | Có | Chế độ chạy ứng dụng (`development` / `production` / `test`) |
| `GATEWAY_PORT` | `8080` | Có | Cổng mạng của API Gateway |
| `FRONTEND_PORT` | `3000` | Có | Cổng mạng của Frontend Next.js |
| `AUTH_SERVICE_PORT` | `3001` | Có | Cổng mạng của Auth Service |
| `AUTH_SERVICE_URL` | `http://localhost:3001` | Có | URL nội bộ gọi Auth Service |
| `PRODUCT_SERVICE_PORT` | `3002` | Có | Cổng mạng của Product Service |
| `PRODUCT_SERVICE_URL` | `http://localhost:3002` | Có | URL nội bộ gọi Product Service |
| `ORDER_SERVICE_PORT` | `3003` | Có | Cổng mạng của Order Service |
| `ORDER_SERVICE_URL` | `http://localhost:3003` | Có | URL nội bộ gọi Order Service |
| `INVENTORY_SERVICE_PORT`| `3004` | Có | Cổng mạng của Inventory Service |
| `INVENTORY_SERVICE_URL` | `http://localhost:3004` | Có | URL nội bộ gọi Inventory Service |
| `CUSTOMER_SERVICE_PORT` | `3005` | Có | Cổng mạng của Customer Service |
| `CUSTOMER_SERVICE_URL` | `http://localhost:3005` | Có | URL nội bộ gọi Customer Service |
| `CONTENT_SERVICE_PORT` | `3006` | Có | Cổng mạng của Content Service |
| `CONTENT_SERVICE_URL` | `http://localhost:3006` | Có | URL nội bộ gọi Content Service |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | Có | Danh sách domain được phép gọi API (phân tách dấu phẩy) |
| `MYSQL_PORT` | `3307` | Có | Cổng ánh xạ MySQL trên máy host |
| `MYSQL_ROOT_PASSWORD` | `root_secret` | Có | Mật khẩu tài khoản root của MySQL |
| `MYSQL_USER` | `phanbon_user` | Có | Tên tài khoản cơ sở dữ liệu ứng dụng |
| `MYSQL_PASSWORD` | `phanbon_secret` | Có | Mật khẩu tài khoản cơ sở dữ liệu ứng dụng |
| `REDIS_PORT` | `6379` | Có | Cổng mạng của Redis |
| `REDIS_PASSWORD` | `redis_secret` | Có | Mật khẩu truy cập Redis |
| `MINIO_PORT` | `9000` | Có | Cổng API S3 của MinIO |
| `MINIO_CONSOLE_PORT` | `9001` | Có | Cổng Web Console quản trị của MinIO |
| `MINIO_ROOT_USER` | `admin` | Có | Tên đăng nhập quản trị MinIO |
| `MINIO_ROOT_PASSWORD` | `admin123456` | Có | Mật khẩu đăng nhập quản trị MinIO |
| `MINIO_BUCKET_PRODUCTS` | `product-images` | Có | Tên bucket MinIO lưu ảnh sản phẩm |
| `MINIO_BUCKET_CONTENT` | `content-images` | Có | Tên bucket MinIO lưu ảnh bài viết & banner |
| `AUTH_DATABASE_URL` | `mysql://phanbon_user:phanbon_secret@localhost:3307/auth_db` | Có | Chuỗi kết nối database của Auth Service |
| `PRODUCT_DATABASE_URL` | `mysql://phanbon_user:phanbon_secret@localhost:3307/product_db` | Có | Chuỗi kết nối database của Product Service |
| `ORDER_DATABASE_URL` | `mysql://phanbon_user:phanbon_secret@localhost:3307/order_db` | Có | Chuỗi kết nối database của Order Service |
| `INVENTORY_DATABASE_URL`| `mysql://phanbon_user:phanbon_secret@localhost:3307/inventory_db`| Có | Chuỗi kết nối database của Inventory Service |
| `CUSTOMER_DATABASE_URL` | `mysql://phanbon_user:phanbon_secret@localhost:3307/customer_db` | Có | Chuỗi kết nối database của Customer Service |
| `CONTENT_DATABASE_URL` | `mysql://phanbon_user:phanbon_secret@localhost:3307/content_db` | Có | Chuỗi kết nối database của Content Service |
| `JWT_ACCESS_SECRET` | *32+ ký tự ngẫu nhiên* | Có | Khóa bí mật ký Access Token |
| `JWT_REFRESH_SECRET` | *32+ ký tự ngẫu nhiên* | Có | Khóa bí mật ký Refresh Token |
| `INTERNAL_SERVICE_SECRET`| *Chuỗi bí mật hệ thống* | Có | Khóa chia sẻ xác thực giao tiếp giữa các dịch vụ nội bộ |
| `GOOGLE_CLIENT_ID` | `...apps.googleusercontent.com` | Khi bật Google | Web OAuth Client ID dùng chung cho frontend và auth-service |
| `REQUIRE_GOOGLE_REGISTRATION` | `false` local / `true` production | Có | Khóa đăng ký mật khẩu; khi có `GOOGLE_CLIENT_ID` chính sách này tự bật |

### Cấu hình đăng nhập Gmail thật

1. Trong Google Cloud Console, tạo OAuth Client loại **Web application**.
2. Thêm JavaScript origin `http://localhost` cho local và origin HTTPS chính thức khi triển khai.
3. Điền Client ID vào `GOOGLE_CLIENT_ID` trong `.env`; không cần và không được đưa Client Secret vào frontend.
4. Dựng lại auth và frontend để Client ID public được nhúng vào bản build:

```bash
docker compose up -d --build auth frontend gateway reverse-proxy
```

Khi `GOOGLE_CLIENT_ID` có giá trị, hệ thống tự động khóa đăng ký bằng mật khẩu để hạn chế tài khoản ảo; các tài khoản mật khẩu đã tồn tại vẫn đăng nhập bình thường. Auth-service xác minh chữ ký, audience, issuer, hạn token và `email_verified`; Google credential không được lưu trong database.

> [!WARNING]
> Tuyệt đối không sử dụng các mật khẩu mặc định (ví dụ `admin123456`, `root_secret`, `phanbon_secret`) trên môi trường Production. Hệ thống sẽ tự động dừng khởi động (Fail-fast) nếu phát hiện các giá trị này khi `NODE_ENV=production`.

---

## 33. Running the Application (Khởi Chạy Hệ Thống)

### Cách 1: Khởi chạy toàn diện bằng Docker Compose (Khuyến nghị)
Chỉ với một câu lệnh duy nhất, toàn bộ hạ tầng MySQL, Redis, MinIO, quy trình di trú dữ liệu, 6 microservices, API Gateway, Frontend và Nginx Reverse Proxy sẽ được khởi chạy đồng bộ:

```bash
docker compose up --build -d
```

Kiểm tra trạng thái sức khỏe của toàn bộ 14 containers:
```bash
docker compose ps
```

Dừng toàn bộ hệ sinh thái:
```bash
docker compose down
```

### Cách 2: Khởi chạy phục vụ phát triển (Local Development)
Nếu muốn phát triển và chỉnh sửa mã nguồn trực tiếp trên máy host:

1. **Khởi động các dịch vụ hạ tầng (MySQL, Redis, MinIO)**:
   ```bash
   docker compose up mysql redis minio minio-init-buckets -d
   ```
2. **Đẩy cấu trúc cơ sở dữ liệu**:
   ```bash
   npm run prisma:validate
   npm run migrate:deploy
   ```
3. **Nạp dữ liệu mẫu phát triển**:
   ```bash
   npm run seed --workspace=@phanbonshop/auth-service
   npm run seed --workspace=@phanbonshop/product-service
   ```
4. **Khởi chạy chế độ dev song song trên toàn bộ workspaces**:
   ```bash
   npm run dev
   ```

---

## 34. Database Migration (Quy Trình Di Trú Cơ Sở Dữ Liệu)

Hệ thống cung cấp script tự động hóa chạy di trú tuần tự và bất biến (Idempotent) trên toàn bộ 6 cơ sở dữ liệu:

```bash
# Kiểm tra cú pháp của 6 file schema Prisma
npm run prisma:validate

# Thực thi di trú an toàn (Prisma Migrate Deploy)
npm run migrate:deploy
```

Script `scripts/migrate-deploy.mjs` sẽ tự động đọc cấu hình kết nối, nạp từng schema và áp dụng các migration chưa chạy trong thư mục `prisma/migrations` của từng dịch vụ mà không làm mất dữ liệu hiện có.

---

## 35. Seed Data (Nạp Dữ Liệu Khởi Tạo)

Dự án cung cấp script nạp dữ liệu mẫu phục vụ kiểm thử và trình diễn đồ án:

```bash
# Nạp tài khoản người dùng mẫu
npm run seed --workspace=@phanbonshop/auth-service

# Nạp danh mục, thương hiệu và sản phẩm phân bón mẫu
npm run seed --workspace=@phanbonshop/product-service
```

### Danh Sách Tài Khoản Mẫu Môi Trường Phát Triển (Dev Only):
*(Được mã hóa an toàn với mật khẩu phát triển mặc định: `Dev@Test123456`)*

| Email Đăng Nhập | Mật Khẩu | Vai Trò (Role) | Mục Đích Kiểm Thử |
| :--- | :--- | :---: | :--- |
| `admin@local.test` | `Dev@Test123456` | `SUPER_ADMIN` | Quản trị tối cao, kiểm tra phân quyền và cấu hình hệ thống |
| `manager@local.test` | `Dev@Test123456` | `ADMIN` | Quản lý sản phẩm, thương hiệu, danh mục, mã giảm giá |
| `staff@local.test` | `Dev@Test123456` | `STAFF` | Nhân viên duyệt đơn hàng, đối soát thanh toán chuyển khoản |
| `customer@local.test` | `Dev@Test123456` | `CUSTOMER` | Khách hàng nông dân mua sắm, đặt hàng, thêm địa chỉ nhận hàng |

> [!NOTE]
> Script `services/auth-service/prisma/seed.ts` được lập trình bảo vệ an toàn: Nếu phát hiện `process.env.NODE_ENV === 'production'`, script sẽ lập tức ngắt lệnh và ném ngoại lệ để ngăn chặn việc ghi đè tài khoản dev vào cơ sở dữ liệu thật.

---

## 36. API Documentation (Tài Liệu Swagger / OpenAPI)

Khi hệ thống đang hoạt động, tài liệu API tương tác trực quan (Swagger UI) có thể truy cập trực tiếp tại các địa chỉ:

| Thành Phần Dịch Vụ | Cổng (Port) | Đường Dẫn Swagger UI | Mô Tả Tài Liệu |
| :--- | :---: | :--- | :--- |
| **API Gateway (Hợp nhất)** | `8080` | [http://localhost:8080/docs](http://localhost:8080/docs) | Tài liệu API trung tâm hợp nhất toàn hệ thống |
| **Nginx Entrypoint** | `80` | [http://localhost/api/docs](http://localhost/api/docs) | Truy cập thông qua Nginx Reverse Proxy |
| **Auth Service** | `3001` | `http://localhost:3001/docs` | Chi tiết API xác thực tài khoản & JWT |
| **Product Service** | `3002` | `http://localhost:3002/docs` | Chi tiết API sản phẩm, danh mục, biến thể, MinIO |
| **Order Service** | `3003` | `http://localhost:3003/docs` | Chi tiết API giỏ hàng, checkout, đơn hàng, thanh toán |
| **Inventory Service** | `3004` | `http://localhost:3004/docs` | Chi tiết API tồn kho, tạm giữ, commit, sổ cái |
| **Customer Service** | `3005` | `http://localhost:3005/docs` | Chi tiết API hồ sơ khách hàng & sổ địa chỉ |
| **Content Service** | `3006` | `http://localhost:3006/docs` | Chi tiết API bài viết cẩm nang & banner |

---

## 37. Testing (Hiện Trạng Kiểm Thử Toàn Hệ Thống)

> [!IMPORTANT]
> **ĐÁNH GIÁ MINH BẠCH VỀ TEST SUITE:**
> Không tuyên bố "100% tests pass" trên toàn bộ microservices. Bảng ma trận dưới đây phản ánh chính xác các tệp tin kiểm thử thực tế tồn tại trong repository.

### Bảng Ma Trận Độ Bao Phủ Kiểm Thử (Test Coverage Matrix):

| Gói / Dịch Vụ | Loại Test | Tệp Tin Test Thực Tế | Số Lượng Test | Trạng Thái Thực Tế |
| :--- | :---: | :--- | :---: | :--- |
| `@phanbonshop/shared-utils` | Unit Test | `packages/shared-utils/test/utils.test.mjs` | 8 tests | ✅ **Pass 100%** (VND, Slug, Phone, Divisions) |
| `@phanbonshop/order-service` | Unit Test | `services/order-service/test/order.unit.test.mjs` | 4 tests | ✅ **Pass 100%** (Subtotal, Coupon, State Machine) |
| `@phanbonshop/inventory-service` | Unit Test | `services/inventory-service/test/inventory.unit.test.mjs` | 3 tests | ✅ **Pass 100%** (Khả dụng, Ngưỡng reorderLevel) |
| `Hạ Tầng Container & CI/CD` | Integration | `scratch/test-container-prod-architecture.mjs` | 4 suites | ✅ **Pass 100%** (Dockerfiles, Nginx, Compose) |
| `GitHub Actions CI Pipeline` | Integration | `.github/workflows/ci.yml` (MySQL + Redis services) | 5 jobs | ✅ **Pass 100%** (Migrate deploy idempotency) |
| `@phanbonshop/api-gateway` | Unit / E2E | *Chưa có tệp test thực tế (script placeholder)* | 0 tests | 🟡 *Chưa triển khai test tự động* |
| `@phanbonshop/frontend` | Unit / E2E | *Chưa có tệp test thực tế* | 0 tests | 🟡 *Chưa triển khai test tự động* |
| `@phanbonshop/auth-service` | Unit / E2E | *Chưa có tệp test thực tế (script placeholder)* | 0 tests | 🟡 *Chưa triển khai test tự động* |
| `@phanbonshop/product-service` | Unit / E2E | *Chưa có tệp test thực tế (script placeholder)* | 0 tests | 🟡 *Chưa triển khai test tự động* |
| `@phanbonshop/customer-service`| Unit / E2E | *Chưa có tệp test thực tế (script placeholder)* | 0 tests | 🟡 *Chưa triển khai test tự động* |
| `@phanbonshop/content-service` | Unit / E2E | *Chưa có tệp test thực tế (script placeholder)* | 0 tests | 🟡 *Chưa triển khai test tự động* |
| `@phanbonshop/config` | Unit Test | *Chưa có tệp test thực tế (script placeholder)* | 0 tests | 🟡 *Chưa triển khai test tự động* |
| `@phanbonshop/logger` | Unit Test | *Chưa có tệp test thực tế (script placeholder)* | 0 tests | 🟡 *Chưa triển khai test tự động* |
| `@phanbonshop/shared-types` | Type Check | Đảm bảo qua `npm run typecheck` | - | ✅ **Type-safe 100%** |

---

## 38. Build, Lint and Typecheck (Kiểm Chuẩn Mã Nguồn)

Hệ thống thiết lập quy trình kiểm chuẩn nghiêm ngặt cho toàn bộ 14 workspaces thông qua các câu lệnh root:

```bash
# 1. Kiểm tra cú pháp và định dạng mã nguồn (ESLint)
npm run lint

# 2. Kiểm tra kiểu dữ liệu TypeScript tĩnh trên toàn monorepo (Strict Mode)
npm run typecheck

# 3. Thực thi toàn bộ các bộ kiểm thử đơn vị hiện có
npm run test

# 4. Biên dịch toàn diện toàn bộ packages, microservices và frontend
npm run build
```

---

## 39. Production Deployment (Triển Khai Môi Trường Sản Xuất)

Dự án đã được đóng gói và chuẩn hóa toàn diện cho việc triển khai trên máy chủ Linux (Ubuntu Server / Debian) có cài đặt Docker & Docker Compose:

### 1. Phân Tách Mạng Bảo Mật Tuyệt Đối
Trong `docker-compose.prod.yml`:
* `phanbonshop_public_network`: Mạng ngoài nối Internet tới Nginx Reverse Proxy.
* `phanbonshop_internal_network`: Mạng nội bộ được cấu hình cờ **`internal: true`**. Toàn bộ 6 microservices, API Gateway, Frontend, MySQL, Redis, MinIO đều nằm trong mạng này và **hoàn toàn không mở cổng (No published ports) ra máy host**. Ngăn chặn tuyệt đối nguy cơ rò rỉ dữ liệu hoặc bị quét cổng từ Internet.

### 2. Thiết Lập HTTPS / SSL với Nginx
* Thư mục `docker/nginx/certs` được cấu hình để gắn kết chứng chỉ SSL từ Let's Encrypt / Certbot.
* Cấu hình Nginx hỗ trợ giao thức bảo mật cao: TLS 1.2, TLS 1.3, HSTS (`max-age=31536000`), bật HTTP/2 và tối ưu hóa bộ nhớ đệm proxy 256k.

### 3. Lệnh Khởi Chạy Production:
```bash
# Kiểm tra tính hợp lệ của file cấu hình production trước khi chạy
docker compose -f docker-compose.prod.yml config

# Khởi chạy hệ thống ở chế độ ngầm
docker compose -f docker-compose.prod.yml up --build -d
```

---

## 40. Production Readiness Assessment (Đánh Giá Độ Sẵn Sàng Vận Hành)

> **Trạng thái hiện tại (2026-09-21): NOT READY.** Xem ma trận kiểm chứng và các release blocker tại
> [`docs/PRODUCTION_READINESS_REPORT.md`](docs/PRODUCTION_READINESS_REPORT.md). Các mô tả bên dưới
> là kiến trúc/capability, không phải bằng chứng cho phép go-live.

| Hạng Mục Đánh Giá | Trạng Thái | Minh Chứng Thực Tế & Khoảng Trống Kỹ Thuật (Gaps) |
| :--- | :---: | :--- |
| **Kiến Trúc Container** | ✅ | Multi-stage Dockerfiles chuẩn, chạy user non-root (`USER node`), không chạy dev server trong production |
| **Mạng & Reverse Proxy** | ✅ | Nginx 1.27 tối ưu hóa gzip, security headers, phân tách mạng `internal: true` cô lập database và backend |
| **Xác Thực & Phân Quyền** | ✅ | JWT kép, Refresh Token Rotation, RBAC 6 cấp độ, chặn mật khẩu mặc định khi boot production |
| **Bảo Vệ Giao Tiếp Nội Bộ** | ✅ | Giao tiếp qua `X-Internal-Secret` với `timingSafeCompare`, API Gateway lọc bỏ header từ ngoài vào |
| **Tính Nhất Quán Giao Dịch** | ✅ | Saga Orchestration kèm bồi hoàn tự động và Outbox Persistent Tasks giải phóng kho khi lỗi |
| **Chống Bán Quá Tồn (Oversell)**| ✅ | MySQL Transaction với `SELECT ... FOR UPDATE` khóa bi quan chặt chẽ |
| **Chống Đặt Lặp (Idempotency)** | ✅ | Lưu trữ bản ghi Idempotency và in-memory locking xử lý đồng thời |
| **Lưu Trữ Ảnh Tệp Tin** | ✅ | MinIO S3 bucket độc lập, tự động phân quyền public read, tách rời metadata khỏi binary data |
| **CI/CD Tự Động Hóa** | ✅ | GitHub Actions workflow chạy 5 jobs: lint, typecheck, unit test, build, integration migration deploy |
| **Kiểm Thử Tự Động (Tests)** | 🟡 | Đã có 15 unit tests cho utils, order, inventory; các services khác hiện còn dùng placeholder test script |
| **Giao Diện Checkout Frontend** | 🟡 | API backend checkout hoàn chỉnh, nhưng giao diện trang đặt hàng phía khách hàng chưa nối API |
| **Phân Tán Cache (Redis)** | 🟡 | Container Redis đã chạy nhưng chưa cài đặt package và viết code caching cho tầng ứng dụng |
| **Giám Sát & Tracing** | ❌ | Chưa tích hợp OpenTelemetry, Prometheus, Grafana để theo dõi latency và trace phân tán theo thời gian thực |
| **Cổng Thanh Toán Trực Tuyến** | ❌ | Chưa kết nối webhook thực tế của VNPay / MoMo / PayOS (hiện mới hỗ trợ COD và Chuyển khoản VietQR) |

---

## 41. Known Limitations (Các Hạn Chế Kỹ Thuật Hiện Hữu)

Để đảm bảo tính trung thực và minh bạch kỹ thuật của dự án, các điểm hạn chế sau được ghi nhận từ mã nguồn thực tế:

1. **Độ bao phủ kiểm thử tự động chưa đồng đều**: Hệ thống mới chỉ có unit test cho `@phanbonshop/shared-utils`, `order-service` và `inventory-service` (tổng cộng 15 unit tests). Các dịch vụ `auth-service`, `product-service`, `customer-service`, `content-service` và `api-gateway` cần được bổ sung thêm test suites chi tiết.
2. **Trang Checkout Frontend chưa hoàn thiện**: Khách hàng có thể thêm hàng vào giỏ và xem trong ngăn kéo giỏ hàng (`CartDrawer`), nhưng nút "Tiến hành đặt hàng" chưa được gắn sự kiện chuyển hướng đến trang nhập thông tin thanh toán hoàn chỉnh trên giao diện web.
3. **Chưa có Scheduler tự động quét tồn kho quá hạn**: API thu hồi các lượt tạm giữ quá hạn (`POST /internal/v1/inventory/cleanup-expired`) đã được lập trình hoàn chỉnh, nhưng cần cấu hình thêm một cron daemon (như Redis BullMQ hoặc Linux crontab) để kích hoạt định kỳ mỗi 5 phút.
4. **API Gateway chạy ở tầng ứng dụng**: Hiện API Gateway đang được xây dựng bằng NestJS Controller proxy qua `fetch()`. Trong tương lai khi quy mô hàng triệu requests/ngày, nên cân nhắc thay thế bằng các Gateway chuyên dụng như **Kong Gateway**, **Traefik** hoặc **Envoy Proxy**.
5. **Chưa có kiến trúc Kubernetes**: Dự án hiện đang tối ưu hóa chạy trên Docker Compose. Khi cần mở rộng quy mô đa cụm (multi-node cluster) và tự động co giãn (Horizontal Pod Autoscaling - HPA), cần viết bộ manifest Kubernetes (K8s Deployment, Service, Ingress, ConfigMap, Secret).

---

## 42. Roadmap (Lộ Trình Phát Triển Tiếp Theo)

### Giai Đoạn 1: Hoàn Thiện Trải Nghiệm Mua Sắm (Frontend Hardening)
* Dựng trang Checkout hoàn chỉnh trên Next.js (`/thanh-toan`), cho phép khách chọn địa chỉ nhận hàng từ sổ địa chỉ và chọn phương thức thanh toán (COD hoặc Chuyển khoản VietQR).
* Hiển thị mã QR động VietQR kèm số tài khoản và cú pháp chuyển khoản chính xác tại màn hình cảm ơn đặt hàng.

### Giai Đoạn 2: Tích Hợp Cổng Thanh Toán Trực Tuyến (Payment Gateway Integration)
* Hiện thực hóa adapter kết nối cổng thanh toán trực tuyến (PayOS, VNPay, MoMo) trong `services/order-service/src/payments/providers`.
* Cung cấp webhook tiếp nhận kết quả thanh toán tức thì (IPN - Instant Payment Notification) có xác thực chữ ký HMAC-SHA256.

### Giai Đoạn 3: Tối Ưu Hóa Hiệu Năng & Bộ Nhớ Đệm (Redis Integration)
* Tích hợp `@nestjs/throttler-storage-redis` cho API Gateway.
* Caching thông tin danh mục, thương hiệu và sản phẩm phân bón phổ biến bằng Redis.
* Sử dụng BullMQ quản lý hàng đợi tác vụ bồi hoàn và tự động quét tồn kho quá hạn định kỳ.

### Giai Đoạn 4: Giám Sát Phân Tán (Observability & Monitoring)
* Tích hợp bộ thu thập số liệu OpenTelemetry SDK vào toàn bộ các microservices.
* Dựng cụm giám sát Prometheus + Grafana theo dõi thời gian đáp ứng (latency), tỷ lệ lỗi và số lượng giao dịch.

---

## 43. Troubleshooting (Khắc Phục Sự Cố Thường Gặp)

### 1. Lỗi xung đột cổng 3306 MySQL trên máy host
* *Nguyên nhân*: Máy tính của bạn đã cài sẵn dịch vụ MySQL chạy nền trên cổng 3306.
* *Khắc phục*: Docker Compose của dự án đã được ánh xạ sẵn sang cổng **`3307`** trên host (`3307:3306`). Đảm bảo file `.env` của bạn cấu hình `MYSQL_PORT=3307` và các chuỗi kết nối `*_DATABASE_URL` trỏ vào `localhost:3307`.

### 2. Lỗi `EPERM: operation not permitted` khi chạy npm script trên Windows
* *Nguyên nhân*: Windows PowerShell ExecutionPolicy hạn chế thực thi script hoặc Node.js gặp xung đột quyền thư mục gốc.
* *Khắc phục*: Chạy terminal với quyền Administrator hoặc thực thi thông qua Command Prompt (`cmd.exe`), hoặc sử dụng môi trường Docker Compose để cách ly hoàn toàn môi trường hệ điều hành.

### 3. Lỗi `UnauthorizedAccess` trên PowerShell
* *Khắc phục*: Mở PowerShell với quyền Administrator và chạy lệnh:
  ```powershell
  Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

### 4. Khởi động lại dịch vụ khi thay đổi Prisma Schema
* Khi chỉnh sửa file `schema.prisma` trong bất kỳ service nào, bắt buộc phải chạy lại lệnh sinh client:
  ```bash
  npm run prisma:generate
  ```

---

## 44. Repository Conventions (Quy Ước Đóng Góp & Phát Triển)

* **Quy chuẩn Git Commit**: Tuân thủ chuẩn Conventional Commits (`feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`, `chore: ...`).
* **Kiểm tra trước khi commit**: Luôn đảm bảo mã nguồn vượt qua các bước kiểm chuẩn:
  ```bash
  npm run lint && npm run typecheck && npm run test
  ```
* **Quy ước đặt tên biến môi trường**: Dùng định dạng `SCREAMING_SNAKE_CASE`. Mọi biến mới phải được khai báo giá trị mẫu tại `.env.example`.
* **An toàn dữ liệu**: Tuyệt đối không commit file bí mật `.env`, chứng chỉ SSL (`*.pem`, `*.key`), hoặc credentials thật vào Git.

---

## 45. Conclusion (Kết Luận)

Hệ thống **PhanBonShop** là một giải pháp kiến trúc phần mềm chuyên sâu, giải quyết toàn diện các bài toán đặc thù của thương mại điện tử vật tư nông nghiệp Việt Nam. Với việc áp dụng chuẩn mực **Microservices Monorepo**, phân tách dữ liệu theo nguyên tắc **Database-per-Service**, bảo vệ giao dịch phân tán bằng **Saga Orchestration**, kiểm soát đồng thời chống oversell bằng **Pessimistic Locking**, và phân lập mạng nhiều lớp với **Docker Production Architecture**, dự án sở hữu nền tảng kỹ thuật vững chắc, có độ tin cậy cao và sẵn sàng đáp ứng nhu cầu mở rộng quy mô trong thực tế.

---

## 46. License (Giấy Phép Sử Dụng)

Dự án này được phát triển và phát hành theo giấy phép **MIT License**. Bạn được toàn quyền sử dụng, sao chép, sửa đổi và phân phối mã nguồn cho mục đích học tập, nghiên cứu hoặc thương mại theo các điều khoản của giấy phép.
