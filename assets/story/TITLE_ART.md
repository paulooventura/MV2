# Title screen art

## Files

| File | Role |
|------|------|
| `title-key-art.png` | Static source illustration |
| `title-bg.gif` | Animated background in-game |

The game cycles `title-frame-00.png` … `title-frame-11.png` on the title screen (canvas cannot play GIFs). `title-bg.gif` is also exported for use outside the game.

## Rebuild the GIF

After updating `title-key-art.png`:

```powershell
powershell -ExecutionPolicy Bypass -File misc/make-title-gif.ps1
```

Hard-refresh the game (Ctrl+F5).

## Notes

- Movement (stars, sign eye, windows) is baked into the GIF frames.
- Menu rows are drawn in code on top of the art.
