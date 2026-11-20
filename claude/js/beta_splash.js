// ============================================================
//  beta_splash.js — MMR, then Paulo Ventura, then the title.
//  Logos live in assets/splash/ (copied next to the live game).
//  Any button skips the logo once it has come in. ?lvl= and the
//  1.2 trial skip straight in.
// ============================================================
(function(){
  'use strict';
  const skip=/[?&](lvl=|selftest|ci=)/.test(location.search||'')||window.MV_BETA_LAB;
  // T576: story slideshow between the logos and the title. Off for tests (webdriver / ci), ?story=0,
  // and on repeat boots once seen (localStorage). ?story=1 forces it.
  const SEEN_KEY='mv_story_intro_seen';
  function storyWanted(){
    const q=location.search||'';
    if(/[?&]story=0/.test(q)) return false;
    if(/[?&]story=1/.test(q)) return true;
    if(navigator.webdriver) return false;
    try{ if(localStorage.getItem(SEEN_KEY)==='1') return false; }catch(e){}
    return true;
  }
  function markSeen(){ try{ localStorage.setItem(SEEN_KEY,'1'); }catch(e){} }
  const SLIDES=[
    {f:'intro-01-album',   cap:'It began with music.', sec:5.0, credit:'Music from the Mind & Venture OST, Music Mecca Records', c:['#2a1050','#0c0420']},
    {f:'intro-02-first-sketch', cap:'Two characters. One record-player brain.', sec:4.5, c:['#2c2c3a','#101018']},
    {f:'intro-03-first-build',  cap:'The first thing that moved.', sec:4.5, c:['#10301c','#06120a']},
    {f:'intro-04-awdjoo-sprites', cap:'Waves became enemies.', sec:4.0, c:['#06304a','#020e18']},
    {f:'intro-05-tiles',   cap:'Tiles became a world.', sec:4.0, c:['#3a2a10','#140c04']},
    {f:'intro-06-story-map', cap:'Sonnata, the world the sound made.', sec:4.0, c:['#103a3a','#041414']},
    {f:'intro-07-water-coop', cap:'Then water, rope, and a second player.', sec:5.0, c:['#0a2a60','#020a1e']},
    {f:'intro-08-today',   cap:'Today: Mind & Venture.', sec:6.0, c:['#4a1050','#18041c']},
    {f:'intro-09-title-lead', cap:'', sec:5.0, c:['#18003e','#05000f']}
  ];
  let SL_END=0; SLIDES.forEach(sl=>{ sl.len=Math.round(sl.sec*60); SL_END+=sl.len; sl.end=SL_END; });
  const SL_IN=24, SL_OUT=30;
  let show=null;   // {t, out: frames into the fast fade, or -1}
  if(skip||typeof _gameState==='undefined') return;
  const IN=48, HOLD=110, OUT=30, LEN=IN+HOLD+OUT;
  const SPLASHES=[
    {src:'assets/splash/mmr-logo.jpg', bg:'#fff', pad:0.86, word:'MMR', sub:'PRESENTS', pal:['#fff6d8','#ffd76a','#ffffff','#c8501e','#ff8a3c','#ffe39a'], rim:'#f6c94a', glow:'rgba(255,150,60,0.7)'},
    {src:'assets/splash/paulo-ventura-logo.png', bg:'#18003e', pad:1, extend:true, word:'PAULO VENTURA', sub:'A GAME BY', subTop:true, pal:['#e8f6ff','#9fd4ff','#ffffff','#7b4fd8','#c58cff','#ffe39a'], rim:'#f6c94a', glow:'rgba(160,120,255,0.75)'}
  ];
  SLIDES.forEach(sl=>{ const im=new Image(); im.onload=()=>{ sl.ready=true; }; im.onerror=()=>{ sl.ready=false; }; if(storyWanted()) im.src='assets/story/intro/'+sl.f+'.png'; sl.img=im; });
  SPLASHES.forEach(s=>{ const im=new Image(); im.onload=()=>{ s.ready=true; s.settled=true; }; im.onerror=()=>{ s.ready=false; s.settled=true; }; im.src=s.src; s.img=im; });
  let idx=0, t=0, waitF=0, mos=null, skipping=false;
  const OUT_SKIP=18;
  window.MV_SPLASH={idx:()=>idx, t:()=>t, IN, story:()=>show};
  function mosaic(m){
    if(m<=1) return;
    const c=document.getElementById('c'); if(!c) return;
    const mw=Math.max(1,Math.round(W/m)), mh=Math.max(1,Math.round(H/m));
    if(!mos){ mos=document.createElement('canvas'); mos.g=mos.getContext('2d'); }
    if(mos.width!==mw||mos.height!==mh){ mos.width=mw; mos.height=mh; }
    mos.g.imageSmoothingEnabled=true; mos.g.clearRect(0,0,mw,mh); mos.g.drawImage(c,0,0,mw,mh);
    ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalCompositeOperation='copy'; ctx.imageSmoothingEnabled=false;
    ctx.drawImage(mos,0,0,W,H); ctx.restore();
  }
  function drawSplash(){
    const s=SPLASHES[idx];
    const art=s.ready&&s.img.naturalWidth;
    ctx.fillStyle=s.settled&&s.bg?s.bg:'#000'; ctx.fillRect(0,0,W,H);
    if(!s.settled) return;
    if(art){
      const iw=s.img.naturalWidth, ih=s.img.naturalHeight;
      const k=Math.min(W*s.pad/iw, H*s.pad/ih);
      const w=Math.round(iw*k), h=Math.round(ih*k), x=(W-w)>>1, y=(H-h)>>1;
      ctx.imageSmoothingEnabled=true; if(ctx.imageSmoothingQuality) ctx.imageSmoothingQuality='high';
      if(s.extend){
        if(x>0){ ctx.drawImage(s.img,0,0,1,ih,0,y,x+1,h); ctx.drawImage(s.img,iw-1,0,1,ih,x+w-1,y,W-x-w+1,h); }
        if(y>0){ ctx.drawImage(s.img,0,0,iw,1,0,0,W,y+1); ctx.drawImage(s.img,0,ih-1,iw,1,0,y+h-1,W,H-y-h+1); }
      }
      ctx.drawImage(s.img,x,y,w,h);
    }else if(typeof uiLogo==='function'){
      const px=s.word.length>6?72:132;
      if(s.subTop&&typeof drawTextC==='function') drawTextC(s.sub,W/2,H/2-px*0.95,'#9c8cc8',2);
      uiLogo(s.word,W/2,H/2-px*0.5,px,{pal:s.pal,rim:s.rim,glow:s.glow,sweep:9999});
      if(!s.subTop&&typeof drawTextC==='function') drawTextC(s.sub,W/2,H/2+px*0.62,'#9c8cc8',2);
    }
    let m=1, dark=0;
    if(t<IN){ const k=t/IN; m=Math.max(1,Math.round(1+(1-k)*31)); dark=Math.ceil((1-k)*15)/15; }
    else if(t>=IN+HOLD){ const k=(t-IN-HOLD)/(skipping?OUT_SKIP:OUT); dark=Math.ceil(Math.min(1,k)*15)/15; }
    mosaic(m);
    if(dark>0){ ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha=dark; ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H); ctx.restore(); }
  }
  // Paulo (Oct 22): any button skips the logos — smoothly: the one on screen fades out
  // quickly and the title fades in (the remaining logo is skipped too)
  function skipAll(){
    if(skipping) return; skipping=true;
    if(typeof _unlockAudio==='function') _unlockAudio();
    if(t<IN){ t=IN+HOLD+Math.round(OUT_SKIP*(1-t/IN)); } else if(t<IN+HOLD) t=IN+HOLD;   // straight into the fade
  }
  function toTitle(){
    idx=SPLASHES.length; _gameState='title'; if(typeof _titleMenuIdx!=='undefined') _titleMenuIdx=0;
    if(typeof _titleT!=='undefined') _titleT=0; window.MV_TITLE_FADE=24;
    if(typeof _ensureTitleMusic==='function') try{ _ensureTitleMusic(); }catch(e){}
  }
  function slideAt(){ for(let i=0;i<SLIDES.length;i++) if(show.t<SLIDES[i].end) return i; return SLIDES.length-1; }
  function drawShow(){
    const i=slideAt(), sl=SLIDES[i], lt=show.t-(i?SLIDES[i-1].end:0);
    ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over'; ctx.setLineDash([]);
    ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
    if(sl.ready&&sl.img.naturalWidth){
      const iw=sl.img.naturalWidth, ih=sl.img.naturalHeight, k=Math.max(W/iw,H/ih)*(1+0.04*lt/sl.len);
      const w=Math.round(iw*k), h=Math.round(ih*k);
      ctx.imageSmoothingEnabled=true; ctx.drawImage(sl.img,(W-w)>>1,(H-h)>>1,w,h);
    }else{
      const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,sl.c[0]); g.addColorStop(1,sl.c[1]);
      ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.arc(W/2,H*0.42,H*0.25,0,6.2832); ctx.fill();
      if(typeof drawTextC==='function') drawTextC(String(i+1)+' / '+SLIDES.length,W/2,Math.round(H*0.38),'#6c5c98',3);
    }
    if(typeof drawTextC==='function'){
      if(sl.cap){ const cy=Math.round(H*0.82); ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(0,cy-14,W,56); drawTextC(sl.cap,W/2,cy,'#fff6d8',3); }
      if(sl.credit&&lt>60) drawTextC(sl.credit,W/2,H-24,'#9c8cc8',1);
      if(show.t>60&&show.out<0) drawTextR('ANY BUTTON: SKIP',W-12,H-18,'#9c8cc8',1);
    }
    let m=1, dark=0;
    if(lt<SL_IN){ const k=lt/SL_IN; m=Math.max(1,Math.round(1+(1-k)*31)); dark=Math.ceil((1-k)*15)/15; }
    if(show.out>=0) dark=Math.max(dark,Math.ceil(Math.min(1,show.out/OUT_SKIP)*15)/15);
    else if(show.t>=SL_END-SL_OUT) dark=Math.ceil(Math.min(1,(show.t-(SL_END-SL_OUT))/SL_OUT)*15)/15;
    mosaic(m);
    if(dark>0){ ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha=dark; ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H); ctx.restore(); }
  }
  function updateShow(){
    if(show.out<0){
      if(skipKey()) show.out=0; else show.t++;
      if(show.t>=SL_END) show.out=OUT_SKIP;
    }
    if(show.out>=0){ show.out++; if(show.out>OUT_SKIP){ markSeen(); show=null; toTitle(); } }
  }
  function nextSplash(){
    if(skipping){ toTitle(); return; }
    idx++; t=0;
    if(idx>=SPLASHES.length&&storyWanted()){ show={t:0,out:-1}; return; }
    if(idx===1&&typeof _ensureTitleMusic==='function') try{ _ensureTitleMusic(); }catch(e){}   // the title theme starts with the 2nd logo
    if(idx>=SPLASHES.length){ _gameState='title'; if(typeof _titleMenuIdx!=='undefined') _titleMenuIdx=0; window.MV_TITLE_FADE=24; }
  }
  function skipKey(){ for(const k in Kj){ if(Kj[k]) return true; } return false; }
  const _update=window.update, _draw=window.draw;
  let musicTry=false;
  window.update=function(){
    if(_gameState==='splash'&&show){
      if(typeof _ensureTitleMusic==='function'&&fr%30===0) try{ _ensureTitleMusic(); }catch(e){}
      updateShow(); fr++; clkj(); if(typeof Kj2!=='undefined') Object.keys(Kj2).forEach(k=>delete Kj2[k]);
      return;
    }
    if(_gameState==='splash'){
      const s=SPLASHES[idx];
      // T425: the game theme starts on the first splash. The desktop build allows autoplay; in a
      // browser that blocks it, the first key / click / tap starts it (retried until it plays).
      if(!musicTry||(fr%30===0&&!(typeof _openingAudioEl!=='undefined'&&_openingAudioEl&&!_openingAudioEl.paused))){ musicTry=true; if(typeof _ensureTitleMusic==='function') try{ _ensureTitleMusic(); }catch(e){} }
      if(!s.settled&&++waitF<240){ clkj(); fr++; return; }
      s.settled=true; waitF=0;
      if(skipKey()) skipAll();
      fr++; t++;
      if(t>=(skipping?IN+HOLD+OUT_SKIP:LEN)) nextSplash();
      clkj(); if(typeof Kj2!=='undefined') Object.keys(Kj2).forEach(k=>delete Kj2[k]);
      return;
    }
    return _update.apply(this,arguments);
  };
  window.draw=function(){
    if(_gameState==='splash'){
      ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over'; ctx.setLineDash([]);
      if(show) drawShow(); else drawSplash();
      return;
    }
    return _draw.apply(this,arguments);
  };
  document.addEventListener('click',function(e){
    if(_gameState==='splash'){ if(show){ if(show.out<0) show.out=0; } else skipAll(); e.stopPropagation(); }
  },true);
  _gameState='splash';
})();
