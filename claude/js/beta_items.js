// ============================================================
//  beta_items.js — the jacks, old asks batch (Paulo's notes, T132)
//
//   TRS RICOCHET  "Our TRS projectiles ricochet around the stage before losing
//                 power and disappearing." A shot that meets rock bounces off it
//                 (slopes and corners too), losing speed and power each time; the
//                 game's own bounced-shot drag and fizzle wear it out. The 4th
//                 wall ends it. Blocks still take the hit.
//   MEG SWING     "the block should keep the momentum we established with our arm
//                 movement": the tip's path relative to MIND is tracked while the
//                 MEG is held; beta_level's throw adds that swing (B.magSwing).
//                 (One object at a time + no pull while holding: beta_level.)
//   MEG STOW      switching away from the MEG (not stuck to a surface — that's the
//                 park): the glove hand takes it off the arm, carries it over the
//                 head and seats it in the back socket, like the RCA.
//   FOES TAKE     "If they shut us down, we drop our items ... and the enemies can
//   JACKS         pick it up and use it". A shutdown drops the jack in hand. Any
//                 loose jack of MIND's (shutdown, A+B drop, D's knock) is taken by
//                 an enemy A / B / C / E that touches it; it shows in its hand and
//                 it uses it on MIND: TRS shots, XLR gusts, MEG pull, RCA yank.
//                 Shut it down and the jack drops; leaving the stage gives back
//                 any jack still out there.
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B) return;
  const T=32;
  const on=()=>B.on&&typeof p!=='undefined'&&p&&_gameState==='game'&&!(typeof _paused!=='undefined'&&_paused);
  const solid=(x,y)=>typeof gridWorldSolid==='function'&&gridWorldSolid(x,y);
  const S=(o,n,v)=>{ try{ o?sfxAt(o,n,v):sfx(n,v); }catch(e){} };
  const NAMES=['TRS','RCA','XLR','MEG'];

  // ── TRS: ricochet off rock ───────────────────────────────────
  const RIC={MAX:3, KEEP:0.78, KEEP_ENH:0.92, POWER:0.72, LOOK:1.1};
  const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[0.707,0.707],[-0.707,0.707],[0.707,-0.707],[-0.707,-0.707]];
  function blockAt(x,y){
    for(const bw of BWALLS){ if(bw.hp>0&&ov(x-4,y-4,8,8,bw.x+(bw._ox||0),bw.y+(bw._oy||0),bw.w,bw.h)) return true; }
    return false;
  }
  function surfaceNormal(x,y){
    let nx=0, ny=0;
    for(const [dx,dy] of DIRS) if(solid(x+dx*6,y+dy*6)){ nx-=dx; ny-=dy; }
    const l=Math.hypot(nx,ny); if(l<0.3) return null;
    const a=Math.round(Math.atan2(ny,nx)/(Math.PI/4))*(Math.PI/4);    // walls, floors, 45° slopes
    return {x:Math.cos(a), y:Math.sin(a)};
  }
  function ricochet(){
    if(!p||!p.shots) return;
    for(const s of p.shots){
      if(s._fizzle) continue;
      const b=s.bounces||0; if(b>=RIC.MAX) continue;                 // the game ends it on this wall
      const hx=s.x+s.vx*RIC.LOOK, hy=s.y+s.vy*RIC.LOOK;
      if(!solid(hx,hy)||solid(s.x,s.y)||blockAt(hx,hy)) continue;
      const keep=s.enhanced?RIC.KEEP_ENH:RIC.KEEP;
      let vx=s.vx, vy=s.vy;
      const n=surfaceNormal(hx,hy), dot=n?vx*n.x+vy*n.y:0;
      if(n&&dot<0){ vx-=2*dot*n.x; vy-=2*dot*n.y; }
      else {
        const xh=solid(hx,s.y), yh=solid(s.x,hy);
        if(xh) vx=-vx; if(yh) vy=-vy; if(!xh&&!yh){ vx=-vx; vy=-vy; }
      }
      vx*=keep; vy*=keep;
      if(solid(s.x+vx,s.y+vy)){ vx=-s.vx*keep; vy=-s.vy*keep; }
      s.vx=vx; s.vy=vy;
      s.power=(s.power||1)*RIC.POWER; s.bounces=b+1; s._airAge=0; s.life=Math.min(s.life,180);
      try{ spawnSpark(hx,hy,vx,vy); }catch(e){}
      if(s.enhanced) try{ spawnTrsFlame(hx,hy,{stick:true,hero:s.owner}); }catch(e){}
      S(s,'laser_bounce',b);
    }
  }
  const _ups=window.updatePlayerShots;
  if(typeof _ups==='function') window.updatePlayerShots=function(){
    try{ if(B.on) ricochet(); }catch(er){ console.warn('ricochet',er); }
    return _ups.apply(this,arguments);
  };

  // ── MEG: the arm's swing goes into the throw ─────────────────
  const SWING={K:1.5, CAP:15, HIST:10, WIN:3};
  const hist=[];
  function swingTick(){
    if(ITEM===3&&p.magOn&&!B.magLock&&!B.magPark&&B.magTip){
      const t=B.magTip(); hist.push({x:t.x-p.x, y:t.y-p.y}); if(hist.length>SWING.HIST) hist.shift();
    } else hist.length=0;
  }
  // the fastest stretch of the last few frames: release just after the swing still counts
  B.magSwing=function(){
    let best={x:0,y:0}, bs=0;
    for(let i=hist.length-1;i>=SWING.WIN&&i>=hist.length-6;i--){
      const a=hist[i-SWING.WIN], b=hist[i], x=(b.x-a.x)/SWING.WIN, y=(b.y-a.y)/SWING.WIN, s=Math.hypot(x,y);
      const w=s*(1-(hist.length-1-i)*0.12);
      if(w>bs){ bs=w; best={x,y}; }
    }
    let x=best.x*SWING.K, y=best.y*SWING.K; const s=Math.hypot(x,y);
    if(s>SWING.CAP){ x*=SWING.CAP/s; y*=SWING.CAP/s; }
    return {x,y};
  };

  // ── MEG: off the arm, over the head, into the back ───────────
  const STOW_FR=40, STOW_GRAB=0.25;
  let stow=null;
  const seatAng=()=>p.fc?2.2:Math.PI-2.2;                        // nose down and back into the socket
  function stowPoint(){
    const k=Math.min(1,stow.t/STOW_FR), A={x:p.x+stow.rel.dx, y:p.y+stow.rel.dy};
    if(k<STOW_GRAB) return {x:A.x, y:A.y, ang:stow.ang, grab:true, gk:k/STOW_GRAB, k:0};
    const u=(k-STOW_GRAB)/(1-STOW_GRAB), e=u*u*(3-2*u), Sk=hookAttachWorld();
    const C={x:p.x+SW/2+(p.fc?-1:1)*4, y:Sk.y-100};
    let da=seatAng()-stow.ang; while(da>Math.PI) da-=2*Math.PI; while(da<-Math.PI) da+=2*Math.PI;
    return {x:(1-e)*(1-e)*A.x+2*(1-e)*e*C.x+e*e*Sk.x, y:(1-e)*(1-e)*A.y+2*(1-e)*e*C.y+e*e*Sk.y, ang:stow.ang+da*e, k:e};
  }
  const _cyc=window._cycleItem;
  if(typeof _cyc==='function') window._cycleItem=function(){
    const was=on()&&ITEM===3&&!B.magLock&&!B.magPark&&!(_shutdownTimer>0);
    let rel=null, ang=0;
    if(was){ try{ const ps=computeConnectorArmPose(p); if(isFinite(ps.tipX)){ rel={dx:ps.tipX-p.x, dy:ps.tipY-p.y}; ang=ps.aimAngle!=null?ps.aimAngle:Math.atan2(p.aimDY||0,p.aimDX||1); } }catch(e){} }
    const r=_cyc.apply(this,arguments);
    if(was&&rel&&ITEM!==3&&!B.magPark) stow={t:0, rel, ang, fade:0};
    return r;
  };
  function stowTick(){
    if(!stow) return;
    if(_shutdownTimer>0||ITEM===3){ stow=null; return; }
    if(stow.t===Math.round(STOW_FR*STOW_GRAB)) S(null,'item_clink');
    if(++stow.t===STOW_FR){
      S(null,'grap_attach'); p._plugArchT=Math.max(p._plugArchT||0,20);
      const q=hookAttachWorld(); for(let k=0;k<8;k++) PFXS.push({x:q.x,y:q.y,vx:(Math.random()-0.5)*2.4,vy:-Math.random()*1.6,life:12,maxLife:12,r:1.6,col:k%2?'#ff5050':'#5080ff'});
    }
    if(stow.t>STOW_FR+10) stow=null;
  }
  function drawStow(){
    if(!stow||typeof drawConnectorTip!=='function') return;
    const q=stowPoint(), seat=Math.max(0,stow.t-STOW_FR)/10;
    ctx.save(); ctx.globalAlpha=1-seat;
    try{ drawConnectorTip(sx(q.x-Math.cos(q.ang)*seat*10),sy(q.y-Math.sin(q.ang)*seat*10),q.ang,0,3); }catch(e){}
    ctx.restore();
  }
  // the glove hand carries it (render.js asks B.gloveReach for the hand + elbow)
  const _gr=B.gloveReach;
  B.gloveReach=function(shX,shY){
    const r=_gr?_gr.apply(this,arguments):null;
    if(r||!stow||!on()||stow.t>STOW_FR+6) return r;
    const q=stowPoint(), fd=p.fc?1:-1, gx=shX+fd*12, gy=shY+14;
    const grip={x:q.x-Math.cos(q.ang)*14, y:q.y-Math.sin(q.ang)*14};
    let hx, hy, up=true;
    if(q.grab){ const e=q.gk*q.gk*(3-2*q.gk); hx=gx+(grip.x-gx)*e; hy=gy+(grip.y-gy)*e; up=false; }
    else if(stow.t>=STOW_FR){ const S0=hookAttachWorld(), w=1-(stow.t-STOW_FR)/6; hx=gx+(S0.x-gx)*w; hy=gy+(S0.y-4-gy)*w; }
    else { hx=grip.x; hy=grip.y; }
    const dx=hx-shX, dy=hy-shY, d=Math.hypot(dx,dy)||1, L=Math.max(18,d*0.5+(up?11:4)), hh=Math.sqrt(Math.max(0,L*L-d*d/4));
    const mx=shX+dx/2, my=shY+dy/2, nx=-dy/d, ny=dx/d;
    let e1={x:mx+nx*hh,y:my+ny*hh}, e2={x:mx-nx*hh,y:my-ny*hh};
    if((e1.y<e2.y)!==up){ const t=e1; e1=e2; e2=t; }
    return {hx, hy, ex:e1.x, ey:e1.y-(up?18:0), up};
  };

  // ── foes take MIND's loose jacks and use them ────────────────
  const TAKERS={circle:'A', tri:'B', square:'C', eye:'E'};
  const lost=new Set();
  let holders=[], lastLevel=null, wasShut=false;
  function looseDrop(item,enh,x,y,vx,vy){
    const d={item, enhanced:!!enh, x:x-16, y:y-16, w:32, h:32, got:false, bob:0, _knocked:true, _jackLoose:true,
      _box:{hp:0, broken:true, shake:0, glow:0, item:{x, y, vx, vy, rot:0, vr:(vx>=0?1:-1)*0.3, og:false, noPick:40}}};
    ITEM_DROPS.push(d); lost.add(item);
    return d;
  }
  function giveBackAll(){
    for(const e of holders) if(e._jack!=null){ lost.add(e._jack); e._jack=null; }
    holders=[];
    for(const i of lost) if(ITEM_UNLOCK_BITS[i]) _unlockedMask|=ITEM_UNLOCK_BITS[i];
    lost.clear();
  }
  // a shutdown drops the jack in hand where he went down (never into the pit)
  function shutDrop(){
    const it=ITEM;
    if(it<0||it>3||!_itemUnlocked(it)||B.magPark) return;
    const cx=p.x+SW/2, cy=p.y+FEET_OFF-40;
    if(typeof MV_GRID!=='undefined'&&MV_GRID&&cy>MV_GRID.rows*T-T*2) return;
    if(it===1&&p.hook&&p.hook.st!=='idle'&&typeof _detachPlayerRope==='function') try{ _detachPlayerRope(p.hook); }catch(e){}
    p.xlrOn=false; p.magOn=false; p.laserCharging=false; p.laserCharge=0;
    _unlockedMask&=~ITEM_UNLOCK_BITS[it];
    let next=-1; for(const i of [2,1,0,3]) if(_itemUnlocked(i)){ next=i; break; }
    if(next<0&&_itemUnlocked(4)) next=4;
    ITEM=next;
    looseDrop(it,typeof _itemEnhanced!=='undefined'&&_itemEnhanced[it],cx,cy,(p.fc?-1:1)*2.5,-5);
    S(p,'item_clink');
  }
  function dropRect(d){
    if(d.got) return null;
    if(d._box) return d._jackLoose||d._knocked?(B.crateRect?B.crateRect(d):null):null;   // crate loot stays for MIND
    return d._shared?d:null;                                                             // A+B drop (beta_knife)
  }
  function canTake(e){
    return e&&e.alive&&TAKERS[e._ai]&&!e.mirror&&!e._boss&&!e._betaHeld&&!e._hidden&&e._jack==null&&!e._permOff;
  }
  function takeTick(){
    for(const d of ITEM_DROPS){
      const R=dropRect(d); if(!R) continue;
      for(const e of ENEMS){
        if(!canTake(e)||!ov(e.x,e.y,e.w,e.h,R.x,R.y,R.w,R.h)) continue;
        d.got=true; e._jack=d.item; e._jackEnh=!!d.enhanced; e._jackCd=50; e._jackT=0; lost.add(d.item);
        holders.push(e);
        S(e,'item_clink'); S(e,'enemy_alert');
        for(let k=0;k<10;k++){ const a=Math.random()*Math.PI*2; PFXS.push({x:R.x+R.w/2,y:R.y+R.h/2,vx:Math.cos(a)*2.5,vy:Math.sin(a)*2.5-1,life:14,maxLife:14,r:2,col:ICOLS[d.item]||'#fff'}); }
        if(typeof uiShowToast==='function') uiShowToast('ENEMY '+TAKERS[e._ai]+' TOOK YOUR '+NAMES[d.item]+'!');
        break;
      }
    }
  }
  function sees(x0,y0,x1,y1){
    const d=Math.hypot(x1-x0,y1-y0), n=Math.ceil(d/12);
    for(let i=1;i<n;i++){ const t=i/n; if(solid(x0+(x1-x0)*t,y0+(y1-y0)*t)) return false; }
    return true;
  }
  const hand=e=>{ const c={x:e.x+e.w/2,y:e.y+e.h/2}, m={x:p.x+SW/2,y:p.y+FEET_OFF-50}, dx=m.x-c.x, dy=m.y-c.y, d=Math.hypot(dx,dy)||1;
    const r=Math.max(e.w,e.h)*0.5+6; return {x:c.x+dx/d*r, y:c.y+dy/d*r, ux:dx/d, uy:dy/d, d, m}; };
  function useJack(e){
    e._jackT++; if(e._jackCd>0) e._jackCd--;
    if(_shutdownTimer>0||e._betaHeld||(e._thrownF||0)>0) return;
    const h=hand(e);
    if(h.d>460||!sees(h.x,h.y,h.m.x,h.m.y)) return;
    const it=e._jack;
    if(it===0&&e._jackCd<=0){                                        // TRS: shoots at him
      const sp=7.5;
      ESHOTS.push({x:h.x,y:h.y,vx:h.ux*sp,vy:h.uy*sp,life:999,type:'laser',col:'#5dff8a',bounces:0,power:0.9,born:fr,owner:'enemy',src:e});
      e._jackCd=70+(Math.random()*30|0); S(e,'laser',0.85);
    }else if(it===2&&h.d<200&&e._jackCd<=0){                         // XLR: a gust that blows him away
      p.vx+=h.ux*7; p.vy+=Math.min(0,h.uy*5)-2.5; p.og=false;
      for(let k=0;k<12;k++) PFXS.push({x:h.x,y:h.y,vx:h.ux*(3+Math.random()*4)+(Math.random()-0.5)*2,vy:h.uy*(3+Math.random()*4)+(Math.random()-0.5)*2,life:16,maxLife:16,r:2.5,col:'#c8e8ff'});
      e._jackCd=110; S(e,'xlr_push');
    }else if(it===3&&h.d<260){                                        // MEG: pulls him in, on and off
      const ph=e._jackT%120;
      if(ph<45){ p.vx-=h.ux*0.32; p.vy-=h.uy*0.2; if(e._jackT%4===0) PFXS.push({x:h.m.x-h.ux*10,y:h.m.y-h.uy*10,vx:-h.ux*3,vy:-h.uy*3,life:10,maxLife:10,r:1.6,col:e._jackT%8?'#ff5050':'#5080ff'}); if(ph===0) S(e,'mag'); }
    }else if(it===1&&h.d<300&&e._jackCd<=0){                         // RCA: hooks him and yanks
      p.vx-=h.ux*6; p.vy=Math.min(p.vy,-3); p.og=false; e._jackLine=12;
      e._jackCd=150; S(e,'rope_throw');
    }
    if(e._jackLine>0) e._jackLine--;
  }
  function holdTick(){
    for(let i=holders.length-1;i>=0;i--){
      const e=holders[i];
      if(e._jack==null){ holders.splice(i,1); continue; }
      const gone=ENEMS.indexOf(e)<0;
      if(gone||!e.alive||e._permOff){                                 // shut down: the jack falls out
        const c={x:e.x+e.w/2,y:e.y+e.h/2};
        looseDrop(e._jack,e._jackEnh,c.x,c.y-10,(Math.random()-0.5)*4,-6);
        S(e,'item_clink'); e._jack=null; holders.splice(i,1); continue;
      }
      e._jackX=e.x; e._jackY=e.y;
      useJack(e);
    }
  }
  function drawJacks(){
    if(!holders.length||typeof drawConnectorTip!=='function') return;
    for(const e of holders){
      if(e._jack==null||!e.alive) continue;
      const h=hand(e), a=Math.atan2(h.uy,h.ux);
      if(e._jackLine>0){ ctx.save(); ctx.strokeStyle='#ff8866'; ctx.lineWidth=Math.max(1.5,sw(2)); ctx.beginPath(); ctx.moveTo(sx(h.x),sy(h.y)); ctx.lineTo(sx(h.m.x),sy(h.m.y)); ctx.stroke(); ctx.restore(); }
      try{ drawConnectorTip(sx(h.x),sy(h.y),a,e._jackCd>60&&e._jack===0?1:0,e._jack,e._jackEnh); }catch(er){}
    }
  }
  function jackTick(){
    if(B.level!==lastLevel){ if(lastLevel) giveBackAll(); else { holders=[]; lost.clear(); } lastLevel=B.level; }
    for(const i of [...lost]) if(_itemUnlocked(i)) lost.delete(i);
    const shut=_shutdownTimer>0;
    if(shut&&!wasShut) shutDrop();
    wasShut=shut;
    takeTick(); holdTick();
  }

  // ── wiring ───────────────────────────────────────────────────
  const _up=window.update;
  window.update=function(){
    const r=_up.apply(this,arguments);
    try{ if(on()&&!B.freeze&&!B.loading){ swingTick(); stowTick(); if(typeof ITEM_DROPS!=='undefined') jackTick(); } }catch(er){ console.warn('items',er); }
    return r;
  };
  const _hud=window.drawLdtkLabHud;
  if(typeof _hud==='function') window.drawLdtkLabHud=function(){
    const r=_hud.apply(this,arguments);
    try{ if(B.on){ drawJacks(); drawStow(); } }catch(er){}
    return r;
  };
  window.MV_ITEMS={ state:()=>({stow:stow&&stow.t, holders:holders.map(e=>({ai:e._ai,jack:e._jack})), lost:[...lost], swing:B.magSwing()}),
    RIC, SWING, looseDrop:(it,x,y)=>looseDrop(it,false,x,y,0,-2) };
})();
