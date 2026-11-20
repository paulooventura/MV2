/* ============================================================
   mv2_net.js — MV2 online co-op netcode (Paulo's Q3: "play with friends online")

   Real online route: browser-to-browser WebRTC DataChannel. There is NO
   sign-up and NO server we own: the two players swap one SDP "offer" code
   and one "answer" code by hand (copy / paste). Public STUN is used only as
   a best-effort NAT hint; the media/data never touches a server.

   Local fallback route: BroadcastChannel("mv2net:<room>") for two tabs on
   the SAME browser/origin — handy for testing, NOT real online play.

   Both routes feed the same packet format and the same interpolation buffer,
   so gameplay code only talks to one API: window.MV_NET.

   API:
     host(opts)          -> Promise<{code}>   opts {local:true, room:'..'}
     join(code, opts)    -> Promise<{code}>   online: paste OFFER, returns ANSWER
     acceptAnswer(code)  -> Promise<void>     host: paste ANSWER
     send(state)         -> throttled snapshot send (~20 Hz)
     onState(cb)         -> cb(snapshot) on each received state
     onStatus(cb)        -> cb(status) on status changes
     tick(p, p2)         -> per-frame: send local player, interpolate remote
     applyVisual(p, p2)  -> per-frame (draw): re-apply interpolated remote pose
     status(), role(), isActive(), disconnect()

   This file never touches game state directly except the two actor objects
   handed to tick()/applyVisual(). It must not be edited by other lanes.
   ============================================================ */
(function(){
  'use strict';

  var OFFER='MV2NET1.', ROOM='MV2ROOM1:';
  var SEND_HZ=20, SEND_MS=1000/SEND_HZ, RENDER_DELAY_MS=90, BUF_MAX=24;
  var RTC_CFG={iceServers:[
    {urls:'stun:stun.l.google.com:19302'},
    {urls:'stun:stun1.l.google.com:19302'}
  ]};

  var st={active:false, mode:null, role:null, status:'offline', detail:''};
  var pc=null, dc=null, bc=null, room=null, helloTimer=null, peerSeen=0;
  var offerCode='', answerCode='', seq=0, lastSend=0, latest=null;
  var buf=[], outbox=[], stateCbs=[], statusCbs=[];

  function status(){
    return {active:st.active, mode:st.mode, role:st.role, status:st.status,
            detail:st.detail, offer:offerCode, answer:answerCode, room:room};
  }
  function setStatus(s,d){
    st.status=s; st.detail=d||'';
    for(var i=0;i<statusCbs.length;i++){ try{ statusCbs[i](status()); }catch(e){} }
  }
  function onStatus(cb){ if(typeof cb==='function') statusCbs.push(cb); return function(){ var i=statusCbs.indexOf(cb); if(i>=0) statusCbs.splice(i,1); }; }
  function onState(cb){ if(typeof cb==='function') stateCbs.push(cb); return function(){ var i=stateCbs.indexOf(cb); if(i>=0) stateCbs.splice(i,1); }; }

  // ---- compact, copy/paste-safe base64url codes -------------------------
  function b64e(o){
    var s=JSON.stringify(o), b;
    try{ b=window.btoa(unescape(encodeURIComponent(s))); }
    catch(e){ b=window.btoa(s); }
    return OFFER+b.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function b64d(code){
    var s=String(code==null?'':code).trim();
    if(s.indexOf(OFFER)!==0) return null;
    var b=s.slice(OFFER.length).replace(/-/g,'+').replace(/_/g,'/');
    while(b.length%4) b+='=';
    try{ return JSON.parse(decodeURIComponent(escape(window.atob(b)))); }
    catch(e){ try{ return JSON.parse(window.atob(b)); }catch(e2){ return null; } }
  }
  function parse(data){
    if(data==null) return null;
    if(typeof data==='object') return data;
    try{ return JSON.parse(String(data)); }catch(e){ return null; }
  }

  // ---- shared packet path ------------------------------------------------
  function post(obj){
    var s=JSON.stringify(obj);
    try{
      if(dc&&dc.readyState==='open') dc.send(s);
      else if(bc) bc.postMessage(s);
      else outbox.push(obj);
    }catch(e){}
  }
  function handle(pkt){
    var p=parse(pkt);
    if(!p||typeof p!=='object') return;
    if(p.t==='hello'){
      peerSeen=Date.now();
      if(!st.active){ st.active=true; setStatus('connected','Linked as '+(st.role||'peer')); }
      if(helloTimer){ clearInterval(helloTimer); helloTimer=null; }
      if(bc) post({t:'helloAck',from:st.role});
      return;
    }
    if(p.t==='helloAck'){ peerSeen=Date.now(); return; }
    if(p.t==='state'){
      var snap={};
      for(var k in p){ if(Object.prototype.hasOwnProperty.call(p,k)&&k!=='t') snap[k]=p[k]; }
      snap._rx=Date.now();
      buf.push(snap);
      if(buf.length>BUF_MAX) buf.shift();
      latest=snap;
      for(var i=0;i<stateCbs.length;i++){ try{ stateCbs[i](snap); }catch(e){} }
    }
  }
  function wireDC(ch){
    dc=ch;
    ch.onopen=function(){
      st.active=true;
      if(helloTimer){ clearInterval(helloTimer); helloTimer=null; }
      setStatus('connected','Direct link open ('+(st.mode||'webrtc')+')');
      while(outbox.length){ post(outbox.shift()); }
    };
    ch.onclose=function(){ st.active=false; setStatus('closed','Peer disconnected'); };
    ch.onerror=function(){ setStatus('error','Data channel error — NAT/firewall may be blocking'); };
    ch.onmessage=function(ev){ handle(ev.data); };
  }
  function waitGather(p){
    return new Promise(function(res){
      if(p.iceGatheringState==='complete') return res();
      var done=function(){
        if(p.iceGatheringState==='complete'){ p.removeEventListener('icegatheringstatechange',done); res(); }
      };
      p.addEventListener('icegatheringstatechange',done);
      setTimeout(function(){ p.removeEventListener('icegatheringstatechange',done); res(); },9000);
    });
  }

  // ---- lifecycle ---------------------------------------------------------
  function disconnect(){
    if(helloTimer){ clearInterval(helloTimer); helloTimer=null; }
    try{ if(dc) dc.close(); }catch(e){}
    try{ if(pc) pc.close(); }catch(e){}
    try{ if(bc) bc.close(); }catch(e){}
    pc=dc=bc=null; room=null; buf=[]; outbox=[]; latest=null; peerSeen=0;
    offerCode=answerCode=''; st.active=false; st.mode=st.role=null;
    setStatus('offline','');
  }

  // Host: online (WebRTC offer) or local (BroadcastChannel room).
  function host(opts){
    opts=opts||{};
    disconnect();
    if(opts.local){
      room=String(opts.room||('mv2-'+Math.floor(1000+Math.random()*9000)));
      try{
        bc=new window.BroadcastChannel('mv2net:'+room);
        bc.onmessage=function(ev){ handle(ev.data); };
      }catch(e){ setStatus('error','BroadcastChannel unavailable'); return Promise.reject(e); }
      st.mode='local'; st.role='host'; st.active=true;
      setStatus('hosting','Room "'+room+'" — waiting for the other tab');
      var ping=function(){ post({t:'hello',from:'host'}); };
      ping(); helloTimer=setInterval(ping,1000);
      return Promise.resolve({code:ROOM+room, room:room});
    }
    try{ pc=new window.RTCPeerConnection(RTC_CFG); }
    catch(e){ setStatus('error','WebRTC not available in this browser'); return Promise.reject(e); }
    dc=null;
    pc.ondatachannel=function(ev){ wireDC(ev.channel); };
    var ch=pc.createDataChannel('mv2',{ordered:true});
    wireDC(ch);
    return pc.createOffer().then(function(offer){ return pc.setLocalDescription(offer); })
      .then(function(){ return waitGather(pc); })
      .then(function(){
        offerCode=b64e({v:1,k:'offer',sdp:pc.localDescription.sdp});
        st.mode='webrtc'; st.role='host';
        setStatus('offer','Offer ready — send this code to your friend');
        return {code:offerCode};
      })
      .catch(function(e){ setStatus('error','Offer failed: '+(e&&e.message||e)); throw e; });
  }

  // Join: online (paste OFFER -> get ANSWER) or local (paste MV2ROOM1:room).
  function join(code,opts){
    opts=opts||{};
    var c=String(code==null?'':code).trim();
    if(c.indexOf(ROOM)===0){
      disconnect();
      room=c.slice(ROOM.length);
      try{
        bc=new window.BroadcastChannel('mv2net:'+room);
        bc.onmessage=function(ev){ handle(ev.data); };
      }catch(e){ setStatus('error','BroadcastChannel unavailable'); return Promise.reject(e); }
      st.mode='local'; st.role='joiner'; st.active=true;
      setStatus('joining','Room "'+room+'" — looking for the host tab');
      var ping=function(){ post({t:'hello',from:'joiner'}); };
      ping(); helloTimer=setInterval(ping,1000);
      return Promise.resolve({code:null, room:room});
    }
    return Promise.resolve().then(function(){
      var o=b64d(c);
      if(!o||o.k!=='offer') throw new Error('That is not an MV2 offer code');
      disconnect();
      pc=new window.RTCPeerConnection(RTC_CFG);
      pc.ondatachannel=function(ev){ wireDC(ev.channel); };
      return pc.setRemoteDescription({type:'offer',sdp:o.sdp})
        .then(function(){ return pc.createAnswer(); })
        .then(function(ans){ return pc.setLocalDescription(ans); })
        .then(function(){ return waitGather(pc); })
        .then(function(){
          answerCode=b64e({v:1,k:'answer',sdp:pc.localDescription.sdp});
          st.mode='webrtc'; st.role='joiner';
          setStatus('answer','Answer ready — send it back to the host');
          return {code:answerCode};
        });
    }).catch(function(e){ setStatus('error','Join failed: '+(e&&e.message||e)); throw e; });
  }

  // Host pastes the friend's answer; the data channel then opens on its own.
  function acceptAnswer(code){
    var a=b64d(code);
    if(!a||a.k!=='answer'||!pc) return Promise.reject(new Error('Not an MV2 answer code (no active offer?)'));
    return pc.setRemoteDescription({type:'answer',sdp:a.sdp})
      .then(function(){ setStatus('connecting','Answer accepted — opening direct link…'); })
      .catch(function(e){ setStatus('error','Answer failed: '+(e&&e.message||e)); throw e; });
  }

  // ---- gameplay bridge ---------------------------------------------------
  function r1(n){ n=+n; return isFinite(n)?Math.round(n*10)/10:0; }
  function snap(actor,who){
    if(!actor) return null;
    return {
      x:r1(actor.x), y:r1(actor.y), vx:r1(actor.vx), vy:r1(actor.vy),
      f:!!actor.fc, hp:Math.round(+actor.hp||0), h:String(actor.hero||'mind'),
      it:(actor.item==null?-1:actor.item)|0, pt:(actor.pt||0)|0,
      ca:r1(actor.crouchAmt||0), og:!!actor.og, who:who
    };
  }
  function send(stateObj){
    if(!st.active||!stateObj) return false;
    var now=Date.now();
    if(now-lastSend<SEND_MS) return false;
    lastSend=now;
    var pkt={t:'state',seq:++seq};
    for(var k in stateObj){ if(Object.prototype.hasOwnProperty.call(stateObj,k)) pkt[k]=stateObj[k]; }
    post(pkt);
    return true;
  }
  function applyRemote(actor,delayMs){
    if(!actor||!buf.length) return false;
    var target=Date.now()-(delayMs==null?RENDER_DELAY_MS:delayMs);
    var a=buf[0], b=buf[buf.length-1], mid=null, i;
    for(i=0;i<buf.length-1;i++){
      if(buf[i]._rx<=target&&buf[i+1]._rx>=target){ a=buf[i]; b=buf[i+1]; mid=buf[i+1]; break; }
    }
    var x,y;
    if(mid){ x=mid.x; y=mid.y; }
    else if(b._rx===a._rx){ x=b.x; y=b.y; }
    else{
      var k=Math.max(0,Math.min(1,(target-a._rx)/(b._rx-a._rx)));
      x=a.x+(b.x-a.x)*k; y=a.y+(b.y-a.y)*k;
    }
    if(!isFinite(x)||!isFinite(y)) return false;
    actor.x=x; actor.y=y;
    actor.vx=b.vx; actor.vy=b.vy; actor.fc=b.f; actor.hero=b.h;
    if(b.hp!=null) actor.hp=b.hp;
    if(b.it!=null) actor.item=b.it;
    if(b.pt!=null) actor.pt=b.pt;
    if(b.ca!=null) actor.crouchAmt=b.ca;
    if(b.og!=null) actor.og=b.og;
    return true;
  }
  function want(who){ return !latest||latest.who===who||buf.length<2; }
  function tick(p,p2){
    if(!st.active||!st.mode) return;
    if(st.role==='host'){
      if(p) send(snap(p,'p1'));
      if(p2&&want('p2')) applyRemote(p2);
    }else if(st.role==='joiner'){
      if(p2) send(snap(p2,'p2'));
      if(p&&want('p1')) applyRemote(p);
    }
  }
  function applyVisual(p,p2){
    if(!st.active||!st.mode) return;
    if(st.role==='host'&&p2&&want('p2')) applyRemote(p2);
    else if(st.role==='joiner'&&p&&want('p1')) applyRemote(p);
  }

  window.MV_NET={
    host:host, join:join, acceptAnswer:acceptAnswer, disconnect:disconnect,
    send:send, onState:onState, onStatus:onStatus,
    tick:tick, applyVisual:applyVisual, applyRemote:applyRemote,
    status:status, role:function(){ return st.role; },
    isActive:function(){ return st.active; },
    SEND_HZ:SEND_HZ, RENDER_DELAY_MS:RENDER_DELAY_MS
  };
})();
