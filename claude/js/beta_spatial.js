// ============================================================
//  beta_spatial.js — hear the world from MIND's spot (Paulo, Oct 22:
//  "sounds farther away should sound far… walls, floors and everything
//  with mass should affect the soundscape… from the character's perspective")
//
//  The listener is MIND. Every sound that knows where it comes from
//  (sfxAt / MV_SPATIAL_from, see audio.js) goes through its own little chain:
//   - distance: quieter and duller the farther it is, gone past ~40 tiles;
//   - walls: the line from the sound to MIND is walked through the collision
//     grid — every tile of rock / brick / cube in the way muffles it (low-pass)
//     and lowers it, the way sound comes through a wall;
//   - side: panned left / right by where it is on screen;
//   - the room: more of it goes to the room echo the farther it is.
//  The room itself is measured around MIND (rays through the grid, every few
//  frames): how enclosed he is, how big the space is, how much open sky is
//  above him, how high up he is. That drives a room reverb + slapback echo on
//  all game sounds (a cave rings, a street is dry) and is shared with the
//  ambience (wind lives in high, open places; the cave drone in enclosed ones).
// ============================================================
(function(){
  'use strict';
  const T=32, MAXR=14;                                      // ray length in tiles
  const env={open:1, sky:1, size:MAXR, encl:0, elev:0.5, floor:0, wind:0.5, under:0, t:-99};
  function solid(x,y){
    try{ if(typeof gridWorldSolid==='function') return !!gridWorldSolid(x,y); }catch(e){}
    const B=window.MV_BETA, lv=B&&B.level; if(!lv) return false;
    const c=Math.floor(x/T), r=Math.floor(y/T); if(r<0||c<0||r>=lv.rows||c>=lv.cols) return r>=0;
    return !!lv.cells[r][c];
  }
  function listener(){ return (typeof p!=='undefined'&&p)?{x:p.x+SW/2, y:p.y+FEET_OFF-34}:{x:0,y:0}; }
  function ray(x,y,dx,dy,max){ const st=12; for(let d=st;d<=max;d+=st){ if(solid(x+dx*d,y+dy*d)) return d; } return max; }
  // tiles of solid matter on the straight line between two points
  function occlusion(x0,y0,x1,y1){
    const dx=x1-x0, dy=y1-y0, L=Math.hypot(dx,dy); if(L<20) return 0;
    const n=Math.min(160,Math.ceil(L/12)); let k=0;
    for(let i=1;i<n;i++){ if(solid(x0+dx*i/n,y0+dy*i/n)) k++; }
    return k*(L/n)/T;
  }
  function measure(){
    const B=window.MV_BETA; if(!B||!B.on||typeof p==='undefined'||!p) return;
    const L=listener(), max=MAXR*T; let sum=0, skyS=0, skyN=0;
    for(let i=0;i<16;i++){
      const a=i/16*Math.PI*2, dx=Math.cos(a), dy=Math.sin(a), d=ray(L.x,L.y,dx,dy,max);
      sum+=d; if(dy<-0.3){ skyS+=d; skyN++; }
    }
    const up=ray(L.x,L.y,0,-1,30*T), floor=ray(L.x,L.y+20,0,1,30*T);
    const open=sum/16/max, sky=Math.min(1,(skyS/skyN/max)*0.6+(up/(30*T))*0.4);
    const hz=B.horizonRow!=null?B.horizonRow:(B.sky||0)+13, row=L.y/T;
    const elev=Math.max(0,Math.min(1,(hz+2-row)/14*0.7+Math.min(1,floor/(10*T))*0.5));
    const k=0.35;                                          // ease so it doesn't jump between frames
    env.open+=(open-env.open)*k; env.sky+=(sky-env.sky)*k; env.size+=(sum/16/T-env.size)*k;
    env.encl=1-env.open; env.elev+=(elev-env.elev)*k; env.floor=floor/T;
    env.under=Math.max(0,Math.min(1,(row-hz-1)/4))*(1-env.sky);
    // wind forms where the air is high and open
    env.wind=Math.max(0,Math.min(1,env.sky*(0.12+0.88*Math.min(1,Math.pow(env.elev,1.5)*1.25+Math.max(0,env.open-0.5)*0.6))));
  }

  // ── audio graph ──
  let A=null, G=null;
  function graph(a){
    if(A===a&&G) return G; A=a;
    const posh=window.MV_SFX_POSH&&MV_SFX_POSH.bus?MV_SFX_POSH.bus(a):null;
    const main=a.createGain(); main.gain.value=1; main.connect(posh?posh.out:a.destination);
    // the room: a reverb + a slapback echo whose time follows the room's size
    const conv=a.createConvolver(), len=Math.round(a.sampleRate*1.8), ir=a.createBuffer(2,len,a.sampleRate);
    for(let c=0;c<2;c++){ const d=ir.getChannelData(c); for(let i=0;i<len;i++){ const t=i/len; d[i]=(Math.random()*2-1)*Math.pow(1-t,2.8)*(i<a.sampleRate*0.008?0:1); } }
    conv.buffer=ir;
    const roomIn=a.createGain(); roomIn.gain.value=0; const roomLP=a.createBiquadFilter(); roomLP.type='lowpass'; roomLP.frequency.value=3800;
    roomIn.connect(conv); conv.connect(roomLP); roomLP.connect(main);
    const echoIn=a.createGain(); echoIn.gain.value=0; const dl=a.createDelay(1); dl.delayTime.value=0.12; const fb=a.createGain(); fb.gain.value=0.25;
    const eLP=a.createBiquadFilter(); eLP.type='lowpass'; eLP.frequency.value=2200;
    echoIn.connect(dl); dl.connect(eLP); eLP.connect(fb); fb.connect(dl); eLP.connect(main);
    // MIND's own sounds: straight to the bus, plus the room
    const self=a.createGain(); self.gain.value=1; self.connect(main);
    const selfRoom=a.createGain(); selfRoom.gain.value=0; self.connect(selfRoom); selfRoom.connect(roomIn); selfRoom.connect(echoIn);
    G={main, roomIn, echoIn, dl, fb, self, selfRoom, posh};
    return G;
  }
  // keep the room in step with where MIND is
  function roomTick(){
    if(!A||!G) return;
    const t=A.currentTime, e=env, set=(pr,v)=>{ try{ pr.setTargetAtTime(v,t,0.2); }catch(_){} };
    set(G.roomIn.gain, 0.25+e.encl*0.9);
    set(G.echoIn.gain, Math.max(0,(e.encl-0.35))*0.55);
    set(G.dl.delayTime, Math.max(0.05,Math.min(0.28,e.size*0.022)));
    set(G.fb.gain, 0.15+e.encl*0.25);
    set(G.selfRoom.gain, e.encl*0.32);
  }
  // how a sound at (x,y) reaches MIND
  function params(x,y){
    const L=listener(), dx=x-L.x, dy=y-L.y, d=Math.hypot(dx,dy)/T;
    if(d>40) return null;
    let g=1/(1+Math.pow(d/7,1.6)), lp=Math.max(700,17000/Math.pow(1+d/9,1.3));
    const ot=occlusion(L.x,L.y,x,y);
    if(ot>0){ g*=Math.max(0.05,Math.pow(0.55,ot)); lp=Math.max(160,lp*Math.pow(0.32,ot)); }
    const pan=Math.max(-0.9,Math.min(0.9,dx/(10*T)))*(ot>0?0.6:1);
    const wet=Math.min(1,0.08+env.encl*0.35+d/28+ot*0.12);
    return {g, lp, pan, wet, d, ot};
  }
  // a fresh chain for one positioned sound; returns its input node
  function chainAt(a,x,y,opt){
    const P=params(x,y); if(!P||P.g<0.012) return null;
    const g0=graph(a), dest=(opt&&opt.dest)||g0.main;
    const inp=a.createGain(); inp.gain.value=P.g*((opt&&opt.gain)||1);
    const lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=P.lp; lp.Q.value=0.5;
    const pan=a.createStereoPanner(); pan.pan.value=P.pan;
    inp.connect(lp); lp.connect(pan); pan.connect(dest);
    const w=a.createGain(); w.gain.value=P.wet; lp.connect(w); w.connect(g0.roomIn);
    if(P.d>6){ const w2=a.createGain(); w2.gain.value=Math.min(0.5,P.d/40); lp.connect(w2); w2.connect(g0.echoIn); }
    inp._p=P; return inp;
  }
  function pending(){
    const s=window._sfxPos; window._sfxPos=null;
    if(!s) return null; if(typeof fr==='number'&&Math.abs(fr-(s.fr||0))>2) return null;
    return s;
  }
  // for beta_audio.js one-shots: a positioned output, false = too far (skip), null = MIND's own
  function take(a){
    const s=pending(); const g0=graph(a);
    if(!s) return g0.self;
    const n=chainAt(a,s.x,s.y,{dest:a.destination===g0.main?g0.main:g0.main});
    return n||false;
  }
  // every posh sfx goes through here
  const inner=window.sfx;
  if(typeof inner==='function'){
    window.sfx=function(t){
      const a=(typeof _audioUnlocked!=='undefined'&&_audioUnlocked&&typeof ga==='function')?ga():null;
      const B=window.MV_BETA;
      if(!a||!B||!B.on||!window.MV_SFX_POSH){ window._sfxPos=null; return inner.apply(this,arguments); }
      const s=pending(), g0=graph(a);
      let route;
      if(s){ const n=chainAt(a,s.x,s.y); if(!n) return; route={out:n, send:n}; }
      else route={out:g0.self, send:g0.posh?g0.posh.send:g0.self};
      window.MV_SFX_ROUTE=route;
      try{ return inner.apply(this,arguments); } finally{ window.MV_SFX_ROUTE=null; }
    };
  }

  // ── logical sounds the world makes on its own: enemies moving ──
  let nb=null;
  function noiseBuf(a){ if(nb&&nb.sampleRate===a.sampleRate) return nb; nb=a.createBuffer(1,a.sampleRate*0.5,a.sampleRate); const d=nb.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; return nb; }
  const sv=()=>{ try{ return Math.max(0,Math.min(1,OPT.sfxVol!=null?OPT.sfxVol:1)); }catch(e){ return 1; } };
  function step(a,x,y,heavy,roll){
    const n=chainAt(a,x,y,{gain:sv()}); if(!n) return;
    const t=a.currentTime, src=a.createBufferSource(); src.buffer=noiseBuf(a);
    const f=a.createBiquadFilter(); f.type=roll?'bandpass':'lowpass'; f.frequency.value=roll?240:(heavy?420:900); f.Q.value=roll?2:0.7;
    const g=a.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime((heavy?0.22:0.12),t+0.006); g.gain.exponentialRampToValueAtTime(0.0001,t+(roll?0.14:0.07));
    src.connect(f); f.connect(g); g.connect(n); src.start(t,Math.random()*0.3); src.stop(t+0.16);
    if(heavy){ const o=a.createOscillator(), og=a.createGain(); o.frequency.setValueAtTime(80,t); o.frequency.exponentialRampToValueAtTime(45,t+0.1); og.gain.setValueAtTime(0.18,t); og.gain.exponentialRampToValueAtTime(0.0001,t+0.12); o.connect(og); og.connect(n); o.start(t); o.stop(t+0.13); }
  }
  function worldTick(a){
    if(typeof ENEMS==='undefined') return;
    const L=listener();
    for(const e of ENEMS){
      if(!e||!e.alive||e._hidden) continue;
      const cx=e.x+(e.w||SW)/2, cy=e.y+(e.h||SH);
      if(Math.abs(cx-L.x)>18*T||Math.abs(cy-L.y)>12*T) continue;
      const sp=Math.abs(e.vx||0); if(!e.og||sp<0.4){ e._stepAcc=0; continue; }
      e._stepAcc=(e._stepAcc||0)+sp;
      const stride=e.mind?26:e._ai==='circle'?30:22;
      if(e._stepAcc>=stride){ e._stepAcc=0; step(a,cx,cy-4,!!(e.mind||(e.w||0)>40),!!e.mind||e._ai==='circle'); }
    }
  }

  let tickN=0;
  setInterval(()=>{
    try{
      const B=window.MV_BETA; if(!B||!B.on||_gameState!=='game') return;
      if(++tickN%2===0) measure();
      const a=(typeof _audioUnlocked!=='undefined'&&_audioUnlocked&&typeof ga==='function')?ga():null;
      if(!a||a.state!=='running') return;
      graph(a); roomTick();
      if(!(typeof _paused!=='undefined'&&_paused)&&!B.popup) worldTick(a);
    }catch(e){}
  },50);
  window.MV_SPATIAL={env, params, occlusion, chainAt, take, listener, solid, graph:()=>G};
})();
