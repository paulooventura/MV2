# Tiny static file server for local playtesting (no Python/Node needed).
# Usage: powershell -ExecutionPolicy Bypass -File misc\serve.ps1
$root = Split-Path -Parent $PSScriptRoot
$port = 8765
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$port/  (Ctrl+C to stop)"
$mime = @{
  ".html"="text/html"; ".js"="text/javascript"; ".json"="application/json";
  ".tmj"="application/json"; ".png"="image/png"; ".jpg"="image/jpeg";
  ".gif"="image/gif"; ".mp3"="audio/mpeg"; ".ogg"="audio/ogg";
  ".wav"="audio/wav"; ".css"="text/css"; ".txt"="text/plain"
}
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($path -eq "/") { $path = "/index.html" }
    $file = Join-Path $root ($path.TrimStart('/') -replace '/', '\')
    $full = [IO.Path]::GetFullPath($file)
    if ((Test-Path $full -PathType Leaf) -and $full.StartsWith($root)) {
      $bytes = [IO.File]::ReadAllBytes($full)
      $ext = [IO.Path]::GetExtension($full).ToLower()
      $ctx.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
  } catch {
    try { $ctx.Response.StatusCode = 500 } catch {}
  }
  try { $ctx.Response.OutputStream.Close() } catch {}
}
