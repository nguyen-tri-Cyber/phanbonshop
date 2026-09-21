#!/usr/bin/env bash
# ==============================================================================
# PhanBonShop — Generate Self-Signed SSL Certificates for Local/Staging
# ==============================================================================
set -euo pipefail

CERT_DIR="${1:-./.local/certs}"
# Generated certificates must never be committed.
mkdir -p "${CERT_DIR}"

KEY_FILE="${CERT_DIR}/privkey.pem"
CERT_FILE="${CERT_DIR}/fullchain.pem"

echo "======================================================================"
echo " [PhanBonShop] Khởi tạo chứng chỉ SSL tự ký (Self-signed TLS/SSL)"
echo " Thư mục đích: ${CERT_DIR}"
echo "======================================================================"

openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout "${KEY_FILE}" \
  -out "${CERT_FILE}" \
  -subj "/C=VN/ST=An Giang/L=Long Xuyen/O=PhanBonShop/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:*.local.test,DNS:phanbonshop.vn,IP:127.0.0.1"

chmod 600 "${KEY_FILE}"
chmod 644 "${CERT_FILE}"

echo "✅ Đã tạo thành công:"
echo "   - Khóa riêng tư: ${KEY_FILE}"
echo "   - Chứng chỉ công khai: ${CERT_FILE}"
echo "======================================================================"
