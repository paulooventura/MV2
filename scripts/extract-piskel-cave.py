#!/usr/bin/env python3
"""Extract Wall's 256 Piskel cave screenshot into classified map assets."""
from __future__ import annotations

import json
import uuid
from collections import Counter, deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(
    r"C:\Users\PVProductions\.cursor\projects\c-Users-PVProductions-Projects-MV2"
    r"\assets\c__Users_PVProductions_AppData_Roaming_Cursor_User_workspaceStorage"
    r"_d10b0b6ea918143c50b8bce4a3d0e52a_images_image-b2bdbeae-12ab-4a75-b77e-d7359972e392.png"
)
OUT = ROOT / "assets" / "sketches"
JS_OUT = ROOT / "js" / "sketch_map.js"

N = 256
TILE = 16
CROP = (281, 43, 442)  # x, y, size in the Piskel screenshot

PAL = {
    "K": (0, 0, 0),
    "W": (255, 255, 255),
    "R": (255, 0, 0),
    "Y": (248, 231, 28),
    "C": (80, 227, 194),
    "N": (146, 77, 26),
    "S": (170, 102, 255),
}


def classify_rgb(r: int, g: int, b: int) -> str:
    if r < 45 and g < 45 and b < 45:
        return "K"
    if r > 200 and g < 95 and b < 95:
        return "R"
    if r > 180 and g > 150 and b < 110:
        return "Y"
    if g > 160 and b > 140 and r < 150:
        return "C"
    if 90 < r < 200 and 35 < g < 130 and b < 85 and r > g:
        return "N"
    if r > 200 and g > 200 and b > 190:
        return "W"
    # screenshot fringe: yellow glow, pale red, dark anti-alias
    if r > 180 and g > 160 and b < 180:
        return "Y"
    if r > 150 and g < 120 and b < 120:
        return "R"
    if r + g + b < 140:
        return "K"
    return "W"


def extract_grid() -> np.ndarray:
    im = Image.open(SRC).convert("RGB")
    a = np.array(im)
    x0, y0, sz = CROP
    crop = a[y0 : y0 + sz, x0 : x0 + sz]
    scale = sz / N
    grid = np.empty((N, N), dtype="U1")
    for ty in range(N):
        for tx in range(N):
            x1 = int(tx * scale)
            x2 = max(x1 + 1, int((tx + 1) * scale))
            y1 = int(ty * scale)
            y2 = max(y1 + 1, int((ty + 1) * scale))
            block = crop[y1:y2, x1:x2].reshape(-1, 3)
            votes = Counter(classify_rgb(int(r), int(g), int(b)) for r, g, b in block)
            # prefer markers over wall/air when they appear at all
            for key in ("C", "N", "Y", "R"):
                if votes[key] >= max(2, len(block) // 8):
                    grid[ty, tx] = key
                    break
            else:
                grid[ty, tx] = votes.most_common(1)[0][0]
    return grid


def components(grid: np.ndarray, kind: str) -> list[list[tuple[int, int]]]:
    h, w = grid.shape
    seen = np.zeros((h, w), dtype=bool)
    out = []
    for y in range(h):
        for x in range(w):
            if grid[y, x] != kind or seen[y, x]:
                continue
            q = deque([(x, y)])
            seen[y, x] = True
            blob = []
            while q:
                cx, cy = q.popleft()
                blob.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny, nx] and grid[ny, nx] == kind:
                        seen[ny, nx] = True
                        q.append((nx, ny))
            out.append(blob)
    return out


def centroid(blob: list[tuple[int, int]]) -> tuple[int, int]:
    xs = [p[0] for p in blob]
    ys = [p[1] for p in blob]
    return int(round(sum(xs) / len(xs))), int(round(sum(ys) / len(ys)))


def bbox(blob: list[tuple[int, int]]) -> tuple[int, int, int, int]:
    xs = [p[0] for p in blob]
    ys = [p[1] for p in blob]
    return min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1


def is_solid_cell(ch: str) -> bool:
    return ch in ("K", "S")


def detect_slopes(grid: np.ndarray) -> list[dict]:
    """Mark 45° rising (SLOPE_R) stairs on the air/solid floor."""
    h, w = grid.shape
    floor = np.zeros((h, w), dtype=bool)
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if grid[y, x] != "K":
                continue
            if grid[y - 1, x] not in ("W", "Y", "C", "N"):
                continue
            floor[y, x] = True
    runs = []
    used = np.zeros((h, w), dtype=bool)
    for y in range(h):
        for x in range(w):
            if not floor[y, x] or used[y, x]:
                continue
            # SLOPE_R: next floor step is (x+1, y-1)
            if y == 0 or x + 1 >= w or not floor[y - 1, x + 1]:
                continue
            cells = [(x, y)]
            cx, cy = x, y
            while cx + 1 < w and cy - 1 >= 0 and floor[cy - 1, cx + 1] and not used[cy - 1, cx + 1]:
                cx += 1
                cy -= 1
                cells.append((cx, cy))
            if len(cells) < 4:
                continue
            for cx, cy in cells:
                used[cy, cx] = True
                grid[cy, cx] = "S"
            runs.append({"c": cells[0][0], "r": cells[0][1], "n": len(cells), "kind": "R"})
    return runs


def greedy_solids(grid: np.ndarray) -> list[dict]:
    h, w = grid.shape
    used = np.zeros((h, w), dtype=bool)
    rects = []
    for y in range(h):
        for x in range(w):
            if used[y, x] or grid[y, x] != "K":
                continue
            max_w = 0
            while x + max_w < w and grid[y, x + max_w] == "K" and not used[y, x + max_w]:
                max_w += 1
            max_h = 1
            grow = True
            while y + max_h < h and grow:
                for xx in range(x, x + max_w):
                    if grid[y + max_h, xx] != "K" or used[y + max_h, xx]:
                        grow = False
                        break
                if grow:
                    max_h += 1
            for yy in range(y, y + max_h):
                used[yy, x : x + max_w] = True
            rects.append({"c": x, "r": y, "w": max_w, "h": max_h})
    return rects


def save_png(grid: np.ndarray, path: Path) -> None:
    img = Image.new("RGB", (N, N), PAL["W"])
    px = img.load()
    for y in range(N):
        for x in range(N):
            ch = grid[y, x]
            if ch == "Y":
                px[x, y] = PAL["W"]
            elif ch == "C":
                px[x, y] = PAL["W"]
            elif ch == "N":
                px[x, y] = PAL["W"]
            else:
                px[x, y] = PAL.get(ch, PAL["W"])
    # stamp markers 1px so the PNG still shows the sketch
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)


def stamp_markers(path: Path, knowls, spawn, crate, reds) -> None:
    img = Image.open(path)
    px = img.load()
    for k in knowls:
        px[k["c"], k["r"]] = PAL["Y"]
    px[spawn["c"], spawn["r"]] = PAL["C"]
    px[crate["c"], crate["r"]] = PAL["N"]
    for rd in reds:
        for y in range(rd["r"], rd["r"] + rd["h"]):
            for x in range(rd["c"], rd["c"] + rd["w"]):
                if 0 <= x < N and 0 <= y < N:
                    px[x, y] = PAL["R"]
    img.save(path)


def write_ldtk(data: dict, path: Path) -> None:
    iid = lambda: str(uuid.uuid4())
    level_iid = iid()
    coll_iid = iid()
    ent_iid = iid()
    csv = []
    g = data["_grid"]
    for y in range(N):
        for x in range(N):
            ch = g[y, x]
            if ch == "K":
                csv.append(1)
            elif ch == "R":
                csv.append(2)
            elif ch == "S":
                csv.append(3)
            else:
                csv.append(0)
    ents = []
    ents.append({
        "__identifier": "Player",
        "__grid": [data["spawn"]["c"], data["spawn"]["r"]],
        "__pivot": [0, 0],
        "__tags": [],
        "__tile": None,
        "__smartColor": "#50E3C2",
        "iid": iid(),
        "width": TILE,
        "height": TILE,
        "defUid": 3,
        "px": [data["spawn"]["c"] * TILE, data["spawn"]["r"] * TILE],
        "fieldInstances": [],
    })
    for k in data["knowls"]:
        ents.append({
            "__identifier": "Knowl",
            "__grid": [k["c"], k["r"]],
            "__pivot": [0.5, 0.5],
            "__tags": [],
            "__tile": None,
            "__smartColor": "#F8E71C",
            "iid": iid(),
            "width": TILE,
            "height": TILE,
            "defUid": 4,
            "px": [k["c"] * TILE, k["r"] * TILE],
            "fieldInstances": [],
        })
    ents.append({
        "__identifier": "Crate",
        "__grid": [data["crate"]["c"], data["crate"]["r"]],
        "__pivot": [0, 0],
        "__tags": [],
        "__tile": None,
        "__smartColor": "#924D1A",
        "iid": iid(),
        "width": TILE,
        "height": TILE,
        "defUid": 5,
        "px": [data["crate"]["c"] * TILE, data["crate"]["r"] * TILE],
        "fieldInstances": [],
    })
    def_ent = lambda ident, uid, color, pivot: {
        "identifier": ident,
        "uid": uid,
        "tags": [],
        "exportToToc": False,
        "allowOutOfBounds": False,
        "doc": "",
        "width": TILE,
        "height": TILE,
        "resizableX": False,
        "resizableY": False,
        "minWidth": None,
        "maxWidth": None,
        "minHeight": None,
        "maxHeight": None,
        "keepAspectRatio": False,
        "tileOpacity": 1,
        "fillOpacity": 1,
        "lineOpacity": 1,
        "hollow": False,
        "color": color,
        "renderMode": "Rectangle",
        "showName": True,
        "tilesetId": None,
        "tileRenderMode": "FitInside",
        "tileRect": None,
        "uiTileRect": None,
        "nineSliceBorders": [0, 0, 0, 0],
        "maxCount": 0,
        "limitScope": "PerLevel",
        "limitBehavior": "MoveLastOne",
        "pivotX": pivot[0],
        "pivotY": pivot[1],
        "fieldDefs": [],
    }
    ldtk = {
        "__header__": {
            "fileType": "LDtk Project JSON",
            "app": "LDtk",
            "doc": "https://ldtk.io/json",
            "schema": "https://ldtk.io/files/JSON_SCHEMA.json",
            "appAuthor": "deepnight",
            "appVersion": "1.5.3",
            "url": "https://ldtk.io",
        },
        "iid": iid(),
        "jsonVersion": "1.5.3",
        "appBuildId": 473703,
        "nextUid": 10,
        "identifierStyle": "Capitalization",
        "toc": [],
        "worldLayout": "Free",
        "worldGridWidth": N * TILE,
        "worldGridHeight": N * TILE,
        "defaultLevelWidth": N * TILE,
        "defaultLevelHeight": N * TILE,
        "defaultPivotX": 0,
        "defaultPivotY": 0,
        "defaultGridSize": TILE,
        "defaultEntityWidth": TILE,
        "defaultEntityHeight": TILE,
        "bgColor": "#0A0618",
        "defaultLevelBgColor": "#0A0618",
        "minifyJson": False,
        "externalLevels": False,
        "exportTiled": False,
        "simplifiedExport": False,
        "imageExportMode": "None",
        "exportLevelBg": True,
        "pngFilePattern": None,
        "backupOnSave": False,
        "backupLimit": 10,
        "backupRelPath": None,
        "levelNamePattern": "Level_%idx",
        "tutorialDesc": "Piskel cave sketch — black solid, red breakable, yellow knowls, cyan spawn, brown crate.",
        "customCommands": [],
        "flags": [],
        "defs": {
            "layers": [
                {
                    "identifier": "Entities",
                    "type": "Entities",
                    "uid": 2,
                    "doc": None,
                    "uiColor": None,
                    "gridSize": TILE,
                    "guideGridWid": 0,
                    "guideGridHei": 0,
                    "displayOpacity": 1,
                    "inactiveOpacity": 0.6,
                    "hideInList": False,
                    "hideFieldsWhenInactive": True,
                    "canSelectWhenInactive": True,
                    "renderInWorldView": True,
                    "pxOffsetX": 0,
                    "pxOffsetY": 0,
                    "parallaxFactorX": 0,
                    "parallaxFactorY": 0,
                    "parallaxScaling": True,
                    "autoRuleGroups": [],
                    "autoSourceLayerDefUid": None,
                    "tilesetDefUid": None,
                    "tilePivotX": 0,
                    "tilePivotY": 0,
                    "intGridValues": [],
                    "intGridValuesGroups": [],
                    "autoTilesKilledByOtherLayerUid": None,
                    "uiFilterTags": [],
                    "excludedTags": [],
                    "requiredTags": [],
                    "useAsyncRender": False,
                },
                {
                    "identifier": "Collision",
                    "type": "IntGrid",
                    "uid": 1,
                    "doc": "1 solid  2 destruct  3 slopeR",
                    "uiColor": None,
                    "gridSize": TILE,
                    "guideGridWid": 0,
                    "guideGridHei": 0,
                    "displayOpacity": 1,
                    "inactiveOpacity": 0.45,
                    "hideInList": False,
                    "hideFieldsWhenInactive": True,
                    "canSelectWhenInactive": True,
                    "renderInWorldView": True,
                    "pxOffsetX": 0,
                    "pxOffsetY": 0,
                    "parallaxFactorX": 0,
                    "parallaxFactorY": 0,
                    "parallaxScaling": True,
                    "autoRuleGroups": [],
                    "autoSourceLayerDefUid": None,
                    "tilesetDefUid": None,
                    "tilePivotX": 0,
                    "tilePivotY": 0,
                    "intGridValues": [
                        {"value": 1, "identifier": "Solid", "color": "#000000", "tile": None, "groupUid": 0},
                        {"value": 2, "identifier": "Destruct", "color": "#FF0000", "tile": None, "groupUid": 0},
                        {"value": 3, "identifier": "SlopeR", "color": "#AA66FF", "tile": None, "groupUid": 0},
                    ],
                    "intGridValuesGroups": [],
                    "autoTilesKilledByOtherLayerUid": None,
                    "uiFilterTags": [],
                    "excludedTags": [],
                    "requiredTags": [],
                    "useAsyncRender": False,
                },
            ],
            "entities": [
                def_ent("Player", 3, "#50E3C2", [0, 0]),
                def_ent("Knowl", 4, "#F8E71C", [0.5, 0.5]),
                def_ent("Crate", 5, "#924D1A", [0, 0]),
            ],
            "tilesets": [],
            "enums": [],
            "externalEnums": [],
            "levelFields": [],
        },
        "levels": [
            {
                "identifier": "PiskelCave",
                "iid": level_iid,
                "uid": 6,
                "worldX": 0,
                "worldY": 0,
                "worldDepth": 0,
                "pxWid": N * TILE,
                "pxHei": N * TILE,
                "__bgColor": "#0A0618",
                "bgColor": None,
                "useAutoIdentifier": False,
                "bgRelPath": None,
                "bgPos": None,
                "bgPivotX": 0.5,
                "bgPivotY": 0.5,
                "smartColor": "#50E3C2",
                "__smartColor": "#50E3C2",
                "fieldInstances": [],
                "layerInstances": [
                    {
                        "__identifier": "Entities",
                        "__type": "Entities",
                        "__cWid": N,
                        "__cHei": N,
                        "__gridSize": TILE,
                        "__opacity": 1,
                        "__pxTotalOffsetX": 0,
                        "__pxTotalOffsetY": 0,
                        "__tilesetDefUid": None,
                        "__tilesetRelPath": None,
                        "iid": ent_iid,
                        "levelId": 6,
                        "layerDefUid": 2,
                        "pxOffsetX": 0,
                        "pxOffsetY": 0,
                        "visible": True,
                        "optionalRules": [],
                        "intGridCsv": [],
                        "autoLayerTiles": [],
                        "seed": 1,
                        "overrideTilesetUid": None,
                        "gridTiles": [],
                        "entityInstances": ents,
                    },
                    {
                        "__identifier": "Collision",
                        "__type": "IntGrid",
                        "__cWid": N,
                        "__cHei": N,
                        "__gridSize": TILE,
                        "__opacity": 1,
                        "__pxTotalOffsetX": 0,
                        "__pxTotalOffsetY": 0,
                        "__tilesetDefUid": None,
                        "__tilesetRelPath": None,
                        "iid": coll_iid,
                        "levelId": 6,
                        "layerDefUid": 1,
                        "pxOffsetX": 0,
                        "pxOffsetY": 0,
                        "visible": True,
                        "optionalRules": [],
                        "intGridCsv": csv,
                        "autoLayerTiles": [],
                        "seed": 1,
                        "overrideTilesetUid": None,
                        "gridTiles": [],
                        "entityInstances": [],
                    },
                ],
                "__neighbours": [],
            }
        ],
        "worlds": [],
        "dummyWorldIid": iid(),
    }
    path.write_text(json.dumps(ldtk, separators=(",", ":")), encoding="utf-8")


def write_tmj(data: dict, path: Path) -> None:
    tiles = []
    g = data["_grid"]
    for y in range(N):
        for x in range(N):
            ch = g[y, x]
            tiles.append(1 if ch == "K" else (2 if ch == "R" else (3 if ch == "S" else 0)))
    objects = []
    oid = 1
    objects.append({
        "id": oid, "name": "player", "type": "player",
        "x": data["spawn"]["c"] * TILE, "y": data["spawn"]["r"] * TILE,
        "width": TILE, "height": TILE, "rotation": 0, "visible": True,
    })
    oid += 1
    for k in data["knowls"]:
        objects.append({
            "id": oid, "name": "knowl", "type": "knowl",
            "x": k["c"] * TILE, "y": k["r"] * TILE,
            "width": 8, "height": 8, "rotation": 0, "visible": True,
        })
        oid += 1
    objects.append({
        "id": oid, "name": "crate", "type": "crate",
        "x": data["crate"]["c"] * TILE, "y": data["crate"]["r"] * TILE,
        "width": TILE, "height": TILE, "rotation": 0, "visible": True,
    })
    tmj = {
        "compressionlevel": -1,
        "height": N,
        "width": N,
        "infinite": False,
        "orientation": "orthogonal",
        "renderorder": "right-down",
        "tiledversion": "1.10.2",
        "tileheight": TILE,
        "tilewidth": TILE,
        "type": "map",
        "version": "1.10",
        "nextobjectid": oid + 1,
        "nextlayerid": 3,
        "layers": [
            {
                "id": 1, "name": "collision", "type": "tilelayer",
                "width": N, "height": N, "x": 0, "y": 0,
                "opacity": 1, "visible": True,
                "data": tiles,
            },
            {
                "id": 2, "name": "objects", "type": "objectgroup",
                "x": 0, "y": 0, "opacity": 1, "visible": True,
                "draworder": "topdown",
                "objects": objects,
            },
        ],
    }
    path.write_text(json.dumps(tmj, separators=(",", ":")), encoding="utf-8")


def write_js(data: dict, path: Path) -> None:
    payload = {k: v for k, v in data.items() if k != "_grid"}
    path.write_text(
        "/* generated by scripts/extract-piskel-cave.py — do not hand-edit */\n"
        "window.MV_SKETCH_CAVE = "
        + json.dumps(payload, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )


def main() -> None:
    grid = extract_grid()
    yellows = [b for b in components(grid, "Y") if len(b) >= 3]
    reds_raw = [b for b in components(grid, "R") if len(b) >= 4]
    cyans = components(grid, "C")
    browns = components(grid, "N")
    if not cyans:
        raise SystemExit("no cyan spawn found")
    if not browns:
        raise SystemExit("no brown crate found")

    knowls = []
    for blob in yellows:
        c, r = centroid(blob)
        knowls.append({"c": c, "r": r})
    knowls.sort(key=lambda k: (k["r"], k["c"]))

    reds = []
    for blob in reds_raw:
        c, r, w, h = bbox(blob)
        movable = h >= 6 and w >= 6
        reds.append({"c": c, "r": r, "w": w, "h": h, "movable": movable})

    spawn_c, spawn_r = centroid(max(cyans, key=len))
    crate_c, crate_r = centroid(max(browns, key=len))

    # markers are air in the collision grid
    for y in range(N):
        for x in range(N):
            if grid[y, x] in ("Y", "C", "N"):
                grid[y, x] = "W"

    slopes = detect_slopes(grid)
    # screenshot stairs come out as short runs; stitch into one SLOPE_R
    if slopes:
        slopes = [{"c": 97, "r": 198, "n": 48, "kind": "R"}]
        for y in range(N):
            for x in range(N):
                if grid[y, x] == "S":
                    grid[y, x] = "K"
        sl = slopes[0]
        for i in range(sl["n"]):
            c, r = sl["c"] + i, sl["r"] - i
            if 0 <= c < N and 0 <= r < N:
                grid[r, c] = "S"

    # brown in the isolated SE alcove was lost to JPEG/UI crop — carve it back
    alcove = {"c": 212, "r": 208, "w": 26, "h": 24}
    for y in range(alcove["r"], alcove["r"] + alcove["h"]):
        for x in range(alcove["c"], alcove["c"] + alcove["w"]):
            if 0 <= x < N and 0 <= y < N and grid[y, x] == "K":
                grid[y, x] = "W"
    # shaft from the east corridor down into the alcove
    for y in range(200, alcove["r"] + 1):
        for x in range(220, 228):
            if grid[y, x] == "K":
                grid[y, x] = "W"
    crate_c, crate_r = 224, 229

    # thin screenshot-blurred red gates so they read as doors, not slabs
    for rd in reds:
        if not rd["movable"] and rd["h"] > 2:
            rd["r"] = rd["r"] + rd["h"] - 2
            rd["h"] = 2

    solids = greedy_solids(grid)

    data = {
        "w": N,
        "h": N,
        "tile": TILE,
        "source": "piskel-256-screenshot",
        "solids": solids,
        "slopes": slopes,
        "reds": reds,
        "knowls": knowls,
        "spawn": {"c": spawn_c, "r": spawn_r},
        "crate": {"c": crate_c, "r": crate_r},
        "alcove": alcove,
        "_grid": grid,
    }

    OUT.mkdir(parents=True, exist_ok=True)
    png = OUT / "piskel-cave.png"
    save_png(grid, png)
    stamp_markers(png, knowls, data["spawn"], data["crate"], reds)
    (OUT / "piskel-cave.json").write_text(
        json.dumps({k: v for k, v in data.items() if k != "_grid"}, indent=2),
        encoding="utf-8",
    )
    write_js(data, JS_OUT)
    write_ldtk(data, OUT / "piskel-cave.ldtk")
    write_tmj(data, OUT / "piskel-cave.tmj")

    print("knowls", len(knowls), knowls)
    print("reds", reds)
    print("spawn", data["spawn"], "crate", data["crate"])
    print("slopes", slopes)
    print("solid rects", len(solids))
    print("wrote", png, JS_OUT)


if __name__ == "__main__":
    main()
