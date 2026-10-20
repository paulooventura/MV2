// ============================================================
//  beta_intro.js — L1 beta boot: MMR splash → Paulo Ventura splash →
//  title menu (STORY MODE / OPTIONS). Story mode plays the story pages,
//  then drops straight into Awdjoo 1.1 (no player-select step).
//
//  Splash art: assets/splash/mmr-logo.png and assets/splash/paulo-ventura-logo.png.
//  Until those files exist, a drawn wordmark stands in.
//  Each splash comes in the console way: big mosaic blocks + dark, resolving
//  to full resolution, holds, then fades to black.
//  ?lvl=1.1 / ?lvl=1.2 still skips straight into a stage (dev / selftest).
// ============================================================
(function(){
  'use strict';
  window.MV_BETA_INTRO=1;
  const skipIntro=/[?&]lvl=/.test(location.search||'');

  const IN=48, HOLD=110, OUT=30, LEN=IN+HOLD+OUT;
  const SPLASHES=[
    {src:'assets/splash/mmr-logo.png', word:'MMR', sub:'PRESENTS', pal:['#fff6d8','#ffd76a','#ffffff','#c8501e','#ff8a3c','#ffe39a'], rim:'#f6c94a', glow:'rgba(255,150,60,0.7)'},
    {src:'assets/splash/paulo-ventura-logo.png', word:'PAULO VENTURA', sub:'A GAME BY', subTop:true, pal:['#e8f6ff','#9fd4ff','#ffffff','#7b4fd8','#c58cff','#ffe39a'], rim:'#f6c94a', glow:'rgba(160,120,255,0.75)'}
  ];
  SPLASHES.forEach(s=>{ const im=new Image(); im.onload=()=>{ s.ready=true; }; im.onerror=()=>{ s.ready=false; }; im.src=s.src; s.img=im; });

  let idx=0, t=0;
  const cvEl=()=>document.getElementById('c');
  let mos=null;
  function mosaic(m){
    if(m<=1) return;
    const c=cvEl(); if(!c) return;
    const mw=Math.max(1,Math.round(W/m)), mh=Math.max(1,Math.round(H/m));
    if(!mos){ mos=document.createElement('canvas'); mos.g=mos.getContext('2d'); }
    if(mos.width!==mw||mos.height!==mh){ mos.width=mw; mos.height=mh; }
    mos.g.imageSmoothingEnabled=true; mos.g.clearRect(0,0,mw,mh); mos.g.drawImage(c,0,0,mw,mh);
    ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalCompositeOperation='copy'; ctx.imageSmoothingEnabled=false;
    ctx.drawImage(mos,0,0,W,H); ctx.restore();
  }
  function drawSplash(){
    const s=SPLASHES[idx];
    ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
    if(s.ready&&s.img.naturalWidth){
      const k=Math.min(W*0.7/s.img.naturalWidth, H*0.6/s.img.naturalHeight);
      const w=Math.round(s.img.naturalWidth*k), h=Math.round(s.img.naturalHeight*k);
      ctx.imageSmoothingEnabled=true; if(ctx.imageSmoothingQuality) ctx.imageSmoothingQuality='high';
      ctx.drawImage(s.img,(W-w)>>1,(H-h)>>1,w,h);
    }else{
      const px=s.word.length>6?72:132;
      if(s.subTop) drawTextC(s.sub,W/2,H/2-px*0.95,'#9c8cc8',2);
      uiLogo(s.word,W/2,H/2-px*0.5,px,{pal:s.pal,rim:s.rim,glow:s.glow,sweep:9999});
      if(!s.subTop) drawTextC(s.sub,W/2,H/2+px*0.62,'#9c8cc8',2);
    }
    // pixelate in (32 → 1 blocks) + brighten, then stepped fade out
    let m=1, dark=0;
    if(t<IN){ const k=t/IN; m=Math.max(1,Math.round(1+(1-k)*31)); dark=Math.ceil((1-k)*15)/15; }
    else if(t>=IN+HOLD){ const k=(t-IN-HOLD)/OUT; dark=Math.ceil(Math.min(1,k)*15)/15; }
    mosaic(m);
    if(dark>0){ ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha=dark; ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H); ctx.restore(); }
  }
  function nextSplash(){
    idx++; t=0;
    if(idx>=SPLASHES.length){ _gameState='title'; _titleMenuIdx=0; }
  }
  function skipKey(){ for(const k in Kj){ if(Kj[k]) return true; } return false; }

  const _update=window.update;
  window.update=function(){
    if(_gameState==='splash'){
      readGamepad();
      // any button skips the current splash once it has resolved
      if(skipKey()&&t>IN*0.5){ if(typeof _unlockAudio==='function') _unlockAudio(); nextSplash(); }
      fr++; t++;
      if(t>=LEN) nextSplash();
      clkj(); if(typeof Kj2!=='undefined') Object.keys(Kj2).forEach(k=>delete Kj2[k]);
      return;
    }
    return _update.apply(this,arguments);
  };
  const _draw=window.draw;
  window.draw=function(){
    if(_gameState==='splash'){
      ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over'; ctx.setLineDash([]);
      drawSplash();
      return;
    }
    return _draw.apply(this,arguments);
  };
  document.addEventListener('click',()=>{ if(_gameState==='splash'&&t>IN*0.5) nextSplash(); },true);

  // Story mode → story pages → Awdjoo 1.1 (skip the live game's player-select).
  const _startGame=window.startGame;
  window.startGame=function(){
    if(_gameState==='story'&&_storyPage+1>=STORY_PAGES.length&&typeof startBetaLab==='function'){
      _unlockAudio(); _stopBGM('story');
      if(window.MV_BETA){ MV_BETA.results=null; MV_BETA.popup=null; MV_BETA.trans=null; MV_BETA.saves={}; MV_BETA.isoOwned=false; }
      startBetaLab('1.1',0,{fresh:true}).then(()=>{ const c=cvEl(); if(c&&c.focus) c.focus(); }).catch(err=>console.error('Awdjoo beta failed',err));
      return;
    }
    return _startGame.apply(this,arguments);
  };

  if(!skipIntro) _gameState='splash';
})();
