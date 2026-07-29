@echo off
cd /d "%~dp0"
echo Syncing Tiled map into game...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-awdjoo-map.ps1"
if errorlevel 1 (
  echo Sync failed.
  pause
  exit /b 1
)
echo.
set "MV_URL=http://127.0.0.1:8765/index.html?b=96"
echo Mind ^& Venture build 96
echo Live: https://paulooventura.github.io/MV2/
echo %MV_URL%
echo Leave this window open while you play. Ctrl+C stops the server.
echo.
node "%~dp0scripts\play-local.mjs"
if errorlevel 1 (
  echo.
  echo Server did not start. Is Node installed?
  echo Try opening in browser anyway: %MV_URL%
  start "" "%MV_URL%"
  pause
  exit /b 1
)
