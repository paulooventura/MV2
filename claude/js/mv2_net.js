/* ============================================================
   mv2_net.js — MV2 online co-op netcode, v3 (Build 444 / T640).

   Cap: MAX 5 peers on one room (host + 4 guests). Star topology:
   guests connect to the host; the host relays state. Seats 0–1 are
   Mind & Venture; seats 2–4 pick crayon colour + session name + hat
   (mv2_identity.js). Voice stays 1:1 for now (TODO multi-voice).

   Transport: PeerJS WebRTC (claude/js/vendor/peerjs.min.js, MIT).
   Saves stay local. Names are session nicknames only.
   Build 444: solo host never looks broken on a failed guest ICE attempt;
   guest retries once; STUN+TURN always set; clearer LAN/code fallback copy.

   Who simulates what (unchanged spirit):
   - each player simulates their OWN hero and streams it at ~20 Hz
   - remotes are puppets (p2 = first remote for 2P compat; extras in
     MV_NET.extras()). Enemy ownership uses nearer hero among present
     seats (chars '0'..'4'). Full 5P combat edge-cases: see TODO below.

   TODO (deferred desync / combat polish):
   - Multi-peer proximity voice mesh (mv2_voice still pairs one remote)
   - Enemy ownership hysteresis with 3+ puppets may thrash on ties
   - Shared world snap floods: host-only snap is fine; guest→guest
     crate races rare but possible under lag
   ============================================================ */
(function(){
  'use strict';

  var ID=window.MV_IDENTITY||null;
  var MAX_PEERS=(ID&&ID.MAX_PEERS)||5;
  var CFG=window.MV2_NET_CFG||{};
  var PREFIX=CFG.prefix||'mv2-room-';
  var ALPHA='ABCDEFGHJKLMNPQRSTUVWXYZ';
  var CODE_LEN=4;
  var SEND_MS=50, ENEMY_MS=80, RENDER_DELAY_MS=90, BUF_MAX=24, PING_MS=2000;
  var CONNECT_TIMEOUT_MS=20000, OWN_SWAP_PX=160;
  var PUBLIC_URL='https://mindandventure.pauloventura.org/';
  // PeerJS cloud defaults — always attach so a blank CFG.iceServers cannot strip TURN.
  var DEFAULT_ICE=[
    {urls:'stun:stun.l.google.com:19302'},
    {urls:'stun:stun1.l.google.com:19302'},
    {urls:['turn:eu-0.turn.peerjs.com:3478','turn:us-0.turn.peerjs.com:3478'],username:'peerjs',credential:'peerjsp'}
  ];

  var st={role:null, status:'offline', detail:'', code:'', linked:false, ping:0};
  var toldTimeline=false, lastPhase='offline', remShots=[], remShotAt=0;
  var peer=null, conns=[], connTimer=null, hostTries=0, joinTries=0;
  var statusCbs=[], pktCbs={};
  var mySeat=0, myIdPack=null, roster={};
  var remotes={}; // seat -> {buf, latest, hello, peerId}
  var lastSend=0, lastEnemy=0, lastPing=0;
  var myEpoch=0, lastStage=null, followUntil=0, followEpoch=-1, base=0, baseStage=null;
  var own='', remEn={};
  var extras=[]; // puppet actors for seats beyond the first remote (p2)

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

  function openConns(){ return conns.filter(function(c){ return c&&c.open; }); }
  function peerCount(){ return 1+openConns().length; } // self + open links (host view) / joiner always 1 link
  function linkedCount(){
    if(st.role==='host') return peerCount();
    return st.linked?Math.max(2, Object.keys(roster).length||2):0;
  }

  function status(){
    return {active:!!st.role, linked:st.linked, role:st.role, status:st.status, detail:st.detail,
            code:st.code, ping:st.ping, buffered:buffered(), remoteHero:primaryLatest()?primaryLatest().h:null,
            remoteStage:primaryLatest()?primaryLatest().st:null, phase:phase(),
            seat:mySeat, peers:linkedCount(), maxPeers:MAX_PEERS, roster:rosterSnapshot()};
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
    var ice=(CFG.iceServers&&CFG.iceServers.length)?CFG.iceServers:DEFAULT_ICE;
    o.config={iceServers:ice, sdpSemantics:'unified-plan'};
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

  function localIdentity(){
    var loc=ID?ID.loadLocal():{name:'',color:'prussian',hat:'gaucho'};
    var hero=heroName();
    if(mySeat<=1){
      return {name:loc.name||(ID?ID.defaultName(mySeat):hero.toUpperCase()), color:loc.color, hat:mySeat===1?'cap':'gaucho', hero:hero};
    }
    return {name:loc.name||(ID?ID.defaultName(mySeat):'RIDER'), color:loc.color, hat:loc.hat||'gaucho', hero:hero};
  }
  function refreshMyPack(){ myIdPack=ID?ID.packId(localIdentity()):{nm:'',col:'prussian',hat:'gaucho',hero:heroName()}; }
  function rosterSnapshot(){
    var out=[];
    Object.keys(roster).forEach(function(k){ out.push(roster[k]); });
    out.sort(function(a,b){ return (a.seat|0)-(b.seat|0); });
    return out;
  }
  function upsertRoster(seat, meta){
    seat=seat|0;
    roster[String(seat)]=Object.assign({seat:seat}, meta||{});
  }
  function takenSeats(){
    var s={}; Object.keys(roster).forEach(function(k){ s[roster[k].seat|0]=1; }); return s;
  }
  function nextSeat(){
    var taken=takenSeats();
    for(var i=0;i<MAX_PEERS;i++) if(!taken[i]) return i;
    return -1;
  }

  function remBucket(seat){
    seat=seat|0;
    if(remotes[-1]) delete remotes[-1];
    if(!remotes[seat]) remotes[seat]={buf:[], latest:null, hello:null, peerId:null};
    return remotes[seat];
  }
  function primaryLatest(){
    var seats=Object.keys(remotes).map(Number).sort(function(a,b){ return a-b; });
    for(var i=0;i<seats.length;i++){
      var L=remotes[seats[i]]&&remotes[seats[i]].latest;
      if(L) return L;
    }
    return null;
  }
  function primaryHello(){
    var seats=Object.keys(remotes).map(Number).sort(function(a,b){ return a-b; });
    for(var i=0;i<seats.length;i++){
      var h=remotes[seats[i]]&&remotes[seats[i]].hello;
      if(h) return h;
    }
    return null;
  }

  function resetGame(){
    remotes={}; remShots=[]; remShotAt=0; own=''; remEn={}; base=0; baseStage=null;
    myEpoch=0; lastStage=null; followUntil=0; followEpoch=-1;
    toldTimeline=false; lastPhase='offline'; extras=[];
  }
  function dropPuppets(){
    try{ if(typeof p2!=='undefined'&&p2&&p2._netPuppet) p2=null; }catch(e){}
    extras=[];
  }
  function closeAllConns(){
    if(connTimer){ clearTimeout(connTimer); connTimer=null; }
    conns.forEach(function(c){ try{ c.close(); }catch(e){} });
    conns=[]; st.linked=false; st.ping=0;
    resetGame(); dropPuppets();
  }
  function disconnect(){
    try{ sendAll({t:'bye', seat:mySeat}); }catch(e){}
    closeAllConns();
    try{ if(peer) peer.destroy(); }catch(e){}
    peer=null; st.role=null; st.code=''; hostTries=0; joinTries=0; mySeat=0; roster={};
    setStatus('offline','');
  }
  function errText(e){
    var t=e&&e.type;
    if(t==='peer-unavailable') return 'No room with that code. Check the letters with your friend.';
    if(t==='network'||t==='server-error'||t==='socket-error'||t==='socket-closed') return 'Cannot reach the room server. Check your internet.';
    if(t==='browser-incompatible') return 'This browser cannot play online (no WebRTC).';
    if(t==='webrtc') return 'Direct link blocked on this network. Try same Wi‑Fi, or type the 4-letter room code.';
    return (e&&e.message)||String(e||'unknown error');
  }
  function hostWaitingCopy(){
    return 'Waiting for friends — share the code, QR, or link. Same Wi‑Fi is most reliable.';
  }
  function guestTimeoutCopy(){
    return 'Could not reach the host. Check the code, try same Wi‑Fi, or ask them to host again.';
  }
  function dropFailedConn(c){
    if(connTimer){ clearTimeout(connTimer); connTimer=null; }
    var ix=conns.indexOf(c);
    if(ix>=0) conns.splice(ix,1);
    var leftSeat=c&&c._mvSeat;
    if(leftSeat!=null){
      delete roster[String(leftSeat)];
      delete remotes[leftSeat];
    }
    try{ if(c) c.close(); }catch(e){}
  }

  function buffered(){
    var n=0;
    openConns().forEach(function(c){ try{ if(c.dataChannel) n=Math.max(n,c.dataChannel.bufferedAmount|0); }catch(e){} });
    return n;
  }
  function sendOne(c,o){ try{ if(c&&c.open){ c.send(o); return true; } }catch(e){} return false; }
  function sendAll(o, except){
    var ok=false;
    openConns().forEach(function(c){ if(c!==except) ok=sendOne(c,o)||ok; });
    return ok;
  }
  function send(o){ return sendAll(o); }
  function sendState(o){ if(buffered()>32768) return false; return send(o); }
  function fire(t,pk){ var a=pktCbs[t]; if(a) for(var i=0;i<a.length;i++){ try{ a[i](pk); }catch(e){ console.error('MV_NET '+t,e); } } }
  function relay(from, pk){
    if(st.role!=='host'||!pk) return;
    sendAll(pk, from);
  }

  function wireConn(c, opts){
    opts=opts||{};
    if(st.role==='host'&&openConns().length>=MAX_PEERS-1){
      try{ c.on('open',function(){ try{ c.send({t:'full', max:MAX_PEERS}); }catch(e){} setTimeout(function(){ try{ c.close(); }catch(e){} },400); }); }catch(e){}
      return;
    }
    if(st.role==='joiner'){ closeAllConns(); }
    conns.push(c);
    if(connTimer){ clearTimeout(connTimer); connTimer=null; }
    connTimer=setTimeout(function(){
      if(conns.indexOf(c)<0||c.open) return;
      // Never leave a half-open DataConnection hanging — PeerJS often skips 'close' if ICE never finished.
      dropFailedConn(c);
      if(st.role==='host'){
        st.linked=openConns().length>0;
        broadcastRoster();
        // Solo host stays healthy: room is open; one failed guest ICE is not a broken lobby.
        setStatus(openConns().length?'connected':'hosting',
          openConns().length
            ?('In the room · '+peerCount()+'/'+MAX_PEERS+'.')
            :('A friend could not reach this room (network). Room '+(st.code||'')+' is still open — have them type the code, or try same Wi‑Fi.'));
        return;
      }
      if(opts.allowRetry&&typeof opts.onRetry==='function'){
        setStatus('joining','Link timed out — trying once more…');
        opts.onRetry();
        return;
      }
      st.linked=false;
      setStatus('error', guestTimeoutCopy());
    },CONNECT_TIMEOUT_MS);
    c.on('open',function(){
      if(conns.indexOf(c)<0) return;
      if(connTimer){ clearTimeout(connTimer); connTimer=null; }
      st.linked=true; lastPhase='room'; joinTries=0;
      refreshMyPack();
      if(st.role==='host'){
        var seat=nextSeat();
        if(seat<0){ try{ c.send({t:'full', max:MAX_PEERS}); }catch(e){} try{ c.close(); }catch(e){} return; }
        c._mvSeat=seat;
        // Reserve the seat immediately so the next guest does not steal it.
        upsertRoster(seat, {id:'pending', role:'joiner', seat:seat, nm:'…', col:'prussian', hat:'gaucho', hero:'mind'});
        upsertRoster(0, Object.assign({id:MY_ID, role:'host'}, myIdPack, {seat:0, hero:heroName()}));
        sendOne(c,{t:'seat', seat:seat, max:MAX_PEERS, roster:rosterSnapshot()});
        setStatus('connected','In the room · '+peerCount()+'/'+MAX_PEERS+'. Pick heroes; extras pick crayon, name and hat.');
      }else{
        // Joiner waits for the host's `seat` packet before sending `hi` (identity + seat).
        setStatus('joining','Linked — waiting for a seat…');
      }
    });
    c.on('data',function(d){ if(conns.indexOf(c)>=0) handle(d,c); });
    c.on('close',function(){
      var ix=conns.indexOf(c); if(ix<0) return;
      conns.splice(ix,1);
      var leftSeat=c._mvSeat;
      if(leftSeat!=null){
        delete roster[String(leftSeat)];
        delete remotes[leftSeat];
      }
      var wasLinked=st.linked;
      // Host keeps the room open with zero guests; linked only when a friend is actually in.
      if(st.role==='host'){
        st.linked=openConns().length>0;
        broadcastRoster();
        setStatus(openConns().length?'connected':'hosting',
          openConns().length
            ?('In the room · '+peerCount()+'/'+MAX_PEERS+'.')
            :(wasLinked?'A friend left. Room '+st.code+' is still open.':hostWaitingCopy()));
        if(wasLinked&&!openConns().length){ dropPuppets(); toast('A FRIEND LEFT'); }
      }else{
        closeAllConns();
        setStatus('closed', wasLinked?'The host left the room.':guestTimeoutCopy());
        if(wasLinked) toast('THE HOST LEFT');
      }
    });
    c.on('error',function(e){
      if(conns.indexOf(c)<0) return;
      if(st.role==='host'&&!c.open){
        // Inbound ICE noise: keep hosting, do not paint the lobby as broken.
        setStatus(openConns().filter(function(x){ return x!==c&&x.open; }).length?'connected':'hosting',
          errText(e)+' Room '+(st.code||'')+' is still open.');
        return;
      }
      setStatus('error',errText(e));
    });
  }

  function broadcastRoster(){
    upsertRoster(mySeat, Object.assign({id:MY_ID, role:st.role}, myIdPack||{}, {seat:mySeat, hero:heroName()}));
    sendAll({t:'roster', roster:rosterSnapshot(), max:MAX_PEERS});
  }

  function makePeer(id){
    if(typeof window.Peer!=='function'){ setStatus('error','Online play did not load (peerjs missing).'); return null; }
    try{ return id?new window.Peer(id,peerOpts()):new window.Peer(peerOpts()); }
    catch(e){ setStatus('error',errText(e)); return null; }
  }

  function host(){
    disconnect();
    st.role='host'; mySeat=0; joinTries=0;
    refreshMyPack();
    upsertRoster(0, Object.assign({id:MY_ID, role:'host'}, myIdPack, {seat:0}));
    return new Promise(function(res,rej){
      var tryOne=function(){
        var code=newCode();
        var pr=makePeer(PREFIX+code);
        if(!pr){ st.role=null; return rej(new Error(st.detail)); }
        peer=pr; st.code=code;
        setStatus('opening','Opening room…');
        pr.on('open',function(){ if(peer!==pr) return; hostTries=0; setStatus('hosting',hostWaitingCopy()); res({code:code}); });
        pr.on('connection',function(c){ if(peer===pr) wireConn(c); });
        pr.on('call',function(call){ fire('call',call); });
        pr.on('disconnected',function(){ if(peer===pr&&!pr.destroyed){ try{ pr.reconnect(); }catch(e){} } });
        pr.on('error',function(e){
          if(peer!==pr) return;
          if(e&&e.type==='unavailable-id'&&hostTries++<6){ try{ pr.destroy(); }catch(_e){} peer=null; tryOne(); return; }
          if(e&&e.type==='peer-unavailable') return;
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
    st.role='joiner'; st.code=c; mySeat=-1; joinTries=0;
    refreshMyPack();
    return new Promise(function(res,rej){
      var pr=makePeer(null);
      if(!pr){ st.role=null; return rej(new Error(st.detail)); }
      peer=pr;
      setStatus('joining','Looking for room '+c+'…');
      var startData=function(allowRetry){
        if(peer!==pr||pr.destroyed) return;
        var dc=pr.connect(PREFIX+c,{reliable:true,serialization:'json',metadata:{v:3}});
        wireConn(dc,{
          allowRetry:!!allowRetry,
          onRetry:function(){
            if(joinTries++>=1){ setStatus('error',guestTimeoutCopy()); return; }
            startData(false);
          }
        });
      };
      pr.on('open',function(){
        if(peer!==pr) return;
        startData(true);
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

  function handle(pk, fromConn){
    if(!pk||typeof pk!=='object') return;
    // Host: the seat it gave this connection wins. A joiner's packets sent before its 'seat'
    // welcome lands carry seat -1; filed as remotes[-1], that stale packet sorted first in
    // primaryLatest(), so the host never saw the joiner enter the stage (flaky race).
    if(st.role==='host'&&fromConn&&fromConn._mvSeat!=null&&fromConn._mvSeat>=0&&(pk.seat==null||(pk.seat|0)<0)) pk.seat=fromConn._mvSeat;
    if(pk.seat!=null&&(pk.seat|0)<0&&pk.t!=='bye') return;
    switch(pk.t){
      case 'seat':
        mySeat=pk.seat|0;
        if(pk.roster) pk.roster.forEach(function(r){ upsertRoster(r.seat,r); });
        refreshMyPack();
        upsertRoster(mySeat, Object.assign({id:MY_ID, role:'joiner'}, myIdPack, {seat:mySeat}));
        send({t:'hi', v:3, id:MY_ID, role:st.role, h:heroName(), seat:mySeat, idp:myIdPack});
        if(ID&&ID.needsCrayon(mySeat)) setStatus('connected','Seat '+(mySeat+1)+' · pick crayon, name and hat, then wait for the host.');
        else setStatus('connected','Seat '+(mySeat+1)+' · waiting for the host to start.');
        break;
      case 'hi':
        (function(){
          var seat=pk.seat!=null?pk.seat|0:(fromConn&&fromConn._mvSeat!=null?fromConn._mvSeat|0:1);
          if(fromConn) fromConn._mvSeat=seat;
          var idp=ID?ID.unpackId(pk.idp||pk):{name:'',color:'prussian',hat:'gaucho',hero:pk.h||'mind'};
          if(!idp.hero) idp.hero=pk.h||'mind';
          upsertRoster(seat, Object.assign({id:pk.id, role:pk.role||'joiner', seat:seat}, ID?ID.packId(idp):{}, {hero:idp.hero}));
          remBucket(seat).hello=pk;
          remBucket(seat).peerId=fromConn?fromConn.peer:null;
          if(st.role==='host'){
            broadcastRoster();
            toast((idp.name||('SEAT '+(seat+1))).toUpperCase()+' JOINED · '+peerCount()+'/'+MAX_PEERS);
          }
        })();
        break;
      case 'roster':
        roster={};
        (pk.roster||[]).forEach(function(r){ upsertRoster(r.seat,r); });
        break;
      case 'id':
        (function(){
          var seat=pk.seat|0;
          var idp=ID?ID.unpackId(pk):{name:pk.nm,color:pk.col,hat:pk.hat,hero:pk.hero};
          upsertRoster(seat, Object.assign({}, roster[String(seat)]||{}, {seat:seat}, ID?ID.packId(idp):{}));
          if(st.role==='host') relay(fromConn, pk);
        })();
        break;
      case 'full':
        setStatus('error','That room is full ('+(pk.max||MAX_PEERS)+' players).');
        try{ if(fromConn) fromConn.close(); }catch(e){}
        return;
      case 'bye': break;
      case 'ping': sendOne(fromConn,{t:'pong',c:pk.c}); return;
      case 'pong': st.ping=Math.max(0,Date.now()-(+pk.c||0)); fire('ping',st.ping); return;
      case 'p':
        (function(){
          var seat=pk.seat!=null?pk.seat|0:1;
          if(seat===mySeat) return;
          pk._rx=Date.now();
          var b=remBucket(seat);
          b.buf.push(pk); if(b.buf.length>BUF_MAX) b.buf.shift();
          b.latest=pk;
          if(pk.idp||pk.nm||pk.col||pk.hat){
            var idp=ID?ID.unpackId(pk.idp||pk):null;
            if(idp) upsertRoster(seat, Object.assign({}, roster[String(seat)]||{}, {seat:seat}, ID.packId(idp)));
          }
          if(st.role==='host') relay(fromConn, pk);
        })();
        break;
      case 'e': onEnemies(pk); if(st.role==='host') relay(fromConn, pk); break;
      case 'hit': onHit(pk); if(st.role==='host') relay(fromConn, pk); break;
      case 'w': onWorld(pk); if(st.role==='host') relay(fromConn, pk); break;
      case 'wreq': sendWorldSnap(); break;
    }
    fire(pk.t,pk);
  }

  function B(){ return window.MV_BETA||null; }
  function gs(){ try{ return _gameState; }catch(e){ return null; } }
  function inGame(){ var b=B(); return gs()==='game'&&!!b&&!!b.stageId; }
  function stageId(){ var b=B(); return b?b.stageId:null; }
  function loading(){ var b=B(); return !!(b&&b.loading); }
  function heroName(){ try{ if(typeof p!=='undefined'&&p&&p.hero) return p.hero; return _heroChoice; }catch(e){ return 'mind'; } }
  function toast(m){ try{ if(typeof uiShowToast==='function') uiShowToast(m); }catch(e){} }
  function r1(n){ n=+n; return isFinite(n)?Math.round(n*10)/10:0; }

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
    // nameplates for local + remotes
    try{
      if(typeof p!=='undefined'&&p&&ID){ if(!p._netName&&myIdPack) ID.applyToActor(p, ID.unpackId(myIdPack)); ID.drawNameplate(p); }
      if(typeof p2!=='undefined'&&p2&&ID) ID.drawNameplate(p2);
      extras.forEach(function(ex){ if(ID) ID.drawNameplate(ex); });
    }catch(e){}
  }

  function heroSnap(actor){
    var b=B()||{};
    refreshMyPack();
    var pk={t:'p', a:pack(actor,HERO_F), h:String(actor.hero||'mind'),
            st:b.stageId||null, se:myEpoch, ld:loading()?1:0, gs:gs(), cm:(b.carryMask|0),
            seat:mySeat, idp:myIdPack};
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

  function applyIdentity(actor, pk, seat){
    if(!actor) return;
    var fromRoster=roster[String(seat)]||{};
    var idp=ID?ID.unpackId(pk&&pk.idp?pk.idp:fromRoster):null;
    if(ID&&idp) ID.applyToActor(actor, idp);
    else{
      actor._netName=fromRoster.nm||'';
      actor.hatStyle=fromRoster.hat||(actor.hero==='venture'?'cap':'gaucho');
    }
    actor._netSeat=seat;
  }

  function ensurePuppetFor(seat, latest){
    if(!latest||latest.gs!=='game'||!inGame()||loading()||latest.st!==stageId()||latest.ld) return null;
    if(seat===mySeat) return null;
    try{
      // First remote seat keeps classic p2 for 2P probes / HUD.
      var seats=Object.keys(remotes).map(Number).filter(function(s){ return s!==mySeat&&remotes[s]&&remotes[s].latest; }).sort(function(a,b){ return a-b; });
      var primary=seats[0];
      if(seat===primary){
        if(typeof p2!=='undefined'&&p2&&p2._netPuppet&&p2._netSeat===seat) return p2;
        if(typeof mkP!=='function') return null;
        var q=mkP();
        q.hero=latest.h||'venture'; q._aiCompanion=false; q._netPuppet=true; q._netSeat=seat;
        q.item=-1; q.xlrOn=false; q.magOn=false;
        unpackInto(q,HERO_F,latest.a,false);
        applyIdentity(q, latest, seat);
        p2=q; return q;
      }
      // Extra seats → extras[]
      var found=null;
      for(var i=0;i<extras.length;i++) if(extras[i]&&extras[i]._netSeat===seat){ found=extras[i]; break; }
      if(found) return found;
      if(typeof mkP!=='function') return null;
      var x=mkP();
      x.hero=latest.h||'mind'; x._aiCompanion=false; x._netPuppet=true; x._netSeat=seat; x._netExtra=true;
      x.item=-1; x.xlrOn=false; x.magOn=false;
      unpackInto(x,HERO_F,latest.a,false);
      applyIdentity(x, latest, seat);
      extras.push(x);
      return x;
    }catch(e){ return null; }
  }
  function pruneExtras(activeSeats){
    extras=extras.filter(function(ex){ return ex&&activeSeats[ex._netSeat]; });
    try{
      if(typeof p2!=='undefined'&&p2&&p2._netPuppet&&!activeSeats[p2._netSeat]) p2=null;
    }catch(e){}
  }
  function applyHero(actor, bucket){
    if(!actor||!bucket||!bucket.buf.length) return;
    var buf=bucket.buf, target=Date.now()-RENDER_DELAY_MS, a=buf[0], b=buf[buf.length-1], k=1;
    for(var i=0;i<buf.length-1;i++){
      if(buf[i]._rx<=target&&buf[i+1]._rx>=target){ a=buf[i]; b=buf[i+1]; break; }
    }
    if(b._rx>a._rx) k=Math.max(0,Math.min(1,(target-a._rx)/(b._rx-a._rx)));
    unpackInto(actor,HERO_F,b.a,true);
    var ax=+a.a[0], ay=+a.a[1], bx=+b.a[0], by=+b.a[1];
    if(Math.abs(bx-ax)>300||Math.abs(by-ay)>300) k=1;
    var x=ax+(bx-ax)*k, y=ay+(by-ay)*k;
    if(isFinite(x)&&isFinite(y)){ actor.x=x; actor.y=y; }
    actor.hero=b.h||actor.hero; actor._aiCompanion=false;
    applyIdentity(actor, b, actor._netSeat);
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

  function inTimeline(){
    if(!st.linked||!primaryLatest()) return false;
    var latest=primaryLatest();
    if(latest.gs!=='game'||!inGame()||loading()||latest.ld) return false;
    return !!latest.st&&latest.st===stageId();
  }
  function phase(){
    if(!st.linked) return 'offline';
    if(inTimeline()) return 'timeline';
    var latest=primaryLatest();
    if(inGame()||(latest&&latest.gs==='game'&&latest.st)) return 'entering';
    return 'room';
  }
  function notePhase(){
    if(!st.linked){ lastPhase='offline'; return; }
    var p0=phase();
    if(p0===lastPhase) return;
    lastPhase=p0;
    if(p0==='timeline'){
      if(!toldTimeline){ toldTimeline=true; toast('IN THE SAME STAGE'); }
      setStatus('connected','In the same stage · '+linkedCount()+'/'+MAX_PEERS+'.');
      try{ send({t:'wreq'}); if(st.role==='host') sendWorldSnap(); }catch(e){}
    }else if(p0==='entering'){
      setStatus('connected', st.role==='host'?'Friends are entering the stage.':'Entering the stage.');
    }else if(p0==='room'){
      setStatus('connected', st.role==='host'
        ?('In the room · '+peerCount()+'/'+MAX_PEERS+'. Pick your hero; seats 3–5 pick crayon, name and hat.')
        :'In the room. Waiting for the host to start.');
    }
  }

  function trackStage(){
    var sid=stageId();
    if(!inGame()||loading()) return;
    if(sid!==lastStage){
      if(followEpoch>=0){ myEpoch=followEpoch; followEpoch=-1; }
      else myEpoch=Math.max(myEpoch,primaryLatest()?(+primaryLatest().se||0):0)+1;
      lastStage=sid;
    }
    if(sid!==baseStage){ baseStage=sid; base=(typeof ENEMS!=='undefined')?ENEMS.length:0; own=''; remEn={}; }
  }
  function maybeFollow(){
    var latest=primaryLatest();
    if(!latest||latest.gs!=='game'||!latest.st||latest.ld) return;
    var now=Date.now();
    if(now<followUntil||loading()) return;
    var mine=inGame()?stageId():null;
    if(mine===latest.st) return;
    if(gs()==='splash'){ try{ document.dispatchEvent(new MouseEvent('click',{bubbles:true})); }catch(e){} return; }
    var pe=+latest.se||0;
    if(mine&&!(pe>myEpoch||(pe===myEpoch&&st.role==='joiner'))) return;
    followUntil=now+2500; followEpoch=pe;
    if(!inGame()) launchJoin(latest.st,latest.cm,latest.h);
    else if(typeof window.startBetaLab==='function') window.startBetaLab(latest.st,latest.cm).catch(function(e){ console.error('net follow load',e); });
  }
  function launchJoin(stage,mask,friendHero){
    try{
      if(mySeat<=1){
        _heroChoice=(friendHero==='mind')?'venture':'mind';
      }else{
        var loc=ID?ID.loadLocal():{};
        _heroChoice=(ID?ID.defaultHeroForSeat(mySeat):'mind');
      }
      _playerCount=1;
      if(window.MV_SIBLING) MV_SIBLING.on=false;
      if(window.MV_NET_UI&&MV_NET_UI.isOpen()) MV_NET_UI.hide();
      try{ _stopBGM('title'); _stopBGM('story'); }catch(e){}
      if(typeof _stopAllBgm==='function') _stopAllBgm();
      var b=B();
      if(b){ b.saves={}; b.isoOwned=false; b.popupSeen={}; if(b.newRun) b.newRun(); b.progress=0; b.results=null; b.popup=null; b.trans=null; }
      window.startBetaLab(stage,mask|0,{fresh:true}).then(function(){
        try{ if(typeof p!=='undefined'&&p&&ID) ID.applyToActor(p, localIdentity()); }catch(e){}
      }).catch(function(e){ console.error('net join load',e); });
    }catch(e){ console.error('net launchJoin',e); }
  }

  function me(){ return String(mySeat|0); }
  function ownerOf(i){ return own.charAt(i)||'0'; }
  function cx(o){ return (+o.x||0)+(+o.w||64)/2; }
  function cy(o){ return (+o.y||0)+(+o.h||88)/2; }
  function allHeroes(){
    var list=[];
    try{ if(typeof p!=='undefined'&&p) list.push({seat:mySeat, pl:p}); }catch(e){}
    try{ if(typeof p2!=='undefined'&&p2&&p2._netPuppet) list.push({seat:p2._netSeat|0, pl:p2}); }catch(e){}
    extras.forEach(function(ex){ if(ex) list.push({seat:ex._netSeat|0, pl:ex}); });
    return list;
  }
  function computeOwners(){
    if(st.role!=='host') return;
    var heroes=allHeroes(), s='';
    for(var i=0;i<base&&i<ENEMS.length;i++){
      var e=ENEMS[i], cur=ownerOf(i);
      if(!e||heroes.length<2){ s+=cur||'0'; continue; }
      var best=cur, bestD=1e12, curD=1e12;
      for(var h=0;h<heroes.length;h++){
        var d=Math.hypot(cx(e)-cx(heroes[h].pl),cy(e)-cy(heroes[h].pl));
        var sk=String(heroes[h].seat|0);
        if(sk===cur) curD=d;
        if(d<bestD){ bestD=d; best=sk; }
      }
      if(best!==cur&&bestD<curD-OWN_SWAP_PX) cur=best;
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
    var pk={t:'e', st:stageId(), n:base, l:list, seat:mySeat};
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
          var latest=primaryLatest();
          if(i>=0&&i<base&&ownerOf(i)!==me()&&latest&&latest.st===stageId()){
            send({t:'hit', st:stageId(), i:i, ty:String(e.type||''), d:dmg, fx:fx, fy:fy, k:kb, seat:mySeat});
            e.hitF=14;
            try{ if(fx!=null&&fy!=null&&typeof _enemyHitKnock==='function') _enemyHitKnock(e,fx,fy,dmg,kb==null?1:kb); }catch(_e){}
            try{ if(typeof sfx==='function') sfx('ouch',1); }catch(_e){}
            return true;
          }
        }
      }catch(err){}
      return realDamage.apply(this,arguments);
    };
  }

  var lastWorldSnap=0, WORLD_SNAP_MS=700, applyingWorld=false;
  function emitWorld(ev){
    if(!st.linked||!inGame()||!ev||applyingWorld) return false;
    ev.t='w'; ev.st=stageId(); ev.seat=mySeat;
    return send(ev);
  }
  function onWorld(pk){
    if(!inGame()||!pk||pk.st!==stageId()) return;
    applyingWorld=true;
    try{
      if(window.MV_NET) window.MV_NET._applyingWorld=true;
      if(pk.kind==='door'&&window.MV_DOORS&&MV_DOORS.netApplyDoor) MV_DOORS.netApplyDoor(pk);
      else if(pk.kind==='trap'&&window.MV_DOORS&&MV_DOORS.netApplyTrap) MV_DOORS.netApplyTrap(pk);
      else if(pk.kind==='crate'&&window.MV_BETA&&MV_BETA.netApplyCrate) MV_BETA.netApplyCrate(pk);
      else if(pk.kind==='crateTake'&&window.MV_BETA&&MV_BETA.netApplyCrateTake) MV_BETA.netApplyCrateTake(pk);
      else if(pk.kind==='snap'){
        if(pk.doors&&window.MV_DOORS&&MV_DOORS.netApplyDoor) for(var i=0;i<pk.doors.length;i++) MV_DOORS.netApplyDoor(pk.doors[i]);
        if(pk.traps&&window.MV_DOORS&&MV_DOORS.netApplyTrap) for(var j=0;j<pk.traps.length;j++) MV_DOORS.netApplyTrap(pk.traps[j]);
        if(pk.crates&&window.MV_BETA&&MV_BETA.netApplyCrate) for(var k=0;k<pk.crates.length;k++) MV_BETA.netApplyCrate(pk.crates[k]);
      }
    }catch(e){ console.warn('net world',e); }
    finally{ applyingWorld=false; if(window.MV_NET) window.MV_NET._applyingWorld=false; }
  }
  function packCrateSnap(){
    var out=[];
    if(typeof ITEM_DROPS==='undefined') return out;
    for(var i=0;i<ITEM_DROPS.length&&out.length<24;i++){
      var d=ITEM_DROPS[i]; if(!d||!d._box) continue;
      var b=d._box, its=(b.items&&b.items.length)?b.items:(b.item?[b.item]:[]);
      out.push({kind:'crate', cell:d._cell||null, item:d.item, hp:b.hp|0, broken:!!b.broken, dual:!!d.dual,
        items:its.map(function(it){ return {x:r1(it.x),y:r1(it.y),vx:r1(it.vx),vy:r1(it.vy),taken:!!it.taken,noPick:it.noPick|0}; })});
    }
    return out;
  }
  function sendWorldSnap(){
    if(!st.linked||!inGame()||loading()) return;
    var snap={t:'w', kind:'snap', st:stageId(), crates:packCrateSnap(), seat:mySeat};
    if(window.MV_DOORS&&MV_DOORS.netSnap){ var ds=MV_DOORS.netSnap(); snap.doors=ds.doors; snap.traps=ds.traps; }
    send(snap);
  }

  function syncPuppets(){
    var active={}, seats=Object.keys(remotes).map(Number);
    for(var i=0;i<seats.length;i++){
      var seat=seats[i], bucket=remotes[seat];
      if(!bucket||!bucket.latest||seat===mySeat) continue;
      var pup=ensurePuppetFor(seat, bucket.latest);
      if(pup){ active[seat]=1; applyHero(pup, bucket); }
    }
    pruneExtras(active);
  }

  function tick(pl){
    if(!st.linked&&!(st.role==='host'&&st.code)) return;
    if(!st.linked) return;
    notePhase();
    var now=Date.now();
    if(now-lastPing>PING_MS){ lastPing=now; send({t:'ping',c:now}); }
    trackStage();
    maybeFollow();
    if(!inGame()||!pl) return;
    // apply local identity once in-stage
    try{ if(ID&&pl&&!pl._netPuppet) ID.applyToActor(pl, localIdentity()); }catch(e){}
    syncPuppets();
    if(now-lastSend>=SEND_MS&&mySeat>=0){ lastSend=now; sendState(heroSnap(pl)); }
    if(now-lastEnemy>=ENEMY_MS&&!loading()){ lastEnemy=now; computeOwners(); sendEnemies(); }
    if(now-lastWorldSnap>=WORLD_SNAP_MS&&!loading()&&inTimeline()){ lastWorldSnap=now; if(st.role==='host') sendWorldSnap(); }
    applyEnemies();
  }
  function applyVisual(){
    if(!st.linked||!inGame()) return;
    syncPuppets();
    applyEnemies();
  }

  setInterval(function(){
    if(!st.linked||inGame()) return;
    notePhase();
    var now=Date.now();
    if(now-lastPing>PING_MS){ lastPing=now; send({t:'ping',c:now}); }
    if(now-lastSend>=250){ lastSend=now; refreshMyPack(); var b=B()||{}; send({t:'p', a:[], h:heroName(), st:null, se:myEpoch, ld:0, gs:gs(), cm:b.carryMask|0, seat:mySeat, idp:myIdPack}); }
    if(st.role==='joiner') maybeFollow();
  },120);

  function setIdentity( partial){
    var loc=ID?ID.loadLocal():{};
    if(partial){
      if(partial.name!=null) loc.name=ID?ID.cleanName(partial.name):String(partial.name||'');
      if(partial.color) loc.color=partial.color;
      if(partial.hat) loc.hat=partial.hat;
    }
    if(ID) ID.saveLocal(loc);
    refreshMyPack();
    upsertRoster(mySeat, Object.assign({id:MY_ID, role:st.role, seat:mySeat, hero:heroName()}, myIdPack));
    send({t:'id', seat:mySeat, idp:myIdPack});
    try{ if(typeof p!=='undefined'&&p&&!p._netPuppet&&ID) ID.applyToActor(p, localIdentity()); }catch(e){}
    setStatus(st.status, st.detail);
    return localIdentity();
  }

  window.MV_NET={
    host:host, join:join, disconnect:disconnect,
    status:status, role:function(){ return st.role; }, code:function(){ return st.code; },
    isActive:function(){ return st.linked; }, isLinked:function(){ return st.linked; },
    inTimeline:inTimeline, phase:phase, drawExtras:drawExtras,
    onStatus:onStatus, onPacket:onPacket, sendPacket:send,
    tick:tick, applyVisual:applyVisual,
    emitWorld:emitWorld, _applyingWorld:false,
    remote:function(){ return primaryLatest(); }, hello:function(){ return primaryHello(); },
    peer:function(){ return peer; },
    // voice still pairs the first open conn (TODO multi-voice)
    remoteId:function(){ var o=openConns(); return o[0]?o[0].peer:null; },
    owners:function(){ return own; }, base:function(){ return base; },
    joinLink:joinLink, normCode:normCode, CODE_LEN:CODE_LEN, myId:MY_ID,
    MAX_PEERS:MAX_PEERS, seat:function(){ return mySeat; },
    roster:rosterSnapshot, extras:function(){ return extras.slice(); },
    identity:localIdentity, setIdentity:setIdentity,
    peerCount:linkedCount
  };
})();
