// ============================================================
//  ui_manual.js — the instruction booklet + credits (Options → MANUAL & CREDITS)
//  (Paulo, Oct 22: "like the manual booklets they had back in the days for the
//  SNES and Genesis games… credits show our progress and curious facts, in a
//  sequence of slides")
//
//  A printed booklet on a dark table: cream paper with halftone, slanted red
//  title ribbons in heavy italic type, boxed art with hard shadows, HINT!
//  starbursts, page numbers. LEFT/RIGHT turn the page (it slides), ESC closes.
//  Pages: cover · the story · the heroes · controls · the four jacks · Awdjoo
//  Town · tips · credits · progress · curious facts · back cover.
// ============================================================
(function(){
  'use strict';
  const FONTS=[['MV Booklet Head','assets/fonts/exo2-900i.woff2',{style:'italic',weight:'900'}],['MV Booklet Body','assets/fonts/nunito-800.woff2',{weight:'800'}]];
  let fontsOk=false;
  try{ Promise.all(FONTS.map(([n,u,d])=>new FontFace(n,'url('+u+')',d).load().then(f=>{ document.fonts.add(f); }))).then(()=>{ fontsOk=true; }).catch(()=>{}); }catch(e){}
  const IMG={};
  const img=(k,src)=>{ if(!IMG[k]){ const im=new Image(); im.src=src; IMG[k]=im; } return IMG[k]; };
  const ready=im=>im&&im.complete&&im.naturalWidth>0;
  const HEAD=()=>fontsOk?'"MV Booklet Head", "Arial Black", sans-serif':'"Arial Black", Impact, sans-serif';
  const BODY=()=>fontsOk?'"MV Booklet Body", "Trebuchet MS", sans-serif':'"Trebuchet MS", Arial, sans-serif';
  const PAPER='#f2e8cc', INK='#1d1a22', RED='#c8281e', BLUE='#1f4fa8', GOLD='#e8a820';

  const S={page:0, from:0, t:1, back:'options'};
  // ── tiny typesetting kit ──
  function wrap(text,x,y,maxW,size,lh,col,opt){
    ctx.save(); ctx.font=(opt&&opt.bold?'800 ':'')+size+'px '+BODY(); ctx.fillStyle=col||INK; ctx.textBaseline='top';
    const words=String(text).split(' '); let line='', yy=y;
    for(const w of words){ const t=line?line+' '+w:w; if(ctx.measureText(t).width>maxW&&line){ ctx.fillText(line,x,yy); yy+=lh; line=w; } else line=t; }
    if(line){ ctx.fillText(line,x,yy); yy+=lh; }
    ctx.restore(); return yy;
  }
  function ribbon(text,x,y,w,col){
    ctx.save(); ctx.translate(x,y); ctx.rotate(-0.035);
    ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.moveTo(6,6); ctx.lineTo(w+20,6); ctx.lineTo(w+6,52); ctx.lineTo(-8,52); ctx.closePath(); ctx.fill();
    ctx.fillStyle=col||RED; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(w+14,0); ctx.lineTo(w,46); ctx.lineTo(-14,46); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.fillRect(-10,4,w+20,4);
    ctx.font='34px '+HEAD(); ctx.textBaseline='middle'; ctx.lineJoin='round';
    ctx.lineWidth=6; ctx.strokeStyle='#14070a'; ctx.strokeText(text,10,25); ctx.fillStyle='#fff8e6'; ctx.fillText(text,10,25);
    ctx.restore();
  }
  function framed(im,x,y,w,h,opt){
    ctx.save(); ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(x+6,y+6,w,h); ctx.fillStyle='#000'; ctx.fillRect(x-3,y-3,w+6,h+6);
    if(ready(im)){ ctx.imageSmoothingEnabled=!(opt&&opt.pixel); const sx=(opt&&opt.sx)||0, sy=(opt&&opt.sy)||0, sw=(opt&&opt.sw)||im.naturalWidth, sh=(opt&&opt.sh)||im.naturalHeight;
      const k=Math.max(w/sw,h/sh), dw=sw*k, dh=sh*k; ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip(); ctx.drawImage(im,sx,sy,sw,sh,x+(w-dw)/2,y+(h-dh)*((opt&&opt.ay!=null)?opt.ay:0.5),dw,dh); }
    else { ctx.fillStyle='#333'; ctx.fillRect(x,y,w,h); }
    ctx.restore();
  }
  function starburst(x,y,r,text,col){
    ctx.save(); ctx.translate(x,y); ctx.rotate(0.12);
    ctx.beginPath(); for(let i=0;i<24;i++){ const a=i/24*Math.PI*2, rr=i%2?r*0.72:r; ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr); } ctx.closePath();
    ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.save(); ctx.translate(4,4); ctx.fill(); ctx.restore();
    ctx.fillStyle=col||GOLD; ctx.fill(); ctx.lineWidth=3; ctx.strokeStyle='#14070a'; ctx.stroke();
    ctx.font=Math.round(r*0.42)+'px '+HEAD(); ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.lineWidth=4; ctx.strokeStyle='#fff'; ctx.strokeText(text,0,0); ctx.fillStyle=RED; ctx.fillText(text,0,0);
    ctx.restore();
  }
  function box(x,y,w,h,title,col){
    ctx.save(); ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(x+5,y+5,w,h);
    ctx.fillStyle='#fffaf0'; ctx.fillRect(x,y,w,h); ctx.lineWidth=3; ctx.strokeStyle=col||BLUE; ctx.strokeRect(x,y,w,h);
    if(title){ ctx.fillStyle=col||BLUE; ctx.fillRect(x,y,w,26); ctx.font='18px '+HEAD(); ctx.fillStyle='#fff'; ctx.textBaseline='middle'; ctx.fillText(title,x+10,y+14); }
    ctx.restore();
  }
  function label(t,x,y,size,col,align){ ctx.save(); ctx.font=size+'px '+HEAD(); ctx.fillStyle=col||INK; ctx.textAlign=align||'left'; ctx.textBaseline='top'; ctx.fillText(t,x,y); ctx.restore(); }

  // the jack crops in the item-box sheet (1536×1024): TRS, RCA, XLR, MAG
  const JACK_X=[56,432,808,1180];
  const PAGES=[
    // 1 · cover
    (x,y,w,h)=>{
      ctx.fillStyle='#0c1a12'; ctx.fillRect(x,y,w,h);
      framed(img('title','assets/story/title-frame-00.png?v=215'),x+28,y+120,w-56,h-260,{sy:0,sh:700,sx:150,sw:1236});
      ctx.save(); ctx.fillStyle=RED; ctx.fillRect(x,y,w,96); ctx.fillStyle=GOLD; ctx.fillRect(x,y+96,w,6); ctx.restore();
      label('INSTRUCTION BOOKLET',x+w/2,y+18,22,'#fff8e6','center');
      if(typeof uiLogo==='function') uiLogo('MIND & VENTURE',x+w/2,y+44,40,{col:'#b8f5a0',sweep:9999});
      label('AWDJOO TOWN EDITION',x+w/2,y+h-128,20,'#9ef58a','center');
      ctx.save(); ctx.fillStyle=GOLD; ctx.beginPath(); ctx.arc(x+w-70,y+h-70,46,0,Math.PI*2); ctx.fill(); ctx.lineWidth=4; ctx.strokeStyle='#14070a'; ctx.stroke();
      ctx.font='13px '+HEAD(); ctx.fillStyle='#14070a'; ctx.textAlign='center'; ctx.fillText('MMR',x+w-70,y+h-88); ctx.fillText('SEAL OF',x+w-70,y+h-72); ctx.fillText('GROOVE',x+w-70,y+h-56); ctx.restore();
      label('SONNATA GAMES · 16-BIT ADVENTURE',x+30,y+h-62,16,'#c8b8ff');
    },
    // 2 · the story
    (x,y,w,h)=>{
      ribbon('THE STORY',x+30,y+30,260);
      framed(img('s1','assets/story/story-1.png'),x+30,y+100,w-60,200,{ay:0.4});
      let yy=y+320;
      const P=typeof STORY_PAGES!=='undefined'?STORY_PAGES:[];
      for(const pg of P){ label(pg.title,x+30,yy,17,RED); yy=wrap(pg.lines.join(' '),x+30,yy+22,w-60,15,19); yy+=8; if(yy>y+h-40) break; }
    },
    // 3 · the heroes
    (x,y,w,h)=>{
      ribbon('MEET THE HEROES',x+30,y+30,330,BLUE);
      const cw=(w-90)/2;
      [['mind','MIND','#6a2cc8','The lead sibling. Wide black hat, purple circuits, steady hands and big ideas. Rolls on a dirt-bike wheel with a V8 in the hub.'],
       ['venture','VENTURE','#c8281e','The bold sibling. Backward cap, red circuits, no brakes and all nerve. Rides along as your ally — or as Player 2.']].forEach(([k,n,c,t],i)=>{
        const bx=x+30+i*(cw+30), by=y+100;
        framed(img('h'+k,'assets/ui/hero-'+k+'.png'),bx,by,cw,300,{ay:0.1});
        label(n,bx,by+314,30,c); wrap(t,bx,by+352,cw,15,20);
      });
      starburst(x+w-80,y+h-90,58,'2 PLAYER!');
    },
    // 4 · controls
    (x,y,w,h)=>{
      ribbon('CONTROLS',x+30,y+30,240);
      // a 16-bit pad, drawn
      const cx=x+w/2, cy=y+220;
      ctx.save(); ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx+6,cy+8,220,90,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#cfcad8'; ctx.beginPath(); ctx.ellipse(cx,cy,220,90,0,0,Math.PI*2); ctx.fill(); ctx.lineWidth=3; ctx.strokeStyle='#4a4656'; ctx.stroke();
      ctx.fillStyle='#2a2830'; ctx.fillRect(cx-160,cy-12,60,24); ctx.fillRect(cx-142,cy-30,24,60);           // d-pad
      [['#7a4fd8',cx+120,cy-22],['#3fae5a',cx+150,cy+4],['#e8c040',cx+90,cy+4],['#c8281e',cx+120,cy+30]].forEach(([c,bx,by])=>{ ctx.fillStyle=c; ctx.beginPath(); ctx.arc(bx,by,15,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#14070a'; ctx.lineWidth=2; ctx.stroke(); });
      ctx.fillStyle='#6a6676'; ctx.fillRect(cx-36,cy+4,28,8); ctx.fillRect(cx+8,cy+4,28,8); ctx.restore();
      const B=typeof OPT!=='undefined'&&OPT.binds?OPT.binds:{};
      const k=a=>(B[a]||[]).map(c=>c.replace('Key','').replace('Arrow','').replace('Left','L').replace('Right','R')).join(' / ')||'-';
      const rows=[['MOVE',k('left')+'  ·  '+k('right')],['JUMP (tap again in the air: DOUBLE JUMP)',k('jump')],['USE ITEM (hold to charge)',k('swap')],['SWITCH ITEM',k('use')],['PUNCH',k('punch')],['AIM',k('up')+' / '+k('down')+' + arrows'],['SPRINT: tap item, then hold it + a direction',k('sprint')]];
      let yy=y+340;
      for(const [a,b] of rows){ label(a,x+40,yy,15,INK); label(b,x+w-40,yy,15,BLUE,'right'); ctx.fillStyle='rgba(0,0,0,0.12)'; ctx.fillRect(x+40,yy+22,w-80,1); yy+=34; }
      box(x+40,yy+6,w-80,70,'PAUSE',RED); wrap('ESC / START opens the pause menu: RESUME · OPTIONS · EXIT. Options hold the sound, the console look and this booklet.',x+52,yy+36,w-104,14,18);
    },
    // 5 · the four jacks
    (x,y,w,h)=>{
      ribbon('THE FOUR JACKS',x+30,y+30,320,BLUE);
      const sheet=img('boxes','assets/items/mv2-item-boxes-standard-enhanced.png');
      const T=[['TRS','A charged shot. Breaks yellow cage blocks and boils water into steam.'],['RCA','The rope. Latch on, swing, reel in with UP / DOWN. It plugs into your back.'],['XLR','A blast that throws blocks and enemies — and you, the other way.'],['MAG','Grab and carry. Let go to throw. Pulls water to its tip.']];
      T.forEach(([n,t],i)=>{ const by=y+100+i*128; framed(sheet,x+30,by,120,112,{sx:JACK_X[i],sy:150,sw:312,sh:300,pixel:true}); label(n,x+170,by+4,26,i===3?RED:i===1?'#6a2cc8':INK); wrap(t,x+170,by+40,w-200,15,19); });
      starburst(x+w-70,y+86,48,'POWER!');
    },
    // 6 · Awdjoo Town
    (x,y,w,h)=>{
      ribbon('AWDJOO TOWN',x+30,y+30,280);
      framed(img('s5','assets/story/story-5.png'),x+30,y+100,w-60,180,{ay:0.5});
      box(x+30,y+300,w-60,120,'STAGE 1.1 · THE STREET','#2a7a3a');
      wrap('Find the four jacks in their crates, collect the Knowl seeds, meet Laitu and open the arch. Watch for the minions — and the gramophone in your living room.',x+42,y+334,w-84,14,18);
      box(x+30,y+440,w-60,140,'STAGE 1.2 · DEEP WATERS',BLUE);
      wrap('A flooded house, a crystal chamber and a corridor where D — your mirror — waits. Pull the drain plug and the water rushes out. Water shorts out robots: you and them.',x+42,y+474,w-84,14,18);
    },
    // 7 · tips
    (x,y,w,h)=>{
      ribbon('TIPS & SECRETS',x+30,y+30,320,RED);
      const tips=['Boil enough water with the TRS and the clouds roll in. What goes up comes down as rain.','Drive INTO your own XLR blast: the tire fights it, heats up and smokes.','Hold the XLR under water to blow an air pocket. Let go and it bursts to the surface.','The rope plugs into your back once it bites — your hand is free for another item.','A hard landing bounces off the rubber. A second jump in the air kicks off the woofer.','Every slot remembers your hero, your jacks and every seed you found.'];
      let yy=y+100; tips.forEach((t,i)=>{ ctx.save(); ctx.fillStyle=i%2?BLUE:RED; ctx.beginPath(); ctx.arc(x+44,yy+10,11,0,Math.PI*2); ctx.fill(); ctx.font='14px '+HEAD(); ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(i+1),x+44,yy+11); ctx.restore(); yy=wrap(t,x+66,yy,w-100,15,20)+14; });
      starburst(x+w-80,y+h-80,52,'HINT!');
    },
    // 8 · credits
    (x,y,w,h)=>{
      ctx.fillStyle='#120a20'; ctx.fillRect(x,y,w,h);
      ribbon('CREDITS',x+30,y+30,220,GOLD);
      const C=[['CREATED, DIRECTED & SCORED BY','PAULO VENTURA'],['STORYLINE THEME','"THE KNOWL TREE" — PAULO VENTURA'],['PRESENTED BY','MMR · MUSIC MECCA RECORDS'],['STUDIO','SONNATA GAMES'],['PROGRAMMING & SOUND DESIGN','PAULO VENTURA · CLAUDE (ANTHROPIC) · CURSOR'],['STARRING','MIND · VENTURE · LAITU · D'],['SPECIAL THANKS','EVERY PLAYER OF THE ALPHA']];
      let yy=y+110; for(const [r,n] of C){ label(r,x+w/2,yy,13,'#9c8cc8','center'); label(n,x+w/2,yy+18,20,'#fff2c8','center'); yy+=62; }
    },
    // 9 · progress
    (x,y,w,h)=>{
      ribbon('HOW FAR WE ARE',x+30,y+30,310,BLUE);
      const build=window.MV_BUILD||'?';
      const st=[['BUILD',build],['STAGES PLAYABLE','2  (AWDJOO 1.1 · 1.2)'],['ZONES PLANNED','6  (TOWN → HILLS → GARDEN → CAVERN → FACTORY → LAIR)'],['CODE','30,000 LINES · 50+ MODULES'],['NEXT','THE ALPHA: CREATIVE MODE + GAUDER HILLS']];
      let yy=y+100; for(const [a,b] of st){ box(x+30,yy,w-60,70,a,BLUE); label(b,x+44,yy+34,18,INK); yy+=86; }
      // a progress bar: zones done / planned
      ctx.save(); ctx.fillStyle='#000'; ctx.fillRect(x+30,yy+8,w-60,22); ctx.fillStyle='#3fae5a'; ctx.fillRect(x+32,yy+10,(w-64)*(1/6),18); ctx.restore();
      label('ZONE 1 OF 6',x+w/2,yy+40,14,INK,'center');
    },
    // 10 · curious facts
    (x,y,w,h)=>{
      ribbon('CURIOUS FACTS',x+30,y+30,300,RED);
      const F=['Every drop of water is counted. Boil it to steam and it still exists — until it rains back down.','Mind\'s wheel hides a V8: five gears, a rev limiter, burble at idle and crackles when you lift off.','You hear the world from Mind\'s spot: walls muffle, rooms ring, and 3D "ears" put sounds beside or behind you.','The stage music isn\'t everywhere — it comes out of the gramophone in the living room.','Mind\'s eye squints harder the more danger is around him.','The title screen is hand-painted pixel art, and so is every story page.'];
      let yy=y+100; F.forEach((t,i)=>{ box(x+30,yy,w-60,82,'FACT #'+(i+1),i%2?BLUE:RED); wrap(t,x+42,yy+32,w-84,13,17); yy+=94; });
    },
    // 11 · back cover
    (x,y,w,h)=>{
      ctx.fillStyle='#0c1a12'; ctx.fillRect(x,y,w,h);
      if(typeof uiLogo==='function') uiLogo('MIND & VENTURE',x+w/2,y+h/2-80,40,{col:'#b8f5a0',sweep:220});
      label('THANK YOU FOR PLAYING',x+w/2,y+h/2,22,'#fff2c8','center');
      label('© SONNATA GAMES · MMR',x+w/2,y+h-60,14,'#9c8cc8','center');
    },
  ];

  function paper(x,y,w,h){
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(x+12,y+14,w,h);
    ctx.fillStyle=PAPER; ctx.fillRect(x,y,w,h);
    ctx.fillStyle='rgba(120,90,40,0.06)'; for(let i=0;i<260;i++){ const a=(i*97)%w, b=(i*211)%h; ctx.fillRect(x+a,y+b,2,2); }   // paper fibre
    ctx.fillStyle='rgba(200,40,30,0.12)'; for(let yy=0;yy<120;yy+=8) for(let xx=0;xx<120-yy;xx+=8){ ctx.beginPath(); ctx.arc(x+w-xx-4,y+h-yy-4,2.4*(1-(xx+yy)/120),0,Math.PI*2); ctx.fill(); }   // halftone corner
    ctx.restore();
  }
  function drawBook(){
    // the table
    ctx.fillStyle='#14100c'; ctx.fillRect(0,0,W,H);
    const g=ctx.createRadialGradient(W/2,H/2,100,W/2,H/2,700); g.addColorStop(0,'rgba(80,60,40,0.35)'); g.addColorStop(1,'rgba(0,0,0,0.8)'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    const pw=600, ph=720, px=(W-pw)/2, py=(H-ph)/2-6;
    S.t=Math.min(1,S.t+0.09);
    const e=1-Math.pow(1-S.t,3), dir=S.page>=S.from?1:-1;
    const draw=(i,off,alpha)=>{ if(i<0||i>=PAGES.length) return; ctx.save(); ctx.globalAlpha=alpha; ctx.translate(off,0); ctx.translate(px+pw/2,py+ph/2); ctx.rotate(-0.006+off*0.00004); ctx.translate(-(px+pw/2),-(py+ph/2));
      paper(px,py,pw,ph); ctx.beginPath(); ctx.rect(px,py,pw,ph); ctx.clip(); try{ PAGES[i](px,py,pw,ph); }catch(err){} ctx.restore();
      ctx.save(); ctx.globalAlpha=alpha; ctx.translate(off,0); ctx.font='14px '+HEAD(); ctx.fillStyle=(i===0||i===7||i===10)?'#9c8cc8':'#5a4a3a'; ctx.textAlign='center'; ctx.fillText('— '+(i+1)+' —',px+pw/2,py+ph-16); ctx.restore(); };
    if(S.t<1) draw(S.from,-dir*e*(W*0.8),1-e);
    draw(S.page,dir*(1-e)*(W*0.8),e);
    // controls hint
    if(typeof drawTextC==='function') drawTextC('<  >  TURN THE PAGE      ESC  CLOSE      '+(S.page+1)+' / '+PAGES.length,W/2,H-24,'#c8b8a0',1);
  }
  function turn(d){ const n=Math.max(0,Math.min(PAGES.length-1,S.page+d)); if(n===S.page) return; S.from=S.page; S.page=n; S.t=0; try{ sfx('menu'); }catch(e){} }
  function close(){ _gameState=S.back; try{ sfx('confirm'); }catch(e){} }
  function open(){ S.back=_gameState==='options'?'options':'title'; S.page=0; S.from=0; S.t=1; S.openAt=performance.now(); _gameState='manual'; try{ sfx('confirm'); }catch(e){} }
  document.addEventListener('keydown',e=>{
    if(_gameState!=='manual') return;
    if(performance.now()-(S.openAt||0)<180){ e.preventDefault(); e.stopImmediatePropagation(); return; }   // the key that opened it
    const c=e.code;
    if(c==='ArrowRight'||c==='KeyD'||c==='Enter'||c==='Space') turn(1);
    else if(c==='ArrowLeft'||c==='KeyA') turn(-1);
    else if(c==='Escape'||c==='Backspace'||c==='KeyE') close();
    e.preventDefault(); e.stopImmediatePropagation();
  },true);
  document.addEventListener('click',e=>{
    if(_gameState!=='manual') return;
    const c=document.getElementById('c'); if(!c) return; const r=c.getBoundingClientRect(); const mx=(e.clientX-r.left)*(W/r.width);
    turn(mx<W/2?-1:1); e.stopImmediatePropagation();
  },true);
  // gamepad: reuse the menu edges (left/right/B) through Kj each frame
  const _update=window.update, _draw=window.draw;
  window.update=function(){
    if(_gameState==='manual'){
      if(typeof readGamepad==='function') try{ readGamepad(); }catch(e){}
      fr++; if(typeof clkj==='function') clkj(); return;
    }
    return _update.apply(this,arguments);
  };
  window.draw=function(){
    if(_gameState==='manual'){ ctx.save(); ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over'; drawBook(); ctx.restore(); return; }
    return _draw.apply(this,arguments);
  };
  window.MV_MANUAL={open, close, turn, pages:PAGES.length, state:S};
})();
