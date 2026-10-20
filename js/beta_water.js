// ============================================================
//  beta_water.js — G · moving platforms, water and the Isolator (Awdjoo 1.2)
//
//  Moving platforms: steady back-and-forth over the range drawn in the sketch
//  (all the same width). MIND rides them, jumps off them, and the RCA hook
//  can bite them and rides along.
//
//  Water (Paulo): MIND sinks slowly, as if underwater. The pool is a real
//  volume of water in columns: whatever goes in takes up room, so the water
//  it pushes aside bulges up around it and flows off across the pool; when
//  it comes out, the water rushes back into the hole it left. Splashes push
//  water out of the impact point (a crater and rings), the XLR stirs a
//  current, the MAG sucks water up off the surface to its tip (the pool
//  really loses that water until it falls back), and the RCA hook drags,
//  bends and can skip off the surface. Seeds float, crystals and cubes sink.
//  Electricity: MIND is a speaker — without the Isolator, water shorts him
//  (sparks, energy draining, and he shuts down if he stays in). Enemies
//  short out the moment they hit the water. A TRS laser into the water
//  electrifies the whole pool for a moment. With the Isolator wrapped
//  around him, MIND is safe — even in an electrified pool.
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B) return;
  const T=32;
  const on=()=>B.on&&typeof p!=='undefined'&&p;
  B.platforms=[]; B.waters=[]; B.isoPickup=null; B.hasIsolator=false; B.bubbles=[];

  // ── Level hooks ────────────────────────────────────────────────
  B.onLevelStart=function(){ B.platforms=[]; B.waters=[]; B.isoPickup=null; B.hasIsolator=false; B.isoT=0; B.bubbles=[]; B.ridePlat=null; B.xBub=null; B.wRings=[]; };
  B.onEntities=function(ents, F, cell){
    for(const e of ents){
      const g=cell(e), id=e.__identifier;
      if(id==='MovingPlatform'){
        const a=(F(e,'a')??g.c)*T, b=(F(e,'b')??g.c)*T;
        B.platforms.push({x:g.c*T, y:g.r*T, w:g.w*T, h:14, a, b, dir:1, spd:(F(e,'speed')||12)/10, dx:0});
      }else if(id==='Water'){
        const w={c0:g.c, c1:g.c+g.w-1, r0:g.r, r1:g.r+g.h-1, x0:g.c*T, x1:(g.c+g.w)*T, base:g.r*T, level:g.r*T,
          elec:0, n:0, s:[], amt:[], occ:[], flux:[], pull:[], bottom:[], step:8};
        w.n=Math.ceil((w.x1-w.x0)/w.step);
        B.waters.push(w);
      }else if(id==='Isolator'){
        B.isoPickup={x:g.c*T+T/2, y:(g.r+1)*T, got:false};
      }
    }
    // pool floor per column: the first solid cell, but never below the water
    // entity's own bottom (a pit under the pool stays a pit, not a water slab)
    // Shores: past each side of the pool the floor carries on at about the
    // rim's height. Those floor columns join the pool (dry at first), so water
    // pushed up over the rim really spills out onto the floor — and runs back
    // in when the pool settles. A wall (solid above the rim) or a drop ends it.
    const shoreFloor=(c,w)=>{ if(gridSolid(c,w.r0-1)||gridSolid(c,w.r0-2)) return null;
      for(let r=w.r0;r<=w.r0+2;r++) if(gridSolid(c,r)) return r; return null; };
    for(const w of B.waters){
      let L=0,R=0;
      while(L<8&&shoreFloor(w.c0-L-1,w)!=null) L++;
      while(R<8&&shoreFloor(w.c1+R+1,w)!=null) R++;
      w.px0=w.x0; w.px1=w.x1; w.x0-=L*T; w.x1+=R*T; w.n=Math.ceil((w.x1-w.x0)/w.step);
      for(let i=0;i<w.n;i++){
        const x=Math.min(w.x1-1,w.x0+i*w.step+w.step/2), c=Math.floor(x/T);
        let r;
        if(x<w.px0||x>=w.px1){ r=shoreFloor(c,w); }
        else{ r=w.r0; while(r<=w.r1&&!gridSolid(c,r)) r++; }
        w.bottom.push(r*T);
        w.amt.push(Math.max(0,r*T-w.base)); w.occ.push(0); w.flux.push(0); w.pull.push(0); w.s.push(Math.min(w.base,r*T));
      }
      w.open=w.bottom.map((b,i)=>b>w.r1*T);                // columns with the pit under them
      w.vol0=w.amt.reduce((a,b)=>a+b,0);
    }
  };

  // ── Water queries ──────────────────────────────────────────────
  const colOf=(w,x)=>Math.max(0,Math.min(w.n-1,Math.floor((x-w.x0)/w.step)));
  function surfaceAt(w,x){ return w.s[colOf(w,x)]; }
  function waterAt(x,y){
    for(const w of B.waters){
      if(x<w.x0||x>=w.x1) continue;
      const i=colOf(w,x);
      if(y>w.s[i]&&y<w.bottom[i]) return w;
    }
    return null;
  }
  B.surfaceAt=(x)=>{ for(const w of B.waters) if(x>=w.x0&&x<w.x1) return surfaceAt(w,x); return null; };
  B.inWater=(x,y)=>!!waterAt(x,y);
  // how much of MIND is under water (0..1) and which pool
  function mindDepth(){
    const feet=p.y+FEET_OFF, top=feet-(STAND_H+WHEEL_R), cx=p.x+SW/2;
    for(const w of B.waters){
      if(cx<w.x0||cx>=w.x1) continue;
      const s=surfaceAt(w,cx);
      const i=colOf(w,cx);
      if(feet<=s||top>=w.bottom[i]) continue;
      return {w, f:Math.max(0,Math.min(1,(feet-s)/(feet-top))), s};
    }
    return {w:null,f:0,s:0};
  }
  B.mindDepth=()=>on()?mindDepth():{f:0};

  // ── Moving platforms ──────────────────────────────────────────
  function ridingPlat(pl){
    if(!pl||pl!==p) return null;
    const feet=pl.y+FEET_OFF, cx=pl.x+SW/2;
    for(const m of B.platforms) if(cx>=m.x-8&&cx<=m.x+m.w+8&&Math.abs(feet-m.y)<=3&&(pl.vy||0)>=-0.01) return m;
    return null;
  }
  const _origGrounded=window._playerGrounded;
  window._playerGrounded=function(pl){
    if(on()&&pl===p&&ridingPlat(pl)) return true;
    return _origGrounded.apply(this, arguments);
  };
  function platformTick(){
    for(const m of B.platforms){
      const x0=m.x;
      m.x+=m.spd*m.dir;
      if(m.x>=m.b){ m.x=m.b; m.dir=-1; } else if(m.x<=m.a){ m.x=m.a; m.dir=1; }
      m.dx=m.x-x0;
    }
    const m=ridingPlat(p);
    if(m){ p.x+=m.dx; B.ridePlat=m; } else B.ridePlat=null;
    // the hook rides the platform it bit
    const h=p.hook;
    if(h&&h.st==='on'&&!h.tgt){
      if(!h._mplatChecked){
        h._mplatChecked=true; h._mplat=null;
        for(const q of B.platforms) if(h.ax>=q.x-3&&h.ax<=q.x+q.w+3&&h.ay>=q.y-3&&h.ay<=q.y+q.h+3){ h._mplat=q; h._mdx=h.ax-q.x; h._mdy=h.ay-q.y; break; }
      }
      if(h._mplat){ h.ax=h._mplat.x+h._mdx; h.ay=h._mplat.y+h._mdy; h.ex=h.ax; h.ey=h.ay; if(h._path&&h._path[0]){ h._path[0].x=h.ax; h._path[0].y=h.ay; } }
    }else if(h){ h._mplatChecked=false; h._mplat=null; }
  }
  // the hook can bite a moving platform
  const _origRay=window._hookRayHit;
  window._hookRayHit=function(x1,y1,x2,y2){
    const best=_origRay.apply(this, arguments);
    if(!on()||typeof _segAabbHit!=='function') return best;
    let out=best, bd=best?Math.hypot(best.tx-x1,best.ty-y1):1e9;
    for(const m of B.platforms){
      const hit=_segAabbHit(x1,y1,x2,y2,{x:m.x,y:m.y,w:m.w,h:m.h,tp:'solid'});
      if(!hit) continue;
      const d=Math.hypot(hit.tx-x1,hit.ty-y1);
      if(d>=6&&d<bd){ bd=d; out={tx:hit.tx,ty:hit.ty,nx:hit.nx||0,ny:hit.ny||0,enemy:false,tgt:null,plat:null}; }
    }
    return out;
  };

  // ── Movement wrapper: water drag + landing on platforms ─────────
  const _origMove=window._movePlayerWithColl;
  window._movePlayerWithColl=function(pl,vx,vy){
    if(!on()||pl!==p) return _origMove.apply(this, arguments);
    const dpt=mindDepth();
    if(dpt.f>0.25){
      // underwater: gravity mostly cancelled by buoyancy, a gentle sink, heavy drag
      const f=Math.min(1,dpt.f);
      pl.vy-=GRAV*0.74*f; vy=pl.vy;
      if(pl.vy>1.6) pl.vy=vy=1.6;
      if(pl.vy<-7) pl.vy=vy=-7;
      pl.vx*=1-0.07*f; vx=pl.vx;
    }
    const y0=pl.y, riding=B.ridePlat;
    _origMove.call(this, pl, vx, vy);
    const feet0=y0+FEET_OFF, feet=pl.y+FEET_OFF, cx=pl.x+SW/2;
    for(const m of B.platforms){
      if(cx<m.x-8||cx>m.x+m.w+8) continue;
      const landing=(vy>=0)&&feet0<=m.y+3&&feet>=m.y-1;
      const staying=riding===m&&vy>=0&&Math.abs(feet-m.y)<=8;
      if(landing||staying){
        pl.y=m.y-FEET_OFF; if(pl.vy>0) pl.vy=0; pl.og=true; B.ridePlat=m;
        if(landing&&!staying&&vy>4){ try{ sfx('land'); }catch(e){} }
        break;
      }
    }
  };

  // ── Water life: displacement, waves, splashes, currents, electricity ──
  // Displacement uses a generous body box so you can see the level move.
  const DISP=1.6;
  function bodies(){
    const out=[];
    if(p){ const feet=p.y+FEET_OFF; out.push({ref:p, x:p.x+SW/2-26, y:feet-100, w:52, h:100, m:(B.WEIGHT&&B.WEIGHT.mindTotal)||9.5, vx:p.vx||0, vy:p.vy||0, me:true}); }
    for(const bw of BWALLS) if(bw.cube&&bw.hp>0&&!bw._carried){ const x=bw.x+(bw._ox||0), y=bw.y+(bw._oy||0); out.push({ref:bw, x, y, w:T, h:T, m:B.weightOf?B.weightOf('cube',bw):3, vx:bw.vx||0, vy:bw.vy||(bw._fallN?4:0)}); }
    for(const e of ENEMS){ if(e._betaHeld) continue; out.push({ref:e, x:e.x, y:e.y, w:e.w, h:e.h, m:B.weightOf?B.weightOf('enemy',e):6, vx:e.vx||0, vy:e.vy||0, enemy:true}); }
    for(const k of KDROP){ if(k.got&&!k._fly) continue; out.push({ref:k, x:k.x-10, y:k.y-10, w:20, h:20, m:0.5, vx:k.vx||0, vy:k.vy||0}); }
    return out;
  }
  function overlap(a0,a1,b0,b1){ return Math.max(0,Math.min(a1,b1)-Math.max(a0,b0)); }
  // an impact pushes water out of the hit columns (crater + rings both ways);
  // coming out, water rushes back in (up=true)
  function splash(w,x,power,up){
    const i=colOf(w,x), P=power*(up?-0.35:0.55);
    if(i>0) w.flux[i-1]-=P; if(i<w.n-1) w.flux[i]+=P;
    if(i>1) w.flux[i-2]-=P*0.4; if(i<w.n-2) w.flux[i+1]+=P*0.4;
    const n=Math.min(18,4+power*2|0), s=surfaceAt(w,x);
    for(let k=0;k<n;k++){ const a=-Math.PI*(0.15+Math.random()*0.7);
      PFXS.push({x:x+(Math.random()-0.5)*24,y:s-2,vx:Math.cos(a)*(1+Math.random()*2.5),vy:Math.sin(a)*(1.5+Math.random()*power*0.5),life:18+Math.random()*12|0,maxLife:30,r:1.5+Math.random()*2,col:k%3?'#9ad8ff':'#e8f6ff'}); }
    try{ if(power>1.5&&window.MV_BETA_AUDIO&&MV_BETA_AUDIO.splash) MV_BETA_AUDIO.splash(Math.min(1,power/8)); }catch(e){}
  }
  // ── MAG: suck water up to the tip ─────────────────────────────
  // Close above the surface the magnet draws the water up into a hump under
  // its tip; water that reaches the tip clings to it as a wobbling blob (the
  // pool really is lower by that much) and costs extra power to hold. Let go
  // and it falls: back into a pool it pours in, on dry ground it splashes and
  // trickles back to the pool it came from.
  B.magWater={area:0, x:0, y:0, src:null, drops:[], trickle:[]};
  function magnetWater(w){
    const M=B.magWater, held=!!(p&&p.magOn&&ITEM===3&&B.magTip);
    if(!held) return;
    const t=B.magTip(); if(t.x<w.x0-40||t.x>w.x1+40) return;
    const pw=Math.max(0,Math.min(1,(p.itemStamina||0)/100));
    const cap=2600*pw;                                       // px² of water the tip can hold
    const reach=150;
    for(let i=0;i<w.n;i++){
      const cx=w.x0+(i+0.5)*w.step, dx=cx-t.x, gap=w.s[i]-t.y;  // gap > 0: tip is above the surface
      if(Math.abs(dx)>110||gap<-20||gap>reach) continue;
      const k=(1-Math.abs(dx)/110)*(1-Math.max(0,gap)/reach);
      w.pull[i]=k*k*55*pw;                                   // looks "lower" → water flows in → hump
      if(gap<16&&Math.abs(dx)<26&&M.area<cap&&w.amt[i]>4){   // it reaches the tip: take it
        const take=Math.min(w.amt[i]-4,1.6*pw+0.4); w.amt[i]-=take; M.area+=take*w.step; M.src=w;
        if(fr%2===0) M.drops.push({x:cx+(Math.random()-0.5)*10,y:w.s[i],vy:-2-Math.random()*2});
      }
    }
  }
  function magWaterTick(){
    const M=B.magWater, held=!!(p&&p.magOn&&ITEM===3&&B.magTip);
    if(M.area>0){
      if(held){
        const t=B.magTip(); M.x=t.x; M.y=t.y; M.vx=(p.vx||0); M.vy=(p.vy||0);
        p.itemStamina=Math.max(0,(p.itemStamina||0)-M.area/2600*0.12);
        if(fr%9===0) PFXS.push({x:M.x+(Math.random()-0.5)*12,y:M.y+6,vx:0,vy:1.5,life:16,maxLife:16,r:2,col:'#9ad8ff'});
      }else{                                                  // let go: it falls as one mass of water
        M.vy=Math.min((M.vy||0)+GRAV*0.8,14); M.x+=M.vx||0; M.y+=M.vy; M.vx=(M.vx||0)*0.99;
        const w=waterAt(M.x,M.y+4);
        if(w){ const i=colOf(w,M.x), n=Math.max(1,Math.ceil(Math.sqrt(M.area)/w.step));
          for(let k=-n;k<=n;k++){ const j=i+k; if(j>=0&&j<w.n) w.amt[j]+=M.area/w.step/(2*n+1); }
          splash(w,M.x,Math.min(9,Math.sqrt(M.area)*0.12+M.vy*0.4),false); M.area=0; }
        else if(typeof gridWorldSolid==='function'&&gridWorldSolid(M.x,M.y+Math.sqrt(M.area)*0.5)){
          for(let k=0;k<20;k++){ const a=-Math.PI*Math.random(); PFXS.push({x:M.x,y:M.y,vx:Math.cos(a)*3,vy:Math.sin(a)*3,life:22,maxLife:22,r:2+Math.random()*2,col:'#9ad8ff'}); }
          try{ if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.splash(0.6); }catch(e){}
          if(M.src) M.trickle.push({w:M.src, area:M.area}); M.area=0;
        }
      }
    }
    for(let i=M.trickle.length-1;i>=0;i--){                  // spilt water finds its way back
      const tr=M.trickle[i], d=Math.min(tr.area,30), w=tr.w, j=fr%2?0:w.n-1;
      w.amt[j]+=d/w.step; tr.area-=d; if(tr.area<=0) M.trickle.splice(i,1);
    }
    for(let i=M.drops.length-1;i>=0;i--){ const d=M.drops[i]; d.y+=d.vy; d.x+=(M.x-d.x)*0.18; d.vy-=0.05; if(Math.abs(d.y-M.y)<10||d.y<M.y-30) M.drops.splice(i,1); }
  }

  // ── XLR + MAG move the water itself ───────────────────────────
  // XLR held under water: a jet. The water it pushes piles up downstream and
  // thins out behind the tip (you see the surface lean and ripples run off);
  // aimed up it heaves a mound over the jet, aimed down it opens a dip. Held
  // just above the surface and aimed at it, it blows a crater with spray.
  // Letting go of a charged push under water sends one big surge.
  // MAG held under water: it draws the water in toward its tip — the surface
  // sinks into a dimple over it, ripples run inward, and a swirl of bubbles
  // spirals into the poles.
  function colFlux(w,i,v){ if(i>=0&&i<w.n-1) w.flux[i]+=v; }
  function itemWater(w){
    if(!p) return;
    const xlr=!!(p.xlrOn&&ITEM===2&&typeof connectorTipWorld==='function');
    const mag=!!(p.magOn&&ITEM===3&&B.magTip);
    const ch=Math.min(1,(B.chX||0)/45);
    // a charged XLR push released under / onto the water: one big surge
    if(B._xlrFr!==fr){                                         // once a frame, for every pool
      B._xlrRel=(B._xlrWas&&!xlr&&B._xlrCh>0.25&&B._xlrTipW)?{tip:B._xlrTip,w:B._xlrTipW,ch:B._xlrCh}:null;
      B._xlrWas=xlr; B._xlrCh=xlr?ch:0; B._xlrFr=fr; B._xlrTipW=null;
    }
    if(B._xlrRel&&B._xlrRel.w===w){ surge(w,B._xlrRel.tip,B._xlrRel.ch); B._xlrRel=null; }
    if(xlr){
      const t=connectorTipWorld(2), a=Math.atan2(p.aimDY,p.aimDX), ux=Math.cos(a), uy=Math.sin(a);
      if(!B._xlrTipW) B._xlrTip={x:t.x,y:t.y,ux,uy};
      const pw=0.45+0.55*ch;
      if(waterAt(t.x,t.y)===w){
        B._xlrTipW=w;
        const i0=colOf(w,t.x), pulse=0.75+0.25*Math.sin(fr*0.35);   // a throb, so ripples run off it
        // horizontal: move water downstream along the jet
        for(let k=0;k<12;k++){ const x=t.x+ux*k*16, i=colOf(w,x); if(x<w.x0||x>=w.x1) break; colFlux(w,ux>0?i:i-1,ux*2.8*pw*pulse*(1-k/14)); }
        // the blast blows a pocket of air out of the nozzle: it grows with the
        // charge to 3x3 blocks at full power, and the water it pushes out of
        // that space has to go somewhere — the whole pool rises and sloshes
        let b=B.xBub;
        if(!b||b.free||b.w!==w){ b=B.xBub={w,x:t.x,y:t.y,r:6,free:false,vx:0,vy:0}; }
        const goal=8+40*ch; b.r+=(goal-b.r)*0.12; b.held=fr;
        b.x=t.x+ux*b.r*0.9; b.y=t.y+uy*b.r*0.9; b.ux=ux; b.uy=uy;
        if(fr%14===0) ring(w,b.x,b.y,'air',0.5+ch);
        if(fr%3===0) for(let k=0;k<2;k++) B.bubbles.push({x:t.x+ux*(18+Math.random()*30),y:t.y+uy*(18+Math.random()*30),r:2+Math.random()*3,vy:-0.3+uy*2,vx:ux*3,w});
      }else if(uy>0.25){
        // above the water, blowing at it: where does the blast meet the surface?
        let hx=null, hy=null;
        for(let d=8;d<170;d+=8){ const x=t.x+ux*d, y=t.y+uy*d; if(x<w.x0||x>=w.x1) continue; if(y>=w.s[colOf(w,x)]){ hx=x; hy=y; break; } }
        if(hx!=null){
          B._xlrTipW=w; B._xlrTip={x:hx,y:hy,ux,uy};
          const d=Math.hypot(hx-t.x,hy-t.y), k0=(1-d/170)*pw, i=colOf(w,hx);
          for(let k=-3;k<=3;k++){ const j=i+k; if(j>=0&&j<w.n) w.pull[j]-=60*k0*(1-Math.abs(k)/4); }
          colFlux(w,i,1.2*k0+ux*0.8*k0); colFlux(w,i-1,-1.2*k0+ux*0.8*k0);
          if(fr%2===0){ const sp=w.s[i]; for(let k=0;k<3;k++){ const a2=-Math.PI*(0.2+Math.random()*0.6)+ux*0.4; PFXS.push({x:hx+(Math.random()-0.5)*20,y:sp-2,vx:Math.cos(a2)*(1.5+Math.random()*2.5*k0),vy:Math.sin(a2)*(2+Math.random()*3*k0),life:18+Math.random()*10|0,maxLife:28,r:1.5+Math.random()*2,col:k%2?'#bfe6ff':'#ffffff'}); } }
        }
      }
    }
    if(mag){
      const t=B.magTip();
      if(waterAt(t.x,t.y)===w){
        const pw=Math.max(0.2,Math.min(1,(p.itemStamina||0)/100)), i0=colOf(w,t.x);
        const depth=Math.max(0,t.y-w.s[i0]), reach=Math.max(0.15,1-depth/260);
        for(let k=-6;k<=6;k++){ const j=i0+k; if(j<0||j>=w.n) continue; w.pull[j]-=52*pw*reach*(0.8+0.2*Math.sin(fr*0.3))*(1-Math.abs(k)/7); }   // dimple over the tip
        for(let k=1;k<=10;k++){ colFlux(w,i0-k,0.8*pw*(1-k/11)); colFlux(w,i0+k-1,-0.8*pw*(1-k/11)); }      // water runs in from both sides
        if(fr%18===0) ring(w,t.x,t.y,'mag',0.4+0.6*pw);
        if(fr%2===0){                                           // molecules spiralling into the poles
          const ang=fr*0.21, r=26+Math.random()*30;
          B.bubbles.push({x:t.x+Math.cos(ang)*r,y:t.y+Math.sin(ang)*r,r:1.5+Math.random()*2,vy:0,vx:0,w,to:{x:t.x,y:t.y},ang,rad:r});
        }
      }
    }
  }
  // ── the XLR's air pocket ───────────────────────────────────────
  // Held: it sits on the nozzle. Let go: it floats up, wobbling, and bursts
  // at the surface. While it exists its volume is taken out of the pool, so
  // the water around it is shoved out and away in every direction.
  function cavityOcc(w){
    const b=B.xBub; if(!b||b.w!==w) return;
    const i0=colOf(w,b.x-b.r), i1=colOf(w,b.x+b.r);
    for(let i=i0;i<=i1;i++){
      const dx=w.x0+(i+0.5)*w.step-b.x; if(Math.abs(dx)>=b.r) continue;
      const h=Math.sqrt(b.r*b.r-dx*dx);
      if(w.amt[i]>0.5) w.occ[i]+=overlap(b.y-h,b.y+h,w.level-2,w.bottom[i]);
    }
  }
  function airBubbleTick(){
    const b=B.xBub; if(!b) return;
    if(!b.free&&b.held!==fr-1&&b.held!==fr){                   // let go (or the nozzle left the water)
      b.free=true; b.vx=(b.ux||0)*3; b.vy=(b.uy||0)*3-0.5;
      ring(b.w,b.x,b.y,'air',1.6);
    }
    if(!b.free) return;
    const w=b.w;
    b.vy=Math.max(-5,b.vy-0.14); b.vx*=0.95; b.x+=b.vx; b.y+=b.vy;
    b.x=Math.max(w.x0+b.r*0.5,Math.min(w.x1-b.r*0.5,b.x));
    if(fr%3===0) B.bubbles.push({x:b.x+(Math.random()-0.5)*b.r,y:b.y+b.r*0.8,r:1.5+Math.random()*2,vy:-1,w});
    const s=surfaceAt(w,b.x);
    if(b.y-b.r*0.2<s){                                          // bursts through the surface
      splash(w,b.x,Math.min(9,2+b.r*0.14),true);
      for(let k=0;k<Math.round(6+b.r/3);k++){ const a=-Math.PI*(0.1+Math.random()*0.8); PFXS.push({x:b.x+(Math.random()-0.5)*b.r,y:s-2,vx:Math.cos(a)*(1+Math.random()*3),vy:Math.sin(a)*(2+Math.random()*b.r*0.08),life:20+Math.random()*12|0,maxLife:32,r:1.5+Math.random()*2.5,col:k%3?'#bfe6ff':'#ffffff'}); }
      ring(w,b.x,s+4,'air',1.2);
      try{ if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.splash(Math.min(1,0.3+b.r/60)); }catch(e){}
      B.xBub=null;
    }
  }
  // ── ripples: rings that run out from the tip through the whole pool ──
  // Each ring is drawn inside the water and gives the surface a push outward
  // from the ring's centre, so the waves really travel across the pool.
  B.wRings=[];
  function ring(w,x,y,kind,k){
    if(!w) return;
    B.wRings.push({w,x,y,r:4,k,kind,life:60});
    const i=colOf(w,x), P=0.9*k;
    colFlux(w,i,P); colFlux(w,i-1,-P);
  }
  function ringsTick(){
    for(let j=B.wRings.length-1;j>=0;j--){ const g=B.wRings[j]; g.r+=3+g.k*1.2; g.life--; if(g.life<=0) B.wRings.splice(j,1); }
  }

  // one charged push released into the water: a surge of water + a ring
  function surge(w,tip,ch){
    const i=colOf(w,tip.x), P=3+7*ch;
    for(let k=0;k<10;k++){ colFlux(w,(tip.ux>0?i+k:i-k-1),tip.ux*P*(1-k/11)); }
    for(let k=-5;k<=5;k++){ const j=i+k; if(j>=0&&j<w.n) w.pull[j]+=(-(tip.uy||0))*60*ch*(1-Math.abs(k)/6); }
    splash(w,tip.x+(tip.ux||0)*30,2+4*ch,tip.uy<0);
    for(let k=0;k<14;k++){ const a=Math.random()*Math.PI*2; B.bubbles.push({x:tip.x+Math.cos(a)*10,y:tip.y+Math.sin(a)*10,r:2+Math.random()*4,vy:Math.sin(a)*2-1,vx:Math.cos(a)*3+(tip.ux||0)*4,w}); }
    try{ if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.splash(Math.min(1,0.4+ch)); }catch(e){}
  }

  // ── RCA hook (and enemy ropes) through water ──────────────────
  // Hitting the surface at a shallow, fast angle it skips off; going in it
  // splashes, bends toward the vertical and slows hard; under water it keeps
  // drifting on its momentum and sinks a little; if it runs out of push the
  // throw fails and it reels back.
  function ropeWater(o, vxKey, vyKey, onDead){
    const x=o.x, y=o.y, w=waterAt(x,y), was=o._wet;
    o._wet=!!w;
    if(w&&!was){
      const sp=Math.hypot(o[vxKey],o[vyKey]), down=o[vyKey]>0;
      if(down&&sp>9&&Math.abs(o[vyKey])<sp*0.28){                // skip off the surface
        o[vyKey]=-Math.abs(o[vyKey])*0.7; o[vxKey]*=0.8; o._wet=false; splash(w,x,1.2,true); return;
      }
      o[vxKey]*=0.5; o[vyKey]*=0.72;                         // refraction: water takes the sideways speed first
      splash(w,x,Math.min(5,sp*0.3),false);
    }
    if(w){
      o[vxKey]*=0.92; o[vyKey]=o[vyKey]*0.92+0.14;           // drag, a little sinking weight
      if(fr%3===0) B.bubbles.push({x,y,r:2+Math.random()*2,vy:-0.8,w});
      if(Math.hypot(o[vxKey],o[vyKey])<0.9&&onDead) onDead();
    }
  }
  function hookWaterTick(){
    const h=p&&p.hook;
    if(h&&h.st==='ext'){
      const o={x:h.ex,y:h.ey,ex:h.evx,ey:h.evy,_wet:h._wet};
      ropeWater(o,'ex','ey',()=>{ h.st='idle'; h.ox=NaN; h.oy=NaN; h.tgt=null; h.plat=null; h._path=null; h.pivots=null; h.vr=null; try{ sfx('hook_miss'); }catch(e){} });
      h.evx=o.ex; h.evy=o.ey; h._wet=o._wet;
    }else if(h) h._wet=false;
    for(const r of (B.ropes||[])){ if(r.st!=='fly') continue; ropeWater(r,'vx','vy',()=>{ r.t=999; }); }
  }

  function waterTick(){
    platformTick();
    isolatorTick();
    if(!B.waters.length) return;
    airBubbleTick(); ringsTick();
    hookWaterTick();
    magWaterTick();
    const list=bodies();
    for(const w of B.waters){
      // 1) what's in the water takes up room, column by column
      for(let i=0;i<w.n;i++) w.occ[i]=0;
      for(const b of list){
        const c0=Math.max(0,Math.floor((b.x-w.x0)/w.step)), c1=Math.min(w.n-1,Math.floor((b.x+b.w-w.x0)/w.step));
        if(c1<0||c0>=w.n||c1<c0) continue;
        for(let i=c0;i<=c1;i++){
          const cx0=w.x0+i*w.step, fx=overlap(b.x,b.x+b.w,cx0,cx0+w.step)/w.step;
          if(w.amt[i]>0.5) w.occ[i]+=overlap(b.y,b.y+b.h,w.level-2,w.bottom[i])*fx*0.9;   // vs the mean level: no feedback loop
        }
      }
      cavityOcc(w);                                          // the XLR's air bubble takes up room too
      // 2) splashes as things cross the surface
      for(const b of list){
        const cx=b.x+b.w/2, cy=b.y+b.h/2, inside=cx>=w.x0&&cx<w.x1&&cy>surfaceAt(w,cx);
        const was=b.ref._inW===w;
        if(inside&&!was&&Math.abs(b.vy)>0.6) splash(w,cx,Math.min(9,Math.abs(b.vy)*0.45*Math.sqrt(b.m)),false);
        if(!inside&&was&&b.vy<-1) splash(w,cx,Math.min(6,Math.abs(b.vy)*0.3*Math.sqrt(b.m)),true);
        b.ref._inW=inside?w:null;
        if(inside&&Math.abs(b.vx)>1.2&&fr%3===0&&Math.abs(cy-surfaceAt(w,cx))<b.h){ splash(w,cx+Math.sign(b.vx)*b.w/2,Math.abs(b.vx)*0.12,false); }
        if(inside&&(b.me||Math.abs(b.vx)+Math.abs(b.vy)>0.4)&&fr%(b.me?6:12)===0) B.bubbles.push({x:cx+(Math.random()-0.5)*b.w*0.6,y:cy,r:3+Math.random()*4,vy:-0.7-Math.random()*0.9,w});
      }
      // 3) the MAG pulls the surface up toward its tip, and takes what reaches it
      magnetWater(w);
      // 4) flow: water runs from high to low between columns (volume is kept;
      //    pressure = water + whatever displaced it, so bulges spread out and
      //    holes fill back in)
      for(let it=0;it<3;it++){
        for(let i=0;i<w.n;i++) w.s[i]=w.bottom[i]-w.amt[i]-w.occ[i];
        for(let i=0;i<w.n-1;i++){
          const sa=w.s[i]+w.pull[i], sb=w.s[i+1]+w.pull[i+1];
          w.flux[i]=w.flux[i]*0.975+(sb-sa)*0.1;
          let f=w.flux[i];                                     // can't move water that isn't there
          if(f>0&&f>w.amt[i]) f=w.flux[i]=w.amt[i];
          if(f<0&&-f>w.amt[i+1]) f=w.flux[i]=-w.amt[i+1];
          w.amt[i]-=f*0.5; w.amt[i+1]+=f*0.5;
        }
      }
      let lv=0, nw=0;
      for(let i=0;i<w.n;i++){ const wet=w.amt[i]>0.5; w.s[i]=w.bottom[i]-w.amt[i]-w.occ[i]+(wet?Math.sin(fr*0.04+i*0.45)*0.35:0); w.pull[i]=0; if(wet){ lv+=w.s[i]; nw++; } }   // + a living, slight lap
      w.level=nw?lv/nw:w.base;
      // 5) the jacks move the water itself (mass + ripples), under and over it
      itemWater(w);
      // ... and the XLR's current carries things along
      if(p&&p.xlrOn&&ITEM===2&&typeof connectorTipWorld==='function'){
        const t=connectorTipWorld(2), a=Math.atan2(p.aimDY,p.aimDX), ux=Math.cos(a), uy=Math.sin(a);
        if(waterAt(t.x,t.y)===w){
          for(const b of list){ if(b.me) continue;
            const dx=b.x+b.w/2-t.x, dy=b.y+b.h/2-t.y, d=Math.hypot(dx,dy); if(d>200||(dx*ux+dy*uy)/Math.max(1,d)<0.5) continue;
            const k=(1-d/200)*0.6/Math.max(1,b.m*0.4);
            if(b.enemy||b.ref.kind){ b.ref.vx=(b.ref.vx||0)+ux*k*3; b.ref.vy=(b.ref.vy||0)+uy*k*3; }
            else if(b.ref._fly){ b.ref.vx+=ux*k*3; b.ref.vy+=uy*k*3; } }
          p.vx-=ux*0.18; p.vy-=uy*0.18;                       // and the push shoves MIND back
          if(fr%4===0) splash(w,t.x+ux*40,0.4,false);
          if(fr%2===0) B.bubbles.push({x:t.x+ux*20,y:t.y+uy*20,r:2+Math.random()*2,vy:-0.4+uy*1.5,vx:ux*2.5,w});
        }
      }
      // 6) electricity
      for(const s of (p&&p.shots)||[]){
        if(s.type==='laser'&&s.life>0&&waterAt(s.x,s.y)===w){ w.elec=Math.max(w.elec,s.charged?90:55); s.life=0; zap(1); }
      }
      if(w.elec>0) w.elec--;
      for(const b of list){
        if(!b.enemy) continue;
        const e=b.ref, inside=waterAt(e.x+e.w/2,e.y+e.h*0.6)===w;
        if(e._ai==='circle'&&w.elec<=0) continue;              // Enemy A swims; only live current shorts it
        if(inside){
          if(e.alive){ if(typeof _damageEnemy==='function') _damageEnemy(e,9999,e.x+e.w/2,e.y); e._shorted=true; if(B.stats) B.stats.shortedEnemies=(B.stats.shortedEnemies||0)+1; zap(0.7); for(let k=0;k<10;k++) spark(e.x+e.w/2,e.y+e.h/2,24); }
          e._revT=0;                                           // no rebooting while soaked
          if(!e.alive){ e.vy=Math.min((e.vy||0),1.2); e.vx=(e.vx||0)*0.9; if(fr%9===0) spark(e.x+e.w/2,e.y+e.h/3,16); }
        }
      }
    }
    // MIND: short-circuit without the Isolator
    const dpt=mindDepth();
    B.mindWet=dpt.f;
    if(dpt.f>0.4){
      const live=dpt.w.elec>0;
      if(!B.hasIsolator){
        const drain=live?1.6:0.55;
        p.hp=Math.max(0,p.hp-drain);
        if(typeof _syncLivesFromHp==='function') _syncLivesFromHp(p);
        if(fr%3===0) spark(p.x+SW/2,p.y+FEET_OFF-50,30);
        if(fr%10===0) zap(live?0.9:0.5);
        if(p.hp<=0&&typeof applyPlayerHit==='function'){ p.hp=1; applyPlayerHit(0,-2,5); }
        B.shortT=8;
      }else if(live&&fr%4===0) spark(p.x+SW/2,p.y+FEET_OFF-50,34,'#8af');
    }
    if(B.shortT>0) B.shortT--;
    // swimming: a kick on jump, a stronger one to hop out at the surface
    if(dpt.f>0.3&&typeof isJumpJ==='function'&&isJumpJ()&&(B.kickCd||0)<=0){
      const out=dpt.f<0.75;
      p.vy=out?Math.min(p.vy,JI*1.9):Math.min(p.vy,-4.2); p.og=false; p._groundHold=0; B.kickCd=12;
      if(dpt.w) splash(dpt.w,p.x+SW/2,1.2,true);
      try{ sfx('jump_reg'); }catch(e){}
    }
    if(B.kickCd>0) B.kickCd--;
    // bubbles
    for(let i=B.bubbles.length-1;i>=0;i--){
      const b=B.bubbles[i];
      if(b.to){                                               // drawn into the magnet's poles
        b.ang+=0.18; b.rad*=0.9; b.x=b.to.x+Math.cos(b.ang)*b.rad; b.y=b.to.y+Math.sin(b.ang)*b.rad;
        if(b.rad<4){ B.bubbles.splice(i,1); } continue;
      }
      b.y+=b.vy; b.x+=(b.vx||0)+Math.sin(fr*0.1+i)*0.3; if(b.vx) b.vx*=0.95;
      if(!b.w||b.y<surfaceAt(b.w,b.x)) B.bubbles.splice(i,1);
    }
    if(B.bubbles.length>160) B.bubbles.splice(0,B.bubbles.length-160);
  }
  B.waterTick=waterTick;

  function spark(x,y,spread,col){
    for(let k=0;k<2;k++){ const a=Math.random()*Math.PI*2, r=Math.random()*spread;
      PFXS.push({x:x+Math.cos(a)*r,y:y+Math.sin(a)*r,vx:(Math.random()-0.5)*3,vy:(Math.random()-0.5)*3,life:6+Math.random()*6|0,maxLife:12,r:1.5,col:col||(Math.random()<0.5?'#fff27a':'#7ae0ff')}); }
  }
  // electric buzz (synth)
  let lastZap=0;
  function zap(k){
    try{
      const a=typeof ga==='function'?ga():null; if(!a||a.state!=='running') return;
      const t=a.currentTime; if(t-lastZap<0.08) return; lastZap=t;
      const o=a.createOscillator(), g=a.createGain(), o2=a.createOscillator();
      o.type='square'; o.frequency.setValueAtTime(110+Math.random()*60,t); o2.type='sawtooth'; o2.frequency.setValueAtTime(1800+Math.random()*900,t);
      const sv=Math.max(0,Math.min(1,OPT.sfxVol!=null?OPT.sfxVol:1));
      g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.05*sv*(0.5+k),t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+0.12);
      o.connect(g); o2.connect(g); g.connect(a.destination); o.start(t); o2.start(t); o.stop(t+0.13); o2.stop(t+0.13);
    }catch(e){}
  }

  // ── The Isolator pickup ───────────────────────────────────────
  // Paulo, Oct 2026: the Isolator works for 30 seconds, then it wears off.
  // The crate grows back 30 seconds after it's taken.
  const ISO_TIME=1800, ISO_RESPAWN=1800;                   // frames (60 fps)
  B.ISO_TIME=ISO_TIME;
  function isolatorTick(){
    const iso=B.isoPickup;
    if(B.hasIsolator){                                     // wearing off
      B.isoT=(B.isoT||0)-1;
      if(B.isoT===300||B.isoT===120) try{ zap(0.3); }catch(e){}
      if(B.isoT<=0){
        B.hasIsolator=false; B.isoT=0;
        if(p) for(let k=0;k<14;k++){ const a=Math.random()*Math.PI*2, s=1+Math.random()*2.5; PFXS.push({x:p.x+SW/2+Math.cos(a)*24,y:p.y+FEET_OFF-50+Math.sin(a)*30,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:20+Math.random()*10|0,maxLife:30,r:2+Math.random()*2,col:'#c86a30'}); }
        if(typeof uiShowToast==='function') uiShowToast('THE ISOLATOR WORE OFF - A NEW ONE GROWS BACK SOON');
      }
    }
    if(iso&&iso.got&&iso.re>0){                            // the crate grows back
      iso.re--;
      if(iso.re<=0){ iso.got=false; iso.pop=20;
        for(let k=0;k<12;k++){ const a=Math.random()*Math.PI*2; PFXS.push({x:iso.x,y:iso.y-20,vx:Math.cos(a)*2,vy:Math.sin(a)*2-1,life:18,maxLife:18,r:2,col:'#ffa040'}); } }
    }
    if(!iso||iso.got||!p) return;
    const core=playerCoreHB(p), feet=p.y+FEET_OFF;
    if(ov(core.x-4,core.y,core.w+8,feet+6-core.y,iso.x-23,iso.y-40,46,40)){
      iso.got=true; iso.re=ISO_RESPAWN; B.hasIsolator=true; B.isoT=ISO_TIME;
      if(!B.isoEver){ B.isoEver=true; B.stats.items++; }
      for(let k=0;k<16;k++){ const a=Math.random()*Math.PI*2, s=1.6+Math.random()*3; PFXS.push({x:iso.x,y:iso.y-20,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,life:16+Math.random()*12|0,maxLife:28,r:2+Math.random()*2,col:'#ffa040'}); }
      if(B.openPopup) B.openPopup(4);
    }
  }
  if(B.ITEM_INFO&&!B.ITEM_INFO[4]) B.ITEM_INFO[4]={name:'THE ISOLATOR', lines:['A RUBBER WRAP FOR A SPEAKER. WITH IT ON,','MIND GOES UNDERWATER WITHOUT SHORTING OUT -','EVEN WHEN THE WATER IS ELECTRIFIED.','IT LASTS 30 SECONDS - A NEW ONE GROWS BACK 30 SECONDS LATER.','IN WATER: A KICKS, HOLD X WITH THE XLR: A CURRENT.']};
  B.extraAch=function(){ const a=[]; if(B.stageId==='1.2'&&B.isoEver) a.push('INSULATED - FOUND THE ISOLATOR'); if(B.stats&&B.stats.shortedEnemies>=1) a.push('SHORT CIRCUIT - DUNKED AN ENEMY'); return a; };

  // ── Drawing ───────────────────────────────────────────────────
  B.drawWorldExtras=function(){
    const D=window.MV_BETA_DECOR;
    for(const m of B.platforms){
      // the rail it runs on
      ctx.strokeStyle='rgba(60,40,30,0.55)'; ctx.lineWidth=sw(2); ctx.setLineDash([sw(6),sw(5)]);
      ctx.beginPath(); ctx.moveTo(sx(m.a),sy(m.y+7)); ctx.lineTo(sx(m.b+m.w),sy(m.y+7)); ctx.stroke(); ctx.setLineDash([]);
      for(const ex of [m.a,m.b+m.w]){ ctx.fillStyle='#3a2a20'; ctx.fillRect(sx(ex)-sw(3),sy(m.y)-sw(2),sw(6),sw(18)); }
      // the platform: wooden planks on an iron frame, glowing ends
      const x=sx(m.x), y=sy(m.y), w=sw(m.w), h=sw(m.h);
      ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(x+3,y+h,w-6,sw(4));
      ctx.fillStyle='#3a3e46'; ctx.fillRect(x,y,w,h);
      ctx.fillStyle='#8a5a32'; ctx.fillRect(x+sw(2),y+sw(2),w-sw(4),h-sw(6));
      ctx.fillStyle='#a8703a'; ctx.fillRect(x+sw(2),y+sw(2),w-sw(4),sw(3));
      for(let k=1;k<4;k++){ ctx.fillStyle='#5a3418'; ctx.fillRect(x+w*k/4,y+sw(2),1,h-sw(6)); }
      for(const rx of [x+sw(6),x+w-sw(6)]){ ctx.fillStyle='#c8ccd4'; ctx.beginPath(); ctx.arc(rx,y+h-sw(4),sw(2),0,Math.PI*2); ctx.fill(); }
      const pulse=0.5+0.5*Math.sin(fr*0.1);
      ctx.fillStyle='rgba(120,230,255,'+(0.4+0.4*pulse)+')'; ctx.fillRect(m.dir>0?x+w-sw(4):x,y,sw(4),sw(4));
    }
    const iso=B.isoPickup;
    if(iso&&!iso.got&&D){ D.glow&&D.glow(iso.x,iso.y-20,50,0.25+0.1*Math.sin(fr*0.08),'rgba(255,150,60,'); D.itemCrate(4,iso.x,iso.y,false); }
  };
  // water goes over the characters (they look submerged), under the HUD
  const _origFg=window.drawTmjForeground;
  window.drawTmjForeground=function(){
    const r=_origFg?_origFg.apply(this, arguments):undefined;
    if(on()) drawWater();
    return r;
  };
  function drawWater(){
    for(const w of B.waters){
      if(sx(w.x1)<0||sx(w.x0)>W) continue;
      const elec=w.elec>0;
      const top=Math.min(...w.s)-10, bot=Math.max(...w.bottom);
      const g=ctx.createLinearGradient(0,sy(top),0,sy(bot));
      g.addColorStop(0,elec?'rgba(150,220,255,0.55)':'rgba(70,150,230,0.44)'); g.addColorStop(1,elec?'rgba(60,110,220,0.72)':'rgba(18,46,124,0.7)');
      // the body of water as one shape: the moving surface on top, the floor under it
      const body=new Path2D();
      body.moveTo(sx(w.x0),sy(w.s[0]));
      for(let i=0;i<w.n;i++) body.lineTo(sx(w.x0+(i+0.5)*w.step),sy(w.s[i]));
      body.lineTo(sx(w.x1),sy(w.s[w.n-1]));
      for(let i=w.n-1;i>=0;i--){ body.lineTo(sx(w.x0+(i+1)*w.step),sy(w.bottom[i])); body.lineTo(sx(w.x0+i*w.step),sy(w.bottom[i])); }
      body.closePath();
      const ab=B.xBub&&B.xBub.w===w?B.xBub:null;
      ctx.fillStyle=g;
      if(ab){                                               // the air pocket: a hole in the water
        const wob=b2=>sw(ab.r)*(1+0.05*Math.sin(fr*0.4+b2));
        ctx.save(); const cut=new Path2D(); cut.rect(-10,-10,W+20,H+20);
        cut.ellipse(sx(ab.x),sy(ab.y),wob(0),wob(1.6),0,0,Math.PI*2); ctx.clip(cut,'evenodd');
        ctx.fill(body); ctx.restore();
        ctx.save(); ctx.clip(body);
        ctx.strokeStyle='rgba(235,250,255,0.9)'; ctx.lineWidth=Math.max(2,sw(3));
        ctx.beginPath(); ctx.ellipse(sx(ab.x),sy(ab.y),wob(0),wob(1.6),0,0,Math.PI*2); ctx.stroke();
        ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.lineWidth=Math.max(2,sw(4));
        ctx.beginPath(); ctx.arc(sx(ab.x),sy(ab.y),sw(ab.r)*0.7,Math.PI*1.1,Math.PI*1.45); ctx.stroke();
        ctx.restore();
      }else ctx.fill(body);
      // ripples running out through the water
      const rs=B.wRings.filter(g2=>g2.w===w);
      if(rs.length){ ctx.save(); ctx.clip(body);
        for(const g2 of rs){ const a=(g2.life/60)*Math.min(1,0.35+0.4*g2.k);
          ctx.strokeStyle=g2.kind==='mag'?'rgba(255,170,200,'+(a*0.7)+')':'rgba(220,245,255,'+(a*0.75)+')';
          ctx.lineWidth=Math.max(2,sw(3)*(0.6+g2.life/60));
          ctx.beginPath(); ctx.arc(sx(g2.x),sy(g2.y),sw(g2.r),0,Math.PI*2); ctx.stroke(); }
        ctx.restore(); }
      // where the pool has no floor (the pit) the water fades into the dark below
      for(let i=0;i<w.n;i++){ if(!w.open[i]) continue;
        const y0=sy(w.bottom[i]), gg=ctx.createLinearGradient(0,y0,0,y0+sw(3*T));
        gg.addColorStop(0,'rgba(18,46,124,0.7)'); gg.addColorStop(1,'rgba(4,8,30,0)');
        ctx.fillStyle=gg; ctx.fillRect(sx(w.x0+i*w.step),y0,sw(w.step)+1,sw(3*T)); }
      // surface: a bright line, thicker and whiter where the water is moving
      ctx.lineJoin='round';
      ctx.strokeStyle='rgba(225,247,255,0.8)'; ctx.lineWidth=Math.max(3,sw(4)); ctx.beginPath();
      let run=false;                                        // only where there's water (dry shore: nothing)
      for(let i=0;i<w.n;i++){
        const wet=w.amt[i]>0.5, x=sx(w.x0+(i+0.5)*w.step), y=sy(w.s[i]);
        if(wet&&!run){ ctx.moveTo(i===0?sx(w.x0):sx(w.x0+i*w.step),y); run=true; }
        if(wet) ctx.lineTo(i===w.n-1?sx(w.x1):x,y);
        else if(run){ ctx.lineTo(sx(w.x0+i*w.step),sy(w.s[i-1])); run=false; }
      }
      ctx.stroke();
      for(let i=1;i<w.n-1;i++){ if(w.amt[i]<=0.5) continue; const sl=Math.abs(w.s[i+1]-w.s[i-1]); if(sl>3){ ctx.fillStyle='rgba(255,255,255,'+Math.min(0.9,sl*0.06)+')'; ctx.fillRect(sx(w.x0+i*w.step),sy(w.s[i])-sw(3),sw(w.step),sw(5)); } }
      // caustics: soft light ripples drifting through the pool
      ctx.save(); ctx.globalCompositeOperation='lighter';
      for(let k=0;k<10;k++){
        const x=w.x0+((k*97+fr*0.4)%(w.x1-w.x0)), d=(w.r1-w.r0)*T, y=w.level+18+((k*53)%Math.max(20,d-30));
        if(y>w.bottom[colOf(w,x)]-6) continue;
        if(!(B.inWater(x,y))) continue;
        ctx.fillStyle='rgba(140,220,255,'+(0.05+0.04*Math.sin(fr*0.05+k))+')';
        ctx.beginPath(); ctx.ellipse(sx(x),sy(y),sw(26),sw(7),Math.sin(fr*0.01+k)*0.4,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
      if(elec){                                           // lightning through the water
        ctx.strokeStyle='rgba(255,250,170,'+(0.5+0.5*Math.random())+')'; ctx.lineWidth=sw(2);
        for(let k=0;k<4;k++){
          let x=w.x0+Math.random()*(w.x1-w.x0), y=w.level+4; ctx.beginPath(); ctx.moveTo(sx(x),sy(y));
          for(let j=0;j<6;j++){ x+=(Math.random()-0.5)*50; y+=12+Math.random()*16; if(!B.inWater(x,y)) break; ctx.lineTo(sx(x),sy(y)); }
          ctx.stroke();
        }
      }
    }
    // bubbles: big enough to read at console resolution, with a glint
    for(const b of B.bubbles){
      const x=sx(b.x), y=sy(b.y), r=Math.max(3,sw(b.r));
      ctx.fillStyle='rgba(200,240,255,0.18)'; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(230,250,255,0.85)'; ctx.lineWidth=Math.max(1.5,sw(2)); ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fillRect(x-r*0.45,y-r*0.55,Math.max(2,r*0.35),Math.max(2,r*0.35));
    }
    // water on the magnet: the stream up to the tip and the blob it holds
    const M=B.magWater;
    if(M){
      for(const d of M.drops){ ctx.fillStyle='rgba(170,225,255,0.9)'; ctx.beginPath(); ctx.arc(sx(d.x),sy(d.y),Math.max(2.5,sw(3)),0,Math.PI*2); ctx.fill(); }
      if(M.area>0){
        const r=Math.sqrt(M.area/Math.PI), x=sx(M.x), y=sy(M.y), wob=Math.sin(fr*0.3)*0.12;
        ctx.save(); ctx.translate(x,y); ctx.scale(1+wob,1-wob);
        const g2=ctx.createRadialGradient(-r*0.3,-r*0.3,1,0,0,sw(r)+2); g2.addColorStop(0,'rgba(230,248,255,0.95)'); g2.addColorStop(0.5,'rgba(110,190,245,0.75)'); g2.addColorStop(1,'rgba(40,100,200,0.7)');
        ctx.fillStyle=g2; ctx.beginPath(); ctx.arc(0,0,Math.max(4,sw(r)),0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='rgba(235,250,255,0.9)'; ctx.lineWidth=Math.max(1.5,sw(2)); ctx.stroke();
        ctx.restore();
      }
    }
  }
  // the Isolator wraps MIND: a glossy orange rubber skin over the box and wheel
  const _origDrawChar=window.drawCharacter;
  window.drawCharacter=function(){
    const r=_origDrawChar.apply(this, arguments);
    if(on()&&B.hasIsolator){
      const cx=sx(p.x+SW/2), feet=sy(p.y+FEET_OFF), top=feet-sw(STAND_H+WHEEL_R)+sw((p.crouchAmt||0)*30)-4;
      const wet=B.mindWet||0, left=B.isoT||0;
      const blink=left<300&&((fr>>(left<120?2:3))&1);           // running out: it flickers
      const a=(0.28+0.25*wet+0.06*Math.sin(fr*0.12))*(blink?0.25:1);
      ctx.save();
      // time left: a ring that empties over MIND's head
      const k=Math.max(0,left/ISO_TIME), rx=cx+sw(30), ry=top-sw(6), rr=Math.max(5,sw(9));
      ctx.lineWidth=Math.max(2,sw(3)); ctx.strokeStyle='rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(rx,ry,rr,0,Math.PI*2); ctx.stroke();
      ctx.strokeStyle=left<300?'#ff5a3a':'#ffa040'; ctx.beginPath(); ctx.arc(rx,ry,rr,-Math.PI/2,-Math.PI/2+Math.PI*2*k); ctx.stroke();
      ctx.fillStyle='rgba(255,150,60,'+(a*0.45)+')'; ctx.strokeStyle='rgba(255,180,100,'+(a+0.2)+')'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.roundRect(cx-sw(32),top,sw(64),feet-top+2,sw(18)); ctx.fill(); ctx.stroke();
      ctx.strokeStyle='rgba(255,240,210,'+(0.35+0.3*wet)+')'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(cx-sw(12),top+sw(20),sw(10),Math.PI*1.1,Math.PI*1.55); ctx.stroke();
      ctx.restore();
    }
    if(on()&&B.shortT>0){                                 // shorting out: crackle over the speaker
      const cx=sx(p.x+SW/2), cy=sy(p.y+FEET_OFF-55);
      ctx.strokeStyle='rgba(255,250,150,0.9)'; ctx.lineWidth=2;
      for(let k=0;k<2;k++){ let x=cx+(Math.random()-0.5)*30, y=cy-25; ctx.beginPath(); ctx.moveTo(x,y); for(let j=0;j<4;j++){ x+=(Math.random()-0.5)*18; y+=12; ctx.lineTo(x,y); } ctx.stroke(); }
    }
    return r;
  };
})();
