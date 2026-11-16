// T523: dismissing the stage-clear results must never freeze the game loop.
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
const pg = await b.newPage({ viewport: { width: 1200, height: 800 } });
await pg.route(/\.(mp3|ogg|m4a|wav)(\?|$)/, r => r.fulfill({ status: 200, body: '' }));
await pg.goto(`http://127.0.0.1:${srv.address().port}/index.html?tv=0`);
await pg.waitForFunction(() => typeof startBetaLab === 'function' && window.MV_BETA, null, { timeout: 30000 });

async function runCase(label, prep) {
  await pg.evaluate(async () => { try { MV_BETA.popup = null; } catch {} await startBetaLab('1.1', 15, { fresh: true }); });
  await pg.waitForFunction(() => window.MV_BETA && MV_BETA.on && !MV_BETA.loading && _gameState === 'game', null, { timeout: 30000 });
  await pg.evaluate((prep) => {
    if (prep === 'normal') { MV_BETA.results = { t: 999, sc: { rows: [] } }; }
    else if (prep === 'refuse') { MV_BETA.trans = { t: 0, to: '1.1', mask: 15 }; MV_BETA.results = { t: 999, sc: { rows: [] } }; }
    else if (prep === 'fail') { const orig = window.startBetaLab; window.startBetaLab = () => Promise.reject(new Error('forced load failure')); MV_BETA.results = { t: 999, sc: { rows: [] } }; window.__restoreLab = () => { window.startBetaLab = orig; }; }
  }, prep);
  const before = await pg.evaluate(() => ({ fr, results: !!MV_BETA.results }));
  await pg.evaluate(() => { if (typeof resultsNext === 'function') resultsNext(); else MV_BETA.quitToTitle && MV_BETA.quitToTitle(); });
  await pg.waitForTimeout(2000);
  const after = await pg.evaluate(() => ({ fr, results: !!MV_BETA.results, trans: !!MV_BETA.trans,
    title: _gameState === 'title', on: !!MV_BETA.on }));
  if (prep === 'fail') await pg.evaluate(() => window.__restoreLab && window.__restoreLab());
  const advanced = after.fr - before.fr;
  const usable = after.trans || after.title || (after.on && !after.results);
  console.log(`${label}: frames+${advanced}, results=${after.results}, trans=${after.trans}, title=${after.title}, on=${after.on}`);
  return advanced > 30 && usable;
}

const checks = [
  await runCase('normal advance', 'normal'),
  await runCase('travel refuses', 'refuse'),
  await runCase('load rejects', 'fail'),
];
await b.close(); srv.close();
if (checks.some(c => !c)) { console.error('T523 FAIL: results dismissal froze or left a dead screen'); process.exit(1); }
console.log('T523 PASS: loop keeps advancing and every branch lands in a usable state');
