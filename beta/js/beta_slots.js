// ============================================================
//  beta_slots.js — Journeys: 5 save slots for the live game.
//
//  Clearing Awdjoo 1.1 saves the game (the next stage, the jacks you own,
//  the Isolator and what each stage remembers). Walking into a new stage
//  saves again. Saves live in localStorage 'mv2.journeys' (5 slots).
//  Once one journey exists, STORY MODE opens the JOURNEYS screen:
//  pick a saved journey to carry on, an empty slot to start a new one,
//  or DELETE / COPY / PASTE to branch timelines.
//  Loads before beta_intro.js (its update wrapper reads the pad first).
// ============================================================
(function(){
  'use strict';
  const KEY='mv2.journeys', N=5, ACTS=['DELETE','COPY','PASTE'];
  let slots=load(), active=null, clip=null;
  let row=0, act=0, mode=null, confirm=null, arm=false, note='', noteT=0, savedT=0;
  const prev={};

  function load(){
    try{ const a=JSON.parse(localStorage.getItem(KEY)||'[]'); if(Array.isArray(a)) return Array.from({length:N},(_,i)=>a[i]||null); }catch(e){}
    return Array(N).fill(null);
  }
  function persist(){ try{ localStorage.setItem(KEY,JSON.stringify(slots)); }catch(e){} }
  const any=()=>slots.some(Boolean);
  const clone=o=>JSON.parse(JSON.stringify(o));
  function when(ts){
    const d=new Date(ts), h=d.getHours(), h12=h%12||12;
    return (d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear()+' - '+h12+':'+String(d.getMinutes()).padStart(2,'0')+' '+(h<12?'AM':'PM');
  }
  const slotText=s=>'AWDJOO '+s.stage+' - '+when(s.ts);
  const fmt=s=>window.MV_INPUT?MV_INPUT.fmt(s):s.replace(/\{\w+\}/g,'');

  // ── Save points (called by beta_level.js) ───────────────────────
  function savePoint(why){
    const B=window.MV_BETA; if(!B||!B.on||!B.stageId) return;
    if(/[?&]selftest=/.test(location.search)) return;
    if(active==null){ active=slots.findIndex(s=>!s); if(active<0) active=0; }
    if(B.saveStage) B.saveStage();
    const L=B.LEVELS||{}, here=L[B.stageId];
    const stage=why==='clear'&&here&&here.next?here.next:B.stageId;
    const order=Object.keys(L);
    slots[active]={stage, mask:(typeof _unlockedMask!=='undefined'?_unlockedMask:B.carryMask)|0, iso:!!(B.isoOwned||B.hasIsolator),
      saves:clone(B.saves||{}), progress:Math.max(B.progress||0, order.indexOf(stage)), ts:Date.now()};
    persist(); savedT=150;
  }
  function hookLevel(){ if(window.MV_BETA) MV_BETA.onSavePoint=savePoint; else requestAnimationFrame(hookLevel); }
  hookLevel();

  function loadJourney(i){
    const s=slots[i], B=window.MV_BETA; if(!s||!B||typeof startBetaLab!=='function') return;
    active=i; savedT=0;
    if(typeof _stopBGM==='function') try{ _stopBGM('title'); }catch(e){}
    B.results=null; B.popup=null; B.trans=null;
    B.saves=clone(s.saves||{}); B.isoOwned=!!s.iso; B.progress=s.progress||0;
    if(B.LEVELS&&B.LEVELS[s.stage]&&!B.LEVELS[s.stage].next) delete B.saves[s.stage];   // the last stage replays from its start
    startBetaLab(s.stage, s.mask, {}).then(()=>{ const c=document.getElementById('c'); if(c&&c.focus) c.focus(); }).catch(err=>console.error('journey load failed',err));
  }

  // ── STORY MODE: straight into the story until a journey exists ──
  const _startStory=window.startStoryMode;
  function newJourney(i){ active=i; _startStory(); }
  window.startStoryMode=function(){
    if(!any()){ active=0; return _startStory.apply(this,arguments); }
    _gameState='slots'; row=Math.max(0,active!=null&&slots[active]?active:slots.findIndex(Boolean)); act=0; mode=null; confirm=null; arm=true;
  };
  function say(t){ note=t; noteT=150; }

  // ── Input ───────────────────────────────────────────────────────
  function rises(){
    const held={up:!!(K.KeyW||K.ArrowUp), down:!!(K.KeyS||K.ArrowDown), left:!!(K.KeyA||K.ArrowLeft), right:!!(K.KeyD||K.ArrowRight)};
    const r={};
    for(const k in held){ r[k]=held[k]&&!prev[k]; prev[k]=held[k]; }
    r.up=r.up||!!(Kj.PadUp||Kj.KeyW||Kj.ArrowUp); r.down=r.down||!!(Kj.PadDown||Kj.KeyS||Kj.ArrowDown);
    r.left=r.left||!!(Kj.KeyA||Kj.ArrowLeft); r.right=r.right||!!(Kj.KeyD||Kj.ArrowRight);
    r.ok=!!(Kj.Space||Kj.Enter||Kj.NumpadEnter); r.back=!!(Kj.Escape||Kj.PadB||Kj.Backspace);
    return r;
  }
  function endTick(){ fr++; clkj(); if(typeof Kj2!=='undefined') Object.keys(Kj2).forEach(k=>delete Kj2[k]); }
  function pickSlot(i){
    const s=slots[i];
    if(mode==='DELETE'){ if(!s){ say('THAT SLOT IS ALREADY EMPTY'); return; } confirm={kind:'delete', i, sel:0}; return; }
    if(mode==='COPY'){ if(!s){ say('PICK A SAVED JOURNEY TO COPY'); return; } clip=clone(s); mode=null; say('JOURNEY '+(i+1)+' COPIED - NOW PASTE IT'); act=2; return; }
    if(mode==='PASTE'){
      if(!clip){ mode=null; say('COPY A JOURNEY FIRST'); return; }
      if(s){ confirm={kind:'paste', i, sel:0}; return; }
      slots[i]=clone(clip); persist(); mode=null; say('PASTED INTO SLOT '+(i+1)); return;
    }
    if(s) loadJourney(i); else newJourney(i);
  }
  function slotsTick(){
    if(arm){ arm=false; rises(); endTick(); return; }
    const n=rises();
    if(noteT>0) noteT--;
    if(confirm){
      if(n.up||n.down||n.left||n.right) confirm.sel=1-confirm.sel;
      if(n.back){ confirm=null; }
      else if(n.ok){
        if(confirm.sel===1){
          if(confirm.kind==='delete'){ slots[confirm.i]=null; if(active===confirm.i) active=null; say('JOURNEY '+(confirm.i+1)+' DELETED'); }
          else{ slots[confirm.i]=clone(clip); say('PASTED INTO SLOT '+(confirm.i+1)); }
          persist(); mode=null;
        }
        confirm=null;
      }
      endTick(); return;
    }
    if(n.back){ if(mode){ mode=null; } else { _gameState='title'; _titleMenuIdx=0; } endTick(); return; }
    if(n.up) row=row===N?N-1:(row+N)%(N+1);
    if(n.down) row=(row+1)%(N+1);
    if(row===N&&(n.left||n.right)) act=(act+(n.right?1:ACTS.length-1))%ACTS.length;
    if(n.ok){
      if(row===N){
        const a=ACTS[act];
        if(a==='PASTE'&&!clip) say('COPY A JOURNEY FIRST');
        else{ mode=mode===a?null:a; if(mode) row=Math.max(0,slots.findIndex(Boolean)); }
      }else pickSlot(row);
    }
    endTick();
  }

  // ── Drawing ─────────────────────────────────────────────────────
  function geom(){
    const w=680, rowH=58, x=W/2-w/2, y=96;
    const rows=Array.from({length:N},(_,i)=>({x:x+24,y:y+70+i*rowH,w:w-48,h:rowH-12}));
    const ay=y+70+N*rowH+10, aw=150, gap=24, ax=W/2-(ACTS.length*aw+(ACTS.length-1)*gap)/2;
    const acts=ACTS.map((_,i)=>({x:ax+i*(aw+gap),y:ay,w:aw,h:40}));
    return {x,y,w,h:ay+40+70-y,rows,acts};
  }
  function drawSlots(){
    if(typeof _drawSnesStarfield==='function') _drawSnesStarfield(); else{ ctx.fillStyle='#05030c'; ctx.fillRect(0,0,W,H); }
    const g=geom();
    uiPanel(g.x,g.y,g.w,g.h,{r:18});
    uiLogo('JOURNEYS',W/2,g.y+14,40,{sweep:300});
    g.rows.forEach((r,i)=>{
      const on=row===i&&!confirm, s=slots[i];
      uiPanel(r.x,r.y,r.w,r.h,{sel:on,r:12,flat:!on});
      if(on) uiCursor(r.x+20,r.y+r.h/2,9);
      drawText(String(i+1),r.x+40,r.y+r.h/2-8,on?'#ffe39a':'#9c8cc8',2);
      if(s) drawText(slotText(s),r.x+76,r.y+r.h/2-8,on?C.WHITE:'#e8dcff',2);
      else drawText(mode?'- EMPTY -':'- NEW JOURNEY -',r.x+76,r.y+r.h/2-8,on?'#c8b8ff':'#6a5a8c',2);
      if(i===active&&s) drawTextR('LAST',r.x+r.w-18,r.y+r.h/2-4,'#7dffcf',1);
    });
    g.acts.forEach((a,i)=>{
      const on=row===N&&act===i&&!confirm, cur=mode===ACTS[i];
      uiPill(a.x,a.y,a.w,a.h,{on:on||cur,col:ACTS[i]==='DELETE'?'#ff6a7a':ACTS[i]==='COPY'?'#7dd0ff':'#7dffcf'});
      drawTextC(ACTS[i],a.x+a.w/2,a.y+12,on||cur?C.WHITE:'#a898d0',2);
    });
    const hy=g.y+g.h-46;
    const tip=mode==='DELETE'?'CHOOSE A JOURNEY TO DELETE':mode==='COPY'?'CHOOSE A JOURNEY TO COPY':mode==='PASTE'?'CHOOSE WHERE TO PASTE':'';
    if(noteT>0) drawTextC(note,W/2,hy,'#ffe39a',1);
    else if(tip) drawTextC(tip,W/2,hy,'#ffe39a',1);
    else if(clip) drawTextC('COPIED: '+slotText(clip),W/2,hy,'#7dd0ff',1);
    drawTextC(fmt(mode?'{ok} CHOOSE    {back} CANCEL':'{updown} SELECT    {ok} PLAY    {back} BACK'),W/2,g.y+g.h-24,'#9c8cc8',1);
    if(confirm){
      ctx.fillStyle='rgba(4,2,10,0.6)'; ctx.fillRect(0,0,W,H);
      const t=confirm.kind==='delete'?'DELETE JOURNEY '+(confirm.i+1)+'?':'OVERWRITE JOURNEY '+(confirm.i+1)+'?';
      const w=440, h=170, x=W/2-w/2, y=H/2-h/2;
      uiPanel(x,y,w,h,{r:16});
      drawTextC(t,W/2,y+26,'#ffe39a',2);
      ['NO','YES'].forEach((l,i)=>{ const bx=W/2-150+i*170, on=confirm.sel===i; uiPanel(bx,y+86,130,44,{sel:on,r:10,flat:!on}); drawTextC(l,bx+65,y+100,on?C.WHITE:C.LILAC,2); });
    }
  }
  function drawSaved(){
    if(savedT<=0) return;
    savedT--;
    if(_gameState!=='game') return;
    ctx.save(); ctx.globalAlpha=Math.min(1,savedT/30);
    uiPanel(W-250,H-62,230,40,{r:12,alpha:0.85,flat:true});
    if(typeof uiSparkle==='function') uiSparkle(W-226,H-42,6,'#7dffcf',0.6+0.4*Math.sin(fr*0.2));
    drawText('JOURNEY SAVED',W-208,H-50,'#7dffcf',2);
    ctx.restore();
  }

  // click / tap a slot or an action
  document.addEventListener('pointerdown',e=>{
    if(_gameState!=='slots'||confirm) return;
    const c=document.getElementById('c'); if(!c) return;
    const r=c.getBoundingClientRect(); if(!r.width) return;
    const x=(e.clientX-r.left)*W/r.width, y=(e.clientY-r.top)*H/r.height, g=geom();
    const hit=b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;
    g.rows.forEach((b,i)=>{ if(hit(b)){ row=i; pickSlot(i); } });
    g.acts.forEach((b,i)=>{ if(hit(b)){ row=N; act=i; const a=ACTS[i]; if(a==='PASTE'&&!clip) say('COPY A JOURNEY FIRST'); else mode=mode===a?null:a; } });
  },true);

  const _update=window.update;
  window.update=function(){
    if(_gameState==='slots'){ slotsTick(); return; }
    return _update.apply(this,arguments);
  };
  const _draw=window.draw;
  window.draw=function(){
    if(_gameState==='slots'){ ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over'; drawSlots(); return; }
    _draw.apply(this,arguments);
    drawSaved();
  };

  window.MV_SLOTS={slots:()=>slots, active:()=>active, setActive:i=>{ active=i; }, load:loadJourney, save:savePoint, any};
})();
