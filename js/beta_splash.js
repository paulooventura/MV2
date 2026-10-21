// ============================================================
//  beta_splash.js — MMR, then Paulo Ventura, then the title.
//  Logos live in assets/splash/ (copied next to the live game).
//  Any button skips the logo once it has come in. ?lvl= and the
//  1.2 trial skip straight in.
// ============================================================
(function(){
  'use strict';
  const skip=/[?&](lvl=|selftest|ci=)/.test(location.search||'')||window.MV_BETA_LAB;
  if(skip||typeof _gameState==='undefined') return;
  const IN=48, HOLD=110, OUT=30, LEN=IN+HOLD+OUT;
  const SPLASHES=[
    {src:'assets/splash/mmr-logo.jpg', bg:'#fff', pad:0.86, word:'MMR', sub:'PRESENTS', pal:['#fff6d8','#ffd76a','#ffffff','#c8501e','#ff8a3c','#ffe39a'], rim:'#f6c94a', glow:'rgba(255,150,60,0.7)'},
    {src:'assets/splash/paulo-ventura-logo.png', bg:'#18003e', pad:1, extend:true, word:'PAULO VENTURA', sub:'A GAME BY', subTop:true, pal:['#e8f6ff','#9fd4ff','#ffffff','#7b4fd8','#c58cff','#ffe39a'], rim:'#f6c94a', glow:'rgba(160,120,255,0.75)'}
  ];
  SPLASHES.forEach(s=>{ const im=new Image(); im.onload=()=>{ s.ready=true; s.settled=true; }; im.onerror=()=>{ s.ready=false; s.settled=true; }; im.src=s.src; s.img=im; });
  let idx=0, t=0, waitF=0, mos=null;
  window.MV_SPLASH={idx:()=>idx, t:()=>t, IN};
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
    else if(t>=IN+HOLD){ const k=(t-IN-HOLD)/OUT; dark=Math.ceil(Math.min(1,k)*15)/15; }
    mosaic(m);
    if(dark>0){ ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha=dark; ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H); ctx.restore(); }
  }
  function nextSplash(){
    idx++; t=0;
    if(idx>=SPLASHES.length){ _gameState='title'; if(typeof _titleMenuIdx!=='undefined') _titleMenuIdx=0; }
  }
  function skipKey(){ for(const k in Kj){ if(Kj[k]) return true; } return false; }
  const _update=window.update, _draw=window.draw;
  window.update=function(){
    if(_gameState==='splash'){
      const s=SPLASHES[idx];
      if(!s.settled&&++waitF<240){ clkj(); fr++; return; }
      s.settled=true; waitF=0;
      if(skipKey()&&t>IN*0.5){ if(typeof _unlockAudio==='function') _unlockAudio(); nextSplash(); }
      fr++; t++;
      if(t>=LEN) nextSplash();
      clkj(); if(typeof Kj2!=='undefined') Object.keys(Kj2).forEach(k=>delete Kj2[k]);
      return;
    }
    return _update.apply(this,arguments);
  };
  window.draw=function(){
    if(_gameState==='splash'){
      ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over'; ctx.setLineDash([]);
      drawSplash();
      return;
    }
    return _draw.apply(this,arguments);
  };
  document.addEventListener('click',function(e){
    if(_gameState==='splash'&&t>IN*0.5){ if(typeof _unlockAudio==='function') _unlockAudio(); nextSplash(); e.stopPropagation(); }
  },true);
  _gameState='splash';
})();
