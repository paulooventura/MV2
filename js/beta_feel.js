// ============================================================
//  beta_feel.js — G · movement feel + item tweaks for the L1 beta
//
//  Paulo's notes, beta only (live Awdjoo A is untouched):
//    - Head bump: MIND tucks his head into the box like a turtle and keeps
//      his sideways momentum; brushing a ledge corner slides him past it.
//    - Running into a wall bounces him back, harder the faster he hit it.
//    - Rubber wheel: landings bounce a little, scaled by how hard he fell.
//    - XLR aimed at the floor: holding it slows a fall / lifts him; letting
//      go at full power launches him as high as a loaded (duck) jump.
//    - RCA hook latches cubes (and rides along when they move) and enemies.
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B) return;
  const T=32;
  const FEEL={
    WALL_MIN:5.2,  WALL_REST:0.42, WALL_CD:16,          // wall bounce
    LAND_MIN:7.0,  LAND_REST:0.42, LAND_MAX:6.0,        // wheel bounce
    TUCK_SLIDE:14,                                       // px of corner forgiveness on a head bump
    XLR_FULL:45,   SUPER_H:395,                          // frames to full power; loaded-jump height (px)
    HOVER_R:200,   HOVER_R_ENH:280, LAUNCH_REACH:3*T
  };
  B.FEEL=FEEL;
  const st={wallCd:0, bounceT:0, tuckT:0, lastLaunch:null};
  B.feel=st;

  const on=()=>B.on&&typeof p!=='undefined'&&p;
  function aimUnit(){ const ax=p.aimDX||0, ay=p.aimDY||0, l=Math.hypot(ax,ay)||1; return {x:ax/l, y:ay/l}; }
  // distance from the wheel's bottom to the first floor straight below (grid)
  function floorBelow(maxD){
    const feet=p.y+FEET_OFF, cx=p.x+SW/2;
    let best=maxD+1;
    for(const ox of [-12,0,12]){
      const hit=typeof gridRayHit==='function'?gridRayHit(cx+ox,feet-2,cx+ox,feet+maxD):null;
      if(hit) best=Math.min(best,hit.ty-feet);
    }
    return Math.max(0,best);
  }
  function solidCellAt(x,y){
    const c=Math.floor(x/T), r=Math.floor(y/T);
    return typeof gridSolid==='function'&&gridSolid(c,r)&&!gridIsSlope(c,r);
  }

  // ── Movement wrapper: turtle tuck, wall bounce, wheel bounce ─────
  const _origMove=window._movePlayerWithColl;
  window._movePlayerWithColl=function(pl,vx,vy){
    if(!on()||pl!==p) return _origMove.apply(this, arguments);
    // Head poking into a ceiling (the tuck relaxing under a loft): ease him down out of it
    // first, so the grid never shoves him sideways to get free.
    if(!pl.og){
      const b=gridPlayerBody(pl), r=Math.floor(b.headY/T);
      const rowSolid=(row)=>{ for(let c=Math.floor((b.x+4)/T);c<=Math.floor((b.x+b.w-4)/T);c++) if(gridSolid(c,row)&&!gridIsSlope(c,row)) return true; return false; };
      const over=(r+1)*T-b.headY;
      if(over>0&&over<14&&rowSolid(r)&&!rowSolid(r+1)){ pl.y+=over+0.5; if(pl.vy<0) pl.vy=0; if(vy<0) vy=0; }
    }
    const x0=pl.x, y0=pl.y, vx0=pl.vx, vy0=pl.vy, og0=!!pl.og;
    _origMove.call(this, pl, vx, vy);
    const movedX=pl.x-x0;
    // 1) Head bump while rising
    if(vy0<-0.6&&pl.vy>=-0.01&&!og0&&pl.y-y0>vy0+0.5){
      let slid=false;
      const body=gridPlayerBody(pl), headRow=Math.floor((body.headY-3)/T);
      const blockedAt=(dx)=>{ const L=body.x+dx+4, R=body.x+body.w+dx-4;
        for(let c=Math.floor(L/T);c<=Math.floor(R/T);c++) if(gridSolid(c,headRow)) return true; return false; };
      if(blockedAt(0)){
        // corner forgiveness: if a small sideways shift clears the head, take it and keep rising
        const pref=Math.sign(vx0)||1;
        for(const dir of [pref,-pref]){
          for(let d=4; d<=FEEL.TUCK_SLIDE; d+=2){
            if(!blockedAt(dir*d)&&!solidCellAt(pl.x+SW/2+dir*(d+body.w/2),body.headY+8)){
              pl.x+=dir*d; pl.y=y0+vy0; pl.vy=vy0; slid=true; break;
            }
          }
          if(slid) break;
        }
      }
      if(!slid){
        pl._autoHeadTuck=1; st.tuckT=16;                 // turtle: head pops into the box
        if(Math.abs(pl.vx)<Math.abs(vx0)&&Math.abs(movedX-vx0)<1.5) pl.vx=vx0;   // momentum survives the bump
        try{ sfx('omniblock_chip'); }catch(e){}
      }
    }
    // 2) Wall bounce (horizontal impact at speed)
    if(st.wallCd>0) st.wallCd--;
    if(Math.abs(vx0)>=FEEL.WALL_MIN&&st.wallCd<=0&&Math.abs(movedX)<Math.abs(vx0)*0.5&&!(pl.hook&&pl.hook.st==='on')){
      const dir=Math.sign(vx0), body=gridPlayerBody(pl);
      const fx=dir>0?body.x+body.w+3:body.x-3;
      const midY=body.feetY-44;
      if(solidCellAt(fx,midY)||solidCellAt(fx,body.feetY-70)){
        pl.vx=-vx0*FEEL.WALL_REST;
        if(pl.og) pl.vy=Math.min(pl.vy,-Math.min(3,Math.abs(vx0)*0.18));   // a little hop off the rubber
        st.wallCd=FEEL.WALL_CD; pl.suspComp=Math.max(pl.suspComp||0,6);
        try{ sfx('hit'); }catch(e){}
        for(let i=0;i<6;i++) PFXS.push({x:fx,y:midY+(Math.random()-0.5)*30,vx:-dir*(1+Math.random()*2),vy:(Math.random()-0.5)*2,life:12+Math.random()*8|0,maxLife:20,r:1.5+Math.random()*1.5,col:'#c8b8a0'});
      }
    }
    // 3) Rubber wheel landing bounce
    if(!og0&&pl.og&&vy0>=FEEL.LAND_MIN&&!(pl.hook&&pl.hook.st==='on')){
      const up=Math.min(FEEL.LAND_MAX,(vy0-FEEL.LAND_MIN*0.55)*FEEL.LAND_REST);
      if(up>0.9){
        pl.vy=-up; pl.og=false; pl._groundHold=0; st.bounceT=14;
        pl.suspComp=Math.max(pl.suspComp||0,Math.min(14,vy0*1.1));
      }
    }
  };

  // ── XLR aimed at the floor: B.on overrides the game's floor reaction ──
  const _origReact=window._applyPushWallReaction;
  window._applyPushWallReaction=function(pl,ox,oy,aimA){
    if(on()&&pl===p&&Math.sin(aimA)>0.55) return;     // beta: hover + launch handle the floor
    return _origReact.apply(this, arguments);
  };
  function xlrHover(){
    if(!(p.xlrOn&&ITEM===2)) return;
    const a=aimUnit(); if(a.y<0.55) return;
    if(p.og||(p.hook&&p.hook.st==='on')) return;
    const enh=typeof _itemEnhanced!=='undefined'&&!!_itemEnhanced[2];
    const R=enh?FEEL.HOVER_R_ENH:FEEL.HOVER_R;
    const d=floorBelow(R);
    if(d>R) return;
    const prox=1-d/R;
    if(p.vy>0) p.vy*=0.9;                              // brake the fall
    p.vy-=GRAV*(0.7+0.85*prox)*(enh?1.2:1);            // and push up off the floor
    p.vy=Math.max(p.vy,-4);
    if(fr%5===0) PFXS.push({x:p.x+SW/2+(Math.random()-0.5)*20,y:p.y+FEET_OFF+d,vx:(Math.random()-0.5)*3,vy:-1-Math.random(),life:14,maxLife:14,r:2,col:'#aaddff'});
  }
  B.onXlrRelease=function(held){
    const a=aimUnit(); if(a.y<0.55) return;
    const d=floorBelow(FEEL.LAUNCH_REACH);
    if(d>FEEL.LAUNCH_REACH) return;
    const charge=Math.min(1,held/FEEL.XLR_FULL);
    const vFull=Math.sqrt(2*GRAV*FEEL.SUPER_H);          // ballistic speed that peaks at a loaded jump
    const near=1-d/FEEL.LAUNCH_REACH*0.35;
    const v=vFull*Math.sqrt(Math.max(0.12,charge))*near;
    p.vy=Math.min(p.vy,-v); p.og=false; p._groundHold=0; p.jf=0;
    st.lastLaunch={held, charge:+charge.toFixed(2), vy:+(-v).toFixed(2), y0:p.y};
    try{ sfx(charge>=1?'jump_spring':'jump_reg'); }catch(e){}
    p.flashF=Math.max(p.flashF||0,charge>=1?12:6);
    for(let i=0;i<(charge>=1?16:8);i++){ const ang=Math.PI*(0.1+Math.random()*0.8);
      PFXS.push({x:p.x+SW/2,y:p.y+FEET_OFF+d,vx:Math.cos(ang)*(2+Math.random()*4)*(Math.random()<0.5?-1:1),vy:-Math.sin(ang)*2,life:16+Math.random()*10|0,maxLife:26,r:2+Math.random()*2,col:'#88ccff'}); }
  };

  // ── RCA hook rides along with the cube it bit; lets go when the cube breaks
  function hookOff(h){
    if(typeof _releaseHookAim==='function') _releaseHookAim(h.ax,h.ay);
    h.st='idle'; h.ox=NaN; h.oy=NaN; h.tgt=null; h.plat=null; h._tight=false; h._slack=false;
    h._path=null; h._tension=0; h.pivots=null; h.vr=null; h._cube=null; h._cubeChecked=false;
  }
  function hookTick(){
    const h=p.hook; if(!h) return;
    if(h.st!=='on'){ h._cube=null; h._cubeChecked=false; return; }
    if(h.tgt) return;                                   // enemies: the game already follows them
    if(!h._cubeChecked){
      h._cubeChecked=true;
      const px=h.ax-(h.nx||0)*4, py=h.ay-(h.ny||0)*4;
      for(const bw of B.cubes()) if(px>=bw.x-1&&px<=bw.x+T+1&&py>=bw.y-1&&py<=bw.y+T+1){ h._cube=bw; h._cdx=h.ax-bw.x; h._cdy=h.ay-bw.y; break; }
      if(!h._cube) for(const bw of BWALLS) if(bw.cube&&bw.hp>0&&bw.only==='laser'&&px>=bw.x&&px<=bw.x+T&&py>=bw.y&&py<=bw.y+T){ h._cube=bw; h._cdx=h.ax-bw.x; h._cdy=h.ay-bw.y; }
    }
    const bw=h._cube; if(!bw) return;
    if(bw.hp<=0){ hookOff(h); try{ sfx('ropeBreak'); }catch(e){} return; }
    const nx=bw.x+(bw._ox||0)+h._cdx, ny=bw.y+(bw._oy||0)+h._cdy;
    if(Math.abs(nx-h.ax)>0.01||Math.abs(ny-h.ay)>0.01){ h.ax=nx; h.ay=ny; h.ex=nx; h.ey=ny; if(h._path&&h._path[0]){ h._path[0].x=nx; h._path[0].y=ny; } }
  }

  // Enemies are short next to MIND; give the hook a forgiving grab box on them.
  const _origHookHB=window._enemyHookHB;
  if(_origHookHB) window._enemyHookHB=function(e){
    const hb=_origHookHB.apply(this, arguments);
    if(!on()||!hb) return hb;
    return {x:hb.x-10, y:hb.y-22, w:hb.w+20, h:hb.h+26};
  };
  // Switching items while hooked keeps the hook: the rope's player end moves from the
  // RCA nose to MIND's body (and back) and the rope length follows, so nothing snaps.
  const ropeEnd=()=>{ const pose=typeof computeConnectorArmPose==='function'?computeConnectorArmPose(p):null;
    return ITEM===1&&pose?{x:pose.noseX,y:pose.noseY}:hookAttachWorld(); };
  const _origCycle=window._cycleItem;
  window._cycleItem=function(){
    const h=on()&&p.hook&&p.hook.st==='on'?p.hook:null;
    const a=h?ropeEnd():null;
    const r=_origCycle.apply(this, arguments);
    if(h&&h.st==='on'){
      const b=ropeEnd();
      const piv=h.pivots&&h.pivots.length?h.pivots[h.pivots.length-1]:{x:h.ax,y:h.ay};
      h.rl=Math.max(ROPE_RL_MIN,h.rl+Math.hypot(b.x-piv.x,b.y-piv.y)-Math.hypot(a.x-piv.x,a.y-piv.y));
      h._grace=Math.max(h._grace||0,10); h.vr=null;
      if(h._path&&h._path.length) h._path[h._path.length-1]={x:b.x,y:b.y};
    }
    return r;
  };
  // While hooked with another item in hand, the arm follows the aim (the rope hangs from the body).
  const _origPose=window.computeConnectorArmPose;
  window.computeConnectorArmPose=function(pl){
    const who=pl||p;
    if(on()&&who===p&&ITEM!==1&&who.hook&&who.hook.st!=='idle'){
      const st0=who.hook.st; who.hook.st='idle';
      try{ return _origPose.apply(this, arguments); } finally{ who.hook.st=st0; }
    }
    return _origPose.apply(this, arguments);
  };

  B.feelTick=function(){
    if(!on()) return;
    xlrHover();
    hookTick();
    if(st.tuckT>0){ st.tuckT--; p._autoHeadTuck=Math.max(p._autoHeadTuck||0,st.tuckT>6?1:st.tuckT/6); }
    if(st.bounceT>0){
      st.bounceT--;
      // a jump pressed during the little landing bounce still counts as a jump
      if(typeof isJumpJ==='function'&&isJumpJ()&&(p.jf||0)===0&&!p.og){ p.vy=JI; p.jf=JMH; st.bounceT=0; try{ sfx('jump_reg'); }catch(e){} }
    }
  };
})();
