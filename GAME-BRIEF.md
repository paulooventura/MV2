# Mind & Venture — game brief & movement reference

**Hand this file to ChatGPT, Gemini, or any collaborator** for full context on what the game is, where development stands, and how movement/collision is coded.

Last updated: **build 106** · `main`  
Repo: https://github.com/paulooventura/Mind-and-Venture  
Play (GitHub Pages): https://paulooventura.github.io/Mind-and-Venture/?debug=1  
Custom domain: https://mindandventure.pauloventura.org/?debug=1  
Local: double-click `PLAY.bat` → http://127.0.0.1:8765/?debug=1

---

## 1. What the game is

**Mind & Venture (MV2)** is a browser-based 2D platformer by Paulo Ventura.

- **Protagonist:** A sentient studio monitor on a wheel, with cable “connector arms.”
- **Setting:** **Awdjoo Town** — first campaign map loaded from Tiled (`assets/Awdjoo/Awdjoo.json`).
- **Items / gear:** TRS, RCA (grappling hook), XLR, MAG — audio-studio themed tools.
- **Tech:** Vanilla JS modules (no bundler), canvas renderer, PWA service worker, Tiled map pipeline.
- **Entry point:** `index.html` loads scripts in order; all logic lives under `js/`.

---

## 2. Where we stand (June 2026)

| Area | Status |
|------|--------|
| **Build** | **106** (`window.MV_BUILD`, script `?v=106`, SW cache `mv-web-v106`) |
| **Movement tuning** | `MOVE_BUILD=48` in `js/physics.js` |
| **Campaign** | Awdjoo zone 0: spawn House 2 → basement RCA → exit House 5 east |
| **Recent engineering** | Mario World–style solid rules for omniblocks; fix wall phasing; seamless walk on block tops |
| **QA** | Headless Playwright self-test (`npm run selftest`, `AUTO-TEST.bat`) |
| **Deploy** | GitHub Actions workflow `.github/workflows/pages.yml` on push to `main` |
| **Deploy caveat** | Pages source must be **GitHub Actions**, not legacy `gh-pages` branch (stuck on build 95) |

### Known issues / open work

- Omniblock top walking was sticking at speed 0 when vertical stack sides collided with body — addressed in builds 99–105 with column-side skip + `_marioWalkFree`.
- Tiled **KEEP OUT!** polygons trace omniblock columns and duplicate collision faces; code skips via `_marioSkipKeepOut`.
- Self-test still reports `stuckWalking` in east corridor (~x=1180) — may be map geometry / KEEP OUT at x≈1248.
- Custom domain CNAME occasionally drops from GitHub Pages settings → 404 until reconfigured.

---

## 3. Campaign flow (Awdjoo)

From `js/awdjoo_level.js`:

1. **Spawn:** House 2 — column 31, row 72.
2. **RCA pickup:** House 2 basement — Tiled object id 16 at (240, 680); guaranteed via `_ensureAwdjooRcaPickup()`.
3. **Goal:** East side of House 5 — column 97, row 72 (`GOALPL` exit gate).
4. **Progression:** Collect knowls → goal opens → reach exit to advance.

---

## 4. Controls

| Input | Action |
|-------|--------|
| WASD / arrows / left stick | Move + aim |
| Space / Jump button | Jump |
| S / down | Duck |
| E | Use item |
| Q | Swap item |
| F | Punch |
| Shift (grounded) | Sprint → run ramp toward `MOVE_RUN` |

On-screen Switch-style gamepad in `index.html` for mobile/touch.

---

## 5. Code module map

| File | Role |
|------|------|
| `js/core.js` | Globals, constants, canvas, input/keymap |
| `js/save.js` | localStorage save/load |
| `js/audio.js` | SFX + music |
| `js/player.js` | Player factory, **`_updatePlayerMoveX`**, jump, hook, arms |
| `js/physics.js` | **All movement constants**, collision, SMW solids, camera, ropes |
| `js/weapons.js` | Items, RCA grappling hook |
| `js/enemies.js` | Enemy AI, mind-enemy, BWALLS/CRATES |
| `js/render.js` | Drawing |
| `js/ui.js` | HUD, menus, on-screen build line |
| `js/main.js` | Game loop, `_moveBlocked` / `_grindF` after movement |
| `js/spawn_fix.js` | Tiled spawn resolution |
| `js/awdjoo_level.js` | Awdjoo campaign config |
| `js/awdjoo_map.js` | Generated embedded map (from `assets/Awdjoo/Awdjoo.json`) |
| `js/selftest.js` | Headless QA (`?selftest=1`) |
| `js/healthwatch.js` | Glitch sentinel → `window.__MV_HEALTH` |

---

## 6. Movement constants (`js/physics.js`)

These are the live tuning knobs. Change here first for “feel” work.

```javascript
const GRAV=0.52, FRIC=0.88, GROUND_FRIC=0.52, RUN_COAST_FRIC=0.86, AIR_DRIFT=0.96;
const MOVE_BUILD=48;
const MOVE_WALK=10.5;      // base walk speed cap
const MOVE_PEAK=1.0;       // walk cap multiplier at full movePower
const MOVE_RUN=16.5;       // sprint cap (after runRamp fills)
const MOVE_ACCEL=0.52;     // ground accel (walk)
const MOVE_RUN_ACCEL=0.62; // ground accel (sprint)
const MOVE_AIR=0.42;
const MOVE_POWER=0.028;    // movePower ramp per frame while holding dir
const MOVE_TORQUE=1.45;    // extra accel when below cap (Mario-style build-up)
const MOVE_STOP=0.62;      // release decel on flat ground
const MOVE_TURN=2.1;       // reverse / skid multiplier
const MOVE_RUN_RAMP=0.10;  // sprint ramp fill per frame

// Wheel / slope
const WHEEL_GRIP_BASE=0.91;
const WHEEL_ROLL_RESIST=0.011;
const WHEEL_DRIVE_TORQUE=0.68;
const WHEEL_COAST_FRIC=0.987;  // release decel on slopes
const WHEEL_GRADE_RESIST=0.38;

// Jump
const JI=-3.0, JHH=0.40, JMH=22, JMX=-11.0;

// Body / wheel (movement hitbox)
const SW=64, SH=96;           // sprite footprint
const FEET_OFF=88;            // feet Y from pl.y
const WHEEL_R=20;
const FEET_L=SW/2-WHEEL_R;    // feet span for ground tests
const FEET_W=WHEEL_R*2;
const BODY_W=52, BODY_H=42;

// Collision (SMW)
const MARIO_TOP_LO=14, MARIO_TOP_HI=16;  // feet band on block top
const MARIO_SIDE_FACE=10;
const MARIO_SEAM=26;          // horizontal overlap to count “on top”
const GROUND_SINK_MAX=2;
const COLL_MOVE_STEP=4;       // sub-step size for _movePlayerWithColl
```

**Design intent:** Mario-like ground accel + turn skid + release decel, with Sonic-ish momentum carry on direction change (vx multiplied by 0.55 flat / 0.75 slope instead of zeroing). Sprint ramps walk → run over ~10 frames via `pl.runRamp`.

---

## 7. Horizontal movement algorithm (`js/player.js` → `_updatePlayerMoveX`)

Called each frame for player `p` when not hooked, not wall-gripping, not in shutdown.

### Early exits (anti-stick / anti-grind)

```javascript
if(pl._moveBlocked && dir && !_marioOnAnyTop(pl)) { pl.vx=0; return; }
if((pl._grindF||0) >= 8 && dir && !_marioOnAnyTop(pl)) { pl.vx=0; return; }
if(pushIntoWall && (pl._grindF||0) >= 2 && !_marioOnAnyTop(pl)) { pl.vx=0; return; }
```

**`_marioWalkFree(pl)`** (= `_marioOnAnyTop`) bypasses grind freeze when feet are on an omniblock/platform top — key fix for seamless block-top walking.

### No input (release)

- **Flat ground:** `vx *= MOVE_STOP` (0.62), zero below 0.22.
- **Slope:** `vx *= WHEEL_COAST_FRIC` (0.987), zero below 0.06.
- **Air:** `vx *= AIR_DRIFT` (0.96).

### Direction change

- Sets `pl._moveDir`, preserves momentum: `vx *= 0.55` (flat) or `0.75` (slope).
- Resets `movePower` to 0.45 / 0.6 so turn still has punch via `MOVE_TURN`.

### Acceleration & cap

- **Sprint (Shift, grounded):** `cap = MOVE_WALK + (MOVE_RUN - MOVE_WALK) * runRamp`.
- **Walk:** ease `movePower` with quadratic curve → cap ≈ `MOVE_WALK * MOVE_PEAK`.
- **Torque:** below cap, accel boosted by `MOVE_TORQUE * (1-ratio)²` (stronger push when slow).
- **Slope drive:** if moving uphill into grade, extra `WHEEL_DRIVE_TORQUE`; downhill slight boost from `momentum`.
- **Turning:** if velocity opposes input, apply `accel * MOVE_TURN` (1.35× on slopes).
- Clamp to ±cap; if pushing into wall, clamp vx to not penetrate.

---

## 8. Collision & movement integration

### Multi-step move (`_movePlayerWithColl`)

```javascript
function _movePlayerWithColl(pl, vx, vy) {
  // Sub-steps: stepSz=2 when fast, else COLL_MOVE_STEP=4
  // Each step: x += sx → resolveBodyX → y += sy → resolvePlatY
  // Then: _haltVelocityAtContacts, _haltBlockedMove, _cornerStepResolve, _marioEjectFromSolids
}
```

### SMW solid model (one rule set for omniblocks, tile boxes, crates)

| Face | Rule |
|------|------|
| **TOP** | Walkable; `_marioOnTop`, `_marioSnapWalkTop` |
| **SIDE** | Wall only when feet beside face; `_marioResolveSideX`, gated by `_marioSkipSide` |
| **BOTTOM** | Ceiling bonk when rising; `_marioBonkCeiling` |
| **DESTROYED** | Air; `_marioGone(box)` when `hp <= 0` |

### Key SMW helpers (`js/physics.js`)

```javascript
_marioOnTop(pl, box, seam)     // feet span overlaps top + feet in [top-14, top+16]
_marioOnAnyTop(pl)             // true on any BWALL or solid plat top
_marioWalkFree(pl)             // same as onAnyTop — disables grind stick on tops
_marioSkipSide(pl, box)        // skip side hit if on top, same column, or standing on plat
_marioResolveSideX(pl, box)    // push out of side; zero vx into wall
_marioSnapWalkTop(pl, box)     // snap Y to walk surface, set og=true
_marioBonkCeiling(pl, box)     // head hit from below
_marioLedgeSlide(pl, input)    // nudge past ledge in walk direction (steps 2–24px)
_marioSkipKeepOut(pl, seg)     // skip KEEP OUT barrier segs when on omniblock column top
_bwallFloorExteriorFace(box,d) // skip interior seams between same-row blocks
_marioEjectFromSolids(pl)      // safety push-out after move (must not eject from column top)
```

### KEEP OUT vs omniblocks

Tiled **KEEP OUT!** layer draws collision hulls *through* omniblock stacks. That duplicates vertical faces already in `BWALLS`. When the player’s feet are on a block top in that column, `_marioSkipKeepOut` ignores those barrier segments so walking across the top stays smooth.

### Post-move blocked / grind (`js/main.js`)

After `_movePlayerWithColl`, if horizontal input but little displacement:

1. Try `_marioLedgeSlide` (omniblock tops).
2. Else try `_cornerStepResolve`.
3. Else set `_moveBlocked=true`, increment `_grindF` (caps at 12).
4. Successful move clears `_grindF` and `_moveBlocked`.

`_updatePlayerMoveX` reads these flags to zero velocity when grinding into walls — **except** on block tops via `_marioWalkFree`.

---

## 9. Player dimensions (for collision reasoning)

```
pl.y                          → sprite anchor (top-left of 64×96 box)
pl.y + FEET_OFF (88)          → feet Y
pl.x + FEET_L … FEET_L+FEET_W → wheel / feet span (40px wide, centered)
playerCoreHB(pl)              → body AABB for side collision
WHEEL_R=20                    → wheel radius for slope / support tests
```

Grounded = `pl.og` (on ground flag), set by `resolvePlatY` / snap helpers.

---

## 10. How to run locally

```powershell
git clone https://github.com/paulooventura/Mind-and-Venture.git
cd Mind-and-Venture
npm install
npx playwright install chromium   # for selftest only
npm run selftest                    # or AUTO-TEST.bat on Windows
```

Serve over HTTP (not `file://`). Local dev typically uses port **8765** (`PLAY.bat` if present).

**Current machine note:** If `Downloads\Mind and Venture` is empty, the working clone may be at  
`C:\Users\PVProductions\AppData\Local\Temp\mv-pages-check\` — re-clone into Downloads for a permanent copy.

---

## 11. What to play-test

1. **Walls:** Cannot phase through omniblocks / tile solids.
2. **Block tops:** Walk across stacked omniblocks (House 2 area) without speed dropping to 0.
3. **Slopes:** Wheel coast and uphill drive feel natural.
4. **Sprint:** Shift ramps to run speed without instant snap.
5. **RCA:** Pick up in basement, grapple works.
6. **HUD:** After load, `#mvVer` should show `build 106 | MOVE v48 | speed …`.
7. **Debug overlay:** `?debug=1` or **` (backquote) in-game.

## 12. Related files (if they need more depth)

| Need | Open |
|------|------|
| Agent / CI workflow | `AGENTS.md` |
| Full physics source | `js/physics.js` |
| Movement input → vx | `js/player.js` (`_updatePlayerMoveX`) |
| Blocked-move gates | `js/main.js` (~line 990+) |
| Map source | `assets/Awdjoo/Awdjoo.json` |
| Title / pitch art | `assets/story/title-key-art.png` |

---

*End of handoff document.*
