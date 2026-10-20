// ============================================================
//  debug_overlay.js — movement / collision debug HUD
//  Toggle: ?debug=1  or  ` (backquote) in-game
// ============================================================

let _mvDebugOn = /[?&]debug=1/i.test(location.search)
  || (typeof localStorage !== 'undefined' && localStorage.getItem('mv_debug') === '1');

function mvDebugEnabled(){ return !!_mvDebugOn; }

function _mvDebugSet(on){
  _mvDebugOn = !!on;
  try{ localStorage.setItem('mv_debug', on ? '1' : '0'); }catch(e){}
}

window.addEventListener('keydown', function(e){
  if(e.code !== 'Backquote' && e.key !== '`') return;
  if(typeof _gameState === 'undefined' || _gameState !== 'game') return;
  _mvDebugSet(!_mvDebugOn);
  e.preventDefault();
});

function _mvDebugSurface(pl){
  if(!pl) return 'NONE';
  for(const bw of (typeof BWALLS !== 'undefined' ? BWALLS : [])){
    if(bw.hp <= 0) continue;
    if(typeof _marioOnTop === 'function' && _marioOnTop(pl, bw)) return 'OMNIBLOCK';
  }
  for(const plat of (typeof allP === 'function' ? allP() : [])){
    if(plat.tp !== 'solid' || plat.poly) continue;
    if(typeof _marioOnTop === 'function' && _marioOnTop(pl, plat)) return plat.bw ? 'OMNIBLOCK' : 'PLAT';
  }
  if(typeof _feetOnWalkSurface === 'function' && _feetOnWalkSurface(pl)) return 'WALK_SEG';
  if(pl.og || (typeof _playerOnGround === 'function' && _playerOnGround(pl))) return 'GROUND';
  return 'AIR';
}

function _mvDebugTileInfo(pl){
  if(!pl) return { gid: 0, col: null, row: null };
  let best = null, bestY = -Infinity;
  for(const bw of (typeof BWALLS !== 'undefined' ? BWALLS : [])){
    if(bw.hp <= 0) continue;
    const feet = pl.y + (typeof FEET_OFF !== 'undefined' ? FEET_OFF : 88);
    if(feet < bw.y - 20 || feet > bw.y + bw.h + 8) continue;
    const cx = pl.x + (typeof SW !== 'undefined' ? SW : 64) * 0.5;
    if(cx < bw.x - 8 || cx > bw.x + bw.w + 8) continue;
    if(!best || bw.y > bestY){ best = bw; bestY = bw.y; }
  }
  if(!best) return { gid: 0, col: null, row: null };
  return {
    gid: best.tileGid || 0,
    col: best.homeCol != null ? best.homeCol : null,
    row: best.homeRow != null ? best.homeRow : null,
  };
}

function _mvDebugContactNormals(pl){
  const out = [];
  if(!pl || typeof playerCoreHB !== 'function') return out;
  const probes = (typeof _wheelProbePoints === 'function' ? _wheelProbePoints(pl) : [])
    .concat(typeof _bodyProbePoints === 'function' ? _bodyProbePoints(pl) : []);
  const segs = (typeof COLL_WALL_SEGS !== 'undefined' ? COLL_WALL_SEGS : [])
    .concat(typeof COLL_SEGS !== 'undefined' ? COLL_SEGS : []);
  const seen = new Set();
  for(const seg of segs){
    if(seg.nx == null) continue;
    if(typeof _marioSkipKeepOut === 'function' && _marioSkipKeepOut(pl, seg)) continue;
    for(const pr of probes){
      if(typeof _segClosestPoint !== 'function') break;
      const cp = _segClosestPoint(seg, pr.x, pr.y);
      const vx = pr.x - cp.x, vy = pr.y - cp.y;
      const into = vx * seg.nx + vy * seg.ny;
      if(into <= 0.8 || into > 28) continue;
      const key = Math.round(cp.x * 0.1) + ',' + Math.round(cp.y * 0.1) + ',' + Math.round(seg.nx * 10);
      if(seen.has(key)) continue;
      seen.add(key);
      out.push({ x: cp.x, y: cp.y, nx: seg.nx, ny: seg.ny, pen: into });
      if(out.length >= 8) return out;
    }
  }
  return out;
}

function _mvDebugCollect(pl){
  const body = typeof playerCoreHB === 'function' ? playerCoreHB(pl) : null;
  const wheel = typeof playerWheelCol === 'function' ? playerWheelCol(pl) : null;
  const fL = pl.x + (typeof FEET_L !== 'undefined' ? FEET_L : 12);
  const fR = fL + (typeof FEET_W !== 'undefined' ? FEET_W : 40);
  const feet = pl.y + (typeof FEET_OFF !== 'undefined' ? FEET_OFF : 88);
  const tile = _mvDebugTileInfo(pl);
  const wt = typeof _wallTouchInfo === 'function' ? _wallTouchInfo(pl) : { touch: false, dir: 0 };
  return {
    body, wheel,
    fL, fR, feet,
    grounded: !!(pl.og || (typeof _playerOnGround === 'function' && _playerOnGround(pl))),
    blocked: !!pl._moveBlocked,
    grind: pl._grindF || 0,
    topFree: typeof _marioOnAnyTop === 'function' ? _marioOnAnyTop(pl) : false,
    surface: _mvDebugSurface(pl),
    tile,
    vx: pl.vx || 0,
    vy: pl.vy || 0,
    slope: !!pl._onSlope,
    wallTouch: wt,
    normals: _mvDebugContactNormals(pl),
  };
}

function _mvDebugStrokeRect(wx, wy, ww, wh, col){
  ctx.strokeStyle = col;
  ctx.lineWidth = 1;
  ctx.strokeRect(sx(wx), sy(wy), ww, wh);
}

function _mvDebugDrawHitboxes(pl, d){
  if(!d.body) return;
  ctx.setLineDash([3, 3]);
  _mvDebugStrokeRect(d.body.x, d.body.y, d.body.w, d.body.h, '#ff4444');
  ctx.setLineDash([]);
  if(d.wheel){
    ctx.beginPath();
    ctx.strokeStyle = '#44ff44';
    ctx.lineWidth = 1;
    ctx.arc(sx(d.wheel.cx), sy(d.wheel.cy), d.wheel.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = '#ffff44';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx(d.fL), sy(d.feet));
  ctx.lineTo(sx(d.fR), sy(d.feet));
  ctx.stroke();
  ctx.fillStyle = '#ffff44';
  ctx.fillRect(sx(d.fL) - 2, sy(d.feet) - 2, 4, 4);
  ctx.fillRect(sx(d.fR) - 2, sy(d.feet) - 2, 4, 4);
  ctx.fillRect(sx(pl.x + SW * 0.5) - 2, sy(d.feet) - 2, 4, 4);
}

function _mvDebugDrawNormals(d){
  for(const n of d.normals){
    const x0 = sx(n.x), y0 = sy(n.y);
    const len = Math.min(28, 8 + n.pen * 1.2);
    ctx.strokeStyle = '#ff88ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + n.nx * len, y0 + n.ny * len);
    ctx.stroke();
    ctx.fillStyle = '#ff88ff';
    ctx.fillRect(x0 - 1, y0 - 1, 2, 2);
  }
}

function _mvDebugDrawPanel(pl, d){
  const px = pl.x + SW * 0.5;
  const py = pl.y - 8;
  const lines = [
    'GROUND: ' + d.grounded,
    'BLOCKED: ' + d.blocked,
    'GRIND: ' + d.grind,
    'TOPFREE: ' + d.topFree,
    'SURFACE: ' + d.surface,
    'VX: ' + d.vx.toFixed(1),
    'VY: ' + d.vy.toFixed(1),
    'WALL: ' + (d.wallTouch.touch ? (d.wallTouch.dir > 0 ? 'R' : 'L') : '—'),
    'SLOPE: ' + d.slope,
    'TILE: ' + (d.tile.gid || '—') + (d.tile.col != null ? ' @' + d.tile.col + ',' + d.tile.row : ''),
    'NORM: ' + d.normals.length,
  ];
  const pad = 4;
  const lineH = 9;
  const boxW = 148;
  const boxH = pad * 2 + lines.length * lineH;
  let bx = sx(px) - boxW * 0.5;
  let by = sy(py) - boxH - 6;
  bx = Math.max(4, Math.min(W - boxW - 4, bx));
  by = Math.max(4, by);
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(bx, by, boxW, boxH);
  ctx.strokeStyle = '#0f0';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, boxW, boxH);
  ctx.font = '9px monospace';
  ctx.textBaseline = 'top';
  for(let i = 0; i < lines.length; i++){
    ctx.fillStyle = i < 5 ? '#6f6' : '#afa';
    ctx.fillText(lines[i], bx + pad, by + pad + i * lineH);
  }
}

function drawMvDebugOverlay(){
  if(!_mvDebugOn || typeof _gameState === 'undefined' || _gameState !== 'game') return;
  if(typeof p === 'undefined' || !p) return;
  const d = _mvDebugCollect(p);
  _mvDebugDrawHitboxes(p, d);
  _mvDebugDrawNormals(d);
  _mvDebugDrawPanel(p, d);
  ctx.fillStyle = '#0f0';
  ctx.font = '9px monospace';
  ctx.textBaseline = 'top';
  ctx.fillText('DEBUG (` toggle)', 6, H - 14);
}
