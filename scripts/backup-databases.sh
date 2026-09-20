#!/usr/bin/env bash
# ==============================================================================
# PhanBonShop — Automated Database Backup Script (TASK-P5-02 / AUD-P1-002)
# Hỗ trợ sao lưu toàn diện 6 Microservices Databases
# ==============================================================================
set -euo pipefail

# 1. Cấu hình kết nối MySQL (Mặc định phù hợp với docker-compose và local dev)
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3307}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASSWORD="${MYSQL_ROOT_PASSWORD:-${MYSQL_PASSWORD:-root_secret}}"

# Danh sách 6 cơ sở dữ liệu logical của hệ thống
DATABASES=("auth_db" "product_db" "order_db" "inventory_db" "customer_db" "content_db")

# 2. Thư mục đích lưu trữ bản sao lưu
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_BASE_DIR="${BACKUP_DIR:-./backups}"
TARGET_DIR="${BACKUP_BASE_DIR}/backup_${TIMESTAMP}"

mkdir -p "${TARGET_DIR}"

echo "======================================================================"
echo " [PhanBonShop] Khởi chạy sao lưu cơ sở dữ liệu: ${TIMESTAMP}"
echo " Host: ${MYSQL_HOST}:${MYSQL_PORT} | User: ${MYSQL_USER}"
echo " Thư mục sao lưu: ${TARGET_DIR}"
echo "======================================================================"

# Kiểm tra công cụ mysqldump hoặc docker exec
USE_DOCKER=false
if ! command -v mysqldump &> /dev/null; then
  if command -v docker &> /dev/null && docker ps | grep -q "phanbonshop_mysql"; then
    echo "⚠️ Không tìm thấy lệnh 'mysqldump' cục bộ. Chuyển sang sử dụng docker exec phanbonshop_mysql..."
    USE_DOCKER=true
  else
    echo "❌ Lỗi: Cần cài đặt 'mysqldump' hoặc khởi chạy container 'phanbonshop_mysql'."
    exit 1
  fi
fi

TOTAL_SUCCESS=0
TOTAL_FAILED=0

for DB in "${DATABASES[@]}"; do
  OUTPUT_FILE="${TARGET_DIR}/${DB}_${TIMESTAMP}.sql"
  echo -n "--- Đang sao lưu [${DB}] -> ${OUTPUT_FILE} ... "

  if [ "$USE_DOCKER" = true ]; then
    if docker exec -e MYSQL_PWD="${MYSQL_PASSWORD}" phanbonshop_mysql \
      mysqldump --single-transaction --quick --routines --triggers -u "${MYSQL_USER}" "${DB}" > "${OUTPUT_FILE}"; then
      echo "✅ XONG ($(wc -c < "${OUTPUT_FILE}") bytes)"
      TOTAL_SUCCESS=$((TOTAL_SUCCESS + 1))
    else
      echo "❌ THẤT BẠI"
      TOTAL_FAILED=$((TOTAL_FAILED + 1))
    fi
  else
    if mysqldump --host="${MYSQL_HOST}" --port="${MYSQL_PORT}" -u "${MYSQL_USER}" -p"${MYSQL_PASSWORD}" \
      --single-transaction --quick --routines --triggers "${DB}" > "${OUTPUT_FILE}" 2>/dev/null; then
      echo "✅ XONG ($(wc -c < "${OUTPUT_FILE}") bytes)"
      TOTAL_SUCCESS=$((TOTAL_SUCCESS + 1))
    else
      echo "❌ THẤT BẠI"
      TOTAL_FAILED=$((TOTAL_FAILED + 1))
    fi
  fi

  # Nén gzip nếu có công cụ gzip
  if [ -f "${OUTPUT_FILE}" ] && command -v gzip &> /dev/null; then
    gzip -f "${OUTPUT_FILE}"
  fi
done

# Tạo file metadata.json
cat <<EOF > "${TARGET_DIR}/metadata.json"
{
  "timestamp": "${TIMESTAMP}",
  "host": "${MYSQL_HOST}:${MYSQL_PORT}",
  "totalDatabases": ${#DATABASES[@]},
  "successCount": ${TOTAL_SUCCESS},
  "failedCount": ${TOTAL_FAILED},
  "databases": [$(printf '"%s",' "${DATABASES[@]}" | sed 's/,$//')]
}
EOF

echo "======================================================================"
echo " Hoàn tất sao lưu: ${TOTAL_SUCCESS}/${#DATABASES[@]} cơ sở dữ liệu thành công."
echo " Bản sao lưu được lưu tại: ${TARGET_DIR}"
echo "======================================================================"

if [ "${TOTAL_FAILED}" -gt 0 ]; then
  exit 1
fi
