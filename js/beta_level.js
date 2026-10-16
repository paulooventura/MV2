// ============================================================
//  beta_level.js — G · Awdjoo Town Level 1 "The Journey Begins" (BETA)
//
//  Built from Paulo's pen sketch + his play notes. Level data:
//  assets/levels/awdjoo-beta.ldtk (regenerate with scripts/build-awdjoo-beta.py).
//  Pages: beta-lab.html?ab=g and play-beta.html. Live Awdjoo (A) is untouched.
//
//  Rules:
//    - The arch opens with 3 Knowl crystals + 6 Knowl seeds.
//    - Cubes live in grid cells and fall when nothing holds them up.
//      Omni: punch / laser wear it down; XLR pushes, MAG pulls or carries.
//      Push cube: XLR only. Pull cube: MAG only. Laser cage: TRS only.
//      Wedged trapdoor blocks hold still until their item moves them.
//    - Items wait in labelled crates; a crate holds up whatever sits on it.
//    - Items never act through a wall: MIND needs a clear line to the target.
//  Movement feel, XLR launch/hover and hook tweaks: js/beta_feel.js.
//  Drawing (sky, homes, tree, crates, choir): js/beta_decor.js.
// ============================================================
(function(){
  'use strict';
  const PATH='assets/levels/awdjoo-beta.ldtk';
  const T=32;                                   // world tile
  const ITEM_IDX={TRS:0, RCA:1, XLR:2, MAG:3};
  const B={on:false, level:null, gate:null, need:{crystals:3, seeds:6},
    open:false, cleared:false, laitu:null, talked:0, rooms:[], labels:[], decor:[], skin:null, sky:0};
  window.MV_BETA=B;

  function want(){
    if(window.MV_BETA_LAB) return true;
    try{
      if(/[?&]beta=1/i.test(location.search)) return true;
      if((document.documentElement.getAttribute('data-ab')||'').toLowerCase()==='g') return true;
    }catch(e){}
    return false;
  }
  const F=(e,name)=>{ const f=(e.fieldInstances||[]).find(x=>x.__identifier===name); return f?f.__value:undefined; };
  const cell=e=>({c:e.__grid?e.__grid[0]:Math.round(e.px[0]/16), r:e.__grid?e.__grid[1]:Math.round(e.px[1]/16),
    w:Math.round((e.width||16)/16), h:Math.round((e.height||16)/16)});

  async function startBetaLab(){
    if(typeof _unlockAudio==='function') _unlockAudio();
    _gameState='game';
    if(typeof _stopAllBgm==='function') _stopAllBgm();
    else if(typeof _stopBGM==='function'){ _stopBGM('title'); _stopBGM('story'); _stopBGM('game'); }
    const res=await fetch(PATH);
    if(!res.ok) throw new Error('beta level fetch failed '+res.status);
    const raw=await res.json();
    const level=await parseLdtkProject(raw, PATH);   // Collision grid + seeds (Knowl) via lab F
    applyLdtkLevel(level);
    applyBeta(raw, level);
    if(typeof _playBGM==='function'&&typeof OPT!=='undefined') _playBGM('game', OPT.musicVol);
  }

  function applyBeta(raw, level){
    B.on=true; B.level=level; B.open=false; B.cleared=false; B.talked=0;
    B.rooms=[]; B.labels=[]; B.rings=[]; B.shells=[]; B.decor=[]; B.crateCells=new Set(); B.flying=[];
    B.bounceT=0; B.bounced=0; B.chX=0; B.chM=0;
    B.mag={held:[], lockedThisHold:false, power:100, wasOn:false, tips:[]};
    const lv=raw.levels[0];
    B.sky=(F(lv,'skyRows')|0)||0;
    const layer=id=>(lv.layerInstances||[]).find(l=>l.__identifier===id);
    const sk=layer('Skin');
    B.skin=null;
    if(sk){ const W2=sk.__cWid, csv=sk.intGridCsv; B.skin=[]; for(let r=0;r<sk.__cHei;r++) B.skin.push(csv.slice(r*W2,(r+1)*W2)); }
    const ents=((layer('Entities')||{}).entityInstances)||[];

    // Nothing pre-granted: the sketch places every item in the level.
    _unlockedMask=0; ITEM=-1; _itemTutorial=null;
    if(typeof _itemEnhanced!=='undefined') _itemEnhanced=[false,false,false,false];
    if(typeof ITEM_DROPS!=='undefined') ITEM_DROPS.length=0;
    _mapRopePickup=null;
    // Seeds sit on the floor (the generator drops them to the cell above the ground)
    for(const k of KDROP){
      k.kind='seed';
      const c=Math.floor(k.x/T), r=Math.floor(k.y/T);
      const floorY=(typeof gridStandY==='function')?gridStandY(k.x,(r+1)*T,{maxUp:4,maxDrop:T*2}):null;
      if(floorY!=null){ k.y=k.oy=floorY-15; k.ox=k.x; }
      k.floorY=floorY!=null?floorY:(r+1)*T; k.c=c;
    }

    for(const e of ents){
      const id=e.__identifier, g=cell(e);
      const x=g.c*T, y=g.r*T, cx=x+g.w*T/2, feet=(g.r+g.h)*T;
      switch(id){
        case 'MindSpawn':
          _spawnX=cx-SW/2; _spawnY=feet-FEET_OFF; break;
        case 'Gate':
          B.gate={x, y, w:g.w*T, h:g.h*T};
          B.need={crystals:F(e,'crystals')|0||3, seeds:F(e,'seeds')|0||6}; break;
        case 'Crystal':
          KDROP.push({x:cx, y:y+T/2, ox:cx, oy:y+T/2, px:0, py:0, vx:0, vy:0, got:false,
            bob:Math.random()*Math.PI*2, kind:'crystal'}); break;
        case 'Rca':
          _mapRopePickup={x, y, w:T, h:T, got:false};
          B.crateCells.add(g.c+','+g.r); break;
        case 'Item': {
          const idx=ITEM_IDX[F(e,'item')];
          if(idx!=null&&typeof _spawnItemDrop==='function'){
            _spawnItemDrop(idx, cx, y);
            const d=ITEM_DROPS[ITEM_DROPS.length-1]; if(d){ d._cell=g.c+','+g.r; d.bob=0; }
          }
          B.crateCells.add(g.c+','+g.r);
          break;
        }
        case 'KnowlTree':
          _knowlTreeZone={x:cx, y:feet-72, r:120, feetY:feet}; break;
        case 'Box': {
          const kind=F(e,'kind')||'omni';
          if(kind==='laser'){                  // TRS-only cage block: fixed in place, only the laser breaks it
            const bw=_mkBwall(x, y, T, T, {tileGid:typeof BWALL_RED_GID!=='undefined'?BWALL_RED_GID:242, movable:false,
              hp:RED_BWALL_HP, maxHp:RED_BWALL_HP, label:'LASER', homeX:x, homeY:y, homeCol:g.c, homeRow:g.r, col:'#e0b020'});
            bw.only='laser'; BWALLS.push(bw); break;
          }
          const hard=kind!=='omni';
          // Cube: lives in one grid cell, never a rigid body (no physics cost while idle).
          const bw=_mkBwall(x, y, T, T, {
            tileGid:typeof BWALL_RED_GID!=='undefined'?BWALL_RED_GID:242, movable:false,
            hp:hard?1e6:RED_BWALL_HP, maxHp:hard?1e6:RED_BWALL_HP,
            label:kind==='omni'?'BLOCK':kind.toUpperCase(), homeX:x, homeY:y, homeCol:g.c, homeRow:g.r,
            col:kind==='push'?'#3070d0':kind==='pull'?'#d0362c':'#7a3cc8'});
          if(hard) bw.only=kind;
          bw.cube=true; bw.noKnock=true; bw._ox=0; bw._oy=0; bw.wedge=!!F(e,'wedge');
          BWALLS.push(bw);
          break;
        }
        case 'Enemy': {
          const type=F(e,'kind')==='B'?'square':'circle';
          if(typeof _mkMinion==='function'){
            const m=_mkMinion(cx, feet, type, {mn:Math.floor(cx-110), mx:Math.floor(cx+110)});
            m._awdjooKeep=true; m._betaEnemy=F(e,'kind');      // _purgeMinions keeps map-placed enemies
            ENEMS.push(m);
          }
          break;
        }
        case 'Laitu':
          // NPC: wanders the plateau (in and out of his house), stops to face MIND when he's near
          B.laitu={x:cx, feet, met:false, dir:1, pause:60, stepT:0, moving:false, talkT:0, line:0,
            mn:47*T+20, mx:73*T+12};
          break;
        case 'Room':
          B.rooms.push({x, y, w:g.w*T, h:g.h*T, style:F(e,'style'), loft:F(e,'loft')}); break;
        case 'Label':
          B.labels.push({x, y, text:F(e,'text')||''}); break;
        case 'HookRing':
          B.rings.push({x, y}); break;
        case 'GateShell':
          B.shells.push({x:cx, y:y+T/2, slot:F(e,'slot')}); break;
        case 'Decor':
          B.decor.push({kind:F(e,'kind'), c:g.c, r:g.r, x, y, dx:F(e,'dx')|0, dy:F(e,'dy')|0, len:F(e,'len')|0}); break;
      }
    }
    kTotal=KDROP.length; kColl=0; goalOpen=false;
    if(typeof gridStampLiveBwalls==='function') gridStampLiveBwalls();
    cubeSettleNow();
    // The referee and main.js read the exit from GOALPL; goalOpen stays false so
    // main.js never zone-hops — the arch is handled here.
    if(B.gate) GOALPL={x:B.gate.x, y:B.gate.y, w:B.gate.w, h:B.gate.h};

    p=mkP(); p.x=_spawnX; p.y=_spawnY; p.vx=0; p.vy=0; p.og=true; p.hp=p.maxHp; p.fc=false;
    p2=null; _unlockedMask=0; ITEM=-1;
    if(typeof _snapCameraToPlayer==='function') _snapCameraToPlayer(p);
    if(typeof ZONES!=='undefined'){
      let zi=ZONES.findIndex(z=>z.name==='AWDJOO L1 BETA');
      if(zi<0){ ZONES.push({name:'AWDJOO L1 BETA', sub:'The Journey Begins'}); zi=ZONES.length-1; }
      _zoneIdx=zi; _zoneCardT=180;
    }
    if(typeof uiShowToast==='function') uiShowToast('THE JOURNEY BEGINS — 3 CRYSTALS + 6 SEEDS OPEN THE ARCH');
    console.info('MV: Awdjoo L1 beta', level.cols+'x'+level.rows, 'knowls', kTotal, 'boxes', BWALLS.length, 'enemies', ENEMS.length);
  }

  function counts(){
    let crystals=0, seeds=0;
    for(const k of KDROP){ if(!k.got) continue; if(k.kind==='crystal') crystals++; else seeds++; }
    return {crystals, seeds};
  }

  // ── Line of sight (Paulo: nothing acts through a wall) ───────────
  // Clear when the grid ray from MIND's shoulder reaches the target before any
  // solid cell. `own` = the target's own cell (a cube is itself solid).
  function shoulder(){ return {x:p.x+SW/2, y:p.y+FEET_OFF-STAND_H*0.45}; }
  function losClear(tx,ty,ownC,ownR){
    if(typeof gridRayHit!=='function'||!p) return true;
    const o=shoulder();
    const hit=gridRayHit(o.x,o.y,tx,ty);
    if(!hit) return true;
    const hc=Math.floor((hit.tx-(hit.nx||0)*0.5)/T), hr=Math.floor((hit.ty-(hit.ny||0)*0.5)/T);
    if(ownC!=null&&hc===ownC&&hr===ownR) return true;
    return Math.hypot(hit.tx-o.x,hit.ty-o.y)>=Math.hypot(tx-o.x,ty-o.y)-2;
  }
  B.losClear=losClear;

  // ── Cubes ───────────────────────────────────────────────────────
  //   - An unsupported cube always falls, one cell at a time, speeding up.
  //   - XLR push / MAG pull act on release along the aim (up/down/left/right):
  //     1-3 cells, more when MIND is close and the item was held longer.
  //   - Visual slide is a short ease; the grid cell flips at once.
  const CUBE={RANGE:260, CHARGE_FULL:60, SLIDE_FR:7, NEAR:96};
  const cubes=()=>BWALLS.filter(b=>b.cube&&b.hp>0&&!b._carried&&!b._fly);
  function playerIn(c,r){
    if(!p) return false;
    const b=gridPlayerBody(p), x0=c*T, y0=r*T;
    return b.x+6<x0+T&&b.x+b.w-6>x0&&b.y<y0+T-1&&b.feetY>y0+1;   // a few px of grace at the wheel's edge
  }
  function crateAt(c,r){
    if(!B.crateCells.has(c+','+r)) return false;
    for(const d of ITEM_DROPS) if(d._cell===c+','+r&&!d.got) return true;
    if(_mapRopePickup&&!_mapRopePickup.got&&Math.floor(_mapRopePickup.x/T)===c&&Math.floor(_mapRopePickup.y/T)===r) return true;
    B.crateCells.delete(c+','+r); return false;
  }
  function cellFree(c,r,ignorePlayer){
    if(c<0||r<0||c>=MV_GRID.cols||r>=MV_GRID.rows) return false;
    if(gridSolid(c,r)||gridIsSlope(c,r)||gridCell(c,r)===MV_GRID_ONEWAY) return false;
    if(crateAt(c,r)) return false;
    return ignorePlayer||!playerIn(c,r);
  }
  B.cellFree=cellFree;
  function moveCube(bw,dc,dr,frames){
    gridSmashCell(bw.homeCol,bw.homeRow);
    bw.homeCol+=dc; bw.homeRow+=dr;
    bw.x=bw.homeX=bw.homeCol*T; bw.y=bw.homeY=bw.homeRow*T;
    gridSet(bw.homeCol,bw.homeRow,MV_GRID_DESTRUCT);
    bw._ox-=dc*T; bw._oy-=dr*T; bw._spd=T/Math.max(1,frames);
  }
  function placeCube(bw,c,r,fromX,fromY){
    bw.homeCol=c; bw.homeRow=r; bw.x=bw.homeX=c*T; bw.y=bw.homeY=r*T;
    gridSet(c,r,MV_GRID_DESTRUCT);
    bw._ox=fromX-bw.x; bw._oy=fromY-bw.y; bw._spd=6; bw._fallN=0;
  }
  const busy=bw=>Math.abs(bw._ox)>0.01||Math.abs(bw._oy)>0.01;
  const holdsStill=bw=>bw.only==='laser'||bw.wedge;
  function cubeSettleNow(){                   // level load: drop everything to rest, no animation
    let moved=true, guard=0;
    while(moved&&guard++<200){
      moved=false;
      for(const bw of cubes().sort((a,b)=>b.homeRow-a.homeRow)){
        if(holdsStill(bw)) continue;
        if(cellFree(bw.homeCol,bw.homeRow+1,true)){ moveCube(bw,0,1,1); bw._ox=0; bw._oy=0; moved=true; }
      }
    }
  }
  function nearestFreeCell(px,py){
    let best=null, bd=1e9;
    const c0=Math.floor(px/T), r0=Math.floor(py/T);
    for(let dr=-2;dr<=2;dr++) for(let dc=-2;dc<=2;dc++){
      const c=c0+dc, r=r0+dr;
      if(!cellFree(c,r)) continue;
      const d=Math.hypot((c+0.5)*T-px,(r+0.5)*T-py);
      if(d<bd){ bd=d; best={c,r}; }
    }
    return best;
  }
  function cubeTick(){
    // a shattered cube gives up its cell for good (the game would keep re-opening it)
    for(const bw of BWALLS) if(bw.cube&&bw.hp<=0&&bw.homeCol!=null){
      gridSmashCell(bw.homeCol,bw.homeRow); bw.homeCol=bw.homeRow=bw.homeX=bw.homeY=null;
    }
    const list=cubes().sort((a,b)=>b.homeRow-a.homeRow);   // bottom first: stacks fall together
    for(const bw of list){
      if(bw.hitGlow>0) bw.hitGlow--;
      if(busy(bw)){                           // ease the picture toward the cell
        const s=bw._spd||8;
        bw._ox=Math.abs(bw._ox)<=s?0:bw._ox-Math.sign(bw._ox)*s;
        bw._oy=Math.abs(bw._oy)<=s?0:bw._oy-Math.sign(bw._oy)*s;
        continue;
      }
      if(!holdsStill(bw)&&cellFree(bw.homeCol,bw.homeRow+1)){
        bw._fallN=(bw._fallN||0)+1;
        if(bw._slide&&bw._slide.dr<0) bw._slide=null;
        moveCube(bw,0,1,Math.max(2,7-bw._fallN));
        if(!cellFree(bw.homeCol,bw.homeRow+1,true)){ try{ sfx('omniblock_chip'); }catch(e){} bw.shakeY=2; }
        continue;
      }
      bw._fallN=0;
      if(bw._slide&&bw._slide.left>0){
        const {dc,dr}=bw._slide;
        if(cellFree(bw.homeCol+dc,bw.homeRow+dr)){ moveCube(bw,dc,dr,CUBE.SLIDE_FR); bw._slide.left--; }
        else bw._slide=null;
      }
    }
    flyTick();
    magnetTick();
    // XLR / MAG act when the button is let go
    const xlrNow=!!(p&&p.xlrOn&&ITEM===2), magNow=!!(p&&p.magOn&&ITEM===3);
    if(xlrNow) B.chX++; else if(B.chX>0){ fireCube('push',B.chX); if(B.onXlrRelease) B.onXlrRelease(B.chX); B.chX=0; }
    if(magNow) B.chM++; else if(B.chM>0){ if(!B.mag.lockedThisHold) fireCube('pull',B.chM); B.chM=0; B.mag.lockedThisHold=false; }
  }
  // Dominant aim axis → one of the four cell directions.
  function aimAxis(){
    const ax=p.aimDX||0, ay=p.aimDY||0;
    if(Math.abs(ay)>Math.abs(ax)*1.1) return {dc:0, dr:ay>0?1:-1};
    return {dc:ax>=0?1:-1, dr:0};
  }
  function fireCube(mode, held){
    if(typeof _tipField!=='function') return;
    // measure from MIND's shoulder, not the jack tip, so a cube right against him still counts
    const tip=shoulder(), a=Math.atan2(p.aimDY,p.aimDX);
    let best=null, bd=1e9;
    for(const bw of cubes()){
      if(bw.only==='laser') continue;
      if(mode==='push'&&bw.only==='pull') continue;
      if(mode==='pull'&&bw.only==='push') continue;
      const cx=bw.x+T/2, cy=bw.y+T/2;
      const f=_tipField(tip,a,cx,cy,CUBE.RANGE);
      if(!f||f.dist>=bd) continue;
      if(!losClear(cx,cy,bw.homeCol,bw.homeRow)) continue;     // a wall (or another cube) is in the way
      bd=f.dist; best=bw;
    }
    if(!best) return;
    const charge=Math.min(1,held/CUBE.CHARGE_FULL);
    const near=bd<=CUBE.NEAR?1:Math.max(0,1-(bd-CUBE.NEAR)/(CUBE.RANGE-CUBE.NEAR));
    const cells=Math.max(1,Math.min(3,Math.round(1+2*charge*near)));
    const ax=aimAxis();
    const sgn=mode==='push'?1:-1;
    best._slide={dc:ax.dc*sgn, dr:ax.dr*sgn, left:cells};
    best.wedge=false;                                   // once moved it is just a cube
    best.hitGlow=16;
    B.lastFire={mode, cells, charge:+charge.toFixed(2), dist:Math.round(bd), dc:ax.dc*sgn, dr:ax.dr*sgn};
  }

  // ── Thrown cubes: real flight until they come to rest, then they snap into a cell
  function solidPx(x,y){
    const c=Math.floor(x/T), r=Math.floor(y/T);
    if(c<0||r<0||c>=MV_GRID.cols||r>=MV_GRID.rows) return true;
    return gridSolid(c,r)||gridIsSlope(c,r)||crateAt(c,r);
  }
  function boxHits(x,y){
    const m=2;
    return solidPx(x+m,y+m)||solidPx(x+T-m,y+m)||solidPx(x+m,y+T-m)||solidPx(x+T-m,y+T-m)||solidPx(x+T/2,y+T-m)||solidPx(x+T/2,y+m);
  }
  function throwCube(bw,vx,vy){
    bw._fly=true; bw._carried=false; bw.vx=vx; bw.vy=vy; bw._rest=0; bw.spin=vx*0.02; bw.rot=0;
    bw.homeCol=bw.homeRow=bw.homeX=bw.homeY=null;
    B.flying.push(bw);
  }
  function flyTick(){
    for(let i=B.flying.length-1;i>=0;i--){
      const bw=B.flying[i];
      if(bw.hp<=0){ B.flying.splice(i,1); continue; }
      bw.vy=Math.min(bw.vy+0.5,15); bw.vx*=0.995;
      const steps=Math.max(1,Math.ceil(Math.max(Math.abs(bw.vx),Math.abs(bw.vy))/6));
      let ground=false;
      for(let s=0;s<steps;s++){
        const nx=bw.x+bw.vx/steps;
        if(boxHits(nx,bw.y)){ bw.vx=Math.abs(bw.vx)>2?-bw.vx*0.3:0; bw.spin=-(bw.spin||0)*0.5; try{ if(Math.abs(bw.vx)>1.2) sfx('omniblock_chip'); }catch(e){} }
        else bw.x=nx;
        const ny=bw.y+bw.vy/steps;
        if(boxHits(bw.x,ny)){
          if(bw.vy>0) ground=true;
          bw.vy=(bw.vy>3)?-bw.vy*0.25:0; bw.vx*=0.78;
        }else bw.y=ny;
      }
      bw.rot=(bw.rot||0)+(bw.spin||0); bw.spin=(bw.spin||0)*(ground?0.6:0.98);
      // thrown cubes bump enemies
      const sp=Math.hypot(bw.vx,bw.vy);
      if(sp>4) for(const e of ENEMS){
        if(!e.alive||e._betaHeld||!(typeof _enemyBodyPresent!=='function'||_enemyBodyPresent(e))) continue;
        if(ov(bw.x,bw.y,T,T,e.x,e.y,e.w,e.h)&&(e._cubeHitF||0)<=0){
          if(typeof _damageEnemy==='function') _damageEnemy(e,Math.round(8+sp*1.5),bw.x+T/2,bw.y+T/2,1);
          e._cubeHitF=20; bw.vx*=-0.4; bw.vy=-2;
        }
      }
      if(ground&&Math.abs(bw.vx)<0.35&&Math.abs(bw.vy)<0.6) bw._rest++; else bw._rest=0;
      if(bw._rest>4){
        const spot=nearestFreeCell(bw.x+T/2,bw.y+T/2);
        B.flying.splice(i,1); bw._fly=false; bw.rot=0; bw.spin=0;
        if(!spot){ bw.hp=0; continue; }
        placeCube(bw,spot.c,spot.r,bw.x,bw.y);
      }
    }
    for(const e of ENEMS) if(e._cubeHitF>0) e._cubeHitF--;
  }

  const LAITU_SCALE=1.75;                       // a bit taller than MIND
  const LAITU_TALK=['THEY TOOK THE ELDERS. FOLLOW THE SEEDS!','THE ARCH WANTS 3 CRYSTALS AND 6 SEEDS.',
    'YOUR HOME HIDES THE KNOWL TREE, MIND.','A MAGNET CAN CARRY WHAT A PUNCH CANNOT.',
    'AIM THE XLR AT THE FLOOR AND LET IT RIP!'];

  // ── Magnet carry (Paulo): hold the MAG to lock omni cubes, an enemy or a
  //   movable object to the jack and carry it. Full power holds up to 3 cubes,
  //   or 1 enemy / object. As power drains the grip loosens one cube at a time
  //   (3 above 2/3 power, 2 above 1/3); the last thing held lets go only at 0%.
  //   Held things sit flush on the magnet's poles; letting go throws them with
  //   the swing of the arm.
  const MAG={LOCK:84, DRAIN:0.35, GAME_DRAIN:1.2, ENH_DRAIN:0.78, THROW:1.25, MAXV:20};
  const magCap=pw=>pw>200/3?3:pw>100/3?2:pw>0?1:0;
  function magTip(){
    // The MAG art is drawn at the arm's tip, rotated to the aim; its pole faces end
    // 30 art px out (prong 24 + pole pad 6), scaled by the item art scale.
    const pose=typeof computeConnectorArmPose==='function'?computeConnectorArmPose(p):null;
    const a=pose?pose.aimAngle:Math.atan2(p.aimDY,p.aimDX);
    const o=shoulder();
    const base=(pose&&isFinite(pose.tipX))?{x:pose.tipX,y:pose.tipY}:{x:o.x+Math.cos(a)*36,y:o.y+Math.sin(a)*36};
    const pole=30*(typeof _itemArtScale==='function'?_itemArtScale(3):0.88);
    return {x:base.x+Math.cos(a)*pole, y:base.y+Math.sin(a)*pole, ux:Math.cos(a), uy:Math.sin(a)};
  }
  function throwVel(){
    const h=B.mag.tips; if(h.length<2) return {vx:p.vx||0, vy:(p.vy||0)};
    const a=h[0], b=h[h.length-1], n=Math.max(1,h.length-1);
    let vx=(b.x-a.x)/n*MAG.THROW, vy=(b.y-a.y)/n*MAG.THROW;
    const s=Math.hypot(vx,vy); if(s>MAG.MAXV){ vx*=MAG.MAXV/s; vy*=MAG.MAXV/s; }
    return {vx, vy};
  }
  function dropHeld(h){
    const v=throwVel();
    if(h.kind==='cube') throwCube(h.ref, v.vx, v.vy);
    else if(h.kind==='enemy'){
      const e=h.ref; e._betaHeld=false; e.og=false; e.vx=v.vx; e.vy=v.vy;
      if(typeof _markEnemyItemForce==='function') _markEnemyItemForce(e,40);
      e._thrownF=60;
    }else { h.ref._betaHeld=false; h.ref.vx=v.vx; h.ref.vy=v.vy; }
  }
  function magnetTick(){
    const M=B.mag;
    const on=!!(p&&p.magOn&&ITEM===3);
    if(on){
      // the magnet keeps its own power while held (the game's 1.2/frame drain empties it in
      // about a second); carrying drains slower so you can actually walk somewhere.
      if(!M.wasOn){ M.power=Math.min(100,p.itemStamina+(typeof _itemEnhanced!=='undefined'&&_itemEnhanced[3]?MAG.ENH_DRAIN:MAG.GAME_DRAIN)); M.tips.length=0; }
      M.power=Math.max(0,M.power-MAG.DRAIN*(M.held.length?1:0.6));
      p.itemStamina=M.power;
    }
    M.wasOn=on;
    if(!on||p.itemStamina<=0){ while(M.held.length) dropHeld(M.held.pop()); return; }
    const tip=magTip();
    M.tips.push({x:tip.x,y:tip.y}); if(M.tips.length>6) M.tips.shift();
    // grip loosens as power falls: drop the outermost cube first
    const cubesHeld=M.held.filter(h=>h.kind==='cube');
    if(cubesHeld.length>magCap(p.itemStamina)){ const h=M.held.pop(); dropHeld(h); try{ sfx('omniblock_chip'); }catch(e){} }
    // lock new things that come within reach of the poles (never through a wall)
    const hasOther=M.held.some(h=>h.kind!=='cube');
    if(!hasOther&&M.held.length<magCap(p.itemStamina)){
      let best=null, bd=MAG.LOCK;
      const reach=M.held.length?M.held.length*(T+1):0;   // the next cube locks onto the outer face
      const consider=(kind,ref,cx,cy,c,r)=>{
        const dx=cx-tip.x, dy=cy-tip.y, d=Math.hypot(dx,dy)-reach;
        if(d>=bd) return;
        if(Math.hypot(dx,dy)>18&&(dx*tip.ux+dy*tip.uy)/Math.hypot(dx,dy)<0.2) return;      // in front of the poles
        if(!losClear(cx,cy,c,r)) return;
        bd=d; best={kind,ref};
      };
      for(const bw of cubes()) if(!bw.only) consider('cube',bw,bw.x+T/2,bw.y+T/2,bw.homeCol,bw.homeRow);
      if(!M.held.length){
        for(const e of ENEMS){ if(!e.alive||e.mind||(typeof _enemyBodyPresent==='function'&&!_enemyBodyPresent(e))) continue; consider('enemy',e,e.x+e.w/2,e.y+e.h/2); }
        for(const c of CRATES) consider('object',c,c.x+c.w/2,c.y+c.h/2);
      }
      if(best){
        if(best.kind==='cube'){
          const r=best.ref; gridSmashCell(r.homeCol,r.homeRow);
          r.homeCol=r.homeRow=r.homeX=r.homeY=null;          // no home while carried (the game would keep re-opening it)
          r._carried=true; r._slide=null; r._ox=r._oy=0; r.wedge=false;
        }
        else best.ref._betaHeld=true;
        M.held.push(best); M.lockedThisHold=true; p.flashF=Math.max(p.flashF||0,6);
        try{ sfx('hook_latch'); }catch(e){}
      }
    }
    // carry: the first thing sits flush on the poles, cubes stack outward along the aim
    let along=0;
    for(const h of M.held){
      const r=h.ref, w=r.w||T, hh=r.h||T;
      const half=Math.abs(tip.ux)*w/2+Math.abs(tip.uy)*hh/2;    // face-to-pole distance for this box
      const cx=tip.x+tip.ux*(along+half), cy=tip.y+tip.uy*(along+half);
      r.x=cx-w/2; r.y=cy-hh/2; r.vx=0; r.vy=0;
      if(h.kind==='enemy'){ r.shotCd=Math.max(r.shotCd||0,30); r.hitF=Math.max(r.hitF||0,2); }
      along+=half*2;
    }
  }
  B.magTip=magTip;

  const _origUpdateMAG=window.updateMAG;
  window.updateMAG=function(){ if(B.on) return; return _origUpdateMAG.apply(this, arguments); };
  const _origHit=window.applyPlayerHitFromEnemy;
  if(_origHit) window.applyPlayerHitFromEnemy=function(e){ if(B.on&&e&&(e._betaHeld||e._thrownF>0)) return; return _origHit.apply(this, arguments); };
  // The game's XLR field shoves enemies too — not through walls in the beta.
  const _origItemForce=window._applyItemForceToEnemy;
  if(_origItemForce) window._applyItemForceToEnemy=function(e,fx,fy){
    if(B.on&&p&&e){ const hb=typeof _enemyItemHB==='function'?_enemyItemHB(e):e; if(!losClear(hb.x+hb.w/2,hb.y+hb.h/2)) return; }
    return _origItemForce.apply(this, arguments);
  };

  // ── Seeds: picked up by the whole body (they sit on the floor, below MIND's core)
  function seedPickups(){
    if(!p) return;
    const core=playerCoreHB(p), feet=p.y+FEET_OFF;
    for(const k of KDROP){
      if(k.got||k.kind!=='seed') continue;
      if(!ov(core.x-6,core.y,core.w+12,feet-core.y,k.x-11,k.y-11,22,22)) continue;
      k.got=true; kColl++;
      if(typeof healPlayerFromKnowl==='function') healPlayerFromKnowl();
      try{ sfx('knowl_pickup'); }catch(e){}
      for(let pi=0;pi<12;pi++){
        const ang=Math.random()*Math.PI*2, sp=1.2+Math.random()*3;
        PFXS.push({x:k.x,y:k.y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-1.8,life:18+Math.random()*10|0,maxLife:28,r:2+Math.random()*3,col:'#66ffaa'});
      }
    }
  }

  // ── Item crates sit on the floor too: MIND's wheel touching one is enough.
  function cratePickups(){
    if(!p||_shutdownTimer>0) return;
    const core=playerCoreHB(p), feet=p.y+FEET_OFF;
    const bx=core.x-4, by=core.y, bw=core.w+8, bh=feet+6-core.y;
    for(const d of ITEM_DROPS){
      if(d.got||!ov(bx,by,bw,bh,d.x,d.y,d.w,d.h)) continue;
      if(_itemUnlocked(d.item)&&!d.enhanced) continue;
      if(_collectItemDrop(d)){
        d.got=true;
        for(let pi=0;pi<14;pi++){ const ang=Math.random()*Math.PI*2, sp=1.6+Math.random()*3;
          PFXS.push({x:d.x+d.w*0.5,y:d.y+d.h*0.5,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-1.6,life:14+Math.random()*10|0,maxLife:24,r:2+Math.random()*2,col:'#e8b070'}); }
      }
    }
    const r=_mapRopePickup;
    if(r&&!r.got&&!_ropePickupAnim&&!_itemUnlocked(1)&&ov(bx,by,bw,bh,r.x,r.y,r.w,r.h)){
      r.got=true; _ropePickupAnim={t:0,sx:r.x+r.w*0.5,sy:r.y+r.h*0.5}; _grantPlayerItem(1);
      for(let pi=0;pi<14;pi++){ const ang=Math.random()*Math.PI*2, sp=2+Math.random()*4;
        PFXS.push({x:r.x+r.w*0.5,y:r.y+r.h*0.5,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-2,life:20+Math.random()*12|0,maxLife:32,r:2.5+Math.random()*3,col:'#ff8866'}); }
    }
  }

  // ── Per-frame rules (rides on updateKnowls, which runs every update) ──
  const _origUpdateKnowls=window.updateKnowls;
  window.updateKnowls=function(){
    if(B.on&&_gameState==='game'){ seedPickups(); cratePickups(); }
    _origUpdateKnowls.apply(this, arguments);
    if(!B.on||_gameState!=='game') return;
    cubeTick();
    if(B.feelTick) B.feelTick();
    for(const e of ENEMS) if(e._thrownF>0) e._thrownF--;
    goalOpen=false;                                   // main.js must not zone-hop
    const n=counts();
    if(!B.open&&n.crystals>=B.need.crystals&&n.seeds>=B.need.seeds){
      B.open=true;
      try{ sfx('unlock'); }catch(e){}
      if(typeof uiShowToast==='function') uiShowToast('THE ARCH IS OPEN');
    }
    if(!B.open&&B.gate&&p){
      const h=playerCoreHB(p), g=B.gate;
      if(ov(h.x,h.y,h.w,h.h,g.x+8,g.y,g.w-16,g.h)){
        // closed arch shoves MIND back the way he came
        const dir=(p.x+SW/2)<(g.x+g.w/2)?-1:1;
        p.x+=dir*12; p.vx=dir*9; p.vy=Math.min(p.vy,-3.2); p.og=false;
        if(B.bounceT<=0){ try{ sfx('hit'); }catch(e){} }
        B.bounceT=170; B.bounced++;
      }
    }
    if(B.bounceT>0) B.bounceT--;
    if(B.open&&!B.cleared&&B.gate&&p){
      const h=playerCoreHB(p), g=B.gate;
      if(ov(h.x,h.y,h.w,h.h,g.x,g.y,g.w,g.h)){
        B.cleared=true;
        try{ sfx('chargeReady'); }catch(e){}
        if(typeof uiShowToast==='function') uiShowToast('LEVEL 1 CLEAR (BETA)');
      }
    }
    // Laitu: wanders like an NPC, stops and faces MIND when close, talks.
    const L=B.laitu;
    if(L&&p){
      const mx=p.x+SW/2, dx=mx-L.x, dy=Math.abs(p.y+FEET_OFF-L.feet);
      const near=Math.abs(dx)<120&&dy<80;
      L.moving=false;
      if(near){
        L.face=dx>0?1:-1;
        if(!L.met){ L.met=true; L.talkT=200;
          if(typeof uiShowToast==='function') uiShowToast('LAITU: THEY TOOK THE ELDERS. FOLLOW THE KNOWL SEEDS, MIND!'); }
        else if(L.talkT<=0){ L.line=(L.line+1)%LAITU_TALK.length; L.talkT=200; }
      }else if(L.pause>0){ L.pause--; L.face=L.dir; }
      else{
        L.x+=L.dir*0.7; L.stepT+=0.18; L.moving=true; L.face=L.dir;
        if(L.x<=L.mn||L.x>=L.mx){ L.x=Math.max(L.mn,Math.min(L.mx,L.x)); L.dir=-L.dir; L.pause=50+Math.random()*70|0; }
        else if(Math.random()<0.004) L.pause=40+Math.random()*60|0;      // stops to look around now and then
      }
      if(L.talkT>0) L.talkT--;
    }
  };

  // The beta draws its own (much bigger) Knowl tree.
  const _origDrawTree=window.drawKnowlTree;
  if(_origDrawTree) window.drawKnowlTree=function(){ if(B.on) return; return _origDrawTree.apply(this, arguments); };
  // The arch is drawn by the beta; hide the game's own goal box ("COLLECT N KNOWL").
  const _origDrawGoal=window.drawGoal;
  window.drawGoal=function(){ if(B.on) return; return _origDrawGoal.apply(this, arguments); };

  // Seeds and crystals are drawn by the beta (bigger, sitting on the floor, shining).
  const _origDrawKnowl=window.drawKnowl;
  window.drawKnowl=function(){
    if(!B.on) return _origDrawKnowl.apply(this, arguments);
    const D=window.MV_BETA_DECOR;
    for(const k of KDROP){
      if(k.got) continue;
      if(k.kind==='crystal'){ if(D) D.crystal(k); }
      else if(D) D.seed(k);
    }
  };
  // Item pickups are labelled crates.
  const _origDrawItemDrops=window.drawItemDrops;
  window.drawItemDrops=function(){
    if(!B.on||!window.MV_BETA_DECOR) return _origDrawItemDrops.apply(this, arguments);
    for(const d of ITEM_DROPS) if(!d.got) MV_BETA_DECOR.itemCrate(d.item, d.x+d.w/2, d.y+d.h, d.enhanced);
  };
  const _origDrawRope=window.drawRopePickup;
  window.drawRopePickup=function(){
    if(!B.on||!window.MV_BETA_DECOR) return _origDrawRope.apply(this, arguments);
    const r=_mapRopePickup; if(!r||r.got) return;
    MV_BETA_DECOR.itemCrate(1, r.x+r.w/2, r.y+r.h, false);
  };

  // ── World layer: sky, dirt, grass, house interiors, roofs, arch ──
  const _origDrawWorld=window.drawLdtkLabWorld;
  window.drawLdtkLabWorld=function(){
    if(!B.on||!B.level) return _origDrawWorld.apply(this, arguments);
    const D=window.MV_BETA_DECOR;
    if(D) D.world(B);
    else _origDrawWorld.apply(this, arguments);
    // the arch
    if(B.gate){
      const g=B.gate, x=sx(g.x), y=sy(g.y), w=sw(g.w), h=sw(g.h);
      ctx.lineWidth=sw(8); ctx.strokeStyle=B.open?'#ffe680':'#4a3a3a';
      ctx.beginPath(); ctx.moveTo(x+sw(6),y+h); ctx.lineTo(x+sw(6),y+w/2); ctx.arc(x+w/2,y+w/2,w/2-sw(6),Math.PI,0); ctx.lineTo(x+w-sw(6),y+h); ctx.stroke();
      if(B.open){ ctx.fillStyle='rgba(255,230,140,'+(0.25+0.15*Math.sin(fr*0.1))+')'; ctx.fillRect(x+sw(10),y+w/2,w-sw(20),h-w/2); }
      else{ ctx.strokeStyle='#2a2020'; ctx.lineWidth=sw(3); for(let i=1;i<4;i++){ const bx=x+w*i/4; ctx.beginPath(); ctx.moveTo(bx,y+w/2-sw(8)); ctx.lineTo(bx,y+h); ctx.stroke(); } }
    }
    // shells on the arch fill in as crystals / seeds are gathered
    const n=counts(); let ci=0, si=0;
    for(const sh of B.shells){
      const filled=sh.slot==='crystal'?(ci++<n.crystals):(si++<n.seeds);
      const x=sx(sh.x), y=sy(sh.y), s=sw(11);
      ctx.lineWidth=2;
      if(sh.slot==='crystal'){
        ctx.beginPath(); ctx.moveTo(x,y-s); ctx.lineTo(x+s*0.7,y); ctx.lineTo(x,y+s); ctx.lineTo(x-s*0.7,y); ctx.closePath();
        ctx.fillStyle=filled?'#7fe8ff':'rgba(40,40,60,0.35)'; ctx.fill(); ctx.strokeStyle=filled?'#103040':'#4a4a60'; ctx.stroke();
      }else{
        ctx.beginPath(); ctx.arc(x,y,s*0.55,0,Math.PI*2);
        ctx.fillStyle=filled?'#66ffaa':'rgba(40,60,40,0.35)'; ctx.fill(); ctx.strokeStyle=filled?'#205030':'#4a604a'; ctx.stroke();
      }
    }
  };

  // ── Block faces (Paulo's sketch): omni = purple with the dark orb,
  //    push = blue crate with a backslash, pull = red crate with a slash,
  //    laser = gold cage block (TRS only). Colour AND symbol.
  const BLOCK_LOOK={
    omni:{base:'#7a3cc8', light:'#a874f0', dark:'#3c1670', ink:'#16081f'},
    push:{base:'#2f6fd8', light:'#7fb0ff', dark:'#163a80', ink:'#0a1a3c'},
    pull:{base:'#d0362c', light:'#ff8a7c', dark:'#701410', ink:'#2c0806'},
    laser:{base:'#d8a820', light:'#ffe27a', dark:'#7a5a08', ink:'#2a1e02'}
  };
  function drawBetaBlock(kind, x, y, w, h, rot, damage, glow, g2d){
    const ctx=g2d||window.ctx||document.getElementById('c').getContext('2d');
    const L=BLOCK_LOOK[kind]||BLOCK_LOOK.omni;
    ctx.save();
    ctx.translate(x+w/2, y+h/2); if(rot) ctx.rotate(rot); ctx.translate(-w/2, -h/2);
    const b=Math.max(2, Math.round(w*0.1));
    ctx.fillStyle=L.dark; ctx.fillRect(0,0,w,h);
    ctx.fillStyle=L.light; ctx.fillRect(0,0,w,b); ctx.fillRect(0,0,b,h);
    ctx.fillStyle=L.base; ctx.fillRect(b,b,w-2*b,h-2*b);
    ctx.strokeStyle=L.dark; ctx.lineWidth=Math.max(1,b*0.5);
    ctx.strokeRect(b*1.6, b*1.6, w-b*3.2, h-b*3.2);
    const i0=b*1.6, i1=w-b*1.6, j1=h-b*1.6;
    if(kind==='omni'){
      const cx=w/2, cy=h/2, r=w*0.24;
      ctx.fillStyle=L.ink; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=L.light; ctx.beginPath(); ctx.arc(cx,cy,r,-Math.PI/2,Math.PI/2); ctx.arc(cx,cy+r/2,r/2,Math.PI/2,-Math.PI/2,true); ctx.arc(cx,cy-r/2,r/2,Math.PI/2,-Math.PI/2,false); ctx.fill();
      ctx.fillStyle=L.ink; ctx.beginPath(); ctx.arc(cx,cy+r/2,r*0.16,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=L.light; ctx.beginPath(); ctx.arc(cx,cy-r/2,r*0.16,0,Math.PI*2); ctx.fill();
    }else if(kind==='push'||kind==='pull'){
      ctx.strokeStyle=L.dark; ctx.lineWidth=Math.max(1,w*0.04);
      ctx.beginPath(); ctx.moveTo(i0,i0); ctx.lineTo(i1,j1); ctx.moveTo(i1,i0); ctx.lineTo(i0,j1); ctx.stroke();
      const back=kind==='push';                       // push = \ , pull = /
      const ax=i0, ay=back?i0:j1, bx=i1, by=back?j1:i0;
      ctx.lineCap='round';
      ctx.strokeStyle=L.ink; ctx.lineWidth=Math.max(2,w*0.16); ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      ctx.strokeStyle=L.light; ctx.lineWidth=Math.max(1,w*0.05); ctx.beginPath(); ctx.moveTo(ax+w*0.05,ay+(back?-w*0.03:-w*0.05)); ctx.lineTo(bx-w*0.05,by+(back?-w*0.03:w*0.01)); ctx.stroke();
    }else{
      ctx.strokeStyle=L.dark; ctx.lineWidth=Math.max(1,w*0.06);
      ctx.beginPath(); for(let k=1;k<4;k++){ const xx=i0+(i1-i0)*k/4; ctx.moveTo(xx,i0); ctx.lineTo(xx,j1); } ctx.stroke();
      ctx.strokeStyle=L.ink; ctx.lineWidth=Math.max(2,w*0.08); ctx.lineJoin='round';
      ctx.beginPath(); ctx.moveTo(w*0.58,i0); ctx.lineTo(w*0.38,h*0.54); ctx.lineTo(w*0.6,h*0.46); ctx.lineTo(w*0.42,j1); ctx.stroke();
    }
    if(damage>0.05){
      ctx.strokeStyle='rgba(10,0,20,0.75)'; ctx.lineWidth=Math.max(1,w*0.04);
      ctx.beginPath(); ctx.moveTo(w*0.2,h*0.1); ctx.lineTo(w*0.42,h*0.42); ctx.lineTo(w*0.3,h*0.7);
      if(damage>0.4){ ctx.moveTo(w*0.42,h*0.42); ctx.lineTo(w*0.78,h*0.55); ctx.lineTo(w*0.9,h*0.85); }
      ctx.stroke();
    }
    if(glow>0){ ctx.fillStyle='rgba(255,255,255,'+(glow/16*0.35)+')'; ctx.fillRect(0,0,w,h); }
    ctx.restore();
  }

  // Blocks are drawn by main.js after the lab HUD, so dress them at draw time.
  const _origDrawBreakWall=window.drawBreakWall;
  window.drawBreakWall=function(bw){
    if(B.on&&bw&&bw.cube){
      if(bw.hp<=0) return _origDrawBreakWall.apply(this, arguments);   // debris
      const x=bw.x+(bw._ox||0), y=bw.y+(bw._oy||0);
      drawBetaBlock(bw.only||'omni', sx(x)+(bw.shakeX||0), sy(y)+(bw.shakeY||0), sw(bw.w), sw(bw.h),
        bw.rot||0, bw.hp<bw.maxHp?1-bw.hp/bw.maxHp:0, bw.hitGlow||0);
      if(bw.debris&&bw.debris.length){ const hp=bw.hp; bw.hp=0; try{ _origDrawBreakWall.apply(this, arguments); }catch(e){} bw.hp=hp; }
      return;
    }
    _origDrawBreakWall.apply(this, arguments);
    if(B.on&&bw&&bw.hp>0) drawBetaBlock(bw.only||'omni', sx(bw.x)+(bw.shakeX||0), sy(bw.y)+(bw.shakeY||0), sw(bw.w), sw(bw.h), 0, bw.hp<bw.maxHp?1-bw.hp/bw.maxHp:0, bw.hitGlow||0);
  };

  // ── Overlay: Laitu, HUD ─────────────────────────────────────────
  const _origDrawHud=window.drawLdtkLabHud;
  window.drawLdtkLabHud=function(){
    if(!B.on) return _origDrawHud.apply(this, arguments);
    if(_gameState!=='game') return;
    if(B.laitu&&typeof drawLaituFigure==='function'){
      const cx=sx(B.laitu.x), feet=sy(B.laitu.feet);
      if(cx>-60&&cx<W+60){
        ctx.imageSmoothingEnabled=true;
        const L=B.laitu;
        drawLaituFigure(cx, feet, sw(LAITU_SCALE), {faceR:(L.face||1)>0, walkPhase:L.moving?L.stepT:0});
        const top=Math.max(4,feet-sw(84*LAITU_SCALE));
        if(L.talkT>0){
          const txt=LAITU_TALK[L.line], tw=textW(txt,1)+16;
          ctx.fillStyle='rgba(255,246,220,0.95)'; ctx.fillRect(cx-tw/2, top-26, tw, 18);
          ctx.beginPath(); ctx.moveTo(cx-5,top-8); ctx.lineTo(cx+5,top-8); ctx.lineTo(cx,top-2); ctx.fill();
          drawTextC(txt, cx, top-21, '#3a2410', 1);
        }else if(!L.met&&fr%48<36) drawTextC('LAITU', cx, top-14, '#a8d4ff');
      }
    }
    const n=counts();
    ctx.fillStyle=C.BLACK; ctx.fillRect(6, H-44, 520, 38);
    drawText('G · AWDJOO L1 BETA', 10, H-40, C.SILVER, 1);
    if(ITEM===3&&p){
      const pw=Math.max(0,Math.min(100,p.itemStamina||0)), held=B.mag.held.length, cap=magCap(pw);
      ctx.fillStyle='#2a1020'; ctx.fillRect(200,H-41,150,8);
      ctx.fillStyle=pw>66?'#e04848':pw>33?'#e08a3a':'#e0c040'; ctx.fillRect(200,H-41,150*pw/100,8);
      ctx.fillStyle='#000'; ctx.fillRect(250,H-41,1,8); ctx.fillRect(300,H-41,1,8);
      drawText('MAG '+Math.round(pw)+'%  GRIP '+cap+(held?'  HOLDING '+held:''), 356, H-41, C.SILVER, 1);
    }else if(ITEM===2&&p&&B.chX>0){
      const c=Math.min(1,B.chX/45);
      ctx.fillStyle='#101830'; ctx.fillRect(200,H-41,150,8);
      ctx.fillStyle=c>=1?'#aaddff':'#4466ff'; ctx.fillRect(200,H-41,150*c,8);
      drawText(c>=1?'XLR FULL POWER':'XLR CHARGING', 356, H-41, C.SILVER, 1);
    }
    drawText('CRYSTALS '+n.crystals+'/'+B.need.crystals+'   SEEDS '+n.seeds+'/'+B.need.seeds+(B.open?'   ARCH OPEN':''),
      10, H-24, B.open?C.GREEN_L||C.YELLOW:C.YELLOW, 2);
    if(B.bounceT>0&&!B.open){
      const a=Math.min(1,B.bounceT/20), bw=Math.min(W-40,560), bx=(W-bw)/2, by=H*0.28;
      ctx.globalAlpha=a;
      ctx.fillStyle='rgba(10,6,24,0.92)'; ctx.fillRect(bx,by,bw,96);
      ctx.strokeStyle='#f0d070'; ctx.lineWidth=3; ctx.strokeRect(bx+2,by+2,bw-4,92);
      drawTextC('GATHER THE SEEDS & CRYSTALS', W/2, by+16, C.YELLOW, 2);
      drawTextC('TO PROCEED', W/2, by+40, C.YELLOW, 2);
      drawTextC('CRYSTALS '+n.crystals+'/'+B.need.crystals+'   SEEDS '+n.seeds+'/'+B.need.seeds, W/2, by+70, C.SILVER, 1);
      ctx.globalAlpha=1;
    }
    if(B.cleared){ ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,H/2-40,W,80); drawTextC('LEVEL 1 CLEAR', W/2, H/2-24, C.YELLOW, 3); drawTextC('BETA · THE JOURNEY BEGINS', W/2, H/2+12, C.SILVER, 2); }
  };

  B.drawBlock=drawBetaBlock; B.fireCube=fireCube; B.cubes=cubes; B.throwCube=throwCube; B.counts=counts;
  window.startBetaLab=startBetaLab;
  window.applyBeta=applyBeta;

  (function boot(){
    function go(){
      if(!want()) return;
      if(typeof applyLdtkLevel!=='function'||typeof mkP!=='function'){ requestAnimationFrame(go); return; }
      startBetaLab().catch(err=>console.error('Awdjoo beta failed', err));
    }
    if(document.readyState==='complete') requestAnimationFrame(go);
    else window.addEventListener('load', ()=>requestAnimationFrame(go));
  })();
})();
