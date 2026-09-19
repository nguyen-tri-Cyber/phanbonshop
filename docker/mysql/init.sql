-- ====================================================================
-- Script khởi tạo cơ sở dữ liệu cho môi trường Local Development
-- Dự án: Phan Bon Shop (fertilizer-commerce)
-- Lưu ý: Chỉ sử dụng cho môi trường phát triển cục bộ (Local Development)
-- ====================================================================

-- 1. Thiết lập charset, collation và timezone phiên làm việc
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+07:00';

-- 2. Tạo 6 logical database tương ứng cho 6 Microservices (Database-per-service pattern)
CREATE DATABASE IF NOT EXISTS `auth_db` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS `product_db` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS `order_db` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS `inventory_db` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS `customer_db` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS `content_db` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

-- 3. Phân quyền đầy đủ cho user phanbon_user trên toàn bộ 6 database
GRANT ALL PRIVILEGES ON `auth_db`.* TO 'phanbon_user'@'%';
GRANT ALL PRIVILEGES ON `product_db`.* TO 'phanbon_user'@'%';
GRANT ALL PRIVILEGES ON `order_db`.* TO 'phanbon_user'@'%';
GRANT ALL PRIVILEGES ON `inventory_db`.* TO 'phanbon_user'@'%';
GRANT ALL PRIVILEGES ON `customer_db`.* TO 'phanbon_user'@'%';
GRANT ALL PRIVILEGES ON `content_db`.* TO 'phanbon_user'@'%';

FLUSH PRIVILEGES;
