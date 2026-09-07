// ============================================================
//  Mind & Venture — collision_grid.js
//  ONE tile-type grid. ONE resolver.
//
//  Types: 0 AIR, 1 SOLID, 2 ONEWAY, 3 DESTRUCT, 4 SLOPE_L, 5 SLOPE_R
//
//  The "KEEP OUT!" object layer is the authored collision: Tiled holds the
//  terrain traced as polygons, and the grid is rasterized straight from it.
//  Tile layers only supply destructibles. Maps with no KEEP OUT outline
//  (the collision labs) fall back to inferring faces from tiles.
// ============================================================

const MV_GRID_AIR=0, MV_GRID_SOLID=1, MV_GRID_ONEWAY=2, MV_GRID_DESTRUCT=3;
const MV_GRID_SLOPE_L=4, MV_GRID_SLOPE_R=5;
const MV_GRID_STEP=2;
/** A wheel rolls a one-tile kerb (House 2 roof lips). Two tiles is a wall. */
const MV_GRID_STEP_UP=34;
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

/**
 * A wall is a wall. The one exception is rock sitting directly beneath a ramp
 * in the same column: that is the ramp's underside, and riding the ramp means
 * passing over it. Everything else stops horizontal motion, and gridMoveX
 * steps the wheel over low lips.
 */
function gridSolidBlocksX(c,r,contactX){
  if(!gridSolid(c,r)||gridIsSlope(c,r)) return false;
  const t=MV_GRID.tile;
  const x=contactX!=null?contactX:(c+0.5)*t;
  for(let sr=r-1;sr>=r-2;sr--){
    if(!gridIsSlope(c,sr)) continue;
    const sy=gridSlopeY(c,sr,x);
    if(sy!=null&&sy<=r*t+0.5) return false;
  }
  // Rounded slope shoulder: do not jam the wheel into the crest wall.
  for(const dc of [-1,1]){
    const kind=gridSlopeKind(c+dc,r)||gridSlopeKind(c+dc,r+1)||gridSlopeKind(c+dc,r-1);
    if(!kind) continue;
    if(kind==='L'&&dc===1&&Math.abs(x-(c+1)*t)<22) return false;
    if(kind==='R'&&dc===-1&&Math.abs(x-c*t)<22) return false;
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
  let y;
  if(s){
    const dx=s.x2-s.x1;
    if(Math.abs(dx)<0.001) y=Math.min(s.y1,s.y2);
    else{
      const u=Math.max(0,Math.min(1,(wx-s.x1)/dx));
      y=s.y1+(s.y2-s.y1)*u;
    }
  }else{
    const local=Math.max(0,Math.min(t,(wx-c*t)));
    y=kind==='L'?r*t+local:r*t+(t-local);
  }
  const fillet=Math.min(t*0.42, 14);
  if(kind==='L'){
    const d=wx-c*t;
    if(d>=0&&d<fillet){
      const bump=fillet-Math.sqrt(Math.max(0,fillet*fillet-(fillet-d)*(fillet-d)));
      y+=bump*0.55;
    }
  }else{
    const d=(c+1)*t-wx;
    if(d>=0&&d<fillet){
      const bump=fillet-Math.sqrt(Math.max(0,fillet*fillet-(fillet-d)*(fillet-d)));
      y+=bump*0.55;
    }
  }
  return y;
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
  if(!MV_GRID.slope) return;
  const i=r*MV_GRID.cols+c, t=MV_GRID.tile, x0=c*t, y0=r*t, x1=x0+t, y1=y0+t;
  if(type===MV_GRID_SLOPE_L){
    MV_GRID.slope[i]={x1:x0,y1:y0,x2:x1,y2:y1,angle:Math.atan2(t,t)};
  }else if(type===MV_GRID_SLOPE_R){
    MV_GRID.slope[i]={x1:x0,y1:y1,x2:x1,y2:y0,angle:Math.atan2(-t,t)};
  }else{
    delete MV_GRID.slope[i];
  }
}

function gridWorldSolid(wx,wy){
  if(!_gridReady()) return false;
  const t=MV_GRID.tile;
  return gridSolid(Math.floor(wx/t), Math.floor(wy/t));
}

function gridRayHit(x1,y1,x2,y2,opts){
  if(!_gridReady()) return null;
  opts=opts||{};
  const tile=MV_GRID.tile;
  const dx=x2-x1, dy=y2-y1;
  const dist=Math.hypot(dx,dy);
  if(dist<0.5) return null;
  const ux=dx/dist, uy=dy/dist;
  let c=Math.floor(x1/tile), r=Math.floor(y1/tile);
  const startC=c, startR=r;
  const startType=gridCell(startC,startR);
  const startBlocked=startType===MV_GRID_SOLID||startType===MV_GRID_DESTRUCT
    ||startType===MV_GRID_SLOPE_L||startType===MV_GRID_SLOPE_R;
  const stepC=ux<0?-1:ux>0?1:0;
  const stepR=uy<0?-1:uy>0?1:0;
  const inf=1e12;
  const invX=ux!==0?1/ux:inf;
  const invY=uy!==0?1/uy:inf;
  let tMaxX=ux>0?((c+1)*tile-x1)*invX:ux<0?(c*tile-x1)*invX:inf;
  let tMaxY=uy>0?((r+1)*tile-y1)*invY:uy<0?(r*tile-y1)*invY:inf;
  const tDeltaX=stepC!==0?Math.abs(tile*invX):inf;
  const tDeltaY=stepR!==0?Math.abs(tile*invY):inf;
  const maxSteps=MV_GRID.cols+MV_GRID.rows+4;
  const latch=(c,r,tEnter,nx,ny)=>{
    const type=gridCell(c,r);
    const t=Math.max(0,tEnter);
    const tx=x1+ux*t, ty=y1+uy*t;
    if(type===MV_GRID_SOLID||type===MV_GRID_DESTRUCT) return {tx,ty,nx,ny};
    if(type===MV_GRID_SLOPE_L||type===MV_GRID_SLOPE_R){
      const sy=gridSlopeY(c,r,tx);
      if(sy==null) return null;
      const s=gridSlopeAt(c,r);
      const ang=s&&s.angle!=null?s.angle:(type===MV_GRID_SLOPE_L?Math.PI/4:-Math.PI/4);
      return {tx, ty:sy, nx:Math.sin(ang), ny:-Math.cos(ang)};
    }
    return null;
  };
  // Started inside a solid: grab the NEAR face (the side we are looking out of),
  // so an upward shot latches a ceiling underside instead of the slab's top.
  if(startBlocked&&!opts.skipStart){
    const nx=ux>0?-1:ux<0?1:0;
    const ny=uy>0?-1:uy<0?1:0;
    const tNear=0;
    const hit=latch(startC,startR,tNear,nx,ny);
    if(hit){
      if(uy<0){ hit.ty=(startR+1)*tile; hit.ny=1; hit.nx=0; }
      else if(uy>0){ hit.ty=startR*tile; hit.ny=-1; hit.nx=0; }
      return hit;
    }
  }
  for(let i=0;i<maxSteps;i++){
    let nx=0, ny=0, tEnter;
    if(tMaxX<tMaxY){
      tEnter=tMaxX;
      nx=stepC>0?-1:1;
      c+=stepC;
      tMaxX+=tDeltaX;
    }else{
      tEnter=tMaxY;
      ny=stepR>0?-1:1;
      r+=stepR;
      tMaxY+=tDeltaY;
    }
    if(tEnter>dist+0.01) break;
    if(c===startC&&r===startR) continue;
    const hit=latch(c,r,tEnter,nx,ny);
    if(hit){
      const type=gridCell(c,r);
      if((type===MV_GRID_SOLID||type===MV_GRID_DESTRUCT)&&uy<0&&Math.abs(uy)>=Math.abs(ux)){
        hit.ty=(r+1)*tile; hit.ny=1; hit.nx=0;
      }
      return hit;
    }
  }
  return null;
}

function gridSpan(px, pw, tile){
  const c0=Math.floor(px/tile);
  const c1=Math.floor((px+pw-1)/tile);
  return [c0,c1];
}

/**
 * Read the authored terrain outlines off the "KEEP OUT!" object layer.
 * Tiled stores the rock mass and its complement (the open air) as two traced
 * rings; the winding tells them apart. Smaller rings sit inside bigger ones,
 * so sorting by area lets an island read as solid inside open sky.
 */
function _gridKeepOutRegions(data, sc){
  const regions=[];
  for(const layer of (data&&data.layers)||[]){
    if(layer.type!=='objectgroup') continue;
    if(!/keep\s*out/i.test(String(layer.name||''))) continue;
    for(const o of layer.objects||[]){
      if(!o.polygon||o.polygon.length<3) continue;
      const pts=o.polygon.map(p=>({x:((o.x||0)+p.x)*sc, y:((o.y||0)+p.y)*sc}));
      let a=0;
      for(let i=0;i<pts.length;i++){
        const q=pts[i], n=pts[(i+1)%pts.length];
        a+=q.x*n.y-n.x*q.y;
      }
      regions.push({pts, area:a/2, solid:a<0});
    }
  }
  regions.sort((u,v)=>Math.abs(u.area)-Math.abs(v.area));
  return regions;
}

function _gridPointInPoly(pts,x,y){
  let hit=false;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){
    const a=pts[i], b=pts[j];
    if((a.y>y)!==(b.y>y) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) hit=!hit;
  }
  return hit;
}

function _gridRasterizeRegions(regions, grid, cols, rows, tile){
  for(let r=0;r<rows;r++){
    const y=(r+0.5)*tile;
    for(let c=0;c<cols;c++){
      const x=(c+0.5)*tile;
      let solid=false;
      for(const rg of regions){
        if(!_gridPointInPoly(rg.pts,x,y)) continue;
        solid=rg.solid;
        break;
      }
      grid[r][c]=solid?MV_GRID_SOLID:MV_GRID_AIR;
    }
  }
}

/**
 * Every diagonal edge of a solid outline becomes a real slope surface, clipped
 * per cell. This is why the hill reads as one clean ramp instead of a stair of
 * guessed tile GIDs — the geometry comes from the line the level was drawn with.
 */
function _gridStampRegionSlopes(regions, grid, slopeSurf, cols, rows, tile){
  for(const rg of regions){
    if(!rg.solid) continue;
    const pts=rg.pts;
    for(let i=0;i<pts.length;i++){
      const a=pts[i], b=pts[(i+1)%pts.length];
      const dx=b.x-a.x, dy=b.y-a.y;
      if(Math.abs(dx)<0.5||Math.abs(dy)<0.5) continue;
      const yLo=Math.min(a.y,b.y), yHi=Math.max(a.y,b.y);
      const xAt=y=>a.x+dx*((y-a.y)/dy);
      const r0=Math.floor(yLo/tile), r1=Math.floor((yHi-0.001)/tile);
      for(let r=r0;r<=r1;r++){
        if(r<0||r>=rows) continue;
        const yTop=Math.max(yLo, r*tile), yBot=Math.min(yHi, (r+1)*tile);
        if(yBot-yTop<0.001) continue;
        let p1={x:xAt(yTop),y:yTop}, p2={x:xAt(yBot),y:yBot};
        if(p1.x>p2.x){ const s=p1; p1=p2; p2=s; }
        const c=Math.floor((p1.x+p2.x)*0.5/tile);
        if(c<0||c>=cols) continue;
        // A diagonal with rock overhead is a ceiling, not something to ride.
        if(r>0&&grid[r-1][c]===MV_GRID_SOLID) continue;
        grid[r][c]=p2.y>p1.y?MV_GRID_SLOPE_L:MV_GRID_SLOPE_R;
        slopeSurf[r*cols+c]={x1:p1.x,y1:p1.y,x2:p2.x,y2:p2.y,angle:Math.atan2(p2.y-p1.y,p2.x-p1.x)};
      }
    }
  }
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

  let destructData=null;
  const destructRects=[];
  for(const layer of layers){
    const lname=_gridLayerName(layer);
    if(layer.type==='tilelayer'){
      const d=layer.data||[];
      const isDirt=lname==='dirt stuf'||lname==='dirt'||lname==='background';
      const isGrass=lname==='grass stuff'||lname==='grass'||lname==='canvas';
      const isDest=lname==='destruct'||lname==='destructible'||lname==='destructibles';
      if(isDirt) dirtData=d;
      if(isGrass) grassData=d;
      if(isDest) destructData=d;
      continue;
    }
    if(layer.type!=='objectgroup') continue;
    const isBlocks=lname==='blocks';
    const isDest=lname==='destruct'||lname==='destructible'||lname==='destructibles';
    if(!isBlocks&&!isDest) continue;
    for(const o of (layer.objects||[])){
      const ox=(o.x||0)*sc, oy=(o.y||0)*sc;
      const w=Math.max(tile,(o.width||tw)*sc), h=Math.max(tile,(o.height||th)*sc);
      if(o.polygon&&o.polygon.length){
        let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
        for(const p of o.polygon){
          const px=ox+p.x*sc, py=oy+p.y*sc;
          if(px<minX)minX=px; if(py<minY)minY=py; if(px>maxX)maxX=px; if(py>maxY)maxY=py;
        }
        destructRects.push([minX,minY,maxX-minX,maxY-minY]);
      }else{
        destructRects.push([ox, oy-((o.gid||o.gid===0)?h:0), w, h]);
      }
    }
  }

  const regions=_gridKeepOutRegions(data, sc);
  if(regions.length){
    _gridRasterizeRegions(regions, grid, cols, rows, tile);
    _gridStampRegionSlopes(regions, grid, slopeSurf, cols, rows, tile);
  }else{
    // No authored outline (collision labs): infer faces from the tile art.
    if(grassData){
      for(let i=0;i<grassData.length && i<cols*rows;i++){
        const raw=grassData[i]|0;
        if(!_gridGid(raw)) continue;
        const c=i%cols, r=(i/cols)|0;
        let kind=_gridKindFromRaw(raw, slopeGids);
        if(hasGid(grassData,c+1,r+1)&&!hasGid(grassData,c+1,r)) kind='L';
        else if(hasGid(grassData,c-1,r+1)&&!hasGid(grassData,c-1,r)) kind='R';
        if(kind) stampSlopeCell(c,r,kind);
        else stampCell(c,r,MV_GRID_SOLID);
      }
    }
    if(dirtData){
      for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
        if(!hasGid(dirtData,c,r)) continue;
        if(grid[r][c]!==MV_GRID_AIR) continue;
        stampCell(c,r,MV_GRID_SOLID);
      }
    }
  }

  // Destructibles go on last so a smashed cell always falls back to open air.
  stampGid(destructData, MV_GRID_DESTRUCT);
  for(const [x,y,w,h] of destructRects) stampRect(x,y,w,h,MV_GRID_DESTRUCT);

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
  if(!_gridReady()) return false;
  if(c<0||r<0||c>=MV_GRID.cols||r>=MV_GRID.rows) return false;
  if(gridCell(c,r)===MV_GRID_AIR) return false;
  if(gridIsSlope(c,r)) return false;
  gridSet(c,r,MV_GRID_AIR);
  return true;
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

function _gridBwallHomeCells(bw){
  const cells=[];
  if(!bw||!_gridReady()) return cells;
  const t=MV_GRID.tile;
  const seen=Object.create(null);
  const add=(c,r)=>{
    if(c<0||r<0||c>=MV_GRID.cols||r>=MV_GRID.rows) return;
    const k=c+','+r;
    if(seen[k]) return;
    seen[k]=1; cells.push([c,r]);
  };
  if(bw.homeCol!=null&&bw.homeRow!=null) add(bw.homeCol,bw.homeRow);
  const x=bw.homeX!=null?bw.homeX:null, y=bw.homeY!=null?bw.homeY:null;
  if(x!=null&&y!=null){
    const w=bw.w||t, h=bw.h||t;
    const c0=Math.floor(x/t), c1=Math.floor((x+Math.max(1,w)-1)/t);
    const r0=Math.floor(y/t), r1=Math.floor((y+Math.max(1,h)-1)/t);
    for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++) add(c,r);
  }
  return cells;
}

/** A block's home is a hole in the terrain. The block fills it; nothing else does. */
function gridOpenBwallHole(bw){
  for(const [c,r] of _gridBwallHomeCells(bw)) gridSmashCell(c,r);
}

function gridFillBwallHole(bw){
  if(!bw||bw.hp<=0) return;
  for(const [c,r] of _gridBwallHomeCells(bw)){
    if(gridIsSlope(c,r)) continue;
    gridSet(c,r,MV_GRID_DESTRUCT);
  }
}

function gridSyncBwallOccupancy(bw){
  if(!bw||!_gridReady()) return;
  const moved=typeof _bwallMovedFromHome==='function'&&_bwallMovedFromHome(bw);
  if(bw.hp<=0||moved) gridOpenBwallHole(bw);
  else gridFillBwallHole(bw);
}

function gridSyncDestroyedBwall(bw){
  if(!bw) return;
  bw.hp=0;
  gridOpenBwallHole(bw);
}

function gridStampLiveBwalls(){
  if(!_gridReady()||typeof BWALLS==='undefined') return;
  for(const bw of BWALLS) gridSyncBwallOccupancy(bw);
}

function gridPlayerBody(pl){
  const feetOff=(typeof FEET_OFF!=='undefined'?FEET_OFF:88);
  const standH=(typeof STAND_H!=='undefined'?STAND_H:70);
  const duckH=(typeof DUCK_H!=='undefined'?DUCK_H:40);
  const ca=pl.crouchAmt||0;
  const stand=standH+(duckH-standH)*ca;
  const wr=(typeof WHEEL_R!=='undefined'?WHEEL_R:20);
  const sw=(typeof SW!=='undefined'?SW:64);
  const feetY=pl.y+feetOff;
  const headY=pl.y+feetOff-stand-wr;
  const cx=pl.x+sw*0.5;
  return {
    x:cx-wr,
    y:headY,
    w:wr*2,
    h:Math.max(8,feetY-headY),
    feetY:feetY,
    headY:headY,
    wheelCx:cx,
    wheelCy:feetY-wr,
    wheelR:wr,
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
  const sw=(typeof SW!=='undefined'?SW:64);
  const feetY=body.feetY!=null?body.feetY:body.y+body.h;
  pl.x=(body.x+body.w*0.5)-sw*0.5;
  pl.y=feetY-feetOff;
  if(body._hitX) pl.vx=0;
  if(body._hitY) pl.vy=0;
  else if(body._crestLaunch) pl.vy=body.vy;
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

/** Highest surface in one column that sits within `maxUp` above the feet. */
function gridColumnSurface(col, contactX, feetY, maxUp){
  if(!_gridReady()) return null;
  const t=MV_GRID.tile;
  const r0=Math.floor((feetY-maxUp)/t), r1=Math.floor(feetY/t);
  let best=null, ang=0;
  for(let r=r0;r<=r1;r++){
    let y=null, a=0;
    if(gridIsSlope(col,r)){
      y=gridSlopeY(col,r,contactX);
      const s=gridSlopeAt(col,r);
      a=s?s.angle:0;
    }else if(gridSolid(col,r)){
      y=r*t;
    }else continue;
    if(y==null||y>feetY+0.5||y<feetY-maxUp) continue;
    if(best==null||y<best){ best=y; ang=a; }
  }
  return best==null?null:{y:best, ang};
}

function _gridBlockedAt(body, col, contactX){
  const t=MV_GRID.tile;
  const feet=body.feetY!=null?body.feetY:body.y+body.h;
  const [r0,r1]=gridSpan(body.y, Math.max(1,feet-body.y-0.5), t);
  for(let r=r0;r<=r1;r++) if(gridSolidBlocksX(col,r,contactX)) return true;
  return false;
}

/** Roll the wheel over a low lip (slope shoulders, kerbs) rather than stopping dead. */
function _gridStepUp(body, col, contactX){
  if(!body.onGround) return false;
  const feet=body.feetY!=null?body.feetY:body.y+body.h;
  const surf=gridColumnSurface(col, contactX, feet, MV_GRID_STEP_UP);
  if(!surf) return false;
  const rise=feet-surf.y;
  if(rise<=0.01||rise>MV_GRID_STEP_UP) return false;
  const prevY=body.y, prevFeet=body.feetY, prevAng=body.slopeAng;
  body.feetY=surf.y;
  body.y=surf.y-body.h;
  body.slopeAng=surf.ang||0;
  if(_gridBlockedAt(body, col, contactX)){
    body.y=prevY; body.feetY=prevFeet; body.slopeAng=prevAng;
    return false;
  }
  body.onGround=true;
  return true;
}

function gridMoveX(body, dx){
  if(!_gridReady()||!dx) return;
  const t=MV_GRID.tile;
  body.x+=dx;
  const col=dx>0?Math.floor((body.x+body.w-1)/t):Math.floor(body.x/t);
  const contactX=dx>0?body.x+body.w-1:body.x;
  if(_gridBlockedAt(body, col, contactX)){
    if(_gridStepUp(body, col, contactX)){
      if(body.onGround) gridFollowSlope(body, true);
      return;
    }
    const downhill=Math.sign(Math.sin(body.slopeAng||0));
    const riding=Math.abs(body.slopeAng||0)>0.06&&Math.sign(dx)===downhill;
    const feet=body.feetY!=null?body.feetY:body.y+body.h;
    const notch=riding&&gridColumnSurface(col, contactX, feet+t, t*2);
    if(notch&&Math.abs(notch.y-feet)<MV_GRID_STEP_UP+10){
      gridSetFeet(body, notch.y, notch.ang||body.slopeAng);
      if(body.onGround) gridFollowSlope(body, true);
      return;
    }
    body.x=dx>0?col*t-body.w:(col+1)*t;
    body.vx=0; body._hitX=true;
    return;
  }
  if(body.onGround) gridFollowSlope(body, true);
}

function gridBestFloor(body, prevFeet){
  const t=MV_GRID.tile;
  const feet=body.feetY!=null?body.feetY:body.y+body.h;
  const wx=body.x+body.w*0.5;
  const wr=body.wheelR||20;
  const samples=[wx-wr+3, wx, wx+wr-3];
  let best=null, bestAng=0;
  const row0=Math.floor((Math.min(prevFeet,feet)-0.001)/t);
  for(const sx of samples){
    const c=Math.floor(sx/t);
    for(let row=row0-2;row<=row0+3;row++){
      const type=gridCell(c,row);
      if(type===MV_GRID_SOLID||type===MV_GRID_DESTRUCT||type===MV_GRID_ONEWAY){
        const top=row*t;
        if(prevFeet<=top+0.001 && feet>=top-0.5){
          if(best==null||top<best){ best=top; bestAng=0; }
        }
      }else if(type===MV_GRID_SLOPE_L||type===MV_GRID_SLOPE_R){
        const sy=gridSlopeY(c,row,sx);
        if(sy==null) continue;
        // Crossed the hypotenuse this step, or still within one tile of it.
        if(prevFeet<=sy+t && feet>=sy-4 && feet<=sy+t){
          if(best==null||sy<best){
            best=sy;
            const s=gridSlopeAt(c,row);
            bestAng=s?s.angle:0;
          }
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
  const wr=body.wheelR||20;
  const cols=[Math.floor((wx-wr*0.55)/t), Math.floor(wx/t), Math.floor((wx+wr*0.55)/t)];
  const feet=body.feetY!=null?body.feetY:body.y+body.h;
  const maxDrop=wasGrounded?t*2.5:t;
  const r0=Math.floor((feet-6)/t);
  const r1=Math.floor((feet+maxDrop)/t);
  let best=null, bestAng=0, bestDrop=1e9;
  for(const c of cols){
    const sx=Math.max(c*t+1, Math.min((c+1)*t-1, wx));
    for(let r=r0;r<=r1;r++){
      if(!gridIsSlope(c,r)) continue;
      const sy=gridSlopeY(c,r,sx);
      if(sy==null||sy<feet-6||sy>feet+maxDrop) continue;
      const drop=sy-feet;
      if(drop<bestDrop){
        bestDrop=drop;
        best=sy;
        const s=gridSlopeAt(c,r);
        bestAng=s?s.angle:0;
      }
    }
  }
  if(best==null) return false;
  // Crest trap: do not drop into rock that is not the ramp's own fill.
  // Downhill onto the next 45° tile often overlaps that fill — still seat.
  if(best>feet+0.5&&_gridFeetWouldClip(body,best)&&!wasGrounded) return false;
  gridSetFeet(body, best, bestAng);
  return true;
}

/** Solid sitting under / behind a nearby ramp — riding means passing over it. */
function _gridIsRampFill(c,r,wx,feetY){
  if(!gridSolid(c,r)||gridIsSlope(c,r)) return false;
  const t=MV_GRID.tile;
  for(let dc=-1;dc<=1;dc++){
    for(let sr=r-3;sr<=r+1;sr++){
      if(!gridIsSlope(c+dc,sr)) continue;
      const sx=Math.max((c+dc)*t+1, Math.min((c+dc+1)*t-1, wx));
      const sy=gridSlopeY(c+dc,sr,sx);
      if(sy==null) continue;
      if(feetY<=sy+8 && r*t>=sy-t) return true;
    }
  }
  return false;
}

function gridNearSlope(cx, feetY){
  if(!_gridReady()) return false;
  const t=MV_GRID.tile;
  const c0=Math.floor(cx/t), r0=Math.floor(feetY/t);
  for(let dc=-1;dc<=1;dc++) for(let dr=-2;dr<=2;dr++){
    if(gridIsSlope(c0+dc, r0+dr)) return true;
  }
  return false;
}

function _gridFeetWouldClip(body, feetY){
  const t=MV_GRID.tile;
  const top=feetY-body.h;
  const [c0,c1]=gridSpan(body.x, body.w, t);
  const [r0,r1]=gridSpan(top, Math.max(1,body.h-0.5), t);
  const cx=body.x+body.w*0.5;
  for(let c=c0;c<=c1;c++) for(let r=r0;r<=r1;r++){
    if(_gridIsRampFill(c,r,cx,feetY)) continue;
    if(gridSolidBlocksX(c,r,cx)) return true;
  }
  return false;
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
    const wedge=gridWheelWedge(body);
    if(wedge){
      body._wedged=true;
      body.onGround=true;
      body.vy=0; body._hitY=true;
      body.feetY=prevFeet;
      body.y=prevFeet-body.h;
      return;
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

function _gridCircleHitsCell(cx,cy,r,c,row,t){
  const nx=Math.max(c*t, Math.min(cx,(c+1)*t));
  const ny=Math.max(row*t, Math.min(cy,(row+1)*t));
  const dx=cx-nx, dy=cy-ny;
  return dx*dx+dy*dy<=r*r;
}

function gridOverlaps(body){
  if(!_gridReady()) return false;
  const t=MV_GRID.tile;
  const feet=body.feetY!=null?body.feetY:body.y+body.h;
  const wr=body.wheelR||((typeof WHEEL_R!=='undefined'?WHEEL_R:20));
  const wcx=body.wheelCx!=null?body.wheelCx:body.x+body.w*0.5;
  const wcy=body.wheelCy!=null?body.wheelCy:feet-wr;
  const [c0,c1]=gridSpan(body.x, body.w, t);
  const [r0,r1]=gridSpan(body.y, Math.max(1,feet-body.y-0.5), t);
  const wheelRow=Math.floor(wcy/t);
  for(let c=c0;c<=c1;c++) for(let r=r0;r<=r1;r++){
    if(!gridSolidBlocksX(c,r,wcx)) continue;
    // Wheel rows: circle vs tile so leftover floor beside a hole does not lift us.
    if(r>=wheelRow-1){
      // Allow a one-tile squeeze (wheel 40, gap 32) without counting as embed.
      if(_gridCircleHitsCell(wcx,wcy,wr-5,c,r,t)) return true;
      continue;
    }
    return true;
  }
  for(let c=c0;c<=c1;c++){
    const row=Math.floor((feet-0.001)/t);
    if(gridIsSlope(c,row)){
      const sy=gridSlopeY(c,row,wcx);
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

function gridDepenetrate(body, opts){
  if(!_gridReady()||!gridOverlaps(body)) return false;
  opts=opts||{};
  const swing=!!opts.swing;
  const wedge=gridWheelWedge(body);
  if(wedge){
    body._wedged=true;
    body.onGround=true;
  }else{
    for(const dir of [-1,1]){
      const ox=body.x;
      for(let i=0;i<20;i++){
        body.x+=dir;
        if(!gridOverlaps(body)){ body._hitX=true; return true; }
      }
      body.x=ox;
    }
  }
  if(swing) return gridOverlaps(body);
  // Never lift more than a kerb — a big upward crawl is the house-roof teleport.
  const ox=body.x, oy=body.y, of=body.feetY;
  for(let i=0;i<12;i++){
    body.y-=1;
    if(body.feetY!=null) body.feetY-=1;
    if(!gridOverlaps(body)){
      body.vy=0; body.onGround=true; body._hitY=true;
      return true;
    }
  }
  body.y=oy; body.feetY=of; body.x=ox;
  return gridOverlaps(body);
}

function gridCrestRelease(body){
  if(!body.onGround||Math.abs(body.slopeAng||0)<0.08) return false;
  const downhill=Math.sign(Math.sin(body.slopeAng||0));
  const dir=Math.sign(body.vx||0);
  // Rolling downhill: stay on the ramp. Only leave when climbing onto a flat.
  if(!dir||dir===downhill) return false;
  if(Math.abs(body.vx||0)<2.0) return false;
  const t=MV_GRID.tile;
  const wx=body.x+body.w*0.5;
  const feet=body.feetY!=null?body.feetY:body.y+body.h;
  const c=Math.floor(wx/t);
  const nc=c+dir;
  const nr=Math.floor((feet-2)/t);
  if(gridIsSlope(nc,nr)||gridIsSlope(nc,nr-1)||gridIsSlope(nc,nr+1)) return false;
  const surf=gridColumnSurface(nc, nc*t+t*0.5, feet+t, t*2);
  if(surf&&Math.abs(surf.y-feet)<t*1.25){
    gridSetFeet(body, surf.y, 0);
    return true;
  }
  return false;
}

function gridWheelWedge(body){
  if(!_gridReady()) return null;
  const t=MV_GRID.tile;
  const wr=body.wheelR||20;
  const cx=body.wheelCx!=null?body.wheelCx:body.x+body.w*0.5;
  const cy=body.wheelCy!=null?body.wheelCy:((body.feetY!=null?body.feetY:body.y+body.h)-wr);
  let left=null, right=null;
  const c0=Math.floor((cx-wr-2)/t), c1=Math.floor((cx+wr+2)/t);
  const r0=Math.floor((cy-wr*0.4)/t), r1=Math.floor((cy+wr*0.6)/t);
  for(let c=c0;c<=c1;c++) for(let r=r0;r<=r1;r++){
    if(!gridSolid(c,r)||gridIsSlope(c,r)) continue;
    if(!_gridCircleHitsCell(cx,cy,wr,c,r,t)) continue;
    const faceL=c*t, faceR=(c+1)*t;
    if(faceR<=cx) left=left==null?faceR:Math.max(left,faceR);
    if(faceL>=cx) right=right==null?faceL:Math.min(right,faceL);
  }
  if(left==null||right==null) return null;
  const gap=right-left;
  if(gap>=wr*2-1) return null;
  return {left, right, gap};
}
function gridUnwedge(body, preferDir){
  const wedge=gridWheelWedge(body);
  if(!wedge) return false;
  const wr=body.wheelR||20;
  const cx=body.x+body.w*0.5;
  const dir=preferDir||Math.sign(body.vx||0);
  const tryCx=target=>{
    const dx=target-cx;
    body.x+=dx;
    if(body.wheelCx!=null) body.wheelCx+=dx;
    if(gridOverlaps(body)||gridWheelWedge(body)){
      body.x-=dx;
      if(body.wheelCx!=null) body.wheelCx-=dx;
      return false;
    }
    return true;
  };
  const rightCx=wedge.right+wr+0.6, leftCx=wedge.left-wr-0.6;
  const first=dir>0?rightCx:(dir<0?leftCx:((cx-wedge.left)<=(wedge.right-cx)?leftCx:rightCx));
  const second=first===rightCx?leftCx:rightCx;
  if(!tryCx(first)&&!tryCx(second)) return false;
  const hit=gridBestFloor(body, (body.feetY!=null?body.feetY:body.y+body.h)+6);
  if(hit) gridSetFeet(body, hit.y, hit.ang);
  body._wedged=false;
  body._hitX=false;
  return true;
}

function gridResolvePlayer(pl, vx, vy, opts){
  if(!_gridReady()||!pl) return false;
  opts=opts||{};
  const swing=!!opts.swing;
  const noCrest=!!opts.noCrest;
  const wasGrounded=!!pl.og;
  const body=gridPlayerBody(pl);
  body.vx=vx||0; body.vy=vy||0;
  const sprint=pl===p&&((pl.runRamp||0)>0.45||Math.abs(pl.vx||0)>((typeof MOVE_WALK!=='undefined'?MOVE_WALK:10.5)*0.85));
  const torque=sprint||(pl.jf||0)>0;
  gridMoveSwept(body, vx||0, vy||0);
  const wedge=gridWheelWedge(body);
  if(wedge&&(vy||0)>=0){
    const dir=Math.sign(body.vx||0);
    if(gridUnwedge(body, dir)){
      if(dir) body.vx=dir*Math.max(Math.abs(body.vx||0),1.15);
    }else{
      body._wedged=true;
      body.onGround=true;
      if(!torque){
        body.vx*=0.12;
        if(Math.abs(body.vx)<0.7){ body.vx=0; body._hitX=true; }
        body.vy=0; body._hitY=true;
      }else{
        body.vy=Math.min(body.vy||0,-1.4);
        body._hitY=false;
      }
    }
  }
  gridDepenetrate(body, {swing});
  if(!swing){
    if((vy||0)>=-0.2) gridFollowSlope(body, wasGrounded||body.onGround);
    if(body.onGround&&!noCrest){
      if(!gridCrestRelease(body)){
        const hit=gridBestFloor(body, body.feetY);
        if(hit && Math.abs((body.feetY)-hit.y)<=MV_GRID.tile){
          gridSetFeet(body, hit.y, hit.ang);
        }
      }
    }
    // Snap back only if we fell through a hypotenuse or lost the ramp.
    // Do not pull a crest-release onto flat back down the hill.
    if((wasGrounded||body.onGround)&&(vy||0)>=-0.2){
      const t=MV_GRID.tile;
      const feet=body.feetY!=null?body.feetY:body.y+body.h;
      const wx=body.x+body.w*0.5;
      const hold=gridStandBest(wx, feet, {maxUp:10, maxDrop:t*2.25, span:Math.max(12,(body.wheelR||20)-4)});
      if(hold&&hold.kind==='slope'&&hold.y<=feet+t*2.25){
        const below=feet>hold.y+2.5;
        const lost=!gridFeetGrounded(body);
        if(below||lost) gridSetFeet(body, hold.y, hold.ang);
      }
    }
  }
  gridWritePlayer(pl, body);
  if(pl===p) pl._wedged=!!body._wedged;
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
  for(let dc=-1;dc<=1;dc++){
    const c=col+dc;
    for(let r=r0;r<=r1;r++){
      const type=gridCell(c,r);
      if(type===MV_GRID_SLOPE_L||type===MV_GRID_SLOPE_R){
        const sx=dc===0?cx:Math.max(c*t+1, Math.min((c+1)*t-1, cx));
        const sy=gridSlopeY(c,r,sx);
        const s=gridSlopeAt(c,r);
        consider(sy, s?s.angle:0, 'slope');
      }else if(dc===0&&(type===MV_GRID_SOLID||type===MV_GRID_DESTRUCT||type===MV_GRID_ONEWAY)){
        if(type===MV_GRID_ONEWAY && feetY>r*t+4) continue;
        consider(r*t, 0, type===MV_GRID_ONEWAY?'oneway':'solid');
      }
    }
  }
  return best;
}

function gridStandY(cx, feetY, opts){
  const hit=gridStandHit(cx, feetY, opts);
  return hit?hit.y:null;
}

/** Highest stand under a wheel-wide span so a rim on floor still counts. */
function gridStandBest(cx, feetY, opts){
  opts=opts||{};
  const span=opts.span!=null?opts.span:18;
  let best=null;
  for(const x of [cx-span, cx, cx+span]){
    const hit=gridStandHit(x, feetY, opts);
    if(hit&&(best==null||hit.y<best.y)) best=hit;
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
    }else if(type===MV_GRID_SLOPE_L||type===MV_GRID_SLOPE_R){
      const sy=gridSlopeY(col,r,cx);
      if(sy!=null && sy>=markerFeet-2 && sy<=markerFeet+(maxDrop||640)) return sy;
    }
  }
  return null;
}

/** Pixels between the head and the lowest solid underside above it. Negative = already in the rock. */
function gridHeadroom(bodyTop, x, w, feetY){
  if(!_gridReady()) return 999;
  const t=MV_GRID.tile;
  const [c0,c1]=gridSpan(x,w,t);
  const start=Math.floor((bodyTop-0.001)/t);
  const floorCut=(feetY!=null?feetY:bodyTop+t*4)-2;
  let best=999;
  for(let r=start+2;r>=start-12;r--){
    for(let c=c0;c<=c1;c++){
      if(!gridSolid(c,r)||gridIsSlope(c,r)) continue;
      if(gridSolid(c,r+1)) continue;
      const underside=(r+1)*t;
      if(underside>floorCut) continue;
      const gap=bodyTop-underside;
      if(gap<best) best=gap;
    }
  }
  return best;
}

function gridPlayerOverlapsSolid(pl){
  if(!_gridReady()||!pl) return false;
  return gridOverlaps(gridPlayerBody(pl));
}
