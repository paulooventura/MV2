// MV2 authoritative server prototype.
// Runs the REAL game in headless Chromium as the single world authority.
// Clients send input bitmasks; the server drives the game and broadcasts
// full world snapshots. Local development build — no cloud, no credentials.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.MV_AUTH_PORT || 7794);
const GAME = process.env.MV_GAME_URL || 'http://127.0.0.1:8765/index.html?ci=1';
const TICK_MS = 50; // 20 Hz snapshots
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.mp3':'audio/mpeg','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
  if (rel === 'auth') return; // websocket upgrade
  const file = path.join(ROOT, rel.replace(/\.\./g, ''));
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'});
    res.end(data);
  } catch { res.writeHead(404); res.end('not found'); }
});
const wss = new WebSocketServer({ server, path: '/auth' });

const seats = new Map(); // ws -> {seat, mask, seq, ack}
let nextSeat = 0;
const broadcast = obj => {
  const s = JSON.stringify(obj);
  for (const ws of wss.clients) if (ws.readyState === 1) ws.send(s);
};
wss.on('connection', ws => {
  const seat = nextSeat++ % 2;
  seats.set(ws, { seat, mask: 0, seq: 0, ack: 0, prev: 0 });
  try { ws.send(JSON.stringify({ t:'seat', seat })); } catch {}
  console.log('client joined, seat', seat);
  ws.on('message', raw => {
    try {
      const p = JSON.parse(raw.toString());
      const c = seats.get(ws);
      if (!c || p.t !== 'input') return;
      c.mask = p.m | 0;
      c.seq = p.seq | 0;
      c.ack = p.ack | 0;
    } catch {}
  });
  ws.on('close', () => seats.delete(ws));
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
await page.goto(GAME, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.evaluate(() => window.startBetaLab('1.1', 0));
await page.waitForTimeout(2500);
// Authoritative second actor: the real game drives it with P2 input slots.
try {
  console.log('authority P2:', await page.evaluate(() => {
    if (typeof p2 === 'undefined' || !p2) p2 = mkP();
    p2.hero = 'venture'; p2._aiCompanion = false;
    p2.x = p.x + 40; p2.y = p.y; p2.vx = 0; p2.vy = 0; p2.og = true;
    window.MV_AUTH_HAS_P2 = true;
    // Keep the host's own player on the normal solo path; we drive P2 manually
    // from the authoritative tick instead of switching the whole game to 2P.
    return { p2: !!p2, count: _playerCount };
  }));
} catch (e) { console.log('authority P2 failed', String(e).slice(0, 160)); }
console.log('authority ready:', await page.evaluate(() => ({ game: _gameState, x: p.x, build: MV_BUILD })));

const ACTS = ['left','right','up','down','jump','use','swap','punch','sprint'];
// ACTS order: up, down, left, right, jump, use, swap, punch, sprint
const P1_KEYS = ['KeyW','KeyS','KeyA','KeyD','Space','KeyE','KeyQ','KeyF','ShiftLeft'];
const P2_KEYS = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Numpad0','NumpadEnter','Numpad2','Numpad3','Sprint_gp2'];
let tick = 0;

setInterval(async () => {
  if (page.isClosed()) return;
  const inputs = [...seats.values()].map(c => ({ seat: c.seat, mask: c.mask, seq: c.seq, ack: c.ack, prev: c.prev }));
  try {
    const snap = await page.evaluate(({ inputs, ACTS, P1_KEYS, P2_KEYS, TICK_MS }) => {
      // Drive the authority's real input state from client bitmasks.
      for (const it of inputs) {
        const keys = it.seat === 0 ? P1_KEYS : P2_KEYS;
        for (let i = 0; i < ACTS.length; i++) {
          const on = !!(it.mask & (1 << i));
          const key = keys[i];
          if (it.seat === 0) K[key] = on;
          else if (typeof K2 !== 'undefined') {
            K2[key] = on;
            if (on && !(it.prev & (1 << i))) Kj2[key] = true; // rising edge
          }
        }
      }
      // Drive the authoritative P2 through the game's own co-op input code.
      try { if (window.MV_AUTH_HAS_P2 && typeof updateCoopPlayer2 === 'function') updateCoopPlayer2(); } catch {}
      const r1 = n => Math.round((+n || 0) * 10) / 10;
      const pack = a => a ? [r1(a.x), r1(a.y), r1(a.vx), r1(a.vy), a.fc ? 1 : 0, Math.round(+a.hp || 0), String(a.hero || ''), a.item | 0, a.pt | 0, Math.round(a.crouchAmt * 100) / 100] : null;
      return {
        t: 'snap', tick: (window.__authTick = (window.__authTick || 0) + 1),
        p1: pack(typeof p !== 'undefined' ? p : null),
        p2: pack(typeof p2 !== 'undefined' ? p2 : null),
        enemies: typeof ENEMS !== 'undefined' ? ENEMS.slice(0, 32).map(e => e ? [r1(e.x), r1(e.y), Math.round(+e.hp || 0), e.off ? 1 : 0] : null) : [],
        doors: window.MV_DOORS && MV_DOORS.doors ? MV_DOORS.doors.map(d => [d.st, d.t | 0]) : [],
        stage: (window.MV_BETA && MV_BETA.stageId) || '', game: typeof _gameState !== 'undefined' ? _gameState : '',
        dbg: { count: typeof _playerCount !== 'undefined' ? _playerCount : -1, hasP2: !!window.MV_AUTH_HAS_P2 },
      };
    }, { inputs, ACTS, P1_KEYS, P2_KEYS, TICK_MS });
    snap.acks = inputs.map(i => i.seq);
    for (const c of seats.values()) c.prev = c.mask;
    broadcast(snap);
  } catch (e) {
    if (errors.length < 3) errors.push(String(e).slice(0, 160));
  }
}, TICK_MS);

server.listen(PORT, '127.0.0.1', () => console.log(`MV2 authority on http://127.0.0.1:${PORT} (ws /auth)`));
process.on('SIGINT', async () => { await browser.close(); server.close(); process.exit(0); });
