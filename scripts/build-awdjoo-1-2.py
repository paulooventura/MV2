#!/usr/bin/env python3
"""
Awdjoo Town 1.2, from Paulo's full map sheet (Oct 21 2026). Replaces the
Oct 20 trial layout.

Writes:
  assets/levels/awdjoo-1-2.ldtk          LDtk project (Collision + Skin IntGrids, Entities)
  assets/levels/awdjoo-1-2-preview.png   labelled preview (needs Pillow)

Reading the sheet (1 graph-paper square = 2 tiles = 64 px):
  - MIND arrives through the arch on the left ledge. A seed on the ledge, a
    moving platform with a seed past it, the long slope with two seeds, and a
    crystal up top over the long high platform. The town is BACKGROUND (pink).
  - At the foot of the slope a moving platform crosses the gap to the pillar
    (an Enemy A on top). The gap drops into the WATER ROOM: the Isolator on a
    lip at the left, two platforms that meet mid-room (a triangle rides one, a
    square the other), an Enemy A on a ledge at the right wall, a crystal and
    an (isolated) Enemy A at the bottom of the pool, the PIT on the right.
  - The roof-tile HOUSE is SOLID (black outline): a fish-scale roof band with
    two legs, a gable on the right and a flared eave. You go INSIDE it: the
    door is under the left leg (the porch, pink hatching, is background);
    inside, a sliding block (an Enemy A rides it), a moving platform, a crystal
    in the top-right corner, a triangle on the roof, seeds over the roof and
    the gable. Wooden stairs go down inside it to a floor (a square enemy),
    then down again to a landing.
  - Past the landing: a drop into the lower CORRIDOR (seeds, a moving platform,
    and D, the mirror enemy). Above the corridor's left end, a little CRYSTAL
    CHAMBER whose floor is ELECTRO blocks (TRS) — shoot them from below.
  - Across the drop: the street in front of the urban residential BUILDING
    (background), a seed, and the exit door (all 5 crystals + 10 seeds).
  - Under the street: the FLOODED CHAMBER. Its water is held in by a plug of
    electro blocks at the bottom, facing the corridor: shoot it and the water
    pours out, so you can get in from the bottom, climb the shaft and take the
    crystal. The way back out is through omni / push / pull blocks (left to
    right) — openable only from the right (pull the red ones toward you, then
    push the blue + omni line out into the drop).
Re-run after edits:  python3 scripts/build-awdjoo-1-2.py
"""
import json, os, sys

COLS, ROWS = 72, 68
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

# ── Borders ──────────────────────────────────────────────────────
rect(0, 0, 0, ROWS - 1, SOLID); rect(COLS - 1, COLS - 1, 0, ROWS - 1, SOLID)
rect(0, COLS - 1, ROWS - 1, ROWS - 1, SOLID)
# (the pit is cut through the bottom row below)

# ── Arrival ledge + the long slope (SLOPE_L = surface falls to the right) ──
rect(1, 6, 30, 43, SOLID)
for c in range(7, 17):
    s = 32 + (c - 7)
    put(c, s, SLOPE_L); rect(c, c, s + 1, 43, SOLID)
# cols 17-28: the gap down into the water room

# ── The pillar, and the porch ground in front of the house ──────────
rect(29, 30, 30, 43, SOLID)
rect(31, 35, 38, 43, SOLID); paint(31, 35, 38, 38, SK_WOOD)

# ── Water room (under the slope and the pillar) ───────────────────
rect(0, 2, 44, ROWS - 1, SOLID)                         # left wall
rect(3, 5, 55, ROWS - 1, SOLID)                         # the lip the Isolator waits on
rect(6, 23, 62, ROWS - 1, SOLID)                        # pool floor
rect(24, 24, 55, ROWS - 1, SOLID)                       # pool rim: the water stays on its floor
rect(25, 34, 55, ROWS - 1, AIR)                         # the PIT: no floor (fall in, MIND shuts down)
rect(31, 34, 51, 52, SOLID)                             # ledge on the right wall
paint(3, 34, 44, ROWS - 1, SK_STONE_BG)

# ── The house: solid fish-scale roof band, two legs, gable, flared eave ──
put(33, 24, SLOPE_R)                                    # bevelled top-left corner
rect(33, 34, 25, 33, SOLID)                             # left leg (door underneath, rows 34-37)
rect(34, 48, 24, 25, SOLID)                             # roof band / ceiling
put(45, 23, SLOPE_R); put(46, 22, SLOPE_R)              # gable
rect(46, 46, 23, 23, SOLID); rect(47, 48, 22, 23, SOLID)
put(49, 22, SLOPE_L); put(50, 23, SLOPE_L); rect(49, 49, 23, 23, SOLID)
rect(49, 50, 24, 35, SOLID)                             # right leg
put(51, 32, SLOPE_L); rect(51, 51, 33, 35, SOLID)       # the flared eave
put(52, 33, SLOPE_L); rect(52, 52, 34, 35, SOLID)
paint(33, 52, 22, 35, SK_SCALES)

# ── Stairs inside the house (wood), the floor, more stairs, the landing ──
surface = {35: 38}
for i, c in enumerate(range(36, 40)): surface[c] = ('L', 38 + i)
for c in range(40, 48): surface[c] = 42
for i, c in enumerate(range(48, 52)): surface[c] = ('L', 42 + i)
surface[52] = 46
for c, top in surface.items():
    if isinstance(top, tuple):
        put(c, top[1], SLOPE_L); rect(c, c, top[1] + 1, 49, SOLID); paint(c, c, top[1], top[1], SK_WOOD)
    else:
        rect(c, c, top, 49, SOLID); paint(c, c, top, top, SK_WOOD)
rect(35, 36, 38, ROWS - 1, SOLID)                       # water room's right wall / corridor's left wall

# ── Crystal chamber (floor = electro blocks) and the lower corridor ──
rect(37, 40, 44, 48, AIR)
rect(37, 56, 50, 60, AIR)                               # corridor (cols 53-56 = the drop from the landing)
rect(35, COLS - 1, 61, ROWS - 2, SOLID)                 # corridor + chamber floor
paint(37, 40, 44, 49, SK_STONE_BG); paint(37, 66, 50, 60, SK_STONE_BG)

# ── The street (in front of the background building) and the flooded chamber under it ──
put(57, 47, SLOPE_R); rect(57, 57, 48, 49, SOLID)
put(58, 46, SLOPE_R); rect(58, 58, 47, 49, SOLID)
rect(59, COLS - 2, 46, 49, SOLID); paint(57, COLS - 2, 46, 47, SK_BRICK)
rect(67, COLS - 2, 50, ROWS - 1, SOLID)                 # right of the chamber
rect(57, 62, 54, 56, SOLID)                             # the block in the middle (the stack sits on it)
# chamber air: cols 57-66, rows 50-60 (stack 57-60, pocket 61-66 / shaft 63-66 / channel rows 57-60)

# Paulo (Oct 21): the solid walls around the crystal chamber, the corridor and the
# flooded chamber are brick, like the rest of this part (no dirt behind the electro floor)
for r in range(39, ROWS):
    for c in range(35, COLS):
        if g[r][c] == SOLID and skin[r][c] in (SK_DIRT, SK_STONE_BG, SK_CAVE_BG): skin[r][c] = SK_BRICK

# ── Entities ──────────────────────────────────────────────────────
ent('MindSpawn', 2, 27, 1, 3)
ent('Decor', 1, 26, 2, 4, kind='arrival')               # the arch MIND comes through
ent('Gate', 64, 41, 3, 5, crystals=5, seeds=10)         # the exit door at the foot of the building
for c, r in [(61, 39), (63, 38), (65, 37), (67, 38), (69, 39)]:
    ent('GateShell', c, r, slot='crystal')
for c, r in [(59, 43), (60, 42), (61, 43), (62, 42), (63, 43), (67, 43), (68, 42), (69, 43), (70, 42), (65, 40)]:
    ent('GateShell', c, r, slot='seed')
ent('Isolator', 3, 54)                                  # on the lip in the water room
# the 5 crystals
ent('Crystal', 6, 7)                                    # up top, over the long platform's left end
ent('Crystal', 47, 27)                                  # inside the house, top-right corner
ent('Crystal', 38, 46)                                  # the electro-floored chamber over the corridor
ent('Crystal', 7, 61)                                   # bottom of the pool
ent('Crystal', 65, 52)                                  # the flooded chamber's top pocket
# the 10 seeds (snap=1: sits on the ground under it)
for c, r, snap in [(6, 29, 1), (22, 27, 0), (12, 35, 1), (16, 39, 1), (38, 23, 0), (48, 21, 0),
                   (52, 31, 0), (62, 45, 1), (38, 60, 1), (50, 60, 1)]:
    ent('Knowl', c, r, snap=snap)
# moving platforms: a..b = range of the LEFT edge (the sketch's arrows); speed in tenths of px/frame
ent('MovingPlatform', 5, 9, 4, 1, a=5, b=25, speed=12)      # the long high one
ent('MovingPlatform', 13, 29, 4, 1, a=9, b=19, speed=11)
ent('MovingPlatform', 17, 42, 4, 1, a=17, b=25, speed=13)   # across the gap to the pillar
ent('MovingPlatform', 6, 51, 4, 1, a=6, b=16, speed=10)     # water room: the two meet mid-room
ent('MovingPlatform', 26, 51, 4, 1, a=20, b=26, speed=10)
ent('MovingPlatform', 36, 29, 2, 1, a=36, b=45, speed=12)   # the sliding block inside the house
ent('MovingPlatform', 45, 33, 4, 1, a=35, b=45, speed=10)   # inside the house, lower
ent('MovingPlatform', 37, 54, 4, 1, a=37, b=52, speed=11)   # along the corridor
# water: the pool, and the flooded chamber (drains when its 'plug' electro blocks are shot)
ent('Water', 6, 55, 18, 7)
ent('Water', 61, 50, 6, 11, plug='flood')               # top pocket + the shaft down the right
ent('Water', 59, 57, 4, 4, plug='flood')                # the channel under the middle block
# cubes: omni (break / push / pull / carry), push (XLR), pull (MAG), laser = electro (TRS)
def boxes(kind, cells, **f):
    for c, r in cells: ent('Box', c, r, kind=kind, **f)
boxes('laser', [(c, 49) for c in range(37, 41)])                       # the crystal chamber's floor
boxes('omni', [(c, r) for c in (57, 58) for r in range(50, 54)])       # the one-way stack: omni ...
boxes('push', [(59, r) for r in range(50, 54)])                        # ... push (blue) ...
boxes('pull', [(60, r) for r in range(50, 54)])                        # ... pull (red)
boxes('laser', [(c, r) for c in (57, 58) for r in range(57, 61)], plug='flood')   # the plug holding the water in
# enemies: ai = circle (Enemy A) | tri (B) | square (C) | mirror (D); range in tiles each way
ent('Enemy', 29, 29, ai='circle', range=1)              # on the pillar
ent('Enemy', 37, 28, ai='circle', range=1)              # rides the sliding block in the house
ent('Enemy', 42, 23, ai='tri', range=2)                 # on the roof
ent('Enemy', 44, 41, ai='square', range=3)              # on the floor between the stairs
ent('Enemy', 8, 50, ai='tri', range=2)                  # rides the left water platform
ent('Enemy', 28, 50, ai='square', range=2)              # rides the right one
ent('Enemy', 32, 50, ai='circle', range=1)              # on the ledge on the right wall
ent('Enemy', 9, 61, ai='circle', range=3, iso=1)        # pool bottom — wears an Isolator
ent('Enemy', 44, 60, ai='mirror', range=8)              # D: the mirror enemy, in the corridor
# background art (no collision, drawn behind the tiles)
ent('Decor', 2, 10, 25, 24, kind='town')                # the town behind the arrival ledge and the slope
ent('Decor', 35, 26, 18, 20, kind='houseInside')        # the house's back wall, behind the stairs
ent('Decor', 31, 32, 4, 6, kind='porch')                # the porch at the door (pink hatching)
ent('Decor', 53, 20, 18, 26, kind='building')           # the urban residential building over the street
ent('Decor', 59, 45, kind='lamp')

# seeds marked snap sit on whatever is under them
def solid_at(c, r):
    return not (0 <= r < ROWS and 0 <= c < COLS) or g[r][c] in (SOLID, SLOPE_L, SLOPE_R, ONEWAY)
for e in ents:
    if e['kind'] == 'Knowl' and e['fields'].pop('snap', 0):
        while not solid_at(e['c'], e['r'] + 1): e['r'] += 1

# ── Gravity (an unsupported cube falls); electro blocks stay put ───
boxes_ = [e for e in ents if e['kind'] == 'Box']
for e in boxes_:
    if e['fields']['kind'] != 'laser' and not solid_at(e['c'], e['r'] + 1) and (e['c'], e['r'] + 1) not in {(b['c'], b['r']) for b in boxes_}:
        sys.exit('floating cube at %d,%d' % (e['c'], e['r']))
counts = {k: sum(1 for e in ents if e['kind'] == k) for k in ('Knowl', 'Crystal')}
assert counts == {'Knowl': 10, 'Crystal': 5}, counts

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
    '__header__': {'fileType': 'LDtk Project JSON', 'app': 'MV2 sketch translator', 'doc': 'Awdjoo Town 1.2 from the full map sheet'},
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
im = Image.new('RGB', (COLS * S, ROWS * S), '#2a2038'); d = ImageDraw.Draw(im)
for r in range(ROWS):
    t = r / 46
    if t < 1: d.rectangle([0, r * S, COLS * S, r * S + S], fill=(int(42 + 150 * t), int(32 + 60 * t), int(56 + 30 * t)))
for e in ents:                                          # background art first
    if e['kind'] == 'Decor' and e['fields'].get('kind') in ('town', 'houseInside', 'porch', 'building'):
        x, y = e['c'] * S, e['r'] * S
        d.rectangle([x, y, (e['c'] + e['w']) * S - 1, (e['r'] + e['h']) * S - 1], outline='#ff80c0', width=1)
        d.text((x + 3, y + 3), 'BG ' + e['fields']['kind'], fill='#ff80c0')
for r in range(ROWS):
    for c in range(COLS):
        v, sk = g[r][c], skin[r][c]; x, y = c * S, r * S
        if v == AIR and sk == SK_STONE_BG: d.rectangle([x, y, x + S - 1, y + S - 1], fill='#3a302c')
        col = {SK_SCALES: '#c06090', SK_WOOD: '#9a6a3a', SK_BRICK: '#8a5a4a'}.get(sk, '#6b4a32')
        if v == SOLID: d.rectangle([x, y, x + S - 1, y + S - 1], fill=col)
        elif v == SLOPE_L: d.polygon([(x, y), (x + S, y + S), (x, y + S)], fill=col)
        elif v == SLOPE_R: d.polygon([(x, y + S), (x + S, y), (x + S, y + S)], fill=col)
BOXC = {'omni': '#8a4ad8', 'push': '#2f6fd8', 'pull': '#d0362c', 'laser': '#d8a820'}
for e in ents:
    x, y, k, f = e['c'] * S, e['r'] * S, e['kind'], e['fields']
    if k == 'Water': d.rectangle([x, y, (e['c'] + e['w']) * S - 1, (e['r'] + e['h']) * S - 1], outline='#60b0ff', width=2)
    elif k == 'Box': d.rectangle([x + 1, y + 1, x + S - 2, y + S - 2], fill=BOXC[f['kind']], outline='#000')
    elif k == 'MovingPlatform':
        d.line([f['a'] * S, y + 3, (f['b'] + e['w']) * S, y + 3], fill='#c08060', width=1)
        d.rectangle([x, y, x + e['w'] * S, y + 6], fill='#a06030', outline='#000')
    elif k == 'Knowl': d.ellipse([x + 2, y + 2, x + S - 2, y + S - 2], fill='#66ffaa', outline='#205030')
    elif k == 'Crystal': d.polygon([(x + 6, y - 2), (x + 12, y + 6), (x + 6, y + 14), (x, y + 6)], fill='#40e890', outline='#000')
    elif k == 'Isolator': d.ellipse([x, y, x + S, y + S], fill='#ff9030', outline='#000'); d.text((x - 10, y - 12), 'ISOLATOR', fill='#fff')
    elif k == 'MindSpawn': d.rectangle([x, y, x + S, y + 3 * S], outline='#c080ff', width=2); d.text((x - 4, y - 12), 'SPAWN', fill='#fff')
    elif k == 'Gate': d.arc([x, y, x + 3 * S, y + 5 * S], 180, 360, fill='#ffe680', width=3); d.text((x - 8, y - 12), 'EXIT 5+10', fill='#fff')
    elif k == 'Enemy':
        a = f.get('ai'); col = '#ff4040'
        if a == 'circle': d.ellipse([x, y, x + S, y + S], fill=col, outline='#000')
        elif a == 'square': d.rectangle([x, y, x + S, y + S], fill=col, outline='#000')
        elif a == 'mirror': d.text((x, y - 4), 'D', fill='#ff3030')
        else: d.polygon([(x + S // 2, y), (x + S, y + S), (x, y + S)], fill=col, outline='#000')
im = im.convert('RGBA'); ov = Image.new('RGBA', im.size); od = ImageDraw.Draw(ov)
for e in ents:
    if e['kind'] == 'Water':
        for r in range(e['r'], e['r'] + e['h']):
            for c in range(e['c'], e['c'] + e['w']):
                if g[r][c] == AIR: od.rectangle([c * S, r * S, c * S + S - 1, r * S + S - 1], fill=(60, 140, 255, 120))
Image.alpha_composite(im, ov).convert('RGB').save(os.path.join(out, 'awdjoo-1-2-preview.png'))
print('wrote assets/levels/awdjoo-1-2-preview.png')
