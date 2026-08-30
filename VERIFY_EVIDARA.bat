@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Evidara V19 - Verify Current Source

echo ============================================================
echo EVIDARA V19 - VERIFY CURRENT SOURCE
echo No deployment. No Supabase data changes.
echo ============================================================
echo.

if not exist package.json (
  echo ERROR: Put this file beside package.json in the Evidara project folder.
  pause
  exit /b 1
)

if not exist ENSURE_DEPENDENCIES.bat (
  echo ERROR: ENSURE_DEPENDENCIES.bat is missing.
  goto :failed
)
call "%~dp0ENSURE_DEPENDENCIES.bat"
if errorlevel 1 goto :failed

call npm run qa:final
if errorlevel 1 goto :failed

echo.
echo ALL EVIDARA V19 CHECKS PASSED.
echo Nothing was deployed or written to Supabase.
pause
exit /b 0

:failed
echo.
echo VERIFICATION STOPPED because a check failed.
echo Nothing was deployed.
pause
exit /b 1
