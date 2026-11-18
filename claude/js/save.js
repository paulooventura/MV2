// ============================================================
//  Mind & Venture — save.js
//  Options, keybinds, localStorage persistence.
//  Must load FIRST — OPT is referenced by audio.js and everything else.
//
//  Controls (Paulo, Nov 2026):
//    P1 keyboard — WASD move · Space jump · V use item · B punch · N item select
//    P2 keyboard — arrows move · Num0 jump · Num2 use item · Num3 punch · NumEnter item select
//  NOTE on the internal action names (verified against main.js):
//    'use'  = _cycleItem()                 -> item SELECT / cycle  (main.js:988)
//    'swap' = "item held" (fire / charge)  -> USE the carried item  (main.js:994)
//  So V (use item) is bound to 'swap', and N (item select) to 'use'.
// ============================================================

const DEFAULT_OPTS={
  musicVol:0.75,
  sfxVol:1.0,
  engineVol:0.8,
  musicMode:'ost', // 'ost' (assets/new music wav) | 'psg' (chiptune fallback)
  // ── Player 1 — left side of the keyboard ──────────────────────
  binds:{
    up:    ['KeyW'],
    down:  ['KeyS'],
    left:  ['KeyA'],
    right: ['KeyD'],
    jump:  ['Space'],
    use:   ['KeyN'],                 // item SELECT (cycle)
    swap:  ['KeyV'],                 // USE the carried item
    punch: ['KeyB'],
    sprint:['ShiftLeft','ShiftRight'],
  },
  // ── Player 2 — arrow cluster + numeric keypad ─────────────────
  binds2:{
    up:    ['ArrowUp'],
    down:  ['ArrowDown'],
    left:  ['ArrowLeft'],
    right: ['ArrowRight'],
    jump:  ['Numpad0'],
    use:   ['NumpadEnter'],          // item SELECT (cycle)
    swap:  ['Numpad2'],              // USE the carried item
    punch: ['Numpad3'],
    sprint:[],
  }
};
let OPT=JSON.parse(JSON.stringify(DEFAULT_OPTS));

// ── Keybind helpers ────────────────────────────────────────────
const BIND_LABELS={
  up:'Move Up', down:'Move Down', left:'Move Left', right:'Move Right',
  jump:'Jump',  use:'Item Select', swap:'Use Item', punch:'Punch', sprint:'Run'
};
const BIND_ORDER=['up','down','left','right','jump','use','swap','punch','sprint'];
function _codeLabel(c){
  return String(c).replace('Key','').replace('Arrow','').replace('Numpad','Num').replace('Digit','');
}
/** Human-readable binds for P1 (which=1, default) or P2 (which=2). */
function _bindList(a,which){
  const b=(which===2?OPT.binds2:OPT.binds)||{};
  return (b[a]||[]).map(_codeLabel).join(', ');
}
function _bindList2(a){ return _bindList(a,2); }

// ── Persistence ────────────────────────────────────────────────
function _normalizeBinds(){
  try{
    if(!OPT.binds)  OPT.binds={};
    if(!OPT.binds2) OPT.binds2={};
    for(const a of BIND_ORDER){
      if(!Array.isArray(OPT.binds[a]))  OPT.binds[a]=DEFAULT_OPTS.binds[a].slice();
      if(!Array.isArray(OPT.binds2[a])) OPT.binds2[a]=DEFAULT_OPTS.binds2[a].slice();
    }
  }catch(e){}
}
function _loadOpts(){
  try{
    const raw=localStorage.getItem('mv_opts');
    if(raw){
      const o=JSON.parse(raw);
      OPT={...DEFAULT_OPTS,...o,
        binds: {...DEFAULT_OPTS.binds, ...(o.binds||{})},
        binds2:{...DEFAULT_OPTS.binds2, ...(o.binds2||{})}};
    }
  }catch(e){}
  _normalizeBinds();
}
function _saveOpts(){
  try{localStorage.setItem('mv_opts',JSON.stringify(OPT));}catch(e){}
}
_loadOpts();

// One-time migrations. The old SNES-style injection (KeyQ as an extra run key)
// is gone: the new two-player layout is reset once, then stays rebindable.
try{
  if(!localStorage.getItem('mv_binds_v2')){
    OPT.binds =JSON.parse(JSON.stringify(DEFAULT_OPTS.binds));
    OPT.binds2=JSON.parse(JSON.stringify(DEFAULT_OPTS.binds2));
    localStorage.setItem('mv_binds_v2','1'); _saveOpts();
  }
  if(!localStorage.getItem('mv_newmusic')){
    OPT.musicMode='ost';
    localStorage.setItem('mv_newmusic','1');
    _saveOpts();
  }
  if(!localStorage.getItem('mv_titleost2')){
    OPT.musicMode='ost';
    localStorage.setItem('mv_titleost2','1');
    _saveOpts();
  }
}catch(e){}
