#!/usr/bin/env node
/**
 * Physics referee — headless "can MIND beat this level?" check.
 *
 * Boots the live game (Awdjoo, slot A) in headless Chromium, loads
 * js/reach_check.js into the page, and runs MV_REACH.check() against the
 * real typed grid + spawn / RCA / knowls / exit.
 *
 * Writes:
 *   test-results/reach.json         full report
 *   test-results/reach-summary.txt  one screen
 *   test-results/reach-map.png      map: green = no items, orange = needs RCA,
 *                                   red = never reached, purple = softlock
 * Exit 0 = beatable with no softlocks, 1 = problems, 2 = runner error.
 *
 *   npm run reachcheck
 *   MV_CHROME=/path/to/chrome npm run reachcheck   (use an existing Chrome)
 */
import { createServer } from 'http';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'test-results');
const PORT = Number(process.env.MV_TEST_PORT || 8775);
const STRICT = !process.argv.includes('--allow-softlocks');
// --beta : run on lab G (Awdjoo Level 1 beta from the pen sketch) instead of live Awdjoo.
const BETA = process.argv.includes('--beta');
// --lvl=1.2 : a later beta stage (implies --beta)
const LVL = (process.argv.find((a) => a.startsWith('--lvl=')) || '').slice(6) || null;
const TAG = LVL ? 'reach-beta-' + LVL : (BETA ? 'reach-beta' : 'reach');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.ldtk': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.webmanifest': 'application/manifest+json',
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
      } catch {
        res.writeHead(404); res.end('Not found');
      }
    });
    srv.on('error', reject);
    srv.listen(port, '127.0.0.1', () => resolve(srv));
  });
}

async function main() {
  let srv = null, port = PORT;
  for (const p of [PORT, 8776, 8777, 8778]) {
    try { srv = await startServer(p); port = p; break; } catch (e) { if (p === 8778) throw e; }
  }
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.MV_CHROME || undefined });
    const page = await (await browser.newContext()).newPage();
    page.on('pageerror', (e) => console.error('[page error]', e.message));

    const pageName = (BETA || LVL) ? 'beta-lab.html' : 'index.html';
    await page.goto(`http://127.0.0.1:${port}/${pageName}?${LVL ? 'lvl=' + LVL + '&' : ''}_=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => typeof initWorld === 'function' && typeof gridResolvePlayer === 'function', null, { timeout: 60000 });

    if (BETA || LVL) {
      // beta-lab.html boots itself; wait for the level to be applied.
      await page.waitForFunction(() => window.MV_BETA && window.MV_BETA.on && _gridReady() && p, null, { timeout: 60000 });
    } else {
      // Straight into the Awdjoo campaign, 1P.
      await page.evaluate(() => { _playerCount = 1; _gameState = 'game'; initWorld(); });
      await page.waitForFunction(() =>
        typeof _gridReady === 'function' && _gridReady() && typeof p !== 'undefined' && p &&
        typeof KDROP !== 'undefined' && typeof _spawnX === 'number' && !!_mapApplied,
        null, { timeout: 60000 });
    }
    // Pause the game loop so nothing moves under the referee.
    await page.evaluate(() => { _gameState = 'paused-reachcheck'; });

    await page.addScriptTag({ path: join(ROOT, 'js', 'reach_check.js') });
    console.log('MV reach check: running physics referee on ' + (LVL ? 'Awdjoo ' + LVL + ' (lab G)' : BETA ? 'Awdjoo L1 beta (lab G)' : 'Awdjoo') + '…');
    const opts = process.env.MV_REACH_OPTS ? JSON.parse(process.env.MV_REACH_OPTS) : {};
    const res = await page.evaluate((opts) => {
      const r = MV_REACH.check(opts);
      if (r.ok) r._png = MV_REACH.drawMap(r, { px: 6 }).toDataURL('image/png');
      return r;
    }, opts);
    if (!res.ok) throw new Error(res.error);

    const png = res._png; delete res._png;
    const nodes = res._nodes; delete res._nodes;
    const build = await page.evaluate(() => window.MV_BUILD || null);
    res.build = build;
    res._ranAt = new Date().toISOString();

    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(join(OUT_DIR, TAG + '.json'), JSON.stringify({ ...res, nodes }, null, 2));
    await writeFile(join(OUT_DIR, TAG + '-map.png'), Buffer.from(png.split(',')[1], 'base64'));

    const pass = res.beatable && (!STRICT || (res.counts.softlocks === 0 && res.counts.preRcaTraps === 0 && !(res.rcaNeeded && res.counts.preRcaSoftlocks > 0)));
    const t = res.targets;
    const env = res.envelope;
    const summary = [
      `MV REACH CHECK ${pass ? 'PASS' : 'FAIL'}  ${LVL ? 'Awdjoo ' + LVL : BETA ? 'L1 beta' : 'Awdjoo'}  build ${build ?? '?'}  (${(res.ms / 1000).toFixed(1)}s)`,
      `beatable: ${res.beatable ? 'YES' : 'NO'}`,
      `spawn col ${res.spawn.col} row ${res.spawn.row}`,
      ...t.map((x) => `  ${x.kind.padEnd(5)}${x.i != null ? String(x.i).padStart(2) : '  '}  col ${String(x.col).padStart(3)}${x.row != null ? ' row ' + String(x.row).padStart(3) : '        '}  → ${x.reach}`),
      `stand spots ${res.counts.standSpots} · reached ${res.counts.reachedTotal} (no items ${res.counts.reachedNoItems}, with RCA ${res.counts.reachedWithRCA})`,
      `dead ends (no way back to the exit) ${res.counts.softlocks} · wedge spots ${res.counts.wedges}`,
      `jump: tap ${env.tapJump.px.height}px · full ${env.fullJump.px.height}px · duck super ${env.duckSuperJump.px.height}px · run+full ${env.runFullJump.px.distance}px across`,
      res.problems.length ? 'problems:\n  - ' + res.problems.join('\n  - ') : 'problems: none',
      res.notes.length ? 'notes:\n  - ' + res.notes.join('\n  - ') : '',
      ...res.wedges.slice(0, 8).map((w) => `  wedge: col ${w.col} row ${w.row} heading ${w.dir > 0 ? 'right' : 'left'} (stalls from ${w.hits} start spot${w.hits > 1 ? 's' : ''})`),
      `map: test-results/${TAG}-map.png · full report: test-results/${TAG}.json`,
    ].filter(Boolean).join('\n');
    await writeFile(join(OUT_DIR, TAG + '-summary.txt'), summary + '\n');
    console.log('\n' + summary + '\n');
    process.exitCode = pass ? 0 : 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (srv) await new Promise((r) => srv.close(r));
  }
}

main().catch((err) => { console.error('MV reach check failed:', err.message); process.exitCode = 2; });
