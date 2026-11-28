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
    var a=an._mvBuf||(an._mvBuf=new Uint8Array(an.fftSize)); an.getByteTimeDomainData(a);   // one buffer per analyser, not per call
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
    Object.keys(links).forEach(function(id){ try{ if(links[id].out) links[id].out.close(); }catch(e){} if(links[id]) links[id].out=null; });
    try{ if(outCall) outCall.close(); }catch(e){}
    outCall=null;
    if(mic){ mic.getTracks().forEach(function(t){ try{ t.stop(); }catch(e){} }); }
    mic=null; lSrc=lAna=null;
  }
  var links={};
  function actorForSeat(seat){
    try{
      if(typeof p2!=='undefined'&&p2&&p2._netPuppet&&(p2._netSeat|0)===(seat|0)) return p2;
      var ex=NET.extras?NET.extras():[];
      for(var i=0;i<ex.length;i++) if(ex[i]&&(ex[i]._netSeat|0)===(seat|0)) return ex[i];
    }catch(e){}
    return (typeof p2!=='undefined'&&p2&&p2._netPuppet)?p2:null;
  }
  function gainFor(seat){
    var b=actorForSeat(seat);
    if(!b||typeof p==='undefined'||!p||_gameState!=='game') return {g:0, pan:0, who:null};
    var dx=b.x-p.x, dy=b.y-p.y, d=Math.hypot(dx,dy);
    var t=Math.max(0,Math.min(1,(d-NEAR)/(FAR-NEAR)));
    return {g:(1-t)*(1-t), pan:Math.max(-0.8,Math.min(0.8,dx/700)), who:b};
  }
  function callFriend(){
    if(!mic||!NET.isLinked()) return;
    var pr=NET.peer(); if(!pr) return;
    var targets=[];
    try{ targets=NET.voiceTargets?NET.voiceTargets():[]; }catch(e){ targets=[]; }
    if(!targets.length&&NET.remoteId&&NET.remoteId()) targets=[{id:NET.remoteId(), seat:1}];
    var keep={};
    targets.forEach(function(t){
      if(!t||!t.id) return;
      keep[t.id]=1;
      var L=links[t.id];
      if(L&&L.out){ L.seat=t.seat; return; }
      try{
        var call=pr.call(t.id,mic,{metadata:{mv2:'voice'}});
        if(!links[t.id]) links[t.id]={seat:t.seat|0, gain:0};
        links[t.id].out=call; links[t.id].seat=t.seat|0;
        outCall=call;
        if(call) call.on('close',function(){ if(links[t.id]&&links[t.id].out===call) links[t.id].out=null; });
      }catch(e){}
    });
  }

  // ---- incoming: friend's voice -> my speakers (only when my voice is on) ---
  function onIncoming(call){
    var id=call&&call.peer; if(!id) return;
    if(!links[id]) links[id]={seat:-1, gain:0};
    var L=links[id];
    try{ if(L.in&&L.in!==call) L.in.close(); }catch(e){}
    L.in=call; inCall=call;
    call.on('stream',function(s){ attachRemote(s, id); });
    call.on('close',function(){ if(links[id]&&links[id].in===call){ links[id].in=null; detachRemote(id); } });
    try{ call.answer(); }catch(e){}                              // receive-only: my own mic goes in my own call
  }
  function attachRemote(s, id){
    var L=id&&links[id];
    if(L){
      try{ if(L.src) L.src.disconnect(); if(L.gNode) L.gNode.disconnect(); if(L.pNode) L.pNode.disconnect(); }catch(e){}
      if(L.audioEl){ try{ L.audioEl.srcObject=null; L.audioEl.remove(); }catch(e){} }
      L.stream=s; remoteStream=s;
      try{
        var el=document.createElement('audio'); el.autoplay=true; el.muted=true; el.setAttribute('playsinline','');
        el.srcObject=s; el.style.display='none'; document.body.appendChild(el);
        var pl=el.play(); if(pl&&pl.catch) pl.catch(function(){});
        L.audioEl=el;
      }catch(e){}
      var cL=ctx();
      if(cL){
        try{
          L.src=cL.createMediaStreamSource(s);
          L.gNode=cL.createGain(); L.gNode.gain.value=0;
          L.pNode=cL.createStereoPanner?cL.createStereoPanner():null;
          L.ana=cL.createAnalyser(); L.ana.fftSize=512;
          L.src.connect(L.ana); L.src.connect(L.gNode);
          if(L.pNode){ L.gNode.connect(L.pNode); L.pNode.connect(cL.destination); }
          else L.gNode.connect(cL.destination);
        }catch(e){}
      }
      changed();
      return;
    }
    detachRemote();
    lastG=-1; lastPan=9;   // new gain node starts at 0: force the first proximity target
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
  function detachRemote(id){
    if(id&&links[id]){
      var L=links[id];
      try{ if(L.src) L.src.disconnect(); if(L.gNode) L.gNode.disconnect(); if(L.pNode) L.pNode.disconnect(); }catch(e){}
      L.src=L.gNode=L.pNode=L.ana=null;
      if(L.audioEl){ try{ L.audioEl.srcObject=null; L.audioEl.remove(); }catch(e){} L.audioEl=null; }
      L.stream=null; changed();
      return;
    }
    try{ if(srcNode) srcNode.disconnect(); if(gNode) gNode.disconnect(); if(pNode) pNode.disconnect(); }catch(e){}
    srcNode=gNode=pNode=rAna=null;
    if(audioEl){ try{ audioEl.srcObject=null; audioEl.remove(); }catch(e){} }
    audioEl=null; remoteStream=null;
    Object.keys(links).forEach(function(k){ detachRemote(k); try{ if(links[k].out) links[k].out.close(); }catch(e){} });
    changed();
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
  // Perf: this ran every frame forever and queued a new gain + pan automation event on
  // the audio thread each frame. Now: nothing while voice is off and no friend's voice is
  // attached; a new target only when it moved enough to hear (ramps stay smooth).
  var lastG=-1, lastPan=9;
  function frame(){
    requestAnimationFrame(frame);
    if(V.mode==='off'&&!gNode&&!audioEl&&!Object.keys(links).length){ if(padDown){ padDown=false; } return; }
    var pr=proximity();
    var loud=0, loudPan=0, c=actx, ids=Object.keys(links);
    if(!ids.length){
      var g0=(V.mode==='off')?0:pr.g;
      loud=g0; loudPan=pr.pan;
      if(Math.abs(g0-lastG)>0.004||(g0===0&&lastG!==0)){
        lastG=g0;
        if(gNode&&c){ try{ gNode.gain.setTargetAtTime(g0,c.currentTime,0.08); }catch(e){ gNode.gain.value=g0; } }
        if(!gNode&&audioEl&&remoteStream) audioEl.volume=Math.max(0,Math.min(1,g0));
      }
    }
    for(var li=0;li<ids.length;li++){
      var L=links[ids[li]]; if(!L) continue;
      var pg=gainFor(L.seat);
      var g=(V.mode==='off')?0:pg.g;
      L.gain=g; if(g>loud){ loud=g; loudPan=pg.pan; }
      if(Math.abs(g-(L._lg==null?-1:L._lg))>0.004){
        L._lg=g;
        if(L.gNode&&c){ try{ L.gNode.gain.setTargetAtTime(g,c.currentTime,0.08); }catch(e){ L.gNode.gain.value=g; } }
        if(!L.gNode&&L.audioEl&&L.stream) L.audioEl.volume=Math.max(0,Math.min(1,g));
      }
      if(L.pNode&&c&&Math.abs(pg.pan-(L._lp==null?9:L._lp))>0.01){ L._lp=pg.pan; try{ L.pNode.pan.setTargetAtTime(pg.pan,c.currentTime,0.1); }catch(e){} }
    }
    V.gain=loud; V.pan=loudPan;
    if(V.mode==='off') return;
    // pad right-stick click (button 11) = push-to-talk / mute toggle (8 = View is pause)
    try{
      var pads=navigator.getGamepads?navigator.getGamepads():[], down=false;
      for(var i=0;i<pads.length;i++){ var gp=pads[i]; if(gp&&gp.buttons&&gp.buttons[11]&&gp.buttons[11].pressed) down=true; }
      if(down!==padDown){ padDown=down; keyEdge(down); }
    }catch(e){}
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
    if(!s.linked){ try{ if(outCall) outCall.close(); }catch(e){} outCall=null; try{ if(inCall) inCall.close(); }catch(e){} inCall=null; detachRemote(); links={}; }
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
  // A "..." thought cloud pops off a hero who is talking. Yours appears while
  // your mic is open. Theirs appears only while you can actually hear them.
  var popMe=0, popThem=0;
  function blob(x,y,w,h){
    ctx.fillRect(x,y,w,h);
    ctx.fillRect(x-2,y+2,w+4,h-4);
  }
  function cloud(pl, pop){
    if(!pl||pop<0.05||typeof ctx==='undefined'||typeof sx!=='function'||typeof sy!=='function') return;
    var w=pl.w||48;
    var ax=sx(pl.x+w*0.62), ay=sy(pl.y-2);
    var n=typeof fr==='number'?fr:0;
    var s=0.55+0.45*pop;
    ctx.save();
    ctx.translate(ax, ay-18*s);
    ctx.scale(s,s);
    ctx.globalAlpha=Math.min(1, pop*1.4);
    ctx.fillStyle='#1C1A19';
    blob(-16,-13,34,18);
    ctx.fillRect(-3,8,4,4); ctx.fillRect(-7,12,3,3);
    ctx.fillStyle='#EFE6D2';
    blob(-15,-12,32,16);
    ctx.fillRect(-2,7,3,3); ctx.fillRect(-6,11,2,2);
    ctx.fillStyle='#1C1A19';
    for(var i=0;i<3;i++){
      var on=((n>>3)%3)===i;
      ctx.globalAlpha=Math.min(1, pop*(on?1:0.45));
      ctx.fillRect(-8+i*7, -6, on?3:2, on?3:2);
    }
    ctx.restore();
  }
  function approach(cur, on){ return cur+( (on?1:0) -cur)*(on?0.38:0.2); }
  function draw(){
    if(typeof ctx==='undefined') return;
    try{
      var inGame=typeof _gameState!=='undefined'&&_gameState==='game'&&V.mode!=='off';
      var meOn=inGame&&typeof p!=='undefined'&&!!p&&talking();
      var themOn=inGame&&typeof p2!=='undefined'&&!!p2&&!!p2._netPuppet&&V.gain>0.08&&level(rAna)>0.02;
      popMe=approach(popMe, meOn);
      popThem=approach(popThem, themOn);
      if(popMe>0.05&&p) cloud(p, popMe);
      if(popThem>0.05&&p2) cloud(p2, popThem);
    }catch(e){}
  }

  window.MV_VOICE={
    stats:stats,
    setMode:setMode, cycle:cycle, mode:function(){ return V.mode; }, muted:function(){ return V.muted; },
    toggleMute:toggleMute, talking:talking, gain:function(){ return V.gain; },
    level:function(){ return level(lAna); }, remoteLevel:function(){ return level(rAna); },
    state:state, onChange:function(cb){ if(typeof cb==='function') cbs.push(cb); },
    draw:draw, NEAR:NEAR, FAR:FAR
  };
})();
