// hitshapes.js — every entity's hit shape IS its sprite outline (Paulo 2026-11-27: "Their collision box can't
// just be a box. it has to be their sprite outline ... Our characters should have a complex hitbox render. One for
// the wheel, one for the body, one for the head, and one for each hand.")
//
// One shape model for entity-vs-entity contact: punches, jacks and their shots, foe contact damage, foes hitting
// heroes, stomps. Movement against the tile grid (collision_grid.js) stays on the body boxes.
//
//   part  = {k:'c', x, y, r, id}            circle, world px
//         | {k:'p', v:[[x,y],...], id}      polygon, world px (convex -> SAT; concave -> exact edge/containment test)
//   shape = [part, ...]                     compound: hits if any part hits
//
//   MV_SHAPES.of(entity)          -> shape in world px (heroes: wheel, body, head, glove hand, plug hand)
//   MV_SHAPES.hit(shapeA, shapeB) -> {a, b} of the first touching parts, or null
//   MV_SHAPES.hitRect / hitCircle / hitSeg(shape, ...) -> bool
//   MV_SHAPES.def(entity)         -> box-relative definition (what the Art Board draws and edits)
//
// Edits from the Art Board arrive as window.MV_HITSHAPES[type] (generated into sfx-replacements.js):
//   foes:   {parts:[{k:'c',x,y,r}|{k:'p',v:[[x,y]...]}]}  x,y = fraction of the body box from its centre (x by w,
//           y by h), r = fraction of w. The foe's spin/tilt rotates them about the same pivot its art uses.
//   heroes: {wheel|body|head|glove|plug: {dx, dy, s}}  px offset (as drawn facing right) and scale per part.
(function(){
'use strict';
const S={};
const HERO_COL={wheel:'#ffd84a', body:'#5affc8', head:'#b48cff', glove:'#ff6a8a', plug:'#58b4ff'};
S.HERO_COL=HERO_COL;
S.show=/[?&]hitshapes=1/.test(location.search)||(function(){ try{ return localStorage.getItem('mv_hitshapes')==='1'; }catch(e){ return false; } })();

// ── primitives ─────────────────────────────────────────────────
function box(x,y,w,h,id){ return {k:'p',v:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],id}; }
function circ(x,y,r,id){ return {k:'c',x,y,r,id}; }
S.box=box; S.circ=circ;
function convex(v){
  if(v._cv!=null) return v._cv;
  let sgn=0; const n=v.length;
  for(let i=0;i<n;i++){ const a=v[i], b=v[(i+1)%n], c=v[(i+2)%n];
    const z=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
    if(Math.abs(z)<1e-9) continue; const s=z>0?1:-1; if(!sgn) sgn=s; else if(s!==sgn){ v._cv=false; return false; } }
  v._cv=true; return true;
}
function inPoly(x,y,v){
  let inn=false;
  for(let i=0,j=v.length-1;i<v.length;j=i++){
    const xi=v[i][0], yi=v[i][1], xj=v[j][0], yj=v[j][1];
    if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/((yj-yi)||1e-9)+xi)) inn=!inn;
  }
  return inn;
}
function segPt2(px,py,ax,ay,bx,by){
  const dx=bx-ax, dy=by-ay, L=dx*dx+dy*dy;
  const t=L?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/L)):0;
  const qx=ax+dx*t-px, qy=ay+dy*t-py; return qx*qx+qy*qy;
}
function segSeg(ax,ay,bx,by,cx,cy,dx,dy){
  const o=(px,py,qx,qy,rx,ry)=>(qx-px)*(ry-py)-(qy-py)*(rx-px);
  const d1=o(cx,cy,dx,dy,ax,ay), d2=o(cx,cy,dx,dy,bx,by), d3=o(ax,ay,bx,by,cx,cy), d4=o(ax,ay,bx,by,dx,dy);
  if(((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0))) return true;
  const on=(px,py,qx,qy,rx,ry)=>Math.min(px,qx)-1e-9<=rx&&rx<=Math.max(px,qx)+1e-9&&Math.min(py,qy)-1e-9<=ry&&ry<=Math.max(py,qy)+1e-9;
  return (d1===0&&on(cx,cy,dx,dy,ax,ay))||(d2===0&&on(cx,cy,dx,dy,bx,by))||(d3===0&&on(ax,ay,bx,by,cx,cy))||(d4===0&&on(ax,ay,bx,by,dx,dy));
}
function cc(a,b){ const dx=a.x-b.x, dy=a.y-b.y, r=a.r+b.r; return dx*dx+dy*dy<=r*r; }
function cp(c,p){
  const v=p.v; if(inPoly(c.x,c.y,v)) return true;
  const r2=c.r*c.r;
  for(let i=0,j=v.length-1;i<v.length;j=i++) if(segPt2(c.x,c.y,v[j][0],v[j][1],v[i][0],v[i][1])<=r2) return true;
  return false;
}
// separating axis test for two convex polygons
function sat(A,B){
  for(const P of [A,B]){
    for(let i=0,j=P.length-1;i<P.length;j=i++){
      const ax=-(P[i][1]-P[j][1]), ay=P[i][0]-P[j][0];
      let a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity;
      for(const q of A){ const d=q[0]*ax+q[1]*ay; if(d<a0)a0=d; if(d>a1)a1=d; }
      for(const q of B){ const d=q[0]*ax+q[1]*ay; if(d<b0)b0=d; if(d>b1)b1=d; }
      if(a1<b0||b1<a0) return false;
    }
  }
  return true;
}
// any simple polygons (the bat, the star): crossing edges or one inside the other
function pgGeneric(A,B){
  for(let i=0,j=A.length-1;i<A.length;j=i++)
    for(let k=0,l=B.length-1;k<B.length;l=k++)
      if(segSeg(A[j][0],A[j][1],A[i][0],A[i][1],B[l][0],B[l][1],B[k][0],B[k][1])) return true;
  return inPoly(A[0][0],A[0][1],B)||inPoly(B[0][0],B[0][1],A);
}
function pp(a,b){ return convex(a.v)&&convex(b.v)?sat(a.v,b.v):pgGeneric(a.v,b.v); }
function partHit(a,b){
  if(!a||!b) return false;
  if(a.k==='c') return b.k==='c'?cc(a,b):cp(a,b);
  return b.k==='c'?cp(b,a):pp(a,b);
}
function bounds(sh){
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const q of sh){ if(q.k==='c'){ x0=Math.min(x0,q.x-q.r); x1=Math.max(x1,q.x+q.r); y0=Math.min(y0,q.y-q.r); y1=Math.max(y1,q.y+q.r); }
    else for(const v of q.v){ if(v[0]<x0)x0=v[0]; if(v[0]>x1)x1=v[0]; if(v[1]<y0)y0=v[1]; if(v[1]>y1)y1=v[1]; } }
  return {x:x0,y:y0,w:x1-x0,h:y1-y0};
}
S.partHit=partHit; S.bounds=bounds;
S.hit=function(A,B){
  if(!A||!B) return null;
  for(const a of A) for(const b of B) if(partHit(a,b)) return {a,b};
  return null;
};
S.hitRect=(sh,x,y,w,h)=>!!S.hit(sh,[box(x,y,w,h)]);
S.hitCircle=(sh,x,y,r)=>!!S.hit(sh,[circ(x,y,r)]);
S.hitPoint=(sh,x,y)=>!!S.hit(sh,[circ(x,y,0.01)]);
// a fat line (a beam of half-width r): circle/polygon parts against the capsule
S.hitSeg=function(sh,x0,y0,x1,y1,r){
  if(!sh) return false; r=r||0;
  for(const q of sh){
    if(q.k==='c'){ const R=q.r+r; if(segPt2(q.x,q.y,x0,y0,x1,y1)<=R*R) return true; continue; }
    const v=q.v; if(inPoly(x0,y0,v)||inPoly(x1,y1,v)) return true;
    for(let i=0,j=v.length-1;i<v.length;j=i++){
      if(segSeg(x0,y0,x1,y1,v[j][0],v[j][1],v[i][0],v[i][1])) return true;
      if(r>0&&(segPt2(v[i][0],v[i][1],x0,y0,x1,y1)<=r*r||segPt2(x0,y0,v[j][0],v[j][1],v[i][0],v[i][1])<=r*r||segPt2(x1,y1,v[j][0],v[j][1],v[i][0],v[i][1])<=r*r)) return true;
    }
  }
  return false;
};

// ── heroes: wheel, body, head, glove hand, plug hand ───────────
const FR=()=>typeof fr==='number'?fr:0;
function isHeroLike(e){
  if(!e) return false;
  if(e.mind) return true;                                    // MIND / mirror rivals (the wheel riders) are drawn as a full character
  if(typeof p!=='undefined'&&e===p) return true;
  if(typeof p2!=='undefined'&&e===p2) return true;
  return !!(e.hero||e._aiCompanion||e._betaSib||e._netPuppet);
}
S.isHeroLike=isHeroLike;
// render.js calls this while it draws a character: screen px -> world px, one slot per part
S.base=function(){ try{ S._base=ctx.getTransform(); }catch(e){ S._base=null; } };
S.rec=function(pl,slot,sxp,syp,extra){
  if(!pl||!isFinite(sxp)||!isFinite(syp)) return;
  const o=pl._hs||(pl._hs={});
  // the canvas may be tilted (rope swing), leaned (jab) or grooving: map the point through what is really applied
  let x=sxp, y=syp, rot=(extra&&extra.rot)||0;
  try{ const B=S._base; if(B&&typeof ctx!=='undefined'){ const R=B.inverse().multiply(ctx.getTransform()); const q=R.transformPoint(new DOMPoint(sxp,syp)); x=q.x; y=q.y; rot+=Math.atan2(R.b,R.a); } }catch(e){}
  const ox=typeof sx==='function'?sx(0):0, oy=typeof sy==='function'?sy(0):0;
  const s=typeof SMS_SCALE==='number'&&typeof MV2_VISUAL!=='undefined'&&!MV2_VISUAL?SMS_SCALE:1;
  o[slot]={x:(x-ox)*s, y:(y-oy)*s, fr:FR(), r:extra&&extra.r, rot};
};
function spin(v,ox,oy,a){ if(!a||Math.abs(a)<1e-4) return v; const c=Math.cos(a), s=Math.sin(a); return v.map(q=>[ox+(q[0]-ox)*c-(q[1]-oy)*s, oy+(q[0]-ox)*s+(q[1]-oy)*c]); }
function fresh(q){ return q&&FR()-q.fr<=2&&FR()>=q.fr; }
function heroOverride(pl){
  const H=window.MV_HITSHAPES||{};
  return H[pl.mind?(pl.type||'mind'):(pl.hero||'mind')]||null;
}
// the head's outline in bulb radii, bulb centre at 0,0: MIND's flat wide-brim hat, VENTURE's cap with its back brim
const HEAD_MIND=[[-2.7,-0.95],[-1.33,-0.95],[-1.33,-2.15],[1.33,-2.15],[1.33,-0.95],[2.7,-0.95],[2.7,-0.72],[1.02,-0.6],[1.05,0],[0.74,0.74],[0,1.12],[-0.74,0.74],[-1.05,0],[-1.02,-0.6],[-2.7,-0.72]];
const HEAD_VENTURE=[[1.95,-0.9],[1.1,-0.95],[0.8,-1.45],[0,-1.6],[-0.8,-1.45],[-1.12,-0.9],[-1.05,0],[-0.74,0.74],[0,1.12],[0.74,0.74],[1.05,0],[1.05,-0.6],[1.95,-0.65]];  // brim on +x = behind him when he faces left
S.HEAD={mind:HEAD_MIND, venture:HEAD_VENTURE};
// hero overrides: {wheel|body|head|glove|plug: {dx, dy, s}}  px offset (facing right; mirrored when he faces left) and scale
function heroParts(pl){
  const SW_=typeof SW!=='undefined'?SW:64, FO=typeof FEET_OFF!=='undefined'?FEET_OFF:88;
  const WR=typeof WHEEL_R!=='undefined'?WHEEL_R:20, BW=typeof BODY_W!=='undefined'?BODY_W:52, BH=typeof BODY_H!=='undefined'?BODY_H:42;
  const g=typeof _charArtGeom==='function'?_charArtGeom(pl,{}):{bodyTop:pl.y+FO-70-WR+10,headCY:pl.y+FO-70-WR-11,headR:14,wheelCY:pl.y+FO-WR};
  const cx=pl.x+SW_/2, fc=pl.fc!=null?!!pl.fc:(pl.facing!=null?pl.facing>0:true), fd=fc?1:-1;
  const R=pl._hs||{}, O=heroOverride(pl)||{};
  const o=k=>{ const q=O[k]||{}; return {dx:(q.dx||0)*fd, dy:q.dy||0, s:q.s>0?q.s:1}; };
  const oW=o('wheel'), oB=o('body'), oH=o('head'), oG=o('glove'), oP=o('plug');
  // wheel: the tyre, centred on its axle
  const wh=fresh(R.wheel)?R.wheel:{x:cx,y:g.wheelCY};
  const wheel=circ(wh.x+oW.dx, wh.y+oW.dy, WR*oW.s, 'wheel');
  // body: the speaker cabinet, scaled about its centre
  const bt=fresh(R.body)?R.body.y:g.bodyTop, bx=fresh(R.body)?R.body.x:cx;
  const bw=BW*oB.s, bh=BH*oB.s;
  const body=box(bx-bw/2+oB.dx, bt+BH/2-bh/2+oB.dy, bw, bh, 'body');
  if(fresh(R.body)&&R.body.rot) body.v=spin(body.v,bx+oB.dx,bt+oB.dy,R.body.rot);   // tilts with him on the rope
  // head: the bulb screwed into the record, and the hat on top
  const hd=fresh(R.head)?R.head:{x:cx,y:g.headCY,r:g.headR};
  const hr=(hd.r||g.headR||14)*oH.s, mir=pl.hero==='venture'?-fd:1;
  let head;
  if(pl.mind){ head=circ(hd.x+oH.dx, hd.y+oH.dy, hr*1.55, 'head'); }     // rivals wear no hat: the bulb in its gold ring
  else{
    const hv=(pl.hero==='venture'?HEAD_VENTURE:HEAD_MIND).map(a=>[hd.x+oH.dx+a[0]*hr*mir, hd.y+oH.dy+a[1]*hr]);
    if(mir<0) hv.reverse();
    head={k:'p',v:fresh(R.head)?spin(hv,hd.x+oH.dx,hd.y+oH.dy,R.head.rot):hv,id:'head'};
  }
  head.o=[hd.x+oH.dx, hd.y+oH.dy];                                        // scales about the bulb centre
  // hands: where render.js drew the glove and the plug (jack grip / rope arm / left glove) this frame
  const sh=g.bodyTop+BH*0.22;
  const gl=fresh(R.glove)?R.glove:{x:cx+fd*(BW/2+12), y:sh+14};
  let pg=fresh(R.plug)?R.plug:null;
  if(!pg){ let ps=pl._armPose||pl._pose; if(!ps&&pl.mind&&typeof computeConnectorArmPose==='function') try{ ps=computeConnectorArmPose(pl); }catch(e){} pg=ps&&isFinite(ps.tipX)?{x:ps.tipX,y:ps.tipY}:{x:cx-fd*(BW/2-2), y:sh+16}; }
  const glove=circ(gl.x+oG.dx,gl.y+oG.dy,11*oG.s,'glove');
  const plug=circ(pg.x+oP.dx,pg.y+oP.dy,9*oP.s,'plug');
  body.o=[bx+oB.dx, bt+BH/2+oB.dy];
  return [wheel,body,head,glove,plug];
}
S.heroParts=heroParts;

// ── foes: the outline their art is drawn with ───────────────────
// pivot + rotation, exactly as beta_enemies.js polyVerts() spins each body
function pose(e){
  const cx=e.x+e.w/2, cy=e.y+e.h/2, lift=e._lift||0, id=e._foe||e._ai||'';
  if(id==='tri'&&!e._foe) return {cx, cy:cy-lift, pv:[0,1/6], rot:e.ang||0};
  const rot=e._foe==='boss'?(e.rot||0):e._foe==='cube'?((e.spin||0)+(e.ang||0)):(e._foe||e._ai)?(e.ang||0):0;
  return {cx, cy:cy-lift, pv:[0,0], rot};
}
function place(def,e,P){
  P=P||pose(e); const w=e.w, h=e.h, co=Math.cos(P.rot), si=Math.sin(P.rot);
  const pxw=P.cx+P.pv[0]*w, pyw=P.cy+P.pv[1]*h;
  const T=(lx,ly)=>{ const ux=(lx-P.pv[0])*w, uy=(ly-P.pv[1])*h; return [pxw+ux*co-uy*si, pyw+ux*si+uy*co]; };
  return def.parts.map((q,i)=>q.k==='c'?(()=>{ const c=T(q.x,q.y); return circ(c[0],c[1],q.r*w,q.id||('part'+i)); })():{k:'p',v:q.v.map(a=>T(a[0],a[1])),id:q.id||('part'+i)});
}
// world outline -> box-relative definition (undo the spin), for the Art Board
function unplace(sh,e,P){
  P=P||pose(e); const w=e.w||1, h=e.h||1, co=Math.cos(-P.rot), si=Math.sin(-P.rot);
  const pxw=P.cx+P.pv[0]*w, pyw=P.cy+P.pv[1]*h;
  const L=(x,y)=>{ const ux=x-pxw, uy=y-pyw; return [ +(((ux*co-uy*si)/w)+P.pv[0]).toFixed(4), +(((ux*si+uy*co)/h)+P.pv[1]).toFixed(4) ]; };
  return {parts:sh.map(q=>q.k==='c'?(()=>{ const c=L(q.x,q.y); return {k:'c',x:c[0],y:c[1],r:+(q.r/w).toFixed(4),id:q.id}; })():{k:'p',v:q.v.map(a=>L(a[0],a[1])),id:q.id})};
}
function foeShape(e){
  const B=window.MV_BETA;
  const ov=(window.MV_HITSHAPES||{})[e.type];
  if(ov&&ov.parts&&ov.parts.length) return place(ov,e);
  if(e.type==='signol'&&typeof _signolCenter==='function'){ const c=_signolCenter(e); return [circ(c.cx,c.cy,e.r,'body')]; }
  const g=B&&B.foeGeom?B.foeGeom(e):null;
  if(g){
    const sh=[g.k==='c'?circ(g.x,g.y,g.r,'body'):{k:'p',v:g.v,id:'body'}];
    if(e._foe==='boss'&&g.k==='p') g.v.forEach((a,i)=>sh.push(circ(a[0],a[1],6,'node'+i)));   // the heptagon's glowing corner nodes
    return sh;
  }
  const hb=typeof _enemyItemHB==='function'?_enemyItemHB(e):e;
  if(!hb||!(hb.w>0)||!(hb.h>0)) return null;
  return [box(hb.x,hb.y,hb.w,hb.h,'body')];
}
S.of=function(e){
  if(!e) return null;
  if(isHeroLike(e)) return heroParts(e);
  return foeShape(e);
};
S.pose=pose; S.place=place;
// the box-relative definition the Art Board draws and edits (foes), or the hero parts relative to the body box
S.def=function(e){
  if(!e) return null;
  if(isHeroLike(e)){
    // px relative to the body box's top-left; o = the point each part scales about
    const fc=e.fc!=null?!!e.fc:(e.facing!=null?e.facing>0:true);
    const parts=heroParts(e).map(q=>{ const o=q.k==='c'?[q.x,q.y]:(q.o||[0,0]);
      return Object.assign(q.k==='c'?{k:'c',id:q.id,x:q.x-e.x,y:q.y-e.y,r:q.r}:{k:'p',id:q.id,v:q.v.map(a=>[a[0]-e.x,a[1]-e.y])},{o:[o[0]-e.x,o[1]-e.y]}); });
    return {hero:true, fd:fc?1:-1, parts, edited:!!heroOverride(e)};
  }
  const sh=foeShape(e); if(!sh) return null;
  const P=pose(e);
  return Object.assign(unplace(sh,e,P),{rot:P.rot,pv:P.pv,lift:e._lift||0,edited:!!(window.MV_HITSHAPES||{})[e.type]});
};
// two entities touch?
S.touch=function(a,b){ return S.hit(S.of(a),S.of(b)); };

// ── debug: draw the live hit shapes (off by default; H key in a stage, or ?hitshapes=1) ──
S.setShow=function(on){ S.show=!!on; try{ localStorage.setItem('mv_hitshapes',on?'1':'0'); }catch(e){} };
window.addEventListener('keydown',function(ev){
  if(!(ev.code==='KeyH'&&ev.shiftKey&&!ev.ctrlKey&&!ev.metaKey)) return;
  if(typeof _gameState!=='undefined'&&_gameState!=='game') return;
  S.setShow(!S.show); ev.preventDefault();
});
function strokeShape(sh,col,hero){
  if(!sh||typeof ctx==='undefined') return;
  const z=(typeof camZoom==='number'&&isFinite(camZoom))?camZoom:1;
  for(const q of sh){
    const c=(hero&&HERO_COL[q.id])||col;
    ctx.strokeStyle=c; ctx.fillStyle=c; ctx.globalAlpha=0.9; ctx.lineWidth=Math.max(1,1.5/z);
    ctx.beginPath();
    if(q.k==='c') ctx.arc(sx(q.x),sy(q.y),Math.max(1,sw(q.r)),0,Math.PI*2);
    else{ q.v.forEach((a,i)=>i?ctx.lineTo(sx(a[0]),sy(a[1])):ctx.moveTo(sx(a[0]),sy(a[1]))); ctx.closePath(); }
    ctx.stroke(); ctx.globalAlpha=0.14; ctx.fill(); ctx.globalAlpha=1;
  }
}
S.drawDebug=function(){
  if(!S.show||typeof ctx==='undefined'||typeof sx!=='function') return;
  ctx.save();   // called inside main.js's world-zoom block, so world shapes already zoom with the camera
  try{
    if(typeof ENEMS!=='undefined') for(const e of ENEMS){ if(!e||e._hidden) continue; if(!(e.alive||(typeof _enemyBodyPresent==='function'&&_enemyBodyPresent(e)))) continue; strokeShape(S.of(e),'#ff4a5a',isHeroLike(e)); }
    const hs=[typeof p!=='undefined'?p:null, typeof p2!=='undefined'?p2:null];
    try{ if(window.MV_SIBLING&&MV_SIBLING.sib) hs.push(MV_SIBLING.sib); }catch(e){}
    for(const h of hs) if(h&&isFinite(h.x)&&h.x>-9000) strokeShape(heroParts(h),'#fff',true);
  }catch(e){}
  ctx.restore();
};
window.MV_SHAPES=S;

// ── route the game's entity-vs-entity tests through the shapes ──
function hookAll(){
  // punches: the fist is a circle the size of the glove, tested against the foe's outline (or the brother's parts)
  const _f=window._fistHitsHB;
  if(typeof _f==='function'&&!_f._hs){
    window._fistHitsHB=function(fx,fy,fw,fh,hb){
      const tgt=hb&&(hb._e||hb._hero)||null;
      const sh=tgt&&hb.w>0&&hb.h>0?S.of(tgt):null;
      if(!sh) return _f.apply(this,arguments);              // no known owner: the old rectangle test
      S.lastFist={x:fx+fw/2,y:fy+fh/2,r:Math.min(fw,fh)/2,fr:FR()};
      return S.hitCircle(sh,fx+fw/2,fy+fh/2,Math.min(fw,fh)/2);
    };
    window._fistHitsHB._hs=1;
  }
  // shots (the jacks' rounds, lasers, frags): their own circle against the outline
  const _s=window._shotHitsEnemy;
  if(typeof _s==='function'&&!_s._hs){
    window._shotHitsEnemy=function(x,y,w,h,e){
      if(typeof _enemyBodyPresent==='function'&&!_enemyBodyPresent(e)) return false;
      const sh=S.of(e); if(!sh) return _s.apply(this,arguments);
      return S.hitCircle(sh,x+w/2,y+h/2,Math.min(w,h)/2);
    };
    window._shotHitsEnemy._hs=1;
  }
  // every combat box knows whose it is, so the tests above can read the owner's real shape
  const _ib=window._enemyItemHB;
  if(typeof _ib==='function'&&!_ib._hs){
    window._enemyItemHB=function(e){ const r=_ib.apply(this,arguments); if(r&&e&&!r._e&&r.w>0) r._e=e; return r; };
    window._enemyItemHB._hs=1;
  }
}
// foes touching the hero (contact damage): every hero part against the foe's outline
// A glove that is mid-punch is the attacker: punching a foe never hurts MIND through his own fist.
function contactParts(pl){
  const parts=heroParts(pl);
  if(!(pl.pt>0)) return parts;
  const fistHand=pl._punchHand==='L'?'plug':'glove';
  return parts.filter(q=>q.id!==fistHand);
}
S.contactParts=contactParts;
S.heroTouchesFoe=function(pl,e){ return !!S.hit(contactParts(pl),S.of(e)); };
S.shift=function(sh,dx,dy){ return sh?sh.map(q=>q.k==='c'?circ(q.x+dx,q.y+dy,q.r,q.id):{k:'p',v:q.v.map(a=>[a[0]+dx,a[1]+dy]),id:q.id}):null; };
// a foe dropping onto someone: its outline where it will be next frame, against their shape
S.dropHits=function(e,ny,tgt){ return !!S.hit(S.shift(S.of(e),0,ny-e.y),isHeroLike(tgt)?contactParts(tgt):S.of(tgt)); };
S.heroHitByCircle=function(pl,x,y,r){ return pl?S.hitCircle(heroParts(pl),x,y,r):false; };
S.heroHitBySeg=function(pl,x0,y0,x1,y1,r){ return pl?S.hitSeg(heroParts(pl),x0,y0,x1,y1,r):false; };
S.heroHitByRect=function(pl,x,y,w,h){ return pl?S.hitRect(heroParts(pl),x,y,w,h):false; };
hookAll();
window.addEventListener('load',hookAll);
})();
// the jacks' bolts are capsules (beta weapons.js _shotStrikeCapsule): the capsule against the outline
(function(){
  function hookCap(){
    const _cap=window._shotCapsuleHitsEnemy, S=window.MV_SHAPES;
    if(typeof _cap!=='function'||_cap._hs||typeof _shotStrikeCapsule!=='function') return;
    window._shotCapsuleHitsEnemy=function(s,e){
      if(typeof _enemyBodyPresent==='function'&&!_enemyBodyPresent(e)) return false;
      const sh=S.of(e); if(!sh) return _cap.apply(this,arguments);
      const c=_shotStrikeCapsule(s); return S.hitSeg(sh,c.x1,c.y1,c.x2,c.y2,c.r);
    };
    window._shotCapsuleHitsEnemy._hs=1;
  }
  hookCap(); window.addEventListener('load',hookCap);
})();
