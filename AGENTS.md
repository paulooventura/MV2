# Mind & Venture (MV2) — agent instructions

Collaborator / Claude handoff: **`GAME-BRIEF.md`** (lore, physics, sprites, maps, how far we are). This file is the module map and QA loop.

## Module map (read this BEFORE grepping the whole tree)

Browser 2D platformer. `index.html` is a loader only — all logic is split into
focused modules in `js/`. To tweak one system, open one file. Don't read the
whole tree to "see what's up" — use this map.

| File | What lives here |
|------|-----------------|
| `js/core.js` | Globals, tunable constants, canvas, raw input/keymap |
| `js/save.js` | localStorage save/load |
| `js/audio.js` | SFX + music synth (`sfx()`) |
| `js/player.js` | Player factory `mkP()`, **horizontal movement `_updatePlayerMoveX`**, jump, hook control, connector-arm pose. **1P story:** the other sibling is `_aiCompanion` — stays near the lead, shoots, and helps when the lead is hurt. |
| `js/collision_grid.js` | **Typed tile grid + X-then-Y resolver** (AIR/SOLID/ONEWAY/DESTRUCT/SLOPE_L/SLOPE_R). KEEP OUT is discarded. |
| `js/physics.js` | Wheel/slope **feel** on top of the grid. `MOVE_*`/`WHEEL_*`/`GRAV`/`JI`. Player move goes through `gridResolvePlayer`. |
| `js/weapons.js` | Items TRS/RCA/XLR/MAG, **RCA grappling-hook**, rope pickup |
| `js/enemies.js` | Enemy AI, mind-enemy, body separation |
| `js/render.js` | All drawing (sprites, world, HUD shapes). Venture’s hat is **black like Mind’s**, back brim only (laid-down **P**) — not red. |
| `js/ui.js` | HUD, menus, on-screen version line |
| `js/editor.js` | In-browser stage editor |
| `js/spawn_fix.js` | Tiled object/tile spawn resolution (player/RCA/enemy) |
| `js/awdjoo_level.js` | Awdjoo campaign config + guaranteed basement RCA |
| `js/awdjoo_map.js` | **Generated** embedded Tiled map data (don't hand-edit; synced from `assets/Awdjoo/Awdjoo.json`) |
| `js/healthwatch.js` | In-game glitch sentinel → `window.__MV_HEALTH` |
| `js/main.js` | Game loop, `update()`/`draw()` orchestration, state machine |
| `js/ldtk_loader.js` | **F lab only:** LDtk → typed grid + entity handlers. Not live. |
| `js/selftest.js` | Headless QA bot (gated by `?selftest=1`) |

**Movement feel knobs** (where "Mario+Sonic flow" is tuned):
- `js/physics.js` top: `MOVE_WALK`, `MOVE_RUN`, `MOVE_ACCEL`, `MOVE_TORQUE`,
  `MOVE_STOP` (release decel), `MOVE_TURN` (skid/turn accel), `MOVE_RUN_RAMP`,
  `WHEEL_*` (slope grip/coast/torque), `GRAV`, `JI/JMH/JHH` (jump).
- `js/player.js` `_updatePlayerMoveX`: turn-slash, accel curve, cap easing.
- Collision/anti-stick gates are **gone** when the typed grid is active. If the player wedges, the grid/resolver is wrong — do not tune velocity.

## Automated QA (use this — do NOT ask the user to paste reports)

Physics / perf / spawn work is **not done** until the headless self-test passes.

### Run (no browser, no copy-paste)

```bat
AUTO-TEST.bat
```

Or:

```bash
npm install
npx playwright install chromium
npm run selftest
```

### Read results

- `test-results/latest.json` — full machine-readable report
- `test-results/summary.txt` — one-screen pass/fail
- Exit code **0** = PASS, **1** = FAIL

### Agent loop (no user in the middle)

1. `npm run selftest` (or read `test-results/latest.json` after user ran `AUTO-TEST.bat`)
2. If FAIL → fix from `violationCounts` + `samples`, bump build in `index.html` / `sw.js`, repeat step 1
3. If PASS → commit + push (see below)

**Never** ask the user to open F12 and paste `MV_SELFTEST_REPORT` when this pipeline exists.

Quick mode (~40s): `npm run selftest:quick`

**Always-on while you work:** `WATCH-TEST.bat` or `npm run selftest:watch` — re-runs tests when `js/` changes.

**In-game sentinel:** `healthwatch.js` logs glitches to `window.__MV_HEALTH` every session (agents read via selftest report `health` field).

**Demo level:** `demo_level.js` seeds 3 knowls, 2 mind-enemies, 1 minion, and an east exit when the map is sparse. Collect all knowls → exit opens → reach exit to advance.

Manual visual check only when needed: `PLAY.bat` **once** (opens **one** tab).
**Never** `python -m http.server 8765`, never Simple Browser to `:8765`, never
a second `PLAY.bat` while one is running — each tab plays its own BGM.
Port busy: `scripts/stop-play.ps1` then one PLAY. Agents: `npm run selftest`.

---

## A/B labs (do not get stuck)

Keep the **live game (A)** and any **experiment (B)** both playable. Never replace Awdjoo physics with a lab until Wall says promote.

| Slot | What | URL |
|------|------|-----|
| **A** | Live game (`index.html`): Claude's build 197 from `claude/` (via `<base href="claude/">`), promoted Oct 20 2026. Edit `claude/`. 1.2 water trial: `claude/play-1-2.html`. | `index.html` |
| **168** | Build 168 (was A): co-op/VS, water play, phone/PC fit (`beta/js/`). Kept until merged into `claude/`. `selftest:flow` runs here. | `awdjoo-168.html` |
| **B** | Clean collision lab | `clean-collision-core.html?ab=b` |
| **C** | Item sprite lab | `item-lab.html?ab=c` |
| **D** | Physics lab | `physics-lab.html?ab=d` |
| **E** | Piskel cave sketch (not Awdjoo) | `sketch-lab.html?ab=e` |
| **F** | LDtk loader lab (not Awdjoo) | `ldtk-lab.html?ab=f` |
| **G** | Classic Awdjoo (old main game, Tiled map; selftest runs here) | `awdjoo-classic.html?ab=g` |

The live game (A) loads its changed modules from `beta/js/` (core, main, physics, render, ui, weapons + `beta_*`, `console16`, `crt_room`, `sound16`) and the rest — including the controls in `player.js` / `save.js` — from shared `js/`. Levels: `assets/levels/awdjoo-beta.ldtk` (1.1), `awdjoo-1-2.ldtk` (1.2). Boot (`beta/js/beta_intro.js`): MMR splash → Paulo Ventura splash (mosaic-in) → title (Story Mode / Options) → story → 1.1. Esc / Start in a stage = pause (Resume game · Options · Exit); Esc / Start on the title = "Shut down?" → power-off screen. Tab restarts the current stage. Logos: `assets/splash/mmr-logo.jpg` (on white) and `assets/splash/paulo-ventura-logo.png` (fills the screen); `?lvl=1.1` / `?lvl=1.2` skips the intro. `awdjoo-beta.html` redirects to `index.html`. Menu QA: `npm run selftest:flow`.

Since build 164: the page is the canvas only (biggest 4:3 that fits the window; phone pads overlay the side bars and hide when a controller is used). On-screen button hints follow the last device used (`beta/js/beta_input.js` → `MV_INPUT.fmt('HOLD {item}')`: Q/SPACE/ESC on keyboard, X/A/START on pad). Taking a hit slows the stage music (`updateGameBgm` hook in `beta_audio.js`). Any button closes the item window. **Journeys** (`beta/js/beta_slots.js`): clearing 1.1 saves (localStorage `mv2.journeys`, 5 slots: stage, jacks, Isolator, per-stage memory, time); entering a new stage saves again. Once a save exists, Story Mode opens the Journeys screen (pick a journey / new journey; Delete · Copy · Paste). Game over = Retry stage · Main menu.

Since build 165: **Water play** (`beta/js/beta_waterplay.js`, on top of `beta_water.js`): MAG with the tip in water scoops 1 block (32×32 px of water), holding grows a circular mass up to 9 blocks; the grip follows the power (drips as it drains, all falls at 0%); letting go throws it. Thrown water pours into pools, spreads into puddles, shorts enemies. XLR under water blows an air pocket (1 → 9 blocks, power-capped) that pushes water/floaters out and keeps a speaker inside it dry; letting go makes it rise and pop. Pool levels move by exact volume (`w.baseRest`; `MV_BETA.waterVolume()`). Isolator = orange bubble around the speaker body only. **Rope:** while moving, the line between MIND and the flying hook latches on the first grabbable surface it sweeps through (`ropeSweepLatch` in `beta_feel.js`). **Phones:** the picture widens to the screen's shape (since build 166 on PC too: the window's shape at load, all of it visible) (`window.MV_VIEW_W` set in `index.html` before `beta/js/core.js` → `W`; height stays 768), CRT TV = CSS overlay `#phoneCrt` (no shader on phones), ABXY tracked per finger (`beta/js/beta_touch.js`): a thumb between X and A holds run + jump. Note: 1.1's pool is a revisit-tier entity; water tests run on 1.2.

The sticky **A/B** bar at the top of both pages is the switcher (`js/ab-switch.js`). New labs get a new letter/page — do not overwrite A.

---

## Auto commit & deploy

After completing substantive work in this repo, **commit and push to `main` without asking**.

1. `git status` / `git diff` — stage only task-related files
2. Concise commit message (why, not just what)
3. `git add` → `git commit` → `git push origin main`
4. Tell the user: commit hash, push OK, and that **GitHub Pages** (`https://mindandventure.pauloventura.org/`) deploys from `main` automatically

**Do not commit:** `.vs/`, `.cursor/`, IDE layout files, secrets, unrelated C# Unity experiments unless requested.

**Remote:** `https://github.com/paulooventura/MV2.git` · branch `main`
