// T580 — Monika mv2 alias (locked 2026-11-24). Single token source for shell + menus + ink_vinyl.
(function(){
  'use strict';
  const hex={
    washi_aged:'#E6CFAB',
    washi:'#EFE6D2',
    sumi:'#1C1A19',
    violet_black:'#1E1B27',
    gold:'#C9A24A',
    murasaki:'#5B2A8C',
    vermilion:'#D9472B',
    blood:'#9E1B1B',
    prussian:'#23466B',
    mica:'#B9B3A8',
    usuzumi:'#8C8580',
  };
  function rgb01(h){
    const n=parseInt(h.slice(1),16);
    return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];
  }
  const rgb={};
  for(const k of Object.keys(hex)) rgb[k]=rgb01(hex[k]);
  const ui={
    text:hex.washi,
    textWarm:hex.washi_aged,
    textDim:hex.mica,
    ink:hex.sumi,
    night:hex.violet_black,
    logo:hex.gold,
    accent:hex.gold,
    frame:hex.usuzumi,
    panelLit:hex.gold,
    mind:hex.murasaki,
    venture:hex.vermilion,
  };
  window.MV_PALETTE={hex,rgb,ui};
})();