// ============================================================
//  Mind & Venture — map_edit.js
//  Awdjoo Town tile / collision / enemy editor.
//  Edits live tile arrays + the typed grid. Patch saved in localStorage.
//  Does not rewrite awdjoo_map.js (that file stays generated from Tiled).
// ============================================================

const MAPED_STORE='mv_awdjoo_patch_v1';
let _mapEdActive=false;
const MAPED={
  tool:'paint',
  role:'both',
  layer:'grass',
  coll:1,
  gid:1,
  enemy:'ball',
  showColl:false,
  pick:-1,
  spawnOff:0,
  mx:0, my:0,
  hoverC:0, hoverR:0,
  painting:false,
  lastKey:'',
  undo:[],
  hits:[],
  toast:'', toastF:0,
  palettePage:0,
};

const MAPED_LAYERS=[
  {id:'dirt', label:'BACK'},
  {id:'grass', label:'MID'},
  {id:'destruct', label:'BREAK'},
  {id:'fg', label:'FRONT'},
];
const MAPED_ROLES=[
  {id:'scenario', label:'LOOK'},
  {id:'collision', label:'HIT'},
  {id:'both', label:'BOTH'},
];
const MAPED_COLL=[
  {id:0, label:'AIR'},
  {id:1, label:'SOLID'},
  {id:2, label:'ONEWAY'},
  {id:3, label:'BREAK'},
  {id:4, label:'SL \\'},
  {id:5, label:'SL /'},
];
const MAPED_ENEMIES=[
  {id:'ball', label:'BALL'},
  {id:'square', label:'SQR'},
  {id:'triangle', label:'TRI'},
  {id:'star', label:'STAR'},
];
const MAPED_PANEL=236;
const MAPED_PAL_H=72;
const MAPED_PIN={
  mind:'#e8a0ff', signol:'#ff8844', minion:'#66e0a8',
  player:'#6cff7a', laitu:'#a8d4ff',
};

function _mapEdSelftest(){
  return typeof location!=='undefined'&&/[?&](selftest|ci)=/i.test(location.search||'');
}
function _mapEdToast(msg){
  MAPED.toast=msg; MAPED.toastF=140;
  if(typeof edShowToast==='function') edShowToast(msg);
  else if(typeof uiShowToast==='function') uiShowToast(msg);
}
function _mapEdCan(){
  return typeof _mapApplied!=='undefined'&&_mapApplied&&_tmjDraw&&!_battleTestMode&&!_runTestMode&&!_stageDesignerMode;
}
function _mapEdTile(){
  const d=_tmjDraw;
  return (d&&d.tw&&d.sc)?d.tw*d.sc:32;
}
function _mapEdWorld(mx,my){
  const z=typeof camZoom==='undefined'?1:camZoom;
  return {x:mx/z+(typeof camX==='undefined'?0:camX), y:my/z+(typeof camY==='undefined'?0:camY)};
}
function _mapEdCell(wx,wy){
  const t=_mapEdTile();
  const d=_tmjDraw||{mw:100,mh:100};
  return {
    c:Math.max(0,Math.min(d.mw-1,Math.floor(wx/t))),
    r:Math.max(0,Math.min(d.mh-1,Math.floor(wy/t))),
  };
}
function _mapEdEnsureLayer(id){
  const d=_tmjDraw; if(!d) return null;
  const n=d.mw*d.mh;
  const make=()=>{ const a=new Array(n); for(let i=0;i<n;i++) a[i]=0; return a; };
  if(id==='dirt'){ if(!d.bgData) d.bgData=make(); return d.bgData; }
  if(id==='grass'){ if(!d.canvasData) d.canvasData=d.data||make(); return d.canvasData; }
  if(id==='destruct'){ if(!d.destructData) d.destructData=make(); return d.destructData; }
  if(id==='fg'){ if(!d.fgData) d.fgData=make(); return d.fgData; }
  return null;
}
function _mapEdLayerGid(c,r,id){
  const arr=_mapEdEnsureLayer(id||MAPED.layer);
  const d=_tmjDraw; if(!arr||!d) return 0;
  return (typeof _tmjGid==='function'?_tmjGid(arr[r*d.mw+c]):arr[r*d.mw+c])|0;
}
function _mapEdPushUndo(rec){
  MAPED.undo.push(rec);
  if(MAPED.undo.length>200) MAPED.undo.shift();
}
function _mapEdHit(x,y,w,h,fn){ MAPED.hits.push({x,y,w,h,fn}); }

function _mapEdToggle(force){
  if(_mapEdSelftest()) return;
  if(force===false||(_mapEdActive&&force!==true)){
    _mapEdActive=false;
    _mapEdToast('EDIT OFF — ` or F2');
    return;
  }
  if(!_mapEdCan()){
    _mapEdToast('Edit needs Awdjoo Town loaded');
    return;
  }
  _mapEdActive=true;
  if(typeof _editorActive!=='undefined') _editorActive=false;
  _mapEdToast('EDIT — PAINT tiles or SPAWN actors');
}

function _mapEdApplySaved(){
  if(_mapEdSelftest()||!_tmjDraw) return;
  let patch=null;
  try{ patch=JSON.parse(localStorage.getItem(MAPED_STORE)||'null'); }catch(e){ return; }
  if(!patch) return;
  const d=_tmjDraw;
  for(const t of patch.tiles||[]){
    const arr=_mapEdEnsureLayer(t.layer);
    if(!arr||t.i<0||t.i>=arr.length) continue;
    arr[t.i]=t.gid|0;
  }
  if(typeof gridSet==='function'){
    for(const g of patch.grid||[]) gridSet(g.c|0,g.r|0,g.type|0);
  }
  for(const e of patch.enemies||[]){
    if(e.op==='add'&&typeof _dispatchMindSpawnAt==='function'){
      const tw=d.tw, sc=d.sc, col=e.col|0, row=e.row|0;
      const cx=(col+0.5)*tw*sc;
      const head=row*d.th*sc;
      _dispatchMindSpawnAt(cx, head, row, col, d.mw, tw, sc);
    }
  }
}

function _mapEdCollectPatch(){
  return JSON.parse(localStorage.getItem(MAPED_STORE)||'{"tiles":[],"grid":[],"enemies":[]}');
}
function _mapEdWritePatch(mut){
  const patch=_mapEdCollectPatch();
  mut(patch);
  try{ localStorage.setItem(MAPED_STORE, JSON.stringify(patch)); }catch(e){}
}
function _mapEdRecordTile(layer,i,gid){
  _mapEdWritePatch(p=>{
    p.tiles=p.tiles||[];
    const hit=p.tiles.find(t=>t.layer===layer&&t.i===i);
    if(hit) hit.gid=gid; else p.tiles.push({layer,i,gid});
  });
}
function _mapEdRecordGrid(c,r,type){
  _mapEdWritePatch(p=>{
    p.grid=p.grid||[];
    const hit=p.grid.find(g=>g.c===c&&g.r===r);
    if(hit) hit.type=type; else p.grid.push({c,r,type});
  });
}

let _mapEdSlopeGidCache=null;
function _mapEdSlopeKindForGid(gid){
  gid=(typeof _tmjGid==='function'?_tmjGid(gid):gid)|0;
  if(!gid) return null;
  if(!_mapEdSlopeGidCache){
    const base=typeof MV_GRID_SLOPE_GIDS!=='undefined'?MV_GRID_SLOPE_GIDS:{31:'L',44:'R'};
    _mapEdSlopeGidCache=Object.assign({},base);
    const data=typeof window!=='undefined'?window.MV_STAGE0_MAP:null;
    if(data&&typeof _gridReadTilesetSlopes==='function'){
      Object.assign(_mapEdSlopeGidCache,_gridReadTilesetSlopes(data));
    }
  }
  return _mapEdSlopeGidCache[gid]||null;
}
function _mapEdSetGid(gid){
  MAPED.gid=gid;
  const kind=_mapEdSlopeKindForGid(gid);
  if(kind==='L') MAPED.coll=4;
  else if(kind==='R') MAPED.coll=5;
}
function _mapEdFillSlopeCell(c,r,t,fill){
  const x=sx(c*t), y=sy(r*t), w=sw(t), h=sw(t);
  const typ=typeof gridCell==='function'?gridCell(c,r):MAPED.coll;
  ctx.beginPath();
  if(typ===5){ ctx.moveTo(x,y+h); ctx.lineTo(x+w,y+h); ctx.lineTo(x+w,y); }
  else { ctx.moveTo(x,y); ctx.lineTo(x,y+h); ctx.lineTo(x+w,y+h); }
  ctx.closePath();
  ctx.fillStyle=fill;
  ctx.fill();
  ctx.strokeStyle='rgba(255,230,90,0.9)';
  ctx.lineWidth=2;
  ctx.beginPath();
  if(typ===5){ ctx.moveTo(x,y+h); ctx.lineTo(x+w,y); }
  else { ctx.moveTo(x,y); ctx.lineTo(x+w,y+h); }
  ctx.stroke();
}
function _mapEdPaintAt(c,r,erase){
  const d=_tmjDraw; if(!d||c<0||r<0||c>=d.mw||r>=d.mh) return;
  const i=r*d.mw+c;
  const key=c+','+r+','+MAPED.tool+','+MAPED.role+','+MAPED.layer;
  if(MAPED.lastKey===key&&MAPED.painting) return;
  MAPED.lastKey=key;
  const prevGid=_mapEdLayerGid(c,r);
  const prevColl=typeof gridCell==='function'?gridCell(c,r):0;
  _mapEdPushUndo({c,r,layer:MAPED.layer,gid:prevGid,coll:prevColl,i});

  if(MAPED.tool==='erase'||erase){
    if(MAPED.role!=='collision'){
      const arr=_mapEdEnsureLayer(MAPED.layer);
      if(arr){ arr[i]=0; _mapEdRecordTile(MAPED.layer,i,0); }
    }
    if(MAPED.role!=='scenario'&&typeof gridSet==='function'){
      gridSet(c,r,0); _mapEdRecordGrid(c,r,0);
    }
    return;
  }
  if(MAPED.tool==='paint'){
    if(MAPED.role!=='collision'){
      const arr=_mapEdEnsureLayer(MAPED.layer);
      if(arr){ arr[i]=MAPED.gid; _mapEdRecordTile(MAPED.layer,i,MAPED.gid); }
    }
    if(MAPED.role!=='scenario'&&typeof gridSet==='function'){
      let coll=MAPED.coll;
      const kind=_mapEdSlopeKindForGid(MAPED.gid);
      if(kind==='L') coll=4;
      else if(kind==='R') coll=5;
      gridSet(c,r,coll); _mapEdRecordGrid(c,r,coll);
    }
  }
}

function _mapEdEnemyLabel(id){
  const it=MAPED_ENEMIES.find(e=>e.id===id);
  return it?it.label:String(id||'?').toUpperCase().slice(0,4);
}
function _mapEdFocus(wx,wy){
  if(typeof camClampX==='function') camX=camClampX(wx-(typeof camViewW==='function'?camViewW():W)/2);
  if(typeof camClampY==='function') camY=camClampY(wy-(typeof camViewH==='function'?camViewH():H)/2);
  if(typeof _snapRenderCam==='function') _snapRenderCam();
}
function _mapEdListSpawns(){
  const t=_mapEdTile();
  const out=[], seen=new Set();
  const add=(kind,label,wx,wy,col,row,src,idx)=>{
    if(!isFinite(wx)||!isFinite(wy)) return;
    const key=kind+','+Math.round(wx/8)+','+Math.round(wy/8);
    if(seen.has(key)) return;
    seen.add(key);
    out.push({kind,label,wx,wy,col,row,src,idx});
  };
  if(typeof _mapEnemyDefs!=='undefined'){
    for(let i=0;i<_mapEnemyDefs.length;i++){
      const d=_mapEnemyDefs[i]; if(!d) continue;
      const wx=d.x!=null?d.x+(typeof SW!=='undefined'?SW/2:32):((d.col+0.5)*t);
      const wy=d.y!=null?d.y:((d.row+1)*t);
      add('mind',_mapEdEnemyLabel(d.shape),wx,wy,d.col,d.row,'edef',i);
    }
  }
  if(typeof _mapSignolDefs!=='undefined'){
    for(let i=0;i<_mapSignolDefs.length;i++){
      const d=_mapSignolDefs[i]; if(!d) continue;
      add('signol','SIG',d.x,d.y||0,d.col,d.row,'sdef',i);
    }
  }
  if(typeof _mapMinionDefs!=='undefined'){
    for(let i=0;i<_mapMinionDefs.length;i++){
      const d=_mapMinionDefs[i]; if(!d) continue;
      add('minion',String(d.kind||'MIN').toUpperCase().slice(0,4),d.x,d.y||0,d.col,d.row,'mdef',i);
    }
  }
  if(typeof ENEMS!=='undefined'){
    for(let i=0;i<ENEMS.length;i++){
      const e=ENEMS[i]; if(!e) continue;
      const wx=e.x+(e.w||64)*0.5;
      const wy=e.y+(typeof FEET_OFF!=='undefined'?FEET_OFF:88);
      const kind=e._battleSignol||e.signol?'signol':(e.mind?'mind':'minion');
      add(kind,e.mind?_mapEdEnemyLabel(e.shape):(e.signol||e._battleSignol?'SIG':'MIN'),wx,wy,null,null,'live',i);
    }
  }
  if(typeof _spawnX==='number'){
    add('player','YOU',_spawnX+(typeof SW!=='undefined'?SW/2:32),_spawnY+(typeof FEET_OFF!=='undefined'?FEET_OFF:88),null,null,'player',0);
  }
  if(typeof _mapLaituSpawn==='object'&&_mapLaituSpawn){
    add('laitu','LAI',_mapLaituSpawn.x,_mapLaituSpawn.feetY||_mapLaituSpawn.y,null,null,'laitu',0);
  }
  return out;
}
function _mapEdHitSpawn(wx,wy,list){
  let best=null, bestD=42*42;
  for(const sp of list){
    const dx=wx-sp.wx, dy=wy-sp.wy;
    const d=dx*dx+dy*dy;
    if(d<bestD){ bestD=d; best=sp; }
  }
  return best;
}
function _mapEdDrawPin(sp,sel){
  const x=sx(sp.wx), y=sy(sp.wy);
  if(x<-40||x>W+40||y<-50||y>H+40) return;
  const col=MAPED_PIN[sp.kind]||'#ffe46a';
  const pulse=sel||MAPED.tool==='enemy';
  ctx.fillStyle='rgba(0,0,0,0.55)';
  ctx.fillRect(x-6,y-36,44,20);
  ctx.fillStyle=col;
  ctx.fillRect(x-1,y-32,3,32);
  ctx.fillRect(x-5,y-36,40,16);
  ctx.fillStyle='#0a0810';
  drawText(sp.label,x-3,y-33,C.BLACK,1);
  ctx.fillStyle=col;
  ctx.beginPath();
  ctx.moveTo(x,y+3); ctx.lineTo(x-5,y-5); ctx.lineTo(x+5,y-5);
  ctx.closePath(); ctx.fill();
  if(pulse){
    ctx.strokeStyle=col;
    ctx.lineWidth=sel?3:2;
    const r=10+((fr>>2)&3);
    ctx.strokeRect((x-r)|0,(y-r)|0,r*2,r*2);
  }
}

function _mapEdPlaceEnemy(c,r){
  const d=_tmjDraw; if(!d) return;
  const t=_mapEdTile();
  const cx=(c+0.5)*t;
  let feet=(r+1)*t;
  if(typeof gridStandY==='function'){
    const s=gridStandY(cx, feet, {maxUp:t, maxDrop:t*3});
    if(s!=null) feet=s;
  }
  const shape=MAPED.enemy;
  if(typeof _mkMindEnemy==='function'){
    ENEMS.push(_mkMindEnemy(shape,cx,feet,{
      mn:Math.floor(cx-140), mx:Math.floor(cx+140), campaignAi:true,
    }));
  }
  if(typeof _mapEnemyDefs!=='undefined'){
    _mapEnemyDefs.push({
      shape, x:Math.floor(cx-(typeof SW!=='undefined'?SW/2:32)), y:feet,
      col:c, row:r, mn:Math.floor(cx-140), mx:Math.floor(cx+140),
    });
  }
  _mapEdWritePatch(p=>{
    p.enemies=p.enemies||[];
    p.enemies.push({op:'add',col:c,row:r,shape});
  });
  _mapEdToast('Enemy '+shape+' @ '+c+','+r);
}
function _mapEdRemoveEnemyAt(wx,wy){
  const hit=_mapEdHitSpawn(wx,wy,_mapEdListSpawns());
  if(!hit||hit.kind==='player'||hit.kind==='laitu') return false;
  if(hit.src==='edef'&&typeof _mapEnemyDefs!=='undefined') _mapEnemyDefs.splice(hit.idx,1);
  if(hit.src==='sdef'&&typeof _mapSignolDefs!=='undefined') _mapSignolDefs.splice(hit.idx,1);
  if(hit.src==='mdef'&&typeof _mapMinionDefs!=='undefined') _mapMinionDefs.splice(hit.idx,1);
  if(typeof ENEMS!=='undefined'){
    for(let i=ENEMS.length-1;i>=0;i--){
      const e=ENEMS[i]; if(!e) continue;
      const ex=e.x+(e.w||64)*0.5, ey=e.y+(typeof FEET_OFF!=='undefined'?FEET_OFF:88);
      if(Math.abs(wx-ex)<48&&Math.abs(wy-ey)<56) ENEMS.splice(i,1);
    }
  }
  _mapEdWritePatch(p=>{
    p.enemies=p.enemies||[];
    p.enemies.push({op:'remove',x:Math.round(hit.wx),y:Math.round(hit.wy)});
  });
  MAPED.pick=-1;
  _mapEdToast('Removed '+hit.label);
  return true;
}

function _mapEdEyedrop(c,r){
  const gid=_mapEdLayerGid(c,r);
  if(gid) MAPED.gid=gid;
  if(typeof gridCell==='function') MAPED.coll=gridCell(c,r);
  _mapEdToast('Pick gid '+MAPED.gid+'  coll '+MAPED.coll);
}

function _mapEdUndo(){
  const u=MAPED.undo.pop();
  if(!u){ _mapEdToast('Nothing to undo'); return; }
  const d=_tmjDraw; if(!d) return;
  const arr=_mapEdEnsureLayer(u.layer);
  if(arr){ arr[u.i]=u.gid; _mapEdRecordTile(u.layer,u.i,u.gid); }
  if(typeof gridSet==='function'){ gridSet(u.c,u.r,u.coll); _mapEdRecordGrid(u.c,u.r,u.coll); }
  _mapEdToast('Undo');
}

function _mapEdClearPatch(){
  try{ localStorage.removeItem(MAPED_STORE); }catch(e){}
  _mapEdToast('Patch cleared — reload to restore Tiled map');
}

function _mapEdExport(){
  const blob=new Blob([JSON.stringify(_mapEdCollectPatch(),null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='awdjoo-edit-patch.json';
  a.click();
  _mapEdToast('Patch downloaded');
}

function _mapEdPaletteGids(){
  const used=new Set();
  const d=_tmjDraw;
  if(d){
    for(const id of ['dirt','grass','destruct','fg']){
      const arr=_mapEdEnsureLayer(id);
      if(!arr) continue;
      for(let i=0;i<arr.length;i++){
        const g=typeof _tmjGid==='function'?_tmjGid(arr[i]):arr[i];
        if(g&&g<157) used.add(g);
      }
    }
  }
  if(!used.size){ for(let g=1;g<=48;g++) used.add(g); }
  const list=[...used].sort((a,b)=>a-b);
  if(!list.includes(MAPED.gid)) list.unshift(MAPED.gid);
  return list;
}

function _mapEdInUi(mx,my){
  return mx<MAPED_PANEL || (MAPED.tool!=='enemy'&&my>H-MAPED_PAL_H);
}

function _mapEdClickUi(mx,my){
  for(let i=MAPED.hits.length-1;i>=0;i--){
    const h=MAPED.hits[i];
    if(mx>=h.x&&mx<=h.x+h.w&&my>=h.y&&my<=h.y+h.h){ h.fn(); return true; }
  }
  return false;
}

function _mapEdPaintFromMouse(mx,my,erase,eyedrop){
  if(_mapEdInUi(mx,my)) return;
  const w=_mapEdWorld(mx,my);
  const cell=_mapEdCell(w.x,w.y);
  MAPED.hoverC=cell.c; MAPED.hoverR=cell.r;
  if(eyedrop&&MAPED.tool!=='enemy'){ _mapEdEyedrop(cell.c,cell.r); return; }
  if(MAPED.tool==='enemy'){
    if(erase||(eyedrop&&_mapEdRemoveEnemyAt(w.x,w.y))) return;
    const hit=_mapEdHitSpawn(w.x,w.y,_mapEdListSpawns());
    if(hit&&(hit.kind==='mind'||hit.kind==='signol'||hit.kind==='minion')){
      if(erase){ _mapEdRemoveEnemyAt(w.x,w.y); return; }
      const list=_mapEdListSpawns();
      MAPED.pick=list.indexOf(list.find(s=>s.wx===hit.wx&&s.wy===hit.wy)||hit);
      _mapEdToast(hit.label+' @ '+Math.round(hit.wx)+','+Math.round(hit.wy));
      return;
    }
    _mapEdPlaceEnemy(cell.c,cell.r);
    return;
  }
  _mapEdPaintAt(cell.c,cell.r,erase);
}

function _mapEdUpdate(){
  if(!_mapEdActive) return;
  const spd=18;
  if(typeof isLf==='function'&&isLf()) camX=camClampX(camX-spd);
  if(typeof isRt==='function'&&isRt()) camX=camClampX(camX+spd);
  if(typeof isUp==='function'&&isUp()) camY=camClampY(camY-spd);
  if(typeof isDn==='function'&&isDn()) camY=camClampY(camY+spd);
  if(typeof _snapRenderCam==='function') _snapRenderCam();
}

function drawMapEditOverlay(){
  if(!_mapEdActive||!_tmjDraw) return;
  MAPED.hits.length=0;
  const d=_tmjDraw, t=_mapEdTile();
  const w=_mapEdWorld(MAPED.mx,MAPED.my);
  const cell=_mapEdCell(w.x,w.y);
  MAPED.hoverC=cell.c; MAPED.hoverR=cell.r;

  if(MAPED.showColl&&typeof gridCell==='function'){
    const c0=Math.max(0,Math.floor(camX/t)-1), c1=Math.min(d.mw-1,Math.floor((camX+camViewW())/t)+1);
    const r0=Math.max(0,Math.floor(camY/t)-1), r1=Math.min(d.mh-1,Math.floor((camY+camViewH())/t)+1);
    const cols={1:'rgba(220,40,40,0.28)',2:'rgba(60,180,220,0.32)',3:'rgba(220,120,30,0.32)',4:'rgba(240,210,40,0.32)',5:'rgba(80,220,80,0.32)'};
    for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++){
      const typ=gridCell(c,r);
      if(!typ||!cols[typ]) continue;
      if(typ===4||typ===5) _mapEdFillSlopeCell(c,r,t,cols[typ]);
      else{
        ctx.fillStyle=cols[typ];
        ctx.fillRect(sx(c*t),sy(r*t),sw(t),sw(t));
      }
    }
  }

  const spawns=_mapEdListSpawns();
  const hoverSpawn=_mapEdHitSpawn(w.x,w.y,spawns);
  for(let i=0;i<spawns.length;i++){
    _mapEdDrawPin(spawns[i], i===MAPED.pick || spawns[i]===hoverSpawn);
  }

  const hx=sx(cell.c*t), hy=sy(cell.r*t);
  ctx.strokeStyle=MAPED.tool==='enemy'?'#e8a0ff':'#ffe46a'; ctx.lineWidth=2;
  ctx.strokeRect(hx+0.5,hy+0.5,t-1,t-1);
  if(MAPED.tool==='enemy'){
    _mapEdDrawPin({kind:'mind',label:_mapEdEnemyLabel(MAPED.enemy),wx:(cell.c+0.5)*t,wy:(cell.r+1)*t},true);
  }

  ctx.fillStyle='rgba(8,6,16,0.94)';
  ctx.fillRect(0,0,MAPED_PANEL,H);
  ctx.strokeStyle='rgba(140,200,255,0.4)';
  ctx.strokeRect(0.5,0.5,MAPED_PANEL-1,H-1);

  let y=10;
  drawText('AWDJOO EDIT',10,y,C.CYAN,2); y+=20;
  drawText('` / F2 EXIT',10,y,C.SILVER,1); y+=16;

  const btn=(label,on,fn,x,bw,h)=>{
    const xx=x==null?10:x, hh=h||24, ww=bw||(MAPED_PANEL-20);
    ctx.fillStyle=on?'rgba(80,200,255,0.4)':'rgba(255,255,255,0.06)';
    ctx.fillRect(xx,y,ww,hh);
    if(on){ ctx.strokeStyle='#9ef'; ctx.strokeRect(xx+0.5,y+0.5,ww-1,hh-1); }
    drawText(label,xx+6,y+5,on?C.WHITE:C.SILVER,1);
    _mapEdHit(xx,y,ww,hh,fn);
    return hh;
  };
  const tools=[{id:'paint',label:'PAINT'},{id:'erase',label:'ERASE'},{id:'enemy',label:'SPAWN'}];
  let tx=10;
  for(const it of tools){
    btn(it.label,MAPED.tool===it.id,()=>{MAPED.tool=it.id;},tx,70);
    tx+=74;
  }
  y+=30;

  const chips=(items,get,set,w)=>{
    let x=10;
    for(const it of items){
      const on=get()===it.id;
      ctx.fillStyle=on?'rgba(80,200,255,0.4)':'rgba(255,255,255,0.06)';
      ctx.fillRect(x,y,w,22);
      if(on){ ctx.strokeStyle='#9ef'; ctx.strokeRect(x+0.5,y+0.5,w-1,21); }
      drawText(it.label,x+4,y+4,on?C.WHITE:C.SILVER,1);
      const id=it.id;
      _mapEdHit(x,y,w,22,()=>set(id));
      x+=w+4;
      if(x>MAPED_PANEL-w){ x=10; y+=24; }
    }
    y+=26;
  };

  if(MAPED.tool==='enemy'){
    drawText('PLACE  '+_mapEdEnemyLabel(MAPED.enemy),10,y,C.LILAC,1); y+=14;
    chips(MAPED_ENEMIES,()=>MAPED.enemy,id=>{MAPED.enemy=id; MAPED.tool='enemy';},52);
    drawText(spawns.length+' MARKED ON MAP',10,y,C.SAND,1); y+=16;
    const vis=Math.min(spawns.length,9);
    if(MAPED.spawnOff>Math.max(0,spawns.length-vis)) MAPED.spawnOff=Math.max(0,spawns.length-vis);
    for(let i=0;i<vis;i++){
      const si=i+MAPED.spawnOff, sp=spawns[si];
      const on=si===MAPED.pick;
      const col=MAPED_PIN[sp.kind]||C.WHITE;
      ctx.fillStyle=on?'rgba(232,160,255,0.28)':'rgba(255,255,255,0.04)';
      ctx.fillRect(8,y-2,MAPED_PANEL-16,20);
      drawText(sp.label,12,y+1,col,1);
      const loc=(sp.col!=null&&sp.row!=null)?(sp.col+','+sp.row):Math.round(sp.wx)+','+Math.round(sp.wy);
      drawText(loc,56,y+1,on?C.WHITE:C.SILVER,1);
      _mapEdHit(8,y-2,MAPED_PANEL-16,20,()=>{
        MAPED.pick=si; MAPED.tool='enemy'; _mapEdFocus(sp.wx,sp.wy);
      });
      y+=22;
    }
    if(spawns.length>vis){
      btn('MORE',false,()=>{MAPED.spawnOff=(MAPED.spawnOff+vis)%spawns.length;},10,MAPED_PANEL-20);
      y+=28;
    }
    drawText('CLICK MAP TO DROP',10,y,C.SILVER,1); y+=12;
    drawText('RIGHT CLICK REMOVES',10,y,C.SILVER,1); y+=16;
  }else{
    drawText('BLOCK IS',10,y,C.STEEL,1); y+=14;
    chips(MAPED_ROLES,()=>MAPED.role,id=>{MAPED.role=id;},68);
    drawText('LAYER',10,y,C.STEEL,1); y+=14;
    chips(MAPED_LAYERS,()=>MAPED.layer,id=>{MAPED.layer=id;},52);
    drawText('COLLISION',10,y,C.STEEL,1); y+=14;
    chips(MAPED_COLL,()=>MAPED.coll,id=>{MAPED.coll=id; if(MAPED.role==='scenario') MAPED.role='both';},70);
    btn(MAPED.showColl?'HITS ON':'HITS OFF',MAPED.showColl,()=>{MAPED.showColl=!MAPED.showColl;});
    y+=30;
    drawText(spawns.length+' SPAWNS ON MAP',10,y,C.LILAC,1); y+=12;
    drawText('CLICK PAINT  ALT PICK',10,y,C.SILVER,1); y+=12;
    drawText('RIGHT ERASE  WASD PAN',10,y,C.SILVER,1); y+=16;
  }

  ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(10,y,MAPED_PANEL-20,1); y+=10;
  btn('UNDO',false,()=>_mapEdUndo(),10,104);
  btn('SAVE',false,()=>{_mapEdWritePatch(()=>{}); _mapEdToast('Saved in this browser');},122,104);
  y+=28;
  btn('EXPORT',false,()=>_mapEdExport(),10,104);
  btn('CLEAR',false,()=>_mapEdClearPatch(),122,104);
  y+=32;
  drawText('CELL '+cell.c+','+cell.r,10,y,C.SILVER,1);

  if(MAPED.tool!=='enemy'){
    ctx.fillStyle='rgba(8,6,16,0.94)';
    ctx.fillRect(0,H-MAPED_PAL_H,W,MAPED_PAL_H);
    ctx.strokeStyle='rgba(140,200,255,0.3)';
    ctx.strokeRect(0.5,H-MAPED_PAL_H+0.5,W-1,MAPED_PAL_H-1);
    const gids=_mapEdPaletteGids();
    const cellS=44, pad=6;
    const startX=MAPED_PANEL+8;
    let px=startX, py=H-MAPED_PAL_H+16;
    drawText('TILES',startX,H-MAPED_PAL_H+4,C.SILVER,1);
    for(const g of gids){
      if(px+cellS>W-8) break;
      ctx.fillStyle=g===MAPED.gid?'rgba(255,228,100,0.35)':'rgba(255,255,255,0.06)';
      ctx.fillRect(px,py,cellS,cellS);
      if(typeof _drawTmjTileGid==='function')
        _drawTmjTileGid(g,px+6,py+6,8,8,4);
      if(g===MAPED.gid){ ctx.strokeStyle='#ffe46a'; ctx.strokeRect(px+0.5,py+0.5,cellS-1,cellS-1); }
      const gid=g;
      _mapEdHit(px,py,cellS,cellS,()=>{_mapEdSetGid(gid); MAPED.tool='paint';});
      px+=cellS+pad;
    }
  }

  if(MAPED.toastF>0){
    MAPED.toastF--;
    ctx.globalAlpha=Math.min(1,MAPED.toastF/20);
    ctx.fillStyle='rgba(12,8,24,0.88)';
    const tw=textW(MAPED.toast,2)+28;
    ctx.fillRect(W/2-tw/2, 10, tw, 28);
    drawTextC(MAPED.toast, W/2, 16, C.CYAN, 2);
    ctx.globalAlpha=1;
  }
}

function _mapEdBind(){
  if(typeof cv==='undefined'||!cv) return;
  cv.addEventListener('mousedown',e=>{
    if(!_mapEdActive) return;
    const rect=cv.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(W/rect.width);
    const my=(e.clientY-rect.top)*(H/rect.height);
    MAPED.mx=mx; MAPED.my=my;
    if(_mapEdClickUi(mx,my)) return;
    MAPED.painting=true; MAPED.lastKey='';
    _mapEdPaintFromMouse(mx,my,e.button===2,e.altKey||e.button===1);
    e.preventDefault();
  });
  cv.addEventListener('mousemove',e=>{
    if(!_mapEdActive) return;
    const rect=cv.getBoundingClientRect();
    MAPED.mx=(e.clientX-rect.left)*(W/rect.width);
    MAPED.my=(e.clientY-rect.top)*(H/rect.height);
    if(MAPED.painting) _mapEdPaintFromMouse(MAPED.mx,MAPED.my,e.buttons===2,e.altKey);
  });
  cv.addEventListener('mouseup',()=>{ MAPED.painting=false; MAPED.lastKey=''; });
  cv.addEventListener('mouseleave',()=>{ MAPED.painting=false; });
  cv.addEventListener('contextmenu',e=>{ if(_mapEdActive) e.preventDefault(); });
  document.addEventListener('keydown',e=>{
    if(e.code==='F2'){
      if(_gameState==='game') _mapEdToggle();
      e.preventDefault(); return;
    }
    if(!_mapEdActive) return;
    if(e.code==='Escape'||e.code==='Backquote'){ _mapEdToggle(false); e.preventDefault(); e.stopPropagation(); return; }
    if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){ _mapEdUndo(); e.preventDefault(); return; }
    if((e.ctrlKey||e.metaKey)&&e.code==='KeyS'){ _mapEdWritePatch(()=>{}); _mapEdToast('Saved'); e.preventDefault(); return; }
    if(e.code==='KeyP'){ MAPED.tool='paint'; _mapEdToast('Paint'); }
    if(e.code==='KeyR'){ MAPED.tool='erase'; _mapEdToast('Erase'); }
    if(e.code==='KeyN'){ MAPED.tool='enemy'; _mapEdToast('Spawn '+_mapEdEnemyLabel(MAPED.enemy)); }
    if(e.code==='BracketLeft'||e.code==='Comma'){
      const i=MAPED_ENEMIES.findIndex(it=>it.id===MAPED.enemy);
      MAPED.enemy=MAPED_ENEMIES[(i-1+MAPED_ENEMIES.length)%MAPED_ENEMIES.length].id;
      MAPED.tool='enemy'; _mapEdToast('Spawn '+_mapEdEnemyLabel(MAPED.enemy));
    }
    if(e.code==='BracketRight'||e.code==='Period'){
      const i=MAPED_ENEMIES.findIndex(it=>it.id===MAPED.enemy);
      MAPED.enemy=MAPED_ENEMIES[(i+1)%MAPED_ENEMIES.length].id;
      MAPED.tool='enemy'; _mapEdToast('Spawn '+_mapEdEnemyLabel(MAPED.enemy));
    }
    if(e.code==='KeyG'){ MAPED.showColl=!MAPED.showColl; }
    if(e.code==='Tab'){
      const i=MAPED_ROLES.findIndex(r=>r.id===MAPED.role);
      MAPED.role=MAPED_ROLES[(i+1)%MAPED_ROLES.length].id;
      _mapEdToast('Block is '+MAPED.role); e.preventDefault();
    }
    if(e.code==='Digit1') MAPED.layer='dirt';
    if(e.code==='Digit2') MAPED.layer='grass';
    if(e.code==='Digit3') MAPED.layer='destruct';
    if(e.code==='Digit4') MAPED.layer='fg';
    if(e.code==='BracketLeft'||e.code==='Comma'){
      const g=_mapEdPaletteGids();
      const i=Math.max(0,g.indexOf(MAPED.gid));
      MAPED.gid=g[(i-1+g.length)%g.length];
    }
    if(e.code==='BracketRight'||e.code==='Period'){
      const g=_mapEdPaletteGids();
      const i=Math.max(0,g.indexOf(MAPED.gid));
      MAPED.gid=g[(i+1)%g.length];
    }
    if(e.code==='KeyC'){
      const i=MAPED_COLL.findIndex(c=>c.id===MAPED.coll);
      MAPED.coll=MAPED_COLL[(i+1)%MAPED_COLL.length].id;
      _mapEdToast('Collision '+MAPED_COLL.find(c=>c.id===MAPED.coll).label);
    }
  }, true);
}

_mapEdBind();
(function(){
  const bind=()=>{
    const b=document.getElementById('bEdit');
    if(b&&!b._mapEdBound){
      b._mapEdBound=true;
      b.addEventListener('click',()=>{ if(typeof _gameState!=='undefined'&&_gameState==='game') _mapEdToggle(); });
    }
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind);
  else bind();
})();
