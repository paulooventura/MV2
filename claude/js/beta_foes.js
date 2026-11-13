// ============================================================
//  beta_foes.js — Awdjoo Town 1.3's new cast (Paulo's Oct 22 sheet)
//
//   E  the eye — a red pentagon with one lens. FAST, FLOATS, and SHOOTS A
//      LASER THROUGH ITS EYE: it keeps its distance, locks on (the lens
//      glows and a thin sight line shows where it'll fire), then fires a beam
//      that runs until it hits rock.
//   F  the transparent cube — FLOATS UNDERWATER, DORMANT: it hangs still and
//      nearly invisible in the water until MIND swims close (or hits it),
//      then darts at him, FAST, and rams. Out of the water it can't chase.
//   the HEPTAGON (boss) — rests on its stone bowl; FLOATS WHEN THE HERO IS
//      NEAR and SHOOTS LASERS FROM EVERY CORNER NODE: a corona of seven beams
//      that turns (telegraphed first), and volleys of bolts from the nodes in
//      turn. Under half its energy it turns faster and adds a sweeping beam.
//      Beat it and the bowl's seal gives way into the knife's chamber.
//   K  the GAUCHO KNIFE — a copper-core damascus kiritsuke: item 5 in the
//      selector. A quick slash: it cuts the vine wall, cuts enemy ropes off
//      MIND, and cuts enemies.
//   S  the SAVE-STATE item — touch it: the stage is saved and a lost life
//      comes back here.
//  Seal / vine blocks (Box kind 'seal' / 'vine') are drawn and ruled here.
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B) return;
  const T=32;
  const on=()=>B.on&&typeof p!=='undefined'&&p&&_gameState==='game';
  const solid=(x,y)=>typeof gridWorldSolid==='function'&&gridWorldSolid(x,y);
  const boxFree=(x,y,w,h)=>!(solid(x+3,y+3)||solid(x+w-3,y+3)||solid(x+3,y+h-3)||solid(x+w-3,y+h-3)||solid(x+w/2,y+h/2));
  const centre=()=>({x:p.x+SW/2, y:p.y+FEET_OFF-STAND_H*0.5});
  function clearLine(x0,y0,x1,y1){ const n=Math.ceil(Math.hypot(x1-x0,y1-y0)/12); for(let i=1;i<n;i++){ if(solid(x0+(x1-x0)*i/n,y0+(y1-y0)*i/n)) return false; } return true; }
  function rayEnd(x,y,ux,uy,max){ for(let d=6;d<=max;d+=6){ if(solid(x+ux*d,y+uy*d)) return d; } return max; }
  function segDist(px,py,x0,y0,x1,y1){ const dx=x1-x0, dy=y1-y0, L=dx*dx+dy*dy||1; const t=Math.max(0,Math.min(1,((px-x0)*dx+(py-y0)*dy)/L)); return Math.hypot(px-x0-dx*t,py-y0-dy*t); }
  let hitCd=0;
  function hurtMind(kx,ky,dmg){
    if(hitCd>0||(typeof _shutdownTimer!=='undefined'&&_shutdownTimer>0)||(p.inv>0)) return false;
    hitCd=40; if(typeof applyPlayerHit==='function') applyPlayerHit(kx,ky,dmg); return true;
  }
  // the hexagon hurts, but it does not knock the Isolator off
  function hexHurt(kx,ky,dmg){
    window._skipIsoKnock=true;
    try{ return hurtMind(kx,ky,dmg); } finally{ window._skipIsoKnock=false; }
  }
  function burst(x,y,n,cols,sp){ for(let k=0;k<n;k++){ const a=Math.random()*Math.PI*2, s=(sp||3)*(0.4+Math.random()); PFXS.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:12+Math.random()*14|0,maxLife:26,r:1.5+Math.random()*2,col:cols[k%cols.length]}); } }
  const S=(n,v)=>{ try{ sfx(n,v); }catch(e){} };

  // ── makers (hooked into beta_enemies' B.mkAiEnemy) ─────────────
  const _mk=B.mkAiEnemy;
  function base(ai,cx,feet,opts,w,h,hp){
    const e=_mk.call(B,'square',cx,feet,opts||{});
    e._ai=ai; e._betaEnemy=ai; e._foe=ai; e.type='b_'+ai; e.w=w; e.h=h; e.x=Math.round(cx-w/2); e.y=Math.round(feet-h);
    e.hp=e.mhp=hp; e.og=false; e._falling=false; e.vx=0; e.vy=0; e.homeX=e.x; e.homeY=e.y;
    return e;
  }
  B.mkAiEnemy=function(ai,cx,feet,opts){
    if(ai==='eye'){ const e=base('eye',cx,feet,opts,110,114,30); e.st='hover'; e.stT=0; e.cd=50; e.look={x:-1,y:0}; e._downed=false; return e; }
    if(ai==='cube'){ const e=base('cube',cx,feet,opts,122,122,90); e._iso=true; e.st='sleep'; e.cd=0; e.spin=0; e.zaps=[]; e.elecT=0; return e; }
    return _mk.apply(this,arguments);
  };
  function mkBoss(cx,cy){
    const e=_mk.call(B,'square',cx,cy+56,{});
    Object.assign(e,{_ai:'boss', _betaEnemy:'boss', _foe:'boss', type:'b_boss', _boss:true, _noGrab:true, _iso:true,
      w:112, h:112, x:Math.round(cx-56), y:Math.round(cy-56), hp:360, mhp:360, og:false, _falling:false, vx:0, vy:0,
      rot:0, st:'rest', stT:0, pat:0, beams:null, bolts:[], awake:false, homeX:cx, homeY:cy});
    return e;
  }

  // ── E: the eye ────────────────────────────────────────────────
  // The XLR blow steers the laser the way it steers a shot: away from the jack,
  // along the aim. A full bar starts that turn far from the tip. A low bar only
  // catches a beam that passes close to the tip, and turns it less.
  // The turn uses the closest the beam comes to the tip. (The first point inside
  // the reach is always the rim, so using that made every bend look straight.)
  function xlrWind(){
    if(!p||!p.xlrOn||(typeof ITEM!=='undefined'&&ITEM!==2)||typeof connectorTipWorld!=='function') return null;
    const tip=connectorTipWorld(2);
    if(!tip||!isFinite(tip.x)) return null;
    const pow=Math.max(0,Math.min(1,(p.itemStamina||0)/100));
    const ax=p.aimDX||(p.fc?1:-1), ay=p.aimDY||0, al=Math.hypot(ax,ay)||1;
    return {x:tip.x,y:tip.y,ax:ax/al,ay:ay/al,pow,reach:40+pow*320};
  }
  B.xlrWind=xlrWind;
  function catchBeam(ox,oy,ux,uy,len,skip){
    const w=xlrWind(); if(!w) return null;
    let entry=null, best=null, bestD=1e9;
    for(let t=skip;t<=len;t+=8){
      const x=ox+ux*t, y=oy+uy*t;
      const dx=x-w.x, dy=y-w.y, dist=Math.hypot(dx,dy);
      if(dist>w.reach) continue;
      const d=dist||1, px=dx/d, py=dy/d;
      if(px*w.ax+py*w.ay<0.02) continue;
      if(!entry) entry={x,y};
      if(dist<bestD){ bestD=dist; best={px,py,dist}; }
    }
    if(!entry||!best) return null;
    const near=1-Math.min(1,best.dist/w.reach);
    const turn=Math.min(1,(0.22+0.78*w.pow)*(0.45+0.55*near));
    let qx,qy;
    if(best.dist<10){ qx=w.ax; qy=w.ay; }
    else { qx=best.px*1.15+w.ax*0.85; qy=best.py*1.15+w.ay*0.85; }
    const ql=Math.hypot(qx,qy)||1; qx/=ql; qy/=ql;
    let nx=ux*(1-turn)+qx*turn, ny=uy*(1-turn)+qy*turn;
    const nl=Math.hypot(nx,ny)||1; nx/=nl; ny/=nl;
    const rest=rayEnd(entry.x,entry.y,nx,ny,760);
    return {x:entry.x,y:entry.y,ux:nx,uy:ny,len:rest,w};
  }
  function bendEyeBeam(e,c,ux,uy,len,blow){
    if(e._blown){ e.bend=null; return null; }
    const k=catchBeam(c.x,c.y,ux,uy,len,Math.max(e.w,e.h)*0.62);
    e.bend=k;
    if(!k||!blow) return k;
    const back=k.ux*(c.x-k.x)+k.uy*(c.y-k.y);
    if(back<36) return k;
    const n=Math.max(1,Math.ceil(k.len/12));
    for(let i=1;i<=n;i++){
      const px=k.x+k.ux*k.len*i/n, py=k.y+k.uy*k.len*i/n;
      if(px>e.x+6&&px<e.x+e.w-6&&py>e.y+6&&py<e.y+e.h-6){ blowEye(e,k.w); return k; }
    }
    return k;
  }
  function blowEye(e,w){
    if(e._blown) return;
    e._blown=true; e.beam=null; e.st='fall'; e._downed=true; e._permOff=true; e._stayDown=true; e._downs=3;
    const kick=12+8*w.pow;
    e.vx=w.ax*kick; e.vy=w.ay*kick-4.5;
    const c={x:e.x+e.w/2,y:e.y+e.h/2};
    burst(c.x,c.y,28,['#fff','#ffd0a0','#ff4020','#ff2020'],7);
    B.shake=Math.max(B.shake||0,8);
    S('enemy_shut',0.45); S('laser',0.4);
  }
  function eyeTick(e){
    const c={x:e.x+e.w/2, y:e.y+e.h/2}, P=centre(), dx=P.x-c.x, dy=P.y-c.y, d=Math.hypot(dx,dy)||1;
    const sees=d<480&&clearLine(c.x,c.y,P.x,P.y);
    if(e.cd>0) e.cd--;
    let tx=e.homeX+e.w/2+Math.sin(fr*0.02+e.phase)*70, ty=e.homeY+e.h/2+Math.sin(fr*0.031+e.phase)*30;
    if(sees){ e.aware=true; const side=dx>0?-1:1; tx=P.x+side*210; ty=P.y-70; }
    if(e.st==='hover'){
      if(sees&&e.cd<=0){ e.st='aim'; e.stT=0; S('chargeReady',1.6); }
    }else if(e.st==='aim'){
      e.stT++; e.look={x:dx/d,y:dy/d};
      const L=rayEnd(c.x,c.y,e.look.x,e.look.y,760);
      bendEyeBeam(e,c,e.look.x,e.look.y,L,false);
      if(e.stT>=32){ e.st='fire'; e.stT=0; e.beam={ux:e.look.x,uy:e.look.y}; S('laser',0.7); }
    }else if(e.st==='fire'){
      e.stT++; const b=e.beam, L=rayEnd(c.x,c.y,b.ux,b.uy,760); b.len=L;
      b.kink=bendEyeBeam(e,c,b.ux,b.uy,L,true);
      if(e._blown) return;
      const hit=b.kink
        ? (segDist(P.x,P.y,c.x,c.y,b.kink.x,b.kink.y)<26||segDist(P.x,P.y,b.kink.x,b.kink.y,b.kink.x+b.kink.ux*b.kink.len,b.kink.y+b.kink.uy*b.kink.len)<26)
        : segDist(P.x,P.y,c.x,c.y,c.x+b.ux*L,c.y+b.uy*L)<26;
      if(hit){
        const barely=Math.max(1,(p.maxHp||100)-4);
        const kx=b.kink?b.kink.ux:b.ux, ky=b.kink?b.kink.uy:b.uy;
        hurtMind(kx*6,-4,barely);
      }
      // a caught beam stays up long enough to steer; an uncaught one is still a flash
      if(e.stT>=(b.kink?48:16)){
        e.st='turned'; e.stT=0; e.beam=null; e.bend=null;
        const fx=-(b.ux>0.2?1:b.ux<-0.2?-1:(dx>0?1:-1));
        e.look={x:fx,y:0};
      }
    }else if(e.st==='turned'){
      e.stT++;
      tx=c.x+e.look.x*160; ty=c.y;
      if(e.stT>150){ e.st='hover'; e.cd=40; }
    }else if(e.st==='fall'||e._downed){
      e.vy=Math.min((e.vy||0)+0.45,11); e.vx*=0.86;
      if(boxFree(e.x,e.y+e.vy,e.w,e.h)) e.y+=e.vy; else { e.vy=0; e.y=Math.round(e.y); e.st='down'; e._downed=true; if(e._blown){ e.alive=false; e.hp=0; e._permOff=true; e._stayDown=true; e._downs=3; } }
      if(boxFree(e.x+e.vx,e.y,e.w,e.h)) e.x+=e.vx; else e.vx=0;
      return;
    }
    if(e.st==='aim'||e.st==='fire'){ tx=c.x; ty=c.y; }
    else if(e.st==='hover'&&sees) e.look={x:e.look.x+(dx/d-e.look.x)*0.2, y:e.look.y+(dy/d-e.look.y)*0.2};
    // FAST: a stiff, quick steer, capped at 5 px/frame; it slides along rock
    e.vx=(e.vx||0)*0.86+(tx-c.x)*0.012; e.vy=(e.vy||0)*0.86+(ty-c.y)*0.012;
    const sp=Math.hypot(e.vx,e.vy); if(sp>5){ e.vx*=5/sp; e.vy*=5/sp; }
    if(boxFree(e.x+e.vx,e.y,e.w,e.h)) e.x+=e.vx; else e.vx*=-0.4;
    if(boxFree(e.x,e.y+e.vy,e.w,e.h)) e.y+=e.vy; else e.vy*=-0.4;
  }
  function drawEye(e){
    const cx=sx(e.x+e.w/2), cy=sy(e.y+e.h/2), R=sw(e.w*0.55), off=!e.alive;
    ctx.save();
    if(e.beam&&e.alive){                                           // the beam, kinked where the XLR catches it
      const L=e.beam.len||600, kn=e.beam.kink, life=kn?48:16, k=Math.max(0.2,Math.min(1,(life-e.stT)/8));
      const x1=kn?sx(kn.x):cx+e.beam.ux*sw(L), y1=kn?sy(kn.y):cy+e.beam.uy*sw(L);
      const x2=kn?sx(kn.x+kn.ux*kn.len):x1, y2=kn?sy(kn.y+kn.uy*kn.len):y1;
      ctx.globalCompositeOperation='lighter'; ctx.lineCap='round';
      ctx.strokeStyle='rgba(255,60,60,'+(0.5*k)+')'; ctx.lineWidth=sw(14);
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(x1,y1); if(kn) ctx.lineTo(x2,y2); ctx.stroke();
      ctx.strokeStyle='rgba(255,220,220,'+k+')'; ctx.lineWidth=sw(4); ctx.stroke();
      ctx.globalCompositeOperation='source-over';
    }else if(e.st==='aim'&&e.alive){                               // the sight line, bent by the XLR
      const L=rayEnd(e.x+e.w/2,e.y+e.h/2,e.look.x,e.look.y,760), kn=e.bend;
      const x1=kn?sx(kn.x):cx+e.look.x*sw(L), y1=kn?sy(kn.y):cy+e.look.y*sw(L);
      const x2=kn?sx(kn.x+kn.ux*kn.len):x1, y2=kn?sy(kn.y+kn.uy*kn.len):y1;
      ctx.strokeStyle='rgba(255,'+(kn?160:80)+',80,'+(kn?0.95:(0.2+0.5*e.stT/32))+')'; ctx.lineWidth=kn?sw(4):1; ctx.setLineDash(kn?[]:[6,6]);
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(x1,y1); if(kn) ctx.lineTo(x2,y2); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.translate(cx,cy-sw(e._lift||0)+(off||e.st==='down'?0:Math.sin(fr*0.15+e.phase)*sw(2)));
    ctx.rotate(e.ang||0);                                          // down, it lies on a face (the notches, beta_enemies.js)
    // the pentagon body (the sheet: a red box with a slanted face)
    ctx.beginPath(); for(let i=0;i<5;i++){ const a=-Math.PI/2+i*Math.PI*2/5; ctx[i?'lineTo':'moveTo'](Math.cos(a)*R,Math.sin(a)*R); } ctx.closePath();
    const g=ctx.createLinearGradient(0,-R,0,R); g.addColorStop(0,off?'#5a3a3a':'#e04848'); g.addColorStop(1,off?'#2a1a1a':'#7a1018');
    ctx.fillStyle=g; ctx.fill(); ctx.strokeStyle=e.hitF>0?'#fff':'#1a0408'; ctx.lineWidth=2.5; ctx.stroke();
    ctx.strokeStyle='rgba(255,200,200,0.35)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(-R*0.6,-R*0.2); ctx.lineTo(R*0.5,-R*0.7); ctx.stroke();   // the slanted facet
    // the lens
    const lx=e.look.x*R*0.25, ly=e.look.y*R*0.25, glow=e.st==='aim'?e.stT/32:0;
    ctx.fillStyle='#16060a'; ctx.beginPath(); ctx.arc(lx*0.5,ly*0.5,R*0.38,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=off?'#402020':(glow>0?'rgb(255,'+(120+120*glow|0)+','+(120*glow|0)+')':'#ff3a3a');
    ctx.beginPath(); ctx.arc(lx,ly,R*(0.16+0.06*glow),0,Math.PI*2); ctx.fill();
    if(glow>0){ ctx.globalCompositeOperation='lighter'; ctx.fillStyle='rgba(255,90,90,'+(0.4*glow)+')'; ctx.beginPath(); ctx.arc(lx,ly,R*(0.4+0.4*glow),0,Math.PI*2); ctx.fill(); }
    ctx.restore();
  }

  // ── F: the transparent cube ───────────────────────────────────
  // T434 (Paulo, Nov 11): "heptagon foe has to look solid (white like the circular and triangular
  // ones) when we can damage it. When it's sitting idle it looks transparent, but when we get too
  // close to it, it turns solid with the electric sparks that spawn from its angle notches (6 spark
  // bubbles ... that will rise to the surface, and when it reaches the surface, the bubble bursts and
  // the electric sparks will evaporate the water pixels where the spark is). It shall take three
  // loaded punches, or a couple of laser shots (one, when loaded) to shut it down."
  //   Solid (and open to damage) while MIND is close; a hit from afar wakes it and opens 3 s.
  //   Of its 90: a loaded punch takes 30, a TRS shot 45, a loaded shot 90. Plain punches clink.
  const CUBE_VULN=180, CUBE_DMG={punch:30, shot:45, shotLoaded:90};
  function cubeHurtable(e){
    if((e.fVulnT||0)<=0) return false;
    if(knifeHit) return true;
    const sh=window._shotHitNow; if(sh) return true;
    return !!(p&&p.pt>0&&typeof _heroPunch==='function'&&(p.pCharge||0)>_heroPunch(p).loadF);   // a loaded punch
  }
  // the 6 spark bubbles: from the notches, up through the water, bursting at the surface
  const fBubbles=[];
  function cubeBubbles(e){
    const c={x:e.x+e.w/2, y:e.y+e.h/2}, R=e.w*0.56;
    for(let i=0;i<6;i++){ const an=-Math.PI/2+i*Math.PI/3+(e.spin||0)+(e.ang||0); fBubbles.push({x:c.x+Math.cos(an)*R, y:c.y+Math.sin(an)*R, vy:-0.4, t:0, ph:Math.random()*6.3}); }
  }
  function bubbleTick(){
    for(let i=fBubbles.length-1;i>=0;i--){
      const b=fBubbles[i]; b.t++;
      const wetHere=B.inWater&&B.inWater(b.x,b.y), wetAbove=B.inWater&&B.inWater(b.x,b.y-8);
      if(wetHere){ b.vy=Math.max(-2.2,b.vy-0.05); b.y+=b.vy; b.x+=Math.sin(b.t*0.15+b.ph)*0.6; }
      if(!wetHere||!wetAbove||solid(b.x,b.y-8)||b.t>420){
        let boiled=0; try{ if(B.boilAt) boiled=B.boilAt(b.x,b.y+4,0.7); }catch(er){}
        if(typeof PFXS!=='undefined') for(let k=0;k<7;k++){ const a=-Math.PI/2+(Math.random()-0.5)*2.4, s=2+Math.random()*4; PFXS.push({x:b.x,y:b.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:10+(Math.random()*10|0),maxLife:20,r:0.8+Math.random()*0.6,col:Math.random()<0.5?'#bfefff':'#fff6a0',spark:true}); }
        try{ if(typeof sfxAt==='function') sfxAt(b,'zap',1.6+Math.random()*0.4); }catch(er){}
        B.fBubblePops=(B.fBubblePops|0)+1; B.fBubbleBoil=(B.fBubbleBoil||0)+boiled;
        fBubbles.splice(i,1);
      }
    }
  }
  function drawBubbles(){
    for(const b of fBubbles){
      const x=sx(b.x), y=sy(b.y), r=Math.max(4,sw(7));
      ctx.save();
      ctx.fillStyle='rgba(180,235,255,0.18)'; ctx.strokeStyle='rgba(225,248,255,0.9)'; ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle=(b.t>>2)&1?'#fff6a0':'#ffffff'; ctx.lineWidth=1.2; ctx.beginPath();
      for(let k=0;k<4;k++){ const a=b.t*0.6+k*1.7; ctx.moveTo(x,y); ctx.lineTo(x+Math.cos(a)*r*0.8,y+Math.sin(a)*r*0.8); }
      ctx.stroke(); ctx.restore();
    }
  }
  B.fBubbles=()=>fBubbles.length;
  // T451 (Paulo, Nov 11: "the changes for the heptagon foe are still not implemented"): the water
  // is drawn over everything in it, so the solid white body came out as tinted glass. While it is
  // solid it is drawn again over the water, fading in with its solidity.
  B.drawSolidFoes=function(){
    if(typeof ENEMS==='undefined') return;
    for(const e of ENEMS){ if(!e||e._foe!=='cube'||!e.alive) continue; const k=e.fSolidK||0; if(k<0.05) continue;
      ctx.save(); ctx.globalAlpha=Math.min(1,k); try{ drawCube(e,true); }catch(er){} ctx.restore(); }
  };
  B.cubeHurtable=cubeHurtable;
  // (build 409, Paulo: "it doesn't lay on one of its sides and balances off one of the notches") at rest, alive or
  // shut down, the hexagon eases down onto its nearest flat face (its collision is its shape)
  function cubeFlat(e){ const seg=Math.PI/3, a=(e.ang||0)+(e.spin||0), want=Math.round((a-seg/2)/seg)*seg+seg/2; e.ang=a+(want-a)*0.2; e.spin=0; if(e._lift>0) e._lift*=0.7; }
  B.cubeFlat=cubeFlat;
  // (build 370) waking is something you see and hear: a boot chime and a crackle, a flash, it
  // swells and its eyes light; for the 3 s it can be hurt its rim glows gold and sparks
  function cubeWake(e){
    if(!(e._wakeT>0)) cubeBubbles(e);                              // (build 409, Paulo) every wake sends up its 6 spark bubbles (a hit from afar too)
    e.fVulnT=CUBE_VULN; e._wakeT=30;
    const c={x:e.x+e.w/2, y:e.y+e.h/2};
    try{ if(typeof sfxAt==='function'){ sfxAt(e,'enemy_boot',1.5); sfxAt(e,'zap',0.7); } else { S('enemy_boot',1.5); S('zap',0.7); } }catch(er){}
    if(typeof PFXS!=='undefined') for(let k=0;k<18;k++){ const a=Math.random()*Math.PI*2, v=2+Math.random()*3; PFXS.push({x:c.x+Math.cos(a)*e.w*0.4,y:c.y+Math.sin(a)*e.h*0.4,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:18+Math.random()*10|0,maxLife:28,r:2+Math.random()*2,col:k%3?'#bfe6ff':'#fff2a0'}); }
  }
  function cubeTick(e){
    e._fx=false;
    if(B._fBubFr!==fr){ B._fBubFr=fr; try{ bubbleTick(); }catch(er){} }
    if(e.mhp>=9999){ e.hp=e.mhp=90; }                    // (build 368) beta_enemy_f's 9999 HP stuck after its notch rules were switched off
    const c={x:e.x+e.w/2, y:e.y+e.h/2}, P=centre(), dx=P.x-c.x, dy=P.y-c.y, d=Math.hypot(dx,dy)||1;
    if(e.cd>0) e.cd--;
    e.spin+=e.st==='zap'?0.08:(e.og?0:0.008);
    e.vy=Math.min((e.vy||0)+0.42,9); e.vx=(e.vx||0)*0.82;
    if(boxFree(e.x,e.y+e.vy,e.w,e.h)) e.y+=e.vy; else e.vy=0;
    if(boxFree(e.x+e.vx,e.y,e.w,e.h)) e.x+=e.vx; else e.vx=0;
    e.og=!boxFree(e.x,e.y+2,e.w,e.h);                              // on the floor: it lies on a face — its float-spin hands over to the notches
    if(e.og&&e.st!=='zap'){ e.ang=(e.ang||0)+(e.spin||0); e.spin=0; }
    // T487 (Paulo, Nov 11): on the ground it moves by pushing on its corner notches — it rolls over
    // them, tipping up onto a corner and dropping onto the next face (a stumble, not a slide)
    if(e.og&&Math.abs(e.vx||0)>0.05){
      const R=e.w*0.5; e.ang=(e.ang||0)+(e.vx||0)/R;
      const seg=Math.PI/3, ph=((e.ang%seg)+seg)%seg-seg/2;                  // -30°..30° from lying flat on a face
      e._lift=R*(1-Math.cos(ph))*0.9;
      if(Math.abs(ph)<0.04&&Math.abs(e.vx)>0.6&&(e._thudCd||0)<=fr){ e._thudCd=fr+10; try{ if(typeof sfxAt==='function') sfxAt(e,'land',0.7); }catch(er){} }   // a face lands
    }else{ if(e._lift>0) e._lift*=0.8; if(e.og) cubeFlat(e); }      // resting: down onto its nearest flat face
    const close=d<260;
    // Paulo, Nov 4 (build 368): waking up (MIND comes close, or a hit) opens a 3 s window in
    // which it can be hurt, and only by a loaded punch, a loaded TRS shot or the kiritsuke
    if((e.fVulnT||0)>0) e.fVulnT--;
    if(close&&!e._wasClose){ cubeWake(e); }
    if(close&&e.alive) e.fVulnT=Math.max(e.fVulnT||0,2);           // T434: solid and open to damage while MIND is close
    e._wasClose=close;
    e.fSolidK=(e.fSolidK||0)+((close&&e.alive?1:0)-(e.fSolidK||0))*0.12;
    if(!close){ e.st='sleep'; e.beams=null; return; }
    if(e.cd>0){ if(e.st!=='zap') e.st='sleep'; }
    else {
      e.st='zap'; e.cd=240; e.elecT=18;
      const wet=B.inWater&&B.inWater(c.x,c.y)&&B.inWater(P.x,P.y);
      if(wet) hexHurt((dx/d)*2,-2,22);
      e.beams=[];
      for(let i=0;i<4;i++) e.beams.push({a:Math.atan2(dy,dx)+(i-1.5)*0.42, life:16});
      S('laser',0.55); S('zap',0.8);
    }
    if(e.beams){
      for(const b of e.beams){
        b.life--;
        const L=220, t=Math.max(0,Math.min(1,((P.x-c.x)*Math.cos(b.a)+(P.y-c.y)*Math.sin(b.a))/L));
        const hx=c.x+Math.cos(b.a)*L*t, hy=c.y+Math.sin(b.a)*L*t;
        if(Math.hypot(P.x-hx,P.y-hy)<24) hexHurt(Math.cos(b.a)*5,-3,18);
      }
      e.beams=e.beams.filter(b=>b.life>0);
      if(!e.beams.length&&e.st==='zap') e.st='sleep';
    }
  }
  function drawCube(e,over){
    if(!over) try{ drawBubbles(); }catch(er){}
    if(!e.alive){ e.fVulnT=0; e._wakeT=0; e.fSolidK=0; }      // T487 (Paulo, Nov 11): shut down, it stops pulsing
    const awake=e.alive&&(e.st==='hunt'||e.st==='zap'||!!e._wasClose||(e.fVulnT||0)>0);
    if(e._wakeT>0&&!over) e._wakeT--;
    const wk=(e._wakeT||0)/30, swell=1+0.18*Math.sin(Math.PI*(1-wk))*(wk>0?1:0)+((e.fVulnT||0)>0?0.03*Math.sin(fr*0.4):0);
    const cx=sx(e.x+e.w/2), cy=sy(e.y+e.h/2), R=sw(e.w*0.56)*swell;
    const a=e.alive?(awake?0.62:0.22):0.35;                        // nearly invisible while it sleeps
    if(wk>0){ ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.fillStyle='rgba(220,245,255,'+(0.5*wk)+')'; ctx.beginPath(); ctx.arc(cx,cy-sw(e._lift||0),R*(1.6-0.5*wk),0,Math.PI*2); ctx.fill(); ctx.restore(); }   // the wake flash
    ctx.save(); ctx.translate(cx,cy-sw(e._lift||0)); ctx.rotate((e.spin||0)+(e.ang||0));
    // a hexagon outline with the cube's inner edges (the sheet's drawing)
    const pts=[]; for(let i=0;i<6;i++){ const ang=-Math.PI/2+i*Math.PI/3; pts.push([Math.cos(ang)*R,Math.sin(ang)*R]); }
    ctx.beginPath(); pts.forEach((q,i)=>ctx[i?'lineTo':'moveTo'](q[0],q[1])); ctx.closePath();
    ctx.fillStyle='rgba(190,230,255,'+(a*0.35)+')'; ctx.fill();
    const sk=e.alive?(e.fSolidK||0):0;                                // T434: solid white while it can be hurt, like A and B
    if(sk>0.02){ ctx.fillStyle='rgba(246,248,252,'+(0.94*sk).toFixed(3)+')'; ctx.fill(); ctx.strokeStyle='rgba(40,50,70,'+(0.85*sk).toFixed(3)+')'; ctx.lineWidth=3; ctx.stroke(); }
    const vul=(e.fVulnT||0)>0&&e.alive;
    if(vul){ ctx.save(); ctx.strokeStyle='rgba(255,226,120,'+(0.55+0.35*Math.sin(fr*0.5))+')'; ctx.lineWidth=5; ctx.stroke(); ctx.restore(); }   // the window: it can be hurt now
    ctx.strokeStyle=e.hitF>0?'#ffffff':'rgba(230,245,255,'+(a+0.2)+')'; ctx.lineWidth=2; ctx.stroke();
    ctx.strokeStyle='rgba(230,245,255,'+a+')'; ctx.lineWidth=1.2; ctx.beginPath();
    ctx.moveTo(0,0); ctx.lineTo(pts[1][0],pts[1][1]); ctx.moveTo(0,0); ctx.lineTo(pts[3][0],pts[3][1]); ctx.moveTo(0,0); ctx.lineTo(pts[5][0],pts[5][1]); ctx.stroke();
    if(awake&&e.st!=='zap'){ const k=0.6+0.4*Math.sin(fr*0.12); ctx.fillStyle='rgba(150,230,255,'+(0.8*k)+')'; ctx.beginPath(); ctx.arc(-R*0.2,-R*0.08,R*0.07,0,Math.PI*2); ctx.arc(R*0.2,-R*0.08,R*0.07,0,Math.PI*2); ctx.fill(); }   // awake: its eyes are lit
    if(vul&&fr%3===0&&typeof PFXS!=='undefined'){ const i=(fr/3|0)%6, an=-Math.PI/2+i*Math.PI/3+(e.spin||0)+(e.ang||0), wx=e.x+e.w/2+Math.cos(an)*e.w*0.56, wy=e.y+e.h/2+Math.sin(an)*e.w*0.56; PFXS.push({x:wx,y:wy,vx:Math.cos(an)*1.2,vy:Math.sin(an)*1.2-0.4,life:10,maxLife:10,r:1.6,col:'#fff2a0'}); }   // corner sparks while it can be hurt
    if(e.st==='zap'){ ctx.fillStyle='rgba(120,220,255,0.9)'; ctx.beginPath(); ctx.arc(R*0.22,0,R*0.08,0,Math.PI*2); ctx.arc(-R*0.22,0,R*0.08,0,Math.PI*2); ctx.arc(0,R*0.22,R*0.08,0,Math.PI*2); ctx.arc(0,-R*0.22,R*0.08,0,Math.PI*2); ctx.fill(); }
    ctx.restore();
    if(e.beams&&e.alive){
      ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.lineCap='round';
      for(const b of e.beams){
        ctx.strokeStyle='rgba(140,220,255,'+(b.life/16)+')'; ctx.lineWidth=sw(4);
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(b.a)*sw(220), cy+Math.sin(b.a)*sw(220)); ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ── the HEPTAGON ──────────────────────────────────────────────
  const NODES=7;
  function nodePos(e,i){ const c={x:e.x+e.w/2,y:e.y+e.h/2}, a=e.rot+i*Math.PI*2/NODES-Math.PI/2; return {x:c.x+Math.cos(a)*56, y:c.y+Math.sin(a)*56, a}; }
  // Paulo, Nov 13: "Let's have the boss have more animated stuff. The laughter sfx. When we hit it with the knife it
  // recoils back, and it also tries to avoid it when we slash it. It should also become more red and its
  // projectiles/lasers should shoot more constantly, and they should gradually deal more damage the closer we
  // are from eliminating the boss." rage = how much of it is gone (0 full .. 1 nearly down).
  function bossRage(e){ return Math.max(0,Math.min(1,1-e.hp/(e.mhp||1))); }
  // Paulo, Nov 13: down for good, the heptagon doesn't balance on a corner: it falls, turns onto its nearest flat
  // side and sits flush on the floor (its collision is its shape), eyes "X X"
  function bossRest(e){
    const R=56, apo=R*Math.cos(Math.PI/NODES), cx=e.x+e.w/2;
    let best=null, bd=1e9; for(let i=0;i<NODES;i++){ let t=Math.PI-(i+0.5)*Math.PI*2/NODES; while(t-e.rot>Math.PI) t-=Math.PI*2; while(t-e.rot<-Math.PI) t+=Math.PI*2; const dd=Math.abs(t-e.rot); if(dd<bd){ bd=dd; best=t; } }
    e.rot+=(best-e.rot)*0.12;
    let fy=null; for(let y=e.y+e.h/2;y<e.y+e.h/2+2000;y+=4){ if(solid(cx,y)||solid(cx-R*0.5,y)||solid(cx+R*0.5,y)){ fy=y; break; } }
    if(fy==null){ e.vy=Math.min((e.vy||0)+0.5,12); e.y+=e.vy; return; }
    const want=fy-apo-e.h/2;
    if(e.y<want-1){ e.vy=Math.min((e.vy||0)+0.5,12); e.y=Math.min(want,e.y+e.vy); if(e.y>=want){ e.vy=0; B.shake=Math.max(B.shake||0,5); } }
    else { e.y+=(want-e.y)*0.3; e.vy=0; }
    e.vx=0; e.beams=null;
  }
  B.bossRest=bossRest;
  function bossTick(e){
    if(!e.alive){ bossRest(e); return; }
    const c={x:e.x+e.w/2, y:e.y+e.h/2}, P=centre(), dx=P.x-c.x, d=Math.hypot(dx,P.y-c.y);
    const near=d<620, rage=bossRage(e);
    // Paulo, Nov 13: exact damage — a pellet like foe A's (12), a notch laser a third of the bar (33), the foe-E
    // beam three quarters (75); the elevator's floor scaling doesn't touch them. A kiritsuke in a beam's path
    // turns it: MIND takes nothing and the boss takes half of what he would have (once per firing).
    const hm=(kx,ky,dmg)=>{ window._mvExactDmg=true; let ok=false; try{ ok=hurtMind(kx,ky,dmg); } finally{ window._mvExactDmg=false; } if(ok&&(e._laughCd||0)<fr){ e._laughCd=fr+200; e._mockT=60; e._mockLine=GLOAT[(e._gl=(e._gl|0)+1)%GLOAT.length]; try{ laugh(e); }catch(er){} } return ok; };
    // T466 (Paulo, Nov 11): three phases. 1: full to 2/3 HP, only the small ball projectiles.
    // 2: 2/3 to 1/3, balls + the notch lasers. 3: the last third, it gets really angry and moves
    // faster, with both of those AND foe E's powerful laser beam (aimed at MIND, then fired).
    const ph=e.hp>e.mhp*2/3?1:e.hp>e.mhp/3?2:3, hard=ph===3;
    if(e.phase!==ph){ const was=e.phase; e.phase=ph; if(was){ B.shake=Math.max(B.shake||0,ph===3?12:7); S('enemy_boot',ph===3?0.5:0.7); S('zap',0.6);
      burst(e.x+e.w/2,e.y+e.h/2,ph===3?40:24,['#ff3040','#ffd0d0','#ffffff'],ph===3?7:5); e.st='gap'; e.stT=0; e.beams=null; e.pat=-1; } }
    if((near||B.bossOn)&&!e.awake){ e.awake=true; B.shake=Math.max(B.shake||0,4); }
    if(!near&&!B.bossOn&&d>980&&e.awake) e.awake=false;
    // FLOATS WHEN THE HERO IS NEAR — otherwise it settles into its bowl
    const restY=e.homeY+150, tx=e.awake?Math.max(e.xMin!=null?e.xMin:58*T,Math.min(e.xMax!=null?e.xMax:78*T,P.x)):e.homeX, ty=e.awake?e.homeY-30+Math.sin(fr*0.025)*40:restY;
    const spd=(hard?2.4:1)*(1+0.5*rage);
    // the knife coming: wound up near it, or a slash in the air — it darts away (once every couple of seconds)
    const kThreat=!!(B.knifeHeat&&B.knifeHeat()>0.12)||!!(B.knifeBig&&B.knifeBig())||!!(B.knifePose&&B.knifePose().swing);
    if(e._dodgeCd>0) e._dodgeCd--;
    if(e.awake&&kThreat&&!e._threatWas&&d<360&&!(e._dodgeCd>0)&&Math.random()<0.45+0.4*rage){
      const away=-Math.sign(dx)||1; e.vx=(e.vx||0)+away*(9+5*rage); e.vy=(e.vy||0)-(4+3*Math.random()); e._dodgeT=26; e._dodgeCd=Math.round(150-50*rage);
      S('punch_whiff',0.5); B.bossDodges=(B.bossDodges|0)+1; }
    e._threatWas=kThreat;
    if(e._recoilT>0||e._dodgeT>0){ if(e._recoilT>0) e._recoilT--; if(e._dodgeT>0) e._dodgeT--; e.vx*=0.9; e.vy*=0.9; e.rot+=(e.vx||0)*0.004; }
    else{ e.vx=(e.vx||0)*0.92+(tx-c.x)*0.0025*spd; e.vy=(e.vy||0)*0.9+(ty-c.y)*0.006*spd; }
    if(e.xMin!=null&&e.x+e.w/2<e.xMin*1-40&&e.vx<0) e.vx*=-0.5; if(e.xMax!=null&&e.x+e.w/2>e.xMax+40&&e.vx>0) e.vx*=-0.5;
    e.x+=e.vx; e.y+=e.vy;
    // a laugh now and then while it's fighting
    if(e.awake&&e.alive&&fr>(e._tauntAt||0)){ if(e._tauntAt){ e._mockT=70; e._mockLine=TAUNT[(e._tn=(e._tn|0)+1)%TAUNT.length]; try{ laugh(e); }catch(er){} } e._tauntAt=fr+540+Math.floor(Math.random()*300); }
    if(e.awake) e.rot+=hard?0.035:ph===2?0.016:0.01;                   // asleep in the bowl it lies still on a face
    if(!e.awake){ e.beams=null; return; }
    // contact
    if(d<70) hm(Math.sign(dx)*8,-6,16);
    // the attack cycle
    e.stT++;
    const PATS=ph===1?['volley']:ph===2?['volley','corona']:['volley','corona','eyebeam'];
    if(e.st==='rest'||e.st==='gap'){ if(e.stT>Math.round((hard?32:ph===2?60:80)*(1-0.55*rage))){ e.pat=((e.pat|0)+1)%PATS.length; e.st=PATS[e.pat]; e.stT=0; } }
    else if(e.st==='eyebeam'){                                     // foe E's beam: it tracks MIND (dashed), locks, fires thick
      const tel=40, fire=48;
      if(e.stT<=tel){ const ax=P.x-c.x, ay=P.y-c.y, al=Math.hypot(ax,ay)||1; e._eb={ux:ax/al, uy:ay/al}; }
      const ux=e._eb.ux, uy=e._eb.uy, L=rayEnd(c.x,c.y,ux,uy,1100);
      e.beams={tel:e.stT<tel, k:e.stT<tel?e.stT/tel:1-(e.stT-tel)/fire, list:[{x:c.x,y:c.y,ux,uy,L,big:true}]};
      if(e.stT===tel){ S('laser',0.35); S('zap',0.5); B.shake=Math.max(B.shake||0,7); }
      if(!e.beams.tel&&segDist(P.x,P.y,c.x,c.y,c.x+ux*L,c.y+uy*L)<34){ if(!beamTurned(e,c.x,c.y,ux,uy,L,75)) hm(ux*8,-5,75); }
      if(e.stT>=tel+fire){ e.st='gap'; e.stT=0; e.beams=null; }
    }
    else if(e.st==='corona'){                                      // a corona of 7 beams: telegraphed, then it fires and turns
      const tel=hard?34:46, fire=hard?70:55;
      e.beams={tel:e.stT<tel, k:e.stT<tel?e.stT/tel:1-(e.stT-tel)/fire, list:[]};
      for(let i=0;i<NODES;i++){ const n=nodePos(e,i), ux=Math.cos(n.a), uy=Math.sin(n.a); const L=rayEnd(n.x,n.y,ux,uy,900); e.beams.list.push({x:n.x,y:n.y,ux,uy,L});
        if(!e.beams.tel&&segDist(P.x,P.y,n.x,n.y,n.x+ux*L,n.y+uy*L)<22){ if(!beamTurned(e,n.x,n.y,ux,uy,L,33)) hm(ux*6,-4,33); } }
      if(e.stT===tel){ S('laser',0.5); B.shake=Math.max(B.shake||0,4); }
      if(e.stT>=tel+fire){ e.st='gap'; e.stT=0; e.beams=null; }
    }else if(e.st==='volley'){                                     // the nodes fire bolts at him, one after another
      const every=Math.max(3,Math.round((hard?5:7)*(1-0.35*rage))), rounds=(hard?2:1)+(rage>0.5?1:0);
      if(e.stT%every===0&&e.stT<=every*NODES*rounds){ const i=(e.stT/every|0)%NODES, n=nodePos(e,i), bx=P.x-n.x, by=P.y-n.y, bd=Math.hypot(bx,by)||1;
        const bs=(hard?7.5:6)*(1+0.3*rage); e.bolts.push({x:n.x,y:n.y,vx:bx/bd*bs,vy:by/bd*bs,life:140}); S('laser',1.6); }
      if(e.stT>every*NODES*rounds+20){ e.st='gap'; e.stT=0; }
    }else if(e.st==='sweep'){                                      // under half: one big beam sweeps across the arena
      const a=Math.PI*0.15+Math.PI*0.7*(e.stT/120)*(e.sweepDir||1);
      const ux=Math.cos(Math.PI/2+(e.sweepDir||1)*(-Math.PI*0.45+Math.PI*0.9*e.stT/120)), uy=Math.abs(Math.sin(Math.PI/2+(-Math.PI*0.45+Math.PI*0.9*e.stT/120)));
      const L=rayEnd(c.x,c.y,ux,uy,900); e.beams={tel:e.stT<30, k:e.stT<30?e.stT/30:1, list:[{x:c.x,y:c.y,ux,uy,L,big:true}]};
      if(!e.beams.tel&&segDist(P.x,P.y,c.x,c.y,c.x+ux*L,c.y+uy*L)<34){ if(!beamTurned(e,c.x,c.y,ux,uy,L,33)) hm(ux*7,-5,33); }
      if(e.stT>=120){ e.st='gap'; e.stT=0; e.beams=null; e.sweepDir=-(e.sweepDir||1); }
    }
    for(let i=e.bolts.length-1;i>=0;i--){ const b=e.bolts[i]; b.x+=b.vx; b.y+=b.vy; b.life--;
      if(b.life<=0||solid(b.x,b.y)){ burst(b.x,b.y,5,['#ff8080','#ffd0d0'],2); e.bolts.splice(i,1); continue; }
      if(Math.hypot(b.x-P.x,b.y-P.y)<26){ hm(b.vx*0.8,-3,12); e.bolts.splice(i,1); } }
  }
  // the blade in a beam: the beam stops on it (MIND is shielded) and runs back into the boss at half strength
  function beamTurned(e,x0,y0,ux,uy,L,dmg){
    // (build 410, Paulo: "the boss is almost not doing any damage") only a SWING turns a beam: holding the knife near
    // the beam's path used to shield MIND nearly all the time (beams aimed at him pass by his hand)
    if(!(B.knifeSwinging&&B.knifeSwinging())) return false;
    const bl=B.knifeBlade&&B.knifeBlade(); if(!bl) return false;
    const ex=bl.hx+Math.cos(bl.aw)*60, ey=bl.hy+Math.sin(bl.aw)*60;
    let hit=false; for(let k=0;k<=6&&!hit;k++){ const t=k/6, qx=bl.hx+(ex-bl.hx)*t, qy=bl.hy+(ey-bl.hy)*t; if(segDist(qx,qy,x0,y0,x0+ux*L,y0+uy*L)<14) hit=true; }
    if(!hit) return false;
    if(fr%3===0) burst(bl.hx+(ex-bl.hx)*0.5,bl.hy+(ey-bl.hy)*0.5,6,['#ffffff','#ffd060','#ff8080'],4);
    const key=e.stT+'|'+e.st; if(e._turnedKey!==e.st+e.pat+'|'+Math.floor(fr/120)){ e._turnedKey=e.st+e.pat+'|'+Math.floor(fr/120);
      knifeHit=true; window._knifeHitNow=true; try{ if(typeof _damageEnemy==='function') _damageEnemy(e,Math.round(dmg/2),x0,y0,0.2); } finally{ knifeHit=false; window._knifeHitNow=false; }
      S('omniblock_chip',0.8); B.beamsTurned=(B.beamsTurned|0)+1; }
    return true;
  }
  function bossDefeat(e){
    if(e._defeated) return; e._defeated=true; B.bossDown=true; B.bossOn=false;
    e._shorted=true; e._permOff=true; e.beams=null; e.bolts=[];
    const c={x:e.x+e.w/2,y:e.y+e.h/2};
    for(let k=0;k<6;k++) setTimeout(()=>{ burst(c.x+(Math.random()-0.5)*90,c.y+(Math.random()-0.5)*90,30,['#ffffff','#ff6060','#ffd060','#c080ff'],6); B.shake=Math.max(B.shake||0,10); S('enemy_shut',0.6+k*0.1); },k*180);
    // the bowl's seal gives way
    setTimeout(()=>{
      for(const bw of BWALLS){ if(bw.only!=='seal'||bw.hp<=0) continue; bw.hp=0;
        try{ if(typeof gridSmashCell==='function'&&bw.homeCol!=null) gridSmashCell(bw.homeCol,bw.homeRow); }catch(er){}
        burst(bw.x+16,bw.y+16,6,['#a0a0b0','#606070','#d0d0e0'],3); }
      B.shake=Math.max(B.shake||0,14); S('omniblock_break');
      if(typeof uiShowToast==='function') uiShowToast('THE HEPTAGON FALLS - THE BOWL GIVES WAY');
    },1300);
  }
  function drawBoss(e){
    const cx=sx(e.x+e.w/2), cy=sy(e.y+e.h/2)-sw(e._lift||0), R=sw(56), off=!e.alive;
    ctx.save();
    // beams / telegraphs
    if(e.beams&&!off){
      ctx.globalCompositeOperation='lighter'; ctx.lineCap='round';
      for(const b of e.beams.list){
        const x0=sx(b.x), y0=sy(b.y), x1=sx(b.x+b.ux*b.L), y1=sy(b.y+b.uy*b.L);
        if(e.beams.tel){ ctx.strokeStyle='rgba(255,120,120,'+(0.15+0.45*e.beams.k)+')'; ctx.lineWidth=1.2; ctx.setLineDash([8,8]); ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke(); ctx.setLineDash([]); }
        else{ const w=b.big?22:12; ctx.strokeStyle='rgba(255,50,70,'+(0.45*Math.max(0.3,e.beams.k))+')'; ctx.lineWidth=sw(w); ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
          ctx.strokeStyle='rgba(255,230,230,0.9)'; ctx.lineWidth=sw(b.big?6:3); ctx.stroke(); }
      }
      ctx.globalCompositeOperation='source-over';
    }
    for(const b of e.bolts){ ctx.fillStyle='#ff6070'; ctx.beginPath(); ctx.arc(sx(b.x),sy(b.y),Math.max(3,sw(6)),0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(sx(b.x),sy(b.y),Math.max(1.5,sw(2.5)),0,Math.PI*2); ctx.fill(); }
    // the body: a heptagon, stone-dark with a red rim, an angry face
    ctx.translate(cx,cy);
    if(e.awake&&!off){ const g0=ctx.createRadialGradient(0,0,R*0.5,0,0,R*1.8); g0.addColorStop(0,'rgba(255,60,60,'+(e.phase===3?(0.45+0.2*Math.sin(fr*0.3)).toFixed(3):'0.25')+')'); g0.addColorStop(1,'rgba(255,60,60,0)'); ctx.fillStyle=g0; ctx.beginPath(); ctx.arc(0,0,R*1.8,0,Math.PI*2); ctx.fill(); }
    ctx.save(); ctx.rotate(e.rot);
    ctx.beginPath(); for(let i=0;i<NODES;i++){ const a=i*Math.PI*2/NODES-Math.PI/2; ctx[i?'lineTo':'moveTo'](Math.cos(a)*R,Math.sin(a)*R); } ctx.closePath();
    const rg=off?0:bossRage(e), mixC=(a,b2,t)=>'rgb('+a.map((v,i)=>Math.round(v+(b2[i]-v)*t)).join(',')+')';
    const g=ctx.createLinearGradient(0,-R,0,R); g.addColorStop(0,off?'#3a3440':mixC([74,60,88],[178,34,48],rg)); g.addColorStop(1,off?'#1a161e':mixC([28,20,36],[86,10,18],rg));
    ctx.fillStyle=g; ctx.fill(); ctx.lineWidth=sw(4+2*rg); ctx.strokeStyle=e.hitF>0?'#ffffff':(off?'#4a2a2a':'#c02838'); ctx.stroke();
    if(rg>0.05){ ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=rg*(0.35+0.25*Math.sin(fr*(0.12+0.2*rg))); ctx.fillStyle='#ff2030'; ctx.fill(); ctx.restore(); }   // a hot red pulse through the body
    for(let i=0;i<NODES;i++){ const a=i*Math.PI*2/NODES-Math.PI/2, x=Math.cos(a)*R, y=Math.sin(a)*R;   // the angle nodes
      const hot=e.beams&&!off?(e.beams.tel?e.beams.k:1):(e.awake&&!off?0.3+0.2*Math.sin(fr*0.2+i):0.1);
      ctx.fillStyle='rgba(255,'+(80+120*hot|0)+','+(80+60*hot|0)+','+(0.4+0.6*hot)+')'; ctx.beginPath(); ctx.arc(x,y,sw(6+3*hot),0,Math.PI*2); ctx.fill(); }
    ctx.restore();
    // the face (it doesn't turn with the body)
    // T465 (Paulo, Nov 11): it turns gradually scared the longer the kiritsuke is loaded;
    // T462: hit with the wrong thing, it grins and laughs for a moment
    const heat=!off&&typeof B.knifeHeat==='function'?B.knifeHeat():0;
    e._scare=(e._scare||0)+(heat-(e._scare||0))*0.05;
    if(e._mockT>0) e._mockT--;
    const sc=off?0:Math.min(1,e._scare*1.15), mk=off?0:Math.min(1,(e._mockT||0)/20);
    if(sc>0.05){ ctx.translate((Math.random()-0.5)*sw(2.5)*sc,(Math.random()-0.5)*sw(1.5)*sc); }      // trembling
    if(mk>0) ctx.translate(0,Math.sin(fr*0.9)*sw(3)*mk);                                              // shaking with laughter
    if(e._recoilT>0) ctx.translate(Math.sin(fr*1.7)*sw(4)*(e._recoilT/24),0);                        // reeling from the blade
    ctx.strokeStyle=off?'#5a5060':'#ff4a5a'; ctx.lineWidth=sw(5); ctx.lineCap='round';
    const mad=e.awake&&!off;
    const by=mad?-R*0.16:-R*0.26;
    // brows: angry (inner ends down) -> scared (inner ends up, raised); mocking: one up, one down
    const inL=by+(-R*0.22)*sc+(-R*0.12)*mk, inR=by+(-R*0.22)*sc+(R*0.06)*mk, outY=-R*0.32-R*0.06*sc;
    ctx.beginPath(); ctx.moveTo(-R*0.38,outY+R*0.1*sc); ctx.lineTo(-R*0.12,inL); ctx.moveTo(R*0.38,outY+R*0.1*sc); ctx.lineTo(R*0.12,inR); ctx.stroke();
    if(mk>0.3){                                                                                        // laughing: eyes squeezed shut, "^ ^"
      ctx.beginPath(); for(const s of [-1,1]){ ctx.moveTo(s*R*0.3,R*0.0); ctx.lineTo(s*R*0.22,-R*0.08); ctx.lineTo(s*R*0.14,R*0.0); } ctx.stroke();
    }else{
      const er=sw(5+5*sc);
      if(off){ ctx.beginPath(); for(const s of [-1,1]){ const ex=s*R*0.22, ey=-R*0.02, k=R*0.1; ctx.moveTo(ex-k,ey-k); ctx.lineTo(ex+k,ey+k); ctx.moveTo(ex+k,ey-k); ctx.lineTo(ex-k,ey+k); } ctx.stroke(); }   // X X
      else{ ctx.fillStyle='#ffe0e0'; ctx.beginPath(); ctx.arc(-R*0.22,-R*0.02,er,0,Math.PI*2); ctx.arc(R*0.22,-R*0.02,er,0,Math.PI*2); ctx.fill(); }
      if(sc>0.15&&!off){ ctx.fillStyle='#1a0a10'; const pr=Math.max(1.5,sw(3*(1-sc*0.6))), jx=Math.sin(fr*0.7)*sw(1.5)*sc; ctx.beginPath(); ctx.arc(-R*0.22+jx,-R*0.02,pr,0,Math.PI*2); ctx.arc(R*0.22+jx,-R*0.02,pr,0,Math.PI*2); ctx.fill(); }   // pinpoint pupils, darting
    }
    ctx.beginPath();
    if(off){ ctx.moveTo(-R*0.25,R*0.38); ctx.lineTo(R*0.25,R*0.38); ctx.stroke(); }
    else if(mk>0.3){                                                                                   // a wide open laugh
      ctx.fillStyle='#2a0810'; ctx.beginPath(); ctx.moveTo(-R*0.3,R*0.22); ctx.quadraticCurveTo(0,R*0.62,R*0.3,R*0.22); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#ffe0e0'; ctx.fillRect(-R*0.22,R*0.22,R*0.44,R*0.06);
    }else if(sc>0.35){                                                                                 // scared: a small wobbling wavy mouth
      const n=6, w=R*0.4, amp=R*0.05*(0.6+0.4*Math.sin(fr*0.5));
      ctx.moveTo(-w/2,R*0.36); for(let i=1;i<=n;i++) ctx.lineTo(-w/2+w*i/n,R*0.36+(i%2?-amp:amp)); ctx.stroke();
    }else{ ctx.moveTo(-R*0.18,R*0.42); ctx.lineTo(0,R*0.26); ctx.lineTo(R*0.18,R*0.42); ctx.stroke(); }   // the "Λ" mouth from the sheet
    if(sc>0.5&&!off){ const k=(fr*0.02)%1; ctx.fillStyle='rgba(150,210,255,'+(0.85*(1-k))+')'; ctx.beginPath(); ctx.ellipse(R*0.48,-R*0.2+k*R*0.4,sw(3),sw(4.5),0,0,Math.PI*2); ctx.fill(); }   // a sweat drop
    ctx.restore();
    if(mk>0&&e._mockLine&&typeof drawTextC==='function'){                                              // the taunt, over its head
      const ty=cy-R*1.55; ctx.save(); ctx.globalAlpha=Math.min(1,mk*1.5);
      const tw=(typeof textW==='function'?textW(e._mockLine,2):300)+24; ctx.fillStyle='rgba(20,6,12,0.85)'; ctx.fillRect(cx-tw/2,ty-6,tw,30);
      ctx.strokeStyle='#ff4a5a'; ctx.lineWidth=2; ctx.strokeRect(cx-tw/2,ty-6,tw,30);
      drawTextC(e._mockLine,cx,ty,'#ffd0d6',2); ctx.restore();
    }
  }

  // ── ticks / drawing hooked into beta_enemies ──────────────────
  B.foeTick=function(e){
    if(!p) return;
    e.mn=-1e7; e.mx=1e7;
    if(e._foe==='eye') eyeTick(e); else if(e._foe==='cube') cubeTick(e); else if(e._foe==='boss') bossTick(e);
  };
  B.foeDraw=function(e){ try{ if(e._foe==='eye') drawEye(e); else if(e._foe==='cube') drawCube(e); else if(e._foe==='boss') drawBoss(e); }catch(er){ console.warn('foe draw',er); } };
  // the boss can't be revived; its fall opens the bowl
  setInterval(()=>{ try{ if(hitCd>0) hitCd--; if(!B.on) return; for(const e of (typeof ENEMS!=='undefined'?ENEMS:[])){ if(e&&e._boss&&!e.alive) bossDefeat(e); } }catch(er){} },16);

  // ── entities: the boss, the knife, the save-state ─────────────
  const _onEnt=B.onEntities;   // (the boss's resting tilt settles by the notches)
  B.onEntities=function(ents,Fd,cell){
    if(_onEnt) _onEnt.apply(this,arguments);
    B.bossDown=false; B.bossOn=false; B.bossSeenOnce=false; B.knifePickup=null; B.savePt=null;
    for(const e of ents){
      const id=e.__identifier, g=cell(e), cx=(g.c+g.w/2)*T, cy=(g.r+g.h/2)*T;
      if(id==='Boss'){ const bs=mkBoss(cx,cy), x0=Fd(e,'xmin'), x1=Fd(e,'xmax'); if(x0!=null) bs.xMin=x0*T; if(x1!=null) bs.xMax=x1*T; ENEMS.push(bs); }   // the stretch of bowl it follows MIND across
      else if(id==='Knife') B.knifePickup={x:cx, y:(g.r+1)*T, got:_itemUnlocked(4)};
      else if(id==='SaveState') B.savePt={x:cx, y:(g.r+1)*T, used:false};
    }
  };
  function pickups(){
    if(!on()) return;
    const P=centre();
    const k=B.knifePickup;
    if(k&&!k.got&&Math.abs(P.x-k.x)<40&&Math.abs(P.y-(k.y-20))<70){
      k.got=true; _unlockedMask|=16; ITEM=4; B.stats&&B.stats.items++;
      burst(k.x,k.y-20,24,['#e8a060','#ffe0b0','#a0a8b8'],4); S('item_get');
      if(B.openPopup) B.openPopup(5); else if(typeof uiShowToast==='function') uiShowToast('THE GAUCHO KNIFE!');
    }
    const s=B.savePt;
    if(s&&Math.abs(P.x-s.x)<40&&Math.abs(P.y-(s.y-20))<70){
      if(!s.near){ s.near=true; s.used=true; s.say=200;
        // Paulo, Nov 4 (build 367): the first time in this journey she gives MIND a spare battery
        // (a battery is what reboots him after a shutdown); her line says so.
        B.popupSeen=B.popupSeen||{};
        if(!B.popupSeen.savrahBattery){ B.popupSeen.savrahBattery=true; s.gift=true; s.say=330; B.lives=(B.lives|0)+1; if(B.showLives) B.showLives(false); try{ S('item_get'); }catch(er){} }
        else s.gift=false;
        _spawnX=s.x-SW/2; _spawnY=s.y-FEET_OFF; B.safe={x:_spawnX,y:_spawnY};
        try{ if(B.saveStage) B.saveStage(); }catch(er){}
        try{ if(B.timelinePush) B.timelinePush(); }catch(er){}
        burst(s.x,s.y-24,20,['#60d0ff','#ffffff'],3); S('chargeReady',1.2);
        // T440 (Paulo, Nov 11): "A dialog box has to pop open when we reach the save state." (was a toast)
        B.saveDlg={t:0, lines:s.gift?['I SAVED THIS MOMENT TO YOUR TIMELINE.','TAKE THIS SPARE BATTERY: IF YOU GET','SHUT DOWN, IT REBOOTS YOU.']:['I SAVED THIS MOMENT TO YOUR TIMELINE.','IF YOU GET SHUT DOWN, YOU START AGAIN','FROM HERE.']};
      }
    }else if(s) s.near=false;
    if(s&&s.say>0) s.say--;
  }
  if(B.ITEM_INFO) B.ITEM_INFO[5]={name:'THE GAUCHO KNIFE', lines:['A COPPER-CORE DAMASCUS KIRITSUKE. IT IS MIND\'S ALONE.','TAP X (Q): SLASH UP, TAP AGAIN: DOWN.','HOLD X: IT HEATS UP AND PULLS THINGS IN.','LET GO: A WIDE SLASH. ITS POWER IS THE SUM OF','EVERY SEED AND CRYSTAL YOU COLLECTED HERE.']};

  // ── the knife (Paulo, Oct 22) ─────────────────────────────────
  // Held like a knife, not a jack: at rest the arm hangs down and BACK (facing east: toward
  // SW) with the blade pointing down that same way; walking, the arm arches and the tip
  // swings round to aim forward-down (SE). It only points forward / up when aiming up,
  // sprinting, or loading a slash. Tap: a slash UP; keep tapping and it comes back DOWN
  // from where the last one ended (up, down, up…). Hold: drawn back behind, let go for a
  // wide slash in the stick's direction (8 ways, like the punch; no stick = straight ahead).
  // Angles are kept in an "east frame" (facing right; 0 = ahead, +π/2 = down) and mirrored.
  let slashCd=0, wasBtn=false, holdT=0, charged=false, big=null, queued=false;
  let armE=2.36, knE=2.36, swing=null, comboT=0, nextUp=true, poseOn=false;
  // Paulo (Oct 22, later): the longer the slash is loaded, the hotter the blade — dull red, orange,
  // yellow, then bright yellow-white at 9 s (MAXH), its strongest and longest reach. Loading pulls
  // the things round it in, harder the longer it's held; let go and the slash shoves them away,
  // harder the longer it was held. Only the knife can beat the 1.3 boss: a fully loaded slash
  // takes a fifth of it (5 to win); nothing else hurts it.
  const CHARGE=34, MID=120, MAXH=540, BIG_R=176, BIG_R_MAX=430, BIG_H=78, BIG_H_MAX=132, BIG_DMG=72, BIG_DMG_MAX=200, BOSS_FULL=72;
  const REST=2.36, WALK_ARM=1.95, WALK_KN=0.79, BACK=2.64, SWEEP=2.99;
  let knifeHit=false, motes=[];
  const heatOf=t=>Math.min(1,t/MAXH), fullOf=t=>Math.max(0,Math.min(1,(t-CHARGE)/(MAXH-CHARGE)));
  // Paulo (Oct 31): the charged slash is the SUM of every Knowl seed and crystal collected in this stage.
  // Hold time still builds the heat; the sum sets how much of the slash you get (reach, damage, the boss's
  // share). Nothing collected = KNIFE_FLOOR of a full slash, everything collected = all of it. (Tunable.)
  const KNIFE_FLOOR=0.5;
  function knifeSum(){ try{ const n=B.counts?B.counts():{crystals:0,seeds:0}, need=B.need?((B.need.crystals|0)+(B.need.seeds|0)):0;
    const got=(n.crystals|0)+(n.seeds|0); return {got, need:Math.max(need,got,1)}; }catch(e){ return {got:0,need:1}; } }
  B.knifePower=()=>{ const k=knifeSum(); return KNIFE_FLOOR+(1-KNIFE_FLOOR)*Math.min(1,k.got/k.need); };
  B.knifeSum=knifeSum;
  // Paulo (Oct 31): the kiritsuke is Mind's. In co-op (two people playing) whoever picked Mind keeps it; the
  // co-op page sets window.MV_COOP_ON, and then Venture's player never draws it. One player: unchanged.
  const knifeMine=()=>!(window.MV_COOP_ON&&p&&p.hero!=='mind');
  B.knifeCharge=()=>holdT>0?Math.min(1,holdT/CHARGE):0; B.knifeHeat=()=>holdT>0?heatOf(holdT):0; B.knifeBig=()=>big; B.knifePose=()=>({armE,knE,swing:swing&&swing.up,comboT}); B.knifeSwinging=()=>!!swing||!!(big&&big.t<=10);
  const dirOf=()=>p.fc?1:-1;
  // dull red → orange → yellow → bright yellow-white
  function heatRGB(h){ const st=[[0,[150,30,20]],[0.25,[230,70,20]],[0.5,[255,140,30]],[0.78,[255,215,50]],[1,[255,250,190]]];
    for(let i=1;i<st.length;i++) if(h<=st[i][0]){ const [a,ca]=st[i-1], [b,cb]=st[i], u=(h-a)/(b-a); return ca.map((v,k)=>Math.round(v+(cb[k]-v)*u)); } return st[st.length-1][1]; }
  const rgba=(c,a)=>'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';
  const toW=a=>dirOf()>0?a:Math.PI-a, toE=a=>dirOf()>0?a:Math.PI-a;
  const wrap=a=>{ while(a>Math.PI) a-=2*Math.PI; while(a<-Math.PI) a+=2*Math.PI; return a; };
  const ease=(cur,tgt,k)=>cur+wrap(tgt-cur)*k;
  // the stick, snapped to 8 ways like the punch; nothing held = straight ahead
  function aimE(){
    const up=typeof isUp==='function'&&isUp(), dn=typeof isDn==='function'&&isDn(), lf=typeof isLf==='function'&&isLf(), rt=typeof isRt==='function'&&isRt();
    const ax=(rt?1:0)-(lf?1:0), ay=(dn?1:0)-(up?1:0);
    if(!ax&&!ay) return 0;
    return toE(Math.atan2(ay,ax));
  }
  function cutVine(bw){ const bx=bw.x+bw.w/2, by=bw.y+bw.h/2; bw.hp=0; try{ if(typeof gridSmashCell==='function'&&bw.homeCol!=null) gridSmashCell(bw.homeCol,bw.homeRow); }catch(er){} burst(bx,by,10,['#3a8a3a','#7ac060','#2a5a2a'],3); S('omniblock_chip'); }
  function shoulder(){ const P=p._armPose; return P?{x:P.connShX,y:P.connShY}:{x:p.x+SW/2,y:p.y+FEET_OFF-70}; }
  // the quick slash: the arc the blade sweeps hits what's along it
  function quickSlash(){
    const up=nextUp; nextUp=!nextUp;
    const from=up?Math.max(0.55,Math.min(1.3,armE)):-1.15, to=up?-1.15:1.05;
    swing={from,to,t:0,dur:5,up,hit:false}; comboT=0; slashCd=3; queued=false;
    try{ if(window.MV_KNIFE_SFX) MV_KNIFE_SFX.swing(false); else S('punch_whiff',1.2); }catch(er){}
    for(const r of (B.ropes||[]).slice()){ if(r.kind==='mind'&&r.e&&B.releaseRopeOf){ B.releaseRopeOf(r.e); burst(p.x+SW/2,p.y+FEET_OFF-60,8,['#e8d0a0','#a08060'],3); } }
  }
  function swingHit(sw){
    const sh=shoulder(), pts=[];
    for(let i=0;i<=4;i++){ const a=toW(sw.from+(sw.to-sw.from)*i/4); for(const r of [40,70]) pts.push({x:sh.x+Math.cos(a)*r,y:sh.y+Math.sin(a)*r}); }
    const near=(x,y,pad)=>pts.some(q=>Math.hypot(q.x-x,q.y-y)<pad);
    for(const bw of BWALLS){ if(bw.hp<=0||bw.only!=='vine') continue; const bx=bw.x+bw.w/2, by=bw.y+bw.h/2; if(near(bx,by,30)&&clearLine(sh.x,sh.y,bx,by)) cutVine(bw); }
    for(const e of ENEMS){ if(!e.alive||e._betaHeld) continue; const ex=e.x+e.w/2, ey=e.y+e.h/2;
      if(near(ex,ey,16+e.w/2)&&clearLine(sh.x,sh.y,ex,ey)){ if(e._boss){ clink(e,sh.x,sh.y); continue; } knifeHit=true; window._knifeHitNow=true; try{ if(typeof _damageEnemy==='function') _damageEnemy(e,knifeEnds(e)?9999:14,sh.x,sh.y,0.8); } finally{ knifeHit=false; window._knifeHitNow=false; } burst(ex,ey,8,['#ffe0b0','#ff8060'],3); } }
  }
  // T150: is the blade, at east-frame angle aE round the shoulder, in rock? (the floor right under
  // the wheel doesn't count, like the clang in beta_knife.js)
  function bladeInRock(aE){
    const sh=shoulder(), P=p._armPose, R=(P?Math.hypot(P.tipX-P.connShX,P.tipY-P.connShY):40)+34, a=toW(aE);
    const feet=p.y+FEET_OFF, mx=p.x+SW/2;
    for(const r of [R*0.5,R*0.75,R]){
      const x=sh.x+Math.cos(a)*r, y=sh.y+Math.sin(a)*r;
      if(y>=feet-10&&Math.abs(x-mx)<46) continue;
      if(solid(x,y)) return true;
    }
    return false;
  }
  function swingStopped(atE){
    const dir=Math.sign(swing.to-swing.from)||1, sh=shoulder(), a=toW(atE);
    swing.to=atE;                                                  // the arc ends here (and only hits up to here)
    if(!swing.hit){ swing.hit=true; swingHit(swing); }
    const back=Math.max(-1.3,Math.min(1.3,atE-dir*0.35));
    swing={from:atE,to:back,t:0,dur:5,up:swing.up,hit:true,bounce:true};
    const P=p._armPose, R=(P?Math.hypot(P.tipX-P.connShX,P.tipY-P.connShY):40)+30;
    const ux=Math.cos(toW(atE+dir*0.12)), uy=Math.sin(toW(atE+dir*0.12));
    if(B.knifeBladeHit) B.knifeBladeHit(sh.x+ux*R,sh.y+uy*R,0.6,ux,uy);
    B.knifeBounces=(B.knifeBounces|0)+1;
  }
  // held, then let go: one wide sweep out along the aimed direction, from just behind MIND
  // out to ~5.5 tiles; walls still block it (line of sight from the chest)
  function bigSlash(aE,t){
    const f=fullOf(t)*B.knifePower(), h=heatOf(t), Rr=BIG_R+(BIG_R_MAX-BIG_R)*f, Hh=BIG_H+(BIG_H_MAX-BIG_H)*f;
    const dmg=Math.round(BIG_DMG+(BIG_DMG_MAX-BIG_DMG)*f), kb=2.2+4.5*h, push=4+16*h;
    const ang=toW(aE), ux=Math.cos(ang), uy=Math.sin(ang), cx=p.x+SW/2, cy=p.y+FEET_OFF-58;
    big={x:cx,y:cy,ang,aE,t:0,R:Rr,H:Hh,heat:h}; swing=null; comboT=0; nextUp=true; slashCd=28; motes=[];
    try{ if(window.MV_KNIFE_SFX) MV_KNIFE_SFX.swing(true); else { S('punch_whiff',0.7); S('punch_whiff',1.6); } }catch(er){}
    if(f>0.95) S('chargeReady',0.6);
    B.shake=Math.max(B.shake||0,10+12*f);
    const inArc=(x,y,pad)=>{ const dx=x-cx, dy=y-cy, along=dx*ux+dy*uy, across=-dx*uy+dy*ux; return along>-30-pad&&along<Rr+pad&&Math.abs(across)<Hh+pad; };
    for(const bw of BWALLS){ if(bw.hp<=0) continue; const bx=bw.x+bw.w/2, by=bw.y+bw.h/2; if(!inArc(bx,by,12)||!clearLine(cx,cy,bx,by)) continue;
      if(bw.only==='vine') cutVine(bw);
      else if(bw.movable&&!bw._carried&&B.throwCube){ const d=Math.max(1,Math.hypot(bx-cx,by-cy)), k=push*(1-0.5*Math.min(1,d/Rr)); B.throwCube(bw,(bx-cx)/d*k,(by-cy)/d*k-2); } }   // shoved away
    for(const e of ENEMS){ if(!e.alive||e._betaHeld) continue; const ex=e.x+e.w/2, ey=e.y+e.h/2;
      if(!inArc(ex,ey,e.w/2)||!clearLine(cx,cy,ex,ey)) continue;
      // one kiritsuke hit, quick or loaded, shuts A–F down for good
      const perm=knifeEnds(e);
      if(perm) knifeFinish(e);
      const hit=e._boss?Math.round(BOSS_FULL*f):perm?9999:dmg;
      if(e._boss&&hit<=0){ clink(e,cx,cy); continue; }
      knifeHit=true; window._knifeHitNow=true; try{ if(typeof _damageEnemy==='function') _damageEnemy(e,hit,cx,cy,e._boss?0.3:kb); } finally{ knifeHit=false; window._knifeHitNow=false; }
      if(perm&&!e.alive){ e._permOff=true; e._stayDown=true; }
      burst(ex,ey,18+Math.round(14*f),['#fff4e0',rgba(heatRGB(h),1),'#ff5040'],5+3*f); }
    for(const r of (B.ropes||[]).slice()){ if(r.kind==='mind'&&r.e&&B.releaseRopeOf) B.releaseRopeOf(r.e); }
    burst(cx+ux*80,cy+uy*80,14+Math.round(16*f),['#fff4e0',rgba(heatRGB(h),1),'#e08040'],5+4*f);
  }
  // the boss shrugs off anything that isn't the knife's loaded slash: a spark and a ring
  function clink(e,fx,fy){ const ex=e.x+e.w/2, ey=e.y+e.h/2, d=Math.hypot(ex-fx,ey-fy)||1, x=ex-(ex-fx)/d*e.w*0.45, y=ey-(ey-fy)/d*e.h*0.45;
    burst(x,y,6,['#ffffff','#c0c8d8'],3); S('omniblock_chip',1.6); }
  // T462 (Paulo, Nov 11): hit with anything but the kiritsuke, the boss mocks: it laughs at MIND
  // (a synthesized "ha-ha-ha"), its face grins, and it says the toys won't do.
  const GLOAT=['HA HA HA! FEEL THAT?','HAH! STAY DOWN, SPEAKER.','HA HA! TOO SLOW!'];
  const TAUNT=['HA HA HA... COME CLOSER.','IS THAT A KNIFE OR A SPOON? HA HA!','I CAN DO THIS ALL NIGHT. HA HA HA!'];
  const MOCK=['HA HA HA! YOUR TOYS CAN\'T TOUCH ME.','IS THAT ALL? PATHETIC LITTLE SPEAKER.','HAH! NO PLUG OF YOURS WILL END ME.','TICKLES. TRY SOMETHING SHARPER... OH WAIT.'];
  function laugh(e){
    let a=null; try{ a=typeof ga==='function'?ga():null; }catch(er){} if(!a||a.state!=='running') return;
    const v=(typeof OPT!=='undefined'&&OPT.sfxVol!=null?OPT.sfxVol:1), t0=a.currentTime+0.02;
    const out=a.createGain(); out.gain.value=0.5*v; out.connect(a.destination);
    for(let k=0;k<4;k++){                                   // "ha" x4, each a little lower, a mean growl under it
      const s=t0+k*0.17, f0=210-k*18, o=a.createOscillator(), o2=a.createOscillator(), f1=a.createBiquadFilter(), f2=a.createBiquadFilter(), g=a.createGain(), g2=a.createGain();
      o.type='sawtooth'; o.frequency.setValueAtTime(f0*1.12,s); o.frequency.exponentialRampToValueAtTime(f0*0.86,s+0.13);
      o2.type='square'; o2.frequency.value=f0/2; const gg=a.createGain(); gg.gain.value=0.25; o2.connect(gg);
      f1.type='bandpass'; f1.frequency.value=760; f1.Q.value=6; f2.type='bandpass'; f2.frequency.value=1250; f2.Q.value=7;
      o.connect(f1); o.connect(f2); gg.connect(f1); f1.connect(g); f2.connect(g2); g2.gain.value=0.6; g2.connect(g);
      g.gain.setValueAtTime(0.0001,s); g.gain.exponentialRampToValueAtTime(0.7,s+0.02); g.gain.exponentialRampToValueAtTime(0.0001,s+0.15); g.connect(out);
      const n=a.createBufferSource(), b=a.createBuffer(1,Math.round(a.sampleRate*0.04),a.sampleRate), d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);
      n.buffer=b; const hp=a.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=1800; const ng=a.createGain(); ng.gain.value=0.25; n.connect(hp); hp.connect(ng); ng.connect(out);   // the breathy "h"
      o.start(s); o2.start(s); n.start(s); o.stop(s+0.17); o2.stop(s+0.17);
    }
  }
  function bossMock(e){
    if((e._mockCd||0)>fr) return;
    e._mockCd=fr+150; e._mockT=80; e._mockLine=MOCK[(e._mockN=(e._mockN|0)+1)%MOCK.length];
    try{ laugh(e); }catch(er){}
  }
  B.bossMock=bossMock;
  function knifeEnds(e){
    if(!e||e._boss) return false;
    if(e.mirror) return true;
    const id=e._foe||e._ai||e._betaEnemy;
    return id==='circle'||id==='tri'||id==='square'||id==='eye'||id==='cube'||id==='mirror';
  }
  function knifeFinish(e){
    e._downs=3; e._permOff=true; e._stayDown=true; e._shutCount=99;
    if(e._foe==='eye'||e._ai==='eye'){ e.st='down'; e._downed=true; e.beam=null; }
    if(e._foe==='cube'||e._ai==='cube'){ e.st='down'; e.beams=null; }
  }
  const _dmgE=window._damageEnemy;
  if(typeof _dmgE==="function") window._damageEnemy=function(e,dmg,fx,fy,kb){
    if(e&&e._boss&&on()&&!knifeHit){ if(e.alive&&fx!=null&&fy!=null&&(e._clinkF||0)<fr){ e._clinkF=fr+8; clink(e,fx,fy); } if(e.alive) bossMock(e); return false; }
    if(e&&e._boss&&on()&&knifeHit&&e.alive){                          // the blade lands: it's thrown back, reeling
      const hx=fx!=null?fx:(p?p.x+SW/2:e.x), dir=Math.sign(e.x+e.w/2-hx)||1;
      e.vx=(e.vx||0)+dir*12; e.vy=(e.vy||0)-5; e._recoilT=24; e.hitF=12; e._dodgeCd=Math.max(e._dodgeCd|0,40);
      B.shake=Math.max(B.shake||0,9); S('enemy_boot',1.5); B.bossRecoils=(B.bossRecoils|0)+1; }
    if(e&&e._foe==='cube'&&e.alive&&on()){
      // (build 371) any hit while its window is shut wakes it and opens the 3 s window again —
      // before, only walking up to it did, so standing next to it once the 3 s ran out it
      // could never be hurt (Paulo: "I still can't really damage the AG F")
      if(!((e.fVulnT||0)>0)){ cubeWake(e); e._wasClose=true; if(!window._shotHitNow){ if(fx!=null&&fy!=null) clink(e,fx,fy); e.hitF=6; return false; } }   // T434: a shot from afar wakes it and counts
      if(!cubeHurtable(e)){ if(fx!=null&&fy!=null&&(e._clinkF||0)<fr){ e._clinkF=fr+8; clink(e,fx,fy); } e.hitF=6; return false; }
      if(!knifeHit){ const sh=window._shotHitNow, amt=sh?(sh.charged?CUBE_DMG.shotLoaded:CUBE_DMG.shot):CUBE_DMG.punch;   // T434: 3 loaded punches / 2 shots / 1 loaded shot
        return _dmgE.call(this,e,amt,fx,fy,kb); }
    }
    if(knifeHit&&knifeEnds(e)){
      knifeFinish(e);
      const r=_dmgE.call(this,e,9999,fx,fy,kb);
      knifeFinish(e); e.alive=false;
      return r;
    }
    if(e&&e._foe==='eye'&&e.alive&&e.st!=='down'&&fx!=null&&fy!=null){
      const lx=(e.look&&e.look.x)||0, ly=(e.look&&e.look.y)||0;
      const hx=fx-(e.x+e.w/2), hy=fy-(e.y+e.h*0.4), hl=Math.hypot(hx,hy)||1;
      const dot=(hx*lx+hy*ly)/hl;
      if(dot>0.2){ e._downs=2; return _dmgE.call(this,e,9999,fx,fy,kb); }
      if(dot<-0.15){ e.st='fall'; e._downed=true; e.vx=-lx*3.2; e.vy=-2.4; return false; }
      return false;
    }
    return _dmgE.apply(this,arguments);
  };
  // loading the slash: the knife draws things in — enemies, loose cubes — harder and from
  // further the longer it's held (walls in between block it)
  function pull(t){
    const h=heatOf(t), Rg=70+330*h, st=0.15+2.6*h*h;
    // the pull's centre: just in front of MIND along the aim (where the slash will go), not the
    // cocked-back blade, so what it draws in is in the slash's path
    const ae=toW(aimE()), kx=p.x+SW/2+Math.cos(ae)*60, ky=p.y+FEET_OFF-58+Math.sin(ae)*60;
    const free=(x,y,w,hh)=>typeof gridWorldSolid!=='function'||!(gridWorldSolid(x+2,y+2)||gridWorldSolid(x+w-2,y+2)||gridWorldSolid(x+2,y+hh-2)||gridWorldSolid(x+w-2,y+hh-2));
    for(const e of ENEMS){ if(!e||e._boss||e._betaHeld) continue; const ex=e.x+e.w/2, ey=e.y+e.h/2, d=Math.hypot(kx-ex,ky-ey);
      if(d>Rg||d<e.w*0.5+12||!clearLine(kx,ky,ex,ey)) continue;
      const k=st*(1-d/Rg), mx=(kx-ex)/d*k, my=(ky-ey)/d*k;
      if(free(e.x+mx,e.y,e.w,e.h)) e.x+=mx; if(free(e.x,e.y+my,e.w,e.h)) e.y+=my; }
    if(h>0.2&&B.throwCube) for(const bw of BWALLS){ if(bw.hp<=0||!bw.movable||bw._carried||bw.only) continue; const bx=bw.x+bw.w/2, by=bw.y+bw.h/2, d=Math.hypot(kx-bx,ky-by);
      if(d>Rg||d<46||!clearLine(kx,ky,bx,by)) continue; const k=st*(1-d/Rg);
      if(!bw._fly){ if(k>0.6) B.throwCube(bw,(kx-bx)/d*k*3,(ky-by)/d*k*3-1.5); } else { bw.vx+=(kx-bx)/d*k*0.22; bw.vy+=(ky-by)/d*k*0.22-0.25; } }
    // the motes it draws in (looks only)
    if(Math.random()<0.25+0.7*h){ const a=Math.random()*Math.PI*2, r=Rg*(0.6+0.4*Math.random()); motes.push({x:kx+Math.cos(a)*r,y:ky+Math.sin(a)*r,life:1}); }
    for(const m of motes){ const d=Math.hypot(kx-m.x,ky-m.y)||1, v=2+8*h; m.x+=(kx-m.x)/d*Math.min(d,v); m.y+=(ky-m.y)/d*Math.min(d,v); if(d<8) m.life=0; }
    motes=motes.filter(m=>m.life>0).slice(-90);
  }
  function knifeTick(){
    if(!on()) return;
    if(!knifeMine()){ holdT=0; charged=false; return; }
    poseOn=ITEM===4&&!(p.hook&&p.hook.st!=='idle');
    if(slashCd>0) slashCd--; if(big){ big.drawn=false; if(++big.t>22) big=null; }
    const btn=ITEM===4&&typeof _bindDown==='function'&&_bindDown('swap')&&!(typeof _runItemQuiet==='function'&&_runItemQuiet(p));   // (not while sprinting)
    // T464: "spam slash as fast as we can press the button" — a press during the short cooldown
    // is kept and slashes the moment it ends (it used to be dropped)
    if(btn&&!wasBtn&&slashCd>0&&holdT===0) queued=true;
    if(queued&&slashCd<=0&&!btn){ queued=false; quickSlash(); }
    if(btn&&slashCd<=0){
      if(holdT<MAXH) holdT++;
      const P=p._armPose, kx=P?P.tipX:p.x+SW/2, ky=P?P.tipY:p.y+FEET_OFF-60, hc=heatOf(holdT);
      if(holdT===CHARGE){ charged=true; S('chargeReady',0.9); burst(kx,ky,8,['#ffe8b0','#ff9050'],2); }
      else if(holdT===MID){ S('chargeReady',1.1); burst(kx,ky,12,['#ffd080','#ff7030'],3); }
      else if(holdT===MAXH){ S('chargeReady',1.45); S('chargeReady',0.7); B.shake=Math.max(B.shake||0,7); burst(kx,ky,26,['#fffbe0','#ffe060','#ffb030'],5); }
      // T464 (Paulo, Nov 11): "when we're loading the kiritsuke's power there's this beating sound,
      // let's eliminate that" — the blade's repeating tick while it heats is gone (the chimes stay)
      if(holdT>CHARGE&&Math.random()<0.15+0.6*hc) burst(kx+(Math.random()-0.5)*30,ky+(Math.random()-0.5)*16,1,[rgba(heatRGB(hc),1)],1+2*hc);   // sparks off the edge
      if(holdT>12) pull(holdT);
    }
    if(!btn&&wasBtn&&holdT>0){ if(charged) bigSlash(aimE(),holdT); else quickSlash(); holdT=0; charged=false; }
    if(ITEM!==4){ holdT=0; charged=false; swing=null; comboT=0; nextUp=true; motes=[]; }
    wasBtn=btn;
    // ── the pose ──
    if(big&&big.t<=6){ const u=Math.min(1,big.t/5); armE=knE=big.aE-BACK+SWEEP*(1-(1-u)*(1-u)); return; }
    if(holdT>4){ const tg=aimE()-BACK; armE=ease(armE,tg,0.22); knE=ease(knE,tg-0.25*B.knifeCharge(),0.22); return; }
    if(swing){ const u=Math.min(1,++swing.t/swing.dur), k=1-(1-u)*(1-u), nA=swing.from+(swing.to-swing.from)*k;
      // T150: the quick slash stops at rock and bounces back a little (it never sweeps through a wall)
      if(!swing.bounce&&bladeInRock(nA)){ swingStopped(swing.cur!=null?swing.cur:swing.from); return; }
      armE=knE=swing.cur=nA;
      if(!swing.hit&&swing.t>=2){ swing.hit=true; swingHit(swing); }
      if(swing.t>=swing.dur){ swing=null; comboT=18; } return; }
    if(comboT>0){ comboT--; if(!comboT) nextUp=true; return; }
    const upAim=typeof isUp==='function'&&isUp();
    let ta=REST, tk=REST;
    if(upAim){ ta=tk=aimE(); }
    else if(p._sprintMode){ ta=0.2; tk=0; }
    else if(p.og!==false&&Math.abs(p.vx||0)>0.6){ const sp=Math.min(1,(Math.abs(p.vx)-0.6)/2.4); ta=REST+(WALK_ARM-REST)*sp; tk=REST+(WALK_KN-REST)*sp; }
    else if(!p.og){ ta=2.1; tk=1.6; }                                             // in the air: tucked down and back
    armE=ease(armE,ta,0.2); knE=ease(knE,tk,0.2);
  }
  // the arm follows the knife's pose (only MIND's, only with the knife, not on the rope)
  const _pose=window.computeConnectorArmPose;
  if(typeof _pose==='function') window.computeConnectorArmPose=function(pl){
    const who=pl||p;
    if(!(on()&&poseOn&&who===p&&ITEM===4)) return _pose.apply(this,arguments);
    const ax=who.aimDX, ay=who.aimDY, a=toW(armE); who.aimDX=Math.cos(a); who.aimDY=Math.sin(a);
    try{ return _pose.apply(this,arguments); } finally{ who.aimDX=ax; who.aimDY=ay; }
  };
  // only MIND's own arm takes the pose and anchors the sweeps (the HUD and crates draw the knife too)
  let inChar=false; const _dc=window.drawCharacter;
  if(typeof _dc==='function') window.drawCharacter=function(){ inChar=true; try{ return _dc.apply(this,arguments); } finally{ inChar=false; } };
  // the knife in the hand (drawn at the arm's tip in place of a jack)
  const _tip=window.drawConnectorTip;
  window.drawConnectorTip=function(cx,cy,aimAngle,flash,itemOverride,enh){
    const idx=itemOverride!=null?itemOverride:ITEM;
    if(inChar&&big&&!big.drawn){ big.drawn=true; drawBigSlash(); }
    if(idx!==4) return _tip.apply(this,arguments);
    const mine=inChar&&poseOn, hc=mine?B.knifeHeat():0;
    let rot=mine?toW(knE):aimAngle;
    if(hc>=1) rot+=Math.sin(performance.now()/30)*0.04;
    if(mine&&swing) drawSwingTrail(swing);
    if(mine&&motes.length) drawMotes(hc);
    if(!mine){ ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot); drawKnife(0,0,1,0); ctx.restore(); return; }
    // in MIND's hand: a chrome ring at the arm's end closes round the handle's middle
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot);
    chromeRing(false); drawKnife(6,0,1,hc); chromeRing(true);
    ctx.restore();
  };
  // the hand: a chrome ring seen edge-on — its far half behind the handle, its near half over it
  function chromeRing(front){
    ctx.save();
    if(!front){ ctx.strokeStyle='#4a4e58'; ctx.lineWidth=2.6; ctx.beginPath(); ctx.ellipse(0,0,3.4,6.6,0,Math.PI/2,Math.PI*1.5); ctx.stroke(); ctx.restore(); return; }
    const g=ctx.createLinearGradient(0,-7,0,7); g.addColorStop(0,'#ffffff'); g.addColorStop(0.25,'#b8c0cc'); g.addColorStop(0.5,'#5a6270'); g.addColorStop(0.7,'#e8eef6'); g.addColorStop(1,'#7a8290');
    ctx.strokeStyle='#22252c'; ctx.lineWidth=4.2; ctx.beginPath(); ctx.ellipse(0,0,3.4,6.6,0,-Math.PI/2,Math.PI/2); ctx.stroke();
    ctx.strokeStyle=g; ctx.lineWidth=3; ctx.beginPath(); ctx.ellipse(0,0,3.4,6.6,0,-Math.PI/2,Math.PI/2); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fillRect(2.4,-4.6,1.2,2.2);              // the chrome's glint
    ctx.restore();
  }
  function drawMotes(h){
    const c=heatRGB(Math.max(0.15,h)); ctx.save(); ctx.globalCompositeOperation='lighter';
    for(const m of motes){ ctx.fillStyle=rgba(c,0.5+0.4*h); ctx.fillRect(sx(m.x)-1,sy(m.y)-1,2+h*1.5,2+h*1.5); }
    ctx.restore();
  }
  // not in hand: the knife rides on MIND's belt line, clipped to the side of the speaker box,
  // pointing down and back
  if(typeof _dc==='function'){ const _dc2=window.drawCharacter;
    window.drawCharacter=function(){
      const r=_dc2.apply(this,arguments);
      try{ if(on()&&p&&typeof _unlockedMask!=='undefined'&&(_unlockedMask&16)&&ITEM!==4&&!p._dead&&!(p.flashF>0&&(fr>>2)&1)) holster(); }catch(e){}
      return r;
    };
  }
  function holster(){
    const P=p._armPose; if(!P) return;
    const dir=dirOf(), bx=P.tiltCX-dir*BODY_W*0.36, by=P.tiltCY+BODY_H*0.3;
    ctx.save();
    if(P.tilt){ const tx=sx(P.tiltCX), ty=sy(P.tiltCY); ctx.translate(tx,ty); ctx.rotate(P.tilt); ctx.translate(-tx,-ty); }
    ctx.translate(sx(bx),sy(by)); ctx.rotate(toW(2.25));
    drawKnife(-3,0,0.92,0);
    // the clip that holds it to the box
    ctx.fillStyle='#22252c'; ctx.fillRect(-4.5,-6,5,12); const g=ctx.createLinearGradient(-4,-6,1,6); g.addColorStop(0,'#e8eef6'); g.addColorStop(1,'#6a7280');
    ctx.fillStyle=g; ctx.fillRect(-4,-5.5,4,11);
    ctx.restore();
  }
  // the quick slash's trail: a thin bright arc behind the blade, round the shoulder
  function drawSwingTrail(sw){
    const sh=shoulder(), P=p._armPose, R=(P?Math.hypot(P.tipX-P.connShX,P.tipY-P.connShY):40)+34;
    const u=Math.min(1,sw.t/sw.dur), k=1-(1-u)*(1-u), cur=sw.from+(sw.to-sw.from)*k, a0=toW(sw.from), a1=toW(cur);
    const ox=sh.x-(typeof camX!=='undefined'?camX:0), oy=sh.y-(typeof camY!=='undefined'?camY:0);
    ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.lineCap='round';
    for(const [w,al,rr] of [[6,0.25,R],[2.5,0.85,R],[1.5,0.5,R-12]]){
      ctx.strokeStyle='rgba(255,240,215,'+(al*(1-u*0.6))+')'; ctx.lineWidth=w; ctx.beginPath(); ctx.arc(ox,oy,rr,a0,a1,a1<a0); ctx.stroke(); }
    ctx.restore();
  }
  // the wide slash: a flat crescent that sweeps out in the facing direction and fades
  function drawBigSlash(){
    const g=big, u=g.t/22, sw=Math.min(1,g.t/4), a=1-u, BIG_R=g.R, BIG_H=g.H, hc=heatRGB(Math.max(0.3,g.heat));
    ctx.save(); ctx.translate(g.x-(typeof camX!=="undefined"?camX:0),g.y-(typeof camY!=="undefined"?camY:0)); ctx.rotate(g.ang); ctx.globalCompositeOperation="lighter";
    for(let i=0;i<3;i++){
      const r=BIG_R*(0.6+0.17*i)*(0.8+0.2*sw), h=BIG_H*(0.42-0.08*i);
      ctx.strokeStyle=i===0?'rgba(255,250,235,'+(a*0.9)+')':i===1?rgba(hc,a*0.65):'rgba(255,110,70,'+(a*0.4)+')';
      ctx.lineWidth=(10-3*i)*a+1;
      ctx.beginPath(); ctx.ellipse(-20,0,r,h,0,-Math.PI/2*sw,Math.PI/2*sw); ctx.stroke();
    }
    ctx.fillStyle='rgba(255,240,210,'+(a*0.18)+')';
    ctx.beginPath(); ctx.ellipse(-20,0,BIG_R*0.9*sw,BIG_H*0.45,0,-Math.PI/2,Math.PI/2); ctx.fill();
    ctx.strokeStyle='rgba(255,255,245,'+a+')'; ctx.lineWidth=2.5*a+0.5; ctx.beginPath(); ctx.moveTo(-30,0); ctx.lineTo(-20+BIG_R*sw,0); ctx.stroke();   // the cut line
    for(let i=0;i<6;i++){ const yy=-BIG_H*0.4+i*BIG_H*0.16; ctx.fillStyle='rgba(255,230,180,'+(a*0.7)+')'; ctx.fillRect(BIG_R*(0.3+u*0.7)-20,yy,18*a+2,1.5); }
    ctx.restore();
  }
  // A kiritsuke (Paulo, Oct 22): a long, tall, near-flat edge; the spine runs straight then drops
  // in one long clipped line to a low point at the edge (the "K-tip"); a polished bevel under the
  // shinogi line, damascus on the flats, a copper core line, a mirror edge and a glint that runs
  // up the blade. Octagonal wa handle in ebony with a copper spacer and a black horn ferrule.
  // heat 0..1 tints it dull red → orange → yellow → bright yellow-white and makes it glow.
  function drawKnife(x,y,s,heat){
    heat=heat||0;
    ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
    // handle (octagonal: three facets) + spacer + ferrule
    ctx.fillStyle='#1a1210'; ctx.beginPath(); ctx.moveTo(-17,-2.8); ctx.lineTo(-1,-3.3); ctx.lineTo(-1,3.3); ctx.lineTo(-17,2.8); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#3a2a24'; ctx.fillRect(-17,-2.6,16,1.6);                                   // top facet catching the light
    ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.fillRect(-15,-2.3,12,0.6);
    ctx.fillStyle='#0c0a0a'; ctx.fillRect(-17,1.4,16,1.4);                                    // bottom facet
    ctx.fillStyle='#c8743a'; ctx.fillRect(-1,-3.4,1.6,6.8); ctx.fillStyle='#f0a868'; ctx.fillRect(-1,-3.4,1.6,1.2);   // copper spacer
    ctx.fillStyle='#16161a'; ctx.fillRect(0.6,-3.5,4.4,7); ctx.fillStyle='#3a3a44'; ctx.fillRect(0.6,-3.5,4.4,1.4);    // horn ferrule
    // the blade
    const bl=()=>{ ctx.beginPath(); ctx.moveTo(5,-4.6); ctx.lineTo(40,-4.6); ctx.lineTo(54,4.1); ctx.quadraticCurveTo(48,5.2,30,5.2); ctx.lineTo(5,5.2); ctx.closePath(); };
    if(heat>0.02){ const c=heatRGB(heat); ctx.save(); ctx.shadowColor=rgba(c,1); ctx.shadowBlur=3+heat*16; bl(); ctx.fillStyle=rgba(c,0.6); ctx.fill(); ctx.restore(); }
    bl(); const g=ctx.createLinearGradient(0,-4.6,0,5.2);
    g.addColorStop(0,'#eef2f8'); g.addColorStop(0.12,'#9aa2b0'); g.addColorStop(0.5,'#6a7280'); g.addColorStop(0.62,'#c4cad6'); g.addColorStop(0.85,'#f8faff'); g.addColorStop(1,'#a8b0bc');
    ctx.fillStyle=g; ctx.fill();
    ctx.save(); bl(); ctx.clip();
    ctx.strokeStyle='rgba(40,44,54,0.45)'; ctx.lineWidth=0.6;                                 // damascus on the flats (above the shinogi)
    for(let k=0;k<6;k++){ ctx.beginPath(); for(let xx=5;xx<=50;xx+=1.5){ const yy=-3.8+k*0.95+Math.sin(xx*0.32+k*1.7)*0.75+Math.sin(xx*0.11+k)*0.4; xx===5?ctx.moveTo(xx,yy):ctx.lineTo(xx,yy); } ctx.stroke(); }
    ctx.strokeStyle='rgba(214,118,58,0.9)'; ctx.lineWidth=0.9; ctx.beginPath();                // the copper core line, waving along the cladding
    for(let xx=5;xx<=50;xx+=1.5){ const yy=1.6+Math.sin(xx*0.45)*0.35; xx===5?ctx.moveTo(xx,yy):ctx.lineTo(xx,yy); } ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.fillRect(5,2.2,46,2);                           // the polished bevel
    ctx.strokeStyle='rgba(30,34,42,0.6)'; ctx.lineWidth=0.5; ctx.beginPath(); ctx.moveTo(5,1.1); ctx.lineTo(46,1.1); ctx.stroke();   // shinogi line
    const gx=((performance.now()/9)%160)-40;                                                   // a glint running up the blade
    const gg=ctx.createLinearGradient(gx-8,0,gx+8,0); gg.addColorStop(0,'rgba(255,255,255,0)'); gg.addColorStop(0.5,'rgba(255,255,255,0.85)'); gg.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=gg; ctx.fillRect(gx-8,-5,16,11);
    if(heat>0.02){ const c=heatRGB(heat), hg=ctx.createLinearGradient(5,0,54,0);                 // hottest along the edge and out to the tip
      hg.addColorStop(0,rgba(c,0.25*heat)); hg.addColorStop(0.6,rgba(c,0.55+0.3*heat)); hg.addColorStop(1,rgba(c,0.7+0.3*heat));
      ctx.globalCompositeOperation='lighter'; ctx.fillStyle=hg; ctx.fillRect(5,-5,50,11); ctx.globalCompositeOperation='source-over'; }
    ctx.restore();
    bl(); ctx.strokeStyle='#14161c'; ctx.lineWidth=0.7; ctx.stroke();
    ctx.strokeStyle=heat>0.5?rgba(heatRGB(1),0.95):'rgba(255,255,255,0.95)'; ctx.lineWidth=0.7;   // the mirror edge
    ctx.beginPath(); ctx.moveTo(6,4.8); ctx.lineTo(30,4.8); ctx.quadraticCurveTo(47,4.8,53.2,3.9); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fillRect(8,-4.3,30,0.6);                        // light on the spine
    ctx.restore();
  }
  B.drawKnifeArt=drawKnife;

  // ── seal / vine blocks; the pickups in the world ──────────────
  const _bw=window.drawBreakWall;
  if(_bw) window.drawBreakWall=function(bw){
    if(bw&&(bw.only==='seal'||bw.only==='vine')){
      if(bw.hp<=0) return;
      const x=sx(bw.x), y=sy(bw.y), w=sw(bw.w), h=sw(bw.h);
      if(bw.only==='seal'){
        ctx.fillStyle='#5a5866'; ctx.fillRect(x,y,w,h); ctx.fillStyle='#74727f'; ctx.fillRect(x,y,w,Math.max(1,h*0.18));
        ctx.strokeStyle='rgba(20,18,26,0.7)'; ctx.lineWidth=1; ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
        ctx.strokeStyle='rgba(200,60,70,0.35)'; ctx.beginPath(); ctx.moveTo(x+w*0.2,y+h*0.3); ctx.lineTo(x+w*0.5,y+h*0.6); ctx.lineTo(x+w*0.8,y+h*0.4); ctx.stroke();   // a rune line
      }else{
        ctx.fillStyle='#1c2a18'; ctx.fillRect(x,y,w,h);
        ctx.strokeStyle='#3e8a3a'; ctx.lineWidth=Math.max(2,sw(3));
        for(let k=0;k<3;k++){ ctx.beginPath(); for(let yy=0;yy<=h;yy+=3){ const xx=x+w*(0.2+0.3*k)+Math.sin((bw.y+yy)*0.15+k)*w*0.12; yy?ctx.lineTo(xx,y+yy):ctx.moveTo(xx,y+yy); } ctx.stroke(); }
        ctx.fillStyle='#6ac060'; for(let k=0;k<3;k++){ ctx.beginPath(); ctx.ellipse(x+w*(0.3+0.3*((k+bw.homeRow)%2)),y+h*(0.25+0.3*k),sw(3),sw(1.6),0.6,0,Math.PI*2); ctx.fill(); }
      }
      return;
    }
    return _bw.apply(this,arguments);
  };
  const _dmg=window._damageBwall;
  if(_dmg) window._damageBwall=function(bw,kind){
    if(bw&&bw.only==='seal') return;                               // only the boss's fall opens it
    if(bw&&bw.only==='vine'){ if(fr%6===0) burst(bw.x+16,bw.y+16,3,['#3a8a3a','#7ac060'],2); return; }   // only the knife cuts it
    return _dmg.apply(this,arguments);
  };
  // drawn in the world (with the sibling's overlay pass): the knife on its stone, the save point
  // Savrah (Paulo, Oct 31): a floppy disc, the classic save icon, with big blue hair and a big smile, floating on a
  // carpet and playing a flute. Walk up and she says AH, IT'S SO GOOD TO SEE YOU! and the moment goes into your timeline.
  function drawSavrah(s){
    const x=sx(s.x), y=sy(s.y), t=fr*0.06, bob=Math.sin(t)*sw(3), by=y-sw(30)+bob, near=s.say>0, wt=B.wtext||((f,...a)=>f(...a));
    // glow when she has just saved
    if(near){ const g=ctx.createRadialGradient(x,by,2,x,by,sw(70)); g.addColorStop(0,'rgba(120,200,255,0.35)'); g.addColorStop(1,'rgba(120,200,255,0)'); ctx.fillStyle=g; ctx.fillRect(x-sw(70),by-sw(70),sw(140),sw(140)); }
    // the carpet: deep red, gold edge and fringe, waving at the tips
    ctx.fillStyle='#8a1f3a'; ctx.fillRect(x-sw(26),by+sw(14),sw(52),sw(7)); ctx.fillStyle='#e8b84a'; ctx.fillRect(x-sw(26),by+sw(14),sw(52),sw(2)); ctx.fillRect(x-sw(26),by+sw(19),sw(52),sw(2));
    ctx.fillStyle='#4aa8d8'; for(let i=0;i<5;i++) ctx.fillRect(x-sw(20)+i*sw(10),by+sw(16),sw(4),sw(3));
    ctx.fillStyle='#e8b84a'; for(let i=0;i<9;i++){ const w=Math.sin(t*2+i)*sw(1.2); ctx.fillRect(x-sw(25)+i*sw(6),by+sw(21),sw(2),sw(4)+w); }
    // the hair: big blue strands behind and round the disc
    ctx.fillStyle='#2a7bd8';
    ctx.beginPath(); ctx.ellipse(x,by-sw(8),sw(20),sw(15),0,Math.PI,0); ctx.fill();
    for(const sd of [-1,1]){ ctx.beginPath(); ctx.moveTo(x+sd*sw(13),by-sw(10)); ctx.quadraticCurveTo(x+sd*sw(24),by+sw(2)+Math.sin(t+sd)*sw(2),x+sd*sw(19),by+sw(15)); ctx.lineTo(x+sd*sw(13),by+sw(8)); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle='#5aa8f8'; ctx.beginPath(); ctx.ellipse(x-sw(6),by-sw(15),sw(6),sw(3),-0.5,0,Math.PI*2); ctx.fill();
    // the floppy: dark blue body, cut corner, silver shutter, white label that is her face
    ctx.fillStyle='#22407c'; ctx.fillRect(x-sw(13),by-sw(12),sw(26),sw(26)); ctx.fillStyle='#16306a'; ctx.fillRect(x+sw(9),by-sw(12),sw(4),sw(4));
    ctx.fillStyle='#c8d2e0'; ctx.fillRect(x-sw(8),by-sw(12),sw(14),sw(8)); ctx.fillStyle='#6a7488'; ctx.fillRect(x+sw(1),by-sw(11),sw(3),sw(6));
    ctx.fillStyle='#f4f8ff'; ctx.fillRect(x-sw(10),by-sw(1),sw(20),sw(14));
    ctx.fillStyle='#1a2430'; ctx.fillRect(x-sw(6),by+sw(2),sw(3),sw(3)); ctx.fillRect(x+sw(3),by+sw(2),sw(3),sw(3));          // eyes
    ctx.fillStyle='#ff9aa8'; ctx.fillRect(x-sw(9),by+sw(6),sw(3),sw(2)); ctx.fillRect(x+sw(6),by+sw(6),sw(3),sw(2));            // cheeks
    ctx.strokeStyle='#1a2430'; ctx.lineWidth=Math.max(1,sw(1.6)); ctx.beginPath(); ctx.arc(x,by+sw(6),sw(5),0.15*Math.PI,0.85*Math.PI); ctx.stroke();   // the big smile
    // the flute, held out to her right, with notes drifting up
    ctx.save(); ctx.translate(x+sw(12),by+sw(8)); ctx.rotate(-0.35+Math.sin(t*1.5)*0.06);
    ctx.fillStyle='#d8dce8'; ctx.fillRect(0,-sw(1.5),sw(30),sw(3)); ctx.fillStyle='#6a7488'; for(let i=0;i<4;i++) ctx.fillRect(sw(8)+i*sw(5),-sw(1.5),sw(2),sw(3)); ctx.restore();
    for(let i=0;i<3;i++){ const u=((fr*0.02+i/3)%1), nx=x+sw(34)+Math.sin(u*6+i)*sw(5), ny=by-sw(2)-u*sw(34);
      ctx.globalAlpha=1-u; ctx.fillStyle='#bfe6ff'; ctx.beginPath(); ctx.ellipse(nx,ny,sw(2.6),sw(2),-0.4,0,Math.PI*2); ctx.fill(); ctx.fillRect(nx+sw(2),ny-sw(7),sw(1.2),sw(7)); ctx.globalAlpha=1; }
    // what she says
    if(near){ const txt=s.gift?"IT'S SO NICE TO SEE YOU! HERE'S A BATTERY!":"AH, IT'S SO GOOD TO SEE YOU!", w=Math.min(W-20,Math.max(sw(190),txt.length*9+24)), bx=Math.max(10,Math.min(W-w-10,x-w/2)), bY=by-sw(66);
      ctx.fillStyle='rgba(8,14,28,0.88)'; ctx.fillRect(bx,bY,w,26); ctx.strokeStyle='#7ac8ff'; ctx.lineWidth=1.5; ctx.strokeRect(bx,bY,w,26);
      ctx.fillStyle='rgba(8,14,28,0.88)'; ctx.beginPath(); ctx.moveTo(x-6,bY+26); ctx.lineTo(x+6,bY+26); ctx.lineTo(x,bY+34); ctx.fill();
      wt(drawTextC,txt,bx+w/2,bY+9,'#e8f4ff',1); }
  }
  const _hud=window.drawLdtkLabHud;
  window.drawLdtkLabHud=function(){
    const r=_hud.apply(this,arguments);
    try{
      if(!B.on) return r;
      const k=B.knifePickup;
      if(k&&!k.got){ const x=sx(k.x), y=sy(k.y);
        ctx.fillStyle='#3a3440'; ctx.fillRect(x-sw(22),y-sw(14),sw(44),sw(14)); ctx.fillStyle='#4e4858'; ctx.fillRect(x-sw(22),y-sw(14),sw(44),sw(3));   // the stone
        const g=ctx.createRadialGradient(x,y-sw(40),2,x,y-sw(40),sw(60)); g.addColorStop(0,'rgba(255,170,90,'+(0.3+0.1*Math.sin(fr*0.1))+')'); g.addColorStop(1,'rgba(255,170,90,0)'); ctx.fillStyle=g; ctx.fillRect(x-sw(60),y-sw(100),sw(120),sw(100));
        ctx.save(); ctx.translate(x,y-sw(14)); ctx.rotate(-Math.PI/2); drawKnife(0,0,sw(1.2)); ctx.restore(); }   // standing in the stone, blade up
      const s=B.savePt;
      if(s) drawSavrah(s);
      // the sum behind the charged slash, shown while it charges
      if(ITEM===4&&B.knifeHeat&&B.knifeHeat()>0&&B.knifeSum){ const k=B.knifeSum(), pw=Math.round(B.knifePower()*100);
        (B.wtext||((f,...a)=>f(...a)))(drawTextC,'KNIFE POWER '+pw+'%   '+k.got+' / '+k.need+' SEEDS + CRYSTALS',W/2,H-110,'#ffd080',1); }
    }catch(er){ if(!B._hudWarn){ B._hudWarn=1; console.warn('foes hud',er); } }
    return r;
  };
  // T440: Savrah's dialog box. The stage holds while it is open; any button closes it (after half a
  // second, so a held jump doesn't skip it), and that press doesn't carry into the stage.
  const SAVE_MIN=30;
  function saveDlgKey(){
    if(typeof readGamepad==='function') try{ readGamepad(); }catch(e){}
    let any=false; for(const k in Kj) if(Kj[k]){ any=true; break; }
    if(typeof clkj==='function') clkj();
    return any;
  }
  { const _upd=window.update;
    window.update=function(){
      const d=B.saveDlg;
      if(d&&B.on&&_gameState==='game'&&!(typeof _paused!=='undefined'&&_paused)){
        d.t++;
        if(saveDlgKey()&&d.t>SAVE_MIN){ B.saveDlg=null; for(const k in K) delete K[k]; for(const k in Kj) delete Kj[k]; try{ S('menu'); }catch(e){} }
        if(typeof fr!=='undefined') fr++;
        return;
      }
      if(d&&!B.on) B.saveDlg=null;
      return _upd.apply(this,arguments);
    }; }
  function drawSaveDlg(){
    const d=B.saveDlg; if(!d) return;
    const a=Math.min(1,d.t/10), pw=Math.min(600,W-40), ph=200, px=Math.round(W/2-pw/2), py=Math.round(H*0.5-ph/2+(1-a)*24);
    ctx.save(); ctx.globalAlpha=a;
    ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(0,0,W,H);
    uiPanel(px,py,pw,ph,{r:16,alpha:0.92,accent:'rgba(96,208,255,0.6)'});
    drawTextC('SAVRAH',W/2,py+18,'#60d0ff',3);
    d.lines.forEach((l,i)=>drawTextC(l,W/2,py+64+i*28,'#f2ffe8',2));
    if(d.t>SAVE_MIN){ ctx.globalAlpha=a*(0.65+0.35*Math.sin(fr*0.12)); drawTextC(!(typeof _uiDev!=='undefined'&&_uiDev==='touch')?'PRESS ANY BUTTON':'TAP TO GO ON',W/2,py+ph-34,'#ffe39a',2); }
    ctx.restore();
  }
  B.drawSaveDlg=drawSaveDlg;
  // the boss's energy bar, over the HUD while it's awake
  const _drawHUD=window.drawHUD;
  window.drawHUD=function(){
    const r=_drawHUD.apply(this,arguments);
    try{ drawSaveDlg(); }catch(er){}
    try{
      const e=B.on&&B.bossOn&&ENEMS.find(q=>q&&q._boss&&q.alive);
      if(e){ const w=420, x=W/2-w/2, y=H-64, f=Math.max(0,e.hp/e.mhp);
        ctx.fillStyle='rgba(6,4,12,0.8)'; ctx.fillRect(x-6,y-18,w+12,34);
        drawTextC('THE HEPTAGON',W/2,y-14,'#ff8a96',1);
        ctx.fillStyle='#2a1018'; ctx.fillRect(x,y,w,10); ctx.fillStyle=f>0.5?'#e03a4a':'#ff7a3a'; ctx.fillRect(x,y,w*f,10);
        ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.fillRect(x,y,w*f,3); }
    }catch(er){}
    return r;
  };
  const _uk=window.updateKnowls;
  window.updateKnowls=function(){ const r=_uk.apply(this,arguments); try{ knifeTick(); pickups(); }catch(er){ console.warn('knife',er); } return r; };
})();
