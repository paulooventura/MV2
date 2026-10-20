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
const ev = f => pg.evaluate(f);
const check = (name, ok, info) => steps.push([name, ok ? 'ok' : 'FAIL', info]);

// full-window picture: canvas is the biggest 4:3 that fits; no title / help / desktop pads
const lay = await ev(() => { const r = document.getElementById('c').getBoundingClientRect(); const vis = id => { const e = document.getElementById(id); return !!e && e.offsetParent !== null; };
  return { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight, title: !!document.getElementById('mvVer'), help: !!document.getElementById('helpLine'), pads: vis('touchHud') }; });
check('canvas fills the window (4:3 fit)', Math.abs(lay.w - Math.min(lay.vw, lay.vh * 4 / 3)) <= 2 && !lay.title && !lay.help && !lay.pads, lay);

// hints follow the device
const hints = await ev(() => { const a = MV_INPUT.dev, kb = MV_INPUT.fmt('{item} {jump} {pause}'); MV_INPUT.dev = 'pad'; const pad = MV_INPUT.fmt('{item} {jump} {pause}'); MV_INPUT.dev = 'kb'; return { a, kb, pad }; });
check('hints: keyboard Q/SPACE/ESC, pad X/A/START', hints.a === 'kb' && hints.kb === 'Q SPACE ESC' && hints.pad === 'X A START', hints);

// item window closes on any key
await ev(() => MV_BETA.openPopup(2)); await pg.waitForTimeout(1000);
await key('KeyD', 200);
check('item window closes on any key', await ev(() => !MV_BETA.popup), null);

// hurt music slows the stage theme
const rate = await ev(() => { _healFrac = 0.6; updateGameBgm(); const r = MV_BETA_AUDIO.els[MV_BETA_AUDIO.current()]?.playbackRate; _healFrac = 1; updateGameBgm(); return { r, back: MV_BETA_AUDIO.els[MV_BETA_AUDIO.current()]?.playbackRate, cur: MV_BETA_AUDIO.current() }; });
check('hit slows the music, healing restores it', Math.abs(rate.r - 0.6) < 0.01 && rate.back === 1, rate);

// clearing 1.1 saves a journey pointing at 1.2
const sv = await ev(() => { MV_BETA.cleared = true; MV_BETA.openResults(); const s = MV_SLOTS.slots()[0]; MV_BETA.results = null; return s && { stage: s.stage, ts: !!s.ts }; });
check('clearing 1.1 saves journey 1 at AWDJOO 1.2', sv && sv.stage === '1.2' && sv.ts, sv);
await pg.waitForTimeout(200);
await key('Escape'); await expect('Esc pauses', s => s.gs === 'game' && s.paused); await shot('3-pause');
await key('Escape'); await expect('Esc resumes', s => s.gs === 'game' && !s.paused);
await key('Escape'); await key('ArrowDown'); await key('Enter'); await expect('pause > OPTIONS', s => s.gs === 'options');
await key('Escape'); await expect('options back to paused stage', s => s.gs === 'game' && s.paused);
await key('ArrowUp'); await key('Enter'); await expect('RESUME GAME', s => s.gs === 'game' && !s.paused);
await key('Escape'); await key('ArrowDown'); await key('ArrowDown'); await key('Enter');
await expect('EXIT back to main menu', s => s.gs === 'title');

// with a save, STORY MODE opens the journeys screen
await key('Enter', 200); await expect('STORY MODE opens JOURNEYS', s => s.gs === 'slots'); await shot('5-journeys');
const slotsNow = () => ev(() => MV_SLOTS.slots().map(s => s && s.stage));
for (let i = 0; i < 5; i++) await key('ArrowDown');
await key('ArrowRight'); await key('Enter'); await key('Enter');        // COPY → journey 1
await key('ArrowUp'); await key('Enter'); await key('ArrowDown'); await key('Enter');   // PASTE → slot 2
let sl = await slotsNow(); check('COPY + PASTE journey 1 into slot 2', sl[0] === '1.2' && sl[1] === '1.2', sl);
await shot('6-journeys-pasted');
for (let i = 0; i < 4; i++) await key('ArrowDown');
await key('ArrowLeft'); await key('ArrowLeft'); await key('Enter');      // DELETE
await key('ArrowDown'); await key('Enter'); await key('ArrowRight'); await key('Enter');   // slot 2 → YES
sl = await slotsNow(); check('DELETE slot 2', sl[0] === '1.2' && !sl[1], sl);
await key('ArrowUp'); await key('Enter', 200);                            // journey 1 → load
await pg.waitForFunction(() => window.MV_BETA && MV_BETA.on && MV_BETA.stageId === '1.2' && _gameState === 'game', null, { timeout: 12000 }).catch(() => {});
await pg.waitForTimeout(800);
await expect('journey 1 continues in 1.2', s => s.gs === 'game' && s.stage === '1.2');
const kit = await ev(() => _unlockedMask); check('journey keeps the jacks', kit === (await ev(() => MV_SLOTS.slots()[0].mask)), kit);

// game over: RETRY STAGE restarts with full lives, MAIN MENU goes to the title
await ev(() => { _gameOver = true; _shutdownTimer = 0; }); await pg.waitForTimeout(200); await shot('7-game-over');
await key('Enter', 200);
await pg.waitForFunction(() => !_gameOver && MV_BETA.on, null, { timeout: 8000 }).catch(() => {});
check('game over > RETRY STAGE', await ev(() => !_gameOver && _gameState === 'game' && MV_BETA.stageId === '1.2'), null);
await pg.waitForTimeout(600);
await ev(() => { _gameOver = true; _shutdownTimer = 0; }); await pg.waitForTimeout(200);
await key('ArrowDown'); await key('Enter', 200);
await expect('game over > MAIN MENU', s => s.gs === 'title');
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
