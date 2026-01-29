@echo off
title Zabran Broadcast System - SARE (RESTART)

echo ===================================
echo   RESTARTING SYSTEM (SARE)...
echo ===================================

call kill.bat

echo.
echo Waiting 2 seconds...
timeout /t 2 /nobreak >nul

call mulai.bat
