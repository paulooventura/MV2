#!/usr/bin/env node
/**
 * Frame rate + seamless audio probe (Paulo, Nov 27 2026: "Highest framerate as possible, and seamless music").
 * Headless + muted, own free port. Plays the LIVE game (claude/ via index.html) with simulated input:
 *   1.1 / 1.2 / 1.3 solo, 1.1 local co-op, and (with --online) 1.1 online host + guest in two pages
 *   (real PeerJS broker, needs internet).
 * Records per scenario:
 *   frames   rAF interval + work time p50/p95/p99, long frames (>20 ms interval or >16.7 ms work),
 *            update() vs draw() cost, CPU profile self-time per script file (all, and inside long frames),
 *            garbage-collector time and its longest run.
 *   audio    music continuity (a music element playing whenever play is on, music volume up and the game
 *            not paused): silent gaps, restarts (currentTime jumping back, not a loop wrap), pause() calls and
 *            who made them, playbackRate writes, 'waiting'/'stalled' (buffer underruns), AudioContext suspends,
 *            and WebAudio notes started in the past (heard as clipped/late notes).
 * Usage: node scripts/probe-perf-audio.mjs [--secs 40] [--only 1.1,coop] [--online] [--swgl] [--json out.json] [--native-fn]
 *        --native-fn names the JS function behind each canvas call (drawImage < beta_decor.js:artBlitImg)
 * Exit 1 if any music cut / underrun / late note is found, or p99 frame work > 16.7 ms.
 */
import { createServer } from 'http';
import { readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SECS = +arg('--secs', 40);
const ONLY = (arg('--only', '') || '').split(',').filter(Boolean);
const JSON_OUT = arg('--json', '');
const ONLINE = process.argv.includes('--online');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.ldtk': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.webm': 'video/webm', '.woff2': 'font/woff2', '.webmanifest': 'application/json', '.wav': 'audio/wav', '.ogg': 'audio/ogg' };
// --before: serve the committed (HEAD) copy of every game script that differs from HEAD — an A/B on the same
// machine in the same minute (this PC is busy; alternate --before and plain runs back to back)
const BEFORE = new Map();
if (process.argv.includes('--before')) {
  const { execSync } = await import('child_process');
  const only = (arg('--before-files', '') || '').split(',').filter(Boolean);   // e.g. --before-files console16.js,physics.js
  const changed = execSync('git diff --name-only HEAD', { cwd: ROOT }).toString().split(String.fromCharCode(10)).filter((f) => /^claude\/js\/.*\.js$/.test(f) && (!only.length || only.includes(f.split('/').pop())));
  for (const f of changed) BEFORE.set('/' + f, execSync('git show HEAD:' + f, { cwd: ROOT, maxBuffer: 1 << 26 }));
  console.log('before: serving HEAD copies of', changed.join(', ') || '(none)');
}
const srv = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent((req.url || '/').split('?')[0]); if (path === '/') path = '/index.html';
    const d = BEFORE.get(path) || await readFile(join(ROOT, path.replace(/^\//, '').replace(/\.\./g, '')));
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => srv.listen(ONLINE ? 8812 : 0, '127.0.0.1', r));
const port = srv.address().port;
const GPU = process.argv.includes('--swgl') ? [] : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', ...GPU] });

// ── in-page instrumentation (runs before the game's scripts) ──
function instrument() {
  const W = window, now = () => performance.now();
  const R = W.__pa = { iv: [], work: [], upd: [], drw: [], long: [], music: [], ev: [], late: [], rate: 0, rateBySrc: {}, pauses: [], restarts: [], gaps: [], waits: [], suspends: 0, acStates: [], on: false, t0: 0 };
  const short = () => { try { return (new Error().stack || '').split('\n').slice(2, 7).map((l) => { const m = l.match(/js\/([\w.-]+\.js)(?:\?[^:]*)?:(\d+)/); return m ? m[1] + ':' + m[2] : ''; }).filter(Boolean).join(' < '); } catch (e) { return ''; } };
  // frames: all rAF callbacks of one frame share its timestamp; a frame's work is their sum
  const rAF = W.requestAnimationFrame.bind(W); let curTs = 0, prevTs = 0, fw = 0, fs = 0, fe = 0;
  const close = () => { if (R.on && curTs) { if (prevTs) R.iv.push(curTs - prevTs); R.work.push(fw); if (fw > 16.7 || (prevTs && curTs - prevTs > 20)) R.long.push([fs, fe, +(curTs - prevTs).toFixed(1), +fw.toFixed(1)]); } };
  W.requestAnimationFrame = (cb) => rAF((ts) => {
    if (ts !== curTs) { close(); prevTs = curTs; curTs = ts; fw = 0; fs = now(); }
    const s = now(); try { cb(ts); } finally { const e = now(); fw += e - s; fe = e; }
  });
  R.wrapLoop = () => {                                   // the outermost update()/draw() (every module chains into these)
    if (R.wrapped) return; R.wrapped = true;
    const u = W.update, d = W.draw;
    W.update = function () { const s = now(); try { return u.apply(this, arguments); } finally { if (R.on) R.upd.push(now() - s); } };
    W.draw = function () { const s = now(); try { return d.apply(this, arguments); } finally { if (R.on) R.drw.push(now() - s); } };
  };
  // media: who plays, pauses, seeks and re-rates the music
  const M = HTMLMediaElement.prototype, nm = (el) => String(el.currentSrc || el.src || '').split('/').pop().split('?')[0];
  const seen = new WeakSet();
  const watch = (el) => { if (seen.has(el)) return; seen.add(el); (R.els = R.els || []).push(el);
    for (const t of ['waiting', 'stalled']) el.addEventListener(t, () => { if (R.on && !el.paused) R.waits.push({ t: +(now() - R.t0).toFixed(0), ev: t, src: nm(el) }); }); };
  const play = M.play; M.play = function () { watch(this); return play.apply(this, arguments); };
  const pause = M.pause; M.pause = function () { if (R.on && !this.paused && !R.planned) R.pauses.push({ t: +(now() - R.t0).toFixed(0), src: nm(this), by: short(), gs: W._gameState, paused: !!W._paused }); return pause.apply(this, arguments); };
  const ct = Object.getOwnPropertyDescriptor(M, 'currentTime');
  Object.defineProperty(M, 'currentTime', { get() { return ct.get.call(this); }, set(v) { if (R.on && !this.paused && Math.abs(v - ct.get.call(this)) > 0.25) R.restarts.push({ t: +(now() - R.t0).toFixed(0), src: nm(this), from: +ct.get.call(this).toFixed(2), to: v, by: short() }); ct.set.call(this, v); }, configurable: true });
  const pr = Object.getOwnPropertyDescriptor(M, 'playbackRate');
  Object.defineProperty(M, 'playbackRate', { get() { return pr.get.call(this); }, set(v) { if (R.on && !this.paused && Math.abs(v - pr.get.call(this)) > 1e-4) { R.rate++; const k = nm(this) + ' < ' + short().split(' < ')[0]; R.rateBySrc[k] = (R.rateBySrc[k] || 0) + 1; } pr.set.call(this, v); }, configurable: true });
  const OrigAudio = W.Audio; W.Audio = function (src) { const a = src === undefined ? new OrigAudio() : new OrigAudio(src); watch(a); return a; }; W.Audio.prototype = OrigAudio.prototype;
  // WebAudio: notes started in the past, context suspends
  const AC = W.AudioContext || W.webkitAudioContext;
  if (AC) {
    const acs = R.acs = [];
    const Orig = AC; const Wrapped = function () { const c = new Orig(...arguments); acs.push(c); const sus = c.suspend.bind(c); c.suspend = () => { if (R.on && !R.planned) { R.suspends++; R.ev.push({ t: +(now() - R.t0).toFixed(0), ev: 'ac.suspend', by: short() }); } return sus(); }; return c; };
    Wrapped.prototype = Orig.prototype; W.AudioContext = Wrapped; if (W.webkitAudioContext) W.webkitAudioContext = Wrapped;
    const S = AudioScheduledSourceNode.prototype, st = S.start;
    S.start = function (when) { try { if (R.on && when > 0) { const late = this.context.currentTime - when; if (late > 0.012) R.late.push({ t: +(now() - R.t0).toFixed(0), late: +(late * 1000).toFixed(1), by: short() }); } } catch (e) {} return st.apply(this, arguments); };
  }
  R.nowPlaying = () => (R.els || []).filter((e) => !e.paused && e.volume > 0.001 && /\.mp3/.test(e.currentSrc || e.src)).map((e) => ({ src: nm(e), t: +ct.get.call(e).toFixed(2) }));
  R.hide = (h) => { R.planned = true; setTimeout(() => { R.planned = false; }, 50); Object.defineProperty(document, 'hidden', { value: h, configurable: true }); Object.defineProperty(document, 'visibilityState', { value: h ? 'hidden' : 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); if (!h) W.dispatchEvent(new Event('pageshow')); };
  // music continuity, sampled every 100 ms
  setInterval(() => {
    if (!R.on) return;
    const t = now() - R.t0, els = (R.els || []);
    const playing = els.filter((e) => !e.paused && !e.ended && e.readyState >= 2 && e.volume > 0.001);
    let vol = 0.75; try { vol = OPT.musicVol; } catch (e) {}
    const want = vol > 0.02 && W._gameState === 'game' && !W._paused && !(W.MV_BETA && (MV_BETA.loading || MV_BETA.trans));
    const names = playing.map(nm).filter((n) => /\.mp3$/.test(n));
    R.music.push([+t.toFixed(0), names.join('+'), want ? 1 : 0]);
    for (const e of playing) { const c = ct.get.call(e); if (e._lastCt != null && c + 0.05 < e._lastCt && !(e.loop && e._lastCt > (e.duration || 1e9) - 1)) R.restarts.push({ t: +t.toFixed(0), src: nm(e), from: +e._lastCt.toFixed(2), to: +c.toFixed(2), by: 'seen' }); e._lastCt = c; }
    for (const c of (R.acs || [])) R.acStates.push(c.state);
  }, 100);
}

const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(2); };
const scen = [
  { id: '1.1', stage: '1.1' }, { id: '1.2', stage: '1.2' }, { id: '1.3', stage: '1.3' }, { id: 'coop', stage: '1.1', coop: true },
  ...(ONLINE ? [{ id: 'online', stage: '1.1', online: true }] : []),
].filter((s) => !ONLY.length || ONLY.includes(s.id));

async function bootPage(ctx) {
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message || e).slice(0, 200)));
  await pg.addInitScript(instrument);
  return { pg, errs };
}
async function startStage(pg, s) {
  await pg.goto(`http://127.0.0.1:${port}/index.html?tv=0`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => typeof startBetaLab === 'function' && typeof _gameState !== 'undefined', null, { timeout: 60000 });
  await pg.evaluate(async (s) => { try { _unlockAudio(); } catch (e) {} try { MV_SIBLING.on = false; } catch (e) {} if (s.coop) { _playerCount = 2; } await startBetaLab(s.stage, 0, { fresh: true }); }, s);
  await pg.waitForFunction(() => MV_BETA.on && !MV_BETA.loading && _gameState === 'game' && MV_GRID.ready && p, null, { timeout: 60000 });
  await pg.evaluate(() => { try { MV_CONTROLS && MV_CONTROLS.isOpen() && MV_CONTROLS.close(); } catch (e) {} });
}
// a player: runs right (turns at walls), jumps, punches; never dies (the probe measures play, not the game-over screen)
async function play(pg, secs, pauseAt) {
  // he never goes down here: a shutdown / continue / game over stops the music on purpose and would read as a cut
  await pg.evaluate(() => { setInterval(() => { try { if (p) { p.hp = Math.max(p.hp, 60); p.inv = Math.max(p.inv || 0, 30); } if (typeof _shutdownTimer !== 'undefined') _shutdownTimer = 0; if (window.MV_BETA) { MV_BETA.popup = null; MV_BETA.lives = Math.max(MV_BETA.lives || 0, 3); MV_BETA.contScreen = null; MV_BETA.overT = 0; } } catch (e) {} }, 100); });
  const keys = ['KeyD', 'KeyA'], t0 = Date.now(); let dir = 0, lastX = null, stuck = 0, paused = false, hid = false;
  await pg.keyboard.down(keys[dir]);
  while (Date.now() - t0 < secs * 1000) {
    const el = (Date.now() - t0) / 1000;
    if (!paused && pauseAt && el > pauseAt && el < pauseAt + 0.6) { await pg.keyboard.press('Escape'); paused = true; await pg.waitForTimeout(2500); await pg.keyboard.press('Escape'); continue; }
    if (!hid && el > secs * 0.7) {                   // the window is hidden (minimised / another tab) and comes back
      hid = true;
      const before = await pg.evaluate(() => __pa.nowPlaying());
      await pg.evaluate(() => { __pa.hide(true); }); await pg.waitForTimeout(1500); await pg.evaluate(() => { __pa.hide(false); });
      await pg.waitForTimeout(1000);
      const after = await pg.evaluate(() => __pa.nowPlaying());
      await pg.waitForTimeout(1500);
      const later = await pg.evaluate(() => __pa.nowPlaying());
      await pg.evaluate(([b, a, l]) => { __pa.hideCheck = { before: b, after: a, later: l }; }, [before, after, later]);
      continue;
    }
    const r = Math.random();
    if (r < 0.35) await pg.keyboard.press('Space', { delay: 80 + Math.random() * 200 });
    else if (r < 0.55) await pg.keyboard.press(['KeyN', 'KeyV', 'KeyB'][Math.floor(Math.random() * 3)], { delay: 60 });
    await pg.waitForTimeout(250);
    const x = await pg.evaluate(() => p && p.x).catch(() => null);
    if (lastX != null && x != null && Math.abs(x - lastX) < 2) stuck++; else stuck = 0;
    if (stuck > 8) { await pg.keyboard.up(keys[dir]); dir ^= 1; await pg.keyboard.down(keys[dir]); stuck = 0; }
    lastX = x;
  }
  await pg.keyboard.up(keys[dir]);
}
async function measure(pg, secs, pauseAt) {
  const cdp = await pg.context().newCDPSession(pg);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  await pg.evaluate(() => { __pa.wrapLoop(); __pa.t0 = performance.now(); __pa.on = true; });
  await cdp.send('Profiler.start');
  const align = await pg.evaluate(() => performance.now());
  await play(pg, secs, pauseAt);
  await pg.evaluate(() => { __pa.on = false; });          // stop recording before the profiler's own stop stalls the page
  const { profile } = await cdp.send('Profiler.stop');
  const R = await pg.evaluate(() => { __pa.on = false; const R = __pa; return { hideCheck: R.hideCheck, iv: R.iv, work: R.work, upd: R.upd, drw: R.drw, long: R.long, music: R.music, late: R.late, rate: R.rate, rateBySrc: R.rateBySrc, pauses: R.pauses, restarts: R.restarts, waits: R.waits, suspends: R.suspends, ev: R.ev, acStates: [...new Set(R.acStates)] }; });
  // profile -> self time per script file (all / inside long frames), GC
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parentOf = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parentOf.set(c, n);
  const fileOf = (n) => { const u = n.callFrame.url || ''; if (n.callFrame.functionName === '(garbage collector)') return '(gc)'; if (!u) return n.callFrame.functionName || '(native)'; const m = u.match(/js\/([\w.-]+\.js)/); return m ? m[1] : u.split('/').pop().split('?')[0] || '(page)'; };
  const all = {}, inLong = {}, fns = {}; let tUs = profile.startTime, gcRun = 0, gcMax = 0, gcTot = 0;
  const longs = R.long.map(([s, e]) => [s, e]); let li = 0;
  for (let i = 0; i < profile.samples.length; i++) {
    const dt = (profile.timeDeltas[i] || 0) / 1000; tUs += profile.timeDeltas[i] || 0;
    const n = byId.get(profile.samples[i]); let f = fileOf(n);
    if (!n.callFrame.url && !/^\(/.test(f)) { let q = parentOf.get(n.id); while (q && !q.callFrame.url) q = parentOf.get(q.id); if (q) f += ' < ' + fileOf(q) + (process.argv.includes('--native-fn') ? ':' + (q.callFrame.functionName || '(anon)') : ''); }   // a canvas call, named with who made it
    all[f] = (all[f] || 0) + dt;
    if (n.callFrame.url) { const k = f + ':' + (n.callFrame.functionName || '(anon)') + ':' + (n.callFrame.lineNumber + 1); fns[k] = (fns[k] || 0) + dt; }
    if (f === '(gc)') { gcTot += dt; gcRun += dt; gcMax = Math.max(gcMax, gcRun); } else gcRun = 0;
    const tPage = align + (tUs - profile.startTime) / 1000;
    while (li < longs.length && longs[li][1] < tPage) li++;
    if (li < longs.length && tPage >= longs[li][0] && tPage <= longs[li][1]) inLong[f] = (inLong[f] || 0) + dt;
  }
  const top = (o, k = 12) => Object.entries(o).filter(([f]) => !/^\((idle|program)\)$/.test(f)).sort((a, b) => b[1] - a[1]).slice(0, k).map(([f, ms]) => [f, +ms.toFixed(0)]);
  // music gaps: runs of >=3 samples (300 ms) where music is wanted but none plays
  const gaps = []; let g0 = null;
  for (const [t, names, want] of R.music) { if (want && !names) { if (g0 == null) g0 = t; } else { if (g0 != null && t - g0 >= 300) gaps.push([g0, t]); g0 = null; } }
  const tracks = [...new Set(R.music.map((m) => m[1]).filter(Boolean))];
  await cdp.detach();
  return {
    frames: { n: R.iv.length, fps: +(1000 / (R.iv.reduce((a, b) => a + b, 0) / Math.max(1, R.iv.length))).toFixed(1),
      interval: { p50: pct(R.iv, 0.5), p95: pct(R.iv, 0.95), p99: pct(R.iv, 0.99), max: pct(R.iv, 1) },
      work: { p50: pct(R.work, 0.5), p95: pct(R.work, 0.95), p99: pct(R.work, 0.99), max: pct(R.work, 1) },
      update: { p50: pct(R.upd, 0.5), p99: pct(R.upd, 0.99) }, draw: { p50: pct(R.drw, 0.5), p99: pct(R.drw, 0.99) },
      long: R.long.length, longOver20: R.iv.filter((x) => x > 20).length },
    cpu: { top: top(all), fns: top(fns, 10), inLong: top(inLong, 8), gcMs: +gcTot.toFixed(0), gcMaxRunMs: +gcMax.toFixed(1) },
    audio: { hideCheck: R.hideCheck, tracks, gaps, pauses: R.pauses, restarts: R.restarts, waits: R.waits, late: R.late.slice(0, 12), lateN: R.late.length, rateWrites: R.rate, rateBySrc: R.rateBySrc, suspends: R.suspends, ev: R.ev, acStates: R.acStates },
  };
}

const out = {}; let bad = 0;
for (const s of scen) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  try {
    if (!s.online) {
      const { pg, errs } = await bootPage(ctx);
      await startStage(pg, s);
      await pg.waitForTimeout(1500);
      out[s.id] = await measure(pg, SECS, SECS * 0.5);
      out[s.id].errs = errs.slice(0, 5);
    } else {
      const ctxB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const A = await bootPage(ctx), B = await bootPage(ctxB);
      await A.pg.goto(`http://127.0.0.1:${port}/index.html?tv=0`, { waitUntil: 'domcontentloaded' });
      await A.pg.waitForFunction(() => typeof _gameState !== 'undefined' && _gameState === 'title' && window.MV_NET && window.MV_NET_UI, null, { timeout: 60000 });
      await A.pg.evaluate(() => { _unlockAudio(); _gameState = 'select'; _selectStep = 0; _playModeIdx = 3; startGame(); });
      await A.pg.click('#mvNetHostBtn');
      await A.pg.waitForFunction(() => /^[A-Z]{4}$/.test(MV_NET.code()), null, { timeout: 20000 });
      const code = await A.pg.evaluate(() => MV_NET.code());
      await B.pg.goto(`http://127.0.0.1:${port}/index.html?tv=0&join=${code}`, { waitUntil: 'domcontentloaded' });
      await B.pg.waitForFunction(() => window.MV_NET_UI && MV_NET_UI.isOpen() && MV_NET_UI.view() === 'join', null, { timeout: 60000 });
      await B.pg.evaluate(() => { try { _unlockAudio(); } catch (e) {} }); await B.pg.click('#mvNetGo');
      await A.pg.waitForFunction(() => MV_NET.isLinked() && !document.getElementById('mvNetDone').disabled, null, { timeout: 30000 });
      await A.pg.click('#mvNetDone');
      await A.pg.evaluate(() => { _heroChoice = 'mind'; startGame(); });
      for (const pg of [A.pg, B.pg]) await pg.waitForFunction(() => _gameState === 'game' && MV_BETA.stageId === '1.1' && !MV_BETA.loading && p, null, { timeout: 60000 });
      await A.pg.waitForTimeout(1500);
      const [ra, rb] = await Promise.all([measure(A.pg, SECS, 0), measure(B.pg, SECS, 0)]);
      out['online-host'] = { ...ra, errs: A.errs.slice(0, 5) }; out['online-guest'] = { ...rb, errs: B.errs.slice(0, 5) };
      await ctxB.close();
    }
  } catch (e) { out[s.id] = { error: String(e.message || e).slice(0, 300) }; bad++; }
  await ctx.close();
}
await browser.close(); srv.close();

for (const [id, r] of Object.entries(out)) {
  if (r.error) { console.log(`${id}: ERROR ${r.error}`); continue; }
  const f = r.frames, a = r.audio;
  // after the window comes back: the same track, from where it was (not 0:00), and moving again
  const hc = a.hideCheck, hideBad = hc && hc.before.length && !(hc.after.length && hc.after[0].src === hc.before[0].src && hc.after[0].t >= hc.before[0].t - 0.5
    && hc.later.length && hc.later[0].src === hc.after[0].src && hc.later[0].t > hc.after[0].t + 0.4);   // +0.4 s in 1.5 s: moving even at the hurt tempo (down to 0.5x)
  const cuts = (hideBad ? 1 : 0) + a.gaps.length + a.restarts.length + a.waits.length + a.lateN + a.suspends + a.pauses.filter((q) => q.gs === 'game' && !q.paused).length;
  if (cuts || f.work.p99 > 16.7) bad++;
  console.log(`\n== ${id}: ${f.fps} fps · interval p50/p95/p99 ${f.interval.p50}/${f.interval.p95}/${f.interval.p99} ms · work p50/p95/p99 ${f.work.p50}/${f.work.p95}/${f.work.p99} (max ${f.work.max}) · update p99 ${f.update.p99} · draw p99 ${f.draw.p99} · long ${f.long} · GC ${r.cpu.gcMs} ms (max run ${r.cpu.gcMaxRunMs})`);
  console.log('   cpu top:', r.cpu.top.map(([k, v]) => k + ' ' + v).join(', '));
  console.log('   hot functions:', r.cpu.fns.map(([k, v]) => k + ' ' + v).join(', '));
  console.log('   in long frames:', r.cpu.inLong.map(([k, v]) => k + ' ' + v).join(', ') || '-');
  console.log(`   music: ${a.tracks.join(' | ') || '(none)'} · gaps ${JSON.stringify(a.gaps)} · restarts ${a.restarts.length} · underruns ${a.waits.length} · late notes ${a.lateN} · rate writes ${a.rateWrites} · ac suspends ${a.suspends} · in-play pauses ${a.pauses.filter((q) => q.gs === 'game' && !q.paused).length}/${a.pauses.length}`);
  if (hc) console.log(`   hide/show: ${hideBad ? 'CUT' : 'ok'} ${JSON.stringify(hc)}`);
  if (a.restarts.length) console.log('   restarts:', JSON.stringify(a.restarts.slice(0, 4)));
  if (a.pauses.length) console.log('   pauses:', JSON.stringify(a.pauses.slice(0, 5)));
  if (a.waits.length) console.log('   underruns:', JSON.stringify(a.waits.slice(0, 4)));
  if (a.lateN) console.log('   late:', JSON.stringify(a.late.slice(0, 4)));
  const rs = Object.entries(a.rateBySrc).sort((x, y) => y[1] - x[1]).slice(0, 3); if (rs.length) console.log('   rate writes by:', JSON.stringify(rs));
  if (r.errs && r.errs.length) console.log('   page errors:', JSON.stringify(r.errs));
}
if (JSON_OUT) await writeFile(JSON_OUT, JSON.stringify(out, null, 1));
console.log(bad ? '\nPERF/AUDIO: ISSUES FOUND' : '\nPERF/AUDIO PASS');
process.exitCode = bad ? 1 : 0;
