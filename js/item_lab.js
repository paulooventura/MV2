// ============================================================
//  item_lab.js — C · Item sprite lab
//  Flat mock stage: standard + enhanced TRS/RCA/XLR/MAG boxes.
//  Does not replace Awdjoo. Open item-lab.html or index.html?itemlab=1
// ============================================================

let _itemLabMode = false;

const IL_PT = 32;
const IL_FLOOR = 528;
const IL_WW = 1760;
const IL_WH = 720;

function _ilPlat(x, y, w, h, tp) {
  return { x, y, w, h, tp: tp || 'solid', mv: null, mp: null };
}

function initItemLabWorld() {
  if (typeof _clearTiledState === 'function') _clearTiledState();
  _itemLabMode = true;
  if (typeof _physicsLabMode !== 'undefined') _physicsLabMode = false;
  if (typeof _sketchLabMode !== 'undefined') _sketchLabMode = false;
  if (typeof _ldtkLabMode !== 'undefined') _ldtkLabMode = false;
  if (typeof _testLabMode !== 'undefined') _testLabMode = false;
  _battleTestMode = false;
  _runTestMode = false;
  _stageDesignerMode = false;
  _awdjooTutorial = false;
  if (typeof _syncBattleHud === 'function') _syncBattleHud();

  WW = IL_WW;
  WH = IL_WH;
  TR = [
    _ilPlat(0, IL_FLOOR, IL_WW, IL_PT),
    _ilPlat(0, 0, IL_WW, IL_PT),
    _ilPlat(0, 0, IL_PT, IL_WH),
    _ilPlat(IL_WW - IL_PT, 0, IL_PT, IL_WH),
    _ilPlat(1180, IL_FLOOR - 160, 200, IL_PT),
    _ilPlat(1420, IL_FLOOR - 256, 160, IL_PT, 'oneway'),
    _ilPlat(980, IL_FLOOR - 96, 120, IL_PT, 'oneway'),
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
  GOALPL = { x: IL_WW - 80, y: 0, w: 48, h: WH };
  BWALLS.length = 0;

  if (typeof ITEM_DROPS !== 'undefined') ITEM_DROPS.length = 0;
  if (typeof _itemEnhanced !== 'undefined') _itemEnhanced = [false, false, false, false];
  _unlockedMask = 0;
  ITEM = -1;

  const feet = IL_FLOOR;
  let x = 100;
  const order = [0, 2, 1, 3];
  for (let oi = 0; oi < order.length; oi++) {
    const item = order[oi];
    if (typeof _spawnItemDrop === 'function') {
      const gap = 36;
      _spawnItemDrop(item, x, feet, { enhanced: false });
      const sz = typeof _itemBoxSize === 'function' ? _itemBoxSize(item, false) : { w: 36 };
      _spawnItemDrop(item, x + sz.w + 18, feet, { enhanced: true });
      const ez = typeof _itemBoxSize === 'function' ? _itemBoxSize(item, true) : { w: 36 };
      x += sz.w + 18 + ez.w + gap;
    }
  }

  CRATES.push(
    { x: 1520, y: IL_FLOOR - 32, w: 32, h: 32, vx: 0, vy: 0, og: false },
    { x: 1560, y: IL_FLOOR - 32, w: 32, h: 32, vx: 0, vy: 0, og: false },
    { x: 1600, y: IL_FLOOR - 32, w: 32, h: 32, vx: 0, vy: 0, og: false }
  );

  _spawnX = 64;
  _spawnY = IL_FLOOR - (typeof FEET_OFF !== 'undefined' ? FEET_OFF : 88);
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

  camX = 0;
  camY = 0;
  _mapReady = true;
  _allPCache = null;
  if (typeof _snapCameraToPlayer === 'function') _snapCameraToPlayer(p);
  _zoneIdx = 0;
  _zoneCardT = 160;
  let zi = -1;
  if (typeof ZONES !== 'undefined') {
    zi = ZONES.findIndex(z => z.name === 'ITEM LAB');
    if (zi < 0) { ZONES.push({ name: 'ITEM LAB', sub: 'standard + enhanced pickups' }); zi = ZONES.length - 1; }
    _zoneIdx = zi;
  }
  if (typeof uiShowToast === 'function') uiShowToast('ITEM LAB — walk into a box · Q cycles · fire uses the jack');
  console.info('MV: Item Lab —', (ITEM_DROPS || []).length, 'boxes');
}

function startItemLab() {
  if (typeof _unlockAudio === 'function') _unlockAudio();
  _gameState = 'game';
  if (typeof _stopAllBgm === 'function') _stopAllBgm();
  else if (typeof _stopBGM === 'function') {
    _stopBGM('title'); _stopBGM('story'); _stopBGM('game');
  }
  initItemLabWorld();
  if (typeof _playBGM === 'function' && typeof OPT !== 'undefined') _playBGM('game', OPT.musicVol);
}

function drawItemLabHud() {
  if (!_itemLabMode || _gameState !== 'game') return;
  ctx.fillStyle = C.BLACK;
  ctx.fillRect(6, H - 44, 520, 38);
  drawText('WALK INTO A BOX  ·  Q CYCLE  ·  HOLD FIRE', 10, H - 40, C.SILVER, 1);
  if (ITEM >= 0) {
    const enh = typeof _itemEnhanced !== 'undefined' && _itemEnhanced[ITEM];
    const col = (typeof ICOLS !== 'undefined' && ICOLS[ITEM]) || C.WHITE;
    drawText((INAMES[ITEM] || '?') + (enh ? '  ENHANCED' : '  STANDARD'), 10, H - 24, col, 2);
  } else {
    drawText('NO JACK EQUIPPED', 10, H - 24, C.GREY, 2);
  }
}

(function _bootItemLab() {
  function want() {
    if (window.MV_ITEM_LAB) return true;
    try {
      if (/[?&]itemlab=1/i.test(location.search)) return true;
      if ((document.documentElement.getAttribute('data-ab') || '').toLowerCase() === 'c') return true;
    } catch (e) {}
    return false;
  }
  function boot() {
    if (!want()) return;
    if (typeof startItemLab !== 'function' || typeof mkP !== 'function') {
      requestAnimationFrame(boot);
      return;
    }
    startItemLab();
  }
  if (document.readyState === 'complete') requestAnimationFrame(boot);
  else window.addEventListener('load', function () { requestAnimationFrame(boot); });
})();
