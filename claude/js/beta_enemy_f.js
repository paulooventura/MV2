// ============================================================
//  beta_enemy_f.js — Enemy F, Paulo's version (T136)
//
//  "push or pull matter from its core ... punch all of its 6 notch points,
//   then it collapses, causing the environment to react"
//
//  Builds on the transparent cube of beta_foes.js (ai='cube': the hexagon
//  that lies dormant in water and rams), through its public hooks only:
//   - it wakes when the hero comes near (in the water or on the shore);
//   - awake, its core runs a cycle: PULL (draws matter in), CHARGE, PUSH
//     (a burst out), rest. Matter = the hero, loose cubes, loose items, the
//     Isolator when knocked off, and the water itself (moved cell to cell,
//     so the pool's volume never changes);
//   - only punches hurt it, and only on its 6 notch points (the corners).
//     Each punch breaks the notch nearest the fist; anything else clinks;
//   - all 6 broken: it collapses. The water surges out from where it was,
//     nearby cubes are thrown loose, omni blocks right around it crumble
//     (a passage opens), and it's gone.
//  1.2 gets one in its big pool (placed in code; the .ldtk is untouched).
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B||!B.mkAiEnemy||!B.foeTick) return;
  const T=32, NOTCHES=6;
  const REACH=280;                                    // how far the core pulls / pushes (px)
  const WAKE_R=230;                                   // the hero this close (seen) wakes it
  const CYCLE=300, PULL_END=120, CHARGE_END=150, PUSH_END=170;
  const WATER_R=170;                                  // water it stirs around its core (px)
  const PASSAGE_R=4.5*T;                              // omni blocks this close crumble on the collapse
  const SHOVE_R=6*T;                                  // cubes this close are thrown loose on the collapse
  const COLLAPSE_FR=48;
  const PLACE={'1.2':[14,60]};                        // [col,row] of the Enemy cell (feet on row 61's floor)

  const on=()=>B.on&&typeof p!=='undefined'&&p&&_gameState==='game';
  const solid=(x,y)=>typeof gridWorldSolid==='function'&&gridWorldSolid(x,y);
  const S=(n,v)=>{ try{ sfx(n,v); }catch(e){} };
  const SA=(o,n,v)=>{ try{ if(typeof sfxAt==='function') sfxAt(o,n,v); else sfx(n,v); }catch(e){} };
  function clearLine(x0,y0,x1,y1,skip){             // skip = px at the far end left out (a cube's own cell is solid)
    const L=Math.hypot(x1-x0,y1-y0), n=Math.ceil(L/12), end=L-(skip||0);
    for(let i=1;i<n;i++){ if(L*i/n>end) break; if(solid(x0+(x1-x0)*i/n,y0+(y1-y0)*i/n)) return false; } return true; }
  function burst(x,y,n,cols,sp){ if(typeof PFXS==='undefined') return; for(let k=0;k<n;k++){ const a=Math.random()*Math.PI*2, s=(sp||3)*(0.4+Math.random()); PFXS.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:12+Math.random()*14|0,maxLife:26,r:1.5+Math.random()*2,col:cols[k%cols.length]}); } }
  const core=e=>({x:e.x+e.w/2, y:e.y+e.h/2});
  const heroC=()=>({x:p.x+SW/2, y:p.y+FEET_OFF-STAND_H*0.5});
  const radius=e=>e.w*0.56;                           // beta_foes draws the hexagon at 0.56 × w
  function notchPos(e,i){ const c=core(e), a=(e.spin||0)-Math.PI/2+i*Math.PI/3, R=radius(e); return {x:c.x+Math.cos(a)*R, y:c.y+Math.sin(a)*R}; }
  function phaseOf(e){ const t=e.fT%CYCLE; return t<PULL_END?'pull':t<CHARGE_END?'charge':t<PUSH_END?'push':'rest'; }

  // ── the maker: every water cube is Paulo's F now ─────────────────
  const _mk=B.mkAiEnemy;
  B.mkAiEnemy=function(ai){
    const e=_mk.apply(this,arguments);
    if(ai==='cube'&&e){ e._fx=true; e.notch=new Array(NOTCHES).fill(0); e.fT=0; e.fPh='sleep'; e.hp=e.mhp=9999; e.fWasAwake=false; e.fColT=null; }
    return e;
  };

  // ── only punches on a notch count ───────────────────────────────
  let pend=null, fxKill=false;
  const _dmg=window._damageEnemy;
  if(typeof _dmg==='function') window._damageEnemy=function(e){
    if(e&&e._fx&&!fxKill){
      if(e.alive){ pend={e, fr:typeof fr!=='undefined'?fr:0}; e.hitF=10; }
      return false;
    }
    return _dmg.apply(this,arguments);
  };
  const _pc=window._punchConnect;
  window._punchConnect=function(x,y,ang,charged,kind){
    const r=typeof _pc==='function'?_pc.apply(this,arguments):undefined;
    try{ if(kind==='enemy'&&pend&&pend.fr===(typeof fr!=='undefined'?fr:0)){ const e=pend.e; pend=null; notchHit(e,x,y,ang,charged); } }catch(er){ console.warn('enemy F punch',er); }
    return r;
  };
  function clink(e,x,y){ burst(x,y,6,['#ffffff','#bfe6ff'],3); SA(e,'omniblock_chip',1.7); }
  function notchHit(e,x,y,ang,charged){
    if(!e||!e.alive||!e._fx) return;
    const c=core(e), R=radius(e);
    if(Math.hypot(x-c.x,y-c.y)<R*0.42){ clink(e,x,y); return; }          // the core itself shrugs it off
    let best=-1, bd=1e9;
    for(let i=0;i<NOTCHES;i++){ const q=notchPos(e,i), d=Math.hypot(x-q.x,y-q.y); if(d<bd){ bd=d; best=i; } }
    if(best<0||bd>R*0.75||e.notch[best]){ clink(e,x,y); return; }
    e.notch[best]=1;
    const q=notchPos(e,best);
    burst(q.x,q.y,charged?18:12,['#ffffff','#bfe6ff','#7fc8ff'],charged?5:3.5);
    SA(e,'omniblock_shatter',1.3+0.1*e.notch.filter(Boolean).length);
    B.shake=Math.max(B.shake||0,charged?5:3);
    e.vx=(e.vx||0)+Math.cos(ang||0)*(charged?3:1.8); e.vy=(e.vy||0)+Math.sin(ang||0)*(charged?3:1.8);
    if(e.st==='sleep'){ e.st='hunt'; e.awakeT=0; }
    if(e.notch.every(Boolean)) collapse(e);
  }

  // ── matter: what the core pulls in and pushes away ──────────────
  function towardCore(e,x,y){ const c=core(e), dx=x-c.x, dy=y-c.y, d=Math.hypot(dx,dy)||1; return {ux:dx/d, uy:dy/d, d, c}; }
  function hero(e,mode,burstNow){
    if(!p||B.magLock||(p.hook&&p.hook.st==='on')) return;
    const P=heroC(), v=towardCore(e,P.x,P.y);
    if(v.d>REACH||!clearLine(v.c.x,v.c.y,P.x,P.y)) return;
    const k=1-v.d/REACH;
    if(mode==='pull'){ p.vx-=v.ux*0.34*k; p.vy-=v.uy*0.34*k; }
    else if(burstNow){ p.vx+=v.ux*11*k; p.vy+=v.uy*7*k-3*k; p.og=false; e.fShoved=(e.fShoved||0)+1; }
  }
  function cubes(e,mode,burstNow,range,kick){
    if(typeof BWALLS==='undefined'||!B.throwCube) return 0; let n=0;
    for(const bw of BWALLS){
      if(!bw||bw.hp<=0||!bw.cube||bw._carried) continue;
      const v=towardCore(e,bw.x+bw.w/2,bw.y+bw.h/2), R=range||REACH;
      if(v.d>R||!clearLine(v.c.x,v.c.y,bw.x+bw.w/2,bw.y+bw.h/2,T*0.75)) continue;
      const k=1-v.d/R, s=mode==='pull'?-1:1;
      if(mode==='pull'){
        if(v.d<e.w*0.6+20){                                               // it doesn't swallow them
          if(bw._fly){ bw.vx*=0.8; bw.vy*=0.8; if(v.d<e.w*0.5+T*0.5){ bw.vx+=v.ux*1.2; bw.vy+=v.uy*1.2; } }
          continue;
        }
        if(!bw._fly){ if(k>0.1&&e.fT%30===0){ const s0=2.5+4*k; B.throwCube(bw,-v.ux*s0,-v.uy*s0-1.5); n++; } }
        else{ bw.vx+=-v.ux*(0.12+0.3*k); bw.vy+=-v.uy*(0.12+0.3*k)-0.15; }
      }else if(burstNow){
        const m=kick||1;
        if(!bw._fly) B.throwCube(bw,s*v.ux*11*k*m,v.uy*6*k*m-4*m); else { bw.vx+=v.ux*11*k*m; bw.vy+=v.uy*6*k*m-3*m; }
        n++;
      }
    }
    return n;
  }
  function items(e,mode,burstNow){
    if(typeof ITEM_DROPS!=='undefined') for(const d of ITEM_DROPS){
      if(!d||d.got) continue;
      const v=towardCore(e,d.x+(d.w||36)/2,d.y+(d.h||36)/2);
      if(v.d>REACH||v.d<e.w*0.6+16) continue;
      const k=1-v.d/REACH, step=mode==='pull'?-2.2*k:(burstNow?36*k:0);
      if(!step) continue;
      const nx=d.x+v.ux*step, ny=d.y+v.uy*step;
      if(!solid(nx+(d.w||36)/2,ny+(d.h||36)/2)){ d.x=nx; d.y=ny; }
    }
    const L=B.isoLoose;
    if(L){ const v=towardCore(e,L.x,L.y); if(v.d<REACH){ const k=1-v.d/REACH; if(mode==='pull'){ L.vx-=v.ux*0.3*k; L.vy-=v.uy*0.3*k; } else if(burstNow){ L.vx+=v.ux*7*k; L.vy+=v.uy*6*k-2; } } }
  }
  // water, cell to cell: each cell gives a share to its neighbour toward (pull) or away from
  // (push) the core; amounts are worked out from the old levels, then applied — what one cell
  // loses another gains, so the pool's volume (B.fluidTotal) stays the same
  const flow=[];
  function water(e,mode,rate,range){
    const F=B.fluid; if(!F||!F.ready||!F.M||!F.BLK) return 0;
    const CS=F.CS, NX=F.NX, NY=F.NY, M=F.M, BLK=F.BLK, c=core(e), R=range||WATER_R, inner=e.w*0.5;
    const x0=Math.max(0,Math.floor((c.x-R)/CS)), x1=Math.min(NX-1,Math.floor((c.x+R)/CS));
    const y0=Math.max(0,Math.floor((c.y-R)/CS)), y1=Math.min(NY-1,Math.floor((c.y+R)/CS));
    flow.length=0; let moved=0;
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
      const i=y*NX+x; if(BLK[i]||M[i]<0.02) continue;
      const dx=(x+0.5)*CS-c.x, dy=(y+0.5)*CS-c.y, d=Math.hypot(dx,dy);
      if(d>R||d<inner*0.6) continue;
      const s=mode==='pull'?-1:1;
      const sx=Math.abs(dx)>=Math.abs(dy)?Math.sign(dx)*s:0, sy=sx?0:Math.sign(dy)*s;
      const nx=x+sx, ny=y+sy; if(nx<0||nx>=NX||ny<0||ny>=NY) continue;
      const j=ny*NX+nx; if(BLK[j]) continue;
      if(mode==='pull'&&M[j]>1.25) continue;                              // don't pile it up forever
      const t=M[i]*rate*(1-d/R); if(t>0) flow.push(i,j,t);
    }
    for(let q=0;q<flow.length;q+=3){ const t=Math.min(flow[q+2],M[flow[q]]); M[flow[q]]-=t; M[flow[q+1]]+=t; moved+=t; }
    return moved;
  }
  function heave(e,P,spread){                          // the surface wave over the core (looks only)
    const F=B.fluid; if(!F||!F.ready||!F.WV) return;
    const cx=Math.floor((e.x+e.w/2)/F.CS);
    for(let k=-spread;k<=spread;k++){ const j=cx+k; if(j>=0&&j<F.NX) F.WV[j]+=P*(1-Math.abs(k)/(spread+1)); }
  }

  // ── its cycle ───────────────────────────────────────────────────
  function fTick(e){
    const c=core(e), P=heroC(), d=Math.hypot(P.x-c.x,P.y-c.y);
    const wet=B.inWater&&B.inWater(c.x,c.y);
    if(e.st==='sleep'&&wet&&d<WAKE_R&&clearLine(c.x,c.y,P.x,P.y)){
      const dormant=!e.fWasAwake||(e.fSleepT||0)>90;
      e.st='hunt'; e.awakeT=0;
      if(dormant){ S('enemy_boot',1.4); burst(c.x,c.y,10,['#bfe6ff','#ffffff'],2); }
    }
    if(e.st==='hunt'&&d<REACH+60) e.awakeT=0;            // stays up while the hero is around
    const awake=e.st==='hunt'&&wet;
    if(!awake){                                         // a moment at the surface only pauses it
      e.fSleepT=(e.fSleepT||0)+1;
      if(e.fSleepT>90){ e.fPh='sleep'; e.fWasAwake=false; e.fT=0; }
      return;
    }
    e.fSleepT=0;
    if(!e.fWasAwake){ e.fWasAwake=true; e.fT=0; }
    e.fT++;
    const ph=phaseOf(e), t=e.fT%CYCLE, burstNow=t===CHARGE_END;
    e.fPh=ph;
    if(ph==='pull'){
      hero(e,'pull'); cubes(e,'pull'); items(e,'pull'); water(e,'pull',0.02);
      if(e.fT%10===0) heave(e,-0.6,4);
      if(t===0) SA(e,'reel_in',0.6);
    }else if(ph==='charge'){
      if(t===PULL_END) SA(e,'chargeReady',1.1);
      e.vx*=0.6; e.vy*=0.6;                              // it holds still to fire (the tell)
    }else if(ph==='push'){
      e.vx*=0.6; e.vy*=0.6;
      if(burstNow){
        hero(e,'push',true); cubes(e,'push',true); items(e,'push',true);
        water(e,'push',0.25); heave(e,6,6);
        B.shake=Math.max(B.shake||0,5); SA(e,'water_gush',1);
        burst(c.x,c.y,20,['#ffffff','#bfe6ff','#80c0ff'],5);
      }else water(e,'push',0.04);
    }
    e.fStat=e.fStat||{pulls:0,pushes:0}; if(burstNow) e.fStat.pushes++; if(t===0) e.fStat.pulls++;
  }

  // ── the collapse ────────────────────────────────────────────────
  function collapse(e){
    if(e.fColT!=null) return;
    const c=core(e);
    e._shorted=true; e._permOff=true; e._stayDown=true;
    fxKill=true; try{ if(typeof _dmg==='function') _dmg.call(window,e,1e6,null,null); }finally{ fxKill=false; }
    e.alive=false; e.fColT=0; e.fPh='collapse';
    B.shake=Math.max(B.shake||0,12);
    S('enemy_dead',0.8); SA(e,'omniblock_shatter',0.7);
    for(let k=0;k<4;k++) setTimeout(()=>burst(c.x+(Math.random()-0.5)*80,c.y+(Math.random()-0.5)*80,22,['#ffffff','#bfe6ff','#7fc8ff','#e0f4ff'],6),k*120);
    // the environment reacts
    const out={water:0, cubes:0, blocks:0};
    out.water=water(e,'push',0.5,260); heave(e,14,10);
    if(typeof BWALLS!=='undefined'&&typeof _damageBwall==='function') for(const bw of BWALLS){
      if(!bw||bw.hp<=0||bw.only||!bw.cube) continue;                     // omni blocks only
      const dd=Math.hypot(bw.x+bw.w/2-c.x,bw.y+bw.h/2-c.y); if(dd>PASSAGE_R) continue;
      try{ _damageBwall(bw,(bw.hp||1)+1,{shakeX:(bw.x-c.x)/dd*6,shakeY:(bw.y-c.y)/dd*6}); if(typeof spawnDebris==='function') spawnDebris(bw,10); out.blocks++; }catch(er){}
    }
    if(out.blocks&&typeof gridStampLiveBwalls==='function') try{ gridStampLiveBwalls(); }catch(er){}
    out.cubes=cubes(e,'push',true,SHOVE_R,1.3);
    e.fReact=out; B.enemyFDown=(B.enemyFDown||0)+1;
    if(typeof uiShowToast==='function') uiShowToast('THE HEXAGON COLLAPSES');
  }
  function collapseTick(e){
    e.fColT++;
    if(e.fColT<20) water(e,'push',0.06,260);             // the surge keeps going a moment
    if(e.fColT>=COLLAPSE_FR){ const i=ENEMS.indexOf(e); if(i>=0) ENEMS.splice(i,1); }
  }

  const _ai=B.enemyAITick;
  B.enemyAITick=function(){
    const r=_ai?_ai.apply(this,arguments):undefined;
    if(!on()||typeof ENEMS==='undefined') return r;
    try{ for(const e of ENEMS.slice()){ if(!e||!e._fx) continue; if(e.fColT!=null) collapseTick(e); else if(e.alive) fTick(e); } }catch(er){ console.warn('enemy F',er); }
    return r;
  };

  // ── drawing: beta_foes draws the glass hexagon; the notches and the core go on top ──
  function drawOver(e){
    const cx=sx(e.x+e.w/2), cy=sy(e.y+e.h/2), R=sw(radius(e)), ph=e.fPh, t=e.fT%CYCLE;
    const awake=ph!=='sleep', a=awake?1:0.35;
    ctx.save(); ctx.translate(cx,cy);
    // the core
    let cr=R*0.16, glow=awake?0.35:0.12;
    if(ph==='charge'){ const k=(t-PULL_END)/(CHARGE_END-PULL_END); cr=R*(0.16+0.12*k); glow=0.4+0.6*k; }
    else if(ph==='push') glow=1-(t-CHARGE_END)/(PUSH_END-CHARGE_END)*0.6;
    ctx.globalCompositeOperation='lighter';
    const g=ctx.createRadialGradient(0,0,0,0,0,cr*2.6); g.addColorStop(0,'rgba(230,248,255,'+glow+')'); g.addColorStop(1,'rgba(120,200,255,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,cr*2.6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(240,252,255,'+(0.3+0.6*glow)+')'; ctx.beginPath(); ctx.arc(0,0,cr,0,Math.PI*2); ctx.fill();
    if(ph==='pull'){                                   // streaks drawn in toward the core
      ctx.strokeStyle='rgba(150,220,255,0.55)'; ctx.lineWidth=Math.max(1,sw(2));
      for(let k=0;k<8;k++){ const an=k*Math.PI/4+fr*0.02, f=1-((fr*0.03+k*0.37)%1), r0=sw(REACH)*0.55*f+R*0.3, r1=r0+sw(18);
        ctx.beginPath(); ctx.moveTo(Math.cos(an)*r1,Math.sin(an)*r1); ctx.lineTo(Math.cos(an)*r0,Math.sin(an)*r0); ctx.stroke(); }
    }else if(ph==='push'){                             // the burst ring
      const k=(t-CHARGE_END)/(PUSH_END-CHARGE_END), rr=R+k*(sw(REACH)-R);
      ctx.strokeStyle='rgba(235,250,255,'+(0.8*(1-k))+')'; ctx.lineWidth=Math.max(1.5,sw(5*(1-k)+1));
      ctx.beginPath(); ctx.arc(0,0,rr,0,Math.PI*2); ctx.stroke();
    }
    ctx.globalCompositeOperation='source-over';
    // the 6 notch points, on the corners (they turn with the body)
    ctx.rotate(e.spin||0);
    for(let i=0;i<NOTCHES;i++){
      const an=-Math.PI/2+i*Math.PI/3, x=Math.cos(an)*R, y=Math.sin(an)*R, s=Math.max(3,sw(7));
      ctx.save(); ctx.translate(x,y); ctx.rotate(an);
      if(e.notch[i]){                                  // broken: a dark chip with cracks
        ctx.fillStyle='rgba(20,30,50,0.85)'; ctx.beginPath(); ctx.moveTo(s,0); ctx.lineTo(-s*0.4,s*0.8); ctx.lineTo(-s*0.4,-s*0.8); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(-s*0.4,0); ctx.lineTo(-s*1.8,s*0.5); ctx.moveTo(-s*0.4,0); ctx.lineTo(-s*1.6,-s*0.7); ctx.stroke();
      }else{                                           // live: a bright notch in the corner
        const pulse=awake?0.6+0.4*Math.sin(fr*0.15+i):0.5;
        ctx.fillStyle='rgba(200,240,255,'+(a*pulse)+')'; ctx.beginPath(); ctx.moveTo(s*0.9,0); ctx.lineTo(0,s*0.75); ctx.lineTo(-s*0.9,0); ctx.lineTo(0,-s*0.75); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,'+(a*0.9)+')'; ctx.lineWidth=1.2; ctx.stroke();
        ctx.fillStyle='rgba(30,60,90,'+(a*0.8)+')'; ctx.beginPath(); ctx.moveTo(s*0.9,0); ctx.lineTo(s*0.1,s*0.25); ctx.lineTo(s*0.1,-s*0.25); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }
  function drawCollapse(e){                            // the hexagon folds in on its core and is gone
    const k=e.fColT/COLLAPSE_FR, cx=sx(e.x+e.w/2), cy=sy(e.y+e.h/2), R=sw(radius(e));
    ctx.save(); ctx.translate(cx,cy);
    for(let i=0;i<NOTCHES;i++){
      const an=(e.spin||0)-Math.PI/2+i*Math.PI/3, an2=an+Math.PI/3, out=R*(0.2+1.4*k);
      const ox=Math.cos(an+Math.PI/6)*out, oy=Math.sin(an+Math.PI/6)*out+sw(30)*k*k, s=R*(1-k*0.6);
      ctx.fillStyle='rgba(190,230,255,'+(0.3*(1-k))+')'; ctx.strokeStyle='rgba(235,248,255,'+(0.9*(1-k))+')'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(ox+Math.cos(an)*s*0.5,oy+Math.sin(an)*s*0.5); ctx.lineTo(ox+Math.cos(an2)*s*0.5,oy+Math.sin(an2)*s*0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if(k<0.5){ ctx.globalCompositeOperation='lighter'; ctx.fillStyle='rgba(235,250,255,'+(1-k*2)+')'; ctx.beginPath(); ctx.arc(0,0,R*0.5*(1-k*2)+2,0,Math.PI*2); ctx.fill(); }
    ctx.restore();
  }
  const _fd=B.foeDraw;
  B.foeDraw=function(e){
    if(e&&e._fx&&e.fColT!=null){ try{ drawCollapse(e); }catch(er){} return; }
    const r=_fd?_fd.apply(this,arguments):undefined;
    if(e&&e._fx&&e.alive) try{ drawOver(e); }catch(er){ console.warn('enemy F draw',er); }
    return r;
  };

  // ── placement: one in 1.2's pool ────────────────────────────────
  const _onEnt=B.onEntities;
  B.onEntities=function(ents){
    if(_onEnt) _onEnt.apply(this,arguments);
    try{
      const at=PLACE[B.stageId]; if(!at||!B._placeEnt||typeof ENEMS==='undefined') return;
      const ent={__identifier:'Enemy', __grid:[at[0],at[1]], width:16, height:16, fieldInstances:[{__identifier:'ai', __value:'cube'}]};
      const key=B.entKey?B.entKey(ent):'Enemy@'+at[0]+','+at[1];
      let gone=null; try{ gone=new Set(JSON.parse(localStorage.getItem((B.goneKey||'mv2.editor.gone.')+B.stageId)||'[]')); }catch(er){}
      if(gone&&gone.has(key)) return;                  // erased in the live editor
      if(ENEMS.some(o=>o&&o._lk===key)) return;
      const n=ENEMS.length; B._placeEnt(ent);
      for(const o of ENEMS.slice(n)) o._lk=key;
    }catch(er){ console.warn('enemy F place',er); }
  };

  window.MV_ENEMY_F={REACH, WAKE_R, CYCLE, notchPos, collapse, list:()=>(typeof ENEMS!=='undefined'?ENEMS:[]).filter(e=>e&&e._fx)};
})();
