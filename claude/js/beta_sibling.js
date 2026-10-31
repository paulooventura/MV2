// ============================================================
//  beta_sibling.js — the sibling who shadows you (Paulo, Oct 22)
//
//  "we should be able to choose if we wanna go solo, or have our sibling
//   shadowing us, and assisting. The AI on the support character has to be
//   really clever, and non invasive."
//
//  Chosen on the character select (SOLO / SIBLING SHADOWS YOU, ↑↓ there).
//  How the sibling behaves:
//   · It walks YOUR path, a beat behind (a trail of where you've been — so it
//     never gets stuck, never needs its own pathfinding, and goes wherever you
//     went: ledges, water, ropes). When you stop it stops a little behind you,
//     never in front, never on top of you. It's a ghost to everything: it
//     doesn't push you, block enemies, move blocks, take seeds, crystals,
//     crates or items, open arches or trip anything.
//   · Lost (a respawn, a stage change, 6 s stuck) it re-enters OFF-SCREEN on
//     your trail and rides in; never a blink next to you (Paulo, Oct 25).
//   · It watches for trouble: the enemy that is coming for YOU (closest to you,
//     heading your way, in clear line of sight) — its eye follows it, and it
//     fires bolts from its jack at it. Assist, not steal: a bolt never takes an
//     enemy's last bit of power unless that enemy is right on top of you or
//     you're hurting (HP under 40%) — then it finishes it. It never fires
//     through rock, never across you, and slows down when nothing's urgent.
//   · Can't be hurt (enemies pass through it); it never costs you anything.
//  Oct 22 (later): it RESONATES with you — when you start breaking blocks it
//  joins in on the block you're working on — and it is always proactive about
//  threats: any enemy near you gets attacked at full strength, and it moves to
//  your side facing the danger (when there's floor there) to cover you.
//  Oct 26 (T124): its own brain. Close by it picks its OWN spot near you (in the scene, one it can
//  walk to, covering your side that faces danger, out of your line of fire, looking around when
//  you idle) instead of copying your trail. It reads what you're doing: punching a block (it
//  walks up to the same wall and punches it with you — the basement omniblock wall), fighting an
//  enemy (it goes for that one first) or pulling with the MAG (it stands clear and holds its MAG
//  on the same load); a "!" pops over its head the moment it clocks it. Enemies right by it get
//  punched; enemies near it, not just near you, get shot.
//  SOLO: the other sibling stays home — it potters around the house like Laitu
//  does in hers (walks the floor it's on, stops, looks at you when you're near).
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B) return;
  const KEY='mv2.sibling';
  const read=()=>{ try{ const v=localStorage.getItem(KEY); return v==null?true:v==='1'; }catch(e){ return true; } };
  let on=read();
  const stats={reenter:0, zip:0, hoverF:0, hoverMax:0, jumps:0, swaps:0, clocks:0, punches:0, spots:0};
  let ff=(()=>{ try{ return localStorage.getItem(KEY+'.ff')==='1'; }catch(e){ return false; } })();
  window.MV_SIBLING={ get on(){ return on; }, set on(v){ on=!!v; try{ localStorage.setItem(KEY,on?'1':'0'); }catch(e){} }, toggle(){ this.on=!on; },
    get ff(){ return true; }, set ff(v){ ff=true; try{ localStorage.setItem(KEY+'.ff','1'); }catch(e){} },   // a hit on your brother always counts
    state:()=>S, npc:()=>npc&&npc.s, stats, trail:()=>trail, probe:()=>({floorStep, walkable, inView, standOk, deadly}) };
  B.platRiders=()=>{ const o=[]; if(S) o.push(S); if(npc&&npc.s) o.push(npc.s); return o; };
  const labOk=()=>!window.MV_BETA_LAB||/[?&]sib=1/.test(location.search);
  const KEEP=900, MIN_GAP=62, LOST=560;
  const PERSONAL=72;   // Paulo (Oct 31): the brother must not crowd the lead: it keeps at least this far to the side when you're on the same level
  const NEAR_IN=110, NEAR_OUT=230, HOVER_MAX=90, LOST_T=360, FAR=1400, UP_MAX=15.5;
  const BANG_T=60, PUNCH_CD=24, PUNCH_R=84, PUNCH_R_WALL=100, ACT_HOLD={block:240, fight:180, pull:24};
  let S=null, trail=[], bolts=[], lastLevel=null, lastHero=null;

  function active2(){ return B.on&&B.level&&typeof p!=='undefined'&&p&&_gameState==='game'&&!B.trans&&!B.results; }
  function active(){ return on&&labOk()&&B.on&&B.level&&typeof p!=='undefined'&&p&&_gameState==='game'&&!B.trans&&!B.results&&!(typeof _paused!=='undefined'&&_paused); }
  function spawn(){
    S=mkP(); S._aiCompanion=true; S._betaSib=true;
    S.hero=p.hero==='venture'?'mind':'venture';
    S.x=p.x-(p.fc?1:-1)*MIN_GAP; S.y=p.y; S.fc=p.fc; S.og=true; S.hp=S.maxHp;
    S._shotCd=40; S._sideT=0; S._fcT=0; S._stuck=0; S._fly=false; S._side=null; S.vx=0; S.vy=0; trail.length=0; bolts.length=0; S._blink=0;
    S._pref=96+Math.random()*50; S._act=null; S._spot=null; S._bang=0; S._punchCd=0;
    lastLevel=B.level; lastHero=p.hero;
    record(); reenter();
  }
  const centre=pl=>({x:pl.x+SW/2, y:pl.y+FEET_OFF-STAND_H*0.45});
  function clearLine(x0,y0,x1,y1){
    const n=Math.ceil(Math.hypot(x1-x0,y1-y0)/14);
    for(let i=1;i<n;i++){ const t=i/n; if(typeof gridWorldSolid==='function'&&gridWorldSolid(x0+(x1-x0)*t,y0+(y1-y0)*t)) return false; }
    return true;
  }
  // the enemy that matters to YOU: alive, visible, nearest you (and closing in counts double);
  // the one you're fighting comes first; one right by it (not near you) still gets dealt with
  function pickThreat(){
    const P=centre(p), me=centre(S); let best=null, bs=1e9;
    const yours=S._act&&S._act.kind==='fight'?S._act.tgt:null;
    for(const e of (typeof ENEMS!=='undefined'?ENEMS:[])){
      if(!e||!e.alive||e._hidden||e._betaHeld||e._spawnFx>0) continue;
      const ex=e.x+(e.w||0)/2, ey=e.y+(e.h||0)/2, dP=Math.hypot(ex-P.x,ey-P.y), dS=Math.hypot(ex-me.x,ey-me.y);
      if(dP>360&&dS>220&&e!==yours) continue;
      const closing=((P.x-ex)*(e.vx||0)+(P.y-ey)*(e.vy||0))>0;
      let score=dP>360?dS+260:dP*(closing?0.6:1);
      if(e===yours) score*=0.4;
      if(score<bs&&clearLine(me.x,me.y-6,ex,ey)){ bs=score; best={e,ex,ey,dP,dS}; }
    }
    return best;
  }
  // ── its own RCA rope (Paulo, Oct 25): the same rope as yours — the game's own updateHook runs
  //    on its body with AI hands on the stick — but its own anchor and its own call. You being on
  //    a rope is never a reason for it to rope; it throws one when it needs to cross or climb.
  const ROPE_CD=45, ROPE_MAX_T=300;
  function ropeIdle(b){
    const h=b&&b.hook; if(!h) return;
    if(h.st!=='idle'){ h.st='idle'; h.ox=NaN; h.oy=NaN; h.tgt=null; h.plat=null; h._tight=false; h._slack=false; h._path=null; h._tension=0; h.pivots=null; h.vr=null; h._cord=null; }
    b._ropeT=0;
  }
  function asSib(inp,fn){
    const k={it:ITEM,L:isLf,R:isRt,U:isUp,D:isDn,J:isJumpJ};
    ITEM=1; isLf=()=>!!inp.l; isRt=()=>!!inp.r; isUp=()=>!!inp.u; isDn=()=>!!inp.d; isJumpJ=()=>false;
    try{ return withPlayerContext(S,fn); }
    finally{ ITEM=k.it; isLf=k.L; isRt=k.R; isUp=k.U; isDn=k.D; isJumpJ=k.J; }
  }
  const ropeGoal=()=>({x:p.x+SW/2+S._side*70, y:p.y+FEET_OFF-STAND_H*0.45});
  // a surface above it, on the way to where it's going (ceilings and walls; never the floor)
  function findAnchor(G){
    if(typeof _hookRayHit!=='function') return null;
    const c=centre(S), dir=Math.sign(G.x-c.x)||(S.fc?1:-1), reach=Math.min(typeof CMAX!=='undefined'?CMAX:400,400)*0.9;
    const mid=c.x+(G.x-c.x)*0.55;
    let best=null, bs=-1e9;
    for(const t of [0.15,0.3,0.45,0.6,0.75,0.9,1.05]){
      const ux=Math.sin(t)*dir, uy=-Math.cos(t);
      const hit=_hookRayHit(c.x,c.y-10,c.x+ux*reach,c.y-10+uy*reach);
      if(!hit||hit.enemy) continue;
      const len=Math.hypot(hit.tx-c.x,hit.ty-c.y);
      if(len<90||hit.ty>c.y-70) continue;
      const s=-Math.abs(hit.tx-mid)-Math.abs(len-230)*0.4+(hit.ty<G.y?40:0);
      if(s>bs){ bs=s; best={x:hit.tx,y:hit.ty}; }
    }
    return best;
  }
  function throwRope(A){
    const c=centre(S), dx=A.x-c.x, dy=A.y-c.y, d=Math.hypot(dx,dy)||1;
    S.aimDX=S.tAimDX=dx/d; S.aimDY=S.tAimDY=dy/d; S.fc=dx>0;
    asSib({},()=>fireItem(false));
    S._ropeT=0;
  }
  function ropeTick(){
    const h=S.hook, was=h.st; S._ropeT=(S._ropeT||0)+1;
    const G=ropeGoal(), c=centre(S), dir=Math.sign(G.x-c.x)||1, inp={};
    if(h.st==='on'){
      const P0=h.pivots&&h.pivots.length?h.pivots[h.pivots.length-1]:{x:h.ax,y:h.ay};
      const behind=(c.x-P0.x)*dir<8, sp=Math.hypot(S.vx,S.vy);
      if(Math.abs(G.x-c.x)>40&&behind&&sp<8.5&&(S.vx*dir>0||Math.abs(S.vx)<0.6)) inp[dir>0?'r':'l']=true;   // pump on the downswing toward the goal, like you would
      if(G.y<c.y-40&&h.rl>ROPE_RL_MIN+30) inp.u=true;                                        // climb toward it
      else if(G.y>c.y+90&&h.rl<CMAX-20) inp.d=true;
    }
    const x0=S.x;
    asSib(inp,()=>updateHook());
    if(h.st==='idle'){ if(was==='ext') S._ropeMiss=(S._ropeMiss||0)+1; S._ropeCd=ROPE_CD; S._launchT=40; return; }
    if(h.st!=='on') return;
    S._ropeMiss=0;
    S.wheelAngle=(S.wheelAngle||0)+(S.x-x0)/WHEEL_R;
    const P=h.pivots&&h.pivots.length?h.pivots[h.pivots.length-1]:{x:h.ax,y:h.ay};
    const c2=centre(S), past=(c2.x-P.x)*dir>12, rising=S.vy<-0.5, toward=S.vx*dir>2.2;
    const there=Math.hypot(G.x-c2.x,G.y-c2.y)<110;
    if((S._ropeT>24&&past&&rising&&toward)||there||S._ropeT>ROPE_MAX_T){
      if(typeof _detachPlayerRope==='function') _detachPlayerRope(h); else ropeIdle(S);
      S._ropeCd=ROPE_CD; S._launchT=50; S._ropeT=0;
    }
  }
  // ── where it can stand, what it can see, where it can't go ──
  const solidAt=(x,y)=>typeof gridWorldSolid==='function'&&gridWorldSolid(x,y);
  function record(){
    // where YOU have been (only when you move, so standing still parks the sibling)
    const last=trail[trail.length-1];
    if(!last||Math.hypot(p.x-last.x,p.y-last.y)>1.2) trail.push({x:p.x,y:p.y,og:!!p.og,rope:!!(p.hook&&p.hook.st==='on')});
    if(trail.length>KEEP){ const n=trail.length-KEEP; trail.splice(0,n); if(S&&S._ti!=null) S._ti-=n; }
  }
  function view(){
    const vw=typeof camViewW==='function'?camViewW():W, vh=typeof camViewH==='function'?camViewH():H;
    const cx=typeof camX==='number'?camX:0, cy=typeof camY==='number'?camY:0;
    return {x0:cx, y0:cy, x1:cx+vw, y1:cy+vh};
  }
  // off the camera as it is AND as it will be once it has caught up with you (a respawn or a
  // stage change moves you before the camera follows)
  function offScreen(x,y,m){
    const v=view(), w=v.x1-v.x0, h=v.y1-v.y0, px=p.x+SW/2-w/2, py=p.y+FEET_OFF-h*0.6; m=m||0;
    const out=(a0,b0)=>x+SW<a0-m||x>a0+w+m||y+FEET_OFF<b0-m||y+FEET_OFF-130>b0+h+m;
    return out(v.x0,v.y0)&&out(px,py);
  }
  function deadly(x,y){
    const cx=x+SW/2, f=y+FEET_OFF;
    if(typeof WH==='number'&&f>WH-40) return true;                      // the bottom of the world
    return !!(B.elecAt&&B.elecAt(cx,f-20));                             // live water
  }
  function standOk(x,y){ const cx=x+SW/2, f=y+FEET_OFF; return solidAt(cx,f+6)&&!solidAt(cx,f-30)&&!solidAt(cx,f-60)&&!deadly(x,y); }
  // the floor in this column nearest a feet height (null if there's none to stand on)
  function groundNear(x,feet){
    const cx=x+SW/2; let best=null, bd=1e9;
    for(let yy=feet-200;yy<=feet+300;yy+=8){
      if(!solidAt(cx,yy)||solidAt(cx,yy-8)||solidAt(cx,yy-40)||solidAt(cx,yy-70)) continue;
      if(deadly(x,yy-FEET_OFF)) continue;
      const d=Math.abs(yy-feet); if(d<bd){ bd=d; best=yy; }
    }
    return best;
  }
  // ── lost: it comes back from OFF-SCREEN (Paulo, Oct 25: "sometimes it just spawns next to the
  //    player out of the blue"). The newest spot on your trail the camera can't see, on solid
  //    ground; else floor just past the screen edge behind you; else a quick zip in from the edge.
  function reenter(){
    S._spot=null; if(S._act) S._act.spot=null;
    ropeIdle(S); S.vx=S.vy=S._hvx=S._hvy=0; S._fly=false; S._flying=false; S._plan=null; S._stuck=0; S._noProg=0; S._best=null; S._launchT=0; S._zip=null; S._trailMode=false;
    const back=p.fc?-1:1, v=view();
    for(const behindOnly of [true,false]) for(let i=trail.length-1;i>=0;i--){
      const c=trail[i]; if(!c.og||c.rope) continue;
      if(behindOnly&&(c.x-p.x)*back<0) continue;
      if(!offScreen(c.x,c.y,40)||!standOk(c.x,c.y)) continue;
      S.x=c.x; S.y=c.y; S.og=true; S._ti=i; S._trailMode=true; stats.reenter++; return;
    }
    if(!(S._scanFail>0)) for(let k=0;k<30;k++){
      const x=back<0?v.x0-48-SW-k*16:v.x1+48+k*16, fy=groundNear(x,p.y+FEET_OFF);
      if(fy==null) continue;
      S.x=x; S.y=fy-FEET_OFF; S.og=true; S._ti=null; S._scanFail=1; stats.reenter++; return;
    }
    let tx=p.x+back*70, fy=groundNear(tx,p.y+FEET_OFF);
    if(fy==null){ tx=p.x; fy=p.y+FEET_OFF; }
    const x0=back<0?v.x0-SW:v.x1;
    S._zip={x0, y0:fy-FEET_OFF-40, x1:tx, y1:fy-FEET_OFF, t:0, n:18};
    S.x=x0; S.y=S._zip.y0; S._ti=null; S._scanFail=0; stats.zip++;
    try{ sfx('swap',1.6); }catch(e){}
  }
  function zipTick(){
    const z=S._zip; z.t++;
    const k=Math.min(1,z.t/z.n), e=1-Math.pow(1-k,3), x0=S.x;
    S.x=z.x0+(z.x1-z.x0)*e; S.y=z.y0+(z.y1-z.y0)*e; S.vx=S.x-x0; S.vy=0; S.og=false;
    if(Math.abs(S.vx)>0.5) S.fc=S.vx>0;
    const col=S.hero==='venture'?'#ff6a7a':'#c49aff';
    for(let q=0;q<3;q++) PFXS.push({x:S.x+SW/2-S.vx*q*0.5,y:S.y+FEET_OFF-20-Math.random()*60,vx:-S.vx*0.3,vy:0,life:10,maxLife:10,r:2,col});
    S.wheelAngle=(S.wheelAngle||0)+S.vx/WHEEL_R;
    if(k>=1){ S._zip=null; S.vx*=0.2; }
  }
  // ── the XLR hover: a last resort (you're on a rope, or the trail needs a move it can't make),
  //    1.5 s at most, toward a spot on your trail, never parked next to you; then it falls ──
  function startHover(T){
    if(S._flyCd>0||!T) return false;
    const A=!(S._ropeCd>0)&&(S._ropeMiss||0)<2?findAnchor(ropeGoal()):null;   // its own rope first, when there's something to latch on its way
    if(A){ throwRope(A); S._stuck=0; return true; }
    S._fly=true; S._flyT=0; S._flyTo={x:T.x,y:T.y}; S._hvx=S.vx||0; S._hvy=Math.min(0,S.vy||0); S._plan=null; S._stuck=0;
    return true;
  }
  function hoverTick(){
    const x0=S.x, y0=S.y, T=S._flyTo, tx=T.x, ty=T.y-24;
    S._flyT++; stats.hoverF++; if(S._flyT>stats.hoverMax) stats.hoverMax=S._flyT;
    const cap=Math.max(7,Math.hypot(p.vx||0,p.vy||0)+3);
    S._hvx=S._hvx*0.86+(tx-S.x)*0.02; S._hvy=S._hvy*0.86+(ty-S.y)*0.02;
    const sp=Math.hypot(S._hvx,S._hvy); if(sp>cap){ S._hvx*=cap/sp; S._hvy*=cap/sp; }
    if(typeof _movePlayerWithColl==='function') _movePlayerWithColl(S,S._hvx,S._hvy); else { S.x+=S._hvx; S.y+=S._hvy; }
    S.og=false; S.vx=S.x-x0; S.vy=S.y-y0;
    S._flying=true;
    S.fc=Math.abs(S.vx)>1.2?S.vx>0:p.fc;
    S.wheelAngle=(S.wheelAngle||0)+0.12*(S.fc?1:-1);
    if(!(S._shootT>0)&&!S._threat){ S.aimDX+=(S.vx*0.04-S.aimDX)*0.12; S.aimDY+=(1-S.aimDY)*0.12; }   // the jack points down: the XLR holds it up
    if(fr%5===0){ const tp=tipOf(S); PFXS.push({x:tp.x+(Math.random()-0.5)*4,y:tp.y+4,vx:(Math.random()-0.5)*0.8-S.vx*0.2,vy:1.6+Math.random(),life:12,maxLife:12,r:2,col:'#aaddff'}); }
    if(Math.hypot(tx-S.x,ty-S.y)<28||S._flyT>=HOVER_MAX){ S._fly=false; S._flying=false; S._flyCd=90; S.vx*=0.6; S.vy=Math.max(0,S.vy); S._ti=null; }
  }
  // ── following your path: the trail point it's on, and what's next on it ──
  function trackTrail(){
    if(!trail.length) return;
    if(S._ti==null||S._ti<0||S._ti>=trail.length){
      let b=trail.length-1, bd=1e9;                                  // your latest pass by here, if your path doubled back
      for(let i=trail.length-1;i>=0;i--){ const d=Math.hypot(trail[i].x-S.x,(trail[i].y-S.y)*1.5); if(d<bd-8){ bd=d; b=i; } }
      S._ti=b; return;
    }
    const i0=S._ti, lim=Math.min(trail.length-1,i0+40);
    let b=i0, bd=Math.hypot(trail[i0].x-S.x,(trail[i0].y-S.y)*1.5);
    for(let j=i0+1;j<=lim;j++){ const d=Math.hypot(trail[j].x-S.x,(trail[j].y-S.y)*1.5); if(d<=bd){ b=j; bd=d; } }
    S._ti=b;
  }
  // the jump that takes it from where it stands to where you came down: real gravity, real arc
  function planJump(k0,m){
    const L=trail[m]; let top=trail[k0].y, rope=false;
    for(let j=k0;j<=m;j++){ if(trail[j].y<top) top=trail[j].y; if(trail[j].rope) rope=true; }
    const failed=S._failL&&Math.hypot(S._failL.x-L.x,S._failL.y-L.y)<40&&S._failL.n>=2;
    const rise=S.y-top, dy=L.y-S.y;
    let up=rise>4?Math.sqrt(2*GRAV*(rise+12)):0;
    if(dy<0) up=Math.max(up,Math.sqrt(2*GRAV*(-dy+16)));
    const t=Math.max(1,(up+Math.sqrt(Math.max(0,up*up+2*GRAV*dy)))/GRAV), vx=(L.x-S.x)/t;
    if(rope||failed||up>UP_MAX||Math.abs(vx)>MOVE_RUN) return {L, can:false};
    return {L, can:true, up, vx, n:Math.ceil(t)+40};
  }
  function follow(){
    const last=trail[trail.length-1], tele=last&&Math.hypot(p.x-last.x,p.y-last.y)>LOST;
    if(B.level!==lastLevel||tele){ trail.length=0; lastLevel=B.level; record(); reenter(); return; }   // a stage change or a respawn
    record();
    if(S._flyCd>0) S._flyCd--;
    if(S._zip){ zipTick(); return; }
    if(S._ropeCd>0) S._ropeCd--;
    if(S.hook&&S.hook.st!=='idle'){ ropeTick(); if(S.hook.st==='on'){ S._flying=false; S._fly=false; S._stuck=0; return; } }
    if(S._fly){ hoverTick(); return; }
    const spot=pickSpot(), work=!!spot.work;
    // Paulo (Oct 22, build 264): "more serene, grounded, less glitchy". Close by it eases up to a
    // spot of its own choosing (Oct 26) and stops; further off it rides your trail (Oct 25), jumping where you jumped.
    // The side it keeps changes only after you've faced the other way for a while.
    const solid=solidAt;
    const want=p.fc?-1:1;
    if(S._side==null) S._side=want;
    if(want!==S._side){ if(++S._sideT>50){ S._side=want; S._sideT=0; } } else S._sideT=0;
    const dxP=p.x-S.x, dyP=p.y-S.y, dist=Math.hypot(dxP,dyP);           // dyP < 0: you're above it
    const pm=B.ridePlat;                                              // you're on a moving platform: its spot is on it too
    // really stuck (6 s far off and not getting closer), or far beyond the screen: back in from off-screen
    const youMoving=!p.og||(p.hook&&p.hook.st!=='idle');
    if(dist>200&&!S._waiting&&!youMoving){ if(S._best==null||dist<S._best-40){ S._best=dist; S._noProg=0; } else S._noProg=(S._noProg||0)+1; }
    else if(dist<=200){ S._best=null; S._noProg=0; S._scanFail=0; }
    if((S._noProg||0)>LOST_T||(S._stuck||0)>LOST_T||(dist>FAR&&offScreen(S.x,S.y,0))){ reenter(); return; }
    const toSpot=Math.hypot(spot.x-S.x,spot.y-S.y);
    if(S._trailMode){ if((dist<NEAR_IN&&Math.abs(dyP)<60)||(toSpot<60&&dist<NEAR_OUT)||pm||trail.length<4) S._trailMode=false; }
    else if(trail.length>=4&&!pm&&(dist>(work?320:NEAR_OUT)||(dyP<-100&&Math.abs(spot.y-S.y)>60))){ S._trailMode=true; S._ti=null; }
    S._waiting=false;
    const x0=S.x;
    let tx, maxV, plan=S._plan;
    if(plan&&S.og&&plan.t>2){                                         // came down: did it land where you did?
      if(Math.hypot(S.x-plan.L.x,S.y-plan.L.y)>70){
        if(S._failL&&Math.hypot(S._failL.x-plan.L.x,S._failL.y-plan.L.y)<40) S._failL.n++; else S._failL={x:plan.L.x,y:plan.L.y,n:1};
      }
      S._plan=plan=null;
    }
    if(plan){ plan.t++; if(plan.t>plan.n) S._plan=plan=null; }
    if(S._trailMode&&trail.length){
      trackTrail();
      const ti=S._ti;
      let T=trail[ti], len=0, k0=-1;
      for(let j=ti+1;j<trail.length;j++){
        const a=trail[j-1], c=trail[j];
        if(a.og&&!c.og){ k0=j-1; break; }                             // you left the ground here
        len+=Math.hypot(c.x-a.x,c.y-a.y); T=c; if(len>56) break;
      }
      tx=T.x;
      if(deadly(T.x,T.y)){ tx=S.x; S._waiting=true; }                // live water / a pit ahead: wait at the edge
      if(k0>=0&&!plan){
        const K=trail[k0];
        let m=-1; for(let j=k0+1;j<trail.length;j++) if(trail[j].og){ m=j; break; }
        tx=K.x;
        if(m<0) S._waiting=true;                                      // you haven't come down yet
        else if(deadly(trail[m].x,trail[m].y)) S._waiting=true;
        else if(S.og&&Math.abs(K.x-S.x)<24){                          // wider than the 16 px it stops within
          const J=planJump(k0,m);
          if(J.can){ S.vy=-J.up; S.og=false; S._plan=plan={L:J.L, vx:J.vx, t:0, n:J.n}; S._ti=m; stats.jumps++; }
          else if(!startHover(J.L)) S._waiting=true;
          if(S._fly){ hoverTick(); return; }
        }
      }
      maxV=Math.min(MOVE_RUN,Math.max(4.5,Math.abs(p.vx||0)+1.8));    // a touch faster than you, to catch up
    }else{
      tx=spot.x;
      if(spot.fb&&(solid(tx+SW/2,p.y+FEET_OFF-30)||solid(tx+SW/2,p.y+FEET_OFF-60))) tx=p.x+S._side*PERSONAL;   // a wall there: tuck in, but not on top of you
      if(pm){ tx=p.x+S._side*70; const lo=pm.x-SW/2+6, hi=pm.x+pm.w-SW/2-6; tx=Math.max(lo,Math.min(hi,tx)); if(Math.abs(tx-p.x)<40) tx=p.x+(tx>=p.x?40:-40); tx=Math.max(lo,Math.min(hi,tx)); }
      if(!pm&&!work&&Math.abs(dyP)<56&&Math.abs(tx-p.x)<PERSONAL){ tx=p.x+(Math.abs(S.x-p.x)>8?Math.sign(S.x-p.x):S._side)*PERSONAL; }   // personal space: never settle on top of you
      maxV=Math.max(work||S._threat?4.2:3,Math.abs(p.vx||0)+1.2);
    }
    S._flying=false;
    const dx=tx-S.x, adx=Math.abs(dx), dead=work&&!S._trailMode?5:16, dir=Math.sign(dx);
    if(S._launchT>0&&S.og) S._launchT=0;
    if(plan&&!S.og){ S.vx+=(plan.vx-S.vx)*0.5; }                     // in its jump: steer along the arc it planned
    else if(S._launchT>0){ S._launchT--; S.vx*=0.995; }             // just let go of its rope: the swing carries it until it lands
    else if(adx>dead){
      S.vx=(S.vx||0)+dir*Math.min(0.42,0.1+adx/260);
      const vStop=Math.sqrt(2*0.32*(adx-dead))+0.4;                   // brake in time: eases to a stop on its mark
      if(Math.sign(S.vx)===dir&&Math.abs(S.vx)>vStop) S.vx=dir*vStop;
      if(Math.sign(S.vx)!==dir) S.vx*=0.8;
    }else S.vx=(S.vx||0)*(S.og?0.75:0.97);
    if(!(S._launchT>0)&&!(plan&&!S.og)) S.vx=Math.max(-maxV-(S.og?0:1.5),Math.min(maxV+(S.og?0:1.5),S.vx));
    const feet=S.y+FEET_OFF;
    if(S.og&&!S._plan){
      const ax=S.x+SW/2+dir*(SW/2+10);
      const wall=adx>dead&&(solid(ax,feet-24)||solid(ax,feet-52));
      let ledge=false, gap=false, ontoPlat=false;
      if(!S._trailMode){                                               // on the trail, your own jumps are the plan
        const dyT=spot.fb||pm?dyP:spot.y-S.y;                          // up to its spot (or to you)
        ledge=dyT<-40&&Math.abs(tx-S.x)<150&&(p.og||work);              // its spot is up a step: hop up
        // a gap ahead (no floor under the next stretch) with somewhere to land at about this height: leap it
        if(adx>40&&Math.abs(S.vx)>1.2){ const fx=S.x+SW/2+dir*(SW/2+18); let floorAhead=false; for(let yy=feet+4;yy<feet+90;yy+=12) if(solid(fx,yy)){ floorAhead=true; break; }
          if(!floorAhead&&dyT<40&&!deadly(S.x+dir*120,S.y+60)) gap=true; }
        ontoPlat=pm&&S._ridePlat!==pm&&dyP<-20&&Math.abs(dxP)<170;      // hop onto the platform you're riding
      }
      if(wall||ledge||gap||ontoPlat){ S.vy=-10.8; S.og=false; if(gap||ontoPlat) S.vx=dir*Math.max(Math.abs(S.vx),3.2); }
    }
    S.vy=Math.min((S.vy||0)+GRAV,13);
    if(typeof _movePlayerWithColl==='function') _movePlayerWithColl(S,S.vx,S.vy); else { S.x+=S.vx; S.y+=S.vy; }
    if(S.og&&S.vy>0) S.vy=0;
    const moved=S.x-x0;
    if(adx>60&&Math.abs(moved)<0.25&&!S._waiting) S._stuck=(S._stuck||0)+1; else S._stuck=Math.max(0,(S._stuck||0)-2);
    if(S._stuck===40){                                                 // walled in for 2/3 s: your trail if there is one, a short hover if not
      if(!S._trailMode){ S._spot=null; if(S._act){ S._act.badSpot=fr; S._act.spot=null; } }   // that spot can't be reached from here: pick another
      if(!S._trailMode&&trail.length>=4){ S._trailMode=true; S._ti=null; }
      else{ const ahead=S._trailMode&&S._ti!=null?trail[Math.min(trail.length-1,S._ti+60)]:{x:p.x+S._side*70,y:p.y}; startHover(ahead); }
    }
    S.crouchAmt=(S.crouchAmt||0)+((S._trailMode?(p.crouchAmt||0):0)-(S.crouchAmt||0))*0.2;   // ducks through your tunnels; never mimics a duck otherwise
    S.wheelAngle=(S.wheelAngle||0)+moved/WHEEL_R;
    // facing: with its motion when it's really moving, otherwise toward what it's busy with, else you
    const look=lookAt();
    const wantFc=Math.abs(S.vx)>0.9?S.vx>0:(look?look.x>S.x+SW/2:p.fc);
    if(wantFc!==S.fc){ if(++S._fcT>8){ S.fc=wantFc; S._fcT=0; } } else S._fcT=0;
  }
  function assist(){
    if(S.hook&&S.hook.st!=='idle'){ S._threat=null; return; }   // both hands on its rope
    const t=pickThreat(), me=centre(S); S._threat=t; S._magShow=false;
    S._shotCd=(S._shotCd||0)-1;
    if(!t){
      if(joinAct()) return;
      if(!(S.pt>0)){ S.aimDX+=((S.fc?1:-1)-S.aimDX)*0.2; S.aimDY*=0.8; }
      S.pupilX=(S.pupilX||0)*0.8; S.pupilY=(S.pupilY||0)*0.8; return;
    }
    const dx=t.ex-me.x, dy=t.ey-me.y, d=Math.hypot(dx,dy)||1;
    if(!(S.pt>0)){ S.aimDX+=(dx/d-S.aimDX)*0.35; S.aimDY+=(dy/d-S.aimDY)*0.35; }
    if(Math.abs(dx)>6) S.fc=dx>0;
    if(S._fly||S._zip) return;                                   // it fights from the ground or mid-jump, never from a hover
    // right by it: a punch, like you would
    if(S.og&&!(S._punchCd>0)&&Math.abs(dx)<PUNCH_R&&Math.abs(dy)<64&&(typeof _punchReach!=='function'||_punchReach(me.x,me.y,t.ex,t.ey,{x:t.e.x,y:t.e.y,w:t.e.w||0,h:t.e.h||0}))){
      sibPunch(t.ex,t.ey,(fx,fy)=>{ sibEnemyHitFr=fr; if(typeof _damageEnemy==='function') _damageEnemy(t.e,typeof ENM_DMG!=='undefined'?ENM_DMG.punch:15,fx,fy,1); try{ sfx('punch_hit',1.15); }catch(e){} });
      return;
    }
    if(S._carry!=null&&window.MV_SIB_JACK&&MV_SIB_JACK.use(S,t)) return;   // a jack it took from you: it uses that, not its bolts (beta_knife)
    if(S._shotCd>0) return;
    // never across you: skip the shot if you're between it and the target
    const P=centre(p), seg=((P.x-me.x)*dx+(P.y-me.y)*dy)/(d*d);
    if(seg>0&&seg<1&&Math.hypot(me.x+dx*seg-P.x,me.y+dy*seg-P.y)<26){ S._shotCd=8; return; }
    const urgent=t.dP<140||(p.hp||0)<(p.maxHp||100)*0.5;
    S._shotCd=urgent?14:24;
    const sp=11, tp=tipOf(S); if(!clearLine(me.x,me.y-6,tp.x,tp.y)){ S._shotCd=8; return; }   // the jack's tip is past a wall: no shot
    S._shootT=40;
    bolts.push({x:tp.x,y:tp.y,vx:dx/d*sp,vy:dy/d*sp,e:t.e,life:50,urgent});
    for(let k=0;k<5;k++) PFXS.push({x:tp.x,y:tp.y,vx:dx/d*2+(Math.random()-0.5)*2,vy:dy/d*2+(Math.random()-0.5)*2,life:8,maxLife:8,r:1.8,col:S.hero==='venture'?'#ffb0b8':'#e0c8ff'});   // the muzzle flash at its jack
    S.fireRecoil=5; S.fireRecoilA=Math.atan2(dy,dx);
    try{ sfx('laser',S.hero==='venture'?1.25:1.4); }catch(e){}
  }
  function boltsTick(){
    for(let i=bolts.length-1;i>=0;i--){
      const b=bolts[i]; b.life--;
      const e=b.e;
      if(e&&e.alive){ const ex=e.x+(e.w||0)/2, ey=e.y+(e.h||0)/2, d=Math.hypot(ex-b.x,ey-b.y)||1; b.vx+=((ex-b.x)/d*10-b.vx)*0.12; b.vy+=((ey-b.y)/d*10-b.vy)*0.12; }   // a gentle homing
      const hitRock=(x,y)=>{ if(typeof gridWorldSolid!=='function'||!gridWorldSolid(x,y)) return false; const w=b.bw; return !(w&&x>=w.x-2&&x<=w.x+(w.w||32)+2&&y>=w.y-2&&y<=w.y+(w.h||32)+2); };
      if(hitRock(b.x+b.vx*0.5,b.y+b.vy*0.5)){ b.x+=b.vx*0.5; b.y+=b.vy*0.5; fizz(b); bolts.splice(i,1); continue; }   // never through a wall (Paulo, Oct 22)
      b.x+=b.vx; b.y+=b.vy;
      if(b.bw){
        const w=b.bw; if(w.hp>0&&b.x>=w.x-2&&b.x<=w.x+(w.w||32)+2&&b.y>=w.y-2&&b.y<=w.y+(w.h||32)+2){
          sibHitFr=fr; if(typeof _damageBwall==='function') _damageBwall(w,'punch',{shakeX:Math.sign(b.vx)*2,shakeY:Math.sign(b.vy)*2}); fizz(b,true); bolts.splice(i,1); continue; }
        const cx=w.x+(w.w||32)/2, cy=w.y+(w.h||32)/2, d=Math.hypot(cx-b.x,cy-b.y)||1; b.vx+=((cx-b.x)/d*11-b.vx)*0.2; b.vy+=((cy-b.y)/d*11-b.vy)*0.2;
      }
      if(b.life<=0||hitRock(b.x,b.y)){ fizz(b); bolts.splice(i,1); continue; }
      for(const en of (typeof ENEMS!=='undefined'?ENEMS:[])){
        if(!en||!en.alive||en._hidden) continue;
        if(b.x>=en.x&&b.x<=en.x+(en.w||0)&&b.y>=en.y&&b.y<=en.y+(en.h||0)){
          const dmg=b.urgent?12:9;                                       // always for real: it protects you
          sibEnemyHitFr=fr; if(typeof _damageEnemy==='function') _damageEnemy(en,dmg,b.x-b.vx*3,b.y-b.vy*3,0.45);
          fizz(b,true); bolts.splice(i,1); break;
        }
      }
    }
  }
  // ── resonance: the block you're breaking ──
  let sibHitFr=-99, blockT=null; const hpSeen=new WeakMap();
  function watchBlocks(){
    const P=centre(p);
    for(const w of (typeof BWALLS!=='undefined'?BWALLS:[])){
      if(!w) continue; const was=hpSeen.get(w); hpSeen.set(w,w.hp);
      if(was==null||w.hp>=was||w.hp<=0||fr-sibHitFr<3) continue;
      if(w.only==='push'||w.only==='pull'||w._carried||w._fly) continue;
      if(Math.hypot(w.x+(w.w||32)/2-P.x,w.y+(w.h||32)/2-P.y)<260) blockT={w,t:fr};   // you just hit it: help
    }
    if(blockT&&(blockT.w.hp<=0||fr-blockT.t>240)) blockT=null;               // broken, or you've moved on
  }
  // a bolt at a block of the wall you're working on, the one it can see (when it can't get to a punching spot)
  function boltBlock(w0){
    if(S._shotCd>0||S._fly||S._zip) return;
    const me=centre(S);
    for(const w of wallOf(w0)){
      const cx=w.x+(w.w||32)/2, cy=w.y+(w.h||32)/2, dx=cx-me.x, dy=cy-me.y, d=Math.hypot(dx,dy)||1; if(d>320) continue;
      let ok=true; const n=Math.ceil(Math.max(0,d-26)/12);
      for(let k=1;k<n&&ok;k++){ const x=me.x+dx/d*k*12, y=me.y-6+dy/d*k*12; if(solidAt(x,y)&&!(x>=w.x&&x<=w.x+(w.w||32)&&y>=w.y&&y<=w.y+(w.h||32))) ok=false; }   // a wall in between: not its shot
      if(!ok) continue;
      const P=centre(p), seg=((P.x-me.x)*dx+(P.y-me.y)*dy)/(d*d);
      if(seg>0&&seg<1&&Math.hypot(me.x+dx*seg-P.x,me.y+dy*seg-P.y)<26) continue;     // never across you
      S.aimDX=dx/d; S.aimDY=dy/d; if(Math.abs(dx)>6) S.fc=dx>0;
      const tp=tipOf(S); if(!clearLine(me.x,me.y-6,tp.x,tp.y)) return;
      S._shootT=40;
      S._shotCd=22; bolts.push({x:tp.x,y:tp.y,vx:dx/d*11,vy:dy/d*11,bw:w,life:45});
      S.fireRecoil=5; try{ sfx('laser',S.hero==='venture'?1.3:1.45); }catch(e){}
      return;
    }
  }

  // ── reading you (T124): what are you doing, and how does it join in ──
  const blockOk=w=>!!(w&&w.hp>0&&w.only!=='laser'&&w.only!=='push'&&w.only!=='pull'&&!w._carried&&!w._fly);   // TRS-only cages are yours; push/pull blocks don't break
  // the breakable blocks of the same wall (within a few tiles of this one), nearest it first
  function wallOf(w0){
    const o=[]; for(const w of (typeof BWALLS!=='undefined'?BWALLS:[])) if(blockOk(w)&&Math.hypot(w.x-w0.x,w.y-w0.y)<=3.5*32) o.push(w);
    return o.sort((a,b)=>Math.hypot(a.x-w0.x,a.y-w0.y)-Math.hypot(b.x-w0.x,b.y-w0.y));
  }
  let sibEnemyHitFr=-99; const hpE=new WeakMap();
  function readAction(){
    const P=centre(p), ax=p.aimDX||(p.fc?1:-1), ay=p.aimDY||0, al=Math.hypot(ax,ay)||1;
    const punching=!!(p.pCharging||p.pt>0);
    const inAim=(x,y,R,cone)=>{ const dx=x-P.x, dy=y-P.y, d=Math.hypot(dx,dy)||1; return d<=R&&(dx*ax+dy*ay)/(al*d)>=cone?d:0; };
    let kind=null, tgt=null, bd=1e9;
    for(const e of (typeof ENEMS!=='undefined'?ENEMS:[])){                    // an enemy you just hurt (not by its bolts)
      if(!e) continue; const was=hpE.get(e); hpE.set(e,e.hp);
      if(!kind&&e.alive&&was!=null&&e.hp<was&&fr-sibEnemyHitFr>3&&Math.hypot(e.x+(e.w||0)/2-P.x,e.y+(e.h||0)/2-P.y)<360){ kind='fight'; tgt=e; }
    }
    if(!kind&&p.magOn&&B.mag&&B.mag.held&&B.mag.held.length){ kind='pull'; tgt=B.mag.held[0]; }   // a load on your magnet
    if(!kind&&punching){                                                      // your fist on its way to a block
      for(const w of (typeof BWALLS!=='undefined'?BWALLS:[])){ if(!blockOk(w)) continue; const d=inAim(w.x+(w.w||32)/2,w.y+(w.h||32)/2,120,0.45); if(d&&d<bd){ bd=d; tgt=w; } }
      if(tgt) kind='block';
    }
    if(!kind&&blockT&&fr-blockT.t<4&&blockOk(blockT.w)){ kind='block'; tgt=blockT.w; }   // a block you just chipped (fist, shot)
    if(!kind&&punching) for(const e of (typeof ENEMS!=='undefined'?ENEMS:[])){   // squaring up to an enemy
      if(!e||!e.alive||e._hidden) continue; const d=inAim(e.x+(e.w||0)/2,e.y+(e.h||0)/2,180,0.5); if(d&&d<bd){ bd=d; tgt=e; kind='fight'; }
    }
    const A=S._act;
    if(kind){
      const same=A&&A.kind===kind&&(A.tgt===tgt||(kind==='block'&&blockOk(A.tgt)&&Math.hypot(A.tgt.x-tgt.x,A.tgt.y-tgt.y)<=3.5*32));
      if(!same){
        S._act={kind,tgt,t:fr,t0:fr,spot:null,badSpot:-999}; S._bang=BANG_T; S._spot=null; stats.clocks++;   // it clocks it: "!"
        try{ sfx('enemy_alert',S.hero==='venture'?1.25:1.4); }catch(e){}
      }else{ A.t=fr; if(kind!=='block') A.tgt=tgt; }
    }
    const C=S._act; if(!C) return;
    if(C.kind==='block'&&!blockOk(C.tgt)){ const nx=wallOf(C.tgt)[0]; if(nx){ C.tgt=nx; C.spot=null; } else { S._act=null; return; } }   // that one's broken: the next block of the same wall
    const tx=C.tgt?C.tgt.x+(C.tgt.w||0)/2:P.x, ty=C.tgt?C.tgt.y+(C.tgt.h||0)/2:P.y;
    if(fr-C.t>ACT_HOLD[C.kind]||Math.hypot(tx-P.x,ty-P.y)>360||(C.kind==='fight'&&!C.tgt.alive)){ S._act=null; S._spot=null; return; }   // you've moved on
    if(C.kind==='block'&&(!C.spot||fr%20===0)){
      const keep=C.spot&&blockOk(C.spot.work)&&Math.abs(C.spot.x-p.x)>=30;    // its place at the wall holds while you shuffle
      if(!keep) C.spot=fr-C.badSpot>180?workSpot(C.tgt):null;
    }
  }
  // a floor spot beside an open face of that wall, where its fist reaches a block, clear of you
  function workSpot(w0){
    const feet=p.y+FEET_OFF; let best=null, bs=-1e9;
    for(const o of wallOf(w0)) for(const side of [-1,1]){
      const faceX=side<0?o.x:o.x+(o.w||32), cy=o.y+(o.h||32)/2;
      if(solidAt(faceX+side*6,cy)) continue;                                  // that face is buried
      const x0=side<0?faceX-SW-6:faceX+6;
      for(const back of [0,40]){                                              // right at the face, or at your shoulder when you're there
        const x=x0+side*back;
        let fy=null; for(let yy=Math.floor((cy+12)/8)*8;yy<=cy+120;yy+=8){ const c=x+SW/2; if(solidAt(c,yy)&&!solidAt(c,yy-8)&&!solidAt(c,yy-40)&&!solidAt(c,yy-66)){ fy=yy; break; } }
        if(fy==null||deadly(x,fy-FEET_OFF)) continue;
        if(Math.abs(x-p.x)<36&&Math.abs(fy-feet)<60) continue;               // you're standing there
        if(!walkable(p.x,feet,x,fy)) continue;                                // it has to get there from you
        const s=(o===w0?40:0)-back*0.6-Math.abs(cy-(fy-62))*0.6-Math.abs(x-S.x)*0.15;
        if(s>bs){ bs=s; best={x, y:fy-FEET_OFF, work:o}; }
      }
    }
    return best;
  }
  // the floor in this column within a step of a feet height
  function floorStep(x,f){
    const c=x+SW/2; let best=null, bd=1e9;
    for(let yy=Math.floor((f-56)/8)*8;yy<=f+72;yy+=8){
      if(!solidAt(c,yy)||solidAt(c,yy-8)||solidAt(c,yy-40)||solidAt(c,yy-66)) continue;
      const d=Math.abs(yy-f); if(d<bd){ bd=d; best=yy; }
    }
    return best;
  }
  // can it roll from here to there along the floor (steps it can hop, no pits, no live water)
  function walkable(x0,f0,x1,f1){
    const dir=Math.sign(x1-x0), n=Math.ceil(Math.abs(x1-x0)/16); let f=f0;
    for(let i=1;i<=n;i++){ const x=i===n?x1:x0+dir*16*i, g=floorStep(x,f); if(g==null||deadly(x,g-FEET_OFF)) return false; f=g; }
    return Math.abs(f-f1)<28;
  }
  const inView=(x,m)=>{ const v=view(); return x>=v.x0+m&&x+SW<=v.x1-m; };
  // ── its own spot near you (T124): in the scene, one it can get to, covering your side that faces
  //    the danger, clear of your line of fire, and now and then a new one when you hang about ──
  function pickSpot(){
    const A=S._act, feet=p.y+FEET_OFF;
    if(S._pref==null) S._pref=96+Math.random()*50;
    if(A&&A.kind==='block'&&A.spot) return A.spot;
    const sp=S._spot, t=S._threat, still=Math.hypot(p.vx||0,p.vy||0)<0.6&&p.og;
    if(sp&&fr<sp.until&&Math.abs(p.x-sp.px)<90&&Math.abs(p.y-sp.py)<60&&(!!t)===sp.th&&(sp.fb||standOk(sp.x,sp.y))) return sp;
    const using=!!(p.xlrOn||p.magOn||p.pCharging||p.pt>0||p.fireRecoil>0);
    const urgent=!!t&&(t.dP<160||(p.hp||0)<(p.maxHp||100)*0.5);
    const load=A&&A.kind==='pull'&&A.tgt?A.tgt.x+(A.tgt.w||32)/2:null;
    const wander=!t&&still&&sp&&fr>=sp.until;                                 // you're hanging about: it finds somewhere new to be
    if(wander) S._pref=90+Math.random()*90;
    let best=null, bs=-1e9;
    for(let k=-8;k<=8;k++){
      if(k>-3&&k<3) continue;                                                   // never within PERSONAL of you
      const x=p.x+k*24; if(!inView(x,24)) continue;
      const fy=floorStep(x,feet); if(fy==null||deadly(x,fy-FEET_OFF)) continue;
      if(!walkable(p.x,feet,x,fy)) continue;
      const d=Math.abs(x-p.x), side=Math.sign(x-p.x);
      let s=-Math.abs(d-S._pref)*0.5-Math.abs(fy-feet)*0.4;
      if(t){
        const cx=x+SW/2, cy=fy-STAND_H*0.45, dT=Math.hypot(t.ex-cx,t.ey-cy);
        s+=clearLine(cx,cy-6,t.ex,t.ey)?50:-40;                               // a clear shot at it
        if(side===Math.sign(t.ex-(p.x+SW/2))) s+=urgent?60:30;                // between it and you
        if(dT<90) s-=90;                                                      // not in its face
      }else{
        if(side===S._side) s+=18;                                             // it likes your back, but that's not a rule
        if(Math.abs(p.vx||0)>1.5&&side===Math.sign(p.vx)) s-=45;              // never out in front of you while you run
        if(using&&side===(p.fc?1:-1)&&Math.abs(fy-feet)<60) s-=60;            // out of your line of fire
        if(load!=null&&side===Math.sign(load-(p.x+SW/2))) s-=50;              // clear of the load you're hauling
        if(still) s+=(Math.random()-0.5)*24;                                  // it looks around on its own
      }
      if(sp&&Math.abs(x-sp.x)<26) s+=wander?-30:14;
      if(s>bs){ bs=s; best={x, y:fy-FEET_OFF}; }
    }
    if(!best) best={x:p.x+S._side*(PERSONAL+8), y:p.y, fb:true};
    else if(!sp||Math.abs(best.x-sp.x)>30) stats.spots++;
    best.px=p.x; best.py=p.y; best.th=!!t; best.until=fr+(t?30:still?180+(Math.random()*180|0):45);
    return S._spot=best;
  }
  // a punch from its glove (the hit lands at once; the arm is drawn by the game from S.pt)
  function sibPunch(tx,ty,hit){
    const me=centre(S), dx=tx-me.x, dy=ty-me.y, d=Math.hypot(dx,dy)||1;
    S.aimDX=S.tAimDX=dx/d; S.aimDY=S.tAimDY=dy/d; if(Math.abs(dx)>4) S.fc=dx>0;
    S.pt=7; S.pCharge=0; S.pCharging=false; S._hitDone=true; S._punchCd=PUNCH_CD; S._shotCd=Math.max(S._shotCd||0,10);
    stats.punches++;
    try{ sfx('punch',S.hero==='venture'?1.1:1.2); }catch(e){}
    hit(me.x+dx/d*Math.min(d,60), me.y+dy/d*Math.min(d,60), Math.atan2(dy,dx));
  }
  // join what you're doing; true while it's busy with that (it doesn't idle-aim then)
  function joinAct(){
    const A=S._act; if(!A||S._fly||S._zip) return false;
    const me=centre(S);
    if(A.kind==='block'){
      let o=null, od=1e9;
      for(const w of wallOf(A.tgt)){ const cx=w.x+(w.w||32)/2, cy=w.y+(w.h||32)/2, d=Math.hypot(cx-me.x,cy-me.y);
        if(d<=PUNCH_R_WALL&&d<od&&(typeof _punchReach!=='function'||_punchReach(me.x,me.y,cx,cy,w))){ od=d; o=w; } }
      if(o){                                                                  // at the wall: punch it with you
        if(!(S._punchCd>0)&&S.og&&Math.abs(S.vx)<1.5){
          sibPunch(o.x+(o.w||32)/2,o.y+(o.h||32)/2,(fx,fy,a)=>{ sibHitFr=fr; if(typeof _damageBwall==='function') _damageBwall(o,'punch',{shakeX:Math.cos(a)*4,shakeY:Math.sin(a)*4}); });
          if(od>70) S.pCharge=28;                                             // from your shoulder: the long hook reaches past you
        }
        return true;
      }
      if(!A.spot||Math.abs(S.x-A.spot.x)<12) boltBlock(A.tgt);               // no way to the wall (or out of reach there): bolts from where it stands
      return true;
    }
    if(A.kind==='pull'&&A.tgt){                                              // its MAG on your load, from the side
      const cx=A.tgt.x+(A.tgt.w||32)/2, cy=A.tgt.y+(A.tgt.h||32)/2, dx=cx-me.x, dy=cy-me.y, d=Math.hypot(dx,dy)||1;
      S.aimDX+=(dx/d-S.aimDX)*0.3; S.aimDY+=(dy/d-S.aimDY)*0.3; if(Math.abs(dx)>6) S.fc=dx>0;
      if(d<260){ S._magShow=true; if(fr%4===0){ const tp=tipOf(S), k=0.3+Math.random()*0.5; PFXS.push({x:tp.x+dx*k,y:tp.y+dy*k,vx:-dx/d*2.2,vy:-dy/d*2.2,life:10,maxLife:10,r:1.6,col:fr%8?'#ff6060':'#6090ff'}); } }
      return true;
    }
    return false;
  }
  // what it looks at when it isn't moving
  function lookAt(){
    if(S._threat) return {x:S._threat.ex};
    const A=S._act; if(A&&A.tgt) return {x:A.tgt.x+(A.tgt.w||0)/2};
    return null;
  }

  // ── SOLO: the other sibling at home, pottering about like Laitu ──
  let npc=null;
  function npcSpawn(){
    const home=(B.rooms||[]).find(r=>r.style==='home'); if(!home||typeof gridWorldSolid!=='function') return null;
    // the upper floor of the house (the bedroom): the first floor down from the room's top
    const floorAt=x=>{ for(let y=home.y+40;y<home.y+home.h+40;y+=4){ if(gridWorldSolid(x,y)) return y; } return null; };
    const mid=home.x+home.w*0.55, fy=floorAt(mid); if(fy==null) return null;
    let x0=mid, x1=mid;
    while(x0>home.x+40&&floorAt(x0-8)===fy&&!gridWorldSolid(x0-8,fy-40)) x0-=8;
    while(x1<home.x+home.w-40&&floorAt(x1+8)===fy&&!gridWorldSolid(x1+8,fy-40)) x1+=8;
    const s2=mkP(); s2._aiCompanion=true; s2._betaSib=true; s2.hero=p.hero==='venture'?'mind':'venture';
    s2.x=mid-SW/2; s2.y=fy-FEET_OFF; s2.og=true; s2.hp=s2.maxHp; s2.fc=Math.random()<0.5;
    return {s:s2, fy, minX:x0+10-SW/2, maxX:x1-10-SW/2, tx:null, wait:60, level:B.level};
  }
  function npcTick(){
    if(!npc||npc.level!==B.level||npc.s.hero===p.hero){ npc=npcSpawn(); if(!npc) return; }
    const s2=npc.s; if(s2.sibHp==null) s2.sibHp=100; s2.hp=s2.maxHp*s2.sibHp/100; const x0=s2.x;
    if(s2.flashF>0) s2.flashF--;
    if(typeof _updateBattleEye==='function') _updateBattleEye(s2);
    interact(s2); envTick(s2);
    if(s2._madT>0){ madTick(s2); return; }
    if(s2._downT>0){ s2._downT--; s2.crouchAmt=Math.min(1,(s2.crouchAmt||0)+0.1); if(s2.free>0) bodyPhysics(s2); if(s2._downT===0) s2.crouchAmt=0; return; }
    if(s2.free>0){ bodyPhysics(s2); npc.tx=null; npc.wait=40; return; }
    // walking: keep to the floor it stands on (turn at an edge or a wall)
    if(npc.tx!=null&&typeof gridWorldSolid==='function'){ const dir=Math.sign(npc.tx-s2.x)||1, fx=s2.x+SW/2+dir*26, feet=s2.y+FEET_OFF;
      if(!gridWorldSolid(fx,feet+6)||gridWorldSolid(fx,feet-36)){ npc.tx=null; npc.wait=60+Math.random()*120|0; } }
    if(!(npc.minX<npc.maxX)||Math.abs((s2.x)-(npc.minX+npc.maxX)/2)>400){ npc.minX=s2.x-160; npc.maxX=s2.x+160; }
    const P=centre(p), me=centre(s2), near=Math.hypot(P.x-me.x,P.y-me.y)<260;
    if(npc.wait>0){ npc.wait--; if(near) s2.fc=P.x>me.x; }
    else{
      if(npc.tx==null) npc.tx=npc.minX+Math.random()*(npc.maxX-npc.minX);
      const dx=npc.tx-s2.x;
      if(Math.abs(dx)<3){ npc.tx=null; npc.wait=90+Math.random()*200|0; }
      else{ s2.x+=Math.sign(dx)*Math.min(1.3,Math.abs(dx)); s2.fc=dx>0; }
    }
    if(typeof _movePlayerWithColl==='function'){ const nx=s2.x; s2.x=x0; s2.vy=Math.min((s2.vy||0)+GRAV,14); _movePlayerWithColl(s2,nx-x0,s2.vy); if(s2.og) s2.vy=0; }   // a body on the floor
    s2.vx=s2.x-x0; s2.wheelAngle=(s2.wheelAngle||0)+s2.vx/WHEEL_R;
    const dxp=P.x-me.x, dyp=P.y-me.y, dl=Math.hypot(dxp,dyp)||1;
    if(near&&!(typeof ENEMS!=='undefined'&&ENEMS.some(e=>e&&e.alive&&Math.hypot(e.x-s2.x,e.y-s2.y)<520))){ s2.pupilX=dxp/dl*2.5; s2.pupilY=dyp/dl*2; }   // it looks at you
    s2.aimDX=s2.fc?1:-1; s2.aimDY=0.4;
  }
  // ── its body has mass (Paulo, Oct 22): you can punch it, blow it away with the XLR, pull it
  //    with the MAG, shove it with your weight or land on it. Friendly fire ON also hurts it
  //    (it can be knocked out for a few seconds); OFF it just gets moved.
  // Paulo (Oct 22): friendly fire is only about what YOU and IT do to each other — the world hurts
  // it like it hurts you: the live yellow cage blocks, live water, lightning, a block chain going off
  function envHurt(b,dmg,kx,ky,kind){
    if(!b||b._downT>0||dmg<=0) return;
    ropeIdle(b);
    b.sibHp=(b.sibHp==null?100:b.sibHp)-dmg; b.flashF=16; b._hurtFr=fr;
    b.vx=kx; b.vy=ky; b.og=false; b.free=Math.max(b.free||0,40); b._prevLandFeet=b.y+FEET_OFF;
    try{ sfx('player_hit',1.35); }catch(e){}
    const c=centre(b); for(let k=0;k<12;k++){ const a=Math.random()*Math.PI*2, sp=2+Math.random()*4; PFXS.push({x:c.x,y:c.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1,life:10+Math.random()*10|0,maxLife:20,r:1.6,col:k%3?'#fff6a0':'#80d8ff'}); }
    if(b.sibHp<=0){ b._downT=240; b.sibHp=100; try{ sfx('enemy_shut',1.2); }catch(e){} }
  }
  B.sibHurtAt=function(x,y,R,dmg){ const b=S&&active()?S:(npc&&npc.s); if(!b) return; const c=centre(b), d=Math.hypot(c.x-x,(c.y-y)*0.7); if(d<R) envHurt(b,Math.round(dmg*(1-0.5*d/R)),(Math.sign(c.x-x)||1)*6,-6,'blast'); };
  let envCd=0;
  function envTick(b){
    if(envCd>0) envCd--;
    const c=centre(b), hw=26, top=b.y+FEET_OFF-STAND_H-WHEEL_R, bot=b.y+FEET_OFF;
    // the live yellow cage blocks: touching one shocks it, harder the faster it hits
    if(envCd<=0) for(const w of (typeof BWALLS!=='undefined'?BWALLS:[])){
      if(!w||w.only!=='laser'||w.hp<=0) continue;
      if(c.x+hw<w.x-3||c.x-hw>w.x+(w.w||32)+3||bot<w.y-3||top>w.y+(w.h||32)+3) continue;
      const spd=Math.hypot(b.vx||0,b.vy||0), dmg=Math.min(55,Math.max(6,Math.round(spd*4.2)));
      const bx=w.x+(w.w||32)/2, by=w.y+(w.h||32)/2, d=Math.hypot(c.x-bx,c.y-by)||1;
      envHurt(b,dmg,(c.x-bx)/d*Math.min(8,3+dmg/8),Math.min(-3,(c.y-by)/d*5-2),'zap'); envCd=40;
      w.hitGlow=16; try{ sfx(dmg>30?'zap_big':'zap'); }catch(e){}
      break;
    }
    // live water
    if(envCd<=0&&B.elecAt&&B.elecAt(c.x,c.y)){ envHurt(b,8,(b.vx||0)*0.5,-3,'water'); envCd=20; }
    // it heals slowly when it's been left alone for a few seconds
    if(b.sibHp<100&&fr-(b._hurtFr||-999)>180) b.sibHp=Math.min(100,b.sibHp+0.12);
  }
  function knock(b,vx,vy,kind,dmg){
    ropeIdle(b);
    b.vx=vx; b.vy=vy; b.og=false; b.free=Math.max(b.free||0,46); b._prevLandFeet=b.y+FEET_OFF;
    if(ff&&dmg>0&&!(b._downT>0)){
      b.sibHp=(b.sibHp==null?100:b.sibHp)-dmg; b.flashF=14;
      try{ sfx('player_hit',1.35); }catch(e){}
      if(b.sibHp<=0){ b._downT=240; b.sibHp=100; try{ sfx('enemy_shut',1.2); }catch(e){} }
    }else if(kind!=='bump'){ try{ sfx('hit',1.5); }catch(e){} }
    if(!ff&&kind==='punch') tease(b);
  }
  // Friendly fire off: three connecting punches inside 5 seconds and they snap,
  // turn, and throw one loaded punch back. That one does hurt.
  function tease(b){
    if(b._madT>0) return;
    if(!b._tease) b._tease=[];
    b._tease.push(fr);
    b._tease=b._tease.filter(t=>fr-t<=300);
    if(b._tease.length<3) return;
    b._tease.length=0;
    b._madT=34; b._madHit=false; b.free=0;
    b.vx*=0.15; b.vy=Math.min(b.vy||0,-1.5);
    const name=b.hero==='venture'?'VENTURE':'MIND';
    try{ if(typeof uiShowToast==='function') uiShowToast(name+' SNAPS'); }catch(e){}
    try{ sfx('punch_heavy',0.85); }catch(e){}
  }
  function madTick(b){
    if(!(b._madT>0)) return;
    b._madT--; b.free=0;
    const c=centre(b), P=centre(p);
    const dx=P.x-c.x, dy=P.y-c.y, d=Math.hypot(dx,dy)||1;
    const ux=dx/d, uy=dy/d, dir=dx>=0?1:-1;
    b.fc=dx>=0; b.aimDX=ux; b.aimDY=Math.max(-0.4,Math.min(0.45,uy));
    b.tAimDX=b.aimDX; b.tAimDY=b.aimDY;
    if(b._madT>12){
      b.pCharging=true; b.pCharge=Math.min(28,(34-b._madT)*2); b.pt=0;
      b.crouchAmt=Math.min(0.8,(b.crouchAmt||0)+0.14);
      b.vx=d>52?dir*Math.min(5.2,1.3+d*0.018):dir*0.4;
      b.vy=Math.min((b.vy||0)+GRAV,12);
      if(b.og&&d>78&&d<220){ b.vy=-7.2; b.og=false; }
    }else{
      b.pCharging=false; b.pCharge=28; b.pt=Math.max(1,b._madT);
      b.crouchAmt=Math.max(0,(b.crouchAmt||0)-0.22);
      b.vx=dir*1.6; b.vy=Math.min((b.vy||0)+GRAV*0.35,8);
      if(!b._madHit&&b.pt<=4&&d<112){
        b._madHit=true;
        try{ applyPlayerHit(ux*7, Math.min(-3.2, uy*4-2), 28); }catch(e){}
        try{ sfx('punch_hit_heavy'); }catch(e){}
        for(let i=0;i<10;i++) PFXS.push({x:P.x+(Math.random()-0.5)*16,y:P.y+(Math.random()-0.5)*16,vx:ux*(2+Math.random()*4),vy:uy*2-Math.random()*2,life:12,maxLife:12,r:2.2,col:i%2?'#ffe0a0':'#ff8866'});
      }
    }
    if(typeof _movePlayerWithColl==='function') _movePlayerWithColl(b,b.vx,b.vy||0); else { b.x+=b.vx; b.y+=b.vy; }
    if(b.og&&b.vy>0) b.vy=0;
    b.wheelAngle=(b.wheelAngle||0)+(b.vx||0)/(typeof WHEEL_R!=='undefined'?WHEEL_R:20);
    if(b._madT<=0){ b.pt=0; b.pCharge=0; b.pCharging=false; b.crouchAmt=0; }
  }
  function interact(b){
    if(b._madT>0) return;
    const c=centre(b), P=centre(p), dx=c.x-P.x, dy=c.y-P.y, d=Math.hypot(dx,dy)||1;
    const ax=p.aimDX||0, ay=p.aimDY||0, al=Math.hypot(ax,ay)||1, ux=ax/al, uy=ay/al, dot=(dx*ux+dy*uy)/d;
    if(!clearLine(P.x,P.y,c.x,c.y)) return;                       // nothing (punch, air, magnet, weight) reaches it through a wall
    // a punch
    if(p.pt>0){ if(!b._pHit){ const rx=P.x+ux*52, ry=P.y+uy*52; if(Math.hypot(c.x-rx,c.y-ry)<64||(Math.abs(dx)<SW&&Math.abs(dy)<70&&dot>0.2)){ b._pHit=true; const k=(p.pCharge||0)>20||p.pCd>4?1.6:1; knock(b,ux*7.5*k,uy*5*k-3.5,'punch',k>1?22:12); } } }
    else b._pHit=false;
    // the XLR blows it away; the MAG pulls it in
    if(p.xlrOn&&ITEM===2&&d<170&&dot>0.6){ const f=(1-d/170)*1.5; b.vx=(b.vx||0)+ux*f; b.vy=(b.vy||0)+uy*f-0.25; if(!(b.free>0)) knock(b,b.vx,b.vy,'xlr',0); b.free=Math.max(b.free,24); if(ff&&fr%10===0) knock(b,b.vx,b.vy,'xlr',3); }
    if(p.magOn&&ITEM===3&&d<190&&d>64&&dot>0.55){ const f=(1-d/190)*1.2; b.vx=(b.vx||0)-ux*f; b.vy=(b.vy||0)-uy*f-0.3; if(!(b.free>0)) knock(b,b.vx,b.vy,'mag',0); b.free=Math.max(b.free,24); }
    // your weight: land on it, or roll into it
    if(Math.abs(dx)<SW*0.75&&Math.abs((b.y)-(p.y))<70){
      if((p.vy||0)>3&&p.y+FEET_OFF<b.y+FEET_OFF-36){ p.vy=-7; p.og=false; knock(b,Math.sign(dx||1)*2.5,2,'stomp',10); }
      else if(Math.abs(p.vx||0)>(b._aiCompanion?6:4.5)&&Math.sign(p.vx)===Math.sign(dx||p.vx)){ const push=p.vx*0.85+Math.sign(dx||p.vx)*0.8; if(!(b.free>0)||Math.abs(b.vx||0)<Math.abs(push)) knock(b,push,b.og?-0.6:(b.vy||0),'bump',0); }   // only a real ram shoves the companion (walking past it doesn't)
    }
  }
  function bodyPhysics(b){
    b.vy=Math.min((b.vy||0)+GRAV,14);
    b.vx*=b.og?0.84:0.985;
    if(typeof _movePlayerWithColl==='function') _movePlayerWithColl(b,b.vx,b.vy); else { b.x+=b.vx; b.y+=b.vy; }
    if(b.og&&b.vy>0) b.vy=0;
    b.wheelAngle=(b.wheelAngle||0)+b.vx/WHEEL_R;
    b.free-=(b.og&&Math.abs(b.vx)<0.4)?3:1;
  }
  // the jack's tip, where its shots come from (the arm points where it aims)
  function tipOf(b){
    try{ const pose=computeConnectorArmPose(b), a=Math.atan2(b.aimDY||0,b.aimDX||(b.fc?1:-1));
      if(pose&&isFinite(pose.tipX)) return {x:pose.tipX+Math.cos(a)*30, y:pose.tipY+Math.sin(a)*30}; }catch(e){}
    const c=centre(b); return {x:c.x+(b.fc?36:-36), y:c.y-6};
  }
  function fizz(b,hit){ const c=S&&S.hero==='venture'?'#ff8a96':'#d8b4ff'; for(let k=0;k<(hit?8:4);k++) PFXS.push({x:b.x,y:b.y,vx:(Math.random()-0.5)*3,vy:(Math.random()-0.5)*3,life:10,maxLife:10,r:1.6,col:c}); }

  // Four fast item-select taps, close to the brother, swaps who you play (Paulo, Oct 25).
  // Each tap still cycles the jack on that frame. Waiting out the window was the
  // item-button lag: the brother stands next to you, so every press was swallowed.
  const SWAP_MS=1000, SWAP_DIST=110, SWAP_CD=45;
  let _swapT=[], _swapCd=0, _swapItem0=0;
  function _nearBro(){
    if(!on||!S||!p||(typeof _playerCount!=='undefined'&&_playerCount!==1)) return false;
    if(typeof _gameState!=='undefined'&&_gameState!=='game') return false;
    if(typeof _paused!=='undefined'&&_paused) return false;
    const a=centre(p), b=centre(S);
    return Math.hypot(a.x-b.x,a.y-b.y)<=SWAP_DIST;
  }
  function swapBrothers(){
    if(!S||!p) return;
    const lead=p, sib=S;
    const leadSlot=typeof ITEM!=='undefined'?ITEM:0;
    const sibSlot=sib._itemSlot!=null?sib._itemSlot:leadSlot;
    let next=sibSlot, left=leadSlot;
    if(leadSlot===4){ next=4; left=sibSlot===4?0:sibSlot; }
    sib._itemSlot=left;
    if(typeof ITEM!=='undefined') ITEM=next;
    const leadPct=lead.maxHp>0?lead.hp/lead.maxHp*100:100;
    const sibPct=sib.sibHp!=null?sib.sibHp:100;
    lead._aiCompanion=true; lead._betaSib=true;
    sib._aiCompanion=false; sib._betaSib=false;
    p=sib; S=lead;
    S.sibHp=leadPct; p.sibHp=null;
    p.hp=Math.max(1,Math.round((p.maxHp||1)*sibPct/100));
    if(typeof _syncLivesFromHp==='function') _syncLivesFromHp(p);
    if(typeof _heroChoice!=='undefined') _heroChoice=p.hero;
    p.flashF=Math.max(p.flashF||0,12); S._blink=0; lastHero=p.hero;
    // the old lead walks with you from here: fresh trail, no leftover plans or hovers
    trail.length=0; record();
    S._ti=null; S._plan=null; S._fly=false; S._flying=false; S._zip=null; S._trailMode=false; S._noProg=0; S._best=null; S._stuck=0; S._waiting=false;
    S._side=null; S._shotCd=30; S._act=null; S._spot=null; S._bang=0; S._punchCd=0; S.pt=0; if(S._pref==null) S._pref=96+Math.random()*50;
    for(const b of [p,S]){ const c=centre(b), col=b.hero==='venture'?'#ff8a96':'#d8b4ff';
      for(let k=0;k<14;k++){ const a=k/14*Math.PI*2; PFXS.push({x:c.x,y:c.y,vx:Math.cos(a)*4,vy:Math.sin(a)*4,life:14,maxLife:14,r:2.4,col}); } }
    stats.swaps++;
    try{ sfx('swap'); sfx('confirm'); }catch(e){}
    try{ uiShowToast('NOW PLAYING: '+(p.hero==='venture'?'VENTURE':'MIND')); }catch(e){}
    try{
      const ev={kind:'brother_swap', hero:p.hero, stage:B.stageId||null, t:Date.now()};
      (window.__MV_EVENTS=window.__MV_EVENTS||[]).push(ev); if(window.__MV_EVENTS.length>50) window.__MV_EVENTS.shift();
      window.dispatchEvent(new CustomEvent('mv:telemetry',{detail:ev}));
    }catch(e){}
  }
  function swapTick(){
    if(_swapCd>0) _swapCd--;
    if(_swapT.length&&(!_nearBro()||performance.now()-_swapT[0]>=SWAP_MS)) _swapT=[];
  }
  window.MV_BROTHER_SWAP={
    tap(){
      if(_swapCd>0||!_nearBro()) return false;
      const now=performance.now();
      if(!_swapT.length||now-_swapT[0]>=SWAP_MS){
        _swapT=[now];
        _swapItem0=(typeof ITEM!=='undefined')?ITEM:0;
        return false;
      }
      _swapT.push(now);
      if(_swapT.length>=4){
        _swapT=[];
        if(typeof ITEM!=='undefined') ITEM=_swapItem0;
        swapBrothers();
        _swapCd=SWAP_CD;
        return true;
      }
      return false;
    }
  };
  const _upd=window.updateKnowls;
  window.updateKnowls=function(){
    try{ swapTick(); }catch(e){}
    const r=_upd.apply(this,arguments);
    try{
      if(!B.on||!labOk()){ S=null; npc=null; return r; }
      if(!on){ S=null; if(active2()) npcTick(); return r; }
      npc=null;
      if(!active()) return r;
      if(!S||p.hero===S.hero) spawn();
      if(S.sibHp==null) S.sibHp=100; S.hp=S.maxHp*S.sibHp/100;   // its Knowl tank shows its own energy
      if(S._blink>0) S._blink--;
      if(S.fireRecoil>0) S.fireRecoil--;
      if(S.flashF>0) S.flashF--;
      if(S._shootT>0) S._shootT--;
      if(S.pt>0) S.pt--; if(S._bang>0) S._bang--; if(S._punchCd>0) S._punchCd--;
      if(typeof _updateBattleEye==='function') _updateBattleEye(S);   // its eye: looks at the nearest enemy, squints, gets mad — like yours
      interact(S);
      envTick(S);
      if(S._madT>0){ madTick(S); boltsTick(); return r; }
      if(S._downT>0){ S._downT--; S.crouchAmt=Math.min(1,(S.crouchAmt||0)+0.1); if(S.free>0) bodyPhysics(S); if(S._downT===0){ S.crouchAmt=0; S._blink=12; } boltsTick(); return r; }   // knocked out (friendly fire): back in a few seconds
      watchBlocks(); readAction();
      if(S.free>0){ bodyPhysics(S); assist(); boltsTick(); S._catch=30; return r; }      // moved by you: it lands, then rides back to your trail
      assist(); follow(); boltsTick();
    }catch(e){ console.warn('sibling',e); }
    return r;
  };
  // drawn in the world, behind MIND (beta_level's world overlay runs before the characters)
  const _hud=window.drawLdtkLabHud;
  window.drawLdtkLabHud=function(){
    const r=_hud.apply(this,arguments);
    const who=S&&active()?S:(npc&&!on&&active2()?npc.s:null);
    if(!who) return r;
    try{
      // the bolts
      ctx.save(); ctx.globalCompositeOperation='lighter';
      for(const b of bolts){ if(!S) break; const c=S.hero==='venture'?'255,90,110':'190,140,255'; ctx.strokeStyle='rgba('+c+',0.85)'; ctx.lineWidth=sw(4); ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(sx(b.x-b.vx*1.6),sy(b.y-b.vy*1.6)); ctx.lineTo(sx(b.x),sy(b.y)); ctx.stroke();
        ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(sx(b.x),sy(b.y),Math.max(1.5,sw(2.5)),0,Math.PI*2); ctx.fill(); }
      ctx.restore();
      // the sibling itself: a touch see-through while it blinks in, never the focus
      const keep={rc:B.ropeClip, mp:B.magPark, it:ITEM};
      const swing=who===S&&S.hook&&S.hook.st!=='idle';
      const carry=who===S&&S._carry!=null?S._carry:null;   // a jack it took from an A+B drop (beta_knife)
      const jack=carry!=null?carry:(ITEM===4?-1:(ITEM>=0?ITEM:-1));   // the kiritsuke is the lead's alone; the brother keeps fists
      const show=who._madT>0?-1:(who!==S?-1:(swing?1:S._magShow?3:S._shootT>0?(carry!=null?carry:0):S._flying?2:jack));   // a loaded punch is bare fists; otherwise its own jack
      B.ropeClip=null; B.magPark=null; ITEM=show;
      try{
        who._armPose=computeConnectorArmPose(who);
        if(swing&&typeof drawHookCable==='function') withPlayerContext(S,()=>{ ctx.save(); try{ drawHookCable(); } finally{ ctx.restore(); } });   // its own cord: your rope, its colour
        ctx.save(); ctx.globalAlpha=who===S&&S._blink>0?0.4+0.05*(12-S._blink):(who===S?0.92:1);
        try{ drawCharacterFor(who); } finally{ ctx.restore(); }
      } finally{ B.ropeClip=keep.rc; B.magPark=keep.mp; ITEM=keep.it; }   // your item, rope and magnet are always handed back
      if(who===S&&S._bang>0) drawBang();
    }catch(e){ console.warn('sibling draw',e); }
    return r;
  };
  // the "!" when it clocks what you're doing: pops in, holds, fades; its own colour (an enemy's is yellow)
  function drawBang(){
    const t=BANG_T-S._bang, a=t<44?1:Math.max(0,1-(t-44)/16), pop=t<8?0.5+0.7*Math.sin(t/8*Math.PI*0.75):1;
    const x=sx(S.x+SW/2), y=sy(S.y)-sw(34)-Math.min(6,t*0.6), r=sw(13)*pop;
    ctx.save(); ctx.globalAlpha=a;
    ctx.fillStyle=S.hero==='venture'?'#ff8a96':'#d8b4ff'; ctx.strokeStyle='#1a0e08'; ctx.lineWidth=Math.max(2,sw(2.5));
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x-r*0.25,y+r*0.85); ctx.lineTo(x,y+r*1.45); ctx.lineTo(x+r*0.3,y+r*0.82); ctx.fill();
    ctx.fillStyle='#1a0e08'; ctx.font=Math.round(r*1.9)+'px "MV Pixel", monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('!',x,y+r*0.06);
    ctx.restore();
  }
})();
