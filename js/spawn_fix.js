// ============================================================
//  Mind & Venture — spawn_fix.js
//  Tiled spawn / marker resolution (loaded before main.js).
//  Awdjoo spawns tile layer (col, row):
//    player gid 169 @ 31, 73
//    mind   gid 223 @ 13, 65
//    RCA    gid 187 @ 30, 85
//  Object layer "spawns" (id 15 @ x248 y576, id 16 RCA, id 17 enemy).
// ============================================================

function _isSpawnLayerName(name){
  const l=String(name||'').toLowerCase();
  return l==='spawns'||l==='spawn';
}

// Offset from pl.y to standing head top (matches playerHeadWorld).
function _spawnHeadTopDy(){
  return FEET_OFF-STAND_H-WHEEL_R-22;
}
function _spawnFeetFromHeadTop(headTopY,kind){
  const top=Math.floor(headTopY);
  if(kind==='signol') return top+(typeof SIGNOL_D!=='undefined'?SIGNOL_D:64);
  return top+(FEET_OFF-_spawnHeadTopDy());
}
function _spawnPtFromCell(col,row,tw,th,sc){
  const x=Math.floor((col+0.5)*tw*sc-SW/2);
  const headTopY=Math.floor(row*th*sc);
  return {x,headTopY,feetY:_spawnFeetFromHeadTop(headTopY),row,col};
}
function _spawnPtFromObject(o,tw,th,sc){
  const w=o.width||0;
  const cx=(o.x+(w>0?w*0.5:0))*sc;
  const col=Math.floor(o.x/tw), row=Math.floor(o.y/th);
  const headTopY=Math.floor(o.y*sc);
  return {x:Math.floor(cx-SW/2),headTopY,feetY:_spawnFeetFromHeadTop(headTopY),row,col};
}

function _normalizeSpawnGid(raw){
  const g=typeof _tmjGid==='function'?_tmjGid(raw):(raw|0)&0x1FFFFFFF;
  if(!g) return 0;
  const first=typeof TMJ_SPAWN_FIRST_GID!=='undefined'?TMJ_SPAWN_FIRST_GID:162;
  const count=typeof TMJ_SPAWN_TILE_COUNT!=='undefined'?TMJ_SPAWN_TILE_COUNT:64;
  if(g>=first&&g<first+count) return g;
  if(g>=1&&g<=count) return first+(g-1);
  return g;
}
function _inferSpawnGidFromObject(o,tw,th){
  if(!o) return 0;
  if(o.polyline) return typeof TMJ_ROPE_PICKUP_GID!=='undefined'?TMJ_ROPE_PICKUP_GID:187;
  const col=Math.floor(o.x/tw), row=Math.floor(o.y/th);
  if(typeof TMJ_PLAYER_SPAWN_COL!=='undefined'&&typeof TMJ_PLAYER_SPAWN_ROW!=='undefined'
    &&Math.abs(col-TMJ_PLAYER_SPAWN_COL)<=2&&Math.abs(row-TMJ_PLAYER_SPAWN_ROW)<=2)
    return typeof TMJ_PLAYER_SPAWN_GID!=='undefined'?TMJ_PLAYER_SPAWN_GID:169;
  if(typeof TMJ_ENEMY_SPAWN_COL!=='undefined'&&typeof TMJ_ENEMY_SPAWN_ROW!=='undefined'
    &&Math.abs(col-TMJ_ENEMY_SPAWN_COL)<=2&&Math.abs(row-TMJ_ENEMY_SPAWN_ROW)<=2)
    return 223;
  if(typeof TMJ_RCA_SPAWN_COL!=='undefined'&&typeof TMJ_RCA_SPAWN_ROW!=='undefined'
    &&Math.abs(col-TMJ_RCA_SPAWN_COL)<=2&&Math.abs(row-TMJ_RCA_SPAWN_ROW)<=2)
    return 187;
  if(o.id===15) return typeof TMJ_PLAYER_SPAWN_GID!=='undefined'?TMJ_PLAYER_SPAWN_GID:169;
  if(o.id===17) return 223;
  if(o.id===16) return 187;
  return 0;
}
function _resolveSpawnGid(col,row,spawnData,mw,o,tw,th){
  let gid=_spawnGidNearCell(spawnData,mw,col,row);
  if(!gid&&o) gid=_inferSpawnGidFromObject(o,tw,th);
  return gid;
}

function _firstHouseSpawnFallback(sc){
  return _spawnPtFromCell(TMJ_PLAYER_SPAWN_COL,TMJ_PLAYER_SPAWN_ROW,8,8,sc);
}

function _shapeForEnemyGid(gid){
  if(gid===TMJ_ENEMY_BALL_GID||gid===TMJ_MIND_ENEMY_GID) return 'ball';
  if(gid===TMJ_ENEMY_SQ_GID) return 'square';
  if(gid===TMJ_ENEMY_TRI_GID) return 'triangle';
  if(gid===TMJ_ENEMY_STAR_GID) return 'star';
  return 'ball';
}

function _dispatchMindSpawnAt(cx,headTopY,row,col,mw,tw,sc){
  const range=Math.max(96,Math.min(200,mw*tw*sc*0.08));
  const wx=Math.floor(cx);
  const feetY=_spawnFeetFromHeadTop(headTopY);
  const def={
    shape:'ball', x:wx, y:feetY, headTopY, row, col,
    mn:Math.floor(wx-range), mx:Math.floor(wx+range),
    hp:_ENEMY_SHAPE_HP.ball, spd:_ENEMY_SHAPE_SPD.ball,
  };
  const existing=_mapEnemyDefs.find(e=>e.shape==='ball'&&e.col===col&&Math.abs(e.row-row)<=1);
  if(existing){ Object.assign(existing,def); return; }
  _mapEnemyDefs.push(def);
}

function _spawnGidAt(data,mw,col,row){
  if(!data||!mw||col<0||row<0) return 0;
  const i=row*mw+col;
  if(i<0||i>=data.length) return 0;
  return _normalizeSpawnGid(data[i]);
}
function _spawnGidNearCell(data,mw,col,row){
  if(!data||!mw) return 0;
  for(const dr of [0,-1,1]){
    for(const dc of [0,-1,1]){
      const g=_spawnGidAt(data,mw,col+dc,row+dr);
      if(g) return g;
    }
  }
  return 0;
}

function _headTopFromFeetY(feetY){
  return feetY-(FEET_OFF-_spawnHeadTopDy());
}

function _spawnMarkerZoneOk(cx,headTopY,feetY){
  if(typeof _pointOnWalkableGround==='function'&&_pointOnWalkableGround(cx,feetY)) return true;
  if(!IMMERSED_POLYS.length) return true;
  if(typeof _zonePointOk!=='function') return true;
  if(!_zonePointOk(cx,headTopY)) return false;
  if(!_zonePointOk(cx,feetY)) return false;
  const bodyY=feetY-(typeof STAND_H!=='undefined'?STAND_H:70)*0.45;
  if(!_zonePointOk(cx,bodyY)) return false;
  return true;
}

function _spawnCellAllowed(cx,feetY,opts){
  opts=opts||{};
  const headTopY=_headTopFromFeetY(feetY);
  if(opts.pickup){
    if(typeof _pointOnWalkableGround==='function'&&_pointOnWalkableGround(cx,feetY)) return true;
    if(typeof _zonePointOk==='function') return _zonePointOk(cx,feetY);
    if(typeof _isInImmersedZone==='function'&&IMMERSED_POLYS.length) return _isInImmersedZone(cx,feetY);
    return true;
  }
  return _spawnMarkerZoneOk(cx,headTopY,feetY);
}

function _ropePickupFromObject(o,tw,th,sc){
  let minX=o.x, minY=o.y, maxX=o.x+(o.width||tw), maxY=o.y+(o.height||th);
  if(o.polyline&&o.polyline.length){
    for(const p of o.polyline){
      minX=Math.min(minX,o.x+p.x); maxX=Math.max(maxX,o.x+p.x);
      minY=Math.min(minY,o.y+p.y); maxY=Math.max(maxY,o.y+p.y);
    }
  }
  const w=Math.max(tw,Math.round(maxX-minX)||tw);
  const h=Math.max(th,Math.round(maxY-minY)||th);
  const headTopY=Math.floor(minY*sc);
  const x=Math.floor(minX*sc);
  const y=Math.floor(headTopY);
  return {x,y,w:Math.max(tw*sc,Math.round(w*sc)),h:Math.max(th*sc,Math.round(h*sc)),got:false,headTopY};
}

function _filterSpawnDefsToZones(){
  if(typeof _isValidEntityZone!=='function') return;
  _mapKnowlDefs=_mapKnowlDefs.filter(d=>_isValidEntityZone(d.x,d.y));
  _mapMinionDefs=_mapMinionDefs.filter(d=>_isValidEntityZone(d.x+(typeof SW!=='undefined'?SW*0.25:16),d.y));
  _mapSignolDefs=_mapSignolDefs.filter(d=>_isValidEntityZone(d.x,d.y));
  if(_mapRopePickup){
    const r=_mapRopePickup;
    if(r._trustedRca) return;
    const cx=r.x+r.w/2, cy=r.y+r.h*0.5;
    if(!_spawnCellAllowed(cx,cy,{pickup:true})) _mapRopePickup=null;
  }
  if(_mapLaituSpawn){
    const l=_mapLaituSpawn, feet=l.feetY!=null?l.feetY:l.y;
    if(!_isValidEntityZone(l.x+(typeof SW!=='undefined'?SW*0.25:16),feet)) _mapLaituSpawn=null;
  }
}

function _dispatchSpawnGid(gid,col,row,tw,th,sc,mw){
  if(_isBasementSpawnRow(row,gid)) return;
  const cx=(col+0.5)*tw*sc, headTopY=row*th*sc;
  const feetY=_spawnFeetFromHeadTop(headTopY);
  if(TMJ_PLAYER_SPAWN_GIDS.has(gid)){
    if(!_mapPlayerSpawnPt) _mapPlayerSpawnPt=_spawnPtFromCell(col,row,tw,th,sc);
    return;
  }
  if(!_spawnCellAllowed(cx,feetY)) return;
  const wx=Math.floor(cx), wy=Math.floor(row*th*sc);
  if(TMJ_MIND_SPAWN_GIDS.has(gid)||gid===TMJ_MIND_ENEMY_GID){
    _dispatchMindSpawnAt(cx,headTopY,row,col,mw,tw,sc);
    return;
  }
  if(TMJ_RCA_SPAWN_GIDS.has(gid)){
    if(_mapRopePickup&&_mapRopePickup._trustedRca) return;
    const r=_ropePickupFromObject({x:col*tw,y:row*th,width:tw,height:th},tw,th,sc);
    r._trustedRca=true;
    _mapRopePickup=r;
    return;
  }
  if(gid===TMJ_KNOWL_GID){
    _mapKnowlDefs.push({x:wx+tw*sc*0.5,y:wy+th*sc*0.5});
    return;
  }
  if(gid===TMJ_ENEMY_BALL_GID||gid===TMJ_ENEMY_SQ_GID||
     gid===TMJ_ENEMY_TRI_GID||gid===TMJ_ENEMY_STAR_GID){
    const range=Math.max(96,Math.min(200,mw*tw*sc*0.08));
    const shape=_shapeForEnemyGid(gid);
    _mapEnemyDefs.push({
      shape, x:wx, y:feetY, row, col,
      mn:Math.floor(wx-range), mx:Math.floor(wx+range),
      hp:_ENEMY_SHAPE_HP[shape], spd:_ENEMY_SHAPE_SPD[shape],
    });
    return;
  }
  if(TMJ_SIGNOL_GIDS.has(gid)){
    _mapSignolDefs.push({x:cx, y:_spawnFeetFromHeadTop(headTopY,'signol'), headTopY, row, col});
    return;
  }
  if(TMJ_ROPE_PICKUP_GIDS.has(gid)&&!_mapRopePickup){
    _mapRopePickup={x:col*tw*sc,y:row*th*sc,w:tw*sc,h:th*sc,got:false};
    return;
  }
  if(TMJ_LAITU_GIDS.has(gid)&&!_mapLaituSpawn){
    _mapLaituSpawn={x:wx,y:wy,feetY};
    return;
  }
  if(gid===TMJ_MINION_CIRCLE_GID||gid===TMJ_MINION_SQUARE_GID||gid===TMJ_MINION_FLYER_GID){
    const kind=gid===TMJ_MINION_CIRCLE_GID?'circle':gid===TMJ_MINION_SQUARE_GID?'square':'flyer';
    _mapMinionDefs.push({kind,x:wx,y:feetY,row,col});
  }
}

function _dispatchSpawnObject(o,tw,th,sc,spawnData,mw){
  if(o.polyline){
    const r=_ropePickupFromObject(o,tw,th,sc);
    const trusted=o.id===16;
    if(trusted) r._trustedRca=true, r._objectId=16;
    const cx=r.x+r.w/2, cy=r.y+r.h*0.5;
    if(trusted||_spawnCellAllowed(cx,cy,{pickup:true})) _mapRopePickup=r;
    return;
  }
  const col=Math.floor(o.x/tw), row=Math.floor(o.y/th);
  const gid=_resolveSpawnGid(col,row,spawnData,mw,o,tw,th);
  const pt=_spawnPtFromObject(o,tw,th,sc);
  const cx=pt.x+SW/2;
  // Object id 15 is always the player spawn. A generic spawn-tile (gid 162)
  // sitting under the marker used to shadow this, so the placed marker was
  // ignored and spawn fell back to the hardcoded sky-island cell.
  if(TMJ_PLAYER_SPAWN_GIDS.has(gid)||(o&&o.id===15)){
    _mapPlayerSpawnPt=pt;
    return;
  }
  const trustedObject=o&&(o.id===15||o.id===16||o.id===17);
  if(!trustedObject&&!_spawnMarkerZoneOk(cx,pt.headTopY,pt.feetY)) return;
  if(TMJ_MIND_SPAWN_GIDS.has(gid)||gid===TMJ_MIND_ENEMY_GID){
    _dispatchMindSpawnAt(pt.x+SW/2,pt.headTopY,row,col,mw,tw,sc);
    return;
  }
  if(TMJ_RCA_SPAWN_GIDS.has(gid)){
    const r=_ropePickupFromObject(o,tw,th,sc);
    r._trustedRca=true;
    _mapRopePickup=r;
  }
}

function _pickPlayerSpawn(data,tw,th,sc,spawnData,mw,spawnObjects){
  if(_mapPlayerSpawnPt&&!_spawnPtNeedsFallback(_mapPlayerSpawnPt)) return _mapPlayerSpawnPt;
  if(spawnObjects&&spawnObjects.length){
    for(const o of spawnObjects){
      if(o.polyline) continue;
      const col=Math.floor(o.x/tw), row=Math.floor(o.y/th);
      const gid=_resolveSpawnGid(col,row,spawnData,mw,o,tw,th);
      if(TMJ_PLAYER_SPAWN_GIDS.has(gid)||(o&&o.id===15)){
        const pt=_spawnPtFromObject(o,tw,th,sc);
        if(!_spawnPtNeedsFallback(pt)) return pt;
      }
    }
  }
  if(spawnData&&mw>0){
    for(let row=0;row<data.height;row++){
      for(let col=0;col<mw;col++){
        const gid2=_spawnGidAt(spawnData,mw,col,row);
        if(TMJ_PLAYER_SPAWN_GIDS.has(gid2)){
          const pt=_spawnPtFromCell(col,row,tw,th,sc);
          if(!_spawnPtNeedsFallback(pt)) return pt;
        }
      }
    }
  }
  return _firstHouseSpawnFallback(sc);
}

function _applySpawnFeetSnap(spawnPt){
  const cx=spawnPt.x+(typeof SW!=='undefined'?SW:64)*0.5;
  let feet=spawnPt.feetY!=null?spawnPt.feetY:(spawnPt.y+(typeof FEET_OFF!=='undefined'?FEET_OFF:88));
  const dropLim=Math.max(640,typeof WH!=='undefined'?WH*0.45:720);
  const floor=typeof _spawnFloorBelow==='function'?_spawnFloorBelow(cx,feet,dropLim):null;
  if(floor!=null&&floor>=feet-8) feet=floor;
  return feet;
}

function _applyTiledSpawnFeet(cx,markerFeet){
  return markerFeet;
}

function _spawnPtNeedsFallback(pt){
  if(!pt) return true;
  const cx=pt.x+(typeof SW!=='undefined'?SW:64)*0.5;
  const feetY=pt.feetY!=null?pt.feetY:(pt.y+(typeof FEET_OFF!=='undefined'?FEET_OFF:88));
  const headTopY=pt.headTopY!=null?pt.headTopY:feetY-_spawnHeadTopDy();
  if(typeof _spawnMarkerZoneOk==='function'&&!_spawnMarkerZoneOk(cx,headTopY,feetY)) return true;
  const dropLim=Math.max(640,typeof WH!=='undefined'?WH*0.45:720);
  const floor=typeof _spawnFloorBelow==='function'?_spawnFloorBelow(cx,feetY,dropLim):null;
  if(floor==null) return true;
  if(floor<feetY-8) return true;
  return false;
}

function _resolveAndApplySpawn(data,tw,th,sc,spawnData,mw){
  _mapPlayerSpawnPt=null;
  _mapEnemyDefs=[];
  _mapRopePickup=null;
  const layers=data.layers||[];
  const spawnOg=layers.find(l=>l.type==='objectgroup'&&_isSpawnLayerName(l.name));
  const spawnObjects=spawnOg?(spawnOg.objects||[]):[];
  if(!spawnData) spawnData=null;

  if(spawnObjects.length){
    for(const o of spawnObjects) _dispatchSpawnObject(o,tw,th,sc,spawnData,mw);
  }
  if(spawnData&&mw>0){
    for(let row=0;row<data.height;row++){
      for(let col=0;col<mw;col++){
        const gid=_spawnGidAt(spawnData,mw,col,row);
        if(!gid) continue;
        _dispatchSpawnGid(gid,col,row,tw,th,sc,mw);
      }
    }
  }

  if(!_mapRopePickup&&typeof _ensureAwdjooRcaPickup==='function') _ensureAwdjooRcaPickup();

  const spawnPt=_pickPlayerSpawn(data,tw,th,sc,spawnData,mw,spawnObjects);
  _mapPlayerSpawnPt=spawnPt;
  _spawnX=spawnPt.x;
  const feetY=_applySpawnFeetSnap(spawnPt);
  _spawnY=feetY-(typeof FEET_OFF!=='undefined'?FEET_OFF:88);
  _floorTopY=feetY;
  if(typeof _filterSpawnDefsToZones==='function') _filterSpawnDefsToZones();
}
