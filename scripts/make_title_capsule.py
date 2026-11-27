"""Title screen art (Paulo, Nov 27 2026): the store key art, both robots, Venture's cap black,
with the gold full-height "MIND & VENTURE 2" wordmark, as on the Steam main capsule.
4:3 like the game canvas; the bottom band is left dark for the title menu.
Usage: python scripts/make_title_capsule.py <title-key-black-cap.png> <library-logo-1280.png> <out.jpg>
(sources: HOMEBASE/staging/mv2-steam/red-cap-originals/ and alt-lining-2/store-art/)"""
import sys
import numpy as np
from PIL import Image
key = Image.open(sys.argv[1]).convert('RGB'); logo = Image.open(sys.argv[2]).convert('RGBA')
W, H = 2048, 1536
ah = round(key.height * W / key.width)                     # width-fit: both gloves stay in frame
art = key.resize((W, ah), Image.LANCZOS)
canvas = Image.new('RGB', (W, H))
canvas.paste(art, (0, 0))
# extend the wet floor below the art: the last rows stretched, fading to near-black
band = art.crop((0, ah - 40, W, ah)).resize((W, H - ah), Image.LANCZOS)
b = np.asarray(band, np.float32)
fade = np.linspace(0.85, 0.18, H - ah, dtype=np.float32)[:, None, None]
canvas.paste(Image.fromarray(np.clip(b * fade, 0, 255).astype(np.uint8)), (0, ah))
# soften the seam
c = np.asarray(canvas, np.float32)
yy = np.arange(H, dtype=np.float32)[:, None, None]
dark = 1 - 0.55 * np.clip((yy - H * 0.62) / (H * 0.38), 0, 1) ** 1.3   # floor darkens toward the menu
c *= dark
canvas = Image.fromarray(np.clip(c, 0, 255).astype(np.uint8)).convert('RGBA')
lw = int(W * 0.78); lg = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
cy = int(H * 0.705)
canvas.alpha_composite(lg, ((W - lw) // 2, cy - lg.height // 2))
canvas.convert('RGB').save(sys.argv[3], quality=90, optimize=True, progressive=True)
print(sys.argv[3], canvas.size)
