// ============================================================
//  beta_impact.js — things that should FEEL like they hit (Paulo, Oct 20)
//
//   - Beds upstairs in the family home are bouncy one-way platforms:
//     land on one and the mattress throws you back up (harder fall,
//     higher bounce); jumping off a bed goes a bit higher.
//   - Punches: every swing whooshes and leaves a smear; a punch that
//     connects pops an impact star, shakes the camera and lands a
//     meaty thump (stone, block, crate or enemy each sound different).
//   - Omni blocks: hits throw grit and dust, a break blows a dust cloud
//     and rumbles (the crunch / crush sounds live in sfx_posh.js).
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B) return;
  const T=32;
  const on=()=>B.on&&typeof p!=='undefined'&&p;
  const S=(n)=>{ try{ sfx(n); }catch(e){} };

  // ── Bouncy beds ────────────────────────────────────────────────
  // same spots the decor draws them (beta_decor.js familyHome → bed())
  const BED_DEF=[{c:7,w:150},{c:17,w:140}];
  B.bedSq=B.bedSq||[0,0];
  function beds(){
    const out=[];
    for(const rm of (B.rooms||[])){
      if(rm.style!=='home'||!rm.loft) continue;
      const loft=rm.loft*T;
      BED_DEF.forEach((d,i)=>out.push({i, x:d.c*T+8, w:d.w-16, y:loft-28}));
    }
    return out;
  }
  B.beds=beds;
  const BED={REST:0.66, MAX:15, MIN_V:3.6, JUMP_MUL:1.22};   // each bounce loses a third of its speed, then it settles
  let onBed=null, onBedFr=-9, boosted=false;
  const _mv=window._movePlayerWithColl;
  if(typeof _mv==='function') window._movePlayerWithColl=function(pl,vx,vy){
    if(!on()||pl!==p) return _mv.apply(this,arguments);
    const y0=pl.y, vIn=pl.vy||0;
    const r=_mv.apply(this,arguments);
    // a jump started on the mattress springs a little higher
    if(onBed&&fr-onBedFr<=2&&(pl.vy||0)<-2&&!boosted){ pl.vy*=BED.JUMP_MUL; boosted=true; B.bedSq[onBed.i]=Math.max(B.bedSq[onBed.i],6); S('bed_boing'); }
    if(typeof _mvDropThru!=='undefined'&&_mvDropThru>0){ onBed=null; return r; }
    if(pl.hook&&pl.hook.st==='on'){ onBed=null; return r; }
    const cx=pl.x+SW/2, feet0=y0+FEET_OFF, feet=pl.y+FEET_OFF;
    for(const b of beds()){
      if(cx<b.x||cx>b.x+b.w) continue;
      const landing=vIn>=0&&feet0<=b.y+4&&feet>=b.y-1;
      const staying=onBed&&onBed.i===b.i&&(pl.vy||0)>=-0.01&&Math.abs(feet-b.y)<=10;
      if(!(landing||staying)) continue;
      pl.y=b.y-FEET_OFF;
      if(landing&&!staying&&vIn>BED.MIN_V){                     // boing
        pl.vy=-Math.min(BED.MAX,vIn*BED.REST); pl.og=false;
        B.bedSq[b.i]=Math.min(12,4+vIn*0.8); onBed=null; boosted=true;
        S('bed_boing');
        return r;
      }
      if(pl.vy>0) pl.vy=0; pl.og=true; onBed=b; onBedFr=fr; boosted=false;
      B.bedSq[b.i]=Math.max(B.bedSq[b.i],3);
      return r;
    }
    onBed=null; return r;
  };
  const _gr=window._playerGrounded;
  if(typeof _gr==='function') window._playerGrounded=function(pl){
    if(on()&&pl===p&&onBed&&fr-onBedFr<=1) return true;
    return _gr.apply(this,arguments);
  };
  function bedTick(){ for(let i=0;i<B.bedSq.length;i++){ const v=B.bedSq[i]; B.bedSq[i]=v>0.2?v*0.82:0; } }

  // ── Impacts ────────────────────────────────────────────────────
  B.impacts=[];
  const puffs=[];
  function dust(x,y,n,spread,col){
    for(let k=0;k<n;k++){ const a=Math.random()*Math.PI*2, s=Math.random()*spread;
      puffs.push({x:x+Math.cos(a)*s*4, y:y+Math.sin(a)*s*4, vx:Math.cos(a)*s*0.5, vy:Math.sin(a)*s*0.4-0.4, r:6+Math.random()*10, t:0, max:30+Math.random()*30|0, col:col||'200,190,215'}); }
    if(puffs.length>160) puffs.splice(0,puffs.length-160);
  }
  // render.js calls this when a punch connects
  window._punchConnect=function(x,y,ang,charged,kind){
    B.impacts.push({x,y,ang,t:0,max:charged?22:16,charged,kind});
    B.shake=Math.max(B.shake||0,charged?6:2.5);
    S(charged?'punch_hit_heavy':'punch_hit');
    if(kind==='wall') S('punch_wall');
    if(kind==='wall'||kind==='block') dust(x,y,charged?6:3,2,'190,175,160');
  };
  // every swing: a whoosh (main.js plays 'punch' / the loaded swing) — and a smear while the arm is out
  // omni block hits: grit + dust; a break: a dust cloud and a rumble
  const _dmg=window._damageBwall;
  if(typeof _dmg==='function') window._damageBwall=function(bw,kind,fx){
    const hp0=bw?bw.hp:0;
    const r=_dmg.apply(this,arguments);
    if(on()&&bw&&hp0>0&&bw.hp<hp0){
      const cx=bw.x+bw.w/2, cy=bw.y+bw.h/2;
      if(bw.hp<=0){ dust(cx,cy,14,3,'210,195,225'); B.shake=Math.max(B.shake||0,5); B.impacts.push({x:cx,y:cy,ang:0,t:0,max:14,charged:true,kind:'break'}); }
      else dust(cx,cy,4,1.5,'210,195,225');
    }
    return r;
  };

  // each swing leaves a crescent smear in front of MIND for a few frames
  const swings=[]; let prevPt=0;
  function swingTick(){
    const pt=p.pt||0;
    if(pt>0&&prevPt<=0){
      const ang=Math.atan2(p.aimDY||0,(p.aimDX||0)||(p.fc?1:-1)), heavy=(p.pCharge||0)>20;
      swings.push({t:0,max:heavy?16:11,ang,heavy});
    }
    prevPt=pt;
    for(let i=swings.length-1;i>=0;i--) if(++swings[i].t>swings[i].max) swings.splice(i,1);
  }
  // ── Live yellow cage blocks (Paulo, Oct 21) ──────────────────────
  // The gold TRS-cage blocks are electrical. Touching one shocks MIND;
  // the harder he hits it, the worse: a brush costs a little, slamming into
  // it at speed a lot, a punch more, and a loaded punch nearly shuts him down.
  const SHOCK={CD:40, MIN:6, PER_SPD:4.2, MAX:55, PUNCH:26};
  let shockCd=0, lastSpd=0, zapT=0, zapMax=1, zapFrom=null;
  const isLive=bw=>bw&&bw.only==='laser'&&bw.hp>0;
  function shock(bw,kind,ang){
    if(!on()||(typeof _shutdownTimer!=='undefined'&&_shutdownTimer>0)) return;
    const punch=kind==='punch'||kind==='punchLoaded';
    if(!punch&&shockCd>0) return;
    let dmg=kind==='punchLoaded'?Math.max(60,(p.hp||0)-8):kind==='punch'?SHOCK.PUNCH:kind;
    dmg=Math.max(1,Math.round(dmg));
    const bx=bw.x+bw.w/2, by=bw.y+bw.h/2, mx=p.x+SW/2, my=p.y+FEET_OFF-50;
    let kx=mx-bx, ky=my-by; const d=Math.hypot(kx,ky)||1; kx/=d; ky/=d;
    const kb=kind==='punchLoaded'?9:punch?6:Math.min(8,3+dmg/8);
    try{ applyPlayerHit(kx*kb, Math.min(-3,ky*kb-2), dmg); }catch(e){}
    shockCd=SHOCK.CD; zapT=zapMax=kind==='punchLoaded'?54:dmg>25?36:24; zapFrom={x:bx,y:by};
    bw.hitGlow=16; bw.shakeX=(Math.random()-0.5)*4;
    B.shake=Math.max(B.shake||0,kind==='punchLoaded'?11:Math.min(8,3+dmg/8));
    S(kind==='punchLoaded'||dmg>30?'zap_big':'zap');
    for(let k=0;k<(kind==='punchLoaded'?26:14);k++){ const a=Math.random()*Math.PI*2, sp=2+Math.random()*5;
      PFXS.push({x:bx+(mx-bx)*0.3,y:by+(my-by)*0.3,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1,life:10+Math.random()*12|0,maxLife:22,r:1.5+Math.random()*2,col:k%3?'#fff6a0':'#80d8ff'}); }
  }
  window._shockFromBlock=shock;
  function shockTick(){
    if(shockCd>0) shockCd--;
    if(zapT>0) zapT--;
    if(!on()) return;
    const core=playerCoreHB(p), feet=p.y+FEET_OFF;
    const x0=core.x-3, x1=core.x+core.w+3, y0=core.y-3, y1=feet+3;
    if(shockCd<=0) for(const bw of BWALLS){
      if(!isLive(bw)) continue;
      if(x1>bw.x&&x0<bw.x+bw.w&&y1>bw.y&&y0<bw.y+bw.h){
        shock(bw, Math.min(SHOCK.MAX, SHOCK.MIN+lastSpd*SHOCK.PER_SPD)); break;   // harder impact, more damage
      }
    }
    lastSpd=Math.hypot(p.vx||0,p.vy||0);
  }
  // a jagged bolt between two screen points
  function bolt(x0,y0,x1,y1,seg,amp,col,w){
    ctx.strokeStyle=col; ctx.lineWidth=w; ctx.beginPath(); ctx.moveTo(x0,y0);
    for(let i=1;i<seg;i++){ const t=i/seg, nx=-(y1-y0), ny=x1-x0, l=Math.hypot(nx,ny)||1, o=(Math.random()-0.5)*amp;
      ctx.lineTo(x0+(x1-x0)*t+nx/l*o, y0+(y1-y0)*t+ny/l*o); }
    ctx.lineTo(x1,y1); ctx.stroke();
  }
  function drawShock(){
    ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
    // the cage blocks crackle now and then so you can tell they're live
    for(const bw of BWALLS){
      if(!isLive(bw)) continue;
      const X=sx(bw.x), Y=sy(bw.y), Wd=sw(bw.w);
      if(X<-40||X>W+40||Y<-40||Y>H+40) continue;
      const ph=(fr+(bw.homeCol||0)*17+(bw.homeRow||0)*29)%70;
      if(ph<5){ ctx.globalAlpha=0.9; const a=Math.random()*Math.PI*2, b=a+1+Math.random()*2.5, r=Wd*0.55;
        bolt(X+Wd/2+Math.cos(a)*r,Y+Wd/2+Math.sin(a)*r,X+Wd/2+Math.cos(b)*r,Y+Wd/2+Math.sin(b)*r,5,Wd*0.25,'#fff6a0',sw(1.6)); }
    }
    // MIND being electrocuted: bolts over his body, and one from the block for the first frames
    if(zapT>0&&p){
      const k=zapT/zapMax, mx=sx(p.x+SW/2), my=sy(p.y+FEET_OFF-50), r=sw(46);
      ctx.globalAlpha=0.5+0.5*k;
      for(let i=0;i<(zapMax>40?6:4);i++){ const a=Math.random()*Math.PI*2, b=a+0.8+Math.random()*2;
        bolt(mx+Math.cos(a)*r*0.8,my+Math.sin(a)*r,mx+Math.cos(b)*r*0.8,my+Math.sin(b)*r,6,r*0.5,i%2?'#80d8ff':'#fff6a0',sw(2)); }
      if(zapFrom&&zapMax-zapT<10){ bolt(sx(zapFrom.x),sy(zapFrom.y),mx,my,9,sw(30),'#ffffff',sw(3)); bolt(sx(zapFrom.x),sy(zapFrom.y),mx,my,9,sw(30),'#fff6a0',sw(1.5)); }
      if((zapT&3)<2){ ctx.globalAlpha=0.18*k; ctx.fillStyle='#e8f8ff'; ctx.fillRect(0,0,W,H); }
    }
    ctx.restore();
  }
  function tick(){
    bedTick(); if(on()) swingTick(); shockTick();
    for(let i=B.impacts.length-1;i>=0;i--) if(++B.impacts[i].t>B.impacts[i].max) B.impacts.splice(i,1);
    for(let i=puffs.length-1;i>=0;i--){ const d=puffs[i]; d.x+=d.vx; d.y+=d.vy; d.vx*=0.93; d.vy=d.vy*0.93-0.02; d.r+=0.35; if(++d.t>d.max) puffs.splice(i,1); }
  }
  B.impactTick=tick;

  // drawn in screen space on the HUD pass (beta_level.js drawLdtkLabHud)
  B.drawImpactFx=function(){
    if(!on()) return;
    drawShock();
    ctx.save();
    for(const d of puffs){ const a=0.32*(1-d.t/d.max); ctx.fillStyle='rgba('+d.col+','+a.toFixed(3)+')'; ctx.beginPath(); ctx.arc(sx(d.x),sy(d.y),sw(d.r),0,Math.PI*2); ctx.fill(); }
    // swing smear: a crescent swoosh in the punch direction + speed lines
    for(const w of swings){
      const k=w.t/w.max, ux=Math.cos(w.ang), uy=Math.sin(w.ang);
      const ox=p.x+SW/2, oy=p.y+FEET_OFF-(typeof WHEEL_R!=='undefined'?WHEEL_R*2:28)-18;   // around the shoulder
      const R=(w.heavy?78:56)*(0.75+0.35*Math.min(1,k*2)), span=w.heavy?1.1:0.85, a0=w.ang-span, a1=w.ang+span;
      const al=(1-k)*(w.heavy?0.85:0.7);
      ctx.save(); ctx.translate(sx(ox),sy(oy)); ctx.scale(1,0.52); ctx.translate(-sx(ox),-sy(oy));
      ctx.fillStyle='rgba(255,255,255,'+al.toFixed(3)+')';
      ctx.beginPath(); ctx.arc(sx(ox),sy(oy),sw(R),a0,a1); ctx.arc(sx(ox+ux*(w.heavy?14:10)),sy(oy+uy*(w.heavy?14:10)),sw(R*0.82),a1,a0,true); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba('+(w.heavy?'255,220,140':'210,200,255')+','+(al*0.9).toFixed(3)+')'; ctx.lineWidth=sw(2.5);
      ctx.beginPath(); ctx.arc(sx(ox),sy(oy),sw(R+4),a0+0.15,a1-0.15); ctx.stroke();
      ctx.lineCap='round'; ctx.lineWidth=sw(2);
      for(let i=-1;i<=1;i++){ const nx=-uy*i*12, ny=ux*i*12, l=(w.heavy?60:40)*(1-k);
        ctx.strokeStyle='rgba(255,255,255,'+(al*0.7).toFixed(3)+')';
        ctx.beginPath(); ctx.moveTo(sx(ox+nx+ux*(R-8)),sy(oy+ny+uy*(R-8))); ctx.lineTo(sx(ox+nx+ux*(R-8-l)),sy(oy+ny+uy*(R-8-l))); ctx.stroke(); }
      ctx.restore();
    }
    // impact stars: a white flash, spikes thrown along the punch, an expanding ring
    for(const f of B.impacts){
      const k=f.t/f.max, X=sx(f.x), Y=sy(f.y), R=sw((f.charged?62:42)*(0.45+k*0.9));
      if(f.t<5){ ctx.fillStyle='rgba(255,255,255,'+(0.95-f.t*0.18).toFixed(3)+')'; ctx.beginPath(); ctx.arc(X,Y,sw(f.charged?34:22),0,Math.PI*2); ctx.fill(); }
      ctx.strokeStyle='rgba(255,240,200,'+(0.85*(1-k)).toFixed(3)+')'; ctx.lineWidth=sw(f.charged?6:4);
      ctx.beginPath(); ctx.arc(X,Y,R,0,Math.PI*2); ctx.stroke();
      const n=f.charged?10:8;
      ctx.fillStyle=f.kind==='enemy'?'rgba(255,214,90,'+(1-k).toFixed(3)+')':'rgba(255,255,255,'+(1-k).toFixed(3)+')';
      for(let i=0;i<n;i++){
        const a=f.ang+Math.PI+(i/n)*Math.PI*2, inner=R*0.35, outer=R*(i%2?0.9:1.35), wv=0.16;
        ctx.beginPath();
        ctx.moveTo(X+Math.cos(a-wv)*inner,Y+Math.sin(a-wv)*inner);
        ctx.lineTo(X+Math.cos(a)*outer,Y+Math.sin(a)*outer);
        ctx.lineTo(X+Math.cos(a+wv)*inner,Y+Math.sin(a+wv)*inner);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  };
})();
