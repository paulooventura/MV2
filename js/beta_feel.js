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
    XLR_GRIP:0.78,                                       // share of the XLR shove the tire soaks up when driving into it
    WALL_MIN:5.2,  WALL_REST:0.42, WALL_CD:16,          // wall bounce
    LAND_MIN:4.4,  LAND_REST:0.42, LAND_MAX:6.0,        // wheel bounce
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
        st.wallCd=FEEL.WALL_CD; pl.suspVel=(pl.suspVel||0)+Math.min(0.7,Math.abs(vx0)*0.05);
        pl._tireSxV=(pl._tireSxV||0)+Math.min(6,Math.abs(vx0)*0.6); pl._tireSxDir=dir;   // the rubber flattens against the wall
        try{ sfx('hit'); }catch(e){}
        for(let i=0;i<6;i++) PFXS.push({x:fx,y:midY+(Math.random()-0.5)*30,vx:-dir*(1+Math.random()*2),vy:(Math.random()-0.5)*2,life:12+Math.random()*8|0,maxLife:20,r:1.5+Math.random()*1.5,col:'#c8b8a0'});
      }
    }
    // 3) Rubber wheel landing bounce
    if(!og0&&pl.og&&vy0>=FEEL.LAND_MIN&&!(pl.hook&&pl.hook.st==='on')){
      const up=Math.min(FEEL.LAND_MAX,(vy0-FEEL.LAND_MIN*0.55)*FEEL.LAND_REST*Math.sqrt(9.5/WT()));
      if(up>0.9){
        pl.vy=-up; pl.og=false; pl._groundHold=0; st.bounceT=14;
        pl.suspVel=(pl.suspVel||0)+Math.min(0.9,vy0*0.06);
      }
    }
  };

  // ── XLR / MAG throw MIND along the aim (8 directions) ──
  // Push: the blast goes where he aims, and he is thrown the opposite way.
  // Magnet: everything is pulled toward the aim, and so is he.
  const _origReact=window._applyPushWallReaction;
  window._applyPushWallReaction=function(pl){
    if(on()&&pl===p&&ITEM===2) return;             // the jet is the recoil, in every direction
    return _origReact.apply(this, arguments);
  };
  function unitAim(raw){
    const ax=raw?raw.x:(p.aimDX||0), ay=raw?raw.y:(p.aimDY||0), l=Math.hypot(ax,ay)||1;
    return {x:ax/l, y:ay/l};
  }
  function capSpeed(max){
    const sp=Math.hypot(p.vx,p.vy);
    if(sp>max){ p.vx*=max/sp; p.vy*=max/sp; }
  }
  function xlrJet(){
    if(!(p.xlrOn&&ITEM===2)||B._xlrTapped) return;
    if(p.hook&&p.hook.st==='on') return;
    const a=aimUnit();
    const held=p.xlrHeld||0;
    const enh=(typeof _itemEnhanced!=='undefined'&&_itemEnhanced[2])?1.12:1;
    const run=(typeof MOVE_RUN!=='undefined'?MOVE_RUN:12.4);
    // Paulo (Oct 22): on the ground, pushing with the XLR while driving INTO the push, the
    // tire fights it — it grips (most of the shove is soaked up), spins, heats up and smokes
    const inDir=(typeof isRt==='function'&&isRt())?1:(typeof isLf==='function'&&isLf())?-1:0;
    const grounded=typeof _playerOnGround==='function'&&_playerOnGround(p);
    const resist=grounded&&Math.abs(a.x)>0.45&&a.y>-0.6&&inDir!==0&&inDir===Math.sign(a.x);
    if(resist){
      const thrust=(1.35+Math.min(1,held/6)*0.7)*enh;
      const creep=-Math.sign(a.x)*thrust*(1-FEEL.XLR_GRIP)*2.2;
      p.vx+=(creep-p.vx)*0.72; p._xlrResistV=creep; p._xlrResistFr=fr; if(a.y>0.2) p.vy-=a.y*thrust*0.35;
      const slip=Math.abs(a.x)*thrust;
      p._tireHeat=Math.min(1,(p._tireHeat||0)+0.006*slip);
      p.wheelAngle=(p.wheelAngle||0)+inDir*0.7;
      p._burnout=6;
      const n=Math.random()<0.25+0.45*p._tireHeat?1:0;
      if(n&&p.smoke&&p.smoke.length<26) p.smoke.push({x:p.x+SW/2-inDir*10+(Math.random()-0.5)*8,y:p.y+FEET_OFF-3,vx:-inDir*(0.6+Math.random())+(Math.random()-0.5)*0.6,vy:-0.5-Math.random()*1.1,life:24+((Math.random()*14)|0),maxLife:38,r:3+Math.random()*3+p._tireHeat*3});
      if(fr%14===0) try{ sfx('tire_squeal',0.35+0.65*p._tireHeat); }catch(e){}
      if(fr%3===0) PFXS.push({x:p.x+SW/2+a.x*18,y:p.y+FEET_OFF-36+a.y*18,vx:a.x*2,vy:a.y*2,life:10,maxLife:10,r:2,col:'#aaddff'});
      return;
    }
    if(grounded&&a.y>0.55&&B.downCubeHeld) return;
    const rx=-a.x, ry=-a.y;
    const g=(typeof GRAV!=='undefined'?GRAV:0.52);
    // The shove is there on the first frames (a few G), then it stops adding
    // speed. Holding it in the air steers the arc. It does not keep a flight.
    const burst=held<=10;
    if(grounded&&Math.abs(a.x)>=0.35&&a.y<=0.55){
      const hT=rx*run*1.5*enh;
      p.vx+=(hT-p.vx)*0.78;
      p._xlrOwns=true; p._xlrJetFr=fr;
    }else if(ry<-0.35&&held<=16){
      // Paulo (Oct 22): pushing himself UP has to be immediate and strong — the blast under
      // him catapults him on the very first frame, and keeps lifting through the burst
      const pw=0.45+0.55*Math.max(0,Math.min(1,(p.itemStamina||0)/100));
      const vT=ry*14.5*enh*pw;
      p.vy=Math.min(p.vy,p.vy+(vT-p.vy)*(held<=2?1:0.85));
      p.vx+=(rx*run*1.2*enh-p.vx)*0.5;
      p.og=false; p._groundHold=0; p.jf=0;
      p._xlrOwns=true; p._xlrJetFr=fr;
    }else if(ry<-0.35&&!grounded&&held<=48){
      // still holding: a lift a touch over gravity — a controllable float that runs out
      p.vy-=g*(1.08-0.4*Math.max(0,(held-16)/32)); if(p.vy<-11) p.vy=-11;
      p._xlrOwns=true; p._xlrJetFr=fr;
    }else if(burst){
      const hT=rx*run*1.48*enh;
      const vT=ry*(ry<0?10.2:6.5)*enh;
      p.vx+=(hT-p.vx)*0.78;
      p.vy+=(vT-p.vy)*0.78;
      if(ry<-0.35){ p.og=false; p._groundHold=0; }
      p._xlrOwns=true; p._xlrJetFr=fr;
    }else if(!grounded){
      // The path snaps onto the new aim. The fall stays a fall: the leftover
      // push is under one G, so holding it cannot keep a backwards flight.
      const hT=rx*run*0.48*enh;
      p.vx+=(hT-p.vx)*0.62;
      p.vy+=ry*g*0.72;
      p._xlrOwns=true; p._xlrJetFr=fr;
    }
    if(fr%3===0) PFXS.push({x:p.x+SW/2+a.x*18,y:p.y+FEET_OFF-36+a.y*18,vx:a.x*3.2,vy:a.y*3.2,life:8,maxLife:8,r:2.4,col:'#aaddff'});
  }
  function magJet(){
    if(!(p.magOn&&ITEM===3)||p._magWorldStick||B.magLock) return;
    if(p.hook&&p.hook.st==='on') return;
    // Paulo (Oct 21): standing on the ground and holding the magnet doesn't throw
    // MIND anywhere — the pull only carries him once he's in the air
    if(typeof _playerOnGround==='function'&&_playerOnGround(p)) return;
    const a=aimUnit();
    const charge=Math.min(1,(p.magHeld||0)/FEEL.XLR_FULL);
    const thrust=(0.5+charge*1.05)*(typeof _itemEnhanced!=='undefined'&&_itemEnhanced[3]?1.25:1);
    p.vx+=a.x*thrust; p.vy+=a.y*thrust;            // along the aim (the pull)
    if((p.magHeld||0)>3){ p.og=false; p._groundHold=0; }
    capSpeed(7+charge*5.5);
    if(fr%4===0) PFXS.push({x:p.x+SW/2-a.x*16,y:p.y+FEET_OFF-36-a.y*16,vx:a.x*2,vy:a.y*2,life:10,maxLife:10,r:2,col:'#e0c070'});
  }
  // the tire cools when it isn't fighting (called from feelTick)
  function tireCool(){ if(p._burnout>0) p._burnout--; else if(p._tireHeat>0) p._tireHeat=Math.max(0,p._tireHeat*0.985-0.0008); }
  B.onXlrRelease=function(held){
    const la=B.xlrAim, a=unitAim(la);
    const charge=Math.min(1,held/FEEL.XLR_FULL);
    const vFull=Math.sqrt(2*GRAV*FEEL.SUPER_H);
    const pw=B.relPow==null?1:Math.max(0,Math.min(1,B.relPow));   // Paulo (Oct 21): the launch follows the power bar
    const rx=-a.x, ry=-a.y, up=ry<-0.5;
    const v=vFull*Math.sqrt(Math.max(up?0.45:0.18,charge))*(up?0.9:0.62)*pw;   // upward launches hit harder (Paulo, Oct 22)
    const along=p.vx*rx+p.vy*ry;
    const add=Math.max(0,v-Math.max(0,along));
    p.vx+=rx*add; p.vy+=ry*add;
    capSpeed(Math.max(16,Math.hypot(p.vx,p.vy)));
    p.og=false; p._groundHold=0; p.jf=0;
    st.lastLaunch={held, charge:+charge.toFixed(2), vx:+(p.vx).toFixed(2), vy:+(p.vy).toFixed(2), y0:p.y};
    try{ sfx(charge>=1?'jump_spring':'jump_reg'); }catch(e){}
    try{ if(window.MV_AIRBLAST) MV_AIRBLAST.boom(Math.max(0.35,charge)*pw); }catch(e){}
    p.flashF=Math.max(p.flashF||0,charge>=1?12:6);
    for(let i=0;i<(charge>=1?14:7);i++){
      const ang=Math.atan2(a.y,a.x)+(Math.random()-0.5)*0.8;
      PFXS.push({x:p.x+SW/2+a.x*12,y:p.y+FEET_OFF-40+a.y*12,vx:Math.cos(ang)*(2+Math.random()*4),vy:Math.sin(ang)*(2+Math.random()*3),life:14+Math.random()*8|0,maxLife:22,r:2,col:'#88ccff'});
    }
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
  const ropeEnd=()=>ropePlayerEndWorld();                 // physics end: the RCA's pull point, or the clip on the disc
  // the drawn end of the rope: the jack in MIND's hand (RCA out) or the clip on his body
  const visEnd=()=>{ if(_ropeInHand()){ const pose=computeConnectorArmPose(p); return pose.worldNose||{x:pose.noseX,y:pose.noseY}; } return hookAttachWorld(); };
  // Paulo (Oct 21): switching items while hooked, MIND takes the rope and clips it onto his
  // body (or unclips it back into his hand) — a short animation of the plug travelling
  const CLIP_FR=16;                                          // a quick reach back and a plug-in
  B.ropeClip=null;
  // Paulo (Oct 22): the RCA stays on the arm while hooked. Only when he SWITCHES to another
  // item does the other (glove) hand reach over, pull the jack off the arm, carry it up over
  // his head — elbow to the sky — and plug it into the top back of the box. Then he swings
  // from there with the new item in hand.
  const PLUG_FR=26, GRAB=0.3, PIN=44.5*0.7, BOOT=18*0.7;
  const SEAT=()=>p.fc?0.55:Math.PI-0.55;                     // the angle the plug seats at (as render.js draws it)
  B.ropeClipPoint=function(){
    const c=B.ropeClip; if(!c) return null;
    if(c.toBody&&c.rel){
      const k=Math.min(1,c.t/PLUG_FR), A={x:p.x+c.rel.dx, y:p.y+c.rel.dy};
      if(k<GRAB) return {x:A.x, y:A.y, k:0, ang:c.ang0, toBody:true, grab:true, gk:k/GRAB};
      const u=(k-GRAB)/(1-GRAB), e=u*u*(3-2*u), Bp=hookAttachWorld();
      const C={x:p.x+SW/2+(p.fc?-1:1)*4, y:Bp.y-62};         // over the top of his head
      const x=(1-e)*(1-e)*A.x+2*(1-e)*e*C.x+e*e*Bp.x, y=(1-e)*(1-e)*A.y+2*(1-e)*e*C.y+e*e*Bp.y;
      return {x, y, k:e, ang:c.ang0, toBody:true};
    }
    const k=Math.min(1,c.t/CLIP_FR), e=k*k*(3-2*k);
    const A=c.toBody?c.from:hookAttachWorld(), Bp=c.toBody?hookAttachWorld():visEnd();
    const lift=Math.sin(e*Math.PI)*(c.toBody?8:16);         // a short carry, then it seats
    const ang=Math.atan2(Bp.y-A.y,Bp.x-A.x);
    return {x:A.x+(Bp.x-A.x)*e, y:A.y+(Bp.y-A.y)*e-lift, k:e, ang, toBody:!!c.toBody};
  };
  // on a latch with the RCA in hand: the plug comes off the arm and seats in the top back
  window._ropePlugOnLatch=function(){};                     // latching keeps the jack on the arm now
  // the glove hand during the plug-in: where it is and where its elbow goes (world coords)
  B.gloveReach=function(shX,shY){
    if(!on()) return null;
    const c=B.ropeClip; let hx, hy, up=true, w=1;
    const grip=(q,ang)=>({x:q.x-Math.cos(ang)*(PIN+BOOT*0.5), y:q.y-Math.sin(ang)*(PIN+BOOT*0.5)});
    const fd=p.fc?1:-1, gx=shX+fd*12, gy=shY+14;              // the guard fist
    if(c&&c.toBody&&c.rel&&p.hook&&p.hook.st==='on'){
      const q=B.ropeClipPoint(), ang=q.ang*(1-q.k)+SEAT()*q.k, g=grip(q,ang);
      if(q.grab){ const e=q.gk*q.gk*(3-2*q.gk); hx=gx+(g.x-gx)*e; hy=gy+(g.y-gy)*e; up=false; }
      else { hx=g.x; hy=g.y; }
    }else if(B.magPark&&B.magPark.st==='plug'&&B.magCordEnd){      // the magnet's cord: same reach, over the head, into the socket
      const q=B.magCordEnd();
      if(q.grab){ const e=q.gk*q.gk*(3-2*q.gk); hx=gx+(q.x-gx)*e; hy=gy+(q.y-gy)*e; up=false; }
      else { hx=q.x; hy=q.y-4; }
    }else if(p._plugArchT>0&&((p.hook&&p.hook.st==='on'&&!_ropeInHand())||(B.magPark&&B.magPark.st==='parked'))){
      const g=(B.magPark&&!(p.hook&&p.hook.st==='on'))?(()=>{ const S=hookAttachWorld(); return {x:S.x,y:S.y-4}; })():grip(hookAttachWorld(),SEAT()); w=Math.min(1,p._plugArchT/5);
      hx=gx+(g.x-gx)*w; hy=gy+(g.y-gy)*w;
    }else return null;
    const dx=hx-shX, dy=hy-shY, d=Math.hypot(dx,dy)||1, L=Math.max(18,d*0.5+(up?11:4)), hh=Math.sqrt(Math.max(0,L*L-d*d/4));
    const mx=shX+dx/2, my=shY+dy/2, nx=-dy/d, ny=dx/d;
    let e1={x:mx+nx*hh,y:my+ny*hh}, e2={x:mx-nx*hh,y:my-ny*hh};
    if((e1.y<e2.y)!==up){ const t=e1; e1=e2; e2=t; }           // elbow up (over the head) or down (the reach)
    const lift=up?w:0;
    return {hx, hy, ex:e1.x, ey:e1.y-6*lift, up};
  };
  function clipTick(){
    const c=B.ropeClip; if(!c) return;
    if(!(p.hook&&p.hook.st==='on')){ B.ropeClip=null; return; }
    if(c.latch&&c.t+1>=CLIP_FR&&!p.hook._plugged){              // seated: the rope now runs from the socket
      const h=p.hook, a=ropeEnd(); h._plugged=true; const b=ropeEnd();
      const piv=h.pivots&&h.pivots.length?h.pivots[h.pivots.length-1]:{x:h.ax,y:h.ay};
      h.rl=Math.max(ROPE_RL_MIN,h.rl+Math.hypot(b.x-piv.x,b.y-piv.y)-Math.hypot(a.x-piv.x,a.y-piv.y));
      h._grace=Math.max(h._grace||0,10); h.vr=null; h._cord=null;
      p._plugArchT=10;                                           // hold the arched arm a beat
    }
    if(c.rel){ c.grab=c.t<PLUG_FR*GRAB; if(c.t===Math.round(PLUG_FR*GRAB)) try{ sfx('grap_attach'); }catch(e){} }   // the click of the jack coming off
    if(++c.t>=(c.rel?PLUG_FR:CLIP_FR)){ B.ropeClip=null; if(c.rel) p._plugArchT=12; try{ sfx('grap_attach'); }catch(e){}
      const q=hookAttachWorld(); for(let k=0;k<6;k++) PFXS.push({x:q.x,y:q.y,vx:(Math.random()-0.5)*2,vy:-Math.random()*1.5,life:10,maxLife:10,r:1.5,col:'#e0e0ff'}); }
  }
  B.clipTick=clipTick;
  const _origCycle=window._cycleItem;
  window._cycleItem=function(){
    const h=on()&&p.hook&&p.hook.st==='on'?p.hook:null;
    const a=h?ropeEnd():null, av=h?visEnd():null, wasRca=_ropeInHand();
    let ang0=0; if(h&&wasRca){ try{ const ps=computeConnectorArmPose(p); ang0=ps.armA1!=null&&ps.useElbow?ps.armA1:(ps.aimAngle!=null?ps.aimAngle:Math.atan2(p.aimDY||0,p.aimDX||1)); }catch(e){} }
    const r=_origCycle.apply(this, arguments);
    if(h&&h.st==='on'&&wasRca!==_ropeInHand()) B.ropeClip=wasRca?{t:0, toBody:true, from:av, rel:{dx:av.x-p.x, dy:av.y-p.y}, ang0, grab:true}:{t:0, toBody:false, from:av};
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
    const latchCarry=!!(B.ropeClip&&B.ropeClip.latch);
    if(on()&&who===p&&(!_ropeInHand()||latchCarry)&&who.hook&&who.hook.st!=='idle'){
      const st0=who.hook.st; who.hook.st='idle';
      const q=B.ropeClip&&B.ropeClipPoint?B.ropeClipPoint():null, ax0=who.aimDX, ay0=who.aimDY;
      if(false){                                // (the glove hand does the carrying now: B.gloveReach)
        const shx=who.x+SW/2+(who.fc?1:-1)*BODY_W*0.42;
        const shy=who.y+FEET_OFF-STAND_H-WHEEL_R+10+BODY_H*0.22;
        who.aimDX=q.x-shx; who.aimDY=q.y-shy;
      }
      let r;
      try{ r=_origPose.apply(this, arguments); } finally{ who.hook.st=st0; who.aimDX=ax0; who.aimDY=ay0; }
      // Paulo (Oct 22): reaching over the top to plug into the back, the arm arches up —
      // the elbow points at the sky by the frame the jack seats, and holds it a beat
      const arch=0;                             // the arch is the glove arm's now
      if(r&&arch>0.02){
        const sock=hookAttachWorld(), tx=q&&q.toBody?q.x:sock.x, ty=(q&&q.toBody?q.y:sock.y)-10;
        const ex=(r.connShX+tx)/2, ey=Math.min(r.connShY,ty)-10-20*arch;
        const a0=Math.atan2(ey-r.connShY,ex-r.connShX), a1=Math.atan2(ty-ey,tx-ex);
        const k=Math.min(1,arch*1.4);
        const mix=(u,v)=>u+(v-u)*k;
        r=Object.assign({},r,{elbowX:mix(r.elbowX,ex),elbowY:mix(r.elbowY,ey),tipX:mix(r.tipX,tx),tipY:mix(r.tipY,ty),
          armA0:Math.atan2(mix(r.elbowY,ey)-r.connShY,mix(r.elbowX,ex)-r.connShX),armA1:Math.atan2(mix(r.tipY,ty)-mix(r.elbowY,ey),mix(r.tipX,tx)-mix(r.elbowX,ex)),
          useElbow:true});
        r.armL0=Math.hypot(r.elbowX-r.connShX,r.elbowY-r.connShY); r.armL1=Math.hypot(r.tipX-r.elbowX,r.tipY-r.elbowY); r.aimAngle=r.armA1;
      }
      return r;
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
    const jet=!!(pl._xlrOwns&&pl._xlrJetFr===fr);
    const vxJet=jet?pl.vx:0;
    const r=_origMoveX.apply(this, arguments);
    if(jet) pl.vx=vxJet+Math.max(-0.85,Math.min(0.85,(pl.vx||0)-vxJet));
    if(onSlope&&Math.abs(vxIn)>2) st.coast=true;
    if(st.coast&&!jet){
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
    // Paulo (Oct 20): it only grips after he's kept pushing into the wall for
    // half a second; jump at a wall and let go of the stick and he just falls.
    // Letting go of the stick while gripping lets go of the wall.
    const dirNow=typeof _moveInputX==='function'?_moveInputX():0;
    const wtNow=!p.og?_wallTouchInfo(p):{touch:false};
    if(!p.og&&wtNow.touch&&dirNow&&dirNow===wtNow.dir) st.pushWallT=(st.pushWallT||0)+1; else st.pushWallT=0;
    if(!p.og&&p.wallGrip<=0&&st.clingCd<=0&&!(p.hook&&p.hook.st!=='idle')&&(p.itemStamina||0)>8&&st.pushWallT>=30){
      p.wallGrip=90; p.wallDir=wtNow.dir; p._wallChargeReady=false; p.vx=0; try{ sfx('land'); }catch(e){}
    }
    if(p.wallGrip>0&&dirNow!==p.wallDir){ st.letGoT=(st.letGoT||0)+1; if(st.letGoT>6){ p.wallGrip=0; p._wallChargeReady=false; st.letGoT=0; } } else st.letGoT=0;
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
    // (no POWER meter on MIND — Paulo, Oct 21: the PWR bar up top already shows it)
    // (no ROPE meter on MIND either — Paulo, Oct 22: the REEL bar up top has it; it turns amber/red as the cord strains)
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
      st.rope=(h._tension||0)/limit; window.MV_ROPE_STRAIN=st.rope;
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
    if(s0!=='on'){ st.rope=0; window.MV_ROPE_STRAIN=0; }
    hookWas=s0;
  }

  // ── The rope as a real cord: a verlet chain pinned at the anchor and at
  //   MIND, as long as the rope is, pulled by gravity, kept out of walls and
  //   floors (it lies on them, with friction), a little stretchy like rubber.
  //   Drawing only — the rope's pull on MIND is the game's own rope physics.
  const _origSlack=window._ropeSlackDrawPts;
  const CORD_TAUT_SLACK=16;
  function solidPt(x,y){ return typeof gridWorldSolid==='function'&&gridWorldSolid(x,y); }
  function cordPts(path,rl){
    const h=p&&p.hook; if(!h||!path||path.length<2) return path||[];
    let plen=0; for(let i=1;i<path.length;i++) plen+=Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y);
    // Paulo (Oct 22): the cord reads taut while it carries MIND — the first CORD_TAUT_SLACK px of
    // slack (the little give of a swing) are drawn straight; only real slack droops
    const slack=Math.max(0,(rl||plen)-plen-CORD_TAUT_SLACK), L=plen+slack;
    if(slack<3){ h._cord=null; return path; }                  // taut: straight along its path (round corners)
    const n=Math.max(10,Math.min(64,Math.round(L/8)));
    const A=path[0], E=path[path.length-1];
    let c=h._cord;
    if(!c||c.n!==n||c.ax!==A.x||c.ay!==A.y){                  // new rope (or re-latched): lay it along the path
      const pts=[]; for(let i=0;i<n;i++){ const t=i/(n-1); const q=typeof _pathPointAt==='function'?_pathPointAt(path,plen,plen*t):{x:A.x+(E.x-A.x)*t,y:A.y+(E.y-A.y)*t}; pts.push({x:q.x,y:q.y,px:q.x,py:q.y}); }
      c=h._cord={n,pts,ax:A.x,ay:A.y};
    }
    const P=c.pts, seg=L/(n-1);
    if(c.fr!==fr){
      c.fr=fr;
      for(let i=1;i<n-1;i++){                                   // move: inertia + gravity
        const q=P[i], vx=(q.x-q.px)*0.985, vy=(q.y-q.py)*0.985;
        q.px=q.x; q.py=q.y; q.x+=vx; q.y+=vy+0.45;
      }
      P[0].x=A.x; P[0].y=A.y; P[n-1].x=E.x; P[n-1].y=E.y;
      for(let it=0;it<14;it++){
        for(let i=0;i<n-1;i++){                                 // keep the links their length (a bit of give: rubber)
          const a=P[i], b=P[i+1], dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy)||0.001, diff=(d-seg)/d*0.5*0.9;
          const fa=i===0?0:1, fb=i+1===n-1?0:1, sum=fa+fb||1;
          a.x+=dx*diff*2*fa/sum; a.y+=dy*diff*2*fa/sum; b.x-=dx*diff*2*fb/sum; b.y-=dy*diff*2*fb/sum;
        }
        for(let i=1;i<n-1;i++){                                 // never inside rock: back out the way it came, or up onto the surface
          const q=P[i]; if(!solidPt(q.x,q.y)) continue;
          if(!solidPt(q.px,q.y)) { q.x=q.px; }
          else if(!solidPt(q.x,q.py)) { q.y=q.py; }
          else { let k=0; while(solidPt(q.x,q.y)&&k<12){ q.y-=3; k++; } }
          q.px+=(q.x-q.px)*0.6;                                 // friction against the floor / wall
        }
      }
    }
    return P.map(q=>({x:q.x,y:q.y}));
  }
  window._ropeSlackDrawPts=function(path,rl){ if(on()&&p.hook&&p.hook.st==='on') return cordPts(path,rl); return _origSlack.apply(this, arguments); };

  window.MV_FEEL_BOUNCING=()=>on()&&st.bounceT>0;           // the landing bounce takes a jump press as a ground jump
  B.feelTick=function(){
    if(!on()) return;
    tireCool();
    if(p._plugArchT>0) p._plugArchT--;
    if(p.hook&&p.hook.st!=='on'&&p.hook._cord) p.hook._cord=null;
    // still ducks with DOWN while roped to the ground
    if(p.hook&&p.hook.st==='on'&&typeof isDn==='function'&&isDn()&&_playerOnGround(p)){ p.crouchAmt=(p.crouchAmt||0)+(1-(p.crouchAmt||0))*0.28; }
    xlrJet();
    magJet();
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
