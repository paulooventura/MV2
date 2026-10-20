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
  const st={wallCd:0, bounceT:0, tuckT:0, lastLaunch:null, heat:0, coast:false, coastV:0, rope:0};
  const WT=()=>(B.WEIGHT&&B.WEIGHT.mindTotal)||9.5;     // MIND's weight (wheel + box + head + fists)
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

  // How far MIND must tuck (0 = standing tall, 1 = fully tucked) to fit under the
  // ceiling at an x offset; null if even a full tuck will not fit.
  function tuckNeeded(pl,dx){
    const feet=pl.y+FEET_OFF, cx=pl.x+SW/2+dx, L=cx-WHEEL_R+3, R=cx+WHEEL_R-3;
    const tallTop=feet-(STAND_H+WHEEL_R);
    let ceil=-1e9;
    for(let r=Math.floor((feet-WHEEL_R-2)/T); r>=Math.floor(tallTop/T)-1; r--){
      let hit=false; for(let c=Math.floor(L/T);c<=Math.floor(R/T);c++) if(gridSolid(c,r)&&!gridIsSlope(c,r)){ hit=true; break; }
      if(hit){ ceil=(r+1)*T; break; }
    }
    if(ceil<=tallTop) return 0;
    const room=feet-WHEEL_R-ceil;
    if(room<DUCK_H-1) return null;
    return Math.max(0,Math.min(1,(STAND_H-room)/(STAND_H-DUCK_H)));
  }
  B.tuckNeeded=tuckNeeded;

  // ── Movement wrapper: low-ceiling tuck, turtle tuck, wall bounce, wheel bounce ──
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
    // Low ceiling: the head sinks into the box just enough to fit, rolling in or standing under it
    const here=tuckNeeded(pl,0), ahead=pl.og&&Math.abs(vx)>0.2?tuckNeeded(pl,Math.sign(vx)*(Math.abs(vx)+6)):0;
    const need=Math.max(here||0,ahead||0);
    if(need>0){ pl.crouchAmt=Math.max(pl.crouchAmt||0,Math.min(1,need+0.03)); pl._autoHeadTuck=Math.max(pl._autoHeadTuck||0,need); st.lowCeil=6; }
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
        pl.vx=-vx0*FEEL.WALL_REST*Math.sqrt(9.5/WT());
        if(pl.og) pl.vy=Math.min(pl.vy,-Math.min(3,Math.abs(vx0)*0.18));   // a little hop off the rubber
        st.wallCd=FEEL.WALL_CD; pl.suspComp=Math.max(pl.suspComp||0,6);
        try{ sfx('hit'); }catch(e){}
        for(let i=0;i<6;i++) PFXS.push({x:fx,y:midY+(Math.random()-0.5)*30,vx:-dir*(1+Math.random()*2),vy:(Math.random()-0.5)*2,life:12+Math.random()*8|0,maxLife:20,r:1.5+Math.random()*1.5,col:'#c8b8a0'});
      }
    }
    // 3) Rubber wheel landing bounce
    if(!og0&&pl.og&&vy0>=FEEL.LAND_MIN&&!(pl.hook&&pl.hook.st==='on')){
      const up=Math.min(FEEL.LAND_MAX,(vy0-FEEL.LAND_MIN*0.55)*FEEL.LAND_REST*Math.sqrt(9.5/WT()));
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
    if(on()&&pl===p&&Math.sin(aimA)<-0.5){             // mostly up: no sideways drift while pushing blocks up
      const args=[...arguments]; args[3]=-Math.PI/2; return _origReact.apply(this, args);
    }
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
  // Throwing the rope on the move: the line between MIND and the flying hook sweeps
  // through the level, and the first grabbable surface it crosses becomes the anchor.
  function ropeSweepLatch(h){
    if(Math.hypot(p.vx||0,p.vy||0)<0.8||typeof _hookRayHit!=='function') return false;
    const a=ropePlayerEndWorld();
    const hit=_hookRayHit(a.x,a.y,h.ex,h.ey);
    if(!hit) return false;
    const d=Math.hypot(hit.tx-a.x,hit.ty-a.y);
    if(d<20||Math.hypot(h.ex-hit.tx,h.ey-hit.ty)<6) return false;   // too close to MIND, or the hook's own path (the game handles that)
    const feet=p.y+FEET_OFF;
    if((hit.ny||0)<-0.55&&Math.abs(hit.ty-feet)<14&&d<40) return false;   // the floor he's rolling on
    h.ax=hit.tx+(hit.nx||0)*2; h.ay=hit.ty+(hit.ny||0)*2; h.nx=hit.nx||0; h.ny=hit.ny||0;
    h.ex=hit.tx; h.ey=hit.ty;
    h.pivots=[]; h.vr=null;
    h.rl=Math.max(Math.hypot(h.ax-a.x,h.ay-a.y),ROPE_RL_MIN);
    h._path=[{x:h.ax,y:h.ay},{x:a.x,y:a.y}];
    h._tension=0; h._slack=true; h._tight=false; h._grace=14;
    h.tgt=null; h.plat=hit.plat||null; h.st='on';
    if(p.vy>0) p.vy*=0.2;
    try{ sfx('hook_latch'); }catch(e){}
    return true;
  }
  const _origUpdateHook=window.updateHook;
  window.updateHook=function(){
    if(on()&&p.hook&&p.hook.st==='ext'&&ropeSweepLatch(p.hook)) return;
    return _origUpdateHook.apply(this, arguments);
  };
  B.ropeSweepLatch=ropeSweepLatch;
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

  // ── Rolling off a slope: the wheel keeps its speed onto the flat and slows by
  //   rolling resistance (heavier = a touch more drag), not the walking brake.
  const ROLL={DRAG:0.995, RESIST:0.025};
  const _origMoveX=window._updatePlayerMoveX;
  window._updatePlayerMoveX=function(pl){
    if(!on()||pl!==p) return _origMoveX.apply(this, arguments);
    const vxIn=pl.vx, dir=typeof _moveInputX==='function'?_moveInputX():0;
    const grounded=!!pl.og, onSlope=!!(grounded&&pl._onSlope);
    const r=_origMoveX.apply(this, arguments);
    if(onSlope&&Math.abs(vxIn)>2) st.coast=true;
    if(st.coast){
      if(!grounded||dir===-Math.sign(vxIn)||Math.abs(vxIn)<0.3||(pl.hook&&pl.hook.st==='on')||pl.wallGrip>0){ if(grounded||Math.abs(vxIn)<0.3) st.coast=onSlope; }
      else if(!onSlope&&!dir){
        const drag=ROLL.RESIST*(WT()/9.5);
        pl.vx=Math.sign(vxIn)*Math.max(0,Math.abs(vxIn)*ROLL.DRAG-drag);
        if(Math.abs(pl.vx)<0.3){ pl.vx=0; st.coast=false; }
      }
    }
    return r;
  };

  // ── Wall cling heats the wheel: it glows orange, sizzles, and burns power.
  //   Power empty = the grip gives out.
  const HEAT={RISE:1/140, COOL:0.025, DRAIN:1.35, HOLD:25};
  function wallTick(){
    // Cling: in the air, pressing into a wall, the rubber wheel grabs it (the game's own
    // wall-grip: slow slide, charged wall jump) — for as long as the power lasts.
    if(st.clingCd>0) st.clingCd--;
    if(p.og) st.clingCd=0;
    if(!p.og&&p.wallGrip<=0&&st.clingCd<=0&&!(p.hook&&p.hook.st!=='idle')&&p.vy>-1.5&&(p.itemStamina||0)>8){
      const wt=_wallTouchInfo(p), dir=typeof _moveInputX==='function'?_moveInputX():0;
      if(wt.touch&&dir&&dir===wt.dir){ p.wallGrip=90; p.wallDir=wt.dir; p._wallChargeReady=false; p.vx=0; try{ sfx('land'); }catch(e){} }
    }
    if(p.wallGrip>0){
      st.heat=Math.min(1,st.heat+HEAT.RISE);
      p.itemStamina=Math.max(0,(p.itemStamina||0)-HEAT.DRAIN);
      if(p.itemStamina>0&&p.wallGrip<HEAT.HOLD) p.wallGrip=HEAT.HOLD;       // hold on while there is power
      if(p.itemStamina<=0){ p.wallGrip=0; p._wallChargeReady=false; p.vx=-(p.wallDir||0)*1.5; st.clingCd=9999; }   // burnt out: no grip until he lands
      if(fr%3===0) PFXS.push({x:p.x+SW/2+(p.wallDir||0)*WHEEL_R,y:p.y+FEET_OFF-WHEEL_R+(Math.random()-0.5)*20,vx:-(p.wallDir||0)*(0.5+Math.random()),vy:-0.5-Math.random()*1.5,life:10+Math.random()*8|0,maxLife:18,r:1.5,col:st.heat>0.6?'#ffd060':'#ff8030'});
      if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.sizzle(st.heat);
    }else st.heat=Math.max(0,st.heat-HEAT.COOL);
  }
  const _origDrawChar=window.drawCharacter;
  window.drawCharacter=function(){
    const r=_origDrawChar.apply(this, arguments);
    if(on()&&st.heat>0.02){
      const cx=sx(p.x+SW/2), cy=sy(p.y+FEET_OFF-WHEEL_R), R=sw(WHEEL_R);
      ctx.save(); ctx.globalCompositeOperation='lighter';
      const g=ctx.createRadialGradient(cx,cy,R*0.3,cx,cy,R*1.6);
      g.addColorStop(0,'rgba(255,170,60,'+(0.55*st.heat)+')'); g.addColorStop(0.6,'rgba(255,90,20,'+(0.35*st.heat)+')'); g.addColorStop(1,'rgba(255,60,0,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,R*1.6,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(255,'+(140+80*st.heat|0)+',60,'+(0.5+0.5*st.heat)+')'; ctx.lineWidth=sw(3); ctx.beginPath(); ctx.arc(cx,cy,R-1,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    }
    if(on()&&(st.heat>0.02||p.wallGrip>0)) meter(p.itemStamina/100,'POWER',st.heat>0.6?'#ff7030':'#ffb040',0);
    if(on()&&p.hook&&p.hook.st==='on') meter(1-Math.min(1,st.rope),'ROPE',st.rope>0.75?'#ff4040':st.rope>0.45?'#ffc040':'#60e080',p.wallGrip>0?14:0);
    return r;
  };
  function meter(f,label,col,dy){
    const cx=sx(p.x+SW/2), y=sy(p.y)-6-dy, w=sw(48);
    ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(cx-w/2-1,y-1,w+2,7);
    ctx.fillStyle=col; ctx.fillRect(cx-w/2,y,w*Math.max(0,Math.min(1,f)),5);
    (B.wtext||((f,...a)=>f(...a)))(drawText,label,cx+w/2+4,y-1,'#e8dcc0',1);
  }

  // ── RCA rope: holds about twice the strain before it snaps; a tension meter
  //   shows how close it is, it creaks as it strains and twangs when it bites or snaps.
  const ROPE_STRENGTH=1.9;
  const _origTension=window._ropeApplyTension;
  window._ropeApplyTension=function(h){
    const r=_origTension.apply(this, arguments);
    if(on()&&h===p.hook){
      const limit=Math.max(ROPE_SNAP_MIN,h.rl*ROPE_SNAP_STRETCH)*ROPE_STRENGTH;
      st.rope=(h._tension||0)/limit;
      h._tension=(h._tension||0)/ROPE_STRENGTH;              // the game's snap test now needs ~2x the strain
      if(st.rope>0.45&&window.MV_BETA_AUDIO) MV_BETA_AUDIO.creak(Math.min(1,st.rope));
    }
    return r;
  };
  let hookWas='idle';
  function ropeSounds(){
    const s0=p.hook?p.hook.st:'idle';
    if(s0==='on'&&hookWas!=='on'&&window.MV_BETA_AUDIO) MV_BETA_AUDIO.twang(true);
    if(s0==='idle'&&hookWas==='on'&&st.rope>0.9&&window.MV_BETA_AUDIO) MV_BETA_AUDIO.twang(false);
    if(s0!=='on') st.rope=0;
    hookWas=s0;
  }

  B.feelTick=function(){
    if(!on()) return;
    xlrHover();
    hookTick();
    wallTick();
    ropeSounds();
    if(st.tuckT>0){ st.tuckT--; p._autoHeadTuck=Math.max(p._autoHeadTuck||0,st.tuckT>6?1:st.tuckT/6); }
    else{
      // the head pops back out once nothing is overhead (it never stays stuck in the box)
      if(st.lowCeil>0) st.lowCeil--;
      const need=tuckNeeded(p,0)||0;
      if(need<=0.01&&st.lowCeil<=0) p._autoHeadTuck=Math.max(0,(p._autoHeadTuck||0)-0.12);
      else p._autoHeadTuck=Math.max(need,(p._autoHeadTuck||0)-0.12);
    }
    if(st.bounceT>0){
      st.bounceT--;
      // a jump pressed during the little landing bounce still counts as a jump
      if(typeof isJumpJ==='function'&&isJumpJ()&&(p.jf||0)===0&&!p.og){ p.vy=JI; p.jf=JMH; st.bounceT=0; try{ sfx('jump_reg'); }catch(e){} }
    }
  };
})();
