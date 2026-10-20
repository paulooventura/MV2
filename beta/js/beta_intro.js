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

  // ── Menu input (keyboard + pad; Start = Esc, B = back) ──────────
  const nav=()=>({
    up:!!(Kj.KeyW||Kj.ArrowUp||Kj.PadUp), down:!!(Kj.KeyS||Kj.ArrowDown||Kj.PadDown),
    ok:!!(Kj.Space||Kj.Enter||Kj.NumpadEnter), back:!!(Kj.Escape||Kj.PadB||Kj.Backspace)
  });
  function endTick(){ fr++; clkj(); if(typeof Kj2!=='undefined') Object.keys(Kj2).forEach(k=>delete Kj2[k]); }
  function menuPanel(title,items,sel,y0){
    const rowH=44, w=360, h=86+items.length*rowH, x=W/2-w/2, y=y0!=null?y0:Math.round(H/2-h/2);
    uiPanel(x,y,w,h,{r:16});
    uiLogo(title,W/2,y+12,34,{sweep:300});
    items.forEach((label,i)=>{
      const ry=y+70+i*rowH, on=i===sel;
      if(on){ uiPanel(x+24,ry-10,w-48,rowH-8,{sel:true,r:10,flat:true}); uiCursor(x+44,ry+6,9); }
      drawTextC(label,W/2,ry,on?C.WHITE:C.LILAC,2);
    });
  }
  const musicPause=()=>{ try{ if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.pause(); }catch(e){} };
  const musicStop=()=>{ try{ if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.stopAll(); }catch(e){} try{ if(typeof _stopAllBgm==='function') _stopAllBgm(); }catch(e){} };

  // ── Pause (Esc / Start in a stage): RESUME GAME · OPTIONS · EXIT ─
  const PAUSE_ITEMS=['RESUME GAME','OPTIONS','EXIT'];
  let pauseIdx=0, optFromPause=false, swallowBack=false;   // the Esc that closed Options must not also resume
  function openPause(){ _paused=true; pauseIdx=0; musicPause(); }
  function resumeGame(){ _paused=false; if(window.MV_BETA_AUDIO&&window.MV_BETA&&MV_BETA.on) MV_BETA_AUDIO.resume(); else if(typeof _playBGM==='function') _playBGM('game',OPT.musicVol); }
  function exitToTitle(){
    _paused=false; musicStop();
    if(window.MV_BETA){ MV_BETA.on=false; MV_BETA.results=null; MV_BETA.popup=null; MV_BETA.trans=null; }
    _gameState='title'; _titleMenuIdx=0;
    if(typeof _ensureTitleMusic==='function') _ensureTitleMusic();
  }
  function pauseTick(){
    const n=nav();
    if(n.back) resumeGame();
    else{
      if(n.up) pauseIdx=(pauseIdx+PAUSE_ITEMS.length-1)%PAUSE_ITEMS.length;
      if(n.down) pauseIdx=(pauseIdx+1)%PAUSE_ITEMS.length;
      if(n.ok){
        if(pauseIdx===0) resumeGame();
        else if(pauseIdx===1){ optFromPause=true; _gameState='options'; _optRow=0; }
        else exitToTitle();
      }
    }
    endTick();
  }
  window.drawPauseMenu=function(){ menuPanel('PAUSED',PAUSE_ITEMS,pauseIdx); };
  // Options opened from pause: back returns to the paused stage, not the title.
  const _optInput=window._optionsInput;
  window._optionsInput=function(ev){
    if(optFromPause&&_gameState==='options'&&ev&&ev.back&&!_optRebinding){ optFromPause=false; _gameState='game'; _paused=true; swallowBack=true; return true; }
    return _optInput.apply(this,arguments);
  };

  // ── Title: Esc / Start asks to shut the game down ────────────────
  const QUIT_ITEMS=['NO','YES'];
  let quitIdx=0, offT=0;
  function openQuit(){ _gameState='quit'; quitIdx=0; }
  function powerOff(){
    musicStop(); _gameState='off'; offT=0;
    try{ window.close(); }catch(e){}               // works for installed / script-opened windows
  }
  function powerOn(){ idx=0; t=0; _gameState='splash'; }
  function quitTick(){
    const n=nav();
    if(n.back) _gameState='title';
    else{
      if(n.up||n.down) quitIdx=1-quitIdx;
      if(Kj.KeyA||Kj.ArrowLeft||Kj.KeyD||Kj.ArrowRight) quitIdx=1-quitIdx;
      if(n.ok){ if(quitIdx===1) powerOff(); else _gameState='title'; }
    }
    endTick();
  }
  function offTick(){
    offT++;
    if(offT>60&&(n=>n.ok||n.back)(nav())) powerOn();
    endTick();
  }
  function drawQuit(){
    drawTitle();
    ctx.fillStyle='rgba(4,2,10,0.6)'; ctx.fillRect(0,0,W,H);
    menuPanel('SHUT DOWN?',QUIT_ITEMS,quitIdx);
  }
  function drawOff(){
    ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
    const k=Math.min(1,offT/24);                   // CRT power-off: picture collapses to a line, then a dot
    if(k<1){
      const lineH=Math.max(2,Math.round((1-k*1.6)*H)), lineW=k<0.6?W:Math.max(4,Math.round(W*(1-(k-0.6)/0.4)));
      ctx.fillStyle='#e8f0ff'; ctx.globalAlpha=1-k*0.6;
      ctx.fillRect((W-lineW)/2,(H-Math.max(2,lineH))/2,lineW,Math.max(2,lineH)); ctx.globalAlpha=1;
    }
    if(offT>60&&fr%60<40) drawTextC('PRESS START TO POWER ON',W/2,H-60,'#3a2f55',1);
  }
  window.addEventListener('keydown',e=>{
    if(_gameState==='title'&&e.code==='Escape'){ openQuit(); e.preventDefault(); e.stopImmediatePropagation(); }
  },true);

  // ── Stage reset (Tab / ↺): restart the current beta stage, not the old Awdjoo zone 0
  function stageRestart(){
    const B=window.MV_BETA; if(!B||!B.on||!B.stageId||typeof startBetaLab!=='function') return false;
    B.results=null; B.popup=null; B.trans=null;
    startBetaLab(B.stageId,B.carryMask,{fresh:true}).catch(err=>console.error('stage restart failed',err));
    return true;
  }

  const _update2=window.update;
  window.update=function(){
    readGamepad();                                   // pad presses land in Kj before the checks below
    if(swallowBack){ swallowBack=false; delete Kj.Escape; delete Kj.Backspace; delete Kj.PadB; }
    if(_gameState==='game'){
      if(_paused){ pauseTick(); return; }
      if(Kj.Escape){
        if(window.MV_BETA&&(MV_BETA.popup||MV_BETA.results||MV_BETA.trans)) delete Kj.Escape;   // those windows use Esc themselves
        else { openPause(); endTick(); return; }
      }
      if(Kj.Tab&&stageRestart()){ endTick(); return; }
    }
    if(_gameState==='title'&&Kj.Escape){ openQuit(); endTick(); return; }
    if(_gameState==='quit'){ quitTick(); return; }
    if(_gameState==='off'){ offTick(); return; }
    return _update2.apply(this,arguments);
  };
  const _draw2=window.draw;
  window.draw=function(){
    if(_gameState==='quit'){ ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over'; drawQuit(); return; }
    if(_gameState==='off'){ ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over'; drawOff(); return; }
    return _draw2.apply(this,arguments);
  };

  if(!skipIntro) _gameState='splash';
})();
