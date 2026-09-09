// ============================================================
//  Mind & Venture — player.js
//  Input (keyboard/gamepad/touch), player factory (mkP),
//  item state, connector arm pose, fireItem, updateHook,
//  Laitu NPC, cutscene advance.
//
//  Depends on: physics.js (constants + helpers),
//  audio.js (sfx, _playBGM, _stopBGM, _unlockAudio),
//  enemies.js (ENEMS, _enemyHookHB, _damageEnemy, ENM_DMG,
//              _markEnemyItemForce, ESHOTS, PFXS, spawnHitBurst),
//  save.js (OPT), ui.js (_gameState, _titleMenuIdx etc.),
//  main.js (ctx, W, H, WW, WH, fr)
// ============================================================

// ── Input state ───────────────────────────────────────────────
const K={}, Kj={}, K2={}, Kj2={};
function _bindDown(a){ return (OPT.binds[a]||[]).some(c=>K[c]); }
function _bindJ(a){   return (OPT.binds[a]||[]).some(c=>Kj[c]); }

window.addEventListener('keydown',e=>{
  if(_gameState==='game'&&!_audioUnlocked) _unlockAudio();
  if(_gameState==='title'||_gameState==='story'||_gameState==='select'||
     _gameState==='options'||_gameState==='levels'||_gameState==='stagedesign'||
     _gameState==='cutscene'||_gameState==='tutorial') return;
  const _isArrow=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code);
  const _isP2Action=['Numpad1','Numpad2','Numpad3'].includes(e.code);
  if(_playerCount===2&&(_isArrow||_isP2Action)){
    if(!K2[e.code]) Kj2[e.code]=true;
    K2[e.code]=true; e.preventDefault(); return;
  }
  if(!K[e.code]) Kj[e.code]=true;
  K[e.code]=true;
  if(e.code==='Space') K['Space_kb']=true;
  if(e.code==='KeyE')  K['KeyE_kb']=true;
  if(e.code==='KeyQ')  K['KeyQ_kb']=true;
  if(e.code==='KeyF')  K['KeyF_kb']=true;
  ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)&&e.preventDefault();
});
window.addEventListener('keyup',e=>{
  if(_playerCount===2&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Numpad1','Numpad2','Numpad3'].includes(e.code)){
    K2[e.code]=false; return;
  }
  K[e.code]=false;
  if(e.code==='Space') K['Space_kb']=false;
  if(e.code==='KeyE')  K['KeyE_kb']=false;
  if(e.code==='KeyQ')  K['KeyQ_kb']=false;
  if(e.code==='KeyF')  K['KeyF_kb']=false;
});

// Touch buttons (set up after DOM is ready — called from main.js)
function _initTouchButtons(){
  const cv=document.getElementById('c');
  if(cv) cv.addEventListener('click',()=>{ cv.focus(); _unlockAudio(); });
  // Face buttons: A jump, X item action, Y item select, B punch.
  const _padPairs=window._phonePlay
    ?[['bSp','Space'],['bE','KeyE'],['bQ','KeyF'],['bF','KeyQ']]
    :[['bSp','Space'],['bE','KeyE'],['bQ','KeyQ'],['bF','KeyF']];
  _padPairs.forEach(([id,code])=>{
    const b=document.getElementById(id);
    if(!b) return;
    const on=e=>{ if(!K[code]) Kj[code]=true; K[code]=true; if(typeof _phoneEnterPlay==='function') _phoneEnterPlay(); e.preventDefault(); e.stopPropagation(); };
    const off=()=>K[code]=false;
    b.addEventListener('mousedown',on);
    b.addEventListener('touchstart',on,{passive:false});
    ['mouseup','mouseleave','touchend','touchcancel'].forEach(v=>b.addEventListener(v,off));
  });
  _initDpadEightWay();
  const testBtn=document.getElementById('bTest');
  if(testBtn){ testBtn.addEventListener('click',()=>{ TEST_MODE=!TEST_MODE; testBtn.style.background=TEST_MODE?'#003300':'#001800'; testBtn.style.borderColor=TEST_MODE?'#00aa00':'#0a4400'; initWorld(); }); }
  const rstBtn=document.getElementById('bRst');
  if(rstBtn){ rstBtn.addEventListener('click',()=>{Kj['Tab']=true;}); rstBtn.addEventListener('touchstart',e=>{Kj['Tab']=true;e.preventDefault();e.stopPropagation();},{passive:false}); }
  const pauseBtn=document.getElementById('bPause');
  if(pauseBtn){
    const poke=e=>{ Kj['Escape']=true; if(typeof _phoneEnterPlay==='function') _phoneEnterPlay(); e.preventDefault(); e.stopPropagation(); };
    pauseBtn.addEventListener('click',poke);
    pauseBtn.addEventListener('touchstart',poke,{passive:false});
  }
}

function _initDpadEightWay(){
  const pad=document.getElementById('padLeft');
  if(!pad) return;
  const codes=['KeyW','KeyA','KeyS','KeyD'];
  let tid=null;
  const set=(code,on)=>{ if(on&&!K[code]) Kj[code]=true; K[code]=!!on; };
  const clear=()=>{ codes.forEach(c=>K[c]=false); tid=null; };
  const read=(x,y)=>{
    const r=pad.getBoundingClientRect();
    const dx=x-(r.left+r.width/2), dy=y-(r.top+r.height/2);
    const rad=Math.min(r.width,r.height)/2;
    if(Math.hypot(dx,dy)<rad*0.12){ codes.forEach(c=>K[c]=false); return; }
    const t=rad*0.20;
    set('KeyW',dy<=-t); set('KeyA',dx<=-t); set('KeyS',dy>=t); set('KeyD',dx>=t);
  };
  const pick=(e)=>{
    if(tid==='mouse') return e;
    const list=e.touches||e.changedTouches;
    if(!list) return null;
    for(let i=0;i<list.length;i++) if(list[i].identifier===tid) return list[i];
    return null;
  };
  pad.addEventListener('mousedown',e=>{
    tid='mouse'; read(e.clientX,e.clientY); e.preventDefault(); e.stopPropagation();
  });
  pad.addEventListener('touchstart',e=>{
    const t=e.changedTouches[0]; if(!t) return;
    tid=t.identifier; read(t.clientX,t.clientY); if(typeof _phoneEnterPlay==='function') _phoneEnterPlay(); e.preventDefault(); e.stopPropagation();
  },{passive:false});
  addEventListener('mousemove',e=>{ if(tid==='mouse') read(e.clientX,e.clientY); });
  addEventListener('touchmove',e=>{
    const t=pick(e); if(!t) return; read(t.clientX,t.clientY); e.preventDefault();
  },{passive:false});
  addEventListener('mouseup',()=>{ if(tid==='mouse') clear(); });
  addEventListener('touchend',e=>{
    if(tid==null||tid==='mouse') return;
    for(let i=0;i<e.changedTouches.length;i++) if(e.changedTouches[i].identifier===tid){ clear(); return; }
  });
  addEventListener('touchcancel',()=>{ if(tid!=null&&tid!=='mouse') clear(); });
}

// ── Gamepad ───────────────────────────────────────────────────
const GP={pad:null,prev:{},ignore:{}};
window.addEventListener('gamepadconnected',e=>{
  GP.pad=e.gamepad;
  setTimeout(()=>{
    const pads=navigator.getGamepads();
    const g=pads[GP.pad.index];
    if(!g) return;
    GP.ignore={};
    g.buttons.forEach((b,i)=>{ if(b.value>0.1) GP.ignore[i]=true; });
    console.log('GP connected. Ignoring resting buttons:',Object.keys(GP.ignore));
  },200);
});
window.addEventListener('gamepaddisconnected',e=>{GP.pad=null;});

function readGamepad(){
  if(!GP.pad) return;
  const pads=navigator.getGamepads(); if(!pads) return;
  const g=pads[GP.pad.index]; if(!g) return;
  const DEAD=0.5;
  const ax=Math.abs(g.axes[0]||0)>DEAD?g.axes[0]:0;
  const ay=Math.abs(g.axes[1]||0)>DEAD?g.axes[1]:0;
  const pressed=i=>!GP.ignore[i]&&g.buttons[i]&&g.buttons[i].pressed===true;
  const rose=i=>pressed(i)&&!GP.prev[i];
  if(ax<0) K['KeyA']=true; else if(!g.buttons[14]?.pressed) K['KeyA']=false;
  if(ax>0) K['KeyD']=true; else if(!g.buttons[15]?.pressed) K['KeyD']=false;
  if(ay<0) K['KeyW']=true; else if(!g.buttons[12]?.pressed) K['KeyW']=false;
  if(ay>0) K['KeyS']=true; else if(!g.buttons[13]?.pressed) K['KeyS']=false;
  if(pressed(14)) K['KeyA']=true;
  if(pressed(15)) K['KeyD']=true;
  if(pressed(12)) K['KeyW']=true;
  if(pressed(13)) K['KeyS']=true;
  const bJump=pressed(0);
  if(bJump&&!GP.prev[0]) Kj['Space']=true;
  K['Space']=(K['Space_kb']||bJump);
  if(rose(2)) Kj['KeyQ']=true;
  if(rose(3)) Kj['KeyE']=true;
  K['KeyQ']=(K['KeyQ_kb']||pressed(2));
  K['KeyE']=(K['KeyE_kb']||pressed(3));
  K['KeyF']=(K['KeyF_kb']||pressed(1));
  if(pressed(4)) K['KeyS']=true;
  if(rose(9)) Kj['Tab']=true;
  if(_gameState==='title'){
    if(!_titleMusicPlaying&&rose(0)) _onInteract();
    else if(_titleMusicPlaying){
      if(rose(12)) _titleMenuIdx=(_titleMenuIdx+_titleMenuItems().length-1)%_titleMenuItems().length;
      if(rose(13)) _titleMenuIdx=(_titleMenuIdx+1)%_titleMenuItems().length;
      if(rose(0)) _titleMenuActivate();
    }
  }else if((_gameState==='story'||_gameState==='select')&&rose(0)) startGame();
  if(_gameState==='options'){
    _optionsInput({up:rose(12),down:rose(13),left:rose(14),right:rose(15),confirm:rose(0),back:rose(1)});
  }
  if(_gameState==='select'){
    if(rose(14)){ if(_selectStep===0)_playModeIdx=(_playModeIdx+2)%3; else _heroChoice='mind'; }
    if(rose(15)){ if(_selectStep===0)_playModeIdx=(_playModeIdx+1)%3; else _heroChoice='venture'; }
  }
  [0,1,2,3,4,9,12,13,14,15].forEach(i=>GP.prev[i]=pressed(i));
}
function clkj(){ Object.keys(Kj).forEach(k=>delete Kj[k]); }

// ── Input helpers ─────────────────────────────────────────────
function isUp(){   return _bindDown('up'); }
function isDn(){   return _bindDown('down'); }
function isLf(){   return _bindDown('left'); }
function isRt(){   return _bindDown('right'); }
function isJump(){ return _bindDown('jump'); }
function isJumpJ(){ return _bindJ('jump'); }
function isPunch(){ return _bindDown('punch'); }

let _punchHoldF=0, _punchHoldFr=-1;
function isSprintHeld(){
  if(typeof _bindDown==='function'&&_bindDown('sprint')) return true;
  if(K.ShiftLeft||K.ShiftRight||K.Shift) return true;
  if(fr!==_punchHoldFr){ _punchHoldFr=fr; _punchHoldF=isPunch()?_punchHoldF+1:0; }
  return _punchHoldF>10&&((isRt()&&!isLf())||(isLf()&&!isRt()));
}
function _moveInputX(){
  if(_bindDown('right')&&!_bindDown('left')) return 1;
  if(_bindDown('left')&&!_bindDown('right')) return -1;
  const r=!!(K['KeyD']||K['ArrowRight']);
  const l=!!(K['KeyA']||K['ArrowLeft']);
  if(r&&!l) return 1;
  if(l&&!r) return -1;
  return 0;
}
function _runDir(){ return _moveInputX(); }

// ── Item state ────────────────────────────────────────────────
let ITEM=-1;  // -1=none · 0=TRS · 1=RCA · 2=XLR · 3=MAG
const INAMES=['TRS','RCA','XLR','MAG'];
const ICOLS=['#d4aa40','#e87820','#c8cdd4','#e02028'];
const ITEM_UNLOCK_BITS=[1,2,4,8];
let _unlockedMask=15;
let _itemEnhanced=[false,false,false,false];
/** Held-jack scale. RCA was undersized vs TRS on the arm — read as a real plug. */
function _itemArtScale(idx){
  if(idx===0) return 0.86;
  if(idx===1) return 1.12;
  if(idx===2) return 1.00;
  if(idx===3) return 0.88;
  return 0.86;
}
function _itemBoxSize(){
  return {w:40, h:40};
}

function _heldItemFor(pl){
  if(pl&&pl._aiCompanion) return 0;
  return ITEM;
}
function _itemUnlocked(idx){ return (_unlockedMask&ITEM_UNLOCK_BITS[idx])!==0; }
function _grantPlayerItem(idx, silent){
  if(idx<0||idx>3||_itemUnlocked(idx)) return false;
  _unlockedMask|=ITEM_UNLOCK_BITS[idx];
  ITEM=idx;
  const titles=['TRS Laser','RCA Grappling Hook','XLR Push','MAG Pull'];
  const lines=[
    ['Hold X / Q to charge a beam. Release to shoot.'],
    ['X / Q — launch hook · W/S — reel in or let out rope','A / Space — release to swing or catapult off walls'],
    ['Hold X / Q to push enemies and shots away.'],
    ['Hold X / Q to pull enemies and shots in.'],
  ];
  _itemTutorial={title:titles[idx],lines:lines[idx],t:0,maxT:280};
  if(idx===1&&typeof _awdjooTutorial!=='undefined'&&_awdjooTutorial&&_zoneIdx===0) goalOpen=true;
  if(!silent){ try{sfx('unlock');}catch(_e){} }
  return true;
}
function _cycleItem(){
  if(_unlockedMask===0) return;
  const start=ITEM<0?0:ITEM;
  for(let n=1;n<=4;n++){
    const next=(start+n)%4;
    if(_itemUnlocked(next)){ ITEM=next; return; }
  }
}
function _resetItemProgress(){
  if(_awdjooTutorial&&_zoneIdx===0){ _unlockedMask=0; ITEM=-1; }
  else { _unlockedMask=15; ITEM=1; }
  _itemEnhanced=[false,false,false,false];
  if(typeof _resetTrsFlames==='function') _resetTrsFlames();
  _ropePickupAnim=null; _itemTutorial=null;
  if(_mapRopePickup) _mapRopePickup.got=false;
  if(typeof _resetCombatProgress==='function') _resetCombatProgress();
}

// ── Player factory ────────────────────────────────────────────
function mkP(){ return {
  x:_spawnX, y:_spawnY, vx:0, vy:0, og:false, fc:true,
  hero:_heroChoice,
  jf:0, pt:0, pCd:0, pDur:5, inv:0, landF:0,
  wheelAngle:0, suspComp:0, suspVel:0, suspTilt:0,
  crouchAmt:0, crouchInput:false, wallGrip:0, wallDir:0, _wallTaps:0,
  tipWorldX:null, tipWorldY:null,
  duckTimer:0, duckLocked:false, duckFi:0, duckCharge:0,
  duckBoostReady:false, highJumpFx:0, _wallChargeReady:false,
  runRamp:0, movePower:0, _moveDir:0, _moveCap:0,
  jumpTiltF:0, _jumpAmp:0.3, _jumpHatDX:0, _jumpHatDY:-1,
  _landAmp:0, _peakVy:0, _lifeRegenT:0, _autoHeadTuck:0,
  hp:PLAYER_MAX_HP, maxHp:PLAYER_MAX_HP, lives:MAXLIVES, _prevLives:-1, _prevHp:-1,
  aimDX:1, aimDY:0, tAimDX:1, tAimDY:0, pCharging:false, pCharge:0,
  pupilX:0, pupilY:0,
  momentum:0, _prevVx:0, _hasAimInput:false,
  fireRecoil:0, fireRecoilA:0, _lastRecoilMax:14,
  _lastWTap:-999, _wallJumpTap:0, _wallJumpTime:0, _wallAimFree:0, _jumpArmed:true,
  itemStamina:100, xlrOn:false, magOn:false, xlrHeld:0, magHeld:0,
  laserCharging:false, laserCharge:0, laserCd:0,
  _hitDone:false, _punchHit:false, _pRecoil:0, fistWX:0, fistWY:0, fistSX:0, fistSY:0,
  hook:{st:'idle',ex:0,ey:0,evx:0,evy:0,ax:0,ay:0,rl:0,ox:NaN,oy:NaN,tgt:null,tox:0,toy:0},
  ropeLen:0,
  shots:[], pulses:[], magPts:[], flashF:0, smoke:[],
};}

let p=null, fr=0, win=false;
let p2=null;

function _spawnPartner(){
  if(typeof location!=='undefined'&&/[?&](selftest|ci)=/i.test(location.search||'')&&_playerCount!==2){
    p2=null; return;
  }
  p2=mkP();
  p2.hero=(_heroChoice==='mind'?'venture':'mind');
  p2._aiCompanion=_playerCount!==2;
  p2.x=p.x+36; p2.y=p.y; p2.vx=0; p2.vy=0; p2.og=true;
  p2.fc=!!p.fc;
}
function _companionPlCenter(pl){
  const sw=typeof SW!=='undefined'?SW:64;
  const feet=typeof FEET_OFF!=='undefined'?FEET_OFF:88;
  const stand=typeof STAND_H!=='undefined'?STAND_H:70;
  return {x:pl.x+sw*0.5, y:pl.y+feet-stand*0.45};
}
function _companionHelpNeeded(){
  if(!p) return false;
  const max=p.maxHp||PLAYER_MAX_HP;
  if((p.hp||0)<=max*0.5) return true;
  if((p.inv||0)>6) return true;
  const pc=_companionPlCenter(p);
  if(typeof ENEMS==='undefined') return false;
  for(const e of ENEMS){
    if(typeof _enemyCombatActive==='function'&&!_enemyCombatActive(e)) continue;
    if(!e||e.alive===false) continue;
    if(Math.hypot((e.x+(e.w||0)*0.5)-pc.x,(e.y+(e.h||0)*0.5)-pc.y)<78) return true;
  }
  return false;
}
function _companionPickEnemy(fromX, fromY, favorPlayer){
  if(typeof ENEMS==='undefined') return null;
  const pc=favorPlayer?_companionPlCenter(p):null;
  let best=null, bestD=favorPlayer?260:220;
  for(const e of ENEMS){
    if(typeof _enemyCombatActive==='function'&&!_enemyCombatActive(e)) continue;
    if(!e||e.alive===false) continue;
    const ex=e.x+(e.w||0)*0.5, ey=e.y+(e.h||0)*0.5;
    const d=favorPlayer&&pc
      ?Math.hypot(ex-pc.x,ey-pc.y)*0.55+Math.hypot(ex-fromX,ey-fromY)*0.45
      :Math.hypot(ex-fromX,ey-fromY);
    if(d<bestD){ bestD=d; best=e; }
  }
  return best;
}
function _updateCompanionAI(){
  if(!p2||!p) return;
  _coopRollX0=p2.x; _coopRollY0=p2.y;
  const me=_companionPlCenter(p2);
  const help=_companionHelpNeeded();
  const threat=_companionPickEnemy(me.x, me.y, help);
  let followX=p.x-(p.fc?48:-48);
  if(help&&threat){
    const ex=threat.x+(threat.w||0)*0.5;
    const px=p.x+(typeof SW!=='undefined'?SW:64)*0.5;
    followX=ex+(ex>=px?36:-36)-(typeof SW!=='undefined'?SW:64)*0.5;
  }else if(threat&&!help){
    const ex=threat.x+(threat.w||0)*0.5;
    const side=ex>=me.x?1:-1;
    const hold=ex-side*86-(typeof SW!=='undefined'?SW:64)*0.5;
    if(Math.abs(hold-p.x)<200) followX=hold;
  }
  const dx=followX-p2.x;
  const distX=Math.abs(p.x-p2.x), distY=Math.abs(p.y-p2.y);
  if(distX>300||distY>240){
    p2.x=followX; p2.y=p.y; p2.vx=(p.vx||0)*0.35; p2.vy=0; p2.og=!!p.og;
  }else{
    const cap=(typeof MOVE_WALK!=='undefined'?MOVE_WALK:10.5)*(help?1.05:0.88);
    if(Math.abs(dx)>14){
      const dir=Math.sign(dx);
      p2.vx+=(dir*(typeof MOVE_ACCEL!=='undefined'?MOVE_ACCEL:0.4)*(help?1.15:0.9));
      p2.vx=Math.max(-cap,Math.min(cap,p2.vx));
      if(!threat) p2.fc=dir>0;
    }else{
      p2.vx*=(typeof MOVE_STOP!=='undefined'?MOVE_STOP:0.78);
      if(Math.abs(p2.vx)<0.18) p2.vx=0;
    }
    p2._aiJumpCd=(p2._aiJumpCd||0)-1;
    if(p2.og&&!p.og&&p.vy<(typeof JI!=='undefined'?JI:-3)*0.35){
      p2.vy=typeof JI!=='undefined'?JI:-3; p2.og=false;
    }else if(p2.og&&p2._aiJumpCd<=0&&(Math.abs(dx)>40&&Math.abs(p2.vx)<0.55||!!p2._moveBlocked)){
      p2.vy=typeof JI!=='undefined'?JI:-3; p2.og=false; p2._aiJumpCd=20;
    }
  }
  p2.vy=Math.min((p2.vy||0)+(typeof GRAV!=='undefined'?GRAV:0.52),14);
  if(typeof _companionFight==='function') _companionFight(threat, help);
  if(typeof _movePlayerWithColl==='function') _movePlayerWithColl(p2,p2.vx,p2.vy);
  if(p2.y<20){p2.y=20;p2.vy=Math.max(0,p2.vy);}
  if(p2.inv>0) p2.inv--;
  if(p2.y>(typeof WH!=='undefined'?WH:3000)+120){
    p2.x=followX; p2.y=p.y; p2.vy=0; p2.og=true;
  }
}
function _companionFight(threat, help){
  if(!p2) return;
  const me=_companionPlCenter(p2);
  const best=threat||_companionPickEnemy(me.x, me.y, !!help);
  p2._aiShotCd=(p2._aiShotCd||0)-1;
  if(!best){
    p2.aimDX=p.fc?1:-1; p2.aimDY=0; p2.tAimDX=p2.aimDX; p2.tAimDY=0;
    p2.fc=!!p.fc;
    return;
  }
  const ex=best.x+best.w*0.5, ey=best.y+best.h*0.5;
  const adx=ex-me.x, ady=ey-me.y, al=Math.hypot(adx,ady)||1;
  p2.aimDX=adx/al; p2.aimDY=ady/al;
  p2.tAimDX=p2.aimDX; p2.tAimDY=p2.aimDY;
  if(adx>0.08) p2.fc=true; else if(adx<-0.08) p2.fc=false;
  if(p2.og&&ey<me.y-36&&(p2._aiJumpCd||0)<=0){
    p2.vy=typeof JI!=='undefined'?JI:-3; p2.og=false; p2._aiJumpCd=24;
  }
  if(p2._aiShotCd>0) return;
  p2._aiShotCd=help?22:34;
  const oldItem=typeof ITEM!=='undefined'?ITEM:-1;
  ITEM=0;
  if(typeof withPlayerContext==='function') withPlayerContext(p2,()=>fireItem(false));
  else fireItem(false);
  ITEM=oldItem;
  if(p2.shots&&p2.shots.length&&p&&p.shots){ p.shots.push(...p2.shots); p2.shots.length=0; }
}

// ── Player movement X ─────────────────────────────────────────
function _updatePlayerMoveX(pl){
  if(pl!==p) return;
  if(_shutdownTimer>0) return;
  if(pl.hook&&pl.hook.st==='on') return;
  if(pl.wallGrip>0) return;
  const dir=_moveInputX();
  const gridOn=typeof _gridReady==='function'&&_gridReady();
  if(!gridOn && pl._moveBlocked&&dir){ pl.vx=0; return; }
  if(!gridOn && (pl._grindF||0)>=8 && dir){ pl.vx=0; return; }
  const wt=typeof _wallTouchInfo==='function'?_wallTouchInfo(pl):{touch:false,dir:0};
  const pushIntoWall=!!(!gridOn && wt.touch&&dir&&wt.dir===dir);
  if(!gridOn && pushIntoWall&&(pl._grindF||0)>=2){ pl.vx=0; return; }
  const grounded=!!_playerOnGround(pl);
  const onSlope=!!(grounded&&pl._onSlope);
  if((pl._slopeCoastT||0)>0 && !onSlope) pl._slopeCoastT--;
  const coast=onSlope||(pl._slopeCoastT||0)>0;
  const sprint=isSprintHeld()&&grounded&&dir!==0;
  if(sprint){
    pl.runRamp=Math.min(1,(pl.runRamp||0)+MOVE_RUN_RAMP);
    if((pl.runRamp||0)>0.35) pl._runCoastT=26;
  }else{
    pl.runRamp=Math.max(0,(pl.runRamp||0)-0.028);
    if((pl._runCoastT||0)>0) pl._runCoastT--;
  }
  if(!dir){
    pl.movePower=Math.max(0,(pl.movePower||0)-0.08);
    if(pl.movePower<=0) pl._moveDir=0;
    pl._moveCap=0;
    if(grounded){
      const rollOut=coast||(pl._runCoastT||0)>0||Math.abs(pl.vx)>MOVE_WALK*0.55;
      if(coast){
        pl.vx*=WHEEL_COAST_FRIC;
        if(Math.abs(pl.vx)<0.06) pl.vx=0;
      }else if(rollOut){
        const coastFric=typeof MOVE_RUN_COAST!=='undefined'?MOVE_RUN_COAST:0.958;
        pl.vx*=coastFric;
        if(Math.abs(pl.vx)<0.08) pl.vx=0;
      }else{
        pl.vx*=MOVE_STOP;
        if(Math.abs(pl.vx)<0.10) pl.vx=0;
      }
    }else{ pl.vx*=AIR_DRIFT; if(Math.abs(pl.vx)<0.12) pl.vx=0; }
    return;
  }
  if(pl._moveDir!==dir){
    pl._moveDir=dir;
    // Skid: keep some spin, do not gift a chunk of cap.
    pl.movePower=(pl.movePower||0)*(coast?0.78:0.70);
    pl.vx*=coast?0.90:0.86;
  }
  pl.movePower=Math.min(1,(pl.movePower||0)+MOVE_POWER);
  const spin=Math.min(1,pl.movePower||0);
  const spinEase=0.34+0.66*spin;
  let cap;
  if(sprint){
    const run=Math.min(1,pl.runRamp||0);
    cap=MOVE_WALK*MOVE_PEAK*spinEase+(MOVE_RUN-MOVE_WALK)*run;
  }else{
    cap=MOVE_WALK*MOVE_PEAK*spinEase;
    if(!grounded&&dir) cap=Math.max(cap,Math.abs(pl.vx));
  }
  if(onSlope&&pl._slopeAngle){
    const sinA=Math.sin(pl._slopeAngle);
    const climbing=dir*sinA<-0.03;
    if(climbing){
      const run=Math.min(1,pl.runRamp||0);
      cap=Math.min(cap, sprint?MOVE_WALK*0.58+(MOVE_RUN-MOVE_WALK)*run*0.38:MOVE_WALK*0.52);
    }else cap=Math.max(cap,Math.abs(pl.vx)*0.92);
  }
  if(coast) cap=Math.max(cap, Math.abs(pl.vx));
  pl._moveCap=cap;
  let accel=sprint?MOVE_RUN_ACCEL:MOVE_ACCEL;
  if(cap>0.05){
    const ratio=Math.min(1,Math.abs(pl.vx)/cap);
    accel*=Math.max(0.30,1-0.50*ratio*ratio);
  }
  if(onSlope&&pl._slopeAngle){
    const sinA=Math.sin(pl._slopeAngle);
    const mom=Math.min(1,(pl.momentum||0)+0.15);
    if(dir*sinA<-0.03) accel*=sprint?0.72:0.48;
    else if(dir*sinA>0.03) accel*=1+mom*0.12;
  }
  const vSign=pl.vx>0.15?1:(pl.vx<-0.15?-1:0);
  const turnMul=coast?1.35:MOVE_TURN;
  if(vSign===-dir) pl.vx+=dir*accel*turnMul;
  else             pl.vx+=dir*accel;
  if(dir>0) pl.vx=Math.min(pl.vx,cap);
  else       pl.vx=Math.max(pl.vx,-cap);
  if(!gridOn && pushIntoWall){
    if(dir>0) pl.vx=Math.min(pl.vx,0);
    else pl.vx=Math.max(pl.vx,0);
  }
}

// ── Connector arm pose ────────────────────────────────────────
function _clampSegFrom(shX,shY,tx,ty){
  let minT=1;
  for(const pl of allP()){
    if(pl.tp!=='solid'&&pl.tp!=='ceil') continue;
    const hit=segHit(shX,shY,tx,ty,pl);
    if(!hit) continue;
    const segLen=Math.hypot(tx-shX,ty-shY)||1;
    const t=Math.hypot(hit.tx-shX,hit.ty-shY)/segLen;
    if(t<minT) minT=t;
  }
  if(minT>=1) return {x:tx,y:ty};
  const pull=Math.max(0,minT-0.03);
  return {x:shX+(tx-shX)*pull, y:shY+(ty-shY)*pull};
}

function computeConnectorArmPose(pl=p){
  const ca2=pl.crouchAmt, fc=pl.fc;
  const px=pl.x, py=pl.y;
  const wcy=py+FEET_OFF-WHEEL_R;
  const standBodyCY=py+FEET_OFF-STAND_H-WHEEL_R+10;
  const duckBodyCY=(wcy+WHEEL_R*0.5)-BODY_H;
  const bodyCY=standBodyCY+ca2*(duckBodyCY-standBodyCY);
  const bodyCX=px+SW/2;
  const bodyTop=bodyCY;
  const shoulderY=bodyTop+BODY_H*0.22;
  const connShoulderX=fc?bodyCX-BODY_W/2:bodyCX+BODY_W/2;
  const hookOn=pl.hook&&pl.hook.st!=='idle';
  const cptY=pl.y+FEET_OFF-STAND_H*0.5;
  const rawAngle=hookOn
    ?Math.atan2((pl.hook.st==='on'?pl.hook.ay:pl.hook.ey)-cptY,(pl.hook.st==='on'?pl.hook.ax:pl.hook.ex)-(pl.x+SW/2))
    :Math.atan2(pl.aimDY,pl.aimDX);
  const duckAngle=fc?0:Math.PI;
  const aimDuckBlend=pl.og?ca2:0;
  const recoilMax=pl._lastRecoilMax||14;
  const _rf=pl.fireRecoil>0?pl.fireRecoil/recoilMax:0;
  const recoilSnap=recoilMax>=18?1.25:1;
  const recoilTilt=-_rf*0.14*recoilSnap;
  const ca=rawAngle*(1-aimDuckBlend*0.85)+duckAngle*(aimDuckBlend*0.85)+recoilTilt;
  const aimLen=Math.max(6,AIM_LEN-_rf*11*recoilSnap);
  const _nudge=_rf*3*recoilSnap;
  const connShX=connShoulderX-Math.cos(ca)*_nudge*(fc?1:-1);
  const connShY=shoulderY-Math.sin(ca)*_nudge;
  let noseX,noseY,tipX,tipY,useElbow=false,elbowX=0,elbowY=0,armA0=ca,armA1=ca,armL0=aimLen,armL1=0;
  if(hookOn){
    const hx=pl.hook.st==='on'?pl.hook.ax:pl.hook.ex;
    const hy=pl.hook.st==='on'?pl.hook.ay:pl.hook.ey;
    let dx=hx-connShX, dy=hy-connShY, dd=Math.hypot(dx,dy)||1;
    let ux=dx/dd, uy=dy/dd;
    const pxn=-uy, pyn=ux;
    const speed=Math.hypot(pl.vx||0,pl.vy||0);
    const bend=7+Math.min(12,speed*0.7)+(pl.hook.st==='ext'?2:0);
    const bendSign=(fc?1:-1)*((dy>=0)?1:-1);
    elbowX=connShX+ux*aimLen*0.52+pxn*bend*bendSign;
    elbowY=connShY+uy*aimLen*0.52+pyn*bend*bendSign;
    armA0=Math.atan2(elbowY-connShY,elbowX-connShX);
    armL0=Math.max(5,Math.hypot(elbowX-connShX,elbowY-connShY));
    const fdx=hx-elbowX, fdy=hy-elbowY, fdd=Math.hypot(fdx,fdy)||1;
    const foreReach=Math.min(fdd,Math.max(8,aimLen*0.58));
    tipX=elbowX+fdx/fdd*foreReach; tipY=elbowY+fdy/fdd*foreReach;
    armA1=Math.atan2(tipY-elbowY,tipX-elbowX);
    armL1=Math.max(5,Math.hypot(tipX-elbowX,tipY-elbowY));
    noseX=tipX+Math.cos(armA1)*RCA_NOSE_LEN;
    noseY=tipY+Math.sin(armA1)*RCA_NOSE_LEN;
    const noseClamped=_clampSegFrom(tipX,tipY,noseX,noseY);
    noseX=noseClamped.x; noseY=noseClamped.y;
    useElbow=true;
  }else{
    tipX=connShX+Math.cos(ca)*aimLen; tipY=connShY+Math.sin(ca)*aimLen;
    noseX=tipX+Math.cos(ca)*RCA_NOSE_LEN; noseY=tipY+Math.sin(ca)*RCA_NOSE_LEN;
    const noseClamped=_clampSegFrom(tipX,tipY,noseX,noseY);
    noseX=noseClamped.x; noseY=noseClamped.y;
    if(Math.hypot(noseX-tipX,noseY-tipY)>0.5){
      const nd=Math.hypot(noseX-tipX,noseY-tipY)||1;
      tipX=noseX-Math.cos(ca)*Math.min(RCA_NOSE_LEN,nd);
      tipY=noseY-Math.sin(ca)*Math.min(RCA_NOSE_LEN,nd);
    }
    armA1=ca;
  }
  return {connShX,connShY,elbowX,elbowY,tipX,tipY,armA0,armA1,armL0,armL1,useElbow,noseX,noseY,aimAngle:useElbow?armA1:ca};
}

function connectorTipWorld(itemOverride=ITEM){
  const pose=computeConnectorArmPose();
  if(itemOverride===1) return {x:pose.noseX, y:pose.noseY};
  const a=pose.aimAngle;
  return {x:pose.tipX+Math.cos(a)*47, y:pose.tipY+Math.sin(a)*47};
}
function connectorAimAngle(){
  const ca2=p.og?p.crouchAmt:0;
  const rawAngle=Math.atan2(p.aimDY,p.aimDX);
  const duckAngle=p.fc?0:Math.PI;
  return rawAngle*(1-ca2*0.85)+duckAngle*(ca2*0.85);
}
function hookAttachWorld(){
  return {x:p.x+SW/2, y:p.y+FEET_OFF-STAND_H*0.45};
}
function ropePlayerEndWorld(){
  if(ITEM===1){ const pose=computeConnectorArmPose(p); return {x:pose.noseX,y:pose.noseY}; }
  return hookAttachWorld();
}

// ── Fire item ─────────────────────────────────────────────────
function fireItem(charged=false){
  if(ITEM<0||(!_itemUnlocked(ITEM)&&!p._aiCompanion)) return;
  const ax=(p._hasAimInput&&p.tAimDX!=null)?p.tAimDX:p.aimDX;
  const ay=(p._hasAimInput&&p.tAimDY!=null)?p.tAimDY:p.aimDY;
  p.aimDX=ax; p.aimDY=ay;
  const a=Math.atan2(ay,ax);
  const shotA=(ITEM===0&&p.crouchAmt>0.18&&p.og)?connectorAimAngle():a;
  if(Math.cos(a)>0.05) p.fc=true; else if(Math.cos(a)<-0.05) p.fc=false;
  const c=connectorTipWorld(ITEM);

  if(ITEM===1){ // RCA GRAPPLING HOOK
    if(p.hook.st==='idle'){
      p.hook={st:'ext',ex:c.x,ey:c.y,evx:Math.cos(a)*CSPD,evy:Math.sin(a)*CSPD,ax:0,ay:0,rl:0,ox:c.x,oy:c.y,tgt:null};
      sfx('hook'); p.fireRecoil=7; p.fireRecoilA=a;
    }else{
      if(p.hook.st==='on') _releaseHookAim(p.hook.ax,p.hook.ay);
      p.hook.st='idle'; p.hook.ox=NaN; p.hook.oy=NaN; p.hook.tgt=null;
    }
  }else if(ITEM===0){ // TRS LASER
    const enh=typeof _itemEnhanced!=='undefined'&&!!_itemEnhanced[0];
    const recoilAmt=charged?(enh?26:11):(enh?8:6);
    p._lastRecoilMax=recoilAmt;
    const spd=charged?(enh?13:11):(enh?22:19);
    const pow=charged?(enh?3.6:3.0):(enh?1.28:1.0);
    const pitch=enh?0.58:1;
    p.shots.push({x:c.x,y:c.y,vx:Math.cos(shotA)*spd,vy:Math.sin(shotA)*spd,
      life:charged?(enh?400:320):(enh?240:180),type:'laser',bounces:0,power:pow,charged:!!charged,
      enhanced:enh,owner:p.hero||'mind',born:fr,tracer:[]});
    sfx(charged?'laser_charged_fire':'laser',pitch);
    p.flashF=charged?16:7; p.fireRecoil=recoilAmt; p.fireRecoilA=shotA;
    const push=charged?(enh?5.4:2.15):(enh?1.35:1.05);
    const wt=_wallTouchInfo(p);
    const shotDir=Math.cos(shotA)>0?1:-1;
    if(!wt.touch||wt.dir!==shotDir){ p.vx-=Math.cos(shotA)*push; p.vy-=Math.sin(shotA)*push*(charged&&enh?0.72:0.4); }
  }
  // XLR/MAG handled in update() via hold
}

// ── Hook update (RCA grapple physics) ────────────────────────
function _releaseHookAim(ax,ay){
  const adx=(K['KeyD']||(_playerCount===1&&K['ArrowRight'])?1:0)-(K['KeyA']||(_playerCount===1&&K['ArrowLeft'])?1:0);
  const ady=(K['KeyS']||(_playerCount===1&&K['ArrowDown'])?1:0)-(K['KeyW']||(_playerCount===1&&K['ArrowUp'])?1:0);
  if(adx||ady){
    const l=Math.hypot(adx,ady)||1;
    p.tAimDX=adx/l; p.tAimDY=ady/l;
  }else{
    const ox=p.x+SW/2, oy=p.y+FEET_OFF-STAND_H*0.5;
    let dx=ox-ax, dy=oy-ay;
    const d=Math.hypot(dx,dy)||1;
    if(d<4){ dx=p.wallDir?-p.wallDir:1; dy=-0.35; const l=Math.hypot(dx,dy)||1; dx/=l; dy/=l; }
    else { dx/=d; dy/=d; }
    p.tAimDX=dx; p.tAimDY=dy;
  }
  p.aimDX=p.tAimDX; p.aimDY=p.tAimDY;
  if(p.tAimDX>0.05) p.fc=true; else if(p.tAimDX<-0.05) p.fc=false;
  p._hasAimInput=true; p._wallAimFree=32;
}

function updateHook(){
  const h=p.hook;
  const _hookOff=()=>{h.st='idle';h.ox=NaN;h.oy=NaN;h.tgt=null;h.plat=null;h._tight=false;h._slack=false;h._path=null;h._tension=0;h.pivots=null;h.vr=null;};
  const _aimHook=(tx,ty)=>{
    const ox=p.x+SW*0.5, oy=p.y+FEET_OFF-STAND_H*0.5;
    p.aimDX=tx-ox; p.aimDY=ty-oy;
    if(p.aimDX>0.05) p.fc=true; else if(p.aimDX<-0.05) p.fc=false;
  };

  if(h.st==='ext'){
    _aimHook(h.ex,h.ey);
    const px=h.ex, py=h.ey;
    const attach=ropePlayerEndWorld();
    h.ex+=h.evx; h.ey+=h.evy;
    if(Math.hypot(h.ex-attach.x,h.ey-attach.y)>CMAX){ if(h.st==='on') _releaseHookAim(h.ax,h.ay); _hookOff(); return; }
    let best=typeof _hookRayHit==='function'?_hookRayHit(px,py,h.ex,h.ey):null;
    for(const e of ENEMS){
      if(!_enemyCombatActive(e)) continue;
      const hb=_enemyHookHB(e);
      const fake={x:hb.x,y:hb.y,w:hb.w,h:hb.h,tp:'solid'};
      const hit=_segAabbHit(px,py,h.ex,h.ey,fake);
      if(!hit) continue;
      const d=Math.hypot(hit.tx-px,hit.ty-py);
      if(!best||d<Math.hypot(best.tx-px,best.ty-py)){best={...hit,enemy:true,tgt:e};}
    }
    if(best&&!best.enemy){
      const a0=ropePlayerEndWorld();
      const latchD=Math.hypot(best.tx-a0.x,best.ty-a0.y);
      const core=playerCoreHB(p);
      const feet=p.y+FEET_OFF;
      const cx=p.x+SW*0.5;
      const inBody=best.tx>core.x-4&&best.tx<core.x+core.w+4&&best.ty>core.y-4&&best.ty<core.y+core.h+4;
      const floorUnderfoot=(best.ny||0)<-0.55&&Math.abs(best.ty-feet)<14&&latchD<28;
      if(latchD<12||inBody||floorUnderfoot) best=null;
      else if(p.og&&best.ty>feet+8){
        const stand=typeof gridStandY==='function'?gridStandY(cx,feet,{maxUp:8,maxDrop:10}):null;
        if(stand!=null){ best.tx=cx; best.ty=stand; best.nx=0; best.ny=-1; }
      }
    }
    if(best){
      h.ax=best.tx+(best.nx||0)*2; h.ay=best.ty+(best.ny||0)*2;
      h.nx=best.nx||0; h.ny=best.ny||0;
      h.ex=best.tx; h.ey=best.ty;
      const a2=ropePlayerEndWorld();
      h.pivots=[]; h.vr=null;
      h.rl=Math.max(Math.hypot(h.ax-a2.x,h.ay-a2.y),ROPE_RL_MIN);
      h._path=[{x:h.ax,y:h.ay},{x:a2.x,y:a2.y}];
      h._tension=0; h._slack=true; h._tight=false; h._grace=14;
      h.tgt=best.enemy?best.tgt:null;
      h.plat=best.plat||null;
      h.st='on';
      if(best.enemy&&best.tgt){ _damageEnemy(best.tgt,ENM_DMG.hook,h.ex,h.ey); _markEnemyItemForce(best.tgt,10); }
      if(p.vy>0) p.vy*=0.2;
      sfx('hook_latch');
    }
    return;
  }

  if(h.st==='on'){
    if(h.tgt){
      if(!_enemyCombatActive(h.tgt)){ _releaseHookAim(h.ax,h.ay); _hookOff(); return; }
      const hb=_enemyHookHB(h.tgt);
      h.ax=hb.x+hb.w/2; h.ay=hb.y+hb.h*0.42;
    }else if(h.plat){
      const plat=h.plat;
      const alive=(typeof APLAT!=='undefined'&&APLAT.includes(plat))||(typeof MPLAT!=='undefined'&&MPLAT.includes(plat));
      if(!alive){ h.plat=null; }
      else{
        h.ax+=plat.dx||plat.vx||0;
        h.ay=plat.y+((h.ny||0)>0?plat.h:0);
        h.ex=h.ax; h.ey=h.ay;
      }
    }
    p.wallGrip=0;
    if(!p._hasAimInput) _aimHook(h.ax,h.ay);
    if(isJumpJ()){
      const a=ropePlayerEndWorld();
      const dx=h.ax-a.x, dy=h.ay-a.y, d=Math.hypot(dx,dy)||1;
      const boost=5.2;
      p.vx+=dx/d*boost; p.vy+=dy/d*boost;
      p.vy=Math.min(p.vy,JMX*0.85);
      _releaseHookAim(h.ax,h.ay); _hookOff(); sfx('jump');
      OPT.binds.jump.forEach(c=>delete Kj[c]);
      return;
    }
    const wasTight=h._tight, wasSlack=h._slack;
    if(isUp()) h.rl=Math.max(ROPE_RL_MIN,h.rl-ROPE_REEL_IN);
    if(isDn()) h.rl=Math.min(CMAX,h.rl+ROPE_REEL_OUT);
    if(isLf()){p.vx-=1.2;p.fc=false;}
    else if(isRt()){p.vx+=1.2;p.fc=true;}
    p.vy+=GRAV; p.vy=Math.min(p.vy,14);
    p.vx=Math.max(-14,Math.min(14,p.vx));
    p.vx*=0.999; p.vy*=0.999;
    const _rSteps=Math.max(1,Math.ceil(Math.max(Math.abs(p.vx),Math.abs(p.vy))/3));
    const gridOn=typeof _gridReady==='function'&&_gridReady()&&typeof gridResolvePlayer==='function';
    const keepVx=p.vx, keepVy=p.vy;
    for(let _ri=0;_ri<_rSteps;_ri++){
      if(gridOn){
        gridResolvePlayer(p, p.vx/_rSteps, p.vy/_rSteps, {swing:true});
      }else{
        p.x+=p.vx/_rSteps;
        resX();
        const _pf=p.y+FEET_OFF; p.y+=p.vy/_rSteps;
        _ropeSolidFloor(p,_pf); _resolveHeadCeiling(p);
      }
      if(p.x<0){p.x=0;p.vx=0;} if(p.x>WW-SW){p.x=WW-SW;p.vx=0;}
    }
    _ropeApplyTension(h);
    if(gridOn) gridResolvePlayer(p,0,0,{swing:true});
    else resX();
    if(h._grace>0) h._grace--;
    else if(h._tension>Math.max(ROPE_SNAP_MIN,h.rl*ROPE_SNAP_STRETCH)){
      p.vx=keepVx; p.vy=keepVy;
      _releaseHookAim(h.ax,h.ay); _hookOff(); sfx('ropeBreak'); return;
    }
    if(h._tight&&!wasTight&&Math.hypot(p.vx,p.vy)>2) sfx('ropeSnap');
    if(h._slack&&!wasSlack) sfx('ropeSlack');
    _vropeStep(h);
    p.og=false;
  }
}

// ── Laitu NPC ─────────────────────────────────────────────────
let _laitu=null;
let _mapLaituSpawn=null;
const LAITU_H=72, LAITU_W=44;
const LAITU_LINES=[
  'LAITU: Mind! You made it across Awdjoo Town.',
  "Tradzkul's minions fled toward Gauder Hills.",
  'Take my TRS connector cannon. Go!'
];
let _laituCutLines=LAITU_LINES;
const ZONE_CUT_ART=[
  {title:'AWDJOO TOWN',  img:'assets/story/story-1.png', lines:['Peace returns to Sonnata...','for now.']},
  {title:'THE TRAIL OPENS',img:'assets/story/story-5.png',lines:['Knowl seeds point the way','to Gauder Hills.']}
];
const _zoneCutImgs=ZONE_CUT_ART.map(z=>{ const im=new Image(); im.src=z.img; return im; });
const _zoneCutQ=[];

function _laituFeetY(l){ return l.y+LAITU_H; }
function _snapLaituToGround(l){
  if(l.groundY!=null){ l.y=l.groundY-LAITU_H; return; }
  const feetY=_snapSpawnToSolid(l.x+l.w/2,_laituFeetY(l));
  l.y=feetY-LAITU_H; l.groundY=feetY;
}
function _initLaituPatrol(l){
  l.homeX=l.x;
  if(l.groundY==null) l.groundY=_laituFeetY(l);
  const feet=l.groundY;
  let left=l.x, right=l.x+l.w;
  for(const pl of allP()){
    if(pl.tp!=='solid'&&pl.tp!=='oneway') continue;
    if(Math.abs(pl.y-feet)>10) continue;
    if(pl.x+pl.w<l.x||pl.x>l.x+l.w) continue;
    left=Math.min(left,pl.x+6);
    right=Math.max(right,pl.x+pl.w-6);
  }
  l.mn=Math.max(left,l.homeX-96);
  l.mx=Math.min(right-l.w,l.homeX+96);
  if(l.mx<=l.mn){ l.mn=l.homeX-72; l.mx=l.homeX+72; }
}
function _initLaituFromMap(){
  if(!_mapLaituSpawn){ _laitu=null; return; }
  const s=_mapLaituSpawn;
  const cx=s.x+(LAITU_W>>1);
  const feetY=_snapSpawnToSolid(cx, s.feetY!=null?s.feetY:s.y+LAITU_H);
  _laitu={x:s.x, y:feetY-LAITU_H, w:LAITU_W, h:LAITU_H, met:false, blink:0,
    homeX:s.x, mn:s.x-72, mx:s.x+72, dir:-1, fc:false, vx:0, pause:20, stepT:0,
    groundY:feetY};
  _initLaituPatrol(_laitu);
}
function _laituIntroLine(){
  if(kTotal>0&&kColl>=kTotal) return 'LAITU: Mind! Every Knowl seed — perfect.';
  if(kColl>0) return 'LAITU: Good work on those Knowls, Mind.';
  return 'LAITU: Mind! You made it across Awdjoo Town.';
}
function updateLaitu(){
  if(_battleTestMode||!_laitu||_laitu.met||_zoneIdx!==0||_gameState!=='game') return;
  const l=_laitu;
  if(l.groundY!=null) l.y=l.groundY-LAITU_H;
  if(l.pause>0){ l.pause--; l.vx=0; return; }
  const spd=0.62;
  l.vx=l.dir*spd; l.x+=l.vx; l.fc=l.dir>0;
  l.stepT=(l.stepT||0)+0.18;
  if(l.x<=l.mn){ l.x=l.mn; l.dir=1; l.pause=36+Math.random()*48|0; }
  else if(l.x+l.w>=l.mx){ l.x=l.mx; l.dir=-1; l.pause=36+Math.random()*48|0; }
}

// ── Cutscene / item unlock ────────────────────────────────────
function _startLaituCutscene(){
  if(!_laitu||_laitu.met||_gameState!=='game') return;
  _laitu.met=true;
  _laituCutLines=[_laituIntroLine(),"Tradzkul's minions fled toward Gauder Hills.",'Take my TRS connector cannon. Go!'];
  if(_stageDamageFree) _stageScore+=500;
  _gameState='cutscene'; _cutscenePhase=0; _cutsceneFr=0; _cutscenePage=0;
  sfx('unlock'); _stopBGM('game'); _playBGM('story',OPT.musicVol*0.55);
}
function _advanceCutscene(){
  _cutsceneFr=0;
  if(_cutscenePhase===0){
    _unlockedMask|=ITEM_UNLOCK_BITS[0]; ITEM=0;
    _itemTutorial={title:'TRS Laser Cannon',lines:['Laitu lent you the TRS connector.','Y / E — select item · hold X / Q to charge a laser bolt'],t:0,maxT:300};
    _cutscenePhase=1; _cutscenePage=0; return;
  }
  if(_cutscenePhase===1){
    _cutscenePage++;
    if(_cutscenePage>=ZONE_CUT_ART.length){ _cutscenePhase=2; _cutscenePage=0; }
    return;
  }
  if(_cutscenePhase===2){ _cutscenePhase=3; return; }
  if(_cutscenePhase===3){
    _gameState='game';
    _stopBGM('story');
    _playBGM('game',OPT.musicVol);
  }
}

// ── Laitu draw (vector art) ───────────────────────────────────
function drawLaituFigure(cx,feetY,scale,opts={}){
  const s=scale;
  const faceR=opts.faceR!==false;
  const bob=(opts.bob||0)+(opts.walkPhase?Math.sin(opts.walkPhase)*1.4:0);
  const legL=opts.walkPhase?Math.sin(opts.walkPhase)*2.2:0;
  const legR=opts.walkPhase?Math.sin(opts.walkPhase+Math.PI)*2.2:0;
  const glow=0.72+0.28*Math.sin(fr*0.07+(opts.glowPhase||0));
  const metalD='#252830',metalM='#3d434c',metalH='#6a7380',metalE='#959eaa';
  const woodD='#5a3d22',woodM='#7a5230',woodH='#a07040';
  ctx.save();
  ctx.translate(cx,feetY+bob*s);
  if(!faceR) ctx.scale(-1,1);
  ctx.scale(s,s);
  ctx.fillStyle='rgba(0,0,0,0.32)';
  ctx.beginPath();ctx.ellipse(0,3,15,3.5,0,0,Math.PI*2);ctx.fill();
  const _ring=(x,y,rx,ry,dark,hi)=>{
    ctx.fillStyle=dark;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=hi;ctx.beginPath();ctx.ellipse(x-rx*0.18,y-ry*0.22,rx*0.5,ry*0.32,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(10,12,18,0.55)';ctx.lineWidth=0.8;
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.stroke();
  };
  ctx.strokeStyle=woodM;ctx.lineWidth=2.2;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(11,-18);ctx.lineTo(13,2);ctx.stroke();
  ctx.strokeStyle=woodH;ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(11.5,-18);ctx.lineTo(13.5,2);ctx.stroke();
  ctx.fillStyle=metalM;ctx.beginPath();ctx.arc(13,2.5,2.2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=metalD;ctx.beginPath();ctx.roundRect(-11,-2,10,6,2);ctx.fill();
  ctx.fillStyle=metalM;ctx.beginPath();ctx.roundRect(-10,-1.5,8,3,1);ctx.fill();
  ctx.fillStyle=metalD;ctx.beginPath();ctx.roundRect(1,-2,10,6,2);ctx.fill();
  ctx.fillStyle=metalM;ctx.beginPath();ctx.roundRect(2,-1.5,8,3,1);ctx.fill();
  _ring(-6,-8+legL,4.2,3.2,metalM,metalH);_ring(-6,-14+legL,3.8,2.8,metalM,metalH);_ring(-6,-20+legL,3.4,2.6,metalD,metalM);
  _ring(6,-8+legR,4.2,3.2,metalM,metalH);_ring(6,-14+legR,3.8,2.8,metalM,metalH);_ring(6,-20+legR,3.4,2.6,metalD,metalM);
  ctx.fillStyle=metalD;ctx.beginPath();ctx.roundRect(-11,-36,22,14,2);ctx.fill();
  ctx.fillStyle=metalM;ctx.fillRect(-10,-35,20,4);
  ctx.fillStyle='rgba(255,255,255,0.06)';ctx.fillRect(-9,-34,18,2);
  ctx.fillStyle='#142820';ctx.beginPath();ctx.roundRect(-6,-33,12,9,1);ctx.fill();
  ctx.globalAlpha=0.55+0.35*Math.sin(fr*0.11);
  ctx.strokeStyle='#55ee99';ctx.lineWidth=0.9;
  for(let i=-5;i<=5;i+=2.5){
    ctx.beginPath();ctx.moveTo(-5+i,-32.5);ctx.lineTo(5+i,-24.5);ctx.stroke();
    ctx.beginPath();ctx.moveTo(5-i,-32.5);ctx.lineTo(-5-i,-24.5);ctx.stroke();
  }
  ctx.globalAlpha=glow*0.45;ctx.fillStyle='#66ffaa';ctx.fillRect(-5,-32,10,7);ctx.globalAlpha=1;
  ctx.strokeStyle='#1a4030';ctx.lineWidth=0.8;ctx.strokeRect(-6,-33,12,9);
  _ring(0,-39,3.2,2.4,metalM,metalH);_ring(0,-43,2.8,2.1,metalD,metalM);
  _ring(10,-28,2.8,2.2,metalM,metalH);_ring(11,-24,2.4,1.9,metalM,metalH);
  ctx.fillStyle=metalM;ctx.beginPath();ctx.roundRect(9,-22,5,4,1.5);ctx.fill();ctx.fillStyle=metalH;ctx.fillRect(9,-22,5,1.2);
  _ring(-10,-28,2.8,2.2,metalM,metalH);
  ctx.strokeStyle=metalM;ctx.lineWidth=3.2;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(-11,-26);ctx.lineTo(-22,-24);ctx.stroke();
  ctx.strokeStyle=metalH;ctx.lineWidth=1.4;
  ctx.beginPath();ctx.moveTo(-11,-26.5);ctx.lineTo(-21,-24.5);ctx.stroke();
  ctx.fillStyle=metalM;ctx.beginPath();ctx.roundRect(-25,-26,5,4,1.5);ctx.fill();ctx.fillStyle=metalH;ctx.fillRect(-25,-26,5,1.2);
  ctx.fillStyle=metalE;ctx.beginPath();ctx.roundRect(-26.5,-25,2,2,0.5);ctx.fill();
  const lanTop=-62,lanH=20,lanW=13;
  ctx.fillStyle='#30343c';
  ctx.beginPath();ctx.moveTo(0,lanTop-5);ctx.lineTo(-5,lanTop+1);ctx.lineTo(5,lanTop+1);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(0,lanTop-8);ctx.lineTo(-3.5,lanTop-3);ctx.lineTo(3.5,lanTop-3);ctx.closePath();ctx.fill();
  ctx.fillStyle=metalD;ctx.beginPath();ctx.roundRect(-lanW,lanTop+1,lanW*2,lanH,2);ctx.fill();
  ctx.globalAlpha=glow*0.9;ctx.fillStyle='#ffd060';ctx.fillRect(-lanW+2,lanTop+3,lanW*2-4,lanH-4);
  ctx.globalAlpha=glow*0.55;ctx.fillStyle='#fff0b0';ctx.fillRect(-lanW+4,lanTop+5,lanW*2-8,lanH-8);
  ctx.globalAlpha=glow*0.35;ctx.fillStyle='#ffffff';ctx.fillRect(-3,lanTop+8,6,8);ctx.globalAlpha=1;
  ctx.strokeStyle='#181a20';ctx.lineWidth=1.3;ctx.strokeRect(-lanW,lanTop+1,lanW*2,lanH);
  ctx.beginPath();ctx.moveTo(-lanW,lanTop+1+lanH*0.33);ctx.lineTo(lanW,lanTop+1+lanH*0.33);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-lanW,lanTop+1+lanH*0.66);ctx.lineTo(lanW,lanTop+1+lanH*0.66);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,lanTop+1);ctx.lineTo(0,lanTop+1+lanH);ctx.stroke();
  ctx.fillStyle=metalE;ctx.fillRect(-lanW+1,lanTop+2,2,2);
  ctx.restore();
}

// ── Particle spawners ─────────────────────────────────────────
function spawnHitBurst(wx,wy,vx,vy,col,count){
  for(let i=0;i<count;i++){
    const spd=1.5+Math.random()*3.5;
    const baseAng=Math.atan2(-vy,-vx);
    const ang=baseAng+(Math.random()-0.5)*1.8;
    PFXS.push({x:wx,y:wy,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,
      life:18+Math.random()*14|0,maxLife:32,r:2+Math.random()*3,col});
  }
}
function spawnSpark(wx,wy,vx,vy){
  for(let i=0;i<5;i++){
    const ang=Math.atan2(-vy,-vx)+(Math.random()-0.5)*2.2;
    const spd=1+Math.random()*4;
    PFXS.push({x:wx,y:wy,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,
      life:10+Math.random()*8|0,maxLife:18,r:1,col:'#ffee44'});
  }
}
