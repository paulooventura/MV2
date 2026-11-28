#!/usr/bin/env node
// Online frame-time probe (muted): host + guest in two browser profiles, through the
// real PeerJS broker, both heroes running back and forth in stage 1.1 with open-mic
// voice on. Prints per-side frame times (rAF deltas) and the time the online path
// costs per frame: MV_NET.tick + applyVisual + drawExtras, plus the DataConnection
// 'data' handlers (receiving + applying packets). A solo baseline runs first.
// Run: node scripts/probe-online-perf.mjs [--secs 12] [--json]   (needs internet)
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PORT = 8814;
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SECS = +arg('--secs', 12);
const OVERLAY = arg('--overlay', '');   // dir whose files override the repo (e.g. HEAD copies for a before run)
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ldtk': 'application/json', '.webmanifest': 'application/manifest+json' };
const srv = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent((req.url || '/').split('?')[0]); if (path === '/') path = '/index.html';
    const f = join(ROOT, path.replace(/^\//, '').replace(/\.\./g, ''));
    let d; try { if (!OVERLAY) throw 0; d = await readFile(join(OVERLAY, path.replace(/^\//, '').replace(/\.\./g, ''))); } catch { d = await readFile(f); }
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d);
  } catch { res.writeHead(404); res.end('x'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, args: [...(process.argv.includes('--soft') ? [] : ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader']), '--mute-audio', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const until = async (pg, fn, a, ms = 30000) => { try { await pg.waitForFunction(fn, a, { timeout: ms, polling: 200 }); return true; } catch { return false; } };

// in-page meter: rAF deltas + time inside the online hooks
const METER = () => {
  const M = window.__perf = { d: [], net: [], rxMs: 0, rxN: 0, hookMs: 0, on: false, by: {}, tx: {} };
  const by = (k, ms) => { const b = M.by[k] || (M.by[k] = { n: 0, ms: 0, max: 0 }); b.n++; b.ms += ms; if (ms > b.max) b.max = ms; };
  const wrap = (o, k) => { const f = o[k]; if (typeof f !== 'function' || f.__w) return; const g = function () { const t = performance.now(); try { return f.apply(this, arguments); } finally { const ms = performance.now() - t; M.hookMs += ms; if (M.on) by(k, ms); } }; g.__w = 1; o[k] = g; };
  if (window.MV_NET) ['tick', 'applyVisual', 'drawExtras'].forEach(k => wrap(MV_NET, k));
  if (window.MV_VOICE) ['draw'].forEach(k => wrap(MV_VOICE, k));
  const hookConns = () => {
    try {
      const pr = MV_NET.peer && MV_NET.peer(); if (!pr || !pr.connections) return;
      Object.values(pr.connections).forEach(list => list.forEach(c => {
        if (c.__w || typeof c.emit !== 'function') return; c.__w = 1; const e = c.emit;
        c.emit = function (ev) { if (ev !== 'data') return e.apply(this, arguments); const t = performance.now(); try { return e.apply(this, arguments); } finally { const ms = performance.now() - t; M.rxMs += ms; M.rxN++; if (M.on) by('rx', ms); } };
        const sd = c.send; c.send = function (o) { if (M.on) { const k = (o && o.t) || '?'; const b = M.tx[k] || (M.tx[k] = { n: 0, bytes: 0 }); b.n++; try { b.bytes += JSON.stringify(o).length; } catch (e) {} } return sd.apply(this, arguments); };
      }));
    } catch (e) {}
  };
  setInterval(hookConns, 500); hookConns();
  let last = 0, lastHook = 0, lastRx = 0;
  const loop = t => {
    if (M.on && last) { M.d.push(t - last); M.net.push((M.hookMs - lastHook) + (M.rxMs - lastRx)); }
    last = t; lastHook = M.hookMs; lastRx = M.rxMs; requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
};
const START = () => { const M = window.__perf; M.d.length = 0; M.net.length = 0; M.rxN = 0; M.rxMs = 0; M.hookMs = 0; M.by = {}; M.tx = {}; M.on = true; M.t0 = performance.now(); };
const STOP = () => {
  const M = window.__perf; M.on = false;
  const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2) : 0; };
  const secs = (performance.now() - M.t0) / 1000, d = M.d, n = M.net;
  const avg = a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3) : 0;
  return { frames: d.length, fps: +(d.length / secs).toFixed(1), p50: q(d, .5), p95: q(d, .95), p99: q(d, .99), max: q(d, 1), over20: d.filter(x => x > 20).length, over33: d.filter(x => x > 33.4).length,
    netAvg: avg(n), netP99: q(n, .99), netMax: q(n, 1), rxPerSec: +(M.rxN / secs).toFixed(1), rxAvgMs: M.rxN ? +(M.rxMs / M.rxN).toFixed(3) : 0,
    by: Object.fromEntries(Object.entries(M.by).map(([k, b]) => [k, { perSec: +(b.n / secs).toFixed(1), avg: +(b.ms / b.n).toFixed(3), max: +b.max.toFixed(2) }])),
    tx: Object.fromEntries(Object.entries(M.tx).map(([k, b]) => [k, { perSec: +(b.n / secs).toFixed(1), avgBytes: Math.round(b.bytes / b.n), kBps: +(b.bytes / secs / 1024).toFixed(1) }])) };
};
// both heroes run back and forth, jump now and then (keys via page.keyboard)
async function drive(pg, ms, seed) {
  const t0 = Date.now(); let dir = seed % 2 ? 'ArrowRight' : 'ArrowLeft';
  while (Date.now() - t0 < ms) {
    await pg.keyboard.down(dir); await pg.waitForTimeout(700);
    await pg.keyboard.press('Space'); await pg.waitForTimeout(500);
    await pg.keyboard.up(dir); dir = dir === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight';
  }
}
const out = {};
try {
  const mk = async () => { const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['microphone'] }); const pg = await c.newPage(); pg.on('pageerror', e => console.log('PAGEERR', e.message)); return pg; };
  // solo baseline: two solo pages at once (the online run also has two pages in this browser)
  const S = await mk(), S2 = await mk();
  for (const pg of [S, S2]) {
    await pg.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
    await until(pg, () => typeof _gameState !== 'undefined' && _gameState === 'title' && !!window.MV_NET, null, 60000);
    await pg.evaluate(() => { _gameState = 'select'; _selectStep = 1; _playModeIdx = 0; _playerCount = 1; MV_SIBLING.on = false; _heroChoice = 'mind'; startGame(); });
    await until(pg, () => _gameState === 'game' && MV_BETA.stageId && !MV_BETA.loading && p, null, 40000);
    await pg.evaluate(METER);
  }
  await S.waitForTimeout(1500); await Promise.all([S.evaluate(START), S2.evaluate(START)]);
  await Promise.all([drive(S, SECS * 1000, 1), drive(S2, SECS * 1000, 0)]);
  out.solo = await S.evaluate(STOP); out.solo2 = await S2.evaluate(STOP);
  await S.context().close(); await S2.context().close();

  const A = await mk(), Bp = await mk();
  await A.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await until(A, () => typeof _gameState !== 'undefined' && _gameState === 'title' && !!window.MV_NET_UI, null, 60000);
  await A.evaluate(() => { _gameState = 'select'; _selectStep = 0; _playModeIdx = 3; startGame(); });
  await A.click('#mvNetHostBtn').catch(() => A.evaluate(() => MV_NET_UI.host()));
  if (!await until(A, () => MV_NET.code() && MV_NET.code().length === 4, null, 30000)) throw new Error('no room code');
  const code = await A.evaluate(() => MV_NET.code());
  await Bp.goto(`http://127.0.0.1:${PORT}/index.html?join=${code}`, { waitUntil: 'domcontentloaded' });
  await until(Bp, c => window.MV_NET_UI && MV_NET_UI.isOpen() && document.getElementById('mvNetCode').value === c, code, 60000);
  await Bp.click('#mvNetGo');
  if (!await until(Bp, () => MV_NET.isLinked(), null, 30000)) throw new Error('no link');
  await until(A, () => !document.getElementById('mvNetDone').disabled, null, 8000);
  await A.click('#mvNetDone');
  await A.waitForTimeout(800); await A.evaluate(() => { if (_gameState === 'select') { _heroChoice = 'mind'; startGame(); } });   // build 469+: GO goes straight into the shared map
  const inA = await until(A, () => _gameState === 'game' && !MV_BETA.loading && p2 && p2._netPuppet, null, 50000);
  const inB = await until(Bp, () => _gameState === 'game' && !MV_BETA.loading && p2 && p2._netPuppet, null, 50000);
  if (!inA || !inB) throw new Error('not together in stage ' + JSON.stringify({ inA, inB }));
  for (const pg of [A, Bp]) await pg.evaluate(() => { try { MV_VOICE.setMode('open'); } catch (e) {} });
  for (const pg of [A, Bp]) await pg.evaluate(METER);
  await A.waitForTimeout(2000);
  const PROF = process.argv.includes('--profile');
  const cdp = PROF ? await Promise.all([A, Bp].map(async pg => { const c = await pg.context().newCDPSession(pg); await c.send('Profiler.enable'); await c.send('Profiler.setSamplingInterval', { interval: 200 }); await c.send('Profiler.start'); return c; })) : null;
  if (process.argv.includes('--voice-off')) for (const pg of [A, Bp]) await pg.evaluate(() => { try { MV_VOICE.setMode('off'); } catch (e) {} });
  await Promise.all([A.evaluate(START), Bp.evaluate(START)]);
  const ENTS = () => ({ t: Math.round(performance.now() / 1000), enems: typeof ENEMS !== 'undefined' ? ENEMS.length : -1, beta: typeof ENEMS !== 'undefined' ? ENEMS.filter(e => e && e._betaEnemy).length : -1, base: MV_NET.base ? MV_NET.base() : null, knowls: typeof KNOWLS !== 'undefined' ? KNOWLS.length : -1, kdrop: typeof KDROP !== 'undefined' ? KDROP.length : -1, crates: typeof CRATES !== 'undefined' ? CRATES.length : -1, st: MV_BETA.stageId });
  out.ents = { host: [], guest: [] };
  const entT = setInterval(async () => { try { out.ents.host.push(await A.evaluate(ENTS)); out.ents.guest.push(await Bp.evaluate(ENTS)); } catch (e) {} }, 2500);
  await Promise.all([drive(A, SECS * 1000, 0), drive(Bp, SECS * 1000, 1)]);
  clearInterval(entT);
  out.host = await A.evaluate(STOP); out.guest = await Bp.evaluate(STOP);
  if (cdp) for (const [i, c] of cdp.entries()) {
    const { profile } = await c.send('Profiler.stop');
    const self = new Map(), dt = {}; const ids = profile.samples, td = profile.timeDeltas;
    const byId = new Map(profile.nodes.map(n => [n.id, n]));
    for (let k = 0; k < ids.length; k++) dt[ids[k]] = (dt[ids[k]] || 0) + (td[k] || 0);
    let tot = 0;
    for (const [id, us] of Object.entries(dt)) { const n = byId.get(+id); const cf = n.callFrame; const key = (cf.functionName || '(anon)') + ' ' + (cf.url.split('/').pop().split('?')[0] || '') + ':' + (cf.lineNumber + 1); self.set(key, (self.get(key) || 0) + us); tot += us; }
    const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 22);
    console.log('--- ' + (i ? 'guest' : 'host') + ' CPU self time (top), total ' + (tot / 1000).toFixed(0) + ' ms');
    for (const [k, us] of top) console.log((us / 1000).toFixed(0).padStart(7) + ' ms ' + (100 * us / tot).toFixed(1).padStart(5) + '%  ' + k);
  }
  // tight-loop bench of the per-frame online work (load-robust: same machine, same moment, µs per call)
  const BENCH = () => { const N = 3000, r = {}; const t = (k, fn) => { for (let i = 0; i < 200; i++) fn(); const t0 = performance.now(); for (let i = 0; i < N; i++) fn(); r[k] = +(1000 * (performance.now() - t0) / N).toFixed(2); };
    t('tick', () => MV_NET.tick(p, p2)); t('applyVisual', () => MV_NET.applyVisual(p, p2)); t('drawExtras', () => MV_NET.drawExtras()); try { t('voiceDraw', () => MV_VOICE.draw()); } catch (e) {}
    r.frameNet = +(r.tick + r.applyVisual + 2 * r.drawExtras + (r.voiceDraw || 0)).toFixed(2); return r; };
  out.bench = { host: [], guest: [] };
  for (let i = 0; i < 3; i++) { out.bench.host.push(await A.evaluate(BENCH)); out.bench.guest.push(await Bp.evaluate(BENCH)); }
  out.link = await A.evaluate(async () => { const s = MV_NET.status(); const r = { ping: s.ping, buffered: s.buffered, route: null };
    try { const pr = MV_NET.peer(); const c = Object.values(pr.connections).flat().find(x => x.open && x.peerConnection); const st = await c.peerConnection.getStats();
      let pair = null; st.forEach(v => { if (v.type === 'transport' && v.selectedCandidatePairId) pair = st.get(v.selectedCandidatePairId); });
      if (!pair) st.forEach(v => { if (v.type === 'candidate-pair' && v.nominated && v.state === 'succeeded') pair = v; });
      if (pair) { const l = st.get(pair.localCandidateId), m = st.get(pair.remoteCandidateId); r.route = (l && l.candidateType) + '->' + (m && m.candidateType); r.rtt = pair.currentRoundTripTime; } } catch (e) { r.routeErr = e.message; }
    return r; });
  out.voice = await A.evaluate(() => { try { return MV_VOICE.state(); } catch (e) { return null; } });
} catch (e) { console.log('PROBE ERROR', e.message); out.error = e.message; }
await browser.close(); srv.close();
if (process.argv.includes('--json')) console.log(JSON.stringify(out));
else {
  console.log('side   fps   p50   p95   p99   max  >20ms >33ms | net ms/frame avg  p99   max | rx/s  ms/rx');
  for (const k of ['solo', 'solo2', 'host', 'guest']) { const r = out[k]; if (!r) continue;
    console.log(`${k.padEnd(5)} ${String(r.fps).padStart(5)} ${String(r.p50).padStart(5)} ${String(r.p95).padStart(5)} ${String(r.p99).padStart(5)} ${String(r.max).padStart(6)} ${String(r.over20).padStart(5)} ${String(r.over33).padStart(5)} |  ${String(r.netAvg).padStart(14)} ${String(r.netP99).padStart(5)} ${String(r.netMax).padStart(5)} | ${String(r.rxPerSec).padStart(4)} ${String(r.rxAvgMs).padStart(6)}`); }
  for (const k of ['host', 'guest']) if (out[k]) { console.log(k + ' hooks', JSON.stringify(out[k].by)); console.log(k + ' sent ', JSON.stringify(out[k].tx)); }
  if (out.bench) for (const k of ['host', 'guest']) console.log(k + ' bench µs/call', JSON.stringify(out.bench[k]));
  if (out.link) console.log('link', JSON.stringify(out.link));
  if (out.ents) for (const k of ['host', 'guest']) console.log(k + ' ents', JSON.stringify(out.ents[k]));
}
process.exit(out.error ? 1 : 0);
