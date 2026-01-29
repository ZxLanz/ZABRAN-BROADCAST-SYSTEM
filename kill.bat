@echo off
setlocal
title Zabran Broadcast System - SHUTDOWN
call banner.bat

rem -- LOGGING SETUP --
echo. >> system.log
echo [%date% %time%] [SHUTDOWN] Initiating Stop Sequence... >> system.log

rem -- COLORS --
call :PrintColor "Red" "[%time%] Stopping Zabran Broadcast System..."
echo.
call :PrintColor "Cyan" "==================================="

rem -- STEP 1: BACKEND --
call :PrintColor "Yellow" "[%time%] [1/2] Stopping Backend and n8n (PM2)..."
call pm2 stop all >nul 2>&1
call :PrintColor "Red" "   - PM2 Processes Stopped!"
echo [%date% %time%] [INFO] PM2 Services Stopped >> system.log

rem -- STEP 2: NGINX --
call :PrintColor "Yellow" "[%time%] [2/2] Stopping Nginx Web Server..."
taskkill /F /IM nginx.exe >nul 2>&1
call :PrintColor "Red" "   - Nginx Stopped!"
echo [%date% %time%] [INFO] Nginx Stopped >> system.log

rem -- FINISH --
call :PrintColor "Cyan" "==================================="
call :PrintColor "Red" "[%time%] SYSTEM OFFLINE!"
echo [%date% %time%] [SUCCESS] SYSTEM OFFLINE >> system.log
echo.
pause
exit /b

rem -- COLOR HELPER --
:PrintColor
powershell -NoProfile -Command "Write-Host '%~2' -ForegroundColor %~1"
exit /b
