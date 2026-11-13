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
//  Part 2 (T399):
//    - mad faces on enemies (players' heads already go mad in render.js drawHead)
//    - blood pools under kills; walking through smears them in the direction
//      of travel and leaves bloody footprints for a moment
//    - sprites near hot things (stove, candles, lanterns) char: dark tint + embers
//    - candles and jack-o'-lanterns on ledges, warm slow flicker (still in reduced motion)
//  Beat: Echo's MV_GORE_BEAT {phase 0..1, down} when present, else 132 BPM.
// ============================================================
(function(){
  'use strict';
  const FLASH_MIN_MS=7000;                // red lightning, far under 3 flashes per second
  const BPM_FALLBACK=132;
  let lite=false; try{ lite=!!(window.matchMedia&&matchMedia('(pointer: coarse)').matches); }catch(e){}
  const CAP={pools:lite?6:12, streaks:lite?30:70, prints:lite?16:36, props:lite?8:16, flecks:lite?16:40};
  const gibs=[], embers=[], calls=[], splats=[], bats=[];
  const pools=[], streaks=[], prints=[], flecks=[];
  let hotNow=[], hotNext=[], props=null, propsFor=null, bloody=0, stepSide=0;
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
  // riding an elevator down fades the GORE grade in (beta_gore.js multiplies metal by that amount),
  // so the metal layer comes with it, not only when GORE is picked (Paulo, Nov 11)
  function rideDown(){ const L=window.MV_LIFT; return L&&(L.pull||0)<-0.015&&!/[?&](selftest|ci=)/.test(location.search||''); }
  function uniforms(){
    if(!on()&&!rideDown()) return null;
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
  // Paulo, Nov 13: the metal words only when a foe is OFF FOR GOOD; a 1st / 2nd shutdown, it talks back
  const TAUNTS=['NICE TRY.',"I'M NOT OFF YET, FOOL!",'IS THAT ALL?','HA! STILL HUMMING.',"YOU'LL HAVE TO DO BETTER."];
  function taunt(x,y){ calls.push({x,y,word:TAUNTS[(Math.random()*TAUNTS.length)|0],t:0,max:90,lane:calls.length%3,taunt:true}); if(calls.length>6) calls.shift(); }
  function callout(x,y){
    comboT=150; combo++;
    const word=combo>=3?(combo%2?'\\m/':'SHREDDED'):WORDS[(Math.random()*WORDS.length)|0];
    calls.push({x,y,word,t:0,max:80,lane:calls.length%3});
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
    if(e.hp<=0&&!e._mvGib&&(hpBefore==null||hpBefore>0)&&!(e._lastShutPerm||e._permOff||e._stayDown||e._boss)){
      taunt((e.x||0)+(e.w||32)*0.5,(e.y||0)-8); hitStop=Math.max(hitStop,2);
    } else if(e.hp<=0&&!e._mvGib&&(hpBefore==null||hpBefore>0)){
      e._mvGib=true;
      const x=(e.x||0)+(e.w||32)*0.5, y=(e.y||0)+(e.h||32)*0.4;
      const dir=(typeof p!=='undefined'&&p&&p.fc)?0:Math.PI;
      gibBurst(x,y,dir);
      pool(x,(e.y||0)+(e.h||32),(e.w||32));
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
    if(!playing()){ gibs.length=0; calls.length=0; splats.length=0; embers.length=0; bats.length=0; pools.length=0; streaks.length=0; prints.length=0; flecks.length=0; bolt=null; flash=0; split=0; shake=0; combo=0; bloody=0; return; }
    const sid=window.MV_BETA&&MV_BETA.stageId;
    if(sid!==tick._sid){ tick._sid=sid; pools.length=0; streaks.length=0; prints.length=0; flecks.length=0; bloody=0; }
    smearTick();
    charTick();
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

  // ── blood pools: under a kill, smeared by MIND walking through ──
  function tileSz(){ return (typeof MV_GRID!=='undefined'&&MV_GRID&&MV_GRID.tile)||48; }
  function floorBelow(x,y){
    const T=tileSz();
    for(let k=0;k<8;k++){ const yy=y+k*T*0.5; if(solid(x,yy+2)) return Math.floor((yy+2)/T)*T; }
    return null;
  }
  function pool(x,feet,w){
    const fy=floorBelow(x,feet-4); if(fy==null) return;
    for(const q of pools) if(Math.abs(q.x-x)<q.r&&q.y===fy){ q.r=Math.min(q.r+w*0.3,120); q.life=1; if(window.MV_BLOOD) MV_BLOOD.pour(x,fy,Math.max(2,w*0.08)); return; }
    pools.push({x,y:fy,r:Math.max(26,w*0.6),grow:0,life:1,smeared:0});
    if(window.MV_BLOOD) MV_BLOOD.pour(x,fy,Math.max(3,w*0.12));   // (build 362) drawn as liquid, runs off edges
    if(pools.length>CAP.pools) pools.shift();
  }
  function smearTick(){
    for(let i=pools.length-1;i>=0;i--){ const q=pools[i]; if(q.grow<1) q.grow=Math.min(1,q.grow+0.03); q.life-=1/(60*50); if(q.life<=0) pools.splice(i,1); }
    for(let i=streaks.length-1;i>=0;i--){ streaks[i].a-=1/(60*9); if(streaks[i].a<=0) streaks.splice(i,1); }
    for(let i=prints.length-1;i>=0;i--){ prints[i].a-=1/(60*7); if(prints[i].a<=0) prints.splice(i,1); }
    if(typeof p==='undefined'||!p) return;
    const fx=p.x+(typeof SW==='number'?SW:40)*0.5, fy=p.y+(typeof FEET_OFF==='number'?FEET_OFF:48);
    const vx=p.vx||0, moving=Math.abs(vx)>0.5, grounded=Math.abs(p.vy||0)<1.2;
    let inPool=null;
    for(const q of pools) if(Math.abs(fx-q.x)<q.r*q.grow&&Math.abs(fy-q.y)<12){ inPool=q; break; }
    if(inPool&&grounded){
      bloody=150;
      if(moving&&(typeof fr!=='number'||fr%3===0)){
        const len=Math.min(46,Math.abs(vx)*9);
        streaks.push({x:fx,y:inPool.y,dx:-Math.sign(vx)*len,w:4+Math.random()*5,a:0.75});
        if(streaks.length>CAP.streaks) streaks.shift();
        inPool.x+=Math.sign(vx)*0.6; inPool.smeared++;
      }
    } else if(bloody>0&&grounded&&moving){
      bloody--;
      if(bloody%14===0){
        stepSide^=1;
        const fl=floorBelow(fx,fy-8);
        prints.push({x:fx+(stepSide?5:-5),y:fl!=null&&Math.abs(fl-fy)<20?fl:fy,dir:Math.sign(vx),a:0.65*Math.min(1,bloody/60+0.3)});
        if(prints.length>CAP.prints) prints.shift();
      }
    }
  }
  function drawPools(){
    for(const q of pools){
      const r=q.r*q.grow, a=Math.min(1,q.life*4);
      if(window.MV_BLOOD) continue;                                   // (build 362) the liquid puddle is drawn by beta_gore
      ctx.fillStyle='rgba(150,0,22,'+(0.92*a).toFixed(3)+')';
      ctx.beginPath(); ctx.ellipse(sx(q.x),sy(q.y)+sw(1),sw(r),Math.max(3,sw(r*0.16)),0,0,Math.PI*2); ctx.fill();
    }
    ctx.lineCap='round';
    for(const s of streaks){
      const g=ctx.createLinearGradient(sx(s.x),0,sx(s.x+s.dx),0);
      g.addColorStop(0,'rgba(190,8,30,'+s.a.toFixed(3)+')'); g.addColorStop(1,'rgba(150,0,20,0)');
      ctx.strokeStyle=g; ctx.lineWidth=Math.max(1.5,sw(s.w*0.5));
      ctx.beginPath(); ctx.moveTo(sx(s.x),sy(s.y)+sw(1)); ctx.lineTo(sx(s.x+s.dx),sy(s.y)+sw(1)); ctx.stroke();
    }
    for(const f of prints){
      ctx.fillStyle='rgba(170,6,26,'+f.a.toFixed(3)+')';
      ctx.beginPath(); ctx.ellipse(sx(f.x),sy(f.y)+sw(1),sw(6),Math.max(1,sw(1.6)),0,0,Math.PI*2); ctx.fill();
    }
  }

  // ── hot things char what stands near them ──
  function hot(x,y,r){ if(on()&&hotNext.length<24) hotNext.push({x,y,r}); }
  function actors(){
    const L=[];
    if(typeof p!=='undefined'&&p){ const w=typeof SW==='number'?SW:40, h=typeof FEET_OFF==='number'?FEET_OFF:48; L.push({o:p,x:p.x+w/2,y:p.y+h*0.5,rx:w*0.7,ry:h*0.6}); }
    if(typeof ENEMS!=='undefined') for(const e of ENEMS) if(e&&e.alive) L.push({o:e,x:e.x+e.w/2,y:e.y+e.h/2,rx:e.w*0.6,ry:e.h*0.6});
    return L;
  }
  function charTick(){
    for(const a of actors()){
      let near=false;
      for(const h of hotNow) if(Math.hypot(a.x-h.x,a.y-h.y)<h.r+Math.max(a.rx,a.ry)) { near=true; break; }
      const c=a.o._goreChar||0;
      a.o._goreChar=near?Math.min(1,c+0.025):Math.max(0,c-0.004);
      if(a.o._goreChar>0.15&&!calm()&&flecks.length<CAP.flecks&&Math.random()<a.o._goreChar*0.25)
        flecks.push({x:a.x+(Math.random()-0.5)*a.rx*1.4,y:a.y+(Math.random()-0.3)*a.ry,vy:-0.5-Math.random()*0.9,vx:(Math.random()-0.5)*0.4,life:1});
    }
    for(let i=flecks.length-1;i>=0;i--){ const f=flecks[i]; f.x+=f.vx; f.y+=f.vy; f.life-=0.025; if(f.life<=0) flecks.splice(i,1); }
  }
  function drawChar(){
    ctx.save();
    ctx.globalCompositeOperation='multiply';
    for(const a of actors()){
      const c=a.o._goreChar||0; if(c<0.03) continue;
      const x=sx(a.x), y=sy(a.y), r=Math.max(sw(a.rx),sw(a.ry));
      const g=ctx.createRadialGradient(x,y,r*0.2,x,y,r);
      const k=Math.round(255-150*c);
      g.addColorStop(0,'rgb('+k+','+Math.round(k*0.82)+','+Math.round(k*0.7)+')'); g.addColorStop(1,'rgb(255,255,255)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(x,y,sw(a.rx),sw(a.ry),0,0,Math.PI*2); ctx.fill();
    }
    ctx.globalCompositeOperation='lighter';
    for(const f of flecks){ ctx.fillStyle='rgba(255,'+(110+(f.life*100|0))+',30,'+(0.9*f.life).toFixed(3)+')'; const s=Math.max(1.5,sw(2.2)); ctx.fillRect(sx(f.x),sy(f.y),s,s); }
    ctx.restore();
  }

  // ── candles + jack-o'-lanterns on ledges (GORE stage dressing) ──
  const phash=(a,b)=>{ let h=(a*374761393+b*668265263)|0; h=(h^(h>>>13))*1274126177|0; return ((h^(h>>>16))>>>0)/4294967295; };
  function buildProps(B){
    const out=[], lv=B.level, cells=lv&&lv.cells; if(!cells) return out;
    const T=tileSz(), sid=String(B.stageId||'').split('').reduce((s,ch)=>s+ch.charCodeAt(0),0);
    let last=-99;
    for(let c=2;c<lv.cols-2&&out.length<CAP.props;c++){
      if(c-last<7||phash(c,sid)>0.3) continue;
      for(let r=2;r<lv.rows;r++){
        if(cells[r][c]!==1||cells[r-1][c]||cells[r-2][c]) continue;
        out.push({x:c*T+T*(0.3+phash(c,r)*0.4),y:r*T,kind:phash(r,c+sid)<0.55?'jack':'candle',seed:phash(c+1,r+1)*6.28});
        last=c; break;
      }
    }
    return out;
  }
  const FLICKER_W=[6.9,14.4];                            // rad/s: 1.1 and 2.3 Hz, a small light, never a flash
  function flicker(seed){
    if(calm()) return 0.9;
    const t=now()/1000;
    return 0.86+0.08*Math.sin(t*FLICKER_W[0]+seed)+0.05*Math.sin(t*FLICKER_W[1]+seed*2.3);
  }
  function drawProps(B){
    if(propsFor!==B.level){ propsFor=B.level; props=buildProps(B); }
    if(!props) return;
    const Z=sw(1000)/1000;
    for(const q of props){
      const x=sx(q.x), y=sy(q.y);
      if(x<-80||x>W+80||y<-80||y>H+80) continue;
      const f=flicker(q.seed);
      if(q.kind==='jack'){
        const w=15*Z, h=11*Z, cy=y-h;
        ctx.save(); ctx.globalCompositeOperation='lighter';
        const g=ctx.createRadialGradient(x,cy,2,x,cy,70*Z*f); g.addColorStop(0,'rgba(255,140,40,'+(0.32*f).toFixed(3)+')'); g.addColorStop(1,'rgba(255,90,20,0)');
        ctx.fillStyle=g; ctx.fillRect(x-70*Z,cy-70*Z,140*Z,140*Z); ctx.restore();
        ctx.fillStyle='#c4540e'; ctx.beginPath(); ctx.ellipse(x,cy,w,h,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#8a3608'; ctx.fillRect(x-w*0.35,cy-h,Math.max(1,1.5*Z),h*2); ctx.fillRect(x+w*0.3,cy-h,Math.max(1,1.5*Z),h*2);
        ctx.fillStyle='#3a5a1a'; ctx.fillRect(x-1.5*Z,cy-h-4*Z,3*Z,5*Z);
        ctx.fillStyle='rgba(255,'+(190+(f*50|0))+',70,1)';
        for(const s of [-1,1]){ ctx.beginPath(); ctx.moveTo(x+s*w*0.62,cy-h*0.1); ctx.lineTo(x+s*w*0.18,cy-h*0.1); ctx.lineTo(x+s*w*0.36,cy-h*0.55); ctx.closePath(); ctx.fill(); }
        ctx.beginPath(); ctx.moveTo(x-w*0.6,cy+h*0.2);
        for(let k=0;k<=6;k++) ctx.lineTo(x-w*0.6+k*w*0.2,cy+h*(k%2?0.62:0.3));
        ctx.lineTo(x+w*0.6,cy+h*0.2); ctx.closePath(); ctx.fill();
        hot(q.x,q.y-11,40);
      } else {
        const cw=4*Z, ch=13*Z, top=y-ch;
        ctx.save(); ctx.globalCompositeOperation='lighter';
        const g=ctx.createRadialGradient(x,top-5*Z,1,x,top-5*Z,42*Z*f); g.addColorStop(0,'rgba(255,190,90,'+(0.35*f).toFixed(3)+')'); g.addColorStop(1,'rgba(255,120,40,0)');
        ctx.fillStyle=g; ctx.fillRect(x-42*Z,top-47*Z,84*Z,84*Z); ctx.restore();
        ctx.fillStyle='#e8dcc4'; ctx.fillRect(x-cw/2,top,cw,ch);
        ctx.fillStyle='#8a0014'; ctx.fillRect(x-cw/2,top,cw,2*Z); ctx.fillRect(x+cw*0.1,top,Math.max(1,1.2*Z),5*Z);
        ctx.fillStyle='#ffcf6a'; ctx.beginPath(); ctx.ellipse(x,top-4*Z,2.2*Z,(3.6+f)*Z,0,0,Math.PI*2); ctx.fill();
        hot(q.x,q.y-15,22);
      }
    }
  }
  function hookWorld(){
    const D=window.MV_BETA_DECOR;
    if(!D||typeof D.world!=='function'||D.world._goreMetal) return;
    const orig=D.world;
    const w=function(B){
      const r=orig.apply(this,arguments);
      if(playing()&&typeof sx==='function'){
        try{ drawProps(B); }catch(e){}
        try{ drawPools(); }catch(e){}
      }
      return r;
    };
    w._goreMetal=true; D.world=w;
  }
  hookWorld();

  // ── mad faces: furrowed brows, narrowed red eyes, gritted teeth ──
  function madFace(cx,ey,fw,dir){
    const lw=Math.max(2,fw*0.08);
    ctx.save(); ctx.lineCap='round';
    for(const s of [-1,1]){
      const ex=cx+s*fw*0.22+dir*fw*0.06;
      ctx.fillStyle='rgba(255,30,20,0.35)'; ctx.beginPath(); ctx.ellipse(ex,ey,fw*0.15,fw*0.08,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#120004'; ctx.beginPath(); ctx.ellipse(ex,ey,fw*0.12,fw*0.055,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ff2a1a'; ctx.beginPath(); ctx.ellipse(ex,ey+fw*0.008,fw*0.085,fw*0.03,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#120004'; ctx.lineWidth=lw;
      ctx.beginPath(); ctx.moveTo(ex+s*fw*0.15,ey-fw*0.15); ctx.lineTo(ex-s*fw*0.1,ey-fw*0.05); ctx.stroke();
    }
    const my=ey+fw*0.27, mw=fw*0.36;
    ctx.fillStyle='#120004'; ctx.fillRect(cx-mw/2+dir*fw*0.05,my-fw*0.04,mw,fw*0.09);
    ctx.fillStyle='#e8dccb';
    for(let k=0;k<4;k++){ const tx=cx-mw/2+dir*fw*0.05+(k+0.5)*mw/4; ctx.beginPath(); ctx.moveTo(tx-mw*0.09,my-fw*0.03); ctx.lineTo(tx+mw*0.09,my-fw*0.03); ctx.lineTo(tx,my+(k%2?fw*0.04:fw*0.02)); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  const _drawEnemy=window.drawEnemy;
  if(typeof _drawEnemy==='function'&&!_drawEnemy._goreMetal){
    const w=function(e){
      const r=_drawEnemy.apply(this,arguments);
      try{
        if(playing()&&e&&e.alive&&!e.mind&&!(e.hitF>0&&typeof fr==='number'&&fr%4<2)&&typeof sx==='function'){
          const dir=(e.dir||(e.fc?1:-1)||1)>0?1:-1;
          if(e.type==='signol'&&e.r){ const r0=sw(e.r); madFace(sx(e.x+e.r),sy(e.y+e.r)-r0*0.15,Math.min(r0*1.3,sw(44)),dir); }
          else{
            const bob=typeof fr==='number'?Math.round(Math.sin(fr*0.14+e.x*0.04)):0;
            const ew=sw(e.w), eh=sw(e.h), fw=Math.min(ew*0.62,sw(46));
            madFace(sx(e.x)+ew/2,sy(e.y)+bob+eh*0.38,fw,dir);
          }
        }
      }catch(_e){}
      return r;
    };
    w._goreMetal=true; window.drawEnemy=w;
  }

  // ── sky: blood moon, bats, lightning on downbeats ──
  // beta_sky places a moon at W*x-camX*0.01, skyY+SKY_PX*y; pin it to a fixed spot in view instead
  // beta_sky's far ridge can reach horizon-254 px; with less open sky than that the moon hangs in front of it (late)
  const BLOOD_MOON={x:0.74,y:0.17,r:40,col:'#e8243a',edge:'#7a0612',crater:'rgba(90,0,12,0.45)',late:false}, SKY_PX=768, RIDGE_UP=254;
  let moonAt=null;
  function placeMoon(horizon){
    if(typeof W!=='number'||typeof H!=='number') return;
    const cx=typeof camX==='number'?camX:0, R=BLOOD_MOON.r*2, hz=horizon||H;
    const skyY=Math.min(0,Math.max(H-SKY_PX,hz-SKY_PX*0.82));
    const open=hz-RIDGE_UP-8;
    BLOOD_MOON.late=open<R*2+16;
    const tx=W*0.6, ty=BLOOD_MOON.late?R+12:Math.max(R+8,Math.min(H*0.2,open-R));
    BLOOD_MOON.x=(tx+cx*0.01)/W; BLOOD_MOON.y=(ty-skyY)/SKY_PX;
    moonAt={x:tx,y:ty,r:R,late:BLOOD_MOON.late};
  }
  function hookSky(){
    const S=window.MV_SKY;
    if(!S||typeof S.draw!=='function'||S.draw._goreMetal) return;
    const orig=S.draw;
    const w=function(B,horizon){
      if(!on()) return orig.apply(this,arguments);
      const T=S.THEMES||{}, th=T[(B&&B.stageId)]||T.default;
      const keep=th?th.moon:null;
      try{ placeMoon(horizon); }catch(e){}
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
    hotNow=hotNext; hotNext=[];
    if(typeof _worldZoomBegin==='function') _worldZoomBegin();
    try{ drawChar(); }catch(e){}
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
      metalText(c.word,sx(c.x),sy(c.y)-k*30-c.lane*34,Math.round((c.taunt?22:36)*pop),c.taunt?'#ff8a96':'#d4001e',1-Math.max(0,(k-0.6)/0.4));
    }
    if(comboShow>0&&combo>=2) metalText('COMBO x'+combo,W-130,118,30,'#ff2a3a',Math.min(1,comboShow/20));
    // shake the graded picture
    const oc=document.querySelector('canvas.mv-gore-grade');
    if(oc){ const tf=shake>0?'translate('+((Math.random()-0.5)*shake).toFixed(1)+'px,'+((Math.random()-0.5)*shake).toFixed(1)+'px)':''; if(oc.style.transform!==tf) oc.style.transform=tf; }
  }

  function state(){
    return {gibs:gibs.length, calls:calls.length, combo, comboShow, moon:moonAt, pools:pools.length, streaks:streaks.length, prints:prints.length,
      props:props?props.map(q=>({x:q.x,y:q.y,kind:q.kind})):[], hot:hotNow.length, flecks:flecks.length,
      char:(typeof p!=='undefined'&&p&&p._goreChar)||0};
  }
  window.MV_GORE_FX={uniforms, paint, canFlash, state, hot, flicker, FLASH_MIN_MS, FLICKER_MAX_HZ:Math.max(...FLICKER_W)/(2*Math.PI), get on(){ return on(); }};
})();
