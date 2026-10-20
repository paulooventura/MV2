// ============================================================
//  beta_input.js — which controls is the player using right now?
//
//  MV_INPUT.dev: 'kb' (keyboard), 'pad' (gamepad) or 'touch' (phone pads).
//  The last thing pressed wins. On-screen hints read it through
//  MV_INPUT.fmt('HOLD {item} TO CHARGE') so a pad player sees X and a
//  keyboard player sees Q (or whatever key they rebound in Options).
//  Tokens: {item} {switch} {punch} {jump} {up} {down} {updown} {left} {right}
//          {ok} {back} {pause} {any} {restart}
// ============================================================
(function(){
  'use strict';
  const I={dev:'kb'};
  window.MV_INPUT=I;
  const key=a=>{ try{ const c=(OPT.binds[a]||[])[0]; return c?_codeLabel(c).toUpperCase():'-'; }catch(e){ return '-'; } };
  const PAD={item:'X', switch:'B', punch:'Y', jump:'A', up:'UP', down:'DOWN', updown:'UP/DOWN', left:'LEFT', right:'RIGHT',
    ok:'A', back:'B', pause:'START', any:'ANY BUTTON', restart:'SELECT'};
  const TOUCH=Object.assign({}, PAD, {pause:'PAUSE', any:'ANY BUTTON', restart:'RESET'});
  function label(t){
    if(I.dev==='pad') return PAD[t];
    if(I.dev==='touch') return TOUCH[t];
    switch(t){
      case 'item': return key('swap');
      case 'switch': return key('use');
      case 'punch': return key('punch');
      case 'jump': return key('jump');
      case 'up': return key('up');
      case 'down': return key('down');
      case 'left': return key('left');
      case 'right': return key('right');
      case 'updown': return key('up')+'/'+key('down');
      case 'ok': return 'ENTER';
      case 'back': case 'pause': return 'ESC';
      case 'any': return 'ANY KEY';
      case 'restart': return 'TAB';
    }
  }
  I.label=label;
  I.fmt=s=>String(s).replace(/\{(\w+)\}/g,(m,t)=>label(t)||m);
  // What the Options rows show for each bind in pad / touch mode
  I.padBind={up:'D-PAD UP', down:'D-PAD DOWN', left:'D-PAD LEFT', right:'D-PAD RIGHT', jump:'A', use:'B', swap:'X', punch:'Y', sprint:'HOLD X'};

  // <html class="pad-in"> hides the phone's on-screen pads while a real controller is in use
  function set(d){ if(I.dev===d) return; I.dev=d; document.documentElement.classList.toggle('pad-in',d==='pad'); }
  window.addEventListener('keydown',e=>{ if(!e.repeat) set('kb'); },true);
  window.addEventListener('touchstart',()=>{ set('touch'); },{capture:true,passive:true});
  function pollPad(){
    try{
      const pads=navigator.getGamepads?navigator.getGamepads():null;
      if(pads) for(const g of pads){
        if(!g) continue;
        const ign=(typeof GP!=='undefined'&&GP.ignore)||{};
        if(g.buttons.some((b,i)=>b&&b.pressed&&!ign[i])||g.axes.some(v=>Math.abs(v)>0.6)){ set('pad'); break; }
      }
    }catch(e){}
    requestAnimationFrame(pollPad);
  }
  requestAnimationFrame(pollPad);
})();
