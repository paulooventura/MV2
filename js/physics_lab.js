// ============================================================
//  physics_lab.js — D · Slope-corner + rigid-box lab
//  Does not replace Awdjoo. Open physics-lab.html or ?ab=d
// ============================================================

let _physicsLabMode = false;

const PL_T = 32;
const PL_FLOOR = 640;
const PL_WW = 2400;
const PL_WH = 800;

function _plPlat(x, y, w, h, tp) {
  return { x, y, w, h, tp: tp || 'solid', mv: null, mp: null };
}

function initPhysicsLabWorld() {
  if (typeof _clearTiledState === 'function') _clearTiledState();
  _physicsLabMode = true;
  if (typeof _itemLabMode !== 'undefined') _itemLabMode = false;
  if (typeof _testLabMode !== 'undefined') _testLabMode = false;
  _battleTestMode = false;
  _runTestMode = false;
  _stageDesignerMode = false;
  _awdjooTutorial = false;
  if (typeof _syncBattleHud === 'function') _syncBattleHud();

  WW = PL_WW;
  WH = PL_WH;

  const crestY = 14 * PL_T;
  const platX = 12 * PL_T;
  const wallX = 33 * PL_T;
  const ledgeX = 2100;
  const ledgeY = 400;
  const ledgeW = 250;
  const passPlatX = 56 * PL_T;
  const passPlatY = 14 * PL_T;

  TR = [
    _plPlat(0, PL_FLOOR, PL_WW, PL_WH - PL_FLOOR),
    _plPlat(0, 0, PL_WW, PL_T),
    _plPlat(0, 0, PL_T, PL_WH),
    _plPlat(PL_WW - PL_T, 0, PL_T, PL_WH),
    _plPlat(platX, crestY, 8 * PL_T, PL_FLOOR - crestY),
    _plPlat(wallX, 0, PL_T, 16 * PL_T),
    _plPlat(passPlatX, passPlatY, 8 * PL_T, PL_T),
    _plPlat(ledgeX, ledgeY, ledgeW, PL_T),
  ];
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
  GOALPL = { x: PL_WW - 80, y: 0, w: 48, h: WH };
  BWALLS.length = 0;

  if (typeof ITEM_DROPS !== 'undefined') ITEM_DROPS.length = 0;
  if (typeof _itemEnhanced !== 'undefined') _itemEnhanced = [false, false, false, false];

  if (typeof buildCollisionGridFromWorld === 'function') {
    buildCollisionGridFromWorld(WW, WH, PL_T, {
      solids: TR.map(q => ({ x: q.x, y: q.y, w: q.w, h: q.h })),
      slopes: [
        { c: 6, r: 19, n: 6, kind: 'R' },
        { c: 28, r: 19, n: 5, kind: 'R' },
        { c: 42, r: 14, n: 6, kind: 'L' },
        { c: 50, r: 19, n: 6, kind: 'R', pass: true },
      ],
    });
  }

  const bw = (x, y) => {
    if (typeof _mkBwall !== 'function') return;
    BWALLS.push(_mkBwall(x, y, 32, 32, {
      movable: true, hp: 99, maxHp: 99, label: 'BOX',
      homeX: x, homeY: y, _awake: true, col: '#9c2218',
    }));
  };
  bw(ledgeX + 40, ledgeY - 32);
  bw(ledgeX + 90, ledgeY - 32);
  bw(ledgeX + 140, ledgeY - 32);

  CRATES.push(
    { x: ledgeX + 200, y: ledgeY - 32, w: 32, h: 32, vx: 0, vy: 0, og: true, rot: 0, spin: 0, movable: true },
    { x: ledgeX + 240, y: ledgeY - 32, w: 32, h: 32, vx: 0, vy: 0, og: true, rot: 0, spin: 0, movable: true }
  );

  _spawnX = 80;
  _spawnY = PL_FLOOR - (typeof FEET_OFF !== 'undefined' ? FEET_OFF : 88);
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
    let zi = ZONES.findIndex(z => z.name === 'PHYSICS LAB');
    if (zi < 0) { ZONES.push({ name: 'PHYSICS LAB', sub: 'smooth hills, corners, pass ramps, rolling boxes' }); zi = ZONES.length - 1; }
    _zoneIdx = zi;
  }
  if (typeof uiShowToast === 'function') uiShowToast('PHYSICS LAB — ramps are hills · UP+DIR climbs a pass ramp');
  console.info('MV: Physics Lab');
}

function startPhysicsLab() {
  if (typeof _unlockAudio === 'function') _unlockAudio();
  _gameState = 'game';
  if (typeof _stopAllBgm === 'function') _stopAllBgm();
  else if (typeof _stopBGM === 'function') {
    _stopBGM('title'); _stopBGM('story'); _stopBGM('game');
  }
  initPhysicsLabWorld();
  if (typeof _playBGM === 'function' && typeof OPT !== 'undefined') _playBGM('game', OPT.musicVol);
}

function drawPhysicsLabWorld() {
  if (!_physicsLabMode || _gameState !== 'game') return;
  if (typeof _gridReady !== 'function' || !_gridReady() || !MV_GRID) return;
  const t = MV_GRID.tile;
  const cols = MV_GRID.cols, rows = MV_GRID.rows;
  const seen = Object.create(null);
  const key = (c, r) => r * cols + c;
  const runStart = (c, r, kind) => {
    if (kind === 'R') return gridSlopeKind(c - 1, r + 1) !== 'R' && gridSlopeKind(c - 1, r) !== 'R';
    return gridSlopeKind(c - 1, r - 1) !== 'L' && gridSlopeKind(c - 1, r) !== 'L';
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const kind = typeof gridSlopeKind === 'function' ? gridSlopeKind(c, r) : null;
      if (!kind || seen[key(c, r)] || !runStart(c, r, kind)) continue;
      const cells = [];
      let cc = c, rr = r;
      while (gridSlopeKind(cc, rr) === kind) {
        seen[key(cc, rr)] = 1;
        cells.push([cc, rr]);
        if (kind === 'R') { cc++; rr--; }
        else { cc++; rr++; }
      }
      if (!cells.length) continue;
      const ghost = typeof gridSlopePass === 'function' && gridSlopePass(cells[0][0], cells[0][1]);
      ctx.beginPath();
      const first = cells[0], last = cells[cells.length - 1];
      if (kind === 'R') {
        ctx.moveTo(sx(first[0] * t), sy((first[1] + 1) * t));
        for (const [sc, sr] of cells) ctx.lineTo(sx((sc + 1) * t), sy(sr * t));
        if (ghost) {
          ctx.lineTo(sx((last[0] + 1) * t), sy((last[1] + 1) * t));
          ctx.lineTo(sx(first[0] * t), sy((first[1] + 1) * t));
        } else {
          ctx.lineTo(sx((last[0] + 1) * t), sy(PL_FLOOR));
          ctx.lineTo(sx(first[0] * t), sy(PL_FLOOR));
        }
      } else {
        ctx.moveTo(sx(first[0] * t), sy(first[1] * t));
        for (const [sc, sr] of cells) ctx.lineTo(sx((sc + 1) * t), sy((sr + 1) * t));
        if (ghost) {
          ctx.lineTo(sx(first[0] * t), sy((first[1] + 1) * t));
        } else {
          ctx.lineTo(sx((last[0] + 1) * t), sy(PL_FLOOR));
          ctx.lineTo(sx(first[0] * t), sy(PL_FLOOR));
        }
      }
      ctx.closePath();
      ctx.fillStyle = ghost ? 'rgba(80,200,220,0.28)' : '#3a2a48';
      ctx.fill();
      ctx.beginPath();
      if (kind === 'R') {
        ctx.moveTo(sx(first[0] * t), sy((first[1] + 1) * t));
        for (const [sc, sr] of cells) ctx.lineTo(sx((sc + 1) * t), sy(sr * t));
      } else {
        ctx.moveTo(sx(first[0] * t), sy(first[1] * t));
        for (const [sc, sr] of cells) ctx.lineTo(sx((sc + 1) * t), sy((sr + 1) * t));
      }
      ctx.strokeStyle = ghost ? '#7ee8f0' : '#e2c090';
      ctx.lineWidth = ghost ? 3 : 2;
      ctx.stroke();
    }
  }
  const labels = [
    [6 * PL_T + 8, PL_FLOOR - 18, 'CREST: WALK ON'],
    [28 * PL_T + 8, PL_FLOOR - 18, 'CORNER: STOP CLEAN'],
    [42 * PL_T + 8, PL_FLOOR - 18, 'FOOT: ROLL OFF'],
    [50 * PL_T + 8, PL_FLOOR - 18, 'DIR = PAST  ·  UP+DIR = CLIMB'],
    [2108, 400 - 18, 'PUSH OFF — FALL / ROLL'],
  ];
  for (const [x, y, txt] of labels) {
    const bx = sx(x), by = sy(y);
    if (bx < -80 || bx > W + 80) continue;
    drawText(txt, bx, by, '#e8d090', 1);
  }
}

function drawPhysicsLabHud() {
  if (!_physicsLabMode || _gameState !== 'game') return;
  ctx.fillStyle = C.BLACK;
  ctx.fillRect(6, H - 44, 620, 38);
  drawText('HILLS  ·  UP+DIR CLIMBS PASS RAMP  ·  XLR / MAG PUSH BOXES', 10, H - 40, C.SILVER, 1);
  if (ITEM >= 0) {
    const enh = typeof _itemEnhanced !== 'undefined' && _itemEnhanced[ITEM];
    const col = (typeof ICOLS !== 'undefined' && ICOLS[ITEM]) || C.WHITE;
    drawText((INAMES[ITEM] || '?') + (enh ? '  ENHANCED' : '') + '  Q CYCLE', 10, H - 24, col, 2);
  }
}

(function _bootPhysicsLab() {
  function want() {
    if (window.MV_PHYSICS_LAB) return true;
    try {
      if (/[?&]physlab=1/i.test(location.search)) return true;
      if ((document.documentElement.getAttribute('data-ab') || '').toLowerCase() === 'd') return true;
    } catch (e) {}
    return false;
  }
  function boot() {
    if (!want()) return;
    if (typeof startPhysicsLab !== 'function' || typeof mkP !== 'function') {
      requestAnimationFrame(boot);
      return;
    }
    startPhysicsLab();
  }
  if (document.readyState === 'complete') requestAnimationFrame(boot);
  else window.addEventListener('load', function () { requestAnimationFrame(boot); });
})();
