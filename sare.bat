@echo off
title Zabran Broadcast System - SARE (RESTART)

echo ===================================
echo   RESTARTING SYSTEM (SARE)...
echo ===================================

call kill.bat

echo.
call :PrintColor "Yellow" "   Restarting in 3..."
timeout /t 1 /nobreak >nul
call :PrintColor "Yellow" "   Restarting in 2..."
timeout /t 1 /nobreak >nul
call :PrintColor "Yellow" "   Restarting in 1..."
timeout /t 1 /nobreak >nul
echo.

call mulai.bat
exit /b

:PrintColor
powershell -NoProfile -Command "Write-Host '%~2' -ForegroundColor %~1"
exit /b
