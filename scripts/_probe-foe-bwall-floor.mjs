#!/usr/bin/env node
/**
 * T606: foes treat omni/push BWALLS as floor everywhere (not Laitu-only).
 * Places an omni (then a push) on solid floor + foe A on the block top;
 * after update ticks feet must stay on the block top (not sink through to the
 * tile). Then clears the block — foe must drop onto the tile below.
 * Own free port — never touches PLAY on 8765.
 */
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ldtk': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
};
const srv = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent((req.url || '/').split('?')[0]);
    if (path === '/') path = '/index.html';
    const data = await readFile(join(ROOT, path.replace(/^\//, '').replace(/\.\./g, '')));
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
await page.route(/\.(mp3|ogg|m4a)(\?|$)/, (r) => r.fulfill({ status: 404, body: '' }));
await page.goto(`http://127.0.0.1:${port}/index.html?ci=1&tv=0`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof startBetaLab === 'function' && typeof mkP === 'function', null, { timeout: 30000 });
await page.evaluate(async () => {
  try { if (window.MV_SIBLING) MV_SIBLING.on = false; } catch (e) {}
  await startBetaLab('1.1', 15, { fresh: true });
});
await page.waitForFunction(() => window.MV_BETA && MV_BETA.stageId === '1.1' && !MV_BETA.loading && MV_GRID && MV_GRID.ready && p, null, { timeout: 30000 });

const r = await page.evaluate(() => {
  const T = 32, B = MV_BETA;
  _loopAccT = -1e15;
  window.applyPlayerHit = function () {};
  const safe = () => { p.hp = 100; p.inv = 9999; B.hasIsolator = true; B.popup = null; B.freeze = 0; B.trans = null; };
  const step = (n) => { for (let i = 0; i < n; i++) { safe(); update(); } };

  // Solid floor with open air above — block rests on the tile (doesn't fall away).
  let col = null, floorRow = null;
  outer: for (let r0 = 12; r0 < 55; r0++) {
    for (let c0 = 12; c0 < 100; c0++) {
      if (!gridSolid(c0, r0) || gridSolid(c0, r0 - 1) || gridSolid(c0, r0 - 2)) continue;
      if (typeof gridIsSlope === 'function' && (gridIsSlope(c0, r0) || gridIsSlope(c0, r0 - 1))) continue;
      let hit = false;
      for (const bw of BWALLS) {
        if (!(bw.hp > 0)) continue;
        if (Math.abs((bw.homeCol ?? -999) - c0) <= 1 && Math.abs((bw.homeRow ?? -999) - (r0 - 1)) <= 1) { hit = true; break; }
      }
      if (hit) continue;
      col = c0; floorRow = r0; break outer;
    }
  }
  if (col == null) return { ok: false, err: 'no solid floor with air above' };

  for (let i = ENEMS.length - 1; i >= 0; i--) if (ENEMS[i] && ENEMS[i]._ai) ENEMS.splice(i, 1);

  function trial(kind) {
    const made = B.placeEntity('Box', col, floorRow - 1, { kind });
    const bw = made && made.bwalls && made.bwalls[0];
    if (!bw || !(bw.hp > 0)) return { ok: false, err: kind + ' not placed' };
    // Keep the block parked (no cube fall / push physics drift for the probe)
    bw.stay = true; bw.wedge = true; bw.vx = 0; bw.vy = 0; bw._fly = false;
    const tileTop = floorRow * T;
    const blockTop = bw.y;
    const e = B.mkAiEnemy('circle', bw.x + bw.w / 2, bw.y, { range: 2 * T });
    e.og = true; e._falling = false; e.vy = 0; e.vx = 0; e.dir = 1; e.heat = 0; e.fuse = 0;
    ENEMS.push(e);
    step(100);
    const feet = e.y + e.h;
    const onBlock = Math.abs(feet - blockTop) <= 8;
    const sunkToTile = Math.abs(feet - tileTop) <= 8 && feet > blockTop + 12;
    // Clear block — should drop to the tile
    bw.hp = 0;
    e.og = false; e._falling = true; e.vy = 0.5;
    step(80);
    const feet2 = e.y + e.h;
    const droppedToTile = Math.abs(feet2 - tileTop) <= 10;
    // Remove the test foe
    const ix = ENEMS.indexOf(e); if (ix >= 0) ENEMS.splice(ix, 1);
    return {
      kind, blockTop, tileTop, feet, feet2,
      onBlock, sunkToTile, droppedToTile,
      ok: onBlock && !sunkToTile && droppedToTile,
    };
  }

  const omni = trial('omni');
  const push = trial('push');
  return {
    ok: !!(omni.ok && push.ok),
    col, floorRow, omni, push,
  };
});

await browser.close();
srv.close();
console.log(JSON.stringify({ ...r, errors }, null, 2));
process.exit(r && r.ok && !errors.length ? 0 : 1);
