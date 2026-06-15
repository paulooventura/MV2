# Mind & Venture tileset reskin: exact 16-color palette remap.
# Reads tileset/beastlands.png -> writes tileset/beastlands-mv.png (original untouched).
# Tile grid positions are unchanged, so all Tiled maps keep working.
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class TileRemap {
    public static void Run(string src, string dst, string[] mapPairs) {
        var map = new Dictionary<int, int>();
        foreach (var p in mapPairs) {
            var parts = p.Split('>');
            map[Convert.ToInt32(parts[0], 16)] = parts[1] == "T" ? -1 : Convert.ToInt32(parts[1], 16);
        }
        using (var srcBmp = new Bitmap(src))
        using (var bmp = new Bitmap(srcBmp.Width, srcBmp.Height, PixelFormat.Format32bppArgb)) {
            // copy out of indexed format, else Save() re-quantizes to the old palette
            using (var g = Graphics.FromImage(bmp)) g.DrawImage(srcBmp, 0, 0, srcBmp.Width, srcBmp.Height);
            var rect = new Rectangle(0, 0, bmp.Width, bmp.Height);
            var data = bmp.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            var bytes = new byte[data.Stride * bmp.Height];
            Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);
            for (int y = 0; y < bmp.Height; y++) {
                int row = y * data.Stride;
                for (int x = 0; x < bmp.Width; x++) {
                    int i = row + x * 4;
                    if (bytes[i + 3] == 0) continue;
                    int c = (bytes[i + 2] << 16) | (bytes[i + 1] << 8) | bytes[i];
                    int outc;
                    if (!map.TryGetValue(c, out outc)) continue;
                    if (outc == -1) { bytes[i + 3] = 0; continue; } // -> transparent
                    bytes[i + 2] = (byte)((outc >> 16) & 255);
                    bytes[i + 1] = (byte)((outc >> 8) & 255);
                    bytes[i]     = (byte)(outc & 255);
                }
            }
            Marshal.Copy(bytes, 0, data.Scan0, bytes.Length);
            bmp.UnlockBits(data);
            bmp.Save(dst, ImageFormat.Png);
        }
    }
}
"@

# old>new  ("T" = transparent, lets the parallax background show through)
$palette = @(
    "55AAFF>T",        # sky blue            -> transparent (parallax shows)
    "55FFFF>66FFD9",   # cyan water sparkle  -> aqua-mint
    "00AA00>00A878",   # foliage green       -> emerald
    "AAFF00>4FE3A0",   # leaf highlight      -> mint glow
    "005555>0B4F4A",   # dark teal           -> deep jungle teal
    "FFAA55>FFB347",   # sandy amber         -> warm gold
    "FFFF55>FFE066",   # bright yellow walls -> soft gold
    "AA5555>8A4E72",   # red-brown shading   -> purple-rose shadow
    "AA0000>8A1E78",   # dark red roofs      -> deep violet-magenta
    "FF5555>D85CC6",   # light red           -> orchid
    "550055>4A0E5C",   # dark magenta caves  -> deeper M&V purple
    "5555AA>6E55AA",   # slate blue          -> purple-blue
    "AAAAAA>B0A6C4",   # stone grey          -> lavender grey
    "555555>5A4E6E"    # dark grey           -> purple grey
    # 000000 and FFFFFF stay as-is (outlines / highlights)
)

$src = Join-Path $PSScriptRoot "..\tileset\beastlands.png"
$dst = Join-Path $PSScriptRoot "..\tileset\beastlands-mv.png"
[TileRemap]::Run($src, $dst, $palette)
Write-Host "Wrote $dst"
