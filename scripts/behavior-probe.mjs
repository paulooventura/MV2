#!/usr/bin/env node
/**
 * Behaviour probe — drives the player directly and reports on the four things
 * that keep breaking: spawn placement, downhill roll, uphill drag, and getting
 * through the omniblock door / floor hatch.
 */
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.wav': 'audio/wav', '.webmanifest': 'application/manifest+json',
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
    srv.listen(port, '127.0.0.1', () => resolve({ srv, port }));
  });
}

async function main() {
  let bound = null;
  for (const port of [8794, 8795, 8796]) {
    try { bound = await startServer(port); break; } catch (e) { if (port === 8796) throw e; }
  }
  const { srv, port } = bound;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
    await page.addInitScript(() => {
      window.__MV_FORCE_SELFTEST = true;
      try { sessionStorage.setItem('mv_selftest', '1'); } catch (e) {}
    });
    await page.goto(`http://127.0.0.1:${port}/index.html?selftest=1&quick=1&_=${Date.now()}`, { waitUntil: 'domcontentloaded' });
    page.setDefaultTimeout(90000);
    await page.waitForFunction(() => typeof p !== 'undefined' && p && typeof _gameState !== 'undefined' && _gameState === 'game' && typeof MV_GRID !== 'undefined' && MV_GRID && MV_GRID.ready);

    const out = await page.evaluate(async () => {
      const T = MV_GRID.tile;
      const log = [];
      const wait = (n) => new Promise((res) => {
        let i = 0;
        const tick = () => (++i >= n ? res() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      });
      const clearKeys = () => { for (const k of Object.keys(K)) K[k] = false; };
      const feet = () => p.y + FEET_OFF;
      const cx = () => p.x + SW / 2;
      const cell = () => ({ col: Math.floor(cx() / T), row: Math.floor(feet() / T) });
      const put = (col, row, opts) => {
        p.x = (col + 0.5) * T - SW / 2;
        p.y = row * T - FEET_OFF - ((opts && opts.above) || 0);
        p.vx = 0; p.vy = 0; p.og = true;
        p.runRamp = 0; p.momentum = 0; p._slopeRollT = 0;
      };

      // Bot drove us into play; take the wheel.
      if (window.MV_SELFTEST && MV_SELFTEST.stop) MV_SELFTEST.stop();
      clearKeys();
      await wait(40);

      // ── 1. Spawn ────────────────────────────────────────────────
      log.push(['spawn', JSON.stringify({ ...cell(), x: Math.round(p.x), feet: Math.round(feet()), og: !!p.og, crouch: +(p.crouchAmt || 0).toFixed(2) })]);

      // ── 2. Free roll down the 45° hill ──────────────────────────
      put(22, 70);
      clearKeys();
      await wait(6);
      const tr = [];
      for (let i = 0; i < 90; i++) {
        await wait(1);
        if (i % 6 === 5) {
          tr.push(cell().col + ',' + cell().row + ':v' + (p.vx || 0).toFixed(1) +
            'c' + (p.crouchAmt || 0).toFixed(1) + 'w' + (p._slopeWeight || 0).toFixed(1));
        }
      }
      log.push(['roll trail', tr.join(' ')]);
      log.push(['roll end', JSON.stringify({ ...cell(), vx: +(p.vx || 0).toFixed(2), crouch: +(p.crouchAmt || 0).toFixed(2) })]);

      // ── 3. Uphill: walk vs run ──────────────────────────────────
      const climb = async (sprint) => {
        put(26, 74);
        clearKeys();
        await wait(6);
        const x0 = cx();
        const trail = [];
        K['KeyA'] = true;
        if (sprint) K['ShiftLeft'] = true;
        for (let i = 0; i < 60; i++) {
          await wait(1);
          if (i % 10 === 9) trail.push(((x0 - cx()) / T).toFixed(2) + '@' + (p.vx || 0).toFixed(1) + 'w' + (p._slopeWeight || 0).toFixed(1) + 'r' + (p.runRamp || 0).toFixed(1));
        }
        const d = x0 - cx();
        clearKeys();
        await wait(4);
        return { tiles: +(d / T).toFixed(2), row: cell().row, trail: trail.join(' ') };
      };
      const walkUp = await climb(false);
      const runUp = await climb(true);
      log.push(['uphill walk 60f', JSON.stringify(walkUp)]);
      log.push(['uphill run  60f', JSON.stringify(runUp)]);

      // ── 4. Omniblock door at col 28 ─────────────────────────────
      const doorCellsBefore = [72, 73, 74, 75].map((r) => gridCell(28, r));
      put(27, 76);
      clearKeys();
      K['KeyD'] = true;
      const doorTrail = [];
      for (let i = 0; i < 90; i++) {
        await wait(1);
        if (i % 6 === 5) doorTrail.push(cell().col + ',' + cell().row);
      }
      clearKeys();
      const blockedAt = cell();
      log.push(['east trail vs intact door', doorTrail.join(' ')]);
      await wait(4);
      for (const bw of BWALLS) {
        if (bw.homeCol === 28) {
          bw.hp = 3;
          _damageBwall(bw, 99, {});
        }
      }
      await wait(6);
      const doorCellsAfter = [72, 73, 74, 75].map((r) => gridCell(28, r));
      put(27, 76);
      clearKeys();
      K['KeyD'] = true;
      for (let i = 0; i < 120; i++) await wait(1);
      clearKeys();
      const throughAt = cell();
      log.push(['door grid before/after', doorCellsBefore.join('') + ' -> ' + doorCellsAfter.join('')]);
      log.push(['walk east, door intact', JSON.stringify(blockedAt)]);
      log.push(['walk east, door smashed', JSON.stringify(throughAt)]);
      put(31, 76);
      clearKeys();
      K['KeyA'] = true;
      for (let i = 0; i < 120; i++) await wait(1);
      clearKeys();
      log.push(['walk west out the door', JSON.stringify(cell())]);

      // ── 5. Floor hatch: stand on it, then smash, then fall ──────
      put(37, 76);
      clearKeys();
      await wait(10);
      log.push(['on hatch before smash', JSON.stringify({ ...cell(), crouch: +(p.crouchAmt || 0).toFixed(2) })]);
      for (const bw of BWALLS) {
        if (bw.homeRow === 76 && bw.homeCol >= 36 && bw.homeCol <= 38) {
          bw.hp = 3;
          _damageBwall(bw, 99, {});
        }
      }
      await wait(120);
      log.push(['hatch grid row76', [36, 37, 38].map((c) => gridCell(c, 76)).join('')]);
      log.push(['drop through hatch', JSON.stringify({ ...cell(), og: !!p.og, crouch: +(p.crouchAmt || 0).toFixed(2) })]);

      // ── 6. Can we reach the basement RCA cell on foot? ──────────
      clearKeys();
      K['KeyA'] = true;
      for (let i = 0; i < 150; i++) await wait(1);
      clearKeys();
      await wait(60);
      log.push(['walk west in basement', JSON.stringify(cell())]);

      return log;
    });

    for (const [k, v] of out) console.log(String(k).padEnd(26), v);
  } finally {
    await browser.close().catch(() => {});
    await new Promise((r) => srv.close(r));
  }
}

main().catch((e) => { console.error('behaviour probe failed:', e.message); process.exitCode = 1; });
