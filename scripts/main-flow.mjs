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
for (const [i, n] of [[0, 'splash-mmr'], [1, 'splash-pv']]) {
  await pg.waitForFunction(i => MV_SPLASH.idx() === i && MV_SPLASH.t() >= MV_SPLASH.IN + 10, i, { timeout: 10000 }).catch(() => {});
  await shot(n);
}
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

// ── water play: MAG holds water, XLR blows air, the Isolator bubble, rope sweep ──
await pg.goto(`http://127.0.0.1:${PORT}/index.html?lvl=1.2`, { waitUntil: 'load' });
await pg.waitForFunction(() => window.MV_BETA && MV_BETA.on && _gameState === 'game' && MV_BETA.waters && MV_BETA.waters.length, null, { timeout: 15000 }).catch(() => {});
const frames = n => pg.evaluate(n => new Promise(r => { const f0 = fr; const t = () => (fr - f0 >= n ? r() : requestAnimationFrame(t)); t(); }), n);
const wsetup = await ev(() => {
  const B = MV_BETA; B.popup = null;
  if (!B.waters.length) return { pools: 0, stage: B.stageId, gs: _gameState };
  const w = B.waters.slice().sort((a, b) => (b.x1 - b.x0) * (b.r1 - b.r0) - (a.x1 - a.x0) * (a.r1 - a.r0))[0];
  const pt = { x: (w.x0 + w.x1) / 2, y: Math.min(w.base + 70, (w.r1 + 1) * 32 - 20) };
  window.__pt = pt; window.__w = w; window.__fire = false;
  window._itemFireDown = () => window.__fire;
  B.magTip = () => ({ x: __pt.x, y: __pt.y, ux: 0, uy: -1 });
  const ctw = window.connectorTipWorld; window.connectorTipWorld = i => (i === 2 ? { x: __pt.x, y: __pt.y } : ctw(i));
  _unlockedMask = 0xff; ITEM = 3; p.itemStamina = 100;
  return { pools: B.waters.length, pt, inWater: !!B.W.waterAtRaw(pt.x, pt.y), v0: B.waterVolume() };
});
check('water lab: a pool to play in', wsetup.pools > 0 && wsetup.inWater, wsetup);
const BLK = 1024;
await ev(() => { window.__fire = true; }); await frames(60);
const mag = await ev(() => ({ A: MV_BETA.wplay.blob && MV_BETA.wplay.blob.A, v: MV_BETA.waterVolume(), base: __w.baseRest }));
await shot('8-mag-water');
check('MAG hold grows to ~9 blocks of water', mag.A >= 7 * BLK && mag.A <= 9 * BLK + 1, mag);
check('water volume conserved while held', Math.abs(mag.v - wsetup.v0) < 2, { v0: wsetup.v0, v: mag.v });
await ev(() => { MV_BETA.mag.power = 30; }); await frames(40);
const drip = await ev(() => ({ A: MV_BETA.wplay.blob && MV_BETA.wplay.blob.A, drops: MV_BETA.wplay.drops.length, v: MV_BETA.waterVolume() }));
check('losing power drips water off (30% = ~2.7 blocks)', drip.A <= 3.2 * BLK && drip.A > 0, drip);
await ev(() => { MV_BETA.mag.power = 0; p.itemStamina = 0; }); await frames(5);
check('0% power releases all the water', await ev(() => !MV_BETA.wplay.blob), null);
await ev(() => { window.__fire = false; p.itemStamina = 100; }); await frames(120);
const back = await ev(() => ({ v: MV_BETA.waterVolume(), drops: MV_BETA.wplay.drops.length }));
check('released water goes back (volume conserved)', back.drops === 0 && Math.abs(back.v - wsetup.v0) < 2, { v0: wsetup.v0, ...back });

const zap = await ev(() => {
  const e = ENEMS.find(e => e.alive && !e.mind); if (!e) return null;
  e._shorted = false; MV_BETA.wplay.drops.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vx: 0, vy: 0, A: 1024, t: 5 });
  return true;
});
if (zap) { await frames(2); check('thrown water shorts an enemy', await ev(() => ENEMS.some(e => e._shorted)), null); }

await ev(() => {
  ITEM = 2; MV_BETA.isoOwned = true; MV_BETA.hasIsolator = true; p.x = __pt.x - 150; p.y = __pt.y - FEET_OFF + 20; p.vx = 0; p.vy = 0;
  window.__snap = {}; const tick = MV_BETA.waterPlayTick;
  MV_BETA.waterPlayTick = function () { const r = tick.apply(this, arguments); const a = MV_BETA.wplay.air;   // snapshots on game ticks, not render frames
    if (a && (a.hold === 12 || a.hold === 60) && !__snap[a.hold]) __snap[a.hold] = { amp: Math.max(...__w.h.map(Math.abs)), rings: MV_BETA.wplay.rings.length, A: a.A, r: Math.sqrt(a.A / Math.PI), dry: !MV_BETA.W.waterAt(__pt.x, __pt.y), rise: __w.baseRest - __w.base, st: p.itemStamina | 0,
      puddles: MV_BETA.waters.filter(w => w.dyn && w.home === __w).length, drops: MV_BETA.wplay.drops.filter(d => d.home === __w).length, pending: __w._spill || 0 };
    return r; };
  window.__fire = true; p.itemStamina = 100;
});
const holdTo = n => pg.waitForFunction(n => !!window.__snap[n], n, { timeout: 30000 }).catch(() => {});
await holdTo(12);
const wave = await ev(() => __snap[12] || {});
check('XLR push heaves the whole surface + pressure rings', wave.amp > 6 && wave.rings > 0, wave);
await shot('9-xlr-push');
await holdTo(60);
const xlr = await ev(() => __snap[60] || null);
check('pushed water over the rim pours out of the pool', xlr && (xlr.puddles + xlr.drops > 0 || xlr.pending > 0), xlr);
await shot('9-xlr-air');
check('XLR hold blows a big air pocket (power-capped), dry inside', xlr && xlr.A >= 6.5 * BLK && xlr.dry, xlr);
check('the pocket pushes the water level up', xlr && xlr.rise > 4, xlr);
await ev(() => { window.__fire = false; }); await frames(240);
check('released air rises and pops', await ev(() => !MV_BETA.wplay.air && MV_BETA.wplay.rising.length === 0 && Math.abs(__w.base - __w.baseRest) < 0.5), null);
await frames(200);
const home = await ev(() => ({ puddles: MV_BETA.waters.filter(w => w.dyn).length, drops: MV_BETA.wplay.drops.length, v: MV_BETA.waterVolume() }));
check('spilled water runs back once the bubble is gone (volume conserved)', home.puddles === 0 && home.drops === 0 && Math.abs(home.v - wsetup.v0) < 2, { v0: wsetup.v0, ...home });

await ev(() => { MV_BETA.isoOwned = true; MV_BETA.hasIsolator = true; p.x = __pt.x - SW / 2; p.y = __pt.y - FEET_OFF + 20; p.vx = 0; p.vy = 0; }); await frames(20);
await shot('10-isolator');

const rope = await ev(() => {
  const h = p.hook; ITEM = 1;
  p.x = _spawnX; p.y = _spawnY - 40; p.vx = 0; p.vy = 0;
  const a = ropePlayerEndWorld();
  for (let k = 0; k < 64; k++) {
    const an = -Math.PI * 2 * k / 64, ux = Math.cos(an), uy = Math.sin(an);
    const hit = gridRayHit(a.x, a.y, a.x + ux * 320, a.y + uy * 320);
    if (!hit) continue;
    const d = Math.hypot(hit.tx - a.x, hit.ty - a.y); if (d < 50 || d > 300) continue;
    const ex = hit.tx + ux * 30, ey = hit.ty + uy * 30;
    Object.assign(h, { st: 'ext', ex, ey, evx: 0, evy: 0 });
    p.vx = 0; p.vy = 0; const still = MV_BETA.ropeSweepLatch(h);
    p.vx = 3; const moving = MV_BETA.ropeSweepLatch(h);
    const near = Math.hypot(h.ax - hit.tx, h.ay - hit.ty) < 4;
    h.st = 'idle'; p.vx = 0;
    return { still, moving, near, d: Math.round(d) };
  }
  return null;
});
check('rope: moving throw latches on a surface it sweeps through', rope && !rope.still && rope.moving && rope.near, rope);

// ── PC widescreen: the picture takes the monitor's shape, all of it visible ──
for (const [vw, vh] of [[1600, 900], [1920, 940], [1280, 1000]]) {
  const pc = await b.newPage({ viewport: { width: vw, height: vh } });
  await pc.goto(`http://127.0.0.1:${PORT}/index.html?lvl=1.1`, { waitUntil: 'load' });
  await pc.waitForFunction(() => window.MV_BETA && MV_BETA.on, null, { timeout: 15000 }).catch(() => {});
  const r = await pc.evaluate(() => { const c = document.getElementById('c').getBoundingClientRect(); return { W, x: Math.round(c.left), y: Math.round(c.top), w: Math.round(c.width), h: Math.round(c.height), vw: innerWidth, vh: innerHeight }; });
  if (vw === 1600) await pc.waitForTimeout(3000), await pc.screenshot({ path: `${out}/12-pc-wide.png` });
  const fits = r.x >= 0 && r.y >= 0 && r.x + r.w <= r.vw + 1 && r.y + r.h <= r.vh + 1;
  const fills = Math.abs(r.w - r.vw) <= 2 || Math.abs(r.h - r.vh) <= 2;
  const shape = Math.abs(r.w / r.h - r.W / 768) < 0.02;
  check(`PC ${vw}x${vh}: whole picture visible, fills the window`, fits && fills && shape && (vw / vh > 1.4 ? r.W > 1024 : true), r);
  await pc.close();
}

// ── phone: wide picture fills the screen, CRT overlay, one thumb on X + A ──
const ph = await b.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
ph.on('pageerror', e => errs.push('phone: ' + String(e)));
await ph.goto(`http://127.0.0.1:${PORT}/index.html?lvl=1.1&phone=1`, { waitUntil: 'load' });
await ph.waitForFunction(() => window.MV_BETA && MV_BETA.on && _gameState === 'game', null, { timeout: 15000 }).catch(() => {});
await ph.evaluate(() => { MV_BETA.popup = null; if (window.MV_TV) MV_TV.on = true; });
await ph.waitForTimeout(3000);
await ph.screenshot({ path: `${out}/11-phone.png` });
const pl = await ph.evaluate(() => { const r = document.getElementById('c').getBoundingClientRect(); const crt = getComputedStyle(document.getElementById('phoneCrt')).display;
  return { W, cw: document.getElementById('c').width, x: r.left, y: r.top, w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight, crt }; });
check('phone: wide picture fills the screen (no side bars)', pl.W > 1024 && pl.cw === pl.W && pl.x <= 1 && Math.abs(pl.w - pl.vw) <= 2 && Math.abs(pl.h - pl.vh) <= 2, pl);
check('phone: CRT TV overlay is on', pl.crt === 'block', pl.crt);
const thumb = await ph.evaluate(() => {
  const c = id => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const X = c('bF'), A = c('bSp');
  const fire = (type, id, x, y, el) => { const t = new Touch({ identifier: id, target: el, clientX: x, clientY: y, radiusX: 12, radiusY: 12 });
    el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], changedTouches: [t] })); };
  const run = _phonePlay ? 'KeyQ' : 'KeyF';
  const bf = document.getElementById('bF'), bs = document.getElementById('bSp');
  fire('touchstart', 7, X.x, X.y, bf); const onX = { run: !!K[run], jump: !!K.Space };
  fire('touchmove', 7, (X.x + A.x) / 2, (X.y + A.y) / 2, bf); const roll = { run: !!K[run], jump: !!K.Space };
  fire('touchend', 7, (X.x + A.x) / 2, (X.y + A.y) / 2, bf); const up = { run: !!K[run], jump: !!K.Space };
  fire('touchstart', 8, X.x, X.y, bf); fire('touchstart', 9, A.x, A.y, bs); const two = { run: !!K[run], jump: !!K.Space };
  fire('touchend', 8, X.x, X.y, bf); fire('touchend', 9, A.x, A.y, bs);
  return { onX, roll, up, two };
});
check('phone: thumb on X runs only', thumb.onX.run && !thumb.onX.jump, thumb.onX);
check('phone: thumb rolled between X and A holds run AND jump', thumb.roll.run && thumb.roll.jump, thumb.roll);
check('phone: lifting the thumb lets both go', !thumb.up.run && !thumb.up.jump, thumb.up);
check('phone: two fingers press X and A together', thumb.two.run && thumb.two.jump, thumb.two);

const pass = steps.every(s => s[1] === 'ok') && errs.length === 0;
for (const [n, r, s] of steps) console.log((r === 'ok' ? '  ok   ' : '  FAIL ') + n + '  ' + JSON.stringify(s));
if (errs.length) console.log('page errors:', errs);
console.log(pass ? 'MAIN FLOW PASS' : 'MAIN FLOW FAIL');
await b.close(); srv.close();
process.exitCode = pass ? 0 : 1;
