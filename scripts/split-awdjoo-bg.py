"""Build Awdjoo multiplane plates: sky, receded far, whole mid, close fg, cloud sprites."""
from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "backgrounds" / "awdjoo" / "source.jpg"
OUT = ROOT / "assets" / "backgrounds" / "awdjoo"
H_OUT = 768
W_OUT = 2048


def lum(r, g, b):
    return 0.30 * r + 0.59 * g + 0.11 * b


def is_skyish(r, g, b):
    L = lum(r, g, b)
    if L < 92:
        return False
    if g > r + 24 and g > b + 10:
        return False
    if r > g + 30 and r > b + 20 and L < 160:
        return False
    pale = L > 160 and (max(r, g, b) - min(r, g, b)) < 72
    lavender = b >= g - 8 and r >= g - 12 and L > 115
    cloud = L > 170 and b > 145 and r > 145
    return pale or lavender or cloud


def sky_mask(im):
    w, h = im.size
    px = im.load()
    mask = [[False] * h for _ in range(w)]
    q = deque()
    for x in range(w):
        for y in range(min(int(h * 0.20), h)):
            if is_skyish(*px[x, y][:3]):
                mask[x][y] = True
                q.append((x, y))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= w or ny >= h or mask[nx][ny]:
                continue
            if ny > int(h * 0.60):
                continue
            r, g, b = px[nx, ny][:3]
            if is_skyish(r, g, b) or (ny < int(h * 0.36) and lum(r, g, b) > 108 and not (g > r + 18)):
                mask[nx][ny] = True
                q.append((nx, ny))
    return mask


def sky_column_colors(im, mask):
    w, h = im.size
    px = im.load()
    cols = []
    last = (176, 172, 210)
    sky_lim = int(h * 0.48)
    for y in range(h):
        rs = gs = bs = n = 0
        if y <= sky_lim:
            for x in range(0, w, 3):
                if not mask[x][y]:
                    continue
                r, g, b = px[x, y][:3]
                if not is_skyish(r, g, b):
                    continue
                rs += r
                gs += g
                bs += b
                n += 1
        if n:
            last = (rs // n, gs // n, bs // n)
        cols.append(last)
    return cols


def extract_clouds(im, mask):
    w, h = im.size
    px = im.load()
    seen = [[False] * h for _ in range(w)]
    clouds = []
    for y in range(int(h * 0.02), int(h * 0.48)):
        for x in range(w):
            if seen[x][y] or not mask[x][y]:
                continue
            r, g, b = px[x, y][:3]
            L = lum(r, g, b)
            if L < 168 or L > 248:
                continue
            stack = [(x, y)]
            seen[x][y] = True
            cells = []
            while stack:
                cx, cy = stack.pop()
                cells.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1), (cx - 1, cy - 1), (cx + 1, cy + 1)):
                    if nx < 0 or ny < 0 or nx >= w or ny >= h or seen[nx][ny] or not mask[nx][ny]:
                        continue
                    rr, gg, bb = px[nx, ny][:3]
                    if lum(rr, gg, bb) < 165 or not is_skyish(rr, gg, bb):
                        continue
                    seen[nx][ny] = True
                    stack.append((nx, ny))
            if 140 <= len(cells) <= 7000:
                dark = sum(1 for cx, cy in cells if lum(*px[cx, cy][:3]) < 150)
                if dark / len(cells) > 0.12:
                    continue
                xs = [p[0] for p in cells]
                ys = [p[1] for p in cells]
                x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
                if x1 - x0 < 22 or y1 - y0 < 12:
                    continue
                if y1 > h * 0.42 or (y1 - y0) > 90 or (y1 - y0) > (x1 - x0) * 1.4:
                    continue
                clouds.append((x0, y0, x1 + 1, y1 + 1, cells))
    clouds.sort(key=lambda c: -(c[2] - c[0]) * (c[3] - c[1]))
    return clouds[:8]


def extract_lights(im, mask):
    w, h = im.size
    px = im.load()
    lights = []
    for y in range(int(h * 0.28), int(h * 0.88)):
        for x in range(0, w, 2):
            if mask[x][y]:
                continue
            r, g, b = px[x, y][:3]
            warm = r > 170 and g > 120 and r > b + 20
            cyan = b > 160 and g > 130 and b > r + 15
            if not (warm or cyan):
                continue
            if lum(r, g, b) < 150:
                continue
            lights.append({"x": x / w, "y": y / h, "c": "warm" if warm else "cyan"})
            if len(lights) >= 40:
                return lights
    return lights


def land_rgba(im, mask, tint=None, alpha=255):
    w, h = im.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    src = im.load()
    dst = out.load()
    for y in range(h):
        for x in range(w):
            if mask[x][y]:
                continue
            r, g, b = src[x, y][:3]
            if tint:
                r = (r * tint[0]) // 255
                g = (g * tint[1]) // 255
                b = (b * tint[2]) // 255
            dst[x, y] = (r, g, b, alpha)
    return out


def sky_plate(im, mask, cols):
    w, h = im.size
    out = Image.new("RGB", (w, h))
    src = im.load()
    dst = out.load()
    for y in range(h):
        cr, cg, cb = cols[y]
        for x in range(w):
            if mask[x][y]:
                dst[x, y] = src[x, y][:3]
            else:
                dst[x, y] = (cr, cg, cb)
    return out


def recede(layer, scale, anchor_y):
    w, h = layer.size
    nw, nh = max(8, int(w * scale)), max(8, int(h * scale))
    small = layer.resize((nw, nh), Image.NEAREST)
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    x = (w - nw) // 2
    y = int(anchor_y * h - nh * 0.55)
    canvas.paste(small, (x, y), small)
    return canvas


def fg_strip(land, frac=0.26, fade=22):
    w, h = land.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    src = land.load()
    dst = out.load()
    y0 = int(h * (1 - frac))
    for y in range(y0, h):
        a = 255
        if y < y0 + fade:
            a = int(255 * (y - y0) / fade)
        for x in range(w):
            r, g, b, aa = src[x, y]
            if aa < 8:
                continue
            dst[x, y] = (r, g, b, min(aa, a))
    return out


def haze_wrap(im, fade=110):
    """Widen with faded copies so the join reads as mist, not a mirror."""
    w, h = im.size
    mode = im.mode
    out = Image.new(mode, (W_OUT, h), (0, 0, 0, 0) if "A" in mode else (168, 172, 198))
    x0 = (W_OUT - w) // 2
    out.paste(im, (x0, 0))
    if x0 > 0:
        left = im.crop((0, 0, min(fade, w), h))
        right = im.crop((max(0, w - fade), 0, w, h))
        left_f = _fade_lr(left, True)
        right_f = _fade_lr(right, False)
        out.paste(right_f, (x0 - right_f.width, 0), right_f if "A" in mode else None)
        out.paste(left_f, (x0 + w, 0), left_f if "A" in mode else None)
        if mode == "RGB":
            haze = Image.new("RGB", (x0 - right_f.width, h), (168, 172, 198))
            out.paste(haze, (0, 0))
            haze2 = Image.new("RGB", (W_OUT - (x0 + w + left_f.width), h), (168, 172, 198))
            if haze2.width > 0:
                out.paste(haze2, (x0 + w + left_f.width, 0))
    return out


def _fade_lr(im, fade_right):
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    for x in range(w):
        t = x / max(1, w - 1)
        a = t if fade_right else (1 - t)
        a = int(220 * (a ** 1.35))
        for y in range(h):
            r, g, b, aa = px[x, y]
            px[x, y] = (r, g, b, min(aa, a))
    return im


def scale_to_height(im, th=H_OUT):
    w, h = im.size
    tw = max(8, int(round(w * (th / h))))
    return im.resize((tw, th), Image.NEAREST)


def pack_clouds(im, clouds):
    if not clouds:
        sheet = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
        return sheet, []
    pads = []
    for x0, y0, x1, y1, _cells in clouds:
        crop = im.crop((x0, y0, x1, y1)).convert("RGBA")
        src = im.load()
        dst = crop.load()
        cw, ch = crop.size
        for yy in range(ch):
            for xx in range(cw):
                r, g, b = src[x0 + xx, y0 + yy][:3]
                L = lum(r, g, b)
                if L < 150:
                    dst[xx, yy] = (0, 0, 0, 0)
                else:
                    dst[xx, yy] = (r, g, b, min(255, 80 + int(L - 140)))
        pads.append((crop, x0, y0, x1 - x0, y1 - y0))
    sw = sum(p[0].width + 4 for p in pads)
    sh = max(p[0].height for p in pads)
    sheet = Image.new("RGBA", (max(8, sw), max(8, sh)), (0, 0, 0, 0))
    meta = []
    x = 0
    for crop, sx, sy, cw, ch in pads:
        sheet.paste(crop, (x, 0), crop)
        meta.append({"sx": x, "sy": 0, "w": crop.width, "h": crop.height, "ox": sx, "oy": sy})
        x += crop.width + 4
    return sheet, meta


def main():
    im = Image.open(SRC).convert("RGB")
    w, h = im.size
    mask = sky_mask(im)
    cols = sky_column_colors(im, mask)
    clouds = extract_clouds(im, mask)
    lights = extract_lights(im, mask)

    sky = sky_plate(im, mask, cols)
    land = land_rgba(im, mask)
    far = recede(land, 0.82, 0.50)
    far = ImageEnhance.Color(far).enhance(0.55)
    far = ImageEnhance.Brightness(far).enhance(1.08)
    far = far.filter(ImageFilter.GaussianBlur(radius=0.45))
    mid = land
    fg = fg_strip(land, 0.24, 26)
    fg = ImageEnhance.Contrast(fg).enhance(1.08)

    sky_w = haze_wrap(scale_to_height(sky), fade=1)
    far_w = haze_wrap(scale_to_height(far))
    mid_w = haze_wrap(scale_to_height(mid))
    fg_w = haze_wrap(scale_to_height(fg))

    # match width
    def fit(im):
        if im.width == W_OUT:
            return im
        canvas = Image.new(im.mode, (W_OUT, im.height), (0, 0, 0, 0) if "A" in im.mode else (168, 172, 198))
        canvas.paste(im, ((W_OUT - im.width) // 2, 0))
        return canvas

    sky_w, far_w, mid_w, fg_w = map(fit, (sky_w, far_w, mid_w, fg_w))
    sky_w.save(OUT / "layer1.png", "PNG", optimize=True)
    far_w.save(OUT / "layer2.png", "PNG", optimize=True)
    mid_w.save(OUT / "layer3.png", "PNG", optimize=True)
    fg_w.save(OUT / "layer4.png", "PNG", optimize=True)
    if (OUT / "layer5.png").exists():
        (OUT / "layer5.png").unlink()

    sheet, cmeta = pack_clouds(im, clouds)
    sheet = sheet.resize((max(8, sheet.width * 2), max(8, sheet.height * 2)), Image.NEAREST)
    for c in cmeta:
        c["sx"] *= 2
        c["sy"] *= 2
        c["w"] *= 2
        c["h"] *= 2
        c["ox"] = (c["ox"] / w)
        c["oy"] = (c["oy"] / h)
        c["vx"] = 0.04 + (c["w"] % 7) * 0.01
        c["depth"] = 0.03 if c["oy"] < 0.18 else 0.07
    sheet.save(OUT / "clouds.png", "PNG", optimize=True)

    meta = {
        "w": W_OUT,
        "h": H_OUT,
        "srcW": w,
        "srcH": h,
        "clouds": cmeta,
        "lights": [{"x": L["x"], "y": L["y"], "c": L["c"]} for L in lights],
        "birds": [],
    }
    (OUT / "life.json").write_text(json.dumps(meta), encoding="utf-8")
    for name in ("layer1.png", "layer2.png", "layer3.png", "layer4.png", "clouds.png"):
        print(name, (OUT / name).stat().st_size, Image.open(OUT / name).size)
    print("clouds", len(cmeta), "lights", len(lights))


if __name__ == "__main__":
    main()
