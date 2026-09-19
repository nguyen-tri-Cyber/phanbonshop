# Nền Tảng Thương Mại Điện Tử Phân Bón Việt Nam (Phan Bon Shop)

Hệ thống kiến trúc Monorepo Microservices phục vụ chuỗi cung ứng, phân phối và bán lẻ phân bón, thuốc bảo vệ thực vật và vật tư nông nghiệp dành cho thị trường Việt Nam (Nhà nông, Đại lý cấp 1, Đại lý cấp 2, Doanh nghiệp canh tác).

---

## 1. Yêu Cầu Môi Trường (Prerequisites)

* **Node.js**: Phiên bản `>= 20.x` (Khuyến nghị LTS hoặc v24.x)
* **npm**: Phiên bản `>= 10.x` (Hỗ trợ native npm workspaces)
* **Git**: `>= 2.40.x`
* **Docker Desktop**: Hỗ trợ Docker Engine & Docker Compose v2+
* **Lưu ý Port mạng trên máy Host**:
  * Nếu máy tính của bạn đã cài đặt MySQL cục bộ chạy trên port `3306`, Docker Compose của dự án đã được cấu hình mặc định ánh xạ MySQL sang port **`3307`** trên host (`3307:3306`) để tránh xung đột.
  * MinIO Object Storage sử dụng port **`9000`** (API S3) và **`9001`** (Web Console).

---

## 2. Cấu Trúc Monorepo

```text
phanbonshop/
├── apps/
│   ├── frontend/            # Web storefront cho Khách hàng & Đại lý đặt hàng
│   └── api-gateway/         # Reverse proxy & Routing trung tâm hệ thống
├── services/
│   ├── auth-service/        # Quản lý tài khoản, JWT token, xác thực & phân quyền RBAC
│   ├── product-service/     # Quản lý danh mục NPK, hữu cơ, quy cách bao bì, giá niêm yết
│   ├── order-service/       # Đơn hàng, thanh toán (COD, VietQR, công nợ mùa vụ)
│   ├── inventory-service/   # Quản lý kho bãi, quản lý lô hàng & hạn sử dụng phân bón
│   ├── customer-service/    # Hồ sơ nông dân, hồ sơ đại lý, hạn mức tín dụng
│   └── content-service/     # Cẩm nang kỹ thuật bón phân, mùa vụ, tin tức nông sản
├── packages/
│   ├── tsconfig/            # Cấu hình TypeScript strict mode chuẩn hóa dùng chung
│   ├── eslint-config/       # Cấu hình ESLint & quy chuẩn mã nguồn dùng chung
│   ├── shared-types/        # Contracts, DTOs, Enums dùng chung (không dính dáng ORM)
│   ├── shared-utils/        # Tiện ích format VND, validate số điện thoại VN, slug tiếng Việt
│   ├── config/              # Helper đọc biến môi trường có kiểm tra kiểu dữ liệu
│   └── logger/              # Structured logger chuẩn cho toàn bộ microservices
├── docker/
│   ├── mysql/               # init.sql khởi tạo cơ sở dữ liệu độc lập cho từng service
│   └── minio/               # Thư mục cấu hình lưu trữ tài liệu, hình ảnh bao bì
├── docker-compose.yml       # Điều phối container MySQL (port 3307) và MinIO (9000/9001)
├── .env.example             # Mẫu biến môi trường cho toàn bộ hệ sinh thái
├── .eslintrc.js             # Root ESLint cấu hình kế thừa
├── .prettierrc              # Cấu hình format mã nguồn
├── package.json             # Cấu hình root workspace điều phối build, lint, typecheck
└── README.md                # Tài liệu hướng dẫn này
```

---

## 3. Cài Đặt Dependencies

Sử dụng native **npm workspaces** tại thư mục gốc của repository:

```bash
# Cài đặt toàn bộ dependencies cho root và tất cả các workspaces
npm install
```

---

## 4. Kiểm Tra & Biên Dịch (Build Pipeline)

Hệ thống cung cấp các scripts chuẩn hóa điều phối toàn bộ workspaces:

### 4.1. Kiểm tra kiểu TypeScript (Strict Mode)
Chạy kiểm tra TypeScript trên toàn bộ các packages, apps và services mà không sinh file:
```bash
npm run typecheck
```

### 4.2. Biên dịch mã nguồn (Build)
Biên dịch các packages dùng chung trước, sau đó biên dịch toàn bộ microservices và applications:
```bash
npm run build
```
Kết quả biên dịch sẽ nằm trong thư mục `dist/` của từng workspace tương ứng.

### 4.3. Kiểm tra định dạng & Quy chuẩn (Lint)
Chạy kiểm tra ESLint trên toàn monorepo:
```bash
npm run lint
```

### 4.4. Tự động format code (Prettier)
```bash
npm run format
```

---

## 5. Khởi Động Hạ Tầng Cơ Sở Dữ Liệu (Docker)

Trước khi chạy các services, hãy khởi động MySQL và MinIO:

1. Sao chép cấu hình môi trường:
   ```bash
   cp .env.example .env
   ```
2. Khởi động Docker containers:
   ```bash
   docker compose up -d
   ```
3. Kiểm tra trạng thái:
   ```bash
   docker compose ps
   ```
   * MySQL chạy tại: `localhost:3307` (user: `phanbon_user`, password: `phanbon_secret`)
   * MinIO S3 API tại: `http://localhost:9000`
   * MinIO Web Console tại: `http://localhost:9001` (user: `admin`, password: `admin123456`)
