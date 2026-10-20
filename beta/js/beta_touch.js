// ============================================================
//  beta_touch.js — phone face buttons (A B X Y) that a thumb can roll across
//
//  Every finger on the right pad is tracked on its own, all the time it is
//  down. A button is pressed while any finger's contact reaches it — so one
//  thumb resting between X (run) and A (jump) holds both, and sliding the
//  thumb from X onto A keeps running and jumps. Two fingers work too.
//  Replaces the per-button listeners from js/player.js for this pad only.
// ============================================================
(function(){
  'use strict';
  const PAD_ID='padRight';
  const map=()=>window._phonePlay
    ?{bSp:'Space',bE:'KeyF',bQ:'KeyE',bF:'KeyQ'}
    :{bSp:'Space',bE:'KeyE',bQ:'KeyQ',bF:'KeyF'};
  const touches=new Map();          // identifier -> {x,y,r}
  let held=new Set();

  function reach(b,t){
    const r=b.getBoundingClientRect(); if(!r.width) return false;
    const R=r.width/2, cx=r.left+R, cy=r.top+r.height/2;
    return Math.hypot(t.x-cx,t.y-cy)<=R*1.45+Math.min(14,t.r*0.5);   // a thumb's pad, not a pin point
  }
  function refresh(){
    const m=map(), now=new Set();
    for(const id in m){
      const b=document.getElementById(id); if(!b) continue;
      for(const t of touches.values()) if(reach(b,t)){ now.add(id); break; }
    }
    for(const id of now) if(!held.has(id)){ const c=m[id]; if(!K[c]) Kj[c]=true; K[c]=true; }
    for(const id of held) if(!now.has(id)) K[m[id]]=false;
    for(const id in m){ const b=document.getElementById(id); if(b) b.classList.toggle('held',now.has(id)); }
    held=now;
  }
  const put=t=>touches.set(t.identifier,{x:t.clientX,y:t.clientY,r:Math.max(t.radiusX||0,t.radiusY||0)});

  function boot(){
    const pad=document.getElementById(PAD_ID); if(!pad) return;
    pad.addEventListener('touchstart',e=>{
      for(const t of e.changedTouches) put(t);
      refresh();
      if(typeof _phoneEnterPlay==='function') _phoneEnterPlay();
      e.preventDefault(); e.stopPropagation();
    },{passive:false,capture:true});
    addEventListener('touchmove',e=>{
      let mine=false;
      for(const t of e.changedTouches) if(touches.has(t.identifier)){ put(t); mine=true; }
      if(mine){ refresh(); e.preventDefault(); }
    },{passive:false});
    const end=e=>{
      let mine=false;
      for(const t of e.changedTouches) if(touches.delete(t.identifier)) mine=true;
      if(mine){ refresh(); e.stopPropagation(); }
    };
    pad.addEventListener('touchend',end,{capture:true});
    pad.addEventListener('touchcancel',end,{capture:true});
    addEventListener('touchend',end); addEventListener('touchcancel',end);
    addEventListener('blur',()=>{ touches.clear(); refresh(); });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.MV_TOUCH={ touches, refresh, get held(){ return [...held]; } };
})();
