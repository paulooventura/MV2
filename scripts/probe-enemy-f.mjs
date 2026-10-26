#!/usr/bin/env node
/**
 * T136 — Enemy F (Paulo's version) in 1.2's pool.
 * Asserts: one F in the water, dormant while the hero is far; wakes when he comes near;
 * its core pulls a cube in and pushes it out (and shoves the hero); the pool's water volume
 * stays the same; non-punch damage and core punches don't hurt it; 6 notch punches collapse
 * it; the collapse surges the water, throws cubes, crumbles nearby omni blocks and removes it;
 * no page errors.
 *
 * Usage: node scripts/probe-enemy-f.mjs   (headless, own free port, exit 0 = PASS)
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
let out;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  await page.route(/\.(mp3|ogg|m4a)(\?|$)/, (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto(`http://127.0.0.1:${port}/index.html?ci=1&tv=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof startBetaLab === 'function' && typeof mkP === 'function' && window.MV_ENEMY_F, null, { timeout: 30000 });
  await page.evaluate(async () => { try { if (window.MV_SIBLING) MV_SIBLING.on = false; } catch (e) {} await startBetaLab('1.2', 15, { fresh: true }); });
  await page.waitForFunction(() => window.MV_BETA && MV_BETA.stageId === '1.2' && !MV_BETA.loading && MV_GRID && MV_GRID.ready && p && MV_BETA.fluid && MV_BETA.fluid.ready, null, { timeout: 30000 });
  out = await page.evaluate(() => {
    const B = MV_BETA, T = MV_GRID.tile, r = {};
    _loopAccT = -1e15; window.applyPlayerHit = function () {};
    const safe = () => { p.hp = 100; p.inv = 9999; B.hasIsolator = true; B.popup = null; B.freeze = 0; B.trans = null; };
    const step = (n, cb) => { for (let i = 0; i < n; i++) { safe(); update(); if (cb && cb() === false) return i; } return n; };
    const vol = () => { const f = B.fluidTotal(); return f.water + f.lost + f.vapor + f.drops + f.mag + f.core; };
    const fs = MV_ENEMY_F.list();
    r.count = fs.length;
    const e = fs[0]; if (!e) return r;
    // keep the rest of the cast out of it
    for (let i = ENEMS.length - 1; i >= 0; i--) if (ENEMS[i] !== e) ENEMS.splice(i, 1);
    const core = () => ({ x: e.x + e.w / 2, y: e.y + e.h / 2 });
    const free = (x, y) => !gridWorldSolid(x, y) && !gridWorldSolid(x, y - 60) && !gridWorldSolid(x - 14, y - 30) && !gridWorldSolid(x + 14, y - 30);
    const heroY = core().y + 20;
    const heroAt = (d) => { const c = core(); for (const s of [-1, 1]) { const x = c.x + s * d, y = heroY; if (free(x, y - 2) && free(x + s * 50, y - 2) && free(x + s * 100, y - 2)) { p.x = x - SW / 2; p.y = y - FEET_OFF; p.vx = p.vy = 0; return s; } } return 0; };
    r.inWater = !!B.inWater(core().x, core().y);
    // dormant while the hero is far
    step(90);
    r.farState = e.st; r.farPhase = e.fPh;
    // a loose cube on the pool floor near it, and an omni block for the passage
    const c0 = core();
    const vol0 = vol();
    // the hero comes near (in the water, left of it)
    r.heroSide = heroAt(170);
    const woke = step(60, () => e.st !== 'hunt');
    r.wokeIn = woke; r.nearState = e.st;
    // just before a pull phase: a cube within reach, in open water beside it
    step(400, () => { heroAt(170); return (e.fT % MV_ENEMY_F.CYCLE) !== MV_ENEMY_F.CYCLE - 1; });
    let cube = null;
    for (const s of [-r.heroSide || 1, r.heroSide || -1]) for (const dy of [0, -1, 1]) {
      if (cube) break;
      const cc = Math.floor((core().x + s * 130) / T), cr = Math.floor(core().y / T) + dy;
      if (gridSolid(cc, cr)) continue;
      const made = B.placeEntity('Box', cc, cr, { kind: 'omni' }); cube = made && made.bwalls[0];
    }
    r.cubePlaced = !!cube;
    const dist = () => cube ? Math.hypot(cube.x + T / 2 - core().x, cube.y + T / 2 - core().y) : NaN;
    step(1);
    r.pullStartDist = dist();
    let minPull = 1e9, maxPush = 0, heroKick = 0;
    for (let i = 0; i < 300; i++) {
      // hold the hero near so it stays awake
      heroAt(170);
      const t = e.fT % MV_ENEMY_F.CYCLE; const vx0 = p.vx;
      step(1);
      const t2 = e.fT % MV_ENEMY_F.CYCLE;
      if (t2 < 120) minPull = Math.min(minPull, dist());
      if (t2 >= 150 && t2 < 220) maxPush = Math.max(maxPush, dist());
      if (t2 === 150) heroKick = p.vx - vx0;
      p.vx = p.vy = 0;
    }
    r.loopEnd = { st: e.st, fT: e.fT, ph: e.fPh, wet: !!B.inWater(core().x, core().y), cx: Math.round(core().x), cy: Math.round(core().y), hx: Math.round(p.x + SW / 2), hy: Math.round(p.y + FEET_OFF) };
    r.minPullDist = minPull; r.maxPushDist = maxPush; r.heroKickVx = heroKick; r.heroShoved = e.fShoved || 0;
    // the hero, left free through the next burst: pushed away from the core
    step(400, () => (e.fT % MV_ENEMY_F.CYCLE) !== 148);
    r.heroSide2 = heroAt(150);
    const cx0 = core().x, hx0 = p.x + SW / 2 - cx0;
    step(16);
    r.heroAwayPx = Math.abs(p.x + SW / 2 - cx0) - Math.abs(hx0);
    r.stats = e.fStat;
    r.volDrift = vol() - vol0; r.vol0 = vol0;
    // damage that isn't a notch punch: nothing
    const hp0 = e.hp; _damageEnemy(e, 999, core().x, core().y, 1);
    step(1);
    r.shotIgnored = e.alive && e.hp === hp0 && e.notch.every((n) => !n);
    // a punch on the core: a clink
    _damageEnemy(e, 15, core().x, core().y, 1); _punchConnect(core().x, core().y, 0, false, 'enemy');
    r.corePunchIgnored = e.notch.every((n) => !n);
    // an omni block near it (the passage) and remember the cube
    const oc = Math.floor((core().x - 60) / T), orow = Math.floor((core().y - 70) / T);
    const om = B.placeEntity('Box', oc, orow, { kind: 'omni' }); const omni = om && om.bwalls[0];
    r.omniPlaced = !!omni;
    // 6 notch punches (the same calls render.js makes when a fist lands)
    const after = [];
    for (let i = 0; i < 6; i++) {
      const q = MV_ENEMY_F.notchPos(e, i);
      _damageEnemy(e, 15, p.x + SW / 2, p.y + FEET_OFF, 1);
      _punchConnect(q.x, q.y, 0, i === 5, 'enemy');
      after.push(e.notch.filter(Boolean).length);
      if (i < 5) { r['aliveAfter' + (i + 1)] = e.alive; step(2); }
    }
    r.notchCounts = after;
    r.collapsed = !e.alive && e.fColT != null;
    r.react = e.fReact;
    r.downCount = B.enemyFDown;
    const volC = vol();
    step(70);
    r.removed = ENEMS.indexOf(e) < 0;
    r.omniBroken = omni ? omni.hp <= 0 : null;
    r.volDriftCollapse = vol() - volC;
    r.volDriftTotal = vol() - vol0;
    return r;
  });
  // 1.3's water cube is the same F (smoke: it's upgraded and runs near the hero with no errors)
  const p3 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  p3.on('pageerror', (e) => errors.push('1.3: ' + String(e && e.message || e)));
  await p3.route(/\.(mp3|ogg|m4a)(\?|$)/, (r) => r.fulfill({ status: 404, body: '' }));
  await p3.goto(`http://127.0.0.1:${port}/claude/play-1-3.html?ci=1&tv=0`, { waitUntil: 'domcontentloaded' });
  await p3.waitForFunction(() => typeof startBetaLab === 'function' && window.MV_ENEMY_F, null, { timeout: 30000 });
  await p3.evaluate(async () => { try { if (window.MV_SIBLING) MV_SIBLING.on = false; } catch (e) {} await startBetaLab('1.3', 15, { fresh: true }); });
  await p3.waitForFunction(() => window.MV_BETA && MV_BETA.stageId === '1.3' && !MV_BETA.loading && MV_GRID && MV_GRID.ready && p, null, { timeout: 30000 });
  out.s13 = await p3.evaluate(() => {
    const B = MV_BETA; _loopAccT = -1e15; window.applyPlayerHit = function () {};
    const fs = MV_ENEMY_F.list(), e = fs[0]; if (!e) return { count: 0 };
    p.x = e.x + e.w / 2 - 160 - SW / 2; p.y = e.y + e.h - FEET_OFF;
    for (let i = 0; i < 400; i++) { p.hp = 100; p.inv = 9999; B.hasIsolator = true; B.popup = null; B.freeze = 0; B.trans = null; update(); if (typeof draw === 'function' && i % 50 === 0) draw(); }
    return { count: fs.length, notches: e.notch.length, alive: e.alive, st: e.st };
  });
} finally { await browser.close(); srv.close(); }

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
ok(out.count === 1, 'exactly one Enemy F in 1.2');
ok(out.inWater, 'F starts in the water');
ok(out.farState === 'sleep' && out.farPhase === 'sleep', 'dormant while the hero is far');
ok(out.nearState === 'hunt' && out.wokeIn < 60, 'wakes when the hero comes near');
ok(out.cubePlaced, 'test cube placed');
ok(out.minPullDist < out.pullStartDist - 10, 'pull draws the cube in');
ok(out.maxPushDist > out.minPullDist + 30, 'push throws the cube out');
ok(out.heroShoved > 0 && out.heroAwayPx > 20, 'push shoves the hero away');
ok(Math.abs(out.volDrift) < Math.max(0.05, out.vol0 * 1e-4), 'water volume unchanged by push/pull');
ok(out.shotIgnored, 'non-punch damage does nothing');
ok(out.corePunchIgnored, 'a punch on the core clinks');
ok([1, 2, 3, 4, 5].every((i) => out['aliveAfter' + i] === true), 'alive until the 6th notch');
ok(JSON.stringify(out.notchCounts) === '[1,2,3,4,5,6]', 'each punch breaks one notch');
ok(out.collapsed, 'collapses after 6 notches');
ok(out.react && out.react.water > 0, 'collapse surges the water');
ok(out.omniBroken === true, 'collapse crumbles the nearby omni block (passage)');
ok(out.removed, 'gone after the collapse');
ok(Math.abs(out.volDriftTotal) < Math.max(0.05, out.vol0 * 1e-4), 'water volume unchanged through the collapse');
ok(out.s13 && out.s13.count === 1 && out.s13.notches === 6, '1.3 water cube is the same F');
ok(errors.length === 0, 'no page errors');
console.log(JSON.stringify({ ...out, errors }, null, 1));
console.log(fails.length ? 'FAIL:\n - ' + fails.join('\n - ') : 'PASS: enemy F');
process.exit(fails.length ? 1 : 0);
