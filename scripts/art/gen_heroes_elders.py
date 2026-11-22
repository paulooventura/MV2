#!/usr/bin/env python3
"""Deterministic generator: MV2 hero (Mind, Venture) + Elder A/B sprite sheets.
Run from repo root:  python scripts/art/gen_heroes_elders.py
Outputs (64x96 frames, transparent, 1px #1B1740 outline, <=16 colours each sheet):
  claude/assets/heroes/hero-mind-sheet.png, hero-venture-sheet.png
  claude/assets/elders/elder-a-sheet.png, elder-b-sheet.png
  claude/assets/previews/heroes-elders-contact.png (4x, labelled)
Figures face right. Body centre x=26 so the front arm can reach out inside the 64 px frame.
Rows (hero): idle4 walk6 run6 roll4 jump2 fall2 duck2 punch4 hook3 hurt2 shutdown4 swim4.
Rows (elder): idle4 wave4 shutdown4 captive2.
P2 palette swap (applied at runtime, not baked, to keep each sheet <=16 colours):
  Mind  eye 8A4DFF/C7A6FF glove 7B3FE0/4A2390  ->  P2 alt e.g. eye 38E8FF/B8F6FF glove 1FA8C0/0E6A80
  Venture eye FF3B4A/FF9AA3 glove E0303C/8A1822 ->  P2 alt e.g. eye 7DF93B/C6FFA0 glove 4FB82A/2E7A14
"""
import math, os, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'claude', 'assets')
W, H = 64, 96
CX = 26
INK = (0x1B, 0x17, 0x40)


def hx(s):
    s = s.lstrip('#')
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))


class Cv:
    def __init__(self, mp):
        self.im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)
        self.mp = mp

    def col(self, n):
        return self.mp[n] + (255,)

    def r(self, x0, y0, x1, y1, n):  # half-open rect
        if x1 > x0 and y1 > y0:
            self.d.rectangle([int(x0), int(y0), int(x1) - 1, int(y1) - 1], fill=self.col(n))

    def p(self, x, y, n):
        if 0 <= x < W and 0 <= y < H:
            self.im.putpixel((int(x), int(y)), self.col(n))

    def c(self, x, y, rad, n):
        self.d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=self.col(n))

    def e(self, x0, y0, x1, y1, n):
        self.d.ellipse([x0, y0, x1 - 1, y1 - 1], fill=self.col(n))

    def ln(self, x0, y0, x1, y1, n):
        self.d.line([x0, y0, x1, y1], fill=self.col(n))

    def cable(self, x0, y0, x1, y1, sag, n1, n2, th=2):
        dist = math.hypot(x1 - x0, y1 - y0)
        N = int(dist * 1.3) + 2
        for i in range(N + 1):
            t = i / N
            x = x0 + (x1 - x0) * t + sag[0] * math.sin(math.pi * t)
            y = y0 + (y1 - y0) * t + sag[1] * math.sin(math.pi * t)
            col = n1 if (i // 2) % 2 == 0 else n2
            xi, yi = round(x), round(y)
            self.r(xi - th // 2, yi - th // 2, xi - th // 2 + th, yi - th // 2 + th, col)


def outline(im):
    px = im.load()
    out = im.copy()
    op = out.load()
    for y in range(H):
        for x in range(W):
            if px[x, y][3] == 0:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W and 0 <= ny < H and px[nx, ny][3] > 0:
                        op[x, y] = INK + (255,)
                        break
    return out


def finish(cv):
    return outline(cv.im)


# ----------------------------------------------------------------------------- HERO
HERO_BASE = {
    'ink': hx('1B1740'), 'body': hx('15131F'), 'panel': hx('2A2740'),
    'chl': hx('D5DCE8'), 'chd': hx('8F9BB0'), 'vinyl': hx('0E0E16'), 'groove': hx('3A3558'),
    'glass': hx('E8F7FF'), 'juice': hx('F8E71C'), 'glow': hx('FFF6A0'),
}
HEROES = {
    'mind': dict(fl=hx('2B1458'), eye=hx('8A4DFF'), eye_hi=hx('C7A6FF'), glove=hx('7B3FE0'), glove_dk=hx('4A2390')),
    'venture': dict(fl=hx('4A0F1C'), eye=hx('FF3B4A'), eye_hi=hx('FF9AA3'), glove=hx('E0303C'), glove_dk=hx('8A1822')),
}
HERO_ROWS = [('idle', 4), ('walk', 6), ('run', 6), ('roll', 4), ('jump', 2), ('fall', 2), ('duck', 2),
             ('punch', 4), ('hook', 3), ('hurt', 2), ('shutdown', 4), ('swim', 4)]

# shutdown stage colour maps (greying out)
SHUT = {
    0: {},
    1: {'juice': 'chd', 'glow': 'chl'},
    2: {'juice': 'chd', 'glow': 'chd', 'glove': 'glove_dk', 'eye_hi': 'chd', 'eye': 'chd'},
    3: {'juice': 'chd', 'glow': 'chd', 'glove': 'glove_dk', 'eye_hi': 'chd', 'eye': 'chd', 'glass': 'chl'},
}


def P(**k):
    d = dict(bob=0, lean=0, boxh=24, fh=(3, 16), bh=(-3, 16), fs=(4, 0), bs=(-4, 0), ang=0, eye='on',
             hat=0, extra=None, stage=0, claw=False, tilt=0)
    d.update(k)
    return d


def hero_pose(anim, i):
    s = math.sin
    pi = math.pi
    if anim == 'idle':
        return P(bob=[0, -1, -1, 0][i], fh=(3, 16 + [0, 1, 1, 0][i]), bh=(-3, 16 - [0, 1, 1, 0][i]),
                 hat=[0, 0, 1, 0][i], ang=0)
    if anim == 'walk':
        ph = 2 * pi * i / 6
        return P(bob=-round(abs(s(ph * 1.0)) * 1.4), fh=(3 + round(6 * s(ph)), 16), bh=(-3 - round(6 * s(ph)), 16),
                 fs=(2, 0), bs=(-2, 0), ang=i * 20)
    if anim == 'run':
        ph = 2 * pi * i / 6
        return P(bob=-round(abs(s(ph)) * 2), lean=3, fh=(8 + round(4 * s(ph)), 8 - round(4 * s(ph))),
                 bh=(-7 - round(2 * s(ph)), 8 + round(4 * s(ph))), fs=(0, 3), bs=(0, 3), ang=i * 40,
                 hat=-1, extra='streak', tilt=1)
    if anim == 'roll':
        return P(boxh=15, lean=2, fh=(3, 9), bh=(-3, 9), fs=(3, 0), bs=(-3, 0), ang=i * 30, extra='streak')
    if anim == 'jump':
        return [P(bob=-3, fh=(6, -9), bh=(-6, -9), fs=(3, -3), bs=(-3, -3), ang=10, hat=1),
                P(bob=-5, fh=(7, -13), bh=(-7, -13), fs=(3, -3), bs=(-3, -3), ang=20, hat=2)][i]
    if anim == 'fall':
        return [P(bob=0, fh=(11, -6), bh=(-11, -6), fs=(0, -4), bs=(0, -4), hat=2, eye='wide', ang=30),
                P(bob=1, fh=(12, -2), bh=(-12, -2), fs=(0, -3), bs=(0, -3), hat=3, eye='wide', ang=50)][i]
    if anim == 'duck':
        return [P(boxh=13, fh=(5, 9), bh=(-5, 9), fs=(3, 0), bs=(-3, 0)),
                P(boxh=10, fh=(6, 8), bh=(-6, 8), fs=(3, 0), bs=(-3, 0), hat=-1)][i]
    if anim == 'punch':
        return [P(lean=-2, fh=(-1, 7), fs=(-2, 3), bh=(-4, 16), tilt=-1),
                P(lean=1, fh=(8, 0), fs=(0, 2), bh=(-6, 14)),
                P(lean=3, fh=(15, -1), fs=(0, 0), bh=(-8, 12), eye='wide', extra='streak'),
                P(lean=1, fh=(8, 7), fs=(2, 2), bh=(-4, 16))][i]
    if anim == 'hook':
        return [P(lean=0, fh=(8, -8), fs=(4, 0), bh=(-3, 16)),
                P(lean=1, fh=(12, -14), fs=(0, 0), bh=(-5, 14), claw=True),
                P(lean=2, fh=(13, -18), fs=(0, 0), bh=(-6, 13), claw=True, eye='wide')][i]
    if anim == 'hurt':
        return [P(lean=-3, fh=(11, -5), bh=(-9, -4), fs=(0, -3), bs=(0, -3), eye='x', extra='stars', hat=2, tilt=-1),
                P(lean=-4, bob=1, fh=(10, -2), bh=(-8, -1), fs=(0, -2), bs=(0, -2), eye='x', extra='stars', hat=3, tilt=-1)][i]
    if anim == 'shutdown':
        return [P(eye='half', bob=0, fh=(3, 16), bh=(-3, 16), stage=0),
                P(eye='half', bob=1, fh=(3, 17), bh=(-3, 17), stage=1, hat=-1, lean=-1),
                P(eye='off', bob=2, fh=(2, 18), bh=(-2, 18), stage=2, hat=-2, lean=-1),
                P(eye='off', bob=3, fh=(2, 19), bh=(-2, 19), stage=3, hat=-3, lean=-2)][i]
    if anim == 'swim':
        ph = 2 * pi * i / 4
        return P(bob=round(2 * s(ph)), fh=(8, 6 + round(5 * s(ph))), bh=(-8, 6 - round(5 * s(ph))),
                 fs=(0, 3), bs=(0, 3), ang=i * 15, extra='bubbles', lean=1)
    raise ValueError(anim)


def draw_hero(name, anim, i):
    pose = hero_pose(anim, i)
    mp = dict(HERO_BASE)
    mp.update(HEROES[name])
    for k, v in SHUT[pose['stage']].items():
        mp[k] = mp[v]
    c = Cv(mp)
    cx = CX + pose['lean']
    bob = pose['bob']
    boxh = pose['boxh']
    boxbot = 66 + bob
    boxtop = boxbot - boxh
    rt = boxtop - 8
    cy = rt - 11
    sy = rt + 5
    # back arm
    bx, by = cx - 15, sy
    spring(c, bx, by, bx + pose['bh'][0], by + pose['bh'][1], pose['bs'])
    glove(c, bx + pose['bh'][0], by + pose['bh'][1])
    # Knowl tank (back)
    tx0, tx1 = cx - 22, cx - 13
    ty0, ty1 = boxtop + 1, boxbot - 3
    if boxh >= 14:
        c.r(tx0, ty0, tx1, ty1, 'chl')
        c.r(tx0 + 1, ty0 + 2, tx1 - 1, ty1 - 1, 'juice')
        c.r(tx0 + 2, ty0 + 3, tx0 + 3, ty1 - 3, 'glow')
        c.r(tx0 + 1, ty0 - 1, tx1 - 1, ty0 + 1, 'chd')
        c.p(tx0 + 4, ty0 - 2, 'chd')
    # wheel
    wcx, wcy, wr = CX, 76, 12
    c.c(wcx, wcy, wr, 'body')
    c.c(wcx, wcy, wr - 3, 'panel')
    for k in range(12):  # tread notches
        a = k * pi2 / 12 + math.radians(pose['ang'])
        c.p(round(wcx + math.cos(a) * (wr - 1)), round(wcy + math.sin(a) * (wr - 1)), 'panel')
    for k in range(3):
        a = math.radians(pose['ang']) + k * pi2 / 3
        c.ln(wcx, wcy, round(wcx + math.cos(a) * 8), round(wcy + math.sin(a) * 8), 'chd')
    c.c(wcx, wcy, 3, 'chl')
    c.c(wcx, wcy, 1, 'chd')
    # body box: matte sub-woofer cabinet (no gloss)
    c.r(cx - 12, boxtop, cx + 12, boxbot, 'body')
    c.r(cx - 12, boxtop, cx - 11, boxbot, 'panel')
    c.r(cx + 11, boxtop, cx + 12, boxbot, 'panel')
    for (qx, qy) in ((cx - 10, boxtop + 2), (cx + 9, boxtop + 2), (cx - 10, boxbot - 3), (cx + 9, boxbot - 3)):
        c.p(qx, qy, 'panel')                                  # corner screws
    if boxh >= 16:
        wy = boxtop + boxh // 2
        c.c(cx, wy, min(9, boxh // 2 - 2), 'panel')           # woofer surround
        c.c(cx, wy, min(7, boxh // 2 - 4), 'body')
        c.c(cx, wy, min(5, boxh // 2 - 6), 'groove')          # cone rings
        c.c(cx, wy, min(3, boxh // 2 - 8), 'body')
        c.p(cx, wy, 'panel')
    else:
        c.r(cx - 8, boxtop + 3, cx + 9, boxbot - 3, 'panel')
        c.c(cx, boxtop + boxh // 2, 2, 'body')
    # thick vinyl stack (3 records, grooves visible)
    for k in (6, 3, 0):
        c.e(cx - 16, rt + k, cx + 17, rt + k + 6, 'chd')
        c.e(cx - 16, rt + k, cx + 17, rt + k + 5, 'vinyl')
        c.e(cx - 14, rt + k + 1, cx + 15, rt + k + 4, 'groove')
        c.e(cx - 13, rt + k + 1, cx + 14, rt + k + 4, 'vinyl')
    c.e(cx - 10, rt + 1, cx + 11, rt + 4, 'groove')
    c.e(cx - 9, rt + 1, cx + 10, rt + 4, 'vinyl')
    c.e(cx - 5, rt + 1, cx + 6, rt + 4, 'eye')               # label in the hero's colour
    c.p(cx, rt + 3, 'body')
    # orbs
    for ox in (cx - 15, cx + 16):
        c.c(ox, sy, 4, 'chd')
        c.c(ox - 1, sy - 1, 3, 'chl')
        c.p(ox - 2, sy - 2, 'glass')
    # bulb head
    c.c(cx, cy, 10, 'chl')
    c.c(cx + 1, cy - 1, 9, 'glass')
    # screw base
    c.r(cx - 5, rt - 5, cx + 6, rt - 1, 'chd')
    c.r(cx - 5, rt - 5, cx + 6, rt - 4, 'chl')
    c.r(cx - 5, rt - 3, cx + 6, rt - 2, 'chl')
    # filament
    filaments(c, cx, cy, rt, pose['stage'])
    draw_eye(c, cx + 3, cy + 1, pose['eye'])
    # hat
    bt = cy - 10 - pose['hat']
    if name == 'mind':
        c.r(cx - 9, bt - 7, cx + 10, bt + 1, 'body')
        c.r(cx - 9, bt - 7, cx - 8, bt + 1, 'panel')
        c.r(cx - 8, bt - 7, cx + 9, bt - 6, 'panel')
        c.r(cx - 17, bt, cx + 18, bt + 3, 'body')
        c.r(cx - 15, bt, cx + 16, bt + 1, 'panel')
        c.p(cx - 17, bt, 'ink'); c.p(cx + 17, bt, 'ink')   # slanted ends
        felt(c, cx - 8, bt - 5, cx + 9, bt + 1); felt(c, cx - 16, bt + 1, cx + 17, bt + 3)
    else:
        c.e(cx - 9, bt - 8, cx + 10, bt + 3, 'body')
        c.r(cx - 9, bt - 3, cx + 10, bt + 1, 'body')
        c.r(cx - 7, bt - 7, cx + 5, bt - 6, 'panel')
        c.r(cx - 18, bt - 1, cx - 6, bt + 2, 'body')           # back brim only
        c.r(cx - 17, bt - 1, cx - 7, bt, 'panel')
        felt(c, cx - 8, bt - 5, cx + 9, bt); felt(c, cx - 17, bt + 1, cx - 6, bt + 2)
        for (px_, py_) in ((-3, -4), (-2, -4), (-1, -4), (0, -3), (-3, -3), (-2, -2), (-1, -2)):   # laid-down P
            c.p(cx + px_, bt + py_, 'chd')
    # front arm
    fx, fy = cx + 16, sy
    hx_, hy_ = fx + pose['fh'][0], fy + pose['fh'][1]
    spring(c, fx, fy, hx_, hy_, pose['fs'])
    glove(c, hx_, hy_)
    if pose['claw']:
        c.ln(hx_ + 3, hy_ - 2, hx_ + 5, hy_ - 4, 'chl')
        c.ln(hx_ + 5, hy_ - 4, hx_ + 4, hy_ - 6, 'chl')
        c.p(hx_ + 3, hy_ - 6, 'chl')
    ex = pose['extra']
    if ex == 'streak':
        for k, yy in enumerate((boxtop + 4, boxtop + 11, boxtop + 18)):
            c.r(0, yy, 4 + (k % 2) * 2, yy + 1, 'chd')
    if ex == 'stars':
        for (a, b) in ((cx - 12, cy - 12), (cx + 12, cy - 10), (cx + 2, cy - 17)):
            c.p(a, b, 'juice'); c.p(a + 1, b, 'juice'); c.p(a, b + 1, 'juice'); c.p(a - 1, b, 'glow'); c.p(a, b - 1, 'glow')
    if ex == 'bubbles':
        for (a, b, rr) in ((cx + 10, cy - 14 - i * 2, 1), (cx - 8, cy - 18 - (i * 3) % 7, 2), (cx + 15, cy - 4 - i, 1)):
            c.d.ellipse([a - rr, b - rr, a + rr, b + rr], outline=c.col('glass'))
    return finish(c)


pi2 = math.pi * 2

HP = {'ink': hx('1B1740'), 'cup': hx('E8E8F0'), 'band': hx('2A2740'), 'chd': hx('8F9BB0')}


def draw_hp(anim, i):
    """Co-op headphones overlay (same grid as the hero sheet): 12x12 cup on the back of the head."""
    pose = hero_pose(anim, i)
    cx = CX + pose['lean']
    boxtop = 66 + pose['bob'] - pose['boxh']
    cy = boxtop - 8 - 11
    c = Cv(HP)
    c.r(cx - 7, cy - 14, cx - 4, cy - 5, 'band')              # band rising over the head, behind the hat
    c.r(cx - 7, cy - 14, cx + 1, cy - 12, 'band')
    c.r(cx - 16, cy - 5, cx - 4, cy + 7, 'cup')               # 12x12 cup
    c.r(cx - 14, cy - 3, cx - 6, cy + 5, 'chd')
    c.r(cx - 13, cy - 2, cx - 7, cy + 4, 'cup')
    c.r(cx - 11, cy, cx - 9, cy + 2, 'band')
    return finish(c)


def felt(c, x0, y0, x1, y1):
    for y in range(y0, y1):
        for x in range(x0, x1):
            if (x + y) % 2 == 0 and (x * 7 + y * 3) % 5 < 2:
                c.p(x, y, 'panel')


def spring(c, x0, y0, x1, y1, sag):
    dist = math.hypot(x1 - x0, y1 - y0)
    N = int(dist * 1.4) + 3
    pts = []
    for i in range(N + 1):
        t = i / N
        pts.append((x0 + (x1 - x0) * t + sag[0] * math.sin(math.pi * t), y0 + (y1 - y0) * t + sag[1] * math.sin(math.pi * t)))
    for (x, y) in pts:
        c.p(round(x), round(y), 'panel')                      # core
    for i in range(1, N, 2):                                  # coil rings
        x, y = pts[i]
        ax, ay = pts[i + 1][0] - pts[i - 1][0], pts[i + 1][1] - pts[i - 1][1]
        L = math.hypot(ax, ay) or 1
        nx, ny = -ay / L, ax / L
        for k in (-2, -1, 0, 1, 2):
            c.p(round(x + nx * k), round(y + ny * k), 'chd' if k != -2 else 'chl')


def filaments(c, cx, cy, rt, stage):
    lit = 'juice' if stage < 2 else 'chd'
    c.ln(cx - 3, rt - 5, cx - 4, cy + 1, 'chd')              # support wires
    c.ln(cx + 4, rt - 5, cx + 5, cy + 1, 'chd')
    c.ln(cx - 4, cy + 1, cx - 4, cy - 5, 'chd')
    c.ln(cx + 5, cy + 1, cx + 5, cy - 5, 'chd')
    x, up = cx - 4, True
    for k in range(10):                                       # tungsten zig-zag between the posts
        c.p(x + k, cy - 5 - (1 if k % 2 else 0), lit)
    c.p(cx - 4, cy - 6, lit); c.p(cx + 5, cy - 6, lit)


def glove(c, x, y):
    c.c(x, y, 4, 'glove_dk')
    c.c(x - 1, y - 1, 3, 'glove')
    c.p(x - 2, y - 2, 'glove_dk')


def draw_eye(c, ex, ey, mode):
    # ferrofluid blob: glossy black-purple/red, bright highlight, coloured rim light
    def blob(w, h):
        c.e(ex - w, ey - h, ex + w + 1, ey + h + 1, 'fl')
        c.p(ex - w // 2, ey + h + 1, 'fl'); c.p(ex + 1, ey + h + 2, 'fl')    # ferrofluid drip spikes
        c.p(ex + w, ey - h - 1, 'fl') if w > 3 else None
        c.r(ex - w + 1, ey - h + 1, ex - w + 3, ey - h + 3, 'eye_hi')         # highlight
        c.p(ex + w - 1, ey + h - 1, 'eye'); c.p(ex + w - 2, ey + h, 'eye'); c.p(ex + w, ey + h - 2, 'eye')   # rim
    if mode == 'on':
        blob(3, 3)
    elif mode == 'wide':
        blob(4, 4)
    elif mode == 'half':
        c.e(ex - 3, ey, ex + 4, ey + 4, 'fl')
        c.p(ex - 2, ey + 1, 'eye_hi'); c.p(ex + 2, ey + 3, 'eye')
    elif mode == 'off':
        c.e(ex - 3, ey + 1, ex + 4, ey + 4, 'fl')
    elif mode == 'x':
        blob(3, 3)
        for k in (-2, -1, 0, 1, 2):
            c.p(ex + k, ey + k, 'eye'); c.p(ex + k, ey - k, 'eye')


# ----------------------------------------------------------------------------- ELDERS
ELDER_A = {
    'ink': hx('1B1740'), 'wood': hx('8A5A3B'), 'wood_d': hx('5E3A25'), 'valve': hx('FFB85C'),
    'valve_dim': hx('B07A3A'), 'valve_hi': hx('FFE9A8'), 'cream': hx('F4E8C8'), 'needle': hx('15131F'),
    'whisk': hx('C9C9D6'), 'cardi': hx('6E8F6B'), 'cardi_d': hx('4C6A4A'),
    'g1': hx('9A9AA6'), 'g2': hx('6B6F80'), 'g3': hx('454860'),
}
ELDER_B = {
    'ink': hx('1B1740'), 'steel': hx('5A6A7A'), 'steel_d': hx('3F4C5A'), 'steel_l': hx('7E90A2'),
    'spool': hx('D8D8E0'), 'shawl': hx('B5523B'), 'shawl_d': hx('8A3A28'), 'tape': hx('2A2740'),
    'chd': hx('8F9BB0'), 'glow': hx('FFF6A0'), 'g1': hx('9A9AA6'), 'g2': hx('6B6F80'), 'g3': hx('454860'),
}
SHUT_A = {
    0: {'valve': 'valve_dim', 'valve_hi': 'valve'},
    1: {'valve': 'g1', 'valve_hi': 'g1', 'valve_dim': 'g2', 'needle': 'needle'},
    2: {'valve': 'g2', 'valve_hi': 'g1', 'valve_dim': 'g3', 'wood': 'g2', 'wood_d': 'g3', 'cardi': 'g2', 'cardi_d': 'g3'},
    3: {'valve': 'g3', 'valve_hi': 'g2', 'valve_dim': 'g3', 'wood': 'g2', 'wood_d': 'g3', 'cardi': 'g2', 'cardi_d': 'g3',
        'cream': 'g1', 'whisk': 'g1'},
}
SHUT_B = {
    0: {'glow': 'spool'},
    1: {'glow': 'g1', 'shawl': 'shawl_d'},
    2: {'glow': 'g2', 'shawl': 'g2', 'shawl_d': 'g3', 'steel': 'g2', 'steel_d': 'g3', 'steel_l': 'g1'},
    3: {'glow': 'g3', 'shawl': 'g2', 'shawl_d': 'g3', 'steel': 'g2', 'steel_d': 'g3', 'steel_l': 'g1',
        'spool': 'g1', 'chd': 'g1'},
}
ELDER_ROWS = [('idle', 4), ('wave', 4), ('shutdown', 4), ('captive', 2)]


def elder_pose(anim, i):
    d = dict(bob=0, arm_f=(5, 16), arm_b=(-5, 16), spin=0, stage=None, droop=0, lean=0, bound=False, blink=False)
    if anim == 'idle':
        d.update(bob=[0, 0, 1, 1][i], spin=i * 10, arm_f=(5, 16 - [0, 1, 1, 0][i]), arm_b=(-5, 16 - [1, 0, 0, 1][i]),
                 blink=(i == 3))
    elif anim == 'wave':
        d.update(arm_f=[(11, -9), (13, -13), (11, -9), (9, -12)][i], spin=i * 10, bob=[0, 0, 0, 0][i])
        d['arm_b'] = (-5, 16)
    elif anim == 'shutdown':
        d.update(stage=i, bob=i, droop=i, spin=0, arm_f=(5, 16 + i), arm_b=(-5, 16 + i), lean=-i // 2)
    elif anim == 'captive':
        d.update(bob=[2, 3][i], droop=2, lean=[0, 1][i], bound=True, arm_f=(2, 14), arm_b=(-2, 14), spin=0)
    return d


def draw_elder(kind, anim, i):
    pose = elder_pose(anim, i)
    base = ELDER_A if kind == 'a' else ELDER_B
    mp = dict(base)
    if pose['stage'] is not None:
        sm = (SHUT_A if kind == 'a' else SHUT_B)[pose['stage']]
        for k, v in sm.items():
            mp[k] = base[v]
    c = Cv(mp)
    ecx = 32 + pose['lean']
    bob = pose['bob']
    droop = pose['droop']
    arm_col = ('cardi', 'cardi_d') if kind == 'a' else ('shawl', 'shawl_d')
    hand = 'whisk' if kind == 'a' else 'spool'
    sh_y = 58 + bob
    # legs / feet
    for lx in (ecx - 9, ecx + 3):
        c.r(lx, 80, lx + 7, 88, 'wood_d' if kind == 'a' else 'steel_d')
        c.r(lx - 1, 85, lx + 8, 88, 'wood' if kind == 'a' else 'steel')
    # back arm
    bx, by = ecx - 14, sh_y
    bhx, bhy = bx + pose['arm_b'][0], by + pose['arm_b'][1]
    if pose['bound']:
        bhx, bhy = ecx - 3, sh_y + 12
    c.cable(bx, by, bhx, bhy, (-3, 0) if not pose['bound'] else (-4, 3), *arm_col)
    c.c(bhx, bhy, 3, hand)
    if kind == 'a':
        # tube amp cabinet
        top = 40 + bob
        c.r(ecx - 15, top, ecx + 15, 82, 'wood')
        c.r(ecx - 15, top, ecx - 13, 82, 'wood_d')
        c.r(ecx + 13, top, ecx + 15, 82, 'wood_d')
        # face panel with dial eyes
        fy = top + 2 + droop // 2
        c.r(ecx - 12, fy - 18 + 6, ecx + 12, fy + 12, 'wood_d')
        for ex_ in (ecx - 6, ecx + 6):
            c.c(ex_, fy + 1, 5, 'cream')
            ne = 'needle'
            ang = math.radians(-60 + (20 if droop else 0) + pose['spin'] * 0.6)
            if pose['blink']:
                c.r(ex_ - 4, fy, ex_ + 5, fy + 2, 'cream')
                c.r(ex_ - 4, fy + 1, ex_ + 5, fy + 2, 'needle')
            elif droop >= 2:
                c.r(ex_ - 4, fy - 4, ex_ + 5, fy - 1, 'wood_d')
                c.ln(ex_, fy + 1, ex_ + 2, fy + 3, ne)
            else:
                c.ln(ex_, fy + 4, round(ex_ + math.cos(ang) * 4), round(fy + 4 + math.sin(ang) * 5), ne)
            c.p(ex_, fy + 4, ne)
        # valves on top
        for k, vx in enumerate((ecx - 9, ecx - 2, ecx + 5)):
            vt = top - 14 + (1 if droop else 0) + (k % 2)
            c.r(vx, vt + 2, vx + 5, top + 1, 'valve')
            c.r(vx + 1, vt, vx + 4, vt + 2, 'valve')
            c.r(vx + 1, vt + 3, vx + 2, top - 3, 'valve_hi')
            c.r(vx - 1, top - 1, vx + 6, top + 2, 'wood_d')
        # whisker cables
        c.cable(ecx - 12, fy + 6, ecx - 17, fy + 22, (-3, 0), 'whisk', 'whisk', 1)
        c.cable(ecx + 12, fy + 6, ecx + 17, fy + 22, (3, 0), 'whisk', 'whisk', 1)
        # cardigan
        c.r(ecx - 15, 58 + bob, ecx + 15, 82, 'cardi')
        c.r(ecx - 15, 58 + bob, ecx - 13, 82, 'cardi_d')
        c.r(ecx + 13, 58 + bob, ecx + 15, 82, 'cardi_d')
        for k in range(3):
            c.ln(ecx - 4 + k, 58 + bob + k * 2, ecx, 66 + bob + k, 'cream') if False else None
        c.r(ecx - 5, 58 + bob, ecx + 6, 60 + bob, 'cream')
        c.r(ecx - 3, 60 + bob, ecx + 4, 62 + bob, 'cream')
        c.r(ecx - 1, 62 + bob, ecx + 2, 64 + bob, 'cream')
        c.r(ecx, 64 + bob, ecx + 1, 82, 'cardi_d')
        for yy in (68 + bob, 73 + bob, 78):
            c.p(ecx - 2, yy, 'needle'); c.p(ecx - 2, yy + 1, 'needle')
        c.r(ecx + 5, 70 + bob, ecx + 12, 76 + bob, 'cardi_d')   # pocket
        c.r(ecx + 6, 70 + bob, ecx + 11, 71 + bob, 'cardi')
    else:
        top = 42 + bob
        c.r(ecx - 14, top, ecx + 14, 82, 'steel')
        c.r(ecx - 14, top, ecx - 12, 82, 'steel_d')
        c.r(ecx + 12, top, ecx + 14, 82, 'steel_d')
        c.r(ecx - 12, top, ecx + 12, top + 1, 'steel_l')
        # bun (top reel)
        c.c(ecx, top - 6 + droop // 2, 6, 'spool')
        c.c(ecx, top - 6 + droop // 2, 2, 'steel_d')
        for k in range(3):
            a = math.radians(pose['spin'] * 3 + k * 120)
            c.ln(ecx, top - 6 + droop // 2, round(ecx + math.cos(a) * 5), round(top - 6 + droop // 2 + math.sin(a) * 5), 'steel_d')
        # spool eyes
        eyy = top + 11 + droop // 2
        for ex_ in (ecx - 8, ecx + 8):
            c.c(ex_, eyy, 7, 'spool')
            c.c(ex_, eyy, 2, 'steel_d')
            if droop >= 2:
                c.r(ex_ - 7, eyy - 7, ex_ + 8, eyy - 2, 'steel')
            for k in range(3):
                a = math.radians(pose['spin'] * 4 + k * 120 + 90)
                c.ln(ex_, eyy, round(ex_ + math.cos(a) * 6), round(eyy + math.sin(a) * 6), 'steel_d')
            c.p(ex_, eyy, 'glow')
        # tape smile
        c.cable(ecx - 5, eyy + 11, ecx + 5, eyy + 11, (0, 2 if droop < 2 else -2), 'tape', 'tape', 1)
        # knobs
        for kx in (ecx - 9, ecx + 9):
            c.c(kx, top + 28 + droop // 2, 2, 'chd')
        # shawl
        c.r(ecx - 16, 56 + bob, ecx + 17, 62 + bob, 'shawl')
        for k in range(8):
            c.r(ecx - 16 + k * 2, 62 + bob + k // 2 if k < 4 else 62 + bob + (7 - k) // 2, ecx - 14 + k * 2, 66 + bob + (k // 2 if k < 4 else (7 - k) // 2) * 2, 'shawl')
        c.r(ecx - 10, 62 + bob, ecx + 11, 72 + bob, 'shawl')
        c.r(ecx - 6, 72 + bob, ecx + 7, 77 + bob, 'shawl')
        c.r(ecx - 2, 77 + bob, ecx + 3, 80 + bob, 'shawl_d')
        for k in range(0, 20, 4):
            c.r(ecx - 8 + k, 56 + bob, ecx - 6 + k, 58 + bob, 'shawl_d')
        c.r(ecx - 16, 56 + bob, ecx + 17, 57 + bob, 'shawl_d')
        for fx_ in range(ecx - 5, ecx + 8, 3):   # fringe
            c.p(fx_, 81 + bob, 'shawl_d')
    # front arm
    fx, fy_ = ecx + 14, sh_y
    fhx, fhy = fx + pose['arm_f'][0], fy_ + pose['arm_f'][1]
    if pose['bound']:
        fhx, fhy = ecx + 3, sh_y + 12
    c.cable(fx, fy_, fhx, fhy, (4, 0) if not pose['bound'] else (4, 4), *arm_col)
    c.c(fhx, fhy, 3, hand)
    if pose['bound']:
        c.r(bhx - 1, bhy + 3, fhx + 2, bhy + 5, 'chd') if False else None
        # restraint: chain bar + cuffs
        pal = 'whisk' if kind == 'a' else 'chd'
        c.r(ecx - 6, sh_y + 10, ecx + 7, sh_y + 12, pal) if False else None
        c.r(ecx - 4, sh_y + 14, ecx + 5, sh_y + 16, pal)
        c.p(ecx - 5, sh_y + 13, pal); c.p(ecx + 6, sh_y + 13, pal)
    return finish(c)


# ----------------------------------------------------------------------------- sheets + contact
def build_sheet(rows, fn):
    cols = max(n for _, n in rows)
    sh = Image.new('RGBA', (cols * W, len(rows) * H), (0, 0, 0, 0))
    for r, (anim, n) in enumerate(rows):
        for i in range(n):
            sh.paste(fn(anim, i), (i * W, r * H))
    return sh


def colours(im):
    return {p[:3] for p in im.getdata() if p[3] > 0}


def main():
    sheets = []
    for name in ('mind', 'venture'):
        sh = build_sheet(HERO_ROWS, lambda a, i, n=name: draw_hero(n, a, i))
        path = os.path.join(OUT, 'heroes', f'hero-{name}-sheet.png')
        os.makedirs(os.path.dirname(path), exist_ok=True)
        sh.save(path)
        sheets.append((f'hero-{name}', sh, HERO_ROWS))
    hp = build_sheet(HERO_ROWS, draw_hp)
    hp.save(os.path.join(OUT, 'heroes', 'hero-headphones-overlay.png'))
    sheets.append(('hero-headphones-overlay', hp, HERO_ROWS))
    for k in ('a', 'b'):
        sh = build_sheet(ELDER_ROWS, lambda a, i, kk=k: draw_elder(kk, a, i))
        path = os.path.join(OUT, 'elders', f'elder-{k}-sheet.png')
        os.makedirs(os.path.dirname(path), exist_ok=True)
        sh.save(path)
        sheets.append((f'elder-{k}', sh, ELDER_ROWS))
    for nm, sh, _ in sheets[:2] + sheets[3:]:
        n = len(colours(sh))
        print(nm, sh.size, 'colours', n)
        assert n <= 16, nm

    S, GAP = 4, 40
    cw, ch = W * S, H * S
    totw = sum(sh.width * S for _, sh, _ in sheets) + GAP * (len(sheets) + 1)
    toth = max(sh.height * S for _, sh, _ in sheets) + GAP * 2 + 20
    bg = Image.new('RGBA', (totw, toth), hx('D9D2B8') + (255,))
    d = ImageDraw.Draw(bg)
    try:
        font = ImageFont.truetype('arial.ttf', 14)
    except Exception:
        font = ImageFont.load_default()
    x0 = GAP
    for nm, sh, rows in sheets:
        d.text((x0, 8), nm, fill=INK, font=font)
        big = sh.resize((sh.width * S, sh.height * S), Image.NEAREST)
        for r, (anim, n) in enumerate(rows):
            for i in range(n):
                cell = (x0 + i * cw, GAP + r * ch)
                d.rectangle([cell[0], cell[1], cell[0] + cw - 1, cell[1] + ch - 1], outline=hx('A8A088'))
                bg.alpha_composite(big.crop((i * cw, r * ch, i * cw + cw, r * ch + ch)), cell)
                d.text((cell[0] + 3, cell[1] + 2), f'{anim} {i}', fill=INK, font=font)
        x0 += sh.width * S + GAP
    crop = Image.new('RGBA', (sheets[0][1].width, 4 * H), hx('D9D2B8') + (255,))
    crop.alpha_composite(sheets[0][1].crop((0, 0, crop.width, 4 * H)))
    crop.resize((crop.width * 3, crop.height * 3), Image.NEAREST).save(os.path.join(OUT, 'previews', 'heroes-crop.png'))
    cp = os.path.join(OUT, 'previews', 'heroes-elders-contact.png')
    os.makedirs(os.path.dirname(cp), exist_ok=True)
    bg.save(cp)
    print('contact', bg.size)


if __name__ == '__main__':
    main()
