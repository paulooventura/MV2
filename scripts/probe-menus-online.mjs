#!/usr/bin/env node
// Menus probe (muted): select screen goes straight in (no "DOES YOUR BROTHER COME?" box),
// ONLINE on the BROTHER row opens the room screen, the brother-at-home window switches
// mode in place, and MOVE SAVES round-trips the saves. Run: node scripts/probe-menus-online.mjs [--shots]
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PORT = 8813;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ldtk': 'application/json' };
const srv = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent((req.url || '/').split('?')[0]); if (path === '/') path = '/index.html';
    const f = join(ROOT, path.replace(/^\//, '').replace(/\.\./g, ''));
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(await readFile(f));
  } catch { res.writeHead(404); res.end('x'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const SHOTS = process.argv.includes('--shots');
const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
let fail = 0;
const ok = (n, pass, info) => { if (!pass) fail++; console.log((pass ? 'PASS ' : 'FAIL ') + n + (info !== undefined ? '  ' + JSON.stringify(info) : '')); };
const until = async (pg, fn, arg, ms = 30000) => { try { await pg.waitForFunction(fn, arg, { timeout: ms, polling: 200 }); return true; } catch { return false; } };
try {
  for (const vp of [{ width: 1920, height: 1080, tag: '1080p' }, { width: 400, height: 860, tag: 'phone' }]) {
    const pg = await (await browser.newContext({ viewport: { width: vp.width, height: vp.height } })).newPage();
    pg.on('pageerror', e => console.log('PAGEERR', e.message));
    await pg.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
    ok(vp.tag + ' boots to title', await until(pg, () => typeof _gameState !== 'undefined' && _gameState === 'title' && !!window.MV_BROTHER_ASK, null, 60000));
    ok(vp.tag + ' title has MOVE SAVES', await pg.evaluate(() => _titleMenuItems().some(i => i.label === 'MOVE SAVES')));
    // select screen, ONLINE on the BROTHER row
    await pg.evaluate(() => { _gameState = 'select'; _selectStep = 1; _playerCount = 1; _playModeIdx = 3; MV_SIBLING.on = false; });
    await pg.waitForTimeout(400);
    if (SHOTS) await pg.screenshot({ path: `test-results/select-online-${vp.tag}.png` });
    await pg.evaluate(() => startGame());
    ok(vp.tag + ' ONLINE + pick opens the room screen', await pg.evaluate(() => MV_NET_UI.isOpen() && _gameState === 'select'));
    await pg.evaluate(() => MV_NET_UI.close());
    // SOLO: pick goes straight into the stage (no yes/no box)
    await pg.evaluate(() => { _playModeIdx = 0; MV_SIBLING.on = false; _playerCount = 1; startGame(); });
    ok(vp.tag + ' SOLO + pick goes straight into the stage', await until(pg, () => _gameState === 'game' && window.MV_BETA && MV_BETA.stageId && !MV_BETA.loading, null, 40000));
    if (vp.tag === '1080p') {
      // brother at home: a punch on him opens the window
      const npc = await until(pg, () => !!(MV_SIBLING.npc && MV_SIBLING.npc()), null, 8000);
      if (npc) {
        await pg.evaluate(() => { _paused = false; MV_SIBLING.npc()._pHit = false; });
        await pg.waitForTimeout(100);
        await pg.evaluate(() => { MV_SIBLING.npc()._pHit = true; });
        ok('punching the brother at home opens the window', await until(pg, () => MV_BROTHER_ASK.isOpen(), null, 3000));
      } else { console.log('no house brother in this stage; opening the window directly'); await pg.evaluate(() => MV_BROTHER_ASK.open()); }
      if (SHOTS) await pg.screenshot({ path: 'test-results/brother-ask.png' });
      await pg.evaluate(() => MV_BROTHER_ASK.pick(1));
      // the controls picker (controls_setup.js) pauses while it is up; closing it resumes the run
      const ctl = await pg.evaluate(() => !!(window.MV_CONTROLS && MV_CONTROLS.isOpen()));
      if (ctl) await pg.evaluate(() => MV_CONTROLS.close());
      const st2 = await pg.evaluate(() => ({ pc: _playerCount, p2: !!p2, ai: !!(p2 && p2._aiCompanion), gs: _gameState, paused: _paused }));
      ok('ADD PLAYER 2 switches to local co-op in place', st2.pc === 2 && st2.p2 && !st2.ai && st2.gs === 'game' && !st2.paused, { controlsPicker: ctl, ...st2 });
      // saves round-trip
      const r = await pg.evaluate(() => {
        localStorage.setItem('mv2.story.slots.v1', JSON.stringify([{ stageId: '1.2', mask: 3 }, null, null, null, null]));
        const t = MV_SAVE_SHARE.toText(MV_SAVE_SHARE.bundle());
        localStorage.setItem('mv2.story.slots.v1', '[]');
        MV_SAVE_SHARE.apply(MV_SAVE_SHARE.fromText(t));
        const back = localStorage.getItem('mv2.story.slots.v1');
        const undone = MV_SAVE_SHARE.undo();
        return { len: t.length, back, afterUndo: localStorage.getItem('mv2.story.slots.v1'), undone, sum: MV_SAVE_SHARE.summary(MV_SAVE_SHARE.fromText(t)) };
      });
      ok('save code round-trips the journeys', /"1\.2"/.test(r.back) && r.undone && r.afterUndo === '[]', r);
      await pg.evaluate(() => { _gameState = 'title'; MV_SAVE_SHARE.open(); });
      ok('MOVE SAVES panel opens', await pg.evaluate(() => MV_SAVE_SHARE.isOpen()));
      if (SHOTS) await pg.screenshot({ path: 'test-results/move-saves.png' });
    }
    await pg.context().close();
  }
} catch (e) { console.log('PROBE ERROR', e.message); fail++; }
await browser.close(); srv.close();
console.log(fail ? `\nMENUS PROBE: ${fail} FAIL` : '\nMENUS PROBE: ALL PASS');
process.exit(fail ? 1 : 0);
