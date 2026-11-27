/* ============================================================
   mv2_save_share.js — move your saves to another device, no accounts
   (Paulo, Nov 26: "We want to be able to have that local storage be
   transportable from one device to another").

   Title -> MOVE SAVES:
     SEND -> a 4-letter code + QR / link (…?getsave=CODE). The other device
             types the code (or scans) and gets the saves over a direct
             WebRTC link (same PeerJS broker as online co-op). Nothing is
             kept on any server.
     GET  -> type the code, see what is coming (journeys, options), then
             REPLACE MY SAVES. The old saves are kept once as a backup
             (localStorage 'mv2.saveBackup', UNDO LAST GET restores it).
     Fallback with no link: COPY SAVE CODE (text) / PASTE SAVE CODE, and
     SAVE FILE / LOAD FILE (.mv2save JSON).
   What moves: every localStorage key of this game ('mv2.*', 'mv_*': journeys,
   options, key binds, unlocks) except the anonymous online id and debug keys.
   ============================================================ */
(function(){
  'use strict';
  var PREFIX='mv2-save-', ALPHA='ABCDEFGHJKLMNPQRSTUVWXYZ', TXT='MV2SAVE1.';
  var SKIP=/^(mv2\.netId|mv2\.saveBackup|mv_selftest_report|mv_debug|mv_ab)$/;
  var panel=null, el={}, peer=null, conn=null, incoming=null;

  function gameKeys(){
    var out={};
    try{
      for(var i=0;i<localStorage.length;i++){
        var k=localStorage.key(i);
        if(!k||SKIP.test(k)||!/^(mv2\.|mv_)/.test(k)) continue;
        out[k]=localStorage.getItem(k);
      }
    }catch(e){}
    return out;
  }
  function bundle(){ return {v:1, kind:'mv2-save', at:Date.now(), build:String(window.MV_BUILD||''), keys:gameKeys()}; }
  function summary(b){
    if(!b||!b.keys) return 'nothing';
    var n=Object.keys(b.keys).length, j=0;
    try{ var s=JSON.parse(b.keys['mv2.story.slots.v1']||'null'); if(s&&s.length) j=s.filter(Boolean).length; }catch(e){}
    return j+' journey'+(j===1?'':'s')+', '+n+' saved settings'+(b.build?' (build '+b.build+')':'');
  }
  function valid(b){ return b&&b.kind==='mv2-save'&&b.keys&&typeof b.keys==='object'; }
  function apply(b){
    if(!valid(b)) throw new Error('That is not an MV2 save.');
    var now=gameKeys();
    try{ localStorage.setItem('mv2.saveBackup',JSON.stringify({at:Date.now(),keys:now})); }catch(e){}
    Object.keys(now).forEach(function(k){ try{ localStorage.removeItem(k); }catch(e){} });
    Object.keys(b.keys).forEach(function(k){ if(!SKIP.test(k)&&/^(mv2\.|mv_)/.test(k)) try{ localStorage.setItem(k,String(b.keys[k])); }catch(e){} });
  }
  function undo(){
    var bk=null; try{ bk=JSON.parse(localStorage.getItem('mv2.saveBackup')||'null'); }catch(e){}
    if(!bk||!bk.keys) return false;
    apply({kind:'mv2-save',keys:bk.keys}); try{ localStorage.removeItem('mv2.saveBackup'); }catch(e){}
    return true;
  }
  // text code: base64url(JSON) — long, but works anywhere you can paste
  function toText(b){
    var s=JSON.stringify(b), x;
    try{ x=btoa(unescape(encodeURIComponent(s))); }catch(e){ x=btoa(s); }
    return TXT+x.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function fromText(t){
    t=String(t||'').trim().replace(/\s+/g,'');
    if(t.indexOf(TXT)!==0) throw new Error('A save code starts with '+TXT);
    var x=t.slice(TXT.length).replace(/-/g,'+').replace(/_/g,'/'); while(x.length%4) x+='=';
    var o; try{ o=JSON.parse(decodeURIComponent(escape(atob(x)))); }catch(e){ throw new Error('That save code is broken (copy all of it).'); }
    if(!valid(o)) throw new Error('That is not an MV2 save.');
    return o;
  }
  function newCode(){ var s=''; for(var i=0;i<4;i++) s+=ALPHA.charAt(Math.floor(Math.random()*ALPHA.length)); return s; }
  function norm(c){ return String(c||'').toUpperCase().replace(/[^A-Z]/g,'').replace(/[IO]/g,'').slice(0,4); }
  function peerOpts(){ var C=window.MV2_NET_CFG||{}, o={debug:0}; ['host','port','path','secure','key'].forEach(function(k){ if(C[k]!=null) o[k]=C[k]; }); if(C.iceServers) o.config={iceServers:C.iceServers}; return o; }
  function link(code){
    var b='https://mindandventure.pauloventura.org/';
    try{ if(/^https?:$/.test(location.protocol)&&!/^(localhost|127\.)/.test(location.hostname)) b=location.origin+location.pathname; }catch(e){}
    return b+'?getsave='+code;
  }
  function stop(){ try{ if(conn) conn.close(); }catch(e){} try{ if(peer) peer.destroy(); }catch(e){} conn=peer=null; }
  function say(t,col){ if(el.Status){ el.Status.textContent=t; el.Status.style.color=col||'#c8b8e8'; } }

  // ---- SEND: open a one-off room and hand the save to whoever opens it -------
  function send(tries){
    stop(); tries=tries||0;
    if(typeof window.Peer!=='function'){ say('Online parts did not load. Use COPY SAVE CODE instead.','#ff9a8a'); return; }
    var code=newCode(), pr=new window.Peer(PREFIX+code,peerOpts()); peer=pr;
    show('send'); el.Code.textContent='····'; say('Opening…');
    pr.on('open',function(){
      if(peer!==pr) return;
      el.Code.textContent=code; el.Link.textContent=link(code); qr(link(code));
      say('On the other device: title → MOVE SAVES → GET, and type '+code+'. Keep this screen open.');
    });
    pr.on('connection',function(c){
      c.on('open',function(){ c.send({t:'save', b:bundle()}); say('Sending…'); });
      c.on('data',function(d){ if(d&&d.t==='got'){ say('Sent! The other device has your saves now.','#8ff5a0'); setTimeout(function(){ try{ c.close(); }catch(e){} },500); } });
    });
    pr.on('error',function(e){
      if(peer!==pr) return;
      if(e&&e.type==='unavailable-id'&&tries<5){ send(tries+1); return; }
      say('Could not open a link ('+((e&&e.type)||e)+'). Use COPY SAVE CODE instead.','#ff9a8a');
    });
  }
  // ---- GET: connect to the code, preview, confirm ---------------------------
  function get(code){
    code=norm(code);
    if(code.length!==4){ say('Codes have 4 letters.','#ff9a8a'); return; }
    stop();
    if(typeof window.Peer!=='function'){ say('Online parts did not load. Use PASTE SAVE CODE instead.','#ff9a8a'); return; }
    var pr=new window.Peer(peerOpts()); peer=pr;
    say('Looking for '+code+'…');
    pr.on('open',function(){
      var c=pr.connect(PREFIX+code,{reliable:true,serialization:'json'}); conn=c;
      c.on('data',function(d){
        if(!d||d.t!=='save'||!valid(d.b)) return;
        incoming=d.b; c.send({t:'got'});
        preview();
      });
      c.on('error',function(){ say('The link failed. Try again, or use PASTE SAVE CODE.','#ff9a8a'); });
    });
    pr.on('error',function(e){ if(peer!==pr) return; say(e&&e.type==='peer-unavailable'?'No device is sending with that code.':'Could not connect ('+((e&&e.type)||e)+').','#ff9a8a'); });
  }
  function preview(){
    show('confirm');
    el.What.textContent='Incoming: '+summary(incoming)+'.  This device now has: '+summary(bundle())+'.';
    say('REPLACE MY SAVES swaps them in (your old saves are kept once as a backup).');
  }
  function confirmGet(){
    try{ apply(incoming); incoming=null; stop(); say('Done! Restarting with the new saves…','#8ff5a0'); setTimeout(function(){ location.reload(); },900); }
    catch(e){ say(e.message,'#ff9a8a'); }
  }

  // ---- panel -------------------------------------------------------------------
  function qr(text){
    var cv=el.Qr; if(!cv) return; var g=cv.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,cv.width,cv.height);
    if(!text||typeof window.qrcode!=='function') return;
    try{ var q=window.qrcode(0,'M'); q.addData(text); q.make(); var n=q.getModuleCount(), sz=Math.floor(cv.width/(n+2)), off=Math.floor((cv.width-sz*n)/2);
      g.fillStyle='#000'; for(var r=0;r<n;r++) for(var c=0;c<n;c++) if(q.isDark(r,c)) g.fillRect(off+c*sz,off+r*sz,sz,sz); }catch(e){}
  }
  function build(){
    var st=document.createElement('style'); st.textContent=
      '#mvSavePanel{display:none;position:fixed;inset:0;z-index:100001;background:rgba(3,2,9,.94);color:#e8e0ff;font:14px/1.5 ui-monospace,Consolas,monospace;align-items:center;justify-content:center;padding:12px;}'+
      '#mvSavePanel .box{width:min(700px,96vw);max-height:94vh;overflow:auto;background:#0c0a18;border:2px solid #ffe39a;border-radius:12px;padding:20px;text-align:center;}'+
      '#mvSavePanel h2{margin:0 0 4px;color:#ffe39a;letter-spacing:.12em;font-size:22px;}'+
      '#mvSavePanel .sub{color:#a99cc6;font-size:12px;margin:0 0 12px;}'+
      '#mvSavePanel .row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:10px 0;}'+
      '#mvSavePanel button{font:inherit;font-weight:bold;min-height:44px;padding:8px 16px;border-radius:8px;background:#1c1a2e;color:#fff;border:2px solid #4a3f6a;cursor:pointer;}'+
      '#mvSavePanel button.big{min-width:200px;min-height:60px;font-size:16px;}'+
      '#mvSavePanel button:focus,#mvSavePanel button.pf{outline:3px solid #ffe39a;outline-offset:2px;}'+
      '#mvSavePanel .code{font-size:clamp(40px,11vw,76px);font-weight:bold;letter-spacing:.28em;color:#ffe39a;padding-left:.28em;}'+
      '#mvSavePanel input{font:bold 44px ui-monospace,Consolas,monospace;width:5em;text-align:center;letter-spacing:.3em;text-transform:uppercase;background:#04030a;color:#ffe39a;border:2px solid #ffe39a;border-radius:8px;}'+
      '#mvSavePanel textarea{width:100%;box-sizing:border-box;min-height:80px;background:#04030a;color:#cfe8ff;border:1px solid #334;border-radius:4px;font:11px ui-monospace,Consolas,monospace;}'+
      '#mvSavePanel canvas#mvSaveQr{position:static!important;display:inline-block;width:148px!important;height:148px!important;background:#fff;border-radius:6px;padding:6px;transform:none!important;}'+
      '#mvSavePanel .link{color:#9ad4ff;font-size:12px;word-break:break-all;}'+
      '#mvSaveStatus{margin:12px auto 0;max-width:560px;padding:8px 10px;border-left:3px solid #ffe39a;background:#141020;font-size:13px;text-align:left;}';
    document.head.appendChild(st);
    panel=document.createElement('div'); panel.id='mvSavePanel';
    panel.innerHTML='<div class="box"><h2>MOVE SAVES</h2><p class="sub">Take your journeys and settings to another PC, Steam or phone. No account.</p>'+
      '<div id="mvSaveMenu"><div class="row"><button class="big" id="mvSaveSendBtn">SEND FROM HERE</button><button class="big" id="mvSaveGetBtn">GET ON THIS DEVICE</button></div>'+
        '<div class="row"><button id="mvSaveCopyBtn">COPY SAVE CODE</button><button id="mvSavePasteBtn">PASTE SAVE CODE</button><button id="mvSaveFileBtn">SAVE FILE</button><button id="mvSaveLoadBtn">LOAD FILE</button><button id="mvSaveUndoBtn">UNDO LAST GET</button></div></div>'+
      '<div id="mvSaveSend" style="display:none"><div class="sub" style="margin:0">CODE</div><div class="code" id="mvSaveCode">····</div><div class="link" id="mvSaveLink"></div><canvas id="mvSaveQr" width="148" height="148"></canvas></div>'+
      '<div id="mvSaveGet" style="display:none"><div class="sub" style="margin:0">Type the 4-letter code shown on the other device</div><div class="row"><input id="mvSaveIn" maxlength="4" autocomplete="off" spellcheck="false"></div><div class="row"><button class="big" id="mvSaveGo">GET</button></div></div>'+
      '<div id="mvSaveText" style="display:none"><textarea id="mvSaveTa" spellcheck="false"></textarea><div class="row"><button id="mvSaveTaGo">USE THIS CODE</button></div></div>'+
      '<div id="mvSaveConfirm" style="display:none"><p id="mvSaveWhat"></p><div class="row"><button class="big" id="mvSaveYes">REPLACE MY SAVES</button></div></div>'+
      '<input type="file" id="mvSaveFile" accept=".mv2save,.json,application/json" style="display:none">'+
      '<div id="mvSaveStatus">Pick one.</div><div class="row"><button id="mvSaveBack">BACK</button></div></div>';
    document.body.appendChild(panel);
    ['Menu','Send','Get','Text','Confirm','Code','Link','Qr','In','Go','Ta','TaGo','What','Yes','File','Status','Back'].forEach(function(k){ el[k]=document.getElementById('mvSave'+k); });
    var on=function(id,f){ document.getElementById(id).onclick=f; };
    on('mvSaveSendBtn',function(){ send(0); });
    on('mvSaveGetBtn',function(){ show('get'); say('Type the code.'); setTimeout(function(){ try{ el.In.focus(); }catch(e){} },30); });
    on('mvSaveGo',function(){ get(el.In.value); });
    el.In.addEventListener('input',function(){ var v=norm(el.In.value); if(v!==el.In.value) el.In.value=v; if(v.length===4) get(v); });
    on('mvSaveCopyBtn',function(){
      show('text'); el.Ta.value=toText(bundle()); el.Ta.readOnly=true; el.TaGo.style.display='none';
      try{ el.Ta.focus(); el.Ta.select(); if(!document.execCommand('copy')) throw 0; say('Copied. Paste it on the other device: MOVE SAVES → PASTE SAVE CODE.','#8ff5a0'); }
      catch(e){ try{ navigator.clipboard.writeText(el.Ta.value); say('Copied.','#8ff5a0'); }catch(e2){ say('Select all of it and copy it by hand.'); } }
    });
    on('mvSavePasteBtn',function(){ show('text'); el.Ta.value=''; el.Ta.readOnly=false; el.TaGo.style.display=''; say('Paste the whole save code, then USE THIS CODE.'); setTimeout(function(){ try{ el.Ta.focus(); }catch(e){} },30); });
    on('mvSaveTaGo',function(){ try{ incoming=fromText(el.Ta.value); preview(); }catch(e){ say(e.message,'#ff9a8a'); } });
    on('mvSaveFileBtn',function(){
      try{
        var blob=new Blob([JSON.stringify(bundle())],{type:'application/json'}), a=document.createElement('a');
        a.href=URL.createObjectURL(blob); a.download='mind-and-venture-2.mv2save'; document.body.appendChild(a); a.click();
        setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1000);
        say('Saved mind-and-venture-2.mv2save. Load it on the other device with LOAD FILE.','#8ff5a0');
      }catch(e){ say('This device cannot save files here. Use COPY SAVE CODE.','#ff9a8a'); }
    });
    on('mvSaveLoadBtn',function(){ el.File.value=''; el.File.click(); });
    el.File.addEventListener('change',function(){
      var f=el.File.files&&el.File.files[0]; if(!f) return;
      var r=new FileReader();
      r.onload=function(){ try{ var o=JSON.parse(String(r.result)); if(!valid(o)) throw new Error('That file is not an MV2 save.'); incoming=o; preview(); }catch(e){ say(e.message||'Could not read that file.','#ff9a8a'); } };
      r.readAsText(f);
    });
    on('mvSaveUndoBtn',function(){ if(undo()){ say('Your saves from before the last GET are back. Restarting…','#8ff5a0'); setTimeout(function(){ location.reload(); },900); } else say('Nothing to undo.'); });
    on('mvSaveYes',confirmGet);
    on('mvSaveBack',function(){ if(view!=='menu'){ stop(); show('menu'); say('Pick one.'); } else close(); });
    // the game's own capture handlers (title clicks, keys) must not see this panel's input
    window.addEventListener('click',function(e){
      if(!isOpen()||!(e.target&&e.target.closest&&e.target.closest('#mvSavePanel'))) return;
      e.stopPropagation();
      var b=e.target.closest('button'); if(b&&!b.disabled&&typeof b.onclick==='function') b.onclick.call(b,e);
    },true);
    ['touchstart','touchend','mousedown','pointerup'].forEach(function(t){ window.addEventListener(t,function(e){ if(isOpen()&&e.target&&e.target.closest&&e.target.closest('#mvSavePanel')) e.stopPropagation(); },{capture:true,passive:true}); });
    window.addEventListener('keydown',function(e){
      if(!isOpen()) return;
      if(e.code==='Escape'){ e.preventDefault(); el.Back.onclick(); }
      e.stopImmediatePropagation();
    },true);
    // pad: left/right/up/down move, A press, B back
    var pf=0, prev={};
    setInterval(function(){
      if(!isOpen()) return;
      var gp=null, ps=navigator.getGamepads?navigator.getGamepads():[]; for(var i=0;i<ps.length;i++) if(ps[i]&&ps[i].connected){ gp=ps[i]; break; }
      if(!gp) return;
      var b=function(n){ return !!(gp.buttons[n]&&gp.buttons[n].pressed); }, ax=gp.axes[0]||0, ay=gp.axes[1]||0;
      var now={a:b(0),b:b(1),n:b(15)||b(13)||ax>0.5||ay>0.5,p:b(14)||b(12)||ax<-0.5||ay<-0.5};
      var f=Array.prototype.filter.call(panel.querySelectorAll('button'),function(x){ return x.offsetParent!==null&&!x.disabled; });
      if(f.length){
        if(now.n&&!prev.n) pf=(pf+1)%f.length;
        if(now.p&&!prev.p) pf=(pf-1+f.length)%f.length;
        f.forEach(function(x,i){ x.classList.toggle('pf',i===pf); });
        if(now.a&&!prev.a&&f[pf]) f[pf].click();
      }
      if(now.b&&!prev.b) el.Back.onclick();
      prev=now;
    },50);
  }
  var view='menu';
  function show(v){
    if(!panel) build();
    view=v||'menu';
    panel.style.display='flex';
    el.Menu.style.display=view==='menu'?'':'none';
    el.Send.style.display=view==='send'?'':'none';
    el.Get.style.display=view==='get'?'':'none';
    el.Text.style.display=view==='text'?'':'none';
    el.Confirm.style.display=view==='confirm'?'':'none';
    el.Back.textContent=view==='menu'?'CLOSE':'BACK';
  }
  function isOpen(){ return !!(panel&&panel.style.display!=='none'); }
  function close(){ stop(); if(panel) panel.style.display='none'; }
  function open(){ show('menu'); say('Pick one.'); }

  // ?getsave=CODE (from the QR / link)
  (function(){
    var m=/[?&]getsave=([A-Za-z]{4})\b/.exec(location.search||''); if(!m) return;
    var t0=Date.now(), iv=setInterval(function(){
      if(!document.body&&Date.now()-t0<15000) return;
      clearInterval(iv); show('get'); el.In.value=norm(m[1]); say('Press GET to take the saves from '+norm(m[1])+'.');
    },300);
  })();

  window.MV_SAVE_SHARE={open:open, close:close, isOpen:isOpen, bundle:bundle, toText:toText, fromText:fromText, apply:apply, undo:undo, summary:summary};
})();
