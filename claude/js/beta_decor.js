// ============================================================
//  beta_decor.js — G · the living, cozy Awdjoo look for the L1 beta
//
//  Matches the intro art (assets/story/story-1..5): dusk swirl sky with
//  drifting clouds and birds, warm amber interiors (plank walls, green
//  curtains, swaying lamps, a crackling stove, a gramophone puffing notes),
//  brick and shingle shells, textured dirt with roots and pebbles, flowers
//  that sway, a stone basement and a towering, glowing Knowl tree whose
//  angelic choir swells as MIND gets close.
//  Drawing + ambience only — nothing here collides.
// ============================================================
(function(){
  'use strict';
  const T=32;
  const P={
    skyTop:'#1c1236', skyMid:'#6a3460', skyLow:'#e08a58', skyGlow:'#ffcf7a', swirl:'rgba(255,214,150,0.10)',
    hill1:'#3a2448', hill2:'#2a1a36', townWin:'#ffcf6a',
    plankA:'#6e4024', plankB:'#5e361e', plankLine:'#3e2212', wains:'#45261a', rail:'#8a5a32',
    rugA:'#7a2438', rugB:'#c8964a',
    brick:'#4a2c26', brickHi:'#5e3a30', mortar:'#2a1814',
    shingle:'#3a2420', shingleHi:'#563428', shingleEdge:'#1e120e',
    curtain:'#3e7a3a', curtainHi:'#5ea050',
    lamp:'#ffe2a0', lampGlow:'rgba(255,190,90,', wood:'#7a4a26', woodD:'#4a2a14', woodH:'#a8703a',
    green:'#3e6a3a', greenH:'#5e8a4a', orange:'#b8642a', orangeH:'#d8843a', gold:'#d8aa40', goldD:'#8a6418',
    stone:'#2e2624', stoneHi:'#3c322e', stoneLine:'#1c1614', grass:'#4f9a4a', grassD:'#2f6a34', flower:'#b070e0', flowerB:'#e070c0',
    dirt:'#6b4a32', dirtD:'#4e3422', dirtL:'#80583a', cave:'#231a2a',
    knowl:'#66ffcc', knowlD:'#1a8a6a'
  };
  let Z=1;
  const X=v=>sx(v), Y=v=>sy(v), S=v=>v*Z;
  function rect(x,y,w,h,c){ ctx.fillStyle=c; ctx.fillRect(X(x),Y(y),S(w)+1,S(h)+1); }
  function glow(x,y,r,a,col){
    const base=col||P.lampGlow;
    const g=ctx.createRadialGradient(X(x),Y(y),0,X(x),Y(y),S(r));
    g.addColorStop(0,base+a+')'); g.addColorStop(1,base+'0)');
    ctx.fillStyle=g; ctx.fillRect(X(x-r),Y(y-r),S(2*r),S(2*r));
  }
  const hash=(a,b)=>{ let h=(a*374761393+b*668265263)|0; h=(h^(h>>>13))*1274126177|0; return ((h^(h>>>16))>>>0)/4294967295; };
  const inView=(x,y,w,h)=>X(x+w)>-40&&X(x)<W+40&&Y(y+h)>-40&&Y(y)<H+40;

  // ── Cached tile textures (drawn once, blitted every frame) ─────────
  const tex={};
  function mk(w,h,fn){ const c=document.createElement('canvas'); c.width=w; c.height=h; fn(c.getContext('2d'),w,h); return c; }
  function texDirt(v){
    return mk(T,T,(g)=>{
      g.fillStyle=P.dirt; g.fillRect(0,0,T,T);
      const rnd=(i)=>hash(v*97+i,i*31+7);
      for(let i=0;i<26;i++){ g.fillStyle=rnd(i)<0.5?P.dirtD:P.dirtL; g.globalAlpha=0.35+rnd(i+50)*0.4;
        g.fillRect(rnd(i+1)*T|0, rnd(i+2)*T|0, 1+(rnd(i+3)*2|0), 1+(rnd(i+4)*2|0)); }
      g.globalAlpha=1;
      for(let i=0;i<2;i++){ if(rnd(i+90)<0.55){ const x=rnd(i+91)*(T-6)|0, y=rnd(i+92)*(T-5)|0;   // pebbles
        g.fillStyle='#5a4a40'; g.fillRect(x,y,5,4); g.fillStyle='#8a7a6a'; g.fillRect(x+1,y,3,1); g.fillStyle='#3a2a20'; g.fillRect(x,y+3,5,1); } }
      if(rnd(120)<0.35){ g.strokeStyle='#3a2414'; g.lineWidth=1; g.beginPath();                    // a root
        let x=rnd(121)*T, y=0; g.moveTo(x,y); for(let k=0;k<4;k++){ x+=(rnd(122+k)-0.5)*10; y+=8; g.lineTo(x,y); } g.stroke(); }
      g.fillStyle='rgba(0,0,0,0.12)'; g.fillRect(0,(rnd(130)*T)|0,T,1);                           // strata
    });
  }
  function texStone(v){
    return mk(T,T,(g)=>{
      g.fillStyle=P.stone; g.fillRect(0,0,T,T);
      g.strokeStyle=P.stoneLine; g.lineWidth=1;
      const off=v%2?16:0;
      g.strokeRect(off+0.5,0.5,T,15); g.strokeRect(off-T+0.5,0.5,T,15);
      g.strokeRect((off+16)%T+0.5,16.5,T,15); g.strokeRect((off+16)%T-T+0.5,16.5,T,15);
      for(let i=0;i<8;i++){ g.fillStyle=hash(v,i)<0.5?P.stoneHi:'#241c1a'; g.fillRect(hash(v,i+9)*T|0,hash(v,i+19)*T|0,2,1); }
    });
  }
  function texCave(v){
    return mk(T,T,(g)=>{
      g.fillStyle=P.cave; g.fillRect(0,0,T,T);
      for(let i=0;i<10;i++){ g.fillStyle=hash(v+40,i)<0.5?'#2c2236':'#1a1420'; g.fillRect(hash(v+40,i+9)*T|0,hash(v+40,i+19)*T|0,2+(hash(v,i)*3|0),1+(hash(v,i+3)*2|0)); }
      if(hash(v,77)<0.25){ g.fillStyle='rgba(120,255,200,0.18)'; g.fillRect(hash(v,78)*T|0,hash(v,79)*T|0,2,2); }   // a faint glow-moss speck
    });
  }
  function texBrick(v){
    return mk(T,T,(g)=>{
      g.fillStyle=P.mortar; g.fillRect(0,0,T,T);
      for(let k=0;k<4;k++){ const yy=k*8; for(let xx=((v*4+k)%2?0:-8); xx<T; xx+=16){ g.fillStyle=hash(xx+v*3,yy+k)<0.5?P.brick:P.brickHi; g.fillRect(xx+1,yy+1,14,6); } }
    });
  }
  function texRoof(top){
    return mk(T,T,(g)=>{
      g.fillStyle=P.shingle; g.fillRect(0,0,T,T);
      for(let k=0;k<2;k++){ const yy=k*16; for(let xx=(k?-8:0); xx<T; xx+=16){ g.fillStyle=P.shingleHi; g.fillRect(xx+1,yy+10,14,5); g.fillStyle='#2a1814'; g.fillRect(xx,yy+15,16,1); } }
      if(top){ g.fillStyle=P.shingleEdge; g.fillRect(0,0,T,4); g.fillStyle='#7a4a38'; g.fillRect(0,0,T,1); }
    });
  }
  // fish-scale roof tiles (the pink scales in the 1.2 sketch): rows of
  // overlapping rounded tiles, each with a light rim and a shadow under it
  function texScales(top){
    return mk(T,T,(g)=>{
      g.fillStyle='#6a2a3c'; g.fillRect(0,0,T,T);
      for(let row=0;row<3;row++){
        const yy=row*11-3, off=(row&1)?8:0;
        for(let xx=-16+off; xx<T+16; xx+=16){
          g.fillStyle='#3a1424'; g.beginPath(); g.arc(xx+8,yy+9,8.5,0,Math.PI); g.fill();
          const gr=g.createLinearGradient(0,yy,0,yy+10); gr.addColorStop(0,'#e88aa8'); gr.addColorStop(1,'#a8486a');
          g.fillStyle=gr; g.beginPath(); g.arc(xx+8,yy+8,7.5,0,Math.PI); g.fill();
          g.strokeStyle='rgba(255,220,235,0.55)'; g.lineWidth=1; g.beginPath(); g.arc(xx+8,yy+8,6,Math.PI*0.15,Math.PI*0.85); g.stroke();
        }
      }
      if(top){ g.fillStyle='#4a1a2c'; g.fillRect(0,0,T,4); g.fillStyle='#f0a8c0'; g.fillRect(0,0,T,1); }
    });
  }
  function texWood(){
    return mk(T,T,(g)=>{
      g.fillStyle=P.woodD; g.fillRect(0,0,T,T); g.fillStyle=P.woodH; g.fillRect(0,0,T,5); g.fillStyle=P.wood; g.fillRect(0,5,T,3);
      g.fillStyle=P.plankLine; g.fillRect(T-1,8,1,T-8); g.fillRect(0,19,T,1);
    });
  }
  function textures(){
    if(tex.ok) return;
    tex.dirt=[0,1,2,3,4,5,6,7].map(texDirt); tex.stone=[0,1].map(texStone); tex.cave=[0,1,2,3].map(texCave);
    tex.brick=[0,1].map(texBrick); tex.roof=texRoof(false); tex.roofTop=texRoof(true); tex.wood=texWood(); tex.scales=texScales(false); tex.scalesTop=texScales(true); tex.ok=true;
  }
  function blit(img,c,r){ ctx.drawImage(img, X(c*T), Y(r*T), S(T)+1, S(T)+1); }

  // ── Sky: dusk gradient, slow swirls, stars, drifting clouds, birds, far hills
  function sky(){
    const g=ctx.createLinearGradient(0,Y(0),0,Y(30*T));
    g.addColorStop(0,P.skyTop); g.addColorStop(0.45,P.skyMid); g.addColorStop(0.85,P.skyLow); g.addColorStop(1,P.skyGlow);
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    const horizon=Y((MV_BETA.horizonRow!=null?MV_BETA.horizonRow:MV_BETA.sky+13)*T);
    if(window.MV_SKY&&MV_SKY.draw(MV_BETA,horizon)) return;          // build 217: the key-art sky (beta_sky.js)
    // stars high up, twinkling
    const starH=(MV_BETA.sky+8)*T;
    for(let i=0;i<70;i++){
      const wx=hash(i,1)*3840, wy=hash(i,2)*starH, x=((wx-camX*0.05)%W+W)%W, y=Y(wy);
      if(y<-4||y>H) continue;
      const tw=0.35+0.65*Math.abs(Math.sin(fr*0.03+i*1.7));
      ctx.fillStyle='rgba(255,240,220,'+(tw*Math.max(0,1-wy/starH)*0.9)+')'; ctx.fillRect(x,y,2,2);
    }
    // swirls turning slowly
    ctx.strokeStyle=P.swirl; ctx.lineWidth=2;
    for(let i=0;i<9;i++){
      const cx=((i*173-camX*0.15+fr*0.05)%(W+200)+W+200)%(W+200)-100, cy=horizon-360+(i%3)*42+Math.sin(fr*0.01+i)*6;
      const rot=fr*0.004*(i%2?1:-1);
      for(let k=1;k<=3;k++){ ctx.beginPath(); ctx.arc(cx,cy,k*9,Math.PI*0.2+rot,Math.PI*1.7+rot); ctx.stroke(); }
    }
    // clouds drifting
    for(let i=0;i<7;i++){
      const span=W+700, spd=0.12+hash(i,5)*0.18;
      const x=((hash(i,3)*span+fr*spd-camX*0.12)%span+span)%span-350;
      const y=horizon-440+hash(i,4)*280;
      cloud(x, y, 0.7+hash(i,6)*0.8, 0.10+hash(i,7)*0.12);
    }
    // birds: a little flock crosses every so often
    for(let f=0;f<2;f++){
      const period=1500+f*700, t=((fr+f*900)%period)/period;
      const bx=-100+t*(W+300), by=horizon-300-f*90+Math.sin(t*12)*10;
      for(let k=0;k<5;k++){ const ox=k*22-(k%2)*8, oy=(k%2?10:0)+k*4; bird(bx-ox, by+oy, fr*0.35+k); }
    }
    const hill=(col,amp,off,base,spd)=>{
      ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(0,H);
      for(let x=0;x<=W;x+=16){ const wx=x+camX*spd; ctx.lineTo(x, base-amp*(0.5+0.5*Math.sin(wx*0.004+off))-amp*0.3*Math.sin(wx*0.011+off*2)); }
      ctx.lineTo(W,H); ctx.fill();
    };
    hill(P.hill1,60,1.3,horizon-20,0.2);
    for(let i=0;i<14;i++){
      const wx=i*260+40, x=wx-camX*0.3; const xs=((x%3600)+3600)%3600-200;
      if(xs<-60||xs>W+60) continue;
      const y=horizon-34-30*(0.5+0.5*Math.sin((wx+camX*0.3)*0.004+1.3));
      ctx.fillStyle=P.hill2; ctx.fillRect(xs,y,26,18); ctx.beginPath(); ctx.moveTo(xs-3,y); ctx.lineTo(xs+13,y-10); ctx.lineTo(xs+29,y); ctx.fill();
      const lit=0.75+0.25*Math.sin(fr*0.05+i*2.1);
      ctx.fillStyle='rgba(255,207,106,'+lit+')'; ctx.fillRect(xs+5,y+6,5,5); if(i%2) ctx.fillRect(xs+16,y+6,5,5);
    }
    hill(P.hill2,40,4.1,horizon+10,0.35);
  }
  function cloud(x,y,s,a){
    ctx.fillStyle='rgba(255,220,200,'+a+')';
    for(const [ox,oy,r] of [[0,0,22],[22,-8,26],[48,0,20],[26,6,22],[-18,6,14],[66,6,12]]){
      ctx.beginPath(); ctx.arc(x+ox*s,y+oy*s,r*s,0,Math.PI*2); ctx.fill();
    }
  }
  function bird(x,y,ph){
    const f=Math.sin(ph)*5;
    ctx.strokeStyle='rgba(30,16,40,0.85)'; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.moveTo(x-7,y-f); ctx.quadraticCurveTo(x-3,y-2,x,y); ctx.quadraticCurveTo(x+3,y-2,x+7,y-f); ctx.stroke();
  }

  // ── Interiors ─────────────────────────────────────────────────────
  function planks(x,y,w,h){
    for(let px=x, i=0; px<x+w; px+=22, i++) rect(px,y,Math.min(22,x+w-px),h,i%2?P.plankA:P.plankB);
    ctx.fillStyle=P.plankLine;
    for(let px=x; px<x+w; px+=22) ctx.fillRect(X(px),Y(y),1,S(h));
    for(let px=x+11; px<x+w; px+=66){ const py=y+30+hash(px,y)*(h-60); rect(px,py,2,6,P.plankLine); }
  }
  function wainscot(x,y,w,h){ rect(x,y+h-46,w,46,P.wains); rect(x,y+h-50,w,5,P.rail); }
  // a window that looks out at the dusk: clouds slide past, a bird now and then
  function window_(x,y,w,h,curtains){
    rect(x-4,y-4,w+8,h+8,P.woodD);
    ctx.save(); ctx.beginPath(); ctx.rect(X(x),Y(y),S(w),S(h)); ctx.clip();
    const g=ctx.createLinearGradient(0,Y(y),0,Y(y+h)); g.addColorStop(0,'#3a2a5a'); g.addColorStop(1,'#e89a5a');
    ctx.fillStyle=g; ctx.fillRect(X(x),Y(y),S(w),S(h));
    const t=(fr*0.25+x*0.7)%(w+120)-60;
    cloud(X(x+t),Y(y+h*0.35),0.45,0.35); cloud(X(x+((t+70)%(w+120))-60),Y(y+h*0.62),0.32,0.25);
    const bt=((fr+x*3)%900)/900; if(bt<0.25){ bird(X(x-10+bt*4*(w+20)),Y(y+h*0.3+Math.sin(bt*30)*3),fr*0.4); }
    ctx.restore();
    rect(x+w/2-1.5,y,3,h,P.woodD); rect(x,y+h/2-1.5,w,3,P.woodD);
    if(curtains){
      const sway=Math.sin(fr*0.03+x)*2;
      rect(x-10,y-6,14+sway,h+14,P.curtain); rect(x+w-4-sway,y-6,14+sway,h+14,P.curtain);
      rect(x-8,y-6,4,h+14,P.curtainHi); rect(x+w-2,y-6,4,h+14,P.curtainHi);
      rect(x-12,y-10,w+24,6,P.woodH);
    }
  }
  function frame(x,y,w,h,inner){ rect(x,y,w,h,P.gold); rect(x+3,y+3,w-6,h-6,inner||'#2a3a4a'); }
  function hangingLamp(x,y,len){
    const a=Math.sin(fr*0.025+x*0.01)*0.07;               // a slow sway
    const lx=x+Math.sin(a)*len, ly=y+Math.cos(a)*len;
    ctx.strokeStyle=P.woodD; ctx.lineWidth=S(2); ctx.beginPath(); ctx.moveTo(X(x),Y(y)); ctx.lineTo(X(lx),Y(ly)); ctx.stroke();
    glow(lx,ly+6,120,0.30+0.05*Math.sin(fr*0.07+x));
    ctx.fillStyle=P.goldD; ctx.beginPath(); ctx.moveTo(X(lx-12),Y(ly+6)); ctx.lineTo(X(lx+12),Y(ly+6)); ctx.lineTo(X(lx+6),Y(ly)); ctx.lineTo(X(lx-6),Y(ly)); ctx.fill();
    ctx.fillStyle=P.lamp; ctx.beginPath(); ctx.arc(X(lx),Y(ly+8),S(4),0,Math.PI*2); ctx.fill();
  }
  function armchair(x,floor,col,hi){
    rect(x,floor-34,46,34,col); rect(x-6,floor-26,10,26,hi); rect(x+42,floor-26,10,26,hi);
    rect(x+4,floor-18,38,10,hi); rect(x+2,floor-4,4,4,P.woodD); rect(x+40,floor-4,4,4,P.woodD);
  }
  function sofa(x,floor,w){ rect(x,floor-30,w,30,P.orange); rect(x,floor-38,w,12,P.orangeH); rect(x-8,floor-26,12,26,P.orangeH); rect(x+w-4,floor-26,12,26,P.orangeH);
    rect(x+14,floor-30,22,12,'#e8c070'); rect(x+w-36,floor-30,22,12,'#7a2438'); }
  function gramophone(x,floor){
    rect(x,floor-22,28,22,P.wood); rect(x+2,floor-24,24,3,P.woodH);
    // the record spins (a flicker of the label as it turns)
    ctx.fillStyle='#141014'; ctx.beginPath(); ctx.ellipse(X(x+14),Y(floor-25),S(12),S(2.5),0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=(fr>>3)%2?'#c84040':'#e8c070'; ctx.fillRect(X(x+12),Y(floor-26),S(4),S(2));
    const pulse=1+0.04*Math.sin(fr*0.2);
    ctx.strokeStyle=P.goldD; ctx.lineWidth=S(3); ctx.beginPath(); ctx.moveTo(X(x+14),Y(floor-24)); ctx.lineTo(X(x+20),Y(floor-44)); ctx.stroke();
    ctx.fillStyle=P.gold; ctx.beginPath(); ctx.moveTo(X(x+16),Y(floor-44)); ctx.lineTo(X(x+16+30*pulse),Y(floor-44-28*pulse)); ctx.lineTo(X(x+16+34*pulse),Y(floor-44-4*pulse)); ctx.closePath(); ctx.fill();
    // music notes float out of the horn
    for(let i=0;i<3;i++){
      const t=((fr*0.008+i/3)%1), nx=x+50+t*30+Math.sin(t*9+i)*6, ny=floor-62-t*70;
      ctx.globalAlpha=Math.sin(t*Math.PI)*0.9; note(nx,ny,i%2); ctx.globalAlpha=1;
    }
  }
  function note(x,y,two){
    ctx.fillStyle='#ffe2a0'; ctx.beginPath(); ctx.ellipse(X(x),Y(y),S(3.4),S(2.6),-0.4,0,Math.PI*2); ctx.fill();
    ctx.fillRect(X(x+2.4),Y(y-12),S(1.4),S(12));
    if(two){ ctx.beginPath(); ctx.ellipse(X(x+9),Y(y-2),S(3.4),S(2.6),-0.4,0,Math.PI*2); ctx.fill(); ctx.fillRect(X(x+11.4),Y(y-14),S(1.4),S(12)); ctx.fillRect(X(x+2.4),Y(y-14),S(10),S(2)); }
    else{ ctx.fillRect(X(x+2.4),Y(y-12),S(5),S(2)); }
  }
  function bed(x,floor,w,blanket,sq){              // sq: how far the mattress is squashed (bouncy, beta_impact.js)
    sq=sq||0;
    rect(x,floor-20,w,14,P.wood); rect(x,floor-34,8,34,P.woodD); rect(x+w-8,floor-26,8,26,P.woodD);
    rect(x+8,floor-28+sq,w-16,10-sq*0.4,blanket); rect(x+10,floor-34+sq,22,8,'#efe2c8');
  }
  // the stove: flames lick, the glow breathes, sparks climb the flue
  function stove(x,floor,flueTop){
    rect(x,floor-52,58,52,'#2a2422'); rect(x-3,floor-56,64,6,'#3a3230');
    rect(x+8,floor-34,42,24,'#120c0a');
    const breathe=0.38+0.12*Math.sin(fr*0.11)+0.06*Math.sin(fr*0.37);
    glow(x+29,floor-24,70,breathe,'rgba(255,130,50,');
    for(let i=0;i<5;i++){
      const fx=x+12+i*8, h=12+8*Math.abs(Math.sin(fr*0.21+i*1.9))+4*Math.sin(fr*0.53+i);
      ctx.fillStyle=i%2?'#ffb040':'#ff7a20';
      ctx.beginPath(); ctx.moveTo(X(fx-4),Y(floor-12)); ctx.quadraticCurveTo(X(fx+Math.sin(fr*0.3+i)*3),Y(floor-12-h*1.2),X(fx+4),Y(floor-12)); ctx.fill();
      ctx.fillStyle='#ffe8a0'; ctx.beginPath(); ctx.moveTo(X(fx-2),Y(floor-12)); ctx.quadraticCurveTo(X(fx),Y(floor-12-h*0.6),X(fx+2),Y(floor-12)); ctx.fill();
    }
    rect(x+6,floor-12,46,3,'#5a2a14');
    rect(x+20,flueTop,18,floor-56-flueTop,'#2a2422'); rect(x+22,flueTop,4,floor-56-flueTop,'#3e3634');
    for(let i=0;i<7;i++){                                // sparks drifting up out of the grate
      const t=((fr*0.012+i*0.143)%1), sxp=x+16+hash(i,3)*26+Math.sin(t*12+i)*5, syp=floor-16-t*46;
      ctx.fillStyle='rgba(255,'+(160+((i*37)%80))+',60,'+(1-t)+')'; ctx.fillRect(X(sxp),Y(syp),S(2),S(2));
    }
  }
  function hutch(x,top,floor){                            // the kitchen hutch MIND climbs on
    rect(x+4,top+8,4*T-8,floor-top-8,P.woodD);
    rect(x+8,top+14,4*T-16,32,'#2a1a10');
    for(let i=0;i<5;i++){ ctx.fillStyle=['#e8e0d0','#c8d8e8','#e8e0d0','#d8c8a8','#e8e0d0'][i]; ctx.beginPath(); ctx.arc(X(x+22+i*22),Y(top+32),S(9),Math.PI,0); ctx.fill(); }
    rect(x+8,top+50,4*T-16,floor-top-58,P.wood);
    rect(x+2*T-1,top+50,2,floor-top-58,P.woodD);
    rect(x+2*T-12,top+70,4,10,P.gold); rect(x+2*T+8,top+70,4,10,P.gold);
  }
  function counter(x,floor,w){
    rect(x,floor-40,w,40,P.woodD); rect(x-2,floor-44,w+4,6,P.woodH);
    for(let i=0;i<Math.floor(w/40);i++) rect(x+6+i*40,floor-32,32,24,P.wood);
  }
  function pots(x,y,n){
    for(let i=0;i<n;i++){
      const a=Math.sin(fr*0.03+i*1.3)*0.12, px=x+i*36, len=18;
      const hx=px+Math.sin(a)*len, hy=y+Math.cos(a)*len;
      ctx.strokeStyle='#3a3230'; ctx.lineWidth=S(1.5); ctx.beginPath(); ctx.moveTo(X(px),Y(y)); ctx.lineTo(X(hx),Y(hy)); ctx.stroke();
      ctx.fillStyle=i%2?'#8a8a92':'#b06a3a'; ctx.beginPath(); ctx.arc(X(hx),Y(hy+8),S(9),0,Math.PI); ctx.fill(); rect(hx-11,hy+6,22,3,'#4a4a52');
    }
  }
  function rug(cx,floor,w){ ctx.fillStyle=P.rugA; ctx.beginPath(); ctx.ellipse(X(cx),Y(floor-2),S(w/2),S(5),0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=P.rugB; ctx.lineWidth=S(2); ctx.beginPath(); ctx.ellipse(X(cx),Y(floor-2),S(w/2-8),S(3),0,0,Math.PI*2); ctx.stroke(); }
  function candle(x,floor){
    rect(x-3,floor-14,6,14,'#efe2c8');
    const f=Math.sin(fr*0.4+x)*1.2;
    ctx.fillStyle='#ffcf6a'; ctx.beginPath(); ctx.ellipse(X(x+f*0.4),Y(floor-19),S(2.4),S(4+Math.abs(f)),0,0,Math.PI*2); ctx.fill();
    glow(x,floor-20,30,0.25+0.08*Math.sin(fr*0.3+x));
  }

  function familyHome(rm){
    const x=rm.x, y=rm.y, w=rm.w, F=rm.y+rm.h, loft=(rm.loft||0)*T, below=loft+T;
    planks(x,y,w,rm.h);
    wainscot(x,loft-8,w,loft-y);
    wainscot(x,below,w,F-below);
    const C=c=>c*T;
    // upstairs: Bedroom 1 + Bedroom 2
    bed(C(7),loft,150,'#5a6aa8',(MV_BETA.bedSq||[])[0]); bed(C(17),loft,140,'#a85a6a',(MV_BETA.bedSq||[])[1]);
    window_(C(13)+8,y+28,56,58,true);
    rect(C(22)+4,loft-30,22,30,P.woodD); candle(C(22)+15,loft-30);
    frame(C(9),y+24,40,30,'#3a5a3a'); frame(C(19),y+20,34,40,'#5a3a5a');
    rug(C(15),loft,180);
    // downstairs: kitchen (west) + living room (east)
    hutch(C(2),below+3*T,F);                           // hutch top is the one-way step (map row 18)
    counter(C(6),F,150);
    pots(C(7),below+6,4);
    stove(C(11)-6,F,below);
    window_(C(14)+8,below+30,56,52,true);
    rug(C(21),F,220);
    armchair(C(17),F,P.green,P.greenH);
    sofa(C(20),F,110);
    gramophone(C(24),F);
    frame(C(18),below+26,46,34,'#2a4a6a'); frame(C(23),below+22,30,40,'#6a4a2a');
    hangingLamp(C(9),below,26); hangingLamp(C(21),below,26);
    glow(x+w-80,F-60,140,0.12);
  }
  function laituHome(rm){
    const x=rm.x, y=rm.y, w=rm.w, h=rm.h, F=y+h;
    planks(x,y,w,h); wainscot(x,y,w,h);
    rect(x+30,y+40,180,5,P.woodH);
    for(let i=0;i<5;i++){ const lx=x+44+i*34, fl=0.8+0.2*Math.sin(fr*0.2+i*1.7);
      rect(lx,y+20,16,20,'#2a2422'); ctx.globalAlpha=fl; rect(lx+3,y+24,10,12,P.lamp); ctx.globalAlpha=1; glow(lx+8,y+30,26,0.22*fl); }
    rect(x+20,F-36,150,8,P.woodH); rect(x+28,F-28,8,28,P.woodD); rect(x+154,F-28,8,28,P.woodD);
    rect(x+50,F-52,30,16,'#5a5a62'); rect(x+100,F-48,24,12,P.gold);
    window_(x+240,y+44,56,52,true);
    armchair(x+340,F,P.orange,P.orangeH);
    rug(x+390,F,150);
    stove(x+w-112,F,y);
    hangingLamp(x+w/2-40,y,26);
  }

  // ── Exterior touches ─────────────────────────────────────────────
  function chimney(x,top,bottom){
    rect(x,top,40,bottom-top,P.brick);
    for(let yy=top; yy<bottom; yy+=10) for(let xx=x+((yy/10)%2?0:10); xx<x+40; xx+=20) rect(xx,yy,18,8,P.brickHi);
    rect(x-4,top-6,48,8,P.mortar);
    for(let i=0;i<4;i++){ const t=(fr*0.6+i*30)%120; ctx.fillStyle='rgba(200,190,210,'+(0.25*(1-t/120))+')';
      ctx.beginPath(); ctx.arc(X(x+20+Math.sin((fr+i*30)*0.03)*8+t*0.25),Y(top-10-t),S(6+t*0.08),0,Math.PI*2); ctx.fill(); }
  }
  function atticWindow(cx,cy){ ctx.fillStyle=P.woodD; ctx.beginPath(); ctx.arc(X(cx),Y(cy),S(17),0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ffd27a'; ctx.beginPath(); ctx.arc(X(cx),Y(cy),S(13),0,Math.PI*2); ctx.fill(); glow(cx,cy,40,0.25+0.08*Math.sin(fr*0.05));
    rect(cx-1,cy-13,2,26,P.woodD); rect(cx-13,cy-1,26,2,P.woodD); }
  function lampPost(x,floor){
    rect(x-3,floor-110,6,110,'#2a2228'); rect(x-10,floor-122,20,16,'#2a2228'); rect(x-7,floor-118,14,10,P.lamp); glow(x,floor-113,70,0.28+0.04*Math.sin(fr*0.09+x));
    for(let i=0;i<3;i++){ const a=fr*0.04+i*2.1+x; ctx.fillStyle='rgba(255,240,180,0.7)'; ctx.fillRect(X(x+Math.cos(a)*18),Y(floor-114+Math.sin(a*1.3)*12),S(2),S(2)); }   // moths
  }
  function sign(x,floor){ rect(x-2,floor-70,4,70,P.woodD);
    const a=Math.sin(fr*0.02)*0.02; ctx.save(); ctx.translate(X(x),Y(floor-70)); ctx.rotate(a);
    ctx.fillStyle='#24402a'; ctx.fillRect(-S(34),-S(4),S(68),S(30)); ctx.fillStyle='#2e5234'; ctx.fillRect(-S(31),-S(1),S(62),S(24)); ctx.restore();
    MV_BETA.wtext(drawTextC,'AWDJOO',X(x),Y(floor-67),'#c8e8a8',1); MV_BETA.wtext(drawTextC,'POP. ∞',X(x),Y(floor-56),'#c8e8a8',1); }
  // flowers + grass tufts on top of the ground: they sway with a little wind
  function flowers(c,r){
    const wind=Math.sin(fr*0.02+c*0.15)*0.18+Math.sin(fr*0.07+c*0.6)*0.08;
    for(let k=0;k<3;k++){                                  // grass tufts
      const gx=c*T+4+k*11+hash(c,r+k)*4, gy=r*T+1, a=wind*1.4;
      ctx.strokeStyle=k%2?P.grass:P.grassD; ctx.lineWidth=S(1.6);
      ctx.beginPath(); ctx.moveTo(X(gx),Y(gy)); ctx.lineTo(X(gx+Math.sin(a)*6),Y(gy-6)); ctx.stroke();
    }
    if(hash(c,r)>0.5) return;
    const x=c*T+6+hash(c,r+7)*20, y=r*T, a=wind;
    const tx=x+Math.sin(a)*9, ty=y-Math.cos(a)*9;
    ctx.strokeStyle='#3a7a3a'; ctx.lineWidth=S(1.5); ctx.beginPath(); ctx.moveTo(X(x),Y(y)); ctx.quadraticCurveTo(X(x+Math.sin(a)*3),Y(y-5),X(tx),Y(ty)); ctx.stroke();
    ctx.fillStyle=hash(c,r+3)<0.5?P.flower:P.flowerB;
    for(let i=0;i<5;i++){ const pa=i/5*Math.PI*2+a; ctx.beginPath(); ctx.arc(X(tx+Math.cos(pa)*2.4),Y(ty+Math.sin(pa)*2.4),S(1.8),0,Math.PI*2); ctx.fill(); }
    ctx.fillStyle='#ffe08a'; ctx.beginPath(); ctx.arc(X(tx),Y(ty),S(1.4),0,Math.PI*2); ctx.fill();
  }
  function fireflies(B){
    const c0=Math.floor(camX/T)-1, c1=c0+Math.ceil(W/T)+2;
    for(let c=c0;c<=c1;c+=3){
      if(c<0||c>=B.level.cols) continue;
      const s=B.surfRow?B.surfRow[c]:null; if(s==null) continue;
      const ph=fr*0.012+hash(c,9)*6.28, x=c*T+16+Math.sin(ph*1.3)*30, y=s*T-30-Math.abs(Math.sin(ph))*50;
      const a=0.4+0.6*Math.abs(Math.sin(fr*0.05+c));
      ctx.fillStyle='rgba(200,255,140,'+a+')'; ctx.fillRect(X(x),Y(y),S(2),S(2));
      glow(x,y,10,0.18*a,'rgba(200,255,140,');
    }
  }

  // ── The Knowl tree: huge, ancient, glowing (canopy cached once) ───
  let treeImg=null;
  const TREE={W:680, H:640, CY:450, TRUNK:360};   // canopy centre / trunk top, px above the roots
  function buildTree(){
    treeImg=mk(TREE.W,TREE.H,(g,w,h)=>{
      const cx=w/2, base=h;
      // roots
      g.strokeStyle='#3a2414'; g.lineCap='round';
      for(let i=0;i<9;i++){ const s=i/8*2-1; g.lineWidth=14-Math.abs(s)*8; g.beginPath(); g.moveTo(cx+s*30,base-40);
        g.quadraticCurveTo(cx+s*90,base-10,cx+s*(150+hash(i,2)*60),base-2); g.stroke(); }
      // trunk: twisting, wide at the foot
      const tg=g.createLinearGradient(cx-60,0,cx+60,0); tg.addColorStop(0,'#2a180e'); tg.addColorStop(0.45,'#6a4426'); tg.addColorStop(1,'#2a180e');
      g.fillStyle=tg; g.beginPath(); g.moveTo(cx-62,base-4); g.bezierCurveTo(cx-30,base-150,cx-64,base-280,cx-26,base-TREE.TRUNK);
      g.lineTo(cx+28,base-TREE.TRUNK); g.bezierCurveTo(cx+66,base-280,cx+30,base-150,cx+64,base-4); g.closePath(); g.fill();
      g.strokeStyle='rgba(20,10,4,0.6)'; g.lineWidth=2;
      for(let i=0;i<7;i++){ g.beginPath(); const x0=cx-36+i*12; g.moveTo(x0,base-10); g.bezierCurveTo(x0+10,base-130,x0-12,base-260,x0+4,base-TREE.TRUNK+10); g.stroke(); }
      // branches
      g.strokeStyle='#4a2e18';
      for(const [ex,ey,wd] of [[-240,-450,18],[230,-440,18],[-150,-520,13],[160,-530,13],[-300,-380,11],[300,-390,11],[0,-550,15]]){
        g.lineWidth=wd; g.beginPath(); g.moveTo(cx,base-TREE.TRUNK+10); g.quadraticCurveTo(cx+ex*0.4,base+ey*0.85,cx+ex,base+ey); g.stroke(); }
      // canopy: layered clouds of teal leaves
      const blobs=[];
      for(let i=0;i<90;i++){ const a=hash(i,11)*Math.PI*2, rr=Math.sqrt(hash(i,12));
        blobs.push([cx+Math.cos(a)*rr*285, base-TREE.CY+Math.sin(a)*rr*120, 40+hash(i,13)*36, hash(i,14)]); }
      blobs.sort((a,b)=>a[1]-b[1]);
      for(const [bx,by,br,t] of blobs){
        const lg=g.createRadialGradient(bx-br*0.3,by-br*0.4,br*0.1,bx,by,br);
        lg.addColorStop(0,t<0.5?'#5fe0b0':'#4ac8a0'); lg.addColorStop(0.7,'#1e7a62'); lg.addColorStop(1,'#0e4a3c');
        g.fillStyle=lg; g.beginPath(); g.arc(bx,by,br,0,Math.PI*2); g.fill();
      }
      for(let i=0;i<260;i++){ const a=hash(i,21)*Math.PI*2, rr=Math.sqrt(hash(i,22));     // leaf glints
        g.fillStyle=hash(i,23)<0.5?'rgba(170,255,220,0.7)':'rgba(90,220,170,0.6)';
        g.fillRect(cx+Math.cos(a)*rr*300, base-TREE.CY+Math.sin(a)*rr*130, 2, 2); }
      // stone ring at the roots
      g.fillStyle='#3a322e'; g.beginPath(); g.ellipse(cx,base-6,190,16,0,0,Math.PI*2); g.fill();
      g.fillStyle='#2a2422'; g.beginPath(); g.ellipse(cx,base-6,172,10,0,0,Math.PI*2); g.fill();
      for(let i=0;i<16;i++){ const a=i/16*Math.PI*2; g.fillStyle=i%2?'#4a403a':'#5a4e46'; g.fillRect(cx+Math.cos(a)*182-7,base-6+Math.sin(a)*13-5,14,9); }
    });
  }
  // hanging Knowl drops, sparkles, light shafts — the parts that move
  const DROPS=[]; for(let i=0;i<34;i++){ const a=hash(i,31)*Math.PI*2, rr=0.35+Math.sqrt(hash(i,32))*0.65; DROPS.push({ox:Math.cos(a)*rr*270, oy:-TREE.CY+Math.sin(a)*rr*100+80, len:14+hash(i,33)*30, ph:hash(i,34)*6.28}); }
  function knowlTree(d){
    if(!treeImg) buildTree();
    const bx=d.x+T/2, by=d.y;                           // anchor = middle of the floor cell's top edge
    if(!inView(bx-TREE.W/2,by-TREE.H-60,TREE.W,TREE.H+80)) return;
    // halo behind
    glow(bx,by-TREE.CY+60,460,0.20+0.05*Math.sin(fr*0.02),'rgba(110,255,200,');
    // light shafts from the canopy down to the roots
    ctx.save(); ctx.globalCompositeOperation='lighter';
    for(let i=0;i<5;i++){ const sxp=bx-200+i*100+Math.sin(fr*0.01+i)*20, a=0.05+0.03*Math.sin(fr*0.02+i*1.7);
      const gg=ctx.createLinearGradient(0,Y(by-TREE.CY+80),0,Y(by)); gg.addColorStop(0,'rgba(140,255,210,'+a+')'); gg.addColorStop(1,'rgba(140,255,210,0)');
      ctx.fillStyle=gg; ctx.beginPath(); ctx.moveTo(X(sxp-18),Y(by-TREE.CY+80)); ctx.lineTo(X(sxp+18),Y(by-TREE.CY+80)); ctx.lineTo(X(sxp+46),Y(by)); ctx.lineTo(X(sxp-46),Y(by)); ctx.fill(); }
    ctx.restore();
    const breath=1+0.008*Math.sin(fr*0.015);
    ctx.drawImage(treeImg, X(bx-TREE.W/2*breath), Y(by-TREE.H*breath), S(TREE.W*breath), S(TREE.H*breath));
    // glowing drops hanging from the canopy, swinging gently
    for(const dr of DROPS){
      const sway=Math.sin(fr*0.02+dr.ph)*4, x=bx+dr.ox+sway, top=by+dr.oy, y=top+dr.len;
      ctx.strokeStyle='rgba(60,140,110,0.8)'; ctx.lineWidth=S(1); ctx.beginPath(); ctx.moveTo(X(bx+dr.ox),Y(top)); ctx.lineTo(X(x),Y(y)); ctx.stroke();
      const pulse=0.6+0.4*Math.sin(fr*0.05+dr.ph);
      glow(x,y,14,0.35*pulse,'rgba(120,255,210,');
      teardrop(x,y+4,4.5,'#9affe0','#2aa884');
    }
    // knowl motes rising
    for(let i=0;i<24;i++){
      const t=((fr*0.004+hash(i,41))%1), x=bx+(hash(i,42)-0.5)*460+Math.sin(t*10+i)*14, y=by-10-t*560;
      ctx.fillStyle='rgba(160,255,220,'+(Math.sin(t*Math.PI)*0.85)+')'; ctx.fillRect(X(x),Y(y),S(2.5),S(2.5));
    }
  }
  function teardrop(x,y,r,fill,edge){
    ctx.fillStyle=fill; ctx.strokeStyle=edge; ctx.lineWidth=S(1.2);
    ctx.beginPath(); ctx.moveTo(X(x),Y(y-r*2.2));
    ctx.bezierCurveTo(X(x+r*1.2),Y(y-r*0.9),X(x+r*1.1),Y(y+r),X(x),Y(y+r));
    ctx.bezierCurveTo(X(x-r*1.1),Y(y+r),X(x-r*1.2),Y(y-r*0.9),X(x),Y(y-r*2.2));
    ctx.fill(); ctx.stroke();
  }

  // ── Angelic choir near the tree ("aaah"), louder as MIND gets closer ──
  const CHOIR={R:760, VOL:0.16};
  let choir=null;
  function choirInit(){
    const ac=(typeof _bgmAC!=='undefined'&&_bgmAC)||null;
    if(!ac||ac.state!=='running') return null;
    const out=ac.createGain(); out.gain.value=0;
    // a little hall: two feedback delays
    const wet=ac.createGain(); wet.gain.value=0.55;
    const d1=ac.createDelay(1), d2=ac.createDelay(1), f1=ac.createGain(), f2=ac.createGain();
    d1.delayTime.value=0.137; d2.delayTime.value=0.211; f1.gain.value=0.5; f2.gain.value=0.46;
    out.connect(ac.destination); out.connect(d1); out.connect(d2);
    d1.connect(f1); f1.connect(d1); d2.connect(f2); f2.connect(d2); f1.connect(wet); f2.connect(wet); wet.connect(ac.destination);
    const bus=ac.createGain(); bus.gain.value=0.7; bus.connect(out);
    // "aah" vowel: formants ~730 Hz and ~1090 Hz (+ a little air at 2440)
    const forms=[[730,7,1],[1090,9,0.6],[2440,12,0.18]].map(([f,q,gain])=>{ const b=ac.createBiquadFilter(); b.type='bandpass'; b.frequency.value=f; b.Q.value=q;
      const gg=ac.createGain(); gg.gain.value=gain*3.2; b.connect(gg); gg.connect(bus); return b; });
    const voices=[];
    const chord=[220,277.18,329.63,440,554.37,659.25];          // A major, spread like a choir
    chord.forEach((f,i)=>{
      for(const det of [-4,4]){
        const o=ac.createOscillator(); o.type='sawtooth'; o.frequency.value=f; o.detune.value=det+(i%2?3:-3);
        const lfo=ac.createOscillator(), lg=ac.createGain(); lfo.frequency.value=4.6+i*0.17+(det>0?0.21:0); lg.gain.value=f*0.006; lfo.connect(lg); lg.connect(o.frequency);
        const vg=ac.createGain(); vg.gain.value=0.05;
        o.connect(vg); forms.forEach(b=>vg.connect(b));
        o.start(); lfo.start(); voices.push(o,lfo);
      }
    });
    // slow swell so it breathes
    const sw=ac.createOscillator(), sg=ac.createGain(); sw.frequency.value=0.08; sg.gain.value=0.25; sw.connect(sg); sg.connect(bus.gain); sw.start(); voices.push(sw);
    return {ac,out,voices};
  }
  function choirTick(B){
    const tree=B.decor.find(d=>d.kind==='tree');
    if(!tree||!B.on||typeof p==='undefined'||!p){ if(choir) choir.out.gain.setTargetAtTime(0,choir.ac.currentTime,0.3); return; }
    const d=Math.hypot(p.x+SW/2-(tree.x+T/2), p.y+FEET_OFF-60-(tree.y-300));
    const k=Math.max(0,1-d/CHOIR.R), vol=k*k*CHOIR.VOL*Math.max(0,Math.min(1,(typeof OPT!=='undefined'&&OPT.sfxVol!=null)?OPT.sfxVol:1));
    B.choirLevel=+vol.toFixed(4);
    if(vol<=0.0005&&!choir) return;
    if(!choir){ choir=choirInit(); if(!choir) return; }
    choir.out.gain.setTargetAtTime(vol,choir.ac.currentTime,0.25);
  }

  // ── Pickups ───────────────────────────────────────────────────────
  function seed(k){
    const x=k.x, y=k.y, ph=(k.bob||0)*3+fr*0.06;
    if(!inView(x-60,y-140,120,160)) return;
    const pulse=0.75+0.25*Math.sin(ph);
    // beam of light so seeds can be spotted from afar
    const gg=ctx.createLinearGradient(0,Y(y-150),0,Y(y));
    gg.addColorStop(0,'rgba(120,255,200,0)'); gg.addColorStop(1,'rgba(120,255,200,'+(0.22*pulse)+')');
    ctx.fillStyle=gg; ctx.fillRect(X(x-7),Y(y-150),S(14),S(150));
    glow(x,y,46,0.45*pulse,'rgba(110,255,200,');
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(X(x),Y(y+14),S(10),S(2.5),0,0,Math.PI*2); ctx.fill();
    teardrop(x,y+4,8,'#7dffcf','#13684e');
    ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(X(x-2.5),Y(y-2),S(1.8),S(3.2),-0.4,0,Math.PI*2); ctx.fill();
    for(let i=0;i<3;i++){                                // sparkles orbiting
      const a=fr*0.05+i*2.09+(k.bob||0), r=16+3*Math.sin(fr*0.1+i);
      const sxp=x+Math.cos(a)*r, syp=y-2+Math.sin(a)*r*0.5, s=1.5+Math.sin(fr*0.2+i)*1;
      ctx.fillStyle='rgba(220,255,240,0.95)'; ctx.fillRect(X(sxp-s),Y(syp),S(s*2+1),S(1)); ctx.fillRect(X(sxp),Y(syp-s),S(1),S(s*2+1));
    }
  }
  // Knowl crystal (Paulo, Oct 21): sits still at its spawn spot — a little cluster
  // of faceted green crystal, glossy, with the greens shifting through the facets
  // like light through a gem, a specular streak and twinkling glints.
  function gemShard(x,base,w,h,tilt,ph,echo){
    ctx.save(); ctx.translate(X(x),Y(base)); ctx.rotate(tilt);
    const W2=S(w)/2, Hh=S(h), sh=Hh*0.74, bw=W2*0.82;
    const hue=t=>echo?(320+18*Math.sin(t)):(138+22*Math.sin(t));        // the green spectrum (echo: pink)
    const c=(t,l,a)=>'hsla('+hue(fr*0.03+ph+t).toFixed(1)+',85%,'+l+'%,'+(a==null?1:a)+')';
    const facet=(pts,g)=>{ ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]); ctx.closePath(); ctx.fillStyle=g; ctx.fill(); };
    const tip=[0,-Hh], ls=[-W2,-sh], rs=[W2,-sh], lb=[-bw,0], rb=[bw,0], ml=[-W2*0.3,-sh*0.98], mr=[W2*0.3,-sh*0.98], mb=[0,0];
    let g=ctx.createLinearGradient(-W2,0,0,0); g.addColorStop(0,c(0,22)); g.addColorStop(1,c(0.6,38));
    facet([ls,ml,mb,lb],g);                                                   // left face (shadow)
    g=ctx.createLinearGradient(0,-sh,0,0); g.addColorStop(0,c(1.2,72)); g.addColorStop(1,c(1.8,46));
    facet([ml,mr,mb],g);                                                      // front face (lit)
    g=ctx.createLinearGradient(0,0,W2,0); g.addColorStop(0,c(2.4,52)); g.addColorStop(1,c(3,30));
    facet([mr,rs,rb,mb],g);                                                   // right face
    g=ctx.createLinearGradient(0,-Hh,0,-sh); g.addColorStop(0,c(3.6,88)); g.addColorStop(1,c(4.2,62));
    facet([tip,rs,mr,ml],g);                                                  // crown, right
    g=ctx.createLinearGradient(0,-Hh,0,-sh); g.addColorStop(0,c(4.8,80)); g.addColorStop(1,c(5.4,40));
    facet([tip,ml,ls],g);                                                     // crown, left
    ctx.strokeStyle=echo?'#3a0c2c':'#06321e'; ctx.lineWidth=Math.max(1,S(1.2)); ctx.lineJoin='round';
    ctx.beginPath(); ctx.moveTo(lb[0],lb[1]); ctx.lineTo(ls[0],ls[1]); ctx.lineTo(tip[0],tip[1]); ctx.lineTo(rs[0],rs[1]); ctx.lineTo(rb[0],rb[1]); ctx.closePath(); ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=Math.max(1,S(0.8));
    ctx.beginPath(); ctx.moveTo(ml[0],ml[1]); ctx.lineTo(mb[0],mb[1]); ctx.moveTo(mr[0],mr[1]); ctx.lineTo(mb[0],mb[1]); ctx.moveTo(ml[0],ml[1]); ctx.lineTo(mr[0],mr[1]); ctx.stroke();
    // gloss: a soft specular streak that slides up the front face
    const gl=(Math.sin(fr*0.035+ph)+1)/2;
    ctx.fillStyle='rgba(255,255,255,'+(0.35+0.35*gl).toFixed(3)+')';
    ctx.beginPath(); ctx.moveTo(-W2*0.18,-sh*(0.2+0.5*gl)); ctx.lineTo(-W2*0.02,-sh*(0.2+0.5*gl)-Hh*0.18); ctx.lineTo(W2*0.06,-sh*(0.2+0.5*gl)-Hh*0.14); ctx.lineTo(-W2*0.1,-sh*(0.2+0.5*gl)+Hh*0.04); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(-W2*0.35,-sh*0.9,Math.max(1,S(1.3)),0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  // Knowl crystal (Paulo, Oct 21): one symmetrical hexagonal gem — see-through, green,
  // with prism colours sliding through it and rainbow glints on its edges. Sits still.
  function crystal(k,style){
    const echo=style==='echo';
    const x=k.x, cy=k.y-10;
    if(!inView(x-60,cy-60,120,110)) return;
    const hw=S(13), hh=S(24), X0=X(x), Y0=Y(cy);
    glow(x,cy,echo?60:54,0.34+0.08*Math.sin(fr*0.05),echo?'rgba(255,140,220,':'rgba(90,255,170,');
    ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(X0,Y(k.y+13),S(12),S(2.5),0,0,Math.PI*2); ctx.fill();
    const O=[[0,-hh],[hw,-hh/2],[hw,hh/2],[0,hh],[-hw,hh/2],[-hw,-hh/2]];           // the outline
    const I=O.map(([u,v])=>[u*0.42,v*0.42]);                                           // the table (inner hexagon)
    const base=echo?320:145;
    const path=P=>{ ctx.beginPath(); ctx.moveTo(X0+P[0][0],Y0+P[0][1]); for(let i=1;i<P.length;i++) ctx.lineTo(X0+P[i][0],Y0+P[i][1]); ctx.closePath(); };
    ctx.save();
    // facets: each one a slightly different shade, all partly see-through
    const light=[78,64,46,36,50,70];
    for(let i=0;i<6;i++){
      const j=(i+1)%6;
      path([O[i],O[j],I[j],I[i]]);
      ctx.fillStyle='hsla('+(base+10*Math.sin(fr*0.02+i)).toFixed(0)+',80%,'+light[i]+'%,0.46)'; ctx.fill();
    }
    path(I); ctx.fillStyle='hsla('+base+',85%,82%,0.32)'; ctx.fill();
    // prism: rainbow bands drifting through the body
    path(O); ctx.clip();
    for(let n=0;n<7;n++){
      const t=((fr*0.006+n/7)%1), yy=Y0-hh*1.3+t*hh*2.6;
      ctx.fillStyle='hsla('+((n*52+fr*0.6)%360).toFixed(0)+',100%,70%,0.16)';
      ctx.beginPath(); ctx.moveTo(X0-hw*1.2,yy); ctx.lineTo(X0+hw*1.2,yy-hh*0.55); ctx.lineTo(X0+hw*1.2,yy-hh*0.55+S(4)); ctx.lineTo(X0-hw*1.2,yy+S(4)); ctx.fill();
    }
    ctx.restore();
    // facet edges: thin bright lines, rainbow-tinted
    ctx.save(); ctx.lineJoin='round';
    ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=Math.max(1,S(0.8));
    ctx.beginPath(); for(let i=0;i<6;i++){ ctx.moveTo(X0+I[i][0],Y0+I[i][1]); ctx.lineTo(X0+O[i][0],Y0+O[i][1]); } ctx.stroke();
    path(I); ctx.stroke();
    path(O); ctx.strokeStyle=echo?'#3a0c2c':'#073a24'; ctx.lineWidth=Math.max(1,S(1.6)); ctx.stroke();
    path(O); ctx.strokeStyle='hsla('+((fr*1.2)%360).toFixed(0)+',100%,78%,0.55)'; ctx.lineWidth=Math.max(1,S(0.9)); ctx.stroke();
    // gloss: a specular streak on the upper-left face, and a hot spot
    const gl=(Math.sin(fr*0.035)+1)/2;
    ctx.fillStyle='rgba(255,255,255,'+(0.35+0.35*gl).toFixed(2)+')';
    ctx.beginPath(); ctx.moveTo(X0-hw*0.82,Y0-hh*0.42); ctx.lineTo(X0-hw*0.2,Y0-hh*0.82); ctx.lineTo(X0-hw*0.08,Y0-hh*0.7); ctx.lineTo(X0-hw*0.68,Y0-hh*0.3); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(X0-hw*0.3,Y0-hh*0.62,Math.max(1,S(1.4)),0,Math.PI*2); ctx.fill();
    ctx.restore();
    if(echo){ ctx.save(); ctx.strokeStyle='rgba(255,170,230,'+(0.5+0.4*Math.sin(fr*0.1))+')'; ctx.lineWidth=2; const rr=S(24)*(1.3+0.25*Math.sin(fr*0.07)); ctx.beginPath(); ctx.arc(X0,Y0,rr,0,Math.PI*2); ctx.stroke(); ctx.restore(); }
    for(let i=0;i<3;i++){                                            // twinkling glints, prism-coloured
      const t=((fr*0.02+i*0.37+(k.ox||0)*0.001)%1); if(t>0.3) continue;
      const a=Math.sin(t/0.3*Math.PI), gx=x+[-9,8,2][i], gy=cy+[-12,4,-20][i], r=S(2+4*a);
      ctx.fillStyle='hsla('+((i*120+fr*2)%360).toFixed(0)+',100%,90%,'+a.toFixed(2)+')';
      ctx.fillRect(X(gx)-r,Y(gy)-0.5,r*2,Math.max(1,S(1))); ctx.fillRect(X(gx)-0.5,Y(gy)-r,Math.max(1,S(1)),r*2);
    }
  }
  // A wooden crate with a paper label showing the jack inside (all male plugs).
  const ITEM_NAMES=['TRS','RCA','XLR','MEG','ISOLATOR','KNIFE'];
  // the Isolator: an orange rubber ring with a sealed core (the sketch's orange circle with a dot)
  function isolatorIcon(x,y,s){
    ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
    ctx.fillStyle='#c85a18'; ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ff9a40'; ctx.beginPath(); ctx.arc(-2,-2,19,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#efe2c0'; ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#c85a18'; ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(255,240,200,0.8)'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(-2,-2,15,Math.PI*1.1,Math.PI*1.6); ctx.stroke();
    ctx.restore();
  }
  function itemCrate(idx,cx,bottom,enh,noName){
    const w=46, h=40, x=cx-w/2, y=bottom-h;
    if(!inView(x-10,y-20,w+20,h+30)) return;
    ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(X(cx),Y(bottom),S(24),S(3),0,0,Math.PI*2); ctx.fill();
    rect(x,y,w,h,'#5a3418');
    for(let i=0;i<3;i++) rect(x+2,y+2+i*12,w-4,11,i%2?'#a06a38':'#b47a40');
    rect(x,y,w,3,'#c88a4a'); rect(x,y+h-3,w,3,'#3a200c');
    rect(x+2,y+2,4,h-4,'#7a4a22'); rect(x+w-6,y+2,4,h-4,'#7a4a22');
    for(const [ox,oy] of [[0,0],[w-6,0],[0,h-6],[w-6,h-6]]) rect(x+ox,y+oy,6,6,'#5a5e66');
    // label
    rect(x+7,y+6,w-14,h-14,'#efe2c0'); rect(x+7,y+6,w-14,2,'#fff6dc');
    ctx.save(); ctx.beginPath(); ctx.rect(X(x+8),Y(y+7),S(w-16),S(h-16)); ctx.clip();
    ctx.translate(X(cx-1),Y(y+6+(h-14)/2)); ctx.scale(Z*0.5,Z*0.5);
    if(idx===4) isolatorIcon(0,0,1);
    else if(idx===5&&typeof drawConnectorTip==='function') drawConnectorTip(-24,0,0,0,4,enh);   // the gaucho knife (1.3)
    else if(typeof drawConnectorTip==='function') drawConnectorTip(idx===3?-14:-16,0,0,0,idx,enh);
    ctx.restore();
    // name under the crate
    if(!noName) (window.MV_BETA&&MV_BETA.wtext?MV_BETA.wtext:(f,...a)=>f(...a))(drawTextC, ITEM_NAMES[idx]||'?', X(cx), Y(bottom+3), enh?'#7dffcf':'#ffe8b0', 1);
    // a shine sweeps across now and then so it reads as a pickup
    const t=((fr+idx*40)%150)/150;
    if(t<0.25){ ctx.save(); ctx.globalAlpha=0.35*(1-Math.abs(t*8-1)); ctx.fillStyle='#fff';
      ctx.beginPath(); const sxp=x+t*4*(w+20)-10; ctx.moveTo(X(sxp),Y(y)); ctx.lineTo(X(sxp+8),Y(y)); ctx.lineTo(X(sxp-4),Y(y+h)); ctx.lineTo(X(sxp-12),Y(y+h)); ctx.fill(); ctx.restore(); }
    if(enh) glow(cx,y+h/2,40,0.3,'rgba(80,255,150,');
  }

  // the arch MIND comes through from the last stage: open, softly glowing
  function arrivalArch(d){
    const x=d.x, y=d.y, w=2*T, h=4*T;
    glow(x+w/2,y+h*0.55,90,0.22+0.06*Math.sin(fr*0.05),'rgba(255,230,140,');
    ctx.lineWidth=S(8); ctx.strokeStyle='#e8c860';
    ctx.beginPath(); ctx.moveTo(X(x+6),Y(y+h)); ctx.lineTo(X(x+6),Y(y+w/2)); ctx.arc(X(x+w/2),Y(y+w/2),S(w/2-6),Math.PI,0); ctx.lineTo(X(x+w-6),Y(y+h)); ctx.stroke();
    ctx.fillStyle='rgba(255,230,140,'+(0.18+0.1*Math.sin(fr*0.08))+')'; ctx.fillRect(X(x+10),Y(y+w/2),S(w-20),S(h-w/2));
  }

  // ── Background art (the PINK in Paulo's sketches: no collision) ──────
  function poly(pts,col){ ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(X(pts[0][0]),Y(pts[0][1])); for(let i=1;i<pts.length;i++) ctx.lineTo(X(pts[i][0]),Y(pts[i][1])); ctx.closePath(); ctx.fill(); }
  // a band of fish-scale roof tiles following a path (terracotta, Brazilian style)
  function scaleRoof(x0,y0,x1,y1,rows,col,hi,dark){
    const len=Math.hypot(x1-x0,y1-y0), ang=Math.atan2(y1-y0,x1-x0);
    ctx.save(); ctx.translate(X(x0),Y(y0)); ctx.rotate(ang);
    const th=rows*11+6;
    ctx.fillStyle=dark; ctx.fillRect(0,S(-4),S(len),S(th));
    for(let r=0;r<rows;r++){
      const yy=r*11, off=(r&1)?8:0;
      for(let xx=-8+off; xx<len; xx+=16){
        ctx.fillStyle=dark; ctx.beginPath(); ctx.arc(S(xx+8),S(yy+9),S(8.5),0,Math.PI); ctx.fill();
        ctx.fillStyle=col; ctx.beginPath(); ctx.arc(S(xx+8),S(yy+8),S(7.4),0,Math.PI); ctx.fill();
        ctx.strokeStyle=hi; ctx.lineWidth=Math.max(1,S(1.2)); ctx.beginPath(); ctx.arc(S(xx+8),S(yy+8),S(5.6),Math.PI*0.2,Math.PI*0.8); ctx.stroke();
      }
    }
    ctx.restore();
  }
  function litWindow(x,y,w,h,ph,figure){
    rect(x-3,y-3,w+6,h+6,'#2a1820');
    const fl=0.82+0.18*Math.sin(fr*0.06+ph);
    const g=ctx.createLinearGradient(0,Y(y),0,Y(y+h)); g.addColorStop(0,'rgba(255,214,130,'+fl+')'); g.addColorStop(1,'rgba(232,140,70,'+fl+')');
    ctx.fillStyle=g; ctx.fillRect(X(x),Y(y),S(w),S(h));
    if(figure){                                         // someone at the window, swaying
      const bx=x+w*0.5+Math.sin(fr*0.02+ph)*w*0.18;
      ctx.fillStyle='rgba(60,30,40,0.85)'; ctx.beginPath(); ctx.arc(X(bx),Y(y+h*0.45),S(w*0.14),0,Math.PI*2); ctx.fill();
      ctx.fillRect(X(bx-w*0.2),Y(y+h*0.6),S(w*0.4),S(h*0.4));
    }
    rect(x+w/2-1,y,2,h,'#2a1820'); rect(x,y+h*0.45,w,2,'#2a1820');
    glow(x+w/2,y+h/2,Math.max(w,h)*1.4,0.12*fl);
  }
  // the roof-tile house in front of the floor in 1.2 (sketch: pink scales)
  function bgHouse(d){
    if(!inView(d.x-80,d.y-120,d.w+160,d.h+140)) return;
    const x=d.x, y=d.y, F=d.y+d.h;                       // F = the floor it stands on
    const wall='#9a6e58', wallD='#7a5244', wallL='#b8886a', tile='#c4583a', tileHi='#f0a070', tileD='#6e2a1e';
    // chimney with smoke, behind the hump
    chimney(x+380,y-10,y+80);
    // main walls (a little flared on the right, like the sketch's leg)
    poly([[x+44,y+120],[x+436,y+120],[x+436,F-120],[x+470,F],[x+44,F]],wall);
    for(let yy=y+140; yy<F; yy+=22) rect(x+44,yy,392,1.5,wallD);                       // plaster lines
    rect(x+44,F-40,426,40,wallD); rect(x+44,F-42,426,3,wallL);                          // skirting
    // the hump: a tower room on the right with its own roof
    rect(x+270,y+40,166,90,wall); rect(x+270,y+40,4,90,wallD);
    litWindow(x+318,y+58,40,46,1.3,true); litWindow(x+378,y+58,34,46,2.2,false);
    scaleRoof(x+256,y+30,x+452,y+30,2,tile,tileHi,tileD);
    poly([[x+250,y+30],[x+354,y-28],[x+458,y+30]],tileD); scaleRoof(x+262,y+26,x+354,y-24,4,tile,tileHi,tileD); scaleRoof(x+354,y-24,x+446,y+26,0,tile,tileHi,tileD);
    // main roof: a long band of scales with an eave
    scaleRoof(x+18,y+92,x+462,y+92,3,tile,tileHi,tileD);
    rect(x+14,y+124,454,6,tileD);
    // windows (arched tops), a door with the porch stair (the pink hatching)
    for(const [wx,ph,fig] of [[x+150,0.4,false],[x+250,1.9,true],[x+350,3.1,false]]){
      ctx.fillStyle='#2a1820'; ctx.beginPath(); ctx.arc(X(wx+20),Y(y+180),S(23),Math.PI,0); ctx.fill();
      litWindow(wx,y+180,40,58,ph,fig);
      ctx.fillStyle='rgba(255,214,130,0.9)'; ctx.beginPath(); ctx.arc(X(wx+20),Y(y+180),S(18),Math.PI,0); ctx.fill();
      rect(wx-8,y+242,56,6,'#5a3424');                                                   // sill
      for(let k=0;k<4;k++){ const fx=wx-2+k*13, sw2=Math.sin(fr*0.05+k+wx)*1.5;          // flower box
        ctx.fillStyle=k%2?'#e070c0':'#ffcf6a'; ctx.beginPath(); ctx.arc(X(fx+4+sw2),Y(y+238),S(3.5),0,Math.PI*2); ctx.fill(); }
    }
    for(const wx of [x+150,x+250,x+350]) litWindow(wx,F-150,40,52,wx*0.01,false);
    // door on the left, up the porch stair
    const dx=x+64, dy=F-120;
    rect(dx-6,dy-8,54,88,'#5a3424'); rect(dx,dy,42,80,'#7a3a22'); rect(dx+4,dy+4,16,34,'#8a4a2a'); rect(dx+22,dy+4,16,34,'#8a4a2a');
    ctx.fillStyle='#ffcf6a'; ctx.beginPath(); ctx.arc(X(dx+34),Y(dy+46),S(2.5),0,Math.PI*2); ctx.fill();
    hangingLamp(dx+56,dy-12,14);
    for(let k=0;k<5;k++){ const sx2=dx-20-k*18, sy2=dy+80+k*8; rect(sx2,sy2,60,8,k%2?'#8a5a32':'#a8703a'); rect(sx2,sy2+8,60,F-sy2-8,'rgba(60,34,20,0.6)'); }
    for(let k=0;k<6;k++) rect(dx-110+k*20,F-60+ (k<2?0:0),3,60,'rgba(90,56,30,0.7)');  // porch rail
    rect(dx-110,F-62,100,4,'#a8703a');
    // the bunting carries on across the front
    bunting(x+20,y+140,x+460,y+150,26,9,1.7);
  }
  // festa junina flags on a sagging string
  const FLAG=['#e83a3a','#ffd23a','#3ab0e8','#4fc04a','#e070c0','#ff8a3a'];
  function bunting(x0,y0,x1,y1,sag,n,ph){
    const pt=t=>({x:x0+(x1-x0)*t, y:y0+(y1-y0)*t+sag*4*t*(1-t)+Math.sin(fr*0.03+ph)*2*Math.sin(Math.PI*t)});
    ctx.strokeStyle='rgba(40,24,30,0.9)'; ctx.lineWidth=Math.max(1,S(1.5)); ctx.beginPath();
    for(let i=0;i<=20;i++){ const q=pt(i/20); if(i) ctx.lineTo(X(q.x),Y(q.y)); else ctx.moveTo(X(q.x),Y(q.y)); } ctx.stroke();
    for(let i=0;i<n;i++){
      const t=(i+0.5)/n, q=pt(t), q2=pt(t+0.5/n), fl=Math.sin(fr*0.12+i*1.3+ph)*4;
      ctx.fillStyle=FLAG[(i+Math.floor(ph*3))%FLAG.length];
      ctx.beginPath(); ctx.moveTo(X(q.x-7),Y(q.y)); ctx.lineTo(X(q.x+7),Y(q.y)); ctx.lineTo(X(q.x+fl*0.5),Y(q.y+16+Math.abs(fl)*0.3)); ctx.closePath(); ctx.fill();
    }
  }
  // the town behind the spawn ledge and the slope in 1.2 (sketch: pink houses, people, bunting)
  function bgTown(d){
    if(!inView(d.x-100,d.y-120,d.w+200,d.h+140)) return;
    const x=d.x, y=d.y, G=d.y+d.h;                      // G: deep enough that the terrain covers the bases
    const far='#4a2c48', farD='#382038', mid='#5e3a52', midD='#46293e', near='#6e4658', nearD='#523244';
    const roofC='#7a3a3a', roofHi='#b86a5a', roofD='#3a1a22';
    // house 1: tall, gabled (left)
    rect(x+0,y+70,190,G-(y+70),far);
    poly([[x-12,y+74],[x+95,y-10],[x+202,y+74]],roofD); scaleRoof(x-6,y+70,x+95,y-4,5,roofC,roofHi,roofD); scaleRoof(x+95,y-4,x+196,y+70,0,roofC,roofHi,roofD);
    chimney(x+140,y+0,y+60);
    litWindow(x+30,y+110,30,40,0.7,false); litWindow(x+120,y+110,30,40,2.4,true); litWindow(x+30,y+190,30,40,1.1,false); litWindow(x+120,y+190,30,40,3.0,false);
    // house 2: gabled, in front, lower
    rect(x+130,y+230,180,G-(y+230),mid); rect(x+130,y+230,4,G-(y+230),midD);
    poly([[x+118,y+236],[x+220,y+156],[x+322,y+236]],roofD); scaleRoof(x+124,y+232,x+220,y+160,4,roofC,roofHi,roofD); scaleRoof(x+220,y+160,x+316,y+232,0,roofC,roofHi,roofD);
    litWindow(x+160,y+262,34,44,1.7,true); litWindow(x+250,y+262,34,44,0.2,false);
    // house 3: wide, with a door and someone waving in it
    rect(x+290,y+170,210,G-(y+170),near); rect(x+290,y+170,4,G-(y+170),nearD);
    scaleRoof(x+278,y+150,x+512,y+150,2,roofC,roofHi,roofD); rect(x+276,y+172,238,5,roofD);
    litWindow(x+310,y+200,40,48,2.9,false); litWindow(x+440,y+200,40,48,0.9,false);
    const dx=x+372, dy=y+272;                            // the door, open, warm light
    rect(dx-5,dy-5,58,92,roofD); ctx.fillStyle='rgba(255,200,120,0.95)'; ctx.fillRect(X(dx),Y(dy),S(48),S(82));
    const wave=Math.sin(fr*0.15)*0.6;                   // a neighbour waving
    ctx.fillStyle='#3a2030'; ctx.beginPath(); ctx.arc(X(dx+24),Y(dy+24),S(8),0,Math.PI*2); ctx.fill();
    ctx.fillRect(X(dx+15),Y(dy+33),S(18),S(40));
    ctx.strokeStyle='#3a2030'; ctx.lineWidth=S(4); ctx.beginPath(); ctx.moveTo(X(dx+30),Y(dy+38)); ctx.lineTo(X(dx+30+Math.cos(-1.1+wave)*16),Y(dy+38+Math.sin(-1.1+wave)*16)); ctx.stroke();
    glow(dx+24,dy+40,90,0.18);
    // kids playing in front of house 2 (little bouncing figures)
    for(const [kx,ph] of [[x+200,0],[x+240,1.6]]){ const hop=Math.abs(Math.sin(fr*0.09+ph))*10;
      ctx.fillStyle='#3a2030'; ctx.beginPath(); ctx.arc(X(kx),Y(y+330-hop),S(6),0,Math.PI*2); ctx.fill(); ctx.fillRect(X(kx-5),Y(y+336-hop),S(10),S(18)); }
    // a pole by the slope, the bunting strung from the roofs to it
    rect(x+690,y+240,6,G-(y+240),'#3a2418'); rect(x+684,y+236,18,6,'#5a3424');
    bunting(x+500,y+160,x+693,y+246,40,10,0.3);
    bunting(x+316,y+236,x+693,y+290,60,14,1.1);
    bunting(x+190,y+80,x+500,y+160,30,10,2.2);
  }

  // ── 1.2 (Oct 21 sheet): inside the roof-tile house, its porch, and the city building ──
  // the house's back wall, seen behind the stairs: warm plaster, a timber frame,
  // two shuttered windows, a picture, a hanging lamp
  function houseInside(d){
    if(!inView(d.x,d.y,d.w,d.h)) return;
    const x=d.x, y=d.y, w=d.w, h=d.h;
    const g=ctx.createLinearGradient(0,Y(y),0,Y(y+h)); g.addColorStop(0,'#5a3a34'); g.addColorStop(1,'#3a2228');
    ctx.fillStyle=g; ctx.fillRect(X(x),Y(y),S(w)+1,S(h)+1);
    for(let yy=y+18; yy<y+h; yy+=26) rect(x,yy,w,1.5,'rgba(30,14,18,0.35)');            // plaster courses
    for(let xx=x+64; xx<x+w; xx+=128) rect(xx,y,8,h,'#4a2a1c');                            // timber posts
    rect(x,y+150,w,8,'#4a2a1c');                                                          // beam
    for(const [wx,ph] of [[x+90,0.3],[x+330,1.7]]){
      litWindow(wx,y+40,46,60,ph,false);
      rect(wx-16,y+36,12,68,'#2e5a46'); rect(wx+50,y+36,12,68,'#2e5a46');                // shutters
    }
    rect(x+200,y+50,54,40,'#2a1820'); rect(x+204,y+54,46,32,'#c88a5a'); rect(x+214,y+66,26,16,'#7aa0c0');   // a picture
    hangingLamp(x+260,y,90);
    glow(x+260,y+100,140,0.16);
  }
  // the porch at the door: wooden planks and a rail (the sketch's pink hatching)
  function porch(d){
    if(!inView(d.x,d.y,d.w,d.h)) return;
    for(let xx=d.x; xx<d.x+d.w; xx+=12) rect(xx,d.y,10,d.h,(xx/12)%2?'#7a4a2a':'#8a5a32');
    rect(d.x,d.y,d.w,6,'#a8703a'); rect(d.x,d.y+d.h*0.45,d.w,4,'#a8703a');
  }
  // the urban residential building over the street: brick, rows of windows (some
  // lit, a few people), little balconies, a fire escape, AC units, a water tank
  function building(d){
    if(!inView(d.x-60,d.y-120,d.w+120,d.h+140)) return;
    const x=d.x, y=d.y, w=d.w, h=d.h, F=y+h;
    const brick='#5a2e2a', brickD='#45221f', trim='#8a6a5a';
    rect(x,y,w,h,brick);
    for(let yy=y+6; yy<F; yy+=12) rect(x,yy,w,1.2,brickD);                                // mortar courses
    rect(x-6,y-10,w+12,12,trim); rect(x-10,y-16,w+20,6,'#6a4a3e');                       // cornice
    // the rooftop: a water tank on legs and a couple of chimneys
    rect(x+w-150,y-90,70,62,'#4a3a32'); rect(x+w-156,y-96,82,10,'#3a2a24');
    for(const lx of [x+w-148,x+w-92]) rect(lx,y-28,6,28,'#2a1e1a');
    rect(x+60,y-52,22,52,brickD); rect(x+120,y-40,18,40,brickD);
    // windows: 5 floors x 6
    const cols=6, floors=5, gx=(w-60)/cols, gy=(h-150)/floors;
    for(let f=0; f<floors; f++) for(let c=0; c<cols; c++){
      const wx=x+30+c*gx+gx*0.18, wy=y+30+f*gy, ww=gx*0.62, wh=gy*0.6, seed=(f*7+c*13)%10;
      rect(wx-3,wy-3,ww+6,wh+6,trim);
      if(seed<4) litWindow(wx,wy,ww,wh,f+c*0.7,seed===1);
      else { rect(wx,wy,ww,wh,'#1a1622'); rect(wx,wy,ww,wh*0.35,'rgba(120,140,180,0.25)'); rect(wx+ww/2-1,wy,2,wh,'#2a2430'); }
      rect(wx-5,wy+wh+3,ww+10,4,trim);                                                     // sill
      if(seed===6){ rect(wx-8,wy+wh+7,ww+16,5,'#2a2a2e'); for(let k=0;k<5;k++) rect(wx-6+k*(ww+12)/4,wy+wh-10,2,17,'#2a2a2e'); }   // balcony
      if(seed===8) rect(wx+ww+6,wy+wh*0.5,18,14,'#7a7e86');                                 // an AC unit
    }
    // the fire escape down the right side
    const fx=x+w-60;
    for(let f=0; f<floors; f++){ const fy=y+30+f*gy+gy*0.62+8; rect(fx-30,fy,56,4,'#1e1e24'); for(let k=0;k<4;k++) rect(fx-28+k*17,fy-16,2,16,'#1e1e24'); rect(fx-26,fy,3,gy,'rgba(30,30,36,0.9)'); }
    // the ground floor: a shopfront with an awning, the street door is the exit gate
    rect(x+20,F-110,w*0.42,90,'#1e1a24'); litWindow(x+30,F-100,w*0.42-20,60,0.5,true);
    for(let k=0;k<8;k++) rect(x+14+k*(w*0.44)/8,F-126,(w*0.44)/8,18,k%2?'#c84a3a':'#f0e0c8');
    rect(x,F-20,w,20,'#3a2a26');
  }
  // ── World ─────────────────────────────────────────────────────────
  function world(B){
    Z=sw(1000)/1000; textures();
    const lv=B.level, cells=lv.cells, skin=B.skin;
    if(!B.surfRow){                                    // first ground row per column (for fireflies)
      B.surfRow=[]; for(let c=0;c<lv.cols;c++){ let r=0; while(r<lv.rows&&!cells[r][c]) r++; B.surfRow.push(r<lv.rows?r:null); }
    }
    sky();
    const c0=Math.max(0,Math.floor(camX/T)-1), c1=Math.min(lv.cols-1,Math.ceil((camX+W/Z)/T)+1);
    const r0=Math.max(0,Math.floor(camY/T)-1), r1=Math.min(lv.rows-1,Math.ceil((camY+H/Z)/T)+1);
    const sk=(c,r)=>skin?skin[r][c]:0;
    // underground air: stone (basement) or cave
    for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++){
      if(cells[r][c]) continue;
      const s=sk(c,r);
      if(s===4) blit(tex.stone[r%2],c,r); else if(s===5) blit(tex.cave[(c*7+r*3)&3],c,r);
      else if(s>=10&&window.MV_CITY) MV_CITY.air(c,r,s);            // 1.3: inside the towers (beta_city.js)
    }
    for(const rm of B.rooms) if(inView(rm.x,rm.y,rm.w,rm.h)){ if(rm.style==='home') familyHome(rm); else laituHome(rm); }
    for(const d of B.decor){ if(d.kind==='town') bgTown(d); else if(d.kind==='house') bgHouse(d); else if(d.kind==='building') building(d); else if(d.kind==='houseInside') houseInside(d); else if(d.kind==='porch') porch(d); }
    for(const d of B.decor) if(d.kind==='tree') knowlTree(d);
    for(const d of B.decor) if(d.kind==='chimney') chimney(d.x+d.dx, d.y+d.dy, d.y+d.dy+d.len);
    const SOLID=1, ONEWAY=2, SL=4, SR=5;
    for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++){
      const t=cells[r][c]; if(!t) continue;
      const s=sk(c,r), top=r>0&&!cells[r-1][c];
      if(t===ONEWAY){ rect(c*T,r*T,T,10,'#6a3e1e'); rect(c*T,r*T,T,3,P.woodH); continue; }
      if(t===SL||t===SR){
        const x=X(c*T), y=Y(r*T), z=S(T)+1;
        ctx.save(); ctx.beginPath();
        if(t===SR){ ctx.moveTo(x,y+z); ctx.lineTo(x+z,y); ctx.lineTo(x+z,y+z); } else { ctx.moveTo(x,y); ctx.lineTo(x+z,y+z); ctx.lineTo(x,y+z); }
        const sTex=(s>=7&&window.MV_CITY&&MV_CITY.img(c,r,s,false))||(s===6?tex.scales:s===3?tex.wood:s===2?tex.brick[r&1]:tex.dirt[(c*5+r)&7]);
        ctx.closePath(); ctx.clip(); ctx.drawImage(sTex,x,y,z,z); ctx.restore();
        const neon=s===7?'#ffc070':s===8?'#6ef4ff':s===9?'#40ffd0':null;           // 1.3: the towers' slopes get a neon edge, not grass
        ctx.strokeStyle=neon||(s===6?'#6e2a1e':s===3?P.woodH:P.grass); ctx.lineWidth=neon?S(3):S(5); ctx.beginPath();
        if(t===SR){ ctx.moveTo(x,y+z); ctx.lineTo(x+z,y); } else { ctx.moveTo(x,y); ctx.lineTo(x+z,y+z); } ctx.stroke();
        continue;
      }
      if(s>=7&&window.MV_CITY&&MV_CITY.solid(c,r,s,top)) continue;   // 1.3: the towers' facades
      if(s===1){ blit(top?tex.roofTop:tex.roof,c,r); continue; }
      if(s===2){ blit(tex.brick[r&1],c,r); continue; }
      if(s===3){ blit(tex.wood,c,r); continue; }
      if(s===6){ blit(top?tex.scalesTop:tex.scales,c,r); continue; }
      blit(tex.dirt[(c*5+r*3)&7],c,r);
      const depth=r-(B.surfRow[c]||r);
      if(depth>1){ ctx.fillStyle='rgba(20,8,16,'+Math.min(0.45,depth*0.035)+')'; ctx.fillRect(X(c*T),Y(r*T),S(T)+1,S(T)+1); }
      if(top&&sk(c,r-1)===0&&r<=(B.horizonRow+12)){ rect(c*T,r*T,T,6,P.grass); rect(c*T,r*T+5,T,2,P.grassD); flowers(c,r); }
    }
    edges(B,cells,r0,r1,c0,c1);
    if(window.MV_CITY) MV_CITY.over(B);
    for(const d of B.decor){
      if(d.kind==='attic') atticWindow(d.x, d.y+12);
      else if(d.kind==='lamp') lampPost(d.x, d.y);
      else if(d.kind==='sign') sign(d.x, d.y);
      else if(d.kind==='arrival') arrivalArch(d);
    }
    fireflies(B);
    for(const l of B.labels) B.wtext(drawText, l.text, X(l.x), Y(l.y), '#f0d8a8', 1);
    choirTick(B);
  }

  // pass 4 (Oct 22): the blocks get the key art's light — a moonlit rim on open tops, soft
  // shadow under overhangs and down open sides, and vines hanging from ledges outside
  const RIM={'1.1':'rgba(190,255,200,','1.2':'rgba(210,195,255,','1.3':'rgba(150,235,255,'};
  const vh=(c,r)=>{ let h=(c*73856093^r*19349663)>>>0; h=(h^(h>>>13))*1274126177>>>0; return (h>>>8)/16777216; };
  function edges(B,cells,r0,r1,c0,c1){
    const rim=RIM[B.stageId]||RIM['1.1'], z=S(T)+1, sh=Math.max(2,S(10));
    const solid=(c,r)=>{ const t=cells[r]&&cells[r][c]; return t===1; };
    for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++){
      if(!solid(c,r)) continue;
      const x=X(c*T), y=Y(r*T);
      const up=r>0&&!cells[r-1][c], dn=r+1<cells.length&&!cells[r+1][c];
      const lf=c>0&&!cells[r][c-1], rt=c+1<cells[r].length&&!cells[r][c+1];
      if(dn){ const g=ctx.createLinearGradient(0,y+z-sh,0,y+z); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0.42)'); ctx.fillStyle=g; ctx.fillRect(x,y+z-sh,z,sh); }
      if(lf){ ctx.fillStyle=rim+'0.10)'; ctx.fillRect(x,y,Math.max(1,S(3)),z); }
      if(rt){ ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.fillRect(x+z-Math.max(1,S(4)),y,Math.max(1,S(4)),z); }
      if(up){ ctx.fillStyle=rim+'0.22)'; ctx.fillRect(x,y,z,Math.max(1,S(2))); }
      // vines from ledges that face the night air
      if(dn&&B.stageId!=='1.3'&&r<=(B.horizonRow!=null?B.horizonRow:30)+12&&vh(c,r)<0.22){   // (no vines on the 1.3 towers)
        const len=2+Math.floor(vh(c+7,r)*5), vx=x+S(6+vh(c,r+3)*20), sway=Math.sin(fr*0.03+c)*S(1.5);
        for(let k=0;k<len;k++){
          const yy=y+z+k*S(5), xx=vx+Math.sin(k*1.3+c)*S(2)+sway*(k/len);
          ctx.fillStyle=k%2?'#1f5a2a':'#2b7a36'; ctx.fillRect(xx,yy,Math.max(1,S(3)),Math.max(1,S(5)));
          if(k%2===1){ ctx.fillStyle='#3f9a46'; ctx.fillRect(xx+(k%4===1?S(3):-S(4)),yy+S(1),Math.max(1,S(4)),Math.max(1,S(3))); }
        }
        if(vh(c,r+11)<0.35){ ctx.fillStyle=B.stageId==='1.2'?'#b88ae0':'#c86ae0'; ctx.fillRect(vx+sway,y+z+len*S(5),Math.max(1,S(3)),Math.max(1,S(3))); }
      }
    }
  }

  function itemCrateScreen(idx,cx,bottom,noName){
    Z=sw(1000)/1000;
    const ox=typeof _mapEdScreenOx==='function'?_mapEdScreenOx():0;
    itemCrate(idx, (cx-ox)/Z+_rcamX, bottom/Z+_rcamY, false, noName);
  }
  // the texture a solid tile of skin s is drawn with (1.3's secret rooms paint their walls back over themselves)
  function solidTex(c,r,s){ if(s>=7&&window.MV_CITY){ const im=MV_CITY.img(c,r,s,false); if(im) return im; }
    return s===1?tex.roof:s===2?tex.brick[r&1]:s===3?tex.wood:s===6?tex.scales:tex.dirt[(c*5+r*3)&7]; }
  window.MV_BETA_DECOR={P, world, solidTex, itemCrateScreen, itemCrate, isolatorIcon, sky, seed, crystal, itemCrate, glow, teardrop, choirLevel:()=>MV_BETA.choirLevel||0};
})();
