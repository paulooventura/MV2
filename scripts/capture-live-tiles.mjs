// Capture the tiles the live game draws in code (dirt, stone, cave, brick, roof, wood, scales, the 1.3 towers)
// into claude/assets/tilesets-live/, so the Art Board can show and edit "our actual game" tiles
// (Paulo 2026-11-27). Headless and muted; reads the game from the MV2 tools server (port 8931) or a file URL.
//   node scripts/capture-live-tiles.mjs [baseUrl]
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'claude');
const out = path.join(root, 'assets', 'tilesets-live');
const base = process.argv[2] || 'http://127.0.0.1:8931/';
const url = (base.startsWith('http') ? base : pathToFileURL(root + '/').href) + 'index.html?selftest=1&nosplash=1';

const GROUP = { dirt: 'Ground · dirt (every stage)', stone: 'Basement stone', cave: 'Cave', brick: 'House brick',
  roof: 'Roof shingles', roofTop: 'Roof shingles', wood: 'House interior planks', scales: 'Stage 1.2 pink scales',
  scalesTop: 'Stage 1.2 pink scales' };

const b = await chromium.launch({ args: ['--mute-audio'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
await p.goto(url, { waitUntil: 'load' });
await p.waitForFunction(() => window.MV_BETA_DECOR && window.MV_BETA_DECOR.tileTextures, null, { timeout: 30000 });
const shot = await p.evaluate(() => {
  const L = window.MV_BETA_DECOR.tileTextures().map(t => ({ name: t.name, data: t.canvas.toDataURL('image/png'), skinned: t.skinned }));
  const city = [];
  if (window.MV_CITY && MV_CITY.img) {
    const kinds = { 7: 'residential', 8: 'commercial', 9: 'tech' };
    for (const s of [7, 8, 9]) for (const top of [true, false]) for (let i = 0; i < 4; i++) {
      try { const im = MV_CITY.img(10 + i, 20 + i * 3, s, top); if (im && im.toDataURL) city.push({ name: 'city.' + kinds[s] + (top ? '.top' : '') + '.' + i, data: im.toDataURL('image/png') }); } catch (e) {}
    }
  }
  return { tiles: L, city };
});
await b.close();

fs.mkdirSync(out, { recursive: true });
const manifest = [];
for (const t of shot.tiles) {
  const file = t.name.replace(/[^A-Za-z0-9.]+/g, '-') + '.png';
  fs.writeFileSync(path.join(out, file), Buffer.from(t.data.split(',')[1], 'base64'));
  manifest.push({ name: t.name, group: GROUP[t.name.split('.')[0]] || t.name, file: 'assets/tilesets-live/' + file, skin: true });
}
for (const t of shot.city) {
  const file = t.name.replace(/[^A-Za-z0-9.]+/g, '-') + '.png';
  fs.writeFileSync(path.join(out, file), Buffer.from(t.data.split(',')[1], 'base64'));
  manifest.push({ name: t.name, group: 'Stage 1.3 towers (by position: view and ask)', file: 'assets/tilesets-live/' + file, skin: false });
}
fs.writeFileSync(path.join(out, 'live-tiles.json'), JSON.stringify({ at: new Date().toISOString(), tile: 32, tiles: manifest }, null, 1));
console.log(`captured ${shot.tiles.length} code-drawn tiles + ${shot.city.length} tower tiles -> ${out}` + (errs.length ? `\npage errors: ${errs.slice(0, 3).join(' | ')}` : ''));
