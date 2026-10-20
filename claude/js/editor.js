// ============================================================
//  Mind & Venture — editor.js
//  Creative mode stage designer and in-game editor overlay.
// ============================================================

function _isBoundaryPlat(t){
  return t.x===0&&t.y===0&&(t.w>=WW*0.9||t.h>=WH*0.9)||t.x===0&&t.w<=24||t.x>=WW-24&&t.w<=24;
}
function _captureStageSnapshot(name){
  const goal=_goalRect();
  return {
    name,
    savedAt:Date.now(),
    spawn:{x:_spawnX,y:_spawnY},
    goal:{x:goal.x,y:goal.y,w:goal.w,h:goal.h},
    worldW:WW,worldH:WH,
    platforms:TR.filter(t=>!_isBoundaryPlat(t)).map(t=>({x:t.x,y:t.y,w:t.w,h:t.h,tp:t.tp})),
    enemies:ENEMS.map(e=>({x:e.x,y:e.y,mn:e.mn,mx:e.mx,spd:e.spd,dir:e.dir,hp:e.mhp,mhp:e.mhp,type:e.type})),
    crates:CRATES.map(c=>({x:c.x,y:c.y,w:c.w||28,h:c.h||28})),
    knowls:KDROP.map(k=>({x:k.x,y:k.y})),
    bwalls:BWALLS.map(b=>({x:b.x,y:b.y,w:b.w,h:b.h,hp:b.maxHp,maxHp:b.maxHp,label:b.label||'WALL',col:b.col||'#5a3010'})),
  };
}
function _applyStageData(stage){
  TR.length=0; ENEMS.length=0; CRATES.length=0; KDROP.length=0; BWALLS.length=0;
  const w=stage.worldW||2400, h=stage.worldH||900;
  WW=w; WH=h;
  TR.push({x:0,y:h-60,w:w,h:60,tp:'solid',mv:null,mp:null});
  TR.push({x:0,y:0,w:20,h:h,tp:'solid',mv:null,mp:null});
  TR.push({x:w-20,y:0,w:20,h:h,tp:'solid',mv:null,mp:null});
  for(const t of stage.platforms||[]){
    TR.push({x:t.x,y:t.y,w:t.w,h:t.h,tp:t.tp||'solid',mv:null,mp:null});
  }
  for(const e of stage.enemies||[]){
    const cx=e.x+(e.w?e.w/2:20), feetY=e.y+(e.h?e.h:40);
    const shape=e.shape??_legacyEnemyShape(e.type);
    ENEMS.push(_mkMindEnemy(shape,cx,feetY,{mn:e.mn,mx:e.mx,spd:e.spd,hp:e.mhp,mhp:e.mhp}));
  }
  for(const c of stage.crates||[]) CRATES.push({x:c.x,y:c.y,w:c.w||28,h:c.h||28,vx:0,vy:0,og:false});
  for(const k of stage.knowls||[]) KDROP.push({x:k.x,y:k.y,ox:k.x,oy:k.y,got:false,bob:Math.random()*Math.PI*2,vx:0,vy:0});
  for(const b of stage.bwalls||[]){
    BWALLS.push({x:b.x,y:b.y,w:b.w,h:b.h,hp:b.maxHp,maxHp:b.maxHp,cracked:false,
      shakeX:0,shakeY:0,debris:[],_destroyFr:null,label:b.label||'WALL',col:b.col||'#5a3010'});
  }
  if(stage.goal){
    GOALPL={x:stage.goal.x,y:stage.goal.y,w:stage.goal.w,h:stage.goal.h,tp:'solid'};
    TR.push({x:GOALPL.x,y:GOALPL.y,w:GOALPL.w,h:GOALPL.h,tp:'solid',mv:null,mp:null});
  }else{
    GOALPL={x:w-260,y:h-80,w:220,h:20,tp:'solid'};
    TR.push({x:GOALPL.x,y:GOALPL.y,w:GOALPL.w,h:GOALPL.h,tp:'solid',mv:null,mp:null});
  }
  if(stage.spawn){ _spawnX=stage.spawn.x; _spawnY=stage.spawn.y; }
  kTotal=KDROP.length; kColl=0; goalOpen=true; win=false;
}
function _initStageDesignerShell(name){
  _battleTestMode=false; _runTestMode=false; _ngPlusRun=false;
  _tmjDraw=null; _mapApplied=false; _awdjooTutorial=false;
  _stageDesignerMode=true; _zoneIdx=0; _zoneCardT=0;
  ESHOTS.length=0; PFXS.length=0;
  _unlockedMask=15; ITEM=1;
  ED.roomName=name||('Stage_'+Date.now());
  ED.undoStack=[];
  p=mkP(); p.hp=PLAYER_MAX_HP; p.maxHp=PLAYER_MAX_HP; p.lives=MAXLIVES;
  p2=null; _playerCount=1;
  camX=0; camY=0;
  _gameState='game';
  _stopBGM('title'); _stopBGM('story');
  _playBGM('game',OPT.musicVol);
}
function startStageDesignerNew(){
  _initStageDesignerShell('Stage_'+Date.now());
  _applyStageData({
    name:ED.roomName,worldW:2400,worldH:900,
    spawn:{x:120,y:840-FEET_OFF},
    goal:{x:2140,y:820,w:220,h:20},
    platforms:[{x:400,y:680,w:160,h:16,tp:'oneway'},{x:720,y:560,w:140,h:16,tp:'solid'}],
    enemies:[],crates:[],knowls:[],bwalls:[],
  });
  _respawnPlayer();
  _editorActive=true;
  edShowToast('NEW STAGE â€” drag platforms Â· Shift+S save Â· ` exit');
}
function startStageDesignerEdit(stage){
  if(!stage) return;
  _initStageDesignerShell(stage.name);
  _applyStageData(stage);
  _respawnPlayer();
  _editorActive=true;
  edShowToast('EDITING "'+stage.name+'" â€” Shift+S save Â· ` exit');
}
function _playCustomStage(stage){
  if(!stage) return;
  _initStageDesignerShell(stage.name);
  _applyStageData(stage);
  _respawnPlayer();
  _editorActive=false;
  edShowToast('PLAYTEST â€” reach the goal Â· TAB returns to hub');
}
function edSaveStage(){
  const name=ED.roomName||('Stage_'+Date.now());
  const snap=_captureStageSnapshot(name);
  const list=getCustomStages();
  const idx=list.findIndex(s=>s.name===name);
  if(idx>=0) list[idx]=snap; else list.push(snap);
  saveCustomStages(list);
  edShowToast('Stage "'+name+'" saved! ('+list.length+' total)');
}

/* â”€â”€ ROOM LIBRARY (persisted in localStorage) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const ROOM_LIB_KEY = 'mv_room_library';
function getRoomLib(){ try{ return JSON.parse(localStorage.getItem(ROOM_LIB_KEY)||'[]'); }catch(e){return [];} }
function saveRoomLib(lib){ try{ localStorage.setItem(ROOM_LIB_KEY, JSON.stringify(lib)); }catch(e){} }

/* â”€â”€ EDITOR STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const ED = {
  // tool: 'platform'|'enemy'|'crate'|'knowl'|'bwall'|'erase'|'select'
  tool: 'platform',
  platType: 'solid', // solid | oneway | ceil
  enemyType: 'ball',
  // bwall defaults
  bwallHp: 3,
  // drag state
  dragging: false,
  dragStart: null,
  dragEnd: null,
  // hover
  hoverX: 0, hoverY: 0,
  // placed objects (live edit of world arrays)
  // selection
  selObj: null, selType: null,
  // room metadata
  roomName: 'Room_' + Date.now(),
  // grid snap
  snap: 20,
  snapEnabled: true,
  // panel UI
  panelW: 220,
  // zoom/scroll handled via camera
  // undo stack
  undoStack: [],
};

/* â”€â”€ SNAP HELPER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function edSnap(v){ return ED.snapEnabled ? Math.round(v/ED.snap)*ED.snap : Math.round(v); }

/* â”€â”€ WORLD COORDS FROM SCREEN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function edToWorld(sx_, sy_){ return { x: edSnap(sx_*SMS_SCALE + _rcamX), y: edSnap(sy_*SMS_SCALE + _rcamY) }; }

/* â”€â”€ PUSH UNDO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function edPushUndo(){
  ED.undoStack.push({
    TR: TR.map(t=>({...t})),
    ENIN_: ENEMS.map(e=>({...e})),
    CRATE_: CRATES.map(c=>({...c})),
    KDEFS_: KDROP.map(k=>({...k})),
    BWALL_: BWALLS.map(b=>({...b})),
  });
  if(ED.undoStack.length>40) ED.undoStack.shift();
}

/* â”€â”€ ADD OBJECT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function edAddPlat(x,y,w,h,tp){
  if(w<4||h<4) return;
  edPushUndo();
  TR.push({x,y,w,h,tp,mv:null,mp:null});
}
function edAddEnemy(x,y){
  edPushUndo();
  const cx=x+20, feetY=y+40;
  ENEMS.push(_mkMindEnemy(_legacyEnemyShape(ED.enemyType),cx,feetY,{range:120}));
}
function edAddCrate(x,y){
  edPushUndo();
  CRATES.push({x,y,w:28,h:28,vx:0,vy:0,og:false});
}
function edAddKnowl(x,y){
  edPushUndo();
  KDROP.push({x,y,ox:x,oy:y,got:false,bob:Math.random()*Math.PI*2});
}
function edAddBwall(x,y,w,h){
  if(w<4||h<4) return;
  edPushUndo();
  BWALLS.push({x,y,w,h,hp:ED.bwallHp,maxHp:ED.bwallHp,cracked:false,
    shakeX:0,shakeY:0,debris:[],_destroyFr:null,label:'WALL',col:'#5a3010'});
}

/* â”€â”€ ERASE OBJECT at world coords â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function edErase(wx,wy){
  const R=20;
  // platforms (skip boundary ones)
  for(let i=TR.length-1;i>=0;i--){
    const t=_normPlat(TR[i]);
    if(wx>=t.x&&wx<=t.x+t.w&&wy>=t.y&&wy<=t.y+t.h){
      if(t.x===0&&t.y===0&&t.w>=WW*0.9) continue;
      edPushUndo(); TR.splice(i,1); return;
    }
  }
  for(let i=ENEMS.length-1;i>=0;i--){
    const e=ENEMS[i];
    if(Math.abs(wx-(e.x+e.w/2))<R&&Math.abs(wy-(e.y+e.h/2))<R){edPushUndo();ENEMS.splice(i,1);return;}
  }
  for(let i=CRATES.length-1;i>=0;i--){
    const c=CRATES[i];
    if(Math.abs(wx-(c.x+c.w/2))<R&&Math.abs(wy-(c.y+c.h/2))<R){edPushUndo();CRATES.splice(i,1);return;}
  }
  for(let i=KDROP.length-1;i>=0;i--){
    const k=KDROP[i];
    if(Math.abs(wx-k.x)<R&&Math.abs(wy-k.y)<R){edPushUndo();KDROP.splice(i,1);return;}
  }
  for(let i=BWALLS.length-1;i>=0;i--){
    const b=BWALLS[i];
    if(wx>=b.x&&wx<=b.x+b.w&&wy>=b.y&&wy<=b.y+b.h){edPushUndo();BWALLS.splice(i,1);return;}
  }
}

/* â”€â”€ EXPORT ROOM AS JS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function edExportRoom(name){
  // Compute bounding box of all content
  let minX=Infinity,minY=Infinity;
  TR.forEach(t=>{if(t.x>20){minX=Math.min(minX,t.x);minY=Math.min(minY,t.y);}});
  if(!isFinite(minX)){minX=0;minY=0;}

  const plats = TR.filter(t=>!(t.x===0&&t.y===0)).map(t=>
    `  [${t.x},${t.y},${t.w},${t.h},'${t.tp}']`).join(',\n');
  const enemies = ENEMS.map(e=>
    `  {x:${e.x},y:${e.y},mn:${e.mn},mx:${e.mx},spd:${e.spd},dir:${e.dir},hp:${e.mhp},mhp:${e.mhp},type:'${e.type}'}`).join(',\n');
  const crates = CRATES.map(c=>
    `  {x:${c.x},y:${c.y},w:${c.w||28},h:${c.h||28}}`).join(',\n');
  const knowls = KDROP.map(k=>
    `  {x:${k.x},y:${k.y}}`).join(',\n');
  const bwalls = BWALLS.map(b=>
    `  {x:${b.x},y:${b.y},w:${b.w},h:${b.h},hp:${b.maxHp},maxHp:${b.maxHp},label:'${b.label||'WALL'}',col:'${b.col||'#5a3010'}'}`).join(',\n');

  return `// â”€â”€ ROOM: ${name} â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\nconst ROOM_${name} = {\n  platforms:[\n${plats}\n  ],\n  enemies:[\n${enemies}\n  ],\n  crates:[\n${crates}\n  ],\n  knowls:[\n${knowls}\n  ],\n  bwalls:[\n${bwalls}\n  ]\n};`;
}

/* â”€â”€ SAVE ROOM TO LIBRARY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function edSaveRoom(){
  const name = ED.roomName || ('Room_'+Date.now());
  const lib = getRoomLib();
  const room = {
    name,
    savedAt: Date.now(),
    platforms: TR.filter(t=>!(t.x===0&&t.y===0&&(t.w===WW||t.h===WH||t.w===20||t.h===20)))
      .map(t=>({x:t.x,y:t.y,w:t.w,h:t.h,tp:t.tp})),
    enemies: ENEMS.map(e=>({x:e.x,y:e.y,mn:e.mn,mx:e.mx,spd:e.spd,dir:e.dir,hp:e.mhp,mhp:e.mhp,type:e.type})),
    crates: CRATES.map(c=>({x:c.x,y:c.y,w:c.w||28,h:c.h||28})),
    knowls: KDROP.map(k=>({x:k.x,y:k.y})),
    bwalls: BWALLS.map(b=>({x:b.x,y:b.y,w:b.w,h:b.h,hp:b.maxHp,maxHp:b.maxHp,label:b.label||'WALL',col:b.col||'#5a3010'})),
  };
  const idx = lib.findIndex(r=>r.name===name);
  if(idx>=0) lib[idx]=room; else lib.push(room);
  saveRoomLib(lib);
  edShowToast('Room "'+name+'" saved! ('+lib.length+' total)');
}

/* â”€â”€ TOAST NOTIFICATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
let _edToast='', _edToastFr=0;
function edShowToast(msg){ uiShowToast(msg); if(_editorActive){ _edToast=msg; _edToastFr=180; } }

/* â”€â”€ UNDO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function edUndo(){
  if(!ED.undoStack.length){ edShowToast('Nothing to undo'); return; }
  // simple: restore TR array entries added after last snapshot
  edShowToast('Undo! ('+ED.undoStack.length+' left)');
  const snap = ED.undoStack.pop();
  // Restore live arrays from snapshot
  TR.length=0; snap.TR.forEach(t=>TR.push(t));
  // Note: enemies/crates/etc are runtime objects; partial restore
  edShowToast('Undone');
}

/* â”€â”€ EDITOR MOUSE HANDLING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
let _edMouseDown=false;
cv.addEventListener('mousedown', e=>{
  if(typeof _mapEdActive!=='undefined'&&_mapEdActive) return;
  if(!_editorActive) return;
  const rect=cv.getBoundingClientRect();
  const scaleX=W/rect.width, scaleY=H/rect.height;
  const mx=(e.clientX-rect.left)*scaleX, my=(e.clientY-rect.top)*scaleY;
  // ignore if in panel
  if(mx < ED.panelW) return;
  _edMouseDown=true;
  const w=edToWorld(mx,my);
  if(ED.tool==='platform'||ED.tool==='bwall'){
    ED.dragging=true; ED.dragStart={...w}; ED.dragEnd={...w};
  } else if(ED.tool==='enemy'){ edAddEnemy(w.x,w.y);
  } else if(ED.tool==='crate'){ edAddCrate(w.x,w.y);
  } else if(ED.tool==='knowl'){ edAddKnowl(w.x,w.y);
  } else if(ED.tool==='erase'){ edErase(w.x,w.y); }
});
cv.addEventListener('mousemove', e=>{
  if(typeof _mapEdActive!=='undefined'&&_mapEdActive) return;
  if(!_editorActive) return;
  const rect=cv.getBoundingClientRect();
  const scaleX=W/rect.width, scaleY=H/rect.height;
  const mx=(e.clientX-rect.left)*scaleX, my=(e.clientY-rect.top)*scaleY;
  ED.hoverX=mx; ED.hoverY=my;
  if(ED.dragging){
    const w=edToWorld(mx,my);
    ED.dragEnd={...w};
  }
});
cv.addEventListener('mouseup', e=>{
  if(typeof _mapEdActive!=='undefined'&&_mapEdActive) return;
  if(!_editorActive) return;
  if(ED.dragging){
    const x=Math.min(ED.dragStart.x,ED.dragEnd.x);
    const y=Math.min(ED.dragStart.y,ED.dragEnd.y);
    const w=Math.abs(ED.dragEnd.x-ED.dragStart.x);
    const h=Math.abs(ED.dragEnd.y-ED.dragStart.y);
    if(ED.tool==='platform') edAddPlat(x,y,w||ED.snap,h||ED.snap,ED.platType);
    else if(ED.tool==='bwall') edAddBwall(x,y,w||ED.snap,h||ED.snap);
    ED.dragging=false; ED.dragStart=null; ED.dragEnd=null;
  }
  _edMouseDown=false;
});

/* â”€â”€ EDITOR KEYBOARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
document.addEventListener('keydown', e=>{
  // Toggle: Awdjoo Town map edit, or the blank stage designer after a win.
  if(e.code==='Backquote'){
    if(_gameState==='game'){
      if(typeof _mapEdActive!=='undefined'&&_mapEdActive){
        if(typeof _mapEdToggle==='function') _mapEdToggle(false);
      }else if(typeof _mapEdCan==='function'&&_mapEdCan()){
        if(typeof _mapEdToggle==='function') _mapEdToggle(true);
      }else{
        _editorActive=!_editorActive;
        edShowToast(_editorActive?'EDITOR ON — ` to exit':'EDITOR OFF');
      }
    }
    e.preventDefault(); return;
  }
  if(typeof _mapEdActive!=='undefined'&&_mapEdActive) return;
  if(!_editorActive) return;
  // Save
  if(e.shiftKey&&e.code==='KeyS'){
    if(_stageDesignerMode) edSaveStage();
    else edSaveRoom();
    e.preventDefault(); return;
  }
  // Export to console
  if(e.shiftKey&&e.code==='KeyE'){
    const code=edExportRoom(ED.roomName);
    console.log(code);
    navigator.clipboard&&navigator.clipboard.writeText(code).then(()=>edShowToast('JS copied to clipboard!'));
    e.preventDefault(); return;
  }
  // Undo
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){ edUndo(); e.preventDefault(); return; }
  // Tool shortcuts
  const shortcuts={'KeyP':'platform','KeyN':'enemy','KeyC':'crate','KeyK':'knowl','KeyB':'bwall','KeyR':'erase'};
  if(shortcuts[e.code]){ ED.tool=shortcuts[e.code]; edShowToast('Tool: '+ED.tool); e.preventDefault(); return; }
  // Cycle platform type
  if(e.code==='Tab'&&ED.tool==='platform'){
    const types=['solid','oneway','ceil'];
    ED.platType=types[(types.indexOf(ED.platType)+1)%types.length];
    edShowToast('Platform: '+ED.platType); e.preventDefault(); return;
  }
  // Cycle enemy type
  if(e.code==='Tab'&&ED.tool==='enemy'){
    const etypes=['ball','square','triangle','star'];
    ED.enemyType=etypes[(etypes.indexOf(ED.enemyType)+1)%etypes.length];
    edShowToast('Rival: '+ED.enemyType); e.preventDefault(); return;
  }
  // Camera scroll in editor
  if(e.code==='ArrowRight'){ camX=Math.min(WW-camViewW(), camX+40); e.preventDefault(); return; }
  if(e.code==='ArrowLeft'){  camX=Math.max(0, camX-40);    e.preventDefault(); return; }
  if(e.code==='ArrowDown'){  camY=Math.min(WH-camViewH(), camY+40); e.preventDefault(); return; }
  if(e.code==='ArrowUp'){    camY=Math.max(0, camY-40);    e.preventDefault(); return; }
  // Toggle snap
  if(e.code==='KeyG'){ ED.snapEnabled=!ED.snapEnabled; edShowToast('Snap: '+(ED.snapEnabled?'ON':'OFF')); e.preventDefault(); return; }
  // Set spawn to player position (stage designer)
  if(e.code==='KeyT'&&_stageDesignerMode){
    _spawnX=p.x; _spawnY=p.y;
    edShowToast('Spawn set to player position');
    e.preventDefault(); return;
  }
  // Rename room / stage
  if(e.code==='KeyM'){
    const n=prompt('Stage name:',ED.roomName);
    if(n) ED.roomName=n;
    e.preventDefault(); return;
  }
});

/* â”€â”€ DRAW EDITOR OVERLAY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function drawEditorOverlay(){
  if(!_editorActive) return;

  // Semi-transparent grid
  ctx.save();
  ctx.strokeStyle='rgba(255,255,255,0.07)';
  ctx.lineWidth=0.5;
  const gs=ED.snap/SMS_SCALE;
  const offX=(_rcamX/SMS_SCALE)%gs, offY=(_rcamY/SMS_SCALE)%gs;
  for(let x=-offX;x<W;x+=gs){ ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke(); }
  for(let y=-offY;y<H;y+=gs){ ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke(); }

  // Drag preview
  if(ED.dragging&&ED.dragStart&&ED.dragEnd){
    const px=sx(Math.min(ED.dragStart.x,ED.dragEnd.x));
    const py=sy(Math.min(ED.dragStart.y,ED.dragEnd.y));
    const pww=Math.abs(ED.dragEnd.x-ED.dragStart.x)||ED.snap;
    const phw=Math.abs(ED.dragEnd.y-ED.dragStart.y)||ED.snap;
    const pw=sw(pww), ph=sw(phw);
    const col = ED.tool==='bwall'?'rgba(160,60,220,0.5)':'rgba(80,200,255,0.4)';
    ctx.fillStyle=col; ctx.fillRect(px,py,pw,ph);
    ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.strokeRect(px,py,pw,ph);
    drawText(pww+'X'+phw, px+4, py+4, C.WHITE, 1);
  }

  // Cursor crosshair
  const hw=edToWorld(ED.hoverX,ED.hoverY);
  const hsx=sx(hw.x), hsy=sy(hw.y);
  ctx.strokeStyle='rgba(255,220,0,0.7)'; ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(hsx-8,hsy);ctx.lineTo(hsx+8,hsy);ctx.stroke();
  ctx.beginPath();ctx.moveTo(hsx,hsy-8);ctx.lineTo(hsx,hsy+8);ctx.stroke();

  // Side panel
  const PW=ED.panelW, PH=H;
  ctx.fillStyle='rgba(10,10,20,0.9)'; ctx.fillRect(0,0,PW,PH);
  ctx.strokeStyle='rgba(100,200,255,0.3)'; ctx.lineWidth=1; ctx.strokeRect(0,0,PW,PH);

  drawText('* LEVEL EDITOR', 10, 10, C.CYAN, 2);
  ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fillRect(10,30,PW-20,1);

  const tools=[
    ['P','PLATFORM',ED.platType],
    ['N','ENEMY',ED.enemyType],
    ['C','CRATE','28X28'],
    ['K','KNOWL','DROP'],
    ['B','BWALL','HP:'+ED.bwallHp],
    ['R','ERASE',''],
  ];
  let ty=38;
  for(const [key,name,sub] of tools){
    const active=ED.tool===name.toLowerCase()||ED.tool===name;
    ctx.fillStyle=active?'rgba(80,200,255,0.25)':'transparent';
    ctx.fillRect(6,ty-2,PW-12,22);
    drawText('['+key+'] '+name, 10, ty+2, active?C.CYAN:C.SILVER, 1);
    if(sub) drawText(String(sub), 118, ty+2, C.SAND, 1);
    ty+=24;
  }

  ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fillRect(10,ty,PW-20,1); ty+=10;

  const help=[
    'TAB  CYCLE TYPE',
    'G  SNAP ('+( ED.snapEnabled?'ON':'OFF')+')',
    'ARROWS  SCROLL',
    'CTRL+Z  UNDO',
    'SHIFT+S  SAVE STAGE',
    'SHIFT+E  EXPORT JS',
    'M  RENAME STAGE',
    (_stageDesignerMode?'T  SET SPAWN':''),
    '`  EXIT EDITOR',
  ];
  for(const h of help){ if(!h) continue; drawText(h, 10, ty, C.SILVER, 1); ty+=14; }

  ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fillRect(10,ty,PW-20,1); ty+=10;
  drawText('ROOM: '+ED.roomName, 10, ty, C.CYAN, 1); ty+=14;
  drawText('PLATS: '+(TR.length-4), 10, ty, C.SILVER, 1); ty+=14;
  drawText('ENEMIES: '+ENEMS.length, 10, ty, C.SILVER, 1); ty+=14;
  drawText('CRATES: '+CRATES.length, 10, ty, C.SILVER, 1); ty+=14;
  drawText('KNOWLS: '+KDROP.length, 10, ty, C.SILVER, 1); ty+=14;
  drawText('BWALLS: '+BWALLS.length, 10, ty, C.SILVER, 1);

  drawText('WORLD: '+hw.x+','+hw.y, 10, H-28, C.SAND, 1);
  drawText('CAM: '+Math.round(camX)+','+Math.round(camY), 10, H-14, C.SAND, 1);

  if(_edToastFr>0){
    const a=Math.min(1,_edToastFr/30);
    ctx.globalAlpha=a;
    ctx.fillStyle='rgba(20,20,40,0.85)';
    const tw=textW(_edToast,2)+24;
    ctx.fillRect(W/2-tw/2, H-40, tw, 28);
    drawTextC(_edToast, W/2, H-32, C.CYAN, 2);
    ctx.globalAlpha=1;
    _edToastFr--;
  }

  ctx.restore();
}


/* â”€â”€ BUILT-IN CHUNK TEMPLATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
// Each chunk is a function(rng, xOffset) â†’ {platforms, enemies, crates, knowls, bwalls}
// xOffset is where this chunk starts in the world
const PROCGEN_CHUNKS = [

  // CHUNK 0: flat open run with scattered platforms
  (rng, ox) => {
    const p=[], e=[], c=[], k=[];
    p.push({x:ox, y:840, w:600, h:60, tp:'solid'}); // ground
    for(let i=0;i<4;i++){
      const px=ox+80+i*120+rng()*40|0;
      const py=600+rng()*160|0;
      p.push({x:px,y:py,w:60+rng()*80|0,h:16,tp:'oneway'});
      if(rng()>0.5) e.push({x:px+20,y:py-40,mn:px,mx:px+80,spd:0.7+rng()*0.6,dir:1,hp:3,mhp:3,type:rng()>0.5?'circle':'square'});
      if(rng()>0.6) k.push({x:px+10,y:py-30});
    }
    return {platforms:p,enemies:e,crates:c,knowls:k,bwalls:[]};
  },

  // CHUNK 1: tall building interior
  (rng, ox) => {
    const p=[], e=[], c=[], k=[], bw=[];
    const bx=ox+40, bw2=280, bh=480;
    p.push({x:bx,y:900-bh,w:bw2,h:20,tp:'solid'}); // roof
    p.push({x:bx,y:840,w:bw2,h:60,tp:'solid'});     // floor
    p.push({x:bx,y:900-bh,w:20,h:bh,tp:'solid'});   // left wall
    p.push({x:bx+bw2-20,y:900-bh,w:20,h:bh,tp:'solid'}); // right wall
    // 3 interior floors
    for(let i=1;i<=3;i++){
      const fy=840-i*110;
      p.push({x:bx+20,y:fy,w:bw2-40-rng()*60|0,h:16,tp:'solid'});
      if(rng()>0.4) e.push({x:bx+60,y:fy-40,mn:bx+20,mx:bx+bw2-60,spd:0.9+rng()*0.5,dir:1,hp:4,mhp:4,type:'square'});
    }
    if(rng()>0.3) bw.push({x:bx+bw2/2-15,y:820,w:30,h:50,hp:3,maxHp:3,label:'DOOR',col:'#4b2814',cracked:false,shakeX:0,shakeY:0,debris:[],_destroyFr:null});
    return {platforms:p,enemies:e,crates:c,knowls:k,bwalls:bw};
  },

  // CHUNK 2: staircase ascent
  (rng, ox) => {
    const p=[], e=[], c=[], k=[];
    for(let i=0;i<6;i++){
      const px=ox+i*90, py=840-i*100;
      p.push({x:px,y:py,w:120,h:py===840?60:20,tp:'solid'});
      if(rng()>0.5) e.push({x:px+30,y:py-40,mn:px,mx:px+80,spd:0.6+rng()*0.8,dir:i%2===0?1:-1,hp:3+Math.floor(i/2),mhp:3+Math.floor(i/2),type:'circle'});
      if(rng()>0.55) k.push({x:px+50,y:py-30});
    }
    return {platforms:p,enemies:e,crates:c,knowls:k,bwalls:[]};
  },

  // CHUNK 3: pit challenge (gap crossing)
  (rng, ox) => {
    const p=[], e=[], c=[], k=[];
    // two ground sections with gap
    const gapW=100+rng()*120|0;
    p.push({x:ox,y:840,w:200,h:60,tp:'solid'});
    p.push({x:ox+200+gapW,y:840,w:200,h:60,tp:'solid'});
    // floating oneway platforms over the gap
    for(let i=0;i<3;i++){
      const fx=ox+160+i*(gapW/3+10);
      const fy=680+rng()*100|0;
      p.push({x:fx,y:fy,w:50+rng()*40|0,h:14,tp:'oneway'});
    }
    // crates on far side
    for(let i=0;i<3;i++) c.push({x:ox+220+gapW+i*32,y:808,w:28,h:28,vx:0,vy:0,og:false});
    e.push({x:ox+240+gapW,y:800,mn:ox+210+gapW,mx:ox+380+gapW,spd:1.1,dir:-1,hp:5,mhp:5,type:'square'});
    k.push({x:ox+280+gapW,y:810});
    return {platforms:p,enemies:e,crates:c,knowls:k,bwalls:[]};
  },

  // CHUNK 4: chaos arena (from room library if available, else random)
  (rng, ox) => {
    const lib=getRoomLib();
    if(lib.length>0){
      // pick a random saved room and offset it
      const room=lib[Math.floor(rng()*lib.length)];
      const rx=room.platforms.length?room.platforms[0].x:0;
      const shift=ox-rx;
      const shiftObjs=(arr,dx)=>arr.map(o=>({...o,x:o.x+dx}));
      return {
        platforms:shiftObjs(room.platforms,shift),
        enemies:shiftObjs(room.enemies,shift).map(e=>({...e,mn:e.mn+shift,mx:e.mx+shift,
          w:e.type==='circle'?38:52,h:e.type==='circle'?38:52,
          alive:true,hitF:0,vx:0,vy:0,og:false,shotCd:90,jumpCd:0,grenades:[]})),
        crates:shiftObjs(room.crates,shift).map(c=>({...c,vx:0,vy:0,og:false})),
        knowls:shiftObjs(room.knowls,shift).map(k=>({...k,got:false,vx:0,vy:0})),
        bwalls:shiftObjs(room.bwalls,shift).map(b=>({...b,cracked:false,shakeX:0,shakeY:0,debris:[],_destroyFr:null})),
      };
    }
    // fallback: dense platform jungle
    const p=[], e=[], k=[];
    p.push({x:ox,y:840,w:500,h:60,tp:'solid'});
    for(let i=0;i<8;i++){
      const px=ox+rng()*420|0, py=420+rng()*380|0;
      p.push({x:px,y:py,w:40+rng()*100|0,h:14,tp:rng()>0.4?'oneway':'solid'});
      if(rng()>0.4) e.push({x:px+10,y:py-40,mn:px,mx:px+80,spd:0.5+rng()*1.2,dir:1,hp:3,mhp:3,type:rng()>0.5?'circle':'square'});
    }
    k.push({x:ox+200,y:810},{x:ox+350,y:810});
    return {platforms:p,enemies:e,crates:[],knowls:k,bwalls:[]};
  },
];

/* â”€â”€ BUILD A PROCGEN WORLD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function buildProcgenWorld(seed){
  const rng = mkRng(seed);
  const TOTAL_CHUNKS = 8 + Math.floor(rng()*4); // 8â€“11 chunks per run
  let xOffset = 60;

  // Clear live arrays (preserve world boundaries)
  const bounds = TR.slice(0,4);
  TR.length=0; bounds.forEach(b=>TR.push(b));
  ENEMS.length=0; CRATES.length=0; KDROP.length=0; BWALLS.length=0;

  const difficulties=[1,1,2,2,3,3,4,4,5,5,5];

  for(let i=0;i<TOTAL_CHUNKS;i++){
    // Weight chunk selection by difficulty tier
    const diff=difficulties[Math.min(i,difficulties.length-1)];
    // Bias toward harder chunks as run progresses
    let chunkIdx;
    if(diff<=2) chunkIdx=Math.floor(rng()*2); // chunks 0-1
    else if(diff<=3) chunkIdx=Math.floor(rng()*3); // chunks 0-2
    else chunkIdx=Math.floor(rng()*PROCGEN_CHUNKS.length);

    const chunk = PROCGEN_CHUNKS[chunkIdx](rng, xOffset);

    // Enemy HP scaling per run depth
    chunk.enemies.forEach(e=>{
      e.hp+=diff; e.mhp=e.hp;
      e.spd*=(1+diff*0.08);
    });

    // Inject into live world (minion fodder disabled for now)
    chunk.platforms.forEach(p=>{const t={...p,mv:null,mp:null}; TR.push(t);});
    chunk.crates.forEach(c=>CRATES.push({...c,vx:0,vy:0,og:false}));
    chunk.knowls.forEach(k=>KDROP.push({...k,ox:k.x,oy:k.y,got:false,bob:Math.random()*Math.PI*2}));
    chunk.bwalls.forEach(b=>BWALLS.push(b));

    // Measure rightmost x for next chunk offset
    let rightEdge=xOffset+600;
    chunk.platforms.forEach(p=>{ rightEdge=Math.max(rightEdge,p.x+p.w); });
    xOffset=rightEdge+60;
  }

  // Place goal platform at end
  const goalX=xOffset+100, goalY=300;
  TR.push({x:goalX,y:goalY,w:220,h:20,tp:'solid',mv:null,mp:null});
  // Update GOALPL reference used by drawGoal()
  GOALPL.x=goalX; GOALPL.y=goalY; GOALPL.w=220; GOALPL.h=20;

  kColl=0; goalOpen=false; win=false; ESHOTS=[]; PFXS=[];
  edShowToast('NG+ RUN â€” SEED: '+seed);
  console.log('NG+ world built: '+TOTAL_CHUNKS+' chunks, seed='+seed);
}

