# Claude — Mind & Venture (MV2)

You are in Paulo Ventura’s **Mind & Venture** repo. Before changing code:

1. Read **`GAME-BRIEF.md`** (lore, physics numbers, sprites, maps, open work, how far we are).
2. Read **`AGENTS.md`** (module map, selftest, A/B labs, deploy).

## Hard rules

- **Awdjoo (`index.html`) is the live game.** Labs B–F are experiments. Do not promote a lab over A unless Wall says so.
- Collision = typed grid (`js/collision_grid.js`). If the player wedges, fix the grid — do not retune `vx`.
- Feel knobs = top of `js/physics.js` + `_updatePlayerMoveX` in `js/player.js`.
- QA = `npm run selftest` (or `selftest:quick`). Do not ask for F12 pastes.
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

`index.html` only loads scripts. Do not rebuild a monolith.
