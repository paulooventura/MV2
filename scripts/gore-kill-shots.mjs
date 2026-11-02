#!/usr/bin/env node
/**
 * GORE kills on screen (T399). Headless + muted, own free port, no visible browser.
 * Loads the game with GORE unlocked, drops into 1.1, puts three minions beside MIND,
 * kills them in a row and checks gibs, callouts and the combo really show up.
 * Also checks the blood moon is inside the 1.1 sky.
 *
 * Usage: node scripts/gore-kill-shots.mjs [outDir]   (exit 0 = PASS; screenshots go to outDir when given)
 */
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
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--autoplay-policy=user-gesture-required'] });
const errors = [];
let out = {};
const shot = async (page, name) => { if (OUT) { await mkdir(OUT, { recursive: true }); await page.screenshot({ path: join(OUT, 'gore-' + name + '.png') }); } };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  await page.addInitScript(() => { try { localStorage.setItem('mv2.gore', '1'); localStorage.setItem('mv2.console', 'gore'); } catch (e) {} });
  await page.route(/\.(mp3|ogg|m4a|wav)(\?|$)/, (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto(`http://127.0.0.1:${port}/index.html?tv=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof startBetaLab === 'function' && typeof _mkMinion === 'function' && window.MV_GORE_FX, null, { timeout: 30000 });
  await page.evaluate(async () => { try { if (window.MV_SIBLING) MV_SIBLING.on = false; } catch (e) {} await startBetaLab('1.1', 15, { fresh: true }); });
  await page.waitForFunction(() => window.MV_BETA && MV_BETA.stageId === '1.1' && !MV_BETA.loading && MV_GRID && MV_GRID.ready && p, null, { timeout: 30000 });
  await page.waitForTimeout(1500);

  // the sky: MIND outside on the plateau so the backdrop shows
  out.sky = await page.evaluate(() => {
    const B = MV_BETA, T = MV_GRID.tile; _loopAccT = -1e15; _zoneCardT = 0;
    const safe = () => { p.hp = 100; p.inv = 9999; B.popup = null; B.freeze = 0; B.trans = null; if (typeof _uiToastFr !== 'undefined') _uiToastFr = 0; };
    for (let i = 0; i < 30; i++) { safe(); update(); }
    draw();
    return { mode: MV_CONSOLE.mode, on: MV_GORE_FX.on, state: _gameState, moon: MV_GORE_FX.state ? MV_GORE_FX.state().moon : null, W, H };
  });
  await shot(page, 'moon');

  out.kill = await page.evaluate(() => {
    const B = MV_BETA, T = MV_GRID.tile, r = {};
    const safe = () => { p.hp = 100; p.inv = 9999; B.popup = null; B.freeze = 0; B.trans = null; if (typeof _uiToastFr !== 'undefined') _uiToastFr = 0; };
    const step = (n) => { for (let i = 0; i < n; i++) { safe(); update(); } };
    for (let i = ENEMS.length - 1; i >= 0; i--) ENEMS.splice(i, 1);
    step(300);                                   // let the stage card fade
    const feet = p.y + FEET_OFF, cx = p.x + SW / 2;
    p.fc = true;
    const list = [];
    for (const dx of [130, 210, 290]) {
      const m = _mkMinion(cx + dx, feet, 'square', { mn: cx + dx - 4, mx: cx + dx + 4, spd: 0 });
      m._awdjooKeep = true; m._betaEnemy = 'B';
      ENEMS.push(m); list.push(m);
    }
    step(8); draw();
    r.before = list.filter((e) => e.alive).length;
    // three kills, a few frames apart (combo window is 150 frames)
    const st = [];
    for (const e of list) {
      _damageEnemy(e, 999, cx, feet - 30, 1);
      step(6);
      st.push(MV_GORE_FX.state ? MV_GORE_FX.state() : null);
    }
    draw();
    r.after = st;
    r.dead = list.filter((e) => !e.alive || e.hp <= 0).length;
    return r;
  });
  await shot(page, 'kill');
  // MIND walks right through the pools: smears + bloody footprints
  out.smear = await page.evaluate(() => {
    const B = MV_BETA;
    const safe = () => { p.hp = 100; p.inv = 9999; B.popup = null; B.freeze = 0; B.trans = null; if (typeof _uiToastFr !== 'undefined') _uiToastFr = 0; };
    const s0 = MV_GORE_FX.state();
    for (let i = 0; i < 110; i++) { safe(); p.vx = 4; p.fc = true; update(); }
    for (let i = 0; i < 20; i++) { safe(); update(); }
    draw();
    return { before: s0.pools, ...MV_GORE_FX.state() };
  });
  await shot(page, 'smear');
  // stand MIND beside a jack-o'-lantern or candle: glow + charring
  out.glow = await page.evaluate(() => {
    const B = MV_BETA;
    const safe = () => { p.hp = 100; p.inv = 9999; B.popup = null; B.freeze = 0; B.trans = null; if (typeof _uiToastFr !== 'undefined') _uiToastFr = 0; };
    draw();
    const props = MV_GORE_FX.state().props;
    const q = props.find((o) => o.kind === 'jack') || props[0];
    if (!q) return { props: 0 };
    p.x = q.x - SW / 2 - 14; p.y = q.y - FEET_OFF - 2; p.vx = p.vy = 0;
    for (let i = 0; i < 120; i++) { safe(); p.x = q.x - SW / 2 - 14; p.vx = 0; update(); if (i % 2 === 0) draw(); }
    draw();
    return { prop: q, count: props.length, ...MV_GORE_FX.state(), props: undefined };
  });
  await shot(page, 'glow');
} finally { await browser.close(); srv.close(); }

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const last = out.kill && out.kill.after && out.kill.after[2];
ok(out.sky && out.sky.mode === 'gore' && out.sky.on, 'GORE is on in the probe');
ok(out.sky && out.sky.state === 'game', 'in game');
ok(out.kill && out.kill.before === 3, 'three minions placed');
ok(out.kill && out.kill.dead === 3, 'all three killed');
ok(last && last.gibs >= 15, 'gibs on screen after kills');
ok(last && last.calls >= 2, 'kill callouts on screen');
ok(last && last.combo >= 3, 'combo counter reached 3');
const m = out.sky && out.sky.moon;
ok(m && m.x > m.r && m.x < out.sky.W - m.r && m.y > m.r && m.y < out.sky.H * 0.6, 'blood moon inside the 1.1 sky');
ok(out.smear && out.smear.before >= 1, 'blood pool under the kills');
ok(out.smear && out.smear.streaks >= 3, 'walking through smears the pool');
ok(out.smear && out.smear.prints >= 1, 'bloody footprints after the pool');
ok(out.glow && out.glow.count >= 3, 'candles / jack-o\'-lanterns placed in 1.1');
ok(out.glow && out.glow.hot >= 1, 'lanterns mark hot spots');
ok(out.glow && out.glow.char > 0.3, 'MIND chars beside the lantern');
ok(errors.length === 0, 'no page errors');
console.log(JSON.stringify({ ...out, errors }, null, 1));
console.log(fails.length ? 'FAIL:\n - ' + fails.join('\n - ') : 'PASS: GORE kills on screen');
process.exit(fails.length ? 1 : 0);
