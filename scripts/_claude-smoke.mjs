#!/usr/bin/env node
// Smoke of the LIVE page (index.html = claude/ build). Headless, muted, own port.
// Usage: node scripts/_claude-smoke.mjs <outDir>   exit 0 = PASS
import { createServer } from 'http';
import { readFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT = process.argv[2] || '';
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
const errors = []; const out = {};
const shot = async (page, name) => { if (OUT) { await mkdir(OUT, { recursive: true }); await page.screenshot({ path: join(OUT, name + '.png') }); } };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  await page.route(/\.(mp3|ogg|m4a|wav)(\?|$)/, (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto(`http://127.0.0.1:${port}/index.html?tv=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof startBetaLab === 'function', null, { timeout: 30000 });
  out.build = await page.evaluate(() => (typeof BUILD !== 'undefined' ? BUILD : null));
  out.opts = await page.evaluate(() => ({ hp: typeof OPT !== 'undefined' && 'headphones' in OPT, mute: typeof OPT !== 'undefined' && 'mutePartner' in OPT, streaks: typeof _fxSpeedStreaks, pop: !!(window.MV_SFX_POSH || true) }));
  await page.evaluate(async () => { try { if (window.MV_SIBLING) MV_SIBLING.on = false; } catch (e) {} await startBetaLab('1.1', 15, { fresh: true }); });
  await page.waitForFunction(() => window.MV_BETA && MV_BETA.stageId === '1.1' && !MV_BETA.loading && MV_GRID && MV_GRID.ready && p, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  // sports-mode streaks: give MIND speed + heat for a few frames
  await page.evaluate(() => { p._sportHeat = 0.8; p.vx = 12; });
  await page.waitForTimeout(400);
  await page.evaluate(() => { p._sportHeat = 0.8; p.vx = 12; });
  await shot(page, 'claude-1.1-speed');
  out.alive = await page.evaluate(() => ({ stage: MV_BETA.stageId, fr: typeof fr === 'number' ? fr : null }));
  // the manual booklet (T575): open it, flip to a cutaway page, shoot desktop + phone
  for (const [w, h, tag] of [[1280, 720, 'desk'], [390, 844, 'phone']]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(500);
    out['manual_' + tag] = await page.evaluate(() => { try { MV_MANUAL.open(); return 'open'; } catch (e) { return String(e); } });
    await page.waitForTimeout(600);
    await shot(page, 'manual-' + tag + '-p1');
    for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250); }
    await shot(page, 'manual-' + tag + '-p5');
    await page.evaluate(() => { try { MV_MANUAL.close && MV_MANUAL.close(); } catch (e) {} });
  }
  // play the new pop sound path once (must not throw)
  out.popOk = await page.evaluate(() => { try { sfx('bubble_pop'); return true; } catch (e) { return String(e); } });
} catch (e) { errors.push('SCRIPT: ' + (e && e.message || e)); }
await browser.close(); srv.close();
console.log(JSON.stringify({ out, errors }, null, 1));
process.exit(errors.length ? 1 : 0);
