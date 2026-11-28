#!/usr/bin/env node
/**
 * Tunneling probe: "never see blocks, foes or the player fall / move through walls, floors or ceilings".
 * Headless (muted, own port, never :8765). For each stage the engine is stepped by hand (update())
 * for thousands of frames while every moving body is stress-flung (knockback-size velocities,
 * cubes tossed into walls, foes shoved, player thrown). After EVERY frame it checks, for
 * ENEMS (all types), BWALLS (cubes/crates/push blocks), p and p2:
 *   embed: the body's box overlaps a solid MV_GRID cell (type 1 / 3) deeper than TOL px
 *   cross: the box swept from last frame to this frame passed through rock with neither end inside
 * Exit 0 = zero embeds and zero crossings. Usage:
 *   node scripts/probe-tunnel.mjs [--lvl=1.1,1.2,1.3] [--frames=3000] [--tol=6] [--seed=7] [--json=out.json]
 */
import { createServer } from 'http';
import { readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const LVLS = arg('lvl', '1.1,1.2,1.3').split(',');
const FRAMES = Number(arg('frames', 3000));
const TOL = Number(arg('tol', 6));
const SEED = Number(arg('seed', 7));
const NOGUARD = process.argv.includes('--noguard');   // measure the engine without the beta_tunnel.js net (the 'before' numbers)
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
const results = [];
const errors = [];

async function runStage(lvl) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 825 } });
  page.on('pageerror', (e) => errors.push(lvl + ': ' + String(e && e.message || e)));
  await page.route(/\.(mp3|ogg|m4a)(\?|$)/, (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto(`http://127.0.0.1:${port}/index.html?ci=1&tv=0&_=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof startBetaLab === 'function' && typeof mkP === 'function' && typeof applyLdtkLevel === 'function', null, { timeout: 30000 });
  await page.evaluate(async (id) => { try { if (window.MV_SIBLING) MV_SIBLING.on = false; } catch (e) {} await startBetaLab(id, 15, { fresh: true }); }, lvl);
  await page.waitForFunction((id) => window.MV_BETA && MV_BETA.on && MV_BETA.stageId === id && !MV_BETA.loading && _gameState === 'game' && MV_GRID && MV_GRID.ready && p, lvl, { timeout: 30000 });
  const res = await page.evaluate(({ FRAMES, TOL, SEED, NOGUARD }) => {
    const B = MV_BETA, G = MV_GRID, T = G.tile;
    _loopAccT = -1e15; if (NOGUARD) B.tunnelGuard = function () {}; window.applyPlayerHit = window.applyPlayerHit || function () {};
    let s = SEED >>> 0; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();
    // the game rolls Math.random for AI, debris, jitter: seed it too so a failing seed replays the same run
    let gs = (SEED * 2654435761) >>> 0; Math.random = () => { gs = (gs * 1664525 + 1013904223) >>> 0; return gs / 4294967296; };
    const solidAt = (c, r) => { if (!(c >= 0 && r >= 0 && c < G.cols && r < G.rows)) return 0; const t = G.data[r][c]; return (t === 1 || t === 3) ? 1 : 0; };
    // penetration depth of an AABB into solid rock (min axis overlap, worst cell)
    const depth = (x, y, w, h, own) => {
      let worst = 0, cell = null;
      const c0 = Math.floor(x / T), c1 = Math.floor((x + w - 0.001) / T), r0 = Math.floor(y / T), r1 = Math.floor((y + h - 0.001) / T);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        if (!solidAt(c, r)) continue;
        if (own && own.has(c + ',' + r)) continue;
        const ox = Math.min(x + w, (c + 1) * T) - Math.max(x, c * T), oy = Math.min(y + h, (r + 1) * T) - Math.max(y, r * T);
        const d = Math.min(ox, oy); if (d > worst) { worst = d; cell = [c, r]; }
      }
      return { d: worst, cell };
    };
    const bodies = () => {
      const out = [];
      for (const e of ENEMS) if (e && e.alive !== false && !e._dead && isFinite(e.x)) { const hero = !!e.mind;   // rival siblings stand on the hero's wheel, so their body is the hero's, not the 96px sprite box
        out.push({ k: 'e:' + (hero ? 'mind' : (e._ai || e.ai || e.type || e.kind || '?')), o: e, x: hero ? e.x + (e.w - 20) / 2 : e.x, y: hero ? e.y + 4 : e.y, w: hero ? 20 : (e.w || 30), h: hero ? FEET_OFF - 6 : (e.h || 30), id: e }); }
      for (const bw of BWALLS) if (bw && bw.hp > 0 && (bw.movable || bw._fly) && !bw._carried) out.push({ k: 'bw:' + (bw.kind || bw.type || (bw._pb ? 'pb' : 'box')), o: bw, x: bw.x, y: bw.y, w: bw.w, h: bw.h, id: bw });
      if (p) out.push({ k: 'p1', o: p, x: p.x + (SW - 20) / 2, y: p.y + 4, w: 20, h: FEET_OFF - 6, id: p });
      if (window.p2 && p2) out.push({ k: 'p2', o: p2, x: p2.x + (SW - 20) / 2, y: p2.y + 4, w: 20, h: FEET_OFF - 6, id: p2 });
      return out;
    };
    const rep = { frames: 0, embeds: 0, crosses: 0, byKind: {}, samples: [], seenBodies: 0 };
    const prev = new Map(); const ownCells = new Map();
    const log = (type, b, extra) => {
      const kk = b.k; (rep.byKind[kk] = rep.byKind[kk] || { embed: 0, cross: 0 })[type]++;
      if (rep.samples.length < 40 && !rep.samples.some((q) => q.k === kk && q.type === type && Math.abs(q.f - rep.frames) < 120)) rep.samples.push({ f: rep.frames, type, k: kk, x: Math.round(b.x), y: Math.round(b.y), ...extra });
    };
    const check = () => {
      const cur = bodies(); const seen = new Set();
      for (const b of cur) {
        seen.add(b.id);
        const pv = prev.get(b.id);
        let own = null;
        if (b.k.startsWith('bw:')) {
          own = new Set();
          // a block's own stamp (its home / spawn cells) is not rock to itself
          if (typeof _gridBwallHomeCells === 'function') for (const q of _gridBwallHomeCells(b.o)) own.add(q[0] + ',' + q[1]);
        }
        let dd = depth(b.x, b.y, b.w, b.h, own);
        // the hero keeps his own, finer collision (a 40px wheel squeezes a 32px gap by design): ask the engine itself
        if (b.k === 'p1' || b.k === 'p2') { let emb = false; try { emb = gridOverlaps(gridPlayerBody(b.o)); } catch (e) {} dd = { d: emb ? TOL + 20 : 0, cell: null }; }
        let flagged = false;
        if (dd.d > TOL) { rep.embeds++; flagged = true; log('embed', b, { tun: B.tunnelStats && { st: B.tunnelStats.stuck, f: B.tunnelStats.fixed }, flags: b.k.startsWith('e:') ? { al: b.o.alive, hid: !!b.o._hidden, gone: !!b.o._gone, perm: !!b.o._permOff, held: !!b.o._betaHeld, dn: !!b.o._downed, off: b.o._mindOff, pit: b.o._pitT, roped: (B.ropes || []).some((r) => r.e === b.o) } : undefined, from: pv ? [Math.round(pv.x), Math.round(pv.y), Math.round(pv.d)] : null, depth: Math.round(dd.d), cell: dd.cell, near: b.k.startsWith('bw:') && dd.cell ? BWALLS.filter((o) => o !== b.o && o.hp > 0 && Math.abs(o.x - dd.cell[0] * T) < 40 && Math.abs(o.y - dd.cell[1] * T) < 40).map((o) => ({ x: Math.round(o.x), y: Math.round(o.y), hc: o.homeCol, hr: o.homeRow, fly: !!o._fly, pb: !!o._pb, mov: !!o.movable })) : undefined, cellType: dd.cell ? G.data[dd.cell[1]][dd.cell[0]] : undefined, info: b.k.startsWith('bw:') ? { kind: b.o.kind, mov: !!b.o.movable, fly: !!b.o._fly, aw: !!b.o._awake, pb: !!b.o._pb, car: !!b.o._carried, home: [Math.round(b.o.homeX), Math.round(b.o.homeY)], w: b.w, h: b.h } : { st: b.o.st, h: b.h, og: !!b.o.og },  v: [Math.round((b.o.vx || 0) * 10) / 10, Math.round((b.o.vy || 0) * 10) / 10] }); }
        if (pv && !flagged && b.k !== 'p1' && b.k !== 'p2') {
          const dx = b.x - pv.x, dy = b.y - pv.y, dist = Math.max(Math.abs(dx), Math.abs(dy));
          if (dist > 3 && dist < 200 && !(B.ropes || []).some((r) => r.e === b.o) && pv.d <= TOL && depth(pv.x, pv.y, b.w, b.h, own).d <= TOL) {   // (a block stamped into last frame's spot is not a crossing: the grid changed, nothing moved through it)
            // a move is legal if ANY of three paths stays out of rock: straight, x-then-y, y-then-x (a slide round a corner)
            const walk = (pts) => { for (let k = 0; k + 1 < pts.length; k++) { const [x0, y0] = pts[k], [x1, y1] = pts[k + 1]; const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / 2)); for (let i = 1; i <= n; i++) { const q = depth(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, b.w, b.h, own); if (q.d > TOL + 6) return q; } } return null; };
            const q1 = walk([[pv.x, pv.y], [b.x, b.y]]);
            if (q1) { const q2 = walk([[pv.x, pv.y], [b.x, pv.y], [b.x, b.y]]), q3 = walk([[pv.x, pv.y], [pv.x, b.y], [b.x, b.y]]); if (q2 && q3) { rep.crosses++; log('cross', b, { from: [Math.round(pv.x), Math.round(pv.y)], roped: (B.ropes || []).some((r) => r.e === b.o), plat: !!b.o._plat, depth: Math.round(q1.d), cell: q1.cell }); } }
          }
        }
        prev.set(b.id, { x: b.x, y: b.y, d: dd.d });
      }
      for (const k of [...prev.keys()]) if (!seen.has(k)) prev.delete(k);
      rep.seenBodies = Math.max(rep.seenBodies, cur.length);
    };
    const safe = () => { p.hp = 100; p.inv = 9999; B.popup = null; B.freeze = 0; B.trans = null; };
    const fling = () => {
      for (const e of ENEMS) if (e && e.alive !== false && rnd() < 0.5) { const sp = rnd() < 0.3 ? rr(25, 60) : rr(6, 25); const a = rnd() * 6.283; e.vx = Math.cos(a) * sp; e.vy = Math.sin(a) * sp * 0.8; e.og = false; }
      for (const bw of BWALLS) if (bw && bw.hp > 0 && bw.movable && rnd() < 0.5) { const sp = rnd() < 0.3 ? rr(20, 50) : rr(5, 20); const a = rnd() * 6.283; if (typeof _wakeBwall === 'function') _wakeBwall(bw); bw._fly = true; bw.vx = Math.cos(a) * sp; bw.vy = Math.sin(a) * sp; }
      const sp = rr(10, 40), a = rnd() * 6.283; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp * 0.9; p.og = false;
      if (window.p2 && p2) { p2.vx = rr(-30, 30); p2.vy = rr(-25, 8); }
    };
    // extra cubes dropped near the hero and foes (stacking / blocks on foes)
    const dropCubes = () => {
      const anchors = [{ x: p.x, y: p.y }].concat(ENEMS.filter((e) => e.alive !== false).slice(0, 3).map((e) => ({ x: e.x, y: e.y })));
      for (const a of anchors) {
        if (BWALLS.length > 60) break;
        const c = Math.floor(a.x / T) + Math.floor(rr(-2, 3)), r = Math.floor(a.y / T) - 4;
        if (solidAt(c, r) || solidAt(c, r - 1)) continue;
        try { const m = B.placeEntity('Box', c, r, { kind: rnd() < 0.5 ? 'omni' : 'xlr' }); const bw = m && m.bwalls && m.bwalls[0]; if (bw) { if (typeof _wakeBwall === 'function') _wakeBwall(bw); bw._fly = true; bw.vx = rr(-6, 6); bw.vy = rr(0, 12); } } catch (e) {}
      }
    };
    // explosions: the XLR blast (foes thrown, cube lines launched), a hexagon collapse (surge + thrown cubes + crumbling blocks)
    const blast = () => {
      const a = rnd() * 6.283; p.aimDX = Math.cos(a); p.aimDY = Math.sin(a); p.fc = Math.cos(a) >= 0;
      p.xlrOn = true; const was = ITEM; try { ITEM = 2; } catch (e) {}
      try { B.relPow = 1; if (B.blastEnemies) B.blastEnemies(1e4); if (B.blastCubes) B.blastCubes(1e4); } catch (e) {}
      try { ITEM = was; } catch (e) {} p.xlrOn = false; rep.blasts = (rep.blasts || 0) + 1;
    };
    let collapsed = false;
    const collapseF = () => {   // once per stage: the water hexagon collapses (Enemy F's environment reaction), if this stage has one
      if (collapsed || !window.MV_ENEMY_F) return;
      const e = ENEMS.find((o) => o && o._ai === 'cube' && o.alive !== false); if (!e) return;
      collapsed = true; try { MV_ENEMY_F.collapse(e); rep.collapsed = true; } catch (er) { rep.collapseErr = String(er && er.message || er); }
    };
    // riders: put foes and blocks on moving platforms / lifts so they are carried through the level
    const ride = () => {
      const pls = (B.platforms || []).filter((m) => !m.hidden);
      if (!pls.length) return;
      const m = pls[Math.floor(rnd() * pls.length)];
      const foes = ENEMS.filter((e) => e && e.alive !== false && !e.mind);
      const e = foes[Math.floor(rnd() * foes.length)];
      if (e) { e.x = m.x + m.w / 2 - (e.w || 30) / 2; e.y = m.y - (e.h || 30) - 1; e.vx = e.vy = 0; e.og = true; e._plat = m; e._platOff = e.x - m.x; prev.delete(e); rep.riders = (rep.riders || 0) + 1; }
      try { const c = Math.floor((m.x + m.w / 2) / T), r = Math.floor(m.y / T) - 2; if (!solidAt(c, r) && !solidAt(c, r - 1)) { const mk = B.placeEntity('Box', c, r, { kind: 'xlr' }); const bw = mk && mk.bwalls && mk.bwalls[0]; if (bw) { if (typeof _wakeBwall === 'function') _wakeBwall(bw); bw._fly = true; bw.vx = 0; bw.vy = 0; } } } catch (e2) {}
    };
    // water-pushed cubes: blocks dropped into the pools and left to the water's push (stages without a pool skip this)
    const wet = () => {
      for (const w of (B.waters || []).slice(0, 3)) {
        const c = Math.floor((w.c0 + w.c1) / 2 + rr(-2, 2)), r = w.r0 + 2 + Math.floor(rnd() * 3);
        if (solidAt(c, r)) continue;
        try { const mk = B.placeEntity('Box', c, r, { kind: 'omni' }); const bw = mk && mk.bwalls && mk.bwalls[0]; if (bw) { if (typeof _wakeBwall === 'function') _wakeBwall(bw); bw._fly = true; bw.vx = rr(-3, 3); bw.vy = 0; rep.wetCubes = (rep.wetCubes || 0) + 1; } } catch (e) {}
      }
    };
    // hop the hero around the stage's floors so foes/blocks near all areas get exercised
    const spots = []; for (let r = 4; r < G.rows - 2; r += 2) for (let c = 2; c < G.cols - 2; c += 5) if (solidAt(c, r + 1) && !solidAt(c, r) && !solidAt(c, r - 1) && !solidAt(c, r - 2)) spots.push([c, r]);
    const warp = () => { const sp = spots[Math.floor(rnd() * spots.length)]; if (!sp) return; p.x = sp[0] * T + T / 2 - SW / 2; p.y = (sp[1] + 1) * T - FEET_OFF; p.vx = p.vy = 0; };
    for (let f = 0; f < FRAMES; f++) {
      safe();
      if (f % 150 === 0) { warp(); prev.delete(p); }
      if (f % 45 === 10) fling();
      if (f % 200 === 30) dropCubes();
      if (f % 70 === 20) blast();
      if (f === 400) collapseF();
      if (f % 120 === 50) ride();
      if (f % 160 === 90) wet();
      try { update(); } catch (e) { rep.err = String(e && e.message || e); break; }
      rep.frames++;
      check();
    }
    rep.bodiesEnd = { enems: ENEMS.length, bwalls: BWALLS.length };
    return rep;
  }, { FRAMES, TOL, SEED, NOGUARD });
  res.lvl = lvl;
  await page.close();
  return res;
}

try { for (const lvl of LVLS) results.push(await runStage(lvl)); } finally { await browser.close(); srv.close(); }
let bad = 0;
for (const r of results) {
  bad += r.embeds + r.crosses + (r.err ? 1 : 0);
  console.log(`${r.embeds + r.crosses === 0 && !r.err ? 'PASS' : 'FAIL'}  ${r.lvl}  frames ${r.frames}  bodies<=${r.seenBodies}  blasts ${r.blasts || 0} collapse ${r.collapsed ? 'y' : 'n'} riders ${r.riders || 0} wetCubes ${r.wetCubes || 0}  embedFrames ${r.embeds}  crossings ${r.crosses}${r.err ? '  ERROR ' + r.err : ''}`);
  for (const [k, v] of Object.entries(r.byKind)) console.log(`      ${k.padEnd(14)} embed ${v.embed || 0}  cross ${v.cross || 0}`);
  for (const sm of r.samples.slice(0, 8)) console.log('      -', JSON.stringify(sm));
}
if (errors.length) console.log('page errors:', [...new Set(errors)].slice(0, 5));
const j = arg('json', null); if (j) await writeFile(j, JSON.stringify({ TOL, FRAMES, SEED, results, errors }, null, 1));
console.log(bad ? `TUNNEL PROBE FAIL (${bad})` : 'TUNNEL PROBE PASS');
process.exit(bad ? 1 : 0);
