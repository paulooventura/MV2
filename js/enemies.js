// ============================================================
//  Mind & Venture — enemies.js
//  All enemy types (minions + Mind-clone rivals + Signol),
//  battle-test system, Knowl droplets, BG particles, crates,
//  breakable walls, and combat constants.
//
//  Depends on: physics helpers (ov, playerCoreHB, allP,
//  _resolveActorPlatY, _snapSpawnToSolid, _surfaceYAt),
//  GRAV, WW, WH, SW, SH, FEET_OFF, STAND_H, PLAYER_HIT_DMG,
//  p, fr, ESHOTS, PFXS, spawnHitBurst, applyPlayerHit,
//  sfx, uiShowToast, _gameState, _battleTestMode,
//  _zoneIdx, _mapApplied, MV2_VISUAL, smsProcessPixelArt
// ============================================================

// ── Combat constants ─────────────────────────────────────────
const PLAYER_MAX_HP   = 100;
const PLAYER_HIT_DMG  = 20;
const MAXLIVES        = 5;   // HP segments displayed (100 / 20)
const ENM_DMG = {punch:15, punchCharged:35, laser:22, laserCharged:55, stomp:25, hook:20};
const KB_PLAYER_H=5.8,  KB_PLAYER_V=-2.6;
const KB_ENEMY_H =4.4,  KB_ENEMY_V =-1.6;
const KB_PUNCH_PLAYER_RECOIL=3.2, KB_PUNCH_ENEMY_RECOIL=2.4;

// Breakable-wall damage table (also used by weapons.js)
const BWALL_RED_GID   = 242; // omniblock push/destruct frame (firstgid 238 + 4)
const RED_BWALL_HP    = 100;
const RED_BWALL_DMG   = {punch:35, punchCharged:75, laser:52, laserCharged:105};

// ── Enemy shape stats ────────────────────────────────────────
const _ENEMY_SHAPE_HP  = {ball:80, square:100, triangle:150, star:200};
const _ENEMY_SHAPE_SPD = {ball:0.75, square:1.0, triangle:1.25, star:1.45};
const MINION_HP              = 50;
const ENEMY_SHUTDOWN_FRAMES  = 54;
const MIND_REBOOT_COOLDOWN_MS= 5000;
const MIND_REBOOT_FILL_FR    = 90;
const MIND_BATTLE_HP = {ball:18, square:24, triangle:30, star:36};
function _mindEnemyMhp(shape, battle){
  return battle ? (MIND_BATTLE_HP[shape]??40) : (_ENEMY_SHAPE_HP[shape]??80);
}

// Rival minion spawning
const RIVAL_MINION_FIRST_CD   = 90;
const RIVAL_MINION_RESPAWN_CD = 240;
const RIVAL_MINION_TYPES      = ['circle','square','flyer'];

// ── Signol constants ─────────────────────────────────────────
const SIGNOL_R            = 32;
const SIGNOL_D            = SIGNOL_R*2;
const SIGNOL_AGGRO_RANGE  = 300;
const SIGNOL_CHARGE_FR    = 120;
const SIGNOL_FRAG_COUNT   = 6;
const SIGNOL_FRAG_STOP_FADE = 300;
const SIGNOL_FRAG_DMG     = 18;
const SIGNOL_HP           = 40;
const SIGNOL_SPR = {img:null, ready:false, fw:16, fh:16, frames:6, cols:6};
(function _loadSignolSpr(){
  const paths=[
    'assets/home baked sprites/sine/SINE.gif',
    'assets/home baked sprites/sine/SINE.png',
    'assets/enemies/signol.png',
  ];
  let i=0;
  const next=()=>{
    if(i>=paths.length){ console.warn('MV: Signol sprite missing — using procedural Signol'); SIGNOL_SPR.ready=false; return; }
    const img=new Image();
    if(location.protocol!=='file:') img.crossOrigin='anonymous';
    img.onload=()=>{
      if(img.width>=48&&img.height>=16){
        SIGNOL_SPR.fw=16; SIGNOL_SPR.fh=16;
        SIGNOL_SPR.frames=Math.max(1,Math.floor(img.width/16));
        SIGNOL_SPR.cols=SIGNOL_SPR.frames;
      }else if(img.width>=32&&img.height>=32){
        SIGNOL_SPR.fw=img.width>>1; SIGNOL_SPR.fh=img.height>>1;
        SIGNOL_SPR.frames=4; SIGNOL_SPR.cols=2;
      }else{
        SIGNOL_SPR.fw=img.width; SIGNOL_SPR.fh=img.height;
        SIGNOL_SPR.frames=1; SIGNOL_SPR.cols=1;
      }
      SIGNOL_SPR.img=MV2_VISUAL?img:smsProcessPixelArt(img);
      SIGNOL_SPR.ready=true;
      console.info('MV: Signol sprite loaded',paths[i-1],img.width+'x'+img.height,SIGNOL_SPR.frames+'f');
    };
    img.onerror=()=>{ i++; next(); };
    img.src=encodeURI(paths[i++]).replace(/#/g,'%23');
  };
  next();
})();

// ── World data arrays ─────────────────────────────────────────
let ENEMS  = [];
let CRATES = [];
let BWALLS = [], _mapBWalls = [];
let KDROP  = [];
let ESHOTS = [];
let PFXS   = [];
let kTotal = 3, kColl = 0, goalOpen = false;

// ── Knowl seed definitions (fallback when Tiled map not loaded) ─
let KDEFS = [
  {x:180,y:390}, {x:240,y:390}, {x:680,y:120},
];

// ── Crate definitions ────────────────────────────────────────
const CRATE_DEF = [];

// ── Breakable-wall definitions ────────────────────────────────
const BWALL_DEF=[
  {x:330,  y:740, w:10,  h:100, hp:3, maxHp:3, label:'BASEMENT DOOR',  col:'#5a3010'},
  {x:548,  y:642, w:34,  h:198, hp:4, maxHp:4, label:'HOUSE DOOR',      col:'#4b2814'},
  {x:1602, y:662, w:34,  h:178, hp:4, maxHp:4, label:'BUILDING DOOR',   col:'#3b1f10'},
  {x:2960, y:520, w:200, h:320, hp:7, maxHp:7, label:'FINAL BARRIER',   col:'#1a0040'},
];

// ── BG atmosphere particles ───────────────────────────────────
const BATS = Array.from({length:8},()=>({
  x:Math.random()*800, y:Math.random()*400+50,
  vx:(Math.random()-0.5)*1.8, vy:(Math.random()-0.5)*0.6,
  wingPhase:Math.random()*Math.PI*2, wingSpd:0.18+Math.random()*0.12,
  size:4+Math.random()*3
}));
const DRIPS = Array.from({length:20},()=>({
  x:Math.random()*800, y:Math.random()*200,
  vy:1.2+Math.random()*2, active:Math.random()>0.5,
  timer:Math.random()*80|0, splashF:0
}));
const STREAMS = Array.from({length:5},()=>({
  x:150+Math.random()*500|0, y:30+Math.random()*100|0,
  pts:[], h:120+Math.random()*180|0, wobble:Math.random()*Math.PI*2
}));

// ── Test chamber geometry ─────────────────────────────────────
let _battleTestMode = false, _runTestMode = false;

const TEST_TR=[
  [0,520,800,40,'solid'],[0,0,800,20,'solid'],[0,0,20,560,'solid'],[780,0,20,560,'solid'],
  [100,100,120,14,'oneway'],[350,80,120,14,'oneway'],[580,100,120,14,'oneway'],
  [80,280,100,14,'oneway'],[620,280,100,14,'oneway'],[300,340,140,14,'oneway'],
  [150,430,450,14,'ceil'],[150,444,60,36,'solid'],[540,444,60,36,'solid'],
];
const TEST_CRATES=[
  {x:260,y:490,w:30,h:30},{x:300,y:490,w:30,h:30},
  {x:460,y:490,w:30,h:30},{x:500,y:490,w:30,h:30},{x:260,y:460,w:30,h:30},
];
const TEST_ENEMS=[
  {x:450,y:498,mn:220,mx:560,spd:.9,dir:1,hp:5,mhp:5},
  {x:200,y:498,mn:80,mx:320,spd:.8,dir:-1,hp:3,mhp:3},
];
const TEST_MPLAT=[{x:300,y:200,w:120,h:14,vx:0,minX:100,maxX:580}];
const TEST_APLAT=[{x:220,y:200,w:100,h:12,dx:1.4,mn:80,mx:620}];

// ── Battle test arena ─────────────────────────────────────────
const BATTLE_ARENA_TR=[
  [0,520,960,48,'solid'],[0,0,960,24,'solid'],
  [0,0,24,544,'solid'],[936,0,24,544,'solid'],
  [120,380,140,14,'oneway'],[380,320,140,14,'oneway'],[640,380,140,14,'oneway'],
  [260,260,120,14,'oneway'],[520,220,120,14,'oneway'],
];
const RUN_TEST_TR=[
  [0,520,3200,48,'solid'],[0,0,3200,20,'solid'],
  [0,0,20,544,'solid'],[3180,0,20,544,'solid'],
  [280,508,56,12,'solid'],[420,508,40,12,'solid'],[560,506,72,14,'solid'],
  [720,508,48,12,'solid'],[900,504,36,16,'solid'],
  [1080,504,44,16,'solid'],[1240,500,36,20,'solid'],[1400,504,60,16,'solid'],
  [1580,508,34,12,'solid'],[1614,496,34,24,'solid'],[1648,484,34,36,'solid'],
  [1760,508,120,12,'solid'],[1960,510,140,10,'solid'],[2180,506,100,14,'solid'],
  [2380,502,80,18,'solid'],[2580,508,64,12,'solid'],[2644,496,64,24,'solid'],
  [2708,484,64,36,'solid'],[2800,508,200,12,'solid'],
  [3060,508,40,12,'solid'],[3120,504,32,16,'solid'],
];
const BATTLE_PLAYER_X       = 80;
const BATTLE_RIVAL_X        = 480;
const BATTLE_FEET_Y         = 520;
const BATTLE_RANDOM_SPAWN_ZONE = {x:200,y:488,w:96,h:40};
const BATTLE_MIND_SHAPES    = ['ball','square','triangle','star'];
const BATTLE_MIND_SPD       = {ball:1.05,square:1.35,triangle:1.55,star:1.75};
const BATTLE_SPAWN_DEFS     = [
  {shape:'ball',    x:480, spd:1.05},
  {shape:'square',  x:480, spd:1.35},
  {shape:'triangle',x:480, spd:1.55},
  {shape:'star',    x:480, spd:1.75},
];
const BATTLE_RESPAWN_MS = 5000;
let _battleTestRound=0, _battleTestKills=0, _battleTestDeaths=0;
let _battleRespawnAt=0, _battleRandomZoneIn=false;

// ── Helpers ───────────────────────────────────────────────────
function _clearBattleRespawnTimer(){ _battleRespawnAt=0; }
function _battleWaitingRespawn(){ return _battleRespawnAt>0&&Date.now()<_battleRespawnAt; }
function _battleRespawnSecsLeft(){
  if(!_battleWaitingRespawn()) return 0;
  return Math.max(1,Math.ceil((_battleRespawnAt-Date.now())/1000));
}
function _purgeBattleRivals(){
  for(let i=ENEMS.length-1;i>=0;i--){
    if(ENEMS[i]._battleAi||ENEMS[i]._battleSignol) ENEMS.splice(i,1);
  }
}
function _purgeMinions(){
  for(let i=ENEMS.length-1;i>=0;i--){
    const e=ENEMS[i];
    if(e.mind||e.type==='signol') continue;
    ENEMS.splice(i,1);
  }
}
function _legacyEnemyShape(t){
  if(t==='circle') return 'ball';
  if(t==='flyer')  return 'triangle';
  if(t==='ball'||t==='square'||t==='triangle'||t==='star') return t;
  return 'ball';
}
function _fistHitsHB(fx,fy,fw,fh,hb){ return ov(fx,fy,fw,fh,hb.x,hb.y,hb.w,hb.h); }
function _enemyCombatActive(e){ return !!(e&&e.alive); }
function _enemyRebootInterruptable(e){
  return !!(e&&e.mind&&!e.alive&&e._mindOff==='rebooting');
}
// Body still occupies space when powered down (mind off, minion shutdown, etc.)
function _enemyBodyPresent(e){
  if(!e) return false;
  if(e.alive) return true;
  if(e.mind&&e._mindOff) return true;
  if(e.type==='signol') return e.signolState!=='dead';
  if(!e.mind&&e.type!=='signol') return true;
  return false;
}
function _enemyPunchable(e){
  return _enemyCombatActive(e)||_enemyRebootInterruptable(e)||
    !!(e&&e.mind&&!e.alive&&e._mindOff)||
    !!(e&&!e.mind&&e.type!=='signol'&&!e.alive);
}
function _nudgeEnemyBody(e,nx,ny){
  if(!e||!_enemyBodyPresent(e)) return;
  if(e.mn!=null) e.x=Math.max(e.mn,Math.min(e.mx-e.w,e.x+nx));
  else e.x=Math.max(0,Math.min(WW-e.w,e.x+nx));
  e.y+=ny;
  if(!e.alive){
    if(e._offAnchorX!=null){ e._offAnchorX=e.x; e._offAnchorY=e.y; }
    e.hitF=Math.max(e.hitF||0,10);
  }
}
function _nudgeSignol(e,nx,ny){
  if(!e||e.type!=='signol'||!_enemyBodyPresent(e)) return;
  e.x+=nx;
  if(e.mn!=null) e.x=Math.max(e.mn,Math.min(e.mx-e.w,e.x));
  else e.x=Math.max(0,Math.min(WW-e.w,e.x));
  e.y+=ny;
  e._itemForceF=Math.max(e._itemForceF||0,14);
  e.hitF=Math.max(e.hitF||0,8);
}
function _applyItemForceToEnemy(e,fx,fy){
  if(!_enemyBodyPresent(e)) return;
  if(e.type==='signol'){
    _nudgeSignol(e,fx*3.4,fy*2.0);
    if(e.alive){ e.vx=(e.vx||0)+fx*0.55; e.vy=(e.vy||0)+fy*0.35; }
    return;
  }
  if(e.alive){
    e.vx=(e.vx||0)+fx; e.vy=(e.vy||0)+fy;
    _markEnemyItemForce(e);
  }else{
    _nudgeEnemyBody(e,fx*2.8,fy*1.4);
  }
}
function _shotHitsEnemy(sx,sy,sw,sh,e){
  const hb=_enemyItemHB(e);
  if(hb.w<=0||hb.h<=0) return false;
  return ov(sx,sy,sw,sh,hb.x,hb.y,hb.w,hb.h);
}

// ── Knock / impact helpers ────────────────────────────────────
function _knockScaleFromDmg(dmg,base=PLAYER_HIT_DMG){
  return Math.max(0.4,Math.sqrt(Math.max(1,dmg)/base));
}
function _knockVecFrom(destX,destY,srcX,srcY,hStr,vLift){
  const dx=destX-srcX, dy=destY-srcY, d=Math.hypot(dx,dy)||1;
  return {x:(dx/d)*hStr, y:vLift+(dy/d)*hStr*0.15};
}
function _applyPunchImpact(attacker,defender,angle,opts={}){
  const charged=!!opts.charged;
  const ux=Math.cos(angle), uy=Math.sin(angle);
  const pRecoil=charged?KB_PUNCH_PLAYER_RECOIL*1.35:KB_PUNCH_PLAYER_RECOIL;
  const mind=defender&&defender.mind;
  const eBump=mind?(charged?4.6:3.2):(charged?2.9:2.1);
  if(attacker&&attacker.vx!=null){
    attacker.vx=(attacker.vx||0)-ux*pRecoil;
    attacker.vy=(attacker.vy||0)-uy*(pRecoil*0.35);
    if(attacker._pRecoil!=null) attacker._pRecoil=Math.max(attacker._pRecoil||0,charged?12:8);
  }
  if(defender&&_enemyBodyPresent(defender)){
    if(defender.alive&&defender.vx!=null){
      defender.vx=(defender.vx||0)+ux*eBump;
      defender.vy=(defender.vy||0)+uy*(eBump*0.42);
      defender._kbF=Math.max(defender._kbF||0,mind?16:12);
    }else{
      _nudgeEnemyBody(defender,ux*eBump*3.2,uy*eBump*1.6);
    }
  }
}
function _enemyHitKnock(e,fromX,fromY,dmg,kbScale=1){
  if(!e||!e.alive) return;
  const mind=!!e.mind;
  const signol=e.type==='signol';
  const ecx=signol?_signolCenter(e).cx:e.x+e.w/2;
  const ecy=signol?_signolCenter(e).cy:e.y+e.h/2;
  const sc=_knockScaleFromDmg(dmg)*(kbScale||1);
  const k=_knockVecFrom(ecx,ecy,fromX,fromY,
    KB_ENEMY_H*sc*(mind?1.35:signol?1.15:1), KB_ENEMY_V*sc*(mind?1.2:signol?1.1:1));
  e.vx=(e.vx||0)*0.42+k.x;
  e.vy=(e.vy||0)*0.35+k.y;
  e.vx=Math.max(-7.5,Math.min(7.5,e.vx));
  e.vy=Math.max(-5,Math.min(4,e.vy));
  e._kbF=Math.max(e._kbF||0,mind?14:signol?12:10);
}
function _markEnemyItemForce(e,frames=14){
  if(!_enemyBodyPresent(e)) return;
  e._itemForceF=Math.max(e._itemForceF||0,frames);
}
function _enemyItemHB(e){
  if(!_enemyBodyPresent(e)) return {x:0,y:0,w:0,h:0};
  if(e.mind) return playerCoreHB(e);
  if(e.type==='signol'){
    const sc=_signolCenter(e);
    return {x:sc.cx-e.r,y:sc.cy-e.r,w:e.r*2,h:e.r*2};
  }
  return {x:e.x,y:e.y,w:e.w,h:e.h};
}
function _enemyHookHB(e){ return _enemyItemHB(e); }
function _playerHitKnock(kx,ky,dmg=PLAYER_HIT_DMG){
  const sc=_knockScaleFromDmg(dmg);
  p.vx=Math.max(-11,Math.min(11,(p.vx||0)*0.28+kx*sc));
  p.vy=Math.max(-9,Math.min(9,(p.vy||0)*0.28+ky*sc));
}
function applyPlayerHitFromEnemy(e,dmg=PLAYER_HIT_DMG){
  const sc=_knockScaleFromDmg(dmg);
  const ecx=e.type==='signol'?_signolCenter(e).cx:e.x+e.w/2;
  const ecy=e.type==='signol'?_signolCenter(e).cy:e.y+e.h/2;
  const k=_knockVecFrom(p.x+SW/2,p.y+FEET_OFF-STAND_H*0.45,ecx,ecy,KB_PLAYER_H*sc,KB_PLAYER_V*sc);
  applyPlayerHit(k.x,k.y,dmg);
}

// ── Body separation ───────────────────────────────────────────
const BODY_SEP_GAP=6;
function _enemySeparationHB(e){
  if(!_enemyBodyPresent(e)) return {x:0,y:0,w:0,h:0};
  if(e.mind) return actorSeparationHB(e);
  if(e.type==='signol'){
    const sc=_signolCenter(e);
    const pad=4;
    return {x:sc.cx-e.r-pad,y:sc.cy-e.r-pad,w:(e.r+pad)*2,h:(e.r+pad)*2};
  }
  const pad=4;
  return {x:e.x-pad,y:e.y-pad,w:e.w+pad*2,h:e.h+pad*2};
}
function _horizBodyGap(pl,e){
  const ph=actorSeparationHB(pl), eh=_enemySeparationHB(e);
  if(ph.x+ph.w<=eh.x) return eh.x-(ph.x+ph.w);
  if(eh.x+eh.w<=ph.x) return ph.x-(eh.x+eh.w);
  return -Math.min(ph.x+ph.w-eh.x,eh.x+eh.w-ph.x);
}
function _actorsOverlap(pl,e){
  if(!pl||!_enemyBodyPresent(e)) return false;
  const ph=actorSeparationHB(pl), eh=_enemySeparationHB(e);
  return ov(ph.x,ph.y,ph.w,ph.h,eh.x,eh.y,eh.w,eh.h);
}
function _bodySepMomentum(actor,axis){
  if(!actor) return 0.05;
  const v=axis==='x'?(actor.vx||0):(actor.vy||0);
  const mom=typeof actor.momentum==='number'?actor.momentum:0;
  const walk=typeof MOVE_WALK!=='undefined'?MOVE_WALK:7;
  const spd=typeof actor.spd==='number'?actor.spd:0;
  return Math.max(0.05,Math.abs(v)+mom*walk*0.42+spd*0.35);
}
function _separateTwoBodyHB(ax,ay,aw,ah,bx,by,bw,bh,aActor,bActor){
  if(!ov(ax,ay,aw,ah,bx,by,bw,bh)) return null;
  const overlapX=Math.min(ax+aw,bx+bw)-Math.max(ax,bx);
  const overlapY=Math.min(ay+ah,by+bh)-Math.max(ay,by);
  if(overlapX<=0||overlapY<=0) return null;
  const gap=typeof BODY_SEP_GAP!=='undefined'?BODY_SEP_GAP:6;
  if(overlapX<=overlapY){
    const push=overlapX+gap;
    const aM=_bodySepMomentum(aActor,'x'), bM=_bodySepMomentum(bActor,'x');
    const total=Math.max(0.1,aM+bM);
    const aMid=ax+aw*0.5, bMid=bx+bw*0.5;
    const aFrac=bM/total, bFrac=aM/total;
    return aMid<=bMid?{ax:-push*aFrac,bx:push*bFrac}:{ax:push*aFrac,bx:-push*bFrac};
  }
  const push=overlapY+gap;
  const aM=_bodySepMomentum(aActor,'y'), bM=_bodySepMomentum(bActor,'y');
  const total=Math.max(0.1,aM+bM);
  const aMid=ay+ah*0.5, bMid=by+bh*0.5;
  const aFrac=bM/total, bFrac=aM/total;
  return aMid<=bMid?{ay:-push*aFrac,by:push*bFrac}:{ay:push*aFrac,by:-push*bFrac};
}
function _applyBodySeparation(pl,e,sep){
  if(!sep) return false;
  let moved=false;
  if(sep.ax){ pl.x+=sep.ax; pl.x=Math.max(0,Math.min(WW-SW,pl.x)); moved=true; }
  if(sep.ay){ pl.y+=sep.ay; moved=true; }
  if(sep.bx){
    e.x+=sep.bx;
    if(e.mn!=null) e.x=Math.max(e.mn,Math.min(e.mx-e.w,e.x));
    else e.x=Math.max(0,Math.min(WW-e.w,e.x));
    if(!e.alive&&e._offAnchorX!=null){ e._offAnchorX=e.x; e._offAnchorY=e.y; }
    moved=true;
  }
  if(sep.by){
    e.y+=sep.by;
    if(!e.alive&&e._offAnchorX!=null){ e._offAnchorX=e.x; e._offAnchorY=e.y; }
    moved=true;
  }
  return moved;
}
function _resolvePlayerEnemySeparation(pl,e,maxPasses=12){
  if(!pl||!_enemyBodyPresent(e)) return;
  for(let n=0;n<maxPasses;n++){
    const ph=actorSeparationHB(pl);
    const eh=_enemySeparationHB(e);
    const sep=_separateTwoBodyHB(ph.x,ph.y,ph.w,ph.h,eh.x,eh.y,eh.w,eh.h,pl,e);
    if(!sep) break;
    _applyBodySeparation(pl,e,sep);
  }
}
function _resolveAllPlayerEnemyCollisions(pl){
  if(!pl) return;
  for(let round=0;round<14;round++){
    for(const e of ENEMS){
      if(!_enemyBodyPresent(e)) continue;
      if(e.type==='signol'){ _resolvePlayerSignolSeparation(pl,e); continue; }
      if(_actorsOverlap(pl,e)) _resolvePlayerEnemySeparation(pl,e,8);
    }
    _resolveMindEnemiesSeparation();
    if(!ENEMS.some(e=>_enemyBodyPresent(e)&&_actorsOverlap(pl,e))) break;
  }
}
function _checkPlayerEnemyBodyDamage(pl){
  if(!pl||_shutdownTimer>0) return;
  for(const e of ENEMS){
    if(!e.alive||e.mind) continue;
    const ph=playerCoreHB(pl);
    const eh=_enemyItemHB(e);
    if(ov(ph.x,ph.y,ph.w,ph.h,eh.x,eh.y,eh.w,eh.h)) applyPlayerHitFromEnemy(e);
  }
}
function _resolveMindEnemiesSeparation(){
  const minds=ENEMS.filter(en=>en.mind&&en.alive);
  for(let i=0;i<minds.length;i++){
    for(let j=i+1;j<minds.length;j++){
      const a=minds[i], b=minds[j];
      for(let n=0;n<6;n++){
        const ha=actorSeparationHB(a), hb=actorSeparationHB(b);
        const sep=_separateTwoBodyHB(ha.x,ha.y,ha.w,ha.h,hb.x,hb.y,hb.w,hb.h,a,b);
        if(!sep) break;
        if(sep.ax){ a.x+=sep.ax; if(a.mn!=null) a.x=Math.max(a.mn,Math.min(a.mx-a.w,a.x)); }
        if(sep.ay) a.y+=sep.ay;
        if(sep.bx){ b.x+=sep.bx; if(b.mn!=null) b.x=Math.max(b.mn,Math.min(b.mx-b.w,b.x)); }
        if(sep.by) b.y+=sep.by;
      }
    }
  }
}

// ── Minion factory ────────────────────────────────────────────
function _mkMinion(x,y,type,opts={}){
  const w=type==='circle'?58:type==='flyer'?66:72;
  const h=type==='flyer'?46:(type==='circle'?58:72);
  const range=opts.range??130;
  return {
    rank:'minion', mind:false,
    x:Math.floor(x-w/2), y:Math.floor(y-h),
    mn:opts.mn??Math.floor(x-range), mx:opts.mx??Math.floor(x+range),
    spd:opts.spd??(type==='square'?1.1:type==='flyer'?0.9:0.6),
    dir:opts.dir??(Math.random()<0.5?-1:1),
    hp:opts.hp??MINION_HP, mhp:opts.mhp??opts.hp??MINION_HP,
    type, w, h, alive:true, hitF:0, vx:0, vy:0, og:false,
    shotCd:120, jumpCd:0, grenades:[],
    shutF:0, _shutSettled:false,
  };
}

// ── Signol (rolling grenadier) ────────────────────────────────
function _signolCenter(e){ return {cx:e.x+e.r, cy:e.y+e.r}; }
function _mkSignol(cx,feetY,opts={}){
  const r=SIGNOL_R, top=feetY-SIGNOL_D;
  return {
    type:'signol', rank:'enemy', mind:false,
    x:Math.floor(cx-r), y:Math.floor(top), w:SIGNOL_D, h:SIGNOL_D, r,
    mn:opts.mn??Math.floor(cx-160), mx:opts.mx??Math.floor(cx+160),
    spd:opts.spd??0.78, dir:opts.dir??(Math.random()<0.5?-1:1),
    hp:opts.hp??SIGNOL_HP, mhp:opts.mhp??opts.hp??SIGNOL_HP,
    alive:true, hitF:0, vx:0, vy:0, og:true,
    wheelAngle:0, shutF:0, _shutSettled:false,
    signolState:'roll', chargeT:0,
    _battleSignol:!!opts.battle,
    grenades:[],
  };
}
function _signolFragFlamePfx(x,y){
  PFXS.push({x:x+(Math.random()-0.5)*5,y:y+(Math.random()-0.5)*5,
    vx:(Math.random()-0.5)*0.8,vy:-0.6-Math.random()*1.2,
    life:7+Math.random()*6|0,maxLife:13,r:1.2+Math.random()*1.8,
    col:Math.random()<0.5?'#ff5500':'#ffcc33'});
}
function _signolFragSmokePfx(x,y){
  for(let i=0;i<7;i++){
    PFXS.push({x:x+(Math.random()-0.5)*8,y:y+(Math.random()-0.5)*6,
      vx:(Math.random()-0.5)*1.4,vy:-0.5-Math.random()*1.6,
      life:16+Math.random()*14|0,maxLife:30,r:2+Math.random()*3.5,
      col:Math.random()<0.5?'#666':'#999'});
  }
}
function _spawnSignolFrags(cx,cy){
  for(let i=0;i<SIGNOL_FRAG_COUNT;i++){
    const ang=i*(Math.PI*2/SIGNOL_FRAG_COUNT)+(Math.random()-0.5)*0.12;
    const spd=4.2+Math.random()*1.8;
    ESHOTS.push({x:cx,y:cy,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-3.4,
      type:'signol_frag',life:9999,born:fr,stopFr:0,settled:false,
      col:'#ff6600',r:5,bounces:0,power:1.1});
  }
  for(let pi=0;pi<10;pi++){
    const a=Math.random()*Math.PI*2, sp=2+Math.random()*4;
    PFXS.push({x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,
      life:16+Math.random()*10|0,maxLife:26,r:2+Math.random()*2,col:'#ffaa44'});
  }
  sfx('stomp');
}
function _signolExplode(e){
  if(e.signolState==='dead') return;
  const c=_signolCenter(e);
  _spawnSignolFrags(c.cx,c.cy);
  e.signolState='dead'; e.alive=false;
  e.shutF=ENEMY_SHUTDOWN_FRAMES; e._shutSettled=false;
  e.vx=0; e.vy=0; e.xlrOn=false; e.magOn=false;
  sfx('enemy_shut');
  if(_battleTestMode&&e._battleSignol) _onBattleSignolDefeated();
}
function _updateSignolFrag(s,i){
  const r=s.r||5;
  if(!s.settled){
    s.vy=Math.min((s.vy||0)+GRAV*0.62,14);
    const prevX=s.x, prevY=s.y;
    s.x+=s.vx||0; s.y+=s.vy||0;
    let grounded=false;
    for(const pl of allP()){
      if(pl.tp!=='solid') continue;
      if(!ov(s.x-r,s.y-r,r*2,r*2,pl.x,pl.y,pl.w,pl.h)) continue;
      const top=pl.y;
      if(s.vy>=0&&s.y+r>=top&&prevY+r<=top+10){
        s.y=top-r; s.vy=-(s.vy||0)*0.28; s.vx=(s.vx||0)*0.72; grounded=true;
      }else{
        const penL=(s.x+r)-pl.x, penR=(pl.x+pl.w)-(s.x-r);
        const penT=(s.y+r)-pl.y, penB=(pl.y+pl.h)-(s.y-r);
        const minPen=Math.min(penL,penR,penT,penB);
        if(minPen===penL){s.x=pl.x-r;s.vx=-Math.abs(s.vx||0)*0.55;}
        else if(minPen===penR){s.x=pl.x+pl.w+r;s.vx=Math.abs(s.vx||0)*0.55;}
        else if(minPen===penT){s.y=pl.y-r;s.vy=-Math.abs(s.vy||0)*0.35;}
        else{s.y=pl.y+pl.h+r;s.vy=Math.abs(s.vy||0)*0.25;}
        s.vx=(s.vx||0)*0.82; s.vy=(s.vy||0)*0.82;
      }
    }
    s.og=grounded;
    if(fr%3===0) _signolFragFlamePfx(s.x,s.y);
    if(Math.hypot(s.vx,s.vy)<0.32&&(s.og||fr-(s.born||fr)>45)){
      s.settled=true; s.stopFr=fr; s.vx=0; s.vy=0;
      _signolFragSmokePfx(s.x,s.y);
    }
  }else{
    if(fr-s.stopFr>SIGNOL_FRAG_STOP_FADE){
      _signolFragSmokePfx(s.x,s.y);
      ESHOTS.splice(i,1);
    }
  }
  const _pCoreS=playerCoreHB(p);
  if(_shutdownTimer<=0&&ov(s.x-r,s.y-r,r*2,r*2,_pCoreS.x,_pCoreS.y,_pCoreS.w,_pCoreS.h)){
    const dmg=SIGNOL_FRAG_DMG;
    const kx=(p.x+SW/2-s.x)*0.16, ky=-3.4;
    spawnHitBurst(s.x,s.y,s.vx,s.vy,'#ff6644',8);
    applyPlayerHit(kx,ky,dmg);
    _signolFragSmokePfx(s.x,s.y);
    ESHOTS.splice(i,1);
  }
}
function _updateSignol(e,pdist,pdx){
  if((e._itemForceF||0)>0) e._itemForceF--;
  if((e._kbF||0)>0) e._kbF--;
  const extForce=(e._itemForceF||0)>0||(e._kbF||0)>0;
  if(e.signolState==='charge'){
    if(extForce){
      e.x+=(e.vx||0); e.vx*=0.72;
      if(e.mn!=null) e.x=Math.max(e.mn,Math.min(e.mx-e.w,e.x));
    }else{ e.vx*=0.78; }
    e.vy=0; e.og=true;
    if(e.chargeT>0) e.chargeT--;
    else _signolExplode(e);
    return;
  }
  if(e.signolState!=='roll') return;
  if(!extForce){
    if(Math.abs(e.vx)<0.08) e.vx=e.spd*e.dir;
    if(e.x<=e.mn||e.x+e.w>=e.mx){e.dir*=-1;e.vx=e.spd*e.dir;}
  }
  if(pdist<SIGNOL_AGGRO_RANGE&&e.og&&!extForce){
    e.signolState='charge'; e.chargeT=SIGNOL_CHARGE_FR; e.vx=0;
  }
}
function _resolvePlayerSignolSeparation(pl,e){
  if(!pl||!e||!e.alive||e.type!=='signol') return;
  const sc=_signolCenter(e);
  const ph=actorSeparationHB(pl);
  const pcx=ph.x+ph.w*0.5, pcy=ph.y+ph.h*0.5;
  const dx=pcx-sc.cx, dy=pcy-sc.cy, d=Math.hypot(dx,dy)||1;
  const minD=e.r+Math.max(ph.w,ph.h)*0.42;
  if(d>=minD) return;
  const gap=typeof BODY_SEP_GAP!=='undefined'?BODY_SEP_GAP:6;
  const push=(minD-d)+gap;
  const pM=_bodySepMomentum(pl,'x')+_bodySepMomentum(pl,'y');
  const eM=_bodySepMomentum(e,'x')+_bodySepMomentum(e,'y');
  const total=Math.max(0.1,pM+eM);
  const pFrac=eM/total, eFrac=pM/total;
  pl.x+=dx/d*push*pFrac; pl.y+=dy/d*push*pFrac*0.22;
  e.x-=dx/d*push*eFrac;
  pl.x=Math.max(0,Math.min(WW-SW,pl.x));
  if(e.mn!=null) e.x=Math.max(e.mn,Math.min(e.mx-e.w,e.x));
}

// ── Mind-clone enemy factory ──────────────────────────────────
function _mkMindEnemy(shape,x,feetY,opts={}){
  const spd=opts.spd??_ENEMY_SHAPE_SPD[shape]??1;
  const battle=!!opts.battle;
  const hp=opts.hp??_mindEnemyMhp(shape,battle);
  const range=opts.range??160;
  return {
    rank:'enemy', mind:true, shape, type:shape,
    x:Math.floor(x-SW/2), y:Math.floor(feetY-FEET_OFF),
    w:SW, h:SH, vx:0, vy:0, og:false, fc:true, hero:'venture',
    wheelAngle:0, crouchAmt:0,
    aimDX:-1, aimDY:0, tAimDX:-1, tAimDY:0,
    pupilX:0, pupilY:0,
    pt:0, pCd:0, pDur:6, pCharging:false, pCharge:0, punchCd:0,
    laserCd:battle?35+Math.random()*25|0:70+Math.random()*40|0,
    laserCharge:0, laserCharging:false,
    jumpCd:battle?18:40, shotCd:0, inv:0, hitF:0,
    item:Math.floor(Math.random()*4),
    itemCd:battle?8+Math.random()*10|0:16+Math.random()*14|0,
    aiMode:'patrol',
    xlrOn:false, magOn:false, itemBurst:0, hookCd:0,
    hook:{st:'idle',ex:0,ey:0,ax:0,ay:0,len:0,maxLen:160},
    _lastItem:-1, _itemStreak:0,
    hp, mhp:hp, alive:true,
    spd, dir:-1,
    mn:opts.mn??Math.floor(x-range), mx:opts.mx??Math.floor(x+range),
    _hitDone:false, _pRecoil:0,
    _armPose:null, flashF:0,
    _battleAi:battle,
    _campaignAi:!!opts.campaignAi,
    grenades:[],
    minionCd:RIVAL_MINION_FIRST_CD,
    _spawnedMinion:null, _minionIdx:0,
    shutF:0, _mindOff:null,
    _offAnchorX:null, _offAnchorY:null,
    _cooldownEnd:0, _rebootFill:0,
  };
}

// ── Rival minion spawning ─────────────────────────────────────
function _rivalActiveMinion(e){ const m=e._spawnedMinion; return m&&m.alive?m:null; }
function _spawnRivalMinion(e){
  const side=e.fc?1:-1;
  const cx=e.x+SW/2+side*68;
  const feetY=_snapSpawnToSolid(cx,e.y+FEET_OFF);
  const type=RIVAL_MINION_TYPES[e._minionIdx%RIVAL_MINION_TYPES.length];
  e._minionIdx++;
  const m=_mkMinion(cx,feetY,type,{mn:e.mn,mx:e.mx,dir:side,spd:type==='square'?0.95:0.72});
  m._rival=e; ENEMS.push(m); e._spawnedMinion=m;
}
function _tickRivalMinionSpawn(e){
  if(!e.alive||!e.mind||e._battleAi) return;
  if(_rivalActiveMinion(e)) return;
  if(e.minionCd>0){e.minionCd--;return;}
  _spawnRivalMinion(e);
  e.minionCd=RIVAL_MINION_RESPAWN_CD;
}

// ── Mind-clone shutdown / reboot cycle ────────────────────────
function _updateMindEnemyShutFall(e){
  if(e._shutSettled) return;
  e._itemForceF=0; e._kbF=0;
  e.xlrOn=false; e.magOn=false;
  if(e.hook) e.hook.st='idle';
  e.vx=(e.vx||0)*0.9;
  e.vy=Math.min((e.vy||0)+GRAV*0.55,14);
  const prevFeet=e.y+FEET_OFF;
  e.x+=e.vx||0; e.y+=e.vy||0;
  if(e.mn!=null) e.x=Math.max(e.mn,Math.min(e.mx-e.w,e.x));
  else e.x=Math.max(0,Math.min(WW-e.w,e.x));
  _resolveActorPlatY(e,prevFeet,FEET_OFF);
  if(e.og){
    e._shutSettled=true; e.vx*=0.45; e.vy=0;
    if(!e._shutLean) e._shutLean=e.fc?0.14:-0.14;
    e._offAnchorX=e.x; e._offAnchorY=e.y;
  }else if(e.y+FEET_OFF>WH+80){
    const feetY=_surfaceYAt(e.x+e.w/2,e.y+FEET_OFF,160);
    e.y=feetY-FEET_OFF; e._shutSettled=true; e.og=true;
    e.vx=0; e.vy=0; e._offAnchorX=e.x; e._offAnchorY=e.y;
  }
}
function _tryInterruptMindReboot(e){
  if(!e||!e.mind||e.alive||e._mindOff!=='rebooting') return false;
  e._mindOff='cooldown'; e._cooldownEnd=Date.now()+MIND_REBOOT_COOLDOWN_MS;
  e.hp=0; e._rebootFill=0; e.hitF=12;
  sfx('hit_enemy',_hitSfxPitch(e.hp,e.mhp));
  return true;
}
function _completeMindReboot(e){
  if(e._battleAi){
    const d=BATTLE_SPAWN_DEFS[_battleTestRound%BATTLE_SPAWN_DEFS.length];
    e.shape=d.shape; e.type=d.shape; e.spd=d.spd;
    e.mhp=_mindEnemyMhp(d.shape,true);
  }else{
    e.mhp=_mindEnemyMhp(e.shape,false);
  }
  e.hp=e.mhp; e.alive=true; e._mindOff=null; e.shutF=0;
  e._shutSettled=false; e._offAnchorX=null; e._offAnchorY=null;
  e._cooldownEnd=0; e._rebootFill=0; e.vx=0; e.vy=0; e.og=true;
  e.hitF=0; e.pt=0; e.pCd=0; e.punchCd=0;
  e.xlrOn=false; e.magOn=false; e.itemBurst=0;
  if(e.hook) e.hook.st='idle';
  try{sfx('chargeReady');}catch(_e){}
}
function _updateMindEnemyOff(e){
  if(e.alive) return;
  if(!e._mindOff) e._mindOff='shutdown';
  e.xlrOn=false; e.magOn=false;
  if(e.hook) e.hook.st='idle';
  if(e._mindOff==='shutdown'){
    if(!e._shutSettled){
      _updateMindEnemyShutFall(e);
    }else{
      e._itemForceF=0; e._kbF=0;
      if(!e._offAnchorX){e._offAnchorX=e.x;e._offAnchorY=e.y;}
      e.x=e._offAnchorX; e.y=e._offAnchorY; e.vx=0; e.vy=0;
      if(e.shutF>0) e.shutF--;
      if(e.shutF<=0){e._mindOff='cooldown';e._cooldownEnd=Date.now()+MIND_REBOOT_COOLDOWN_MS;}
    }
  }else if(e._mindOff==='cooldown'){
    e._itemForceF=0; e._kbF=0;
    e.x=e._offAnchorX??e.x; e.y=e._offAnchorY??e.y; e.vx=0; e.vy=0;
    if(Date.now()>=e._cooldownEnd){e._mindOff='rebooting';e.hp=0;e._rebootFill=0;}
  }else if(e._mindOff==='rebooting'){
    e._itemForceF=0; e._kbF=0;
    e.x=e._offAnchorX??e.x; e.y=e._offAnchorY??e.y; e.vx=0; e.vy=0;
    e._rebootFill=(e._rebootFill||0)+1;
    const t=MIND_REBOOT_FILL_FR;
    e.hp=Math.min(e.mhp,Math.max(0,Math.ceil(e.mhp*e._rebootFill/t)));
    if(e._rebootFill>=t) _completeMindReboot(e);
  }
}
function _updateMinionShut(e){
  if(e._shutSettled){if(e.shutF>0) e.shutF--;return;}
  e.vy=Math.min((e.vy||0)+GRAV*(e.type==='flyer'?0.4:0.55),12);
  e.vx=(e.vx||0)*0.9;
  const prevFeet=e.y+e.h;
  e.x+=e.vx||0; e.y+=e.vy||0;
  if(e.mn!=null) e.x=Math.max(e.mn,Math.min(e.mx-e.w,e.x));
  _resolveActorPlatY(e,prevFeet,e.h);
  if(e.og){e._shutSettled=true;e.vx=0;e.vy=0;}
  else if(e.y+e.h>WH+60){
    const feetY=_surfaceYAt(e.x+e.w/2,e.y+e.h,120);
    e.y=feetY-e.h; e._shutSettled=true; e.og=true; e.vx=0; e.vy=0;
  }
  if(e.shutF>0) e.shutF--;
}

// ── Mind-clone AI ─────────────────────────────────────────────
function _enemyPlayerThreat(){
  return p.pt>0||(p.laserCharging&&p.laserCharge>8)||p.xlrOn||p.magOn||(p.hook&&p.hook.st!=='idle');
}
function _enemyAiPickTool(e,pdist,pdx,pdy,aggro){
  if(e.itemCd>0){e.itemCd--;return;}
  const threat=_enemyPlayerThreat();
  const bt=!!e._battleAi||!!e._campaignAi;
  e.xlrOn=false; e.magOn=false;
  if(!aggro){
    e.item=(Math.floor(e.x/72+fr/80))%4;
    e.aiMode='patrol'; e.itemCd=22+Math.random()*18|0; return;
  }
  if(bt&&pdist<140){
    e.aiMode='punch'; e.xlrOn=false; e.magOn=false; e.item=0;
    e.itemCd=8+Math.random()*12|0; return;
  }
  const scores=[0,0,0,0];
  const horiz=Math.abs(pdy)<55, vert=Math.abs(pdy)>70;
  const close=pdist<(bt?120:100), mid=pdist<(bt?340:300), far=pdist>(bt?280:240);
  if(pdist>65&&pdist<(bt?560:500)) scores[0]+=1.8;
  if(horiz) scores[0]+=1.6;
  if(far) scores[0]+=1.2;
  if(p.laserCharging&&p.laserCharge>12) scores[0]+=0.8;
  if(pdist>100&&pdist<(bt?400:360)&&vert) scores[1]+=2.8;
  if(pdist>180&&vert&&Math.abs(pdx)<140) scores[1]+=1.4;
  if(close) scores[1]-=3.5;
  if(e.hook&&e.hook.st!=='idle') scores[1]+=2.0;
  if(pdist<(bt?240:210)) scores[2]+=1.9;
  if(close) scores[2]+=2.2;
  if(threat) scores[2]+=2.6;
  if(p.laserCharging&&p.laserCharge>18) scores[2]+=3.2;
  if(p.hook&&p.hook.st==='on') scores[2]+=1.5;
  if(pdist>85&&pdist<(bt?300:270)&&horiz) scores[3]+=2.4;
  if(mid&&Math.abs(pdx)<120) scores[3]+=1.8;
  if(close&&horiz) scores[3]+=1.2;
  if(e.hp<e.mhp*0.35){scores[2]+=2.0;if(vert) scores[1]+=1.2;}
  if(e._lastItem>=0){scores[e._lastItem]-=1.4;if(e._itemStreak>=2) scores[e._lastItem]-=2.2;}
  let item=0, best=scores[0];
  for(let i=1;i<4;i++){if(scores[i]>best){best=scores[i];item=i;}}
  let mode='chase';
  if(close&&e.punchCd<=8){mode='punch';e.xlrOn=false;e.magOn=false;}
  else if(item===0){mode='beam';}
  else if(item===1){mode='hook';}
  else if(item===2){mode=threat?'evade':'push';e.xlrOn=true;e.itemBurst=bt?34+Math.random()*18|0:42+Math.random()*22|0;}
  else{mode=close?'punch':'pull';if(mode==='pull'){e.magOn=true;e.itemBurst=bt?40+Math.random()*20|0:48+Math.random()*24|0;}}
  if(item===e._lastItem) e._itemStreak=(e._itemStreak||0)+1;
  else{e._itemStreak=0;e._lastItem=item;}
  e.item=item; e.aiMode=mode;
  e.itemCd=bt?10+Math.random()*12|0:16+Math.random()*14|0;
}
function _applyEnemyItemFx(e,pose){
  if(_shutdownTimer>0) return;
  if(e.xlrOn&&e.item===2){
    if(fr%28===0) sfx('xlr');
    const aimA=Math.atan2(e.aimDY,e.aimDX);
    _applyPushWallReaction(p,pose.tipX,pose.tipY,aimA,195,e.itemBurst||45);
    const h=playerCoreHB(p);
    const cx=h.x+h.w/2, cy=h.y+h.h/2;
    const dx=cx-pose.tipX, dy=cy-pose.tipY, dist=Math.hypot(dx,dy)||1;
    if(dist<160){
      const ux=Math.cos(aimA), uy=Math.sin(aimA);
      if((dx/dist)*ux+(dy/dist)*uy>0.3){
        const prox=Math.pow(1-dist/160,1.35)*2.6;
        p.vx+=ux*prox*3.4; p.vy+=uy*prox*2.8;
        if(_shutdownTimer<=0&&fr%14===0){
          const dmg=10+prox*8|0;
          applyPlayerHit(ux*prox*1.5,uy*prox*1.1,dmg);
        }
      }
    }
  }
  if(e.magOn&&e.item===3){
    if(fr%32===0) sfx('mag');
    const h=playerCoreHB(p);
    const tug=_applyPullPlayerTug(p,pose.tipX,pose.tipY,3.8,3.4,h.x+h.w/2,h.y+h.h/2,h.w,h.h,215,false);
    p.vx+=tug.x; p.vy+=tug.y;
    const dist=Math.hypot(p.x+SW/2-pose.tipX,p.y+FEET_OFF-pose.tipY);
    if(dist<78&&_shutdownTimer<=0&&fr%16===0) applyPlayerHit((pose.tipX-p.x-SW/2)*0.04,(pose.tipY-p.y)*0.03,14);
  }
}
function _updateEnemyHook(e,pose,pdist){
  if(e.item!==1){if(e.hook&&e.hook.st!=='idle')e.hook.st='idle';return;}
  const bt=!!e._battleAi||!!e._campaignAi;
  e.hookCd=Math.max(0,(e.hookCd||0)-1);
  const hk=e.hook;
  if(e.aiMode==='hook'&&hk.st==='idle'&&e.hookCd===0&&pdist<(bt?400:370)&&pdist>55){
    hk.st='ext'; hk.ex=pose.noseX; hk.ey=pose.noseY;
    hk.ax=p.x+SW/2; hk.ay=p.y+FEET_OFF-10;
    hk.len=0; hk.maxLen=Math.min(210,pdist+50);
    e.hookCd=bt?48:72; sfx('hook_fire');
  }
  if(hk.st==='ext'){
    hk.len=Math.min(hk.maxLen,hk.len+20);
    const dd=Math.hypot(hk.ax-hk.ex,hk.ay-hk.ey)||1;
    if(hk.len>=Math.min(hk.maxLen,dd-6)){hk.st='on';sfx('hook_latch');}
  }
  if(hk.st==='on'){
    const dx=hk.ax-(e.x+SW/2), dy=hk.ay-(e.y+FEET_OFF), dd=Math.hypot(dx,dy)||1;
    e.vx=(e.vx||0)+dx/dd*0.62; e.vy=(e.vy||0)+dy/dd*0.38;
    if(dd<24||(e.hookCd||0)<=8) hk.st='idle';
  }
}
function _updateMindEnemy(e){
  const ex0=e.x;
  if((e._kbF||0)>0) e._kbF--;
  if((e._itemForceF||0)>0) e._itemForceF--;
  const skipChaseVx=(e._kbF||0)>0||(e._itemForceF||0)>0;
  const pl=allP();
  const ecx=e.x+SW/2, ecy=e.y+FEET_OFF-STAND_H*0.5;
  const pcx=p.x+SW/2, pcy=p.y+FEET_OFF-STAND_H*0.5;
  const pdx=pcx-ecx, pdy=pcy-ecy, pdist=Math.hypot(pdx,pdy)||1;
  const bt=!!e._battleAi||!!e._campaignAi;
  e.tAimDX=pdx/pdist; e.tAimDY=pdy/pdist;
  e.aimDX+=(e.tAimDX-e.aimDX)*(bt?0.42:0.32);
  e.aimDY+=(e.tAimDY-e.aimDY)*(bt?0.42:0.32);
  e.pupilX+=(e.tAimDX*4-e.pupilX)*0.22;
  e.pupilY+=(e.tAimDY*4-e.pupilY)*0.22;
  e.fc=e.aimDX>0.05?true:e.aimDX<-0.05?false:e.fc;
  if(e.punchCd>0) e.punchCd--;
  if(e.laserCd>0) e.laserCd--;
  if(e.jumpCd>0) e.jumpCd--;
  if(e.flashF>0) e.flashF--;
  if(e.itemBurst>0){e.itemBurst--;if(e.itemBurst<=0){e.xlrOn=false;e.magOn=false;}}
  const aggro=pdist<(bt?580:480);
  _enemyAiPickTool(e,pdist,pdx,pdy,aggro);
  const moveAccel=bt?0.36:0.22, drag=bt?0.94:0.9;
  const bodyGap=_horizBodyGap(p,e);
  const minGap=BODY_SEP_GAP+4;
  if(aggro&&!skipChaseVx){
    const close=pdist<(bt?155:140);
    const chase=e.spd*(bt?(close?2.05:pdist<300?1.75:1.45):(close?1.7:pdist<280?1.4:1.15));
    if(bodyGap<minGap){
      const away=pdx>0?-1:1;
      e.vx=(e.vx||0)+away*moveAccel*2.4;
      e.vx=Math.max(-chase,Math.min(chase,e.vx));
    }else if(e.aiMode==='evade'&&e.xlrOn){
      if(pdx>0) e.vx=Math.max((e.vx||0)-moveAccel,-chase*1.15);
      else e.vx=Math.min((e.vx||0)+moveAccel,chase*1.15);
    }else if(e.aiMode==='pull'&&e.magOn){
      if(pdx>24) e.vx=Math.min((e.vx||0)+moveAccel*0.85,chase*0.95);
      else if(pdx<-24) e.vx=Math.max((e.vx||0)-moveAccel*0.85,-chase*0.95);
      else e.vx*=0.82;
    }else if(bt&&e.aiMode==='punch'&&pdist>72){
      if(pdx>12) e.vx=Math.min((e.vx||0)+moveAccel*1.15,chase*1.1);
      else if(pdx<-12) e.vx=Math.max((e.vx||0)-moveAccel*1.15,-chase*1.1);
    }else{
      if(pdx>20) e.vx=Math.min((e.vx||0)+moveAccel,chase);
      else if(pdx<-20) e.vx=Math.max((e.vx||0)-moveAccel,-chase);
      else e.vx*=0.76;
    }
    if(e.og&&e.jumpCd===0&&((pdy<-45||close)&&Math.abs(pdx)<(bt?260:220))){
      e.vy=-(bt?8.4:7.2+e.spd*0.65); e.og=false;
      e.jumpCd=bt?32+Math.random()*18|0:50+Math.random()*30|0;
    }
    const punchRange=bt?125:96;
    const wantPunch=bt&&pdist<punchRange||e.aiMode==='punch';
    if(wantPunch&&e.punchCd===0&&e.og&&e.pt===0){
      e.pt=7; e.punchCd=bt?16+Math.random()*12|0:38+Math.random()*22|0; sfx('punch');
    }
    const laserMin=bt?48:55, laserMax=bt?560:520;
    if(e.aiMode!=='punch'&&e.item===0&&e.laserCd===0&&pdist>laserMin&&pdist<laserMax){
      const pose=computeConnectorArmPose(e);
      const charged=pdist>(bt?160:190)&&Math.random()<(bt?0.52:0.42);
      ESHOTS.push({x:pose.tipX,y:pose.tipY,
        vx:e.aimDX*(charged?10.4:8.4),vy:e.aimDY*(charged?10.4:8.4),
        life:999,type:'laser',col:'#ff3355',bounces:0,power:charged?1.85:1.15,born:fr,owner:'enemy'});
      e.laserCd=charged?(bt?70:95):(bt?32+Math.random()*20|0:48+Math.random()*28|0);
      e.flashF=charged?12:7;
      sfx(charged?'laser_charged_fire':'laser');
    }
    _updateEnemyHook(e,computeConnectorArmPose(e),pdist);
  }else{
    e.xlrOn=false; e.magOn=false;
    if(e.hook) e.hook.st='idle';
    if(Math.abs(e.vx||0)<0.12) e.vx=e.spd*e.dir;
    if(e.x<=e.mn||e.x+e.w>=e.mx){e.dir*=-1;e.vx=e.spd*e.dir;}
  }
  if(e.pt>0){
    const snapFrac=1-e.pt/10;
    if(snapFrac>0.68&&!e._hitDone){
      const punchAngle=Math.atan2(e.aimDY,e.aimDX);
      const armLen=12+snapFrac*30;
      const glovShX=e.fc?e.x+SW/2+BODY_W/2:e.x+SW/2-BODY_W/2;
      const glovShY=e.y+FEET_OFF-STAND_H-WHEEL_R+10+BODY_H*0.22;
      const fistWX=glovShX+Math.cos(punchAngle)*armLen;
      const fistWY=glovShY+Math.sin(punchAngle)*armLen;
      const h=playerCoreHB(p);
      const fistW=28,fistH=28;
      if(_shutdownTimer<=0&&_fistHitsHB(fistWX-fistW*0.5,fistWY-fistH*0.5,fistW,fistH,h)){
        e._hitDone=true;
        const kx=Math.cos(punchAngle)*KB_PLAYER_H;
        const ky=Math.sin(punchAngle)*2.4+KB_PLAYER_V*0.4;
        applyPlayerHit(kx,ky,PLAYER_HIT_DMG);
        _applyPunchImpact(e,p,punchAngle);
        spawnHitBurst(fistWX,fistWY,e.aimDX,e.aimDY,'#ff4444',8);
      }
    }
    e.pt--;
  }else e._hitDone=false;
  e.vy=Math.min((e.vy||0)+GRAV*0.55,11);
  _applyMindEnemyPhysics(e);
  if(_actorsOverlap(p,e)) _resolvePlayerEnemySeparation(p,e,8);
  if(aggro&&!skipChaseVx) e.vx*=drag;
  e.x=Math.max(e.mn,Math.min(e.mx-e.w,e.x));
  if(e.og){const edx=e.x-ex0;if(Math.abs(edx)>=0.01) e.wheelAngle=(e.wheelAngle||0)+edx/WHEEL_R;}
  e._armPose=computeConnectorArmPose(e);
  if(aggro&&(e.xlrOn||e.magOn)) _applyEnemyItemFx(e,e._armPose);
}

// ── Battle test world setup ───────────────────────────────────
function _placeBattlePlayer(){
  _spawnX=BATTLE_PLAYER_X;
  const feetY=_snapSpawnToSolid(BATTLE_PLAYER_X+SW/2,BATTLE_FEET_Y);
  _spawnY=feetY-FEET_OFF;
  if(!p) p=mkP();
  p.x=_spawnX; p.y=_spawnY;
  p.vx=0; p.vy=0; p.og=true;
  p.inv=0; p._shutdownTimer=0;
  p.hook={st:'idle',ex:0,ey:0,evx:0,evy:0,ax:0,ay:0,rl:0,ox:NaN,oy:NaN,tgt:null,tox:0,toy:0};
  p.xlrOn=false; p.magOn=false; p.wallGrip=0;
  p.crouchAmt=0; p.runRamp=0; p.pt=0; p.pCharging=false; p.pCharge=0;
  _snapCameraToPlayer(p);
}
function _spawnBattleRandomMindEnemy(){
  const shape=BATTLE_MIND_SHAPES[Math.floor(Math.random()*BATTLE_MIND_SHAPES.length)];
  const x=BATTLE_RIVAL_X+(Math.random()*100-50);
  const feetY=_snapSpawnToSolid(x,BATTLE_FEET_Y);
  const e=_mkMindEnemy(shape,x,feetY,{spd:BATTLE_MIND_SPD[shape],mn:40,mx:920,battle:true});
  const pl=p||mkP();
  e.dir=e.x+SW/2<pl.x+SW/2?1:-1; e.fc=e.dir>0;
  e.vx=0; e.vy=0; e.og=true; e.y=feetY-FEET_OFF;
  e._battleRandom=true; ENEMS.push(e); _allPCache=null;
  uiShowToast('RIVAL: '+shape.toUpperCase());
  try{sfx('chargeReady');}catch(_e){}
}
function _tickBattleRandomSpawnZone(){
  if(!_battleTestMode||_gameState!=='game'||!p) return;
  const z=BATTLE_RANDOM_SPAWN_ZONE;
  const px=p.x+SW/2, feet=p.y+FEET_OFF;
  const inZone=px>=z.x&&px<=z.x+z.w&&feet>=z.y&&feet<=z.y+z.h;
  if(inZone&&!_battleRandomZoneIn){_spawnBattleRandomMindEnemy();_battleRandomZoneIn=true;}
  else if(!inZone) _battleRandomZoneIn=false;
}
function _spawnBattleSignol(){
  _clearBattleRespawnTimer(); _purgeBattleRivals();
  const feetY=_snapSpawnToSolid(BATTLE_RIVAL_X,BATTLE_FEET_Y);
  const e=_mkSignol(BATTLE_RIVAL_X,feetY,{spd:0.82,mn:40,mx:920,battle:true});
  const pl=p||mkP();
  e.dir=e.x+e.r<pl.x+SW/2?1:-1; ENEMS.push(e); _allPCache=null;
  _syncBattleHud();
}
function _battleHasRivalEntity(){ return ENEMS.some(e=>e._battleAi||e._battleSignol); }
function _battleHasLiveRival(){ return ENEMS.some(e=>(e._battleAi||e._battleSignol)&&e.alive); }
function _onBattleSignolDefeated(){
  if(!_battleTestMode||_gameState!=='game') return;
  if(_battleWaitingRespawn()) return;
  _battleTestKills++; _battleRespawnAt=Date.now()+BATTLE_RESPAWN_MS;
  _syncBattleHud();
}
function _purgeDeadBattleSignols(){
  let n=0;
  for(let i=ENEMS.length-1;i>=0;i--){
    if(ENEMS[i]._battleSignol&&!ENEMS[i].alive){ ENEMS.splice(i,1); n++; }
  }
  if(n) _allPCache=null;
}
function _spawnBattleTestEnemy(){ _spawnBattleSignol(); }
function _spawnBattleMindEnemy(){
  _clearBattleRespawnTimer(); _purgeBattleRivals();
  const d=BATTLE_SPAWN_DEFS[_battleTestRound%BATTLE_SPAWN_DEFS.length];
  const feetY=520;
  const e=_mkMindEnemy(d.shape,d.x,feetY,{spd:d.spd,mn:40,mx:920,battle:true});
  const pl=p||mkP();
  e.dir=e.x+SW/2<pl.x+SW/2?1:-1; e.fc=e.dir>0;
  e.vx=0; e.vy=0; e.og=true; e.y=feetY-FEET_OFF;
  ENEMS.push(e); _allPCache=null; _syncBattleHud();
}
function _onBattleRivalDefeated(){
  if(!_battleTestMode||_gameState!=='game') return;
  _battleTestKills++;
  _battleTestRound=(_battleTestRound+1)%BATTLE_SPAWN_DEFS.length;
  const next=BATTLE_SPAWN_DEFS[_battleTestRound];
  uiShowToast('NEXT '+next.shape.toUpperCase()+' AFTER REBOOT'); _syncBattleHud();
}
function _battleActiveRival(){ return ENEMS.find(e=>e._battleAi||e._battleSignol); }
function _tickBattleTestSpawner(){
  if(!_battleTestMode||_gameState!=='game') return;
  _purgeDeadBattleSignols();
  _tickBattleRandomSpawnZone();
  if(_battleWaitingRespawn()){
    if(Date.now()>=_battleRespawnAt){
      _clearBattleRespawnTimer();
      _purgeBattleRivals();
      _spawnBattleTestEnemy();
    }
    _syncBattleHud();
    return;
  }
  if(!_battleHasLiveRival()&&!_battleHasRivalEntity()) _spawnBattleTestEnemy();
  _syncBattleHud();
}
function _syncBattleHud(){
  const hud=document.getElementById('battleHud');
  const on=_battleTestMode&&_gameState==='game';
  if(hud) hud.style.display=on?'block':'none';
  if(!on) return;
  const rivalE=ENEMS.find(e=>e._battleAi||e._battleSignol);
  const signolWaiting=_battleWaitingRespawn();
  const isSignol=signolWaiting||(rivalE&&rivalE._battleSignol);
  const upcoming=BATTLE_SPAWN_DEFS[_battleTestRound%BATTLE_SPAWN_DEFS.length];
  const rebooting=!isSignol&&rivalE&&!rivalE.alive&&rivalE._mindOff==='rebooting';
  const waiting=!isSignol&&rivalE&&!rivalE.alive&&(rivalE._mindOff==='cooldown'||rivalE._mindOff==='shutdown');
  const rivalLabel=isSignol?'SIGNOL':((waiting&&!rebooting)?upcoming.shape:(rivalE?rivalE.shape:upcoming.shape)).toUpperCase();
  const secs=waiting&&rivalE&&rivalE._mindOff==='cooldown'
    ?Math.max(1,Math.ceil((rivalE._cooldownEnd-Date.now())/1000))
    :(_battleWaitingRespawn()?_battleRespawnSecsLeft():0);
  const kEl=document.getElementById('battleKills');
  const dEl=document.getElementById('battleDeaths');
  const hEl=document.getElementById('battleHp');
  const rEl=document.getElementById('battleRival');
  if(kEl) kEl.textContent='KILLS '+_battleTestKills;
  if(dEl) dEl.textContent='DEATHS '+_battleTestDeaths;
  if(hEl&&p) hEl.textContent='HP '+p.hp+'/'+p.maxHp;
  if(rEl) rEl.textContent=rebooting
    ?('REBOOTING: '+rivalLabel)
    :(signolWaiting?('SIGNOL DOWN — NEXT IN '+secs+'s')
    :(waiting?('REBOOT: '+rivalLabel+' IN '+secs+'s'):('VS '+rivalLabel)));
  const inf=document.getElementById('inf');
  if(inf){
    inf.style.fontSize='14px'; inf.style.color='#8f8';
    inf.textContent=rebooting?('Rival rebooting — hit to interrupt  |  TAB = reset arena')
      :(signolWaiting?('Signol down — next in '+secs+'s  |  TAB = reset arena')
      :(waiting?('Rival reboot in '+secs+'s  |  TAB = reset arena')
      :('Fighting '+rivalLabel+'  |  HP '+(p?p.hp:'?')+'  |  TAB = reset arena')));
  }
}

// ── Spawn from map ────────────────────────────────────────────
function _spawnMapEnemies(){
  if(_battleTestMode||_runTestMode||!_mapApplied) return;
  ENEMS.length=0;
  for(const d of _mapEnemyDefs){
    if(_isBasementSpawnRow(d.row)) continue;
    const feetY=d.y!=null?d.y:_spawnFeetFromHeadTop(d.headTopY);
    if(feetY>=TMJ_BASEMENT_FEET_Y) continue;
    const range=Math.max(96,Math.min(200,(d.mx!=null&&d.mn!=null)?(d.mx-d.mn)*0.5:140));
    ENEMS.push(_mkMindEnemy(d.shape,d.x,feetY,{
      hp:d.hp,spd:d.spd,mn:d.mn??Math.floor(d.x-range),mx:d.mx??Math.floor(d.x+range),
      campaignAi:true,
    }));
  }
  for(const d of _mapSignolDefs){
    if(_isBasementSpawnRow(d.row)) continue;
    const feetY=d.y!=null?d.y:(d.headTopY!=null?_spawnFeetFromHeadTop(d.headTopY,'signol'):_snapSpawnToSolid(d.x,d.y));
    if(feetY>=TMJ_BASEMENT_FEET_Y) continue;
    ENEMS.push(_mkSignol(d.x,feetY,{
      mn:Math.floor(d.x-160),mx:Math.floor(d.x+160),campaignAi:_zoneIdx===0,
    }));
  }
  _purgeMinions();
  for(const d of _mapMinionDefs){
    if(_isBasementSpawnRow(d.row)) continue;
    const feetY=d.y!=null?d.y:_spawnFeetFromHeadTop(d.headTopY);
    if(feetY>=TMJ_BASEMENT_FEET_Y) continue;
    const range=Math.max(96,Math.min(200,140));
    ENEMS.push(_mkMinion(d.x,feetY,d.kind,{
      mn:Math.floor(d.x-range),mx:Math.floor(d.x+range),
    }));
  }
}
function _spawnMapCrates(){
  if(!_mapApplied) return;
  for(const c of CRATE_DEF){
    if(c.x<40||c.x>WW-80) continue;
    CRATES.push({x:c.x,y:c.y,w:c.w,h:c.h,vx:0,vy:0,og:false});
  }
}
function _populateKnowlFromMap(){
  KDROP.length=0;
  const defs=_mapKnowlDefs.length?_mapKnowlDefs:(_mapApplied?[]:KDEFS);
  for(const d of defs){
    KDROP.push({x:d.x,y:d.y,ox:d.x,oy:d.y,px:0,py:0,vx:0,vy:0,got:false,bob:Math.random()*Math.PI*2});
  }
  kTotal=KDROP.length;
}
