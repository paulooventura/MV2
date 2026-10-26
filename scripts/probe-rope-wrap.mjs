#!/usr/bin/env node
/**
 * T161 — the RCA rope wraps rock corners and never runs through rock.
 * Throws the hook at the corners from the bug report (1.2 column, 1.1 trapdoor cubes,
 * 1.1 hook-in-the-wall spots), swings right / left / reels, and asserts that no stretch of
 * the line (anchor → bends → MIND's pull point) lies inside a solid cell, and that the hook
 * is never seated inside rock.
 *
 * Usage: node scripts/probe-rope-wrap.mjs   (headless, own free port, exit 0 = PASS)
 */
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ldtk': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
// [col, row, aimX, aimY] — MIND stands on the floor at (col, row)
const CASES = {
  '1.1': [[29, 42, 0, -1], [29, 42, 0.7, -0.7], [29, 42, -1, -0.25], [44, 66, 0, -1], [46, 45, -0.7, -0.7], [38, 58, -0.7, -0.7], [66, 26, 0, -1], [89, 32, -1, -0.25]],
  '1.2': [[41, 42, 0.7, -0.7], [39, 49, 1, -0.25], [61, 54, -1, -0.25], [61, 54, -0.7, -0.7], [37, 61, -0.7, -0.7]],
};

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
let fail = 0;
try {
  for (const [lvl, cases] of Object.entries(CASES)) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.route(/\.(mp3|ogg|m4a)(\?|$)/, (r) => r.fulfill({ status: 404, body: '' }));
    await page.goto(`http://127.0.0.1:${port}/index.html?ci=1&tv=0`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof startBetaLab === 'function' && typeof mkP === 'function', null, { timeout: 30000 });
    await page.evaluate(async (id) => { try { if (window.MV_SIBLING) MV_SIBLING.on = false; } catch (e) {} await startBetaLab(id, 15, { fresh: true }); }, lvl);
    await page.waitForFunction((id) => window.MV_BETA && MV_BETA.stageId === id && !MV_BETA.loading && MV_GRID && MV_GRID.ready && p, lvl, { timeout: 30000 });
    const out = await page.evaluate((cases) => {
      const T = MV_GRID.tile, solid = (x, y) => _armSolid(x, y);
      _loopAccT = -1e15; window.applyPlayerHit = function () {}; ENEMS.splice(0);
      const safe = () => { p.hp = 100; p.inv = 9999; const B = MV_BETA; B.popup = null; B.freeze = 0; B.trans = null; };
      const step = (n, cb) => { for (let i = 0; i < n; i++) { safe(); update(); if (cb && cb() === false) return; } };
      const keys = (k) => { for (const q of Object.keys(K)) K[q] = false; if (k) K[k] = true; };
      const inRock = () => {                       // longest stretch of the line inside rock (px), ends' 6 px excused
        const h = p.hook; if (!h || h.st !== 'on') return 0;
        const pts = [{ x: h.ax, y: h.ay }, ...(h.pivots || []), ropePlayerEndWorld()];
        let worst = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(L / 2); let run = 0;
          for (let j = 0; j <= n; j++) { const d = j / n * L; if (d < 6 || d > L - 6) { run = 0; continue; } if (solid(a.x + (b.x - a.x) * j / n, a.y + (b.y - a.y) * j / n)) { run += L / n; worst = Math.max(worst, run); } else run = 0; }
        }
        return worst;
      };
      const res = [];
      for (const [c, r, ax, ay] of cases) {
        p.x = (c + 0.5) * T - SW / 2; p.y = r * T - FEET_OFF; p.vx = p.vy = 0; if (p.hook) { p.hook.st = 'idle'; p.hook.pivots = null; }
        step(8);
        ITEM = 1; p.aimDX = p.tAimDX = ax; p.aimDY = p.tAimDY = ay; p.fc = ax >= 0;
        fireItem(); step(60, () => p.hook.st === 'ext');
        const h = p.hook;
        if (h.st !== 'on' || h.tgt || h.plat) { res.push({ at: c + ',' + r, aim: ax + ',' + ay, skipped: h.st }); continue; }
        const buried = [[4, 0], [-4, 0], [0, 4], [0, -4]].every(([dx, dy]) => solid(h.ax + dx, h.ay + dy));
        let worst = inRock(), bends = 0;
        const watch = () => { worst = Math.max(worst, inRock()); bends = Math.max(bends, (h.pivots || []).length); return h.st === 'on'; };
        keys('KeyD'); step(70, watch); keys('KeyA'); step(70, watch); keys('KeyW'); step(40, watch); keys('KeyS'); step(30, watch); keys(null); step(30, watch);
        res.push({ at: c + ',' + r, aim: ax + ',' + ay, anchor: Math.round(h.ax) + ',' + Math.round(h.ay), buried, inRock: Math.round(worst), bends, ok: !buried && worst <= 8 });
        if (p.hook.st === 'on') _detachPlayerRope(p.hook);
      }
      return res;
    }, cases);
    for (const o of out) {
      if (o.skipped) { console.log(`skip  ${lvl} ${o.at} aim ${o.aim} (hook ${o.skipped})`); continue; }
      if (!o.ok) fail++;
      console.log(`${o.ok ? 'PASS' : 'FAIL'}  ${lvl} ${o.at} aim ${o.aim} anchor ${o.anchor} bends ${o.bends} in rock ${o.inRock}px${o.buried ? ' HOOK IN ROCK' : ''}`);
    }
    await page.close();
  }
} finally { await browser.close(); srv.close(); }
console.log(fail ? `ROPE WRAP FAIL (${fail})` : 'ROPE WRAP PASS');
process.exitCode = fail ? 1 : 0;
