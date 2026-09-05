// ============================================================
//  Mind & Venture — collision_grid.js
//  ONE tile-type grid. ONE resolver. KEEP OUT / merged TR /
//  tile-grass segs / omniblock AABB walls are not authorities.
//
//  Types: 0 AIR, 1 SOLID, 2 ONEWAY, 3 DESTRUCT, 4 SLOPE_L, 5 SLOPE_R
//  KEEP OUT polygons are discarded. Tiles own the grid.
// ============================================================

const MV_GRID_AIR=0, MV_GRID_SOLID=1, MV_GRID_ONEWAY=2, MV_GRID_DESTRUCT=3;
const MV_GRID_SLOPE_L=4, MV_GRID_SLOPE_R=5;
const MV_GRID_STEP=2;
let MV_GRID=null;
const MV_GRID_SLOPE_GIDS={31:'L',44:'R'};

function _gridReady(){ return !!(MV_GRID&&MV_GRID.ready&&MV_GRID.tile>0); }

function _gridGid(raw){
  if(typeof _tmjGid==='function') return _tmjGid(raw);
  return (raw|0)&0x1FFFFFFF;
}

function _gridFlipKind(kind, raw){
  if(!kind) return null;
  const r=raw|0;
  const flipH=!!(r&0x80000000);
  const flipV=!!(r&0x40000000);
  const flipD=!!(r&0x20000000);
  if((flipH!==flipV)!==flipD) return kind==='L'?'R':'L';
  return kind;
}

function _gridKindFromRaw(raw, slopeGids){
  const gid=_gridGid(raw);
  if(!gid||!slopeGids) return null;
  return _gridFlipKind(slopeGids[gid]||null, raw);
}

/** Dirt/omni fill under a slope must not act as a vertical wall. */
function gridSolidBlocksX(c,r,body){
  if(!gridSolid(c,r)) return false;
  if(gridIsSlope(c,r)) return false;
  const t=MV_GRID.tile;
  const wx=body?body.x+body.w*0.5:(c+0.5)*t;
  const feet=body&&body.feetY!=null?body.feetY:null;
  // Dirt/grass are floors. A tile at or below the wheel is not a wall.
  if(feet!=null && r*t>=feet-4) return false;
  // Down-right / down-left stair: same-row dirt is hillside, not a wall.
  if(gridSlopeKind(c-1,r)==='L'||gridSlopeKind(c+1,r)==='R') return false;
  if(gridSlopeKind(c-1,r+1)==='L'||gridSlopeKind(c+1,r+1)==='R') return false;
  if(gridSlopeKind(c,r+1)) return false;
  for(let sr=r+1;sr>=r-3;sr--){
    if(!gridIsSlope(c,sr)&&!gridIsSlope(c-1,sr)&&!gridIsSlope(c+1,sr)) continue;
    const sc=gridIsSlope(c,sr)?c:gridIsSlope(c-1,sr)?c-1:c+1;
    const sy=gridSlopeY(sc,sr,wx);
    if(sy==null) continue;
    if(r*t>=sy-2) return false;
    if(feet!=null&&r*t>=feet-2) return false;
  }
  return true;
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

function gridIsSlope(c,r){
  const t=gridCell(c,r);
  return t===MV_GRID_SLOPE_L||t===MV_GRID_SLOPE_R;
}

function gridSlopeKind(c,r){
  const t=gridCell(c,r);
  if(t===MV_GRID_SLOPE_L) return 'L';
  if(t===MV_GRID_SLOPE_R) return 'R';
  return null;
}

function gridSlopeAt(c,r){
  if(!_gridReady()||!MV_GRID.slope) return null;
  return MV_GRID.slope[r*MV_GRID.cols+c]||null;
}

function gridSlopeY(c,r,wx){
  if(!_gridReady()) return null;
  const t=MV_GRID.tile;
  const kind=gridSlopeKind(c,r);
  if(!kind) return null;
  const s=gridSlopeAt(c,r);
  if(s){
    const dx=s.x2-s.x1;
    if(Math.abs(dx)<0.001) return Math.min(s.y1,s.y2);
    const u=Math.max(0,Math.min(1,(wx-s.x1)/dx));
    return s.y1+(s.y2-s.y1)*u;
  }
  const local=Math.max(0,Math.min(t,(wx-c*t)));
  if(kind==='L') return r*t+local;
  return r*t+(t-local);
}

function _gridReadTilesetSlopes(data){
  const map=Object.assign({}, MV_GRID_SLOPE_GIDS);
  for(const ts of (data&&data.tilesets)||[]){
    const first=ts.firstgid||1;
    for(const tile of ts.tiles||[]){
      let kind=null;
      const type=String(tile.type||tile.class||'').toLowerCase();
      if(type==='slope_l'||type==='slope-l'||type==='slope\\') kind='L';
      if(type==='slope_r'||type==='slope-r'||type==='slope/') kind='R';
      for(const p of tile.properties||[]){
        const n=String(p.name||'').toLowerCase();
        const v=String(p.value==null?'':p.value).toLowerCase();
        if(n==='slope_l'||n==='slopel'){ if(p.value) kind='L'; }
        else if(n==='slope_r'||n==='sloper'){ if(p.value) kind='R'; }
        else if(n==='slope'||n==='collision'||n==='class'){
          if(v==='l'||v==='left'||v==='slope_l'||v==='\\'||v==='downright') kind='L';
          if(v==='r'||v==='right'||v==='slope_r'||v==='/'||v==='upright') kind='R';
        }
      }
      if(kind) map[first+(tile.id|0)]=kind;
    }
  }
  return map;
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

function gridRayHit(x1,y1,x2,y2){
  if(!_gridReady()) return null;
  const tile=MV_GRID.tile;
  const dx=x2-x1, dy=y2-y1;
  const dist=Math.hypot(dx,dy);
  if(dist<0.5) return null;
  const ux=dx/dist, uy=dy/dist;
  const step=Math.max(1, tile/8);
  const startC=Math.floor(x1/tile), startR=Math.floor(y1/tile);
  let seenAir=false;
  for(let s=0;s<=dist;s+=step){
    const x=x1+ux*s, y=y1+uy*s;
    const c=Math.floor(x/tile), r=Math.floor(y/tile);
    const type=gridCell(c,r);
    const blocked=type===MV_GRID_SOLID||type===MV_GRID_DESTRUCT||type===MV_GRID_SLOPE_L||type===MV_GRID_SLOPE_R;
    if(!blocked){ seenAir=true; continue; }
    if(c===startC&&r===startR&&!seenAir) continue;
    const nx=Math.abs(ux)>=Math.abs(uy)?(ux>0?-1:1):0;
    const ny=nx===0?(uy>0?-1:1):0;
    return {tx:x, ty:y, nx, ny};
  }
  return null;
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
  const hasGid=(arr,c,r)=>{
    if(!arr||c<0||r<0||c>=cols||r>=rows) return false;
    return !!_gridGid(arr[r*cols+c]);
  };
  const emptyOfTerrain=(c,r)=>{
    if(c<0||r<0||c>=cols||r>=rows) return false;
    return !hasGid(dirtData,c,r)&&!hasGid(grassData,c,r);
  };
  const stampSlopeCell=(c,r,kind)=>{
    if(c<0||r<0||c>=cols||r>=rows) return;
    if(grid[r][c]===MV_GRID_DESTRUCT) return;
    const type=kind==='R'?MV_GRID_SLOPE_R:MV_GRID_SLOPE_L;
    grid[r][c]=type;
    const y0=r*tile, y1=y0+tile, x0=c*tile, x1=x0+tile;
    slopeSurf[r*cols+c]=kind==='R'
      ? {x1:x0,y1:y1,x2:x1,y2:y0,angle:Math.atan2(-tile,tile)}
      : {x1:x0,y1:y0,x2:x1,y2:y1,angle:Math.atan2(tile,tile)};
  };

  let dirtData=null, grassData=null;
  const slopeSurf={};
  const slopeGids=_gridReadTilesetSlopes(data);

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
    // KEEP OUT is discarded entirely — tiles own collision.
    if(lname==='keep out'||lname==='keepout'||lname==='collision'||lname==='walls/floors'||lname==='walls'||lname==='floors'){
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
        const y=oy-((o.gid||o.gid===0)?h:0);
        stampRect(ox,y,w,h,MV_GRID_DESTRUCT);
      }
    }
  }

  // Only Tiled tiles collide. Empty cells stay air. No carved openings.
  if(grassData){
    for(let i=0;i<grassData.length && i<cols*rows;i++){
      const raw=grassData[i]|0;
      const gid=_gridGid(raw);
      if(!gid) continue;
      const c=i%cols, r=(i/cols)|0;
      let kind=_gridKindFromRaw(raw, slopeGids);
      const downR=hasGid(grassData,c+1,r+1)&&!hasGid(grassData,c+1,r);
      const downL=hasGid(grassData,c-1,r+1)&&!hasGid(grassData,c-1,r);
      if(downR) kind='L';
      else if(downL) kind='R';
      if(kind) stampSlopeCell(c,r,kind);
      else stampCell(c,r,MV_GRID_SOLID);
    }
  }
  if(dirtData){
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        if(!hasGid(dirtData,c,r)) continue;
        if(grid[r][c]===MV_GRID_DESTRUCT||grid[r][c]===MV_GRID_SLOPE_L||grid[r][c]===MV_GRID_SLOPE_R) continue;
        stampCell(c,r,MV_GRID_SOLID);
      }
    }
  }
  // Flat grass is a roof. Dirt under it is the room, not a wall — hill slopes keep their fill.
  if(grassData){
    const roomH=8;
    for(let c=0;c<cols;c++){
      for(let r=0;r<rows;r++){
        if(!hasGid(grassData,c,r)) continue;
        if(grid[r][c]===MV_GRID_SLOPE_L||grid[r][c]===MV_GRID_SLOPE_R) break;
        for(let rr=r+1;rr<=r+roomH&&rr<rows;rr++){
          if(grid[rr][c]===MV_GRID_DESTRUCT) break;
          if(grid[rr][c]===MV_GRID_SLOPE_L||grid[rr][c]===MV_GRID_SLOPE_R) break;
          if(grid[rr][c]===MV_GRID_SOLID&&hasGid(dirtData,c,rr)) grid[rr][c]=MV_GRID_AIR;
        }
        break;
      }
    }
  }

  // Omni blocks (any tile layer) are ceiling/wall — never pass-through.
  for(const layer of layers){
    if(layer.type!=='tilelayer') continue;
    const arr=layer.data||[];
    for(let i=0;i<arr.length && i<cols*rows;i++){
      const gid=_gridGid(arr[i]);
      if(!gid) continue;
      if(typeof _isOmniblockGid!=='function'||!_isOmniblockGid(gid)) continue;
      const c=i%cols, r=(i/cols)|0;
      if(grid[r][c]===MV_GRID_DESTRUCT) continue;
      stampCell(c,r,MV_GRID_SOLID);
    }
  }

  MV_GRID={ready:true, cols, rows, tile, tw, th, sc, data:grid, slope:slopeSurf};
  let solids=0, dest=0, slopes=0;
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    if(grid[r][c]===MV_GRID_SOLID) solids++;
    else if(grid[r][c]===MV_GRID_DESTRUCT) dest++;
    else if(grid[r][c]===MV_GRID_SLOPE_L||grid[r][c]===MV_GRID_SLOPE_R) slopes++;
  }
  console.info('MV collision grid:',cols+'x'+rows,'tile',tile,'solid',solids,'destruct',dest,'slope',slopes);
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
  const feetOff=(typeof FEET_OFF!=='undefined'?FEET_OFF:88);
  const hbx=(typeof HBX!=='undefined'?HBX:6);
  const hbw=(typeof HBW!=='undefined'?HBW:52);
  const standH=(typeof STAND_H!=='undefined'?STAND_H:70);
  const duckH=(typeof DUCK_H!=='undefined'?DUCK_H:40);
  const ca=pl.crouchAmt||0;
  const stand=standH+(duckH-standH)*ca;
  const wr=(typeof WHEEL_R!=='undefined'?WHEEL_R:20);
  const feetY=pl.y+feetOff;
  const headY=pl.y+feetOff-stand-wr;
  return {
    x:pl.x+hbx,
    y:headY,
    w:hbw,
    h:Math.max(8,feetY-headY),
    feetY:feetY,
    headY:headY,
    vx:pl.vx||0,
    vy:pl.vy||0,
    onGround:!!pl.og,
    slopeAng:0,
    _hitX:false,
    _hitY:false
  };
}

function gridWritePlayer(pl, body){
  const feetOff=(typeof FEET_OFF!=='undefined'?FEET_OFF:88);
  const hbx=(typeof HBX!=='undefined'?HBX:6);
  const feetY=body.feetY!=null?body.feetY:body.y+body.h;
  pl.x=body.x-hbx;
  pl.y=feetY-feetOff;
  if(body._hitX) pl.vx=0;
  if(body._hitY) pl.vy=0;
  pl.og=!!body.onGround;
  if(pl.og) pl._groundHold=Math.max(pl._groundHold||0,8);
  if(body.slopeAng){
    pl._onSlope=true;
    pl._slopeAngle=body.slopeAng;
    pl._groundSeg={angle:body.slopeAng};
  }else if(body.onGround){
    pl._onSlope=false;
    pl._slopeAngle=0;
    pl._groundSeg=null;
  }
}

function gridSetFeet(body, y, slopeAng){
  body.feetY=y;
  body.y=y-body.h;
  body.vy=0;
  body.onGround=true;
  body._hitY=true;
  body.slopeAng=slopeAng||0;
}

function gridActorBody(a, feetOff){
  feetOff=feetOff||a.h||16;
  return {x:a.x, y:a.y, w:a.w, h:Math.max(8,feetOff), feetY:a.y+(a.h||feetOff), vx:a.vx||0, vy:a.vy||0, onGround:!!a.og, slopeAng:0, _hitX:false, _hitY:false};
}

function gridMoveX(body, dx){
  if(!_gridReady()||!dx) return;
  const t=MV_GRID.tile;
  body.x+=dx;
  const feet=body.feetY!=null?body.feetY:body.y+body.h;
  const [r0,r1]=gridSpan(body.y, Math.max(1,feet-body.y-0.5), t);
  if(dx>0){
    const col=Math.floor((body.x+body.w-1)/t);
    for(let r=r0;r<=r1;r++) if(gridSolidBlocksX(col,r,body)){
      body.x=col*t-body.w; body.vx=0; body._hitX=true; return;
    }
  }else{
    const col=Math.floor(body.x/t);
    for(let r=r0;r<=r1;r++) if(gridSolidBlocksX(col,r,body)){
      body.x=(col+1)*t; body.vx=0; body._hitX=true; return;
    }
  }
  if(body.onGround) gridFollowSlope(body, true);
}

function gridBestFloor(body, prevFeet){
  const t=MV_GRID.tile;
  const feet=body.feetY!=null?body.feetY:body.y+body.h;
  const wx=body.x+body.w*0.5;
  const c=Math.floor(wx/t);
  let best=null, bestAng=0;
  const row0=Math.floor((feet-0.001)/t);
  for(let row=row0;row<=row0+2;row++){
    const type=gridCell(c,row);
    if(type===MV_GRID_SOLID||type===MV_GRID_DESTRUCT||type===MV_GRID_ONEWAY){
      const top=row*t;
      if(prevFeet<=top+0.001 && feet>=top-0.5){
        if(best==null||top<best){ best=top; bestAng=0; }
      }
    }else if(type===MV_GRID_SLOPE_L||type===MV_GRID_SLOPE_R){
      const sy=gridSlopeY(c,row,wx);
      if(sy==null) continue;
      if(prevFeet<=sy+2 && feet>=sy-1){
        if(best==null||sy<best){
          best=sy;
          const s=gridSlopeAt(c,row);
          bestAng=s?s.angle:0;
        }
      }
    }
  }
  return best==null?null:{y:best, ang:bestAng};
}

/** Seat the wheel on a downhill under its center. Adjacent ledge tiles do not count. */
function gridFollowSlope(body, wasGrounded){
  if(!_gridReady()||!body) return false;
  if((body.vy||0)<-0.35) return false;
  const t=MV_GRID.tile;
  const wx=body.x+body.w*0.5;
  const c=Math.floor(wx/t);
  const feet=body.feetY!=null?body.feetY:body.y+body.h;
  const maxDrop=wasGrounded?t*2.5:t;
  const r0=Math.floor((feet-6)/t);
  const r1=Math.floor((feet+maxDrop)/t);
  let best=null, bestAng=0, bestDrop=1e9;
  for(let r=r0;r<=r1;r++){
    if(!gridIsSlope(c,r)) continue;
    const sy=gridSlopeY(c,r,wx);
    if(sy==null||sy<feet-6||sy>feet+maxDrop) continue;
    const drop=sy-feet;
    if(drop<bestDrop){
      bestDrop=drop;
      best=sy;
      const s=gridSlopeAt(c,r);
      bestAng=s?s.angle:0;
    }
  }
  if(best==null) return false;
  gridSetFeet(body, best, bestAng);
  return true;
}

function gridFeetGrounded(body){
  if(!_gridReady()) return false;
  const t=MV_GRID.tile;
  const feet=body.feetY!=null?body.feetY:body.y+body.h;
  const hit=gridBestFloor(body, feet);
  if(hit && Math.abs(feet-hit.y)<=2.5) return true;
  const wx=body.x+body.w*0.5;
  const c=Math.floor(wx/t);
  const row=Math.floor((feet+0.5)/t);
  if(gridSolid(c,row) && Math.abs(feet-row*t)<=2.5) return true;
  if(gridIsSlope(c,row)){
    const sy=gridSlopeY(c,row,wx);
    if(sy!=null && Math.abs(feet-sy)<=2.5) return true;
  }
  return false;
}

function gridMoveY(body, dy){
  if(!_gridReady()) return;
  if(!dy){
    body.onGround=gridFeetGrounded(body);
    if(body.onGround && body.feetY==null) body.feetY=body.y+body.h;
    return;
  }
  const t=MV_GRID.tile;
  const prevFeet=body.feetY!=null?body.feetY:body.y+body.h;
  body.y+=dy;
  body.feetY=prevFeet+dy;
  body.onGround=false;
  body.slopeAng=0;
  if(dy>0){
    const hit=gridBestFloor(body, prevFeet);
    if(hit){ gridSetFeet(body, hit.y, hit.ang); return; }
    const row=Math.floor((body.feetY-0.001)/t);
    const [c0,c1]=gridSpan(body.x, body.w, t);
    for(let c=c0;c<=c1;c++){
      if(gridSolid(c,row)){ gridSetFeet(body, row*t, 0); return; }
    }
  }else{
    const row=Math.floor(body.y/t);
    const [c0,c1]=gridSpan(body.x, body.w, t);
    for(let c=c0;c<=c1;c++) if(gridSolid(c,row)){
      const ceil=(row+1)*t;
      body.y=ceil;
      body.feetY=body.y+body.h;
      body.vy=0; body._hitY=true; return;
    }
  }
}

function gridOverlaps(body){
  if(!_gridReady()) return false;
  const t=MV_GRID.tile;
  const feet=body.feetY!=null?body.feetY:body.y+body.h;
  const [c0,c1]=gridSpan(body.x, body.w, t);
  const [r0,r1]=gridSpan(body.y, Math.max(1,feet-body.y-0.5), t);
  for(let c=c0;c<=c1;c++) for(let r=r0;r<=r1;r++) if(gridSolidBlocksX(c,r,body)) return true;
  for(let c=c0;c<=c1;c++){
    const row=Math.floor((feet-0.001)/t);
    if(gridIsSlope(c,row)){
      const sy=gridSlopeY(c,row,body.x+body.w*0.5);
      if(sy!=null && feet>sy+1.5) return true;
    }
  }
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
    if(body.feetY!=null) body.feetY-=1;
    if(!gridOverlaps(body)){
      body.vy=0; body.onGround=true; body._hitY=true;
      return true;
    }
  }
  return gridOverlaps(body);
}

function gridResolvePlayer(pl, vx, vy){
  if(!_gridReady()||!pl) return false;
  const wasGrounded=!!pl.og;
  const body=gridPlayerBody(pl);
  body.vx=vx||0; body.vy=vy||0;
  gridMoveSwept(body, vx||0, vy||0);
  gridDepenetrate(body);
  if((vy||0)>=-0.2) gridFollowSlope(body, wasGrounded||body.onGround);
  if(body.onGround){
    const hit=gridBestFloor(body, body.feetY);
    if(hit && Math.abs((body.feetY)-hit.y)<=MV_GRID.tile){
      gridSetFeet(body, hit.y, hit.ang);
    }
  }
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

function gridStandHit(cx, feetY, opts){
  if(!_gridReady()) return null;
  opts=opts||{};
  const maxUp=opts.maxUp!=null?opts.maxUp:24;
  const maxDrop=opts.maxDrop!=null?opts.maxDrop:64;
  const t=MV_GRID.tile;
  const col=Math.floor(cx/t);
  const r0=Math.floor((feetY-maxUp)/t)-1;
  const r1=Math.floor((feetY+maxDrop)/t)+1;
  let best=null, bestAbs=1e9;
  const consider=(y,ang,kind)=>{
    if(y==null||y<feetY-maxUp||y>feetY+maxDrop) return;
    const d=Math.abs(y-feetY);
    const adj=kind==='slope'?d-4:d;
    if(adj<bestAbs){ bestAbs=adj; best={y, ang:ang||0, kind}; }
  };
  for(let r=r0;r<=r1;r++){
    const type=gridCell(col,r);
    if(type===MV_GRID_SLOPE_L||type===MV_GRID_SLOPE_R){
      const sy=gridSlopeY(col,r,cx);
      const s=gridSlopeAt(col,r);
      consider(sy, s?s.angle:0, 'slope');
    }else if(type===MV_GRID_SOLID||type===MV_GRID_DESTRUCT||type===MV_GRID_ONEWAY){
      if(type===MV_GRID_ONEWAY && feetY>r*t+4) continue;
      consider(r*t, 0, type===MV_GRID_ONEWAY?'oneway':'solid');
    }
  }
  return best;
}

function gridStandY(cx, feetY, opts){
  const hit=gridStandHit(cx, feetY, opts);
  return hit?hit.y:null;
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
    }else if(type===MV_GRID_SLOPE_L||type===MV_GRID_SLOPE_R){
      const sy=gridSlopeY(col,r,cx);
      if(sy!=null && sy>=markerFeet-2 && sy<=markerFeet+(maxDrop||640)) return sy;
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
