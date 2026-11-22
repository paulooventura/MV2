#!/usr/bin/env node
// Real-build stills at 1920x1080 of the live page (index.html = claude/). Headless, muted.
// Usage: node scripts/_claude-shots.mjs <outDir>
import { createServer } from 'http';
import { readFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT = process.argv[2];
await mkdir(OUT, { recursive: true });
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
const errors = [], made = [];
const open = async (qs) => {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  await page.route(/\.(mp3|ogg|m4a|wav)(\?|$)/, (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto(`http://127.0.0.1:${port}/index.html?tv=0${qs || ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof startBetaLab === 'function', null, { timeout: 30000 });
  return page;
};
const shot = async (page, name) => { await page.screenshot({ path: join(OUT, name + '.png') }); made.push(name); };
const stage = async (page, id, col, row) => {
  await page.evaluate(async ([id]) => { try { if (window.MV_SIBLING) MV_SIBLING.on = false; } catch (e) {} await startBetaLab(id, 15, { fresh: true }); }, [id]);
  await page.waitForFunction((id) => window.MV_BETA && MV_BETA.stageId === id && !MV_BETA.loading && MV_GRID && MV_GRID.ready && p, id, { timeout: 30000 });
  await page.evaluate(() => { setInterval(() => { try { p.hp = p.maxHp; p.flashF = 0; } catch (e) {} }, 16); });   // healthy for the stills
  await page.waitForTimeout(6500);                                                                           // let the stage card fade
  if (col != null) await page.evaluate(([c, r]) => { const T = MV_GRID.tile; p.x = c * T; p.y = r * T; p.vx = 0; p.vy = 0; }, [col, row]);
};
try {
  // 1) speed streaks: MIND rolls along 1.1 with the sports state held on
  let page = await open();
  await stage(page, '1.1');
  await page.evaluate(() => { window.__sp = setInterval(() => { p._sportHeat = 0.9; p.vx = p.fc ? 12 : -12; }, 16); });
  await page.waitForTimeout(1800);
  await shot(page, 'mv2-speed-streaks');
  await page.evaluate(() => clearInterval(window.__sp));
  await page.close();

  // 2) stage 1.2 water + F
  page = await open();
  await stage(page, '1.2', 14, 58);
  await page.waitForTimeout(2500);
  await shot(page, 'mv2-stage-1-2-water-foe');
  await page.close();

  // 3) booklet
  page = await open();
  await stage(page, '1.1');
  await page.evaluate(() => MV_MANUAL.open());
  await page.waitForTimeout(700);
  await shot(page, 'mv2-booklet-cover');
  for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250); }
  await shot(page, 'mv2-booklet-page');
  await page.close();

  // 4) intro slideshow
  page = await open('&story=1');
  await page.waitForTimeout(9000);
  await shot(page, 'mv2-intro-slide');
  await page.close();
} catch (e) { errors.push('SCRIPT: ' + (e && e.message || e)); }
await browser.close(); srv.close();
console.log(JSON.stringify({ made, errors }, null, 1));
process.exit(errors.length ? 1 : 0);
