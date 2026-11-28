// probe-hitshapes.mjs — the hit shapes are the sprite outlines (Paulo 2026-11-27).
// A punch into the triangle foe's empty top corner (inside its box, outside the triangle) must MISS;
// a punch on its slanted edge must HIT. Same for the circle foe (box corner misses, rim hits).
// Then MIND's compound shape: five parts (wheel, body, head, glove, plug), hands where the glove was drawn.
// Headless and muted.   node scripts/probe-hitshapes.mjs [baseUrl] [--shot=dir]
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const base = process.argv.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:8931/';
const shotArg = process.argv.find(a => a.startsWith('--shot='));
const shotDir = shotArg ? shotArg.slice(7) : null;
const b = await chromium.launch({ args: ['--mute-audio', '--autoplay-policy=user-gesture-required'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message || e)));
await page.route(/\.(mp3|ogg|m4a|wav)(\?|$)/, r => r.fulfill({ status: 404, body: '' }));
await page.goto(base + 'index.html?ci=1&tv=0', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof startBetaLab === 'function' && window.MV_SHAPES, null, { timeout: 40000 });

const fails = [], ok = [];
const check = (name, cond, info) => { (cond ? ok : fails).push(name + (info ? ' ' + JSON.stringify(info) : '')); };

async function stage(st) {
  await page.evaluate(async (st) => { try { if (window.MV_SIBLING) MV_SIBLING.on = false; } catch (e) {} await startBetaLab(st, 15, { fresh: true }); }, st);
  await page.waitForFunction((st) => window.MV_BETA && MV_BETA.stageId === st && !MV_BETA.loading && typeof MV_GRID !== 'undefined' && MV_GRID.ready, st, { timeout: 40000 });
  await page.waitForTimeout(1200);
}

await stage('1.1');
const r = await page.evaluate(() => {
  _loopAccT = -1e15;                       // freeze the loop: nothing moves while we test
  const S = MV_SHAPES, out = {};
  const fist = (e, x, y) => { const hb = _enemyItemHB(e); return _fistHitsHB(x - 13, y - 13, 26, 26, hb); };
  const shot = (e, x, y) => _shotHitsEnemy(x - 2, y - 2, 4, 4, e);
  for (const t of ['b_tri', 'b_circle']) {
    const e = ENEMS.find(q => q.type === t && q.alive); if (!e) { out[t] = null; continue; }
    e.ang = 0; e._lift = 0; e.rot = 0; e.spin = 0;
    const sh = S.of(e), x = e.x, y = e.y, w = e.w, h = e.h;
    // a fist (r 13) whose centre sits just off the box corner, nearly touching the box: its circle reaches into
    // the box's empty corner but not the outline
    const corner = { x: x - 6, y: y - 6 };
    // a fist touching the outline: tri = midpoint of the left slanted edge pushed out 10 px along its normal;
    // circle = 10 px out from the rim on the left
    let edge;
    if (t === 'b_tri') { const v = sh[0].v, a = v[0], c = v[1]; const mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2; const ex = c[0] - a[0], ey = c[1] - a[1], L = Math.hypot(ex, ey); edge = { x: mx + ey / L * 10 * -1, y: my - ex / L * 10 * -1 }; if (S.hitPoint(sh, edge.x, edge.y)) edge = { x: mx - ey / L * 10 * -1, y: my + ex / L * 10 * -1 }; }
    else { const c = sh[0]; edge = { x: c.x - c.r - 10, y: c.y }; }
    const boxHitsCorner = (corner.x + 13 > x) && (corner.y + 13 > y);   // the old box test would have hit
    out[t] = { k: sh[0].k, box: [x, y, w, h], corner, edge, boxHitsCorner,
      cornerFist: fist(e, corner.x, corner.y), edgeFist: fist(e, edge.x, edge.y),
      cornerShot: shot(e, x + 2, y + 2), centreShot: shot(e, x + w / 2, y + h * 0.7) };
  }
  // MIND: five parts, glove where render.js drew it
  try { draw(); } catch (e) {}
  const parts = S.of(p);
  out.hero = { ids: parts.map(q => q.id), glove: parts.find(q => q.id === 'glove'), rec: p._hs && p._hs.glove, fr };
  // a foe touching only MIND's wheel hurts; one in the air beside his box (between body and glove level, outside every part) does not
  const wh = parts.find(q => q.id === 'wheel');
  const fake = { x: wh.x + wh.r - 4, y: wh.y - 10, w: 20, h: 20, alive: true, type: 'probe' };
  out.hero.wheelTouch = S.heroTouchesFoe(p, fake);
  const bodyP = parts.find(q => q.id === 'body'), bb = S.bounds([bodyP]);
  const head = parts.find(q => q.id === 'head'), hb2 = S.bounds([head]);
  const gap = { x: (p.fc === false ? hb2.x - 40 : hb2.x + hb2.w + 20), y: hb2.y - 30, w: 16, h: 16, alive: true, type: 'probe' };
  out.hero.gapTouch = S.heroTouchesFoe(p, gap);
  // holding a jack, the plug hand reaches the jack's drawn tip, facing either way
  out.plugTip = [];
  const it0 = ITEM, fc0 = p.fc;
  for (const fc of [true, false]) { ITEM = 1; p.fc = fc; p._hs = {}; try { draw(); } catch (e) {}
    const pl = MV_SHAPES.of(p).find(q => q.id === 'plug'), n = p._hs.nose;
    out.plugTip.push(!!(n && MV_SHAPES.hitPoint([pl], n.x, n.y) && MV_SHAPES.hitPoint([pl], p._hs.plug.x, p._hs.plug.y))); }
  ITEM = it0; p.fc = fc0;
  out.def = { tri: S.def(ENEMS.find(q => q.type === 'b_tri')), hero: S.def(p) };
  return out;
});

for (const t of ['b_tri', 'b_circle']) {
  const o = r[t]; if (!o) { fails.push(t + ' not in stage 1.1'); continue; }
  check(t + ': shape is ' + (t === 'b_tri' ? 'a polygon' : 'a circle'), o.k === (t === 'b_tri' ? 'p' : 'c'), { k: o.k });
  check(t + ': the old box would have taken the corner punch', o.boxHitsCorner);
  check(t + ': punch into the empty corner MISSES', o.cornerFist === false, o.corner);
  check(t + ': punch on the edge HITS', o.edgeFist === true, o.edge);
  check(t + ': a shot in the box corner MISSES', o.cornerShot === false);
  check(t + ': a shot in the body HITS', o.centreShot === true);
}
check('MIND has wheel, body, head, glove and plug', JSON.stringify(r.hero.ids) === JSON.stringify(['wheel', 'body', 'head', 'glove', 'plug']), r.hero.ids);
check('the glove part sits where render.js drew the glove this frame', r.hero.rec && Math.abs(r.hero.rec.x - r.hero.glove.x) < 0.5 && r.hero.rec.fr >= r.hero.fr - 2, { rec: r.hero.rec, glove: r.hero.glove });
check('a foe touching only the wheel hurts', r.hero.wheelTouch === true);
check('a foe in the empty air beside the head does not', r.hero.gapTouch === false);
check('holding the RCA, the plug hand spans grip to drawn tip (facing right, left)', r.plugTip.every(Boolean), r.plugTip);
check('Art Board definition for b_tri is a 3-point polygon', r.def.tri && r.def.tri.parts[0].v && r.def.tri.parts[0].v.length === 3);

// objects and weights: an Art Board edit (served the way the tools server writes it) reaches the game
{
  const cx2 = await b.newContext({ viewport: { width: 1280, height: 720 } }), pg = await cx2.newPage();   // its own connections
  await pg.route(/\.(mp3|ogg|m4a|wav)(\?|$)/, r => r.fulfill({ status: 404, body: '' }));
  await pg.route(/sfx-replacements\.js/, async r => { let t = fs.readFileSync(new URL('../claude/js/sfx-replacements.js', import.meta.url), 'utf8');
    t = t.replace(/window\.MV_WEIGHTS = .*/, 'window.MV_WEIGHTS = {"push": {"w": 9}, "b_tri": {"w": 20}, "mind": {"w": 12}, "seed": {"w": 1.5}};')
         .replace(/window\.MV_HITSHAPES = .*/, 'window.MV_HITSHAPES = {"obj_block": {"parts": [{"k": "c", "x": 0, "y": 0, "r": 0.25}]}};');
    r.fulfill({ status: 200, contentType: 'application/javascript', body: t }); });
  await pg.goto(base + 'index.html?ci=1&tv=0', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => window.MV_BETA && MV_BETA.WEIGHT && window.MV_SHAPES, null, { timeout: 40000 });
  const o = await pg.evaluate(() => {
    const W = MV_BETA.WEIGHT, S = MV_SHAPES, r = { x: 0, y: 0, w: 32, h: 32 };
    return { push: W.push, tri: MV_BETA.weightOf('enemy', { type: 'b_tri', w: 74, h: 64 }), mind: W.mindTotal, seed: MV_BETA.knowlMass({ kind: 'seed' }),
      cornerHit: S.objCircle('obj_block', r, 1, 1, 2, true), centreHit: S.objCircle('obj_block', r, 16, 16, 2, false),
      pushUnedited: S.objCircle('obj_push', r, 1, 1, 2, 'old') };
  });
  check('weights from the Art Board: push block 9, triangle foe 20, MIND 12, seed 1.5', o.push === 9 && o.tri === 20 && o.mind === 12 && o.seed === 1.5, o);
  check('an edited block shape (small circle): a punch on its corner misses', o.cornerHit === false);
  check('an edited block shape: a punch on its centre hits', o.centreHit === true);
  check('an unedited object keeps its own box test', o.pushUnedited === 'old');
  await cx2.close();
}

if (shotDir) {
  fs.mkdirSync(shotDir, { recursive: true });
  for (const st of ['1.1', '1.3']) {
    await stage(st);
    for (const t of (st === '1.1' ? ['hero', 'b_tri', 'b_circle'] : ['b_eye', 'b_boss', 'square'])) {
      const clip = await page.evaluate((t) => {
        _loopAccT = -1e15; MV_SHAPES.show = true;
        const o = t === 'hero' ? { x: p.x, y: p.y, w: SW, h: SH } : ENEMS.find(q => q.type === t);
        if (!o) return null;
        camX = o.x + o.w / 2 - W / 2; camY = o.y + o.h / 2 - H / 2; _rcamX = camX; _rcamY = camY; try { camZoom = 1; } catch (e) {}
        try { draw(); } catch (e) {}
        const cvs = document.getElementById('c'), pad = 40, sc = 3;
        const x0 = sx(o.x - pad), y0 = sy(o.y - pad - (t === 'hero' || t === 'square' ? 40 : 0)), w = sw(o.w + 2 * pad), h = sw(o.h + 2 * pad + (t === 'hero' || t === 'square' ? 40 : 0));
        const c = document.createElement('canvas'); c.width = w * sc; c.height = h * sc; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        g.drawImage(cvs, x0, y0, w, h, 0, 0, c.width, c.height); return c.toDataURL('image/png');
      }, t);
      if (clip) fs.writeFileSync(path.join(shotDir, 'live-' + t + '.png'), Buffer.from(clip.split(',')[1], 'base64'));
    }
  }
}
await b.close();
console.log(ok.map(s => 'ok   ' + s).join('\n'));
if (fails.length) console.log(fails.map(s => 'FAIL ' + s).join('\n'));
if (errs.length) console.log('page errors: ' + [...new Set(errs)].slice(0, 4).join(' | '));
console.log(fails.length ? `hitshapes: ${fails.length} failed` : `hitshapes: all ${ok.length} checks passed`);
process.exit(fails.length ? 1 : 0);
