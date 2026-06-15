# Parallax Backgrounds — drop-in convention

Each background "set" is a folder here. The current map's set is chosen by the
Tiled map custom property `bgset` (string). If the map has no `bgset` property,
the default set `beastlands` is used.

## File naming

Inside a set folder, name files exactly:

```
assets/backgrounds/<set>/layer1.png   <- farthest, slowest  (5% of camera speed)
assets/backgrounds/<set>/layer2.png   <- 15%
assets/backgrounds/<set>/layer3.png   <- 30%
assets/backgrounds/<set>/layer4.png   <- 50%
assets/backgrounds/<set>/layer5.png   <- 65%
assets/backgrounds/<set>/layer6.png   <- nearest, fastest   (80%)
```

- Use as many or as few layers as you want — missing files are skipped.
- Layers tile (repeat) horizontally, so **left and right edges must match**
  (see the cribsheet for how to get this out of Midjourney).
- Images are scaled to fit the view height, so any resolution works.
  Recommended: **2048×1280 or wider**. Wider = less visible repetition.
- PNG with transparency works great for mid/near layers (e.g. layer4-6 as
  silhouetted trees/structures with transparent sky, over a solid layer1 sky).
- After adding files: hard refresh the game (Ctrl+F5).

## Quick start

1. Generate art (see `docs/midjourney-cribsheet.md`).
2. Save the sky/farthest image as `beastlands/layer1.png`.
3. Save a mountains/skyline image as `beastlands/layer2.png`.
4. Ctrl+F5 — done.
