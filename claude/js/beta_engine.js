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
  const IDLE=620, RED=13500, LIMIT=13300;           // a low, slow idle: the purr
  const GEARS=[[0,0.2],[0.15,0.36],[0.3,0.54],[0.46,0.72],[0.64,0.92],[0.84,1.4]];
  const UP=12600, BASE=6200;                       // shift at 12.6k, lands at ~6.2k in the next gear
  const S={on:true, idle:0, rpm:IDLE, gear:0, thr:0, raw:0, cut:0, shiftT:0, boost:0, blip:0, lim:0, lastThr:0, bangs:[]};
  const sv=()=>{ try{ return Math.max(0,Math.min(1,OPT.sfxVol!=null?OPT.sfxVol:1)); }catch(e){ return 1; } };
  const ev=()=>{ try{ const v=OPT.engineVol; return Math.max(0,Math.min(1,v==null?0.8:v)); }catch(e){ return 0.8; } };
  function ac(){ try{ return (typeof _audioUnlocked!=='undefined'&&_audioUnlocked&&typeof ga==='function')?ga():null; }catch(e){ return null; } }
  let A=null, N=null, loading=false, N_muffle=null;

  function noiseBuf(a){ const b=a.createBuffer(1,a.sampleRate,a.sampleRate), d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; return b; }
  async function build(a,dest){
    if(!a.audioWorklet) return null;
    await a.audioWorklet.addModule('js/engine_worklet.js?v=247');
    const core=new AudioWorkletNode(a,'mv-engine',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});
    const out=a.createGain(); out.gain.value=0;
    const coreG=a.createGain(); coreG.gain.value=1;
    const body=a.createBiquadFilter(); body.type='peaking'; body.frequency.value=90; body.Q.value=0.8; body.gain.value=5;   // chest
    const air=a.createBiquadFilter(); air.type='highshelf'; air.frequency.value=3500; air.gain.value=-6;
    core.connect(coreG); coreG.connect(body); body.connect(air); air.connect(out);
    if(!dest){ dest=a.destination; try{ const G=window.MV_SPATIAL&&MV_SPATIAL.graph&&MV_SPATIAL.graph(); if(G&&G.self&&G.self.context===a) dest=G.self; }catch(e){} }
    // Paulo (Oct 22): sit it back in the mix — muffled, like it's inside the hub, under the music
    const muffle=a.createBiquadFilter(); muffle.type='lowpass'; muffle.frequency.value=1600; muffle.Q.value=0.6;
    const roomG=a.createGain(); roomG.gain.value=1;
    out.connect(muffle); muffle.connect(roomG); roomG.connect(dest); N_muffle=muffle;
    // Sports mode brings a drier, centred path up beside the room. It leads the
    // mix without the full-open scream: a little presence, not a wall of exhaust.
    let main=a.destination; try{ const G=window.MV_SPATIAL&&MV_SPATIAL.graph&&MV_SPATIAL.graph(); if(G&&G.main&&G.main.context===a) main=G.main; }catch(e){}
    const mono=a.createGain(); mono.channelCount=1; mono.channelCountMode='explicit'; mono.channelInterpretation='speakers'; mono.gain.value=1;
    const tight=a.createBiquadFilter(); tight.type='peaking'; tight.frequency.value=160; tight.Q.value=1.0; tight.gain.value=-3;      // less boom
    const pres=a.createBiquadFilter(); pres.type='peaking'; pres.frequency.value=2600; pres.Q.value=0.9; pres.gain.value=5;          // the bite
    const sheen=a.createBiquadFilter(); sheen.type='highshelf'; sheen.frequency.value=7000; sheen.gain.value=6;                         // the air (undoes the -6 dB shelf)
    const dryG=a.createGain(); dryG.gain.value=0;
    const pan=a.createStereoPanner(); pan.pan.value=0;
    out.connect(mono); mono.connect(tight); tight.connect(pres); pres.connect(sheen); sheen.connect(dryG); dryG.connect(pan); pan.connect(main);
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
    // Idle stays a low purr. Turbo throws that away and uses the same oscillators
    // as a tiger: a saw in the chest, a slow roar-throb, and a rasp instead of a 24 Hz rattle.
    const pu1=a.createOscillator(), pu2=a.createOscillator(); pu1.type='sine'; pu2.type='triangle';
    const puLP=a.createBiquadFilter(); puLP.type='lowpass'; puLP.frequency.value=180; puLP.Q.value=0.7;
    const puG=a.createGain(); puG.gain.value=0; const puAM=a.createGain(); puAM.gain.value=0.7;
    const br=a.createOscillator(), brG=a.createGain(); br.frequency.value=0.55; brG.gain.value=0.3; br.connect(brG); brG.connect(puAM.gain);
    const ru=a.createOscillator(), ruG=a.createGain(); ru.type='triangle'; ru.frequency.value=24; ruG.gain.value=0.35; ru.connect(ruG); ruG.connect(puAM.gain);
    pu1.connect(puLP); pu2.connect(puLP); puLP.connect(puAM); puAM.connect(puG); puG.connect(out);
    // a gasoline edge: a quiet square an octave up, opened only while sports is on
    const bite=a.createOscillator(); bite.type='square'; bite.frequency.value=90;
    const biteLP=a.createBiquadFilter(); biteLP.type='lowpass'; biteLP.frequency.value=980; biteLP.Q.value=0.6;
    const biteG=a.createGain(); biteG.gain.value=0;
    bite.connect(biteLP); biteLP.connect(biteG); biteG.connect(out);
    for(const o of [t1,t2,e1,e2,pu1,pu2,br,ru,bite]) o.start(); tn.start();
    return {a,core,out,roomG,dryG,pres,sheen,tight,pan,coreG,tbp,tg,t1,t2,tnbp,tng,e1,e2,ebp,eg,NB,pu1,pu2,puLP,puG,ru,ruG,br,bite,biteG};
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
  // A backfire pop, booked on the audio clock: a bright crack plus a low thump.
  function pop(level, delay){
    if(!N||!(level>0)) return;
    const a=N.a, t=a.currentTime+Math.max(0,delay||0), k=Math.max(0.15,Math.min(1,level));
    const s=a.createBufferSource(); s.buffer=N.NB;
    const hp=a.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=1500+Math.random()*900;
    const ng=a.createGain();
    ng.gain.setValueAtTime(0.0001,t);
    ng.gain.exponentialRampToValueAtTime(0.22*k*(0.65+Math.random()*0.7), t+0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, t+0.035+Math.random()*0.02);
    const wide=a.createStereoPanner(); wide.pan.value=(Math.random()*2-1)*0.4;
    s.connect(hp); hp.connect(ng); ng.connect(wide); wide.connect(N.out);
    const o=a.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(70+Math.random()*40,t);
    const og=a.createGain();
    og.gain.setValueAtTime(0.0001,t);
    og.gain.exponentialRampToValueAtTime(0.28*k, t+0.008);
    og.gain.exponentialRampToValueAtTime(0.0001, t+0.06);
    o.connect(og); og.connect(wide);
    s.start(t); s.stop(t+0.09); o.start(t); o.stop(t+0.09);
  }
  function crackle(count, big){
    const n=Math.max(1,Math.min(8,count|0));
    const span=0.4+Math.random()*0.5;
    let at=0.02;
    for(let i=0;i<n;i++){
      at+= (span/n)*(0.55+Math.random()*0.9);
      pop((big?1:0.7)*(1-i/n*0.4), at);
    }
  }
  // the back-bottom corner of the cabinet, opposite the way he is facing
  function tailOf(){
    const right=p.fc!==false;
    const back=right?-1:1;
    const cx=p.x+(typeof SW!=='undefined'?SW:64)/2;
    const bw=typeof BODY_W==='number'?BODY_W:52;
    const bh=typeof BODY_H==='number'?BODY_H:42;
    const feet=p.y+(typeof FEET_OFF!=='undefined'?FEET_OFF:88);
    const stand=typeof STAND_H==='number'?STAND_H:70;
    const wr=typeof WHEEL_R==='number'?WHEEL_R:20;
    const top=feet-stand-wr+10;
    return {x:cx+back*(bw*0.5-3), y:top+bh-4, back};
  }
  function exhaustPuff(heat){
    if(typeof p==='undefined'||!p) return;
    if(!p.smoke) p.smoke=[];
    const t=tailOf(), h=Math.max(0,Math.min(1,heat||0));
    const wet=!!(window.MV_BETA&&MV_BETA.inWater&&MV_BETA.inWater(t.x,t.y));
    if(p.smoke.length>(wet?84:56)) return;
    if(wet){
      // sports exhaust under water: a dark bubble, not a puff. It rises on its own.
      p.smoke.push({
        x:t.x+(Math.random()-0.5)*6, y:t.y+(Math.random()-0.5)*4,
        vx:t.back*(0.12+Math.random()*0.28), vy:-0.55-Math.random()*0.35-h*0.25,
        life:1, maxLife:1, age:0,
        r:4.4+Math.random()*2.6+h*2.2, bub:1, hot:h, wob:Math.random()*6.28
      });
      return;
    }
    const lobes=[];
    const n=3+(Math.random()*2|0);
    for(let i=0;i<n;i++) lobes.push([(Math.random()-0.5)*0.95,(Math.random()-0.5)*0.7,0.42+Math.random()*0.55]);
    p.smoke.push({
      x:t.x+(Math.random()-0.5)*5, y:t.y+(Math.random()-0.5)*3,
      vx:t.back*(0.85+Math.random()*1.2+h*1.5), vy:-0.22-Math.random()*(0.4+h*0.55),
      life:30+(h*20|0)+(Math.random()*12|0), maxLife:56,
      r:4.2+Math.random()*3.2+h*3.5, ex:1, hot:h, spin:Math.random()*Math.PI, lobes
    });
  }
  function cornerSparks(n, heat){
    if(typeof PFXS==='undefined'||typeof p==='undefined'||!p) return;
    const t=tailOf(), hot=Math.max(0.25,heat||0);
    for(let i=0;i<n;i++){
      const col=Math.random()<0.3?'#ffe08a':(Math.random()<0.55?'#ff6a18':'#ff3810');
      PFXS.push({x:t.x+(Math.random()-0.5)*7,y:t.y+(Math.random()-0.5)*5,vx:t.back*(2.2+Math.random()*7)+(Math.random()-0.5)*2.4,vy:-1.2-Math.random()*(2.4+hot*4),life:9+(Math.random()*8|0),maxLife:18,r:1.05+Math.random()*1.35,col});
    }
  }
  function sportBurst(){
    for(let i=0;i<8;i++) exhaustPuff(0.85);
    cornerSparks(14, 1);
  }
  // a short throttle stab: the note jumps, then sits, like a blip of the pedal
  // Paulo, Nov 4 (build 370): the key switch, the start-up, the shut-down and the rev used to
  // go into the engine's own output, which sits at zero while the engine idles — the moment
  // you turn sports mode on or off standing still — so they were silent. They play on their
  // own now, straight out (and don't need the engine worklet loaded at all).
  function out(a){ const g=a.createGain(); g.gain.value=sv()*Math.max(0.35,ev());
    let d=a.destination; try{ const G=window.MV_SPATIAL&&MV_SPATIAL.graph&&MV_SPATIAL.graph(); if(G&&G.main&&G.main.context===a) d=G.main; }catch(e){} g.connect(d); return g; }
  function tone(a,dst,type,f0,f1,t0,dur,peak,lp){
    const o=a.createOscillator(), g=a.createGain(); o.type=type;
    o.frequency.setValueAtTime(f0,t0); o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t0+dur);
    g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(peak,t0+Math.min(0.02,dur*0.2)); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    if(lp){ const f=a.createBiquadFilter(); f.type='lowpass'; f.frequency.value=lp; o.connect(f); f.connect(g); } else o.connect(g);
    g.connect(dst); o.start(t0); o.stop(t0+dur+0.05);
  }
  function noiseHit(a,dst,t0,dur,peak,hp){
    const s=a.createBufferSource(); s.buffer=noiseBuf(a); const f=a.createBiquadFilter(); f.type='highpass'; f.frequency.value=hp||1800;
    const g=a.createGain(); g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(peak,t0+0.003); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    s.connect(f); f.connect(g); g.connect(dst); s.start(t0); s.stop(t0+dur+0.02);
  }
  function keySwitch(a,dst,t0,on){                 // the key turning: two metal ticks (on), one (off)
    noiseHit(a,dst,t0,0.03,0.5,3200); tone(a,dst,'square',on?2400:1600,on?1800:1200,t0,0.025,0.12);
    if(on){ noiseHit(a,dst,t0+0.07,0.025,0.4,2600); tone(a,dst,'square',2000,1500,t0+0.07,0.02,0.1); }
  }
  function bark(){                                  // the rev: the note leaps up, holds, drops back
    const a=ac(); if(!a) return; const t=a.currentTime, d=out(a);
    tone(a,d,'sawtooth',70,420,t,0.16,0.32,2600);
    tone(a,d,'sawtooth',420,120,t+0.16,0.32,0.26,1800);
    tone(a,d,'square',35,90,t,0.4,0.18,500);
  }
  function ignite(){
    sportBurst();
    const a=ac(); if(!a) return; const t=a.currentTime, d=out(a);
    keySwitch(a,d,t,true);
    // the starter cranks (a few chugs), then it catches and settles to idle
    for(let k=0;k<4;k++) tone(a,d,'sawtooth',48+k*6,40,t+0.14+k*0.09,0.08,0.22,700);
    tone(a,d,'sawtooth',45,160,t+0.5,0.28,0.34,1500);
    tone(a,d,'sawtooth',160,70,t+0.78,0.45,0.24,1200);
    if(N) pop(0.85,0.55);
  }
  function engineOff(){
    const a=ac(); if(!a) return; const t=a.currentTime, d=out(a);
    keySwitch(a,d,t,false);
    tone(a,d,'sawtooth',96,24,t+0.05,0.8,0.26,900);      // it winds down
    tone(a,d,'square',40,18,t+0.05,0.7,0.12,300);
  }

  // the sports-mode switch and the double-forward rev, run before the engine worklet check
  function switchTick(){
    if(typeof _gameState==='undefined'||_gameState!=='game'||typeof p==='undefined'||!p) return;
    const dir=typeof _moveInputX==='function'?_moveInputX():0;
    const sport=typeof isSprintHeld==='function'&&isSprintHeld();
    // Paulo, Nov 4 (build 359): the sports-mode switch (standing double-tap) starts the engine
    // with its start-up sound and turns it off with the shut-down, even standing still; it no
    // longer starts and stops every time he does. Shift-run keeps the old start/stop.
    const modeOn=p._ignition?true:!!sport;
    if(modeOn&&!S.sportOn) ignite();
    if(!modeOn&&S.sportOn) engineOff();
    S.sportOn=modeOn;
    // forward twice, fast, in sports mode: the engine pops with sparks and revs
    const pressed=!!dir&&dir!==(S._dir||0);
    S._dir=dir||0;
    if(modeOn&&pressed){
      const now=performance.now(), dbl=dir===S._lastPressDir&&now-(S._lastPressT||0)<300;
      S._lastPressDir=dir; S._lastPressT=dbl?0:now;
      if(dbl){
        bark(); pop(0.9,0.01); pop(0.7,0.07); crackle(3+(Math.random()*2|0), true); bang(0.3);
        S.rev=12; S.blip=Math.max(S.blip||0, 14);
        cornerSparks(16, 1); exhaustPuff(0.9); exhaustPuff(0.6);
      }
    }
  }
  function tick(){
    try{ switchTick(); }catch(e){}
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
    const sport=typeof isSprintHeld==='function'&&isSprintHeld();
    const sprint=sport&&dir;
    const ax=Math.abs((p.vx||0)-(S._vx0||0));
    S._vx0=p.vx||0;
    if(dir){ if(!S.on) pop(0.45,0.02); S.on=true; S.idle=0; } else if(grounded&&spd<0.06){ if(++S.idle>=180) S.on=false; } else S.idle=0;
    const burn=(p._burnout||0)>0;
    let thr=dir?(sprint?1:0.7):0; if(burn) thr=1;
    S.raw=thr;
    // ── the gearbox ──
    let target;
    if(!grounded||burn){                                          // free-revving: up to the limiter, which bounces
      const wspd=Math.abs(p._wSpin||0)*(typeof WHEEL_R==='number'?WHEEL_R:20)/top;   // the free-spinning wheel (rope, mid-air)
      const lim=burn?Math.min(LIMIT,6200+spd*7600):Math.min(LIMIT,IDLE+1200+Math.max(spd,wspd)*11000);                    // Paulo: the top of the scream belongs to top speed — standing still it revs only so far
      target=thr>0?lim+400:IDLE+900;
      if(S.rpm>=lim&&thr>0&&!(S.lim>0)) S.lim=5;
    }else{
      const g=GEARS[S.gear], span=Math.max(0.01,g[1]-g[0]);
      // each gear tops out higher than the last: low gears shift early (5.4k), only 6th reaches the scream
      const up=5400+S.gear*1440, base=Math.max(IDLE+1500,up*0.55);
      target=S.gear===0?IDLE+(up-IDLE)*Math.min(1.08,spd/span):base+(up-base)*Math.max(-0.5,Math.min(1.08,(spd-g[0])/span));
      if(spd<0.16&&thr>0) target=Math.max(target,2600+thr*1800);   // launch: the clutch slips, it flares and bites
      target+=thr*500;
      if(S.shiftT>0) S.shiftT--;
      if(target>up&&S.gear<GEARS.length-1&&!(S.shiftT>0)){
        S.gear++; S.cut=5; S.shiftT=24;
        if(sprint&&S.rpm>5500){ bang(0.22); crackle(1+(Math.random()<0.45?1:0), S.rpm>10000); }
        else if(thr>=0.9&&S.rpm>11000) bang(0.35);
      }
      else if(S.gear>0&&spd<g[0]-0.05&&!(S.shiftT>0)){ S.gear--; S.shiftT=24; S.blip=8; }                                                // downshift: blip to match
      if(spd<0.03&&thr===0) S.gear=0;
    }
    // Sports mode owns the rev. Slow sport stays low in the band; close to top
    // speed the gearbox is allowed to scream. Off sport the motor is only a sub.
    if(sprint) S.sprintOff=0; else S.sprintOff=(S.sprintOff==null?99:S.sprintOff)+1;
    const sprinting=!!sprint||S.sprintOff<8;
    const express=sprinting?Math.pow(Math.min(1,Math.max(0,(spd-0.16)/0.8)),1.7):0;
    if(sprinting&&!S.wasSprint&&grounded&&express>0.42) S.rev=4+express*8;
    S.wasSprint=sprinting&&(S.wasSprint||grounded);
    if(S.rev>0){ S.rev--; target=Math.max(target,Math.min(RED,S.rpm+(500+3400*express)*(S.rev/12))); if(S.rev===3&&express>0.55) bang(0.22+0.3*express); }
    if(sprinting){
      const cap=IDLE+(RED-IDLE)*(0.14+0.86*express);
      target=Math.min(target,cap);
      if(spd<0.28) target=Math.min(target,IDLE+420+express*900);
      if(express>0.88&&grounded){
        S.redN=(S.redN|0)+1;
        if((S.redN%5)<2){ target=Math.min(target, RED*0.86); thr*=0.2; }
      }
    }else{
      target=Math.min(target,IDLE+220);
      thr=Math.min(thr,0.16);
      S.gear=0; S.rev=0;
    }
    if(S.cut>0){ S.cut--; thr=0; target*=0.9; }
    if(S.blip>0&&sprinting){ S.blip--; target+=900+1700*express; thr=Math.max(thr,0.35+0.4*express); }
    else if(S.blip>0) S.blip=0;
    if(S.lim>0){ S.lim--; if(S.lim<=2){ target=LIMIT-1400; thr=0; } }
    S.thr+=(thr-S.thr)*(thr>S.thr?0.35:0.2);
    S.rpm+=(Math.min(RED,target)-S.rpm)*(target>S.rpm?(grounded?0.14:0.22):0.09);
    // ── anti-lag, blow-off on lifting ──
    const r=(S.rpm-IDLE)/(RED-IDLE);
    S.boost+=((sprinting?S.thr*Math.max(0,r-0.15)*1.3:0)-S.boost)*(S.thr>0.2?0.035:0.12);
    const lift=(S.heldSport&&!sprint)||(S.lastThr>0.5&&S.raw===0&&sprinting);
    if(lift&&S.rpm>4200){
      if(S.boost>0.25) blowOff();
      crackle(3+((Math.random()*6)|0), S.rpm>9000);
    }
    S.heldSport=!!sprint;
    if(S.wasAir&&grounded&&sprinting&&S.rpm>4200&&(S.airVy||0)>3.5) crackle(2, false);
    S.wasAir=!grounded;
    if(!grounded) S.airVy=p.vy||0;
    S.lastThr=S.raw;
    for(let i=S.bangs.length-1;i>=0;i--){ if(--S.bangs[i]<=0){ S.bangs.splice(i,1); if(sprinting) bang(0.2+0.4*express); } }
    // ── voice it ──
    N.core.port.postMessage({rpm:S.rpm, thr:sprinting?S.thr*express:0.05, load:grounded?S.thr:0.3});
    const sportMix=sprinting?(0.22+0.78*express):0;
    const fire=S.rpm/60*4;
    if(sprinting!==!!S._tiger){
      S._tiger=!!sprinting;
      try{ N.pu1.type=sprinting?'sawtooth':'sine'; N.pu2.type=sprinting?'sawtooth':'triangle'; }catch(e){}
    }
    const rush=Math.min(1, ax/0.7);
    const heatWant=sport?Math.min(1, Math.max(express, rush*0.92, sprint?0.14:0.05)):0;
    S.heat=(S.heat||0)+(heatWant-(S.heat||0))*(heatWant>(S.heat||0)?0.22:0.045);
    p._sportHeat=S.heat;
    if(sprinting){
      // A sports car, not a whistle. Chest saw, gasoline square, rush of exhaust.
      const tw=150+S.boost*720;
      set(N.pu1.frequency,32+22*express,0.06); set(N.pu2.frequency,48+28*express,0.06);
      set(N.ru.frequency,4.4+3.4*express,0.1); set(N.ruG.gain,1.05,0.08); set(N.br.frequency,1.15,0.16);
      set(N.puLP.frequency,240+280*express,0.08);
      set(N.puG.gain,(0.58+0.48*express)*(0.85+0.15*(1-r)),0.06);
      set(N.tbp.Q,1.7,0.1);
      set(N.t1.frequency,tw,0.05); set(N.t2.frequency,tw*0.5,0.05); set(N.tbp.frequency,tw,0.05);
      set(N.tg.gain,0.028*S.boost*Math.max(0.35,sportMix),0.06);
      set(N.tnbp.frequency,280+S.boost*640,0.06); set(N.tng.gain,(0.11+0.16*express)*Math.max(0.4,S.boost),0.06);
      if(N.bite){ set(N.bite.frequency,48+70*express+S.rpm/220,0.04); set(N.biteG.gain,(0.05+0.09*express)*Math.max(0.4,sportMix),0.05); }
      if(N.pres){ set(N.pres.frequency,420+520*express,0.08); set(N.pres.gain,4+7*express,0.08); }
      if(N.tight) set(N.tight.gain,10+7*express,0.1);
    }else{
      const tw=1400+S.boost*5600;
      set(N.pu1.frequency,Math.min(90,fire/2),0.05); set(N.pu2.frequency,Math.min(100,fire),0.05);
      set(N.ru.frequency,18+Math.min(40,fire*0.15),0.2); set(N.ruG.gain,0.35,0.2); set(N.br.frequency,0.55,0.3);
      set(N.puLP.frequency,180,0.2);
      set(N.puG.gain,0.2*Math.pow(1-r,2),0.12);
      set(N.tbp.Q,9,0.2);
      set(N.t1.frequency,tw,0.05); set(N.t2.frequency,tw*1.012,0.05); set(N.tbp.frequency,tw,0.05);
      set(N.tg.gain,0,0.08); set(N.tnbp.frequency,1800,0.1); set(N.tng.gain,0,0.08);
      if(N.pres){ set(N.pres.frequency,2600,0.2); set(N.pres.gain,0,0.15); }
      if(N.tight) set(N.tight.gain,-3,0.2);
      if(N.biteG) set(N.biteG.gain,0,0.08);
    }
    if(sport&&(fr%2===0)){
      exhaustPuff(Math.max(0.2,S.heat||0));
      if((S.heat||0)>0.42&&fr%4===0) cornerSparks(2, S.heat);
    }
    const ef=180+spd*2400;
    set(N.e1.frequency,ef,0.04); set(N.e2.frequency,ef*1.5,0.04); set(N.ebp.frequency,ef*2,0.04); set(N.eg.gain,0.02*sportMix*Math.min(1,spd*1.4)*(0.4+0.6*S.thr),0.06);
    set(N.dryG.gain,sportMix*1.5,sprinting?0.06:0.25);
    set(N.roomG.gain,sprinting?(0.28+0.16*(1-express)):0.7,0.18);
    if(N.sheen) set(N.sheen.gain,sprinting?(-1+5*express):-10,0.12);
    if(N_muffle) set(N_muffle.frequency,sprinting?(360+6400*express):95,sprinting?0.1:0.08);
    const duck=(window.MV_BETA&&(MV_BETA.popup||MV_BETA.results||MV_BETA.ending))?0.63:1;
    const lvl=S.on?(sprinting?(0.08+0.16*express):(0.09)):0;
    set(N.out.gain,lvl*sv()*ev()*duck,S.on?0.08:0.45);
    if(N.pan&&window.MV_SPATIAL&&typeof MV_SPATIAL.screenPan==='function'){
      const px=(p.x||0)+(typeof SW==='number'?SW*0.5:32);
      set(N.pan.pan, MV_SPATIAL.screenPan(px)*0.4, 0.12);
    }
  }
  window.MV_ENGINE={tick, state:S, _build:build, _bang:bang};
})();
