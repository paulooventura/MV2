/* ============================================================
   mv2_net.js — MV2 online co-op netcode, v2 (Paulo, Nov 26 2026:
   "a way for the players to connect and play online, kinda like jackbox.tv,
   easy to 'join a server'").

   Transport: browser-to-browser WebRTC through PeerJS (claude/js/vendor/
   peerjs.min.js, MIT). The host registers a short ROOM CODE with a PeerJS
   broker (default: the free public 0.peerjs.com) and the joiner types it.
   The broker only passes the connection hand-shake; game packets go
   player-to-player (or through the broker's public TURN relay when a network
   blocks direct links). No accounts and no names: each install has an
   anonymous random id in localStorage ('mv2.netId'). Saves stay local.
   Own server later: set window.MV2_NET_CFG={host,port,path,secure,key,
   iceServers} before this file loads (peerjs-server speaks the same protocol).

   Who simulates what:
   - each player simulates their OWN hero (no input lag) and streams it at
     20 Hz; the other hero ("puppet", p2) is drawn from the wire with a 90 ms
     interpolation buffer. Online play runs as _playerCount=1 locally, so the
     camera follows your own hero and the other one can roam (proximity chat).
   - stage-authored enemies (ENEMS[0..base)) are owned by the nearer hero; the
     host decides ownership (with hysteresis). The owner simulates and streams
     them at 12 Hz, the other side mirrors them. A hit on an enemy you do not
     own is sent to its owner (_damageEnemy wrapper) — the owner applies it.
   - stage changes: whoever changed stage last wins (Lamport counter, the host
     wins ties); the other side loads the same stage.

   API (window.MV_NET):
     host()            -> Promise<{code}>   make a room, wait for a friend
     join(code)        -> Promise<{code}>   join a room by its code
     disconnect(), status(), role(), code(), isActive(), isLinked()
     onStatus(cb), onPacket(type, cb), sendPacket(obj)
     tick(p,p2) / applyVisual(p,p2)        main.js hooks (update / draw)
     remote()          -> latest remote hero snapshot (or null)
     peer(), remoteId()                    for mv2_voice.js (media calls)
     joinLink(code)    -> shareable URL that opens the join screen
   ============================================================ */
(function(){
  'use strict';

  var CFG=window.MV2_NET_CFG||{};
  var PREFIX=CFG.prefix||'mv2-room-';
  var ALPHA='ABCDEFGHJKLMNPQRSTUVWXYZ';           // no I / O: they read as 1 / 0
  var CODE_LEN=4;
  var SEND_MS=50, ENEMY_MS=80, RENDER_DELAY_MS=90, BUF_MAX=24, PING_MS=2000;
  var CONNECT_TIMEOUT_MS=15000, OWN_SWAP_PX=160;
  var PUBLIC_URL='https://mindandventure.pauloventura.org/';

  var st={role:null, status:'offline', detail:'', code:'', linked:false, ping:0};
  var toldTimeline=false, lastPhase='offline', remShots=[], remShotAt=0;
  var peer=null, conn=null, connTimer=null, hostTries=0;
  var statusCbs=[], pktCbs={};
  var buf=[], latest=null, hello=null, lastSend=0, lastEnemy=0, lastPing=0;
  var myEpoch=0, lastStage=null, followUntil=0, followEpoch=-1, base=0, baseStage=null;
  var own='', remEn={};                           // ownership string ('0' host / '1' joiner) + mirrored enemy states

  // ---- anonymous local id -------------------------------------------------
  function anonId(){
    var k='mv2.netId', v=null;
    try{ v=localStorage.getItem(k); }catch(e){}
    if(!v||!/^[a-z0-9]{10,}$/.test(v)){
      v=''; for(var i=0;i<16;i++) v+='abcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random()*36));
      try{ localStorage.setItem(k,v); }catch(e){}
    }
    return v;
  }
  var MY_ID=anonId();

  // ---- status ---------------------------------------------------------------
  function status(){
    return {active:!!st.role, linked:st.linked, role:st.role, status:st.status, detail:st.detail,
            code:st.code, ping:st.ping, buffered:buffered(), remoteHero:latest?latest.h:null, remoteStage:latest?latest.st:null,
            phase:phase()};
  }
  function setStatus(s,d){
    st.status=s; st.detail=d||'';
    for(var i=0;i<statusCbs.length;i++){ try{ statusCbs[i](status()); }catch(e){} }
  }
  function onStatus(cb){ if(typeof cb==='function') statusCbs.push(cb); }
  function onPacket(t,cb){ (pktCbs[t]=pktCbs[t]||[]).push(cb); }

  function peerOpts(){
    var o={debug:0};
    ['host','port','path','secure','key'].forEach(function(k){ if(CFG[k]!=null) o[k]=CFG[k]; });
    if(CFG.iceServers) o.config={iceServers:CFG.iceServers};
    return o;
  }
  function normCode(c){
    return String(c==null?'':c).toUpperCase().replace(/[^A-Z]/g,'').replace(/O/g,'').replace(/I/g,'').slice(0,CODE_LEN);
  }
  function newCode(){ var s=''; for(var i=0;i<CODE_LEN;i++) s+=ALPHA.charAt(Math.floor(Math.random()*ALPHA.length)); return s; }
  function joinLink(code){
    var b=PUBLIC_URL;
    try{ if(/^https?:$/.test(location.protocol)&&!/^(localhost|127\.)/.test(location.hostname)) b=location.origin+location.pathname; }catch(e){}
    return b+'?join='+(code||st.code);
  }

  // ---- lifecycle ------------------------------------------------------------
  function resetGame(){
    buf=[]; latest=null; hello=null; own=''; remEn={}; base=0; baseStage=null;
    myEpoch=0; lastStage=null; followUntil=0; followEpoch=-1;
    toldTimeline=false; lastPhase='offline'; remShots=[]; remShotAt=0;
  }
  function dropPuppet(){
    try{ if(typeof p2!=='undefined'&&p2&&p2._netPuppet) p2=null; }catch(e){}
  }
  function closeConn(){
    if(connTimer){ clearTimeout(connTimer); connTimer=null; }
    try{ if(conn) conn.close(); }catch(e){}
    conn=null; st.linked=false; st.ping=0;
    resetGame(); dropPuppet();
  }
  function disconnect(){
    try{ if(conn&&conn.open) conn.send({t:'bye'}); }catch(e){}
    closeConn();
    try{ if(peer) peer.destroy(); }catch(e){}
    peer=null; st.role=null; st.code=''; hostTries=0;
    setStatus('offline','');
  }
  function errText(e){
    var t=e&&e.type;
    if(t==='peer-unavailable') return 'No room with that code. Check the letters with your friend.';
    if(t==='network'||t==='server-error'||t==='socket-error'||t==='socket-closed') return 'Cannot reach the room server. Check your internet.';
    if(t==='browser-incompatible') return 'This browser cannot play online (no WebRTC).';
    if(t==='webrtc') return 'Direct link failed. A strict network or firewall may be blocking it.';
    return (e&&e.message)||String(e||'unknown error');
  }

  function wireConn(c){
    if(conn&&conn.open){                                   // room is full: one friend at a time
      try{ c.on('open',function(){ try{ c.send({t:'full'}); }catch(e){} setTimeout(function(){ try{ c.close(); }catch(e){} },400); }); }catch(e){}
      return;
    }
    closeConn();
    conn=c;
    connTimer=setTimeout(function(){
      if(conn===c&&!st.linked){ setStatus('error','Direct link timed out. A strict network or firewall may be blocking it.'); try{ c.close(); }catch(e){} }
    },CONNECT_TIMEOUT_MS);
    c.on('open',function(){
      if(conn!==c) return;
      if(connTimer){ clearTimeout(connTimer); connTimer=null; }
      st.linked=true; lastPhase='room';
      send({t:'hi', v:2, id:MY_ID, role:st.role, h:heroName()});
      setStatus('connected', st.role==='host'
        ?'In the room. Pick your hero and the stage opens for both.'
        :'In the room. Waiting for the host to start.');
    });
    c.on('data',function(d){ if(conn===c) handle(d); });
    c.on('close',function(){
      if(conn!==c) return;
      var was=st.linked; closeConn();
      if(st.role==='host'){ setStatus('hosting', was?'Your friend left. Room '+st.code+' is still open.':'Waiting for your friend…'); }
      else if(st.role) setStatus('closed', was?'The host left the room.':'Could not connect.');
      if(was) toast(st.role==='host'?'YOUR FRIEND LEFT':'THE HOST LEFT');
    });
    c.on('error',function(e){ if(conn===c) setStatus('error',errText(e)); });
  }

  function makePeer(id){
    if(typeof window.Peer!=='function'){ setStatus('error','Online play did not load (peerjs missing).'); return null; }
    try{ return id?new window.Peer(id,peerOpts()):new window.Peer(peerOpts()); }
    catch(e){ setStatus('error',errText(e)); return null; }
  }

  function host(){
    disconnect();
    st.role='host';
    return new Promise(function(res,rej){
      var tryOne=function(){
        var code=newCode();
        var pr=makePeer(PREFIX+code);
        if(!pr){ st.role=null; return rej(new Error(st.detail)); }
        peer=pr; st.code=code;
        setStatus('opening','Opening room…');
        pr.on('open',function(){ if(peer!==pr) return; hostTries=0; setStatus('hosting','Waiting for your friend…'); res({code:code}); });
        pr.on('connection',function(c){ if(peer===pr) wireConn(c); });
        pr.on('call',function(call){ fire('call',call); });
        pr.on('disconnected',function(){ if(peer===pr&&!pr.destroyed){ try{ pr.reconnect(); }catch(e){} } });
        pr.on('error',function(e){
          if(peer!==pr) return;
          if(e&&e.type==='unavailable-id'&&hostTries++<6){ try{ pr.destroy(); }catch(_e){} peer=null; tryOne(); return; }
          if(e&&e.type==='peer-unavailable') return;          // a voice call to a gone peer: not fatal for the host
          setStatus('error',errText(e));
          if(!st.linked){ st.role=null; rej(e); }
        });
      };
      tryOne();
    });
  }

  function join(code){
    var c=normCode(code);
    if(c.length!==CODE_LEN) return Promise.reject(new Error('Room codes have '+CODE_LEN+' letters.'));
    disconnect();
    st.role='joiner'; st.code=c;
    return new Promise(function(res,rej){
      var pr=makePeer(null);
      if(!pr){ st.role=null; return rej(new Error(st.detail)); }
      peer=pr;
      setStatus('joining','Looking for room '+c+'…');
      pr.on('open',function(){
        if(peer!==pr) return;
        var dc=pr.connect(PREFIX+c,{reliable:true,serialization:'json',metadata:{v:2}});
        wireConn(dc);
        res({code:c});
      });
      pr.on('call',function(call){ fire('call',call); });
      pr.on('disconnected',function(){ if(peer===pr&&!pr.destroyed){ try{ pr.reconnect(); }catch(e){} } });
      pr.on('error',function(e){
        if(peer!==pr) return;
        setStatus('error',errText(e));
        if(!st.linked){ rej(e); }
      });
    });
  }

  // ---- packets --------------------------------------------------------------
  function buffered(){ try{ return conn&&conn.dataChannel?conn.dataChannel.bufferedAmount|0:0; }catch(e){ return 0; } }
  function send(o){ try{ if(conn&&conn.open){ conn.send(o); return true; } }catch(e){} return false; }
  // state packets are replaced 20x a second: drop one rather than queue behind a slow link
  function sendState(o){ if(buffered()>32768) return false; return send(o); }
  function fire(t,pk){ var a=pktCbs[t]; if(a) for(var i=0;i<a.length;i++){ try{ a[i](pk); }catch(e){ console.error('MV_NET '+t,e); } } }
  function handle(pk){
    if(!pk||typeof pk!=='object') return;
    switch(pk.t){
      case 'hi': hello=pk; break;
      case 'full': setStatus('error','That room already has two players.'); try{ conn.close(); }catch(e){} return;
      case 'bye': break;
      case 'ping': send({t:'pong',c:pk.c}); return;
      case 'pong': st.ping=Math.max(0,Date.now()-(+pk.c||0)); fire('ping',st.ping); return;
      case 'p':
        pk._rx=Date.now(); buf.push(pk); if(buf.length>BUF_MAX) buf.shift(); latest=pk;
        break;
      case 'e': onEnemies(pk); break;
      case 'hit': onHit(pk); break;
    }
    fire(pk.t,pk);
  }

  // ---- game glue (globals from the classic scripts, guarded) -----------------
  function B(){ return window.MV_BETA||null; }
  function gs(){ try{ return _gameState; }catch(e){ return null; } }
  function inGame(){ var b=B(); return gs()==='game'&&!!b&&!!b.stageId; }
  function stageId(){ var b=B(); return b?b.stageId:null; }
  function loading(){ var b=B(); return !!(b&&b.loading); }
  function heroName(){ try{ if(typeof p!=='undefined'&&p&&p.hero) return p.hero; return _heroChoice; }catch(e){ return 'mind'; } }
  function toast(m){ try{ if(typeof uiShowToast==='function') uiShowToast(m); }catch(e){} }
  function r1(n){ n=+n; return isFinite(n)?Math.round(n*10)/10:0; }

  // Punch charge (pCharge/pCharging) was already on the wire. Loaded jump / wall cling /
  // sprint charge live on duckCharge+duckBoostReady+wallGrip+_wallChargeReady+runRamp —
  // without them the friend never sees (or mirrors) the spring load on the other hero.
  var HERO_F=['x','y','vx','vy','fc','og','hp','maxHp','item','pt','pCharge','pCharging','crouchAmt','aimDX','aimDY','xlrOn','magOn','inv','hitF','wheelAngle','landF','_sitT','laserCharging','laserCharge',
              'duckCharge','duckBoostReady','wallGrip','_wallChargeReady','_springFloat','runRamp','_skidCharge'];
  var EN_F=['x','y','vx','vy','fc','dir','og','hp','mhp','alive','_mindOff','shutF','_stayDown','_shutCount','_downs','pt','pCharging','pCharge',
            'hitF','flashF','signolState','chargeT','aiMode','item','xlrOn','magOn','crouchAmt','aimDX','aimDY','_rebootFill','inv',
            'laserCharging','laserCharge','_shutSettled','_shorted','wheelAngle','_kbF'];
  function pack(o,F){
    var a=new Array(F.length);
    for(var i=0;i<F.length;i++){ var v=o[F[i]]; a[i]=(typeof v==='number')?r1(v):(typeof v==='boolean'||typeof v==='string')?v:null; }
    return a;
  }
  function unpackInto(o,F,a,skipPos){
    for(var i=0;i<F.length;i++){
      var v=a[i]; if(v===null||v===undefined) continue;
      if(skipPos&&(i<2)) continue;
      o[F[i]]=v;
    }
  }

  function ownedEnemyShots(){
    var out=[];
    if(typeof ESHOTS==='undefined'||typeof ENEMS==='undefined'||!base) return out;
    var m=me();
    for(var i=0;i<ESHOTS.length&&out.length<10;i++){
      var s=ESHOTS[i]; if(!s||s.owner!=='enemy'||!s.src) continue;
      var idx=ENEMS.indexOf(s.src);
      if(idx<0||idx>=base||ownerOf(idx)!==m) continue;
      out.push([r1(s.x),r1(s.y),r1(s.vx),r1(s.vy),s.col||'#ff3355']);
    }
    return out;
  }
  function sc(n){ return (typeof sw==='function')?sw(n):n; }
  function drawExtras(){
    if(typeof ctx==='undefined'||typeof sx!=='function'||!st.linked) return;
    var now=Date.now();
    ctx.save();
    if(remShots.length&&now-remShotAt<400){
      for(var i=0;i<remShots.length;i++){
        var s=remShots[i], x=sx(+s[0]||0), y=sy(+s[1]||0);
        ctx.strokeStyle=s[4]||'#ff3355'; ctx.fillStyle=s[4]||'#ff3355'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-sc((+s[2]||0)*0.4), y-sc((+s[3]||0)*0.4)); ctx.stroke();
        ctx.beginPath(); ctx.arc(x,y,Math.max(2,sc(4)),0,Math.PI*2); ctx.fill();
      }
    }
    var g=(typeof p2!=='undefined'&&p2&&p2._netGear)?p2._netGear:null;
    if(g&&g.b){
      var br=Math.max(4,sc(g.b[2]));
      ctx.strokeStyle='rgba(235,250,255,0.9)'; ctx.lineWidth=Math.max(2,sc(3));
      ctx.beginPath(); ctx.ellipse(sx(g.b[0]),sy(g.b[1]),br,br*1.15,0,0,Math.PI*2); ctx.stroke();
    }
    if(g&&g.c&&g.c[3]>0.05){
      var R=Math.max(6,sc(g.c[2]||12)), cx=sx(g.c[0]), cy=sy(g.c[1]);
      ctx.fillStyle='rgba(80,160,230,0.78)'; ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(235,250,255,0.9)'; ctx.lineWidth=Math.max(1.5,sc(2)); ctx.stroke();
    }
    if(g&&g.w&&g.w[0]>8){
      var wr=Math.max(4,sc(Math.sqrt(g.w[0]/Math.PI)));
      ctx.fillStyle='rgba(110,190,245,0.75)'; ctx.beginPath(); ctx.arc(sx(g.w[1]),sy(g.w[2]),wr,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(235,250,255,0.9)'; ctx.lineWidth=Math.max(1.5,sc(2)); ctx.stroke();
    }
    ctx.restore();
  }
  function heroSnap(actor){
    var b=B()||{};
    var pk={t:'p', a:pack(actor,HERO_F), h:String(actor.hero||'mind'),
            st:b.stageId||null, se:myEpoch, ld:loading()?1:0, gs:gs(), cm:(b.carryMask|0)};
    var hk=actor.hook;
    if(hk&&hk.st&&hk.st!=='idle'){
      pk.hk=[hk.st,r1(hk.ex),r1(hk.ey),r1(hk.ax),r1(hk.ay)];
      pk.rl=r1(hk.rl||0);
      if(hk._plugged) pk.plg=1;
      if(hk.pivots&&hk.pivots.length) pk.pv=hk.pivots.slice(0,8).map(function(q){ return [r1(q.x),r1(q.y)]; });
    }
    if(actor.shots&&actor.shots.length){
      pk.sh=[];
      for(var si=0;si<actor.shots.length&&pk.sh.length<6;si++){
        var s=actor.shots[si]; if(!s) continue;
        pk.sh.push([r1(s.x),r1(s.y),r1(s.vx),r1(s.vy),s.owner||'',s.charged?1:0,s.enhanced?1:0]);
      }
    }
    if(b.magWater&&b.magWater.area>8) pk.gw=[r1(b.magWater.area),r1(b.magWater.x),r1(b.magWater.y)];
    if(b.magCore&&b.magCore.mass>0.05&&!b.magCore.free) pk.gc=[r1(b.magCore.x),r1(b.magCore.y),r1(b.magCore.r),r1(b.magCore.mass),r1(b.magCore.ang||0)];
    if(b.xBub&&b.xBub.r>2) pk.gb=[r1(b.xBub.x),r1(b.xBub.y),r1(b.xBub.r)];
    var es=ownedEnemyShots(); if(es.length) pk.es=es;
    if(actor&&!actor._netPuppet&&typeof ITEM==='number'){
      var ix=HERO_F.indexOf('item');
      if(ix>=0) pk.a[ix]=ITEM;
    }
    return pk;
  }

  // Puppet: the other player's hero, drawn from the wire.
  function ensurePuppet(){
    if(!latest||latest.gs!=='game'||!inGame()||loading()||latest.st!==stageId()||latest.ld){ dropPuppet(); return null; }
    try{
      if(typeof p2!=='undefined'&&p2&&p2._netPuppet) return p2;
      if(typeof mkP!=='function') return null;
      var q=mkP();
      q.hero=latest.h||'venture'; q._aiCompanion=false; q._netPuppet=true;
      q.item=-1; q.xlrOn=false; q.magOn=false;
      unpackInto(q,HERO_F,latest.a,false);
      p2=q; return q;
    }catch(e){ return null; }
  }
  function applyHero(actor){
    if(!actor||!buf.length) return;
    var target=Date.now()-RENDER_DELAY_MS, a=buf[0], b=buf[buf.length-1], k=1;
    for(var i=0;i<buf.length-1;i++){
      if(buf[i]._rx<=target&&buf[i+1]._rx>=target){ a=buf[i]; b=buf[i+1]; break; }
    }
    if(b._rx>a._rx) k=Math.max(0,Math.min(1,(target-a._rx)/(b._rx-a._rx)));
    unpackInto(actor,HERO_F,b.a,true);
    var ax=+a.a[0], ay=+a.a[1], bx=+b.a[0], by=+b.a[1];
    if(Math.abs(bx-ax)>300||Math.abs(by-ay)>300) k=1;                 // respawn / teleport: no slide across the map
    var x=ax+(bx-ax)*k, y=ay+(by-ay)*k;
    if(isFinite(x)&&isFinite(y)){ actor.x=x; actor.y=y; }
    actor.hero=b.h||actor.hero; actor._aiCompanion=false;
    if(b.hk){
      actor.hook=actor.hook||{};
      actor.hook.st=b.hk[0]; actor.hook.ex=b.hk[1]; actor.hook.ey=b.hk[2]; actor.hook.ax=b.hk[3]; actor.hook.ay=b.hk[4];
      actor.hook.rl=+b.rl||0; actor.hook._plugged=!!b.plg; actor.hook._path=null;
      actor.hook.pivots=(b.pv||[]).map(function(q){ return {x:+q[0]||0,y:+q[1]||0}; });
    }else if(actor.hook&&actor.hook.st&&actor.hook.st!=='idle'){ actor.hook.st='idle'; actor.hook.tgt=null; actor.hook.pivots=null; actor.hook._path=null; }
    actor._netShots=(b.sh||[]).map(function(s){ return {x:+s[0]||0,y:+s[1]||0,vx:+s[2]||0,vy:+s[3]||0,owner:s[4]||'',charged:!!s[5],enhanced:!!s[6]}; });
    actor._netGear={w:b.gw||null,c:b.gc||null,b:b.gb||null};
    remShots=b.es||[]; remShotAt=b.es?Date.now():0;
  }

  // In the room = the wire is up. Entering = a stage is loading. In the timeline =
  // both are in play, on the same stage, and neither is still loading it.
  function inTimeline(){
    if(!st.linked||!latest) return false;
    if(latest.gs!=='game'||!inGame()||loading()||latest.ld) return false;
    return !!latest.st&&latest.st===stageId();
  }
  function phase(){
    if(!st.linked) return 'offline';
    if(inTimeline()) return 'timeline';
    if(inGame()||(latest&&latest.gs==='game'&&latest.st)) return 'entering';
    return 'room';
  }
  function notePhase(){
    if(!st.linked){ lastPhase='offline'; return; }
    var p=phase();
    if(p===lastPhase) return;
    lastPhase=p;
    if(p==='timeline'){
      if(!toldTimeline){ toldTimeline=true; toast('IN THE SAME STAGE'); }
      setStatus('connected','In the same stage.');
    }else if(p==='entering'){
      setStatus('connected', st.role==='host'?'Your friend is entering the stage.':'Entering the stage.');
    }else if(p==='room'){
      setStatus('connected', st.role==='host'
        ?'In the room. Pick your hero and the stage opens for both.'
        :'In the room. Waiting for the host to start.');
    }
  }

  // ---- stage follow (Lamport: newest change wins, the host wins ties) --------
  function trackStage(){
    var sid=stageId();
    if(!inGame()||loading()) return;
    if(sid!==lastStage){
      if(followEpoch>=0){ myEpoch=followEpoch; followEpoch=-1; }
      else myEpoch=Math.max(myEpoch,latest?(+latest.se||0):0)+1;
      lastStage=sid;
    }
    if(sid!==baseStage){ baseStage=sid; base=(typeof ENEMS!=='undefined')?ENEMS.length:0; own=''; remEn={}; }
  }
  function maybeFollow(){
    if(!latest||latest.gs!=='game'||!latest.st||latest.ld) return;
    var now=Date.now();
    if(now<followUntil||loading()) return;
    var mine=inGame()?stageId():null;
    if(mine===latest.st) return;
    if(gs()==='splash'){ try{ document.dispatchEvent(new MouseEvent('click',{bubbles:true})); }catch(e){} return; }   // skip the boot logos first
    var pe=+latest.se||0;
    if(mine&&!(pe>myEpoch||(pe===myEpoch&&st.role==='joiner'))) return;
    followUntil=now+2500; followEpoch=pe;
    if(!inGame()) launchJoin(latest.st,latest.cm,latest.h);
    else if(typeof window.startBetaLab==='function') window.startBetaLab(latest.st,latest.cm).catch(function(e){ console.error('net follow load',e); });
  }
  // Enter the friend's stage from the menus (joiner, or a host who left to the title).
  function launchJoin(stage,mask,friendHero){
    try{
      _heroChoice=(friendHero==='mind')?'venture':'mind';
      _playerCount=1;
      if(window.MV_SIBLING) MV_SIBLING.on=false;
      if(window.MV_NET_UI&&MV_NET_UI.isOpen()) MV_NET_UI.hide();
      try{ _stopBGM('title'); _stopBGM('story'); }catch(e){}
      if(typeof _stopAllBgm==='function') _stopAllBgm();
      var b=B();
      if(b){ b.saves={}; b.isoOwned=false; b.popupSeen={}; if(b.newRun) b.newRun(); b.progress=0; b.results=null; b.popup=null; b.trans=null; }
      window.startBetaLab(stage,mask|0,{fresh:true}).catch(function(e){ console.error('net join load',e); });
    }catch(e){ console.error('net launchJoin',e); }
  }

  // ---- enemies: nearer hero owns them, owner streams, the other mirrors ------
  function me(){ return st.role==='host'?'0':'1'; }
  function ownerOf(i){ return own.charAt(i)||'0'; }
  function cx(o){ return (+o.x||0)+(+o.w||64)/2; }
  function cy(o){ return (+o.y||0)+(+o.h||88)/2; }
  function computeOwners(){
    if(st.role!=='host') return;
    var pup=(typeof p2!=='undefined'&&p2&&p2._netPuppet)?p2:null, s='';
    for(var i=0;i<base&&i<ENEMS.length;i++){
      var e=ENEMS[i], cur=ownerOf(i);
      if(!pup||!e){ s+='0'; continue; }
      var dh=Math.hypot(cx(e)-cx(p),cy(e)-cy(p)), dj=Math.hypot(cx(e)-cx(pup),cy(e)-cy(pup));
      if(cur==='0'&&dj<dh-OWN_SWAP_PX) cur='1';
      else if(cur==='1'&&dh<dj-OWN_SWAP_PX) cur='0';
      s+=cur;
    }
    own=s;
  }
  function sendEnemies(){
    if(typeof ENEMS==='undefined'||!base) return;
    var list=[], m=me();
    for(var i=0;i<base&&i<ENEMS.length;i++){
      if(ownerOf(i)!==m) continue;
      var e=ENEMS[i]; if(!e) continue;
      list.push([i,String(e.type||''),pack(e,EN_F)]);
    }
    var pk={t:'e', st:stageId(), n:base, l:list};
    if(st.role==='host') pk.o=own;
    sendState(pk);
  }
  function onEnemies(pk){
    if(!inGame()||pk.st!==stageId()) return;
    if(st.role==='joiner'&&typeof pk.o==='string') own=pk.o;
    var now=Date.now();
    for(var j=0;j<pk.l.length;j++){ var r=pk.l[j]; remEn[r[0]]={ty:r[1],a:r[2],rx:now}; }
  }
  function applyEnemies(){
    if(typeof ENEMS==='undefined'||!base) return;
    var m=me(), now=Date.now();
    for(var i in remEn){
      var idx=+i, r=remEn[i], e=ENEMS[idx];
      if(!e||idx>=base||ownerOf(idx)===m||now-r.rx>700) continue;
      if(String(e.type||'')!==r.ty) continue;
      var tx=+r.a[0], ty=+r.a[1];
      unpackInto(e,EN_F,r.a,true);
      if(isFinite(tx)&&isFinite(ty)){
        if(Math.abs(tx-e.x)>220||Math.abs(ty-e.y)>220){ e.x=tx; e.y=ty; }
        else { e.x+=(tx-e.x)*0.45; e.y+=(ty-e.y)*0.45; }
      }
    }
  }
  function onHit(pk){
    if(!inGame()||pk.st!==stageId()||typeof ENEMS==='undefined') return;
    var e=ENEMS[pk.i];
    if(!e||String(e.type||'')!==pk.ty) return;
    // through the outermost wrapper (gore, lift, knife… chain down to ours, which lets it through)
    remoteHit=true;
    try{ if(typeof window._damageEnemy==='function') window._damageEnemy(e,+pk.d||0,pk.fx,pk.fy,pk.k); }
    finally{ remoteHit=false; }
  }
  var realDamage=window._damageEnemy, remoteHit=false;
  if(typeof realDamage==='function'){
    window._damageEnemy=function(e,dmg,fx,fy,kb){
      try{
        if(!remoteHit&&st.linked&&inGame()&&typeof ENEMS!=='undefined'&&e&&e.alive){
          var i=ENEMS.indexOf(e);
          if(i>=0&&i<base&&ownerOf(i)!==me()&&latest&&latest.st===stageId()){
            send({t:'hit', st:stageId(), i:i, ty:String(e.type||''), d:dmg, fx:fx, fy:fy, k:kb});
            e.hitF=14;                                            // instant feedback here; the owner applies the damage
            try{ if(fx!=null&&fy!=null&&typeof _enemyHitKnock==='function') _enemyHitKnock(e,fx,fy,dmg,kb==null?1:kb); }catch(_e){}
            try{ if(typeof sfx==='function') sfx('ouch',1); }catch(_e){}
            return true;
          }
        }
      }catch(err){}
      return realDamage.apply(this,arguments);
    };
  }

  // ---- per-frame hooks (main.js) ----------------------------------------------
  function tick(pl){
    if(!st.linked) return;
    notePhase();
    var now=Date.now();
    if(now-lastPing>PING_MS){ lastPing=now; send({t:'ping',c:now}); }
    trackStage();
    maybeFollow();
    if(!inGame()||!pl) return;
    var q=ensurePuppet();
    if(q) applyHero(q);
    if(now-lastSend>=SEND_MS){ lastSend=now; sendState(heroSnap(pl)); }
    if(now-lastEnemy>=ENEMY_MS&&!loading()){ lastEnemy=now; computeOwners(); sendEnemies(); }
    applyEnemies();
  }
  function applyVisual(){
    if(!st.linked||!inGame()) return;
    if(typeof p2!=='undefined'&&p2&&p2._netPuppet) applyHero(p2);
    applyEnemies();
  }
  // Outside a stage (title / menus) the main.js update hook does not run: keep
  // the link alive and follow the friend into their stage from here.
  setInterval(function(){
    if(!st.linked||inGame()) return;
    notePhase();
    var now=Date.now();
    if(now-lastPing>PING_MS){ lastPing=now; send({t:'ping',c:now}); }
    if(now-lastSend>=250){ lastSend=now; var b=B()||{}; send({t:'p', a:[], h:heroName(), st:null, se:myEpoch, ld:0, gs:gs(), cm:b.carryMask|0}); }
    if(st.role==='joiner') maybeFollow();
  },120);

  window.MV_NET={
    host:host, join:join, disconnect:disconnect,
    status:status, role:function(){ return st.role; }, code:function(){ return st.code; },
    isActive:function(){ return st.linked; }, isLinked:function(){ return st.linked; },
    inTimeline:inTimeline, phase:phase, drawExtras:drawExtras,
    onStatus:onStatus, onPacket:onPacket, sendPacket:send,
    tick:tick, applyVisual:applyVisual,
    remote:function(){ return latest; }, hello:function(){ return hello; },
    peer:function(){ return peer; },
    remoteId:function(){ return conn?conn.peer:null; },
    owners:function(){ return own; }, base:function(){ return base; },
    joinLink:joinLink, normCode:normCode, CODE_LEN:CODE_LEN, myId:MY_ID
  };
})();
