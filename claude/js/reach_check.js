// ============================================================
//  Mind & Venture — reach_check.js   (physics referee)
//
//  "Can MIND actually beat this level?"
//
//  Works on whatever map is loaded into the typed grid (MV_GRID):
//  live Awdjoo today, generated levels later. It does NOT keep its own
//  copy of the physics. Every simulated frame goes through the game's own
//  gridResolvePlayer(), with the jump / gravity / air-control formulas
//  copied line-for-line from main.js + _updatePlayerMoveX, and the numbers
//  read live from physics.js (GRAV, JI, JHH, JMH, JMX, MOVE_*, CMAX ...).
//  Retune a knob and the referee retunes with it.
//
//  Moves it tries from every place MIND can stand:
//    walk / step up / roll off a ledge
//    jumps: takeoff speed (only if there is run-up room), hold length,
//           air steering, duck super-jump
//    wall jumps (chained, so shafts can be climbed)
//    RCA hook (only after the RCA is picked up): latch, reel, swing, release
//
//  Honest limits (v1):
//    - Walk / jump / wall jump are frame-exact to the game formulas.
//      The RCA swing is an energy model (pendulum + reel + jump-release
//      boost), not a frame replay of _ropeApplyTension.
//    - Moving platforms, crates, enemies, XLR/MAG pushes are ignored.
//    - Breakable cells (DESTRUCT) are treated as open by default because
//      MIND can always punch. Pass {breakDestruct:false} to treat them as walls.
//
//  Gated: nothing runs on load. Call MV_REACH.check() after the map is
//  ready, or run `npm run reachcheck` (headless, writes test-results/).
// ============================================================
(function(){
  'use strict';

  // ── Live physics snapshot (falls back to brief numbers) ─────────
  function K(){
    return {
      GRAV:      typeof GRAV!=='undefined'?GRAV:0.52,
      AIR_DRIFT: typeof AIR_DRIFT!=='undefined'?AIR_DRIFT:0.96,
      JI:        typeof JI!=='undefined'?JI:-3.0,
      JHH:       typeof JHH!=='undefined'?JHH:0.40,
      JMH:       typeof JMH!=='undefined'?JMH:22,
      JMX:       typeof JMX!=='undefined'?JMX:-11.0,
      WALK:      typeof MOVE_WALK!=='undefined'?MOVE_WALK:10.5,
      RUN:       typeof MOVE_RUN!=='undefined'?MOVE_RUN:12.4,
      PEAK:      typeof MOVE_PEAK!=='undefined'?MOVE_PEAK:1.0,
      ACCEL:     typeof MOVE_ACCEL!=='undefined'?MOVE_ACCEL:0.40,
      RUN_ACCEL: typeof MOVE_RUN_ACCEL!=='undefined'?MOVE_RUN_ACCEL:0.46,
      POWER:     typeof MOVE_POWER!=='undefined'?MOVE_POWER:0.020,
      TURN:      typeof MOVE_TURN!=='undefined'?MOVE_TURN:1.45,
      RUN_RAMP:  typeof MOVE_RUN_RAMP!=='undefined'?MOVE_RUN_RAMP:0.05,
      SW:        typeof SW!=='undefined'?SW:64,
      FEET_OFF:  typeof FEET_OFF!=='undefined'?FEET_OFF:88,
      STAND_H:   typeof STAND_H!=='undefined'?STAND_H:70,
      WHEEL_R:   typeof WHEEL_R!=='undefined'?WHEEL_R:20,
      BODY_W:    typeof BODY_W!=='undefined'?BODY_W:52,
      BODY_H:    typeof BODY_H!=='undefined'?BODY_H:42,
      CMAX:      typeof CMAX!=='undefined'?CMAX:400,
      ROPE_MIN:  typeof ROPE_RL_MIN!=='undefined'?ROPE_RL_MIN:28,
      WW:        typeof WW!=='undefined'?WW:1e9
    };
  }

  const DEFAULTS={
    breakDestruct:true,
    takeoffSpeeds:[0,5,'walk','run'],   // 'walk'/'run' resolve to MOVE_WALK / MOVE_RUN
    holds:[4,10,'max'],                 // jump-button hold frames (4 ≈ a quick tap, 'max' = JMH)
    duckJump:true,
    wallJumps:6,                        // max chained wall jumps per attempt
    hook:true,
    respawnOnFall:true,                 // Awdjoo puts you back at the spawn if you fall out
    hookAngles:15,                      // rays fanned over the upper half circle
    swingMaxDeg:75,                     // pumping can reach this amplitude
    swingStepDeg:25,
    maxAirFrames:320,
    timeBudgetMs:420000
  };

  // ── Small helpers ───────────────────────────────────────────────
  const tile=()=>MV_GRID.tile;
  function coreRect(k, cx, feet){
    // playerCoreHB, standing (crouchAmt 0)
    return {x:cx-k.BODY_W/2, y:feet-k.STAND_H-k.WHEEL_R+10, w:k.BODY_W, h:k.BODY_H};
  }
  function ov(a,b){ return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y; }
  function mkPl(k, cx, feet, vx, vy, og){
    return {x:cx-k.SW/2, y:feet-k.FEET_OFF, vx:vx||0, vy:vy||0, og:!!og,
      crouchAmt:0, jf:0, runRamp:0, _slopeAngle:0, hook:{st:'idle'}, wallGrip:0};
  }
  const cxOf=(k,pl)=>pl.x+k.SW/2;
  const feetOf=(k,pl)=>pl.y+k.FEET_OFF;

  // Same test as _wallTouchInfo (grid branch): core box ±2px, mid height.
  function wallTouch(k, pl){
    const c=coreRect(k, cxOf(k,pl), feetOf(k,pl));
    const t=tile(), row=Math.floor((c.y+c.h*0.5)/t);
    let dir=0;
    if(gridSolid(Math.floor((c.x-2)/t),row)) dir=-1;
    if(gridSolid(Math.floor((c.x+c.w+1)/t),row)) dir=1;
    return dir;
  }

  // Horizontal input step — mirrors _updatePlayerMoveX (no sprint in air).
  function stepMoveX(k, s, dir, grounded){
    if(!dir){
      s.mp=Math.max(0,s.mp-0.08); if(s.mp<=0) s.md=0;
      if(grounded){ s.vx*=0.91; if(Math.abs(s.vx)<0.10) s.vx=0; }
      else{ s.vx*=k.AIR_DRIFT; if(Math.abs(s.vx)<0.12) s.vx=0; }
      return;
    }
    if(s.md!==dir){ s.md=dir; s.mp*=0.70; s.vx*=0.86; }
    s.mp=Math.min(1,s.mp+k.POWER);
    const spinEase=0.34+0.66*Math.min(1,s.mp);
    let cap=k.WALK*k.PEAK*spinEase;
    if(s.sprint&&grounded){ s.rr=Math.min(1,s.rr+k.RUN_RAMP); cap+= (k.RUN-k.WALK)*s.rr; }
    if(!grounded) cap=Math.max(cap,Math.abs(s.vx));
    let accel=(s.sprint&&grounded)?k.RUN_ACCEL:k.ACCEL;
    if(cap>0.05){ const r=Math.min(1,Math.abs(s.vx)/cap); accel*=Math.max(0.30,1-0.50*r*r); }
    const vSign=s.vx>0.15?1:(s.vx<-0.15?-1:0);
    s.vx+=dir*accel*(vSign===-dir?k.TURN:1);
    s.vx=dir>0?Math.min(s.vx,cap):Math.max(s.vx,-cap);
  }

  // Ground distance needed to reach a takeoff speed from rest.
  function runUpFor(k, speed){
    if(speed<=0.01) return 0;
    const s={vx:0,mp:0,md:0,rr:0,sprint:speed>k.WALK+0.01};
    let x=0;
    for(let f=0;f<400;f++){ stepMoveX(k,s,1,true); x+=s.vx; if(s.vx>=speed-0.05) return x; }
    return Infinity;
  }
  // movePower that matches cruising at `speed` (so air steering starts right).
  function mpFor(k, speed){
    return Math.max(0,Math.min(1,(Math.abs(speed)/(k.WALK*k.PEAK)-0.34)/0.66));
  }

  // ── The referee ────────────────────────────────────────────────
  function check(userOpts){
    if(typeof _gridReady!=='function'||!_gridReady()) return {ok:false, error:'grid not ready'};
    const o=Object.assign({}, DEFAULTS, userOpts||{});
    const k=K();
    const t=tile();
    const T0=performance.now();
    const overBudget=()=>performance.now()-T0>o.timeBudgetMs;

    // Breakables open (MIND can punch), restored before returning.
    const savedData=MV_GRID.data;
    if(o.breakDestruct){
      MV_GRID.data=savedData.map(row=>row.slice());
      _forEachCell((c,r,v)=>{ if(v===MV_GRID_DESTRUCT) gridSet(c,r,MV_GRID_AIR); });
    }

    try{
      return _run(o,k,t,T0,overBudget);
    }finally{
      MV_GRID.data=savedData;
    }
  }

  function _forEachCell(fn){
    for(let r=0;r<MV_GRID.rows;r++) for(let c=0;c<MV_GRID.cols;c++) fn(c,r,gridCell(c,r));
  }

  function _run(o,k,t,T0,overBudget){
    const speeds=o.takeoffSpeeds.map(v=>v==='walk'?k.WALK:v==='run'?k.RUN:v);
    const holds=o.holds.map(v=>v==='max'?k.JMH:v);
    const runUp=speeds.map(v=>runUpFor(k,v));
    const stats={sims:0, frames:0, hookAnchors:0, embedded:0, budgetHit:false};

    // ── Targets: RCA, knowls, exit ──────────────────────────────
    const targets=[];
    if(typeof _mapRopePickup!=='undefined'&&_mapRopePickup){
      const r=_mapRopePickup;
      targets.push({kind:'rca', rect:{x:r.x+2,y:r.y+2,w:r.w-4,h:r.h-4}, pad:4, x:r.x+r.w/2, y:r.y+r.h/2});
    }
    (typeof KDROP!=='undefined'?KDROP:[]).forEach((kn,i)=>{
      const kx=kn.ox!=null?kn.ox:kn.x, ky=kn.oy!=null?kn.oy:kn.y;
      targets.push({kind:'knowl', i, rect:{x:kx-8,y:ky-8,w:16,h:16}, padX:6, x:kx, y:ky});
    });
    if(typeof _goalRect==='function'){
      const g=_goalRect();
      if(g&&g.x>-900) targets.push({kind:'goal', rect:g, pad:0, x:g.x+g.w/2, y:null});
    }
    // Pickups test playerCoreHB. MIND can duck on the ground or in the air,
    // which slides the core down to the wheel, so use stand ∪ duck.
    function touchesAt(cx, feet, into){
      const st=coreRect(k,cx,feet);
      const duckTop=feet-k.WHEEL_R+k.WHEEL_R*0.5-k.BODY_H;
      const c={x:st.x, y:st.y, w:st.w, h:(duckTop+k.BODY_H)-st.y};
      for(let i=0;i<targets.length;i++){
        const tg=targets[i];
        const px=tg.padX!=null?tg.padX:(tg.pad||0), py=tg.padX!=null?0:(tg.pad||0);
        if(ov({x:c.x-px,y:c.y-py,w:c.w+px*2,h:c.h+py*2}, tg.rect)) into.add(i);
      }
    }

    // ── Nodes: every place the wheel can rest ──────────────────
    const nodes=[], byCol=new Map(), spawnRef={node:null};
    function addNode(c, feet, kind, x){
      let list=byCol.get(c); if(!list){ list=[]; byCol.set(c,list); }
      for(const n of list) if(Math.abs(n.feet-feet)<=12) return n;
      const n={id:nodes.length, c, x:x!=null?x:(c+0.5)*t, feet:Math.round(feet*10)/10, kind, edges:null, hookEdges:null, touch:new Set()};
      touchesAt(n.x, n.feet, n.touch);
      nodes.push(n); list.push(n);
      return n;
    }
    function nodeNear(cx, feet){
      const c=Math.floor(cx/t);
      let best=null, bd=1e9;
      for(const dc of [0,-1,1]){
        for(const n of (byCol.get(c+dc)||[])){
          const d=Math.abs(n.feet-feet)+Math.abs(n.x-cx)*0.25;
          if(Math.abs(n.feet-feet)<=14&&d<bd){ bd=d; best=n; }
        }
        if(best) return best;
      }
      return null;
    }
    function bodyFree(cx, feet){
      const b=gridPlayerBody(mkPl(k,cx,feet,0,0,true));
      return !gridOverlaps(b);
    }
    // Resolver can leave the wheel a few px into a ramp; lift it like depenetrate would.
    function freeFeet(cx, feet){
      for(const dy of [0,1,2,3,4,6,8]) if(bodyFree(cx,feet-dy)) return feet-dy;
      return null;
    }
    for(let c=0;c<MV_GRID.cols;c++){
      const cx=(c+0.5)*t;
      for(let r=1;r<MV_GRID.rows;r++){
        const v=gridCell(c,r);
        let feet=null, kind=null;
        if(gridSlopeLive(c,r)){ feet=gridSlopeY(c,r,cx); kind='slope'; }
        else if((v===MV_GRID_SOLID||v===MV_GRID_ONEWAY||v===MV_GRID_DESTRUCT)&&!gridSolid(c,r-1)&&!gridIsSlope(c,r-1)){
          if(_gridIsRampFill(c,r,cx,r*t)) continue;
          feet=r*t; kind=v===MV_GRID_ONEWAY?'oneway':'floor';
        }
        if(feet==null) continue;
        if(!bodyFree(cx,feet)) continue;
        addNode(c,feet,kind);
      }
    }
    const enumerated=nodes.length;

    // ── One simulated attempt (frame loop) ──────────────────────
    // start: {cx,feet,vx,vy,jf,hold,airDir,mp,md}
    // Pushes {to, touch[]} into `out` for the landing, plus every landing
    // reachable by wall-jumping off a wall touched on the way.
    function fly(start, out){
      stats.sims++;
      const pl=mkPl(k,start.cx,start.feet,start.vx,start.vy,false);
      pl.jf=start.jf||0;
      const mv={vx:start.vx, mp:start.mp||0, md:start.md||0, rr:0, sprint:false};
      const touched=new Set();
      let held=start.hold||0, airF=0, stuck=0, landed=null, fellOut=false;
      const walls=new Set();
      for(let f=0; f<o.maxAirFrames; f++){
        stats.frames++;
        // horizontal (before jump in main.js)
        mv.vx=pl.vx; stepMoveX(k,mv,start.airDir||0,false); pl.vx=mv.vx;
        // jump hold
        const holding=held>0;
        if(holding&&pl.jf>0){ pl.vy=Math.max(pl.vy-k.JHH,k.JMX); pl.jf--; }
        else if(!holding) pl.jf=0;
        if(held>0) held--;
        // gravity
        pl.vy=Math.min(pl.vy+((holding&&pl.jf>0&&pl.vy<0)?k.GRAV*0.38:k.GRAV),14);
        const x0=pl.x, y0=pl.y;
        gridResolvePlayer(pl, pl.vx, pl.vy, {});
        if(pl.x<0){pl.x=0;pl.vx=0;}
        if(pl.x>k.WW-k.SW){pl.x=k.WW-k.SW;pl.vx=0;}
        airF++;
        const cx=cxOf(k,pl), feet=feetOf(k,pl);
        touchesAt(cx,feet,touched);
        if(feet>MV_GRID.rows*t+64){ fellOut=true; break; }
        if(pl.og&&pl.vy>=0&&airF>1){
          // A landing that leaves the body inside rock is a resolver artifact, not a place.
          const ff=freeFeet(cx,feet);
          if(ff!=null) landed={cx,feet:ff};
          else stats.embedded++;
          break;
        }
        if(Math.abs(pl.x-x0)<0.01&&Math.abs(pl.y-y0)<0.01){ if(++stuck>20) break; } else stuck=0;
        // Wall jump: jump pressed while the core box touches a wall in the air.
        // Each wall spot is its own graph node, so chained wall jumps are
        // just more edges — no recursion, no blow-up.
        if(o.wallJumps&&airF>=4&&pl.vy>-3){
          const wd=wallTouch(k,pl);
          if(wd){
            const w=wallNode(cx,feet,wd);
            if(!walls.has(w.id)){ walls.add(w.id); out.push({to:w.id, touch:[...touched], wj:true}); }
          }
        }
        if((stats.frames&4095)===0&&overBudget()) break;
      }
      if(landed){
        const n=nodeNear(landed.cx, landed.feet)||addNode(Math.floor(landed.cx/t), landed.feet, 'landing', landed.cx);
        out.push({to:n.id, touch:[...touched]});
      }else if(fellOut&&o.respawnOnFall&&spawnRef.node){
        out.push({to:spawnRef.node.id, touch:[...touched], respawn:true});
      }
    }
    // Wall-cling spots: col × 16px band × side.
    const wallIdx=new Map();
    function wallNode(cx, feet, wd){
      const key=Math.floor(cx/t)+':'+Math.floor(feet/16)+':'+wd;
      let n=wallIdx.get(key);
      if(!n){
        n={id:nodes.length, c:Math.floor(cx/t), x:cx, feet, wd, kind:'wall', edges:null, hookEdges:null, touch:new Set()};
        touchesAt(cx,feet,n.touch);
        nodes.push(n); wallIdx.set(key,n);
      }
      return n;
    }
    function wallJumpEdges(n){
      const out=[];
      for(const air of [n.wd,0,-n.wd]){
        fly({cx:n.x, feet:n.feet, vx:-n.wd*k.WALK, vy:k.JI, jf:k.JMH, hold:k.JMH, airDir:air, mp:1, md:-n.wd}, out);
      }
      return out;
    }

    // ── Ground roll to the next column (walk, step, roll off) ──
    function walkFrom(n, dir){
      const pl=mkPl(k,n.x,n.feet,0,0,true);
      const mv={vx:0, mp:0, md:0, rr:0, sprint:false};
      const targetX=n.x+dir*t;
      const touched=new Set();
      for(let f=0;f<160;f++){
        stats.frames++;
        mv.vx=pl.vx; stepMoveX(k,mv,dir,pl.og); pl.vx=mv.vx;
        if(pl.og&&pl.vy>=0) pl.vy=0; else pl.vy=Math.min(pl.vy+k.GRAV,14);
        const x0=pl.x;
        gridResolvePlayer(pl, pl.vx, pl.vy, {});
        const cx=cxOf(k,pl), feet=feetOf(k,pl);
        touchesAt(cx,feet,touched);
        if(!pl.og){
          // rolled off a ledge — hand over to the air sim
          const out=[];
          fly({cx, feet, vx:pl.vx, vy:pl.vy, hold:0, airDir:dir, mp:mv.mp, md:dir}, out);
          out.forEach(e=>{ touched.forEach(x=>e.touch.push(x)); });
          return out;
        }
        if((dir>0&&cx>=targetX)||(dir<0&&cx<=targetX)){
          const ff=freeFeet(cx,feet);
          if(ff==null){ stats.embedded++; return []; }
          const m=nodeNear(cx,ff)||addNode(Math.floor(cx/t),ff,'landing',cx);
          return m.id===n.id?[]:[{to:m.id, touch:[...touched], walk:true, dy:ff-n.feet}];
        }
        if(Math.abs(pl.x-x0)<0.05&&f>20) return [];      // wall
      }
      return [];
    }

    // Wedge scan: hold a direction for 2s from a spot. If the wheel keeps getting
    // shoved backwards without a wall in front, that's a grid snag (CLAUDE.md:
    // "if the player wedges, fix the grid").
    function wedgeAt(n, dir){
      const pl=mkPl(k,n.x,n.feet,0,0,true);
      const mv={vx:0, mp:0, md:0, rr:0, sprint:false};
      let back=0, best=0;
      for(let f=0;f<120;f++){
        mv.vx=pl.vx; stepMoveX(k,mv,dir,pl.og); pl.vx=mv.vx;
        if(pl.og&&pl.vy>=0) pl.vy=0; else pl.vy=Math.min(pl.vy+k.GRAV,14);
        const x0=pl.x;
        gridResolvePlayer(pl, pl.vx, pl.vy, {});
        if((pl.x-x0)*dir<-0.5) back++;
        const prog=(cxOf(k,pl)-n.x)*dir;
        if(prog>best) best=prog;
        if(prog>t*1.5||feetOf(k,pl)>n.feet+t*2) return null;   // got through / dropped away
      }
      if(back<3||best>t*1.5) return null;
      if(wallTouch(k,pl)===dir) return null;                    // honest wall in front
      return {col:Math.floor(cxOf(k,pl)/t), row:Math.floor((feetOf(k,pl)-1)/t), x:Math.round(cxOf(k,pl)), feet:Math.round(feetOf(k,pl)), dir, pushedBack:back};
    }

    // Flat run-up room behind a node (follow walk edges the other way).
    const runMemo=new Map();
    function runRoom(n, dir){
      const key=n.id+':'+dir;
      if(runMemo.has(key)) return runMemo.get(key);
      let room=0, cur=n, guard=0;
      while(guard++<40){
        ensureGround(cur);
        const back=cur.walk[dir<0?1:0];          // walking the opposite way
        const e=back.find(e=>Math.abs(e.dy)<=6);
        if(!e) break;
        room+=t; cur=nodes[e.to];
        if(room>=runUp[runUp.length-1]) break;
      }
      runMemo.set(key,room);
      return room;
    }
    function ensureGround(n){
      if(!n.walk) n.walk=[walkFrom(n,-1), walkFrom(n,1)];
    }

    function groundEdges(n){
      if(n.edges) return n.edges;
      if(n.kind==='wall'){ n.edges=dedupe(wallJumpEdges(n)); return n.edges; }
      ensureGround(n);
      const out=[...n.walk[0], ...n.walk[1]];
      const jump=(vx0, hold, air, boost)=>{
        const dir=Math.sign(vx0)||air;
        fly({cx:n.x, feet:n.feet-0.01, vx:vx0, vy:boost?k.JI*2.05:k.JI, jf:boost?k.JMH+10:k.JMH,
             hold, airDir:air, mp:mpFor(k,vx0), md:dir}, out);
      };
      speeds.forEach((sp,i)=>{
        for(const dir of sp>0?[-1,1]:[1]){
          if(sp>0&&runRoom(n,dir)+t*0.5<runUp[i]) continue;
          for(const hold of holds){
            const airs=sp>0?[dir,0,-dir]:[-1,0,1];
            for(const air of airs) jump(sp*dir, hold, air, false);
          }
        }
      });
      if(o.duckJump) for(const air of [-1,0,1]) jump(0, k.JMH+10, air, true);
      n.edges=dedupe(out);
      return n.edges;
    }
    // One edge per destination, union of touched targets.
    function dedupe(out, how){
      const m=new Map();
      for(const e of out){
        const cur=m.get(e.to);
        if(!cur) m.set(e.to,{to:e.to, touch:new Set(e.touch), how:how||(e.walk?'walk':e.respawn?'respawn':(e.wj?'wall':'jump'))});
        else e.touch.forEach(x=>cur.touch.add(x));
      }
      return [...m.values()];
    }

    // ── RCA hook: latch, reel, swing, release ───────────────────
    const swingCache=new Map();
    function hookEdges(n){
      if(n.hookEdges) return n.hookEdges;
      const out=[];
      const ox=n.x, oy=n.feet-k.STAND_H*0.45;
      for(let i=0;i<o.hookAngles;i++){
        const a=-Math.PI*(i+0.5)/o.hookAngles;               // upper half, left→right
        const hit=gridRayHit(ox,oy,ox+Math.cos(a)*k.CMAX,oy+Math.sin(a)*k.CMAX);
        if(!hit) continue;
        const ax=hit.tx+(hit.nx||0)*2, ay=hit.ty+(hit.ny||0)*2;
        const L0=Math.hypot(ax-ox,ay-oy);
        if(L0<12) continue;
        if(ay>=oy-4) continue;                               // floor/side below the shoulder: no swing
        const key=Math.floor(ax/8)+':'+Math.floor(ay/8)+':'+Math.round(L0/32);
        let res=swingCache.get(key);
        if(!res){
          res=swingFrom(ax,ay,L0,Math.atan2(ox-ax,oy-ay));
          swingCache.set(key,res);
          stats.hookAnchors++;
        }
        res.forEach(e=>out.push(e));
        if(overBudget()) break;
      }
      n.hookEdges=dedupe(out,'hook');
      return n.hookEdges;
    }
    // Pendulum around (ax,ay). Position on the rope = the shoulder point.
    function swingFrom(ax, ay, L0, theta0){
      const res=[];
      const lens=[...new Set([Math.min(k.CMAX,L0), Math.max(k.ROPE_MIN, Math.min(L0,140)), k.ROPE_MIN].map(Math.round))];
      const thMax=Math.max(Math.abs(theta0), o.swingMaxDeg*Math.PI/180);
      for(const L of lens){
        for(let deg=-o.swingMaxDeg; deg<=o.swingMaxDeg+0.1; deg+=o.swingStepDeg){
          const th=deg*Math.PI/180;
          const sx=ax+Math.sin(th)*L, sy=ay+Math.cos(th)*L;
          const feet=sy+k.STAND_H*0.45;
          if(!bodyFree(sx,feet)) continue;
          if(gridRayHit(ax,ay,sx,sy,{skipStart:true})) continue;  // rope blocked
          const v=Math.min(14, Math.sqrt(Math.max(0, 2*k.GRAV*L*(Math.cos(th)-Math.cos(thMax)))));
          const dirs=v>0.2?[1,-1]:[0];
          for(const sd of dirs){
            // tangential velocity, + jump-release boost toward the anchor
            let vx=Math.cos(th)*v*sd, vy=-Math.sin(th)*v*sd;
            const d=Math.hypot(ax-sx,ay-sy)||1;
            vx+=(ax-sx)/d*5.2; vy+=(ay-sy)/d*5.2;
            vy=Math.min(vy, k.JMX*0.85);
            const travel=Math.sign(vx)||1;
            for(const air of [travel,0]){
              fly({cx:sx, feet, vx, vy, hold:0, airDir:air, mp:mpFor(k,vx), md:Math.sign(vx)}, res);
            }
          }
          // plain drop (release without jump), only at the bottom of the swing
          if(Math.abs(deg)<1) fly({cx:sx, feet, vx:0, vy:0, hold:0, airDir:0}, res);
        }
      }
      return res;
    }

    // ── Search ───────────────────────────────────────────────────
    const spawnCx=(typeof _spawnX==='number'?_spawnX:0)+k.SW/2;
    const spawnFeet=(typeof _spawnY==='number'?_spawnY:0)+k.FEET_OFF;
    let spawn=nodeNear(spawnCx, spawnFeet);
    if(!spawn){
      const s=typeof gridStandY==='function'?gridStandY(spawnCx, spawnFeet, {maxUp:40,maxDrop:400}):null;
      spawn=s!=null?(nodeNear(spawnCx,s)||addNode(Math.floor(spawnCx/t),s,'spawn')):null;
    }
    if(!spawn) return {ok:false, error:'no standable spot under the spawn'};
    spawnRef.node=spawn;

    function bfs(seeds, withHook){
      const seen=new Set(seeds.map(n=>n.id));
      const touch=new Set(); const q=[...seeds];
      seeds.forEach(n=>n.touch.forEach(x=>touch.add(x)));
      while(q.length){
        const n=q.shift();
        const es=withHook?[...groundEdges(n),...hookEdges(n)]:groundEdges(n);
        for(const e of es){
          e.touch.forEach(x=>touch.add(x));
          if(!seen.has(e.to)){ seen.add(e.to); const m=nodes[e.to]; m.touch.forEach(x=>touch.add(x)); q.push(m); }
        }
        if(overBudget()){ stats.budgetHit=true; break; }
      }
      return {seen, touch};
    }

    const rcaIdx=targets.findIndex(x=>x.kind==='rca');
    const goalIdx=targets.findIndex(x=>x.kind==='goal');
    const phase0=bfs([spawn], false);
    let phase1={seen:new Set(), touch:new Set()};
    const rcaReached=rcaIdx>=0&&phase0.touch.has(rcaIdx);
    if(rcaReached&&o.hook){
      // Start the hook phase from every place that grabs the RCA.
      const seeds=[];
      for(const id of phase0.seen){
        const n=nodes[id];
        if(n.touch.has(rcaIdx)) { seeds.push(n); continue; }
        for(const e of groundEdges(n)) if(e.touch.has(rcaIdx)) seeds.push(nodes[e.to]);
      }
      phase1=bfs([...new Set(seeds)], true);
    }

    // Reverse search: from where can MIND still reach the exit?
    function canReachGoal(ids, withHook){
      const good=new Set();
      const all=[...ids];
      for(const id of all){
        const n=nodes[id];
        if(n.touch.has(goalIdx)) good.add(id);
        const es=withHook?[...(n.edges||[]),...(n.hookEdges||[])]:(n.edges||[]);
        if(es.some(e=>e.touch.has(goalIdx))) good.add(id);
      }
      let grew=true;
      while(grew){
        grew=false;
        for(const id of all){
          if(good.has(id)) continue;
          const n=nodes[id];
          const es=withHook?[...(n.edges||[]),...(n.hookEdges||[])]:(n.edges||[]);
          if(es.some(e=>good.has(e.to))){ good.add(id); grew=true; }
        }
      }
      return good;
    }
    const finalSet=phase1.seen.size?phase1.seen:phase0.seen;
    const goodAfter=goalIdx>=0?canReachGoal(finalSet, phase1.seen.size>0):new Set();
    const softlocks=[...finalSet].filter(id=>!goodAfter.has(id)&&nodes[id].kind!=='wall').map(id=>nodes[id]);
    // Before the RCA: a pit you can fall in that has no way back to the RCA.
    let preSoft=[];
    if(rcaIdx>=0&&rcaReached){
      const rcaOK=new Set();
      for(const id of phase0.seen){ const n=nodes[id]; if(n.touch.has(rcaIdx)||(n.edges||[]).some(e=>e.touch.has(rcaIdx))) rcaOK.add(id); }
      let grew=true;
      while(grew){ grew=false; for(const id of phase0.seen){ if(rcaOK.has(id)) continue; if((nodes[id].edges||[]).some(e=>rcaOK.has(e.to))){ rcaOK.add(id); grew=true; } } }
      preSoft=[...phase0.seen].filter(id=>!rcaOK.has(id)&&nodes[id].kind!=='wall').map(id=>nodes[id]);
    }
    // A spot before the RCA that can neither get back to the RCA nor finish without it
    // is a true softlock: there is no way forward at all.
    let preTrap=[];
    if(preSoft.length&&goalIdx>=0){
      const goodNoHook=canReachGoal(phase0.seen, false);
      preTrap=preSoft.filter(n=>!goodNoHook.has(n.id));
    }

    const preSoftIds=new Set(preSoft.map(n=>n.id)), preTrapIds=new Set(preTrap.map(n=>n.id));
    // Wedge scan over every place MIND can actually get to.
    const wedges=[];
    for(const id of new Set([...phase0.seen,...phase1.seen])){
      const n=nodes[id]; if(n.kind==='wall') continue;
      for(const dir of [-1,1]){
        const w=wedgeAt(n,dir); if(!w) continue;
        // one report per snag: merge stalls within 2 tiles heading the same way
        const near=wedges.find(o=>o.dir===dir&&Math.abs(o.col-w.col)<=2&&Math.abs(o.row-w.row)<=2);
        if(near){ near.hits=(near.hits||1)+1; continue; }
        w.hits=1; wedges.push(w);
      }
    }
    if(o.debug) window.MV_REACH._g={nodes, targets, groundEdges, hookEdges, phase0, phase1, spawn};
    // ── Report ──────────────────────────────────────────────────
    const tSummary=targets.map((tg,i)=>({
      kind:tg.kind, i:tg.i, x:Math.round(tg.x), y:tg.y==null?null:Math.round(tg.y),
      col:Math.floor(tg.x/t), row:tg.y==null?null:Math.floor(tg.y/t),
      reach:phase0.touch.has(i)?'no-items':(phase1.touch.has(i)?'needs-RCA':'unreachable')
    }));
    const knowls=tSummary.filter(x=>x.kind==='knowl');
    const goal=tSummary.find(x=>x.kind==='goal');
    const allKnowls=knowls.every(x=>x.reach!=='unreachable');
    const goalOK=!!goal&&goal.reach!=='unreachable';
    const gateOpens=knowls.length>0||(typeof goalOpen!=='undefined'&&goalOpen);
    const beatable=allKnowls&&goalOK&&gateOpens&&(rcaIdx<0||rcaReached);
    const ground=id=>nodes[id].kind!=='wall';
    const reachedAll=new Set([...phase0.seen,...phase1.seen].filter(ground));
    const where=n=>({col:n.c, row:Math.floor((n.feet-1)/t), x:Math.round(n.x), feet:Math.round(n.feet)});
    const problems=[];
    if(rcaIdx>=0&&!rcaReached) problems.push('RCA cannot be reached from the spawn');
    knowls.filter(x=>x.reach==='unreachable').forEach(x=>problems.push('Knowl '+x.i+' unreachable (col '+x.col+', row '+x.row+')'));
    if(!goalOK) problems.push('Exit cannot be reached');
    // weapons.js only sets goalOpen when the last Knowl is picked up.
    if(goal&&!knowls.length&&!(typeof goalOpen!=='undefined'&&goalOpen))
      problems.push('Map has 0 Knowls — goalOpen is only set by the last Knowl pickup, so the exit gate never opens');
    if(softlocks.length) problems.push(softlocks.length+' spot(s) MIND can get into but never get back to the exit from');
    const rcaNeeded=tSummary.some(x=>x.reach==='needs-RCA');
    if(preTrap.length) problems.push(preTrap.length+' spot(s) without the RCA that can neither get back to it nor reach the exit (true softlock)');
    else if(preSoft.length&&rcaNeeded) problems.push(preSoft.length+' spot(s) before the RCA with no way back to it — and something needs the RCA');
    const notes=[];
    if(preSoft.length&&!rcaNeeded&&!preTrap.length) notes.push(preSoft.length+' spot(s) can never get back to the RCA (fine today: nothing needs the RCA)');
    if(wedges.length) notes.push(wedges.length+' wedge spot(s): the wheel is shoved back with no wall in front');
    if(stats.budgetHit) problems.push('time budget hit — result is a lower bound');

    return {
      ok:true, beatable, problems, notes, rcaNeeded,
      ms:Math.round(performance.now()-T0),
      physics:{GRAV:k.GRAV, JI:k.JI, JHH:k.JHH, JMH:k.JMH, JMX:k.JMX, WALK:k.WALK, RUN:k.RUN, CMAX:k.CMAX,
        runUpPx:Object.fromEntries(speeds.map((s,i)=>[s,Math.round(runUp[i])])) },
      envelope:envelope(k),
      spawn:where(spawn),
      targets:tSummary,
      counts:{standSpots:enumerated, nodes:nodes.filter(n=>n.kind!=='wall').length, wallSpots:wallIdx.size,
        reachedNoItems:[...phase0.seen].filter(ground).length,
        reachedWithRCA:[...phase1.seen].filter(ground).length, reachedTotal:reachedAll.size,
        softlocks:softlocks.length, preRcaSoftlocks:preSoft.length, preRcaTraps:preTrap.length, wedges:wedges.length},
      softlocks:softlocks.slice(0,40).map(where),
      preRcaSoftlocks:preSoft.slice(0,40).map(where),
      preRcaTraps:preTrap.slice(0,40).map(where),
      wedges,
      stats,
      // for drawing
      _nodes:nodes.filter(n=>n.kind!=='wall').map(n=>({c:n.c, x:n.x, feet:n.feet, kind:n.kind,
        s:phase0.seen.has(n.id)?1:(phase1.seen.has(n.id)?2:0),
        lock:((finalSet.has(n.id)&&!goodAfter.has(n.id))||preTrapIds.has(n.id)||(rcaNeeded&&preSoftIds.has(n.id)))?1:0}))
    };
  }

  // ── Jump envelope on open flat ground (pure formulas, no grid) ──
  function envelope(k){
    const sim=(vx0, hold, boost)=>{
      let vy=boost?k.JI*2.05:k.JI, jf=boost?k.JMH+10:k.JMH, y=0, x=0, top=0, held=hold;
      const s={vx:vx0, mp:mpFor(k,vx0), md:Math.sign(vx0), rr:0, sprint:false};
      for(let f=0;f<400;f++){
        stepMoveX(k,s,Math.sign(vx0),false);
        const holding=held>0;
        if(holding&&jf>0){ vy=Math.max(vy-k.JHH,k.JMX); jf--; } else if(!holding) jf=0;
        if(held>0) held--;
        vy=Math.min(vy+((holding&&jf>0&&vy<0)?k.GRAV*0.38:k.GRAV),14);
        x+=s.vx; y+=vy; top=Math.min(top,y);
        if(y>=0&&f>1) break;
      }
      return {height:Math.round(-top), distance:Math.round(x)};
    };
    const tl=typeof MV_GRID!=='undefined'&&MV_GRID?MV_GRID.tile:32;
    const fmt=r=>({px:r, tiles:{h:+(r.height/tl).toFixed(1), d:+(r.distance/tl).toFixed(1)}});
    return {
      tapJump:fmt(sim(0,4,false)),
      fullJump:fmt(sim(0,k.JMH,false)),
      duckSuperJump:fmt(sim(0,k.JMH+10,true)),
      walkFullJump:fmt(sim(k.WALK,k.JMH,false)),
      runFullJump:fmt(sim(k.RUN,k.JMH,false)),
      hookReachPx:k.CMAX
    };
  }

  // ── Picture: grid + who can reach what ─────────────────────────
  function drawMap(res, opts){
    opts=opts||{};
    const px=opts.px||6, t=MV_GRID.tile;
    const cv=document.createElement('canvas');
    cv.width=Math.max(MV_GRID.cols*px,560); cv.height=MV_GRID.rows*px+58;
    const g=cv.getContext('2d');
    g.fillStyle='#14121c'; g.fillRect(0,0,cv.width,cv.height);
    for(let r=0;r<MV_GRID.rows;r++) for(let c=0;c<MV_GRID.cols;c++){
      const v=gridCell(c,r);
      if(v===MV_GRID_AIR) continue;
      g.fillStyle=v===MV_GRID_ONEWAY?'#6a6f80':v===MV_GRID_DESTRUCT?'#8a6a48':(v===MV_GRID_SLOPE_L||v===MV_GRID_SLOPE_R)?'#7f7aa0':'#4a4658';
      g.fillRect(c*px,r*px,px,px);
    }
    const col=['#e05050','#40d080','#f0a030'];
    for(const n of res._nodes){
      const y=(n.feet/t)*px;
      g.fillStyle=n.lock?'#c060ff':col[n.s];
      g.fillRect(n.c*px, y-px, px, px);
    }
    const mark=(x,y,c,lbl)=>{ g.fillStyle=c; g.beginPath(); g.arc(x/t*px,y/t*px,px*0.9,0,Math.PI*2); g.fill();
      if(lbl){ g.fillStyle='#fff'; g.font='bold '+Math.max(9,px*1.6)+'px monospace'; g.fillText(lbl,x/t*px+px,y/t*px-px); } };
    for(const tg of res.targets){
      if(tg.kind==='goal'){ g.fillStyle='rgba(80,160,255,0.35)'; g.fillRect(tg.col*px,0,px*2,MV_GRID.rows*px); continue; }
      mark(tg.x,tg.y, tg.kind==='rca'?'#e87820':'#66ffaa', tg.kind==='rca'?'RCA':'K'+tg.i);
    }
    for(const w of (res.wedges||[])){ g.strokeStyle='#ffe040'; g.lineWidth=2; g.strokeRect(w.col*px-px,(w.feet/t)*px-px*3,px*3,px*3); }
    mark(res.spawn.x,res.spawn.feet-40,'#ffffff','SPAWN');
    g.font='bold 12px monospace';
    const legend=[['#40d080','reach, no items'],['#f0a030','needs RCA'],['#e05050','never reached'],['#c060ff','dead end'],
                  ['#ffe040','wedge'],['#4fa0ff','exit'],['#8a6a48','breakable']];
    let lx=8, ly=MV_GRID.rows*px+20;
    for(const [c,l] of legend){
      const w=16+g.measureText(l).width+22;
      if(lx+w>cv.width){ lx=8; ly+=20; }
      g.fillStyle=c; g.fillRect(lx,ly-10,12,12); g.fillStyle='#ddd'; g.fillText(l,lx+16,ly); lx+=w;
    }
    return cv;
  }

  window.MV_REACH={ check, envelope:()=>envelope(K()), drawMap, DEFAULTS };
})();
