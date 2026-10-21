// ============================================================
//  sound16.js — the console's sound chip
//
//  Everything the game plays — synthesized sounds, samples, and the mp3
//  soundtrack — goes through a bus voiced like the console picked in
//  Options (MV_CONSOLE, see console16.js):
//
//   A · SNES (Sony SPC700 + S-DSP): chip_worklet.js resamples everything to
//       32 kHz, runs it through real BRR encoding (16-sample blocks of 4-bit
//       numbers, shift + prediction filter) and plays it back through the
//       DSP's 4-point Gaussian interpolation; then the S-DSP echo (delay +
//       FIR feedback). Warm, round, a little grainy on quiet tails.
//   B · MEGA DRIVE (YM2612): the DAC — 8-bit sample-and-hold, no
//       interpolation (aliased, bright), with the discrete DAC's "ladder"
//       crossover crunch; FM-style presence and bass; then the Model 1's
//       ~3.4 kHz first-order output filter. Dry, gritty, punchy.
//
//  It works by catching node.connect(ctx.destination) and, for <audio>
//  elements, routing them through a MediaElementSource the first time they
//  play. The two voicings are built side by side and cross-faded, so the
//  switch is instant. ?sfx16=0 or console "off" leaves the sound untouched.
// ============================================================
(function(){
  'use strict';
  if(typeof AudioNode==='undefined'||typeof AudioContext==='undefined') return;
  const BUS=new WeakMap();
  const SKIP=new WeakSet();
  const origConnect=AudioNode.prototype.connect;
  let disabled=false;
  try{ if(/[?&]sfx16=0/.test(location.search)) disabled=true; }catch(e){}
  const mode=()=>{ const C=window.MV_CONSOLE; return disabled||!C?'off':C.mode; };

  function stepCurve(bits,drive){                   // DAC steps (+ a soft knee)
    const N=4096, c=new Float32Array(N), steps=Math.pow(2,bits-1);
    for(let i=0;i<N;i++){ const x=i/(N-1)*2-1; const y=Math.tanh(drive*x)/Math.tanh(drive); c[i]=Math.round(y*steps)/steps; }
    return c;
  }
  function softCurve(k){ const N=1024, c=new Float32Array(N); for(let i=0;i<N;i++){ const x=i/(N-1)*2-1; c[i]=Math.tanh(k*x)/Math.tanh(k); } return c; }

  // Model 1 output stage: a first-order low-pass (~3.4 kHz) as an IIR node
  function firstOrderLP(ac,fc){
    const a=1-Math.exp(-2*Math.PI*fc/ac.sampleRate);
    try{ const n=ac.createIIRFilter([a],[1,-(1-a)]); SKIP.add(n); return n; }
    catch(e){ const n=ac.createBiquadFilter(); n.type='lowpass'; n.frequency.value=fc; n.Q.value=0.5; SKIP.add(n); return n; }
  }
  function busFor(ac){
    let b=BUS.get(ac); if(b) return b;
    const C=(a,b2)=>origConnect.call(a,b2);
    const mk=n=>{ SKIP.add(n); return n; };
    const G=v=>{ const g=mk(ac.createGain()); g.gain.value=v; return g; };
    const F=(type,f,qv,gain)=>{ const n=mk(ac.createBiquadFilter()); n.type=type; n.frequency.value=f; if(qv!=null) n.Q.value=qv; if(gain!=null) n.gain.value=gain; return n; };
    const out=mk(ac.createDynamicsCompressor()); out.threshold.value=-8; out.knee.value=8; out.ratio.value=3; out.attack.value=0.004; out.release.value=0.2;
    // damage bit-crush on everything you hear (follows the HP phase, see console16)
    const crusher=mk(ac.createWaveShaper()); crusher.oversample='none';
    C(out,crusher); C(crusher,ac.destination);

    // SNES after the chip: a little warmth and the S-DSP echo (delay + 8-tap FIR feedback)
    function snesPost(echoSend){
      const inp=G(1), warm=F('lowshelf',220,null,2), dry=G(0.95);
      C(inp,warm); C(warm,dry);
      const send=G(echoSend), dl=mk(ac.createDelay(1)); dl.delayTime.value=0.176;            // EDL 11 × 16 ms
      const fir=F('lowpass',2600,0.7), fb=G(0.42), wet=G(0.6);
      C(warm,send); C(send,dl); C(dl,fir); C(fir,fb); C(fb,dl); C(fir,wet);
      const dl2=mk(ac.createDelay(1)); dl2.delayTime.value=0.088; const w2=G(0.18); C(send,dl2); C(dl2,w2);
      return {inp, outs:[dry,wet,w2]};
    }
    // Mega Drive after the DAC: FM brightness + bass punch, then the Model 1 output filter
    function mdPost(){
      const inp=G(1), bass=F('peaking',95,0.9,4), pres=F('peaking',2800,0.8,4);
      const lp=firstOrderLP(ac,3390), o=G(1.05);
      C(inp,bass); C(bass,pres); C(pres,lp); C(lp,o);
      return {inp, outs:[o]};
    }
    const thruS=G(1), thruM=G(1);
    const sfx={snes:snesPost(0.24), md:mdPost(), off:{inp:thruS,outs:[thruS]}};
    const mus={snes:snesPost(0.08), md:mdPost(), off:{inp:thruM,outs:[thruM]}};
    // the chips themselves sit in front (an AudioWorklet each; until the module
    // loads, a plain pass-through)
    const inS=G(1), inM=G(1), postS=G(1), postM=G(1);
    C(inS,postS); C(inM,postM);
    const sel={};
    for(const [post,set,key] of [[postS,sfx,'s'],[postM,mus,'m']]){
      for(const k of ['snes','md','off']){
        const lvl=G(k===mode()?1:0); sel[key+k]=lvl;
        C(post,lvl); C(lvl,set[k].inp); set[k].outs.forEach(o=>C(o,out));
      }
    }
    b={sfx:inS, music:inM, musicPost:postM, sel, ac, chips:[], crusher, phase:5};
    BUS.set(ac,b);
    try{
      if(ac.audioWorklet&&!disabled){
        ac.audioWorklet.addModule('js/chip_worklet.js').then(()=>{
          for(const [inp,post,rate] of [[inS,postS,15600],[inM,postM,22050]]){
            const node=new AudioWorkletNode(ac,'mv-chip',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]});
            SKIP.add(node); node._rate=rate;
            node.port.postMessage({mode:mode()==='snes'?'snes':mode()==='md'?'md':'off', rate});
            try{ inp.disconnect(post); }catch(e){}
            C(inp,node); C(node,post); b.chips.push(node);
          }
        }).catch(e=>console.warn('MV sound chip worklet unavailable',e));
      }
    }catch(e){}
    return b;
  }
  function applyMode(){
    for(const ac of known){ const b=BUS.get(ac); if(!b) continue;
      const t=ac.currentTime, m=mode();
      for(const key of ['s','m']) for(const k of ['snes','md','off']){
        const g=b.sel[key+k].gain; g.cancelScheduledValues(t); g.setTargetAtTime(k===m?1:0,t,0.03);
      }
      for(const node of b.chips) node.port.postMessage({mode:m==='snes'?'snes':m==='md'?'md':'off', rate:node._rate});
    }
  }
  const known=new Set();
  AudioNode.prototype.connect=function(dest){
    if(dest&&dest instanceof AudioDestinationNode&&!SKIP.has(this)){
      const ac=dest.context;
      if(ac instanceof AudioContext){
        try{ const b=busFor(ac); known.add(ac); origConnect.call(this,b.sfx); return dest; }catch(e){}
      }
    }
    return origConnect.apply(this,arguments);
  };

  // The soundtrack: <audio> elements join the music side of the bus on first play
  const routed=new WeakSet();
  const origPlay=HTMLMediaElement.prototype.play;
  function ctxNow(){
    try{ if(typeof ga==='function'){ const a=ga(); if(a) return a; } }catch(e){}
    try{ if(typeof _bgmAC!=='undefined'&&_bgmAC) return _bgmAC; }catch(e){}
    return null;
  }
  HTMLMediaElement.prototype.play=function(){
    if(!disabled&&!routed.has(this)&&this instanceof HTMLAudioElement){
      const ac=ctxNow();
      if(ac){
        try{
          const src=ac.createMediaElementSource(this); SKIP.add(src);
          const b=busFor(ac); known.add(ac); origConnect.call(src,b.musicPost||b.music); routed.add(this);
        }catch(e){ routed.add(this); }
      }
    }
    if(routed.has(this)){ const ac=ctxNow(); if(ac&&ac.state==='suspended') try{ ac.resume(); }catch(e){} }
    return origPlay.apply(this,arguments);
  };

  // HP phase → bit depth: 5 clean · 4 → 6 bits · 3 → 5 · 2 → 4 · 1 (or shut down) → 3; a fresh hit drops two phases for a moment
  const BITS={4:6,3:5,2:4,1:3};
  setInterval(()=>{
    let ph=5; try{ if(window.MV_CONSOLE&&MV_CONSOLE.hpPhase){ ph=MV_CONSOLE.hpPhase(); if(MV_CONSOLE.jolt&&MV_CONSOLE.jolt()>0) ph=Math.max(1,ph-2); } }catch(e){}
    for(const ac of known){ const b=BUS.get(ac); if(!b||b.phase===ph) continue; b.phase=ph;
      try{ b.crusher.curve=ph>=5?null:stepCurve(BITS[ph],1.0); }catch(e){} }
  },60);
  const hook=()=>{ if(window.MV_CONSOLE&&MV_CONSOLE.on) MV_CONSOLE.on(applyMode); else setTimeout(hook,200); };
  hook();
  window.MV_SOUND16={ get mode(){ return mode(); }, refresh:applyMode, info(){ const r=[]; for(const ac of known){ const b=BUS.get(ac); r.push({chips:b?b.chips.length:0, state:ac.state, rate:ac.sampleRate}); } return r; } };
})();
