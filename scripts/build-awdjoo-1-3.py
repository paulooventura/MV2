#!/usr/bin/env python3
"""
Awdjoo Town 1.3, from Paulo's sheet (Oct 22 2026) + his notes:
  purple lines = vertical moving platforms; the green platform columns in the
  left shaft run forever — the left column DOWN, the right column UP; red dot =
  Enemy A, red triangle = B, red square = C; green dot = Knowl seed, green
  diamond = Knowl crystal; K = the gaucho knife (new item); S = save-state item.
  Same scale as 1.2: 1 graph-paper square = 2 tiles = 64 px.

Writes:
  assets/levels/awdjoo-1-3.ldtk          LDtk project (Collision + Skin IntGrids, Entities)
  assets/levels/awdjoo-1-3-preview.png   labelled preview (needs Pillow)

The sheet, left to right (square coordinates are read off the photo, x right, y down):
  - ARRIVAL: the arch at the bottom left, stairs up onto the long floor.
  - THE LIFT SHAFT (x 3-11.6): the green platforms ride two endless belts —
    down on the left, up on the right. Between them, two purple lifts go up
    and down (an Enemy C rides the upper one, a B the lower one), with an
    octagonal rock over and under them. A crystal sits up in the top-left nook.
  - THE CHIMNEY (x 11.6-13.4) beside it, a purple lift running up it to the
    D-D room (two mirror enemies) inside the rock mass with the spire on top.
  - THE ELEVATOR (purple, x 18-19.2): one long lift from the top of the map
    down into the pool. Enemy E floats at its top.
  - THE POOL under it: Enemy F sleeps in the water; a crystal on the slope that
    climbs out of it; rungs up to the ledge at the arena's edge.
  - THE SECRET AREA hidden in the rock right of the elevator: the save-state
    item S and an Isolator — through a climb on the rock's face and a plug of
    omni blocks.
  - THE ARENA: open air over a stone bowl. The heptagon boss floats over it.
    Beat it and the bowl's floor gives way into the knife's chamber (K); the
    knife cuts the vine wall on its right, out to the exit arch.
Re-run after edits:  python3 scripts/build-awdjoo-1-3.py
"""
import json, os, sys

COLS, ROWS = 92, 74
AIR, SOLID, ONEWAY, DESTRUCT, SLOPE_L, SLOPE_R = 0, 1, 2, 3, 4, 5
SK_DIRT, SK_ROOF, SK_BRICK, SK_WOOD, SK_STONE_BG, SK_CAVE_BG, SK_SCALES = 0, 1, 2, 3, 4, 5, 6
LDTK_TILE = 16

g = [[SOLID] * COLS for _ in range(ROWS)]
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
def inside(poly, x, y):
    n, ins = len(poly), False
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: ins = not ins
    return ins
def poly(pts, v):
    """fill tiles whose centre is inside the polygon (tile coords); 45-degree top edges become slopes"""
    for r in range(ROWS):
        for c in range(COLS):
            if inside(pts, c + 0.5, r + 0.5): put(c, r, v)
def slopes():
    """a solid tile with air above it and air on exactly one side, solid on the other: a 45-degree ramp"""
    out = []
    for r in range(1, ROWS):
        for c in range(1, COLS - 1):
            if g[r][c] != SOLID or g[r - 1][c] != AIR: continue
            L, R = g[r][c - 1] == AIR, g[r][c + 1] == AIR
            below = g[r + 1][c] == SOLID if r + 1 < ROWS else True
            if not below: continue
            if L and not R and g[r - 1][c + 1] == SOLID: out.append((c, r, SLOPE_R))
            elif R and not L and g[r - 1][c - 1] == SOLID: out.append((c, r, SLOPE_L))
    for c, r, v in out: put(c, r, v)
ents = []
def ent(etype, c, r, w=1, h=1, **fields):
    ents.append(dict(kind=etype, c=c, r=r, w=w, h=h, fields=fields))

# ── Air, carved out of the rock (tile coords = squares x 2) ─────────
# arrival + the long floor
rect(1, 13, 45, 57, AIR)                                # arrival hall (floor row 58)
for i in range(4): rect(10 + i, 13, 57 - i, 57 - i, SOLID)   # the stairs up (slopes added below)
# the lift shaft, open to the top band
rect(6, 22, 2, 53, AIR)
poly([(1, 11), (6, 17), (6, 2), (1, 2)], AIR)           # the top-left nook over the diagonal
poly([(13, 10), (17, 10), (18, 12), (18, 14), (16, 16), (13, 16), (12, 14), (12, 12)], SOLID)   # upper octagon
poly([(13, 41), (16, 41), (17, 43), (17, 45), (16, 46), (13, 46), (12, 45), (12, 43)], SOLID)   # lower octagon
# the top band over the spire mass
rect(22, 37, 2, 16, AIR)
poly([(23, 16), (29, 16), (29, 12), (30, 12), (30, 5), (32, 3), (35, 9), (35, 14), (37, 16), (37, 21), (23, 21)], SOLID)   # the spire mass
rect(23, 26, 21, 53, AIR)                               # the chimney
rect(27, 35, 21, 28, AIR)                               # the D-D room (floor row 29)
rect(27, 27, 21, 24, SOLID)                             # its left wall, doorway rows 25-28 from the chimney
rect(27, 35, 35, 42, AIR)                               # the lower room (floor row 43 on the left, the pool on the right)
rect(31, 32, 43, 57, SOLID)                             # pool's left wall
rect(28, 30, 44, 53, AIR)                               # the rung column from the long floor up into the lower room
rect(29, 30, 43, 43, AIR)                               # the hole in the lower room's floor
# the elevator column, the pool and the slope out of it
rect(36, 37, 2, 57, AIR)
rect(33, 50, 43, 57, AIR)                               # the pool basin + the submerged run under the rock
poly([(40, 58), (50, 48), (50, 58)], SOLID)             # the slope climbing out to the right
rect(38, 41, 24, 42, AIR)                               # the open face right of the elevator
rect(42, 51, 32, 42, SOLID)                             # the rock over the water
# the right rock mass (with its stepped top) and the arena edge
rect(38, 52, 2, 12, AIR)
poly([(38, 13), (40, 11), (41, 9), (43, 9), (43, 11), (45, 11), (47, 13), (51, 13), (51, 14), (38, 14)], SOLID)
rect(38, 39, 15, 24, AIR)                               # the rung alcove on the rock's face
rect(42, 48, 15, 39, AIR); paint(42, 48, 15, 39, SK_CAVE_BG)   # the secret area
rect(50, 51, 40, 49, AIR)                               # the rungs from the slope up to the arena ledge (open to the arena)
rect(52, 91, 2, 59, AIR)                                # the arena's open air (the bowl is cut back in below)
rect(52, 57, 52, ROWS - 1, AIR)                         # the pit beside the bowl (no floor: shutdown)
poly([(54, 52), (56, 52), (60, 56), (77, 56), (81, 52), (82, 52), (82, 56), (79, 60), (58, 60), (54, 55)], SOLID)   # the stone bowl
rect(58, 78, 60, 70, AIR)                               # the knife's chamber under it (floor row 71)
rect(79, 90, 52, 70, AIR)                               # the way down to the exit (floor row 71)
paint(58, 78, 56, 72, SK_BRICK)
# borders
rect(0, COLS - 1, 0, 1, SOLID); rect(0, 0, 0, ROWS - 1, SOLID); rect(COLS - 1, COLS - 1, 0, ROWS - 1, SOLID)
rect(58, COLS - 1, ROWS - 1, ROWS - 1, SOLID)
slopes()
# rungs (one-way every two rows, like the shaft under Laitu's house)
def rungs(c0, c1, r0, r1):
    for r in range(r0, r1 + 1, 2):
        for c in range(c0, c1 + 1):
            if g[r][c] == AIR: put(c, r, ONEWAY); skin[r][c] = SK_WOOD
rungs(29, 30, 45, 53)                                   # long floor -> lower room
rungs(38, 39, 16, 24)                                   # the rock face -> the secret tunnel
rungs(50, 51, 45, 49)                                   # slope top -> arena ledge
# chimney ledges
put(25, 29, ONEWAY); put(26, 29, ONEWAY); put(23, 37, ONEWAY); put(24, 37, ONEWAY)
paint(23, 37, 21, 53, SK_STONE_BG)

# ── Entities ──────────────────────────────────────────────────────
ent('MindSpawn', 4, 55, 1, 3)
ent('Decor', 3, 54, 2, 4, kind='arrival')               # the arch MIND comes through
ent('Gate', 86, 66, 3, 5, crystals=5, seeds=10, boss=1) # the exit arch past the knife's chamber
ent('Isolator', 46, 27)                                 # in the secret area
ent('SaveState', 43, 16)                                # S: the save-state item, top of the secret area
ent('Knife', 67, 69)                                    # K: the gaucho knife in its chamber
# the 5 crystals
ent('Crystal', 4, 12)                                   # the top-left nook
ent('Crystal', 36, 3)                                   # top of the elevator column
ent('Crystal', 44, 51)                                  # on the slope, under the water
ent('Crystal', 50, 43)                                  # the arena ledge over the rungs
ent('Crystal', 45, 38)                                  # bottom of the secret area
# the 10 seeds (snap=1: sits on the ground under it)
for c, r, snap in [(26, 15, 1), (34, 5, 0), (51, 12, 1), (33, 28, 1), (28, 42, 1), (24, 53, 1),
                   (8, 57, 1), (40, 26, 0), (60, 70, 1), (75, 70, 1)]:
    ent('Knowl', c, r, snap=snap)
# moving platforms. Horizontal: a..b = left edge range. Vertical (axis='y'): a..b = top row range;
# loop=1 rides one way forever and comes back round (the belts); speed in tenths of px/frame
for k in range(6): ent('MovingPlatform', 8, 12 + k * 7, 3, 1, axis='y', a=12, b=52, speed=16, loop=1, dir=1)    # left belt: DOWN
for k in range(6): ent('MovingPlatform', 19, 12 + k * 7, 3, 1, axis='y', a=12, b=52, speed=16, loop=1, dir=-1)  # right belt: UP
ent('MovingPlatform', 12, 18, 6, 1, axis='y', a=17, b=27, speed=9)      # purple lift: C rides it
ent('MovingPlatform', 12, 30, 6, 1, axis='y', a=28, b=39, speed=9)      # purple lift: B rides it
ent('MovingPlatform', 24, 50, 2, 1, axis='y', a=24, b=52, speed=11)     # the chimney lift
ent('MovingPlatform', 36, 30, 2, 1, axis='y', a=4, b=55, speed=12)      # the long elevator
ent('MovingPlatform', 52, 6, 2, 1, axis='y', a=3, b=12, speed=9)        # the little lift at the arena's top-left
# water: the pool and the run under the rock
ent('Water', 33, 46, 18, 12)
# boxes: the plug into the secret area (omni), the bowl's seal (falls when the boss is beaten),
# the vine wall (only the knife cuts it)
def boxes(kind, cells, **f):
    for c, r in cells: ent('Box', c, r, kind=kind, **f)
boxes('omni', [(c, r) for c in (40, 41) for r in (15, 16)])
boxes('seal', [(c, r) for c in range(62, 74) for r in range(56, 60)])
boxes('vine', [(c, r) for c in (79, 80) for r in range(61, 71)])
# enemies
ent('Enemy', 15, 53, ai='circle', range=1)
ent('Enemy', 21, 53, ai='circle', range=1)
ent('Enemy', 14, 40, ai='circle', range=1)              # on the lower octagon
ent('Enemy', 14, 17, ai='square', range=1)              # rides the upper purple lift
ent('Enemy', 14, 29, ai='tri', range=1)                 # rides the lower purple lift
ent('Enemy', 29, 28, ai='mirror', range=4)              # D
ent('Enemy', 33, 28, ai='mirror', range=4)              # D
ent('Enemy', 40, 7, ai='eye', range=6)                  # E: the fast floating pentagon
ent('Enemy', 40, 52, ai='cube', range=6)                # F: the transparent cube, asleep in the water
ent('Boss', 66, 36, 3, 3, kind='heptagon')              # the heptagon over the bowl
# background
ent('Decor', 88, 66, kind='lamp')

def solid_at(c, r):
    return not (0 <= r < ROWS and 0 <= c < COLS) or g[r][c] in (SOLID, SLOPE_L, SLOPE_R, ONEWAY)
for e in ents:
    if e['kind'] == 'Knowl' and e['fields'].pop('snap', 0):
        while not solid_at(e['c'], e['r'] + 1): e['r'] += 1
counts = {k: sum(1 for e in ents if e['kind'] == k) for k in ('Knowl', 'Crystal')}
assert counts == {'Knowl': 10, 'Crystal': 5}, counts
for e in ents:                                          # nothing placed inside rock
    if e['kind'] in ('Knowl', 'Crystal', 'MindSpawn', 'Isolator', 'SaveState', 'Knife') and solid_at(e['c'], e['r']) and g[e['r']][e['c']] != ONEWAY:
        sys.exit('%s inside rock at %d,%d' % (e['kind'], e['c'], e['r']))

# ── LDtk export ───────────────────────────────────────────────────
def fval(name, v):
    t = 'Int' if isinstance(v, int) else 'String'
    return {'__identifier': name, '__type': t, '__value': v}
inst = [{'__identifier': e['kind'], 'iid': f'l13-{i}', 'width': e['w'] * LDTK_TILE, 'height': e['h'] * LDTK_TILE,
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
    '__header__': {'fileType': 'LDtk Project JSON', 'app': 'MV2 sketch translator', 'doc': 'Awdjoo Town 1.3 from the Oct 22 sheet'},
    'jsonVersion': '1.5.3', 'defaultGridSize': LDTK_TILE, 'externalLevels': False, 'bgColor': '#0c0a14',
    'defs': {'layers': [coll_def, skin_def, {'identifier': 'Entities', 'type': 'Entities', 'uid': 2, 'gridSize': LDTK_TILE}],
             'entities': [{'identifier': k, 'uid': 100 + i} for i, k in enumerate(sorted({e['kind'] for e in ents}))]},
    'levels': [{
        'identifier': 'Awdjoo_1_3', 'iid': 'awdjoo-1-3', 'uid': 13, 'worldX': 0, 'worldY': 0,
        'pxWid': COLS * LDTK_TILE, 'pxHei': ROWS * LDTK_TILE, '__bgColor': '#0c0a14',
        'fieldInstances': [fval('skyRows', 0), fval('horizonRow', 18), fval('stageName', 'AWDJOO TOWN 1.3'),
                           fval('stageSub', 'The Heptagon'), fval('music', 'stage2'), fval('stageId', '1.3')],
        'layerInstances': [coll_inst, skin_inst,
            {'__identifier': 'Entities', '__type': 'Entities', '__cWid': COLS, '__cHei': ROWS,
             '__gridSize': LDTK_TILE, 'entityInstances': inst}]}],
}
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
out = os.path.join(root, 'assets', 'levels'); os.makedirs(out, exist_ok=True)
with open(os.path.join(out, 'awdjoo-1-3.ldtk'), 'w') as f: json.dump(project, f, indent=1)
print('wrote assets/levels/awdjoo-1-3.ldtk', COLS, 'x', ROWS, len(ents), 'entities')

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit(0)
S = 12
im = Image.new('RGB', (COLS * S, ROWS * S), '#1a1426'); d = ImageDraw.Draw(im)
for r in range(ROWS):
    for c in range(COLS):
        v, sk = g[r][c], skin[r][c]; x, y = c * S, r * S
        if v == AIR and sk in (SK_STONE_BG, SK_CAVE_BG): d.rectangle([x, y, x + S - 1, y + S - 1], fill='#2c2430' if sk == SK_CAVE_BG else '#3a302c')
        col = {SK_WOOD: '#9a6a3a', SK_BRICK: '#8a5a4a'}.get(sk, '#6b4a32')
        if v == SOLID: d.rectangle([x, y, x + S - 1, y + S - 1], fill=col)
        elif v == ONEWAY: d.rectangle([x, y, x + S - 1, y + 3], fill='#c08040')
        elif v == SLOPE_L: d.polygon([(x, y), (x + S, y + S), (x, y + S)], fill=col)
        elif v == SLOPE_R: d.polygon([(x, y + S), (x + S, y), (x + S, y + S)], fill=col)
BOXC = {'omni': '#8a4ad8', 'push': '#2f6fd8', 'pull': '#d0362c', 'laser': '#d8a820', 'seal': '#a0a0b0', 'vine': '#40a040'}
for e in ents:
    x, y, k, f = e['c'] * S, e['r'] * S, e['kind'], e['fields']
    if k == 'Water': d.rectangle([x, y, (e['c'] + e['w']) * S - 1, (e['r'] + e['h']) * S - 1], outline='#60b0ff', width=2)
    elif k == 'Box': d.rectangle([x + 1, y + 1, x + S - 2, y + S - 2], fill=BOXC[f['kind']], outline='#000')
    elif k == 'MovingPlatform':
        if f.get('axis') == 'y':
            d.line([x + e['w'] * S // 2, f['a'] * S, x + e['w'] * S // 2, f['b'] * S], fill='#c060c0' if not f.get('loop') else '#60c060', width=1)
        else: d.line([f['a'] * S, y + 3, (f['b'] + e['w']) * S, y + 3], fill='#c08060', width=1)
        d.rectangle([x, y, x + e['w'] * S, y + 6], fill='#60c060' if f.get('loop') else '#b050b0', outline='#000')
    elif k == 'Knowl': d.ellipse([x + 2, y + 2, x + S - 2, y + S - 2], fill='#66ffaa', outline='#205030')
    elif k == 'Crystal': d.polygon([(x + 6, y - 2), (x + 12, y + 6), (x + 6, y + 14), (x, y + 6)], fill='#40e890', outline='#000')
    elif k in ('Isolator', 'SaveState', 'Knife'):
        d.ellipse([x, y, x + S, y + S], fill={'Isolator': '#ff9030', 'SaveState': '#40c0ff', 'Knife': '#d08040'}[k], outline='#000'); d.text((x - 10, y - 12), k.upper(), fill='#fff')
    elif k == 'MindSpawn': d.rectangle([x, y, x + S, y + 3 * S], outline='#c080ff', width=2); d.text((x - 4, y - 12), 'SPAWN', fill='#fff')
    elif k == 'Gate': d.arc([x, y, x + 3 * S, y + 5 * S], 180, 360, fill='#ffe680', width=3); d.text((x - 8, y - 12), 'EXIT', fill='#fff')
    elif k == 'Boss': d.regular_polygon((x + 18, y + 18, 18), 7, fill='#c03030', outline='#000'); d.text((x - 4, y - 14), 'BOSS', fill='#fff')
    elif k == 'Enemy':
        a = f.get('ai'); col = '#ff4040'
        if a == 'circle': d.ellipse([x, y, x + S, y + S], fill=col, outline='#000')
        elif a == 'square': d.rectangle([x, y, x + S, y + S], fill=col, outline='#000')
        elif a == 'mirror': d.text((x, y - 4), 'D', fill='#ff3030')
        elif a == 'eye': d.text((x, y - 4), 'E', fill='#ff3030')
        elif a == 'cube': d.text((x, y - 4), 'F', fill='#ff3030')
        else: d.polygon([(x + S // 2, y), (x + S, y + S), (x, y + S)], fill=col, outline='#000')
im = im.convert('RGBA'); ov = Image.new('RGBA', im.size); od = ImageDraw.Draw(ov)
for e in ents:
    if e['kind'] == 'Water':
        for r in range(e['r'], e['r'] + e['h']):
            for c in range(e['c'], e['c'] + e['w']):
                if g[r][c] == AIR: od.rectangle([c * S, r * S, c * S + S - 1, r * S + S - 1], fill=(60, 140, 255, 120))
Image.alpha_composite(im, ov).convert('RGB').save(os.path.join(out, 'awdjoo-1-3-preview.png'))
print('wrote assets/levels/awdjoo-1-3-preview.png')
