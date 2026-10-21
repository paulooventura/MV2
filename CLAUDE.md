# Claude — Mind & Venture (MV2)

You are in Paulo Ventura’s **Mind & Venture** repo. Before changing code:

1. Read **`GAME-BRIEF.md`** (lore, physics numbers, sprites, maps, open work, how far we are).
2. Read **`AGENTS.md`** (module map, selftest, A/B labs, deploy).

## Hard rules

- **Since Oct 20 2026 the live game is Claude's build 209**: `index.html` is `claude/index.html` plus `<base href="claude/">`, so it runs `claude/js/` + `claude/assets/` (Wall's call). Edit the game in `claude/`, and keep `index.html` in sync with `claude/index.html` (same file + the base tag). Build 168 (co-op/VS, water play, phone/PC screen fit, `beta/js/`) lives at `awdjoo-168.html` until it is merged into `claude/`; `npm run selftest:flow` tests that page.
- **Awdjoo (`awdjoo-168.html`, was `index.html`).** Since build 162 (Wall promoted the L1 beta, Oct 2026) it runs the `beta/js/` modules (water, cubes, towns 1.1 → 1.2) on top of shared `js/`. The old Awdjoo lives on as lab G (`awdjoo-classic.html`). Labs B–G are experiments. Do not promote a lab over A unless Wall says so.
- Collision = typed grid (`js/collision_grid.js`). If the player wedges, fix the grid — do not retune `vx`.
- Feel knobs = top of `js/physics.js` + `_updatePlayerMoveX` in `js/player.js`.
- QA = `npm run selftest` (or `selftest:quick`) for the shared engine (runs on `awdjoo-classic.html`), plus `npm run selftest:flow` for the live menus (splashes, title, pause, shut-down, journeys, game over, hints, full-window layout). Do not ask for F12 pastes.
- Do **not** open Simple Browser / extra play tabs on `:8765` (BGM stacks).
- Venture’s hat is **black like Mind’s**, back brim only (laid-down P) — not red.
- After substantive game work: commit and push `main` (GitHub Pages).

## First files to open for a typical ask

| Ask | File |
|-----|------|
| Movement / slopes / hook ray | `js/physics.js` |
| Walk accel, companion, items | `js/player.js` |
| Stuck / tiles | `js/collision_grid.js` |
| Jacks, boxes, knowls | `js/weapons.js` |
| Draw / hats / jacks | `js/render.js` |
| Awdjoo spawn / RCA / exit | `js/awdjoo_level.js` |
| Piskel cave lab | `js/sketch_lab.js` |
| LDtk loader lab | `js/ldtk_loader.js` |
| Live stages 1.1/1.2, cubes, MAG carry | `beta/js/beta_level.js` |
| Water, moving platforms, Isolator | `beta/js/beta_water.js` |
| Splashes, title, pause menu, shut-down, game over | `beta/js/beta_intro.js` |
| Save slots (Journeys: delete / copy / paste) | `beta/js/beta_slots.js` |
| Button hints per device (keyboard vs pad) | `beta/js/beta_input.js` |
| MAG holds water / XLR blows air pockets / puddles | `beta/js/beta_waterplay.js` |
| Phone ABXY (one thumb on X + A = run + jump) | `beta/js/beta_touch.js` |
| Rope latches on surfaces it sweeps through while moving | `beta/js/beta_feel.js` (`ropeSweepLatch`) |

`index.html` only loads scripts. Do not rebuild a monolith.
