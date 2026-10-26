// ============================================================
//  beta_audio.js — G · music + extra sounds for the L1 beta
//
//  Music: the stage theme (Awdjoo's Canopy Quest) plays through the level.
//  Picking up an item pauses it and plays a slower track under the item
//  window; closing the window picks the stage theme up where it left off.
//  Clearing the stage plays a synthesized house-drop celebration (build 260), then a calm track
//  under the results screen.
//  Sounds (synthesized, no files): cage-block blasts, rope creak/twang,
//  wheel sizzle on walls.
// ============================================================
(function(){
  'use strict';
  const TRACKS={
    stage:'assets/bgm/canopy-quest-gold.mp3',
    stage2:'assets/bgm/crystal-cavern-drift-gold.mp3',
    item:'assets/bgm/lost-save-shrine-diam.mp3',
    results:'assets/bgm/crystal-memory-gate.mp3',
    boss:'assets/bgm/pixel-quasar-gold-boss.mp3',        // 1.3: the heptagon's arena
    calm:'assets/bgm/crystal-memory-gate.mp3'            // the slow, smooth track the exit gate plays once the level's source is down
  };
  const INK_1GO='assets/bgm/kiyoki-senritsu-1go.mp3';
  const INK_STORI='assets/bgm/kiyoki-senritsu-stori.mp3';
  const GORE_TRACK='assets/bgm/chaos-theory.mp3';
  const els={};
  let current=null, wantPlay=null, ensureN=0, held=null;
  const vol=()=>{ try{ return Math.max(0,Math.min(1,(typeof OPT!=='undefined'&&OPT.musicVol!=null)?OPT.musicVol:0.75)); }catch(e){ return 0.75; } };
  function pathOf(name){
    const base=TRACKS[name]||TRACKS.stage;
    try{
      if(window.MV_GORE_SOUND&&MV_GORE_SOUND()) return GORE_TRACK;
      if(window.MV_INK_SOUND&&MV_INK_SOUND()){
        if(name==='stage'||name==='stage2') return INK_1GO;
        if(name==='item') return INK_STORI;
      }
    }catch(e){}
    return base;
  }
  function el(name){
    const path=pathOf(name);
    const prev=els[name];
    if(prev&&prev._path===path) return prev;
    const t=prev?prev.currentTime:0, was=!!(prev&&!prev.paused);
    if(prev) try{ prev.pause(); }catch(e){}
    const a=new Audio(encodeURI(path)); a.loop=true; a.preload='auto'; a._path=path;
    if(prev&&prev._baseVol!=null) a._baseVol=prev._baseVol;
    els[name]=a;
    if(routed[name]!==undefined) routed[name]=undefined;
    if(was){ try{ a.currentTime=t; }catch(e){} const pr=a.play(); if(pr&&pr.catch) pr.catch(()=>{}); }
    return a;
  }
  // Dialog (Laitu and anyone else who sets B.talking): stori, then the stage track resumes where it left off.
  function talk(on){
    const ink=!!(window.MV_INK_SOUND&&MV_INK_SOUND());
    if(!ink){ held=null; return; }   // GORE stays on Chaos Theory; other filters keep the stage track
    if(on){
      if(held||(window.MV_BETA&&MV_BETA.popup)) return;
      const from=current&&current!=='item'?current:((window.MV_BETA&&MV_BETA.music)||'stage');
      const a=els[from];
      held={from, at:a?a.currentTime:0};
      play('item');
    }else if(held){
      const h=held; held=null;
      if(window.MV_BETA&&(MV_BETA.popup||MV_BETA.results||MV_BETA.ending)) return;
      play(h.from);
      try{ if(els[h.from]) els[h.from].currentTime=h.at; }catch(e){}
    }
  }
  function play(name,{restart=false,volume=1}={}){
    if(!TRACKS[name]) name='stage';
    const a=el(name);
    if(restart) try{ a.currentTime=0; }catch(e){}
    a._baseVol=volume; a.playbackRate=1;
    a.volume=vol()*volume;
    current=name; wantPlay=name;
    try{ if(typeof _unlockAudio==='function') _unlockAudio(); }catch(e){}
    try{ const c=typeof ga==='function'?ga():null; if(c&&c.state==='suspended') c.resume(); }catch(e){}
    const pr=a.play();
    const started=()=>{
      for(const k in els) if(k!==name) try{ els[k].pause(); }catch(e){}
      if(typeof _stopAllBgm==='function') try{ _stopAllBgm(); }catch(e){}
    };
    if(pr&&pr.then) pr.then(started).catch(()=>{ wantPlay=name; });
    else started();
  }
  // the stage track is asked for after a level fetch, past the click that
  // unlocked sound — keep trying until the browser actually lets it play
  function ensure(){
    if(!wantPlay||!els[wantPlay]) return;
    const a=els[wantPlay];
    if(!a.paused) return;
    if(++ensureN%20) return;
    a.volume=vol()*(a._baseVol||1);
    try{ if(typeof _unlockAudio==='function') _unlockAudio(); }catch(e){}
    try{ const c=typeof ga==='function'?ga():null; if(c&&c.state==='suspended') c.resume(); }catch(e){}
    const pr=a.play();
    if(pr&&pr.then) pr.then(()=>{ if(typeof _stopAllBgm==='function') try{ _stopAllBgm(); }catch(e){} }).catch(()=>{});
  }
  // A hit slows the theme. It does not duck it: while MIND is hurt the
  // track sits a little further forward (about 14% at the deepest dip),
  // then eases back to the slider as he recovers.
  function hurtTick(){
    if(!current||!els[current]||current==='item'||current==='results') return;
    const a=els[current], f=Math.max(0.3,typeof _healFrac!=='undefined'?_healFrac:1);
    const r=window.MV_CONSOLE&&MV_CONSOLE.hurtRate?MV_CONSOLE.hurtRate():Math.max(0.5,f);   // HP phase → slower music
    if(Math.abs(a.playbackRate-r)>0.004) a.playbackRate=r;
    const presence=1+0.2*Math.max(0,1-f);
    a.volume=Math.min(1,Math.max(0.05,vol()*(a._baseVol||1)*presence));
  }
  // Positional music (Paulo, Oct 22: "level 1.2's music source is the D enemy…"): a track can be
  // routed through Web Audio — low-pass (rock in between), stereo pan (MIND's ears), gain
  // (distance). place(name,{gain,pan,lp}) eases it there; unplace(name) puts it back to plain.
  const routed={};
  function route(name){
    if(routed[name]!==undefined) return routed[name];
    const a=ac(); if(!a||!els[name]) return null;
    try{ const src=a.createMediaElementSource(els[name]), lp=a.createBiquadFilter(), pan=a.createStereoPanner(), g=a.createGain();
      lp.type='lowpass'; lp.frequency.value=20000; lp.Q.value=0.5; src.connect(lp); lp.connect(pan); pan.connect(g); g.connect(a.destination);
      routed[name]={lp,pan,g}; }catch(e){ routed[name]=null; }
    return routed[name];
  }
  function place(name,{gain=1,pan=0,lp=20000}={}){
    if(!els[name]) el(name);
    const r=route(name), a=ac(); if(!r||!a) return;
    const t=a.currentTime;
    r.g.gain.setTargetAtTime(gain,t,0.12); r.pan.pan.setTargetAtTime(Math.max(-1,Math.min(1,pan)),t,0.12); r.lp.frequency.setTargetAtTime(lp,t,0.15);
  }
  function unplace(name){ const r=routed[name]; if(r) place(name,{gain:1,pan:0,lp:20000}); }
  function stopAll(){ for(const k in els) try{ els[k].pause(); }catch(e){} current=null; wantPlay=null; }
  // browsers only allow sound after a click / key: retry then
  const kick=()=>{ if(wantPlay&&els[wantPlay]&&els[wantPlay].paused) play(wantPlay); };
  window.addEventListener('keydown',kick); window.addEventListener('pointerdown',kick);

  function ac(){ try{ return typeof ga==='function'?ga():null; }catch(e){ return null; } }
  // build 222: positional output (beta_spatial.js) for this one sound, else the speakers
  let _dOut=null;
  function D(a){ return _dOut||a.destination; }
  const spatial=fn=>function(){ const a=ac(); _dOut=(a&&window.MV_SPATIAL)?MV_SPATIAL.take(a):null; if(_dOut===false){ _dOut=null; return; } try{ return fn.apply(this,arguments); } finally{ _dOut=null; } };
  const sv=()=>{ try{ return Math.max(0,Math.min(1,OPT.sfxVol!=null?OPT.sfxVol:1)); }catch(e){ return 1; } };
  let noiseBuf=null;
  function noise(a){
    if(noiseBuf) return noiseBuf;
    noiseBuf=a.createBuffer(1,a.sampleRate*1.2,a.sampleRate);
    const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    return noiseBuf;
  }
  // a blast: noise burst through a falling low-pass + a sub thump; bigger when chained
  function boom(amp){
    const a=ac(); if(!a||a.state!=='running') return;
    const t=a.currentTime, k=Math.min(2.2,amp||1);
    const n=a.createBufferSource(); n.buffer=noise(a);
    const lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.setValueAtTime(2400,t); lp.frequency.exponentialRampToValueAtTime(140,t+0.5);
    const g=a.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.32*sv()*Math.min(1.4,0.7+0.3*k),t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+0.55+0.1*k);
    n.connect(lp); lp.connect(g); g.connect(D(a)); n.start(t); n.stop(t+0.8);
    const o=a.createOscillator(), og=a.createGain(); o.type='sine'; o.frequency.setValueAtTime(110,t); o.frequency.exponentialRampToValueAtTime(38,t+0.35);
    og.gain.setValueAtTime(0.4*sv(),t); og.gain.exponentialRampToValueAtTime(0.0001,t+0.4);
    o.connect(og); og.connect(D(a)); o.start(t); o.stop(t+0.45);
  }
  // rope creak: a short scratchy squeak whose pitch climbs with tension
  let lastCreak=0;
  function creak(level){
    const a=ac(); if(!a||a.state!=='running') return;
    const t=a.currentTime; if(t-lastCreak<0.09) return; lastCreak=t;
    const o=a.createOscillator(), g=a.createGain(), bp=a.createBiquadFilter();
    o.type='sawtooth'; const f=180+level*520; o.frequency.setValueAtTime(f,t); o.frequency.linearRampToValueAtTime(f*1.18,t+0.07);
    bp.type='bandpass'; bp.frequency.value=f*2; bp.Q.value=6;
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.06*sv()*(0.4+level),t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+0.08);
    o.connect(bp); bp.connect(g); g.connect(D(a)); o.start(t); o.stop(t+0.1);
  }
  // rope twang when it latches tight or snaps
  function twang(hi){
    const a=ac(); if(!a||a.state!=='running') return;
    const t=a.currentTime, o=a.createOscillator(), g=a.createGain();
    o.type='triangle'; o.frequency.setValueAtTime(hi?520:300,t); o.frequency.exponentialRampToValueAtTime(hi?180:120,t+0.25);
    g.gain.setValueAtTime(0.16*sv(),t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.3);
    o.connect(g); g.connect(D(a)); o.start(t); o.stop(t+0.32);
  }
  // wheel sizzle on a wall
  let lastSizzle=0;
  function sizzle(heat){
    const a=ac(); if(!a||a.state!=='running') return;
    const t=a.currentTime; if(t-lastSizzle<0.12) return; lastSizzle=t;
    const n=a.createBufferSource(); n.buffer=noise(a);
    const hp=a.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=3500+heat*3000;
    const g=a.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.035*sv()*(0.3+heat),t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.12);
    n.connect(hp); hp.connect(g); g.connect(D(a)); n.start(t,Math.random()*0.5); n.stop(t+0.14);
  }
  // stage-clear celebration (Paulo, Oct 22: "that little stage clear song is terrible, let's
  // have something way cooler"): a half-bar riser into a 2-bar house drop at 126 BPM —
  // four-on-the-floor kick, claps, off-beat hats, a ducking sub bassline, supersaw stabs on
  // Cm9 → Abmaj7 → Bb → G7, a portamento lead hook — then it resolves to a big C major
  // (the minor turns major: you made it) with a rising arp and a long tail.
  function fanfare(){
    const a=ac(); if(!a) return 0;
    if(a.state!=='running'&&!(typeof OfflineAudioContext!=='undefined'&&a instanceof OfflineAudioContext)) try{ const pr=a.resume(); if(pr&&pr.catch) pr.catch(()=>{}); }catch(e){}
    const v=sv(), out=a.createGain(); out.gain.value=0.48*v;
    const comp=a.createDynamicsCompressor(); comp.threshold.value=-14; comp.ratio.value=4; comp.attack.value=0.003; comp.release.value=0.12;
    out.connect(comp); comp.connect(D(a));
    // a little hall for the stabs and the lead
    const rev=a.createConvolver(); { const len=Math.round(a.sampleRate*1.6), ir=a.createBuffer(2,len,a.sampleRate); for(let c=0;c<2;c++){ const d=ir.getChannelData(c); for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2); } rev.buffer=ir; }
    const revG=a.createGain(); revG.gain.value=0.22; rev.connect(revG); revG.connect(out);
    const bpm=126, q=60/bpm, t0=a.currentTime+0.06, RIS=2*q, G0=t0+RIS;      // the drop lands after half a bar
    const N=n=>440*Math.pow(2,(n-69)/12);
    const nb=(()=>{ const b=a.createBuffer(1,a.sampleRate,a.sampleRate), d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; return b; })();
    const env=(g,s,peak,att,dec,sus,end,rel)=>{ g.gain.setValueAtTime(0.0001,s); g.gain.exponentialRampToValueAtTime(peak,s+att); g.gain.exponentialRampToValueAtTime(Math.max(0.0001,peak*sus),s+att+dec); g.gain.setValueAtTime(Math.max(0.0001,peak*sus),end); g.gain.exponentialRampToValueAtTime(0.0001,end+rel); };
    const noiseHit=(s,dur,type,f,qv,peak,dest)=>{ const n=a.createBufferSource(); n.buffer=nb; const fl=a.createBiquadFilter(); fl.type=type; fl.frequency.value=f; fl.Q.value=qv; const g=a.createGain(); g.gain.setValueAtTime(peak,s); g.gain.exponentialRampToValueAtTime(0.0001,s+dur); n.connect(fl); fl.connect(g); g.connect(dest||out); n.start(s,Math.random()*0.5); n.stop(s+dur+0.02); };
    // ── the riser: noise opening up, a saw climbing, a snare roll speeding up
    { const n=a.createBufferSource(); n.buffer=nb; n.loop=true; const hp=a.createBiquadFilter(); hp.type='bandpass'; hp.Q.value=1.2; hp.frequency.setValueAtTime(400,t0); hp.frequency.exponentialRampToValueAtTime(7000,G0);
      const g=a.createGain(); g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(0.16,G0-0.02); g.gain.exponentialRampToValueAtTime(0.0001,G0+0.05); n.connect(hp); hp.connect(g); g.connect(out); n.start(t0); n.stop(G0+0.1);
      const o=a.createOscillator(); o.type='sawtooth'; o.frequency.setValueAtTime(N(48),t0); o.frequency.exponentialRampToValueAtTime(N(72),G0); const lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.setValueAtTime(500,t0); lp.frequency.exponentialRampToValueAtTime(5000,G0);
      const og=a.createGain(); og.gain.setValueAtTime(0.0001,t0); og.gain.exponentialRampToValueAtTime(0.05,G0-0.02); og.gain.exponentialRampToValueAtTime(0.0001,G0+0.03); o.connect(lp); lp.connect(og); og.connect(out); o.start(t0); o.stop(G0+0.05);
      let tt=t0, step=q/2; while(tt<G0-0.01){ noiseHit(tt,0.07,'bandpass',1800,0.9,0.05+0.12*((tt-t0)/RIS)); tt+=step; step=Math.max(q/8,step*0.8); } }
    // ── drums (2 bars)
    const kick=s=>{ const o=a.createOscillator(), g=a.createGain(); o.type='sine'; o.frequency.setValueAtTime(150,s); o.frequency.exponentialRampToValueAtTime(46,s+0.12); g.gain.setValueAtTime(0.0001,s); g.gain.exponentialRampToValueAtTime(0.85,s+0.004); g.gain.exponentialRampToValueAtTime(0.0001,s+0.42); o.connect(g); g.connect(out); o.start(s); o.stop(s+0.45);
      noiseHit(s,0.02,'highpass',2500,0.7,0.12); };
    const clap=s=>{ for(const d of [0,0.011,0.022]) noiseHit(s+d,0.09+(d?0:0.06),'bandpass',1300,1.6,0.32); noiseHit(s,0.25,'bandpass',1300,1.2,0.05,rev); };
    for(let b=0;b<8;b++){ const s=G0+b*q; kick(s); noiseHit(s+q/2,0.09,'highpass',8000,0.8,0.13); if(b%2===1) clap(s); noiseHit(s+q*0.75,0.03,'highpass',10000,0.8,0.05); }
    // ── sub bass with a kick duck (the pump)
    const bassNotes=[[36,0,0.75],[36,1,0.5],[48,1.5,0.5],[44,2,0.75],[44,3,0.5],[56,3.5,0.5],[46,4,0.75],[46,5,0.5],[58,5.5,0.5],[43,6,0.75],[43,7,0.5],[47,7.5,0.5]];
    for(const [n,b,d] of bassNotes){ const s=G0+b*q, e=s+d*q, o=a.createOscillator(), o2=a.createOscillator(), lp=a.createBiquadFilter(), g=a.createGain();
      o.type='sine'; o.frequency.value=N(n); o2.type='sawtooth'; o2.frequency.value=N(n); lp.type='lowpass'; lp.frequency.setValueAtTime(900,s); lp.frequency.exponentialRampToValueAtTime(220,e); lp.Q.value=3;
      const g2=a.createGain(); g2.gain.value=0.35; o2.connect(g2); g2.connect(lp); o.connect(lp); lp.connect(g); g.connect(out);
      env(g,s+0.03,0.42,0.02,0.1,0.75,e-0.02,0.06); for(const o3 of [o,o2]){ o3.start(s); o3.stop(e+0.1); } }
    // ── supersaw chord stabs (off-beat house stabs), with a filter snap and the hall
    const stab=(notes,s,len,peak)=>{ const f=a.createBiquadFilter(); f.type='lowpass'; f.Q.value=4; f.frequency.setValueAtTime(5200,s); f.frequency.exponentialRampToValueAtTime(900,s+len);
      const g=a.createGain(); env(g,s,peak,0.006,len*0.6,0.4,s+len,0.12); f.connect(g); g.connect(out); g.connect(rev);
      for(const n of notes) for(const dt of [-14,-5,5,14]){ const o=a.createOscillator(); o.type='sawtooth'; o.frequency.value=N(n); o.detune.value=dt; o.connect(f); o.start(s); o.stop(s+len+0.15); } };
    const CH=[[60,63,67,70,74],[56,60,63,67,72],[58,62,65,70,74],[55,59,62,65,71]];          // Cm9 · Abmaj7 · Bb(add9) · G7
    for(let c=0;c<4;c++) for(const off of [0.5,1.25,1.5]) stab(CH[c],G0+(c*2+off)*q,q*0.32,0.05);
    // ── the lead hook: square + pulse, portamento between notes
    const hook=[[67,0,0.5],[70,0.5,0.5],[72,1,1],[75,2,0.5],[74,2.5,0.5],[72,3,0.5],[70,3.5,0.5],[72,4,0.5],[74,4.5,0.5],[75,5,0.5],[77,5.5,0.5],[79,6,1.5],[83,7.5,0.5]];
    { const o=a.createOscillator(), o2=a.createOscillator(), f=a.createBiquadFilter(), g=a.createGain();
      o.type='square'; o2.type='sawtooth'; o2.detune.value=8; f.type='lowpass'; f.frequency.value=3200; f.Q.value=1.5;
      const vib=a.createOscillator(), vg=a.createGain(); vib.frequency.value=5.8; vg.gain.value=9; vib.connect(vg); vg.connect(o.detune); vg.connect(o2.detune);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(out); g.connect(rev); g.gain.setValueAtTime(0.0001,G0);
      for(const [n,b,d] of hook){ const s=G0+b*q, e=s+d*q; o.frequency.setTargetAtTime(N(n),s,0.012); o2.frequency.setTargetAtTime(N(n),s,0.012); g.gain.setTargetAtTime(0.075,s,0.005); g.gain.setTargetAtTime(0.03,e-0.04,0.02); }
      o.frequency.setValueAtTime(N(67),G0); o2.frequency.setValueAtTime(N(67),G0);
      const END=G0+8*q; g.gain.setTargetAtTime(0.0001,END,0.03);
      for(const x of [o,o2,vib]){ x.start(G0); x.stop(END+0.3); } }
    // ── the resolve: a big C major (it turns major — cleared!), crash, a rising arp, a long tail
    const R0=G0+8*q;
    kick(R0); stab([48,60,64,67,72,76,79],R0,q*3,0.07); noiseHit(R0,1.6,'highpass',5000,0.6,0.16); noiseHit(R0,1.8,'highpass',3000,0.5,0.06,rev);
    { const o=a.createOscillator(), g=a.createGain(); o.type='sine'; o.frequency.value=N(36); env(g,R0,0.4,0.01,0.4,0.6,R0+1.4,0.5); o.connect(g); g.connect(out); o.start(R0); o.stop(R0+2); }
    [72,76,79,84,88,91,96].forEach((n,i)=>{ const s=R0+0.08+i*q/4, o=a.createOscillator(), g=a.createGain(); o.type='triangle'; o.frequency.value=N(n); env(g,s,0.07,0.004,0.12,0.3,s+0.12,0.5); o.connect(g); g.connect(out); g.connect(rev); o.start(s); o.stop(s+0.8); });
    return (R0-a.currentTime+2.2)*1000;
  }

  // a splash: filtered noise whoosh + a little bloop, bigger for heavier things
  let lastSplash=0;
  function splash(k){
    const a=ac(); if(!a||a.state!=='running') return;
    const t=a.currentTime; if(t-lastSplash<0.06) return; lastSplash=t;
    const n=a.createBufferSource(); n.buffer=noise(a);
    const bp=a.createBiquadFilter(); bp.type='bandpass'; bp.frequency.setValueAtTime(1400,t); bp.frequency.exponentialRampToValueAtTime(500,t+0.25); bp.Q.value=1.2;
    const g=a.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.16*sv()*(0.3+k),t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.3);
    n.connect(bp); bp.connect(g); g.connect(D(a)); n.start(t,Math.random()*0.5); n.stop(t+0.32);
    const o=a.createOscillator(), og=a.createGain(); o.type='sine'; o.frequency.setValueAtTime(380+Math.random()*120,t+0.03); o.frequency.exponentialRampToValueAtTime(900,t+0.12);
    og.gain.setValueAtTime(0.0001,t); og.gain.exponentialRampToValueAtTime(0.06*sv()*(0.3+k),t+0.05); og.gain.exponentialRampToValueAtTime(0.0001,t+0.16);
    o.connect(og); og.connect(D(a)); o.start(t+0.03); o.stop(t+0.18);
    // build 227: the spray — a bright "ffff" of droplets that hangs a moment after the hit
    const sp=a.createBufferSource(); sp.buffer=noise(a); const hp=a.createBiquadFilter(); hp.type='highpass'; hp.frequency.setValueAtTime(2600,t); hp.frequency.linearRampToValueAtTime(4200,t+0.45);
    const sg=a.createGain(); sg.gain.setValueAtTime(0.0001,t); sg.gain.exponentialRampToValueAtTime(0.09*sv()*(0.35+k),t+0.03); sg.gain.exponentialRampToValueAtTime(0.0001,t+0.35+0.3*k);
    sp.connect(hp); hp.connect(sg); sg.connect(D(a)); sp.start(t,Math.random()*0.5); sp.stop(t+0.7+0.3*k);
  }
  // the magnet locking onto the floor: a heavy metal CLANK, then a low hum
  // (two detuned square waves through a low-pass, wobbling) while it holds
  function magClank(){
    const a=ac(); if(!a||a.state!=='running') return;
    const t=a.currentTime;
    for(const [f,d,v] of [[180,0.18,0.18],[620,0.09,0.08],[1450,0.05,0.05]]){
      const o=a.createOscillator(), g=a.createGain(); o.type='square'; o.frequency.setValueAtTime(f,t); o.frequency.exponentialRampToValueAtTime(f*0.6,t+d);
      g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(v*sv(),t+0.005); g.gain.exponentialRampToValueAtTime(0.0001,t+d);
      o.connect(g); g.connect(D(a)); o.start(t); o.stop(t+d+0.02);
    }
    const n=a.createBufferSource(); n.buffer=noise(a); const hp=a.createBiquadFilter(); hp.type='bandpass'; hp.frequency.value=2400; hp.Q.value=3;
    const g=a.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.1*sv(),t+0.004); g.gain.exponentialRampToValueAtTime(0.0001,t+0.08);
    n.connect(hp); hp.connect(g); g.connect(D(a)); n.start(t); n.stop(t+0.1);
  }
  let hum=null;
  function magHum(on){
    const a=ac(); if(!a) return;
    if(on&&!hum&&a.state==='running'){
      const g=a.createGain(), f=a.createBiquadFilter(); f.type='lowpass'; f.frequency.value=420; f.Q.value=4;
      const o1=a.createOscillator(), o2=a.createOscillator(), lfo=a.createOscillator(), lg=a.createGain();
      o1.type='square'; o2.type='square'; o1.frequency.value=55; o2.frequency.value=55.7; lfo.frequency.value=7; lg.gain.value=120;
      lfo.connect(lg); lg.connect(f.frequency);
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(D(a));
      const t=a.currentTime; g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.05*sv(),t+0.08);
      o1.start(); o2.start(); lfo.start(); hum={g,os:[o1,o2,lfo]};
    }else if(!on&&hum){
      const t=a.currentTime, h=hum; hum=null;
      h.g.gain.cancelScheduledValues(t); h.g.gain.setValueAtTime(h.g.gain.value||0.03,t); h.g.gain.exponentialRampToValueAtTime(0.0001,t+0.12);
      h.os.forEach(o=>{ try{ o.stop(t+0.15); }catch(e){} });
    }
  }
  window.MV_BETA_AUDIO={play, place, unplace, stopAll, ensure, hurtTick, talk, pathOf, recure, boom:spatial(boom), creak:spatial(creak), twang:spatial(twang), sizzle:spatial(sizzle), fanfare, splash:spatial(splash), magClank:spatial(magClank), magHum, current:()=>current, els};
  function recure(){
    if(!current) return;
    const next=pathOf(current), prev=els[current];
    if(prev&&prev._path===next) return;
    play(current,{restart:true});
  }
})();
