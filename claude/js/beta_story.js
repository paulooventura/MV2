// ============================================================
//  beta_story.js — Story Mode remembers where you are (Paulo, Oct 21)
//
//  The run is saved as you play: the stage you're on, the jacks you own and
//  every stage's saved state (seeds, crystals, crates, the Isolator, Laitu,
//  the clock, whether its arch is cleared). It's kept in the browser, so it
//  survives going back to the title and closing the page.
//  On the title, STORY MODE then asks: CONTINUE (straight back into the stage
//  you were in, with everything you'd done) · NEW GAME (the story from the
//  top; the old save is replaced once you start) · BACK.
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B) return;
  const KEY='mv2.story.v1';
  const NAMES={'1.1':'AWDJOO TOWN 1.1','1.2':'AWDJOO TOWN 1.2'};

  function load(){ try{ const s=JSON.parse(localStorage.getItem(KEY)||'null'); return s&&s.stageId?s:null; }catch(e){ return null; } }
  function persist(){
    if(!B.stageId||!window.MV_STORY_STAGES) return;
    try{
      localStorage.setItem(KEY, JSON.stringify({stageId:B.stageId, mask:_unlockedMask|0, progress:B.progress|0, saves:B.saves||{},
        popupSeen:B.popupSeen||{}, isoOwned:!!B.isoOwned, lives:B.lives, continues:B.continues, t:Date.now()}));
    }catch(e){}
  }
  function snapshot(){ if(B.on&&B.stageId&&_gameState==='game'&&B.saveStage){ try{ B.saveStage(); }catch(e){} persist(); } }
  B.storySave=snapshot; B.storyLoad=load;

  // save on the way out, at every stage change, every few seconds, and when the page goes away
  const _quit=B.quitToTitle;
  if(_quit) B.quitToTitle=function(){ snapshot(); return _quit.apply(this,arguments); };
  const _ss=B.saveStage;
  if(_ss) B.saveStage=function(){ const r=_ss.apply(this,arguments); persist(); return r; };
  setInterval(snapshot, 5000);
  window.addEventListener('pagehide', snapshot);
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) snapshot(); });

  // ── the STORY MODE choice on the title ───────────────────────────
  let pick=null;                                         // {idx, save, t}
  const rows=()=>pick?[{k:'continue'},{k:'new'},{k:'back'}]:[];
  function open(save){ pick={idx:0, save, t:0, kw:!!(K['KeyW']), ks:!!(K['KeyS'])}; try{ sfx('menu'); }catch(e){} }
  function close(){ pick=null; }
  function choose(){
    const r=rows()[pick.idx]; if(!r) return;
    try{ sfx('confirm'); }catch(e){}
    if(r.k==='back'){ close(); return; }
    if(r.k==='new'){ close(); try{ localStorage.removeItem(KEY); }catch(e){} _storyNew(); return; }
    // continue
    const s=pick.save; close();
    if(typeof _unlockAudio==='function') _unlockAudio();
    try{ if(typeof _stopBGM==='function'){ _stopBGM('title'); _stopBGM('story'); } if(typeof _stopAllBgm==='function') _stopAllBgm(); }catch(e){}
    if(B.newRun) B.newRun();
    if(s.lives!=null) B.lives=s.lives; if(s.continues!=null) B.continues=s.continues;
    B.saves=s.saves||{}; B.progress=s.progress|0; B.popupSeen=s.popupSeen||{}; B.isoOwned=!!s.isoOwned;
    B.results=null; B.popup=null; B.trans=null;
    _gameState='game';
    startBetaLab(s.stageId, s.mask|0).catch(err=>console.error('stage load failed',err));
  }
  // STORY MODE: ask first when there's a run saved
  const _story=window.startStoryMode;
  function _storyNew(){ return _story.apply(window,[]); }
  window.startStoryMode=function(){
    if(!window.MV_STORY_STAGES||/[?&]selftest=1/.test(location.search)) return _story.apply(this,arguments);
    const s=load();
    if(!s){ return _story.apply(this,arguments); }
    if(pick){ choose(); return; }                        // pad A while the box is up
    open(s);
  };
  // the pad's A goes through the title menu: while the box is up it picks in the box
  const _act=window._titleMenuActivate;
  if(typeof _act==='function') window._titleMenuActivate=function(){ if(pick){ choose(); return; } return _act.apply(this,arguments); };
  // keyboard, while the box is up
  window.addEventListener('keydown',e=>{
    if(!pick||_gameState!=='title') return;
    const c=e.code; let used=true;
    if(c==='ArrowUp'||c==='KeyW') pick.idx=(pick.idx+2)%3;
    else if(c==='ArrowDown'||c==='KeyS') pick.idx=(pick.idx+1)%3;
    else if(c==='Enter'||c==='Space'||c==='NumpadEnter'||c==='KeyQ') choose();
    else if(c==='Escape'||c==='Backspace'||c==='KeyE') close();
    else used=false;
    if(used){ e.preventDefault(); e.stopImmediatePropagation(); if(c!=='Enter'&&c!=='Space'&&c!=='NumpadEnter'&&c!=='KeyQ') try{ sfx('menu'); }catch(_e){} }
  },true);
  // clicks / taps on the box
  function geom(){ const w=560, rh=58, h=128+3*rh, x=(W-w)/2, y=Math.round(H*0.5-h/2+40); return {x,y,w,h,rh}; }
  const _click=window._titleMenuClick;
  if(typeof _click==='function') window._titleMenuClick=function(e){
    if(!pick) return _click.apply(this,arguments);
    const c=document.getElementById('c'); if(!c||!e||e.clientX==null) return;
    const rect=c.getBoundingClientRect(), mx=(e.clientX-rect.left)*(W/rect.width), my=(e.clientY-rect.top)*(H/rect.height);
    const g=geom();
    for(let i=0;i<3;i++){ const y=g.y+96+i*g.rh; if(mx>=g.x+24&&mx<=g.x+g.w-24&&my>=y-10&&my<=y+g.rh-14){ pick.idx=i; choose(); return; } }
    if(mx<g.x||mx>g.x+g.w||my<g.y||my>g.y+g.h) close();
  };
  // pad: the stick / d-pad (they set W/S on the title), B backs out (Escape)
  function padTick(){
    const w=!!K['KeyW'], s=!!K['KeyS'];
    if(w&&!pick.kw){ pick.idx=(pick.idx+2)%3; try{ sfx('menu'); }catch(e){} }
    if(s&&!pick.ks){ pick.idx=(pick.idx+1)%3; try{ sfx('menu'); }catch(e){} }
    pick.kw=w; pick.ks=s;
    if(Kj['Escape']){ delete Kj['Escape']; close(); }
  }
  function ago(t){ const m=Math.round((Date.now()-t)/60000); if(m<1) return 'JUST NOW'; if(m<60) return m+' MIN AGO'; const h=Math.round(m/60); if(h<48) return h+' H AGO'; return Math.round(h/24)+' DAYS AGO'; }
  function summary(s){
    let seeds=0, crystals=0, cleared=0;
    for(const id in (s.saves||{})){ const sv=s.saves[id]; for(const k of (sv.knowls||[])){ if(/^crystal/.test(k)) crystals++; else seeds++; } if(sv.cleared) cleared++; }
    const jacks=['TRS','RCA','XLR','MAG'].filter((n,i)=>(s.mask|0)&(1<<i)).length;
    return seeds+' SEEDS  -  '+crystals+' CRYSTALS  -  '+jacks+' JACKS'+(cleared?'  -  '+cleared+' CLEARED':'');
  }
  const _drawTitle=window.drawTitle;
  if(typeof _drawTitle==='function') window.drawTitle=function(){
    const r=_drawTitle.apply(this,arguments);
    if(!pick) return r;
    pick.t++; padTick(); if(!pick) return r;
    const g=geom(), a=Math.min(1,pick.t/10);
    ctx.save(); ctx.globalAlpha=a;
    ctx.fillStyle='rgba(4,2,10,0.62)'; ctx.fillRect(0,0,W,H);
    uiPanel(g.x,g.y,g.w,g.h,{r:20});
    if(typeof uiLogo==='function') uiLogo('STORY MODE',W/2,g.y+18,40,{sweep:150}); else drawTextC('STORY MODE',W/2,g.y+24,'#ffe39a',3);
    const s=pick.save, L=[
      {t:'CONTINUE', sub:(NAMES[s.stageId]||('STAGE '+s.stageId))+'  -  SAVED '+ago(s.t||Date.now()), sub2:summary(s)},
      {t:'NEW GAME', sub:'START THE STORY FROM THE TOP'},
      {t:'BACK'}];
    L.forEach((it,i)=>{
      const y=g.y+96+i*g.rh, sel=i===pick.idx;
      if(sel){ uiPanel(g.x+24,y-10,g.w-48,g.rh-4,{sel:true,r:12,flat:true}); if(typeof uiCursor==='function') uiCursor(g.x+46,y+10,10); }
      drawTextC(it.t,W/2,y,sel?'#ffe39a':'#c8b8ff',2);
      if(it.sub) drawTextC(it.sub,W/2,y+22,sel?'#e8dcff':'#8a7ab8',1);
      if(it.sub2&&sel) drawTextC(it.sub2,W/2,y+34,'#7dffcf',1);
    });
    drawTextC('A SELECT    B BACK',W/2,g.y+g.h-20,'#8a7ab8',1);
    ctx.restore();
    return r;
  };
})();
