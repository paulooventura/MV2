#!/usr/bin/env node
/**
 * Headless probe for the shared punch button:
 *   (a) DOUBLE tap after 2 s standing idle toggles Turbo on/off; a single tap does not
 *   (b) hold-then-release after idle throws a LOADED punch (heavy sfx) and does NOT toggle Turbo
 *   (c) hold/tap mixed sequences never pair into a Turbo flip
 *   (d) quick punches in combat still run the jab/jab/hook combo
 *   (e) item-hold run/sprint still works, and never toggles Turbo
 *
 * Drives the real game loop with synthetic K-key input; measures fr/state directly.
 * No cursor, no installs, no writes to the game.
 */
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.wav': 'audio/wav', '.webmanifest': 'application/manifest+json',
};

function startServer(port) {
  return new Promise((resolve, reject) => {
    const srv = createServer(async (req, res) => {
      try {
        let path = decodeURIComponent((req.url || '/').split('?')[0]);
        if (path === '/') path = '/index.html';
        const file = join(ROOT, path.replace(/^\//, '').replace(/\.\./g, ''));
        const data = await readFile(file);
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
      } catch { res.writeHead(404); res.end('nope'); }
    });
    srv.on('error', reject);
    srv.listen(port, '127.0.0.1', () => resolve({ srv, port }));
  });
}

async function main() {
  let bound = null;
  for (const port of [8797, 8798, 8799]) {
    try { bound = await startServer(port); break; } catch (e) { if (port === 8799) throw e; }
  }
  const { srv, port } = bound;
  const browser = await chromium.launch({ headless: true });
  let results = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
    await page.addInitScript(() => {
      window.__MV_FORCE_SELFTEST = true;
      try { sessionStorage.setItem('mv_selftest', '1'); } catch (e) {}
    });
    // index.html has <base href="claude/"> so it loads the live claude/js/ build.
    await page.goto(`http://127.0.0.1:${port}/index.html?selftest=1&quick=1&_=${Date.now()}`, { waitUntil: 'domcontentloaded' });
    page.setDefaultTimeout(90000);
    await page.waitForFunction(() => typeof p !== 'undefined' && p && typeof _gameState !== 'undefined' && _gameState === 'game' && typeof MV_GRID !== 'undefined' && MV_GRID && MV_GRID.ready && !(window.MV_BETA && MV_BETA.loading));

    results = await page.evaluate(async () => {
      const out = [];
      const push = (name, obj) => out.push({ name, ...obj });
      const clearKeys = () => { for (const k of Object.keys(K)) K[k] = false; };
      // Advance exactly n LOGIC frames (fr is incremented once per fixed-timestep update()).
      const step = async (n) => {
        const t0 = fr;
        while (fr - t0 < n) await new Promise((r) => requestAnimationFrame(r));
      };

      // Take the wheel from the bot.
      if (window.MV_SELFTEST && MV_SELFTEST.stop) MV_SELFTEST.stop();
      clearKeys();
      await step(20);

      // Log sfx by name (window.sfx is the outermost wrapper others call through).
      const sfxLog = [];
      if (typeof window.sfx === 'function') {
        const orig = window.sfx;
        window.sfx = function (t) { sfxLog.push(t); return orig.apply(this, arguments); };
      }

      // The bot leaves the player resting grounded at cell ~31,76 — that is a
      // genuine standing spot, so use it instead of force-placing (which may
      // land on a one-way tile / breakable wall and fail _playerOnGround).
      const loadF = HERO_STATS[p.hero === 'venture' ? 'venture' : 'mind'].punch.loadF;

      // Put the player in a clean, standing-idle state with the gate open.
      const resetIdle = async (ignition = false) => {
        clearKeys();
        p.vx = 0; p.vy = 0; p.og = true;
        if (p.hook) p.hook.st = 'idle';
        p.wallGrip = 0; p.jf = 0;
        p.runRamp = 0; p.momentum = 0; p._slopeRollT = 0;
        p._ignition = ignition;
        p._ignTapLock = 0; p._stillT = 130;   // idle gate already open (2 s reached)
        p.pCharging = false; p.pCharge = 0; p.pCd = 0; p.pt = 0;
        p._turboTapArmed = false; p._punchHoldN = 0; p._punchWas = false;
        p._turboTap1 = false; p._turboTap1T = -999;
        p._combo = 0; p._comboFr = -999;
        sfxLog.length = 0;
        await step(2);
      };

      const tap = async (frames) => {
        K['KeyB'] = true; await step(frames);
        const held = { pCharge: p.pCharge, holdN: p._punchHoldN, still: p._stillT };
        K['KeyB'] = false; await step(1);
        return held;
      };
      const doubleTap = async () => {
        const first = await tap(3);
        await step(2);                       // gap well inside the 24-frame pair window
        const second = await tap(3);
        return { first, second };
      };
      const hold = async (frames) => {
        K['KeyB'] = true; await step(frames);
        const h = { pCharge: p.pCharge, holdN: p._punchHoldN, still: p._stillT };
        K['KeyB'] = false; await step(1);
        return h;
      };

      // ── (a) DOUBLE tap after idle toggles Turbo ON, then OFF ──────
      await resetIdle(false);
      const a0 = p._ignition;
      const aPair = await doubleTap();
      const a1 = p._ignition;
      push('a_double_on', { ignBefore: a0, ignAfter: a1, ground: _playerOnGround(p), pair: aPair, stillAfter: p._stillT, lock: p._ignTapLock, sfx: sfxLog.slice() });

      await resetIdle(true);
      const b0 = p._ignition;
      await doubleTap();
      push('a_double_off', { ignBefore: b0, ignAfter: p._ignition, stillAfter: p._stillT, lock: p._ignTapLock, sfx: sfxLog.slice() });

      // ── (b) ONE tap after idle: light punch only, NO turbo flip ───
      await resetIdle(false);
      const s0 = p._ignition;
      const single = await tap(3);
      push('b_single_tap', { ignBefore: s0, ignAfter: p._ignition, ground: _playerOnGround(p), hold: single, pendingFirst: !!p._turboTap1, sfx: sfxLog.slice() });

      // A first tap whose pair window lapses (>24 f) must not pair with a later tap.
      await resetIdle(false);
      const x0 = p._ignition;
      await tap(3); await step(30); await tap(3);
      push('b_expired_pair', { ignBefore: x0, ignAfter: p._ignition, pendingFirst: !!p._turboTap1 });

      // ── (c) HOLD after idle = loaded punch, NO turbo flip ─────────
      await resetIdle(false);
      const c0 = p._ignition;
      const cHeld = await hold(30);
      push('c_hold_loaded', {
        ignBefore: c0, ignAfter: p._ignition, loadF, ground: _playerOnGround(p), hold: cHeld,
        pChargeAtRelease: p.pCharge, loaded: p.pCharge > loadF, pt: p.pt,
        heavySfx: sfxLog.includes('punch_heavy'), sfx: sfxLog.slice(),
      });

      // Loaded punch while Turbo is already ON must not flip it off.
      await resetIdle(true);
      const d0 = p._ignition;
      await hold(30);
      push('c_hold_keeps_turbo', { ignBefore: d0, ignAfter: p._ignition, pCharge: p.pCharge, loaded: p.pCharge > loadF, heavySfx: sfxLog.includes('punch_heavy') });

      // ── (d) hold+tap and tap+hold must NOT pair into a turbo flip ──
      await resetIdle(false);
      await hold(30);
      const e0 = p._ignition;
      await tap(3);
      push('d_hold_then_tap', { ignBefore: e0, ignAfter: p._ignition, pendingFirst: !!p._turboTap1, sfx: sfxLog.slice() });

      await resetIdle(false);
      await tap(3);
      const f0 = p._ignition;
      await hold(30);
      push('d_tap_then_hold', { ignBefore: f0, ignAfter: p._ignition, pendingFirst: !!p._turboTap1, sfx: sfxLog.slice() });

      // ── (e) combat jab combo, idle gate closed ────────────────────
      await resetIdle(false);
      p._stillT = 0; // recently moved => idle gate closed
      const combos = [], igns = [];
      for (let i = 0; i < 3; i++) {
        K['KeyB'] = true; await step(2); K['KeyB'] = false; await step(6);
        combos.push(p._combo); igns.push(p._ignition);
      }
      push('e_combo', { combos, ignitions: igns, sfx: sfxLog.slice() });

      // ── (e) item-hold run/sprint still works ──────────────────────
      await resetIdle(false);
      p._stillT = 0;
      // forward tap, release, second forward, then hold the item button
      K['KeyD'] = true; await step(2); K['KeyD'] = false; await step(2);
      K['KeyD'] = true; await step(1); K['KeyV'] = true; await step(20);
      const run = {
        sprintMode: !!p._sprintMode, sprintHeld: isSprintHeld(),
        runRamp: +(p.runRamp || 0).toFixed(3), vx: +(p.vx || 0).toFixed(2),
        ignAfter: p._ignition,
      };
      clearKeys();
      push('e_item_run', run);

      return out;
    });

    // ---- verdicts ----
    const by = (n) => results.find((r) => r.name === n);
    const aOn = by('a_double_on'), aOff = by('a_double_off'), single = by('b_single_tap'),
      expired = by('b_expired_pair'),
      hLoaded = by('c_hold_loaded'), hKeep = by('c_hold_keeps_turbo'),
      ht = by('d_hold_then_tap'), th = by('d_tap_then_hold'),
      combo = by('e_combo'), run = by('e_item_run');
    const verdicts = [
      ['a idle gate open / grounded', !!aOn && aOn.ground === true && aOn.pair.first.still >= 120],
      ['a DOUBLE tap ON', !!aOn && aOn.ignBefore === false && aOn.ignAfter === true],
      ['a DOUBLE tap OFF', !!aOff && aOff.ignBefore === true && aOff.ignAfter === false],
      ['b single tap: no turbo flip', !!single && single.ignBefore === single.ignAfter],
      ['b single tap = light punch', !!single && single.sfx.filter((s) => s === 'punch').length >= 1 && !single.sfx.includes('punch_heavy')],
      ['b lapsed pair: no flip', !!expired && expired.ignBefore === expired.ignAfter],
      ['c idle gate open / grounded', !!hLoaded && hLoaded.ground === true && hLoaded.hold.still >= 120],
      ['c loaded punch thrown', !!hLoaded && hLoaded.loaded && hLoaded.pChargeAtRelease > hLoaded.loadF && hLoaded.heavySfx && hLoaded.pt >= 4],
      ['c hold does NOT flip turbo', !!hLoaded && hLoaded.ignBefore === hLoaded.ignAfter],
      ['c loaded keeps turbo ON', !!hKeep && hKeep.ignBefore === hKeep.ignAfter && hKeep.loaded],
      ['d hold then tap: no flip', !!ht && ht.ignBefore === ht.ignAfter],
      ['d tap then hold: no flip', !!th && th.ignBefore === th.ignAfter],
      ['e jab combo 0,1,2 (jab,jab,hook)', !!combo && JSON.stringify(combo.combos) === '[0,1,2]' && combo.sfx.filter((s) => s === 'punch').length >= 2 && combo.sfx.includes('punch_heavy')],
      ['e no turbo in combat', !!combo && combo.ignitions.every((x) => x === false)],
      ['e item run works', !!run && (run.sprintMode || run.sprintHeld) && run.runRamp > 0],
      ['e item run no turbo', !!run && run.ignAfter === false],
    ];

    for (const r of results) console.log(JSON.stringify(r));
    console.log('\n--- measurements / verdicts ---');
    for (const [name, ok] of verdicts) console.log((ok ? 'PASS ' : 'FAIL ') + name);
    const failed = verdicts.filter(([, ok]) => !ok);
    if (failed.length) process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
    await new Promise((r) => srv.close(r));
  }
}

main().catch((e) => { console.error('punch/turbo probe failed:', e.message); process.exitCode = 2; });
