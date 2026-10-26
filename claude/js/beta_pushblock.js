// ============================================================
//  beta_pushblock.js — blue push blocks move free (Paulo, Oct 25, T125)
//
//   "The Push block mechanics are still very rigid. Closer to the omniblocks'
//    movement potential, but just work with the XLR item's effect."
//
//   XLR RELEASE  a push line (beta_level chainTick) is handed here instead of
//                stepping cell by cell: every block in it is launched along the
//                aim (speed from the line's cells = charge × power × weight).
//   XLR HELD     the air leans on push blocks in the jet: resting ones break
//                loose after a beat, sliding ones keep being shoved.
//   PHYSICS      slide (low friction), bounce off walls, knock the next push
//                block on, tip over a ledge (spin), fall, sink slow in water,
//                then settle back into a grid cell (eased) and act as a cube again.
//   Only the XLR: the MAG, punches, lasers, the knife and the sibling already
//   skip push blocks; nothing else feeds this.
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B) return;
  const T=32;
  const on=()=>B.on&&typeof p!=='undefined'&&p&&_gameState==='game'&&!(typeof _paused!=='undefined'&&_paused);
  const PB={FRIC:0.93, AIR:0.995, BOUNCE:0.3, SPD:2.6, SPD0:0.8, UP:2.2, UP0:4, DOWN:2, DOWN0:3,
    AIR_R:T*4.5, AIR_CONE:0.82, AIR_LOOSE:18, AIR_PUSH:0.22, SETTLE:5};
  const live=[];
  const S=(o,n)=>{ try{ sfxAt(o,n); }catch(e){} };

  function blocked(c,r){ return !B.cellFree(c,r,true); }
  function hitsAt(x,y){
    const m=1.5, x0=Math.floor((x+m)/T), x1=Math.floor((x+T-m)/T), y0=Math.floor((y+m)/T), y1=Math.floor((y+T-m)/T);
    for(let r=y0;r<=y1;r++) for(let c=x0;c<=x1;c++) if(blocked(c,r)) return {c,r};
    return null;
  }
  const isPush=b=>b&&b.only==='push';

  function launch(bw,vx,vy){
    if(bw.homeCol!=null){ try{ gridSmashCell(bw.homeCol,bw.homeRow); }catch(e){} }
    bw.x+=bw._ox||0; bw.y+=bw._oy||0; bw._ox=0; bw._oy=0; bw._ease=0; bw._spd=null;
    bw.homeCol=bw.homeRow=bw.homeX=bw.homeY=null;
    bw._fly=true; bw._pb=true; bw.vx=vx; bw.vy=vy; bw.rot=bw.rot||0; bw.spin=vx*0.004; bw._rest=0; bw._pbT=0; bw.wedge=false;
    bw.hitGlow=16; bw._sq=-0.16; bw._sqV=0; bw._sqAx=Math.abs(vx)>=Math.abs(vy)?'x':'y';
    if(live.indexOf(bw)<0) live.push(bw);
  }
  B.pushLaunch=launch;

  function settle(bw){
    const c0=Math.floor((bw.x+T/2)/T), r0=Math.floor((bw.y+T/2)/T);
    let best=null, bd=1e9;
    for(let dr=-2;dr<=2;dr++) for(let dc=-2;dc<=2;dc++){
      const c=c0+dc, r=r0+dr; if(!B.cellFree(c,r)) continue;
      const d=Math.hypot((c+0.5)*T-bw.x-T/2,(r+0.5)*T-bw.y-T/2); if(d<bd){ bd=d; best={c,r}; }
    }
    if(!best) return false;
    const fx=bw.x, fy=bw.y;
    bw._fly=false; bw._pb=false; bw.vx=0; bw.vy=0; bw.rot=0; bw.spin=0; bw._rest=0;
    bw.homeCol=best.c; bw.homeRow=best.r; bw.x=bw.homeX=best.c*T; bw.y=bw.homeY=best.r*T;
    bw.lipPass=best.c>=64&&best.c<=65&&best.r>=26&&best.r<=27&&(!B.stageId||B.stageId==='1.1');
    gridSet(best.c,best.r,bw.lipPass?MV_GRID_ONEWAY:MV_GRID_DESTRUCT);
    if(B.cubeCellsEver) B.cubeCellsEver.add(best.c+','+best.r);
    bw._ox=fx-bw.x; bw._oy=fy-bw.y; bw._spd=4; bw._fallN=0;
    return true;
  }

  // XLR release: beta_level hands over a push line; launch it as one train
  B.chainHook=function(ch){
    if(!B.on||!ch||!ch.list||!ch.list.some(isPush)) return false;
    const n=Math.max(1,ch.cells||ch.left||1);
    const vx=ch.dc*(PB.SPD0+PB.SPD*n);
    const vy=ch.dr<0?-(PB.UP0+PB.UP*n):ch.dr>0?(PB.DOWN0+PB.DOWN*n):-0.6;
    for(const b of ch.list) launch(b,vx,vy);
    S(ch.list[0],'omniblock_chip');
    return true;
  };

  function tipPoint(){
    if(typeof connectorTipWorld==='function'){ try{ const t=connectorTipWorld(2); if(t&&isFinite(t.x)) return t; }catch(e){} }
    return {x:p.x+SW/2, y:p.y+FEET_OFF-50};
  }
  function losClear(x0,y0,x1,y1){
    const d=Math.hypot(x1-x0,y1-y0), n=Math.ceil(d/10);
    for(let i=1;i<n-1;i++){ const t=i/n, c=Math.floor((x0+(x1-x0)*t)/T), r=Math.floor((y0+(y1-y0)*t)/T);
      if(typeof gridSolid==='function'&&gridSolid(c,r)&&!(B.cubeAt&&B.cubeAt(c,r))) return false; }
    return true;
  }
  // XLR held: the jet leans on push blocks in front of the jack
  function airTick(){
    const held=!!(p.xlrOn&&ITEM===2);
    if(!held){ for(const bw of BWALLS) if(bw._air) bw._air=0; return; }
    const pw=Math.max(0,Math.min(1,(p.itemStamina||0)/100)); if(pw<0.06) return;
    const ax=p.aimDX||0, ay=p.aimDY||0, al=Math.hypot(ax,ay)||1, ux=ax/al, uy=ay/al;
    const t=tipPoint();
    for(const bw of BWALLS){
      if(!isPush(bw)||bw.hp<=0||bw._carried) continue;
      const cx=bw.x+T/2, cy=bw.y+T/2, dx=cx-t.x, dy=cy-t.y, d=Math.hypot(dx,dy)||1;
      if(d>PB.AIR_R||(dx*ux+dy*uy)/d<PB.AIR_CONE||!losClear(t.x,t.y,cx,cy)){ bw._air=0; continue; }
      const k=pw*(1-0.6*d/PB.AIR_R);
      if(bw._pb){ bw.vx+=ux*PB.AIR_PUSH*k; bw.vy+=uy*PB.AIR_PUSH*k-(uy<-0.5?0:0.05*k); continue; }
      if(bw._fly||bw.homeCol==null) continue;
      bw._air=(bw._air||0)+k; bw.shakeX=(Math.random()-0.5)*2*Math.min(1,bw._air/PB.AIR_LOOSE);
      if(bw._air<PB.AIR_LOOSE) continue;
      const dc=Math.abs(ux)>0.38?Math.sign(ux):0, dr=Math.abs(uy)>0.38?Math.sign(uy):0;
      if(!B.cellFree(bw.homeCol+dc,bw.homeRow+dr,true)){ bw._air=PB.AIR_LOOSE*0.6; continue; }
      bw._air=0; launch(bw,ux*(1.6+2*k),uy*(1.6+2*k)-(uy<-0.3?1:0.4));
    }
  }

  function step(bw){
    bw._pbT++;
    const wet=B.inWater&&B.inWater(bw.x+T/2,bw.y+T/2);
    bw.vy=Math.min(bw.vy+GRAV*(wet?0.3:1),wet?2.2:15); bw.vx*=wet?0.93:PB.AIR;
    const steps=Math.max(1,Math.ceil(Math.max(Math.abs(bw.vx),Math.abs(bw.vy))/6));
    let ground=false, wall=0;
    for(let s=0;s<steps;s++){
      const nx=bw.x+bw.vx/steps, hx=hitsAt(nx,bw.y);
      if(hx){
        const nb=B.cubeAt&&B.cubeAt(hx.c,hx.r), sp=Math.abs(bw.vx);
        if(isPush(nb)&&sp>1.2){ launch(nb,bw.vx*0.75,-0.4); bw.vx*=0.2; }      // knocks the next push block on
        else { wall=Math.sign(bw.vx); bw.vx=sp>2?-bw.vx*PB.BOUNCE:0; bw.spin=-(bw.spin||0)*0.5; }
        if(sp>1.5){ S(bw,'omniblock_chip'); bw.shakeX=-Math.sign(bw.vx||1)*3; }
      } else bw.x=nx;
      const ny=bw.y+bw.vy/steps;
      if(hitsAt(bw.x,ny)){
        if(bw.vy>0){ ground=true; if(bw.vy>4){ S(bw,'omniblock_chip'); bw._sq=0.18; bw._sqV=0; bw._sqAx='y'; } }
        bw.vy=bw.vy>4?-bw.vy*0.2:0;
      } else bw.y=ny;
    }
    if(ground){
      bw.vx*=PB.FRIC;
      // tipping: the middle of its base is past the ledge → it rolls off that way
      const fc=Math.floor((bw.x+T/2)/T), fr=Math.floor((bw.y+T+2)/T);
      if(!blocked(fc,fr)){
        const dir=blocked(Math.floor((bw.x+2)/T),fr)?1:-1;
        bw.vx+=dir*0.45; bw.spin=(bw.spin||0)+dir*0.05; ground=false;
      } else {
        const q=Math.PI/2, tgt=Math.round((bw.rot||0)/q)*q;
        bw.rot=(bw.rot||0)+(tgt-(bw.rot||0))*0.35; bw.spin=(bw.spin||0)*0.4;
        if(Math.abs(bw.vx)>1&&bw._pbT%3===0) PFXS.push({x:bw.x+T/2-Math.sign(bw.vx)*T/2,y:bw.y+T-2,vx:-Math.sign(bw.vx)*Math.random(),vy:-Math.random()*0.8,life:12,maxLife:12,r:1.5+Math.random()*1.5,col:'#b8a080'});
      }
    }
    if(!ground){ bw.rot=(bw.rot||0)+(bw.spin||0); bw.spin=(bw.spin||0)*0.985; }
    // MIND stops a block sliding into him and takes a share of the shove
    if(typeof gridPlayerBody==='function'&&Math.abs(bw.vx)>0.3){
      const b=gridPlayerBody(p);
      if(bw.x<b.x+b.w&&bw.x+T>b.x&&bw.y<b.feetY&&bw.y+T>b.y+4){
        const side=(bw.x+T/2)<(b.x+b.w/2)?-1:1;
        p.vx+=bw.vx*0.35; bw.x=side<0?b.x-T:b.x+b.w; bw.vx*=-0.15;
        if(hitsAt(bw.x,bw.y)) bw.x-=side*2;
      }
    }
    // a fast block hits enemies by its momentum, like a thrown omni
    const sp=Math.hypot(bw.vx,bw.vy);
    if(sp>4&&typeof ENEMS!=='undefined') for(const e of ENEMS){
      if(!e.alive||e._betaHeld||(e._cubeHitF||0)>0) continue;
      if(typeof ov==='function'&&ov(bw.x,bw.y,T,T,e.x,e.y,e.w,e.h)){
        if(typeof _damageEnemy==='function') _damageEnemy(e,Math.round(4+sp*2.5),bw.x+T/2,bw.y+T/2,1.2);
        e._cubeHitF=20; bw.vx*=-0.4; bw.vy=-2;
      }
    }
    const q=Math.PI/2, square=Math.abs((bw.rot||0)-Math.round((bw.rot||0)/q)*q)<0.08;
    if(ground&&square&&Math.abs(bw.vx)<0.25&&Math.abs(bw.vy)<0.6) bw._rest++; else bw._rest=0;
    return bw._rest>PB.SETTLE||bw._pbT>900;
  }

  // flying push blocks don't overlap: the train shares its speed
  function separate(){
    for(let i=0;i<live.length;i++) for(let j=i+1;j<live.length;j++){
      const a=live[i], b=live[j];
      const ox=Math.min(a.x+T,b.x+T)-Math.max(a.x,b.x), oy=Math.min(a.y+T,b.y+T)-Math.max(a.y,b.y);
      if(ox<=0||oy<=0) continue;
      if(ox<oy){ const s=a.x<b.x?-1:1, m=(a.vx+b.vx)/2; if(!hitsAt(a.x+s*ox/2,a.y)) a.x+=s*ox/2; if(!hitsAt(b.x-s*ox/2,b.y)) b.x-=s*ox/2; a.vx=b.vx=m; }
      else { const s=a.y<b.y?-1:1; if(s<0){ a.y=b.y-T; if(a.vy>b.vy) a.vy=b.vy; } else { b.y=a.y-T; if(b.vy>a.vy) b.vy=a.vy; } }
    }
  }

  function tick(){
    for(let i=live.length-1;i>=0;i--){
      const bw=live[i];
      if(!bw._pb||!bw._fly||bw.hp<=0||bw._carried||BWALLS.indexOf(bw)<0){ live.splice(i,1); if(bw._pb&&bw.hp>0&&!bw._carried){ bw._pb=false; } continue; }
      if(bw.y>MV_GRID.rows*T+T*4){                                   // fell off the world: back to where it started
        live.splice(i,1); bw._fly=false; bw._pb=false; bw.vx=bw.vy=0; bw.rot=0;
        if(bw.spawnC!=null&&B.cellFree(bw.spawnC,bw.spawnR)){ bw.x=bw.spawnC*T; bw.y=bw.spawnR*T; if(!settle(bw)) bw.hp=0; } else bw.hp=0;
        continue;
      }
      if(bw.hitGlow>0) bw.hitGlow--;
      if(bw.shakeX) bw.shakeX=Math.abs(bw.shakeX)<0.5?0:-bw.shakeX*0.6;
      if(bw._sq||bw._sqV){ bw._sqV=(bw._sqV||0)*0.72-(bw._sq||0)*0.35; bw._sq=(bw._sq||0)+bw._sqV; if(Math.abs(bw._sq)<0.004&&Math.abs(bw._sqV)<0.004){ bw._sq=0; bw._sqV=0; } }
      if(step(bw)&&settle(bw)) live.splice(i,1);
    }
    separate();
  }
  B.pushLive=()=>live.slice();
  B.PUSHBLOCK=PB;

  const _up=window.update;
  window.update=function(){
    const r=_up.apply(this,arguments);
    try{ if(on()&&!B.freeze&&!B.loading){ airTick(); tick(); } }catch(er){ console.warn('pushblock',er); }
    return r;
  };
})();
