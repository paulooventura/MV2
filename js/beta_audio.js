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
    a.volume=vol()*volume;
    current=name; wantPlay=name;
    const pr=a.play(); if(pr&&pr.catch) pr.catch(()=>{ wantPlay=name; });
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
    const voice=(notes,type,gain,rel)=>{ for(const [n,b,d] of notes){
      const o=a.createOscillator(), g=a.createGain(); o.type=type; o.frequency.value=N(n);
      const s=t0+b*q, e=s+d*q;
      g.gain.setValueAtTime(0.0001,s); g.gain.exponentialRampToValueAtTime(gain*sv(),s+0.015); g.gain.setValueAtTime(gain*sv()*0.7,e-0.03); g.gain.exponentialRampToValueAtTime(0.0001,e+rel);
      o.connect(g); g.connect(a.destination); o.start(s); o.stop(e+rel+0.05); } };
    voice(lead,'square',0.07,0.08); voice(bass,'triangle',0.12,0.1); voice(bell,'sine',0.08,0.8);
    return (6.5*q+0.9)*1000;
  }

  window.MV_BETA_AUDIO={play, stopAll, boom, creak, twang, sizzle, fanfare, current:()=>current, els};
})();
