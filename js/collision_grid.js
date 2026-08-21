// ============================================================
//  Mind & Venture — collision_grid.js
//  ONE tile-type grid. ONE resolver. KEEP OUT / merged TR /
//  tile-grass segs / omniblock AABB walls are not authorities.
//
//  Types: 0 AIR, 1 SOLID, 2 ONEWAY, 3 DESTRUCTIBLE
//  Resolver: move X then Y, swept <=2px, depenetrate up.
// ============================================================

const MV_GRID_AIR=0, MV_GRID_SOLID=1, MV_GRID_ONEWAY=2, MV_GRID_DESTRUCT=3;
const MV_GRID_STEP=2;
let MV_GRID=null;

function _gridReady(){ return !!(MV_GRID&&MV_GRID.ready&&MV_GRID.tile>0); }

function _gridGid(raw){
  if(typeof _tmjGid==='function') return _tmjGid(raw);
  return (raw|0)&0x1FFFFFFF;
}

function _gridLayerName(layer){
  return String((layer&&layer.name)||'').toLowerCase().replace(/!/g,'').trim();
}

function gridCell(c,r){
  if(!_gridReady()) return MV_GRID_AIR;
  if(c<0||r<0||c>=MV_GRID.cols||r>=MV_GRID.rows) return MV_GRID_SOLID;
  return MV_GRID.data[r][c];
}

function gridSolid(c,r){
  const t=gridCell(c,r);
  return t===MV_GRID_SOLID||t===MV_GRID_DESTRUCT;
}

function gridSet(c,r,type){
  if(!_gridReady()) return;
  if(c<0||r<0||c>=MV_GRID.cols||r>=MV_GRID.rows) return;
  MV_GRID.data[r][c]=type;
}

function gridWorldSolid(wx,wy){
  if(!_gridReady()) return false;
  const t=MV_GRID.tile;
  return gridSolid(Math.floor(wx/t), Math.floor(wy/t));
}

function gridSpan(px, pw, tile){
  const c0=Math.floor(px/tile);
  const c1=Math.floor((px+pw-1)/tile);
  return [c0,c1];
}

function buildCollisionGridFromTmj(data, sc){
  sc=sc||(typeof TILED_WORLD_SCALE!=='undefined'?TILED_WORLD_SCALE:4);
  const tw=data.tilewidth||8, th=data.tileheight||8;
  const cols=data.width||0, rows=data.height||0;
  const tile=tw*sc;
  const grid=[];
  for(let r=0;r<rows;r++){
    grid[r]=new Array(cols);
    for(let c=0;c<cols;c++) grid[r][c]=MV_GRID_AIR;
  }
  const layers=data.layers||[];
  const stampCell=(c,r,type)=>{
    if(c<0||r<0||c>=cols||r>=rows) return;
    if(type===MV_GRID_DESTRUCT || grid[r][c]!==MV_GRID_DESTRUCT) grid[r][c]=type;
  };
  const stampGid=(arr, type)=>{
    if(!arr||!arr.length) return;
    for(let i=0;i<arr.length && i<cols*rows;i++){
      if(!_gridGid(arr[i])) continue;
      stampCell(i%cols,(i/cols)|0,type);
    }
  };
  const stampRect=(x,y,w,h,type)=>{
    const c0=Math.floor(x/tile), c1=Math.floor((x+Math.max(1,w)-1)/tile);
    const r0=Math.floor(y/tile), r1=Math.floor((y+Math.max(1,h)-1)/tile);
    for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++) stampCell(c,r,type);
  };
  const stampEdge=(x0,y0,x1,y1,type)=>{
    const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0),1);
    for(let i=0;i<=n;i++){
      stampCell(Math.floor((x0+(x1-x0)*i/n)/tile), Math.floor((y0+(y1-y0)*i/n)/tile), type);
    }
  };
  const hasGid=(arr,c,r)=>{
    if(!arr||c<0||r<0||c>=cols||r>=rows) return false;
    return !!_gridGid(arr[r*cols+c]);
  };

  let dirtData=null, grassData=null;
  const keepOutPolys=[];

  for(const layer of layers){
    const lname=_gridLayerName(layer);
    if(layer.type==='tilelayer'){
      const d=layer.data||[];
      const isDirt=lname==='dirt stuf'||lname==='dirt'||lname==='background';
      const isGrass=lname==='grass stuff'||lname==='grass'||lname==='canvas';
      const isDest=lname==='destruct'||lname==='destructible'||lname==='destructibles';
      if(isDirt) dirtData=d;
      if(isGrass) grassData=d;
      if(isDest) stampGid(d, MV_GRID_DESTRUCT);
      continue;
    }
    if(layer.type!=='objectgroup') continue;
    // KEEP OUT is not a runtime collider. Bake its edges into the typed grid, then discard.
    if(lname==='keep out'||lname==='keepout'||lname==='collision'||lname==='walls/floors'||lname==='walls'||lname==='floors'){
      for(const o of (layer.objects||[])){
        if(o.polygon&&o.polygon.length>=2){
          const pts=o.polygon.map(p=>({x:(o.x+p.x)*sc, y:(o.y+p.y)*sc}));
          keepOutPolys.push(pts);
        }
      }
      continue;
    }
    const isBlocks=lname==='blocks';
    const isDest=lname==='destruct'||lname==='destructible'||lname==='destructibles';
    if(!isBlocks&&!isDest) continue;
    for(const o of (layer.objects||[])){
      const ox=(o.x||0)*sc, oy=(o.y||0)*sc;
      let w=Math.max(tile,(o.width||tw)*sc), h=Math.max(tile,(o.height||th)*sc);
      if(o.polygon&&o.polygon.length){
        let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
        for(const p of o.polygon){
          const px=ox+p.x*sc, py=oy+p.y*sc;
          if(px<minX)minX=px; if(py<minY)minY=py; if(px>maxX)maxX=px; if(py>maxY)maxY=py;
        }
        stampRect(minX,minY,maxX-minX,maxY-minY,MV_GRID_DESTRUCT);
      }else{
        // Tiled tile objects: y is bottom-left
        const y=oy-((o.gid||o.gid===0)?h:0);
        stampRect(ox,y,w,h,MV_GRID_DESTRUCT);
      }
    }
  }

  // Grass + exposed dirt tops are SOLID. Dirt fill inside structures stays AIR so rooms exist.
  if(grassData) stampGid(grassData, MV_GRID_SOLID);
  if(dirtData){
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        if(!hasGid(dirtData,c,r)) continue;
        if(hasGid(dirtData,c,r-1)||hasGid(grassData,c,r-1)) continue;
        stampCell(c,r,MV_GRID_SOLID);
      }
    }
  }
  for(const pts of keepOutPolys){
    for(let i=0;i<pts.length;i++){
      const a=pts[i], b=pts[(i+1)%pts.length];
      stampEdge(a.x,a.y,b.x,b.y,MV_GRID_SOLID);
    }
  }

  MV_GRID={ready:true, cols, rows, tile, tw, th, sc, data:grid};
  let solids=0, dest=0;
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    if(grid[r][c]===MV_GRID_SOLID) solids++;
    else if(grid[r][c]===MV_GRID_DESTRUCT) dest++;
  }
  console.info('MV collision grid:',cols+'x'+rows,'tile',tile,'solid',solids,'destruct',dest);
  return MV_GRID;
}

function gridClear(){ MV_GRID=null; }

function gridSmashCell(c,r){
  if(gridCell(c,r)===MV_GRID_DESTRUCT){ gridSet(c,r,MV_GRID_AIR); return true; }
  return false;
}

function gridSmashWorldRect(x,y,w,h){
  if(!_gridReady()) return false;
  const t=MV_GRID.tile;
  const c0=Math.floor(x/t), c1=Math.floor((x+Math.max(1,w)-1)/t);
  const r0=Math.floor(y/t), r1=Math.floor((y+Math.max(1,h)-1)/t);
  let hit=false;
  for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++) if(gridSmashCell(c,r)) hit=true;
  return hit;
}

function gridSyncDestroyedBwall(bw){
  if(!bw||!_gridReady()) return;
  if(bw.homeCol!=null&&bw.homeRow!=null) gridSmashCell(bw.homeCol, bw.homeRow);
  gridSmashWorldRect(bw.x,bw.y,bw.w||MV_GRID.tile,bw.h||MV_GRID.tile);
}

function gridPlayerBody(pl){
  const h=(typeof hbH==='function')?hbH(pl.crouchAmt||0):(typeof STAND_H!=='undefined'?STAND_H:70);
  const w=(typeof BODY_W!=='undefined'?BODY_W:52);
  const feetOff=(typeof FEET_OFF!=='undefined'?FEET_OFF:88);
  const sw=(typeof SW!=='undefined'?SW:64);
  return {
    x:pl.x+sw/2-w/2,
    y:pl.y+feetOff-h,
    w,h,
    vx:pl.vx||0,
    vy:pl.vy||0,
    onGround:!!pl.og,
    _hitX:false,
    _hitY:false
  };
}

function gridWritePlayer(pl, body){
  const feetOff=(typeof FEET_OFF!=='undefined'?FEET_OFF:88);
  const sw=(typeof SW!=='undefined'?SW:64);
  pl.x=body.x-(sw/2-body.w/2);
  pl.y=body.y+body.h-feetOff;
  if(body._hitX) pl.vx=0;
  if(body._hitY) pl.vy=0;
  pl.og=!!body.onGround;
  if(pl.og) pl._groundHold=Math.max(pl._groundHold||0,8);
}

function gridActorBody(a, feetOff){
  feetOff=feetOff||a.h||16;
  return {x:a.x, y:a.y, w:a.w, h:Math.max(8,feetOff), vx:a.vx||0, vy:a.vy||0, onGround:!!a.og, _hitX:false, _hitY:false};
}

function gridMoveX(body, dx){
  if(!_gridReady()||!dx) return;
  const t=MV_GRID.tile;
  body.x+=dx;
  const [r0,r1]=gridSpan(body.y, body.h, t);
  if(dx>0){
    const col=Math.floor((body.x+body.w-1)/t);
    for(let r=r0;r<=r1;r++) if(gridSolid(col,r)){
      body.x=col*t-body.w; body.vx=0; body._hitX=true; return;
    }
  }else{
    const col=Math.floor(body.x/t);
    for(let r=r0;r<=r1;r++) if(gridSolid(col,r)){
      body.x=(col+1)*t; body.vx=0; body._hitX=true; return;
    }
  }
}

function gridFeetGrounded(body){
  if(!_gridReady()) return false;
  const t=MV_GRID.tile;
  const feet=body.y+body.h;
  const [c0,c1]=gridSpan(body.x, body.w, t);
  const row=Math.floor((feet+0.5)/t);
  for(let c=c0;c<=c1;c++){
    const type=gridCell(c,row);
    if(type!==MV_GRID_SOLID&&type!==MV_GRID_DESTRUCT&&type!==MV_GRID_ONEWAY) continue;
    if(Math.abs(feet-row*t)<=2.5) return true;
  }
  return false;
}

function gridMoveY(body, dy){
  if(!_gridReady()) return;
  if(!dy){
    body.onGround=gridFeetGrounded(body);
    return;
  }
  const t=MV_GRID.tile;
  const prevFeet=body.y+body.h;
  body.y+=dy;
  const [c0,c1]=gridSpan(body.x, body.w, t);
  body.onGround=false;
  if(dy>0){
    const row=Math.floor((body.y+body.h-1)/t);
    for(let c=c0;c<=c1;c++){
      const type=gridCell(c,row);
      const isSolid=(type===MV_GRID_SOLID||type===MV_GRID_DESTRUCT);
      const isOneway=(type===MV_GRID_ONEWAY)&&(prevFeet<=row*t+0.001);
      if(isSolid||isOneway){
        body.y=row*t-body.h; body.vy=0; body.onGround=true; body._hitY=true; return;
      }
    }
  }else{
    const row=Math.floor(body.y/t);
    for(let c=c0;c<=c1;c++) if(gridSolid(c,row)){
      body.y=(row+1)*t; body.vy=0; body._hitY=true; return;
    }
  }
}

function gridOverlaps(body){
  if(!_gridReady()) return false;
  const t=MV_GRID.tile;
  const [c0,c1]=gridSpan(body.x, body.w, t);
  const [r0,r1]=gridSpan(body.y, body.h, t);
  for(let c=c0;c<=c1;c++) for(let r=r0;r<=r1;r++) if(gridSolid(c,r)) return true;
  return false;
}

function gridMoveSwept(body, vx, vy){
  const ax=Math.abs(vx||0), ay=Math.abs(vy||0);
  const steps=Math.max(1, Math.ceil(Math.max(ax,ay)/MV_GRID_STEP));
  const sx=(vx||0)/steps, sy=(vy||0)/steps;
  for(let i=0;i<steps;i++){
    gridMoveX(body, sx);
    gridMoveY(body, sy);
  }
}

function gridDepenetrate(body){
  if(!_gridReady()||!gridOverlaps(body)) return false;
  const max=MV_GRID.rows*MV_GRID.tile;
  for(let i=0;i<max;i++){
    body.y-=1;
    if(!gridOverlaps(body)){
      body.vy=0; body.onGround=true; body._hitY=true;
      return true;
    }
  }
  return gridOverlaps(body);
}

function gridResolvePlayer(pl, vx, vy){
  if(!_gridReady()||!pl) return false;
  const body=gridPlayerBody(pl);
  body.vx=vx||0; body.vy=vy||0;
  gridMoveSwept(body, vx||0, vy||0);
  gridDepenetrate(body);
  gridWritePlayer(pl, body);
  return true;
}

function gridResolveActor(a, vx, vy, feetOff){
  if(!_gridReady()||!a) return false;
  const body=gridActorBody(a, feetOff);
  gridMoveSwept(body, vx||0, vy||0);
  gridDepenetrate(body);
  a.x=body.x; a.y=body.y;
  if(body._hitX) a.vx=0;
  if(body._hitY) a.vy=0;
  a.og=!!body.onGround;
  return true;
}

function gridStandY(cx, feetY, opts){
  if(!_gridReady()) return null;
  opts=opts||{};
  const maxUp=opts.maxUp!=null?opts.maxUp:24;
  const maxDrop=opts.maxDrop!=null?opts.maxDrop:64;
  const t=MV_GRID.tile;
  const pad=opts.pad!=null?opts.pad:((typeof WHEEL_R!=='undefined'?WHEEL_R:20)*0.6);
  const c0=Math.floor((cx-pad)/t), c1=Math.floor((cx+pad)/t);
  const r0=Math.floor((feetY-maxUp)/t)-1;
  const r1=Math.floor((feetY+maxDrop)/t)+1;
  let best=null, bestAbs=1e9;
  for(let r=r0;r<=r1;r++){
    for(let c=c0;c<=c1;c++){
      const type=gridCell(c,r);
      if(type!==MV_GRID_SOLID&&type!==MV_GRID_DESTRUCT&&type!==MV_GRID_ONEWAY) continue;
      const top=r*t;
      if(type===MV_GRID_ONEWAY && feetY>top+4) continue;
      if(top<feetY-maxUp||top>feetY+maxDrop) continue;
      const d=Math.abs(top-feetY);
      if(d<bestAbs){ bestAbs=d; best=top; }
    }
  }
  return best;
}

function gridFloorBelow(cx, markerFeet, maxDrop){
  if(!_gridReady()) return null;
  const t=MV_GRID.tile;
  const col=Math.floor(cx/t);
  const start=Math.floor(markerFeet/t);
  const last=start+Math.ceil((maxDrop||640)/t)+2;
  for(let r=start;r<=last;r++){
    const type=gridCell(col,r);
    if(type===MV_GRID_SOLID||type===MV_GRID_DESTRUCT||type===MV_GRID_ONEWAY){
      const top=r*t;
      if(top>=markerFeet-2 && top<=markerFeet+(maxDrop||640)) return top;
    }
  }
  return null;
}

function gridHeadroom(bodyTop, x, w){
  if(!_gridReady()) return 999;
  const t=MV_GRID.tile;
  const [c0,c1]=gridSpan(x,w,t);
  const start=Math.floor(bodyTop/t);
  for(let r=start;r>=start-8;r--){
    for(let c=c0;c<=c1;c++){
      if(gridSolid(c,r)){
        const ceilB=(r+1)*t;
        const gap=ceilB-bodyTop;
        if(gap>=0) return gap;
      }
    }
  }
  return 999;
}

function gridPlayerOverlapsSolid(pl){
  if(!_gridReady()||!pl) return false;
  return gridOverlaps(gridPlayerBody(pl));
}
