// ============================================================
//  Mind & Venture — selftest.js   (automated bot + glitch catcher)
//
//  GATED: ?selftest=1, sessionStorage mv_selftest, or MV_SELFTEST.start()
// ============================================================
(function(){
  var ENABLED = /[?&]selftest/i.test(location.search)
    || window.MV_SELFTEST_AUTOSTART
    || sessionStorage.getItem('mv_selftest')==='1'
    || window.__MV_FORCE_SELFTEST;

  function stub(){ window.MV_SELFTEST = window.MV_SELFTEST || { start: boot, stop: stop }; }
  if(!ENABLED){ stub(); return; }

  var CI = /[?&]ci/i.test(location.search);
  var QUICK = /[?&]quick/i.test(location.search);
  var RUN_FRAMES = QUICK ? 1200 : (CI ? 1800 : 3600);
  var CAP_PER_TYPE = 25;
  var SLOW_MS = 12;
  var JITTER_TOL = 0.6;
  var STUCK_DX = 6;
  var STUCK_WIN = 60;
  var MENU_TICK_MS = CI ? 280 : 420;

  var armed=false, running=false, lf=0, t0=0, lastMenu=0;
  var _orig=null, _origDraw=null, _origReadGP=null, renderFrames=0;
  var violations={}, perf={maxUpdateMs:0, slowFrames:0};
  var phaseIdx=0, phaseFrame=0, jumpHold=0, baselineY=null, idleMaxDev=0;
  var xHist=[];

  // Start walking immediately so it's obvious the bot is driving.
  var PHASES=[
    {name:'walkR', dur:120},
    {name:'idle',  dur:30},
    {name:'walkR', dur:420},
    {name:'crouch',dur:50},
    {name:'walkR', dur:520},
    {name:'walkR', dur:480},
    {name:'jumpR', dur:120},
    {name:'walkR', dur:360},
    {name:'walkR', dur:300}
  ];

  function bind(name, fallback){
    try{
      if(typeof OPT!=='undefined' && OPT.binds && OPT.binds[name] && OPT.binds[name][0])
        return OPT.binds[name][0];
    }catch(e){}
    return fallback;
  }
  function codes(){
    return {
      L: bind('left','KeyA'), R: bind('right','KeyD'),
      D: bind('down','KeyS'), J: bind('jump','Space')
    };
  }

  function rec(type, extra){
    var arr = violations[type] || (violations[type]=[]);
    if(arr.length>=CAP_PER_TYPE){ arr._more=(arr._more||0)+1; return; }
    var pl = (typeof p!=='undefined')?p:null;
    var s = { f: lf };
    if(pl){ s.x=Math.round(pl.x); s.y=Math.round(pl.y); s.vx=+(pl.vx||0).toFixed(2); s.vy=+(pl.vy||0).toFixed(2); s.og=!!pl.og; }
    if(extra) for(var k in extra) s[k]=extra[k];
    arr.push(s);
  }

  function solids(){
    try{ if(typeof allP==='function') return allP().filter(function(q){return q.tp==='solid';}); }catch(e){}
    return [];
  }

  function checkCampaignContent(){
    if(lf!==120) return;
    if(typeof _mapRopePickup==='undefined'||!_mapRopePickup) rec('rcaMissing',{});
    if(typeof _spawnX==='number'){
      var sc=(typeof TILED_WORLD_SCALE!=='undefined'?TILED_WORLD_SCALE:4);
      var spawnCol=Math.floor((_spawnX+(typeof SW!=='undefined'?SW:64)*0.5)/(8*sc));
      if(spawnCol<28||spawnCol>34) rec('spawnNotHouse2',{col:spawnCol});
    }
    if(typeof GOALPL!=='undefined'&&GOALPL.x!=null&&GOALPL.x<2800) rec('goalNotHouse5',{x:GOALPL.x});
  }

  function checkOmniblockCorner(){
    if(lf<400||lf%30!==0) return;
    var pl=(typeof p!=='undefined')?p:null;
    if(!pl) return;
    var FO=(typeof FEET_OFF!=='undefined')?FEET_OFF:88;
    var feet=pl.y+FO;
    if(pl.x<860||pl.x>980||feet<2380||feet>2460) return;
    if((pl._grindF||0)>=3&&Math.abs(pl.vx||0)>1.5) rec('omniblockCorner',{x:Math.round(pl.x),y:Math.round(pl.y),feet:Math.round(feet),vx:+(pl.vx||0).toFixed(2),grind:pl._grindF});
  }

  function checkBasementReach(){
    if(lf!==1100 && lf!==RUN_FRAMES-1) return;
    if(typeof _mapRopePickup==='undefined'||!_mapRopePickup) return;
    var r=_mapRopePickup, pl=(typeof p!=='undefined')?p:null;
    if(!pl||!r) return;
    var rx=r.x+(r.w||0)*0.5, ry=r.y+(r.h||0)*0.5;
    var FO=(typeof FEET_OFF!=='undefined')?FEET_OFF:88;
    var px=pl.x+(typeof SW!=='undefined'?SW:64)*0.5, py=pl.y+FO;
    var dist=Math.hypot(px-rx, py-ry);
    if(Math.abs(px-rx)>96) rec('basementUnreachable',{dist:Math.round(dist), reason:'horizontal', px:Math.round(pl.x), py:Math.round(pl.y), rx:Math.round(rx), ry:Math.round(ry)});
    else if(py<ry-420) rec('basementUnreachable',{dist:Math.round(dist), reason:'vertical', px:Math.round(pl.x), py:Math.round(pl.y), rx:Math.round(rx), ry:Math.round(ry)});
  }

  function checkInvariants(phase){
    var pl=(typeof p!=='undefined')?p:null;
    if(!pl) return;
    var FO=(typeof FEET_OFF!=='undefined')?FEET_OFF:88;
    if(!Number.isFinite(pl.x)||!Number.isFinite(pl.y)){ rec('nonFinite'); return; }
    if(!Number.isFinite(pl.vx)||!Number.isFinite(pl.vy)){ rec('nonFinite'); return; }
    if(typeof WH!=='undefined' && pl.y+FO > WH+200) rec('fellOutOfWorld');
    if(pl._wasOg && !pl.og && (pl.vy||0)>0.45 && Math.abs(pl.vx||0)<9){
      var wt0=null;
      try{ if(typeof _wallTouchInfo==='function') wt0=_wallTouchInfo(pl); }catch(e){}
      if(!wt0||!wt0.touch) rec('airLaunch',{vy:+(pl.vy||0).toFixed(2), vx:+(pl.vx||0).toFixed(2)});
    }
    pl._wasOg=!!pl.og;
    if(pl._prevCheckY!=null && pl.og && Math.abs(pl.y-pl._prevCheckY)>10 && Math.abs(pl.vy||0)<0.6){
      rec('groundSnap',{dy:Math.round(pl.y-pl._prevCheckY)});
    }
    pl._prevCheckY=pl.y;
    try{
      if(typeof playerCoreHB==='function'){
        var b=playerCoreHB(pl), bx=b.x+b.w/2, by=b.y+b.h/2, S=solids();
        for(var i=0;i<S.length;i++){
          var r=S[i];
          if(bx>r.x+2 && bx<r.x+r.w-2 && by>r.y+2 && by<r.y+r.h-2){
            rec('wallClip', {depth:Math.round(Math.min(bx-r.x, r.x+r.w-bx, by-r.y, r.y+r.h-by))});
            break;
          }
        }
      }
    }catch(e){}
    if(phase==='idle' && pl.og && (pl._grindF||0)<1 && Math.abs(pl.vy||0)<0.25){
      if(baselineY==null && phaseFrame>12) baselineY=pl.y;
      if(baselineY!=null){
        const step=Math.abs(pl.y-(pl._idlePrevY??pl.y));
        if(step>10){ baselineY=pl.y; }
        else{
          const dev=Math.abs(pl.y-baselineY);
          if(dev>idleMaxDev) idleMaxDev=dev;
          if(dev>JITTER_TOL && dev<6) rec('idleJitter',{dev:+dev.toFixed(2)});
        }
      }
      pl._idlePrevY=pl.y;
    }else{ baselineY=null; pl._idlePrevY=undefined; }
    if((phase==='walkR'||phase==='walkL'||phase==='jumpR'||phase==='jumpL') && pl.og){
      xHist.push(pl.x); if(xHist.length>STUCK_WIN) xHist.shift();
      if(xHist.length===STUCK_WIN){
        var dx=Math.abs(pl.x-xHist[0]);
        var atEdge = (typeof WW!=='undefined') && (pl.x<6 || pl.x>WW-64);
        var pushing=(phase.indexOf('R')>=0&&K[codes().R])||(phase.indexOf('L')>=0&&K[codes().L]);
        var grinding=((pl._grindF||0)>=4)||(pushing && Math.abs(pl.vx||0)>1.8 && dx<3);
        if(grinding && !atEdge && dx<STUCK_DX && Math.abs(pl.vy||0)<0.5) rec('stuckWalking',{dir:(phase.indexOf('R')>=0?'right':'left'), dx:Math.round(dx), vx:+(pl.vx||0).toFixed(2)});
      }
    }else xHist.length=0;
  }

  function driveInput(phase){
    var c=codes();
    K[c.L]=false; K[c.R]=false; K[c.D]=false;
    if(jumpHold>0){ K[c.J]=true; jumpHold--; } else { K[c.J]=false; }
    var pl=(typeof p!=='undefined')?p:null;
    var r=(typeof _mapRopePickup!=='undefined')?_mapRopePickup:null;
    if(pl&&r&&lf>280){
      var FO=(typeof FEET_OFF!=='undefined')?FEET_OFF:88;
      var SWid=(typeof SW!=='undefined')?SW:64;
      var rx=r.x+(r.w||0)*0.5, ry=r.y+(r.h||0)*0.5;
      var px=pl.x+SWid*0.5, py=pl.y+FO;
      if(Math.abs(px-rx)<52 && py<ry-72){
        if(phaseFrame%110<58) K[c.R]=true;
        else K[c.L]=true;
        if(phaseFrame%64===0){ Kj[c.J]=true; K[c.J]=true; jumpHold=6; }
        try{
          var pk=bind('punch','KeyF');
          if(phaseFrame%28===0) Kj[pk]=true;
        }catch(e){}
      }else if(py<ry-80){
        if(px>rx+40) K[c.L]=true;
        else if(px<rx-24) K[c.R]=true;
        else K[c.R]=true;
      }else if(px<rx-16) K[c.R]=true;
      else if(px>rx+16) K[c.L]=true;
      if(phase==='crouch') K[c.D]=true;
      if((phase==='jumpR'||phase==='jumpL') && phaseFrame>0 && phaseFrame%48===0){
        Kj[c.J]=true; K[c.J]=true; jumpHold=8;
      }
      return;
    }
    if(phase==='walkR'||phase==='jumpR') K[c.R]=true;
    if(phase==='walkL'||phase==='jumpL') K[c.L]=true;
    if(phase==='crouch') K[c.D]=true;
    if((phase==='jumpR'||phase==='jumpL') && phaseFrame>0 && phaseFrame%48===0){
      Kj[c.J]=true; K[c.J]=true; jumpHold=8;
    }
  }

  function curPhase(){ return PHASES[phaseIdx % PHASES.length]; }
  function advancePhase(){
    phaseFrame++;
    if(phaseFrame >= curPhase().dur){
      phaseIdx++; phaseFrame=0; baselineY=null; idleMaxDev=0; xHist.length=0;
    }
  }

  function hud(extra){
    var ph=curPhase();
    var c=codes();
    var keys=(K[c.R]?'R':'')+(K[c.L]?'L':'')+(K[c.D]?'D':'')+(K[c.J]?'J':'')||'-';
    overlay(
      'SELF-TEST RUNNING\n'+
      'phase '+ph.name+'  '+phaseFrame+'/'+ph.dur+'  keys '+keys+'\n'+
      'logic frame '+lf+' / '+RUN_FRAMES+
      (extra?'\n'+extra:'')
    );
  }

  function wrappedReadGamepad(){
    if(running) driveInput(curPhase().name);
    else if(_origReadGP) _origReadGP();
  }

  function wrappedUpdate(){
    var ph=curPhase().name;
    driveInput(ph);
    var ts=(typeof performance!=='undefined')?performance.now():Date.now();
    try{ _orig(); }
    catch(err){ rec('updateException',{msg:String(err&&err.message||err)}); }
    var dt=((typeof performance!=='undefined')?performance.now():Date.now())-ts;
    if(dt>perf.maxUpdateMs) perf.maxUpdateMs=+dt.toFixed(2);
    if(dt>SLOW_MS) perf.slowFrames++;
    try{ checkInvariants(ph); checkCampaignContent(); checkBasementReach(); checkOmniblockCorner(); }catch(e){}
    if(typeof p!=='undefined'&&p&&(p._grindF||0)>=4&&phaseFrame>36){
      phaseIdx++; phaseFrame=0; baselineY=null; idleMaxDev=0; xHist.length=0;
    }else advancePhase();
    lf++;
    if(lf%12===0) hud();
    if(lf>=RUN_FRAMES) finish();
  }

  function wrappedDraw(){ renderFrames++; try{ _origDraw(); }catch(e){} }

  function overlay(txt, color){
    var d=document.getElementById('mvSelfTestHud');
    if(!d){
      d=document.createElement('div'); d.id='mvSelfTestHud';
      d.style.cssText='position:fixed;left:6px;top:6px;z-index:99999;max-width:46vw;'+
        'font:11px/1.35 monospace;white-space:pre-wrap;padding:6px 8px;border-radius:4px;'+
        'background:rgba(0,0,0,0.82);color:#7CFC7C;border:1px solid #2a6';
      document.body.appendChild(d);
    }
    d.style.color=color||'#7CFC7C';
    d.textContent=txt;
  }

  function autoMenu(){
    try{
      if(typeof _unlockAudio==='function') _unlockAudio();
      if(typeof _gameState==='undefined') return 'waiting…';
      if(_gameState==='title'){
        if(typeof startStoryMode==='function') startStoryMode();
        return 'auto: story mode';
      }
      if(_gameState==='story'){
        if(typeof startGame==='function') startGame();
        return 'auto: story page '+((typeof _storyPage!=='undefined')?_storyPage:'?');
      }
      if(_gameState==='select'){
        if(typeof _selectStep!=='undefined' && _selectStep===0){
          if(typeof _playModeIdx!=='undefined') _playModeIdx=0;
          if(typeof _playerCount!=='undefined') _playerCount=1;
        } else if(typeof _heroChoice!=='undefined') _heroChoice='mind';
        if(typeof startGame==='function') startGame();
        return 'auto: hero select step '+((typeof _selectStep!=='undefined')?_selectStep:'?');
      }
      if(_gameState==='cutscene'){
        if(typeof _advanceCutscene==='function') _advanceCutscene();
        return 'auto: cutscene';
      }
      return null;
    }catch(e){ return 'menu error: '+e.message; }
  }

  function start(){
    if(running) return;
    if(typeof update!=='function'){ overlay('SELF-TEST: update() not found','#f88'); return; }
    _orig=update; update=wrappedUpdate;
    if(typeof draw==='function'){ _origDraw=draw; draw=wrappedDraw; }
    if(typeof readGamepad==='function'){ _origReadGP=readGamepad; readGamepad=wrappedReadGamepad; }
    window.__MV_SELFTEST_ACTIVE=true;
    running=true; lf=0; t0=Date.now(); renderFrames=0;
    violations={}; perf={maxUpdateMs:0,slowFrames:0};
    phaseIdx=0; phaseFrame=0; jumpHold=0; baselineY=null; idleMaxDev=0; xHist.length=0;
    if(typeof p!=='undefined'&&p) p._idlePrevY=undefined;
    if(typeof p!=='undefined'&&p){ p._wasOg=false; p._prevCheckY=undefined; }
    hud('bot driving — character should walk right');
    console.info('MV self-test started');
  }

  function finish(){
    if(!running) return;
    running=false;
    window.__MV_SELFTEST_ACTIVE=false;
    if(_orig) update=_orig;
    if(_origDraw) draw=_origDraw;
    if(_origReadGP) readGamepad=_origReadGP;
    var secs=(Date.now()-t0)/1000;
    var counts={}, samples={};
    for(var k in violations){ counts[k]=violations[k].length+(violations[k]._more||0); samples[k]=violations[k].slice(0,8); }
    var report={
      build:(window.MV_BUILD||'?'),
      logicFrames:lf, durationS:+secs.toFixed(1),
      logicHz:+(lf/secs).toFixed(1), renderHz:+(renderFrames/secs).toFixed(1),
      idleMaxDevPx:+idleMaxDev.toFixed(2), perf:perf,
      violationCounts:counts, samples:samples,
      demo:(typeof _awdjooLevelSnapshot==='function'?_awdjooLevelSnapshot():(typeof _demoSnapshot==='function'?_demoSnapshot():null)),
      health:(window.__MV_HEALTH?window.__MV_HEALTH.summary():null)
    };
    window.__mvReport=report;
    window.__MV_SELFTEST_DONE=true;
    try{ localStorage.setItem('mv_selftest_report', JSON.stringify(report)); }catch(e){}
    try{ document.dispatchEvent(new CustomEvent('mv-selftest-done',{detail:report})); }catch(e){}
    console.log('%cMV SELF-TEST REPORT','color:#0f0;font-weight:bold');
    console.table(counts);
    console.log('MV_SELFTEST_REPORT '+JSON.stringify(report));
    var human='SELF-TEST DONE  build '+report.build+'\n'+
      'logic '+report.logicHz+'Hz · render '+report.renderHz+'Hz · '+report.durationS+'s\n'+
      'idle wobble max '+report.idleMaxDevPx+'px · slowFrames '+perf.slowFrames+'\n';
    var any=false;
    for(var t in counts){ any=true; human+='  '+t+': '+counts[t]+'\n'; }
    if(!any) human+='  none flagged\n';
    human+='\n(copy "MV_SELFTEST_REPORT" line from console)';
    overlay(human, any?'#ffcf6b':'#7CFC7C');
  }

  function stop(){ if(running) finish(); }

  function boot(){
    if(armed) return; armed=true;
    overlay('SELF-TEST ARMED\nAuto-starting story → level…\n(watch for WALK RIGHT)');
    var tries=0;
    (function poll(){
      tries++;
      var gs=(typeof _gameState!=='undefined')?_gameState:'?';
      if(!running){
        var now=Date.now();
        if(now-lastMenu>MENU_TICK_MS){
          lastMenu=now;
          var msg=autoMenu();
          if(msg) overlay('SELF-TEST ARMED\n'+msg+'\nstate: '+gs);
        }
      }
      var ready = gs==='game' && (typeof p!=='undefined') && p;
      if(ready && !running){ start(); return; }
      if(tries>60*60*8){ overlay('SELF-TEST: timed out waiting for gameplay','#f88'); return; }
      requestAnimationFrame(poll);
    })();
  }

  window.MV_SELFTEST={ start: boot, stop: stop, get report(){ return window.__mvReport; } };
  if(document.readyState==='complete') setTimeout(boot, 400);
  else window.addEventListener('load', function(){ setTimeout(boot, 400); });
})();
