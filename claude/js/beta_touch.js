// ============================================================
//  beta_touch.js — phone face buttons (A B X Y) that a thumb can roll across
//
//  Every finger on the right pad is tracked on its own, all the time it is
//  down. A button is pressed while any finger's contact reaches it — so one
//  thumb resting between X (run) and A (jump) holds both, and sliding the
//  thumb from X onto A keeps running and jumps. Two fingers work too.
//  Replaces the per-button listeners from js/player.js for this pad only.
//  Xbox layout, same codes as player.js: A jump · B item select · X run + use item · Y punch.
// ============================================================
(function(){
  'use strict';
  const PAD_ID='padRight';
  const MAP={bSp:['Space'], bE:['KeyE'], bQ:['KeyQ','Sprint_t'], bF:['KeyF']};
  const touches=new Map();          // identifier -> {x,y,r}
  let held=new Set();

  function buttons(){
    const out=[];
    for(const id in MAP){
      const b=document.getElementById(id); if(!b) continue;
      const r=b.getBoundingClientRect(); if(!r.width) continue;
      out.push({id, cx:r.left+r.width/2, cy:r.top+r.height/2, R:r.width/2});
    }
    return out;
  }
  function refresh(){
    const now=new Set();
    const btns=buttons();
    for(const t of touches.values()){
      const near=[];
      for(const b of btns){
        const d=Math.hypot(t.x-b.cx,t.y-b.cy);
        if(d<=b.R*1.2+Math.min(12,t.r*0.4)) near.push({id:b.id,d});
      }
      near.sort((a,b)=>a.d-b.d);
      if(!near.length) continue;
      now.add(near[0].id);
      // one thumb between X (run / item) and A (jump) holds both. It does not also press B or Y.
      if(near[1]&&near[1].d<near[0].d+22){
        const pair=near[0].id+near[1].id;
        if(pair==='bQbSp'||pair==='bSpbQ') now.add(near[1].id);
      }
    }
    for(const id of now){
      const fresh=!held.has(id);
      for(const c of MAP[id]){ if(fresh&&!K[c]) Kj[c]=true; K[c]=true; }
    }
    for(const id of held) if(!now.has(id)) for(const c of MAP[id]) K[c]=false;
    for(const id in MAP){ const b=document.getElementById(id); if(b) b.classList.toggle('held',now.has(id)); }
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
