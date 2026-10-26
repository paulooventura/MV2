#!/usr/bin/env node
/**
 * Items probes (T132) — headless, on the LIVE build (index.html → claude/).
 *
 *   trsRicochet  — a TRS shot into a wall bounces (≥2 times), never sits in rock, then fizzles
 *   megOne       — the MEG holds one thing; the pull stops on everything else while holding
 *   megSwing     — swinging the aim while holding throws the block along the swing
 *   megStow      — switching away from the MEG plays the glove's arm-to-back carry
 *   foesTake     — a shutdown drops the jack in hand; an enemy touching a loose TRS takes it,
 *                  fires it at MIND, and drops it when shut down
 *
 * Exit 0 = all PASS. Usage: node scripts/probe-items.mjs [--lvl=1.2]
 */
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const arg = (k) => { const a = process.argv.find((s) => s.startsWith('--' + k + '=')); return a ? a.split('=')[1] : null; };
const LVL = arg('lvl') || '1.2';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.ldtk': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };

function startServer() {
  return new Promise((resolve) => {
    const srv = createServer(async (req, res) => {
      try {
        let path = decodeURIComponent((req.url || '/').split('?')[0]); if (path === '/') path = '/index.html';
        const data = await readFile(join(ROOT, path.replace(/^\//, '').replace(/\.\./g, '')));
        res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
      } catch { res.writeHead(404); res.end('nope'); }
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

const browser = await chromium.launch({ headless: true });
const { srv, port } = await startServer();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.route(/\.(mp3|ogg|m4a)(\?|$)/, (r) => r.fulfill({ status: 404, body: '' }));
await page.goto(`http://127.0.0.1:${port}/index.html?ci=1&tv=0&_=${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof startBetaLab === 'function' && window.MV_ITEMS, null, { timeout: 30000 });
await page.evaluate(async (id) => { try { MV_SIBLING.on = false; } catch (e) {} await startBetaLab(id, 15, { fresh: true }); }, LVL);
await page.waitForFunction((id) => MV_BETA.on && MV_BETA.stageId === id && !MV_BETA.loading && _gameState === 'game' && MV_GRID.ready && p, LVL, { timeout: 30000 });
await page.waitForTimeout(400);

const res = await page.evaluate(() => {
  const B = MV_BETA, T = MV_GRID.tile, out = {};
  _loopAccT = -1e15;
  const realHit = window.applyPlayerHit;
  window.applyPlayerHit = function () {};
  const clearKeys = () => { for (const k of Object.keys(K)) K[k] = false; for (const k of Object.keys(Kj)) delete Kj[k]; };
  const safe = () => { p.hp = 100; p.inv = 9999; B.popup = null; B.freeze = 0; B.trans = null; B.contScreen = null; B.overT = 0; _shutdownTimer = 0; };
  const step = (n, cb) => { for (let i = 0; i < n; i++) { safe(); update(); if (cb && cb(i) === false) return i; } return n; };
  const solid = (x, y) => gridWorldSolid(x, y);
  const parked = ENEMS.splice(0);
  const grant = (i) => { _unlockedMask |= ITEM_UNLOCK_BITS[i]; ITEM = i; };
  const cubes = () => BWALLS.filter((b) => b.cube && b.hp > 0 && (!b.only || b.only === 'pull') && !b._carried && !b._fly && b.homeCol != null);
  // a floor spot: free cells above solid ground, MIND-sized
  const standAt = (c, r) => { p.x = c * T + T / 2 - SW / 2; p.y = r * T - FEET_OFF; p.vx = p.vy = 0; p.og = true; };
  const floorSpots = [];
  for (let r = 4; r < MV_GRID.rows - 1; r++) for (let c = 2; c < MV_GRID.cols - 2; c++) {
    if (!gridSolid(c, r) || gridSolid(c, r - 1) || gridSolid(c, r - 2) || gridSolid(c, r - 3) || gridSolid(c, r - 4)) continue;
    if (B.inWater && B.inWater(c * T + 16, r * T - 40)) continue;
    floorSpots.push([c, r]);
  }

  // ── TRS ricochet ──
  {
    let best = null;
    for (const [c, r] of floorSpots) {
      for (const d of [1, -1]) for (let k = 3; k < 10; k++) if (gridSolid(c + d * k, r - 2)) { if (gridSolid(c + d * k, r - 3) && gridSolid(c + d * k, r - 4) && !gridSolid(c + d * (k - 1), r - 2) && !BWALLS.some((b) => b.hp > 0 && b.homeCol === c + d * k) && (!best || k < best.k)) best = { c, r, d, k }; break; }
      if (best && best.k <= 4) break;
    }
    clearKeys(); grant(0); standAt(best.c, best.r); step(2);
    const y0 = best.r * T - 2 * T + 16, x0 = best.c * T + 16;
    p.shots.length = 0;
    const s = { x: x0, y: y0, vx: best.d * 19 * 0.97, vy: -19 * 0.12, life: 180, type: 'laser', bounces: 0, power: 1, charged: false, enhanced: false, owner: 'mind', born: fr, tracer: [] };
    p.shots.push(s);
    let maxB = 0, inRock = 0, life = 0, last = null;
    step(400, () => { if (p.shots.indexOf(s) < 0) return false; life++; last = { x: Math.round(s.x), y: Math.round(s.y), vx: +s.vx.toFixed(1), vy: +s.vy.toFixed(1) }; maxB = Math.max(maxB, s.bounces || 0); if (solid(s.x, s.y)) inRock++; });
    const nx = last.x + last.vx, ny = last.y + last.vy;
    const hit = { block: BWALLS.some((b) => b.hp > 0 && ov(nx - 4, ny - 4, 8, 8, b.x, b.y, b.w, b.h)), rock: solid(nx, ny), mind: ov(nx - 4, ny - 4, 8, 8, p.x, p.y, p.w, p.h),
      crate: (typeof CRATES !== 'undefined' ? CRATES : []).some((c) => { const R = B.crateRect ? (c._box ? B.crateRect(c) : c) : c; return c && ov(nx - 12, ny - 12, 24, 24, c.x, c.y, c.w || 36, c.h || 36); }),
      water: !!(B.inWater && B.inWater(nx, ny)) };
    out.trsRicochet = { pass: maxB >= 2 && inRock === 0 && p.shots.indexOf(s) < 0, bounces: maxB, inRock, framesAlive: life, wallAt: best, from: [x0, y0], last, hit };
  }

  // ── MEG: one thing, no pull on the rest ──
  const swap = OPT.binds.swap[0], up = OPT.binds.up[0], left = OPT.binds.left[0];
  let pair = null;
  {
    const cs = cubes();
    for (const a of cs) { for (const b of cs) { if (a === b) continue; const dc = Math.abs(a.homeCol - b.homeCol), dr = b.homeRow - a.homeRow; if (dr === 0 && dc === 1) { pair = { a, b }; break; } } if (pair) break; }
    if (!pair) out.megOne = { pass: false, why: 'no adjacent cube pair' };
    else {
      // stand two cells left/right of the pair, aim at it
      const near = pair.a.homeCol < pair.b.homeCol ? pair.a : pair.b, far = near === pair.a ? pair.b : pair.a;
      const side = -1, sc = near.homeCol + side * 3, sr = near.homeRow + 1;
      p.fc = true; standAt(sc, sr); grant(3); p.itemStamina = 100; clearKeys();
      const farX = far.x, farY = far.y; let maxHeld = 0, farMoved = 0;
      K[swap] = true;
      step(90, () => { maxHeld = Math.max(maxHeld, B.mag.held.length); if (B.mag.held.length && (Math.abs(far.x - farX) > 2 || Math.abs(far.y - farY) > 2 || far._carried)) farMoved++; });
      const heldNow = B.mag.held.length;
      out.megOne = { pass: maxHeld === 1 && farMoved === 0, maxHeld, heldNow, farMoved, at: [sc, sr] };
      // ── MEG swing: aim from the side to up, then let go ──
      if (heldNow) {
        const h = B.mag.held[0].ref;
        K[up] = true;
        step(4);
        K[swap] = false;
        step(1);
        const v1 = { vx: h.vx, vy: h.vy };
        out.megSwing = { pass: Math.hypot(v1.vx, v1.vy) > 3 && v1.vy < -1, vel: v1 };
      } else out.megSwing = { pass: false, why: 'nothing held' };
      clearKeys(); step(30);
    }
  }

  // ── MEG stow ──
  {
    clearKeys(); grant(0); grant(3); p.magOn = false; B.magLock = null; B.magPark = null; step(2);
    _cycleItem();
    let seen = 0, glove = 0;
    step(60, () => { const st = MV_ITEMS.state().stow; if (st) seen = Math.max(seen, st); const pose = computeConnectorArmPose(p); if (B.gloveReach(pose.shX || p.x + SW / 2, pose.shY || p.y + 20)) glove++; });
    out.megStow = { pass: ITEM !== 3 && seen >= 40 && glove >= 30, item: ITEM, maxT: seen, gloveFrames: glove };
  }

  // ── foes take jacks ──
  {
    ENEMS.push(...parked);
    const e = ENEMS.find((q) => q.alive && ['circle', 'tri', 'square'].includes(q._ai));
    if (!e) out.foesTake = { pass: false, why: 'no story enemy' };
    else {
      // shutdown drop
      clearKeys(); grant(0); grant(2); ITEM = 0;
      const [c0, r0] = floorSpots[Math.floor(floorSpots.length / 2)]; standAt(c0, r0);
      const n0 = ITEM_DROPS.length;
      _shutdownTimer = 30; B.freeze = 0; update(); _shutdownTimer = 0;
      const dropped = ITEM_DROPS.slice(n0).filter((d) => d._jackLoose && d.item === 0).length;
      const lostTrs = !_itemUnlocked(0);
      // enemy picks a loose TRS up
      for (const d of ITEM_DROPS) if (d._jackLoose) d.got = true;
      for (const q of ENEMS) if (q !== e) q._hidden = true;
      const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
      const d = MV_ITEMS.looseDrop(0, ex, ey);
      d._box.item.vx = 0; d._box.item.vy = 0;
      let took = false;
      step(80, () => { d._box.item.x = e.x + e.w / 2; d._box.item.y = e.y + e.h / 2; if (e._jack === 0) { took = true; return false; } });
      // MIND in sight, 5 tiles away on the same floor
      let shots = 0, dbg = null;
      if (took) {
        const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
        const los = (x1, y1) => { const n = Math.ceil(Math.hypot(x1 - ecx, y1 - ecy) / 8); for (let i = 1; i < n; i++) if (solid(ecx + (x1 - ecx) * i / n, ecy + (y1 - ecy) * i / n)) return false; return true; };
        const spot = floorSpots.map(([c, r]) => ({ c, r, d: Math.hypot(c * T + 16 - ecx, r * T - 50 - ecy) })).filter((o) => o.d > 120 && o.d < 380 && los(o.c * T + 16, o.r * T - 50)).sort((a, b) => a.d - b.d)[0];
        if (spot) standAt(spot.c, spot.r);
        const before = new Set(ESHOTS);
        step(200, () => { for (const s of ESHOTS) if (!before.has(s) && s.src === e) { shots++; before.add(s); } });
        dbg = { e: [Math.round(e.x), Math.round(e.y), e.w, e.h], p: [Math.round(p.x), Math.round(p.y)], alive: e.alive, cd: e._jackCd, t: e._jackT, thrown: e._thrownF, held: e._betaHeld, jack: e._jack };
      }
      // shut it down: the jack falls out
      const n1 = ITEM_DROPS.length;
      e.alive = false; step(2);
      const fell = ITEM_DROPS.slice(n1).some((q) => q._jackLoose && q.item === 0);
      out.foesTake = { pass: dropped === 1 && lostTrs && took && shots >= 1 && fell && e._jack == null, dropped, lostTrs, took, shots, fell, ai: e._ai, dbg };
    }
  }
  window.applyPlayerHit = realHit;
  return out;
});

let ok = true;
for (const [k, v] of Object.entries(res)) { console.log((v.pass ? 'PASS ' : 'FAIL ') + k.padEnd(12) + JSON.stringify(v)); if (!v.pass) ok = false; }
if (errors.length) { console.log('page errors:', errors.slice(0, 5)); ok = false; }
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
