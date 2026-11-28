/* ============================================================
   mv2_auth_net.js — host-authoritative online co-op over the room system.

   No separate server, no URL, no sign-in. One player hosts the room; the host
   tab is the single world authority. Guests send INPUT (not poses); the host
   feeds those inputs into the game's real P2 code, so punches, items, doors
   and enemy hits run through the actual game. The host broadcasts full world
   snapshots; guests render them.

   Opt-in with ?authv4=1 while it is being proven. The default room co-op is
   untouched when the flag is absent.
   ============================================================ */
(function(){
  'use strict';
  var NET=window.MV_NET;
  if(!NET||!/[?&]authv4=1/.test(location.search||'')) return;

  var ACTS=['up','down','left','right','jump','use','swap','punch','sprint'];
  var P2KEYS=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Numpad0','NumpadEnter','Numpad2','Numpad3','Sprint_gp2'];
  var inputs={}; var lastInput=0, lastSnap=0, seq=0, active=false;
  var lastSnapObj=null;

  function maskOf(){
    var m=0,t=0;
    for(var i=0;i<ACTS.length;i++){
      var a=ACTS[i],d=false,j=false;
      try{ d=(typeof _bindDown==='function'&&_bindDown(a))||(typeof _bindDown2==='function'&&_bindDown2(a)); }catch(e){}
      try{ j=(typeof _bindJ==='function'&&_bindJ(a))||(typeof _bindJ2==='function'&&_bindJ2(a)); }catch(e){}
      if(d) m|=1<<i;
      if(j) t|=1<<i;
    }
    return {m:m,t:t};
  }
  function feedP2(inp){
    if(!inp) return;
    var m=inp.m|0, prev=inp.prev|0, tap=inp.tap|0;
    for(var i=0;i<ACTS.length;i++){
      var bit=1<<i, on=!!(m&bit), was=!!(prev&bit), key=P2KEYS[i];
      if(on){ if(typeof K2!=='undefined') K2[key]=true; if((!was||(tap&bit))&&typeof Kj2!=='undefined') Kj2[key]=true; }
      else if(was&&typeof K2!=='undefined') K2[key]=false;
    }
    if(m&(1<<8)){ if(typeof K2!=='undefined') K2['Sprint_gp2']=true; }
    else if(prev&(1<<8)){ if(typeof K2!=='undefined') K2['Sprint_gp2']=false; }
    inp.prev=m; inp.tap=0;
  }
  function r1(n){ n=+n; return isFinite(n)?Math.round(n*10)/10:0; }
  function pack(a){
    if(!a) return null;
    return [r1(a.x),r1(a.y),r1(a.vx),r1(a.vy),a.fc?1:0,Math.round(+a.hp||0),
            String(a.hero||''),a.item|0,a.pt|0,Math.round((+a.crouchAmt||0)*100)/100];
  }
  function unpack(a,actor){
    if(!a||!actor||!isFinite(a[0])||!isFinite(a[1])) return;
    var dx=a[0]-actor.x,dy=a[1]-actor.y;
    if(Math.abs(dx)>260||Math.abs(dy)>260){actor.x=a[0];actor.y=a[1];}
    else{actor.x+=dx*0.6;actor.y+=dy*0.6;}
    actor.vx=a[2];actor.vy=a[3];
    if(a[4]!=null) actor.fc=!!a[4];
    if(a[5]!=null) actor.hp=a[5];
    if(a[6]) actor.hero=a[6];
    if(a[7]!=null) actor.item=a[7];
    if(a[8]!=null) actor.pt=a[8];
    if(a[9]!=null) actor.crouchAmt=a[9];
  }
  function world(){
    var w={v:4};
    try{ if(typeof ENEMS!=='undefined'&&ENEMS) w.e=ENEMS.slice(0,32).map(function(e){
      return e?[r1(e.x),r1(e.y),Math.round(+e.hp||0),e.off?1:0]:null; }); }catch(e){}
    try{ if(window.MV_DOORS&&MV_DOORS.doors) w.d=MV_DOORS.doors.map(function(d){return [d.st,d.t|0];}); }catch(e){}
    try{ if(window.MV_BETA) w.st=MV_BETA.stageId||''; }catch(e){}
    return w;
  }
  function applyWorld(w){
    if(!w) return;
    try{ if(w.d&&window.MV_DOORS&&MV_DOORS.doors) for(var i=0;i<MV_DOORS.doors.length&&i<w.d.length;i++){
      var d=MV_DOORS.doors[i],z=w.d[i]; if(d&&z){d.st=z[0];d.t=z[1];} } }catch(e){}
    try{ if(w.e&&typeof ENEMS!=='undefined') for(var j=0;j<ENEMS.length&&j<w.e.length;j++){
      var e=ENEMS[j],q=w.e[j]; if(e&&q){e.x=q[0];e.y=q[1];if(q[2]!=null)e.hp=q[2];if(q[3]!=null)e.off=!!q[3];} } }catch(e){}
    try{ if(w.st&&window.MV_BETA&&window.MV_BETA.stageId!==w.st&&typeof startBetaLab==='function')
      startBetaLab(w.st,0).catch(function(){}); }catch(e){}
  }

  NET.onPacket('authin',function(pk){
    if(NET.role()!=='host') return;
    var s=pk.seat|0; if(s===0) return;
    var c=inputs[s]||(inputs[s]={prev:0,m:0,tap:0});
    c.m=pk.m|0; c.tap=pk.tap|0; c.seq=pk.seq|0; c.at=Date.now();
  });
  NET.onPacket('authsnap',function(pk){
    if(NET.role()==='host'||pk.v!==4) return;
    lastSnapObj=pk;
    var seat=NET.seat();
    var mine=seat===1?pk.p2:pk.p1, other=seat===1?pk.p1:pk.p2;
    try{ if(mine&&typeof p!=='undefined'&&p) unpack(mine,p); }catch(e){}
    try{ if(other&&typeof p2!=='undefined'&&p2) unpack(other,p2); else if(other) window.__mvAuthOther=other; }catch(e){}
    applyWorld(pk.w);
  });

  // The host's P2 must exist and the game must run its real co-op input path.
  var setupDone=false;
  function setupHost(){
    if(setupDone||NET.role()!=='host'||!NET.isActive()) return;
    setupDone=true;
    try{
      if(typeof p2==='undefined'||!p2) p2=mkP();
      p2.hero=(typeof p!=='undefined'&&p&&p.hero==='mind')?'venture':'mind';
      p2._aiCompanion=false;
      if(p&&typeof p2!=='undefined'&&p2){p2.x=p.x+40;p2.y=p.y;p2.vx=0;p2.vy=0;p2.og=true;}
      if(typeof _playerCount!=='undefined') _playerCount=2;
      if(typeof MV_SIBLING!=='undefined') MV_SIBLING.on=false;
      var real=window.updateCoopPlayer2;
      if(real&&!real.__authWrapped){
        window.updateCoopPlayer2=function(){
          var c=inputs[1];
          if(c&&Date.now()-c.at<500) feedP2(c); else feedP2({m:0,tap:0,prev:0});
          return real.apply(this,arguments);
        };
        window.updateCoopPlayer2.__authWrapped=true;
      }
    }catch(e){ console.warn('auth host setup',e); }
  }

  var realTick=NET.tick, realVisual=NET.applyVisual;
  NET.tick=function(p1,pp2){
    if(!NET.isActive()){ if(realTick) return realTick.apply(NET,arguments); return; }
    setupHost();
    if(NET.role()==='host'){
      var now=Date.now();
      if(now-lastSnap>=50){
        lastSnap=now;
        var pkt={t:'authsnap',v:4,seq:++seq,
          p1:pack(p1),p2:pack(pp2),w:world()};
        try{ NET.sendPacket(pkt); }catch(e){}
      }
      // Host still sends its normal pose so the existing roster/UI works.
      if(realTick) try{ realTick.apply(NET,arguments); }catch(e){}
    }else{
      var now2=Date.now();
      if(now2-lastInput>=33){
        lastInput=now2;
        var s=maskOf();
        try{ NET.sendPacket({t:'authin',seat:NET.seat(),m:s.m,tap:s.t,seq:++seq}); }catch(e){}
      }
      // Re-apply the latest authoritative state every frame.
      if(lastSnapObj){
        var seat=NET.seat();
        var mine=seat===1?lastSnapObj.p2:lastSnapObj.p1;
        var other=seat===1?lastSnapObj.p1:lastSnapObj.p2;
        try{ if(mine&&p1) unpack(mine,p1); }catch(e){}
        try{ if(other&&pp2) unpack(other,pp2); }catch(e){}
      }
    }
  };
  NET.applyVisual=function(){
    if(!NET.isActive()||NET.role()==='host'){ if(realVisual) return realVisual.apply(NET,arguments); return; }
    // Let the original code create/update the remote puppet first, then lay
    // the authoritative snapshot over both actors.
    if(realVisual) try{ realVisual.apply(NET,arguments); }catch(e){}
    if(lastSnapObj){
      var seat=NET.seat();
      var mine=seat===1?lastSnapObj.p2:lastSnapObj.p1;
      var other=seat===1?lastSnapObj.p1:lastSnapObj.p2;
      try{ if(mine&&typeof p!=='undefined'&&p) unpack(mine,p); }catch(e){}
      try{ if(other&&typeof p2!=='undefined'&&p2) unpack(other,p2); }catch(e){}
    }
  };

  window.MV_AUTH_NET={
    active:function(){ return active; },
    status:function(){ return {role:NET.role(),seat:NET.seat(),inputs:Object.keys(inputs).length,lastSeq:seq,snap:!!lastSnapObj}; }
  };
  active=true;
})();
