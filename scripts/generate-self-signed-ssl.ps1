# ==============================================================================
# PhanBonShop — Generate Self-Signed SSL Certificates (PowerShell for Windows)
# ==============================================================================
param (
    [string]$CertDir = "./docker/nginx/certs"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $CertDir)) {
    New-Item -ItemType Directory -Path $CertDir -Force | Out-Null
}

$KeyFile = Join-Path $CertDir "privkey.pem"
$CertFile = Join-Path $CertDir "fullchain.pem"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " [PhanBonShop] Khoi tao chung chi SSL tu ky (Self-signed TLS/SSL)" -ForegroundColor Green
Write-Host " Thu muc dich: $CertDir" -ForegroundColor Gray
Write-Host "======================================================================" -ForegroundColor Cyan

$opensslPath = "openssl"
if (-not (Get-Command "openssl" -ErrorAction SilentlyContinue)) {
    $gitOpenssl = "C:\Program Files\Git\usr\bin\openssl.exe"
    if (Test-Path $gitOpenssl) {
        $opensslPath = $gitOpenssl
    } else {
        Write-Error "Loi: Khong tim thay openssl. Vui long cai dat OpenSSL hoac Git for Windows!"
        exit 1
    }
}

& $opensslPath req -x509 -nodes -days 3650 -newkey rsa:2048 `
    -keyout $KeyFile `
    -out $CertFile `
    -subj "/C=VN/ST=An Giang/L=Long Xuyen/O=PhanBonShop/CN=localhost" `
    -addext "subjectAltName=DNS:localhost,DNS:*.local.test,DNS:phanbonshop.vn,IP:127.0.0.1"

Write-Host " Da tao thanh cong:" -ForegroundColor Green
Write-Host "   - Khoa rieng tu: $KeyFile" -ForegroundColor Gray
Write-Host "   - Chung chi cong khai: $CertFile" -ForegroundColor Gray
Write-Host "======================================================================" -ForegroundColor Cyan
