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
  function bus(a){
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
    land(a){ tone(a,{f:130,f1:55,d:0.14,v:0.2}); hiss(a,{type:'lowpass',f:900,d:0.09,v:0.1}); },
    // punches (Paulo, Oct 20): the swing is a WHOOSH; landing it is a separate thump (beta_impact.js)
    punch(a){ hiss(a,{f:420,f1:1900,q:1.3,d:0.17,v:0.2,at:0.02}); hiss(a,{type:'lowpass',f:700,f1:300,d:0.14,v:0.08,at:0.015}); },
    punch_heavy(a){ hiss(a,{f:260,f1:1500,q:1.1,d:0.3,v:0.26,at:0.035,rev:0.12}); hiss(a,{type:'lowpass',f:500,f1:160,d:0.28,v:0.14,at:0.03}); tone(a,{f:90,f1:150,d:0.25,v:0.06,type:'triangle',at:0.05}); },
    punch_hit(a){ tone(a,{f:150,f1:52,d:0.15,v:0.32}); hiss(a,{type:'lowpass',f:2600,f1:380,d:0.09,v:0.26,at:0.001}); tone(a,{f:2600,d:0.015,v:0.08,type:'triangle',hp:1500}); },
    punch_hit_heavy(a){ tone(a,{f:120,f1:36,d:0.34,v:0.38}); tone(a,{f:62,f1:30,d:0.38,v:0.22}); hiss(a,{type:'lowpass',f:3200,f1:260,d:0.18,v:0.32,at:0.001,rev:0.3}); tone(a,{f:2200,d:0.02,v:0.1,type:'triangle',hp:1400}); },
    punch_wall(a){ tone(a,{f:105,f1:44,d:0.12,v:0.2}); for(let k=0;k<3;k++) hiss(a,{f:rnd(1500,3500),q:5,dt:0.01+k*0.02,d:0.03,v:0.07}); },
    bed_boing(a){ tone(a,{f:150,f1:330,d:0.28,v:0.14,type:'triangle',vib:11,vibd:40}); tone(a,{f:75,f1:120,d:0.22,v:0.12}); hiss(a,{type:'lowpass',f:500,d:0.08,v:0.06}); },
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
    reel_in(a){ tone(a,{f:rnd(1700,1900),d:0.018,v:0.07,type:'triangle',hp:900}); hiss(a,{f:3200,q:5,d:0.02,v:0.06}); tone(a,{f:180,f1:150,d:0.05,v:0.05,type:'sawtooth',lp:900}); },
    reel_out(a){ tone(a,{f:rnd(900,1050),d:0.02,v:0.045,type:'triangle',hp:500}); hiss(a,{f:1400,q:2,d:0.06,v:0.05}); },
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
    knowl_pickup(a){ [N(84),N(88),N(91),N(96)].forEach((f,i)=>bell(a,{f,dt:i*0.055,ratio:3.0,index:1.4,d:0.8,v:0.08,rev:0.6})); tone(a,{f:N(72),d:0.6,v:0.05,rev:0.4}); },
    knowl_seed(a,p){
      const k=typeof p==='number'?p:2;
      const notes=[N(84),N(88),N(91),N(96)];
      const tap=(dt,v)=>notes.forEach((f,i)=>bell(a,{f:f*k,dt:dt+i*0.055,ratio:3.0,index:1.4,d:0.7,v,rev:0.55}));
      const q=0.9;                                    // Paulo (Oct 21): seeds 10% quieter
      tap(0,0.08*q); tap(0.18,0.045*q); tap(0.36,0.024*q); tap(0.54,0.012*q);
      tone(a,{f:N(72)*k,d:0.55,v:0.05*q,rev:0.45});
      tone(a,{f:N(72)*k,dt:0.18,d:0.4,v:0.028*q,rev:0.5});
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
    crystal_pickup(a,p){ p=p||1;
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
    ropeSnap(a){ tone(a,{f:640,f1:110,d:0.32,v:0.13,type:'triangle'}); hiss(a,{type:'highpass',f:2500,d:0.06,v:0.12}); },
    ropeBreak(a){ R.ropeSnap(a); tone(a,{f:180,f1:70,d:0.2,v:0.1}); },
    ropeSlack(a){ hiss(a,{f:600,f1:300,q:1,d:0.18,v:0.05}); },
    crank(a){ for(let k=0;k<4;k++) hiss(a,{f:2600,q:5,dt:k*0.035,d:0.025,v:0.08}); },
    click(a){ tone(a,{f:1200,d:0.035,v:0.05,type:'triangle'}); },
    grap_attach(a){ R.hook_latch(a); },
    swap(a){ tone(a,{f:N(76),d:0.08,v:0.06,type:'triangle'}); tone(a,{f:N(83),dt:0.06,d:0.12,v:0.06,type:'triangle',rev:0.3}); },
    tumble(a){ tone(a,{f:150,f1:70,d:0.16,v:0.14}); hiss(a,{type:'lowpass',f:700,d:0.1,v:0.08}); },
    rope_throw(a){ hiss(a,{f:700,f1:2600,q:1.6,d:0.2,v:0.08}); },
    menu(a){ tone(a,{f:N(81),d:0.06,v:0.05,type:'triangle'}); },
    confirm(a){ bell(a,{f:N(88),ratio:2,index:1.2,d:0.35,v:0.07}); tone(a,{f:N(76),d:0.25,v:0.05,type:'triangle'}); },
    gate(a){ [N(60),N(67),N(72),N(76)].forEach((f,i)=>tone(a,{f,dt:i*0.08,d:1.6,v:0.06,type:'triangle',at:0.08,rev:0.7})); },
    jump_reg(a,p){ R.jump(a,p); }, jump_good(a,p){ R.jump_spring(a,p); }, hurt(a,p){ R.player_hit(a,p); }
  };
  let lastAt={};
  window.sfx=function(t){
    if(typeof _audioUnlocked!=='undefined'&&!_audioUnlocked) return;
    const r=R[t]; if(!r) return orig.apply(this,arguments);
    const a=ctx(); if(!a) return;
    if(a.state!=='running') try{ a.resume(); }catch(e){}
    const now=a.currentTime; if(lastAt[t]&&now-lastAt[t]<0.025) return; lastAt[t]=now;   // no machine-gunning
    const p=typeof arguments[1]==='number'?arguments[1]:1;
    try{ r(a,p); }catch(e){ return orig.apply(this,arguments); }
  };
  window.MV_SFX_POSH={names:Object.keys(R)};

  // a few more moments that deserve a sound
  window.addEventListener('load',()=>{
    const wrap=(name,fn)=>{ const o=window[name]; if(typeof o!=='function'||o._poshSfx) return; const w=function(){ const r=o.apply(this,arguments); try{ fn.apply(this,arguments); }catch(e){} return r; }; w._poshSfx=true; window[name]=w; };
    wrap('_cycleItem',()=>sfx('swap'));
  });
})();
