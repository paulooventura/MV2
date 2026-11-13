// ============================================================
//  beta_lift.js — Awdjoo 1.3 elevators
//
//  The cars in one shaft are tied: they stop together and travel
//  the same distance. Inside, the level music drops out and the
//  HQ bed plays until the doors are open again.
//  A moving cab still picks you up. A clear run wraps you
//  with it, top to bottom. A ceiling sandwiches you.
//
//  The floor you enter on is Equilibrium. Up is one step
//  toward Ink & Vinyl (the 2nd floor, from the lobby).
//  Down is one step toward Gore. From the lobby, down
//  goes to the 6th floor, because every floor of 1.3 is
//  above the street. Full Ink & Vinyl is 33 ups. Full
//  Gore is 33 downs. One ride is one step, not the whole look.
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B) return;
  const T=32, CAB=4*T-6, SPAN=33;
  // Six stops. The street is the floor level. The other five are above it.
  const LEVELS=[
    {n:1, name:'FLOOR LEVEL', row:64},
    // Paulo, Nov 13: "some of the elevator floors are closer and farther from each other. Let's have them
    // about the same vertical distance ... so it actually looks like a building". Ten rows apart now (they
    // were 8 / 10 / 10 / 10 / 12), and the tower's interior (beta_city.js) draws its floors on the same beat.
    {n:2, name:'2ND FLOOR', row:54},
    {n:3, name:'3RD FLOOR', row:44},
    {n:4, name:'4TH FLOOR', row:34},
    {n:5, name:'5TH FLOOR', row:23},                                   // (23, not 24: the long slope west of the tower lands flush on it)
    {n:6, name:'6TH FLOOR', row:14}
  ];
  const S={
    floors:0, pull:0, inside:false, zoom:0, dir:0,
    stage:null, cab:null, near:false, ask:false, sealed:false, laid:false
  };
  window.MV_LIFT=S;
  // Paulo, Nov 4 (build 360): inside a closed cab nothing from outside reaches MIND: no hits
  // (shots, punches, lightning, frags), no foe XLR / MEG; foes can't see him (beta_enemies,
  // beta_mirror) and his own items stay quiet (main.js) until the doors open.
  { const _hit=window.applyPlayerHit;
    if(typeof _hit==='function') window.applyPlayerHit=function(){ if(S.sealed) return; return _hit.apply(this,arguments); }; }
  { const _ov=window.drawDamageOverlay;                    // after the world and its characters, before the HUD
    if(typeof _ov==='function') window.drawDamageOverlay=function(){
      try{ if(B.on&&B.stageId==='1.3'&&window.MV_CITY&&MV_CITY.doors){ if(typeof _worldZoomBegin==='function') _worldZoomBegin(); try{ MV_CITY.doors(); } finally{ if(typeof _worldZoomEnd==='function') _worldZoomEnd(); } } }catch(e){}
      return _ov.apply(this,arguments);
    }; }
  // a foe riding in a closed car: out of sight and out of reach, like MIND (build 362)
  S.cabOf=function(e){
    if(!B.platforms) return null;
    const ex=e.x+(e.w||32)/2, ef=e.y+(e.h||32);
    for(const m of B.platforms){ if(!m.vert||m.x>=23*T||!((m.door||0)>0.7)) continue; if(ex>m.x&&ex<m.x+m.w&&Math.abs(ef-m.y)<14) return m; }
    return null;
  };
  setInterval(()=>{ try{ if(!B.on||B.stageId!=='1.3'||typeof ENEMS==='undefined') return; for(const e of ENEMS) if(e) e._inCab=!!S.cabOf(e); }catch(_e){} },50);
  // T439 (Paulo, Nov 11): "Our sprites should disappear when the elevator doors are closed because
  // currently it's showing parts of it outside of the elevator." MIND (and the companion) are not
  // drawn while they stand in a cab whose doors are shut.
  function inClosedCab(pl){
    if(!pl||!B.platforms) return false;
    const ex=pl.x+SW/2, ef=pl.y+(typeof FEET_OFF==='number'?FEET_OFF:88);
    for(const m of B.platforms){ if(!m.vert||m.x>=23*T||!((m.door||0)>0.7)) continue; if(ex>m.x&&ex<m.x+m.w&&Math.abs(ef-m.y)<20) return true; }
    return false;
  }
  S.inClosedCab=inClosedCab;
  S.rows=LEVELS.map(l=>l.row).sort((a,b)=>a-b);                        // the stops, top to bottom (beta_city draws its storeys on them)
  // Paulo, Nov 13: "when we're getting the elevator, our companion sprites should be revealed at the same time as
  // ours when the elevator opens its door", and going over the roof "our companion's sprite shows falling off
  // from it". The companion rides in your car: while you're shut in, it's kept beside you (hidden like you,
  // carried through the wrap over the roof), and it's let go once the doors are open.
  function companionRide(m){
    let sib=null; try{ sib=window.MV_SIBLING&&MV_SIBLING.on&&MV_SIBLING.state?MV_SIBLING.state():null; }catch(e){}
    if(!sib||!p) return;
    if(m) sib._liftRide=m;
    const r=sib._liftRide; if(!r) return;
    if(!m&&(r.door||0)<0.15){ sib._liftRide=null; return; }          // doors open: it walks out with you
    const FO=typeof FEET_OFF==='number'?FEET_OFF:88, side=(p.x+SW/2<r.x+r.w/2)?1:-1;
    sib.x=Math.max(r.x+2,Math.min(r.x+r.w-SW-2,p.x+side*14)); sib.y=r.y-FO; sib.vx=0; sib.vy=0; sib.og=true;
    sib._fly=false; sib._flying=false; sib._plan=null; sib._ti=null;
    if(sib.hook&&sib.hook.st&&sib.hook.st!=='idle'){ sib.hook.st='idle'; sib.hook.pivots=null; }
    S.sibRides=(S.sibRides|0)+1;
  }
  { const _dc=window.drawCharacter;
    if(typeof _dc==='function') window.drawCharacter=function(){
      // T501 (Paulo, Nov 12): hidden the whole ride, the wrap to the top included, until the doors open —
      // sealed in a car he isn't drawn even on the frames where the car and he are a step apart
      try{ if(B.on&&B.stageId==='1.3'&&typeof p!=='undefined'&&((S.sealed&&(!p._aiCompanion||p._liftRide))||inClosedCab(p))) return; }catch(_e){}
      return _dc.apply(this,arguments);
    }; }
  { const _de=window._damageEnemy;
    if(typeof _de==='function') window._damageEnemy=function(e){ if(e&&e._inCab&&!(S.sealed&&S.cab===S.cabOf(e))) return; if(e) e._provoked=provokeFr(); return _de.apply(this,arguments); }; }
  // T457 (Paulo, Nov 11): "when you're on the 17th level the foes only attack you reactively, and the
  // higher you go ... more and more reluctant to attack you. and ... the other way around (enemies
  // will become more aggressive at the lower levels). Let's have the damage affect us following that
  // pattern too (33rd level up - really easy, 33rd level down - really difficult)." Floors = the
  // elevator's count (S.vibe, -33..33), 1.3 only.
  const floorsNow=()=>(B.on&&B.stageId==='1.3')?(S.vibe||0):0;
  function provokeFr(){ const f=floorsNow(); return f>=17?Math.round(600*(1-0.75*Math.min(1,(f-17)/16))):600; }   // the grudge after a hit shortens going up
  function dmgScale(){ const f=floorsNow(); return f>=0?1-0.75*Math.min(1,f/33):1+1.5*Math.min(1,-f/33); }
  S.dmgScale=dmgScale; S.floorsNow=floorsNow;
  { const _h=window.applyPlayerHit;
    window.applyPlayerHit=function(kx,ky,dmg){ if(S.sealed) return; const k=dmgScale(); if(k!==1&&dmg!=null&&dmg<9000) dmg=Math.max(1,Math.round(dmg*k)); return _h.call(this,kx,ky,dmg); }; }
  { const _ai=B.enemyAITick;
    B.enemyAITick=function(){
      const f=floorsNow(), list=typeof ENEMS!=='undefined'?ENEMS:[];
      const snap=f!==0?list.map(e=>e?[e.heat||0,e.cd||0,e.cool||0]:null):null;
      const r=_ai?_ai.apply(this,arguments):undefined;
      if(!f) return r;
      const up=f>0, calm=up?Math.min(1,f/17):0, aggr=up?0:Math.min(1,-f/33);
      list.forEach((e,i)=>{ if(!e||!e.alive||e._boss) return; const s=snap[i]; if(!s) return;
        if(e._provoked>0) e._provoked--;
        const reactive=up&&f>=17&&!(e._provoked>0);
        if(reactive){ e.heat=0; e.fuse=0; if((e.cd||0)<20) e.cd=20; }
        else if(up){ if((e.heat||0)>s[0]) e.heat=s[0]+(e.heat-s[0])*(1-0.6*calm); }     // slower to warm up on the way there
        else{                                                                               // going down: faster to heat up, fire and recover
          if((e.heat||0)>s[0]) e.heat+=(e.heat-s[0])*1.2*aggr;
          if(e.cd>0&&e.cd<s[1]) e.cd=Math.max(0,e.cd-1.2*aggr);
          if(e.cool>0&&e.cool<s[2]) e.cool=Math.max(0,e.cool-1.2*aggr);
        }
      });
      if(up&&f>=17&&B.ropes) for(let i=B.ropes.length-1;i>=0;i--){ const q=B.ropes[i]; if(q&&q.e&&!(q.e._provoked>0)&&q.st==='fly') B.ropes.splice(i,1); }   // no unprovoked rope throws
      return r;
    }; }
  { const _fx=window._applyEnemyItemFx;
    if(typeof _fx==='function') window._applyEnemyItemFx=function(){ if(S.sealed) return; return _fx.apply(this,arguments); }; }
  const yCache=new Map();

  function live(){ return !!(B.on&&B.stageId==='1.3'&&typeof p!=='undefined'&&p&&typeof _gameState!=='undefined'&&_gameState==='game'&&!(typeof _paused!=='undefined'&&_paused)); }
  function feet(){ return p.y+(typeof FEET_OFF==='number'?FEET_OFF:48); }
  function cx(){ return p.x+(typeof SW==='number'?SW:40)/2; }
  // Keyboard sets Kj for one frame. A pad only holds K (stick and d-pad),
  // so the choice is the rising edge of the same up/down the player already uses.
  function rideChoice(){
    const u=typeof isUp==='function'&&isUp();
    const d=typeof isDn==='function'&&isDn();
    // a quick key tap can go down and up between two frames: the one-frame flag still catches it
    const tu=typeof _bindJ==='function'&&_bindJ('up'), td=typeof _bindJ==='function'&&_bindJ('down');
    const ue=(!!u&&!rideChoice.u)||!!tu, de=(!!d&&!rideChoice.d)||!!td;
    rideChoice.u=!!u; rideChoice.d=!!d;
    if(ue===de) return 0;
    return ue?1:-1;
  }
  function punchEdge(){
    if(typeof _bindJ==='function') return _bindJ('punch');
    return typeof Kj!=='undefined'&&!!Kj['KeyF'];
  }
  function onCab(m){ return !!(m&&B.ridePlat===m); }

  function columns(){
    const map=new Map();
    for(const m of B.platforms||[]){
      if(!m.vert||!m.loop||m.x>=23*T) continue;
      const k=m.x|0;
      if(m._homeDir==null) m._homeDir=m.dir||1;
      if(!map.has(k)) map.set(k,[]);
      map.get(k).push(m);
    }
    return map;
  }
  function surfaceY(colX, row){
    const key=colX+'|'+row;
    if(yCache.has(key)) return yCache.get(key);
    // a looping shaft's street is the one-way platform cutShafts left (the rows under it are open)
    for(const s of S.shafts||[]) if(s.street!=null&&colX>=s.x0-T&&colX<=s.x1+T&&row*T>=s.street){ yCache.set(key,s.street); return s.street; }
    let y=row*T, c=Math.round(colX/T);
    if(typeof gridSolid==='function'){
      let r=row;
      if(gridSolid(c,r)){
        while(r>2&&gridSolid(c,r-1)) r--;
        y=r*T;
      }
    }
    yCache.set(key,y);
    return y;
  }
  function floorIndex(colX, y){
    let best=0, bd=1e9;
    LEVELS.forEach((fl,i)=>{
      const d=Math.abs(surfaceY(colX, fl.row)-y);
      if(d<bd){ bd=d; best=i; }
    });
    return best;
  }
  function destIndex(i, up){
    if(up) return i<LEVELS.length-1?i+1:0;                   // the top floor, up: round to the lobby (build 363)
    if(i<=0) return LEVELS.length-1;
    return i-1;
  }
  function layLedges(){
    if(S.laid||typeof gridSet!=='function'||typeof gridCell!=='function'||typeof MV_GRID_AIR==='undefined'||typeof MV_GRID_ONEWAY==='undefined') return;
    if(typeof MV_GRID==='undefined'||!MV_GRID||!MV_GRID.ready) return;
    const spots=[[8,6],[19,17]];
    for(const fl of LEVELS){
      if(fl.n===1) continue;
      for(const pair of spots){
        for(let k=0;k<2;k++){
          const c=pair[1]+k;
          if(gridCell(c, fl.row)===MV_GRID_AIR) gridSet(c, fl.row, MV_GRID_ONEWAY);
        }
      }
    }
    S.laid=true;
  }
  // T438 (Paulo, Nov 11): a vertical tunnel behind every elevator. The wall and floor sprites stay
  // (they are the tile layer), but the collision grid is cut along each car's whole run, so a car
  // never carries MIND into rock and he is never hurt there. Paulo (later the same day): under a
  // looping shaft the street floor is a platform: drop through it (DOWN + JUMP) and he comes in at
  // the top of the shaft and falls until he lands on the roof of the first car below.
  S.shafts=[];
  // Paulo, Nov 12: the space cut for the cars is "just to be simulated ... the actual level shouldn't be
  // affected by it". Every rock cell the cut opens is remembered: water treats it as rock (it was filling
  // the shaft), and MIND can't climb into the slot cut through the ceiling unless he rides in a car.
  S.cut=new Set();
  S.isCut=(c,r)=>S.cut.size>0&&S.cut.has(r*4096+c);
  function cutShafts(){
    if(typeof MV_GRID==='undefined'||!MV_GRID||!MV_GRID.ready||!B.platforms||!B.platforms.length) return false;
    const groups=new Map();
    for(const m of B.platforms){ if(!m.vert||m.x>=23*T) continue;
      const k=m.x+':'+m.w; let g=groups.get(k);
      if(!g){ g={c0:Math.floor(m.x/T), c1:Math.floor((m.x+m.w-1)/T), top:1e9, bot:-1e9, loop:false}; groups.set(k,g); }
      g.top=Math.min(g.top,Math.min(m.ya,m.yb)-CAB); g.bot=Math.max(g.bot,Math.max(m.ya,m.yb)); if(m.loop) g.loop=true; }
    const R=MV_GRID.rows, air=(c,r)=>{ if(r<0||r>=R) return; const t=gridCell(c,r); if(t!==MV_GRID_AIR&&!(typeof gridIsSlope==='function'&&gridIsSlope(c,r))){ S.cut.add(r*4096+c); gridSet(c,r,MV_GRID_AIR); } };
    S.shafts=[];
    for(const g of groups.values()){
      const r0=Math.max(0,Math.floor(g.top/T)), rb=Math.floor(g.bot/T);
      let street=null;
      if(g.loop){                                    // the street floor: the first solid row at or above the car's lowest stop
        for(let r=Math.min(R-1,rb);r>=r0;r--){ let solidRow=true; for(let c=g.c0;c<=g.c1;c++){ const t=gridCell(c,r); if(!(t===MV_GRID_SOLID||t===MV_GRID_DESTRUCT)) { solidRow=false; break; } } if(solidRow&&gridCell(g.c0,r-1)===MV_GRID_AIR){ street=r; break; } }
      }
      for(let c=g.c0;c<=g.c1;c++){
        for(let r=r0;r<=rb;r++){ if(r===street) continue; air(c,r); }
        if(street!=null){ S.cut.add(street*4096+c); gridSet(c,street,MV_GRID_ONEWAY); air(c,street+1); air(c,street+2); }
      }
      // the ceiling slot: the run of cut rows from the top of the shaft down (rock in the level)
      let cr=r0; while(cr<rb&&S.isCut(g.c0,cr)&&S.isCut(g.c1,cr)) cr++;
      S.shafts.push({x0:g.c0*T, x1:(g.c1+1)*T, top:r0*T, street:street!=null?street*T:null, loop:g.loop, ceil:cr>r0?cr*T:null});
    }
    yCache.clear();
    return true;
  }
  // under the street platform: in again at the top of the shaft, falling
  function shaftWrap(){
    if(!p) return;
    const x=p.x+SW/2, f=p.y+(typeof FEET_OFF==='number'?FEET_OFF:88);
    for(const s of S.shafts){
      if(!s.loop||s.street==null||x<s.x0||x>s.x1) continue;
      if(f>s.street+T+6){
        p.y=s.top+T*2-(typeof FEET_OFF==='number'?FEET_OFF:88); p.vy=Math.max(2,p.vy||0); p.og=false;
        if(p.hook&&p.hook.st&&p.hook.st!=='idle'&&typeof _detachPlayerRope==='function') _detachPlayerRope(p.hook,'snap');
        if(B.ridePlat) B.ridePlat=null; B.roofPlat=null;
        S.wraps=(S.wraps|0)+1;
        try{ if(typeof sfx==='function') sfx('whoosh'); }catch(e){}
      }
    }
  }
  S.cutShafts=cutShafts;
  // outside a car MIND can't go up into the ceiling slot: his head stops at the rock line, and a car roof
  // he rides on puts him off at the side before it goes in
  function ceilingSlot(){
    if(!p||S.sealed||S.hold||inClosedCab(p)) return;
    const x=p.x+SW/2, FO=typeof FEET_OFF==='number'?FEET_OFF:88, head=p.y+FO-(typeof STAND_H==='number'?STAND_H:70)-(typeof WHEEL_R==='number'?WHEEL_R:12);
    for(const s of S.shafts){
      if(s.ceil==null||x<s.x0-2||x>s.x1+2) continue;
      if(head>=s.ceil) continue;
      const roof=B.roofPlat&&B.roofPlat.x>=s.x0-T&&B.roofPlat.x<s.x1;
      if(roof||head<s.ceil-T){                       // carried in on a roof, or got in some other way: out at the side
        const left=x-s.x0<s.x1-x, nx=left?s.x0-SW/2-6:s.x1-SW/2+6;
        p.x=nx; p.vx=left?-2:2; p.og=false; B.roofPlat=null; if(B.ridePlat&&B.ridePlat.vert) B.ridePlat=null;
        if(head<s.ceil) p.y+=s.ceil-head;
      }else{ p.y+=s.ceil-head; if((p.vy||0)<0) p.vy=0; }
      if(p.hook&&p.hook.st&&p.hook.st!=='idle'&&p.hook.ey<s.ceil&&p.hook.ex>s.x0&&p.hook.ex<s.x1&&typeof _detachPlayerRope==='function') _detachPlayerRope(p.hook,'snap');
      S.ceilBlocks=(S.ceilBlocks|0)+1;
    }
  }
  function resume(m){
    m.phase='run'; m._lift=null; m.destY=null; m.lockY=null; m.locked=false;
    m._used=false; m._called=false; m.doorT=0; m._linkLeft=null; m._flash=0;
    if(m._homeDir!=null) m.dir=m._homeDir;
  }
  function nearestButton(){
    const x=cx(), y=feet()-48;
    let best=null, bd=70;
    for(const b of pads()){
      const d=Math.hypot(x-b.x,y-b.by);
      if(d<b.r+48&&d<bd){ bd=d; best=b; }
    }
    return best;
  }
  function pads(){
    const out=[];
    for(const [col,cabs] of columns()){
      for(const fl of LEVELS){
        const sy=surfaceY(col, fl.row);
        const by=sy-58;
        let bx=col-36;
        if(typeof gridWorldSolid==='function'){
          for(let i=0;i<8;i++){
            const x=col-20-i*8;
            if(!gridWorldSolid(x,by)){ bx=x; break; }
          }
        }
        out.push({col, fl, y:sy, cabs, x:bx, by, r:16});
      }
    }
    return out;
  }
  function tone(a,t,f0,f1,peak,dur,type){
    const o=a.createOscillator(), g=a.createGain();
    o.type=type||'sine';
    o.frequency.setValueAtTime(f0,t);
    if(f1) o.frequency.exponentialRampToValueAtTime(Math.max(40,f1),t+dur*0.7);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(peak,t+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t+dur+0.02);
  }
  function pressSfx(){
    S.press=16;
    S._bell=(typeof fr==='number'?fr:0)+12;
    try{
      const a=typeof ga==='function'?ga():null; if(!a){ sfx('land'); return; }
      const t=a.currentTime;
      tone(a,t,180,70,0.16,0.09,'triangle');
      tone(a,t+0.04,659,659,0.16,0.22,'sine');
      tone(a,t+0.16,880,880,0.12,0.28,'sine');
    }catch(e){}
  }
  function arriveChime(){
    if((S._arriveBell||0)>(typeof fr==='number'?fr:0)) return;
    S._arriveBell=(typeof fr==='number'?fr:0)+24;
    S.arrive=28;
    try{
      const a=typeof ga==='function'?ga():null; if(!a){ sfx('land'); return; }
      const t=a.currentTime;
      tone(a,t,90,48,0.2,0.16,'triangle');
      tone(a,t+0.08,523,523,0.18,0.34,'sine');
      tone(a,t+0.26,784,784,0.16,0.46,'sine');
    }catch(e){}
  }
  function travelSfx(){
    try{
      const a=typeof ga==='function'?ga():null; if(!a) return;
      const t=a.currentTime;
      tone(a,t,70,140,0.1,0.35,'sawtooth');
    }catch(e){}
  }
  function closestCab(cabs, y){
    let best=null, bd=1e9;
    for(const m of cabs){
      if(m.phase&&m.phase!=='run') continue;
      const d=Math.abs(m.y-y);
      if(d<bd){ bd=d; best=m; }
    }
    if(best) return best;
    for(const m of cabs){
      const d=Math.abs(m.y-y);
      if(d<bd){ bd=d; best=m; }
    }
    return best;
  }
  function columnOf(m){
    for(const [,cabs] of columns()) if(cabs.indexOf(m)>=0) return cabs;
    return m?[m]:[];
  }
  function shiftColumn(cabs, delta, phase){
    for(const c of cabs){
      if(c._homeDir==null) c._homeDir=c.dir||1;
      c._linkLeft=delta; c._lift='go'; c.phase=phase; c.doorT=0; c._arrive=false;
    }
  }
  function resumeColumn(m){
    for(const c of columnOf(m)) resume(c);
  }
  function holdCab(m, open){
    m._linkLeft=0; m._lift='hold'; m.lockY=m.y; m.destY=m.y;
    if(open){
      m.phase='open'; m.doorT=0; m._arrive=true; m._flash=26;
      arriveChime();
    }else{
      m.phase='park'; m._arrive=false;
    }
  }
  function callCab(btn){
    const m=closestCab(btn.cabs, btn.y);
    if(!m) return;
    let y=btn.y;
    const fy=feet();
    if(Math.abs(fy-btn.y)<56) y=fy;
    y=Math.max(m.ya+4, Math.min(m.yb-4, y));
    const delta=y-m.y;
    for(const c of btn.cabs) c._called=c===m;
    shiftColumn(btn.cabs, delta, 'summon');
    pressSfx();
  }
  function go(m, up){
    const i=floorIndex(m.x, m.y);
    const n=destIndex(i, up);
    if(n==null) return;
    const fl=LEVELS[n];
    let delta=surfaceY(m.x, fl.row)-m.y;
    // Paulo, Nov 4 (build 363): Donkey Kong style. Down from the lobby the car sinks through
    // the floor and comes in from the top of the shaft to the top floor; up from the top floor
    // it rises out through the roof and comes in from the bottom. Its riders go with it.
    const span=m.loop?(m.yb-m.ya):0;
    if(span>8){
      if(!up&&n>i&&delta<0&&delta+span>0) delta+=span;
      else if(up&&n<i&&delta>0&&delta-span<0) delta-=span;
    }
    shiftColumn(columnOf(m), delta, 'go');
    for(const c of columnOf(m)) c._used=true;
    S.ask=false; S.dir=up?1:-1; S.vibe=(S.vibe||0)+(up?1:-1);
    S.vibe=Math.max(-SPAN, Math.min(SPAN, S.vibe));
    travelSfx();
  }
  function fullFilter(m){
    const C=window.MV_CONSOLE; if(!C||typeof C.set!=='function'||C.mode===m) return;
    // GORE is a secret filter: reaching it 33 floors down unlocks it, as the code on the FILTER row does
    if(m==='gore'&&typeof _goreUnlocked==='function'&&!_goreUnlocked()&&typeof _goreUnlock==='function'){ _goreUnlock(); return; }
    if(!S.forced) S.baseMode=C.mode;
    C.set(m);
    if(C.mode===m){ S.forced=m; try{ uiShowToast(m==='ink'?'INK & VINYL - THE 33RD FLOOR':'GORE - 33 FLOORS DOWN'); }catch(e){} }
  }
  function aboard(m){
    if(onCab(m)) return true;
    if(!m||!p) return false;
    const x=cx();
    if(x<m.x-10||x>m.x+m.w+10) return false;
    return Math.abs(feet()-m.y)<16;
  }

  S.afterPlatforms=function(){
    const ch=rideChoice();
    if(!B.platforms) return;
    const id=B.stageId;
    if(id!==S.stage){
      S.stage=id; S.vibe=0; S.floors=0; S.pull=0; S.dir=0; S.zoom=0; S.musicT=0; S.barT=0;
      S.cab=null; S.inside=false; S.ask=false; S.sealed=false; S.laid=false; S.near=false;
      yCache.clear(); S.cut.clear();
      for(const m of B.platforms){ m.phase=null; m._lift=null; m.door=0; m._used=false; }
    }
    if(!live()){
      S.inside=false; S.cab=null; S.near=false; S.ask=false; S.sealed=false;
      S.pull+=(0-S.pull)*0.08; S.zoom+=(0-S.zoom)*0.08; S.dir+=(0-S.dir)*0.08;
      try{ if(window.MV_BETA_AUDIO&&MV_BETA_AUDIO.liftMix) MV_BETA_AUDIO.liftMix(); }catch(e){}
      return;
    }
    layLedges();
    if(S._cutFor!==B.platforms&&cutShafts()) S._cutFor=B.platforms;
    shaftWrap();
    ceilingSlot();
    // a car that just wrapped takes the foes standing in it along (MIND is carried by beta_water)
    if(typeof ENEMS!=='undefined') for(const m of B.platforms){
      if(!m.vert||!m.wrapped||!m.loop) continue;
      const span=m.yb-m.ya;
      for(const e of ENEMS){
        if(!e) continue;
        const ex=e.x+(e.w||32)/2, ef=e.y+(e.h||32);
        if(ex<m.x-4||ex>m.x+m.w+4) continue;
        if(Math.abs(ef-(m.y+span))<24||Math.abs(ef-(m.y-span))<24){ e.y=m.y-(e.h||32); e.vy=0; e.og=true; }
      }
    }
    let sealed=null, hold=null, tookPunch=false;
    for(const [,cabs] of columns()){
      for(const m of cabs){
        const tgt=(m.phase==='shut'||m.phase==='go')?1:0;
        m.door=(m.door||0)+(tgt-(m.door||0))*(m.phase==='open'?0.08:0.16);
        if(m._flash>0) m._flash--;
        if(m.phase==='summon'||m.phase==='go'){
          m._lift='go';
          // T455 (Paulo, Nov 11): riding past the top, the car wraps to the bottom of its loop in one
          // frame; MIND sealed in it stays in it (aboard() lost him there: he was left at the top)
          const rider=m.phase==='go'&&(aboard(m)||(S.cab===m&&S.sealed));
          if(m._linkLeft!=null&&Math.abs(m._linkLeft)<0.4){
            if(m.phase==='go'&&rider) holdCab(m,true);
            else if(m.phase==='summon'&&m._called) holdCab(m,true);
            else holdCab(m,false);
          }else if(rider) sealed=m;
        }else if(m.phase==='park'){
          m._lift='hold'; m.lockY=m.y;
        }else if(m.phase==='open'){
          m._lift='hold'; m.lockY=m.y;
          const opening=(m.door||0)>0.1;
          if(aboard(m)){
            if(opening&&m._used) sealed=m;
            if(m._called){
              m._called=false; m.phase='shut'; m._arrive=false; m._used=true; S.ask=true;
            }else if(!opening){
              hold=m;
              if(punchEdge()){ m.phase='shut'; m._arrive=false; m._used=true; S.ask=true; tookPunch=true; pressSfx(); }
            }
          }else if(m._called){
            if(Math.abs(cx()-(m.x+m.w/2))>220) resumeColumn(m);
          }else resumeColumn(m);
        }else if(m.phase==='shut'){
          m._lift='hold'; m.lockY=m.y; m._used=true;
          if(aboard(m)) sealed=m;
          else resumeColumn(m);
        }else if(m._lift){
          resumeColumn(m);
        }
      }
    }
    S.cab=sealed; S.sealed=!!sealed; S.inside=!!sealed; S.hold=hold;
    companionRide(sealed);
    if(sealed){
      const left=sealed.x+6, right=sealed.x+sealed.w-6-(typeof SW==='number'?SW:40);
      // against a cab wall, the push doesn't build speed (or he shoots out when the doors open)
      if(p.x<left){ p.x=left; if(p.vx<0) p.vx=0; }
      if(p.x>right){ p.x=right; if(p.vx>0) p.vx=0; }
      p.y=sealed.y-(typeof FEET_OFF==='number'?FEET_OFF:48);
      p.vy=0; p.og=true;
      S.near=false;
    }else if(!tookPunch){
      S.ask=false;
      const btn=nearestButton();
      S.near=!!btn;
      if(btn&&punchEdge()) callCab(btn);
    }else S.near=false;
    if((S.press||0)>0) S.press--;
    const car=sealed||hold;
    const doorsReady=!car||car.phase==='shut'||(car.phase==='open'&&(car.door||0)<0.15);
    if(car&&doorsReady&&ch){
      car._arrive=false;
      S.ask=true;
      go(car, ch>0);
    }
    S.floors=S.vibe||0;
    const tgt=Math.max(-1,Math.min(1,S.floors/SPAN));
    S.pull+=(tgt-S.pull)*0.04;
    // Paulo, Nov 11: from where 1.3 starts, each floor up fades the picture and the music toward
    // Ink & Vinyl, each floor down toward GORE (MV_LIFT.pull, read by ink_vinyl.js, beta_gore.js,
    // gore_metal.js and beta_audio.js liftMix). At the 33rd floor, once the fade is full, the game
    // switches to that filter for real.
    if(Math.abs(S.vibe||0)>=SPAN&&Math.abs(S.pull)>0.985) fullFilter(S.vibe>0?'ink':'gore');
    // Paulo, Nov 13: "the music for ink & vinyl only gets fully transitioned from the standard music when we
    // reach the 33rd floor. That way we know when we got to the 33rd floor. The visual effects can be gradually
    // phased". The picture keeps fading floor by floor (pull); the song stays until floor 33 (or -33), then
    // crossfades over ~2 s (beta_audio liftMix, tempo-matched), and goes back if you ride down from there.
    { const at=Math.abs(S.vibe||0)>=SPAN?1:0; S.musicT=(S.musicT||0)+(at-(S.musicT||0))*0.025; S.musicDir=Math.sign(S.vibe||0)||S.musicDir||1; }
    // leaving heaven (or the depths) gives you back the filter you had: the full switch is only up there
    if(S.forced&&Math.abs(S.vibe||0)<SPAN){ const C=window.MV_CONSOLE; if(C&&C.mode===S.forced&&typeof C.set==='function'){ try{ C.set(S.baseMode||'off'); }catch(e){} } S.forced=null; }
    // the floor bar: every time the doors open on you, the 67 floors show on the right for a few seconds
    { const open=!!(S.cab||S.hold)&&!S.sealed; if(S._wasSealed&&!S.sealed) S.barT=200; S._wasSealed=S.sealed; if(S.barT>0&&!open&&!S.sealed) S.barT--; else if(S.barT>0&&open) S.barT=Math.max(S.barT-1,60); }
    const zT=S.sealed?1:0;
    S.zoom+=(zT-S.zoom)*(S.sealed?0.1:0.06);
    if(!S.sealed) S.dir+=(0-S.dir)*0.06;
    try{ if(window.MV_BETA_AUDIO&&MV_BETA_AUDIO.liftMix) MV_BETA_AUDIO.liftMix(); }catch(e){}
  };

  S.fist=function(wx,wy,wr){
    if(!live()||(S._bell||0)>(typeof fr==='number'?fr:0)) return false;
    const m=S.cab||S.hold;
    if(m){
      const bx=m.x+m.w*0.5, by=m.y-CAB+18;
      if(Math.hypot(wx-bx,wy-by)<=(wr||12)+16){
        pressSfx();
        if(m.phase==='open'){ m.phase='shut'; m._arrive=false; m._used=true; S.ask=true; }
        return true;
      }
      return false;
    }
    for(const b of pads()){
      if(Math.hypot(wx-b.x,wy-b.by)<=(wr||12)+b.r){ callCab(b); return true; }
    }
    return false;
  };

  function drawPad(x,y,lit){
    const frn=typeof fr==='number'?fr:0;
    const press=Math.max(0,S.press||0)/16;
    const sink=press>0.45?(1-(press-0.45)/0.55):press/0.45;
    const breathe=0.55+0.45*Math.sin(frn*0.12);
    const arrive=Math.max(0,(S.arrive||0)/28);
    const hot=lit||arrive>0.02;
    const px=sx(x), py=sy(y+sink*5);
    ctx.save();
    ctx.fillStyle='#1a1614';
    ctx.fillRect(sx(x)-sw(16),sy(y)-sw(20),sw(32),sw(40));
    ctx.strokeStyle=hot?'#ffd27a':'#6a5a48';
    ctx.lineWidth=Math.max(1,sw(2));
    ctx.strokeRect(sx(x)-sw(16),sy(y)-sw(20),sw(32),sw(40));
    ctx.fillStyle='#3a322c';
    ctx.beginPath(); ctx.arc(px,py,sw(13),0,Math.PI*2); ctx.fill();
    ctx.fillStyle=hot?('#ffb43a'):('#c9842a');
    ctx.globalAlpha=0.85+0.15*breathe;
    ctx.beginPath(); ctx.arc(px,py,sw(9-sink*2),0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    ctx.fillStyle='rgba(255,246,210,'+(0.35+0.4*breathe*(hot?1:0.4))+')';
    ctx.beginPath(); ctx.arc(px-sw(2.5),py-sw(3),sw(3),0,Math.PI*2); ctx.fill();
    if(hot||press>0){
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle='rgba(255,190,80,'+(0.18+0.35*Math.max(press,arrive,breathe*0.4))+')';
      ctx.beginPath(); ctx.arc(sx(x),sy(y),sw(22+10*Math.max(press,arrive)),0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
  function drawStops(){
    if(!live()||typeof sx!=='function') return;
    for(const b of pads()){
      if(b.fl.n!==1){
        ctx.fillStyle='#6a6258';
        ctx.fillRect(sx(b.col-T*2),sy(b.y),sw(T*2),sw(8));
        ctx.fillStyle='#c8b49a';
        ctx.fillRect(sx(b.col-T*2),sy(b.y),sw(T*2),sw(3));
      }
      const here=b.cabs.some(m=>m._called&&(m.phase==='open'||m.phase==='summon')&&Math.abs(m.y-b.y)<28);
      drawPad(b.x,b.by,here);
    }
    const shown=S.cab||S.hold;
    if(shown) drawPad(shown.x+shown.w/2, shown.y-CAB+18, true);
    if((S.arrive||0)>0){
      S.arrive--;
      const k=S.arrive/28;
      for(const [,cabs] of columns()) for(const m of cabs) if((m._flash||0)>0){
        ctx.save(); ctx.globalCompositeOperation='lighter';
        ctx.strokeStyle='rgba(255,220,150,'+(0.65*k)+')'; ctx.lineWidth=Math.max(2,sw(3));
        ctx.strokeRect(sx(m.x)-sw(4),sy(m.y-(4*T-6))-sw(4),sw(m.w+8),sw(4*T-6+8));
        ctx.restore();
      }
    }
  }
  function hookStops(){
    const prev=B.drawWorldExtras;
    if(typeof prev!=='function'){ setTimeout(hookStops,40); return; }
    if(prev._liftStops) return;
    const wrapped=function(){
      const r=prev.apply(this,arguments);
      try{ drawStops(); }catch(e){}
      return r;
    };
    wrapped._liftStops=true;
    B.drawWorldExtras=wrapped;
  }
  hookStops();

  const buf=document.createElement('canvas'), bg=buf.getContext('2d');
  function screenCab(m){
    const z=(typeof camZoom==='number'&&camZoom)||1;
    return {x:sx(m.x)*z, y:sy(m.y-CAB)*z, w:Math.max(12,sw(m.w)*z), h:Math.max(12,sw(CAB)*z)};
  }
  function veil(){
    if(!S.sealed||!S.cab||typeof ctx==='undefined'||typeof sx!=='function') return;
    const cv=ctx.canvas;
    if(buf.width!==cv.width||buf.height!==cv.height){ buf.width=cv.width; buf.height=cv.height; }
    bg.drawImage(cv,0,0);
    const cab=screenCab(S.cab);
    const blur=4+3*Math.min(1,S.zoom||0);
    ctx.save();
    try{ ctx.filter='blur('+blur.toFixed(1)+'px)'; }catch(e){}
    ctx.drawImage(buf,0,0);
    ctx.filter='none';
    ctx.fillStyle='rgba(4,2,8,0.62)';
    ctx.fillRect(0,0,cv.width,cv.height);
    const pad=6;
    const x=Math.max(0,cab.x-pad), y=Math.max(0,cab.y-pad);
    const w=Math.min(cv.width-x,cab.w+pad*2), h=Math.min(cv.height-y,cab.h+pad*2);
    if(w>2&&h>2) ctx.drawImage(buf,x,y,w,h,x,y,w,h);
    ctx.restore();
  }
  // the 67 floors (-33 .. +33) as a column of dots on the right edge, heaven at the top, the depths below
  function floorBar(){
    if(!(S.barT>0)||!B.on||B.stageId!=='1.3'||typeof W!=='number') return;
    const a=Math.min(1,S.barT/24, 1), N=2*SPAN+1, gap=Math.max(4,Math.min(9,(H*0.72)/(N-1))), h=gap*(N-1);
    const x=W-30, y0=(H-h)/2, v=S.vibe||0, cur=SPAN-v;
    ctx.save(); ctx.globalAlpha=a*0.85;
    ctx.fillStyle='rgba(6,4,10,0.55)'; if(typeof uiRound==='function'){ uiRound(x-12,y0-18,24,h+36,12); ctx.fill(); } else ctx.fillRect(x-12,y0-18,24,h+36);
    for(let i=0;i<N;i++){
      const f=SPAN-i, y=y0+i*gap, up=f>0, k=Math.abs(f)/SPAN;
      const col=f===0?'#ffd36a':up?'rgba('+(200+55*k|0)+','+(200+40*k|0)+','+(190+40*k|0)+','+(0.45+0.4*k)+')':'rgba('+(180+60*k|0)+','+(40-30*k|0)+','+(50-30*k|0)+','+(0.45+0.4*k)+')';
      ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,y,i===cur?0:(f===0||Math.abs(f)===SPAN?2.4:1.6),0,Math.PI*2); ctx.fill();
    }
    const yc=y0+cur*gap, pulse=1+0.25*Math.sin((typeof fr==='number'?fr:0)*0.2);
    ctx.globalAlpha=a; ctx.fillStyle=v>0?'#fff4e0':v<0?'#ff4a4a':'#ffd36a';
    ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=10; ctx.beginPath(); ctx.arc(x,yc,4.5*pulse,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    if(typeof drawTextR==='function'){ const lbl=v===SPAN?'HEAVEN':v===-SPAN?'GORE':(v>0?'+':'')+v; drawTextR(lbl,x-16,yc-6,v>0?'#fff4e0':v<0?'#ff8a8a':'#ffd36a',2); }
    ctx.restore();
  }
  S.floorBar=floorBar;
  function prompt(){
    if(typeof drawTextC!=='function'||typeof W!=='number') return;
    try{ floorBar(); }catch(e){}
    if(S.sealed&&S.cab){
      const fl=LEVELS[floorIndex(S.cab.x, S.cab.y)];
      drawTextC(fl?fl.name:'',W/2,64,'#f4efe6',2);
      if(S.cab.phase!=='go'){
        drawTextC('UP',W/2,96,'#f4efe6',2);
        drawTextC('DOWN',W/2,124,'#ffb0a8',2);
      }
    }else if(S.hold){
      const fl=LEVELS[floorIndex(S.hold.x, S.hold.y)];
      drawTextC(fl?fl.name:'',W/2,64,'#f4efe6',2);
      drawTextC('UP',W/2,96,'#f4efe6',2);
      drawTextC('DOWN',W/2,124,'#ffb0a8',2);
    }else if(S.near){
      const y=typeof uiActLabel==='function'?uiActLabel('punch'):'Y';
      drawTextC(y+'   CALL THE CAR',W/2,64,'#f4efe6',2);
    }
  }
  function hookHud(){
    const prev=window.drawHUD;
    if(typeof prev!=='function'){ setTimeout(hookHud,40); return; }
    if(prev._mvLift) return;
    const wrapped=function(){
      try{ veil(); }catch(e){}
      const r=prev.apply(this,arguments);
      try{ prompt(); }catch(e){}
      return r;
    };
    wrapped._mvLift=true;
    window.drawHUD=wrapped;
  }
  hookHud();
})();
