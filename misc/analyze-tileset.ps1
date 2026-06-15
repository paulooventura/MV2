# Prints the most-used colors in the tileset (hex + pixel count + HSL)
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Linq;
using System.Runtime.InteropServices;

public static class TileAnalyze {
    public static string Run(string path, int topN) {
        using (var bmp = new Bitmap(path)) {
            var rect = new Rectangle(0, 0, bmp.Width, bmp.Height);
            var data = bmp.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            var bytes = new byte[data.Stride * bmp.Height];
            Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);
            bmp.UnlockBits(data);
            var counts = new Dictionary<int, int>();
            for (int y = 0; y < bmp.Height; y++) {
                int row = y * data.Stride;
                for (int x = 0; x < bmp.Width; x++) {
                    int i = row + x * 4;
                    if (bytes[i + 3] == 0) continue; // skip transparent
                    int c = (bytes[i + 2] << 16) | (bytes[i + 1] << 8) | bytes[i];
                    int n; counts.TryGetValue(c, out n); counts[c] = n + 1;
                }
            }
            var sb = new System.Text.StringBuilder();
            sb.AppendLine("unique colors: " + counts.Count);
            foreach (var kv in counts.OrderByDescending(k => k.Value).Take(topN)) {
                var col = Color.FromArgb(255, (kv.Key >> 16) & 255, (kv.Key >> 8) & 255, kv.Key & 255);
                sb.AppendLine(string.Format("#{0:X6}  count={1,7}  H={2,3:F0} S={3:F2} L={4:F2}",
                    kv.Key, kv.Value, col.GetHue(), col.GetSaturation(), col.GetBrightness()));
            }
            return sb.ToString();
        }
    }
}
"@
$path = Join-Path $PSScriptRoot "..\tileset\beastlands.png"
[TileAnalyze]::Run($path, 40)
