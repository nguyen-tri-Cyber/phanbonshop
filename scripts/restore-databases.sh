#!/usr/bin/env bash
# ==============================================================================
# PhanBonShop — Automated Database Restore Script (TASK-P5-02 / AUD-P1-002)
# Khôi phục dữ liệu từ thư mục backup cho diễn tập khôi phục thảm họa (Disaster Recovery)
# ==============================================================================
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Cách sử dụng: $0 <duong-dan-thu-muc-backup>"
  echo "Ví dụ: $0 ./backups/backup_20260920_120000"
  exit 1
fi

BACKUP_DIR="$1"

if [ ! -d "${BACKUP_DIR}" ]; then
  echo "❌ Lỗi: Thư mục backup '${BACKUP_DIR}' không tồn tại!"
  exit 1
fi

MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3307}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASSWORD="${MYSQL_ROOT_PASSWORD:-${MYSQL_PASSWORD:-root_secret}}"

DATABASES=("auth_db" "product_db" "order_db" "inventory_db" "customer_db" "content_db")

echo "======================================================================"
echo " [PhanBonShop] Khởi chạy khôi phục cơ sở dữ liệu từ: ${BACKUP_DIR}"
echo " Đích: ${MYSQL_HOST}:${MYSQL_PORT} | User: ${MYSQL_USER}"
echo "======================================================================"

USE_DOCKER=false
if ! command -v mysql &> /dev/null; then
  if command -v docker &> /dev/null && docker ps | grep -q "phanbonshop_mysql"; then
    echo "⚠️ Không tìm thấy lệnh 'mysql' cục bộ. Chuyển sang sử dụng docker exec phanbonshop_mysql..."
    USE_DOCKER=true
  else
    echo "❌ Lỗi: Cần cài đặt client 'mysql' hoặc khởi chạy container 'phanbonshop_mysql'."
    exit 1
  fi
fi

RESTORE_COUNT=0

for DB in "${DATABASES[@]}"; do
  # Tìm tệp nén hoặc tệp sql thường
  FILE=$(find "${BACKUP_DIR}" -name "${DB}_*.sql.gz" -o -name "${DB}_*.sql" | head -n 1 || true)

  if [ -z "${FILE}" ]; then
    echo "⚠️ Bỏ qua [${DB}]: Không tìm thấy tệp sao lưu tương ứng trong ${BACKUP_DIR}."
    continue
  fi

  echo -n "--- Đang khôi phục [${DB}] từ ${FILE} ... "

  TEMP_SQL="${FILE}"
  NEED_CLEANUP=false

  if [[ "${FILE}" == *.gz ]]; then
    TEMP_SQL=$(mktemp /tmp/restore_${DB}_XXXXXX.sql)
    gzip -dc "${FILE}" > "${TEMP_SQL}"
    NEED_CLEANUP=true
  fi

  if [ "$USE_DOCKER" = true ]; then
    docker exec -i -e MYSQL_PWD="${MYSQL_PASSWORD}" phanbonshop_mysql \
      mysql -u "${MYSQL_USER}" "${DB}" < "${TEMP_SQL}"
  else
    mysql --host="${MYSQL_HOST}" --port="${MYSQL_PORT}" -u "${MYSQL_USER}" -p"${MYSQL_PASSWORD}" \
      "${DB}" < "${TEMP_SQL}" 2>/dev/null
  fi

  if [ "$NEED_CLEANUP" = true ]; then
    rm -f "${TEMP_SQL}"
  fi

  echo "✅ XONG"
  RESTORE_COUNT=$((RESTORE_COUNT + 1))
done

echo "======================================================================"
echo " Hoàn tất khôi phục thành công ${RESTORE_COUNT} cơ sở dữ liệu."
echo "======================================================================"
