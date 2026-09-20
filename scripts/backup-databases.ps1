# ==============================================================================
# PhanBonShop — Automated Database Backup Script (PowerShell for Windows)
# Hỗ trợ sao lưu toàn diện 6 Microservices Databases
# ==============================================================================
param (
    [string]$MySqlHost = "127.0.0.1",
    [int]$MySqlPort = 3307,
    [string]$MySqlUser = "root",
    [string]$MySqlPassword = "root_secret",
    [string]$BackupBaseDir = "./backups"
)

$ErrorActionPreference = "Stop"

$Databases = @("auth_db", "product_db", "order_db", "inventory_db", "customer_db", "content_db")
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$TargetDir = Join-Path $BackupBaseDir "backup_$Timestamp"

if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " [PhanBonShop] Khoi chay sao luu co so du lieu: $Timestamp" -ForegroundColor Green
Write-Host " Host: ${MySqlHost}:${MySqlPort} | User: ${MySqlUser}" -ForegroundColor Gray
Write-Host " Thu muc sao luu: $TargetDir" -ForegroundColor Gray
Write-Host "======================================================================" -ForegroundColor Cyan

$TotalSuccess = 0
$TotalFailed = 0

foreach ($Db in $Databases) {
    $OutputFile = Join-Path $TargetDir "${Db}_${Timestamp}.sql"
    Write-Host "--- Dang sao luu [$Db] -> $OutputFile ... " -NoNewline

    try {
        # Thu su dung docker exec neu container dang chay
        $dockerCheck = docker ps --filter "name=phanbonshop_mysql" --format "{{.Names}}" 2>$null
        if ($dockerCheck -eq "phanbonshop_mysql") {
            & docker exec -e "MYSQL_PWD=$MySqlPassword" phanbonshop_mysql mysqldump --single-transaction --quick --routines --triggers -u $MySqlUser $Db | Out-File -FilePath $OutputFile -Encoding utf8
        } else {
            & mysqldump --host=$MySqlHost --port=$MySqlPort -u $MySqlUser "-p$MySqlPassword" --single-transaction --quick --routines --triggers $Db | Out-File -FilePath $OutputFile -Encoding utf8
        }

        if (Test-Path $OutputFile) {
            $size = (Get-Item $OutputFile).Length
            Write-Host "XONG ($size bytes)" -ForegroundColor Green
            $TotalSuccess++
        } else {
            Write-Host "THAT BAI (File khong ton tai)" -ForegroundColor Red
            $TotalFailed++
        }
    } catch {
        Write-Host "LOI: $($_.Exception.Message)" -ForegroundColor Red
        $TotalFailed++
    }
}

$metadata = [PSCustomObject]@{
    timestamp = $Timestamp
    host = "${MySqlHost}:${MySqlPort}"
    totalDatabases = $Databases.Count
    successCount = $TotalSuccess
    failedCount = $TotalFailed
    databases = $Databases
}

$metadata | ConvertTo-Json -Depth 3 | Out-File -FilePath (Join-Path $TargetDir "metadata.json") -Encoding utf8

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " Hoan tat sao luu: $TotalSuccess/$($Databases.Count) co so du lieu thanh cong." -ForegroundColor Green
Write-Host " Ban sao luu duoc luu tai: $TargetDir" -ForegroundColor Gray
Write-Host "======================================================================" -ForegroundColor Cyan
