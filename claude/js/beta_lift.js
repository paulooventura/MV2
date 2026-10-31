// ============================================================
//  beta_lift.js — Awdjoo 1.3 elevators
//
//  The cars in one shaft are tied: they stop together and travel
//  the same distance. Inside, the level music drops out and the
//  HQ bed plays until the doors are open again.
//  A moving cab still picks you up. A clear run wraps you
//  with it, top to bottom. A ceiling sandwiches you.
//
//  The floor you enter on is Equilibrium. Up is one step
//  toward Ink & Vinyl (the 2nd floor, from the lobby).
//  Down is one step toward Gore. From the lobby, down
//  goes to the 6th floor, because every floor of 1.3 is
//  above the street. Full Ink & Vinyl is 33 ups. Full
//  Gore is 33 downs. One ride is one step, not the whole look.
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B) return;
  const T=32, CAB=4*T-6, SPAN=33;
  // Six stops. The street is the floor level. The other five are above it.
  const LEVELS=[
    {n:1, name:'FLOOR LEVEL', row:64},
    {n:2, name:'2ND FLOOR', row:56},
    {n:3, name:'3RD FLOOR', row:46},
    {n:4, name:'4TH FLOOR', row:36},
    {n:5, name:'5TH FLOOR', row:26},
    {n:6, name:'6TH FLOOR', row:14}
  ];
  const S={
    floors:0, pull:0, inside:false, zoom:0, dir:0,
    stage:null, cab:null, near:false, ask:false, sealed:false, laid:false
  };
  window.MV_LIFT=S;
  const yCache=new Map();

  function live(){ return !!(B.on&&B.stageId==='1.3'&&typeof p!=='undefined'&&p&&typeof _gameState!=='undefined'&&_gameState==='game'&&!(typeof _paused!=='undefined'&&_paused)); }
  function feet(){ return p.y+(typeof FEET_OFF==='number'?FEET_OFF:48); }
  function cx(){ return p.x+(typeof SW==='number'?SW:40)/2; }
  // Keyboard sets Kj for one frame. A pad only holds K (stick and d-pad),
  // so the choice is the rising edge of the same up/down the player already uses.
  function rideChoice(){
    const u=typeof isUp==='function'&&isUp();
    const d=typeof isDn==='function'&&isDn();
    // a quick key tap can go down and up between two frames: the one-frame flag still catches it
    const tu=typeof _bindJ==='function'&&_bindJ('up'), td=typeof _bindJ==='function'&&_bindJ('down');
    const ue=(!!u&&!rideChoice.u)||!!tu, de=(!!d&&!rideChoice.d)||!!td;
    rideChoice.u=!!u; rideChoice.d=!!d;
    if(ue===de) return 0;
    return ue?1:-1;
  }
  function punchEdge(){
    if(typeof _bindJ==='function') return _bindJ('punch');
    return typeof Kj!=='undefined'&&!!Kj['KeyF'];
  }
  function onCab(m){ return !!(m&&B.ridePlat===m); }

  function columns(){
    const map=new Map();
    for(const m of B.platforms||[]){
      if(!m.vert||!m.loop||m.x>=23*T) continue;
      const k=m.x|0;
      if(m._homeDir==null) m._homeDir=m.dir||1;
      if(!map.has(k)) map.set(k,[]);
      map.get(k).push(m);
    }
    return map;
  }
  function surfaceY(colX, row){
    const key=colX+'|'+row;
    if(yCache.has(key)) return yCache.get(key);
    let y=row*T, c=Math.round(colX/T);
    if(typeof gridSolid==='function'){
      let r=row;
      if(gridSolid(c,r)){
        while(r>2&&gridSolid(c,r-1)) r--;
        y=r*T;
      }
    }
    yCache.set(key,y);
    return y;
  }
  function floorIndex(colX, y){
    let best=0, bd=1e9;
    LEVELS.forEach((fl,i)=>{
      const d=Math.abs(surfaceY(colX, fl.row)-y);
      if(d<bd){ bd=d; best=i; }
    });
    return best;
  }
  function destIndex(i, up){
    if(up) return i<LEVELS.length-1?i+1:null;
    if(i<=0) return LEVELS.length-1;
    return i-1;
  }
  function layLedges(){
    if(S.laid||typeof gridSet!=='function'||typeof gridCell!=='function'||typeof MV_GRID_AIR==='undefined'||typeof MV_GRID_ONEWAY==='undefined') return;
    if(typeof MV_GRID==='undefined'||!MV_GRID||!MV_GRID.ready) return;
    const spots=[[8,6],[19,17]];
    for(const fl of LEVELS){
      if(fl.n===1) continue;
      for(const pair of spots){
        for(let k=0;k<2;k++){
          const c=pair[1]+k;
          if(gridCell(c, fl.row)===MV_GRID_AIR) gridSet(c, fl.row, MV_GRID_ONEWAY);
        }
      }
    }
    S.laid=true;
  }
  function resume(m){
    m.phase='run'; m._lift=null; m.destY=null; m.lockY=null; m.locked=false;
    m._used=false; m._called=false; m.doorT=0; m._linkLeft=null; m._flash=0;
    if(m._homeDir!=null) m.dir=m._homeDir;
  }
  function nearestButton(){
    const x=cx(), y=feet()-48;
    let best=null, bd=70;
    for(const b of pads()){
      const d=Math.hypot(x-b.x,y-b.by);
      if(d<b.r+48&&d<bd){ bd=d; best=b; }
    }
    return best;
  }
  function pads(){
    const out=[];
    for(const [col,cabs] of columns()){
      for(const fl of LEVELS){
        const sy=surfaceY(col, fl.row);
        const by=sy-58;
        let bx=col-36;
        if(typeof gridWorldSolid==='function'){
          for(let i=0;i<8;i++){
            const x=col-20-i*8;
            if(!gridWorldSolid(x,by)){ bx=x; break; }
          }
        }
        out.push({col, fl, y:sy, cabs, x:bx, by, r:16});
      }
    }
    return out;
  }
  function tone(a,t,f0,f1,peak,dur,type){
    const o=a.createOscillator(), g=a.createGain();
    o.type=type||'sine';
    o.frequency.setValueAtTime(f0,t);
    if(f1) o.frequency.exponentialRampToValueAtTime(Math.max(40,f1),t+dur*0.7);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(peak,t+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t+dur+0.02);
  }
  function pressSfx(){
    S.press=16;
    S._bell=(typeof fr==='number'?fr:0)+12;
    try{
      const a=typeof ga==='function'?ga():null; if(!a){ sfx('land'); return; }
      const t=a.currentTime;
      tone(a,t,180,70,0.16,0.09,'triangle');
      tone(a,t+0.04,659,659,0.16,0.22,'sine');
      tone(a,t+0.16,880,880,0.12,0.28,'sine');
    }catch(e){}
  }
  function arriveChime(){
    if((S._arriveBell||0)>(typeof fr==='number'?fr:0)) return;
    S._arriveBell=(typeof fr==='number'?fr:0)+24;
    S.arrive=28;
    try{
      const a=typeof ga==='function'?ga():null; if(!a){ sfx('land'); return; }
      const t=a.currentTime;
      tone(a,t,90,48,0.2,0.16,'triangle');
      tone(a,t+0.08,523,523,0.18,0.34,'sine');
      tone(a,t+0.26,784,784,0.16,0.46,'sine');
    }catch(e){}
  }
  function travelSfx(){
    try{
      const a=typeof ga==='function'?ga():null; if(!a) return;
      const t=a.currentTime;
      tone(a,t,70,140,0.1,0.35,'sawtooth');
    }catch(e){}
  }
  function closestCab(cabs, y){
    let best=null, bd=1e9;
    for(const m of cabs){
      if(m.phase&&m.phase!=='run') continue;
      const d=Math.abs(m.y-y);
      if(d<bd){ bd=d; best=m; }
    }
    if(best) return best;
    for(const m of cabs){
      const d=Math.abs(m.y-y);
      if(d<bd){ bd=d; best=m; }
    }
    return best;
  }
  function columnOf(m){
    for(const [,cabs] of columns()) if(cabs.indexOf(m)>=0) return cabs;
    return m?[m]:[];
  }
  function shiftColumn(cabs, delta, phase){
    for(const c of cabs){
      if(c._homeDir==null) c._homeDir=c.dir||1;
      c._linkLeft=delta; c._lift='go'; c.phase=phase; c.doorT=0; c._arrive=false;
    }
  }
  function resumeColumn(m){
    for(const c of columnOf(m)) resume(c);
  }
  function holdCab(m, open){
    m._linkLeft=0; m._lift='hold'; m.lockY=m.y; m.destY=m.y;
    if(open){
      m.phase='open'; m.doorT=0; m._arrive=true; m._flash=26;
      arriveChime();
    }else{
      m.phase='park'; m._arrive=false;
    }
  }
  function callCab(btn){
    const m=closestCab(btn.cabs, btn.y);
    if(!m) return;
    let y=btn.y;
    const fy=feet();
    if(Math.abs(fy-btn.y)<56) y=fy;
    y=Math.max(m.ya+4, Math.min(m.yb-4, y));
    const delta=y-m.y;
    for(const c of btn.cabs) c._called=c===m;
    shiftColumn(btn.cabs, delta, 'summon');
    pressSfx();
  }
  function go(m, up){
    const i=floorIndex(m.x, m.y);
    const n=destIndex(i, up);
    if(n==null) return;
    const fl=LEVELS[n];
    const delta=surfaceY(m.x, fl.row)-m.y;
    shiftColumn(columnOf(m), delta, 'go');
    for(const c of columnOf(m)) c._used=true;
    S.ask=false; S.dir=up?1:-1; S.vibe=(S.vibe||0)+(up?1:-1);
    S.vibe=Math.max(-SPAN, Math.min(SPAN, S.vibe));
    travelSfx();
  }
  function aboard(m){
    if(onCab(m)) return true;
    if(!m||!p) return false;
    const x=cx();
    if(x<m.x-10||x>m.x+m.w+10) return false;
    return Math.abs(feet()-m.y)<16;
  }

  S.afterPlatforms=function(){
    const ch=rideChoice();
    if(!B.platforms) return;
    const id=B.stageId;
    if(id!==S.stage){
      S.stage=id; S.vibe=0; S.floors=0; S.pull=0; S.dir=0; S.zoom=0;
      S.cab=null; S.inside=false; S.ask=false; S.sealed=false; S.laid=false; S.near=false;
      yCache.clear();
      for(const m of B.platforms){ m.phase=null; m._lift=null; m.door=0; m._used=false; }
    }
    if(!live()){
      S.inside=false; S.cab=null; S.near=false; S.ask=false; S.sealed=false;
      S.pull+=(0-S.pull)*0.08; S.zoom+=(0-S.zoom)*0.08; S.dir+=(0-S.dir)*0.08;
      try{ if(window.MV_BETA_AUDIO&&MV_BETA_AUDIO.liftMix) MV_BETA_AUDIO.liftMix(); }catch(e){}
      return;
    }
    layLedges();
    let sealed=null, hold=null, tookPunch=false;
    for(const [,cabs] of columns()){
      for(const m of cabs){
        const tgt=(m.phase==='shut'||m.phase==='go')?1:0;
        m.door=(m.door||0)+(tgt-(m.door||0))*(m.phase==='open'?0.08:0.16);
        if(m._flash>0) m._flash--;
        if(m.phase==='summon'||m.phase==='go'){
          m._lift='go';
          if(m._linkLeft!=null&&Math.abs(m._linkLeft)<0.4){
            if(m.phase==='go'&&aboard(m)) holdCab(m,true);
            else if(m.phase==='summon'&&m._called) holdCab(m,true);
            else holdCab(m,false);
          }else if(m.phase==='go'&&aboard(m)) sealed=m;
        }else if(m.phase==='park'){
          m._lift='hold'; m.lockY=m.y;
        }else if(m.phase==='open'){
          m._lift='hold'; m.lockY=m.y;
          const opening=(m.door||0)>0.1;
          if(aboard(m)){
            if(opening&&m._used) sealed=m;
            if(m._called){
              m._called=false; m.phase='shut'; m._arrive=false; m._used=true; S.ask=true;
            }else if(!opening){
              hold=m;
              if(punchEdge()){ m.phase='shut'; m._arrive=false; m._used=true; S.ask=true; tookPunch=true; pressSfx(); }
            }
          }else if(m._called){
            if(Math.abs(cx()-(m.x+m.w/2))>220) resumeColumn(m);
          }else resumeColumn(m);
        }else if(m.phase==='shut'){
          m._lift='hold'; m.lockY=m.y; m._used=true;
          if(aboard(m)) sealed=m;
          else resumeColumn(m);
        }else if(m._lift){
          resumeColumn(m);
        }
      }
    }
    S.cab=sealed; S.sealed=!!sealed; S.inside=!!sealed; S.hold=hold;
    if(sealed){
      const left=sealed.x+6, right=sealed.x+sealed.w-6-(typeof SW==='number'?SW:40);
      // against a cab wall, the push doesn't build speed (or he shoots out when the doors open)
      if(p.x<left){ p.x=left; if(p.vx<0) p.vx=0; }
      if(p.x>right){ p.x=right; if(p.vx>0) p.vx=0; }
      p.y=sealed.y-(typeof FEET_OFF==='number'?FEET_OFF:48);
      p.vy=0; p.og=true;
      S.near=false;
    }else if(!tookPunch){
      S.ask=false;
      const btn=nearestButton();
      S.near=!!btn;
      if(btn&&punchEdge()) callCab(btn);
    }else S.near=false;
    if((S.press||0)>0) S.press--;
    const car=sealed||hold;
    const doorsReady=!car||car.phase==='shut'||(car.phase==='open'&&(car.door||0)<0.15);
    if(car&&doorsReady&&ch){
      car._arrive=false;
      S.ask=true;
      go(car, ch>0);
    }
    S.floors=S.vibe||0;
    const tgt=Math.max(-1,Math.min(1,S.floors/SPAN));
    S.pull+=(tgt-S.pull)*0.04;
    const zT=S.sealed?1:0;
    S.zoom+=(zT-S.zoom)*(S.sealed?0.1:0.06);
    if(!S.sealed) S.dir+=(0-S.dir)*0.06;
    try{ if(window.MV_BETA_AUDIO&&MV_BETA_AUDIO.liftMix) MV_BETA_AUDIO.liftMix(); }catch(e){}
  };

  S.fist=function(wx,wy,wr){
    if(!live()||(S._bell||0)>(typeof fr==='number'?fr:0)) return false;
    const m=S.cab||S.hold;
    if(m){
      const bx=m.x+m.w*0.5, by=m.y-CAB+18;
      if(Math.hypot(wx-bx,wy-by)<=(wr||12)+16){
        pressSfx();
        if(m.phase==='open'){ m.phase='shut'; m._arrive=false; m._used=true; S.ask=true; }
        return true;
      }
      return false;
    }
    for(const b of pads()){
      if(Math.hypot(wx-b.x,wy-b.by)<=(wr||12)+b.r){ callCab(b); return true; }
    }
    return false;
  };

  function drawPad(x,y,lit){
    const frn=typeof fr==='number'?fr:0;
    const press=Math.max(0,S.press||0)/16;
    const sink=press>0.45?(1-(press-0.45)/0.55):press/0.45;
    const breathe=0.55+0.45*Math.sin(frn*0.12);
    const arrive=Math.max(0,(S.arrive||0)/28);
    const hot=lit||arrive>0.02;
    const px=sx(x), py=sy(y+sink*5);
    ctx.save();
    ctx.fillStyle='#1a1614';
    ctx.fillRect(sx(x)-sw(16),sy(y)-sw(20),sw(32),sw(40));
    ctx.strokeStyle=hot?'#ffd27a':'#6a5a48';
    ctx.lineWidth=Math.max(1,sw(2));
    ctx.strokeRect(sx(x)-sw(16),sy(y)-sw(20),sw(32),sw(40));
    ctx.fillStyle='#3a322c';
    ctx.beginPath(); ctx.arc(px,py,sw(13),0,Math.PI*2); ctx.fill();
    ctx.fillStyle=hot?('#ffb43a'):('#c9842a');
    ctx.globalAlpha=0.85+0.15*breathe;
    ctx.beginPath(); ctx.arc(px,py,sw(9-sink*2),0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    ctx.fillStyle='rgba(255,246,210,'+(0.35+0.4*breathe*(hot?1:0.4))+')';
    ctx.beginPath(); ctx.arc(px-sw(2.5),py-sw(3),sw(3),0,Math.PI*2); ctx.fill();
    if(hot||press>0){
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle='rgba(255,190,80,'+(0.18+0.35*Math.max(press,arrive,breathe*0.4))+')';
      ctx.beginPath(); ctx.arc(sx(x),sy(y),sw(22+10*Math.max(press,arrive)),0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
  function drawStops(){
    if(!live()||typeof sx!=='function') return;
    for(const b of pads()){
      if(b.fl.n!==1){
        ctx.fillStyle='#6a6258';
        ctx.fillRect(sx(b.col-T*2),sy(b.y),sw(T*2),sw(8));
        ctx.fillStyle='#c8b49a';
        ctx.fillRect(sx(b.col-T*2),sy(b.y),sw(T*2),sw(3));
      }
      const here=b.cabs.some(m=>m._called&&(m.phase==='open'||m.phase==='summon')&&Math.abs(m.y-b.y)<28);
      drawPad(b.x,b.by,here);
    }
    const shown=S.cab||S.hold;
    if(shown) drawPad(shown.x+shown.w/2, shown.y-CAB+18, true);
    if((S.arrive||0)>0){
      S.arrive--;
      const k=S.arrive/28;
      for(const [,cabs] of columns()) for(const m of cabs) if((m._flash||0)>0){
        ctx.save(); ctx.globalCompositeOperation='lighter';
        ctx.strokeStyle='rgba(255,220,150,'+(0.65*k)+')'; ctx.lineWidth=Math.max(2,sw(3));
        ctx.strokeRect(sx(m.x)-sw(4),sy(m.y-(4*T-6))-sw(4),sw(m.w+8),sw(4*T-6+8));
        ctx.restore();
      }
    }
  }
  function hookStops(){
    const prev=B.drawWorldExtras;
    if(typeof prev!=='function'){ setTimeout(hookStops,40); return; }
    if(prev._liftStops) return;
    const wrapped=function(){
      const r=prev.apply(this,arguments);
      try{ drawStops(); }catch(e){}
      return r;
    };
    wrapped._liftStops=true;
    B.drawWorldExtras=wrapped;
  }
  hookStops();

  const buf=document.createElement('canvas'), bg=buf.getContext('2d');
  function screenCab(m){
    const z=(typeof camZoom==='number'&&camZoom)||1;
    return {x:sx(m.x)*z, y:sy(m.y-CAB)*z, w:Math.max(12,sw(m.w)*z), h:Math.max(12,sw(CAB)*z)};
  }
  function veil(){
    if(!S.sealed||!S.cab||typeof ctx==='undefined'||typeof sx!=='function') return;
    const cv=ctx.canvas;
    if(buf.width!==cv.width||buf.height!==cv.height){ buf.width=cv.width; buf.height=cv.height; }
    bg.drawImage(cv,0,0);
    const cab=screenCab(S.cab);
    const blur=4+3*Math.min(1,S.zoom||0);
    ctx.save();
    try{ ctx.filter='blur('+blur.toFixed(1)+'px)'; }catch(e){}
    ctx.drawImage(buf,0,0);
    ctx.filter='none';
    ctx.fillStyle='rgba(4,2,8,0.62)';
    ctx.fillRect(0,0,cv.width,cv.height);
    const pad=6;
    const x=Math.max(0,cab.x-pad), y=Math.max(0,cab.y-pad);
    const w=Math.min(cv.width-x,cab.w+pad*2), h=Math.min(cv.height-y,cab.h+pad*2);
    if(w>2&&h>2) ctx.drawImage(buf,x,y,w,h,x,y,w,h);
    ctx.restore();
  }
  function prompt(){
    if(typeof drawTextC!=='function'||typeof W!=='number') return;
    if(S.sealed&&S.cab){
      const fl=LEVELS[floorIndex(S.cab.x, S.cab.y)];
      drawTextC(fl?fl.name:'',W/2,64,'#f4efe6',2);
      if(S.cab.phase!=='go'){
        drawTextC('UP',W/2,96,'#f4efe6',2);
        drawTextC('DOWN',W/2,124,'#ffb0a8',2);
      }
    }else if(S.hold){
      const fl=LEVELS[floorIndex(S.hold.x, S.hold.y)];
      drawTextC(fl?fl.name:'',W/2,64,'#f4efe6',2);
      drawTextC('UP',W/2,96,'#f4efe6',2);
      drawTextC('DOWN',W/2,124,'#ffb0a8',2);
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
