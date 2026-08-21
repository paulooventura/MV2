// ============================================================
//  Mind & Venture — collision_grid.js
//  ONE tile-type grid. ONE resolver. KEEP OUT / merged TR /
//  tile-grass segs / omniblock AABB walls are not authorities.
//
//  Types: 0 AIR, 1 SOLID, 2 ONEWAY, 3 DESTRUCTIBLE
//  Resolver: move X then Y, swept <=2px, depenetrate up.
// ============================================================

const MV_GRID_AIR=0, MV_GRID_SOLID=1, MV_GRID_ONEWAY=2, MV_GRID_DESTRUCT=3, MV_GRID_SLOPE=4;
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

function gridIsSlope(c,r){ return gridCell(c,r)===MV_GRID_SLOPE; }

function gridSlopeAt(c,r){
  if(!_gridReady()||!MV_GRID.slope) return null;
  return MV_GRID.slope[r*MV_GRID.cols+c]||null;
}

function gridSlopeY(c,r,wx){
  const s=gridSlopeAt(c,r);
  if(!s) return null;
  const dx=s.x2-s.x1;
  if(Math.abs(dx)<0.001) return Math.min(s.y1,s.y2);
  const t=Math.max(0,Math.min(1,(wx-s.x1)/dx));
  return s.y1+(s.y2-s.y1)*t;
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
  const stampSlopeEdge=(x0,y0,x1,y1)=>{
    let ax=x0, ay=y0, bx=x1, by=y1;
    if(ax>bx){ ax=x1; ay=y1; bx=x0; by=y0; }
    const n=Math.max(Math.abs(bx-ax),Math.abs(by-ay),1);
    for(let i=0;i<=n;i++){
      const x=ax+(bx-ax)*i/n, y=ay+(by-ay)*i/n;
      const c=Math.floor(x/tile), r=Math.floor(y/tile);
      if(c<0||r<0||c>=cols||r>=rows) continue;
      if(grid[r][c]===MV_GRID_DESTRUCT) continue;
      grid[r][c]=MV_GRID_SLOPE;
      const key=r*cols+c;
      const cellL=c*tile, cellR=cellL+tile;
      const t0=Math.abs(bx-ax)<0.001?0:Math.max(0,Math.min(1,(cellL-ax)/(bx-ax)));
      const t1=Math.abs(bx-ax)<0.001?1:Math.max(0,Math.min(1,(cellR-ax)/(bx-ax)));
      slopeSurf[key]={
        x1:ax+(bx-ax)*t0, y1:ay+(by-ay)*t0,
        x2:ax+(bx-ax)*t1, y2:ay+(by-ay)*t1,
        angle:Math.atan2(by-ay,bx-ax)
      };
    }
  };
  const stampFloorEdge=(x0,y0,x1,y1)=>{
    const n=Math.max(Math.abs(x1-x0),1);
    for(let i=0;i<=n;i++){
      const x=x0+(x1-x0)*i/n, y=y0+(y1-y0)*i/n;
      const c=Math.floor(x/tile);
      const r=Math.round(y/tile);
      stampCell(c,r,MV_GRID_SOLID);
    }
  };
  const hasGid=(arr,c,r)=>{
    if(!arr||c<0||r<0||c>=cols||r>=rows) return false;
    return !!_gridGid(arr[r*cols+c]);
  };

  let dirtData=null, grassData=null;
  const keepOutPolys=[];
  const slopeSurf={};

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
      const dx=b.x-a.x, dy=b.y-a.y, len=Math.hypot(dx,dy);
      if(len<4) continue;
      if(Math.abs(dy)<=Math.abs(dx)*0.35) stampFloorEdge(a.x,a.y,b.x,b.y);
      else if(Math.abs(dx)<=Math.abs(dy)*0.35) stampEdge(a.x,a.y,b.x,b.y,MV_GRID_SOLID);
      else stampSlopeEdge(a.x,a.y,b.x,b.y);
    }
  }
  // Grass cubes next to a KEEP OUT grade would stair-step the hull. Fold them into the slope.
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      if(grid[r][c]!==MV_GRID_SOLID) continue;
      if(!hasGid(grassData,c,r)) continue;
      let src=null;
      for(let dr=-1;dr<=1 && !src;dr++) for(let dc=-1;dc<=1;dc++){
        if(!dr&&!dc) continue;
        const nr=r+dr, nc=c+dc;
        if(nr<0||nc<0||nr>=rows||nc>=cols) continue;
        if(grid[nr][nc]!==MV_GRID_SLOPE) continue;
        src=slopeSurf[nr*cols+nc];
      }
      if(!src) continue;
      const cx=(c+0.5)*tile;
      const dx=src.x2-src.x1;
      const yAt=Math.abs(dx)<0.001?src.y1:src.y1+(src.y2-src.y1)*((cx-src.x1)/dx);
      if(yAt<r*tile-tile || yAt>(r+2)*tile) continue;
      grid[r][c]=MV_GRID_SLOPE;
      slopeSurf[r*cols+c]={
        x1:c*tile, y1:src.y1+(src.y2-src.y1)*((c*tile-src.x1)/(dx||1)),
        x2:(c+1)*tile, y2:src.y1+(src.y2-src.y1)*(((c+1)*tile-src.x1)/(dx||1)),
        angle:src.angle
      };
    }
  }

  MV_GRID={ready:true, cols, rows, tile, tw, th, sc, data:grid, slope:slopeSurf};
  let solids=0, dest=0, slopes=0;
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    if(grid[r][c]===MV_GRID_SOLID) solids++;
    else if(grid[r][c]===MV_GRID_DESTRUCT) dest++;
    else if(grid[r][c]===MV_GRID_SLOPE) slopes++;
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
  const stand=(typeof hbH==='function')?hbH(pl.crouchAmt||0):(typeof STAND_H!=='undefined'?STAND_H:70);
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

function gridBestFloor(body, prevFeet){
  const t=MV_GRID.tile;
  const feet=body.feetY!=null?body.feetY:body.y+body.h;
  const [c0,c1]=gridSpan(body.x, body.w, t);
  let best=null, bestAng=0;
  for(let c=c0;c<=c1;c++){
    const row=Math.floor((feet-0.001)/t);
    const type=gridCell(c,row);
    if(type===MV_GRID_SOLID||type===MV_GRID_DESTRUCT){
      const top=row*t;
      if(prevFeet<=top+0.001 && feet>=top){
        if(best==null||top<best){ best=top; bestAng=0; }
      }
    }else if(type===MV_GRID_ONEWAY){
      const top=row*t;
      if(prevFeet<=top+0.001 && feet>=top){
        if(best==null||top<best){ best=top; bestAng=0; }
      }
    }else if(type===MV_GRID_SLOPE){
      const wx=body.x+body.w*0.5;
      const sy=gridSlopeY(c,row,wx);
      if(sy==null) continue;
      if(prevFeet<=sy+0.5 && feet>=sy){
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

function gridFeetGrounded(body){
  if(!_gridReady()) return false;
  const t=MV_GRID.tile;
  const feet=body.feetY!=null?body.feetY:body.y+body.h;
  const hit=gridBestFloor(body, feet);
  if(hit && Math.abs(feet-hit.y)<=2.5) return true;
  const [c0,c1]=gridSpan(body.x, body.w, t);
  const row=Math.floor((feet+0.5)/t);
  for(let c=c0;c<=c1;c++){
    if(gridSolid(c,row) && Math.abs(feet-row*t)<=2.5) return true;
    if(gridIsSlope(c,row)){
      const sy=gridSlopeY(c,row,body.x+body.w*0.5);
      if(sy!=null && Math.abs(feet-sy)<=2.5) return true;
    }
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
  for(let c=c0;c<=c1;c++) for(let r=r0;r<=r1;r++) if(gridSolid(c,r)) return true;
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
  const body=gridPlayerBody(pl);
  body.vx=vx||0; body.vy=vy||0;
  gridMoveSwept(body, vx||0, vy||0);
  gridDepenetrate(body);
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
      if(type!==MV_GRID_SOLID&&type!==MV_GRID_DESTRUCT&&type!==MV_GRID_ONEWAY&&type!==MV_GRID_SLOPE) continue;
      let top=r*t;
      if(type===MV_GRID_SLOPE){
        const sy=gridSlopeY(c,r,cx);
        if(sy==null) continue;
        top=sy;
      }else if(type===MV_GRID_ONEWAY && feetY>top+4) continue;
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
    }else if(type===MV_GRID_SLOPE){
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
