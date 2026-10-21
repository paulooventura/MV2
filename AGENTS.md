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
