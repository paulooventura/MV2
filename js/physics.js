// ============================================================
//  Mind & Venture — physics.js
//  All physics constants, collision resolution, camera,
//  player hitboxes, rope helpers, push/pull reactions.
//
//  Depends on: WW, WH, TR (world arrays from main.js),
//  BWALLS, CRATES, MPLAT, APLAT (from enemies.js / main.js),
//  ctx, W, H, SMS_SCALE, MV2_VISUAL (from main.js canvas setup),
//  p, p2, fr (from player.js),
//  _gameState, _playerCount, _spawnX, _spawnY (globals),
//  sfx (audio.js), OPT (save.js)
// ============================================================

// ── Movement constants ────────────────────────────────────────
const GRAV=0.52, FRIC=0.88, GROUND_FRIC=0.52, RUN_COAST_FRIC=0.86, AIR_DRIFT=0.96;
const MOVE_BUILD=41;
const MOVE_WALK=10.5;
const MOVE_PEAK=1.0;
const MOVE_RUN=16.5;
const MOVE_ACCEL=0.52;
const MOVE_RUN_ACCEL=0.62;
const MOVE_AIR=0.42;
const MOVE_POWER=0.028;
const MOVE_TORQUE=1.45;
const MOVE_STOP=0.62;
const MOVE_TURN=2.1;
const MOVE_RUN_RAMP=0.10;
const WHEEL_GRIP_BASE=0.91;
const WHEEL_ROLL_RESIST=0.011;
const WHEEL_DRIVE_TORQUE=0.68;
const WHEEL_COAST_FRIC=0.987;
const WHEEL_GRADE_RESIST=0.38;
const WLK=MOVE_WALK, RUN=MOVE_RUN, ACCEL=MOVE_ACCEL;
const RUN_RAMP_RATE=MOVE_RUN_RAMP;
const FALL_DMG_VY=9.2;
const LIFE_REGEN_FRAMES=360;
const KNOWL_TREE_BOOST=2;
let _knowlTreeZone=null;

// ── Jump constants ────────────────────────────────────────────
const JI=-3.0, JHH=0.40, JMH=22, JMX=-11.0;

// ── Body / character dimensions ───────────────────────────────
const BODY_W=52, BODY_H=42, AIM_LEN=36, RCA_NOSE_LEN=41;
const SW=64, SH=96;
const FEET_OFF=88;
const WHEEL_R=20;
const WHEEL_MIN_SUPPORT=0.42;
const WHEEL_GROUND_EXIT=0.30;
const WHEEL_SETTLE_TOL=1.25;
const WHEEL_EDGE_ROLL=0.54;
const SUSP_TRAVEL=14, SUSP_STIFF=0.44, SUSP_DAMP=0.7, SUSP_ROLL_MAX=11;
function _tileCampaignActive(){
  return typeof _mapApplied!=='undefined'&&!!_mapApplied&&typeof _zoneIdx!=='undefined'&&_zoneIdx===0
    &&typeof _battleTestMode!=='undefined'&&!_battleTestMode&&typeof _runTestMode!=='undefined'&&!_runTestMode;
}
function _tileFlatFloorTrust(pl){
  if(!_tileCampaignActive()||!pl||!pl.og) return false;
  const cx=pl.x+SW*0.5, feet=pl.y+FEET_OFF;
  const surf=typeof _pickWalkSurfaceY==='function'
    ?_pickWalkSurfaceY(cx,feet,{maxUp:18,maxDrop:GROUND_SINK_MAX+24,pl}):null;
  return surf!=null&&Math.abs(feet-surf)<=GROUND_SINK_MAX+10;
}
const HBX=6, HBW=BODY_W;
const FEET_L=SW/2-WHEEL_R, FEET_W=WHEEL_R*2;
const STAND_H=70, DUCK_H=40;

// ── Rope / grappling hook constants ───────────────────────────
const CSPD=11, CMAX=400;
const ROPE_REEL_IN=3.6;
const ROPE_REEL_OUT=2.8;
const ROPE_RL_MIN=28;
const ROPE_MAX_PIVOTS=6;
const ROPE_SNAP_STRETCH=0.45;
const ROPE_SNAP_MIN=64;
const ROPE_GIVE=12;

// Verlet visual cord
const VROPE_N=22;       // particles along cord
const VROPE_ITER=8;     // constraint passes per frame
const VROPE_GRAV=0.3;   // sag gravity for slack cord
const VROPE_DRAG=0.96;  // air drag on cord wiggle

// ── Collision system ──────────────────────────────────────────
const COLL_SEAM=8;
const COLL_CONTACT_GAP=0;
const COLL_MOVE_STEP=4;
const COLL_LEDGE_STEP=56;
const GROUND_SINK_MAX=2;
const LAND_FEET_TOL=6;
const ZONE_WALL_THICK=28;
let COLL_SEGS=[];
let COLL_WALL_SEGS=[];
let COLL_POLYS=[];
let IMMERSED_POLYS=[];
let _collSegBuckets=[];
const _COLL_BUCKET_W=256;
let _useSegGround=false;

// ── Camera ────────────────────────────────────────────────────
const CAM_LERP=0.11;
let camX=0, camY=0;
let _rcamX=0, _rcamY=0;
let camZoom, camZoomTgt;

function _initCamZoom(){
  camZoom    = 1/SMS_SCALE;
  camZoomTgt = 1/SMS_SCALE;
}

function camViewW(){ return W/camZoom; }
function camViewH(){ return H/camZoom; }
function camClampX(x){ return Math.max(0,Math.min(Math.max(0,WW-camViewW()),x)); }
function camClampY(y){ return Math.max(0,Math.min(Math.max(0,WH-camViewH()),y)); }
// Single follow anchor — feet at ~40% width, vertical center (matches spawn snap).
function _cameraFollowTarget(pl){
  const vw=camViewW(), vh=camViewH();
  return {
    x:pl.x+SW*0.5-vw*0.4,
    y:pl.y+FEET_OFF-vh*0.5
  };
}
function _cameraFollowTargetCoop(){
  const vw=camViewW(), vh=camViewH();
  const cx=(p.x+p2.x)*0.5+SW*0.5;
  const cy=(p.y+p2.y)*0.5+FEET_OFF;
  return {x:cx-vw*0.4, y:cy-vh*0.5};
}
let _camSettle=0;
function _snapCameraToPlayer(pl){
  if(!pl) return;
  const t=_cameraFollowTarget(pl);
  camX=camClampX(t.x);
  camY=camClampY(t.y);
  _camSettle=10;
  _snapRenderCam();
}
function _snapRenderCam(){
  if(MV2_VISUAL){ _rcamX=camX; _rcamY=camY; }
  else{ _rcamX=Math.floor(camX/SMS_SCALE)*SMS_SCALE; _rcamY=Math.floor(camY/SMS_SCALE)*SMS_SCALE; }
}
function sx(x){ return MV2_VISUAL?Math.round(x-_rcamX):Math.floor((x-_rcamX)/SMS_SCALE); }
function sy(y){ return MV2_VISUAL?Math.round(y-_rcamY):Math.floor((y-_rcamY)/SMS_SCALE); }
function sw(v){ return MV2_VISUAL?Math.max(1,Math.round(v)):Math.max(1,Math.floor(v/SMS_SCALE)); }
function _syncGameCamera(){
  if(_gameState!=='game'||!p) return;
  if(!isFinite(p.x)) p.x=_spawnX;
  if(!isFinite(p.y)) p.y=_spawnY;
  const t=(_playerCount===2&&p2&&isFinite(p2.x)&&isFinite(p2.y))
    ?_cameraFollowTargetCoop()
    :_cameraFollowTarget(p);
  const tx=camClampX(t.x), ty=camClampY(t.y);
  if(_camSettle>0){
    camX=tx; camY=ty;
    _camSettle--;
  }else if(_mapApplied&&_zoneIdx===0&&!_battleTestMode&&!_runTestMode&&
    (Math.abs(camX-tx)>120||Math.abs(camY-ty)>120)){
    camX=tx; camY=ty; _camSettle=4;
  }else{
    camX+=(tx-camX)*CAM_LERP;
    camY+=(ty-camY)*CAM_LERP;
  }
}

// ── Overlap / hitbox helpers ──────────────────────────────────
function ov(ax,ay,aw,ah,bx,by,bw,bh){ return ax<bx+bw&&ax+aw>bx&&ay<by+bh&&ay+ah>by; }
function hbH(ca){ return STAND_H-(STAND_H-DUCK_H)*ca; }
function hb(){ return playerCoreHB(p); }
function cpt(){ return {x:p.x+SW/2, y:p.y+FEET_OFF-STAND_H*0.5}; }

function playerCoreHB(pl){
  const ca2=pl.crouchAmt||0;
  const wcy=pl.y+FEET_OFF-WHEEL_R-2;
  const standBodyCY=pl.y+FEET_OFF-STAND_H-WHEEL_R+10;
  const duckBodyBottom=wcy+WHEEL_R*0.5;
  const duckBodyCY=duckBodyBottom-BODY_H;
  const bodyTop=standBodyCY+ca2*(duckBodyCY-standBodyCY);
  return {x:pl.x+SW/2-BODY_W/2, y:bodyTop, w:BODY_W, h:BODY_H};
}
// Full-body hull for actor–actor separation (wheel + torso, not just core).
function actorSeparationHB(pl){
  if(!pl) return {x:0,y:0,w:0,h:0};
  const core=playerCoreHB(pl);
  const pad=4;
  const cx=pl.x+SW*0.5;
  const w=Math.max(core.w,SW-6);
  const top=core.y-pad;
  const feet=pl.y+FEET_OFF;
  const h=Math.max(core.h+pad*2,feet-top+pad);
  return {x:Math.round(cx-w*0.5),y:Math.round(top),w:Math.round(w),h:Math.round(h)};
}
function playerWheelCol(pl){ return {cx:pl.x+SW/2, cy:pl.y+FEET_OFF-WHEEL_R, r:WHEEL_R}; }
function playerHeadWorld(pl){
  const ca2=pl.crouchAmt||0;
  const px=pl.x, py=pl.y;
  const wcy=py+FEET_OFF-WHEEL_R-2;
  const standBodyCY=py+FEET_OFF-STAND_H-WHEEL_R+10;
  const duckBodyCY=(wcy+WHEEL_R*0.5)-BODY_H;
  const bodyCY=standBodyCY+ca2*(duckBodyCY-standBodyCY);
  const tuck=Math.max(ca2,pl._autoHeadTuck||0);
  const headR=14-tuck*3;
  const standHeadCY=bodyCY-18;
  const shellHeadCY=bodyCY+headR*1.05;
  const headCY=standHeadCY+tuck*(shellHeadCY-standHeadCY);
  return {cx:px+SW/2, cy:headCY, r:headR};
}
function _playerChargeInfo(pl){
  const wallWC=pl.wallGrip>0?(90-pl.wallGrip):0;
  const wallC=pl.wallGrip>0?Math.min(1,wallWC/60):0;
  const springC=Math.min(1,(pl.duckCharge||0)/60);
  const sprinting=pl===p&&isSprintHeld()&&(pl.og||_playerOnGround(pl))&&_moveInputX()!==0;
  const runC=sprinting?(pl.runRamp||0):0;
  const springReady=!!pl.duckBoostReady;
  const wallReady=!!pl._wallChargeReady;
  const chargeFrac=Math.max(springReady?1:springC,wallReady?1:wallC,runC);
  const ready=springReady||wallReady||(sprinting&&runC>=0.98);
  return {wallC,springC,runC,chargeFrac,ready,sprinting,springReady,wallReady};
}
function _circleRectOverlap(cx,cy,r,rx,ry,rw,rh){
  const nx=Math.max(rx,Math.min(cx,rx+rw));
  const ny=Math.max(ry,Math.min(cy,ry+rh));
  const dx=cx-nx, dy=cy-ny;
  return dx*dx+dy*dy<r*r;
}

// ── Platform normalizer + allP cache ─────────────────────────
function _normPlat(t){
  if(Array.isArray(t)) return {x:t[0],y:t[1],w:t[2],h:t[3],tp:t[4]||'solid',poly:t[5]==='poly',mv:null,mp:null};
  return {x:t.x,y:t.y,w:t.w,h:t.h,tp:t.tp||'solid',poly:!!t.poly,mv:t.mv||null,mp:t.mp||null};
}
let _allPCache=null, _allPCacheFr=-1;
// Static TR (map geometry) rarely changes during play, but allP() used to
// re-allocate one object per platform every frame -> GC churn -> stutter.
// Cache the normalized static platforms and rebuild only when TR changes
// (reassigned, or grown/shrunk) or while the editor is live (in-place edits).
let _normTRCache=null, _normTRSrc=null, _normTRLen=-1;
function _normTR(){
  const editing=(typeof _editorActive!=='undefined'&&_editorActive);
  if(_normTRCache&&!editing&&TR===_normTRSrc&&TR.length===_normTRLen) return _normTRCache;
  _normTRCache=TR.map(_normPlat);
  _normTRSrc=TR; _normTRLen=TR.length;
  return _normTRCache;
}
function allP(){
  if(_allPCacheFr===fr) return _allPCache;
  const out=_normTR().slice();
  for(const bw of BWALLS){ if(bw.hp>0) out.push({x:bw.x,y:bw.y,w:bw.w,h:bw.h,tp:'solid',mv:null,mp:null,bw}); }
  for(const m of MPLAT) out.push({x:m.x,y:m.y,w:m.w,h:m.h,tp:'oneway',mv:null,mp:m});
  for(const a of APLAT) out.push({x:a.x,y:a.y,w:a.w,h:a.h,tp:'oneway',mv:a,mp:null});
  _allPCache=out; _allPCacheFr=fr;
  return out;
}
function _bwallTopYNear(cx,feetY,opts){
  opts=opts||{};
  const maxUp=opts.maxUp!=null?opts.maxUp:24;
  const maxDrop=opts.maxDrop!=null?opts.maxDrop:GROUND_SINK_MAX+56;
  const fL=cx-FEET_W*0.35, fR=cx+FEET_W*0.35;
  let best=null, bestScore=1e9;
  for(const bw of BWALLS){
    if(!bw||bw.hp<=0) continue;
    if(cx<bw.x+4||cx>bw.x+bw.w-4) continue;
    if(fR<=bw.x-4||fL>=bw.x+bw.w+4) continue;
    const y=bw.y;
    const drop=y-feetY;
    if(drop<-maxUp||drop>maxDrop) continue;
    const score=drop<0?(-drop)*3+8:drop;
    if(score<bestScore){bestScore=score;best=y;}
  }
  return best;
}
function _pickWalkSurfaceY(cx,feetY,opts){
  opts=opts||{};
  const maxUp=opts.maxUp!=null?opts.maxUp:24;
  const maxDrop=opts.maxDrop!=null?opts.maxDrop:(GROUND_SINK_MAX+56);
  const pl=opts.pl;
  const skipBwall=!!(pl&&pl._bwallFallGrace>0);
  let best=null, bestScore=1e9;
  const consider=(y)=>{
    if(y==null) return;
    const drop=y-feetY;
    if(drop<-maxUp||drop>maxDrop) return;
    const score=drop<0?(-drop)*3+8:drop;
    if(score<bestScore){bestScore=score;best=y;}
  };
  if(!skipBwall) consider(_bwallTopYNear(cx,feetY,{maxUp,maxDrop}));
  const wSup=_wheelSupportAt(cx,feetY,{maxUp,maxDrop,minFrac:0.06,loose:!!opts.loose,pl});
  if(wSup) consider(wSup.y);
  if(best!==null) return best;
  if(typeof _findFloorBelow==='function'&&!(_useSegGround&&COLL_SEGS.length)){
    consider(_findFloorBelow(cx,feetY,maxDrop,{maxUp,loose:!!opts.loose}));
  }
  if(best!==null) return best;
  const fL=cx-FEET_W*0.35, fR=cx+FEET_W*0.35;
  for(const plat of allP()){
    if(plat.tp!=='solid'||plat.bw) continue;
    if(fR<=plat.x||fL>=plat.x+plat.w) continue;
    if(plat.poly&&plat.h>28) continue;
    consider(plat.y);
  }
  if(best===null&&COLL_SEGS.length&&!_useSegGround){
    const samples=[cx-FEET_W*0.35,cx,cx+FEET_W*0.35];
    _eachCollSegNear(cx,FEET_W+32,seg=>{
      if(!_walkSegAllowed(seg,cx,feetY)) return;
      consider(_segSupportAt(seg,samples,2,true));
    });
  }
  return best;
}

// ── Spatial buckets for collision segments ────────────────────
function _rebuildCollSegBuckets(){
  _collSegBuckets=[];
  for(const seg of COLL_SEGS){
    const minX=Math.min(seg.x1,seg.x2), maxX=Math.max(seg.x1,seg.x2);
    const b0=Math.max(0,Math.floor(minX/_COLL_BUCKET_W));
    const b1=Math.floor(maxX/_COLL_BUCKET_W);
    for(let b=b0;b<=b1;b++){
      if(!_collSegBuckets[b]) _collSegBuckets[b]=[];
      _collSegBuckets[b].push(seg);
    }
  }
}
let _collSegVisitGen=0;
function _eachCollSegNear(x,pad,fn){
  if(!COLL_SEGS.length) return;
  const b0=Math.max(0,Math.floor((x-pad)/_COLL_BUCKET_W));
  const b1=Math.floor((x+pad)/_COLL_BUCKET_W);
  // Generation stamp avoids allocating a Set on every call (this runs many
  // times per frame from ground detection; the old Set churn caused GC stutter).
  const gen=++_collSegVisitGen;
  for(let b=b0;b<=b1;b++){
    const bucket=_collSegBuckets[b];
    if(!bucket) continue;
    for(const seg of bucket){ if(seg._vg===gen) continue; seg._vg=gen; fn(seg); }
  }
}

// ── Seg geometry helpers ──────────────────────────────────────
function _xPushCap(pl){ return Math.max(8,Math.min(24,Math.abs(pl.vx||0)*0.55+6)); }
function _feetSamples(pl){
  const fL=pl.x+FEET_L, fR=fL+FEET_W, span=fR-fL;
  return [fL+2,fL+span*0.25,(fL+fR)*0.5,fL+span*0.75,fR-2];
}
function _wheelProbePoints(pl){
  const wc=playerWheelCol(pl);
  const fL=pl.x+FEET_L, fR=fL+FEET_W;
  return [
    {x:wc.cx,y:wc.cy,r:WHEEL_R},
    {x:fL+4,y:pl.y+FEET_OFF,r:WHEEL_R*0.9},
    {x:fR-4,y:pl.y+FEET_OFF,r:WHEEL_R*0.9},
    {x:pl.x+SW/2,y:pl.y+FEET_OFF,r:WHEEL_R*0.75},
  ];
}
function _bodyProbePoints(pl){
  const h=playerCoreHB(pl);
  const head=playerHeadWorld(pl);
  return [
    {x:h.x+3,y:h.y+h.h*0.55,r:10},
    {x:h.x+h.w-3,y:h.y+h.h*0.55,r:10},
    {x:h.x+h.w*0.5,y:h.y+6,r:11},
    {x:head.cx,y:head.cy,r:head.r},
  ];
}
function _segClosestPoint(seg,px,py){
  const dx=seg.x2-seg.x1, dy=seg.y2-seg.y1, len2=dx*dx+dy*dy;
  const t=len2<0.001?0:Math.max(0,Math.min(1,((px-seg.x1)*dx+(py-seg.y1)*dy)/len2));
  return {x:seg.x1+t*dx,y:seg.y1+t*dy,t};
}
function _segYAtX(seg,x){
  const {x1,y1,x2,y2}=seg;
  const minX=Math.min(x1,x2)-COLL_SEAM, maxX=Math.max(x1,x2)+COLL_SEAM;
  if(x<minX||x>maxX) return null;
  const dx=x2-x1;
  if(Math.abs(dx)<0.25) return null;
  const t=(x-x1)/dx;
  if(t<-0.01||t>1.01) return null;
  return y1+t*(y2-y1);
}
function _segSupportAt(seg,samples,minHits=2,needCenter=true){
  const ys=[];
  let hits=0;
  const center=samples[Math.floor(samples.length/2)];
  for(const x of samples){
    const y=_segYAtX(seg,x);
    if(y!==null){ ys.push(y); hits++; }
  }
  if(hits<minHits) return null;
  if(needCenter&&_segYAtX(seg,center)===null) return null;
  return Math.max(...ys);
}
function _wheelHorizOverlap(wLo,wHi,span){
  const sLo=Math.min(span.x1,span.x2), sHi=Math.max(span.x1,span.x2);
  const oLo=Math.max(wLo,sLo), oHi=Math.min(wHi,sHi);
  return Math.max(0,oHi-oLo)/(WHEEL_R*2);
}
function _bwallCenterSupports(cx,bw){
  return bw&&cx>=bw.x+4&&cx<=bw.x+bw.w-4;
}
// Omniblock cells use BWALLS only (solid until hp<=0, then air). Never duplicate with tile-grass segs.
function _bwallOwnsTileCell(col,row){
  if(col==null||row==null) return false;
  const scan=typeof BWALLS!=='undefined'?BWALLS:[];
  for(const bw of scan){
    if(bw.homeCol!==col||bw.homeRow!==row) continue;
    const gid=bw.tileGid||0;
    if(typeof _isOmniblockGid==='function'&&_isOmniblockGid(gid)) return true;
  }
  return false;
}
function _tileGrassSegUsable(seg){
  if(!seg||seg.walkKind!=='tile-grass') return true;
  if(seg.col==null||seg.row==null) return true;
  return !_bwallOwnsTileCell(seg.col,seg.row);
}
// Bwall AABB top is plat.y; bottom is plat.y+plat.h. Skip side shove when feet are on top or floor lip.
function _bwallFeetSideClear(pl,plat,fL,fR,feet){
  if(!plat||!plat.bw||!pl) return false;
  if(pl===p&&typeof isPunch==='function'&&isPunch()) return true;
  if(_playerStandingOnPlat(pl,plat)) return true;
  if(feet>=plat.y-14&&feet<=plat.y+GROUND_SINK_MAX+12&&_feetSpanOver(plat,fL,fR,10)) return true;
  const lip=plat.y+plat.h;
  if(Math.abs(feet-lip)<=GROUND_SINK_MAX+10&&_feetSpanOver(plat,fL,fR,10)){
    const h=playerCoreHB(pl);
    const penL=(h.x+h.w)-plat.x, penR=(plat.x+plat.w)-h.x;
    const xPen=Math.min(Math.max(0,penL),Math.max(0,penR));
    if(xPen<=18) return true;
  }
  return false;
}
// KEEP OUT vertical barriers duplicate omniblock faces — resolve one authority only.
function _keepOutBarrierRedundantWithBwall(pl,seg){
  if(!seg||seg.nx==null||Math.abs(seg.nx)<0.55||Math.abs(seg.ny)>0.45) return false;
  const feet=pl.y+FEET_OFF, cx=pl.x+SW*0.5;
  for(const bw of BWALLS){
    if(!bw||bw.hp<=0) continue;
    if(feet<bw.y-14||feet>bw.y+bw.h+14) continue;
    const faceX=seg.nx>0?bw.x:bw.x+bw.w;
    const cp=_segClosestPoint(seg,faceX,feet);
    if(Math.abs(cp.x-faceX)>12||Math.abs(cp.y-feet)>28) continue;
    if(seg.nx>0&&faceX>=cx-12) return true;
    if(seg.nx<0&&faceX<=cx+12) return true;
  }
  return false;
}
function _isWorldBoundPlat(plat){
  if(!plat||plat.bw||plat.mv||plat.mp||plat.tp!=='solid') return false;
  const tall=plat.h>=(typeof WH!=='undefined'?WH:3200)*0.35;
  return tall&&((plat.x<=0&&plat.w<=72)||(plat.x>=WW-72&&plat.w<=72));
}
function _platSideCollisionSkip(pl,plat){
  if(!plat||_isWorldBoundPlat(plat)) return false;
  if(plat.bw){
    if(_playerStandingOnPlat(pl,plat)) return true;
    const feet=pl.y+FEET_OFF;
    const lip=plat.y+plat.h;
    if(pl.og&&Math.abs(feet-lip)<=GROUND_SINK_MAX+10) return true;
    return false;
  }
  if(!_feetOnWalkSurface(pl)) return false;
  const feet=pl.y+FEET_OFF;
  return feet>=plat.y-12&&feet<=plat.y+Math.min(Math.max(plat.h,16),40)+12;
}
function _handleBwallRideRelease(pl){
  if(!pl) return;
  const riding=_ridingBwallTop(pl);
  if(riding){
    pl._rideBwallRef=riding;
    return;
  }
  if(!pl._rideBwallRef) return;
  const prev=pl._rideBwallRef;
  if(prev.hp<=0||!BWALLS.includes(prev)){
    pl.og=false;
    pl._groundSeg=null;
    pl.vy=Math.max(pl.vy||0,0.42);
    pl._bwallFallGrace=16;
  }
  pl._rideBwallRef=null;
}
function _wheelSupportAt(cx,feetY,opts){
  opts=opts||{};
  const maxUp=opts.maxUp!=null?opts.maxUp:24;
  const maxDrop=opts.maxDrop!=null?opts.maxDrop:(GROUND_SINK_MAX+72);
  const minFrac=opts.minFrac!=null?opts.minFrac:0.08;
  const wLo=cx-WHEEL_R, wHi=cx+WHEEL_R;
  const pl=opts.pl;
  const skipBwall=!!(pl&&pl._bwallFallGrace>0);
  let best=null, bestScore=1e9;
  const consider=(y,frac,meta)=>{
    if(y==null||frac<minFrac) return;
    const drop=y-feetY;
    if(drop<-maxUp||drop>maxDrop) return;
    const score=(drop<0?(-drop)*3+8:drop)-Math.min(frac,0.72)*3;
    const slopeBonus=meta.seg&&meta.seg.floorKind==='slope'?3:0;
    const adj=score-slopeBonus;
    if(adj<bestScore){bestScore=adj;best={y,frac,...meta};}
  };
  if(!skipBwall){
    for(const bw of BWALLS){
      if(!bw||bw.hp<=0) continue;
      if(!_bwallCenterSupports(cx,bw)) continue;
      const frac=_wheelHorizOverlap(wLo,wHi,{x1:bw.x,x2:bw.x+bw.w});
      if(frac<minFrac) continue;
      consider(bw.y,frac,{kind:'bwall',plat:bw});
    }
  }
  if(COLL_SEGS.length){
    _eachCollSegNear(cx,WHEEL_R+56,seg=>{
      if(!_walkSegAllowed(seg,cx,feetY)) return;
      const frac=_wheelHorizOverlap(wLo,wHi,{x1:seg.x1,x2:seg.x2});
      if(frac<minFrac) return;
      const y=_wheelSegFeetY(seg,cx,feetY-WHEEL_R,WHEEL_R,!!opts.loose);
      if(y==null) return;
      consider(y,frac,{kind:'seg',seg});
    });
  }
  for(const plat of allP()){
    if(plat.tp!=='solid') continue;
    if(plat.poly&&_useSegGround&&plat.h>28&&!plat.bw) continue;
    if(plat.x+plat.w<wLo||plat.x>wHi) continue; // cheap cull before temp-object alloc
    const frac=_wheelHorizOverlap(wLo,wHi,{x1:plat.x,x2:plat.x+plat.w});
    if(frac<minFrac) continue;
    consider(plat.y,frac,{kind:'plat',plat});
  }
  return best;
}
function _wheelGroundState(pl,opts){
  if(!pl) return null;
  opts=opts||{};
  const wc=playerWheelCol(pl);
  const feet=wc.cy+wc.r;
  const sup=_wheelSupportAt(wc.cx,feet,{maxUp:opts.maxUp!=null?opts.maxUp:24,maxDrop:opts.maxDrop!=null?opts.maxDrop:(GROUND_SINK_MAX+56),minFrac:opts.minFrac!=null?opts.minFrac:0.08,loose:!!opts.loose,pl});
  if(!sup) return {grounded:false,feetY:feet,cx:wc.cx,cy:wc.cy,frac:0,seg:null,angle:0};
  return {
    grounded:sup.frac>=WHEEL_MIN_SUPPORT,
    feetY:sup.y,
    cx:wc.cx,
    cy:sup.y-WHEEL_R,
    frac:sup.frac,
    seg:sup.seg||null,
    angle:sup.seg?sup.seg.angle:0,
    kind:sup.kind,
    plat:sup.plat
  };
}
function _wheelSettle(pl,opts){
  if(!pl||(pl.hook&&pl.hook.st==='on')||pl.wallGrip>0) return null;
  if(pl._bwallFallGrace>0) return null;
  if(_ridingBwallTop(pl)) return null;
  opts=opts||{};
  const feet=pl.y+FEET_OFF;
  const rising=pl.vy<-0.35;
  const g=_wheelGroundState(pl,opts);
  if(!g||!g.grounded) return null;
  const gap=g.feetY-feet;
  if(rising&&gap>1.5) return g;
  const landWin=Math.max(12,Math.abs(pl.vy||0)+8);
  if(!pl.og){
    if(pl.vy<0.15&&gap>landWin+4) return null;
    if(gap>landWin) return null;
  }else if(Math.abs(gap)<=WHEEL_SETTLE_TOL){
    pl._groundSeg=g.seg;
    pl._slopeAngle=g.angle||0;
    pl._onSlope=Math.abs(pl._slopeAngle)>0.06;
    pl._wheelGround=g;
    pl._groundHold=Math.max(pl._groundHold||0,4);
    return g;
  }else if(_tileCampaignActive()&&pl.og){
    if(Math.abs(gap)<=GROUND_SINK_MAX+2.5){
      if(Math.abs(gap)>2) pl.y+=Math.sign(gap)*Math.min(Math.abs(gap),2);
      pl._groundSeg=g.seg;
      pl._slopeAngle=g.angle||0;
      pl._onSlope=false;
      pl._wheelGround=g;
      pl._groundHold=Math.max(pl._groundHold||0,6);
      return g;
    }
    return g;
  }else if(Math.abs(gap)>GROUND_SINK_MAX+2.5) return null;
  pl.y=g.feetY-FEET_OFF;
  pl._groundSeg=g.seg;
  pl._slopeAngle=g.angle||0;
  pl._onSlope=Math.abs(pl._slopeAngle)>0.06;
  pl.og=true;
  if(pl.vy>0) pl.vy=0;
  pl._wheelGround=g;
  pl._groundHold=8;
  return g;
}
function _wheelOverhangDir(cx,support,vx){
  const dir=Math.sign(vx||0);
  if(support){
    let sLo,sHi;
    if(support.seg){sLo=Math.min(support.seg.x1,support.seg.x2);sHi=Math.max(support.seg.x1,support.seg.x2);}
    else if(support.plat){sLo=support.plat.x;sHi=support.plat.x+support.plat.w;}
    if(sLo!=null){
      const hangR=cx+WHEEL_R-sHi, hangL=sLo-(cx-WHEEL_R);
      if(hangR>hangL+3&&hangR>5) return 1;
      if(hangL>hangR+3&&hangL>5) return -1;
    }
  }
  return dir||1;
}
function _polyWalkUsable(seg,cx,feetY){
  if(!seg||seg.walkKind!=='poly') return false;
  if(seg.floorKind==='room'){
    const flat=Math.abs(seg.angle||0)<0.09;
    if(flat&&COLL_POLYS.length){
      if(cx==null||feetY==null) return false;
      if(!_isInsidePlayBoundary(cx,feetY)) return false;
    }
    return true;
  }
  if(seg.floorKind==='slope') return true;
  if(!seg.floorKind) return true;
  return false;
}
function _wheelSegFeetY(seg,cx,cy,r,loose){
  if(!seg) return null;
  const span=Math.hypot(seg.x2-seg.x1,seg.y2-seg.y1)||1;
  const ang=seg.angle!=null?seg.angle:Math.atan2(seg.y2-seg.y1,seg.x2-seg.x1);
  const wLo=cx-r, wHi=cx+r;
  if(wHi<Math.min(seg.x1,seg.x2)-COLL_SEAM||wLo>Math.max(seg.x1,seg.x2)+COLL_SEAM) return null;
  if(Math.abs(ang)<0.055){
    const samples=loose?[cx,cx-r*0.9,cx+r*0.9]:[cx-r*0.85,cx,cx+r*0.85];
    let best=null, hits=0;
    for(const x of samples){
      const y=_segYAtX(seg,x);
      if(y===null) continue;
      hits++;
      if(best===null||y>best) best=y;
    }
    if(hits<(loose?1:2)) return null;
    if(!loose&&_segYAtX(seg,cx)===null) return null;
    return best;
  }
  let bestFeet=null;
  const steps=loose?5:7;
  for(let i=0;i<=steps;i++){
    const a=Math.PI*0.55+(i/steps)*Math.PI*0.9;
    const px=cx+Math.cos(a)*r;
    const sy=_segYAtX(seg,px);
    if(sy===null) continue;
    const rimY=cy+Math.sin(a)*r;
    const feet=rimY>=sy-0.5?Math.max(rimY,sy):sy;
    if(bestFeet===null||feet>bestFeet) bestFeet=feet;
  }
  const syC=_segYAtX(seg,cx);
  if(syC!==null){
    const bottom=cy+r;
    const feet=bottom>=syC-0.5?Math.max(bottom,syC):syC;
    if(bestFeet===null||feet>bestFeet) bestFeet=feet;
  }
  return bestFeet;
}
function _floorSegSupportY(seg,cx,loose,feetY){
  const sy=_segYAtX(seg,cx);
  const cy=feetY!=null?feetY-WHEEL_R:(sy!=null?sy-WHEEL_R:0);
  return _wheelSegFeetY(seg,cx,cy,WHEEL_R,loose);
}
function _floorSegAllowed(seg,cx,feetY){
  if(!seg) return false;
  if(!_tileGrassSegUsable(seg)) return false;
  if(seg.walkKind==='tile-grass') return true;
  if(seg.walkKind==='poly') return _polyWalkUsable(seg,cx,feetY);
  if(!seg.walkKind) return true;
  return false;
}
function _findFloorBelow(cx,feetY,maxDrop,opts){
  opts=opts||{};
  const maxUp=opts.maxUp!=null?opts.maxUp:28;
  const dropLim=maxDrop!=null?maxDrop:((typeof WH!=='undefined'?WH:3200)+256);
  let best=null;
  for(const seg of COLL_SEGS){
    if(!_floorSegAllowed(seg,cx,feetY)) continue;
    const y=_floorSegSupportY(seg,cx,!!opts.loose,feetY);
    if(y===null) continue;
    const drop=y-feetY;
    if(drop<-maxUp||drop>dropLim) continue;
    if(best===null||y<best) best=y;
  }
  if(best===null&&typeof _grassSurfaceYNear==='function'){
    const gy=_grassSurfaceYNear(cx,feetY,Math.max(96,maxUp*4),dropLim);
    if(gy!=null&&gy>=feetY-maxUp&&(best===null||gy<best)) best=gy;
  }
  return best;
}
function _findMainFloorBelow(cx,feetY,maxDrop){
  const dropLim=maxDrop!=null?maxDrop:((typeof WH!=='undefined'?WH:3200)+256);
  let best=null;
  for(const seg of COLL_SEGS){
    if(seg.walkKind!=='poly'||seg.floorKind!=='room') continue;
    if(COLL_POLYS.length&&!_isInsidePlayBoundary(cx,feetY)) continue;
    const y=_floorSegSupportY(seg,cx,false,feetY);
    if(y===null||y<feetY-24) continue;
    if(y-feetY>dropLim) continue;
    if(best===null||y>best) best=y;
  }
  if(best!==null) return best;
  return _findFloorBelow(cx,feetY,dropLim);
}
function _walkSegAllowed(seg,cx,feetY){
  if(!seg) return true;
  if(!_tileGrassSegUsable(seg)) return false;
  const kind=seg.walkKind;
  if(kind==='poly') return _polyWalkUsable(seg,cx,feetY);
  if(kind==='tile-grass'){
    if(!IMMERSED_POLYS.length) return true;
    return _isInImmersedZone(cx,feetY);
  }
  if(!kind&&!IMMERSED_POLYS.length) return true;
  return false;
}
function _querySegGround(pl,feet,prevFeet,landSlop){
  if(!COLL_SEGS.length) return null;
  const cx=pl.x+SW*0.5;
  const sup=_wheelSupportAt(cx,feet,{maxUp:28,maxDrop:landSlop+56,pl});
  if(!sup||sup.frac<WHEEL_MIN_SUPPORT) return null;
  const y=sup.y, seg=sup.seg||null;
  if(prevFeet!==null&&prevFeet>y+landSlop){ const drop=prevFeet-y; if(drop>COLL_LEDGE_STEP) return null; if(pl.vy<-0.35&&drop>10) return null; }
  const riseTol=pl.vy<0?8:LAND_FEET_TOL;
  if(feet<y-riseTol) return null;
  if(feet>y+Math.max(72,COLL_LEDGE_STEP+32)) return null;
  return {y,seg,angle:seg?seg.angle:0};
}
function _feetCanLandOn(feet,prevFeet,surfY){
  if(surfY==null||!isFinite(surfY)) return false;
  const tol=LAND_FEET_TOL;
  const gap=feet-surfY;
  if(gap>tol) return false;
  if(gap<-tol*2) return false;
  if(prevFeet!=null){
    if(prevFeet>surfY+tol&&feet<=surfY+tol) return true;
    if(prevFeet>feet+0.5&&feet>=surfY-tol&&feet<=surfY+tol) return true;
  }
  return feet>=surfY-tol&&feet<=surfY+tol;
}
function _walkableYForPlayer(pl){
  const feet=pl.y+FEET_OFF;
  const cx=pl.x+SW*0.5;
  return _pickWalkSurfaceY(cx,feet,{maxUp:24,maxDrop:GROUND_SINK_MAX+48,pl});
}
function _groundSurfaceAt(cx,feetHint=null,pl=null){
  if(feetHint==null) return _pickWalkSurfaceY(cx,1e9,{maxUp:3200,maxDrop:3200,loose:true,pl});
  return _pickWalkSurfaceY(cx,feetHint,{maxUp:40,maxDrop:GROUND_SINK_MAX+96,loose:true,pl});
}
function _clampFeetAboveFloor(pl){
  _wheelSettle(pl,{maxUp:40,maxDrop:GROUND_SINK_MAX+96,loose:true});
}

// ── Slope geometry ────────────────────────────────────────────
function _slopeUnderWheel(pl){
  if(!pl||!COLL_SEGS.length) return null;
  const cx=pl.x+SW*0.5, feet=pl.y+FEET_OFF;
  let best=null, bestDrop=1e9;
  _eachCollSegNear(cx,WHEEL_R+80,seg=>{
    if(seg.walkKind!=='poly') return;
    if(seg.floorKind!=='slope'&&Math.abs(seg.angle||0)<0.07) return;
    if(!_walkSegAllowed(seg,cx,feet)) return;
    const y=_floorSegSupportY(seg,cx,true,feet);
    if(y==null) return;
    const drop=Math.abs(y-feet);
    if(drop>36) return;
    if(drop<bestDrop){bestDrop=drop;best={seg,y,angle:seg.angle};}
  });
  return best;
}
function _wheelGripMul(pl,ang){
  const mom=Math.min(1.1,(pl.momentum||0)+Math.abs(pl.vx||0)/RUN*0.28);
  const run=Math.min(1,(pl.runRamp||0)*0.55+mom*0.45);
  const a=(ang!=null&&Number.isFinite(ang))?ang:0;
  const slopeGrip=Math.max(0.42,Math.cos(a)*0.5+0.58);
  return WHEEL_GRIP_BASE*(1+run*0.24)*slopeGrip;
}
function _sanitizeActorVel(a){
  if(!a) return;
  if(!Number.isFinite(a.vx)) a.vx=0;
  if(!Number.isFinite(a.vy)) a.vy=0;
}
function _surfaceUnderFeet(pl){
  const feet=pl.y+FEET_OFF;
  const y=_walkableYForPlayer(pl);
  if(y===null) return null;
  let seg=null, angle=0;
  if(COLL_SEGS.length){ const hit=_querySegGround(pl,feet,null,36); if(hit){seg=hit.seg;angle=hit.angle;} }
  return {y,seg,angle};
}
function _onWalkableTop(pl,plat){
  if(plat.tp!=='solid') return false;
  const feet=pl.y+FEET_OFF;
  const fL=pl.x+FEET_L, fR=fL+FEET_W;
  return _feetSpanOver(plat,fL,fR,4)&&feet>=plat.y-8&&feet<=plat.y+plat.h+10;
}
function _applySlopePhysics(pl){
  if(!pl||(pl.hook&&pl.hook.st==='on')||pl.wallGrip>0||_playerAirborne(pl)) return;
  if(_ridingBwallTop(pl)) return;
  if(pl._bwallFallGrace>0) return;
  if(!pl.og) return;
  const seg=pl._groundSeg;
  let ang=0;
  if(seg) ang=seg.angle!=null?seg.angle:Math.atan2(seg.y2-seg.y1,seg.x2-seg.x1);
  else ang=pl._slopeAngle||0;
  if(!Number.isFinite(ang)) ang=0;
  const isSlope=Math.abs(ang)>0.06;
  if(!isSlope){
    pl._onSlope=false;
    pl._slopeAngle=0;
    pl._prevSlopeVx=pl.vx||0;
    return;
  }
  pl._onSlope=true;
  pl._slopeAngle=ang;
  const sinA=Math.sin(ang);
  const gravAlong=GRAV*sinA*0.9;
  const mom=Math.min(1.2,(pl.momentum||0)+Math.abs(pl.vx||0)/RUN*0.4);
  const grip=_wheelGripMul(pl,ang);
  const input=pl===p?_moveInputX():0;
  const driving=!!input;
  const uphill=driving&&input*sinA<-0.03;
  const downhill=driving&&input*sinA>0.03;
  pl.vx+=gravAlong;
  const rollMul=1-WHEEL_ROLL_RESIST*(driving?0.35:1)*(1-mom*0.5)/grip;
  pl.vx*=Math.max(0.94,rollMul);
  if(driving){
    const torque=WHEEL_DRIVE_TORQUE*(1+mom*0.5)*(uphill?1.4:1);
    pl.vx+=input*torque;
    if(uphill) pl.vx-=Math.sign(pl.vx||input)*Math.abs(gravAlong)*WHEEL_GRADE_RESIST*(1-mom*0.45);
    else if(downhill) pl.vx+=input*Math.abs(gravAlong)*0.18;
  }else{
    pl.vx*=WHEEL_COAST_FRIC;
    if(Math.abs(pl.vx)<0.07&&Math.abs(gravAlong)<0.015) pl.vx=0;
  }
  const slopeCap=RUN*(1.05+mom*0.08);
  pl.vx=Math.max(-slopeCap,Math.min(slopeCap,pl.vx));
  const wt=typeof _wallTouchInfo==='function'?_wallTouchInfo(pl):{touch:false,dir:0};
  if(wt.touch){
    if(wt.dir>0&&(pl.vx||0)>0) pl.vx=0;
    if(wt.dir<0&&(pl.vx||0)<0) pl.vx=0;
  }
  if(pl._moveBlocked&&input){
    if(input>0) pl.vx=Math.min(pl.vx||0,0);
    else pl.vx=Math.max(pl.vx||0,0);
  }
  const ducking=pl.crouchInput||(pl.crouchAmt||0)>0.25||(pl===p&&pl.og&&isDn());
  if(ducking){ const duckAmt=Math.max(pl.crouchAmt||0,pl.crouchInput?0.9:0.5); pl.vx*=Math.pow(0.55,1+duckAmt*1.4); if(Math.abs(pl.vx)<0.07) pl.vx=0; }
  pl.wheelTorque=(pl.vx-(pl._prevSlopeVx||0))*0.55;
  pl._prevSlopeVx=pl.vx;
  if(pl.vy>2) pl.vy=Math.min(pl.vy,2);
}
function _wheelEdgeRoll(pl){
  if(!pl||!pl.og) return;
  if(_ridingBwallTop(pl)) return;
  if(pl.hook&&pl.hook.st==='on') return;
  if(pl._onSlope) return;
  if((pl._groundHold||0)>0) return;
  const wt0=typeof _wallTouchInfo==='function'?_wallTouchInfo(pl):{touch:false,dir:0};
  if(wt0.touch) return;
  const ducked=(pl.crouchAmt||0)>0.25||(pl===p&&!!pl.crouchInput);
  if(ducked) return;
  const cx=pl.x+SW*0.5, feet=pl.y+FEET_OFF;
  const cur=_wheelSupportAt(cx,feet,{maxUp:12,maxDrop:GROUND_SINK_MAX+16});
  if(!cur||cur.frac>=WHEEL_EDGE_ROLL) return;
  if(Math.abs(pl.vx||0)<0.45&&cur.frac>=WHEEL_MIN_SUPPORT) return;
  const overhang=1-cur.frac;
  const rimDir=_wheelOverhangDir(cx,cur,pl.vx);
  const probeX=cx+rimDir*(WHEEL_R*0.7);
  const dropSurf=typeof _pickWalkSurfaceY==='function'
    ?_pickWalkSurfaceY(probeX,feet+6,{maxUp:6,maxDrop:COLL_LEDGE_STEP+40,loose:true})
    :null;
  const lean=overhang/(1-WHEEL_MIN_SUPPORT+0.08);
  const wt=typeof _wallTouchInfo==='function'?_wallTouchInfo(pl):{touch:false,dir:0};
  const wallBlock=wt.touch&&wt.dir===rimDir;
  if(dropSurf!=null&&dropSurf>cur.y+3){
    pl.vx+=rimDir*(0.16+lean*0.5);
    if(cur.frac<WHEEL_MIN_SUPPORT||lean>0.55){
      if(!wallBlock){
        pl.og=false;
        pl.vy=Math.max(pl.vy||0,0.5+lean*0.35);
        pl.vx+=rimDir*lean*0.35;
      }
    }
    return;
  }
  if(cur.frac<WHEEL_MIN_SUPPORT*0.9&&!wallBlock){
    pl.og=false;
    pl.vy=Math.max(pl.vy||0,0.45+lean*0.25);
    pl.vx+=rimDir*(0.08+lean*0.2);
  }else if(lean>0.45&&!wallBlock){
    pl.vx+=rimDir*(0.1+lean*0.28);
    if(lean>0.82){pl.og=false;pl.vy=Math.max(pl.vy||0,0.38);}
  }
}
function _feetSpanOver(plat,fL,fR,seam=COLL_SEAM){ return fR>plat.x-seam&&fL<plat.x+plat.w+seam; }
function _feetPlatSpan(pl,plat,seam=COLL_SEAM){ const fL=pl.x+FEET_L, fR=fL+FEET_W; return _feetSpanOver(plat,fL,fR,seam); }
function _platNearX(plat,cx,pad){ return plat.x+plat.w>=cx-pad&&plat.x<=cx+pad; }
function _mergeCollRects(rects,gap=COLL_SEAM){
  const solid=rects.filter(r=>(Array.isArray(r)?r[4]:r.tp||'solid')==='solid').map(r=>{
    if(Array.isArray(r)) return r.slice();
    const out=[r.x,r.y,r.w,r.h,r.tp||'solid']; if(r.poly) out[5]='poly'; return out;
  });
  const other=rects.filter(r=>(Array.isArray(r)?r[4]:r.tp||'solid')!=='solid');
  let changed=true;
  while(changed){
    changed=false;
    outer:for(let i=0;i<solid.length;i++){
      for(let j=i+1;j<solid.length;j++){
        const a=solid[i], b=solid[j];
        if(Math.abs(a[1]-b[1])<=gap&&Math.abs(a[3]-b[3])<=gap){
          const aR=a[0]+a[2], bR=b[0]+b[2];
          if(aR>=b[0]-gap&&a[0]<=bR+gap){
            const nx=Math.min(a[0],b[0]), nr=Math.max(aR,bR);
            solid[i]=[nx,Math.min(a[1],b[1]),nr-nx,Math.max(a[3],b[3]),'solid',(a[5]==='poly'||b[5]==='poly')?'poly':a[5]||b[5]];
            solid.splice(j,1); changed=true; break outer;
          }
        }
        if(Math.abs(a[0]-b[0])<=gap&&Math.abs(a[2]-b[2])<=gap){
          const aB=a[1]+a[3], bB=b[1]+b[3];
          if(aB>=b[1]-gap&&a[1]<=bB+gap){
            const ny=Math.min(a[1],b[1]), nb=Math.max(aB,bB);
            solid[i]=[a[0],ny,a[2],nb-ny,'solid',(a[5]==='poly'||b[5]==='poly')?'poly':a[5]||b[5]];
            solid.splice(j,1); changed=true; break outer;
          }
        }
      }
    }
  }
  return solid.concat(other);
}

// ── Wall segment resolution ───────────────────────────────────
function _wallXAtY(seg,y){
  const dy=seg.y2-seg.y1;
  if(Math.abs(dy)<0.5) return (seg.x1+seg.x2)*0.5;
  const t=Math.max(0,Math.min(1,(y-seg.y1)/dy));
  return seg.x1+(seg.x2-seg.x1)*t;
}
function _resolveWallSegBodyX(pl,seg){
  if(seg.nx!=null) return _resolveBarrierSeg(pl,seg);
  const h=playerCoreHB(pl);
  const bodyL=h.x, bodyR=h.x+h.w, bodyT=h.y, bodyB=h.y+h.h;
  if(bodyB<=seg.minY||bodyT>=seg.maxY) return false;
  const wallX=_wallXAtY(seg,(bodyT+bodyB)*0.5);
  if(bodyR<=wallX||bodyL>=wallX) return false;
  const penL=bodyR-wallX, penR=wallX-bodyL;
  const cap=_xPushCap(pl);
  const vx=pl.vx||0;
  let pushLeft;
  if(seg.insideLeft) pushLeft=vx>0.12||(vx>=-0.12&&vx<=0.12&&penL<=penR);
  else pushLeft=vx<-0.12||(vx>=-0.12&&vx<=0.12&&penL<penR);
  const push=Math.min(pushLeft?penL:penR,cap);
  if(push<=0) return false;
  if(pushLeft){ pl.x-=push; if((pl.vx||0)>0) pl.vx=0; }
  else{ pl.x+=push; if((pl.vx||0)<0) pl.vx=0; }
  return true;
}
function _feetOnWalkSurface(pl){
  if(!pl) return false;
  const cx=pl.x+SW*0.5, feet=pl.y+FEET_OFF;
  const sup=_wheelSupportAt(cx,feet,{maxUp:LAND_FEET_TOL+8,maxDrop:LAND_FEET_TOL+12,loose:true,pl});
  return sup!=null&&sup.frac>=WHEEL_MIN_SUPPORT&&feet>=sup.y-LAND_FEET_TOL-4&&feet<=sup.y+LAND_FEET_TOL+6;
}
function _resolveKeepOutBarrier(pl,seg){
  if(!seg||seg.nx==null) return false;
  const probes=_wheelProbePoints(pl).concat(_bodyProbePoints(pl));
  let pushX=0,pushY=0,hit=false,maxPen=0;
  const feet=pl.y+FEET_OFF;
  const onWalk=pl.og||_feetOnWalkSurface(pl);
  const vertWall=Math.abs(seg.nx)>0.62&&Math.abs(seg.ny)<0.42;
  const floorLip=Math.abs(seg.ny)>0.62&&Math.abs(seg.nx)<0.42;
  for(const pr of probes){
    const cp2=_segClosestPoint(seg,pr.x,pr.y);
    const vx=pr.x-cp2.x, vy=pr.y-cp2.y;
    const dist=Math.hypot(vx,vy)||0.001;
    const intoSolid=vx*seg.nx+vy*seg.ny;
    if(intoSolid<=0.65) continue;
    const pen=pr.r+COLL_SEAM*0.12-dist;
    if(pen<=0) continue;
    pushX-=seg.nx*pen;
    pushY-=seg.ny*pen;
    maxPen=Math.max(maxPen,pen);
    hit=true;
  }
  if(!hit||maxPen<0.45) return false;
  let applyY=true;
  if(onWalk&&vertWall){
    applyY=false;
    const cp=_segClosestPoint(seg,pl.x+SW*0.5,feet);
    const atFloorJunction=Math.abs(feet-cp.y)<=GROUND_SINK_MAX+10&&Math.hypot(pl.x+SW*0.5-cp.x,feet-cp.y)<28;
    if(atFloorJunction) pushX*=0.25;
  }
  if(onWalk&&floorLip){
    const cp=_segClosestPoint(seg,pl.x+SW*0.5,feet);
    const standOnLip=Math.abs(feet-cp.y)<=GROUND_SINK_MAX+8&&maxPen<1.5;
    if(standOnLip) applyY=false;
  }
  pl.x+=pushX;
  if(applyY) pl.y+=pushY;
  if(COLL_POLYS.length&&!_isInsidePlayBoundary(pl.x+SW*0.5,pl.y+FEET_OFF)){
    pl.x-=pushX;
    if(applyY) pl.y-=pushY;
    return false;
  }
  const nx=seg.nx, ny=seg.ny;
  const vn=(pl.vx||0)*nx+(pl.vy||0)*ny;
  if(vn>0&&maxPen>0.4){
    pl.vx-=nx*vn;
    if(applyY) pl.vy-=ny*vn;
  }
  return true;
}
function _resolveBarrierSeg(pl,seg){
  return _resolveKeepOutBarrier(pl,seg);
}
function _resolvePlatBodyX(pl,plat){
  if(plat.tp!=='solid') return false;
  const feet=pl.y+FEET_OFF;
  const fL=pl.x+FEET_L, fR=fL+FEET_W;
  if(plat.bw){
    if(_bwallFeetSideClear(pl,plat,fL,fR,feet)) return false;
  }else if(_feetSpanOver(plat,fL,fR,8)&&feet>=plat.y-14&&feet<=plat.y+24){
    return false;
  }
  if(_playerStandingOnPlat(pl,plat)) return false;
  if(_platSideCollisionSkip(pl,plat)) return false;
  const h=playerCoreHB(pl);
  if(!ov(h.x,h.y,h.w,h.h,plat.x,plat.y,plat.w,plat.h)) return false;
  if(plat.poly&&_useSegGround&&plat.h<=32){
    if(_onWalkableTop(pl,plat)) return false;
    const sidePenL=h.x+h.w-plat.x, sidePenR=plat.x+plat.w-h.x;
    const yPen=Math.min(h.y+h.h-plat.y,plat.y+plat.h-h.y);
    const xPen=Math.min(sidePenL,sidePenR);
    const onFloorStrip=feet>=plat.y-6&&feet<=plat.y+plat.h+10;
    if(onFloorStrip&&xPen<=yPen+4) return false;
  }
  const penL=(h.x+h.w)-plat.x, penR=(plat.x+plat.w)-h.x;
  if(penL<=0||penR<=0) return false;
  if(penL<=penR){
    pl.x-=penL+COLL_CONTACT_GAP;
    if((pl.vx||0)>0) pl.vx=0;
  }else{
    pl.x+=penR+COLL_CONTACT_GAP;
    if((pl.vx||0)<0) pl.vx=0;
  }
  return true;
}
function _ridingBwallTop(pl){
  if(!pl) return null;
  for(const bw of BWALLS){
    if(!bw||bw.hp<=0) continue;
    if(_playerRidingBoxTop(pl,bw)) return bw;
  }
  return null;
}
function _playerRidingBoxTop(pl,box){
  if(!pl||!box) return false;
  const feet=pl.y+FEET_OFF;
  const fL=pl.x+FEET_L, fR=fL+FEET_W;
  if(!_feetSpanOver(box,fL,fR,16)) return false;
  return feet>=box.y-10&&feet<=box.y+16;
}
function _playerOnSolidTop(pl,box){
  return _playerRidingBoxTop(pl,box);
}
function _playerStandingOnPlat(pl,plat){
  if(plat.bw) return _playerOnSolidTop(pl,plat);
  const feet=pl.y+FEET_OFF;
  const fL=pl.x+FEET_L, fR=fL+FEET_W;
  if(!_feetSpanOver(plat,fL,fR,4)) return false;
  const topTol=plat.h>20?8:12;
  return feet>=plat.y-10&&feet<=plat.y+topTol;
}
function resolveBodyX(pl){
  const passes=Math.abs(pl.vx||0)>WLK+2?8:4;
  const cx=pl.x+SW*0.5, xPad=SW+40;
  const riding=_ridingBwallTop(pl);
  for(let pass=0;pass<passes;pass++){
    let moved=false;
    for(const plat of allP()){
      if(plat.tp!=='solid') continue;
      if(plat.poly&&_useSegGround) continue;
      if(!_platNearX(plat,cx,xPad)) continue;
      if(_resolvePlatBodyX(pl,plat)) moved=true;
    }
    const h=playerCoreHB(pl);
    for(const c of CRATES){
      if(!ov(h.x,h.y,h.w,h.h,c.x,c.y,c.w,c.h)) continue;
      const penL=(h.x+h.w)-c.x, penR=(c.x+c.w)-h.x;
      if(penL<=penR){ pl.x-=penL; if((pl.vx||0)>0) pl.vx=0; }
      else{ pl.x+=penR; if((pl.vx||0)<0) pl.vx=0; }
      moved=true;
    }
    if(!riding){
      for(const seg of COLL_WALL_SEGS){
        if(_keepOutBarrierRedundantWithBwall(pl,seg)) continue;
        if(_resolveKeepOutBarrier(pl,seg)) moved=true;
      }
    }
    if(!moved) break;
  }
}
function resX(){ resolveBodyX(p); }

// ── Y resolution ──────────────────────────────────────────────
function resolvePlatY(pl,prevFeet){
  const wasOg=pl.og||(pl._groundHold||0)>0;
  const feet=pl.y+FEET_OFF;
  const fL=pl.x+FEET_L, fR=fL+FEET_W;
  const h=playerCoreHB(pl);
  const landSlop=Math.max(12,Math.abs(pl.vy)+10);
  if(pl.vy>=0){
    const cx=pl.x+SW*0.5;
    let bestTop=null, landSeg=null, landAng=0;
    if(_useSegGround&&COLL_SEGS.length){
      const sup=_wheelSupportAt(cx,feet,{maxUp:landSlop+12,maxDrop:landSlop+56,pl});
      if(sup&&sup.frac>=WHEEL_MIN_SUPPORT) bestTop=sup.y;
      if(sup&&sup.seg){ landSeg=sup.seg; landAng=sup.seg.angle||0; }
    }else{
      const slopeSurf=_querySegGround(pl,feet,prevFeet,landSlop);
      if(slopeSurf){ bestTop=slopeSurf.y; landSeg=slopeSurf.seg; landAng=slopeSurf.angle; pl._onSlope=Math.abs(slopeSurf.angle)>0.09; }
      const picked=typeof _pickWalkSurfaceY==='function'?_pickWalkSurfaceY(cx,feet,{maxUp:landSlop+12,maxDrop:landSlop+56,pl}):null;
      if(picked!=null&&(bestTop===null||picked<bestTop)) bestTop=picked;
      for(const plat of allP()){
        if(plat.tp!=='solid') continue;
        if(plat.poly&&_useSegGround) continue;
        if(!_platNearX(plat,pl.x+SW*0.5,SW+48)) continue;
        if(!_feetSpanOver(plat,fL,fR,plat.bw?12:0)) continue;
        if(prevFeet>plat.y+landSlop) continue;
        if(feet<plat.y-LAND_FEET_TOL) continue;
        if(feet>plat.y+plat.h) continue;
        if(bestTop===null||plat.y<bestTop) bestTop=plat.y;
      }
      if(bestTop!==null){
        const wSup=_wheelSupportAt(cx,feet,{maxUp:landSlop+12,maxDrop:landSlop+56,pl});
        if(!wSup||wSup.frac<WHEEL_MIN_SUPPORT||Math.abs(wSup.y-bestTop)>12) bestTop=null;
      }
    }
    if(bestTop===null&&typeof _findFloorBelow==='function'&&!(_useSegGround&&COLL_SEGS.length)){
      const tileY=_findFloorBelow(cx,feet,Math.max(landSlop,COLL_LEDGE_STEP)+96);
      if(tileY!==null) bestTop=tileY;
    }
    if(bestTop!==null&&!_feetCanLandOn(feet,prevFeet,bestTop)) bestTop=null;
    if(bestTop!==null){
      if(pl.hook&&pl.hook.st==='on') return;
      const landVy=pl.vy, impactVy=Math.max(landVy,pl._peakVy||0);
      pl._peakVy=0;
      const gap=bestTop-feet;
      if(!wasOg||Math.abs(gap)>WHEEL_SETTLE_TOL) pl.y=bestTop-FEET_OFF;
      pl.vy=0;
      pl.og=true;
      pl._groundSeg=landSeg;
      pl._slopeAngle=landAng;
      pl._onSlope=Math.abs(landAng)>0.06;
      if(!wasOg&&(pl._groundHold||0)<=0){
        const landAmp=Math.min(1,Math.max(0.22,impactVy/10));
        pl._landAmp=landAmp;
        pl.landF=Math.round(10+landAmp*22);
        pl.jumpTiltF=0;
        pl.suspComp=Math.min(1,Math.max(pl.suspComp||0,landAmp*0.82));
        pl.suspVel=Math.max(pl.suspVel||0,landAmp*0.14);
        if(pl===p&&!(pl.hook&&pl.hook.st==='on')) sfx('land');
      }
      pl._groundHold=10;
      if(!wasOg&&landVy>5.5) pl.vy=-Math.min(0.9,landVy*0.08);
      return;
    }
    if(!wasOg) pl.og=false;
  }else{
    pl.og=false;
  }
  for(const plat of allP()){
    if(plat.tp==='oneway'){
      if(pl.hook&&pl.hook.st==='on') continue;
      if(!_platNearX(plat,pl.x+SW*0.5,SW+32)) continue;
      if(pl.vy>=0&&_feetSpanOver(plat,fL,fR)&&prevFeet<=plat.y+landSlop&&feet>=plat.y-2){
        pl.y=plat.y-FEET_OFF; pl.vy=0; pl.og=true;
        if(plat.mv) pl.x+=plat.mv.dx;
        if(plat.mp) pl.x+=plat.mp.vx*0.5;
      }
    }else if(plat.tp==='solid'||plat.tp==='ceil'){
      if(plat.bw&&_playerRidingBoxTop(pl,plat)) continue;
      if(!_platNearX(plat,pl.x+SW*0.5,SW+32)) continue;
      const useBodyCeil=_useBodyCeilCollider(pl);
      const body=playerCoreHB(pl);
      const head=playerHeadWorld(pl);
      if(pl.vy<0){
        if(useBodyCeil){
          if(fR>plat.x&&fL<plat.x+plat.w){
            const ceilB=plat.y+plat.h, bTop=body.y;
            if(bTop<ceilB&&bTop+body.h>plat.y){pl.y+=ceilB-bTop;pl.vy=0;pl._autoHeadTuck=Math.min(1,Math.max(pl._autoHeadTuck||0,0.9));}
          }
        }else if(_circleRectOverlap(head.cx,head.cy,head.r,plat.x,plat.y,plat.w,plat.h)){
          const ceilB=plat.y+plat.h, headTop=head.cy-head.r;
          if(headTop<ceilB){pl.y+=ceilB-headTop;pl.vy=0;pl._autoHeadTuck=Math.min(1,(pl._autoHeadTuck||0)+0.18);}
        }else if(ov(h.x,h.y,h.w,h.h,plat.x,plat.y,plat.w,plat.h)){
          pl.y=plat.y+plat.h-(FEET_OFF-(pl===p?hbH(pl.crouchAmt):STAND_H));
          pl.vy=0;
        }
      }
    }
  }
  if(pl.vy<=0) _resolveHeadCeiling(pl);
}
function resY(prevFeet){ resolvePlatY(p,prevFeet); }
function _bwallOverlapsPlayer(bw,pl){ if(!pl) return false; const h=playerCoreHB(pl); return ov(h.x,h.y,h.w,h.h,bw.x,bw.y,bw.w,bw.h); }
function _resolvePlayerOutOfBwalls(pl){
  if(!pl) return;
  const head=playerHeadWorld(pl);
  const feet=pl.y+FEET_OFF;
  const fL=pl.x+FEET_L, fR=fL+FEET_W;
  const cx=pl.x+SW*0.5;
  for(const bw of BWALLS){
    if(bw.hp<=0) continue;
    if(pl._bwallFallGrace>0) continue;
    if(_feetSpanOver(bw,fL,fR,16)&&_bwallCenterSupports(cx,bw)&&_feetCanLandOn(feet,pl._prevLandFeet,bw.y)){
      if(feet>bw.y+GROUND_SINK_MAX+2) pl.y=bw.y-FEET_OFF;
      pl.og=true;
      if(pl.vy>0) pl.vy=0;
      continue;
    }
    if(pl.vy<0){
      const useBodyCeil=_useBodyCeilCollider(pl);
      if(useBodyCeil){
        const body=playerCoreHB(pl);
        if(body.x+body.w>bw.x&&body.x<bw.x+bw.w){
          const ceilB=bw.y+bw.h, bTop=body.y;
          if(bTop<ceilB&&bTop+body.h>bw.y){pl.y+=ceilB-bTop;pl.vy=0;pl._autoHeadTuck=Math.min(1,Math.max(pl._autoHeadTuck||0,0.9));}
        }
      }else if(_circleRectOverlap(head.cx,head.cy,head.r,bw.x,bw.y,bw.w,bw.h)){
        const ceilB=bw.y+bw.h, headTop=head.cy-head.r;
        if(headTop<ceilB&&head.cy<bw.y+bw.h*0.55){
          pl.y+=ceilB-headTop;
          pl.vy=0;
        }
      }
    }
  }
}
function _isCeilingSeg(seg,bodyTop,feet){
  if(!seg) return false;
  const segY=(seg.y1+seg.y2)*0.5;
  if(segY>=feet-GROUND_SINK_MAX-6) return false;
  if(segY>bodyTop+STAND_H+24) return false;
  return true;
}
function _headroomAboveBody(pl){
  const body=playerCoreHB(pl);
  const bodyTop=body.y;
  const feet=pl.y+FEET_OFF;
  const fL=body.x, fR=body.x+body.w;
  const cx=pl.x+SW*0.5;
  let minGap=999;
  if(COLL_SEGS.length){
    _eachCollSegNear(cx,BODY_W+56,seg=>{
      if(!_floorSegAllowed(seg,cx,feet)) return;
      if(!_isCeilingSeg(seg,bodyTop,feet)) return;
      const segY=Math.min(seg.y1,seg.y2);
      if(Math.abs(seg.angle||0)>0.14) return;
      const sLo=Math.min(seg.x1,seg.x2), sHi=Math.max(seg.x1,seg.x2);
      if(fR<=sLo-2||fL>=sHi+2) return;
      const gap=segY-bodyTop;
      if(gap>=0&&gap<minGap) minGap=gap;
    });
  }
  for(const plat of allP()){
    if(plat.tp!=='solid'&&plat.tp!=='ceil') continue;
    if(plat.x+plat.w<=fL||plat.x>=fR) continue;
    if(plat.y>=feet-GROUND_SINK_MAX-4) continue;
    const ceilB=plat.y+plat.h;
    const gap=ceilB-bodyTop;
    if(gap>=0&&gap<minGap) minGap=gap;
  }
  return minGap;
}
function _useBodyCeilCollider(pl){
  return _playerAirborne(pl)||(pl._autoHeadTuck||0)>=0.35;
}
function _resolveHeadCeiling(pl){
  if(!pl) return;
  const airborne=_playerAirborne(pl);
  const cx=pl.x+SW*0.5;
  const room=_headroomAboveBody(pl);
  if(airborne&&room<STAND_H+10){
    const tuck=room<=BODY_H+6?1:1-Math.max(0,room-(BODY_H+6))/(STAND_H-BODY_H+8);
    pl._autoHeadTuck=Math.min(1,Math.max(pl._autoHeadTuck||0,tuck));
  }
  const useBody=_useBodyCeilCollider(pl);
  let hit=false;
  const collTop=()=>useBody?playerCoreHB(pl).y:(playerHeadWorld(pl).cy-playerHeadWorld(pl).r);
  const bumpDown=(ceilY)=>{
    const top=collTop();
    if(top<ceilY){
      pl.y+=ceilY-top;
      if(pl.vy<0) pl.vy=0;
      pl._autoHeadTuck=Math.min(1,Math.max(pl._autoHeadTuck||0,useBody?0.9:0.22));
      return true;
    }
    return false;
  };
  const body=playerCoreHB(pl);
  const fL=body.x, fR=body.x+body.w;
  const feet=pl.y+FEET_OFF;
  if(COLL_SEGS.length){
    _eachCollSegNear(cx,BODY_W+56,seg=>{
      if(!_floorSegAllowed(seg,cx,feet)) return;
      if(!_isCeilingSeg(seg,body.y,feet)) return;
      const segY=(seg.y1+seg.y2)*0.5;
      if(Math.abs(seg.angle||0)>0.14) return;
      const sLo=Math.min(seg.x1,seg.x2), sHi=Math.max(seg.x1,seg.x2);
      if(fR<=sLo-2||fL>=sHi+2) return;
      if(bumpDown(segY)) hit=true;
    });
  }
  for(const seg of COLL_WALL_SEGS){
    if(seg.nx==null||seg.ny>=-0.25) continue;
    const px=useBody?cx:playerHeadWorld(pl).cx;
    const py=useBody?collTop():playerHeadWorld(pl).cy;
    const pr=useBody?6:playerHeadWorld(pl).r;
    const cp=_segClosestPoint(seg,px,py);
    const vx=px-cp.x, vy=py-cp.y;
    const dist=Math.hypot(vx,vy)||0.001;
    const intoSolid=vx*seg.nx+vy*seg.ny;
    if(intoSolid<=0) continue;
    const pen=pr+COLL_SEAM*0.25-dist;
    if(pen<=0) continue;
    pl.x-=seg.nx*pen;
    pl.y-=seg.ny*pen;
    if(pl.vy<0) pl.vy=0;
    pl._autoHeadTuck=Math.min(1,(pl._autoHeadTuck||0)+0.35);
    hit=true;
  }
  for(const plat of allP()){
    if(plat.tp!=='ceil'&&plat.tp!=='solid') continue;
    if(plat.bw&&_playerRidingBoxTop(pl,plat)) continue;
    if(!_platNearX(plat,cx,SW+24)) continue;
    if(useBody){
      if(fR<=plat.x||fL>=plat.x+plat.w) continue;
      if(bumpDown(plat.y+plat.h)) hit=true;
    }else{
      const head=playerHeadWorld(pl);
      if(!_circleRectOverlap(head.cx,head.cy,head.r,plat.x,plat.y,plat.w,plat.h)) continue;
      if(bumpDown(plat.y+plat.h)) hit=true;
    }
  }
  if(!hit){
    if(!airborne) pl._autoHeadTuck=Math.max(0,(pl._autoHeadTuck||0)-0.05);
    else if(room>STAND_H+16) pl._autoHeadTuck=Math.max(0,(pl._autoHeadTuck||0)-0.04);
  }
}

function _pushGrindBlocked(pl){
  return !!(pl&&(pl._grindF||0)>=8);
}
function _syncPushGrind(pl){
  if(!pl||pl!==p) return;
  const dir=typeof _moveInputX==='function'?_moveInputX():0;
  if(!dir||!pl.og){ pl._grindF=0; return; }
  const ux=pl._ux0;
  if(ux==null){ pl._grindF=0; return; }
  const d=pl.x-ux;
  const stalled=(dir>0&&d<1.5)||(dir<0&&d>-1.5);
  if(stalled) pl._grindF=(pl._grindF||0)+1;
  else if(Math.abs(d)>=4) pl._grindF=0;
  else pl._grindF=Math.max(0,(pl._grindF||0)-1);
  if((pl._grindF||0)>=3&&_cornerStepResolve(pl)){ pl._grindF=0; return; }
  if((pl._grindF||0)>=8) pl.vx=0;
}
function _haltBlockedMove(pl,x0,y0,vx,vy){
  if(!pl) return;
  const input=pl===p&&typeof _moveInputX==='function'?_moveInputX():0;
  const dx=pl.x-x0, dy=pl.y-y0;
  const tryCorner=!!(input&&_playerOnGround(pl)&&(pl._grindF||0)>=2);
  if(Math.abs(vx)>0.05){
    const moved=Math.abs(dx), expected=Math.abs(vx);
    if(moved<expected*0.55){
      if(tryCorner&&_cornerStepResolve(pl)) return;
      if((input>0&&vx>0)||(input<0&&vx<0)||!input) pl.vx=0;
    }
    if(Math.abs(vx)>1.2&&moved<1.5){
      if(tryCorner&&_cornerStepResolve(pl)) return;
      if((input>0&&vx>0)||(input<0&&vx<0)||!input) pl.vx=0;
    }
  }
  if(Math.abs(vy)>0.05){
    const moved=Math.abs(dy), expected=Math.abs(vy);
    if(moved<expected*0.55) pl.vy=0;
  }
}
function _haltVelocityAtContacts(pl){
  if(!pl||(pl.hook&&pl.hook.st==='on')||pl.wallGrip>0) return;
  const wt=typeof _wallTouchInfo==='function'?_wallTouchInfo(pl):{touch:false,dir:0};
  if(!wt.touch) return;
  if(wt.dir>0&&(pl.vx||0)>0) pl.vx=0;
  if(wt.dir<0&&(pl.vx||0)<0) pl.vx=0;
}

function _cornerStepResolve(pl){
  if(!pl||pl.hook&&pl.hook.st==='on'||pl.wallGrip>0) return false;
  if(!_playerOnGround(pl)) return false;
  const input=pl===p&&typeof _moveInputX==='function'?_moveInputX():0;
  if(!input) return false;
  const wt=_wallTouchInfo(pl);
  const stalled=(pl._grindF||0)>=2;
  const blockedIntoWall=wt.touch&&wt.dir===input;
  if(!blockedIntoWall&&!stalled) return false;
  const x0=pl.x, y0=pl.y;
  const lifts=_tileCampaignActive()?[4,8,12,16,24,32,40]:[4,7,11,16,22];
  for(const lift of lifts){
    pl.y=y0-lift;
    pl.x=x0+input*3;
    resolveBodyX(pl);
    if(Math.abs(pl.x-x0)>=1){
      const prevFeet=y0+FEET_OFF;
      resolvePlatY(pl,prevFeet);
      if(_playerOnGround(pl)){ pl._groundHold=Math.max(pl._groundHold||0,6); return true; }
    }
    pl.x=x0; pl.y=y0;
  }
  return false;
}
function _unstickWallCorner(pl){
  if(!pl) return;
  _cornerStepResolve(pl);
  if(!_playerOnGround(pl)) return;
  const input=pl===p&&typeof _moveInputX==='function'?_moveInputX():0;
  if(!input) return;
  const x0=pl.x;
  pl.x+=input*2;
  resolveBodyX(pl);
  if(Math.abs(pl.x-x0)<0.4){
    pl.x=x0;
    _cornerStepResolve(pl);
  }
}

// ── Multi-step player move ────────────────────────────────────
function _movePlayerWithColl(pl,vx,vy){
  const x0=pl.x, y0=pl.y;
  const stepSz=(pl===p&&(Math.abs(vx)>WLK+0.5||Math.abs(vy)>8))?2:COLL_MOVE_STEP;
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(vx),Math.abs(vy))/stepSz));
  for(let i=0;i<steps;i++){
    const sx2=vx/steps, sy2=vy/steps;
    pl.x+=sx2;
    if(pl.x<0){pl.x=0;pl.vx=0;}
    if(pl.x>WW-SW){pl.x=WW-SW;pl.vx=0;}
    resolveBodyX(pl);
    const pf=pl.y+FEET_OFF;
    pl.y+=sy2;
    resolvePlatY(pl,pf);
    if(sy2!==0) _resolvePlayerOutOfBwalls(pl);
    if(pl.og&&sy2>0) break;
  }
  _haltVelocityAtContacts(pl);
  _haltBlockedMove(pl,x0,y0,vx,vy);
  if(pl===p&&typeof _moveInputX==='function'&&_moveInputX()) _cornerStepResolve(pl);
  pl._prevLandFeet=pl.y+FEET_OFF;
}

// ── Actor (enemy) physics ─────────────────────────────────────
function _actorFeetSpan(a,feetOff){
  const pad=Math.max(4,Math.floor(a.w*0.16)), cx=a.x+a.w/2;
  const half=Math.max(6,Math.floor((a.w-pad*2)*0.5));
  return {fL:cx-half,fR:cx+half,feet:a.y+feetOff,hb:{x:a.x+pad,y:a.y+4,w:a.w-pad*2,h:Math.max(8,a.h-feetOff*0.35)}};
}
function _resolveActorBodyX(a,feetOff){
  const {hb,feet}=_actorFeetSpan(a,feetOff);
  const cap=Math.min(10,Math.max(4,a.w*0.14));
  for(let pass=0;pass<4;pass++){
    let moved=false;
    for(const plat of allP()){
      if(plat.tp!=='solid') continue;
      if(!ov(hb.x,hb.y,hb.w,hb.h,plat.x,plat.y,plat.w,plat.h)) continue;
      if(feet>=plat.y-14&&feet<=plat.y+plat.h+12) continue;
      const penL=(hb.x+hb.w)-plat.x, penR=(plat.x+plat.w)-hb.x;
      const push=Math.min(penL,penR,cap);
      if(push<=0) continue;
      a.x+=(penL<=penR)?-push:push; moved=true;
    }
    if(!moved) break;
  }
  a.x=Math.max(0,Math.min(WW-a.w,a.x));
}
function _resolveActorPlatY(a,prevFeet,feetOff){
  a.og=false;
  const feet=a.y+feetOff;
  const {fL,fR,hb}=_actorFeetSpan(a,feetOff);
  const landSlop=Math.max(12,Math.abs(a.vy||0)+10);
  if((a.vy||0)>=0){
    let bestTop=null;
    if(COLL_SEGS.length){
      const samples=[a.x+a.w/2,fL,fR];
      const cx=a.x+a.w*0.5, feet=a.y+feetOff;
      _eachCollSegNear(a.x+a.w*0.5,a.w+48,seg=>{
        if(!_walkSegAllowed(seg,cx,feet)) return;
        const y=_segSupportAt(seg,samples);
        if(y===null) return;
        if(prevFeet>y+landSlop) return;
        if(feet<y-6) return;
        if(bestTop===null||y>bestTop) bestTop=y;
      });
    }
    for(const plat of allP()){
      if(plat.tp!=='solid') continue;
      if(fR<=plat.x||fL>=plat.x+plat.w) continue;
      if(plat.poly&&_useSegGround&&bestTop!==null) continue;
      if(prevFeet>plat.y+landSlop) continue;
      if(feet<plat.y-6) continue;
      if(feet>plat.y+plat.h) continue;
      if(bestTop===null||plat.y<bestTop) bestTop=plat.y;
    }
    if(bestTop!==null){ a.y=bestTop-feetOff; a.vy=0; a.og=true; return; }
  }
  for(const plat of allP()){
    if(plat.tp!=='solid'&&plat.tp!=='ceil') continue;
    if(!ov(hb.x,hb.y,hb.w,hb.h,plat.x,plat.y,plat.w,plat.h)) continue;
    if((a.vy||0)<0&&hb.y<plat.y+plat.h){ a.y=plat.y+plat.h; a.vy=0; }
    else if((a.vy||0)>0&&feet>plat.y&&feet<=plat.y+plat.h+8){ a.y=plat.y-feetOff; a.vy=0; a.og=true; }
  }
}
function _moveActorWithColl(a,vx,vy,feetOff){
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(vx),Math.abs(vy))/COLL_MOVE_STEP));
  for(let i=0;i<steps;i++){
    const sx2=vx/steps, sy2=vy/steps;
    a.x+=sx2; _resolveActorBodyX(a,feetOff);
    const pf=a.y+feetOff; a.y+=sy2; _resolveActorPlatY(a,pf,feetOff);
    if(a.og&&sy2>0) break;
  }
  if(!a.og&&(a.vy||0)>=0&&(a.vy||0)<4){
    const cx=a.x+a.w/2;
    let surf=null;
    if(COLL_SEGS.length){ const fake={x:a.x,y:a.y}; const hit=_querySegGround(fake,a.y+feetOff,null,36); if(hit) surf=hit.y; }
    if(surf===null){ for(const plat of allP()){ if(plat.tp!=='solid'||plat.poly) continue; if(cx<plat.x||cx>plat.x+plat.w) continue; if(surf===null||plat.y>surf) surf=plat.y; } }
    const feet=a.y+feetOff;
    if(surf!==null&&feet>=surf-8&&feet<=surf+COLL_LEDGE_STEP){ a.y=surf-feetOff; a.vy=0; a.og=true; }
  }
}
function _applyActorGravity(a,feetOff,gravMul=0.55){
  a.vy=Math.min((a.vy||0)+GRAV*gravMul,11);
  _moveActorWithColl(a,a.vx||0,a.vy,feetOff);
}
function _applyMindEnemyPhysics(e){
  if(!e.crouchAmt) e.crouchAmt=0;
  if(!e.hook) e.hook={st:'idle'};
  if(!e.wallGrip) e.wallGrip=0;
  _movePlayerWithColl(e,e.vx||0,e.vy||0);
}

// ── Polygon helpers ───────────────────────────────────────────
function _playerAirborne(pl){
  if(!pl) return false;
  if(pl.hook&&pl.hook.st==='on') return true;
  if(pl.wallGrip>0) return true;
  if((pl.jf||0)>0) return true;
  if((pl.vy||0)<-0.45) return true;
  const wc=playerWheelCol(pl);
  const feet=wc.cy+wc.r;
  const sup=_wheelSupportAt(wc.cx,feet,{maxUp:8,maxDrop:GROUND_SINK_MAX+4,pl});
  if(sup&&sup.frac>=WHEEL_MIN_SUPPORT&&Math.abs(feet-sup.y)<=GROUND_SINK_MAX+4) return false;
  return true;
}
function _pointInPoly(px,py,pts){
  let inside=false;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){
    const xi=pts[i].x,yi=pts[i].y,xj=pts[j].x,yj=pts[j].y;
    if(((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi)) inside=!inside;
  }
  return inside;
}
function _isInsidePlayBoundary(cx,cy){
  if(!COLL_POLYS.length) return true;
  for(const pts of COLL_POLYS) if(_pointInPoly(cx,cy,pts)) return true;
  return false;
}
function _isPastKeepOutBarrier(cx,cy){
  for(const seg of COLL_WALL_SEGS){
    if(seg.nx==null) continue;
    const cp=_segClosestPoint(seg,cx,cy);
    const along=Math.hypot(cx-cp.x,cy-cp.y);
    if(along>ZONE_WALL_THICK+36) continue;
    const into=(cx-cp.x)*seg.nx+(cy-cp.y)*seg.ny;
    if(into>1.5) return true;
  }
  return false;
}
function _pointOnWalkableGround(cx,cy){
  if(typeof _grassSurfaceYNear==='function'){
    const gy=_grassSurfaceYNear(cx,cy,56,80);
    if(gy!=null&&cy>=gy-16&&cy<=gy+32) return true;
  }
  if(typeof _pickWalkSurfaceY!=='function') return false;
  const surf=_pickWalkSurfaceY(cx,cy,{maxUp:48,maxDrop:72,loose:true});
  return surf!=null&&cy>=surf-14&&cy<=surf+36;
}
function _isInKeepOutForbidden(cx,cy){
  if(_isPastKeepOutBarrier(cx,cy)) return true;
  if(COLL_POLYS.length&&!_isInsidePlayBoundary(cx,cy)){
    if(_pointOnWalkableGround(cx,cy)) return false;
    return true;
  }
  return false;
}
function _isInKeepOutSolid(cx,cy){
  return _isInKeepOutForbidden(cx,cy);
}
function _zonePointOk(cx,cy){
  if(_isInKeepOutForbidden(cx,cy)) return false;
  if(IMMERSED_POLYS.length&&!_isInImmersedZone(cx,cy)) return false;
  return true;
}
function _entityProbePoints(pl){
  if(!pl) return [];
  const h=playerCoreHB(pl);
  const head=playerHeadWorld(pl);
  return [
    {x:pl.x+SW/2,y:pl.y+FEET_OFF},
    {x:pl.x+FEET_L+3,y:pl.y+FEET_OFF},
    {x:pl.x+FEET_L+FEET_W-3,y:pl.y+FEET_OFF},
    {x:h.x+h.w*0.5,y:h.y+h.h*0.5},
    {x:head.cx,y:head.cy},
  ];
}
function _entityInValidZone(pl){
  if(!pl) return true;
  const cx=pl.x+SW/2, feet=pl.y+FEET_OFF;
  if(IMMERSED_POLYS.length&&!_isInImmersedZone(cx,feet)) return false;
  if(_penetratesKeepOut(pl)) return false;
  if(COLL_POLYS.length&&_isInsidePlayBoundary(cx,feet)) return true;
  if(_feetOnWalkSurface(pl)) return true;
  return _pointOnWalkableGround(cx,feet);
}
function _penetratesKeepOut(pl){
  if(!pl||!COLL_WALL_SEGS.length) return false;
  const probes=_wheelProbePoints(pl);
  for(const seg of COLL_WALL_SEGS){
    if(seg.nx==null) continue;
    for(const pr of probes){
      const cp=_segClosestPoint(seg,pr.x,pr.y);
      const vx=pr.x-cp.x, vy=pr.y-cp.y;
      const into=vx*seg.nx+vy*seg.ny;
      if(into<=0.65) continue;
      if(pr.r+COLL_SEAM*0.12-Math.hypot(vx,vy)>0.45) return true;
    }
  }
  return false;
}
function _ejectFromKeepOut(pl){
  if(!pl||!COLL_WALL_SEGS.length) return;
  if(_ridingBwallTop(pl)) return;
  for(let pass=0;pass<8;pass++){
    let moved=false;
    for(const seg of COLL_WALL_SEGS){
      if(_resolveKeepOutBarrier(pl,seg)) moved=true;
    }
    if(!moved) break;
  }
  pl.x=Math.max(0,Math.min(WW-SW,pl.x));
}
function _pushPlayerOutOfKeepOut(pl){
  _ejectFromKeepOut(pl);
}
function _pointInAnyPoly(px,py,polys){
  if(!polys||!polys.length) return false;
  for(const pts of polys) if(_pointInPoly(px,py,pts)) return true;
  return false;
}
function _isInImmersedZone(cx,cy){
  if(IMMERSED_POLYS.length) return _pointInAnyPoly(cx,cy,IMMERSED_POLYS);
  return true;
}
function _isValidEntityZone(cx,feetY){
  if(typeof _spawnMarkerZoneOk==='function'){
    const headTop=feetY-(FEET_OFF-(typeof _spawnHeadTopDy==='function'?_spawnHeadTopDy():(FEET_OFF-STAND_H-WHEEL_R-22)));
    return _spawnMarkerZoneOk(cx,headTop,feetY);
  }
  if(!_zonePointOk(cx,feetY)) return false;
  const bodyY=feetY-STAND_H*0.45;
  return _zonePointOk(cx,bodyY);
}
function _enforceValidZone(pl){
  if(!pl) return;
  if(_entityInValidZone(pl)) return;
  const ox=pl.x, oy=pl.y;
  let bestX=ox, bestY=oy, bestScore=-1e9;
  for(let dy=-80;dy<=80;dy+=4){
    for(let dx=-80;dx<=80;dx+=4){
      pl.x=ox+dx; pl.y=oy+dy;
      if(!_entityInValidZone(pl)) continue;
      const score=-(dx*dx+dy*dy);
      if(score>bestScore){bestScore=score; bestX=pl.x; bestY=pl.y;}
    }
  }
  if(bestScore>-1e9){
    pl.x=bestX; pl.y=bestY;
    if(Math.hypot(bestX-ox,bestY-oy)>6){ pl.vx=0; pl.vy=0; }
    _wheelSettle(pl,{maxUp:40,maxDrop:96});
    if(pl.og) pl._groundHold=8;
    return;
  }
  if(typeof _spawnX==='number'&&typeof _spawnY==='number'){
    pl.x=_spawnX; pl.y=_spawnY;
    pl.vy=0; pl.vx=0;
    const cx=pl.x+SW*0.5, feet=pl.y+FEET_OFF;
    const floor=typeof _snapSpawnToSolid==='function'?_snapSpawnToSolid(cx,feet,96):null;
    if(floor!=null){ pl.y=floor-FEET_OFF; pl.og=true; pl._groundHold=12; }
    _pushPlayerOutOfKeepOut(pl);
  }
}
function _enforceImmersedZone(pl){
  if(!pl) return;
  _enforceValidZone(pl);
}
function _classifyPolyEdge(pts,a,b){
  const dx=b.x-a.x, dy=b.y-a.y, len=Math.hypot(dx,dy);
  if(len<3) return 'barrier';
  const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
  const sample=Math.max(8,len*0.12);
  const inBelow=_pointInPoly(mx,my+sample,pts);
  const inAbove=_pointInPoly(mx,my-sample,pts);
  const centY=pts.reduce((s,p)=>s+p.y,0)/pts.length;
  const roomFloor=inAbove&&!inBelow;
  const platTop=!inAbove&&inBelow&&my>=centY;
  const angle=Math.atan2(dy,dx);
  if(Math.abs(Math.cos(angle))<0.05) return 'barrier';
  if(roomFloor) return 'room-floor';
  if(platTop) return 'plat-walk';
  return 'barrier';
}
function _buildPolyColliderSegs(pts){
  const walk=[], barriers=[];
  for(let i=0;i<pts.length;i++){
    const a=pts[i], b=pts[(i+1)%pts.length];
    const dx=b.x-a.x, dy=b.y-a.y, len=Math.hypot(dx,dy);
    if(len<3) continue;
    const angle=Math.atan2(dy,dx);
    const edgeKind=_classifyPolyEdge(pts,a,b);
    const isFlat=Math.abs(Math.cos(angle))>0.88;
    const useWalk=edgeKind==='room-floor'||(edgeKind==='plat-walk'&&!isFlat);
    if(useWalk){
      const ux=dx/len, uy=dy/len, pad=COLL_SEAM*0.5;
      const floorKind=edgeKind==='room-floor'?'room':'slope';
      walk.push({id:walk.length,x1:a.x-ux*pad,y1:a.y-uy*pad,x2:b.x+ux*pad,y2:b.y+uy*pad,len:len+pad*2,angle,ux,uy,walkKind:'poly',floorKind});
      continue;
    }
    const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
    const sample=Math.max(10,len*0.1);
    const lax=-dy/len, lay=dx/len;
    const inA=_pointInPoly(mx+lax*sample,my+lay*sample,pts);
    const nx=inA?lax:-lax, ny=inA?lay:-lay;
    barriers.push({
      x1:a.x,y1:a.y,x2:b.x,y2:b.y,len,nx,ny,
      insideLeft:inA,
      minX:Math.min(a.x,b.x)-COLL_SEAM,maxX:Math.max(a.x,b.x)+COLL_SEAM,
      minY:Math.min(a.y,b.y)-COLL_SEAM,maxY:Math.max(a.y,b.y)+COLL_SEAM,
    });
  }
  return {walk,barriers};
}
function _buildTopWalkSegs(pts){
  return _buildPolyColliderSegs(pts).walk;
}
function _buildWallSegs(pts){
  return _buildPolyColliderSegs(pts).barriers;
}

// ── Stability passes ──────────────────────────────────────────
function _resolvePlayerInSolids(pl){
  if(!pl) return;
  const cx=pl.x+SW*0.5, xPad=SW+40;
  for(let pass=0;pass<6;pass++){
    const h=playerCoreHB(pl);
    let moved=false;
    for(const plat of allP()){
      if(plat.tp!=='solid') continue;
      if(plat.bw) continue;
      if(plat.poly&&_useSegGround) continue;
      if(_useSegGround&&plat.h>24&&!plat.bw) continue;
      if(!_platNearX(plat,cx,xPad)) continue;
      if(!ov(h.x,h.y,h.w,h.h,plat.x,plat.y,plat.w,plat.h)) continue;
      if(_playerStandingOnPlat(pl,plat)&&!plat.poly) continue;
      const overlapX=Math.min(h.x+h.w,plat.x+plat.w)-Math.max(h.x,plat.x);
      const overlapY=Math.min(h.y+h.h,plat.y+plat.h)-Math.max(h.y,plat.y);
      if(overlapX<=0||overlapY<=0) continue;
      const fromLeft=h.x+h.w/2<plat.x+plat.w/2;
      const horiz=overlapX<=overlapY||plat.h<=18;
      const feet=pl.y+FEET_OFF;
      if(horiz) pl.x+=fromLeft?-overlapX:overlapX;
      else if(feet<=plat.y+18||h.y+h.h*0.5<=plat.y+plat.h*0.35){ pl.y-=overlapY; if(pl.vy>0) pl.vy*=0.5; }
      else continue;
      moved=true;
    }
    pl.x=Math.max(0,Math.min(WW-SW,pl.x));
    if(!moved) break;
  }
}
function _recoverFromInterior(pl){
  if(!pl||_playerAirborne(pl)) return;
  const feet=pl.y+FEET_OFF;
  const walk=_walkableYForPlayer(pl);
  if(walk!==null&&feet>walk+2){
    pl.y=walk-FEET_OFF;
    pl.vy=0;
    pl.vx=0;
    pl.og=true;
  }
}
function _enforceGroundContact(pl){
  if(!pl) return;
  if(pl.hook&&pl.hook.st==='on') return;
  if(pl.wallGrip>0) return;
  if(_playerAirborne(pl)) return;
  const cx=pl.x+SW*0.5, feet=pl.y+FEET_OFF;
  const sup=_wheelSupportAt(cx,feet,{maxUp:40,maxDrop:GROUND_SINK_MAX+72,loose:true,pl});
  if(!sup||sup.frac<WHEEL_MIN_SUPPORT) return;
  const surf=sup.y;
  if(pl.vy<-0.5&&feet<surf-12) return;
  if(feet>surf+GROUND_SINK_MAX){
    pl.y=surf-FEET_OFF; pl.vy=0; pl.og=true;
    return;
  }
  if((pl.og||pl.vy>=0)&&feet>=surf-12&&feet<=surf+GROUND_SINK_MAX+8){
    pl.y=surf-FEET_OFF; if(pl.vy>0) pl.vy=0; pl.og=true;
  }
}
function _resolveSpawnPlacement(pl){
  if(!pl) return;
  const cx=pl.x+SW*0.5, feet=pl.y+FEET_OFF;
  const dropLim=Math.max(640,typeof WH!=='undefined'?WH*0.45:720);
  const floor=typeof _spawnFloorBelow==='function'?_spawnFloorBelow(cx,feet,dropLim):null;
  if(floor!=null&&floor>=feet-8){
    pl.y=floor-FEET_OFF;
    pl.og=true;
    pl._groundHold=16;
  } else {
    pl.og=false;
  }
  pl.vy=0;
  pl.vx=0;
  pl._autoHeadTuck=0;
  _pushPlayerOutOfKeepOut(pl);
  _enforceValidZone(pl);
  _resolvePlayerInSolids(pl);
}
function _validateGroundFlag(pl){
  if(!pl) return;
  if(pl.hook&&pl.hook.st==='on'){ pl.og=false; pl._groundSeg=null; return; }
  if(pl.wallGrip>0) return;
  const cx=pl.x+SW*0.5, feet=pl.y+FEET_OFF;
  for(const bw of BWALLS){
    if(bw.hp<=0) continue;
    if(_playerRidingBoxTop(pl,bw)&&Math.abs(feet-bw.y)<=GROUND_SINK_MAX+12){
      pl.og=true;
      pl._groundHold=Math.max(pl._groundHold||0,4);
      return;
    }
  }
  if(pl.og&&_tileFlatFloorTrust(pl)){
    pl._groundHold=Math.max(pl._groundHold||0,8);
    return;
  }
  const sup=_wheelSupportAt(cx,feet,{maxUp:28,maxDrop:GROUND_SINK_MAX+48,pl});
  const exitFrac=_tileCampaignActive()?0.16:WHEEL_GROUND_EXIT;
  if(pl.og){
    if(!sup||sup.frac<exitFrac){ pl.og=false; pl._groundSeg=null; pl._onSlope=false; pl._groundHold=0; return; }
    if(Math.abs(feet-sup.y)>36){ pl.og=false; pl._groundHold=0; }
    else pl._groundHold=Math.max(pl._groundHold||0,2);
  }
  if(pl.og&&(pl._groundHold||0)<=0&&typeof _playerGrounded==='function'&&!_playerGrounded(pl)){
    pl.og=false;
    pl._groundHold=0;
    pl._groundSeg=null;
    pl._onSlope=false;
  }
}
function _stabilizePlayerCollision(pl){
  if(!pl) return;
  if(pl.hook&&pl.hook.st==='on') return;
  if(pl.wallGrip>0) return;
  if(pl._bwallFallGrace>0) pl._bwallFallGrace--;
  _handleBwallRideRelease(pl);
  const riding=_ridingBwallTop(pl);
  _resolvePlayerOutOfBwalls(pl);
  if(!riding&&_penetratesKeepOut(pl)) _ejectFromKeepOut(pl);
  if(!_entityInValidZone(pl)) _enforceValidZone(pl);
  if(riding){
    pl.y=riding.y-FEET_OFF;
    pl.og=true;
    pl._onSlope=false;
    pl._slopeAngle=0;
    pl._groundSeg=null;
    return;
  }
  _resolveHeadCeiling(pl);
  if(pl._bwallFallGrace<=0){
    if(!(_tileCampaignActive()&&(pl._groundHold||0)>4)&&(pl._groundHold||0)<=2)
      _wheelSettle(pl,{maxUp:20,maxDrop:COLL_LEDGE_STEP+12});
  }
  _validateGroundFlag(pl);
  if((pl._groundHold||0)<=0) _syncPlayerGroundFlag(pl);
  _unstickWallCorner(pl);
  if(pl===p) _applySlopePhysics(pl);
  else if(_moveInputX()!==0) _applySlopePhysics(pl);
}

// ── Segment / AABB intersection ───────────────────────────────
function _segAabbHit(x1,y1,x2,y2,pl){
  const rx=pl.x,ry=pl.y,rw=pl.w,rh=pl.h;
  const edges=[
    {x1:rx,y1:ry,x2:rx,y2:ry+rh,nx:-1,ny:0},{x1:rx+rw,y1:ry,x2:rx+rw,y2:ry+rh,nx:1,ny:0},
    {x1:rx,y1:ry,x2:rx+rw,y2:ry,nx:0,ny:-1},{x1:rx,y1:ry+rh,x2:rx+rw,y2:ry+rh,nx:0,ny:1}
  ];
  const ex=x2-x1,ey=y2-y1;
  let best=null,bestT=1;
  for(const e of edges){
    const fx=e.x2-e.x1,fy=e.y2-e.y1,dn=ex*fy-ey*fx;
    if(Math.abs(dn)<.001) continue;
    const t=((e.x1-x1)*fy-(e.y1-y1)*fx)/dn;
    const u=((e.x1-x1)*ey-(e.y1-y1)*ex)/dn;
    if(t>=0&&t<=1&&u>=0&&u<=1&&t<bestT){bestT=t;best={tx:x1+t*ex,ty:y1+t*ey,nx:e.nx,ny:e.ny};}
  }
  return best;
}
function segHit(x1,y1,x2,y2,pl){ const hit=_segAabbHit(x1,y1,x2,y2,pl); return hit?{tx:hit.tx,ty:hit.ty}:null; }
function _segBarrierHit(x1,y1,x2,y2,seg){
  if(!seg) return null;
  if(seg.nx!=null){
    const dx1=x2-x1,dy1=y2-y1,dx2=seg.x2-seg.x1,dy2=seg.y2-seg.y1;
    const dn=dx1*dy2-dy1*dx2;
    if(Math.abs(dn)<1e-6) return null;
    const t=((seg.x1-x1)*dy2-(seg.y1-y1)*dx2)/dn;
    const u=((seg.x1-x1)*dy1-(seg.y1-y1)*dx1)/dn;
    if(t<0||t>1||u<0||u>1) return null;
    return {tx:x1+t*dx1,ty:y1+t*dy1,nx:seg.nx,ny:seg.ny};
  }
  if(seg.minY==null) return null;
  const bodyT=Math.min(y1,y2), bodyB=Math.max(y1,y2);
  if(bodyB<=seg.minY||bodyT>=seg.maxY) return null;
  const wallX=_wallXAtY(seg,(bodyT+bodyB)*0.5);
  const minX=Math.min(x1,x2), maxX=Math.max(x1,x2);
  if(wallX<minX||wallX>maxX) return null;
  const dy=y2-y1, dx=x2-x1;
  if(Math.abs(dx)<0.001) return null;
  const t=(wallX-x1)/dx;
  if(t<0||t>1) return null;
  const ty=y1+t*dy;
  const nx=seg.insideLeft?-1:1;
  return {tx:wallX,ty,nx,ny:0};
}
function _hookRayHit(x1,y1,x2,y2){
  let best=null, bestD=1e9;
  for(const q of allP()){
    if(q.tp!=='solid'&&q.tp!=='ceil') continue;
    const hit=_segAabbHit(x1,y1,x2,y2,q);
    if(!hit) continue;
    const d=Math.hypot(hit.tx-x1,hit.ty-y1);
    if(d<bestD){bestD=d;best={tx:hit.tx,ty:hit.ty,nx:hit.nx,ny:hit.ny,enemy:false,tgt:null};}
  }
  for(const seg of COLL_WALL_SEGS){
    const hit=_segBarrierHit(x1,y1,x2,y2,seg);
    if(!hit) continue;
    const d=Math.hypot(hit.tx-x1,hit.ty-y1);
    if(d<bestD){bestD=d;best={tx:hit.tx,ty:hit.ty,nx:hit.nx,ny:hit.ny,enemy:false,tgt:null};}
  }
  for(const seg of COLL_SEGS){
    const bar={x1:seg.x1,y1:seg.y1,x2:seg.x2,y2:seg.y2,nx:-(seg.uy||0),ny:-(seg.ux||1)};
    const hit=_segBarrierHit(x1,y1,x2,y2,bar);
    if(!hit) continue;
    const d=Math.hypot(hit.tx-x1,hit.ty-y1);
    if(d<bestD){bestD=d;best={tx:hit.tx,ty:hit.ty,nx:bar.nx,ny:bar.ny,enemy:false,tgt:null};}
  }
  return best;
}
function _segPathBlocked(x1,y1,x2,y2){
  for(const q of allP()){
    if(q.tp!=='solid'&&q.tp!=='ceil') continue;
    if(_segAabbHit(x1,y1,x2,y2,q)) return true;
  }
  for(const seg of COLL_WALL_SEGS){
    if(_segBarrierHit(x1,y1,x2,y2,seg)) return true;
  }
  return false;
}

// ── Wheel suspension ──────────────────────────────────────────
function _groundYAtWheel(pl,ahead){
  if(!pl) return null;
  const cx=pl.x+SW/2+(ahead||0), feet=pl.y+FEET_OFF;
  return typeof _pickWalkSurfaceY==='function'
    ?_pickWalkSurfaceY(cx,feet,{maxUp:28,maxDrop:SUSP_ROLL_MAX+12,pl})
    :null;
}
function _applyWheelGroundContact(pl){
  _wheelSettle(pl,{maxUp:28,maxDrop:SUSP_ROLL_MAX+12});
}
function _updateWheelSuspension(pl,prevVx){
  if(!pl) return;
  let target=0.05;
  if(pl.hook&&pl.hook.st==='on') target=0.5;
  else if(!pl.og&&!pl._onSlope) target=0.68+Math.min(0.3,Math.abs(pl.vy)*0.035);
  else if(pl.og){
    if(pl.landF>0) target=0.26+Math.min(0.48,(pl._landAmp||0.45)*0.75);
    else target=0.05;
    const dir=Math.sign(pl.vx||0)||1;
    const gNow=_groundYAtWheel(pl,0), gAhead=_groundYAtWheel(pl,dir*WHEEL_R*0.85);
    if(gNow!==null&&gAhead!==null){
      const bump=Math.max(0,gAhead-gNow);
      if(bump>2) target=Math.min(0.55,0.05+bump/SUSP_ROLL_MAX*0.5);
    }
  }
  const stiff=pl.og?SUSP_STIFF*0.85:SUSP_STIFF*0.65;
  pl.suspVel=(pl.suspVel||0)+((target-(pl.suspComp||0))*stiff);
  pl.suspVel*=(pl.og?SUSP_DAMP:0.76);
  pl.suspComp=Math.max(0,Math.min(1,(pl.suspComp||0)+pl.suspVel));
  if(pl.og&&pl.landF<=0&&Math.abs(pl.vx||0)<0.25&&pl.suspComp<0.12){
    pl.suspComp=0;
    pl.suspVel=0;
  }
  const accel=(pl.vx||0)-(prevVx||0);
  const tiltTgt=pl.og?Math.sign(pl.vx||0)*Math.min(0.38,Math.abs(pl.vx)/RUN*0.34)+accel*0.04:0;
  pl.suspTilt=((pl.suspTilt||0)+(tiltTgt-(pl.suspTilt||0))*0.16);
}
function _rollWheelFromTravel(pl,x0,y0){
  if(!pl) return;
  if(pl.hook&&pl.hook.st==='on') return;
  if(pl.wallGrip>0) return;
  if(pl.xlrOn||pl.magOn) return;
  if(!pl.og&&!pl._onSlope) return;
  const dx=pl.x-x0, dy=pl.y-y0;
  if(Math.abs(dx)<0.01) return;
  const dist=pl._onSlope?Math.hypot(dx,dy):Math.abs(dx);
  pl.wheelAngle=(pl.wheelAngle||0)+Math.sign(dx)*dist/WHEEL_R;
}

// ── Push / pull (XLR/MAG) ─────────────────────────────────────
function _ropeColliders(){
  const out=[];
  for(const q of allP()) if(q.tp==='solid'||q.tp==='ceil') out.push(q);
  for(const c of CRATES) out.push({x:c.x,y:c.y,w:c.w,h:c.h,tp:'solid'});
  for(const bw of BWALLS){ if(bw.hp<=0) continue; out.push({x:bw.x,y:bw.y,w:bw.w,h:bw.h,tp:'solid'}); }
  return out;
}
function _raySolidDist(x,y,ux,uy,maxD,step=7){
  const len=Math.hypot(ux,uy)||1;
  ux/=len; uy/=len;
  let best=maxD+1;
  for(let t=step;t<=maxD;t+=step){
    const px=x+ux*t, py=y+uy*t;
    for(const q of allP()){ if(q.tp!=='solid'&&q.tp!=='ceil') continue; if(px>=q.x&&px<=q.x+q.w&&py>=q.y&&py<=q.y+q.h){best=Math.min(best,t);break;} }
    if(best<=maxD) break;
    for(const bw of BWALLS){ if(bw.hp<=0||bw.movable) continue; if(px>=bw.x&&px<=bw.x+bw.w&&py>=bw.y&&py<=bw.y+bw.h){best=Math.min(best,t);break;} }
    if(best<=maxD) break;
  }
  return best;
}
function _pullTargetBlocked(ox,oy,tox,toy,w,h){
  const mx=ox+(tox-ox)*0.38, my=oy+(toy-oy)*0.38;
  const hw=(w||28)*0.5, hh=(h||28)*0.5;
  for(const q of allP()){ if(q.tp!=='solid'&&q.tp!=='ceil') continue; if(ov(mx-hw,my-hh,w||28,h||28,q.x,q.y,q.w,q.h)) return true; }
  for(const bw of BWALLS){ if(bw.hp<=0||!bw.movable) continue; if(ov(mx-hw,my-hh,w||28,h||28,bw.x,bw.y,bw.w,bw.h)) return true; }
  return false;
}
function _applyPushWallReaction(pl,originX,originY,aimA,range,held){
  if(pl.hook&&pl.hook.st==='on') return;
  const ux=Math.cos(aimA), uy=Math.sin(aimA);
  const holdScale=Math.min(1,(held||0)/180)*1.5+1;
  const block=_raySolidDist(originX,originY,ux,uy,range);
  if(block<=range){ const prox=Math.pow(1-block/range,1.65); const react=prox*2.5*holdScale; pl.vx-=ux*react; pl.vy-=uy*react*0.9; }
  const core=cpt();
  if(uy>0.35){ const floorD=_raySolidDist(core.x,pl.y+FEET_OFF,0,1,44,5); if(floorD<38){ const prox=Math.pow(1-floorD/38,1.45); pl.vy-=prox*1.7*holdScale; } }
  if(uy<-0.35){ const headY=pl.y+FEET_OFF-STAND_H+6; const ceilD=_raySolidDist(core.x,headY,0,-1,40,5); if(ceilD<34){ const prox=Math.pow(1-ceilD/34,1.45); pl.vy+=prox*1.5*holdScale; } }
}
function _applyPullPlayerTug(pl,centerX,centerY,fx,fy,ox,oy,w,h,range,blockedOnly){
  if(pl.hook&&pl.hook.st==='on') return {x:0,y:0,w:0};
  const dx=ox-centerX, dy=oy-centerY, dist=Math.hypot(dx,dy)||1;
  if(dist>range) return {x:0,y:0,w:0};
  const blocked=_pullTargetBlocked(ox,oy,centerX,centerY,w,h);
  const stuckNear=dist<58;
  if(blockedOnly&&!blocked&&!stuckNear) return {x:0,y:0,w:0};
  const prox=Math.pow(1-dist/range,1.25);
  const boost=blocked?2.6:(stuckNear?1.35:0.55);
  return {x:(dx/dist)*fx*prox*boost, y:(dy/dist)*fy*prox*boost, w:prox*boost};
}

// ── Rope path helpers ─────────────────────────────────────────
function _ropePathLen(pts){ let len=0; for(let i=1;i<pts.length;i++) len+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y); return len; }
function _segPathClear(x1,y1,x2,y2){ const d=Math.hypot(x2-x1,y2-y1); if(d<8) return true; const ux=(x2-x1)/d,uy=(y2-y1)/d; return !_segPathBlocked(x1+ux*3,y1+uy*3,x2-ux*3,y2-uy*3); }
function _ropeNearestCorner(rect,hx,hy){
  const cs=[{x:rect.x,y:rect.y},{x:rect.x+rect.w,y:rect.y},{x:rect.x,y:rect.y+rect.h},{x:rect.x+rect.w,y:rect.y+rect.h}];
  let best=cs[0], bd=1e18;
  for(const c of cs){ const d=(c.x-hx)**2+(c.y-hy)**2; if(d<bd){bd=d;best=c;} }
  const cx=rect.x+rect.w*0.5, cy=rect.y+rect.h*0.5;
  return {x:best.x+(best.x>cx?2.5:-2.5), y:best.y+(best.y>cy?2.5:-2.5)};
}
function _ropeFirstHit(x1,y1,x2,y2){
  let best=null, bt=1;
  const segLen=Math.hypot(x2-x1,y2-y1)||1;
  for(const q of _ropeColliders()){
    const hit=_segAabbHit(x1,y1,x2,y2,q);
    if(!hit) continue;
    const t=Math.hypot(hit.tx-x1,hit.ty-y1)/segLen;
    if(t<bt){bt=t;best={hit,rect:q};}
  }
  for(const seg of COLL_WALL_SEGS){
    const hit=_segBarrierHit(x1,y1,x2,y2,seg);
    if(!hit) continue;
    const t=Math.hypot(hit.tx-x1,hit.ty-y1)/segLen;
    if(t<bt){
      bt=t;
      const pad=4;
      best={hit,rect:{x:Math.min(seg.x1,seg.x2)-pad,y:Math.min(seg.y1,seg.y2)-pad,w:Math.abs(seg.x2-seg.x1)+pad*2,h:Math.abs(seg.y2-seg.y1)+pad*2,tp:'solid'}};
    }
  }
  return best;
}
function _ropeSegClear(x1,y1,x2,y2){ const d=Math.hypot(x2-x1,y2-y1); if(d<8) return true; const ux=(x2-x1)/d,uy=(y2-y1)/d; return _segPathClear(x1+ux*3,y1+uy*3,x2-ux*3,y2-uy*3); }
function _ropeUpdatePivots(h,tx,ty){
  if(!h.pivots) h.pivots=[];
  for(let g=0;g<3&&h.pivots.length;g++){
    const n=h.pivots.length, base=n>=2?h.pivots[n-2]:{x:h.ax,y:h.ay};
    if(_ropeSegClear(base.x,base.y,tx,ty)) h.pivots.pop(); else break;
  }
  for(let g=0;g<3;g++){
    const base=h.pivots.length?h.pivots[h.pivots.length-1]:{x:h.ax,y:h.ay};
    if(_ropeSegClear(base.x,base.y,tx,ty)) break;
    if(h.pivots.length>=ROPE_MAX_PIVOTS) break;
    const d=Math.hypot(tx-base.x,ty-base.y)||1;
    const ux=(tx-base.x)/d, uy=(ty-base.y)/d;
    const fh=_ropeFirstHit(base.x+ux*3,base.y+uy*3,tx-ux*3,ty-uy*3);
    if(!fh) break;
    const c=_ropeNearestCorner(fh.rect,fh.hit.tx,fh.hit.ty);
    if(Math.hypot(c.x-base.x,c.y-base.y)<3) break;
    h.pivots.push(c);
  }
}
function _ropePathPts(h,tx,ty){
  const pts=[{x:h.ax,y:h.ay}];
  if(h.pivots) for(const pv of h.pivots) pts.push({x:pv.x,y:pv.y});
  pts.push({x:tx,y:ty});
  return pts;
}
function _ropeSolidFloor(pl,prevFeet){
  if(pl.vy<0) return;
  const feet=pl.y+FEET_OFF, fL=pl.x+FEET_L, fR=fL+FEET_W;
  const landSlop=Math.max(12,Math.abs(pl.vy)+10);
  let bestTop=null;
  const slopeSurf=_querySegGround(pl,feet,prevFeet,landSlop);
  if(slopeSurf) bestTop=slopeSurf.y;
  for(const plat of allP()){
    if(plat.tp!=='solid') continue;
    if(!_feetSpanOver(plat,fL,fR)) continue;
    if(prevFeet>plat.y+landSlop||feet<plat.y-6||feet>plat.y+plat.h) continue;
    if(bestTop===null||plat.y<bestTop) bestTop=plat.y;
  }
  if(bestTop!==null&&feet>bestTop){ pl.y=bestTop-FEET_OFF; if(pl.vy>0) pl.vy=0; }
}
function _ropeRefreshPath(h){ const end=ropePlayerEndWorld(); _ropeUpdatePivots(h,end.x,end.y); const path=_ropePathPts(h,end.x,end.y); h._path=path; return path; }
function _ropeApplyTension(h){
  const path=_ropeRefreshPath(h), plen=_ropePathLen(path), over=plen-h.rl;
  h._tension=Math.max(0,over); h._slack=over<-4; h._tight=over>1;
  if(over<=0) return;
  const i=path.length-2, p0=path[i], p1=path[i+1];
  const seg=Math.hypot(p1.x-p0.x,p1.y-p0.y)||1;
  const toAx=(p0.x-p1.x)/seg, toAy=(p0.y-p1.y)/seg;
  const spring=Math.min(over*0.12,2.4);
  p.vx+=toAx*spring; p.vy+=toAy*spring;
  const outX=(p1.x-p0.x)/seg, outY=(p1.y-p0.y)/seg;
  const vd=p.vx*outX+p.vy*outY;
  if(vd>0){const k=0.88*Math.min(1,over/ROPE_GIVE);p.vx-=outX*vd*k;p.vy-=outY*vd*k;}
}

// ── Verlet visual cord ────────────────────────────────────────
function _pathPointAt(path,plen,d){
  if(d<=0) return {x:path[0].x,y:path[0].y};
  let acc=0;
  for(let i=1;i<path.length;i++){
    const sl=Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y);
    if(acc+sl>=d){const t=sl>0?(d-acc)/sl:0;return {x:path[i-1].x+(path[i].x-path[i-1].x)*t,y:path[i-1].y+(path[i].y-path[i-1].y)*t};}
    acc+=sl;
  }
  const lp=path[path.length-1]; return {x:lp.x,y:lp.y};
}
function _vropeStep(h){
  const path=h._path;
  if(!path||path.length<2) return;
  const plen=_ropePathLen(path), rl=Math.max(h.rl,ROPE_RL_MIN);
  const end=path[path.length-1];
  if(!h.vr){ h.vr=[]; for(let i=0;i<VROPE_N;i++){const t=i/(VROPE_N-1);const x=h.ax+(end.x-h.ax)*t,y=h.ay+(end.y-h.ay)*t;h.vr.push({x,y,px:x,py:y});} }
  const vr=h.vr, n=vr.length;
  for(let i=1;i<n-1;i++){const q=vr[i];const vx=(q.x-q.px)*VROPE_DRAG,vy=(q.y-q.py)*VROPE_DRAG;q.px=q.x;q.py=q.y;q.x+=vx;q.y+=vy+VROPE_GRAV;}
  vr[0].x=vr[0].px=h.ax; vr[0].y=vr[0].py=h.ay;
  vr[n-1].x=vr[n-1].px=end.x; vr[n-1].y=vr[n-1].py=end.y;
  const segRest=Math.max(plen,rl)/(n-1);
  for(let it=0;it<VROPE_ITER;it++){
    for(let i=0;i<n-1;i++){
      const a=vr[i],b=vr[i+1];
      const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1e-6;
      const f=(d-segRest)/d*0.5;
      const ox=dx*f,oy=dy*f;
      if(i>0){a.x+=ox;a.y+=oy;}
      if(i+1<n-1){b.x-=ox;b.y-=oy;}
    }
  }
  const taut=Math.min(1,Math.max(0,(plen-rl+4)/10));
  const pull=Math.min(0.85,Math.max(taut*0.85,path.length>2?0.35:0));
  if(pull>0){for(let i=1;i<n-1;i++){const q=vr[i];const tp=_pathPointAt(path,plen,plen*i/(n-1));q.x+=(tp.x-q.x)*pull;q.y+=(tp.y-q.y)*pull;}}
  const cols=_ropeColliders();
  for(let i=1;i<n-1;i++){
    const q=vr[i];
    for(const r of cols){
      if(q.x>r.x&&q.x<r.x+r.w&&q.y>r.y&&q.y<r.y+r.h){
        const dl=q.x-r.x,dr=r.x+r.w-q.x,dt=q.y-r.y,db=r.y+r.h-q.y;
        const m=Math.min(dl,dr,dt,db);
        if(m===dt) q.y=r.y; else if(m===db) q.y=r.y+r.h;
        else if(m===dl) q.x=r.x; else q.x=r.x+r.w;
        q.px+=(q.x-q.px)*0.4; q.py+=(q.y-q.py)*0.4; break;
      }
    }
  }
  h._tautAmt=taut;
}

// ── Player health / lives ─────────────────────────────────────
const SHUTDOWN_FRAMES=72;
let _shutdownTimer=0;

function _syncLivesFromHp(pl){ pl.lives=Math.max(0,Math.ceil(pl.hp/PLAYER_HIT_DMG)); }
function applyPlayerHit(knockX,knockY,dmg=PLAYER_HIT_DMG){
  if(_shutdownTimer>0) return;
  if(_awdjooTutorial) _stageDamageFree=false;
  p.hp=Math.max(0,p.hp-dmg);
  _syncLivesFromHp(p);
  p._lifeRegenT=0;
  p.inv=0;
  _playerHitKnock(knockX,knockY,dmg);
  p.flashF=Math.max(p.flashF,12);
  try{sfx('player_hit',_hitSfxPitch(p.hp,p.maxHp));}catch(e){}
  if(p.hp<=0){
    if(_battleTestMode){_battleTestDeaths++;_syncBattleHud();}
    _shutdownTimer=SHUTDOWN_FRAMES;
    p.vx=0; p.vy=-2;
    try{sfx('shutdown');}catch(e){}
  }
}
function healPlayerFromKnowl(){
  if(p.hp<p.maxHp) p.hp=Math.min(p.maxHp,p.hp+PLAYER_HIT_DMG);
  _syncLivesFromHp(p);
  if(p.itemStamina<100) p.itemStamina=Math.min(100,p.itemStamina+50);
  p.flashF=Math.max(p.flashF,10);
}
function healAnyPlayerFromKnowl(pl){
  if(pl.hp<pl.maxHp) pl.hp=Math.min(pl.maxHp,pl.hp+PLAYER_HIT_DMG);
  _syncLivesFromHp(pl);
  if(pl.itemStamina<100) pl.itemStamina=Math.min(100,pl.itemStamina+50);
  pl.flashF=Math.max(pl.flashF,10);
}

// ── Ground + spawn helpers ────────────────────────────────────
function _playerGrounded(pl){
  if(!pl) return false;
  if(pl.hook&&pl.hook.st==='on') return false;
  if(pl.wallGrip>0) return false;
  if((pl.jf||0)>0) return false;
  if((pl.vy||0)<-0.45) return false;
  const wc=playerWheelCol(pl);
  const feet=wc.cy+wc.r;
  for(const bw of BWALLS){
    if(bw.hp<=0) continue;
    if(_playerRidingBoxTop(pl,bw)&&Math.abs(feet-bw.y)<=GROUND_SINK_MAX+8) return true;
  }
  if(_tileCampaignActive()){
    const surf=typeof _pickWalkSurfaceY==='function'
      ?_pickWalkSurfaceY(wc.cx,feet,{maxUp:14,maxDrop:GROUND_SINK_MAX+10,pl}):null;
    if(surf!=null&&Math.abs(feet-surf)<=GROUND_SINK_MAX+8) return true;
  }
  const minFrac=_tileCampaignActive()?0.28:WHEEL_MIN_SUPPORT;
  const sup=_wheelSupportAt(wc.cx,feet,{maxUp:10,maxDrop:GROUND_SINK_MAX+6,pl});
  if(!sup||sup.frac<minFrac) return false;
  return Math.abs(feet-sup.y)<=GROUND_SINK_MAX+6;
}
function _syncPlayerGroundFlag(pl){
  if(!pl) return;
  if(pl.hook&&pl.hook.st==='on'){ pl.og=false; pl._groundHold=0; return; }
  if(pl.wallGrip>0) return;
  const grounded=_playerGrounded(pl);
  pl.og=grounded;
  if(!grounded) pl._groundHold=0;
}
function _playerOnGround(pl){ return _playerGrounded(pl); }
function measureHeadroom(pl=p){
  const body=playerCoreHB(pl);
  const bodyTop=body.y;
  const feet=pl.y+FEET_OFF;
  const fL=body.x, fR=body.x+body.w;
  let minGap=999;
  const cx=pl.x+SW*0.5;
  if(COLL_SEGS.length){
    _eachCollSegNear(cx,BODY_W+48,seg=>{
      if(!_floorSegAllowed(seg,cx,feet)) return;
      if(!_isCeilingSeg(seg,bodyTop,feet)) return;
      const segY=Math.min(seg.y1,seg.y2);
      if(Math.abs(seg.angle||0)>0.14) return;
      const sLo=Math.min(seg.x1,seg.x2), sHi=Math.max(seg.x1,seg.x2);
      if(fR<=sLo||fL>=sHi) return;
      const gap=segY-bodyTop;
      if(gap>=0&&gap<minGap) minGap=gap;
    });
  }
  for(const plat of allP()){
    if(plat.tp!=='ceil'&&plat.tp!=='solid') continue;
    if(plat.x+plat.w<=fL||plat.x>=fR) continue;
    if(plat.y>=feet-GROUND_SINK_MAX-4) continue;
    const ceilB=plat.y+plat.h;
    const gap=ceilB-bodyTop;
    if(gap>=0&&gap<=STAND_H+4&&gap<minGap) minGap=gap;
  }
  return minGap;
}
function _surfaceYAt(cx,feetY,maxDrop=96){
  let best=null, bestDrop=1e9;
  if(COLL_SEGS.length){
    const samples=[cx,cx-FEET_W*0.35,cx+FEET_W*0.35];
    _eachCollSegNear(cx,FEET_W+32,seg=>{
      if(!_walkSegAllowed(seg,cx,feetY)) return;
      const y=_segSupportAt(seg,samples,1,true);
      if(y===null) return;
      const drop=y-feetY;
      if(drop<-24||drop>maxDrop) return;
      if(drop<bestDrop){bestDrop=drop;best=y;}
    });
  }
  for(const pl of TR.map(_normPlat)){
    if(pl.tp!=='solid'||pl.poly) continue;
    if(cx<pl.x-COLL_SEAM||cx>pl.x+pl.w+COLL_SEAM) continue;
    const drop=pl.y-feetY;
    if(drop<-24||drop>maxDrop) continue;
    if(drop<bestDrop){bestDrop=drop;best=pl.y;}
  }
  return best;
}
function _spawnFloorBelow(cx,markerFeet,maxDrop){
  const dropLim=Math.max(maxDrop,480);
  let best=null, bestDrop=1e9;
  const consider=(y)=>{
    if(y==null) return;
    const drop=y-markerFeet;
    if(drop<0||drop>dropLim) return;
    if(drop<bestDrop){ bestDrop=drop; best=y; }
  };
  if(COLL_SEGS.length){
    for(const seg of COLL_SEGS){
      if(!_walkSegAllowed(seg,cx,markerFeet)) continue;
      const y=_floorSegSupportY(seg,cx,false,markerFeet+dropLim);
      if(y!=null) consider(y);
    }
  }
  if(typeof _grassSurfaceYNear==='function'){
    const gy=_grassSurfaceYNear(cx,markerFeet+dropLim,8,dropLim);
    consider(gy);
  }
  return best;
}
// Spawn snap: floor at or below marker only — never pull up to sky platforms.
function _spawnSurfaceYAt(cx,feetY,maxDrop=40,segOnly=false){
  return typeof _spawnFloorBelow==='function'?_spawnFloorBelow(cx,feetY,maxDrop):null;
}
function _roomFloorYBelow(cx,feetY,maxDrop){
  return typeof _findMainFloorBelow==='function'?_findMainFloorBelow(cx,feetY,maxDrop):null;
}
function _snapSpawnToSolid(cx,feetY,maxDrop=40){
  const dropLim=Math.max(maxDrop,640);
  const floor=typeof _spawnFloorBelow==='function'?_spawnFloorBelow(cx,feetY,dropLim):null;
  return floor!=null?floor:feetY;
}

// ── Wall touch / jump ─────────────────────────────────────────
let _wallTouchCacheFr=-1, _wallTouchCache=null;
function _wallTouchInfo(pl){
  if(pl===p&&typeof fr!=='undefined'&&_wallTouchCacheFr===fr) return _wallTouchCache;
  const h=playerCoreHB(pl);
  const bodyL=h.x, bodyR=h.x+h.w, bodyT=h.y+8, bodyB=h.y+h.h-8;
  const midY=(bodyT+bodyB)*0.5;
  const grounded=!!pl.og;
  const nearPad=grounded?5:10;
  const deepPad=grounded?12:18;
  let touch=false, dir=0, pen=0;
  if(COLL_WALL_SEGS.length){
    for(const seg of COLL_WALL_SEGS){
      if(seg.nx!=null&&Math.abs(seg.nx)>0.55){
        for(const px of [bodyL+2,bodyR-2]){
          const cp=_segClosestPoint(seg,px,midY);
          const into=(px-cp.x)*seg.nx+(midY-cp.y)*seg.ny;
          if(into>1.2&&into<deepPad+6){
            if(!touch||into>pen){ touch=true; pen=into; dir=seg.nx>0?1:-1; }
          }
        }
        continue;
      }
      if(bodyB<=seg.minY||bodyT>=seg.maxY) continue;
      const wallX=_wallXAtY(seg,midY);
      if(seg.insideLeft){if(bodyL<=wallX+nearPad&&bodyL>=wallX-deepPad){touch=true;dir=-1;}}
      else if(bodyR>=wallX-nearPad&&bodyR<=wallX+deepPad){touch=true;dir=1;}
    }
  }
  if(!touch){
    const cx=pl.x+SW*0.5;
    for(const plat of allP()){
      if(plat.tp!=='solid') continue;
      if(_isWorldBoundPlat(plat)) continue;
      if(!_platNearX(plat,cx,SW+24)) continue;
      if(bodyB<=plat.y+8||bodyT>=plat.y+plat.h-8) continue;
      if(bodyL<=plat.x+plat.w+nearPad&&bodyL>=plat.x+plat.w-deepPad){touch=true;dir=-1;break;}
      if(bodyR>=plat.x-nearPad&&bodyR<=plat.x+deepPad){touch=true;dir=1;break;}
    }
  }
  const out={touch,dir,pen};
  if(pl===p&&typeof fr!=='undefined'){ _wallTouchCacheFr=fr; _wallTouchCache=out; }
  return out;
}
function _faceAwayFromWall(pl){
  pl.fc=pl.wallDir<0;
  if(!pl._hasAimInput){ pl.aimDX=pl.fc?1:-1; pl.aimDY=0; pl.tAimDX=pl.aimDX; pl.tAimDY=0; }
}
function _wallJumpOff(pl){
  pl.vy=JI; pl.jf=JMH; pl.vx=-pl.wallDir*WLK; pl.wallGrip=0;
  pl._wallChargeReady=false; pl._wallJumpTap=0; pl.og=false;
  _faceAwayFromWall(pl); pl._wallAimFree=20; sfx('jump');
}

// ── Knowl tree boost zone ────────────────────────────────────
function _knowlTreeBoostMul(pl){
  if(!_knowlTreeZone||!pl) return 1;
  const cx=pl.x+SW/2, cy=pl.y+FEET_OFF*0.48;
  const dx=cx-_knowlTreeZone.x, dy=cy-_knowlTreeZone.y;
  return dx*dx+dy*dy<=_knowlTreeZone.r*_knowlTreeZone.r?KNOWL_TREE_BOOST:1;
}
function _nearKnowlTree(pl){ return _knowlTreeBoostMul(pl)>1; }

// ── Enemy damage ──────────────────────────────────────────────
function _damageEnemy(e,dmg,fromX,fromY,kbScale){
  if(!e) return false;
  if(e.mind&&!e.alive){ if(e._mindOff==='rebooting') return _tryInterruptMindReboot(e); return false; }
  if(!e.alive) return false;
  e.hp=Math.max(0,e.hp-dmg);
  e.hitF=14;
  if(e.type==='signol'&&e.signolState==='charge'&&e.hp>0){ e.signolState='roll'; e.chargeT=0; }
  if(fromX!=null&&fromY!=null) _enemyHitKnock(e,fromX,fromY,dmg,kbScale==null?1:kbScale);
  if(e.hp<=0){
    if(e.type==='signol'&&e.signolState!=='dead'){ _signolExplode(e); return true; }
    e.alive=false; e._mindOff='shutdown'; e.shutF=ENEMY_SHUTDOWN_FRAMES;
    e.xlrOn=false; e.magOn=false; e.pt=0;
    if(e.hook) e.hook.st='idle';
    e._shutSettled=false; e._offAnchorX=null; e._offAnchorY=null; e._cooldownEnd=0; e._rebootFill=0;
    e._shutLean=e.mind?((e.vx||0)<-0.2?-0.18:((e.vx||0)>0.2?0.18:(e.fc?0.14:-0.14))):(e.dir>0?0.14:-0.14);
    e.vx=(e.vx||0)*0.35; e.vy=Math.max((e.vy||0),0.8); e.og=false;
    e._itemForceF=0; e._kbF=0;
    if(p&&p.hook&&p.hook.tgt===e){
      if(p.hook.st==='on') _releaseHookAim(p.hook.ax,p.hook.ay);
      p.hook={st:'idle',ex:0,ey:0,evx:0,evy:0,ax:0,ay:0,rl:0,ox:NaN,oy:NaN,tgt:null,tox:0,toy:0};
    }
    sfx('enemy_shut');
    if(_battleTestMode&&e._battleAi) _onBattleRivalDefeated();
    if(_battleTestMode&&e._battleSignol) _onBattleSignolDefeated();
    return true;
  }
  sfx('hit_enemy',_hitSfxPitch(e.hp,e.mhp));
  return false;
}

// ── Entity HP bar draw ────────────────────────────────────────
function _drawEntityHpBar(bx,by,bw,hp,mhp,col){
  const frac=mhp>0?Math.max(0,Math.min(1,hp/mhp)):0;
  const barW=Math.max(12,Math.min(bw,24));
  const x=(bx+(bw-barW)/2)|0;
  ctx.fillStyle=C.BLACK; ctx.fillRect(x,by,barW,3);
  const fill=Math.round((barW-2)*frac);
  ctx.fillStyle=col;
  if(fill>0) ctx.fillRect(x+1,by+1,fill,1);
}

// ── Zero vx into wall (sprint hold) ──────────────────────────
function _zeroVxIntoWall(pl){
  if(!pl) return;
  const wall=typeof _wallTouchInfo==='function'?_wallTouchInfo(pl):{touch:false,dir:0};
  if(wall.touch){
    if(wall.dir>0&&(pl.vx||0)>0) pl.vx=0;
    if(wall.dir<0&&(pl.vx||0)<0) pl.vx=0;
  }
  if(_pushGrindBlocked(pl)) pl.vx=0;
  const dir=pl===p&&typeof _moveInputX==='function'?_moveInputX():0;
  if(pl===p&&typeof isPunch==='function'&&isPunch()&&dir&&wall.touch&&wall.dir===dir) pl.vx=0;
}
