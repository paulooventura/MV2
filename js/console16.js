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
//  full colour, smooth, clean sound — the game as it looks today. It's the
//  default; A and B are the nostalgia switches. Picking POSH turns the CRT
//  off, picking A or B from POSH turns it on (the TV can still be flipped).
//
//  Mode: Options menu (CONSOLE), the A/B/C buttons under the screen,
//  localStorage mv2.console = snes | md | off, or ?console=… in the URL.
// ============================================================
(function(){
  'use strict';
  const MODES={
    snes:{name:'SNES', w:256, h:224, hw:512, hh:448},
    md:  {name:'MEGA DRIVE', w:320, h:224, hw:640, hh:448}
  };
  const qs=(()=>{ try{ return new URLSearchParams(location.search).get('console'); }catch(e){ return null; } })();
  let mode=(()=>{ if(qs&&(MODES[qs]||qs==='off')) return qs; try{ const v=localStorage.getItem('mv2.console'); if(MODES[v]||v==='off') return v; }catch(e){} return 'off'; })();
  const listeners=[];
  const api={
    get mode(){ return mode; },
    get name(){ return MODES[mode]?MODES[mode].name:'POSH'; },
    set(m){ if(!(MODES[m]||m==='off')||m===mode) return; const was=mode; mode=m;
      try{ if(window.MV_TV){ if(m==='off') MV_TV.on=false; else if(was==='off') MV_TV.on=true; } }catch(e){} try{ localStorage.setItem('mv2.console',m); }catch(e){} listeners.forEach(f=>{ try{ f(m); }catch(e){} }); intro(); syncUi(); },
    cycle(dir){ const L=['off','snes','md']; const i=L.indexOf(mode); api.set(L[(i+(dir<0?2:1))%3]); },
    on(f){ listeners.push(f); },
    mosaic:1, fade:0, fadeStep:0, // set by transitions (beta stage travel)
    MODES
  };
  window.MV_CONSOLE=api;

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
  function bake(){
    if(baked||!inFrame) return; baked=true;
    const M=MODES[mode]; if(!M) return;
    surfaces(M);
    resample(lo,/[?&]px=soft/.test(location.search));   // nearest: crisp console pixels, like real pixel art; palette: the display shader (or ?palette=cpu on machines without one)
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
  const _draw=window.draw;
  window.draw=function(){
    baked=false; inFrame=(typeof _gameState!=='undefined'&&_gameState==='game');
    introTick();
    try{ return _draw.apply(this,arguments); }
    finally{ inFrame=false; if(MODES[mode]) try{ finish(); }catch(e){ console.warn('MV console pass',e); } }
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

  // ── A/B switch under the screen (beta pages have no title menu) ─
  let bar=null;
  function syncUi(){
    if(!bar) return;
    bar.querySelectorAll('button[data-m]').forEach(b=>{ const on=b.dataset.m===mode; b.setAttribute('aria-pressed',on); b.style.background=on?'#2a1650':'#120a22'; b.style.color=on?'#ffe39a':'#9c8cc8'; b.style.borderColor=on?'#f0d070':'#3a2878'; });
  }
  function buildUi(){
    if(document.documentElement.classList.contains('phone-play')) return;
    const anchor=document.querySelector('.mv-room')||document.getElementById('gameWrap')||document.getElementById('c');
    if(!anchor||!anchor.parentNode) return;
    bar=document.createElement('div'); bar.className='mv-console-bar';
    bar.style.cssText='display:flex;gap:6px;justify-content:center;align-items:center;margin:8px auto 2px;font:700 11px/1 system-ui,sans-serif;letter-spacing:.12em;color:#7868a0';
    bar.innerHTML='<span>CONSOLE</span>'+[['snes','A · SNES'],['md','B · MEGA DRIVE'],['off','C · POSH']].map(([m,l])=>'<button type="button" data-m="'+m+'" style="all:unset;cursor:pointer;padding:6px 10px;border-radius:8px;border:1px solid #3a2878">'+l+'</button>').join('');
    if(window.MV_TV){ bar.insertAdjacentHTML('beforeend','<span style="width:14px"></span><button type="button" class="mv-tvbtn" aria-pressed="'+MV_TV.on+'">'+(MV_TV.on?'CRT TV: ON':'CRT TV: OFF')+'</button>'); }
    bar.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return;
      if(b.classList.contains('mv-tvbtn')){ MV_TV.toggle(); const c=document.getElementById('c'); if(c&&c.focus) c.focus(); return; }
      api.set(b.dataset.m); const c=document.getElementById('c'); if(c&&c.focus) c.focus(); });
    anchor.parentNode.insertBefore(bar,anchor.nextSibling);
    syncUi();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',buildUi); else buildUi();
})();
