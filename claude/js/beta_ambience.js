// ============================================================
//  beta_ambience.js — pass 3 of the art direction: the stage's sound bed
//  (Paulo, Oct 22: "less flat, more rich in graphics and sound effects")
//
//  All synthesized (Web Audio), mixed under the music and the sfx:
//   - outside at night: wind through the town (filtered noise that gusts),
//     crickets, the hum of the power lines; 1.1 has an owl now and then,
//     1.2 has frogs by the water;
//   - underground (cave / basement air, or well below the street): a low
//     cave drone, water drips that ring in the space;
//   - near water: lapping;
//   - MIND's wheel: a rolling rumble with grit that follows his speed on
//     the ground, and a heavier thud on a hard landing.
//  Everything fades with OPT.sfxVol, on pause, on popups and off the game.
//  Build 222: heard from MIND's spot (beta_spatial.js) — crickets sit on real grass, drips
//  fall from real ceilings, frogs on the water, the hum on the lamp posts, each one
//  with distance, panning and the walls in between; wind follows how high and open
//  the place is; the cave drone how enclosed.
// ============================================================
(function(){
  'use strict';
  const STAGE={
    '1.1':{wind:0.9, crickets:1, hum:1, owl:true,  frogs:false, drone:0.8},
    '1.2':{wind:0.7, crickets:0.6, hum:0.6, owl:false, frogs:true, drone:1},
    '1.3':{wind:0.9, crickets:0.3, hum:0.3, owl:false, frogs:true, drone:1.1},
  };
  const DEF=STAGE['1.1'];
  const sv=()=>{ try{ return Math.max(0,Math.min(1,OPT.sfxVol!=null?OPT.sfxVol:1)); }catch(e){ return 1; } };
  function ac(){ try{ return (typeof _audioUnlocked!=='undefined'&&_audioUnlocked&&typeof ga==='function')?ga():null; }catch(e){ return null; } }
  let A=null, N=null;                                 // context, node graph
  let noiseBuf=null;
  function noise(a){
    if(noiseBuf&&noiseBuf.sampleRate===a.sampleRate) return noiseBuf;
    noiseBuf=a.createBuffer(1,a.sampleRate*2,a.sampleRate);
    const d=noiseBuf.getChannelData(0); let b=0;
    for(let i=0;i<d.length;i++){ const w=Math.random()*2-1; b=0.97*b+0.03*w; d[i]=w*0.6+b*3; }   // a bit of brown in the white
    return noiseBuf;
  }
  function loopNoise(a,dest){ const s=a.createBufferSource(); s.buffer=noise(a); s.loop=true; s.connect(dest); s.start(0,Math.random()*1.5); return s; }
  function build(a){
    const out=a.createGain(); out.gain.value=0; out.connect(a.destination);
    // a cave room on a send for drips and the drone
    const rev=a.createConvolver(), len=Math.round(a.sampleRate*2.4), ir=a.createBuffer(2,len,a.sampleRate);
    for(let c=0;c<2;c++){ const d=ir.getChannelData(c); for(let i=0;i<len;i++){ const t=i/len; d[i]=(Math.random()*2-1)*Math.pow(1-t,2.6); } }
    rev.buffer=ir; const revG=a.createGain(); revG.gain.value=0.5; rev.connect(revG); revG.connect(out);
    // wind: noise → band-pass that wanders, gain that gusts
    const wBP=a.createBiquadFilter(); wBP.type='bandpass'; wBP.frequency.value=420; wBP.Q.value=0.9;
    const wG=a.createGain(); wG.gain.value=0; const amb=a.createBiquadFilter(); amb.type='lowpass'; amb.frequency.value=16000; wBP.connect(wG); wG.connect(amb); amb.connect(out); loopNoise(a,wBP);
    // power-line hum: 60 Hz family through a soft low-pass, a slow beat
    const hG=a.createGain(); hG.gain.value=0; const hLP=a.createBiquadFilter(); hLP.type='lowpass'; hLP.frequency.value=420; hLP.connect(hG); hG.connect(out);
    for(const [f,v] of [[60,0.5],[120,0.35],[180,0.18],[240.6,0.08]]){ const o=a.createOscillator(), g=a.createGain(); o.type='sine'; o.frequency.value=f; g.gain.value=v; o.connect(g); g.connect(hLP); o.start(); }
    // cave drone: two low detuned triangles + rumble
    const dG=a.createGain(); dG.gain.value=0; dG.connect(out); dG.connect(rev);
    for(const f of [55,55.4,82.6]){ const o=a.createOscillator(), g=a.createGain(); o.type='triangle'; o.frequency.value=f; g.gain.value=0.22; o.connect(g); g.connect(dG); o.start(); }
    const rLP=a.createBiquadFilter(); rLP.type='lowpass'; rLP.frequency.value=160; const rG=a.createGain(); rG.gain.value=0.6; rLP.connect(rG); rG.connect(dG); loopNoise(a,rLP);
    // water lapping: low-passed noise, amplitude rocked by a slow LFO
    const lLP=a.createBiquadFilter(); lLP.type='lowpass'; lLP.frequency.value=700; const lAM=a.createGain(); lAM.gain.value=0.5;
    const lfo=a.createOscillator(), lfoG=a.createGain(); lfo.frequency.value=0.55; lfoG.gain.value=0.5; lfo.connect(lfoG); lfoG.connect(lAM.gain); lfo.start();
    const lG=a.createGain(); lG.gain.value=0; lLP.connect(lAM); lAM.connect(lG); lG.connect(out); loopNoise(a,lLP);
    // the wheel: band-passed rumble + grit
    const whBP=a.createBiquadFilter(); whBP.type='bandpass'; whBP.frequency.value=180; whBP.Q.value=1.4; const whG=a.createGain(); whG.gain.value=0;
    whBP.connect(whG); whG.connect(a.destination); loopNoise(a,whBP);
    const grHP=a.createBiquadFilter(); grHP.type='highpass'; grHP.frequency.value=2600; const grG=a.createGain(); grG.gain.value=0;
    grHP.connect(grG); grG.connect(a.destination); loopNoise(a,grHP);
    return {out,rev,wBP,wG,amb,hG,hLP,dG,lG,lLP,whBP,whG,grG};
  }
  const set=(param,v,tc)=>{ try{ param.setTargetAtTime(v,A.currentTime,tc||0.25); }catch(e){} };

  // one-shots
  function env(g,t,peak,att,dec){ g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002,peak),t+att); g.gain.exponentialRampToValueAtTime(0.0001,t+att+dec); }
  function at(x,y,g){ return window.MV_SPATIAL?MV_SPATIAL.chainAt(A,x,y,{dest:N.out,gain:g||1}):null; }
  function cricket(pan,x,y){
    const t=A.currentTime, carrier=4200+Math.random()*700, pulses=2+((Math.random()*3)|0);
    const o=A.createOscillator(), g=A.createGain(), p=A.createStereoPanner(); o.type='sine'; o.frequency.value=carrier; p.pan.value=pan;
    g.gain.value=0.0001; const d0=x!=null?at(x,y,1.6):N.out; if(!d0) return; o.connect(g); g.connect(p); p.connect(d0);
    for(let i=0;i<pulses;i++){ const s=t+i*0.055; g.gain.setValueAtTime(0.0001,s); g.gain.exponentialRampToValueAtTime(0.05,s+0.008); g.gain.exponentialRampToValueAtTime(0.0001,s+0.04); }
    o.start(t); o.stop(t+pulses*0.055+0.05);
  }
  function owl(){
    const t=A.currentTime, L=window.MV_SPATIAL?MV_SPATIAL.listener():null, d0=L?at(L.x+(Math.random()<0.5?-1:1)*22*32,L.y-8*32,2.2):N.out; if(!d0) return;
    [[0,0.32],[0.5,0.18],[0.72,0.5]].forEach(([dt,d])=>{ const o=A.createOscillator(), g=A.createGain(); o.type='sine'; o.frequency.setValueAtTime(410,t+dt); o.frequency.linearRampToValueAtTime(370,t+dt+d); env(g,t+dt,0.05,0.06,d); o.connect(g); g.connect(d0); o.start(t+dt); o.stop(t+dt+d+0.1); });
  }
  function frog(pan,x,y){
    const d0=x!=null?at(x,y,1.5):N.out; if(!d0) return;
    const t=A.currentTime, f=140+Math.random()*60, n=2+((Math.random()*2)|0);
    for(let i=0;i<n;i++){ const s=t+i*0.16, o=A.createOscillator(), g=A.createGain(), bp=A.createBiquadFilter(), p=A.createStereoPanner();
      o.type='sawtooth'; o.frequency.setValueAtTime(f,s); o.frequency.exponentialRampToValueAtTime(f*1.5,s+0.09);
      bp.type='bandpass'; bp.frequency.value=f*4; bp.Q.value=5; p.pan.value=pan; env(g,s,0.07,0.01,0.11);
      o.connect(bp); bp.connect(g); g.connect(p); p.connect(d0); o.start(s); o.stop(s+0.14); }
  }
  function drip(pan,amt,x,y){
    const d0=x!=null?at(x,y,1.8):N.out; if(!d0) return;
    const t=A.currentTime, f=900+Math.random()*1300, o=A.createOscillator(), g=A.createGain(), p=A.createStereoPanner();
    o.type='sine'; o.frequency.setValueAtTime(f,t); o.frequency.exponentialRampToValueAtTime(f*2.3,t+0.05); p.pan.value=pan;
    env(g,t,0.09*amt,0.003,0.08); o.connect(g); g.connect(p); p.connect(d0); p.connect(N.rev); o.start(t); o.stop(t+0.12);
  }
  function thud(k){
    const t=A.currentTime, o=A.createOscillator(), g=A.createGain(); o.type='sine'; o.frequency.setValueAtTime(95,t); o.frequency.exponentialRampToValueAtTime(40,t+0.18);
    env(g,t,0.32*k*sv(),0.004,0.2); o.connect(g); g.connect(A.destination); o.start(t); o.stop(t+0.25);
    const n=A.createBufferSource(); n.buffer=noise(A); const lp=A.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900; const ng=A.createGain();
    env(ng,t,0.12*k*sv(),0.003,0.14); n.connect(lp); lp.connect(ng); ng.connect(A.destination); n.start(t,Math.random()); n.stop(t+0.2);
  }

  // where is MIND: how much outside / underground / near water
  let waterNear=0, waterN=0;
  function place(B){
    const T=32, c=Math.floor((p.x+SW/2)/T), r=Math.floor((p.y+FEET_OFF-8)/T);
    const sk=B.skin&&B.skin[r]?B.skin[r][c]:0;
    const hz=B.horizonRow!=null?B.horizonRow:(B.sky||0)+13;
    let out=Math.max(0,Math.min(1,(hz+5-r)/5)); if(sk===4||sk===5) out=0;
    if(++waterN%10===0&&typeof B.inWater==='function'){
      let w=0; for(let dy=-3;dy<=4;dy+=1) for(let dx=-7;dx<=7;dx+=2) if(B.inWater((c+dx)*T+16,(r+dy)*T+16)) w++;
      waterNear=Math.min(1,w/14);
    }
    return {out, under:1-out, water:waterNear};
  }
  // real places for the sounds to come from
  const rc=(n)=>Math.floor((Math.random()*2-1)*n);
  function grassSpot(B){
    const lv=B.level, sr=B.surfRow||[], hz=B.horizonRow!=null?B.horizonRow:30;
    const c0=Math.floor((p.x+SW/2)/32);
    for(let k=0;k<6;k++){ const c=c0+rc(16), r=sr[c]; if(r==null||r>hz+12||r<1) continue; if(lv.cells[r-1][c]) continue; return {x:c*32+16,y:r*32-4}; }
    return null;
  }
  function ceilingSpot(B){
    const lv=B.level, c0=Math.floor((p.x+SW/2)/32), r0=Math.floor((p.y+FEET_OFF-30)/32);
    for(let k=0;k<10;k++){ const c=c0+rc(12), r=r0+rc(8); if(r<1||c<0||r>=lv.rows||c>=lv.cols) continue;
      if(lv.cells[r][c]||lv.cells[r-1][c]!==1||(r-1)<=((B.horizonRow||0)-2)) continue;
      const x=c*32+16, y=r*32+2, sk=B.skin&&B.skin[r]?B.skin[r][c]:0;
      if(MV_SPATIAL.roomAt&&MV_SPATIAL.roomAt(x,y)) continue;                   // no caves in a bedroom
      if(sk!==4&&sk!==5&&r<(B.horizonRow||0)+4) continue;                        // wet rock: cave / basement air, or deep down
      return {x,y}; }
    return null;
  }
  function waterSpot(B,nearest){
    if(typeof B.inWater!=='function') return null;
    const L=MV_SPATIAL.listener();
    let best=null, bd=1e9;
    for(const w of (B.waters||[])){
      const x=nearest?Math.max(w.px0,Math.min(w.px1,L.x)):w.px0+Math.random()*(w.px1-w.px0);
      let y=null; for(let yy=w.base-64; yy<=(w.r1+1)*32; yy+=8){ if(B.inWater(x,yy)){ y=yy; break; } }   // the surface may have moved
      if(y==null) continue; const d=Math.hypot(x-L.x,y-L.y); if(d<bd){ bd=d; best={x,y}; }
    }
    return best;
  }
  // ── things in the world that sound (build 224, Paulo: "we also want logic") ──
  // a positioned loop: its source → low-pass → pan → level → the ambience out (+ the room)
  const loops={};
  function mkLoop(key,feed){
    if(loops[key]&&loops[key].A===A) return loops[key];
    const inp=A.createGain(), lp=A.createBiquadFilter(), pan=A.createStereoPanner(), g=A.createGain(), wet=A.createGain();
    lp.type='lowpass'; lp.frequency.value=8000; g.gain.value=0; wet.gain.value=0;
    inp.connect(lp); lp.connect(pan); pan.connect(g); g.connect(N.out);
    try{ const G0=MV_SPATIAL.graph(); if(G0) { g.connect(wet); wet.connect(G0.roomIn); } }catch(e){}
    feed(inp);
    return loops[key]={A,inp,lp,pan,g,wet};
  }
  function placeLoop(L,gain,lp,pan,wet,tc){ set(L.g.gain,gain,tc||0.3); set(L.lp.frequency,Math.max(120,lp),0.3); set(L.pan.pan,pan,0.3); set(L.wet.gain,(wet||0.2)*gain,0.3); }
  const roomsOf=(B,style)=>(B.rooms||[]).filter(r=>style?r.style===style:true);
  // the stove: a low roar of the fire, crackles and pops
  function stoveSpots(B){
    const out=[];
    for(const rm of B.rooms||[]){ const F=rm.y+rm.h;
      if(rm.style==='home') out.push({x:11*32-6+29, y:F-24});
      else out.push({x:rm.x+rm.w-112+29, y:F-24}); }
    return out;
  }
  function crackle(x,y,amt){
    const d0=at(x,y,amt); if(!d0) return;
    const t=A.currentTime, n=1+((Math.random()*3)|0);
    for(let i=0;i<n;i++){ const s=t+i*(0.02+Math.random()*0.05), src=A.createBufferSource(); src.buffer=noise(A);
      const hp=A.createBiquadFilter(); hp.type='bandpass'; hp.frequency.value=1800+Math.random()*3500; hp.Q.value=2.5;
      const g=A.createGain(); env(g,s,0.09+Math.random()*0.08,0.001,0.02+Math.random()*0.03);
      src.connect(hp); hp.connect(g); g.connect(d0); src.start(s,Math.random()*1.5); src.stop(s+0.08); }
  }
  // the yellow cage blocks: mains hum + a buzz, a spark now and then; many blocks add up
  // gently (a soft limit), so a wall of them is a presence, not a wall of noise
  function yellows(){ return (typeof BWALLS!=='undefined'?BWALLS:[]).filter(b=>b&&b.only==='laser'&&b.hp>0&&!b._destroyFr); }
  function spark(x,y,amt){
    const d0=at(x,y,amt); if(!d0) return;
    const t=A.currentTime, src=A.createBufferSource(); src.buffer=noise(A);
    const hp=A.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=3000;
    const g=A.createGain(); env(g,t,0.12,0.001,0.05); src.connect(hp); hp.connect(g); g.connect(d0); src.start(t,Math.random()); src.stop(t+0.08);
    const o=A.createOscillator(), og=A.createGain(); o.type='square'; o.frequency.setValueAtTime(900+Math.random()*900,t); env(og,t,0.025,0.001,0.04); o.connect(og); og.connect(d0); o.start(t); o.stop(t+0.06);
  }
  // air distance (in tiles) from a sound source to every open cell: a BFS through empty
  // cells, cached per stage and refreshed every 2 s (doors, broken blocks)
  let airF=null;
  function airPath(B,sxw,syw,lx,ly){
    const lv=B.level; if(!lv||!lv.cells) return null;
    const T=32, now=typeof fr==='number'?fr:0;
    if(!airF||airF.lv!==lv||airF.sx!==sxw||now-airF.at>120){
      const cols=lv.cols, rows=lv.rows, D=new Int16Array(cols*rows).fill(-1), q=new Int32Array(cols*rows);
      const open=(c,r)=>{ if(c<0||r<0||c>=cols||r>=rows) return false; const t=lv.cells[r][c]; return !t||t===2; };
      let c0=Math.floor(sxw/T), r0=Math.floor(syw/T);
      if(!open(c0,r0)){ for(const [dc,dr] of [[0,-1],[1,0],[-1,0],[0,1],[0,-2]]) if(open(c0+dc,r0+dr)){ c0+=dc; r0+=dr; break; } }
      let h=0,tl=0; if(open(c0,r0)){ D[r0*cols+c0]=0; q[tl++]=r0*cols+c0; }
      while(h<tl){ const i=q[h++], c=i%cols, r=(i/cols)|0, dd=D[i]+1;
        for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){ const cc=c+dc, rr=r+dr; if(!open(cc,rr)) continue; const k=rr*cols+cc; if(D[k]>=0) continue; D[k]=dd; q[tl++]=k; } }
      airF={lv, sx:sxw, at:now, D, cols, rows};
    }
    const c=Math.floor(lx/T), r=Math.floor(ly/T);
    let best=-1;
    for(const [dc,dr] of [[0,0],[0,-1],[1,0],[-1,0],[0,1]]){ const cc=c+dc, rr=r+dr; if(cc<0||rr<0||cc>=airF.cols||rr>=airF.rows) continue; const v=airF.D[rr*airF.cols+cc]; if(v>=0&&(best<0||v<best)) best=v; }
    return best<0?null:best*0.85;            // 4-neighbour steps overcount diagonals a little
  }
  window.MV_AIRPATH=airPath;
  let musicSet=false, waterWas=null;
  function musicFree(){ if(!musicSet) return; const fx=window.MV_SOUND16&&MV_SOUND16.musicFx?MV_SOUND16.musicFx(A):null; if(fx){ set(fx.lp.frequency,20000,0.3); set(fx.g.gain,1,0.3); set(fx.pan.pan,0,0.3); } musicSet=false; }
  function things(B,S,E){
    const SP=MV_SPATIAL;
    // ── 1.1 only: the stage music plays from the gramophone in MIND's house ──
    // 1.2 (highest triangle) and 1.3 (the boss) are placed by beta_music.js.
    const fx=window.MV_SOUND16&&MV_SOUND16.musicFx?MV_SOUND16.musicFx(A):null;
    if(fx){
      const home=roomsOf(B,'home')[0], cur=window.MV_BETA_AUDIO&&MV_BETA_AUDIO.current&&MV_BETA_AUDIO.current();
      const onStage=B.stageId==='1.1'&&home&&(cur==='stage'||cur==='stage2')&&!B.popup&&!B.results;
      let lp=20000, g=1, pan=0;
      if(onStage){
        const vx=24*32+30, vy=home.y+home.h-50, L=SP.listener();
        const face=(typeof p!=='undefined'&&p&&p.fc)?1:-1;
        const dx=(vx-L.x)/32, d=Math.hypot(vx-L.x,vy-L.y)/32, ot=SP.occlusion(L.x,L.y,vx,vy);
        const along=dx*face;
        // The gramophone is a place on the screen. Left of the character is the
        // left ear, wherever he is looking. Facing away still dulls it. Far from
        // the house (the town gate) it stays faint; just outside the door it carries.
        const air=airPath(B,vx,vy,L.x,L.y);
        const far=air!=null?Math.min(d,air):d;
        g=1/(1+Math.pow(far/11,1.6));
        lp=16000/Math.pow(1+far/5.5,1.5);
        if(along<0){ const back=Math.min(1,-along/4); g*=1-0.5*back; lp*=1-0.62*back; }
        if(ot>1&&(air==null||air>d+6)){ lp*=Math.pow(0.7,Math.min(ot,5)); g*=Math.pow(0.82,Math.min(ot,4)); }
        lp=Math.max(180,Math.min(18000,lp));
        g=Math.max(0.035,Math.min(1,g));
        pan=typeof SP.screenPan==='function'?SP.screenPan(vx):Math.max(-0.94,Math.min(0.94,Math.tanh(dx/8)));
      }
      if(onStage||musicSet){ set(fx.lp.frequency,lp,0.35); set(fx.g.gain,g,0.35); set(fx.pan.pan,pan,0.12); }
      musicSet=onStage;
    }
    // ── stoves ──
    stoveSpots(B).forEach((st,i)=>{
      const P=SP.params(st.x,st.y), L=mkLoop('stove'+i,inp=>{ const lp=A.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=260; const g=A.createGain(); g.gain.value=0.5; loopNoise(A,lp); lp.connect(g); g.connect(inp);
        const bp=A.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=900; bp.Q.value=0.8; const g2=A.createGain(); g2.gain.value=0.12; loopNoise(A,bp); bp.connect(g2); g2.connect(inp); });
      if(!P){ placeLoop(L,0,200,0); return; }
      placeLoop(L,0.22*P.g,P.lp,P.pan,P.wet);
      if(P.g>0.03&&Math.random()<0.35) crackle(st.x+(Math.random()-0.5)*30,st.y,0.9);
    });
    // ── moving water (build 227): the "ffff" of water on the move — rushing flow, falling water,
    //    sloshing waves — from where it's moving; MIND wading through it; splashes in and out ──
    const L0=SP.listener(), wm=typeof B.waterMotion==='function'?B.waterMotion(L0.x,L0.y,14):null;
    const Lw=mkLoop('water',inp=>{
      const hi=A.createBiquadFilter(); hi.type='bandpass'; hi.frequency.value=3200; hi.Q.value=0.6; const g1=A.createGain(); g1.gain.value=0.7; loopNoise(A,hi); hi.connect(g1); g1.connect(inp);
      const lo=A.createBiquadFilter(); lo.type='bandpass'; lo.frequency.value=650; lo.Q.value=0.7; const g2=A.createGain(); g2.gain.value=0.55; loopNoise(A,lo); lo.connect(g2); g2.connect(inp);
      // a slow random churn so it never sounds like a static hiss
      const lfo=A.createOscillator(), lg=A.createGain(); lfo.frequency.value=1.7; lg.gain.value=0.25; lfo.connect(lg); lg.connect(g1.gain); lfo.start();
    });
    if(wm){
      const act=wm.flow*0.6+wm.fall*0.12+wm.wave*0.05, P=SP.params(wm.x,wm.y);
      const level=0.16*(1-Math.exp(-act));
      if(P) placeLoop(Lw,level*Math.max(P.g,0.25*Math.exp(-wm.near/6)),P.lp,P.pan,P.wet,0.15); else placeLoop(Lw,0,200,0);
    } else placeLoop(Lw,0,200,0);
    // MIND in the water: a swish that follows his speed, and a splash going in / coming out
    const inW=typeof B.inWater==='function'&&B.inWater(p.x+SW/2,p.y+FEET_OFF-14);
    const Lwd=mkLoop('wade',inp=>{ const bp=A.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=1500; bp.Q.value=0.8; loopNoise(A,bp); bp.connect(inp); });
    const sp=Math.hypot(p.vx||0,p.vy||0);
    placeLoop(Lwd,inW?Math.min(0.12,sp*0.02):0,inW?3500+sp*600:200,0,0.2,0.08);
    if(inW!==waterWas&&waterWas!==null&&window.MV_BETA_AUDIO&&MV_BETA_AUDIO.splash){ MV_SPATIAL_from({x:p.x+SW/2,y:p.y+FEET_OFF-14}); MV_BETA_AUDIO.splash(Math.min(1,0.35+Math.abs(p.vy||0)/9)); }
    waterWas=inW;
    // ── the yellow blocks ──
    let sum=0, lpW=0, panW=0, wetW=0; const near=[];
    for(const b of yellows()){ const x=b.x+(b.w||32)/2, y=b.y+(b.h||32)/2, P=SP.params(x,y); if(!P||P.g<0.01) continue; sum+=P.g; lpW+=P.lp*P.g; panW+=P.pan*P.g; wetW+=P.wet*P.g; near.push([x,y,P.g]); }
    const Lb=mkLoop('electro',inp=>{
      for(const [f,v,type] of [[60,0.5,'sine'],[120,0.4,'sawtooth'],[180.4,0.12,'sawtooth']]){ const o=A.createOscillator(), g=A.createGain(); o.type=type; o.frequency.value=f; g.gain.value=v; o.connect(g); g.connect(inp); o.start(); }
      const bp=A.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=2400; bp.Q.value=4; const g=A.createGain(); g.gain.value=0.12; loopNoise(A,bp); bp.connect(g); g.connect(inp);   // the fizz
    });
    if(sum>0){
      const level=0.07*(1-Math.exp(-sum*1.4));             // soft limit: 1 block ≈ ½, many ≈ full, never more
      placeLoop(Lb,level,Math.min(5000,lpW/sum),panW/sum,wetW/sum);
      if(Math.random()<Math.min(0.25,0.05*near.length)){ const n=near[(Math.random()*near.length)|0]; spark(n[0]+(Math.random()-0.5)*20,n[1]+(Math.random()-0.5)*20,0.8); }
    } else placeLoop(Lb,0,200,0);
  }
  let lastOg=true, lastVy=0, gust=0, gustT=0;
  function tick(){
    const a=ac(); if(!a||a.state!=='running') return;
    if(a!==A){ A=a; N=build(a); }
    const B=window.MV_BETA;
    const live=B&&B.on&&_gameState==='game'&&!(typeof _paused!=='undefined'&&_paused)&&!B.popup&&!B.results&&typeof p!=='undefined'&&p;
    const master=live?0.55*sv():0;
    set(N.out.gain,master,live?0.6:0.15);
    if(!live){ set(N.whG.gain,0,0.05); set(N.grG.gain,0,0.05); musicFree(); return; }
    const S=STAGE[B.stageId]||DEF, w=place(B), t=A.currentTime;
    const SP=window.MV_SPATIAL, E=SP?SP.env:{wind:w.out, under:w.under, encl:w.under, elev:0.5};
    // wind lives where it's high and open (beta_spatial measures it); gusts, and it
    // whistles higher the higher he is
    if(t>gustT){ gust=0.4+Math.random()*0.8; gustT=t+2+Math.random()*4; set(N.wBP.frequency,(300+gust*500)*(1+E.elev*0.8),1.2); }
    // the weather (beta_weather.js): the wind picks up with the storm, the crickets go quiet in the rain
    const WX=window.MV_WEATHER&&MV_WEATHER.state, storm=WX?Math.max(WX.storm||0,(WX.cloud||0)*0.6):0, hush=WX?Math.min(1,Math.max(storm,(WX.haze||0)*0.4)):0;
    set(N.wG.gain,0.16*S.wind*Math.max(gust,storm*1.1)*E.wind*(1+1.8*storm),1.2);
    // indoors the night comes through the walls: dull and low (wind, crickets and hum are also
    // walled off one by one through beta_spatial's occlusion)
    set(N.amb.frequency, 16000-15200*(E.inside||0), 0.4);
    // the power lines hum from the lamp posts, as far and as walled-off as they are
    let hum=0, hlp=420;
    if(SP) for(const d of (B.decor||[])){ if(d.kind!=='lamp') continue; const P=SP.params(d.x,d.y-40); if(P&&P.g>hum){ hum=P.g; hlp=Math.min(420,P.lp); } }
    set(N.hG.gain,0.06*S.hum*hum,0.6); set(N.hLP.frequency,Math.max(120,hlp),0.4);
    set(N.dG.gain,E.room?0:0.09*S.drone*Math.max(E.under,E.encl*0.5*w.under),1.0);
    // water lapping from the nearest water surface
    let lap=0, llp=700; const ws=SP?waterSpot(B,true):null;
    if(ws){ const P=SP.params(ws.x,ws.y); if(P){ lap=P.g; llp=Math.min(700,P.lp); } }
    set(N.lG.gain,0.2*lap,0.6); set(N.lLP.frequency,Math.max(150,llp),0.4);
    // the creatures and the drips, each from a real spot
    if(SP){
      if(Math.random()<0.12*S.crickets*(1-0.95*hush)){ const g=grassSpot(B); if(g) cricket(0,g.x,g.y); }
      if(S.owl&&E.wind>0.2&&Math.random()<0.0016*(1-hush)) owl();
      if(S.frogs&&Math.random()<0.02*(1+storm)){ const f=waterSpot(B,false); if(f) frog(0,f.x,f.y-6); }
      if(!E.room&&Math.random()<0.06){ const c=ceilingSpot(B); if(c) drip(0,0.8,c.x,c.y); }
      things(B,S,E);
    }
    // the wheel
    const og=!!(p.og||(typeof _playerOnGround==='function'&&_playerOnGround(p)));
    const spd=og?Math.min(1,Math.abs(p.vx)/6):0;
    set(N.whG.gain,0.045*spd*sv(),0.06); set(N.whBP.frequency,110+spd*150,0.1);   // was 0.16: it read as a whoosh
    set(N.grG.gain,0.006*spd*sv(),0.06);
    if(og&&!lastOg&&lastVy>7) thud(Math.min(1.4,(lastVy-6)/6));
    lastOg=og; lastVy=p.vy||0;
  }
  setInterval(()=>{ try{ tick(); }catch(e){} },50);
  window.MV_AMBIENCE={STAGE, tick, loops:()=>loops, state:()=>N&&A?{out:N.out.gain.value, wind:N.wG.gain.value, hum:N.hG.gain.value, drone:N.dG.gain.value, lap:N.lG.gain.value, wheel:N.whG.gain.value}:null};
})();
