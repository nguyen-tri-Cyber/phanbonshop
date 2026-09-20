#!/usr/bin/env bash
# ==============================================================================
# PhanBonShop — Let's Encrypt SSL Automated Setup Script (TASK-P6-01)
# Cấp phát chứng chỉ SSL/TLS miễn phí từ Let's Encrypt cho Production
# ==============================================================================
set -euo pipefail

DOMAIN="${1:-phanbonshop.vn}"
EMAIL="${2:-admin@phanbonshop.vn}"
STAGING="${3:-0}" # Đặt bằng 1 để test qua Let's Encrypt Staging API chống dính rate-limit

echo "======================================================================"
echo " [PhanBonShop] Thiết lập chứng chỉ Let's Encrypt SSL/TLS"
echo " Tên miền: ${DOMAIN}"
echo " Email quản trị: ${EMAIL}"
echo " Chế độ Staging: ${STAGING}"
echo "======================================================================"

if ! command -v certbot &> /dev/null; then
  echo "⚠️ Chưa cài đặt 'certbot'. Đang tiến hành cài đặt qua apt-get..."
  if command -v apt-get &> /dev/null; then
    sudo apt-get update -y && sudo apt-get install -y certbot
  else
    echo "❌ Lỗi: Hệ điều hành không hỗ trợ apt-get. Vui lòng cài đặt Certbot thủ công."
    exit 1
  fi
fi

STAGING_ARG=""
if [ "${STAGING}" != "0" ]; then
  STAGING_ARG="--staging"
fi

# Yêu cầu chứng chỉ từ Let's Encrypt qua standalone HTTP challenge
echo "Đang yêu cầu chứng chỉ từ Let's Encrypt..."
sudo certbot certonly --standalone \
  --preferred-challenges http \
  --agree-tos \
  --no-eff-email \
  --email "${EMAIL}" \
  -d "${DOMAIN}" \
  ${STAGING_ARG}

# Copy chứng chỉ vào thư mục cấu hình Nginx
TARGET_DIR="./docker/nginx/certs"
mkdir -p "${TARGET_DIR}"

sudo cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" "${TARGET_DIR}/fullchain.pem"
sudo cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" "${TARGET_DIR}/privkey.pem"
sudo chown "$(id -u):$(id -g)" "${TARGET_DIR}/fullchain.pem" "${TARGET_DIR}/privkey.pem"

echo "======================================================================"
echo "✅ Cấp phát và cài đặt chứng chỉ SSL Let's Encrypt thành công!"
echo "   Vị trí: ${TARGET_DIR}/fullchain.pem & privkey.pem"
echo ""
echo "Hướng dẫn thiết lập tự động gia hạn (Cronjob):"
echo "  0 3 * * 1 certbot renew --quiet --post-hook \"docker compose exec -T reverse-proxy nginx -s reload\""
echo "======================================================================"
