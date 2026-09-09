// ============================================================
//  sketch_lab.js — E · Piskel cave sketch
//  Does not replace Awdjoo. Open sketch-lab.html or ?ab=e
// ============================================================

let _sketchLabMode = false;

function _skMap() {
  return window.MV_SKETCH_CAVE || null;
}

function _skCellAt(map, c, r) {
  if (c < 0 || r < 0 || c >= map.w || r >= map.h) return '#';
  if (map.cells && map.cells[r]) return map.cells[r][c] || '.';
  for (const s of map.solids || []) {
    if (c >= s.c && c < s.c + s.w && r >= s.r && r < s.r + s.h) return '#';
  }
  return '.';
}

function _skApplyCells(map) {
  const T = map.tile;
  if (typeof buildCollisionGridFromWorld !== 'function') return;
  // Empty world, then stamp the cleaned cell string. Do NOT pass slopes
  // through buildCollisionGridFromWorld — that fills every column to the
  // bottom and used to seal rooms under the hill.
  buildCollisionGridFromWorld(map.w * T, map.h * T, T, { solids: [], slopes: [] });
  if (!map.cells || typeof gridSet !== 'function') return;
  const SOLID = typeof MV_GRID_SOLID !== 'undefined' ? MV_GRID_SOLID : 1;
  const ONEWAY = typeof MV_GRID_ONEWAY !== 'undefined' ? MV_GRID_ONEWAY : 2;
  const DEST = typeof MV_GRID_DESTRUCT !== 'undefined' ? MV_GRID_DESTRUCT : 3;
  const SLOPER = typeof MV_GRID_SLOPE_R !== 'undefined' ? MV_GRID_SLOPE_R : 5;
  for (let r = 0; r < map.h; r++) {
    const row = map.cells[r];
    if (!row) continue;
    for (let c = 0; c < map.w; c++) {
      const ch = row[c];
      if (ch === '#') gridSet(c, r, SOLID);
      else if (ch === '/') gridSet(c, r, SLOPER);
      else if (ch === '-') gridSet(c, r, ONEWAY);
      else if (ch === 'D') gridSet(c, r, DEST);
    }
  }
}

function _skBodyBlocked(x, y) {
  if (typeof gridCell !== 'function' || typeof _gridReady !== 'function' || !_gridReady()) return false;
  const T = MV_GRID.tile;
  const feetOff = typeof FEET_OFF !== 'undefined' ? FEET_OFF : 88;
  const standH = typeof STAND_H !== 'undefined' ? STAND_H : 70;
  const wr = typeof WHEEL_R !== 'undefined' ? WHEEL_R : 20;
  const sw = typeof SW !== 'undefined' ? SW : 64;
  const feet = y + feetOff;
  const head = feet - standH - wr;
  const cx = x + sw * 0.5;
  const SOLID = typeof MV_GRID_SOLID !== 'undefined' ? MV_GRID_SOLID : 1;
  const DEST = typeof MV_GRID_DESTRUCT !== 'undefined' ? MV_GRID_DESTRUCT : 3;
  const pts = [
    [cx - wr + 3, head + 6], [cx + wr - 3, head + 6],
    [cx - wr + 3, feet - 4], [cx + wr - 3, feet - 4],
    [cx, (head + feet) * 0.5],
  ];
  for (let i = 0; i < pts.length; i++) {
    const t = gridCell(Math.floor(pts[i][0] / T), Math.floor(pts[i][1] / T));
    if (t === SOLID || t === DEST) return true;
  }
  return false;
}

function _skSafeSpawn(map) {
  const T = map.tile;
  const feetOff = typeof FEET_OFF !== 'undefined' ? FEET_OFF : 88;
  const sw = typeof SW !== 'undefined' ? SW : 64;
  const c = map.spawn.c;
  let floorR = map.h - 1;
  for (let y = map.spawn.r; y < map.h; y++) {
    const ch = _skCellAt(map, c, y);
    if (ch === '#' || ch === '-' || ch === '/') { floorR = y; break; }
  }
  let x = c * T - sw * 0.5;
  let y = floorR * T - feetOff;
  for (let i = 0; i < 24 && _skBodyBlocked(x, y); i++) y -= T;
  for (let i = 0; i < 16 && _skBodyBlocked(x, y); i++) x -= T;
  return { x: x, y: y };
}

function initSketchLabWorld() {
  const map = _skMap();
  if (!map) {
    console.error('MV: sketch map missing — load js/sketch_map.js');
    return;
  }
  if (typeof _clearTiledState === 'function') _clearTiledState();
  _sketchLabMode = true;
  if (typeof _itemLabMode !== 'undefined') _itemLabMode = false;
  if (typeof _physicsLabMode !== 'undefined') _physicsLabMode = false;
  if (typeof _testLabMode !== 'undefined') _testLabMode = false;
  _battleTestMode = false;
  _runTestMode = false;
  _stageDesignerMode = false;
  _awdjooTutorial = false;
  if (typeof _syncBattleHud === 'function') _syncBattleHud();

  const T = map.tile;
  WW = map.w * T;
  WH = map.h * T;

  TR = [];
  MPLAT.length = 0;
  APLAT.length = 0;
  ENEMS = [];
  CRATES = [];
  ESHOTS = [];
  PFXS = [];
  if (typeof _resetTrsFlames === 'function') _resetTrsFlames();
  KDROP.length = 0;
  kTotal = 0;
  kColl = 0;
  goalOpen = false;
  win = false;
  BWALLS.length = 0;

  const alc = map.alcove || { c: 212, r: 208, w: 26, h: 24 };
  GOALPL = { x: alc.c * T, y: alc.r * T, w: alc.w * T, h: alc.h * T };

  if (typeof ITEM_DROPS !== 'undefined') ITEM_DROPS.length = 0;
  if (typeof _itemEnhanced !== 'undefined') _itemEnhanced = [false, false, false, false];

  _skApplyCells(map);

  const redGid = typeof BWALL_RED_GID !== 'undefined' ? BWALL_RED_GID : 242;
  const redHp = typeof RED_BWALL_HP !== 'undefined' ? RED_BWALL_HP : 100;
  // Thin reds are oneway floors in the grid (drop through). Only the thick
  // door is one AABB — a pile of 32×32 boxes was the other snag source.
  for (const rd of map.reds || []) {
    if (!rd.movable || typeof _mkBwall !== 'function') continue;
    const x = rd.c * T, y = rd.r * T, w = rd.w * T, h = rd.h * T;
    BWALLS.push(_mkBwall(x, y, w, h, {
      tileGid: redGid, movable: true, hp: redHp, maxHp: redHp,
      label: 'BLOCK', homeX: x, homeY: y, _awake: true, col: '#c81818',
    }));
  }
  if (typeof gridStampLiveBwalls === 'function') gridStampLiveBwalls();

  for (const k of map.knowls || []) {
    const x = k.c * T + T * 0.5, y = k.r * T + T * 0.5;
    KDROP.push({ x, y, ox: x, oy: y, px: 0, py: 0, vx: 0, vy: 0, got: false, bob: Math.random() * Math.PI * 2 });
  }
  kTotal = KDROP.length;

  const crate = map.crate || { c: 224, r: 229 };
  CRATES.push({
    x: crate.c * T, y: crate.r * T, w: 32, h: 32,
    vx: 0, vy: 0, og: true, rot: 0, spin: 0, movable: true,
  });
  if (typeof _spawnItemDrop === 'function') {
    _spawnItemDrop(1, crate.c * T + 40, (crate.r + 1) * T, { enhanced: true });
  }

  const spawn = _skSafeSpawn(map);
  _spawnX = spawn.x;
  _spawnY = spawn.y;
  p = mkP();
  p.x = _spawnX;
  p.y = _spawnY;
  p.vx = 0;
  p.vy = 0;
  p.og = true;
  p.hp = p.maxHp;
  p2 = null;
  _unlockedMask = 0;
  ITEM = -1;
  if (typeof _grantPlayerItem === 'function') {
    _grantPlayerItem(0, true);
    _grantPlayerItem(1, true);
    _grantPlayerItem(2, true);
    _grantPlayerItem(3, true);
  }
  _unlockedMask = 15;
  ITEM = 2;
  _itemTutorial = null;

  camX = 0;
  camY = 0;
  _mapReady = true;
  _allPCache = null;
  if (typeof _snapCameraToPlayer === 'function') _snapCameraToPlayer(p);
  _zoneIdx = 0;
  _zoneCardT = 160;
  if (typeof ZONES !== 'undefined') {
    let zi = ZONES.findIndex(z => z.name === 'PISKEL CAVE');
    if (zi < 0) {
      ZONES.push({ name: 'PISKEL CAVE', sub: 'sketch map — knowls, red gates, slope' });
      zi = ZONES.length - 1;
    }
    _zoneIdx = zi;
  }
  if (typeof uiShowToast === 'function') {
    uiShowToast('PISKEL CAVE — drop through the red gaps · shove the door · knowls open the alcove');
  }
  console.info('MV: Piskel cave sketch', map.knowls.length, 'knowls', map.reds.length, 'reds');
}

function startSketchLab() {
  if (typeof _unlockAudio === 'function') _unlockAudio();
  _gameState = 'game';
  if (typeof _stopAllBgm === 'function') _stopAllBgm();
  else if (typeof _stopBGM === 'function') {
    _stopBGM('title'); _stopBGM('story'); _stopBGM('game');
  }
  initSketchLabWorld();
  if (typeof _playBGM === 'function' && typeof OPT !== 'undefined') _playBGM('game', OPT.musicVol);
}

function drawSketchLabWorld() {
  if (!_sketchLabMode || _gameState !== 'game') return;
  const map = _skMap();
  if (!map) return;
  const T = map.tile;

  ctx.fillStyle = '#12081c';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#1a0e28';
  for (const s of map.solids || []) {
    const rx = s.c * T, ry = s.r * T, rw = s.w * T, rh = s.h * T;
    if (rx + rw < camX - 8 || rx > camX + W + 8 || ry + rh < camY - 8 || ry > camY + H + 8) continue;
    ctx.fillRect(sx(rx), sy(ry), sw(rw), sw(rh));
  }
  ctx.fillStyle = '#0a0610';
  for (const s of map.solids || []) {
    const rx = s.c * T, ry = s.r * T, rw = s.w * T, rh = s.h * T;
    if (rx + rw < camX - 8 || rx > camX + W + 8 || ry + rh < camY - 8 || ry > camY + H + 8) continue;
    ctx.fillRect(sx(rx), sy(ry), sw(rw), 2);
  }
  ctx.fillStyle = '#8a2018';
  for (const rd of map.reds || []) {
    if (rd.movable) continue;
    const hole = rd.hole;
    if (hole) {
      ctx.fillRect(sx(rd.c * T), sy(rd.r * T), sw((hole.c - rd.c) * T), sw(Math.max(T, rd.h * T)));
      const rightC = hole.c + hole.w;
      ctx.fillRect(sx(rightC * T), sy(rd.r * T), sw((rd.c + rd.w - rightC) * T), sw(Math.max(T, rd.h * T)));
    } else {
      ctx.fillRect(sx(rd.c * T), sy(rd.r * T), sw(rd.w * T), sw(Math.max(T, rd.h * T)));
    }
  }

  if (map.slopes && map.slopes.length) {
    for (const sl of map.slopes || []) {
      ctx.beginPath();
      ctx.moveTo(sx(sl.c * T), sy((sl.r + 1) * T));
      ctx.lineTo(sx((sl.c + sl.n) * T), sy((sl.r - sl.n + 1) * T));
      ctx.lineTo(sx((sl.c + sl.n) * T), sy((sl.r + 1) * T));
      ctx.closePath();
      ctx.fillStyle = '#2a1a38';
      ctx.fill();
      ctx.strokeStyle = '#e2c090';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx(sl.c * T), sy((sl.r + 1) * T));
      ctx.lineTo(sx((sl.c + sl.n) * T), sy((sl.r - sl.n + 1) * T));
      ctx.stroke();
    }
  }

  if (goalOpen) {
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(fr * 0.12);
    ctx.fillStyle = '#50e3c2';
    ctx.fillRect(sx(GOALPL.x), sy(GOALPL.y), sw(GOALPL.w), sw(GOALPL.h));
    ctx.globalAlpha = 1;
  }
}

function drawSketchLabHud() {
  if (!_sketchLabMode || _gameState !== 'game') return;
  ctx.fillStyle = C.BLACK;
  ctx.fillRect(6, H - 44, 640, 38);
  drawText('WALK TO THE GAP IN A RED FLOOR TO DROP   ·   SHOVE THE BIG RED DOOR', 10, H - 40, C.SILVER, 1);
  drawText('KNOWLS ' + kColl + ' / ' + kTotal + (goalOpen ? '   EXIT OPEN' : ''), 10, H - 24, goalOpen ? '#50e3c2' : C.YELLOW, 2);
}

(function _bootSketchLab() {
  function want() {
    if (window.MV_SKETCH_LAB) return true;
    try {
      if (/[?&]sketch=1/i.test(location.search)) return true;
      if ((document.documentElement.getAttribute('data-ab') || '').toLowerCase() === 'e') return true;
    } catch (e) {}
    return false;
  }
  function boot() {
    if (!want()) return;
    if (typeof startSketchLab !== 'function' || typeof mkP !== 'function' || !window.MV_SKETCH_CAVE) {
      requestAnimationFrame(boot);
      return;
    }
    startSketchLab();
  }
  if (document.readyState === 'complete') requestAnimationFrame(boot);
  else window.addEventListener('load', function () { requestAnimationFrame(boot); });
})();
