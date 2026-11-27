/* ============================================================
   mv2_brother_ask.js — the "brother at home" window (Paulo, Nov 26):
   "If we enter a solo game, with no companion, and encounter our brother in
   our house then punch them, a window opens for us to decide if they want to
   have the brother join us (still single player, but with the AI companion),
   and if they want to add P2, and if it will be an online session. Then the
   game reacts accordingly."

   SOLO run, the house brother (beta_sibling.js npc) takes a punch ->
     BROTHER JOINS  -> AI companion from here on (MV_SIBLING.on)
     ADD PLAYER 2   -> local co-op from here on; P2 steps in where he stood
                       (controls picker first when controls_setup.js is there)
     PLAY ONLINE    -> the host / join room screen (mv2_net_ui.js); your
                       friend drops into this stage as your brother
     NOT NOW        -> back to the run (asks again after a while)
   The run keeps its progress: nothing reloads.
   ============================================================ */
(function(){
  'use strict';
  var panel=null, sel=0, prevHit=false, quietUntil=0, pausedByUs=false, prev={};
  var OPTS=[
    {k:'ai',  t:'BROTHER JOINS', s:'He rides with you (computer brother). Still one player.'},
    {k:'p2',  t:'ADD PLAYER 2',  s:'A second player takes him, on this screen.'},
    {k:'net', t:'PLAY ONLINE',   s:'A friend plays him from their own PC, Steam or phone.'},
    {k:'no',  t:'NOT NOW',       s:'He stays home.'}
  ];

  function solo(){
    try{
      return _gameState==='game'&&!_paused&&_playerCount===1&&window.MV_SIBLING&&!MV_SIBLING.on&&
             !(window.MV_NET&&MV_NET.isLinked())&&!(window.MV_BETA&&(MV_BETA.trans||MV_BETA.results||MV_BETA.loading));
    }catch(e){ return false; }
  }
  function npc(){ try{ return window.MV_SIBLING&&MV_SIBLING.npc?MV_SIBLING.npc():null; }catch(e){ return null; } }

  function build(){
    var st=document.createElement('style'); st.textContent=
      '#mvBroAsk{display:none;position:fixed;inset:0;z-index:99990;background:rgba(4,8,6,.72);align-items:center;justify-content:center;padding:12px;font:14px/1.45 ui-monospace,Consolas,monospace;color:#e8ffe0;}'+
      '#mvBroAsk .box{width:min(620px,96vw);background:#0c1610;border:2px solid #b8f5a0;border-radius:14px;padding:18px;text-align:center;box-shadow:0 8px 40px #000;}'+
      '#mvBroAsk h2{margin:0 0 4px;color:#f2ffe8;letter-spacing:.1em;font-size:22px;}'+
      '#mvBroAsk .sub{color:#a8c8a0;font-size:12px;margin:0 0 12px;}'+
      '#mvBroAsk button{display:block;width:100%;margin:8px 0;text-align:left;font:inherit;padding:10px 14px;border-radius:10px;background:#0c1812;color:#d8ffc8;border:2px solid #3a5a48;cursor:pointer;}'+
      '#mvBroAsk button b{font-size:17px;letter-spacing:.06em;display:block;color:#fff;}'+
      '#mvBroAsk button small{color:#9aab9c;}'+
      '#mvBroAsk button.on{background:#1c3a28;border-color:#b8f5a0;}'+
      '#mvBroAsk .hint{color:#7d9a80;font-size:11px;margin-top:6px;}';
    document.head.appendChild(st);
    panel=document.createElement('div'); panel.id='mvBroAsk';
    var h='<div class="box"><h2>YOUR BROTHER</h2><p class="sub">You found him at home. What now?</p>';
    OPTS.forEach(function(o,i){ h+='<button type="button" data-i="'+i+'"><b>'+o.t+'</b><small>'+o.s+'</small></button>'; });
    h+='<div class="hint" id="mvBroHint"></div></div>';
    panel.innerHTML=h;
    document.body.appendChild(panel);
    window.addEventListener('click',function(e){
      if(!isOpen()||!(e.target&&e.target.closest&&e.target.closest('#mvBroAsk'))) return;
      e.stopPropagation();
      var b=e.target.closest('button'); if(b) pick(+b.getAttribute('data-i'));
    },true);
    ['touchstart','touchend','mousedown','pointerup'].forEach(function(t){ window.addEventListener(t,function(e){ if(isOpen()&&e.target&&e.target.closest&&e.target.closest('#mvBroAsk')) e.stopPropagation(); },{capture:true,passive:true}); });
    window.addEventListener('keydown',function(e){
      if(!isOpen()) return;
      var c=e.code;
      if(c==='ArrowUp'||c==='KeyW') mark(sel-1);
      else if(c==='ArrowDown'||c==='KeyS') mark(sel+1);
      else if(c==='Enter'||c==='Space') pick(sel);
      else if(c==='Escape') pick(3);
      e.preventDefault(); e.stopImmediatePropagation();
    },true);
  }
  function mark(i){
    sel=(i+OPTS.length)%OPTS.length;
    var bs=panel.getElementsByTagName('button');
    for(var j=0;j<bs.length;j++) bs[j].className=j===sel?'on':'';
    try{ sfx('menu'); }catch(e){}
  }
  function isOpen(){ return !!(panel&&panel.style.display!=='none'); }
  function open(){
    if(!panel) build();
    panel.style.display='flex'; mark(0);
    var dev=''; try{ dev=_uiDev; }catch(e){}
    document.getElementById('mvBroHint').textContent=dev==='touch'?'TAP ONE':(dev==='pad'?'UP / DOWN  ·  A PICK  ·  B NOT NOW':'UP / DOWN  ·  ENTER PICK  ·  ESC NOT NOW');
    try{ if(!_paused){ _paused=true; pausedByUs=true; } }catch(e){}
  }
  function close(){
    if(panel) panel.style.display='none';
    try{ if(pausedByUs){ _paused=false; } }catch(e){}
    pausedByUs=false;
  }
  function otherHero(){ try{ return p&&p.hero==='venture'?'mind':'venture'; }catch(e){ return 'venture'; } }
  function pick(i){
    var k=OPTS[i]&&OPTS[i].k, n=npc();
    close();
    if(k==='no'||!k){ quietUntil=Date.now()+45000; return; }
    if(k==='ai'){
      try{ MV_SIBLING.on=true; _playModeIdx=1; }catch(e){}
      try{ if(typeof uiShowToast==='function') uiShowToast(otherHero().toUpperCase()+' RIDES WITH YOU'); }catch(e){}
      return;
    }
    if(k==='p2'){
      try{
        MV_SIBLING.on=false; _playerCount=2; _playModeIdx=2; _p2HeroChoice=otherHero();
        var q=mkP(); q.hero=_p2HeroChoice; q._aiCompanion=false; q.item=-1; q.xlrOn=false; q.magOn=false;
        q.x=n?n.x:p.x+48; q.y=n?n.y:p.y; q.vx=0; q.vy=0; q.og=true; q.hp=q.maxHp; q.fc=n?!!n.fc:!p.fc;
        p2=q;
        if(typeof uiShowToast==='function') uiShowToast('PLAYER 2 JOINS');
        if(window.MV_CONTROLS&&typeof MV_CONTROLS.open==='function') MV_CONTROLS.open();
      }catch(e){ console.error('add P2',e); }
      return;
    }
    if(k==='net'){
      try{ _playModeIdx=3; }catch(e){}
      if(window.MV_NET_UI) MV_NET_UI.open(); else if(typeof uiShowToast==='function') uiShowToast('ONLINE PLAY DID NOT LOAD');
      quietUntil=Date.now()+20000;
    }
  }

  // watch for YOUR punch landing on the house brother (beta_sibling sets npc._pHit)
  setInterval(function(){
    if(isOpen()){
      // pad: up/down, A pick, B not now
      try{
        var gp=null, ps=navigator.getGamepads?navigator.getGamepads():[]; for(var i=0;i<ps.length;i++) if(ps[i]&&ps[i].connected){ gp=ps[i]; break; }
        if(gp){
          var b=function(x){ return !!(gp.buttons[x]&&gp.buttons[x].pressed); }, ay=gp.axes[1]||0;
          var now={u:b(12)||ay<-0.5,d:b(13)||ay>0.5,a:b(0),b:b(1)};
          if(now.u&&!prev.u) mark(sel-1); if(now.d&&!prev.d) mark(sel+1);
          if(now.a&&!prev.a) pick(sel); else if(now.b&&!prev.b) pick(3);
          prev=now;
        }
      }catch(e){}
      return;
    }
    var n=npc(), hit=!!(n&&n._pHit===true);
    if(hit&&!prevHit&&solo()&&Date.now()>quietUntil) open();
    prevHit=hit;
  },33);

  window.MV_BROTHER_ASK={open:open, close:close, isOpen:isOpen, pick:pick};
})();
