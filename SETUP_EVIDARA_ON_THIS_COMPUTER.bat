@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Evidara V19 - Optional Vercel Setup

echo ============================================================
echo EVIDARA V19 - OPTIONAL ONE-TIME VERCEL SETUP
echo Project: quizmaker2
echo ============================================================
echo.

if not exist package.json (
  echo ERROR: Run this file from the Evidara project folder beside package.json.
  pause
  exit /b 1
)

where node >nul 2>nul || (
  echo ERROR: Node.js is not installed. Install Node.js 22 LTS.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 20 (
  echo ERROR: Node.js 20 or newer is required. Node.js 22 LTS is recommended.
  pause
  exit /b 1
)

echo [1/4] Installing/repairing dependencies...
if not exist ENSURE_DEPENDENCIES.bat (
  echo ERROR: ENSURE_DEPENDENCIES.bat is missing.
  goto :failed
)
call "%~dp0ENSURE_DEPENDENCIES.bat"
if errorlevel 1 goto :failed

echo [2/4] Signing in to Vercel...
call npx vercel login
if errorlevel 1 goto :failed

echo [3/4] Linking this folder to quizmaker2...
call npx vercel link --yes --project quizmaker2 --scope saga0003s-projects
if errorlevel 1 goto :failed

echo [4/4] Checking the local environment...
if not exist .env.local if not exist .env (
  copy /y .env.example .env.local >nul
  echo Created .env.local from the safe template.
  echo Insert the real Supabase and R2 values, save it, then continue.
  start "" notepad "%~dp0.env.local"
  pause
)
call node scripts\check-local-env.mjs
if errorlevel 1 goto :failed

echo.
echo SETUP COMPLETE.
echo Use TEST_EVIDARA.bat while developing.
echo Use PUBLISH_EVIDARA.bat only after testing and after the same secrets are configured in Vercel.
pause
exit /b 0

:failed
echo.
echo SETUP STOPPED because a command failed. Nothing was published.
pause
exit /b 1
