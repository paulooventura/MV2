// ============================================================
//  ldtk_loader.js — F · LDtk → typed grid (lab only)
//  Does not replace Awdjoo. Open ldtk-lab.html or ?ab=f
//
//  Usage (game loop / lab boot):
//    const level = await loadLevelByPath('assets/sketches/ldtk-lab.ldtk');
//    applyLdtkLevel(level);
//    startLdtkLab(); // optional: same page already calls this
// ============================================================

const LDTK_AUTHOR_TILE = 16;
const WORLD_TILE = 32;
const LDTK_TO_WORLD = WORLD_TILE / LDTK_AUTHOR_TILE;

let _ldtkLabMode = false;
let _ldtkLevel = null;

/**
 * Identity map: LDtk Collision IntGrid value → MV_GRID_* enum.
 * Values match js/collision_grid.js. Do not invent "hazard".
 */
function ldtkIntGridToMv(value) {
  const v = value | 0;
  if (v === 0) return typeof MV_GRID_AIR !== 'undefined' ? MV_GRID_AIR : 0;
  if (v === 1) return typeof MV_GRID_SOLID !== 'undefined' ? MV_GRID_SOLID : 1;
  if (v === 2) return typeof MV_GRID_ONEWAY !== 'undefined' ? MV_GRID_ONEWAY : 2;
  if (v === 3) return typeof MV_GRID_DESTRUCT !== 'undefined' ? MV_GRID_DESTRUCT : 3;
  if (v === 4) return typeof MV_GRID_SLOPE_L !== 'undefined' ? MV_GRID_SLOPE_L : 4;
  if (v === 5) return typeof MV_GRID_SLOPE_R !== 'undefined' ? MV_GRID_SLOPE_R : 5;
  console.warn('LDtk: unmapped IntGrid value', v, '— leaving air');
  return typeof MV_GRID_AIR !== 'undefined' ? MV_GRID_AIR : 0;
}

/**
 * LDtk pixel → MV world pixel.
 * Assumption: both LDtk and this engine use top-left origin, Y down.
 * No Y-flip. Scale is WORLD_TILE / LDTK_AUTHOR_TILE (16 → 32).
 */
function ldtkPxToWorld(px, py) {
  return { x: px * LDTK_TO_WORLD, y: py * LDTK_TO_WORLD };
}

function ldtkField(ent, name) {
  const fields = (ent && ent.fieldInstances) || [];
  for (let i = 0; i < fields.length; i++) {
    if (fields[i].__identifier === name) return fields[i].__value;
  }
  return undefined;
}

function ldtkLayer(level, name) {
  const layers = (level && level.layerInstances) || [];
  for (let i = 0; i < layers.length; i++) {
    if ((layers[i].__identifier || '') === name) return layers[i];
  }
  return null;
}

function ldtkIntGridValues(layer) {
  if (!layer) return [];
  if (Array.isArray(layer.intGridCsv) && layer.intGridCsv.length) return layer.intGridCsv;
  const legacy = layer.intGrid || [];
  const w = layer.__cWid | 0, h = layer.__cHei | 0;
  const out = new Array(Math.max(0, w * h)).fill(0);
  for (let i = 0; i < legacy.length; i++) {
    const cell = legacy[i];
    const id = cell.coordId != null ? cell.coordId : cell.coordID;
    if (id != null) out[id | 0] = cell.v | 0;
  }
  return out;
}

function _ldtkResolveDir(fromPath) {
  const i = Math.max(fromPath.lastIndexOf('/'), fromPath.lastIndexOf('\\'));
  return i < 0 ? '' : fromPath.slice(0, i + 1);
}

async function _ldtkLoadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error('LDtk fetch failed ' + res.status + ' ' + path);
  return res.json();
}

function parseLdtkLevel(levelJson, opts) {
  opts = opts || {};
  const scale = LDTK_TO_WORLD;
  const authorTile = (levelJson.__gridSize || opts.gridSize || LDTK_AUTHOR_TILE) | 0;
  const coll = ldtkLayer(levelJson, 'Collision');
  const ents = ldtkLayer(levelJson, 'Entities');
  const cols = coll ? (coll.__cWid | 0) : Math.max(8, Math.ceil((levelJson.pxWid || 0) / authorTile));
  const rows = coll ? (coll.__cHei | 0) : Math.max(8, Math.ceil((levelJson.pxHei || 0) / authorTile));
  const csv = ldtkIntGridValues(coll);
  const cells = [];
  for (let r = 0; r < rows; r++) {
    cells[r] = [];
    for (let c = 0; c < cols; c++) {
      const raw = csv[r * cols + c] | 0;
      cells[r][c] = ldtkIntGridToMv(raw);
    }
  }

  const out = {
    identifier: levelJson.identifier || 'Level',
    authorTile: authorTile,
    tile: WORLD_TILE,
    scale: scale,
    cols: cols,
    rows: rows,
    ww: cols * WORLD_TILE,
    wh: rows * WORLD_TILE,
    cells: cells,
    spawn: null,
    knowls: [],
    tree: null,
    anchors: [],
    triggers: [],
  };

  const handlers = {
    MindSpawn: function (ent) {
      // Tiled spawn objects use y = head top. Reuse spawn_fix for that conversion.
      const o = {
        x: ent.px[0],
        y: ent.px[1],
        width: ent.width || authorTile,
        height: ent.height || authorTile,
      };
      if (typeof _spawnPtFromObject === 'function') {
        out.spawn = _spawnPtFromObject(o, authorTile, authorTile, scale);
      } else {
        const w = ldtkPxToWorld(ent.px[0], ent.px[1]);
        out.spawn = { x: w.x, y: w.y, headTopY: w.y, feetY: w.y };
      }
    },
    Knowl: function (ent) {
      const w = (ent.width || 0) * 0.5, h = (ent.height || 0) * 0.5;
      const p = ldtkPxToWorld(ent.px[0] + w, ent.px[1] + h);
      out.knowls.push({ x: p.x, y: p.y });
    },
    KnowlTree: function (ent) {
      const w = (ent.width || 0) * 0.5, h = (ent.height || 0) * 0.5;
      const p = ldtkPxToWorld(ent.px[0] + w, ent.px[1] + h);
      out.tree = { x: p.x, y: p.y };
    },
    GrappleAnchor: function (ent) {
      // Editor preview uses entity top-left px — keep that exact world spot.
      const p = ldtkPxToWorld(ent.px[0], ent.px[1]);
      out.anchors.push({
        x: p.x,
        y: p.y,
        w: (ent.width || authorTile) * scale,
        h: (ent.height || authorTile) * scale,
        swingable: !!ldtkField(ent, 'swingable'),
        anchorStrength: ldtkField(ent, 'anchorStrength') | 0,
      });
    },
    TradzkulTrigger: function (ent) {
      const p = ldtkPxToWorld(ent.px[0], ent.px[1]);
      out.triggers.push({
        x: p.x,
        y: p.y,
        w: (ent.width || authorTile) * scale,
        h: (ent.height || authorTile) * scale,
      });
    },
  };

  const instances = (ents && ents.entityInstances) || [];
  for (let i = 0; i < instances.length; i++) {
    const ent = instances[i];
    const id = ent.__identifier || ent.identifier || '';
    const fn = handlers[id];
    if (!fn) {
      console.warn('LDtk: unmapped entity identifier', id);
      continue;
    }
    fn(ent);
  }
  return out;
}

async function parseLdtkProject(project, projectPath) {
  const levels = project.levels || [];
  if (!levels.length) throw new Error('LDtk project has no levels');
  let raw = levels[0];
  if (project.externalLevels && raw.externalRelPath) {
    const dir = _ldtkResolveDir(projectPath || '');
    raw = await _ldtkLoadJson(dir + raw.externalRelPath);
  }
  if (!(raw.layerInstances && raw.layerInstances.length) && raw.externalRelPath) {
    const dir = _ldtkResolveDir(projectPath || '');
    raw = await _ldtkLoadJson(dir + raw.externalRelPath);
  }
  return parseLdtkLevel(raw, { gridSize: project.defaultGridSize || LDTK_AUTHOR_TILE });
}

async function loadLevelByPath(path) {
  const json = await _ldtkLoadJson(path);
  if (json.levels) return parseLdtkProject(json, path);
  return parseLdtkLevel(json, {});
}

function applyLdtkGrid(level) {
  if (typeof buildCollisionGridFromWorld !== 'function') return;
  buildCollisionGridFromWorld(level.ww, level.wh, WORLD_TILE, { solids: [], slopes: [] });
  if (typeof gridSet !== 'function') return;
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      const t = level.cells[r][c];
      if (t) gridSet(c, r, t);
    }
  }
}

function applyLdtkLevel(level) {
  if (!level) return;
  _ldtkLevel = level;
  if (typeof _clearTiledState === 'function') _clearTiledState();
  _ldtkLabMode = true;
  if (typeof _itemLabMode !== 'undefined') _itemLabMode = false;
  if (typeof _physicsLabMode !== 'undefined') _physicsLabMode = false;
  if (typeof _sketchLabMode !== 'undefined') _sketchLabMode = false;
  if (typeof _testLabMode !== 'undefined') _testLabMode = false;
  _battleTestMode = false;
  _runTestMode = false;
  _stageDesignerMode = false;
  _awdjooTutorial = false;
  if (typeof _syncBattleHud === 'function') _syncBattleHud();

  WW = level.ww;
  WH = level.wh;
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
  GOALPL = { x: WW - WORLD_TILE * 2, y: 0, w: WORLD_TILE * 2, h: WH };
  if (typeof ITEM_DROPS !== 'undefined') ITEM_DROPS.length = 0;
  if (typeof _itemEnhanced !== 'undefined') _itemEnhanced = [false, false, false, false];

  applyLdtkGrid(level);

  const T = WORLD_TILE;
  const SOLID = typeof MV_GRID_SOLID !== 'undefined' ? MV_GRID_SOLID : 1;
  const ONEWAY = typeof MV_GRID_ONEWAY !== 'undefined' ? MV_GRID_ONEWAY : 2;
  const DEST = typeof MV_GRID_DESTRUCT !== 'undefined' ? MV_GRID_DESTRUCT : 3;
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      const t = level.cells[r][c];
      if (t === SOLID) TR.push({ x: c * T, y: r * T, w: T, h: T, tp: 'solid', mv: null, mp: null });
      else if (t === ONEWAY) TR.push({ x: c * T, y: r * T, w: T, h: T, tp: 'oneway', mv: null, mp: null });
      else if (t === DEST && typeof _mkBwall === 'function') {
        BWALLS.push(_mkBwall(c * T, r * T, T, T, {
          tileGid: typeof BWALL_RED_GID !== 'undefined' ? BWALL_RED_GID : 242,
          movable: true,
          hp: typeof RED_BWALL_HP !== 'undefined' ? RED_BWALL_HP : 100,
          maxHp: typeof RED_BWALL_HP !== 'undefined' ? RED_BWALL_HP : 100,
          label: 'BLOCK', homeX: c * T, homeY: r * T, _awake: true, col: '#c81818',
        }));
      }
    }
  }
  if (typeof gridStampLiveBwalls === 'function') gridStampLiveBwalls();

  // Knowls → existing droplet list (updateKnowls in weapons.js).
  // Do not call _populateKnowlFromMap on an empty list: that falls through to Awdjoo KDEFS.
  if (typeof _mapKnowlDefs !== 'undefined') {
    _mapKnowlDefs.length = 0;
    for (let i = 0; i < level.knowls.length; i++) _mapKnowlDefs.push(level.knowls[i]);
  }
  if (level.knowls.length && typeof _populateKnowlFromMap === 'function') _populateKnowlFromMap();
  else {
    KDROP.length = 0;
    for (let i = 0; i < level.knowls.length; i++) {
      const k = level.knowls[i];
      KDROP.push({ x: k.x, y: k.y, ox: k.x, oy: k.y, px: 0, py: 0, vx: 0, vy: 0, got: false, bob: Math.random() * Math.PI * 2 });
    }
    kTotal = KDROP.length;
  }

  if (typeof _knowlTreeZone !== 'undefined') _knowlTreeZone = null;
  if (level.tree && typeof _knowlTreeZone !== 'undefined') {
    const feet = level.tree.y;
    _knowlTreeZone = { x: level.tree.x, y: feet - 72, r: 88, feetY: feet };
  }

  // Hook latches grid solids today — stamp the anchor tile so _hookRayHit hits it.
  // swingable / anchorStrength ride on the object for the rope system.
  window.MV_LDTK_HOOK_ANCHORS = level.anchors.slice();
  for (let i = 0; i < level.anchors.length; i++) {
    const a = level.anchors[i];
    const c = Math.floor(a.x / T), r = Math.floor(a.y / T);
    if (typeof gridSet === 'function') gridSet(c, r, SOLID);
    console.info('LDtk GrappleAnchor world', a.x, a.y, 'swingable', a.swingable, 'strength', a.anchorStrength);
  }

  // TradzkulTrigger → existing minion factory (enemies.js).
  for (let i = 0; i < level.triggers.length; i++) {
    const tr = level.triggers[i];
    const cx = tr.x + tr.w * 0.5;
    const feet = tr.y + tr.h;
    if (typeof _mkMinion === 'function') {
      ENEMS.push(_mkMinion(cx, feet, 'circle', { mn: Math.floor(cx - 120), mx: Math.floor(cx + 120) }));
    }
  }

  const feetOff = typeof FEET_OFF !== 'undefined' ? FEET_OFF : 88;
  if (level.spawn) {
    _spawnX = level.spawn.x;
    _spawnY = (level.spawn.feetY != null ? level.spawn.feetY : level.spawn.y) - feetOff;
  } else {
    _spawnX = T * 2;
    _spawnY = WH - T * 4 - feetOff;
  }
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
  ITEM = 1;
  _itemTutorial = null;
  camX = 0;
  camY = 0;
  _mapReady = true;
  _allPCache = null;
  if (typeof _snapCameraToPlayer === 'function') _snapCameraToPlayer(p);
  _zoneIdx = 0;
  _zoneCardT = 160;
  if (typeof ZONES !== 'undefined') {
    let zi = ZONES.findIndex(z => z.name === 'LDTK LAB');
    if (zi < 0) {
      ZONES.push({ name: 'LDTK LAB', sub: 'typed grid from Collision IntGrid' });
      zi = ZONES.length - 1;
    }
    _zoneIdx = zi;
  }
  if (typeof uiShowToast === 'function') uiShowToast('LDTK LAB — RCA hook the gold anchor · knowls · Awdjoo is A');
  console.info('MV: LDtk lab', level.cols + 'x' + level.rows, 'spawn', _spawnX, _spawnY, 'anchors', level.anchors.length);
}

async function initLdtkLabWorld() {
  const path = (window.MV_LDTK_PATH || 'assets/sketches/ldtk-lab.ldtk');
  const level = await loadLevelByPath(path);
  applyLdtkLevel(level);
}

function startLdtkLab() {
  if (typeof _unlockAudio === 'function') _unlockAudio();
  _gameState = 'game';
  _ldtkLabMode = true;
  _ldtkLevel = null;
  if (typeof _itemLabMode !== 'undefined') _itemLabMode = false;
  if (typeof _physicsLabMode !== 'undefined') _physicsLabMode = false;
  if (typeof _sketchLabMode !== 'undefined') _sketchLabMode = false;
  if (typeof _clearTiledState === 'function') _clearTiledState();
  if (typeof _stopAllBgm === 'function') _stopAllBgm();
  else if (typeof _stopBGM === 'function') {
    _stopBGM('title'); _stopBGM('story'); _stopBGM('game');
  }
  initLdtkLabWorld().then(function () {
    if (typeof _playBGM === 'function' && typeof OPT !== 'undefined') _playBGM('game', OPT.musicVol);
  }).catch(function (err) {
    console.error('LDtk lab failed', err);
  });
}

function drawLdtkLabWorld() {
  if (!_ldtkLabMode || _gameState !== 'game' || !_ldtkLevel) return;
  const T = WORLD_TILE;
  const level = _ldtkLevel;
  ctx.fillStyle = '#100818';
  ctx.fillRect(0, 0, W, H);
  const SOLID = typeof MV_GRID_SOLID !== 'undefined' ? MV_GRID_SOLID : 1;
  const ONEWAY = typeof MV_GRID_ONEWAY !== 'undefined' ? MV_GRID_ONEWAY : 2;
  const DEST = typeof MV_GRID_DESTRUCT !== 'undefined' ? MV_GRID_DESTRUCT : 3;
  const SLOPEL = typeof MV_GRID_SLOPE_L !== 'undefined' ? MV_GRID_SLOPE_L : 4;
  const SLOPER = typeof MV_GRID_SLOPE_R !== 'undefined' ? MV_GRID_SLOPE_R : 5;
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      const t = level.cells[r][c];
      if (!t) continue;
      const x = c * T, y = r * T;
      if (x + T < camX - 8 || x > camX + W + 8 || y + T < camY - 8 || y > camY + H + 8) continue;
      if (t === SOLID) ctx.fillStyle = '#1c1428';
      else if (t === ONEWAY) ctx.fillStyle = '#3a3060';
      else if (t === DEST) ctx.fillStyle = '#5a1818';
      else if (t === SLOPEL || t === SLOPER) ctx.fillStyle = '#2a1a38';
      else continue;
      ctx.fillRect(sx(x), sy(y), sw(T), sw(T));
      if (t === SLOPER) {
        ctx.strokeStyle = '#e2c090';
        ctx.beginPath();
        ctx.moveTo(sx(x), sy(y + T));
        ctx.lineTo(sx(x + T), sy(y));
        ctx.stroke();
      } else if (t === SLOPEL) {
        ctx.strokeStyle = '#e2c090';
        ctx.beginPath();
        ctx.moveTo(sx(x), sy(y));
        ctx.lineTo(sx(x + T), sy(y + T));
        ctx.stroke();
      }
    }
  }
  const anchors = window.MV_LDTK_HOOK_ANCHORS || [];
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    ctx.fillStyle = '#e8c040';
    ctx.fillRect(sx(a.x), sy(a.y), sw(Math.max(8, a.w)), sw(Math.max(8, a.h)));
  }
}

function drawLdtkLabHud() {
  if (!_ldtkLabMode || _gameState !== 'game') return;
  ctx.fillStyle = C.BLACK;
  ctx.fillRect(6, H - 44, 680, 38);
  drawText('F · LDTK  ·  RCA LATCHES THE GOLD ANCHOR  ·  AWDJOO IS A', 10, H - 40, C.SILVER, 1);
  drawText('KNOWLS ' + kColl + ' / ' + kTotal, 10, H - 24, C.YELLOW, 2);
}

(function _bootLdtkLab() {
  function want() {
    if (window.MV_LDTK_LAB) return true;
    try {
      if (/[?&]ldtk=1/i.test(location.search)) return true;
      if ((document.documentElement.getAttribute('data-ab') || '').toLowerCase() === 'f') return true;
    } catch (e) {}
    return false;
  }
  function boot() {
    if (!want()) return;
    if (typeof startLdtkLab !== 'function' || typeof mkP !== 'function') {
      requestAnimationFrame(boot);
      return;
    }
    startLdtkLab();
  }
  if (document.readyState === 'complete') requestAnimationFrame(boot);
  else window.addEventListener('load', function () { requestAnimationFrame(boot); });
})();
