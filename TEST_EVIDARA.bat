@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Evidara V19 - Local Test

echo ============================================================
echo EVIDARA V19 - LOCAL TEST
echo Add .env or .env.local to this folder, then run this file.
echo This does not publish or change the online website.
echo ============================================================
echo.

if not exist package.json (
  echo ERROR: Put this BAT file inside the Evidara project folder.
  pause
  exit /b 1
)

where node >nul 2>nul || (
  echo ERROR: Node.js is not installed. Install Node.js 22 LTS and try again.
  pause
  exit /b 1
)
where npm >nul 2>nul || (
  echo ERROR: npm is not available with Node.js.
  pause
  exit /b 1
)

if not exist .env.local if not exist .env (
  echo ERROR: No environment file was found.
  echo Add your real .env or .env.local beside this BAT file, then try again.
  pause
  exit /b 1
)

if not exist scripts\check-local-env.mjs (
  echo ERROR: scripts\check-local-env.mjs is missing.
  pause
  exit /b 1
)

if not exist ENSURE_DEPENDENCIES.bat (
  echo ERROR: ENSURE_DEPENDENCIES.bat is missing.
  pause
  exit /b 1
)

echo [1/3] Checking and repairing dependencies automatically...
call "%~dp0ENSURE_DEPENDENCIES.bat"
if errorlevel 1 (
  echo.
  echo Dependency setup failed. Read the error above.
  pause
  exit /b 1
)

call node scripts\check-local-env.mjs
if errorlevel 1 (
  echo.
  echo Correct only the environment item reported above, then run TEST_EVIDARA.bat again.
  pause
  exit /b 1
)

echo.
echo [2/3] Checking the complete Evidara V19.1 release before starting...
call npm run qa:final
if errorlevel 1 (
  echo.
  echo RELEASE PREFLIGHT FAILED. Evidara was not started and should not be deployed yet.
  echo Fix the final error shown above, then run TEST_EVIDARA.bat again.
  pause
  exit /b 1
)

echo.
echo [3/3] RELEASE PREFLIGHT PASSED. Starting the local app...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if(-not $c){exit 1}; try{$r=Invoke-RestMethod -Uri 'http://localhost:3000/api/health' -TimeoutSec 4; if($r.release -eq '19.1.0'){exit 0}}catch{}; exit 2"
if %ERRORLEVEL% EQU 0 goto :ready
if %ERRORLEVEL% EQU 2 (
  echo.
  echo ERROR: Port 3000 is already being used by another application.
  echo Close that application, then run TEST_EVIDARA.bat again.
  pause
  exit /b 1
)

if not exist RUN_EVIDARA_SERVER.bat (
  echo ERROR: RUN_EVIDARA_SERVER.bat is missing.
  pause
  exit /b 1
)

start "" "%~dp0RUN_EVIDARA_SERVER.bat"
echo Starting Evidara...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline=(Get-Date).AddSeconds(120); do { try{$r=Invoke-RestMethod -Uri 'http://localhost:3000/api/health' -TimeoutSec 3; if($r.release -eq '19.1.0'){exit 0}}catch{}; Start-Sleep -Seconds 2 } while((Get-Date)-lt $deadline); exit 1"
if errorlevel 1 (
  echo.
  echo Evidara did not start within two minutes.
  echo Read the separate window named 'Evidara Dev Server - KEEP THIS WINDOW OPEN'.
  echo The final red/error lines in that window explain the remaining issue.
  pause
  exit /b 1
)

:ready
start "" http://localhost:3000
echo Evidara is running at http://localhost:3000
echo Keep the server window open while using the application.
timeout /t 3 /nobreak >nul
exit /b 0
