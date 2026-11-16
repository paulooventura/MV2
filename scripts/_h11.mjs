import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { chromium } from 'playwright';
const ROOT = 'C:/Users/PVProductions/Projects/MV2', OUT = process.argv[2];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ldtk': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.woff2': 'font/woff2' };
const srv = createServer(async (q, r) => { try { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const d = await readFile(join(ROOT, p)); r.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); r.end(d); } catch { r.writeHead(404); r.end(); } });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--mute-audio'] });
const pg = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.route(/\.(mp3|ogg|m4a)(\?|$)/, r => r.fulfill({ status: 404, body: '' }));
await pg.goto(`http://127.0.0.1:${srv.address().port}/index.html?tv=0`);
await pg.waitForFunction(() => typeof startBetaLab === 'function' && typeof mkP === 'function', null, { timeout: 30000 });
await pg.evaluate(async (lv) => { try { MV_SIBLING.on = false; } catch (e) {} await startBetaLab(lv, 15, { fresh: true }); }, process.argv[4] || '1.1');
await pg.waitForFunction(() => window.MV_BETA && MV_BETA.on && !MV_BETA.loading && _gameState === 'game' && p, null, { timeout: 30000 });
await pg.evaluate(() => { MV_BETA.popup = null; window.applyPlayerHit = () => {}; MV_BETA.title = null; for (const e of ENEMS.slice()) if (!e.mirror) ENEMS.splice(ENEMS.indexOf(e), 1); });
let k = 0;
for (const [c, r, z, pre] of JSON.parse(process.argv[3])) {
  await pg.evaluate(([c, r, z, pre]) => { if (pre) eval(pre); _loopAccT = -1e15; for (let i = 0; i < 12; i++) { p.x = c * 32 - SW / 2; p.y = r * 32 - FEET_OFF; p.vx = 0; p.vy = 0; p.og = true; MV_BETA.popup = null; MV_BETA.talking = null; MV_BETA.title = null; update(); try { camZoom = z; camZoomTgt = z; } catch (e) {} } _syncGameCamera(); draw(); }, [c, r, z, pre || '']);
  await pg.waitForTimeout(200);
  await pg.locator('canvas').first().screenshot({ path: `${OUT}/t-${k++}.png` });
}
console.log('errors', errs.slice(0, 3), await pg.evaluate(() => window.__bs || ''));
await b.close(); srv.close();
