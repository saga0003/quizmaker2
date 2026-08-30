@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Evidara Dev Server - KEEP THIS WINDOW OPEN

echo ============================================================
echo EVIDARA LOCAL DEVELOPMENT SERVER
echo Keep this window open while using http://localhost:3000
echo ============================================================
echo.

call npm run dev
set EXIT_CODE=%ERRORLEVEL%

echo.
echo ============================================================
echo Evidara server stopped with exit code %EXIT_CODE%.
echo Copy or photograph the error shown above if support is needed.
echo ============================================================
pause
exit /b %EXIT_CODE%
