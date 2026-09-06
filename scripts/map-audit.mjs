#!/usr/bin/env node
/**
 * Map audit — boots the game headless and dumps, cell by cell, what Tiled
 * DRAWS next to what the collision grid RESOLVES, so mismatches are visible
 * without guessing. Also grabs a screenshot at the player spawn.
 *
 *   node scripts/map-audit.mjs [colStart] [colEnd] [rowStart] [rowEnd]
 */
import { createServer } from 'http';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'test-results');
const [c0 = 14, c1 = 46, r0 = 60, r1 = 90] = process.argv.slice(2).map(Number);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.wav': 'audio/wav',
  '.webmanifest': 'application/manifest+json',
};

function startServer(port) {
  return new Promise((resolve, reject) => {
    const srv = createServer(async (req, res) => {
      try {
        let path = decodeURIComponent((req.url || '/').split('?')[0]);
        if (path === '/') path = '/index.html';
        const file = join(ROOT, path.replace(/^\//, '').replace(/\.\./g, ''));
        const data = await readFile(file);
        res.writeHead(200, {
          'Content-Type': MIME[extname(file)] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    srv.on('error', reject);
    srv.listen(port, '127.0.0.1', () => resolve({ srv, port }));
  });
}

async function main() {
  let bound = null;
  for (const port of [8791, 8792, 8793]) {
    try { bound = await startServer(port); break; } catch (e) { if (port === 8793) throw e; }
  }
  const { srv, port } = bound;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.addInitScript(() => {
      window.__MV_FORCE_SELFTEST = true;
      try { sessionStorage.setItem('mv_selftest', '1'); } catch (e) {}
    });
    await page.goto(`http://127.0.0.1:${port}/index.html?selftest=1&quick=1&audit=1&_=${Date.now()}`,
      { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => typeof MV_GRID !== 'undefined' && MV_GRID && MV_GRID.ready,
      { timeout: 60000 });

    const dump = await page.evaluate(([c0, c1, r0, r1]) => {
      const gidOf = (arr, c, r) => {
        if (!arr) return 0;
        const cols = _tmjDraw.mw;
        if (c < 0 || r < 0 || c >= cols || r >= _tmjDraw.mh) return 0;
        return _tmjGid(arr[r * cols + c] | 0);
      };
      const drawChar = (c, r) => {
        const d = _tmjDraw;
        const dest = gidOf(d.destructData, c, r);
        const grass = gidOf(d.canvasData, c, r);
        const dirt = gidOf(d.bgData, c, r);
        if (dest) return 'X';
        if (grass && _isOmniblockGid(grass)) return 'O';
        if (dirt && _isOmniblockGid(dirt)) return 'O';
        if (grass) return 'G';
        if (dirt) return 'd';
        return '.';
      };
      const gridChar = (c, r) => '.#o*\\/'[gridCell(c, r)] || '?';
      const lines = [];
      const head = '     ' + Array.from({ length: c1 - c0 + 1 }, (_, i) => String((c0 + i) % 10)).join('');
      lines.push('DRAWN (G grass, d dirt, X destruct, O omni)   |   GRID (# solid, o oneway, * destruct, \\ / slope)');
      lines.push(head + '   ' + head);
      for (let r = r0; r <= r1; r++) {
        let a = '', b = '';
        for (let c = c0; c <= c1; c++) { a += drawChar(c, r); b += gridChar(c, r); }
        lines.push(String(r).padStart(4) + ' ' + a + '  ' + String(r).padStart(4) + ' ' + b);
      }
      const slopeGids = {};
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        if (gridIsSlope(c, r)) {
          const raw = _tmjDraw.canvasData[r * _tmjDraw.mw + c] | 0;
          slopeGids[c + ',' + r] = { gid: _tmjGid(raw), flipH: !!(raw & 0x80000000), flipV: !!(raw & 0x40000000), flipD: !!(raw & 0x20000000), kind: gridSlopeKind(c, r) };
        }
      }
      const objs = [];
      for (const L of (window.MV_STAGE0_MAP || {}).layers || []) {
        if (L.type !== 'objectgroup') continue;
        for (const o of L.objects || []) {
          objs.push({ layer: L.name, id: o.id, name: o.name, type: o.type || o.class, gid: o.gid ? _tmjGid(o.gid) : 0,
            col: Math.floor((o.x || 0) / 8), row: Math.floor((o.y || 0) / 8), w: o.width, h: o.height, poly: !!o.polygon });
        }
      }
      const spawnTiles = [];
      if (_tmjDraw.spawnData) for (let i = 0; i < _tmjDraw.spawnData.length; i++) {
        const g = _tmjGid(_tmjDraw.spawnData[i] | 0);
        if (g) spawnTiles.push({ gid: g, col: i % _tmjDraw.mw, row: (i / _tmjDraw.mw) | 0 });
      }
      return {
        objs, spawnTiles, dims: { cols: _tmjDraw.mw, rows: _tmjDraw.mh },
        text: lines.join('\n'),
        slopes: slopeGids,
        spawn: { x: _spawnX, y: _spawnY, col: TMJ_PLAYER_SPAWN_COL, row: TMJ_PLAYER_SPAWN_ROW },
        tile: MV_GRID.tile,
        bwalls: (typeof BWALLS !== 'undefined' ? BWALLS : []).map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h, col: b.homeCol, row: b.homeRow, hp: b.hp })),
      };
    }, [c0, c1, r0, r1]);

    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(join(OUT_DIR, 'map-audit.txt'),
      dump.text + '\n\nslopes: ' + JSON.stringify(dump.slopes, null, 1) +
      '\nspawn: ' + JSON.stringify(dump.spawn) + ' tile=' + dump.tile +
      '\ndims: ' + JSON.stringify(dump.dims) +
      '\nobjects:\n' + dump.objs.map(o => JSON.stringify(o)).join('\n') +
      '\nspawnTiles:\n' + dump.spawnTiles.map(o => JSON.stringify(o)).join('\n') +
      '\nbwalls: ' + JSON.stringify(dump.bwalls, null, 1) + '\n');
    console.log(dump.text);
    console.log('\ndims:', JSON.stringify(dump.dims));
    console.log('objects:'); for (const o of dump.objs) console.log(' ', JSON.stringify(o));
    console.log('spawnTiles:'); for (const o of dump.spawnTiles) console.log(' ', JSON.stringify(o));
    console.log('spawn:', JSON.stringify(dump.spawn), 'tile', dump.tile);
    console.log('bwalls:', JSON.stringify(dump.bwalls));

    const overview = await page.evaluate(() => {
      const cols = _tmjDraw.mw, rows = _tmjDraw.mh, px = 6, gap = 24;
      const cv = document.createElement('canvas');
      cv.width = cols * px * 2 + gap; cv.height = rows * px;
      const g = cv.getContext('2d');
      g.fillStyle = '#101018'; g.fillRect(0, 0, cv.width, cv.height);
      const gidOf = (arr, c, r) => arr ? _tmjGid(arr[r * cols + c] | 0) : 0;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const dest = gidOf(_tmjDraw.destructData, c, r);
        const grass = gidOf(_tmjDraw.canvasData, c, r);
        const dirt = gidOf(_tmjDraw.bgData, c, r);
        let col = null;
        if (dest) col = '#ff4d4d';
        else if ((grass && _isOmniblockGid(grass)) || (dirt && _isOmniblockGid(dirt))) col = '#ff9f1c';
        else if (grass) col = '#5ad469';
        else if (dirt) col = '#8a5a34';
        if (col) { g.fillStyle = col; g.fillRect(c * px, r * px, px, px); }
        const t = gridCell(c, r);
        const gc = [null, '#e8e8e8', '#3d7bff', '#ff4d4d', '#ffe14d', '#c04dff'][t];
        if (gc) { g.fillStyle = gc; g.fillRect(cols * px + gap + c * px, r * px, px, px); }
      }
      g.fillStyle = '#fff'; g.font = '14px monospace';
      g.fillText('TILED DRAWN', 6, 16);
      g.fillText('COLLISION GRID', cols * px + gap + 6, 16);
      return cv.toDataURL('image/png').split(',')[1];
    });
    await writeFile(join(OUT_DIR, 'map-overview.png'), Buffer.from(overview, 'base64'));
    console.log('overview: test-results/map-overview.png');
  } finally {
    await browser.close().catch(() => {});
    await new Promise((r) => srv.close(r));
  }
}

main().catch((e) => { console.error('map-audit failed:', e.message); process.exitCode = 1; });
