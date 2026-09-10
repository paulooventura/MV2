# Mind & Venture (MV2) — collaborator brief

Hand this file to **Claude** (or any collaborator) with the repo. It is the
current picture of the game, not a wish list. Read `AGENTS.md` next for the
module map and QA loop.

**Last updated:** build **158** · `MOVE_BUILD` **59** · SHA `9b0fb3b` · 2026-09-09  
**Repo:** https://github.com/paulooventura/MV2 · branch `main`  
**Play:** https://paulooventura.github.io/MV2/  
**Local:** `PLAY.bat` once → `http://127.0.0.1:8765/` (HTTP only, never `file://`)  
**Author / director:** Paulo Ventura (Wall). Agents implement; Wall keeps
creative and “promote this to Awdjoo” calls.

---

## 1. What this game is

Browser 2D platformer. Vanilla JS modules, no bundler, canvas, PWA.

**Heroes:** Mind (purple, wide hat) and Venture (same black hat as Mind, **back
brim only** — a laid-down **P**, not a red cap). They are sentient studio
monitors on a **wheel**, with cable **connector arms**.

**Feel target:** Mario ground punch + Sonic wheel momentum. The wheel is the
character. If they wedge, **the collision grid is wrong** — do not tune `vx`
to hide it.

**Tone:** analog-studio folklore. Items are jacks. Collectibles are **Knowls**
(seeds of a sacred tree). The villain is **Tradzkul**.

---

## 2. Lore (canonical story cards)

Source: `js/ui.js` → `STORY_PAGES`. Art: `assets/story/story-1.png` … `story-5.png`.

1. **Sonnata: peace in Awdjoo.** A family in Awdjoo Town protects a secret: the
   sacred **Knowl tree** in their basement.
2. **The invasion.** **Tradzkul** and his minions search the house for the tree.
3. **Shutdown.** The elders block the basement. Minions shut them down. Tradzkul
   knocks the siblings unconscious.
4. **Kidnapped.** Tradzkul takes the elders and vanishes. Mind and Venture wake
   and run into the street.
5. **The journey begins.** Neighbor **Laitu** warns they are gone to Tradzkul’s
   lair. Knowl seeds mark the path:

| Order | Zone (`js/audio.js` `ZONES`) | Note |
|-------|------------------------------|------|
| 0 | **Awdjoo Town** — bucolic village | **Only this map is playable in the live game** |
| 1 | Gauder Hills — pampas slopes |
| 2 | Knowl’s Secret Garden — deep forest |
| 3 | Corali Cavern — crystals & water |
| 4 | Alitek Factory — machines & circuits |
| 5 | Tradzkul’s Lair — sinister castle |

Knowls are the breadcrumb and the unlock: collect them → exit opens.

---

## 3. How far we’ve got (honest)

### Live game (slot A) — do not break this

Awdjoo Town from Tiled (`assets/Awdjoo/Awdjoo.json` → generated `js/awdjoo_map.js`).

- Spawn **House 2** (col 31, row 72). Tiled tiles are **8px**, world scale **4**
  → 32px world tiles.
- **RCA** guaranteed in House 2 basement (col 30, row 85).
- Exit **House 5 east** (col 97). Knowls open the gate.
- House 1 roof: one mind-enemy on the slope crest (laser only).
- Basement **Knowl tree**. Moving island + mind shapes (circle / square).
- **1P story:** the other sibling is `_aiCompanion` — stays near, shoots TRS,
  helps when the lead is hurt. Select copy: “ALLY JOINS YOU”.
- Gamepad: **A jump · X item action · Y item select · B punch** (`js/save.js`
  `BIND_LABELS`). Keyboard still Space / Q / E / F.
- Selftest **PASS** on build 160 (`npm run selftest` / `selftest:quick`).
- Story ally: `flashF` now decays on `p2` so the sprite no longer vanishes after the first TRS shot.

### Labs — experiments, not the campaign

Never replace Awdjoo until Wall says **promote**.

| Slot | Page | What |
|------|------|------|
| A | `index.html?ab=a` | Live Awdjoo |
| B | `clean-collision-core.html?ab=b` | Clean collision |
| C | `item-lab.html?ab=c` | Jack / box sprites, standard vs enhanced |
| D | `physics-lab.html?ab=d` | Slopes, coast, pass-ramps, omniblock door |
| E | `sketch-lab.html?ab=e` | Piskel 256 cave sketch (screenshot extract) |
| F | `ldtk-lab.html?ab=f` | LDtk → typed grid (promote-later path; not live) |

### Not done / do not pretend it is

- Zones 1–5 have **names and music only**. No campaign maps yet.
- **LDtk is not the live pipeline.** Live maps are **Tiled**. Lab **F**
  (`ldtk-lab.html?ab=f`, `js/ldtk_loader.js`) is the promote-later path.
  Lab E still has a generated `.ldtk` / `.tmj` under `assets/sketches/` from
  a Piskel screenshot (different IntGrid; do not reuse it as the identity map).
- Companion can still **overlap** the lead (pool resolve is player-only;
  leash/respawn needs work). Wall wants: never disappear, never occupy the same
  body as the player. Vanish-after-first-shot was a stuck `p2.flashF` flicker
  (fixed in build 160).
- RCA hook should latch **blocks, enemies, moving objects** and pull by **mass**
  (light object comes to you; wall yanks you). Current hook mostly moves the
  player; home bwalls are skipped until shoved.
- Lab E first extract was glitchy (1-tile stair lips). Build 158 cleaned it;
  it is still a **sketch**, not Corali Cavern.

---

## 4. Wall’s expectations (non-negotiable)

1. **A stays A.** New ideas get a new lab letter. Promote only when asked.
2. **Grid owns collision.** Types: `0 AIR, 1 SOLID, 2 ONEWAY, 3 DESTRUCT,
   4 SLOPE_L, 5 SLOPE_R` (`js/collision_grid.js`). KEEP OUT polygons are
   discarded. Player move: `gridResolvePlayer`.
3. **Feel knobs live at the top of `js/physics.js`** and `_updatePlayerMoveX`
   in `js/player.js`. Don’t sprinkle magic numbers in `main.js`.
4. **QA is headless.** `npm run selftest`. Do not ask Wall to paste F12 reports.
   Physics work is not done until PASS. Bump `window.MV_BUILD` + `sw.js` `CACHE`.
5. **One play tab.** Never open Simple Browser / extra `PLAY.bat` / a second
   `python -m http.server` on `:8765`. Hidden tabs keep playing BGM.
   Agents use selftest. Port busy: `scripts/stop-play.ps1`.
6. **Art direction:** jacks look like real studio plugs (black/grey, gold TRS/RCA
   tips). Enhanced (+) items get full-body green veins. Venture hat is **black
   like Mind**, back brim only. Mind stays purple; Venture’s accent is red in
   FX, not a red cap.
7. **Commit + push `main`** after substantive game work. Pages deploys from
   `main`. No force-push, no secrets, no `.vs/`.

---

## 5. Physics (current numbers)

File: `js/physics.js`. Comment there is the source of truth if this drifts.

```javascript
const GRAV=0.52;
const MOVE_BUILD=59;
const MOVE_WALK=10.5;
const MOVE_RUN=12.4;
const MOVE_ACCEL=0.40;
const MOVE_RUN_ACCEL=0.46;
const MOVE_AIR=0.42;
const MOVE_POWER=0.020;
const MOVE_TORQUE=0.38;
const MOVE_STOP=0.91;          // release on flat — coast, don't slam the brakes
const MOVE_RUN_COAST=0.958;
const MOVE_TURN=1.45;
const MOVE_RUN_RAMP=0.05;
const WHEEL_GRIP_BASE=0.91;
const WHEEL_DRIVE_TORQUE=0.92;
const WHEEL_COAST_FRIC=0.987;
const WHEEL_GRADE_RESIST=0.34;
const WHEEL_SLOPE_COMMIT=0.40;
const WHEEL_SLOPE_GRAV=0.82;
const WHEEL_SLOPE_DRAG=0.0006;  // downhill terminal — not a hard clamp
const WHEEL_UPHILL_DRAG=1.85;
const WHEEL_UPHILL_RUN_RELIEF=0.48;
const JI=-3.0, JHH=0.40, JMH=22, JMX=-11.0;

const SW=64, SH=96;            // sprite box
const FEET_OFF=88;             // feet Y from pl.y
const WHEEL_R=20;
const STAND_H=70, DUCK_H=40;
```

**Wheel on slopes (recent intent, builds 147–154):**

- Height-map slopes, not per-tile stairs.
- Uphill is slower; release **coasts**, does not brake.
- Downhill rolls onto flat. Crest should not stick.
- Cabinet stays upright on slopes. Don’t duck into walls/boxes.

**Boxes / MAG (150–154):**

- Squares sit on a face, tumble like dice from the jack tip.
- MAG face-glues to the tip, holds one target, does not shove the player,
  clings to surfaces, throws with arm swing.
- Movers bounce instead of overlapping.

**Hook / rope** (`js/player.js` `updateHook`, `js/physics.js` `_hookRayHit`):

- Latch grid solids + moved bwalls + enemies + some plats.
- Reel in/out. Verlet visual cord.
- Mass-split pull is **desired**, not shipped.

---

## 6. Items (audio jacks)

`ITEM`: `-1 none · 0 TRS · 1 RCA · 2 XLR · 3 MAG`

| Item | Color | What it does |
|------|--------|----------------|
| **TRS** | gold `#d4aa40` | Charge beam (X/Q). Enhanced: longer purple bolt, sparks, recoil |
| **RCA** | orange `#e87820` | Grappling hook. Reel W/S. Jump off walls |
| **XLR** | silver `#c8cdd4` | Push enemies / shots / blocks |
| **MAG** | red `#e02028` | Pull one target to the tip |

Standard vs **enhanced (+)** boxes: `assets/items/mv2-item-boxes-standard-enhanced.png`  
Held jacks: `assets/items/mv2-held-jacks-standard-enhanced.png`  
Drawn in `js/render.js`. Lab **C** is the sandbox.

---

## 7. Sprites & art (where to look)

Do not invent a new tilesheet if these exist.

| Path | What |
|------|------|
| `assets/Awdjoo/MV2 tilesheet.png` | Live Awdjoo terrain (synced into map folder) |
| `assets/Awdjoo/omniblock.png` | Red push/break blocks |
| `assets/Awdjoo/spawn spots.png` | Spawn / marker tiles |
| `assets/Awdjoo/Awdjoo.json` | **Source of truth** Tiled map (then `sync-awdjoo-map` → `js/awdjoo_map.js`) |
| `assets/home baked sprites/material/` | dirt, grass, brick, slopes, push/pull/omniblock, Aseprite sources |
| `assets/home baked sprites/sine/SINE.png` | Sine enemy |
| `assets/home baked sprites/square/Squarrow.png` | Square |
| `assets/home baked sprites/triangle/tryngole.png` | Triangle |
| `assets/home baked sprites/noise/saltooph.png` | Noise / saltooph |
| `assets/enemies/signol.png` | Signol rival |
| `assets/backgrounds/awdjoo/layer1.png` … `layer4.png` + `clouds.png` | Parallax (`bgset` on the Tiled map) |
| `assets/story/title-key-art.png` + `title-frame-00.png`…`11` | Title |
| `assets/story/story-1.png` … `story-5.png` | Story pages |
| `assets/sketches/piskel-cave.png` | Lab E classified 256 sketch |
| `assets/SFX/` | Jump, hit, knowl, grapple, shutdown |
| `assets/bgm/` + `assets/new music/` | OST — chill for title/story; one dynamic track per zone (`ZONE_MUSIC_TRACKS` in `js/audio.js`) |

**Soundtrack map (build 160):**

| Slot | Track |
|------|-------|
| Title (chill pool) | Crystal Memory Gate · Temple Canopy Drift · Lost Save Shrine Diam |
| Story (chill pool) | Lost Save Shrine Story · Underground Crown Plat · Lost Save Shrine Diam |
| Zone 0 Awdjoo | Canopy Quest Gold |
| Zone 1 Gauder Hills | Cartridge Cannon Bronze |
| Zone 2 Secret Garden | Underground Crown Gold |
| Zone 3 Corali Cavern | Crystal Cavern Drift Gold |
| Zone 4 Alitek Factory | Cache Fever Gold |
| Zone 5 Tradzkul’s Lair | Pixel Quasar Gold Boss |

Characters (Mind / Venture / wheel / hats) are **drawn in code** in
`js/render.js`, not a sprite sheet. `_drawVentureCap` is the hat rule.

---

## 8. Maps

### Live: Tiled Awdjoo

- Edit `assets/Awdjoo/Awdjoo.json` in Tiled (8px tiles).
- Collision is the **typed grid** built from tiles / solids, not KEEP OUT.
- Destruct / omniblock layers become `BWALLS`.
- Spawns: `js/spawn_fix.js` (player, mind, RCA, knowls, enemies).
- After map edits, regenerate `js/awdjoo_map.js` with the repo sync script
  (do not hand-edit the generated file).

### Sketch: Piskel color key (lab E, and any future sketch)

| Hex | Meaning |
|-----|---------|
| `#000000` | Solid |
| `#ffffff` | Air |
| `#ff0000` | Breakable / door (thin = drop-through floor with a gap; thick = one shoveable slab) |
| `#f8e71c` | Knowl |
| `#50e3c2` | Player spawn |
| `#924d1a` | Crate / special |
| Purple (if drawn) | Slope |

Extract: `scripts/extract-piskel-cave.py` → `assets/sketches/` + `js/sketch_map.js`.
A **clean 256×256 PNG export from Piskel** beats a UI screenshot.

### LDtk

Wanted later as an authoring tool. **Not wired into `initWorld`.** Lab F
(`js/ldtk_loader.js`, `ldtk-lab.html?ab=f`) loads a sample
`assets/sketches/ldtk-lab.ldtk`. Identity IntGrid map (explicit, warn on
unknown — there is **no hazard**):

`1 SOLID · 2 ONEWAY · 3 DESTRUCT · 4 SLOPE_L · 5 SLOPE_R`

Do not replace `applyTmjMap` until Wall promotes it.

---

## 9. Controls

| Keyboard | Pad | Action |
|----------|-----|--------|
| WASD / arrows | Stick | Move / aim |
| Space | **A** | Jump |
| Q | **X** | Item action (charge / fire / hook) |
| E | **Y** | Cycle item |
| F | **B** | Punch |
| Shift (grounded) | Sprint bind | Run ramp toward `MOVE_RUN` |
| S / down | Down | Duck |

---

## 10. Code map (short)

Full table: `AGENTS.md`. To change one system, open one file.

| File | Open this for |
|------|----------------|
| `js/physics.js` | Feel constants, wheel, hook ray, camera |
| `js/player.js` | `mkP`, `_updatePlayerMoveX`, jump, hook, companion AI, item unlock |
| `js/collision_grid.js` | Tile types + X-then-Y resolver |
| `js/weapons.js` | TRS/RCA/XLR/MAG, bwalls, knowl pickup, crates |
| `js/enemies.js` | Mind shapes, minions, Signol, spawn-from-map |
| `js/render.js` | All drawing, hats, jacks, knowls |
| `js/main.js` | Loop, `initWorld`, Awdjoo boot |
| `js/awdjoo_level.js` | House 2 / basement RCA / House 5 exit |
| `js/sketch_lab.js` | Lab E only |

`index.html` is a loader. Cache-bust `?v=` and `window.MV_BUILD` together.

---

## 11. How to verify

```bat
AUTO-TEST.bat
```

or `npm run selftest` (full) / `npm run selftest:quick` (~20–40s).

- Pass: `test-results/summary.txt` + exit 0.
- Play Awdjoo: https://paulooventura.github.io/MV2/  (hard-refresh after Pages)
- Play a lab: add `?ab=c` / `d` / `e` or use the A/B bar.

**Play-test Awdjoo:** walls don’t phase; House 2 roof lips step off; slope coast;
basement RCA; companion stays on screen and does not sit inside the player;
knowls open House 5.

---

## 12. What to send Claude

**Minimum:** this file + `AGENTS.md`.

**Better:** the git repo (or a zip of `js/`, `assets/Awdjoo/`, `assets/items/`,
`assets/story/`, `assets/sketches/`, `index.html`, `AGENTS.md`, this file).

**If they need pictures:** attach `assets/story/title-key-art.png`,
`assets/items/mv2-held-jacks-standard-enhanced.png`,
`assets/Awdjoo/MV2 tilesheet.png`, `assets/sketches/piskel-cave.png`.

**Paste this as the first message** (then attach the files):

```
You are working on Mind & Venture (MV2), Paulo Ventura's browser 2D
platformer. Read GAME-BRIEF.md and AGENTS.md before editing.

Live game is Awdjoo Town (slot A). Do not replace it with a lab.
Collision is the typed grid in js/collision_grid.js. Movement feel
is js/physics.js + _updatePlayerMoveX. QA = npm run selftest.
Characters are studio monitors on a wheel. Items are TRS/RCA/XLR/MAG.
Lore: Knowl tree, Tradzkul, path town → hills → garden → cavern →
factory → lair. Only town is mapped.

Current build 160 / MOVE 59. Open work: companion never overlap the lead;
RCA mass-based hook; later zones; LDtk loader is lab F, not live.

Do the task I give next. Stay in one module when you can.
```

---

*End of brief. If this file and `js/physics.js` disagree, trust the JS.*
