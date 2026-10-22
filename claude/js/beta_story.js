// ============================================================
//  beta_story.js — Story Mode save slots (Paulo, Oct 22)
//
//  Five storyline slots. Each is its own run. A save is made in your slot
//  every time you reach a stage (start of the story, and each stage you pass
//  into): the stage, the jacks you own, every stage's saved state (seeds,
//  crystals, crates, the Isolator, Laitu, the clock, cleared arches).
//  GAME OVER (no continues left) sends you back to your slot's last save with
//  fresh lives and continues.
//  STORY MODE (Paulo, Oct 22 — the order is the game's front door):
//    splash logos → title → STORY MODE → the storyline pages → TIMELINE (pick
//    one of five: a saved one carries on from its save, an empty one starts a
//    new story there) → character select → the stage.
//  Y (F / Delete) on a saved timeline erases it (press twice).
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
      popupSeen:Object.assign({},B.popupSeen||{}), isoOwned:!!B.isoOwned, t:Date.now(),
      hero:(typeof _heroChoice!=='undefined'?_heroChoice:'mind'), intro:true};   // intro: this run has had its story + hero pick
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

  // Paulo (Oct 22): "a fluid sequence from start of game to action" — carrying on a saved
  // story first shows a chapter card (the stage, your hero, what you've found), then the
  // stage fades in. Any button after a moment skips it.
  const CARD_FR=170;
  let card=null;
  const HERO_IM={}; for(const k of ['mind','venture']){ const im=new Image(); im.src='assets/ui/hero-'+k+'.png?v=229'; HERO_IM[k]=im; }
  function chapter(save,msg){
    try{ if(typeof _stopBGM==='function'){ _stopBGM('title'); _stopBGM('story'); } if(typeof _stopAllBgm==='function') _stopAllBgm(); }catch(e){}
    card={save, msg:msg||null, t:0}; _paused=false; _gameState='chapter';
    try{ sfx('gate'); }catch(e){}
  }
  function cardDraw(){
    const c=card, s=c.save, k=Math.min(1,c.t/40), out=Math.max(0,(c.t-(CARD_FR-30))/30);
    try{ if(window.MV_SKY){ ctx.save(); MV_SKY.draw({stageId:s.stageId}, H*0.92); ctx.restore(); } else { ctx.fillStyle='#04140e'; ctx.fillRect(0,0,W,H); } }catch(e){ ctx.fillStyle='#04140e'; ctx.fillRect(0,0,W,H); }
    ctx.fillStyle='rgba(2,8,4,0.55)'; ctx.fillRect(0,0,W,H);
    const hero=s.hero==='venture'?'venture':'mind', im=HERO_IM[hero], col=hero==='venture'?'#ff6a5a':'#c48cff';
    if(im.complete&&im.naturalWidth){ const ih=Math.round(H*0.78), iw=Math.round(ih*im.naturalWidth/im.naturalHeight);
      if(!im._feather||im._feather.width!==iw){ const c2=document.createElement('canvas'); c2.width=iw; c2.height=ih; const o=c2.getContext('2d'); o.imageSmoothingEnabled=false; o.drawImage(im,0,0,iw,ih);
        o.globalCompositeOperation='destination-in';
        const gx=o.createLinearGradient(0,0,iw,0); gx.addColorStop(0,'rgba(0,0,0,0)'); gx.addColorStop(0.22,'#000'); gx.addColorStop(0.78,'#000'); gx.addColorStop(1,'rgba(0,0,0,0)'); o.fillStyle=gx; o.fillRect(0,0,iw,ih);
        const gy=o.createLinearGradient(0,0,0,ih); gy.addColorStop(0,'rgba(0,0,0,0)'); gy.addColorStop(0.12,'#000'); gy.addColorStop(0.85,'#000'); gy.addColorStop(1,'rgba(0,0,0,0)'); o.fillStyle=gy; o.fillRect(0,0,iw,ih); im._feather=c2; }
      ctx.save(); ctx.globalAlpha=k; ctx.drawImage(im._feather, W*0.72-iw/2+(1-k)*80, H*0.12); ctx.restore(); }
    ctx.save(); ctx.globalAlpha=k;
    if(c.msg) drawTextC(c.msg,W*0.36,H*0.2,'#ffb0a0',2);
    drawText('CHAPTER',80,H*0.28,'#9ef58a',2);
    if(typeof uiLogo==='function') uiLogo(NAMES[s.stageId]||s.stageId,W*0.36,H*0.32,38,{col:'#b8f5a0',sweep:200});
    drawText((hero==='venture'?'VENTURE':'MIND')+' LEADS',80,H*0.46,col,2);
    drawText(summary(s),80,H*0.52,'#d8ffc8',1);
    if(c.t>40&&(c.t>>4)%2===0) drawText('PRESS ANY BUTTON',80,H*0.62,'#ffe39a',2);
    ctx.restore();
    if(out>0){ ctx.fillStyle='rgba(2,8,4,'+Math.min(1,out)+')'; ctx.fillRect(0,0,W,H); }
  }
  function cardGo(){ const s=card.save; card=null; play(s,true); }
  const _upd=window.update, _drw=window.draw;
  window.update=function(){
    if(_gameState==='chapter'&&card){
      card.t++; fr++;
      let any=false; for(const k in Kj){ if(Kj[k]) any=true; }
      if(any&&card.t>40&&card.t<CARD_FR-30) card.t=CARD_FR-30;            // skip to the fade
      if(card.t>=CARD_FR) cardGo();
      if(typeof clkj==='function') clkj(); return;
    }
    return _upd.apply(this,arguments);
  };
  window.draw=function(){
    if(_gameState==='chapter'&&card){ ctx.save(); ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over'; cardDraw(); ctx.restore(); return; }
    return _drw.apply(this,arguments);
  };
  document.addEventListener('click',e=>{ if(_gameState==='chapter'&&card&&card.t>40){ card.t=Math.max(card.t,CARD_FR-30); e.stopImmediatePropagation(); } },true);

  // start a run from a slot's save
  function play(save,fromCard){
    if(fromCard==='select'){ save=Object.assign({},save,{hero:(typeof _heroChoice!=='undefined'?_heroChoice:save.hero)}); }
    else if(!fromCard){ chapter(save); return; }
    if(typeof _unlockAudio==='function') _unlockAudio();
    try{ if(typeof _stopBGM==='function'){ _stopBGM('title'); _stopBGM('story'); } if(typeof _stopAllBgm==='function') _stopAllBgm(); }catch(e){}
    if(B.newRun) B.newRun();
    if(save.hero&&typeof _heroChoice!=='undefined'){ _heroChoice=save.hero; if(typeof p!=='undefined'&&p) p.hero=save.hero; }
    B.saves=JSON.parse(JSON.stringify(save.saves||{})); B.progress=save.progress|0; B.popupSeen=Object.assign({},save.popupSeen||{}); B.isoOwned=!!save.isoOwned;
    B.results=null; B.popup=null; B.trans=null; B.ending=null; B.contScreen=null; B.overT=0;
    _paused=false; _gameState='game';
    startBetaLab(save.stageId, save.mask|0).catch(err=>console.error('stage load failed',err));
  }
  // GAME OVER: back to the last save in this slot (fresh lives + continues)
  B.storyPlay=play;
  B.storyGameOver=function(){
    if(B.storySlot==null) return false;
    const s=slots()[B.storySlot]; if(!s) return false;
    chapter(s,'GAME OVER  -  BACK TO YOUR LAST SAVE'); return true;
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
    if(i>=N){ close(); window.MV_TIMELINE_BACK_TO_STORY(); return; }
    const s=slots()[i]; close();
    B.storySlot=i; B.pendingSave=s||null;                    // saved: carry on from it · empty: a new story here (1.1)
    if(s&&s.hero&&typeof _heroChoice!=='undefined') _heroChoice=s.hero;   // the select opens on this timeline's hero
    _gameState='select'; if(typeof _selectStep!=='undefined') _selectStep=0; if(typeof _playModeIdx!=='undefined') _playModeIdx=0;
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
  const live=()=>window.MV_STORY_STAGES&&!/[?&]selftest=1/.test(location.search);
  window.startStoryMode=function(){
    if(!live()) return _story.apply(this,arguments);
    B.pendingSave=null; B.storySlot=null; pick=null;
    return _story.apply(this,arguments);                     // the storyline first, always
  };
  // the last story page → the TIMELINE screen (instead of straight to the select)
  const _sg=window.startGame;
  if(typeof _sg==='function') window.startGame=function(){
    const was=_gameState, r=_sg.apply(this,arguments);
    if(live()&&was==='story'&&_gameState==='select'){ _gameState='timeline'; open(); }
    return r;
  };
  window.MV_TIMELINE_BACK_TO_STORY=function(){ pick=null; _gameState='story'; if(typeof STORY_PAGES!=='undefined') _storyPage=STORY_PAGES.length-1; };
  // B on the select (first step) goes back to the timeline
  window.MV_TIMELINE_BACK=function(){ if(!live()) return false; _gameState='timeline'; open(); return true; };
  const _act=window._titleMenuActivate;
  if(typeof _act==='function') window._titleMenuActivate=function(){ if(pick){ choose(); return; } return _act.apply(this,arguments); };
  window.addEventListener('keydown',e=>{
    if(!pick||_gameState!=='timeline') return;
    const c=e.code; let used=true;
    if(c==='ArrowUp'||c==='KeyW') move(-1);
    else if(c==='ArrowDown'||c==='KeyS') move(1);
    else if(c==='Enter'||c==='Space'||c==='NumpadEnter'||c==='KeyQ') choose();
    else if(c==='KeyF'||c==='Delete') eraseKey();
    else if(c==='Escape'||c==='Backspace'||c==='KeyE'){ close(); MV_TIMELINE_BACK_TO_STORY(); }
    else used=false;
    if(used){ e.preventDefault(); e.stopImmediatePropagation(); }
  },true);
  function geom(){ const w=640, rh=50, h=112+ROWS*rh, x=(W-w)/2, y=Math.round(H*0.5-h/2+24); return {x,y,w,h,rh}; }
  const rowY=(g,i)=>g.y+84+i*g.rh;
  document.addEventListener('click',e=>{
    if(!pick||_gameState!=='timeline') return;
    e.stopImmediatePropagation();
    const c=document.getElementById('c'); if(!c||!e||e.clientX==null) return;
    const rect=c.getBoundingClientRect(), mx=(e.clientX-rect.left)*(W/rect.width), my=(e.clientY-rect.top)*(H/rect.height);
    const g=geom();
    for(let i=0;i<ROWS;i++){ const y=rowY(g,i); if(mx>=g.x+20&&mx<=g.x+g.w-20&&my>=y-10&&my<=y+g.rh-12){ pick.idx=i; choose(); return; } }
  },true);
  function padTick(){
    const w=!!K['KeyW'], s=!!K['KeyS'], f=!!K['KeyF'];
    if(w&&!pick.kw) move(-1);
    if(s&&!pick.ks) move(1);
    if(f&&!pick.kf) eraseKey();
    pick.kw=w; pick.ks=s; pick.kf=f;
    if(Kj['Escape']){ delete Kj['Escape']; close(); MV_TIMELINE_BACK_TO_STORY(); return; }
    if(Kj['Space']||Kj['Enter']){ delete Kj['Space']; delete Kj['Enter']; if(pick.t>8) choose(); }   // pad A
  }
  function ago(t){ const m=Math.round((Date.now()-t)/60000); if(m<1) return 'JUST NOW'; if(m<60) return m+' MIN AGO'; const h=Math.round(m/60); if(h<48) return h+' H AGO'; return Math.round(h/24)+' DAYS AGO'; }
  function summary(s){
    let seeds=0, crystals=0, cleared=0;
    for(const id in (s.saves||{})){ const sv=s.saves[id]; for(const k of (sv.knowls||[])){ if(/^crystal/.test(k)) crystals++; else seeds++; } if(sv.cleared) cleared++; }
    const jacks=[0,1,2,3].filter(i=>(s.mask|0)&(1<<i)).length;
    return seeds+' SEEDS  -  '+crystals+' CRYSTALS  -  '+jacks+' JACKS'+(cleared?'  -  '+cleared+' CLEARED':'');
  }
  const _updT=window.update;
  window.update=function(){
    if(_gameState==='timeline'){ if(typeof readGamepad==='function') try{ readGamepad(); }catch(e){} if(!pick) open(); pick.t++; padTick(); if(typeof clkj==='function') clkj(); if(typeof fr==='number') fr++; return; }
    return _updT.apply(this,arguments);
  };
  const _drwT=window.draw;
  window.draw=function(){
    if(_gameState!=='timeline') return _drwT.apply(this,arguments);
    ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='#04020a'; ctx.fillRect(0,0,W,H);
    try{ if(typeof MAP_ART!=='undefined'&&MAP_ART.complete&&MAP_ART.naturalWidth){ const k=Math.max(W/MAP_ART.naturalWidth,H/MAP_ART.naturalHeight); const iw=MAP_ART.naturalWidth*k, ih=MAP_ART.naturalHeight*k; ctx.globalAlpha=0.5; ctx.drawImage(MAP_ART,(W-iw)/2,(H-ih)/2,iw,ih); ctx.globalAlpha=1; } }catch(e){}
    ctx.restore();
    if(pick) drawPick();
  };
  function drawPick(){
    const g=geom(), a=Math.min(1,pick.t/10), S=slots();
    ctx.save(); ctx.globalAlpha=a;
    ctx.fillStyle='rgba(4,2,10,0.5)'; ctx.fillRect(0,0,W,H);
    uiPanel(g.x,g.y,g.w,g.h,{r:20});
    if(typeof uiLogo==='function') uiLogo('TIMELINE',W/2,g.y+16,38,{sweep:150}); else drawTextC('TIMELINE',W/2,g.y+22,'#ffe39a',3);
    for(let i=0;i<ROWS;i++){
      const y=rowY(g,i), sel=i===pick.idx;
      if(sel){ uiPanel(g.x+20,y-10,g.w-40,g.rh-6,{sel:true,r:12,flat:true}); if(typeof uiCursor==='function') uiCursor(g.x+40,y+10,10); }
      if(i>=N){ drawTextC('BACK',W/2,y+2,sel?'#ffe39a':'#c8b8ff',2); continue; }
      const s=S[i], X=g.x+64;
      drawText('TIMELINE '+(i+1),X,y-2,sel?'#ffe39a':'#c8b8ff',2);
      if(s){
        drawText((NAMES[s.stageId]||('STAGE '+s.stageId))+'  -  SAVED '+ago(s.t||Date.now()),X+170,y-2,sel?'#ffffff':'#e8dcff',1);
        drawText(pick.erase===i?'PRESS Y AGAIN TO ERASE THIS TIMELINE':summary(s),X+170,y+14,pick.erase===i?'#ff6a7a':'#7dffcf',1);
      }else{
        drawText('EMPTY',X+170,y-2,sel?'#ffffff':'#8a7ab8',1);
        drawText('START A NEW STORY HERE',X+170,y+14,sel?'#c8b8ff':'#5a4a88',1);
      }
    }
    drawTextC('A PLAY    Y ERASE    B BACK',W/2,g.y+g.h-20,'#8a7ab8',1);
    ctx.restore();
  }
})();
