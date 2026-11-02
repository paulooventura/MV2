#!/usr/bin/env node
/**
 * Frame-time probe (T186). Headless + muted, own free port, no visible browser, no audio files.
 * Measures real rAF fps and the cost of draw()/update() on: title, character select (both steps),
 * stage 1.1 with enemies, and 1.1 with GORE on. Desktop 1280x720 and a phone 844x390 with the CPU
 * throttled 4x. Also walks 1.2 and 1.3 and collects every console error / warning / page error.
 *
 * Usage: node scripts/perf-probe.mjs [--json out.json] [--secs 3]
 */
import { createServer } from 'http';
import { readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { chromium, firefox } from 'playwright';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SECS = +arg('--secs', 3);
const JSON_OUT = arg('--json', '');
const SHOTS = arg('--shots', '');
if (SHOTS) await (await import('fs/promises')).mkdir(SHOTS, { recursive: true });
// --before: serve every file changed since HEAD as it is in HEAD (A/B on the same machine, same minute)
const BEFORE = new Map();
if (process.argv.includes('--before')) {
  const { execSync } = await import('child_process');
  const changed = execSync('git diff --name-only HEAD', { cwd: ROOT }).toString().split('\n').filter((f) => /^claude\/.*\.js$/.test(f));
  for (const f of changed) BEFORE.set('/' + f, execSync('git show HEAD:' + f, { cwd: ROOT, maxBuffer: 1 << 26 }));
  console.log('serving HEAD versions of:', changed.join(', ') || '(none)');
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ldtk': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/json' };
const srv = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent((req.url || '/').split('?')[0]); if (path === '/') path = '/index.html';
    const data = BEFORE.get(path) || await readFile(join(ROOT, path.replace(/^\//, '').replace(/\.\./g, '')));
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
// real GPU by default (still headless); --swgl keeps Chromium's software GL, which caps WebGL far below any real device
const GPU = process.argv.includes('--swgl') ? [] : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
// --firefox: Paulo's browser. Muted by prefs (volume 0, all autoplay blocked); no CDP, so no CPU throttle there.
const FF = process.argv.includes('--firefox');
const browser = FF
  ? await firefox.launch({ headless: true, firefoxUserPrefs: { 'media.volume_scale': '0.0', 'media.autoplay.default': 5, 'media.autoplay.blocking_policy': 2 } })
  : await chromium.launch({ headless: true, args: ['--mute-audio', '--autoplay-policy=user-gesture-required', ...GPU] });

const PROFILES = FF ? [
  { name: 'ff-desk', ctx: { viewport: { width: 1280, height: 720 } }, throttle: 1 },
  { name: 'ff-phone', ctx: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true }, throttle: 1 },
] : [
  { name: 'desktop', ctx: { viewport: { width: 1280, height: 720 } }, throttle: 1 },
  { name: 'phone-4x', ctx: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, throttle: 4 },
];

async function openGame(profile, gore) {
  const context = await browser.newContext(profile.ctx);
  const page = await context.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: String(e && e.message || e) }));
  page.on('console', (m) => { const t = m.type(); if (t === 'error' || t === 'warning') logs.push({ type: t, text: m.text().slice(0, 300) }); });
  page.on('requestfailed', (r) => { if (!/\.(mp3|ogg|m4a|wav)(\?|$)/.test(r.url())) logs.push({ type: 'requestfailed', text: r.url() }); });
  page.on('response', (r) => { if (r.status() === 404 && !/\.(mp3|ogg|m4a|wav)(\?|$)/.test(r.url())) logs.push({ type: '404', text: r.url().replace(/^http:\/\/127\.0\.0\.1:\d+/, '') }); });
  await page.addInitScript((g) => {
    try { if (g) { localStorage.setItem('mv2.gore', '1'); localStorage.setItem('mv2.console', 'gore'); } } catch (e) {}
    // time draw()/update() once they exist (classic-script function declarations are window props)
    const wrap = () => {
      if (!window.draw || !window.update || window.__perfWrapped) return !!window.__perfWrapped;
      window.__perfWrapped = true;
      const P = window.__perf = { draw: [], update: [] };
      const d0 = window.draw, u0 = window.update;
      window.draw = function () { const t = performance.now(); try { return d0.apply(this, arguments); } finally { P.draw.push(performance.now() - t); } };
      window.update = function () { const t = performance.now(); try { return u0.apply(this, arguments); } finally { P.update.push(performance.now() - t); } };
      return true;
    };
    const iv = setInterval(() => { if (wrap()) clearInterval(iv); }, 50);
  }, gore);
  await page.route(/\.(mp3|ogg|m4a|wav)(\?|$)/, (r) => r.fulfill({ status: 404, body: '' }));
  const cdp = FF ? null : await context.newCDPSession(page);
  await page.goto(`http://127.0.0.1:${port}/index.html?tv=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof startBetaLab === 'function' && window.__perfWrapped && typeof drawSelect === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  return { context, page, cdp, logs };
}

async function measure(page, cdp, throttle, secs) {
  await page.evaluate(() => { __perf.draw.length = 0; __perf.update.length = 0; });
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  const r = await page.evaluate((secs) => new Promise((res) => {
    const ts = []; const t0 = performance.now();
    const f = (t) => { ts.push(t); if (t - t0 < secs * 1000) requestAnimationFrame(f); else res(ts); };
    requestAnimationFrame(f);
  }), secs);
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const perf = await page.evaluate(() => ({ draw: __perf.draw.slice(), update: __perf.update.slice() }));
  const iv = []; for (let i = 1; i < r.length; i++) iv.push(r[i] - r[i - 1]);
  iv.sort((a, b) => a - b);
  const avg = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  const pct = (a, q) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };
  const span = r[r.length - 1] - r[0];
  return {
    fps: +(1000 * (r.length - 1) / span).toFixed(1),
    p95ms: +pct(iv, 0.95).toFixed(1),
    drawMs: +avg(perf.draw).toFixed(2), drawP95: +pct(perf.draw, 0.95).toFixed(2),
    updMs: +avg(perf.update).toFixed(2),
  };
}

const SCENES = {
  title: async (page) => page.evaluate(() => { _gameState = 'title'; }),
  selectMode: async (page) => page.evaluate(() => { _gameState = 'select'; _selectStep = 0; }),
  selectHero: async (page) => page.evaluate(() => { _gameState = 'select'; _selectStep = 1; _heroChoice = 'mind'; }),
  stage11: async (page) => {
    await page.evaluate(async () => { await startBetaLab('1.1', 15, { fresh: true }); });
    await page.waitForFunction(() => window.MV_BETA && MV_BETA.stageId === '1.1' && !MV_BETA.loading && MV_GRID && MV_GRID.ready, null, { timeout: 30000 });
    await page.evaluate(() => { p.hp = 100; p.inv = 1e9; if (MV_BETA) MV_BETA.popup = null; });
    await page.waitForTimeout(800);
  },
};

const results = []; const allLogs = [];
try {
  for (const prof of PROFILES) {
    for (const gore of [false, true]) {
      const { context, page, cdp, logs } = await openGame(prof, gore);
      const list = gore ? ['selectHero', 'stage11'] : ['title', 'selectMode', 'selectHero', 'stage11'];
      for (const sc of list) {
        await SCENES[sc](page);
        await page.waitForTimeout(400);
        const m = await measure(page, cdp, prof.throttle, SECS);
        if (SHOTS && !gore) await page.screenshot({ path: join(SHOTS, `${prof.name}-${sc}.png`) });
        const ex = await page.evaluate(() => ({ enemies: (window.ENEMS || []).filter((e) => e.alive !== false).length, state: _gameState }));
        results.push({ profile: prof.name, gore, scene: sc, ...m, ...ex });
        console.log(`${prof.name.padEnd(9)} ${gore ? 'GORE' : '    '} ${sc.padEnd(11)} fps ${String(m.fps).padStart(5)}  p95 ${String(m.p95ms).padStart(5)}ms  draw ${m.drawMs}ms (p95 ${m.drawP95})  update ${m.updMs}ms  enemies ${ex.enemies}`);
      }
      if (prof.name === 'desktop' && !gore && !process.argv.includes('--no-sweep')) {
        // error sweep: walk 1.2 and 1.3 a little, holding right, jumping
        for (const sid of ['1.2', '1.3']) {
          try {
            await page.evaluate(async (sid) => { await startBetaLab(sid, 15, { fresh: true }); }, sid);
            await page.waitForFunction((sid) => window.MV_BETA && MV_BETA.stageId === sid && !MV_BETA.loading, sid, { timeout: 30000 });
            await page.evaluate(() => { p.hp = 100; p.inv = 1e9; });
            await page.keyboard.down('ArrowRight');
            for (let i = 0; i < 8; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(350); }
            await page.keyboard.up('ArrowRight');
          } catch (e) { logs.push({ type: 'probe', text: sid + ': ' + e.message }); }
        }
      }
      for (const l of logs) allLogs.push({ profile: prof.name, gore, ...l });
      await context.close();
    }
  }
} finally { await browser.close(); srv.close(); }

const uniq = new Map();
for (const l of allLogs) { const k = l.type + '|' + l.text; uniq.set(k, (uniq.get(k) || 0) + 1); }
console.log('\nconsole errors / warnings (unique):');
for (const [k, n] of uniq) console.log(`  x${n}  ${k}`);
if (!uniq.size) console.log('  none');
if (JSON_OUT) await writeFile(JSON_OUT, JSON.stringify({ results, logs: [...uniq].map(([k, n]) => ({ k, n })) }, null, 1));
