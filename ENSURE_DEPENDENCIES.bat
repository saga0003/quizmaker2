@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not exist package.json (
  echo ERROR: package.json is missing from this Evidara folder.
  exit /b 1
)

where node >nul 2>nul || (
  echo ERROR: Node.js is not installed. Install Node.js 22 LTS and try again.
  exit /b 1
)
where npm >nul 2>nul || (
  echo ERROR: npm is not available with Node.js.
  exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 20 (
  echo ERROR: Node.js 20 or newer is required. Node.js 22 LTS is recommended.
  exit /b 1
)

rem Fast path: a healthy existing install needs no network and no reinstall.
if exist node_modules\.bin\next.cmd (
  call npm ls --depth=0 >nul 2>nul
  if not errorlevel 1 (
    echo [Dependencies] Existing Evidara dependencies are ready.
    exit /b 0
  )
  echo [Dependencies] Existing node_modules needs repair.
)

echo [Dependencies] Installing/repairing Evidara automatically...
echo [Dependencies] First run requires internet access.

rem Use npm install instead of npm ci here on purpose.
rem npm install reconciles package.json with a stale package-lock.json and rewrites
rem the lockfile when necessary. This prevents EUSAGE lockfile-sync failures.
call npm install --no-audit --no-fund
if errorlevel 1 goto :failed

if not exist node_modules\.bin\next.cmd (
  echo ERROR: npm completed but Next.js was not found.
  exit /b 1
)

echo [Dependencies] Evidara dependencies are ready.
exit /b 0

:failed
echo.
echo ERROR: Evidara could not install its dependencies.
echo Check that this computer has internet access and that npmjs.org is reachable.
echo Then double-click TEST_EVIDARA.bat again.
exit /b 1
