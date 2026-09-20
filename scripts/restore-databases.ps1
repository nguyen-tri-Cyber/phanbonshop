# ==============================================================================
# PhanBonShop — Automated Database Restore Script (PowerShell for Windows)
# Khôi phục dữ liệu từ thư mục backup cho diễn tập khôi phục thảm họa (Disaster Recovery)
# ==============================================================================
param (
    [Parameter(Mandatory=$true)]
    [string]$BackupDir,
    [string]$MySqlHost = "127.0.0.1",
    [int]$MySqlPort = 3307,
    [string]$MySqlUser = "root",
    [string]$MySqlPassword = "root_secret"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupDir)) {
    Write-Error "Loi: Thu muc sao luu '$BackupDir' khong ton tai!"
    exit 1
}

$Databases = @("auth_db", "product_db", "order_db", "inventory_db", "customer_db", "content_db")

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " [PhanBonShop] Khoi phuc co so du lieu tu: $BackupDir" -ForegroundColor Green
Write-Host " Dich: ${MySqlHost}:${MySqlPort} | User: ${MySqlUser}" -ForegroundColor Gray
Write-Host "======================================================================" -ForegroundColor Cyan

$RestoreCount = 0

foreach ($Db in $Databases) {
    $SqlFile = Get-ChildItem -Path $BackupDir -Filter "${Db}_*.sql" | Select-Object -First 1

    if (-not $SqlFile) {
        Write-Host "--- Bo qua [$Db]: Khong tim thay file sao luu tuong ung." -ForegroundColor Yellow
        continue
    }

    Write-Host "--- Dang khoi phuc [$Db] tu $($SqlFile.FullName) ... " -NoNewline

    try {
        $dockerCheck = docker ps --filter "name=phanbonshop_mysql" --format "{{.Names}}" 2>$null
        if ($dockerCheck -eq "phanbonshop_mysql") {
            Get-Content $SqlFile.FullName | & docker exec -i -e "MYSQL_PWD=$MySqlPassword" phanbonshop_mysql mysql -u $MySqlUser $Db
        } else {
            Get-Content $SqlFile.FullName | & mysql --host=$MySqlHost --port=$MySqlPort -u $MySqlUser "-p$MySqlPassword" $Db
        }
        Write-Host "XONG" -ForegroundColor Green
        $RestoreCount++
    } catch {
        Write-Host "LOI: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " Hoan tat khoi phuc thanh cong $RestoreCount co so du lieu." -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
