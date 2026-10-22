// ============================================================
//  beta_water.js — G · moving platforms, water and the Isolator (Awdjoo 1.2)
//
//  Moving platforms: steady back-and-forth over the range drawn in the sketch
//  (all the same width). MIND rides them, jumps off them, and the RCA hook
//  can bite them and rides along.
//
//  Water (Paulo, Oct 21: "like Terraria — it always goes somewhere"): the
//  level is a grid of half-tile cells and every cell holds an amount of
//  water. Each step water falls into the cell below, spreads sideways over
//  whatever holds it up (with momentum, so it sloshes and levels out fast),
//  and water squeezed by the weight above pushes up — so it climbs through
//  U-bends and finds its level on both sides. Nothing is ever deleted:
//    - a body in the water (MIND, an enemy, a cube, the XLR's air pocket)
//      takes up cells, and the water in them is pushed out beside it, so
//      the level rises around it;
//    - splashes, the XLR's blast and the MAG throw real water: drops that
//      carry their share and land somewhere else, where it flows on;
//    - shoot a plug of electro blocks and the room behind empties through
//      the hole and spreads over the floor beyond;
//    - the only ways out are falling off the bottom of the world, or
//      burning off: a TRS shot into water boils some of it to vapor, and
//      electrified water steams away while the charge lasts.
//  Electricity: MIND is a speaker — without the Isolator, water shorts him.
//  Enemies short out the moment they are in water. A TRS shot electrifies
//  the whole connected body of water for a moment.
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B) return;
  const T=32;
  const on=()=>B.on&&typeof p!=='undefined'&&p;
  B.platforms=[]; B.waters=[]; B.isoPickup=null; B.hasIsolator=false; B.bubbles=[];

  // ── The fluid grid ─────────────────────────────────────────────
  //  M: water per cell (1 = a full cell; deeper cells hold a touch more —
  //  that squeeze is the pressure). BLK: 1 terrain, 2 a body, 3 air pocket.
  const F={CS:16, NX:0, NY:0, M:null, N2:null, FX:null, BLK:null, EL:null, WH:null, WV:null, Q:null,
    bb:{x0:0,x1:-1,y0:0,y1:-1}, rects:[], ready:false, lost:0, vapor:0, total0:0};
  B.fluid=F;
  const MAXC=0.012, MINM=0.0005, K=0.4, DAMP=0.6, FILM=0.03, SUB=4, SUP=0.97;
  B.waterShortsEnemies=true;
  const ENEMY_SHORT_FR=40;                                   // frames in the water before an enemy shuts down for good
  const ELEC_BOIL=0.006, BOIL_SHOT=10, BOIL_CHARGED=24;
  function stable(t){ if(t<=1) return 1; if(t<2+MAXC) return (1+t*MAXC)/(1+MAXC); return (t+MAXC)/2; }

  // ── Level hooks ────────────────────────────────────────────────
  B.onLevelStart=function(){ B.platforms=[]; B.waters=[]; B.isoPickup=null; B.hasIsolator=false; B.isoT=0; B.bubbles=[]; B.ridePlat=null; B.xBub=null; B.wRings=[];
    B.drops=[]; B.steam=[]; F.ready=false; F.rects=[]; F.M=null; };
  B.onEntities=function(ents, Fd, cell){
    for(const e of ents){
      const g=cell(e), id=e.__identifier;
      if(id==='MovingPlatform'){
        const a=(Fd(e,'a')??g.c)*T, b=(Fd(e,'b')??g.c)*T;
        B.platforms.push({x:g.c*T, y:g.r*T, w:g.w*T, h:14, a, b, dir:1, spd:(Fd(e,'speed')||12)/10, dx:0});
      }else if(id==='Water'){
        const r={c0:g.c, c1:g.c+g.w-1, r0:g.r, r1:g.r+g.h-1, plug:Fd(e,'plug')||null};
        F.rects.push(r);
        B.waters.push({c0:r.c0, c1:r.c1, r0:r.r0, r1:r.r1, px0:r.c0*T, px1:(r.c1+1)*T, base:r.r0*T, plug:r.plug});
      }else if(id==='Isolator'){
        B.isoPickup={x:g.c*T+T/2, y:(g.r+1)*T, got:false};
      }
    }
  };

  function gridOk(){ return typeof MV_GRID!=='undefined'&&MV_GRID&&MV_GRID.ready&&MV_GRID.tile>0; }
  function fluidInit(){
    if(!gridOk()) return false;
    F.CS=MV_GRID.tile/2; F.NX=MV_GRID.cols*2; F.NY=MV_GRID.rows*2;
    const n=F.NX*F.NY;
    F.M=new Float32Array(n); F.N2=new Float32Array(n); F.FX=new Float32Array(n); F.PR=new Float32Array(n); F.RL=new Float32Array(n);
    F.BLK=new Uint8Array(n); F.EL=new Uint8Array(n); F.Q=new Int32Array(n); F.FL=new Float32Array(n);   // FL: recent falling water per cell (for the sound)
    F.WH=new Float32Array(F.NX); F.WV=new Float32Array(F.NX);
    F.lost=0; F.vapor=0;
    terrain();
    for(const r of F.rects){                                   // fill each Water rect (half a tile of headroom at the top),
                                                               // squeezed a little more with depth
      for(let x=r.c0*2;x<=r.c1*2+1;x++){ let d=0;
        for(let y=r.r0*2+1;y<=r.r1*2+1;y++){ const i=y*F.NX+x; if(F.BLK[i]){ d=0; continue; } F.M[i]=1+MAXC*d; d++; } }
    }
    F.bb={x0:0,x1:F.NX-1,y0:0,y1:F.NY-1}; bbox();
    F.total0=total(); F.ready=true;
    return true;
  }
  function total(){ let s=0; for(let i=0;i<F.M.length;i++) s+=F.M[i]; return s; }
  B.fluidTotal=()=>F.ready?{water:total(), start:F.total0, lost:F.lost, vapor:F.vapor, drops:(B.drops||[]).reduce((a,d)=>a+d.m,0), mag:(B.magWater?B.magWater.area:0)/(F.CS*F.CS)}:null;

  // terrain → BLK (1). Slopes: a cell is solid where its centre is under the ramp.
  function terrain(){
    const NX=F.NX, CS=F.CS, BLK=F.BLK, rows=MV_GRID.rows, cols=MV_GRID.cols;
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
      const solid=gridSolid(c,r), sk=solid?null:gridSlopeKind(c,r);
      for(let dy=0;dy<2;dy++) for(let dx=0;dx<2;dx++){
        const x=c*2+dx, y=r*2+dy; let v=solid?1:0;
        if(sk){ const wy=y*CS+CS/2, s=gridSlopeY(c,r,x*CS+CS/2); if(s!=null&&wy>s) v=1; }
        BLK[y*NX+x]=v;
      }
    }
  }
  // bodies take up the cells whose centres they cover
  function markRect(x,y,w,h,v){
    const CS=F.CS, NX=F.NX, BLK=F.BLK;
    const x0=Math.max(0,Math.ceil(x/CS-0.5)), x1=Math.min(F.NX-1,Math.floor((x+w)/CS-0.5));
    const y0=Math.max(0,Math.ceil(y/CS-0.5)), y1=Math.min(F.NY-1,Math.floor((y+h)/CS-0.5));
    for(let cy=y0;cy<=y1;cy++) for(let cx=x0;cx<=x1;cx++){ const i=cy*NX+cx; if(BLK[i]!==1) BLK[i]=v; }
  }
  function markCircle(x,y,r,v){
    const CS=F.CS, NX=F.NX, BLK=F.BLK;
    const x0=Math.max(0,Math.floor((x-r)/CS)), x1=Math.min(F.NX-1,Math.floor((x+r)/CS)), y0=Math.max(0,Math.floor((y-r)/CS)), y1=Math.min(F.NY-1,Math.floor((y+r)/CS));
    for(let cy=y0;cy<=y1;cy++) for(let cx=x0;cx<=x1;cx++){ const dx=cx*CS+CS/2-x, dy=cy*CS+CS/2-y; if(dx*dx+dy*dy<=r*r){ const i=cy*NX+cx; if(BLK[i]!==1) BLK[i]=v; } }
  }
  function mindBox(){ const feet=p.y+FEET_OFF, top=feet-(STAND_H+WHEEL_R)+(p.crouchAmt||0)*30; return {x:p.x+SW/2-24, y:top, w:48, h:feet-top}; }
  function occupy(){
    if(p&&p.alive!==false){ const b=mindBox(); markRect(b.x,b.y,b.w,b.h,2); }
    for(const e of ENEMS){ if(e._betaHeld||!isFinite(e.x)) continue;
      if(e.mind){ const feet=e.y+FEET_OFF; markRect(e.x+SW/2-24,feet-(STAND_H+WHEEL_R),48,STAND_H+WHEEL_R,2); }
      else markRect(e.x,e.y,e.w,e.h,2); }
    for(const bw of BWALLS){ if(!bw.cube||bw.hp<=0||bw._carried) continue;
      const x=bw.x+(bw._ox||0), y=bw.y+(bw._oy||0);
      if(typeof _bwallMovedFromHome==='function'&&!_bwallMovedFromHome(bw)&&!bw._ox&&!bw._oy) continue;   // at home it is part of the terrain already
      markRect(x,y,bw.w||T,bw.h||T,2); }
    const ab=B.xBub; if(ab) markCircle(ab.x,ab.y,ab.r,3);
  }
  // water caught in a cell that just got taken (a body moved in, a cube came
  // back, the XLR's pocket grew) is pushed out beside it. Out of a body it goes
  // to both sides alike, so a body standing in a stream doesn't dam it — the
  // water still gets past — while the level rises around it.
  function displace(){
    const {NX,M,BLK}=F, b=F.bb;
    if(b.x1<b.x0) return;
    for(let y=b.y0;y<=b.y1;y++) for(let x=b.x0;x<=b.x1;x++){
      const i=y*NX+x, m=M[i], v=BLK[i]; if(!v||m<=0) continue;
      let L=-1, R=-1;
      for(let k=1;k<=12;k++){ const xx=x-k; if(xx<0) break; const j=i-k, w=BLK[j]; if(w===1) break; if(!w){ L=j; break; } }
      for(let k=1;k<=12;k++){ const xx=x+k; if(xx>=NX) break; const j=i+k, w=BLK[j]; if(w===1) break; if(!w){ R=j; break; } }
      if(v!==2&&L>=0&&R>=0){ if((i-L)<(R-i)) R=-1; else if((R-i)<(i-L)) L=-1; }   // terrain / air pocket: the nearer side
      if(L<0&&R<0){
        for(let yy=y-1;yy>=0&&y-yy<24;yy--){ const j=yy*NX+x; if(BLK[j]===1) break; if(!BLK[j]){ L=j; break; } }
        if(L<0) continue;                                        // nowhere to go: it waits in the cell
      }
      if(L>=0&&R>=0){ M[L]+=m/2; M[R]+=m/2; grow(L); grow(R); }
      else { const t=L>=0?L:R; M[t]+=m; grow(t); }
      M[i]=0;
    }
  }
  function walled(x0,x1,y){ const s=x1>x0?1:-1; for(let x=x0+s;x!==x1;x+=s) if(F.BLK[y*F.NX+x]===1) return true; return false; }
  function grow(i){ const x=i%F.NX, y=(i/F.NX)|0, b=F.bb; if(x<b.x0) b.x0=x; if(x>b.x1) b.x1=x; if(y<b.y0) b.y0=y; if(y>b.y1) b.y1=y; }
  function bbox(){
    const {NX,NY,M}=F, b=F.bb;
    const X0=Math.max(0,b.x0-2), X1=Math.min(NX-1,b.x1+2), Y0=Math.max(0,b.y0-2), Y1=Math.min(NY-1,b.y1+2);
    let x0=NX,x1=-1,y0=NY,y1=-1;
    for(let y=Y0;y<=Y1;y++){ const row=y*NX; for(let x=X0;x<=X1;x++){ const m=M[row+x]; if(m>MINM){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; } else if(!(m>=0)) M[row+x]=0; } }
    b.x0=x0; b.x1=x1; b.y0=y0; b.y1=y1;
  }
  // one step: fall, spread, push up. Bodies (BLK 2) don't dam the water —
  // in a side view it flows past them; displace() then pushes out what's
  // inside them, so the level still rises around whatever is in the water.
  function step(fall){
    const {NX,NY,M,N2,FX,BLK}=F, b=F.bb;
    if(b.x1<b.x0) return;
    const x0=Math.max(0,b.x0-1), x1=Math.min(NX-1,b.x1+1), y0=Math.max(0,b.y0-1), y1=Math.min(NY-1,b.y1+1);
    // 1) fall into the cell below (as much as fits) — every other step, so it
    //    falls about two cells a frame while it spreads four
    N2.set(M);
    if(fall){
    for(let y=y0;y<=y1;y++){ const row=y*NX;
      for(let x=x0;x<=x1;x++){ const i=row+x, m=M[i]; if(m<=MINM||(BLK[i]&1)) continue;
        if(y===NY-1){ const f=Math.min(m,0.6); N2[i]-=f; F.lost+=f; continue; }     // off the bottom of the world
        const j=i+NX; if(BLK[j]&1) continue;
        let f=stable(m+M[j])-M[j]; if(f>m) f=m; if(f<=0) continue;
        N2[i]-=f; N2[j]+=f; if(M[j]<0.7) F.FL[j]=F.FL[j]*0.8+f;   // only water dropping through air counts as falling
      } }
    M.set(N2); }
    // 2) spread sideways over whatever holds it up. The push is the pressure:
    //    the water in the cell plus all the water standing on it, so a deep
    //    side drives the water at the bottom toward the shallow side and the
    //    surface levels out fast. The flow keeps its momentum (it sloshes).
    //    Per row the push is shared out over the depth of the water, so a whole
    //    column moves about K x the height difference a step (stable at any depth).
    const PR=F.PR, RL=F.RL;
    for(let x=x0;x<=x1;x++){ let acc=0, st=-1;
      for(let y=y0;y<=y1+1;y++){ const i=y*NX+x, dry=y>y1||(BLK[i]&1)||M[i]<0.02;
        if(dry){ if(st>=0){ const n=y-st; for(let k=st;k<y;k++) RL[k*NX+x]=n; st=-1; } if(y<=y1){ PR[i]=0; RL[i]=1; } acc=0; continue; }
        if(st<0) st=y; acc+=M[i]; PR[i]=acc; } }
    for(let y=y0;y<=y1;y++){ const row=y*NX, floor=y<NY-1;
      for(let x=x0;x<x1;x++){ const a=row+x, c=a+1;
        if((BLK[a]|BLK[c])&1){ FX[a]=0; continue; }
        const ma=M[a], mc=M[c];
        if(ma<=MINM&&mc<=MINM){ FX[a]=0; continue; }
        let f=FX[a]*DAMP+K*(PR[a]-PR[c])/Math.max(RL[a],RL[c]);
        if(f>0){ if(ma<FILM||!(floor&&((BLK[a+NX]&1)||M[a+NX]>=SUP))) f=0; else if(f>ma*0.45) f=ma*0.45; }
        else if(f<0){ if(mc<FILM||!(floor&&((BLK[c+NX]&1)||M[c+NX]>=SUP))) f=0; else if(-f>mc*0.45) f=-mc*0.45; }
        FX[a]=f; N2[a]-=f; N2[c]+=f;
      } }
    M.set(N2);
    // 3) squeezed water pushes up into the cell above
    for(let y=Math.max(1,y0);y<=y1;y++){ const row=y*NX;
      for(let x=x0;x<=x1;x++){ const i=row+x, m=M[i]; if(m<=1||(BLK[i]&1)) continue;
        const u=i-NX; if(BLK[u]&1) continue;
        let f=m-stable(m+M[u]); if(f<=0) continue; if(f>0.5) f=0.5;
        N2[i]-=f; N2[u]+=f;
      } }
    M.set(N2);
    bbox();
  }

  // ── Water queries ──────────────────────────────────────────────
  const cX=x=>Math.floor(x/F.CS), cY=y=>Math.floor(y/F.CS);
  const topOf=(i,y)=>(y+1)*F.CS-Math.min(1,F.M[i])*F.CS;     // the waterline inside a cell
  // a point inside a body is judged by the water just beside the body
  function cellFor(x,y){
    if(!F.ready) return -1;
    const cx=cX(x), cy=cY(y); if(cx<0||cy<0||cx>=F.NX||cy>=F.NY) return -1;
    const NX=F.NX, BLK=F.BLK, i=cy*NX+cx, v=BLK[i];
    if(!v) return i;
    if(v!==2) return -1;
    let best=-1, bd=99;
    for(const s of [-1,1]) for(let k=1;k<=10;k++){ const xx=cx+s*k; if(xx<0||xx>=NX) break; const j=cy*NX+xx, w=BLK[j]; if(w===1||w===3) break; if(!w){ if(k<bd){ bd=k; best=j; } break; } }
    return best;
  }
  function wetCell(i,y){
    if(i<0) return false;
    const m=F.M[i]; if(m<0.05) return false;
    if(m>=0.95) return true;
    const cy=(i/F.NX)|0;
    if(cy>0&&F.M[i-F.NX]>0.05) return true;
    return y>=topOf(i,cy);
  }
  function waterAt(x,y){ return wetCell(cellFor(x,y),y); }
  function elecAt(x,y){ const i=cellFor(x,y); return i>=0&&F.EL[i]>0&&F.M[i]>0.05; }
  B.inWater=(x,y)=>waterAt(x,y);
  // build 227: how much the water is moving near (x,y) — sideways flow, falling water, the
  // surface waves — and where it's centred (beta_ambience.js makes it sound)
  B.waterMotion=function(x,y,rTiles){
    if(!F.ready) return null;
    const NX=F.NX, NY=F.NY, cx=cX(x), cy=cY(y), R=Math.round((rTiles||12)*2);
    let flow=0, fall=0, wx=0, wy=0, w=0, near=1e9;
    let bx0=null,bx1,by0,by1; if(typeof p!=='undefined'&&p){ bx0=cX(p.x-44); bx1=cX(p.x+SW+44); by0=cY(p.y-40); by1=cY(p.y+FEET_OFF+16); }
    for(let yy=Math.max(0,cy-R);yy<=Math.min(NY-1,cy+R);yy++) for(let xx=Math.max(0,cx-R);xx<=Math.min(NX-1,cx+R);xx++){
      const i=yy*NX+xx, m=F.M[i]; if(m<0.02&&F.FL[i]<0.002) continue;
      if(bx0!=null&&xx>=bx0&&xx<=bx1&&yy>=by0&&yy<=by1){ F.FL[i]*=0.9; continue; }   // MIND's own wake is the wade sound
      const fx=Math.max(0,Math.abs(F.FX[i])-0.006), fl=F.FL[i]; F.FL[i]*=0.9;   // a still pool's tiny settling flux is silence
      const a=fx+fl*2; if(a<0.002) continue;
      flow+=fx; fall+=fl; wx+=xx*a; wy+=yy*a; w+=a;
      const d=Math.hypot(xx-cx,yy-cy); if(d<near) near=d;
    }
    let wave=0; if(F.WV) for(let xx=Math.max(0,cx-R);xx<=Math.min(NX-1,cx+R);xx++) wave+=Math.abs(F.WV[xx]);
    return {flow, fall, wave, x:w?(wx/w+0.5)*F.CS:x, y:w?(wy/w+0.5)*F.CS:y, near:near*F.CS/32};
  };
  B.elecAt=(x,y)=>elecAt(x,y);
  // an enemy is in the water when water stands around its lower body (a film on the floor is not enough)
  B.enemySubmerged=function(e){
    if(!e||!F.ready) return false;
    const x0=e.x+4, x1=e.x+Math.max(8,e.w)-4, bot=e.y+e.h;
    for(let k=0;k<=2;k++){ const x=x0+(x1-x0)*k/2; if(waterAt(x,bot-8)||waterAt(x,e.y+e.h*0.5)) return true; }
    return false;
  };
  // the surface of the water near (x,y): the top wet cell of the nearest wet column
  function surfaceNear(x,y){
    if(!F.ready) return null;
    const NX=F.NX, M=F.M, BLK=F.BLK, cx=cX(x), cy=Math.max(0,Math.min(F.NY-1,cY(y)));
    for(const dx of [0,-1,1,-2,2,-3,3,-4,4]){ const xx=cx+dx; if(xx<0||xx>=NX) continue;
      for(const dy of [0,-1,1,-2,2,-3,3,-4,4]){ const yy=cy+dy; if(yy<0||yy>=F.NY) continue; let i=yy*NX+xx; if(BLK[i]||M[i]<0.05) continue;
        let y2=yy; while(y2>0&&!BLK[i-NX]&&M[i-NX]>0.05){ i-=NX; y2--; }
        return {x:xx, y:y2, i, top:topOf(i,y2)};
      } }
    return null;
  }
  // how much of MIND is under water (0..1), and is that water live?
  function mindDepth(){
    if(!F.ready) return {f:0,live:false};
    const b=mindBox(), cx=b.x+b.w/2; let n=0, wet=0, live=false;
    for(let y=b.y+2;y<b.y+b.h;y+=4){ n++; if(waterAt(cx,y)){ wet++; if(!live&&elecAt(cx,y)) live=true; } }
    return {f:n?wet/n:0, live};
  }
  B.mindDepth=()=>on()?mindDepth():{f:0};

  // ── Moving platforms ──────────────────────────────────────────
  function ridingPlat(pl){
    if(!pl||pl!==p) return null;
    const feet=pl.y+FEET_OFF, cx=pl.x+SW/2;
    if(typeof _mvDropThru!=='undefined'&&_mvDropThru>0) return null;      // dropping through (DOWN + JUMP)
    for(const m of B.platforms) if(cx>=m.x-8&&cx<=m.x+m.w+8&&Math.abs(feet-m.y)<=3&&(pl.vy||0)>=-0.01) return m;
    return null;
  }
  const _origGrounded=window._playerGrounded;
  window._playerGrounded=function(pl){
    if(on()&&pl===p&&ridingPlat(pl)) return true;
    return _origGrounded.apply(this, arguments);
  };
  function platformTick(){
    for(const m of B.platforms){
      const x0=m.x;
      m.x+=m.spd*m.dir;
      if(m.x>=m.b){ m.x=m.b; m.dir=-1; } else if(m.x<=m.a){ m.x=m.a; m.dir=1; }
      m.dx=m.x-x0;
    }
    const m=ridingPlat(p);
    if(m){ p.x+=m.dx; B.ridePlat=m; } else B.ridePlat=null;
    // the hook rides the platform it bit
    const h=p.hook;
    if(h&&h.st==='on'&&!h.tgt){
      if(!h._mplatChecked){
        h._mplatChecked=true; h._mplat=null;
        for(const q of B.platforms) if(h.ax>=q.x-3&&h.ax<=q.x+q.w+3&&h.ay>=q.y-3&&h.ay<=q.y+q.h+3){ h._mplat=q; h._mdx=h.ax-q.x; h._mdy=h.ay-q.y; break; }
      }
      if(h._mplat){ h.ax=h._mplat.x+h._mdx; h.ay=h._mplat.y+h._mdy; h.ex=h.ax; h.ey=h.ay; if(h._path&&h._path[0]){ h._path[0].x=h.ax; h._path[0].y=h.ay; } }
    }else if(h){ h._mplatChecked=false; h._mplat=null; }
  }
  // the hook can bite a moving platform
  const _origRay=window._hookRayHit;
  window._hookRayHit=function(x1,y1,x2,y2){
    const best=_origRay.apply(this, arguments);
    if(!on()||typeof _segAabbHit!=='function') return best;
    let out=best, bd=best?Math.hypot(best.tx-x1,best.ty-y1):1e9;
    for(const m of B.platforms){
      const hit=_segAabbHit(x1,y1,x2,y2,{x:m.x,y:m.y,w:m.w,h:m.h,tp:'solid'});
      if(!hit) continue;
      const d=Math.hypot(hit.tx-x1,hit.ty-y1);
      if(d>=6&&d<bd){ bd=d; out={tx:hit.tx,ty:hit.ty,nx:hit.nx||0,ny:hit.ny||0,enemy:false,tgt:null,plat:null}; }
    }
    return out;
  };

  // ── Movement wrapper: water drag + landing on platforms ─────────
  const _origMove=window._movePlayerWithColl;
  window._movePlayerWithColl=function(pl,vx,vy){
    if(!on()||pl!==p) return _origMove.apply(this, arguments);
    const dpt=mindDepth();
    if(dpt.f>0.25){
      // underwater: gravity mostly cancelled by buoyancy, a gentle sink, heavy drag
      const f=Math.min(1,dpt.f);
      pl.vy-=GRAV*0.74*f; vy=pl.vy;
      if(pl.vy>1.6) pl.vy=vy=1.6;
      if(pl.vy<-7) pl.vy=vy=-7;
      pl.vx*=1-0.07*f; vx=pl.vx;
    }
    const y0=pl.y, riding=B.ridePlat;
    _origMove.call(this, pl, vx, vy);
    const feet0=y0+FEET_OFF, feet=pl.y+FEET_OFF, cx=pl.x+SW/2;
    for(const m of B.platforms){
      if(typeof _mvDropThru!=='undefined'&&_mvDropThru>0) break;
      if(cx<m.x-8||cx>m.x+m.w+8) continue;
      const landing=(vy>=0)&&feet0<=m.y+3&&feet>=m.y-1;
      const staying=riding===m&&vy>=0&&Math.abs(feet-m.y)<=8;
      if(landing||staying){
        pl.y=m.y-FEET_OFF; if(pl.vy>0) pl.vy=0; pl.og=true; B.ridePlat=m;
        if(landing&&!staying&&vy>4){ try{ sfx('land'); }catch(e){} }
        break;
      }
    }
  };
  // ── Water life ─────────────────────────────────────────────────
  // waves: a light height field over the free surface (the look of the
  // sloshing; the water itself moves in the grid)
  function wave(x,P,spread){
    if(!F.ready) return; spread=spread==null?2:spread;
    const c=cX(x);
    for(let k=-spread;k<=spread;k++){ const j=c+k; if(j>=0&&j<F.NX) F.WV[j]+=P*(1-Math.abs(k)/(spread+1)); }
  }
  function wavesTick(){
    const {NX,WH,WV}=F, b=F.bb; if(b.x1<b.x0) return;
    const x0=Math.max(1,b.x0-1), x1=Math.min(NX-2,b.x1+1);
    for(let x=x0;x<=x1;x++){ const a=0.22*(WH[x-1]+WH[x+1]-2*WH[x])-0.015*WH[x]; WV[x]=(WV[x]+a)*0.972; }
    for(let x=x0;x<=x1;x++){ WH[x]+=WV[x]; if(WH[x]>18) WH[x]=18; else if(WH[x]<-18) WH[x]=-18; }
  }
  // take up to `amt` of water from the surface around a column (for spray, the MAG, steam)
  function takeSurface(sf,amt){
    if(!sf||amt<=0) return 0;
    const {NX,M,BLK}=F; let got=0;
    for(const dx of [0,-1,1]){ const x=sf.x+dx; if(x<0||x>=NX) continue;
      let i=sf.y*NX+x; if(BLK[i]) continue;
      if(M[i]<0.05){ i+=NX; if(i>=M.length||BLK[i]||M[i]<0.05) continue; }
      else while(i-NX>=0&&!BLK[i-NX]&&M[i-NX]>0.05) i-=NX;
      const t=Math.min(M[i]*0.6,(amt-got)/(dx?2:1)); if(t<=0) continue;
      M[i]-=t; got+=t; if(got>=amt) break;
    }
    return got;
  }
  // drops: water in the air. Each carries its share and puts it back where it lands.
  B.drops=[]; B.steam=[];
  function spray(x,y,mass,n,power,dirx){
    if(mass<=0) return;
    n=Math.max(1,n|0);
    for(let k=0;k<n;k++){ const a=-Math.PI*(0.18+Math.random()*0.64)+(dirx||0)*0.5;
      B.drops.push({x:x+(Math.random()-0.5)*16, y, vx:Math.cos(a)*(1+Math.random()*2.2)*(0.6+power*0.15), vy:Math.sin(a)*(2+Math.random()*power*0.45), m:mass/n}); }
  }
  function deposit(d){
    const {NX,NY,BLK,M}=F;
    let cx=cX(d.x), cy=cY(d.y);
    if(cx<0||cx>=NX){ F.lost+=d.m; return; }
    cy=Math.max(0,Math.min(NY-1,cy));
    let i=cy*NX+cx;
    for(let k=0;k<40&&BLK[i];k++){ if(i-NX<0) break; i-=NX; }         // landed in a wall/body: the cell on top of it
    if(BLK[i]){ F.lost+=d.m; return; }
    M[i]+=d.m; grow(i);
  }
  function dropsTick(){
    if(!F.ready){ B.drops.length=0; return; }
    const {NX,NY,BLK,M,CS}=F;
    for(let k=B.drops.length-1;k>=0;k--){
      const d=B.drops[k], px=d.x, py=d.y;
      d.vy=Math.min(d.vy+0.35,14); d.vx*=0.99; d.x+=d.vx; d.y+=d.vy;
      const cx=cX(d.x), cy=cY(d.y);
      if(cy>=NY||cx<0||cx>=NX){ F.lost+=d.m; B.drops.splice(k,1); continue; }   // off the world
      if(cy<0) continue;
      const i=cy*NX+cx;
      if(BLK[i]===1||BLK[i]===3){ d.x=px; d.y=py; deposit(d); landed(d); B.drops.splice(k,1); continue; }
      if(!BLK[i]&&M[i]>0.3&&d.vy>0){ deposit(d); landed(d); B.drops.splice(k,1); continue; }
    }
    if(B.drops.length>600){ const extra=B.drops.splice(0,B.drops.length-600); for(const d of extra) deposit(d); }
  }
  function landed(d){
    if(d.m<0.5) return;
    wave(d.x,-Math.min(6,d.m*2.5),2);
    for(let k=0;k<Math.min(18,6+d.m*6);k++){ const a=-Math.PI*Math.random(); PFXS.push({x:d.x,y:d.y,vx:Math.cos(a)*2.5,vy:Math.sin(a)*2.8,life:18,maxLife:18,r:2+Math.random()*2,col:k%2?'#9ad8ff':'#e8f6ff'}); }
    try{ if(window.MV_BETA_AUDIO&&MV_BETA_AUDIO.splash) MV_BETA_AUDIO.splash(Math.min(1,0.25+d.m*0.2)); }catch(e){}
  }
  // an impact throws water out of the hit point (real drops) and rings the surface;
  // coming out (up=true) the hole fills back in and the surface heaves
  function splash(x,y,power,up){
    const sf=surfaceNear(x,y); if(!sf) return;
    const sx0=(sf.x+0.5)*F.CS;
    wave(sx0,up?power*0.9:-power*1.3,2);
    const mass=takeSurface(sf,Math.min(1.6,power*0.07));
    spray(sx0,sf.top-3,mass,Math.min(10,2+power),power,0);
    const n=Math.min(18,4+power*2|0);
    for(let k=0;k<n;k++){ const a=-Math.PI*(0.15+Math.random()*0.7);
      PFXS.push({x:sx0+(Math.random()-0.5)*24,y:sf.top-2,vx:Math.cos(a)*(1+Math.random()*2.5),vy:Math.sin(a)*(1.5+Math.random()*power*0.5),life:18+Math.random()*12|0,maxLife:30,r:1.5+Math.random()*2,col:k%3?'#9ad8ff':'#e8f6ff'}); }
    try{ if(power>0.6&&window.MV_BETA_AUDIO&&MV_BETA_AUDIO.splash){ MV_SPATIAL_from({x,y}); MV_BETA_AUDIO.splash(Math.min(1,power/8)); } }catch(e){}
  }
  // push water along a row (adds to the flow between cells)
  function shove(x,y,dir,P){
    if(!F.ready) return;
    const cx=cX(x), cy=cY(y); if(cy<0||cy>=F.NY) return;
    const e=dir>0?cx:cx-1; if(e<0||e>=F.NX-1) return;
    const a=cy*F.NX+e; if(F.BLK[a]||F.BLK[a+1]) return;
    F.FX[a]+=dir*P;
  }
  // ── ripples: rings that run out from a point through the water ──
  B.wRings=[];
  function ring(x,y,kind,k){ B.wRings.push({x,y,r:4,k,kind,life:60}); wave(x,(kind==='mag'?-1:1)*0.6*k,3); }
  function ringsTick(){ for(let j=B.wRings.length-1;j>=0;j--){ const g=B.wRings[j]; g.r+=3+g.k*1.2; g.life--; if(g.life<=0) B.wRings.splice(j,1); } }

  // ── MAG: suck water up to the tip ─────────────────────────────
  // Close above the surface the magnet draws the water up into a hump; water
  // that reaches the tip clings to it as a wobbling blob (taken out of the
  // pool) and costs extra power to hold. Let go and it falls as one big drop —
  // into the water, or onto the floor, where it runs off like any water.
  B.magWater={area:0, x:0, y:0, drops:[]};
  function magnetWater(){
    const M=B.magWater, held=!!(p&&p.magOn&&ITEM===3&&B.magTip);
    if(!held||!F.ready) return;
    const t=B.magTip(), pw=Math.max(0,Math.min(1,(p.itemStamina||0)/100)), cap=2600*pw, reach=150;
    if(waterAt(t.x,t.y)) return;                                  // under water: the whirlpool instead
    const {NX,NY,BLK,CS}=F, Mm=F.M, tc=cX(t.x), tr=Math.max(0,cY(t.y));
    for(let k=-6;k<=6;k++){ const x=tc+k; if(x<0||x>=NX) continue;
      for(let y=tr;y<Math.min(NY,tr+Math.ceil(reach/CS)+1);y++){ const i=y*NX+x; if(BLK[i]===1) break; if(BLK[i]||Mm[i]<0.05) continue;
        const top=topOf(i,y), gap=top-t.y, kk=(1-Math.abs(k)/7)*(1-Math.max(0,gap)/reach);
        if(kk>0) F.WV[x]+=0.5*kk*kk*pw;                           // the surface rises toward the tip
        if(gap<18&&Math.abs(k)<=1&&M.area<cap){
          const take=Math.min(Mm[i]*0.5,0.05*pw+0.015); Mm[i]-=take; M.area+=take*CS*CS;
          if(fr%2===0) M.drops.push({x:(x+0.5)*CS+(Math.random()-0.5)*10,y:top,vy:-2-Math.random()*2});
        }
        break;
      } }
  }
  function magWaterTick(){
    const M=B.magWater, held=!!(p&&p.magOn&&ITEM===3&&B.magTip);
    if(M.area>0){
      if(held){
        const t=B.magTip(); M.x=t.x; M.y=t.y; M.vx=(p.vx||0); M.vy=(p.vy||0);
        p.itemStamina=Math.max(0,(p.itemStamina||0)-M.area/2600*0.12);
        if(fr%9===0) PFXS.push({x:M.x+(Math.random()-0.5)*12,y:M.y+6,vx:0,vy:1.5,life:16,maxLife:16,r:2,col:'#9ad8ff'});
      }else{                                                      // let go: it falls as one drop of all of it
        B.drops.push({x:M.x, y:M.y, vx:M.vx||0, vy:M.vy||0, m:M.area/(F.CS*F.CS), big:true}); M.area=0;
      }
    }
    for(let i=M.drops.length-1;i>=0;i--){ const d=M.drops[i]; d.y+=d.vy; d.x+=(M.x-d.x)*0.18; d.vy-=0.05; if(Math.abs(d.y-M.y)<10||d.y<M.y-30) M.drops.splice(i,1); }
  }

  // ── XLR + MAG move the water itself ───────────────────────────
  // XLR held under water: a jet that drives the water along it, and a pocket
  // of air on the nozzle (3x3 blocks at full charge) that shoves the water out
  // of its way — the level rises. Let go of a charged push: one big surge.
  // Held just above the surface and aimed at it, it blows a crater and throws
  // real water out of the pool. MAG under water: a whirlpool that draws the
  // water in toward the tip.
  function itemWater(){
    if(!p||!F.ready) return;
    const xlr=!!(p.xlrOn&&ITEM===2&&typeof connectorTipWorld==='function');
    const mag=!!(p.magOn&&ITEM===3&&B.magTip);
    const ch=Math.max(Math.min(1,(B.chX||0)/45),Math.min(1,(p.itemStamina||0)/100));
    const rel=(B._xlrWas&&!xlr&&B._xlrCh>0.25&&B._xlrInW)?{tip:B._xlrTip,ch:B._xlrCh}:null;
    B._xlrWas=xlr; B._xlrCh=xlr?ch:0; B._xlrInW=false;
    if(rel) surge(rel.tip,rel.ch);
    if(xlr){
      const t=connectorTipWorld(2), a=Math.atan2(p.aimDY,p.aimDX), ux=Math.cos(a), uy=Math.sin(a);
      B._xlrTip={x:t.x,y:t.y,ux,uy};
      const pw=0.45+0.9*ch;
      if(waterAt(t.x,t.y)){
        B._xlrInW=true;
        const pulse=0.75+0.25*Math.sin(fr*0.35);
        for(let k=0;k<12;k++){ const x=t.x+ux*k*16, y=t.y+uy*k*16; if(Math.abs(ux)>0.2) shove(x,y,ux>0?1:-1,Math.abs(ux)*0.05*pw*pulse*(1-k/13)); }
        if(uy<-0.3) wave(t.x,0.25*pw,2); else if(uy>0.3) wave(t.x,-0.25*pw,2);
        let b=B.xBub;
        if(!b||b.free){ b=B.xBub={x:t.x,y:t.y,r:6,free:false,vx:0,vy:0}; }
        const goal=10+38*ch; b.r+=(goal-b.r)*0.22; b.held=fr;
        b.x=t.x+ux*b.r*0.9; b.y=t.y+uy*b.r*0.9; b.ux=ux; b.uy=uy;
        if(fr%10===0){ ring(b.x,b.y,'air',0.7+1.6*ch); if(ch>0.8) B.shake=Math.max(B.shake||0,2.5); }
        const nb=1+Math.round(ch*4);
        for(let k=0;k<nb;k++){ const a2=Math.random()*Math.PI*2, rr=b.r*(0.9+Math.random()*0.3);
          B.bubbles.push({x:b.x+Math.cos(a2)*rr,y:b.y+Math.sin(a2)*rr,r:2+Math.random()*(3+6*ch),vy:-0.6-Math.random()*1.5+uy*2,vx:ux*(2+3*ch)+Math.cos(a2)*1.2}); }
        const sf=surfaceNear(b.x,b.y-b.r-8);
        if(sf&&ch>0.5&&b.y-b.r-sf.top<90&&fr%2===0) for(let k=0;k<2;k++) PFXS.push({x:b.x+(Math.random()-0.5)*b.r*2,y:sf.top-2,vx:(Math.random()-0.5)*2.5,vy:-1.5-Math.random()*3*ch,life:16+Math.random()*10|0,maxLife:26,r:1.5+Math.random()*2.5,col:k?'#ffffff':'#bfe6ff'});
      }else if(uy>0.25){
        // above the water, blowing at it: where does the blast meet the surface?
        let hx=null, hy=null;
        for(let d=8;d<170;d+=8){ const x=t.x+ux*d, y=t.y+uy*d; if(waterAt(x,y)){ hx=x; hy=y; break; } if(gridWorldSolid(x,y)) break; }
        if(hx!=null){
          B._xlrTip={x:hx,y:hy,ux,uy}; B._xlrInW=true;
          const d=Math.hypot(hx-t.x,hy-t.y), k0=(1-d/170)*pw, sf=surfaceNear(hx,hy);
          wave(hx,-0.9*k0,3);
          shove(hx,hy,ux>=0?1:-1,0.04*k0*(0.3+Math.abs(ux)));
          if(sf&&fr%3===0){ const m=takeSurface(sf,0.035*k0); spray(hx,sf.top-3,m,2,3+4*k0,ux); }
          if(fr%2===0&&sf){ for(let k=0;k<3;k++){ const a2=-Math.PI*(0.2+Math.random()*0.6)+ux*0.4; PFXS.push({x:hx+(Math.random()-0.5)*20,y:sf.top-2,vx:Math.cos(a2)*(1.5+Math.random()*2.5*k0),vy:Math.sin(a2)*(2+Math.random()*3*k0),life:18+Math.random()*10|0,maxLife:28,r:1.5+Math.random()*2,col:k%2?'#bfe6ff':'#ffffff'}); } }
        }
      }
    }
    if(mag){
      const t=B.magTip();
      if(waterAt(t.x,t.y)){
        const pw=Math.max(0.2,Math.min(1,(p.itemStamina||0)/100));
        const sf=surfaceNear(t.x,t.y), depth=sf?Math.max(0,t.y-sf.top):0, reach=Math.max(0.2,1-depth/320);
        for(let k=-8;k<=8;k++) F.WV[Math.max(0,Math.min(F.NX-1,cX(t.x)+k))]-=(0.25+0.45*pw)*reach*(1-Math.abs(k)/9)*(0.8+0.2*Math.sin(fr*0.3));
        for(let k=1;k<=8;k++){ shove(t.x-k*16,t.y,1,(0.015+0.03*pw)*(1-k/9)); shove(t.x+k*16,t.y,-1,(0.015+0.03*pw)*(1-k/9)); }
        if(fr%12===0){ ring(t.x,t.y,'mag',0.5+1.3*pw); if(pw>0.8) B.shake=Math.max(B.shake||0,1.5); }
        const nb=1+Math.round(pw*3);
        for(let k=0;k<nb;k++){ const ang=fr*0.21+k*2.1, r=30+Math.random()*(40+50*pw);
          B.bubbles.push({x:t.x+Math.cos(ang)*r,y:t.y+Math.sin(ang)*r,r:1.5+Math.random()*(2+3*pw),vy:0,vx:0,to:{x:t.x,y:t.y},ang,rad:r}); }
      }
    }
  }
  function airBubbleTick(){
    const b=B.xBub; if(!b) return;
    if(!b.free&&b.held!==fr-1&&b.held!==fr){ b.free=true; b.vx=(b.ux||0)*3; b.vy=(b.uy||0)*3-0.5; ring(b.x,b.y,'air',1.6); }
    if(!b.free) return;
    b.vy=Math.max(-5,b.vy-0.14); b.vx*=0.95; b.x+=b.vx; b.y+=b.vy;
    if(gridWorldSolid(b.x,b.y-b.r)){ b.vy=Math.max(0,b.vy); b.r*=0.97; }
    if(fr%3===0) B.bubbles.push({x:b.x+(Math.random()-0.5)*b.r,y:b.y+b.r*0.8,r:1.5+Math.random()*2,vy:-1});
    const top=b.y-b.r*0.2;
    if(!waterAt(b.x,top-F.CS)&&!waterAt(b.x-b.r*0.6,top-F.CS)&&!waterAt(b.x+b.r*0.6,top-F.CS)||b.r<5){   // bursts through the surface
      splash(b.x,top,Math.min(9,2+b.r*0.14),true);
      for(let k=0;k<Math.round(6+b.r/3);k++){ const a=-Math.PI*(0.1+Math.random()*0.8); PFXS.push({x:b.x+(Math.random()-0.5)*b.r,y:top-2,vx:Math.cos(a)*(1+Math.random()*3),vy:Math.sin(a)*(2+Math.random()*b.r*0.08),life:20+Math.random()*12|0,maxLife:32,r:1.5+Math.random()*2.5,col:k%3?'#bfe6ff':'#ffffff'}); }
      ring(b.x,top+4,'air',1.2);
      try{ if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.splash(Math.min(1,0.3+b.r/60)); }catch(e){}
      B.xBub=null;
    }
  }
  function surge(tip,ch){
    B.shake=Math.max(B.shake||0,3+5*ch);
    for(let k=0;k<10;k++) shove(tip.x+(tip.ux||0)*k*16,tip.y,(tip.ux||0)>=0?1:-1,(0.15+0.5*ch)*(1-k/11));
    wave(tip.x,-(tip.uy||0)*6*ch,4);
    splash(tip.x+(tip.ux||0)*30,tip.y,2+4*ch,tip.uy<0);
    for(let k=0;k<14;k++){ const a=Math.random()*Math.PI*2; B.bubbles.push({x:tip.x+Math.cos(a)*10,y:tip.y+Math.sin(a)*10,r:2+Math.random()*4,vy:Math.sin(a)*2-1,vx:Math.cos(a)*3+(tip.ux||0)*4}); }
    try{ if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.splash(Math.min(1,0.4+ch)); }catch(e){}
  }

  // ── RCA hook (and enemy ropes) through water ──────────────────
  function ropeWater(o, vxKey, vyKey, onDead){
    const x=o.x, y=o.y, w=waterAt(x,y), was=o._wet;
    o._wet=w;
    if(w&&!was){
      const sp=Math.hypot(o[vxKey],o[vyKey]), down=o[vyKey]>0;
      if(down&&sp>9&&Math.abs(o[vyKey])<sp*0.28){ o[vyKey]=-Math.abs(o[vyKey])*0.7; o[vxKey]*=0.8; o._wet=false; splash(x,y,1.2,true); return; }
      o[vxKey]*=0.5; o[vyKey]*=0.72;
      splash(x,y,Math.min(5,sp*0.3),false);
    }
    if(w){
      o[vxKey]*=0.92; o[vyKey]=o[vyKey]*0.92+0.14;
      if(fr%3===0) B.bubbles.push({x,y,r:2+Math.random()*2,vy:-0.8});
      if(Math.hypot(o[vxKey],o[vyKey])<0.9&&onDead) onDead();
    }
  }
  function hookWaterTick(){
    const h=p&&p.hook;
    if(h&&h.st==='ext'){
      const o={x:h.ex,y:h.ey,ex:h.evx,ey:h.evy,_wet:h._wet};
      ropeWater(o,'ex','ey',()=>{ h.st='idle'; h.ox=NaN; h.oy=NaN; h.tgt=null; h.plat=null; h._path=null; h.pivots=null; h.vr=null; try{ sfx('hook_miss'); }catch(e){} });
      h.evx=o.ex; h.evy=o.ey; h._wet=o._wet;
    }else if(h) h._wet=false;
    for(const r of (B.ropes||[])){ if(r.st!=='fly') continue; ropeWater(r,'vx','vy',()=>{ r.t=999; }); }
  }

  // ── Electricity and vapor ──────────────────────────────────────
  // A TRS shot into water: the whole connected body goes live for a moment,
  // the hit point boils off at once, and the live surface steams away.
  function electrify(i0,dur){
    const {NX,NY,M,BLK,EL,Q}=F; let h=0,t=0;
    Q[t++]=i0; EL[i0]=Math.max(EL[i0],dur);
    while(h<t){ const i=Q[h++], x=i%NX;
      const nb=[x>0?i-1:-1, x<NX-1?i+1:-1, i-NX, i+NX];
      for(const j of nb){ if(j<0||j>=M.length||BLK[j]||M[j]<0.05||EL[j]>=dur) continue; EL[j]=dur; Q[t++]=j; if(t>=Q.length) return; }
    }
  }
  function boil(i0,amt){
    const {NX,M,BLK,Q,CS}=F; let h=0,t=0,left=amt; const seen=new Set([i0]);
    Q[t++]=i0;
    while(h<t&&left>0){ const i=Q[h++], x=i%NX, y=(i/NX)|0;
      const take=Math.min(M[i],left); if(take>0){ M[i]-=take; left-=take; F.vapor+=take;
        if(Math.random()<0.6) B.steam.push({x:(x+0.5)*CS+(Math.random()-0.5)*CS,y:(y+0.5)*CS,vx:(Math.random()-0.5)*0.8,vy:-0.6-Math.random()*1.2,r:6+Math.random()*8,life:60+Math.random()*40|0,max:100}); }
      for(const j of [i-NX,x>0?i-1:-1,x<NX-1?i+1:-1,i+NX]){ if(j<0||j>=M.length||seen.has(j)||BLK[j]||M[j]<0.02) continue; seen.add(j); Q[t++]=j; }
    }
  }
  function elecTick(){
    const {NX,M,BLK,EL,CS}=F, b=F.bb; if(b.x1<b.x0) return;
    for(let y=Math.max(0,b.y0-1);y<=Math.min(F.NY-1,b.y1+1);y++) for(let x=b.x0;x<=b.x1;x++){
      const i=y*NX+x; if(!EL[i]) continue;
      EL[i]--; if(M[i]<0.05){ EL[i]=0; continue; }
      if(y>0&&!BLK[i-NX]&&M[i-NX]<0.05){                      // a live cell at the surface: it steams off
        const t=Math.min(M[i],ELEC_BOIL); M[i]-=t; F.vapor+=t;
        if(Math.random()<0.05) B.steam.push({x:(x+Math.random())*CS,y:topOf(i,y),vx:(Math.random()-0.5)*0.6,vy:-0.5-Math.random(),r:5+Math.random()*7,life:50+Math.random()*40|0,max:90});
      }
    }
  }
  // a film too thin to run anywhere (a wet patch left on a ledge) dries off slowly
  function filmTick(){
    if(fr%4) return;
    const {NX,NY,M,BLK}=F, b=F.bb; if(b.x1<b.x0) return;
    for(let y=b.y0;y<=Math.min(NY-2,b.y1);y++) for(let x=Math.max(1,b.x0);x<=Math.min(NX-2,b.x1);x++){
      const i=y*NX+x, m=M[i]; if(m<=0||m>=FILM||BLK[i]) continue;
      if(M[i-1]>=FILM||M[i+1]>=FILM||M[i-NX]>0.001||!((BLK[i+NX]&1)||M[i+NX]>=SUP)) continue;
      const t=Math.min(m,0.0016); M[i]-=t; F.vapor+=t;
    }
  }
  function steamTick(){
    for(let k=B.steam.length-1;k>=0;k--){ const s=B.steam[k]; s.x+=s.vx+Math.sin(fr*0.05+k)*0.2; s.y+=s.vy; s.vy*=0.99; s.r+=0.18; if(--s.life<=0||gridWorldSolid(s.x,s.y-s.r*0.5)&&s.life<30) B.steam.splice(k,1); }
    if(B.steam.length>400) B.steam.splice(0,B.steam.length-400);
  }

  // ── Bodies in the water: splashes as they cross the surface ────
  function bodies(){
    const out=[];
    if(p){ const b=mindBox(); out.push({ref:p, x:b.x, y:b.y, w:b.w, h:b.h, m:(B.WEIGHT&&B.WEIGHT.mindTotal)||9.5, vx:p.vx||0, vy:p.vy||0, me:true}); }
    for(const bw of BWALLS) if(bw.cube&&bw.hp>0&&!bw._carried){ const x=bw.x+(bw._ox||0), y=bw.y+(bw._oy||0); out.push({ref:bw, x, y, w:T, h:T, m:B.weightOf?B.weightOf('cube',bw):3, vx:bw.vx||0, vy:bw.vy||(bw._fallN?4:0)}); }
    for(const e of ENEMS){ if(e._betaHeld) continue; out.push({ref:e, x:e.x, y:e.y, w:e.w, h:e.h, m:B.weightOf?B.weightOf('enemy',e):6, vx:e.vx||0, vy:e.vy||0, enemy:true}); }
    for(const k of KDROP){ if(k.got&&!k._fly) continue; out.push({ref:k, x:k.x-10, y:k.y-10, w:20, h:20, m:0.5, vx:k.vx||0, vy:k.vy||0}); }
    return out;
  }

  // ── A plug of electro blocks gives way: the rush of water ──────
  function plugTick(){
    for(const bw of BWALLS){
      if(!bw.plug||bw.hp>0||bw._gushed) continue;
      bw._gushed=true;
      let wet=false;
      for(let dy=-8;dy<=bw.h+8&&!wet;dy+=8) for(let dx=-12;dx<=bw.w+12;dx+=12) if(waterAt(bw.x+dx,bw.y+dy)){ wet=true; break; }
      if(wet&&!B._gushFr||wet&&fr-B._gushFr>90){ B._gushFr=fr; try{ if(window.MV_BETA_AUDIO&&MV_BETA_AUDIO.splash) MV_SPATIAL_from(bw),MV_BETA_AUDIO.splash(1); sfxAt(bw,'water_gush'); }catch(e){} B.shake=Math.max(B.shake||0,4); }
    }
  }
  // where a falling stream hits standing water or the floor: spray (looks only)
  function pourFx(){
    if(fr%3) return;
    const {NX,NY,M,BLK,CS}=F, b=F.bb; if(b.x1<b.x0) return;
    for(let x=b.x0;x<=b.x1;x++) for(let y=b.y0;y<Math.min(NY-1,b.y1+1);y++){
      const i=y*NX+x, j=i+NX; if(BLK[i]||M[i]<0.08) continue;
      if(i-NX>=0&&M[i-NX]>0.08&&!BLK[i-NX]&&M[i]<0.9&&(BLK[j]===1||M[j]>=SUP)&&Math.random()<0.35){
        const top=topOf(i,y);
        PFXS.push({x:(x+Math.random())*CS,y:top-1,vx:(Math.random()-0.5)*3,vy:-1-Math.random()*2.2,life:14+Math.random()*10|0,maxLife:24,r:1.5+Math.random()*1.5,col:Math.random()<0.5?'#bfe6ff':'#ffffff'});
        if(Math.random()<0.3) F.WV[x]-=0.4;
      }
    }
  }

  function waterTick(){
    platformTick();
    isolatorTick();
    if(!F.ready&&!(F.rects.length&&fluidInit())) return;
    terrain();
    occupy();
    hookWaterTick(); magnetWater(); magWaterTick(); itemWater(); airBubbleTick(); ringsTick();
    for(let s=0;s<SUB;s++) step(!(s&1));
    displace();
    dropsTick(); wavesTick(); elecTick(); filmTick(); steamTick(); plugTick(); pourFx();
    const list=bodies();
    // splashes as things cross the surface
    for(const b of list){
      const cx=b.x+b.w/2, cy=b.y+b.h/2, inside=waterAt(cx,cy), was=!!b.ref._inW;
      if(inside&&!was&&Math.abs(b.vy)>0.6) splash(cx,cy,Math.min(9,Math.abs(b.vy)*0.45*Math.sqrt(b.m)),false);
      if(!inside&&was&&b.vy<-1) splash(cx,cy,Math.min(6,Math.abs(b.vy)*0.3*Math.sqrt(b.m)),true);
      b.ref._inW=inside;
      if(inside&&Math.abs(b.vx)>1.2&&fr%3===0&&!waterAt(cx,b.y-6)){ wave(cx+Math.sign(b.vx)*b.w/2,-Math.abs(b.vx)*0.2,1); }
      if(inside&&(b.me||Math.abs(b.vx)+Math.abs(b.vy)>0.4)&&fr%(b.me?6:12)===0) B.bubbles.push({x:cx+(Math.random()-0.5)*b.w*0.6,y:cy,r:3+Math.random()*4,vy:-0.7-Math.random()*0.9});
    }
    // the XLR's current carries things along
    if(p&&p.xlrOn&&ITEM===2&&typeof connectorTipWorld==='function'){
      const t=connectorTipWorld(2), a=Math.atan2(p.aimDY,p.aimDX), ux=Math.cos(a), uy=Math.sin(a);
      if(waterAt(t.x,t.y)){
        for(const b of list){ if(b.me) continue;
          const dx=b.x+b.w/2-t.x, dy=b.y+b.h/2-t.y, d=Math.hypot(dx,dy); if(d>120||(dx*ux+dy*uy)/Math.max(1,d)<0.5) continue;
          const k=(1-d/120)*0.6/Math.max(1,b.m*0.4);
          if(b.enemy||b.ref.kind){ b.ref.vx=(b.ref.vx||0)+ux*k*3; b.ref.vy=(b.ref.vy||0)+uy*k*3; }
          else if(b.ref._fly){ b.ref.vx+=ux*k*3; b.ref.vy+=uy*k*3; } }
        p.vx-=ux*0.18; p.vy-=uy*0.18;
        if(fr%2===0) B.bubbles.push({x:t.x+ux*20,y:t.y+uy*20,r:2+Math.random()*2,vy:-0.4+uy*1.5,vx:ux*2.5});
      }
    }
    // electricity: a TRS shot into the water
    for(const s of (p&&p.shots)||[]){
      if(s.type!=='laser'||s.life<=0) continue;
      const i=cellFor(s.x,s.y);
      if(!wetCell(i,s.y)) continue;
      electrify(i,s.charged?90:55); boil(i,s.charged?BOIL_CHARGED:BOIL_SHOT);
      s.life=0; zap(1); try{ sfxAt(s,'water_boil'); }catch(e){}
      for(let k=0;k<(s.charged?14:7);k++) B.steam.push({x:s.x+(Math.random()-0.5)*30,y:s.y-Math.random()*20,vx:(Math.random()-0.5)*1.2,vy:-1-Math.random()*1.5,r:8+Math.random()*10,life:70+Math.random()*40|0,max:110});
    }
    // enemies short-circuit in water just like MIND does (Paulo, Oct 21): sparks and
    // crackle over them, they lose power fast, and if they stay in they shut down
    // for good. Out of the water in time, they recover.
    for(const b of list){
      if(!b.enemy) continue;
      const e=b.ref; if(e._iso) continue;
      const wet=B.enemySubmerged(e);
      if(wet&&e.alive){
        e._shortT=(e._shortT||0)+1; e._shorting=true;
        if(fr%3===0) spark(e.x+e.w/2,e.y+e.h/2,Math.max(e.w,e.h)*0.6);
        if(fr%8===0) zap(0.6);
        e.vx=(e.vx||0)*0.85+(Math.random()-0.5)*0.6;
        if(e._shortT>=ENEMY_SHORT_FR&&!e._shorted){
          e._shorted=true; if(typeof _damageEnemy==='function') _damageEnemy(e,9999,e.x+e.w/2,e.y);
          if(B.stats) B.stats.shortedEnemies=(B.stats.shortedEnemies||0)+1; zap(1); for(let k=0;k<12;k++) spark(e.x+e.w/2,e.y+e.h/2,28);
          if(!e._permOff){ e._permOff=true; e._downs=3; if(B.stats) B.stats.permOff=(B.stats.permOff||0)+1; }
          e._revT=0;
        }
      }else{ e._shorting=false; if(e._shortT>0) e._shortT=Math.max(0,e._shortT-2); }
      if(wet&&!e.alive&&e._shorted){ e.vy=Math.min((e.vy||0),1.2); e.vx=(e.vx||0)*0.9; if(fr%9===0) spark(e.x+e.w/2,e.y+e.h/3,16); }
    }
    // MIND: short-circuit without the Isolator
    const dpt=mindDepth();
    B.mindWet=dpt.f;
    if(dpt.f>0.4){
      const live=dpt.live;
      if(!B.hasIsolator){
        const drain=live?1.6:0.55;
        p.hp=Math.max(0,p.hp-drain);
        if(typeof _syncLivesFromHp==='function') _syncLivesFromHp(p);
        if(fr%3===0) spark(p.x+SW/2,p.y+FEET_OFF-50,30);
        if(fr%10===0) zap(live?0.9:0.5);
        if(p.hp<=0&&typeof applyPlayerHit==='function'){ p.hp=1; applyPlayerHit(0,-2,5); }
        B.shortT=8;
      }else if(live&&fr%4===0) spark(p.x+SW/2,p.y+FEET_OFF-50,34,'#8af');
    }
    if(B.shortT>0) B.shortT--;
    // swimming: a kick on jump, a stronger one to hop out at the surface
    if(dpt.f>0.3&&typeof isJumpJ==='function'&&isJumpJ()&&(B.kickCd||0)<=0){
      const out=dpt.f<0.75;
      p.vy=out?Math.min(p.vy,JI*1.9):Math.min(p.vy,-4.2); p.og=false; p._groundHold=0; B.kickCd=12;
      splash(p.x+SW/2,p.y+FEET_OFF-40,1.2,true);
      try{ sfx('jump_reg'); }catch(e){}
    }
    if(B.kickCd>0) B.kickCd--;
    // bubbles
    for(let i=B.bubbles.length-1;i>=0;i--){
      const b=B.bubbles[i];
      if(b.to){ b.ang+=0.18; b.rad*=0.9; b.x=b.to.x+Math.cos(b.ang)*b.rad; b.y=b.to.y+Math.sin(b.ang)*b.rad; if(b.rad<4) B.bubbles.splice(i,1); continue; }
      b.y+=b.vy; b.x+=(b.vx||0)+Math.sin(fr*0.1+i)*0.3; if(b.vx) b.vx*=0.95;
      if(!waterAt(b.x,b.y)&&!(B.xBub&&Math.hypot(b.x-B.xBub.x,b.y-B.xBub.y)<B.xBub.r+8)) B.bubbles.splice(i,1);
    }
    if(B.bubbles.length>320) B.bubbles.splice(0,B.bubbles.length-320);
  }
  B.waterTick=waterTick;

  function spark(x,y,spread,col){
    for(let k=0;k<2;k++){ const a=Math.random()*Math.PI*2, r=Math.random()*spread;
      PFXS.push({x:x+Math.cos(a)*r,y:y+Math.sin(a)*r,vx:(Math.random()-0.5)*3,vy:(Math.random()-0.5)*3,life:6+Math.random()*6|0,maxLife:12,r:1.5,col:col||(Math.random()<0.5?'#fff27a':'#7ae0ff')}); }
  }
  // electric buzz (synth)
  let lastZap=0;
  function zap(k){
    try{
      const a=typeof ga==='function'?ga():null; if(!a||a.state!=='running') return;
      const t=a.currentTime; if(t-lastZap<0.08) return; lastZap=t;
      const o=a.createOscillator(), g=a.createGain(), o2=a.createOscillator();
      o.type='square'; o.frequency.setValueAtTime(110+Math.random()*60,t); o2.type='sawtooth'; o2.frequency.setValueAtTime(1800+Math.random()*900,t);
      const sv=Math.max(0,Math.min(1,OPT.sfxVol!=null?OPT.sfxVol:1));
      g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.05*sv*(0.5+k),t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+0.12);
      o.connect(g); o2.connect(g); g.connect(a.destination); o.start(t); o2.start(t); o.stop(t+0.13); o2.stop(t+0.13);
    }catch(e){}
  }

  // ── The Isolator pickup ───────────────────────────────────────
  // Paulo, Oct 2026: the Isolator works for 30 seconds, then it wears off.
  // The crate grows back 30 seconds after it's taken.
  const ISO_TIME=1800, ISO_RESPAWN=1800;                   // frames (60 fps)
  B.ISO_TIME=ISO_TIME;
  function isolatorTick(){
    const iso=B.isoPickup;
    if(B.hasIsolator){                                     // wearing off
      B.isoT=(B.isoT||0)-1;
      if(B.isoT===300||B.isoT===120) try{ zap(0.3); }catch(e){}
      if(B.isoT<=0){
        B.hasIsolator=false; B.isoT=0;
        if(p) for(let k=0;k<14;k++){ const a=Math.random()*Math.PI*2, s=1+Math.random()*2.5; PFXS.push({x:p.x+SW/2+Math.cos(a)*24,y:p.y+FEET_OFF-50+Math.sin(a)*30,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:20+Math.random()*10|0,maxLife:30,r:2+Math.random()*2,col:'#c86a30'}); }
        if(typeof uiShowToast==='function') uiShowToast('THE ISOLATOR WORE OFF - A NEW ONE GROWS BACK SOON');
      }
    }
    if(iso&&iso.got&&iso.re>0){                            // the crate grows back
      iso.re--;
      if(iso.re<=0){ iso.got=false; iso.pop=20;
        for(let k=0;k<12;k++){ const a=Math.random()*Math.PI*2; PFXS.push({x:iso.x,y:iso.y-20,vx:Math.cos(a)*2,vy:Math.sin(a)*2-1,life:18,maxLife:18,r:2,col:'#ffa040'}); } }
    }
    if(!iso||iso.got||!p) return;
    const core=playerCoreHB(p), feet=p.y+FEET_OFF;
    const iR=B.crateRect?B.crateRect(iso):{x:iso.x-23,y:iso.y-40,w:46,h:40};   // boxed: break it open first
    if(iR&&ov(core.x-4,core.y,core.w+8,feet+6-core.y,iR.x,iR.y,iR.w,iR.h)){
      iso.got=true; iso.re=ISO_RESPAWN; B.hasIsolator=true; B.isoT=ISO_TIME;
      if(!B.isoEver){ B.isoEver=true; B.stats.items++; }
      for(let k=0;k<16;k++){ const a=Math.random()*Math.PI*2, s=1.6+Math.random()*3; PFXS.push({x:iso.x,y:iso.y-20,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,life:16+Math.random()*12|0,maxLife:28,r:2+Math.random()*2,col:'#ffa040'}); }
      if(B.openPopup) B.openPopup(4);
    }
  }
  if(B.ITEM_INFO&&!B.ITEM_INFO[4]) B.ITEM_INFO[4]={name:'THE ISOLATOR', lines:['A RUBBER WRAP FOR A SPEAKER. WITH IT ON,','MIND GOES UNDERWATER WITHOUT SHORTING OUT -','EVEN WHEN THE WATER IS ELECTRIFIED.','IT LASTS 30 SECONDS - A NEW ONE GROWS BACK 30 SECONDS LATER.','IN WATER: A KICKS, HOLD X WITH THE XLR: A CURRENT.']};
  B.extraAch=function(){ const a=[]; if(B.stageId==='1.2'&&B.isoEver) a.push('INSULATED - FOUND THE ISOLATOR'); if(B.stats&&B.stats.shortedEnemies>=1) a.push('SHORT CIRCUIT - DUNKED AN ENEMY'); return a; };

  // ── Drawing ───────────────────────────────────────────────────
  B.drawWorldExtras=function(){
    const D=window.MV_BETA_DECOR;
    for(const m of B.platforms){
      // (no rail: the arrows in the sketch only mark how far it travels)
      // the platform: wooden planks on an iron frame, glowing ends
      const x=sx(m.x), y=sy(m.y), w=sw(m.w), h=sw(m.h);
      ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(x+3,y+h,w-6,sw(4));
      ctx.fillStyle='#3a3e46'; ctx.fillRect(x,y,w,h);
      ctx.fillStyle='#8a5a32'; ctx.fillRect(x+sw(2),y+sw(2),w-sw(4),h-sw(6));
      ctx.fillStyle='#a8703a'; ctx.fillRect(x+sw(2),y+sw(2),w-sw(4),sw(3));
      for(let k=1;k<4;k++){ ctx.fillStyle='#5a3418'; ctx.fillRect(x+w*k/4,y+sw(2),1,h-sw(6)); }
      for(const rx of [x+sw(6),x+w-sw(6)]){ ctx.fillStyle='#c8ccd4'; ctx.beginPath(); ctx.arc(rx,y+h-sw(4),sw(2),0,Math.PI*2); ctx.fill(); }
      const pulse=0.5+0.5*Math.sin(fr*0.1);
      ctx.fillStyle='rgba(120,230,255,'+(0.4+0.4*pulse)+')'; ctx.fillRect(m.dir>0?x+w-sw(4):x,y,sw(4),sw(4));
    }
    const iso=B.isoPickup;
    if(iso&&!iso.got&&D){ D.glow&&D.glow(iso.x,iso.y-20,50,0.25+0.1*Math.sin(fr*0.08),'rgba(255,150,60,'); if(B.drawCrate) B.drawCrate(iso); else D.itemCrate(4,iso.x,iso.y,false); }
  };  // water goes over the characters (they look submerged), under the HUD
  const _origFg=window.drawTmjForeground;
  window.drawTmjForeground=function(){
    const r=_origFg?_origFg.apply(this, arguments):undefined;
    if(on()) drawWater();
    return r;
  };
  // water as drawn: a body standing in the water is shown under it (the
  // water inside its outline matches the water beside it)
  function em(i){
    const v=F.BLK[i];
    if(!v) return F.M[i];
    if(v!==2) return -1;
    const NX=F.NX, x=i%NX; let best=0;
    for(const s of [-1,1]) for(let k=1;k<=10;k++){ const xx=x+s*k; if(xx<0||xx>=NX) break; const j=i+s*k, w=F.BLK[j]; if(w&1) break; if(!w){ if(F.M[j]>best) best=F.M[j]; break; } }
    return best;
  }
  // the top of the standing water in cell (x,y) if that cell holds the top of a run, else null
  function runTop(x,y){
    if(x<0||x>=F.NX||y<0||y>=F.NY) return null;
    const NX=F.NX, i=y*NX+x, m=em(i);
    if(m<0.02) return null;
    if(y>0&&em(i-NX)>=0.02) return null;
    let t=(y+1)*F.CS-Math.min(1,m)*F.CS;
    if(y>0&&!(F.BLK[i-NX]&1)) t-=Math.max(-F.CS*0.8,Math.min(F.CS*0.8,F.WH[x]));
    return t;
  }
  function drawWater(){
    if(!F.ready) return;
    const {NX,NY,CS,BLK,EL}=F, b=F.bb;
    const pool=new Path2D(), stream=new Path2D(), surf=[], live=[];
    let tMin=1e9, bMax=-1e9;
    if(b.x1>=b.x0) for(let x=b.x0;x<=b.x1;x++){
      const X0=x*CS, X1=X0+CS;
      if(sx(X1)<-4||sx(X0)>W+4) continue;
      let y=b.y0;
      while(y<=b.y1){
        const i=y*NX+x, m=em(i);
        if(m<0.02){ y++; continue; }
        const j=y+1<NY?i+NX:-1, mj=j>=0?em(j):0;
        const sup=j>=0&&((BLK[j]&1)||mj>=0.9||(BLK[j]===2&&mj<0.02));
        const side=(x>0&&em(i-1)>0.5)||(x<NX-1&&em(i+1)>0.5);
        if(!sup&&m<0.9&&!side){                                 // falling water: a stream
          const wd=CS*Math.min(1,0.3+m*1.2);
          stream.rect(sx(X0+(CS-wd)/2),sy(y*CS),sw(wd),sw(CS)+1);
          if(EL[i]) live.push(x,y);
          y++; continue;
        }
        let yb=y;                                              // a run of standing water
        while(yb+1<NY){ const k=(yb+1)*NX+x, mk=em(k); if(mk<0.02) break; const kk=yb+2<NY?k+NX:-1; if(mk<0.9&&!(kk>=0&&((BLK[kk]&1)||em(kk)>=0.9))&&!(em(k-1)>0.5||em(k+1)>0.5)) break; yb++; }
        const free=y>0&&!(BLK[i-NX]&1)&&!(em(i-NX)>=0.02);
        let top=(y+1)*CS-Math.min(1,m)*CS;
        if(free) top-=Math.max(-(yb-y+1)*CS*0.6,Math.min(CS*0.8,F.WH[x]));
        let tl=top, tr=top;
        if(free){
          const L=runTop(x-1,y), R=runTop(x+1,y);
          if(L!=null) tl=(L+top)/2; else if(x>0&&em(i-1)>=0&&em(i-1)<0.02&&y+1<NY&&em(i-1+NX)>=0.02) tl=(y+1)*CS;
          if(R!=null) tr=(R+top)/2; else if(x<NX-1&&em(i+1)>=0&&em(i+1)<0.02&&y+1<NY&&em(i+1+NX)>=0.02) tr=(y+1)*CS;
          surf.push(X0,tl,X1,tr);
        }
        const bot=(yb+1)*CS;
        pool.moveTo(sx(X0),sy(tl)); pool.lineTo(sx(X1),sy(tr)); pool.lineTo(sx(X1),sy(bot)); pool.lineTo(sx(X0),sy(bot)); pool.closePath();
        if(top<tMin) tMin=top; if(bot>bMax) bMax=bot;
        for(let yy=y;yy<=yb;yy++) if(EL[yy*NX+x]) live.push(x,yy);
        y=yb+1;
      }
    }
    const elec=live.length>0;
    if(bMax>tMin){
      const g=ctx.createLinearGradient(0,sy(tMin),0,sy(Math.min(bMax,tMin+12*T)));
      g.addColorStop(0,elec?'rgba(150,220,255,0.55)':'rgba(70,150,230,0.46)'); g.addColorStop(1,elec?'rgba(60,110,220,0.74)':'rgba(18,46,124,0.74)');
      const ab=B.xBub;
      ctx.fillStyle=g;
      if(ab){                                               // the air pocket: a hole in the water
        const wob=b2=>sw(ab.r)*(1+0.05*Math.sin(fr*0.4+b2));
        ctx.save(); const cut=new Path2D(); cut.rect(-10,-10,W+20,H+20);
        cut.ellipse(sx(ab.x),sy(ab.y),wob(0),wob(1.6),0,0,Math.PI*2); ctx.clip(cut,'evenodd');
        ctx.fill(pool); ctx.restore();
        ctx.save(); ctx.clip(pool);
        ctx.strokeStyle='rgba(235,250,255,0.9)'; ctx.lineWidth=Math.max(2,sw(3));
        ctx.beginPath(); ctx.ellipse(sx(ab.x),sy(ab.y),wob(0),wob(1.6),0,0,Math.PI*2); ctx.stroke();
        ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.lineWidth=Math.max(2,sw(4));
        ctx.beginPath(); ctx.arc(sx(ab.x),sy(ab.y),sw(ab.r)*0.7,Math.PI*1.1,Math.PI*1.45); ctx.stroke();
        ctx.restore();
      }else ctx.fill(pool);
      // ripples running out through the water
      if(B.wRings.length){ ctx.save(); ctx.clip(pool);
        for(const g2 of B.wRings){ const a=(g2.life/60)*Math.min(1,0.35+0.4*g2.k);
          ctx.strokeStyle=g2.kind==='mag'?'rgba(255,170,200,'+(a*0.7)+')':'rgba(220,245,255,'+(a*0.75)+')';
          ctx.lineWidth=Math.max(2,sw(3)*(0.6+g2.life/60));
          ctx.beginPath(); ctx.arc(sx(g2.x),sy(g2.y),sw(g2.r),0,Math.PI*2); ctx.stroke(); }
        ctx.restore(); }
      // caustics: soft light drifting through the water
      ctx.save(); ctx.clip(pool); ctx.globalCompositeOperation='lighter';
      for(let k=0;k<14;k++){
        const x=(b.x0+((k*37+fr*0.15)%Math.max(1,b.x1-b.x0+1)))*CS, y=tMin+20+((k*53+fr*0.1)%Math.max(20,bMax-tMin-20));
        ctx.fillStyle='rgba(140,220,255,'+(0.05+0.035*Math.sin(fr*0.05+k))+')';
        ctx.beginPath(); ctx.ellipse(sx(x),sy(y),sw(26),sw(7),Math.sin(fr*0.01+k)*0.4,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
    // falling water
    ctx.fillStyle=elec?'rgba(170,225,255,0.7)':'rgba(120,190,255,0.62)'; ctx.fill(stream);
    ctx.save(); ctx.clip(stream); ctx.fillStyle='rgba(235,250,255,0.35)';
    for(let k=0;k<6;k++){ const yy=((fr*9+k*41)%H); ctx.fillRect(0,yy,W,2); }
    ctx.restore();
    // the surface: a bright line where the water meets the air
    if(surf.length){
      ctx.lineJoin='round'; ctx.lineCap='round';
      ctx.strokeStyle='rgba(225,247,255,0.82)'; ctx.lineWidth=Math.max(3,sw(4)); ctx.beginPath();
      for(let k=0;k<surf.length;k+=4){ ctx.moveTo(sx(surf[k]),sy(surf[k+1])); ctx.lineTo(sx(surf[k+2]),sy(surf[k+3])); }
      ctx.stroke();
      for(let k=0;k<surf.length;k+=4){ const sl=Math.abs(surf[k+3]-surf[k+1]); if(sl>3){ ctx.fillStyle='rgba(255,255,255,'+Math.min(0.7,sl*0.05)+')'; ctx.beginPath(); ctx.ellipse(sx((surf[k]+surf[k+2])/2),sy((surf[k+1]+surf[k+3])/2),sw(CS*0.9),sw(2.5),0,0,Math.PI*2); ctx.fill(); } }
    }
    // lightning through live water
    if(elec){
      ctx.strokeStyle='rgba(255,250,170,'+(0.5+0.5*Math.random())+')'; ctx.lineWidth=Math.max(1.5,sw(2));
      for(let k=0;k<5;k++){
        const q=(Math.random()*(live.length/2)|0)*2; let x=(live[q]+0.5)*CS, y=(live[q+1]+0.2)*CS;
        ctx.beginPath(); ctx.moveTo(sx(x),sy(y));
        for(let j=0;j<6;j++){ x+=(Math.random()-0.5)*44; y+=8+Math.random()*14; if(!waterAt(x,y)) break; ctx.lineTo(sx(x),sy(y)); }
        ctx.stroke();
      }
    }
    // drops in the air
    for(const d of B.drops){
      const r=Math.max(2,sw(Math.min(14,2.2+Math.sqrt(d.m)*6)));
      ctx.fillStyle='rgba(150,210,255,0.85)'; ctx.beginPath(); ctx.ellipse(sx(d.x),sy(d.y),r*0.85,r*(1+Math.min(0.6,Math.abs(d.vy)*0.04)),0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.fillRect(sx(d.x)-r*0.35,sy(d.y)-r*0.5,Math.max(1.5,r*0.3),Math.max(1.5,r*0.3));
    }
    // steam (the water that burned off)
    for(const s of B.steam){
      const a=Math.min(1,s.life/30)*Math.min(1,(s.max-s.life+10)/20)*0.38;
      ctx.fillStyle='rgba(235,240,245,'+a.toFixed(3)+')'; ctx.beginPath(); ctx.arc(sx(s.x),sy(s.y),Math.max(3,sw(s.r)),0,Math.PI*2); ctx.fill();
    }
    // bubbles: big enough to read at console resolution, with a glint
    for(const bb of B.bubbles){
      const x=sx(bb.x), y=sy(bb.y), r=Math.max(3,sw(bb.r));
      ctx.fillStyle='rgba(200,240,255,0.18)'; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(230,250,255,0.85)'; ctx.lineWidth=Math.max(1.5,sw(2)); ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fillRect(x-r*0.45,y-r*0.55,Math.max(2,r*0.35),Math.max(2,r*0.35));
    }
    // water on the magnet: the stream up to the tip and the blob it holds
    const Mg=B.magWater;
    if(Mg){
      for(const d of Mg.drops){ ctx.fillStyle='rgba(170,225,255,0.9)'; ctx.beginPath(); ctx.arc(sx(d.x),sy(d.y),Math.max(2.5,sw(3)),0,Math.PI*2); ctx.fill(); }
      if(Mg.area>0){
        const r=Math.sqrt(Mg.area/Math.PI), x=sx(Mg.x), y=sy(Mg.y), wob=Math.sin(fr*0.3)*0.12;
        ctx.save(); ctx.translate(x,y); ctx.scale(1+wob,1-wob);
        const g2=ctx.createRadialGradient(-r*0.3,-r*0.3,1,0,0,sw(r)+2); g2.addColorStop(0,'rgba(230,248,255,0.95)'); g2.addColorStop(0.5,'rgba(110,190,245,0.75)'); g2.addColorStop(1,'rgba(40,100,200,0.7)');
        ctx.fillStyle=g2; ctx.beginPath(); ctx.arc(0,0,Math.max(4,sw(r)),0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='rgba(235,250,255,0.9)'; ctx.lineWidth=Math.max(1.5,sw(2)); ctx.stroke();
        ctx.restore();
      }
    }
  }
  // the Isolator wraps MIND: a glossy orange rubber skin over the box and wheel
  const _origDrawChar=window.drawCharacter;
  window.drawCharacter=function(){
    const r=_origDrawChar.apply(this, arguments);
    if(on()&&B.hasIsolator){
      const cx=sx(p.x+SW/2), feet=sy(p.y+FEET_OFF), top=feet-sw(STAND_H+WHEEL_R)+sw((p.crouchAmt||0)*30)-4;
      const wet=B.mindWet||0, left=B.isoT||0;
      const blink=left<300&&((fr>>(left<120?2:3))&1);           // running out: it flickers
      const a=(0.28+0.25*wet+0.06*Math.sin(fr*0.12))*(blink?0.25:1);
      ctx.save();
      // time left: a ring that empties over MIND's head
      const k=Math.max(0,left/ISO_TIME), rx=cx+sw(30), ry=top-sw(6), rr=Math.max(5,sw(9));
      ctx.lineWidth=Math.max(2,sw(3)); ctx.strokeStyle='rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(rx,ry,rr,0,Math.PI*2); ctx.stroke();
      ctx.strokeStyle=left<300?'#ff5a3a':'#ffa040'; ctx.beginPath(); ctx.arc(rx,ry,rr,-Math.PI/2,-Math.PI/2+Math.PI*2*k); ctx.stroke();
      ctx.fillStyle='rgba(255,150,60,'+(a*0.45)+')'; ctx.strokeStyle='rgba(255,180,100,'+(a+0.2)+')'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.roundRect(cx-sw(32),top,sw(64),feet-top+2,sw(18)); ctx.fill(); ctx.stroke();
      ctx.strokeStyle='rgba(255,240,210,'+(0.35+0.3*wet)+')'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(cx-sw(12),top+sw(20),sw(10),Math.PI*1.1,Math.PI*1.55); ctx.stroke();
      ctx.restore();
    }
    if(on()) for(const e of ENEMS){ if(!e._shorting||!e.alive) continue;   // enemies shorting out: the same crackle
      const cx=sx(e.x+e.w/2), cy=sy(e.y+e.h*0.4), hw=sw(Math.max(e.w,30))*0.5;
      ctx.strokeStyle='rgba(255,250,150,0.9)'; ctx.lineWidth=2;
      for(let k=0;k<2;k++){ let x=cx+(Math.random()-0.5)*hw*2, y=cy-hw*0.6; ctx.beginPath(); ctx.moveTo(x,y); for(let j=0;j<4;j++){ x+=(Math.random()-0.5)*hw*0.7; y+=hw*0.4; ctx.lineTo(x,y); } ctx.stroke(); } }
    if(on()&&B.shortT>0){                                 // shorting out: crackle over the speaker
      const cx=sx(p.x+SW/2), cy=sy(p.y+FEET_OFF-55);
      ctx.strokeStyle='rgba(255,250,150,0.9)'; ctx.lineWidth=2;
      for(let k=0;k<2;k++){ let x=cx+(Math.random()-0.5)*30, y=cy-25; ctx.beginPath(); ctx.moveTo(x,y); for(let j=0;j<4;j++){ x+=(Math.random()-0.5)*18; y+=12; ctx.lineTo(x,y); } ctx.stroke(); }
    }
    return r;
  };
})();
