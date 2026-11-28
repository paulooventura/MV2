// Catalog everything the live game puts in a stage, as the game draws it (Paulo 2026-11-27: "we also need the
// characters, objects, foes, everything accounted for ... also give me the worlds collision map perspective").
// For stages 1.1, 1.2, 1.3: the collision map (MV_GRID) with every entity marked, plus a cut-out of each hero,
// foe type and object, drawn by the game's own draw(). Headless and muted. Output: claude/assets/catalog/.
//   node scripts/capture-catalog.mjs [baseUrl]     (default: the MV2 tools server, http://127.0.0.1:8931/)
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'claude');
const out = path.join(root, 'assets', 'catalog');
const base = process.argv[2] || 'http://127.0.0.1:8931/';
const STAGES = ['1.1', '1.2', '1.3'];

const b = await chromium.launch({ args: ['--mute-audio'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message || e)));
await page.route(/\.(mp3|ogg|m4a|wav)(\?|$)/, r => r.fulfill({ status: 404, body: '' }));
await page.goto(base + 'index.html?ci=1&tv=0', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof startBetaLab === 'function' && typeof draw === 'function', null, { timeout: 40000 });

fs.mkdirSync(out, { recursive: true });
const catalog = { at: new Date().toISOString(), build: null, stages: [] };

for (const st of STAGES) {
  // solo: with the brother along, the game frames both of them and ignores our camera
  await page.evaluate(async (st) => { try { if (window.MV_SIBLING) MV_SIBLING.on = false; } catch (e) {} await startBetaLab(st, 15, { fresh: true }); }, st);
  await page.waitForFunction((st) => window.MV_BETA && MV_BETA.stageId === st && !MV_BETA.loading && typeof MV_GRID !== 'undefined' && MV_GRID.ready, st, { timeout: 40000 });
  await page.waitForTimeout(2500);   // stage art (tiles, sky) finishes loading
  const res = await page.evaluate((st) => {
    _loopAccT = -1e15;   // stop the game loop: nothing moves while we draw
    try { window._coopSharedCamera = () => null; window._coopPair = () => false; } catch (e) {}   // one camera, ours: no brother-midpoint view
    window.MV_HITSHAPES = {};   // record each entity's own outline; the Art Board lays Paulo's edits over it
    const B = MV_BETA, G = MV_GRID, T = G.tile, cvs = document.getElementById('c');
    const R = { id: st, cols: G.cols, rows: G.rows, tile: T, items: [], build: window.MV_BUILD };
    // ---- what is in the stage ----
    const list = [];
    const heroes = [p, (typeof p2 !== 'undefined' && p2 && p2.hero) ? p2 : null].filter(Boolean);
    // the heroes' body box is the shared SW x SH (physics.js), anchored at p.x, p.y
    heroes.forEach((h, i) => list.push({ kind: 'hero', name: (h.hero || 'mind') + (i ? ' (brother / P2)' : ' (P1)'), x: h.x, y: h.y, w: SW, h: SH, ref: h }));
    const seenFoe = {}, foeCount = {};
    for (const e of ENEMS) { const k = e.type || 'foe'; foeCount[k] = (foeCount[k] || 0) + 1; if (!seenFoe[k]) { seenFoe[k] = 1; list.push({ kind: 'foe', name: k, x: e.x, y: e.y, w: e.w, h: e.h, hp: e.mhp || e.hp, rank: e.rank, ref: e }); } }
    const seenBw = {}, bwCount = {};
    for (const w of BWALLS) { const k = (w.label || 'block') + (w.col ? ' · ' + w.col : ''); bwCount[k] = (bwCount[k] || 0) + 1; if (!seenBw[k]) { seenBw[k] = 1; list.push({ kind: 'object', name: k, x: w.x, y: w.y, w: w.w, h: w.h, hp: w.maxHp }); } }
    if (B.shells && B.shells.length) { const s = B.shells[0]; list.push({ kind: 'object', name: 'knowl shell', x: s.x - 16, y: s.y - 16, w: 32, h: 32, count: B.shells.length }); }
    for (const k of ['savePt', 'knifePickup', 'isoPickup', 'gate', 'laitu']) { const o = B[k]; if (o && typeof o.x === 'number') list.push({ kind: 'object', name: k, x: o.x, y: o.y, w: o.w || 48, h: o.h || 48 }); }
    // ---- cut each one out of a real frame ----
    const shot = (o) => {
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      camX = cx - W / 2; camY = cy - H / 2; _rcamX = camX; _rcamY = camY; try { camZoom = 1; } catch (e) {}
      try { if (typeof p2 !== 'undefined' && p2) p2.x = p2.y = -99999; } catch (e) {}
      try { draw(); } catch (e) {}
      const pad = Math.max(24, Math.min(o.w, o.h) * 0.6), x0 = sx(o.x - pad), y0 = sy(o.y - pad - (o.kind === 'hero' ? 40 : 0)), w = sw(o.w + 2 * pad), h = sw(o.h + 2 * pad + (o.kind === 'hero' ? 40 : 0));
      const c = document.createElement('canvas'); c.width = Math.max(8, Math.round(w)); c.height = Math.max(8, Math.round(h));
      c.getContext('2d').drawImage(cvs, x0, y0, w, h, 0, 0, c.width, c.height);
      // where the collision box sits inside this cut-out (cut-out pixels)
      const box = [sx(o.x) - x0, sy(o.y) - y0, sw(o.w), sw(o.h)].map(v => Math.round(v));
      // the hit shape (hitshapes.js): foes as box-relative outlines + their spin, heroes as parts in body-box px
      let shape = null;
      try { if (window.MV_SHAPES && o.ref) { shape = MV_SHAPES.def(o.ref); if (shape) shape.k = sw(o.w) / o.w; } } catch (e) {}
      return { img: c.toDataURL('image/png'), box, shape };
    };
    for (const o of list) {
      if (o.kind === 'hero' && o.ref === p) {   // both looks of the lead: Mind and Venture
        const was = p.hero;
        for (const hero of ['mind', 'venture']) { p.hero = hero; const s = shot(o); R.items.push({ kind: 'hero', name: hero, img: s.img, box: s.box, shape: s.shape, w: Math.round(o.w), h: Math.round(o.h) }); }
        p.hero = was; continue;
      }
      const s = shot(o);
      R.items.push({ kind: o.kind, name: o.name, img: s.img, box: s.box, shape: s.shape, w: Math.round(o.w), h: Math.round(o.h), hp: o.hp, rank: o.rank,
        count: o.kind === 'foe' ? foeCount[o.name] : o.kind === 'object' ? (bwCount[o.name] || o.count || 1) : 1, at: [Math.round(o.x / T), Math.round(o.y / T)] });
    }
    // ---- the collision map, with everything marked ----
    const S = 6, m = document.createElement('canvas'); m.width = G.cols * S; m.height = G.rows * S; const g = m.getContext('2d');
    g.fillStyle = '#10121a'; g.fillRect(0, 0, m.width, m.height);
    const COL = { 1: '#8c8f99', 2: '#3fd0ff', 3: '#ff9a3c' };
    for (let r = 0; r < G.rows; r++) for (let c = 0; c < G.cols; c++) {
      const v = G.data[r][c]; if (!v) continue;
      if (v === 4 || v === 5) { g.fillStyle = '#6ad06a'; g.beginPath(); if (v === 5) { g.moveTo(c * S, r * S + S); g.lineTo(c * S + S, r * S); g.lineTo(c * S + S, r * S + S); } else { g.moveTo(c * S, r * S); g.lineTo(c * S + S, r * S + S); g.lineTo(c * S, r * S + S); } g.fill(); continue; }
      if (v === 2) { g.fillStyle = COL[2]; g.fillRect(c * S, r * S, S, 2); continue; }
      g.fillStyle = COL[v] || '#c050c0'; g.fillRect(c * S, r * S, S, S);
    }
    const box = (x, y, w, h, col) => { g.strokeStyle = col; g.lineWidth = 1.5; g.strokeRect(x / T * S, y / T * S, Math.max(2, w / T * S), Math.max(2, h / T * S)); };
    for (const w of BWALLS) box(w.x, w.y, w.w, w.h, '#ffd84a');
    for (const e of ENEMS) box(e.x, e.y, e.w, e.h, '#ff4a5a');
    (B.shells || []).forEach(s => box(s.x - 8, s.y - 8, 16, 16, '#5affc8'));
    box(p.x, p.y, p.w || 40, p.h || 70, '#b48cff');
    R.collision = m.toDataURL('image/png');
    R.counts = { solid: 0, oneway: 0, destructible: 0, slopes: 0 };
    for (const row of G.data) for (const v of row) { if (v === 1) R.counts.solid++; else if (v === 2) R.counts.oneway++; else if (v === 3) R.counts.destructible++; else if (v === 4 || v === 5) R.counts.slopes++; }
    R.foes = foeCount; R.objects = bwCount;
    return R;
  }, st);
  catalog.build = res.build;
  const dir = path.join(out, 'stage-' + st.replace('.', '-')); fs.mkdirSync(dir, { recursive: true });
  const save = (name, data) => { const f = name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-') + '.png'; fs.writeFileSync(path.join(dir, f), Buffer.from(data.split(',')[1], 'base64')); return 'assets/catalog/' + path.basename(dir) + '/' + f; };
  const items = res.items.map(it => ({ ...it, img: save(it.kind + '-' + it.name, it.img) }));
  catalog.stages.push({ id: st, cols: res.cols, rows: res.rows, tile: res.tile, collision: save('collision-map', res.collision), counts: res.counts, foes: res.foes, objects: res.objects, items });
}
await b.close();
fs.writeFileSync(path.join(out, 'catalog.json'), JSON.stringify(catalog, null, 1));
const n = catalog.stages.reduce((a, s) => a + s.items.length, 0);
console.log(`catalog: ${n} entries over ${catalog.stages.length} stages (build ${catalog.build}) -> ${out}` + (errs.length ? `\npage errors: ${[...new Set(errs)].slice(0, 3).join(' | ')}` : ''));
