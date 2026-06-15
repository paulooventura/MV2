# Builds assets/story/title-bg.gif (+ title-key-art.png) from source art.
Add-Type -AssemblyName System.Drawing

$srcCandidates = @(
    (Join-Path $PSScriptRoot "..\assets\story\title-key-art.png"),
    "C:\Users\PVProductions\.cursor\projects\c-Users-PVProductions-Downloads-Mind-and-Venture\assets\c__Users_PVProductions_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-2c9876c7-b4c4-4664-adaf-467bfc820fe5.png"
)
$src = $srcCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $src) { throw "title-key-art.png not found" }

$outDir = Join-Path $PSScriptRoot "..\assets\story"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$keyArt = Join-Path $outDir "title-key-art.png"
if ((Resolve-Path $src).Path -ne (Resolve-Path $keyArt -ErrorAction SilentlyContinue).Path) {
    Copy-Item -Force $src $keyArt
}

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;

public static class TitleGifMaker {
    public static void Run(string srcPath, string dstPath, string framesDir, int frames) {
        Directory.CreateDirectory(framesDir);
        using (var baseImg = new Bitmap(srcPath)) {
            int W = baseImg.Width, H = baseImg.Height;
            var enc = GetEncoder(ImageFormat.Gif);
            var frameList = new List<Bitmap>();
            for (int f = 0; f < frames; f++) {
                float t = f / (float)frames * 6.2831853f;
                var bmp = new Bitmap(W, H, PixelFormat.Format32bppArgb);
                using (var g = Graphics.FromImage(bmp)) {
                    g.DrawImage(baseImg, 0, 0, W, H);
                    float starA = 0.06f + 0.05f * (float)Math.Sin(t * 2.1f);
                    using (var br = new SolidBrush(Color.FromArgb((int)(starA * 255), 180, 255, 210)))
                        g.FillRectangle(br, 0, 0, W, (int)(H * 0.42f));
                    float eye = 0.5f + 0.5f * (float)Math.Sin(t * 1.4f + 0.3f);
                    int ex = (int)(W * 0.094f), ey = (int)(H * 0.375f), er = (int)(18 + eye * 14);
                    using (var br2 = new SolidBrush(Color.FromArgb((int)(90 * eye), 120, 255, 180)))
                        g.FillEllipse(br2, ex - er, ey - er, er * 2, er * 2);
                    float win = 0.4f + 0.6f * (float)Math.Abs(Math.Sin(t * 3.2f + 1.1f));
                    using (var br3 = new SolidBrush(Color.FromArgb((int)(35 * win), 255, 220, 140)))
                        g.FillEllipse(br3, (int)(W * 0.49f) - 12, (int)(H * 0.47f) - 8, 24, 18);
                }
                frameList.Add(bmp);
                bmp.Save(Path.Combine(framesDir, "title-frame-" + f.ToString("D2") + ".png"), ImageFormat.Png);
            }

            var ep = new EncoderParameters(1);
            ep.Param[0] = new EncoderParameter(Encoder.SaveFlag, (long)EncoderValue.MultiFrame);
            frameList[0].Save(dstPath, enc, ep);

            ep.Param[0] = new EncoderParameter(Encoder.SaveFlag, (long)EncoderValue.FrameDimensionTime);
            for (int i = 1; i < frameList.Count; i++)
                frameList[0].SaveAdd(frameList[i], ep);

            ep.Param[0] = new EncoderParameter(Encoder.SaveFlag, (long)EncoderValue.Flush);
            frameList[0].SaveAdd(ep);

            foreach (var b in frameList) b.Dispose();
        }
    }
    static ImageCodecInfo GetEncoder(ImageFormat fmt) {
        foreach (var c in ImageCodecInfo.GetImageEncoders())
            if (c.FormatID == fmt.Guid) return c;
        return null;
    }
}
'@

$dst = Join-Path $outDir "title-bg.gif"
[TitleGifMaker]::Run($keyArt, $dst, $outDir, 12)
$len = (Get-Item $dst).Length
Write-Host "Wrote $dst ($len bytes)"
