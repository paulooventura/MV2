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
    // damage bit-crush is for effects and the picture, not the soundtrack.
    // Music only slows down (playbackRate in beta_audio / audio.js).
    const crusher=mk(ac.createWaveShaper()); crusher.oversample='none';
    const musicOut=G(1);
    // Paulo (Oct 22, "sound MORE like the consoles"): with the tube TV on, a console's sound
    // came out of the TV's own speaker — a narrower stereo field, no deep sub, a little
    // cabinet honk around 1.4 kHz, the top rolled off — and the flyback transformer's faint
    // 15.7 kHz whine. Off, it's the clean line out.
    const tvIn=G(1), dryOut=G(1), tvOut=G(0);
    C(out,crusher); C(crusher,tvIn); C(musicOut,tvIn);
    // Paulo (Oct 22): under water everything is muffled — music, effects, all of it — a low-pass that
    // closes down as MIND's head goes under, a touch of low thump, a little quieter (MV_SOUND16.underwater)
    const uwLP=F('lowpass',20000,0.9), uwLow=F('peaking',180,0.8,0), uwG=G(1);
    C(tvIn,uwLP); C(uwLP,uwLow); C(uwLow,uwG); C(uwG,dryOut); C(dryOut,ac.destination);
    {
      const hp=F('highpass',62,0.6), hp2=F('highpass',45,0.5), honk=F('peaking',1400,0.9,1.6), lp=F('lowpass',10500,0.6);
      const sp=mk(ac.createChannelSplitter(2)), mg=mk(ac.createChannelMerger(2)), xs=[[0,0,0.82],[1,1,0.82],[0,1,0.18],[1,0,0.18]];
      C(uwG,hp); C(hp,hp2); C(hp2,honk); C(honk,lp); C(lp,sp);
      for(const [i,o,v] of xs){ const g=G(v); sp.connect(g,i); SKIP.add(g); g.connect(mg,0,o); }
      C(mg,tvOut); C(tvOut,ac.destination);
      const fly=mk(ac.createOscillator()); fly.frequency.value=15734; const flyG=G(0); C(fly,flyG); C(flyG,tvOut); try{ fly.start(); }catch(e){}
      var tvNodes={dryOut,tvOut,flyG};
    }

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
        C(post,lvl); C(lvl,set[k].inp); set[k].outs.forEach(o=>C(o,key==='m'?musicOut:out));
      }
    }
    b={sfx:inS, music:inM, musicPost:postM, sel, ac, chips:[], crusher, phase:5, tv:tvNodes, tvState:null};
    b.uw={lp:uwLP, low:uwLow, g:uwG};
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
  function routeMusic(el,ac){
    if(!el||routed.has(el)||!ac||ac.state!=='running') return;
    try{
      const src=ac.createMediaElementSource(el); SKIP.add(src);
      const b=busFor(ac); known.add(ac);
      if(!b.mfx){ const lp=ac.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=20000; lp.Q.value=0.707; const g=ac.createGain(); const pn=ac.createStereoPanner();
        SKIP.add(lp); SKIP.add(g); SKIP.add(pn); origConnect.call(lp,pn); origConnect.call(pn,g); origConnect.call(g,b.musicPost||b.music); b.mfx={lp,g,pan:pn}; }
      origConnect.call(src,b.mfx.lp); routed.add(el);
    }catch(e){ routed.add(el); }
  }
  HTMLMediaElement.prototype.play=function(){
    // A suspended context swallows the element: the page would look open and
    // stay silent. Leave the track on the speakers until the context is running.
    if(!disabled&&!routed.has(this)&&this instanceof HTMLAudioElement){
      const ac=ctxNow();
      if(ac&&ac.state==='running') routeMusic(this,ac);
      else if(ac&&!ac._mvRouteWait){
        ac._mvRouteWait=true;
        ac.addEventListener('statechange',function onst(){
          if(ac.state!=='running') return;
          ac.removeEventListener('statechange',onst);
          document.querySelectorAll('audio').forEach(el=>routeMusic(el,ac));
        });
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
  // the TV state: speaker voicing on/off, and the degauss "thoom" when the set comes on
  // or the console is switched
  const tvWanted=()=>{ try{ return !!(window.MV_TV&&MV_TV.on)&&mode()!=='off'; }catch(e){ return false; } };
  function degauss(ac){
    try{
      const t=ac.currentTime, o=ac.createOscillator(), o2=ac.createOscillator(), lp=ac.createBiquadFilter(), g=ac.createGain();
      [o,o2,lp,g].forEach(n=>SKIP.add(n));
      o.type='sawtooth'; o.frequency.setValueAtTime(60,t); o2.type='sine'; o2.frequency.setValueAtTime(120,t); o2.frequency.exponentialRampToValueAtTime(52,t+0.9);
      lp.type='lowpass'; lp.frequency.setValueAtTime(900,t); lp.frequency.exponentialRampToValueAtTime(140,t+0.9);
      g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.16,t+0.012); g.gain.exponentialRampToValueAtTime(0.03,t+0.35); g.gain.exponentialRampToValueAtTime(0.0001,t+1.0);
      origConnect.call(o,lp); origConnect.call(o2,lp); origConnect.call(lp,g); origConnect.call(g,ac.destination);
      o.start(t); o2.start(t); o.stop(t+1.05); o2.stop(t+1.05);
      // the click of the relay
      const n=ac.createBufferSource(), buf=ac.createBuffer(1,Math.round(ac.sampleRate*0.02),ac.sampleRate), d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3)*0.5;
      n.buffer=buf; SKIP.add(n); origConnect.call(n,ac.destination); n.start(t);
    }catch(e){}
  }
  let lastMode=null;
  setInterval(()=>{
    const want=tvWanted(), m=mode();
    for(const ac of known){ const b=BUS.get(ac); if(!b||!b.tv||ac.state!=='running') continue;
      if(b.tvState!==want){ const t=ac.currentTime;
        b.tv.dryOut.gain.setTargetAtTime(want?0:1,t,0.04); b.tv.tvOut.gain.setTargetAtTime(want?1:0,t,0.04); b.tv.flyG.gain.setTargetAtTime(want?0.0016:0,t,0.3);
        if(want&&b.tvState===false) degauss(ac);
        b.tvState=want; }
      else if(want&&lastMode&&lastMode!==m) degauss(ac);
    }
    lastMode=m;
  },120);
  const hook=()=>{ if(window.MV_CONSOLE&&MV_CONSOLE.on) MV_CONSOLE.on(applyMode); else setTimeout(hook,200); };
  hook();
  let uwNow=0;
  function underwater(k){
    k=Math.max(0,Math.min(1,k||0)); if(Math.abs(k-uwNow)<0.01) return; uwNow=k;
    for(const ac of known){ const b=BUS.get(ac); if(!b||!b.uw) continue; const t=ac.currentTime;
      try{ b.uw.lp.frequency.setTargetAtTime(20000*Math.pow(380/20000,k),t,0.05);
        b.uw.low.gain.setTargetAtTime(5*k,t,0.08); b.uw.g.gain.setTargetAtTime(1-0.3*k,t,0.08); }catch(e){} }
  }
  window.MV_SOUND16={ underwater, musicFx(ac){ const b=ac&&BUS.get(ac); return b&&b.mfx||null; }, get mode(){ return mode(); }, refresh:applyMode, info(){ const r=[]; for(const ac of known){ const b=BUS.get(ac); r.push({chips:b?b.chips.length:0, state:ac.state, rate:ac.sampleRate}); } return r; } };
})();
