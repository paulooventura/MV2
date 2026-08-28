@echo off
cd /d "%~dp0"
echo.
echo  Mind ^& Venture — Test Lab jump CI (build 114)
echo  Runs automated jump test in headless Chrome (~30s).
echo.
node scripts/test-lab-jump.mjs
set EC=%ERRORLEVEL%
echo.
if %EC%==0 (
  echo  PASS — Test Lab jump works.
) else if %EC%==2 (
  echo  ERROR — Could not run browser test. Try: npx puppeteer browsers install chrome
) else (
  echo  FAIL — Jump still stuck on floor. See output above.
)
echo.
pause
exit /b %EC%
