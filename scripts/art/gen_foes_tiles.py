"""Deterministic generator: foe sheets, energy FX, underwater foe, 1.1 suburban tileset, contact sheet.
Run from repo root: python scripts/art/gen_foes_tiles.py   (Pillow only, no network)."""
import math, os, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'claude', 'assets')
def out(*p):
    path = os.path.join(ROOT, *p); os.makedirs(os.path.dirname(path), exist_ok=True); return path
def H(s): s = s.lstrip('#'); return tuple(int(s[i:i+2], 16) for i in (0, 2, 4)) + (255,)

INK = H('1B1740'); SHELL = H('1E2238'); BODY = H('3D4A7A'); BODY_L = H('5A6BA8'); BODY_D = H('2C3560')
CHARGE = H('38E8FF'); SHOOT = H('FF3DA8'); JACK = H('F8E71C'); EYE = H('FF3B4A')
SURGE = H('7DF9FF'); ARC = H('2B6EFF'); WHITE = H('FFFFFF')

def outline(img, col=INK):
    a = img.split()[3]
    big = a.filter(ImageFilter.MaxFilter(3)).point(lambda v: 255 if v else 0)
    ring = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ring.paste(Image.new('RGBA', img.size, col), mask=big)
    ring.alpha_composite(img)
    return ring

def shape_mask(kind, cx, base, w, h, rnd):
    m = Image.new('L', (48, 48), 0); d = ImageDraw.Draw(m)
    top = base - h
    if kind == 'sine':
        d.ellipse([cx - w // 2, top, cx + w // 2, base], fill=255)
        d.rectangle([cx - w // 2, base - h // 4, cx + w // 2, base], fill=255)
    elif kind == 'square':
        d.rectangle([cx - w // 2, top, cx + w // 2 - 1, base], fill=255)
    elif kind == 'triangle':
        d.polygon([(cx, top), (cx + w // 2, base), (cx - w // 2, base)], fill=255)
    else:
        d.ellipse([cx - w // 2, top, cx + w // 2, base], fill=255)
        for _ in range(14):
            a = rnd.random() * 6.283; r = w // 2
            x = cx + int(math.cos(a) * r); y = (top + base) // 2 + int(math.sin(a) * h / 2)
            d.rectangle([x - 1, y - 1, x + 1, y + 1], fill=255)
    return m

WHITE_B = H('F4F6FA'); WHITE_S = H('C9CEDA'); WHITE_SS = H('A4ABBE')
RED_O = H('D03A44'); RED_D = H('9A2530')
GREY_B = H('A9ABB6'); GREY_L = H('C3C5CE'); GREY_S = H('858792'); GREY_O = H('5E606C'); GREY_OD = H('474955')
KNOWL = H('5BE06A'); KNOWL_D = H('2E9E48'); GLASS = H('2A2740')
GLOW = {'full': H('B8FF8A'), 'mid': H('FFB02E'), 'low': H('FF3B4A')}

def face(d, fx, fy, expr, kind, col=INK):
    """one face per foe; expression follows energy (happy/flat/sad), plus scared/hurt/dead/attack"""
    ex = 3 if kind != 'triangle' else 2
    L, R = fx - ex - 1, fx + ex
    if expr == 'happy':
        d.rectangle([L, fy, L + 1, fy + 2], fill=col); d.rectangle([R, fy, R + 1, fy + 2], fill=col)
        d.line([(fx - 2, fy + 5), (fx + 1, fy + 5)], fill=col); d.point((fx - 3, fy + 4), fill=col); d.point((fx + 2, fy + 4), fill=col)
    elif expr == 'attack':
        d.rectangle([L, fy + 1, L + 1, fy + 2], fill=col); d.rectangle([R, fy + 1, R + 1, fy + 2], fill=col)
        d.line([(L - 1, fy - 1), (L + 2, fy)], fill=col); d.line([(R + 2, fy - 1), (R - 1, fy)], fill=col)
        d.rectangle([fx - 2, fy + 4, fx + 1, fy + 5], fill=col)
    elif expr == 'flat':
        d.rectangle([L, fy + 1, L + 1, fy + 2], fill=col); d.rectangle([R, fy + 1, R + 1, fy + 2], fill=col)
        d.line([(fx - 2, fy + 5), (fx + 1, fy + 5)], fill=col)
    elif expr == 'sad':
        d.line([(L, fy + 1), (L + 1, fy + 1)], fill=col); d.line([(R, fy + 1), (R + 1, fy + 1)], fill=col)
        d.point((L + 1, fy + 2), fill=col); d.point((R, fy + 2), fill=col)
        d.line([(fx - 1, fy + 5), (fx, fy + 5)], fill=col); d.point((fx - 2, fy + 6), fill=col); d.point((fx + 1, fy + 6), fill=col)
    elif expr == 'scared':
        for x in (L, R):
            d.rectangle([x - 1, fy - 1, x + 2, fy + 3], fill=WHITE, outline=col); d.point((x + 1, fy + 1), fill=col)
        d.rectangle([fx - 1, fy + 5, fx, fy + 7], fill=col)
        d.line([(L - 1, fy - 3), (L + 2, fy - 2)], fill=col); d.line([(R + 3, fy - 3), (R, fy - 2)], fill=col)
    elif expr == 'hurt':
        d.line([(L - 1, fy), (L + 1, fy + 2)], fill=col); d.line([(R - 1, fy), (R + 1, fy + 2)], fill=col)
        d.line([(fx - 2, fy + 5), (fx + 1, fy + 5)], fill=col); d.point((fx - 2, fy + 6), fill=col)
    elif expr == 'dead':
        for x in (L, R):
            d.line([(x, fy), (x + 2, fy + 2)], fill=col); d.line([(x + 2, fy), (x, fy + 2)], fill=col)
        d.line([(fx - 2, fy + 5), (fx + 1, fy + 5)], fill=col)

def knowl(d, kind, cx, cy, energy, shut):
    kc, kd, gl = (GREY_S, GREY_OD, GREY_L) if shut else (KNOWL, KNOWL_D, GLOW[energy])
    if kind == 'sine':      # small green ball
        d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=GLASS); d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=kc)
        d.point((cx - 1, cy - 2), fill=gl); d.point((cx + 2, cy + 2), fill=kd)
    elif kind == 'square':  # capsule tank
        d.rectangle([cx - 5, cy - 3, cx + 5, cy + 3], fill=GLASS); d.rectangle([cx - 4, cy - 2, cx + 4, cy + 2], fill=kc)
        d.line([(cx - 3, cy - 1), (cx + 1, cy - 1)], fill=gl); d.line([(cx - 4, cy + 2), (cx + 4, cy + 2)], fill=kd)
    elif kind == 'triangle':  # drop
        d.polygon([(cx, cy - 4), (cx + 4, cy + 3), (cx - 4, cy + 3)], fill=GLASS); d.polygon([(cx, cy - 2), (cx + 2, cy + 2), (cx - 2, cy + 2)], fill=kc); d.point((cx, cy - 1), fill=gl)
    else:                   # noise: loose grains in a jar
        d.rectangle([cx - 4, cy - 3, cx + 4, cy + 3], fill=GLASS); d.rectangle([cx - 3, cy - 2, cx + 3, cy + 2], fill=kd)
        for (x, y) in [(-2, -1), (1, -2), (2, 1), (-1, 1), (0, 0)]: d.point((cx + x, cy + y), fill=kc if (x + y) % 2 else gl)
    # halo reads energy: green -> amber -> red as it drops
    d.point((cx - 6, cy), fill=gl); d.point((cx + 6, cy), fill=gl)

def foe_frame(kind, state, i, seed):
    rnd = random.Random(seed * 1000 + i * 7 + len(state))
    cx, base, w, h = 24, 42, 28, 26
    if kind == 'triangle': h = 30
    dx = dy = 0; glow = None; energy = 'full'; expr = 'happy'; shut = False; flash = False
    if state == 'idle': dy = [0, -1, -1, 0][i]
    elif state == 'move': dx = [-2, 0, 2, 0][i]; dy = [0, -2, 0, -2][i]; h += [0, 1, 0, 1][i]
    elif state == 'windup': h -= [3, 6][i]; w += [3, 6][i]; glow = CHARGE; expr = 'attack'
    elif state == 'attack': h += [4, 7, 2][i]; w -= [2, 5, 0][i]; glow = SHOOT; expr = 'attack'
    elif state == 'hurt': dx = [-3, -2][i]; w -= 2; expr = 'hurt'; flash = i == 0
    elif state == 'die':
        s = [1.0, .8, .55, .25][i]; w = int(w * s); h = int(h * s); expr = 'dead' if i < 2 else None; flash = i == 0; shut = i >= 2
    elif state == 'idle_mid': dy = [0, 0, -1, 0][i]; energy = 'mid'; expr = 'flat'
    elif state == 'idle_low': dy = [1, 1, 0, 1][i]; energy = 'low'; expr = 'sad'; h -= 2
    elif state == 'scared': dx = [-1, 1][i]; dy = -1; expr = 'scared'; w -= 2; h += 2
    elif state == 'shutdown': shut = True; expr = 'dead'; h -= 3 * (i + 1) // 2; w += 2 * i; energy = 'low'
    cx += dx; base = min(base + dy, 44)
    w = max(4, min(w, 40)); h = max(4, h)
    m = shape_mask(kind, cx, base, w, h, rnd); top = base - h
    bodyc, hi, lo = (GREY_B, GREY_L, GREY_S) if shut else ((RED_O, RED_O, RED_D) if flash else (WHITE_B, WHITE, WHITE_S))
    body = Image.new('RGBA', (48, 48), (0, 0, 0, 0)); body.paste(Image.new('RGBA', (48, 48), bodyc), mask=m)
    px = body.load(); mp = m.load()
    for y in range(48):
        for x in range(48):
            if mp[x, y]:
                if y > base - max(3, h // 4): px[x, y] = lo
                elif y < top + max(3, h // 3) and x < cx + 3 and x > cx - w // 2 + 1: px[x, y] = hi
    d = ImageDraw.Draw(body)
    if not shut and not flash and h > 12 and kind != 'triangle':  # glossy spec highlight
        d.rectangle([cx - w // 2 + 3, top + 3, cx - w // 2 + 4, top + 5], fill=WHITE); d.point((cx - w // 2 + 5, top + 3), fill=WHITE)
    if h >= 14:
        if kind == 'triangle': fy = top + h // 2 - 1; ky = base - 6
        else: fy = top + max(4, h // 4); ky = base - 7
        if expr: face(d, cx, fy, expr, kind, GREY_OD if shut else INK)
        knowl(d, kind, cx, ky, energy, shut)
    # matte rubbery 2px outline: red (grey when shut down), darker underneath
    m2 = m.filter(ImageFilter.MaxFilter(5)).point(lambda v: 255 if v else 0)
    oc, od = (GREY_O, GREY_OD) if shut else (RED_O, RED_D)
    ring = Image.new('RGBA', (48, 48), (0, 0, 0, 0)); rp = ring.load(); m2p = m2.load()
    for y in range(48):
        for x in range(48):
            if m2p[x, y] and not mp[x, y]: rp[x, y] = od if y >= (top + base) // 2 + 2 else oc
    ring.alpha_composite(body); img = ring; d = ImageDraw.Draw(img)
    if glow:
        for k in range(8 if state == 'windup' else 5):
            a = rnd.random() * 6.283; r = w // 2 + 4 + rnd.randint(0, 3)
            x, y = int(cx + math.cos(a) * r), int((top + base) / 2 + math.sin(a) * (h / 2 + 4))
            if 0 <= x < 48 and 0 <= y < 48: d.point((x, y), fill=glow)
        if state == 'attack':
            ox = cx + w // 2 + 3
            for k in range(3 + i * 2):
                x = ox + k * 3
                if x < 46: d.rectangle([x, base - h // 2, x + 1, base - h // 2 + 1], fill=SHOOT)
    if state == 'die' and i >= 1:
        for k in range(6):
            a = k / 6 * 6.283 + i; r = 4 + i * 5
            x, y = int(cx + math.cos(a) * r), int((top + base) / 2 + math.sin(a) * r)
            if 0 <= x < 46 and 0 <= y < 46: d.rectangle([x, y, x + 1, y + 1], fill=[WHITE_S, RED_O, KNOWL][k % 3] if i < 3 else GREY_S)
    return img

STATES = [('idle', 4), ('move', 4), ('windup', 2), ('attack', 3), ('hurt', 2), ('die', 4),
          ('idle_mid', 4), ('idle_low', 4), ('scared', 2), ('shutdown', 2)]
def foe_sheet(kind, seed):
    sh = Image.new('RGBA', (48 * 4, 48 * len(STATES)), (0, 0, 0, 0))
    for r, (st, n) in enumerate(STATES):
        for i in range(n): sh.alpha_composite(foe_frame(kind, st, i, seed), (i * 48, r * 48))
    return sh

# ---- underwater jellyfish speaker ----
WB = H('2BB5C9'); WB_D = H('1B7F9A'); BIO = H('7DF9FF'); BUB = H('E8F7FF'); DRY = H('6B6F80'); DRY_D = H('4E5163')
def jelly_frame(state, i):
    img = Image.new('RGBA', (48, 48), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    cx = 24; bob = 0; sq = 0; col = WB; colD = WB_D; cone = SHELL; glow = False; cab = 0
    if state == 'float': bob = round(2 * math.sin(i / 6 * 6.283)); cab = i
    elif state == 'pulse': sq = [0, 1, 3, 4][i]; glow = True; cab = i
    elif state == 'surge': sq = [-2, -1, 0, 1][i]; glow = True; cab = i
    elif state == 'hurt': col = WHITE if i == 0 else WB; cx -= 2
    elif state == 'dry': col = DRY; colD = DRY_D; bob = 4
    if state == 'die':
        r = [12, 14, 16, 0][i]
        if i < 3:
            d.ellipse([24 - r, 24 - r, 24 + r, 24 + r], outline=BUB if i % 2 else BIO)
            for k in range(3 + i * 2):
                a = k * 2.4 + i; d.point((int(24 + math.cos(a) * (r - 3)), int(24 + math.sin(a) * (r - 3))), fill=BUB)
        else:
            for k in range(8):
                a = k / 8 * 6.283; x, y = int(24 + math.cos(a) * 18), int(24 + math.sin(a) * 18); d.rectangle([x, y, x, y], fill=BUB)
        return img
    top = 8 + bob + sq; w = 15 - sq // 2
    dome = [cx - w, top, cx + w, top + 20 - sq]
    for k, ox in enumerate((-8, 0, 8)):
        for y in range(top + 17 - sq, 46):
            x = cx + ox + int(round(2 * math.sin((y + cab * 3 + k * 2) * 0.5)))
            d.point((x, y), fill=BIO if (y + k) % 7 == 0 and state != 'dry' else (SHELL if state != 'dry' else DRY_D))
    d.pieslice([dome[0], dome[1], dome[2], dome[3] + 10], 180, 360, fill=col)
    d.rectangle([dome[0], dome[1] + 10 - sq // 2, dome[2], dome[1] + 14 - sq // 2], fill=colD)
    d.arc([dome[0] + 3, dome[1] + 3, dome[0] + 12, dome[1] + 12], 190, 260, fill=BUB if state != 'dry' else H('8D91A3'))
    cy = dome[1] + 8
    d.ellipse([cx - 6, cy - 4, cx + 6, cy + 4], fill=cone)
    d.ellipse([cx - 3, cy - 2, cx + 3, cy + 2], fill=BIO if glow else (BODY if state != 'dry' else DRY_D))
    d.point((cx, cy), fill=EYE)
    img = outline(img)
    d = ImageDraw.Draw(img)
    if state == 'surge':
        for k in range(3 + i * 2):
            a = k * 1.3 + i; r = 15 + k * 2 + i * 2
            x, y = int(cx + math.cos(a) * r), int(top + 8 + math.sin(a) * r * .8)
            if 0 <= x < 48 and 0 <= y < 48: d.point((x, y), fill=[SURGE, ARC][k % 2])
    if state == 'pulse':
        for k in range(i + 1): d.point((cx - 14 + k * 3, top + 2 + (k % 2)), fill=BIO)
    if state == 'float': d.point((cx + 15, 12 + (i * 5) % 20), fill=BUB)
    return img
def jelly_sheet():
    rows = [('float', 6), ('pulse', 4), ('surge', 4), ('hurt', 2), ('die', 4), ('dry', 2)]
    sh = Image.new('RGBA', (48 * 6, 48 * 6), (0, 0, 0, 0))
    for r, (st, n) in enumerate(rows):
        for i in range(n):
            f = jelly_frame('float', 0) if (st == 'dry' and i == 0) else jelly_frame(st, i)
            sh.alpha_composite(f, (i * 48, r * 48))
    return sh

# ---- FX ----
def fx_spark():
    sh = Image.new('RGBA', (64, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(sh)
    for i in range(4):
        ox = i * 16; r = 2 + i * 2
        d.rectangle([ox + 7, 7, ox + 8, 8], fill=WHITE)
        for k, (ax, ay) in enumerate([(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)]):
            if i == 0 and k > 3: continue
            L = min(r if k < 4 else r - 1, 7)
            for s in range(2, L + 1): d.point((ox + 7 + ax * s, 7 + ay * s), fill=CHARGE if s < L else SURGE)
        if i == 3:
            for k in range(0, 16, 5): d.point((ox + k, 1 + k % 3), fill=ARC)
    return sh
def fx_surge():
    sh = Image.new('RGBA', (192, 32), (0, 0, 0, 0)); rnd = random.Random(11); d = ImageDraw.Draw(sh)
    for i in range(6):
        ox = i * 32; x, y = ox + 2, 16 + (i % 2) * 2 - 1; pts = [(x, y)]
        while x < ox + 28:
            x += rnd.randint(3, 5); y = max(6, min(26, y + rnd.randint(-6, 6))); pts.append((min(x, ox + 29), y))
        d.line(pts, fill=ARC, width=3); d.line(pts, fill=SURGE, width=1)
        for (px, py) in pts[1:-1:2]: d.point((px, py - 4 if py > 14 else py + 4), fill=WHITE)
    return sh
def fx_ring():
    sh = Image.new('RGBA', (320, 64), (0, 0, 0, 0)); d = ImageDraw.Draw(sh)
    for i in range(5):
        ox = i * 64; r = 8 + i * 5
        d.ellipse([ox + 32 - r, 32 - r, ox + 32 + r, 32 + r], outline=ARC, width=3)
        d.ellipse([ox + 33 - r, 33 - r, ox + 31 + r, 31 + r], outline=SURGE)
        for k in range(8):
            a = k / 8 * 6.283 + i * .4; d.point((int(ox + 32 + math.cos(a) * (r + 3)), int(32 + math.sin(a) * (r + 3))), fill=WHITE)
    return sh
def fx_pellets():
    sh = Image.new('RGBA', (16, 8), (0, 0, 0, 0)); d = ImageDraw.Draw(sh)
    d.ellipse([1, 1, 6, 6], fill=SHOOT); d.rectangle([3, 2, 4, 3], fill=WHITE); d.point((2, 5), fill=H('B01C74'))
    d.ellipse([9, 1, 14, 6], fill=CHARGE); d.rectangle([11, 2, 12, 3], fill=WHITE); d.point((10, 5), fill=ARC)
    return sh
def fx_jet():
    sh = Image.new('RGBA', (64, 24), (0, 0, 0, 0)); d = ImageDraw.Draw(sh); OR = H('FFB02E'); RD = H('FF5A1F')
    for i in range(4):
        ox = i * 16; L = [18, 22, 16, 20][i]; w = [5, 4, 6, 4][i]
        for y in range(L):
            hw = max(1, int(w * (1 - y / L) + 0.5)); sway = 1 if (y // 4 + i) % 2 else 0
            d.line([(ox + 8 - hw + sway, y + 1), (ox + 7 + hw + sway, y + 1)], fill=RD)
            if hw > 1: d.line([(ox + 9 - hw + sway, y + 1), (ox + 6 + hw + sway, y + 1)], fill=OR)
            if y < L * .55 and hw > 2: d.line([(ox + 7 + sway, y + 1), (ox + 8 + sway, y + 1)], fill=H('FFF1B8'))
    return sh

# ---- 1.1 tiles (16px, 16 cols) ----
T = 16
P = dict(g1=H('6BBF59'), g2=H('3E8E41'), s1=H('8A5A3B'), s2=H('5C3A26'), walk=H('D9D2C0'), roof=H('D2693F'), roofT=H('3FA7A0'),
         cream=H('F4E8C8'), coral=H('F08A6B'), sky=H('8CC8E8'), palm=H('2F8F5B'), sea=H('2BB5C9'), asph=H('4A4F5E'), white=H('F4F1EA'),
         wood=H('A8743C'), glass=H('BDE6F5'))
NAMES = []; tiles = []
def new(name):
    im = Image.new('RGBA', (T, T), (0, 0, 0, 0)); NAMES.append(name); tiles.append(im); return im, ImageDraw.Draw(im)
def speckle(d, cols, box, n, seed):
    r = random.Random(seed)
    for _ in range(n): d.point((r.randint(box[0], box[2]), r.randint(box[1], box[3])), fill=r.choice(cols))
def darker(c, f): return tuple(int(v * f) for v in c[:3]) + (255,)
def build_tiles():
    im, d = new('grass_top')
    d.rectangle([0, 0, 15, 15], fill=P['s1']); speckle(d, [P['s2']], (0, 6, 15, 15), 14, 3)
    d.rectangle([0, 0, 15, 4], fill=P['g1']); d.rectangle([0, 4, 15, 5], fill=P['g2'])
    for x in range(0, 16, 3): d.point((x, 6), fill=P['g2'])
    d.line([(0, 0), (15, 0)], fill=H('8FD878'))
    im, d = new('grass_mid'); d.rectangle([0, 0, 15, 15], fill=P['g1']); speckle(d, [P['g2'], H('8FD878')], (0, 0, 15, 15), 18, 4)
    for nm, left, half in (('slope_l', True, False), ('slope_r', False, False), ('slope_l_half', True, True), ('slope_r_half', False, True)):
        im, d = new(nm)
        for x in range(16):
            if half: top = (8 + x // 2) if left else (8 + (15 - x) // 2)
            else: top = x if left else 15 - x
            d.line([(x, top), (x, 15)], fill=P['s1']); d.line([(x, top), (x, min(15, top + 3))], fill=P['g1']); d.point((x, min(15, top + 4)), fill=P['g2'])
        speckle(d, [P['s2']], (0, 10, 15, 15), 6, 5)
    im, d = new('soil'); d.rectangle([0, 0, 15, 15], fill=P['s1']); speckle(d, [P['s2'], H('A8743C')], (0, 0, 15, 15), 22, 6)
    im, d = new('soil_dark'); d.rectangle([0, 0, 15, 15], fill=P['s2']); speckle(d, [P['s1'], H('3E2819')], (0, 0, 15, 15), 20, 7)
    im, d = new('curb'); d.rectangle([0, 0, 15, 15], fill=P['s2']); d.rectangle([0, 0, 15, 7], fill=P['walk']); d.line([(0, 7), (15, 7)], fill=H('A9A28F')); d.line([(0, 0), (15, 0)], fill=WHITE)
    im, d = new('sidewalk'); d.rectangle([0, 0, 15, 15], fill=P['walk']); d.line([(0, 0), (15, 0)], fill=WHITE); d.line([(7, 1), (7, 15)], fill=H('B8B09C')); d.line([(0, 15), (15, 15)], fill=H('B8B09C'))
    im, d = new('asphalt'); d.rectangle([0, 0, 15, 15], fill=P['asph']); speckle(d, [H('5C6272'), H('3C404C')], (0, 0, 15, 15), 16, 8)
    im, d = new('road_dash'); d.rectangle([0, 0, 15, 15], fill=P['asph']); d.rectangle([2, 7, 13, 8], fill=H('F4C430'))
    im, d = new('picket_fence')
    for x in (1, 6, 11):
        d.rectangle([x, 4, x + 3, 15], fill=P['white'], outline=INK); d.point((x + 1, 3), fill=INK); d.point((x + 2, 3), fill=INK)
    d.line([(0, 8), (15, 8)], fill=H('C9C4B6')); d.line([(0, 12), (15, 12)], fill=H('C9C4B6'))
    im, d = new('hedge'); d.rounded_rectangle([0, 3, 15, 15], 4, fill=P['palm'], outline=INK); speckle(d, [H('3FB372'), H('1F6B42')], (1, 4, 14, 14), 16, 9)
    im, d = new('driveway'); d.rectangle([0, 0, 15, 15], fill=H('BDB6A4')); d.line([(0, 0), (15, 0)], fill=H('D9D2C0')); d.line([(0, 8), (15, 8)], fill=H('A9A28F')); speckle(d, [H('A9A28F')], (0, 0, 15, 15), 10, 10)
    for nm, c in (('roof_terracotta', P['roof']), ('roof_teal', P['roofT'])):
        im, d = new(nm); d.rectangle([0, 0, 15, 15], fill=c); dk = darker(c, .72)
        for row in range(0, 16, 4):
            d.line([(0, row + 3), (15, row + 3)], fill=dk)
            for x in range((row // 4 % 2) * 4, 16, 8): d.line([(x, row), (x, row + 3)], fill=dk)
        d.line([(0, 0), (15, 0)], fill=INK)
    for nm, c in (('wall_cream', P['cream']), ('wall_coral', P['coral']), ('wall_sky', P['sky'])):
        im, d = new(nm); d.rectangle([0, 0, 15, 15], fill=c); speckle(d, [darker(c, .9)], (0, 0, 15, 15), 20, 12 + len(NAMES))
    im, d = new('window'); d.rectangle([0, 0, 15, 15], fill=P['cream']); d.rectangle([2, 2, 13, 13], fill=INK); d.rectangle([3, 3, 12, 12], fill=P['glass']); d.line([(7, 3), (7, 12)], fill=INK); d.line([(3, 7), (12, 7)], fill=INK); d.line([(4, 4), (5, 5)], fill=WHITE)
    im, d = new('door'); d.rectangle([0, 0, 15, 15], fill=P['cream']); d.rectangle([2, 0, 13, 15], fill=INK); d.rectangle([3, 1, 12, 15], fill=P['wood']); d.rectangle([5, 3, 10, 7], fill=H('8A5A3B')); d.point((10, 10), fill=JACK)
    im, d = new('garage_door'); d.rectangle([0, 0, 15, 15], fill=H('E4E0D4'))
    for y in range(1, 16, 4): d.line([(0, y), (15, y)], fill=H('B8B3A4'))
    d.line([(0, 0), (0, 15)], fill=INK); d.line([(15, 0), (15, 15)], fill=INK)
    im, d = new('porch_oneway'); d.rectangle([0, 0, 15, 4], fill=P['wood'], outline=INK); d.line([(5, 1), (5, 3)], fill=H('7C5428')); d.line([(11, 1), (11, 3)], fill=H('7C5428'))
    im, d = new('mailbox'); d.rectangle([7, 9, 8, 15], fill=P['s2']); d.rounded_rectangle([3, 3, 12, 9], 3, fill=H('3D6FD8'), outline=INK); d.rectangle([11, 1, 12, 5], fill=EYE)
    im, d = new('planter_destruct'); d.polygon([(2, 8), (13, 8), (11, 15), (4, 15)], fill=P['roof'], outline=INK); d.rectangle([2, 7, 13, 8], fill=H('E58A5E'))
    for (x, y) in [(5, 4), (8, 2), (11, 4), (7, 5)]: d.rectangle([x, y, x + 1, y + 2], fill=P['palm'] if (x + y) % 2 else H('E8447A'))
    im, d = new('sea'); d.rectangle([0, 0, 15, 15], fill=P['sea']); d.line([(1, 4), (6, 4)], fill=H('7FDDE8')); d.line([(9, 10), (14, 10)], fill=H('7FDDE8'))
    im, d = new('palm_trunk'); d.rectangle([5, 0, 10, 15], fill=P['wood']); d.line([(5, 3), (10, 4)], fill=H('7C5428')); d.line([(5, 9), (10, 10)], fill=H('7C5428')); d.line([(5, 0), (5, 15)], fill=INK); d.line([(10, 0), (10, 15)], fill=INK)
    im, d = new('palm_fronds'); d.polygon([(8, 14), (0, 6), (4, 8), (8, 2), (12, 8), (16, 6)], fill=P['palm'], outline=INK); d.line([(8, 14), (8, 4)], fill=H('1F6B42'))
    im, d = new('hibiscus'); d.rectangle([7, 8, 8, 15], fill=P['palm']); d.ellipse([3, 2, 12, 9], fill=H('E8447A'), outline=INK); d.rectangle([7, 5, 8, 6], fill=JACK)
def sheet():
    build_tiles()
    cols = 16; rows = (len(tiles) + cols - 1) // cols
    sh = Image.new('RGBA', (cols * T, max(rows, 2) * T), (0, 0, 0, 0))
    for k, t in enumerate(tiles): sh.alpha_composite(t, ((k % cols) * T, (k // cols) * T))
    return sh

def contact(items):
    try: font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 14)
    except Exception: font = ImageFont.load_default()
    bg = H('2A2740'); Z = 4; pad = 8
    blocks = [(l, im.resize((im.width * Z, im.height * Z), Image.NEAREST)) for l, im in items]
    W = max(z.width for _, z in blocks) + pad * 2
    Hh = sum(z.height + 44 for _, z in blocks) + pad
    sh = Image.new('RGBA', (W, Hh), bg); d = ImageDraw.Draw(sh); y = pad
    for label, z in blocks:
        for ln in label.split('\n'):
            d.text((pad, y), ln, fill=WHITE, font=font); y += 16
        y += 2
        sh.alpha_composite(Image.new('RGBA', z.size, H('3A3558')), (pad, y)); sh.alpha_composite(z, (pad, y)); y += z.height + 10
    return sh

def main():
    items = []
    for n, s in (('sine', 1), ('square', 2), ('triangle', 3), ('noise', 4)):
        sh = foe_sheet(n, s); sh.save(out('enemies', f'foe-{n}-sheet.png'))
        items.append((f'foe-{n}-sheet  48x48; rows: idle4 move4 windup2 attack3 hurt2 die4 energy-mid4 energy-low4 scared2 shutdown2', sh))
    j = jelly_sheet(); j.save(out('enemies', 'foe-jelly-sheet.png'))
    items.append(('foe-jelly-sheet  48x48; rows: float6 pulse4 surge4 hurt2 die4 dry(frame2 grey)', j))
    for n, im, desc in [('fx-spark', fx_spark(), '16x16 x4'), ('fx-surge', fx_surge(), '32x32 x6'), ('fx-surge-ring', fx_ring(), '64x64 x5'),
                        ('fx-pellets', fx_pellets(), '8x8 x2 (magenta shoot, cyan charge)'), ('fx-jet-flame', fx_jet(), '16x24 x4')]:
        im.save(out('fx', n + '.png')); items.append((f'{n}  {desc}', im))
    t = sheet(); t.save(out('tiles', 'tiles-1-1.png'))
    legend = '  '.join(f'{i}:{n}' for i, n in enumerate(NAMES))
    import textwrap
    items.append(('tiles-1-1  16px, 16 cols (index:name)\n' + '\n'.join(textwrap.wrap(legend, 150)), t))
    contact(items).save(out('previews', 'foes-tiles-contact.png'))
if __name__ == '__main__': main()
