// ============================================================
//  Mind & Venture — ui.js
//  All UI state, screen drawing, HUD, menus, story, cutscene,
//  zone management, game progress, stage designer helpers.
//
//  Depends on: save.js (OPT, BIND_ORDER, BIND_LABELS, _bindList),
//  audio.js (sfx, _playBGM, _stopBGM, _unlockAudio, ZONES,
//             _bgmVolFor, _pickAndSetGameMusic, _titleMusicPlaying),
//  physics.js (sx, sy, sw, camViewW, camViewH, camX, camY,
//              playerCoreHB, _nearKnowlTree, _playerChargeInfo),
//  player.js (p, p2, fr, win, ITEM, INAMES, _itemUnlocked,
//             _cycleItem, mkP, _heroChoice, _playerCount,
//             _unlockedMask, _resetItemProgress),
//  enemies.js (ENEMS, KDROP, kColl, kTotal, goalOpen,
//              ESHOTS, PFXS, BWALLS, CRATES,
//              _battleTestMode, _syncBattleHud, _battleActiveRival,
//              BATTLE_SPAWN_DEFS, _battleTestRound, _battleTestKills,
//              _battleTestDeaths, _battleWaitingRespawn,
//              _battleRespawnSecsLeft),
//  weapons.js (_resolvePlayerOutOfBwalls, updateBWalls),
//  main.js (ctx, W, H, C, drawText, drawTextC, drawTextR,
//            ditherRect, blit, mkSpr, wrapBitmapBlocks, smsHexQ,
//            smsProcessPainted, WW, WH, _spawnX, _spawnY,
//            GOALPL, _zoneIdx, _runTestMode, MOVE_BUILD, GP,
//            _stageDesignerMode, MPLAT, APLAT, TEST_MODE)
// ============================================================

// ── UI state ──────────────────────────────────────────────────
let _gameState='title';
let _cutscenePhase=0, _cutsceneFr=0, _cutscenePage=0;
let _stageScore=0, _stageDamageFree=true, _awdjooTutorial=true;
let _editorActive=false;
let _gameBeaten=false;
let _stageDesignerMode=false;
let _stageDesignSelIdx=0;
let _storyPage=0, _storyFr=0, _storyPageStartFr=0;
let _titleMenuIdx=0;
let _uiToast='', _uiToastFr=0;
let _zoneCardT=0;
let _levelSelIdx=0, _pendingZone=0;
let _optRow=0, _optRebinding=null;
let _playerCount=1;
let _heroChoice='mind';
let _selectStep=0;
let _playModeIdx=0;

const GAME_BEATEN_KEY='mv_game_beaten';
const CUSTOM_STAGES_KEY='mv_custom_stages';

// ── Game progress ─────────────────────────────────────────────
function _loadGameProgress(){
  try{ _gameBeaten=localStorage.getItem(GAME_BEATEN_KEY)==='1'; }catch(e){}
}
function _markGameBeaten(){
  if(_gameBeaten) return;
  _gameBeaten=true;
  try{ localStorage.setItem(GAME_BEATEN_KEY,'1'); }catch(e){}
}
_loadGameProgress();

// ── Custom stage library ──────────────────────────────────────
function getCustomStages(){ try{return JSON.parse(localStorage.getItem(CUSTOM_STAGES_KEY)||'[]');}catch(e){return[];} }
function saveCustomStages(list){ try{localStorage.setItem(CUSTOM_STAGES_KEY,JSON.stringify(list));}catch(e){} }
function _stageDesignItems(){
  const stages=getCustomStages();
  const items=[{label:'+ NEW STAGE',action:'new'}];
  stages.forEach((s,i)=>items.push({label:s.name,action:'stage',idx:i}));
  items.push({label:'BACK',action:'back'});
  return items;
}

// ── Toast notification ────────────────────────────────────────
function uiShowToast(msg){ _uiToast=msg; _uiToastFr=150; }
function edShowToast(msg){ uiShowToast(msg); }  // overridden in editor.js when active
function _drawUiToast(){
  if(_uiToastFr<=0) return;
  const a=Math.min(1,_uiToastFr/24);
  ctx.globalAlpha=a;
  ctx.fillStyle='rgba(6,12,10,0.88)';
  ctx.font='10px monospace';
  const tw=Math.max(200,ctx.measureText(_uiToast).width+28);
  ctx.fillRect(W/2-tw/2,H*0.62,tw,24);
  ctx.strokeStyle='rgba(88,208,176,0.45)'; ctx.lineWidth=1;
  ctx.strokeRect(W/2-tw/2+0.5,H*0.62+0.5,tw-1,23);
  drawTextC(_uiToast,W/2,H*0.62+7,C.MINT,2);
  ctx.globalAlpha=1;
  _uiToastFr--;
}

// ── Title menu ────────────────────────────────────────────────
function _titleMenuItems(){
  return [
    {label:'STORY MODE', activate:()=>startStoryMode()},
    {label:'TUTORIAL CHAMBER', activate:()=>{_gameState='tutorial';}},
    {label:'BATTLE PRACTICE', activate:()=>startBattleTest()},
    {label:'CREATIVE MODE', locked:!_gameBeaten, activate:()=>{_gameState='stagedesign';_stageDesignSelIdx=0;}},
    {label:'OPTIONS', activate:()=>{_gameState='options';_optRow=0;}},
  ];
}
function _titleMenuGeom(){
  const gw=1024, gh=768;
  const cx=gw/2, startY=Math.round(gh*0.50), lineH=34;
  const menu=_titleMenuItems();
  return menu.map((it,i)=>{
    const ty=startY+i*lineH;
    const lw=String(it.label).length*4;
    const w=Math.max(lw+64,248), h=28;
    return {label:it.label, locked:!!it.locked, activate:it.activate, x:cx-w/2, y:ty-h/2, w, h, ty};
  });
}
function _titleMenuClick(e){
  if(_gameState!=='title') return;
  _ensureTitleMusic();
  const c=document.getElementById('c');
  if(!c) return;
  const rect=c.getBoundingClientRect();
  if(!rect.width||!rect.height) return;
  const mx=(e.clientX-rect.left)*(1024/rect.width);
  const my=(e.clientY-rect.top)*(768/rect.height);
  const rows=_titleMenuGeom();
  for(let i=0;i<rows.length;i++){
    const r=rows[i];
    if(mx>=r.x&&mx<=r.x+r.w&&my>=r.y&&my<=r.y+r.h){ _titleMenuIdx=i; _titleMenuActivate(); return; }
  }
}
function _titleMenuActivate(){
  const menu=_titleMenuItems();
  const item=menu[_titleMenuIdx];
  if(!item) return;
  if(item.locked){ uiShowToast('BEAT STORY MODE TO UNLOCK CREATIVE MODE'); return; }
  item.activate();
}

// ── Options ───────────────────────────────────────────────────
function _optRowCount(){ return BIND_ORDER.length+3; }
function _optionsInput(ev){
  if(_gameState!=='options') return false;
  if(_optRebinding){ if(ev.back){_optRebinding=null;return true;} return true; }
  const n=_optRowCount();
  if(ev.back){_gameState='title';return true;}
  if(ev.up){_optRow=(_optRow+n-1)%n;return true;}
  if(ev.down){_optRow=(_optRow+1)%n;return true;}
  const dec=!!ev.left&&!ev.right, inc=!!ev.right&&!ev.left;
  if(_optRow===0&&(dec||inc||ev.confirm)){ OPT.musicMode=OPT.musicMode==='ost'?'psg':'ost'; _saveOpts();_switchMusicMode();return true; }
  if(_optRow===1&&(dec||inc)){ OPT.musicVol=Math.max(0,Math.min(1,OPT.musicVol+(inc?0.05:-0.05))); _saveOpts();_applyBgmVolumes();return true; }
  if(_optRow===2&&(dec||inc)){ OPT.sfxVol=Math.max(0,Math.min(1,OPT.sfxVol+(inc?0.05:-0.05))); _saveOpts();return true; }
  if(_optRow>=3&&ev.confirm){ _optRebinding=BIND_ORDER[_optRow-3]; return true; }
  return true;
}

// ── Story state ───────────────────────────────────────────────
const STORY_PAGES=[
  {title:"SONNATA: PEACE IN AWDJOO",col:'#9effbf',lines:["In Sonnata, in the town of Awdjoo,","a family spent a peaceful day at home.","For generations they protected a secret:","the sacred Knowl tree hidden in their basement."]},
  {title:"THE INVASION",col:'#ff8e9e',lines:["The evil Tradzkul invaded with his minions,","violently searching every room of the house.","They were hunting the sacred Knowl tree.","Awdjoo had never faced terror like this."]},
  {title:"SHUTDOWN",col:'#ffc38a',lines:["Mind & Venture's elders blocked the basement entrance.","Tradzkul's minions shut them down by force.","As Tradzkul pushed toward the basement,","he knocked the siblings unconscious."]},
  {title:"KIDNAPPED",col:'#cba7ff',lines:["Tradzkul kidnapped their elders,","then vanished into the night.","When Mind and Venture awoke,","they ran outside into the street."]},
  {title:"THE JOURNEY BEGINS",col:'#8ee6ff',lines:["Their neighbor Laitu warned:","\"They are long gone to Tradzkul's lair.\"","Knowl seeds marked the way — town, hills,","garden, cavern, factory, then the lair."]},
];
const STORY_ART=STORY_PAGES.map((_,i)=>{ const im=new Image(); im.src='assets/story/story-'+(i+1)+'.png'; return im; });
const STORY_ART_Q=[];
const TITLE_FRAME_N=12;
let TITLE_FRAMES=null;
let _titleAnimReady=false, _titleStaticReady=false;
const TITLE_STATIC=(()=>{ const im=new Image(); im.onload=()=>{_titleStaticReady=true;_initTitleFrames();}; im.onerror=()=>{console.warn('title-key-art.png failed');}; im.src='assets/story/title-key-art.png'; return im; })();
if(TITLE_STATIC.complete&&TITLE_STATIC.naturalWidth){ _titleStaticReady=true; _initTitleFrames(); }
function _initTitleFrames(){
  if(TITLE_FRAMES) return;
  TITLE_FRAMES=Array.from({length:TITLE_FRAME_N},(_,i)=>{
    const im=new Image();
    im.onload=()=>{ if(TITLE_FRAMES.every(f=>f.complete&&f.naturalWidth>0)) _titleAnimReady=true; };
    im.onerror=()=>{ console.warn('title-frame load failed:',im.src); };
    im.src='assets/story/title-frame-'+String(i).padStart(2,'0')+'.png';
    return im;
  });
}
function _titleBgImage(frame){
  if(!_titleAnimReady) _initTitleFrames();
  if(_titleAnimReady){ const idx=((Math.floor(frame/5)%TITLE_FRAME_N)+TITLE_FRAME_N)%TITLE_FRAME_N; const frIm=TITLE_FRAMES[idx]; if(frIm&&frIm.complete&&frIm.naturalWidth) return frIm; }
  if(_titleStaticReady&&TITLE_STATIC.naturalWidth) return TITLE_STATIC;
  return null;
}
const MAP_ART=(()=>{ const im=new Image(); im.src='assets/story/sonnata-map.png'; return im; })();

// ── Game state transitions ────────────────────────────────────
function startStoryMode(){
  _unlockAudio(); _clearBattleRespawnTimer();
  _battleTestMode=false; _syncBattleHud();
  _runTestMode=false; _stageDesignerMode=false;
  _gameState='story'; _storyPage=0; _storyFr=0;
  _stopBGM('title'); _playBGM('story',OPT.musicVol*0.55);
}
function _ensureTitleMusic(){
  if(_gameState!=='title') return;
  if(_titleMusicPlaying&&_openingAudioEl&&!_openingAudioEl.paused) return;
  _unlockAudio(); _playBGM('title',OPT.musicVol);
}
function startGame(){
  _unlockAudio();
  if(_gameState==='story'){
    _storyPage++; _storyFr=0;
    if(_storyPage>=STORY_PAGES.length){ _gameState='select'; _selectStep=0; _playModeIdx=_playerCount===2?1:0; }
  }else if(_gameState==='select'){
    if(_selectStep===0){
      if(_playModeIdx===2){uiShowToast('ONLINE CO-OP — COMING SOON');return;}
      _playerCount=_playModeIdx===0?1:2; _selectStep=1; return;
    }
    _gameState='game'; _stopBGM('story'); initWorld(); _playBGM('game',OPT.musicVol);
  }
}
function _startGameAtZone(idx){ _pendingZone=idx; _gameState='game'; _stopBGM('title'); initWorld(); _playBGM('game',OPT.musicVol); }
function _onInteract(e){
  _unlockAudio();
  if(_gameState==='title'){ _ensureTitleMusic(); if(e&&e.clientX!=null) _titleMenuClick(e); return; }
  if(_gameState==='cutscene'){ _advanceCutscene(); return; }
  if(_gameState==='story'||_gameState==='select') startGame();
}
document.addEventListener('click',_onInteract,false);
document.addEventListener('touchstart',e=>{ if(e.touches&&e.touches[0]) _onInteract(e.touches[0]); },{passive:true});
document.addEventListener('keydown',e=>{
  if(_gameState==='options'){
    if(_optRebinding){ if(e.code==='Escape'){_optRebinding=null;e.preventDefault();return;} OPT.binds[_optRebinding]=[e.code]; _saveOpts();_optRebinding=null;e.preventDefault();return; }
    _optionsInput({up:e.code==='ArrowUp'||e.code==='KeyW',down:e.code==='ArrowDown'||e.code==='KeyS',left:e.code==='ArrowLeft'||e.code==='KeyA',right:e.code==='ArrowRight'||e.code==='KeyD',confirm:e.code==='Enter'||e.code==='Space',back:e.code==='Escape'||e.code==='Backspace'});
    e.preventDefault();return;
  }
  if(_gameState==='title'){
    _ensureTitleMusic();
    if(e.code==='ArrowUp'||e.code==='KeyW'){_titleMenuIdx=(_titleMenuIdx+_titleMenuItems().length-1)%_titleMenuItems().length;e.preventDefault();return;}
    if(e.code==='ArrowDown'||e.code==='KeyS'){_titleMenuIdx=(_titleMenuIdx+1)%_titleMenuItems().length;e.preventDefault();return;}
    if(e.code==='Enter'||e.code==='Space'){_titleMenuActivate();e.preventDefault();return;}
    if(e.code==='F1'){startStoryMode();e.preventDefault();return;}
  }
  if(_gameState==='tutorial'){ if(e.code==='Escape'||e.code==='Backspace'||e.code==='Enter'||e.code==='Space'){_gameState='title';e.preventDefault();return;} return; }
  if(_gameState==='levels'){
    if(e.code==='Escape'||e.code==='Backspace'){_gameState='title';e.preventDefault();return;}
    if(e.code==='ArrowUp'||e.code==='KeyW'){_levelSelIdx=(_levelSelIdx+ZONES.length-1)%ZONES.length;e.preventDefault();return;}
    if(e.code==='ArrowDown'||e.code==='KeyS'){_levelSelIdx=(_levelSelIdx+1)%ZONES.length;e.preventDefault();return;}
    if(e.code==='Enter'||e.code==='Space'){_startGameAtZone(_levelSelIdx);e.preventDefault();return;}
    return;
  }
  if(_gameState==='stagedesign'){
    const items=_stageDesignItems();
    if(e.code==='Escape'||e.code==='Backspace'){_gameState='title';e.preventDefault();return;}
    if(e.code==='ArrowUp'||e.code==='KeyW'){_stageDesignSelIdx=(_stageDesignSelIdx+items.length-1)%items.length;e.preventDefault();return;}
    if(e.code==='ArrowDown'||e.code==='KeyS'){_stageDesignSelIdx=(_stageDesignSelIdx+1)%items.length;e.preventDefault();return;}
    const sel=items[_stageDesignSelIdx];
    if(e.code==='KeyP'&&sel&&sel.action==='stage'){_playCustomStage(getCustomStages()[sel.idx]);e.preventDefault();return;}
    if(e.code==='Enter'||e.code==='Space'){
      if(sel.action==='new') startStageDesignerNew();
      else if(sel.action==='stage') startStageDesignerEdit(getCustomStages()[sel.idx]);
      else if(sel.action==='back') _gameState='title';
      e.preventDefault();return;
    }
    return;
  }
  if(_gameState==='select'){
    if(e.code==='Escape'||e.code==='Backspace'){if(_selectStep===1){_selectStep=0;e.preventDefault();return;}_gameState='story';_storyPage=STORY_PAGES.length-1;e.preventDefault();return;}
    if(e.code==='ArrowLeft'||e.code==='KeyA'){if(_selectStep===0)_playModeIdx=(_playModeIdx+2)%3;else _heroChoice='mind';e.preventDefault();return;}
    if(e.code==='ArrowRight'||e.code==='KeyD'){if(_selectStep===0)_playModeIdx=(_playModeIdx+1)%3;else _heroChoice='venture';e.preventDefault();return;}
    if(e.code==='Enter'||e.code==='Space'){startGame();e.preventDefault();return;}
    return;
  }
  if(_gameState==='cutscene'){ if(e.code==='Enter'||e.code==='Space'||e.code==='KeyZ'){_advanceCutscene();e.preventDefault();} return; }
  if(_gameState==='title'||_gameState==='story'||_gameState==='cutscene'||_gameState==='tutorial'){_unlockAudio();_onInteract();return;}
},true);

// ── Zone management ───────────────────────────────────────────
function _enterZone(idx){
  _zoneIdx=Math.max(0,Math.min(ZONES.length-1,idx));
  _zoneCardT=220;
  _pickAndSetGameMusic();
  if(_gameState==='game'&&_audioUnlocked) _playBGM('game',_bgmVolFor('game'));
  win=false; goalOpen=false; ESHOTS=[]; PFXS=[];
  if(_zoneIdx===0){
    _ensureCampaignMapApplied();
    ENEMS=[]; CRATES=[];
    _restoreMapBWalls();
    _populateKnowlFromMap(); _initLaituFromMap();
    kColl=0; _stageScore=0; _stageDamageFree=true; _awdjooTutorial=true;
    _shutdownTimer=0;
    p=mkP(); _placePlayerAtSpawn(); _spawnMapEnemies(); _spawnMapCrates();
    if(typeof _setupAwdjooCampaignGoal==='function') _setupAwdjooCampaignGoal();
    else GOALPL={x:-999,y:0,w:1,h:1};
    console.info('MV zone0 boot:',ENEMS.length,'enemies,',KDROP.length,'knowls');
  }else{
    ENEMS=[]; CRATES=[]; _awdjooTutorial=false;
    _buildZonePlaceholder(_zoneIdx);
    GOALPL={x:WW-50,y:0,w:50,h:WH};
  }
  if(p2){p2.x=p.x+34;p2.y=p.y;p2.vx=0;p2.vy=0;p2.og=true;}
}

// ── Knowl sprite lives in render.js (_getKnowlSpr) ────────────

// ── Draw functions ────────────────────────────────────────────
function drawGoal(){
  const awdjooCampaign=_zoneIdx===0&&typeof _mapApplied!=='undefined'&&_mapApplied;
  if(kTotal<=0&&!awdjooCampaign) return;
  if(_zoneIdx===0&&_awdjooTutorial&&_laitu&&!_laitu.met){
    const lx=sx(_laitu.x+_laitu.w/2), ly=sy(_laitu.y)-sw(6);
    if(lx>-40&&lx<W+40){ drawTextC('MEET LAITU',lx,Math.max(8,ly),C.SAND); if(fr%24<12){ctx.fillStyle=C.WHITE;ctx.fillRect(lx,ly+10,1,1);} }
    return;
  }
  const g=_goalRect();
  if(g.x>camX+camViewW()+60||g.x+g.w<camX-60) return;
  const bx=sx(g.x), gw=Math.max(2,sw(g.w));
  const tall=g.h>camViewH()*0.4;
  if(tall){
    const pulse=(fr>>2)&1;
    for(let py=0;py<H;py+=2){
      const shimmer=((py+fr*2)>>3)&1;
      if(!goalOpen){ if(shimmer) continue; ctx.fillStyle=C.GREEN_D; ctx.fillRect(bx,py,gw,1); }
      else{ ctx.fillStyle=shimmer?(pulse?C.GREEN_L:C.MINT):(pulse?C.GREEN:C.GREEN_D); ctx.fillRect(bx,py,gw,2); }
    }
    if(goalOpen&&bx<W&&bx>-20){ drawTextC('EXIT',bx+(gw>>1),H-18,C.GREEN_L); if(fr%24<12){ctx.fillStyle=C.WHITE;ctx.fillRect(bx+(gw>>1),Math.round(H*0.45),1,1);ctx.fillRect(bx+(gw>>1),Math.round(H*0.55),1,1);} }
    else if(bx<W&&bx>-40){
      if(awdjooCampaign&&kTotal<=0&&!goalOpen) drawTextC('GET RCA',bx+(gw>>1),14,C.GREEN_L);
      else if(kTotal>0) drawTextC('KNOWL '+kColl+'/'+kTotal,bx+(gw>>1),14,C.GREEN_L);
    }
    return;
  }
  const by=sy(g.y), gh=sw(g.h);
  if(g.y>camY+camViewH()+40||g.y+g.h<camY-40) return;
  if(!goalOpen){
    ctx.fillStyle=C.GREEN_D;ctx.fillRect(bx,by,gw,gh); ditherRect(bx,by,gw,gh,C.BLACK,fr>>3);
    const lbl=(awdjooCampaign&&kTotal<=0)?'FIND RCA IN BASEMENT':('COLLECT '+(kTotal-kColl)+' KNOWL');
    drawTextC(lbl,bx+(gw>>1),by+(gh>>1)-2,C.GREEN_L);
  }
  else{ ctx.fillStyle=C.GREEN_D;ctx.fillRect(bx,by,gw,gh); ctx.fillStyle=fr%20<10?C.GREEN_L:C.GREEN;ctx.fillRect(bx,by,gw,2); drawTextC('GOAL',bx+(gw>>1),by+gh-7,C.GREEN_L); }
}

function drawHUD(){
  if(_battleTestMode){
    _syncBattleHud();
    const rivalE=_battleActiveRival();
    const isSignol=rivalE&&rivalE._battleSignol;
    const upcoming=BATTLE_SPAWN_DEFS[_battleTestRound%BATTLE_SPAWN_DEFS.length];
    const rebooting=!isSignol&&rivalE&&!rivalE.alive&&rivalE._mindOff==='rebooting';
    const waiting=!isSignol&&rivalE&&!rivalE.alive&&(rivalE._mindOff==='cooldown'||rivalE._mindOff==='shutdown');
    const rivalLabel=isSignol?'SIGNOL':((waiting&&!rebooting)?upcoming.shape:(rivalE?rivalE.shape:upcoming.shape)).toUpperCase();
    const signolWaiting=_battleWaitingRespawn();
    const secs=waiting&&rivalE&&rivalE._mindOff==='cooldown'?Math.max(1,Math.ceil((rivalE._cooldownEnd-Date.now())/1000)):(_battleWaitingRespawn()?_battleRespawnSecsLeft():0);
    ctx.fillStyle='rgba(8,4,16,0.72)'; ctx.fillRect(0,0,W,88);
    drawTextC('BATTLE PRACTICE',W/2,10,C.YELLOW,4);
    drawTextC('KILLS '+_battleTestKills+'    DEATHS '+_battleTestDeaths,W/2,38,C.WHITE,3);
    drawTextC('HP '+p.hp+' / '+p.maxHp,W/2,62,p.hp<=40?C.RED_L:C.MINT,3);
    if(rebooting){ drawTextC('RIVAL REBOOTING — HIT TO INTERRUPT',W/2,82,C.PURPLE_L,2); }
    else if(signolWaiting){ drawTextC('SIGNOL DOWN — NEXT IN '+secs+'s',W/2,82,C.ORANGE,3); }
    else if(waiting){ drawTextC('RIVAL OFF — REBOOT IN '+secs+'s',W/2,82,C.ORANGE,3); }
    else{ drawTextC('VS '+rivalLabel,W/2,82,C.GREY,2); drawTextC('WALK THROUGH BLUE ZONE FOR RANDOM RIVAL',W/2,H-14,C.SKY_L,2); }
    return;
  }
  ctx.fillStyle=C.VOID; ctx.fillRect(0,0,W,12);
  blit(_getKnowlSpr()[(fr>>4)&1],3,1);
  drawText(kTotal>0?kColl+'/'+kTotal:'-',13,3,goalOpen?C.GREEN_L:C.WHITE);
  if(_awdjooTutorial&&_zoneIdx===0) drawText('SC:'+_stageScore,188,3,_stageDamageFree?C.MINT:C.SAND);
  const hpSegs=10, hpFill=Math.round(p.hp/p.maxHp*hpSegs);
  for(let i=0;i<hpSegs;i++){ const low=p.hp<=PLAYER_HIT_DMG*2; ctx.fillStyle=i<hpFill?(low&&fr%16<8?C.RED_L:C.RED):C.GREY_D; ctx.fillRect(3+i*4,10,3,1); }
  if(_battleTestMode||_runTestMode) drawText('HP'+p.hp,28,3,p.hp<=40?C.RED_L:C.WHITE);
  const icols=[C.GREY,C.RED_L,C.SKY,C.LILAC];
  const inames=['TRS','RCA','XLR','MAG'];
  for(let i=0;i<4;i++){
    const bx=46+i*22, on=_itemUnlocked(i);
    if(i===ITEM&&on){ctx.fillStyle=icols[i];ctx.fillRect(bx-1,1,21,10);ctx.fillStyle=C.BLACK;ctx.fillRect(bx,2,19,8);}
    else{ctx.fillStyle=C.NAVY;ctx.fillRect(bx,2,19,8);}
    drawText(on?inames[i]:'-',bx+4,4,!on?C.GREY_D:(i===ITEM?icols[i]:C.GREY));
    if((i===2&&p.xlrOn)||(i===3&&p.magOn)){ctx.fillStyle=(fr&1)?C.WHITE:icols[i];ctx.fillRect(bx+16,3,2,2);}
  }
  if(_nearKnowlTree(p)&&fr%18<12){ drawText('KNOWL TREE 2X',138,4,C.MINT); }
  else if(ITEM===2||ITEM===3){
    const segs=Math.round(p.itemStamina/10);
    for(let i=0;i<10;i++){ctx.fillStyle=i<segs?(p.itemStamina>50?C.SKY:p.itemStamina>20?C.ORANGE:C.RED):C.GREY_D;ctx.fillRect(138+i*4,4,3,4);}
    if(p.itemStamina<1&&fr%16<8) drawText('LOW',182,4,C.RED_L);
  }
  if(TEST_MODE) drawText('TEST',W-36,3,C.GREEN_L);
  drawText('M'+MOVE_BUILD,4,H-10,C.MINT);
  if(_gameState==='game'&&Math.abs(p.vx)>0.3) drawText('SPD'+Math.round(Math.abs(p.vx)),W-58,3,C.WHITE);
  if(_runTestMode){ctx.fillStyle=C.BLACK;ctx.fillRect(W-108,1,106,10);drawText('RUN TEST',W-104,3,C.MINT);ctx.fillStyle=C.BLACK;ctx.fillRect(W-108,12,106,8);const sc=Math.round((p.suspComp||0)*100);drawText('SUSP'+sc+'%  TAB=RESET',W-104,13,C.GREY);}
  if(GP&&GP.pad) drawText('GP',W-14,3,C.GREEN);
  const prog=Math.max(0,Math.min(1,1-(p.y-360)/WH));
  ctx.fillStyle=C.BLACK;ctx.fillRect(W-2,12,2,H-12);
  const ph2=Math.round((H-12)*prog);
  ctx.fillStyle=C.GREEN;ctx.fillRect(W-2,H-ph2,2,ph2);
  const _ch=_playerChargeInfo(p), _chargeShow=_ch.chargeFrac;
  if((p.og&&_chargeShow>0)||p.duckBoostReady||p._wallChargeReady||p.wallGrip>0||_ch.sprinting){
    const ready=p.duckBoostReady||p._wallChargeReady||_ch.ready;
    const segs=Math.round(_chargeShow*8);
    for(let i=0;i<8;i++){ctx.fillStyle=i<segs?(ready?C.GREEN_L:C.GREEN):C.BLACK;ctx.fillRect(3+i*4,14,3,3);}
  }
}

function drawOptions(){
  ctx.fillStyle='#04020a'; ctx.fillRect(0,0,W,H);
  const padX=80, panelW=W-padX*2, rowH=36, scl=2;
  const rows=[{label:'MUSIC STYLE',val:OPT.musicMode==='ost'?'NEW MUSIC':'PSG'},{label:'MUSIC VOLUME',val:Math.round(OPT.musicVol*100)+'%'},{label:'SFX VOLUME',val:Math.round(OPT.sfxVol*100)+'%'}];
  BIND_ORDER.forEach(a=>rows.push({label:BIND_LABELS[a].toUpperCase(),val:_bindList(a)}));
  const panelH=rows.length*rowH+80, panelY=Math.max(24,Math.round((H-panelH)/2));
  ctx.fillStyle='rgba(6,12,10,0.9)'; ctx.fillRect(padX,panelY,panelW,panelH);
  ctx.strokeStyle='rgba(88,208,176,0.45)'; ctx.lineWidth=1; ctx.strokeRect(padX+0.5,panelY+0.5,panelW-1,panelH-1);
  drawTextC('OPTIONS',W/2,panelY+16,C.MINT,3);
  let y=panelY+52;
  rows.forEach((r,i)=>{
    const sel=i===_optRow;
    if(sel){ctx.fillStyle='rgba(24,72,48,0.82)';ctx.fillRect(padX+20,y-6,panelW-40,rowH-8);ctx.strokeStyle=C.GLOW_L;ctx.lineWidth=1;ctx.strokeRect(padX+21,y-5,panelW-42,rowH-10);}
    if(sel) drawText('>',padX+28,y,C.WHITE,scl);
    drawText(r.label,padX+48,y,sel?C.WHITE:C.MINT,scl);
    drawTextR(r.val,padX+panelW-28,y,sel?C.WHITE:C.GREEN_L,scl);
    y+=rowH;
  });
  const footY=panelY+panelH-28;
  if(_optRebinding){if(fr%16<12) drawTextC('PRESS A KEY FOR '+BIND_LABELS[_optRebinding].toUpperCase(),W/2,footY,C.SAND,2);}
  else drawTextC('UP/DOWN: SELECT   LEFT/RIGHT: ADJUST   A/ENTER: OK   B/ESC: BACK',W/2,footY,C.GREY,2);
}

function drawAtmosphere(){
  for(let i=0;i<6;i++){
    const inset=i*2;
    ctx.fillStyle=i<2?C.VOID:C.SHADE;
    ctx.fillRect(inset,i,W-inset*2,1); ctx.fillRect(inset,H-1-i,W-inset*2,1);
    if(i<4){ctx.fillRect(i,inset,1,H-inset*2);ctx.fillRect(W-1-i,inset,1,H-inset*2);}
  }
}

function drawDamageOverlay(){
  if(_gameState!=='game'||!p) return;
  const hpFrac=Math.max(0,Math.min(1,p.hp/Math.max(1,p.maxHp)));
  const lost=1-hpFrac;
  if(lost<0.02&&_healFrac>=0.98) return;
  const persist=Math.pow(lost,0.85)*0.58;
  const hitPulse=Math.max(0,(1-_healFrac)-lost)*0.42;
  const dark=Math.min(0.78,persist+hitPulse);
  if(dark<0.04) return;
  ctx.save(); ctx.globalCompositeOperation='source-over';
  ctx.fillStyle='rgba(2,0,8,'+dark.toFixed(3)+')'; ctx.fillRect(0,0,W,H);
  const vigBands=Math.round(4+lost*10+hitPulse*6);
  for(let b=0;b<vigBands;b++){
    const a=Math.min(0.55,dark*0.55+b*0.04);
    ctx.fillStyle='rgba(0,0,0,'+a.toFixed(3)+')';
    const inset=b*3;
    ctx.fillRect(inset,b*2,W-inset*2,2); ctx.fillRect(inset,H-2-b*2,W-inset*2,2);
    if(b<6){ctx.fillRect(b,inset,2,H-inset*2);ctx.fillRect(W-2-b,inset,2,H-inset*2);}
  }
  ctx.restore();
}

function _titleBgRect(im){
  if(!im||!im.complete||!im.naturalWidth) return null;
  const s=Math.max(W/im.naturalWidth,H/im.naturalHeight);
  const w=Math.round(im.naturalWidth*s), h=Math.round(im.naturalHeight*s);
  return {dx:(W-w>>1),dy:(H-h>>1),w,h};
}
function drawTitle(){
  ctx.fillStyle='#04020a'; ctx.fillRect(0,0,W,H);
  const im=_titleBgImage(fr), ar=_titleBgRect(im);
  if(ar){ ctx.imageSmoothingEnabled=true; if(ctx.imageSmoothingQuality) ctx.imageSmoothingQuality='high'; ctx.drawImage(im,ar.dx,ar.dy,ar.w,ar.h); }
  else if(!_titleStaticReady){ drawTextC('LOADING...',W/2,H/2-4,C.GREY); if(!TITLE_STATIC.complete) _initTitleFrames(); }
  else{ ctx.fillStyle=C.VOID;ctx.fillRect(0,0,W,64);ctx.fillStyle=C.TEAL_D;ctx.fillRect(0,64,W,H-64);drawTextC('MIND & VENTURE',W/2,48,C.TEAL_L,2); }
  ctx.globalAlpha=1;
  const rows=_titleMenuGeom();
  const panelX=W/2-152, panelY=rows[0].y-12, panelW=304;
  const panelH=rows[rows.length-1].y+rows[rows.length-1].h-rows[0].y+24;
  ctx.fillStyle='rgba(6,12,10,0.72)'; ctx.fillRect(panelX,panelY,panelW,panelH);
  ctx.strokeStyle='rgba(88,208,176,0.35)'; ctx.lineWidth=1; ctx.strokeRect(panelX+0.5,panelY+0.5,panelW-1,panelH-1);
  for(let i=0;i<rows.length;i++){
    const r=rows[i], sel=i===_titleMenuIdx, locked=!!r.locked;
    if(sel&&!locked){ctx.fillStyle='rgba(24,72,48,0.82)';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.strokeStyle=C.GLOW_L;ctx.lineWidth=2;ctx.strokeRect(r.x+1,r.y+1,r.w-2,r.h-2);drawText('>',r.x+10,r.ty-5,C.WHITE,2);}
    else if(sel&&locked){ctx.fillStyle='rgba(32,24,32,0.82)';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.strokeStyle=C.GREY_D;ctx.lineWidth=1;ctx.strokeRect(r.x+1,r.y+1,r.w-2,r.h-2);}
    const col=locked?(sel?C.GREY:C.GREY_D):(sel?C.WHITE:C.MINT);
    drawTextC(r.label,W/2,r.ty,col,2);
    if(locked) drawTextC('BEAT STORY TO UNLOCK',W/2,r.ty+10,C.GREY_D,1);
  }
  _drawUiToast();
  if(!_titleMusicPlaying&&fr%36<24) drawTextC('CLICK OR PRESS ENTER',W/2,H*0.66,C.GREY);
  drawTextC('(C) 1989 SONNATA GAMES',W/2,H-6,C.GREEN_L);
}

function drawLevelSelect(){
  ctx.fillStyle=C.BLACK;ctx.fillRect(0,0,W,H);
  ctx.fillStyle=C.GOLD;ctx.fillRect(0,0,W,2);ctx.fillRect(0,H-2,W,2);
  drawTextC('LEVEL SELECT',W/2,8,C.YELLOW,2);
  ZONES.forEach((z,i)=>{const y=28+i*24,sel=i===_levelSelIdx;if(sel){ctx.fillStyle=C.NAVY;ctx.fillRect(10,y-3,W-20,19);}if(sel)drawText('>',14,y,C.WHITE);drawText((i+1)+'. '+z.name,24,y,sel?C.SAND:C.MINT);drawText(z.sub,24,y+8,sel?C.GREY:C.GREY_D);});
  drawTextC('ARROWS: CHOOSE  ENTER: PLAY  ESC: BACK',W/2,H-10,C.GREEN);
}

function drawTutorialChamber(){
  ctx.fillStyle=C.BLACK;ctx.fillRect(0,0,W,H);
  ctx.fillStyle=C.TEAL;ctx.fillRect(0,0,W,2);ctx.fillRect(0,H-2,W,2);
  drawTextC('TUTORIAL CHAMBER',W/2,12,C.TEAL_L,2);
  drawTextC('Training rooms for every mechanic are on the way.',W/2,H/2-28,C.MINT);
  drawTextC('TRS, XLR, MAG, punch, hook, duck — step by step.',W/2,H/2-8,C.GREY);
  drawTextC('Laitu will guide you through each chamber.',W/2,H/2+12,C.GREY);
  drawTextC('COMING SOON',W/2,H/2+40,C.YELLOW,2);
  drawTextC('ESC OR ENTER: BACK TO MENU',W/2,H-10,C.GREEN);
}

function drawStageDesignHub(){
  const items=_stageDesignItems();
  ctx.fillStyle=C.BLACK;ctx.fillRect(0,0,W,H);
  ctx.fillStyle=C.TEAL;ctx.fillRect(0,0,W,2);ctx.fillRect(0,H-2,W,2);
  drawTextC('CREATIVE MODE',W/2,8,C.TEAL_L,2);
  drawTextC('Build and share your own Mind & Venture levels',W/2,22,C.GREY);
  const maxShow=Math.min(items.length,14), start=Math.max(0,Math.min(_stageDesignSelIdx-maxShow+1,items.length-maxShow));
  for(let j=0;j<maxShow;j++){const i=start+j,it=items[i],y=40+j*22,sel=i===_stageDesignSelIdx;if(sel){ctx.fillStyle=C.NAVY;ctx.fillRect(10,y-3,W-20,19);}if(sel)drawText('>',14,y,C.WHITE);const col=it.action==='new'?C.YELLOW:it.action==='back'?C.GREY:sel?C.SAND:C.MINT;drawText(it.label,24,y,col);}
  const stages=getCustomStages().length;
  drawTextC(stages+' saved stage'+(stages===1?'':'s')+' in library',W/2,H-22,C.GREY);
  drawTextC('ENTER: EDIT  P: PLAYTEST  ESC: BACK',W/2,H-10,C.GREEN);
}

function _mapCoverRect(){ const img=MAP_ART; if(!img.complete||!img.naturalWidth) return {dx:0,dy:0,w:W,h:H}; const s=Math.max(W/img.naturalWidth,H/img.naturalHeight); const qw=Math.max(1,Math.round(img.naturalWidth*s)); const qh=Math.max(1,Math.round(img.naturalHeight*s)); return {dx:(W-qw)>>1,dy:(H-qh)>>1,w:qw,h:qh}; }
function _drawFullCoverArt(img){ if(!img||!img.complete||!img.naturalWidth) return null; const s=Math.max(W/img.naturalWidth,H/img.naturalHeight); const qw=Math.max(1,Math.round(img.naturalWidth*s)); const qh=Math.max(1,Math.round(img.naturalHeight*s)); const dx=(W-qw)>>1,dy=(H-qh)>>1; ctx.imageSmoothingEnabled=true; if(ctx.imageSmoothingQuality) ctx.imageSmoothingQuality='high'; ctx.drawImage(img,dx,dy,qw,qh); return {dx,dy,w:qw,h:qh}; }
function _drawCoverArt(img,qStore,key){ if(!img||!img.complete||!img.naturalWidth) return; const store=qStore||[]; if(!store[key]){const s=Math.max(W/img.naturalWidth,H/img.naturalHeight);store[key]=smsProcessPainted(img,Math.max(1,Math.round(img.naturalWidth*s)),Math.max(1,Math.round(img.naturalHeight*s)));} const q=store[key]; ctx.imageSmoothingEnabled=false; ctx.drawImage(q,(W-q.width)>>1,(H-q.height)>>1); }
function _drawLorePanel(page,frKey,opts={}){
  const {pageNum=0,pageTotal=0,showPrompt=true}=opts;
  const fs=3, lh=8*fs, titleH=10*fs, padX=14, panelX=16, panelW=W-32, textMaxW=panelW-padX*2;
  const wrapped=wrapBitmapBlocks(page.lines,textMaxW,fs);
  const bodyH=wrapped.length*lh, panelH=Math.min(Math.floor(H*0.42),titleH+bodyH+fs*16+28);
  const panelY=H-panelH-16;
  ctx.fillStyle=C.VOID;ctx.fillRect(panelX,panelY,panelW,panelH);
  ctx.fillStyle=C.TEAL_D;ctx.fillRect(panelX,panelY,panelW,2);ctx.fillRect(panelX,panelY+panelH-2,panelW,2);ctx.fillRect(panelX,panelY,2,panelH);ctx.fillRect(panelX+panelW-2,panelY,2,panelH);
  ctx.fillStyle=C.NAVY;ctx.fillRect(panelX+2,panelY+2,panelW-4,titleH);
  const titleCol=page.col?smsHexQ(parseInt(page.col.slice(1,3),16),parseInt(page.col.slice(3,5),16),parseInt(page.col.slice(5,7),16)):C.SAND;
  drawTextC(page.title,W/2,panelY+6,titleCol,fs);
  let lineY=panelY+titleH+8;
  wrapped.forEach((line,i)=>{ if(frKey<i*14) return; if(lineY>panelY+panelH-fs*8) return; drawTextC(line,W/2,lineY,C.LILAC,fs); lineY+=lh; });
  if(showPrompt&&fr%32<22) drawTextC('PRESS ANY KEY',W/2,panelY+panelH-fs*6-4,C.GREY,fs);
  if(pageTotal>1) drawTextC(`${pageNum} / ${pageTotal}`,W/2,H-8,C.PURPLE_L,2);
}
function drawStory(){ const page=STORY_PAGES[_storyPage]; ctx.fillStyle=C.BLACK;ctx.fillRect(0,0,W,H); _drawCoverArt(STORY_ART[_storyPage],STORY_ART_Q,_storyPage); _drawLorePanel(page,_storyFr,{pageNum:_storyPage+1,pageTotal:STORY_PAGES.length}); }

function drawLaitu(){
  if(_battleTestMode||!_laitu||_laitu.met||_zoneIdx!==0) return;
  const lx=sx(_laitu.x), ly=sy(_laitu.y);
  if(lx>W+48||lx+sw(_laitu.w)<-48) return;
  _laitu.blink=(_laitu.blink||0)+1;
  const cx=lx+sw(_laitu.w*0.5), feet=ly+sw(LAITU_H), moving=Math.abs(_laitu.vx||0)>0.05;
  ctx.imageSmoothingEnabled=true;
  drawLaituFigure(cx,feet,sw(1),{faceR:!!_laitu.fc,walkPhase:moving?_laitu.stepT:0});
  if(fr%28<18) drawText('!',lx+sw(_laitu.w-4),ly+sw(4),C.YELLOW);
  if(fr%48<36) drawTextC('LAITU',cx,Math.max(4,ly-sw(8)),'#a8d4ff');
}

function _drawZoneCutArt(pageIdx){ const page=ZONE_CUT_ART[pageIdx],art=_zoneCutImgs[pageIdx]; ctx.fillStyle=C.BLACK;ctx.fillRect(0,0,W,H); _drawCoverArt(art,_zoneCutQ,pageIdx); _drawLorePanel({title:page.title,col:'#8ee6ff',lines:page.lines},_cutsceneFr,{showPrompt:false}); }
function drawSonataMap(){
  ctx.fillStyle='#04020a';ctx.fillRect(0,0,W,H);
  _drawFullCoverArt(MAP_ART)||_mapCoverRect();
  ctx.fillStyle='rgba(4,2,12,0.82)';ctx.fillRect(0,0,W,16);drawTextC('SONNATA',W/2,2,C.YELLOW);drawTextC('KNOWL SEED TRAIL',W/2,10,C.TEAL_L);
  ctx.fillStyle='rgba(4,2,12,0.82)';ctx.fillRect(0,H-16,W,16);
  const cur=ZONES[_zoneIdx]?ZONES[_zoneIdx].name:'',nxt=ZONES[_zoneIdx+1]?ZONES[_zoneIdx+1].name:'Summit';
  drawTextC(cur+'  →  '+nxt,W/2,H-13,C.GREEN_L);
}
function drawCutscene(){
  if(_cutscenePhase===0){
    ctx.fillStyle=C.BLACK;ctx.fillRect(0,0,W,H);ctx.imageSmoothingEnabled=true;
    drawLaituFigure(W/2,H*0.58,4.1,{glowPhase:0.4});
    drawTextC('NEIGHBOR LAITU',W/2,78,'#a8d4ff',3);
    const fs=3,lh=8*fs,panelH=Math.min(140,24+_laituCutLines.length*lh+fs*10),panelY=H-panelH-16,panelX=16,panelW=W-32;
    ctx.fillStyle=C.VOID;ctx.fillRect(panelX,panelY,panelW,panelH);ctx.fillStyle=C.BLUE_L;ctx.fillRect(panelX,panelY,panelW,2);ctx.fillRect(panelX,panelY+panelH-2,panelW,2);ctx.fillRect(panelX,panelY,2,panelH);ctx.fillRect(panelX+panelW-2,panelY,2,panelH);
    let lineY=panelY+10;
    _laituCutLines.forEach((line,i)=>{ if(_cutsceneFr<i*18) return; if(lineY>panelY+panelH-fs*8) return; drawTextC(line,W/2,lineY,C.LILAC,fs); lineY+=lh; });
    if(_stageDamageFree&&_cutsceneFr>20) drawTextC('FLAWLESS BONUS +500',W/2,panelY+panelH-fs*6-4,C.MINT,fs);
  }else if(_cutscenePhase===1){ _drawZoneCutArt(_cutscenePage); }
  else if(_cutscenePhase===2||_cutscenePhase===3){ drawSonataMap(); }
  if(_cutscenePhase!==2&&_cutscenePhase!==3&&fr%32<22) drawTextC('PRESS START TO CONTINUE',W/2,H-10,C.GREY,2);
  else if((_cutscenePhase===2||_cutscenePhase===3)&&_cutsceneFr>60&&fr%32<22) drawTextC('PRESS START',W/2,H-10,C.WHITE,2);
}

function drawSelect(){
  const fs=3,fsSm=2;
  ctx.fillStyle='#04020a';ctx.fillRect(0,0,W,H);
  const vg=ctx.createLinearGradient(0,0,0,H);vg.addColorStop(0,'rgba(32,64,96,0.35)');vg.addColorStop(0.45,'rgba(6,12,10,0)');vg.addColorStop(1,'rgba(24,96,88,0.28)');ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(88,208,176,0.12)';ctx.fillRect(0,0,W,3);ctx.fillRect(0,H-3,W,3);
  ctx.fillStyle='rgba(104,184,208,0.08)';for(let sy=0;sy<H;sy+=4)ctx.fillRect(0,sy,W,1);
  const padX=72,panelW=W-padX*2,panelH=_selectStep===0?Math.floor(H*0.62):Math.floor(H*0.68);
  const panelX=padX,panelY=Math.round((H-panelH)/2)-12;
  ctx.fillStyle='rgba(6,10,18,0.92)';ctx.fillRect(panelX,panelY,panelW,panelH);
  ctx.strokeStyle='rgba(88,208,176,0.42)';ctx.lineWidth=2;ctx.strokeRect(panelX+1,panelY+1,panelW-2,panelH-2);
  ctx.strokeStyle='rgba(152,112,208,0.22)';ctx.lineWidth=1;ctx.strokeRect(panelX+8,panelY+8,panelW-16,panelH-16);
  const titleY=panelY+28;drawTextC('STORY MODE',W/2,titleY,C.TEAL_L,fs);drawTextC(_selectStep===0?'HOW DO YOU WANT TO PLAY?':'WHO IS PLAYER 1?',W/2,titleY+fs*10,C.LILAC,fsSm);
  const _drawCard=(cx,cy,cw,ch,sel,accent,disabled,title,subs)=>{
    const x=Math.round(cx-cw/2),y=cy,pulse=sel&&!disabled&&(fr&16)?1:0;
    if(sel&&!disabled){ctx.fillStyle=accent+'44';ctx.fillRect(x-4-pulse,y-4-pulse,cw+8+pulse*2,ch+8+pulse*2);ctx.strokeStyle=accent;ctx.lineWidth=2;ctx.strokeRect(x-2-pulse,y-2-pulse,cw+4+pulse*2,ch+4+pulse*2);}
    ctx.fillStyle=disabled?'rgba(20,16,32,0.85)':(sel?'rgba(24,48,40,0.95)':'rgba(14,20,32,0.88)');ctx.fillRect(x,y,cw,ch);
    ctx.strokeStyle=disabled?'rgba(40,32,48,0.9)':(sel?accent:'rgba(64,136,176,0.55)');ctx.lineWidth=sel?2:1;ctx.strokeRect(x+0.5,y+0.5,cw-1,ch-1);
    if(sel&&!disabled){ctx.fillStyle=C.WHITE;drawText('>',x+14,y+Math.floor(ch*0.22),C.WHITE,fsSm);}
    const tCol=disabled?C.GREY_D:(sel?C.WHITE:accent);drawTextC(title,cx,y+Math.floor(ch*0.28),tCol,fs);
    let sy2=y+Math.floor(ch*0.28)+fs*9;
    (subs||[]).forEach(line=>{drawTextC(line,cx,sy2,disabled?C.GREY_D:(sel?C.MINT:C.GREY),fsSm);sy2+=fsSm*8;});
  };
  const cardsY=panelY+Math.floor(panelH*0.38),cardH=_selectStep===0?132:168;
  const cardW=_selectStep===0?Math.floor((panelW-64)/3)-8:Math.floor((panelW-48)/2)-8;
  const gap=_selectStep===0?20:28,rowW=_selectStep===0?cardW*3+gap*2:cardW*2+gap,rowX=W/2-rowW/2;
  if(_selectStep===0){
    const m0=_playModeIdx===0,m1=_playModeIdx===1,m2=_playModeIdx===2;
    const cx0=rowX+cardW/2,cx1=rowX+cardW+gap+cardW/2,cx2=rowX+(cardW+gap)*2+cardW/2;
    _drawCard(cx0,cardsY,cardW,cardH,m0,C.SKY_L,false,'1 PLAYER',['SOLO ADVENTURE','FULL STORY']);
    _drawCard(cx1,cardsY,cardW,cardH,m1,C.MINT,false,'2P LOCAL',['SPLIT KEYBOARD','P1 + P2']);
    _drawCard(cx2,cardsY,cardW,cardH,m2,C.GREY_D,true,'2P ONLINE',['COMING SOON']);
  }else{
    const mSel=_heroChoice==='mind',vSel=_heroChoice==='venture';
    const cxM=rowX+cardW/2,cxV=rowX+cardW+gap+cardW/2;
    _drawCard(cxM,cardsY,cardW,cardH,mSel,C.PURPLE_L,false,'MIND',['P1 PURPLE','WIDE HAT','LEAD SIBLING']);
    _drawCard(cxV,cardsY,cardW,cardH,vSel,C.RED_L,false,'VENTURE',['P2 RED','BACK CAP','BOLD SIBLING']);
    const swY=cardsY+cardH-36;
    if(mSel){ctx.fillStyle=C.PURPLE_L;ctx.fillRect(cxM-28,swY,18,18);ctx.fillStyle=C.LILAC;ctx.fillRect(cxM-6,swY,18,18);}
    if(vSel){ctx.fillStyle=C.RED_L;ctx.fillRect(cxV-28,swY,18,18);ctx.fillStyle=C.ORANGE;ctx.fillRect(cxV-6,swY,18,18);}
  }
  const hintY=panelY+panelH-56;
  if(_selectStep===0){drawTextC('LEFT / RIGHT  —  CHOOSE',W/2,hintY,C.SKY_L,fsSm);drawTextC('ENTER  —  CONTINUE     ESC  —  BACK TO STORY',W/2,hintY+fsSm*9,C.GREY,fsSm);}
  else{drawTextC('LEFT / RIGHT  —  CHANGE HERO',W/2,hintY,C.SKY_L,fsSm);drawTextC('ENTER  —  START GAME     ESC  —  BACK',W/2,hintY+fsSm*9,C.GREY,fsSm);if(_playerCount===2)drawTextC('P2 USES ARROW KEYS + NUMPAD',W/2,hintY+fsSm*18,C.MINT,fsSm);}
  const modeLbl=_playModeIdx===0?'1 PLAYER':(_playModeIdx===1?'2P LOCAL':'2P ONLINE');
  const footY=panelY+panelH-18;ctx.fillStyle='rgba(16,24,32,0.75)';ctx.fillRect(panelX+24,footY-6,panelW-48,fsSm*8+8);
  drawTextC(`MODE: ${modeLbl}   ·   HERO: ${_heroChoice==='mind'?'MIND':'VENTURE'}`,W/2,footY,C.SAND,fsSm);
  _drawUiToast();
}

// ── Version bar update (called from draw()) ───────────────────
function updateVersionBar(){
  const inf=document.getElementById('inf');
  const mvVer=document.getElementById('mvVer');
  if(mvVer){
    if(_gameState==='game'&&_battleTestMode){ mvVer.style.fontSize='13px';mvVer.textContent='BATTLE PRACTICE — stats in panel above canvas';mvVer.style.color='#6f6'; }
    else if(_gameState==='game'){ mvVer.style.fontSize='13px';mvVer.style.fontWeight='bold'; const spd=Math.round(Math.abs(p.vx||0)); const b=window.MV_BUILD||'?'; mvVer.textContent='build '+b+'  |  MOVE v'+MOVE_BUILD+'  |  speed '+spd+' / '+MOVE_WALK; mvVer.style.color=spd>=6?'#6f6':(spd>=2?'#ff6':'#f66'); }
    else{ mvVer.style.fontSize='13px';mvVer.style.fontWeight='bold'; const track=_titleMusicPath?_titleMusicPath.replace(/^assets\/new music\//,''):''; const b=window.MV_BUILD||'?'; mvVer.textContent='build '+b+'  |  MOVE v'+MOVE_BUILD+(track?'  |  ♪ '+track:'')+' — click to start'; mvVer.style.color='#6f6'; }
  }
  if(inf){
    if(!(_battleTestMode&&_gameState==='game')){
      inf.style.fontSize='10px';
      const zone=ZONES[_zoneIdx]?ZONES[_zoneIdx].name:'';
      if(ITEM===2||ITEM===3) inf.textContent=zone+' · '+(ITEM===2?'XLR':'MAG')+' '+p.itemStamina+'%';
      else inf.textContent=zone+' · '+INAMES[ITEM]+' · Knowl '+kColl+'/'+kTotal;
      inf.style.color='';
    }
  }
}
