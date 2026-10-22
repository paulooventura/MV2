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
let _paused=false;
let _pauseIdx=0, _optFromPause=false, _optBackFr=-99;
function _pauseItems(){
  const items=['RESUME','OPTIONS'];
  if(window.MV_SIGNAL) items.push('LEAVE A NOTE');
  items.push('EXIT');
  return items;
}
function _togglePause(){
  if(_gameState!=='game') return;
  if(typeof _mapEdActive!=='undefined'&&_mapEdActive) return;
  if(_paused&&typeof fr!=='undefined'&&fr-_optBackFr<=2) return;   // the B / ESC that closed Options stays in the pause menu
  _paused=!_paused;
  if(_paused){ _pauseIdx=0;
    try{ if(typeof _gameAudioEl!=='undefined'&&_gameAudioEl) _gameAudioEl.pause(); }catch(e){}
  }else if(typeof _playBGM==='function'){
    _playBGM('game',OPT.musicVol);
  }
}
function _driveMenusFromPads(){
  const up=!!Kj['KeyW'], dn=!!Kj['KeyS'], lf=!!Kj['KeyA'], rt=!!Kj['KeyD'];
  const ok=!!Kj['Space'], back=!!Kj['Escape'];
  if(!(up||dn||lf||rt||ok||back)) return;
  if(_gameState==='title'){
    _ensureTitleMusic();
    if(up) _titleMenuIdx=(_titleMenuIdx+_titleMenuItems().length-1)%_titleMenuItems().length;
    if(dn) _titleMenuIdx=(_titleMenuIdx+1)%_titleMenuItems().length;
    if(ok) _titleMenuActivate();
    return;
  }
  if(_gameState==='story'&&ok){ startGame(); return; }
  if(_gameState==='select'){
    const nX=lf?-1:rt?1:0, nY=up?-1:dn?1:0;
    if((nX||nY)&&window.MV_SELECT_NAV&&MV_SELECT_NAV(nX,nY)){ /* hero screen: rows + switches (ui_select.js) */ }
    else {
      if(lf){ if(_selectStep===0)_playModeIdx=(_playModeIdx+3)%4; else _heroChoice='mind'; }
      if(rt){ if(_selectStep===0)_playModeIdx=(_playModeIdx+1)%4; else _heroChoice='venture'; }
    }
    if(ok) startGame();
    if(back){ if(_selectStep===1) _selectStep=0; else if(!(window.MV_TIMELINE_BACK&&MV_TIMELINE_BACK())){ _gameState='story'; _storyPage=STORY_PAGES.length-1; } }
    return;
  }
  if(_gameState==='options'){
    _optionsInput({up,down:dn,left:lf,right:rt,confirm:ok,back});
    return;
  }
  if(_gameState==='tutorial'&&(ok||back)){ _gameState='title'; return; }
  if(_gameState==='levels'){
    if(back){ _gameState='title'; return; }
    if(up) _levelSelIdx=(_levelSelIdx+ZONES.length-1)%ZONES.length;
    if(dn) _levelSelIdx=(_levelSelIdx+1)%ZONES.length;
    if(ok) _startGameAtZone(_levelSelIdx);
    return;
  }
  if(_gameState==='stagedesign'){
    const items=_stageDesignItems();
    if(back){ _gameState='title'; return; }
    if(up) _stageDesignSelIdx=(_stageDesignSelIdx+items.length-1)%items.length;
    if(dn) _stageDesignSelIdx=(_stageDesignSelIdx+1)%items.length;
    if(ok){
      const sel=items[_stageDesignSelIdx];
      if(sel.action==='new') startStageDesignerNew();
      else if(sel.action==='stage') startStageDesignerEdit(getCustomStages()[sel.idx]);
      else if(sel.action==='back') _gameState='title';
    }
    return;
  }
  if(_gameState==='cutscene'&&ok) _advanceCutscene();
}
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
  ctx.save(); ctx.globalAlpha=a;
  const tw=Math.max(260,textW(_uiToast,2)+48), th=textH(2)+22, ty=H*0.62+(1-a)*10;
  uiPanel(W/2-tw/2,ty,tw,th,{r:th/2,accent:'#7dffcf'});
  drawTextC(_uiToast,W/2,ty+11,C.MINT,2);
  ctx.restore();
  _uiToastFr--;
}

// ── Title menu ────────────────────────────────────────────────
function _titleMenuItems(){
  return [
    {label:'STORY MODE', activate:()=>startStoryMode()},
    // Paulo (Oct 22): Creative Mode is on the menu, locked until the Alpha.
    // Hidden still: Tutorial Chamber, Item Sprite Lab, Physics Lab, Battle Practice.
    {label:'CREATIVE MODE', locked:true, note:'OPENS IN ALPHA', activate:()=>{}},
    {label:'OPTIONS', activate:()=>{_gameState='options';_optRow=0;}},
  ];
}
function _titleMenuGeom(){
  const menu=_titleMenuItems();
  const map=_titleArtMap();
  // The key art already paints START / OPTIONS. Hit boxes sit on those words.
  if(map&&map.im.naturalWidth!==1536){
    // the key art (Oct 22): the menu sits low in the middle, on the wet floor between the two wheels
    const rowH=40, top=H-150;
    return menu.map((it,i)=>{
      const w=290, x=W/2-w/2, y=top+i*rowH;
      return {label:it.label, locked:!!it.locked, note:it.note, activate:it.activate, x, y, w, h:rowH, ty:y+rowH/2};
    });
  }
  if(map&&map.im.naturalWidth===1536){
    // three rows drawn over the art's own menu words (drawTitle covers them with a panel)
    const top=742, rowH=54;
    return menu.map((it,i)=>{
      const x=map.dx+560*map.s, y=map.dy+(top+i*rowH)*map.s, w=420*map.s, h=rowH*map.s;
      return {label:it.label, locked:!!it.locked, note:it.note, activate:it.activate, x, y, w, h, ty:y+h/2};
    });
  }
  const gw=1024, gh=768;
  const cx=gw/2, startY=Math.round(gh*0.50), lineH=40;
  return menu.map((it,i)=>{
    const ty=startY+i*lineH;
    const lw=textW(it.label,2);
    const w=Math.max(lw+80,280), h=32;
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
  if(item.locked){ uiShowToast(item.label==='CREATIVE MODE'?'CREATIVE MODE OPENS IN THE ALPHA':'LOCKED'); try{ sfx('omniblock_chip'); }catch(e){} return; }
  item.activate();
}

// ── Pause menu: RESUME · OPTIONS · EXIT ───────────────────────
// Opened with START (the ☰ Menu button next to X) or ESC. Up/down (d-pad,
// stick, W/S, arrows) moves, A / Space / Enter picks, B or START resumes.
function _pauseInput(){
  if(window.MV_SIGNAL&&MV_SIGNAL.blocking()){ MV_SIGNAL.pad(); return; }
  const items=_pauseItems();
  if(Kj['ArrowUp']||Kj['KeyW']){ _pauseIdx=(_pauseIdx+items.length-1)%items.length; try{ sfx('menu'); }catch(e){} }
  if(Kj['ArrowDown']||Kj['KeyS']){ _pauseIdx=(_pauseIdx+1)%items.length; try{ sfx('menu'); }catch(e){} }
  if(Kj['KeyE']&&!K['KeyE_kb']){ _togglePause(); return; }          // pad B: back to the game
  if(Kj['Space']||Kj['Enter']||Kj['NumpadEnter']){
    const it=items[_pauseIdx];
    try{ sfx('confirm'); }catch(e){}
    if(it==='RESUME') _togglePause();
    else if(it==='OPTIONS'){ _optFromPause=true; _optRow=0; _gameState='options'; }
    else if(it==='LEAVE A NOTE'){ if(window.MV_SIGNAL) MV_SIGNAL.open(); }
    else if(it==='EXIT'){
      _paused=false;
      if(window.MV_BETA&&MV_BETA.on&&MV_BETA.quitToTitle) MV_BETA.quitToTitle();
      else { try{ if(typeof _stopBGM==='function') _stopBGM('game'); }catch(e){} _gameState='title'; if(typeof _titleT!=='undefined') _titleT=0; }
    }
  }
}
function drawPauseMenu(){
  ctx.fillStyle='rgba(4,2,10,0.6)'; ctx.fillRect(0,0,W,H);
  const items=_pauseItems();
  const pw=420, rowH=48, ph=110+items.length*rowH, px=W/2-pw/2, py=Math.round(H/2-ph/2);
  uiPanel(px,py,pw,ph,{r:20});
  uiLogo('PAUSED',W/2,py+16,46,{sweep:150});
  let y=py+86;
  items.forEach((it,i)=>{
    const sel=i===_pauseIdx;
    if(sel){ uiPanel(px+28,y-12,pw-56,rowH-8,{sel:true,r:12,flat:true}); uiCursor(px+50,y+10,10); }
    drawTextC(it,W/2,y,sel?'#ffe39a':'#c8b8ff',3);
    y+=rowH;
  });
  drawTextC('A SELECT    B / START RESUME',W/2,py+ph-22,'#8a7ab8',1);
}

// ── Options ───────────────────────────────────────────────────
const OPT_FIXED_ROWS=7;   // music style, music vol, sfx vol, console, CRT TV, enemies, manual & credits
function _optExtra(){ return window.MV_SIGNAL?1:0; }
function _optRowCount(){ return BIND_ORDER.length+OPT_FIXED_ROWS+_optExtra(); }
function _optionsInput(ev){
  if(_gameState!=='options') return false;
  if(window.MV_SIGNAL&&MV_SIGNAL.blocking()){ MV_SIGNAL.pad(ev); return true; }
  if(_optRebinding){ if(ev.back){_optRebinding=null;return true;} return true; }
  const n=_optRowCount();
  if(ev.back){ if(_optFromPause){ _optFromPause=false; _gameState='game'; _optBackFr=(typeof fr!=='undefined'?fr:0); try{ delete Kj['Escape']; }catch(e){} } else _gameState='title'; return true; }
  if(ev.up){_optRow=(_optRow+n-1)%n;return true;}
  if(ev.down){_optRow=(_optRow+1)%n;return true;}
  const dec=!!ev.left&&!ev.right, inc=!!ev.right&&!ev.left;
  if(_optRow===0&&(dec||inc||ev.confirm)){ OPT.musicMode=OPT.musicMode==='ost'?'psg':'ost'; _saveOpts();_switchMusicMode();return true; }
  if(_optRow===1&&(dec||inc)){ OPT.musicVol=Math.max(0,Math.min(1,OPT.musicVol+(inc?0.05:-0.05))); _saveOpts();_applyBgmVolumes();return true; }
  if(_optRow===2&&(dec||inc)){ OPT.sfxVol=Math.max(0,Math.min(1,OPT.sfxVol+(inc?0.05:-0.05))); _saveOpts();return true; }
  if(_optRow===3&&(dec||inc||ev.confirm)){ if(window.MV_CONSOLE) MV_CONSOLE.cycle(dec?-1:1); return true; }
  if(_optRow===4&&(dec||inc||ev.confirm)){ if(window.MV_TV) MV_TV.toggle(); return true; }
  if(_optRow===5&&(dec||inc||ev.confirm)){
    const B=window.MV_BETA;
    if(B&&typeof B.setDifficulty==='function'){
      const cur=B.difficulty||2;
      B.setDifficulty(dec?(cur<=1?3:cur-1):(cur>=3?1:cur+1));
    }
    return true;
  }
  if(_optRow===6&&ev.confirm){ if(window.MV_MANUAL) MV_MANUAL.open(); return true; }   // the instruction booklet + credits (ui_manual.js)
  if(window.MV_SIGNAL&&_optRow===OPT_FIXED_ROWS&&ev.confirm){ MV_SIGNAL.open(); return true; }
  const bind0=OPT_FIXED_ROWS+_optExtra();
  if(_optRow>=bind0&&ev.confirm){ _optRebinding=BIND_ORDER[_optRow-bind0]; return true; }
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
const TITLE_STATIC=(()=>{ const im=new Image(); im.onload=()=>{_titleStaticReady=true;}; im.onerror=()=>{console.warn('title art failed');}; im.src='assets/ui/title-key.jpg?v=253'; return im; })();   // Paulo (Oct 22): the key art of the siblings is the title screen
if(TITLE_STATIC.complete&&TITLE_STATIC.naturalWidth) _titleStaticReady=true;
function _titleArtMap(){
  const im=TITLE_STATIC;
  if(!_titleStaticReady||!im.naturalWidth) return null;
  const s=Math.max(W/im.naturalWidth,H/im.naturalHeight);
  return {im,s,dx:(W-im.naturalWidth*s)/2,dy:(H-im.naturalHeight*s)/2};
}
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
function _titleBgImage(){
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
  // the title and the story share the opening theme: it carries on, a little softer, under the story
  const _same=typeof _titleMusicPath!=='undefined'&&_titleMusicPath&&_titleMusicPath===_storyMusicPath&&_openingAudioEl&&!_openingAudioEl.paused;
  if(_same){ try{ _openingAudioEl.volume=Math.max(0,Math.min(1,OPT.musicVol*0.55)); }catch(e){} }
  else { _stopBGM('title'); _playBGM('story',OPT.musicVol*0.85); }   // the storyline theme, up front
}
function _ensureTitleMusic(){
  if(_gameState!=='title'&&_gameState!=='splash') return;
  if(_gameState==='splash'&&window.MV_SPLASH&&MV_SPLASH.idx()<1) return;      // Paulo (Oct 22): the title music comes in on the 2nd logo
  if(_titleMusicPlaying&&_openingAudioEl&&!_openingAudioEl.paused) return;
  _unlockAudio(); _playBGM('title',OPT.musicVol);
}
function startGame(){
  _unlockAudio();
  if(_gameState==='story'){
    _storyPage++; _storyFr=0;
    if(_storyPage>=STORY_PAGES.length){ _gameState='select'; _selectStep=0; _playModeIdx=_playerCount===2?2:(window.MV_SIBLING&&!MV_SIBLING.on?0:1); }
  }else if(_gameState==='select'){
    if(_selectStep===0){
      // modes (Paulo, Oct 22): 0 SOLO · 1 WITH YOUR SIBLING (it shadows you) · 2 2P LOCAL · 3 2P ONLINE
      if(_playModeIdx===3){uiShowToast('ONLINE CO-OP — COMING SOON');return;}
      _playerCount=_playModeIdx===2?2:1; if(_playModeIdx<2&&window.MV_SIBLING) MV_SIBLING.on=_playModeIdx===1;
      _selectStep=1; return;
    }
    // Story mode plays the new stages: Awdjoo Town 1.1 → 1.2 (beta_level.js).
    // The self-test keeps driving the classic Awdjoo map.
    if(window.MV_STORY_STAGES&&typeof startBetaLab==='function'&&!/[?&]selftest=1/.test(location.search)){
      if(_playerCount===2){ uiShowToast('2 PLAYERS - COMING SOON TO THE NEW AWDJOO'); _selectStep=0; return; }
      _gameState='game'; _stopBGM('story'); if(typeof _stopAllBgm==='function') _stopAllBgm();
      if(window.MV_BETA){ MV_BETA.saves={}; MV_BETA.isoOwned=false; MV_BETA.popupSeen={}; if(MV_BETA.newRun) MV_BETA.newRun(); MV_BETA.progress=0; MV_BETA.results=null; MV_BETA.popup=null; MV_BETA.trans=null; }
      if(window.MV_BETA&&MV_BETA.pendingSave&&MV_BETA.storyPlay){ const sv=MV_BETA.pendingSave; MV_BETA.pendingSave=null; MV_BETA.storyPlay(sv,'select'); return; }   // the timeline picked a saved run: on from its save, with the hero just chosen
      startBetaLab('1.1',0,{fresh:true}).catch(err=>console.error('stage load failed',err));
      return;
    }
    _gameState='game'; _stopBGM('story'); initWorld();
    if(typeof _pickAndSetGameMusic==='function') _pickAndSetGameMusic();
    _playBGM('game',OPT.musicVol);
  }
}
function _startGameAtZone(idx){
  _pendingZone=idx; _gameState='game'; _stopBGM('title'); initWorld();
  if(typeof _pickAndSetGameMusic==='function') _pickAndSetGameMusic();
  _playBGM('game',OPT.musicVol);
}
function _onInteract(e){
  _unlockAudio();
  if(_gameState==='title'){ _ensureTitleMusic(); if(e&&e.clientX!=null) _titleMenuClick(e); return; }
  if(_gameState==='cutscene'){ _advanceCutscene(); return; }
  if(_gameState==='story'||_gameState==='select') startGame();
}
document.addEventListener('click',_onInteract,false);
document.addEventListener('touchstart',e=>{ if(e.touches&&e.touches[0]) _onInteract(e.touches[0]); },{passive:true});
document.addEventListener('keydown',e=>{
  if(window.MV_SIGNAL&&MV_SIGNAL.blocking()) return;
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
    if(e.code==='Escape'||e.code==='Backspace'){if(_selectStep===1){_selectStep=0;e.preventDefault();return;}if(!(window.MV_TIMELINE_BACK&&MV_TIMELINE_BACK())){_gameState='story';_storyPage=STORY_PAGES.length-1;}e.preventDefault();return;}
    if(e.code==='ArrowLeft'||e.code==='KeyA'){if(_selectStep===0)_playModeIdx=(_playModeIdx+3)%4;else _heroChoice='mind';e.preventDefault();return;}
    if(e.code==='ArrowRight'||e.code==='KeyD'){if(_selectStep===0)_playModeIdx=(_playModeIdx+1)%4;else _heroChoice='venture';e.preventDefault();return;}
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
  if(typeof _resetTrsFlames==='function') _resetTrsFlames();
  if(_zoneIdx===0){
    _ensureCampaignMapApplied();
    if(typeof _ensureAwdjooMovingIsland==='function') _ensureAwdjooMovingIsland();
    ENEMS=[]; CRATES=[];
    _restoreMapBWalls();
    _populateKnowlFromMap(); _initLaituFromMap();
    kColl=0; _stageScore=0; _stageDamageFree=true; _awdjooTutorial=true;
    _resetItemProgress();
    _shutdownTimer=0; _gameOver=false; _playerShutCount=0;
    if(typeof ITEM_DROPS!=='undefined') ITEM_DROPS.length=0;
    p=mkP(); _placePlayerAtSpawn(); _spawnMapEnemies();
    if(typeof _ensureAwdjooIslandCircle==='function') _ensureAwdjooIslandCircle();
    _spawnMapCrates();
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
  // 16-bit glass HUD: one floating bar, glossy meters, pill item slots
  const hudH=56;
  uiPanel(6,4,W-12,48,{r:14,alpha:0.78,flat:true,accent:'rgba(200,170,255,0.55)'});
  ctx.imageSmoothingEnabled=true;
  blit(_getKnowlSpr()[(fr>>4)&1],16,10);
  drawText(kTotal>0?kColl+'/'+kTotal:'-',38,14,goalOpen?C.GREEN_L:C.WHITE,2);
  if(_awdjooTutorial&&_zoneIdx===0) drawText('SC '+_stageScore,38,34,_stageDamageFree?C.MINT:C.SAND,1);
  const hpX=104, low=p.hp<=PLAYER_HIT_DMG*2;
  drawText('HP',hpX,14,'#ffb0b8',2);
  uiBar(hpX+40,14,170,16,p.hp/p.maxHp,'#ff3c5a','#ffb04a',10,{pulse:low});
  if(_battleTestMode||_runTestMode) drawText('HP '+p.hp,hpX,36,p.hp<=40?C.RED_L:C.WHITE,1);
  else if(typeof _campaignUsesLives==='function'&&_campaignUsesLives()){
    const left=Math.max(0,(typeof SHUT_LIMIT!=='undefined'?SHUT_LIMIT:5)-(_playerShutCount||0));
    for(let i=0;i<5;i++){ ctx.fillStyle=i<left?(left<=1?'#ff6a7a':'#ffe39a'):'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(hpX+46+i*14,40,4.5,0,Math.PI*2); ctx.fill(); }
    drawText('LIVES',hpX,35,'#c8b8ff',1);
  }
  const icols=(typeof ICOLS!=='undefined'?ICOLS:[C.GREY,C.RED_L,C.SKY,C.LILAC]);
  const inames=['TRS','RCA','XLR','MAG'];
  for(let i=0;i<4;i++){
    const bx=330+i*70, on=_itemUnlocked(i), cur=i===ITEM&&on;
    uiPill(bx,9,62,24,{on:cur,col:icols[i]});
    drawTextC(on?inames[i]:'-',bx+31,13,!on?C.GREY_D:(cur?'#ffffff':'#a898d0'),2);
    if(on&&typeof _itemEnhanced!=='undefined'&&_itemEnhanced[i]) uiSparkle(bx+56,12,5,icols[i],0.9);
    if((i===2&&p.xlrOn)||(i===3&&p.magOn)){ ctx.fillStyle=(fr&4)?'#fff':icols[i]; ctx.beginPath(); ctx.arc(bx+54,26,3,0,Math.PI*2); ctx.fill(); }
  }
  if(_nearKnowlTree(p)){ ctx.globalAlpha=0.6+0.4*Math.sin(fr*0.2); drawText('KNOWL TREE 2X',330,37,C.MINT,1); ctx.globalAlpha=1; }
  else if(ITEM===2||ITEM===3){
    const pwrCol=p.itemStamina>50?'#5ac8ff':(p.itemStamina>20?'#ffa040':'#ff4a5a');
    drawText('PWR',330,37,pwrCol,1);
    uiBar(362,38,180,9,p.itemStamina/100,pwrCol,p.itemStamina>50?'#c0f0ff':pwrCol,10,{pulse:p.itemStamina<20});
    drawText(p.itemStamina<1&&fr%16<8?'LOW':Math.round(p.itemStamina)+'%',550,37,pwrCol,1);
  }
  if(TEST_MODE) drawText('TEST',W-88,14,C.GREEN_L,2);
  if(!(window.MV_BETA&&MV_BETA.on)) drawText('M'+MOVE_BUILD,12,H-18,'rgba(125,255,207,0.6)',1);
  if(_gameState==='game'&&Math.abs(p.vx)>0.3) drawTextR('SPD '+Math.round(Math.abs(p.vx)),W-22,14,'#ece4ff',2);
  if(_runTestMode){uiPanel(W-284,58,276,46,{r:10,flat:true});drawText('RUN TEST',W-272,64,C.MINT,2);const sc=Math.round((p.suspComp||0)*100);drawText('SUSP'+sc+'%  TAB=RESET',W-272,86,C.GREY,1);}
  if(GP&&GP.pad) drawTextR('PAD',W-22,34,C.GREEN,1);
  // altitude rail on the right edge
  const prog=Math.max(0,Math.min(1,1-(p.y-360)/WH));
  uiRound(W-12,hudH+8,6,H-hudH-16,3); ctx.fillStyle='rgba(10,6,24,0.55)'; ctx.fill();
  const rh=(H-hudH-16)*prog; if(rh>3){ const gg=ctx.createLinearGradient(0,H-8-rh,0,H-8); gg.addColorStop(0,'#b0ffcf'); gg.addColorStop(1,'#2a9a6a'); uiRound(W-12,H-8-rh,6,rh,3); ctx.fillStyle=gg; ctx.fill(); }
  const _ch=_playerChargeInfo(p), _chargeShow=_ch.chargeFrac;
  if((p.og&&_chargeShow>0)||p.duckBoostReady||p._wallChargeReady||p.wallGrip>0||_ch.sprinting){
    const ready=p.duckBoostReady||p._wallChargeReady||_ch.ready;
    uiBar(14,hudH+6,130,10,_chargeShow,'#3ad07a',ready?'#d8ffb0':'#7dffcf',8,{pulse:ready});
  }
}

function drawOptions(){
  _drawSnesStarfield();
  const padX=80, panelW=W-padX*2, rowH=34, scl=2;
  const rows=[{label:'MUSIC STYLE',val:OPT.musicMode==='ost'?'NEW MUSIC':'PSG'},{label:'MUSIC VOLUME',val:Math.round(OPT.musicVol*100)+'%',bar:OPT.musicVol},{label:'SFX VOLUME',val:Math.round(OPT.sfxVol*100)+'%',bar:OPT.sfxVol},
    {label:'CONSOLE',val:window.MV_CONSOLE?(MV_CONSOLE.mode==='md'?'B  MEGA DRIVE':MV_CONSOLE.mode==='snes'?'A  SNES':'C  POSH'):'-',hint:window.MV_CONSOLE&&MV_CONSOLE.mode==='off'?'CLEAN HD - NO CONSOLE EFFECTS':'LOOK + SOUND OF THE MACHINE'},
    {label:'CRT TV',val:window.MV_TV?(MV_TV.on?'ON':'OFF'):'-'},
    {label:'ENEMIES',val:(()=>{ const d=window.MV_BETA&&MV_BETA.difficulty||2; return d<=1?'EASY':d>=3?'HARD':'NORMAL'; })()},
    {label:'MANUAL & CREDITS',val:'OPEN >'}];
  if(window.MV_SIGNAL) rows.push({label:'LEAVE A NOTE',val:'WRITE >'});
  BIND_ORDER.forEach(a=>rows.push({label:BIND_LABELS[a].toUpperCase(),val:_bindList(a)}));
  const panelH=rows.length*rowH+96, panelY=Math.max(20,Math.round((H-panelH)/2));
  uiPanel(padX,panelY,panelW,panelH,{r:16});
  uiLogo('OPTIONS',W/2,panelY+14,40,{sweep:300});
  let y=panelY+70;
  rows.forEach((r,i)=>{
    const sel=i===_optRow;
    if(sel){ uiPanel(padX+20,y-9,panelW-40,rowH-4,{sel:true,r:10,flat:true}); uiCursor(padX+36,y+7,9); }
    drawText(r.label,padX+52,y,sel?C.WHITE:C.LILAC,scl);
    if(r.bar!=null){ uiBar(padX+panelW-250,y+3,150,12,r.bar,'#6a8cff','#c58cff',10); drawTextR(r.val,padX+panelW-30,y,sel?C.WHITE:'#c8b8ff',scl); }
    else drawTextR(r.val,padX+panelW-30,y,sel?'#ffe39a':'#c8b8ff',scl);
    y+=rowH;
  });
  const footY=panelY+panelH-30;
  if(_optRebinding){if(fr%32<24) drawTextC('PRESS A KEY FOR '+BIND_LABELS[_optRebinding].toUpperCase(),W/2,footY,'#ffe39a',2);}
  else drawTextC('UP/DOWN  SELECT    LEFT/RIGHT  ADJUST    A / ENTER  OK    B / ESC  BACK',W/2,footY,'#9c8cc8',1);
}

let _vigCanvas=null;
function drawAtmosphere(){
  // soft 16-bit-era vignette instead of a hard frame
  if(!_vigCanvas||_vigCanvas.width!==W||_vigCanvas.height!==H){
    _vigCanvas=document.createElement('canvas'); _vigCanvas.width=W; _vigCanvas.height=H;
    const g=_vigCanvas.getContext('2d'), rg=g.createRadialGradient(W/2,H/2,Math.min(W,H)*0.42,W/2,H/2,Math.hypot(W,H)*0.56);
    rg.addColorStop(0,'rgba(0,0,0,0)'); rg.addColorStop(1,'rgba(4,0,14,0.42)'); g.fillStyle=rg; g.fillRect(0,0,W,H);
  }
  ctx.drawImage(_vigCanvas,0,0);
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
let _bgCanvas=null;
function _drawSnesStarfield(){
  // deep-space gradient + nebula clouds, cached; twinkling glow stars on top
  if(!_bgCanvas||_bgCanvas.width!==W){
    _bgCanvas=document.createElement('canvas'); _bgCanvas.width=W; _bgCanvas.height=H;
    const g=_bgCanvas.getContext('2d');
    const lg=g.createLinearGradient(0,0,0,H); lg.addColorStop(0,'#05021a'); lg.addColorStop(0.55,'#120638'); lg.addColorStop(0.85,'#2a0e52'); lg.addColorStop(1,'#46166a');
    g.fillStyle=lg; g.fillRect(0,0,W,H);
    const neb=[[0.22,0.3,320,'rgba(90,60,220,0.28)'],[0.78,0.22,280,'rgba(220,70,170,0.18)'],[0.6,0.7,380,'rgba(40,140,230,0.18)'],[0.15,0.82,260,'rgba(170,80,255,0.2)']];
    for(const [nx,ny,r,c] of neb){ const rg=g.createRadialGradient(W*nx,H*ny,0,W*nx,H*ny,r); rg.addColorStop(0,c); rg.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=rg; g.fillRect(0,0,W,H); }
    const hz=g.createLinearGradient(0,H*0.78,0,H); hz.addColorStop(0,'rgba(255,140,90,0)'); hz.addColorStop(1,'rgba(255,140,90,0.18)'); g.fillStyle=hz; g.fillRect(0,H*0.78,W,H*0.22);
  }
  ctx.drawImage(_bgCanvas,0,0);
  for(let i=0;i<120;i++){
    const layer=i%3, sp=(layer+1)*0.12;
    const x=((i*97.3+fr*sp)%(W+20))-10, y=(i*53+(i*i*7)%H)%H;
    const tw=0.55+0.45*Math.sin(fr*0.05+i*1.7);
    const col=i%5===0?'#ffe8c8':(i%4===0?'#a8d8ff':(i%3===0?'#e0c8ff':'#ffffff'));
    if(i%17===0) uiSparkle(x,y,3+layer*1.5,col,tw);
    else{ ctx.globalAlpha=tw*(0.35+layer*0.25); ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,y,0.6+layer*0.45,0,Math.PI*2); ctx.fill(); }
  }
  ctx.globalAlpha=1;
}
// Stage title card: a gold-rimmed banner sweeps in, the name lands in chrome,
// then everything slides off. Labs / the beta can set window.MV_ZONE_CARD
// = {title, sub} to name the stage.
let _zoneCardMax=0;
function drawZoneCard(){
  if(_zoneCardT>_zoneCardMax||_zoneCardMax===0) _zoneCardMax=_zoneCardT+1;
  const total=_zoneCardMax, t=total-_zoneCardT;               // frames since the card started
  if(_zoneCardT<=0){ _zoneCardMax=0; return; }
  const zc=(window.MV_BETA&&MV_BETA.on)?window.MV_ZONE_CARD:null;
  const title=zc&&zc.title?zc.title:(_runTestMode?'RUN TEST GROUND':(_battleTestMode?'BATTLE PRACTICE':ZONES[_zoneIdx].name.toUpperCase()));
  const sub=zc&&zc.sub!=null?zc.sub:(_runTestMode?'ROLL OVER BUMPS - TEST SUSPENSION':(_battleTestMode?'VS SIGNOL - GRENADE RIVAL':'ZONE '+(_zoneIdx+1)+' OF '+ZONES.length));
  const inK=Math.min(1,t/22), outK=Math.min(1,_zoneCardT/22);
  const e=1-Math.pow(1-Math.min(inK,outK),3);
  const cy=Math.round(H*0.32), bh=110*e;
  ctx.save();
  const g=ctx.createLinearGradient(0,cy-bh/2,0,cy+bh/2);
  g.addColorStop(0,'rgba(2,10,4,0)'); g.addColorStop(0.2,'rgba(6,22,10,0.88)'); g.addColorStop(0.8,'rgba(6,22,10,0.88)'); g.addColorStop(1,'rgba(2,10,4,0)');
  ctx.fillStyle=g; ctx.fillRect(0,cy-bh/2,W,bh);
  ctx.fillStyle='rgba(0,0,0,0.2)'; for(let yy=Math.round(cy-bh/2);yy<cy+bh/2;yy+=3) ctx.fillRect(0,yy,W,1);   // scanlines, like the key art's CRT glow
  const lg=ctx.createLinearGradient(0,0,W,0); lg.addColorStop(0,'rgba(170,240,120,0)'); lg.addColorStop(0.5,'rgba(170,240,120,0.9)'); lg.addColorStop(1,'rgba(170,240,120,0)');
  ctx.fillStyle=lg; ctx.fillRect(0,cy-bh*0.38,W,2); ctx.fillRect(0,cy+bh*0.38,W,2);
  const slide=(1-Math.min(1,t/30))*W*0.6 - (1-outK)*W*0.6;
  ctx.globalAlpha=Math.min(inK,outK);
  uiLogo(title,W/2+slide,cy-36,48,{sweep:90});
  drawTextC(sub,W/2-slide*0.6,cy+22,'#c8b8ff',2);
  ctx.restore();
}
function _drawSnesWindow(x,y,w,h,opts){ uiPanel(x,y,w,h,{sel:!!(opts&&opts.sel),locked:!!(opts&&opts.locked),r:Math.min(12,h/3)}); }
let _titleT=0, _logoHalfW=0;
function uiLogoHalf(){ if(!_logoHalfW||!_uiFontReady){ ctx.save(); ctx.font='105px "MV Pixel", monospace'; _logoHalfW=ctx.measureText('MIND & VENTURE').width/2; ctx.restore(); } return _logoHalfW; }
function _titleArtCursor(map,sx,sy){
  const bob=Math.sin(fr*0.18)*1.5, s=map.s;
  const x=map.dx+(sx+bob)*s, y=map.dy+sy*s;
  ctx.fillStyle='#c6ff9a';
  ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+16*s); ctx.lineTo(x+22*s,y+8*s); ctx.closePath(); ctx.fill();
}
// The title's menu (Paulo, Oct 22): STORY MODE · CREATIVE MODE (locked until the Alpha) ·
// OPTIONS, drawn in the art's own phosphor-green lettering on a dark glass plate that
// covers the words painted into the art.
function _drawTitleMenuOverArt(map){
  const rows=_titleMenuGeom(); if(!rows.length) return;
  const k=Math.min(1,Math.max(0,(_titleT-20)/30)), s=map.s;
  const px=rows[0].x, py=rows[0].y-8*s, pw=rows[0].w, ph=rows[rows.length-1].y+rows[rows.length-1].h-rows[0].y+44*s;
  ctx.save(); ctx.globalAlpha=k;
  const g=ctx.createLinearGradient(0,py,0,py+ph); g.addColorStop(0,'rgba(4,16,8,0.0)'); g.addColorStop(0.12,'rgba(4,16,8,0.9)'); g.addColorStop(0.88,'rgba(4,16,8,0.9)'); g.addColorStop(1,'rgba(4,16,8,0.0)');
  ctx.fillStyle=g; ctx.fillRect(px-30*s,py,pw+60*s,ph);
  ctx.fillStyle='rgba(150,240,140,0.35)'; ctx.fillRect(px+20*s,py+6*s,pw-40*s,1); ctx.fillRect(px+20*s,py+ph-8*s,pw-40*s,1);
  rows.forEach((r,i)=>{
    const sel=i===_titleMenuIdx, cy=r.y+r.h/2-6*s, sz=Math.round((sel?36:30)*s*1.5);
    ctx.save(); ctx.font=sz+'px "MV Pixel", monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    const col=r.locked?(sel?'#7f9a86':'#4f6656'):(sel?'#d8ffc0':'#8fd78a');
    ctx.lineWidth=Math.max(3,sz*0.12); ctx.strokeStyle='#020a04'; ctx.strokeText(r.label,W/2,cy);
    if(sel&&!r.locked){ ctx.shadowColor='rgba(170,255,140,0.9)'; ctx.shadowBlur=14; }
    ctx.fillStyle=col; ctx.fillText(r.label,W/2,cy); ctx.restore();
    if(r.locked&&r.note){ drawTextC(r.note,W/2,cy+sz*0.42,sel?'#c8a050':'#7a6a40',1); }
    if(sel) uiCursor(W/2-((r.label.length*sz*0.5)/2)-26*s,cy,12);
  });
  ctx.restore();
}
function drawTitle(){
  _titleT++;
  const map=_titleArtMap();
  if(map&&map.im.naturalWidth!==1536){
    // Paulo (Oct 22): the siblings' key art. A slow push-in, the logo dropping in at the top
    // over a dark band, the menu on a glass plate low in the middle, sigil light breathing.
    ctx.imageSmoothingEnabled=true; if(ctx.imageSmoothingQuality) ctx.imageSmoothingQuality='high';
    // the whole art, fit to the width, sitting on the bottom: the logo gets the band above it
    ctx.fillStyle='#05030c'; ctx.fillRect(0,0,W,H);
    const z=1+0.02*Math.min(1,_titleT/600)+0.005*Math.sin(fr*0.01), s0=W/map.im.naturalWidth;
    const w=map.im.naturalWidth*s0*z, h=map.im.naturalHeight*s0*z;
    ctx.drawImage(map.im,(W-w)/2,H-h+(z-1)*h*0.5,w,h);
    ctx.save(); ctx.globalCompositeOperation='lighter';
    const sg=ctx.createRadialGradient(W/2,H*0.25,10,W/2,H*0.25,230); sg.addColorStop(0,'rgba(140,80,255,'+(0.10+0.06*Math.sin(fr*0.05))+')'); sg.addColorStop(1,'rgba(140,80,255,0)');
    ctx.fillStyle=sg; ctx.fillRect(0,0,W,H); ctx.restore();
    const tg=ctx.createLinearGradient(0,0,0,170); tg.addColorStop(0,'rgba(4,2,12,0.88)'); tg.addColorStop(0.6,'rgba(4,2,12,0.45)'); tg.addColorStop(1,'rgba(4,2,12,0)');
    ctx.fillStyle=tg; ctx.fillRect(0,0,W,170);
    const bg=ctx.createLinearGradient(0,H-230,0,H); bg.addColorStop(0,'rgba(4,2,12,0)'); bg.addColorStop(1,'rgba(4,2,12,0.7)');
    ctx.fillStyle=bg; ctx.fillRect(0,H-230,W,230);
    const k=Math.min(1,_titleT/45), ease=1-Math.pow(1-k,3);
    ctx.save(); ctx.globalAlpha=k;
    uiLogo('MIND & VENTURE',W/2,-90+(96)*ease,58,{sweep:260});
    ctx.restore();
    _drawTitleMenuOverArt(Object.assign({},map,{s:0.75}));
    _drawUiToast();
    drawTextC('© 1993 SONNATA GAMES',W-96,H-14,'rgba(200,184,255,0.6)',1);
    if(window.MV_TITLE_FADE>0){ ctx.fillStyle='rgba(0,0,0,'+(window.MV_TITLE_FADE/24).toFixed(3)+')'; ctx.fillRect(0,0,W,H); window.MV_TITLE_FADE--; }   // in from the skipped logos
    return;
  }
  if(map){
    ctx.imageSmoothingEnabled=true; if(ctx.imageSmoothingQuality) ctx.imageSmoothingQuality='high';
    ctx.drawImage(map.im,map.dx,map.dy,map.im.naturalWidth*map.s,map.im.naturalHeight*map.s);
    _drawTitleMenuOverArt(map);
    return;
  }
  ctx.imageSmoothingEnabled=true; if(ctx.imageSmoothingQuality) ctx.imageSmoothingQuality='high';
  _drawSnesStarfield();
  const im=_titleBgImage(fr), ar=_titleBgRect(im);
  if(ar){
    const z=1.04+0.02*Math.sin(fr*0.004);                 // slow push-in on the key art
    const w=ar.w*z, h=ar.h*z;
    ctx.globalAlpha=0.9; ctx.drawImage(im,(W-w)/2,(H-h)/2,w,h); ctx.globalAlpha=1;
  }
  let g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'rgba(6,2,22,0.85)'); g.addColorStop(0.32,'rgba(6,2,22,0.15)'); g.addColorStop(0.6,'rgba(6,2,22,0.25)'); g.addColorStop(1,'rgba(6,2,22,0.92)');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  const k=Math.min(1,_titleT/50), ease=1-Math.pow(1-k,3), bounce=k<1?0:Math.sin(fr*0.03)*3;
  const ly=-120+(48+120)*ease+bounce;
  ctx.globalAlpha=k;
  uiLogo('MIND & VENTURE',W/2,ly,84);
  const rw=300, rh=40, ry=ly+104;
  const rg=ctx.createLinearGradient(W/2-rw/2,0,W/2+rw/2,0); rg.addColorStop(0,'rgba(246,201,74,0)'); rg.addColorStop(0.18,'rgba(246,201,74,0.95)'); rg.addColorStop(0.82,'rgba(246,201,74,0.95)'); rg.addColorStop(1,'rgba(246,201,74,0)');
  ctx.fillStyle=rg; ctx.fillRect(W/2-rw/2,ry,rw,2); ctx.fillRect(W/2-rw/2,ry+rh-2,rw,2);
  const rb=ctx.createLinearGradient(0,ry,0,ry+rh); rb.addColorStop(0,'rgba(70,30,140,0.0)'); rb.addColorStop(0.5,'rgba(70,30,140,0.75)'); rb.addColorStop(1,'rgba(70,30,140,0.0)');
  ctx.fillStyle=rb; ctx.fillRect(W/2-rw/2,ry+2,rw,rh-4);
  drawTextC('A W D J O O',W/2,ry+11,'#ffe39a',2);
  drawTextC('A SONNATA 16-BIT ADVENTURE',W/2,ry+rh+12,'#c8b8ff',1);
  const hw=uiLogoHalf();
  uiSparkle(W/2+hw-10,ly+14,10+4*Math.sin(fr*0.11),'#fff',0.5+0.5*Math.sin(fr*0.11));
  uiSparkle(W/2-hw+40,ly+70,7+3*Math.sin(fr*0.09+2),'#ffe39a',0.5+0.5*Math.sin(fr*0.09+2));
  ctx.globalAlpha=1;
  const rows=_titleMenuGeom();
  const panelW=360, panelX=W/2-panelW/2, panelY=rows[0].y-20;
  const panelH=rows[rows.length-1].y+rows[rows.length-1].h-rows[0].y+40;
  const mk=Math.min(1,Math.max(0,(_titleT-30)/30));
  ctx.globalAlpha=mk;
  uiPanel(panelX,panelY+(1-mk)*20,panelW,panelH,{r:16,alpha:0.82});
  for(let i=0;i<rows.length;i++){
    const r=rows[i], sel=i===_titleMenuIdx, locked=!!r.locked, oy=(1-mk)*20;
    uiPanel(r.x, r.y+oy, r.w, r.h, {sel, locked, r:r.h/2, flat:!sel});
    if(sel&&!locked) uiCursor(r.x+20,r.y+oy+r.h/2,10);
    const col=locked?(sel?C.GREY:C.GREY_D):(sel?'#ffffff':'#c8b8ff');
    drawTextC(r.label,W/2,r.ty+oy-7,col,2);
    if(locked) drawTextC('BEAT STORY TO UNLOCK',W/2,r.ty+oy+12,C.GREY_D,1);
  }
  ctx.globalAlpha=1;
  _drawUiToast();
  if(!_titleMusicPlaying){ ctx.globalAlpha=0.55+0.45*Math.sin(fr*0.09); drawTextC('PRESS START',W/2,H-58,'#ffe39a',2); ctx.globalAlpha=1; }
  drawTextC('© 1993 SONNATA GAMES',W/2,H-24,'#9c8cc8',1);
}

function drawLevelSelect(){
  ctx.fillStyle=C.BLACK;ctx.fillRect(0,0,W,H);
  ctx.fillStyle=C.GOLD;ctx.fillRect(0,0,W,2);ctx.fillRect(0,H-2,W,2);
  drawTextC('LEVEL SELECT',W/2,12,C.YELLOW,3);
  ZONES.forEach((z,i)=>{const y=48+i*40,sel=i===_levelSelIdx;if(sel){ctx.fillStyle=C.NAVY;ctx.fillRect(10,y-6,W-20,36);}if(sel)drawText('>',16,y,C.WHITE,2);drawText((i+1)+'. '+z.name,40,y,sel?C.SAND:C.MINT,2);drawText(z.sub,40,y+18,sel?C.GREY:C.SILVER,2);});
  drawTextC('ARROWS: CHOOSE  ENTER: PLAY  ESC: BACK',W/2,H-20,C.GREEN,2);
}

function drawTutorialChamber(){
  ctx.fillStyle=C.BLACK;ctx.fillRect(0,0,W,H);
  ctx.fillStyle=C.TEAL;ctx.fillRect(0,0,W,2);ctx.fillRect(0,H-2,W,2);
  drawTextC('TUTORIAL CHAMBER',W/2,16,C.TEAL_L,3);
  drawTextC('Training rooms for every mechanic are on the way.',W/2,H/2-36,C.MINT,2);
  drawTextC('TRS, XLR, MAG, punch, hook, duck - step by step.',W/2,H/2-8,C.GREY,2);
  drawTextC('Laitu will guide you through each chamber.',W/2,H/2+20,C.GREY,2);
  drawTextC('COMING SOON',W/2,H/2+56,C.YELLOW,3);
  drawTextC('ESC OR ENTER: BACK TO MENU',W/2,H-20,C.GREEN,2);
}

function drawStageDesignHub(){
  const items=_stageDesignItems();
  ctx.fillStyle=C.BLACK;ctx.fillRect(0,0,W,H);
  ctx.fillStyle=C.TEAL;ctx.fillRect(0,0,W,2);ctx.fillRect(0,H-2,W,2);
  drawTextC('CREATIVE MODE',W/2,12,C.TEAL_L,3);
  drawTextC('Build and share your own Mind & Venture levels',W/2,40,C.GREY,2);
  const maxShow=Math.min(items.length,12), start=Math.max(0,Math.min(_stageDesignSelIdx-maxShow+1,items.length-maxShow));
  for(let j=0;j<maxShow;j++){const i=start+j,it=items[i],y=72+j*32,sel=i===_stageDesignSelIdx;if(sel){ctx.fillStyle=C.NAVY;ctx.fillRect(10,y-6,W-20,28);}if(sel)drawText('>',16,y,C.WHITE,2);const col=it.action==='new'?C.YELLOW:it.action==='back'?C.GREY:sel?C.SAND:C.MINT;drawText(it.label,40,y,col,2);}
  const stages=getCustomStages().length;
  drawTextC(stages+' saved stage'+(stages===1?'':'s')+' in library',W/2,H-40,C.GREY,2);
  drawTextC('ENTER: EDIT  P: PLAYTEST  ESC: BACK',W/2,H-20,C.GREEN,2);
}

function _mapCoverRect(){ const img=MAP_ART; if(!img.complete||!img.naturalWidth) return {dx:0,dy:0,w:W,h:H}; const s=Math.max(W/img.naturalWidth,H/img.naturalHeight); const qw=Math.max(1,Math.round(img.naturalWidth*s)); const qh=Math.max(1,Math.round(img.naturalHeight*s)); return {dx:(W-qw)>>1,dy:(H-qh)>>1,w:qw,h:qh}; }
function _drawFullCoverArt(img){ if(!img||!img.complete||!img.naturalWidth) return null; const s=Math.max(W/img.naturalWidth,H/img.naturalHeight); const qw=Math.max(1,Math.round(img.naturalWidth*s)); const qh=Math.max(1,Math.round(img.naturalHeight*s)); const dx=(W-qw)>>1,dy=(H-qh)>>1; ctx.imageSmoothingEnabled=true; if(ctx.imageSmoothingQuality) ctx.imageSmoothingQuality='high'; ctx.drawImage(img,dx,dy,qw,qh); return {dx,dy,w:qw,h:qh}; }
function _drawCoverArt(img,qStore,key){ if(!img||!img.complete||!img.naturalWidth) return; const store=qStore||[]; if(!store[key]){const s=Math.max(W/img.naturalWidth,H/img.naturalHeight);store[key]=smsProcessPainted(img,Math.max(1,Math.round(img.naturalWidth*s)),Math.max(1,Math.round(img.naturalHeight*s)));} const q=store[key]; ctx.imageSmoothingEnabled=false; ctx.drawImage(q,(W-q.width)>>1,(H-q.height)>>1); }
function _drawLorePanel(page,frKey,opts={}){
  const {pageNum=0,pageTotal=0,showPrompt=true}=opts;
  const fs=3, bs=2, lh=13*bs, titleH=14*fs, padX=28, panelX=24, panelW=W-48, textMaxW=panelW-padX*2;
  const wrapped=wrapBitmapBlocks(page.lines,textMaxW,bs);
  const bodyH=wrapped.length*lh;
  const panelH=Math.min(Math.floor(H*0.42),titleH+bodyH+64);
  const panelY=H-panelH-20;
  uiPanel(panelX,panelY,panelW,panelH,{r:18,alpha:0.88});
  const titleCol=page.col||C.SAND;
  drawTextC(page.title,W/2,panelY+12,titleCol,fs);
  let lineY=panelY+titleH+14;
  wrapped.forEach((line,i)=>{ if(frKey<i*14) return; if(lineY>panelY+panelH-30) return; ctx.save(); ctx.globalAlpha=Math.min(1,(frKey-i*14)/14); drawTextC(line,W/2,lineY,'#ece4ff',bs); ctx.restore(); lineY+=lh; });
  if(showPrompt){ ctx.save(); ctx.globalAlpha=0.72+0.28*Math.sin(fr*0.1); drawTextC('PRESS ANY KEY',W/2,panelY+panelH-26,'#ffe39a',1); ctx.restore(); }
  if(pageTotal>1){ for(let i=0;i<pageTotal;i++){ ctx.fillStyle=i===pageNum-1?'#ffe39a':'rgba(200,184,255,0.35)'; ctx.beginPath(); ctx.arc(W/2+(i-(pageTotal-1)/2)*16,H-8,i===pageNum-1?4:3,0,Math.PI*2); ctx.fill(); } }
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
  uiPanel(W/2-180,10,360,58,{r:16,alpha:0.85});uiLogo('SONNATA',W/2,12,30,{sweep:360});drawTextC('KNOWL SEED TRAIL',W/2,48,C.TEAL_L,1);
  uiPanel(W/2-260,H-44,520,36,{r:18,alpha:0.85});
  const cur=ZONES[_zoneIdx]?ZONES[_zoneIdx].name:'',nxt=ZONES[_zoneIdx+1]?ZONES[_zoneIdx+1].name:'Summit';
  drawTextC(cur+'  \u2192  '+nxt,W/2,H-36,C.GREEN_L,2);
}
function drawCutscene(){
  if(_cutscenePhase===0){
    ctx.fillStyle=C.BLACK;ctx.fillRect(0,0,W,H);ctx.imageSmoothingEnabled=true;
    drawLaituFigure(W/2,H*0.58,4.1,{glowPhase:0.4});
    drawTextC('NEIGHBOR LAITU',W/2,78,'#a8d4ff',3);
    const fs=2,lh=13*fs,panelH=Math.min(220,48+_laituCutLines.length*lh+36),panelY=H-panelH-20,panelX=24,panelW=W-48;
    uiPanel(panelX,panelY,panelW,panelH,{r:18,accent:'#8ec8ff',alpha:0.9});
    let lineY=panelY+20;
    _laituCutLines.forEach((line,i)=>{ if(_cutsceneFr<i*18) return; if(lineY>panelY+panelH-fs*8) return; drawTextC(line,W/2,lineY,'#ece4ff',fs); lineY+=lh; });
    if(_stageDamageFree&&_cutsceneFr>20) drawTextC('FLAWLESS BONUS +500',W/2,panelY+panelH-30,C.MINT,2);
  }else if(_cutscenePhase===1){ _drawZoneCutArt(_cutscenePage); }
  else if(_cutscenePhase===2||_cutscenePhase===3){ drawSonataMap(); }
  if(_cutscenePhase!==2&&_cutscenePhase!==3&&fr%32<22) drawTextC('PRESS START TO CONTINUE',W/2,H-10,C.GREY,2);
  else if((_cutscenePhase===2||_cutscenePhase===3)&&_cutsceneFr>60&&fr%32<22) drawTextC('PRESS START',W/2,H-10,C.WHITE,2);
}

function drawSelect(){
  const fs=3,fsSm=2;
  ctx.imageSmoothingEnabled=false;
  _drawSnesStarfield();
  const padX=72,panelW=W-padX*2,panelH=_selectStep===0?Math.floor(H*0.62):Math.floor(H*0.68);
  const panelX=padX,panelY=Math.round((H-panelH)/2)-12;
  _drawSnesWindow(panelX,panelY,panelW,panelH,{sel:false});
  const titleY=panelY+28;drawTextC('STORY MODE',W/2,titleY,C.WHITE,fs);drawTextC(_selectStep===0?'HOW DO YOU WANT TO PLAY?':(_playerCount===1?'WHO LEADS?  THE OTHER JOINS AS ALLY':'WHO IS PLAYER 1?'),W/2,titleY+fs*10,C.LILAC,fsSm);
  const _drawCard=(cx,cy,cw,ch,sel,accent,disabled,title,subs)=>{
    const x=Math.round(cx-cw/2),y=cy;
    _drawSnesWindow(x,y,cw,ch,{sel:sel&&!disabled,locked:disabled});
    if(sel&&!disabled) uiCursor(x+22,y+Math.floor(ch*0.28)+14,10);
    const tCol=disabled?C.GREY_D:(sel?C.WHITE:accent);drawTextC(title,cx,y+Math.floor(ch*0.28),tCol,fs);
    let sy2=y+Math.floor(ch*0.28)+fs*9;
    (subs||[]).forEach(line=>{drawTextC(line,cx,sy2,disabled?C.GREY_D:(sel?C.SAND:C.GREY),fsSm);sy2+=textH(fsSm)+6;});
  };
  const cardsY=panelY+Math.floor(panelH*0.38),cardH=_selectStep===0?132:168;
  const cardW=_selectStep===0?Math.floor((panelW-64)/3)-8:Math.floor((panelW-48)/2)-8;
  const gap=_selectStep===0?20:28,rowW=_selectStep===0?cardW*3+gap*2:cardW*2+gap,rowX=W/2-rowW/2;
  if(_selectStep===0){
    const m0=_playModeIdx===0,m1=_playModeIdx===1,m2=_playModeIdx===2;
    const cx0=rowX+cardW/2,cx1=rowX+cardW+gap+cardW/2,cx2=rowX+(cardW+gap)*2+cardW/2;
    _drawCard(cx0,cardsY,cardW,cardH,m0,C.SKY_L,false,'1 PLAYER',['ALLY JOINS YOU','FULL STORY']);
    _drawCard(cx1,cardsY,cardW,cardH,m1,C.MINT,false,'2P LOCAL',['SPLIT KEYBOARD','P1 + P2']);
    _drawCard(cx2,cardsY,cardW,cardH,m2,C.GREY_D,true,'2P ONLINE',['COMING SOON']);
  }else{
    const mSel=_heroChoice==='mind',vSel=_heroChoice==='venture';
    const cxM=rowX+cardW/2,cxV=rowX+cardW+gap+cardW/2;
    _drawCard(cxM,cardsY,cardW,cardH,mSel,C.PURPLE_L,false,'MIND',['PURPLE','WIDE HAT','LEAD SIBLING']);
    _drawCard(cxV,cardsY,cardW,cardH,vSel,C.RED_L,false,'VENTURE',['BLACK HAT','BACK BRIM','BOLD SIBLING']);
    const swY=cardsY+cardH-36;
    if(mSel){ctx.fillStyle=C.PURPLE_L;ctx.fillRect(cxM-28,swY,18,18);ctx.fillStyle=C.LILAC;ctx.fillRect(cxM-6,swY,18,18);}
    if(vSel){ctx.fillStyle=C.RED_L;ctx.fillRect(cxV-28,swY,18,18);ctx.fillStyle=C.ORANGE;ctx.fillRect(cxV-6,swY,18,18);}
  }
  const hintY=panelY+panelH-56;
  if(_selectStep===0){drawTextC('LEFT / RIGHT  —  CHOOSE',W/2,hintY,C.SKY_L,fsSm);drawTextC('ENTER  —  CONTINUE     ESC  —  BACK TO STORY',W/2,hintY+fsSm*9,C.GREY,fsSm);}
  else{drawTextC('LEFT / RIGHT  —  CHANGE HERO',W/2,hintY,C.SKY_L,fsSm);drawTextC('ENTER  —  START GAME     ESC  —  BACK',W/2,hintY+fsSm*9,C.GREY,fsSm);if(_playerCount===2)drawTextC('P2 USES ARROW KEYS + NUMPAD',W/2,hintY+fsSm*18,C.MINT,fsSm);else drawTextC('ALLY STAYS CLOSE, FIGHTS, AND HELPS WHEN YOU NEED IT',W/2,hintY+fsSm*18,C.SAND,fsSm);}
  const modeLbl=_playModeIdx===0?'1 PLAYER':(_playModeIdx===1?'2P LOCAL':'2P ONLINE');
  const footY=panelY+panelH-22;uiPanel(panelX+24,footY-8,panelW-48,fsSm*8+16,{r:12,flat:true,alpha:0.7});
  drawTextC(`MODE: ${modeLbl}   ·   HERO: ${_heroChoice==='mind'?'MIND':'VENTURE'}`,W/2,footY,C.SAND,fsSm);
  _drawUiToast();
  ctx.imageSmoothingEnabled=true;
}

// ── Version bar update (called from draw()) ───────────────────
function updateVersionBar(){
  const inf=document.getElementById('inf');
  const mvVer=document.getElementById('mvVer');
  if(mvVer){
    if(_gameState==='game'&&_battleTestMode){ mvVer.style.fontSize='16px';mvVer.textContent='BATTLE PRACTICE — stats in panel above canvas';mvVer.style.color='#6f6'; }
    else if(_gameState==='game'){ mvVer.style.fontSize='16px';mvVer.style.fontWeight='bold'; const spd=Math.round(Math.abs(p.vx||0)); const b=window.MV_BUILD||'?'; const ed=(typeof _mapEdActive!=='undefined'&&_mapEdActive)?'  |  EDIT AWDJOO':''; mvVer.textContent='build '+b+'  |  MOVE v'+MOVE_BUILD+'  |  speed '+spd+' / '+(typeof MOVE_WALK_TOP!=='undefined'?MOVE_WALK_TOP:MOVE_WALK)+ed; mvVer.style.color=ed?'#8cf':(spd>=6?'#6f6':(spd>=2?'#ff6':'#f66')); }
    else{ mvVer.style.fontSize='16px';mvVer.style.fontWeight='bold'; const track=_titleMusicPath?_titleMusicPath.replace(/^assets\/(?:new music|bgm)\//,''):''; const b=window.MV_BUILD||'?'; mvVer.textContent='build '+b+'  |  MOVE v'+MOVE_BUILD+(track?'  |  '+track:''); mvVer.style.color='#6f6'; }
  }
  if(inf){
    if(!(_battleTestMode&&_gameState==='game')){
      inf.style.fontSize='14px';
      const zone=ZONES[_zoneIdx]?ZONES[_zoneIdx].name:'';
      if(ITEM===2||ITEM===3) inf.textContent=zone+' · '+(ITEM===2?'XLR':'MAG')+' '+p.itemStamina+'%';
      else inf.textContent=zone+' · '+(ITEM>=0?INAMES[ITEM]:'NO ITEM')+' · Knowl '+kColl+'/'+kTotal;
      inf.style.color='';
    }
  }
  if(typeof _syncPhoneHud==='function') _syncPhoneHud();
}
