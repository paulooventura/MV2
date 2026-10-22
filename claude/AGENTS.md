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
| `js/render.js` | All drawing (sprites, world, HUD shapes). Character look = the Oct 22 key art (`assets/ui/title-key.jpg`): Venture wears a **red backwards cap**. |
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
- **Pause menu** (`ui.js` `_pauseInput` / `drawPauseMenu`): RESUME · OPTIONS · EXIT. Pad MENU ☰ (button 9, next to X) or VIEW (8), or Esc, opens/closes it; d-pad/stick moves, A picks, B resumes. OPTIONS returns to the pause menu (`_optFromPause`). START no longer restarts the stage (was mapped to Tab). Test: scratchpad `pause.mjs`.
- **Pink in Paulo's sketches = BACKGROUND / ANIMATION, no collision** (legend on the 1.2 page). The 1.2 roof-tile structure is a background house (Decor `house`, `bgHouse` in beta_decor.js: terracotta fish-scale roofs, lit windows with people, flower boxes, door + porch stair, chimney smoke, bunting). The pink drawings top-left are the background town (Decor `town`, `bgTown`: three houses, a neighbour waving, kids hopping, festa-junina bunting to a pole). Decor entities now carry `w/h`. Level fetch is cache-busted by `MV_BUILD`.
- **Enemy reach (beta_enemies.js)**: heat starts at 3 blocks (`HEAT_FAR`), push at 2 (`PUSH_R`), rope at 6 (`ROPE_R`); the engine's XLR/MAG forces only move an enemy within `MAX_ITEM_R`=4.5 blocks of MIND (wrapper on `_applyItemForceToEnemy`); the underwater XLR current reaches 120 px.
- **Item cards once** (`openPopup` in beta_level.js): each item's card shows only the first time (`B.popupSeen`, cleared on a new game). **Moving platforms** have no rail drawn (the sketch's arrows only mark range). **No stomp damage** on story-stage enemies (`main.js` stomp checks skip `_betaEnemy/_ai`).
- **Enemies never float** (beta_enemies.js, Paulo Oct 20): A (circle) ROLLS along its floor (`rollTick`, spins with `e.roll`), turns at ledges/walls, sinks and rolls along the bottom in water. B (triangle) and C (square) fall onto their next side but only onto floor — never off a ledge. To reach other floors they rope-travel (`ropeTravel`/`findLanding`/`findAnchor`): a pendulum swing from a ceiling across a gap, or a haul to the far ledge (solid ground only). Patrol ranges (`mn/mx`) no longer limit movement — the floor does. Test: scratchpad `roam.mjs` (0 floating samples on 1.1 and 1.2).
- **DOWN + JUMP drops through platforms** (moving platforms, one-way tiles, engine one-way plats): `_onDropPlatform` / `_mvDropThru` in physics.js; grid one-way landing and beta platform landing skip while it counts down. Solid ground is unchanged.
- **Enemy sizes** (Paulo's size chart vs an omni block = 32 px): A circle 30, B triangle 52×64, C square 80×80. **Water kills** any enemy without an Isolator (`_permOff`); `iso` field on an Enemy entity = wears one (orange wrap; the 1.2 pool circle). **Smart AI**: they notice MIND whenever they're on screen (`onScreen`), roll / tip toward him, rope-travel to the floor closest to him (`findLanding` with a target, 9-block search), rope him from range with line of sight, C drops off a ledge onto him on purpose; they avoid water. **No patrol boxes** (`mn/mx` = ±1e7): the engine clamps x into mn..mx on hits, which used to snap travelled enemies home — they now reboot where they went down.
- **Standing on enemies** (beta_enemies.js `surf`/`slopeAt`/`support`, a `_movePlayerWithColl` wrapper): C square = flat platform (wheel span); B triangle = two slopes, MIND slides off unless on the exact peak; A circle = round, only dead centre holds. Permanently shut-down bodies are flat platforms of any shape and can be pushed around (deadTick integrates vx with friction). Riding enemies carry MIND (`e._pdx`), no body shove or contact hit while on top (`B.rideEnemy`). **Punch hold no longer makes MIND run** (`isSprintHeld`). **Reboot = 2 s** (`REVIVE_FR=120`).
- **Items aimed down while standing** (`_itemDownAim` in player.js: grounded + DOWN + using an item; the arm stops blending to the duck pose): MAG locks MIND to the floor (`B.magLock` in beta_level `magnetTick`; nothing moves him until he lets go), RCA attaches right under the wheel (direct latch), XLR launches by charge (`B.xlrAim` keeps the held aim for the release), TRS ricochets straight back up. **Loaded punch** on an omni block destroys it outright and cracks every block around it (render.js). **Triangle enemy is equilateral** (74×64).
- **Wall grip** (beta_feel.js `wallTick`): grips only after pushing into the wall for 0.5 s (`st.pushWallT>=30`); letting go of the stick for 6 frames releases it. Jumping at a wall without holding toward it: he just falls.
- **Rope stays on through a jump** (player.js updateHook): jump on the ground = normal jump, in the air = a pump along the swing; the rope only comes off when it snaps or another rope is thrown (a new throw releases the old one first). **Enemy mass by size** (WEIGHT b_circle 2, b_tri 7, b_square 19; MIND 9.5): body separation in weapons.js uses it, MIND pushes bodies by mass ratio, story enemies block each other's moves (`enemyIn`). **Slopes**: enemies at rest tilt onto the slope (`gAng/gDy`, drawn around the bottom centre); a shut-down circle rolls down.
- **Down-use pose**: holding DOWN and using an item is a half duck (crouch target 0.35) and the arm reaches straight down beside the body so the jack's tip rests on the floor (player.js pose override). **XLR tap down** from the ground launches at once with the current power (100% = full launch) and spends it (`B._xlrTapped`; the hover doesn't cap it).
- **One arm-pose function**: `computeConnectorArmPose` lives only in player.js now (render.js had a second copy that silently overrode it). Down-use pose: full duck kept; elbow up, forearm plants the jack straight down so its tip (its real reach, as in `connectorTipWorld`) sits on the floor beside the wheel. Ducking also works while roped to the ground.
- **MAG floor lock** only on solid rock (`solidUnderWheel`: not on a cube, platform or body — on an omni/pull block the magnet grabs the block as usual); clank + hum (`MV_BETA_AUDIO.magClank/magHum`), red/blue field lines (`B.drawMagLock`), lets go when the button is released.
- **Rope as a cord** (beta_feel `cordPts`, overrides `_ropeSlackDrawPts` while hooked): verlet chain as long as the rope, gravity, kept out of solid cells (lies on floors with friction), slightly elastic. Drawing only; taut ropes draw along the game's path.
- **Shut-down bodies keep their shape physics** (only the square is flat): MIND slides off a dead triangle's side / circle unless on the peak / centre. **Enemy ropes** start at the triangle's top tip (C: its top front corner), turning with the body (`ropeOrigin`); a flying rope bites rock where it meets it, a swing into rock drops the enemy, a rope held on MIND lets go if rock comes between them and snaps under too much strain; slack ropes hang and lie on floors like MIND's cord (`cordFor`).
- **Posh SFX** (`js/sfx_posh.js`, loaded after sound16.js): every `sfx(name)` is re-voiced with layered, enveloped synths (sine/triangle bodies, filtered noise, FM bells, detune) through a glue compressor and a short room reverb; console A/B still colours it via sound16. New sounds: debris (crumb bounces), swap (item switch), tumble (enemy side-fall), rope_throw, menu/confirm (pause menu), gate (arch opens). Unknown names fall back to audio.js.
- **Omni crumbs**: chunky polygon shards (`spawnDebris`), bounce (0.42), roll along floors, pile up, get kicked by MIND's wheel, fade over ~2.5–4 s. main.js now still draws a broken block's crumbs (it used to skip hp<=0 blocks, so crumbs vanished on the break).
- **No standing on a block's side** (physics.js `_playerRidingBoxTop`): a block counts as floor only if the wheel centre is over it and nothing sits on top of it — a stack of blocks is a wall.
- **Smooth water + ropes**: the water surface draws through a 2-pass [1 2 1] smoothing as quadratic curves (`smoothSurf`/`curveThrough`), soft foam, and a little flux viscosity; ropes (MIND's and enemies') draw as smooth curves with finer cord segments.
- **MAG locks in 8 directions** (`rockAtTip` in beta_level): whenever the poles meet rock along the 8-way aim — wall, ceiling, floor, on the ground or in the air — MIND locks there until he lets go; cubes and platforms still get grabbed / ignored. Field lines face away from the contact surface.
- **Lives + continues** (beta_level `livesTick` / `contInput` / `drawLivesScreens`): 3 lives and 3 continues per run (`B.newRun()` on a new game). Each shutdown costs a life and MIND reboots at the stage entrance; out of lives → CONTINUE? (YES: 3 lives, back at the entrance) / NO; out of continues → GAME OVER → title. HUD: three MIND heads + CONT n. The old 5-shutdown rule is off in story stages.
- **1.2 pit is a dry hole**: the pool is cols 7–20 with a rim at col 21; reaching the map bottom = shutdown (a life) and reboot at the entrance. Water reaching an open edge (`spillL/spillR`) pours off it and is gone.
- **Water items scale with power**: XLR/MAG strength = max(charge, power bar). Full power: 3×3 pocket almost at once, churning big bubbles, white boiling surface, bigger rings, a little shake; MAG digs a whirlpool funnel with a bubble vortex; release surges are bigger.
- **MIND vs enemy bodies share the push by weight** (beta_enemies `_applyBodySeparation` wrapper): A (2) is shoved right along, B (7) gives a bit more than half, C (19) mostly holds and MIND gives way; pinned against a wall, MIND takes it all. **No energy bars over enemies** (`drawEnemyBars` no longer called).
- **Continue screen on the pad**: the beta update reads the gamepad while the screen is up; d-pad/stick move YES/NO, A or START picks, B answers NO.

### Build 267 — bodies sit UNDER the water (flat surface, level rises); muffled audio under water (Oct 22, Claude)

- `beta_water.js`: water no longer falls into a submerged body's cells (`bodyUnder(i)`: water > 0.5 beside it at that height) and a submerged body supports the water over it; the pressure column counts body cells as water. Result: no V-dip over MIND / enemies, a flat surface, the level raised by their displacement (test: 1.2 pool with MIND + 2 enemies, surface 1774–1807 px uneven → 1765 flat). A dry body (rain on his head) still sheds water.
- `sound16.js`: an underwater stage on the master bus (low-pass 20 kHz → 380 Hz, +5 dB @180, −30%) — `MV_SOUND16.underwater(k)`; `beta_water.js` drives it from how far MIND's head is under (`B.uwK`), and resets it off-stage.

### Build 266 — the Isolator skin covers the speaker box only (Oct 22, Claude)

- `render.js` `drawBody`: the orange rubber skin is drawn on the cabinet rect (inside the body's own transform), only for the player (`!p._betaSib`). `beta_water.js` no longer draws the full-body bubble.

### Build 265 — the storm as a threat; the Isolator gets knocked off; the sibling rides platforms (Oct 22, Claude)

- `beta_weather.js` rewritten (runs on game frames via `updateKnowls`). Vapor (units: fluid cells; 1.2's bottom-left pool ≈ 500, the flooded room ≈ 280):
  HAZE from 10 (full at 220) · RAIN_START 360 → 30 s brew (`BREW` 1800 f: clouds, darkening, thunder grumbles growing, sheet lightning) → rain until vapor ≤ 70 ·
  STRIKE_START 560 (off below 430) → lightning every ~3–7 s, weighted to the highest open-sky surfaces (`skyHit`), telegraphed ~1 s (glow + crackle), ~58 HP direct, fries enemies, electrifies water it hits (`B.strikeWater`).
  Rain intensity = amount + `burst` (how fast the vapor went up; remembered ~a minute) → up to 1.5 = torrent (bigger/more drops, slanted sheets, grey wall, low roar).
  Static: out in a strike storm without the Isolator MIND charges (~10 s), sparks + crackle; full → the next bolt tracks him. Cover drains it.
  Light: haze milks sky + world; storm darkens/cools; flashes. Sound: rain hiss → roar, haze hush, thunder (far roll / close crack, panned). `beta_ambience.js`: wind rises, crickets / owl hush, frogs croak more.
- `beta_water.js`: Isolator has no timer; any hurting hit (`applyPlayerHit` wrapper) or a bolt knocks it off as `B.isoLoose` (bounces, floats, re-grab after 30 f). Crate still regrows 30 s after pickup. `B.strikeWater(x,y)`.
- `beta_water.js` + `beta_sibling.js`: moving platforms carry other bodies (`B.platRiders()`, `pl._ridePlat`); the sibling targets a spot on your platform, hops onto it, leaps gaps.

### Build 264 — a calm, grounded sibling (Oct 22, Claude)

- `beta_sibling.js` `follow()` rewritten: it drives on the ground with real collision (`_movePlayerWithColl`), eases to a mark ~70 px behind you (brakes in time, 16 px dead zone), hops walls / ledges (vy -10.8). It flies on the XLR only when it must (you're on the rope, 150 px above, 340 px away, or it's stuck 40 f), glides on a soft spring (0.86 damping, 0.014 pull, speed capped), and lands after 40 f once you're grounded nearby. Side behind you changes only after 50 f facing the other way; facing changes after 8 f. Walking into it no longer bumps it (needs |vx| > 6).
- Trace (scratch `sib7.mjs`): fly time 98% → 10%, mean per-frame accel 2.2 → 0.33, jumps > 14 px/frame 48 → 0.

### Build 263 — COMPANION + FRIENDLY FIRE switches on the hero screen; sprint engine up front (Oct 22, Claude)

- `ui_select.js`: under the hero cards two switches, COMPANION (SOLO / WITH SIBLING → `MV_SIBLING.on`, `_playModeIdx` 0/1) and FRIENDLY FIRE (OFF / ON). ^ v moves between the hero row and the switches, < > changes the focused one; tap / click works too. `MV_SELECT_NAV(dx,dy)` is the shared entry (keyboard, pad in `player.js`, touch pad via `_driveMenusFromPads` in `ui.js`).
- `beta_engine.js`: a second, dry path — summed to mono, -3 dB @160, +5 dB @2.6k, +6 dB shelf @7k — straight to the spatial main bus (no room / echo). Sprint crossfades to it (room path down to 15%).

### Build 262 — select screen works by mouse / touch / stick; faster HP regen, per hero (Oct 22, Claude)

- `ui_select.js`: a click or tap on a mode card picks it (again = NEXT), on a hero card picks the lead (again = RIDE OUT), on the FRIENDLY FIRE pills switches it. Taps elsewhere no longer skip the screen. `MV_SELECT_FF_TOGGLE()` for the pad.
- `player.js`: on the select screens the left stick steps the cursor (one step per push) and d-pad / stick up-down switches friendly fire.
- `physics.js` / `main.js`: HP pip every 60 f for MIND (was 120), 84 f for Venture (`LIFE_REGEN_FRAMES_VEN`). Power refill 1.5/f MIND, 2.1/f Venture.

### Build 261 — no ROPE meter on MIND (Oct 22, Claude)

- `beta_feel.js`: the floating ROPE tension meter by MIND is gone; strain is exported as `window.MV_ROPE_STRAIN`.
- `beta_level.js`: the top-bar REEL bar carries the warning instead — amber past 45% strain, red and pulsing past 75%.

### Build 260 — a real stage-clear drop, the sibling hovers on its XLR, XLR air shoves enemies while held, sprint rev + unmuffle (Oct 22, Claude)
- `beta_audio.js fanfare()` rewritten: half-bar riser (noise sweep + climbing saw + accelerating snare roll) into a 2-bar 126 BPM house drop — kick (pitch-drop sine + click), claps on 2/4, off-beat hats, ducking sub bassline (sine + filtered saw), supersaw stabs Cm9 → Abmaj7 → Bb(add9) → G7 with filter snap and a generated hall, portamento square/saw lead hook — resolving to a big C major with crash, sub, rising arp and tail. ~7 s, own compressor, peak ≈ −0.8 dBFS offline.
- Sibling movement: on the move / in the air it hovers at your back shoulder (candidates: back 74/−54, higher back, other side, overhead) — skips spots in your line of fire while you use an item and spots inside rock; spring motion stiffer the further behind; on its XLR (jack down, air puffs, wheel spinning, holds the XLR). Stopped on the ground: settles behind you (trail / cover logic as before).
- `beta_level.js blowAround()`: while the XLR is held its air pushes enemies in front of the jack (`_tipField`, range 190, power- and weight-scaled) — the MAG's `pullAround` already pulled; the sibling was already blown / pulled (beta_sibling `interact`).
- `beta_engine.js`: entering sprint (Shift / tap-hold sprint) on the ground revs it (20-frame blip up ~5k rpm with a pop) and opens the muffle to 14 kHz (+0.04 level) while sprinting; 12-frame hysteresis so bumps / hops don't re-rev.

### Build 259 — trapdoors push for real, faster power, the sibling mirrors you (Oct 22, Claude)
- XLR aimed straight down while standing on blocks: the blocks under the wheel are always blast candidates (`blastCandidates` adds the feet row within ±1.05 T of the wheel); the cone used to skip them, so on the basement trapdoor (cols 26–29, rows 32–33) and Laitu's (cols 64–65, rows 26–27) the middle never moved. The down-TAP launch now only fires when there are no blocks under you (otherwise the tap pushes them). Tested: one push drops MIND through both.
- A pushed line now shoves a pull block behind it too (`lineFrom` push: only TRS cages stop a line) — the blue/red wall at cols 56–57 rows 46–50 moves from the right side.
- Power refills faster: +1.5/frame (was 0.8) after a 20-frame rest (was 35).
- Sibling: its eye runs the game's own `_updateBattleEye` (looks at the nearest enemy, squints, angry lids — same as yours, at home too); bolts spawn at its jack's tip with a muzzle flash; it holds the item you hold (TRS while it shoots; RCA with its own line to your anchor while you swing); at home it's empty-handed.

### Build 258 — mode step SOLO / WITH SIBLING, friendly fire, the sibling has a body, solo sibling stays home (Oct 22, Claude)
- Select step 1 ("HOW DO YOU RIDE?") has 4 modes: SOLO · WITH SIBLING · 2P LOCAL · 2P ONLINE (soon). `_playModeIdx` 0..3 (ui.js / player.js wrap %4); 0/1 set `MV_SIBLING.on`. Hero step pills = FRIENDLY FIRE OFF / ON (↑↓ / click), `MV_SIBLING.ff` (localStorage `mv2.sibling.ff`, default off).
- `beta_sibling.js`: the sibling's body has mass — punches (charged = harder), XLR blows it, MAG pulls it, rolling into it shoves it, landing on it bounces you and knocks it. It flies with real collision (`_movePlayerWithColl`) then eases back onto your trail. Friendly fire ON: hits hurt it (`sibHp`), at 0 it's knocked out ~4 s, then gets up. Proactive now: any enemy within 360 px of you, full-damage bolts (9 / 12 urgent, cd 24 / 14), and it steps to your side facing the danger when there's floor. Resonance: when you hit a block within 260 px it bolts that block too (not TRS-only, push or pull blocks).
- SOLO: the other sibling stays home as an NPC — spawns on the house's upper floor (the bedroom), wanders the floor it's on (turns at edges / walls), looks at you when you're near; it can be pushed around too.

### Build 256 — the sibling shadows you (optional), title without the Awdjoo line (Oct 22, Claude)
- Character select (hero step, 1 player): **SOLO / <SIBLING> SHADOWS YOU** pills (↑↓ / W S / pad up-down / click), saved in `localStorage mv2.sibling` (default on); the other card's badge reads SHADOW / AT HOME.
- New `js/beta_sibling.js` (`MV_SIBLING`): the other hero follows your own path a beat behind (a trail of your positions, 24 steps back, ≥62 px gap, never in front of you; no path yet → beside you on your back side), blinks back to you when lost (respawn / stage / teleport > 560 px). A ghost: no collisions, no pickups, no triggers, can't be hurt. Assists: picks the enemy that matters to you (≤300 px from you, closing in counts double, clear line of sight), its eye follows it, fires homing bolts (8 dmg, cd 48 / 26 when urgent), never across you; it only softens enemies (leaves 1 HP) unless the enemy is within 110 px of you or your HP < 40%. Drawn in the world behind MIND. Story mode only; labs with `?sib=1`.

### Build 254 — front door, final order (Oct 22, Claude)
- Splash: any button / click skips ALL the logos smoothly (`skipAll`: the one on screen fades out in 18 frames, then the title fades in from black — `MV_TITLE_FADE`, also after the logos end naturally; title music starts on the skip).
- Story Mode: title → STORY MODE → **TIMELINE** first. Empty file → storyline pages → character select → 1.1. Saved file → character select (on its hero) → on from its save, no storyline. B on the timeline → title; B on the select's first step → timeline for a saved file, last story page for a new one.

### Build 253 — the key art is the title; sprites follow it (Oct 22, Claude)
- Paulo's key art (two siblings, purple / red, MJ) → `assets/ui/title-key.jpg` (2688×1792). Title (`ui.js drawTitle`, art ≠ 1536 wide): fit to width on the bottom, slow push-in, breathing sigil light, MIND & VENTURE logo in the top band, menu plate low between the wheels (`_titleMenuGeom` branch). Hero cards (`hero-mind/venture.png`, 600×800) are crops of it.
- Sprites (`render.js`): `drawBody` rewritten — black cabinet, woofer, corner screws, coloured rim light; a thick grooved record on top with chrome-orb shoulder sockets on its edges; the back's HP strip is now the glowing Knowl tank (liquid = HP, 10% air at full, bubbles, segment lines). Bulb is clear violet (MIND) / rose (VENTURE) glass with a purple / red iris; head sits 3 px higher, screwed into the record. MIND's logo hat brim 64→80 wide. VENTURE: new red backwards baseball cap (`_drawVentureCap`). Gloves purple / red leather (`drawFist`). Fork black with gold stanchions and a gold spring.

### Build 252 — the XLR catapults you up, with a sub "woo-woo" (Oct 22, Claude)
- `beta_feel.js` xlrJet: aimed down (push UP), the first 16 frames slam vy toward −14.5 (×power 0.45–1, the very first frames at full blend), then up to frame 48 a lift of ~1.08 G tapering to 0.68 G (a float that runs out; the hold still drains 1.55/frame). Release/tap launches upward use 0.9 × vFull (was 0.62) with a 0.45 minimum charge: a full ground tap now lifts ~320 px peak vs ~150.
- New `js/beta_air.js` (`MV_AIRBLAST`): while the XLR blows, a saturated sub (42→62 Hz with charge) + octave, pulsing 5→9 Hz ("woo-woo-woo"), over low air rush; `boom(k)` on every launch — sub drop 95→32 Hz + an air burst closing 1.8 kHz→160 Hz. Through MIND's spatial bus.

### Build 251 — the front door in order; DOWN + JUMP always lets go of the magnet (Oct 22, Claude)
- Story Mode order (Paulo): splash logos → title → STORY MODE → storyline pages → **TIMELINE** (the five save slots, own `_gameState='timeline'` over the story map; saved = carry on, empty = new story there) → character select (opens on that timeline's hero) → the stage. `beta_story.js` wraps `startGame` (story's last page → timeline) and `startStoryMode` (always the story first); B on the select's first step goes back to the timeline (`MV_TIMELINE_BACK`), B on the timeline back to the last story page. A saved timeline plays via `storyPlay(save,'select')` — no chapter card, the hero just picked. Game over still shows the chapter card.
- Magnet: DOWN + JUMP now lets go while still holding the MAG on a surface (`lockRelease`, no re-grab until the button is let go), mid plug-in, and parked. `B.parkInput` moved into main.js right before the jump code (after the pad is read), so a pad's A works too.

### Build 250 — the gramophone carries through the air (Oct 22, Claude)
- Paulo: right outside the house door or in the tunnel under it the music went unrealistically muffled. `beta_ambience.js` now takes the clearer of two paths: through the mass (distance + walls, walls shave gently: 0.78^tiles) and around it — the shortest air path from the gramophone (`airPath`, a BFS over open cells cached per stage, refreshed every 2 s), a little duller the more it bends (`bend = air − straight`). Floor 900 Hz, gain ≥ 0.5. E.g. 4 tiles under the floor: 727 Hz → ~10 kHz; 10 tiles past the door: 1.1 kHz → ~9.6 kHz. `window.MV_AIRPATH` for probes.

### Build 249 — magnet suction, flush lock and parking (Oct 22, Claude)
- `beta_level.js` MAG: with the MAG held and nothing carried, `suction()` casts 5 rays (aim, ±0.32, ±0.6 rad) up to 150 px from the poles; the nearest rock pulls MIND toward it with an amplitude arc `sin(π/2·(1−d/R))` scaled by power (0.35–1), beating gravity toward ceilings (speed cap 9). Touching rock locks as before, now `seatLock()` aims the arm straight into the surface and slides him (≤24 px) so the poles sit flush; the aim stays forced while locked.
- Parking: switching items while locked (`_cycleItem` wrapper) → `B.magPark` (`st:'plug'` 26 frames): the magnet stays on the surface (`B.drawMagPark`, art + cord), the glove hand takes the cord from the magnet's base over the head into the top-back socket (`B.magCordEnd`, `B.gloveReach` in beta_feel), power still draining — run out before it seats and he drops. Seated (`'parked'`): he hangs there frozen, no drain (the bar refills), other items work, jumps are swallowed; DOWN + JUMP (`B.parkInput`, before the game's update) lets go with a small push off the surface. Holding the MAG again re-takes the magnet (back to a lock). Respawn/shutdown clears it.
- `main.js`: `p._swapHoldBlock` — after a park switch the new item waits for a fresh press of the item button (no instant TRS shot from the still-held button).

### Build 248 — readable SNES/MD with a stronger console feel; RCA plugs in only when you switch items (Oct 22, Claude)
- Display (`crt_room.js` + `console16.js`): the shader now gets two layers — the full frame and the world alone at console res (`MV_CONSOLE.worldLayer()`, the `lo` canvas from `bake()`). Wherever the frame differs from the world (HUD, menus, banners, any text) it's the TEXT layer: full-res, crisp, the console's colours (SNES 15-bit; MD 9-bit DAC with its dither), only the tube's own slight softness, shallower scanlines. The world path samples the world texture only, so text never smears into composite blur or rainbows. MD dot crawl / "waterfall" rainbow now only on dither (a pixel that stands out from both neighbours), not on every edge. Mosaic frames / menus with no world → all text layer.
- Sound (`sound16.js`): with the CRT TV on and a console picked, sound goes through the TV's own speaker (narrower stereo 82/18, HP 62+45 Hz, +1.6 dB at 1.4 kHz, LP 10.5 kHz) with a faint 15.7 kHz flyback whine; a degauss "thoom" + relay click when the set comes on or the console is switched. POSH / TV off = clean line out.
- RCA (`beta_feel.js`, `render.js`): latching no longer auto-plugs (`_ropePlugOnLatch` is a no-op) — the jack stays on the left arm and the rope runs from its tip. Switching items while hooked: the GLOVE (right) hand reaches to the jack (30%), pulls it off and carries it over the head on a bezier to the socket on the top back (`B.gloveReach`, elbow up), seats it, and holds the arched pose 12 frames (`p._plugArchT`). 26 frames total. The new item shows on the left arm as soon as the jack is off.

### Build 247 — the giant-cat purr, a wheel that spins in the air, slower/subtler rain, realistic water (Oct 22, Claude)
- Engine (Paulo: "a comfy purr from a giant feline"): idle 620 rpm (~41 Hz firing, fewer cycles), exhaust pipes tuned down to ~68–73 Hz at idle with fatter pulses and a warmer ring, tailpipe darker at low revs. New purr layer in `beta_engine.js`: sine at half the firing rate + triangle at the firing rate, LP 180 Hz, breathing AM (0.55 Hz) and a ~24 Hz purr rattle, strongest at idle ((1−r)²) and gone at high revs. Level now 0.16+0.05·thr−0.06·r: the low end is the loudest part.
- Wheel in the air (`_rollWheelFromTravel`, physics.js): off the ground or on the rope the motor free-spins the wheel with the stick (`p._wSpin`, spools up ~0.5 s, coasts down), and the engine's free-rev limit follows that spin, so it revs on the rope too. On the ground the roll is from travel as before (and carries into the air).
- Rain (`beta_weather.js`): RAIN_START 4 → 9 vapor, ~7 s of a heavy sky (`BREW`) before the first drop, slower build, 2 drops/frame max, fainter streaks and hiss, rarer thunder. No rain indoors: rain drops that enter a Room or `houseInside` decor go back to vapor (mass kept), they never spawn under a roof, and the screen streaks are clipped out of houses.
- Water look (`beta_water.js`): clearer at the top, deep blue-black with depth, thin meniscus + soft under-skin light (no thick white outline), subtle foam, fainter ripples/caustics, glassy falls with fine vertical streaks, rain drawn as thin streaks, beads/bubbles smaller and translucent.

### Build 246 — taps use the item again; the engine sits back and screams only at top speed (Oct 22, Claude)
- Bug (Paulo): a quick tap of the item button did nothing. Cursor's sprint (build 238) keeps the button quiet while it might be the first tap of a sprint, and the tap never reached the items. Now `_updateRunEntry` sets `p._tapPulse=3` on a quick release (≤ `_SPRINT_TAP`), and `main.js` plays it back as a 3-frame press (`_itemHeld`) for TRS / RCA / XLR / MAG. Tap-then-hold+direction still locks the sprint with no item and no power spent.
- Engine: level ~0.4× (0.13+0.08·thr+0.05·r), high shelf −6 dB, a muffle low-pass after everything that opens with speed² (900 → 3,700 Hz). Each gear tops out higher (5.4k in 1st … 12.6k in 6th) and the free-rev limit scales with speed, so the top of the scream only comes at real top speed.

### Build 245 — HYPERDRIVE engine (Oct 22, Claude; with Cursor's main build "241" XLR shove merged)
- New `js/engine_worklet.js` (AudioWorklet `mv-engine`): a crank turns; cylinders fire on their angles as pressure pulses (sharp knock + turbulence) into two exhaust waveguides (one per bank, tuned ~118–216 Hz, ringing harder on throttle), a tailpipe low-pass that opens with throttle×rpm, DC block, tanh. Firing morphs with rpm: cross-plane V8 (bank order L R L L R L R R → the burble) below ~3.8k, even V12 by ~7.6k (the scream), 13.5k redline. `{bang}` messages fire backfires (longer, rougher blasts).
- `js/beta_engine.js` rewritten as the controller (`MV_ENGINE.tick` from main.js): 6 gears (shift 12.6k → ~6.2k), launch flare (clutch slip from a standstill), full-throttle upshift crack, rev-matched downshift blips, a bouncing limiter in the air/burnouts; twin turbos (whistle + air rush, spool lag), blow-off "pssh-tu-tu" on lift with boost, anti-lag bangs on lift above 7k; an electric hyper-motor (two saws a fifth apart) singing with wheel speed. Through MIND's room bus. 3 s still → off.

### Build 243 — the front door: logos → title → story → action; the booklet + credits (Oct 22, Claude)
- Title music waits for the 2nd logo: `ui.js` `_ensureTitleMusic` returns while `MV_SPLASH.idx()<1`; `audio.js` no longer autoplays the title element under the 1st logo; `beta_splash.js` starts it when logo 2 comes in.
- Title menu: STORY MODE · CREATIVE MODE (locked, "OPENS IN ALPHA") · OPTIONS, drawn in code (`_drawTitleMenuOverArt`) on a dark glass plate over the words painted into the key art; `_titleMenuGeom` rows at art y 742 + 54·i.
- Continuing a saved story shows a chapter card first (`beta_story.js` state `chapter`, 170 frames, skippable after 40): the stage sky, the stage name, your hero (feathered portrait), what you've found; then it fades into the stage. Game over goes through it too ("GAME OVER - BACK TO YOUR LAST SAVE").
- Options → MANUAL & CREDITS (row 6; `OPT_FIXED_ROWS` 7) opens `js/ui_manual.js` (loaded after `beta_splash.js` — it wraps `update`/`draw`, which `main.js` declares): an 11-page SNES/Genesis-style booklet (cream paper, halftone, red/blue italic ribbons in Exo 2 900i, Nunito body, boxed art, HINT! starbursts, page numbers; pages slide). Cover · story · heroes · controls (from `OPT.binds`) · the four jacks (crops of `mv2-item-boxes`) · Awdjoo Town · tips · credits · progress · curious facts · back cover. ←/→ turn, ESC back.

### Build 242 — the wheel's engine roar (Oct 22, Claude)
- New `js/beta_engine.js` (after `beta_spatial.js`) replaces build 237's pop scheduler as `MV_ENGINE.tick` (still called from `main.js`; same 3-second idle cut-off).
- A V8 model: RPM from wheel speed through 5 gears (`GEARS` spans of |vx|/MOVE_RUN), upshift at 6900 with a 7-frame throttle cut, downshift only well below a gear's span with 30 frames of hysteresis; free-revs in the air and on an XLR burnout. Throttle 0.62 driving, 1 sprinting.
- Voices at the firing frequency (rpm/60·4/2): rich periodic wave + a detuned twin, sawtooth at ½ and triangle at ¼ for the cross-plane burble, square-wave lope at idle; tanh saturation driven by throttle; resonances ~110 Hz / ~420 Hz / 1.4 kHz; low-pass opening with throttle and RPM; induction howl up top; exhaust crackles when lifting off above 3500 rpm. Plays through MIND's room (`MV_SPATIAL.graph().self`).

### Build 241 — HRTF ears for positioned sounds; rain from boiled water (Oct 22, Claude)
- Paulo's capture (07:47, 66 s): the music opens up and closes again each time he passes the gramophone (4 swells, highs to ~17 kHz up close, ~-45 dB vs -90 dB far) — working as designed; the L/R balance follows the gramophone's side. The stereo image measured narrow (side/mid ≈ 0.13–0.36), so positioned effects didn't stand out.
- `beta_spatial.js` `chainAt` → `hrtf()`: positioned sounds use an HRTF PannerNode (ear timing + head shadow; behind = behind, a little up/down) at the same left/right as before; distance stays ours (rolloff 0). Falls back to a StereoPanner.
- New `js/beta_weather.js` (after `beta_water.js`): vapor from boiling (`B.vaporNow`) builds a cloud deck (`MV_WEATHER.sky`, called from `beta_sky` draw) and, past 4 cells of vapor, rain: real `B.drops` (0.012 each, ≤5 a frame, `B.vaporTake`) from above the view wherever the air is open, inside the world. Stops below 1. Heavy rain flashes lightning + far thunder. Rain hiss by `MV_SPATIAL.env` (full outside, dull on the roof, far through rock); fine streaks over the screen outside (`MV_WEATHER.post` via `beta_sky` post). Mass stays conserved (water + vapor + drops + lost).
- `B._testBoil(n)` (beta_water) for tests.

### Build 195 — damage feedback by HP phase
HP 0–100 in 5 phases (20 each). `js/console16.js` `CRUSH` table drives everything: phase 5 = clean/posh; 4→1 = lower resolution (`f`), fewer colour levels with ordered dither (`lv`), row tearing, darker screen (`dark`, replaces ui.js `drawDamageOverlay`), slower music (`rate`, used by audio.js `updateGameBgm` and beta_audio `hurtTick` via `MV_CONSOLE.hurtRate()`). A fresh hit = ~0.5 s jolt: two phases deeper, red flash, music dip. Audio bit depth follows in `js/sound16.js` (`BITS` 6/5/4/3, WaveShaper after the master).

### Build 196 — walk speed, enemies vs slopes, home, impacts, rope
- `MOVE_WALK_TOP` (physics.js, 7.8) caps walking on the ground; running still reaches `MOVE_RUN`; air steering keeps `MOVE_WALK` (reach_check `AIRWALK`).
- Story enemies treat the dirt under a slope line as solid (`solidAt`/`floorSnap` in beta_enemies.js); A rolls up slopes a few px at a time.
- 1.1 family home: roof/ceiling 2 rows higher, no room labels. Beds are bouncy one-way platforms (`js/beta_impact.js`, squash drawn in beta_decor `bed()`).
- `js/beta_impact.js`: punch swing crescent + impact stars/shake (render.js calls `_punchConnect(x,y,ang,charged,kind)`), omni-block dust. Sounds in sfx_posh: `omniblock_chip` crunch, `omniblock_shatter` crush, `punch`/`punch_heavy` whoosh, `punch_hit(_heavy)`, `punch_wall`, `bed_boing`, `reel_in`/`reel_out`.
- RCA rope (player.js): swing drag 0.993 (0.96 below 1.6 px/f, 0.998 while pumping) so it runs down to hanging still; `h._reel`, `h._reelPhase` drive moving braid marks + a spinning spool at the jack; tip drawn as a magnet puck (`_drawRopeMagnetTip`).

### Build 201 (my 197, merged over main 197–200) — live cage blocks, crystals, speed camera, enemy awareness, item crates
- Yellow TRS-cage blocks are electrical (`beta_impact.js` `_shockFromBlock`): touch = 6 + 4.2×speed dmg (max 55, 40-frame cooldown), punch 26, loaded punch leaves 8 HP. Bolts + flash; no omni crumbs (weapons.js `_LASER_SHARD_COLS`).
- Punches need a clear line from the shoulder (`_punchReach` in render.js) for blocks, enemies and crates.
- Knowl crystals: static green faceted cluster (`beta_decor.js crystal/gemShard`); `crystal_pickup` sfx rises with the share collected like seeds' `seedPitch` (`_knowlPickPitch` in weapons.js).
- Camera: `camZoom` 1.2 standing → 1.0 at speed (physics.js `_updateCamZoom`); world drawn inside `_worldZoomBegin/_worldZoomEnd` (main.js draw), HUD unscaled. Never below 1.
- Story enemies: `aware` needs line of sight; '!' on spotting, '?' after ~1.5 s lost, then search last-seen spot (7–10 s) within `leash` of `homeX`; eyes follow `e.look`.
- Item boxes (`js/beta_crates.js`): wood-pallet crates (100 HP: punch 34, loaded/charged laser 100, laser 50), splinters, item pops out by hit strength, gets knocked by later hits, picked up by touch after 32 frames. Pickup sites use `B.crateRect(o)`.

### Build 202 — frags, HUD, item power
- Enemy frags: spent ones (settled / cold) get kicked by the wheel (`kickFrag`, become `dud` = harmless to MIND); `B.forceFrags(tx,ty,ang,sign,str,range)` — MAG pulls (pullAround), XLR shoves while held and blasts on release. Settled tri/square frags now linger 4 s.
- Seeds 10% quieter (`knowl_seed`); full sets play `seeds_all` / `crystals_all`; bottom-left bar draws real seed/crystal shapes + colours and glows when complete. Lives moved off the bottom-right.
- Top bar (beta_level `drawTopBar`, replaces ui.js drawHUD in stages): MIND head + lives + continues, HP, power bar under HP, jack tips XLR > RCA > TRS > MAG.
- XLR/MAG releases cost power (`ITEM_COST`: XLR 14+22×charge, MAG 10+16×charge) and refill waits 45 frames (`p._itemRest`, main.js); push/pull/launch strength × power at release (`B.relPow`); magnet field × (0.2+0.8×power).

### Build 203 — damage stays out of the HUD and off MIND
- console16: the bit-crush now runs at the end of `drawDamageOverlay` (after the world, before the HUD), then `redrawMind()` draws MIND again clean (skipped under water). HUD bars stay readable.
- render.js `drawHead`: `window._mindHeadDmg` (HP lost, +1 while shut down) reddens the sclera, adds veins, and cracks the bulb glass (fixed crack paths, more per HP lost).
- beta_crates: a punch must reach the crate's real box from the shoulder (`_punchReach`), so walled-in crates can't be hit.
- Power: refill 0.8/frame (was 0.56) after a 35-frame rest; hold drain 1.55 (enh 1.0); release costs XLR 17+27×charge, MAG 13+20×charge; magnet carry drain 0.45.

### Build 204 — no invisible walls, items only from the loose jack
- beta_level `throwCube` now `gridSmashCell`s the cube's old home before it flies (MAG/XLR tugging a resting cube used to leave its cell solid = invisible wall). `ghostSweep()` (every 30 frames) clears any cell a cube ever held (`B.cubeCellsEver`) that no live block holds.
- weapons.js `updateItemDrops` / `updateRopePickup` don't collect in story stages; the only pickup is the loose item after the crate breaks (beta_level `cratePickups` + `B.crateRect`).

### Build 205 — hot frags, boot sound, hex crystal
- Frags (beta_enemies): stay hot `FRAG_MIN_LIVE` 130 frames and keep hopping (min bounce 2.4) before they can settle after `FRAG_BOUNCES` 5; circle frags cool at `FRAG_HOT` 170.
- Enemy reboot plays `enemy_boot` (= `enemy_dead` reversed: voices swell and sweep up, ending together), started 66 frames before `revive` so it lands on the reboot.
- Knowl crystal (beta_decor `crystal`): one symmetrical hexagon, translucent facets, drifting prism bands, rainbow edge; HUD icon matches (`hudCrystal`).

### Build 206 — Paulo's rope/disc sketch (+ main's logos/water build merged)
- Arms ride a disc on top of the speaker (player.js `computeConnectorArmPose`): latched, the jack mounts on the disc rim facing the rope's last bend, in line with it (`discS`, `_discBlend`), arm straight (no speed bend) so the swing keeps its energy; reaching up it's drawn behind the bulb (`pose.behindHead`); the glove rides the opposite side (`pose.gloveShX`).
- Rope look (render.js): magnet ball tip `_drawRopeMagnetTip`, braided cord `_drawRopeBraid`, coil showing in the jack's mouth `_drawRopeSpool` (more loops the more is wound in).
- Rope wraps edges (physics.js): the latch face is only ignored while the rope pulls away from it (`_ropeIntoLatch`); grid hits grow to the whole face (`_ropeGridFace`) so it bends once at the slab's real corner.
- Merged main's dc4ef22 (splash logos `beta_splash.js`, music slows only on hits, water shutdowns, platform full-charge launch).

### Build 207 — hanging pose from Paulo's second sketch
- Hooked, MIND tilts with the rope (`pl._tilt`, up to ±0.55 rad, rotated round the body centre in render.js drawCharacter); the disc puts the jack arm on the side of the box facing the rope (`_discSide` with hysteresis), upper arm pokes out sideways, forearm + jack point up the rope beside the head; glove on the other side. Rope is drawn to `pose.worldNose`.
- Physics rope end (`ropePlayerEndWorld`, RCA latched/flying): fixed point `ROPE_END_R`=48 px from the body centre along the rope — independent of the drawn arm, so the swing keeps its energy.
- Swing drag 0.996 (~12%/half-swing); the settle drag (0.95) now only when hanging nearly straight (offset < 16 px), not at every swing's peak.

### Build 208 — switching items while hooked
- Rope clip point `hookAttachWorld()` = back edge of the disc on top of the speaker. With another item out the rope's drawn end is the clip, with the RCA plug hanging in it (render.js); the arm follows the aim (auto-aim at the hook only with the RCA: player.js `_aimHook` guard).
- beta_feel `B.ropeClip` (26 frames): switching RCA ↔ other item while latched carries the plug along an arc between the hand and the clip (`B.ropeClipPoint`), the arm reaching with it; a click (`grap_attach`) when it seats. Rope length re-fit uses `ropePlayerEndWorld()`.

### Build 209 — nothing goes into walls
- player.js: `_armSolid(x,y)` (grid + slopes), `_armPathClear(pts,cx,cy,tilt)`. Hooked RCA arm is fitted each frame (`fitArm`): current disc side, else the other side, folding arm+jack in (k 1→0.18) until shoulder→elbow→tip→nose is clear. Tilt shrinks (halving to 0) if it would swing the wheel, box or bulb into rock.
- render.js: glove guard tucks toward the body if its fist would be in rock; a punch's fist stops at the wall face. The cord is shaped with the visible jack end already in place, so its rock collision covers the last stretch.

### Build 211 — Awdjoo 1.2 rebuilt from Paulo's full map sheet (Oct 21)
- `scripts/build-awdjoo-1-2.py` (72×68, 1 square = 2 tiles): arrival ledge + slope + background town; water room (Isolator lip, two meeting platforms, ledge, isolated A at the bottom, pit with a rim); the roof-tile house is SOLID (scales skin; door under the left leg, stairs inside, sliding block + platform, crystal top-right); the crystal chamber floored with electro blocks over the lower corridor (D + seeds + platform); the street in front of the background building, exit gate (5 crystals + 10 seeds); the flooded chamber under the street.
- Flooded chamber: Water entities with `plug='flood'`; laser Boxes with the same `plug` are the drain plug. Shooting any of them drains every water with that tag (`drainTick` in beta_water: 0.55 px/column/frame + a jet out of the hole, `water_gush` sfx). The omni/push/pull stack opens only from the right (carry the red pull cubes off with the MAG, push the blue + omni line into the drop with the XLR, a cell per shot).
- Enemy D (`ai='mirror'`, js/beta_mirror.js): the old rival AI (`_updateMindEnemy`) dressed as MIND (his hat via `window._mirrorHat`, his body), all four jacks; hunts only after it sees MIND ('!'), patrols when it loses him ('?'), reboots in ~2 s, off after 3 shutdowns or water; no minions.
- beta_decor: `houseInside`, `porch`, `building` art; slopes take their cell's skin (scales / wood / brick).
- beta_water: `w.open` (deep fade below a column) only when the column really has no floor under the water entity.

### Build 212 — Terraria water, brick corridor walls, D greys out (Oct 21)
- js/beta_water.js water is now a 2-D cellular fluid (`B.fluid`): half-tile cells, `M` = water per cell (1 = full, a touch more with depth = pressure), `BLK` 1 terrain (grid + slopes) / 2 bodies / 3 the XLR air pocket. Per frame: `occupy()` → 4 `step()`s (fall every other step; sideways flux driven by hydrostatic pressure shared over the column depth, with momentum; overfull cells push up, so U-bends level) → `displace()` (water inside a body goes to both sides, so bodies raise the level but never dam a flow). Mass is conserved: `B.fluidTotal()` = water + drops + MAG blob + lost (off the world bottom) + vapor.
- Water rects fill to half a tile under their top. Splashes / XLR blowing at the surface / the MAG blob throw real drops (`B.drops`) that deposit where they land. The old drain code is gone: a shot `plug` block just opens the grid and the water runs out (`water_gush` once).
- Vapor: a TRS shot into water electrifies the connected body (`EL`, flood fill), boils 10 cells (24 charged) at the hit and the live surface steams off (`ELEC_BOIL`/frame) — the way to bring the flooded corridor down. Thin films (< FILM) on ledges dry off slowly. New `water_boil` sfx.
- API kept: `B.inWater(x,y)` (inside a body it reads the water beside the body), `B.enemySubmerged`, `B.mindWet`, `B.waters` (rect list: c0..r1, px0, base).
- 1.2 builder paints every solid tile in cols 35+, rows 39+ BRICK (corridor, crystal chamber, flooded chamber walls). D (mirror) when shut down is drawn through `ctx.filter` grayscale and `window._mindOffNoLabel` hides OFF/BOOT/SHUTDOWN.

### Build 213 — Paulo's Oct 21 notes: hats, meters, RCA coil arm, shorts, feel
- Hat = Paulo's logo (`drawLogoHat` in render.js: slanted parallelogram brim, chamfered crown with a window, spike under the brim; `opt.front=false` = Venture's backwards cap). Used by MIND, Venture, D (`window._hatDirOverride`) and the HUD head (beta_level `hudHead`).
- Top bar: PWR bar green; new thin REEL bar under it (purple MIND / red Venture) = RCA cord paid out (`(rl-ROPE_RL_MIN)/(CMAX-ROPE_RL_MIN)`, or the throw distance in flight; dim when not roped). The on-MIND POWER meter is gone (wall grip); the ROPE tension meter stays.
- RCA (Paulo's sketches): the jack arm's forearm is a spring (`drawSpringCoil`, 5 turns that pull open as it stretches). Latched with the anchor within reach (`RCA_COIL_STRETCH`=3.6 x rest), the jack's magnet sits ON the surface and no cord is drawn (`p._jackOnSurface`, with hysteresis); farther, the coil stretches with `hook._tension`. Hooked with the RCA in hand the rope pulls from the jack shoulder (`ROPE_END_R_RCA`), so reeled in he hangs beside the jack. No spool in the jack's mouth (cord comes from inside the tip). No pickup cable from the RCA crate in the stage.
- TRS: for `TRS_SWEEP_FR` frames after a shot the arm sweeps to a new aim (lerp 0.06) and shots leave along the arm, so spamming while swinging the aim fans the shots across the angles in between.
- main.js: the duck charge on a drop platform no longer auto-launches (`_platLaunch` stays false) — the super jump needs a jump press.
- MAG: no self-thrust while on the ground (beta_feel `magJet`). XLR/MAG per-tap costs raised (XLR_BASE 28, MAG_BASE 22) so spamming drains at least as fast as holding.
- Enemies short-circuit in water like MIND (beta_water, `ENEMY_SHORT_FR`=40 frames of sparks + crackle, then off for good); `B.waterShortsEnemies` makes beta_enemies `shortIfWet` defer to it. The 1.2 pool-bottom Isolator enemy moved to the Isolator lip.
- XLR pushes: the whole line takes its cells at once and glides with ease-out, dust trail, squash + wobble on arrival (`_ease`, `_sq` in beta_level); up to 4 cells at full charge.
- 1.1: no "LAITU'S HOUSE" label.

### Build 214 — XLR blast cone, D knocks your jack loose, pit respawn, Story Mode continue (Oct 21)
- XLR push = `blastCubes()` (beta_level): every push/omni cube in a cone out of the jack. Within ~0.78 block of the aim line (measured at the jack tip's height) it goes straight along the aim 3 cells (4 at full charge); just off that band (to ~1.85 blocks, in front) it goes diagonally out, 2 (3). Each takes its line (`lineFrom`); farthest moves first; weaker on a low power bar / beyond 4 blocks; heavy lines go less far. MAG pull is unchanged (single cube).
- D (beta_mirror): `applyPlayerHit` is wrapped; a hit while D is acting (`window._mirrorActing`) or from D's shot (`window._hitShotSrc`, set in weapons.js) knocks the held jack loose: its unlock bit is cleared, the next jack is selected, and a broken-crate ITEM_DROPS entry (`_knocked`) flies off; picking it up gives it back (no tutorial again). Leaving / restarting the stage with it still lying there gives it back.
- Enemies that fall to the bottom of the world come back at their spawn after 2.5 s, rebooting (`B.enemyRespawnTick`, beta_enemies).
- js/beta_story.js (index.html only): the story run is saved to localStorage `mv2.story.v1` (stage, jacks, progress, every stage's save, lives) every 5 s, on quitting to the title, on stage change and on page hide. STORY MODE on the title then shows CONTINUE (straight back into the saved stage) / NEW GAME / BACK.

### Build 215 — STORY MODE on the title, five story slots (Oct 22)
- assets/story/title-frame-00.png: the key art's START is repainted as STORY MODE (same green pixel lettering, arrow moved left to x≈656). ui.js hides that arrow with a background patch (650,730,40,36) when OPTIONS is selected.
- js/beta_story.js now keeps 5 slots in localStorage `mv2.story.slots.v1` (the old single save migrates to slot 1). A savepoint is written to the active slot (`B.storySlot`) each time a stage finishes loading in story mode (story start, every stage passed into) and at the story's end — not mid-stage. GAME OVER (`B.overT` in beta_level) calls `B.storyGameOver()`: back to the slot's last save with fresh lives/continues. STORY MODE: no saves anywhere → new story in slot 1; otherwise the slot screen (saved slot = play from its save, empty = new story there, Y/F/Delete twice = erase, B back).

### Build 232 — merged Cursor's main builds 230/231 (down punch hits the floor block, XLR down shoves Laitu's push blocks down the shaft) + Claude's build 231 (story intro + hero pick, The Knowl Tree)

### Build 231 — every story opens with its intro + hero pick; "The Knowl Tree" storyline theme (Oct 22)
- Paulo: Story Mode went straight into the stage. Cause: picking a slot that already had a save (made automatically when a stage loads) continued it with no intro and no hero pick.
- `beta_story.js`: saves now carry `hero` and `intro:true`. A slot with `intro` continues straight from its save (hero restored). A slot saved before this rule (no `intro`) sets `B.pendingSave`, runs the story pages + mode/hero select, then `ui.js` `startGame` plays that save (`B.storyPlay`). An empty slot: story → select → new 1.1.
- Music: `assets/bgm/the-knowl-tree.mp3` (Paulo's track, 192 kbps from his WAV) is the story theme (`STORY_THEME` in `audio.js`), always — intro pages and the select screens, at 0.85× music volume. The title keeps its pool.

### Build 230 — merged Cursor's main-only work back; double jump; RCA plugs into the back on latch; angrier eye (Oct 22)
- Cursor had been committing straight to `main` (`claude/js/*`: builds 211 music lean, 223 RCA into the upper back, 224 shots stop on walls, 225 battle eye, 226 stereo, 227 run entry, 228 super jump float, 229 rope stops on the first wall). Later Claude deploys copied `beta-l1` files over some of them. All of those diffs are now applied onto `beta-l1` (`git show <c> -- claude/js | git apply -p2`). **Before deploying, diff `mv2-main/claude/js` against `beta-l1` and bring in anything new from `main` first.**
- Double jump (`main.js`): once per airtime (reset on ground / rope / wall grip), not in water or during the landing bounce; `vy=JI·DOUBLE_JUMP_K` (0.9, `physics.js`), a woofer shock ring (`p._dblJumpFx`, drawn in `drawBody`), a ring of sparks and `double_jump` sfx.
- RCA on latch: `window._ropePlugOnLatch` (beta_feel) runs the plug animation (`B.ropeClip.latch`); at the seat frame `p.hook._plugged=true` and the rope length is carried over. `_ropeInHand()` (player.js) = RCA out and not plugged; used by `ropePlayerEndWorld`, aim, `visEnd`, item cycling, the render's `_onBody`. Socket: `hookAttachWorld` = the back edge near the top; the plug seats angled down into it. The arm arches over the top with the elbow up while carrying it and holds a beat (`p._plugArchT`). Reeling (W/S) still works while plugged.
- Eye (Cursor's `_updateBattleEye`): lids capped so a slit always stays open; the top lid carries the slant (anger), the bottom rises flatter.

### Build 229 — Story Mode select screens redone (Oct 22)
- New `js/ui_select.js` (index.html, after `ui.js`) replaces `drawSelect` (input handlers unchanged in `ui.js`).
- Look: the stage sky (`MV_SKY.draw`) behind a dark grade; tilted parallelogram cards; light rays + rising sparks + bob on the pick; dimmed/greyed other card; logo-style names (`uiLogo`) in each hero's colour; LEAD/ALLY (or PLAYER 1/2) badges; a pulsing "&" seam; keycap hints at the bottom. Cards ease bigger/smaller on a switch, with a spark burst.
- Hero art: `assets/ui/hero-mind.png`, `hero-venture.png`, cut from `assets/story/title-frame-00.png` (stray title letters painted out). Drawn whole (fit to card height, feathered sides, cached) over a blurred, darkened copy.
- Mode step: 1 PLAYER / 2P LOCAL / 2P ONLINE (locked) cards with little pixel icons.

### Build 228 — XLR burnout (Oct 22)
- `beta_feel.js` `xlrJet`: on the ground, aim mostly sideways, holding the direction INTO the aim → the tire fights the shove: a stand-off where the shove slowly wins (`creep = thrust·(1−XLR_GRIP)·2.2`, `FEEL.XLR_GRIP` 0.78), no lift-off, the wheel spins against the slide, `p._tireHeat` builds (cools when not fighting), smoke grows with heat (≤26 puffs), `tire_squeal` every 14 frames.
- `player.js` `_updatePlayerMoveX`: enforces that creep after the drive (`pl._xlrResistV`/`_xlrResistFr`).
- `render.js` `drawWheel`: a hot tire glows orange, hottest at the contact.

### Build 227 — dirt-bike wheel kit; moving water you can hear (Oct 22)
- `render.js` `drawWheel`: no more whole-wheel squash (read as jelly). Knobby tire (14 rigid knobs, staggered), anodized rim (purple / red), 16 crossed spokes, drilled disc brake, motor hub with an LED arc that brightens with speed. Only the contact knobs shave ≤2 px under load.
- New `drawWheelKit` (after the wheel in `drawCharacter`): coil-over shock from the box's back corner to the axle (spring tightens with `suspComp`), upside-down fork leg (anodized upper, chrome stanchion, axle clamp), the speaker's cable from a gold jack into the hub with a dash of signal running along it. Folds away when crouched.
- Suspension feel: `TIRE_K` 0.26 / `TIRE_DAMP` 0.62 (one rebound); the box rides it (`forkDip` in `bodyCompress`).
- Water sound: `beta_water.js` tracks falling water per cell (`F.FL`, only through air) and `B.waterMotion(x,y,r)` sums flow / falls / waves (MIND's own wake excluded) with a centroid. `beta_ambience.js`: a positioned "ffff" rush loop (bright + body noise, churned) scaled by that motion; a wade swish by MIND's speed in water; splash on going in / out. `beta_audio.js` splash got a bright spray tail; water splashes sound from power 0.6 (was 1.5). A still pool is silent.

### Build 226 — rubber tire (Oct 22)
- Knobs at the top of `js/physics.js` (`TIRE_*`). `_updateWheelSuspension`: a fast rubber spring `pl._tireSq` (flat under load ~1.4 px, kicked on landings, jiggles back) and `pl._tireSx` (sideways, off walls; kicked in `beta_feel.js` wall bounce).
- `render.js` `drawWheel`: the wheel is scaled about its contact patch (floor) or its wall side by those springs.
- Grip: steering against the roll on the ground at speed (>2.6) with real braking → `tire_squeal` (posh), rubber smudge + dust, turn bites ×1.06. Coasting never squeals (`isLf`/`isRt` check).
- Small landings rebound a bit more (`TIRE_REBOUND` 0.16, cap 2.1; was 0.08 / 0.9); big ones keep `beta_feel` LAND bounce, now with the tire squash. `land` sfx re-voiced with a rubbery bounce.

### Build 225 — no stale world while a stage loads (Oct 22)
- Paulo saw the old level for a frame when starting. `_gameState='game'` was set before the async level fetch, so the previous world drew until the LDtk file came in.
- `startBetaLab` sets `B.loading=gen`; `main.js` `draw()` paints a dark veil and `update()` skips game ticks while it's set; when the stage is in, the camera snaps and `B.loadFade` (22 frames) fades the new world in.
- Checked frame by frame with a slowed level fetch: before, ~30 frames of the old bright world; now veil → fade.

### Build 224 — the music plays from the gramophone; logical sound sources (Oct 22)
- `sound16.js`: every `<audio>` track goes through one shared chain `b.mfx` (12 dB/oct low-pass, Q 0.707 → pan → gain) before the music bus; `MV_SOUND16.musicFx(ac)`.
- `beta_ambience.js` `things()`: on the stage track, the gramophone in MIND's house (home room, col 24) is the music's source: high-cut `18000/(1+d/6)^1.6 × 0.55^walls` (≥200 Hz), level ≥0.42 (× wall loss), slight pan. Item / results / title music is free again (`musicFree`).
- Stoves (home kitchen + Laitu's): positioned fire roar loop + crackle pops. Yellow cage blocks (`only==='laser'`): one hum/fizz loop placed at their weighted centre, level soft-limited `0.07·(1−e^(−1.4·Σg))`, sparks now and then.
- Drips only from rock ceilings (cave/basement skin or deep), never in a house or while MIND is in one; no cave drone in houses (`env.under=0` in a room).
- MIND's wheel rumble/grit cut to ~¼ (it read as a whoosh).

### Build 223 — chambers (Oct 22)
- Paulo: inside Laitu's house the crickets and wind were as clear as outside.
- `beta_spatial.js` `flood()`: from MIND's cell, flood-fill the air through the grid (one-way planks pass, solids stop). Reaching high open sky = outside; closing up = a chamber with volume V. A house (`B.rooms` rect) is always a chamber, and its outline counts as a 2-tile wall in `occlusion()` even through the open door.
- In a chamber: `env.inside`→1, sky ×0.15, wind ×0.08, encl ≥0.8–0.9, size = √V. The room return gets a resonant peak tuned to the size (`2600/√V` Hz, +8 dB) and darker tone; MIND's own sounds ring more.
- `beta_ambience.js`: the wind bed is low-passed down to ~800 Hz indoors; crickets / hum outside are walled off one by one by occlusion.

### Build 222 — sound from MIND's spot: distance, walls, room, wind by height (Oct 22)
- `audio.js`: `MV_SPATIAL_from(obj)` / `sfxAt(obj,name,…)` mark where a sound comes from (obj = {x,y[,w,h]} world px). ~40 enemy / block / debris / shot / water call sites now use them.
- New `js/beta_spatial.js` (after `beta_audio.js`): wraps `sfx`; positioned sounds get gain by distance (gone ~40 tiles), low-pass by distance, walls on the line through the collision grid muffle + lower them (`occlusion`), pan by side, more room send the farther. `sfx_posh.js` `bus()` honours `window.MV_SFX_ROUTE`; `beta_audio.js` one-shots (boom, splash, creak…) go through `MV_SPATIAL.take`.
- The room around MIND is measured with 16 grid rays (`MV_SPATIAL.env`: open, sky, size, encl, elev, wind, under) → room reverb + slapback echo (time from room size) on every game sound; MIND's own sounds ring in caves, dry on the street.
- Enemies moving on the ground make positioned steps / wheel rolls.
- `beta_ambience.js`: wind = `env.wind` (high + open places, higher whistle up high); hum from the nearest lamp post; crickets on real grass cells, drips from real ceilings, frogs + lapping at the real water surface — all positioned.

### Build 221 — pass 4 of the art direction: characters + tiles (Oct 22)
- `js/render.js` `drawHead`: the glowing green glass bulb of the key art (halo, gradient glass, filament ring, specular crescent + glint); the mirror enemy keeps dark red glass.
- `drawBody`: lit/shadowed cabinet bevel, woofer surround sheen, dust-cap shine. `drawWheel`: tire sheen top-left, shade underneath.
- `js/beta_decor.js` `edges()`: moonlit rim on open tile tops (green on 1.1, violet on 1.2), soft shadow under overhangs and down right sides, swaying vines (some with a flower) hanging from outdoor ledges.

### Build 220 — pass 3 of the art direction: the stage sound bed (Oct 22)
- New `js/beta_ambience.js` (after `beta_audio.js`), all Web Audio, 50 ms tick: wind gusts, crickets, power-line hum outside; cave drone + ringing drips underground (skin 4/5 or 5+ rows under `horizonRow`); lapping near water (`B.inWater` samples); 1.1 owl, 1.2 frogs.
- MIND's wheel: rolling rumble + grit by ground speed; heavy-landing thud (vy>7).
- Mix per stage in `MV_AMBIENCE.STAGE`; master 0.55×`OPT.sfxVol`, silent on pause / popups / results / off-game. `MV_AMBIENCE.state()` for tests.

### Build 219 — the rope reads taut (Oct 22)
- `js/beta_feel.js` `cordPts`: `CORD_TAUT_SLACK=16` — the first 16 px of slack draw straight; only real slack droops.
- `js/physics.js` `_vropeStep`: `VROPE_TAUT_FROM=18`, pull up to 0.97 (non-beta cord).
- `js/render.js`: a straight cord draws thinner (6/4/2) with a white strain line.

### Build 218 — calmer rope swing (Oct 22)
- Paulo: "less recoil on the rope when we release the directional buttons… more control of flight/float".
- `js/player.js` knobs: `ROPE_FREE_DRAG=0.99` (was 0.996), `ROPE_RELEASE_BRAKE_FR=22` + `ROPE_RELEASE_DRAG=0.93` (brake right after letting go of left/right).
- `js/physics.js` `_ropeApplyTension`: softer spring (0.09, cap 1.8) and a damper, `ROPE_RECOIL_ABSORB=0.7`, that soaks up the cord's snap-back speed toward the anchor.
- Measured: first back-swing after release ~30% shorter (131 px vs 189 px range).

### Build 217 — pass 2 of the art direction: key-art skies (Oct 22)
- New `js/beta_sky.js` (loaded after `beta_decor.js`): `MV_SKY.draw(B,horizonPx)` replaces the old dusk sky in `beta_decor` `sky()`.
  Pixel art painted at 1/3 scale into cached strips: dithered night bands, Van Gogh swirls + tendrils, stars, far ridge + pines, town strip (lit windows, chimneys, poles, sagging wires), parallax per layer; twinkling cross sparkles; moon on 1.2.
- Themes in `MV_SKY.THEMES` keyed by `B.stageId` (1.1 green night like the title, 1.2 violet moon night like "Deep Waters").
- `MV_SKY.post` wraps `drawDamageOverlay`: soft-light stage grade + vignette in screen space, under the HUD.

### Build 216 — pass 1 of the art direction: the title's lettering + UI; XLR hits enemies; enemy shots hit blocks (Oct 22)
- Paulo: the game should look like the title key art and the story pictures (rich pixel art, green phosphor lettering), in four passes: (1) fonts + HUD/menus, (2) stage backgrounds + lighting, (3) sound, (4) tiles + characters.
- Pass 1 (core.js): one UI face, VT323 (`assets/fonts/vt323.woff2`, OFL) as "MV Pixel", thickened, dark outline, glow in its own colour. `UI_RECOLOR` maps the old lilac/gold menu colours to the title greens (HUD colours like HP red stay). `uiPanel` = chamfered dark-green glass with a pixel frame, scanlines, corner studs, green glow when selected; `uiBar` = pixel meter; `uiLogo` = big green pixel letters with a stepped extrusion, scanlines and a light scan (opts.col to tint); `uiCursor` = the title's green ▶. Stage card banner recoloured green (ui.js drawZoneCard).
- XLR release also calls `blastEnemies()` (beta_level): enemies in a ~45° cone within 6 blocks are blown back (speed by charge, power, distance, weight), take 4-14 damage, `_thrownF` set; beta_enemies `flight()` now actually flies thrown/blown live enemies (gravity, wall bounce with a hit, hard landing, spin).
- Enemy lasers (weapons.js ESHOTS) hit blocks like MIND's (omni chipped, electro broken; push/pull just shake). Hot enemy frags chip omni blocks they slam into (beta_enemies fragTick).
