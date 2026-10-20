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

### Physics referee (can MIND beat the level?)

```bash
npm run reachcheck
```

Boots Awdjoo headless, loads `js/reach_check.js` (not in `index.html` — the live
game is untouched) and replays MIND's real movement through the game's own
`gridResolvePlayer`: walk, jumps (hold length, run-up, air steer, duck super
jump), chained wall jumps, and the RCA hook once it is picked up. Reports
whether the RCA, every Knowl and the exit are reachable, dead ends you can fall
into but never get back to the exit from, and wedge spots where the wheel is
shoved back with no wall in front.

- `test-results/reach-summary.txt` — one screen
- `test-results/reach-map.png` — green no items · orange needs RCA · red never
  reached · purple dead end · yellow box wedge · blue exit
- `test-results/reach.json` — full report
- Exit **0** = beatable, no dead ends. In-page: `MV_REACH.check()` /
  `MV_REACH.drawMap(result)` for any map loaded into the typed grid (generated
  levels included).
- Use an existing Chrome: `MV_CHROME=/path/to/chrome npm run reachcheck`.

Manual visual check only when needed: `PLAY.bat` **once** (opens **one** tab).
**Never** `python -m http.server 8765`, never Simple Browser to `:8765`, never
a second `PLAY.bat` while one is running — each tab plays its own BGM.
Port busy: `scripts/stop-play.ps1` then one PLAY. Agents: `npm run selftest`.

---

## A/B labs (do not get stuck)

Keep the **live game (A)** and any **experiment (B)** both playable. Never replace Awdjoo physics with a lab until Wall says promote.

| Slot | What | URL |
|------|------|-----|
| **A** | Live Awdjoo (`index.html`) | `index.html?ab=a` |
| **B** | Clean collision lab | `clean-collision-core.html?ab=b` |
| **C** | Item sprite lab | `item-lab.html?ab=c` |
| **D** | Physics lab | `physics-lab.html?ab=d` |
| **E** | Piskel cave sketch (not Awdjoo) | `sketch-lab.html?ab=e` |
| **F** | LDtk loader lab (not Awdjoo) | `ldtk-lab.html?ab=f` |
| **G** | Awdjoo Level 1 beta from Paulo's pen sketch (`assets/levels/awdjoo-beta.ldtk`; rules + cubes `js/beta_level.js`, feel + XLR launch/hover + hook `js/beta_feel.js`, look + choir `js/beta_decor.js`, music + synth sounds `js/beta_audio.js`; rebuild with `python3 scripts/build-awdjoo-beta.py`; `npm run reachcheck:beta`; water + platforms + Isolator `js/beta_water.js`; 1.2 trial `assets/levels/awdjoo-1-2.ldtk` from `python3 scripts/build-awdjoo-1-2.py`, `node scripts/reach-check.mjs --lvl=1.2`; open with `?lvl=1.2`; standalone page `play-beta.html`; two-way gates: per-stage saves in `B.saves`, 1.2's arrival arch leads back to 1.1) | `beta-lab.html?ab=g` |

The sticky **A/B** bar at the top of both pages is the switcher (`js/ab-switch.js`). New labs get a new letter/page — do not overwrite A.

---

## Auto commit & deploy

After completing substantive work in this repo, **commit and push to `main` without asking**.

1. `git status` / `git diff` — stage only task-related files
2. Concise commit message (why, not just what)
3. `git add` → `git commit` → `git push origin main`
4. Tell the user: commit hash, push OK, and that **GitHub Pages** (`https://paulooventura.github.io/MV2/`) deploys from `main` automatically

**Do not commit:** `.vs/`, `.cursor/`, IDE layout files, secrets, unrelated C# Unity experiments unless requested.

**Remote:** `https://github.com/paulooventura/MV2.git` · branch `main`

## 16-bit presentation (Oct 2026, all pages)

- Type: `drawText` & co. in `js/core.js` draw smooth faces from `assets/fonts` (Exo 2 Black Italic for titles at scale ≥3, Nunito ExtraBold below; SIL OFL, licences beside them) with a colour ramp, outline and shadow. The 8x8 bitmap font is only the fallback until they load.
- UI kit in `js/core.js`: `uiPanel` (glass panels), `uiBar` (glossy meters), `uiPill`, `uiLogo` (chrome title text), `uiSparkle`, `uiCursor`. Title, options, story, HUD, stage card (`drawZoneCard` in `ui.js`) and the beta windows use them.
- `js/crt_room.js`: WebGL tube-TV pass over `#c` (curve, scanlines, mask, bloom, power-on). Input still goes to `#c`. Off for phones in play mode, headless browsers, software GL (CSS scanlines instead), `?tv=0`, or the CRT button. `?tv=1` forces it on in tests.
- `js/sound16.js`: every WebAudio sound goes through a 16-bit style bus (warm low-pass, soft saturation, echo buffer, small room, gentle compressor). The mp3 soundtrack is untouched. `?sfx16=0` bypasses it.
- `js/console16.js` (loaded LAST on every page): console modes, Options row CONSOLE + buttons under the screen. A = SNES (world at 256x224, 15-bit colour, mosaic + 16-step brightness), B = Mega Drive (320x224, 9-bit DAC + ordered dither, 8-step palette fades). World is resampled when the first HUD draw starts (`drawItemTutorial`/`drawHUD`); HUD/text use the 2x text layer. Palette + text grid run in the display shader (`crt_room.js`); without a GPU only the world resample runs (`?palette=cpu` forces the CPU palette). Render camera snaps to console pixels. `?console=snes|md|off`.
- `js/sound16.js`: the chip voicing follows the console mode (SNES: Gaussian roll-off + echo buffer; MD: 9-bit DAC grit, presence, no echo). The mp3 soundtrack joins the bus through MediaElementSource on first play.
- Beta world text (signs, labels, crate names) goes through `MV_BETA.wtext` so it lands on the text layer.

## Stage revisits (lab G)

- Session saves per stage in `MV_BETA.saves` (knowls keyed by kind+position, crates by cell). `B.progress` = furthest stage index reached.
- Any LDtk entity may carry a `tier` field: it exists only when the player has gone that many stages past this one and comes back (tier 0/none = always). `RevisitWall` rects (kind open|seal|oneway, optional skin) rewrite Collision/Skin for their tier before parsing. `EchoCrystal` = revisit goal: a beaten stage's arch stays shut until its echo crystals are collected.
- 1.1 tier 1 = the Echo Well (shaft left of the arch → flooded chamber; one echo at the bottom needs 1.2's Isolator, one high over the road needs an XLR launch / super jump). Referees check tier 0 only.

## 1.2 full design + enemies (Oct 20, Paulo's second 1.2 page + enemy page)

- `scripts/build-awdjoo-1-2.py`: full map — water room with two meeting platforms, stub ledge, PIT under the deep end (falling off the map = -30 and back to the last safe ground, `beta_level.js`), wooden steps + ramps past the pillar, the roof-tile arch (skin 6 = SCALES, `texScales` in `beta_decor.js`) with a sliding block + platform inside, exit at the bottom of the stairs (3 crystals + 7 seeds; Paulo hasn't drawn the exit yet).
- `js/beta_enemies.js`: Enemy entities with field `ai` = circle | square | tri (+ `range` in tiles). Circle = Enemy A (sine-wave floater, swims; only electrified water shorts it). Square tips over 90°, triangle tumbles 120° and ropes itself up 1–3 tile steps. All push like the XLR, heat up red as MIND nears, and explode one block away (frags: 8 / 3 corners / 4 corners; floor turns them up). Blowing up is NOT a shutdown (Paulo, Oct 20): the enemy cools off for 1 s (grey, steaming, inactive) and carries on. Square + triangle rope MIND; AI holds or pulls by difficulty (`MV_BETA.difficulty` 1–3, buttons under the screen, localStorage `mv2.difficulty`). Enemies ride moving platforms and won't tumble into water or pits.

## Delivered game (Oct 20, Paulo: "we just need the whole game")

- `index.html` is the game: title → story → hero select → Awdjoo Town 1.1 → 1.2 → "to be continued" → title. Story mode starts the stages from `startGame()` in `ui.js` (`window.MV_STORY_STAGES`); `?selftest=1` still drives the classic Awdjoo map so the selftest is unchanged. 2-player local shows "coming soon" for the new stages.
- No A/B lab bar or debug readouts on index (`ab-switch.js` no longer loaded; `#mvVer/#inf` hidden). The lab pages still exist for development.
- Controls, SNES layout: A jump · B item select · X run + use item · Y punch. Keyboard Space / E / Q (Q also runs) / F; Esc or START pauses (B quits to title, Tab restarts the stage). Pads follow the letters on Paulo's Xbox-style pad (standard mapping: 0 A, 1 B, 2 X, 3 Y); the phone pad is the same diamond (Y top, X left, B right, A bottom).

## Console fidelity pass (Oct 20)

- Sound: `js/chip_worklet.js` (AudioWorklet, loaded by `sound16.js`) does the chips sample by sample. SNES: resample to 32 kHz → real BRR encode/decode (16-sample blocks, 4-bit, shift + filter 0-2) → 4-tap Gaussian interpolation; then the S-DSP echo. Mega Drive: YM2612 DAC — 8-bit sample-and-hold (SFX 15.6 kHz, music 22.05 kHz), no interpolation, ladder-effect crossover step; then FM-ish EQ and the Model 1 first-order ~3.4 kHz output filter. Falls back to pass-through if worklets are unavailable.
- Picture: world layer sampled nearest (crisp console pixels; `?px=soft` for the old blend). With the CRT on, the shader runs an NTSC composite stage: luma sharper than chroma (I/Q bleed 2–3 console px), MD luma softer (faster pixel clock), and luma→chroma crosstalk that makes the MD rainbow / dot crawl on dithering and edges (subtle on SNES).


- **Jacks move the water (beta_water.js `itemWater`)**: XLR held under water pushes the water mass downstream (flux along the jet, throbbing so ripples run off) and heaves a mound / opens a dip when aimed up / down; aimed at the surface from above it blows a crater with spray; releasing a charged push under water sends one surge. MAG held under water pulls a dimple over the tip with inflow from both sides and bubbles spiralling into the poles. Volume stays conserved (test: scratchpad `wr.mjs` / `wi.mjs`).
- **Isolator is timed (beta_water.js `isolatorTick`)**: lasts `ISO_TIME`=1800 frames (30 s), flickers and the ring over MIND turns red in the last 5 s, then wears off (toast). The crate respawns `ISO_RESPAWN`=1800 frames after it's taken (`iso.re`, saved as `isoRe`). It no longer carries over between stages (`isoOwned` retired); the achievement uses `B.isoEver`.
- **Water overflow (shores)**: each pool's columns extend up to 8 tiles past its sides over floor at rim height (`shoreFloor`; stops at walls/drops). Dry at start; water pushed above the rim spills onto the floor and drains back. `w.px0/px1` = the pool rect, `w.x0/x1` include shores. Level/lap/occupancy/surface line only count wet columns (`amt>0.5`).
- **XLR air pocket (`B.xBub`)**: held under water it grows with charge to r=48 (3x3 blocks) at the nozzle; its volume goes into `occ` (`cavityOcc`), so the displaced water raises the whole pool and can overflow. Released, it floats up and bursts at the surface. Drawn as a hole in the water (even-odd clip). Ripple rings (`B.wRings`, `ring()`) run out from the XLR/MAG tip, clipped to the water, each with an outward flux kick.
- **Console C · POSH** (`MV_CONSOLE` mode `off`): no console resample/palette/sound chip — clean HD. Default when nothing is saved. Picking POSH turns the CRT off; picking A/B from POSH turns it on. Options row cycles C → A → B.
