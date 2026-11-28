// QA for the host-authoritative online path (mv2_auth_net.js).
// Tests real gameplay coherence, not v3's pose/puppet semantics.
import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:8765/index.html?authv4=1&ci=1';
const b = await chromium.launch({ headless: true });
const mk = async () => {
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await p.goto(URL, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  return { p, errs };
};
const A = await mk(), B = await mk();
const until = async (pg, fn, ms = 6000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await pg.evaluate(fn)) return true;
    await new Promise(r => setTimeout(r, 120));
  }
  return false;
};
let fails = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name, extra === undefined ? '' : JSON.stringify(extra));
  if (!cond) fails++;
};

let connected = false;
for (let attempt = 0; attempt < 5 && !connected; attempt++) {
  const code = await A.p.evaluate(() => MV_NET.host().then(r => r.code).catch(() => null));
  if (!code) continue;
  await B.p.evaluate(c => MV_NET.join(c).catch(() => {}), code);
  connected = await until(A.p, () => MV_NET.status().status === 'connected', 12000) &&
              await until(B.p, () => MV_NET.status().status === 'connected', 12000);
  if (!connected) {
    await A.p.evaluate(() => MV_NET.disconnect());
    await B.p.evaluate(() => MV_NET.disconnect());
    await new Promise(r => setTimeout(r, 800));
  }
}
ok('room connects both players', connected);

await A.p.evaluate(() => window.startBetaLab('1.1', 0));
ok('joiner follows into the stage', await until(B.p, () => typeof _gameState !== 'undefined' && _gameState === 'game' && p, 10000) &&
                                     await until(B.p, () => typeof MV_BETA !== 'undefined' && MV_BETA.stageId === '1.1', 10000));

ok('host runs two real actors', await A.p.evaluate(() => _playerCount === 2 && !!p2 && !p2._aiCompanion),
   await A.p.evaluate(() => ({ count: _playerCount, p2: !!p2 })));
ok('authority input and snapshots are flowing', await until(B.p, () => MV_AUTH_NET.status().snap && MV_AUTH_NET.status().lastSeq > 5, 6000) &&
                                                 await until(A.p, () => MV_AUTH_NET.status().inputs > 0, 6000),
   { host: await A.p.evaluate(() => MV_AUTH_NET.status()), guest: await B.p.evaluate(() => MV_AUTH_NET.status()) });

// Guest input drives its actor on the host.
const hostP2Before = await A.p.evaluate(() => Math.round(p2.x));
await B.p.keyboard.down('d');
await new Promise(r => setTimeout(r, 1400));
await B.p.keyboard.up('d');
const hostP2After = await A.p.evaluate(() => Math.round(p2.x));
ok('guest control moves the authoritative actor', hostP2After - hostP2Before > 10, { hostP2Before, hostP2After });
let ownOK = false;
for (let i = 0; i < 25 && !ownOK; i++) {
  ownOK = await B.p.evaluate(x => Math.abs(p.x - x) < 60, hostP2After);
  if (!ownOK) await new Promise(r => setTimeout(r, 120));
}
ok('guest sees its own actor move', ownOK,
   { guestX: await B.p.evaluate(() => Math.round(p.x)), hostP2After });

// Host input is seen by the guest.
const hostP1 = await A.p.evaluate(() => Math.round(p.x));
await new Promise(r => setTimeout(r, 600));
ok('guest sees the host actor', await B.p.evaluate(x => {
  const other = window.__mvAuthOther || (typeof p2 !== 'undefined' && p2);
  return other && Math.abs(other[0] - x) < 60;
}, hostP1), { hostP1, guestOther: await B.p.evaluate(() => window.__mvAuthOther && window.__mvAuthOther[0]) });

// Guest punch reaches the host's real game code.
await B.p.keyboard.press('f');
await new Promise(r => setTimeout(r, 500));
const punch = await A.p.evaluate(() => ({ count: p2._authPunchCount || 0, pt: p2.pt || 0 }));
ok('guest punch runs on the host', punch.count > 0, punch);

// World snapshot carries enemies/doors.
const world = await B.p.evaluate(() => {
  const w = MV_AUTH_NET.status().w;
  return w && { e: w.e ? w.e.length : -1, d: w.d ? w.d.length : -1, stage: w.st };
});
ok('world snapshot includes enemies and doors', world && world.e >= 0 && world.d >= 0, world);

// Voice needs a real microphone; headless Chromium blocks it, so this probe
// only confirms the voice module is present and did not throw.
const voice = await A.p.evaluate(() => ({ has: !!window.MV_VOICE, err: window.MV_VOICE && MV_VOICE.state().err }));
ok('voice module present (mic unavailable headless)', voice.has, voice);

// Stage change follows both ways.
await A.p.evaluate(() => window.startBetaLab('1.2', 0));
ok('both advance to 1.2', await until(A.p, () => MV_BETA.stageId === '1.2', 10000) &&
                           await until(B.p, () => MV_BETA.stageId === '1.2', 12000));

console.log('errors A', A.errs.slice(0, 3), 'B', B.errs.slice(0, 3));
console.log(fails ? `\nAUTH ONLINE QA: ${fails} FAIL` : '\nAUTH ONLINE QA: ALL PASS');
await b.close();
process.exit(fails ? 1 : 0);
