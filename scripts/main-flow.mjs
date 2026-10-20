// Headless walk-through of the live game's menus (index.html):
// splashes → title → Esc shut-down prompt → options → story → 1.1 → pause menu
// (resume / options / exit). No visible browser, no audio. Exit 0 = PASS.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const PORT = Number(process.env.MV_FLOW_PORT || 8799);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ldtk': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const srv = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(PORT);
const out = 'test-results/main-flow';
fs.mkdirSync(out, { recursive: true });

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1100, height: 1000 } });
const errs = [], steps = [];
pg.on('pageerror', e => errs.push(e.message));
const gs = () => pg.evaluate(() => ({ gs: _gameState, paused: _paused, stage: window.MV_BETA && MV_BETA.on ? MV_BETA.stageId : null }));
const shot = n => pg.locator('#c').screenshot({ path: `${out}/${n}.png` });
const key = async (k, wait = 120) => { await pg.keyboard.press(k); await pg.waitForTimeout(wait); };
const expect = async (name, fn) => { const s = await gs(); const ok = fn(s); steps.push([name, ok ? 'ok' : 'FAIL', s]); return ok; };

await pg.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await pg.waitForTimeout(300);
await expect('boots on splash', s => s.gs === 'splash');
await pg.waitForFunction(() => _gameState === 'title', null, { timeout: 12000 });
await pg.focus('#c');
await expect('title after splashes', s => s.gs === 'title'); await shot('1-title');
await key('Escape'); await expect('Esc on title asks to shut down', s => s.gs === 'quit'); await shot('2-quit');
await key('Enter'); await expect('NO goes back to title', s => s.gs === 'title');
await key('ArrowDown'); await key('Enter'); await expect('OPTIONS opens', s => s.gs === 'options');
await key('Escape'); await expect('options back to title', s => s.gs === 'title');
await key('ArrowUp'); await key('Enter'); await expect('STORY MODE', s => s.gs === 'story');
for (let i = 0; i < 5; i++) await key('Space', 200);
await pg.waitForFunction(() => window.MV_BETA && MV_BETA.on && MV_BETA.stageId === '1.1' && _gameState === 'game', null, { timeout: 12000 }).catch(() => {});
await pg.waitForTimeout(1200);
await expect('story lands in 1.1', s => s.gs === 'game' && s.stage === '1.1');
await key('Escape'); await expect('Esc pauses', s => s.gs === 'game' && s.paused); await shot('3-pause');
await key('Escape'); await expect('Esc resumes', s => s.gs === 'game' && !s.paused);
await key('Escape'); await key('ArrowDown'); await key('Enter'); await expect('pause > OPTIONS', s => s.gs === 'options');
await key('Escape'); await expect('options back to paused stage', s => s.gs === 'game' && s.paused);
await key('ArrowUp'); await key('Enter'); await expect('RESUME GAME', s => s.gs === 'game' && !s.paused);
await key('Escape'); await key('ArrowDown'); await key('ArrowDown'); await key('Enter');
await expect('EXIT back to main menu', s => s.gs === 'title');
await key('Escape'); await key('ArrowDown'); await key('Enter', 600);
await expect('YES powers off', s => s.gs === 'off'); await shot('4-off');
await pg.waitForTimeout(1200); await key('Enter', 300);
await expect('Start powers back on', s => s.gs === 'splash');

const pass = steps.every(s => s[1] === 'ok') && errs.length === 0;
for (const [n, r, s] of steps) console.log((r === 'ok' ? '  ok   ' : '  FAIL ') + n + '  ' + JSON.stringify(s));
if (errs.length) console.log('page errors:', errs);
console.log(pass ? 'MAIN FLOW PASS' : 'MAIN FLOW FAIL');
await b.close(); srv.close();
process.exitCode = pass ? 0 : 1;
