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
