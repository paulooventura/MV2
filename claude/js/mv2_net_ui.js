/* ============================================================
   mv2_net_ui.js — copy/paste signalling panel for MV2 online co-op.

   Loaded after ui.js / ui_select.js / mv2_net.js. All markup and styles are
   created here so claude/index.html only needs two script tags.

   Flow: 2P ONLINE card -> this panel -> pick HOST (copy OFFER) or JOIN
   (paste OFFER, copy ANSWER) or LOCAL two-tab test -> connected -> the normal
   hero select -> gameplay with P2 coming from the network.
   ============================================================ */
(function(){
  'use strict';
  if(!window.MV_NET) return;
  var NET=window.MV_NET;
  var panel=null, mode='host', onDone=null;
  var el={};

  function css(){
    if(document.getElementById('mvNetCss')) return;
    var s=document.createElement('style');
    s.id='mvNetCss';
    s.textContent=
      '.mvnet-box{display:none;margin-top:12px;padding:12px;border:1px solid #2a3a55;border-radius:6px;background:#080614;}'+
      '.mvnet-box.on{display:block;}'+
      '.mvnet-label{display:block;color:#9ad4ff;font-size:12px;margin:8px 0 4px;}'+
      '.mvnet-ta{width:100%;box-sizing:border-box;min-height:74px;resize:vertical;background:#04030a;color:#cfe8ff;'+
        'border:1px solid #334;border-radius:3px;padding:8px;font:11px/1.35 ui-monospace,Consolas,monospace;}'+
      '.mvnet-btn{min-height:36px;}'+
      '#mvNetTabs button.on{background:#163852;border-color:#7ad8ff;color:#fff;}'+
      '#mvNetStatus{margin-top:12px;padding:8px 10px;border-left:3px solid #7ad8ff;background:#0a1420;color:#c8b8e8;font-size:12px;}'+
      '#mvNetPanel button:disabled{opacity:.4;cursor:default;}';
    document.head.appendChild(s);
  }

  function build(){
    css();
    panel=document.createElement('div');
    panel.id='mvNetPanel';
    panel.style.cssText='display:none;position:fixed;inset:0;z-index:100000;background:rgba(3,2,9,.94);'+
      'color:#e8e0ff;font:13px/1.55 ui-monospace,Consolas,monospace;align-items:center;justify-content:center;padding:12px;';
    panel.innerHTML=
      '<div style="width:min(760px,96vw);max-height:94vh;overflow:auto;background:#0c0a18;'+
      'border:2px solid #7ad8ff;border-radius:10px;padding:18px;box-shadow:0 8px 44px #000;">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">'+
          '<b style="font-size:20px;color:#7ad8ff;letter-spacing:.06em;">ONLINE CO-OP</b>'+
          '<button type="button" id="mvNetClose" class="mvnet-btn">CLOSE</button>'+
        '</div>'+
        '<p style="color:#a99cc6;font-size:12px;margin:8px 0 4px;">'+
          'Direct player-to-player (WebRTC). The host makes an OFFER code, the friend pastes it and sends back an ANSWER. '+
          'No account, no server of ours. NAT / strict firewalls can still block the direct link. '+
          'Use LOCAL 2-TAB only to test on one computer.'+
        '</p>'+
        '<div id="mvNetTabs" class="row" style="margin-top:10px;">'+
          '<button type="button" data-m="host" class="mvnet-btn">HOST ONLINE</button>'+
          '<button type="button" data-m="join" class="mvnet-btn">JOIN ONLINE</button>'+
          '<button type="button" data-m="local" class="mvnet-btn">LOCAL 2-TAB TEST</button>'+
        '</div>'+

        '<div id="mvNetHostBox" class="mvnet-box on">'+
          '<span class="mvnet-label">1 · Your OFFER code — copy it and send it to your friend</span>'+
          '<textarea id="mvNetOffer" class="mvnet-ta" readonly placeholder="press HOST ONLINE to create an offer"></textarea>'+
          '<div class="row" style="margin-top:6px;"><button type="button" id="mvNetCopyOffer" class="mvnet-btn">COPY OFFER</button></div>'+
          '<span class="mvnet-label">2 · Paste your friend\'s ANSWER, then CONNECT</span>'+
          '<textarea id="mvNetAnswerIn" class="mvnet-ta" placeholder="paste answer code here"></textarea>'+
          '<div class="row" style="margin-top:6px;"><button type="button" id="mvNetConnect" class="mvnet-btn">CONNECT</button></div>'+
        '</div>'+

        '<div id="mvNetJoinBox" class="mvnet-box">'+
          '<span class="mvnet-label">1 · Paste the host\'s OFFER code</span>'+
          '<textarea id="mvNetJoinOffer" class="mvnet-ta" placeholder="paste offer code here"></textarea>'+
          '<div class="row" style="margin-top:6px;"><button type="button" id="mvNetCreateAnswer" class="mvnet-btn">CREATE ANSWER</button></div>'+
          '<span class="mvnet-label">2 · Your ANSWER code — copy it and send it back to the host</span>'+
          '<textarea id="mvNetAnswerOut" class="mvnet-ta" readonly placeholder="answer code appears here"></textarea>'+
          '<div class="row" style="margin-top:6px;"><button type="button" id="mvNetCopyAnswer" class="mvnet-btn">COPY ANSWER</button></div>'+
        '</div>'+

        '<div id="mvNetLocalBox" class="mvnet-box">'+
          '<span class="mvnet-label">Room name (same name in both tabs)</span>'+
          '<input id="mvNetRoom" type="text" value="mv2" style="width:220px;padding:7px;background:#04030a;color:#cfe8ff;border:1px solid #334;">'+
          '<div class="row" style="margin-top:8px;">'+
            '<button type="button" id="mvNetLocalHost" class="mvnet-btn">HOST ROOM</button>'+
            '<button type="button" id="mvNetLocalJoin" class="mvnet-btn">JOIN ROOM</button>'+
          '</div>'+
        '</div>'+

        '<div id="mvNetStatus" style="margin-top:12px;">OFFLINE</div>'+
        '<div class="row" style="margin-top:14px;">'+
          '<button type="button" id="mvNetDone" class="mvnet-btn" disabled>CONTINUE TO HERO SELECT</button>'+
          '<button type="button" id="mvNetCancel" class="mvnet-btn">CANCEL</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(panel);

    ['Offer','AnswerIn','AnswerOut','JoinOffer','Room','Status','Done'].forEach(function(k){
      el[k]=document.getElementById('mvNet'+k);
    });
    el.HostBox=document.getElementById('mvNetHostBox');
    el.JoinBox=document.getElementById('mvNetJoinBox');
    el.LocalBox=document.getElementById('mvNetLocalBox');

    document.getElementById('mvNetTabs').addEventListener('click',function(e){
      var b=e.target&&e.target.getAttribute&&e.target.getAttribute('data-m');
      if(b) setMode(b);
    });
    document.getElementById('mvNetClose').onclick=cancel;
    document.getElementById('mvNetCancel').onclick=cancel;
    el.Done.onclick=function(){ if(NET.isActive()) connected(); };
    document.getElementById('mvNetCopyOffer').onclick=function(){ copy(el.Offer); };
    document.getElementById('mvNetCopyAnswer').onclick=function(){ copy(el.AnswerOut); };
    document.getElementById('mvNetConnect').onclick=function(){
      try{ NET.acceptAnswer(el.AnswerIn.value); }catch(e){ err(e); }
    };
    document.getElementById('mvNetCreateAnswer').onclick=function(){
      try{
        NET.join(el.JoinOffer.value).then(function(r){ el.AnswerOut.value=r.code||''; }).catch(err);
      }catch(e){ err(e); }
    };
    document.getElementById('mvNetLocalHost').onclick=function(){
      try{ NET.host({local:true,room:(el.Room.value||'mv2').trim()}).catch(err); }catch(e){ err(e); }
    };
    document.getElementById('mvNetLocalJoin').onclick=function(){
      try{ NET.join('MV2ROOM1:'+(el.Room.value||'mv2').trim()).catch(err); }catch(e){ err(e); }
    };
    NET.onStatus(render);
    render(NET.status());
  }

  function doHost(){
    try{ NET.host().then(function(r){ el.Offer.value=r.code||''; }).catch(err); }
    catch(e){ err(e); }
  }
  function copy(ta){
    if(!ta) return;
    try{ ta.focus(); ta.select(); if(!document.execCommand||!document.execCommand('copy')) throw 0; }
    catch(e){ try{ if(navigator.clipboard) navigator.clipboard.writeText(ta.value); }catch(e2){} }
  }
  function err(e){
    if(el.Status) el.Status.textContent='ERROR — '+((e&&e.message)||e||'unknown');
  }
  function setMode(m){
    mode=m;
    if(!panel) return;
    el.HostBox.className='mvnet-box'+(m==='host'?' on':'');
    el.JoinBox.className='mvnet-box'+(m==='join'?' on':'');
    el.LocalBox.className='mvnet-box'+(m==='local'?' on':'');
    var bs=document.getElementById('mvNetTabs').getElementsByTagName('button');
    for(var i=0;i<bs.length;i++) bs[i].className='mvnet-btn'+(bs[i].getAttribute('data-m')===m?' on':'');
    if(m==='host'&&!el.Offer.value) doHost();
  }
  function render(s){
    if(!el.Status) return;
    var txt=String(s.status||'offline').toUpperCase();
    if(s.detail) txt+=' — '+s.detail;
    el.Status.textContent=txt;
    el.Status.style.color=s.active?'#8ff5a0':(/error|closed/.test(s.status)?'#ff9a8a':'#c8b8e8');
    if(s.offer) el.Offer.value=s.offer;
    if(s.answer) el.AnswerOut.value=s.answer;
    el.Done.disabled=!s.active;
  }
  function show(cb){
    onDone=typeof cb==='function'?cb:null;
    if(!panel) build();
    panel.style.display='flex';
    setMode('host');
    render(NET.status());
  }
  function connected(){
    var cb=onDone; onDone=null;
    if(panel) panel.style.display='none';
    if(typeof cb==='function'){ try{ cb(); }catch(e){ console.error('MV net connect hook',e); } }
  }
  function cancel(){
    NET.disconnect();
    onDone=null;
    if(panel) panel.style.display='none';
    try{ if(typeof _playModeIdx!=='undefined') _playModeIdx=0; }catch(e){}
    try{ if(typeof _selectStep!=='undefined') _selectStep=0; }catch(e){}
    try{ if(typeof _gameState!=='undefined') _gameState='select'; }catch(e){}
  }
  // The peer linked up: leave the panel and fall through to the hero cards.
  NET.onStatus(function(s){ if(s.status==='connected') connected(); });

  // ---- menu integration (tiny wrappers, no edits to ui.js) --------------
  var realStart=window.startGame;
  if(typeof realStart==='function'){
    window.startGame=function(){
      try{
        if(typeof _gameState!=='undefined'&&_gameState==='select'&&
           typeof _selectStep!=='undefined'&&_selectStep===0&&
           typeof _playModeIdx!=='undefined'&&_playModeIdx===3){
          if(NET.isActive()){ _selectStep=1; return; }   // already linked: skip ui.js's old "coming soon" toast
          if(panel&&panel.style.display!=='none') return;
          show(function(){
            try{
              if(typeof _playerCount!=='undefined') _playerCount=2;
              if(typeof _playModeIdx!=='undefined') _playModeIdx=3;
              if(typeof _selectStep!=='undefined') _selectStep=1;
              if(window.MV_SIBLING) MV_SIBLING.on=false;
            }catch(e){}
          });
          return;
        }
      }catch(e){}
      return realStart.apply(this,arguments);
    };
  }
  var realGate=window.MV_SELECT_GATE;
  window.MV_SELECT_GATE=function(){
    try{ if(NET.isActive()) return false; }catch(e){}
    return typeof realGate==='function'?realGate.apply(this,arguments):false;
  };
  var realNav=window.MV_SELECT_NAV;
  window.MV_SELECT_NAV=function(){
    try{ if(panel&&panel.style.display!=='none') return true; }catch(e){}
    return typeof realNav==='function'?realNav.apply(this,arguments):false;
  };
  // ui.js turns Escape into "back to story" on step 0; while the net panel is
  // open, undo that and close the panel instead.
  document.addEventListener('keydown',function(e){
    if(!panel||panel.style.display==='none') return;
    if(e.code==='Escape'){ e.preventDefault(); e.stopPropagation(); cancel(); }
  },true);

  window.MV_NET_UI={open:show, close:cancel, isOpen:function(){ return !!(panel&&panel.style.display!=='none'); }};
})();
