// ============================================================
//  sound16.js — the 16-bit sound bus
//
//  Every synthesized sound in the game (jumps, hits, item zaps, PSG music,
//  the beta's blasts and fanfare) is routed through one shared bus before it
//  reaches the speakers, styled after a 16-bit console's sound chip:
//  a gentle top-end roll-off (32 kHz-era warmth), a touch of soft saturation,
//  the classic echo buffer (a filtered delay with feedback) and a small room.
//  The mp3 soundtrack plays through <audio> and is untouched.
//  Works by catching node.connect(ctx.destination); nothing else changes.
// ============================================================
(function(){
  'use strict';
  if(typeof AudioNode==='undefined'||typeof AudioContext==='undefined') return;
  const BUS=new WeakMap();
  const SKIP=new WeakSet();
  const origConnect=AudioNode.prototype.connect;
  function impulse(ac,secs,decay){
    const n=Math.floor(ac.sampleRate*secs), b=ac.createBuffer(2,n,ac.sampleRate);
    for(let c=0;c<2;c++){ const d=b.getChannelData(c); for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/n,decay)*(i<ac.sampleRate*0.012?i/(ac.sampleRate*0.012):1); }
    return b;
  }
  function busFor(ac){
    let b=BUS.get(ac); if(b) return b;
    const mk=n=>{ SKIP.add(n); return n; };
    const input=mk(ac.createGain());
    const warm=mk(ac.createBiquadFilter()); warm.type='lowpass'; warm.frequency.value=12500; warm.Q.value=0.5;
    const body=mk(ac.createBiquadFilter()); body.type='peaking'; body.frequency.value=180; body.gain.value=2.5; body.Q.value=0.8;
    const sat=mk(ac.createWaveShaper()); const k=1.6, N=1024, curve=new Float32Array(N);
    for(let i=0;i<N;i++){ const x=i/(N-1)*2-1; curve[i]=Math.tanh(k*x)/Math.tanh(k); } sat.curve=curve; sat.oversample='2x';
    const dry=mk(ac.createGain()); dry.gain.value=0.92;
    // echo buffer: send -> delay -> low-pass -> feedback, like a sound chip's echo FIR
    const send=mk(ac.createGain()); send.gain.value=0.22;
    const dl=mk(ac.createDelay(1)); dl.delayTime.value=0.15;
    const efl=mk(ac.createBiquadFilter()); efl.type='lowpass'; efl.frequency.value=3200;
    const fb=mk(ac.createGain()); fb.gain.value=0.32;
    const wet=mk(ac.createGain()); wet.gain.value=0.55;
    // small room
    const rv=mk(ac.createConvolver()); rv.buffer=impulse(ac,1.1,3.2);
    const rwet=mk(ac.createGain()); rwet.gain.value=0.14;
    const out=mk(ac.createDynamicsCompressor()); out.threshold.value=-10; out.knee.value=8; out.ratio.value=3; out.attack.value=0.004; out.release.value=0.18;
    const C=(a,b2)=>origConnect.call(a,b2);
    C(input,body); C(body,warm); C(warm,sat); C(sat,dry); C(dry,out);
    C(sat,send); C(send,dl); C(dl,efl); C(efl,fb); C(fb,dl); C(efl,wet); C(wet,out);
    C(sat,rv); C(rv,rwet); C(rwet,out);
    C(out,ac.destination);
    b={input}; BUS.set(ac,b); return b;
  }
  let enabled=true;
  try{ if(/[?&]sfx16=0/.test(location.search)||localStorage.getItem('mv2.sfx16')==='off') enabled=false; }catch(e){}
  AudioNode.prototype.connect=function(dest){
    if(enabled&&dest&&dest instanceof AudioDestinationNode&&!SKIP.has(this)){
      const ac=dest.context;
      if(ac instanceof AudioContext){
        try{ origConnect.call(this,busFor(ac).input); return dest; }catch(e){}
      }
    }
    return origConnect.apply(this,arguments);
  };
  window.MV_SOUND16={ get on(){ return enabled; }, set on(v){ enabled=!!v; try{ localStorage.setItem('mv2.sfx16',v?'on':'off'); }catch(e){} } };
})();
