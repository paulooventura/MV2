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

function _awdjooTwSc(){
  const tw=8, th=8, sc=(typeof TILED_WORLD_SCALE!=='undefined'?TILED_WORLD_SCALE:4);
  return {tw,th,sc};
}

/** Exit gate on the east side of house 5 (street level). */
function _setupAwdjooCampaignGoal(){
  if(typeof _mapApplied==='undefined'||!_mapApplied) return;
  const {tw,sc}= _awdjooTwSc();
  const h=typeof WH!=='undefined'?WH:3200;
  GOALPL={x:AWdjoo_HOUSE5_GOAL_COL*tw*sc, y:0, w:tw*sc*2, h};
}

/** Mind enemy on the left-slope crest (west of House 2). */
function _ensureAwdjooSlopeEnemy(){
  const col=17, row=68;
  const {tw,th,sc}=_awdjooTwSc();
  const cx=(col+0.5)*tw*sc;
  let feet=row*th*sc;
  if(typeof gridStandY==='function'){
    const s=gridStandY(cx, feet+4, {maxUp:24, maxDrop:80});
    if(s!=null) feet=s;
  }
  const left=(_mapEnemyDefs||[]).filter(e=>e&&e.x<900);
  if(left.length){
    const e=left[0];
    e.x=Math.floor(cx);
    e.y=feet;
    e.row=row;
    e.col=col;
    e.mn=Math.floor(cx-140);
    e.mx=Math.floor(cx+140);
    return;
  }
  if(typeof _dispatchMindSpawnAt!=='function') return;
  const head=feet-(typeof FEET_OFF!=='undefined'?FEET_OFF:88)
    +(typeof _spawnHeadTopDy==='function'?_spawnHeadTopDy():-24);
  _dispatchMindSpawnAt(cx, head, row, col, 100, tw, sc);
  const last=_mapEnemyDefs[_mapEnemyDefs.length-1];
  if(last){ last.y=feet; last.x=Math.floor(cx); }
}

/** Guaranteed RCA pickup in house-2 basement (Tiled object id 16 @ 240,680). */
function _ensureAwdjooRcaPickup(){
  if(typeof _mapApplied==='undefined'||!_mapApplied) return;
  const {tw,th,sc}= _awdjooTwSc();
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
  };
}

// Legacy names used by selftest / boot
function _setupAwdjooDemoGoal(){ _setupAwdjooCampaignGoal(); }
function _demoSnapshot(){ return _awdjooLevelSnapshot(); }
