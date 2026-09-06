// ============================================================
//  awdjoo_level.js — Awdjoo zone-0 campaign layout
//  House 2 spawn → basement RCA → exit at house 5 east.
// ============================================================

const AWdjoo_HOUSE2_SPAWN_COL = 31;
const AWdjoo_HOUSE2_SPAWN_ROW = 72;
const AWdjoo_RCA_COL = 30;
const AWdjoo_RCA_ROW = 85;
const AWdjoo_HOUSE5_GOAL_COL = 97;
const AWdjoo_HOUSE5_GOAL_ROW = 72;
/** House 1 roof (west of House 2). Map marker: gid 223 / object 17 @ col 13. */
const AWdjoo_HOUSE1_ENEMY_COL = 13;
const AWdjoo_HOUSE1_ENEMY_ROW = 68;
/** Left-slope crest, east edge of the House 1 roof. */
const AWdjoo_SLOPE_ENEMY_COL = 17;
const AWdjoo_SLOPE_ENEMY_ROW = 68;

function _awdjooTwSc(){
  const tw=8, th=8, sc=(typeof TILED_WORLD_SCALE!=='undefined'?TILED_WORLD_SCALE:4);
  return {tw,th,sc};
}

function _isAwdjooCampaignMap(){
  if(typeof WW==='number'&&WW>=3000) return true;
  return typeof _mapApplied!=='undefined'&&_mapApplied;
}

/** Exit gate on the east side of house 5 (street level). */
function _setupAwdjooCampaignGoal(){
  if(typeof _mapApplied==='undefined'||!_mapApplied) return;
  const {tw,sc}= _awdjooTwSc();
  const h=typeof WH!=='undefined'?WH:3200;
  GOALPL={x:AWdjoo_HOUSE5_GOAL_COL*tw*sc, y:0, w:tw*sc*2, h};
}

function _awdjooMindAt(col, row, patrolHalf, kit){
  const {tw,th,sc}=_awdjooTwSc();
  const cx=(col+0.5)*tw*sc;
  let feet=row*th*sc;
  if(typeof gridStandY==='function'){
    const s=gridStandY(cx, feet+8, {maxUp:32, maxDrop:80});
    if(s!=null) feet=s;
  }
  const existing=(_mapEnemyDefs||[]).find(e=>e&&(e.col===col||Math.abs((e.x||0)-cx)<36));
  const mn=Math.floor(cx-patrolHalf), mx=Math.floor(cx+patrolHalf);
  if(existing){
    existing.x=Math.floor(cx);
    existing.y=feet;
    existing.row=row;
    existing.col=col;
    existing.mn=mn;
    existing.mx=mx;
    if(kit) existing.kit=kit.slice();
    return existing;
  }
  if(typeof _dispatchMindSpawnAt!=='function') return null;
  const head=feet-(typeof FEET_OFF!=='undefined'?FEET_OFF:88)
    +(typeof _spawnHeadTopDy==='function'?_spawnHeadTopDy():-24);
  _dispatchMindSpawnAt(cx, head, row, col, 100, tw, sc);
  const last=_mapEnemyDefs[_mapEnemyDefs.length-1];
  if(last){ last.y=feet; last.x=Math.floor(cx); last.mn=mn; last.mx=mx; if(kit) last.kit=kit.slice(); }
  return last;
}

/** First mind (slope crest, west of House 2): laser only. */
function _ensureAwdjooSlopeEnemy(){
  _awdjooMindAt(AWdjoo_SLOPE_ENEMY_COL, AWdjoo_SLOPE_ENEMY_ROW, 120, [0]);
}

/** Second mind on House 1's roof: grappling hook only. */
function _ensureAwdjooLeftHouseEnemy(){
  _awdjooMindAt(AWdjoo_HOUSE1_ENEMY_COL, AWdjoo_HOUSE1_ENEMY_ROW, 90, [1]);
}

/**
 * Dirt island that patrols between House 1 (west) and House 3 (east of
 * House 2). Floats in the sky — hook range from the street / slope (CMAX=400).
 */
function _ensureAwdjooMovingIsland(){
  if(!_isAwdjooCampaignMap()) return;
  if(typeof APLAT==='undefined') return;
  if(typeof _battleTestMode!=='undefined'&&_battleTestMode) return;
  if(typeof _runTestMode!=='undefined'&&_runTestMode) return;
  for(let i=APLAT.length-1;i>=0;i--) if(APLAT[i]&&APLAT[i]._awdjooIsland) APLAT.splice(i,1);
  const {tw,th,sc}=_awdjooTwSc();
  const w=tw*sc*6;
  const h=th*sc;
  const roof=544*sc;
  const hookReach=(typeof CMAX==='undefined'?400:CMAX);
  // House 1 roof is 2176; sit ~230px above it so the hook (400) still reaches from the street.
  const y=Math.round(roof-Math.min(232, hookReach*0.58));
  const mn=80*sc;
  const mx=328*sc;
  const x=Math.floor((mn+mx-w)*0.5);
  APLAT.push({x, y, w, h, dx:1.55, mn, mx, _awdjooIsland:true, _roofY:roof});
}

/** Guaranteed RCA pickup in house-2 basement (Tiled object id 16 @ 240,680). */
function _ensureAwdjooRcaPickup(){
  if(typeof _mapApplied==='undefined'||!_mapApplied) return;
  const {tw,th,sc}=_awdjooTwSc();
  const r=_ropePickupFromObject({
    x:240, y:680,
    polyline:[{x:0,y:0},{x:0,y:-2},{x:2,y:-2},{x:2,y:0},{x:0,y:0}],
    id:16,
  }, tw, th, sc);
  r._trustedRca=true;
  r._objectId=16;
  _mapRopePickup=r;
}

function _awdjooLevelSnapshot(){
  const r=typeof _mapRopePickup!=='undefined'?_mapRopePickup:null;
  const island=(typeof APLAT!=='undefined'?APLAT:[]).find(a=>a&&a._awdjooIsland);
  return {
    spawnCol:AWdjoo_HOUSE2_SPAWN_COL,
    spawnRow:AWdjoo_HOUSE2_SPAWN_ROW,
    rca:!!(r&&!r.got),
    rcaX:r?Math.round(r.x+r.w/2):null,
    rcaY:r?Math.round(r.y+r.h/2):null,
    goalX:typeof GOALPL!=='undefined'&&GOALPL.x!=null?Math.round(GOALPL.x):null,
    knowls:typeof kTotal!=='undefined'?kTotal:0,
    goalOpen:!!goalOpen,
    win:!!win,
    leftHouseEnemy:!!(_mapEnemyDefs||[]).some(e=>e&&e.col===AWdjoo_HOUSE1_ENEMY_COL),
    island:!!island,
  };
}

// Legacy names used by selftest / boot
function _setupAwdjooDemoGoal(){ _setupAwdjooCampaignGoal(); }
function _demoSnapshot(){ return _awdjooLevelSnapshot(); }
