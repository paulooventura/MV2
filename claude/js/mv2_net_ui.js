/* ============================================================
   mv2_net_ui.js — 2P ONLINE screens (Jackbox-style room codes).

   2P ONLINE card -> this panel:
     HOST A ROOM -> big 4-letter code + join link + QR -> friend joins ->
                    pick your hero -> play (friend drops in as the other brother)
     JOIN A ROOM -> type the 4 letters (or open ?join=CODE / scan the QR) ->
                    "waiting for the host" -> you land in the host's stage
   Proximity voice row (OFF / OPEN MIC / PUSH-TO-TALK), off by default.
   In a stage: a small ONLINE chip (top-right) shows room, ping and voice;
   click / tap it to switch voice mode.

   Pad: D-pad / stick moves between buttons, A presses, B closes. On the join
   code: up / down changes the letter, left / right moves along the code.
   ============================================================ */
(function(){
  'use strict';
  if(!window.MV_NET) return;
  var NET=window.MV_NET, VOICE=function(){ return window.MV_VOICE||null; };
  var panel=null, el={}, view='menu', onDone=null, chip=null;

  function css(){
    if(document.getElementById('mvNetCss')) return;
    var s=document.createElement('style');
    s.id='mvNetCss';
    s.textContent=
      '#mvNetPanel{display:none;position:fixed;inset:0;z-index:100000;color:#EFE6D2;'+
        'background:#1E1B27;background-image:repeating-linear-gradient(0deg,rgba(0,0,0,.16) 0 1px,transparent 1px 3px);'+
        'font:18px/1.35 "MV Pixel",ui-monospace,Consolas,monospace;align-items:center;justify-content:center;padding:16px;}'+
      '#mvNetPanel .box{width:min(640px,94vw);max-height:92vh;overflow:auto;text-align:center;'+
        'background:linear-gradient(#1E1B27,#1C1A19);border:2px solid #C9A24A;border-radius:0;'+
        'box-shadow:5px 6px 0 rgba(0,0,0,.55),inset 0 0 0 1px rgba(0,0,0,.7);padding:22px 18px 16px;}'+
      '#mvNetPanel h2{margin:0 0 6px;font-size:28px;font-weight:400;color:#C9A24A;letter-spacing:.16em;}'+
      '#mvNetPanel .sub{color:#B9B3A8;font-size:16px;margin:0 0 14px;}'+
      '#mvNetPanel .row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:10px 0;}'+
      '#mvNetPanel button{font:inherit;letter-spacing:.08em;min-height:44px;padding:8px 16px;border-radius:0;'+
        'background:#1C1A19;color:#EFE6D2;border:2px solid #8C8580;cursor:pointer;}'+
      '#mvNetPanel button.big{min-width:200px;min-height:58px;font-size:20px;}'+
      '#mvNetPanel button.on{background:#38281a;border-color:#C9A24A;color:#E6CFAB;}'+
      '#mvNetPanel button:focus,#mvNetPanel button.pf{outline:none;border-color:#C9A24A;box-shadow:inset 0 0 0 1px #C9A24A;}'+
      '#mvNetPanel button:disabled{opacity:.4;cursor:default;}'+
      '#mvNetPanel .code{font-size:clamp(40px,10vw,72px);letter-spacing:.28em;color:#C9A24A;margin:6px 0 2px;padding-left:.28em;}'+
      '#mvNetPanel .link{color:#E6CFAB;font-size:14px;word-break:break-all;user-select:all;}'+
      '#mvNetPanel canvas#mvNetQr{position:static!important;display:inline-block;width:148px!important;height:148px!important;max-width:40vw;max-height:40vw;'+
        'background:#EFE6D2;border:2px solid #8C8580;border-radius:0;padding:6px;margin-top:8px;image-rendering:pixelated;transform:none!important;}'+
      '#mvNetCode{font:clamp(36px,9vw,64px) "MV Pixel",ui-monospace,Consolas,monospace;width:5.4em;text-align:center;letter-spacing:.28em;'+
        'padding:4px 0 4px .28em;text-transform:uppercase;background:#1C1A19;color:#C9A24A;border:2px solid #C9A24A;border-radius:0;}'+
      '#mvNetStatus{margin:14px auto 0;max-width:540px;padding:8px 10px;border-left:3px solid #C9A24A;background:#14121c;color:#EFE6D2;font-size:16px;text-align:left;}'+
      '#mvNetPanel .voice{margin-top:16px;padding-top:12px;border-top:1px solid #8C8580;}'+
      '#mvNetPanel .tiny{color:#8C8580;font-size:14px;margin-top:8px;}'+
      '#mvNetChip{position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);right:10px;z-index:9000;display:none;'+
        'font:16px "MV Pixel",ui-monospace,Consolas,monospace;color:#EFE6D2;background:#1C1A19;border:2px solid #C9A24A;'+
        'border-radius:0;padding:4px 10px;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:manipulation;}'+
      '#mvNetChip .mic{display:inline-block;width:8px;height:8px;border-radius:0;background:#8C8580;margin-left:6px;vertical-align:middle;}'+
      '#mvNetChip .mic.live{background:#C9A24A;}'+
      '#mvNetChip .mic.hear{background:#E6CFAB;}';
    document.head.appendChild(s);
  }

  function build(){
    css();
    panel=document.createElement('div');
    panel.id='mvNetPanel';
    panel.innerHTML=
      '<div class="box">'+
        '<h2>2P ONLINE</h2>'+
        '<p class="sub">Play with a friend on another PC, Steam or phone. No account, no names. A link puts you in their room, and you share a stage once you are both in it.</p>'+

        '<div id="mvNetMenu">'+
          '<div class="row">'+
            '<button type="button" class="big" id="mvNetHostBtn">HOST A ROOM</button>'+
            '<button type="button" class="big" id="mvNetJoinBtn">JOIN A ROOM</button>'+
          '</div>'+
        '</div>'+

        '<div id="mvNetHostV" style="display:none">'+
          '<div class="sub" style="margin:0">ROOM CODE — tell your friend</div>'+
          '<div class="code" id="mvNetHostCode">····</div>'+
          '<div class="link" id="mvNetLink"></div>'+
          '<canvas id="mvNetQr" width="148" height="148"></canvas>'+
        '</div>'+

        '<div id="mvNetJoinV" style="display:none">'+
          '<div class="sub" style="margin:0">Type the 4-letter ROOM CODE</div>'+
          '<div class="row"><input id="mvNetCode" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text"></div>'+
          '<div class="row"><button type="button" id="mvNetGo" class="big">JOIN</button></div>'+
        '</div>'+

        '<div id="mvNetStatus">Pick HOST or JOIN.</div>'+

        '<div class="voice">'+
          '<div>PROXIMITY VOICE <span class="tiny">— louder when your heroes are close</span></div>'+
          '<div class="row" id="mvNetVoice">'+
            '<button type="button" data-v="off">OFF</button>'+
            '<button type="button" data-v="open">OPEN MIC</button>'+
            '<button type="button" data-v="ptt">PUSH-TO-TALK</button>'+
          '</div>'+
          '<div class="tiny" id="mvNetVoiceHint">Off until you turn it on. Push-to-talk: hold T (pad: R-stick click). Open mic: T mutes.</div>'+
        '</div>'+

        '<div class="row" style="margin-top:16px">'+
          '<button type="button" id="mvNetDone" disabled>PICK YOUR HERO</button>'+
          '<button type="button" id="mvNetBack">BACK</button>'+
        '</div>'+
        '<div class="tiny">Online uses a direct player-to-player link; your friend\'s game can see your internet address, like any P2P game.</div>'+
      '</div>';
    document.body.appendChild(panel);
    ['Menu','HostV','JoinV','HostCode','Link','Qr','Code','Go','Status','Done','Back','Voice','VoiceHint','HostBtn','JoinBtn'].forEach(function(k){
      el[k]=document.getElementById('mvNet'+k);
    });
    el.HostBtn.onclick=startHost;
    el.JoinBtn.onclick=function(){ setView('join'); setTimeout(function(){ try{ el.Code.focus(); }catch(e){} },30); };
    el.Go.onclick=function(){ startJoin(el.Code.value); };
    el.Code.addEventListener('input',function(){
      var v=NET.normCode(el.Code.value); if(v!==el.Code.value) el.Code.value=v;
      if(v.length===NET.CODE_LEN) startJoin(v);
    });
    el.Code.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); startJoin(el.Code.value); } });
    el.Back.onclick=back;
    el.Done.onclick=function(){ if(NET.isLinked()&&NET.role()==='host') finishHost(); };
    NET.onStatus(render);
    if(VOICE()) VOICE().onChange(renderVoice);
    render(NET.status()); renderVoice();
  }

  function setView(v){
    view=v;
    if(!panel) return;
    el.Menu.style.display=v==='menu'?'':'none';
    el.HostV.style.display=v==='host'?'':'none';
    el.JoinV.style.display=v==='join'?'':'none';
    el.Done.style.display=v==='host'?'':'none';
    el.Back.textContent=v==='menu'?'CLOSE':'BACK';
    if(v==='menu') el.Status.textContent='Pick HOST or JOIN.';
    padFocus(0);
  }
  function startHost(){
    setView('host');
    el.HostCode.textContent='····'; el.Link.textContent=''; qr('');
    NET.host().then(function(r){
      el.HostCode.textContent=r.code;
      var link=NET.joinLink(r.code);
      el.Link.textContent=link; qr(link);
    }).catch(function(){});
  }
  function startJoin(code){
    var c=NET.normCode(code);
    if(c.length!==NET.CODE_LEN){ el.Status.textContent='Room codes have '+NET.CODE_LEN+' letters.'; return; }
    if(NET.role()==='joiner'&&NET.code()===c&&/joining|connected/.test(NET.status().status)) return;
    try{ if(typeof _unlockAudio==='function') _unlockAudio(); }catch(e){}
    NET.join(c).catch(function(){});
  }
  function qr(text){
    var cv=el.Qr; if(!cv) return;
    var g=cv.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,cv.width,cv.height);
    cv.style.display=text?'':'none';
    if(!text||typeof window.qrcode!=='function') return;
    try{
      var q=window.qrcode(0,'M'); q.addData(text); q.make();
      var n=q.getModuleCount(), sz=Math.floor(cv.width/(n+2)), off=Math.floor((cv.width-sz*n)/2);
      g.fillStyle='#000';
      for(var r=0;r<n;r++) for(var c=0;c<n;c++) if(q.isDark(r,c)) g.fillRect(off+c*sz,off+r*sz,sz,sz);
    }catch(e){ cv.style.display='none'; }
  }
  function render(s){
    if(panel){
      var txt=s.detail||String(s.status||'').toUpperCase();
      if(s.phase==='timeline') txt='In the same stage.';
      else if(s.phase==='entering') txt=s.role==='host'?'Your friend is entering the stage.':'Entering the stage.';
      else if(s.phase==='room'&&s.linked) txt=s.role==='host'?'In the room. Pick your hero and the stage opens for both.':'In the room. Waiting for the host to start.';
      if(s.linked&&s.ping) txt+='  ·  ping '+s.ping+' ms';
      if(view!=='menu'||s.status!=='offline') el.Status.textContent=txt;
      el.Status.style.color=s.linked?'#C9A24A':(/error|closed/.test(s.status)?'#d85868':'#EFE6D2');
      el.Done.disabled=!(s.linked&&s.role==='host');
    }
    renderChip();
  }
  function renderVoice(){
    var v=VOICE(); if(!panel||!v) { renderChip(); return; }
    var m=v.mode(), bs=el.Voice.getElementsByTagName('button');
    for(var i=0;i<bs.length;i++) bs[i].className=bs[i].getAttribute('data-v')===m?'on':'';
    var st=v.state();
    el.VoiceHint.textContent=st.err?st.err:
      (m==='off'?'Off until you turn it on. Push-to-talk: hold T (pad: R-stick click). Open mic: T mutes.':
       m==='open'?(st.muted?'Mic MUTED — press T (pad: R-stick click) to talk again.':'Mic is ON. T (pad: R-stick click) mutes.'):
       'Hold T (pad: R-stick click) to talk.');
    renderChip();
  }

  // ---- in-stage chip --------------------------------------------------------
  function buildChip(){
    css();
    chip=document.createElement('div'); chip.id='mvNetChip';
    chip.title='Online co-op. Click: voice OFF / OPEN MIC / PUSH-TO-TALK';
    document.body.appendChild(chip);
  }
  function renderChip(){
    if(!chip) buildChip();
    var s=NET.status(), live=false;
    try{ live=s.linked&&_gameState==='game'; }catch(e){}
    chip.style.display=live?'block':'none';
    if(!live) return;
    var v=VOICE(), m=v?v.mode():'off', vs=v?v.state():{};
    var vt=m==='off'?'VOICE OFF':(m==='open'?(vs.muted?'MIC MUTED':'OPEN MIC'):(vs.ptt?'TALKING':'HOLD T'));
    var tag=s.phase==='timeline'?'TOGETHER':(s.phase==='entering'?'ENTERING':'IN THE ROOM');
    chip.innerHTML=tag+' '+(s.code||'')+(s.ping?' · '+s.ping+'ms':'')+' · '+vt+'<span class="mic" id="mvNetMicDot"></span>';
  }
  setInterval(function(){
    renderChip();
    var dot=document.getElementById('mvNetMicDot'), v=VOICE();
    if(dot&&v){
      var me=v.talking()&&v.level()>0.02, them=v.mode()!=='off'&&v.remoteLevel()*v.gain()>0.01;
      dot.className='mic'+(me?' live':(them?' hear':''));
    }
  },200);

  // ---- open / close -----------------------------------------------------------
  function show(cb){
    onDone=typeof cb==='function'?cb:null;
    if(!panel) build();
    panel.style.display='flex';
    if(NET.isLinked()) setView(NET.role()==='host'?'host':'join'); else setView('menu');
    render(NET.status()); renderVoice();
  }
  function hide(){ if(panel) panel.style.display='none'; }
  function isOpen(){ return !!(panel&&panel.style.display!=='none'); }
  function finishHost(){
    var cb=onDone; onDone=null; hide();
    try{
      _playerCount=1; _playModeIdx=3; _selectStep=1;
      if(window.MV_SIBLING) MV_SIBLING.on=false;
    }catch(e){}
    if(typeof cb==='function'){ try{ cb(); }catch(e){} }
  }
  function back(){
    if(view!=='menu'){ NET.disconnect(); setView('menu'); return; }
    hide(); onDone=null;
    try{ if(!NET.isLinked()&&typeof _playModeIdx!=='undefined'&&_playModeIdx===3) _playModeIdx=0; }catch(e){}
  }
  NET.onStatus(function(s){
    if(s.status==='connected'&&s.role==='host'&&isOpen()) setTimeout(function(){ if(isOpen()&&NET.isLinked()) finishHost(); },1400);
  });

  // ---- menu integration (wrappers; ui.js keeps its own flow) -----------------
  var realStart=window.startGame;
  if(typeof realStart==='function'){
    window.startGame=function(){
      try{
        if(isOpen()) return;
        if(_gameState==='select'&&_selectStep===0&&_playModeIdx===3){
          if(NET.isLinked()&&NET.role()==='host'){ finishHost(); return; }
          show(null);
          return;
        }
      }catch(e){}
      return realStart.apply(this,arguments);
    };
  }
  var realGate=window.MV_SELECT_GATE;
  window.MV_SELECT_GATE=function(){
    try{ if(NET.isLinked()) return false; }catch(e){}
    return typeof realGate==='function'?realGate.apply(this,arguments):false;
  };
  var realNav=window.MV_SELECT_NAV;
  window.MV_SELECT_NAV=function(){
    if(isOpen()) return true;
    return typeof realNav==='function'?realNav.apply(this,arguments):false;
  };
  // While the panel is open, keys belong to it (typing the code), not the game.
  window.addEventListener('keydown',function(e){
    if(!isOpen()) return;
    if(e.code==='Escape'){ e.preventDefault(); back(); }
    else if(e.key==='Enter'&&e.target&&e.target.tagName==='BUTTON'){ /* native click */ }
    e.stopImmediatePropagation();
  },true);

  // Clicks / taps on the panel and the chip: the game's own document-level capture
  // handlers (boot splash skip, title click, select taps) would eat them, so take
  // them at the window capture phase, before any of those, and act here.
  function ours(t){ return t&&t.closest?t.closest('#mvNetPanel,#mvNetChip'):null; }
  window.addEventListener('click',function(e){
    var root=ours(e.target); if(!root) return;
    e.stopPropagation();
    if(root.id==='mvNetChip'){ e.preventDefault(); if(VOICE()) VOICE().cycle(); return; }
    var btn=e.target.closest('button');
    if(!btn||btn.disabled) return;
    var v=btn.getAttribute('data-v');
    if(v){ if(VOICE()) VOICE().setMode(v); return; }
    if(typeof btn.onclick==='function') btn.onclick.call(btn,e);
  },true);
  ['touchstart','touchend','mousedown','pointerup'].forEach(function(t){
    window.addEventListener(t,function(e){ if(ours(e.target)) e.stopPropagation(); },{capture:true,passive:true});
  });

  // ---- pad navigation inside the panel ----------------------------------------
  var pf=0, padPrev={}, padRep=0;
  function focusables(){
    if(!panel) return [];
    return Array.prototype.filter.call(panel.querySelectorAll('button,#mvNetCode'),function(b){ return b.offsetParent!==null&&!b.disabled; });
  }
  function padFocus(i){
    var f=focusables(); if(!f.length) return;
    pf=(i+f.length)%f.length;
    f.forEach(function(b){ b.classList.remove('pf'); });
    f[pf].classList.add('pf');
  }
  function letterStep(d){
    var v=NET.normCode(el.Code.value).split(''), A='ABCDEFGHJKLMNPQRSTUVWXYZ';
    var at=Math.min(v.length,NET.CODE_LEN-1);
    if(at>=v.length) v.push('A');
    else v[at]=A.charAt((A.indexOf(v[at])+d+A.length)%A.length);
    el.Code.value=v.join('');
  }
  setInterval(function(){
    if(!isOpen()) return;
    var pads=navigator.getGamepads?navigator.getGamepads():[], gp=null;
    for(var i=0;i<pads.length;i++) if(pads[i]&&pads[i].connected){ gp=pads[i]; break; }
    if(!gp) return;
    var b=function(n){ return !!(gp.buttons[n]&&gp.buttons[n].pressed); };
    var ax=gp.axes[0]||0, ay=gp.axes[1]||0;
    var now={a:b(0),b:b(1),l:b(14)||ax<-0.5,r:b(15)||ax>0.5,u:b(12)||ay<-0.5,d:b(13)||ay>0.5};
    var edge=function(k){ return now[k]&&!padPrev[k]; };
    var f=focusables(), cur=f[pf];
    var onCode=cur&&cur.id==='mvNetCode';
    if(edge('l')) padFocus(pf-1);
    if(edge('r')) padFocus(pf+1);
    if(onCode&&edge('u')) letterStep(1);
    if(onCode&&edge('d')){ if(NET.normCode(el.Code.value).length<NET.CODE_LEN) el.Code.value=NET.normCode(el.Code.value)+'A'; else letterStep(-1); }
    if(!onCode&&(edge('u')||edge('d'))) padFocus(pf+(now.d?1:-1));
    if(edge('a')&&cur){ if(onCode){ var v=NET.normCode(el.Code.value); if(v.length===NET.CODE_LEN) startJoin(v); else el.Code.value=v+'A'; } else cur.click(); }
    if(edge('b')) back();
    padPrev=now;
  },50);

  // ---- ?join=CODE links (and QR scans) ------------------------------------------
  (function(){
    var m=/[?&]join=([A-Za-z]{4})\b/.exec(location.search||'');
    if(!m) return;
    var code=NET.normCode(m[1]);
    var t0=Date.now();
    var wait=setInterval(function(){
      var ready=false;
      try{ ready=!!document.body&&typeof _gameState!=='undefined'&&!!_gameState; }catch(e){}
      if(!ready&&Date.now()-t0<20000) return;
      clearInterval(wait);
      show(null); setView('join'); el.Code.value=code;
      startJoin(code);
      try{ el.Go.focus(); }catch(e){}
      padFocus(focusables().indexOf(el.Go));
    },300);
  })();

  window.MV_NET_UI={open:show, hide:hide, close:back, isOpen:isOpen, host:startHost, join:startJoin, view:function(){ return view; }};
})();
