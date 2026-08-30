@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Evidara V19 - Publish to Vercel

echo ============================================================
echo EVIDARA V19 - PRODUCTION PUBLISH TO VERCEL
echo Target: linked quizmaker2 Vercel project
echo IMPORTANT: Configure the production environment variables in Vercel too.
echo Your local .env/.env.local is intentionally not uploaded as source.
echo ============================================================
echo.

if not exist .env.local if not exist .env (
  echo ERROR: Add .env or .env.local for local verification first.
  pause
  exit /b 1
)

if not exist ENSURE_DEPENDENCIES.bat (
  echo ERROR: ENSURE_DEPENDENCIES.bat is missing.
  goto :failed
)
call "%~dp0ENSURE_DEPENDENCIES.bat"
if errorlevel 1 goto :failed

call node scripts\check-local-env.mjs
if errorlevel 1 goto :failed
call npm run qa:final
if errorlevel 1 goto :failed

echo.
set /p CONFIRM=Type PUBLISH to deploy this verified build to production: 
if /I not "%CONFIRM%"=="PUBLISH" (
  echo Publishing cancelled.
  pause
  exit /b 0
)

call npx vercel deploy --prod
if errorlevel 1 goto :failed

echo.
echo PRODUCTION DEPLOYMENT COMPLETED.
pause
exit /b 0

:failed
echo.
echo PUBLISH STOPPED. Nothing new was promoted to production.
echo Read the final error above.
pause
exit /b 1
