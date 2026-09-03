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
set "MV_URL=http://127.0.0.1:8765/index.html?b=97"
echo Mind ^& Venture build 97
echo Live: https://paulooventura.github.io/MV2/
echo %MV_URL%
echo Leave this window open while you play. Ctrl+C stops the server.
echo.
set "MV_PLAY_OPEN=1"
node "%~dp0scripts\play-local.mjs"
if errorlevel 1 (
  echo.
  echo Server did not start. If port 8765 is already in use, reuse that tab.
  echo Do not open another window — stacked tabs stack the soundtrack.
  echo To reset: powershell -NoProfile -File "%~dp0scripts\stop-play.ps1"
  pause
  exit /b 1
)
