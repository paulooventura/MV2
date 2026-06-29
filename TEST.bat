@echo off
cd /d "%~dp0"
echo Syncing Tiled map into game...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-awdjoo-map.ps1"
echo.
echo Manual browser test (watch the bot). For NO browser / NO paste, use AUTO-TEST.bat
echo.
start "" "%~dp0test-run.html"
