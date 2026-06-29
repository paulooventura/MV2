@echo off
cd /d "%~dp0"
echo === MV always-on test watch ===
echo Saves fail/pass to test-results\ after each run.
echo Edit js\ files and tests re-run automatically. Ctrl+C to stop.
echo.
call npm install --no-fund --no-audit
call npx playwright install chromium
call npm run selftest:watch
