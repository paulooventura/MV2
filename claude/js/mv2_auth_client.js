/* ============================================================
   mv2_auth_client.js — opt-in authoritative-server client (prototype).

   Enable with ?auth=ws://HOST:PORT/auth. With no flag this file does nothing,
   so the shipped game and existing room-based co-op are untouched.

   Sends input bitmasks (with sequence numbers) to the authority and applies
   the authoritative world snapshots it gets back. This is P1 of the
   server-authoritative build: coherent world, latency still visible.
   ============================================================ */
(function(){
  'use strict';
  var url='';
  try{ url=new URL(location.href).searchParams.get('auth')||''; }catch(e){}
  if(!/^wss?:\/\//.test(url)) return;

  var ws=null, seq=0, lastAck=0, snap=null, state='offline', lastRx=0, mySeat=0;
  var ACTS=['up','down','left','right','jump','use','swap','punch','sprint'];
  function mask(){
    var m=0;
    for(var i=0;i<ACTS.length;i++){
      var a=ACTS[i], down=false, tap=false;
      try{ down=(typeof _bindDown==='function'&&_bindDown(a))||(typeof _bindDown2==='function'&&_bindDown2(a)); }catch(e){}
      try{ tap=(typeof _bindJ==='function'&&_bindJ(a))||(typeof _bindJ2==='function'&&_bindJ2(a)); }catch(e){}
      if(down||tap) m|=(1<<i);
    }
    return m;
  }
  function apply(a,actor){
    if(!a||!actor||!isFinite(a[0])||!isFinite(a[1])) return;
    var dx=a[0]-actor.x, dy=a[1]-actor.y;
    if(Math.abs(dx)>240||Math.abs(dy)>240){ actor.x=a[0]; actor.y=a[1]; }
    else{ actor.x+=dx*0.65; actor.y+=dy*0.65; }
    actor.vx=a[2]; actor.vy=a[3];
    if(a[4]!=null) actor.fc=!!a[4];
    if(a[5]!=null) actor.hp=a[5];
    if(a[6]) actor.hero=a[6];
    if(a[7]!=null) actor.item=a[7];
    if(a[8]!=null) actor.pt=a[8];
    if(a[9]!=null) actor.crouchAmt=a[9];
  }
  function onSnap(s){
    if(!s||s.t!=='snap') return;
    snap=s; lastRx=Date.now(); state='live';
    if(s.acks&&s.acks.length) lastAck=Math.max.apply(null,s.acks);
    // My own actor is p on every device; the other one is the p2 puppet.
    try{
      var mine=mySeat===1?s.p2:s.p1, other=mySeat===1?s.p1:s.p2;
      if(mine&&typeof p!=='undefined'&&p) apply(mine,p);
      if(other&&typeof p2!=='undefined'&&p2) apply(other,p2);
      else if(other&&typeof p2==='undefined') window.__mvAuthOther=other;
    }catch(e){}
    try{
      if(s.enemies&&typeof ENEMS!=='undefined'&&ENEMS.length){
        for(var i=0;i<ENEMS.length&&i<s.enemies.length;i++){
          var e=ENEMS[i], q=s.enemies[i];
          if(e&&q){ e.x=q[0]; e.y=q[1]; if(q[2]!=null) e.hp=q[2]; if(q[3]!=null) e.off=!!q[3]; }
        }
      }
    }catch(e){}
    try{
      if(s.doors&&window.MV_DOORS&&MV_DOORS.doors)
        for(var j=0;j<MV_DOORS.doors.length&&j<s.doors.length;j++){
          var d=MV_DOORS.doors[j], z=s.doors[j];
          if(d&&z){ d.st=z[0]; d.t=z[1]; }
        }
    }catch(e){}
  }
  function connect(){
    state='connecting';
    try{ ws=new WebSocket(url); }catch(e){ state='error'; return; }
    ws.onopen=function(){ state='live'; };
    ws.onmessage=function(ev){
      try{
        var m=JSON.parse(ev.data);
        if(m.t==='seat'){ mySeat=m.seat|0; return; }
        onSnap(m);
      }catch(e){}
    };
    ws.onclose=function(){ state='offline'; ws=null; setTimeout(connect,1500); };
    ws.onerror=function(){ state='error'; };
  }
  setInterval(function(){
    if(!ws||ws.readyState!==1) return;
    try{ ws.send(JSON.stringify({t:'input',seq:++seq,ack:lastAck,m:mask()})); }catch(e){}
  },50);
  window.MV_AUTH={
    status:function(){ return {state:state,seat:mySeat,seq:seq,ack:lastAck,age:lastRx?Date.now()-lastRx:0,snap:snap}; },
    connect:connect
  };
  connect();
})();
