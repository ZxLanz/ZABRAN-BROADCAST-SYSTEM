@echo off
setlocal
title Zabran Broadcast System - STARTUP
call banner.bat

rem -- LOGGING SETUP --
echo. >> system.log
echo [%date% %time%] [STARTUP] Initiating Start Sequence... >> system.log

rem -- COLORS --
call :PrintColor "White" "[%time%] Starting Zabran Broadcast System..."
echo.
call :PrintColor "Cyan" "==================================="

rem -- STEP 1: NGINX --
call :PrintColor "Yellow" "[%time%] [1/2] Starting Nginx Web Server..."
cd /d "C:\Zabran-Broadcast-System\nginx-bin\nginx-1.24.0"
start nginx.exe
call :PrintColor "Green" "   - Nginx Started!"
echo [%date% %time%] [INFO] Nginx Started >> C:\Zabran-Broadcast-System\system.log

rem -- STEP 2: BACKEND & N8N --
call :PrintColor "Yellow" "[%time%] [2/2] Starting Backend and n8n (PM2)..."
cd /d "C:\Zabran-Broadcast-System"
call pm2 resurrect >nul 2>&1
call pm2 start ecosystem.config.js >nul 2>&1
call :PrintColor "Green" "   - Backend Services Started!"
echo [%date% %time%] [INFO] PM2 Services Started >> system.log

rem -- FINISH --
call :PrintColor "Cyan" "==================================="
call :PrintColor "Green" "[%time%] SYSTEM ONLINE!" 
echo.
call :PrintColor "White" "Access at: http://localhost"
echo [%date% %time%] [SUCCESS] SYSTEM ONLINE >> system.log
echo.
pause
exit /b

rem -- COLOR HELPER FUNCTION --
:PrintColor
powershell -NoProfile -Command "Write-Host '%~2' -ForegroundColor %~1"
exit /b
