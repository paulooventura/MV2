#!/usr/bin/env node
// Online co-op probe: two separate muted browser profiles host + join a room
// through the real PeerJS broker, land in one stage, mirror heroes + enemies,
// follow a stage change, and talk over proximity voice (fake mic).
// Run: node scripts/probe-online.mjs [--shots]   (needs internet)
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PORT = 8812;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ldtk': 'application/json', '.webmanifest': 'application/manifest+json' };
const srv = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent((req.url || '/').split('?')[0]);
    if (path === '/') path = '/index.html';
    const f = join(ROOT, path.replace(/^\//, '').replace(/\.\./g, ''));
    const d = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(d);
  } catch { res.writeHead(404); res.end('x'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const SHOTS = process.argv.includes('--shots');
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
let fail = 0;
const ok = (name, pass, info) => { if (!pass) fail++; console.log((pass ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); };
const until = async (pg, fn, arg, ms = 30000) => { try { await pg.waitForFunction(fn, arg, { timeout: ms, polling: 200 }); return true; } catch { return false; } };

try {
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['microphone'] });
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['microphone'] });
  const A = await ctxA.newPage(), Bp = await ctxB.newPage();
  for (const [n, pg] of [['A', A], ['B', Bp]]) {
    pg.on('pageerror', e => console.log(n + ' PAGEERR', e.message));
    pg.on('console', m => { if (m.type() === 'error' || m.text().startsWith('TRACE')) console.log(n + ' console.error', m.text().slice(0, 200)); });
  }
  await A.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  ok('host boots to title', await until(A, () => typeof _gameState !== 'undefined' && _gameState === 'title' && !!window.MV_NET && !!window.MV_NET_UI, null, 60000));

  // Host: title -> mode select -> 2P ONLINE -> HOST A ROOM
  await A.evaluate(() => { _gameState = 'select'; _selectStep = 0; _playModeIdx = 3; startGame(); });
  ok('2P ONLINE opens the room panel', await A.evaluate(() => MV_NET_UI.isOpen()));
  await A.click('#mvNetHostBtn');
  ok('host gets a room code', await until(A, () => /^[A-Z]{4}$/.test(MV_NET.code()) && MV_NET.status().status === 'hosting', null, 20000));
  const code = await A.evaluate(() => MV_NET.code());
  const link = await A.evaluate(() => document.getElementById('mvNetLink').textContent);
  ok('join link shown', link.endsWith('?join=' + code), link);
  if (SHOTS) await A.screenshot({ path: 'test-results/online-host-code.png' });

  // Joiner: open the link, press JOIN
  await Bp.goto(`http://127.0.0.1:${PORT}/index.html?join=${code}`, { waitUntil: 'domcontentloaded' });
  ok('join link opens the join screen with the code', await until(Bp, c => window.MV_NET_UI && MV_NET_UI.isOpen() && MV_NET_UI.view() === 'join' && document.getElementById('mvNetCode').value === c, code, 60000),
    await Bp.evaluate(() => ({ gs: typeof _gameState !== 'undefined' ? _gameState : null, ui: !!window.MV_NET_UI, open: window.MV_NET_UI && MV_NET_UI.isOpen(), view: window.MV_NET_UI && MV_NET_UI.view(), code: (document.getElementById('mvNetCode') || {}).value })));
  if (process.argv.includes('--trace')) await Bp.evaluate(() => { const d = MV_NET.disconnect; MV_NET.disconnect = function () { console.log('TRACE disconnect ' + new Error().stack.split(String.fromCharCode(10)).slice(1, 5).join(' | ')); return d.apply(this, arguments); }; const j = MV_NET.join; MV_NET.join = function (c) { console.log('TRACE join ' + c); return j.apply(this, arguments); }; });
  await Bp.click('#mvNetGo');
  if (process.argv.includes('--trace')) console.log('after click', JSON.stringify(await Bp.evaluate(() => MV_NET.status())));
  if (process.argv.includes('--debug')) console.log('dbg click', await Bp.evaluate(() => { const r = {}; try { r.go = !!document.getElementById('mvNetGo'); r.code = document.getElementById('mvNetCode').value; r.peer = typeof Peer; r.st = MV_NET.status(); } catch (e) { r.err = e.message; } return r; }));
  if (process.argv.includes('--debug')) for (let i = 0; i < 4; i++) { await Bp.waitForTimeout(1000); console.log('dbg', JSON.stringify(await A.evaluate(() => MV_NET.status())), JSON.stringify(await Bp.evaluate(() => MV_NET.status()))); }
  ok('both linked', await until(Bp, () => MV_NET.isLinked(), null, 25000) && await until(A, () => MV_NET.isLinked(), null, 5000),
    { A: await A.evaluate(() => MV_NET.status()), B: await Bp.evaluate(() => MV_NET.status()) });
  ok('host moves on to hero select', await until(A, () => !MV_NET_UI.isOpen() && _gameState === 'select' && _selectStep === 1, null, 5000));
  if (SHOTS) await Bp.screenshot({ path: 'test-results/online-join-wait.png' });

  // Host picks MIND and starts
  await A.evaluate(() => { _heroChoice = 'mind'; startGame(); });
  ok('host in stage 1.1', await until(A, () => _gameState === 'game' && MV_BETA.stageId === '1.1' && !MV_BETA.loading && p, null, 40000));
  ok('joiner follows into 1.1 as VENTURE', await until(Bp, () => _gameState === 'game' && MV_BETA.stageId === '1.1' && !MV_BETA.loading && p && p.hero === 'venture', null, 40000),
    await Bp.evaluate(() => ({ gs: _gameState, st: MV_BETA.stageId, hero: p && p.hero })));
  ok('each sees the other as a puppet', await until(A, () => p2 && p2._netPuppet && p2.hero === 'venture', null, 8000) && await until(Bp, () => p2 && p2._netPuppet && p2.hero === 'mind', null, 8000));
  ok('online keeps a solo camera (playerCount 1)', await A.evaluate(() => _playerCount) === 1 && await Bp.evaluate(() => _playerCount) === 1);

  // Hero mirroring: move the host, the joiner's puppet follows
  const hx = await A.evaluate(() => { p.x += 240; return p.x; });
  // the host's physics may nudge the hero after the teleport: compare with where it really is
  let seen = false, hx2 = hx, bx2 = null;
  for (let i = 0; i < 20 && !seen; i++) { await A.waitForTimeout(200); hx2 = await A.evaluate(() => p.x); bx2 = await Bp.evaluate(() => p2 && p2.x); seen = bx2 != null && Math.abs(bx2 - hx2) < 60 && Math.abs(hx2 - (hx - 240)) > 100; }
  ok('joiner sees host move', seen, { hx, hx2: Math.round(hx2), bx2: bx2 && Math.round(bx2) });
  const bx = await Bp.evaluate(() => { p.x = Math.max(40, p.x - 120); return p.x; });
  ok('host sees joiner move', await until(A, x => p2 && Math.abs(p2.x - x) < 40, bx, 4000));

  // Enemies: joiner hits an enemy the host owns -> host applies it
  await A.waitForTimeout(600);
  const en = await A.evaluate(() => ({ n: ENEMS.length, base: MV_NET.base(), own: MV_NET.owners() }));
  ok('host tracks stage enemies', en.base > 0, en);
  // whichever side does NOT own an enemy hits it; the owner must apply it
  const tg = await A.evaluate(() => { const o = MV_NET.owners(); for (let i = 0; i < ENEMS.length && i < MV_NET.base(); i++) if (ENEMS[i].alive && ENEMS[i].type !== 'signol') return { i, owner: o[i] || '0' }; return null; });
  if (tg) {
    const [hitter, owner] = tg.owner === '1' ? [A, Bp] : [Bp, A];
    const r = await hitter.evaluate(i => { const e = ENEMS[i]; const h0 = e.hp; _damageEnemy(e, 9999, e.x, e.y); return { h0, h1: e.hp }; }, tg.i);
    ok('a hit on an enemy the other side owns is forwarded, not applied locally', r.h1 === r.h0, { ...r, ...tg });
    ok('the owner applies the forwarded hit', await until(owner, i => !ENEMS[i].alive, tg.i, 6000));
    ok('the hitter mirrors the shutdown', await until(hitter, i => !ENEMS[i].alive, tg.i, 6000));
  } else ok('found a live enemy', false, en);

  // Ownership: send the joiner's hero right onto an enemy far from the host
  const own = await A.evaluate(() => {
    let best = -1, bd = 0;
    for (let i = 0; i < MV_NET.base(); i++) { const e = ENEMS[i]; if (!e || !e.alive) continue; const d = Math.abs(e.x - p.x); if (d > bd) { bd = d; best = i; } }
    return { best, bd: Math.round(bd) };
  });
  if (own.best >= 0 && own.bd > 400) {
    await Bp.evaluate(i => { const e = ENEMS[i]; p.x = e.x; p.y = e.y; }, own.best);
    ok('enemy near the joiner becomes joiner-owned', await until(A, i => MV_NET.owners()[i] === '1', own.best, 5000), own);
  } else console.log('skip ownership swap (enemies too close to the host)', own);

  // Proximity voice: both turn on OPEN MIC
  for (const pg of [A, Bp]) await pg.evaluate(() => MV_VOICE.setMode('open'));
  ok('host sends + hears (voice calls up)', await until(A, () => MV_VOICE.state().hearing && MV_VOICE.state().sending, null, 15000), await A.evaluate(() => MV_VOICE.state()));
  ok('joiner sends + hears', await until(Bp, () => MV_VOICE.state().hearing && MV_VOICE.state().sending, null, 15000), await Bp.evaluate(() => MV_VOICE.state()));
  const s0 = await A.evaluate(() => MV_VOICE.stats()); await A.waitForTimeout(2500); const s1 = await A.evaluate(() => MV_VOICE.stats());
  ok('voice audio flows both ways (RTP bytes)', s1.rx > s0.rx && s1.tx > s0.tx, { s0, s1 });
  // close -> loud, far -> silent
  await Bp.evaluate(() => { if (p2) { p.y = p2.y; p.x = p2.x + 60; } });
  await until(A, () => MV_VOICE.gain() > 0.85, null, 6000);
  const gNear = await A.evaluate(() => MV_VOICE.gain());
  const far = await Bp.evaluate(() => { if (p2) { p.x = p2.x > WW / 2 ? 0 : WW - 80; p.y = p2.y - 600 > 0 ? p2.y - 600 : p2.y; } return Math.round(Math.hypot(p.x - p2.x, p.y - p2.y)); });
  await until(A, () => MV_VOICE.gain() < 0.05, null, 6000);
  const gFar = await A.evaluate(() => MV_VOICE.gain());
  ok('voice is loud up close and silent far away', gNear > 0.85 && gFar < 0.05, { gNear, gFar, far });
  await A.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', key: 't' })));
  ok('T mutes the open mic', await A.evaluate(() => MV_VOICE.muted() && !MV_VOICE.talking()));
  await A.evaluate(() => MV_VOICE.setMode('ptt'));
  await A.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', key: 't' })));
  const pttDown = await A.evaluate(() => MV_VOICE.talking());
  await A.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyT', key: 't' })));
  const pttUp = await A.evaluate(() => MV_VOICE.talking());
  ok('push-to-talk talks only while T is held', pttDown && !pttUp, { pttDown, pttUp });
  ok('online chip shows in stage', await A.evaluate(() => getComputedStyle(document.getElementById('mvNetChip')).display !== 'none'));
  if (SHOTS) { await A.screenshot({ path: 'test-results/online-host-stage.png' }); await Bp.screenshot({ path: 'test-results/online-join-stage.png' }); }
  await A.evaluate(() => MV_VOICE.setMode('off'));
  ok('voice OFF stops my mic and my speakers', await A.evaluate(() => !MV_VOICE.state().sending && MV_VOICE.gain() === 0));

  // Stage change follows
  await A.evaluate(() => startBetaLab('1.2', 15));
  ok('joiner follows the host into 1.2', await until(Bp, () => MV_BETA.stageId === '1.2' && !MV_BETA.loading, null, 40000));
  ok('puppets come back in 1.2', await until(A, () => p2 && p2._netPuppet, null, 10000) && await until(Bp, () => p2 && p2._netPuppet, null, 10000));

  // Leaving
  console.log('note: link', JSON.stringify(await A.evaluate(() => { const s = MV_NET.status(); return { ping: s.ping, buffered: s.buffered }; })));
  await Bp.evaluate(() => MV_NET.disconnect());
  ok('host notices the friend left and keeps the room open', await until(A, () => !MV_NET.isLinked() && MV_NET.status().status === 'hosting' && !(p2 && p2._netPuppet), null, 10000));
} catch (e) { console.log('PROBE ERROR', e.message); fail++; }
await browser.close(); srv.close();
console.log(fail ? `\nONLINE PROBE: ${fail} FAIL` : '\nONLINE PROBE: ALL PASS');
process.exit(fail ? 1 : 0);
