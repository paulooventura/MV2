# Mind & Venture (MV2) — agent instructions

## Module map (read this BEFORE grepping the whole tree)

Browser 2D platformer. `index.html` is a loader only — all logic is split into
focused modules in `js/`. To tweak one system, open one file. Don't read the
whole tree to "see what's up" — use this map.

| File | What lives here |
|------|-----------------|
| `js/core.js` | Globals, tunable constants, canvas, raw input/keymap |
| `js/save.js` | localStorage save/load |
| `js/audio.js` | SFX + music synth (`sfx()`) |
| `js/player.js` | Player factory `mkP()`, **horizontal movement `_updatePlayerMoveX`**, jump, hook control, connector-arm pose |
| `js/physics.js` | Collision, **wheel/slope movement physics**, `MOVE_*`/`WHEEL_*` constants, ground detection, spawn snap, rope colliders. `MOVE_BUILD` lives here |
| `js/weapons.js` | Items TRS/RCA/XLR/MAG, **RCA grappling-hook**, rope pickup |
| `js/enemies.js` | Enemy AI, mind-enemy, body separation |
| `js/render.js` | All drawing (sprites, world, HUD shapes) |
| `js/ui.js` | HUD, menus, on-screen version line |
| `js/editor.js` | In-browser stage editor |
| `js/spawn_fix.js` | Tiled object/tile spawn resolution (player/RCA/enemy) |
| `js/awdjoo_level.js` | Awdjoo campaign config + guaranteed basement RCA |
| `js/awdjoo_map.js` | **Generated** embedded Tiled map data (don't hand-edit; synced from `assets/Awdjoo/Awdjoo.json`) |
| `js/healthwatch.js` | In-game glitch sentinel → `window.__MV_HEALTH` |
| `js/main.js` | Game loop, `update()`/`draw()` orchestration, state machine |
| `js/selftest.js` | Headless QA bot (gated by `?selftest=1`) |

**Movement feel knobs** (where "Mario+Sonic flow" is tuned):
- `js/physics.js` top: `MOVE_WALK`, `MOVE_RUN`, `MOVE_ACCEL`, `MOVE_TORQUE`,
  `MOVE_STOP` (release decel), `MOVE_TURN` (skid/turn accel), `MOVE_RUN_RAMP`,
  `WHEEL_*` (slope grip/coast/torque), `GRAV`, `JI/JMH/JHH` (jump).
- `js/player.js` `_updatePlayerMoveX`: turn-slash, accel curve, cap easing.
- Collision/anti-stick gates (`_moveBlocked`, `_grindF`, `_cornerStepResolve`,
  `_wallTouchInfo`) are in `physics.js` — keep them; tune *velocity*, not collision.

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

Manual visual check only when needed: `TEST.bat` (opens browser).

---

## Auto commit & deploy

After completing substantive work in this repo, **commit and push to `main` without asking**.

1. `git status` / `git diff` — stage only task-related files
2. Concise commit message (why, not just what)
3. `git add` → `git commit` → `git push origin main`
4. Tell the user: commit hash, push OK, and that **Netlify** (`mind-and-venture.netlify.app`) deploys from `main` when connected

**Do not commit:** `.vs/`, `.cursor/`, IDE layout files, secrets, unrelated C# Unity experiments unless requested.

**Remote:** `https://github.com/paulooventura/Mind-and-Venture.git` · branch `main`
