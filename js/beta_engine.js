// ============================================================
//  beta_engine.js — the wheel's engine: our own "roar"
//  (Paulo, Oct 22: "emulate a motor engine sound for the wheel… pleasing to
//  the ears… that good feeling of a sports car engine roar")
//
//  A little V8 lives in the hub. It has an RPM, five gears and a throttle:
//   - RPM comes from the wheel's speed through the gear it's in; it climbs
//     through a gear and drops on each upshift (a quick throttle cut — the
//     "brap" between gears). In the air or on a burnout it revs free.
//   - Sound: the firing pulse (4 fires per turn) as a rich harmonic wave, a
//     sub at half and a quarter of it for the cross-plane burble, uneven at
//     idle; soft saturation that growls harder on throttle; exhaust and
//     cabin resonances; a low-pass that opens with throttle and RPM; a thin
//     induction howl up top; crackles and pops when you lift off at speed.
//  It replaces build 237's pop scheduler (MV_ENGINE.tick from main.js) and
//  keeps its rule: three seconds standing still and it cuts; a press restarts.
//  MIND's own sound: it plays through the room of where he is (beta_spatial).
// ============================================================
(function(){
  'use strict';
  const IDLE=950, RED=7400, CYL_FIRES=4;               // V8: four fires per revolution
  const GEARS=[[0,0.24],[0.18,0.42],[0.36,0.64],[0.56,0.86],[0.78,1.3]];   // wheel speed (0..1+) span per gear
  const SHIFT_UP=6900, SHIFT_DN=3200;
  const S={on:true, idle:0, rpm:IDLE, gear:0, thr:0, cut:0, crackle:0, lastThr:0};
  const sv=()=>{ try{ return Math.max(0,Math.min(1,OPT.sfxVol!=null?OPT.sfxVol:1)); }catch(e){ return 1; } };
  function ac(){ try{ return (typeof _audioUnlocked!=='undefined'&&_audioUnlocked&&typeof ga==='function')?ga():null; }catch(e){ return null; } }
  let A=null, N=null, nbuf=null;

  function wave(a){                                    // the firing pulse: a bright, slightly odd-heavy spectrum
    const n=40, re=new Float32Array(n), im=new Float32Array(n);
    for(let k=1;k<n;k++) im[k]=(k%2?1:0.62)/Math.pow(k,1.05);
    return a.createPeriodicWave(re,im);
  }
  function satCurve(k){ const c=new Float32Array(1024); for(let i=0;i<1024;i++){ const x=i/511.5-1; c[i]=Math.tanh(k*x)/Math.tanh(k); } return c; }
  function build(a){
    const out=a.createGain(); out.gain.value=0;
    let dest=a.destination; try{ const G=window.MV_SPATIAL&&MV_SPATIAL.graph&&MV_SPATIAL.graph(); if(G&&G.self&&G.self.context===a) dest=G.self; }catch(e){}
    out.connect(dest);
    const pre=a.createGain(); pre.gain.value=1;
    const sat=a.createWaveShaper(); sat.curve=satCurve(2.2); sat.oversample='2x';
    const satIn=a.createGain(); satIn.gain.value=1;
    // exhaust / body resonances, then the throttle low-pass
    const r1=a.createBiquadFilter(); r1.type='peaking'; r1.frequency.value=110; r1.Q.value=1.1; r1.gain.value=6;
    const r2=a.createBiquadFilter(); r2.type='peaking'; r2.frequency.value=420; r2.Q.value=1.6; r2.gain.value=4;
    const r3=a.createBiquadFilter(); r3.type='peaking'; r3.frequency.value=1400; r3.Q.value=2; r3.gain.value=2;
    const lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900; lp.Q.value=0.8;
    const hp=a.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=38;
    pre.connect(satIn); satIn.connect(sat); sat.connect(r1); r1.connect(r2); r2.connect(r3); r3.connect(lp); lp.connect(hp); hp.connect(out);
    // the voices
    const W=wave(a);
    const main=a.createOscillator(); main.setPeriodicWave(W);
    const det=a.createOscillator(); det.setPeriodicWave(W); det.detune.value=7;              // a second bank, a hair off: width
    const half=a.createOscillator(); half.type='sawtooth';                                     // cross-plane burble
    const quarter=a.createOscillator(); quarter.type='triangle';                               // the chest
    const gM=a.createGain(), gD=a.createGain(), gH=a.createGain(), gQ=a.createGain();
    gM.gain.value=0.5; gD.gain.value=0.25; gH.gain.value=0.28; gQ.gain.value=0.45;
    main.connect(gM); det.connect(gD); half.connect(gH); quarter.connect(gQ);
    // uneven firing at idle: the main voice's level wobbles at the half-firing rate
    const wob=a.createOscillator(), wobG=a.createGain(); wob.type='square'; wobG.gain.value=0.22; wob.connect(wobG); wobG.connect(gM.gain);
    gM.connect(pre); gD.connect(pre); gH.connect(pre); gQ.connect(pre);
    // induction howl: band-passed noise, up high only
    nbuf=a.createBuffer(1,a.sampleRate,a.sampleRate); { const d=nbuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }
    const ns=a.createBufferSource(); ns.buffer=nbuf; ns.loop=true; const nbp=a.createBiquadFilter(); nbp.type='bandpass'; nbp.Q.value=6; const ng=a.createGain(); ng.gain.value=0;
    ns.connect(nbp); nbp.connect(ng); ng.connect(out);
    for(const o of [main,det,half,quarter,wob]) o.start(); ns.start();
    return {out,pre,satIn,lp,r1,r2,main,det,half,quarter,wob,wobG,gH,gQ,nbp,ng};
  }
  function crackle(){                                   // lift-off pops in the exhaust
    if(!A||!N) return;
    const t=A.currentTime, n=1+((Math.random()*3)|0);
    for(let i=0;i<n;i++){ const s=t+i*(0.03+Math.random()*0.07), src=A.createBufferSource(); src.buffer=nbuf;
      const bp=A.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=500+Math.random()*1400; bp.Q.value=1.2;
      const g=A.createGain(); g.gain.setValueAtTime(0.0001,s); g.gain.exponentialRampToValueAtTime(0.5*(0.5+Math.random()*0.5),s+0.002); g.gain.exponentialRampToValueAtTime(0.0001,s+0.05+Math.random()*0.05);
      src.connect(bp); bp.connect(g); g.connect(N.out); src.start(s,Math.random()*0.8); src.stop(s+0.12); }
  }
  // per game frame (main.js calls MV_ENGINE.tick)
  function tick(){
    const a=ac(); if(!a||a.state!=='running') return;
    if(a!==A){ A=a; N=build(a); }
    const live=typeof _gameState!=='undefined'&&_gameState==='game'&&typeof p!=='undefined'&&p&&!(typeof _paused!=='undefined'&&_paused)
      &&!(typeof _shutdownTimer!=='undefined'&&_shutdownTimer>0)&&!(window.MV_BETA&&(MV_BETA.popup||MV_BETA.results||MV_BETA.loading));
    const t=a.currentTime, set=(pr,v,tc)=>{ try{ pr.setTargetAtTime(v,t,tc); }catch(e){} };
    if(!live){ set(N.out.gain,0,0.08); return; }
    const dir=typeof _moveInputX==='function'?_moveInputX():0;
    const top=typeof MOVE_RUN==='number'?MOVE_RUN:12.4;
    const spd=Math.max(0,Math.abs(p.vx||0)/top);
    const grounded=typeof _playerOnGround==='function'?!!_playerOnGround(p):!!p.og;
    const sprint=typeof isSprintHeld==='function'&&isSprintHeld()&&dir;
    // on / off (build 237's rule)
    if(dir){ S.on=true; S.idle=0; } else if(grounded&&spd<0.06){ if(++S.idle>=180) S.on=false; } else S.idle=0;
    // throttle: driving, harder sprinting; a burnout floors it
    const burn=(p._burnout||0)>0;
    let thr=dir?(sprint?1:0.62):0; if(burn) thr=1;
    S.thr+=(thr-S.thr)*(thr>S.thr?0.25:0.12);
    // RPM through the gearbox (grounded), or free-revving (air / burnout)
    let target;
    if(!grounded||burn){ target=IDLE+(RED-IDLE)*(0.25+0.7*S.thr)*(burn?1:0.85); }
    else{
      const g=GEARS[S.gear], span=Math.max(0.01,g[1]-g[0]);
      target=S.gear===0?IDLE+(SHIFT_UP-IDLE)*Math.min(1.05,spd/span):3800+(SHIFT_UP-3800)*Math.max(-0.4,Math.min(1.05,(spd-g[0])/span));
      target=Math.max(IDLE,target+S.thr*350);
      if(S.shiftT>0) S.shiftT--;
      if(target>SHIFT_UP&&S.gear<GEARS.length-1&&!(S.shiftT>0)){ S.gear++; S.cut=7; S.shiftT=30; }      // upshift: a quick cut, the revs fall
      else if(S.gear>0&&spd<g[0]-0.06&&!(S.shiftT>0)){ S.gear--; S.shiftT=30; }                     // well below the gear: drop one (no hunting)
      if(spd<0.04) S.gear=0;
    }
    if(S.cut>0){ S.cut--; target*=0.82; }
    S.rpm+=(Math.min(RED,target)-S.rpm)*(target>S.rpm?0.18:0.1);
    // lifting off at speed: crackles in the exhaust
    if(S.lastThr>0.5&&thr===0&&S.rpm>3500) S.crackle=24;
    S.lastThr=thr;
    if(S.crackle>0){ S.crackle--; if(Math.random()<0.18) crackle(); }
    // the sound
    const r=(S.rpm-IDLE)/(RED-IDLE), f=S.rpm/60*CYL_FIRES/2;                             // firing frequency
    set(N.main.frequency,f,0.02); set(N.det.frequency,f,0.02); set(N.half.frequency,f/2,0.02); set(N.quarter.frequency,f/4,0.02);
    set(N.wob.frequency,f/4*(1+0.03*Math.sin(t*3)),0.05); set(N.wobG.gain,0.3*(1-r)*(1-S.thr*0.6),0.1);            // the idle lope fades as it revs
    set(N.gH.gain,0.32*(1-0.5*r),0.1); set(N.gQ.gain,0.5*(1-0.6*r),0.1);
    set(N.satIn.gain,0.7+1.8*S.thr+0.6*r,0.06);                                                // growl on throttle
    set(N.lp.frequency,600+2600*S.thr*(0.4+0.6*r)+900*r,0.05);
    set(N.r1.frequency,95+40*r,0.2); set(N.r2.frequency,380+160*r,0.2);
    set(N.nbp.frequency,2*f+1200,0.05); set(N.ng.gain,0.05*Math.max(0,r-0.45)*S.thr,0.08);
    const cutDip=S.cut>0?0.55:1;
    const lvl=S.on?(0.045+0.075*S.thr+0.04*r)*cutDip:0;
    set(N.out.gain,lvl*sv(),S.on?0.04:0.4);
  }
  window.MV_ENGINE={tick, state:S, _build:build};
})();
