// ============================================================
//  Mind & Venture — audio.js
//  BGM (OST + PSG chiptune fallback) + all SFX
//  Depends on: OPT (save.js), _gameState / _healFrac / _zoneIdx (globals)
// ============================================================

// ── BGM state ───────────────────────────────────────────────
let _bgmAC=null,_titleGain=null,_gameGain=null;
let _titleSrc=null,_gameSrc=null;
let _titleBuf=null,_gameBuf=null,_storyBuf=null;
let _openingAudioEl=null,_storyAudioEl=null;
let _gameAudioEl=null;
let _audioUnlocked=false;
let _activeBgmType=null;
let _gameLivesFrac=1;
let _healFrac=1;
let _titleMusicPlaying=false;
let _bgmHeldHidden=false;

const _mp3Pool={title:null,story:null,game:null};
const _mp3Failed={title:false,story:false,game:false};
const _bgmFailTries={title:0,story:0,game:0};
let _titleMusicPath=null,_storyMusicPath=null,_gameMusicPath=null;

// ── Track lists ─────────────────────────────────────────────
const NEW_MUSIC_TRACKS=[
  'assets/new music/Arcade Apron SILVER BOSS.wav',
  'assets/new music/Canopy Quest GOLD.wav',
  'assets/new music/Canopy Quest.wav',
  'assets/new music/Cartridge Cannon BRONZE.wav',
  'assets/new music/Crystal Cavern Drift GOLD.wav',
  'assets/new music/Crystal Cavern Drift.wav',
  'assets/new music/Crystal Memory Gate PLAT OPEN.wav',
  'assets/new music/Jungle Byte Trek (1).wav',
  'assets/new music/Jungle Byte Trek.mp3',
  'assets/new music/Jungle Byte Trek.wav',
  'assets/new music/Jungle Pixel Drift (1).wav',
  'assets/new music/Jungle Pixel Drift.wav',
  'assets/new music/Lost Save Shrine DIAM CHILL.wav',
  'assets/new music/Lost Save Shrine PLAT STORY.wav',
  'assets/new music/Pixel Quasar GOLD BOSS .wav',
  'assets/new music/Skyforge Quest (1).wav',
  'assets/new music/Skyforge Quest (2).wav',
  'assets/new music/Skyforge Quest.wav',
  'assets/new music/Temple Canopy Drift PLATINUM.wav',
  'assets/new music/Temple Canopy Drift SILVER.wav',
  'assets/new music/Underground Crown GOLD CHILL.wav',
  'assets/new music/Underground Crown PLAT CHILL.wav',
  'assets/new music/__Cache Fever__.wav',
  'assets/new music/__Cache Fever__GOLD TECH.wav',
];
const TITLE_MUSIC_TRACKS=[
  'assets/new music/Crystal Memory Gate PLAT OPEN.wav',
  'assets/new music/__Cache Fever__.wav',
  'assets/new music/Temple Canopy Drift PLATINUM.wav',
];
const STORY_MUSIC_TRACKS=[
  'assets/new music/Lost Save Shrine PLAT STORY.wav',
  'assets/new music/Underground Crown PLAT CHILL.wav',
  'assets/new music/Lost Save Shrine DIAM CHILL.wav',
];

// ── Zone definitions (also used by PSG sequencer) ───────────
const ZONES=[
  {name:'Awdjoo Town',           sub:'a bucolic village'},
  {name:'Gauder Hills',          sub:'pampas slopes & peaks'},
  {name:"Knowl's Secret Garden", sub:'deep forest jungle'},
  {name:'Corali Cavern',         sub:'crystals & water'},
  {name:'Alitek Factory',        sub:'machines & circuits'},
  {name:"Tradzkul's Lair",       sub:'a sinister castle'},
];

// ── Track pickers ────────────────────────────────────────────
const _musicUrl=(p)=>encodeURI(p).replace(/#/g,'%23');
function _pickFromPool(pool,except){
  if(!pool.length) return null;
  let pick,guard=0;
  do{ pick=pool[Math.floor(Math.random()*pool.length)]; }
  while(pick===except&&pool.length>1&&++guard<16);
  return pick;
}
function _pickRandomNewMusic(except){ return _pickFromPool(NEW_MUSIC_TRACKS,except); }
function _pickTitleMusic(except){ return _pickFromPool(TITLE_MUSIC_TRACKS,except)||_pickRandomNewMusic(except); }
function _pickStoryMusic(except){ return _pickFromPool(STORY_MUSIC_TRACKS,except)||_pickRandomNewMusic(except); }
function _pickBgmPath(type,except){
  if(type==='title') return _pickTitleMusic(except);
  if(type==='story') return _pickStoryMusic(except);
  return _pickRandomNewMusic(except);
}
function _bgmVolFor(type){
  const mv=Math.max(0,Math.min(1,OPT.musicVol||0.75));
  return type==='story'?mv*0.55:type==='game'?mv:mv;
}
function _bgmPathFor(type){
  return type==='game'?_gameMusicPath:type==='story'?_storyMusicPath:_titleMusicPath;
}

// ── Audio element management ─────────────────────────────────
function _wireBgmElement(type,el){
  if(el._mvEndedFn) el.removeEventListener('ended',el._mvEndedFn);
  el.loop=(type==='title'||type==='story');
  if(type==='title'||type==='story') return;
  const onEnded=()=>{
    if(_activeBgmType!==type) return;
    const prev=_gameMusicPath;
    const next=_pickRandomNewMusic(prev);
    if(!next) return;
    _loadBgmElement(type,next);
    _playBGM(type,_bgmVolFor(type));
  };
  el._mvEndedFn=onEnded;
  el.addEventListener('ended',onEnded);
}
function _loadBgmElement(type,path){
  if(!path) return null;
  if(type==='game') _gameMusicPath=path;
  else if(type==='story') _storyMusicPath=path;
  else _titleMusicPath=path;
  const el=new Audio();
  el.preload='auto';
  el.src=_musicUrl(path);
  _wireBgmElement(type,el);
  el.addEventListener('error',()=>_onBgmTrackError(type,path),{once:true});
  el.load();
  _mp3Pool[type]=el;
  if(type==='game') _gameAudioEl=null;
  else if(type==='story') _storyAudioEl=null;
  else _openingAudioEl=null;
  _mp3Failed[type]=false;
  return el;
}
function _onBgmTrackError(type,failedPath){
  _bgmFailTries[type]=(_bgmFailTries[type]||0)+1;
  if(OPT.musicMode==='psg'||_bgmFailTries[type]>10){
    _mp3Failed[type]=true;
    if(_activeBgmType===type) _startProcBgm(type,_bgmVolFor(type));
    return;
  }
  const next=_pickBgmPath(type,failedPath);
  if(!next) return;
  _loadBgmElement(type,next);
  if(_activeBgmType===type) _playBGM(type,_bgmVolFor(type));
}
function _pickAndSetGameMusic(){
  const path=_pickRandomNewMusic(_gameMusicPath);
  if(!path) return;
  _loadBgmElement('game',path);
}

// ── AudioContext ─────────────────────────────────────────────
function _ensureAC(){
  if(!_audioUnlocked) return null;
  if(!_bgmAC)try{_bgmAC=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}
  return _bgmAC;
}
function ga(){return _ensureAC();}

function _preloadMp3Tracks(){
  if(!_titleMusicPath) _loadBgmElement('title',_pickTitleMusic());
  if(!_storyMusicPath) _loadBgmElement('story',_pickStoryMusic(_titleMusicPath));
  if(!_gameMusicPath)  _loadBgmElement('game', _pickRandomNewMusic(_storyMusicPath));
}
function _unlockAudio(){
  if(_audioUnlocked){
    const ac=_ensureAC();
    if(ac&&ac.state==='suspended') ac.resume().catch(()=>{});
    return;
  }
  _audioUnlocked=true;
  try{
    _bgmAC=new(window.AudioContext||window.webkitAudioContext)();
    if(_bgmAC.state==='suspended') _bgmAC.resume().catch(()=>{});
  }catch(e){}
  _preloadMp3Tracks();
  _preloadSfxSamples();
  try{sfx('ping');}catch(e){}
}

// ── PSG MUSIC SEQUENCER ──────────────────────────────────────
//  Pattern-based chiptune renderer: lead square + bass square +
//  LFSR noise drums, rendered offline into looping AudioBuffers.
//  Notes are MIDI numbers (0 = rest), one entry per 8th note.
//  Drums: K=kick  S=snare  H=hat  .=rest
const _PSG_SONGS={
  // Heroic A-minor march
  title:{bpm:112,
    bass:[45,45,40,40,41,41,43,43,45,45,40,40,41,43,45,45],
    lead:[69,72,76,72,69,72,76,79,77,76,74,76,72,71,69,0,
          69,72,76,72,69,72,76,79,81,79,77,76,74,72,71,0],
    drums:'K.H.S.H.K.HKS.HH'},
  // Slow lullaby for the storybook pages
  story:{bpm:76,
    bass:[48,0,43,0,45,0,41,0],
    lead:[64,0,67,0,72,0,71,0,69,0,67,0,64,0,62,0],
    drums:'......H.'},
  // Awdjoo Town — bright bouncy C major
  zone0:{bpm:132,
    bass:[48,48,43,43,45,45,41,41],
    lead:[64,67,72,67,64,67,72,74,76,74,72,67,69,67,64,0,
          64,67,72,67,64,67,72,74,76,79,76,74,72,74,72,0],
    drums:'K.H.S.H.'},
  // Gauder Hills — breezy G major folk
  zone1:{bpm:124,
    bass:[43,43,50,50,52,52,48,48],
    lead:[71,74,79,74,71,67,69,71,72,71,69,67,69,71,69,0,
          71,74,79,74,71,67,69,71,67,69,71,72,74,72,71,0],
    drums:'K..HS..H'},
  // Knowl's Secret Garden — sparse mysterious E minor
  zone2:{bpm:108,
    bass:[40,0,47,0,48,0,45,0],
    lead:[64,0,67,0,71,0,69,67,66,0,67,0,64,0,0,0],
    drums:'......H.'},
  // Corali Cavern — rippling D minor arpeggios
  zone3:{bpm:100,
    bass:[38,0,45,0,46,0,45,0],
    lead:[62,65,69,74,69,65,62,65,60,64,67,72,67,64,60,64],
    drums:'....S...'},
  // Alitek Factory — driving mechanical B minor
  zone4:{bpm:140,
    bass:[35,47,35,47,33,45,33,45],
    lead:[66,0,71,66,0,69,0,66,67,0,69,67,0,66,0,62],
    drums:'KHHKSHKH'},
  // Tradzkul's Lair — menacing C phrygian
  zone5:{bpm:120,
    bass:[36,0,37,0,36,0,43,0],
    lead:[72,0,73,72,0,70,0,67,68,0,67,0,65,0,64,0],
    drums:'K..KS..K'},
};
function _midiF(m){return 440*Math.pow(2,(m-69)/12);}
function _buildBGM(type){
  const ac=_ensureAC(); if(!ac)return null;
  const song=_PSG_SONGS[type]||_PSG_SONGS.title;
  const sr=ac.sampleRate;
  const step=60/song.bpm/2;           // 8th-note grid
  const steps=song.lead.length;
  const N=Math.ceil(sr*step*steps);
  const buf=ac.createBuffer(2,N,sr);
  const L=buf.getChannelData(0),R=buf.getChannelData(1);
  const q=v=>Math.round(Math.max(0,Math.min(1,v))*15)/15; // 16 volume levels
  // Square voice with stepped decay; slide in octaves over the note
  const sq=(t0,f,dur,amp,pan=0,slide=0)=>{
    const i0=Math.round(t0*sr),len=Math.min(Math.round(dur*sr),N-i0);
    for(let i=0;i<len;i++){
      const t=i/sr,k=t/dur;
      const ff=f*Math.pow(2,slide*k);
      const s=Math.sign(Math.sin(2*Math.PI*ff*t));
      const v=s*q(1-k*0.75)*amp;
      L[i0+i]+=v*(0.5+pan*0.5);R[i0+i]+=v*(0.5-pan*0.5);
    }
  };
  // LFSR noise drum; `low` = slower sample-hold (deeper rumble)
  const noise=(t0,dur,amp,low)=>{
    const i0=Math.round(t0*sr),len=Math.min(Math.round(dur*sr),N-i0);
    let lfsr=0x8000,hold=0,cur=1;
    const period=low?24:4;
    for(let i=0;i<len;i++){
      if(--hold<=0){const b=((lfsr&1)^((lfsr>>3)&1));lfsr=(lfsr>>>1)|(b<<15);cur=(lfsr&1)?1:-1;hold=period;}
      const v=cur*q(1-i/len)*amp;
      L[i0+i]+=v;R[i0+i]+=v;
    }
  };
  for(let st=0;st<steps;st++){
    const t=st*step;
    const b=song.bass[st%song.bass.length];
    if(b)sq(t,_midiF(b),step*0.9,0.16,-0.2);
    const m=song.lead[st%song.lead.length];
    if(m)sq(t,_midiF(m),step*0.85,0.11,0.25);
    const d=song.drums?song.drums[st%song.drums.length]:'.';
    if(d==='K'){sq(t,110,0.09,0.2,0,-2);noise(t,0.05,0.1,true);}
    else if(d==='S')noise(t,0.09,0.15,false);
    else if(d==='H')noise(t,0.03,0.06,false);
  }
  // Hard clip — a PSG mixes flat, no analog warmth
  for(let i=0;i<N;i++){
    L[i]=Math.max(-0.85,Math.min(0.85,L[i]));
    R[i]=Math.max(-0.85,Math.min(0.85,R[i]));
  }
  return buf;
}

const _psgZoneBufs={};
function _procBuf(type){
  if(type==='game'){
    const k='zone'+Math.max(0,Math.min(5,_zoneIdx));
    return _psgZoneBufs[k]||(_psgZoneBufs[k]=_buildBGM(k));
  }
  if(type==='story') return _storyBuf||(_storyBuf=_buildBGM('story'));
  return _titleBuf||(_titleBuf=_buildBGM('title'));
}

// ── BGM playback ─────────────────────────────────────────────
function _startProcBgm(type,vol){
  if(!_audioUnlocked) return;
  const ac=_ensureAC(); if(!ac)return;
  const isGame=type==='game';
  if(isGame){
    if(_gameSrc){try{_gameSrc.stop();}catch(e){} _gameSrc=null;}
    if(_gameAudioEl){_gameAudioEl.pause();_gameAudioEl.currentTime=0;}
  }else{
    if(_titleSrc){try{_titleSrc.stop();}catch(e){} _titleSrc=null;}
    if(_openingAudioEl){_openingAudioEl.pause();_openingAudioEl.currentTime=0;}
    if(_storyAudioEl){_storyAudioEl.pause();_storyAudioEl.currentTime=0;}
  }
  const buf=_procBuf(type); if(!buf)return;
  const node=ac.createBufferSource();
  node.buffer=buf; node.loop=true;
  let gain=isGame?_gameGain:_titleGain;
  if(!gain){gain=ac.createGain();gain.connect(ac.destination);if(isGame)_gameGain=gain;else _titleGain=gain;}
  gain.gain.value=vol;
  node.connect(gain);
  node.start(0);
  if(isGame)_gameSrc=node; else _titleSrc=node;
}
function _playBGM(type,vol=0.7){
  _unlockAudio();
  _activeBgmType=type;
  if(typeof document!=='undefined'&&document.hidden&&!/[?&]selftest=/.test(location.search||'')){
    _bgmHeldHidden=true;
    return;
  }
  const useProc=()=>_startProcBgm(type,vol);
  if(OPT.musicMode==='psg'){ useProc(); return; }
  if(_mp3Failed[type]){ useProc(); return; }
  const playReadyEl=(el)=>{
    if(_activeBgmType!==type) return;
    if(type==='game'&&_gameSrc){try{_gameSrc.stop();}catch(e){} _gameSrc=null;}
    else if(_titleSrc){try{_titleSrc.stop();}catch(e){} _titleSrc=null;}
    el.loop=(type==='title'||type==='story');
    el.currentTime=0;
    el.playbackRate=1;
    el.volume=Math.max(0,Math.min(1,vol));
    const p=el.play();
    if(p) p.then(()=>{
      if(type==='game'&&_gameSrc){try{_gameSrc.stop();}catch(e){} _gameSrc=null;}
      else if(_titleSrc){try{_titleSrc.stop();}catch(e){} _titleSrc=null;}
      if(type==='title') _titleMusicPlaying=true;
    }).catch(()=>{
      if(el.readyState>=2){
        if(type==='title') _titleMusicPlaying=false;
        return;
      }
      _onBgmTrackError(type,_bgmPathFor(type));
    });
    else if(_activeBgmType===type) useProc();
  };
  let el=type==='game'?_gameAudioEl:type==='story'?_storyAudioEl:_openingAudioEl;
  if(!el) el=_mp3Pool[type];
  if(!el){
    const path=_pickBgmPath(type,_bgmPathFor(type));
    if(path) el=_loadBgmElement(type,path);
  }
  if(el){
    if(type==='game') _gameAudioEl=el;
    else if(type==='story') _storyAudioEl=el;
    else _openingAudioEl=el;
    if(el.readyState>=2) playReadyEl(el);
    else{
      const ready=()=>{ el.removeEventListener('canplay',ready); el.removeEventListener('error',fail); playReadyEl(el); };
      const fail=()=>{ el.removeEventListener('canplay',ready); _onBgmTrackError(type,el.src); };
      el.addEventListener('canplay',ready,{once:true});
      el.addEventListener('error',fail,{once:true});
    }
    return;
  }
  useProc();
}
function _stopBGM(type){
  if(type==='title'){
    if(_titleSrc){try{_titleSrc.stop();}catch(e){}_titleSrc=null;}
    if(_openingAudioEl){_openingAudioEl.pause();_openingAudioEl.currentTime=0;}
  }
  if(type==='story'){
    if(_titleSrc){try{_titleSrc.stop();}catch(e){}_titleSrc=null;}
    if(_storyAudioEl){_storyAudioEl.pause();_storyAudioEl.currentTime=0;}
  }
  if(type==='game'){
    if(_gameSrc){try{_gameSrc.stop();}catch(e){}_gameSrc=null;}
    if(_gameAudioEl){_gameAudioEl.pause();_gameAudioEl.currentTime=0;}
  }
}
function updateGameBgm(){
  if(_gameState!=='game')return;
  const f=Math.max(0.3,_healFrac);
  const mv=Math.max(0,Math.min(1,OPT.musicVol||0.75));
  if(_gameAudioEl){
    _gameAudioEl.volume=Math.max(0.05,mv*f);
    _gameAudioEl.playbackRate=Math.max(0.5,f);
    return;
  }
  if(!_gameGain)return;
  _gameGain.gain.value=Math.max(0.05,mv*f);
  if(_gameSrc)_gameSrc.playbackRate.value=Math.max(0.5,f);
}
function _applyBgmVolumes(){
  const mv=Math.max(0,Math.min(1,OPT.musicVol||0.75));
  if(_openingAudioEl&&!_openingAudioEl.paused) _openingAudioEl.volume=mv;
  if(_storyAudioEl&&!_storyAudioEl.paused) _storyAudioEl.volume=mv*0.55;
  if(_gameAudioEl&&!_gameAudioEl.paused) _gameAudioEl.volume=mv*0.75;
  if(_titleGain) _titleGain.gain.value=mv;
  if(_gameGain) _gameGain.gain.value=mv*0.75;
}
function _switchMusicMode(){
  if(!_audioUnlocked||!_activeBgmType) return;
  const mv=Math.max(0,Math.min(1,OPT.musicVol||0.75));
  const vol=_activeBgmType==='story'?mv*0.55:_activeBgmType==='game'?mv*0.75:mv;
  _stopBGM(_activeBgmType);
  _playBGM(_activeBgmType,vol);
}

function _holdBgmHidden(){
  if(_bgmHeldHidden) return;
  _bgmHeldHidden=true;
  [_openingAudioEl,_storyAudioEl,_gameAudioEl].forEach((el)=>{
    if(!el) return;
    try{ if(!el.paused) el.pause(); }catch(e){}
  });
  if(_titleSrc){try{_titleSrc.stop();}catch(e){} _titleSrc=null;}
  if(_gameSrc){try{_gameSrc.stop();}catch(e){} _gameSrc=null;}
  if(_bgmAC&&_bgmAC.state==='running') _bgmAC.suspend().catch(()=>{});
}
function _releaseBgmVisible(){
  if(!_bgmHeldHidden) return;
  _bgmHeldHidden=false;
  if(_bgmAC&&_bgmAC.state==='suspended') _bgmAC.resume().catch(()=>{});
  if(!_audioUnlocked||!_activeBgmType) return;
  const mv=Math.max(0,Math.min(1,OPT.musicVol||0.75));
  const vol=_activeBgmType==='story'?mv*0.55:_activeBgmType==='game'?mv*0.75:mv;
  _playBGM(_activeBgmType,vol);
}
function _syncBgmVisibility(){
  if(typeof document==='undefined') return;
  if(document.hidden) _holdBgmHidden();
  else _releaseBgmVisible();
}
if(typeof document!=='undefined'){
  document.addEventListener('visibilitychange',_syncBgmVisibility);
  window.addEventListener('pagehide',_holdBgmHidden);
  window.addEventListener('pageshow',_syncBgmVisibility);
}

// ── SFX SAMPLES ──────────────────────────────────────────────
const SFX_BUILD=2;
const SFX_SAMPLE_PATHS={
  enemy_shut:    'assets/SFX/enemy shut.wav',
  hit_enemy:     'assets/SFX/hit enemy.wav',
  hook_latch:    'assets/SFX/grap attach.wav',
  player_hit:    'assets/SFX/hit.wav',
  jump_reg:      'assets/SFX/jump reg.wav',
  jump_spring:   'assets/SFX/jump good.wav',
  knowl_pickup:  'assets/SFX/Knowl.wav',
  shutdown:      'assets/SFX/shutdown.wav',
};
const _sfxUrl=(p)=>_musicUrl(p)+'?b='+SFX_BUILD;
const _sfxPool={};
const _sfxSampleFailed={};
function _preloadSfxSamples(){
  for(const [k,path] of Object.entries(SFX_SAMPLE_PATHS)){
    const el=new Audio();
    el.preload='auto';
    el.src=_sfxUrl(path);
    el.addEventListener('error',()=>{_sfxSampleFailed[k]=true;},{once:true});
    el.load();
    _sfxPool[k]=el;
  }
}
function _playSfxSample(key,pitch=1){
  const path=SFX_SAMPLE_PATHS[key];
  if(!path||_sfxSampleFailed[key]) return false;
  let el=_sfxPool[key];
  if(!el){
    el=new Audio();
    el.preload='auto';
    el.src=_sfxUrl(path);
    el.addEventListener('error',()=>{_sfxSampleFailed[key]=true;},{once:true});
    el.load();
    _sfxPool[key]=el;
  }
  try{
    const inst=el.cloneNode();
    inst.volume=Math.max(0,Math.min(1,OPT.sfxVol||1));
    inst.playbackRate=Math.max(0.5,Math.min(1.5,pitch));
    const pr=inst.play();
    if(pr) pr.catch(()=>{});
    return true;
  }catch(e){
    _sfxSampleFailed[key]=true;
    return false;
  }
}

// ── PSG SFX ENGINE ───────────────────────────────────────────
let _psgNoiseBuf=null,_psgPerBuf=null;
function _psgBuffers(a){
  if(_psgNoiseBuf) return;
  const len=a.sampleRate|0;
  // White noise from a 16-bit LFSR, like the SN76489 noise channel
  _psgNoiseBuf=a.createBuffer(1,len,a.sampleRate);
  const d=_psgNoiseBuf.getChannelData(0);
  let lfsr=0x8000;
  for(let i=0;i<len;i++){
    const b=((lfsr&1)^((lfsr>>3)&1));
    lfsr=(lfsr>>>1)|(b<<15);
    d[i]=(lfsr&1)?0.6:-0.6;
  }
  // Periodic ("buzz") noise mode
  _psgPerBuf=a.createBuffer(1,len,a.sampleRate);
  const e=_psgPerBuf.getChannelData(0);
  for(let i=0;i<len;i++)e[i]=(i%96<6)?0.7:-0.12;
}
function _psgVol(v){return Math.round(Math.max(0,Math.min(1,v))*15)/15;} // 16 attenuation steps
function _hitSfxPitch(hp,maxHp){
  if(!maxHp||maxHp<=0) return 1;
  return 0.6+0.4*Math.max(0,Math.min(1,hp/maxHp));
}

// ── SFX DISPATCHER ───────────────────────────────────────────
function sfx(t){
  if(!_audioUnlocked) return;
  const pitchable=t==='player_hit'||t==='hurt'||t==='hit_enemy'||t==='hit';
  const pitch=(pitchable&&typeof arguments[1]==='number')?arguments[1]:1;
  const sampleAlias={
    jump:'jump_reg',
    hurt:'player_hit',
    knowl:'knowl_pickup',
  };
  const sampleKey=sampleAlias[t]||t;
  if(SFX_SAMPLE_PATHS[sampleKey]&&_playSfxSample(sampleKey,pitch)) return;
  const a=ga();if(!a)return;const n=a.currentTime;
  const sv=Math.max(0,Math.min(1,OPT.sfxVol||1));
  _psgBuffers(a);
  // Square tone: pitch + volume stepped at 60Hz like a PSG register write per frame
  const o=(f,ef,d,v,dt=0,type='square')=>{
    const osc=a.createOscillator(),g=a.createGain();
    osc.type=type;osc.connect(g);g.connect(a.destination);
    const t0=n+dt,steps=Math.max(1,Math.round(d*60));
    for(let i=0;i<steps;i++){
      const tt=t0+d*i/steps,k=i/steps;
      osc.frequency.setValueAtTime(Math.max(20,f+(ef-f)*k),tt);
      g.gain.setValueAtTime(_psgVol(v*(1-k))*sv*0.5,tt);
    }
    g.gain.setValueAtTime(0,t0+d);
    osc.start(t0);osc.stop(t0+d+.01);
  };
  // Noise burst: white or periodic, stepped decay
  const nz=(d,v,periodic,rate,dt=0)=>{
    const src=a.createBufferSource(),g=a.createGain();
    src.buffer=periodic?_psgPerBuf:_psgNoiseBuf;
    src.loop=true;src.playbackRate.value=rate||1;
    src.connect(g);g.connect(a.destination);
    const t0=n+dt,steps=Math.max(1,Math.round(d*60));
    for(let i=0;i<steps;i++)g.gain.setValueAtTime(_psgVol(v*(1-i/steps))*sv*0.5,t0+d*i/steps);
    g.gain.setValueAtTime(0,t0+d);
    src.start(t0);src.stop(t0+d+.02);
  };
  switch(t){
    case'jump':o(150,650,.09,.16);break;
    case'land':nz(.06,.16);o(90,55,.05,.1);break;
    case'punch':nz(.07,.18,false,0.75);o(165,52,.07,.13,0,'square');o(82,38,.05,.09,0.02,'triangle');break;
    case'hook':o(210,430,.16,.11,0,'triangle');o(130,290,.2,.07,0.03,'sine');nz(.14,.09,false,0.45);break;
    case'hook_charged':o(95,360,.14,.16,0,'triangle');o(55,220,.22,.1,0.04,'sine');nz(.16,.12,false,0.38);break;
    case'hook_latch':nz(.11,.24,false,0.32);o(118,52,.11,.15,0,'square');o(72,40,.08,.09,0.025,'triangle');break;
    case'laser':nz(.05,.24,false,1.6);o(1180,380,.13,.14,0,'sawtooth');o(760,160,.07,.08,0.04,'square');break;
    case'laser_bounce':{const r=arguments[1]||0,base=600*Math.pow(0.66,r);
      o(base*1.4,base*0.4,.08,.1*Math.pow(0.68,r));break;}
    case'laser_charge':{const cf=arguments[1]||0;o(320+cf*780,360+cf*820,.05,.03+cf*.04);break;}
    case'laser_charged_fire':nz(.1,.2,false,1.2);o(920,120,.24,.18,0,'sawtooth');o(420,80,.18,.12,0.05,'square');o(1800,90,.12,.1,0.08,'triangle');break;
    case'xlr':o(200,640,.15,.14);break;
    case'mag':o(460,130,.12,.12);break;
    case'hit':o(240*pitch,90*pitch,.06,.1);nz(.04,.1);break;
    case'hit_enemy':o(240*pitch,90*pitch,.06,.1);nz(.04,.1);break;
    case'player_hit':o(340*pitch,90*pitch,.12,.12);nz(.08,.08,true,0.7*pitch);break;
    case'stomp':o(200,60,.08,.14);nz(.05,.12,true);break;
    case'hurt':o(340*pitch,90*pitch,.12,.12);nz(.08,.08,true,0.7*pitch);break;
    case'knowl':o(660,660,.06,.1);o(880,880,.06,.1,.06);o(1320,1320,.08,.09,.12);break;
    case'knowl_pickup':o(523,523,.06,.12);o(659,659,.06,.11,.06);o(784,784,.06,.1,.12);o(1047,1047,.1,.1,.18);break;
    case'ping':o(1100,1100,.06,.09);break;
    case'ropeSnap':o(300,820,.05,.13);break;
    case'ropeBreak':o(150,60,.1,.16);nz(.08,.14);break;
    case'crank':o(180,140,.03,.06);break;
    case'ropeSlack':o(180,90,.1,.07);break;
    case'click':o(980,980,.03,.06);break;
    case'chargeReady':o(392,392,.07,.11);o(523,523,.09,.1,.07);break;
    case'unlock':[523,659,784,1047,1319].forEach((f,i)=>o(f,f,.1,.1,i*.09));break;
    case'omniblock_chip':nz(.05,.14,false,0.55);o(210,70,.05,.08,0,'triangle');break;
    case'omniblock_shatter':
      nz(.18,.28,false,0.38);nz(.12,.18,true,0.22,0.04);
      o(420,90,.14,.16,0,'square');o(180,48,.16,.14,0.03,'triangle');
      o(90,36,.2,.12,0.06,'sine');break;
  }
}
