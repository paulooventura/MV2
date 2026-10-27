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
  const WASHI='#e9d8c3', SUMI='#14110e', SEAL='#b4332c', INDIGO='#243e66', MOSS='#2a4636', GOLD='#8d6a32';
  const PAPER=WASHI, INK=SUMI, RED=SEAL, BLUE=INDIGO;

  const S={page:0, from:0, t:1, back:'options'};
  // ── tiny typesetting kit ──
  function wrap(text,x,y,maxW,size,lh,col,opt){
    ctx.save(); ctx.font=size+'px '+BODY(); ctx.fillStyle=col||SUMI; ctx.textBaseline='top'; ctx.textAlign=(opt&&opt.align)||'left';
    const words=String(text).split(' '); let line='', yy=y;
    const ink=()=>{ const dx=(opt&&opt.align)==='center'?x+maxW/2:x; ctx.fillText(line,dx,yy); };
    for(const w of words){ const t=line?line+' '+w:w; if(ctx.measureText(t).width>maxW&&line){ ink(); yy+=lh; line=w; } else line=t; }
    if(line){ ink(); yy+=lh; }
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
  function box(x,y,w,h,title,col,titleSize){
    const ts=titleSize||22, th=ts+12;
    ctx.save(); ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(x+5,y+5,w,h);
    ctx.fillStyle='#fffaf0'; ctx.fillRect(x,y,w,h); ctx.lineWidth=3; ctx.strokeStyle=col||BLUE; ctx.strokeRect(x,y,w,h);
    if(title){ ctx.fillStyle=col||BLUE; ctx.fillRect(x,y,w,th); ctx.font=ts+'px '+HEAD(); ctx.fillStyle='#fff'; ctx.textBaseline='middle'; ctx.fillText(title,x+12,y+th/2); }
    ctx.restore();
    return th;
  }
  function arcWord(text,cx,cy,size,col,spread,bend){
    ctx.save(); ctx.font=size+'px '+HEAD(); ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.lineJoin='round';
    const letters=[...String(text)], widths=letters.map(ch=>ctx.measureText(ch).width);
    const total=widths.reduce((a,b)=>a+b,0)+(spread||0)*Math.max(0,letters.length-1);
    let px=cx-total/2;
    letters.forEach((ch,i)=>{
      const hw=widths[i]/2; px+=hw;
      const t=letters.length<2?0:(i/(letters.length-1))-0.5;
      ctx.save(); ctx.translate(px,cy+(bend||0)*Math.cos(t*Math.PI)); ctx.rotate(t*0.16);
      ctx.lineWidth=Math.max(5,size*0.07); ctx.strokeStyle='#14070a'; ctx.strokeText(ch,0,0);
      ctx.fillStyle=col; ctx.fillText(ch,0,0); ctx.restore();
      px+=hw+(spread||0);
    });
    ctx.restore();
  }
  function label(t,x,y,size,col,align){ ctx.save(); ctx.font=size+'px '+HEAD(); ctx.fillStyle=col||SUMI; ctx.textAlign=align||'left'; ctx.textBaseline='top'; ctx.fillText(t,x,y); ctx.restore(); }
  let _mmrMark=null, _sealCv=null, _sealG=null;
  function mmrMark(){
    const im=img('mmr','assets/splash/mmr-logo.jpg');
    if(!ready(im)) return null;
    if(_mmrMark) return _mmrMark;
    const c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight;
    const g=c.getContext('2d',{willReadFrequently:true});
    g.drawImage(im,0,0);
    const d=g.getImageData(0,0,c.width,c.height), p=d.data;
    for(let i=0;i<p.length;i+=4){
      const L=p[i]*0.299+p[i+1]*0.587+p[i+2]*0.114;
      p[i]=p[i+1]=p[i+2]=16;
      p[i+3]=L<80?255:L<168?Math.round((168-L)/88*255):0;
    }
    g.putImageData(d,0,0);
    _mmrMark=c;
    return c;
  }
  // The approval mark: the MMR logo, keyed off the white, with a prismatic
  // outline around every stroke and a shine that walks across it.
  function mmrSeal(cx,cy,size){
    const mark=mmrMark(); if(!mark) return;
    const pad=7, S=Math.ceil(size+pad*2);
    if(!_sealCv||_sealCv.width!==S){ _sealCv=document.createElement('canvas'); _sealCv.width=_sealCv.height=S; _sealG=_sealCv.getContext('2d'); }
    const g=_sealG, t=(typeof fr!=='undefined'?fr:0);
    g.clearRect(0,0,S,S);
    for(let i=0;i<12;i++){
      const a=i/12*Math.PI*2, dx=Math.cos(a)*2.6, dy=Math.sin(a)*2.6;
      g.save();
      g.drawImage(mark,pad+dx,pad+dy,size,size);
      g.globalCompositeOperation='source-atop';
      g.fillStyle='hsl('+((i*30+t*2.4)%360)+' 90% 58%)';
      g.fillRect(0,0,S,S);
      g.restore();
    }
    g.drawImage(mark,pad,pad,size,size);
    g.save();
    g.globalCompositeOperation='source-atop';
    const u=((t%96)/96), x0=-size*0.35+u*size*1.7;
    const grd=g.createLinearGradient(x0,0,x0+size*0.38,size*0.12);
    grd.addColorStop(0,'rgba(255,255,255,0)');
    grd.addColorStop(0.46,'rgba(255,255,255,0)');
    grd.addColorStop(0.5,'rgba(255,255,255,0.88)');
    grd.addColorStop(0.56,'rgba(110,230,255,0.5)');
    grd.addColorStop(0.62,'rgba(255,186,70,0.4)');
    grd.addColorStop(0.74,'rgba(255,255,255,0)');
    grd.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=grd; g.fillRect(0,0,S,S);
    g.restore();
    ctx.drawImage(_sealCv,cx-S/2,cy-S/2);
  }

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
      label('BETA VERSION - BUILD '+(window.MV_BUILD||'?')+' - AWDJOO TOWN DEMO',x+w/2,y+h-128,16,'#9ef58a','center');
      ctx.save();
      const seal=img('mmr','assets/splash/mmr-logo.jpg');
      ctx.beginPath(); ctx.arc(x+w-70,y+h-70,46,0,Math.PI*2); ctx.clip();
      if(ready(seal)) ctx.drawImage(seal,x+w-116,y+h-116,92,92);
      else { ctx.fillStyle=GOLD; ctx.fill(); }
      ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.arc(x+w-70,y+h-70,46,0,Math.PI*2); ctx.lineWidth=4; ctx.strokeStyle='#14070a'; ctx.stroke();
      ctx.font='13px '+HEAD(); ctx.fillStyle='#14070a'; ctx.textAlign='center'; ctx.fillText('MMR',x+w-70,y+h-88); ctx.fillText('SEAL OF',x+w-70,y+h-72); ctx.fillText('GROOVE',x+w-70,y+h-56); ctx.restore();
      label('AN M.M.R. GAME',x+30,y+h-62,16,'#c8b8ff');
    },
    // 2 · the story
    (x,y,w,h)=>{
      ribbon('THE JOURNEY BEGINS',x+30,y+30,420);
      framed(img('s1','assets/story/story-1.png'),x+30,y+100,w-60,180,{ay:0.4});
      wrap('Their neighbor Laitu said: "They are long gone, and left a trail of Knowl seeds. Tradzkul probably took them to his lair. You should follow the trail and find them!"',x+30,y+310,w-60,20,26);
    },
    // 3 · the heroes. One column, measured, so the bios never sit on the portraits.
    (x,y,w,h)=>{
      ribbon('MEET THE HEROES',x+24,y+16,Math.min(340,w-120),BLUE);
      starburst(x+w-58,y+46,36,'2P');
      let yy=y+84;
      const pic=Math.max(112,Math.min(148,Math.floor((h-250)/2)));
      [['mind','MIND','#6a2cc8','The big brother. Wide black hat, purple circuits, steady hands and big ideas. Rolls on a dirt-bike wheel with a V8 in the hub.'],
       ['venture','VENTURE','#c8281e','The little brother. Backward cap, red circuits, no brakes and all nerve. Rides along as your ally, or as Player 2.']].forEach(([k,n,c,t])=>{
        framed(img('h'+k,'assets/ui/hero-'+k+'.png'),x+24,yy,w-48,pic,{ay:0.12});
        yy+=pic+8;
        label(n,x+24,yy,28,c);
        yy=wrap(t,x+24,yy+34,w-48,22,28)+10;
      });
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
      const dev=(typeof _uiDev!=='undefined')?_uiDev:'key';
      const keyOf=a=>{ const B=(typeof OPT!=='undefined'&&OPT.binds)?OPT.binds:{}; return (B[a]||[]).map(c=>String(c).replace('Key','').replace('Arrow','')).join('/')||a.toUpperCase(); };
      const act=a=>{
        if(a==='left'||a==='right'||a==='up'||a==='down') return dev==='pad'?'D-PAD':dev==='touch'?'STICK':keyOf(a);
        if(dev==='pad'||dev==='touch') return (typeof uiActLabel==='function')?uiActLabel(a):a.toUpperCase();
        return keyOf(a==='swap'?'swap':a==='use'?'use':a==='punch'?'punch':'jump');
      };
      const rows=[['MOVE',act('left')+'  ·  '+act('right')],['JUMP  ·  hold it in the air to climb',act('jump')],['USE ITEM (hold to charge)',act('swap')],['SWITCH ITEM',act('use')],['PUNCH',act('punch')],['SPORTS-MODE: double-tap run and hold while moving',act('swap')],['LOADED JUMP: hold down on the ground, then jump',act('down')+' + '+act('jump')]];
      let yy=y+340;
      for(const [a,b] of rows){ label(a,x+24,yy,20,INK); label(b,x+w-24,yy,20,BLUE,'right'); ctx.fillStyle='rgba(0,0,0,0.12)'; ctx.fillRect(x+24,yy+24,w-48,1); yy+=36; }
      box(x+40,yy+6,w-80,70,'PAUSE',RED); wrap('ESC / START opens the pause menu: RESUME · OPTIONS · EXIT. Options hold the sound, the filter and this booklet.',x+52,yy+36,w-104,14,18);
    },
    // 5 · the four jacks
    (x,y,w,h)=>{
      ribbon('THE FOUR JACKS',x+30,y+30,320,BLUE);
      const sheet=img('boxes','assets/items/mv2-item-boxes-standard-enhanced.png');
      const T=[['TRS','A charged shot. Breaks yellow cage blocks and boils water into steam.'],['RCA','The rope. Latch on, swing, reel in with UP / DOWN. It plugs into your back.'],['XLR','A blast that throws blocks and enemies — and you, the other way.'],['MEG','The magnet. Locks to the floor when you aim down. Grab, carry, let go to throw.']];
      T.forEach(([n,t],i)=>{ const by=y+92+i*142; framed(sheet,x+24,by,112,104,{sx:JACK_X[i],sy:150,sw:312,sh:300,pixel:true}); label(n,x+152,by+4,30,i===3?RED:i===1?'#6a2cc8':INK); wrap(t,x+152,by+42,w-188,22,28); });
      starburst(x+w-58,y+48,34,'PWR');
    },
    // 6 · Awdjoo Town
    (x,y,w,h)=>{
      ribbon('AWDJOO TOWN',x+24,y+16,280);
      framed(img('s5','assets/story/story-5.png'),x+24,y+78,w-48,96,{ay:0.5});
      box(x+24,y+186,w-48,150,'STAGE 1.1 · THE STREET','#2a7a3a',22);
      wrap('Find the four jacks in their crates, collect the Knowl seeds, meet Laitu and open the arch. Watch for the minions, and the gramophone in your living room.',x+40,y+230,w-80,22,28);
      box(x+24,y+348,w-48,130,'STAGE 1.2 · DEEP WATERS',BLUE,22);
      wrap('A flooded house, a crystal chamber and a corridor where D waits. Pull the drain plug. Water shorts out robots.',x+40,y+392,w-80,22,28);
      box(x+24,y+490,w-48,150,'STAGE 1.3 · THE LAIR',RED,22);
      wrap('Past the flooded street. E watches from one eye. F sleeps under the water. The knife is the only thing that can finish what waits at the end.',x+40,y+534,w-80,22,28);
    },
    // 7 · tips
    (x,y,w,h)=>{
      ribbon('TIPS & SECRETS',x+24,y+16,Math.min(320,w-110),RED);
      starburst(x+w-52,y+46,32,'!');
      const tips=['Boil enough water with the TRS and the clouds roll in. What goes up comes down as rain.','Drive into your own XLR blast: the tire fights it, heats up and smokes.','Hold the XLR under water to blow an air pocket. Let go and it bursts to the surface.','The rope plugs into your back once it bites. Your hand is free for another item.','A hard landing bounces off the rubber. Hold jump in the air and the wheel climbs.','Every slot remembers your hero, your jacks and every seed you found.','On filters, hold the item button, then down, left, down, right, down, up.'];
      let yy=y+86; tips.forEach((t,i)=>{ ctx.save(); ctx.fillStyle=i%2?BLUE:RED; ctx.beginPath(); ctx.arc(x+40,yy+14,16,0,Math.PI*2); ctx.fill(); ctx.font='18px '+HEAD(); ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(i+1),x+40,yy+15); ctx.restore(); yy=wrap(t,x+66,yy,w-96,20,26)+12; });
    },
    // 8 · credits
    (x,y,w,h)=>{
      ctx.fillStyle='#120a20'; ctx.fillRect(x,y,w,h);
      ribbon('CREDITS',x+30,y+30,220,GOLD);
      const C=[['CREATED, DIRECTED & SCORED BY','PAULO VENTURA'],['STORYLINE THEME','"THE KNOWL TREE"'],['PRESENTED BY','MMR · MUSIC MECCA RECORDS'],['STUDIO','M.M.R.'],['PROGRAMMING & SOUND','PAULO VENTURA'],['STARRING','MIND · VENTURE · LAITU · D'],['SPECIAL THANKS','EVERY PLAYER OF THE ALPHA']];
      let yy=y+96; for(const [r,n] of C){ label(r,x+w/2,yy,16,'#c8b8e8','center'); label(n,x+w/2,yy+22,26,'#fff2c8','center'); yy+=72; }
      label('(c) 2026 Paulo Ventura · build '+(window.MV_BUILD||'?'),x+w/2,y+h-44,16,'#c8b8e8','center');
    },
    // 9 · progress
    (x,y,w,h)=>{
      ribbon('HOW FAR WE ARE',x+30,y+30,310,BLUE);
      const build=window.MV_BUILD||'?';
      const st=[['BUILD',build],['STAGES PLAYABLE','2  (AWDJOO 1.1 · 1.2)'],['ZONES PLANNED','6  (TOWN → HILLS → GARDEN → CAVERN → FACTORY → LAIR)'],['CODE','30,000 LINES · 50+ MODULES'],['NEXT','THE ALPHA: CREATIVE MODE + GAUDER HILLS']];
      let yy=y+88; for(const [a,b] of st){ box(x+24,yy,w-48,78,a,BLUE,20); label(b,x+40,yy+42,24,INK); yy+=90; }
      // a progress bar: zones done / planned
      ctx.save(); ctx.fillStyle='#000'; ctx.fillRect(x+30,yy+8,w-60,22); ctx.fillStyle='#3fae5a'; ctx.fillRect(x+32,yy+10,(w-64)*(1/6),18); ctx.restore();
      label('ZONE 1 OF 6',x+w/2,yy+40,14,INK,'center');
    },
    // 10 · curious facts
    (x,y,w,h)=>{
      ribbon('CURIOUS FACTS',x+30,y+30,300,RED);
      const F=['Every drop of water is counted. Boil it to steam and it still exists — until it rains back down.','Mind\'s wheel hides a V8: five gears, a rev limiter, burble at idle and crackles when you lift off.','You hear the world from Mind\'s spot: walls muffle, rooms ring, and 3D "ears" put sounds beside or behind you.','The stage music isn\'t everywhere — it comes out of the gramophone in the living room.','Mind\'s eye squints harder the more danger is around him.','The title screen is hand-painted pixel art, and so is every story page.'];
      let yy=y+84; F.forEach((t,i)=>{ box(x+24,yy,w-48,90,'FACT '+(i+1),i%2?BLUE:RED,20); wrap(t,x+40,yy+40,w-80,18,23); yy+=96; });
    },
    // 11 · the endeavor, full bleed, with its own title
    (x,y,w,h)=>{
      const im=img('home','assets/ui/title-home.jpg?v=297');
      if(ready(im)){
        const k=Math.max(w/im.naturalWidth,h/im.naturalHeight), dw=im.naturalWidth*k, dh=im.naturalHeight*k;
        ctx.drawImage(im,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
      }else{ ctx.fillStyle='#120a18'; ctx.fillRect(x,y,w,h); }
      const vg=ctx.createLinearGradient(0,y,0,y+h);
      vg.addColorStop(0,'rgba(8,4,14,0.25)'); vg.addColorStop(0.42,'rgba(8,4,14,0.55)'); vg.addColorStop(1,'rgba(8,4,14,0.82)');
      ctx.fillStyle=vg; ctx.fillRect(x,y,w,h);
      const cx=x+w/2, cy=y+h*0.40, sz=Math.max(54,Math.min(86,w*0.15));
      arcWord('MIND',cx,cy-sz*0.85,sz,'#f7f1e4',sz*0.06,sz*0.08);
      arcWord('&',cx,cy,Math.round(sz*0.55),GOLD,0,0);
      arcWord('VENTURE',cx,cy+sz*0.95,Math.round(sz*0.78),'#f7f1e4',sz*0.04,sz*0.06);
      ctx.save(); ctx.strokeStyle=GOLD; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(cx-sz*1.3,cy+sz*1.55); ctx.lineTo(cx+sz*1.3,cy+sz*1.55); ctx.stroke(); ctx.restore();
      label('AWDJOO TOWN',cx,cy+sz*1.7,18,'#fff2c8','center');
    },
  ];
  { const facts=PAGES[9], credits=PAGES[7]; PAGES[7]=facts; PAGES[9]=credits; }

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
    const L=window.uiLayout?uiLayout():{panelW:520};
    const pw=Math.min(520,L.panelW), ph=Math.min(680,H-48), px=(W-pw)/2, py=Math.max(16,(H-ph)/2-6);
    S.t=Math.min(1,S.t+0.09);
    const e=1-Math.pow(1-S.t,3), dir=S.page>=S.from?1:-1;
    const draw=(i,off,alpha)=>{ if(i<0||i>=PAGES.length) return; ctx.save(); ctx.globalAlpha=alpha; ctx.translate(off,0); ctx.translate(px+pw/2,py+ph/2); ctx.rotate(-0.006+off*0.00004); ctx.translate(-(px+pw/2),-(py+ph/2));
      paper(px,py,pw,ph); ctx.beginPath(); ctx.rect(px,py,pw,ph); ctx.clip(); try{ PAGES[i](px,py,pw,ph); }catch(err){} ctx.restore();
      ctx.save(); ctx.globalAlpha=alpha; ctx.translate(off,0); ctx.font='14px '+HEAD(); ctx.fillStyle=(i===0||i===9||i===10)?'#9c8cc8':'#5a4a3a'; ctx.textAlign='center'; ctx.fillText('— '+(i+1)+' —',px+pw/2,py+ph-16); ctx.restore(); };
    if(S.t<1) draw(S.from,-dir*e*(W*0.8),1-e);
    draw(S.page,dir*(1-e)*(W*0.8),e);
    // controls hint
    if(typeof drawTextC==='function') drawTextC((window.uiMenuHint?uiMenuHint('manual'):'TURN THE PAGE')+'    '+(S.page+1)+' / '+PAGES.length,W/2,H-36,'#f2ffe8',3);
  }
  function turn(d){ if(performance.now()-(S.openAt||0)<700) return; const n=Math.max(0,Math.min(PAGES.length-1,S.page+d)); if(n===S.page) return; S.from=S.page; S.page=n; S.t=0; try{ sfx('menu'); }catch(e){} }
  function close(){ _gameState=S.back; try{ sfx('confirm'); }catch(e){} }
  function open(){ S.back=_gameState==='options'?'options':'title'; S.page=0; S.from=0; S.t=1; S.openAt=performance.now(); _gameState='manual'; try{ ['Space','Enter','NumpadEnter','ArrowRight','KeyD','ArrowLeft','KeyA'].forEach(k=>{ delete Kj[k]; delete K[k]; }); }catch(e){} try{ sfx('confirm'); }catch(e){} }
  document.addEventListener('keydown',e=>{
    if(_gameState!=='manual') return;
    if(performance.now()-(S.openAt||0)<700){ e.preventDefault(); e.stopImmediatePropagation(); return; }   // the key that opened it stays on page 1
    const c=e.code;
    if(c==='KeyF'||c==='Escape'||c==='Backspace') close();   // Y (punch) closes the booklet. B does not.
    else if(c==='ArrowRight'||c==='KeyD'||c==='Enter'||c==='Space') turn(1);
    else if(c==='ArrowLeft'||c==='KeyA') turn(-1);
    e.preventDefault(); e.stopImmediatePropagation();
  },true);
  document.addEventListener('click',e=>{
    if(_gameState!=='manual') return;
    if(e.target&&e.target.closest&&e.target.closest('#padRight,#padLeft,#phoneCrt')) return;
    const c=document.getElementById('c'); if(!c||e.target!==c) return; const r=c.getBoundingClientRect(); const mx=(e.clientX-r.left)*(W/r.width);
    turn(mx<W/2?-1:1); e.stopImmediatePropagation();
  },true);
  // gamepad: reuse the menu edges (left/right/B) through Kj each frame
  const _update=window.update, _draw=window.draw;
  window.update=function(){
    if(_gameState==='manual'){
      if(typeof readGamepad==='function') try{ readGamepad(); }catch(e){}
      if(Kj['KeyF']||Kj['Escape']) close();
      else if(Kj['Space']||Kj['Enter']||Kj['ArrowRight']||Kj['KeyD']) turn(1);
      else if(Kj['ArrowLeft']||Kj['KeyA']) turn(-1);
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
