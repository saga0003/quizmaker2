@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Evidara - Check Local R2 Setup

echo ============================================================
echo EVIDARA CLOUDFLARE R2 LOCAL CHECK
echo ============================================================
echo.
call node scripts\check-r2-env.mjs
if errorlevel 1 goto :failed

echo.
echo Configuration format is valid.
echo Now run TEST_EVIDARA.bat and upload a small PNG, SVG or WebP
 echo from the Question Image field. The returned r2.dev/custom URL
 echo should appear immediately in the image URL box.
pause
exit /b 0

:failed
echo.
echo Open .env.local, add or correct the six R2 variables, save,
 echo and run this file again.
pause
exit /b 1
