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

rem -- STEP 2: BACKEND --
call :PrintColor "Yellow" "[%time%] [2/3] Starting Backend Server..."
cd /d "C:\Zabran-Broadcast-System"
call pm2 resurrect >nul 2>&1
call pm2 start ecosystem.config.js --only zabran-backend --env production >nul 2>&1
call :PrintColor "Green" "   - Backend Started!"
echo [%date% %time%] [INFO] Backend Started >> system.log

rem -- STEP 3: N8N AI WORKFLOW --
call :PrintColor "Yellow" "[%time%] [3/3] Starting n8n AI Engine..."
call pm2 start ecosystem.config.js --only zabran-n8n --env production >nul 2>&1
call :PrintColor "Green" "   - n8n Started!"
echo [%date% %time%] [INFO] n8n Started >> system.log

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
