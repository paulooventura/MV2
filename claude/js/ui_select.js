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
    mind:{name:'MIND', col:'#c48cff', deep:'#3a1466', glow:'170,110,255', role:'THE LEAD SIBLING', tag:'WIDE HAT  ·  STEADY HANDS  ·  BIG IDEAS'},
    venture:{name:'VENTURE', col:'#ff6a5a', deep:'#5a1010', glow:'255,90,80', role:'THE BOLD SIBLING', tag:'BACKWARD CAP  ·  NO BRAKES  ·  ALL NERVE'},
  };
  const MODES=[
    {id:0, name:'1 PLAYER', sub:'SOLO, OR WITH YOUR SIBLING AS BACKUP', icon:'one', col:'#9ef58a'},
    {id:1, name:'2P LOCAL', sub:'SHARE THE KEYBOARD', icon:'two', col:'#7ad8ff'},
    {id:2, name:'2P ONLINE', sub:'COMING SOON', icon:'lock', col:'#6a7a70', locked:true},
  ];
  const anim={mind:0, venture:0, m0:0, m1:0, m2:0, last:null, punch:0};
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
  function hints(list){
    let total=0; for(const [l,t] of list){ ctx.save(); ctx.font='22px "MV Pixel", monospace'; total+=Math.max(34,ctx.measureText(l).width+18); ctx.restore(); total+=10+textW(t,2)+28; }
    let x=W/2-(total-28)/2; const y=H-58;
    for(const [l,t,c] of list) x+=keycap(x,y,l,t,c||'#9ef58a');
  }
  function title(main,sub){
    uiLogo(main,W/2,26,46,{col:'#b8f5a0',sweep:300});
    drawTextC(sub,W/2,96,'#d8ffc8',2);
  }
  function spark(x,y,col){ sparks.push({x,y,vx:(Math.random()-0.5)*0.8,vy:-0.6-Math.random()*1.2,life:60+Math.random()*40,max:100,col,r:1+Math.random()*2.5}); }
  function sparkTick(){
    for(let i=sparks.length-1;i>=0;i--){ const s=sparks[i]; s.x+=s.vx+Math.sin((fr+i*7)*0.05)*0.3; s.y+=s.vy; if(--s.life<=0) sparks.splice(i,1); }
    ctx.save(); ctx.globalCompositeOperation='lighter';
    for(const s of sparks){ const a=Math.min(1,s.life/30)*0.9; ctx.fillStyle=s.col; ctx.globalAlpha=a; ctx.fillRect(Math.round(s.x),Math.round(s.y),Math.ceil(s.r),Math.ceil(s.r)); if(s.r>2.5){ ctx.globalAlpha=a*0.5; ctx.fillRect(Math.round(s.x)-2,Math.round(s.y)+1,s.r+4,1); } }
    ctx.restore();
  }

  // ── step 2: the heroes ──
  function heroCard(key,cx,sel,k){
    const H0=HERO[key], im=IMG[key];
    const sc=0.9+0.1*k, w=Math.round(340*sc), h=Math.round(520*sc), x=Math.round(cx-w/2), bob=sel?Math.sin(fr*0.07)*4:0, y=Math.round(130+(1-k)*26+bob);
    const sk=22*sc;
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
    }
    // the hero's colour washed up from the bottom + a name plate
    const g=ctx.createLinearGradient(0,y+h*0.45,0,y+h); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(0.55,'rgba(4,6,10,0.75)'); g.addColorStop(1,'rgba(4,6,10,0.96)');
    ctx.fillStyle=g; ctx.fillRect(x-sk,y,w+2*sk,h);
    if(sel){ ctx.globalCompositeOperation='overlay'; ctx.fillStyle='rgba('+H0.glow+',0.22)'; ctx.fillRect(x-sk,y,w+2*sk,h); ctx.globalCompositeOperation='source-over'; }
    // scanlines + a light sweep on the lead
    ctx.fillStyle='rgba(0,0,0,0.16)'; for(let yy=y;yy<y+h;yy+=3) ctx.fillRect(x-sk,yy,w+2*sk,1);
    if(sel){ const t=(fr%150)/150, sx0=x-sk+t*(w+2*sk+200)-100, sg=ctx.createLinearGradient(sx0-60,0,sx0+60,0); sg.addColorStop(0,'rgba(255,255,255,0)'); sg.addColorStop(0.5,'rgba(255,255,255,0.14)'); sg.addColorStop(1,'rgba(255,255,255,0)'); ctx.fillStyle=sg; ctx.fillRect(x-sk,y,w+2*sk,h); }
    ctx.restore();
    // frame: double pixel line in the hero colour, glowing on the lead
    ctx.save();
    if(sel){ ctx.shadowColor='rgba('+H0.glow+',0.9)'; ctx.shadowBlur=18+6*Math.sin(fr*0.12); }
    ctx.lineWidth=sel?4:2; ctx.strokeStyle=sel?H0.col:'rgba(120,130,140,0.6)'; cardPath(x,y,w,h,sk); ctx.stroke();
    ctx.shadowBlur=0; ctx.lineWidth=1; ctx.strokeStyle='rgba(0,0,0,0.7)'; cardPath(x+5,y+5,w-10,h-10,sk*0.95); ctx.stroke();
    ctx.restore();
    // name + role + tag
    const ny=y+h-112;
    ctx.save(); if(!sel) ctx.globalAlpha=0.55;
    uiLogo(H0.name,cx,ny,sel?50:40,{col:H0.col,sweep:200});
    drawTextC(H0.role,cx,ny+64,sel?'#ffffff':'#9aa0a8',2);
    drawTextC(H0.tag,cx-4,ny+86,sel?H0.col:'#7a8088',1);
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
    return {x,y,w,h};
  }
  function drawHeroes(){
    const mSel=_heroChoice==='mind';
    if(anim.last!==_heroChoice){ anim.punch=1; anim.last=_heroChoice; for(let i=0;i<24;i++) spark((mSel?W*0.3:W*0.7)+(Math.random()-0.5)*260, H*0.55+(Math.random()-0.5)*260, HERO[_heroChoice].col); }
    anim.mind=ease(anim.mind,mSel?1:0,0.18); anim.venture=ease(anim.venture,mSel?0:1,0.18); anim.punch*=0.86;
    const sib=!!(window.MV_SIBLING&&MV_SIBLING.on);
    title('CHOOSE YOUR LEAD', _playerCount===2?'PLAYER 1 PICKS  ·  PLAYER 2 RIDES THE OTHER':(sib?'THE OTHER SIBLING SHADOWS YOU AND HAS YOUR BACK':'YOU RIDE ALONE  ·  THE OTHER SIBLING WAITS AT HOME'));
    // draw the dimmed card first, the lead on top
    const order=mSel?['venture','mind']:['mind','venture'];
    for(const k of order) heroCard(k, k==='mind'?W*0.29-(k===_heroChoice?anim.punch*10:0):W*0.71+(k===_heroChoice?anim.punch*10:0), k===_heroChoice, anim[k]);
    // the seam between them: a pulsing "&" like the logo
    const pz=1+0.06*Math.sin(fr*0.1)+anim.punch*0.25;
    ctx.save(); ctx.translate(W/2,H*0.48); ctx.scale(pz,pz); uiLogo('&',0,-30,54,{col:'#b8f5a0',sweep:180}); ctx.restore();
    sparkTick();
    if(_playerCount!==2&&window.MV_SIBLING) sibToggle();
    hints(_playerCount!==2&&window.MV_SIBLING?[['<  >','SWITCH','#d8ffc8'],['^  v','SOLO / SIBLING','#d8ffc8'],['ENTER','RIDE OUT',HERO[_heroChoice].col],['ESC','BACK','#8aa090']]:[['<  >','SWITCH','#d8ffc8'],['ENTER','RIDE OUT',HERO[_heroChoice].col],['ESC','BACK','#8aa090']]);
  }
  // Paulo (Oct 22): SOLO, or the other sibling shadowing you as backup (beta_sibling.js)
  let sibRects=[];
  function sibToggle(){
    if(Kj['ArrowUp']||Kj['ArrowDown']||Kj['KeyW']||Kj['KeyS']){ delete Kj['ArrowUp']; delete Kj['ArrowDown']; delete Kj['KeyW']; delete Kj['KeyS']; MV_SIBLING.toggle(); try{ sfx('menu'); }catch(e){} }
    const on=MV_SIBLING.on, other=_heroChoice==='mind'?'venture':'mind', y=H-112, h=34;
    const opts=[{k:false,label:'SOLO'},{k:true,label:HERO[other].name+' SHADOWS YOU'}];
    ctx.save(); ctx.font='22px "MV Pixel", monospace';
    const ws=opts.map(o=>Math.max(160,ctx.measureText(o.label).width+70)); ctx.restore();
    let x=W/2-(ws[0]+ws[1]+14)/2; sibRects=[];
    opts.forEach((o,i)=>{
      const sel=o.k===on, w=ws[i], col=o.k?HERO[other].col:'#d8ffc8';
      ctx.fillStyle='#020a04'; uiRound(x+2,y+3,w,h,h/2); ctx.fill();
      ctx.fillStyle=sel?(o.k?'rgba('+HERO[other].glow+',0.35)':'rgba(120,200,140,0.3)'):'rgba(10,20,14,0.85)'; uiRound(x,y,w,h,h/2); ctx.fill();
      ctx.save(); if(sel){ ctx.shadowColor=col; ctx.shadowBlur=12; } ctx.strokeStyle=sel?col:'rgba(120,150,130,0.5)'; ctx.lineWidth=sel?2.5:1.5; uiRound(x+0.5,y+0.5,w-1,h-1,h/2); ctx.stroke(); ctx.restore();
      drawTextC(o.label,x+w/2+8,y+9,sel?'#ffffff':'#7a8a80',2);
      if(sel&&typeof uiCursor==='function') uiCursor(x+14,y+h/2,7);
      sibRects.push({x,y,w,h,k:o.k}); x+=w+14;
    });
  }
  document.addEventListener('click',e=>{
    if(_gameState!=='select'||_selectStep!==1||!sibRects.length||!window.MV_SIBLING) return;
    const c=document.getElementById('c'); if(!c) return; const r=c.getBoundingClientRect(), mx=(e.clientX-r.left)*(W/r.width), my=(e.clientY-r.top)*(H/r.height);
    for(const b of sibRects) if(mx>=b.x&&mx<=b.x+b.w&&my>=b.y&&my<=b.y+b.h){ if(MV_SIBLING.on!==b.k){ MV_SIBLING.on=b.k; try{ sfx('menu'); }catch(e2){} } e.stopImmediatePropagation(); return; }
  },true);
  window.addEventListener('keydown',e=>{
    if(_gameState!=='select'||_selectStep!==1||_playerCount===2||!window.MV_SIBLING) return;
    if(['ArrowUp','ArrowDown','KeyW','KeyS'].includes(e.code)){ MV_SIBLING.toggle(); try{ sfx('menu'); }catch(e2){} e.preventDefault(); e.stopImmediatePropagation(); }
  },true);

  // ── step 1: the mode ──
  function icon(kind,cx,cy,col,s){
    ctx.save(); ctx.translate(cx,cy); ctx.scale(s,s); ctx.fillStyle=col; ctx.strokeStyle=col; ctx.lineWidth=3;
    const bulb=(x)=>{ ctx.beginPath(); ctx.arc(x,-16,13,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#04140e'; ctx.beginPath(); ctx.ellipse(x,-15,7,5,0,0,Math.PI*2); ctx.fill(); ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,-15,2.6,0,Math.PI*2); ctx.fill();
      ctx.fillRect(x-12,0,24,22); ctx.beginPath(); ctx.arc(x,34,10,0,Math.PI*2); ctx.stroke(); };
    if(kind==='one') bulb(0);
    else if(kind==='two'){ bulb(-20); bulb(20); }
    else { ctx.beginPath(); ctx.arc(0,-6,12,Math.PI,0); ctx.stroke(); ctx.fillRect(-16,-6,32,28); ctx.fillStyle='#04140e'; ctx.fillRect(-2,2,4,10); }
    ctx.restore();
  }
  function drawModes(){
    title('HOW DO YOU RIDE?', 'PICK A MODE  ·  YOU CAN CHANGE IT EVERY NEW STORY');
    const cw=270, ch=330, gap=40, x0=W/2-(cw*3+gap*2)/2;
    MODES.forEach((m,i)=>{
      const sel=_playModeIdx===i, key='m'+i; anim[key]=ease(anim[key],sel?1:0,0.2);
      const k=anim[key], sc=0.92+0.08*k, w=cw*sc, h=ch*sc, cx=x0+i*(cw+gap)+cw/2, x=cx-w/2, y=170+(1-k)*16+(sel?Math.sin(fr*0.08)*3:0), sk=16;
      const rgb=_uiRGB(m.col).join(',');
      if(sel&&!m.locked) rays(cx,y+h*0.4,rgb,k*0.8);
      ctx.save(); ctx.fillStyle='rgba(0,0,0,0.5)'; cardPath(x+7,y+9,w,h,sk); ctx.fill();
      const g=ctx.createLinearGradient(0,y,0,y+h); g.addColorStop(0,sel?'rgba(30,60,40,0.96)':'rgba(10,22,16,0.9)'); g.addColorStop(1,'rgba(3,10,6,0.96)');
      ctx.fillStyle=g; cardPath(x,y,w,h,sk); ctx.fill();
      ctx.save(); cardPath(x,y,w,h,sk); ctx.clip(); ctx.fillStyle='rgba(0,0,0,0.16)'; for(let yy=y;yy<y+h;yy+=3) ctx.fillRect(x-sk,yy,w+2*sk,1); ctx.restore();
      if(sel){ ctx.shadowColor='rgba('+rgb+',0.9)'; ctx.shadowBlur=16; }
      ctx.lineWidth=sel?4:2; ctx.strokeStyle=sel?m.col:'rgba(110,150,120,0.5)'; cardPath(x,y,w,h,sk); ctx.stroke(); ctx.restore();
      icon(m.icon,cx,y+h*0.36,sel?m.col:(m.locked?'#3a4a40':'#5a7a62'),sel?1.7:1.4);
      ctx.save(); if(!sel) ctx.globalAlpha=0.6;
      uiLogo(m.name,cx,y+h-118,sel?34:28,{col:m.locked?'#7a8a80':m.col,sweep:220});
      drawTextC(m.sub,cx,y+h-56,sel?'#ffffff':'#8a9a90',1);
      ctx.restore();
      if(sel&&!m.locked&&fr%4===0) spark(x+Math.random()*w,y+h-20-Math.random()*h*0.5,m.col);
    });
    sparkTick();
    hints([['<  >','CHOOSE','#d8ffc8'],['ENTER','NEXT','#9ef58a'],['ESC','BACK','#8aa090']]);
  }

  window.drawSelect=function(){
    ctx.save(); ctx.imageSmoothingEnabled=false;
    bg();
    if(_selectStep===0) drawModes(); else drawHeroes();
    if(typeof _drawUiToast==='function') _drawUiToast();
    ctx.restore(); ctx.imageSmoothingEnabled=true;
  };
})();
