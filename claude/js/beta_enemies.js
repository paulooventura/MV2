// ============================================================
//  beta_enemies.js — the three enemies from Paulo's sketch (Oct 20)
//
//  None of them ever floats (Paulo, Oct 20): they live on the floor.
//  ENEMY A · CIRCLE (a sine wave on its face): ROLLS along the floor and turns
//          back at a ledge; in water it sinks and rolls along the bottom.
//  ENEMY B · TRIANGLE and C · SQUARE: move by falling onto their next side
//          (120° / 90° a step). Their range is only where there's floor under
//          them — they never step off a ledge. To get anywhere else they shoot
//          a rope: swing on it from a ceiling across a gap, or haul themselves
//          up / over to another floor. If they do fall (knocked off), they hurt
//          whatever they land on.
//  All three:
//   · can push like the XLR (a blast that shoves MIND away);
//   · heat up as MIND gets close — the body turns red gradually — and one
//     block away they go full red and explode into frags: circle 8 ways,
//     triangle from its 3 corners, square from its 4 corners (on the ground
//     the downward ones bounce up). Blowing up does NOT shut it down: it
//     cools off for a second (grey, steaming) and then carries on. Frags hurt
//     MIND and other enemies. (Punches, frags, water etc. can still shut it
//     down the usual way: 3-life cycle, knowls / the Knowl tree wake it.)
//   · square + triangle shoot a rope at MIND: it grabs him, then the AI
//     holds or reels him in — random, smarter on higher difficulty (hard
//     reels MIND into its own explosion). Mash jump or hit it to break free.
//  Difficulty: MV_BETA.difficulty 1 easy · 2 normal · 3 hard (Options).
//  Level field on Enemy entities: ai = circle | square | tri.
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B) return;
  const T=32;
  const DIFF=()=>B.difficulty||2;
  try{ const d=+localStorage.getItem('mv2.difficulty'); if(d>=1&&d<=3) B.difficulty=d; }catch(e){}
  if(!B.difficulty) B.difficulty=2;
  B.setDifficulty=function(d){ B.difficulty=Math.max(1,Math.min(3,d|0)); try{ localStorage.setItem('mv2.difficulty',B.difficulty); }catch(e){} };

  // sizes from Paulo's size chart (Oct 20), measured against an omni block
  // (1 block = 32 px) drawn next to them: A ≈ 0.9 block across, B ≈ 2 blocks
  // tall × 1.6 wide, C ≈ 2.5 blocks square
  const SIZE={circle:{w:30,h:30}, tri:{w:74,h:64}, square:{w:80,h:80}};   // the triangle is equilateral (h = w·√3/2)
  // Paulo (Oct 20): nothing happens to them from far away — they only start to
  // glow red within 3 blocks (full red and boom at 1), push from 2 blocks, and
  // the jacks only move an enemy that's within reach (MAX_ITEM_R from MIND).
  const HEAT_FAR=3*T, FUSE=34, PUSH_R=2*T, ROPE_R=6*T, COOL=60, MAX_ITEM_R=4.5*T;

  // ── creation (called by beta_level's Enemy entity) ──────────────
  B.mkAiEnemy=function(ai, cx, feet, opts){
    const s=SIZE[ai]||SIZE.square;
    const e={rank:'minion', mind:false, type:'b_'+ai, _ai:ai, _betaEnemy:ai, _awdjooKeep:true,
      x:Math.round(cx-s.w/2), y:Math.round(feet-s.h), w:s.w, h:s.h,
      mn:Math.round(cx-(opts.range||5*T)), mx:Math.round(cx+(opts.range||5*T)),
      hp:50, mhp:50, alive:true, hitF:0, vx:0, vy:0, og:true, dir:opts.dir||(Math.random()<0.5?-1:1),
      shotCd:0, grenades:[], shutF:0, _shutSettled:false,
      heat:0, fuse:0, pushCd:90+Math.random()*90|0, ropeCd:120, stepCd:30+Math.random()*40|0,
      tumble:null, ang:0, baseY:feet-s.h, phase:Math.random()*Math.PI*2, homeX:cx};
    e.og=false; e._falling=true; e.roll=0; e.travCd=60+Math.random()*90|0;
    e._iso=!!opts.iso;
    // awareness (Paulo, Oct 21): '!' when it spots MIND, '?' when it loses him; it searches, but stays near home
    e.aware=false; e.mark=null; e.look={x:e.dir*0.4,y:0}; e.lastSeen=null; e.searchT=0; e.lostT=0;
    e.leash=Math.max(8*T,(opts.range||5*T)*2);
    // no patrol box: the floor is its range. (The engine clamps x into mn..mx
    // on a hit — with a box, an enemy that had travelled snapped back home.)
    e.mn=-1e7; e.mx=1e7;                                       // wears an Isolator: water can't short it
    return e;
  };

  // Paulo (Oct 20): the dirt under a slope is solid to them too — they never sink into a hill
  function solidAt(x,y){
    if(typeof gridWorldSolid!=='function') return false;
    if(gridWorldSolid(x,y)) return true;
    const c=Math.floor(x/T), r=Math.floor(y/T);
    if(typeof gridIsSlope==='function'&&gridIsSlope(c,r)){ const sy=gridSlopeY(c,r,x); return sy!=null&&y>=sy; }
    return false;
  }
  // the top of the ground under x near `feet` (a slope's line, or a block's top)
  function groundTop(x,feet){
    const c=Math.floor(x/T);
    for(let r=Math.floor((feet-T)/T);r<=Math.floor((feet+T)/T);r++){
      if(gridIsSlope(c,r)){ const sy=gridSlopeY(c,r,x); if(sy!=null&&sy>=feet-T&&sy<=feet+T) return sy; }
      if(gridSolid(c,r)&&!gridSolid(c,r-1)&&!gridIsSlope(c,r-1)&&r*T>=feet-T) return r*T;
    }
    return null;
  }
  function floorSnap(e,feet){                   // feet onto the highest ground under its width
    let top=null;
    for(const x of [e.x+4,e.x+e.w/2,e.x+e.w-4]){ const g=groundTop(x,feet); if(g!=null&&(top==null||g<top)) top=g; }
    if(top==null){
      const x=e.x+e.w/2;
      for(let i=0;i<=6*T;i+=2){ if(!solidAt(x,feet-i)){ top=feet-i; break; } }
    }
    if(top==null) return e.y;
    const y=top-e.h;
    if(solidAt(e.x+e.w/2, y+e.h*0.42)) return e.y;
    return y;
  }
  function boxFree(x,y,w,h){                 // no solid cell inside the box (sampled every half tile)
    for(let yy=y+2;yy<y+h-1;yy+=T/2) for(let xx=x+2;xx<x+w-1;xx+=T/2){ if(solidAt(xx,yy)) return false; }
    if(solidAt(x+w-2,y+h-3)||solidAt(x+2,y+h-3)) return false;
    return true;
  }
  // moving platforms count as floor (enemies ride them like MIND does)
  function platUnder(x,w,feet){
    for(const pl of (B.platforms||[])){ if(feet>=pl.y-6&&feet<=pl.y+10&&x+w-6>pl.x&&x+6<pl.x+pl.w) return pl; }
    return null;
  }
  const floorUnder=(x,w,feet)=>solidAt(x+4,feet+4)||solidAt(x+w-4,feet+4)||solidAt(x+w/2,feet+4)||!!platUnder(x,w,feet);
  const wetAt=(x,y)=>!!(B.inWater&&B.inWater(x,y));
  // another story enemy (alive or a shut-down body) in the way: they're solid to each other
  function enemyIn(e,x,y,w,h){
    for(const o of ENEMS){ if(o===e||!o._ai||o._betaHeld) continue; if(x+w>o.x-1&&x<o.x+o.w+1&&y+h-2>o.y&&y+2<o.y+o.h) return o; }
    return null;
  }
  // floor right under one point (grid or a moving platform), within `slack` px
  function floorAtPoint(x,feet,slack){
    for(let d=0;d<=slack;d+=4){ if(solidAt(x,feet+4+d)) return true; }
    for(const pl of (B.platforms||[])) if(x>pl.x+2&&x<pl.x+pl.w-2&&feet>=pl.y-6&&feet<=pl.y+10) return true;
    return false;
  }
  function dropDepth(x,w,feet,max){ for(let d=0;d<max;d+=T/2){ if(floorUnder(x,w,feet+d)) return d; } return Infinity; }
  function center(e){ return {x:e.x+e.w/2, y:e.y+e.h/2}; }
  function mindCenter(){ const h=playerCoreHB(p); return {x:h.x+h.w/2, y:h.y+h.h/2, hb:h}; }
  function gapTo(e){                          // box-to-box gap to MIND, in px
    const h=playerCoreHB(p), feet=p.y+FEET_OFF;
    const mx0=h.x, mx1=h.x+h.w, my0=h.y, my1=feet;
    const gx=Math.max(0,Math.max(e.x-mx1, mx0-(e.x+e.w))), gy=Math.max(0,Math.max(e.y-my1, my0-(e.y+e.h)));
    return Math.max(gx,gy);
  }
  function onScreen(e){
    const Z=(typeof sw==='function'?sw(1000)/1000:1)||1, vx0=_rcamX!=null?_rcamX:camX, vy0=_rcamY!=null?_rcamY:camY;
    const vw=typeof camViewW==='function'?camViewW():W/Z, vh=typeof camViewH==='function'?camViewH():H/Z;   // what the (zoomed) camera shows
    return e.x+e.w>vx0-T&&e.x<vx0+vw+T&&e.y+e.h>vy0-T&&e.y<vy0+vh+T;
  }
  function sees(e){
    const a=center(e), m=mindCenter();
    const n=Math.ceil(Math.hypot(m.x-a.x,m.y-a.y)/(T/3));
    for(let i=1;i<n;i++){ const x=a.x+(m.x-a.x)*i/n, y=a.y+(m.y-a.y)*i/n; if(solidAt(x,y)) return false; }
    return true;
  }

  // ── frags ───────────────────────────────────────────────────────
  B.frags=B.frags||[];
  // Frags, sized to the drawing (1 grid square = 1 tile): in the air they fly
  // straight out a couple of squares; from the ground they arc up about three
  // squares and land three or four squares away, then bounce once.
  const AIR8=[0,1,2,3,4,5,6,7].map(i=>[Math.cos(i*Math.PI/4),Math.sin(i*Math.PI/4)]);
  const FRAG_AIR={ circle:AIR8, tri:[[0,-1],[-0.87,0.5],[0.87,0.5]], square:[[-0.71,-0.71],[0.71,-0.71],[-0.71,0.71],[0.71,0.71]] };
  const FRAG_GROUND={                       // [vx, vy] launch from the floor
    circle:[[-4,-2.4],[-2.7,-7],[0,-7.6],[2.7,-7],[4,-2.4]],
    tri:[[0,-7.6],[-2.7,-6.4],[2.7,-6.4]],                       // the two bottom corners bounce off the floor
    square:[[-2.9,-7],[2.9,-7],[-3.6,-4.2],[3.6,-4.2]]            // top corners up, bottom corners skip out low
  };
  function explode(e){
    const c=center(e), ground=e.og||floorUnder(e.x,e.w,e.y+e.h);
    if(ground){
      for(const [vx,vy] of FRAG_GROUND[e._ai]){
        const ox=Math.sign(vx)*e.w*(Math.abs(vx)>3.3?0.5:0.35), oy=vy<-6.5?-e.h*0.45:e.h*0.25;
        B.frags.push({x:c.x+ox, y:Math.min(c.y+oy,e.y+e.h-6), vx:vx*(0.92+Math.random()*0.16), vy:vy*(0.92+Math.random()*0.16), t:0, settle:0, owner:e, bounce:0, ai:e._ai, cold:false, smoked:0, hitCd:0});
      }
    }else{
      for(const [dx,dy] of FRAG_AIR[e._ai]){
        const sp=4.4+Math.random()*0.6, r=e._ai==='circle'?0.42:0.5;
        B.frags.push({x:c.x+dx*e.w*r, y:c.y+dy*e.h*r, vx:dx*sp, vy:dy*sp-0.8, t:0, settle:0, owner:e, bounce:0, ai:e._ai, cold:false, smoked:0, hitCd:0});
      }
    }
    B.blasts.push({x:c.x, y:c.y, t:0, amp:1});
    B.shake=Math.max(B.shake||0,8);
    if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.boom(1);
    if(e._ai==='circle') try{ sfx('frag_fire'); }catch(_e){}
    // the blast itself shoves MIND
    const m=mindCenter(), d=Math.hypot(m.x-c.x,m.y-c.y)||1;
    if(d<3*T&&_shutdownTimer<=0){ const k=1-d/(3*T); applyPlayerHit((m.x-c.x)/d*8*k,-4*k-1,Math.round(6+8*k)); }
    releaseRope(e);
    // Paulo (Oct 20): blowing up doesn't shut it down — it cools off for a
    // second (grey, steaming) and then carries on as before.
    e.fuse=0; e.heat=0; e.cool=COOL; e.vx=0; e.vy=0;
  }
  // Paulo (Oct 21): frags stay hot (and hurt) longer and bounce around more before they go cold and still
  const FRAG_HOT=170, FRAG_LINGER=30*60, FRAG_GLITCH=28*60, FRAG_MIN_LIVE=130, FRAG_BOUNCES=5;
  function fragSmoke(f){
    for(let s=0;s<5;s++) PFXS.push({x:f.x+(Math.random()-0.5)*6,y:f.y,vx:(Math.random()-0.5)*0.7,vy:-0.35-Math.random()*1.1,life:22+Math.random()*14|0,maxLife:36,r:2+Math.random()*2.5,col:Math.random()<0.5?'#d0d0d4':'#8a8a90'});
  }
  function kickFrag(f){
    if(!p||(f.kickCd||0)>0||Math.abs(p.vx||0)<0.4) return false;
    const R=typeof WHEEL_R!=='undefined'?WHEEL_R:14, wx=p.x+SW/2, wy=p.y+FEET_OFF-R;
    if(Math.hypot(f.x-wx,f.y-wy)>R+7) return false;
    const s=Math.sign(p.vx);
    f.vx=p.vx*1.25+s*1.2; f.vy=-2-Math.abs(p.vx)*0.35; f.settle=0; f.bounce=0; f.dud=true; f.kickCd=10;
    if(f.ai!=='circle') f.t=Math.min(f.t,100); else f.smoked=Math.min(f.smoked||0,FRAG_LINGER-600);
    try{ sfx('debris',0.7); }catch(e){}
    return true;
  }
  // XLR (sign +1, push) / MAG (sign -1, pull): frags in front of the jack get shoved or drawn in
  B.forceFrags=function(tx,ty,ang,sign,str,range){
    if(!B.frags||!B.frags.length||str<=0) return;
    const ca=Math.cos(ang), sa=Math.sin(ang);
    for(const f of B.frags){
      const dx=f.x-tx, dy=f.y-ty, d=Math.hypot(dx,dy); if(d>range||d<1) continue;
      const ux=dx/d, uy=dy/d, al=ux*ca+uy*sa; if(al<0.3) continue;            // in front of the jack
      if(!solidFree(tx,ty,f.x,f.y)) continue;                                    // not through a wall
      const k=str*(1-d/range*0.7)*al;
      f.vx+=ux*k*sign; f.vy+=uy*k*sign;
      const sp=Math.hypot(f.vx,f.vy); if(sp>12){ f.vx*=12/sp; f.vy*=12/sp; }
      if(f.settle){ f.settle=0; f.bounce=0; f.dud=true; }
      if(f.ai!=='circle') f.t=Math.min(f.t,100);
    }
  };
  function solidFree(x0,y0,x1,y1){ const n=Math.ceil(Math.hypot(x1-x0,y1-y0)/10); for(let i=1;i<n;i++){ if(solidAt(x0+(x1-x0)*i/n,y0+(y1-y0)*i/n)) return false; } return true; }
  function fragTick(){
    for(let i=B.frags.length-1;i>=0;i--){
      const f=B.frags[i]; f.t++;
      const circle=f.ai==='circle';
      if(f.kickCd>0) f.kickCd--;
      // Paulo (Oct 21): spent frags are like the omni crumbs — roll over one and it gets kicked along
      if((f.settle>0||(circle&&f.cold)||f.dud)&&kickFrag(f)){}
      if(!circle&&f.settle>0){ if(++f.settle>240) B.frags.splice(i,1); continue; }
      if(circle&&f.cold){
        f.smoked++;
        if(f.smoked===1||(f.smoked<22&&f.smoked%4===0)) fragSmoke(f);
        if(f.smoked>FRAG_LINGER){ B.frags.splice(i,1); continue; }
      }
      if(!f.settle){
        f.vy=Math.min(f.vy+GRAV*0.6,13);
        const nx=f.x+f.vx, ny=f.y+f.vy;
        if(solidAt(nx,f.y)){ f.vx*=-0.5; } else f.x=nx;
        if(solidAt(f.x,ny)){
          if(f.vy>0){
            f.bounce++;
            const live=!f.dud&&f.t<FRAG_MIN_LIVE;                      // still hot: it keeps hopping
            if(!live&&(f.bounce>=FRAG_BOUNCES||Math.abs(f.vy)<1.6)){ f.settle=1; f.vx=0; f.vy=0; }
            else { f.vy=-Math.max(Math.abs(f.vy)*0.58,live?2.4:0.8); f.vx=f.vx*0.78+(live?(Math.random()-0.5)*1.4:0); }
          } else f.vy*=-0.3;
        }
        else f.y=ny;
        if(B.inWater&&B.inWater(f.x,f.y)){ f.vx*=0.9; f.vy*=0.9; }
      }
      if(circle&&!f.cold&&f.t>=FRAG_HOT){ f.cold=true; f.smoked=0; fragSmoke(f); }
      if(!circle&&f.t%3===0) PFXS.push({x:f.x,y:f.y,vx:(Math.random()-0.5)*0.6,vy:-0.5-Math.random(),life:8+Math.random()*6|0,maxLife:14,r:1.5+Math.random()*1.5,col:Math.random()<0.5?'#ff5500':'#ffcc33'});
      else if(circle&&!f.cold&&f.t%3===0){
        const col=f.t<24?'#fff6a0':f.t<50?'#ff9a20':'#e02810';
        PFXS.push({x:f.x,y:f.y,vx:(Math.random()-0.5)*0.6,vy:-0.5-Math.random(),life:8+Math.random()*6|0,maxLife:14,r:1.5+Math.random()*1.5,col});
      }
      if(!circle&&f.t>360){ B.frags.splice(i,1); continue; }
      if(f.settle&&!circle) continue;
      if(circle&&f.cold) continue;
      if((f.hitCd||0)>0){ f.hitCd--; continue; }
      const h=playerCoreHB(p);
      if(!f.dud&&_shutdownTimer<=0&&ov(f.x-5,f.y-5,10,10,h.x,h.y,h.w,p.y+FEET_OFF-h.y)){
        applyPlayerHit((p.x+SW/2-f.x)*0.15,-3.2,12);
        if(circle) f.hitCd=18; else { B.frags.splice(i,1); continue; }
      }
      for(const e of ENEMS){
        if(e===f.owner||!e.alive||!e._betaEnemy) continue;
        if(ov(f.x-5,f.y-5,10,10,e.x,e.y,e.w,e.h)){
          _damageEnemy(e,14,f.x,f.y,0.5);
          if(circle) f.hitCd=18; else B.frags.splice(i,1);
          break;
        }
      }
    }
  }

  // the XLR / MAG only move an enemy that's close to MIND
  if(typeof window._applyItemForceToEnemy==='function'&&!window._applyItemForceToEnemy._betaWrapped){
    const orig=window._applyItemForceToEnemy;
    window._applyItemForceToEnemy=function(e){
      if(B.on&&e&&p){ const m=mindCenter(), c=center(e); if(Math.hypot(m.x-c.x,m.y-c.y)>MAX_ITEM_R) return; }
      if(e&&e._ai){ e._shoveX=(e._shoveX||0)+(arguments[1]||0); e._shoveY=(e._shoveY||0)+(arguments[2]||0); }
      return orig.apply(this,arguments);
    };
    window._applyItemForceToEnemy._betaWrapped=true;
  }
  // ── XLR-style push ──────────────────────────────────────────────
  B.pushFx=B.pushFx||[];
  function push(e,dir){
    const c=center(e);
    B.pushFx.push({x:c.x+dir*e.w*0.5, y:c.y, dir, t:0});
    try{ sfx('xlr_push'); }catch(_e){ try{ sfx('hit'); }catch(__){} }
    const m=mindCenter(), dx=m.x-c.x;
    if(Math.sign(dx)===dir&&Math.abs(dx)<PUSH_R+e.w/2&&Math.abs(m.y-c.y)<2*T&&_shutdownTimer<=0){
      const k=1-Math.abs(dx)/(PUSH_R+e.w/2);
      p.vx+=dir*(6+7*k); p.vy=Math.min(p.vy,-2.5-2*k); p.og=false; p._groundHold=0;
      if(typeof _syncLivesFromHp==='function'){}
    }
    // it also shoves the blocks in front of it (the same rows the XLR moves)
    if(B.pushCubeFrom) B.pushCubeFrom(c.x, c.y, dir, 0.7);
  }

  // ── rope ────────────────────────────────────────────────────────
  B.ropes=B.ropes||[];
  function ropeOf(e){ return B.ropes.find(r=>r.e===e); }
  function releaseRope(e){ const i=B.ropes.findIndex(r=>r.e===e); if(i>=0){ B.ropes.splice(i,1); try{ if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.twang(false); }catch(_e){} } }
  function ropeOrigin(e){
    const c=center(e), a=e.tumble?(e.ang||0):(e.gAng||0)+(e.ang||0);
    let ox=0, oy=0;
    if(e._ai==='tri'){ oy=-e.h/2; }
    else if(e._ai==='square'){ const f=(B.ropes.find(r=>r.e===e&&r.tx!=null)||{}).tx>c.x?1:-1; ox=f*e.w/2; oy=-e.h/2; }
    return {x:c.x+ox*Math.cos(a)-oy*Math.sin(a), y:c.y+ox*Math.sin(a)+oy*Math.cos(a)};
  }
  B.enemyRopeOrigin=ropeOrigin;
  function lineBlocked(x0,y0,x1,y1){
    const n=Math.ceil(Math.hypot(x1-x0,y1-y0)/8);
    for(let i=1;i<n;i++){ const x=x0+(x1-x0)*i/n, y=y0+(y1-y0)*i/n; if(solidAt(x,y)) return true; }
    return false;
  }
  function throwRope(e,tx,ty,kind){
    const c=ropeOrigin(e), d=Math.hypot(tx-c.x,ty-c.y)||1;
    try{ if(onScreen(e)) sfx('rope_throw'); }catch(_e){}
    B.ropes.push({e, kind, x:c.x, y:c.y, vx:(tx-c.x)/d*11, vy:(ty-c.y)/d*11, st:'fly', t:0, len:0, mode:'hold', mash:0, decide:0, tx, ty});
  }
  function ropeTick(){
    for(let i=B.ropes.length-1;i>=0;i--){
      const r=B.ropes[i], e=r.e, c=ropeOrigin(e); r.t++;
      if(!e.alive){ B.ropes.splice(i,1); continue; }
      if(r.st==='fly'){
        r.x+=r.vx; r.y+=r.vy;
        if(r.kind==='mind'){
          const h=playerCoreHB(p);
          if(ov(r.x-6,r.y-6,12,12,h.x,h.y,h.w,p.y+FEET_OFF-h.y)){ r.st='hold'; r.len=Math.hypot(p.x+SW/2-c.x,p.y+FEET_OFF*0.6-c.y); try{ if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.twang(true); }catch(_e){} continue; }
          if(solidAt(r.x,r.y)||r.t>40){ B.ropes.splice(i,1); continue; }
        }else{                                                  // climbing / travelling: rope to a ledge or a ceiling
          if(r.kind==='travel'&&solidAt(r.x,r.y)&&Math.hypot(r.x-r.tx,r.y-r.ty)>=12){
            // it bit the rock on the way: that's the anchor now (if it can still swing to its floor)
            r.x-=r.vx; r.y-=r.vy; r.tx=r.x; r.ty=r.y;
            if(r.anchor&&r.y<Math.min(e.y,r.dest.y)) r.anchor={x:r.x,y:r.y};
            else{ B.ropes.splice(i,1); try{ if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.twang(false); }catch(_e){} continue; }
          }
          if(Math.hypot(r.x-r.tx,r.y-r.ty)<12||r.t>30){ r.x=r.tx; r.y=r.ty; r.st=r.kind==='travel'?'swing':'climb'; r.t=0; try{ if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.twang(true); }catch(_e){} }
        }
        continue;
      }
      if(r.st==='swing'){                                        // on the rope: a pendulum (or a haul) to the far floor
        const d=r.dest, s0=r.s0||(r.s0={x:e.x,y:e.y});
        const dist=Math.hypot(d.x-s0.x,d.y-s0.y), dur=r.dur||(r.dur=Math.round(26+dist/7));
        const u=Math.min(1,r.t/dur), k=u<0.5?2*u*u:1-2*(1-u)*(1-u);
        e.og=false; e._plat=null;
        if(r.anchor){
          const A=r.anchor, h=e.h/2, w2=e.w/2;
          const a0=Math.atan2(s0.y+h-A.y,s0.x+w2-A.x), a1=Math.atan2(d.y+h-A.y,d.x+w2-A.x);
          const r0=Math.hypot(s0.x+w2-A.x,s0.y+h-A.y), r1=Math.hypot(d.x+w2-A.x,d.y+h-A.y);
          const ang=a0+(a1-a0)*k, rad=r0+(r1-r0)*k;
          const nx=A.x+Math.cos(ang)*rad-w2, ny=A.y+Math.sin(ang)*rad-h;
          if(u>0.05&&!boxFree(nx,ny,e.w,e.h)){                  // swung into rock: the rope can't pull it through — it drops
            B.ropes.splice(i,1); e.ang=0; e.og=false; e._falling=true; e.vy=0; continue; }
          e.x=nx; e.y=ny;
          e.ang=(a1-a0)*Math.sin(k*Math.PI)*0.6;
        }else{                                                    // no ceiling: hooked to the far ledge, it hauls itself over
          e.x=s0.x+(d.x-s0.x)*k; e.y=s0.y+(d.y-s0.y)*k-Math.sin(k*Math.PI)*Math.min(2*T,dist*0.3);
          r.x=d.x+e.w/2; r.y=d.y+e.h;
        }
        if(u>=1){ e.x=d.x; e.y=d.y; e.ang=0; e.og=true; e.vy=0; e._falling=false; e.baseY=e.y; B.ropes.splice(i,1); land(e,2);
          try{ if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.twang(false); }catch(_e){} }
        continue;
      }
      if(r.st==='climb'){                                        // haul up onto the ledge
        const k=Math.min(1,r.t/26), sx0=r.sx??(r.sx=e.x), sy0=r.sy??(r.sy=e.y);
        e.x=sx0+(r.tx-e.w/2-sx0)*k; e.y=sy0+(r.ty-e.h-sy0)*k-Math.sin(k*Math.PI)*T;
        if(k>=1){ e.og=true; e.vy=0; e.baseY=e.y; B.ropes.splice(i,1); }
        continue;
      }
      // holding MIND
      const mx=p.x+SW/2, my=p.y+FEET_OFF*0.6;
      r.x=mx; r.y=my;
      if(--r.decide<=0){
        const df=DIFF(), pull=df===1?0.25:df===2?0.5:0.7;
        r.mode=Math.random()<pull?'pull':'hold';
        if(df===3&&e.heat>0.35) r.mode='pull';                  // hard: reel him into the blast
        r.decide=40+Math.random()*30|0;
      }
      if(lineBlocked(c.x,c.y,mx,my)){ r.blockT=(r.blockT||0)+1; if(r.blockT>8){ releaseRope(e); e.ropeCd=200; continue; } } else r.blockT=0;
      if(Math.hypot(mx-c.x,my-c.y)-r.len>3*T){ releaseRope(e); e.ropeCd=240; continue; }     // too much strain: it snaps
      if(r.mode==='pull') r.len=Math.max(e.w*0.5+T*0.6, r.len-(DIFF()===3?2.6:1.8));
      const dx=mx-c.x, dy=my-c.y, d=Math.hypot(dx,dy)||1;
      if(d>r.len){
        const ux=dx/d, uy=dy/d, out=p.vx*ux+p.vy*uy;
        if(out>0){ p.vx-=ux*out; p.vy-=uy*out; }
        const k=Math.min(4,(d-r.len)*0.12);
        p.vx-=ux*k; p.vy-=uy*k*0.8; p.og=false; p._groundHold=0;
        if(window.MV_BETA_AUDIO&&r.t%8===0) MV_BETA_AUDIO.creak(Math.min(1,(d-r.len)/40));
      }
      // break free: mash jump, hit the enemy, or it lets go after a while
      if(typeof isJumpJ==='function'&&isJumpJ()) r.mash++;
      if(r.mash>=(DIFF()===3?6:4)||e.hitF>10||r.t>(DIFF()===1?150:DIFF()===2?220:300)){ releaseRope(e); e.ropeCd=200; }
    }
  }

  // ── movement ────────────────────────────────────────────────────
  function startTumble(e,dir,dropOn){
    const step=e.w;                                          // one side length
    const nx=e.x+dir*step, feet=e.y+e.h;
    if(e._plat){ const pl=e._plat; if(nx<pl.x-4||nx+e.w>pl.x+pl.w+4) return false; }
    if(enemyIn(e,Math.min(e.x,nx),e.y,e.w+Math.abs(nx-e.x),e.h)) return false;   // another enemy is in the way
    if(!boxFree(nx,e.y,e.w,e.h)){
      // the triangle ropes itself up onto a step it can't roll over
      if(e._ai==='tri'&&!ropeOf(e)){
        for(let up=T;up<=3*T;up+=T){
          if(boxFree(nx,e.y-up,e.w,e.h)&&floorUnder(nx,e.w,feet-up)){ throwRope(e,nx+e.w/2,feet-up,'ledge'); return true; }
        }
      }
      return false;
    }
    // only onto floor: never off a ledge (a rope gets it anywhere else) — except C
    // dropping on MIND on purpose
    let drop=0;
    if(!(floorAtPoint(nx+8,feet,8)&&floorAtPoint(nx+e.w-8,feet,8))&&!platUnder(nx,e.w,feet)){
      if(!dropOn) return false;
      drop=dropDepth(nx,e.w,feet,9*T); if(drop===Infinity) return false;
      if(!e._iso&&wetAt(nx+e.w/2,feet+drop-6)) return false;
    }
    if(!e._iso&&wetAt(nx+e.w/2,feet-6)) return false;         // ... nor into the water (it would short out)
    e.tumble={dir, t:0, dur:e._ai==='tri'?26:20, x0:e.x, nx, drop};
    return true;
  }
  // ── rope travel (B + C): from a ledge to another floor ──────────
  // Looks up to 9 blocks ahead for a floor it fits on (4 up … 4 down). If
  // there's a ceiling over the gap it swings there on the rope like a
  // pendulum; otherwise it hooks the far ledge and hauls itself over.
  function findLanding(e,dir,target){
    const feet=e.y+e.h; let best=null, bd=1e9;
    for(let k=2;k<=18;k++){                                   // up to 9 blocks, every half block
      const nx=e.x+dir*k*T/2;
      for(let up=-4;up<=4;up++){
        const f=Math.round((feet-up*T)/T)*T;
        if(!boxFree(nx,f-e.h,e.w,e.h)) continue;
        if(!(solidAt(nx+8,f+4)&&solidAt(nx+e.w-8,f+4))) continue;      // solid ground only (a moving platform would leave)
        if(!e._iso&&wetAt(nx+e.w/2,f-6)) continue;
        if(ENEMS.some(o=>o!==e&&o._ai&&Math.abs(o.x-nx)<e.w&&Math.abs(o.y+o.h-f)<T)) continue;
        // with a target: the floor that gets it closest to him (not right on top: it wants room to work)
        const d=target?Math.max(T*2,Math.hypot(nx+e.w/2-target.x,f-e.h/2-target.y)):k*T/2+Math.abs(up)*T*0.7;
        if(d<bd){ bd=d; best={x:nx,y:f-e.h}; }
      }
    }
    return best;
  }
  function findAnchor(e,dest){
    const c=center(e), mx=(c.x+dest.x+e.w/2)/2, top=Math.min(e.y,dest.y);
    for(let y=top-T;y>top-8*T;y-=T/2){ if(solidAt(mx,y)) return {x:mx,y:y+T/2-2}; }
    return null;
  }
  function ropeTravel(e,dir,target){
    if(e._ai==='circle'||ropeOf(e)||(e.travCd||0)>0) return false;
    let dest=findLanding(e,dir,target);
    if(target&&!dest) dest=findLanding(e,-dir,target);
    if(!dest) return false;
    if(target){ const now=Math.hypot(e.x+e.w/2-target.x,e.y+e.h/2-target.y), then=Math.hypot(dest.x+e.w/2-target.x,dest.y+e.h/2-target.y); if(then>now-T){ e.travCd=40; return false; } }
    const an=findAnchor(e,dest);
    const tx=an?an.x:dest.x+e.w/2, ty=an?an.y:dest.y+e.h;
    throwRope(e,tx,ty,'travel');
    const r=ropeOf(e); r.dest=dest; r.anchor=an; e.travCd=(DIFF()===3?90:DIFF()===2?150:220)+Math.random()*80|0;
    return true;
  }
  function tumbleTick(e){
    const tb=e.tumble; tb.t++;
    const k=Math.min(1,tb.t/tb.dur);
    e.ang=tb.dir*(e._ai==='tri'?Math.PI*2/3:Math.PI/2)*k;
    if(k>=1){
      e.x=tb.nx; e.ang=0; e.tumble=null;
      if(e._plat){ const pl=e._plat; if(e.x+e.w-6>pl.x&&e.x+6<pl.x+pl.w) e._platOff=e.x-pl.x; else e._plat=null; }
      try{ if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.creak(0.2); if(onScreen(e)) sfx('tumble'); }catch(_e){}
      if(tb.drop>2){ e.og=false; e.vy=0; e._falling=true; e._plat=null; }
      else land(e,1.5);
    }
  }
  // Enemy A rolls: a steady roll along its floor, faster toward MIND; it turns
  // back at a ledge or a wall, and spins as it goes (its face turns with it)
  function rollTick(e,near,face){
    const wet=wetAt(e.x+e.w/2,e.y+e.h/2);
    const spd=(near?(DIFF()===3?2.3:DIFF()===2?1.9:1.5):0.9)*(wet?0.55:1);
    const dir=near?face:e.dir, nx=e.x+dir*spd, feet=e.y+e.h;
    const lead=dir>0?nx+e.w-12:nx+12;
    if(!boxFree(nx,e.y,e.w,e.h)&&!enemyIn(e,nx,e.y,e.w,e.h)){   // a slope: climb it a few px at a time
      for(let up=1;up<=Math.ceil(spd)+2;up++) if(boxFree(nx,e.y-up,e.w,e.h)){ e.y-=up; break; }
    }
    if(!boxFree(nx,e.y,e.w,e.h)||enemyIn(e,nx,e.y,e.w,e.h)||!floorAtPoint(lead,e.y+e.h,10)||(!e._iso&&!wet&&wetAt(lead,feet-8))){ if(!near) e.dir*=-1; e.vx=0; return; }
    e.x=nx; e.vx=dir*spd; e.roll=(e.roll||0)+dir*spd/(e.w/2);
    if(!floorUnder(e.x,e.w,feet)){ e.og=false; e._falling=true; }   // the slope drops away a little: settle onto it
  }
  function land(e,v){
    B.shake=Math.max(B.shake||0,Math.min(5,v*0.7));
    try{ sfx(v>5?'stomp':'land'); }catch(_e){}
    for(let k=0;k<6;k++) PFXS.push({x:e.x+Math.random()*e.w,y:e.y+e.h-2,vx:(Math.random()-0.5)*2,vy:-Math.random()*1.5,life:14,maxLife:14,r:2+Math.random()*2,col:'#a89880'});
  }
  function touchesWater(e){
    if(B.enemySubmerged) return B.enemySubmerged(e);
    if(!B.inWater) return false;
    const pts=[[e.w*0.5,e.h*0.35],[e.w*0.5,e.h*0.7],[e.w*0.5,e.h-6],[8,e.h*0.55],[e.w-8,e.h*0.55],[e.w*0.2,e.h-4],[e.w*0.8,e.h-4]];
    for(const [dx,dy] of pts) if(B.inWater(e.x+dx, e.y+dy)) return true;
    return false;
  }
  function shortIfWet(e){
    if(!e||e._iso||e._shorted||!touchesWater(e)) return false;
    e._shorted=true;
    if(e.alive&&typeof _damageEnemy==='function') _damageEnemy(e,9999,e.x+e.w/2,e.y+e.h/2);
    e.alive=false; e._permOff=true; e._downs=3; e._revT=0;
    e.vy=Math.min(e.vy||0,0); e.vx=(e.vx||0)*0.4;
    if(B.stats) B.stats.shortedEnemies=(B.stats.shortedEnemies||0)+1;
    return true;
  }
  function bodyBuried(e){
    const y=e.y+e.h*0.42;
    return solidAt(e.x+e.w*0.5,y)||solidAt(e.x+6,y)||solidAt(e.x+e.w-6,y);
  }
  function liftOut(e){
    if(!e||e._betaHeld||ropeOf(e)||!bodyBuried(e)) return;
    const y0=e.y, x0=e.x;
    for(let i=1;i<=e.h+T*3;i++){
      e.y=y0-i;
      if(!bodyBuried(e)){ if((e.vy||0)>0) e.vy=0; e.og=!!floorUnder(e.x,e.w,e.y+e.h); return; }
    }
    e.y=y0;
    for(const s of [-1,1]){
      for(let i=2;i<=T*2;i+=2){
        e.x=x0+s*i;
        if(!bodyBuried(e)&&boxFree(e.x,e.y,e.w,e.h)){ e.vx=0; return; }
      }
      e.x=x0;
    }
  }
  function applyShove(e){
    let sx=e._shoveX||0, sy=e._shoveY||0;
    e._shoveX=0; e._shoveY=0;
    if((!sx&&!sy)||e._betaHeld) return;
    const step=2.5, n=Math.max(1,Math.ceil(Math.hypot(sx,sy)/step));
    sx/=n; sy/=n;
    for(let i=0;i<n;i++){
      if(!e._iso&&touchesWater(e)){ shortIfWet(e); break; }
      const nx=e.x+sx, ny=e.y+sy;
      const both=boxFree(nx,ny,e.w,e.h)&&!enemyIn(e,nx,ny,e.w,e.h);
      const xOk=boxFree(nx,e.y,e.w,e.h)&&!enemyIn(e,nx,e.y,e.w,e.h);
      const yOk=boxFree(e.x,ny,e.w,e.h)&&!enemyIn(e,e.x,ny,e.w,e.h);
      if(both){ e.x=nx; e.y=ny; }
      else if(xOk) e.x=nx;
      else if(yOk) e.y=ny;
      else break;
    }
    e.og=!!floorUnder(e.x,e.w,e.y+e.h);
    if(!e.og) e._falling=true;
  }
  function fallTick(e){
    if(!e._iso&&shortIfWet(e)) return;
    if(wetAt(e.x+e.w/2,e.y+e.h/2)) e.vy=Math.min(e.vy+GRAV*0.15,1.2);    // sinks slowly in water
    else e.vy=Math.min(e.vy+GRAV*0.8,13);
    const ny=e.y+e.vy, feet=ny+e.h;
    // landing on MIND or another enemy hurts them (the square's thing)
    if(e.vy>3){
      const h=playerCoreHB(p);
      if(_shutdownTimer<=0&&ov(e.x+6,ny+e.h-12,e.w-12,12,h.x,h.y,h.w,p.y+FEET_OFF-h.y)){ applyPlayerHit((p.x+SW/2-(e.x+e.w/2))*0.08,2,Math.round(10+e.vy*1.5)); e.vy=-3; }
      for(const o of ENEMS){ if(o===e||!o.alive||!o._betaEnemy) continue; if(ov(e.x+6,ny+e.h-12,e.w-12,12,o.x,o.y,o.w,o.h)){ _damageEnemy(o,Math.round(12+e.vy*2),e.x+e.w/2,e.y+e.h,0.6); e.vy=-3; } }
    }
    const lp=platUnder(e.x,e.w,feet);
    if(lp&&e.vy>=0){ e.y=lp.y-e.h; if(e._falling) land(e,e.vy); e.vy=0; e.og=true; e._falling=false; e.baseY=e.y; e._plat=lp; e._platOff=e.x-lp.x; return; }
    if(floorUnder(e.x,e.w,feet)){
      e.y=floorSnap(e,feet);
      if(e._falling) land(e,e.vy);
      e.vy=0; e.og=true; e._falling=false; e.baseY=e.y;
    }else{ e.y=ny; e.og=false; if(e.y>((typeof WH!=='undefined'?WH:4000)+200)){ e.alive=false; e._permOff=true; } }
  }

  function think(e){
    if(!e._iso&&shortIfWet(e)) return;
    const c=center(e), m=mindCenter(), dx=m.x-c.x, dist=Math.hypot(dx,m.y-c.y);
    // they notice MIND as soon as they're on screen together, and go for him
    const near=onScreen(e);
    const los=near&&sees(e);
    // ── seeing MIND, losing him, looking for him ──
    if(e.look==null){ e.look={x:0,y:0}; e.leash=e.leash||8*T; }
    if(los){
      e.lastSeen={x:m.x,y:m.y}; e.lostT=0; e.searchT=0;
      if(!e.aware){ e.aware=true; e.mark={c:'!',t:0}; try{ sfx('enemy_alert'); }catch(_e){} }
    }else if(e.aware&&++e.lostT>(DIFF()===3?130:95)){
      e.aware=false; e.mark={c:'?',t:0}; e.searchT=DIFF()===3?600:420; try{ sfx('enemy_huh'); }catch(_e){}
    }
    if(e.mark&&++e.mark.t>60) e.mark=null;
    if(e.searchT>0) e.searchT--;
    let goal=e.aware?m:(e.searchT>0?e.lastSeen:null);
    // the eyes lock onto him; searching, they sweep around the last place he was seen
    { let lx,ly;
      if(e.aware){ const l=dist||1; lx=dx/l; ly=(m.y-c.y)/l; }
      else if(goal){ const gx=goal.x-c.x, gy=goal.y-c.y, l=Math.hypot(gx,gy)||1, sw2=Math.sin(fr*0.07+(e.phase||0)); lx=gx/l*0.6+sw2*0.5; ly=gy/l*0.4-0.2; }
      else{ lx=(e.dir||1)*0.45; ly=Math.sin(fr*0.02+(e.phase||0))*0.15; }
      e.look.x+=(lx-e.look.x)*0.18; e.look.y+=(ly-e.look.y)*0.18; }
    // home range: it hunts and searches, but never wanders far from where it spawned
    const home=e.homeX!=null?e.homeX:c.x;
    if(goal&&Math.abs(goal.x-home)>e.leash&&Math.abs(c.x-home)>=e.leash*0.9&&Math.sign(goal.x-c.x)===Math.sign(c.x-home)) goal=null;
    if(!goal&&Math.abs(c.x-home)>e.leash) e.dir=c.x<home?1:-1;
    const hunt=!!goal, gface=goal?(goal.x>=c.x?1:-1):e.dir;
    // heat: red as MIND gets close; one block away → fuse → boom
    const gap=gapTo(e);
    // cooling off after a blast: no heat, no fuse, no pushing or roping
    const cooling=(e.cool||0)>0;
    if(cooling){
      e.cool--; e.heat=0;
      if(e.cool%5===0) PFXS.push({x:c.x+(Math.random()-0.5)*e.w*0.6,y:e.y+4,vx:(Math.random()-0.5)*0.6,vy:-0.8-Math.random()*0.6,life:24,maxLife:24,r:3+Math.random()*3,col:'rgba(220,220,230,0.6)'});
    }else{
      const want=near?Math.max(0,Math.min(1,(HEAT_FAR-gap)/(HEAT_FAR-T))):0;
      e.heat+=(want-e.heat)*0.06;
      if(gap<=T*1.05&&near&&!e.fuse) { e.fuse=1; try{ sfx('chargeReady'); }catch(_e){} }
      if(e.fuse){ e.heat=1; if(++e.fuse>=FUSE){ explode(e); return; } }
    }
    if(e.pushCd>0) e.pushCd--;
    if(e.ropeCd>0) e.ropeCd--;
    const face=dx>=0?1:-1;
    // push when MIND is in front and close
    if(!cooling&&near&&!e.fuse&&e.pushCd<=0&&Math.abs(dx)<PUSH_R+e.w/2&&Math.abs(m.y-c.y)<Math.max(2*T,e.h*0.6)){ push(e,face); e.pushCd=DIFF()===1?220:DIFF()===2?160:110; }
    // rope (square + triangle)
    // rope him from range (it can't be dodged by just standing back), then reel
    if(!cooling&&e._ai!=='circle'&&los&&!e.fuse&&e.ropeCd<=0&&!ropeOf(e)&&dist<ROPE_R+e.w/2&&gap>T*1.5&&!(B.hasIsolator&&B.mindWet>0.3)){
      throwRope(e,m.x,m.y,'mind'); e.ropeCd=DIFF()===1?300:DIFF()===2?220:160;
    }
    if(e.travCd>0) e.travCd--;
    const rp=ropeOf(e); if(rp&&(rp.kind==='travel'||rp.kind==='ledge')) return;   // on its rope
    const pl=e._plat||platUnder(e.x,e.w,e.y+e.h);
    if(pl&&e.og&&!e._falling){
      if(!e._plat){ e._plat=pl; e._platOff=e.x-pl.x; }
      const dx=(pl.x+e._platOff)-e.x;                         // ride exactly with it
      e.x+=dx; e.y=pl.y-e.h;
      if(e.tumble){ e.tumble.x0+=dx; e.tumble.nx+=dx; }
      e.mn+=dx; e.mx+=dx;
    }
    if(e.tumble){ tumbleTick(e); return; }
    if(!e.og){ fallTick(e); return; }
    if(!floorUnder(e.x,e.w,e.y+e.h)){ e.og=false; e._falling=true; return; }
    if(cooling) return;
    slopeRest(e);
    if(e._ai==='circle'){ rollTick(e,hunt,gface); return; }
    if(--e.stepCd<=0){
      const dir=hunt?gface:e.dir, below=m.y>e.y+e.h+T, above=m.y<e.y-T;
      // C drops off its ledge on purpose when MIND is right below — to land on him
      if(e.aware&&e._ai==='square'&&below&&Math.abs(dx)<e.w*1.6&&sees(e)&&startTumble(e,dir,true)){}
      else if(e.aware&&Math.abs(dx)<e.w*0.5+T&&(above||below)&&ropeTravel(e,dir,m)){}   // he's over / under it: rope to his floor
      else if(!startTumble(e,dir)){
        // the edge of its floor (or a wall): it ropes across toward him; idle, sometimes it explores
        const gdx=goal?goal.x-c.x:0;
        const wantGo=hunt?Math.abs(gdx)>e.w*0.5+T||(e.aware&&(above||below)):Math.random()<0.35;
        if(!(wantGo&&ropeTravel(e,dir,goal))&&!hunt) e.dir*=-1;
      }
      e.stepCd=(hunt?(DIFF()===3?14:DIFF()===2?22:32):46)+Math.random()*16|0;
    }
  }

  // An AI enemy is not shoved by MIND's body or seated by the game's floor
  // snapping (that dropped them through moving platforms): MIND gets pushed
  // out of it instead.
  const _origSep=window._applyBodySeparation;
  window._applyBodySeparation=function(pl,e,sep){
    if(!e||!e._ai||!sep) return _origSep.apply(this, arguments);
    if(pl===p&&(B.rideEnemy===e||isOnTop(e))) return;            // standing on it: no shove
    // shared by weight (Paulo): MIND (9.5) shoves a lighter enemy out of his way — A
    // (2) gets pushed right along — and is the one who gives way to a heavier one (C)
    const tx=(sep.ax||0)-(sep.bx||0), ty=(sep.ay||0)-(sep.by||0);
    const mP=(B.WEIGHT&&B.WEIGHT.mindTotal)||9.5, mE=B.weightOf?B.weightOf('enemy',e):6;
    let kE=pl===p?mP/(mP+mE):0;                                   // the enemy's share of the horizontal push
    let ex=-tx*kE;
    if(ex&&(!boxFree(e.x+ex,e.y,e.w,e.h)||enemyIn(e,e.x+ex,e.y,e.w,e.h))){ ex=0; kE=0; }   // pinned against a wall: MIND gives way
    if(ex){ e.x+=ex; e.vx=(e.vx||0)*0.5+ex*0.5; if(e._ai==='circle') e.roll=(e.roll||0)+ex/(e.w/2); if(e._plat) e._platOff=e.x-e._plat.x; }
    const s2={ax:tx*(1-kE), ay:ty, bx:0, by:0};
    return _origSep.call(this, pl, {x:e.x,y:e.y,w:e.w,h:e.h,alive:e.alive,vx:0,vy:0,og:true}, s2);
  };
  // ── standing on enemies (Paulo, Oct 20) ─────────────────────────
  // Their shape is the floor: C (square) is a flat platform; B (triangle) is
  // two slopes — unless MIND is on the very peak he slides off one side; A
  // (circle) is round — dead centre holds, anywhere else he rolls off. An
  // enemy shut down for good is a plain platform (and can be pushed around).
  function surf(e,x){
    if(x<e.x||x>e.x+e.w) return null;
    if(e._ai==='square') return e.y;                            // flat — alive or shut down
    const cx=e.x+e.w/2, dx=x-cx;
    if(e._ai==='circle'){ const r=e.w/2; return e.y+r-Math.sqrt(Math.max(0,r*r-dx*dx)); }
    return e.y+Math.abs(dx)/(e.w/2)*e.h;                        // triangle
  }
  function slopeAt(e,x){
    if(e._ai==='square') return 0;
    const dx=x-(e.x+e.w/2); if(Math.abs(dx)<1) return 0;          // the exact centre holds
    if(e._ai==='circle'){ const r=e.w/2; return Math.max(-4,Math.min(4,dx/Math.sqrt(Math.max(1,r*r-dx*dx)))); }
    return Math.sign(dx)*e.h/(e.w/2);
  }
  // where MIND's wheel touches it: a flat top (square / shut-down body) carries
  // him as long as the wheel overlaps it; a round or pointed top only under
  // the wheel's centre
  const WHEEL=14;
  function support(e,cx){
    if(e._ai==='square'){ const x=Math.max(e.x,Math.min(e.x+e.w,cx)); return Math.abs(x-cx)<=WHEEL?x:null; }
    return cx>=e.x&&cx<=e.x+e.w?cx:null;
  }
  function isOnTop(e){ const x=support(e,p.x+SW/2); if(x==null) return false; const s=surf(e,x); return s!=null&&p.y+FEET_OFF<=s+8; }
  const _origMoveE=window._movePlayerWithColl;
  window._movePlayerWithColl=function(pl,vx,vy){
    if(!B.on||pl!==p) return _origMoveE.apply(this, arguments);
    const y0=pl.y;
    _origMoveE.apply(this, arguments);
    if(typeof _mvDropThru!=='undefined'&&_mvDropThru>0){ B.rideEnemy=null; return; }
    if(pl.hook&&pl.hook.st==='on'){ B.rideEnemy=null; return; }
    const feet0=y0+FEET_OFF, feet=pl.y+FEET_OFF, cx=pl.x+SW/2;
    let best=null, bs=1e9;
    for(const e of ENEMS){
      if(!e._ai||e._betaHeld) continue;
      const sx0=support(e,cx); if(sx0==null) continue;
      const s=surf(e,sx0); if(s==null) continue;
      const landing=(pl.vy||0)>=0&&feet0<=s+4&&feet>=s-1;
      const staying=B.rideEnemy===e&&(pl.vy||0)>=-0.01&&Math.abs(feet-s)<=10;
      if((landing||staying)&&s<bs){ bs=s; best=e; }
    }
    if(!best){ B.rideEnemy=null; return; }
    const e=best;
    if(B.rideEnemy===e&&e._pdx) pl.x+=e._pdx;                    // it carries him as it moves
    const sx1=support(e,pl.x+SW/2), s1=sx1!=null?surf(e,sx1):null;
    pl.y=(s1!=null?s1:bs)-FEET_OFF;
    if(pl.vy>0) pl.vy=0; pl.og=true; B.rideEnemy=e; B.rideEnemyFr=fr;
    const k=sx1!=null?slopeAt(e,sx1):0;
    if(k){ pl.vx+=k*0.32+Math.sign(k)*0.12; }                     // slides off the round / sloped top
  };
  const _origGroundedE=window._playerGrounded;
  window._playerGrounded=function(pl){
    if(B.on&&pl===p&&B.rideEnemy&&fr-(B.rideEnemyFr||-9)<=1) return true;
    return _origGroundedE.apply(this, arguments);
  };

  // shut-down bodies: our own gravity (they stay on their platform or ledge)
  const _origShut=window._updateMinionShut;
  window._updateMinionShut=function(e){ if(e&&e._ai) return; return _origShut.apply(this, arguments); };
  function bodyTick(e){                        // dead or alive: platforms carry, gravity pulls
    if(e._plat){
      const pl=e._plat;
      if(e.x+e.w-6>pl.x&&e.x+6<pl.x+pl.w&&!e._falling&&!(e._thrownF>0)&&!e._betaHeld){ e.x=pl.x+e._platOff; e.y=pl.y-e.h; e.vy=0; e.og=true; return true; }
      e._plat=null;
    }
    return false;
  }
  // the slope under it (radians, + = falling to the right) and how far below
  // its box the ground really is at its centre
  function groundUnder(e){
    if(typeof gridStandY!=='function') return {ang:0,dy:0};
    const feet=e.y+e.h, cx=e.x+e.w/2, hw=Math.min(14,e.w/2-2);
    const yl=gridStandY(cx-hw,feet,{maxUp:20,maxDrop:T}), yr=gridStandY(cx+hw,feet,{maxUp:20,maxDrop:T}), yc=gridStandY(cx,feet,{maxUp:20,maxDrop:T});
    if(yl==null||yr==null) return {ang:0,dy:0};
    return {ang:Math.atan2(yr-yl,2*hw), dy:yc!=null?Math.max(0,Math.min(T,yc-feet)):0};
  }
  function slopeRest(e){
    const g=(e.og&&!e.tumble&&!e._betaHeld)?groundUnder(e):{ang:0,dy:0};
    e.gAng=(e.gAng||0)+(g.ang-(e.gAng||0))*0.25; e.gDy=(e.gDy||0)+(g.dy-(e.gDy||0))*0.35;
    return g;
  }
  B.enemySlopeRest=slopeRest;
  function deadTick(e){
    if(e.shutF>0) e.shutF--;
    if(bodyTick(e)) return;
    if(e._betaHeld||(e._thrownF||0)>0) return;
    // on a slope: a round body rolls down it; the others rest tilted on it
    const g=slopeRest(e);
    if(e._ai==='circle'&&e.og&&Math.abs(g.ang)>0.06) e.vx=(e.vx||0)+Math.sin(g.ang)*0.22;
    // pushed around (XLR, magnet throw…): slides, stopped by walls and other bodies, friction on the floor
    if(Math.abs(e.vx||0)>0.05){
      const nx=e.x+e.vx; if(boxFree(nx,e.y,e.w,e.h)&&!enemyIn(e,nx,e.y,e.w,e.h)) e.x=nx; else e.vx=0;
      e.vx*=e.og?(e._ai==='circle'?0.985:0.86):0.98;
      if(e._ai==='circle') e.roll=(e.roll||0)+e.vx/(e.w/2);
      if(e.og&&!floorUnder(e.x,e.w,e.y+e.h)) e.og=false;
    }else e.vx=0;
    if(B.inWater&&B.inWater(e.x+e.w/2,e.y+e.h/2)){ e.vy=Math.min((e.vy||0)+0.05,0.8); }
    else e.vy=Math.min((e.vy||0)+GRAV*0.8,13);
    const feet=e.y+e.h+e.vy, pl=platUnder(e.x,e.w,feet);
    if(pl&&e.vy>=0){ e.y=pl.y-e.h; e.vy=0; e.og=true; e._plat=pl; e._platOff=e.x-pl.x; e._shutSettled=true; return; }
    if(floorUnder(e.x,e.w,feet)&&e.vy>=0){ e.y=floorSnap(e,feet); e.vy=0; e.og=true; e._shutSettled=true; return; }
    e.y+=e.vy; e.og=false;
  }

  B.enemyAITick=function(){
    if(!p) return;
    for(const e of ENEMS){
      if(!e._ai) continue;
      e._pdx=e._px!=null?e.x-e._px:0; e._px=e.x;              // how far it moved (carries MIND standing on it)
      e.mn=-1e7; e.mx=1e7; e._reCenter=false;                 // reboots right where it went down
      if(!e.alive){ e.heat*=0.9; e.fuse=0; e.tumble=null; e.ang=0; if(ropeOf(e)) releaseRope(e); deadTick(e); if(!e._iso) shortIfWet(e); liftOut(e); continue; }
      if(e._betaHeld||(e._thrownF||0)>0){ e.tumble=null; e.ang=0; e.og=false; e.baseY=e.y; if(ropeOf(e)&&ropeOf(e).kind!=='mind') releaseRope(e); continue; }
      think(e);
    }
    ropeTick();
    for(const e of ENEMS){ if(!e._ai||!e.alive) continue; applyShove(e); if(!e._iso) shortIfWet(e); liftOut(e); }
    fragTick();
    for(let i=B.pushFx.length-1;i>=0;i--){ if(++B.pushFx[i].t>22) B.pushFx.splice(i,1); }
  };
  B.onLevelStartEnemies=function(){ B.frags.length=0; B.ropes.length=0; B.pushFx.length=0; };

  // ── drawing ────────────────────────────────────────────────────
  function lerpCol(a,b,k){ const pa=a.match(/\w\w/g).map(h=>parseInt(h,16)), pb=b.match(/\w\w/g).map(h=>parseInt(h,16)); return 'rgb('+pa.map((v,i)=>Math.round(v+(pb[i]-v)*k)).join(',')+')'; }
  // The look follows Paulo's drawing: red-ink outlines and faces on a pale
  // body; the body fills red as MIND gets close, and flashes white on the fuse.
  const INK='#c41a1a', INK_D='#5a0a0a';
  // lx,ly: where it's looking (unit-ish, in the face's own frame) — the eyes shift that way
  function inkFace(g,s,ai,col,off,lx,ly,rot){
    g.strokeStyle=col; g.fillStyle=col; g.lineCap='round'; g.lineJoin='round';
    lx=lx||0; ly=ly||0; const ex=lx*s*0.08, ey=ly*s*0.06;
    if(ai==='square'){                               // ⌐ ¬ eyes, a box mouth low on the face
      g.lineWidth=Math.max(2,s*0.065);
      g.save(); g.translate(ex,ey);
      g.beginPath(); g.moveTo(-s*0.3,-s*0.08); g.lineTo(-s*0.3,-s*0.24); g.lineTo(-s*0.1,-s*0.24); g.stroke();
      g.beginPath(); g.moveTo(s*0.08,-s*0.24); g.lineTo(s*0.28,-s*0.24); g.lineTo(s*0.28,-s*0.08); g.stroke();
      if(!off){ g.beginPath(); g.arc(-s*0.2,-s*0.15,s*0.035,0,Math.PI*2); g.arc(s*0.18,-s*0.15,s*0.035,0,Math.PI*2); g.fill(); }   // pupils
      g.restore();
      g.strokeRect(-s*0.3,s*0.08,s*0.3,s*0.2);
      if(off){ g.beginPath(); g.moveTo(-s*0.3,-s*0.16); g.lineTo(-s*0.1,-s*0.16); g.moveTo(s*0.08,-s*0.16); g.lineTo(s*0.28,-s*0.16); g.stroke(); }
    }else if(ai==='tri'){                             // slanted brows over dot eyes, a small ^ mouth
      g.lineWidth=Math.max(2,s*0.06);
      g.beginPath(); g.moveTo(-s*0.17,-s*0.02); g.lineTo(-s*0.04,s*0.06); g.moveTo(s*0.17,-s*0.02); g.lineTo(s*0.04,s*0.06); g.stroke();
      if(!off){ g.beginPath(); g.arc(-s*0.09+ex,s*0.12+ey,s*0.03,0,Math.PI*2); g.arc(s*0.09+ex,s*0.12+ey,s*0.03,0,Math.PI*2); g.fill(); }
      g.beginPath(); g.moveTo(-s*0.07,s*0.3); g.lineTo(0,s*0.24); g.lineTo(s*0.07,s*0.3); g.stroke();
    }else{                                            // Enemy A: a dot eye and a sine wave
      g.lineWidth=Math.max(2,s*0.07);
      g.beginPath(); for(let i=0;i<=24;i++){ const x=-s*0.34+s*0.68*i/24, y=s*0.08+Math.sin(i/24*Math.PI*2+(off?0:fr*0.15))*s*0.13; i?g.lineTo(x,y):g.moveTo(x,y); } g.stroke();
      if(!off){ g.beginPath(); g.arc(s*0.12+ex,-s*0.18+ey,s*0.06,0,Math.PI*2); g.fill(); }
    }
  }
  function drawAi(e){
    const off=!e.alive, heat=off?0:e.heat||0, flash=e.fuse&&(e.fuse>>2)%2===0;
    const cool=Math.min(1,(e.cool||0)/20);
    const fill=off?'#6a6470':flash?'#ffffff':cool>0?lerpCol(lerpCol('f6efe2','e8392a',heat).match(/\d+/g).map(v=>(+v).toString(16).padStart(2,'0')).join(''),'8a8696',cool):lerpCol('f6efe2','e8392a',heat);
    const ink=off?'#2a2830':heat>0.55?'#fff4e0':INK;
    const cx=sx(e.x+e.w/2), cy=sy(e.y+e.h/2), s=sw(e.w);
    ctx.save();
    if(heat>0.15&&!off){ const g=ctx.createRadialGradient(cx,cy,0,cx,cy,s*1.1); g.addColorStop(0,'rgba(255,80,40,'+(0.35*heat)+')'); g.addColorStop(1,'rgba(255,80,40,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,s*1.1,0,Math.PI*2); ctx.fill(); }
    if(e.hitF>0&&!off&&(e.hitF&2)) ctx.globalAlpha=0.6;
    const lw=Math.max(3,s*0.08);
    // rotation for tipping / tumbling: round the bottom corner it goes over
    const tb=e.tumble, piv=tb?{x:sx(e.x+(tb.dir>0?e.w:0)), y:sy(e.y+e.h)}:null;
    if(piv){ ctx.translate(piv.x,piv.y); ctx.rotate(e.ang); ctx.translate(-piv.x,-piv.y); }
    else if(e.og&&(Math.abs(e.gAng||0)>0.02||(e.gDy||0)>0.5)){       // resting on a slope: tilted onto it
      const bx=sx(e.x+e.w/2), by=sy(e.y+e.h);
      const dy=e.gDy||0, sinkClear=dy>0.5&&!solidAt(e.x+e.w/2, e.y+e.h+Math.min(dy,8)-1);
      if(sinkClear) ctx.translate(0,sw(dy));
      if(e._ai!=='circle'){ ctx.translate(bx,by); ctx.rotate(e.gAng||0); ctx.translate(-bx,-by); }
      else ctx.translate(0,-sw(e.w/2)*(1-Math.cos(e.gAng||0)));      // a ball touches the slope a bit higher
    }
    ctx.translate(cx,cy);
    if(e._ai==='circle') ctx.rotate(e.roll||0);               // Enemy A rolls
    else if(!piv&&e.ang) ctx.rotate(e.ang);                   // swinging on its rope
    ctx.fillStyle=fill; ctx.strokeStyle=off?'#2a2830':INK_D; ctx.lineWidth=lw+2; ctx.lineJoin='round';
    const shape=()=>{ ctx.beginPath();
      if(e._ai==='circle') ctx.arc(0,0,s/2,0,Math.PI*2);
      else if(e._ai==='square') ctx.rect(-s/2,-s/2,s,s);
      else { const h=sw(e.h); ctx.moveTo(0,-h/2); ctx.lineTo(s/2,h/2); ctx.lineTo(-s/2,h/2); ctx.closePath(); } };
    shape(); ctx.fill(); ctx.stroke();                        // dark edge for the 16-bit read
    ctx.strokeStyle=off?'#4a4450':heat>0.55?'#ffd0c0':INK; ctx.lineWidth=lw*0.6; shape(); ctx.stroke();   // the red ink line
    ctx.save(); shape(); ctx.clip(); ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.fillRect(-s/2,-s/2,s,s*0.2); ctx.fillStyle='rgba(0,0,0,0.12)'; ctx.fillRect(-s/2,s*0.28,s,s*0.3); ctx.restore();
    { const rot=(e._ai==='circle'?(e.roll||0):0)+(piv?e.ang:(!piv&&e.ang&&e._ai!=='circle'?e.ang:0))+(!piv&&e.og&&e._ai!=='circle'?(e.gAng||0):0);
      const lk=e.look||{x:0,y:0}, cr=Math.cos(-rot), sr=Math.sin(-rot);
      inkFace(ctx,s,e._ai,ink,off,off?0:lk.x*cr-lk.y*sr,off?0:lk.x*sr+lk.y*cr,rot); }
    if(e._iso){ ctx.strokeStyle='rgba(255,160,70,'+(0.55+0.2*Math.sin(fr*0.12))+')'; ctx.lineWidth=Math.max(3,s*0.07); ctx.save(); ctx.scale(1.12,1.12); shape(); ctx.stroke(); ctx.restore(); }
    ctx.restore();
  }
  // a slack rope hangs and lies on the floor like a cord (same as MIND's); a taut one is straight
  function cordFor(r,c){
    const E={x:r.x,y:r.y}, d=Math.hypot(E.x-c.x,E.y-c.y), L=r.st==='hold'?Math.max(d,r.len):d;
    if(L-d<3){ r._cord=null; return [c,E]; }
    const n=Math.max(8,Math.min(48,Math.round(L/8)));
    let cd=r._cord;
    if(!cd||cd.n!==n){ const P=[]; for(let k=0;k<n;k++){ const t=k/(n-1); P.push({x:c.x+(E.x-c.x)*t,y:c.y+(E.y-c.y)*t,px:c.x+(E.x-c.x)*t,py:c.y+(E.y-c.y)*t}); } cd=r._cord={n,P}; }
    const P=cd.P, seg=L/(n-1);
    if(cd.fr!==fr){ cd.fr=fr;
      for(let k=1;k<n-1;k++){ const q=P[k], vx=(q.x-q.px)*0.985, vy=(q.y-q.py)*0.985; q.px=q.x; q.py=q.y; q.x+=vx; q.y+=vy+0.45; }
      P[0].x=c.x; P[0].y=c.y; P[n-1].x=E.x; P[n-1].y=E.y;
      for(let it=0;it<12;it++){
        for(let k=0;k<n-1;k++){ const a=P[k], b=P[k+1], dx=b.x-a.x, dy=b.y-a.y, dd=Math.hypot(dx,dy)||0.001, df=(dd-seg)/dd*0.9;
          const fa=k===0?0:1, fb=k+1===n-1?0:1, s2=fa+fb||1; a.x+=dx*df*fa/s2; a.y+=dy*df*fa/s2; b.x-=dx*df*fb/s2; b.y-=dy*df*fb/s2; }
        for(let k=1;k<n-1;k++){ const q=P[k]; if(!solidAt(q.x,q.y)) continue;
          if(!solidAt(q.px,q.y)) q.x=q.px; else if(!solidAt(q.x,q.py)) q.y=q.py; else { let g=0; while(solidAt(q.x,q.y)&&g<12){ q.y-=3; g++; } }
          q.px+=(q.x-q.px)*0.6; }
      }
    }
    return P.map(q=>({x:q.x,y:q.y}));
  }
  function drawRopes(){
    for(const r of B.ropes){
      const c=ropeOrigin(r.e), pts=cordFor(r,c);
      ctx.save(); ctx.strokeStyle='#d8b070'; ctx.lineWidth=Math.max(2,sw(3)); ctx.lineJoin='round'; ctx.beginPath(); ctx.moveTo(sx(pts[0].x),sy(pts[0].y));
      for(let k=1;k<pts.length-1;k++) ctx.quadraticCurveTo(sx(pts[k].x),sy(pts[k].y),(sx(pts[k].x)+sx(pts[k+1].x))/2,(sy(pts[k].y)+sy(pts[k+1].y))/2);
      ctx.lineTo(sx(pts[pts.length-1].x),sy(pts[pts.length-1].y)); ctx.stroke();
      const x1=sx(r.x), y1=sy(r.y);
      ctx.strokeStyle='#7a5a30'; ctx.lineWidth=1; ctx.setLineDash([3,4]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle='#ffe0a0'; ctx.beginPath(); ctx.arc(x1,y1,sw(4),0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }
  function circleFragLook(t){
    if(t<24) return {body:'#ffe14a', core:'#fffce8', glow:'255,246,160'};
    if(t<50) return {body:'#ff8a18', core:'#ffe08a', glow:'255,150,40'};
    if(t<FRAG_HOT) return {body:'#d02010', core:'#ffb0a0', glow:'220,40,20'};
    return {body:'#2a2a2e', core:'#6a6a70', glow:'30,30,34'};
  }
  function drawFrags(){
    for(const f of B.frags){
      if(f.ai==='circle'){
        const look=circleFragLook(f.t);
        const glitch=f.cold&&f.smoked>FRAG_GLITCH;
        if(glitch&&(f.smoked&2)===0) continue;
        let x=sx(f.x), y=sy(f.y);
        if(glitch){ x+=(Math.random()-0.5)*16; y+=(Math.random()-0.5)*10; }
        ctx.save();
        if(!f.cold){
          const g=ctx.createRadialGradient(x,y,0,x,y,sw(12));
          g.addColorStop(0,'rgba('+look.glow+',0.95)'); g.addColorStop(1,'rgba('+look.glow+',0)');
          ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,sw(12),0,Math.PI*2); ctx.fill();
        }
        ctx.fillStyle=look.body; ctx.beginPath(); ctx.arc(x,y,sw(5.5),0,Math.PI*2); ctx.fill();
        ctx.fillStyle=look.core; ctx.beginPath(); ctx.arc(x-sw(1.2),y-sw(1.4),sw(2.1),0,Math.PI*2); ctx.fill();
        if(glitch){ ctx.fillStyle=(f.smoked&1)?'#fff6a0':'#ff3040'; ctx.fillRect(x-sw(9),y+(Math.random()-0.5)*8,sw(18),2); }
        ctx.restore();
        continue;
      }
      const x=sx(f.x), y=sy(f.y), a=f.settle?Math.max(0,1-f.settle/90):1;
      ctx.save(); ctx.globalAlpha=a;
      const g=ctx.createRadialGradient(x,y,0,x,y,sw(10)); g.addColorStop(0,'rgba(255,220,120,0.9)'); g.addColorStop(1,'rgba(255,90,0,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,sw(10),0,Math.PI*2); ctx.fill();
      ctx.fillStyle=f.settle?'#6a4030':'#ff5a10'; ctx.beginPath(); ctx.arc(x,y,sw(5),0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
    for(const pf of B.pushFx){                          // XLR-style blast rings
      const k=pf.t/22, x=sx(pf.x), y=sy(pf.y);
      ctx.save(); ctx.globalAlpha=1-k; ctx.strokeStyle='#bfe8ff'; ctx.lineWidth=sw(4)*(1-k)+1;
      for(let j=0;j<3;j++){ const r=sw(18+j*20+k*90); ctx.beginPath(); ctx.arc(x,y,r,pf.dir>0?-0.6:Math.PI-0.6,pf.dir>0?0.6:Math.PI+0.6); ctx.stroke(); }
      ctx.restore();
    }
  }
  const _origDrawEnemy=window.drawEnemy;
  // '!' / '?' over its head: pops in, holds, fades out over a second
  function drawMark(e){
    const mk=e.mark; if(!mk||!e.alive) return;
    const t=mk.t, a=t<45?1:Math.max(0,1-(t-45)/15), pop=t<8?0.5+0.7*Math.sin(t/8*Math.PI*0.75):1;
    const x=sx(e.x+e.w/2), y=sy(e.y)-sw(18)-Math.min(6,t*0.6), r=sw(13)*pop;
    ctx.save(); ctx.globalAlpha=a;
    ctx.fillStyle=mk.c==='!'?'#ffe24a':'#bfe4ff'; ctx.strokeStyle='#1a0e08'; ctx.lineWidth=Math.max(2,sw(2.5));
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x-r*0.25,y+r*0.85); ctx.lineTo(x,y+r*1.45); ctx.lineTo(x+r*0.3,y+r*0.82); ctx.fill();
    ctx.fillStyle='#1a0e08'; ctx.font='900 '+Math.round(r*1.5)+'px system-ui, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(mk.c, x, y+r*0.06);
    ctx.restore();
  }
  window.drawEnemy=function(e){ if(e&&e._ai){ const r=drawAi(e); drawMark(e); return r; } return _origDrawEnemy.apply(this, arguments); };
  B.drawEnemyFx=function(){ drawRopes(); drawFrags(); };

  // ── difficulty switch under the screen (next to the console buttons) ──
  function diffUi(){
    const bar=document.querySelector('.mv-console-bar'); if(!bar){ setTimeout(diffUi,300); return; }
    if(bar.querySelector('[data-d]')) return;
    bar.insertAdjacentHTML('beforeend','<span style="width:14px"></span><span>ENEMIES</span>'+[[1,'EASY'],[2,'NORMAL'],[3,'HARD']].map(([d,l])=>'<button type="button" data-d="'+d+'" style="all:unset;cursor:pointer;padding:6px 10px;border-radius:8px;border:1px solid #3a2878">'+l+'</button>').join(''));
    const sync=()=>bar.querySelectorAll('[data-d]').forEach(b=>{ const on=+b.dataset.d===B.difficulty; b.setAttribute('aria-pressed',on); b.style.background=on?'#2a1650':'#120a22'; b.style.color=on?'#ffe39a':'#9c8cc8'; b.style.borderColor=on?'#f0d070':'#3a2878'; });
    bar.addEventListener('click',ev=>{ const b=ev.target.closest('[data-d]'); if(!b) return; B.setDifficulty(+b.dataset.d); sync(); const c=document.getElementById('c'); if(c&&c.focus) c.focus(); });
    bar.style.flexWrap='wrap';
    sync();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',diffUi); else diffUi();
})();
