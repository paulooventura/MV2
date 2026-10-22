// ============================================================
//  Mind & Venture — save.js
//  Options, keybinds, localStorage persistence.
//  Must load FIRST — OPT is referenced by audio.js and everything else.
// ============================================================

const DEFAULT_OPTS={
  musicVol:0.75,
  sfxVol:1.0,
  engineVol:0.8,
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
    sprint:['KeyQ','ShiftLeft','ShiftRight'],   // X = run / item (hold to run, like SNES)
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
  // SNES layout (Paulo, Oct 2026): A jump · B item select · X run/item · Y punch
  if(!localStorage.getItem('mv_binds_snes1')){
    const sp=OPT.binds.sprint||[]; if(!sp.includes('KeyQ')) OPT.binds.sprint=['KeyQ',...sp];
    localStorage.setItem('mv_binds_snes1','1'); _saveOpts();
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

// ── Keybind helpers ──────────────────────────────────────────
const BIND_LABELS={
  up:'Move Up', down:'Move Down', left:'Move Left', right:'Move Right',
  jump:'Jump (A)',  use:'Item Select (B)',   swap:'Use Item (X)', punch:'Punch (Y)', sprint:'Run (X)'
};
const BIND_ORDER=['up','down','left','right','jump','use','swap','punch','sprint'];
function _codeLabel(c){
  return c.replace('Key','').replace('Arrow','').replace('Numpad','Num').replace('Digit','');
}
function _bindList(a){return (OPT.binds[a]||[]).map(_codeLabel).join(', ');}
