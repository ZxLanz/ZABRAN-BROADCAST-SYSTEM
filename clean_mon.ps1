$ErrorActionPreference = "SilentlyContinue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

# SHOW BANNER
& "C:\Zabran-Broadcast-System\banner_color.ps1"

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "  ZABRAN LIVE LOGS (CLEAN FILTERED)" -ForegroundColor White
Write-Host "  (Press 'Ctrl+C' to Stop)" -ForegroundColor Gray
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# Stream logs and filter using Select-String (Better for performance & colors)
pm2 logs --raw --lines 50 | Select-String -NotMatch "pidusage|spawn wmic|ENOENT"
