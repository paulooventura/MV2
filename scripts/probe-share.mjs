#!/usr/bin/env node
/**
 * A+B share probes (T151) — headless, on the LIVE build (index.html → claude/), WITH SIBLING on.
 *
 *   sibTakes    — MIND drops the TRS with A+B; the sibling touches it and carries it (not MIND's set)
 *   sibGives    — A+B with no jack in MIND's hand: the sibling drops it; MIND touches it and has it
 *   swapGives   — the sibling carries a jack; swapping brothers puts it in the new lead's set
 *   knifeStays  — A+B with the kiritsuke does nothing
 *   foeTakes    — an enemy touching a shared drop still takes it (T132)
 *
 * Exit 0 = all PASS. Usage: node scripts/probe-share.mjs [--lvl=1.2]
 */
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const arg = (k) => { const a = process.argv.find((s) => s.startsWith('--' + k + '=')); return a ? a.split('=')[1] : null; };
const LVL = arg('lvl') || '1.2';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.ldtk': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };

function startServer() {
  return new Promise((resolve) => {
    const srv = createServer(async (req, res) => {
      try {
        let path = decodeURIComponent((req.url || '/').split('?')[0]); if (path === '/') path = '/index.html';
        const data = await readFile(join(ROOT, path.replace(/^\//, '').replace(/\.\./g, '')));
        res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
      } catch { res.writeHead(404); res.end('nope'); }
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

const browser = await chromium.launch({ headless: true });
const { srv, port } = await startServer();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.route(/\.(mp3|ogg|m4a)(\?|$)/, (r) => r.fulfill({ status: 404, body: '' }));
await page.goto(`http://127.0.0.1:${port}/index.html?ci=1&tv=0&_=${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof startBetaLab === 'function' && window.MV_KNIFE && window.MV_SIBLING, null, { timeout: 30000 });
await page.evaluate(async (id) => { MV_SIBLING.on = true; _playerCount = 1; await startBetaLab(id, 15, { fresh: true }); }, LVL);
await page.waitForFunction((id) => MV_BETA.on && MV_BETA.stageId === id && !MV_BETA.loading && _gameState === 'game' && MV_GRID.ready && p, LVL, { timeout: 30000 });
await page.waitForTimeout(400);

const res = await page.evaluate(() => {
  const B = MV_BETA, out = {};
  _loopAccT = -1e15;
  const realHit = window.applyPlayerHit;
  window.applyPlayerHit = function () {};
  const clearKeys = () => { for (const k of Object.keys(K)) K[k] = false; for (const k of Object.keys(Kj)) delete Kj[k]; };
  const safe = () => { p.hp = 100; p.inv = 9999; B.popup = null; B.freeze = 0; B.trans = null; B.contScreen = null; B.overT = 0; _shutdownTimer = 0; };
  const step = (n, cb) => { for (let i = 0; i < n; i++) { safe(); if (cb && cb(i) === false) return i; update(); } return n; };
  const parked = ENEMS.splice(0);
  const grant = (i) => { _unlockedMask |= ITEM_UNLOCK_BITS[i]; ITEM = i; };
  const sib = () => MV_SIBLING.state();
  const hbCentre = (b) => { const h = playerCoreHB(b); return { x: h.x + h.w / 2, y: h.y + h.h / 2 }; };
  const glue = (d, b) => { const c = hbCentre(b); d.x = c.x - d.w / 2; d.y = c.y - d.h / 2; d.vx = 0; d.vy = 0; };
  const newShared = (n0) => ITEM_DROPS.slice(n0).find((d) => d._shared);
  clearKeys(); step(60);
  if (!sib()) return { boot: { pass: false, why: 'no sibling' } };

  // ── sibling takes MIND's drop ──
  let d1 = null;
  {
    grant(0); grant(2); ITEM = 0;
    const n0 = ITEM_DROPS.length;
    MV_KNIFE.drop();
    d1 = newShared(n0);
    const lost = !_itemUnlocked(0);
    let took = false;
    step(100, () => { if (sib()._carry === 0) { took = true; return false; } glue(d1, sib()); });   // through the toss, then the touch
    out.sibTakes = { pass: !!d1 && lost && took && !_itemUnlocked(0) && MV_KNIFE.state().sibCarry === 0, drop: !!d1, lost, took, mindHasTrs: _itemUnlocked(0), carry: sib()._carry,
      dist: Math.round(Math.hypot(hbCentre(p).x - hbCentre(sib()).x, hbCentre(p).y - hbCentre(sib()).y)) };
  }

  // ── A+B with nothing droppable: the sibling hands it back ──
  {
    _unlockedMask &= ~ITEM_UNLOCK_BITS[2]; ITEM = -1;
    const n0 = ITEM_DROPS.length;
    MV_KNIFE.drop();
    const d2 = newShared(n0);
    const handed = !!d2 && d2.item === 0 && sib()._carry == null;
    let back = false, sibRetook = false;
    if (d2) step(100, () => { if (_itemUnlocked(0)) { back = true; return false; } if (sib()._carry != null) sibRetook = true; glue(d2, p); });
    out.sibGives = { pass: handed && back && !sibRetook && ITEM === 0, handed, back, sibRetook, item: ITEM };
  }

  // ── swap: the carried jack lands in the new lead's set ──
  {
    grant(0); grant(2); ITEM = 0;
    const n0 = ITEM_DROPS.length;
    MV_KNIFE.drop(); const d = newShared(n0);
    step(100, () => { if (sib()._carry === 0) return false; glue(d, sib()); });
    const carried = sib()._carry === 0, oldLead = p, carrier = sib();
    carrier.x = p.x + 40; carrier.y = p.y;
    let swapped = false;
    for (let i = 0; i < 4 && !swapped; i++) swapped = MV_BROTHER_SWAP.tap();
    step(2);
    out.swapGives = { pass: carried && swapped && p === carrier && _itemUnlocked(0) && carrier._carry == null && MV_KNIFE.state().sibCarry == null,
      carried, swapped, nowLead: p === carrier, hasTrs: _itemUnlocked(0), item: ITEM };
  }

  // ── the knife stays ──
  {
    grant(4); ITEM = 4;
    const n0 = ITEM_DROPS.length;
    MV_KNIFE.drop();
    out.knifeStays = { pass: !newShared(n0) && _itemUnlocked(4) && ITEM === 4, dropped: !!newShared(n0), item: ITEM };
  }

  // ── an enemy still takes a shared drop ──
  {
    ENEMS.push(...parked);
    const e = ENEMS.find((q) => q.alive && ['circle', 'tri', 'square'].includes(q._ai));
    if (!e) out.foeTakes = { pass: false, why: 'no story enemy' };
    else {
      for (const q of ENEMS) if (q !== e) q._hidden = true;
      grant(0); ITEM = 0;
      const n0 = ITEM_DROPS.length;
      MV_KNIFE.drop(); const d = newShared(n0);
      const s = sib(); s.x = e.x + 600; s.y = e.y - 400;
      step(40, () => { d.x = e.x + e.w / 2 - d.w / 2; d.y = e.y + e.h / 2 - d.h / 2; const s2 = sib(); if (s2) { s2.x = e.x + 600; s2.y = e.y - 400; } });
      let took = false;
      step(60, () => { if (e._jack === 0) { took = true; return false; } d.x = e.x + e.w / 2 - d.w / 2; d.y = e.y + e.h / 2 - d.h / 2; const s2 = sib(); if (s2) { s2.x = e.x + 600; s2.y = e.y - 400; } });
      out.foeTakes = { pass: took, took, ai: e._ai, sibCarry: MV_KNIFE.state().sibCarry };
    }
  }
  window.applyPlayerHit = realHit;
  return out;
});

let ok = true;
for (const [k, v] of Object.entries(res)) { console.log((v.pass ? 'PASS ' : 'FAIL ') + k.padEnd(12) + JSON.stringify(v)); if (!v.pass) ok = false; }
if (errors.length) { console.log('page errors:', errors.slice(0, 5)); ok = false; }
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
