// ============================================================
//  beta_engine.js — "HYPERDRIVE": the most badass engine we could imagine
//  (Paulo, Oct 22: "the most badass engine sound we can ever imagine, if a
//  super motorcycle/car/vehicle was to be invented… impressive stuff")
//
//  Mind's hub hides an imaginary twin-turbo hybrid that morphs as it revs:
//   - the combustion core runs in an AudioWorklet (engine_worklet.js): a crank
//     turns, cylinders fire on their angles into two tuned exhaust pipes. Low
//     down it's a cross-plane V8 (the lumpy burble), and it morphs into an
//     even-fire V12 that screams to 13,500 rpm;
//   - two turbos spool with throttle × revs (a rising whistle) and dump through
//     a blow-off valve when you lift ("pssh-tu-tu-tu");
//   - an electric hyper-motor sings over the top with the wheel speed (techy);
//   - anti-lag: lifting off high in the revs bangs and crackles; full-throttle
//     upshifts crack, downshifts blip to match the revs;
//   - from a standstill on throttle the clutch slips: it flares and bites as
//     the wheel hooks up.
//  Six gears, quick shifts, a rev limiter that bounces on the redline in the air.
//  It plays through MIND's room (beta_spatial self bus). main.js calls
//  MV_ENGINE.tick every frame; 3 s standing still and it cuts (press to restart).
// ============================================================
(function(){
  'use strict';
  const IDLE=1150, RED=13500, LIMIT=13300;
  const GEARS=[[0,0.2],[0.15,0.36],[0.3,0.54],[0.46,0.72],[0.64,0.92],[0.84,1.4]];
  const UP=12600, BASE=6200;                       // shift at 12.6k, lands at ~6.2k in the next gear
  const S={on:true, idle:0, rpm:IDLE, gear:0, thr:0, raw:0, cut:0, shiftT:0, boost:0, blip:0, lim:0, lastThr:0, bangs:[]};
  const sv=()=>{ try{ return Math.max(0,Math.min(1,OPT.sfxVol!=null?OPT.sfxVol:1)); }catch(e){ return 1; } };
  function ac(){ try{ return (typeof _audioUnlocked!=='undefined'&&_audioUnlocked&&typeof ga==='function')?ga():null; }catch(e){ return null; } }
  let A=null, N=null, loading=false;

  function noiseBuf(a){ const b=a.createBuffer(1,a.sampleRate,a.sampleRate), d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; return b; }
  async function build(a,dest){
    if(!a.audioWorklet) return null;
    await a.audioWorklet.addModule('js/engine_worklet.js?v=244c');
    const core=new AudioWorkletNode(a,'mv-engine',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});
    const out=a.createGain(); out.gain.value=0;
    const coreG=a.createGain(); coreG.gain.value=1;
    const body=a.createBiquadFilter(); body.type='peaking'; body.frequency.value=90; body.Q.value=0.8; body.gain.value=5;   // chest
    const air=a.createBiquadFilter(); air.type='highshelf'; air.frequency.value=4500; air.gain.value=2;
    core.connect(coreG); coreG.connect(body); body.connect(air); air.connect(out);
    if(!dest){ dest=a.destination; try{ const G=window.MV_SPATIAL&&MV_SPATIAL.graph&&MV_SPATIAL.graph(); if(G&&G.self&&G.self.context===a) dest=G.self; }catch(e){} }
    out.connect(dest);
    // turbos: two whistles a hair apart, through a resonant band, plus the rushing air
    const tbp=a.createBiquadFilter(); tbp.type='bandpass'; tbp.Q.value=9; const tg=a.createGain(); tg.gain.value=0;
    const t1=a.createOscillator(), t2=a.createOscillator(); t1.type='sine'; t2.type='triangle';
    t1.connect(tbp); t2.connect(tbp); tbp.connect(tg); tg.connect(out);
    const NB=noiseBuf(a), tn=a.createBufferSource(); tn.buffer=NB; tn.loop=true; const tnbp=a.createBiquadFilter(); tnbp.type='bandpass'; tnbp.Q.value=4; const tng=a.createGain(); tng.gain.value=0;
    tn.connect(tnbp); tnbp.connect(tng); tng.connect(out);
    // the electric hyper-motor: two saws a fifth apart through a singing band
    const e1=a.createOscillator(), e2=a.createOscillator(); e1.type='sawtooth'; e2.type='sawtooth';
    const ebp=a.createBiquadFilter(); ebp.type='bandpass'; ebp.Q.value=7; const eg=a.createGain(); eg.gain.value=0;
    e1.connect(ebp); e2.connect(ebp); ebp.connect(eg); eg.connect(out);
    for(const o of [t1,t2,e1,e2]) o.start(); tn.start();
    return {a,core,out,coreG,tbp,tg,t1,t2,tnbp,tng,e1,e2,ebp,eg,NB};
  }
  function bang(k){ if(N) N.core.port.postMessage({bang:k}); }
  function blowOff(){                                // pssh-tu-tu-tu
    if(!N) return;
    const a=N.a, t=a.currentTime, s=a.createBufferSource(); s.buffer=N.NB;
    const hp=a.createBiquadFilter(); hp.type='bandpass'; hp.Q.value=0.9; hp.frequency.setValueAtTime(5200,t); hp.frequency.exponentialRampToValueAtTime(1400,t+0.4);
    const g=a.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002,0.32*S.boost),t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+0.45);
    const fl=a.createGain(); fl.gain.value=1; const lfo=a.createOscillator(), lg=a.createGain(); lfo.frequency.value=22; lg.gain.value=0.45; lfo.connect(lg); lg.connect(fl.gain);   // the flutter
    s.connect(hp); hp.connect(g); g.connect(fl); fl.connect(N.out); s.start(t); s.stop(t+0.5); lfo.start(t); lfo.stop(t+0.5);
  }

  function tick(){
    const a=ac(); if(!a||a.state!=='running') return;
    if(A!==a){ A=a; N=null; loading=false; }
    if(!N){ if(!loading){ loading=true; build(a).then(n=>{ if(A===a) N=n; }).catch(()=>{}); } return; }
    const live=typeof _gameState!=='undefined'&&_gameState==='game'&&typeof p!=='undefined'&&p&&!(typeof _paused!=='undefined'&&_paused)
      &&!(typeof _shutdownTimer!=='undefined'&&_shutdownTimer>0)&&!(window.MV_BETA&&(MV_BETA.popup||MV_BETA.results||MV_BETA.loading));
    const t=a.currentTime, set=(pr,v,tc)=>{ try{ pr.setTargetAtTime(v,t,tc); }catch(e){} };
    if(!live){ set(N.out.gain,0,0.08); N.core.port.postMessage({thr:0,rpm:IDLE}); return; }
    const dir=typeof _moveInputX==='function'?_moveInputX():0;
    const top=typeof MOVE_RUN==='number'?MOVE_RUN:12.4;
    const spd=Math.max(0,Math.abs(p.vx||0)/top);
    const grounded=typeof _playerOnGround==='function'?!!_playerOnGround(p):!!p.og;
    const sprint=typeof isSprintHeld==='function'&&isSprintHeld()&&dir;
    if(dir){ S.on=true; S.idle=0; } else if(grounded&&spd<0.06){ if(++S.idle>=180) S.on=false; } else S.idle=0;
    const burn=(p._burnout||0)>0;
    let thr=dir?(sprint?1:0.7):0; if(burn) thr=1;
    S.raw=thr;
    // ── the gearbox ──
    let target;
    if(!grounded||burn){                                          // free-revving: up to the limiter, which bounces
      target=thr>0?LIMIT+400:IDLE+900;
      if(S.rpm>=LIMIT&&thr>0&&!(S.lim>0)) S.lim=5;
    }else{
      const g=GEARS[S.gear], span=Math.max(0.01,g[1]-g[0]);
      target=S.gear===0?IDLE+(UP-IDLE)*Math.min(1.08,spd/span):BASE+(UP-BASE)*Math.max(-0.5,Math.min(1.08,(spd-g[0])/span));
      if(spd<0.16&&thr>0) target=Math.max(target,3600+thr*3200);   // launch: the clutch slips, it flares and bites
      target+=thr*500;
      if(S.shiftT>0) S.shiftT--;
      if(target>UP&&S.gear<GEARS.length-1&&!(S.shiftT>0)){ S.gear++; S.cut=5; S.shiftT=24; if(thr>=0.9&&S.rpm>11000) bang(0.35); }   // upshift (cracks at full throttle)
      else if(S.gear>0&&spd<g[0]-0.05&&!(S.shiftT>0)){ S.gear--; S.shiftT=24; S.blip=8; }                                                // downshift: blip to match
      if(spd<0.03&&thr===0) S.gear=0;
    }
    if(S.cut>0){ S.cut--; thr=0; target*=0.9; }
    if(S.blip>0){ S.blip--; target+=2600; thr=Math.max(thr,0.55); }
    if(S.lim>0){ S.lim--; if(S.lim<=2){ target=LIMIT-1400; thr=0; } }
    S.thr+=(thr-S.thr)*(thr>S.thr?0.35:0.2);
    S.rpm+=(Math.min(RED,target)-S.rpm)*(target>S.rpm?(grounded?0.14:0.22):0.09);
    // ── anti-lag, blow-off on lifting ──
    const r=(S.rpm-IDLE)/(RED-IDLE);
    S.boost+=((S.thr*Math.max(0,r-0.15)*1.3)-S.boost)*(S.thr>0.2?0.035:0.12);
    if(S.lastThr>0.5&&S.raw===0){
      if(S.boost>0.25) blowOff();
      if(S.rpm>7000){ const n=2+((Math.random()*4)|0); for(let i=0;i<n;i++) S.bangs.push(4+i*(6+((Math.random()*10)|0))); }
    }
    S.lastThr=S.raw;
    for(let i=S.bangs.length-1;i>=0;i--){ if(--S.bangs[i]<=0){ S.bangs.splice(i,1); bang(0.35+Math.random()*0.65); } }
    // ── voice it ──
    N.core.port.postMessage({rpm:S.rpm, thr:S.thr, load:grounded?S.thr:0.3});
    const tw=1400+S.boost*5600;
    set(N.t1.frequency,tw,0.05); set(N.t2.frequency,tw*1.012,0.05); set(N.tbp.frequency,tw,0.05); set(N.tg.gain,0.05*S.boost*S.boost,0.08);
    set(N.tnbp.frequency,1800+S.boost*3000,0.08); set(N.tng.gain,0.04*S.boost,0.08);
    const ef=180+spd*2400;
    set(N.e1.frequency,ef,0.04); set(N.e2.frequency,ef*1.5,0.04); set(N.ebp.frequency,ef*2,0.04); set(N.eg.gain,0.022*Math.min(1,spd*1.4)*(0.4+0.6*S.thr),0.06);
    const lvl=S.on?(0.34+0.2*S.thr+0.12*r):0;
    set(N.out.gain,lvl*sv(),S.on?0.04:0.4);
  }
  window.MV_ENGINE={tick, state:S, _build:build, _bang:bang};
})();
