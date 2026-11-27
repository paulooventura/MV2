/* ============================================================
   mv2_voice.js — proximity voice chat for MV2 online co-op (Paulo, Nov 26:
   "it would be awesome too to have proximity chat as a feature").

   OFF by default, every session: no microphone is asked for and the friend's
   voice is not played until this player turns voice on (OPEN MIC or
   PUSH-TO-TALK). Voice goes player-to-player over WebRTC (a PeerJS media
   call on the same room link); nothing is recorded or stored.

   Proximity: the friend's voice is full volume when the two heroes stand
   close (<= NEAR px), fades out with distance and is silent past FAR px; it
   pans left/right with where the friend's hero is.

   Keys (only while linked and in a stage): T = push-to-talk (hold) in PTT
   mode, or mute / unmute in OPEN MIC mode. Pad: right-stick click (button 11)
   does the same (View / Back is pause). The ONLINE chip (mv2_net_ui.js) cycles OFF -> OPEN MIC -> PTT.

   API (window.MV_VOICE): setMode('off'|'open'|'ptt'), mode(), muted(),
   toggleMute(), talking(), gain(), level(), remoteLevel(), state()
   ============================================================ */
(function(){
  'use strict';
  if(!window.MV_NET) return;
  var NET=window.MV_NET;
  var NEAR=180, FAR=1100;

  var V={mode:'off', muted:false, ptt:false, gain:0, pan:0, err:''};
  var mic=null, outCall=null, inCall=null, remoteStream=null;
  var actx=null, gNode=null, pNode=null, srcNode=null, rAna=null, lAna=null, lSrc=null, audioEl=null;
  var cbs=[];
  function changed(){ for(var i=0;i<cbs.length;i++){ try{ cbs[i](state()); }catch(e){} } }
  function state(){ return {mode:V.mode, muted:V.muted, ptt:V.ptt, talking:talking(), gain:V.gain, err:V.err,
                            hearing:!!remoteStream, sending:!!outCall}; }

  function ctx(){
    if(actx) return actx;
    try{ var A=window.AudioContext||window.webkitAudioContext; if(A) actx=new A(); }catch(e){ actx=null; }
    return actx;
  }
  function level(an){
    if(!an) return 0;
    var a=new Uint8Array(an.fftSize); an.getByteTimeDomainData(a);
    var s=0; for(var i=0;i<a.length;i++){ var v=(a[i]-128)/128; s+=v*v; }
    return Math.sqrt(s/a.length);
  }
  function talking(){
    if(!mic||V.mode==='off') return false;
    return V.mode==='open'?!V.muted:V.ptt;
  }
  function applyTrack(){
    if(!mic) return;
    var on=talking();
    mic.getAudioTracks().forEach(function(t){ t.enabled=on; });
  }

  // ---- outgoing: my mic -> friend ------------------------------------------
  function startMic(){
    if(mic) return Promise.resolve(mic);
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){ V.err='No microphone access in this browser.'; changed(); return Promise.reject(new Error(V.err)); }
    return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false})
      .then(function(s){
        mic=s; V.err='';
        var c=ctx();
        if(c){ try{ lSrc=c.createMediaStreamSource(s); lAna=c.createAnalyser(); lAna.fftSize=512; lSrc.connect(lAna); }catch(e){} }
        applyTrack(); callFriend(); changed();
        return s;
      })
      .catch(function(e){ V.err='Microphone blocked: '+((e&&e.name)||e); V.mode='off'; changed(); throw e; });
  }
  function stopMic(){
    try{ if(outCall) outCall.close(); }catch(e){}
    outCall=null;
    if(mic){ mic.getTracks().forEach(function(t){ try{ t.stop(); }catch(e){} }); }
    mic=null; lSrc=lAna=null;
  }
  function callFriend(){
    if(!mic||!NET.isLinked()) return;
    var pr=NET.peer(), id=NET.remoteId();
    if(!pr||!id) return;
    try{ if(outCall) outCall.close(); }catch(e){}
    try{
      outCall=pr.call(id,mic,{metadata:{mv2:'voice'}});
      if(outCall) outCall.on('close',function(){ outCall=null; changed(); });
    }catch(e){ outCall=null; }
  }

  // ---- incoming: friend's voice -> my speakers (only when my voice is on) ---
  function onIncoming(call){
    try{ if(inCall&&inCall!==call) inCall.close(); }catch(e){}
    inCall=call;
    call.on('stream',function(s){ attachRemote(s); });
    call.on('close',function(){ if(inCall===call){ inCall=null; detachRemote(); } });
    try{ call.answer(); }catch(e){}                              // receive-only: my own mic goes in my own call
  }
  function attachRemote(s){
    detachRemote();
    remoteStream=s;
    // Chrome only feeds a remote WebRTC stream into WebAudio while a media
    // element also plays it, so keep a muted <audio> attached.
    try{
      audioEl=document.createElement('audio'); audioEl.autoplay=true; audioEl.muted=true; audioEl.setAttribute('playsinline','');
      audioEl.srcObject=s; audioEl.style.display='none'; document.body.appendChild(audioEl);
      var pl=audioEl.play(); if(pl&&pl.catch) pl.catch(function(){});
    }catch(e){}
    var c=ctx();
    if(c){
      try{
        srcNode=c.createMediaStreamSource(s);
        gNode=c.createGain(); gNode.gain.value=0;
        pNode=c.createStereoPanner?c.createStereoPanner():null;
        rAna=c.createAnalyser(); rAna.fftSize=512;
        srcNode.connect(rAna); srcNode.connect(gNode);
        if(pNode){ gNode.connect(pNode); pNode.connect(c.destination); } else gNode.connect(c.destination);
      }catch(e){ srcNode=gNode=pNode=rAna=null; }
    }
    if(!gNode&&audioEl){ audioEl.muted=false; audioEl.volume=0; }   // no WebAudio: element volume fallback
    changed();
  }
  function detachRemote(){
    try{ if(srcNode) srcNode.disconnect(); if(gNode) gNode.disconnect(); if(pNode) pNode.disconnect(); }catch(e){}
    srcNode=gNode=pNode=rAna=null;
    if(audioEl){ try{ audioEl.srcObject=null; audioEl.remove(); }catch(e){} }
    audioEl=null; remoteStream=null; changed();
  }

  // ---- proximity -------------------------------------------------------------
  function heroes(){
    try{
      if(typeof _gameState==='undefined'||_gameState!=='game') return null;
      if(typeof p==='undefined'||!p||typeof p2==='undefined'||!p2||!p2._netPuppet) return null;
      return {a:p,b:p2};
    }catch(e){ return null; }
  }
  function proximity(){
    var h=heroes();
    if(!h) return {g:0,pan:0};
    var dx=(h.b.x-h.a.x), dy=(h.b.y-h.a.y), d=Math.hypot(dx,dy);
    var t=Math.max(0,Math.min(1,(d-NEAR)/(FAR-NEAR)));
    var g=(1-t)*(1-t);                                            // smooth fade, louder up close
    return {g:g, pan:Math.max(-0.8,Math.min(0.8,dx/700))};
  }
  function frame(){
    var pr=proximity();
    var g=(V.mode==='off')?0:pr.g;
    V.gain=g; V.pan=pr.pan;
    var c=actx;
    if(gNode&&c){ try{ gNode.gain.setTargetAtTime(g,c.currentTime,0.08); }catch(e){ gNode.gain.value=g; } }
    if(pNode&&c){ try{ pNode.pan.setTargetAtTime(pr.pan,c.currentTime,0.1); }catch(e){} }
    if(!gNode&&audioEl&&remoteStream) audioEl.volume=Math.max(0,Math.min(1,g));
    // pad right-stick click (button 11) = push-to-talk / mute toggle (8 = View is pause)
    try{
      var pads=navigator.getGamepads?navigator.getGamepads():[], down=false;
      for(var i=0;i<pads.length;i++){ var gp=pads[i]; if(gp&&gp.buttons&&gp.buttons[11]&&gp.buttons[11].pressed) down=true; }
      if(down!==padDown){ padDown=down; keyEdge(down); }
    }catch(e){}
    requestAnimationFrame(frame);
  }
  var padDown=false;
  requestAnimationFrame(frame);

  function liveStage(){ try{ return NET.isLinked()&&_gameState==='game'; }catch(e){ return false; } }
  function keyEdge(down){
    if(!liveStage()||V.mode==='off') return;
    if(V.mode==='ptt'){ V.ptt=down; applyTrack(); changed(); }
    else if(down){ toggleMute(); }
  }
  window.addEventListener('keydown',function(e){
    if(e.code!=='KeyT'||e.repeat||e.ctrlKey||e.metaKey||e.altKey) return;
    var t=e.target; if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA')) return;
    keyEdge(true);
  });
  window.addEventListener('keyup',function(e){ if(e.code==='KeyT') { if(V.mode==='ptt'&&V.ptt){ V.ptt=false; applyTrack(); changed(); } } });
  window.addEventListener('blur',function(){ if(V.ptt){ V.ptt=false; applyTrack(); changed(); } });

  function setMode(m){
    m=(m==='open'||m==='ptt')?m:'off';
    V.mode=m; V.ptt=false; V.muted=false;
    var c=ctx(); if(c&&c.state==='suspended'){ try{ c.resume(); }catch(e){} }   // called from a click / key: allowed to start audio
    if(m==='off'){ stopMic(); changed(); return Promise.resolve(); }
    return startMic().then(function(){ applyTrack(); changed(); }).catch(function(){});
  }
  function toggleMute(){ if(V.mode!=='open') return; V.muted=!V.muted; applyTrack(); changed(); }
  function cycle(){ return setMode(V.mode==='off'?'open':(V.mode==='open'?'ptt':'off')); }

  NET.onPacket('call',onIncoming);
  NET.onStatus(function(s){
    if(s.status==='connected'){ if(mic) setTimeout(callFriend,300); }
    if(!s.linked){ try{ if(outCall) outCall.close(); }catch(e){} outCall=null; try{ if(inCall) inCall.close(); }catch(e){} inCall=null; detachRemote(); }
  });

  // inbound / outbound audio bytes from the WebRTC stats (works with no audio device too)
  function stats(){
    var out={rx:0,tx:0}, jobs=[];
    [[inCall,'inbound-rtp','bytesReceived','rx'],[outCall,'outbound-rtp','bytesSent','tx']].forEach(function(j){
      var pc=j[0]&&j[0].peerConnection; if(!pc||!pc.getStats) return;
      jobs.push(pc.getStats().then(function(r){ r.forEach(function(x){ if(x.type===j[1]&&(x.kind==='audio'||x.mediaType==='audio')) out[j[3]]+=x[j[2]]||0; }); }).catch(function(){}));
    });
    return Promise.all(jobs).then(function(){ return out; });
  }
  window.MV_VOICE={
    stats:stats,
    setMode:setMode, cycle:cycle, mode:function(){ return V.mode; }, muted:function(){ return V.muted; },
    toggleMute:toggleMute, talking:talking, gain:function(){ return V.gain; },
    level:function(){ return level(lAna); }, remoteLevel:function(){ return level(rAna); },
    state:state, onChange:function(cb){ if(typeof cb==='function') cbs.push(cb); },
    NEAR:NEAR, FAR:FAR
  };
})();
