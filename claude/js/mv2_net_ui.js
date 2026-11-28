/* ============================================================
   mv2_net_ui.js — ONLINE screens (Jackbox-style room codes).

   Build 444 / T640: up to 5 players. Host / join → roster.
   Seats 1–2 = Mind & Venture. Seats 3–5 = crayon + session name + hat.
   Names are nicknames only (Warm Shadow — never force a real name).
   Chrome follows Monika mv2 dialect (washi / sumi / gold leaf) — same
   play type (MV Pixel) as title/menus; no CRT terminal scanlines.
   ============================================================ */
(function(){
  'use strict';
  if(!window.MV_NET) return;
  var NET=window.MV_NET, ID=window.MV_IDENTITY||null, VOICE=function(){ return window.MV_VOICE||null; };
  var P=(window.MV_PALETTE&&window.MV_PALETTE.hex)||{};
  var WASHI=P.washi||'#EFE6D2', AGED=P.washi_aged||'#E6CFAB', SUMI=P.sumi||'#1C1A19';
  var GOLD=P.gold||'#C9A24A', MICA=P.mica||'#B9B3A8', USU=P.usuzumi||'#8C8580';
  var NIGHT=P.violet_black||'#1E1B27', SEAL=P.vermilion||'#D9472B', MURA=P.murasaki||'#5B2A8C';
  var panel=null, el={}, view='menu', onDone=null, chip=null, chipHtml='';
  var draft={name:'', color:'', hat:'gaucho'};

  function css(){
    if(document.getElementById('mvNetCss')) return;
    var s=document.createElement('style');
    s.id='mvNetCss';
    s.textContent=
      '#mvNetPanel{display:none;position:fixed;inset:0;z-index:100000;color:'+WASHI+';'+
        'background:radial-gradient(ellipse at 50% 20%,'+MURA+'55 0%, '+NIGHT+' 42%, '+SUMI+' 100%);'+
        'font:18px/1.35 "MV Pixel",ui-monospace,Menlo,monospace;-webkit-text-size-adjust:100%;text-size-adjust:100%;'+
        'align-items:center;justify-content:center;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));}'+
      '#mvNetPanel .box{width:min(680px,94vw);max-height:100%;max-height:calc(100dvh - 24px);overflow:auto;text-align:center;position:relative;'+
        'background:linear-gradient(165deg,'+AGED+' 0%, '+WASHI+' 38%, '+AGED+' 100%);color:'+SUMI+';'+
        'border:3px solid '+GOLD+';border-radius:0;'+
        'box-shadow:6px 8px 0 rgba(0,0,0,.45), inset 0 0 0 1px '+SUMI+', inset 0 0 0 4px '+AGED+';'+
        'padding:26px 20px 18px;}'+
      '#mvNetPanel .box:before{content:"";display:block;height:6px;margin:-26px -20px 16px;'+
        'background:linear-gradient(90deg,'+SEAL+' 0 18%, '+GOLD+' 18% 82%, '+SEAL+' 82% 100%);}'+
      '#mvNetPanel h2{margin:0 0 6px;font-size:28px;font-weight:400;color:'+SUMI+';letter-spacing:.16em;}'+
      '#mvNetPanel .sub{color:'+USU+';font-size:16px;margin:0 0 14px;}'+
      '#mvNetPanel .row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:10px 0;}'+
      '#mvNetPanel button{font:inherit;letter-spacing:.08em;min-height:44px;padding:8px 16px;border-radius:0;'+
        'background:'+SUMI+';color:'+WASHI+';border:2px solid '+USU+';cursor:pointer;}'+
      '#mvNetPanel button.big{min-width:200px;min-height:58px;font-size:20px;border-color:'+GOLD+';}'+
      '#mvNetPanel button.on{background:'+MURA+';border-color:'+GOLD+';color:'+AGED+';}'+
      '#mvNetPanel button:focus,#mvNetPanel button.pf{outline:none;border-color:'+GOLD+';box-shadow:inset 0 0 0 1px '+GOLD+';}'+
      '#mvNetPanel button:disabled{opacity:.4;cursor:default;}'+
      '#mvNetPanel .code{font-size:clamp(40px,10vw,72px);letter-spacing:.28em;color:'+GOLD+';'+
        'margin:6px 0 2px;padding-left:.28em;text-shadow:2px 2px 0 '+SUMI+';}'+
      '#mvNetPanel .link{color:'+MURA+';font-size:14px;word-break:break-all;user-select:all;}'+
      '#mvNetPanel canvas#mvNetQr{position:static!important;display:inline-block;width:148px!important;height:148px!important;max-width:40vw;max-height:40vw;'+
        'background:'+WASHI+';border:3px solid '+GOLD+';border-radius:0;padding:6px;margin-top:8px;'+
        'box-shadow:3px 3px 0 '+SUMI+';image-rendering:pixelated;transform:none!important;}'+
      '#mvNetCode{font:clamp(28px,8vw,64px) "MV Pixel",ui-monospace,Menlo,monospace;width:min(100%,7.2em);max-width:100%;box-sizing:border-box;text-align:center;letter-spacing:.18em;'+
        'padding:4px 0 4px .28em;text-transform:uppercase;background:'+SUMI+';color:'+GOLD+';border:3px solid '+GOLD+';border-radius:0;}'+
      '#mvNetStatus{margin:14px auto 0;max-width:540px;padding:10px 12px;border:2px solid '+GOLD+';'+
        'border-left:6px solid '+GOLD+';background:rgba(28,26,25,.06);color:'+SUMI+';font-size:16px;text-align:left;}'+
      '#mvNetStatus.warn{border-left-color:'+SEAL+';color:'+SEAL+';}'+
      '#mvNetPanel .voice{margin-top:16px;padding-top:12px;border-top:2px solid '+GOLD+';}'+
      '#mvNetPanel .tiny{color:'+USU+';font-size:14px;margin-top:8px;}'+
      '#mvNetPanel .roster{display:flex;flex-direction:column;gap:8px;margin:10px auto;max-width:420px;text-align:left;}'+
      '#mvNetPanel .seat{display:flex;align-items:center;gap:12px;padding:8px 10px;'+
        'border:2px solid '+SUMI+';background:linear-gradient(90deg,'+WASHI+', '+AGED+');'+
        'box-shadow:3px 3px 0 rgba(28,26,25,.25);}'+
      '#mvNetPanel .swatch{width:22px;height:28px;flex:0 0 auto;border:2px solid '+SUMI+';'+
        'border-radius:2px 2px 10px 10px;box-shadow:inset 0 -4px 0 rgba(0,0,0,.18), 1px 1px 0 '+GOLD+';'+
        'transform:rotate(-6deg);}'+
      '#mvNetPanel .idbox{margin:12px auto 0;max-width:480px;padding:12px;border:2px solid '+SUMI+';'+
        'background:linear-gradient(180deg,'+WASHI+', '+AGED+');text-align:left;box-shadow:3px 3px 0 rgba(28,26,25,.2);}'+
      '#mvNetPanel .idbox label{display:block;font-size:14px;color:'+USU+';margin:8px 0 4px;}'+
      '#mvNetNick{width:100%;box-sizing:border-box;font:18px "MV Pixel",ui-monospace,Menlo,monospace;'+
        'padding:8px 10px;background:'+WASHI+';color:'+SUMI+';border:2px solid '+SUMI+';}'+
      '#mvNetColors,#mvNetHats{display:flex;flex-wrap:wrap;gap:8px;}'+
      '#mvNetColors button,#mvNetHats button{min-width:0;min-height:40px;padding:6px 10px;}'+
      '#mvNetColors button .dot{display:inline-block;width:14px;height:18px;margin-right:6px;'+
        'border:2px solid '+SUMI+';border-radius:2px 2px 8px 8px;vertical-align:middle;transform:rotate(-8deg);}'+
      '#mvNetChip{position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);right:10px;z-index:9000;display:none;'+
        'font:16px "MV Pixel",ui-monospace,Menlo,monospace;color:'+SUMI+';background:'+AGED+';border:2px solid '+GOLD+';'+
        'border-radius:0;padding:4px 10px;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:manipulation;'+
        'box-shadow:3px 3px 0 '+SUMI+';}'+
      '#mvNetChip .mic{display:inline-block;width:8px;height:8px;border-radius:0;background:'+USU+';margin-left:6px;vertical-align:middle;}'+
      '#mvNetChip .mic.live{background:'+GOLD+';}'+
      '#mvNetChip .mic.hear{background:'+MURA+';}'+
      '@media (max-height:520px){'+
        '#mvNetPanel{font-size:15px;}'+
        '#mvNetPanel .box{padding:12px 12px 8px;}'+
        '#mvNetPanel .box:before{margin:-12px -12px 8px;}'+
        '#mvNetPanel h2{font-size:20px;letter-spacing:.08em;}'+
        '#mvNetPanel .sub{font-size:13px;margin-bottom:6px;}'+
        '#mvNetPanel .code{font-size:32px;letter-spacing:.12em;}'+
        '#mvNetPanel button.big{min-height:44px;font-size:16px;}'+
        '#mvNetPanel canvas#mvNetQr{width:88px!important;height:88px!important;}'+
      '}';
    document.head.appendChild(s);
  }

  function loadDraft(){
    var loc=ID?ID.loadLocal():{name:'',color:'',hat:'gaucho'};
    draft.name=loc.name||'';
    draft.color=loc.color||'';
    draft.hat=loc.hat||'';
    draft.hatMatch=!!loc.hatMatch;
  }

  function build(){
    css();
    loadDraft();
    panel=document.createElement('div');
    panel.id='mvNetPanel';
    panel.innerHTML=
      '<div class="box">'+
        '<h2>ONLINE</h2>'+
        '<p class="sub">Up to 5 riders. Each one picks a colour, a hat and a name. The colour is the sprite. The name rides above the head.</p>'+

        '<div id="mvNetMenu">'+
          '<div class="row">'+
            '<button type="button" class="big" id="mvNetHostBtn">HOST A ROOM</button>'+
            '<button type="button" class="big" id="mvNetJoinBtn">JOIN A ROOM</button>'+
          '</div>'+
        '</div>'+

        '<div id="mvNetHostV" style="display:none">'+
          '<div class="sub" style="margin:0">ROOM CODE — tell your friends</div>'+
          '<div class="code" id="mvNetHostCode">····</div>'+
          '<div class="link" id="mvNetLink"></div>'+
          '<canvas id="mvNetQr" width="148" height="148"></canvas>'+
          '<div class="tiny" id="mvNetCount">0 / 5 in the room</div>'+
          '<div class="roster" id="mvNetRoster"></div>'+
        '</div>'+

        '<div id="mvNetJoinV" style="display:none">'+
          '<div class="sub" style="margin:0">Type the 4-letter ROOM CODE</div>'+
          '<div class="row"><input id="mvNetCode" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text"></div>'+
          '<div class="row"><button type="button" id="mvNetGo" class="big">JOIN</button></div>'+
          '<div class="roster" id="mvNetRosterJ"></div>'+
        '</div>'+

        '<div id="mvNetId" class="idbox" style="display:none">'+
          '<div class="sub" style="margin:0 0 4px">YOUR RIDE (session only)</div>'+
          '<label for="mvNetNick">NAME — this sits above your head</label>'+
          '<input id="mvNetNick" maxlength="12" autocomplete="nickname" spellcheck="false" placeholder="YOUR NAME">'+
          '<label>COLOUR — this paints the sprite. Purple is Mind. Red is Venture.</label>'+
          '<div id="mvNetColors"></div>'+
          '<label>HAT</label>'+
          '<div id="mvNetHats"></div>'+
          '<label>HAT COLOUR</label>'+
          '<div class="row" id="mvNetHatMatch">'+
            '<button type="button" data-m="1">MATCH MY COLOUR</button>'+
            '<button type="button" data-m="0">KEEP ITS OWN COLOUR</button>'+
          '</div>'+
          '<div class="tiny">Gaucho or baseball cap. Match paints the hat the same colour as the sprite. Your name rides above your head.</div>'+
        '</div>'+

        '<div id="mvNetStatus">Pick HOST or JOIN.</div>'+

        '<div class="voice">'+
          '<div>PROXIMITY VOICE <span class="tiny">— louder when your heroes are close (1 friend for now)</span></div>'+
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
        '<div class="tiny">Friends can be anywhere in the world. The room stays open for 15 minutes while everyone gets in.</div>'+
      '</div>';
    document.body.appendChild(panel);
    ['Menu','HostV','JoinV','HostCode','Link','Qr','Code','Go','Status','Done','Back','Voice','VoiceHint','HostBtn','JoinBtn','Roster','RosterJ','Count','Id','Nick','Colors','Hats','HatMatch'].forEach(function(k){
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
    el.Nick.value=draft.name;
    el.Nick.addEventListener('input',commitId);
    el.Nick.addEventListener('change',commitId);
    el.Nick.addEventListener('blur',commitId);
    buildCrayonButtons();
    buildHatButtons();
    if(el.HatMatch) Array.prototype.forEach.call(el.HatMatch.querySelectorAll('button'),function(b){
      b.onclick=function(){ draft.hatMatch=b.getAttribute('data-m')==='1'; paintIdButtons(); commitId(); };
    });
    paintIdButtons();
    NET.onStatus(render);
    if(VOICE()) VOICE().onChange(renderVoice);
    render(NET.status()); renderVoice();
  }

  function buildCrayonButtons(){
    if(!el.Colors||!ID) return;
    el.Colors.innerHTML='';
    ID.CRAYONS.forEach(function(c){
      var b=document.createElement('button');
      b.type='button'; b.setAttribute('data-color',c.id);
      b.innerHTML='<span class="dot" style="background:'+c.hex+'"></span>'+c.name;
      if(c.id===draft.color) b.className='on';
      b.onclick=function(){ if(b.disabled) return; el._colorNote=''; draft.color=c.id; paintIdButtons(); commitId(); };
      el.Colors.appendChild(b);
    });
  }
  function buildHatButtons(){
    if(!el.Hats||!ID) return;
    el.Hats.innerHTML='';
    ID.HATS.forEach(function(h){
      var b=document.createElement('button');
      b.type='button'; b.setAttribute('data-hat',h.id);
      b.textContent=h.name;
      b.title=h.sub||'';
      if(h.id===draft.hat) b.className='on';
      b.onclick=function(){ draft.hat=h.id; paintIdButtons(); commitId(); };
      el.Hats.appendChild(b);
    });
  }
  function paintIdButtons(){
    var seat=(NET.seat?NET.seat():-1);
    if(el.Colors) Array.prototype.forEach.call(el.Colors.querySelectorAll('button'),function(b){
      var id=b.getAttribute('data-color');
      var taken=NET.colorTaken&&id!==draft.color&&NET.colorTaken(id, seat);
      b.disabled=!!taken;
      b.className=id===draft.color?'on':'';
    });
    if(el.Hats) Array.prototype.forEach.call(el.Hats.querySelectorAll('button'),function(b){
      b.className=b.getAttribute('data-hat')===draft.hat?'on':'';
    });
    if(el.HatMatch) Array.prototype.forEach.call(el.HatMatch.querySelectorAll('button'),function(b){
      b.className=(b.getAttribute('data-m')==='1')===!!draft.hatMatch?'on':'';
    });
  }
  function commitId(){
    draft.name=el.Nick?el.Nick.value:'';
    var asked=draft.color;
    var got=null;
    if(typeof NET.setIdentity==='function') got=NET.setIdentity({name:draft.name, color:draft.color, hat:draft.hat, hatMatch:!!draft.hatMatch});
    if(got&&got.color&&got.color!==asked){
      draft.color=got.color;
      paintIdButtons();
      if(el.Status) el.Status.textContent='That colour is taken. Yours is '+String(got.color).toUpperCase()+'.';
    }
  }
  function showIdentity(seat){
    var need=ID?ID.needsCrayon(seat):(seat|0)>=2;
    // Host (seat 0) can still set a nick; crayon/hat matter most for seats 3–5.
    // Always show the box when linked so everyone can set a session name;
    // crayon+hat emphasized for guests.
    if(!el.Id) return;
    el.Id.style.display=NET.isLinked()?'block':'none';
    if(el.Colors) el.Colors.style.opacity=1;
    if(el.Hats) el.Hats.style.opacity=1;
  }

  function renderRoster(into){
    if(!into) return;
    var list=typeof NET.roster==='function'?NET.roster():[];
    var max=NET.MAX_PEERS||5;
    if(!list.length){ into.innerHTML='<div class="tiny">Waiting…</div>'; return; }
    into.innerHTML=list.map(function(r){
      var seat=(r.seat|0)+1;
      var kind=seat<=2?(seat===1?'MIND':'VENTURE'):(ID?ID.crayonById(r.col||r.color).name:'RIDER');
      var col=ID?ID.crayonById(r.col||r.color).hex:(GOLD||'#C9A24A');
      var nm=r.nm||r.name||('SEAT '+seat);
      var hat=r.hat||'—';
      return '<div class="seat"><span class="swatch" style="background:'+col+'" title="crayon"></span>'+
        '<div><b>SEAT '+seat+' · '+kind+'</b><br>'+nm+' · hat '+hat+'</div></div>';
    }).join('')+'<div class="tiny">'+list.length+' / '+max+' riders</div>';
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
      showIdentity(0);
    }).catch(function(){});
  }
  function startJoin(code){
    var c=NET.normCode(code);
    if(c.length!==NET.CODE_LEN){ el.Status.textContent='Room codes have '+NET.CODE_LEN+' letters.'; return; }
    if(NET.role()==='joiner'&&NET.code()===c&&/joining|connected/.test(NET.status().status)) return;
    try{ if(typeof _unlockAudio==='function') _unlockAudio(); }catch(e){}
    NET.join(c).then(function(){ showIdentity(NET.seat()); }).catch(function(){});
  }
  function qr(text){
    var cv=el.Qr; if(!cv) return;
    var g=cv.getContext('2d'); g.fillStyle=WASHI; g.fillRect(0,0,cv.width,cv.height);
    cv.style.display=text?'':'none';
    if(!text||typeof window.qrcode!=='function') return;
    try{
      var q=window.qrcode(0,'M'); q.addData(text); q.make();
      var n=q.getModuleCount(), sz=Math.floor(cv.width/(n+2)), off=Math.floor((cv.width-sz*n)/2);
      g.fillStyle=SUMI;
      for(var r=0;r<n;r++) for(var c=0;c<n;c++) if(q.isDark(r,c)) g.fillRect(off+c*sz,off+r*sz,sz,sz);
    }catch(e){ cv.style.display='none'; }
  }
  function keepUnique(){
    if(!NET.claimColor||!draft.color||el._claiming) return;
    var seat=NET.seat?NET.seat():-1;
    var next=NET.claimColor(draft.color, seat);
    if(!next||next===draft.color) return;
    draft.color=next;
    el._claiming=1;
    try{ commitId(); }finally{ el._claiming=0; }
    el._colorNote='That colour is taken. Yours is '+String(next).toUpperCase()+'.';
    paintIdButtons();
  }
  function render(s){
    keepUnique();
    if(panel){
      var max=s.maxPeers||NET.MAX_PEERS||5;
      var txt=s.detail||String(s.status||'').toUpperCase();
      if(s.phase==='timeline') txt='In the same stage · '+(s.peers||'?')+'/'+max+'.';
      else if(s.phase==='entering') txt=s.role==='host'?'Friends are entering the stage.':'Entering the stage.';
      else if(s.phase==='room'&&s.linked) txt=s.role==='host'
        ?('In the room · '+(s.peers||1)+'/'+max+'. Pick a colour, a hat and a name.')
        :'In the room. Waiting for the host to start.';
      if(el._colorNote) txt=el._colorNote;
      if(s.linked&&s.ping) txt+='  ·  ping '+s.ping+' ms';
      if(view!=='menu'||s.status!=='offline') el.Status.textContent=txt;
      // Host "friend could not reach" stays gold (room healthy). Hard join failure = seal red.
      var hardErr=/error|closed/.test(s.status)&&(s.role!=='host'||!s.code);
      var softHost=s.role==='host'&&s.status==='hosting'&&/could not reach|still open/i.test(txt);
      el.Status.className=hardErr?'warn':'';
      el.Status.style.color=s.linked?SUMI:(hardErr?SEAL:(softHost?SUMI:SUMI));
      el.Status.style.borderLeftColor=hardErr?SEAL:(s.linked||s.status==='hosting'?GOLD:USU);
      el.Done.disabled=!(s.linked&&s.role==='host');
      if(el.Count) el.Count.textContent=(s.peers||(s.linked?2:1))+' / '+max+' in the room';
      renderRoster(el.Roster); renderRoster(el.RosterJ);
      showIdentity(typeof NET.seat==='function'?NET.seat():0);
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
    // DOM writes only when something changed (was: innerHTML every 200 ms in play = layout churn)
    var disp=live?'block':'none'; if(chip.style.display!==disp) chip.style.display=disp;
    if(!live) return;
    var v=VOICE(), m=v?v.mode():'off', vs=v?v.state():{};
    var vt=m==='off'?'VOICE OFF':(m==='open'?(vs.muted?'MIC MUTED':'OPEN MIC'):(vs.ptt?'TALKING':'HOLD T'));
    var tag=s.phase==='timeline'?'TOGETHER':(s.phase==='entering'?'ENTERING':'IN THE ROOM');
    var n=s.peers||'?';
    var pingB=s.ping?(s.ping<80?'<80':(Math.round(s.ping/20)*20)):0;   // ping shown to 20 ms: fewer rewrites
    var html=tag+' '+(s.code||'')+' · '+n+'/'+(s.maxPeers||5)+(pingB?' · '+pingB+'ms':'')+' · '+vt+'<span class="mic" id="mvNetMicDot"></span>';
    if(html!==chipHtml){ chipHtml=html; chip.innerHTML=html; }
  }
  setInterval(function(){
    renderChip();
    var dot=document.getElementById('mvNetMicDot'), v=VOICE();
    if(dot&&v){
      var me=v.talking()&&v.level()>0.02, them=v.mode()!=='off'&&v.remoteLevel()*v.gain()>0.01;
      var cn='mic'+(me?' live':(them?' hear':'')); if(dot.className!==cn) dot.className=cn;
    }
  },200);

  function show(cb){
    onDone=typeof cb==='function'?cb:null;
    if(!panel) build();
    loadDraft();
    var hero='mind';
    try{ hero=(typeof _heroChoice==='string'&&_heroChoice)?_heroChoice:((typeof heroName==='function')?heroName():'mind'); }catch(e){}
    if(!draft.color) draft.color=hero==='venture'?'red':'purple';
    if(!draft.hat) draft.hat=hero==='venture'?'cap':'gaucho';
    if(el.Nick) el.Nick.value=draft.name;
    paintIdButtons();
    panel.style.display='flex';
    if(NET.isLinked()) setView(NET.role()==='host'?'host':'join'); else setView('menu');
    render(NET.status()); renderVoice();
  }
  function hide(){ if(panel) panel.style.display='none'; }
  function isOpen(){ return !!(panel&&panel.style.display!=='none'); }
  function finishHost(){
    commitId();
    var cb=onDone; onDone=null; hide();
    try{
      _playerCount=1; _playModeIdx=3; _selectStep=1;
      if(window.MV_SIBLING) MV_SIBLING.on=false;
    }catch(e){}
    if(typeof cb==='function'){ try{ cb(); }catch(e){} }
  }
  function back(){
    if(view!=='menu'){ NET.disconnect(); setView('menu'); if(el.Id) el.Id.style.display='none'; return; }
    hide(); onDone=null;
    try{ if(!NET.isLinked()&&typeof _playModeIdx!=='undefined'&&_playModeIdx===3) _playModeIdx=0; }catch(e){}
  }
  NET.onStatus(function(s){
    if(s.status==='connected'&&s.role==='host'&&isOpen()&&(s.peers||0)>=2){
      // Auto-advance only when at least one friend is in — host can still wait for more.
      // Keep panel open so host can watch the roster fill to 5; Done enables once linked.
    }
  });

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
  function inField(t){
    return !!(t&&(t.id==='mvNetNick'||t.id==='mvNetCode'||t.tagName==='INPUT'||t.tagName==='TEXTAREA'));
  }
  // Title owns S (menu down) and Backspace (shut down) on the way to this box.
  // Stopping here, without preventDefault, is what lets the letter land.
  window.addEventListener('keydown',function(e){
    if(!isOpen()) return;
    var t=e.target;
    if(e.code==='Escape'){ e.preventDefault(); e.stopImmediatePropagation(); back(); return; }
    if(inField(t)){
      if(e.key==='Enter'&&t.id==='mvNetCode'){ e.preventDefault(); e.stopImmediatePropagation(); startJoin(el.Code.value); return; }
      e.stopImmediatePropagation();
      return;
    }
    if(view==='join'&&el.Code&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
      var ch=/^Key([A-Z])$/.test(e.code)?e.code.charAt(3):'';
      if(ch||e.code==='Backspace'||e.code==='Delete'||e.key==='Enter'){
        e.preventDefault(); e.stopImmediatePropagation();
        try{ el.Code.focus(); }catch(err){}
        if(e.key==='Enter'){ startJoin(el.Code.value); return; }
        var v=NET.normCode(el.Code.value);
        if(e.code==='Backspace'||e.code==='Delete') v=v.slice(0,-1);
        else if(v.length<NET.CODE_LEN) v=NET.normCode(v+ch);
        el.Code.value=v;
        if(v.length===NET.CODE_LEN) startJoin(v);
        return;
      }
    }
    if(e.key==='Enter'&&t&&t.tagName==='BUTTON'){ e.stopImmediatePropagation(); return; }
    e.stopImmediatePropagation();
  },true);

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
    window.addEventListener(t,function(e){ if(ours(e.target)) e.stopPropagation(); },false);
  });

  var pf=0, padPrev={}, padRep=0;
  function focusables(){
    if(!panel) return [];
    return Array.prototype.filter.call(panel.querySelectorAll('button,#mvNetCode,#mvNetNick'),function(b){ return b.offsetParent!==null&&!b.disabled; });
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
    var onNick=cur&&cur.id==='mvNetNick';
    if(edge('l')) padFocus(pf-1);
    if(edge('r')) padFocus(pf+1);
    if(onCode&&edge('u')) letterStep(1);
    if(onCode&&edge('d')){ if(NET.normCode(el.Code.value).length<NET.CODE_LEN) el.Code.value=NET.normCode(el.Code.value)+'A'; else letterStep(-1); }
    if(!onCode&&!onNick&&(edge('u')||edge('d'))) padFocus(pf+(now.d?1:-1));
    if(edge('a')&&cur){ if(onCode){ var v=NET.normCode(el.Code.value); if(v.length===NET.CODE_LEN) startJoin(v); else el.Code.value=v+'A'; } else if(!onNick) cur.click(); }
    if(edge('b')) back();
    padPrev=now;
  },50);

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
      // A phone that opens the link has not tapped yet. Starting the
      // connection before that tap is what fails on iOS.
      var touch=false;
      try{ touch=!!window._phonePlay||/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1); }catch(e){}
      if(touch){ el.Status.textContent='Tap JOIN to enter room '+code+'.'; }
      else startJoin(code);
      try{ el.Go.focus(); }catch(e){}
      padFocus(focusables().indexOf(el.Go));
    },300);
  })();

  window.MV_NET_UI={open:show, hide:hide, close:back, isOpen:isOpen, host:startHost, join:startJoin, view:function(){ return view; }};
})();
