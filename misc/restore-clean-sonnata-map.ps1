$src = "C:\Users\PVProductions\.cursor\projects\c-Users-PVProductions-Downloads-Mind-and-Venture\assets\c__Users_PVProductions_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_sonnata-map-09fc777d-4ce1-4f12-aba5-6cde5a9eee41.png"
if (-not (Test-Path $src)) {
    $src = "C:\Users\PVProductions\AppData\Roaming\Cursor\User\workspaceStorage\empty-window\images\sonnata-map-09fc777d-4ce1-4f12-aba5-6cde5a9eee41.png"
}
if (-not (Test-Path $src)) { throw "Original map not found" }
$dir = Join-Path $PSScriptRoot "..\assets\story"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Copy-Item -Force $src (Join-Path $dir "sonnata-map.png")
Copy-Item -Force $src (Join-Path $dir "sonnata-map-blank.png")
Write-Host "Restored clean map to assets/story/"
