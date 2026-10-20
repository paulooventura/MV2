// ============================================================
//  beta_waterplay.js — moving water with the MAG and the XLR (Paulo)
//
//  MAG (pull): with the tip in water, a tap scoops one block of water; holding
//  the button keeps drawing water in, up to 9 blocks (a 3x3 mass) held as a
//  circle around the magnet's tip. The grip follows the power: as it drains,
//  water drips off, and at 0% everything falls. Letting go throws the water
//  with the swing of the arm. Thrown water pours into a pool, spreads into a
//  new puddle on the floor, or shorts out any enemy it splashes.
//
//  XLR (push): with the tip under water, a tap blows one block of air; holding
//  grows the pocket up to 9 blocks, pushing the water (and anything floating)
//  out from the tip. The pocket shrinks with the power; letting go sets it free
//  to rise and pop at the surface. The pool level always moves by the volume
//  taken or pushed aside. A speaker inside the pocket stays dry.
//
//  Water core (pools, waves, electricity): beta_water.js.
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B||!B.W) return;
  const T=32, BLK=T*T, MAXB=9, GROW_FR=45, DRIP=BLK*0.35;
  const S={blob:null, drops:[], air:null, rising:[], rings:[], magWas:false, xlrWas:false, tips:[]};
  B.wplay=S;
  const on=()=>B.on&&typeof p!=='undefined'&&p;
  const rad=A=>Math.sqrt(Math.max(0,A)/Math.PI);
  B.waterPlayReset=function(){ S.blob=null; S.drops.length=0; S.air=null; S.rising.length=0; S.rings.length=0; S.tips.length=0; };

  // ── The whole mass reacts: the surface heaves over a growing pocket (sinks over a
  // scoop) and the push travels out from the core as pressure rings.
  function heave(w,x,y,dA,dir){
    if(!w||dA<=0) return;
    const reach=rad(dA*8)+40+Math.max(0,y-w.level)*0.8, k=dA/BLK*4*dir;
    for(let i=0;i<w.n;i++){ const dx=(w.x0+i*w.step-x)/reach; if(dx*dx<9) w.v[i]-=k*Math.exp(-dx*dx); }
  }
  function ring(w,x,y,r0,dir){
    if(!w||S.rings.length>=8) return;
    S.rings.push({w,x,y,r:dir>0?r0:r0+70,dir,a:1});
  }
  function ringsTick(){
    for(let i=S.rings.length-1;i>=0;i--){
      const g=S.rings[i]; g.r+=3.2*g.dir; g.a-=0.028;
      if(g.a<=0||g.r<2){ S.rings.splice(i,1); continue; }
      if(g.dir>0) for(const q of B.bubbles){                // molecules pushed away from the core
        if(q.w!==g.w) continue;
        const dx=q.x-g.x, dy=q.y-g.y, d=Math.hypot(dx,dy)||1;
        if(Math.abs(d-g.r)<10){ q.x+=dx/d*1.6*g.a; q.y+=dy/d*1.6*g.a; }
      }
    }
  }

  // ── Rims: the lowest edge a pool can pour over, and the water that does
  function rimOf(w){
    if(w._rim) return w._rim;
    const side=(col,dir)=>{ let r=w.r1; while(r>=0&&gridSolid(col,r)) r--; return {y:(r+1)*T, x:dir<0?w.x0-4:w.x1+4, dir}; };
    const L=side(w.c0-1,-1), R=side(w.c1+1,1);
    return (w._rim=L.y>=R.y?L:R);
  }
  function spillTick(w){
    if(w.dyn) return;
    const R=rimOf(w), over=R.y-w.base;
    if(over>0.5){                                           // above the rim: it pours over
      const A=Math.min(over*width(w),BLK*0.2);
      w.baseRest+=A/width(w); w.base+=A/width(w);
      w._spill=(w._spill||0)+A;
      if(w._spill>=BLK*0.12){ addDrop(R.x,R.y-6,R.dir*(1.2+Math.random()),-0.4,w._spill,w); w._spill=0; }
    }else if(w._spill>0&&fr%20===0){ addDrop(R.x,R.y-6,R.dir,-0.4,w._spill,w); w._spill=0; }
  }
  function drainBack(w){                                    // a spilled puddle runs home when there's room
    const H=w.home; if(!H||B.waters.indexOf(H)<0) return;
    const R=rimOf(H), room=(H.base-R.y)*width(H);
    if(room<=2) return;
    const A=take(w,Math.min(room,BLK*0.1));
    if(A<=0) return;
    pour(H,A);
    if(fr%4===0) PFXS.push({x:R.x-R.dir*2,y:R.y-2,vx:-R.dir*1.2,vy:0.5,life:14,maxLife:14,r:2,col:'#9ad8ff'});
  }

  // ── Volume bookkeeping (px²): the rest level of a pool moves with what goes in or out
  const width=w=>w.x1-w.x0;
  function volumeOf(w){
    let v=0;
    for(let i=0;i<w.n-1;i++) v+=Math.max(0,w.bottom[i]-w.baseRest)*w.step;
    return v;
  }
  function take(w,A){
    const a=Math.max(0,Math.min(A,volumeOf(w)));
    w.baseRest+=a/width(w);
    return a;
  }
  function pour(w,A){ w.baseRest-=A/width(w); }
  // share of an air circle that is actually under this pool's surface (sampled)
  function airIn(w,a){
    let hit=0, tot=0;
    for(let j=-3;j<=3;j++) for(let i=-3;i<=3;i++){
      const x=a.x+i*a.r/3.5, y=a.y+j*a.r/3.5;
      if(i*i+j*j>12.25) continue;
      tot++; if(B.W.waterAtRaw(x,y)===w) hit++;
    }
    return tot?hit/tot:0;
  }

  // ── Puddles: water that lands on a floor spreads along it until a wall or an edge
  function landWater(x,y,A,home){
    let c=Math.floor(x/T), r=Math.floor(y/T);
    while(r>0&&gridSolid(c,r)) r--;
    let l=c, rr=c;
    while(l>c-8&&!gridSolid(l-1,r)&&gridSolid(l-1,r+1)) l--;
    while(rr<c+8&&!gridSolid(rr+1,r)&&gridSolid(rr+1,r+1)) rr++;
    // an open edge above a pool: the water runs over it and pours in
    for(const ec of [l-1,rr+1]){
      if(gridSolid(ec,r)||gridSolid(ec,r+1)) continue;
      const below=B.waters.find(w=>ec>=w.c0&&ec<=w.c1&&w.r1>=r);
      if(below&&!(below===home&&below.base<=rimOf(below).y+1)){ pour(below,A); B.W.splash(below,(ec+0.5)*T,Math.min(5,A/BLK*1.2),false); return; }   // a brim-full pool can't take its own overflow back yet
    }
    for(const w of B.waters){
      if(rr<w.c0||l>w.c1) continue;
      if(r<w.r0-1||r>w.r1+1) continue;
      pour(w,A); B.W.splash(w,x,Math.min(5,A/BLK*1.2),false); return;
    }
    const wd=(rr-l+1)*T, level=(r+1)*T-A/wd;
    const w=B.W.makeWater(l,rr,Math.min(r,Math.floor(level/T)),r,level,true);
    if(home) w.home=home;
    B.W.splash(w,x,Math.min(5,A/BLK*1.2),false);
  }

  // ── Thrown / dripping water ────────────────────────────────────
  function addDrop(x,y,vx,vy,A,home){ if(A>4) S.drops.push({x,y,vx,vy,A,t:0,home:home||null}); }
  function touchEnemies(x,y,r){
    for(const e of ENEMS){
      if(!e.alive||e.mind||e._betaHeld) continue;
      const nx=Math.max(e.x,Math.min(x,e.x+e.w)), ny=Math.max(e.y,Math.min(y,e.y+e.h));
      if((nx-x)*(nx-x)+(ny-y)*(ny-y)<r*r) B.W.shortEnemy(e);
    }
  }
  function dropsTick(){
    for(let i=S.drops.length-1;i>=0;i--){
      const d=S.drops[i], r=rad(d.A);
      d.t++; d.vy=Math.min(d.vy+GRAV*0.9,14); d.vx*=0.995;
      const w=B.W.waterAtRaw(d.x,d.y);
      if(w&&d.t>2&&!(w===d.home&&w.base<=rimOf(w).y+1)){ pour(w,d.A); B.W.splash(w,d.x,Math.min(7,d.A/BLK+Math.abs(d.vy)*0.3),false); S.drops.splice(i,1); continue; }
      touchEnemies(d.x,d.y,r);
      const nx=d.x+d.vx;
      if(gridSolid(Math.floor((nx+Math.sign(d.vx)*r*0.6)/T),Math.floor(d.y/T))) d.vx*=-0.3; else d.x=nx;
      const ny=d.y+d.vy;
      if(d.vy>0&&gridSolid(Math.floor(d.x/T),Math.floor((ny+r*0.6)/T))){
        landWater(d.x,d.y,d.A,d.home);
        for(let k=0;k<8;k++){ const a=-Math.PI*(0.1+Math.random()*0.8); PFXS.push({x:d.x,y:ny,vx:Math.cos(a)*2,vy:Math.sin(a)*2.5,life:16,maxLife:16,r:1.5+Math.random()*1.5,col:'#9ad8ff'}); }
        S.drops.splice(i,1); continue;
      }
      if(d.vy<0&&gridSolid(Math.floor(d.x/T),Math.floor((ny-r*0.6)/T))) d.vy=Math.abs(d.vy)*0.2; else d.y=ny;
      if(d.t>900) S.drops.splice(i,1);
    }
  }

  // ── MAG: hold water ────────────────────────────────────────────
  function magWater(){
    const magOn=!!(p.magOn&&ITEM===3&&B.magTip);
    const tip=magOn?B.magTip():null;
    if(tip){ S.tips.push({x:tip.x,y:tip.y}); if(S.tips.length>6) S.tips.shift(); }
    if(!magOn){
      if(S.blob){                                          // let go (or out of power): the water flies off the swing
        const h=S.tips, n=Math.max(1,h.length-1);
        let vx=h.length>1?(h[h.length-1].x-h[0].x)/n*1.2:(p.vx||0), vy=h.length>1?(h[h.length-1].y-h[0].y)/n*1.2:(p.vy||0);
        const s=Math.hypot(vx,vy); if(s>16){ vx*=16/s; vy*=16/s; }
        addDrop(S.blob.x,S.blob.y,vx,vy,S.blob.A);
        S.blob=null;
      }
      S.tips.length=0; S.magWas=false; return;
    }
    const src=B.W.waterAtRaw(tip.x,tip.y);
    if(!S.blob&&src&&!(B.mag&&B.mag.held.length)){
      S.blob={x:tip.x,y:tip.y,A:0,hold:0};
      S.blob.A=take(src,BLK);                              // a tap scoops one block
      if(S.blob.A<=0) S.blob=null;
      else{ try{ sfx('mag'); }catch(e){} }
    }
    S.magWas=true;
    const b=S.blob; if(!b) return;
    b.hold++;
    const grown=1+(MAXB-1)*Math.min(1,b.hold/GROW_FR);
    const cap=MAXB*Math.max(0,p.itemStamina)/100;          // grip follows the power
    const want=Math.min(grown,cap)*BLK;
    if(b.A<want&&src){
      const got=take(src,Math.min(want-b.A,BLK*0.25)); b.A+=got;
      heave(src,tip.x,tip.y,got,-1);                        // the surface sinks toward the pull
      if(got>0&&b.hold%6===1) ring(src,tip.x,tip.y,rad(b.A),-1);
    }
    if(b.A>cap*BLK+1){                                    // losing grip: water drips off the bottom, a bit at a time
      const chunk=Math.min(b.A-cap*BLK,DRIP);
      b.A-=chunk; addDrop(b.x+(Math.random()-0.5)*rad(b.A),b.y+rad(b.A)*0.8,(p.vx||0)*0.5,1,chunk);
    }
    const r=rad(b.A);
    b.x=tip.x+tip.ux*r*0.35; b.y=tip.y+tip.uy*r*0.35;      // the field's centre sits on the poles
    b.cap=cap;
    touchEnemies(b.x,b.y,r);
  }

  // ── XLR: blow an air pocket ────────────────────────────────────
  function xlrAir(){
    const xlrOn=!!(p.xlrOn&&ITEM===2&&typeof connectorTipWorld==='function');
    if(!xlrOn){
      if(S.air){ S.rising.push({x:S.air.x,y:S.air.y,A:S.air.A,vy:-0.6,vx:0}); S.air=null; }
      S.xlrWas=false; return;
    }
    const tip=connectorTipWorld(2);
    if(!S.air){
      const w0=B.W.waterAtRaw(tip.x,tip.y);
      if(w0){ S.air={x:tip.x,y:tip.y,A:BLK,hold:0,w:w0}; heave(w0,tip.x,tip.y,BLK,1); ring(w0,tip.x,tip.y,rad(BLK),1); try{ if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.splash(0.3); }catch(e){} }
    }
    S.xlrWas=true;
    const a=S.air; if(!a) return;
    a.hold++;
    a.out=B.W.waterAtRaw(tip.x,tip.y)?0:(a.out||0)+1;
    if(a.out>6){ S.air=null; return; }                     // lifted out of the water: the pocket is just air again
    const drain=typeof _itemEnhanced!=='undefined'&&_itemEnhanced[2]?0.78:1.2;
    p.itemStamina=Math.min(100,(p.itemStamina||0)+drain*0.7);   // blowing air drains slower than the plain push
    const grown=1+(MAXB-1)*Math.min(1,a.hold/GROW_FR);
    const cap=MAXB*Math.max(0,p.itemStamina)/100;
    const want=Math.min(grown,cap)*BLK;
    if(a.A<want){
      const g=Math.min(want-a.A,BLK*0.25); a.A+=g;
      heave(a.w,tip.x,tip.y,g,1);                           // the water it shoves aside lifts the whole surface
      if(a.hold%6===0) ring(a.w,tip.x,tip.y,rad(a.A),1);
    }
    else if(a.A>want){ const lost=Math.min(a.A-want,BLK*0.2); a.A-=lost; S.rising.push({x:a.x,y:a.y-rad(a.A),A:lost,vy:-1.2,vx:(Math.random()-0.5)}); }
    a.x=tip.x; a.y=tip.y;
    // anything floating in the pocket is pushed out from the tip
    const r=rad(a.A);
    const push=(o,cx,cy)=>{ const dx=cx-a.x, dy=cy-a.y, d=Math.hypot(dx,dy)||1; if(d>r+12) return; const k=(1-d/(r+12))*1.2; o.vx=(o.vx||0)+dx/d*k; o.vy=(o.vy||0)+dy/d*k; };
    for(const e of ENEMS) if(!e.mind&&!e._betaHeld) push(e,e.x+e.w/2,e.y+e.h/2);
    for(const k of KDROP) if(k._fly) push(k,k.x,k.y);
    for(const bw of (B.flying||[])) push(bw,bw.x+T/2,bw.y+T/2);
    if(fr%3===0){ const an=Math.random()*Math.PI*2; const w=B.W.waterAtRaw(a.x+Math.cos(an)*(r+4),a.y+Math.sin(an)*(r+4)); if(w) B.bubbles.push({x:a.x+Math.cos(an)*(r+3),y:a.y+Math.sin(an)*(r+3),r:1.5+Math.random()*2,vy:-0.8,w}); }
  }
  function risingTick(){
    for(let i=S.rising.length-1;i>=0;i--){
      const a=S.rising[i];
      a.vy=Math.max(-5,a.vy-0.14); a.y+=a.vy; a.x+=a.vx+Math.sin(fr*0.15+i)*0.4;
      const w=B.W.waterAtRaw(a.x,a.y);
      if(!w){                                              // reached the surface: pop
        for(const q of B.waters) if(a.x>=q.x0&&a.x<q.x1&&Math.abs(a.y-B.W.surfaceAt(q,a.x))<rad(a.A)+40){ B.W.splash(q,a.x,Math.min(6,1+a.A/BLK),true); break; }
        S.rising.splice(i,1);
      }
    }
  }

  // ── Every frame (called from beta_water.js before the pools update) ──
  B.waterPlayTick=function(){
    if(!on()) return;
    magWater(); xlrAir(); risingTick(); dropsTick(); ringsTick();
    B.airs.length=0;
    if(S.air) B.airs.push({x:S.air.x,y:S.air.y,r:rad(S.air.A),A:S.air.A});
    for(const a of S.rising) B.airs.push({x:a.x,y:a.y,r:rad(a.A),A:a.A});
    for(let i=B.waters.length-1;i>=0;i--){
      const w=B.waters[i];
      let air=0; for(const a of B.airs) air+=a.A*airIn(w,a);
      w.base=w.baseRest-air/width(w);
      spillTick(w);
      if(w.dyn){
        drainBack(w);
        const v=volumeOf(w);
        if(v<16&&!air){ if(w.home&&B.waters.indexOf(w.home)>=0) pour(w.home,v); B.waters.splice(i,1); }   // a puddle scooped dry is gone
      }
    }
  };
  B.waterVolume=function(){                              // for tests: water in pools + held + flying
    let v=0; for(const w of B.waters) v+=volumeOf(w)+(w._spill||0);
    if(S.blob) v+=S.blob.A; for(const d of S.drops) v+=d.A; return v;
  };

  // ── Drawing (over the water) ────────────────────────────────────
  function waterBall(x,y,r,a){
    const X=sx(x), Y=sy(y), R=sw(r);
    const g=ctx.createRadialGradient(X-R*0.35,Y-R*0.4,R*0.1,X,Y,R);
    g.addColorStop(0,'rgba(170,225,255,'+(0.75*a)+')'); g.addColorStop(1,'rgba(30,90,200,'+(0.72*a)+')');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(X,Y,R,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(225,245,255,'+(0.8*a)+')'; ctx.lineWidth=Math.max(1,sw(1.5)); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,'+(0.7*a)+')'; ctx.beginPath(); ctx.arc(X-R*0.4,Y-R*0.45,Math.max(1,R*0.16),0,Math.PI*2); ctx.fill();
  }
  B.drawWaterPlay=function(){
    if(!on()) return;
    const b=S.blob;
    if(b){
      const r=rad(b.A), wob=Math.sin(fr*0.2)*0.05;
      if(b.cap>0){                                         // the magnet's reach: centre + circular edge
        ctx.save(); ctx.strokeStyle='rgba(200,120,255,'+(0.35+0.15*Math.sin(fr*0.15))+')'; ctx.lineWidth=Math.max(1,sw(1.5)); ctx.setLineDash([sw(4),sw(4)]);
        ctx.beginPath(); ctx.arc(sx(b.x),sy(b.y),sw(rad(b.cap*BLK)),0,Math.PI*2); ctx.stroke(); ctx.restore();
      }
      waterBall(b.x,b.y,r*(1+wob),1);
      ctx.fillStyle='rgba(220,160,255,0.9)'; ctx.beginPath(); ctx.arc(sx(b.x),sy(b.y),Math.max(1.5,sw(2)),0,Math.PI*2); ctx.fill();
    }
    for(const d of S.drops) waterBall(d.x,d.y,rad(d.A),0.95);
    if(S.rings.length){                                     // pressure rings, only inside the water
      ctx.save(); ctx.lineWidth=Math.max(1,sw(2));
      for(const g of S.rings){
        const w=g.w; if(B.waters.indexOf(w)<0) continue;
        ctx.save(); ctx.beginPath(); ctx.moveTo(sx(w.x0),sy(w.level+w.h[0]));
        for(let i=1;i<w.n;i++) ctx.lineTo(sx(Math.min(w.x1,w.x0+i*w.step)),sy(w.level+w.h[i]));
        ctx.lineTo(sx(w.x1),sy((w.r1+1)*T+T*3)); ctx.lineTo(sx(w.x0),sy((w.r1+1)*T+T*3)); ctx.closePath(); ctx.clip();
        ctx.strokeStyle='rgba(205,240,255,'+(0.4*g.a)+')';
        ctx.beginPath(); ctx.arc(sx(g.x),sy(g.y),sw(g.r),0,Math.PI*2); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
    for(const a of B.airs){                                 // air pockets: a bright skin where the water was pushed back
      const X=sx(a.x), Y=sy(a.y), R=sw(a.r);
      ctx.strokeStyle='rgba(225,248,255,0.85)'; ctx.lineWidth=Math.max(1.5,sw(2)); ctx.beginPath(); ctx.arc(X,Y,R,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle='rgba(220,245,255,0.08)'; ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=Math.max(1,sw(2)); ctx.beginPath(); ctx.arc(X,Y,R*0.72,Math.PI*1.1,Math.PI*1.45); ctx.stroke();
    }
  };
})();
