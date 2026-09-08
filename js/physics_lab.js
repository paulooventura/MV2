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
  const ledgeX = 1680;
  const ledgeY = 400;
  const ledgeW = 300;

  TR = [
    _plPlat(0, PL_FLOOR, PL_WW, PL_WH - PL_FLOOR),
    _plPlat(0, 0, PL_WW, PL_T),
    _plPlat(0, 0, PL_T, PL_WH),
    _plPlat(PL_WW - PL_T, 0, PL_T, PL_WH),
    _plPlat(platX, crestY, 8 * PL_T, PL_T),
    _plPlat(wallX, 0, PL_T, 16 * PL_T),
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
    if (zi < 0) { ZONES.push({ name: 'PHYSICS LAB', sub: 'slopes, corners, rolling boxes' }); zi = ZONES.length - 1; }
    _zoneIdx = zi;
  }
  if (typeof uiShowToast === 'function') uiShowToast('PHYSICS LAB — walk the ramps · XLR shoves boxes off the ledge');
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
  ctx.fillStyle = '#3a2a48';
  for (let r = 0; r < MV_GRID.rows; r++) {
    for (let c = 0; c < MV_GRID.cols; c++) {
      const kind = typeof gridSlopeKind === 'function' ? gridSlopeKind(c, r) : null;
      if (!kind) continue;
      const x0 = sx(c * t), y0 = sy(r * t), tw = sw(t), th = sw(t);
      ctx.beginPath();
      if (kind === 'R') {
        ctx.moveTo(x0, y0 + th); ctx.lineTo(x0 + tw, y0); ctx.lineTo(x0 + tw, y0 + th);
      } else {
        ctx.moveTo(x0, y0); ctx.lineTo(x0 + tw, y0 + th); ctx.lineTo(x0, y0 + th);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#c8a070';
      ctx.beginPath();
      if (kind === 'R') { ctx.moveTo(x0, y0 + th); ctx.lineTo(x0 + tw, y0); }
      else { ctx.moveTo(x0, y0); ctx.lineTo(x0 + tw, y0 + th); }
      ctx.strokeStyle = '#e2c090';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#3a2a48';
    }
  }
  const labels = [
    [6 * PL_T + 8, PL_FLOOR - 18, 'CREST: WALK ON'],
    [28 * PL_T + 8, PL_FLOOR - 18, 'CORNER: STOP CLEAN'],
    [42 * PL_T + 8, PL_FLOOR - 18, 'FOOT: ROLL OFF'],
    [1688, 400 - 18, 'PUSH OFF — FALL / ROLL'],
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
  drawText('RAMPS = CORNERS  ·  XLR / MAG PUSH BOXES OFF THE LEDGE', 10, H - 40, C.SILVER, 1);
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
