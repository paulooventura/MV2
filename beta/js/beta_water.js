// ============================================================
//  beta_water.js — G · moving platforms, water and the Isolator (Awdjoo 1.2)
//
//  Moving platforms: steady back-and-forth over the range drawn in the sketch
//  (all the same width). MIND rides them, jumps off them, and the RCA hook
//  can bite them and rides along.
//
//  Water (Paulo): MIND sinks slowly, as if underwater. Whatever goes into the
//  water pushes the level up by the room it takes (weight and size matter),
//  splashes make waves that run across the surface, and the XLR stirs a
//  current. Seeds float, crystals and cubes sink slowly.
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
  B.onLevelStart=function(){ B.platforms=[]; B.waters=[]; B.isoPickup=null; B.hasIsolator=false; B.bubbles=[]; B.ridePlat=null; B.airs=[]; if(B.waterPlayReset) B.waterPlayReset(); };
  B.onEntities=function(ents, F, cell){
    for(const e of ents){
      const g=cell(e), id=e.__identifier;
      if(id==='MovingPlatform'){
        const a=(F(e,'a')??g.c)*T, b=(F(e,'b')??g.c)*T;
        B.platforms.push({x:g.c*T, y:g.r*T, w:g.w*T, h:14, a, b, dir:1, spd:(F(e,'speed')||12)/10, dx:0});
      }else if(id==='Water'){
        makeWater(g.c, g.c+g.w-1, g.r, g.r+g.h-1, g.r*T);
      }else if(id==='Isolator'){
        B.isoPickup={x:g.c*T+T/2, y:(g.r+1)*T, got:false};
      }
    }
  };
  // A body of water over cells c0..c1. baseRest = rest level without air pockets
  // (beta_waterplay.js moves water in and out by changing it).
  function makeWater(c0,c1,r0,r1,level,dyn){
    const w={c0, c1, r0, r1, x0:c0*T, x1:(c1+1)*T, base:level, baseRest:level, level, elec:0, n:0, h:[], v:[], bottom:[], step:8, dyn:!!dyn};
    w.n=Math.ceil((w.x1-w.x0)/w.step)+1;
    for(let i=0;i<w.n;i++){ w.h.push(0); w.v.push(0); }
    // pool depth per wave column: down to the first solid cell under the surface
    for(let i=0;i<w.n;i++){
      const x=Math.min(w.x1-1,w.x0+i*w.step), c=Math.floor(x/T);
      let r=w.r0; while(r<=w.r1+4&&!gridSolid(c,r)) r++;
      w.bottom.push(r*T);
    }
    B.waters.push(w);
    return w;
  }

  // ── Water queries ──────────────────────────────────────────────
  // B.airs: air pockets (XLR) — circles {x,y,r} where there is no water.
  B.airs=[];
  const inAir=(x,y)=>{ for(const a of B.airs) if((x-a.x)*(x-a.x)+(y-a.y)*(y-a.y)<a.r*a.r) return true; return false; };
  function surfaceAt(w,x){ const i=Math.max(0,Math.min(w.n-1,Math.round((x-w.x0)/w.step))); return w.level+w.h[i]; }
  function waterAtRaw(x,y){
    for(const w of B.waters){
      if(x<w.x0||x>=w.x1) continue;
      const i=Math.max(0,Math.min(w.n-1,Math.round((x-w.x0)/w.step)));
      if(y>surfaceAt(w,x)&&y<w.bottom[i]) return w;
    }
    return null;
  }
  function waterAt(x,y){ const w=waterAtRaw(x,y); return w&&!(B.airs.length&&inAir(x,y))?w:null; }
  B.inWater=(x,y)=>!!waterAt(x,y);
  // how much of MIND is under water (0..1) and which pool
  function mindDepth(){
    const feet=p.y+FEET_OFF, top=feet-(STAND_H+WHEEL_R), cx=p.x+SW/2;
    if(B.airs.length&&inAir(cx,feet-STAND_H*0.6)) return {w:null,f:0,s:0};   // the speaker sits in an air pocket: dry
    for(const w of B.waters){
      if(cx<w.x0||cx>=w.x1) continue;
      const s=surfaceAt(w,cx);
      const i=Math.max(0,Math.min(w.n-1,Math.round((cx-w.x0)/w.step)));
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
  function splash(w,x,power,up){
    const i=Math.max(0,Math.min(w.n-1,Math.round((x-w.x0)/w.step)));
    for(let k=-2;k<=2;k++){ const j=i+k; if(j>=0&&j<w.n) w.v[j]+=power*(up?-1:1)*(1-Math.abs(k)*0.3); }
    const n=Math.min(18,4+power*2|0), s=surfaceAt(w,x);
    for(let k=0;k<n;k++){ const a=-Math.PI*(0.15+Math.random()*0.7);
      PFXS.push({x:x+(Math.random()-0.5)*24,y:s-2,vx:Math.cos(a)*(1+Math.random()*2.5),vy:Math.sin(a)*(1.5+Math.random()*power*0.5),life:18+Math.random()*12|0,maxLife:30,r:1.5+Math.random()*2,col:k%3?'#9ad8ff':'#e8f6ff'}); }
    try{ if(power>1.5&&window.MV_BETA_AUDIO&&MV_BETA_AUDIO.splash) MV_BETA_AUDIO.splash(Math.min(1,power/8)); }catch(e){}
  }
  function waterTick(){
    platformTick();
    isolatorTick();
    if(B.waterPlayTick) B.waterPlayTick();             // MAG / XLR moving water (beta_waterplay.js)
    if(!B.waters.length) return;
    const list=bodies();
    for(const w of B.waters){
      // 1) displacement: the level rises by the volume pushed under the surface
      let area=0;
      for(const b of list){
        const ox=overlap(b.x,b.x+b.w,w.x0,w.x1); if(!ox) continue;
        const oy=overlap(b.y,b.y+b.h,w.level,w.r1*T+T*3);
        area+=ox*oy*Math.min(1.4,0.6+b.m*0.08);   // heavier things sit deeper
      }
      const target=w.base-area*DISP/(w.x1-w.x0);
      w.level+=(target-w.level)*0.06;
      // 2) splashes as things cross the surface
      for(const b of list){
        const cx=b.x+b.w/2, cy=b.y+b.h/2, inside=cx>=w.x0&&cx<w.x1&&cy>surfaceAt(w,cx);
        const was=b.ref._inW===w;
        if(inside&&!was&&Math.abs(b.vy)>0.6) splash(w,cx,Math.min(9,Math.abs(b.vy)*0.45*Math.sqrt(b.m)),false);
        if(!inside&&was&&b.vy<-1) splash(w,cx,Math.min(6,Math.abs(b.vy)*0.3*Math.sqrt(b.m)),true);
        b.ref._inW=inside?w:null;
        if(inside&&Math.abs(b.vx)>1.2&&fr%3===0&&Math.abs(cy-surfaceAt(w,cx))<b.h){ splash(w,cx+Math.sign(b.vx)*b.w/2,Math.abs(b.vx)*0.12,false); }
        if(inside&&fr%(b.me?7:14)===0) B.bubbles.push({x:cx+(Math.random()-0.5)*b.w*0.6,y:cy,r:1.5+Math.random()*2.5,vy:-0.6-Math.random()*0.8,w});
      }
      // 3) waves: springs back to flat, spread to neighbours
      for(let it=0;it<2;it++){
        for(let i=0;i<w.n;i++){ w.v[i]+=-w.h[i]*0.022; w.v[i]*=0.985; }
        for(let i=0;i<w.n;i++){ w.h[i]+=w.v[i]*0.5; }
        const L=[],R=[];
        for(let i=0;i<w.n;i++){ L[i]=i>0?(w.h[i]-w.h[i-1])*0.12:0; R[i]=i<w.n-1?(w.h[i]-w.h[i+1])*0.12:0; }
        for(let i=0;i<w.n;i++){ if(i>0) w.v[i-1]+=L[i]; if(i<w.n-1) w.v[i+1]+=R[i]; }
      }
      for(let i=0;i<w.n;i++) w.h[i]+=Math.sin(fr*0.04+i*0.45)*0.04;   // a living, slight lap
      // 4) the XLR's air pocket and the MAG's water grab live in beta_waterplay.js
      // 5) electricity
      for(const s of (p&&p.shots)||[]){
        if(s.type==='laser'&&s.life>0&&waterAt(s.x,s.y)===w){ w.elec=Math.max(w.elec,s.charged?90:55); s.life=0; zap(1); }
      }
      if(w.elec>0) w.elec--;
      for(const b of list){
        if(!b.enemy) continue;
        const e=b.ref, inside=waterAt(e.x+e.w/2,e.y+e.h*0.6)===w||waterAt(e.x+e.w/2,e.y+e.h-3)===w;   // feet in a puddle count
        if(inside){
          shortEnemy(e);
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
      const b=B.bubbles[i]; b.y+=b.vy; b.x+=(b.vx||0)+Math.sin(fr*0.1+i)*0.3; if(b.vx) b.vx*=0.95;
      if(!b.w||b.y<surfaceAt(b.w,b.x)) B.bubbles.splice(i,1);
    }
    if(B.bubbles.length>160) B.bubbles.splice(0,B.bubbles.length-160);
  }
  B.waterTick=waterTick;
  // water shorts an enemy out on contact
  function shortEnemy(e){
    if(!e.alive||e.mind) return;
    if(typeof _damageEnemy==='function') _damageEnemy(e,9999,e.x+e.w/2,e.y);
    e._shorted=true; e._revT=0;
    if(B.stats) B.stats.shortedEnemies=(B.stats.shortedEnemies||0)+1;
    zap(0.7); for(let k=0;k<10;k++) spark(e.x+e.w/2,e.y+e.h/2,24);
  }
  B.W={waterAt, waterAtRaw, surfaceAt, splash, spark, zap, makeWater, shortEnemy};

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
  function isolatorTick(){
    const iso=B.isoPickup;
    if(!iso||iso.got||!p) return;
    const core=playerCoreHB(p), feet=p.y+FEET_OFF;
    if(ov(core.x-4,core.y,core.w+8,feet+6-core.y,iso.x-23,iso.y-40,46,40)){
      iso.got=true; B.hasIsolator=true; B.stats.items++;
      for(let k=0;k<16;k++){ const a=Math.random()*Math.PI*2, s=1.6+Math.random()*3; PFXS.push({x:iso.x,y:iso.y-20,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,life:16+Math.random()*12|0,maxLife:28,r:2+Math.random()*2,col:'#ffa040'}); }
      if(B.openPopup) B.openPopup(4);
    }
  }
  if(B.ITEM_INFO&&!B.ITEM_INFO[4]) B.ITEM_INFO[4]={name:'THE ISOLATOR', lines:['A RUBBER BUBBLE AROUND THE SPEAKER: MIND','GOES UNDERWATER WITHOUT SHORTING OUT -','EVEN WHEN THE WATER IS ELECTRIFIED.','{jump} SWIMS. XLR BLOWS AIR, MAG GRABS WATER.']};
  B.extraAch=function(){ const a=[]; if(B.stageId==='1.2'&&B.hasIsolator) a.push('INSULATED - FOUND THE ISOLATOR'); if(B.stats&&B.stats.shortedEnemies>=1) a.push('SHORT CIRCUIT - DUNKED AN ENEMY'); return a; };

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
    const airs=B.airs;
    if(airs.length){                                     // air pockets: cut circles out of the water
      ctx.save(); ctx.beginPath(); ctx.rect(0,0,W,H);
      for(const a of airs){ ctx.moveTo(sx(a.x)+sw(a.r),sy(a.y)); ctx.arc(sx(a.x),sy(a.y),sw(a.r),0,Math.PI*2,true); }
      ctx.clip('evenodd');
    }
    drawPools();
    if(airs.length) ctx.restore();
    if(B.drawWaterPlay) B.drawWaterPlay();
  }
  function drawPools(){
    for(const w of B.waters){
      if(sx(w.x1)<0||sx(w.x0)>W) continue;
      const elec=w.elec>0;
      // one shape per pool (surface across, stepped floor back): a single gradient fill + one surface stroke
      let top=1e9, bot=-1e9, any=false;
      ctx.beginPath();
      for(let i=0;i<w.n-1;i++){
        const s=w.level+w.h[i], X=sx(Math.min(w.x1,w.x0+i*w.step)), Y=sy(Math.min(s,w.bottom[i]));
        if(i===0) ctx.moveTo(X,Y); else ctx.lineTo(X,Y);
        if(s<top) top=s; if(w.bottom[i]>bot) bot=w.bottom[i]; if(w.bottom[i]>s) any=true;
      }
      if(!any) continue;
      ctx.lineTo(sx(w.x1),sy(Math.min(w.level+w.h[w.n-1],w.bottom[w.n-2])));
      for(let i=w.n-2;i>=0;i--){ const X1=sx(Math.min(w.x1,w.x0+(i+1)*w.step)), X0=sx(w.x0+i*w.step), Yb=sy(w.bottom[i]); ctx.lineTo(X1,Yb); ctx.lineTo(X0,Yb); }
      ctx.closePath();
      const g=ctx.createLinearGradient(0,sy(top),0,sy(bot));
      g.addColorStop(0,elec?'rgba(150,220,255,0.55)':'rgba(70,150,230,0.42)'); g.addColorStop(1,elec?'rgba(60,110,220,0.7)':'rgba(20,50,130,0.66)');
      ctx.fillStyle=g; ctx.fill();
      ctx.beginPath();
      for(let i=0;i<w.n;i++){ const X=sx(Math.min(w.x1,w.x0+i*w.step)), Y=sy(w.level+w.h[i]); if(i===0) ctx.moveTo(X,Y); else ctx.lineTo(X,Y); }
      ctx.strokeStyle='rgba(220,245,255,0.75)'; ctx.lineWidth=Math.max(1.5,sw(2)); ctx.stroke();
      // caustics: soft light ripples drifting through the pool
      ctx.save(); ctx.globalCompositeOperation='lighter';
      for(let k=0;k<10;k++){
        const x=w.x0+((k*97+fr*0.4)%(w.x1-w.x0)), d=(w.r1-w.r0)*T, y=w.level+18+((k*53)%Math.max(20,d-30));
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
    for(const b of B.bubbles){ ctx.strokeStyle='rgba(220,245,255,0.7)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(sx(b.x),sy(b.y),sw(b.r),0,Math.PI*2); ctx.stroke(); }
  }
  // the Isolator: an orange bubble around the speaker box only (wheel, arms and head stay outside)
  const _origDrawChar=window.drawCharacter;
  window.drawCharacter=function(){
    const r=_origDrawChar.apply(this, arguments);
    if(on()&&B.hasIsolator){
      const bd=p._bodyDraw||playerCoreHB(p);
      const wet=B.mindWet||0, wob=Math.sin(fr*0.09)*0.04;
      const cx=sx(bd.x+bd.w/2), cy=sy(bd.y+bd.h/2), rx=sw(bd.w/2+9)*(1+wob), ry=sw(bd.h/2+9)*(1-wob);
      ctx.save();
      const g=ctx.createRadialGradient(cx-rx*0.3,cy-ry*0.35,Math.min(rx,ry)*0.1,cx,cy,Math.max(rx,ry));
      g.addColorStop(0,'rgba(255,200,120,0.06)'); g.addColorStop(0.7,'rgba(255,140,40,'+(0.16+0.1*wet)+')'); g.addColorStop(1,'rgba(255,110,20,'+(0.42+0.15*wet)+')');
      ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(255,160,60,'+(0.75+0.2*Math.sin(fr*0.12))+')'; ctx.lineWidth=Math.max(2,sw(2.5)); ctx.stroke();
      ctx.strokeStyle='rgba(255,245,225,0.75)'; ctx.lineWidth=Math.max(2,sw(3)); ctx.lineCap='round';      // shine
      ctx.beginPath(); ctx.ellipse(cx,cy,rx*0.78,ry*0.8,0,Math.PI*1.12,Math.PI*1.42); ctx.stroke();
      ctx.fillStyle='rgba(255,250,235,0.85)'; ctx.beginPath(); ctx.arc(cx+rx*0.52,cy-ry*0.55,Math.max(1.5,sw(2.5)),0,Math.PI*2); ctx.fill();
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
