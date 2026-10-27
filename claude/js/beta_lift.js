// ============================================================
//  beta_lift.js — Awdjoo 1.3 elevators
//
//  The floor you enter 1.3 on is Equilibrium. Walk into a cab,
//  or punch the button beside the shaft, and it locks as a
//  closed chamber: back and ceiling shut, the outside blurs
//  and dims, and the view eases toward the way you chose.
//  Up pulls the whole game toward Ink & Vinyl. Down pulls it
//  toward Gore. Every later ride moves you further from that
//  first floor, or back toward it.
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B) return;
  const T=32, CAB=4*T-6;
  const S={
    floors:0, pull:0, inside:false, zoom:0, dir:0,
    eqY:null, stage:null, cab:null, near:false
  };
  window.MV_LIFT=S;

  function live(){ return !!(B.on&&B.stageId==='1.3'&&typeof p!=='undefined'&&p&&typeof _gameState!=='undefined'&&_gameState==='game'&&!(typeof _paused!=='undefined'&&_paused)); }
  function feet(){ return p.y+(typeof FEET_OFF==='number'?FEET_OFF:48); }
  function cx(){ return p.x+(typeof SW==='number'?SW:40)/2; }

  function landings(m){
    if(m._lands) return m._lands;
    if(typeof gridSolid!=='function'||typeof MV_GRID==='undefined'||!MV_GRID||!MV_GRID.tile) return [];
    const t=MV_GRID.tile, c0=Math.floor(m.x/t), cw=Math.max(1,Math.round(m.w/t));
    const ys=[];
    for(let r=2;r<MV_GRID.rows-1;r++){
      if(gridSolid(c0,r-1)||gridSolid(Math.min(MV_GRID.cols-1,c0+cw-1),r-1)) continue;
      const left=c0>0&&gridSolid(c0-1,r)&&!gridSolid(c0-1,r-1);
      const right=c0+cw<MV_GRID.cols&&gridSolid(c0+cw,r)&&!gridSolid(c0+cw,r-1);
      if(left||right) ys.push(r*t);
    }
    if(S.eqY!=null){
      let near=false;
      for(const y of ys) if(Math.abs(y-S.eqY)<T*1.5) near=true;
      if(!near) ys.push(S.eqY);
    }
    ys.sort((a,b)=>a-b);
    m._lands=ys;
    return ys;
  }
  function nextStop(m, up){
    const ys=landings(m), y=m.y;
    let best=null;
    if(up){ for(const q of ys) if(q<y-T*0.6&&(best==null||q>best)) best=q; }
    else { for(const q of ys) if(q>y+T*0.6&&(best==null||q<best)) best=q; }
    if(best!=null) return best;
    const step=T*4, raw=y+(up?-step:step);
    const lo=Math.min(m.ya,m.yb)+8, hi=Math.max(m.ya,m.yb)-8;
    const c=Math.max(lo,Math.min(hi,raw));
    return Math.abs(c-y)<T?null:c;
  }
  function floorIndex(m){
    if(S.eqY==null) return 0;
    return Math.round((S.eqY-m.y)/(T*3));
  }
  function holdColumn(cab){
    for(const q of B.platforms) if(q.vert&&q!==cab&&Math.abs(q.x-cab.x)<4) q.hold=true;
  }
  function carry(m,y){
    const list=[p];
    if(typeof p2!=='undefined'&&p2) list.push(p2);
    for(const a of list){
      if(!a) continue;
      const ax=a.x+(typeof SW==='number'?SW:40)/2;
      if(ax<m.x-10||ax>m.x+m.w+10) continue;
      a.y=y-(typeof FEET_OFF==='number'?FEET_OFF:48);
      a.vy=0; a.og=true;
    }
  }
  function ridingCab(){
    const m=B.ridePlat;
    if(!m||!m.vert||m.hidden) return null;
    const x=cx();
    if(x<m.x-6||x>m.x+m.w+6) return null;
    return m;
  }
  function nearestShaft(){
    let best=null, bd=1e9;
    const x=cx();
    const seen=new Set();
    for(const m of B.platforms){
      if(!m.vert) continue;
      const k=m.x|0; if(seen.has(k)) continue; seen.add(k);
      const d=Math.abs(x-(m.x+m.w/2));
      if(d<bd){ bd=d; best=m; }
    }
    return best&&bd<110?best:null;
  }
  function callCab(col){
    const f=feet();
    let best=null, bd=1e9;
    for(const m of B.platforms){
      if(!m.vert||m.hidden||Math.abs(m.x-col.x)>4) continue;
      const d=Math.abs(m.y-f);
      if(d<bd){ bd=d; best=m; }
    }
    if(!best) return;
    for(const m of B.platforms) if(m.vert&&Math.abs(m.x-col.x)<4){ m.hold=true; if(m!==best){ m.locked=false; m.lockY=null; } }
    best.hold=false; best.locked=true; best.lockY=f; best.y=f; best.called=240; best.dy=0;
    try{ sfx('land'); }catch(e){}
  }
  function choose(m, up){
    const dest=nextStop(m, up);
    if(dest==null) return;
    m.y=dest; m.lockY=dest; m.locked=true; m.called=0; m.dy=0;
    carry(m, dest);
    S.dir=up?1:-1;
    S.zoom=Math.max(S.zoom,0.15);
    S.floors=floorIndex(m);
    try{ sfx(up?'jump':'land'); }catch(e){}
    try{ if(window.MV_BETA_AUDIO&&MV_BETA_AUDIO.recure) MV_BETA_AUDIO.recure(); }catch(e){}
  }
  function upEdge(){ return typeof Kj!=='undefined'&&(Kj['ArrowUp']||Kj['KeyW']); }
  function downEdge(){ return typeof Kj!=='undefined'&&(Kj['ArrowDown']||Kj['KeyS']); }
  function punchEdge(){
    if(typeof _bindJ==='function') return _bindJ('punch');
    return typeof Kj!=='undefined'&&!!Kj['KeyF'];
  }

  S.afterPlatforms=function(){
    if(!B.platforms) return;
    for(const m of B.platforms) m.hold=false;
    const id=B.stageId;
    if(id!==S.stage){ S.stage=id; S.eqY=null; S.floors=0; S.pull=0; S.dir=0; S.zoom=0; S.cab=null; S.inside=false; }
    if(!live()){
      S.inside=false; S.cab=null; S.near=false;
      S.pull+=(0-S.pull)*0.08; S.zoom+=(0-S.zoom)*0.08; S.dir+=(0-S.dir)*0.08;
      return;
    }
    if(S.eqY==null) S.eqY=feet();
    const cab=ridingCab();
    if(cab){
      S.cab=cab; S.inside=true; S.near=false;
      cab.locked=true; cab.lockY=cab.y; cab.called=0;
      holdColumn(cab);
      S.floors=floorIndex(cab);
      if(upEdge()) choose(cab,true);
      else if(downEdge()) choose(cab,false);
    }else{
      S.cab=null; S.inside=false;
      const shaft=nearestShaft();
      S.near=!!shaft;
      if(shaft&&punchEdge()) callCab(shaft);
      for(const m of B.platforms){
        if(!m.vert) continue;
        if(m.called>0){ m.called--; if(m.called<=0){ m.locked=false; m.lockY=null; } }
        else if(m.locked){ m.locked=false; m.lockY=null; }
      }
      for(const m of B.platforms) if(m.vert&&m.locked) holdColumn(m);
    }
    const tgt=Math.max(-1,Math.min(1,S.floors/5));
    S.pull+=(tgt-S.pull)*0.04;
    const zT=S.inside?(Math.abs(S.dir)>0.2?1:0.45):0;
    S.zoom+=(zT-S.zoom)*0.05;
    if(!S.inside) S.dir+=(0-S.dir)*0.06;
    try{ if(window.MV_BETA_AUDIO&&MV_BETA_AUDIO.recure) MV_BETA_AUDIO.recure(); }catch(e){}
  };

  const buf=document.createElement('canvas'), bg=buf.getContext('2d');
  function screenCab(m){
    const z=(typeof camZoom==='number'&&camZoom)||1;
    return {x:sx(m.x)*z, y:sy(m.y-CAB)*z, w:Math.max(12,sw(m.w)*z), h:Math.max(12,sw(CAB)*z)};
  }
  function veil(){
    if(!S.inside||!S.cab||typeof ctx==='undefined'||typeof sx!=='function') return;
    const cv=ctx.canvas;
    if(buf.width!==cv.width||buf.height!==cv.height){ buf.width=cv.width; buf.height=cv.height; }
    bg.drawImage(cv,0,0);
    const cab=screenCab(S.cab);
    const blur=5+4*Math.min(1,S.zoom||0);
    ctx.save();
    try{ ctx.filter='blur('+blur.toFixed(1)+'px)'; }catch(e){}
    ctx.drawImage(buf,0,0);
    ctx.filter='none';
    ctx.fillStyle='rgba(4,2,8,0.58)';
    ctx.fillRect(0,0,cv.width,cv.height);
    const pad=6;
    const x=Math.max(0,cab.x-pad), y=Math.max(0,cab.y-pad);
    const w=Math.min(cv.width-x,cab.w+pad*2), h=Math.min(cv.height-y,cab.h+pad*2);
    if(w>2&&h>2) ctx.drawImage(buf,x,y,w,h,x,y,w,h);
    ctx.restore();
  }
  function prompt(){
    if(typeof drawTextC!=='function'||typeof W!=='number') return;
    if(S.inside){
      const n=S.floors|0;
      const line=n===0?'EQUILIBRIUM':(n>0?n+' ABOVE EQUILIBRIUM':(-n)+' BELOW EQUILIBRIUM');
      drawTextC(line,W/2,64,n<0?'#ffc0b8':'#f4efe6',2);
      drawTextC('UP   ·   INK & VINYL',W/2,96,'#f4efe6',2);
      drawTextC('DOWN   ·   GORE',W/2,124,'#ffb0a8',2);
    }else if(S.near){
      const y=typeof uiActLabel==='function'?uiActLabel('punch'):'Y';
      drawTextC(y+'   CALL THE CAR',W/2,64,'#f4efe6',2);
    }
  }
  function hookHud(){
    const prev=window.drawHUD;
    if(typeof prev!=='function'){ setTimeout(hookHud,40); return; }
    if(prev._mvLift) return;
    const wrapped=function(){
      try{ veil(); }catch(e){}
      const r=prev.apply(this,arguments);
      try{ prompt(); }catch(e){}
      return r;
    };
    wrapped._mvLift=true;
    window.drawHUD=wrapped;
  }
  hookHud();
})();
