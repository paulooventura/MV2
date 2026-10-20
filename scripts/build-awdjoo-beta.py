#!/usr/bin/env python3
"""
Awdjoo Town — Level 1 "The Journey Begins" (BETA, lab G)
Translated from Paulo's pen sketch (Oct 2026), then tuned with his play notes.

Writes:
  assets/levels/awdjoo-beta.ldtk          LDtk project (Collision + Skin IntGrids, Entities)
  assets/levels/awdjoo-beta-preview.png   labelled preview (needs Pillow)

One cell = one world tile (32px). LDtk author grid is 16px (lab F scale x2).
Layout is written in "map rows" (row 0 = the old world top); SKY rows of open
air are added above it so MIND can climb onto Laitu's roof.
Re-run after edits:  python3 scripts/build-awdjoo-beta.py
"""
import json, os, sys

SKY = 12                                   # extra open rows above the old ceiling
COLS, MAP_ROWS = 120, 56
ROWS = MAP_ROWS + SKY
AIR, SOLID, ONEWAY, DESTRUCT, SLOPE_L, SLOPE_R = 0, 1, 2, 3, 4, 5
# Skin layer (drawing only): what a cell looks like
SK_DIRT, SK_ROOF, SK_BRICK, SK_WOOD, SK_STONE_BG, SK_CAVE_BG = 0, 1, 2, 3, 4, 5
LDTK_TILE = 16

g = [[AIR] * COLS for _ in range(ROWS)]
skin = [[SK_DIRT] * COLS for _ in range(ROWS)]
def put(c, r, v):
    r += SKY
    if 0 <= c < COLS and 0 <= r < ROWS: g[r][c] = v
def rect(c0, c1, r0, r1, v):
    for r in range(r0, r1 + 1):
        for c in range(c0, c1 + 1): put(c, r, v)
def paint(c0, c1, r0, r1, s):
    for r in range(r0 + SKY, r1 + SKY + 1):
        for c in range(c0, c1 + 1):
            if 0 <= c < COLS and 0 <= r < ROWS: skin[r][c] = s

ents = []
def ent(etype, c, r, w=1, h=1, **fields):
    ents.append(dict(kind=etype, c=c, r=r + SKY, w=w, h=h, fields=fields))

# ── Surface: west road → hill up → plateau (Laitu) → hill down → spawn → arch
for c in range(COLS):
    if c <= 40:   rect(c, c, 20, MAP_ROWS - 1, SOLID)
    elif c <= 46: s = 20 - (c - 40); put(c, s, SLOPE_R); rect(c, c, s + 1, MAP_ROWS - 1, SOLID)
    elif c <= 78: rect(c, c, 14, MAP_ROWS - 1, SOLID)
    elif c <= 84: s = 14 + (c - 78); put(c, s - 1, SLOPE_L); rect(c, c, s, MAP_ROWS - 1, SOLID)
    else:         rect(c, c, 20, MAP_ROWS - 1, SOLID)
for r in range(-SKY, MAP_ROWS):              # world border
    put(0, r, SOLID); put(COLS - 1, r, SOLID)

# ── Family home (west) ────────────────────────────────────────────
# Roof steps (map rows 2-7), brick shell, ceiling row 8.
for r, (c0, c1) in {2: (13, 17), 3: (11, 19), 4: (8, 22), 5: (6, 24), 6: (3, 27), 7: (1, 29)}.items():
    rect(c0, c1, r, r, SOLID); paint(c0, c1, r, r, SK_ROOF)
rect(0, 30, 8, 8, SOLID); paint(0, 30, 8, 8, SK_BRICK)        # ceiling
rect(1, 1, 7, 19, SOLID); paint(0, 1, 7, 19, SK_BRICK)        # west wall
rect(30, 30, 8, 16, SOLID); paint(30, 30, 8, 16, SK_BRICK)    # east wall; door rows 17-19
# Bedroom loft: solid wood, open only at the KITCHEN end (cols 2-5) so the
# bedrooms are reached by walking through the living room + kitchen.
rect(6, 29, 14, 14, SOLID); paint(6, 29, 14, 14, SK_WOOD)
rect(2, 5, 18, 18, ONEWAY)                                    # kitchen hutch top: the step up (2 tiles)
# Living-room floor (2 thick) with the trapdoor slot (cols 26-29)
paint(1, 29, 20, 21, SK_WOOD)
rect(26, 29, 20, 21, AIR)

# ── Basement under the home: hallway → west room → Knowl tree room ──
rect(1, 29, 22, 25, AIR)                  # hallway
rect(1, 6, 26, 45, AIR)                   # west room (a drop shaft)
rect(15, 29, 27, 27, AIR)
for r, c1 in {28: 13, 29: 12, 30: 11, 31: 10}.items():       # stair wall slants down-left
    rect(c1 + 1, 29, r, r, AIR)
rect(9, 29, 32, 45, AIR)                  # tree room
rect(27, 29, 30, 30, SOLID)               # crystal ledge (RCA only)
rect(7, 8, 32, 45, AIR)                   # (2x14 omni wall between the west room and the tree room)
paint(1, 29, 22, 45, SK_STONE_BG)

# ── Laitu's basement (cave under the hill) ────────────────────────
rect(32, 95, 24, 32, AIR)                 # upper chamber
rect(32, 35, 33, 33, AIR)                 # drop into the pit
rect(32, 95, 34, 38, AIR)                 # lower gallery → TRS room (sealed by push stack)
rect(32, 52, 39, 39, AIR)
rect(32, 56, 40, 53, AIR)                 # the pit
rect(32, 34, 42, 42, SOLID); rect(37, 39, 46, 46, SOLID); rect(32, 34, 50, 50, SOLID)   # pit ledges
rect(64, 65, 14, 23, AIR)                 # Laitu's trapdoor shaft (cubes fill rows 14-15)
paint(32, 95, 24, 53, SK_CAVE_BG); paint(64, 65, 14, 23, SK_CAVE_BG)

# ── Laitu's house on the plateau ──────────────────────────────────
for r, (c0, c1) in {1: (63, 67), 2: (61, 69), 3: (59, 71), 4: (57, 75), 5: (55, 75)}.items():
    rect(c0, c1, r, r, SOLID); paint(c0, c1, r, r, SK_ROOF)
rect(56, 74, 6, 6, SOLID); paint(56, 74, 6, 6, SK_BRICK)
rect(56, 56, 6, 10, SOLID); rect(74, 74, 6, 10, SOLID)       # walls, doors rows 11-13
paint(56, 56, 6, 10, SK_BRICK); paint(74, 74, 6, 10, SK_BRICK)
paint(57, 73, 14, 14, SK_WOOD)

# ── Cubes: omni (break / push / pull / carry), push (XLR), pull (MAG), laser cage (TRS)
#    wedge=1: held in its floor slot until its item moves it (trapdoors).
def boxes(kind, cells, **f):
    for c, r in cells: ent('Box', c, r, kind=kind, **f)
boxes('omni', [(c, 20) for c in range(26, 30)])                    # home trapdoor: 4 omni ...
boxes('push', [(c, 21) for c in range(26, 30)], wedge=1)           # ... on 4 push blocks
boxes('omni', [(64, 14), (65, 14)])                                # Laitu's trapdoor: 2 omni ...
boxes('push', [(64, 15), (65, 15)], wedge=1)                       # ... on 2 push blocks
boxes('omni', [(27, 13), (29, 13), (27, 12), (28, 12), (29, 12)])  # box around the XLR crate
boxes('omni', [(c, r) for c in (12, 13) for r in range(22, 26)])   # column across the hallway
boxes('omni', [(7, 26), (7, 27)])                                  # hallway lip
boxes('omni', [(c, r) for c in (7, 8) for r in range(32, 46)])     # 2x14 omni wall into the tree room
boxes('omni', [(c, r) for c in (52, 53) for r in range(24, 33)])   # column, ceiling to ledge
boxes('push', [(c, r) for c in (44, 45) for r in range(24, 33)])   # 2x9 push wall, west of the omni wall
boxes('pull', [(c, 33) for c in range(32, 36)], wedge=1)           # 4 pull blocks capping the drop into the pit
boxes('pull', [(56, r) for r in range(34, 39)])                    # pull wall in front of ...
boxes('push', [(57, r) for r in range(34, 39)])                    # ... the push wall sealing the TRS gallery
boxes('push', [(c, 49) for c in range(43, 52)], stay=1)            # floating push platform in the pit: push blocks up into stairs
boxes('laser', [(c, r) for c in (73, 74, 75) for r in (1, 2, 3) if (c, r) != (74, 2)])   # cage on Laitu's roof

# ── Pickups ───────────────────────────────────────────────────────
ent('MindSpawn', 106, 17, 1, 3)
ent('Gate', 113, 15, 3, 5, crystals=3, seeds=6)
for c, r, slot in [(113, 11, 'crystal'), (114, 10, 'crystal'), (115, 11, 'crystal'),
                   (110, 14, 'seed'), (111, 13, 'seed'), (112, 12, 'seed'),
                   (116, 12, 'seed'), (117, 13, 'seed'), (118, 14, 'seed')]:
    ent('GateShell', c, r, slot=slot)
ent('Item', 28, 13, item='XLR')          # bedroom 2, east end, boxed in omni
ent('Rca', 15, 45)                       # at the Knowl tree's roots
ent('KnowlTree', 18, 43, 2, 3)
ent('Item', 85, 32, item='MAG')
ent('Item', 86, 38, item='TRS')
ent('Crystal', 74, 2)                    # Laitu's roof, in the TRS cage
ent('Crystal', 28, 28)                   # tree-room ledge (RCA only)
ent('Crystal', 91, 37)                   # TRS room
for c, r in [(33, 18), (37, 18), (43, 15), (80, 12), (84, 16), (95, 18)]:
    ent('Knowl', c, r)                   # seeds (dropped to the floor below)
ent('Laitu', 50, 11, 1, 3)
ent('Enemy', 36, 19, kind='A')
ent('Enemy', 78, 13, kind='B')
for c, r, txt in [(5, 11, 'BEDROOM 1'), (16, 11, 'BEDROOM 2'), (6, 16, 'KITCHEN'), (16, 16, 'LIVING ROOM'),
                  (61, 9, "LAITU'S HOUSE")]:
    ent('Label', c, r, text=txt)
ent('Room', 2, 9, 28, 11, style='home', loft=14 + SKY)
ent('Room', 57, 7, 17, 7, style='laitu')
# drawing-only decor anchors (cell = anchor point)
ent('Decor', 6, 0, kind='chimney', dy=16, len=112)
ent('Decor', 69, 1, kind='chimney', dx=8, len=64)
for c, r, kind in [(16, 5, 'attic'), (33, 20, 'lamp'), (48, 14, 'lamp'), (102, 20, 'lamp'), (97, 20, 'sign'), (21, 46, 'tree')]:
    ent('Decor', c, r, kind=kind)

# ── Seeds sit on the floor ────────────────────────────────────────
def solid_at(c, r):
    return not (0 <= r < ROWS and 0 <= c < COLS) or g[r][c] in (SOLID, SLOPE_L, SLOPE_R, ONEWAY)
for e in ents:
    if e['kind'] != 'Knowl': continue
    while not solid_at(e['c'], e['r'] + 1): e['r'] += 1

# ── Gravity (Paulo: an unsupported cube always falls). Wedged trapdoor
#    blocks and the laser cage stay put; an item crate holds up what sits on it.
boxes_ = [e for e in ents if e['kind'] == 'Box']
crates = {(e['c'], e['r']) for e in ents if e['kind'] in ('Item', 'Rca')}
for e in boxes_: g[e['r']][e['c']] = AIR
def fixed(e): return e['fields'].get('kind') == 'laser' or e['fields'].get('wedge') or e['fields'].get('stay')
settled = 0
changed = True
while changed:
    changed = False
    occ = {(e['c'], e['r']) for e in boxes_}
    for e in sorted(boxes_, key=lambda e: -e['r']):
        if fixed(e): continue
        below = (e['c'], e['r'] + 1)
        if not solid_at(*below) and below not in occ and below not in crates:
            occ.discard((e['c'], e['r'])); e['r'] += 1; occ.add((e['c'], e['r'])); changed = True; settled += 1
occ = {(e['c'], e['r']) for e in boxes_}
loose = [(e['c'], e['r'] - SKY) for e in boxes_ if not fixed(e) and not solid_at(e['c'], e['r'] + 1)
         and (e['c'], e['r'] + 1) not in occ and (e['c'], e['r'] + 1) not in crates]
if loose: sys.exit('floating cubes after settling: %s' % loose)
if settled: print('note: gravity moved cubes %d cells while settling' % settled)
print('cubes:', len(boxes_), 'all resting')

# ── LDtk export ───────────────────────────────────────────────────
def fval(name, v):
    t = 'Int' if isinstance(v, int) else 'String'
    return {'__identifier': name, '__type': t, '__value': v}
inst = []
for i, e in enumerate(ents):
    inst.append({'__identifier': e['kind'], 'iid': f'beta-{i}', 'width': e['w'] * LDTK_TILE,
                 'height': e['h'] * LDTK_TILE, 'px': [e['c'] * LDTK_TILE, e['r'] * LDTK_TILE],
                 '__grid': [e['c'], e['r']],
                 'fieldInstances': [fval(k, v) for k, v in e['fields'].items()]})
kinds = sorted({e['kind'] for e in ents})
def intgrid(name, uid, vals, data):
    return ({'identifier': name, 'type': 'IntGrid', 'uid': uid, 'gridSize': LDTK_TILE,
             'intGridValues': [{'value': v, 'identifier': n, 'color': c} for v, n, c in vals]},
            {'__identifier': name, '__type': 'IntGrid', '__cWid': COLS, '__cHei': ROWS,
             '__gridSize': LDTK_TILE, 'intGridCsv': [v for row in data for v in row]})
coll_def, coll_inst = intgrid('Collision', 1, [(1, 'SOLID', '#1c1428'), (2, 'ONEWAY', '#3a3060'), (3, 'DESTRUCT', '#c81818'),
                                               (4, 'SLOPE_L', '#e2c090'), (5, 'SLOPE_R', '#e2c090')], g)
skin_def, skin_inst = intgrid('Skin', 3, [(1, 'ROOF', '#3a2420'), (2, 'BRICK', '#4a2c26'), (3, 'WOOD', '#7a4a26'),
                                          (4, 'STONE_BG', '#2e2624'), (5, 'CAVE_BG', '#231a2a')], skin)
project = {
    '__header__': {'fileType': 'LDtk Project JSON', 'app': 'MV2 sketch translator', 'doc': 'Awdjoo beta from pen sketch'},
    'jsonVersion': '1.5.3', 'defaultGridSize': LDTK_TILE, 'externalLevels': False, 'bgColor': '#100818',
    'defs': {'layers': [coll_def, skin_def, {'identifier': 'Entities', 'type': 'Entities', 'uid': 2, 'gridSize': LDTK_TILE}],
             'entities': [{'identifier': k, 'uid': 100 + i} for i, k in enumerate(kinds)]},
    'levels': [{
        'identifier': 'Awdjoo_Beta_L1', 'iid': 'awdjoo-beta-l1', 'uid': 10, 'worldX': 0, 'worldY': 0,
        'pxWid': COLS * LDTK_TILE, 'pxHei': ROWS * LDTK_TILE, '__bgColor': '#100818',
        'fieldInstances': [fval('skyRows', SKY)],
        'layerInstances': [coll_inst, skin_inst,
            {'__identifier': 'Entities', '__type': 'Entities', '__cWid': COLS, '__cHei': ROWS,
             '__gridSize': LDTK_TILE, 'entityInstances': inst}]}],
}
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
out = os.path.join(root, 'assets', 'levels'); os.makedirs(out, exist_ok=True)
with open(os.path.join(out, 'awdjoo-beta.ldtk'), 'w') as f: json.dump(project, f, indent=1)
print('wrote assets/levels/awdjoo-beta.ldtk', COLS, 'x', ROWS, len(ents), 'entities')

# ── Preview ───────────────────────────────────────────────────────
try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit(0)
S = 10
im = Image.new('RGB', (COLS * S, ROWS * S + 60), '#2a2038'); d = ImageDraw.Draw(im)
for r in range(ROWS):                              # dusk sky fades toward the horizon
    t = r / (SKY + 20)
    if t < 1: d.rectangle([0, r * S, COLS * S, r * S + S], fill=(int(42 + 150 * t), int(32 + 60 * t), int(56 + 30 * t)))
bgcol = {SK_STONE_BG: '#3a302c', SK_CAVE_BG: '#2a2030'}
for e in ents:
    if e['kind'] == 'Room':
        d.rectangle([e['c'] * S, e['r'] * S, (e['c'] + e['w']) * S, (e['r'] + e['h']) * S], fill='#7a4a2a')
for r in range(ROWS):
    for c in range(COLS):
        v, sk = g[r][c], skin[r][c]; x, y = c * S, r * S
        if v == AIR and sk in bgcol: d.rectangle([x, y, x + S - 1, y + S - 1], fill=bgcol[sk])
        fill = {SK_ROOF: '#3a2420', SK_BRICK: '#5e3a30', SK_WOOD: '#a8703a'}.get(sk, '#6b4a32')
        if v == SOLID: d.rectangle([x, y, x + S - 1, y + S - 1], fill=fill)
        elif v == ONEWAY: d.rectangle([x, y, x + S - 1, y + 2], fill='#a8703a')
        elif v == SLOPE_R: d.polygon([(x, y + S), (x + S, y), (x + S, y + S)], fill=fill)
        elif v == SLOPE_L: d.polygon([(x, y), (x + S, y + S), (x, y + S)], fill=fill)
col = {'omni': '#8a4ad8', 'push': '#2f6fd8', 'pull': '#d0362c', 'laser': '#d8a820'}
for e in ents:
    x, y, k = e['c'] * S, e['r'] * S, e['kind']
    if k == 'Box':
        kind = e['fields']['kind']
        d.rectangle([x + 1, y + 1, x + S - 2, y + S - 2], fill=col[kind], outline='#000')
        if kind == 'push': d.line([x + 2, y + 2, x + S - 3, y + S - 3], fill='#fff')
        if e['fields'].get('wedge') or e['fields'].get('stay'): d.line([x + 1, y + S - 2, x + S - 2, y + S - 2], fill='#fff')
        if kind == 'pull': d.line([x + 2, y + S - 3, x + S - 3, y + 2], fill='#fff')
    elif k == 'Knowl': d.ellipse([x + 1, y + 1, x + S - 1, y + S - 1], fill='#66ffaa', outline='#205030')
    elif k == 'Crystal': d.polygon([(x + 5, y - 2), (x + 11, y + 5), (x + 5, y + 12), (x - 1, y + 5)], fill='#40c8e8', outline='#000')
    elif k in ('Item', 'Rca'):
        name = e['fields'].get('item', 'RCA')
        d.rectangle([x, y, x + S - 1, y + S - 1], fill='#c08a4a', outline='#000'); d.text((x - 6, y - 12), name, fill='#fff')
    elif k == 'Decor' and e['fields']['kind'] == 'tree':
        d.ellipse([x - 90, y - 150, x + 90, y - 40], fill='#2e8a6a', outline='#7fffd0'); d.rectangle([x - 8, y - 50, x + 8, y], fill='#5a3a20')
    elif k == 'MindSpawn': d.rectangle([x, y, x + S, y + 3 * S], outline='#c080ff', width=2); d.text((x - 14, y - 12), 'SPAWN', fill='#fff')
    elif k == 'Gate':
        d.arc([x, y, x + 3 * S, y + 5 * S], 180, 360, fill='#ffe680', width=3); d.line([x, y + 15, x, y + 5 * S], fill='#ffe680', width=3)
        d.line([x + 3 * S, y + 15, x + 3 * S, y + 5 * S], fill='#ffe680', width=3); d.text((x - 8, y - 12), 'GATE 3+6', fill='#fff')
    elif k == 'Laitu': d.ellipse([x, y, x + S, y + S], fill='#ffe060', outline='#000'); d.text((x - 6, y - 12), 'LAITU', fill='#fff')
    elif k == 'Enemy': d.ellipse([x - 2, y - 2, x + S + 2, y + S + 2], fill='#ffb0b0', outline='#000'); d.text((x + 1, y), e['fields']['kind'], fill='#000')
    elif k == 'Label': d.text((x, y), e['fields']['text'], fill='#f0d8a8')
lg = ROWS * S + 10
d.rectangle([0, ROWS * S, COLS * S, ROWS * S + 60], fill='#f3ead8')
for i, (c, t) in enumerate([('#8a4ad8', 'omni cube'), ('#2f6fd8', 'push (XLR)'), ('#d0362c', 'pull (MAG)'), ('#d8a820', 'TRS cage'), ('#40c8e8', 'crystal'),
                            ('#66ffaa', 'seed'), ('#c08a4a', 'item crate')]):
    x = 10 + i * 168; d.rectangle([x, lg, x + 12, lg + 12], fill=c, outline='#000'); d.text((x + 18, lg + 1), t, fill='#000')
d.text((10, lg + 26), 'Awdjoo Town - Level 1 - The Journey Begins (BETA)   1 cell = 32px   white underline = held in place until its item moves it', fill='#000')
im.save(os.path.join(out, 'awdjoo-beta-preview.png'))
print('wrote assets/levels/awdjoo-beta-preview.png')
