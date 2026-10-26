// ============================================================
//  console16.js — the "console" the game runs on
//
//  Paulo, Oct 2026: it has to look, sound and feel like 1994 — like playing
//  Super Mario World, Street Fighter II, Donkey Kong Country or ISS on a tube
//  TV — with an Options switch between A = SNES and B = Mega Drive.
//
//  Every frame goes through the console's video hardware, in two layers:
//   · the world is resampled to the console's own resolution
//       SNES 256x224 · Mega Drive 320x224
//     (pixels come out a little wider than tall, as they did on a 4:3 TV),
//     with the camera snapped to whole console pixels so scrolling is clean;
//   · HUD, menus and text use the double-resolution text layer (512/640 x 448,
//     like the SNES hi-res mode some RPGs used for text) so they stay legible.
//  Then the colours go through the console's palette:
//       SNES 15-bit RGB (32 levels a channel, smooth gradients)
//       Mega Drive 9-bit RGB (8 non-linear DAC levels a channel) with the
//       ordered dithering MD games used — the TV's blur blends it back.
//  Transitions match the hardware: SNES mosaic + brightness steps, Mega Drive
//  stepped palette fades. The CRT pass (crt_room.js) reads the mode for its
//  224 scanlines, its blur and the Model 1 "jailbars". Sound: sound16.js.
//
//  C · POSH (mode 'off'): none of the console treatment — full resolution,
//  full colour, smooth, clean sound. A fresh game starts in Ink & Vinyl
//  instead; A and B are the nostalgia switches. Picking POSH turns the CRT
//  off, picking A or B from POSH turns it on (the TV can still be flipped).
//
//  Mode: Options menu (FILTER). Storage key stays mv2.console.
//  GORE is hidden until the options code unlocks it (mv2.gore).
// ============================================================
(function(){
  'use strict';
  const MODES={
    snes:{name:'SNES', w:256, h:224, hw:512, hh:448},
    md:  {name:'MEGA DRIVE', w:320, h:224, hw:640, hh:448}
  };
  const qs=(()=>{ try{ return new URLSearchParams(location.search).get('console'); }catch(e){ return null; } })();
  // 'ink' (D · INK & VINYL, Oct 23): no console treatment here — ink_vinyl.js finishes the frame as a woodblock print
  const plain=m=>m==='off'||m==='ink'||m==='gore';
  const goreOn=()=>{ try{ return localStorage.getItem('mv2.gore')==='1'; }catch(e){ return false; } };
  // Fresh start is Ink & Vinyl. A saved mode or ?console= still wins. Selftest stays clean.
  let mode=(()=>{ if(/[?&](selftest|ci=)/.test(location.search||'')) return 'off'; if(qs&&(MODES[qs]||(plain(qs)&&qs!=='gore')||(qs==='gore'&&goreOn()))) return qs; try{ const v=localStorage.getItem('mv2.console'); if(v==='gore'&&!goreOn()) return 'ink'; if(MODES[v]||plain(v)) return v; }catch(e){} return 'ink'; })();
  const listeners=[];
  const api={
    get mode(){ return mode; },
    get name(){ return MODES[mode]?MODES[mode].name:mode==='ink'?'INK & VINYL':mode==='gore'?'GORE':'POSH'; },
    set(m){ if(m==='gore'&&!goreOn()) return; if(!(MODES[m]||plain(m))||m===mode) return; const was=mode; mode=m;
      try{ if(window.MV_TV){ if(plain(m)) MV_TV.on=false; else if(plain(was)) MV_TV.on=true; } }catch(e){} try{ localStorage.setItem('mv2.console',m); }catch(e){} listeners.forEach(f=>{ try{ f(m); }catch(e){} }); intro(); syncUi(); syncHue(); },
    cycle(dir){ const L=['off','snes','md','ink']; if(goreOn()) L.push('gore'); const i=Math.max(0,L.indexOf(mode)); api.set(L[(i+(dir<0?L.length-1:1))%L.length]); },
    on(f){ listeners.push(f); },
    mosaic:1, fade:0, fadeStep:0, // set by transitions (beta stage travel)
    MODES
  };
  window.MV_CONSOLE=api;
  function syncHue(){
    const c=document.getElementById('c');
    if(c) c.style.filter=mode==='gore'?'hue-rotate(-120deg)':'';
  }
  syncHue();

  // ── palette tables ──────────────────────────────────────────────
  const LUT_SNES=new Uint8ClampedArray(256);
  for(let v=0;v<256;v++) LUT_SNES[v]=Math.round(Math.round(v*31/255)*255/31);
  const MD_DAC=[0,52,87,116,144,172,206,255];
  const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  const LUT_MD=[];                                        // [bayer index][value]
  for(let b=0;b<16;b++){
    const t=new Uint8ClampedArray(256), d=(BAYER[b]/16-0.47)*24;
    for(let v=0;v<256;v++){ const x=v+d; let best=0,bd=1e9; for(const L of MD_DAC){ const e=Math.abs(L-x); if(e<bd){ bd=e; best=L; } } t[v]=best; }
    LUT_MD.push(t);
  }

  // ── work canvases ───────────────────────────────────────────────
  const mk=(w,h)=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; };
  let lo=null, hi=null, mos=null;
  function surfaces(M){
    if(!lo||lo.width!==M.w){ lo=mk(M.w,M.h); lo.g=lo.getContext('2d',{willReadFrequently:cpuPalette}); }
    if(!hi||hi.width!==M.hw){ hi=mk(M.hw,M.hh); hi.g=hi.getContext('2d'); }
  }
  function resample(dst,smooth){
    const g=dst.g; g.imageSmoothingEnabled=smooth; if(smooth&&g.imageSmoothingQuality) g.imageSmoothingQuality='low';
    g.clearRect(0,0,dst.width,dst.height); g.drawImage(cv,0,0,dst.width,dst.height);
    ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha=1; ctx.globalCompositeOperation='copy'; ctx.imageSmoothingEnabled=false;
    ctx.drawImage(dst,0,0,W,H); ctx.restore();
  }
  const cpuPalette=/[?&]palette=cpu/.test(location.search);
  const gpu=()=>!!(window.MV_TV&&MV_TV.gl);       // the display shader does palette + text layer
  function palettize(c,dither){                     // CPU palette (fallback path only, small canvases)
    const g=c.g, img=g.getImageData(0,0,c.width,c.height), d=img.data, w=c.width;
    if(!dither){ for(let i=0;i<d.length;i+=4){ d[i]=LUT_SNES[d[i]]; d[i+1]=LUT_SNES[d[i+1]]; d[i+2]=LUT_SNES[d[i+2]]; } }
    else for(let y=0,i=0;y<c.height;y++){ const row=(y&3)<<2; for(let x=0;x<w;x++,i+=4){ const t=LUT_MD[row|(x&3)]; d[i]=t[d[i]]; d[i+1]=t[d[i+1]]; d[i+2]=t[d[i+2]]; } }
    g.putImageData(img,0,0);
  }
  // World layer: the frame so far, at the console's real resolution
  let baked=false, inFrame=false;
  let worldFr=-1, drawFr=0;
  api.worldLayer=()=>(worldFr===drawFr&&lo&&MODES[mode]&&!(api.mosaic>1))?lo:null;   // the display shader keeps text off the world (crt_room.js)
  function bake(){
    if(baked||!inFrame) return; baked=true;
    const M=MODES[mode]; if(!M) return;
    surfaces(M);
    resample(lo,/[?&]px=soft/.test(location.search)); worldFr=drawFr;   // nearest: crisp console pixels, like real pixel art; palette: the display shader (or ?palette=cpu on machines without one)
    if(!gpu()&&cpuPalette){ palettize(lo,mode==='md'); ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalCompositeOperation='copy'; ctx.imageSmoothingEnabled=false; ctx.drawImage(lo,0,0,W,H); ctx.restore(); }
  }
  // Whole frame: mosaic, then (fallback only) the text-layer grid + stepped fade
  function finish(){
    const M=MODES[mode]; if(!M){ api.fadeStep=0; return; }
    surfaces(M);
    const m=Math.max(1,Math.round(api.mosaic||1));
    if(m>1){                                                   // SNES mosaic: blocks of m console pixels
      const mw=Math.max(1,Math.round(M.w/m)), mh=Math.max(1,Math.round(M.h/m));
      if(!mos||mos.width!==mw||mos.height!==mh){ mos=mk(mw,mh); mos.g=mos.getContext('2d'); }
      resample(mos,false);
    }
    const f=api.fade||0;
    api.fadeStep=f<=0?0:mode==='snes'?Math.ceil(f*15)/15:Math.ceil(f*7)/7;   // SNES 16 brightness steps, MD 8 palette steps
    if(gpu()) return;
    if(cpuPalette) resample(hi,true);       // no GPU: the text layer stays smooth (saves two full-frame copies)
    if(api.fadeStep>0){ ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha=api.fadeStep; ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H); ctx.restore(); }
  }

  // ── hooks ───────────────────────────────────────────────────────
  // Camera on whole console pixels (render camera only; physics untouched)
  const _snap=window._snapRenderCam;
  if(typeof _snap==='function'){
    window._snapRenderCam=function(){
      _snap.apply(this,arguments);
      const M=MODES[mode]; if(!M) return;
      const px=W/M.w, py=H/M.h;
      _rcamX=Math.round(_rcamX/px)*px; _rcamY=Math.round(_rcamY/py)*py;
    };
  }
  // The world is done once the first HUD / text overlay starts
  for(const name of ['drawItemTutorial','drawHUD']){
    const orig=window[name]; if(typeof orig!=='function') continue;
    window[name]=function(){ if(MODES[mode]) bake(); return orig.apply(this,arguments); };
  }
  // ── damage bit-crush (Paulo, Oct 20): HP 0–100 in 5 phases of 20. Full
  //   health is clean; every phase lost crushes the whole picture harder —
  //   bigger pixels, fewer colours, and at the end it starts to tear.
  // HP phase 5 = posh and clean · 4..1 = more crushed, darker, slower music · 0 HP = shut down (phase 1)
  const CRUSH=[null,{f:7,lv:4,tear:1,dark:0.42,rate:0.52},{f:5,lv:5,tear:0.75,dark:0.34,rate:0.64},{f:4,lv:7,tear:0.45,dark:0.26,rate:0.76},{f:3,lv:10,tear:0.2,dark:0.16,rate:0.88},{dark:0,rate:1}];
  const DITH=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(v=>v/16-0.47);   // ordered dither so dark shades survive the crush
  const JOLT_FR=28; let jolt=0, lastHp=null;          // a hit: a short burst of full crush, tear and a red flash
  let crushC=null;
  function hpPhase(){
    if(typeof _gameState==='undefined'||_gameState!=='game'||typeof p==='undefined'||!p) return 5;
    if(typeof _shutdownTimer!=='undefined'&&_shutdownTimer>0) return 1;
    const f=Math.max(0,Math.min(1,(p.hp||0)/(p.maxHp||100)));
    return Math.max(1,Math.min(5,Math.ceil(f*5-1e-6)));
  }
  api.hpPhase=hpPhase;
  function hitWatch(){
    if(typeof _gameState==='undefined'||_gameState!=='game'||typeof p==='undefined'||!p){ lastHp=null; jolt=0; return; }
    if(lastHp!=null&&p.hp<lastHp) jolt=JOLT_FR;
    lastHp=p.hp; if(jolt>0) jolt--;
  }
  // music speed for audio.js / beta_audio.js: the phase rate, dipped hard right after a hit
  api.hurtRate=function(){ const ph=hpPhase(); return CRUSH[ph].rate*(1-0.22*(jolt/JOLT_FR)); };
  api.hurtDark=function(){ return CRUSH[hpPhase()].dark; };
  api.jolt=()=>jolt/JOLT_FR;
  // darker screen per phase (replaces ui.js drawDamageOverlay's soft ramp)
  window.drawDamageOverlay=function(){
    if(typeof _gameState==='undefined'||_gameState!=='game'||!p) return;
    const j=jolt/JOLT_FR, dark=Math.min(0.8,CRUSH[hpPhase()].dark+j*0.25);
    if(dark<0.02&&j<=0) return;
    ctx.save(); ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='rgba(2,0,8,'+dark.toFixed(3)+')'; ctx.fillRect(0,0,W,H);
    const vg=ctx.createRadialGradient(W/2,H/2,H*0.25,W/2,H/2,H*0.8);   // closing-in edges
    vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,'+Math.min(0.9,dark*1.3).toFixed(3)+')');
    ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
    if(j>0){ ctx.fillStyle='rgba(200,10,40,'+(0.35*j).toFixed(3)+')'; ctx.fillRect(0,0,W,H); }
    ctx.restore();
    // Paulo (Oct 21): only the world glitches — this runs after the world and before the
    // HUD, so the top and bottom bars stay readable; MIND is drawn again on top, clear
    // (his eye and cracked bulb show the damage instead, render.js drawHead)
    try{ crush(); }catch(e){}
    try{ redrawMind(); }catch(e){}
  };
  function redrawMind(){
    if(typeof drawCharacter!=='function'||!p) return;
    const B=window.MV_BETA;
    if(B&&B.inWater&&B.inWater(p.x+SW/2,p.y+FEET_OFF-50)) return;   // under water he stays under the water
    if(typeof _worldZoomBegin==='function') _worldZoomBegin();
    try{ drawCharacter(); } finally{ if(typeof _worldZoomEnd==='function') _worldZoomEnd(); }
  }
  function crush(){
    let ph=hpPhase(); if(jolt>0) ph=Math.max(1,ph-2);   // a hit crushes two phases deeper for a moment
    if(ph>=5) return;
    const c=CRUSH[ph], w=Math.max(16,Math.round(W/c.f)), h=Math.max(12,Math.round(H/c.f));
    if(!crushC||crushC.width!==w||crushC.height!==h){ crushC=mk(w,h); crushC.g=crushC.getContext('2d',{willReadFrequently:true}); }
    const g=crushC.g; g.imageSmoothingEnabled=true; g.clearRect(0,0,w,h); g.drawImage(cv,0,0,w,h);
    const img=g.getImageData(0,0,w,h), d=img.data, q=255/(c.lv-1);
    for(let y=0,i=0;y<h;y++) for(let x=0;x<w;x++,i+=4){ const t=DITH[(y&3)*4+(x&3)];
      d[i]=Math.min(255,Math.round(d[i]/q+t)*q); d[i+1]=Math.min(255,Math.round(d[i+1]/q+t)*q); d[i+2]=Math.min(255,Math.round(d[i+2]/q+t)*q); }
    g.putImageData(img,0,0);
    ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalCompositeOperation='copy'; ctx.imageSmoothingEnabled=false;
    ctx.drawImage(crushC,0,0,W,H);
    if(c.tear&&(jolt>0||Math.random()<c.tear*0.5)){                  // a torn signal: a few rows slip sideways
      ctx.globalCompositeOperation='source-over';
      for(let k=0;k<1+(c.tear*3|0);k++){ const y=Math.random()*H|0, hh=4+Math.random()*24|0, dx=(Math.random()-0.5)*40*c.tear|0; ctx.drawImage(cv,0,y,W,hh,dx,y,W,hh); }
    }
    ctx.restore();
  }
  const _draw=window.draw;
  window.draw=function(){
    baked=false; drawFr++; inFrame=(typeof _gameState!=='undefined'&&_gameState==='game');
    introTick();
    try{ return _draw.apply(this,arguments); }
    finally{ inFrame=false; if(MODES[mode]) try{ finish(); }catch(e){ console.warn('MV console pass',e); } try{ hitWatch(); }catch(e){} }
  };

  // ── power-on / stage-start transition ──────────────────────────
  let introT=0, lastKey='';
  function intro(){ introT=1; }
  function introTick(){
    const gs=typeof _gameState!=='undefined'?_gameState:'';
    const key=(gs==='game'?'game':'menu')+'|'+(window.MV_BETA&&MV_BETA.on?MV_BETA.stageId:'')+'|'+(typeof _zoneIdx!=='undefined'?_zoneIdx:'');
    if(key!==lastKey){ const was=lastKey; lastKey=key; if(gs==='game'||!was) intro(); }
    if(window.MV_BETA&&MV_BETA.trans){ introT=0; return; }    // the beta's travel runs its own
    if(introT>0){
      const k=Math.min(1,introT/36);                          // 0 → 1 over ~0.6 s
      if(mode==='snes'){ api.mosaic=1+Math.round((1-k)*15); api.fade=(1-k)*0.9; }
      else{ api.mosaic=1; api.fade=1-k; }
      introT++; if(introT>36){ introT=0; api.mosaic=1; api.fade=0; }
    }
  }

  // Labs keep the A/B/C strip under the picture. The live game sets those
  // in Options, so the strip is not drawn there.
  let bar=null;
  function syncUi(){
    if(!bar) return;
    bar.querySelectorAll('button[data-m]').forEach(b=>{ const on=b.dataset.m===mode; b.setAttribute('aria-pressed',on); b.style.background=on?'#2a1650':'#120a22'; b.style.color=on?'#ffe39a':'#9c8cc8'; b.style.borderColor=on?'#f0d070':'#3a2878'; });
  }
  function buildUi(){
    if(document.documentElement.classList.contains('phone-play')) return;
    if(document.querySelector('.mv-controls')||window.MV_BETA_START) return;
    const anchor=document.querySelector('.mv-room')||document.getElementById('gameWrap')||document.getElementById('c');
    if(!anchor||!anchor.parentNode) return;
    bar=document.createElement('div'); bar.className='mv-console-bar';
    bar.style.cssText='display:flex;gap:6px;justify-content:center;align-items:center;margin:8px auto 2px;font:700 11px/1 system-ui,sans-serif;letter-spacing:.12em;color:#7868a0';
    bar.innerHTML='<span>CONSOLE</span>'+[['snes','A · SNES'],['md','B · MEGA DRIVE'],['off','C · POSH'],['ink','D · INK & VINYL']].map(([m,l])=>'<button type="button" data-m="'+m+'" style="all:unset;cursor:pointer;padding:6px 10px;border-radius:8px;border:1px solid #3a2878">'+l+'</button>').join('');
    if(window.MV_TV){ bar.insertAdjacentHTML('beforeend','<span style="width:14px"></span><button type="button" class="mv-tvbtn" aria-pressed="'+MV_TV.on+'">'+(MV_TV.on?'CRT TV: ON':'CRT TV: OFF')+'</button>'); }
    bar.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return;
      if(b.classList.contains('mv-tvbtn')){ MV_TV.toggle(); const c=document.getElementById('c'); if(c&&c.focus) c.focus(); return; }
      api.set(b.dataset.m); const c=document.getElementById('c'); if(c&&c.focus) c.focus(); });
    anchor.parentNode.insertBefore(bar,anchor.nextSibling);
    syncUi();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',buildUi); else buildUi();
})();
