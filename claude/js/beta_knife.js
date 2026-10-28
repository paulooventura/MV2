// ============================================================
//  beta_knife.js — the kiritsuke's feel + the 1.3 boss's finish (Paulo, Oct 23-25)
//
//   A+B DROP   with a jack selected, press A and B together (within 6 frames):
//              the jack drops at MIND's feet; touch it to take it back. Never the knife.
//              The sibling (WITH SIBLING) takes it too by touching it: one carry slot, it
//              holds that jack as its weapon. It hands it back when you swap to it (the
//              jack lands in your set) or when you press A+B with no jack to drop (it
//              drops it at its feet). 2P local isn't live in the story stages yet.
//              It USES that jack instead of its bolts (T174): TRS shots (ricochet), XLR blast,
//              MAG pull, RCA hook + yank; its own cooldowns, never your power bar.
//   BOSS INTRO entering the arena the first time: the scene holds, bars come in,
//              the Heptagon speaks (A: next line, B: skip).
//   BOLTS      the Heptagon's bolts hit hard (28 + a big shove). The knife's swing
//              knocks them away, a loaded slash sends them flying, the XLR blows
//              them off, the MAG pulls them in and throws them. Knocked-back bolts
//              never hurt MIND and chip the Heptagon (never below 1: the knife ends it).
//   FINISH     once it falls, the knife leaves MIND, flies to the gate and opens it,
//              stands up as a golden beam and is gone (bit 16 cleared).
  //   SOUND      a whoosh on a swing through the air. The clang only when the
  //              blade meets an object. Slashing an electro-box shocks MIND.
  //              A "shing" on drawing the knife, a hum that rises with the heat.
//  Rides on beta_foes.js (B.knifePose / B.knifeBig / B.knifeHeat / B.drawKnifeArt).
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B) return;
  const on=()=>B.on&&typeof p!=='undefined'&&p&&_gameState==='game'&&!(typeof _paused!=='undefined'&&_paused);
  const solid=(x,y)=>typeof gridWorldSolid==='function'&&gridWorldSolid(x,y);
  const S=(n,v)=>{ try{ sfx(n,v); }catch(e){} };
  const centre=()=>({x:p.x+SW/2, y:p.y+FEET_OFF-STAND_H*0.5});
  const dirOf=()=>p.fc?1:-1;
  const toW=a=>dirOf()>0?a:Math.PI-a;
  const wrap=a=>{ while(a>Math.PI) a-=2*Math.PI; while(a<-Math.PI) a+=2*Math.PI; return a; };
  const boss=()=>(typeof ENEMS!=='undefined'?ENEMS:[]).find(e=>e&&e._boss);
  function segDist(px,py,x0,y0,x1,y1){ const dx=x1-x0, dy=y1-y0, L=dx*dx+dy*dy||1; const t=Math.max(0,Math.min(1,((px-x0)*dx+(py-y0)*dy)/L)); return Math.hypot(px-x0-dx*t,py-y0-dy*t); }
  function burst(x,y,n,cols,sp){ for(let k=0;k<n;k++){ const a=Math.random()*Math.PI*2, s=(sp||3)*(0.4+Math.random()); PFXS.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:12+Math.random()*14|0,maxLife:26,r:1.5+Math.random()*2,col:cols[k%cols.length]}); } }

  // ── synth (WebAudio, no assets) ──────────────────────────────
  const ac=()=>{ try{ const a=typeof ga==='function'?ga():null; return a&&a.state==='running'?a:null; }catch(e){ return null; } };
  const vol=()=>{ try{ return Math.max(0,Math.min(1,(typeof OPT!=='undefined'&&OPT.sfxVol!=null)?OPT.sfxVol:1)); }catch(e){ return 1; } };
  let NB=null;
  function noise(a){ if(NB&&NB.sampleRate===a.sampleRate) return NB; const n=a.sampleRate*2; NB=a.createBuffer(1,n,a.sampleRate); const d=NB.getChannelData(0); for(let i=0;i<n;i++) d[i]=Math.random()*2-1; return NB; }
  function env(a,g,t,atk,dur){ const n=a.createGain(); n.gain.setValueAtTime(0.0001,t); n.gain.exponentialRampToValueAtTime(Math.max(0.0002,g*vol()),t+atk); n.gain.exponentialRampToValueAtTime(0.0001,t+dur); return n; }
  // a band-passed noise sweep: air moving with the blade. No metal in it.
  function whoosh(dur,f0,f1,g){
    const a=ac(); if(!a) return; const t=a.currentTime;
    const s=a.createBufferSource(); s.buffer=noise(a);
    const bp=a.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=0.9;
    bp.frequency.setValueAtTime(f0,t); bp.frequency.exponentialRampToValueAtTime(f1,t+dur*0.45); bp.frequency.exponentialRampToValueAtTime(Math.max(80,f0*0.55),t+dur);
    const n=env(a,g*2.2,t,0.006,dur); s.connect(bp); bp.connect(n); n.connect(a.destination);
    s.start(t,Math.random()); s.stop(t+dur+0.05);
  }
  function tone(type,f,g,t,atk,dur,f2){ const a=ac(); if(!a) return; const o=a.createOscillator(); o.type=type; o.frequency.setValueAtTime(f,t); if(f2) o.frequency.exponentialRampToValueAtTime(f2,t+dur); const n=env(a,g,t,atk,dur); o.connect(n); n.connect(a.destination); o.start(t); o.stop(t+dur+0.05); }
  // metal on rock: inharmonic partials + a gritty scrape, pitch by blade speed
  function clang(k){
    const a=ac(); if(!a) return; const t=a.currentTime, f=900+1300*Math.min(1,k);
    for(const [m,g] of [[1,0.16],[2.76,0.09],[5.4,0.05],[8.9,0.025]]) tone('sine',f*m,g,t,0.002,0.25+0.25/m);
    const s=a.createBufferSource(); s.buffer=noise(a); const hp=a.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=2500;
    const n=env(a,0.12,t,0.003,0.12); s.connect(hp); hp.connect(n); n.connect(a.destination); s.start(t,Math.random()); s.stop(t+0.15);
  }
  function shing(){ const a=ac(); if(!a) return; const t=a.currentTime; whoosh(0.32,2800,7200,0.07); tone('sine',2350,0.05,t+0.04,0.004,0.5); tone('sine',3530,0.03,t+0.04,0.004,0.35); }
  function blip(){ const a=ac(); if(!a) return; tone('square',95+Math.random()*55,0.035,a.currentTime,0.004,0.06); }
  function chord(){ const a=ac(); if(!a) return; const t=a.currentTime;
    for(const f of [130.8,261.6,329.6,392,523.3,784]){ tone('triangle',f,0.035,t,1.6,4.2); tone('sine',f*1.003,0.025,t,1.8,4.4); } }
  // the loading hum: follows the heat (dull red → white)
  let hum=null;
  function humTick(h){
    const a=ac();
    if(!a||h<=0){ if(hum){ try{ hum.g.gain.setTargetAtTime(0.0001,hum.a.currentTime,0.05); hum.o.stop(hum.a.currentTime+0.3); hum.o2.stop(hum.a.currentTime+0.3); }catch(e){} hum=null; } return; }
    if(!hum){ const o=a.createOscillator(), o2=a.createOscillator(), lp=a.createBiquadFilter(), g=a.createGain();
      o.type='sawtooth'; o2.type='sine'; lp.type='lowpass'; lp.frequency.value=600; g.gain.value=0.0001;
      o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(a.destination); o.start(); o2.start(); hum={a,o,o2,lp,g}; }
    const t=a.currentTime;
    hum.o.frequency.setTargetAtTime(70+300*h,t,0.05); hum.o2.frequency.setTargetAtTime(140+600*h,t,0.05);
    hum.lp.frequency.setTargetAtTime(500+2600*h,t,0.05); hum.g.gain.setTargetAtTime((0.02+0.05*h)*vol(),t,0.05);
  }

  // ── stage state ──────────────────────────────────────────────
  let tk=0, hitCd=0, hitstop=0;
  let shared=[], free=[], marks=[];
  let intro=null, introSeen=false, wasBossOn=false;
  let bossLive=false, finish=null, finishPending=false;
  function resetStage(){
    for(const d of shared) giveBack(d);
    carryBack();
    shared=[]; free=[]; marks=[]; intro=null; wasBossOn=false; bossLive=false; finish=null; finishPending=false; hitstop=0;
  }
  const _onEnt=B.onEntities;
  B.onEntities=function(){ resetStage(); return _onEnt?_onEnt.apply(this,arguments):undefined; };

  // ── A+B: drop the selected jack; touch it to take it back ──────
  const DROP_WIN=6;
  let lastJ=-99, lastU=-99, itemBeforeU=-1;
  const binds=a=>(typeof OPT!=='undefined'&&OPT.binds&&OPT.binds[a])||[];
  function giveBack(d){
    if(!d||d.got) return;
    d.got=true;
    if(!_itemUnlocked(d.item)){ _unlockedMask|=ITEM_UNLOCK_BITS[d.item]; if(ITEM<0) ITEM=d.item; }
  }
  // the sibling's one carry slot (it shares your item set, so a taken jack lives here)
  let carrier=null;
  const sibling=()=>{ const s=window.MV_SIBLING&&MV_SIBLING.on&&MV_SIBLING.state(); return s&&s!==p?s:null; };
  function carryBack(){
    if(carrier&&carrier._carry!=null){ const it=carrier._carry; carrier._carry=null;
      if(!_itemUnlocked(it)){ _unlockedMask|=ITEM_UNLOCK_BITS[it]; if(ITEM<0) ITEM=it; if(_itemEnhanced) _itemEnhanced[it]=!!carrier._carryEnh; } }
    carrier=null;
  }
  function spawnShared(it,enh,body,dir){
    const n0=ITEM_DROPS.length, cx=body.x+SW/2+dir*30, cy=body.y+FEET_OFF-8;
    _spawnItemDrop(it,cx,cy,{enhanced:!!enh});
    const d=ITEM_DROPS[n0]; if(!d) return null;
    d.got=true; d._shared=true; d._grace=36; d._fromX=body.x+SW/2; d._fromY=body.y+FEET_OFF-50;
    shared.push(d);
    S('swap'); burst(cx,cy-16,8,[ICOLS[it]||'#fff','#ffffff'],2);
    return d;
  }
  function sibDrop(){
    const s=sibling(); if(!s||s!==carrier||s._carry==null||typeof _spawnItemDrop!=='function') return false;
    const it=s._carry, d=spawnShared(it,s._carryEnh,s,s.fc?1:-1); if(!d) return false;
    d._sibCd=90; s._carry=null; carrier=null;
    return true;
  }
  function dropItem(){
    const it=ITEM;
    if((it<0||it===4||!_itemUnlocked(it))&&sibDrop()) return;
    if(it===4){ S('omniblock_chip',1.8); if(typeof uiShowToast==='function') uiShowToast('THE KIRITSUKE STAYS WITH YOU'); return; }
    if(it<0||it>3||!_itemUnlocked(it)||typeof _spawnItemDrop!=='function') return;
    if(it===3&&B.magPark) return;
    const d=spawnShared(it,_itemEnhanced&&_itemEnhanced[it],p,dirOf()); if(!d) return;
    _unlockedMask&=~ITEM_UNLOCK_BITS[it];
    if(it===1&&p.hook) p.hook={st:'idle',ex:0,ey:0,evx:0,evy:0,ax:0,ay:0,rl:0,ox:NaN,oy:NaN,tgt:null,tox:0,toy:0};
    if(it===2) p.xlrOn=false; if(it===3) p.magOn=false;
    ITEM=-1; if(_unlockedMask) _cycleItem();
  }
  function dropInput(){
    const J=binds('jump'), U=binds('use');
    const jNow=J.some(c=>Kj[c]), uNow=U.some(c=>Kj[c]);
    let drop=false;
    if(jNow&&uNow){ drop=true; }
    else if(uNow&&tk-lastJ<=DROP_WIN){ drop=true; if(p.vy<0) p.vy=Math.max(p.vy,-1); }      // A first: take back the hop
    else if(jNow&&tk-lastU<=DROP_WIN){ drop=true; if(itemBeforeU!==-2) ITEM=itemBeforeU; }    // B first: undo the switch
    if(drop){ J.forEach(c=>delete Kj[c]); U.forEach(c=>delete Kj[c]); lastJ=lastU=-99; dropItem(); return; }
    if(jNow) lastJ=tk;
    if(uNow){ lastU=tk; itemBeforeU=ITEM; }
  }
  function sharedTick(){
    if(carrier){
      if(carrier===p) carryBack();                                  // you swapped to it: the jack is yours now
      else if(carrier!==sibling()) carryBack();                     // sibling gone (solo, stage, respawn)
    }
    if(!shared.length) return;
    const h=playerCoreHB(p);
    const sib=sibling(), sh=sib&&!carrier&&!(sib._downT>0)&&!(sib._madT>0)?playerCoreHB(sib):null;
    for(const d of shared){
      if(d._grace>0){ if(--d._grace===0) d.got=false; continue; }
      if(d._sibCd>0) d._sibCd--;
      if(d.got) continue;
      if(_shutdownTimer>0||_itemUnlocked(d.item)) continue;
      if(ov(h.x-4,h.y-4,h.w+8,h.h+8+6,d.x,d.y,d.w,d.h)){
        d.got=true; _unlockedMask|=ITEM_UNLOCK_BITS[d.item]; ITEM=d.item;
        if(_itemEnhanced) _itemEnhanced[d.item]=!!d.enhanced;
        S('knowl_pickup'); burst(d.x+d.w/2,d.y+d.h/2,10,[ICOLS[d.item]||'#fff','#ffffff'],3);
      } else if(sh&&!carrier&&!(d._sibCd>0)&&ov(sh.x-4,sh.y-4,sh.w+8,sh.h+8+6,d.x,d.y,d.w,d.h)){
        d.got=true; sib._carry=d.item; sib._carryEnh=!!d.enhanced; carrier=sib;
        S('knowl_pickup'); burst(d.x+d.w/2,d.y+d.h/2,10,[ICOLS[d.item]||'#fff','#ffffff'],3);
        if(typeof uiShowToast==='function') uiShowToast((sib.hero==='venture'?'VENTURE':'MIND')+' TOOK THE '+(['TRS','RCA','XLR','MAG'][d.item]||'JACK'));
      }
    }
    for(const d of shared) if(!d.got&&ITEM_DROPS.indexOf(d)<0) giveBack(d);   // the stage cleared its drops
    shared=shared.filter(d=>d._grace>0||!d.got);
  }

  // ── the sibling USES the jack it carries (T174) ───────────────
  // MIND's own item code runs on its body (withPlayerContext), so damage, ricochet and sounds
  // match. It never spends your power bar (that bar is yours alone): its own cooldowns instead.
  const SJ={TRS:26, TRS_URGENT:16, XLR:96, XLR_R:190, MAG:120, MAG_ON:45, MAG_R:140, RCA:150, RCA_R:300, POW:0.7};
  function asBody(s,it,fn){
    const k={it:ITEM,D:isDn,L:isLf,R:isRt,U:isUp};
    ITEM=it; isDn=isLf=isRt=isUp=()=>false;
    try{ return withPlayerContext(s,fn); }
    finally{ ITEM=k.it; isDn=k.D; isLf=k.L; isRt=k.R; isUp=k.U; }
  }
  const chest=b=>({x:b.x+SW/2, y:b.y+FEET_OFF-STAND_H*0.45});
  function sibUse(s,t){
    const it=s._carry; if(it==null||it<0||it>3) return false;
    if(s._jackCd>0||!t) return true;
    const c=chest(s), dx=t.ex-c.x, dy=t.ey-c.y, d=Math.hypot(dx,dy)||1;
    const P=chest(p), seg=((P.x-c.x)*dx+(P.y-c.y)*dy)/(d*d);
    if(seg>0&&seg<1&&Math.hypot(c.x+dx*seg-P.x,c.y+dy*seg-P.y)<26){ s._jackCd=8; return true; }   // never across you
    s.aimDX=s.tAimDX=dx/d; s.aimDY=s.tAimDY=dy/d; if(Math.abs(dx)>6) s.fc=dx>0;
    const vol=s.hero==='venture'?1.15:1.3;
    if(it===0){                                                       // TRS: your shot, your ricochet
      if(!s.shots) s.shots=[]; if(!s.pulses) s.pulses=[]; if(!s.magPts) s.magPts=[];
      const enh=_itemEnhanced[0]; _itemEnhanced[0]=!!s._carryEnh;
      try{ asBody(s,0,()=>fireItem(false)); } finally{ _itemEnhanced[0]=enh; }
      s._jackCd=(t.dP<140||(p.hp||0)<(p.maxHp||100)*0.5)?SJ.TRS_URGENT:SJ.TRS;
    }else if(it===2){                                                 // XLR: your blast cone
      if(d>SJ.XLR_R||!B.blastEnemies) return true;
      const rp=B.relPow; B.relPow=SJ.POW; let n=0;
      try{ n=asBody(s,2,()=>B.blastEnemies(60)); } finally{ B.relPow=rp; }
      for(let k=0;k<10;k++){ const a=Math.atan2(dy,dx)+(Math.random()-0.5)*0.7, v=3+Math.random()*4; PFXS.push({x:c.x+dx/d*30,y:c.y+dy/d*30,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:14,maxLife:14,r:2.4,col:k%2?'#c8e8ff':'#ffffff'}); }
      if(!n) S('xlr_push',vol);
      s._jackCd=SJ.XLR; s._jackUsed=(s._jackUsed||0)+1;
    }else if(it===3){                                                 // MAG: a short pull, like yours
      if(d>SJ.MAG_R) return true;
      s._jackPull=SJ.MAG_ON; s._jackCd=SJ.MAG; S('mag',vol);
    }else if(it===1){                                                 // RCA: hooks it (your hook damage) and yanks it in
      const e=t.e; if(d>SJ.RCA_R||!e||!_enemyCombatActive(e)) return true;
      _damageEnemy(e,ENM_DMG.hook,t.ex,t.ey); _markEnemyItemForce(e,10);
      if(!e._boss&&!e._noGrab){
        const wgt=Math.max(0.5,Math.sqrt(((B.weightOf&&B.weightOf('enemy',e))||6)/6)), sp=7/wgt;
        e.vx=-dx/d*sp; e.vy=-dy/d*sp-2.5/wgt; e.og=false;
        if(e._ai){ e.mn=-1e6; e.mx=1e6; e._thrownF=24; e._reCenter=true; }
      }
      s._jackLine={e,t:14}; s._jackCd=SJ.RCA; s._jackUsed=(s._jackUsed||0)+1;
      S('hook',vol); S('hook_latch',vol);
    }
    s._shootT=40; s.fireRecoil=5; s.fireRecoilA=Math.atan2(dy,dx);
    return true;
  }
  function magPull(s){
    s._jackPull--; s._magShow=true; s._shootT=0;
    const c=chest(s), a=Math.atan2(s.aimDY||0,s.aimDX||(s.fc?1:-1)), tip={x:c.x+Math.cos(a)*44, y:c.y+Math.sin(a)*44};
    for(const e of ENEMS){
      if(!e||!e._ai||!e.alive||e._betaHeld||e._noGrab||e._hidden) continue;
      const f=_tipField(tip,a,e.x+e.w/2,e.y+e.h/2,SJ.MAG_R); if(!f) continue;
      const k=Math.min(1,f.prox*f.cone*1.1*(0.2+0.8*SJ.POW)*3), sp=(4+10*k)*(0.3+0.7*SJ.POW);
      const tvx=-f.ux*sp, tvy=-f.uy*sp-0.6*k, g=0.6*Math.max(0.35,k);
      if(e._ai&&!e._boss){ e._thrownF=Math.max(e._thrownF||0,8); e._tossT=2; e.mn=-1e6; e.mx=1e6; }   // its pull runs after their walk: carry it like a throw
      withPlayerContext(s,()=>_applyItemForceToEnemy(e,(tvx-(e.vx||0))*g,(tvy-(e.vy||0))*g));   // the item reach counts from its body
      s._jackPulled=(s._jackPulled||0)+1;
    }
    for(const bw of (B.flying||[])){                                  // a loose cube in the air comes along too
      const f=_tipField(tip,a,bw.x+(bw.w||32)/2,bw.y+(bw.h||32)/2,SJ.MAG_R); if(!f) continue;
      const s2=f.prox*f.cone*1.1*(0.2+0.8*SJ.POW); bw.vx=(bw.vx||0)-f.ux*s2; bw.vy=(bw.vy||0)-f.uy*s2;
    }
    if(s._jackPull%4===0) PFXS.push({x:tip.x+Math.cos(a)*60,y:tip.y+Math.sin(a)*60,vx:-Math.cos(a)*3,vy:-Math.sin(a)*3,life:12,maxLife:12,r:1.6,col:s._jackPull%8?'#ff5050':'#5080ff'});
  }
  function sibJackTick(){
    const s=sibling(); if(!s) return;
    if(s._jackCd>0) s._jackCd--;
    if(s._carry!==3) s._jackPull=0;
    if(s._jackPull>0) magPull(s);
    if(s._jackLine&&(--s._jackLine.t<=0||!s._jackLine.e.alive)) s._jackLine=null;
    if(s.shots&&s.shots.length){                                      // its shots fly on your shot code (flames tick once, from yours)
      const uf=window.updateTrsFlames; window.updateTrsFlames=function(){};
      try{ withPlayerContext(s,()=>window.updatePlayerShots()); } finally{ window.updateTrsFlames=uf; }
    }
  }
  function drawSibJack(){
    const s=sibling(); if(!s) return;
    if(s.shots) for(const q of s.shots){
      const col=q.owner==='venture'?'#ff4466':'#bb55ff';
      ctx.save(); ctx.lineCap='round'; ctx.strokeStyle=col; ctx.lineWidth=sw(6); ctx.globalAlpha=0.5;
      ctx.beginPath(); ctx.moveTo(sx(q.x-q.vx*1.6),sy(q.y-q.vy*1.6)); ctx.lineTo(sx(q.x),sy(q.y)); ctx.stroke();
      ctx.globalAlpha=1; ctx.strokeStyle='#fff0ff'; ctx.lineWidth=sw(2.5); ctx.stroke(); ctx.restore();
    }
    const L=s._jackLine; if(L&&L.e){
      const c=chest(s), ex=L.e.x+(L.e.w||0)/2, ey=L.e.y+(L.e.h||0)*0.42;
      ctx.save(); ctx.strokeStyle='#ffcc66'; ctx.lineWidth=Math.max(1.5,sw(2.5)); ctx.beginPath(); ctx.moveTo(sx(c.x),sy(c.y)); ctx.lineTo(sx(ex),sy(ey)); ctx.stroke(); ctx.restore();
    }
  }
  window.MV_SIB_JACK={ use:sibUse, SJ };

  // ── the boss intro ───────────────────────────────────────────
  // PAULO: final lines
  const LINES=[
    'SO. A LITTLE SPEAKER ROLLS INTO MY BOWL.',
    'YOUR KNOWLS ARE NOISE. YOUR SONG IS A LIE.',
    'SEVEN CORNERS. SEVEN SILENCES. KNEEL.',
    'COME, THEN. LET ME UNPLUG YOU.'
  ];
  function introTick(){
    const I=intro; I.t++;
    const J=binds('jump'), U=binds('use');
    const a=J.some(c=>Kj[c])||Kj['Enter'], b=U.some(c=>Kj[c]);
    if(I.out>0){ if(++I.out>24) intro=null; return; }
    if(I.t<24) return;                                             // the bars come in
    const L=LINES[I.line]||'';
    if(b){ I.out=1; return; }
    if(I.ch<L.length){ if(I.t%2===0){ I.ch++; if(I.ch%2===0&&L[I.ch-1]!==' ') blip(); } if(a) I.ch=L.length; I.hold=0; return; }
    I.hold++;
    if(a||I.hold>90){ I.line++; I.ch=0; I.hold=0; if(I.line>=LINES.length) I.out=1; }
  }
  function drawIntro(){
    const I=intro, W=ctx.canvas.width, H=ctx.canvas.height;
    const k=I.out>0?Math.max(0,1-I.out/24):Math.min(1,I.t/24), bar=Math.round(H*0.13*k);
    ctx.save();
    ctx.fillStyle='#000'; ctx.fillRect(0,0,W,bar); ctx.fillRect(0,H-bar,W,bar);
    if(k>0.9&&I.t>=24&&typeof drawTextC==='function'){
      const L=(LINES[I.line]||'').slice(0,I.ch);
      drawTextC('THE HEPTAGON',W/2,H-bar+10,'#ff8a96',1);
      drawTextC(L,W/2,H-bar+38,'#ffe0e0',2);
      drawTextC('A: NEXT   B: SKIP',W-120,bar-22,'#806870',1);
    }
    ctx.restore();
  }

  // ── bolts: heavy, and deflectable ────────────────────────────
  const BOLT_DMG=28;
  let knPrev=null;
  function heavyHit(b){
    if(hitCd>0||_shutdownTimer>0) return;
    hitCd=40; const s=b.vx>=0?1:-1;
    if(typeof applyPlayerHit==='function') applyPlayerHit(s*11,-8,BOLT_DMG);
    B.shake=Math.max(B.shake||0,9);
    burst(b.x,b.y,16,['#ff6070','#ffffff','#ffd0d0'],4);
  }
  function knock(b,vx,vy,col){ b.vx=vx; b.vy=vy; b.life=120; b.col=col||'#ffe39a'; free.push(b); burst(b.x,b.y,6,['#ffffff',b.col],3); }
  // the blade this frame: hand + 54 px along the knife's angle
  function blade(){
    const pose=B.knifePose&&B.knifePose(), P=p._armPose;
    if(!pose||!P||ITEM!==4) return null;
    return {hx:P.tipX, hy:P.tipY, kn:pose.knE};
  }
  function deflect(e){
    if(!e.bolts||!e.bolts.length) return;
    const bl=blade(), big=B.knifeBig&&B.knifeBig();
    const P=p._armPose, aim={x:p.aimDX||dirOf(), y:p.aimDY||0};
    const btn=typeof _bindDown==='function'&&_bindDown('swap');
    for(let i=e.bolts.length-1;i>=0;i--){
      const b=e.bolts[i];
      // the knife's swing: any blade position between last frame and this one
      if(bl&&knPrev&&Math.abs(wrap(bl.kn-knPrev))>0.1){
        const om=wrap(bl.kn-knPrev); let hit=false, aw=0;
        for(let s=0;s<=3&&!hit;s++){ aw=toW(knPrev+om*s/3); if(segDist(b.x,b.y,bl.hx,bl.hy,bl.hx+Math.cos(aw)*60,bl.hy+Math.sin(aw)*60)<20) hit=true; }
        if(hit){ const sg=(om>0?1:-1)*dirOf(), sp=11; e.bolts.splice(i,1); knock(b,-Math.sin(aw)*sg*sp+Math.cos(aw)*3,Math.cos(aw)*sg*sp+Math.sin(aw)*3); clang(0.9); continue; }
      }
      // a loaded slash: everything in its crescent goes flying along it
      if(big&&big.t<=8){ const ux=Math.cos(big.ang), uy=Math.sin(big.ang), dx=b.x-big.x, dy=b.y-big.y, al=dx*ux+dy*uy, ac2=-dx*uy+dy*ux;
        if(al>-30&&al<big.R&&Math.abs(ac2)<big.H){ const sp=13+12*(big.heat||0); e.bolts.splice(i,1); knock(b,ux*sp-uy*ac2*0.03,uy*sp+ux*ac2*0.03,'#fff4c0'); continue; } }
      if(!P||!btn) continue;
      const tx=P.tipX, ty=P.tipY, dx=b.x-tx, dy=b.y-ty, d=Math.hypot(dx,dy)||1;
      // XLR: the blast blows them off along the aim
      if(ITEM===2&&d<230&&(dx*aim.x+dy*aim.y)/d>0.6){ e.bolts.splice(i,1); knock(b,aim.x*10+dx/d*2,aim.y*10+dy/d*2,'#c8e8ff'); continue; }
      // MAG: pulled in to the poles
      if(ITEM===3&&d<260){ e.bolts.splice(i,1); b.mag=true; knock(b,-dx/d*6,-dy/d*6,'#ffb0c0'); continue; }
    }
  }
  function freeTick(){
    if(!free.length) return;
    const P=p._armPose, magHeld=ITEM===3&&typeof _bindDown==='function'&&_bindDown('swap')&&P;
    const bs=boss();
    for(let i=free.length-1;i>=0;i--){
      const b=free[i];
      if(b.mag){
        if(magHeld){ const dx=P.tipX-b.x, dy=P.tipY-b.y, d=Math.hypot(dx,dy)||1;
          if(d<22){ b.held=true; b.x=P.tipX+Math.cos(tk*0.3+i)*10; b.y=P.tipY+Math.sin(tk*0.3+i)*10; b.vx=b.vy=0; b.life=120; continue; }
          b.vx=b.vx*0.85+dx/d*1.6; b.vy=b.vy*0.85+dy/d*1.6; }
        else{ b.mag=false; if(b.held){ const ax=p.aimDX||dirOf(), ay=p.aimDY||0; b.vx=ax*12; b.vy=ay*12; b.held=false; S('punch_whiff',1.6); } }
      }
      b.x+=b.vx; b.y+=b.vy; b.life--;
      if(b.life<=0||solid(b.x,b.y)){ burst(b.x,b.y,5,[b.col||'#ffe39a','#ffffff'],2); free.splice(i,1); continue; }
      if(bs&&bs.alive&&Math.hypot(b.x-(bs.x+bs.w/2),b.y-(bs.y+bs.h/2))<62){
        bs.hp=Math.max(1,bs.hp-8); bs.hitF=6; B.shake=Math.max(B.shake||0,4);
        burst(b.x,b.y,12,['#ffffff','#ffd060','#ff6060'],4); S('omniblock_chip',1.2); free.splice(i,1); }
    }
  }
  const _ft=B.foeTick;
  B.foeTick=function(e){
    if(e&&e._foe==='boss'&&on()&&p){
      try{
        deflect(e);
        const P=centre();
        for(let i=e.bolts.length-1;i>=0;i--){ const b=e.bolts[i];
          if(Math.hypot(b.x+b.vx-P.x,b.y+b.vy-P.y)<26){ heavyHit(b); e.bolts.splice(i,1); } }
      }catch(er){ console.warn('knife bolts',er); }
    }
    return _ft.apply(this,arguments);
  };
  const _fd=B.foeDraw;
  B.foeDraw=function(e){
    const r=_fd.apply(this,arguments);
    if(e&&e._foe==='boss'&&free.length){
      try{ ctx.save(); ctx.globalCompositeOperation='lighter';
        for(const b of free){ ctx.fillStyle=b.col||'#ffe39a'; ctx.beginPath(); ctx.arc(sx(b.x),sy(b.y),Math.max(3,sw(7)),0,Math.PI*2); ctx.fill();
          ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(sx(b.x),sy(b.y)); ctx.lineTo(sx(b.x-b.vx*2),sy(b.y-b.vy*2)); ctx.stroke(); }
        ctx.restore(); }catch(er){}
    }
    return r;
  };

  // ── knife feel: whooshes, blade on rock, shing, hum ──────────
  let swingOn=false, swingN=0, swingClanged=false, lastBig=null, lastItem=-1;
  function knifeFeel(){
    if(ITEM===4&&lastItem!==4) shing();
    lastItem=ITEM;
    humTick(ITEM===4&&B.knifeHeat?B.knifeHeat():0);
    const big=B.knifeBig&&B.knifeBig();
    if(big&&big!==lastBig){
      const f=Math.min(1,Math.max(0,(big.R-176)/(430-176)));
      whoosh(0.28+0.2*f,420-160*f,1600-500*f,0.16);
      meetBlade(big.x,big.y,Math.cos(big.ang),Math.sin(big.ang),big.R,big.H,f>0.85);
    }
    lastBig=big;
    const bl=blade();
    if(!bl){ knPrev=null; swingOn=false; return; }
    const om=knPrev==null?0:wrap(bl.kn-knPrev), fast=Math.abs(om)>0.14;
    if(fast&&!swingOn){ swingN++; swingClanged=false;
      const up=om<0, alt=swingN%2?1:0.9;
      whoosh(0.12,(up?1600:1300)*alt,(up?3600:2800)*alt,0.1); }
    swingOn=fast;
    if(fast&&!swingClanged&&knPrev!=null){
      for(let s=0;s<=4&&!swingClanged;s++){
        const aw=toW(knPrev+om*s/4);
        const x1=bl.hx+Math.cos(aw)*62, y1=bl.hy+Math.sin(aw)*62;
        if(meetBlade(bl.hx,bl.hy,Math.cos(aw),Math.sin(aw),62,22,false)) swingClanged=true;
        else if(wallAhead(x1,y1,Math.cos(aw),Math.sin(aw))){ swingClanged=true; bladeHit(x1,y1,Math.min(1,Math.abs(om)/0.5),Math.cos(aw),Math.sin(aw)); }
      }
    }
    knPrev=bl.kn;
  }
  // The floor under the wheel is not a hit. A wall in front of the blade is.
  function wallAhead(x,y,ux,uy){
    if(!solid(x,y)) return false;
    const feet=p.y+(typeof FEET_OFF!=='undefined'?FEET_OFF:88);
    if(y>=feet-10&&Math.abs(x-(p.x+SW/2))<46) return false;
    return uy<0.35||Math.abs(x-(p.x+SW/2))>28;
  }
  // Objects the blade can meet: cubes, crates, enemies. An electro-box shocks.
  function meetBlade(ox,oy,ux,uy,reach,half,loaded){
    const hit=(x,y)=> {
      const dx=x-ox, dy=y-oy, along=dx*ux+dy*uy, across=-dx*uy+dy*ux;
      return along>8&&along<reach&&Math.abs(across)<half;
    };
    for(const bw of (typeof BWALLS!=='undefined'?BWALLS:[])){
      if(!bw||bw.hp<=0||bw.only==='vine') continue;
      const x=bw.x+(bw._ox||0)+(bw.w||32)/2, y=bw.y+(bw._oy||0)+(bw.h||32)/2;
      if(!hit(x,y)) continue;
      if(bw.only==='laser'){
        try{ if(window._shockFromBlock) _shockFromBlock(bw, loaded?'punchLoaded':'punch'); }catch(e){}
        return true;
      }
      bladeHit(x,y,loaded?0.85:0.55,ux,uy);
      return true;
    }
    for(const c of (typeof CRATES!=='undefined'?CRATES:[])){
      if(!c) continue;
      const x=c.x+c.w/2, y=c.y+c.h/2;
      if(!hit(x,y)) continue;
      bladeHit(x,y,0.7,ux,uy);
      return true;
    }
    for(const e of (typeof ENEMS!=='undefined'?ENEMS:[])){
      if(!e||!e.alive||e._betaHeld) continue;
      const x=e.x+e.w/2, y=e.y+e.h/2;
      if(!hit(x,y)) continue;
      if(e._boss) continue;
      bladeHit(x,y,loaded?0.9:0.6,ux,uy);
      return true;
    }
    return false;
  }
  function bladeHit(x,y,k,ux,uy){
    clang(k); hitstop=2+(k>0.6?1:0);
    B.shake=Math.max(B.shake||0,3+4*k);
    burst(x,y,8+Math.round(10*k),['#fff4c0','#ffb040','#ffffff'],3+3*k);
    marks.push({x,y,ux,uy,life:50});
    p.vx-=ux*(1.5+2.5*k);                                          // the rock pushes back
  }
  function marksTick(){ for(const m of marks) m.life--; marks=marks.filter(m=>m.life>0); }

  // ── the finish: knife → gate → golden beam ───────────────────
  function knifeStart(){
    const P=p._armPose;
    return P?{x:P.tipX,y:P.tipY}:{x:p.x+SW/2,y:p.y+FEET_OFF-60};
  }
  function startFinish(){
    const g=B.gate; if(!g){ dropKnife(); return; }
    const s=knifeStart();
    finish={st:'fly', t:0, sx:s.x, sy:s.y, gx:g.x+g.w/2, gy:g.y+g.h*0.45, x:s.x, y:s.y, rot:0, motes:[]};
    dropKnife(); S('punch_whiff',0.6); whoosh(0.9,600,2400,0.12);
  }
  function dropKnife(){
    _unlockedMask&=~16;
    if(ITEM===4){ ITEM=-1; if(_unlockedMask) _cycleItem(); }
    if(B.knifePickup) B.knifePickup.got=true;
  }
  const FLY=70, BEAM=150;
  function finishTick(){
    const F=finish; F.t++;
    if(F.st==='fly'){
      const u=Math.min(1,F.t/FLY), e=u*u*(3-2*u), lift=Math.sin(u*Math.PI)*160;
      F.x=F.sx+(F.gx-F.sx)*e; F.y=F.sy+(F.gy-F.sy)*e-lift; F.rot+=0.45;
      PFXS.push({x:F.x,y:F.y,vx:(Math.random()-0.5)*1.5,vy:(Math.random()-0.5)*1.5,life:16,maxLife:20,r:2+Math.random()*2,col:['#fff4c0','#ffb040','#ff7030'][F.t%3]});
      if(F.t>=FLY){ F.st='strike'; F.t=0; F.x=F.gx; F.y=F.gy;
        clang(1); B.shake=Math.max(B.shake||0,14); burst(F.gx,F.gy,40,['#ffffff','#ffe39a','#ffb040'],6);
        B.open=true; S('gate'); S('unlock');
        if(typeof uiShowToast==='function') uiShowToast('THE KIRITSUKE OPENS THE GATE'); }
    }else if(F.st==='strike'){
      F.rot=wrap(F.rot)*0.8; if(Math.abs(F.rot)<0.02) F.rot=0;
      if(F.t>=30){ F.st='beam'; F.t=0; chord(); }
    }else if(F.st==='beam'){
      F.rot=0;
      if(Math.random()<0.7) F.motes.push({x:F.x+(Math.random()-0.5)*50,y:F.y+30,vy:-(1.5+Math.random()*3),life:1});
      for(const m of F.motes){ m.y+=m.vy; m.life-=0.012; }
      F.motes=F.motes.filter(m=>m.life>0);
      if(F.t>=BEAM){ burst(F.x,F.y,30,['#fff8d0','#ffe060'],5); finish=null; }
    }
  }
  function drawFinish(){
    const F=finish; if(!F||!B.drawKnifeArt) return;
    const x=sx(F.x), y=sy(F.y);
    ctx.save();
    if(F.st==='beam'){
      const u=F.t/BEAM, grow=Math.min(1,F.t/30), fade=Math.min(1,(BEAM-F.t)/40), a=grow*fade;
      const hh=ctx.canvas.height, wB=sw(18+40*Math.sin(Math.min(1,u*1.4)*Math.PI/2));
      ctx.globalCompositeOperation='lighter';
      const g=ctx.createLinearGradient(x-wB,0,x+wB,0);
      g.addColorStop(0,'rgba(255,200,80,0)'); g.addColorStop(0.5,'rgba(255,240,180,'+(0.85*a)+')'); g.addColorStop(1,'rgba(255,200,80,0)');
      ctx.fillStyle=g; ctx.fillRect(x-wB,-10,wB*2,hh+20);
      ctx.fillStyle='rgba(255,255,240,'+(0.9*a)+')'; ctx.fillRect(x-sw(3),-10,sw(6),hh+20);
      const rg=ctx.createRadialGradient(x,y,4,x,y,sw(140)); rg.addColorStop(0,'rgba(255,230,150,'+(0.5*a)+')'); rg.addColorStop(1,'rgba(255,230,150,0)');
      ctx.fillStyle=rg; ctx.fillRect(x-sw(140),y-sw(140),sw(280),sw(280));
      for(const m of F.motes){ ctx.fillStyle='rgba(255,240,170,'+(m.life*a)+')'; ctx.fillRect(sx(m.x)-1.5,sy(m.y)-1.5,3,3); }
      ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=Math.max(0,1-u*1.3);
    }
    ctx.translate(x,y); ctx.rotate(F.st==='fly'?F.rot:-Math.PI/2);
    B.drawKnifeArt(F.st==='fly'?-28:-28,0,sw(1.3),F.st==='fly'?0.6:0.3);
    ctx.restore();
  }
  function drawMarks(){
    if(!marks.length) return;
    ctx.save(); ctx.lineCap='round';
    for(const m of marks){ const a=m.life/50; ctx.strokeStyle='rgba(255,'+(160+90*a|0)+',80,'+(0.8*a)+')'; ctx.lineWidth=Math.max(1.5,sw(2));
      ctx.beginPath(); ctx.moveTo(sx(m.x-m.uy*10),sy(m.y+m.ux*10)); ctx.lineTo(sx(m.x+m.uy*10),sy(m.y-m.ux*10)); ctx.stroke(); }
    ctx.restore();
  }

  // ── wiring ───────────────────────────────────────────────────
  const _up=window.update;
  window.update=function(){
    if(!on()){ return _up.apply(this,arguments); }
    tk++;
    if(intro){ try{ introTick(); }catch(er){ intro=null; } if(typeof clkj==='function') clkj(); return; }   // the scene holds
    if(hitstop>0){ hitstop--; return; }                            // the blade bit rock
    try{ dropInput(); }catch(er){ console.warn('drop',er); }
    const r=_up.apply(this,arguments);
    try{
      if(!on()) return r;
      if(hitCd>0) hitCd--;
      sharedTick(); sibJackTick(); knifeFeel(); freeTick(); marksTick();
      const bs=boss();
      if(B.stageId==='1.3'&&bs){
        if(B.bossMeet&&!introSeen&&bs.alive&&!B.freeze){ introSeen=true; intro={t:0,line:0,ch:0,hold:0,out:0}; }
        wasBossOn=!!B.bossMeet;
        if(bs.alive) bossLive=true;
        else if(bossLive){ bossLive=false; finishPending=true; }
      }
      if(finishPending&&!B.freeze){ finishPending=false; startFinish(); }
      if(finish&&!B.freeze) finishTick();
    }catch(er){ console.warn('knife',er); }
    return r;
  };
  const _cf=window._cameraFollowTarget;
  if(typeof _cf==='function') window._cameraFollowTarget=function(pl){
    const bs=intro&&boss();
    if(bs&&B.on&&typeof camViewW==='function'){ const vw=camViewW(), vh=camViewH(); return {x:bs.x+bs.w/2-vw/2, y:bs.y+bs.h/2-vh/2}; }
    return _cf.apply(this,arguments);
  };
  const _hud=window.drawLdtkLabHud;
  window.drawLdtkLabHud=function(){
    const r=_hud.apply(this,arguments);
    try{ if(B.on){ drawMarks(); drawFinish(); drawSibJack();
      for(const d of shared){ if(d._grace>0){ const u=1-d._grace/36, x=d._fromX+(d.x+d.w/2-d._fromX)*u, y=d._fromY+(d.y+d.h/2-d._fromY)*u-Math.sin(u*Math.PI)*30;
        ctx.fillStyle=ICOLS[d.item]||'#fff'; ctx.fillRect(sx(x)-sw(10),sy(y)-sw(10),sw(20),sw(20)); } } } }catch(er){}
    return r;
  };
  const _dh=window.drawHUD;
  window.drawHUD=function(){
    const r=_dh.apply(this,arguments);
    try{ if(B.on&&intro) drawIntro(); }catch(er){}
    return r;
  };
  window.MV_KNIFE={ state:()=>({intro:!!intro, introSeen, finish:finish&&finish.st, free:free.length, shared:shared.length, sibCarry:carrier?carrier._carry:null}), drop:()=>on()&&dropItem() };
  window.MV_KNIFE_SFX={ swing(big){ if(big){ whoosh(0.36,320,1500,0.26); } else { whoosh(0.14,700,3200,0.2); } } };
})();
