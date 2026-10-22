// ============================================================
//  beta_spatial.js — hear the world from MIND's spot (Paulo, Oct 22:
//  "sounds farther away should sound far… walls, floors and everything
//  with mass should affect the soundscape… from the character's perspective")
//
//  The listener is MIND. Every sound that knows where it comes from
//  (sfxAt / MV_SPATIAL_from, see audio.js) goes through its own little chain:
//   - distance: clear at his ear, fainter and duller the farther, gone past ~26 tiles;
//   - facing: the stereo field is MIND's, not the map's. Turn around and it swaps.
//     What is in front stays bright; what is behind him goes dull and quiet;
//   - obstacles: the line to MIND is walked through rock, slopes, blocks and
//     crates. Anything solid in the way muffles it (low-pass) and lowers it;
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
  const env={open:1, sky:1, size:MAXR, encl:0, elev:0.5, floor:0, wind:0.5, under:0, inside:0, V:0, room:null, t:-99};
  function solid(x,y){
    try{
      const gridOn=typeof _gridReady==='function'&&_gridReady();
      if(gridOn&&typeof gridWorldSolid==='function'){
        if(gridWorldSolid(x,y)) return true;
        if(typeof gridIsSlope==='function'){
          const c=Math.floor(x/T), r=Math.floor(y/T);
          if(gridIsSlope(c,r)){ const sy=gridSlopeY(c,r,x); if(sy!=null&&y>=sy-2) return true; }
        }
        return false;
      }
      if(typeof gridWorldSolid==='function'&&gridWorldSolid(x,y)) return true;
    }catch(e){}
    const B=window.MV_BETA, lv=B&&B.level; if(!lv) return false;
    const c=Math.floor(x/T), r=Math.floor(y/T); if(r<0||c<0||r>=lv.rows||c>=lv.cols) return r>=0;
    return !!lv.cells[r][c];
  }
  function _inBox(b,x,y){ return !!(b&&b.hp!==0&&x>=b.x&&x<b.x+(b.w||T)&&y>=b.y&&y<b.y+(b.h||T)); }
  // A block, crate or moving platform standing between the ear and the source.
  // The object the sound comes FROM does not count — punching it should stay clear.
  function objectBlock(x,y,sx,sy){
    const lists=[];
    if(typeof BWALLS!=='undefined') lists.push(BWALLS);
    if(typeof CRATES!=='undefined') lists.push(CRATES);
    const bp=window.MV_BETA&&MV_BETA.platforms;
    if(bp) lists.push(bp);
    for(const list of lists){
      for(const b of list){
        if(!_inBox(b,x,y)) continue;
        if(_inBox(b,sx,sy)) continue;
        return (b.h!=null&&b.h<20)?0.55:1;
      }
    }
    return 0;
  }
  // ── chambers (Paulo, Oct 22: "an algorithm identifying chambers from open spaces") ──
  // A house (B.rooms rects) is a chamber: its outline counts as a wall for sound even
  // where the door is open. Elsewhere the air around MIND is flood-filled through the
  // grid: if it reaches the open sky it's outside; if it closes up it's a chamber (a
  // cave, a corridor, a basement) and its volume sets how it rings.
  function roomAt(x,y){ const B=window.MV_BETA; for(const r of (B&&B.rooms)||[]) if(x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h) return r; return null; }
  const chamber={closed:false, V:0, room:null, t:-1};
  function flood(){
    const B=window.MV_BETA, lv=B&&B.level; if(!lv) return;
    const L=listener(), c0=Math.floor(L.x/T), r0=Math.floor(L.y/T), room=roomAt(L.x,L.y);
    const hz=B.horizonRow!=null?B.horizonRow:(B.sky||0)+13, LIM=1400;
    const seen=new Set(), q=[[c0,r0]]; seen.add(r0*4096+c0);
    let n=0, sky=false;
    while(q.length&&n<LIM){
      const [c,r]=q.pop(); n++;
      if(r<=0||(!room&&r<hz-4)){ sky=true; break; }
      for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const cc=c+dc, rr=r+dr; if(cc<0||rr<0||cc>=lv.cols||rr>=lv.rows) continue;
        const k=rr*4096+cc; if(seen.has(k)) continue; seen.add(k);
        const t=lv.cells[rr][cc]; if(t&&t!==2) continue;                 // rock / brick / blocks stop sound; one-way planks don't
        if(roomAt(cc*T+16,rr*T+16)!==room) continue;                    // a house's outline is a wall
        q.push([cc,rr]);
      }
    }
    chamber.room=room; chamber.closed=!!room||!sky; chamber.V=room?Math.round(room.w*room.h/(T*T)):n;
  }
  function listener(){ return (typeof p!=='undefined'&&p)?{x:p.x+SW/2, y:p.y+FEET_OFF-34}:{x:0,y:0}; }
  function ray(x,y,dx,dy,max){ const st=12; for(let d=st;d<=max;d+=st){ if(solid(x+dx*d,y+dy*d)) return d; } return max; }
  // tiles of solid matter on the straight line between two points
  function occlusion(x0,y0,x1,y1){
    const dx=x1-x0, dy=y1-y0, L=Math.hypot(dx,dy); if(L<28) return 0;
    const n=Math.min(48,Math.max(4,Math.ceil(L/16))); let k=0;
    for(let i=1;i<n;i++){
      const t=i/n; if(t<0.1||t>0.86) continue;          // skip his body and the source's own body
      const x=x0+dx*t, y=y0+dy*t;
      if(solid(x,y)) k++;
      else {
        const plank=(()=>{ try{
          if(typeof gridCell!=='function'||typeof MV_GRID_ONEWAY==='undefined') return 0;
          const c=Math.floor(x/T), r=Math.floor(y/T);
          if(gridCell(c,r)===MV_GRID_ONEWAY&&(y-r*T)<10) return 0.45;
        }catch(e){} return 0; })();
        k+=Math.max(plank, objectBlock(x,y,x1,y1));
      }
    }
    let walls=0; const B=window.MV_BETA;
    for(const r of (B&&B.rooms)||[]){ const i0=x0>=r.x&&x0<r.x+r.w&&y0>=r.y&&y0<r.y+r.h, i1=x1>=r.x&&x1<r.x+r.w&&y1>=r.y&&y1<r.y+r.h; if(i0!==i1) walls+=2; }
    return k*(L/n)/T+walls;
  }
  // +1 facing screen-right. The ear follows this: turn around and left/right swap.
  function faceSign(){ return (typeof p!=='undefined'&&p&&p.fc)?1:-1; }
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
    flood();
    const inside=chamber.closed?1:0; env.inside+=(inside-env.inside)*0.5; env.V=chamber.V; env.room=chamber.room;
    if(chamber.closed){ env.sky*=0.15; env.encl=Math.max(env.encl,chamber.room?0.9:0.8); env.size=Math.sqrt(chamber.V); }
    env.under=chamber.room?0:Math.max(0,Math.min(1,(row-hz-1)/4))*(1-env.sky);   // a house is not a cave
    // wind forms where the air is high and open
    env.wind=(1-0.92*env.inside)*Math.max(0,Math.min(1,env.sky*(0.25+0.75*Math.min(1,Math.pow(env.elev,1.5)*1.25+Math.max(0,env.open-0.5)*0.6))));
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
    // the chamber's own resonance: a peak tuned to its size (small room high, big cave low)
    const peak=a.createBiquadFilter(); peak.type='peaking'; peak.frequency.value=300; peak.Q.value=1.4; peak.gain.value=0;
    roomIn.connect(conv); conv.connect(peak); peak.connect(roomLP); roomLP.connect(main);
    const echoIn=a.createGain(); echoIn.gain.value=0; const dl=a.createDelay(1); dl.delayTime.value=0.12; const fb=a.createGain(); fb.gain.value=0.25;
    const eLP=a.createBiquadFilter(); eLP.type='lowpass'; eLP.frequency.value=2200;
    echoIn.connect(dl); dl.connect(eLP); eLP.connect(fb); fb.connect(dl); eLP.connect(main);
    // MIND's own sounds: straight to the bus, plus the room
    const self=a.createGain(); self.gain.value=1; self.connect(main);
    const selfRoom=a.createGain(); selfRoom.gain.value=0; self.connect(selfRoom); selfRoom.connect(roomIn); selfRoom.connect(echoIn);
    G={main, roomIn, echoIn, dl, fb, self, selfRoom, posh, peak, roomLP};
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
    set(G.selfRoom.gain, e.encl*0.32+e.inside*0.1);
    const dim=Math.max(2,e.size);                                     // tiles across
    set(G.peak.frequency, Math.max(70,Math.min(800,2600/dim)));
    set(G.peak.gain, 8*e.inside);
    set(G.roomLP.frequency, 3800-1600*e.inside);
  }
  // how a sound at (x,y) reaches MIND
  function params(x,y){
    const L=listener(), dx=x-L.x, dy=y-L.y, dist=Math.hypot(dx,dy), d=dist/T;
    if(d>26) return null;
    const face=faceSign();
    const along=(dx*face)/T;                                 // + tiles in front of him, − behind
    // Stereo is his, not the map's. Facing right, a block on his right is the right ear.
    // Turn to face left and that same block is behind him, so it swaps to the other ear.
    let pan=Math.tanh((dx/T)*face/1.25);
    pan=Math.max(-0.92,Math.min(0.92,pan));
    // clear against his body, faint and dull across the room
    let g=Math.pow(1/(1+d/4.2),1.7);
    let lp=Math.max(480,16800*Math.pow(1/(1+d/5.5),1.25));
    if(along<0){                                            // behind: duller, quieter
      const back=Math.min(1,-along/3.5);
      g*=1-0.5*back; lp=Math.max(280,lp*(1-0.7*back));
    }else if(d<2.2){                                        // in front and close: stays bright
      lp=Math.min(18000,lp*(1+0.12*Math.min(1,along)));
    }
    const ot=occlusion(L.x,L.y,x,y);
    if(ot>0){
      g*=Math.max(0.04,Math.pow(0.48,Math.min(ot,5)));
      lp=Math.max(140,lp*Math.pow(0.36,Math.min(ot,4)));
      pan*=Math.max(0.28,1-ot*0.18);                        // through a wall it loses its sharp side
    }
    const wet=Math.min(1,0.06+env.encl*0.35+d/22+ot*0.16+(along<0?0.14:0));
    return {g, lp, pan, wet, d, ot, along};
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
  window.MV_SPATIAL={env, params, occlusion, chainAt, take, listener, solid, roomAt, graph:()=>G};
})();
