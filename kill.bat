@echo off
setlocal
title Zabran Broadcast System - SHUTDOWN
call banner.bat

rem -- LOGGING SETUP --
echo. >> system.log
echo --------------------------------------------------------------- >> system.log
echo [%date% %time%] [SHUTDOWN] Initiating Stop Sequence... >> system.log

rem -- COLORS --
call :PrintColor "Red" "[%time%] Stopping Zabran Broadcast System..."
echo.
call :PrintColor "Cyan" "==================================="

rem -- STEP 1: N8N AI --
call :PrintColor "Yellow" "[%time%] [1/3] Stopping n8n AI Engine..."
call pm2 stop zabran-n8n >nul 2>&1
call :PrintColor "Red" "   - n8n Stopped!"
echo [%date% %time%] [INFO] n8n Stopped >> system.log

rem -- STEP 2: BACKEND --
call :PrintColor "Yellow" "[%time%] [2/3] Stopping Backend Server..."
call pm2 stop zabran-backend >nul 2>&1
call :PrintColor "Red" "   - Backend Stopped!"
echo [%date% %time%] [INFO] Backend Stopped >> system.log

rem -- STEP 2: NGINX --
call :PrintColor "Yellow" "[%time%] [3/3] Stopping Nginx Web Server..."
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
