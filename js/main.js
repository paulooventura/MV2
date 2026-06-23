// ============================================================
//  Mind & Venture — main.js
//  World data (TR), Tiled map loader, procgen engine,
//  update() + draw() loops, rAF entry point.
//
//  Load order (index.html):
//    save.js → core.js → audio.js → enemies.js → physics.js →
//    player.js → weapons.js → ui.js → render.js → editor.js → spawn_fix.js → main.js
// ============================================================

cv.addEventListener('mousemove', e => {
  if (_gameState !== 'title') return;
  const rect = cv.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const mx = (e.clientX - rect.left) * (W / rect.width);
  const my = (e.clientY - rect.top)  * (H / rect.height);
  const rows = _titleMenuGeom();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (mx >= r.x && mx <= r.x+r.w && my >= r.y && my <= r.y+r.h) { _titleMenuIdx = i; break; }
  }
});

// ── Init camera zoom + touch buttons ──────────────────────────
_initCamZoom();
_initTouchButtons();

// ── World constants ───────────────────────────────────────────
let WW = 800, WH = 800;
const STAGE0_MAP_PATH = 'assets/Awdjoo/Awdjoo.json';
const TILED_WORLD_SCALE = 4;
const TMJ_BASEMENT_ROW = 84;
const TMJ_BASEMENT_FEET_Y = TMJ_BASEMENT_ROW * 8 * TILED_WORLD_SCALE;
const TMJ_NOSOLID_GIDS = new Set([4383,4384,2602,4500,4501]);
const TMJ_PLAYER_SPAWN_GID = 169;
const TMJ_SPAWN_FIRST_GID = 162;
const TMJ_PLAYER_SPAWN_COL = 31;
const TMJ_PLAYER_SPAWN_ROW = 73;
const TMJ_ENEMY_SPAWN_COL = 13;
const TMJ_ENEMY_SPAWN_ROW = 65;
const TMJ_RCA_SPAWN_COL = 30;
const TMJ_RCA_SPAWN_ROW = 85;
const TMJ_PLAYER_SPAWN_GIDS = new Set([169,150,8200,6683,6684]);
const TMJ_MIND_SPAWN_GIDS = new Set([223,204]);
const TMJ_RCA_SPAWN_GIDS = new Set([187,168]);
const TMJ_KNOWL_GID = 6685;
const TMJ_ROPE_PICKUP_GID = 8839;
const TMJ_ROPE_PICKUP_GIDS = new Set([8839,443,444,445,446,6263,6264,6265,6266]);
const TMJ_MIND_ENEMY_GID = 8880;
const TMJ_SIGNOL_GID = 8985;
const TMJ_SIGNOL_GIDS = new Set([8985,8986,8987,8988]);
const TMJ_MIND_ENEMY_SHAPES = ['ball','square','triangle','star'];
const TMJ_MINION_CIRCLE_GID = 6686;
const TMJ_MINION_SQUARE_GID = 6687;
const TMJ_MINION_FLYER_GID  = 6688;
const TMJ_ENEMY_BALL_GID    = 6691;
const TMJ_ENEMY_SQ_GID      = 6692;
const TMJ_ENEMY_TRI_GID     = 6693;
const TMJ_ENEMY_STAR_GID    = 6694;
const TMJ_ENEMY_CIRCLE_GID  = TMJ_MINION_CIRCLE_GID;
const TMJ_ENEMY_SQUARE_GID  = TMJ_MINION_SQUARE_GID;
const TMJ_ENEMY_FLYER_GID   = TMJ_MINION_FLYER_GID;
const TMJ_LAITU_GID         = 4500;
const TMJ_LAITU_GIDS        = new Set([4500,8242,6690]);
const TMJ_SPAWN_MARKER_GIDS = new Set([...TMJ_PLAYER_SPAWN_GIDS,...TMJ_MIND_SPAWN_GIDS,...TMJ_RCA_SPAWN_GIDS,TMJ_KNOWL_GID,...TMJ_ROPE_PICKUP_GIDS,TMJ_MIND_ENEMY_GID,TMJ_ENEMY_CIRCLE_GID,TMJ_ENEMY_SQUARE_GID,TMJ_ENEMY_FLYER_GID,TMJ_ENEMY_BALL_GID,TMJ_ENEMY_SQ_GID,TMJ_ENEMY_TRI_GID,TMJ_ENEMY_STAR_GID,...TMJ_LAITU_GIDS,...TMJ_SIGNOL_GIDS]);
const TMJ_OMNIBLOCK_FIRST=157;
const TMJ_OMNIBLOCK_FRAMES=5;
const TMJ_SPAWN_TILE_COUNT=64;
const TMJ_FLIP_H=0x80000000, TMJ_FLIP_V=0x40000000, TMJ_FLIP_D=0x20000000;
function _omniblockTilesetForGid(gid){
  for(const ts of TMJ_TILESET_DEFS){ if(ts.animate&&gid>=ts.firstGid&&gid<=ts.lastGid) return ts; }
  return null;
}
function _isOmniblockGid(gid){ return !!_omniblockTilesetForGid(gid); }
function _isOmniblockRedGid(gid){ const ts=_omniblockTilesetForGid(gid); return ts&&(gid-ts.firstGid)===4; }
const TMJ_CANDLE_TIDS = new Set([442,443,444,445,560,561,562,563,678,679,680,681,1706,1707]);
const TMJ_LAMP_GLOW_TIDS = new Set([5508,5509,5510,5511,5722,5723,5724,5725,5626,5627,5628]);
let _mapKnowlDefs=[], _mapMinionDefs=[], _mapEnemyDefs=[], _mapSignolDefs=[];
let _mapApplied=false;
let _tmjDraw=null, _tmjImg=null, _omniblockImg=null, _tmjImgCols=12, _mapReady=false, _candleLights=[];
const _TMJ_SOURCE_META={
  'MV2 tilesheet.tsx':{count:144,cols:12,paths:['assets/home baked sprites/material/MV2 tilesheet.png']},
  'omniblock.tsx':{count:5,cols:5,animate:true,paths:['assets/home baked sprites/material/omniblock.png','assets/home baked sprites/material/omniblock.gif','assets/home baked sprites/square/omniblock.png','assets/home baked sprites/square/omniblock.gif']},
  'spawn spots.tsx':{count:64,cols:8,paths:['assets/home baked sprites/material/spawn spots.png']},
};
let TMJ_TILESET_DEFS=[];
function _tmjSourceName(src){ return String(src||'').replace(/^.*[\\/]/,''); }
function _rebuildTmjTilesetDefs(map){
  const defs=[], imgByKey=new Map();
  for(const ts of TMJ_TILESET_DEFS){ if(ts.img&&ts.paths) imgByKey.set(ts.paths.join('|'),ts.img); }
  for(const ts of (map&&map.tilesets)||[]){
    const meta=_TMJ_SOURCE_META[_tmjSourceName(ts.source)];
    if(!meta) continue;
    const paths=meta.paths;
    defs.push({
      firstGid:ts.firstgid, lastGid:ts.firstgid+meta.count-1,
      cols:meta.cols, img:imgByKey.get(paths.join('|'))||null,
      paths, animate:!!meta.animate,
    });
  }
  if(!defs.length){
    defs.push(
      {firstGid:1,lastGid:144,cols:12,img:null,paths:_TMJ_SOURCE_META['MV2 tilesheet.tsx'].paths},
      {firstGid:157,lastGid:161,cols:5,img:null,paths:_TMJ_SOURCE_META['omniblock.tsx'].paths,animate:true},
      {firstGid:162,lastGid:225,cols:8,img:null,paths:_TMJ_SOURCE_META['spawn spots.tsx'].paths},
      {firstGid:238,lastGid:242,cols:5,img:null,paths:_TMJ_SOURCE_META['omniblock.tsx'].paths,animate:true},
    );
  }
  TMJ_TILESET_DEFS.length=0;
  TMJ_TILESET_DEFS.push(...defs);
  const mv2=defs.find(d=>d.firstGid===1);
  if(mv2&&mv2.img){ _tmjImg=mv2.img; _tmjImgCols=mv2.cols; }
}
function _tmjTileSolidAt(data,mw,mh,col,row){
  if(!data||row<0||row>=mh||col<0||col>=mw) return 0;
  const gid=_tmjGid(data[row*mw+col]);
  if(!gid||TMJ_NOSOLID_GIDS.has(gid)) return 0;
  if(_tmjChromaKey(gid)) return 0;
  return gid;
}
function _tmjCanvasGidRaw(data,mw,mh,col,row){
  if(!data||row<0||row>=mh||col<0||col>=mw) return 0;
  const gid=_tmjGid(data[row*mw+col]);
  if(!gid||TMJ_NOSOLID_GIDS.has(gid)) return 0;
  return gid;
}
function _isGrassLayerFloorGid(gid){
  if(!gid) return false;
  if(typeof _isOmniblockGid==='function'&&_isOmniblockGid(gid)) return false;
  if(_tmjChromaKey(gid)) return true;
  return false;
}
function _isCanvasWalkFloorGid(gid){ return _isGrassLayerFloorGid(gid); }
function _grassSurfaceYNear(cx,feetY,maxUp=160,maxDrop=64){
  const d=_tmjDraw; if(!d||!d.canvasData) return null;
  const {mw,mh,tw,th,sc,canvasData}=d;
  const col=Math.floor(cx/(tw*sc));
  if(col<0||col>=mw) return null;
  const solidAt=(row)=>{
    const g=_tmjCanvasGidRaw(canvasData,mw,mh,col,row);
    return g&&_isCanvasWalkFloorGid(g);
  };
  let best=null;
  for(let row=0;row<mh;row++){
    if(!solidAt(row)||solidAt(row-1)) continue;
    const y=row*th*sc;
    const drop=y-feetY;
    if(drop<-maxUp||drop>maxDrop) continue;
    if(best===null||y<best) best=y;
  }
  return best;
}
function _isWallCapCell(col,row,solidAt){
  if(!solidAt(col,row)||solidAt(col,row-1)) return false;
  if(!solidAt(col,row+1)) return false;
  return solidAt(col-1,row)||solidAt(col+1,row)||solidAt(col-1,row+1)||solidAt(col+1,row+1);
}
function _tileSurfaceYNear(cx,feetY,maxUp=160,maxDrop=64){
  const d=_tmjDraw; if(!d) return null;
  const {mw,mh,tw,th,sc,bgData,canvasData,data,destructData}=d;
  const layers=[canvasData,bgData,data,destructData].filter(Boolean);
  const col=Math.floor(cx/(tw*sc));
  if(col<0||col>=mw) return null;
  const solidAt=(row)=>{
    for(const L of layers){ if(_tmjTileSolidAt(L,mw,mh,col,row)) return true; }
    return false;
  };
  let best=null;
  for(let row=0;row<mh;row++){
    if(!solidAt(row)||solidAt(row-1)) continue;
    const y=row*th*sc;
    const drop=y-feetY;
    if(drop<-maxUp||drop>maxDrop) continue;
    if(best===null||y<best) best=y;
  }
  return best;
}
function _tmjLookupGid(gid){
  if(!gid) return null;
  for(const ts of TMJ_TILESET_DEFS){
    if(gid>=ts.firstGid&&gid<=ts.lastGid&&ts.img) return {img:ts.img,tid:gid-ts.firstGid,cols:ts.cols};
  }
  if(_omniblockImg){
    if(gid>=157&&gid<=161) return {img:_omniblockImg,tid:gid-157,cols:5};
    if(gid>=238&&gid<=242) return {img:_omniblockImg,tid:gid-238,cols:5};
  }
  if(_tmjImg&&gid>=1&&gid<=144) return {img:_tmjImg,tid:gid-1,cols:_tmjImgCols};
  return null;
}
function _tmjImgSrc(path){ return encodeURI(path).replace(/#/g,'%23'); }
let _spawnX=200, _spawnY=720, _floorTopY=600;
let _mapPlayerSpawnPt=null;

// ── Default world geometry (overridden by Tiled map) ─────────
let TR=[
  [0,840,WW,60,'solid'],[0,0,20,900,'solid'],[3180,0,20,900,'solid'],[0,0,WW,20,'solid'],
  [20,700,320,10,'solid'],[20,700,24,140,'solid'],[316,700,24,140,'solid'],
  [300,640,620,24,'solid'],[300,500,620,24,'solid'],[300,360,620,24,'solid'],
  [300,360,34,304,'solid'],[886,360,34,304,'solid'],
  [960,800,180,40,'solid'],[1140,760,180,80,'solid'],[1320,720,180,120,'solid'],
  [1460,640,300,22,'solid'],[1460,520,300,22,'solid'],[1460,420,300,22,'solid'],
  [1460,420,28,242,'solid'],[1732,420,28,242,'solid'],
  [1500,760,180,80,'solid'],[1680,700,220,140,'solid'],[1900,740,200,100,'solid'],
  [2100,660,220,180,'solid'],[2320,760,140,80,'solid'],
  [2460,380,360,20,'solid'],[2460,500,360,20,'solid'],[2460,620,360,20,'solid'],[2460,740,360,20,'solid'],
  [2460,380,24,380,'solid'],[2796,380,24,380,'solid'],
  [2860,760,120,80,'solid'],[2980,680,120,160,'solid'],[3100,580,80,260,'solid'],
  [2950,120,220,20,'solid'],
];
let GOALPL = TR[TR.length-1];
const MPLAT=[], APLAT=[];
let TEST_MODE=false;
let _zoneIdx=0;
let _ngPlusRun=false, _ngSeed=0, _winCount=0;
// _healFrac / _gameLivesFrac live in audio.js (declared there first)

// ── Spawn / goal helpers ──────────────────────────────────────
function _placePlayerAtSpawn(){
  if(!p) p=mkP();
  p.x=_spawnX; p.y=_spawnY;
  p.vx=0; p.vy=0; p.og=false;
  p.hp=p.maxHp; _syncLivesFromHp(p);
  p.inv=0; _shutdownTimer=0;
  p.hook={st:'idle',ex:0,ey:0,evx:0,evy:0,ax:0,ay:0,rl:0,ox:NaN,oy:NaN,tgt:null,tox:0,toy:0};
  p.xlrOn=false; p.magOn=false; p.wallGrip=0;
  p.crouchAmt=0; p.runRamp=0; p._fallRespawnCd=0;
  _resolveSpawnPlacement(p);
  _snapCameraToPlayer(p);
}
function _canvasFloorFeetAt(cx,markerFeet,maxRows=10){
  const near=typeof _tileSurfaceYNear==='function'?_tileSurfaceYNear(cx,markerFeet,160,96):null;
  if(near!=null) return near;
  const draw=_tmjDraw;
  if(!draw) return null;
  const data=draw.canvasData||draw.bgData||draw.data;
  if(!data||!draw.mw) return null;
  const {mw,mh,tw,th,sc}=draw;
  const col=Math.floor(cx/(tw*sc));
  if(col<0||col>=mw) return null;
  const row0=Math.max(0,Math.floor(markerFeet/(th*sc))-2);
  for(let row=row0;row<Math.min(mh,row0+maxRows);row++){
    const gid=_tmjGid(data[row*mw+col]);
    if(!gid||TMJ_NOSOLID_GIDS.has(gid)) continue;
    if(typeof _tmjChromaKey==='function'&&_tmjChromaKey(gid)) continue;
    return row*th*sc;
  }
  return null;
}
function _respawnPlayer(){ _placePlayerAtSpawn(); }
function _goalRect(){ const g=GOALPL; if(Array.isArray(g)) return{x:g[0],y:g[1],w:g[2],h:g[3]}; return{x:g.x,y:g.y,w:g.w,h:g.h}; }
function _isBasementSpawnRow(row,gid){
  if(row==null||row<TMJ_BASEMENT_ROW) return false;
  if(gid&&(TMJ_RCA_SPAWN_GIDS.has(gid)||TMJ_ROPE_PICKUP_GIDS.has(gid))) return false;
  return true;
}

// ── Tiled map application ─────────────────────────────────────
function _tmjGid(raw){ return(raw|0)&0x1FFFFFFF; }
function _tmjRectWorldPts(o,sc){
  const x=o.x*sc,y=o.y*sc;
  const w=Math.max(1,Math.round((o.width||8)*sc));
  const h=Math.max(1,Math.round((o.height||8)*sc));
  return [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
}
function _snapTmjRect(o,sc){
  const x=Math.round(o.x*sc), y=Math.round(o.y*sc);
  const w=Math.max(1,Math.round((o.width||0)*sc));
  const h=Math.max(1,Math.round((o.height||0)*sc));
  return[x,y,w,h,'solid'];
}
function _isKeepOutLayerName(name){
  const l=String(name||'').toLowerCase().replace(/!/g,'').trim();
  return l==='keep out'||l==='keepout'||l==='collision'||l==='walls/floors'||l==='walls'||l==='floors'||l==='wall/floor'||l==='floor/walls';
}
function _isImmersedLayerName(name){ return String(name||'').toLowerCase()==='immersed'; }
function _isCollLayerName(name){ return _isKeepOutLayerName(name); }
function _isDestructLayerName(name){ const l=String(name||'').toLowerCase(); return l==='destruct'||l==='destructible'||l==='destructibles'; }
function _isManipLayerName(name){ const l=String(name||'').toLowerCase().replace(/\\/g,'/'); return l==='manipulables'||l==='manipulable'||l==='manip'; }
function _isBlocksLayerName(name){ return String(name||'').toLowerCase()==='blocks'; }
function _isBwallObjectLayer(name){ return _isDestructLayerName(name)||_isManipLayerName(name)||_isBlocksLayerName(name); }
function _polyBbox(pts){
  let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
  for(const p of pts){ if(p.x<minX)minX=p.x; if(p.y<minY)minY=p.y; if(p.x>maxX)maxX=p.x; if(p.y>maxY)maxY=p.y; }
  return{minX,minY,maxX,maxY};
}
function _mkBwallFromBlockObj(o,tw,th,sc,destructData,canvasData,bgData,mw){
  const pts=_tmjPolyWorldPts(o,sc);
  if(pts.length<3) return null;
  const bb=_polyBbox(pts);
  const x=Math.round(bb.minX), y=Math.round(bb.minY);
  const w=Math.max(Math.round(tw*sc),Math.round(bb.maxX-bb.minX));
  const h=Math.max(Math.round(th*sc),Math.round(bb.maxY-bb.minY));
  const mapX=o.x, mapY=o.y-(th||8);
  const{tileGid,canvasGid,bgGid,homeCol,homeRow}=_pickBwallTileGids({x:mapX,y:mapY,width:tw,height:th},tw,th,destructData,canvasData,bgData,mw);
  const gid=tileGid||TMJ_OMNIBLOCK_FIRST;
  return _mkBwall(x,y,w,h,{tileGid:gid,canvasGid,bgGid,homeCol,homeRow,homeX:x,homeY:y,movable:false});
}
function _tmjPolyWorldPts(o,sc){ const ox=o.x*sc,oy=o.y*sc,rad=(o.rotation||0)*Math.PI/180,cos=Math.cos(rad),sin=Math.sin(rad); return(o.polygon||[]).map(p=>{let px=p.x*sc,py=p.y*sc;if(rad){const rx=px*cos-py*sin,ry=px*sin+py*cos;px=rx;py=ry;}return{x:ox+px,y:oy+py};}); }
function _pickBwallTileGids(o,tw,th,destructData,canvasData,bgData,mw){
  const x0=Math.floor(o.x/tw),x1=Math.floor((o.x+Math.max(0.01,o.width)-0.001)/tw);
  const y0=Math.floor(o.y/th),y1=Math.floor((o.y+Math.max(0.01,o.height)-0.001)/th);
  let tileGid=0,canvasGid=0,bgGid=0,homeCol=Math.floor(o.x/tw),homeRow=Math.floor(o.y/th);
  if(mw>0){
    for(let row=y0;row<=y1;row++){for(let col=x0;col<=x1;col++){
      const i=row*mw+col;
      if(destructData&&i>=0&&i<destructData.length){const g=_tmjGid(destructData[i]);if(g){tileGid=g;homeCol=col;homeRow=row;}}
      if(canvasData&&i>=0&&i<canvasData.length){const g=_tmjGid(canvasData[i]);if(g) canvasGid=g;}
      if(bgData&&i>=0&&i<bgData.length){const g=_tmjGid(bgData[i]);if(g) bgGid=g;}
    }}
  }
  return{tileGid,canvasGid,bgGid,homeCol,homeRow};
}
function _bwallZoneOk(bw){
  if(!IMMERSED_POLYS.length) return true;
  if(typeof _isInImmersedZone!=='function') return true;
  const cx=bw.x+bw.w/2, cy=bw.y+bw.h*0.5;
  return _isInImmersedZone(cx,cy);
}
function _filterMapBWallsToZones(){
  // Omniblocks belong in KEEP OUT wall geometry — never cull them for zone overlap.
}
function _restoreMapBWalls(){
  BWALLS.length=0;
  for(const bw of _mapBWalls) BWALLS.push(Object.assign({},bw,{hp:bw.maxHp,cracked:false,shakeX:0,shakeY:0,debris:[],_destroyFr:null,vx:0,vy:0,og:false,_awake:false,_impactCd:0}));
}
function _bwallDestructSkipCells(){
  const skip=new Set();
  for(const bw of BWALLS){
    if(bw.homeCol==null||bw.homeRow==null) continue;
    if(bw.hp<=0||(bw.hp>0&&!_bwallMovedFromHome(bw))) skip.add(bw.homeRow+'_'+bw.homeCol);
  }
  return skip;
}
function _spawnBwallsFromDestructTiles(destructData,canvasData,bgData,mw,mh,tw,th,sc){
  if(!destructData||!mw) return;
  const have=new Set(_mapBWalls.filter(b=>b.homeCol!=null).map(b=>b.homeRow+'_'+b.homeCol));
  for(let row=0;row<mh;row++){
    for(let col=0;col<mw;col++){
      const key=row+'_'+col;
      if(have.has(key)) continue;
      const gid=_tmjGid(destructData[row*mw+col]);
      if(!_isOmniblockGid(gid)) continue;
      const x=col*tw*sc, y=row*th*sc, w=tw*sc, h=th*sc;
      let canvasGid=0,bgGid=0;
      if(canvasData){ const cg=_tmjGid(canvasData[row*mw+col]); if(cg) canvasGid=cg; }
      if(bgData){ const dg=_tmjGid(bgData[row*mw+col]); if(dg) bgGid=dg; }
      _mapBWalls.push(_mkBwall(x,y,w,h,{tileGid:gid,canvasGid,bgGid,homeCol:col,homeRow:row,homeX:x,homeY:y,movable:_isOmniblockRedGid(gid)}));
      have.add(key);
    }
  }
}
function _bestSpawnTileData(layers,mw){
  let best=null, bestHits=0;
  for(const layer of layers||[]){
    if(layer.type!=='tilelayer'||!layer.data||!layer.data.length) continue;
    if(typeof _isSpawnLayerName==='function'&&!_isSpawnLayerName(layer.name)) continue;
    let hits=0;
    for(let i=0;i<layer.data.length;i++){
      const g=typeof _normalizeSpawnGid==='function'?_normalizeSpawnGid(layer.data[i]):((_tmjGid(layer.data[i])|0)&0x1FFFFFFF);
      if(g&&TMJ_SPAWN_MARKER_GIDS.has(g)) hits++;
    }
    if(hits>bestHits){ bestHits=hits; best=layer.data; }
  }
  return best;
}
function _ensureCampaignMapApplied(){
  if(_mapApplied&&_tmjDraw) return;
  if(window.MV_STAGE0_MAP) _safeApplyTmjMap(window.MV_STAGE0_MAP);
}
function _buildPolyFloorPlats(pts,floorH){
  if(!pts||pts.length<3) return [];
  const fh=floorH||16;
  const out=[], centY=pts.reduce((s,p)=>s+p.y,0)/pts.length;
  for(let i=0;i<pts.length;i++){
    const a=pts[i], b=pts[(i+1)%pts.length];
    const dx=b.x-a.x, dy=b.y-a.y, len=Math.hypot(dx,dy);
    if(len<8||Math.abs(dy)>Math.abs(dx)*0.5) continue;
    const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
    const sample=Math.max(8,len*0.12);
    const inBelow=_pointInPoly(mx,my+sample,pts);
    const inAbove=_pointInPoly(mx,my-sample,pts);
    const roomFloor=inAbove&&!inBelow;
    const platTop=!inAbove&&inBelow&&my>=centY;
    if(!roomFloor&&!platTop) continue;
    const minX=Math.min(a.x,b.x), maxX=Math.max(a.x,b.x);
    if(maxX-minX<4) continue;
    out.push({x:minX,y:my,w:maxX-minX,h:fh,tp:'solid',mv:null,mp:null});
  }
  return out;
}
const _EMPTY_TMJ_MAP={width:100,height:100,tilewidth:8,tileheight:8,layers:[]};
function _safeApplyTmjMap(data){ try{applyTmjMap(data);}catch(err){console.error('MV applyTmjMap failed',err);try{applyTmjMap(_EMPTY_TMJ_MAP);}catch(e2){console.error(e2);}} }
function _clearTiledState(){
  _tmjDraw=null; _mapApplied=false; _mapKnowlDefs=[]; _mapMinionDefs=[]; _mapEnemyDefs=[]; _mapSignolDefs=[]; _mapRopePickup=null; _mapLaituSpawn=null; _laitu=null; _candleLights=[];
  COLL_SEGS=[]; COLL_WALL_SEGS=[]; COLL_POLYS=[]; IMMERSED_POLYS=[]; _useSegGround=false; BWALLS.length=0;
}

function applyTmjMap(data){
  _rebuildTmjTilesetDefs(data);
  const sc=TILED_WORLD_SCALE;
  const tw=data.tilewidth||8, th=data.tileheight||8;
  const mw=data.width||0, mh=data.height||0;
  const layers=data.layers||[];
  console.info('MV applyTmjMap: loading',mw+'x'+mh,'layers:',layers.map(l=>l.type+':'+l.name).join(' | '));
  WW=mw*tw*sc; WH=mh*th*sc;
  COLL_SEGS=[]; COLL_WALL_SEGS=[]; COLL_POLYS=[]; IMMERSED_POLYS=[];
  _useSegGround=false;
  TR=[{x:-60,y:-400,w:60,h:WH+800,tp:'solid',mv:null,mp:null},{x:WW,y:-400,w:60,h:WH+800,tp:'solid',mv:null,mp:null},{x:-60,y:-460,w:WW+120,h:60,tp:'solid',mv:null,mp:null}];
  GOALPL={x:WW-50,y:0,w:50,h:WH};
  _mapKnowlDefs=[]; _mapMinionDefs=[]; _mapEnemyDefs=[]; _mapSignolDefs=[]; _mapRopePickup=null; _mapLaituSpawn=null; _mapBWalls=[];
  let tileData=null,bgData=null,fgData=null,destructData=null,spawnData=null,canvasData=null;
  const collRects=[],collPolys=[];
  for(const layer of layers){
    const lname=(layer.name||'').toLowerCase();
    if(layer.type==='tilelayer'){
      const d=layer.data||[];
      if(lname==='background'||lname==='dirt stuf'||lname==='dirt') bgData=d;
      else if(lname==='foreground') fgData=d;
      else if(_isDestructLayerName(lname)) destructData=d;
      else if(lname==='spawns'||lname==='spawn') spawnData=d;
      else if(lname==='canvas'||lname==='grass stuff'||lname==='grass') canvasData=d;
      else if(!tileData) tileData=d;
      if(_isCollLayerName(lname)){
        for(let row=0;row<mh;row++){for(let col=0;col<mw;col++){
          const gid=_tmjGid(d[row*mw+col]);
          if(!gid||TMJ_NOSOLID_GIDS.has(gid)) continue;
          collRects.push({x:col*tw*sc,y:row*th*sc,w:tw*sc,h:th*sc,tp:'solid',mv:null,mp:null});
        }}
      }
    }else if(layer.type==='objectgroup'){
      const objects=layer.objects||[];
      if(_isKeepOutLayerName(layer.name||'')){
        for(const o of objects){
          if(o.polygon){ const pts=_tmjPolyWorldPts(o,sc); if(pts.length>=3) collPolys.push(pts); }
          else if((o.width||0)>0&&(o.height||0)>0) collRects.push(_snapTmjRect(o,sc));
        }
      }
      if(_isImmersedLayerName(layer.name||'')){
        for(const o of objects){
          if(o.polygon){ const pts=_tmjPolyWorldPts(o,sc); if(pts.length>=3) IMMERSED_POLYS.push(pts); }
          else if((o.width||0)>0&&(o.height||0)>0) IMMERSED_POLYS.push(_tmjRectWorldPts(o,sc));
        }
      }
      if(_isBlocksLayerName(layer.name||'')){
        for(const o of objects){
          const bw=_mkBwallFromBlockObj(o,tw,th,sc,destructData,canvasData,bgData,mw);
          if(bw) _mapBWalls.push(bw);
        }
      }
      if(_isDestructLayerName(layer.name||'')||_isManipLayerName(layer.name||'')){
        for(const o of objects){
          const{tileGid,canvasGid,bgGid,homeCol,homeRow}=_pickBwallTileGids(o,tw,th,destructData,canvasData,bgData,mw);
          const x=Math.round(o.x*sc),y=Math.round((o.y-(o.height||th))*sc);
          const w=Math.max(Math.round(tw*sc),Math.round((o.width||tw)*sc));
          const h=Math.max(Math.round(th*sc),Math.round((o.height||th)*sc));
          _mapBWalls.push(_mkBwall(x,y,w,h,{tileGid,canvasGid,bgGid,homeCol,homeRow,homeX:x,homeY:y,movable:_isOmniblockRedGid(tileGid)}));
        }
      }
    }
  }
  // ── Collision geometry ────────────────────────────────────────
  // KEEP OUT polygons → solid barriers only. Walk surfaces come from tile tops.
  // Skip merged TR rects when polygon keep-out is present (they create phantom floors).
  if(!collPolys.length&&collRects.length){
    const merged=_mergeCollRects(collRects);
    TR.push(...merged);
  }
  for(const pts of collPolys){
    COLL_POLYS.push(pts);
    const segs=_buildPolyColliderSegs(pts);
    COLL_SEGS.push(...segs.walk);
    COLL_WALL_SEGS.push(...segs.barriers);
  }
  _spawnBwallsFromDestructTiles(destructData,canvasData,bgData,mw,mh,tw,th,sc);
  if(canvasData){
    const tileSegs=_buildExposedTileTopSegs(canvasData,bgData,tileData,destructData,mw,mh,tw,th,sc);
    if(tileSegs.length) COLL_SEGS.push(...tileSegs);
  }
  if(COLL_SEGS.length){ _rebuildCollSegBuckets(); _useSegGround=true; }
  _filterMapBWallsToZones();
  _restoreMapBWalls();
  const mainCanvas=canvasData||tileData;
  _tmjDraw={data:mainCanvas,canvasData,bgData,fgData,destructData,spawnData,mw,mh,tw,th,sc};
  if(typeof _scanCandleLights==='function') _scanCandleLights(data);

  // ── Spawn + marker resolution (uses spawn_fix.js) ─────────────
  const spawnTileLayer=layers.find(l=>l.type==='tilelayer'&&_isSpawnLayerName(l.name)&&l.data);
  spawnData=_bestSpawnTileData(layers,mw)||(spawnTileLayer&&spawnTileLayer.data)||spawnData||null;
  if(_tmjDraw) _tmjDraw.spawnData=spawnData;
  _resolveAndApplySpawn(data,tw,th,sc,spawnData,mw);

  _mapApplied=true; _mapReady=true;
  if(p){ _placePlayerAtSpawn(); _spawnMapEnemies(); }
  else if(typeof _spawnX==='number'){ /* spawn vars ready for next boot */ }
  if(p&&_zoneIdx===0&&!_battleTestMode&&!_runTestMode) _snapCameraToPlayer(p);
  console.info('MV applyTmjMap:',WW+'x'+WH,TR.length,'rects,',COLL_SEGS.length,'segs,',
    BWALLS.length,'bwalls',_mapKnowlDefs.length,'knowls',
    '| keep-out',COLL_POLYS.length,'walls',COLL_WALL_SEGS.length,'immersed',IMMERSED_POLYS.length,
    IMMERSED_POLYS.length?'':'(export IMMERSED polygons in Tiled for zone gating)',
    '| canvas',!!mainCanvas,'bg',!!bgData,
    '| spawn',_spawnX,_spawnY+FEET_OFF,'| enemies',_mapEnemyDefs.length,'| tilesets',TMJ_TILESET_DEFS.map(t=>t.firstGid+(t.img?'✓':'×')).join(','));
}

// ── Tiled draw helpers ────────────────────────────────────────
function _tmjFlipFlags(raw){
  const r=raw|0;
  return {h:(r&TMJ_FLIP_H)!==0,v:(r&TMJ_FLIP_V)!==0,d:(r&TMJ_FLIP_D)!==0};
}
function _tmjDisplayGid(gid){ return gid; }
function _tmjOmniblockAnimGid(gid){
  if(!gid||typeof _isOmniblockGid!=='function'||!_isOmniblockGid(gid)) return gid;
  const ts=_omniblockTilesetForGid(gid);
  if(!ts) return gid;
  const tick=typeof fr!=='undefined'?fr:0;
  const frame=Math.floor(tick/4)%TMJ_OMNIBLOCK_FRAMES;
  return ts.firstGid+frame;
}
function _buildExposedTileTopSegs(canvasData,bgData,tileData,destructData,mw,mh,tw,th,sc){
  if(!canvasData||!mw) return [];
  const structSolid=(col,row)=>{
    if(row<0||row>=mh||col<0||col>=mw) return false;
    for(const data of [canvasData,bgData,tileData]){
      if(data&&_tmjTileSolidAt(data,mw,mh,col,row)) return true;
    }
    return false;
  };
  const skipOmniblockCell=(col,row)=>{
    if(destructData&&row>=0&&row<mh&&col>=0&&col<mw){
      const dg=_tmjGid(destructData[row*mw+col]);
      if(dg&&_isOmniblockGid(dg)) return true;
    }
    for(const bw of _mapBWalls){
      if(bw.homeCol===col&&bw.homeRow===row&&_isOmniblockGid(bw.tileGid)) return true;
    }
    return false;
  };
  const segs=[];
  for(let row=0;row<mh;row++){
    for(let col=0;col<mw;col++){
      if(skipOmniblockCell(col,row)) continue;
      const gid=_tmjCanvasGidRaw(canvasData,mw,mh,col,row);
      if(!gid||!_isCanvasWalkFloorGid(gid)) continue;
      if(_tmjCanvasGidRaw(canvasData,mw,mh,col,row-1)) continue;
      if(_isWallCapCell(col,row,structSolid)) continue;
      const x1=col*tw*sc, x2=x1+tw*sc, y=row*th*sc;
      segs.push({id:COLL_SEGS.length+segs.length,x1,y1:y,x2,y2:y,len:x2-x1,angle:0,ux:1,uy:0,walkKind:'tile-grass',col,row});
    }
  }
  return segs;
}
function _blitTmjTile(hit,gid,tw,th,px,py,dw,dh,fh,fv,fd){
  const sx0=(hit.tid%hit.cols)*tw, sy0=(hit.tid/hit.cols|0)*th;
  const chroma=_tmjChromaKey(gid);
  if(!fh&&!fv&&!fd){
    if(chroma) blitImgChroma(hit.img,sx0,sy0,tw,th,px,py,dw,dh);
    else blitImg(hit.img,sx0,sy0,tw,th,px,py,dw,dh);
    return;
  }
  let h=fh,v=fv;
  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.translate(px+dw/2,py+dh/2);
  if(fd){ ctx.rotate(-Math.PI/2); const tmp=h; h=v; v=tmp; }
  ctx.scale(h?-1:1,v?-1:1);
  if(chroma){
    const key=hit.img.src+'|'+sx0+'|'+sy0+'|'+tw+'|'+th+'|246';
    let sheet=_chromaTileCache[key];
    if(!sheet){
      try{
        const c=document.createElement('canvas');c.width=tw;c.height=th;
        const g=c.getContext('2d');g.imageSmoothingEnabled=false;
        g.drawImage(hit.img,sx0,sy0,tw,th,0,0,tw,th);
        const img=g.getImageData(0,0,tw,th);const d=img.data;
        for(let i=0;i<d.length;i+=4){if(d[i]>=246&&d[i+1]>=246&&d[i+2]>=246)d[i+3]=0;}
        g.putImageData(img,0,0);sheet=c;_chromaTileCache[key]=sheet;
      }catch(err){ ctx.drawImage(hit.img,sx0,sy0,tw,th,-dw/2,-dh/2,dw,dh); ctx.restore(); return; }
    }
    ctx.drawImage(sheet,0,0,tw,th,-dw/2,-dh/2,dw,dh);
  }else{
    const bleed=dw>1&&dh>1?1:0;
    ctx.drawImage(hit.img,sx0,sy0,tw,th,-dw/2,-dh/2,dw+bleed,dh+bleed);
  }
  ctx.restore();
}
function _drawTmjTileGid(gid,px,py,tw,th,sc,fh,fv,fd){
  gid=_tmjDisplayGid(gid);
  const hit=_tmjLookupGid(gid);
  const dw=Math.max(1,Math.round(tw*sc)), dh=Math.max(1,Math.round(th*sc));
  if(hit) _blitTmjTile(hit,gid,tw,th,px,py,dw,dh,!!fh,!!fv,!!fd);
  else if(_tmjChromaKey(gid)||TMJ_NOSOLID_GIDS.has(gid)) return;
  else{ ctx.fillStyle=C.BROWN; ctx.fillRect(px,py,dw,dh); }
}
function _drawTmjTileRaw(raw,px,py,tw,th,sc){
  const gid=_tmjGid(raw); if(!gid) return;
  const fl=_tmjFlipFlags(raw);
  _drawTmjTileGid(gid,px,py,tw,th,sc,fl.h,fl.v,fl.d);
}
function _tmjChromaKey(gid){
  if(TMJ_NOSOLID_GIDS.has(gid)) return true;
  if(gid>=TMJ_SPAWN_FIRST_GID&&gid<TMJ_SPAWN_FIRST_GID+TMJ_SPAWN_TILE_COUNT) return true;
  const tid=gid-1;
  if(tid>=4496&&tid<=4510) return true;
  if(TMJ_CANDLE_TIDS.has(tid)||TMJ_LAMP_GLOW_TIDS.has(tid)) return true;
  if(tid>=4308&&tid<=4448) return true;
  return false;
}
function _drawTmjTileLayer(data,mw,mh,tw,th,sc,skipCells,skipGids,mode){
  if(!data)return;
  const tws=tw*sc,ths=th*sc;
  const col0=Math.max(0,Math.floor(camX/(tws))-1), col1=Math.min(mw-1,Math.floor((camX+camViewW())/tws)+2);
  const row0=Math.max(0,Math.floor(camY/(ths))-1), row1=Math.min(mh-1,Math.floor((camY+camViewH())/ths)+2);
  for(let row=row0;row<=row1;row++){
    for(let col=col0;col<=col1;col++){
      const raw=data[row*mw+col];
      const gid=_tmjGid(raw); if(!gid)continue;
      if(skipGids&&skipGids.has(gid))continue;
      if(skipCells&&skipCells.has(row+'_'+col))continue;
      _drawTmjTileRaw(raw,sx(col*tws),sy(row*ths),tw,th,sc);
    }
  }
}
function drawBwallHomeReveal(){
  if(!_tmjDraw||(!_tmjImg&&!TMJ_TILESET_DEFS.some(t=>t.img))) return;
  const{tw,th,sc}=_tmjDraw,tws=tw*sc,ths=th*sc;
  for(const bw of BWALLS){
    if(bw.homeCol==null) continue;
    const gid=bw.bgGid||bw.canvasGid;
    if(!gid) continue;
    if(bw.hp>0&&!_bwallMovedFromHome(bw)) continue;
    _drawTmjTileGid(gid,sx(bw.homeCol*tws),sy(bw.homeRow*ths),tw,th,sc);
  }
}
function drawTmjMap(){
  if(!_tmjDraw) return;
  const{data,canvasData,bgData,destructData,spawnData,mw,mh,tw,th,sc}=_tmjDraw;
  const main=canvasData||data;
  if(!main&&!bgData) return;
  drawParallax();
  if(bgData) _drawTmjTileLayer(bgData,mw,mh,tw,th,sc,null,null,'bg');
  if(main) _drawTmjTileLayer(main,mw,mh,tw,th,sc,null,null,'canvas');
  _drawTmjTileLayer(destructData,mw,mh,tw,th,sc,_bwallDestructSkipCells(),null,'destruct');
  drawBwallHomeReveal();
}
function drawTmjForeground(){ if(!_tmjDraw||!_tmjDraw.fgData)return; const{fgData,mw,mh,tw,th,sc}=_tmjDraw; _drawTmjTileLayer(fgData,mw,mh,tw,th,sc,null,null,'fg'); }

// ── Map load ──────────────────────────────────────────────────
function loadTestMap(){
  const apply=(data,src)=>{
    console.info('MV map source:',src);
    window.MV_STAGE0_MAP=data;
    _safeApplyTmjMap(data);
  };
  if(window.MV_STAGE0_MAP&&window.MV_STAGE0_MAP.layers){
    apply(window.MV_STAGE0_MAP,'embedded awdjoo_map.js');
    return Promise.resolve();
  }
  if(location.protocol==='file:'){
    console.warn('MV: double-click PLAY.bat after exporting from Tiled, or run sync-awdjoo-map.ps1');
    apply(_EMPTY_TMJ_MAP,'empty fallback (file://)');
    return Promise.resolve();
  }
  const path=STAGE0_MAP_PATH;
  const bust=path+'?v=28&'+Date.now();
  return fetch(bust,{cache:'no-store'}).then(r=>{
    if(!r.ok) throw new Error('map HTTP '+r.status+' '+path);
    return r.json();
  }).then(j=>{
    if(!j||!j.layers) throw new Error('invalid TMJ: '+path);
    apply(j,'fetch '+path);
  }).catch(err=>{
    console.error('MV Awdjoo map load failed',err);
    if(window.MV_STAGE0_MAP&&window.MV_STAGE0_MAP.layers){
      apply(window.MV_STAGE0_MAP,'cached MV_STAGE0_MAP');
      return;
    }
    console.warn('MV: using empty map — serve from http://localhost:8765/ and hard-refresh (Ctrl+F5)');
    apply(_EMPTY_TMJ_MAP,'empty fallback');
  });
}
const _mapLoadPromise = loadTestMap();
(function _loadTmjTilesets(){
  _rebuildTmjTilesetDefs(window.MV_STAGE0_MAP||null);
  const groups=new Map();
  for(const ts of TMJ_TILESET_DEFS){
    const key=ts.paths.join('|');
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(ts);
  }
  for(const [key,defs] of groups){
    const paths=defs[0].paths;
    let i=0;
    const next=()=>{
      if(i>=paths.length){console.warn('MV: missing tileset',paths.join(', '));return;}
      const path=paths[i++];
      const img=new Image();
      if(location.protocol!=='file:') img.crossOrigin='anonymous';
      img.onload=()=>{
        const baked=MV2_VISUAL?img:smsProcessPixelArt(img);
        for(const ts of defs){
          ts.img=baked;
          if(ts.firstGid===1){_tmjImg=baked;const autoCols=Math.max(1,Math.floor(img.width/8));ts.cols=autoCols;_tmjImgCols=autoCols;}
          if(ts.animate||paths.some(p=>p.includes('omniblock'))) _omniblockImg=baked;
        }
        console.info('MV tileset loaded:',path,'gids',defs.map(d=>d.firstGid+'-'+d.lastGid).join(', '));
        if(_mapApplied&&_tmjDraw) _safeApplyTmjMap(window.MV_STAGE0_MAP||_EMPTY_TMJ_MAP);
      };
      img.onerror=()=>next();
      img.src=_tmjImgSrc(path);
    };
    next();
  }
})();
setTimeout(_ensureTitleMusic, 250);

// ── Battle / run test worlds ──────────────────────────────────
function initBattleTestWorld(){
  _clearTiledState();
  TR=[...BATTLE_ARENA_TR.map(r=>({x:r[0],y:r[1],w:r[2],h:r[3],tp:r[4]||'solid',mv:null,mp:null}))];
  WW=960; WH=560;
  TR.push({x:-60,y:-400,w:60,h:1200,tp:'solid',mv:null,mp:null});
  TR.push({x:WW,y:-400,w:60,h:1200,tp:'solid',mv:null,mp:null});
  ENEMS=[]; CRATES=[]; BWALLS.length=0; KDROP=[]; kTotal=0; kColl=0; goalOpen=false; win=false; ESHOTS=[]; PFXS=[];
  _spawnX=BATTLE_PLAYER_X; _spawnY=BATTLE_FEET_Y-FEET_OFF;
  p=mkP(); p.x=_spawnX; p.y=_spawnY; p.vx=0; p.vy=0; p.og=true;
  _resetItemProgress(); _unlockedMask=15; ITEM=0;
  _battleTestRound=0; _battleTestKills=0; _battleTestDeaths=0; _battleRandomZoneIn=false;
  camX=0; camY=0; _mapReady=true; _allPCache=null;
  _placeBattlePlayer();
  _spawnBattleTestEnemy(); _syncBattleHud();
  console.info('MV: Battle test world ready');
}
function initRunTestWorld(){
  _clearTiledState();
  TR=[...RUN_TEST_TR.map(r=>({x:r[0],y:r[1],w:r[2],h:r[3],tp:r[4]||'solid',mv:null,mp:null}))];
  WW=3200; WH=560;
  ENEMS=[]; CRATES=[]; BWALLS.length=0; KDROP=[]; kTotal=0; kColl=0; goalOpen=false; win=false; ESHOTS=[]; PFXS=[];
  _spawnX=40; _spawnY=480;
  p=mkP(); p.x=_spawnX; p.y=_spawnY; p.vx=0; p.vy=0; p.og=true;
  _resetItemProgress(); _unlockedMask=15; ITEM=0;
  camX=0; camY=0; _mapReady=true; _allPCache=null;
  console.info('MV: Run test world ready');
}
function startBattleTest(){ _unlockAudio(); _battleTestMode=true; _runTestMode=false; _stageDesignerMode=false; _gameState='game'; _stopBGM('title'); _stopBGM('story'); initBattleTestWorld(); _playBGM('game',OPT.musicVol); _syncBattleHud(); }
function startRunTest(){ _unlockAudio(); _battleTestMode=false; _runTestMode=true; _stageDesignerMode=false; _gameState='game'; _stopBGM('title'); _stopBGM('story'); initRunTestWorld(); _playBGM('game',OPT.musicVol); }

// ── Zone placeholder (procgen) ────────────────────────────────
function _buildZonePlaceholder(idx){
  _clearTiledState();
  TR.length=0;
  TR.push({x:-60,y:-400,w:60,h:4400,tp:'solid',mv:null,mp:null});
  TR.push({x:999999,y:-400,w:60,h:4400,tp:'solid',mv:null,mp:null});
  TR.push({x:-60,y:-460,w:1000120,h:60,tp:'solid',mv:null,mp:null});
  TR.push({x:-9999,y:-9999,w:1,h:1,tp:'solid',mv:null,mp:null});
  buildProcgenWorld(7919*(idx+1)+1000);
  let right=800;
  for(const t of TR){ const edge=Array.isArray(t)?t[0]+t[2]:t.x+t.w; if(edge<900000) right=Math.max(right,edge); }
  WW=right+240; WH=1000; TR[1].x=WW;
  kTotal=KDROP.length; kColl=0;
  _spawnX=110; _spawnY=840-FEET_OFF;
  _respawnPlayer(); p.vx=0; p.vy=0;
  if(p2){p2.x=p.x+34;p2.y=p.y;p2.vx=0;p2.vy=0;}
  edShowToast(ZONES[idx].name);
}

// ── Procgen world ─────────────────────────────────────────────
function buildProcgenWorld(seed){
  let s=seed|0;
  const rng=()=>{ s=(s^(s<<13));s=(s^(s>>7));s=(s^(s<<17)); return((s>>>0)/0xFFFFFFFF); };
  const floorY=840;
  TR.push({x:0,y:floorY,w:4000,h:60,tp:'solid',mv:null,mp:null});
  let x=280;
  for(let i=0;i<28;i++){
    const w=80+rng()*120|0, gap=40+rng()*80|0;
    const y=floorY-(80+rng()*320|0);
    TR.push({x,y,w,h:16,tp:'solid',mv:null,mp:null});
    if(rng()<0.35) TR.push({x:x+w/2-20,y:y-80-rng()*80|0,w:40+rng()*60|0,h:16,tp:'oneway',mv:null,mp:null});
    if(rng()<0.22) KDROP.push({x:x+w/2,y:y-24,ox:x+w/2,oy:y-24,px:0,py:0,vx:0,vy:0,got:false,bob:rng()*Math.PI*2});
    x+=w+gap;
  }
  TR.push({x:x+40,y:floorY-200,w:200,h:16,tp:'solid',mv:null,mp:null});
  GOALPL={x:x+60,y:0,w:80,h:WH};
}

// ── initWorld ─────────────────────────────────────────────────
function initWorld(){
  _clearBattleRespawnTimer();
  _battleTestMode=false; _syncBattleHud(); _runTestMode=false; _stageDesignerMode=false;
  const boot=()=>{
    _ensureCampaignMapApplied();
    ENEMS=[]; CRATES=[]; _restoreMapBWalls(); _resetItemProgress();
    _populateKnowlFromMap(); _initLaituFromMap();
    kColl=0; goalOpen=false; win=false; ESHOTS=[]; PFXS=[];
    _stageScore=0; _stageDamageFree=true; _awdjooTutorial=true;
    p=mkP(); _placePlayerAtSpawn(); _spawnMapEnemies(); _spawnMapCrates();
    _zoneIdx=0; _zoneCardT=220;
    if(typeof _setupAwdjooCampaignGoal==='function') _setupAwdjooCampaignGoal();
    else GOALPL={x:-999,y:0,w:1,h:1};
    console.info('MV world boot:',ENEMS.length,'enemies,',KDROP.length,'knowls, spawn',_spawnX,_spawnY,'cam',Math.round(camX),Math.round(camY),'segs',COLL_SEGS.length,'tmj',!!_tmjDraw);
    if(_playerCount===2){ p2=mkP(); p2.hero=(_heroChoice==='mind'?'venture':'mind'); p2.x=p.x+34; p2.y=p.y; p2.vx=0;p2.vy=0;p2.og=true; }
    else p2=null;
    if(_pendingZone>0){const z=_pendingZone;_pendingZone=0;_enterZone(z);}
  };
  if(_mapReady) boot();
  else _mapLoadPromise.then(boot).catch(err=>{console.error('MV map load failed',err);boot();});
}

// ── NG+ ───────────────────────────────────────────────────────
function startNgPlusRun(){ _ngPlusRun=true; _ngSeed=Date.now()^(Math.random()*0xFFFFFF|0); buildProcgenWorld(_ngSeed); p=mkP(); camX=0; camY=0; edShowToast('NG+ CHAOS RUN BEGINS'); }
const _ngCheckInterval=setInterval(()=>{ if(win&&_gameState==='game'){_winCount++;if(_winCount>=2&&!_ngPlusRun)setTimeout(startNgPlusRun,2000);}},500);

// ── Main update loop ──────────────────────────────────────────
function update(){
  readGamepad(); fr++;
  if(_gameState!=='game') return;
  if(!p) p=mkP();
  if(!isFinite(p.x)) p.x=_spawnX;
  if(!isFinite(p.y)) p.y=_spawnY;
  for(const a of APLAT){a.x+=a.dx;if(a.x<=a.mn||a.x+a.w>=a.mx)a.dx*=-1;}
  for(const m of MPLAT){m.vx*=0.78;m.x=Math.max(m.minX,Math.min(m.maxX-m.w,m.x+m.vx));}

  if(Kj['Tab']){
    if(_stageDesignerMode){_editorActive=false;_gameState='stagedesign';_stopBGM('game');clkj();return;}
    win=false;_shutdownTimer=0;_resetItemProgress();
    if(_battleTestMode) initBattleTestWorld();
    else if(_runTestMode) initRunTestWorld();
    else _enterZone(0);
    clkj();return;
  }
  if(win){clkj();return;}
  if(_shutdownTimer>0){
    _shutdownTimer--;
    p.vx*=0.88; p.vy=Math.min(p.vy+GRAV*0.7,10);
    const pf=p.y+FEET_OFF;
    p.x+=p.vx;if(p.x<0){p.x=0;p.vx=0;}if(p.x>WW-SW){p.x=WW-SW;p.vx=0;}
    resX();p.y+=p.vy;resY(pf);
    if(p.y<20){p.y=20;p.vy=Math.max(0,p.vy);}
    if(_shutdownTimer===0) _respawnPlayer();
    clkj();return;
  }

  // ── Aim ──────────────────────────────────────────────────────
  const up=isUp(),dn=isDn(),lf=isLf(),rt=isRt();
  const adx=(rt?1:0)-(lf?1:0), ady=(dn?1:0)-(up?1:0);
  const _punchingNow=isPunch()||p.pCharging||p.pt>0;
  if(!p.og&&dn&&!up&&(!adx||ady>=Math.abs(adx))){p.tAimDX=0;p.tAimDY=1;p._hasAimInput=true;}
  else if(adx||ady){const l=Math.hypot(adx,ady);p.tAimDX=adx/l;p.tAimDY=ady/l;p._hasAimInput=true;}
  else if(dn&&_punchingNow){p.tAimDX=0;p.tAimDY=1;p._hasAimInput=true;}
  else{p._hasAimInput=false;const spd=Math.abs(p.vx);if(spd>0.4){p.tAimDX=(p.vx>0?1:-1)*Math.min(spd/(MOVE_WALK*MOVE_PEAK),1)*0.7;p.tAimDY=0;}else{p.tAimDX=0;p.tAimDY=0;}}
  if(adx)p.fc=adx>0;else if(K['KeyD']||K['ArrowRight'])p.fc=true;else if(K['KeyA']||K['ArrowLeft'])p.fc=false;
  if(!p._hasAimInput&&!p.wallGrip&&!(_punchingNow&&Math.abs(p.tAimDY)>0.55)){p.aimDX=p.fc?1:-1;p.aimDY=0;}
  const _aimLerp=p._wallAimFree>0?0.88:(p.og?0.2:(p._hasAimInput?0.28:0.08));
  if(p._wallAimFree>0) p._wallAimFree--;
  p.aimDX+=(p.tAimDX-p.aimDX)*_aimLerp; p.aimDY+=(p.tAimDY-p.aimDY)*_aimLerp;
  p.pupilX+=(p.tAimDX*4-p.pupilX)*(p.og?0.18:0.07); p.pupilY+=(p.tAimDY*4-p.pupilY)*(p.og?0.18:0.07);

  if(_bindJ('use')) _cycleItem();

  // ── TRS laser charge ──────────────────────────────────────────
  if(ITEM===0&&_itemUnlocked(0)){
    if(_bindDown('swap')&&!p.laserCharging&&p.laserCd===0){p.laserCharging=true;p.laserCharge=0;}
    if(p.laserCharging){p.laserCharge=Math.min(p.laserCharge+1,40);if(p.laserCharge>4&&fr%6===0)sfx('laser_charge',p.laserCharge/40);}
    if(!_bindDown('swap')&&p.laserCharging){fireItem(p.laserCharge>18);p.laserCharging=false;p.laserCharge=0;p.laserCd=p.laserCharge>18?18:8;}
    if(p.laserCd>0)p.laserCd--;
  }else if(ITEM===1&&_itemUnlocked(1)){if(_bindJ('swap'))fireItem();p.laserCharging=false;p.laserCharge=0;}
  else{p.laserCharging=false;p.laserCharge=0;}

  // ── XLR / MAG hold ────────────────────────────────────────────
  const _fireHeld=_bindDown('swap');
  const _treeBoost=_knowlTreeBoostMul(p);
  if(p.itemStamina<100&&!_fireHeld) p.itemStamina=Math.min(100,p.itemStamina+0.56*_treeBoost);
  if(ITEM===2&&_itemUnlocked(2)){const wasOn=p.xlrOn;p.xlrOn=_fireHeld&&p.itemStamina>0;p.magOn=false;if(p.xlrOn)p.itemStamina=Math.max(0,p.itemStamina-1.2);if(p.xlrOn&&!wasOn){sfx('xlr');p.flashF=9;}p.xlrHeld=p.xlrOn?(p.xlrHeld||0)+1:0;}
  else if(ITEM===3&&_itemUnlocked(3)){const wasOn=p.magOn;p.magOn=_fireHeld&&p.itemStamina>0;p.xlrOn=false;if(p.magOn)p.itemStamina=Math.max(0,p.itemStamina-1.2);if(p.magOn&&!wasOn){sfx('mag');p.flashF=7;}p.magHeld=p.magOn?(p.magHeld||0)+1:0;}
  else{p.xlrOn=false;p.magOn=false;p.xlrHeld=0;p.magHeld=0;}

  // ── Punch charge ──────────────────────────────────────────────
  const _fMoving=isSprintHeld()&&_playerGrounded(p);
  if(isPunch()&&!p.pCharging&&p.pCd===0&&!_fMoving){p.pCharging=true;p.pCharge=0;}
  if(_fMoving&&p.pCharging){p.pCharging=false;p.pCharge=0;}
  if(p.pCharging)p.pCharge=Math.min(p.pCharge+1,28);
  if(!isPunch()&&p.pCharging&&p.pCd===0){p.pCharging=false;p.pt=p.pCharge>20?8:5;p.pCd=7;p._hitDone=false;const charged=p.pCharge>20;sfx(charged?'hook_charged':'punch');}
  if(p.pt>0)p.pt--;else p._hitDone=false;
  if(p.pCd>0)p.pCd--;
  if(p._pRecoil>0)p._pRecoil--;
  if(p.inv>0)p.inv=0;if(p.landF>0)p.landF--;if(p.flashF>0)p.flashF--;if(p._groundHold>0)p._groundHold--;
  if(p.fireRecoil>0){const recoilDecay=(p._lastRecoilMax||6)>=18?1.35:1;p.fireRecoil=Math.max(0,p.fireRecoil-recoilDecay);}

  // ── HP / heal frac ────────────────────────────────────────────
  if(p.hp!==p._prevHp){
    _syncLivesFromHp(p); _gameLivesFrac=Math.max(0,p.hp/p.maxHp);
    if(p.hp<p._prevHp) _healFrac=Math.max(0.12,_gameLivesFrac-0.38); else _healFrac=_gameLivesFrac;
    updateGameBgm(); p._prevHp=p.hp; p._prevLives=p.lives;
  }
  const HEAL_RATE=1/240;
  if(_healFrac<_gameLivesFrac){_healFrac=Math.min(_gameLivesFrac,_healFrac+HEAL_RATE);updateGameBgm();}
  if(p.hp<p.maxHp&&_shutdownTimer<=0){
    p._lifeRegenT=(p._lifeRegenT||0)+_knowlTreeBoostMul(p);
    if(p._lifeRegenT>=LIFE_REGEN_FRAMES){p._lifeRegenT=0;p.hp=Math.min(p.maxHp,p.hp+PLAYER_HIT_DMG);_syncLivesFromHp(p);p.flashF=Math.max(p.flashF,6);}
  }else p._lifeRegenT=0;

  updateHook(); updateLaitu();
  updatePlayerShots(); updateXLR(); updateMAG();

  // ── Enemy update ──────────────────────────────────────────────
  _purgeMinions();
  for(const e of ENEMS){
    if(e.mind){
      if(e.alive){if(e.hitF>0)e.hitF--;_updateMindEnemy(e);const playerFeet=p.y+FEET_OFF,fL=p.x+FEET_L,fR=fL+FEET_W;const stompFromAbove=p.vy>1.2&&playerFeet<=e.y+14&&fR>e.x+8&&fL<e.x+e.w-8;if(stompFromAbove&&_shutdownTimer<=0){_damageEnemy(e,ENM_DMG.stomp,p.x+SW/2,p.y+FEET_OFF,0.5);p.vy=-9;}}
      else{_updateMindEnemyOff(e);const playerFeet=p.y+FEET_OFF,fL=p.x+FEET_L,fR=fL+FEET_W;const stompFromAbove=p.vy>1.2&&playerFeet<=e.y+14&&fR>e.x+8&&fL<e.x+e.w-8;if(stompFromAbove&&_shutdownTimer<=0&&e._mindOff==='rebooting'){_tryInterruptMindReboot(e);p.vy=-9;}}
      if(_enemyBodyPresent(e)) _resolvePlayerEnemySeparation(p,e,8);
      continue;
    }
    if(!e.alive){_updateMinionShut(e);continue;}
    if(e.hitF>0)e.hitF--;
    const pdx=p.x+SW/2-(e.x+e.w/2),pdy=(p.y+FEET_OFF-STAND_H/2)-(e.y+e.h/2),pdist=Math.hypot(pdx,pdy)||1;
    if(e.shotCd>0)e.shotCd--;
    if(e.type==='signol'){
      _updateSignol(e,pdist,pdx);
      if(e.alive&&e.signolState==='roll'){e.x+=(e.vx||0);e.x=Math.max(e.mn,Math.min(e.mx-e.w,e.x));if(e.og){const edx=e.x-(e._prevX??e.x);if(Math.abs(edx)>=0.01)e.wheelAngle=(e.wheelAngle||0)+edx/WHEEL_R;}e._prevX=e.x;}
    }else if(e.type==='circle'){
      if(Math.abs(e.vx)<0.1)e.vx=e.spd*e.dir;
      if(e.x<=e.mn||e.x+e.w>=e.mx){e.dir*=-1;e.vx=e.spd*e.dir;}
      if(e.shotCd===0&&pdist<600&&e.og){const spd=3.5,gdx=pdx/pdist,gdy=pdy/pdist;e.grenades.push({x:e.x+e.w/2,y:e.y+e.h/2,vx:gdx*spd+(Math.random()-0.5)*0.5,vy:gdy*spd-3.5,life:120,exploded:false,explodeF:0});e.shotCd=200+Math.random()*120|0;}
      for(let gi=e.grenades.length-1;gi>=0;gi--){const g=e.grenades[gi];if(g.exploded){g.explodeF++;if(g.explodeF===1){for(let f2=0;f2<8;f2++){const fa=f2*Math.PI/4;ESHOTS.push({x:g.x,y:g.y,vx:Math.cos(fa)*5,vy:Math.sin(fa)*5-1,life:999,type:'frag',col:'#ff8800'});}}if(g.explodeF>12)e.grenades.splice(gi,1);}else{g.vy+=GRAV*0.55;g.x+=g.vx;g.y+=g.vy;g.life--;if(g.life<=0)g.exploded=true;const _allPl=allP();for(const q of _allPl){if(ov(g.x-4,g.y-4,8,8,q.x,q.y,q.w,q.h)){g.exploded=true;break;}}const _pCoreG=playerCoreHB(p);if(_shutdownTimer<=0&&ov(g.x-8,g.y-8,16,16,_pCoreG.x,_pCoreG.y,_pCoreG.w,_pCoreG.h)){g.exploded=true;applyPlayerHit(g.vx*0.4,-2,PLAYER_HIT_DMG);}}}
      _applyActorGravity(e,e.h,0.55);
    }else if(e.type==='square'){
      if(Math.abs(e.vx)<0.1)e.vx=e.spd*e.dir;
      if(e.x<=e.mn||e.x+e.w>=e.mx){e.dir*=-1;e.vx=e.spd*e.dir;}
      if(e.shotCd===0&&pdist<500&&e.og){ESHOTS.push({x:e.x+e.w/2+(e.dir>0?e.w/2:-e.w/2),y:e.y+e.h/2,vx:e.dir*5+(pdx/pdist)*1.5,vy:(pdy/pdist)*3-1.5,life:999,type:'laser',col:'#ff4400',bounces:0,power:0.8,born:fr,owner:'enemy'});e.shotCd=90+Math.random()*60|0;sfx('laser');}
      _applyActorGravity(e,e.h,0.55);
    }else if(e.type==='flyer'){
      const tx=p.x+SW/2-(e.x+e.w/2),ty=(p.y+FEET_OFF-30)-(e.y+e.h/2),td=Math.hypot(tx,ty)||1;
      if(pdist<400){e.vx+=(tx/td)*0.08;e.vy+=(ty/td)*0.06;}else{e.vx*=0.95;e.vy*=0.95;}
      e.vx=Math.max(-e.spd,Math.min(e.spd,e.vx));e.vy=Math.max(-e.spd*0.6,Math.min(e.spd*0.6,e.vy));
      e.x+=e.vx;e.y+=e.vy;e.x=Math.max(e.mn,Math.min(e.mx-e.w,e.x));
      if(e.shotCd===0&&pdist<300){ESHOTS.push({x:e.x+e.w/2,y:e.y+e.h/2,vx:(tx/td)*6,vy:(ty/td)*6,life:999,type:'laser',col:'#ff4400',bounces:0,power:0.7,born:fr,owner:'enemy'});e.shotCd=120+Math.random()*80|0;sfx('laser');}
    }
    if(e.type==='signol'){const sc2=_signolCenter(e);const stompFromAbove=p.vy>1.2&&p.y+FEET_OFF<=sc2.cy+6&&p.x+FEET_L+FEET_W>sc2.cx-e.r+6&&p.x+FEET_L<sc2.cx+e.r-6;if(stompFromAbove&&_shutdownTimer<=0){_damageEnemy(e,ENM_DMG.stomp,p.x+SW/2,p.y+FEET_OFF,0.5);p.vy=-9;}_resolvePlayerSignolSeparation(p,e);}
    else{if(_enemyBodyPresent(e)) _resolvePlayerEnemySeparation(p,e);const playerFeet=p.y+FEET_OFF,fL=p.x+FEET_L,fR=fL+FEET_W;const stompFromAbove=p.vy>1.2&&playerFeet<=e.y+10&&fR>e.x+4&&fL<e.x+e.w-4;if(stompFromAbove&&_shutdownTimer<=0&&e.alive){_damageEnemy(e,ENM_DMG.stomp,p.x+SW/2,p.y+FEET_OFF,0.5);p.vy=-9;}}
    _tickRivalMinionSpawn(e);
  }
  _resolveMindEnemiesSeparation();
  if(_battleTestMode){for(const e of ENEMS){if(e.mind&&_enemyBodyPresent(e)) _resolvePlayerEnemySeparation(p,e,8);}}

  updateEnemyShots(); updateCrates(); updateKnowls(); updateRopePickup(); updateParticles(); updateBgParticles();

  // ── Player movement + wall jump ───────────────────────────────
  const _pRollX0=p.x, _pRollY0=p.y;
  if(p.hook.st==='idle'){
    const _wall=_wallTouchInfo(p);
    if(_wall.touch&&!p.og&&isJumpJ()){p.wallDir=_wall.dir;_wallJumpOff(p);OPT.binds.jump.forEach(c=>delete Kj[c]);}
    if(p.wallGrip>0){
      if(p.og)p.wallGrip=0;
      else{p.wallGrip--;const wc=90-p.wallGrip;if(wc>=60&&!p._wallChargeReady){p._wallChargeReady=true;sfx('chargeReady');}p.vx=0;const _slideFrac=1-p.wallGrip/90;p.vy=0.28+_slideFrac*1.7;if(isJumpJ()){_wallJumpOff(p);OPT.binds.jump.forEach(c=>delete Kj[c]);}else if(!_wall.touch&&p.wallGrip<70){p.wallGrip=0;p._wallChargeReady=false;}else if(p.wallGrip===0){p._wallChargeReady=false;p.vx=-p.wallDir*1.5;}}
    }
  }
  if(p.hook.st!=='on'&&p.wallGrip<=0){
    if(!isJump()) p._jumpArmed=true;
    const _grounded=_playerOnGround(p);
    p.crouchInput=!!(_grounded&&isDn());const airDuck=!_grounded&&isDn();const headroom=measureHeadroom(p);const tunnelNeed=headroom<STAND_H-8?Math.min(1,(STAND_H-8-headroom)/(STAND_H-DUCK_H)):0;const target=Math.max((p.crouchInput||airDuck)?1:0,tunnelNeed);p.crouchAmt+=(target-p.crouchAmt)*(target>p.crouchAmt?0.28:0.16);if(p.crouchAmt<0.02)p.crouchAmt=0;if(p.crouchAmt>0.98)p.crouchAmt=1;
    if(_grounded&&isDn()){p.duckCharge=Math.min(90,(p.duckCharge||0)+1);if(p.duckCharge>=60&&!p.duckBoostReady){p.duckBoostReady=true;sfx('chargeReady');}}
    else if(_grounded){p.duckCharge=Math.max(0,(p.duckCharge||0)-2);if(p.duckCharge<40)p.duckBoostReady=false;}
    else{p.duckCharge=0;p.duckBoostReady=false;}
    p._ux0=p.x;
    _updatePlayerMoveX(p);
    if(_playerOnGround(p)) p.momentum=Math.min(1,Math.abs(p.vx)/MOVE_RUN*0.55+(p.runRamp||0)*0.45);
    else p.momentum=Math.max(0,(p.momentum||0)*0.985);
    if(_playerOnGround(p)&&Math.abs(p.vx)>0.05){if(!p._prevVx)p._prevVx=0;const dirChange=Math.sign(p.vx)!==Math.sign(p._prevVx)&&Math.abs(p._prevVx)>1.5;const braking=Math.abs(p.vx)<Math.abs(p._prevVx)-1.2&&Math.abs(p._prevVx)>2;if(dirChange||braking){for(let i=0;i<5;i++){const ang=Math.PI+Math.random()*Math.PI;p.smoke.push({x:p.x+SW/2+(Math.random()-0.5)*8,y:p.y+FEET_OFF-4,vx:(Math.random()-0.5)*1.8+(dirChange?-Math.sign(p._prevVx)*1.5:0),vy:-Math.random()*1.2-0.4,life:22+Math.floor(Math.random()*12),maxLife:34,r:3+Math.random()*4});}}}
    p._prevVx=p.vx;
    if(!p.smoke)p.smoke=[];
    for(let i=p.smoke.length-1;i>=0;i--){const sm=p.smoke[i];sm.x+=sm.vx;sm.y+=sm.vy;sm.vx*=0.88;sm.vy+=0.05;sm.life--;if(sm.life<=0)p.smoke.splice(i,1);}
    if(isJumpJ()&&p._jumpArmed&&_playerOnGround(p)){
      p._jumpArmed=false;
      if(measureHeadroom(p)<STAND_H+8) p._autoHeadTuck=1;
      if(p.duckBoostReady){p.vy=JI*2.05;p.jf=JMH+10;p.duckBoostReady=false;p.duckCharge=0;p.flashF=Math.max(p.flashF,6);for(let i=0;i<10;i++){const a=Math.PI+(Math.random()-0.5)*1.9,sp=2+Math.random()*3.6;PFXS.push({x:p.x+SW/2,y:p.y+FEET_OFF-2,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1.2,life:14+Math.random()*8|0,maxLife:22,r:2+Math.random()*2.5,col:p.hero==='venture'?'#ff9fb0':'#c9a0ff'});}sfx('jump_spring');}
      else{p.vy=JI;p.jf=JMH;sfx('jump_reg');}
      p.og=false;p._groundHold=0;p._groundSeg=null;p._peakVy=0;const takeVy=Math.abs(p.vy);p._jumpAmp=Math.min(1,Math.max(0.25,takeVy/7.2));p.jumpTiltF=Math.round(14+p._jumpAmp*16);const jhx=Math.abs(p.vx)>0.25?p.vx:(p.fc?1:-1)*0.55;const jhy=p.vy<-0.2?-1:(p.vy>0.5?0.35:-0.75);const jhl=Math.hypot(jhx,jhy)||1;p._jumpHatDX=jhx/jhl;p._jumpHatDY=jhy/jhl;
    }
    const _inJumpAir=!_playerOnGround(p)&&p.hook.st!=='on'&&p.wallGrip<=0;
    if(_inJumpAir&&p.jumpTiltF>0)p.jumpTiltF=Math.max(0,p.jumpTiltF-0.55);else if(p.jumpTiltF>0)p.jumpTiltF=Math.max(0,p.jumpTiltF-2.5);
    if(isJump()&&p.jf>0){p.vy=Math.max(p.vy-JHH,JMX);p.jf--;}else if(!isJump())p.jf=0;
    if(_grounded&&p.vy>=0) p.vy=0;
    else p.vy=Math.min(p.vy+(isJump()&&p.jf>0&&p.vy<0?GRAV*0.38:GRAV),14);
    if(!_playerOnGround(p)&&p.hook.st!=='on'&&p.wallGrip<=0) p._peakVy=Math.max(p._peakVy||0,p.vy);
    _movePlayerWithColl(p,p.vx,p.vy);
    const _moveDir=_moveInputX();
    if(_moveDir&&_playerOnGround(p)){
      const _moved=Math.abs(p.x-p._ux0);
      const _vx=Math.abs(p.vx||0);
      const _blocked=_vx>0.35&&_moved<_vx*0.22;
      if(_blocked){
        if(typeof _cornerStepResolve==='function'&&_cornerStepResolve(p)) p._moveBlocked=false;
        else{
          p.vx=0;
          p._moveBlocked=true;
          const _wt=_wallTouchInfo(p);
          if(!(_wt.touch&&_wt.dir===_moveDir)) p._grindF=Math.min(12,(p._grindF||0)+1);
        }
      }else if(_moved>=Math.max(1.2,_vx*0.45)){ p._grindF=0; p._moveBlocked=false; }
    }else if(!_moveDir) p._moveBlocked=false;
  }else if(p.hook.st!=='on'&&p.wallGrip>0){ _movePlayerWithColl(p,p.vx,p.vy); }
  if(p.y<20){p.y=20;p.vy=Math.max(0,p.vy);}
  p.x=Math.max(0,Math.min(WW-SW,p.x));
  _resolveAllPlayerEnemyCollisions(p);
  _checkPlayerEnemyBodyDamage(p);
  if(!isFinite(p.y)||(p.y+FEET_OFF>WH+64&&p.vy>0.25)){
    if(_mapApplied&&!_battleTestMode&&!_runTestMode&&_zoneIdx===0){
      if((p._fallRespawnCd||0)<=0){
        p._fallRespawnCd=60;
        _placePlayerAtSpawn();
      } else p._fallRespawnCd--;
    }
    else{
      const recoverX=Math.max(0,Math.min(WW-SW,p.x));
      const feetY=_surfaceYAt(recoverX+SW/2,Math.min(WH,p.y+FEET_OFF),96);
      if(feetY<WH-30){p.x=recoverX;p.y=feetY-FEET_OFF;p.vy=0;p.vx*=0.5;p.og=true;}
      else if(p.y>WH+240) _placePlayerAtSpawn();
    }
  }

  if(_playerCount===2) updateCoopPlayer2();

  updateBWalls();
  _stabilizePlayerCollision(p); if(p2)_stabilizePlayerCollision(p2);
  if(typeof _syncPushGrind==='function') _syncPushGrind(p);
  _wheelEdgeRoll(p); if(p2)_wheelEdgeRoll(p2);
  _updateWheelSuspension(p,p._prevVx||0); if(p2)_updateWheelSuspension(p2,p2._prevVx||0);
  _rollWheelFromTravel(p,_pRollX0,_pRollY0); if(p2)_rollWheelFromTravel(p2,_coopRollX0,_coopRollY0);
  _resolveAllPlayerEnemyCollisions(p);
  if(p2) _resolveAllPlayerEnemyCollisions(p2);
  if(!isFinite(p.x))p.x=_spawnX; if(!isFinite(p.y))p.y=_spawnY;
  if(typeof _sanitizeActorVel==='function'){ _sanitizeActorVel(p); if(p2) _sanitizeActorVel(p2); }

  // ── Goal / win check ─────────────────────────────────────────
  const _pCoreGoal=playerCoreHB(p),_gr=_goalRect();
  const p1Goal=ov(_pCoreGoal.x,_pCoreGoal.y,_pCoreGoal.w,_pCoreGoal.h,_gr.x,_gr.y,_gr.w,_gr.h);
  const p2Goal=!!(p2&&(()=>{const h2=playerCoreHB(p2);return ov(h2.x,h2.y,h2.w,h2.h,_gr.x,_gr.y,_gr.w,_gr.h);})());
  if(!win&&!_battleTestMode&&_zoneIdx===0&&_laitu&&!_laitu.met){
    const h=playerCoreHB(p);const spawnDist=Math.hypot(p.x-_spawnX,p.y-_spawnY);
    if(spawnDist>100&&ov(h.x-4,h.y,h.w+8,h.h,_laitu.x,_laitu.y,_laitu.w,_laitu.h)) _startLaituCutscene();
  }else if(!win&&goalOpen&&(_zoneIdx>0||_stageDesignerMode||_zoneIdx===0)&&(p1Goal||p2Goal)){
    if(_stageDesignerMode){edShowToast('GOAL REACHED! TAB to return to hub');sfx('unlock');}
    else if(_zoneIdx<ZONES.length-1){_enterZone(_zoneIdx+1);sfx('chargeReady');}
    else{win=true;_markGameBeaten();}
  }
  _tickBattleTestSpawner();
  if(window.__MV_HEALTH&&typeof window.__MV_HEALTH.tick==='function') window.__MV_HEALTH.tick();
  clkj(); Object.keys(Kj2).forEach(k=>delete Kj2[k]);
}

// ── Main draw loop ────────────────────────────────────────────
function draw(){
  ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over'; ctx.setLineDash([]); ctx.clearRect(0,0,W,H);
  if(_gameState==='title'){drawTitle();return;}
  if(_gameState==='tutorial'){drawTutorialChamber();return;}
  if(_gameState==='levels'){drawLevelSelect();return;}
  if(_gameState==='stagedesign'){drawStageDesignHub();return;}
  if(_gameState==='options'){drawOptions();return;}
  if(_gameState==='story'){_storyFr++;drawStory();return;}
  if(_gameState==='cutscene'){_cutsceneFr++;drawCutscene();return;}
  if(_gameState==='select'){drawSelect();return;}
  _snapRenderCam();
  if(_tmjDraw) drawTmjMap();
  drawBGParticles(); drawCandleLights();
  if(!_tmjDraw){
    drawParallax();
    const apl=allP();
    for(const pl of apl){if(pl.mp)drawMovPlat(pl.mp);else if(!pl.mv)drawPlat(pl);}
    for(const a of APLAT){const bx=sx(a.x),by=sy(a.y);ctx.fillStyle=C.BROWN;ctx.fillRect(bx,by,sw(a.w),sw(a.h));ctx.fillStyle=C.ORANGE;ctx.fillRect(bx,by,sw(a.w),1);}
    if(_battleTestMode&&_gameState==='game'){const z=BATTLE_RANDOM_SPAWN_ZONE;const zx=sx(z.x),zy=sy(z.y),zw=sw(z.w),zh=sw(z.h);ctx.fillStyle='rgba(96,180,255,0.18)';ctx.fillRect(zx,zy,zw,zh);ctx.strokeStyle='rgba(140,210,255,0.65)';ctx.lineWidth=1;ctx.strokeRect(zx,zy,zw,zh);if(fr%48<24)drawTextC('RANDOM RIVAL',zx+zw/2,Math.max(4,zy-6),'#8cf',2);}
  }
  drawGoal();
  for(const pf of PFXS){const t=pf.life/pf.maxLife;if(pf.shimmer){ctx.globalAlpha=Math.min(1,t*1.1);ctx.fillStyle=pf.col;ctx.beginPath();ctx.arc(sx(pf.x),sy(pf.y),pf.r*(0.6+t*0.5),0,Math.PI*2);ctx.fill();if(t>0.5){ctx.globalAlpha=(t-0.5)*0.5;ctx.strokeStyle=pf.col;ctx.lineWidth=1;ctx.beginPath();ctx.arc(sx(pf.x),sy(pf.y),pf.r*(1.2+t),0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;continue;}if(t<0.4&&(fr&1))continue;ctx.fillStyle=pf.col;const pr=t>0.6?2:1;ctx.fillRect(sx(pf.x),sy(pf.y),pr,pr);}
  for(const s of ESHOTS){const bx=sx(s.x),by=sy(s.y);if(s.type==='signol_frag'){const r=sw(s.r||5),dull=s.settled,ageAfterStop=dull?(fr-(s.stopFr||fr)):0,fade=dull?Math.max(0.2,1-ageAfterStop/SIGNOL_FRAG_STOP_FADE):1,pulse=dull?0.55:0.85+0.15*Math.sin(fr*0.35+s.x*0.1);ctx.globalAlpha=fade*pulse;if(dull){ctx.fillStyle='#6a4030';ctx.fillRect(bx-r*0.6,by-r*0.4,r*1.2,r*0.9);ctx.fillStyle='#4a3028';ctx.fillRect(bx-r*0.35,by-r*0.2,r*0.7,r*0.45);}else{const ta=Math.atan2(s.vy||0,s.vx||-0.01)+Math.PI;for(let fi=0;fi<3;fi++){const d=fi*5+2;ctx.globalAlpha=fade*(0.4-fi*0.1);ctx.fillStyle=fi===0?'#ffff55':(fi===1?'#ff8800':'#ff3300');ctx.beginPath();ctx.arc(sx(s.x+Math.cos(ta)*d),sy(s.y+Math.sin(ta)*d),r*(0.38-fi*0.09),0,Math.PI*2);ctx.fill();}ctx.globalAlpha=fade*pulse;ctx.fillStyle='#ff4400';ctx.beginPath();ctx.arc(bx,by,r,0,Math.PI*2);ctx.fill();ctx.fillStyle=(fr&1)?C.YELLOW:C.ORANGE;ctx.beginPath();ctx.arc(bx,by,r*0.55,0,Math.PI*2);ctx.fill();ctx.fillStyle=C.WHITE;ctx.fillRect(bx-1,by-1,2,2);}ctx.globalAlpha=1;continue;}const sp=Math.hypot(s.vx,s.vy)||1,ux=s.vx/sp,uy=s.vy/sp;ctx.fillStyle=C.RED;ctx.fillRect(bx-1,by-1,3,2);ctx.fillStyle=(fr&1)?C.ORANGE:C.YELLOW;ctx.fillRect(bx,by-1,1,1);ctx.fillStyle=C.ORANGE;ctx.fillRect(bx-Math.round(ux*3),by-Math.round(uy*3)-1,1,1);}
  drawKnowlTreeAura(); drawRopePickup(); drawKnowl();
  const _bwPad=64;
  for(const bw of BWALLS){if(bw.hp<=0)continue;const bx=sx(bw.x),by=sy(bw.y);if(bx>W+_bwPad||bx+sw(bw.w)<-_bwPad||by>H+_bwPad||by+sw(bw.h)<-_bwPad)continue;try{drawBreakWall(bw);}catch(err){console.error('bwall draw',err,bw);_sanitizeBwall(bw);}}
  for(const c of CRATES) drawCrate(c);
  for(const e of ENEMS) if(!e.mind) drawEnemy(e);
  drawLaitu();
  p._armPose=computeConnectorArmPose(p); if(p2)p2._armPose=computeConnectorArmPose(p2);
  drawFX(); ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
  try{drawCharacter();}catch(err){console.error('player draw',err);}
  if(_playerCount===2&&p2){try{drawCharacterFor(p2);}catch(err){console.error('p2 draw',err);}}
  for(const e of ENEMS) if(e.mind) drawMindEnemy(e);
  drawRopePickupAnim(); drawTmjForeground(); drawFgLampGlow(); drawDamageOverlay(); drawItemTutorial(); drawHUD(); drawAtmosphere();
  if(_playerCount===2&&p2){ctx.fillStyle=C.BLACK;ctx.fillRect(0,12,52,7);drawText('P2 HP '+Math.round(p2.hp||0)+'/'+PLAYER_MAX_HP,2,13,C.PINK);}
  if(_shutdownTimer>0){const shutT=1-_shutdownTimer/SHUTDOWN_FRAMES;ditherRect(0,0,W,H,C.BLACK,fr);for(let i=0;i<9;i++){const y2=((i*23+fr*3)%H)|0;ctx.fillStyle=(i+fr)%3?C.PURPLE_D:C.VIOLET;ctx.fillRect(0,y2,W,1);}if(shutT>0.2){ctx.fillStyle=C.BLACK;ctx.fillRect(W/2-58,H*0.40,116,22);if(fr%16<12)drawTextC('SYSTEM SHUTDOWN',W/2,Math.round(H*0.42),C.LILAC);drawTextC('REBOOTING...',W/2,Math.round(H*0.42)+10,C.PURPLE_L);}}
  if(_zoneCardT>0){_zoneCardT--;if(_zoneCardT>10||(fr&1)===0){ctx.fillStyle=C.BLACK;ctx.fillRect(0,Math.round(H*0.30),W,26);drawTextC(_runTestMode?'RUN TEST GROUND':(_battleTestMode?'BATTLE PRACTICE':ZONES[_zoneIdx].name.toUpperCase()),W/2,Math.round(H*0.30)+5,C.YELLOW,2);drawTextC(_runTestMode?'ROLL OVER BUMPS — TEST SUSPENSION':(_battleTestMode?'VS SIGNOL — GRENADE RIVAL':'ZONE '+(_zoneIdx+1)+' OF '+ZONES.length),W/2,Math.round(H*0.30)+19,C.GREY);}}
  if(win){ctx.fillStyle=C.BLACK;ctx.fillRect(0,0,W,H);drawTextC('SUMMIT!',W/2,H/2-22,C.GREEN_L,3);if(_gameBeaten)drawTextC('CREATIVE MODE UNLOCKED',W/2,H/2-4,C.TEAL_L);drawTextC('TAB TO PLAY AGAIN',W/2,H/2+14,C.GREEN);}
  if(p.momentum>0.05&&isFinite(p.momentum)){ctx.fillStyle=C.ORANGE;const segs=Math.round(p.momentum*16);for(let i=0;i<segs;i++)ctx.fillRect(i*16,H-2,12,2);}
  updateVersionBar();
}

// ── rAF loop (fixed-timestep) ─────────────────────────────────
// Logic must tick at a steady 60Hz no matter the display refresh rate.
// A raw rAF tick made the game run 2-2.7x too fast and feel choppy on
// 120/144/165Hz monitors; an accumulator decouples logic from render.
const _FIXED_DT=1000/60;
const _MAX_CATCHUP=5;
let _loopAccT=0, _loopLastT=0;
function loop(ts){
  if(!p) p=mkP();
  if(!p._lastWTap) p._lastWTap=-99;
  const now=ts||(typeof performance!=='undefined'?performance.now():Date.now());
  if(!_loopLastT) _loopLastT=now;
  let frameT=now-_loopLastT;
  _loopLastT=now;
  if(!(frameT>0)||frameT>250) frameT=_FIXED_DT; // first frame / backgrounded tab / big hitch
  // vsync smoothing: snap delta to a whole number of 60Hz steps when it's
  // within ~2ms, so refresh rates at/near the logic rate don't beat between
  // 0-step and 2-step frames (the main source of standing-still judder).
  const _snap=Math.round(frameT/_FIXED_DT)*_FIXED_DT;
  if(_snap>0&&Math.abs(_snap-frameT)<2) frameT=_snap;
  if(!_editorActive){
    _loopAccT+=frameT;
    let steps=0;
    while(_loopAccT>=_FIXED_DT&&steps<_MAX_CATCHUP){
      try{update();}catch(err){console.error('update error',err);}
      _loopAccT-=_FIXED_DT; steps++;
    }
    if(steps>=_MAX_CATCHUP) _loopAccT=0; // drop backlog, avoid spiral of death
    _syncGameCamera();
  }else{ _loopAccT=0; }
  try{draw();}catch(err){console.error('draw error',err);const inf=document.getElementById('inf');if(inf){inf.style.color='#f00';inf.textContent='DRAW: '+err.message;}}
  try{drawEditorOverlay();}catch(err){console.error('editor overlay error',err);}
  requestAnimationFrame(loop);
}
try {
  loop();
}catch(e){
  document.getElementById('inf').style.color='#f00';
  document.getElementById('inf').style.fontSize='11px';
  document.getElementById('inf').textContent='CRASH: '+e.message+' | '+(e.stack?e.stack.split('\n')[1]:'');
  console.error(e);
}
