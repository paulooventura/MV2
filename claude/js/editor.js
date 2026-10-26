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
  _edSetActive(true);
  edShowToast('NEW STAGE â€” drag platforms Â· Shift+S save Â· ` exit');
}
function startStageDesignerEdit(stage){
  if(!stage) return;
  _initStageDesignerShell(stage.name);
  _applyStageData(stage);
  _respawnPlayer();
  _edSetActive(true);
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
  panelW: 252,
  // zoom/scroll handled via camera
  // undo stack
  undoStack: [],
  // live stage: ramp brush + block edits kept for SAVE (key "c,r" -> cell id)
  rampIdx: 2,
  cellEdits: {},
  hits: [],
};

// The world is drawn right of the panel (sx() adds this offset), so the panel never hides the map.
(function(){
  const baseOx=_mapEdScreenOx;
  _mapEdScreenOx=function(){
    if(_editorActive&&!(typeof _mapEdActive!=='undefined'&&_mapEdActive)) return ED.panelW;
    return baseOx();
  };
})();
function _edSetActive(on){
  _editorActive=!!on;
  if(!on) return;
  camZoom=1; camZoomTgt=1;
  camX=camClampX(camX); camY=camClampY(camY);
  _snapRenderCam();
}

/* â”€â”€ LIVE STAGE (LDtk on the typed grid) â”€â”€ */
// Story stages collide on the typed grid and draw from MV_BETA.level.cells, so edits go to both.
// Cell ids: 0 air, 1 solid, 2 one-way, 4/5 ramps, 6/7 pass-through ramps (left/right alone rolls past).
const ED_RAMPS=[{id:4,label:'RAMP \\'},{id:5,label:'RAMP /'},{id:6,label:'PASS \\'},{id:7,label:'PASS /'}];
const ED_CELLS_KEY='mv2.editor.cells.';
function _edLive(){
  return !_stageDesignerMode&&!!(window.MV_BETA&&MV_BETA.level&&MV_BETA.level.cells)
    &&typeof _gridReady==='function'&&_gridReady();
}
function _edCellGet(c,r){
  const t=gridCell(c,r);
  return (t===4||t===5)&&gridSlopePass(c,r)?t+2:t;
}
function _edCellSet(c,r,id){
  const lv=MV_BETA.level;
  if(c<0||r<0||c>=lv.cols||r>=lv.rows) return;
  const t=id===6?4:id===7?5:id, pass=id===6||id===7;
  gridSet(c,r,t,pass?{pass:true}:undefined);
  lv.cells[r][c]=t;
  if(!lv.pass) lv.pass={};
  if(pass) lv.pass[r*lv.cols+c]=true; else delete lv.pass[r*lv.cols+c];
  MV_BETA.surfRow=null;
}
function _edStampCells(cells,id){
  edPushUndo();
  const u=ED.undoStack[ED.undoStack.length-1];
  u.G_=[];
  for(const [c,r] of cells){
    u.G_.push({c,r,id:_edCellGet(c,r)});
    _edCellSet(c,r,id);
    ED.cellEdits[c+','+r]=id;
  }
}
function _edRectCells(x0,y0,x1,y1){
  const T=MV_GRID.tile, out=[];
  const c0=Math.floor(Math.min(x0,x1)/T), c1=Math.floor(Math.max(x0,x1)/T);
  const r0=Math.floor(Math.min(y0,y1)/T), r1=Math.floor(Math.max(y0,y1)/T);
  for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++) out.push([c,r]);
  return out;
}
function _edStageKey(){ return ED_CELLS_KEY+(MV_BETA.stageId||'?'); }
function _edEntsKey(){ return ED_ENTS_KEY+(MV_BETA.stageId||'?'); }
function _edGoneKey(){ return (MV_BETA.goneKey||'mv2.editor.gone.')+(MV_BETA.stageId||'?'); }
function edSaveCells(){
  const n=Object.keys(ED.cellEdits).length, m=ED.ents.length;
  try{
    localStorage.setItem(_edStageKey(), JSON.stringify(ED.cellEdits));
    localStorage.setItem(_edEntsKey(), JSON.stringify(ED.ents.map(en=>({t:en.t,k:en.k,c:en.c,r:en.r}))));
    if(ED.gone.size) localStorage.setItem(_edGoneKey(), JSON.stringify([...ED.gone]));
    else localStorage.removeItem(_edGoneKey());
  }catch(e){}
  edShowToast('SAVED '+n+' BLOCKS + '+m+' THINGS'+(ED.gone.size?' - '+ED.gone.size+' REMOVED':'')+' FOR '+(MV_BETA.stageId||'THIS STAGE'));
}
function edClearCells(){
  try{ localStorage.removeItem(_edStageKey()); localStorage.removeItem(_edEntsKey()); localStorage.removeItem(_edGoneKey()); }catch(e){}
  ED.cellEdits={};
  for(const en of ED.ents) _edEntRemove(en);
  ED.ents=[]; ED.gone=new Set();
  edShowToast('EDITS CLEARED — TAB RESTARTS THE STAGE CLEAN');
}

// Live-stage things: enemies, item crates, seeds/crystals and cubes are spawned through the
// stage's own entity code (MV_BETA.placeEntity), so they act like level-placed ones.
const ED_ENTS_KEY='mv2.editor.ents.';
const ED_LIVE={
  enemy:{label:'ENEMY', kinds:['circle','square','tri','eye','mirror'], names:['A CIRCLE','C SQUARE','B TRI','EYE','D MIRROR']},
  crate:{label:'CRATE', kinds:['TRS','RCA','XLR','MAG'], names:['TRS','RCA','XLR','MAG']},
  knowl:{label:'KNOWL', kinds:['seed','crystal'], names:['SEED','CRYSTAL']},
  bwall:{label:'BWALL', kinds:['omni','push','pull','laser'], names:['OMNI','PUSH','PULL','CAGE']},
};
ED.ents=[];
ED.gone=new Set();          // level things (MV_BETA.entKey) erased on this stage
ED.liveKind={enemy:0, crate:0, knowl:0, bwall:0};
function _edLiveName(t){ const d=ED_LIVE[t]; return d?d.names[ED.liveKind[t]%d.kinds.length]:''; }
function _edEntSpawn(t,k,c,r){
  const B=MV_BETA;
  if(!B||!B.placeEntity) return null;
  const made=t==='enemy'?B.placeEntity('Enemy',c,r,{ai:k})
    :t==='crate'?B.placeEntity('Item',c,r,{item:k})
    :t==='knowl'?B.placeEntity(k==='crystal'?'Crystal':'Seed',c,r,{})
    :t==='bwall'?B.placeEntity('Box',c,r,{kind:k}):null;
  if(!made) return null;
  return made.enemies.length+made.knowls.length+made.bwalls.length+made.drops.length?made:null;
}
function _edEntRemove(en){
  const m=en.made||{}, del=(arr,o)=>{ const i=arr.indexOf(o); if(i>=0) arr.splice(i,1); return i>=0; };
  for(const o of m.enemies||[]) del(ENEMS,o);
  for(const o of m.knowls||[]) del(KDROP,o);
  for(const o of m.drops||[]){ del(ITEM_DROPS,o); if(o._cell&&MV_BETA.crateCells) MV_BETA.crateCells.delete(o._cell); }
  for(const o of m.bwalls||[]){
    if(!del(BWALLS,o)) continue;
    if(typeof gridSyncDestroyedBwall==='function') gridSyncDestroyedBwall(o);
    const T=MV_GRID.tile, c=Math.floor((o.x+T/2)/T), r=Math.floor((o.y+T/2)/T);
    if(gridCell(c,r)===MV_GRID_DESTRUCT) gridSmashCell(c,r);
  }
  kTotal=KDROP.length;
}
// Ground the click: enemies and crates go on the first floor under the cell.
function _edGroundRow(c,r){
  const lv=MV_BETA.level;
  for(let k=0;k<24&&r<lv.rows-1;k++,r++) if(gridCell(c,r+1)&&!gridCell(c,r)) return r;
  return r;
}
function edPlaceLive(t,c,r){
  const d=ED_LIVE[t]; if(!d) return null;
  const k=d.kinds[ED.liveKind[t]%d.kinds.length];
  if(gridCell(c,r)&&!(gridIsSlope&&gridIsSlope(c,r))){ edShowToast('THAT CELL IS SOLID'); return null; }
  if(t==='enemy'||t==='crate') r=_edGroundRow(c,r);
  const made=_edEntSpawn(t,k,c,r);
  if(!made){ edShowToast('CAN\'T PLACE '+d.names[ED.liveKind[t]%d.kinds.length]+' HERE'); return null; }
  const en={t,k,c,r,made};
  ED.ents.push(en);
  edPushUndo(); ED.undoStack[ED.undoStack.length-1].E_=en;
  edShowToast(_edLiveName(t)+' @ '+c+','+r);
  return en;
}
// The live objects an editor thing made, wherever they've wandered to.
function _edEntHit(en,wx,wy){
  const T=MV_GRID.tile, m=en.made||{};
  if(Math.floor(wx/T)===en.c&&Math.floor(wy/T)===en.r) return true;
  for(const o of [...(m.enemies||[]),...(m.drops||[]),...(m.bwalls||[])])
    if(wx>=o.x-4&&wx<=o.x+(o.w||T)+4&&wy>=o.y-4&&wy<=o.y+(o.h||T)+4) return true;
  for(const o of m.knowls||[]) if(Math.abs(wx-o.x)<24&&Math.abs(wy-o.y)<24) return true;
  return false;
}
function edEraseLiveEnt(wx,wy){
  for(let i=ED.ents.length-1;i>=0;i--){
    if(!_edEntHit(ED.ents[i],wx,wy)) continue;
    _edEntRemove(ED.ents[i]);
    edShowToast('REMOVED '+ED_LIVE[ED.ents[i].t].names[ED_LIVE[ED.ents[i].t].kinds.indexOf(ED.ents[i].k)]);
    ED.ents.splice(i,1);
    return true;
  }
  return edEraseLevelEnt(wx,wy);
}
// Level-placed things (tagged _lk by beta_level): erase every live object of that entity
// and remember its key, so SAVE keeps it off the stage on the next load.
function _edLevelObjs(key){
  const has=o=>o&&o._lk===key;
  return {enemies:ENEMS.filter(has), knowls:KDROP.filter(has), drops:ITEM_DROPS.filter(has),
    bwalls:BWALLS.filter(has), rope:has(_mapRopePickup)?_mapRopePickup:null};
}
function _edLevelHit(wx,wy){
  const T=MV_GRID.tile, box=o=>wx>=o.x-4&&wx<=o.x+(o.w||T)+4&&wy>=o.y-4&&wy<=o.y+(o.h||T)+4;
  const cell=Math.floor(wx/T)+','+Math.floor(wy/T);
  for(const o of ENEMS) if(o._lk&&box(o)) return o._lk;
  for(const o of ITEM_DROPS) if(o._lk&&(o._cell===cell||Math.abs(wx-o.x)<24&&Math.abs(wy-o.y)<24)) return o._lk;
  for(const o of BWALLS) if(o._lk&&o.hp>0&&box(o)) return o._lk;
  for(const o of KDROP) if(o._lk&&Math.abs(wx-o.x)<24&&Math.abs(wy-o.y)<24) return o._lk;
  if(_mapRopePickup&&_mapRopePickup._lk&&box(_mapRopePickup)) return _mapRopePickup._lk;
  return null;
}
function _edLevelPut(objs,on){
  const B=MV_BETA, add=(arr,o)=>{ if(!arr.includes(o)) arr.push(o); };
  if(on){
    for(const o of objs.enemies) add(ENEMS,o);
    for(const o of objs.knowls) add(KDROP,o);
    for(const o of objs.drops){ add(ITEM_DROPS,o); if(o._cell&&B.crateCells) B.crateCells.add(o._cell); }
    for(const o of objs.bwalls) add(BWALLS,o);
    if(objs.rope){ _mapRopePickup=objs.rope; if(B.crateCells) B.crateCells.add(Math.floor(objs.rope.x/MV_GRID.tile)+','+Math.floor(objs.rope.y/MV_GRID.tile)); }
    if(objs.bwalls.length&&typeof gridStampLiveBwalls==='function') gridStampLiveBwalls();
    kTotal=KDROP.length;
  } else {
    _edEntRemove({made:objs});
    if(objs.rope){
      if(_mapRopePickup===objs.rope) _mapRopePickup=null;
      if(B.crateCells) B.crateCells.delete(Math.floor(objs.rope.x/MV_GRID.tile)+','+Math.floor(objs.rope.y/MV_GRID.tile));
    }
  }
}
function edEraseLevelEnt(wx,wy){
  const key=_edLevelHit(wx,wy);
  if(!key) return false;
  const objs=_edLevelObjs(key);
  _edLevelPut(objs,false);
  ED.gone.add(key);
  edPushUndo(); ED.undoStack[ED.undoStack.length-1].L_={key,objs};
  edShowToast('REMOVED LEVEL '+key.split('@')[0].toUpperCase()+' - SAVE TO KEEP IT GONE');
  return true;
}
function _edEntBox(en){
  const m=en.made||{}, T=MV_GRID.tile;
  const o=(m.enemies||[])[0]||(m.drops||[])[0]||(m.bwalls||[])[0];
  if(o) return {x:o.x,y:o.y,w:o.w||T,h:o.h||T};
  const k=(m.knowls||[])[0];
  if(k) return {x:k.x-14,y:k.y-14,w:28,h:28};
  return {x:en.c*T,y:en.r*T,w:T,h:T};
}
function edSave(){
  if(_stageDesignerMode) edSaveStage();
  else if(_edLive()) edSaveCells();
  else edSaveRoom();
}
function edTest(){
  edSave();
  _edSetActive(false);
  _respawnPlayer();
  _snapCameraToPlayer(p);
  uiShowToast('TESTING — ` BACK TO THE EDITOR');
}
// Saved edits come back when their stage loads again.
let _edLevelSeen=null;
function edLoadStageEdits(){
  const B=window.MV_BETA;
  _edLevelSeen=B.level;
  ED.cellEdits={}; ED.ents=[]; ED.gone=new Set();
  try{ ED.gone=new Set(JSON.parse(localStorage.getItem(_edGoneKey())||'[]')); }catch(e){}
  if(typeof _gridReady!=='function'||!_gridReady()) return 0;
  let saved=null, ents=null;
  try{ saved=JSON.parse(localStorage.getItem(_edStageKey())||'null'); }catch(e){}
  try{ ents=JSON.parse(localStorage.getItem(_edEntsKey())||'null'); }catch(e){}
  let n=0, m=0;
  for(const k in saved||{}){
    const [c,r]=k.split(',').map(Number);
    _edCellSet(c,r,saved[k]|0); ED.cellEdits[k]=saved[k]|0; n++;
  }
  for(const s of ents||[]){
    const made=ED_LIVE[s.t]&&_edEntSpawn(s.t,s.k,s.c|0,s.r|0);
    if(made){ ED.ents.push({t:s.t,k:s.k,c:s.c|0,r:s.r|0,made}); m++; }
  }
  if(n||m) uiShowToast('EDITOR: '+n+' SAVED BLOCKS + '+m+' THINGS LOADED');
  return n+m;
}
setInterval(()=>{
  if(/[?&](selftest|ci)=/i.test(location.search||'')) return;
  const B=window.MV_BETA;
  if(!B||!B.level||B.loading||B.level===_edLevelSeen) return;
  edLoadStageEdits();
},300);

/* â”€â”€ SNAP HELPER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function edSnap(v){ return ED.snapEnabled ? Math.round(v/ED.snap)*ED.snap : Math.round(v); }

/* â”€â”€ WORLD COORDS FROM SCREEN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function edToWorldRaw(sx_, sy_){
  const z=camZoom>0?camZoom:1, S=MV2_VISUAL?1:SMS_SCALE;
  return { x:(sx_/z-_mapEdScreenOx())*S+_rcamX, y:(sy_/z)*S+_rcamY };
}
function edToWorld(sx_, sy_){ const w=edToWorldRaw(sx_,sy_); return { x: edSnap(w.x), y: edSnap(w.y) }; }

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
  if(snap.G_&&_edLive()) for(const g of snap.G_.slice().reverse()){ _edCellSet(g.c,g.r,g.id); ED.cellEdits[g.c+','+g.r]=g.id; }
  if(snap.E_){ const i=ED.ents.indexOf(snap.E_); if(i>=0){ _edEntRemove(snap.E_); ED.ents.splice(i,1); } }
  if(snap.L_){ _edLevelPut(snap.L_.objs,true); ED.gone.delete(snap.L_.key); }
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
  if(mx < ED.panelW){
    for(let i=ED.hits.length-1;i>=0;i--){
      const h=ED.hits[i];
      if(mx>=h.x&&mx<=h.x+h.w&&my>=h.y&&my<=h.y+h.h){ h.fn(); break; }
    }
    return;
  }
  _edMouseDown=true;
  const w=edToWorld(mx,my);
  const raw=edToWorldRaw(mx,my);
  if(_edLive()&&(ED.tool==='ramp'||ED.tool==='erase'||ED_LIVE[ED.tool])){
    const T=MV_GRID.tile, c=Math.floor(raw.x/T), r=Math.floor(raw.y/T);
    if(ED.tool==='ramp'){ _edStampCells([[c,r]],ED_RAMPS[ED.rampIdx].id); return; }
    if(ED.tool==='erase'&&edEraseLiveEnt(raw.x,raw.y)) return;
    if(ED.tool==='erase'&&_edCellGet(c,r)){ _edStampCells([[c,r]],0); return; }
    if(ED_LIVE[ED.tool]){ _edMouseDown=false; edPlaceLive(ED.tool,c,r); return; }
  }
  if(ED.tool==='platform'||ED.tool==='bwall'){
    ED.dragging=true; ED.dragStart={...w}; ED.dragEnd={...w};
    ED.dragStartRaw=raw; ED.dragEndRaw=raw;
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
    ED.dragEndRaw=edToWorldRaw(mx,my);
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
    if(ED.tool==='platform'&&_edLive()){
      const a=ED.dragStartRaw, b=ED.dragEndRaw;
      _edStampCells(_edRectCells(a.x,a.y,b.x,b.y),ED.platType==='oneway'?2:1);
    }
    else if(ED.tool==='platform') edAddPlat(x,y,w||ED.snap,h||ED.snap,ED.platType);
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
        _edSetActive(!_editorActive);
        edShowToast(_editorActive?'EDITOR ON — ` to exit':'EDITOR OFF');
      }
    }
    e.preventDefault(); return;
  }
  if(typeof _mapEdActive!=='undefined'&&_mapEdActive) return;
  if(!_editorActive) return;
  // Save
  if(e.shiftKey&&e.code==='KeyS'){ edSave(); e.preventDefault(); return; }
  if(e.code==='Enter'){ edTest(); e.preventDefault(); return; }
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
  const shortcuts={'KeyP':'platform','KeyN':'enemy','KeyC':'crate','KeyK':'knowl','KeyB':'bwall','KeyR':'erase','KeyL':'ramp'};
  if(shortcuts[e.code]){ ED.tool=shortcuts[e.code]; edShowToast('Tool: '+ED.tool); e.preventDefault(); return; }
  if(e.code==='Tab'&&ED.tool==='ramp'){
    ED.rampIdx=(ED.rampIdx+1)%ED_RAMPS.length;
    edShowToast('Ramp: '+ED_RAMPS[ED.rampIdx].label); e.preventDefault(); return;
  }
  // Cycle platform type
  if(e.code==='Tab'&&ED.tool==='platform'){
    const types=['solid','oneway','ceil'];
    ED.platType=types[(types.indexOf(ED.platType)+1)%types.length];
    edShowToast('Platform: '+ED.platType); e.preventDefault(); return;
  }
  if(e.code==='Tab'&&ED_LIVE[ED.tool]&&_edLive()){
    ED.liveKind[ED.tool]=(ED.liveKind[ED.tool]+1)%ED_LIVE[ED.tool].kinds.length;
    edShowToast(ED_LIVE[ED.tool].label+': '+_edLiveName(ED.tool)); e.preventDefault(); return;
  }
  // Cycle enemy type
  if(e.code==='Tab'&&ED.tool==='enemy'){
    const etypes=['ball','square','triangle','star'];
    ED.enemyType=etypes[(etypes.indexOf(ED.enemyType)+1)%etypes.length];
    edShowToast('Rival: '+ED.enemyType); e.preventDefault(); return;
  }
  // Camera scroll in editor
  if(e.code==='ArrowRight'){ camX=camClampX(camX+40); e.preventDefault(); return; }
  if(e.code==='ArrowLeft'){  camX=camClampX(camX-40); e.preventDefault(); return; }
  if(e.code==='ArrowDown'){  camY=camClampY(camY+40); e.preventDefault(); return; }
  if(e.code==='ArrowUp'){    camY=camClampY(camY-40); e.preventDefault(); return; }
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

  ED.hits.length=0;
  const live=_edLive(), PX=ED.panelW, S=MV2_VISUAL?1:SMS_SCALE;
  // Semi-transparent grid (tile grid on a live stage)
  ctx.save();
  ctx.strokeStyle='rgba(255,255,255,0.07)';
  ctx.lineWidth=0.5;
  const gs=(live?MV_GRID.tile:ED.snap)/S;
  const offX=(_rcamX/S)%gs, offY=(_rcamY/S)%gs;
  for(let x=PX-offX;x<W;x+=gs){ if(x<PX) continue; ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke(); }
  for(let y=-offY;y<H;y+=gs){ ctx.beginPath();ctx.moveTo(PX,y);ctx.lineTo(W,y);ctx.stroke(); }

  if(live){
    // pass-through ramps look like ramps in the world; mark them here
    const T=MV_GRID.tile, lv=MV_BETA.level;
    const c0=Math.max(0,Math.floor(_rcamX/T)), c1=Math.min(lv.cols-1,Math.ceil((_rcamX+(W-PX)*S)/T));
    const r0=Math.max(0,Math.floor(_rcamY/T)), r1=Math.min(lv.rows-1,Math.ceil((_rcamY+H*S)/T));
    ctx.setLineDash([4,3]); ctx.strokeStyle='#6ef4ff'; ctx.lineWidth=2;
    for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++){
      const id=_edCellGet(c,r); if(id!==6&&id!==7) continue;
      const x=sx(c*T), y=sy(r*T), z=sw(T);
      ctx.strokeRect(x+1,y+1,z-2,z-2);
      ctx.beginPath();
      if(id===7){ ctx.moveTo(x,y+z); ctx.lineTo(x+z,y); } else { ctx.moveTo(x,y); ctx.lineTo(x+z,y+z); }
      ctx.stroke();
    }
    ctx.strokeStyle='#e8a0ff';
    for(const en of ED.ents){
      const b=_edEntBox(en);
      ctx.strokeRect(sx(b.x)-2,sy(b.y)-2,sw(b.w)+4,sw(b.h)+4);
    }
    ctx.setLineDash([]);
    if(ED.hoverX>=PX){
      const hw=edToWorldRaw(ED.hoverX,ED.hoverY), hc=Math.floor(hw.x/T), hr=Math.floor(hw.y/T);
      ctx.strokeStyle='#ffe46a'; ctx.lineWidth=2;
      ctx.strokeRect(sx(hc*T)+0.5,sy(hr*T)+0.5,sw(T)-1,sw(T)-1);
    }
  }

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
    ['L','RAMP',ED_RAMPS[ED.rampIdx].label],
    ['N','ENEMY',live?_edLiveName('enemy'):ED.enemyType],
    ['C','CRATE',live?_edLiveName('crate'):'28X28'],
    ['K','KNOWL',live?_edLiveName('knowl'):'DROP'],
    ['B','BWALL',live?_edLiveName('bwall'):'HP:'+ED.bwallHp],
    ['R','ERASE',''],
  ];
  let ty=38;
  for(const [key,name,sub] of tools){
    if(name==='RAMP'&&!live) continue;
    const id=name.toLowerCase();
    const active=ED.tool===id;
    ctx.fillStyle=active?'rgba(80,200,255,0.25)':'rgba(255,255,255,0.04)';
    ctx.fillRect(6,ty-2,PW-12,22);
    drawText('['+key+'] '+name, 10, ty+2, active?C.CYAN:C.SILVER, 1);
    if(sub) drawText(String(sub), 118, ty+2, C.SAND, 1);
    ED.hits.push({label:name,x:6,y:ty-2,w:PW-12,h:22,fn:()=>{
      if(ED.tool===id&&id==='ramp') ED.rampIdx=(ED.rampIdx+1)%ED_RAMPS.length;
      else if(ED.tool===id&&live&&ED_LIVE[id]) ED.liveKind[id]=(ED.liveKind[id]+1)%ED_LIVE[id].kinds.length;
      else if(ED.tool===id&&id==='platform') ED.platType=ED.platType==='solid'?'oneway':'solid';
      ED.tool=id;
    }});
    ty+=24;
  }

  ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fillRect(10,ty,PW-20,1); ty+=10;

  const help=[
    'CLICK AGAIN / TAB: TYPE',
    (live?'PASS: ROLL PAST, UP CLIMBS':''),
    'G  SNAP ('+( ED.snapEnabled?'ON':'OFF')+')',
    'ARROWS  SCROLL',
    'CTRL+Z  UNDO',
    'SHIFT+S SAVE  ENTER TEST',
    (live?'':'SHIFT+E  EXPORT JS'),
    (live?'':'M  RENAME STAGE'),
    (_stageDesignerMode?'T  SET SPAWN':''),
    '`  EXIT EDITOR',
  ];
  for(const h of help){ if(!h) continue; drawText(h, 10, ty, C.SILVER, 1); ty+=14; }

  ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fillRect(10,ty,PW-20,1); ty+=10;
  if(live){
    drawText('STAGE: '+(MV_BETA.stageId||'?'), 10, ty, C.CYAN, 1); ty+=14;
    drawText('EDITED BLOCKS: '+Object.keys(ED.cellEdits).length, 10, ty, C.SILVER, 1); ty+=14;
    drawText('PLACED THINGS: '+ED.ents.length, 10, ty, C.SILVER, 1); ty+=14;
  }else{
    drawText('ROOM: '+ED.roomName, 10, ty, C.CYAN, 1); ty+=14;
    drawText('PLATS: '+(TR.length-4), 10, ty, C.SILVER, 1); ty+=14;
    drawText('ENEMIES: '+ENEMS.length, 10, ty, C.SILVER, 1); ty+=14;
    drawText('CRATES: '+CRATES.length, 10, ty, C.SILVER, 1); ty+=14;
    drawText('KNOWLS: '+KDROP.length, 10, ty, C.SILVER, 1); ty+=14;
  }

  const btn=(label,x,y,w,on,fn)=>{
    ctx.fillStyle=on?'#245a78':'#1a1624'; ctx.fillRect(x,y,w,28);
    ctx.strokeStyle=on?'#9ef':'#3a3450'; ctx.lineWidth=1; ctx.strokeRect(x+0.5,y+0.5,w-1,27);
    drawTextC(label, x+w/2, y+8, on?C.WHITE:C.SILVER, 1);
    ED.hits.push({label,x,y,w,h:28,fn});
  };
  const bw=(PW-26)/2, by=H-110;
  btn('SAVE',10,by,bw,true,()=>edSave());
  btn('TEST',16+bw,by,bw,true,()=>edTest());
  btn(live?'CLEAR':'UNDO',10,by+34,bw,false,()=>live?edClearCells():edUndo());
  btn('EXIT',16+bw,by+34,bw,false,()=>{ _edSetActive(false); uiShowToast('EDITOR OFF'); });

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

