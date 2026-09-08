// ============================================================
//  Mind & Venture — weapons.js
//  Projectile update (player shots, enemy shots, grenades),
//  XLR push / MAG pull continuous effects,
//  breakable wall system (bwalls),
//  crate physics, Knowl pickup,
//  co-op P2 update, particle effects.
//
//  Depends on: physics.js, player.js, enemies.js, audio.js
// ============================================================

// ── Breakable wall constants ──────────────────────────────────
const BWALL_IMPACT_DMG=6.5, BWALL_IMPACT_HARD=10.5;

// ── Enhanced TRS linger-flames (~3.5s, 5 HP / 0.5s) ───────────
const TRS_FLAME_LIFE=210, TRS_FLAME_TICK=30, TRS_FLAME_DMG=5, TRS_FLAME_R=26;
let TRS_FLAMES=[];
function _resetTrsFlames(){ TRS_FLAMES.length=0; }
function spawnTrsFlame(x,y,opts){
  if(!isFinite(x)||!isFinite(y)) return;
  opts=opts||{};
  if(TRS_FLAMES.length>=24) TRS_FLAMES.shift();
  TRS_FLAMES.push({
    x, y,
    life:TRS_FLAME_LIFE, maxLife:TRS_FLAME_LIFE, r:TRS_FLAME_R, born:fr||0,
    stick:opts.stick!==false,
    nx:opts.nx||0, ny:opts.ny||0,
    hero:opts.hero||'mind',
    sparks:[]
  });
}
function _trsTraceShot(s){
  if(!s||!s.enhanced) return;
  if(!s.tracer) s.tracer=[];
  s.tracer.push({x:s.x,y:s.y});
  if(s.tracer.length>36) s.tracer.shift();
}
function _trsLaserDmg(s){
  const enh=!!(s&&s.enhanced);
  if(s&&s.charged) return Math.round(ENM_DMG.laserCharged*(enh?1.45:1));
  return Math.round(ENM_DMG.laser*((s&&s.power)||1));
}
function updateTrsFlames(){
  if(!TRS_FLAMES.length) return;
  for(const e of ENEMS){ if(e._trsBurnCd>0) e._trsBurnCd--; }
  for(let i=TRS_FLAMES.length-1;i>=0;i--){
    const f=TRS_FLAMES[i];
    f.life--;
    if(!f.stick) f.y-=0.12;
    if(!f.sparks) f.sparks=[];
    if((fr&1)===0&&f.sparks.length<22){
      f.sparks.push({
        x:f.x+(Math.random()-0.5)*f.r*0.7,
        y:f.y-2-Math.random()*10,
        vx:(Math.random()-0.5)*1.35,
        vy:-0.2-Math.random()*1.6,
        life:16+Math.random()*18|0,
        r:1.1+Math.random()*2.1
      });
    }
    for(let si=f.sparks.length-1;si>=0;si--){
      const sp=f.sparks[si];
      sp.vy+=0.22;
      sp.x+=sp.vx; sp.y+=sp.vy;
      sp.life--;
      if(sp.life<=0) f.sparks.splice(si,1);
    }
    if(f.life<=0){ TRS_FLAMES.splice(i,1); continue; }
    const burnCol=f.hero==='venture'?'#ff6688':'#cc66ff';
    for(const e of ENEMS){
      if(!_enemyCombatActive(e)) continue;
      const cx=e.x+e.w*0.5, cy=e.y+e.h*0.5;
      if(Math.hypot(cx-f.x,cy-f.y)>f.r+Math.max(e.w,e.h)*0.28) continue;
      if((e._trsBurnCd||0)>0) continue;
      e._trsBurnCd=TRS_FLAME_TICK;
      spawnHitBurst(f.x,e.y,0,-1,burnCol,6);
      _damageEnemy(e,TRS_FLAME_DMG,f.x,f.y,0.12);
    }
  }
}

// ── Laser fizzle effect ───────────────────────────────────────
function spawnLaserFizzle(s){
  const isVenture=s.owner==='venture';
  const colA=isVenture?'#ff5577':'#bb66ff';
  const colB=isVenture?'#ffccaa':'#eeddff';
  const n=s.charged?20:12;
  for(let i=0;i<n;i++){
    const ang=(Math.PI*2*i/n)+Math.random()*0.55;
    const spd=1.2+Math.random()*(s.charged?5:3.2);
    PFXS.push({x:s.x,y:s.y,
      vx:Math.cos(ang)*spd+(s.vx||0)*0.15,
      vy:Math.sin(ang)*spd+(s.vy||0)*0.15,
      life:16+Math.random()*14|0,maxLife:30,
      r:1.5+Math.random()*(s.charged?3:2),
      col:Math.random()>0.4?colA:colB,shimmer:true});
  }
  for(let i=0;i<8;i++){
    PFXS.push({x:s.x+(Math.random()-0.5)*4,y:s.y+(Math.random()-0.5)*4,
      vx:(Math.random()-0.5)*2.4,vy:(Math.random()-0.5)*2.4,
      life:10,maxLife:10,r:2.2,col:'#ffffff',shimmer:true});
  }
}

// ── Breakable wall helpers ────────────────────────────────────
function _isRedBwall(bw){
  return !!(bw&&(typeof _isOmniblockRedGid==='function'?_isOmniblockRedGid(bw.tileGid):bw.tileGid===BWALL_RED_GID||(!bw.tileGid&&bw.movable)));
}
function _mkBwall(x,y,w,h,opts){
  opts=opts||{};
  const isRed=typeof _isOmniblockRedGid==='function'?_isOmniblockRedGid(opts.tileGid):(opts.tileGid===BWALL_RED_GID||(opts.movable!==false&&!!opts.tileGid));
  const hp=opts.hp!=null?opts.hp:(isRed?RED_BWALL_HP:3);
  const maxHp=opts.maxHp!=null?opts.maxHp:(isRed?RED_BWALL_HP:3);
  return {x,y,w,h,hp,maxHp,cracked:false,shakeX:0,shakeY:0,debris:[],
    _destroyFr:null,label:opts.label||(isRed?'BLOCK':'WALL'),col:opts.col||'#9c2218',
    vx:0,vy:0,og:false,movable:!!opts.movable,rot:0,spin:0,
    tileGid:opts.tileGid||0,canvasGid:opts.canvasGid||0,bgGid:opts.bgGid||0,
    homeCol:opts.homeCol??null,homeRow:opts.homeRow??null,
    homeX:opts.homeX??x,homeY:opts.homeY??y,_impactCd:0,_awake:!!opts._awake};
}
function _wakeBwall(bw){ if(!bw||!bw.movable||bw.hp<=0) return; bw._awake=true; bw.og=false; }
function _bwallMovedFromHome(bw){ if(bw.homeX==null||bw.homeY==null) return false; return Math.abs(bw.x-bw.homeX)>4||Math.abs(bw.y-bw.homeY)>4; }

const _OMNI_SHARD_COLS=['#1a0428','#2a0840','#3d0a5c','#4a148c','#6a1b9a','#7b1fa2','#4a0e6a'];
function spawnDebris(bw,count){
  if(!bw.debris) bw.debris=[];
  for(let i=0;i<count;i++){
    const angle=Math.random()*Math.PI*2, spd=1.6+Math.random()*4.2;
    bw.debris.push({
      x:bw.x+Math.random()*bw.w, y:bw.y+Math.random()*bw.h,
      vx:Math.cos(angle)*spd, vy:Math.sin(angle)*spd-2.4,
      rot:Math.random()*Math.PI*2, rotSpd:(Math.random()-0.5)*0.3,
      w:3+Math.random()*8, h:3+Math.random()*7,
      life:55+Math.random()*40, maxLife:95,
      col:_OMNI_SHARD_COLS[(Math.random()*_OMNI_SHARD_COLS.length)|0]
    });
  }
}
function _debrisCollide(d){
  if(typeof _gridReady!=='function'||!_gridReady()) return;
  const t=MV_GRID.tile;
  const px=d.x+d.w*0.5, py=d.y+d.h;
  if(typeof gridWorldSolid==='function'&&gridWorldSolid(px,py+1)){
    const r=Math.floor((py+1)/t);
    d.y=r*t-d.h;
    d.vy=Math.abs(d.vy)>1.2?-d.vy*0.28:0;
    d.vx*=0.72;
  }
  if(typeof gridWorldSolid==='function'&&(gridWorldSolid(d.x-1,d.y+d.h*0.4)||gridWorldSolid(d.x+d.w+1,d.y+d.h*0.4))){
    d.vx*=-0.45;
    d.x+=d.vx;
  }
}
function _damageBwall(bw,kind,fx){
  if(!bw||bw.hp<=0) return;
  fx=fx||{};
  if(_isRedBwall(bw)){
    const pct=typeof kind==='string'?(RED_BWALL_DMG[kind]||0):kind;
    if(pct<=0) return;
    bw.hp=Math.max(0,bw.hp-pct);
    bw.cracked=bw.hp<bw.maxHp;
    if(bw.movable){ _wakeBwall(bw); if(fx.vx!=null) bw.vx=(bw.vx||0)+fx.vx; if(fx.vy!=null) bw.vy=(bw.vy||0)+fx.vy; }
    if(fx.shakeX) bw.shakeX=fx.shakeX; if(fx.shakeY) bw.shakeY=fx.shakeY;
    bw.hitGlow=16;
    spawnDebris(bw,4+Math.ceil(pct/15)); sfx('omniblock_chip');
    if(bw.hp<=0){bw._destroyFr=fr;spawnDebris(bw,22);sfx('omniblock_shatter'); if(typeof gridSyncDestroyedBwall==='function') gridSyncDestroyedBwall(bw);}
    return;
  }
  const dmg=typeof kind==='number'?kind:(kind==='punchCharged'?2:1);
  bw.hp=Math.max(0,bw.hp-dmg); bw.cracked=true;
  if(fx.shakeX) bw.shakeX=fx.shakeX; if(fx.shakeY) bw.shakeY=fx.shakeY;
  bw.hitGlow=16;
  spawnDebris(bw,4+dmg*2); sfx('omniblock_chip');
  if(bw.hp<=0){bw._destroyFr=fr;spawnDebris(bw,18);sfx('omniblock_shatter'); if(typeof gridSyncDestroyedBwall==='function') gridSyncDestroyedBwall(bw);}
}
function _bwallApplyImpact(bw,speed){
  if(speed<BWALL_IMPACT_DMG) return;
  if((bw._impactCd||0)>0) return;
  bw._impactCd=14; bw.shakeX=(Math.random()-0.5)*5; bw.shakeY=-2; bw.hitGlow=16;
  if(bw.movable) return;
  const dmg=speed>=BWALL_IMPACT_HARD?2:1;
  bw.hp=Math.max(0,bw.hp-dmg); bw.cracked=true;
  spawnDebris(bw,4+dmg*3); sfx('omniblock_chip');
  if(bw.hp<=0){bw._destroyFr=fr;spawnDebris(bw,18);sfx('omniblock_shatter'); if(typeof gridSyncDestroyedBwall==='function') gridSyncDestroyedBwall(bw);}
}
const BOX_ROLL_SPEED=2.8, BOX_TUMBLE_FRAMES=11, BOX_GROUND_FRIC=0.76, BOX_REST=0.22;
const BOX_MAG_STICK=26;
const BOX_FACE=Math.PI/2;

function _bwallSolids(skip){
  const out=TR.map(_normPlat);
  for(const bw of BWALLS){
    if(bw===skip||bw.hp<=0||bw.movable) continue;
    out.push({x:bw.x,y:bw.y,w:bw.w,h:bw.h,tp:'solid'});
  }
  return out;
}
function _sanitizeBwall(bw){
  if(!bw) return;
  if(!isFinite(bw.x)||!isFinite(bw.y)){ bw.x=bw.homeX??0; bw.y=bw.homeY??0; bw.vx=0; bw.vy=0; bw._awake=false; }
  if(!isFinite(bw.vx)) bw.vx=0; if(!isFinite(bw.vy)) bw.vy=0;
  const capV=bw.movable?14:8, capY=bw.movable?16:10;
  bw.vx=Math.max(-capV,Math.min(capV,bw.vx)); bw.vy=Math.max(-capY,Math.min(capY,bw.vy));
  if(!isFinite(bw.rot)) bw.rot=0; if(!isFinite(bw.spin)) bw.spin=0;
  if(isFinite(bw.w)&&isFinite(bw.h)){
    bw.x=Math.max(0,Math.min(Math.max(0,WW-bw.w),bw.x));
    bw.y=Math.max(-bw.h,Math.min(Math.max(0,WH-bw.h),bw.y));
  }
}
function _resolveBwallAgainstSolids(bw,solids,prevY){
  const prevBottom=prevY!=null?prevY+bw.h:bw.y+bw.h;
  const live=!!bw.movable;
  for(let pass=0;pass<10;pass++){
    let any=false;
    for(const q of solids){
      if(!ov(bw.x,bw.y,bw.w,bw.h,q.x,q.y,q.w,q.h)) continue;
      const overlapX=Math.min(bw.x+bw.w,q.x+q.w)-Math.max(bw.x,q.x);
      const overlapY=Math.min(bw.y+bw.h,q.y+q.h)-Math.max(bw.y,q.y);
      if(overlapX<=0||overlapY<=0) continue;
      const blockBottom=bw.y+bw.h;
      const onTop=bw.vy>=-0.05&&prevBottom<=q.y+8&&blockBottom>q.y&&bw.y<q.y+q.h*0.6;
      if(onTop){
        bw.y=q.y-bw.h;
        if(live&&bw.vy>3.4){ bw.vy=-bw.vy*0.55; bw.spin=(bw.spin||0)+(bw.vx||0)*0.04; bw.og=false; }
        else{ bw.vy=0; bw.og=true; }
        any=true;
      }
      else if(overlapX<overlapY){
        const dir=bw.x+bw.w/2<q.x+q.w/2?-1:1;
        bw.x=dir<0?q.x-bw.w:q.x+q.w;
        if(live&&Math.abs(bw.vx)>0.6){ bw.vx=-bw.vx*0.58; bw.spin=(bw.spin||0)-dir*0.12; }
        else bw.vx=0;
        any=true;
      }
      else if(bw.vy<0&&bw.y+bw.h/2<q.y+q.h/2){ bw.y=q.y+q.h; bw.vy=0; any=true; }
      else { bw.y=q.y-bw.h; bw.vy=0; bw.og=true; any=true; }
    }
    if(!any) break;
  }
}

function _boxEdgeSupport(box, solids){
  const y=box.y+box.h;
  const inset=Math.max(3, box.w*0.14);
  const pts=[box.x+inset, box.x+box.w*0.5, box.x+box.w-inset];
  const hit=[false,false,false];
  for(const q of solids){
    if(!q||q.tp==='ceil') continue;
    for(let i=0;i<3;i++){
      const px=pts[i];
      if(px>=q.x&&px<=q.x+q.w&&y>=q.y-4&&y<=q.y+10&&box.y<q.y) hit[i]=true;
    }
  }
  if(typeof _gridReady==='function'&&_gridReady()){
    const t=MV_GRID.tile;
    for(let i=0;i<3;i++){
      if(hit[i]) continue;
      const c=Math.floor(pts[i]/t), r=Math.floor((y+1)/t);
      if(gridSolid(c,r)&&Math.abs(y-r*t)<=5) hit[i]=true;
      else if(typeof gridIsSlope==='function'&&gridIsSlope(c,r)){
        const sy=gridSlopeY(c,r,pts[i]);
        if(sy!=null&&Math.abs(y-sy)<=5) hit[i]=true;
      }
    }
  }
  return hit;
}

function _rigidTipOff(box, solids){
  const hit=_boxEdgeSupport(box, solids);
  const n=(hit[0]?1:0)+(hit[1]?1:0)+(hit[2]?1:0);
  if(n===0){ box.og=false; return; }
  if(n>=2||hit[1]){ if(box.vy>=0) box.og=true; return; }
  const dir=hit[0]?1:-1;
  box.vx=(box.vx||0)+dir*0.55;
  box.vy=Math.min((box.vy||0)+0.62, 16);
  box.spin=(box.spin||0)+dir*0.08;
  box.og=false;
}

function _boxShape(box){
  return (box&&(box.shape||box._shape))||'square';
}
function _snapBoxFace(rot){
  if(!isFinite(rot)) return 0;
  return Math.round(rot/BOX_FACE)*BOX_FACE;
}
function _boxLean(rot){
  return (rot||0)-_snapBoxFace(rot);
}
function _tumbleEase(box){
  const n=BOX_TUMBLE_FRAMES;
  const t=1-(box._tumbleT||0)/n;
  return t*t*(3-2*t);
}
function _syncTumbleOrigin(box){
  if(!box||!(box._tumbleT>0)) return;
  const ease=_tumbleEase(box);
  const dir=box._tumbleDir||1;
  box._tumbleX0=box.x-dir*(box.w||32)*ease;
  box._tumbleY0=box.y+Math.sin((1-(box._tumbleT||0)/BOX_TUMBLE_FRAMES)*Math.PI)*7;
}

function _startBoxTumble(box, dir){
  if(!box||box._tumbleT>0||box._magStuck) return;
  if(_boxShape(box)==='circle') return;
  dir=dir||Math.sign(box.vx||0)||1;
  box._tumbleT=BOX_TUMBLE_FRAMES;
  box._tumbleDir=dir;
  box._tumbleX0=box.x;
  box._tumbleY0=box.y;
  box._tumbleFrom=_snapBoxFace(box.rot);
  box.og=false;
}

function _stepBoxTumble(box){
  const n=BOX_TUMBLE_FRAMES;
  box._tumbleT=Math.max(0,(box._tumbleT||0)-1);
  const ease=_tumbleEase(box);
  const dir=box._tumbleDir||1;
  box.x=(box._tumbleX0||box.x)+dir*(box.w||32)*ease;
  box.y=(box._tumbleY0||box.y)-Math.sin((1-box._tumbleT/n)*Math.PI)*7;
  box.rot=(box._tumbleFrom||0)+dir*BOX_FACE*ease;
  box.vx=dir*Math.max(BOX_ROLL_SPEED, Math.abs(box.vx||0))*0.96;
  box.vy=Math.min(box.vy||0, 1.4);
  if(box._tumbleT<=0){
    box.rot=_snapBoxFace((box._tumbleFrom||0)+dir*BOX_FACE);
    box.spin=0;
    box.vx=(box.vx||0)*0.84;
    box.y=box._tumbleY0||box.y;
  }
}

function _steerBoxHome(box){
  if(!box||box.homeX==null||box.homeY==null) return;
  const dx=box.homeX-box.x, dy=box.homeY-box.y;
  if(Math.abs(dx)<3&&Math.abs(dy)<3&&Math.abs(box.vx||0)<0.25&&(box.og||Math.abs(dy)<6)){
    box.x=box.homeX; box.y=box.homeY; box.vx=0; box.vy=0; box.rot=0; box.spin=0;
    box._homing=false; box._awake=false; box.og=true;
    return;
  }
  if(box.og){
    box.vx=(box.vx||0)+Math.sign(dx||0)*0.22;
    box.vx=Math.max(-2.8,Math.min(2.8,box.vx));
  }else{
    box.vx=(box.vx||0)+Math.sign(dx||0)*0.08;
  }
}

function _resolveBoxVsGrid(box){
  if(!box||box._magStuck) return;
  if(typeof _gridReady!=='function'||!_gridReady()) return;
  if(typeof gridResolveActor!=='function') return;
  const x0=box.x, y0=box.y, vx0=box.vx||0, vy0=box.vy||0;
  gridResolveActor(box, 0, 0, box.h||32);
  if(Math.abs(box.x-x0)>0.4&&Math.abs(vx0)>0.35){ box.vx=-vx0*0.55; box.spin=(box.spin||0)-Math.sign(vx0)*0.1; }
  if(box.y<y0-0.4){ box.vy=Math.min(0,vy0); box.og=true; }
  else if(box.y>y0+0.4&&vy0<0) box.vy=-vy0*0.4;
}

function _updateRigidBox(box, solids, opts){
  opts=opts||{};
  const prevX=box.x, prevY=box.y;
  if(box._magStuck){
    return {dx:0, dy:0};
  }
  if((box._tumbleT||0)>0){
    _stepBoxTumble(box);
    _resolveBwallAgainstSolids(box, solids, prevY);
    _resolveBoxVsGrid(box);
    if(box.y+box.h>WH){ box.y=WH-box.h; box.vy=0; box.og=true; }
    _syncTumbleOrigin(box);
    return {dx:box.x-prevX, dy:box.y-prevY};
  }
  box.og=false;
  const grav=typeof GRAV==='undefined'?0.52:GRAV;
  box.vy=Math.min((box.vy||0)+grav*0.72, 16);
  if(box._homing) _steerBoxHome(box);
  box.x+=(box.vx||0);
  _resolveBwallAgainstSolids(box, solids, prevY);
  const yBefore=box.y;
  box.y+=(box.vy||0);
  _resolveBwallAgainstSolids(box, solids, yBefore);
  _rigidTipOff(box, solids);
  _resolveBoxVsGrid(box);
  if(box.y+box.h>WH){ box.y=WH-box.h; box.vy=box.vy>2?-box.vy*0.45:0; box.og=true; }
  if(box.og){
    box.vx=(box.vx||0)*BOX_GROUND_FRIC;
    if(Math.abs(box.vx)<BOX_REST) box.vx=0;
    if(_boxShape(box)==='circle'){
      box.rot+=(box.vx||0)*0.06+(box.spin||0);
      box.spin=(box.spin||0)*0.86;
    }else{
      const lean=_boxLean(box.rot);
      const tip=Math.abs(box.vx)>=BOX_ROLL_SPEED||Math.abs(lean)>0.62||(box._tipUrge||0)>0.34;
      if(tip){
        _startBoxTumble(box, Math.sign(box.vx||lean||box._tipUrge||1));
      }else{
        box.rot+=(_snapBoxFace(box.rot)-box.rot)*0.55;
        box.spin=0;
        if(Math.abs(_boxLean(box.rot))<0.04) box.rot=_snapBoxFace(box.rot);
      }
    }
    box._tipUrge=Math.max(0,(box._tipUrge||0)-0.08);
  }else{
    box.vx=(box.vx||0)*0.996;
    if(_boxShape(box)==='circle'){
      box.rot+=(box.spin||0);
      box.spin=(box.spin||0)*0.985;
    }else{
      box.rot+=(box.spin||0);
      const lean=_boxLean(box.rot);
      if(Math.abs(lean)>BOX_FACE*0.46){
        box.rot=_snapBoxFace(box.rot+Math.sign(lean)*0.02);
        box.spin=(box.spin||0)*0.28;
      }else{
        box.spin=(box.spin||0)*0.96;
      }
    }
  }
  return {dx:box.x-prevX, dy:box.y-prevY};
}
function _carryPlayersOnBwall(bw,dx,dy){
  if(!dx&&!dy) return;
  for(const pl of [p,p2].filter(Boolean)){
    if(!_playerStandingOnPlat(pl,bw)) continue;
    pl.x+=dx; pl.y+=dy;
    pl.x=Math.max(0,Math.min(WW-SW,pl.x));
  }
}
function updateBWalls(){
  for(const bw of BWALLS){
    if(!bw.debris) bw.debris=[];
    _sanitizeBwall(bw);
    if(bw.movable&&bw.hp>0){
      if(!bw._awake&&!bw._magStuck&&!bw._homing){ bw.x=bw.homeX??bw.x; bw.y=bw.homeY??bw.y; bw.vx=0; bw.vy=0; bw.spin=0; bw.rot=0; }
      else{
        const solids=_bwallSolids(bw);
        const d=_updateRigidBox(bw, solids);
        _carryPlayersOnBwall(bw, d.dx, d.dy);
        const fell=bw.homeY!=null&&bw.y>bw.homeY+16;
        if(!bw._magStuck&&!bw._homing&&!fell&&bw.homeX!=null&&Math.abs(bw.x-bw.homeX)<3&&Math.abs(bw.y-bw.homeY)<3
          &&Math.abs(bw.vx)<0.15&&Math.abs(bw.vy)<0.15&&bw.og&&!(bw._tumbleT>0)
          &&!_bwallOverlapsPlayer(bw,p)&&!(p2&&_bwallOverlapsPlayer(bw,p2))){
          bw._awake=false; bw.x=bw.homeX; bw.y=bw.homeY; bw.vx=0; bw.vy=0; bw.spin=0; bw.rot=0;
        }
      }
    }
    if(bw.hitGlow>0) bw.hitGlow--;
    if(bw.shakeX){bw.shakeX*=0.6;bw.shakeY*=0.6;if(Math.abs(bw.shakeX)<0.3){bw.shakeX=0;bw.shakeY=0;}}
    for(let i=bw.debris.length-1;i>=0;i--){
      const d=bw.debris[i];
      d.x+=d.vx;d.y+=d.vy;d.vy+=0.26;d.vx*=0.985;d.rot+=d.rotSpd;d.life--;
      _debrisCollide(d);
      if(d.y>WH||d.life<=0) bw.debris.splice(i,1);
    }
    if(typeof gridSyncBwallOccupancy==='function') gridSyncBwallOccupancy(bw);
  }
  _resolvePoolBodies();
}

// ── Player shots update ───────────────────────────────────────
function updatePlayerShots(){
  const pl=allP();
  for(let i=p.shots.length-1;i>=0;i--){
    const s=p.shots[i];
    const bnc=s.bounces||0;
    const enh=!!s.enhanced;
    const _spd0=Math.hypot(s.vx,s.vy);
    if(!s._fizzle&&((!enh&&bnc>0&&_spd0<2.4)||s.life<18)){ s._fizzle=16; s.vx*=0.4; s.vy*=0.4; }
    if(s._fizzle){
      s._fizzle--; s.vx*=0.86; s.vy*=0.86;
      if(s._fizzle<=0){ spawnLaserFizzle(s); p.shots.splice(i,1); continue; }
    }else if(bnc>0&&!enh){
      const drag=0.984-bnc*0.004; s.vx*=drag; s.vy*=drag;
      s.vy+=0.07+bnc*0.014; s._airAge=(s._airAge||0)+1;
      if(Math.hypot(s.vx,s.vy)<0.42){ spawnLaserFizzle(s); p.shots.splice(i,1); continue; }
    }else if(enh){
      s._airAge=(s._airAge||0)+1;
      if(s._airAge>14){ s.vy+=0.022; s.vx*=0.9992; s.vy*=0.9992; }
    }else if(!enh){
      s._airAge=(s._airAge||0)+1;
      if(s._airAge>8){ s.vy+=0.05; s.vx*=0.997; s.vy*=0.997; }
    }
    s.x+=s.vx; s.y+=s.vy; s.life--;
    _trsTraceShot(s);
    if(s.life<=0&&!s._fizzle){ spawnLaserFizzle(s); p.shots.splice(i,1); continue; }
    let dead=false;
    for(const e of ENEMS){
      if(e.mind&&!e.alive&&e._mindOff==='rebooting'){
        if(ov(s.x-6,s.y-6,12,12,e.x,e.y,e.w,e.h)){ spawnHitBurst(s.x,s.y,s.vx,s.vy,'#44ff88',12); if(s.enhanced) spawnTrsFlame(s.x,s.y,{stick:true,hero:s.owner}); _tryInterruptMindReboot(e); dead=true; break; }
        continue;
      }
      if(!_enemyCombatActive(e)) continue;
      if(_shotHitsEnemy(s.x-6,s.y-6,12,12,e)){
        const ldmg=_trsLaserDmg(s);
        spawnHitBurst(s.x,s.y,s.vx,s.vy,'#44ff88',12);
        if(s.enhanced) spawnTrsFlame(s.x,s.y,{stick:true,hero:s.owner});
        _damageEnemy(e,ldmg,s.x,s.y); dead=true; break;
      }
    }
    if(dead){p.shots.splice(i,1);continue;}
    for(const bw of BWALLS){
      if(bw.hp<=0) continue;
      if(!ov(s.x-4,s.y-4,8,8,bw.x,bw.y,bw.w,bw.h)) continue;
      _damageBwall(bw,s.charged?'laserCharged':'laser',{shakeX:(s.vx>0?1:-1)*3,shakeY:-2,vx:bw.movable?s.vx*0.2:0,vy:bw.movable?s.vy*0.2:0});
      if(s.enhanced) spawnTrsFlame(s.x,s.y,{stick:true,hero:s.owner});
      p.shots.splice(i,1); dead=true; break;
    }
    if(dead) continue;
    if(typeof gridWorldSolid==='function'&&gridWorldSolid(s.x,s.y)){
      const prevX=s.x-s.vx, prevY=s.y-s.vy;
      const keep=enh?0.92:0.76;
      if(gridWorldSolid(s.x,prevY)&&!gridWorldSolid(prevX,s.y)) s.vx*=-keep;
      else s.vy*=-keep;
      s.power=(s.power||1)*(enh?0.92:0.7); s.bounces=(s.bounces||0)+1;
      spawnSpark(s.x,s.y,s.vx,s.vy);
      if(enh) spawnTrsFlame(s.x,s.y,{stick:true,hero:s.owner});
      if((s.bounces||0)>=3){ spawnLaserFizzle(s); p.shots.splice(i,1); continue; }
    }
    for(const q of pl){
      if(!ov(s.x-4,s.y-4,8,8,q.x,q.y,q.w,q.h)) continue;
      const bounces=s.bounces||0;
      if(bounces>=3){ spawnLaserFizzle(s); p.shots.splice(i,1); dead=true; break; }
      const prevX=s.x-s.vx, prevY=s.y-s.vy;
      const hitLeft=prevX+4<=q.x&&s.x+4>q.x, hitRight=prevX-4>=q.x+q.w&&s.x-4<q.x+q.w;
      const hitTop=prevY+4<=q.y&&s.y+4>q.y, hitBot=prevY-4>=q.y+q.h&&s.y-4<q.y+q.h;
      const keep=enh?0.92:0.76;
      if(hitLeft||hitRight) s.vx*=-keep;
      if(hitTop||hitBot)    s.vy*=-keep;
      if(!hitLeft&&!hitRight&&!hitTop&&!hitBot){s.vx*=-keep;s.vy*=-keep;}
      s.power=(s.power||1)*(enh?0.92:0.7); s.bounces=bounces+1; s._airAge=0;
      if(!enh){ s.vx*=0.88; s.vy*=0.88; s.life=Math.min(s.life,180); }
      spawnSpark(s.x,s.y,s.vx,s.vy); sfx('laser_bounce',bounces);
      if(enh) spawnTrsFlame(s.x,s.y,{stick:true,hero:s.owner});
      break;
    }
    if(dead&&i<p.shots.length) p.shots.splice(i,1);
  }
  for(let i=p.pulses.length-1;i>=0;i--){p.pulses[i].r+=13;p.pulses[i].life--;if(p.pulses[i].life<=0)p.pulses.splice(i,1);}
  for(let i=p.magPts.length-1;i>=0;i--){const m=p.magPts[i];m.x+=m.vx;m.y+=m.vy;m.life--;if(m.life<=0)p.magPts.splice(i,1);}
  updateTrsFlames();
}

function _tipField(tip, aimA, ox, oy, range){
  const dx=ox-tip.x, dy=oy-tip.y, dist=Math.hypot(dx,dy)||1;
  if(dist>range) return null;
  const ux=dx/dist, uy=dy/dist;
  const ax=Math.cos(aimA), ay=Math.sin(aimA);
  const align=ux*ax+uy*ay;
  const cone=Math.max(0,(align-0.12)/0.88);
  if(cone<=0) return null;
  return {dist, ux, uy, ax, ay, align, cone, prox:Math.pow(1-dist/range,1.35)};
}
function _boxTipGap(box, tip){
  const nx=Math.max(box.x, Math.min(tip.x, box.x+box.w));
  const ny=Math.max(box.y, Math.min(tip.y, box.y+box.h));
  return Math.hypot(tip.x-nx, tip.y-ny);
}
function _magRecordTip(tip){
  if(!p) return;
  if(!p._magTipHist) p._magTipHist=[];
  p._magTipHist.push({x:tip.x,y:tip.y});
  if(p._magTipHist.length>8) p._magTipHist.shift();
}
function _magThrowVel(){
  const h=(p&&p._magTipHist)||[];
  if(h.length<2) return {vx:0,vy:0.5};
  const a=h[0], b=h[h.length-1], n=Math.max(1,h.length-1);
  return {vx:(b.x-a.x)/n*1.45, vy:(b.y-a.y)/n*1.45};
}
function _pinBoxToTip(box, tip, aimA){
  const ax=Math.cos(aimA), ay=Math.sin(aimA);
  const hx=box.w*0.5, hy=box.h*0.5;
  // Glue a face to the tip — AABB extent along the aim, 1px air.
  const hang=Math.abs(ax)*hx+Math.abs(ay)*hy+1;
  box.x=tip.x+ax*hang-hx;
  box.y=tip.y+ay*hang-hy;
  const v=_magThrowVel();
  box.rot=_snapBoxFace(box.rot);
  box.spin=0;
  box.vx=v.vx; box.vy=v.vy; box.og=false; box._tumbleT=0;
}
function _clearMagHoldFlags(){
  if(!p) return;
  p._magHold=null;
  p._magWorldStick=false;
  p._magWorldX=null; p._magWorldY=null; p._magWorldNx=0; p._magWorldNy=0;
}
function _releaseMagHolds(home){
  const v=_magThrowVel();
  const drop=(box)=>{
    if(!box||!box._magStuck) return;
    box._magStuck=false;
    box._awake=true;
    box.og=false;
    box.vx=v.vx;
    box.vy=v.vy;
    if(home&&box.homeX!=null){ box._homing=true; box.vx*=0.25; box.vy=Math.max(box.vy,0.6); }
  };
  for(const bw of BWALLS) drop(bw);
  for(const c of CRATES) drop(c);
  for(const e of ENEMS){
    if(!e||!e._magStuck) continue;
    e._magStuck=false;
    e.vx=v.vx; e.vy=v.vy;
  }
  _clearMagHoldFlags();
  if(p) p._magTipHist=[];
}
function _applyMagWorldStick(pl){
  if(!pl||!pl._magWorldStick) return;
  const tip=typeof connectorTipWorld==='function'?connectorTipWorld(3):null;
  if(!tip||pl._magWorldX==null){ pl.vx=0; pl.vy=0; return; }
  pl.x+=(pl._magWorldX-tip.x);
  pl.y+=(pl._magWorldY-tip.y);
  pl.vx=0; pl.vy=0; pl.og=false; pl._groundHold=0;
}
function _magWorldHit(tip, aimA){
  const range=34;
  const ax=Math.cos(aimA), ay=Math.sin(aimA);
  if(typeof _gridReady==='function'&&_gridReady()&&typeof gridRayHit==='function'){
    const hit=gridRayHit(tip.x,tip.y,tip.x+ax*range,tip.y+ay*range);
    if(hit){
      const d=Math.hypot(hit.tx-tip.x,hit.ty-tip.y);
      if(d<=range&&(Math.abs(hit.nx)>0.55||Math.abs(hit.ny)>0.55)&&!(Math.abs(hit.nx)>0.35&&Math.abs(hit.ny)>0.35))
        return {x:hit.tx,y:hit.ty,nx:hit.nx||0,ny:hit.ny||0,dist:d};
    }
  }
  if(typeof _raySolidDist==='function'){
    const d=_raySolidDist(tip.x,tip.y,ax,ay,range,3);
    if(d<=range) return {x:tip.x+ax*d,y:tip.y+ay*d,nx:-ax,ny:-ay,dist:d};
  }
  return null;
}
function _applyTipTorque(box, tip, fx, fy){
  if(!box||box._magStuck) return;
  const cx=box.x+box.w*0.5, cy=box.y+box.h*0.5;
  const rx=cx-tip.x, ry=cy-tip.y;
  if(_boxShape(box)==='circle'){
    box.spin=(box.spin||0)+(rx*fy-ry*fx)*0.004;
  }else if(ry<-box.h*0.12 && Math.abs(fx)>0.08){
    box._tipUrge=(box._tipUrge||0)+0.10;
  }
}

function _holdMagStuckActors(){
  if(!p||!p.magOn) return;
  const tip={x:p._magTipX,y:p._magTipY}, a=p._magAim||0;
  if(tip.x==null||!isFinite(tip.x)) return;
  const hold=p._magHold&&p._magHold.ref;
  if(!hold) return;
  if(hold._magStuck&&(hold.w!=null)) _pinBoxToTip(hold,tip,a);
  else if(hold._magStuck){
    const hang=Math.max(hold.w||24,hold.h||24)*0.5+1;
    hold.x=tip.x+Math.cos(a)*hang-(hold.w||24)*0.5;
    hold.y=tip.y+Math.sin(a)*hang-(hold.h||24)*0.5;
    const v=_magThrowVel(); hold.vx=v.vx; hold.vy=v.vy;
  }
}
function _resolvePoolBodies(){
  _holdMagStuckActors();
  const bodies=[];
  const add=(kind,a,x,y,w,h,mass)=>{
    if(!a||!isFinite(x)||!isFinite(y)||w<=0||h<=0) return;
    bodies.push({kind,a,x,y,w,h,mass:mass||1});
  };
  for(const bw of BWALLS){
    if(bw.hp<=0||!bw.movable) continue;
    add('box',bw,bw.x,bw.y,bw.w,bw.h,1.15);
  }
  for(const c of CRATES) add('crate',c,c.x,c.y,c.w,c.h,0.85);
  if(typeof ENEMS!=='undefined'){
    for(const e of ENEMS){
      if(typeof _enemyBodyPresent==='function'&&!_enemyBodyPresent(e)) continue;
      const hb=typeof _enemyItemHB==='function'?_enemyItemHB(e):{x:e.x,y:e.y,w:e.w,h:e.h};
      add('enemy',e,hb.x,hb.y,hb.w,hb.h,0.95);
    }
  }
  if(p&&typeof playerCoreHB==='function'){
    const ph=playerCoreHB(p);
    add('player',p,ph.x,ph.y,ph.w,ph.h,1.6);
  }
  for(let pass=0;pass<12;pass++){
    let hits=0;
    for(let i=0;i<bodies.length;i++){
      for(let j=i+1;j<bodies.length;j++){
        const A=bodies[i], B=bodies[j];
        const ax=A.kind==='player'?(playerCoreHB(p).x):A.a.x;
        const ay=A.kind==='player'?(playerCoreHB(p).y):A.a.y;
        const bx=B.kind==='player'?(playerCoreHB(p).x):B.a.x;
        const by=B.kind==='player'?(playerCoreHB(p).y):B.a.y;
        A.x=ax; A.y=ay; B.x=bx; B.y=by;
        if(!ov(A.x,A.y,A.w,A.h,B.x,B.y,B.w,B.h)) continue;
        const overlapX=Math.min(A.x+A.w,B.x+B.w)-Math.max(A.x,B.x);
        const overlapY=Math.min(A.y+A.h,B.y+B.h)-Math.max(A.y,B.y);
        if(overlapX<=0||overlapY<=0) continue;
        hits++;
        const horiz=overlapX<=overlapY;
        const nx=horiz?(A.x+A.w*0.5<=B.x+B.w*0.5?-1:1):0;
        const ny=horiz?0:(A.y+A.h*0.5<=B.y+B.h*0.5?-1:1);
        const pen=horiz?overlapX:overlapY;
        const aHold=!!A.a._magStuck, bHold=!!B.a._magStuck;
        const aPlayer=A.kind==='player', bPlayer=B.kind==='player';
        if((aHold&&bPlayer)||(bHold&&aPlayer)) continue;
        const mA=(aHold||aPlayer)?1e9:A.mass, mB=(bHold||bPlayer)?1e9:B.mass;
        const invA=1/mA, invB=1/mB, inv=invA+invB;
        const sA=invA/inv, sB=invB/inv;
        const push=pen+1.35;
        if(!aHold&&!aPlayer){ A.a.x+=nx*push*sA; A.a.y+=ny*push*sA; }
        if(!bHold&&!bPlayer){ B.a.x-=nx*push*sB; B.a.y-=ny*push*sB; }
        if(aPlayer&&!bHold){ B.a.x-=nx*push; B.a.y-=ny*push; }
        if(bPlayer&&!aHold){ A.a.x+=nx*push; A.a.y+=ny*push; }
        const avx=A.a.vx||0, avy=A.a.vy||0, bvx=B.a.vx||0, bvy=B.a.vy||0;
        const rvn=(avx-bvx)*nx+(avy-bvy)*ny;
        if(rvn>=0) continue;
        const eRest=Math.abs(rvn)<0.4?0.28:0.62;
        const imp=-(1+eRest)*rvn/inv;
        if(!aHold&&!aPlayer){ A.a.vx=avx+imp*invA*nx; A.a.vy=avy+imp*invA*ny; A.a.spin=(A.a.spin||0)+imp*0.03*nx; if(A.kind==='box') _wakeBwall(A.a); }
        if(!bHold&&!bPlayer){ B.a.vx=bvx-imp*invB*nx; B.a.vy=bvy-imp*invB*ny; B.a.spin=(B.a.spin||0)-imp*0.03*nx; if(B.kind==='box') _wakeBwall(B.a); }
      }
    }
    if(!hits) break;
  }
  for(const bw of BWALLS){ if(bw&&bw.movable) _syncTumbleOrigin(bw); }
  for(const c of CRATES) _syncTumbleOrigin(c);
}

// ── XLR push ──────────────────────────────────────────────────
function updateXLR(){
  if(!p.xlrOn||ITEM!==2) return;
  const enh=typeof _itemEnhanced!=='undefined'&&!!_itemEnhanced[2];
  const _tip=connectorTipWorld(2), _a=Math.atan2(p.aimDY,p.aimDX);
  const _range=enh?230:160;
  const pow=enh?1.85:1;
  if(fr%8===0) p.pulses.push({x:_tip.x,y:_tip.y,a:_a,r:0,maxR:_range,life:14});
  p.flashF=4;
  const hold=Math.min(1,(p.xlrHeld||0)/160)*1.15+1;
  const pcx=p.x+SW*0.5, pcy=p.y+FEET_OFF-STAND_H*0.45;
  const _applyPush=(ox,oy,box)=>{
    const f=_tipField(_tip,_a,ox,oy,_range);
    if(!f) return null;
    const strength=f.prox*f.cone*0.72*hold*pow;
    const close=f.dist<56?Math.pow(1-f.dist/56,1.55):0;
    const adx=ox-pcx, ady=oy-pcy, ad=Math.hypot(adx,ady)||1;
    const fx=f.ax*strength+(adx/ad)*close*0.55;
    const fy=f.ay*strength*0.42+(ady/ad)*close*0.18;
    if(box) _applyTipTorque(box,_tip,fx,fy);
    return {fx,fy};
  };
  for(const e of ENEMS){
    if(!_enemyBodyPresent(e)) continue;
    const hb=_enemyItemHB(e), ox=hb.x+hb.w/2, oy=hb.y+hb.h/2;
    const f=_applyPush(ox,oy,e);
    if(f) _applyItemForceToEnemy(e,f.fx,f.fy);
  }
  for(const c2 of CRATES){
    const f=_applyPush(c2.x+c2.w/2,c2.y+c2.h/2,c2);
    if(f){c2.vx=(c2.vx||0)+f.fx;c2.vy=(c2.vy||0)+f.fy;}
  }
  for(const bw of BWALLS){
    if(bw.hp<=0||!bw.movable) continue;
    const f=_applyPush(bw.x+bw.w/2,bw.y+bw.h/2,bw);
    if(f){_wakeBwall(bw);bw.vx=(bw.vx||0)+f.fx;bw.vy=(bw.vy||0)+f.fy;}
  }
  for(const m of MPLAT){const f=_applyPush(m.x+m.w/2,m.y+m.h/2);if(f){m.vx+=f.fx;}}
  _applyPushWallReaction(p,_tip.x,_tip.y,_a,_range,p.xlrHeld,{enhanced:enh});
}

// ── MAG pull ──────────────────────────────────────────────────
function updateMAG(){
  if(!p.magOn||ITEM!==3){
    if(p&&(p._magHold||p._magWorldStick||(p._magTipHist&&p._magTipHist.length)))
      _releaseMagHolds(ITEM===3&&p.itemStamina<=0);
    return;
  }
  const enh=typeof _itemEnhanced!=='undefined'&&!!_itemEnhanced[3];
  const _tip=connectorTipWorld(3), _a=Math.atan2(p.aimDY,p.aimDX);
  p._magTipX=_tip.x; p._magTipY=_tip.y; p._magAim=_a;
  _magRecordTip(_tip);
  const _range=enh?250:180;
  const pow=enh?1.85:1;
  p.flashF=4;
  if(fr%6===0) for(let i=0;i<4;i++) p.magPts.push({x:_tip.x,y:_tip.y,vx:Math.cos(i*Math.PI/2)*5,vy:Math.sin(i*Math.PI/2)*5,life:14});
  const hold=Math.min(1,(p.magHeld||0)/160)*1.15+1;
  const locked=!!(p._magHold&&p._magHold.ref);

  if(locked){
    const obj=p._magHold.ref;
    if(p._magHold.kind==='world'){
      p._magWorldStick=true;
      return;
    }
    if(obj.hp===0){ _releaseMagHolds(false); return; }
    obj._magStuck=true; obj._homing=false; obj._awake=true;
    if(obj.w!=null) _pinBoxToTip(obj,_tip,_a);
    else{
      const hang=Math.max(obj.w||24,obj.h||24)*0.5+1;
      obj.x=_tip.x+Math.cos(_a)*hang-(obj.w||24)*0.5;
      obj.y=_tip.y+Math.sin(_a)*hang-(obj.h||24)*0.5;
      const v=_magThrowVel(); obj.vx=v.vx; obj.vy=v.vy;
    }
    return;
  }

  const _applyPull=(ox,oy,box)=>{
    const f=_tipField(_tip,_a,ox,oy,_range);
    if(!f) return null;
    const strength=f.prox*f.cone*0.95*hold*pow;
    const fx=-f.ux*strength, fy=-f.uy*strength;
    if(box) _applyTipTorque(box,_tip,fx,fy);
    return {fx,fy,dist:f.dist};
  };

  let best=null, bestD=1e9, pulled=false;
  const consider=(obj,kind,ox,oy,w,h)=>{
    if(!obj||obj.hp===0) return;
    const gap=_boxTipGap({x:ox-w*0.5,y:oy-h*0.5,w,h},_tip);
    const f=_applyPull(ox,oy,obj);
    if(f){
      pulled=true;
      if(kind==='enemy') _applyItemForceToEnemy(obj,f.fx,f.fy);
      else{ obj.vx=(obj.vx||0)+f.fx; obj.vy=(obj.vy||0)+f.fy; if(kind==='box') _wakeBwall(obj); }
    }
    if(gap<=BOX_MAG_STICK && gap<bestD && (f||gap<12)){ bestD=gap; best={obj,kind,w,h}; }
  };

  for(const e of ENEMS){
    if(!_enemyBodyPresent(e)) continue;
    const hb=_enemyItemHB(e);
    consider(e,'enemy',hb.x+hb.w/2,hb.y+hb.h/2,hb.w,hb.h);
  }
  for(const c2 of CRATES){
    if(c2.homeX==null){ c2.homeX=c2.x; c2.homeY=c2.y; }
    consider(c2,'crate',c2.x+c2.w/2,c2.y+c2.h/2,c2.w,c2.h);
  }
  for(const bw of BWALLS){
    if(bw.hp<=0||!bw.movable) continue;
    consider(bw,'box',bw.x+bw.w/2,bw.y+bw.h/2,bw.w,bw.h);
  }
  for(const m of MPLAT){
    const f=_applyPull(m.x+m.w/2,m.y+m.h/2);
    if(f) m.vx+=f.fx;
  }

  if(best){
    best.obj._magStuck=true; best.obj._homing=false; best.obj._awake=true;
    p._magHold={kind:best.kind, ref:best.obj};
    if(best.obj.w!=null) _pinBoxToTip(best.obj,_tip,_a);
    return;
  }

  const world=!pulled?_magWorldHit(_tip,_a):null;
  if(world&&world.dist<=22&&(p.magHeld||0)>8){
    const floorish=world.ny<-0.55||(Math.sin(_a)>0.45&&(p.og||_playerOnGround(p)));
    if(!(floorish&&(p.og||_playerOnGround(p)))){
      p._magHold={kind:'world', ref:p};
      p._magWorldStick=true;
      p._magWorldX=world.x; p._magWorldY=world.y;
      p._magWorldNx=world.nx; p._magWorldNy=world.ny;
    }
  }
}

// ── Enemy shots update ────────────────────────────────────────
function updateEnemyShots(){
  for(let i=ESHOTS.length-1;i>=0;i--){
    const s=ESHOTS[i];
    if(s.type==='signol_frag'){ _updateSignolFrag(s,i); continue; }
    s.x+=s.vx; s.y+=s.vy; s.life--;
    // XLR/MAG deflect
    const _sc=cpt();
    const _sdx=s.x-_sc.x, _sdy=s.y-_sc.y, _sdist=Math.hypot(_sdx,_sdy)||1;
    if(p.xlrOn&&ITEM===2&&_sdist<260){
      const _f=Math.min(1,(p.xlrHeld||0)/120)*0.8+0.3;
      const _aimA=Math.atan2(p.aimDY,p.aimDX);
      s.vx+=(_sdx/_sdist)*_f*1.2+Math.cos(_aimA)*_f*0.8;
      s.vy+=(_sdy/_sdist)*_f*1.2+Math.sin(_aimA)*_f*0.8;
      s.deflected=true;
      const _spd=Math.hypot(s.vx,s.vy); if(_spd>9){s.vx=s.vx/_spd*9;s.vy=s.vy/_spd*9;}
    }else if(p.magOn&&ITEM===3&&_sdist<300){
      const _f=Math.min(1,(p.magHeld||0)/120)*1.0+0.4;
      s.vx+=(-_sdx/_sdist)*_f*1.4; s.vy+=(-_sdy/_sdist)*_f*1.4;
      s.deflected=true;
      const _spd2=Math.hypot(s.vx,s.vy); if(_spd2>12){s.vx=s.vx/_spd2*12;s.vy=s.vy/_spd2*12;}
    }
    // Friendly fire: lasers hit other enemies (skip the shooter)
    let eHitShot=false;
    for(const e of ENEMS){
      if(s.src&&e===s.src) continue;
      if(e.mind&&!e.alive&&e._mindOff==='rebooting'){
        if(ov(s.x-6,s.y-6,12,12,e.x,e.y,e.w,e.h)){
          e.vx+=s.vx*0.22;e.vy+=s.vy*0.15;
          _tryInterruptMindReboot(e); ESHOTS.splice(i,1); eHitShot=true; break;
        }
        continue;
      }
      if(!_enemyCombatActive(e)) continue;
      if(_shotHitsEnemy(s.x-6,s.y-6,12,12,e)){
        e.vx+=s.vx*0.22;e.vy+=s.vy*0.15;
        _damageEnemy(e,Math.round(ENM_DMG.laser*(s.power||1)),s.x,s.y);
        ESHOTS.splice(i,1); eHitShot=true; break;
      }
    }
    if(eHitShot) continue;
    // Hit player
    const _pCoreS=playerCoreHB(p);
    if(_shutdownTimer<=0&&ov(s.x-6,s.y-6,12,12,_pCoreS.x,_pCoreS.y,_pCoreS.w,_pCoreS.h)){
      spawnHitBurst(s.x,s.y,s.vx,s.vy,'#ff4444',10);
      applyPlayerHit(s.vx*0.7,-2.4,PLAYER_HIT_DMG);
      ESHOTS.splice(i,1); continue;
    }
    // Wall ricochet
    let eHit=false;
    for(const pl2 of allP()){
      if(pl2.tp!=='solid') continue;
      if(!ov(s.x-4,s.y-4,8,8,pl2.x,pl2.y,pl2.w,pl2.h)) continue;
      const eb=s.bounces||0;
      if(eb>=3){ESHOTS.splice(i,1);eHit=true;break;}
      const prevX2=s.x-s.vx, prevY2=s.y-s.vy;
      if(Math.abs(prevX2-pl2.x)<6||Math.abs(prevX2-(pl2.x+pl2.w))<6) s.vx*=-0.8;
      else s.vy*=-0.8;
      s.power=(s.power||1)*0.65; s.bounces=eb+1;
      if(!s.born) s.born=fr;
      spawnSpark(s.x,s.y,s.vx,s.vy); sfx('ping'); break;
    }
    if(eHit) continue;
    if(!s.born) s.born=fr;
    if(fr-s.born>180) ESHOTS.splice(i,1);
  }
}

// ── Crate physics ─────────────────────────────────────────────
function updateCrates(){
  const pl=allP();
  for(const c of CRATES){
    if(!isFinite(c.rot)) c.rot=0; if(!isFinite(c.spin)) c.spin=0;
    if(c.homeX==null){ c.homeX=c.x; c.homeY=c.y; }
    const solids=_bwallSolids(c);
    c.movable=true;
    _updateRigidBox(c, solids);
    for(const q of pl){
      if(ov(c.x,c.y,c.w,c.h,q.x,q.y,q.w,q.h)){
        if(c.vy>=0&&c.y+c.h<=q.y+8+Math.abs(c.vy)+2){c.y=q.y-c.h;c.vy=0;c.og=true;c.vx*=0.78;}
        else if(c.vy<0){c.y=q.y+q.h;c.vy=0;}
        else{
          const dir=c.x+c.w/2<q.x+q.w/2?-1:1;
          c.x=dir<0?q.x-c.w:q.x+q.w;
          c.vx=(q.vx||0)*0.82+dir*0.35;
        }
      }
    }
    c.x=Math.max(0,Math.min(WW-c.w,c.x));
  }
  _resolvePoolBodies();
}

// ── Knowl pickup ──────────────────────────────────────────────
function updateKnowls(){
  for(const k of KDROP){
    if(k.got) continue;
    k.px=(k.px||0); k.py=(k.py||0);
    k.px+=(k.vx||0); k.py+=(k.vy||0);
    k.vx=(k.vx||0)*0.82; k.vy=(k.vy||0)*0.82;
    k.px*=0.9; k.py*=0.9;
    if(k.ox!=null){k.x=k.ox+k.px;k.y=k.oy+k.py;}
    k.bob=(k.bob||0)+0.02;
    const _pCoreK=playerCoreHB(p);
    const p1Gets=ov(_pCoreK.x-6,_pCoreK.y,_pCoreK.w+12,_pCoreK.h,k.x-8,k.y-8,16,16);
    const p2Gets=!!(p2&&(()=>{const h2=playerCoreHB(p2);return ov(h2.x-6,h2.y,h2.w+12,h2.h,k.x-8,k.y-8,16,16);})());
    if(p1Gets||p2Gets){
      k.got=true; kColl++;
      if(_awdjooTutorial) _stageScore+=250;
      if(p1Gets) healPlayerFromKnowl();
      if(p2Gets) healAnyPlayerFromKnowl(p2);
      sfx('knowl_pickup');
      for(let pi=0;pi<8;pi++){
        const ang=Math.random()*Math.PI*2, sp=1.2+Math.random()*2.8;
        PFXS.push({x:k.x,y:k.y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-1.6,
          life:16+Math.random()*10|0,maxLife:26,r:2+Math.random()*3,col:'#66ffaa'});
      }
      if(kColl===kTotal){goalOpen=true;sfx('unlock');}
    }
  }
}

// ── Rope pickup ────────────────────────────────────────────────
let _mapRopePickup=null;
let _ropePickupAnim=null;
let _itemTutorial=null;

function updateRopePickup(){
  if(_mapRopePickup&&!_mapRopePickup.got&&!_ropePickupAnim&&!_itemUnlocked(1)){
    const r=_mapRopePickup;
    const h=playerCoreHB(p);
    if(ov(h.x-4,h.y-4,h.w+8,h.h+8,r.x+2,r.y+2,r.w-4,r.h-4)){
      _mapRopePickup.got=true;
      _ropePickupAnim={t:0,sx:r.x+r.w*0.5,sy:r.y+r.h*0.5};
      _grantPlayerItem(1);
      for(let pi=0;pi<14;pi++){
        const ang=Math.random()*Math.PI*2, sp=2+Math.random()*4;
        PFXS.push({x:r.x+r.w*0.5,y:r.y+r.h*0.5,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-2,
          life:20+Math.random()*12|0,maxLife:32,r:2.5+Math.random()*3,col:'#ff8866'});
      }
    }
  }
  if(_ropePickupAnim){
    _ropePickupAnim.t++;
    const a=_ropePickupAnim, prog=Math.min(1,a.t/48);
    const tx=p.x+SW*0.5, ty=p.y+FEET_OFF-STAND_H*0.45;
    const px2=a.sx+(tx-a.sx)*prog, py2=a.sy+(ty-a.sy)*prog-Math.sin(prog*Math.PI)*28;
    if(a.t%4===0) PFXS.push({x:px2,y:py2,vx:(Math.random()-0.5)*1.2,vy:-Math.random()*1.5,life:12,maxLife:16,r:2,col:'#ffaa88'});
    if(a.t>=52){_ropePickupAnim=null;p.flashF=Math.max(p.flashF,14);}
  }
  if(_itemTutorial){ _itemTutorial.t++; if(_itemTutorial.t>=_itemTutorial.maxT) _itemTutorial=null; }
}

// ── World item drops (shutdown loot) ──────────────────────────
let ITEM_DROPS=[];

function _spawnItemDrop(item, x, y, opts){
  if(item<0||item>3) return;
  const enhanced=!!(opts&&opts.enhanced);
  let fy=y, fx=x;
  if(typeof gridStandY==='function'&&typeof _gridReady==='function'&&_gridReady()){
    const s=gridStandY(x, y+8, {maxUp:48, maxDrop:160});
    if(s!=null) fy=s;
  }
  const sz=typeof _itemBoxSize==='function'?_itemBoxSize():{w:36,h:36};
  ITEM_DROPS.push({item, enhanced, x:fx-sz.w*0.5, y:fy-sz.h, w:sz.w, h:sz.h, got:false, bob:Math.random()*Math.PI*2});
}
function _collectItemDrop(d){
  if(!d||d.item<0||d.item>3) return false;
  const wasNew=!_itemUnlocked(d.item);
  if(wasNew) _grantPlayerItem(d.item, !!d.enhanced);
  else ITEM=d.item;
  if(typeof _itemEnhanced!=='undefined') _itemEnhanced[d.item]=!!d.enhanced;
  if(p) p.itemStamina=100;
  try{
    if(d.enhanced) sfx('item_enhanced');
    else if(!wasNew) sfx('knowl_pickup');
  }catch(_e){}
  return true;
}
function _dropPlayerItems(){
  if(!_unlockedMask) return;
  const cx=p.x+SW/2, cy=p.y+FEET_OFF-8;
  let n=0;
  for(let i=0;i<4;i++){
    if(!_itemUnlocked(i)) continue;
    _spawnItemDrop(i, cx+(n-1)*20, cy);
    n++;
  }
  _unlockedMask=0; ITEM=-1;
  p.xlrOn=false; p.magOn=false;
  if(p.hook) p.hook={st:'idle',ex:0,ey:0,evx:0,evy:0,ax:0,ay:0,rl:0,ox:NaN,oy:NaN,tgt:null,tox:0,toy:0};
}
function _dropEnemyItems(e){
  if(!e) return;
  const held=typeof _enemyHeldItems==='function'?_enemyHeldItems(e):(e.item>=0?[e.item]:[]);
  const cx=e.x+(e.w||SW)/2, cy=e.y+(typeof FEET_OFF!=='undefined'?FEET_OFF:88)-8;
  const seen={};
  let n=0;
  for(let hi=0;hi<held.length;hi++){
    const idx=held[hi];
    if(seen[idx]||idx<0) continue;
    seen[idx]=1;
    _spawnItemDrop(idx, cx+(n-0.5)*18, cy);
    n++;
  }
  e._held=[]; e.item=-1;
  e.xlrOn=false; e.magOn=false;
  if(e.hook) e.hook.st='idle';
}
function updateItemDrops(){
  if(!ITEM_DROPS.length) return;
  for(const d of ITEM_DROPS){
    if(d.got) continue;
    d.bob=(d.bob||0)+0.08;
    if(_shutdownTimer<=0&&!_gameOver&&p){
      const h=playerCoreHB(p);
      if(ov(h.x-4,h.y-4,h.w+8,h.h+8,d.x,d.y,d.w,d.h)){
        const lab=typeof _itemLabMode!=='undefined'&&_itemLabMode;
        const canTake=lab||!_itemUnlocked(d.item)||d.enhanced;
        if(canTake&&_collectItemDrop(d)){
          d.got=true;
          for(let pi=0;pi<10;pi++){
            const ang=Math.random()*Math.PI*2, sp=1.6+Math.random()*3;
            PFXS.push({x:d.x+d.w*0.5,y:d.y+d.h*0.5,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-1.6,
              life:14+Math.random()*10|0,maxLife:24,r:2+Math.random()*2,col:ICOLS[d.item]||'#fff'});
          }
          continue;
        }
      }
    }
    for(const e of ENEMS){
      if(!e.mind||!e.alive) continue;
      if(typeof _enemyHasItem==='function'&&_enemyHasItem(e,d.item)) continue;
      if(ov(e.x,e.y,e.w,e.h,d.x,d.y,d.w,d.h)){
        if(typeof _enemyGiveItem==='function') _enemyGiveItem(e,d.item);
        d.got=true;
        break;
      }
    }
  }
}

// ── Particles ─────────────────────────────────────────────────
function updateParticles(){
  for(let i=PFXS.length-1;i>=0;i--){
    const pf=PFXS[i];
    pf.x+=pf.vx; pf.y+=pf.vy; pf.vy+=0.12; pf.vx*=0.92; pf.life--;
    if(pf.life<=0) PFXS.splice(i,1);
  }
}

// ── BG atmosphere ─────────────────────────────────────────────
function updateBgParticles(){
  for(const bat of BATS){
    bat.wingPhase+=bat.wingSpd; bat.x+=bat.vx; bat.y+=bat.vy;
    const dx=bat.x-(p.x+SW/2), dy=bat.y-(p.y+FEET_OFF-STAND_H);
    if(Math.hypot(dx,dy)<120){bat.vx+=dx/120*0.4;bat.vy+=dy/120*0.3;}
    if(fr%60===0){bat.vx+=(Math.random()-0.5)*0.8;bat.vy+=(Math.random()-0.5)*0.4;}
    bat.vx=Math.max(-2.5,Math.min(2.5,bat.vx)); bat.vy=Math.max(-1.2,Math.min(1.2,bat.vy));
    if(bat.x<0) bat.x=WW; if(bat.x>WW) bat.x=0;
    const batHi=Math.min(WH*0.75,900);
    if(bat.y<20) bat.vy=0.5; if(bat.y>batHi) bat.vy=-0.5;
  }
  for(const d of DRIPS){
    if(d.active){ d.y+=d.vy; d.splashF=Math.max(0,d.splashF-1);
      if(d.y>WH-40){d.active=false;d.splashF=8;d.timer=40+Math.random()*120|0;d.y=20+Math.random()*150|0;}
    }else{d.timer--;if(d.timer<=0)d.active=true;}
  }
  for(const st of STREAMS){
    st.wobble+=0.03;
    if(st.pts.length===0) for(let i=0;i<=st.h;i+=8) st.pts.push({ox:0,oy:i});
    for(let i=0;i<st.pts.length;i++) st.pts[i].ox=Math.sin(st.wobble+i*0.4)*2.5*(i/st.pts.length);
  }
}

// ── Co-op P2 ──────────────────────────────────────────────────
function hbFor(pl){ return playerCoreHB(pl); }
function withPlayerContext(pl,fn){ const oldP=p; p=pl; try{return fn();}finally{p=oldP;} }
let _coopRollX0=0, _coopRollY0=0;
function updateCoopPlayer2(){
  if(!p2) return;
  _coopRollX0=p2.x; _coopRollY0=p2.y;
  const lf=!!K2['ArrowLeft'], rt=!!K2['ArrowRight'];
  p2.aimDX=p2.fc?1:-1; p2.aimDY=0; p2.tAimDX=p2.aimDX; p2.tAimDY=0;
  const ms=MOVE_WALK*MOVE_PEAK;
  if(lf) p2.vx=Math.max(p2.vx-MOVE_ACCEL,-ms);
  else if(rt) p2.vx=Math.min(p2.vx+MOVE_ACCEL,ms);
  else{ const gf=p2.og?MOVE_STOP:AIR_DRIFT; p2.vx*=gf; if(p2.og&&Math.abs(p2.vx)<0.22)p2.vx=0; else if(Math.abs(p2.vx)<0.12)p2.vx=0; }
  if(lf)p2.fc=false; else if(rt)p2.fc=true;
  if(Kj2['ArrowUp']&&p2.og){p2.vy=JI;p2.og=false;sfx('jump');}
  if(Kj2['Numpad3']) ITEM=(ITEM+1)%4;
  if(Kj2['Numpad1']){
    if(ITEM===0){withPlayerContext(p2,()=>fireItem(false));if(p2.shots&&p2.shots.length){p.shots.push(...p2.shots);p2.shots.length=0;}}
    else if(ITEM===1) withPlayerContext(p2,()=>fireItem(false));
  }
  if(K2['Numpad1']&&ITEM===2){
    const ca={x:p2.x+SW/2,y:p2.y+FEET_OFF-STAND_H*0.5}, range=155, dir=p2.fc?1:-1;
    for(const e of ENEMS){ if(!_enemyBodyPresent(e))continue; const dx=e.x+e.w/2-ca.x,dy=e.y+e.h/2-ca.y,dist=Math.hypot(dx,dy)||1; if(dist>range)continue; const str=Math.pow(1-dist/range,1.5)*2.1; _applyItemForceToEnemy(e,dir*str,dy/dist*0.15); }
    for(const c of CRATES){ const dx=c.x+c.w/2-ca.x,dy=c.y+c.h/2-ca.y,dist=Math.hypot(dx,dy)||1; if(dist>range)continue; const str=Math.pow(1-dist/range,1.4)*1.9; c.vx+=dir*str;c.vy+=dy/dist*0.12; }
  }else if(K2['Numpad1']&&ITEM===3){
    const ca={x:p2.x+SW/2,y:p2.y+FEET_OFF-STAND_H*0.5}, range=190;
    for(const e of ENEMS){ if(!_enemyBodyPresent(e))continue; const hb=_enemyItemHB(e),dx=ca.x-(hb.x+hb.w/2),dy=ca.y-(hb.y+hb.h/2),dist=Math.hypot(dx,dy)||1; if(dist>range)continue; const str=Math.pow(1-dist/range,1.3)*2.2; _applyItemForceToEnemy(e,dx/dist*str,dy/dist*str); }
    for(const c of CRATES){ const dx=ca.x-(c.x+c.w/2),dy=ca.y-(c.y+c.h/2),dist=Math.hypot(dx,dy)||1; if(dist>range)continue; const str=Math.pow(1-dist/range,1.2)*1.9; c.vx+=dx/dist*str;c.vy+=dy/dist*str; }
    for(const k of KDROP){ if(k.got)continue; const dx=ca.x-k.x,dy=ca.y-k.y,dist=Math.hypot(dx,dy)||1; if(dist>range)continue; const str=Math.pow(1-dist/range,1.25)*1.8; k.vx+=dx/dist*str;k.vy+=dy/dist*str; }
  }
  if(Kj2['Numpad2']){
    const fistCX=p2.fc?p2.x+SW/2+AIM_LEN:p2.x+SW/2-AIM_LEN, fistCY=p2.y+20, fistR=4;
    let hitAny=false;
    for(const e of ENEMS){
      if(!_enemyPunchable(e)) continue;
      if(ov(fistCX-fistR,fistCY-fistR,fistR*2,fistR*2,e.x,e.y,e.w,e.h)){
        if(_enemyRebootInterruptable(e)) _tryInterruptMindReboot(e);
        else if(_enemyCombatActive(e)) _damageEnemy(e,ENM_DMG.punch,p2.x+SW/2,p2.y+FEET_OFF,1.05);
        else _nudgeEnemyBody(e,(p2.fc?1:-1)*4,0);
        hitAny=true;
      }
    }
    for(const bw of BWALLS){
      if(bw.hp<=0)continue;
      if(ov(fistCX-fistR,fistCY-fistR,fistR*2,fistR*2,bw.x,bw.y,bw.w,bw.h)){
        _damageBwall(bw,'punch',{shakeX:(p2.fc?1:-1)*4,shakeY:-2,vx:bw.movable?(p2.fc?6:-6):0,vy:bw.movable?-2:0});
        spawnDebris(bw,8); hitAny=true;
      }
    }
    if(hitAny) p2.vx+=(p2.fc?-1:1)*1.2;
  }
  withPlayerContext(p2,()=>{ if(p2.hook&&p2.hook.st!=='idle') updateHook(); });
  if(p2.hook&&p2.hook.st==='on') return;
  p2.vy=Math.min(p2.vy+GRAV,14);
  _movePlayerWithColl(p2,p2.vx,p2.vy);
  if(p2.y<20){p2.y=20;p2.vy=Math.max(0,p2.vy);}
  if(p2.y>WH+100){const ai=!!p2._aiCompanion,h=p2.hero;p2=mkP();p2.hero=h;p2._aiCompanion=ai;p2.x=p.x+36;p2.y=p.y;}
  if(p2.inv>0) p2.inv--;
  for(const e of ENEMS){
    if(!_enemyCombatActive(e)) continue;
    const _p2Core=playerCoreHB(p2);
    if(p2.inv===0&&ov(_p2Core.x,_p2Core.y,_p2Core.w,_p2Core.h,e.x,e.y,e.w,e.h)){
      p2.hp=Math.max(0,(p2.hp||PLAYER_MAX_HP)-PLAYER_HIT_DMG);
      _syncLivesFromHp(p2); p2.inv=80;
      const _k2=_knockVecFrom(p2.x+SW/2,p2.y+FEET_OFF-STAND_H*0.45,e.x+e.w/2,e.y+e.h/2,
        KB_PLAYER_H*_knockScaleFromDmg(PLAYER_HIT_DMG)*0.9,KB_PLAYER_V*_knockScaleFromDmg(PLAYER_HIT_DMG)*0.9);
      p2.vx=Math.max(-5,Math.min(5,(p2.vx||0)*0.38+_k2.x));
      p2.vy=Math.max(-3,Math.min(1,Math.min(p2.vy||0,0.4)+_k2.y));
      sfx('hurt',_hitSfxPitch(p2.hp,p2.maxHp||PLAYER_MAX_HP));
      if(p2.hp<=0){const ai=!!p2._aiCompanion,h=p2.hero;p2=mkP();p2.hero=h;p2._aiCompanion=ai;p2.x=p.x+36;p2.y=p.y;}
      break;
    }
  }
}
