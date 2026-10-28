// ============================================================
//  ui_select.js — the Story Mode select screens, in the key art's look
//  (Paulo, Oct 22: "this UI looks terrible… give a fun/hype look/feel to
//  the character selection")
//
//  Two steps, same handlers as before (ui.js): HOW DO YOU RIDE? (1P / 2P
//  local / 2P online) and CHOOSE YOUR LEAD (Mind / Venture).
//  The look: the stage's swirling night sky behind (beta_sky.js), big tilted
//  hero cards cut from the title art, the picked hero lit in its own colour
//  (purple / red) with light rays, rising sparks and a bob, the other one
//  dimmed and tagged ALLY; names in the logo's pixel letters; keycap hints.
//  Everything eases (cards grow / shrink, the seam pulses) so a switch feels
//  like a punch, not a repaint.
// ============================================================
(function(){
  'use strict';
  const IMG={}, FEATHER={};
  for(const k of ['mind','venture']){ const im=new Image(); im.src='assets/ui/hero-'+k+'.png?v=253'; IMG[k]=im; }
  const HERO={
    mind:{name:'MIND', col:'#c48cff', deep:'#3a1466', glow:'170,110,255', role:'THE BIG BROTHER', tag:'STEADY HANDS  ·  BIG IDEAS'},
    venture:{name:'VENTURE', col:'#ff6a5a', deep:'#5a1010', glow:'255,90,80', role:'THE LITTLE BROTHER', tag:'NO BRAKES  ·  ALL NERVE'},
  };
  const MODES=[
    {id:0, name:'SOLO', sub:'YOUR BROTHER STAYS HOME', icon:'one', col:'#9ef58a'},
    {id:1, name:'WITH BROTHER', sub:'SHADOWS YOU, HAS YOUR BACK', icon:'shadow', col:'#ffb86a'},
    {id:2, name:'2P LOCAL', sub:'SHARE THE KEYBOARD', icon:'two', col:'#7ad8ff'},
    {id:3, name:'2P ONLINE', sub:'COMING SOON', icon:'lock', col:'#6a7a70', locked:true},
  ];
  const anim={mind:0, venture:0, m0:0, m1:0, m2:0, m3:0, last:null, punch:0};
  const EYE={mind:{u:0.50,v:0.31}, venture:{u:0.50,v:0.28}};
  let eyeT=0, eyeKey='mind', ask=null;
  const sparks=[];
  const ease=(a,b,k)=>a+(b-a)*k;

  function bg(){
    // the stage sky (swirls, stars, ridge, town) — or a dark fallback
    let ok=false;
    try{ if(window.MV_SKY){ ctx.save(); MV_SKY.draw({stageId:'1.1'}, H*0.9); ctx.restore(); ok=true; } }catch(e){}
    if(!ok){ ctx.fillStyle='#04140e'; ctx.fillRect(0,0,W,H); }
    const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'rgba(2,10,6,0.35)'); g.addColorStop(0.55,'rgba(2,10,6,0.55)'); g.addColorStop(1,'rgba(2,8,4,0.92)');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  }
  // a tilted card: a parallelogram, skewed by `sk` px across its height
  function cardPath(x,y,w,h,sk){ ctx.beginPath(); ctx.moveTo(x+sk,y); ctx.lineTo(x+w+sk,y); ctx.lineTo(x+w-sk,y+h); ctx.lineTo(x-sk,y+h); ctx.closePath(); }
  function rays(cx,cy,rgb,a){
    ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.translate(cx,cy); ctx.rotate(fr*0.004);
    for(let i=0;i<12;i++){ ctx.rotate(Math.PI/6); const g=ctx.createLinearGradient(0,0,0,-420); g.addColorStop(0,'rgba('+rgb+','+(0.16*a)+')'); g.addColorStop(1,'rgba('+rgb+',0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(-14,0); ctx.lineTo(-70,-420); ctx.lineTo(70,-420); ctx.lineTo(14,0); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  function keycap(x,y,label,text,col){
    ctx.save(); ctx.font='22px "MV Pixel", monospace'; const kw=Math.max(34,ctx.measureText(label).width+18); ctx.restore();
    ctx.fillStyle='#020a04'; uiRound(x+2,y+3,kw,30,4); ctx.fill();
    const g=ctx.createLinearGradient(0,y,0,y+30); g.addColorStop(0,'#2c4a34'); g.addColorStop(1,'#122418'); ctx.fillStyle=g; uiRound(x,y,kw,30,4); ctx.fill();
    ctx.strokeStyle=col; ctx.lineWidth=1.5; uiRound(x+0.5,y+0.5,kw-1,29,4); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.fillRect(x+4,y+3,kw-8,2);
    drawTextC(label,x+kw/2,y+7,'#e8ffd8',2);
    drawText(text,x+kw+10,y+7,col,2);
    return kw+10+textW(text,2)+28;
  }
  function hintY(){
    const L=window.uiLayout?uiLayout():{pad:{b:0},oneCol:false};
    if(!L.oneCol) return H-48;
    return H-Math.max(28,(L.pad&&L.pad.b)||0)-4;
  }
  function hints(){
    const L=window.uiLayout?uiLayout():{oneCol:false};
    const line=window.uiMenuHint?uiMenuHint('select'):'TAP TO PICK';
    drawTextC(line,W/2,hintY(),'#d8ffc8',L.oneCol?2:3);
  }
  function title(main,sub){
    const one=window.uiLayout&&uiLayout().oneCol;
    if(one){
      const L=uiLayout();
      const y=Math.max(6,(L.inset&&L.inset.t)||0);
      drawTextC(main,W/2,y,'#f2ffe8',3);
      if(sub) drawTextC(sub,W/2,y+30,'#d8ffc8',2);
      return y+58;
    }
    uiLogo(main,W/2,26,46,{col:'#b8f5a0',sweep:300});
    drawTextC(sub,W/2,108,'#d8ffc8',3);
    return 150;
  }
  function spark(x,y,col){ sparks.push({x,y,vx:(Math.random()-0.5)*0.8,vy:-0.6-Math.random()*1.2,life:60+Math.random()*40,max:100,col,r:1+Math.random()*2.5}); }
  function sparkTick(){
    for(let i=sparks.length-1;i>=0;i--){ const s=sparks[i]; s.x+=s.vx+Math.sin((fr+i*7)*0.05)*0.3; s.y+=s.vy; if(--s.life<=0) sparks.splice(i,1); }
    ctx.save(); ctx.globalCompositeOperation='lighter';
    for(const s of sparks){ const a=Math.min(1,s.life/30)*0.9; ctx.fillStyle=s.col; ctx.globalAlpha=a; ctx.fillRect(Math.round(s.x),Math.round(s.y),Math.ceil(s.r),Math.ceil(s.r)); if(s.r>2.5){ ctx.globalAlpha=a*0.5; ctx.fillRect(Math.round(s.x)-2,Math.round(s.y)+1,s.r+4,1); } }
    ctx.restore();
  }

  // ── step 2: the heroes ──
  function heroCard(key,cx,sel,k,box){
    const H0=HERO[key], im=IMG[key];
    const sc=0.9+0.1*k;
    let w,h,x,y,sk;
    if(box){ w=box.w; h=box.h; x=box.x; y=box.y+(sel?Math.sin(fr*0.07)*3:0); sk=12; cx=x+w/2; }
    else { w=Math.round(340*sc); h=Math.round(480*sc); x=Math.round(cx-w/2); y=Math.round(130+(1-k)*26+(sel?Math.sin(fr*0.07)*4:0)); sk=22*sc; }
    // drop shadow + light rays behind the lead
    if(k>0.05) rays(cx,y+h*0.42,H0.glow,k);
    ctx.save(); ctx.fillStyle='rgba(0,0,0,0.55)'; cardPath(x+8,y+10,w,h,sk); ctx.fill(); ctx.restore();
    // the art
    ctx.save(); cardPath(x,y,w,h,sk); ctx.clip();
    ctx.fillStyle=H0.deep; ctx.fillRect(x-sk,y,w+2*sk,h);
    if(im.complete&&im.naturalWidth){
      ctx.imageSmoothingEnabled=false;
      if(!sel) ctx.filter='grayscale(0.75) brightness(0.5)';
      // behind: the same art blown up, blurred and dark (fills the card); in front: the whole hero
      const cw2=w+2*sk, ch2=cw2*im.naturalHeight/im.naturalWidth;
      ctx.filter=(sel?'':'grayscale(0.75) ')+'blur(6px) brightness(0.45)';
      ctx.drawImage(im, cx-cw2/2, y-(ch2-h)*0.3, cw2, ch2);
      ctx.filter=sel?'none':'grayscale(0.75) brightness(0.5)';
      const zoom=1+0.03*k+(sel?0.008*Math.sin(fr*0.05):0), ih=h*0.98*zoom, iw=ih*im.naturalWidth/im.naturalHeight;
      // feather the portrait's sides into the blur
      const ck=key+'|'+Math.round(iw); let off=FEATHER[ck];
      if(!off){ off=document.createElement('canvas'); off.width=Math.ceil(iw); off.height=Math.ceil(ih); const o=off.getContext('2d'); o.imageSmoothingEnabled=false;
        o.drawImage(im,0,0,iw,ih); o.globalCompositeOperation='destination-in';
        const fg=o.createLinearGradient(0,0,iw,0); fg.addColorStop(0,'rgba(0,0,0,0)'); fg.addColorStop(0.1,'#000'); fg.addColorStop(0.9,'#000'); fg.addColorStop(1,'rgba(0,0,0,0)'); o.fillStyle=fg; o.fillRect(0,0,iw,ih);
        if(Object.keys(FEATHER).length>40) for(const k2 in FEATHER) delete FEATHER[k2];
        FEATHER[ck]=off; }
      ctx.drawImage(off, cx-iw/2, y+h*0.01);
      ctx.filter='none';
      if(sel&&eyeKey===key&&eyeT>0.04){
        const e=EYE[key], z=1+eyeT*3.4;
        const zw=iw*z, zh=ih*z;
        const ex=cx-iw/2+iw*e.u, ey=y+h*0.01+ih*e.v;
        ctx.save(); ctx.globalAlpha=Math.min(1,eyeT*1.35);
        ctx.beginPath(); ctx.arc(ex,ey,18+ (1-eyeT)*h*0.45,0,Math.PI*2); ctx.clip();
        ctx.drawImage(im, ex-zw*e.u, ey-zh*e.v, zw, zh);
        ctx.restore();
      }
    }
    // the hero's colour washed up from the bottom + a name plate
    const g=ctx.createLinearGradient(0,y+h*0.45,0,y+h); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(0.55,'rgba(4,6,10,0.75)'); g.addColorStop(1,'rgba(4,6,10,0.96)');
    ctx.fillStyle=g; ctx.fillRect(x-sk,y,w+2*sk,h);
    if(sel){ ctx.globalCompositeOperation='overlay'; ctx.fillStyle='rgba('+H0.glow+',0.22)'; ctx.fillRect(x-sk,y,w+2*sk,h); ctx.globalCompositeOperation='source-over'; }
    // scanlines + a light sweep on the lead
    ctx.restore();
    ctx.save();
    ctx.lineWidth=sel?4:2; ctx.strokeStyle=sel?H0.col:'rgba(120,130,140,0.6)'; cardPath(x,y,w,h,sk); ctx.stroke();
    ctx.shadowBlur=0; ctx.lineWidth=1; ctx.strokeStyle='rgba(0,0,0,0.7)'; cardPath(x+5,y+5,w-10,h-10,sk*0.95); ctx.stroke();
    ctx.restore();
    // name + role + tag
    const ny=h<200?y+Math.max(8,h-86):y+h-112;
    ctx.save(); if(!sel) ctx.globalAlpha=0.55;
    uiLogo(H0.name,cx,ny,sel?50:40,{col:H0.col,sweep:200});
    drawTextC(H0.role,cx,ny+36,sel?'#ffffff':'#d8ffc8',h<200?2:3);
    if(h>=200) drawTextC(H0.tag,cx,ny+70,sel?H0.col:'#8aa090',2);
    ctx.restore();
    // badge: LEAD / ALLY (or P1 in local co-op)
    const lead=_playerCount===2?'PLAYER 1':'LEAD', ally=_playerCount===2?'PLAYER 2':(window.MV_SIBLING&&!MV_SIBLING.on?'AT HOME':'SHADOW');
    const bt=sel?lead:ally, bw=textW(bt,2)+28, bx=Math.round(cx-bw/2+sk*0.6), by=y-16;
    ctx.save(); ctx.translate(bx+bw/2,by+15); ctx.rotate(-0.05); ctx.translate(-(bx+bw/2),-(by+15));
    ctx.fillStyle='#020a04'; uiRound(bx+2,by+3,bw,30,4); ctx.fill();
    ctx.fillStyle=sel?H0.col:'#2a3036'; uiRound(bx,by,bw,30,4); ctx.fill();
    drawTextC(bt,bx+bw/2,by+7,sel?'#0a0410':'#9aa0a8',2);
    ctx.restore();
    if(sel&&fr%3===0) spark(x+Math.random()*w, y+h-20-Math.random()*h*0.6, H0.col);
    if(sel){
      const beam=(fr%80)/80, L=16;
      ctx.save();
      ctx.strokeStyle=H0.col; ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(x,y+L); ctx.lineTo(x,y); ctx.lineTo(x+L,y);
      ctx.moveTo(x+w-L,y); ctx.lineTo(x+w,y); ctx.lineTo(x+w,y+L);
      ctx.moveTo(x,y+h-L); ctx.lineTo(x,y+h); ctx.lineTo(x+L,y+h);
      ctx.moveTo(x+w-L,y+h); ctx.lineTo(x+w,y+h); ctx.lineTo(x+w,y+h-L);
      ctx.stroke();
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle='rgba('+(H0.glow||'180,255,210')+',0.45)';
      ctx.fillRect(x+10, y+4+beam*(h-10), w-20, 3);
      ctx.restore();
    }
    return {x,y,w,h};
  }
  function phoneHeroRow(key,sel,box){
    const H0=HERO[key], im=IMG[key];
    uiPanel(box.x,box.y,box.w,box.h,{r:14,sel:sel,flat:true,accent:sel?H0.col:'rgba(140,170,150,0.35)'});
    const ph=Math.max(24,box.h-16), pw=Math.min(box.w*0.28, ph*0.85);
    if(im.complete&&im.naturalWidth){
      ctx.save();
      ctx.beginPath(); ctx.rect(box.x+8,box.y+8,pw,ph); ctx.clip();
      if(!sel) ctx.filter='grayscale(0.7) brightness(0.55)';
      const iw=pw, ih=iw*im.naturalHeight/im.naturalWidth;
      ctx.drawImage(im, box.x+8, box.y+8-(ih-ph)*0.35, iw, ih);
      ctx.restore();
    }
    const tx=box.x+pw+22;
    drawText(H0.name, tx, box.y+Math.max(8,box.h*0.22), sel?H0.col:'#d8ffc8', 3);
    drawText(H0.role, tx, box.y+Math.max(40,box.h*0.58), sel?'#ffffff':'#b7c8b4', 2);
    if(sel) drawTextR('LEAD', box.x+box.w-12, box.y+10, H0.col, 2);
    return box;
  }
  function phonePills(label,opts,cur,x,y,w,row,focus){
    const h=40, labW=textW(label,2)+12;
    if(focus){ ctx.save(); ctx.strokeStyle='rgba(216,255,200,'+(0.45+0.35*Math.sin(fr*0.15))+')'; ctx.lineWidth=2; uiRound(x,y-4,w,h+8,12); ctx.stroke(); ctx.restore(); }
    drawText(label,x+6,y+10,'#d8ffc8',2);
    const avail=Math.max(80,w-labW-10), pw=Math.floor((avail-8)/opts.length);
    let xx=x+labW;
    opts.forEach(o=>{
      const on=o.k===cur;
      ctx.fillStyle=on?'rgba(20,40,28,0.95)':'rgba(8,16,12,0.8)';
      uiRound(xx,y,pw,h,h/2); ctx.fill();
      ctx.strokeStyle=on?o.col:'rgba(120,150,130,0.45)'; ctx.lineWidth=on?3:1.5;
      uiRound(xx+1,y+1,pw-2,h-2,h/2); ctx.stroke();
      drawTextC(o.label,xx+pw/2,y+12,on?'#ffffff':'#9aab9c',2);
      sibRects.push({x:xx,y,w:pw,h,row,k:o.k});
      xx+=pw+8;
    });
  }
  function drawPhoneHeroes(){
    const L=uiLayout(), sib=!!(window.MV_SIBLING&&MV_SIBLING.on);
    const top=title('CHOOSE YOUR LEAD', _playerCount===2?'PLAYER 1 PICKS':(sib?'BROTHER RIDES WITH YOU':'BROTHER STAYS HOME'));
    const showSwitches=_playerCount!==2&&window.MV_SIBLING;
    const switchH=showSwitches?48:0;
    const yHint=hintY();
    const ySw=yHint-28-switchH;
    const gap=12;
    const span=Math.max(120, ySw-top-8);
    const rh=Math.floor((span-gap)/2);
    heroRects=[];
    ['mind','venture'].forEach((k,i)=>{
      const box={x:L.panelX, y:top+i*(rh+gap), w:L.panelW, h:rh};
      heroRects.push(Object.assign({k}, phoneHeroRow(k, k===_heroChoice, box)));
    });
    if(showSwitches){
      sibRects=[];
      const y=heroRects[1].y+heroRects[1].h+16;
      phonePills('BROTHER',[{k:false,label:'SOLO',col:'#9ef58a'},{k:true,label:'WITH',col:'#ffb86a'}],!!MV_SIBLING.on,L.panelX,y,L.panelW,1,selRow===1);
    }
    hints();
  }
  function drawHeroes(){
    const mSel=_heroChoice==='mind';
    if(anim.last!==_heroChoice){ anim.punch=1; anim.last=_heroChoice; eyeT=1; eyeKey=_heroChoice; for(let i=0;i<24;i++) spark((mSel?W*0.3:W*0.7)+(Math.random()-0.5)*260, H*0.55+(Math.random()-0.5)*260, HERO[_heroChoice].col); }
    eyeT*=0.9;
    anim.mind=ease(anim.mind,mSel?1:0,0.18); anim.venture=ease(anim.venture,mSel?0:1,0.18); anim.punch*=0.86;
    const one=window.uiLayout&&uiLayout().oneCol;
    if(one){ drawPhoneHeroes(); sparkTick(); return; }
    const sib=!!(window.MV_SIBLING&&MV_SIBLING.on);
    title('CHOOSE YOUR LEAD', _playerCount===2?'PLAYER 1 PICKS. PLAYER 2 RIDES.':(sib?'YOUR BROTHER RIDES WITH YOU':'YOUR BROTHER WAITS AT HOME'));
    const order=mSel?['venture','mind']:['mind','venture'];
    heroRects=[];
    for(const k of order) heroRects.push(Object.assign({k}, heroCard(k, k==='mind'?W*0.29-(k===_heroChoice?anim.punch*10:0):W*0.71+(k===_heroChoice?anim.punch*10:0), k===_heroChoice, anim[k])));
    const pz=1+0.06*Math.sin(fr*0.1)+anim.punch*0.25;
    ctx.save(); ctx.translate(W/2,H*0.48); ctx.scale(pz,pz); uiLogo('&',0,-30,54,{col:'#b8f5a0',sweep:180}); ctx.restore();
    sparkTick();
    if(_playerCount!==2&&window.MV_SIBLING) sibToggle();
    hints();
  }
  // Paulo (Oct 22): on this screen, under the heroes, two switches —
  //   COMPANION: SOLO (the other sibling stays home as an NPC) / WITH SIBLING (it shadows you)
  //   FRIENDLY FIRE: OFF / ON (it can always be punched, blown, pulled and shoved; ON it also gets hurt)
  // ^ v moves between the hero row and the two switches, < > changes the focused one. Mouse / touch: tap.
  let sibRects=[], selRow=0;
  function setCompanion(on){
    if(!window.MV_SIBLING||_playerCount===2) return;
    MV_SIBLING.on=!!on; if(typeof _playModeIdx!=='undefined') _playModeIdx=on?1:0;
  }
  function pillGroup(label,opts,cur,x,y,focus,row){
    const h=34;
    ctx.save(); ctx.font='22px "MV Pixel", monospace';
    const ws=opts.map(o=>Math.max(108,ctx.measureText(o.label).width+56)); ctx.restore();
    const lw=textW(label,2)+14, tw=lw+ws[0]+ws[1]+8;
    if(focus){ ctx.save(); ctx.strokeStyle='rgba(216,255,200,'+(0.55+0.35*Math.sin(fr*0.15))+')'; ctx.lineWidth=2; uiRound(x-8,y-6,tw+16,h+12,12); ctx.stroke(); ctx.restore(); }
    drawText(label,x,y+8,focus?'#ffffff':'#d8ffc8',2);
    let xx=x+lw;
    opts.forEach((o,i)=>{
      const sel=o.k===cur, w=ws[i], col=o.col;
      ctx.fillStyle='#020a04'; uiRound(xx+2,y+3,w,h,h/2); ctx.fill();
      ctx.fillStyle=sel?'rgba('+_uiRGB(col).join(',')+',0.3)':'rgba(10,20,14,0.85)'; uiRound(xx,y,w,h,h/2); ctx.fill();
      ctx.save(); ctx.strokeStyle=sel?col:'rgba(120,150,130,0.5)'; ctx.lineWidth=sel?2.5:1.5; uiRound(xx+0.5,y+0.5,w-1,h-1,h/2); ctx.stroke(); ctx.restore();
      drawTextC(o.label,xx+w/2+(sel?8:0),y+9,sel?'#ffffff':'#7a8a80',2);
      if(sel&&typeof uiCursor==='function') uiCursor(xx+14,y+h/2,7);
      sibRects.push({x:xx,y,w,h,row,k:o.k}); xx+=w+8;
    });
    return tw;
  }
  function sibToggle(){
    sibRects=[];
    const g1=[{k:false,label:'SOLO',col:'#9ef58a'},{k:true,label:'WITH BROTHER',col:'#ffb86a'}];
    const L=window.uiLayout?uiLayout():{oneCol:false,panelX:40,panelW:520,pad:{b:0}};
    if(L.oneCol){
      const y=H-Math.max(110,(L.pad.b||0)+110);
      pillGroup('COMPANION',g1,!!MV_SIBLING.on,L.panelX+12,y,selRow===1,1);
      return;
    }
    ctx.save(); ctx.font='22px "MV Pixel", monospace';
    const w1=g1.reduce((t,o)=>t+Math.max(108,textW(o.label,2)+36),0)+8+textW('COMPANION',2)+14; ctx.restore();
    pillGroup('COMPANION',g1,!!MV_SIBLING.on,W/2-w1/2,H-108,selRow===1,1);
  }
  function rowChange(dx){
    if(ask){ ask.sel=dx>0?1:0; try{ sfx('menu'); }catch(e2){} return; }
    if(selRow===0){ _heroChoice=dx<0?'mind':'venture'; return; }
    if(selRow===1) setCompanion(dx>0);
    try{ sfx('menu'); }catch(e2){}
  }
  // Paulo (Oct 22): pick with the mouse / a finger — a tap on a card picks it, a tap on the picked
  // card goes on; the switches switch. A tap anywhere else does nothing.
  let modeRects=[], heroRects=[], lastTouch=0;
  const inR=(b,mx,my)=>mx>=b.x&&mx<=b.x+b.w&&my>=b.y&&my<=b.y+b.h;
  function selectTap(cx,cy){
    const c=document.getElementById('c'); if(!c) return;
    const r=c.getBoundingClientRect(), mx=(cx-r.left)*(W/r.width), my=(cy-r.top)*(H/r.height);
    const beep=()=>{ try{ sfx('menu'); }catch(e2){} };
    if(_selectStep===0){
      for(const b of modeRects) if(inR(b,mx,my)){ if(_playModeIdx===b.i) startGame(); else { _playModeIdx=b.i; beep(); } return; }
      return;
    }
    if(ask){
      const mid=W/2;
      ask.sel=mx<mid?0:1;
      beep();
      startGame();
      return;
    }
    if(_playerCount!==2&&window.MV_SIBLING) for(const b of sibRects) if(inR(b,mx,my)){
      selRow=b.row;
      if(b.row===1&&!!MV_SIBLING.on!==b.k){ setCompanion(b.k); beep(); }
      return;
    }
    for(const b of heroRects) if(inR(b,mx,my)){ selRow=0; if(_heroChoice===b.k) startGame(); else { _heroChoice=b.k; beep(); } return; }
  }
  document.addEventListener('click',e=>{
    if(_gameState!=='select') return;
    e.stopImmediatePropagation();
    if(performance.now()-lastTouch<700) return;               // the click a tap makes after its touchstart
    if(typeof _unlockAudio==='function') _unlockAudio();
    selectTap(e.clientX,e.clientY);
  },true);
  document.addEventListener('touchstart',e=>{
    if(_gameState!=='select'||!e.touches||!e.touches[0]) return;
    if(e.target&&e.target.id!=='c') return;                   // on-screen pad buttons keep working
    e.stopImmediatePropagation(); lastTouch=performance.now();
    if(typeof _unlockAudio==='function') _unlockAudio();
    selectTap(e.touches[0].clientX,e.touches[0].clientY);
  },{capture:true,passive:true});
  // the pad (player.js): dy moves between rows, dx changes the focused row. Returns true if it took it.
  window.MV_SELECT_NAV=function(dx,dy){
    if(_gameState!=='select'||(!dx&&!dy)) return false;
    const one=window.uiLayout&&uiLayout().oneCol;
    if(_selectStep===0){
      if(one){
        const d=(dy||dx)>0?1:3;
        _playModeIdx=(_playModeIdx+d)%4;
      }else{
        let col=_playModeIdx%2, row=(_playModeIdx/2)|0;
        if(dx) col=(col+(dx>0?1:-1)+2)%2;
        if(dy) row=(row+(dy>0?1:-1)+2)%2;
        _playModeIdx=row*2+col;
      }
      try{ sfx('menu'); }catch(e2){}
      return true;
    }
    if(ask){
      if(dx) ask.sel=dx>0?1:0;
      try{ sfx('menu'); }catch(e2){}
      return true;
    }
    if(_playerCount===2||!window.MV_SIBLING){
      if(dx<0||(one&&dy<0)) _heroChoice='mind';
      if(dx>0||(one&&dy>0)) _heroChoice='venture';
      return true;
    }
    if(one&&selRow===0&&dy){
      if(dy>0&&_heroChoice==='mind'){ _heroChoice='venture'; try{ sfx('menu'); }catch(e2){} return true; }
      if(dy<0&&_heroChoice==='venture'){ _heroChoice='mind'; try{ sfx('menu'); }catch(e2){} return true; }
    }
    if(dy){ selRow=Math.max(0,Math.min(1,selRow+dy)); try{ sfx('menu'); }catch(e2){} }
    if(dx) rowChange(dx);
    return true;
  };
  window.MV_SELECT_FF_TOGGLE=function(){ window.MV_SELECT_NAV(0,1); };
  window.addEventListener('keydown',e=>{
    if(_gameState!=='select'||_selectStep!==1||_playerCount===2||!window.MV_SIBLING) return;
    const dy={ArrowUp:-1,KeyW:-1,ArrowDown:1,KeyS:1}[e.code]||0, dx={ArrowLeft:-1,KeyA:-1,ArrowRight:1,KeyD:1}[e.code]||0;
    if(dx||dy){ window.MV_SELECT_NAV(dx,dy); e.preventDefault(); e.stopImmediatePropagation(); }
    if(e.code==='Escape'||e.code==='Backspace') selRow=0;
  },true);

  // ── step 1: the mode ──
  function icon(kind,cx,cy,col,s){
    ctx.save(); ctx.translate(cx,cy); ctx.scale(s,s); ctx.fillStyle=col; ctx.strokeStyle=col; ctx.lineWidth=3;
    const bulb=(x)=>{ ctx.beginPath(); ctx.arc(x,-16,13,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#04140e'; ctx.beginPath(); ctx.ellipse(x,-15,7,5,0,0,Math.PI*2); ctx.fill(); ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,-15,2.6,0,Math.PI*2); ctx.fill();
      ctx.fillRect(x-12,0,24,22); ctx.beginPath(); ctx.arc(x,34,10,0,Math.PI*2); ctx.stroke(); };
    if(kind==='one') bulb(0);
    else if(kind==='two'){ bulb(-20); bulb(20); }
    else if(kind==='shadow'){ ctx.globalAlpha=0.45; bulb(-22); ctx.globalAlpha=1; ctx.fillStyle=col; bulb(14); }
    else { ctx.beginPath(); ctx.arc(0,-6,12,Math.PI,0); ctx.stroke(); ctx.fillRect(-16,-6,32,28); ctx.fillStyle='#04140e'; ctx.fillRect(-2,2,4,10); }
    ctx.restore();
  }
  function drawModes(){
    const L=window.uiLayout?uiLayout():{oneCol:false,panelW:520,panelX:(1024-520)/2,pad:{b:0},inset:{t:0}};
    const one=L.oneCol;
    const top=title('HOW DO YOU RIDE?', 'PICK HOW YOU GO')+(one?8:0);
    const gap=16;
    const bottom=one?hintY()-36:H-64;
    const want=one?112:200;
    const fit=Math.max(1, Math.min(one?4:2, Math.floor((bottom-top+gap)/(want+gap))));
    const vis=one?fit:4;
    const start=one?Math.max(0, Math.min(_playModeIdx, MODES.length-vis)):0;
    const cols=one?1:2;
    const cw=one?L.panelW:Math.min(360, Math.floor((W-80-gap)/2));
    const ch=Math.min(one?140:220, Math.floor((bottom-top-(Math.max(1,one?vis:2)-1)*gap)/(one?vis:2)));
    const gridW=cols*cw+(cols-1)*gap;
    const x0=Math.round((W-gridW)/2), y0=top;
    modeRects=[];
    if(one&&start>0) drawTextC('^', W/2, top-8, '#d8ffc8', 2);
    MODES.forEach((m,i)=>{
      if(one&&(i<start||i>=start+vis)) return;
      const col=one?0:i%2, row=one?(i-start):(i/2)|0;
      const sel=_playModeIdx===i, key='m'+i; anim[key]=ease(anim[key],sel?1:0,0.2);
      const k=anim[key], sc=0.96+0.04*k, w=cw*sc, h=ch*sc;
      const cx=x0+col*(cw+gap)+cw/2, x=cx-w/2, y=y0+row*(ch+gap)+(1-k)*8+(sel?Math.sin(fr*0.08)*2:0), sk=one?8:14;
      modeRects.push({i,x:x-sk,y,w:w+sk,h});
      const rgb=_uiRGB(m.col).join(',');
      if(sel&&!m.locked) rays(cx,y+h*0.4,rgb,k*0.8);
      ctx.save(); ctx.fillStyle='rgba(0,0,0,0.5)'; cardPath(x+7,y+9,w,h,sk); ctx.fill();
      const g=ctx.createLinearGradient(0,y,0,y+h); g.addColorStop(0,sel?'rgba(30,60,40,0.96)':'rgba(10,22,16,0.9)'); g.addColorStop(1,'rgba(3,10,6,0.96)');
      ctx.fillStyle=g; cardPath(x,y,w,h,sk); ctx.fill();
      ctx.lineWidth=sel?4:2; ctx.strokeStyle=sel?m.col:'rgba(110,150,120,0.5)'; cardPath(x,y,w,h,sk); ctx.stroke(); ctx.restore();
      const short=h<150;
      icon(m.icon,cx,short?y+28:y+h*0.34,sel?m.col:(m.locked?'#3a4a40':'#5a7a62'),short?1: (sel?1.5:1.2));
      ctx.save(); if(!sel) ctx.globalAlpha=0.6;
      uiLogo(m.name,cx,short?y+h-52:(y+h-100),m.name.length>9?(sel?22:20):(sel?30:26),{col:m.locked?'#7a8a80':m.col,sweep:220});
      drawTextC(m.sub,cx,short?y+h-22:y+h-36,sel?'#ffffff':'#d8ffc8',2);
      ctx.restore();
      if(sel&&!m.locked&&fr%4===0) spark(x+Math.random()*w,y+h-20-Math.random()*h*0.5,m.col);
    });
    if(one&&start+vis<MODES.length) drawTextC('v', W/2, bottom-4, '#d8ffc8', 2);
    sparkTick();
    hints();
  }

  function drawAsk(){
    if(!ask) return;
    const two=_playerCount===2;
    ctx.save();
    ctx.fillStyle='rgba(4,8,6,0.72)'; ctx.fillRect(0,0,W,H);
    const pw=Math.min(640,W-48), ph=220, px=(W-pw)/2, py=(H-ph)/2;
    if(typeof uiPanel==='function') uiPanel(px,py,pw,ph,{r:16});
    else { ctx.fillStyle='#102018'; ctx.fillRect(px,py,pw,ph); }
    drawTextC(two?'CALL YOUR BROTHER?':'DOES YOUR BROTHER COME?', W/2, py+28, '#f2ffe8', 3);
    drawTextC(two?'PLAYER 2 RIDES WITH YOU':'COME ALONG, OR STAY IN THE HOUSE', W/2, py+68, '#d8ffc8', 2);
    const opts=two?['CALL','NOT NOW']:['COMES','STAYS'];
    opts.forEach((t,i)=>{
      const on=ask.sel===i, bw=220, bx=W/2-240+i*250, by=py+110;
      ctx.fillStyle=on?'#1c3a28':'#0c1812';
      if(typeof uiRound==='function'){ uiRound(bx,by,bw,52,10); ctx.fill(); }
      else ctx.fillRect(bx,by,bw,52);
      ctx.strokeStyle=on?'#b8f5a0':'#3a5a48'; ctx.lineWidth=on?3:1.5;
      if(typeof uiRound==='function'){ uiRound(bx,by,bw,52,10); ctx.stroke(); }
      drawTextC(t, bx+bw/2, by+16, on?'#ffffff':'#9aab9c', 2);
    });
    ctx.restore();
  }
  window.MV_SELECT_GATE=function(){
    if(window.MV_SIBLING) MV_SIBLING.ff=true;
    if(ask){
      if(_playerCount===2&&ask.sel===1){ ask=null; _selectStep=0; return true; }
      if(_playerCount!==2) setCompanion(ask.sel===0);
      else if(window.MV_SIBLING) MV_SIBLING.on=false;
      ask=null;
      return false;
    }
    ask={sel:_playerCount===2?0:(window.MV_SIBLING&&MV_SIBLING.on?0:1)};
    return true;
  };
  window.drawSelect=function(){
    ctx.save(); ctx.imageSmoothingEnabled=false;
    bg();
    if(_selectStep===0) drawModes(); else drawHeroes();
    drawAsk();
    if(typeof _drawUiToast==='function') _drawUiToast();
    ctx.restore(); ctx.imageSmoothingEnabled=true;
  };
})();
