# Stop MV2 local play server + headless Firefox tabs on 127.0.0.1:8765 (stacked soundtracks).
$ErrorActionPreference = 'SilentlyContinue'
$port = if ($env:MV_PLAY_PORT) { [int]$env:MV_PLAY_PORT } else { 8765 }

function Log([string]$msg) {
  Write-Host $msg
}

Log "MV2 stop-play: port $port"

Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {
    $procId = $_.OwningProcess
    Log "  stop listener PID $procId"
    Stop-Process -Id $procId -Force
  }

Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -match 'http\.server\s+8765|play-local\.mjs' } |
  ForEach-Object {
    Log "  stop $($_.Name) $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force
  }

# Headless Firefox tabs are usually duplicate MV2 sessions opened by PLAY.bat "start".
$firefox = Get-Process firefox -ErrorAction SilentlyContinue
if ($firefox) {
  $bg = $firefox | Where-Object { $_.MainWindowHandle -eq 0 }
  if ($bg) {
    Log "  stop $($bg.Count) headless Firefox tab(s)"
    $bg | Stop-Process -Force
  }
}

Log "Done. Close any visible MV2 tab manually if audio continues."
Log "Cursor Simple Browser is a hidden tab — agents must not reopen :8765."
