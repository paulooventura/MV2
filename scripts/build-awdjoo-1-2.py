#!/usr/bin/env python3
"""
Awdjoo Town 1.2 — trial run (lab G), from Paulo's pen sketch (Oct 20 2026).

Writes:
  assets/levels/awdjoo-1-2.ldtk          LDtk project (Collision + Skin IntGrids, Entities)
  assets/levels/awdjoo-1-2-preview.png   labelled preview (needs Pillow)

Sketch reading (1 square = 1 tile = 32 px):
  - MIND arrives through the arch on the left ledge (end of 1.1).
  - A ledge seed, a moving platform with a seed above it, a long slope with 2 seeds.
  - At the foot of the slope a moving platform crosses a gap to a tall wall;
    the gap drops into a water room.
  - Water room: the ISOLATOR waits on a dry lip at the left; a crystal sits at
    the bottom of the pool.
  - Up top: a floating block to hook / stand on, a long moving platform above
    it, and a crystal under a slanted overhang at the platform's left end.
  Second page (full design + enemies, Oct 20):
  - Water room: two moving platforms meet mid-room (a triangle rides one, a
    square the other); an Enemy A on a stub ledge at the right wall; another
    Enemy A swims at the bottom by the crystal; under the right half the pool
    has no floor — the PIT.
  - An Enemy A floats on top of the tall pillar.
  - Past the pillar, stairs (the pink hatching = wooden steps) go down to a
    floor with a square enemy, then on down to the exit.
  - PINK = BACKGROUND / ANIMATION, NO COLLISION (the legend's pink dot;
    Paulo, Oct 20): the roof-tile structure over the floor is a HOUSE in the
    background (terracotta fish-scale roof, walls, windows, a porch stair —
    the pink hatching), not a wall. A sliding block and a moving platform
    hang in front of it (the triangle rides the platform), a crystal under its
    eaves, two seeds where its roof is, one outside to the right.
  - The pink drawings up top-left are the town in the background: houses
    with roofs and windows, people, and bunting strung between them — drawn
    behind the spawn ledge and the slope, gently animated.
  - The exit isn't drawn yet: it waits at the bottom of the stairs (3 crystals
    + 7 seeds).
Re-run after edits:  python3 scripts/build-awdjoo-1-2.py
"""
import json, os, sys

COLS, ROWS = 58, 62
AIR, SOLID, ONEWAY, DESTRUCT, SLOPE_L, SLOPE_R = 0, 1, 2, 3, 4, 5
SK_DIRT, SK_ROOF, SK_BRICK, SK_WOOD, SK_STONE_BG, SK_CAVE_BG, SK_SCALES = 0, 1, 2, 3, 4, 5, 6
LDTK_TILE = 16

g = [[AIR] * COLS for _ in range(ROWS)]
skin = [[SK_DIRT] * COLS for _ in range(ROWS)]
def put(c, r, v):
    if 0 <= c < COLS and 0 <= r < ROWS: g[r][c] = v
def rect(c0, c1, r0, r1, v):
    for r in range(r0, r1 + 1):
        for c in range(c0, c1 + 1): put(c, r, v)
def paint(c0, c1, r0, r1, s):
    for r in range(r0, r1 + 1):
        for c in range(c0, c1 + 1):
            if 0 <= c < COLS and 0 <= r < ROWS: skin[r][c] = s
ents = []
def ent(etype, c, r, w=1, h=1, **fields):
    ents.append(dict(kind=etype, c=c, r=r, w=w, h=h, fields=fields))

# ── Ground: everything from row 40 down is rock, then rooms are carved out ──
rect(0, COLS - 1, 40, ROWS - 1, SOLID)
rect(0, 0, 0, ROWS - 1, SOLID); rect(COLS - 1, COLS - 1, 0, ROWS - 1, SOLID)
rect(1, 2, 0, 40, SOLID)                                # left cliff
# the drop at the far right is part of the stairs below; keep the border wall

# slanted overhang over the upper crystal (sketch top-left)
for c, low in {3: 10, 4: 9, 5: 8, 6: 7, 7: 7, 8: 6, 9: 5}.items():
    rect(c, c, 0, low, SOLID)

# spawn ledge + the long slope down to the gap (SLOPE_L = surface falls to the right)
rect(3, 7, 29, 40, SOLID)
for c in range(8, 18):
    s = 29 + (c - 8)
    put(c, s, SLOPE_L); rect(c, c, s + 1, 40, SOLID)
# gap cols 18-26 stays open down into the water room
rect(18, 26, 29, 40, AIR)
# tall wall + the floor past it (the floor is also the water room's ceiling)
rect(27, 28, 29, 40, SOLID)
put(16, 18, SOLID)                                      # the floating block to hook / stand on

# ── past the pillar: wooden steps down, the floor, more steps, the exit floor
surface = {29: 31, 30: 33, 31: 35, 32: 36, 33: 37}
surface.update({c: 38 for c in range(34, 42)}); surface.update({42: 39, 43: 40, 44: 41})
surface.update({c: 42 for c in range(45, COLS - 1)})
for c, top in surface.items():
    rect(c, c, top, ROWS - 1, SOLID)
    rect(c, c, 0, top - 1, AIR)
# the 1-tile steps are ramps so the wheel rolls over them (no wedges)
for c, row in [(32, 35), (33, 36), (34, 37), (42, 38), (43, 39), (44, 40), (45, 41)]:
    rect(c, c, 0, row - 1, AIR); put(c, row, SLOPE_L); rect(c, c, row + 1, ROWS - 1, SOLID)
# the roof-tile house (pink scales) is background — see the Decor 'house' below

# water room (air above the water) + pool
rect(4, 31, 41, 49, AIR)
rect(7, 20, 50, 54, AIR)                                # shallow end, floor row 55
rect(21, 31, 50, 57, AIR)                               # deep end, floor row 58
rect(22, 31, 50, ROWS - 1, AIR)                         # ... except it has no floor: the PIT
rect(29, 31, 44, 44, SOLID)                             # stub ledge on the right wall
rect(18, 26, 40, 40, AIR)                               # the gap opens into the room
paint(4, 31, 41, 57, SK_STONE_BG); paint(18, 26, 40, 40, SK_STONE_BG)

# ── Entities ──────────────────────────────────────────────────────
ent('MindSpawn', 5, 26, 1, 3)
ent('Decor', 2, 25, 2, 4, kind='arrival')               # the arch MIND comes through
ent('Gate', 50, 37, 3, 5, crystals=3, seeds=7)          # exit (not drawn yet): bottom of the stairs
for c, r, slot in [(49, 33, 'crystal'), (51, 32, 'crystal'), (53, 33, 'crystal'),
                   (47, 35, 'seed'), (48, 34, 'seed'), (49, 35, 'seed'), (51, 35, 'seed'),
                   (53, 35, 'seed'), (54, 34, 'seed'), (55, 35, 'seed')]:
    ent('GateShell', c, r, slot=slot)
ent('Isolator', 5, 49)
ent('Crystal', 8, 10)                                   # under the overhang, left end of the long platform
ent('Crystal', 8, 54)                                   # bottom of the pool
ent('Crystal', 40, 28)                                  # under the arch's roof, by the right leg
for c, r in [(7, 28), (21, 25), (12, 31), (15, 34), (34, 25), (41, 23), (46, 31)]:
    ent('Knowl', c, r)
# moving platforms: same width (4 tiles); a..b = range of the LEFT edge (the sketch's arrows)
ent('MovingPlatform', 10, 27, 4, 1, a=10, b=21, speed=11)   # speed in tenths of px/frame
ent('MovingPlatform', 18, 39, 4, 1, a=18, b=23, speed=13)
ent('MovingPlatform', 7, 12, 4, 1, a=7, b=23, speed=12)
ent('MovingPlatform', 8, 45, 4, 1, a=8, b=14, speed=10)     # water room: the two meet mid-room
ent('MovingPlatform', 24, 45, 4, 1, a=18, b=24, speed=10)
ent('MovingPlatform', 39, 34, 4, 1, a=33, b=39, speed=10)   # inside the arch
ent('MovingPlatform', 33, 31, 2, 1, a=33, b=40, speed=12)   # the sliding block inside the arch
ent('Water', 7, 50, 25, 8)                              # basin: cols 7-31, surface at row 50
# enemies: ai = circle (Enemy A, sine wave) | square | tri; range in tiles each way
ent('Enemy', 27, 28, ai='circle', range=1)              # on the tall pillar
ent('Enemy', 30, 43, ai='circle', range=1)              # stub ledge in the water room
ent('Enemy', 12, 53, ai='circle', range=3, iso=1)       # rolls on the pool floor by the crystal — wears an Isolator
ent('Enemy', 9, 44, ai='tri', range=2)                  # riding the left water platform
ent('Enemy', 25, 44, ai='square', range=2)              # riding the right one
ent('Enemy', 40, 33, ai='tri', range=2)                 # rides the platform in front of the house
ent('Enemy', 38, 37, ai='square', range=3)              # on the floor under the arch
for c, r, kind in [(47, 42, 'lamp'), (56, 42, 'sign')]:
    ent('Decor', c, r, kind=kind)
# background art (pink in the sketch): no collision, drawn behind the tiles
ent('Decor', 30, 23, 16, 15, kind='house')              # the roof-tile house, standing on the floor (row 38)
ent('Decor', 2, 12, 25, 26, kind='town')                # the town behind the spawn ledge and the slope

# seeds sit on whatever is under them
def solid_at(c, r):
    return not (0 <= r < ROWS and 0 <= c < COLS) or g[r][c] in (SOLID, SLOPE_L, SLOPE_R, ONEWAY)
for e in ents:
    if e['kind'] == 'Knowl' and e['r'] > 26:
        while not solid_at(e['c'], e['r'] + 1): e['r'] += 1

# ── LDtk export ───────────────────────────────────────────────────
def fval(name, v):
    t = 'Int' if isinstance(v, int) else 'String'
    return {'__identifier': name, '__type': t, '__value': v}
inst = [{'__identifier': e['kind'], 'iid': f'l12-{i}', 'width': e['w'] * LDTK_TILE, 'height': e['h'] * LDTK_TILE,
         'px': [e['c'] * LDTK_TILE, e['r'] * LDTK_TILE], '__grid': [e['c'], e['r']],
         'fieldInstances': [fval(k, v) for k, v in e['fields'].items()]} for i, e in enumerate(ents)]
def intgrid(name, uid, vals, data):
    return ({'identifier': name, 'type': 'IntGrid', 'uid': uid, 'gridSize': LDTK_TILE,
             'intGridValues': [{'value': v, 'identifier': n, 'color': c} for v, n, c in vals]},
            {'__identifier': name, '__type': 'IntGrid', '__cWid': COLS, '__cHei': ROWS,
             '__gridSize': LDTK_TILE, 'intGridCsv': [v for row in data for v in row]})
coll_def, coll_inst = intgrid('Collision', 1, [(1, 'SOLID', '#1c1428'), (2, 'ONEWAY', '#3a3060'), (3, 'DESTRUCT', '#c81818'),
                                               (4, 'SLOPE_L', '#e2c090'), (5, 'SLOPE_R', '#e2c090')], g)
skin_def, skin_inst = intgrid('Skin', 3, [(1, 'ROOF', '#3a2420'), (2, 'BRICK', '#4a2c26'), (3, 'WOOD', '#7a4a26'),
                                          (4, 'STONE_BG', '#2e2624'), (5, 'CAVE_BG', '#231a2a'), (6, 'SCALES', '#c06090')], skin)
project = {
    '__header__': {'fileType': 'LDtk Project JSON', 'app': 'MV2 sketch translator', 'doc': 'Awdjoo Town 1.2 trial from pen sketch'},
    'jsonVersion': '1.5.3', 'defaultGridSize': LDTK_TILE, 'externalLevels': False, 'bgColor': '#100818',
    'defs': {'layers': [coll_def, skin_def, {'identifier': 'Entities', 'type': 'Entities', 'uid': 2, 'gridSize': LDTK_TILE}],
             'entities': [{'identifier': k, 'uid': 100 + i} for i, k in enumerate(sorted({e['kind'] for e in ents}))]},
    'levels': [{
        'identifier': 'Awdjoo_1_2', 'iid': 'awdjoo-1-2', 'uid': 11, 'worldX': 0, 'worldY': 0,
        'pxWid': COLS * LDTK_TILE, 'pxHei': ROWS * LDTK_TILE, '__bgColor': '#100818',
        'fieldInstances': [fval('skyRows', 0), fval('horizonRow', 30), fval('stageName', 'AWDJOO TOWN 1.2'),
                           fval('stageSub', 'Deep Waters'), fval('music', 'stage2'), fval('stageId', '1.2')],
        'layerInstances': [coll_inst, skin_inst,
            {'__identifier': 'Entities', '__type': 'Entities', '__cWid': COLS, '__cHei': ROWS,
             '__gridSize': LDTK_TILE, 'entityInstances': inst}]}],
}
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
out = os.path.join(root, 'assets', 'levels'); os.makedirs(out, exist_ok=True)
with open(os.path.join(out, 'awdjoo-1-2.ldtk'), 'w') as f: json.dump(project, f, indent=1)
print('wrote assets/levels/awdjoo-1-2.ldtk', COLS, 'x', ROWS, len(ents), 'entities')

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit(0)
S = 12
im = Image.new('RGB', (COLS * S, ROWS * S + 50), '#2a2038'); d = ImageDraw.Draw(im)
for r in range(ROWS):
    t = r / 34
    if t < 1: d.rectangle([0, r * S, COLS * S, r * S + S], fill=(int(42 + 150 * t), int(32 + 60 * t), int(56 + 30 * t)))
for r in range(ROWS):
    for c in range(COLS):
        v, sk = g[r][c], skin[r][c]; x, y = c * S, r * S
        if v == AIR and sk == SK_STONE_BG: d.rectangle([x, y, x + S - 1, y + S - 1], fill='#3a302c')
        if v == SOLID: d.rectangle([x, y, x + S - 1, y + S - 1], fill='#6b4a32')
        elif v == SLOPE_L: d.polygon([(x, y), (x + S, y + S), (x, y + S)], fill='#6b4a32')
        if v == SOLID and sk == SK_SCALES: d.rectangle([x, y, x + S - 1, y + S - 1], fill='#c06090')
        if v == SOLID and sk == SK_WOOD: d.rectangle([x, y, x + S - 1, y + S - 1], fill='#9a6a3a')
for e in ents:
    x, y, k, f = e['c'] * S, e['r'] * S, e['kind'], e['fields']
    if k == 'Water': d.rectangle([x, y, (e['c'] + e['w']) * S - 1, (e['r'] + e['h']) * S - 1], outline='#60b0ff', width=2)
    elif k == 'MovingPlatform':
        d.line([f['a'] * S, y + 3, (f['b'] + e['w']) * S, y + 3], fill='#c08060', width=1)
        d.rectangle([x, y, x + e['w'] * S, y + 6], fill='#a06030', outline='#000')
    elif k == 'Knowl': d.ellipse([x + 2, y + 2, x + S - 2, y + S - 2], fill='#66ffaa', outline='#205030')
    elif k == 'Crystal': d.polygon([(x + 6, y - 2), (x + 12, y + 6), (x + 6, y + 14), (x, y + 6)], fill='#40c8e8', outline='#000')
    elif k == 'Isolator': d.ellipse([x, y, x + S, y + S], fill='#ff9030', outline='#000'); d.text((x - 10, y - 12), 'ISOLATOR', fill='#fff')
    elif k == 'MindSpawn': d.rectangle([x, y, x + S, y + 3 * S], outline='#c080ff', width=2); d.text((x - 8, y - 12), 'SPAWN', fill='#fff')
    elif k == 'Gate': d.arc([x, y, x + 3 * S, y + 5 * S], 180, 360, fill='#ffe680', width=3); d.text((x - 8, y - 12), 'EXIT 3+7', fill='#fff')
    elif k == 'Decor' and f.get('kind') in ('house', 'town'):
        d.rectangle([x, y, (e['c'] + e['w']) * S - 1, (e['r'] + e['h']) * S - 1], outline='#ff80c0', width=1)
        d.text((x + 4, y + 4), 'BG ' + f['kind'].upper(), fill='#ff80c0')
    elif k == 'Enemy':
        a = f.get('ai'); col = '#ff4040'
        if a == 'circle': d.ellipse([x, y, x + S, y + S], fill=col, outline='#000')
        elif a == 'square': d.rectangle([x, y, x + S, y + S], fill=col, outline='#000')
        else: d.polygon([(x + S // 2, y), (x + S, y + S), (x, y + S)], fill=col, outline='#000')
im.save(os.path.join(out, 'awdjoo-1-2-preview.png'))
# water on the preview
im = Image.open(os.path.join(out, 'awdjoo-1-2-preview.png')).convert('RGBA'); ov = Image.new('RGBA', im.size); od = ImageDraw.Draw(ov)
for e in ents:
    if e['kind'] == 'Water':
        for r in range(e['r'], e['r'] + e['h']):
            for c in range(e['c'], e['c'] + e['w']):
                if g[r][c] == AIR: od.rectangle([c * S, r * S, c * S + S - 1, r * S + S - 1], fill=(60, 140, 255, 120))
Image.alpha_composite(im, ov).convert('RGB').save(os.path.join(out, 'awdjoo-1-2-preview.png'))
print('wrote assets/levels/awdjoo-1-2-preview.png')
