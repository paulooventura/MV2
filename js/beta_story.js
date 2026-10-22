// ============================================================
//  beta_story.js — Story Mode save slots (Paulo, Oct 22)
//
//  Five storyline slots. Each is its own run. A save is made in your slot
//  every time you reach a stage (start of the story, and each stage you pass
//  into): the stage, the jacks you own, every stage's saved state (seeds,
//  crystals, crates, the Isolator, Laitu, the clock, cleared arches).
//  GAME OVER (no continues left) sends you back to your slot's last save with
//  fresh lives and continues.
//  STORY MODE on the title: with no save anywhere it starts a new story in
//  slot 1; once a slot holds a save it shows all five — a saved slot carries
//  on from its save, an empty one starts a new story there (and saves there
//  from then on). Y (F / Delete) on a saved slot erases it (press twice).
//  Kept in the browser (localStorage), so it survives closing the page.
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B) return;
  const KEY='mv2.story.slots.v1', OLD='mv2.story.v1', N=5;
  const NAMES={'1.1':'AWDJOO TOWN 1.1','1.2':'AWDJOO TOWN 1.2'};

  function slots(){
    let s=null; try{ s=JSON.parse(localStorage.getItem(KEY)||'null'); }catch(e){}
    if(!Array.isArray(s)){ s=new Array(N).fill(null);
      try{ const o=JSON.parse(localStorage.getItem(OLD)||'null'); if(o&&o.stageId){ s[0]=o; localStorage.setItem(KEY,JSON.stringify(s)); localStorage.removeItem(OLD); } }catch(e){} }
    while(s.length<N) s.push(null);
    return s.slice(0,N);
  }
  function writeSlots(s){ try{ localStorage.setItem(KEY,JSON.stringify(s)); }catch(e){} }
  function savepoint(){
    if(B.storySlot==null||!B.stageId) return;
    const s=slots();
    s[B.storySlot]={stageId:B.stageId, mask:_unlockedMask|0, progress:B.progress|0, saves:JSON.parse(JSON.stringify(B.saves||{})),
      popupSeen:Object.assign({},B.popupSeen||{}), isoOwned:!!B.isoOwned, t:Date.now()};
    writeSlots(s);
  }
  B.storySlots=slots;

  // a save every time a stage has finished loading in story mode (start, each stage passed)
  let lastLevel=null;
  setInterval(()=>{
    if(!B.on||_gameState!=='game'||!B.level||B.level===lastLevel||B.trans) return;
    lastLevel=B.level; savepoint();
  },250);
  // the end of the story counts too (the last arch is cleared)
  const _quit=B.quitToTitle;
  if(_quit) B.quitToTitle=function(){ if(B.ending&&B.saveStage){ try{ B.saveStage(); }catch(e){} savepoint(); } return _quit.apply(this,arguments); };

  // start a run from a slot's save
  function play(save){
    if(typeof _unlockAudio==='function') _unlockAudio();
    try{ if(typeof _stopBGM==='function'){ _stopBGM('title'); _stopBGM('story'); } if(typeof _stopAllBgm==='function') _stopAllBgm(); }catch(e){}
    if(B.newRun) B.newRun();
    B.saves=JSON.parse(JSON.stringify(save.saves||{})); B.progress=save.progress|0; B.popupSeen=Object.assign({},save.popupSeen||{}); B.isoOwned=!!save.isoOwned;
    B.results=null; B.popup=null; B.trans=null; B.ending=null; B.contScreen=null; B.overT=0;
    _paused=false; _gameState='game';
    startBetaLab(save.stageId, save.mask|0).catch(err=>console.error('stage load failed',err));
  }
  // GAME OVER: back to the last save in this slot (fresh lives + continues)
  B.storyGameOver=function(){
    if(B.storySlot==null) return false;
    const s=slots()[B.storySlot]; if(!s) return false;
    if(typeof uiShowToast==='function') uiShowToast('GAME OVER - BACK TO YOUR LAST SAVE');
    play(s); return true;
  };

  // ── the slot screen on the title ─────────────────────────────────
  let pick=null;                                             // {idx, t, erase}
  const ROWS=N+1;                                            // 5 slots + BACK
  function open(){ pick={idx:Math.max(0,B.storySlot!=null?B.storySlot:0), t:0, erase:-1, kw:!!K['KeyW'], ks:!!K['KeyS'], kf:!!K['KeyF']}; try{ sfx('menu'); }catch(e){} }
  function close(){ pick=null; }
  function choose(){
    if(!pick) return;
    const i=pick.idx;
    try{ sfx('confirm'); }catch(e){}
    if(i>=N){ close(); return; }
    const s=slots()[i]; close();
    B.storySlot=i;
    if(s) play(s);
    else _storyNew();                                        // a new story in this slot (intro, then 1.1)
  }
  function eraseKey(){
    if(!pick||pick.idx>=N) return;
    const s=slots(); if(!s[pick.idx]) return;
    if(pick.erase===pick.idx){ s[pick.idx]=null; writeSlots(s); if(B.storySlot===pick.idx) B.storySlot=null; pick.erase=-1; try{ sfx('omniblock_chip'); }catch(e){} }
    else { pick.erase=pick.idx; try{ sfx('menu'); }catch(e){} }
  }
  const move=d=>{ pick.idx=(pick.idx+d+ROWS)%ROWS; pick.erase=-1; try{ sfx('menu'); }catch(e){} };

  const _story=window.startStoryMode;
  function _storyNew(){ return _story.apply(window,[]); }
  window.startStoryMode=function(){
    if(!window.MV_STORY_STAGES||/[?&]selftest=1/.test(location.search)) return _story.apply(this,arguments);
    if(pick){ choose(); return; }                            // pad A while the screen is up
    if(!slots().some(Boolean)){ B.storySlot=0; return _story.apply(this,arguments); }   // nothing saved yet: straight in, slot 1
    open();
  };
  const _act=window._titleMenuActivate;
  if(typeof _act==='function') window._titleMenuActivate=function(){ if(pick){ choose(); return; } return _act.apply(this,arguments); };
  window.addEventListener('keydown',e=>{
    if(!pick||_gameState!=='title') return;
    const c=e.code; let used=true;
    if(c==='ArrowUp'||c==='KeyW') move(-1);
    else if(c==='ArrowDown'||c==='KeyS') move(1);
    else if(c==='Enter'||c==='Space'||c==='NumpadEnter'||c==='KeyQ') choose();
    else if(c==='KeyF'||c==='Delete') eraseKey();
    else if(c==='Escape'||c==='Backspace'||c==='KeyE') close();
    else used=false;
    if(used){ e.preventDefault(); e.stopImmediatePropagation(); }
  },true);
  function geom(){ const w=640, rh=50, h=112+ROWS*rh, x=(W-w)/2, y=Math.round(H*0.5-h/2+24); return {x,y,w,h,rh}; }
  const rowY=(g,i)=>g.y+84+i*g.rh;
  const _click=window._titleMenuClick;
  if(typeof _click==='function') window._titleMenuClick=function(e){
    if(!pick) return _click.apply(this,arguments);
    const c=document.getElementById('c'); if(!c||!e||e.clientX==null) return;
    const rect=c.getBoundingClientRect(), mx=(e.clientX-rect.left)*(W/rect.width), my=(e.clientY-rect.top)*(H/rect.height);
    const g=geom();
    for(let i=0;i<ROWS;i++){ const y=rowY(g,i); if(mx>=g.x+20&&mx<=g.x+g.w-20&&my>=y-10&&my<=y+g.rh-12){ pick.idx=i; choose(); return; } }
    if(mx<g.x||mx>g.x+g.w||my<g.y||my>g.y+g.h) close();
  };
  function padTick(){
    const w=!!K['KeyW'], s=!!K['KeyS'], f=!!K['KeyF'];
    if(w&&!pick.kw) move(-1);
    if(s&&!pick.ks) move(1);
    if(f&&!pick.kf) eraseKey();
    pick.kw=w; pick.ks=s; pick.kf=f;
    if(Kj['Escape']){ delete Kj['Escape']; close(); }
  }
  function ago(t){ const m=Math.round((Date.now()-t)/60000); if(m<1) return 'JUST NOW'; if(m<60) return m+' MIN AGO'; const h=Math.round(m/60); if(h<48) return h+' H AGO'; return Math.round(h/24)+' DAYS AGO'; }
  function summary(s){
    let seeds=0, crystals=0, cleared=0;
    for(const id in (s.saves||{})){ const sv=s.saves[id]; for(const k of (sv.knowls||[])){ if(/^crystal/.test(k)) crystals++; else seeds++; } if(sv.cleared) cleared++; }
    const jacks=[0,1,2,3].filter(i=>(s.mask|0)&(1<<i)).length;
    return seeds+' SEEDS  -  '+crystals+' CRYSTALS  -  '+jacks+' JACKS'+(cleared?'  -  '+cleared+' CLEARED':'');
  }
  const _drawTitle=window.drawTitle;
  if(typeof _drawTitle==='function') window.drawTitle=function(){
    const r=_drawTitle.apply(this,arguments);
    if(!pick) return r;
    pick.t++; padTick(); if(!pick) return r;
    const g=geom(), a=Math.min(1,pick.t/10), S=slots();
    ctx.save(); ctx.globalAlpha=a;
    ctx.fillStyle='rgba(4,2,10,0.66)'; ctx.fillRect(0,0,W,H);
    uiPanel(g.x,g.y,g.w,g.h,{r:20});
    if(typeof uiLogo==='function') uiLogo('STORY MODE',W/2,g.y+16,38,{sweep:150}); else drawTextC('STORY MODE',W/2,g.y+22,'#ffe39a',3);
    for(let i=0;i<ROWS;i++){
      const y=rowY(g,i), sel=i===pick.idx;
      if(sel){ uiPanel(g.x+20,y-10,g.w-40,g.rh-6,{sel:true,r:12,flat:true}); if(typeof uiCursor==='function') uiCursor(g.x+40,y+10,10); }
      if(i>=N){ drawTextC('BACK',W/2,y+2,sel?'#ffe39a':'#c8b8ff',2); continue; }
      const s=S[i], X=g.x+64;
      drawText('SLOT '+(i+1),X,y-2,sel?'#ffe39a':'#c8b8ff',2);
      if(s){
        drawText((NAMES[s.stageId]||('STAGE '+s.stageId))+'  -  SAVED '+ago(s.t||Date.now()),X+130,y-2,sel?'#ffffff':'#e8dcff',1);
        drawText(pick.erase===i?'PRESS Y AGAIN TO ERASE THIS SLOT':summary(s),X+130,y+14,pick.erase===i?'#ff6a7a':'#7dffcf',1);
      }else{
        drawText('EMPTY',X+130,y-2,sel?'#ffffff':'#8a7ab8',1);
        drawText('START A NEW STORY HERE',X+130,y+14,sel?'#c8b8ff':'#5a4a88',1);
      }
    }
    drawTextC('A PLAY    Y ERASE    B BACK',W/2,g.y+g.h-20,'#8a7ab8',1);
    ctx.restore();
    return r;
  };
})();
