"""Split the Awdjoo town painting into SNES-style parallax PNG layers."""
from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "backgrounds" / "awdjoo" / "source.jpg"
OUT = ROOT / "assets" / "backgrounds" / "awdjoo"


def lum(r, g, b):
    return 0.30 * r + 0.59 * g + 0.11 * b


def is_skyish(r, g, b):
    L = lum(r, g, b)
    if L < 95:
        return False
    if g > r + 22 and g > b + 8:
        return False
    if r > g + 28 and r > b + 18 and L < 165:
        return False
    pale = L > 165 and (max(r, g, b) - min(r, g, b)) < 70
    lavender = b >= g - 6 and r >= g - 10 and L > 120
    cloud = L > 175 and b > 150 and r > 150
    return pale or lavender or cloud


def sky_mask(im):
    w, h = im.size
    px = im.load()
    mask = [[False] * h for _ in range(w)]
    q = deque()
    for x in range(w):
        for y in range(min(int(h * 0.18), h)):
            r, g, b = px[x, y][:3]
            if is_skyish(r, g, b):
                mask[x][y] = True
                q.append((x, y))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= w or ny >= h or mask[nx][ny]:
                continue
            if ny > int(h * 0.62):
                continue
            r, g, b = px[nx, ny][:3]
            if is_skyish(r, g, b) or (ny < int(h * 0.38) and lum(r, g, b) > 110 and not (g > r + 18)):
                mask[nx][ny] = True
                q.append((nx, ny))
    return mask


def neighbors_avg(px, w, h, x, y, mask):
    rs = gs = bs = n = 0
    for oy in range(-2, 3):
        for ox in range(-2, 3):
            xx, yy = x + ox, y + oy
            if 0 <= xx < w and 0 <= yy < h and mask[xx][yy]:
                r, g, b = px[xx, yy][:3]
                rs += r
                gs += g
                bs += b
                n += 1
    if not n:
        return (196, 188, 220)
    return (rs // n, gs // n, bs // n)


def find_birds(im, mask):
    w, h = im.size
    px = im.load()
    seen = [[False] * h for _ in range(w)]
    birds = []
    for y in range(int(h * 0.02), int(h * 0.46)):
        for x in range(w):
            if seen[x][y] or not mask[x][y]:
                continue
            r, g, b = px[x, y][:3]
            if lum(r, g, b) > 72:
                continue
            stack = [(x, y)]
            seen[x][y] = True
            cells = []
            while stack:
                cx, cy = stack.pop()
                cells.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if nx < 0 or ny < 0 or nx >= w or ny >= h or seen[nx][ny] or not mask[nx][ny]:
                        continue
                    rr, gg, bb = px[nx, ny][:3]
                    if lum(rr, gg, bb) > 78:
                        continue
                    seen[nx][ny] = True
                    stack.append((nx, ny))
            if 3 <= len(cells) <= 28:
                sx = sum(p[0] for p in cells) / len(cells)
                sy = sum(p[1] for p in cells) / len(cells)
                birds.append({"x": sx / w, "y": sy / h, "n": len(cells)})
                for cx, cy in cells:
                    px[cx, cy] = neighbors_avg(px, w, h, cx, cy, mask)
    return birds


def band_layer(im, mask, y0, y1, fade=28, land=True):
    w, h = im.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    src = im.load()
    dst = out.load()
    y0 = max(0, y0)
    y1 = min(h, y1)
    for y in range(y0, y1):
        a = 255
        if fade and y < y0 + fade:
            a = int(255 * (y - y0) / fade)
        for x in range(w):
            sky = mask[x][y]
            if land and sky:
                continue
            if not land and not sky:
                continue
            r, g, b = src[x, y][:3]
            dst[x, y] = (r, g, b, a)
    return out


def mirror_tile(im):
    w, h = im.size
    out = Image.new("RGBA", (w * 2, h), (0, 0, 0, 0))
    out.paste(im, (0, 0))
    out.paste(im.transpose(Image.FLIP_LEFT_RIGHT), (w, 0))
    return out


def main():
    im = Image.open(SRC).convert("RGB")
    w, h = im.size
    mask = sky_mask(im)
    birds = find_birds(im, mask)

    sky = band_layer(im, mask, 0, int(h * 0.62), fade=0, land=False)
    far = band_layer(im, mask, int(h * 0.18), int(h * 0.52), fade=22, land=True)
    mid = band_layer(im, mask, int(h * 0.30), int(h * 0.74), fade=26, land=True)
    near = band_layer(im, mask, int(h * 0.52), int(h * 0.90), fade=24, land=True)
    fg = band_layer(im, mask, int(h * 0.78), h, fade=18, land=True)

    layers = [
        ("layer1.png", sky.filter(ImageFilter.GaussianBlur(radius=0.4))),
        ("layer2.png", far),
        ("layer3.png", mid),
        ("layer4.png", near),
        ("layer5.png", fg),
    ]
    for name, layer in layers:
        tiled = mirror_tile(layer)
        tiled.save(OUT / name, "PNG", optimize=True)
        print(name, tiled.size, (OUT / name).stat().st_size)

    meta = {
        "w": w * 2,
        "h": h,
        "birds": [{"x": b["x"] * 0.5, "y": b["y"]} for b in birds]
        + [{"x": 0.5 + b["x"] * 0.5, "y": b["y"]} for b in birds],
    }
    (OUT / "life.json").write_text(json.dumps(meta), encoding="utf-8")
    print("birds", len(meta["birds"]))


if __name__ == "__main__":
    main()
