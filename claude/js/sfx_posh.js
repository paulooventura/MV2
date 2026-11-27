// ============================================================
//  sfx_posh.js — the game's sound effects, re-voiced (Paulo, Oct 20:
//  "more sound FX for everything, less 8-bit, more posh")
//
//  Every sfx('name') the game plays is synthesized here with layered,
//  enveloped voices instead of stepped square waves: soft sine/triangle
//  bodies, filtered noise for air and impacts, FM bells for glass and
//  metal, gentle detune for width, and a short room reverb on a send.
//  The console switch still applies on top (sound16.js voices this output
//  through the SNES / Mega Drive chip when A or B is picked).
//  New sounds: debris, swap, tumble, rope_throw, menu, confirm, gate.
//  Unknown names fall back to the game's original sfx().
// ============================================================
(function(){
  'use strict';
  const orig=window.sfx;
  if(typeof orig!=='function') return;
  const BUS=new WeakMap();
  function ctx(){ try{ return typeof ga==='function'?ga():null; }catch(e){ return null; } }
  const vol=()=>{ try{ return Math.max(0,Math.min(1,(typeof OPT!=='undefined'&&OPT.sfxVol!=null)?OPT.sfxVol:1)); }catch(e){ return 1; } };
  let noiseBuf=null;
  function noise(a){
    if(noiseBuf&&noiseBuf.sampleRate===a.sampleRate) return noiseBuf;
    noiseBuf=a.createBuffer(1,a.sampleRate*1.5,a.sampleRate);
    const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    return noiseBuf;
  }
  // output bus: a little glue compression + a short, warm room on a send
  // build 222: beta_spatial.js may route one sound through its own distance / wall chain
  function bus(a){ return window.MV_SFX_ROUTE||realBus(a); }
  function realBus(a){
    let b=BUS.get(a); if(b) return b;
    const out=a.createGain(); out.gain.value=0.9;
    const comp=a.createDynamicsCompressor(); comp.threshold.value=-14; comp.ratio.value=3; comp.attack.value=0.003; comp.release.value=0.15;
    out.connect(comp); comp.connect(a.destination);
    const rev=a.createConvolver(), len=Math.round(a.sampleRate*1.3), ir=a.createBuffer(2,len,a.sampleRate);
    for(let c=0;c<2;c++){ const d=ir.getChannelData(c); for(let i=0;i<len;i++){ const t=i/len; d[i]=(Math.random()*2-1)*Math.pow(1-t,3.2)*(i<a.sampleRate*0.012?0.3:1); } }
    rev.buffer=ir;
    const lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=5200;
    const wet=a.createGain(); wet.gain.value=0.22;
    rev.connect(lp); lp.connect(wet); wet.connect(comp);
    b={out, send:rev}; BUS.set(a,b); return b;
  }
  // one voice: oscillator → (filter) → envelope → bus (+ reverb send)
  function tone(a,o){
    const B=bus(a), t=a.currentTime+(o.dt||0), d=o.d||0.2, v=(o.v||0.2)*vol();
    const osc=a.createOscillator(); osc.type=o.type||'sine';
    osc.frequency.setValueAtTime(Math.max(20,o.f),t);
    if(o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20,o.f1),t+(o.glide||d));
    if(o.det) osc.detune.value=o.det;
    let node=osc;
    if(o.lp||o.bp||o.hp){
      const f=a.createBiquadFilter(); f.type=o.lp?'lowpass':o.bp?'bandpass':'highpass';
      f.frequency.setValueAtTime(o.lp||o.bp||o.hp,t); if(o.q) f.Q.value=o.q;
      if(o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep,t+d);
      node.connect(f); node=f;
    }
    const g=a.createGain(); const at=o.at||0.006;
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002,v),t+at);
    g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    node.connect(g); g.connect(B.out);
    if(o.rev){ const s=a.createGain(); s.gain.value=o.rev; g.connect(s); s.connect(B.send); }
    if(o.vib){ const l=a.createOscillator(), lg=a.createGain(); l.frequency.value=o.vib; lg.gain.value=o.vibd||12; l.connect(lg); lg.connect(osc.detune); l.start(t); l.stop(t+d+0.05); }
    osc.start(t); osc.stop(t+d+0.05);
  }
  // filtered noise: air, impacts, crumbles
  function hiss(a,o){
    const B=bus(a), t=a.currentTime+(o.dt||0), d=o.d||0.15, v=(o.v||0.15)*vol();
    const src=a.createBufferSource(); src.buffer=noise(a); src.playbackRate.value=o.rate||1;
    const f=a.createBiquadFilter(); f.type=o.type||'bandpass'; f.frequency.setValueAtTime(o.f||1200,t); f.Q.value=o.q||1;
    if(o.f1) f.frequency.exponentialRampToValueAtTime(o.f1,t+d);
    const g=a.createGain(); const at=o.at||0.004;
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002,v),t+at); g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    src.connect(f); f.connect(g); g.connect(B.out);
    if(o.rev){ const s=a.createGain(); s.gain.value=o.rev; g.connect(s); s.connect(B.send); }
    src.start(t,Math.random()*0.8); src.stop(t+d+0.05);
  }
  // FM bell: glass, metal, chimes
  function bell(a,o){
    const B=bus(a), t=a.currentTime+(o.dt||0), d=o.d||0.6, v=(o.v||0.12)*vol();
    const car=a.createOscillator(), mod=a.createOscillator(), mg=a.createGain(), g=a.createGain();
    car.frequency.value=o.f; mod.frequency.value=o.f*(o.ratio||3.5);
    mg.gain.setValueAtTime(o.f*(o.index||2.2),t); mg.gain.exponentialRampToValueAtTime(Math.max(1,o.f*0.05),t+d*0.7);
    mod.connect(mg); mg.connect(car.frequency); car.connect(g);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002,v),t+0.004); g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    g.connect(B.out);
    const s=a.createGain(); s.gain.value=o.rev!=null?o.rev:0.5; g.connect(s); s.connect(B.send);
    car.start(t); mod.start(t); car.stop(t+d+0.05); mod.stop(t+d+0.05);
  }
  const N=n=>440*Math.pow(2,(n-69)/12);
  const rnd=(a,b)=>a+Math.random()*(b-a);

  const R={
    jump(a,p){ p=p||1; tone(a,{f:300*p,f1:620*p,d:0.16,v:0.14,type:'triangle',lp:2600}); tone(a,{f:600*p,f1:1240*p,d:0.12,v:0.05}); hiss(a,{f:2200*p,q:0.8,d:0.08,v:0.05}); },
    jump_spring(a,p){ p=p||1; tone(a,{f:220*p,f1:880*p,d:0.32,v:0.16,type:'triangle',vib:14,vibd:30,rev:0.25}); bell(a,{f:N(84)*p,d:0.4,v:0.05}); hiss(a,{f:3000*p,d:0.1,v:0.05}); },
    // rubber tire landing: a soft low thump with a short rubbery bounce in the pitch (build 226)
    land(a,drive){
      const d=Math.max(0,Math.min(1,typeof drive==='number'?drive:0.35));
      tone(a,{f:98-d*46,f1:32,d:0.1+d*0.16,v:0.14+d*0.28,at:0.002});
      tone(a,{f:170-d*50,f1:46,d:0.07+d*0.08,v:0.05+d*0.18,type:'triangle',lp:800-d*300,at:0.002});
      hiss(a,{type:'lowpass',f:1100-d*500,f1:90,d:0.05+d*0.12,v:0.07+d*0.2,at:0.001});
      if(d>0.4) hiss(a,{f:220+d*180,q:0.7,d:0.045+d*0.03,v:0.05+d*0.12,at:0.001});
      if(d>0.62) tone(a,{f:46,f1:24,d:0.2+d*0.08,v:0.12+d*0.14,type:'sine'});
    },
    // the woofer kicks the air: a sub thump, a pressure whoomp and a rising chirp (double jump)
    double_jump(a){ tone(a,{f:70,f1:120,d:0.18,v:0.28}); hiss(a,{type:'lowpass',f:300,f1:1400,d:0.16,v:0.12}); tone(a,{f:420,f1:980,dt:0.02,d:0.16,v:0.07,type:'triangle',rev:0.3}); },
    // Wheelspin / burnout screech (Paulo, Nov 18). `p` is the tire heat (0..1):
    // hotter = higher, louder, longer and grittier. Two detuned saw voices with a
    // rising glide and a skid wobble sing over a band of bright noise grit and a
    // low rubber body, so it carries over the engine and the music. The bursts
    // overlap at the game's cadence into one sustained, rising squeal.
    tire_squeal(a,p){
      const h=Math.max(0,Math.min(1,typeof p==='number'?p:0.6));
      const d=0.26+0.16*h, f=820+780*h, f1=f*(1.16+0.22*h), bp=1500+1500*h;
      tone(a,{f,f1,glide:d*0.85,d,v:0.085+0.15*h,type:'sawtooth',bp,q:4.5,vib:24+14*h,vibd:20+28*h,at:0.012,rev:0.16});
      tone(a,{f:f*1.006,f1:f1*1.006,glide:d*0.85,d:d*0.96,v:0.045+0.08*h,type:'sawtooth',bp,q:5,at:0.016});
      hiss(a,{f:f*1.7,f1:f*2.8,q:2.2,d:d*0.92,v:0.055+0.1*h,at:0.006,rev:0.12});
      hiss(a,{type:'lowpass',f:380+260*h,d:d*0.7,v:0.04+0.05*h,at:0.006});
    },
    // the wheel's engine: one tiny explosion. drive 0 is the idle putter (low, soft);
    // drive 1 is a faster, higher, sharper pop. The game schedules how often.
    engine_pop(a,drive){
      const d=Math.max(0,Math.min(1,typeof drive==='number'?drive:0));
      const f=58+d*168;
      const at=0.022-d*0.018;
      const v=0.04+d*0.1;
      const dur=0.08-d*0.035;
      tone(a,{f,f1:Math.max(36,f*0.42),d:dur+0.05,v:v*0.85,type:'sine',at,lp:320+d*1100});
      hiss(a,{type:'lowpass',f:220+d*980,f1:90+d*180,d:dur,v,at:Math.max(0.001,at*0.35),q:0.6});
      hiss(a,{f:700+d*1800,q:2.4,d:0.018+d*0.012,v:0.018+d*0.055,at:0.001});
    },
    // punches (Paulo, Oct 20): the swing is a WHOOSH; landing it is a separate thump (beta_impact.js)
    punch(a){ hiss(a,{f:420,f1:1900,q:1.3,d:0.17,v:0.2,at:0.02}); hiss(a,{type:'lowpass',f:700,f1:300,d:0.14,v:0.08,at:0.015}); },
    punch_heavy(a){ hiss(a,{f:140,f1:480,q:1.1,d:0.3,v:0.26,at:0.035,rev:0.12}); hiss(a,{type:'lowpass',f:180,f1:55,d:0.28,v:0.16,at:0.03}); tone(a,{f:58,f1:32,d:0.28,v:0.1,type:'triangle',at:0.04}); },
    punch_hit(a){ tone(a,{f:150,f1:52,d:0.15,v:0.32}); hiss(a,{type:'lowpass',f:2600,f1:380,d:0.09,v:0.26,at:0.001}); tone(a,{f:2600,d:0.015,v:0.08,type:'triangle',hp:1500}); },
    punch_hit_heavy(a){ tone(a,{f:90,f1:28,d:0.34,v:0.4}); tone(a,{f:48,f1:22,d:0.38,v:0.24}); hiss(a,{type:'lowpass',f:1100,f1:140,d:0.18,v:0.28,at:0.001,rev:0.3}); tone(a,{f:420,f1:160,d:0.04,v:0.08,type:'triangle'}); },
    punch_wall(a){ tone(a,{f:105,f1:44,d:0.12,v:0.2}); for(let k=0;k<3;k++) hiss(a,{f:rnd(1500,3500),q:5,dt:0.01+k*0.02,d:0.03,v:0.07}); },
    bed_boing(a){ tone(a,{f:150,f1:330,d:0.28,v:0.14,type:'triangle',vib:11,vibd:40}); tone(a,{f:75,f1:120,d:0.22,v:0.12}); hiss(a,{type:'lowpass',f:500,d:0.08,v:0.06}); },
    // 'ouch' (Paulo, Nov 18): a short, voice-like yelp when a character or foe is hurt.
    // `p` is the pitch multiplier driven by the victim's remaining energy — a low-hp
    // victim sounds distinctly lower. Two detuned formant-ish bodies with a downward
    // glide and a breathy edge read as a little "ow", not a percussive hit, so it
    // layers cleanly beside the existing hit/player_hit thuds.
    ouch(a,p){
      p=Math.max(0.5,Math.min(1.4,typeof p==='number'&&isFinite(p)?p:1));
      const f=520*p, f1=310*p, d=0.21;
      tone(a,{f,f1,d,v:0.16,type:'triangle',lp:2600,vib:22,vibd:26,at:0.006,rev:0.12});
      tone(a,{f:f*1.5,f1:f1*1.5,d:d*0.82,v:0.06,type:'sine',at:0.008});
      tone(a,{f:f*0.5,f1:f1*0.5,d:d*1.1,v:0.07,type:'triangle',lp:900,at:0.006});
      hiss(a,{f:1500*p,f1:700*p,q:1,d:0.09,v:0.05,at:0.004});
    },
    hit(a,p){ tone(a,{f:190*p,f1:60,d:0.16,v:0.22}); hiss(a,{type:'lowpass',f:1800*p,d:0.1,v:0.16}); tone(a,{f:2200,d:0.02,v:0.05,type:'triangle',hp:1500}); },
    hit_enemy(a,p){ R.hit(a,p*1.15); bell(a,{f:420*p,ratio:1.41,index:3,d:0.18,v:0.05,rev:0.2}); },
    player_hit(a,p){ tone(a,{f:150*p,f1:48,d:0.3,v:0.26}); tone(a,{f:340*p,f1:180,d:0.28,v:0.07,type:'triangle'}); tone(a,{f:358*p,f1:190,d:0.28,v:0.06,type:'triangle'}); hiss(a,{type:'lowpass',f:1200,d:0.16,v:0.14}); },
    stomp(a){ tone(a,{f:95,f1:38,d:0.3,v:0.3}); hiss(a,{type:'lowpass',f:500,d:0.22,v:0.2}); },
    hook(a){ hiss(a,{f:900,f1:3200,q:2,d:0.16,v:0.1}); tone(a,{f:900,f1:1700,d:0.12,v:0.04,type:'sawtooth',lp:2400}); },
    hook_charged(a){ R.hook(a); tone(a,{f:300,f1:900,d:0.18,v:0.07,type:'triangle'}); },
    // RCA cord (Paulo, Oct 20): reeling in is a tight ratchet, paying out a looser whirr
    // electrical cage blocks (Paulo, Oct 21): a buzzing crackle, a big one nearly knocks MIND out
    zap(a){ for(const det of [-14,0,14]) tone(a,{f:118,d:0.28,v:0.06,type:'sawtooth',det,lp:3800,vib:55,vibd:60}); for(let k=0;k<9;k++) hiss(a,{type:'highpass',f:rnd(3000,7000),dt:k*rnd(0.015,0.03),d:0.025,v:rnd(0.06,0.13)}); tone(a,{f:900,f1:200,d:0.12,v:0.06,type:'square',lp:2500}); },
    zap_big(a){ R.zap(a); for(const det of [-20,0,20]) tone(a,{f:60,d:0.7,v:0.09,type:'sawtooth',det,lp:2200,sweep:300,vib:40,vibd:80,rev:0.3}); hiss(a,{type:'lowpass',f:5000,f1:300,d:0.6,v:0.18,rev:0.3}); for(let k=0;k<14;k++) hiss(a,{type:'highpass',f:rnd(2500,8000),dt:0.05+k*rnd(0.02,0.05),d:0.03,v:rnd(0.05,0.12)}); tone(a,{f:1600,f1:80,d:0.5,v:0.08,type:'square',lp:3000}); },
    // the wooden item boxes
    wood_hit(a){ tone(a,{f:rnd(180,220),f1:110,d:0.12,v:0.24,type:'triangle'}); tone(a,{f:rnd(420,520),d:0.06,v:0.08,type:'triangle',bp:500,q:3}); hiss(a,{f:1600,q:1.5,d:0.06,v:0.12}); },
    wood_break(a){ tone(a,{f:150,f1:60,d:0.3,v:0.3}); hiss(a,{f:1200,q:0.9,d:0.35,v:0.22,rev:0.2});
      for(let k=0;k<10;k++) hiss(a,{f:rnd(1800,4500),q:5,dt:k*rnd(0.01,0.03),d:0.04,v:rnd(0.06,0.14)});
      for(let k=0;k<5;k++) tone(a,{f:rnd(260,520),f1:rnd(150,220),dt:0.12+k*rnd(0.05,0.1),d:0.07,v:rnd(0.06,0.12),type:'triangle'}); },
    wood_tap(a){ tone(a,{f:rnd(300,380),d:0.05,v:0.07,type:'triangle'}); },
    item_clink(a){ bell(a,{f:rnd(1300,1700),ratio:2.6,index:1.6,d:0.22,v:0.07,rev:0.2}); tone(a,{f:200,f1:120,d:0.06,v:0.06}); },
    // enemies (Paulo, Oct 21): spotting MIND — a sharp rising blip; losing him — a puzzled falling one
    enemy_alert(a){ tone(a,{f:N(76),f1:N(88),d:0.12,v:0.08,type:'square',lp:3000}); bell(a,{f:N(91),dt:0.06,ratio:2,index:1.5,d:0.25,v:0.06}); },
    enemy_huh(a){ tone(a,{f:N(79),f1:N(74),d:0.14,v:0.06,type:'triangle'}); tone(a,{f:N(74),f1:N(81),dt:0.15,d:0.18,v:0.06,type:'triangle'}); },
    // a plug of electro blocks gives way: the water rushes out (Paulo, Oct 21)
    // a TRS shot boiling water off: a hot sizzle and a few pops, then the steam breathing out
    water_boil(a){ hiss(a,{type:'highpass',f:2600,f1:5200,d:0.7,v:0.16,at:0.008,rate:0.9}); hiss(a,{type:'bandpass',f:1400,f1:700,q:0.8,d:1.3,v:0.07,at:0.15,rate:0.5,rev:0.3}); for(let k=0;k<6;k++) tone(a,{f:rnd(1800,3200),f1:rnd(500,900),d:0.03,v:0.05,dt:k*rnd(0.04,0.09),type:'square',hp:900}); },
    water_gush(a){ hiss(a,{type:'lowpass',f:2200,f1:500,d:2.4,v:0.22,at:0.05,rate:0.6,rev:0.35}); hiss(a,{f:900,q:0.7,d:2.0,v:0.12,at:0.1,rate:0.45,rev:0.3}); tone(a,{f:70,f1:45,d:1.2,v:0.14}); for(let k=0;k<10;k++) bell(a,{f:rnd(600,1400),dt:0.1+k*rnd(0.1,0.2),ratio:1.5,index:0.8,d:0.2,v:0.03,rev:0.4}); },
    // RCA reel ratchet (Paulo 2026-11-27): discrete click-click-click, not a muddy loop.
    // Short dry ticks (~12–18 ms); reel-in brighter/higher, reel-out a hair rounder.
    reel_in(a){ const f=rnd(2700,3400); tone(a,{f,f1:f*0.55,d:0.014,v:0.14,type:'square',bp:f,q:5.5,at:0.0005}); hiss(a,{type:'bandpass',f:f*1.05,q:4.2,d:0.01,v:0.09,at:0.0004}); tone(a,{f:f*0.42,d:0.01,v:0.04,type:'triangle',at:0.0005}); },
    reel_out(a){ const f=rnd(2000,2650); tone(a,{f,f1:f*0.62,d:0.017,v:0.12,type:'square',bp:f,q:4.4,at:0.0005}); hiss(a,{type:'bandpass',f:f*0.95,q:3.2,d:0.012,v:0.08,at:0.0004}); tone(a,{f:f*0.38,d:0.012,v:0.035,type:'sine',at:0.0005}); },
    hook_latch_mag(a){ tone(a,{f:95,f1:60,d:0.12,v:0.24}); bell(a,{f:620,ratio:1.41,index:2.5,d:0.25,v:0.08,rev:0.25}); tone(a,{f:110,d:0.4,v:0.05,vib:30,vibd:8,at:0.03}); },
    hook_latch(a){ R.hook_latch_mag(a);  bell(a,{f:1150,ratio:3.7,index:3,d:0.22,v:0.09,rev:0.25}); hiss(a,{type:'highpass',f:3000,d:0.04,v:0.08}); tone(a,{f:160,f1:90,d:0.08,v:0.1}); },
    hook_miss(a){ hiss(a,{f:2400,f1:500,q:1.5,d:0.22,v:0.07}); },
    laser(a,p){ tone(a,{f:1900*p,f1:420*p,d:0.16,v:0.1,type:'sawtooth',lp:7000,sweep:900}); tone(a,{f:950*p,f1:210*p,d:0.16,v:0.07,type:'triangle'}); hiss(a,{type:'highpass',f:4000,d:0.05,v:0.04}); },
    laser_bounce(a){ bell(a,{f:2300+rnd(-200,200),ratio:2.0,index:1.6,d:0.18,v:0.06,rev:0.3}); },
    laser_charge(a,p){ tone(a,{f:380+700*Math.min(1,p||0),d:0.07,v:0.035,lp:3000,rev:0.2}); },
    laser_charged_fire(a,p){ for(const det of [-9,0,9]) tone(a,{f:240*p,f1:120*p,d:0.5,v:0.08,type:'sawtooth',det,lp:5200,sweep:700,rev:0.35}); hiss(a,{f:1500,f1:400,d:0.35,v:0.12}); tone(a,{f:80,f1:40,d:0.35,v:0.2}); },
    xlr(a){ hiss(a,{f:380,f1:1500,q:0.9,d:0.38,v:0.16,at:0.03,rev:0.15}); tone(a,{f:72,f1:52,d:0.32,v:0.12}); },
    xlr_push(a){ hiss(a,{f:500,f1:2200,q:0.8,d:0.32,v:0.2,rev:0.2}); tone(a,{f:110,f1:45,d:0.28,v:0.2}); },
    mag(a){ tone(a,{f:220,f1:330,d:0.3,v:0.08,type:'triangle',vib:9,vibd:20}); tone(a,{f:330,f1:495,d:0.3,v:0.05,vib:7,vibd:16}); bell(a,{f:900,ratio:2.76,index:2,d:0.2,v:0.04}); },
    ping(a){ bell(a,{f:N(88),ratio:3.5,index:1.8,d:0.7,v:0.1}); },
    // Paulo (Nov 18): knowl crystals & seeds one OCTAVE lower — N(n-12) = half the frequency.
    knowl_pickup(a){ [N(72),N(76),N(79),N(84)].forEach((f,i)=>bell(a,{f,dt:i*0.055,ratio:3.0,index:1.4,d:0.8,v:0.08,rev:0.6})); tone(a,{f:N(60),d:0.6,v:0.05,rev:0.4}); },
    knowl_seed(a,p){
      const k=(typeof p==='number'?p:2)*0.5;           // octave lower (was the pitch multiplier)
      const notes=[N(72),N(76),N(79),N(84)];
      const tap=(dt,v)=>notes.forEach((f,i)=>bell(a,{f:f*k,dt:dt+i*0.055,ratio:3.0,index:1.4,d:0.7,v,rev:0.55}));
      const q=0.9;                                    // Paulo (Oct 21): seeds 10% quieter
      tap(0,0.08*q); tap(0.18,0.045*q); tap(0.36,0.024*q); tap(0.54,0.012*q);
      tone(a,{f:N(60)*k,d:0.55,v:0.05*q,rev:0.45});
      tone(a,{f:N(60)*k,dt:0.18,d:0.4,v:0.028*q,rev:0.5});
    },
    frag_fire(a){
      hiss(a,{f:380,f1:2400,q:0.7,d:0.42,v:0.22,rev:0.28});
      hiss(a,{type:'lowpass',f:2200,f1:280,d:0.36,v:0.16});
      tone(a,{f:190,f1:55,d:0.4,v:0.14,type:'sawtooth',lp:900});
      for(let n=0;n<7;n++) hiss(a,{f:rnd(1600,5200),q:4,dt:n*0.028,d:0.045,v:0.08});
      tone(a,{f:rnd(520,860),f1:180,d:0.12,v:0.06,type:'triangle'});
    },
    run_click(a){ tone(a,{f:148,f1:92,d:0.045,v:0.13,type:'square',lp:420}); tone(a,{f:74,d:0.05,v:0.08,type:'triangle'}); },
    // every seed in the stage found (Paulo, Oct 21): a rising sparkle run that blooms into a warm chord
    seeds_all(a){
      [N(72),N(76),N(79),N(84),N(88),N(91),N(96)].forEach((f,i)=>bell(a,{f,dt:i*0.06,ratio:3.0,index:1.3,d:0.9,v:0.07,rev:0.6}));
      [N(60),N(67),N(72),N(76),N(79)].forEach(f=>{ for(const det of [-6,6]) tone(a,{f,dt:0.42,d:2.2,v:0.03,type:'triangle',det,at:0.12,rev:0.8}); });
      bell(a,{f:N(100),dt:0.5,ratio:2,index:0.9,d:1.8,v:0.06,rev:0.9});
      for(let k=0;k<12;k++) hiss(a,{type:'highpass',f:rnd(6500,10000),dt:0.42+k*rnd(0.04,0.09),d:0.05,v:rnd(0.02,0.04),rev:0.6});
    },
    // every crystal found: glassy, higher, with a shimmering tail
    crystals_all(a){
      [N(84),N(91),N(96),N(100),N(103),N(108)].forEach((f,i)=>bell(a,{f,dt:i*0.05,ratio:3.99,index:1.1,d:1.4,v:0.07,rev:0.75}));
      [N(64),N(71),N(76),N(83)].forEach(f=>{ for(const det of [-8,8]) tone(a,{f,dt:0.35,d:2.4,v:0.028,type:'sine',det,at:0.15,rev:0.85,vib:5,vibd:6}); });
      bell(a,{f:N(112),dt:0.4,ratio:2,index:0.7,d:2,v:0.05,rev:0.9});
    },
    // Knowl crystal (Paulo, Oct 21): bright and glassy — a fast shimmering run up, a high ting
    // and an airy sparkle tail; it climbs with each crystal like the seeds do
    crystal_pickup(a,p){ p=(p||1)*0.5;                 // octave lower
      [N(88),N(91),N(95),N(100),N(103)].forEach((f,i)=>bell(a,{f:f*p,dt:i*0.035,ratio:3.99,index:1.1,d:1.1,v:0.075,rev:0.7}));
      bell(a,{f:N(108)*p,dt:0.18,ratio:2.0,index:0.8,d:1.4,v:0.06,rev:0.8});
      for(const det of [-7,7]) tone(a,{f:N(79)*p,dt:0.05,d:1.2,v:0.035,type:'triangle',det,at:0.05,rev:0.6});
      for(let k=0;k<8;k++) hiss(a,{type:'highpass',f:rnd(6000,9500),dt:0.08+k*rnd(0.03,0.07),d:0.05,v:rnd(0.02,0.05),rev:0.5});
    },
    knowl(a){ R.knowl_pickup(a); },
    chargeReady(a){ [N(91),N(95),N(98)].forEach((f,i)=>bell(a,{f,dt:i*0.04,ratio:2.0,index:1.2,d:0.35,v:0.06,rev:0.4})); },
    unlock(a){ [N(72),N(76),N(79),N(84)].forEach((f,i)=>tone(a,{f,dt:i*0.03,d:1.0,v:0.06,type:'triangle',at:0.04,rev:0.5})); bell(a,{f:N(96),dt:0.12,d:1.0,v:0.06}); },
    item_enhanced(a){ [N(67),N(71),N(74),N(79),N(83),N(86)].forEach((f,i)=>bell(a,{f,dt:i*0.05,ratio:3,index:1.5,d:0.7,v:0.06,rev:0.6})); tone(a,{f:N(55),d:1.0,v:0.08,type:'triangle',at:0.05,rev:0.4}); },
    // Paulo (Oct 20): hitting an omni block is a CRUNCH — stone cracking, grit spraying
    omniblock_chip(a){
      tone(a,{f:rnd(150,190),f1:52,d:0.14,v:0.26});                                  // the knock
      hiss(a,{type:'lowpass',f:3400,f1:420,d:0.16,v:0.24,rate:0.6});                  // the crack
      hiss(a,{f:900,q:0.8,d:0.22,v:0.08,dt:0.02,rate:0.45,rev:0.15});                 // grit sliding off
      for(let k=0;k<6;k++) hiss(a,{f:rnd(1300,4800),q:6,dt:0.01+k*rnd(0.012,0.03),d:0.03,v:rnd(0.07,0.13)});
      tone(a,{f:rnd(650,900),d:0.03,v:0.06,type:'triangle',hp:500});
    },
    // T611 (Paulo, Nov 27): punch on a push/pull block — dense metal thud + short ring.
    // Reads as solid / not destroyable; deliberately not the omni crunch or shatter.
    pushblock_clang(a){
      tone(a,{f:rnd(88,108),f1:40,d:0.2,v:0.34});                                    // heavy body
      tone(a,{f:rnd(210,250),f1:85,d:0.09,v:0.18,type:'triangle'});                  // mid knock
      bell(a,{f:rnd(760,900),ratio:1.41,index:1.6,d:0.24,v:0.075,rev:0.28});         // brief metal ring
      tone(a,{f:rnd(1350,1650),d:0.035,v:0.045,type:'triangle',hp:700});             // tip tick
      hiss(a,{type:'lowpass',f:700,f1:160,d:0.07,v:0.05,rate:0.25});                 // soft air only — no grit
    },
    // ... and breaking one CRUSHES: a heavy thud, a roar of rubble, shards raining down
    omniblock_shatter(a){
      tone(a,{f:115,f1:34,d:0.5,v:0.34}); tone(a,{f:58,f1:28,d:0.6,v:0.24});
      hiss(a,{type:'lowpass',f:4200,f1:180,d:0.8,v:0.3,rate:0.7,rev:0.35});
      hiss(a,{f:700,q:0.7,dt:0.05,d:0.6,v:0.14,rate:0.4,rev:0.2});
      for(let k=0;k<16;k++) hiss(a,{f:rnd(1400,6200),q:6,dt:0.02+k*rnd(0.02,0.05),d:0.04,v:rnd(0.05,0.12)});
      for(let k=0;k<4;k++) tone(a,{f:rnd(200,420),f1:rnd(80,140),dt:0.1+k*rnd(0.06,0.12),d:0.08,v:rnd(0.06,0.1)});   // chunks landing
      bell(a,{f:rnd(600,800),ratio:1.53,index:3,d:0.35,v:0.05,rev:0.3});
    },
    debris(a,p){ const k=p||0.5; hiss(a,{f:rnd(2800,5600),q:6,d:0.035,v:0.03+0.05*k}); if(Math.random()<0.4) tone(a,{f:rnd(900,1500),d:0.04,v:0.015,type:'triangle'}); },
    shutdown(a){ tone(a,{f:520,f1:55,d:0.75,v:0.12,type:'sawtooth',lp:3000,sweep:200,rev:0.3}); tone(a,{f:260,f1:30,d:0.8,v:0.1,type:'triangle'}); hiss(a,{type:'lowpass',f:1500,f1:100,d:0.6,v:0.06}); },
    enemy_shut(a,p){ p=p||1; tone(a,{f:420*p,f1:70*p,d:0.4,v:0.1,type:'sawtooth',lp:2600,sweep:300,rev:0.2}); bell(a,{f:300*p,ratio:1.41,index:2,d:0.3,v:0.04}); },
    // permanent shutdown: a long fall that lands and stays down — no chime back
    enemy_dead(a){
      tone(a,{f:240,f1:36,d:0.95,v:0.16,type:'sawtooth',lp:1600,sweep:120,rev:0.4});
      tone(a,{f:120,f1:28,d:1.1,v:0.16,type:'triangle'});
      tone(a,{f:62,f1:26,d:1.15,v:0.18});
      hiss(a,{type:'lowpass',f:800,f1:70,d:0.85,v:0.1,rev:0.3});
      tone(a,{f:78,d:0.12,v:0.14,dt:0.78,type:'square',lp:320});
    },
    // rebooting (Paulo, Oct 21): the permanent-shutdown sound played backwards — every voice
    // swells in and sweeps UP, timed so they all end together, the thunk at the start
    enemy_boot(a){
      tone(a,{f:78,d:0.12,v:0.14,dt:0.25,at:0.1,type:'square',lp:320});
      hiss(a,{type:'lowpass',f:70,f1:800,dt:0.3,d:0.85,at:0.78,v:0.1,rev:0.15});
      tone(a,{f:36,f1:240,glide:0.95,dt:0.2,d:0.95,at:0.88,v:0.16,type:'sawtooth',lp:200,sweep:1600,rev:0.15});
      tone(a,{f:28,f1:120,glide:1.1,dt:0.05,d:1.1,at:1.02,v:0.16,type:'triangle'});
      tone(a,{f:26,f1:62,glide:1.15,dt:0,d:1.15,at:1.08,v:0.18});
    },
    // T572 (Paulo 2026-11-19): F's pellet bubble reaches the surface: a wet "bloop" pop, then a short electric crackle
    bubble_pop(a){
      tone(a,{f:rnd(380,460),f1:rnd(900,1200),glide:0.05,d:0.07,v:0.12,type:'sine',rev:0.2});
      hiss(a,{type:'highpass',f:2600,d:0.05,v:0.09,dt:0.02});
      for(let k=0;k<5;k++) hiss(a,{f:rnd(2400,6000),q:8,dt:0.06+k*rnd(0.02,0.05),d:0.02,v:rnd(0.05,0.1)});
      tone(a,{f:rnd(1800,2600),f1:300,dt:0.07,d:0.12,v:0.05,type:'square',lp:3200});
    },
    ropeSnap(a){ tone(a,{f:640,f1:110,d:0.32,v:0.13,type:'triangle'}); hiss(a,{type:'highpass',f:2500,d:0.06,v:0.12}); },
    hook_off(a){ hiss(a,{type:'highpass',f:2400,d:0.04,v:0.22}); tone(a,{f:780,f1:120,d:0.06,v:0.16,type:'square'}); },
    ropeBreak(a){ R.ropeSnap(a); tone(a,{f:180,f1:70,d:0.2,v:0.1}); },
    ropeSlack(a){ hiss(a,{f:600,f1:300,q:1,d:0.18,v:0.05}); },
    crank(a){ for(let k=0;k<4;k++) hiss(a,{f:2600,q:5,dt:k*0.035,d:0.025,v:0.08}); },
    click(a){ tone(a,{f:1200,d:0.035,v:0.05,type:'triangle'}); },
    grap_attach(a){ R.hook_latch(a); },
    swap(a){ tone(a,{f:N(76),d:0.08,v:0.06,type:'triangle'}); tone(a,{f:N(83),dt:0.06,d:0.12,v:0.06,type:'triangle',rev:0.3}); },
    tumble(a){ tone(a,{f:150,f1:70,d:0.16,v:0.14}); hiss(a,{type:'lowpass',f:700,d:0.1,v:0.08}); },
    // T617 (Paulo, Nov 27): objects falling / landing — dense thud scaled by impact (0..~1.3).
    // Distinct from omniblock_chip (hit/crunch) and shatter (destroy).
    object_land(a,p){
      const k=Math.max(0.15,Math.min(1.35,typeof p==='number'?p:0.55));
      tone(a,{f:68+k*22,f1:26,d:0.11+k*0.16,v:0.15+k*0.24,at:0.002});                 // body thud
      tone(a,{f:150+k*50,f1:50,d:0.06+k*0.07,v:0.07+k*0.1,type:'triangle',lp:900});    // mid knock
      hiss(a,{type:'lowpass',f:980-k*220,f1:110,d:0.07+k*0.1,v:0.07+k*0.14,at:0.001}); // grit settle
      if(k>0.5) tone(a,{f:36,f1:20,d:0.16+k*0.12,v:0.09+k*0.1});                        // heavy sub
      if(k>0.32) hiss(a,{f:rnd(420,880),q:1.4,dt:0.015,d:0.035,v:0.035+k*0.05});
    },
    // Objects tumbling / tipping / scraping while they stumble around.
    object_stumble(a,p){
      const k=Math.max(0.15,Math.min(1.2,typeof p==='number'?p:0.5));
      tone(a,{f:rnd(105,145),f1:55,d:0.07+k*0.07,v:0.1+k*0.12,at:0.002});
      tone(a,{f:rnd(210,310),d:0.045,v:0.045+k*0.05,type:'triangle',dt:0.018,hp:180});
      hiss(a,{type:'lowpass',f:1500,f1:280,d:0.09+k*0.07,v:0.06+k*0.09,rate:0.55});
      if(k>0.38) tone(a,{f:rnd(75,115),d:0.055,v:0.07+k*0.05,dt:0.045});               // second bump
      if(k>0.55) hiss(a,{f:rnd(600,1200),q:2,dt:0.06,d:0.03,v:0.04});
    },
    rope_throw(a){ hiss(a,{f:700,f1:2600,q:1.6,d:0.2,v:0.08}); },
    menu(a){ tone(a,{f:N(81),d:0.06,v:0.05,type:'triangle'}); },
    sfx_menu(a){ tone(a,{f:N(84),d:0.07,v:0.055,type:'triangle'}); bell(a,{f:N(91),ratio:2,index:1,d:0.16,v:0.035,rev:0.25}); },
    confirm(a){ bell(a,{f:N(88),ratio:2,index:1.2,d:0.35,v:0.07}); tone(a,{f:N(76),d:0.25,v:0.05,type:'triangle'}); },
    // Synth layer (Paulo 2026-11-20): these game voices had no sound at all.
    blowoff(a){ hiss(a,{type:'bandpass',f:1500,f1:420,q:1.2,d:0.24,v:0.13}); tone(a,{f:230,f1:90,d:0.16,v:0.06,type:'triangle'}); },
    splash(a){ hiss(a,{type:'highpass',f:3400,f1:900,d:0.34,v:0.12,rev:0.2}); hiss(a,{type:'lowpass',f:1100,d:0.22,v:0.07,at:0.02});
      [0.05,0.13,0.22].forEach((dt,i)=>tone(a,{f:340+i*130,f1:150+i*60,dt,d:0.13,v:0.045,type:'sine'})); },
    sport_ignition(a){ tone(a,{f:170,f1:1500,d:0.5,v:0.12,type:'sawtooth',lp:3200,rev:0.3});
      hiss(a,{f:700,f1:4200,d:0.42,v:0.07,at:0.05}); bell(a,{f:N(79),d:0.3,v:0.05,rev:0.4}); },
    sport_off(a){ tone(a,{f:950,f1:120,d:0.46,v:0.1,type:'triangle',rev:0.25});
      hiss(a,{type:'lowpass',f:2600,f1:500,d:0.38,v:0.05,at:0.01}); },
    gate(a){ [N(60),N(67),N(72),N(76)].forEach((f,i)=>tone(a,{f,dt:i*0.08,d:1.6,v:0.06,type:'triangle',at:0.08,rev:0.7})); },
    jump_reg(a,p){ R.jump(a,p); }, jump_good(a,p){ R.jump_spring(a,p); }, hurt(a,p){ R.player_hit(a,p); },
    // Dump line 87 — knowl seeds falling on the floor get a glass-like tap.
    // Bright, inharmonic FM partials with a very short, subtle decay; never a
    // chime (that would steal the pickup's thunder). 'knowl_glass' is an alias.
    glass_tap(a,p){
      const k=(typeof p==='number'&&p>0&&isFinite(p))?p:1;
      const r=()=>rnd(0.97,1.03);
      bell(a,{f:2100*k*r(),ratio:2.7,index:1.1,d:0.16,v:0.055,rev:0.22});
      bell(a,{f:3180*k*r(),ratio:3.9,index:0.7,d:0.11,v:0.032,rev:0.18});
      bell(a,{f:4700*k*r(),ratio:2.0,index:0.5,d:0.07,v:0.018,rev:0.12});
      hiss(a,{type:'highpass',f:5200,d:0.028,v:0.025,at:0.001});
    },
    knowl_glass(a,p){ R.glass_tap(a,p); }
  };
  // ── SFX packs (dump line 81) ───────────────────────────────────
  // A "pack" is a plain map of sfx name → voice(a,p) that OVERRIDES R[name].
  // MV_SFX.pack is that registry; the selected pack comes from OPT.sfxPack
  // (persisted in save.js, cycled from Options in ui.js).
  //   original : {}  → the EXACT current behaviour; every name still uses R.
  //   meme     : real meme WAVs (jump→boing, hit→metal pipe/impact, hurt→"ow",
  //              pickup→ding, item attach→click, menu→blip, enemy→mocking laugh,
  //              death→sad trombone, boss→vine boom, turbo→whoosh, miss→scratch).
  //              Sources + licences are in assets/SFX/meme/CREDITS.md.
  //
  // HOW THE REAL MEME WAVs WORK
  // Files live at  claude/assets/SFX/meme/<name>.wav   (served at runtime as
  // assets/SFX/meme/<name>.wav).  <name> is the voice's own name below, e.g.
  // "boing", "wah", "squeak", "trombone", "vineboom". On the first play after
  // adding a file the placeholder still fires while the <audio> buffers; every
  // play after that uses the wav, scaled by OPT.sfxVol with arguments[1] (when a
  // number) as playbackRate. A missing/broken file just keeps the synthesized
  // placeholder — the game never reaches out to the network. To add a new
  // overridable name, add a placeholder fn to pack.meme; registerWav(name, path)
  // can point a name at a custom path if it can't follow <name>.wav.
  // ───────────────────────────────────────────────────────────────
  const _packOrder=['original','meme'];
  const _wavBase='assets/SFX/meme/';
  const _memeWavPath={};
  const _memeWavPool={}, _memeWavFailed={};
  function _packName(){
    try{ const n=(typeof OPT!=='undefined'&&OPT)?OPT.sfxPack:null; return _packOrder.indexOf(n)>=0?n:'original'; }catch(e){ return 'original'; }
  }
  function _playPackWav(name,p){
    if(_memeWavFailed[name]) return false;
    const path=_memeWavPath[name]||(_wavBase+name+'.wav');
    let el=_memeWavPool[name];
    if(!el){
      el=new Audio(); el.preload='auto'; el.src=path;
      el.addEventListener('error',()=>{ _memeWavFailed[name]=true; },{once:true});
      el.load(); _memeWavPool[name]=el;
    }
    if(el.readyState<2) return false;                 // not buffered yet → placeholder plays
    try{
      const inst=el.cloneNode();
      inst.volume=vol();
      inst.playbackRate=Math.max(0.45,Math.min(1.6,(typeof p==='number'&&p>0)?p:1));
      const pr=inst.play(); if(pr) pr.catch(()=>{});
      return true;
    }catch(e){ _memeWavFailed[name]=true; return false; }
  }
  // Clearly-labelled SYNTHESIZED placeholder meme-ish sounds — no external assets.
  function _memeBoing(a,p){ p=p||1;
    tone(a,{f:120*p,f1:540*p,d:0.34,v:0.18,type:'triangle',vib:18,vibd:64,rev:0.2});
    tone(a,{f:60*p,f1:270*p,d:0.3,v:0.11});
    bell(a,{f:N(84)*p,ratio:2.4,index:1.4,d:0.24,v:0.05,rev:0.3});
  }
  function _memeWah(a,p){ p=p||1; const f=700*p;
    tone(a,{f,f1:f*0.42,d:0.42,v:0.15,type:'sawtooth',lp:1900,sweep:620,rev:0.15});
    tone(a,{f:f*0.5,f1:f*0.21,d:0.42,v:0.085,type:'triangle',lp:900});
    hiss(a,{f:1000*p,f1:430*p,q:1.2,d:0.28,v:0.055});
  }
  function _memeSqueak(a,p){ p=p||1; const f=1850*p;
    tone(a,{f,f1:f*1.7,d:0.16,v:0.1,type:'sawtooth',bp:f,q:5,vib:42,vibd:75,rev:0.15});
    tone(a,{f:f*1.01,f1:f*1.72,d:0.14,v:0.05,type:'triangle',bp:f*1.05,q:6});
    hiss(a,{f:4300,q:6,d:0.075,v:0.045});
  }
  // context placeholders for the real WAVs below — never heard unless a file is missing
  function _memePipe(a,p){ p=p||1; tone(a,{f:150*p,f1:45,d:0.3,v:0.24}); hiss(a,{f:1900,f1:320,q:1,d:0.22,v:0.18}); }
  function _memeOw(a,p){ p=p||1; tone(a,{f:640*p,f1:330*p,d:0.2,v:0.16,type:'triangle',lp:2600,vib:26,vibd:44}); }
  function _memeDing(a,p){ p=p||1; bell(a,{f:N(93)*p,d:0.7,v:0.1}); bell(a,{f:N(100)*p,dt:0.06,d:0.6,v:0.05,rev:0.6}); }
  function _memeClick(a,p){ p=p||1; tone(a,{f:1300*p,d:0.03,v:0.08,type:'triangle'}); hiss(a,{f:2800,q:4,d:0.02,v:0.05}); }
  function _memeBlip(a,p){ p=p||1; tone(a,{f:N(85)*p,d:0.06,v:0.05,type:'square',lp:3000}); }
  function _memeLaugh(a,p){ p=p||1; for(let k=0;k<3;k++) tone(a,{f:(300-k*30)*p,f1:(240-k*26)*p,dt:k*0.17,d:0.14,v:0.09,type:'triangle',lp:1700,vib:28,vibd:44,rev:0.12}); }
  function _memeTrombone(a,p){ p=p||1; [233,196,165,147].forEach((f,k)=>tone(a,{f:f*p,f1:f*0.9*p,dt:k*0.18,d:0.22,v:0.11,type:'sawtooth',lp:900,rev:0.25})); }
  function _memeImpact(a,p){ p=p||1; tone(a,{f:90*p,f1:28,d:0.3,v:0.3}); hiss(a,{type:'lowpass',f:1400,f1:160,d:0.24,v:0.2,rev:0.2}); }
  function _memeVineboom(a,p){ p=p||1; tone(a,{f:60*p,f1:26,d:0.6,v:0.34}); hiss(a,{type:'lowpass',f:700,f1:90,d:0.45,v:0.2,rev:0.3}); tone(a,{f:120*p,f1:40,d:0.4,v:0.12,type:'sawtooth',lp:500}); }
  function _memeWhoosh(a,p){ p=p||1; hiss(a,{f:500*p,f1:2400*p,q:1.2,d:0.26,v:0.16,at:0.02,rev:0.15}); }
  function _memeScratch(a,p){ p=p||1; hiss(a,{f:2600,f1:900,q:3,d:0.22,v:0.13,rate:0.6}); tone(a,{f:800*p,f1:300*p,d:0.18,v:0.05,type:'square',lp:2200}); }
  const _withWav=(name,fn)=>function(a,p){
    const d=window.MV_SFX.debug; d.voices[name]=(d.voices[name]||0)+1;   // render telemetry
    if(_playPackWav(name,p)) return; fn(a,p);
  };
  const _boing=_withWav('boing',_memeBoing), _wah=_withWav('wah',_memeWah), _squeak=_withWav('squeak',_memeSqueak);
  const _pipe=_withWav('pipe',_memePipe), _ow=_withWav('ow',_memeOw), _ding=_withWav('ding',_memeDing),
        _click=_withWav('click',_memeClick), _blip=_withWav('blip',_memeBlip), _laugh=_withWav('laugh',_memeLaugh),
        _trombone=_withWav('trombone',_memeTrombone), _impact=_withWav('impact',_memeImpact),
        _vineboom=_withWav('vineboom',_memeVineboom), _whoosh=_withWav('whoosh',_memeWhoosh),
        _scratch=_withWav('scratch',_memeScratch);

  window.MV_SFX={
    pack:{
      original:{},                       // empty = the exact current SFX
      meme:{                             // real WAVs; context-matched to what happens in the game
        // jump / land → boing
        jump:_boing, jump_reg:_boing, jump_spring:_boing, jump_good:_boing, double_jump:_boing, land:_boing, bed_boing:_boing,
        // hit / hurt / punch → rubber squeak, metal-pipe hit, "ow!" or a heavy impact
        punch:_squeak, punch_heavy:_squeak, ouch:_squeak,
        hit:_pipe, punch_hit:_pipe,
        hit_enemy:_impact, punch_hit_heavy:_impact,
        hurt:_ow, player_hit:_ow,
        // pickup → ding
        knowl_pickup:_ding, crystal_pickup:_ding, knowl:_ding, item_clink:_ding, ping:_ding, extra_life:_ding, unlock:_ding,
        // item attach / latch → click (reel stays on crisp synth — click.wav muddies the ratchet train)
        grap_attach:_click, hook_latch:_click, click:_click, swap:_click, confirm:_click,
        // menu → blip
        menu:_blip,
        // enemy mock → mocking laugh
        enemy_alert:_laugh, enemy_huh:_laugh,
        // death / shutdown → sad trombone (permanent) / wah (temporary)
        shutdown:_trombone, enemy_dead:_trombone, enemy_shut:_wah,
        // boss hit → impact / vine boom
        laser_charged_fire:_vineboom, frag_fire:_vineboom, omniblock_shatter:_vineboom,
        // rev / turbo → whoosh ; a miss scratches the record
        whoosh:_whoosh, rope_throw:_whoosh, punch_whiff:_whoosh, hook_miss:_scratch
      }
    },
    order:_packOrder.slice(),
    get current(){ return _packName(); },
    name(){ return _packName(); },
    setPack(n){ if(_packOrder.indexOf(n)<0) return false; try{ if(typeof OPT!=='undefined'&&OPT) OPT.sfxPack=n; }catch(e){} try{ _saveOpts(); }catch(e){} return true; },
    cyclePack(dir){ const L=_packOrder, i=Math.max(0,L.indexOf(_packName())); return this.setPack(L[(i+(dir<0?L.length-1:1))%L.length]); },
    registerWav(name,path){ if(!name) return; if(path) _memeWavPath[name]=path; else delete _memeWavPath[name]; delete _memeWavPool[name]; delete _memeWavFailed[name]; },
    debug:{last:null,source:null,pack:null,calls:0,rendered:0,voices:{}}
  };

  let lastAt={};
  window.sfx=function(t){
    if(typeof _audioUnlocked!=='undefined'&&!_audioUnlocked) return;
    // MV2 SFX Studio (Paulo): a local replacement bypasses the generated voice
    // and goes to the original dispatcher, which plays the uploaded file.
    if(typeof window.MV_SFX_REPLACEMENTS!=='undefined'&&window.MV_SFX_REPLACEMENTS[t]) return orig.apply(this,arguments);
    const pack=_packName(), po=window.MV_SFX.pack[pack]||{};
    const ov=(typeof po[t]==='function')?po[t]:null;
    const r=ov||R[t]; if(!r) return orig.apply(this,arguments);
    // routing telemetry (used by the headless pack / glass probes)
    try{ const d=window.MV_SFX.debug; d.last=t; d.source=ov?'pack':'original'; d.pack=pack; d.calls++; }catch(e){}
    const a=ctx(); if(!a) return;
    if(a.state!=='running') try{ a.resume(); }catch(e){}
    const now=a.currentTime;
    // reel ratchet needs ~12–20 ms spacing; other SFX keep the 25 ms anti-machine-gun gate
    const gate=(t==='reel_in'||t==='reel_out')?0.012:0.025;
    if(lastAt[t]&&now-lastAt[t]<gate) return; lastAt[t]=now;
    const p=typeof arguments[1]==='number'?arguments[1]:1;
    try{ r(a,p); }catch(e){ return orig.apply(this,arguments); }
    try{ window.MV_SFX.debug.rendered++; }catch(e){}
  };
  window.MV_SFX_POSH={names:Object.keys(R), bus:realBus};

  // Dump line 87 — global hook for the seed-landing glass tap. The lead calls
  // MV_KNOWL_GLASS() when a knowl seed hits the floor (the report gives the exact
  // line). It goes through the pack-aware sfx() so the meme filter can override it.
  window.MV_KNOWL_GLASS=function(p){ try{ sfx('glass_tap',(typeof p==='number')?p:1); }catch(e){} };

  // ── Sustained machine voices (Paulo, Nov 18) ────────────────
  // "When it's screeching for longer it's like schreeeeench." A skid and an
  // engine are CONTINUOUS objects: build one fixed graph, steer it smoothly,
  // fade it out on release. No fr%7 retrigger and no 5-16 Hz click train.
  const clamp01=v=>Math.max(0,Math.min(1,v));
  const setP=(p,v,tc,t)=>{ try{ p.setTargetAtTime(v,t,tc); }catch(e){} };

  // Tire: 2 detuned saws (the sing) + looping band-passed noise (the grit) +
  // a low triangle body (rubber). One slow wobble LFO and a slow random drift
  // make it waver like real rubber instead of looping like a synth. The voice
  // rises a little the longer it runs and scales with `_tireHeat`.
  const SC={a:null,v:null,on:false,t0:0,drift:0,ph:0};
  function _scBuild(a,heat,solid){
    const B=bus(a), t=a.currentTime, h=clamp01(heat);
    const master=a.createGain(); master.gain.value=0.0001;
    master.connect(B.out);
    const send=a.createGain(); send.gain.value=0.14; master.connect(send); send.connect(B.send);
    const s1=a.createOscillator(), s2=a.createOscillator(); s1.type=s2.type='sawtooth';
    const bp=a.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=4.2;
    const sg=a.createGain(); sg.gain.value=0.10+0.10*h;
    s1.connect(bp); s2.connect(bp); bp.connect(sg); sg.connect(master);
    const gritSrc=a.createBufferSource(); gritSrc.buffer=noise(a); gritSrc.loop=true;
    const grit=a.createBiquadFilter(); grit.type='bandpass'; grit.Q.value=solid?2.4:1.6;
    const gg=a.createGain(); gg.gain.value=(solid?0.05:0.035)+0.07*h;
    gritSrc.connect(grit); grit.connect(gg); gg.connect(master);
    const body=a.createOscillator(); body.type='triangle';
    const bg=a.createGain(); bg.gain.value=0.08+0.07*h;
    body.connect(bg); bg.connect(master);
    const lfo=a.createOscillator(); lfo.frequency.value=0.6+Math.random()*0.7;
    const ld=a.createGain(); ld.gain.value=20+12*h;                 // detune wobble
    lfo.connect(ld); ld.connect(s1.detune); ld.connect(s2.detune);
    const lf=a.createGain(); lf.gain.value=90+130*h;                // filter wobble
    lfo.connect(lf); lf.connect(grit.frequency);
    const ph=Math.random()*6.28;
    for(const o of [s1,s2,body,gritSrc,lfo]) o.start(t);
    return {master,send,s1,s2,bp,sg,gritSrc,grit,gg,body,bg,lfo,ld,lf,ph};
  }
  function _scStart(heat,solid){
    const a=ctx(); if(!a) return;
    if(SC.a!==a){ SC.a=a; SC.v=null; SC.on=false; }
    if(!SC.v){ SC.v=_scBuild(a,heat,solid!==false); SC.t0=a.currentTime; SC.drift=0; SC.ph=SC.v.ph; }
    SC.on=true;
    const t=a.currentTime, g=SC.v.master.gain;
    try{ g.cancelScheduledValues(t); g.setValueAtTime(Math.max(0.0001,g.value),t); g.linearRampToValueAtTime(0.95,t+0.05); }catch(e){}
    _scSet(heat,solid);
  }
  function _scSet(heat,solid){
    const v=SC.v; if(!v||!SC.on) return;
    const a=SC.a, t=a.currentTime, h=clamp01(heat), s=solid!==false;
    const run=clamp01((t-SC.t0)/4);
    // slow random walk, kept small — organic waver, never a jump
    SC.drift=Math.max(-0.12,Math.min(0.12,SC.drift+(Math.random()-0.5)*0.03));
    const f=(780+860*h)*(1+0.11*run+SC.drift)*(s?1:0.82);
    setP(v.s1.frequency,f,0.06,t); setP(v.s2.frequency,f*1.006,0.06,t);
    setP(v.bp.frequency,(1400+1500*h+280*run)*(s?1:0.75),0.08,t);
    setP(v.grit.frequency,f*1.65+300*run,0.08,t);
    setP(v.body.frequency,96+80*h+18*run,0.12,t);
    setP(v.sg.gain,0.10+0.10*h,0.08,t);
    setP(v.gg.gain,(s?0.05:0.035)+0.07*h,0.08,t);
    setP(v.bg.gain,0.08+0.07*h,0.1,t);
    setP(v.lfo.frequency,0.6+0.7*h+0.25*Math.sin(t*0.7+SC.ph),0.2,t);
  }
  function _scStop(){
    if(!SC.on||!SC.v) return;
    SC.on=false;
    const a=SC.a,t=a.currentTime,v=SC.v;
    try{
      const g=v.master.gain; g.cancelScheduledValues(t); g.setValueAtTime(Math.max(0.0001,g.value),t);
      g.linearRampToValueAtTime(0.0001,t+0.18);
      for(const o of [v.s1,v.s2,v.body,v.gritSrc,v.lfo]) o.stop(t+0.22);
    }catch(e){}
    SC.v=null; SC.drift=0;
  }

  // Engine: a low machine rumble that follows rpm/throttle smoothly — two
  // detuned saws + a sine sub under a low-pass, with a whisper of noise that
  // is only gently amplitude-rippled (texture, NOT a combustion click track).
  const EN={a:null,v:null};
  function _enBuild(a){
    const t=a.currentTime, B=bus(a);
    const master=a.createGain(); master.gain.value=0.0001; master.connect(B.out);
    const o1=a.createOscillator(),o2=a.createOscillator(),sub=a.createOscillator();
    o1.type=o2.type='sawtooth'; sub.type='sine';
    const lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=260; lp.Q.value=0.9;
    const rg=a.createGain(); rg.gain.value=0.10;
    o1.connect(lp); o2.connect(lp); sub.connect(lp); lp.connect(rg); rg.connect(master);
    const ns=a.createBufferSource(); ns.buffer=noise(a); ns.loop=true;
    const bp=a.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=420; bp.Q.value=1.1;
    const ripple=a.createGain(); ripple.gain.value=0.9;
    const lfo=a.createOscillator(); lfo.type='sine'; lfo.frequency.value=5;
    const lg=a.createGain(); lg.gain.value=0.1; lfo.connect(lg); lg.connect(ripple.gain);
    const ng=a.createGain(); ng.gain.value=0.03;
    ns.connect(bp); bp.connect(ripple); ripple.connect(ng); ng.connect(master);
    for(const o of [o1,o2,sub,ns,lfo]) o.start(t);
    return {master,o1,o2,sub,lp,rg,ns,bp,ripple,lfo,lg,ng};
  }
  function _enSet(drive,on){
    const a=ctx(); if(!a) return;
    if(EN.a!==a){ EN.a=a; EN.v=null; }
    const d=clamp01(drive||0), want=!!on;
    if(want&&!EN.v) EN.v=_enBuild(a);
    const v=EN.v; if(!v) return;
    const t=a.currentTime, f=44+118*d;
    setP(v.o1.frequency,f,0.08,t); setP(v.o2.frequency,f*1.008,0.08,t); setP(v.sub.frequency,f*0.5,0.1,t);
    setP(v.lp.frequency,240+680*d,0.08,t);
    setP(v.rg.gain,0.09+0.11*d,0.08,t);
    setP(v.bp.frequency,380+900*d,0.08,t);
    setP(v.ng.gain,0.02+0.04*d,0.08,t);
    setP(v.lfo.frequency,4+11*d,0.12,t); setP(v.lg.gain,0.08+0.05*d,0.12,t);
    setP(v.master.gain,want?(0.10+0.46*d)*vol():0.0001,want?0.09:0.24,t);
  }
  function _enStop(){ if(EN.v){ const a=EN.a||ctx(); if(a) setP(EN.v.master.gain,0.0001,0.2,a.currentTime); } }

  window.MV_SFX_POSH.tire={start:_scStart,set:_scSet,stop:_scStop};
  window.MV_SFX_POSH.engine={set:_enSet,stop:_enStop};

  // Fallback driver for builds without beta_engine.js (which owns the real
  // worklet + rev gating and normally drives engine.set itself). It used to
  // schedule engine_pop one-shots at 5-16 Hz — a click train. Now it just
  // steers the sustained layer with the same idle / 3s-cut / ground rules.
  let _engOn=true, _engIdle=0;
  function _engineTick(){
    if(typeof _gameState==='undefined'||_gameState!=='game'||typeof p==='undefined'||!p){ _enSet(0,false); return; }
    if(typeof _paused!=='undefined'&&_paused){ _enSet(0,false); return; }
    if(typeof _shutdownTimer!=='undefined'&&_shutdownTimer>0){ _enSet(0,false); return; }
    const dir=typeof _moveInputX==='function'?_moveInputX():0;
    const top=typeof MOVE_RUN==='number'?MOVE_RUN:12.4;
    const spd=Math.max(0,Math.min(1,Math.abs(p.vx||0)/top));
    const grounded=(typeof _playerOnGround==='function'?!!_playerOnGround(p):!!p.og)&&!(p.hook&&p.hook.st==='on');
    if(dir){ _engOn=true; _engIdle=0; }
    else if(grounded&&spd<0.06){ if(++_engIdle>=180) _engOn=false; }
    else _engIdle=0;
    const sprint=typeof isSprintHeld==='function'&&isSprintHeld()&&dir;
    const torque=dir?Math.min(1,0.28+(sprint?0.42:0.12)+((p.runRamp||0)*0.3)):0;
    const drive=clamp01(Math.max(spd,torque));
    const rev=grounded?drive:0;                 // no rev in the air or on a rope (committed engine fix)
    _enSet(rev,_engOn);
  }
  window.MV_ENGINE={tick:_engineTick};

  // a few more moments that deserve a sound
  window.addEventListener('load',()=>{
    const wrap=(name,fn)=>{ const o=window[name]; if(typeof o!=='function'||o._poshSfx) return; const w=function(){ const r=o.apply(this,arguments); try{ fn.apply(this,arguments); }catch(e){} return r; }; w._poshSfx=true; window[name]=w; };
    wrap('_cycleItem',()=>sfx('swap'));
  });
})();
