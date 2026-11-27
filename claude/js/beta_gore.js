// ============================================================
//  beta_gore.js — blood only while FILTER is GORE
//  The tank is painted blood red in render.js. Here the juice
//  leaks, and hits throw it onto the stage.
// ============================================================
(function(){
  'use strict';
  const drops=[], stains=[], glass=[];
  let stage=null, burstN=0, burstT=0, splashN=0;
  function rideGore(){
    const L=window.MV_LIFT;
    return L?Math.max(0,Math.min(1,-(L.pull||0))):0;
  }
  function rideInk(){
    const L=window.MV_LIFT;
    return L?Math.max(0,Math.min(1,L.pull||0)):0;
  }
  // Full gore is 33 floors down. A chosen GORE filter fades as the ride climbs.
  // T456 (Paulo, Nov 11): "the blood fx must only be activated when we reach the 17th bottom level OR
  // switch to gore filter in the options menu. And the lower we get, the more gorey and creepy it
  // gets. same goes for the ink & vinyl but the other way around, the more up we go, the more
  // heavenly it gets." Floors from MV_LIFT.pull (33 floors = 1).
  const floorsDown=()=>Math.max(0,rideGore()*33), floorsUp=()=>Math.max(0,rideInk()*33);
  function deepAmt(){ const f=floorsDown(); return f<16.5?0:Math.min(1,0.15+0.85*(f-17)/16); }
  // Paulo, Nov 13: "the same blood effect we have for the gore filter, let's have for the ink & vinyl, but black
  // (ink), less viscous: dripping more from objects, a cool stain on enemies and surfaces". In Ink & Vinyl the
  // blood is on, every red is turned into ink (IC), it runs thinner, and splashes that land on a foe stick to it.
  // (Nov 18) the colour follows the BLOOD/INK SPILL option, not the filter; the dreams below still follow I&V
  const SPILL=()=>(window.MV_SPILL?MV_SPILL.mode:'off'), INK=()=>SPILL()==='ink', IVF=()=>!!(window.MV_CONSOLE&&MV_CONSOLE.mode==='ink');
  function IC(c){
    if(typeof c!=='string'||!INK()) return c;
    let r,g,b,a=1; const m=/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c), n=/rgba?\(([^)]+)\)/.exec(c);
    if(m){ r=parseInt(m[1],16); g=parseInt(m[2],16); b=parseInt(m[3],16); }
    else if(n){ const q=n[1].split(',').map(Number); r=q[0]; g=q[1]; b=q[2]; if(q.length>3) a=q[3]; } else return c;
    if(!(r>g*1.5&&r>b*1.5)&&!(r>200&&g>110&&b>110)) return c;                  // only the reds (and their pink gloss)
    if(r>200&&g>110) return 'rgba(150,160,185,'+(a*0.55).toFixed(3)+')';         // the gloss on wet ink
    const L=r/255; return 'rgba('+Math.round(8+22*L)+','+Math.round(7+20*L)+','+Math.round(12+28*L)+','+a+')';
  }
  const estains=[];                                                             // blood / ink stuck to a body's real box
  // Paulo (this task): "blood blobs on the character look like a sheet ... we want it on its
  // collision box, of the character and of the foes too, like it does with the floor and walls."
  // The old hand-rolled bodyBox() was a fake 40x50 rectangle; use the SAME box combat uses.
  // Kept in world coords and re-read every frame, so a stain rides the actor as it walks /
  // crouches. Player + sibling use playerCoreHB; foes use their own combat hitbox (mind foes
  // -> core, signol -> rim box, eye / cube / boss -> e.x/e.y/e.w/e.h).
  function actorHB(a){
    if(!a||!isFinite(a.x)||!isFinite(a.y)) return null;
    try{
      if(typeof _enemyItemHB==='function'&&typeof ENEMS!=='undefined'&&ENEMS.indexOf(a)>=0)
        return _enemyItemHB(a);                       // a zero box means "body absent": no stain
    }catch(e){}
    try{
      if(typeof playerCoreHB==='function'&&(a===p||a===p2||a.hero||a._aiCompanion||a._betaSib))
        return playerCoreHB(a);
    }catch(e){}
    if(isFinite(a.w)&&isFinite(a.h)&&a.w>0&&a.h>0) return {x:a.x,y:a.y,w:a.w,h:a.h};
    return null;
  }
  // Which edge of the box did a splash come through, and where along it? A moving drop's
  // velocity gives the physical entry face (down -> top, rightward -> left face, ...).
  // A splash created at the actor's own centre has no travel, so favour the visible side
  // faces (where blood can run down) with the odd pool on the top — never a flat scatter.
  function surfaceOnBox(hb,wx,wy,vx,vy){
    const cl=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
    let side;
    const ax=Math.abs(vx||0), ay=Math.abs(vy||0);
    if(ax>=ay&&ax>0.05) side=(vx>0)?'left':'right';
    else if(ay>0.05)    side=(vy>0)?'top':'bottom';
    else{ const r=Math.random(); side=r<0.4?'left':r<0.8?'right':r<0.94?'top':'bottom'; }
    const t=(side==='top'||side==='bottom')?cl((wx-hb.x)/hb.w,0.06,0.94):cl((wy-hb.y)/hb.h,0.05,0.95);
    return {side,t};
  }
  // World point of an edge-anchored stain on the CURRENT box.
  function boxPoint(hb,side,t){
    if(side==='top')    return {x:hb.x+t*hb.w, y:hb.y};
    if(side==='bottom') return {x:hb.x+t*hb.w, y:hb.y+hb.h};
    if(side==='left')   return {x:hb.x, y:hb.y+t*hb.h};
    return {x:hb.x+hb.w, y:hb.y+t*hb.h};
  }
  // ── Decal silhouette conformance ─────────────────────────────────────────
  // Paulo: "that rule is not only for the triangle foe, that goes for all of the
  // foes and characters. Every hit box should match the pixel art outline."
  // So each decal is clipped to the shape the art ACTUALLY paints, not a generic
  // circle / box. Vertex counts, radii, start angles and rotations below are
  // taken straight from render.js drawAi/drawSignol and beta_foes drawEye /
  // drawCube / drawBoss. Gameplay collision is untouched — visual decals only.
  function silhouetteKind(a){
    if(!a) return 'rect';
    if(a.mind||a===p||a===p2||a.hero||a._aiCompanion||a._betaSib) return 'body';
    if(a._boss||a._foe==='boss'||a._foe==='heptagon'||a.shape==='heptagon') return 'heptagon';
    // F / the "cube" is painted as an ISOMETRIC HEXAGON (beta_foes drawCube's
    // six -PI/2+i*PI/3 points) — the decal follows that six-sided outline.
    if(a._foe==='cube'||a._ai==='cube'||a._foe==='hexagon'||a.shape==='hexagon') return 'hexagon';
    if(a._foe==='eye'||a._ai==='eye') return 'pentagon';                  // drawEye: 5 sides
    if(a._ai==='tri'&&!a._foe) return 'tri';                              // beta B, point up
    if(a.type==='flyer') return 'triDown';                                // wedge minion, point down
    if(a._ai==='square'||a.type==='square'||a.shape==='square') return 'square';
    if(a._ai==='circle'||a.type==='circle'||a.type==='signol'||a.shape==='ball') return 'circle';
    if(a.shape==='triangle'&&!a.mind) return 'tri';
    return 'rect';
  }
  // Triangle corners in world coords, following the same (optionally tumbling)
  // outline beta_enemies.drawAi() paints: A apex, B / C the two base corners.
  function triVerts(hb,a,down){
    let A={x:hb.x+hb.w*0.5, y:down?hb.y+hb.h:hb.y};
    let B={x:hb.x,          y:down?hb.y:hb.y+hb.h};
    let C={x:hb.x+hb.w,     y:down?hb.y:hb.y+hb.h};
    const rot=down?0:(((a&&a.ang)||0)+((a&&a.og&&a.gAng)||0));
    if(rot){
      const px=A.x, py=hb.y+hb.h*2/3, cs=Math.cos(rot), sn=Math.sin(rot);
      const rv=q=>({x:px+(q.x-px)*cs-(q.y-py)*sn, y:py+(q.x-px)*sn+(q.y-py)*cs});
      A=rv(A); B=rv(B); C=rv(C);
    }
    return {A,B,C,down};
  }
  // Regular polygon matching the art: -PI/2 start, n sides, radius R, rotation rot.
  function regPoly(cx,cy,R,n,rot){
    const v=[];
    for(let i=0;i<n;i++){ const ang=rot-Math.PI/2+i*Math.PI*2/n; v.push({x:cx+Math.cos(ang)*R, y:cy+Math.sin(ang)*R}); }
    return v;
  }
  function rectVerts(cx,cy,w,h,rot){
    const hw=w*0.5, hh=h*0.5, cs=Math.cos(rot), sn=Math.sin(rot);
    return [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].map(p=>({x:cx+p[0]*cs-p[1]*sn, y:cy+p[0]*sn+p[1]*cs}));
  }
  // Everything the decal needs for one actor, computed once per frame at draw time.
  function shapeGeom(hb,a,kind){
    const cx=hb.x+hb.w*0.5, cy=hb.y+hb.h*0.5, lift=(a&&a._lift)||0;
    const gr=(a&&typeof foeGroove==='function')?foeGroove(a):null;
    if(kind==='tri'||kind==='triDown') return nudgeGeom({kind,hb,tri:triVerts(hb,a,kind==='triDown'),cx,cy},a);
    if(kind==='square'){
      const rot=((a&&a.ang)||0)+((a&&a.og&&a.gAng)||0)+(gr?gr.rot:0);
      return {kind,hb,verts:rectVerts(cx,cy,hb.w,hb.h,rot),cx,cy};
    }
    if(kind==='pentagon'){                                  // E: R=w*0.55, bob, rotate by ang
      const R=hb.w*0.55, rot=((a&&a.ang)||0)+(gr?gr.rot:0);
      const bob=Math.sin((typeof fr==='number'?fr:0)*0.15+(a&&a.phase||0))*2;
      const y=cy-lift+bob;
      return {kind,hb,verts:regPoly(cx,y,R,5,rot),cx,cy:y};
    }
    if(kind==='hexagon'){                                   // F: R=w*0.56, spin+ang
      const R=hb.w*0.56, rot=((a&&a.spin)||0)+((a&&a.ang)||0)+(gr?gr.rot:0), y=cy-lift;
      return {kind,hb,verts:regPoly(cx,y,R,6,rot),cx,cy:y};
    }
    if(kind==='heptagon'){                                  // boss: R=w/2 (56), rot
      const R=hb.w*0.5, rot=(a&&a.rot)||0, y=cy-lift;
      return {kind,hb,verts:regPoly(cx,y,R,7,rot),cx,cy:y};
    }
    if(kind==='circle') return {kind,hb,cx,cy,r:Math.min(hb.w,hb.h)*0.5};
    if(kind==='body')   return {kind,hb,cx,cy};
    return null;
  }
  // Ray from the silhouette centre to its outline — used for every polygon so
  // the blot sits ON an edge and the drip direction follows that edge downhill.
  function rayPoly(cx,cy,ux,uy,verts){
    let best=null;
    for(let i=0;i<verts.length;i++){
      const p=verts[i], q=verts[(i+1)%verts.length], ex=q.x-p.x, ey=q.y-p.y;
      const den=ux*ey-uy*ex; if(Math.abs(den)<1e-6) continue;
      const dx=p.x-cx, dy=p.y-cy;
      const t=(dx*ey-dy*ex)/den, s=(dx*uy-dy*ux)/den;
      if(t>0&&s>=0&&s<=1&&(!best||t<best.t)) best={t,p,q,i};
    }
    return best;
  }
  // Where a box-face anchor (side,t) lands on the drawn outline. Returns the
  // world point, a drip direction, its bounded run, and the pool style + edge.
  // drawAi wobbles the painted foe (foeGroove) after the hitbox is placed.
  // The stain clip has to take that same shift or the ink sits off the art.
  function artNudge(a){
    const gr=(a&&typeof foeGroove==='function')?foeGroove(a):null;
    if(!gr) return null;
    const sc=(typeof sw==='function'?sw(1):1)||1;
    const wob=gr.wave||0;
    return {dx:(gr.dx||0)/sc, dy:((gr.dy||0)+wob*0.5)/sc, rot:(gr.rot||0)*0.5+wob*0.004};
  }
  function nudgeGeom(sg,a){
    const n=artNudge(a);
    if(!n||(!n.dx&&!n.dy&&!n.rot)) return sg;
    const cx=sg.cx, cy=sg.cy, cs=Math.cos(n.rot), sn=Math.sin(n.rot);
    const mv=q=>{ const x=q.x-cx, y=q.y-cy; return {x:cx+x*cs-y*sn+n.dx, y:cy+x*sn+y*cs+n.dy}; };
    if(sg.tri){ sg.tri={A:mv(sg.tri.A), B:mv(sg.tri.B), C:mv(sg.tri.C), down:sg.tri.down}; }
    if(sg.verts) sg.verts=sg.verts.map(mv);
    sg.cx+=n.dx; sg.cy+=n.dy;
    return sg;
  }
  function shapeAnchor(sg,side,t){
    if(!sg) return null;
    const hb=sg.hb;
    if(sg.tri){
      const g=sg.tri, down=g.down;
      if(side==='left'||side==='right'){
        const base=side==='left'?g.B:g.C, f=down?(1-t):t;
        const dx=base.x-g.A.x, dy=base.y-g.A.y;
        return {x:g.A.x+dx*f, y:g.A.y+dy*f, dx, dy, run:Math.hypot(dx,dy)*(1-f), pool:'slope'};
      }
      if((side==='top'&&down)||(side==='bottom'&&!down))
        return {x:g.B.x+(g.C.x-g.B.x)*t, y:g.B.y+(g.C.y-g.B.y)*t, dx:0, dy:0, run:0, pool:'base', p:g.B, q:g.C};
      return {x:g.A.x, y:g.A.y, dx:0, dy:0, run:0, pool:'apex'};
    }
    if(sg.verts){
      const bp=boxPoint(hb,side,t);
      let ux=bp.x-sg.cx, uy=bp.y-sg.cy, L=Math.hypot(ux,uy)||1; ux/=L; uy/=L;
      const hit=rayPoly(sg.cx,sg.cy,ux,uy,sg.verts);
      if(!hit) return null;
      const ax=sg.cx+ux*hit.t, ay=sg.cy+uy*hit.t;
      const p=hit.p, q=hit.q, lo=q.y>=p.y?q:p;
      const dx=lo.x-ax, dy=lo.y-ay, run=Math.hypot(dx,dy);
      // outward normal: a top-facing edge pools, the others run down the edge
      const ex=q.x-p.x, ey=q.y-p.y, el=Math.hypot(ex,ey)||1;
      let nx=ey/el, ny=-ex/el;
      if(nx*(ax-sg.cx)+ny*(ay-sg.cy)<0){ nx=-nx; ny=-ny; }
      return {x:ax, y:ay, dx, dy, run, pool:(ny<-0.35?'edge':null), p, q};
    }
    if(sg.kind==='circle'){
      const bp=boxPoint(hb,side,t);
      let ux=bp.x-sg.cx, uy=bp.y-sg.cy, L=Math.hypot(ux,uy)||1; ux/=L; uy/=L;
      return {x:sg.cx+ux*sg.r*0.92, y:sg.cy+uy*sg.r*0.92, dx:0, dy:1, run:sg.r*0.7, pool:'rim'};
    }
    if(sg.kind==='body'){
      const bp=boxPoint(hb,side,t), shoulderY=hb.y+9;                  // the record slab is 12px tall
      if(side==='top') return {x:hb.x+hb.w*t, y:shoulderY, dx:0, dy:0, run:0, pool:'shoulder'};
      return {x:bp.x, y:Math.max(shoulderY,bp.y), dx:0, dy:1,
              run:Math.max(0,hb.y+hb.h-bp.y-2), pool:null};
    }
    return null;
  }
  // Screen-space clip matching the drawn outline. Built only for on-screen
  // stains in drawBlood — never for off-screen foes.
  function clipSilhouette(sg){
    if(!sg) return false;
    ctx.beginPath();
    if(sg.tri){
      const g=sg.tri;
      ctx.moveTo(sx(g.A.x),sy(g.A.y)); ctx.lineTo(sx(g.B.x),sy(g.B.y)); ctx.lineTo(sx(g.C.x),sy(g.C.y)); ctx.closePath();
    }else if(sg.verts){
      ctx.moveTo(sx(sg.verts[0].x),sy(sg.verts[0].y));
      for(let i=1;i<sg.verts.length;i++) ctx.lineTo(sx(sg.verts[i].x),sy(sg.verts[i].y));
      ctx.closePath();
    }else if(sg.kind==='circle'){
      ctx.arc(sx(sg.cx),sy(sg.cy),sw(sg.r),0,Math.PI*2);
    }else if(sg.kind==='body'){
      const h=sg.hb, x=sx(h.x), y=sy(h.y), w=sw(h.w), bh=sw(h.h);
      const rx=x-sw(3), rw=w+sw(6), recH=sw(12), r=Math.max(1,sw(4));
      ctx.moveTo(rx+r,y); ctx.lineTo(rx+rw-r,y); ctx.quadraticCurveTo(rx+rw,y,rx+rw,y+r);
      ctx.lineTo(rx+rw,y+recH); ctx.lineTo(x+w,y+recH+sw(2));          // record -> cabinet step
      ctx.lineTo(x+w,y+bh-r); ctx.quadraticCurveTo(x+w,y+bh,x+w-r,y+bh);
      ctx.lineTo(x+r,y+bh); ctx.quadraticCurveTo(x,y+bh,x,y+bh-r);
      ctx.lineTo(x,y+recH+sw(2)); ctx.lineTo(rx,y+recH); ctx.lineTo(rx,y+r);
      ctx.quadraticCurveTo(rx,y,rx+r,y); ctx.closePath();
    }else return false;
    ctx.clip(); return true;
  }
  // The pooling highlight, shaped to the exact surface it sits on.
  function drawShapePool(an,q,X0,Y0,al,sg){
    if(an.pool==='apex'){                                  // triangle tip: ink spills down both slopes
      const g=sg.tri, k=0.18;
      const L={x:g.A.x+(g.B.x-g.A.x)*k,y:g.A.y+(g.B.y-g.A.y)*k};
      const R={x:g.A.x+(g.C.x-g.A.x)*k,y:g.A.y+(g.C.y-g.A.y)*k};
      ctx.strokeStyle=IC('rgba(110,0,14,'+(0.78*al).toFixed(3)+')'); ctx.lineWidth=Math.max(1,sw(2.2));
      ctx.beginPath(); ctx.moveTo(sx(L.x),sy(L.y)); ctx.lineTo(sx(g.A.x),sy(g.A.y)); ctx.lineTo(sx(R.x),sy(R.y)); ctx.stroke();
    }else if(an.pool==='base'){                             // flat base edge of the wedge
      const g=sg.tri;
      const p0={x:g.B.x+(g.C.x-g.B.x)*0.32,y:g.B.y+(g.C.y-g.B.y)*0.32};
      const p1={x:g.B.x+(g.C.x-g.B.x)*0.68,y:g.B.y+(g.C.y-g.B.y)*0.68};
      ctx.strokeStyle=IC('rgba(110,0,14,'+(0.72*al).toFixed(3)+')'); ctx.lineWidth=Math.max(1,sw(2));
      ctx.beginPath(); ctx.moveTo(sx(p0.x),sy(p0.y)); ctx.lineTo(sx(p1.x),sy(p1.y)); ctx.stroke();
    }else if(an.pool==='edge'){                             // a flat edge of a square / pentagon / hexagon / heptagon
      const ex=an.q.x-an.p.x, ey=an.q.y-an.p.y, el=Math.hypot(ex,ey)||1, ux=ex/el, uy=ey/el;
      const half=Math.max(2,sw(3+q.r*0.9));
      ctx.strokeStyle=IC('rgba(110,0,14,'+(0.78*al).toFixed(3)+')'); ctx.lineWidth=Math.max(1,sw(2.4));
      ctx.beginPath(); ctx.moveTo(X0-ux*half,Y0-uy*half); ctx.lineTo(X0+ux*half,Y0+uy*half); ctx.stroke();
      ctx.strokeStyle=IC('rgba(255,170,180,'+(0.32*al).toFixed(3)+')'); ctx.lineWidth=Math.max(1,sw(0.8));
      ctx.beginPath(); ctx.moveTo(X0-ux*half*0.6,Y0-uy*half*0.6); ctx.lineTo(X0+ux*half*0.6,Y0+uy*half*0.6); ctx.stroke();
    }else if(an.pool==='rim'){                              // round foe: a highlight arc on the rim
      const ang=Math.atan2(an.y-sg.cy,an.x-sg.cx);
      ctx.strokeStyle=IC('rgba(110,0,14,'+(0.72*al).toFixed(3)+')'); ctx.lineWidth=Math.max(1,sw(2));
      ctx.beginPath(); ctx.arc(sx(sg.cx),sy(sg.cy),sw(sg.r*0.9),ang-0.34,ang+0.34); ctx.stroke();
    }else if(an.pool==='shoulder'){                          // character: a pool across the record / shoulders
      const half=Math.max(3,sw(5+q.r));
      ctx.fillStyle=IC('rgba(110,0,14,'+(0.78*al).toFixed(3)+')');
      ctx.fillRect(X0-half,Y0-Math.max(1,sw(1.6)),half*2,Math.max(2,sw(2.4)));
      ctx.fillStyle=IC('rgba(255,170,180,'+(0.4*al).toFixed(3)+')');
      ctx.fillRect(X0-half*0.5,Y0-Math.max(1,sw(2.2)),half,Math.max(1,sw(0.7)));
    }
    // 'slope' / null: the blot itself is the pool — no separate line.
  }
  // A few chunky blots per splash, stuck to a perimeter point — not a dense wash.
  function bodyStain(a,hb,wx,wy,vx,vy,me){
    const s=surfaceOnBox(hb,wx,wy,vx,vy), chunk=Math.random()<0.24;
    estains.push({e:a, me:!!me, side:s.side, t:s.t,
      r:(chunk?3.2:1.5)+Math.random()*(chunk?2.6:1.7),
      len:0, max:(s.side==='left'||s.side==='right')?9+Math.random()*24:3+Math.random()*8,
      age:0, chunk});
    if(estains.length>110) estains.splice(0,estains.length-110);
  }
  // (build 407 fix) Ink & Vinyl has blood (bloodAmt) but none of GORE's look or sound: goreAmt is GORE's alone —
  // it drove the red grade and the metal hit layer, which turned I&V red and made the shutdowns loud
  // T549/T552: past the last floor the ride keeps deepening - extra blood below
  // -33, extra (thin, fast) ink above +33. The 67-dot bar itself stays capped.
  function overAmt(){
    const L=window.MV_LIFT, ov=L?(L.over||0)/20:0;
    return ov<=0?0:ov*((L.pull||0)>=0?1:0);
  }
  // FILTER EXCLUSIVITY: the red grade, the metal layer, the glass splatter and
  // the heavy hit layer are GORE's alone. `MV_BETA.bloodOn` is a STORY-SAVE flag
  // (a journey started on GORE keeps its blood in the other filters, build 362):
  // it carries the LIQUID, never the GORE filter's look. A boolean left over from
  // GORE must never turn a second filter on — exactly one filter is active.
  function bloodAmt(){
    const sp=SPILL(); if(sp==='off') return 0;      // no blood unless the spill option is on
    if(sp==='ink') return Math.min(1.6,0.85+overAmt()*0.6);
    return Math.min(1.6,Math.max(goreAmt(),0.7)+overAmt()*0.6);
  }
  function goreAmt(){
    const base=(window.MV_CONSOLE&&MV_CONSOLE.mode==='gore')?1:0;   // only the chosen GORE filter (the deep-ride effect below is additive)
    const chosen=base?(0.55+0.45*Math.min(1,floorsDown()/33))*(1-rideInk()):0;   // picked in Options: on, gorier as he goes down
    return Math.max(0,Math.min(1,Math.max(chosen, deepAmt())));
  }
  // the creepy look below 17 floors down, the heavenly one going up (drawn over the world, under the HUD)
  const motes=[];
  function depthOverlay(){
    if(typeof _gameState==='undefined'||_gameState!=='game'||!(window.MV_BETA&&MV_BETA.on&&MV_BETA.stageId==='1.3')) return;
    if(MV_BETA.results||MV_BETA.popup||MV_BETA.ending||MV_BETA.trans) return;          // not over a full-screen window
    const W0=ctx.canvas.width, H0=ctx.canvas.height, t=(typeof fr!=='undefined'?fr:0);
    const creep=deepAmt();
    if(creep>0.01){
      ctx.save(); ctx.setTransform(1,0,0,1,0,0);
      const pulse=0.85+0.15*Math.sin(t*0.035);
      const vg=ctx.createRadialGradient(W0/2,H0/2,H0*(0.42-0.18*creep),W0/2,H0/2,H0*0.85);
      vg.addColorStop(0,'rgba(40,0,6,0)'); vg.addColorStop(1,'rgba(40,0,6,'+(0.78*creep*pulse).toFixed(3)+')');
      ctx.fillStyle=vg; ctx.fillRect(0,0,W0,H0);
      ctx.globalCompositeOperation='multiply'; ctx.fillStyle='rgba(255,'+(200-90*creep|0)+','+(200-110*creep|0)+',1)'; ctx.globalAlpha=0.35*creep; ctx.fillRect(0,0,W0,H0);
      ctx.restore();
    }
    const heav=Math.min(1,floorsUp()/33);
    if(heav>0.01){
      ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalCompositeOperation='lighter';
      const top=ctx.createLinearGradient(0,0,0,H0*0.8); top.addColorStop(0,'rgba(255,240,200,'+(0.32*heav).toFixed(3)+')'); top.addColorStop(1,'rgba(255,240,200,0)');
      ctx.fillStyle=top; ctx.fillRect(0,0,W0,H0);
      for(let i=0;i<5;i++){                                                                              // soft light rays from above
        const x=W0*(0.12+i*0.19)+Math.sin(t*0.004+i*1.7)*W0*0.05, w=W0*0.07*(1+0.4*Math.sin(t*0.01+i)), a=0.09*heav*(0.6+0.4*Math.sin(t*0.013+i*2.1));
        const rg=ctx.createLinearGradient(0,0,0,H0); rg.addColorStop(0,'rgba(255,248,220,'+a.toFixed(3)+')'); rg.addColorStop(1,'rgba(255,248,220,0)');
        ctx.fillStyle=rg; ctx.beginPath(); ctx.moveTo(x-w*0.3,0); ctx.lineTo(x+w*0.3,0); ctx.lineTo(x+w*1.6,H0); ctx.lineTo(x-w*0.6,H0); ctx.closePath(); ctx.fill();
      }
      if(motes.length<Math.round(40*heav)&&Math.random()<0.5) motes.push({x:Math.random()*W0,y:H0+10,v:0.4+Math.random()*0.9,r:1+Math.random()*2.2,ph:Math.random()*6.3});
      for(let i=motes.length-1;i>=0;i--){ const m=motes[i]; m.y-=m.v; m.x+=Math.sin(t*0.02+m.ph)*0.4; if(m.y<-10){ motes.splice(i,1); continue; }
        ctx.fillStyle='rgba(255,246,210,'+(0.55*heav).toFixed(3)+')'; ctx.beginPath(); ctx.arc(m.x,m.y,m.r,0,6.283); ctx.fill(); }
      ctx.restore();
    }else motes.length=0;
  }
  window.MV_DEPTH={floorsDown, floorsUp, deepAmt, goreAmt:()=>goreAmt()};
  window.addEventListener('load',()=>{ const _o=window.drawDamageOverlay; window.drawDamageOverlay=function(){ const r=typeof _o==='function'?_o.apply(this,arguments):undefined; try{ depthOverlay(); }catch(e){} return r; }; });
  function gore(){ return bloodAmt()>0.04; }
  function playing(){ return gore()&&typeof _gameState!=='undefined'&&_gameState==='game'; }
  // Camera-culled: an impact the camera cannot see barely makes particles at
  // all. View is in world coords, so this needs no canvas / draw-time state.
  function nearView(x,y,margin){
    margin=margin||100;
    try{
      const Z=(typeof sw==='function'?sw(1000)/1000:1)||1;
      const vx0=(typeof _rcamX!=='undefined'&&_rcamX!=null)?_rcamX:(typeof camX!=='undefined'?camX:0);
      const vy0=(typeof _rcamY!=='undefined'&&_rcamY!=null)?_rcamY:(typeof camY!=='undefined'?camY:0);
      const vw=typeof camViewW==='function'?camViewW():(typeof W!=='undefined'?W/Z:1024);
      const vh=typeof camViewH==='function'?camViewH():(typeof H!=='undefined'?H/Z:768);
      return x>vx0-margin&&x<vx0+vw+margin&&y>vy0-margin&&y<vy0+vh+margin;
    }catch(e){ return true; }
  }
  function spray(x,y,n,bias){
    if(!playing()||!isFinite(x)||!isFinite(y)) return;
    const scale=bloodAmt();
    // "More blood — make it spill": heavier spray on every hit and kill, ink
    // included. Everything stays camera-culled and hard-capped further down.
    n=Math.max(1,Math.round(n*(INK()?1.2:1.3)*Math.min(1.15,Math.max(0.85,scale))));
    if(!nearView(x,y)) n=Math.min(n,4);
    const base=bias==null?-Math.PI/2:bias;
    for(let i=0;i<n;i++){
      const a=base+(Math.random()-0.5)*2.9;
      const sp=2.4+Math.random()*9.5;
      const chunk=i%5===0;
      drops.push({x,y,px:x,py:y,vx:Math.cos(a)*sp*(chunk?0.7:1),vy:Math.sin(a)*sp-1.6,r:(chunk?3.8:1.3)+Math.random()*(chunk?4.4:2.8),t:0,max:(chunk?46:20)+Math.random()*26|0,chunk});
    }
    if(n>=8){ splashN+=n; burstN++; burstT=22; }
    // T553 / Paulo (this task): a direct splash sticks to the SURFACE of whoever was hit —
    // MIND, the sibling, or a foe (boss included) — on that actor's REAL collision box.
    // Ink & Vinyl takes the same geometry but IC() keeps it ink, never GORE red.
    try{
      const cands=[];
      if(typeof p!=='undefined'&&p) cands.push(p);
      const Sib=window.MV_SIBLING&&MV_SIBLING.state?MV_SIBLING.state():null;
      if(Sib) cands.push(Sib);
      if(typeof ENEMS!=='undefined') for(const e of ENEMS) if(e) cands.push(e);
      for(const a of cands){
        if(!a||!isFinite(a.x)) continue;
        const hb=actorHB(a); if(!hb||hb.w<=0||hb.h<=0) continue;
        if(x<hb.x-6||x>hb.x+hb.w+6||y<hb.y-6||y>hb.y+hb.h+6) continue;
        if(Math.random()<0.75) bodyStain(a,hb,x,y,0,0,a===p||a===Sib);  // a blot or two, not a scatter
        break;
      }
    }catch(e){}
    if(drops.length>500) drops.splice(0,drops.length-500);
  }
  // A pile of hits in the same moment throws blood on the glass.
  function screenBurst(hits){
    if(typeof W!=='number'||typeof H!=='number') return;
    const count=4+Math.min(10,hits*2);
    for(let k=0;k<count;k++){
      glass.push({
        x:18+Math.random()*(W-36),
        y:12+Math.random()*H*0.62,
        r:14+Math.random()*42,
        a:0.42+Math.random()*0.38,
        rot:Math.random()*6,
        drip:0,
        dripMax:50+Math.random()*110,
        life:1,
        fade:0.0022+Math.random()*0.0016
      });
    }
    if(glass.length>24) glass.splice(0,glass.length-24);
  }
  function splashSfx(amount){
    try{
      const a=typeof ga==='function'?ga():null; if(!a||a.state!=='running') return;
      const sv=Math.max(0,Math.min(1,(typeof OPT!=='undefined'&&OPT.sfxVol!=null)?OPT.sfxVol:1));
      if(sv<=0.001) return;
      const t=a.currentTime;
      const big=Math.max(0,Math.min(1,(amount-20)/120));
      const nbuf=a.createBuffer(1,a.sampleRate*0.4|0,a.sampleRate), d=nbuf.getChannelData(0);
      for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
      const src=a.createBufferSource(); src.buffer=nbuf;
      const bp=a.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=900+big*700; bp.Q.value=0.7;
      const hp=a.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=280;
      const g=a.createGain();
      g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime((0.16+0.22*big)*sv,t+0.012);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.16+big*0.12);
      src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(a.destination);
      src.start(t); src.stop(t+0.35);
      const dropsN=2+(big*3)|0;
      for(let i=0;i<dropsN;i++){
        const o=a.createOscillator(), og=a.createGain();
        o.type='sine'; o.frequency.setValueAtTime(420+Math.random()*380,t+0.02+i*0.03);
        o.frequency.exponentialRampToValueAtTime(140+Math.random()*80,t+0.1+i*0.03);
        og.gain.setValueAtTime(0.0001,t+0.02+i*0.03);
        og.gain.exponentialRampToValueAtTime((0.05+big*0.04)*sv,t+0.028+i*0.03);
        og.gain.exponentialRampToValueAtTime(0.0001,t+0.09+i*0.03);
        o.connect(og); og.connect(a.destination);
        o.start(t+0.02+i*0.03); o.stop(t+0.14+i*0.03);
      }
    }catch(e){}
  }
  function hitFloor(x,y){
    try{
      if(typeof gridSolid!=='function'||typeof MV_GRID==='undefined'||!MV_GRID||!MV_GRID.tile) return false;
      if(typeof gridWorldSolid==='function') return !!gridWorldSolid(x,y);      // (build 408) the exact shape, ramps included
      const t=MV_GRID.tile;
      return gridSolid(Math.floor(x/t), Math.floor(y/t));
    }catch(e){ return false; }
  }
  // ── Paulo, Nov 4 (build 362): blood on a floor is liquid. Drops that land merge into a
  //   flat, glossy puddle on that floor; it spreads a little, and where it reaches the edge of
  //   the platform it runs over the lip: a drip swells under the edge, lets go, and falls to
  //   the platform below, where it pools again. (Blood that hits a wall still stains it.)
  const puddles=[], hang=[], seeps=[], films=[], clouds=[];
  const TS=()=>(typeof MV_GRID!=='undefined'&&MV_GRID&&MV_GRID.tile)||32;
  function floorTop(x,y){ const t=TS(); return hitFloor(x,y+2)?Math.floor((y+2)/t)*t:null; }
  function onFloor(x,fy){ return hitFloor(x,fy+3)&&!hitFloor(x,fy-3); }
  // A drop inside a roof must land on the highest face, not a tile buried in the stack.
  function surfaceTop(x,y){
    const t=TS();
    if(hitFloor(x,y)){
      let yy=y;
      for(let n=0;n<20&&hitFloor(x,yy-3);n++) yy-=t;
      const fy=Math.floor(yy/t)*t;
      if(onFloor(x,fy)) return fy;
    }
    return floorTop(x,y);
  }
  // Fish-scale roofs: a scale's crown is the high paint, the gap between scales is deeper.
  // 0 at a crown, ~5 in a groove. Liquid settles into the grooves first.
  function crownSag(x){
    const t=TS(), lx=((x%t)+t)%t;
    const fromCrown=Math.abs(((lx%16)+16)%16-8);
    return (fromCrown/8)*5;
  }
  function pour(x,fy,m){
    if(!isFinite(x)||fy==null) return;
    const reach=10+Math.sqrt(Math.max(0,m))*10;
    for(const q of puddles) if(q.y===fy&&x>=q.x0-reach&&x<=q.x1+reach){ q.m=Math.min(55,q.m+m); q.x0=Math.min(q.x0,x-4); q.x1=Math.max(q.x1,x+4); q.age=0; return; }
    puddles.push({x0:x-6,x1:x+6,y:fy,m,age:0,dl:0,dr:0,ph:Math.random()*6,seepN:0});
    if(puddles.length>100) puddles.shift();
  }
  function addHang(x,y,m){
    const mm=Math.max(0.08,m);
    for(const h of hang) if(Math.abs(h.x-x)<14&&Math.abs(h.y-y)<10){ h.m=Math.min(4.5,h.m+mm); return; }
    hang.push({x,y,g:0,m:mm});
    if(hang.length>48) hang.shift();
  }
  function addFilm(x,y,m){
    for(const f of films) if(Math.abs(f.y-y)<8&&x>=f.x0-18&&x<=f.x1+18){ f.m=Math.min(14,f.m+m); f.x0=Math.min(f.x0,x-2); f.x1=Math.max(f.x1,x+2); f.age=0; return; }
    films.push({x0:x-4,x1:x+4,y,m:Math.max(0.08,m),age:0});
    if(films.length>40) films.shift();
  }
  function ceilingAt(x,y){ return hitFloor(x,y-3)&&!hitFloor(x,y+2); }
  window.MV_BLOOD={pour:(x,fy,m)=>{ if(playing()) pour(x,fy,m); }, spray:(x,y,n,b)=>spray(x,y,n,b), state:()=>({drops:drops.length, seeps:seeps.length, seepsDone:seeps.filter(q=>q.done).length, onChars:estains.filter(q=>q.me).length, puddles:puddles.length})};
  // Paulo, Nov 13: blood (and ink) never hangs in the air or sits inside a wall: it lands on a surface; on a wall
  // it slides down in a little line, and where the wall ends it lets go as a drop that falls to the next surface
  function splat(x,y,r){
    const fy=surfaceTop(x,y);
    if(fy!=null&&onFloor(x,fy)){ pour(x,fy,0.7+r*0.45); return; }
    let side=0; for(const s of [-1,1]) if(hitFloor(x+s*4,y)){ side=s; break; }
    if(!side){ if(hitFloor(x,y)) return; drops.push({x,y,px:x,py:y,vx:0,vy:0.8,r:Math.max(1,r),t:5,max:900,chunk:false,drip:true}); return; }   // nothing to stick to: it keeps falling
    let sx0=x; for(let k=0;k<6&&!hitFloor(sx0+side*1,y);k++) sx0+=side;           // right on the wall's face
    stains.push({x:sx0,y,r:1.1+Math.random()*1.6,a:0.35+Math.random()*0.3,rot:Math.random()*Math.PI,drip:INK()?30+Math.random()*50:8+Math.random()*18,bits:2+Math.random()*3|0, side, y0:y});
    if(stains.length>220) stains.splice(0,stains.length-220);
  }
  function puddleTick(){
    for(let i=puddles.length-1;i>=0;i--){
      const q=puddles[i]; q.age++;
      if(q.age>60*70||q.m<0.08){ puddles.splice(i,1); continue; }
      const want=6+Math.sqrt(q.m)*14, half=(q.x1-q.x0)/2;
      const rate=(INK()?0.32:0.14)*(0.35+Math.min(1.6,q.m*0.07));
      if(half<want){ q.x0-=rate; q.x1+=rate; }
      // grooves are deeper than the crowns, so a shallow pool creeps into them
      const sL=crownSag(q.x0), sR=crownSag(q.x1);
      if(q.m<6){ if(sR>sL+0.6) q.x1+=rate*0.45; else if(sL>sR+0.6) q.x0-=rate*0.45; }
      // past the lip: the edge stops at the drop and the blood runs over it
      for(const side of [-1,1]){
        const ex=side<0?q.x0:q.x1;
        if(onFloor(ex,q.y)) continue;
        if(hitFloor(ex,q.y-3)){ let k=ex; for(let n=0;n<64&&hitFloor(k,q.y-3);n++) k-=side; if(side<0) q.x0=k; else q.x1=k; continue; }   // a slope / wall rises here: the edge stops, nothing runs into it
        let k=ex; for(let n=0;n<64&&!onFloor(k,q.y);n++) k-=side;     // back to the last floor under it
        if(side<0) q.x0=k; else q.x1=k;
        const key=side<0?'dl':'dr';
        q[key]+=(INK()?0.055:0.028)*(0.45+Math.min(2.2,q.m*0.09));
        if(q[key]>=1&&q.m>0.3){
          const dump=Math.min(q.m*0.32, 0.28+q.m*0.1);
          q[key]=0; q.m-=dump;
          addHang(k+side*1.5,q.y,dump);
        }
      }
    }
    // A deep pool soaks through as a few channels, not a field of straws.
    for(const q of puddles){
      const cap=q.m>8?3:1;
      if(q.age>80&&q.m>1.3&&(q.seepN||0)<cap&&seeps.length<24&&Math.random()<0.02){
        const x=q.x0+Math.random()*(q.x1-q.x0);
        if(hitFloor(x,q.y+4)){ seeps.push({x,y:q.y+1,len:0,done:false,a:0.72}); q.m-=0.28; q.seepN=(q.seepN||0)+1; }
      }
    }
    for(const s of seeps){ if(s.done) continue; s.len+=INK()?0.28:0.14;
      if(!hitFloor(s.x,s.y+s.len+1)){ s.done=true; addFilm(s.x,s.y+s.len,0.4); } }
    // Under the floor the soak is one film. It runs along the ceiling toward
    // the eaves; a thick film sheds a tongue instead of a row of beads.
    for(let i=films.length-1;i>=0;i--){
      const f=films[i]; f.age++;
      if(f.age>60*50||f.m<0.05){ films.splice(i,1); continue; }
      const flow=(INK()?1.15:0.55)*(0.12+Math.min(1.4,f.m*0.11));
      if(ceilingAt(f.x0-1,f.y)) f.x0-=flow;
      if(ceilingAt(f.x1+1,f.y)) f.x1+=flow;
      for(const side of [-1,1]){
        const ex=side<0?f.x0:f.x1;
        let lip=ex;
        if(!ceilingAt(ex,f.y)){
          let k=ex; for(let n=0;n<48&&!ceilingAt(k,f.y);n++) k-=side;
          if(side<0) f.x0=k; else f.x1=k; lip=k;
        }else if(ceilingAt(ex+side*2,f.y)) continue;
        if(f.m>0.35){ const shed=Math.min(f.m*0.025,0.012+f.m*0.006)*(INK()?1.5:1); f.m-=shed; addHang(lip,f.y,shed); }
      }
      if(f.m>2.4){ const shed=Math.min(0.04,f.m*0.004); f.m-=shed; addHang((f.x0+f.x1)*0.5,f.y,shed); }
    }
    // a heavy drip lets go sooner and keeps a neck behind it
    for(let i=hang.length-1;i>=0;i--){
      const h=hang[i]; h.g+=(INK()?0.09:0.045)*(0.55+Math.min(2,h.m||0.2));
      if(h.g>=1){
        const r=Math.max(1.2,Math.min(3.4,0.7+(h.m||0.2)*1.15));
        drops.push({x:h.x,y:h.y+4,px:h.x,py:h.y+4,vx:0,vy:0.35+(h.m||0.2)*0.4,r,t:5,max:400,chunk:false,drip:true});
        if((h.m||0)>0.85){ h.m*=0.42; h.g=0.15; }
        else hang.splice(i,1);
      }
    }
  }
  function drawSeeps(){
    // T546: on a ramp the soak follows the slope diagonal instead of standing as a
    // vertical ladder rung. Flat floors keep the straight strip.
    for(const s of seeps){
      const a=s.a; ctx.fillStyle=IC('rgba(100,0,12,'+a.toFixed(2)+')');
      const X=sx(s.x), Y=sy(s.y), len=Math.max(1,sw(s.len));
      const sl=typeof gridSlopeAt==='function'?gridSlopeAt(Math.floor(s.x/32),Math.floor(s.y/32)):null;
      const ang=(sl&&sl.angle)?sl.angle:0;
      if(ang){
        ctx.save(); ctx.translate(X,Y); ctx.rotate(ang);
        ctx.fillRect(-Math.max(0.5,sw(0.55)),0,Math.max(1,sw(1.1)),len);
        ctx.restore();
      }else ctx.fillRect(X-Math.max(0.5,sw(0.55)),Y,Math.max(1,sw(1.1)),len);
    }
  }
  function drawFilms(){
    for(const f of films){
      if(!nearView((f.x0+f.x1)/2,f.y,160)) continue;
      const x0=sx(f.x0), x1=sx(f.x1), y=sy(f.y), w=x1-x0;
      if(w<1) continue;
      const th=Math.max(1.2,sw(0.7+Math.sqrt(f.m)*1.15));
      const mid=(x0+x1)*0.5;
      ctx.fillStyle=IC('#5a000c');
      ctx.beginPath();
      ctx.moveTo(x0,y);
      ctx.quadraticCurveTo(mid,y+th*1.35,x1,y);
      ctx.lineTo(x1,y+th*0.28);
      ctx.quadraticCurveTo(mid,y+th*0.55,x0,y+th*0.28);
      ctx.closePath(); ctx.fill();
    }
  }
  function drawPuddles(){
    for(const q of puddles){
      if(!nearView((q.x0+q.x1)/2,q.y,160)) continue;                  // draw-time camera cull
      const a=Math.min(1,(60*70-q.age)/(60*6)), th=Math.min(4.5,1.4+Math.sqrt(q.m)*0.9);
      const x0=sx(q.x0), x1=sx(q.x1), y=sy(q.y), h=Math.max(1.5,sw(th)), w=x1-x0;
      if(w<1) continue;
      ctx.save(); ctx.globalAlpha=a;
      // Shallow liquid follows the scale grooves. A deep pool fills them and sits level.
      const fill=Math.min(1,q.m/8), dip=1-fill*0.85;
      const g=ctx.createLinearGradient(0,y-h,0,y+1);
      g.addColorStop(0,IC('#a3061e')); g.addColorStop(0.5,IC('#6e0010')); g.addColorStop(1,IC('#3a0006'));
      ctx.fillStyle=IC(g); ctx.beginPath();
      ctx.moveTo(x0,y+0.5);
      ctx.lineTo(x0,y-h*(0.25+0.2*fill));
      const n=Math.max(4,Math.min(16,Math.round(w/8)));
      for(let k=0;k<=n;k++){
        const u=k/n, wx=q.x0+(q.x1-q.x0)*u;
        ctx.lineTo(x0+w*u, y-h*(0.42+0.58*fill)+sw(crownSag(wx))*dip);
      }
      ctx.lineTo(x1,y+0.5);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle=IC('rgba(255,140,150,0.4)'); ctx.lineWidth=Math.max(1,sw(0.6));
      ctx.beginPath(); ctx.moveTo(x0+w*0.15,y-h*(0.35+0.4*fill)); ctx.lineTo(x0+w*0.5,y-h*(0.4+0.42*fill)); ctx.stroke();
      ctx.restore();
    }
    // a drip is a tongue: wider and longer when more of it is hanging there
    for(const h of hang){
      const X=sx(h.x), Y=sy(h.y), m=h.m||0.2;
      const w=Math.max(1,sw(0.55+m*1.5)), len=sw(3+h.g*(7+m*6));
      ctx.fillStyle=IC('#7a0012');
      ctx.beginPath();
      ctx.moveTo(X-w*0.45,Y); ctx.lineTo(X+w*0.45,Y);
      ctx.lineTo(X+w*0.16,Y+len); ctx.lineTo(X-w*0.16,Y+len);
      ctx.closePath(); ctx.fill();
    }
  }
  function tick(){
    const id=window.MV_BETA&&MV_BETA.stageId;
    if(id!==stage){ stage=id; clouds.length=0; if(window.MV_BETA) MV_BETA.waterStain=0; drops.length=0; stains.length=0; glass.length=0; puddles.length=0; hang.length=0; films.length=0; estains.length=0; seeps.length=0; burstN=0; splashN=0; }
    if(!playing()){ drops.length=0; splashN=0; burstN=0; if(!gore()){ stains.length=0; glass.length=0; puddles.length=0; hang.length=0; films.length=0; seeps.length=0; } return; }
    const deep=goreAmt()>=0.55;
    if(deep&&splashN>=90) screenBurst(4);
    if(splashN>0){ splashSfx(splashN); splashN=0; }
    if(burstT>0) burstT--; else burstN=0;
    if(deep&&burstN>=3){ screenBurst(burstN); burstN=0; burstT=0; }
    else if(!deep){ burstN=0; burstT=0; }
    if(typeof p!=='undefined'&&p&&typeof fr==='number'&&fr%36===0&&Math.abs(p.vx||0)>0.4&&fr-(p._bledFr||-9999)<300){   // (build 408) a trail only for a few seconds after he's been hit
      const x=p.x+(typeof SW==='number'?SW:40)*0.5, y=p.y+(typeof FEET_OFF==='number'?FEET_OFF:48)-8;
      spray(x+(p.fc?6:-6), y, 1, Math.PI/2+0.2);
    }
    puddleTick();
    const B0=window.MV_BETA||{};
    if(B0.waterStain>0) B0.waterStain=Math.max(0,B0.waterStain-0.00003);
    for(let i=clouds.length-1;i>=0;i--){ const c=clouds[i]; c.t++; c.r+=0.25; c.y-=0.05; if(c.t>90) clouds.splice(i,1); }
    // stains on a body under water wash off (and colour the water) — test the
    // point on the DRAWN silhouette, not the empty corner of the combat box.
    for(const q of estains){ const e=q.e; if(!e||!B0.inWater) continue;
      const hb=actorHB(e); if(!hb||hb.w<=0) continue;
      if(!nearView(hb.x+hb.w/2,hb.y+hb.h/2,90)) continue;
      const sg=shapeGeom(hb,e,silhouetteKind(e));
      const an=shapeAnchor(sg,q.side,q.t), pt=an||boxPoint(hb,q.side,q.t);
      if(B0.inWater(pt.x,pt.y)){ q.age+=25; B0.waterStain=Math.min(1,(B0.waterStain||0)+0.0015); if(Math.random()<0.2) clouds.push({x:pt.x,y:pt.y,r:3,t:0}); } }
    for(let i=drops.length-1;i>=0;i--){
      const d=drops[i];
      d.px=d.x; d.py=d.y;
      d.vy+=0.32; d.x+=d.vx; d.y+=d.vy; d.vx*=0.985; d.t++;
      // (Paulo, Nov 13) into the water it dilutes: no splat, a little cloud, and the water takes the colour
      if(B0.inWater&&B0.inWater(d.x,d.y)){ B0.waterStain=Math.min(1,(B0.waterStain||0)+0.004*Math.max(0.5,d.r)); clouds.push({x:d.x,y:d.y,r:3+d.r*2,t:0}); if(clouds.length>60) clouds.shift(); drops.splice(i,1); continue; }
      // (Paulo, Nov 13 / this task) a drop that flies into an actor sticks to the edge of
      // his REAL box and runs down it — the same way a drop lands on a wall or a floor.
      if(d.t>3&&!d.drip&&!d._bodyChk){
        const cands=[];
        if(!d.own&&typeof p!=='undefined'&&p) cands.push(p);
        const Sib=window.MV_SIBLING&&MV_SIBLING.on&&MV_SIBLING.state?MV_SIBLING.state():null;
        if(Sib&&!d.own) cands.push(Sib);
        if(typeof ENEMS!=='undefined') for(const e of ENEMS) if(e&&!e._gone) cands.push(e);
        for(const a of cands){
          const hb=actorHB(a); if(!hb||hb.w<=0||hb.h<=0) continue;
          if(d.x>hb.x&&d.x<hb.x+hb.w&&d.y>hb.y&&d.y<hb.y+hb.h){
            d._bodyChk=true;                                    // one chance per drop
            if(Math.random()<0.35){ bodyStain(a,hb,d.x,d.y,d.vx,d.vy,a===p||a===Sib); d._gone=true; drops.splice(i,1); }
            break;
          }
        }
        if(d._gone) continue;
      }
      if(d.t>4&&(hitFloor(d.x,d.y+2)||hitFloor(d.x,d.y))){ splat(d.px,d.py,d.r*0.4); drops.splice(i,1); continue; }
      if(d.t>=Math.max(d.max,600)||d.y>(typeof MV_GRID!=='undefined'&&MV_GRID?MV_GRID.rows*MV_GRID.tile:1e5)){ drops.splice(i,1); }   // (out of the world or very old: gone, never a stain in the air)
    }
    // stains on a wall run down its face; past its bottom edge the run lets go and drips to what's below
    for(const s of stains){ if(!s.side||!(s.drip>0)) continue;
      const ny=s.y+(INK()?0.6:0.35);
      if(!hitFloor(s.x+s.side*3,ny+2)){ drops.push({x:s.x,y:ny+2,px:s.x,py:ny,vx:0,vy:0.6,r:1.4,t:5,max:900,chunk:false,drip:true}); s.drip=0; continue; }
      s.ly=ny;
    }
  }
  // (Paulo, Nov 13) "We also bleed if we get hit": a spray off MIND on every hit that hurts him
  window.addEventListener('load',()=>{ const _h=window.applyPlayerHit; if(typeof _h!=='function') return;
    window.applyPlayerHit=function(kx,ky,dmg){ const hp0=typeof p!=='undefined'&&p?p.hp:0; const r=_h.apply(this,arguments);
      try{ if(p&&p.hp<hp0) p._bledFr=fr; if(p&&p.hp<hp0&&playing()){ const n=Math.min(30,6+Math.round((hp0-p.hp)*0.7)); const k0=drops.length; spray(p.x+SW/2,p.y+FEET_OFF-55,n,Math.atan2((ky||-1),(kx||0))||-Math.PI/2); for(let j=k0;j<drops.length;j++) drops[j].own=true; } }catch(e){}
      return r; }; });
  // Paulo, Nov 13: Ink & Vinyl gets its own words, wholesome ones, in a dreamy cloud: a soft good-night when a foe
  // is off for good, a sleepy "not yet" on a 1st / 2nd shutdown
  const dreams=[], DREAM_OFF=['SWEET DREAMS','SLEEP TIGHT','REST NOW','NIGHT NIGHT','PEACE, LITTLE ONE'], DREAM_NOT=['NOT SLEEPY YET...','FIVE MORE MINUTES!','ALMOST DOZING...','ONE MORE SONG?'];
  window.addEventListener('load',()=>{ const _d=window._damageEnemy; if(typeof _d!=='function') return;
    window._damageEnemy=function(e){ const pre=e&&e.hp; const r=_d.apply(this,arguments);
      try{ if(e&&IVF()&&typeof _gameState!=='undefined'&&_gameState==='game'&&e.hp<=0&&(pre==null||pre>0)){
        const off=!!(e._lastShutPerm||e._permOff||e._stayDown), L=off?DREAM_OFF:DREAM_NOT;
        dreams.push({x:(e.x||0)+(e.w||32)/2, y:(e.y||0)-10, word:L[(Math.random()*L.length)|0], t:0, max:off?120:90, big:off}); if(dreams.length>5) dreams.shift(); } }catch(er){}
      return r; }; });
  function drawDreams(){
    for(let i=dreams.length-1;i>=0;i--){ const d=dreams[i]; if(++d.t>d.max){ dreams.splice(i,1); continue; }
      const k=d.t/d.max, a=Math.min(1,d.t/10,(d.max-d.t)/20), X=sx(d.x), Y=sy(d.y)-k*40-Math.sin(d.t*0.08)*4;
      const tw=(typeof textW==='function'?textW(d.word,2):d.word.length*12)+30, th=34;
      ctx.save(); ctx.globalAlpha=a;
      ctx.fillStyle='rgba(150,170,220,0.35)'; ctx.beginPath(); for(let j=0;j<5;j++){ const cx=X-tw/2+tw*(j+0.5)/5, r=th*(0.5+0.18*Math.sin(j*1.7+d.t*0.05)); ctx.moveTo(cx+r,Y+4); ctx.arc(cx,Y+4,r,0,Math.PI*2); } ctx.fill();
      ctx.fillStyle='#fbfaff'; ctx.beginPath(); for(let j=0;j<5;j++){ const cx=X-tw/2+tw*(j+0.5)/5, r=th*(0.46+0.16*Math.sin(j*1.7+d.t*0.05)); ctx.moveTo(cx+r,Y); ctx.arc(cx,Y,r,0,Math.PI*2); } ctx.fill();
      for(let j=0;j<3;j++){ ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(X-tw/2-6-j*8,Y+12+j*8,4-j,0,Math.PI*2); ctx.fill(); }
      if(typeof drawTextC==='function') drawTextC(d.word,X,Y-7,'#3a3a5a',2);
      ctx.restore(); }
  }
  function drawBlood(){
    if(!playing()||typeof sx!=='function') return;
    // Paulo, Nov 12: "the blood sprites are showing through the level clear screen". Blood is painted after
    // the frame, over everything: never while a full-screen window is up (item, results, ending, ...).
    { const Bq=window.MV_BETA; if(Bq&&(Bq.results||Bq.popup||Bq.ending||Bq.trans||Bq.contScreen||Bq.overT>0)) return; }
    const zOwn=!(typeof _zoomSaved!=='undefined'&&_zoomSaved);                 // (inside the world pass the zoom may already be on)
    if(zOwn&&typeof _worldZoomBegin==='function') _worldZoomBegin();
    try{ drawSeeps(); drawFilms(); drawPuddles(); }catch(e){}
    for(const c of clouds){ const a=0.35*(1-c.t/90); ctx.fillStyle=IC('rgba(140,0,16,'+a.toFixed(3)+')'); ctx.beginPath(); ctx.arc(sx(c.x),sy(c.y),Math.max(1,sw(c.r)),0,Math.PI*2); ctx.fill(); }
    try{ if(IVF()) drawDreams(); }catch(e){}
    for(const s of stains){
      if(s.drip>0){ if(s.side){ if(s.ly!=null) s.y=s.ly; } s.drip--; }   // (a wall stain's run is moved in tick(); floor stains don't run)
      if(!nearView(s.x,s.y,80)) continue;                               // draw-time camera cull
      if(s.side&&s.y0!=null&&s.y>s.y0+1){ ctx.fillStyle=IC('rgba(110,0,12,'+(s.a*0.8).toFixed(2)+')'); ctx.fillRect(sx(s.x)-Math.max(0.6,sw(0.7)),sy(s.y0),Math.max(1,sw(1.4)),sy(s.y)-sy(s.y0)); }   // the line it leaves running down")
      ctx.save();
      ctx.translate(sx(s.x),sy(s.y)); ctx.rotate(s.rot);
      for(let b=0;b<(s.bits||3);b++){
        const ox=((b*5)%7)-3, oy=((b*3)%5)-1;
        ctx.fillStyle=IC('rgba('+(90+b*20)+',0,10,'+s.a.toFixed(2)+')');
        ctx.fillRect(sw(ox)*0.15, sw(oy), Math.max(1,sw(s.r*0.55)), Math.max(2,sw(s.r*(1.4+b*0.2))));
      }
      if(s.drip>0){ ctx.fillStyle=IC('rgba(120,0,12,'+s.a.toFixed(2)+')'); ctx.fillRect(-0.6,0,1.2,sw(3)); }
      ctx.restore();
    }
    // Blood / ink clinging to the actor's DRAWN silhouette: blots on the outline,
    // pooling where that shape can hold it, and drips running down the surface.
    // The anchor is re-read from the LIVE box each frame so it rides the actor;
    // IC() keeps I&V's version ink, never GORE red. Unshaped props keep the old
    // rectangular treatment; foes / characters are clipped to their real outline.
    for(let i=estains.length-1;i>=0;i--){ const q=estains[i], e=q.e; q.age++;
      if(!e||!isFinite(e.x)||e._gone||e._hidden||q.age>1500||(!q.me&&ENEMS.indexOf(e)<0)){ estains.splice(i,1); continue; }
      const hb=actorHB(e); if(!hb||hb.w<=0||hb.h<=0){ estains.splice(i,1); continue; }
      if(q.me&&window.MV_LIFT&&MV_LIFT.inClosedCab&&MV_LIFT.inClosedCab(e)) continue;   // hidden with him in a closed car
      if(q.len<q.max) q.len+=0.22;
      const kind=silhouetteKind(e), bp=boxPoint(hb,q.side,q.t);
      if(!nearView(bp.x,bp.y,90)) continue;                              // cull BEFORE any path work
      const sg=shapeGeom(hb,e,kind), an=shapeAnchor(sg,q.side,q.t);
      const ax=an?an.x:bp.x, ay=an?an.y:bp.y;
      if(!nearView(ax,ay,60)) continue;                                  // draw-time camera cull
      const X0=sx(ax), Y0=sy(ay), al=Math.min(1,(1500-q.age)/200);
      if(an&&sg){                                                        // shaped foe / character
        ctx.save();
        if(clipSilhouette(sg)){
          drawShapePool(an,q,X0,Y0,al,sg);
          ctx.fillStyle=IC('rgba(120,0,14,'+(0.85*al).toFixed(3)+')');
          ctx.beginPath(); ctx.arc(X0,Y0,Math.max(1,sw(q.r)),0,Math.PI*2); ctx.fill();
          if(an.dx||an.dy){
            const run=Math.min(q.len,Math.max(0,an.run||hb.h*0.38));
            if(run>0){
              const vx=sw(an.dx), vy=sw(an.dy), L=Math.hypot(vx,vy)||1;
              const ex=X0+vx/L*sw(run), ey=Y0+vy/L*sw(run);
              ctx.strokeStyle=IC('rgba(120,0,14,'+(0.8*al).toFixed(3)+')'); ctx.lineWidth=Math.max(1,sw(1.4));
              ctx.beginPath(); ctx.moveTo(X0,Y0); ctx.lineTo(ex,ey); ctx.stroke();
              ctx.fillStyle=IC('rgba(120,0,14,'+(0.8*al).toFixed(3)+')');
              ctx.beginPath(); ctx.arc(ex,ey,Math.max(1,sw(1.3+q.r*0.15)),0,Math.PI*2); ctx.fill();
            }
          }
          if(q.chunk){ ctx.fillStyle=IC('rgba(255,170,180,'+(0.35*al).toFixed(3)+')'); ctx.fillRect(X0-sw(q.r*0.4),Y0-sw(q.r*0.4),Math.max(1,sw(1)),Math.max(1,sw(1))); }
        }
        ctx.restore();
        continue;
      }
      // ── plain rectangular box (unshaped props): the original treatment ──
      const pt=bp, vert=(q.side==='left'||q.side==='right'), top=(q.side==='top');
      const run=Math.min(q.len,Math.max(0,vert?(hb.y+hb.h-pt.y-2):hb.h*0.38));
      if(top){                                                           // puddle line on the top face
        const half=Math.max(3,sw(3+q.r*1.6));
        ctx.fillStyle=IC('rgba(110,0,14,'+(0.78*al).toFixed(3)+')');
        ctx.fillRect(X0-half,Y0-Math.max(1,sw(1.6)),half*2,Math.max(2,sw(2.6)));
        ctx.fillStyle=IC('rgba(170,10,24,'+(0.6*al).toFixed(3)+')');
        ctx.fillRect(X0-half*0.7,Y0-Math.max(1,sw(2.2)),half*1.4,Math.max(1,sw(1)));
        ctx.fillStyle=IC('rgba(255,170,180,'+(0.4*al).toFixed(3)+')');
        ctx.fillRect(X0-half*0.5,Y0-Math.max(1,sw(2.6)),half,Math.max(1,sw(0.7)));
      }
      ctx.fillStyle=IC('rgba(120,0,14,'+(0.85*al).toFixed(3)+')'); ctx.beginPath(); ctx.arc(X0,Y0,Math.max(1,sw(q.r)),0,Math.PI*2); ctx.fill();
      if(run>0){                                                         // a drip down the face it stuck to
        const dx=vert?X0:(q.t<0.5?sx(hb.x)+1:sx(hb.x+hb.w)-1), dy=vert?Y0:Y0-Math.max(1,sw(1));
        ctx.fillStyle=IC('rgba(120,0,14,'+(0.8*al).toFixed(3)+')');
        ctx.fillRect(dx-Math.max(0.6,sw(0.7)),dy,Math.max(1,sw(1.4)),sw(run));
        ctx.beginPath(); ctx.arc(dx,dy+sw(run),Math.max(1,sw(1.3+q.r*0.15)),0,Math.PI*2); ctx.fill();
      }
      if(q.chunk){ ctx.fillStyle=IC('rgba(255,170,180,'+(0.35*al).toFixed(3)+')'); ctx.fillRect(X0-sw(q.r*0.4),Y0-sw(q.r*0.4),Math.max(1,sw(1)),Math.max(1,sw(1))); } }
    ctx.lineCap='round';
    for(const d of drops){
      if(!nearView(d.x,d.y,60)) continue;                               // draw-time camera cull
      ctx.strokeStyle=IC(d.r>2.4?'#6e0010':'#c4001c');
      ctx.lineWidth=Math.max(1,sw(d.r*0.7));
      ctx.beginPath(); ctx.moveTo(sx(d.px),sy(d.py)); ctx.lineTo(sx(d.x),sy(d.y)); ctx.stroke();
      ctx.fillStyle=IC('#8f0014');
      ctx.beginPath(); ctx.arc(sx(d.x),sy(d.y),Math.max(1,sw(d.r*0.45)),0,Math.PI*2); ctx.fill();
    }
    if(zOwn&&typeof _worldZoomEnd==='function') _worldZoomEnd();
  }
  function drawGlass(){
    if(!playing()) return;
    for(let i=glass.length-1;i>=0;i--){
      const s=glass[i];
      s.life-=s.fade;
      if(s.drip<s.dripMax) s.drip+=0.55+s.r*0.012;
      if(s.life<=0){ glass.splice(i,1); continue; }
      const a=s.a*s.life;
      ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(s.rot);
      ctx.fillStyle=IC('rgba(90,0,12,'+a.toFixed(3)+')');
      ctx.beginPath(); ctx.ellipse(0,0,s.r,s.r*0.42,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=IC('rgba(150,4,16,'+(a*0.75).toFixed(3)+')');
      ctx.beginPath(); ctx.ellipse(s.r*0.15,-s.r*0.05,s.r*0.45,s.r*0.22,0.4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=IC('rgba(110,0,14,'+(a*0.9).toFixed(3)+')');
      ctx.fillRect(-1.1,s.r*0.15,2.2,s.drip);
      ctx.beginPath(); ctx.ellipse(0,s.r*0.15+s.drip,2.4+s.r*0.04,3.2,0,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }
  function metal(name, amt){
    try{
      const a=typeof ga==='function'?ga():null; if(!a) return;
      const t=a.currentTime, sv=Math.max(0,Math.min(1,(typeof OPT!=='undefined'&&OPT.sfxVol!=null)?OPT.sfxVol:1));
      const hit=/hit|punch|land|stomp|hurt|shut|enemy/.test(name||'');
      const freqs=hit?[146,220,311,466]:[98,147,220];
      freqs.forEach((f,i)=>{
        const o=a.createOscillator(), g=a.createGain();
        o.type=i%2?'triangle':'square'; o.frequency.value=f;
        const loud=Math.max(0.15,Math.min(1,amt==null?1:amt));
        g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime((hit?0.05:0.025)*sv*loud,t+0.008);
        g.gain.exponentialRampToValueAtTime(0.0001,t+(hit?0.22:0.45));
        o.connect(g); g.connect(a.destination); o.start(t); o.stop(t+0.5);
      });
    }catch(e){}
  }
  function hook(name,fn){
    const orig=window[name];
    if(typeof orig!=='function'||orig._goreBlood) return;
    const w=function(){ const r=orig.apply(this,arguments); try{ fn.apply(this,arguments); }catch(e){} return r; };
    w._goreBlood=true; window[name]=w;
  }
  hook('applyPlayerHit',function(){
    if(typeof p==='undefined'||!p) return;
    const x=p.x+(typeof SW==='number'?SW:40)*0.5, y=p.y+(typeof FEET_OFF==='number'?FEET_OFF:48)-26;
    spray(x,y,70,Math.PI/2);
  });
  if(typeof window.sfx==='function'&&!window.sfx._goreMetal){
    const origSfx=window.sfx;
    const wrapped=function(t){
      const r=origSfx.apply(this,arguments);
      const gAmt=goreAmt();
      if(gAmt>0.12&&typeof _gameState!=='undefined'&&_gameState==='game'&&/hit|punch|land|stomp|hurt|shut|enemy|jump/.test(t||'')) metal(t,gAmt);
      return r;
    };
    wrapped._goreMetal=true; window.sfx=wrapped;
  }
  hook('_damageEnemy',function(e){
    if(!e) return;
    const dir=(typeof p!=='undefined'&&p&&p.fc)?0:Math.PI;
    spray((e.x||0)+(e.w||32)*0.5, (e.y||0)+(e.h||32)*0.4, e.hp<=0?105:55, dir);
  });
  const _draw=window.draw, _update=window.update;
  window.update=function(){
    const r=_update?_update.apply(this,arguments):undefined;
    tick();
    return r;
  };
  // (Paulo, Nov 13: "the blood shouldn't appear in front of dialog boxes, like the pause menu") the world's blood is
  // painted with the foreground (over the characters, under the HUD, the menus and the dialogs); the splats on the
  // screen glass after the frame, but never over a pause menu or a dialog
  { const _fg=window.drawTmjForeground; window.drawTmjForeground=function(){ const r=_fg?_fg.apply(this,arguments):undefined; try{ if(typeof ctx!=='undefined') drawBlood(true); }catch(e){} return r; }; }
  window.draw=function(){
    if(_draw) _draw.apply(this,arguments);
    const B2=window.MV_BETA, quiet=(typeof _paused!=='undefined'&&_paused)||(B2&&(B2.talking||B2.popup||B2.results||B2.ending))||(typeof _gameState!=='undefined'&&_gameState!=='game');
    if(typeof ctx!=='undefined'&&!quiet) try{ drawGlass(); }catch(e){}
  };

  // Greens become bright glowing red. Every other hue is pulled toward
  // that red so the whole picture sits in the same key. Gore only.
  const cv=document.getElementById('c');
  const oc=document.createElement('canvas');
  oc.className='mv-gore-grade';
  oc.setAttribute('aria-hidden','true');
  oc.style.cssText='position:absolute;pointer-events:none;z-index:8;display:none;';
  function mount(){
    if(!cv||!cv.parentNode) return;
    const par=cv.parentNode;
    if(getComputedStyle(par).position==='static') par.style.position='relative';
    if(!oc.parentNode) par.appendChild(oc);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
  function syncBox(){
    if(!cv) return;
    if(oc.width!==cv.width||oc.height!==cv.height){ oc.width=cv.width; oc.height=cv.height; }
    oc.style.left=cv.offsetLeft+'px'; oc.style.top=cv.offsetTop+'px';
    oc.style.width=cv.clientWidth+'px'; oc.style.height=cv.clientHeight+'px';
  }
  let gl=null, prog=null, buf=null, tex=null, U=null, glState=0;
  function initGL(){
    if(glState) return glState>0;
    glState=-1;
    mount();
    gl=oc.getContext('webgl',{alpha:false,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:false});
    if(!gl) return false;
    const VS='attribute vec2 p; varying vec2 uv; void main(){ uv=p*0.5+0.5; gl_Position=vec4(p,0.0,1.0); }';
    const FS=`precision mediump float;
uniform sampler2D tex; uniform vec2 res; varying vec2 uv;
uniform float uT; uniform float uBeat; uniform float uSplit; uniform float uFlash; uniform float uMetal;
vec3 rgb2hsv(vec3 c){
  vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0);
  vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
  vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
  float d=q.x-min(q.w,q.y); float e=1.0e-10;
  return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)), d/(q.x+e), q.x);
}
vec3 hsv2rgb(vec3 c){
  vec3 p=abs(fract(c.xxx+vec3(0.0,2.0/3.0,1.0/3.0))*6.0-3.0);
  return c.z*mix(vec3(1.0), clamp(p-1.0,0.0,1.0), c.y);
}
float greenAmt(vec3 c){
  vec3 k=rgb2hsv(c);
  float band=smoothstep(0.10,0.18,k.x)*smoothstep(0.52,0.44,k.x);
  return band*smoothstep(0.10,0.28,k.y);
}
void main(){
  vec3 c=texture2D(tex,uv).rgb;
  if(uSplit>0.0){ vec2 so=vec2(uSplit/res.x,0.0); c.r=texture2D(tex,uv+so).r; c.b=texture2D(tex,uv-so).b; }
  vec3 k=rgb2hsv(c);
  float signedH=k.x>0.5?k.x-1.0:k.x;
  float h=fract(signedH*0.38);
  float s=min(1.0,k.y*1.08);
  float v=k.z;
    float g=greenAmt(c);
  // darken the picture. Panels stay dark. Bright greens (words, juice) stay hot.
  v=pow(v,1.18)*0.78;
  h=mix(h,0.0,g);
  s=mix(s,max(s,0.9),g);
  float hot=smoothstep(0.42,0.78,k.z);
  v=mix(v*0.62, min(1.0,k.z*1.05+0.02), hot);
  v=mix(v, mix(v, min(1.0,k.z), hot), g);
  vec3 o=hsv2rgb(vec3(h,s,v));
  // words were green. They have to stay lighter than the panel or the menu is a red box.
  float ink=g*smoothstep(0.5,0.86,k.z);
  o=mix(o, vec3(1.0,0.93,0.9)*(0.82+0.18*k.z), ink);
  vec2 px=3.0/res;
  float glow=greenAmt(texture2D(tex,uv+vec2(px.x,0.0)).rgb)*step(0.45,texture2D(tex,uv+vec2(px.x,0.0)).g);
  glow+=greenAmt(texture2D(tex,uv-vec2(px.x,0.0)).rgb);
  glow*=(1.0-ink);
  o+=vec3(0.45,0.02,0.03)*glow*0.05;
  // metal (gore_metal.js): crushed blacks, blood + bone duotone, red vignette on the beat, grain
  if(uMetal>0.0){
    float l=smoothstep(0.07,0.95,dot(o,vec3(0.299,0.587,0.114)));
    vec3 duo=mix(mix(vec3(0.02,0.0,0.01),vec3(0.62,0.02,0.07),clamp(l*2.0,0.0,1.0)),vec3(0.95,0.9,0.82),clamp(l*2.0-1.0,0.0,1.0));
    o=mix(o,duo,0.32*uMetal);
    o*=0.75+0.25*smoothstep(0.0,0.12,l);
    float d=length((uv-0.5)*vec2(res.x/res.y,1.0));
    o=mix(o,vec3(0.22,0.0,0.02),smoothstep(0.45,1.05,d)*(0.55+0.35*uBeat)*uMetal);
    float n=fract(sin(dot(uv*res+uT*61.0,vec2(12.9898,78.233)))*43758.5453);
    o+=(n-0.5)*0.07*uMetal;
    o+=vec3(0.5,0.02,0.04)*uFlash;
  }
  gl_FragColor=vec4(min(o,1.0),1.0);
}`;
    function sh(type,src){
      const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){ console.error('MV gore grade',gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    const vs=sh(gl.VERTEX_SHADER,VS), fs=sh(gl.FRAGMENT_SHADER,FS);
    if(!vs||!fs) return false;
    prog=gl.createProgram(); gl.attachShader(prog,vs); gl.attachShader(prog,fs); gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS)){ console.error('MV gore grade link',gl.getProgramInfoLog(prog)); return false; }
    gl.useProgram(prog);
    buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buf);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const ap=gl.getAttribLocation(prog,'p'); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap,2,gl.FLOAT,false,0,0);
    tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    U={tex:gl.getUniformLocation(prog,'tex'), res:gl.getUniformLocation(prog,'res')};
    for(const n of ['uT','uBeat','uSplit','uFlash','uMetal']) U[n]=gl.getUniformLocation(prog,n);
    gl.uniform1i(U.tex,0);
    glState=1; return true;
  }
  function grade(){
    const amt=goreAmt();
    if(!cv||amt<0.015||!initGL()){
      if(oc.style.display!=='none') oc.style.display='none';
      return;
    }
    syncBox();
    oc.style.opacity=amt.toFixed(3);
    if(oc.style.display==='none') oc.style.display='';
    const FX=window.MV_GORE_FX;
    try{ if(FX) FX.paint(); }catch(e){}
    const fu=(FX&&FX.uniforms())||{t:0,beat:0,split:0,flash:0,metal:0};
    gl.uniform1f(U.uT,fu.t); gl.uniform1f(U.uBeat,fu.beat); gl.uniform1f(U.uSplit,fu.split);
    gl.uniform1f(U.uFlash,fu.flash); gl.uniform1f(U.uMetal,fu.metal*amt);
    gl.viewport(0,0,oc.width,oc.height);
    gl.bindTexture(gl.TEXTURE_2D,tex);
    try{ gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,cv); }catch(e){ return; }
    gl.uniform2f(U.res,cv.width,cv.height);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
  function hookGrade(){
    const prev=window.draw;
    if(typeof prev!=='function'){ setTimeout(hookGrade,30); return; }
    if(prev._goreGrade) return;
    const wrapped=function(){
      const r=prev.apply(this,arguments);
      try{ grade(); }catch(e){}
      return r;
    };
    wrapped._goreGrade=true;
    window.draw=wrapped;
  }
  setTimeout(hookGrade,0);
})();
