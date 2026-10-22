// ============================================================
//  beta_air.js — the XLR's voice (Paulo, Oct 22): "a deep sub woowoowoo
//  kind of sound to represent the air moving so we can be catapulted".
//
//  While the XLR blows: a sub (≈42→62 Hz with the charge) pulsing in and out
//  ("woo-woo-woo", 5 → 9 pulses a second as it builds) with its octave on top
//  for small speakers, and a low rush of moving air under it. When it lets
//  go (or a tap launch): a WHOOMP — a sub drop 95 → 32 Hz and a burst of air
//  closing down. Through MIND's own spatial bus.
// ============================================================
(function(){
  'use strict';
  const sv=()=>{ try{ return Math.max(0,Math.min(1,OPT.sfxVol!=null?OPT.sfxVol:1)); }catch(e){ return 1; } };
  function ac(){ try{ return (typeof _audioUnlocked!=='undefined'&&_audioUnlocked&&typeof ga==='function')?ga():null; }catch(e){ return null; } }
  function dest(a){ try{ const G=window.MV_SPATIAL&&MV_SPATIAL.graph&&MV_SPATIAL.graph(); if(G&&G.self&&G.self.context===a) return G.self; }catch(e){} return a.destination; }
  let A=null, N=null;
  function noise(a){ const b=a.createBuffer(1,a.sampleRate*2,a.sampleRate), d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; return b; }
  function build(a){
    const out=a.createGain(); out.gain.value=0;
    const sub=a.createOscillator(), oct=a.createOscillator(), subG=a.createGain(), octG=a.createGain();
    sub.type='sine'; oct.type='sine'; sub.frequency.value=42; oct.frequency.value=84; subG.gain.value=1; octG.gain.value=0.28;
    const am=a.createGain(); am.gain.value=0.55;                       // the woo-woo: a pulsing level
    const lfo=a.createOscillator(), lfoG=a.createGain(); lfo.frequency.value=5.5; lfoG.gain.value=0.45; lfo.connect(lfoG); lfoG.connect(am.gain);
    const shape=a.createWaveShaper(); const c=new Float32Array(1024); for(let i=0;i<1024;i++){ const x=i/511.5-1; c[i]=Math.tanh(2.2*x)/Math.tanh(2.2); } shape.curve=c;   // a little body
    sub.connect(subG); oct.connect(octG); subG.connect(shape); octG.connect(shape); shape.connect(am);
    const air=a.createBufferSource(); air.buffer=noise(a); air.loop=true;
    const airLP=a.createBiquadFilter(); airLP.type='lowpass'; airLP.frequency.value=380; airLP.Q.value=0.9;
    const airG=a.createGain(); airG.gain.value=0.0; air.connect(airLP); airLP.connect(airG); airG.connect(am);
    const lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900;
    am.connect(lp); lp.connect(out); out.connect(dest(a));
    for(const o of [sub,oct,lfo,air]) o.start();
    return {out,sub,oct,lfo,airLP,airG};
  }
  function tick(){
    const a=ac(); if(!a||a.state!=='running') return;
    if(A!==a){ A=a; N=null; }
    if(!N) try{ N=build(a); }catch(e){ return; }
    const live=typeof _gameState!=='undefined'&&_gameState==='game'&&typeof p!=='undefined'&&p&&!(typeof _paused!=='undefined'&&_paused);
    const on=live&&p.xlrOn&&typeof ITEM!=='undefined'&&ITEM===2;
    const held=on?(p.xlrHeld||(window.MV_BETA&&MV_BETA.chX)||0):0, ch=Math.min(1,held/45);
    const t=a.currentTime, set=(pr,v,tc)=>{ try{ pr.setTargetAtTime(v,t,tc); }catch(e){} };
    set(N.out.gain,on?(0.34+0.2*ch)*sv():0,on?0.03:0.12);
    set(N.sub.frequency,42+20*ch,0.08); set(N.oct.frequency,(42+20*ch)*2,0.08);
    set(N.lfo.frequency,5+4*ch,0.1);
    set(N.airG.gain,on?0.35+0.5*ch:0,0.08); set(N.airLP.frequency,320+700*ch,0.1);
  }
  function boom(k){
    const a=ac(); if(!a||a.state!=='running') return;
    k=Math.max(0.2,Math.min(1,k||1)); const t=a.currentTime, d=dest(a), v=sv();
    const o=a.createOscillator(), g=a.createGain(); o.type='sine';
    o.frequency.setValueAtTime(95,t); o.frequency.exponentialRampToValueAtTime(32,t+0.55);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.75*k*v,t+0.012); g.gain.exponentialRampToValueAtTime(0.0001,t+0.7);
    o.connect(g); g.connect(d); o.start(t); o.stop(t+0.75);
    const n=a.createBufferSource(); n.buffer=noise(a); const lp=a.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=0.8;
    lp.frequency.setValueAtTime(1800,t); lp.frequency.exponentialRampToValueAtTime(160,t+0.45);
    const ng=a.createGain(); ng.gain.setValueAtTime(0.45*k*v,t); ng.gain.exponentialRampToValueAtTime(0.0001,t+0.5);
    n.connect(lp); lp.connect(ng); ng.connect(d); n.start(t); n.stop(t+0.52);
  }
  setInterval(()=>{ try{ tick(); }catch(e){} },33);
  window.MV_AIRBLAST={boom, tick};
})();
