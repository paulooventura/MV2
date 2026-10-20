// ============================================================
//  beta_audio.js — G · music + extra sounds for the L1 beta
//
//  Music: the stage theme (Awdjoo's Canopy Quest) plays through the level.
//  Picking up an item pauses it and plays a slower track under the item
//  window; closing the window picks the stage theme up where it left off.
//  Clearing the stage plays a short synthesized fanfare, then a calm track
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
    results:'assets/bgm/crystal-memory-gate.mp3'
  };
  const els={};
  let current=null, wantPlay=null;
  const vol=()=>{ try{ return Math.max(0,Math.min(1,(typeof OPT!=='undefined'&&OPT.musicVol!=null)?OPT.musicVol:0.75)); }catch(e){ return 0.75; } };
  function el(name){
    if(!els[name]){ const a=new Audio(encodeURI(TRACKS[name])); a.loop=true; a.preload='auto'; els[name]=a; }
    return els[name];
  }
  function play(name,{restart=false,volume=1}={}){
    if(typeof _stopAllBgm==='function') try{ _stopAllBgm(); }catch(e){}
    for(const k in els) if(k!==name) try{ els[k].pause(); }catch(e){}
    const a=el(name);
    if(restart) try{ a.currentTime=0; }catch(e){}
    a._baseVol=volume; a.playbackRate=1;
    a.volume=vol()*volume;
    current=name; wantPlay=name;
    const pr=a.play(); if(pr&&pr.catch) pr.catch(()=>{ wantPlay=name; });
  }
  // Getting hit slows the music down (and dips it), then it recovers as MIND
  // heals — the same rule the original game used (_healFrac, audio.js).
  function hurtTick(){
    if(!current||!els[current]||current==='item'||current==='results') return;
    const a=els[current], f=Math.max(0.3,typeof _healFrac!=='undefined'?_healFrac:1);
    const r=window.MV_CONSOLE&&MV_CONSOLE.hurtRate?MV_CONSOLE.hurtRate():Math.max(0.5,f);   // HP phase → slower music
    if(Math.abs(a.playbackRate-r)>0.004) a.playbackRate=r;
    a.volume=Math.max(0.05,vol()*(a._baseVol||1)*f);
  }
  function stopAll(){ for(const k in els) try{ els[k].pause(); }catch(e){} current=null; wantPlay=null; }
  // browsers only allow sound after a click / key: retry then
  const kick=()=>{ if(wantPlay&&els[wantPlay]&&els[wantPlay].paused) play(wantPlay); };
  window.addEventListener('keydown',kick); window.addEventListener('pointerdown',kick);

  function ac(){ try{ return typeof ga==='function'?ga():null; }catch(e){ return null; } }
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
    n.connect(lp); lp.connect(g); g.connect(a.destination); n.start(t); n.stop(t+0.8);
    const o=a.createOscillator(), og=a.createGain(); o.type='sine'; o.frequency.setValueAtTime(110,t); o.frequency.exponentialRampToValueAtTime(38,t+0.35);
    og.gain.setValueAtTime(0.4*sv(),t); og.gain.exponentialRampToValueAtTime(0.0001,t+0.4);
    o.connect(og); og.connect(a.destination); o.start(t); o.stop(t+0.45);
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
    o.connect(bp); bp.connect(g); g.connect(a.destination); o.start(t); o.stop(t+0.1);
  }
  // rope twang when it latches tight or snaps
  function twang(hi){
    const a=ac(); if(!a||a.state!=='running') return;
    const t=a.currentTime, o=a.createOscillator(), g=a.createGain();
    o.type='triangle'; o.frequency.setValueAtTime(hi?520:300,t); o.frequency.exponentialRampToValueAtTime(hi?180:120,t+0.25);
    g.gain.setValueAtTime(0.16*sv(),t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.3);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t+0.32);
  }
  // wheel sizzle on a wall
  let lastSizzle=0;
  function sizzle(heat){
    const a=ac(); if(!a||a.state!=='running') return;
    const t=a.currentTime; if(t-lastSizzle<0.12) return; lastSizzle=t;
    const n=a.createBufferSource(); n.buffer=noise(a);
    const hp=a.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=3500+heat*3000;
    const g=a.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.035*sv()*(0.3+heat),t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.12);
    n.connect(hp); hp.connect(g); g.connect(a.destination); n.start(t,Math.random()*0.5); n.stop(t+0.14);
  }
  // stage-clear fanfare: a bright little tune in C major (lead + bass + bells)
  function fanfare(){
    const a=ac(); if(!a) return 0;
    if(a.state!=='running') try{ a.resume(); }catch(e){}
    const t0=a.currentTime+0.05, bpm=148, q=60/bpm;
    const N=n=>440*Math.pow(2,(n-69)/12);
    const lead=[[72,0,.5],[76,.5,.5],[79,1,.5],[84,1.5,1],[83,2.5,.5],[79,3,.5],[81,3.5,.5],[83,4,.5],[84,4.5,2]];
    const bass=[[48,0,1.5],[55,1.5,1],[53,2.5,1],[55,3.5,1],[48,4.5,2]];
    const bell=[[96,4.5,1.5],[91,4.75,1.25],[88,5,1]];
    // 16-bit style voices: a detuned brass section through a filter, a round bass, glassy bells
    const voice=(notes,type,gain,rel)=>{ for(const [n,b,d] of notes){
      const s=t0+b*q, e=s+d*q, g=a.createGain();
      const oscs=type==='brass'?[-7,7].map(c=>{ const o=a.createOscillator(); o.type='sawtooth'; o.frequency.value=N(n); o.detune.value=c; return o; })
                :[(()=>{ const o=a.createOscillator(); o.type=type; o.frequency.value=N(n); return o; })()];
      let head=g;
      if(type==='brass'){ const f=a.createBiquadFilter(); f.type='lowpass'; f.Q.value=2; f.frequency.setValueAtTime(700,s); f.frequency.exponentialRampToValueAtTime(3400,s+0.06); f.frequency.exponentialRampToValueAtTime(1800,e); f.connect(g); head=f;
        const vib=a.createOscillator(), vg=a.createGain(); vib.frequency.value=5.5; vg.gain.value=d>1?6:0; vib.connect(vg); oscs.forEach(o=>vg.connect(o.detune)); vib.start(s); vib.stop(e+rel+0.05); }
      g.gain.setValueAtTime(0.0001,s); g.gain.exponentialRampToValueAtTime(gain*sv(),s+0.02); g.gain.setValueAtTime(gain*sv()*0.75,e-0.03); g.gain.exponentialRampToValueAtTime(0.0001,e+rel);
      oscs.forEach(o=>{ o.connect(head); o.start(s); o.stop(e+rel+0.05); });
      g.connect(a.destination); } };
    voice(lead,'brass',0.06,0.12); voice(bass,'triangle',0.14,0.1); voice(bell,'sine',0.08,0.9);
    // timpani roll into the last chord
    [3.5,3.75,4,4.25,4.5].forEach((b,i)=>{ const s=t0+b*q, o=a.createOscillator(), g=a.createGain(); o.type='sine'; o.frequency.setValueAtTime(i<4?98:65,s); o.frequency.exponentialRampToValueAtTime(i<4?70:44,s+0.3);
      g.gain.setValueAtTime(0.0001,s); g.gain.exponentialRampToValueAtTime((i<4?0.1:0.22)*sv(),s+0.01); g.gain.exponentialRampToValueAtTime(0.0001,s+(i<4?0.25:0.9)); o.connect(g); g.connect(a.destination); o.start(s); o.stop(s+1); });
    return (6.5*q+0.9)*1000;
  }

  // a splash: filtered noise whoosh + a little bloop, bigger for heavier things
  let lastSplash=0;
  function splash(k){
    const a=ac(); if(!a||a.state!=='running') return;
    const t=a.currentTime; if(t-lastSplash<0.06) return; lastSplash=t;
    const n=a.createBufferSource(); n.buffer=noise(a);
    const bp=a.createBiquadFilter(); bp.type='bandpass'; bp.frequency.setValueAtTime(1400,t); bp.frequency.exponentialRampToValueAtTime(500,t+0.25); bp.Q.value=1.2;
    const g=a.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.16*sv()*(0.3+k),t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.3);
    n.connect(bp); bp.connect(g); g.connect(a.destination); n.start(t,Math.random()*0.5); n.stop(t+0.32);
    const o=a.createOscillator(), og=a.createGain(); o.type='sine'; o.frequency.setValueAtTime(380+Math.random()*120,t+0.03); o.frequency.exponentialRampToValueAtTime(900,t+0.12);
    og.gain.setValueAtTime(0.0001,t); og.gain.exponentialRampToValueAtTime(0.06*sv()*(0.3+k),t+0.05); og.gain.exponentialRampToValueAtTime(0.0001,t+0.16);
    o.connect(og); og.connect(a.destination); o.start(t+0.03); o.stop(t+0.18);
  }
  // the magnet locking onto the floor: a heavy metal CLANK, then a low hum
  // (two detuned square waves through a low-pass, wobbling) while it holds
  function magClank(){
    const a=ac(); if(!a||a.state!=='running') return;
    const t=a.currentTime;
    for(const [f,d,v] of [[180,0.18,0.18],[620,0.09,0.08],[1450,0.05,0.05]]){
      const o=a.createOscillator(), g=a.createGain(); o.type='square'; o.frequency.setValueAtTime(f,t); o.frequency.exponentialRampToValueAtTime(f*0.6,t+d);
      g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(v*sv(),t+0.005); g.gain.exponentialRampToValueAtTime(0.0001,t+d);
      o.connect(g); g.connect(a.destination); o.start(t); o.stop(t+d+0.02);
    }
    const n=a.createBufferSource(); n.buffer=noise(a); const hp=a.createBiquadFilter(); hp.type='bandpass'; hp.frequency.value=2400; hp.Q.value=3;
    const g=a.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.1*sv(),t+0.004); g.gain.exponentialRampToValueAtTime(0.0001,t+0.08);
    n.connect(hp); hp.connect(g); g.connect(a.destination); n.start(t); n.stop(t+0.1);
  }
  let hum=null;
  function magHum(on){
    const a=ac(); if(!a) return;
    if(on&&!hum&&a.state==='running'){
      const g=a.createGain(), f=a.createBiquadFilter(); f.type='lowpass'; f.frequency.value=420; f.Q.value=4;
      const o1=a.createOscillator(), o2=a.createOscillator(), lfo=a.createOscillator(), lg=a.createGain();
      o1.type='square'; o2.type='square'; o1.frequency.value=55; o2.frequency.value=55.7; lfo.frequency.value=7; lg.gain.value=120;
      lfo.connect(lg); lg.connect(f.frequency);
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(a.destination);
      const t=a.currentTime; g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.05*sv(),t+0.08);
      o1.start(); o2.start(); lfo.start(); hum={g,os:[o1,o2,lfo]};
    }else if(!on&&hum){
      const t=a.currentTime, h=hum; hum=null;
      h.g.gain.cancelScheduledValues(t); h.g.gain.setValueAtTime(h.g.gain.value||0.03,t); h.g.gain.exponentialRampToValueAtTime(0.0001,t+0.12);
      h.os.forEach(o=>{ try{ o.stop(t+0.15); }catch(e){} });
    }
  }
  window.MV_BETA_AUDIO={play, stopAll, hurtTick, boom, creak, twang, sizzle, fanfare, splash, magClank, magHum, current:()=>current, els};
})();
