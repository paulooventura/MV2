#!/usr/bin/env node
/**
 * Old-bug probes (T135) — headless proof that the long-reported bugs stay dead
 * on the LIVE build (index.html → claude/). Each probe drives the real engine
 * in the stage and reports PASS / FAIL with samples.
 *
 *   slopeRoll     — let go on every ramp: MIND rolls downhill, no frame jumps
 *   slopeCross    — walk + run across every ramp both ways: no wedge, no stair hop
 *   cornerStick   — every ramp foot / crest corner: no stuck wheel with input held
 *   fallThrough   — drops from height onto floors + ramps at max fall speed
 *   ropeWalls     — throw the RCA at walls/ceilings and swing: rope never in rock
 *   enemiesFloor  — every story enemy, 40 s of play: body never sunk in rock
 *   enemiesWater  — an enemy dropped in water without an Isolator shorts out
 *   blockEdges    — roll off every floor edge both ways: no wedge
 *   spawn         — on the floor, not in rock, not ducked
 *
 * Writes test-results/probes.json + probes-summary.txt. Exit 0 = all PASS.
 * Usage: npm run selftest:probes -- [--only=slopeRoll,ropeWalls] [--lvl=1.1,1.2]
 *        --recon (dump stage facts) · --eval=file.js (run a file's body in the stage; helpers in __PH)
 * Own server on an OS-picked port, headless, music muted — never touches :8765.
 */
import { createServer } from 'http';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'test-results');
const arg = (k) => { const a = process.argv.find((s) => s.startsWith('--' + k + '=')); return a ? a.split('=')[1] : null; };
const ONLY = arg('only') ? arg('only').split(',') : null;
const LVLS = (arg('lvl') || '1.1,1.2').split(',');
const RECON = process.argv.includes('--recon');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.ldtk': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

function startServer(port) {
  return new Promise((resolve, reject) => {
    const srv = createServer(async (req, res) => {
      try {
        let path = decodeURIComponent((req.url || '/').split('?')[0]);
        if (path === '/') path = '/index.html';
        const file = join(ROOT, path.replace(/^\//, '').replace(/\.\./g, ''));
        const data = await readFile(file);
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
      } catch { res.writeHead(404); res.end('nope'); }
    });
    srv.on('error', reject);
    srv.listen(port, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

async function bootStage(page, port, lvl) {
  await page.route(/\.(mp3|ogg|m4a)(\?|$)/, (r) => r.fulfill({ status: 404, body: '' }));   // no music needed
  await page.goto(`http://127.0.0.1:${port}/index.html?ci=1&tv=0&_=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof startBetaLab === 'function' && typeof mkP === 'function' && typeof applyLdtkLevel === 'function', null, { timeout: 30000 });
  await page.evaluate(async (id) => {
    try { if (window.MV_SIBLING) MV_SIBLING.on = false; } catch (e) {}
    if (typeof _playModeIdx !== 'undefined') try { _playModeIdx = 0; } catch (e) {}
    await startBetaLab(id, 15, { fresh: true });
  }, lvl);
  await page.waitForFunction((id) => window.MV_BETA && MV_BETA.on && MV_BETA.stageId === id && !MV_BETA.loading && _gameState === 'game' && MV_GRID && MV_GRID.ready && p, lvl, { timeout: 30000 });
  // clear any popup / card so update() runs the world
  await page.evaluate(() => { const B = MV_BETA; B.popup = null; B.popupSeen = B.popupSeen || {}; });
  await page.waitForTimeout(500);
}

// Runs inside the page. Shared helpers for every probe.
function pageHelpers() {
  const T = MV_GRID.tile;
  const H = window.__PH = {};
  H.T = T;
  H.wait = (n) => new Promise((res) => { let i = 0; const tick = () => (++i >= n ? res() : requestAnimationFrame(tick)); requestAnimationFrame(tick); });
  H.clearKeys = () => { for (const k of Object.keys(K)) K[k] = false; for (const k of Object.keys(Kj)) delete Kj[k]; };
  H.feet = () => p.y + FEET_OFF;
  H.cx = () => p.x + SW / 2;
  H.solid = (x, y) => _armSolid(x, y);
  H.put = (x, feetY) => {
    p.x = x - SW / 2; p.y = feetY - FEET_OFF;
    p.vx = 0; p.vy = 0; p.og = false;
    p.runRamp = 0; p.momentum = 0; p._slopeRollT = 0; p.crouchAmt = 0;
    if (p.hook) { p.hook.st = 'idle'; p.hook.pivots = null; }
  };
  H.safe = () => {                                   // keep MIND alive and out of the stage's systems
    p.hp = 100; p.invT = 9999; p.inv = 9999; p._invuln = 9999;
    try { if (typeof _shutdownTimer !== 'undefined') _shutdownTimer = 0; } catch (e) {}
    const B = MV_BETA; B.popup = null; B.freeze = 0; B.trans = null; B.contScreen = null; B.overT = 0;
  };
  H.parkEnemies = () => { H._enems = ENEMS.splice(0); };
  // hold the real rAF loop and step update() ourselves: fast and frame-exact
  H.hold = () => { _loopAccT = -1e15; window.applyPlayerHit = function () {}; };
  H.step = (n, cb) => {
    for (let i = 0; i < n; i++) {
      H.safe();
      update();
      if (cb && cb(i) === false) return i;
    }
    return n;
  };
  // ramps: runs of slope cells of one kind. cells[0] = top end, last = bottom end.
  // 'R' rises to the right (downhill = -x), 'L' rises to the left (downhill = +x).
  H.ramps = () => {
    const out = []; const seen = new Set();
    for (let r = 0; r < MV_GRID.rows; r++) for (let c = 0; c < MV_GRID.cols; c++) {
      const k = gridSlopeKind(c, r); if (!k || seen.has(c + ',' + r)) continue;
      const cells = []; let cc = c, rr = r;
      while (gridSlopeKind(cc, rr) === k) { cells.push([cc, rr]); seen.add(cc + ',' + rr); cc += (k === 'R' ? -1 : 1); rr += 1; }
      const down = k === 'R' ? -1 : 1;
      const [ct, rt] = cells[0], [cb, rb] = cells[cells.length - 1];
      out.push({
        kind: k, cells, down, len: cells.length,
        topEdge: k === 'R' ? (ct + 1) * T : ct * T, topY: rt * T,
        footEdge: k === 'R' ? cb * T : (cb + 1) * T, footY: (rb + 1) * T,
        id: k + cells.length + '@' + ct + ',' + rt,
      });
    }
    return out;
  };
  H.wallAhead = (dir) => {
    const x = H.cx() + dir * (SW / 2 + 6), f = H.feet();
    return H.solid(x, f - 40) || H.solid(x, f - 64) || H.solid(x, f - 84);
  };
  // drive one direction; report travel, the longest stall with no wall in front, worst frame hop
  H.drive = (dir, frames, run, goalX) => {
    H.clearKeys();
    K[dir > 0 ? 'KeyD' : 'KeyA'] = true; if (run) K.ShiftLeft = true;
    const x0 = H.cx(); let stall = 0, maxStall = 0, hop = 0, sunk = 0, body = 0, reached = -1;
    let lx = H.cx(), lf = H.feet(), lvx = p.vx, lvy = p.vy;
    H.step(frames, (i) => {
      const x = H.cx(), f = H.feet();
      hop = Math.max(hop, H.jump(lx, lf, lvx, lvy));
      if (Math.abs(x - lx) < 0.25 && !H.wallAhead(dir)) { stall++; maxStall = Math.max(maxStall, stall); } else stall = 0;
      sunk += H.wheelSunk(); body += H.bodyInRock() >= 2 ? 1 : 0;
      lx = x; lf = f; lvx = p.vx; lvy = p.vy;
      if (goalX != null && (x - goalX) * dir >= 0) { reached = i; return false; }
    });
    H.clearKeys();
    return { travel: Math.round((H.cx() - x0) * dir), maxStall, hop: Math.round(hop), sunk, body, reached };
  };
  // the highest stand-able surface y at x, at or below y0
  H.groundBelow = (x, y0, maxDepth) => {
    y0 = Math.floor(y0);
    for (let y = y0; y < y0 + (maxDepth || 2000); y += 1) {
      if (H.solid(x, y)) return y;
      const c = Math.floor(x / T), r = Math.floor(y / T);
      if (gridCell(c, r) === MV_GRID_ONEWAY && y === r * T) return y;
    }
    return null;
  };
  H.wheelSunk = () => {                               // wheel bottom centre 8+ px inside rock
    const x = H.cx(), f = H.feet();
    return H.solid(x, f - 8) && H.solid(x, f - 16) ? 1 : 0;
  };
  H.wet = (x, y) => !!(MV_BETA.inWater && (MV_BETA.inWater(x, y) || MV_BETA.inWater(x, y - 40) || MV_BETA.inWater(x, y + 20)));
  // a frame "teleport": moved further than the velocity it had going in can explain
  H.jump = (lx, lf, vx, vy) => {
    const dx = Math.abs(H.cx() - lx), dy = Math.abs(H.feet() - lf);
    return Math.max(0, dx - Math.abs(vx) - 2, dy - Math.max(Math.abs(vy), dx) - 4);
  };
  H.bodyInRock = () => {
    const pts = [[0.5, -20], [0.5, -50], [0.25, -45], [0.75, -45], [0.5, -75]];
    let n = 0; for (const [fx, dy] of pts) if (H.solid(p.x + SW * fx, H.feet() + dy)) n++;
    return n;
  };
  return { T, rows: MV_GRID.rows, cols: MV_GRID.cols };
}

async function main() {
  // port 0: the OS picks a free one (never 8765, never a stale probe's port)
  const { srv, port } = await startServer(0);
  const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
  const results = [];
  try {
    const errs = [];
    const open = async (lvl) => {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      page.on('pageerror', (e) => errs.push(e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).map((s) => s.trim().replace(/^at /, '').replace(/https?:\/\/127\.0\.0\.1:\d+\//, '')).join(' < ')));
      page.setDefaultTimeout(240000);
      await bootStage(page, port, lvl);
      await page.evaluate(pageHelpers);
      return page;
    };
    for (const lvl of LVLS) {
      errs.length = 0;
      if (arg('eval')) {                                   // debug: run a file's body in the stage (helpers in __PH)
        const page = await open(lvl);
        const body = await readFile(arg('eval'), 'utf8');
        console.log(lvl, JSON.stringify(await page.evaluate(body), null, 1));
        await page.close();
        continue;
      }
      if (RECON) {
        const page = await open(lvl);
        const r = await page.evaluate(() => ({
          grid: [MV_GRID.cols, MV_GRID.rows, MV_GRID.tile],
          p: { x: p.x, y: p.y, og: p.og, hook: p.hook && p.hook.st },
          ramps: __PH.ramps().map((r) => r.kind + r.cells.length + '@' + r.cells[0].join(',')),
          enemies: ENEMS.map((e) => [e._ai || e.type, Math.round(e.x), Math.round(e.y), e.w, e.h, e.alive, !!e._iso]),
          waters: (MV_BETA.waters || []).map((w) => [w.c0, w.r0, w.c1, w.r1]),
          item: ITEM, mask: _unlockedMask,
        }));
        console.log(lvl, JSON.stringify(r, null, 1));
        console.log('errors', errs.slice(0, 5));
        await page.close();
        continue;
      }
      for (const [name, fn] of Object.entries(PROBES)) {
        if (ONLY && !ONLY.includes(name)) continue;
        if (fn.lvls && !fn.lvls.includes(lvl)) continue;
        const t0 = Date.now();
        let res, page = null;
        try { page = await open(lvl); res = await page.evaluate(fn); } catch (e) { res = { pass: false, error: e.message.split('\n')[0] }; }
        if (page) await page.close().catch(() => {});
        res.probe = name; res.lvl = lvl; res.ms = Date.now() - t0;
        results.push(res);
        console.log(`${res.pass ? 'PASS' : 'FAIL'}  ${lvl}  ${name.padEnd(13)} ${res.note || ''}${res.error ? ' ERROR ' + res.error : ''}`);
      }
      if (errs.length) results.push({ probe: 'pageErrors', lvl, pass: true, note: errs.length + ' page errors (info): ' + [...new Set(errs)].slice(0, 3).join(' | '), samples: [...new Set(errs)].slice(0, 5) });
    }
  } finally {
    await browser.close().catch(() => {});
    if (srv.closeAllConnections) srv.closeAllConnections();
    await new Promise((r) => srv.close(r));
  }
  if (RECON || arg('eval')) return;
  const fails = results.filter((r) => !r.pass);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, 'probes.json'), JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2));
  const summary = ['OLD-BUG PROBES ' + (fails.length ? 'FAIL' : 'PASS') + ' (' + (results.length - fails.length) + '/' + results.length + ')',
    ...results.map((r) => `${r.pass ? 'PASS' : 'FAIL'} ${r.lvl} ${r.probe}: ${r.note || ''}${r.error ? ' ERROR ' + r.error : ''}`)].join('\n');
  await writeFile(join(OUT_DIR, 'probes-summary.txt'), summary + '\n');
  console.log('\n' + summary);
  process.exitCode = fails.length ? 1 : 0;
}

const PROBES = {
  // #78 #87 #90b #95j #138b #139a — let go on a ramp: he rolls down it, no frame jumps
  slopeRoll() {
    const H = __PH; H.hold(); H.parkEnemies();
    const out = [];
    for (const rp of H.ramps().filter((r) => r.len >= 3)) {
      const [c, r] = rp.cells[1];
      const x = (c + 0.5) * H.T;
      H.put(x, gridSlopeY(c, r, x)); H.clearKeys();
      H.step(2);                                          // let the wheel seat on the ramp line
      const x0 = H.cx(); let best = 0, hop = 0, hopAt = null, sunk = 0, lf = H.feet(), lx = H.cx(), lvx = p.vx, lvy = p.vy, n = 0;
      H.step(150, (i) => {
        best = Math.max(best, (H.cx() - x0) * rp.down);
        const d = H.jump(lx, lf, lvx, lvy);
        if (d > 0) n++;
        if (d > hop) { hop = d; hopAt = { i, x: Math.round(lx), dx: Math.round(H.cx() - lx), dy: Math.round(H.feet() - lf), vxIn: +lvx.toFixed(1), vxOut: +p.vx.toFixed(1) }; }
        lf = H.feet(); lx = H.cx(); lvx = p.vx; lvy = p.vy; sunk += H.wheelSunk();
      });
      const ok = best >= H.T && hop <= 8 && !sunk;
      out.push({ ramp: rp.id, rolled: Math.round(best), snaps: n, worstSnap: Math.round(hop), hopAt, sunk, ok });
    }
    const bad = out.filter((o) => !o.ok);
    return { pass: out.length > 0 && !bad.length, note: `${out.length} ramps, ${bad.length} bad`, samples: bad.length ? bad : out.slice(0, 4) };
  },

  // #86a #136a #141 #124a — walk + run up and down every ramp: gets over, no wedge, no stair hop
  slopeCross() {
    const H = __PH; H.hold(); H.parkEnemies();
    const out = [];
    for (const rp of H.ramps().filter((r) => r.len >= 2)) {
      const up = -rp.down;
      const footX = rp.footEdge + rp.down * 2 * H.T;
      const footG = H.groundBelow(footX, rp.footY - 2 * H.T, 3 * H.T);
      const topX = rp.topEdge + up * 30;
      const topG = H.groundBelow(topX, rp.topY - 2 * H.T, 3 * H.T);
      const footOk = footG != null && Math.abs(footG - rp.footY) <= 6 && !H.solid(footX, footG - 60);
      const topOk = topG != null && Math.abs(topG - rp.topY) <= 6 && !H.solid(topX, topG - 60);
      for (const run of [false, true]) {
        if (footOk && topOk) {
          H.put(footX, footG); H.step(10);
          const a = H.drive(up, 300, run, topX);
          // walking up a long 45° ramp is allowed to fail (#90b: uphill drag unless running) — but never wedge or snap
          const aOk = (a.reached >= 0 || !run) && a.maxStall < 30 && a.hop <= 8 && !a.sunk;
          out.push({ ramp: rp.id, way: 'up', run, ...a, ok: aOk, info: !run && a.reached < 0 ? 'walk does not crest (designed drag #90b)' : undefined });
          H.put(topX, topG); H.step(10);
          const b = H.drive(rp.down, 300, run, footX);
          out.push({ ramp: rp.id, way: 'down', run, ...b, ok: b.reached >= 0 && b.maxStall < 30 && b.hop <= 8 && !b.sunk });
        } else out.push({ ramp: rp.id, skipped: footOk ? 'no flat crest' : 'no flat foot', ok: true });
      }
    }
    const tested = out.filter((o) => !o.skipped), bad = tested.filter((o) => !o.ok), info = tested.filter((o) => o.info);
    return { pass: tested.length > 0 && !bad.length, note: `${tested.length} crossings, ${bad.length} bad, ${info.length} walk-ups stop (drag by design), ${out.length - tested.length} skipped`, samples: bad.length ? bad : tested.slice(0, 8) };
  },

  // #134a #136b #138c #139b #96l #96f — the ramp's foot and crest corners: landing there
  // and starting from rest either way never leaves the wheel stuck
  cornerStick() {
    const H = __PH; H.hold(); H.parkEnemies();
    const out = [];
    for (const rp of H.ramps().filter((r) => r.len >= 2)) {
      for (const [where, ex, ey] of [['foot', rp.footEdge, rp.footY], ['crest', rp.topEdge, rp.topY]]) {
        for (const off of [-12, -4, 0, 4, 12]) {
          const x = ex + off;
          if (H.solid(x, ey - 3 * H.T) || H.solid(x, ey - 2 * H.T) || H.wet(x, ey - 10)) continue;
          H.put(x, ey - 2 * H.T); H.step(60);
          const land = { sunk: H.wheelSunk(), body: H.bodyInRock() };
          const sx = H.cx(), sf = H.feet();
          const go = (dir) => {                         // walk from rest; if it won't go, try running
            H.put(sx, sf); H.step(4);
            const w = H.drive(dir, 40, false);
            if (!(Math.abs(w.travel) < 10 && w.maxStall >= 20)) return { travel: w.travel, how: 'walk' };
            H.put(sx, sf); H.step(4);
            const r = H.drive(dir, 40, true);
            return { travel: r.travel, how: Math.abs(r.travel) < 10 && r.maxStall >= 20 ? 'STUCK' : 'run only' };
          };
          const r1 = go(1), r2 = go(-1);
          out.push({ ramp: rp.id, where, off, land, right: r1, left: r2, ok: !land.sunk && land.body < 2 && r1.how !== 'STUCK' && r2.how !== 'STUCK' });
        }
      }
    }
    const bad = out.filter((o) => !o.ok), runOnly = out.filter((o) => o.ok && (o.right.how === 'run only' || o.left.how === 'run only'));
    return { pass: out.length > 0 && !bad.length, note: `${out.length} corner drops, ${bad.length} stuck, ${runOnly.length} need a run to start uphill`, samples: bad.length ? bad.slice(0, 8) : runOnly.slice(0, 4).concat(out.slice(0, 2)) };
  },

  // #96f #124c #96i — every block edge (a step up/down in the floor): roll off it both ways
  blockEdges() {
    const H = __PH; H.hold(); H.parkEnemies();
    const T = H.T, spots = [];
    const air = (c, r) => gridCell(c, r) === MV_GRID_AIR;
    for (let r = 3; r < MV_GRID.rows - 1; r++) for (let c = 2; c < MV_GRID.cols - 2; c++) {
      if (!gridSolid(c, r) || !air(c, r - 1) || !air(c, r - 2) || !air(c, r - 3)) continue;
      const edge = !gridSolid(c + 1, r) || gridSolid(c + 1, r - 1) || !gridSolid(c - 1, r) || gridSolid(c - 1, r - 1);
      if (edge) spots.push([c, r]);
    }
    const step = Math.max(1, Math.ceil(spots.length / 160));
    const out = [];
    for (let i = 0; i < spots.length; i += step) {
      const [c, r] = spots[i];
      if (H.wet((c + 0.5) * T, r * T - 10)) continue;
      H.put((c + 0.5) * T, r * T); H.step(12);
      if (!p.og) continue;
      const sx = H.cx(), sf = H.feet();
      const a = H.drive(1, 45, false); H.put(sx, sf); H.step(4);
      const b = H.drive(-1, 45, false);
      const stuck = [a, b].filter((d) => Math.abs(d.travel) < 10 && d.maxStall >= 25);
      out.push({ cell: c + ',' + r, right: a.travel, left: b.travel, sunk: a.sunk + b.sunk, ok: !stuck.length && !(a.sunk + b.sunk) });
    }
    const bad = out.filter((o) => !o.ok);
    return { pass: out.length > 0 && !bad.length, note: `${out.length} block edges, ${bad.length} wedged`, samples: bad.length ? bad.slice(0, 8) : out.slice(0, 3) };
  },

  // #99a #95h-for-MIND #138b — drop at max fall speed onto floors, one-ways and ramps
  fallThrough() {
    const H = __PH; H.hold(); H.parkEnemies();
    const T = H.T, out = [];
    for (let c = 2; c < MV_GRID.cols - 2; c += 2) {
      const x = (c + 0.5) * T;
      for (let r = 6; r < MV_GRID.rows - 1; r++) {
        const k = gridCell(c, r);
        const ground = k === MV_GRID_SOLID || k === MV_GRID_DESTRUCT || k === MV_GRID_ONEWAY || gridIsSlope(c, r);
        if (!ground) continue;
        let clear = true;
        for (let rr = r - 6; rr < r; rr++) if (gridCell(c, rr) !== MV_GRID_AIR || gridCell(c - 1, rr) !== MV_GRID_AIR || gridCell(c + 1, rr) !== MV_GRID_AIR) clear = false;
        if (!clear) continue;
        const surf = gridIsSlope(c, r) ? gridSlopeY(c, r, x) : r * T;
        if (H.wet(x, surf - 10)) continue;
        // per frame: the floor that was under the wheel must still be under it (no tunnelling)
        H.put(x, surf - 5 * T); p.vy = 14;
        let tunnel = 0, sunk = 0, worst = 0, g = H.groundBelow(H.cx(), H.feet() - 2, 7 * T);
        H.step(70, () => {
          const f = H.feet();
          if (g != null && f > g + 10) { tunnel++; worst = Math.max(worst, f - g); }
          sunk += H.wheelSunk();
          g = H.groundBelow(H.cx(), f - 2, 3 * T);
        });
        out.push({ col: c, row: r, kind: k, tunnel, worstBelow: Math.round(worst), sunk, ok: !tunnel && sunk < 3 });
      }
    }
    const bad = out.filter((o) => !o.ok);
    return { pass: out.length > 0 && !bad.length, note: `${out.length} drops, ${bad.length} fell in`, samples: bad.length ? bad.slice(0, 8) : out.slice(0, 3) };
  },

  // #23a #95f #96g #97b #96h #96k #94b — throw the RCA from many spots, then swing and reel:
  // the line never runs through rock, the hook never latches inside rock
  ropeWalls() {
    const H = __PH; H.hold(); H.parkEnemies();
    const T = H.T, out = [];
    const ropeRun = () => {                               // longest stretch of the line inside rock (px)
      const h = p.hook; if (!h || h.st !== 'on') return 0;
      const pts = [{ x: h.ax, y: h.ay }, ...((h.pivots || []).map((q) => ({ x: q.x, y: q.y }))), ropePlayerEndWorld()];
      let worst = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(L / 2);
        let run = 0;
        for (let j = 0; j <= n; j++) {
          const d = (j / n) * L; if (d < 6 || d > L - 6) { run = 0; continue; }
          const x = a.x + (b.x - a.x) * j / n, y = a.y + (b.y - a.y) * j / n;
          if (H.solid(x, y)) { run += L / n; worst = Math.max(worst, run); } else run = 0;
        }
      }
      return Math.round(worst);
    };
    const spots = [];
    for (let r = 4; r < MV_GRID.rows - 1; r++) for (let c = 2; c < MV_GRID.cols - 2; c++) {
      if (gridSolid(c, r) && [1, 2, 3].every((d) => gridCell(c, r - d) === MV_GRID_AIR)) spots.push([c, r]);
    }
    const stride = Math.max(1, Math.floor(spots.length / 28));
    const dirs = [[0, -1], [0.7, -0.7], [-0.7, -0.7], [1, -0.25], [-1, -0.25]];
    for (let i = 0; i < spots.length; i += stride) {
      const [c, r] = spots[i];
      if (H.wet((c + 0.5) * T, r * T - 10)) continue;
      for (const [ax, ay] of dirs) {
        H.put((c + 0.5) * T, r * T); H.step(8);
        if (!p.og) break;
        ITEM = 1; p.aimDX = ax; p.aimDY = ay; p.tAimDX = ax; p.tAimDY = ay; p.fc = ax >= 0;
        fireItem();
        let flewIn = 0, lx = p.hook.ex, ly = p.hook.ey;
        H.step(60, () => {
          const h = p.hook;
          if (h.st === 'ext') {                          // the flying tip may not tunnel: no rock between frames
            const n = Math.ceil(Math.hypot(h.ex - lx, h.ey - ly) / 3);
            for (let j = 1; j < n; j++) if (H.solid(lx + (h.ex - lx) * j / n, ly + (h.ey - ly) * j / n) && H.solid(lx + (h.ex - lx) * (j + 1) / n, ly + (h.ey - ly) * (j + 1) / n)) { flewIn++; break; }
            lx = h.ex; ly = h.ey;
          }
          return h.st === 'ext';
        });
        const h = p.hook;
        if (h.st !== 'on' || h.tgt || h.plat) continue;
        // buried = rock 4 px out on every side of the hook (a face or corner always has air on one side)
        const inside = !h._cube && [[4, 0], [-4, 0], [0, 4], [0, -4]].every(([dx, dy]) => H.solid(h.ax + dx, h.ay + dy)) ? 1 : 0;
        const onFace = H.solid(h.ax - (h.nx || 0) * 6, h.ay - (h.ny || 0) * 6) ? 1 : 0;
        let worst = ropeRun(), bodyIn = 0, frames = 0;
        const watch = () => { worst = Math.max(worst, ropeRun()); bodyIn += H.bodyInRock() >= 2 ? 1 : 0; frames++; return p.hook.st === 'on'; };
        H.clearKeys(); K.KeyD = true; H.step(70, watch);
        H.clearKeys(); K.KeyA = true; H.step(70, watch);
        H.clearKeys(); K.KeyW = true; H.step(40, watch);
        H.clearKeys(); K.KeyS = true; H.step(30, watch);
        H.clearKeys(); H.step(30, watch);
        const ok = !inside && worst <= 8 && !flewIn && bodyIn < 3;
        out.push({ from: c + ',' + r, aim: ax + ',' + ay, anchor: Math.round(h.ax) + ',' + Math.round(h.ay), cube: !!h._cube, inside, onFace, worstInRock: worst, flewIn, bodyIn, frames, ok });
        if (p.hook.st === 'on') _detachPlayerRope(p.hook);
      }
    }
    const bad = out.filter((o) => !o.ok);
    return { pass: out.length >= 10 && !bad.length, note: `${out.length} latches swung, ${bad.length} through rock`, samples: bad.length ? bad.slice(0, 8) : out.slice(0, 4) };
  },

  // #3b #95h #97a #96d #108 — every story enemy, 40 s live with MIND visiting each one:
  // the body never sits in rock, never drops out of the world, never idles in water un-shorted
  enemiesFloor() {
    const H = __PH; H.hold();
    const T = H.T, B = MV_BETA;
    const list = ENEMS.filter((e) => e._ai);
    const st = new Map(list.map((e) => [e, { id: e._ai + '@' + Math.round(e.x) + ',' + Math.round(e.y), rock: 0, run: 0, maxRun: 0, out: 0, wet: 0, wetRun: 0, maxWet: 0, frames: 0, moved: 0, x0: e.x, y0: e.y }]));
    const buried = (e) => {
      const ys = [e.y + e.h * 0.42, e.y + e.h * 0.7];
      let n = 0; for (const y of ys) for (const x of [e.x + e.w * 0.5, e.x + 6, e.x + e.w - 6]) if (H.solid(x, y)) n++;
      return n >= 2;
    };
    const tick = () => {
      for (const e of list) {
        const s = st.get(e); if (!e.alive || e._permOff) { s.run = 0; continue; }
        s.frames++;
        s.moved = Math.max(s.moved, Math.hypot(e.x - s.x0, e.y - s.y0));
        const gone = e.y + e.h > MV_GRID.rows * T - 2;
        if (gone) {                                       // off the map bottom: an open pit, or through a floor?
          if (!s.wasGone) {
            const c = Math.floor((s.lx + e.w / 2) / T); let floor = false;
            for (let r = Math.floor((s.ly + e.h) / T); r < MV_GRID.rows; r++) if (gridSolid(c, r) || gridIsSlope(c, r)) { floor = true; break; }
            if (floor) s.out++; else s.pit = (s.pit || 0) + 1;
          }
          s.wasGone = true; s.run = 0; continue;
        }
        s.wasGone = false; s.lx = e.x; s.ly = e.y;
        if (buried(e)) { s.rock++; s.run++; s.maxRun = Math.max(s.maxRun, s.run); } else s.run = 0;
        const wet = !e._iso && B.inWater && B.inWater(e.x + e.w / 2, e.y + e.h * 0.5);
        if (wet) { s.wet++; s.wetRun++; s.maxWet = Math.max(s.maxWet, s.wetRun); } else s.wetRun = 0;
      }
    };
    H.step(600, tick);                                    // MIND at the entrance
    for (const e of list) {                               // then MIND turns up next to each one
      if (!e.alive) continue;
      const g = H.groundBelow(e.x + e.w / 2 + 160, e.y - T, 6 * T);
      if (g == null) continue;
      H.put(e.x + e.w / 2 + 160, g);
      H.step(450, tick);
    }
    const res = [...st.values()].map((s) => ({ ...s, ok: s.maxRun < 6 && !s.out && s.maxWet < 90 }));
    const bad = res.filter((r) => !r.ok), pits = res.reduce((n, r) => n + (r.pit || 0), 0);
    return { pass: res.length > 0 && !bad.length, note: `${res.length} enemies, ${bad.length} sunk/through floor/wet, ${pits} drops into open pits (info)`, samples: res.map(({ x0, y0, lx, ly, wasGone, ...r }) => ({ ...r, moved: Math.round(r.moved) })) };
  },

  // #3a #8 #171d — an enemy without an Isolator dropped into the pool shorts out; one with an Isolator doesn't
  enemiesWater() {
    const H = __PH; H.hold();
    const T = H.T, B = MV_BETA;
    const pools = (B.waters || []).filter((w) => w.r1 - w.r0 >= 2);
    if (!pools.length) return { pass: true, note: 'no pool in this stage (skipped)', skipped: true };
    const w = pools[0];
    // find a wet spot in the pool
    let spot = null;
    for (let r = w.r0; r <= w.r1 && !spot; r++) for (let c = w.c0; c <= w.c1; c++) {
      const x = (c + 0.5) * T, y = (r + 0.5) * T; if (B.inWater(x, y) && B.inWater(x, y + T) && !H.solid(x, y + 16)) { spot = { x, y }; break; }
    }
    if (!spot) return { pass: false, note: 'pool has no water cell to test in' };
    const out = [];
    for (const iso of [false, true]) {
      const e = ENEMS.find((q) => q._ai === 'circle' && q.alive && !q._permOff && !!q._iso === iso) || ENEMS.find((q) => q._ai && q._ai !== 'mirror' && q.alive && !q._permOff && !!q._iso === iso);
      if (!e) { out.push({ iso, skipped: 'no such enemy' }); continue; }
      e.x = spot.x - e.w / 2; e.y = spot.y - e.h / 2; e.vx = 0; e.vy = 0;
      let downAt = -1;
      H.step(240, (i) => { if ((!e.alive || e._permOff) && downAt < 0) downAt = i; });
      out.push({ iso, ai: e._ai, downAt, permOff: !!e._permOff, ok: iso ? downAt < 0 : downAt >= 0 && downAt < 180 });
    }
    const bad = out.filter((o) => o.ok === false);
    return { pass: !bad.length, note: out.map((o) => (o.iso ? 'iso ' : 'bare ') + (o.skipped || (o.downAt >= 0 ? 'shorted@' + o.downAt : 'survived'))).join(', '), samples: out };
  },

  // #96a #88b #95i — spawn: on the ground, not in a wall, not ducked
  spawn() {
    const H = __PH; H.hold();
    H.step(30);
    const s = { feet: Math.round(H.feet()), og: !!p.og, sunk: H.wheelSunk(), body: H.bodyInRock(), crouch: +(p.crouchAmt || 0).toFixed(2) };
    const g = H.groundBelow(H.cx(), H.feet() - 4, 64);
    s.gap = g == null ? null : Math.round(g - H.feet());
    return { pass: s.og && !s.sunk && s.body === 0 && s.crouch < 0.2 && s.gap != null && Math.abs(s.gap) <= 4, note: JSON.stringify(s), samples: [s] };
  },
};

main().catch((e) => { console.error('probe runner failed:', e.message); process.exitCode = 2; });
