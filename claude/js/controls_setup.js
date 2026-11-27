// ============================================================
//  Mind & Venture — controls_setup.js (build 416, Paulo Nov 26 2026)
//  2P LOCAL: each player picks a control setup, LEFT KEYBOARD, RIGHT KEYBOARD or a pad,
//  and two players can never hold the same one. Opens by itself the first time a 2P local
//  game starts in a session, and from Options > CONTROLS (2P only) to swap mid-game.
//  The routing itself lives in player.js (MV_CTRL, _routeKeys, readGamepad).
//  Works with keyboard, any pad and touch. Saved in localStorage 'mv2.ctrl'.
// ============================================================
(function(){
  'use strict';
  if(window.MV_CONTROLS) return;
  let box=null, rows=[], sel=0, open=false, then=null, pausedByUs=false, shownThisSession=false;
  const prevPad={};
  const NAME={L:'LEFT KEYBOARD', R:'RIGHT KEYBOARD'};
  const HINT={L:'W A S D + SPACE, N, V, B', R:'ARROWS + NUM 0, ENTER, 2, 3'};
  function C(){ return window.MV_CTRL||{p1:'L',p2:'R'}; }
  function padList(){
    const out=[]; try{ const ps=navigator.getGamepads?navigator.getGamepads():[]; for(let i=0;i<ps.length;i++){ const g=ps[i]; if(g&&g.connected) out.push(g); } }catch(e){}
    return out;
  }
  function setups(){ return ['L','R'].concat(padList().map(g=>'pad'+g.index)); }
  function label(s){ if(NAME[s]) return NAME[s]; const n=+String(s).slice(3); return 'PAD '+(n+1); }
  function hint(s){ if(HINT[s]) return HINT[s]; const g=padList().find(p=>'pad'+p.index===s); return g?String(g.id||'').replace(/\(.*$/,'').trim().slice(0,34)||'CONTROLLER':'NOT CONNECTED'; }
  function cycle(pl,dir){
    const c=C(), list=setups(), other=pl===1?c.p2:c.p1, cur=pl===1?c.p1:c.p2;
    let i=list.indexOf(cur); if(i<0) i=0;
    for(let k=0;k<list.length;k++){ i=(i+dir+list.length)%list.length; if(list[i]!==other) break; }
    if(list[i]===other) return;
    if(pl===1) c.p1=list[i]; else c.p2=list[i];
    changed();
  }
  function swap(){ const c=C(), t=c.p1; c.p1=c.p2; c.p2=t; changed(); }
  function changed(){
    try{ if(window._ctrlSave) _ctrlSave(); }catch(e){}
    try{ if(typeof sfx==='function') sfx('menu'); }catch(e){}
    render();
  }
  function ensure(){
    if(box) return;
    box=document.createElement('div');
    box.setAttribute('role','dialog'); box.setAttribute('aria-label','Controls');
    box.style.cssText='position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;background:rgba(14,12,20,.72);font:700 18px/1.25 system-ui,sans-serif;color:#EFE6D2;touch-action:manipulation';
    box.innerHTML='<div style="width:min(620px,94vw);padding:22px 20px 18px;background:#1C1A19;border:2px solid #C9A24A;border-radius:16px;box-shadow:0 16px 50px rgba(0,0,0,.6)">'+
      '<div style="text-align:center;letter-spacing:.12em;color:#C9A24A;font-size:24px;margin-bottom:4px">CONTROLS</div>'+
      '<div style="text-align:center;color:#B9B3A8;font-size:13px;font-weight:600;margin-bottom:14px">EACH PLAYER PICKS A SETUP &mdash; NO TWO THE SAME</div>'+
      '<div data-rows></div>'+
      '<div data-help style="text-align:center;color:#8C8580;font-size:12px;font-weight:600;margin-top:12px"></div></div>';
    box.addEventListener('click',e=>{
      const b=e.target.closest('[data-act]'); if(!b) return; e.preventDefault(); e.stopPropagation();
      const [act,arg]=b.dataset.act.split(':');
      if(act==='l') cycle(+arg,-1); else if(act==='r') cycle(+arg,1); else if(act==='swap') swap(); else if(act==='done') close();
    });
    document.body.appendChild(box);
    box.hidden=true;
  }
  function render(){
    if(!box) return;
    const c=C();
    rows=[{k:'p',pl:1},{k:'p',pl:2},{k:'swap'},{k:'done'}];
    if(sel>=rows.length) sel=rows.length-1;
    const btn='all:unset;cursor:pointer;padding:6px 14px;border-radius:10px;border:1px solid #8C8580;color:#EFE6D2;font-size:20px';
    box.querySelector('[data-rows]').innerHTML=rows.map((r,i)=>{
      const on=i===sel, frame='display:flex;align-items:center;gap:10px;margin:6px 0;padding:10px 12px;border-radius:12px;border:2px solid '+(on?'#C9A24A':'#3a3530')+';background:'+(on?'#2a2418':'transparent');
      if(r.k==='p'){ const s=r.pl===1?c.p1:c.p2, col=r.pl===1?'#b48cff':'#ff7a6a';
        return '<div style="'+frame+'"><span style="width:58px;color:'+col+'">P'+r.pl+'</span>'+
          '<button type="button" data-act="l:'+r.pl+'" style="'+btn+'" aria-label="previous">&lsaquo;</button>'+
          '<span style="flex:1;text-align:center"><span style="display:block">'+label(s)+'</span><span style="display:block;color:#8C8580;font-size:12px;font-weight:600">'+hint(s)+'</span></span>'+
          '<button type="button" data-act="r:'+r.pl+'" style="'+btn+'" aria-label="next">&rsaquo;</button></div>'; }
      if(r.k==='swap') return '<div data-act="swap" style="'+frame+';justify-content:center;cursor:pointer">SWAP P1 &harr; P2</div>';
      return '<div data-act="done" style="'+frame+';justify-content:center;cursor:pointer;color:#C9A24A">DONE</div>';
    }).join('');
    box.querySelector('[data-help]').textContent='UP / DOWN PICK  ·  LEFT / RIGHT CHANGE  ·  ENTER, A OR TAP OK  ·  ESC OR B DONE';
  }
  function act(dir){
    const r=rows[sel]; if(!r) return;
    if(r.k==='p'&&dir) cycle(r.pl,dir);
    else if(r.k==='swap'&&dir===0) swap();
    else if(r.k==='done'&&dir===0) close();
  }
  function move(d){ sel=(sel+d+rows.length)%rows.length; try{ if(typeof sfx==='function') sfx('menu'); }catch(e){} render(); }
  function clearHeld(){
    try{ for(const k in K) delete K[k]; for(const k in Kj) delete Kj[k]; for(const k in K2) delete K2[k]; for(const k in Kj2) delete Kj2[k]; for(const k in KB1) delete KB1[k]; for(const k in KB2) delete KB2[k]; }catch(e){}
    try{ for(const k in KPHYS) delete KPHYS[k]; }catch(e){}   // keys released while we held the keyboard never reached player.js
  }
  function openUi(opts){
    ensure(); opts=opts||{};
    then=typeof opts.then==='function'?opts.then:null;
    sel=0; open=true; shownThisSession=true;
    try{ if(typeof _gameState!=='undefined'&&_gameState==='game'&&typeof _paused!=='undefined'&&!_paused){ _paused=true; pausedByUs=true; } }catch(e){}
    for(const g of padList()) prevPad[g.index]=snap(g);    // a held button that opened us is not a fresh press
    render(); box.hidden=false; loop();
  }
  function close(){
    if(!open) return;
    open=false; if(box) box.hidden=true;
    clearHeld();
    try{ if(window._routeKeys) _routeKeys(); }catch(e){}
    try{ if(pausedByUs&&typeof _paused!=='undefined') _paused=false; }catch(e){}
    pausedByUs=false;
    try{ if(typeof sfx==='function') sfx('confirm'); }catch(e){}
    const f=then; then=null; if(f) try{ f(); }catch(e){ console.warn('MV controls',e); }
  }
  // keyboard: capture phase, so the game and the menus underneath never see these keys
  window.addEventListener('keydown',e=>{
    if(!open) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if(e.repeat) return;
    const c=e.code;
    if(c==='ArrowUp'||c==='KeyW') move(-1);
    else if(c==='ArrowDown'||c==='KeyS') move(1);
    else if(c==='ArrowLeft'||c==='KeyA') act(-1);
    else if(c==='ArrowRight'||c==='KeyD') act(1);
    else if(c==='Enter'||c==='NumpadEnter'||c==='Space'||c==='Numpad0') act(0);
    else if(c==='Escape'||c==='Backspace') close();
  },true);
  window.addEventListener('keyup',e=>{ if(open){ e.stopImmediatePropagation(); } },true);
  // pads: any pad moves the cursor (d-pad or stick), A picks, B or START closes
  function snap(g){ const b=i=>!!(g.buttons&&g.buttons[i]&&g.buttons[i].pressed); const ax=(g.axes&&g.axes[0])||0, ay=(g.axes&&g.axes[1])||0;
    return {a:b(0),b:b(1),st:b(9),u:b(12)||ay<-0.6,d:b(13)||ay>0.6,l:b(14)||ax<-0.6,r:b(15)||ax>0.6}; }
  function loop(){
    if(!open) return;
    for(const g of padList()){
      const n=snap(g), p=prevPad[g.index]||{};
      if(n.u&&!p.u) move(-1); if(n.d&&!p.d) move(1);
      if(n.l&&!p.l) act(-1); if(n.r&&!p.r) act(1);
      if(n.a&&!p.a) act(0);
      if((n.b&&!p.b)||(n.st&&!p.st)) close();
      prevPad[g.index]=n;
    }
    requestAnimationFrame(loop);
  }
  // The first 2P local game of a session opens the picker before play.
  let was2P=false;
  function watch(){
    try{
      const now=typeof _playerCount!=='undefined'&&_playerCount===2&&typeof _gameState!=='undefined'&&_gameState==='game'&&!(window.MV_NET&&typeof MV_NET.isLinked==='function'&&MV_NET.isLinked());
      if(now&&!was2P&&!shownThisSession&&!open) openUi();
      was2P=now;
    }catch(e){}
    setTimeout(watch,250);
  }
  watch();
  window.MV_CONTROLS={ open:openUi, close, isOpen:()=>open, label, setups };
})();
