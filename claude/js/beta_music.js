// ============================================================
//  beta_music.js — where the music comes from (Paulo, Oct 22)
//
//  "Level 1.2's music source is the D enemy. Once it's shut down, the level
//   music stops, and the slow smooth track starts; its source is the exit gate.
//   Level 1.3's music source is the Heptagon. Once we enter its arena perimeter,
//   the boss theme starts. When we eliminate the boss, that very frame freezes
//   the whole scene and zooms in to our character for a second while a glorious
//   song plays; after a couple of seconds the game unfreezes."
//
//  A director picks the track each frame and places it on its source:
//  louder near it, quieter and duller far off, panned to MIND's ears (his
//  facing), muffled when rock is in between (beta_audio.js place()).
//  It sets B.music too, so the item window and the rest hand back the right one.
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B) return;
  const T=32, A=()=>window.MV_BETA_AUDIO;
  const on=()=>B.on&&typeof _gameState!=='undefined'&&_gameState==='game';
  let lastTrack=null, placed=null, stageMusic=null, stageId=null;

  // ── the sources ──
  const ctr=e=>({x:e.x+e.w/2, y:e.y+e.h/2});
  const gatePos=()=>B.gate?{x:B.gate.x+B.gate.w/2, y:B.gate.y+B.gate.h/2}:null;
  function arenaHas(px,py){                                        // 1.3: the open air over the bowl, right of the towers
    return px>=52*T&&px<=91*T&&py<=65*T;
  }
  function pick(){
    const sid=B.stageId;
    if(sid==='1.2'){
      const d=(typeof ENEMS!=='undefined'?ENEMS:[]).find(e=>e&&e.mirror&&e.alive);
      if(d) return {track:stageMusic, at:ctr(d)};
      return {track:'calm', at:gatePos()};
    }
    if(sid==='1.3'){
      const boss=(typeof ENEMS!=='undefined'?ENEMS:[]).find(e=>e&&e._boss);
      if(B.bossDown||!boss||!boss.alive) return {track:'calm', at:gatePos()};
      const px=p.x+SW/2, py=p.y+FEET_OFF-40;
      if(!B.bossOn&&arenaHas(px,py)){ B.bossOn=true; if(!boss.awake){ boss.awake=true; B.shake=Math.max(B.shake||0,5); try{ sfx('chargeReady',0.5); }catch(e){} } }
      return {track:B.bossOn?'boss':stageMusic, at:ctr(boss)};
    }
    return null;
  }
  // how it sounds from where MIND is
  function solidAt(x,y){ return typeof gridWorldSolid==='function'&&gridWorldSolid(x,y); }
  function hear(at){
    const ox=p.x+SW/2, oy=p.y+FEET_OFF-50, dx=at.x-ox, dy=at.y-oy, d=Math.hypot(dx,dy);
    const near=Math.max(0,1-d/1500);
    let rock=0; const n=Math.min(40,Math.ceil(d/T));
    for(let i=1;i<n;i++){ if(solidAt(ox+dx*i/n,oy+dy*i/n)) rock++; }
    const occ=Math.min(1,rock/10);
    return {gain:(0.22+0.78*near*near)*(1-0.35*occ), pan:Math.max(-0.85,Math.min(0.85,dx*(p.fc?1:-1)/650)), lp:Math.max(700,(2500+15500*near)*(1-0.85*occ))};
  }
  function direct(){
    if(!on()||!p||!A()) return;
    if(B.stageId!==stageId){ stageId=B.stageId; stageMusic=B.music||'stage'; lastTrack=null; if(placed&&A().unplace) A().unplace(placed); placed=null; }
    if(B.popup||B.talking||B.results||B.trans||B.ending||B.freeze) return;       // item window, dialog, results, and the boss moment play their own
    const want=pick(); if(!want||!want.track) return;
    B.music=want.track;
    if(A().current()!==want.track){ A().play(want.track,{restart:want.track!==lastTrack}); lastTrack=want.track; }
    if(want.at){ if(placed&&placed!==want.track&&A().unplace) A().unplace(placed); placed=want.track; A().place(want.track,hear(want.at)); }
  }

  // ── the boss falls: the scene freezes, the camera closes in on MIND, the glory song ──
  const FREEZE=150;                                                // ~2.5 s
  let bossWasAlive=false;
  function watchBoss(){
    if(B.stageId!=='1.3'){ bossWasAlive=false; return; }
    const boss=(typeof ENEMS!=='undefined'?ENEMS:[]).find(e=>e&&e._boss);
    const alive=!!(boss&&boss.alive);
    if(bossWasAlive&&!alive&&!B.freeze){
      B.freeze={t:0, dur:FREEZE, z0:typeof camZoom!=='undefined'&&camZoom?camZoom:1};
      if(A()) A().stopAll();
      glory();
    }
    bossWasAlive=alive;
  }
  const _up=window.update;
  window.update=function(){
    if(B.on&&B.freeze){
      const F=B.freeze; F.t++;
      if(F.t>=F.dur){ B.freeze=null; lastTrack=null; }
      return;                                                       // the whole scene holds still
    }
    const r=_up.apply(this,arguments);
    try{ watchBoss(); direct(); }catch(e){}
    return r;
  };
  // the camera: in close on MIND for the moment (past the usual 1.5 cap), then back out
  const _cz=window._updateCamZoom;
  if(typeof _cz==='function') window._updateCamZoom=function(){
    if(B.on&&B.freeze){
      const F=B.freeze, k=Math.min(1,F.t/50), out=Math.max(0,(F.t-(F.dur-30))/30), z=2.3;
      const tgt=F.z0+(z-F.z0)*(k*k*(3-2*k))*(1-out);
      try{ camZoom+=(tgt-camZoom)*0.25; camZoomTgt=tgt; }catch(e){}
      return;
    }
    return _cz.apply(this,arguments);
  };
  // …centred on his body (not the usual feet-at-40% follow point)
  const _cf=window._cameraFollowTarget;
  if(typeof _cf==='function') window._cameraFollowTarget=function(pl){
    if(B.on&&B.freeze&&pl===p&&typeof camViewW==='function'){ const vw=camViewW(), vh=camViewH(); return {x:p.x+SW/2-vw/2, y:p.y+FEET_OFF-48-vh/2}; }
    return _cf.apply(this,arguments);
  };
  // a glow round MIND and a title while it holds
  const _hud=window.drawHUD;
  if(typeof _hud==='function') window.drawHUD=function(){
    const r=_hud.apply(this,arguments);
    try{ if(B.on&&B.freeze) drawGlory(B.freeze); }catch(e){}
    return r;
  };
  function drawGlory(F){
    const u=F.t/F.dur, a=Math.min(1,F.t/10)*Math.min(1,(F.dur-F.t)/20);
    const W=ctx.canvas.width, H=ctx.canvas.height;
    ctx.save();
    if(F.t<8){ ctx.fillStyle='rgba(255,250,230,'+(0.7*(1-F.t/8))+')'; ctx.fillRect(0,0,W,H); }     // the flash
    const g=ctx.createRadialGradient(W*0.5,H*0.5,20,W*0.5,H*0.5,W*0.6);
    g.addColorStop(0,'rgba(255,230,150,'+(0.22*a)+')'); g.addColorStop(0.5,'rgba(255,190,90,'+(0.08*a)+')'); g.addColorStop(1,'rgba(20,8,30,'+(0.45*a)+')');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    ctx.globalCompositeOperation='lighter';
    for(let i=0;i<12;i++){ const an=i/12*Math.PI*2+u*0.6; ctx.fillStyle='rgba(255,220,140,'+(0.05*a)+')'; ctx.beginPath(); ctx.moveTo(W*0.5,H*0.5); ctx.lineTo(W*0.5+Math.cos(an-0.06)*W,H*0.5+Math.sin(an-0.06)*W); ctx.lineTo(W*0.5+Math.cos(an+0.06)*W,H*0.5+Math.sin(an+0.06)*W); ctx.fill(); }
    ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=a;
    if(typeof drawTextC==='function'){ drawTextC('THE HEPTAGON FALLS',W/2,H*0.74,'#ffe39a',3); if(F.t>40) drawTextC('THE WAY TO 2.1 OPENS ONCE EVERY KNOWL IS IN',W/2,H*0.74+44,'#fff4d8',1); }
    ctx.restore();
  }

  // ── the glory song: brass on C – F – G – C, timpani, a choir pad, a trumpet line ──
  function glory(){
    const a=typeof ga==='function'?ga():null; if(!a) return;
    try{ if(a.state!=='running') a.resume(); }catch(e){}
    const sv=(()=>{ try{ return Math.max(0,Math.min(1,OPT.musicVol!=null?OPT.musicVol:0.75)); }catch(e){ return 0.75; } })();
    const t0=a.currentTime+0.03, out=a.createGain(); out.gain.value=0.5*sv;
    const comp=a.createDynamicsCompressor(); comp.threshold.value=-16; comp.ratio.value=3.5; out.connect(comp); comp.connect(a.destination);
    const rev=a.createConvolver(); { const len=Math.round(a.sampleRate*2.2), ir=a.createBuffer(2,len,a.sampleRate); for(let c=0;c<2;c++){ const d=ir.getChannelData(c); for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6); } rev.buffer=ir; }
    const rg=a.createGain(); rg.gain.value=0.35; rev.connect(rg); rg.connect(out);
    const F=n=>440*Math.pow(2,(n-69)/12);
    // brass: three detuned saws per note through a filter that opens as it swells
    function brass(notes,t,dur,vel){
      for(const n of notes) for(const det of [-7,0,6]){
        const o=a.createOscillator(), f=a.createBiquadFilter(), g=a.createGain();
        o.type='sawtooth'; o.frequency.value=F(n); o.detune.value=det;
        f.type='lowpass'; f.frequency.setValueAtTime(500,t); f.frequency.linearRampToValueAtTime(3200,t+0.12); f.frequency.linearRampToValueAtTime(1800,t+dur);
        g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.045*vel,t+0.06); g.gain.setValueAtTime(0.045*vel,t+dur-0.08); g.gain.exponentialRampToValueAtTime(0.0001,t+dur+0.25);
        o.connect(f); f.connect(g); g.connect(out); g.connect(rev); o.start(t); o.stop(t+dur+0.3);
      }
    }
    // a choir pad under it: soft detuned triangles, slow attack
    function choir(notes,t,dur){
      for(const n of notes) for(const det of [-10,10]){
        const o=a.createOscillator(), g=a.createGain(); o.type='triangle'; o.frequency.value=F(n); o.detune.value=det;
        g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.03,t+0.4); g.gain.setValueAtTime(0.03,t+dur); g.gain.exponentialRampToValueAtTime(0.0001,t+dur+0.8);
        o.connect(g); g.connect(rev); g.connect(out); o.start(t); o.stop(t+dur+0.9);
      }
    }
    function timp(t,f,vel){ const o=a.createOscillator(), g=a.createGain(); o.type='sine'; o.frequency.setValueAtTime(f*1.6,t); o.frequency.exponentialRampToValueAtTime(f,t+0.08);
      g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.32*vel,t+0.005); g.gain.exponentialRampToValueAtTime(0.0001,t+0.7);
      o.connect(g); g.connect(out); g.connect(rev); o.start(t); o.stop(t+0.75); }
    function cymbal(t,dur){ const len=Math.round(a.sampleRate*dur), b=a.createBuffer(1,len,a.sampleRate), d=b.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
      const s=a.createBufferSource(), hp=a.createBiquadFilter(), g=a.createGain(); s.buffer=b; hp.type='highpass'; hp.frequency.value=6000;
      g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.09,t+0.03); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
      s.connect(hp); hp.connect(g); g.connect(out); g.connect(rev); s.start(t); s.stop(t+dur); }
    function trumpet(n,t,dur){ const o=a.createOscillator(), f=a.createBiquadFilter(), g=a.createGain(), lfo=a.createOscillator(), lg=a.createGain();
      o.type='sawtooth'; o.frequency.value=F(n); lfo.frequency.value=5.5; lg.gain.value=F(n)*0.006; lfo.connect(lg); lg.connect(o.frequency);
      f.type='bandpass'; f.frequency.value=F(n)*2.2; f.Q.value=1.2;
      g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.13,t+0.04); g.gain.setValueAtTime(0.11,t+dur-0.05); g.gain.exponentialRampToValueAtTime(0.0001,t+dur+0.2);
      o.connect(f); f.connect(g); g.connect(out); g.connect(rev); o.start(t); lfo.start(t); o.stop(t+dur+0.25); lfo.stop(t+dur+0.25); }
    // timpani roll into the first chord
    for(let i=0;i<10;i++) timp(t0+i*0.035,65,0.25+i*0.06);
    cymbal(t0+0.35,2.6);
    const b=0.42;                                                  // one beat
    brass([48,52,55,60],t0+0.35,b*1.6,1);   choir([60,64,67],t0+0.35,b*1.6);   timp(t0+0.35,65,1);
    brass([53,57,60,65],t0+0.35+b*1.6,b,0.9); timp(t0+0.35+b*1.6,87,0.8);
    brass([55,59,62,67],t0+0.35+b*2.6,b,0.95); timp(t0+0.35+b*2.6,98,0.85);
    brass([48,52,55,60,64,67,72],t0+0.35+b*3.6,b*3.4,1.1); choir([60,64,67,72],t0+0.35+b*3.6,b*3.4); timp(t0+0.35+b*3.6,65,1.1); cymbal(t0+0.35+b*3.6,3);
    // the trumpet: G C E | F E D | G — C
    const mel=[[67,0,0.5],[72,0.5,0.5],[76,1,0.6],[77,1.6,0.33],[76,1.93,0.33],[74,2.26,0.34],[79,2.6,0.9],[84,3.6,3.2]];
    for(const [n,s,d] of mel) trumpet(n,t0+0.35+s*b,d*b);
  }
  B.glory=glory;
})();
