# Generates placeholder parallax layers in assets/backgrounds/beastlands/
# Replace these with Midjourney art (same filenames) whenever ready.
Add-Type -AssemblyName System.Drawing
$dir = Join-Path $PSScriptRoot "..\assets\backgrounds\beastlands"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$W = 1536; $H = 640

# layer1: sky gradient (deep purple -> emerald dusk)
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$rect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 24, 8, 48),
    [System.Drawing.Color]::FromArgb(255, 26, 92, 70),
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
$g.FillRectangle($brush, $rect)
# mandala-ish concentric rings around a low sun
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(28, 255, 200, 120), 3)
for ($r = 30; $r -le 360; $r += 44) {
    $g.DrawEllipse($pen, ($W * 0.68) - $r, ($H * 0.55) - $r, $r * 2, $r * 2)
}
$sun = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(200, 255, 214, 140))
$g.FillEllipse($sun, $W * 0.68 - 26, $H * 0.55 - 26, 52, 52)
$g.Dispose()
$bmp.Save((Join-Path $dir "layer1.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

# layer2: far mountain silhouettes, transparent sky, seamless via sine waves
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$mt = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 38, 18, 66))
$pts = New-Object System.Collections.Generic.List[System.Drawing.PointF]
$pts.Add([System.Drawing.PointF]::new(0, $H))
for ($x = 0; $x -le $W; $x += 8) {
    $t = $x / $W * 2 * [Math]::PI   # whole periods -> left/right edges match
    $y = $H * 0.58 - 90 * [Math]::Sin(3 * $t) - 46 * [Math]::Sin(7 * $t) - 24 * [Math]::Sin(13 * $t)
    $pts.Add([System.Drawing.PointF]::new($x, $y))
}
$pts.Add([System.Drawing.PointF]::new($W, $H))
$g.FillPolygon($mt, $pts.ToArray())
$g.Dispose()
$bmp.Save((Join-Path $dir "layer2.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Host "Placeholders written to $dir"
