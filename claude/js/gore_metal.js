// ============================================================
//  gore_metal.js — GORE goes heavy metal (Sumi, T141, Halloween)
//  Only while FILTER is GORE (MV_CONSOLE.mode==='gore').
//    - grade uniforms for beta_gore.js's shader: duotone, crushed blacks,
//      grain, a red vignette that breathes on the beat, RGB split on hits,
//      rare red lightning (one flash per 7 s at most, never in reduced motion)
//    - hit-stop + shake on kills, chunky gibs that bounce, stick and drip
//    - embers, low fog, bats, a blood moon in the sky
//    - Metal Mania (SIL OFL, assets/fonts) for every drawText label,
//      kill callouts (BRUTAL / SHREDDED / \m/) with a combo counter
//  Beat: Echo's MV_GORE_BEAT {phase 0..1, down} when present, else 132 BPM.
// ============================================================
(function(){
  'use strict';
  const FLASH_MIN_MS=7000;                // red lightning, far under 3 flashes per second
  const BPM_FALLBACK=132;
  const gibs=[], embers=[], calls=[], splats=[], bats=[];
  let hitStop=0, shake=0, split=0, flash=0, lastFlash=-1e9, combo=0, comboT=0, comboShow=0;
  let bolt=null, wasDown=false, fontOk=false, fontOn=false;

  function on(){ return !!(window.MV_CONSOLE&&MV_CONSOLE.mode==='gore')&&!/[?&](selftest|ci=)/.test(location.search||''); }
  function playing(){ return on()&&typeof _gameState!=='undefined'&&_gameState==='game'; }
  let rmq=null; try{ rmq=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)'); }catch(e){}
  function calm(){
    if(rmq&&rmq.matches) return true;
    try{ if(typeof OPT!=='undefined'&&OPT&&(OPT.reduceMotion||OPT.shake===false||OPT.shake===0)) return true; }catch(e){}
    return false;
  }
  function now(){ return (window.performance&&performance.now)?performance.now():Date.now(); }

  function beat(){
    const b=window.MV_GORE_BEAT;
    let ph=null, down=false;
    try{
      const v=typeof b==='function'?b():b;
      if(v&&isFinite(v.phase)){ ph=v.phase; down=!!v.down; }
    }catch(e){}
    if(ph==null){ const per=60000/BPM_FALLBACK, t=now()/per; ph=t-Math.floor(t); down=(Math.floor(t)%4===0)&&ph<0.12; }
    return {phase:Math.max(0,Math.min(1,ph)), down};
  }

  // ── grade uniforms read by beta_gore.js grade() ──
  function uniforms(){
    if(!on()) return null;
    const b=beat(), c=calm();
    return {
      t:(now()/1000)%1000,
      beat:c?0.4:Math.pow(1-b.phase,3),
      split:c?Math.min(split,1):split,
      flash:c?0:flash,
      metal:1
    };
  }
  function canFlash(t){ return t-lastFlash>=FLASH_MIN_MS; }

  // ── metal type: drawText (core.js) asks _uiFontSpec for its face ──
  try{
    if(typeof FontFace!=='undefined'&&document.fonts){
      new FontFace('MV Metal','url(assets/fonts/metalmania-400.woff2) format("woff2")',{weight:'400'}).load()
        .then(f=>{ document.fonts.add(f); fontOk=true; }).catch(()=>{});
    }
  }catch(e){}
  const _baseSpec=typeof window._uiFontSpec==='function'?window._uiFontSpec:null;
  if(_baseSpec){
    window._uiFontSpec=function(scl){
      if(fontOn){ const px=scl>=2?Math.round(11.5*scl):15; return Math.round(px*0.86)+'px "MV Metal", "MV Pixel", serif'; }
      return _baseSpec(scl);
    };
  }
  function syncFont(){
    const want=fontOk&&on();
    if(want===fontOn) return;
    fontOn=want;
    try{ if(typeof _uiTwCache!=='undefined') _uiTwCache.clear(); }catch(e){}
  }

  // ── hits and kills ──
  function solid(x,y){
    try{
      if(typeof gridSolid!=='function'||typeof MV_GRID==='undefined'||!MV_GRID||!MV_GRID.tile) return false;
      const t=MV_GRID.tile; return gridSolid(Math.floor(x/t),Math.floor(y/t));
    }catch(e){ return false; }
  }
  function gibBurst(x,y,dir){
    const n=7+(Math.random()*5|0);
    for(let i=0;i<n;i++){
      const a=dir+(Math.random()-0.5)*2.2;
      const sp=3+Math.random()*6;
      gibs.push({x,y,vx:Math.cos(a)*sp,vy:-3-Math.random()*5,w:3+Math.random()*5,h:2+Math.random()*4,
        rot:Math.random()*6,vr:(Math.random()-0.5)*0.5,bone:i%4===0,stuck:false,bounce:0,drip:0,dripMax:10+Math.random()*30,life:600+Math.random()*300|0});
    }
    if(gibs.length>90) gibs.splice(0,gibs.length-90);
  }
  const WORDS=['BRUTAL','SHREDDED','\\m/','SLAUGHTER','UNHOLY','BRUTAL'];
  function callout(x,y){
    comboT=150; combo++;
    const word=combo>=3?(combo%2?'\\m/':'SHREDDED'):WORDS[(Math.random()*WORDS.length)|0];
    calls.push({x,y,word,t:0,max:70});
    if(calls.length>6) calls.shift();
    if(combo>=2) comboShow=120;
  }
  function wrap(name,after){
    const orig=window[name];
    if(typeof orig!=='function'||orig._goreMetal) return;
    const w=function(){ const pre=arguments[0]&&arguments[0].hp; const r=orig.apply(this,arguments); try{ after.call(this,arguments,pre); }catch(e){} return r; };
    w._goreMetal=true; window[name]=w;
  }
  wrap('_damageEnemy',function(args,hpBefore){
    if(!playing()) return;
    const e=args[0]; if(!e) return;
    const dmg=+args[1]||0;
    if(e.hp<=0&&!e._mvGib&&(hpBefore==null||hpBefore>0)){
      e._mvGib=true;
      const x=(e.x||0)+(e.w||32)*0.5, y=(e.y||0)+(e.h||32)*0.4;
      const dir=(typeof p!=='undefined'&&p&&p.fc)?0:Math.PI;
      gibBurst(x,y,dir);
      callout(x,y-(e.h||32)*0.5);
      hitStop=3; split=Math.max(split,4); if(!calm()) shake=Math.max(shake,9);
    } else if(dmg>=3){ hitStop=Math.max(hitStop,2); split=Math.max(split,2.5); }
  });
  wrap('applyPlayerHit',function(){
    if(!playing()) return;
    split=Math.max(split,3); if(!calm()) shake=Math.max(shake,5);
    if(Math.random()<0.35&&typeof W==='number'){
      const side=(Math.random()*4)|0;
      const x=side===0?0:side===1?W:Math.random()*W, y=side===2?0:side===3?H:Math.random()*H;
      splats.push({x,y,r:Math.min(W,H)*(0.16+Math.random()*0.12),life:1});
      if(splats.length>4) splats.shift();
    }
  });

  // ── hit-stop: skip a few world updates on big hits ──
  const _update=window.update;
  if(typeof _update==='function'){
    window.update=function(){
      if(hitStop>0&&playing()){ hitStop--; return; }
      const r=_update.apply(this,arguments);
      try{ tick(); }catch(e){}
      return r;
    };
  }
  function tick(){
    syncFont();
    if(!playing()){ gibs.length=0; calls.length=0; splats.length=0; embers.length=0; bats.length=0; bolt=null; flash=0; split=0; shake=0; combo=0; return; }
    if(comboT>0) comboT--; else combo=0;
    if(comboShow>0) comboShow--;
    split*=0.8; if(split<0.15) split=0;
    shake*=0.82; if(shake<0.3) shake=0;
    flash*=0.84; if(flash<0.01) flash=0;
    for(let i=gibs.length-1;i>=0;i--){
      const g=gibs[i];
      if(--g.life<=0){ gibs.splice(i,1); continue; }
      if(g.stuck){ if(g.drip<g.dripMax) g.drip+=0.12; continue; }
      g.vy+=0.38; g.vx*=0.99;
      const nx=g.x+g.vx, ny=g.y+g.vy;
      if(solid(nx,g.y)){ g.vx*=-0.35; if(Math.random()<0.45){ g.stuck=true; continue; } }
      else g.x=nx;
      if(solid(g.x,ny)){
        if(g.vy>0&&++g.bounce>=2){ g.stuck=true; g.vy=0; g.dripMax=0; continue; }
        g.vy*=-0.42; g.vx*=0.7;
      } else g.y=ny;
      g.rot+=g.vr;
    }
    for(let i=calls.length-1;i>=0;i--){ if(++calls[i].t>=calls[i].max) calls.splice(i,1); }
    for(let i=splats.length-1;i>=0;i--){ splats[i].life-=0.008; if(splats[i].life<=0) splats.splice(i,1); }
    if(typeof W==='number'){
      if(embers.length<22&&Math.random()<0.35) embers.push({x:Math.random()*W,y:H+4,vx:(Math.random()-0.5)*0.6,vy:-0.6-Math.random()*1.4,life:1,r:1+Math.random()*1.8});
      for(let i=embers.length-1;i>=0;i--){ const e=embers[i]; e.x+=e.vx+Math.sin((e.y+i*40)*0.03)*0.3; e.y+=e.vy; e.life-=0.006; if(e.life<=0||e.y<-6) embers.splice(i,1); }
    }
  }

  // ── sky: blood moon, bats, lightning on downbeats ──
  const BLOOD_MOON={x:0.74,y:0.17,r:40,col:'#b0101c',edge:'#5a0208'};
  function hookSky(){
    const S=window.MV_SKY;
    if(!S||typeof S.draw!=='function'||S.draw._goreMetal) return;
    const orig=S.draw;
    const w=function(B,horizon){
      if(!on()) return orig.apply(this,arguments);
      const T=S.THEMES||{}, th=T[(B&&B.stageId)]||T.default;
      const keep=th?th.moon:null;
      if(th) th.moon=BLOOD_MOON;
      let r;
      try{ r=orig.apply(this,arguments); } finally { if(th) th.moon=keep; }
      try{ skyExtras(horizon); }catch(e){}
      return r;
    };
    w._goreMetal=true; S.draw=w;
  }
  function skyExtras(horizon){
    if(typeof ctx==='undefined'||typeof W!=='number') return;
    const t=now(), b=beat();
    if(b.down&&!wasDown&&!bolt&&canFlash(t)&&Math.random()<0.3){
      lastFlash=t;
      const pts=[]; let x=W*(0.15+Math.random()*0.7), y=0;
      const end=Math.max(H*0.25,(horizon||H*0.6)-40);
      while(y<end){ pts.push([x,y]); x+=(Math.random()-0.5)*48; y+=18+Math.random()*26; }
      bolt={pts,life:1};
      if(!calm()) flash=0.32;
    }
    wasDown=b.down;
    if(bolt){
      ctx.save(); ctx.lineJoin='miter';
      ctx.strokeStyle='rgba(255,60,60,'+(0.85*bolt.life).toFixed(3)+')'; ctx.lineWidth=3;
      ctx.shadowColor='rgba(255,0,20,0.8)'; ctx.shadowBlur=12;
      ctx.beginPath(); bolt.pts.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); ctx.stroke();
      ctx.restore();
      bolt.life-=0.08; if(bolt.life<=0) bolt=null;
    }
    if(bats.length<3&&Math.random()<0.004){
      const dir=Math.random()<0.5?1:-1;
      bats.push({x:dir>0?-20:W+20,y:H*(0.08+Math.random()*0.3),vx:dir*(1.6+Math.random()*1.4),ph:Math.random()*6,s:0.8+Math.random()*0.7});
    }
    ctx.save(); ctx.fillStyle='#0a0004';
    for(let i=bats.length-1;i>=0;i--){
      const bt=bats[i]; bt.x+=bt.vx; bt.y+=Math.sin(bt.ph+bt.x*0.03)*0.6; bt.ph+=0.35;
      if(bt.x<-40||bt.x>W+40){ bats.splice(i,1); continue; }
      const f=Math.sin(bt.ph)*5*bt.s, s=bt.s*6;
      ctx.beginPath(); ctx.moveTo(bt.x,bt.y);
      ctx.lineTo(bt.x-s*1.6,bt.y-f); ctx.lineTo(bt.x-s*0.8,bt.y+1); ctx.lineTo(bt.x-s*0.3,bt.y-1);
      ctx.lineTo(bt.x,bt.y+2);
      ctx.lineTo(bt.x+s*0.3,bt.y-1); ctx.lineTo(bt.x+s*0.8,bt.y+1); ctx.lineTo(bt.x+s*1.6,bt.y-f);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  hookSky();

  // ── paint: called by beta_gore.js grade() right before the canvas is graded ──
  function metalText(s,x,y,px,col,a){
    ctx.save();
    ctx.globalAlpha=a; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font=px+'px '+(fontOk?'"MV Metal", ':'')+'Impact, serif';
    ctx.lineJoin='miter'; ctx.lineWidth=Math.max(3,px*0.16); ctx.strokeStyle='#0a0004'; ctx.strokeText(s,x,y);
    const g=ctx.createLinearGradient(0,y-px*0.5,0,y+px*0.5);
    g.addColorStop(0,'#f2e8da'); g.addColorStop(0.5,col); g.addColorStop(1,'#4a0008');
    ctx.fillStyle=g; ctx.fillText(s,x,y);
    ctx.restore();
  }
  function paint(){
    if(!playing()||typeof ctx==='undefined'||typeof sx!=='function'){
      const oc=document.querySelector('canvas.mv-gore-grade'); if(oc&&oc.style.transform) oc.style.transform='';
      return;
    }
    if(typeof _worldZoomBegin==='function') _worldZoomBegin();
    for(const g of gibs){
      const a=Math.min(1,g.life/90);
      ctx.save(); ctx.globalAlpha=a;
      ctx.translate(sx(g.x),sy(g.y)); ctx.rotate(g.rot);
      const w=Math.max(2,sw(g.w)), h=Math.max(2,sw(g.h));
      ctx.fillStyle=g.bone?'#e8dccb':'#6a0010'; ctx.fillRect(-w/2,-h/2,w,h);
      ctx.fillStyle=g.bone?'#8a0014':'#a8001a'; ctx.fillRect(-w/2,-h/2,w*0.5,h*0.45);
      ctx.restore();
      if(g.stuck&&g.drip>0){ ctx.fillStyle='rgba(110,0,14,'+(0.8*a).toFixed(3)+')'; ctx.fillRect(sx(g.x)-1,sy(g.y),2,sw(g.drip)); }
    }
    if(typeof _worldZoomEnd==='function') _worldZoomEnd();
    // embers + low fog
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    for(const e of embers){ ctx.fillStyle='rgba(255,'+(90+(e.life*90|0))+',30,'+(e.life*0.8).toFixed(3)+')'; ctx.fillRect(e.x,e.y,e.r,e.r); }
    ctx.globalCompositeOperation='source-over';
    const fy=H*0.8, fog=ctx.createLinearGradient(0,fy,0,H);
    const drift=0.1+0.04*Math.sin(now()*0.0004);
    fog.addColorStop(0,'rgba(60,8,14,0)'); fog.addColorStop(1,'rgba(70,14,20,'+drift.toFixed(3)+')');
    ctx.fillStyle=fog; ctx.fillRect(0,fy,W,H-fy);
    // lens splatter at the edge on heavy damage
    for(const s of splats){
      const g=ctx.createRadialGradient(s.x,s.y,s.r*0.2,s.x,s.y,s.r);
      g.addColorStop(0,'rgba(110,0,12,'+(0.7*s.life).toFixed(3)+')'); g.addColorStop(1,'rgba(110,0,12,0)');
      ctx.fillStyle=g; ctx.fillRect(s.x-s.r,s.y-s.r,s.r*2,s.r*2);
    }
    ctx.restore();
    // kill callouts and the combo counter
    for(const c of calls){
      const k=c.t/c.max, pop=c.t<6?0.6+c.t*0.1:1+Math.max(0,0.15-(c.t-6)*0.02);
      metalText(c.word,sx(c.x),sy(c.y)-k*30,Math.round(26*pop),'#d4001e',1-Math.max(0,(k-0.6)/0.4));
    }
    if(comboShow>0&&combo>=2) metalText('COMBO x'+combo,W-90,46,22,'#ff2a3a',Math.min(1,comboShow/20));
    // shake the graded picture
    const oc=document.querySelector('canvas.mv-gore-grade');
    if(oc){ const tf=shake>0?'translate('+((Math.random()-0.5)*shake).toFixed(1)+'px,'+((Math.random()-0.5)*shake).toFixed(1)+'px)':''; if(oc.style.transform!==tf) oc.style.transform=tf; }
  }

  window.MV_GORE_FX={uniforms, paint, canFlash, FLASH_MIN_MS, get on(){ return on(); }};
})();
