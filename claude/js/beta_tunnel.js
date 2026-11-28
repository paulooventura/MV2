/* ─────────────────────────────────────────────────────────────────────────────
   beta_tunnel.js — the no-tunneling guarantee (Paulo, Nov 27: "I NEVER want to see blocks,
   foes or whatever falling or moving through walls/floors/ceilings").

   Every mover has its own collision code (foes, push blocks, thrown cubes, crates, rival
   siblings…), and each one has had its own holes: a big step tested only at its end point, a
   settle into a cell something is still flying through, a pin to the wrong feet line.
   Patching them one at a time kept leaving the next hole. This module is the net underneath
   all of them. It runs ONCE per frame, after every other module has moved things, and keeps
   two promises for ENEMS (every type), flying / thrown / pushed BWALLS and the second player:

     1. SWEPT:     the box never crosses rock between last frame and this frame
                   (the frame's travel is sampled every few px; the first sample inside rock
                   ends the move there, and the body slides along the rock with what is left).
     2. DEPEN:     a box found inside rock (a spawn, a block settled on top of it, a platform
                   that left, a bug we haven't met) is lifted / pushed out to the nearest free
                   spot, along its last motion first. It never stays buried.

   "Rock" = MV_GRID types 1 and 3 (solid, destructible / stamped blocks) plus the surface of
   live ramps. One-way floors are not rock. A block's own home cells are not rock to itself.
   Teleports (more than MAXSEG px in one frame: pit respawns, rope hops handled elsewhere) just
   re-seed the body's safe spot.

   Regression: scripts/probe-tunnel.mjs (npm run selftest:tunnel) steps thousands of frames
   with knockback-size flings and checks every body after every frame.
   ───────────────────────────────────────────────────────────────────────────── */
(function(){
  const B=window.MV_BETA; if(!B) return;
  const TOL=4;            // px of overlap tolerated (floor snap rounding, the 1px lip of a ramp)
  const STEP=6;           // swept sampling step, px (bodies are >= 30px, rock cells 32px)
  const MAXSEG=420;       // farther than this in one frame = a teleport, not a move
  const rec=new WeakMap();
  const stats=B.tunnelStats={fixed:0, swept:0, depen:0, stuck:0, last:null};

  const ready=()=>typeof MV_GRID!=='undefined'&&MV_GRID&&MV_GRID.ready&&MV_GRID.data;
  const on=()=>B.on&&typeof p!=='undefined'&&p&&_gameState==='game'&&!B.loading;

  function rock(c,r){
    const G=MV_GRID;
    if(c<0||r<0||c>=G.cols||r>=G.rows) return false;     // the world edge is clamped elsewhere
    const t=G.data[r][c]; return t===1||t===3;
  }
  // depth (px) the box sits inside rock / below a ramp surface; `own` = cells that belong to this body
  function depth(x,y,w,h,own){
    const G=MV_GRID, T=G.tile;
    let worst=0;
    const c0=Math.floor(x/T), c1=Math.floor((x+w-0.001)/T), r0=Math.floor(y/T), r1=Math.floor((y+h-0.001)/T);
    for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++){
      if(!rock(c,r)) continue;
      if(own&&own.has(c+','+r)) continue;
      const ox=Math.min(x+w,(c+1)*T)-Math.max(x,c*T), oy=Math.min(y+h,(r+1)*T)-Math.max(y,r*T);
      const d=Math.min(ox,oy); if(d>worst) worst=d;
    }
    // ramp surface under the feet
    if(typeof gridSlopeLive==='function'&&typeof gridSlopeY==='function'){
      const feet=y+h, row=Math.floor((feet-1)/T);
      for(const fx of [x+2,x+w/2,x+w-2]){
        const c=Math.floor(fx/T);
        if(row<0||c<0||c>=G.cols||row>=G.rows) continue;
        if(!gridSlopeLive(c,row)) continue;
        const sy=gridSlopeY(c,row,fx);
        if(sy!=null&&feet>sy){ const d=feet-sy; if(d>worst) worst=d; }
      }
    }
    return worst;
  }
  const ownOf=(bw)=>{
    if(!bw||typeof _gridBwallHomeCells!=='function'||bw.homeCol==null&&bw.homeX==null) return null;
    const s=new Set(); for(const q of _gridBwallHomeCells(bw)) s.add(q[0]+','+q[1]); return s;
  };

  // which bodies the net covers, and the box each one really occupies
  function boxOf(o,kind){
    if(kind==='bw') return {x:o.x+1,y:o.y+1,w:o.w-2,h:o.h-2};
    if(o.mind) return {x:o.x+(o.w-20)/2,y:o.y+4,w:20,h:FEET_OFF-6};     // a rival sibling stands on the hero's wheel
    return {x:o.x+1,y:o.y+1,w:Math.max(4,(o.w||30)-2),h:Math.max(4,(o.h||30)-2)};
  }
  const roped=new Set();
  function collect(){
    const out=[]; roped.clear();
    for(const r of (B.ropes||[])) if(r&&r.e) roped.add(r.e);
    if(typeof ENEMS!=='undefined') for(const e of ENEMS){
      if(!e||e._hidden||e._gone||e._permOff||e._betaHeld||!isFinite(e.x)||!isFinite(e.y)) continue;
      if(e.alive===false&&!e._downed&&!e._mindOff) continue;
      if(e.y>MV_GRID.rows*MV_GRID.tile) continue;
      out.push({o:e,kind:'e'});
    }
    if(typeof BWALLS!=='undefined') for(const bw of BWALLS){
      if(!bw||!(bw.hp>0)||bw._carried||bw._magStuck) continue;
      if(!(bw._fly||bw._pb||bw.movable&&(bw._awake||bw.vx||bw.vy))) continue;      // a block resting in its own cell is the terrain
      if(!isFinite(bw.x)||!isFinite(bw.y)) continue;
      out.push({o:bw,kind:'bw'});
    }
    return out;
  }

  // largest fraction t in [0,1] of the move a->b that stays out of rock (sampled; a is clear)
  function clampMove(bx,w,h,ax,ay,bxx,byy,own){
    const dx=bxx-ax, dy=byy-ay, dist=Math.max(Math.abs(dx),Math.abs(dy));
    if(dist<=0) return 1;
    const n=Math.max(1,Math.ceil(dist/STEP));
    let last=0;
    for(let i=1;i<=n;i++){
      const t=i/n;
      if(depth(ax+dx*t,ay+dy*t,w,h,own)>TOL) break;
      last=t;
    }
    if(last<1&&last>0){                         // refine the last step to the pixel
      let lo=last, hi=Math.min(1,last+1/n);
      for(let k=0;k<5;k++){ const m=(lo+hi)/2; if(depth(ax+dx*m,ay+dy*m,w,h,own)>TOL) hi=m; else lo=m; }
      last=lo;
    }
    return last;
  }

  // the way out must be a way OUT: once the box is clear on the path it must stay clear (never hop a wall to the far side)
  function exits(x,y,nx,ny,w,h,own){
    const n=Math.max(1,Math.ceil(Math.max(Math.abs(nx-x),Math.abs(ny-y))/STEP));
    let clear=false;
    for(let i=1;i<=n;i++){
      const d=depth(x+(nx-x)*i/n,y+(ny-y)*i/n,w,h,own);
      if(d<=TOL) clear=true; else if(clear) return false;
    }
    return true;
  }
  // nearest rock-free spot around (x,y): up first (a body lifted off a floor), then sideways, then down
  function freeSpot(x,y,w,h,own,pref){
    const T=MV_GRID.tile;
    const dirs=[];
    if(pref&&(pref.x||pref.y)){ const l=Math.hypot(pref.x,pref.y)||1; dirs.push([-pref.x/l,-pref.y/l]); }
    dirs.push([0,-1],[-1,0],[1,0],[0,1],[-0.7,-0.7],[0.7,-0.7],[-0.7,0.7],[0.7,0.7]);
    for(let rad=2;rad<=T*6;rad+=(rad<T*2?2:4)){   // a big foe (the 112px boss) can be buried by a block that settled onto it
      for(const d of dirs){
        const nx=x+d[0]*rad, ny=y+d[1]*rad;
        if(depth(nx,ny,w,h,own)<=TOL&&exits(x,y,nx,ny,w,h,own)) return {x:nx,y:ny};
      }
    }
    return null;
  }

  function fix(o,kind,bx,own,safe){
    const w=bx.w, h=bx.h, offX=bx.x-o.x, offY=bx.y-o.y;
    const nowX=bx.x, nowY=bx.y;
    let rx=nowX, ry=nowY, why=null;
    const here=depth(nowX,nowY,w,h,own);
    if(safe&&Math.hypot(nowX-safe.x,nowY-safe.y)<=MAXSEG&&depth(safe.x,safe.y,w,h,own)<=TOL){
      // sweep from the last clear spot; stop where rock starts, then slide along it with what is left
      const t=clampMove(null,w,h,safe.x,safe.y,nowX,nowY,own);
      if(t<1||here>TOL){
        const cx=safe.x+(nowX-safe.x)*t, cy=safe.y+(nowY-safe.y)*t;
        let sx=cx, sy=cy;
        const remX=(nowX-cx), remY=(nowY-cy);
        if(Math.abs(remX)>0.01){ const tx=clampMove(null,w,h,sx,sy,sx+remX,sy,own); sx+=remX*tx; if(tx<1) o.vx=0; }
        if(Math.abs(remY)>0.01){ const ty=clampMove(null,w,h,sx,sy,sx,sy+remY,own); sy+=remY*ty; if(ty<1){ if(remY>0){ o.og=true; } o.vy=0; } }
        rx=sx; ry=sy; why='swept';
        if(t<1){ if(Math.abs(nowX-safe.x)>=Math.abs(nowY-safe.y)) { if(Math.abs(o.vx||0)>0.01&&Math.abs(remX)<=0.01) o.vx=0; } else { if(remY>0) o.og=true; if(Math.abs(remY)<=0.01) o.vy=0; } }
      }
    }
    if(depth(rx,ry,w,h,own)>TOL){
      const sp=freeSpot(rx,ry,w,h,own,{x:o.vx||0,y:o.vy||0});
      if(sp){ rx=sp.x; ry=sp.y; why='depen'; if(sp.y<nowY){ o.vy=Math.min(o.vy||0,0); o.og=true; } }
      else { stats.stuck++; return false; }
    }
    o.x=rx-offX; o.y=ry-offY;
    stats.fixed++; stats[why==='swept'?'swept':'depen']++; stats.last={kind,why,from:[Math.round(nowX),Math.round(nowY)],to:[Math.round(rx),Math.round(ry)],t:(typeof fr!=='undefined'?fr:0)};
    if(kind==='bw'&&typeof gridSyncBwallOccupancy==='function'){ try{ if(!o._fly&&!o._pb) gridSyncBwallOccupancy(o); }catch(e){} }
    return true;
  }

  function guard(){
    if(!ready()) return;
    for(const it of collect()){
      const o=it.o, kind=it.kind;
      const bx=boxOf(o,kind);
      const own=kind==='bw'?ownOf(o):null;
      let r=rec.get(o);
      const roping=roped.has(o);
      const here=depth(bx.x,bx.y,bx.w,bx.h,own);
      if(!r){ r={sx:bx.x,sy:bx.y,ok:here<=TOL}; rec.set(o,r); if(here<=TOL) continue; }
      const far=Math.hypot(bx.x-r.sx,bx.y-r.sy)>MAXSEG;
      const safe=(r.ok&&!far)?{x:r.sx,y:r.sy}:null;
      let bad=here>TOL;
      if(!bad&&safe&&!roping){                      // clear at both ends: did it pass THROUGH rock between them?
        const dx=bx.x-safe.x, dy=bx.y-safe.y;
        if(Math.max(Math.abs(dx),Math.abs(dy))>STEP){
          const t=clampMove(null,bx.w,bx.h,safe.x,safe.y,bx.x,bx.y,own);
          if(t<1) bad=true;
        }
      }
      if(bad){
        if(!fix(o,kind,bx,own,safe)){ r.ok=false; continue; }
        const nb=boxOf(o,kind); r.sx=nb.x; r.sy=nb.y; r.ok=depth(nb.x,nb.y,nb.w,nb.h,own)<=TOL;
      }else{ r.sx=bx.x; r.sy=bx.y; r.ok=true; }
    }
  }
  // The heroes keep their own finer collision (a 40px wheel squeezes a 32px gap on purpose). The net for them
  // asks the ENGINE'S own overlap test: after the frame, a hero inside rock goes back along his motion.
  const prec=new WeakMap();
  const heroHit=(pl,x,y)=>{ const ox=pl.x, oy=pl.y; pl.x=x; pl.y=y; let r=false; try{ r=gridOverlaps(gridPlayerBody(pl)); }catch(e){} pl.x=ox; pl.y=oy; return r; };
  function guardHero(pl){
    if(!pl||typeof gridOverlaps!=='function'||typeof gridPlayerBody!=='function'||!isFinite(pl.x)||!isFinite(pl.y)) return;
    let r=prec.get(pl);
    const bad=heroHit(pl,pl.x,pl.y);
    if(!r){ r={x:pl.x,y:pl.y,ok:!bad}; prec.set(pl,r); return; }
    if(!bad){ r.x=pl.x; r.y=pl.y; r.ok=true; return; }
    const far=Math.hypot(pl.x-r.x,pl.y-r.y)>MAXSEG;
    let nx=null, ny=null;
    if(r.ok&&!far&&!heroHit(pl,r.x,r.y)){
      let lo=0, hi=1;                                     // furthest point along the motion that is still clear
      for(let k=0;k<9;k++){ const m=(lo+hi)/2; if(heroHit(pl,r.x+(pl.x-r.x)*m,r.y+(pl.y-r.y)*m)) hi=m; else lo=m; }
      nx=r.x+(pl.x-r.x)*lo; ny=r.y+(pl.y-r.y)*lo;
    }else{                                                // no clear past: nearest clear spot, up first
      const dirs=[[0,-1],[-1,0],[1,0],[0,1],[-0.7,-0.7],[0.7,-0.7]];
      outer: for(let rad=2;rad<=96;rad+=2) for(const d of dirs){ const tx=pl.x+d[0]*rad, ty=pl.y+d[1]*rad; if(!heroHit(pl,tx,ty)){ nx=tx; ny=ty; break outer; } }
    }
    if(nx==null){ stats.stuck++; r.ok=false; return; }
    if(Math.abs(nx-pl.x)>0.01) pl.vx=0;
    if(Math.abs(ny-pl.y)>0.01){ if(ny<pl.y) pl.og=true; pl.vy=0; }
    pl.x=nx; pl.y=ny; stats.fixed++; stats.depen++; stats.last={kind:'hero',from:[Math.round(r.x),Math.round(r.y)],to:[Math.round(nx),Math.round(ny)]};
    r.x=nx; r.y=ny; r.ok=true;
  }
  B.tunnelGuard=function(){ guard(); guardHero(p); if(typeof p2!=='undefined'&&p2) guardHero(p2); };

  const _up=window.update;
  window.update=function(){
    const r=_up.apply(this,arguments);
    try{ if(on()&&!B.freeze) B.tunnelGuard(); }catch(er){ console.warn('tunnel',er); }
    return r;
  };
})();
