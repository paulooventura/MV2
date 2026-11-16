// T522 probe: after any BGM switch, exactly one soundtrack may be audible.
// Wraps window.Audio before the game loads so we can count live elements.
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { chromium } from 'playwright';

const ROOT = 'C:/Users/PVProductions/Projects/MV2';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.ldtk': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
const srv = createServer(async (q, r) => {
  try { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
    const d = await readFile(join(ROOT, p)); r.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); r.end(d);
  } catch { r.writeHead(404); r.end(); }
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--mute-audio'] });
const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
await pg.addInitScript(() => {
  window.__audioEls = [];
  const RealAudio = window.Audio;
  window.Audio = function (...args) { const a = new RealAudio(...args); window.__audioEls.push(a); return a; };
  window.Audio.prototype = RealAudio.prototype;
  // Stubbed media never really decodes, so track INTENT: play() vs pause().
  const PP = HTMLMediaElement.prototype;
  const realPlay = PP.play;
  PP.play = function (...a) { this.__wanted = true; this.__mark = (window.__tick = (window.__tick || 0) + 1); try { const r = realPlay.apply(this, a); if (r && r.catch) r.catch(() => {}); } catch {} return Promise.resolve(); };
  PP.pause = function () { this.__wanted = false; }; // no real decode; just record intent
});
await pg.route(/\.(mp3|ogg|m4a|wav)(\?|$)/, r => r.fulfill({ status: 200, body: '' })); // no real audio needed
await pg.goto(`http://127.0.0.1:${srv.address().port}/index.html?tv=0`);
await pg.waitForFunction(() => typeof _playBGM === 'function' && window.MV_BETA_AUDIO, null, { timeout: 30000 });
await pg.evaluate(() => { window._unlockAudio && window._unlockAudio(); if (typeof OPT !== 'undefined') OPT.musicVol = 0.7; });
// Read INTENT only, before the 250 ms backstop guard can pause things.
const live = () => pg.evaluate(() => window.__audioEls.filter(a => a.__wanted).length);

const steps = [];
// 1. results song (the stage-clear track) starts alone
await pg.evaluate(() => window.MV_BETA_AUDIO.play('results', { restart: true }));
await pg.waitForTimeout(30);
steps.push(['results only', await live()]);
// 2. the exact bug: legacy title BGM takes over. Must stop the results track.
await pg.evaluate(() => _playBGM('title', 0.7));
await pg.waitForTimeout(30);
steps.push(['title after results', await live()]);
// 3. and back to a stage track
await pg.evaluate(() => window.MV_BETA_AUDIO.play('stage', { restart: true }));
await pg.waitForTimeout(30);
steps.push(['stage after title', await live()]);

console.log(steps.map(([n, c]) => `${n}: ${c} live`).join('\n'));
const bad = steps.filter(([, c]) => c > 1);
await b.close(); srv.close();
if (bad.length) { console.error('T522 FAIL: overlapping soundtracks', bad); process.exit(1); }
console.log('T522 PASS: one soundtrack at a time');
