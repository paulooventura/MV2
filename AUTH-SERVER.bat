@echo off
REM MV2 authoritative co-op server + free public Cloudflare Quick Tunnel.
REM No account, no domain, no cost. The URL changes every time you restart.
REM Share the printed PUBLIC JOIN URL with players. Close this window to stop.
set MV_AUTH_PORT=7801
set MV_AUTH_TUNNEL=1
set MV_CLOUDFLARED=I:\PVP\apps\cloudflared.exe
cd /d "%~dp0"
node scripts\auth-server.mjs
pause
