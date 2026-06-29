@echo off
cd /d "%~dp0"
echo === Mind ^& Venture : automated self-test ===
echo.
echo [1/3] Syncing Tiled map...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-awdjoo-map.ps1"
echo.
echo [2/3] Installing test runner (first run only)...
call npm install --no-fund --no-audit
if errorlevel 1 ( echo npm install failed & pause & exit /b 1 )
echo.
echo [3/3] Running headless self-test (no browser window)...
call npx playwright install chromium
call npm run selftest
set EC=%ERRORLEVEL%
echo.
if %EC%==0 (
  echo ============================================================
  echo PASS — see test-results\summary.txt
  echo ============================================================
) else (
  echo ============================================================
  echo FAIL — see test-results\summary.txt and latest.json
  echo Agents: read those files and fix; re-run AUTO-TEST.bat
  echo ============================================================
)
type test-results\summary.txt 2>nul
pause
exit /b %EC%
