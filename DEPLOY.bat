@echo off
cd /d "%~dp0"
echo === MV2 : sync + deploy ===
echo.
echo [1/4] Syncing Tiled map into the game...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-awdjoo-map.ps1"
echo.
echo [2/4] Staging game files...
git add index.html sw.js js assets/Awdjoo sync-awdjoo-map.ps1 netlify.toml PLAY.bat TEST.bat DEPLOY.bat .gitignore AGENTS.md .github/workflows/
echo.
echo [3/4] Committing...
git commit -F "%~dp0.deploy-msg.txt"
if errorlevel 1 echo (nothing new to commit - continuing)
echo.
echo [4/4] Pushing to main (MV2 repo)...
git push origin main
echo.
echo ============================================================
echo Done. Netlify deploys from main when connected to paulooventura/MV2.
echo Open your Netlify site URL and hard-refresh (Ctrl+F5).
echo ============================================================
pause
