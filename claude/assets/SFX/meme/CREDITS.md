# MV2 meme SFX pack — sources, licences and game mapping

Curated by the MV2 audio subagent for CAPTAIN/Paulo's Q4 note: fetch real,
context-relevant meme sounds and wire them into the `meme` pack. Every clip here
is a **free, direct-download** asset; nothing required an account, a login or a
payment. No CC BY-NC ("non-commercial") sound was used, because a game ship is a
commercial use.

All files were transcoded with ffmpeg to **mono 22.05 kHz / 16-bit PCM WAV**,
trimmed to the shortest useful length and given a 30 ms fade-out to avoid clicks.
They lazy-load, so the pack stays cheap. Override convention:
`assets/SFX/meme/<voice>.wav` (see `claude/js/sfx_posh.js`, `MV_SFX.pack.meme`).

## What plays where

| WAV (voice) | Bytes | Game event(s) | Why it fits |
|---|---:|---|---|
| `boing.wav` | 24,334 | jump, jump_reg, jump_spring/jump_good, double_jump, land, bed_boing | the classic cartoon boing for take-offs and bouncy landings |
| `squeak.wav` | 72,844 | punch, punch_heavy, ouch | rubbery comedy squeak on a swing / a knocked-about foe |
| `pipe.wav` | 55,512 | hit, punch_hit | the metal-pipe-hit meme: a dropping metal tool clanging down |
| `ow.wav` | 21,512 | hurt, player_hit | an actual "Ow!" voice cry when a hero takes damage |
| `ding.wav` | 52,998 | knowl_pickup, crystal_pickup, knowl, item_clink, ping, extra_life, unlock | bright achievement bell for pickups and unlocks |
| `click.wav` | 26,538 | grap_attach, hook_latch, click, swap, reel_in/out, confirm | crisp mechanical click for an item hooking on / swapping |
| `blip.wav` | 24,774 | menu | short positive UI beep for menu navigation |
| `laugh.wav` | 80,078 | enemy_alert, enemy_huh | cartoon monkey mocking laugh when a foe spots or loses MIND |
| `trombone.wav` | 132,378 | shutdown, enemy_dead | the iconic sad trombone for death / permanent shutdown |
| `wah.wav` | 88,278 | enemy_shut | slow sad-trombone "wah" for a temporary shutdown |
| `impact.wav` | 34,036 | hit_enemy, punch_hit_heavy | metal-hammer impact on a connected enemy/boss hit |
| `vineboom.wav` | 88,278 | laser_charged_fire, frag_fire, omniblock_shatter | big cinematic boom, the "vine boom" punctuation for heavy hits |
| `whoosh.wav` | 77,550 | whoosh, rope_throw, punch_whiff | fast whoosh for turbo/rev, thrown rope and a missed swing |
| `scratch.wav` | 48,978 | hook_miss | a record scratch for a whiffed grappling hook |

## Source + licence per clip

| WAV | Original asset | Source page | Licence |
|---|---|---|---|
| `boing.wav` | "Boing" (freesound_community), txid 101318 | https://pixabay.com/sound-effects/film-special-effects-boing-101318/ | **Pixabay Content License** — free for commercial + non-commercial use, no attribution required; not for standalone resale/redistribution. |
| `squeak.wav` | Mixkit #1013 "Rubber fast squeak" | https://mixkit.co/free-sound-effects/squeak/ | **Mixkit Sound Effects Free License** — commercial use (video games named), no attribution; no standalone redistribution. |
| `pipe.wav` | Mixkit #835 "Metal tool drop" | https://mixkit.co/free-sound-effects/metal/ | Mixkit Sound Effects Free License |
| `ow.wav` | Mixkit #2204 "Ow exclamation of pain" | https://mixkit.co/free-sound-effects/pain/ | Mixkit Sound Effects Free License |
| `ding.wav` | Mixkit #600 "Achievement bell" | https://mixkit.co/free-sound-effects/bell/ | Mixkit Sound Effects Free License |
| `click.wav` | Mixkit #1131 "Mechanical tool click" | https://mixkit.co/free-sound-effects/mechanical/ | Mixkit Sound Effects Free License |
| `blip.wav` | Mixkit #221 "Positive interface beep" | https://mixkit.co/free-sound-effects/beep/ | Mixkit Sound Effects Free License |
| `laugh.wav` | Mixkit #107 "Cartoon monkey mocking laugh" | https://mixkit.co/free-sound-effects/monkey/ | Mixkit Sound Effects Free License |
| `trombone.wav` | "Sad Trombone" by Alexander | https://orangefreesounds.com/sad-trombone/ | **Public Domain / CC0 1.0** (explicitly stated on the asset page) — the one true public-domain meme clip here. |
| `wah.wav` | Mixkit #472 "Slow sad trombone fail" | https://mixkit.co/free-sound-effects/sad/ | Mixkit Sound Effects Free License |
| `impact.wav` | Mixkit #833 "Metal hammer hit" | https://mixkit.co/free-sound-effects/impact/ | Mixkit Sound Effects Free License |
| `vineboom.wav` | Mixkit #788 "Big cinematic impact" | https://mixkit.co/free-sound-effects/impact/ | Mixkit Sound Effects Free License |
| `whoosh.wav` | Mixkit #1490 "Fast whoosh transition" | https://mixkit.co/free-sound-effects/whoosh/ | Mixkit Sound Effects Free License |
| `scratch.wav` | Mixkit #702 "Record player vinyl scratch" | https://mixkit.co/free-sound-effects/scratch/ | Mixkit Sound Effects Free License |

Licence references:
- Mixkit Sound Effects Free License: https://mixkit.co/license/#sfxFree
- Pixabay Content License: https://pixabay.com/service/license/
- CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/

## Sources checked and deliberately skipped

- **VoiceMod install** (`C:\Program Files\Voicemod V3`): contains only the launcher,
  driver and updater — **no bundled wav/mp3 effects**. The Voicemod V3 user cache
  (`%LOCALAPPDATA%\VoicemodV3\cache`) does hold meme-looking names
  (`Prankster - 03 - Honk.ogg`, `Prankster - 05 - Sad Trombone.ogg`,
  `Prankster - 28 - Fart.ogg`, plus ~600 `.dat` voice/pack assets), but every one
  is **encrypted/proprietary** — they begin with a custom `7D 54 50 35` header
  rather than `OggS`/`RIFF`, so ffmpeg cannot decode them and rights are unclear.
  One other cached `.ogg` is a real 0.46 s Opus clip with a hash-only filename
  and no licence information; skipped for the same reason. Nothing was modified
  in the VoiceMod install; only read/copied.
- **orangefreesounds.com**: most of its "Boing", "Metal Pipe", "Record Scratch",
  and squeak clips have been relicensed **CC BY-NC 4.0 (non-commercial)** — skipped
  because a shipped game is commercial use. Only the older CC0 "Sad Trombone"
  was kept.
- **freesound.org** direct downloads need an account — skipped; the CC0-style
  Pixabay mirror of a freesound-community boing was used instead.
