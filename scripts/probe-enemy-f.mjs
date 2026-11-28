#!/usr/bin/env node
/**
 * Enemy F (the water hexagon, T136) — smoke probe for what it is TODAY.
 * Builds 318 / 348 / 368 replaced Paulo's notch rules: the hexagon is now beta_foes' 'cube' foe
 * (hit for 3 s after it wakes by loaded hits and the kiritsuke), so the old notch/pull/push asserts
 * (`_fx`, 6 notch punches) no longer apply. What still has to hold:
 *   - 1.2's pool has exactly one cube foe, in the water, placed by beta_enemy_f.js
 *   - it wakes near the hero and 600 frames of play leave it out of rock, with no page errors
 *   - MV_ENEMY_F.collapse still works: the foe goes down for good, its surge keeps the pool's volume
 *   - 1.3's water cube exists and runs 400 frames near the hero with no errors
 * Usage: node scripts/probe-enemy-f.mjs   (headless, muted, own free port, exit 0 = PASS)
 */
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ldtk': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const srv = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent((req.url || '/').split('?')[0]); if (path === '/') path = '/index.html';
    const data = await readFile(join(ROOT, path.replace(/^\//, '').replace(/\.\./g, '')));
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
const errors = [];
const out = {};

async function stage(lvl, fn) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(lvl + ': ' + String(e && e.message || e)));
  await page.route(/\.(mp3|ogg|m4a)(\?|$)/, (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto(`http://127.0.0.1:${port}/index.html?ci=1&tv=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof startBetaLab === 'function' && typeof mkP === 'function' && window.MV_ENEMY_F, null, { timeout: 30000 });
  await page.evaluate(async (id) => { try { if (window.MV_SIBLING) MV_SIBLING.on = false; } catch (e) {} await startBetaLab(id, 15, { fresh: true }); }, lvl);
  await page.waitForFunction((id) => window.MV_BETA && MV_BETA.stageId === id && !MV_BETA.loading && MV_GRID && MV_GRID.ready && p, lvl, { timeout: 30000 });
  const r = await page.evaluate(fn);
  await page.close();
  return r;
}

const run = () => {
  const B = MV_BETA, G = MV_GRID, T = G.tile, r = {};
  _loopAccT = -1e15; window.applyPlayerHit = function () {};
  const safe = () => { p.hp = 100; p.inv = 9999; B.hasIsolator = true; B.popup = null; B.freeze = 0; B.trans = null; };
  const step = (n, cb) => { for (let i = 0; i < n; i++) { safe(); update(); if (cb) cb(); } };
  const vol = () => { const f = B.fluidTotal ? B.fluidTotal() : null; return f ? f.water + f.lost + f.vapor + f.drops + f.mag + f.core : 0; };
  const cubes = () => ENEMS.filter((e) => e && e._ai === 'cube');
  r.count = cubes().length;
  const e = cubes()[0]; if (!e) return r;
  for (let i = ENEMS.length - 1; i >= 0; i--) if (ENEMS[i] !== e) ENEMS.splice(i, 1);   // the rest of the cast stays out of it
  const core = () => ({ x: e.x + e.w / 2, y: e.y + e.h / 2 });
  r.inWater = !!(B.inWater && B.inWater(core().x, core().y));
  const rockDepth = () => { let w = 0; const x = e.x, y = e.y; for (let rr = Math.floor(y / T); rr <= Math.floor((y + e.h - 1) / T); rr++) for (let c = Math.floor(x / T); c <= Math.floor((x + e.w - 1) / T); c++) { if (!gridSolid(c, rr)) continue; w = Math.max(w, Math.min(x + e.w, (c + 1) * T) - Math.max(x, c * T), 0); } return w; };
  // the hero comes near, in the water beside it
  const c0 = core(); p.x = c0.x - 170 - SW / 2; p.y = c0.y + 20 - FEET_OFF; p.vx = p.vy = 0;
  const vol0 = vol();
  let worst = 0, woke = false;
  step(600, () => { if (e.st !== 'sleep') woke = true; worst = Math.max(worst, Math.min(rockDepth(), e.w)); p.vx = p.vy = 0; });
  r.awake = woke; r.st = e.st; r.stillAlive = e.alive; r.rockPx = worst;
  r.volDrift = vol() - vol0; r.vol0 = vol0;
  // the collapse
  if (MV_ENEMY_F.collapse) { try { MV_ENEMY_F.collapse(e); } catch (er) { r.collapseErr = String(er && er.message || er); } }
  step(90);
  r.down = !e.alive; r.removed = ENEMS.indexOf(e) < 0 || !e.alive;
  r.volDriftCollapse = vol() - vol0;
  return r;
};

try {
  out.s12 = await stage('1.2', run);
  out.s13 = await stage('1.3', () => {
    const B = MV_BETA; _loopAccT = -1e15; window.applyPlayerHit = function () {};
    const e = ENEMS.find((o) => o && o._ai === 'cube'); if (!e) return { count: 0 };
    p.x = e.x + e.w / 2 - 160 - SW / 2; p.y = e.y + e.h - FEET_OFF;
    for (let i = 0; i < 400; i++) { p.hp = 100; p.inv = 9999; B.hasIsolator = true; B.popup = null; B.freeze = 0; B.trans = null; update(); }
    return { count: 1, alive: e.alive };
  });
} finally { await browser.close(); srv.close(); }

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const a = out.s12 || {};
ok(a.count === 1, 'exactly one water-cube foe (Enemy F) in 1.2');
ok(a.inWater, 'it starts in the pool');
ok(a.awake, 'it leaves its sleep state while the hero is near (zaps)');
ok(a.rockPx <= 8, 'it never sinks into rock (worst ' + a.rockPx + 'px)');
ok(Math.abs(a.volDrift) < Math.max(0.5, (a.vol0 || 0) * 1e-3), 'pool volume unchanged by its play');
ok(!a.collapseErr, 'collapse runs without an error ' + (a.collapseErr || ''));
ok(a.down && a.removed, 'MV_ENEMY_F.collapse takes it down');
ok(Math.abs(a.volDriftCollapse) < Math.max(1, (a.vol0 || 0) * 1e-3), 'pool volume unchanged through the collapse');
ok(out.s13 && out.s13.count === 1, "1.3's water cube exists and runs 400 frames");
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join(' | '));
console.log(JSON.stringify({ ...out, errors }, null, 1));
console.log(fails.length ? 'FAIL:\n - ' + fails.join('\n - ') : 'PASS: enemy F (water cube foe)');
process.exit(fails.length ? 1 : 0);
