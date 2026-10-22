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
  // Stages: 1.1 → 1.2 → … (1.3 ends with a boss, then 2.1). Finishing one carries the jacks into the next.
  const LEVELS={'1.1':{path:'assets/levels/awdjoo-beta.ldtk', next:'1.2', prev:null}, '1.2':{path:'assets/levels/awdjoo-1-2.ldtk', next:null, prev:'1.1'}};
  function wantedLevel(){ try{ const m=/[?&]lvl=([0-9.]+)/.exec(location.search); if(m&&LEVELS[m[1]]) return m[1]; }catch(e){} if(window.MV_BETA_START&&LEVELS[window.MV_BETA_START]) return window.MV_BETA_START; return '1.1'; }
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

  const LOAD_FADE=22;
  async function startBetaLab(id, carryMask, opts){
    opts=opts||{};
    id=id&&LEVELS[id]?id:wantedLevel();
    const PATH=LEVELS[id].path;
    if(typeof _unlockAudio==='function') _unlockAudio();
    _gameState='game';
    const guess=id==='1.2'?'stage2':'stage';
    if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.play(guess);   // still inside the click, before the level fetch
    const gen=B.loadGen=(B.loadGen||0)+1;             // a newer load wins (e.g. a stage button during boot)
    // Paulo (Oct 22): nothing of the old world may show while the stage loads — the game
    // draws a dark veil until the new level is in, then fades it in (main.js draw/update)
    B.loading=gen;
    const res=await fetch(PATH+(PATH.indexOf('?')<0?'?v='+(window.MV_BUILD||'0'):''));
    if(!res.ok){ if(B.loading===gen) B.loading=0; throw new Error('beta level fetch failed '+res.status); }
    const raw0=await res.json();
    if(opts.fresh) delete B.saves[id];
    const tier=revisitTier(id);
    const raw=applyTiers(raw0, tier);                  // revisit layers: new areas, echo crystals
    const level=await parseLdtkProject(raw, PATH);   // Collision grid + seeds (Knowl) via lab F
    if(gen!==B.loadGen) return;
    B.tier=tier; B.progress=Math.max(B.progress||0, ORDER.indexOf(id));
    B.stageId=id; B.carryMask=carryMask!=null?carryMask:(id==='1.1'?0:15);   // straight into 1.2 = all four jacks
    applyLdtkLevel(level);
    applyBeta(raw, level);
    restoreStage(opts);
    if(B.loading===gen){ B.loading=0; B.loadFade=LOAD_FADE; if(typeof _snapCameraToPlayer==='function'&&typeof p!=='undefined'&&p) try{ _snapCameraToPlayer(p); }catch(e){} }
    if(window.MV_BETA_AUDIO){
      if(B.music&&B.music!==guess) MV_BETA_AUDIO.play(B.music,{restart:true});
      else if(MV_BETA_AUDIO.ensure) MV_BETA_AUDIO.ensure();
    }
    else if(typeof _playBGM==='function'&&typeof OPT!=='undefined') _playBGM('game', OPT.musicVol);
  }

  // ── Two-way gates ─────────────────────────────────────────────
  // Each stage remembers what you did there (seeds, crystals, crates, the
  // Isolator, Laitu, the clock, whether the arch is cleared) for the session.
  // 1.1's arch leads on to 1.2 (results the first time, straight through
  // after that); walking left into 1.2's arrival arch takes you back to 1.1,
  // out of its arch. Jacks you own go with you both ways.
  B.saves=B.saves||{};
  const kKey=k=>k.kind+':'+Math.round(k.ox!=null?k.ox:k.x)+','+Math.round(k.oy!=null?k.oy:k.y);
  function saveStage(){
    if(!B.stageId) return;
    B.saves[B.stageId]={
      knowls:KDROP.filter(k=>k.got&&!k._carried&&!k._fly).map(kKey),
      drops:(typeof ITEM_DROPS!=='undefined'?ITEM_DROPS:[]).filter(d=>d.got).map(d=>d._cell||(d.item+'@'+Math.round(d.x))),
      rope:!!(_mapRopePickup&&_mapRopePickup.got),
      iso:!!(B.isoPickup&&B.isoPickup.got), isoRe:B.isoPickup?(B.isoPickup.re||0):0,
      met:!!(B.laitu&&B.laitu.met),
      cleared:!!B.cleared, stats:Object.assign({},B.stats)
    };
  }
  function restoreStage(opts){
    const sv=opts.fresh?null:B.saves[B.stageId];
    if(opts.fresh) delete B.saves[B.stageId];
    if(sv){
      const ks=new Set(sv.knowls), ds=new Set(sv.drops);
      KDROP.forEach(k=>{ if(ks.has(kKey(k))) k.got=true; });
      kColl=KDROP.filter(k=>k.got).length;
      if(typeof ITEM_DROPS!=='undefined') ITEM_DROPS.forEach(d=>{ if(ds.has(d._cell||(d.item+'@'+Math.round(d.x)))) d.got=true; });
      if(_mapRopePickup&&sv.rope) _mapRopePickup.got=true;
      if(B.isoPickup&&sv.iso&&sv.isoRe>0){ B.isoPickup.got=true; B.isoPickup.re=sv.isoRe; }
      if(B.laitu&&sv.met) B.laitu.met=true;
      B.cleared=sv.cleared; B.stats=Object.assign(B.stats,sv.stats);
      if(gateReady()) B.open=true;
      if(B.tier>0&&B.echoNeed>0&&!B.open){                // the town has changed since you left
        B.shake=Math.max(B.shake||0,9);
        try{ if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.boom(0.8); }catch(e){}
        B.revisitNote=360;
      }
    }
    B.arriveCd=90;
    if(opts.atGate&&B.gate&&p){                 // come back out of this stage's arch, facing home
      p.x=B.gate.x-3*T+T/2-SW/2; p.y=B.gate.y+B.gate.h-FEET_OFF-1; p.vx=0; p.vy=0; p.og=true; p.fc=true;
      if(typeof _snapCameraToPlayer==='function') _snapCameraToPlayer(p);
      _zoneCardT=0;
    }
    if(sv||opts.atGate){ _zoneCardT=Math.min(_zoneCardT,120); if(typeof _uiToastFr!=='undefined') _uiToastFr=0; }
  }
  function travel(to, how){
    if(B.trans||!LEVELS[to]) return;
    saveStage();
    const mask=_unlockedMask|0;
    B.trans={t:0, to, how, mask, loading:false, done:false};
    try{ sfx('unlock'); }catch(e){}
  }
  function transTick(){
    const R=B.trans; R.t++;
    if(R.t===26&&!R.loading){
      R.loading=true;
      startBetaLab(R.to, R.mask, {atGate:R.how==='back'}).then(()=>{ R.done=true; R.t=26; R.after=0; }).catch(err=>{ console.error('stage load failed',err); B.trans=null; });
    }
    if(R.done){ R.after++; if(R.after>30){ B.trans=null; if(window.MV_CONSOLE){ MV_CONSOLE.mosaic=1; MV_CONSOLE.fade=0; } } }
  }
  function drawTrans(){
    const R=B.trans; if(!R) return;
    // iris wipe: closes on MIND, opens on the new stage
    const k=R.done?Math.min(1,R.after/30):Math.min(1,R.t/26);
    const open=R.done?k:1-k;
    const CON=window.MV_CONSOLE, cm=CON?CON.mode:'off';
    if(CON){ CON.mosaic=cm==='snes'?1+Math.round((1-open)*14):1; CON.fade=cm==='md'?1-open:0; }
    if(R.done&&R.after>=30&&CON){ CON.mosaic=1; CON.fade=0; }
    if(cm==='md'){                                   // Mega Drive: a stepped palette fade, no iris
      if(!R.done&&R.t>=26){ ctx.save(); ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H); ctx.globalAlpha=0.6+0.4*Math.sin(fr*0.2); drawTextC('AWDJOO TOWN '+R.to, W/2, H/2-10, '#ffe39a', 2); ctx.restore(); CON.fade=0; }
      return;
    }
    const cx=p?sx(p.x+SW/2):W/2, cy=p?sy(p.y+FEET_OFF*0.5):H/2;
    const rad=Math.hypot(W,H)*open*open;
    ctx.save(); ctx.fillStyle='#05020e';
    ctx.beginPath(); ctx.rect(0,0,W,H); ctx.arc(cx,cy,Math.max(0.5,rad),0,Math.PI*2,true); ctx.fill('evenodd');
    if(rad>2){ ctx.strokeStyle='rgba(246,201,74,'+(0.8*(1-open))+')'; ctx.lineWidth=6; ctx.beginPath(); ctx.arc(cx,cy,rad,0,Math.PI*2); ctx.stroke(); }
    if(!R.done&&R.t>=26){ ctx.globalAlpha=0.6+0.4*Math.sin(fr*0.2); drawTextC('AWDJOO TOWN '+R.to, W/2, H/2-10, '#ffe39a', 2); }
    ctx.restore();
  }
  B.travel=travel; B.saveStage=saveStage;

  // ── Back to the title / restart the stage (story mode) ──────────
  function quitToTitle(){
    B.on=false; B.results=null; B.popup=null; B.trans=null; B.ending=null;
    if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.stopAll();
    _paused=false; _gameState='title'; if(typeof _titleT!=='undefined') _titleT=0;
    if(typeof _playBGM==='function') try{ _playBGM('title',OPT.musicVol); }catch(e){}
  }
  B.quitToTitle=quitToTitle;
  const _origEnterZone=window._enterZone;
  window._enterZone=function(i){
    if(B.on&&_gameState==='game'&&B.stageId){                // Tab / RESET: restart this stage
      B.results=null; B.popup=null; B.trans=null;
      startBetaLab(B.stageId, B.carryMask).catch(err=>console.error('stage load failed',err));
      return;
    }
    return _origEnterZone.apply(this, arguments);
  };

  // ── Revisits: a beaten stage changes as the game goes on ───────
  // Entities can carry a "tier" field: tier 0 = always, tier N = only once
  // the player has gone N stages past this one and comes back. RevisitWall
  // rectangles rewrite the map for their tier (open = carve a new area,
  // seal = block a path, oneway = add a ledge). EchoCrystal entities are the
  // revisit goal: a beaten stage's arch stays shut until its echo crystals
  // for the current tier are collected.
  const ORDER=Object.keys(LEVELS);
  function revisitTier(id){
    const sv=B.saves[id];
    if(!sv||!sv.cleared) return 0;
    return Math.max(0,(B.progress||0)-ORDER.indexOf(id));
  }
  function applyTiers(raw0, tier){
    const raw=JSON.parse(JSON.stringify(raw0));
    for(const lv of raw.levels||[]){
      const layers=lv.layerInstances||[];
      const L=n=>layers.find(l=>l.__identifier===n);
      const ent=L('Entities'), col=L('Collision'), skin=L('Skin');
      if(!ent) continue;
      ent.entityInstances=ent.entityInstances.filter(e=>((F(e,'tier')|0)<=tier));
      for(const e of ent.entityInstances){
        if(e.__identifier!=='RevisitWall') continue;
        const g=cell(e), kind=F(e,'kind')||'open';
        const v=kind==='seal'?1:kind==='oneway'?2:0, sk=F(e,'skin');
        for(let r=g.r;r<g.r+g.h;r++) for(let c=g.c;c<g.c+g.w;c++){
          if(col&&c>=0&&c<col.__cWid&&r>=0&&r<col.__cHei) col.intGridCsv[r*col.__cWid+c]=v;
          if(skin&&c>=0&&c<skin.__cWid&&r>=0&&r<skin.__cHei){
            if(kind==='open') skin.intGridCsv[r*skin.__cWid+c]=sk!=null?sk:5;
            else if(kind==='seal') skin.intGridCsv[r*skin.__cWid+c]=sk!=null?sk:0;
          }
        }
      }
    }
    return raw;
  }
  function gateReady(){
    const n=counts();
    const base=n.crystals>=B.need.crystals&&n.seeds>=B.need.seeds;
    return B.tier>0&&B.echoNeed>0 ? base&&n.echo>=B.echoNeed : base;
  }
  B.gateReady=gateReady;

  function applyBeta(raw, level){
    B.on=true; B.level=level; B.open=false; B.cleared=false; B.talked=0;
    B.rooms=[]; B.labels=[]; B.rings=[]; B.shells=[]; B.decor=[]; B.crateCells=new Set(); B.flying=[];
    B.bounceT=0; B.bounced=0; B.chX=0; B.chM=0; B.booms=[]; B.blasts=[];
    B.echoNeed=0; B.revisitNote=0; B.safe=null;
    B.stats={shutdowns:0, permOff:0, booms:0, hits:0, frames:0, items:0}; B.popup=null; B.results=null; B.lastMask=0; B.shake=0;
    B.mag={held:[], lockedThisHold:false, power:100, wasOn:false, tips:[]}; B.magLock=null; B.magPark=null;
    const lv=raw.levels[0];
    B.sky=(F(lv,'skyRows')|0)||0;
    B.horizonRow=F(lv,'horizonRow')!=null?F(lv,'horizonRow'):B.sky+13;
    B.stageName=F(lv,'stageName')||'AWDJOO TOWN 1.1'; B.stageSub=F(lv,'stageSub')||'The Journey Begins';
    B.music=F(lv,'music')||'stage'; B.surfRow=null; B.laitu=null;
    if(B.onLevelStart) B.onLevelStart(lv);
    if(B.onLevelStartEnemies) B.onLevelStartEnemies();
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
        case 'EchoCrystal':
          B.echoNeed++;
          KDROP.push({x:cx, y:y+T/2, ox:cx, oy:y+T/2, px:0, py:0, vx:0, vy:0, got:false, bob:Math.random()*Math.PI*2, kind:'echo'}); break;
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
            bw.only='laser'; bw.plug=F(e,'plug')||null; BWALLS.push(bw); break;
          }
          const hard=kind!=='omni';
          // Cube: lives in one grid cell, never a rigid body (no physics cost while idle).
          const bw=_mkBwall(x, y, T, T, {
            tileGid:typeof BWALL_RED_GID!=='undefined'?BWALL_RED_GID:242, movable:false,
            hp:hard?1e6:RED_BWALL_HP, maxHp:hard?1e6:RED_BWALL_HP,
            label:kind==='omni'?'BLOCK':kind.toUpperCase(), homeX:x, homeY:y, homeCol:g.c, homeRow:g.r,
            col:kind==='push'?'#3070d0':kind==='pull'?'#d0362c':'#7a3cc8'});
          if(hard) bw.only=kind;
          bw.cube=true; bw.noKnock=true; bw._ox=0; bw._oy=0; bw.wedge=!!F(e,'wedge'); bw.stay=!!F(e,'stay');
          BWALLS.push(bw);
          break;
        }
        case 'Enemy': {
          const ai=F(e,'ai');
          if(ai==='mirror'&&B.mkMirror){ ENEMS.push(B.mkMirror(cx, feet, (F(e,'range')||8)*T)); break; }
          if(ai&&B.mkAiEnemy){ ENEMS.push(B.mkAiEnemy(ai, cx, feet, {range:(F(e,'range')||5)*T, dir:F(e,'dir')|0||undefined, iso:!!F(e,'iso')})); break; }
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
          B.decor.push({kind:F(e,'kind'), c:g.c, r:g.r, x, y, w:g.w*T, h:g.h*T, dx:F(e,'dx')|0, dy:F(e,'dy')|0, len:F(e,'len')|0}); break;
      }
    }
    B.itemsTotal=ents.filter(e=>e.__identifier==='Item'||e.__identifier==='Rca'||e.__identifier==='Isolator').length;
    if(B.onEntities) B.onEntities(ents, F, cell);
    kTotal=KDROP.length; kColl=0; goalOpen=false;
    if(typeof gridStampLiveBwalls==='function') gridStampLiveBwalls();
    B.cubeCellsEver=new Set(BWALLS.filter(b=>b.cube&&b.homeCol!=null).map(b=>b.homeCol+','+b.homeRow));   // for the ghost-cell sweep
    cubeSettleNow();
    // The referee and main.js read the exit from GOALPL; goalOpen stays false so
    // main.js never zone-hops — the arch is handled here.
    if(B.gate) GOALPL={x:B.gate.x, y:B.gate.y, w:B.gate.w, h:B.gate.h};

    p=mkP(); p.x=_spawnX; p.y=_spawnY; p.vx=0; p.vy=0; p.og=true; p.hp=p.maxHp; p.fc=false;
    p2=null; _unlockedMask=B.carryMask|0; ITEM=_unlockedMask?[1,2,3,0].find(i=>_unlockedMask&(1<<i)):-1; B.lastMask=_unlockedMask;
    if(typeof _snapCameraToPlayer==='function') _snapCameraToPlayer(p);
    if(typeof ZONES!=='undefined'){
      let zi=ZONES.findIndex(z=>z.name===B.stageName);
      if(zi<0){ ZONES.push({name:B.stageName, sub:B.stageSub}); zi=ZONES.length-1; }
      _zoneIdx=zi; _zoneCardT=200;
    }
    window.MV_ZONE_CARD={title:B.stageName, sub:String(B.stageSub||'')};
    if(typeof uiShowToast==='function') uiShowToast(B.need.crystals+' CRYSTALS + '+B.need.seeds+' SEEDS OPEN THE ARCH');
    console.info('MV: Awdjoo L1 beta', level.cols+'x'+level.rows, 'knowls', kTotal, 'boxes', BWALLS.length, 'enemies', ENEMS.length);
  }

  function counts(){
    let crystals=0, seeds=0, echo=0;
    for(const k of KDROP){ if(!k.got||k._carried||k._fly) continue; if(k.kind==='crystal') crystals++; else if(k.kind==='echo') echo++; else seeds++; }
    return {crystals, seeds, echo};
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
    for(const d of ITEM_DROPS) if(d._cell===c+','+r&&!d.got&&!(d._box&&d._box.broken)) return true;
    if(_mapRopePickup&&!_mapRopePickup.got&&!(_mapRopePickup._box&&_mapRopePickup._box.broken)&&Math.floor(_mapRopePickup.x/T)===c&&Math.floor(_mapRopePickup.y/T)===r) return true;
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
    gridSet(bw.homeCol,bw.homeRow,MV_GRID_DESTRUCT); B.cubeCellsEver.add(bw.homeCol+','+bw.homeRow);
    bw._ox-=dc*T; bw._oy-=dr*T; bw._spd=T/Math.max(1,frames);
  }
  function placeCube(bw,c,r,fromX,fromY){
    bw.homeCol=c; bw.homeRow=r; bw.x=bw.homeX=c*T; bw.y=bw.homeY=r*T;
    gridSet(c,r,MV_GRID_DESTRUCT); B.cubeCellsEver.add(c+','+r);
    bw._ox=fromX-bw.x; bw._oy=fromY-bw.y; bw._spd=6; bw._fallN=0;
  }
  const busy=bw=>Math.abs(bw._ox)>0.01||Math.abs(bw._oy)>0.01;
  const holdsStill=bw=>bw.only==='laser'||bw.wedge||bw.stay;
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
  B.cubeCellsEver=new Set();
  function ghostSweep(){
    if(fr%30!==0||!B.cubeCellsEver.size) return;
    const live=new Set();
    for(const bw of BWALLS) if(bw.hp>0&&bw.homeCol!=null) live.add(bw.homeCol+','+bw.homeRow);
    for(const k of B.cubeCellsEver){
      if(live.has(k)) continue;
      const [c,r]=k.split(',').map(Number);
      if(gridCell(c,r)===MV_GRID_DESTRUCT) gridSmashCell(c,r);
    }
  }
  function cubeTick(){
    ghostSweep();
    // a shattered cube gives up its cell for good (the game would keep re-opening it)
    for(const bw of BWALLS) if(bw.cube&&bw.hp<=0&&bw.homeCol!=null){
      gridSmashCell(bw.homeCol,bw.homeRow); bw.homeCol=bw.homeRow=bw.homeX=bw.homeY=null;
    }
    const list=cubes().sort((a,b)=>b.homeRow-a.homeRow);   // bottom first: stacks fall together
    for(const bw of list){
      if(bw.hitGlow>0) bw.hitGlow--;
      if(bw.shakeX) bw.shakeX=Math.abs(bw.shakeX)<0.5?0:-bw.shakeX*0.6;
      if(bw._sq||bw._sqV){ bw._sqV=(bw._sqV||0)*0.72-(bw._sq||0)*0.35; bw._sq=(bw._sq||0)+bw._sqV; if(Math.abs(bw._sq)<0.004&&Math.abs(bw._sqV)<0.004){ bw._sq=0; bw._sqV=0; } }
      if(busy(bw)&&bw._ease){                 // a push: fast off the blast, slowing as it arrives
        const d=Math.hypot(bw._ox,bw._oy), s=Math.max(1.6,d*bw._ease);
        if(d<=s){
          bw._ox=0; bw._oy=0; bw._ease=0;
          const pd=bw._pushDir||{dc:0,dr:0}; bw._sq=0.2; bw._sqV=0; bw._sqAx=pd.dc?'x':'y';
          if(pd.dc){ for(let k=0;k<6;k++) PFXS.push({x:bw.x+T/2+pd.dc*T/2,y:bw.y+T-3,vx:pd.dc*(0.5+Math.random()*1.5),vy:-Math.random()*1.4,life:14+Math.random()*8|0,maxLife:22,r:2+Math.random()*2,col:'#c8b090'}); }
          try{ sfxAt(bw,'omniblock_chip'); }catch(e){}
        }else{ bw._ox-=bw._ox/d*s; bw._oy-=bw._oy/d*s;
          if(bw._pushDir&&bw._pushDir.dc&&fr%2===0) PFXS.push({x:bw.x+(bw._ox||0)+T/2-bw._pushDir.dc*T/2,y:bw.y+T-2,vx:-bw._pushDir.dc*Math.random(),vy:-Math.random()*0.8,life:12,maxLife:12,r:1.5+Math.random()*1.5,col:'#b8a080'}); }
        continue;
      }
      if(busy(bw)){                           // ease the picture toward the cell
        const s=bw._spd||8;
        bw._ox=Math.abs(bw._ox)<=s?0:bw._ox-Math.sign(bw._ox)*s;
        bw._oy=Math.abs(bw._oy)<=s?0:bw._oy-Math.sign(bw._oy)*s;
        continue;
      }
      if(!holdsStill(bw)&&cellFree(bw.homeCol,bw.homeRow+1)){
        bw._fallN=(bw._fallN||0)+1;
        moveCube(bw,0,1,Math.max(2,7-bw._fallN));
        if(!cellFree(bw.homeCol,bw.homeRow+1,true)){ try{ sfxAt(bw,'omniblock_chip'); }catch(e){} bw.shakeY=2; }
        continue;
      }
      bw._fallN=0;
    }
    chainTick();
    flyTick();
    magnetTick();
    // XLR / MAG act when the button is let go
    const xlrNow=!!(p&&p.xlrOn&&ITEM===2), magNow=!!(p&&p.magOn&&ITEM===3);
    // Paulo: aimed down while standing, a TAP launches him at once — as hard as
    // the power he has (100% = a full launch); the power is spent
    // …unless there are blocks right under him (a trapdoor): then the blast is for THEM — it
    // pushes them down the hole (Paulo, Oct 22: no more launching off the trapdoor and getting stuck)
    if(xlrNow&&!B._xlrWasOn&&typeof _itemDownAim==='function'&&_itemDownAim(p)&&_playerOnGround(p)&&B.onXlrRelease&&!blastCandidates().length){
      const ch=Math.max(0,Math.min(1,(p.itemStamina||0)/100));
      B.relPow=Math.min(1,ch/0.18); B.xlrAim={x:0,y:1};   // an almost empty bar barely lifts him B.onXlrRelease(ch*(B.FEEL?B.FEEL.XLR_FULL:45)); p.itemStamina=0; p._itemRest=ITEM_REST; B._xlrTapped=true;
    }
    B._xlrWasOn=xlrNow; if(!xlrNow) B._xlrTapped=false;
    if(B._xlrTapped){ B.chX=0; B.downCubeHeld=false; }
    else if(xlrNow){
      B.chX++; B.xlrAim={x:p.aimDX,y:p.aimDY};
      blowAround();                                              // the air pushes enemies while you hold it (the MAG's pull already does)
      B.downCubeHeld=(p.aimDY||0)>0.55&&powNow()>=0.06&&blastCandidates().length>0;
      if(B.forceFrags){ const t0=xlrTip(); B.forceFrags(t0.x,t0.y,Math.atan2(p.aimDY,p.aimDX),1,0.5*(0.2+0.8*powNow()),180); }   // the blow shoves frags away
      for(const bw of cubes()){
        if(bw.only==='pull'||bw._carried||bw._fly) continue;
        if(Math.hypot(bw.vx||0,bw.vy||0)>0.8) throwCube(bw,(bw.vx||0)*4,(bw.vy||0)*4);
      }
    } else if(B.chX>0){
      B.downCubeHeld=false;
      // Paulo (Oct 21): every blast costs power on top of the hold, and its strength is
      // the power left — spamming it empties the bar and the pushes fade to nothing
      B.relPow=powNow(); fireCube('push',B.chX); blastEnemies(B.chX); if(B.onXlrRelease) B.onXlrRelease(B.chX);
      if(B.forceFrags){ const t0=xlrTip(); B.forceFrags(t0.x,t0.y,Math.atan2(p.aimDY,p.aimDX),1,9*Math.min(1,B.chX/45)*B.relPow+2*B.relPow,220); }
      spend(ITEM_COST.XLR_BASE+ITEM_COST.XLR_CHARGE*Math.min(1,B.chX/45)); B.chX=0;
    }
    if(magNow) B.chM++; else if(B.chM>0){
      B.relPow=powNow(); if(!B.mag.lockedThisHold) fireCube('pull',B.chM);
      spend(ITEM_COST.MAG_BASE+ITEM_COST.MAG_CHARGE*Math.min(1,B.chM/60)); B.chM=0; B.mag.lockedThisHold=false;
    }
  }
  const ITEM_COST={XLR_BASE:28, XLR_CHARGE:27, MAG_BASE:22, MAG_CHARGE:20}, ITEM_REST=20;   // Oct 22: the bar waits less before refilling (was 35)   // Paulo (Oct 21): drains a bit faster, refills sooner
  B.ITEM_COST=ITEM_COST;
  function xlrTip(){ const pose=typeof computeConnectorArmPose==='function'?computeConnectorArmPose(p):null; return pose?{x:pose.noseX,y:pose.noseY}:{x:p.x+SW/2,y:p.y+FEET_OFF-50}; }
  const powNow=()=>Math.max(0,Math.min(1,(p.itemStamina||0)/100));
  function spend(n){ p.itemStamina=Math.max(0,(p.itemStamina||0)-n); p._itemRest=ITEM_REST; }   // and the bar waits a moment before refilling
  // Dominant aim axis → one of the four cell directions.
  function aimAxis(){
    const ax=p.aimDX||0, ay=p.aimDY||0, l=Math.hypot(ax,ay)||1;
    const x=ax/l, y=ay/l;
    const dc=x>0.38?1:x<-0.38?-1:0;
    const dr=y>0.38?1:y<-0.38?-1:0;
    if(!dc&&!dr) return {dc:x>=0?1:-1, dr:0};
    return {dc, dr};
  }
  // A push shoves the whole line of cubes in front of the target (Sokoban style):
  // it moves only if the cell past the far end is free. A pull-only or laser
  // block in the line stops an XLR push; push-only blocks stop a MAG pull.
  const B_CHAINS=[];
  function lineFrom(bw,dc,dr,mode){
    const list=[bw];
    let c=bw.homeCol+dc, r=bw.homeRow+dr;
    for(let guard=0;guard<40;guard++){
      const nb=cubeAt(c,r);
      if(!nb) break;
      // a pushed block shoves whatever block is behind it (a pull block too — it's the push block
      // doing the shoving); only the TRS cage blocks stop a line
      if(nb.only==='laser'||(mode==='pull'&&nb.only==='push')) return null;
      list.push(nb); c+=dc; r+=dr;
    }
    return list;
  }
  function cubeAt(c,r){ for(const b of cubes()) if(b.homeCol===c&&b.homeRow===r) return b; return null; }
  B.cubeAt=cubeAt;
  function chainTick(){
    for(let i=B_CHAINS.length-1;i>=0;i--){
      const ch=B_CHAINS[i];
      if(ch.list.some(b=>b.hp<=0||b._carried||b._fly||b.homeCol==null)){ B_CHAINS.splice(i,1); continue; }
      if(ch.list.some(busy)) continue;
      const far=ch.list[ch.list.length-1];
      if(ch.left<=0||!cellFree(far.homeCol+ch.dc,far.homeRow+ch.dr)){
        if(ch.left===ch.cells){ for(const b of ch.list){ b.shakeX=ch.dc*2; b.hitGlow=10; } try{ sfxAt(ch.list[0],'omniblock_chip'); }catch(e){} }
        B_CHAINS.splice(i,1); continue;
      }
      // Paulo (Oct 21): the push should read clearly — the whole line takes all its
      // cells at once and glides there fast, slowing as it arrives, then squashes
      // against the stop and wobbles (no stiff cell-by-cell steps)
      let n=0;
      while(ch.left>0&&cellFree(ch.list[ch.list.length-1].homeCol+ch.dc,ch.list[ch.list.length-1].homeRow+ch.dr)){
        for(let k=ch.list.length-1;k>=0;k--) moveCube(ch.list[k],ch.dc,ch.dr,CUBE.SLIDE_FR);
        ch.left--; n++;
      }
      for(const b of ch.list){ b._ease=0.15; b._pushDir={dc:ch.dc,dr:ch.dr}; b._spd=null; }
      ch.left=0;
    }
  }
  // The floor lip under his feet hides a cube in the shaft beside him (Laitu's house).
  // The column itself is open, so the blast still reaches it.
  function shaftSees(bw){
    const ax=aimAxis();
    if(!ax.dr||Math.abs(ax.dc)>Math.abs(ax.dr)) return false;
    const pc=Math.floor((p.x+SW/2)/T);
    if(Math.abs(bw.homeCol-pc)>1) return false;
    const top=Math.floor((p.y+FEET_OFF-4)/T);
    const r0=Math.min(top,bw.homeRow), r1=Math.max(top,bw.homeRow);
    for(let r=r0;r<=r1;r++){
      if(r===bw.homeRow) continue;
      if(cubeAt(bw.homeCol,r)) continue;
      if(typeof gridSolid==='function'&&(gridSolid(bw.homeCol,r)||(typeof gridIsSlope==='function'&&gridIsSlope(bw.homeCol,r)))) return false;
      if(typeof gridCell==='function'&&typeof MV_GRID_ONEWAY!=='undefined'&&gridCell(bw.homeCol,r)===MV_GRID_ONEWAY) return false;
    }
    return true;
  }
  function stepOpen(list,dc,dr){
    if(!list||(!dc&&!dr)) return false;
    const far=list[list.length-1];
    return cellFree(far.homeCol+dc,far.homeRow+dr);
  }
  // ── XLR blast (Paulo, Oct 21): not one block but a cone of air out of the jack.
  //   Blocks in the jack's band (about a block either side of the aim line) go
  //   straight along the aim, 3 cells (4 at full charge); the blocks just off the
  //   band are blown out diagonally, 2 cells (3). Each takes the line behind it.
  //   Weaker on a low power bar, and heavy lines go less far.
  function blastCandidates(){
    if(!p) return [];
    const o=shoulder(), tip=typeof connectorTipWorld==='function'?connectorTipWorld(2):o;
    const ax=aimAxis(); if(!ax.dc&&!ax.dr) return [];
    const BAND=T*1.15, EDGE=T*1.85, RANGE=T*7;
    const hits=[];
    for(const bw of cubes()){
      if(bw.only==='laser'||bw.only==='pull') continue;
      const cx=bw.x+T/2, cy=bw.y+T/2;
      let along, perp, pdc=0, pdr=0;
      if(ax.dc&&ax.dr){ const l=Math.SQRT2; along=((cx-o.x)*ax.dc+(cy-o.y)*ax.dr)/l; perp=Math.abs((cx-tip.x)*ax.dr-(cy-tip.y)*ax.dc)/l; if(perp>BAND) continue; }
      else if(ax.dc){ along=(cx-o.x)*ax.dc; perp=cy-tip.y; pdr=Math.sign(perp); perp=Math.abs(perp); }
      else { along=(cy-o.y)*ax.dr; perp=cx-tip.x; pdc=Math.sign(perp); perp=Math.abs(perp); }
      if(along<-T*0.3||along>RANGE||perp>EDGE) continue;
      const inShaft=shaftSees(bw);
      const straight=perp<=BAND||inShaft;
      if(!straight&&along<T*0.4) continue;                       // right above / below him: not in the cone
      if(!losClear(cx,cy,bw.homeCol,bw.homeRow)&&!inShaft) continue;
      let dc=straight?ax.dc:(ax.dc||pdc), dr=straight?ax.dr:(ax.dr||pdr);
      if(inShaft){ dc=ax.dc; dr=ax.dr; }                         // down the hole, not sideways into the lip
      hits.push({bw,along,dc,dr,straight:straight||inShaft});
    }
    // Paulo (Oct 22): the blocks he's STANDING on, aimed straight down, always count — the
    // cone used to skip the block right under the wheel, so on a trapdoor the edges went
    // and the middle never moved (stuck at the basement entrance / under Laitu's house)
    if(ax.dr>0&&!ax.dc){
      const wx=p.x+SW/2, feetRow=Math.floor((p.y+FEET_OFF+4)/T);
      for(const bw of cubes()){
        if(bw.only==='laser'||bw.only==='pull'||hits.some(h=>h.bw===bw)) continue;
        if(bw.homeRow!==feetRow||Math.abs(bw.x+T/2-wx)>T*1.05) continue;
        hits.push({bw,along:T*0.5,dc:0,dr:1,straight:true});
      }
    }
    return hits;
  }
  function blastCubes(held){
    const ax=aimAxis(); if(!ax.dc&&!ax.dr) return false;
    const charge=Math.min(1,held/CUBE.CHARGE_FULL), pw=B.relPow==null?1:B.relPow;
    if(pw<0.06) return false;
    const bonus=charge>=0.8?1:0, weak=pw<0.15?2:pw<0.35?1:0;
    const hits=blastCandidates();
    if(!hits.length) return false;
    for(const h of hits){
      const far=h.along>T*4?1:0;
      h.cells=Math.max(1,(h.straight?3:2)+bonus-weak-far);
    }
    hits.sort((a,b)=>a.along-b.along);                          // chainTick runs the last one first: the farthest goes first
    const taken=new Set(); let any=false;
    for(const h of hits){
      if(taken.has(h.bw)) continue;
      let list=lineFrom(h.bw,h.dc,h.dr,'push');
      if(!stepOpen(list,h.dc,h.dr)&&(h.dc!==ax.dc||h.dr!==ax.dr)){
        const alt=lineFrom(h.bw,ax.dc,ax.dr,'push');
        if(stepOpen(alt,ax.dc,ax.dr)){ list=alt; h.dc=ax.dc; h.dr=ax.dr; }
      }
      h.bw.hitGlow=16; h.bw._sq=-0.16; h.bw._sqV=0; h.bw._sqAx=h.dc?'x':'y';
      const hx=h.bw.x+T/2-h.dc*T/2, hy=h.bw.y+T/2-h.dr*T/2;
      for(let k=0;k<6;k++){ const a2=Math.atan2(h.dr,h.dc)+Math.PI+(Math.random()-0.5)*1.6; PFXS.push({x:hx,y:hy,vx:Math.cos(a2)*(1+Math.random()*2.5),vy:Math.sin(a2)*(1+Math.random()*2.5),life:12+Math.random()*8|0,maxLife:20,r:2,col:'#9fd8ff'}); }
      if(!list){ h.bw.shakeX=h.dc*5; continue; }
      for(const b of list){ taken.add(b); b.wedge=false; }
      const lineW=list.reduce((w,b)=>w+weightOf('cube',b),0);
      const go=Math.max(1,Math.round(h.cells*Math.min(1,7/lineW)));
      B_CHAINS.push({list, dc:h.dc, dr:h.dr, left:go, cells:go}); any=true;
    }
    B.lastFire={mode:'push', blast:true, hits:hits.map(h=>({c:h.bw.homeCol,r:h.bw.homeRow,dc:h.dc,dr:h.dr,cells:h.cells}))};
    if(!any) try{ sfx('omniblock_chip'); }catch(e){}
    return true;
  }
  B.blastCubes=blastCubes;
  // ── the same blast hits enemies (Paulo, Oct 22: the XLR has to do something to
  //   them): every enemy in the cone in front of the jack is blown back, hard
  //   enough to see — tumbling through the air, knocked into walls, a little
  //   damage, more when you're close and charged. Light ones fly further.
  function blastEnemies(held){
    const o=shoulder(), a=Math.atan2(p.aimDY||0,p.aimDX||(p.fc?1:-1)), ux=Math.cos(a), uy=Math.sin(a);
    const charge=Math.min(1,held/CUBE.CHARGE_FULL), pw=B.relPow==null?1:B.relPow; if(pw<0.06) return 0;
    const RANGE=T*6; let n=0;
    for(const e of ENEMS){
      if(!isFinite(e.x)||e._betaHeld||e._pitT>0) continue;
      const cx=e.x+(e.w||SW)/2, cy=e.mind?e.y+FEET_OFF-50:e.y+e.h/2, dx=cx-o.x, dy=cy-o.y, d=Math.hypot(dx,dy)||1;
      if(d>RANGE) continue;
      const along=(dx*ux+dy*uy)/d; if(along<0.72) continue;               // a ~45° cone
      if(!losClear(cx,cy)) continue;
      const k=(0.45+0.55*charge)*pw*(1-0.55*d/RANGE);
      const wgt=Math.max(0.5,Math.sqrt((weightOf('enemy',e)||6)/6));
      const sp=(7+9*k)/wgt, bx=dx/d*0.35+ux*0.65, by=dy/d*0.35+uy*0.65, bl=Math.hypot(bx,by)||1;
      e.vx=bx/bl*sp; e.vy=by/bl*sp-(2+3*k)/wgt; e.og=false;
      if(e._ai){ e.mn=-1e6; e.mx=1e6; e._thrownF=Math.round(26+30*k); e._reCenter=true; if(!e.alive) e._shutSettled=false; }
      if(typeof _markEnemyItemForce==='function') _markEnemyItemForce(e,40);
      if(e.alive&&typeof _damageEnemy==='function') _damageEnemy(e,Math.round(4+10*k),o.x+ux*30,o.y+uy*30,0.4);
      for(let j=0;j<10;j++){ const a2=Math.atan2(by,bx)+(Math.random()-0.5)*1.2; PFXS.push({x:cx-ux*e.w*0.4,y:cy-uy*e.w*0.4,vx:Math.cos(a2)*(2+Math.random()*4),vy:Math.sin(a2)*(2+Math.random()*4),life:14+Math.random()*10|0,maxLife:24,r:2+Math.random()*2,col:j%2?'#bfe8ff':'#ffffff'}); }
      if(B.pushFx) B.pushFx.push({x:cx,y:cy,dir:Math.sign(ux)||1,t:0});
      n++;
    }
    if(n){ B.shake=Math.max(B.shake||0,3+4*charge); try{ sfx('xlr_push'); }catch(_e){ try{ sfx('hit'); }catch(__){} } }
    return n;
  }
  B.blastEnemies=blastEnemies;
  function fireCube(mode, held){
    if(typeof _tipField!=='function') return;
    if(mode==='push'&&blastCubes(held)) return;
    // measure from MIND's shoulder, not the jack tip, so a cube right against him still counts
    const tip=shoulder(), a=Math.atan2(p.aimDY,p.aimDX);
    let best=null, bd=1e9, bs=1e9;
    for(const bw of cubes()){
      if(bw.only==='laser') continue;
      if(mode==='push'&&bw.only==='pull') continue;
      if(mode==='pull'&&bw.only==='push') continue;
      const cx=bw.x+T/2, cy=bw.y+T/2;
      const f=_tipField(tip,a,cx,cy,CUBE.RANGE);
      if(!f) continue;
      const perp=f.dist*Math.sqrt(Math.max(0,1-f.align*f.align));   // prefer the cube right on the aim line
      const score=f.dist+perp*3;
      if(score>=bs) continue;
      if(!losClear(cx,cy,bw.homeCol,bw.homeRow)) continue;     // a wall (or another cube) is in the way
      bs=score; bd=f.dist; best=bw;
    }
    if(!best) return;
    const charge=Math.min(1,held/CUBE.CHARGE_FULL)*(B.relPow==null?1:B.relPow);   // weaker on a low power bar
    if(charge<0.06){ best.shakeX=2; best.hitGlow=8; try{ sfxAt(best,'omniblock_chip'); }catch(e){} B.lastFire={mode, weak:true}; return; }
    const near=bd<=CUBE.NEAR?1:Math.max(0,1-(bd-CUBE.NEAR)/(CUBE.RANGE-CUBE.NEAR));
    const cells=Math.max(1,Math.min(4,Math.round(1+3*charge*near)));
    const ax=aimAxis();
    const sgn=mode==='push'?1:-1, dc=ax.dc*sgn, dr=ax.dr*sgn;
    const list=mode==='push'?lineFrom(best,dc,dr,mode):[best];
    best.hitGlow=16;
    if(mode==='push'){ best._sq=-0.16; best._sqV=0; best._sqAx=dc?'x':'y';            // the blast hits it: it gives a little first
      const hx=best.x+T/2-dc*T/2, hy=best.y+T/2-dr*T/2;
      for(let k=0;k<8;k++){ const a2=Math.atan2(dr,dc)+Math.PI+(Math.random()-0.5)*1.6; PFXS.push({x:hx,y:hy,vx:Math.cos(a2)*(1+Math.random()*2.5),vy:Math.sin(a2)*(1+Math.random()*2.5),life:12+Math.random()*8|0,maxLife:20,r:2,col:'#9fd8ff'}); } }
    if(!list){ best.shakeX=dc*5; best._sq=-0.22; try{ sfxAt(best,'omniblock_chip'); }catch(e){} B.lastFire={mode, blocked:true}; return; }
    for(const b of list) b.wedge=false;                 // once moved, a trapdoor block is just a cube
    // heavier lines travel less far: up to ~7 weight units go the full distance
    const lineW=list.reduce((w,b)=>w+weightOf('cube',b),0);
    const go=Math.max(1,Math.round(cells*Math.min(1,7/lineW)));
    B_CHAINS.push({list, dc, dr, left:go, cells:go});
    B.lastFire={mode, cells:go, charge:+charge.toFixed(2), dist:Math.round(bd), dc, dr, line:list.length, weight:lineW};
  }

  // ── Weight (Paulo: everything has its own weight). One unit ≈ one omni
  //   cube's third. MIND = wheel + box + head + fists. Used by the magnet's
  //   grip, how fast things fly when thrown, what a thrown thing does when it
  //   hits, and how MIND bounces (js/beta_feel.js).
  const WEIGHT={mind:{wheel:3, box:4, head:1.5, fists:1}, omni:3, push:5, pull:5, laser:4,
    seed:0.5, crystal:0.8, circle:6, square:8, flyer:4, object:3, b_circle:2, b_square:19, b_tri:7};   // by size (omni block = 3): A tiny, C heavier than MIND (9.5)
  WEIGHT.mindTotal=WEIGHT.mind.wheel+WEIGHT.mind.box+WEIGHT.mind.head+WEIGHT.mind.fists;
  B.WEIGHT=WEIGHT;
  function weightOf(kind,ref){
    if(kind==='cube') return WEIGHT[ref.only||'omni']||3;
    if(kind==='knowl') return ref.kind==='crystal'?WEIGHT.crystal:WEIGHT.seed;
    if(kind==='enemy') return WEIGHT[ref.type]||6;
    return WEIGHT.object;
  }
  B.weightOf=weightOf;

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
    // Paulo (Oct 21): give the cell back when it leaves — a cube tugged out of its cell by the
    // MAG / XLR used to leave that cell solid (an invisible wall where it had been)
    if(bw.homeCol!=null&&bw.homeRow!=null) gridSmashCell(bw.homeCol,bw.homeRow);
    bw.homeCol=bw.homeRow=bw.homeX=bw.homeY=null;
    B.flying.push(bw);
  }
  function flyTick(){
    for(let i=B.flying.length-1;i>=0;i--){
      const bw=B.flying[i];
      if(bw.hp<=0){ B.flying.splice(i,1); continue; }
      bw.vy=Math.min(bw.vy+GRAV,15); bw.vx*=0.995;
      if(B.inWater&&B.inWater(bw.x+T/2,bw.y+T/2)){ bw.vy=Math.min(bw.vy-GRAV*0.7,2.2); bw.vx*=0.93; bw.spin=(bw.spin||0)*0.9; }
      const steps=Math.max(1,Math.ceil(Math.max(Math.abs(bw.vx),Math.abs(bw.vy))/6));
      let ground=false;
      for(let s=0;s<steps;s++){
        const nx=bw.x+bw.vx/steps;
        if(boxHits(nx,bw.y)){ bw.vx=Math.abs(bw.vx)>2?-bw.vx*0.3:0; bw.spin=-(bw.spin||0)*0.5; try{ if(Math.abs(bw.vx)>1.2) sfxAt(bw,'omniblock_chip'); }catch(e){} }
        else bw.x=nx;
        const ny=bw.y+bw.vy/steps;
        if(boxHits(bw.x,ny)){
          if(bw.vy>0) ground=true;
          bw.vy=(bw.vy>3)?-bw.vy*0.25:0; bw.vx*=0.78;
        }else bw.y=ny;
      }
      bw.rot=(bw.rot||0)+(bw.spin||0); bw.spin=(bw.spin||0)*(ground?0.6:0.98);
      // a thrown cube hits by its momentum (weight × speed)
      const sp=Math.hypot(bw.vx,bw.vy), mom=sp*weightOf('cube',bw);
      if(sp>4) for(const e of ENEMS){
        if(!e.alive||e._betaHeld||!(typeof _enemyBodyPresent!=='function'||_enemyBodyPresent(e))) continue;
        if(ov(bw.x,bw.y,T,T,e.x,e.y,e.w,e.h)&&(e._cubeHitF||0)<=0){
          if(typeof _damageEnemy==='function') _damageEnemy(e,Math.round(4+mom*0.5),bw.x+T/2,bw.y+T/2,Math.min(2,weightOf('cube',bw)/weightOf('enemy',e)*2));
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
    knowlFlyTick();
  }

  // ── Knowls can be carried by the MAG and thrown; touching an enemy charges it
  const KR=11;
  function knowlFlyTick(){
    for(const k of KDROP){
      if(!k._fly) continue;
      k.vy=Math.min(k.vy+GRAV*0.8,12); k.vx*=0.99;
      if(B.inWater&&B.inWater(k.x,k.y)){ k.vx*=0.92; if(k.kind==='seed'){ k.vy=Math.max(k.vy-GRAV*1.6,-2.4); k._rest=0; } else k.vy=Math.min(k.vy-GRAV*0.6,1.6); }
      const nx=k.x+k.vx; if(solidPx(nx+Math.sign(k.vx)*KR,k.y)){ k.vx*=-0.4; } else k.x=nx;
      const ny=k.y+k.vy;
      if(solidPx(k.x,ny+KR)){ k.vy=k.vy>2?-k.vy*0.35:0; k.vx*=0.8; if(Math.abs(k.vx)<0.2&&Math.abs(k.vy)<0.3) k._rest=(k._rest||0)+1; }
      else if(solidPx(k.x,ny-KR)){ k.vy=Math.abs(k.vy)*0.3; }
      else { k.y=ny; k._rest=0; }
      knowlTouchesEnemy(k);
      if((k._rest||0)>6||(k._flyT=(k._flyT||0)+1)>600){
        k._fly=false; k._rest=0; k._flyT=0; k.vx=k.vy=0; k.px=k.py=0;
        const fy=typeof gridStandY==='function'?gridStandY(k.x,k.y+KR,{maxUp:8,maxDrop:T}):null;
        if(fy!=null&&k.kind==='seed') k.y=fy-15;
        k.ox=k.x; k.oy=k.y; k.got=false;
      }else{ k.ox=k.x; k.oy=k.y; }
    }
  }
  function knowlTouchesEnemy(k){
    for(const e of ENEMS){
      if(!e._betaEnemy||(e._knowlCd||0)>0) continue;
      if(!ov(k.x-KR,k.y-KR,KR*2,KR*2,e.x,e.y,e.w,e.h)) continue;
      energize(e,'knowl'); e._knowlCd=90;
      if(k._fly){ k.vx*=-0.5; k.vy=-2.5; }
    }
  }

  const LAITU_SCALE=1.75;                       // a bit taller than MIND
  const LAITU_TALK=['THEY TOOK THE ELDERS. FOLLOW THE SEEDS!','THE ARCH WANTS 3 CRYSTALS AND 6 SEEDS.',
    'YOUR HOME HIDES THE KNOWL TREE, MIND.','A MAGNET CAN CARRY WHAT A PUNCH CANNOT.',
    'THE XLR THROWS YOU BACK FROM WHERE YOU AIM.','KNOWLS WAKE ANYTHING UP. CAREFUL!'];

  // ── Magnet carry (Paulo): hold the MAG to lock things to the poles and carry
  //   them. Grip is a weight budget: full power holds 9 units = 3 omni cubes,
  //   or one enemy / pull block / knowl / object. As power drains the budget
  //   shrinks and the outer cubes slip off; the last thing held lets go only
  //   at 0%. Held things sit flush on the poles; letting go throws them with
  //   the swing of the arm — lighter things fly faster.
  const MAG={LOCK:104, DRAIN:0.45, GAME_DRAIN:1.55, ENH_DRAIN:1.0, THROW:1.25, MAXV:20, GRIP:9};
  const magCap=pw=>MAG.GRIP*Math.max(0,pw)/100;
  const heldWeight=()=>B.mag.held.reduce((s,h)=>s+weightOf(h.kind,h.ref),0);
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
  function throwVel(w){
    const h=B.mag.tips; let vx, vy;
    if(h.length<2){ vx=p.vx||0; vy=p.vy||0; }
    else{ const a=h[0], b=h[h.length-1], n=Math.max(1,h.length-1); vx=(b.x-a.x)/n*MAG.THROW; vy=(b.y-a.y)/n*MAG.THROW; }
    const k=Math.max(0.55,Math.min(1.5,Math.sqrt(3/Math.max(0.3,w||3))));   // heavy things leave slower
    vx*=k; vy*=k;
    const s=Math.hypot(vx,vy); if(s>MAG.MAXV){ vx*=MAG.MAXV/s; vy*=MAG.MAXV/s; }
    return {vx, vy};
  }
  function dropHeld(h){
    const v=throwVel(weightOf(h.kind,h.ref));
    if(h.kind==='cube') throwCube(h.ref, v.vx, v.vy);
    else if(h.kind==='knowl'){ const k=h.ref; k._carried=false; k._fly=true; k.vx=v.vx; k.vy=v.vy; k._rest=0; k._flyT=0; }
    else if(h.kind==='enemy'){
      const e=h.ref; e._betaHeld=false; e.og=false; e.vx=v.vx; e.vy=v.vy;
      e.mn=-1e6; e.mx=1e6; e._thrownF=60; e._reCenter=true;
      if(!e.alive) e._shutSettled=false;
      if(typeof _markEnemyItemForce==='function') _markEnemyItemForce(e,40);
    }else { h.ref._betaHeld=false; h.ref.vx=v.vx; h.ref.vy=v.vy; }
  }
  // rock right at the magnet's poles, along the (8-way) aim: {x,y,ux,uy} or null
  function rockAtTip(){
    const t=magTip(); let ax=p.aimDX||0, ay=p.aimDY||0; const l=Math.hypot(ax,ay); if(l<0.2) return null;
    const a=Math.round(Math.atan2(ay,ax)/(Math.PI/4))*(Math.PI/4), ux=Math.cos(a), uy=Math.sin(a);
    for(let k=-2;k<=12;k+=2){
      const x=t.x+ux*k, y=t.y+uy*k;
      for(const bw of cubes()) if(x>=bw.x-1&&x<=bw.x+T+1&&y>=bw.y-1&&y<=bw.y+T+1) return null;   // a cube first: grab it
      for(const m of (B.platforms||[])) if(x>=m.x&&x<=m.x+m.w&&y>=m.y&&y<=m.y+m.h) return null;
      if(typeof gridWorldSolid==='function'&&gridWorldSolid(x,y)) return {x,y,ux,uy};
    }
    return null;
  }
  // solid ground right under the wheel: grid rock — not a cube, a platform or a body
  function solidUnderWheel(){
    const cx=p.x+SW/2, feet=p.y+FEET_OFF;
    if(B.ridePlat||B.rideEnemy) return false;
    for(const bw of cubes()) if(cx>=bw.x-2&&cx<=bw.x+T+2&&feet>=bw.y-4&&feet<=bw.y+8) return false;
    return gridSolid(Math.floor(cx/T),Math.floor((feet+3)/T))||(typeof gridIsSlope==='function'&&gridIsSlope(Math.floor(cx/T),Math.floor((feet-2)/T)));
  }
  // the lock, drawn: magnetic field lines arcing out of the floor around the tip
  B.drawMagLock=function(){
    const L=B.magLock; if(!L) return;
    // field lines bloom out of the surface around the contact point, turned to face away from it
    const cx=sx(L.cx!=null?L.cx:magTip().x), cy=sy(L.cy!=null?L.cy:p.y+FEET_OFF), k=Math.min(1,L.t/10);
    const rot=Math.atan2(L.uy!=null?L.uy:1,L.ux!=null?L.ux:0)-Math.PI/2;
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot); ctx.lineWidth=Math.max(1.5,sw(2));
    for(let i=0;i<4;i++){
      const ph=((fr*0.06+i/4)%1), r=sw(10+ph*46), a=(1-ph)*0.8*k;
      ctx.strokeStyle='rgba(255,80,80,'+a+')'; ctx.beginPath(); ctx.ellipse(-sw(4),0,r,r*0.45,0,Math.PI,Math.PI*1.5); ctx.stroke();
      ctx.strokeStyle='rgba(90,140,255,'+a+')'; ctx.beginPath(); ctx.ellipse(sw(4),0,r,r*0.45,0,Math.PI*1.5,Math.PI*2); ctx.stroke();
    }
    const g=ctx.createRadialGradient(0,0,0,0,0,sw(30)); g.addColorStop(0,'rgba(255,240,255,'+(0.5*k)+')'); g.addColorStop(1,'rgba(160,120,255,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,sw(30),Math.PI,0); ctx.fill();
    ctx.restore();
  };
  // Paulo (Oct 22): the XLR's air shoves enemies in front of the jack while it's held, not only
  // on the release — strong up close, fading with distance, lighter ones fly further
  function blowAround(){
    if(typeof _tipField!=='function'||typeof _applyItemForceToEnemy!=='function') return;
    const tip=typeof xlrTip==='function'?xlrTip():shoulder(), a=Math.atan2(p.aimDY||0,p.aimDX||(p.fc?1:-1)), range=190;
    for(const e of ENEMS){
      if(!e||!e.alive||e._betaHeld||e._hidden) continue;
      const f=_tipField({x:tip.x,y:tip.y},a,e.x+e.w/2,e.y+e.h/2,range); if(!f) continue;
      const s=f.prox*f.cone*0.9*(0.25+0.75*powNow())*Math.max(0.5,Math.min(1.6,Math.sqrt(6/(weightOf('enemy',e)||6))));
      _applyItemForceToEnemy(e,f.ux*s,f.uy*s);
    }
  }
  function pullAround(){
    if(typeof _tipField!=='function') return;
    const tip=magTip(), a=Math.atan2(tip.uy,tip.ux), range=200;
    const force=(ox,oy)=>{
      const f=_tipField({x:tip.x,y:tip.y},a,ox,oy,range);
      if(!f) return null;
      const s=f.prox*f.cone*1.1*(0.2+0.8*powNow());          // a low bar pulls weakly
      return {fx:-f.ux*s, fy:-f.uy*s, s};
    };
    if(B.forceFrags) B.forceFrags(tip.x,tip.y,a,-1,0.9*(0.2+0.8*powNow()),range);   // enemy frags are drawn in too
    // Paulo (Oct 22): enemies answer the magnet right away — their velocity is steered straight
    // toward the poles (not nudged a little each frame and eaten by their walk)
    for(const e of ENEMS){
      if(!e._ai||e._betaHeld) continue;
      const f=force(e.x+e.w/2,e.y+e.h/2);
      if(!f||typeof _applyItemForceToEnemy!=='function') continue;
      if(e.alive){ const k=Math.min(1,f.s*3), sp=(4+10*k)*(0.3+0.7*powNow()), n=Math.hypot(f.fx,f.fy)||1, tvx=f.fx/n*sp, tvy=f.fy/n*sp-0.6*k;
        _applyItemForceToEnemy(e,(tvx-(e.vx||0))*0.6*Math.max(0.35,k),(tvy-(e.vy||0))*0.6*Math.max(0.35,k)); }
      else _applyItemForceToEnemy(e,f.fx*2.2,f.fy*2.2);
    }
    for(const bw of BWALLS){
      if(bw.hp<=0||bw._carried||bw.only==='push') continue;
      const f=force(bw.x+(bw.w||T)/2, bw.y+(bw.h||T)/2);
      if(!f||f.s<0.25) continue;
      if(bw._fly){ bw.vx=(bw.vx||0)+f.fx; bw.vy=(bw.vy||0)+f.fy; }
      else if(bw.cube&&f.s>0.45) throwCube(bw, f.fx*6, f.fy*6);
    }
    for(const c2 of (typeof CRATES!=='undefined'?CRATES:[])){
      const f=force(c2.x+c2.w/2,c2.y+c2.h/2);
      if(f){ c2.vx=(c2.vx||0)+f.fx; c2.vy=(c2.vy||0)+f.fy; }
    }
  }
  // ── Magnet suction + parking (Paulo, Oct 22) ──────────────────
  //   Near rock, the magnet's pull reaches out in an arc in front of the poles and
  //   draws MIND to the surface (strong up close, fading with distance — enough to
  //   lift him to a ceiling); it locks there with the poles flush and drains power.
  //   Switch items while locked and the glove hand takes the cord from the magnet's
  //   base and plugs it into the top back of the box (the RCA's animation): he hangs
  //   from the magnet, power refills, the other items work. DOWN + JUMP lets go.
  const SUCK={R:150, K:1.05, MAXV:9};
  const PARK_FR=26, PARK_GRAB=0.3;
  function suction(){
    if(!(p.itemStamina>0)) return;
    const t=magTip(), a0=Math.atan2(t.uy,t.ux); let best=null;
    for(const da of [0,-0.32,0.32,-0.6,0.6]){
      const a=a0+da, ux=Math.cos(a), uy=Math.sin(a);
      for(let d=0; d<=SUCK.R; d+=5){
        const x=t.x+ux*d, y=t.y+uy*d;
        if(cubes().some(bw=>x>=bw.x&&x<=bw.x+T&&y>=bw.y&&y<=bw.y+T)) break;
        if(typeof gridWorldSolid==='function'&&gridWorldSolid(x,y)){ const w=d*(1+Math.abs(da)*0.8); if(!best||w<best.w) best={d,w,ux,uy,x,y}; break; }
      }
    }
    if(!best) return;
    const arc=Math.sin(Math.PI/2*Math.max(0,1-best.d/SUCK.R));          // the amplitude arc: strong close, gone at the edge
    const s=arc*SUCK.K*(0.35+0.65*powNow());
    p.vx+=best.ux*s; p.vy+=best.uy*s;
    if(best.uy<-0.3) p.vy-=GRAV*Math.min(1.25,arc*1.6)*(-best.uy);          // enough to beat gravity up to a ceiling
    const v=Math.hypot(p.vx,p.vy); if(v>SUCK.MAXV){ p.vx*=SUCK.MAXV/v; p.vy*=SUCK.MAXV/v; }
    if(best.uy<-0.3&&s>0.2) p.og=false;
    if(fr%2===0) PFXS.push({x:best.x-best.ux*4+(Math.random()-0.5)*20,y:best.y-best.uy*4+(Math.random()-0.5)*20,vx:-best.ux*2,vy:-best.uy*2,life:9,maxLife:9,r:1.5,col:Math.random()<0.5?'#ff5050':'#5080ff'});
  }
  // the poles meet the surface flush: aim straight into it, and slide him so the tip touches
  function seatLock(L){
    p.aimDX=L.ux; p.aimDY=L.uy;
    const t=magTip(), tx=L.cx-L.ux*3, ty=L.cy-L.uy*3;
    let dx=tx-t.x, dy=ty-t.y; const dl=Math.hypot(dx,dy); if(dl>24){ dx*=24/dl; dy*=24/dl; }
    L.x=p.x+dx; L.y=p.y+dy;
  }
  B.magPark=null;
  function parkStart(){
    const L=B.magLock; if(!L) return;
    p.aimDX=L.ux; p.aimDY=L.uy;
    const t=magTip(), pose=computeConnectorArmPose(p);
    B.magPark={st:'plug', t:0, px:L.x, py:L.y, ux:L.ux, uy:L.uy, cx:L.cx, cy:L.cy,
      bx:isFinite(pose.tipX)?pose.tipX:t.x-L.ux*26, by:isFinite(pose.tipY)?pose.tipY:t.y-L.uy*26, ang:Math.atan2(L.uy,L.ux)};
    B.magLock=null; p._swapHoldBlock=true;
  }
  function parkRelease(){
    const P=B.magPark; if(!P) return; B.magPark=null;
    try{ MV_BETA_AUDIO.magHum(false); sfx('omniblock_chip'); }catch(e){}
    p.og=false; p.vx=-P.ux*2.5; p.vy=P.uy>0.3?-5:(P.uy<-0.3?1.5:-2.5);
    for(let k=0;k<10;k++) PFXS.push({x:P.bx,y:P.by,vx:(Math.random()-0.5)*3,vy:(Math.random()-0.5)*3,life:12,maxLife:12,r:1.6,col:k%2?'#ff5050':'#5080ff'});
  }
  // the end of the cord the glove carries: magnet base → over the head → the socket
  B.magCordEnd=function(){
    const P=B.magPark; if(!P) return null;
    const S=typeof hookAttachWorld==='function'?hookAttachWorld():{x:p.x+SW/2,y:p.y};
    if(P.st!=='plug') return {x:S.x,y:S.y,k:1};
    const k=Math.min(1,P.t/PARK_FR);
    if(k<PARK_GRAB) return {x:P.bx,y:P.by,k:0,grab:true,gk:k/PARK_GRAB};
    const u=(k-PARK_GRAB)/(1-PARK_GRAB), e=u*u*(3-2*u), C={x:p.x+SW/2+(p.fc?-1:1)*4,y:S.y-62};
    return {x:(1-e)*(1-e)*P.bx+2*(1-e)*e*C.x+e*e*S.x, y:(1-e)*(1-e)*P.by+2*(1-e)*e*C.y+e*e*S.y, k:e};
  };
  function parkTick(){
    const P=B.magPark;
    if(Math.hypot(p.x-P.px,p.y-P.py)>160||(typeof _shutdownTimer!=='undefined'&&_shutdownTimer>0)){ B.magPark=null; try{ MV_BETA_AUDIO.magHum(false); }catch(e){} return false; }   // respawned / shut down
    if(ITEM===3&&p.magOn){                                  // back on the MAG and holding it: the hand takes the magnet again
      B.magLock={x:P.px,y:P.py,t:10,cx:P.cx,cy:P.cy,ux:P.ux,uy:P.uy}; B.magPark=null; return false; }
    P.t++;
    p.x=P.px; p.y=P.py; p.vx=0; p.vy=0; p.og=true;
    if(P.st==='plug'){
      p.itemStamina=Math.max(0,(p.itemStamina||0)-MAG.DRAIN*0.6);
      if(p.itemStamina<=0){ parkRelease(); return true; }      // out of power before the plug seated: he drops
      if(P.t>=PARK_FR){ P.st='parked'; p._plugArchT=12; try{ sfx('grap_attach'); MV_BETA_AUDIO.magClank(); }catch(e){} }
    }
    if(fr%5===0) PFXS.push({x:P.cx-P.ux*2+(Math.random()-0.5)*26*Math.abs(P.uy),y:P.cy-P.uy*2+(Math.random()-0.5)*26*Math.abs(P.ux),vx:(Math.random()-0.5),vy:-0.3-Math.random(),life:10,maxLife:10,r:1.5,col:Math.random()<0.5?'#ff5050':'#5080ff'});
    return true;
  }
  // Paulo (Oct 22): DOWN + JUMP lets go of the surface — parked, mid plug-in, or still
  // holding the MAG against it. Any other jump while stuck is swallowed.
  function lockRelease(){
    const L=B.magLock; if(!L) return; B.magLock=null; B.mag.noRelock=true;      // no re-grab until the button is let go
    try{ MV_BETA_AUDIO.magHum(false); sfx('omniblock_chip'); }catch(e){}
    p.og=false; p.vx=-L.ux*2.5; p.vy=L.uy>0.3?-5:(L.uy<-0.3?1.5:-2.5);
    for(let k=0;k<10;k++) PFXS.push({x:L.cx,y:L.cy,vx:(Math.random()-0.5)*3,vy:(Math.random()-0.5)*3,life:12,maxLife:12,r:1.6,col:k%2?'#ff5050':'#5080ff'});
  }
  B.parkInput=function(){                                  // runs before the game's own jump
    if(!(B.magPark||B.magLock)||typeof isJumpJ!=='function'||!isJumpJ()) return;
    const dn=typeof isDn==='function'&&isDn();
    if(dn){ if(B.magPark) parkRelease(); else lockRelease(); }
    OPT.binds.jump.forEach(c=>delete Kj[c]);
  };
  // the parked magnet and its cord (drawn in the world, behind MIND)
  B.drawMagPark=function(){
    const P=B.magPark; if(!P) return;
    const E=B.magCordEnd(), bx=sx(P.bx), by=sy(P.by), ex=sx(E.x), ey=sy(E.y);
    const back={x:bx-Math.cos(P.ang)*sw(6), y:by-Math.sin(P.ang)*sw(6)};
    const mx=(back.x+ex)/2, my=(back.y+ey)/2+sw(10);
    ctx.save(); ctx.lineCap='round';
    for(const [c,wd] of [['#120a1c',sw(7)],[p.hero==='venture'?'#7a2638':'#3c1670',sw(5)],[p.hero==='venture'?'#c04a5e':'#6a3cc8',sw(2)]]){
      ctx.strokeStyle=c; ctx.lineWidth=Math.max(1,wd); ctx.beginPath(); ctx.moveTo(back.x,back.y); ctx.quadraticCurveTo(mx,my,ex,ey); ctx.stroke(); }
    ctx.restore();
    try{ drawConnectorTip(bx,by,P.ang,0,3); }catch(e){}
    if(P.st==='parked'){ const k=0.5+0.5*Math.sin(fr*0.15); ctx.fillStyle='rgba(200,180,255,'+(0.18*k)+')'; ctx.beginPath(); ctx.arc(sx(P.cx),sy(P.cy),sw(14),0,Math.PI*2); ctx.fill(); }
  };
  const _origCycleMag=window._cycleItem;
  window._cycleItem=function(){
    const was=B.on&&ITEM===3&&!!B.magLock&&(p.itemStamina||0)>0;
    const r=_origCycleMag.apply(this, arguments);
    if(was&&ITEM!==3) parkStart();
    return r;
  };
  function magnetTick(){
    const M=B.mag;
    if(B.magPark&&parkTick()) return;
    const on=!!(p&&p.magOn&&ITEM===3);
    if(on){
      // the magnet keeps its own power while held (the game's 1.2/frame drain empties it in
      // about a second); carrying drains slower so you can actually walk somewhere.
      if(!M.wasOn){ M.power=Math.min(100,p.itemStamina+(typeof _itemEnhanced!=='undefined'&&_itemEnhanced[3]?MAG.ENH_DRAIN:MAG.GAME_DRAIN)); M.tips.length=0; }
      M.power=Math.max(0,M.power-MAG.DRAIN*(M.held.length?Math.max(0.6,heldWeight()/6):0.6));
      p.itemStamina=M.power;
    }
    M.wasOn=on; if(!on) M.noRelock=false;
    if(!on||p.itemStamina<=0){ if(B.magLock){ B.magLock=null; try{ MV_BETA_AUDIO.magHum(false); }catch(e){} } while(M.held.length) dropHeld(M.held.pop()); return; }
    pullAround();
    // Paulo: standing and aiming it straight down (DOWN held), the magnet locks
    // MIND to SOLID ground — nothing moves him (pushes, currents, slopes) until he
    // lets go of the button. On an omni / pull block it grabs the block instead
    // (the usual carry); on a moving platform or a body it doesn't lock.
    // …and the same in any of the 8 directions: whenever the magnet's poles meet
    // rock (a wall, a ceiling, the floor — on the ground or in the air) it locks
    // there until the button is let go. Cubes still get grabbed instead.
    if(M.noRelock&&!B.magLock) return;                       // let go with DOWN + JUMP: free until the button is released
    const hit=!B.magLock&&!M.held.length?(rockAtTip()||((typeof _itemDownAim==='function'&&_itemDownAim(p)&&_playerOnGround(p)&&solidUnderWheel())?{x:p.x+SW/2,y:p.y+FEET_OFF,ux:0,uy:1}:null)):null;
    if(B.magLock||hit){
      if(!B.magLock){
        B.magLock={x:p.x,y:p.y,t:0,cx:hit.x,cy:hit.y,ux:hit.ux,uy:hit.uy}; seatLock(B.magLock); while(M.held.length) dropHeld(M.held.pop()); B.shake=Math.max(B.shake||0,3);
        try{ MV_BETA_AUDIO.magClank(); MV_BETA_AUDIO.magHum(true); }catch(e){}
        for(let k=0;k<14;k++){ const a=Math.atan2(-hit.uy,-hit.ux)+(Math.random()-0.5)*Math.PI; PFXS.push({x:hit.x-hit.ux*2,y:hit.y-hit.uy*2,vx:Math.cos(a)*(1+Math.random()*3),vy:Math.sin(a)*(1+Math.random()*2.5),life:14+Math.random()*8|0,maxLife:22,r:1.5+Math.random()*1.5,col:k%2?'#ff5050':'#5080ff'}); }
      }
      B.magLock.t++;
      p.x=B.magLock.x; p.y=B.magLock.y; p.vx=0; p.vy=0; p.og=true; p.aimDX=B.magLock.ux; p.aimDY=B.magLock.uy;   // the arm stays on the surface
      if(fr%3===0){ PFXS.push({x:B.magLock.cx-B.magLock.ux*2+(Math.random()-0.5)*30*Math.abs(B.magLock.uy),y:B.magLock.cy-B.magLock.uy*2+(Math.random()-0.5)*30*Math.abs(B.magLock.ux),vx:(Math.random()-0.5)*1.2,vy:-0.4-Math.random()*1.2,life:12,maxLife:12,r:1.8,col:Math.random()<0.5?'#ff5050':'#5080ff'}); }
      return;
    }
    if(!M.held.length) suction();
    const tip=magTip();
    M.tips.push({x:tip.x,y:tip.y}); if(M.tips.length>6) M.tips.shift();
    // grip loosens as power falls: the outermost thing slips first; the last one holds until 0%
    if(M.held.length>1&&heldWeight()>magCap(p.itemStamina)+0.01){ dropHeld(M.held.pop()); try{ sfx('omniblock_chip'); }catch(e){} }
    // lock new things that come within reach of the poles (never through a wall)
    const onlyCubes=M.held.every(h=>h.kind==='cube');
    if(onlyCubes){
      let best=null, bd=MAG.LOCK;
      const reach=M.held.length?M.held.length*(T+1):0;   // the next cube locks onto the outer face
      const room=M.held.length?magCap(p.itemStamina)-heldWeight():MAG.GRIP;
      const consider=(kind,ref,cx,cy,c,r)=>{
        if(weightOf(kind,ref)>room+0.01) return;
        const dx=cx-tip.x, dy=cy-tip.y, dd=Math.hypot(dx,dy), d=dd-reach;
        if(d>=bd) return;
        if(dd>18&&(dx*tip.ux+dy*tip.uy)/dd<0.2) return;      // in front of the poles
        if(!losClear(cx,cy,c,r)) return;
        bd=d; best={kind,ref};
      };
      for(const bw of cubes()) if(!bw.only||bw.only==='pull') consider('cube',bw,bw.x+T/2,bw.y+T/2,bw.homeCol,bw.homeRow);
      if(!M.held.length){
        for(const e of ENEMS){ if(e.mind||(e.alive&&typeof _enemyBodyPresent==='function'&&!_enemyBodyPresent(e))) continue; consider('enemy',e,e.x+e.w/2,e.y+e.h/2); }
        for(const k of KDROP){ if(k.got&&!k._fly) continue; consider('knowl',k,k.x,k.y); }
        for(const c of CRATES) consider('object',c,c.x+c.w/2,c.y+c.h/2);
      }
      if(best){
        if(best.kind==='cube'){
          const r=best.ref; gridSmashCell(r.homeCol,r.homeRow);
          r.homeCol=r.homeRow=r.homeX=r.homeY=null;          // no home while carried (the game would keep re-opening it)
          r._carried=true; r._ox=r._oy=0; r.wedge=false;
        }else if(best.kind==='knowl'){
          const k=best.ref; k._carried=true; k._fly=false; k.got=true; k.w=22; k.h=22;
        }else{
          best.ref._betaHeld=true;
          if(best.kind==='enemy'){ best.ref._shutSettled=true; best.ref.mn=-1e6; best.ref.mx=1e6; }
        }
        M.held.push(best); M.lockedThisHold=true; p.flashF=Math.max(p.flashF||0,6);
        try{ sfx('hook_latch'); }catch(e){}
      }
    }
    // carry: the first thing sits flush on the poles, cubes stack outward along the aim
    let along=0;
    for(const h of M.held){
      const r=h.ref, w=h.kind==='knowl'?22:(r.w||T), hh=h.kind==='knowl'?22:(r.h||T);
      const half=Math.abs(tip.ux)*w/2+Math.abs(tip.uy)*hh/2;    // face-to-pole distance for this box
      const cx=tip.x+tip.ux*(along+half), cy=tip.y+tip.uy*(along+half);
      if(h.kind==='knowl'){ r.x=r.ox=cx; r.y=r.oy=cy; r.px=r.py=0; r.vx=r.vy=0; knowlTouchesEnemy(r); }
      else { r.x=cx-w/2; r.y=cy-hh/2; r.vx=0; r.vy=0; }
      if(h.kind==='enemy'){ r.shotCd=Math.max(r.shotCd||0,30); r.hitF=Math.max(r.hitF||0,2); }
      along+=half*2;
    }
  }
  B.magTip=magTip;

  const _origUpdateMAG=window.updateMAG;
  window.updateMAG=function(){ if(B.on) return; return _origUpdateMAG.apply(this, arguments); };
  const _origHit=window.applyPlayerHitFromEnemy;
  if(_origHit) window.applyPlayerHitFromEnemy=function(e){ if(B.on&&e&&(e._betaHeld||e._thrownF>0||B.rideEnemy===e)) return; return _origHit.apply(this, arguments); };
  // The game's XLR field shoves enemies too — not through walls in the beta.
  const _origItemForce=window._applyItemForceToEnemy;
  if(_origItemForce) window._applyItemForceToEnemy=function(e,fx,fy){
    if(B.on&&p&&e){ const hb=typeof _enemyItemHB==='function'?_enemyItemHB(e):e; if(!losClear(hb.x+hb.w/2,hb.y+hb.h/2)) return; }
    return _origItemForce.apply(this, arguments);
  };

  // ── Enemies (Paulo): a shut-down enemy refills its energy for 5 s and gets
  //   back up. The third shutdown keeps it down for good. A knowl touching an
  //   enemy (carried or thrown) charges it: full energy, up again if it was
  //   down, and its 3 shutdowns start over. The Knowl tree does the same to
  //   anything near it, MIND included.
  const REVIVE_FR=120,          // Paulo: rebooting takes 2 s
    SHUT_LIMIT_BETA=3, TREE_R=300;
  function energize(e,why){
    if(e._shorted) return;                                 // water shutdown stays down
    e._downs=0; e._permOff=false; e._pwrHits=0;
    if(!e.alive) revive(e); else e.hp=e.mhp;
    e._glowF=40;
    if(why==='knowl'){ try{ sfx('knowl_pickup'); }catch(_e){} }
  }
  B.energize=energize;
  function revive(e){
    e.alive=true; e.hp=e.mhp; e.shutF=0; e._shutSettled=false; e._mindOff=null; e._revT=0;
    e.hitF=8; e.vy=-3; e.og=false; e._glowF=40;
    if(e._reCenter||e.mn<-1e5){ e.mn=Math.floor(e.x-110); e.mx=Math.floor(e.x+e.w+110); e._reCenter=false; }
  }
  function enemyTick(){
    const tree=B.decor.find(d=>d.kind==='tree');
    const tx=tree?tree.x+T/2:null, ty=tree?tree.y-200:null;
    for(const e of ENEMS){
      if(!e._betaEnemy) continue;
      if(e._knowlCd>0) e._knowlCd--;
      if(e._glowF>0) e._glowF--;
      // count each fall
      if(e._wasAlive!==false&&!e.alive){ e._downs=(e._downs||0)+1; e._revT=0; B.stats.shutdowns++;
        if(e._downs>=SHUT_LIMIT_BETA){ e._permOff=true; B.stats.permOff++; } }
      e._wasAlive=e.alive;
      if(!e.alive&&!e._permOff&&!e._shorted&&!e._betaHeld){
        e._revT=(e._revT||0)+1;
        e.hp=Math.min(e.mhp,Math.ceil(e.mhp*e._revT/REVIVE_FR));     // the bar fills back up
        if(e._revT===REVIVE_FR-66) try{ sfxAt(e,'enemy_boot'); }catch(_e){}   // the boot sound swells up to the moment it comes back on
        if(e._revT>=REVIVE_FR) revive(e);
      }
      // patrol range follows a thrown enemy once it settles
      if(e._reCenter&&(e._thrownF||0)<=0&&e.alive&&e.og){ e.mn=Math.floor(e.x-110); e.mx=Math.floor(e.x+e.w+110); e._reCenter=false; }
      if(e._reCenter&&!e.alive&&e._shutSettled&&(e._thrownF||0)<=0){ e.mn=Math.floor(e.x-110); e.mx=Math.floor(e.x+e.w+110); e._reCenter=false; }
      if(tree&&Math.hypot(e.x+e.w/2-tx,e.y+e.h/2-ty)<TREE_R&&(!e.alive||e.hp<e.mhp||e._downs)) energize(e,'tree');
    }
    if(tree&&p&&Math.hypot(p.x+SW/2-tx,p.y+FEET_OFF-60-ty)<TREE_R&&p.hp<p.maxHp){
      p.hp=Math.min(p.maxHp,p.hp+1.5); if(typeof _syncLivesFromHp==='function') _syncLivesFromHp(p);
    }
  }

  // ── TRS cage blocks go off: a blast that hurts nearby cubes, enemies and
  //   MIND (never lethally) and sets off neighbouring cage blocks. The more
  //   blasts going at once, the harder each one hits.
  const BOOM={R:80, DMG:14, FUSE:7, WINDOW:30, MAX_P:34};
  function boomTick(){
    for(const bw of BWALLS){
      if(bw.only!=='laser') continue;
      if(bw._fuse>0&&--bw._fuse===0&&bw.hp>0) bw.hp=0;
      if(bw._wasUp!==false&&bw.hp<=0&&!bw._boomed){ bw._boomed=true; explode(bw); }
      bw._wasUp=bw.hp>0;
    }
    B.booms=B.booms.filter(t=>fr-t<BOOM.WINDOW);
    if(!B.booms.length){ B.chainHurtP=0; for(const e of ENEMS) e._chainHurt=0; }
  }
  function explode(bw){
    const cx=bw.x+bw.w/2, cy=bw.y+bw.h/2;
    if(bw.homeCol!=null) gridSmashCell(bw.homeCol,bw.homeRow);
    B.booms.push(fr); B.stats.booms++;
    const amp=1+0.35*(B.booms.length-1);                 // chain reactions hit harder
    B.blasts.push({x:cx,y:cy,t:0,amp});
    if(B.onBoom) B.onBoom(amp);
    B.shake=Math.max(B.shake||0,Math.min(14,6*amp));
    const dmg=BOOM.DMG*amp;
    for(const o of BWALLS){
      if(o===bw||o.hp<=0) continue;
      const d=Math.hypot(o.x+o.w/2-cx,o.y+o.h/2-cy); if(d>BOOM.R) continue;
      if(o.only==='laser'){ if(!(o._fuse>0)) o._fuse=BOOM.FUSE+((Math.random()*4)|0); continue; }
      if(o.cube&&!o.only){ o.hp=Math.max(0,o.hp-dmg*1.6); o.hitGlow=12; }
    }
    for(const e of ENEMS){
      if(!e.alive) continue;
      const d=Math.hypot(e.x+e.w/2-cx,e.y+e.h/2-cy); if(d>BOOM.R+30) continue;
      // a chain hurts, but never takes more than ~60% of an enemy's energy, and never the last of it
      const hit=Math.min(Math.round(dmg),Math.max(0,e.hp-1),Math.max(0,Math.round(e.mhp*0.6-(e._chainHurt||0))));
      if(hit>0&&typeof _damageEnemy==='function'){ _damageEnemy(e,hit,cx,cy,1.2); e._chainHurt=(e._chainHurt||0)+hit; }
    }
    if(p){
      const d=Math.hypot(p.x+SW/2-cx,p.y+FEET_OFF-50-cy);
      if(d<BOOM.R+30){
        const hit=Math.min(Math.round(dmg*0.6),Math.max(0,p.hp-1),Math.max(0,BOOM.MAX_P-(B.chainHurtP||0)));   // MIND: at most ~a third of his energy per chain
        B.chainHurtP=(B.chainHurtP||0)+hit;
        const k=1/(Math.max(20,d)), kx=(p.x+SW/2-cx)*k, ky=(p.y+FEET_OFF-50-cy)*k;
        if(hit>0&&typeof applyPlayerHit==='function') applyPlayerHit(kx*6*amp,ky*5*amp-2,hit);
        else { p.vx+=kx*6; p.vy+=ky*5-2; }
      }
    }
    for(let i=0;i<22;i++){ const a=Math.random()*Math.PI*2, sp=2+Math.random()*5*amp;
      PFXS.push({x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1.5,life:16+Math.random()*16|0,maxLife:32,r:2+Math.random()*3,col:i%3?'#ffd040':'#ff7020'}); }
  }

  // octave up, then +0.5% for each percent of this level's seeds already gathered
  function seedPitch(){
    let total=0, got=0;
    for(const k of KDROP){ if(k.kind!=='seed') continue; total++; if(k.got) got++; }
    const pct=total?got/total*100:0;
    return 2*(1+0.005*pct);
  }
  // ── Seeds: picked up by the whole body (they sit on the floor, below MIND's core)
  function seedPickups(){
    if(!p) return;
    const core=playerCoreHB(p), feet=p.y+FEET_OFF;
    for(const k of KDROP){
      if(k.got||k.kind!=='seed') continue;
      if(!ov(core.x-6,core.y,core.w+12,feet-core.y,k.x-11,k.y-11,22,22)) continue;
      k.got=true; kColl++;
      if(typeof healPlayerFromKnowl==='function') healPlayerFromKnowl();
      try{ sfx('knowl_seed', seedPitch()); }catch(e){}
      if(KDROP.every(o=>o.kind!=='seed'||o.got)){ B.seedsAllT=120; setTimeout(()=>{ try{ sfx('seeds_all'); }catch(e){} },380); }   // the whole set
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
      if(d.got) continue;
      const R=B.crateRect?B.crateRect(d):d; if(!R||!ov(bx,by,bw,bh,R.x,R.y,R.w,R.h)) continue;   // boxed: break it open first
      if(_itemUnlocked(d.item)&&!d.enhanced) continue;
      if(_collectItemDrop(d)){
        d.got=true;
        if(d._knocked){ if(typeof _itemTutorial!=='undefined') _itemTutorial=null; try{ sfx('knowl_pickup'); }catch(e){} }   // got his own jack back (no tutorial again)
        for(let pi=0;pi<14;pi++){ const ang=Math.random()*Math.PI*2, sp=1.6+Math.random()*3;
          PFXS.push({x:d.x+d.w*0.5,y:d.y+d.h*0.5,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-1.6,life:14+Math.random()*10|0,maxLife:24,r:2+Math.random()*2,col:'#e8b070'}); }
      }
    }
    const r=_mapRopePickup;
    const rR=r&&B.crateRect?B.crateRect(r):r;
    if(r&&rR&&!r.got&&!_ropePickupAnim&&!_itemUnlocked(1)&&ov(bx,by,bw,bh,rR.x,rR.y,rR.w,rR.h)){
      r.got=true; _grantPlayerItem(1);                    // (no cable drawn back to where it lay — Paulo, Oct 21)
      for(let pi=0;pi<14;pi++){ const ang=Math.random()*Math.PI*2, sp=2+Math.random()*4;
        PFXS.push({x:r.x+r.w*0.5,y:r.y+r.h*0.5,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-2,life:20+Math.random()*12|0,maxLife:32,r:2.5+Math.random()*3,col:'#ff8866'}); }
    }
  }

  // ── Per-frame rules (rides on updateKnowls, which runs every update) ──
  const _origUpdateKnowls=window.updateKnowls;
  window.updateKnowls=function(){
    if(B.on&&_gameState==='game'){ seedPickups(); cratePickups(); if(window.MV_BETA_AUDIO&&MV_BETA_AUDIO.ensure) MV_BETA_AUDIO.ensure(); }
    _origUpdateKnowls.apply(this, arguments);
    if(!B.on||_gameState!=='game') return;
    B.stats.frames++;
    const fresh=_unlockedMask&~B.lastMask; B.lastMask=_unlockedMask;
    if(fresh){ for(let i=0;i<4;i++) if(fresh&(1<<i)){ B.stats.items++; openPopup(i); break; } }
    cubeTick();
    boomTick();
    enemyTick();
    if(B.enemyAITick) B.enemyAITick();
    if(B.impactTick) B.impactTick();
    if(B.clipTick) B.clipTick();
    if(B.mirrorTick) B.mirrorTick();
    if(B.enemyRespawnTick) B.enemyRespawnTick();
    if(B.crateTick) B.crateTick();
    if(B.waterTick) B.waterTick();
    if(window.MV_BETA_AUDIO&&MV_BETA_AUDIO.hurtTick) MV_BETA_AUDIO.hurtTick();
    if(B.feelTick) B.feelTick();
    for(const e of ENEMS) if(e._thrownF>0) e._thrownF--;
    goalOpen=false;                                   // main.js must not zone-hop
    const n=counts();
    if(!B.open&&gateReady()){
      B.open=true;
      try{ sfx('unlock'); }catch(e){}
      if(typeof uiShowToast==='function') uiShowToast(B.tier>0&&B.echoNeed>0?'THE ECHO IS ANSWERED - THE ARCH IS OPEN':'THE ARCH IS OPEN'); try{ sfx('gate'); }catch(e){}
    }
    if(B.revisitNote>0) B.revisitNote--;
    // The pit: a hole. Falling down it shuts MIND down (a life) and he reboots
    // at the stage entrance (Paulo, Oct 20).
    if(p&&B.level){
      const bottom=(B.level.rows||B.level.h||62)*T;
      if((typeof _playerOnGround==='function'?_playerOnGround(p):p.og)&&!(B.inWater&&B.inWater(p.x+SW/2,p.y+FEET_OFF-8))&&!B.ridePlat&&fr%15===0) B.safe={x:p.x, y:p.y};
      if(p.y+FEET_OFF>=bottom-8&&_shutdownTimer<=0&&!B.contScreen&&!B.overT){   // reached the bottom of the map: down the hole
        B.shake=Math.max(B.shake||0,8); B.stats.hits++;
        p.hp=1; applyPlayerHit(0,0,9999);
        p.vy=0;
        if(typeof uiShowToast==='function') uiShowToast('FELL INTO THE PIT');
      }
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
    if(B.arriveCd>0) B.arriveCd--;
    if(B.open&&B.gate&&p&&!B.trans){
      const h=playerCoreHB(p), g=B.gate;
      if(ov(h.x,h.y,h.w,h.h,g.x,g.y,g.w,g.h)){
        const nx=LEVELS[B.stageId]&&LEVELS[B.stageId].next;
        if(!B.cleared){ B.cleared=true; openResults(); }
        else if(nx&&B.arriveCd<=0) travel(nx,'forward');
      }
    }
    // the arch MIND came in through leads back to the stage before
    const pv=LEVELS[B.stageId]&&LEVELS[B.stageId].prev;
    if(pv&&p&&!B.trans&&B.arriveCd<=0){
      const arch=B.decor.find(d=>d.kind==='arrival');
      if(arch){
        const h=playerCoreHB(p), goingLeft=K.KeyA||K.ArrowLeft||p.vx<-0.6;
        if(goingLeft&&ov(h.x,h.y,h.w,h.h,arch.x,arch.y,2*T-6,4*T)) travel(pv,'back');
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
      if(k.got&&!k._carried&&!k._fly) continue;
      if(k.kind==='crystal'){ if(D) D.crystal(k); }
      else if(k.kind==='echo'){ if(D) D.crystal(k,'echo'); }
      else if(D) D.seed(k);
    }
  };
  // Item pickups are labelled crates.
  const _origDrawItemDrops=window.drawItemDrops;
  window.drawItemDrops=function(){
    if(!B.on||!window.MV_BETA_DECOR) return _origDrawItemDrops.apply(this, arguments);
    for(const d of ITEM_DROPS) if(!d.got){ if(B.drawCrate) B.drawCrate(d); else MV_BETA_DECOR.itemCrate(d.item, d.x+d.w/2, d.y+d.h, d.enhanced); }
  };
  const _origDrawRope=window.drawRopePickup;
  window.drawRopePickup=function(){
    if(!B.on||!window.MV_BETA_DECOR) return _origDrawRope.apply(this, arguments);
    const r=_mapRopePickup; if(!r||r.got) return;
    if(B.drawCrate) B.drawCrate(r); else MV_BETA_DECOR.itemCrate(1, r.x+r.w/2, r.y+r.h, false);
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
    if(B.drawWorldExtras) B.drawWorldExtras();
    // shells on the arch fill in as crystals / seeds are gathered
    const n=counts(); let ci=0, si=0;
    for(const sh of B.shells){
      const filled=sh.slot==='crystal'?(ci++<n.crystals):(si++<n.seeds);
      const x=sx(sh.x), y=sy(sh.y), s=sw(11);
      ctx.lineWidth=2;
      if(sh.slot==='crystal'){
        ctx.beginPath(); ctx.moveTo(x,y-s); ctx.lineTo(x+s*0.7,y); ctx.lineTo(x,y+s); ctx.lineTo(x-s*0.7,y); ctx.closePath();
        ctx.fillStyle=filled?'#4cffa8':'rgba(40,40,60,0.35)'; ctx.fill(); ctx.strokeStyle=filled?'#103040':'#4a4a60'; ctx.stroke();
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
      const sq=bw._sq||0, X0=sx(x)+(bw.shakeX||0), Y0=sy(y)+(bw.shakeY||0), w0=sw(bw.w), h0=sw(bw.h);
      if(sq){ ctx.save(); const cx=X0+w0/2, cy=Y0+h0;                       // squash/stretch about its base
        if(bw._sqAx==='x') { ctx.translate(cx,cy); ctx.scale(1-sq,1+sq*0.7); ctx.translate(-cx,-cy); }
        else { ctx.translate(cx,cy); ctx.scale(1+sq*0.7,1-sq); ctx.translate(-cx,-cy); } }
      drawBetaBlock(bw.only||'omni', X0, Y0, w0, h0,
        bw.rot||0, bw.hp<bw.maxHp?1-bw.hp/bw.maxHp:0, bw.hitGlow||0);
      if(sq) ctx.restore();
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
    if(B.drawEnemyFx) B.drawEnemyFx();
    if(B.drawMagLock) B.drawMagLock();
    if(B.drawMagPark) B.drawMagPark();
    if(B.drawCrateChips) B.drawCrateChips();
    if(B.drawImpactFx) B.drawImpactFx();
    if(B.laitu&&typeof drawLaituFigure==='function'){
      const cx=sx(B.laitu.x), feet=sy(B.laitu.feet);
      if(cx>-60&&cx<W+60){
        ctx.imageSmoothingEnabled=true;
        const L=B.laitu;
        drawLaituFigure(cx, feet, sw(LAITU_SCALE), {faceR:(L.face||1)>0, walkPhase:L.moving?L.stepT:0});
        const top=Math.max(4,feet-sw(84*LAITU_SCALE));
        const zz=typeof camZoom==='number'?camZoom:1;          // drawn later on the (unzoomed) HUD pass
        B._laituTag={cx:cx*zz, top:top*zz, body:L.talkT>0?LAITU_TALK[L.line]:null, name:!L.met&&fr%48<36};
      }
    }
  };
  // The stage HUD goes on with the main HUD (the console's text layer, see console16.js)
  const _origDrawHUD=window.drawHUD;
  window.drawHUD=function(){
    if(B.on&&_gameState==='game'&&!(typeof _battleTestMode!=='undefined'&&_battleTestMode)&&!(typeof _runTestMode!=='undefined'&&_runTestMode)){
      drawTopBar(); drawBetaHud(); return;
    }
    const r=_origDrawHUD.apply(this, arguments);
    if(B.on&&_gameState==='game') drawBetaHud();
    return r;
  };
  // ── Top bar (Paulo, Oct 21): MIND's head + lives · HP with the power bar under it ·
  //   the four jacks as their tips, left to right XLR > RCA > TRS > MAG
  function hudHead(x,y,s,dim){                             // MIND's head: dark box, one big eye, black hat
    ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
    ctx.fillStyle=dim?'rgba(255,255,255,0.12)':'#1c1430'; uiRound(-11,-8,22,18,4); ctx.fill();
    ctx.fillStyle=dim?'rgba(255,255,255,0.14)':'#e8e0ff'; ctx.beginPath(); ctx.arc(0,1,6.5,0,Math.PI*2); ctx.fill();
    if(!dim){ ctx.fillStyle='#3a2a6a'; ctx.beginPath(); ctx.arc(1,1,3.4,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(1,1,1.6,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fillRect(-2,-2,1.6,1.6); }
    // his hat: the logo (render.js drawLogoHat)
    if(typeof drawLogoHat==='function') drawLogoHat(0,-10,32,1,dim?{col:'rgba(255,255,255,0.12)',inner:'rgba(255,255,255,0.05)',hi:'rgba(255,255,255,0.1)',noShadow:true,brimT:2.6,wall:2.2,crownH:8}:{col:'#000',inner:'#3a3150',hi:'#5a5070',noShadow:true,brimT:2.6,wall:2.2,crownH:8});
    else { ctx.fillStyle=dim?'rgba(255,255,255,0.12)':'#000'; ctx.fillRect(-13,-11,26,3); ctx.fillRect(-7,-18,14,8); }
    ctx.restore();
  }
  const JACK_ORDER=[2,1,0,3], JACK_NAMES=['TRS','RCA','XLR','MAG'];
  function drawTopBar(){
    const y0=4, h=60;
    uiPanel(6,y0,W-12,h,{r:14,alpha:0.78,flat:true,accent:'rgba(200,170,255,0.55)'});
    ctx.imageSmoothingEnabled=true;
    // MIND + lives
    const lost=B._lifeLostT>0&&(B._lifeLostT>>3)%2;
    hudHead(34,y0+31,1.35,false);
    drawText('x'+Math.max(0,B.lives|0), 54, y0+14, lost?'#ff6a7a':'#ffffff', 3);
    drawText('CONT '+(B.continues|0), 56, y0+42, '#c8b8ff', 1);
    // HP, and the power bar right under it
    const hx=118, low=p.hp<=PLAYER_HIT_DMG*2;
    drawText('HP',hx,y0+10,'#ffb0b8',2);
    uiBar(hx+36,y0+10,220,15,p.hp/p.maxHp,'#ff3c5a','#ffb04a',10,{pulse:low});
    // Paulo (Oct 21): the power bar is green
    const pw=Math.max(0,Math.min(100,p.itemStamina||0)), pc=pw>50?'#46e06a':(pw>20?'#ffa040':'#ff4a5a');
    drawText('PWR',hx,y0+33,pc,1);
    uiBar(hx+36,y0+32,220,9,pw/100,pc,pw>50?'#c8ffd0':pc,10,{pulse:pw<20});
    drawText(pw<1&&fr%16<8?'LOW':Math.round(pw)+'%',hx+262,y0+31,pc,1);
    // ...and a thin REEL bar under it: how much cord the RCA has paid out
    // (full = the longest cord, empty = reeled all the way in). Purple for MIND, red for Venture.
    if(_itemUnlocked(1)){
      const h=p.hook, ven=p.hero==='venture', rc=ven?'#ff4a5a':'#b070ff', rcHi=ven?'#ffb0b8':'#e0c8ff';
      const cmax=typeof CMAX==='number'?CMAX:400, rmin=typeof ROPE_RL_MIN==='number'?ROPE_RL_MIN:28;
      let f=0, live=false;
      if(h&&h.st==='on'){ f=Math.max(0,Math.min(1,((h.rl||0)-rmin)/(cmax-rmin))); live=true; }
      else if(h&&h.st==='ext'){ const a=typeof ropePlayerEndWorld==='function'?ropePlayerEndWorld():{x:p.x,y:p.y}; f=Math.max(0,Math.min(1,Math.hypot(h.ex-a.x,h.ey-a.y)/cmax)); live=true; }
      // the old ROPE meter on MIND lives here now: the bar warms to amber, then red and pulsing, as the cord nears its snap
      const strain=live&&h.st==='on'?Math.min(1,window.MV_ROPE_STRAIN||0):0;
      const bc=strain>0.75?'#ff4040':strain>0.45?'#ffc040':rc, bh=strain>0.45?'#fff0c0':rcHi;
      ctx.globalAlpha=live?1:0.45;
      drawText('REEL',hx,y0+45,bc,1);
      uiBar(hx+36,y0+45,220,5,f,bc,bh,3,{pulse:strain>0.75});
      ctx.globalAlpha=1;
    }
    // the jacks, drawn as their tips
    const icols=(typeof ICOLS!=='undefined'?ICOLS:[C.GREY,C.RED_L,C.SKY,C.LILAC]);
    JACK_ORDER.forEach((i,k)=>{
      const bx=hx+300+k*78, on=_itemUnlocked(i), cur=i===ITEM&&on, enh=typeof _itemEnhanced!=='undefined'&&_itemEnhanced[i];
      uiPill(bx,y0+8,70,44,{on:cur,col:icols[i]});
      ctx.save(); ctx.beginPath(); ctx.rect(bx+3,y0+10,64,40); ctx.clip();
      ctx.translate(bx+35,y0+30);
      if(!on) ctx.globalAlpha=0.18;
      ctx.scale(0.82,0.82);
      if(typeof drawConnectorTip==='function') drawConnectorTip(i===3?-14:-16,0,0,0,i,enh);
      ctx.restore();
      if(!on){ ctx.fillStyle='rgba(10,6,24,0.35)'; uiRound(bx+2,y0+10,66,40,10); ctx.fill(); }
      if(on&&enh) uiSparkle(bx+62,y0+13,5,icols[i],0.9);
      if((i===2&&p.xlrOn)||(i===3&&p.magOn)){ ctx.fillStyle=(fr&4)?'#fff':icols[i]; ctx.beginPath(); ctx.arc(bx+62,y0+44,3,0,Math.PI*2); ctx.fill(); }
      if(cur) drawTextC(JACK_NAMES[i], bx+35, y0+h+2, '#ffffff', 1);
    });
    if(_nearKnowlTree(p)){ ctx.globalAlpha=0.6+0.4*Math.sin(fr*0.2); drawTextR('KNOWL TREE 2X',W-22,y0+40,C.MINT,1); ctx.globalAlpha=1; }
    if(Math.abs(p.vx)>0.3) drawTextR('SPD '+Math.round(Math.abs(p.vx)),W-22,y0+12,'#ece4ff',1);
    if(GP&&GP.pad) drawTextR('PAD',W-22,y0+26,C.GREEN,1);
    // the charge meter (sprint / duck / wall jump) under the bar
    const ch=_playerChargeInfo(p), cs=ch.chargeFrac;
    if((p.og&&cs>0)||p.duckBoostReady||p._wallChargeReady||p.wallGrip>0||ch.sprinting){
      const ready=p.duckBoostReady||p._wallChargeReady||ch.ready;
      uiBar(14,y0+h+8,130,10,cs,'#3ad07a',ready?'#d8ffb0':'#7dffcf',8,{pulse:ready});
    }
  }
  function drawLaituTag(){
    const tg=B._laituTag; B._laituTag=null; if(!tg) return;
    const {cx, top}=tg;
    if(tg.body){
      const txt=tg.body, tw=textW(txt,1)+28;
      ctx.save(); ctx.shadowColor='rgba(0,0,0,0.45)'; ctx.shadowBlur=8; ctx.shadowOffsetY=3;
      const bg=ctx.createLinearGradient(0,top-32,0,top-6); bg.addColorStop(0,'#fffaf0'); bg.addColorStop(1,'#f3e2c0');
      ctx.fillStyle=bg; uiRound(cx-tw/2, top-32, tw, 24, 12); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx-7,top-9); ctx.lineTo(cx+7,top-9); ctx.lineTo(cx,top-1); ctx.fill();
      ctx.restore();
      ctx.lineWidth=1.5; ctx.strokeStyle='#c09a5a'; uiRound(cx-tw/2+0.5, top-31.5, tw-1, 23, 11.5); ctx.stroke();
      ctx.save(); ctx.fillStyle='#3a2410'; ctx.font='15px "MV Pixel", monospace'; ctx.textAlign='center'; ctx.fillText(txt.toUpperCase(), cx, top-15); ctx.restore();
    }else if(tg.name) drawTextC('LAITU', cx, top-14, '#a8d4ff');
  }
  // Text that belongs to the world (signs, labels, crate names) is drawn on the
  // console's text layer, so it stays legible at the console's resolution.
  B.textQ=[];
  B.wtext=function(fn,...args){
    const C=window.MV_CONSOLE;
    if(C&&C.MODES&&C.MODES[C.mode]&&_gameState==='game') B.textQ.push([fn,args]); else fn(...args);
  };
  // little HUD versions of the pickups (beta_decor draws the real ones)
  function hudCrystal(x,y,on,all,i){                       // the hexagonal Knowl crystal, small
    ctx.save(); ctx.translate(x,y-1);
    const hex=()=>{ ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(4.5,-4); ctx.lineTo(4.5,4); ctx.lineTo(0,8); ctx.lineTo(-4.5,4); ctx.lineTo(-4.5,-4); ctx.closePath(); };
    hex();
    if(!on){ ctx.fillStyle='rgba(255,255,255,0.14)'; ctx.fill(); ctx.restore(); return; }
    if(all){ ctx.shadowColor='#5dffa0'; ctx.shadowBlur=10+4*Math.sin(fr*0.12+i); }
    const g=ctx.createLinearGradient(-4.5,-8,4.5,8);
    g.addColorStop(0,'hsla(150,85%,80%,0.9)'); g.addColorStop(0.5,'hsla('+((fr*1.5+i*60)%360).toFixed(0)+',90%,72%,0.75)'); g.addColorStop(1,'hsla(140,80%,40%,0.9)');
    ctx.fillStyle=g; ctx.fill(); ctx.shadowBlur=0;
    ctx.strokeStyle='#073a24'; ctx.lineWidth=1; ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(0,8); ctx.moveTo(-4.5,-4); ctx.lineTo(4.5,4); ctx.stroke();
    ctx.restore();
  }
  function hudSeed(x,y,on,all,i){
    ctx.save(); ctx.translate(x,y);
    ctx.beginPath(); ctx.moveTo(0,-8); ctx.bezierCurveTo(4,-3,5,1,0,5); ctx.bezierCurveTo(-5,1,-4,-3,0,-8); ctx.closePath();
    if(!on){ ctx.fillStyle='rgba(255,255,255,0.14)'; ctx.fill(); ctx.restore(); return; }
    if(all){ ctx.shadowColor='#7dffcf'; ctx.shadowBlur=10+4*Math.sin(fr*0.12+i); }
    ctx.fillStyle='#7dffcf'; ctx.fill(); ctx.shadowBlur=0;
    ctx.strokeStyle='#13684e'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(-1.2,-1.5,1,1.8,-0.4,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  function hudSetGlow(x,y,w,h,rgb){                       // a full set: a soft pulsing halo + a glint running along it
    const a=0.22+0.12*Math.sin(fr*0.1);
    ctx.save(); const g=ctx.createRadialGradient(x+w/2,y+h/2,2,x+w/2,y+h/2,w*0.7);
    g.addColorStop(0,'rgba('+rgb+','+a.toFixed(3)+')'); g.addColorStop(1,'rgba('+rgb+',0)');
    ctx.fillStyle=g; ctx.fillRect(x-10,y-8,w+20,h+16);
    const t=(fr*0.012)%1, gx=x+t*w;
    ctx.fillStyle='rgba(255,255,255,'+(0.7*Math.sin(t*Math.PI)).toFixed(3)+')'; ctx.fillRect(gx-1,y+h/2-6,2,12); ctx.fillRect(gx-6,y+h/2-1,12,2);
    ctx.restore();
  }
  function drawBetaHud(){
    if(B.textQ.length){ if(typeof _worldZoomBegin==='function') _worldZoomBegin(); try{ for(const [fn,args] of B.textQ) fn(...args); } finally{ if(typeof _worldZoomEnd==='function') _worldZoomEnd(); } } B.textQ.length=0;
    drawLaituTag();
    const n=counts();
    uiPanel(8, H-58, 560, 50, {r:14, alpha:0.78, flat:true, accent:'rgba(200,170,255,0.55)'});
    drawText(B.stageName, 22, H-52, '#c8b8ff', 1);
    drawTextR(fmtTime(B.stats.frames), 190, H-52, '#ffffff', 1);
    if(ITEM===3&&p){
      const pw=Math.max(0,Math.min(100,p.itemStamina||0)), held=B.mag.held.length, cap=magCap(pw);
      uiBar(206,H-50,150,9,pw/100,'#e0c040',pw>66?'#ff4860':'#ff9a3a',3);
      drawText('MAG '+Math.round(pw)+'%  GRIP '+cap.toFixed(1)+'/9'+(held?'  HOLDING '+held:''), 364, H-52, C.SILVER, 1);
    }else if(ITEM===2&&p&&B.chX>0){
      const c=Math.min(1,B.chX/45);
      uiBar(206,H-50,150,9,c,'#4466ff',c>=1?'#e0f4ff':'#88aaff',0,{pulse:c>=1});
      drawText(c>=1?'XLR FULL POWER':'XLR CHARGING', 364, H-52, C.SILVER, 1);
    }
    // crystals + seeds as little gems
    let gx=22; const gy=H-26;
    // Paulo (Oct 21): the same look and colour as the real pickups; a full set glows
    const cAll=n.crystals>=B.need.crystals, sAll=n.seeds>=B.need.seeds;
    const x0c=gx;
    for(let i=0;i<B.need.crystals;i++){ hudCrystal(gx+7,gy+3,i<n.crystals,cAll,i); gx+=20; }
    if(cAll) hudSetGlow(x0c-4,gy-10,gx-x0c+4,26,'90,255,160');
    drawText(n.crystals+'/'+B.need.crystals, gx+2, gy-6, '#5dffa0', 1); gx+=46;
    const x0s=gx;
    for(let i=0;i<B.need.seeds;i++){ hudSeed(gx+5,gy+3,i<n.seeds,sAll,i); gx+=14; }
    if(sAll) hudSetGlow(x0s-4,gy-10,gx-x0s+2,26,'125,255,207');
    drawText(n.seeds+'/'+B.need.seeds, gx+4, gy-6, '#7dffcf', 1);
    if(B.tier>0&&B.echoNeed>0){
      let ex=360; for(let i=0;i<B.echoNeed;i++){ const on=i<n.echo; ctx.save(); ctx.translate(ex+7,gy+2); ctx.rotate(Math.PI/4); ctx.fillStyle=on?'#ff9ae0':'rgba(255,255,255,0.14)'; if(on){ ctx.shadowColor='#ff9ae0'; ctx.shadowBlur=8; } ctx.fillRect(-5,-5,10,10); ctx.restore(); ex+=20; }
      drawText('ECHO '+n.echo+'/'+B.echoNeed, ex+2, gy-6, '#ff9ae0', 1);
    }
    if(B.revisitNote>0){
      const a=Math.min(1,B.revisitNote/30,(360-B.revisitNote)/20);
      ctx.save(); ctx.globalAlpha=Math.max(0,a);
      uiPanel(W/2-300,H*0.2,600,92,{r:18,sel:true,accent:'#ff9ae0'});
      drawTextC(B.stageName+' HAS CHANGED', W/2, H*0.2+16, '#ff9ae0', 2);
      drawTextC('NEW PATHS OPENED - THE ARCH WANTS '+B.echoNeed+' ECHO CRYSTALS', W/2, H*0.2+46, C.SILVER, 1);
      drawTextC('BRING WHAT YOU FOUND FURTHER ON', W/2, H*0.2+66, '#ffe39a', 1);
      ctx.restore();
    }
    if(B.open){ ctx.save(); ctx.globalAlpha=0.6+0.4*Math.sin(fr*0.15); drawTextR('ARCH OPEN!', 554, gy-8, C.GREEN_L||'#7dffcf', 2); ctx.restore(); }
    if(B.bounceT>0&&!B.open){
      const a=Math.min(1,B.bounceT/20), bw=Math.min(W-40,560), bx=(W-bw)/2, by=H*0.28;
      ctx.globalAlpha=a;
      uiPanel(bx,by,bw,96,{r:18,sel:true});
      if(B.tier>0&&B.echoNeed>0){
        drawTextC('NEW PATHS HAVE OPENED', W/2, by+16, '#ff9ae0', 2);
        drawTextC('FIND THE ECHO CRYSTALS', W/2, by+40, C.YELLOW, 2);
        drawTextC('ECHO CRYSTALS '+n.echo+'/'+B.echoNeed, W/2, by+70, C.SILVER, 1);
      }else{
      drawTextC('GATHER THE SEEDS & CRYSTALS', W/2, by+16, C.YELLOW, 2);
      drawTextC('TO PROCEED', W/2, by+40, C.YELLOW, 2);
      drawTextC('CRYSTALS '+n.crystals+'/'+B.need.crystals+'   SEEDS '+n.seeds+'/'+B.need.seeds, W/2, by+70, C.SILVER, 1);
      }
      ctx.globalAlpha=1;
    }
    // (no bars over the enemies: Paulo — their look already says it: red = hot, grey = off)
  };

  // ── Energy bars over the enemies: fill, plus pips for the shutdowns left
  function drawEnemyBars(){
    for(const e of ENEMS){
      if(!e._betaEnemy) continue;
      const show=!e.alive||e.hp<e.mhp||e._glowF>0||e._betaHeld;
      if(!show) continue;
      const x=sx(e.x+e.w/2), y=sy(e.y)-12, w=sw(44);
      if(x<-60||x>W+60||y<-20||y>H+20) continue;
      const f=Math.max(0,Math.min(1,e.hp/e.mhp));
      const ec=e._permOff?'#666':!e.alive?(fr%20<10?'#40c0ff':'#2a90d0'):f>0.5?'#40e070':f>0.25?'#e0b030':'#e04040';
      uiBar(x-w/2,y,w,6,f,ec,e._permOff?'#888':!e.alive?'#a0e8ff':f>0.5?'#b0ffb0':ec);
      const left=Math.max(0,SHUT_LIMIT_BETA-(e._downs||0));
      for(let i=0;i<SHUT_LIMIT_BETA;i++){ ctx.fillStyle=i<left?'#ffd040':'#3a3a3a'; ctx.beginPath(); ctx.arc(x-w/2+3+i*8,y-5,2.6,0,Math.PI*2); ctx.fill(); }
      if(e._permOff) drawTextC('OFF',x,y-16,'#888',1);
      else if(!e.alive) drawTextC('REBOOTING',x,y-16,'#7fd0ff',1);
      if(e._glowF>0){ ctx.globalAlpha=e._glowF/40*0.5; ctx.fillStyle='#7dffcf'; ctx.beginPath(); ctx.arc(x,sy(e.y+e.h/2),sw(e.w*0.8),0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }
    }
  }
  function fmtTime(frames){
    const t=frames/60, m=Math.floor(t/60), s=Math.floor(t%60), cs=Math.floor((t*100)%100);
    return m+':'+String(s).padStart(2,'0')+'.'+String(cs).padStart(2,'0');
  }
  B.fmtTime=fmtTime;

  // ── Item window: what you found and what it does (game pauses, slow music)
  // Controls named the SNES way (keyboard key in brackets): A jump · B item select · X run/use item · Y punch
  const ITEM_INFO=[
    {name:'TRS LASER CANNON', lines:['HOLD X (Q) TO CHARGE, LET GO TO FIRE.','THE LASER BREAKS OMNI BLOCKS AND THE GOLD','CAGE BLOCKS - CAREFUL, CAGES EXPLODE','AND SET EACH OTHER OFF!']},
    {name:'RCA GRAPPLING HOOK', lines:['PRESS X (Q) TO FIRE THE HOOK. IT BITES WALLS,','BLOCKS AND ENEMIES. UP / DOWN REEL IN AND OUT,','A JUMPS OFF. WATCH THE TENSION BAR:','PULL TOO HARD AND THE ROPE SNAPS.']},
    {name:'XLR PUSH JACK', lines:['HOLD X (Q) TO CHARGE, LET GO TO PUSH THE WHOLE','ROW OF BLOCKS YOU AIM AT. BLUE BLOCKS ONLY','MOVE FOR THE XLR. AIM AT THE FLOOR (DOWN + X):','HOLD TO HOVER, FULL POWER LAUNCHES YOU UP.']},
    {name:'MAG MAGNET', lines:['HOLD X (Q) TO GRAB AND CARRY: 3 OMNI BLOCKS, OR','1 RED PULL BLOCK, ENEMY OR KNOWL. THE GRIP','WEAKENS AS POWER DRAINS. SWING AND LET GO','TO THROW. B (E) SWITCHES ITEMS.']}
  ];
  B.ITEM_INFO=ITEM_INFO;
  // Paulo: the item card only comes up the first time you get that item
  // (kept for the play session; a new game from the title starts fresh)
  B.popupSeen=B.popupSeen||{};
  function openPopup(i){
    if(B.popupSeen[i]) return;
    B.popupSeen[i]=true;
    B.popup={item:i, t:0};
    if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.play('item',{restart:true,volume:0.8});
  }
  function closePopup(){
    B.popup=null;
    for(const k in K) delete K[k];
    if(typeof Kj!=='undefined') for(const k in Kj) delete Kj[k];
    if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.play(B.music);
  }
  function drawPopup(){
    const P=B.popup, a=Math.min(1,P.t/12);
    ctx.globalAlpha=a*0.75; ctx.fillStyle='#05030c'; ctx.fillRect(0,0,W,H); ctx.globalAlpha=a;
    const bw=Math.min(W-40,680), bh=380, bx=(W-bw)/2, by=(H-bh)/2-20+(1-a)*30;
    // light rays behind the window
    ctx.save(); ctx.translate(W/2,by+140); ctx.rotate(fr*0.004);
    for(let i=0;i<12;i++){ ctx.rotate(Math.PI/6); ctx.fillStyle='rgba(255,220,140,'+(0.05*a)+')'; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-60,-520); ctx.lineTo(60,-520); ctx.fill(); }
    ctx.restore();
    uiPanel(bx,by,bw,bh,{r:22,sel:true});
    drawTextC('YOU FOUND', W/2, by+22, '#c8b8ff', 1);
    const info=ITEM_INFO[P.item];
    uiLogo(info.name, W/2, by+40, 34, {sweep:200});
    const gl=ctx.createRadialGradient(W/2,by+150,0,W/2,by+150,110); gl.addColorStop(0,'rgba(255,230,160,0.35)'); gl.addColorStop(1,'rgba(255,230,160,0)'); ctx.fillStyle=gl; ctx.fillRect(W/2-120,by+40,240,220);
    // the crate, big, with the jack on its label
    if(window.MV_BETA_DECOR){
      ctx.save(); const cx=W/2, cy=by+142+Math.sin(fr*0.06)*3; ctx.translate(cx,cy); ctx.scale(1.8,1.8); ctx.translate(-cx,-cy);
      MV_BETA_DECOR.itemCrateScreen(P.item, cx, cy+20, true);
      ctx.restore();
    }
    info.lines.forEach((l,i)=>drawTextC(l, W/2, by+214+i*26, '#f4ecff', 2));
    if(P.t>40){ ctx.save(); ctx.globalAlpha=0.72+0.28*Math.sin(fr*0.1); drawTextC('PRESS A OR ENTER TO CONTINUE', W/2, by+bh-28, '#ffe39a', 1); ctx.restore(); }
    ctx.globalAlpha=1;
  }

  // ── Stage clear: fanfare, then the results with the score and the time
  function score(){
    const n=counts(), st=B.stats, secs=st.frames/60;
    const rows=[
      ['KNOWL SEEDS', n.seeds+' / '+B.need.seeds, n.seeds*100],
      ['KNOWL CRYSTALS', n.crystals+' / '+B.need.crystals, n.crystals*300],
      ['ITEMS FOUND', st.items+' / '+(B.itemsTotal||4), st.items*200],
      ['ENEMY SHUTDOWNS', String(st.shutdowns), st.shutdowns*50],
      ['ENEMIES OFF FOR GOOD', String(st.permOff), st.permOff*100],
      ['CAGE BLASTS', String(st.booms), st.booms*20],
      ['TIME BONUS', fmtTime(st.frames), Math.max(0,Math.round((480-secs)*5))],
      ['NO-HIT BONUS', st.hits+' HITS', st.hits===0?1000:st.hits<=2?400:0]
    ];
    const total=rows.reduce((s,r)=>s+r[2],0);
    const ach=[];
    if(secs<240) ach.push('SPEED RUNNER - UNDER 4:00');
    if(st.hits===0) ach.push('UNTOUCHED - NO HITS TAKEN');
    if(st.booms>=5) ach.push('DEMOLITION CREW - 5+ CAGE BLASTS');
    if(st.shutdowns===0) ach.push('GENTLE SOUL - NO ENEMY SHUT DOWN');
    if(st.permOff>=2) ach.push('LIGHTS OUT - 2 ENEMIES OFF FOR GOOD');
    if(st.items>=(B.itemsTotal||4)&&B.stageId==='1.1') ach.push('FULL KIT - ALL 4 JACKS');
    if(B.extraAch) for(const a of B.extraAch()) ach.push(a);
    const rank=total>=5000?'S':total>=4000?'A':total>=3000?'B':'C';
    let best=null;
    try{
      best=JSON.parse(localStorage.getItem('mv2.awdjoo'+B.stageId+'.best')||'null');
      const nb={time:best&&best.time<st.frames?best.time:st.frames, score:best&&best.score>total?best.score:total};
      localStorage.setItem('mv2.awdjoo'+B.stageId+'.best',JSON.stringify(nb));
    }catch(e){}
    return {rows,total,ach,rank,best,frames:st.frames};
  }
  function openResults(){
    B.results={t:0, sc:score(), music:false};
    if(window.MV_BETA_AUDIO){ MV_BETA_AUDIO.stopAll(); const ms=MV_BETA_AUDIO.fanfare(); B.results.musicAt=Math.round((ms||3000)/1000*60); }
  }
  function drawResults(){
    const R=B.results, a=Math.min(1,R.t/20), sc=R.sc;
    ctx.globalAlpha=a*0.85; ctx.fillStyle='#05030c'; ctx.fillRect(0,0,W,H); ctx.globalAlpha=a;
    const bw=Math.min(W-40,700), bh=Math.min(H-30,640), bx=(W-bw)/2, by=(H-bh)/2;
    uiPanel(bx,by,bw,bh,{r:22,sel:true});
    uiLogo('STAGE CLEAR!', W/2, by+16, 48, {sweep:180});
    drawTextC(B.stageName+'  \u00B7  '+String(B.stageSub), W/2, by+76, '#c8b8ff', 1);
    let y=by+100; const shown=Math.min(sc.rows.length,Math.floor(R.t/14));
    sc.rows.forEach((r,i)=>{
      if(i>=shown) return;
      if(i%2===0){ ctx.fillStyle='rgba(255,255,255,0.04)'; uiRound(bx+20,y-6,bw-40,26,8); ctx.fill(); }
      drawText(r[0], bx+34, y, '#f4ecff', 1); drawText(r[1], bx+bw*0.5, y, '#c8b8ff', 1);
      const pts=String(r[2]); drawTextR(pts, bx+bw-34, y-3, '#7dffcf', 2); y+=28;
    });
    if(shown>=sc.rows.length){
      const lg=ctx.createLinearGradient(bx+24,0,bx+bw-24,0); lg.addColorStop(0,'rgba(246,201,74,0)'); lg.addColorStop(0.5,'rgba(246,201,74,0.9)'); lg.addColorStop(1,'rgba(246,201,74,0)');
      ctx.fillStyle=lg; ctx.fillRect(bx+24,y,bw-48,2); y+=12;
      drawText('TOTAL', bx+34, y, '#ffe39a', 2); drawTextR(String(sc.total), bx+bw-34, y, '#ffe39a', 2); y+=34;
      const rk=Math.min(1,(R.t-sc.rows.length*14)/24), rs=1+2*(1-rk);
      ctx.save(); ctx.translate(W/2,y+30); ctx.scale(rs,rs); ctx.globalAlpha=rk;
      const rcol=sc.rank==='S'?['#fff6c8','#ffe080','#ffffff','#ff9a2a','#ffd040','#fff0a0']:sc.rank==='A'?['#ffe8ff','#ff9ad8','#ffffff','#a040d0','#e080ff','#ffd0f0']:null;
      drawTextR('RANK', -36, -12, '#c8b8ff', 2); uiLogo(sc.rank, 18, -38, 64, {pal:rcol||undefined, sweep:120});
      ctx.restore(); y+=70;
      if(sc.best) drawTextC('BEST TIME '+fmtTime(Math.min(sc.best.time,sc.frames))+'   BEST SCORE '+Math.max(sc.best.score,sc.total), W/2, y, C.SILVER, 1);
      y+=20;
      sc.ach.forEach(t=>{ const tw=textW(t,1); uiSparkle(W/2-tw/2-12,y+5,5,'#ffd040',0.9); drawTextC(t, W/2, y, '#ffd040', 1); y+=18; });
      const nx=LEVELS[B.stageId]&&LEVELS[B.stageId].next;
      if(R.t>sc.rows.length*14+60){ ctx.save(); ctx.globalAlpha=0.72+0.28*Math.sin(fr*0.1); drawTextC(nx?'PRESS A OR ENTER FOR AWDJOO TOWN '+nx:'PRESS A OR ENTER', W/2, by+bh-30, '#ffe39a', 1); ctx.restore(); }
    }
    ctx.globalAlpha=1;
  }

  // The end of what's built so far: a "to be continued" card, then the title.
  function drawEnding(){
    const t=B.ending.t, a=Math.min(1,t/40);
    ctx.save(); ctx.globalAlpha=a; ctx.fillStyle='#05020e'; ctx.fillRect(0,0,W,H);
    if(typeof _drawSnesStarfield==='function'){ ctx.globalAlpha=a*0.8; _drawSnesStarfield(); ctx.globalAlpha=a; }
    uiLogo('TO BE CONTINUED...', W/2, H*0.3, 56, {sweep:200});
    drawTextC('AWDJOO TOWN 1.3 IS ON THE WAY', W/2, H*0.3+96, '#c8b8ff', 2);
    const n=counts(), st=B.stats;
    drawTextC('THANKS FOR PLAYING MIND & VENTURE II', W/2, H*0.3+140, '#ffe39a', 2);
    if(t>90){ ctx.globalAlpha=0.72+0.28*Math.sin(fr*0.1); drawTextC('PRESS A, START OR ENTER', W/2, H-80, '#ffe39a', 1); }
    ctx.restore();
  }

  // Pause the world under the item window and the results; keys close them.
  window.addEventListener('keydown',ev=>{
    if(!B.on) return;
    const go=['Enter','Space','KeyQ','KeyE','Escape','NumpadEnter'].includes(ev.code);
    if(B.ending&&go&&B.ending.t>90){ ev.preventDefault(); B._endReq=true; return; }
    if(B.popup&&go&&B.popup.t>40){ ev.preventDefault(); B._closeReq=true; }
    else if(B.results&&ev.code==='Enter'&&B.results.t>B.results.sc.rows.length*14+60){
      ev.preventDefault();
      resultsNext();
    }
  },true);
  const _origUpdate=window.update;
  // pads (and the touch buttons) close windows too: A / X / B / START
  function padOk(){
    if(typeof readGamepad==='function') try{ readGamepad(); }catch(e){}
    const ok=!!(Kj['Space']||Kj['KeyQ']||Kj['KeyE']||Kj['Enter']||Kj['Escape']);
    if(typeof clkj==='function') clkj();
    return ok;
  }
  function resultsNext(){
    const nx=LEVELS[B.stageId]&&LEVELS[B.stageId].next;
    B.results=null;
    if(nx) travel(nx,'forward');
    else if(window.MV_STORY_STAGES){ saveStage(); B.ending={t:0}; if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.play('results',{restart:true,volume:0.7}); }
    else{ B.on=false; startBetaLab(B.stageId, B.carryMask, {fresh:true}).catch(err=>console.error('stage load failed',err)); }
  }
  // ── Lives + continues (Paulo, Oct 20): the game starts with 3 lives and 3
  //   continues. Every shutdown costs a life; MIND reboots at the stage
  //   entrance. Out of lives: CONTINUE? (3 more lives, back at the entrance).
  //   Out of continues: GAME OVER, back to the title.
  if(B.lives==null) B.lives=3; if(B.continues==null) B.continues=3;
  { const _o=window._campaignUsesLives; window._campaignUsesLives=function(){ return B.on?false:(_o?_o.apply(this,arguments):false); }; }   // the story stages count lives here, not with the old 5-shutdown rule
  B.newRun=function(){ B.lives=3; B.continues=3; B.contScreen=null; B.overT=0; };
  function livesTick(){
    const shut=_shutdownTimer>0;
    if(shut&&!B._shutWas){ B.lives=Math.max(0,B.lives-1); B._lifeLostT=90; }
    B._shutWas=shut;
    if(B._lifeLostT>0) B._lifeLostT--;
    if(!shut&&B.lives<=0&&!B.contScreen&&!B.overT){
      if(B.continues>0){ B.contScreen={t:0,sel:0}; try{ if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.stopAll(); }catch(e){} }
      else B.overT=1;
    }
  }
  function contInput(){
    if(typeof readGamepad==='function') try{ readGamepad(); }catch(e){}   // the pad drives this screen too
    const C=B.contScreen; C.t++;
    const up=Kj['ArrowUp']||Kj['KeyW']||Kj['ArrowLeft']||Kj['KeyA'], dn=Kj['ArrowDown']||Kj['KeyS']||Kj['ArrowRight']||Kj['KeyD'];
    if(up||dn){ C.sel=1-C.sel; try{ sfx('menu'); }catch(e){} }
    // A / Space / Enter / START (Esc) pick the highlighted answer; pad B (or E) answers NO
    const back=Kj['KeyE']&&!K['KeyE_kb'];
    if(C.t>30&&(Kj['Space']||Kj['Enter']||Kj['Escape']||back)){
      try{ sfx('confirm'); }catch(e){}
      if(back) C.sel=1;
      if(C.sel===0){
        B.continues--; B.lives=3; B.contScreen=null;
        if(typeof _respawnPlayer==='function') _respawnPlayer();
        if(window.MV_BETA_AUDIO&&B.music) MV_BETA_AUDIO.play(B.music,{restart:true});
      }else{ B.contScreen=null; B.overT=1; }
    }
    if(typeof clkj==='function') clkj();
  }
  function drawLivesScreens(){
    if(B.contScreen){
      const C=B.contScreen, a=Math.min(1,C.t/20);
      ctx.fillStyle='rgba(4,2,10,'+(0.75*a)+')'; ctx.fillRect(0,0,W,H);
      const pw=440, ph=230, px=W/2-pw/2, py=H/2-ph/2;
      uiPanel(px,py,pw,ph,{r:20});
      uiLogo('CONTINUE?',W/2,py+18,44,{sweep:150});
      drawTextC(B.continues+(B.continues===1?' CONTINUE LEFT':' CONTINUES LEFT'),W/2,py+78,'#c8b8ff',2);
      ['YES','NO'].forEach((it,i)=>{ const y=py+118+i*44, sel=i===C.sel;
        if(sel){ uiPanel(px+60,y-10,pw-120,38,{sel:true,r:12,flat:true}); uiCursor(px+82,y+9,9); }
        drawTextC(it,W/2,y,sel?'#ffe39a':'#c8b8ff',3); });
    }
    if(B.overT>0){
      const a=Math.min(1,B.overT/30);
      ctx.fillStyle='rgba(0,0,0,'+(0.85*a)+')'; ctx.fillRect(0,0,W,H);
      ctx.globalAlpha=a; uiLogo('GAME OVER',W/2,H/2-50,64,{sweep:200}); drawTextC('NO CONTINUES LEFT',W/2,H/2+30,'#c8b8ff',2); ctx.globalAlpha=1;
    }
  }
  window.update=function(){
    if(B.trans){ transTick(); return; }
    if(B.on&&B.contScreen){ contInput(); return; }
    if(B.on&&B.overT>0){ B.overT++; if(B.overT>200||(B.overT>60&&padOk())){ B.overT=0; if(!(B.storyGameOver&&B.storyGameOver())){ B.newRun(); quitToTitle(); } } return; }   // story: back to the slot's last save
    if(B.ending){ B.ending.t++; if((padOk()&&B.ending.t>90)||B._endReq){ B._endReq=false; quitToTitle(); } return; }
    if(B.on&&B.popup){ B.popup.t++; if((padOk()&&B.popup.t>40)||B._closeReq){ B._closeReq=false; closePopup(); } return; }
    if(B.on&&B.results){
      B.results.t++;
      if(!B.results.music&&B.results.t>=B.results.musicAt){ B.results.music=true; if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.play('results',{restart:true,volume:0.6}); }
      if(padOk()&&B.results.t>B.results.sc.rows.length*14+60) resultsNext();
      return;
    }
    const r=_origUpdate.apply(this, arguments);
    if(B.on&&_gameState==='game') livesTick();
    return r;
  };
  const _origDraw=window.draw;
  window.draw=function(){
    const sh=B.on&&B.shake>0.3?B.shake:0;
    if(sh){ ctx.save(); ctx.translate((Math.random()-0.5)*sh,(Math.random()-0.5)*sh); B.shake*=0.86; }
    try{ _origDraw.apply(this, arguments); } finally{ if(sh) ctx.restore(); }
    if(!B.on||_gameState!=='game') return;
    if(B.contScreen||B.overT>0){ drawLivesScreens(); return; }
    if(typeof _worldZoomBegin==='function') _worldZoomBegin();
    for(let i=B.blasts.length-1;i>=0;i--){                 // blast flashes + rings
      const b=B.blasts[i]; b.t++;
      const k=b.t/26, r=sw(20+70*k*Math.min(1.6,b.amp));
      ctx.globalAlpha=Math.max(0,1-k)*0.8; ctx.fillStyle='#fff2a0'; ctx.beginPath(); ctx.arc(sx(b.x),sy(b.y),r*0.55,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#ff9030'; ctx.lineWidth=sw(4); ctx.beginPath(); ctx.arc(sx(b.x),sy(b.y),r,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1;
      if(b.t>26) B.blasts.splice(i,1);
    }
    if(typeof _worldZoomEnd==='function') _worldZoomEnd();
    if(B.popup) drawPopup();
    if(B.results) drawResults();
    if(B.trans) drawTrans();
    if(B.ending) drawEnding();
  };
  const _origPlayBGM=window._playBGM;
  window._playBGM=function(type){
    if(B.on&&type==='game'&&window.MV_BETA_AUDIO){ MV_BETA_AUDIO.play(B.popup?'item':B.music); return; }
    return _origPlayBGM.apply(this, arguments);
  };
  const _origPlayerHit=window.applyPlayerHit;
  window.applyPlayerHit=function(){ if(B.on&&B.stats&&_shutdownTimer<=0) B.stats.hits++; return _origPlayerHit.apply(this, arguments); };
  B.openPopup=openPopup; B.openResults=openResults;

  B.onBoom=amp=>{ if(window.MV_BETA_AUDIO) MV_BETA_AUDIO.boom(amp); };
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
