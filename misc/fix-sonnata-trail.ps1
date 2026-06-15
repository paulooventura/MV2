# Restore the detailed Sonnata map and repaint the Knowl seed trail in correct zone order.
# Awdjoo Town -> Gauder Hills -> Knowl's Secret Garden -> Corali Cavern -> Alitek Factory -> Tradzkul's Lair
Add-Type -AssemblyName System.Drawing
$src = "C:\Users\PVProductions\.cursor\projects\c-Users-PVProductions-Downloads-Mind-and-Venture\assets\c__Users_PVProductions_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_sonnata-map-09fc777d-4ce1-4f12-aba5-6cde5a9eee41.png"
if (-not (Test-Path $src)) {
    $src = "C:\Users\PVProductions\AppData\Roaming\Cursor\User\workspaceStorage\empty-window\images\sonnata-map-09fc777d-4ce1-4f12-aba5-6cde5a9eee41.png"
}
$dst = Join-Path $PSScriptRoot "..\assets\story\sonnata-map.png"
if (-not (Test-Path $src)) { throw "Original sonnata map not found: $src" }

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class SonnataTrailFix {
    static bool IsSeedColor(byte r, byte g, byte b) {
        // cyan / teal glow seeds on the original map
        if (g < 120) return false;
        if (b < 120) return false;
        if (g + b < r + 80) return false;
        return (g > 150 || b > 150);
    }

    public static void Run(string srcPath, string dstPath) {
        using (var srcBmp = new Bitmap(srcPath))
        using (var bmp = new Bitmap(srcBmp.Width, srcBmp.Height, PixelFormat.Format32bppArgb)) {
            using (var g = Graphics.FromImage(bmp)) {
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.DrawImage(srcBmp, 0, 0, srcBmp.Width, srcBmp.Height);
            }

            int W = bmp.Width, H = bmp.Height;
            var rect = new Rectangle(0, 0, W, H);
            var data = bmp.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            var bytes = new byte[data.Stride * H];
            Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);

            // Fade existing seed pixels so we can repaint authoritative trail
            for (int y = 0; y < H; y++) {
                int row = y * data.Stride;
                for (int x = 0; x < W; x++) {
                    int i = row + x * 4;
                    byte a = bytes[i + 3];
                    if (a == 0) continue;
                    byte r = bytes[i + 2], g = bytes[i + 1], b = bytes[i];
                    if (!IsSeedColor(r, g, b)) continue;
                    bytes[i + 3] = (byte)(a * 0.04);
                }
            }
            Marshal.Copy(bytes, 0, data.Scan0, bytes.Length);
            bmp.UnlockBits(data);

            // Landmark centers (normalized) tuned to the detailed map art
            var pts = new PointF[] {
                new PointF(W * 0.105f, H * 0.835f), // Awdjoo Town
                new PointF(W * 0.335f, H * 0.745f), // Gauder Hills
                new PointF(W * 0.225f, H * 0.535f), // Knowl's Secret Garden (tree)
                new PointF(W * 0.615f, H * 0.465f), // Corali Cavern
                new PointF(W * 0.495f, H * 0.195f), // Alitek Factory
                new PointF(W * 0.855f, H * 0.105f), // Tradzkul's Lair
            };

            using (var g2 = Graphics.FromImage(bmp)) {
                g2.SmoothingMode = SmoothingMode.AntiAlias;
                g2.CompositingQuality = CompositingQuality.HighQuality;

                var samples = new List<PointF>();
                for (int seg = 0; seg < pts.Length - 1; seg++) {
                    var a = pts[seg]; var b = pts[seg + 1];
                    float len = (float)Math.Sqrt((b.X - a.X) * (b.X - a.X) + (b.Y - a.Y) * (b.Y - a.Y));
                    int steps = Math.Max(8, (int)(len / 10f));
                    for (int s = 0; s <= steps; s++) {
                        float t = s / (float)steps;
                        samples.Add(new PointF(a.X + (b.X - a.X) * t, a.Y + (b.Y - a.Y) * t));
                    }
                }

                // soft glow under seeds (match original map seeds)
                foreach (var p in samples) {
                    using (var br = new SolidBrush(Color.FromArgb(55, 0, 255, 220)))
                        g2.FillEllipse(br, p.X - 5, p.Y - 5, 10, 10);
                }

                // teardrop seeds — small cyan droplets like the painted map
                foreach (var p in samples) {
                    using (var path = new GraphicsPath()) {
                        path.AddEllipse(p.X - 3.2f, p.Y - 4.2f, 6.4f, 6.4f);
                        path.AddEllipse(p.X - 1.8f, p.Y + 0.8f, 3.6f, 3.6f);
                        using (var br = new LinearGradientBrush(
                            new RectangleF(p.X - 3.5f, p.Y - 4.5f, 7, 9),
                            Color.FromArgb(255, 230, 255, 255),
                            Color.FromArgb(255, 0, 210, 190),
                            LinearGradientMode.Vertical))
                            g2.FillPath(br, path);
                    }
                }
            }

            bmp.Save(dstPath, ImageFormat.Png);
        }
    }
}
"@

[SonnataTrailFix]::Run($src, $dst)
Write-Host "Wrote $dst"
