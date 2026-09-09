// ============================================================
//  Mind & Venture — save.js
//  Options, keybinds, localStorage persistence.
//  Must load FIRST — OPT is referenced by audio.js and everything else.
// ============================================================

const DEFAULT_OPTS={
  musicVol:0.75,
  sfxVol:1.0,
  musicMode:'ost', // 'ost' (assets/new music wav) | 'psg' (chiptune fallback)
  binds:{
    up:    ['KeyW','ArrowUp'],
    down:  ['KeyS','ArrowDown'],
    left:  ['KeyA','ArrowLeft'],
    right: ['KeyD','ArrowRight'],
    jump:  ['Space'],
    use:   ['KeyE'],
    swap:  ['KeyQ'],
    punch: ['KeyF'],
    sprint:['ShiftLeft','ShiftRight'],
  }
};
let OPT=JSON.parse(JSON.stringify(DEFAULT_OPTS));

function _loadOpts(){
  try{
    const raw=localStorage.getItem('mv_opts');
    if(!raw) return;
    const o=JSON.parse(raw);
    OPT={...DEFAULT_OPTS,...o,binds:{...DEFAULT_OPTS.binds,...(o.binds||{})}};
    if(!OPT.binds.sprint||!OPT.binds.sprint.length) OPT.binds.sprint=['ShiftLeft','ShiftRight'];
  }catch(e){}
}
function _saveOpts(){
  try{localStorage.setItem('mv_opts',JSON.stringify(OPT));}catch(e){}
}
_loadOpts();

// One-time migration flags — force OST mode on first run
try{
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

// ── Keybind helpers ──────────────────────────────────────────
const BIND_LABELS={
  up:'Move Up', down:'Move Down', left:'Move Left', right:'Move Right',
  jump:'Jump (A)',  use:'Item Select (Y)',   swap:'Item Action (X)', punch:'Punch (B)', sprint:'Sprint'
};
const BIND_ORDER=['up','down','left','right','jump','use','swap','punch','sprint'];
function _codeLabel(c){
  return c.replace('Key','').replace('Arrow','').replace('Numpad','Num').replace('Digit','');
}
function _bindList(a){return (OPT.binds[a]||[]).map(_codeLabel).join(', ');}
