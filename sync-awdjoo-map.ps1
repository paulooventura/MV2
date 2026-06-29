# Embed assets/Awdjoo/Awdjoo.json into js/awdjoo_map.js so the game runs from file:// (double-click index.html).
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$jsonPath = Join-Path $root 'assets\Awdjoo\Awdjoo.json'
$outPath = Join-Path $root 'js\awdjoo_map.js'

if (-not (Test-Path $jsonPath)) {
    Write-Error "Missing map: $jsonPath`nExport from Tiled to assets/Awdjoo/Awdjoo.json first."
}

$json = (Get-Content -LiteralPath $jsonPath -Raw -Encoding UTF8).Trim()
$header = "// Auto-generated from assets/Awdjoo/Awdjoo.json. Run sync-awdjoo-map.ps1 after Tiled export.`n"
$body = "window.MV_STAGE0_MAP = $json;`n"
Set-Content -LiteralPath $outPath -Value ($header + $body) -Encoding UTF8 -NoNewline
Write-Host "OK: $outPath ($((Get-Item $outPath).Length) bytes)"
