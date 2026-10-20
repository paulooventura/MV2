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
  function texWood(){
    return mk(T,T,(g)=>{
      g.fillStyle=P.woodD; g.fillRect(0,0,T,T); g.fillStyle=P.woodH; g.fillRect(0,0,T,5); g.fillStyle=P.wood; g.fillRect(0,5,T,3);
      g.fillStyle=P.plankLine; g.fillRect(T-1,8,1,T-8); g.fillRect(0,19,T,1);
    });
  }
  function textures(){
    if(tex.ok) return;
    tex.dirt=[0,1,2,3,4,5,6,7].map(texDirt); tex.stone=[0,1].map(texStone); tex.cave=[0,1,2,3].map(texCave);
    tex.brick=[0,1].map(texBrick); tex.roof=texRoof(false); tex.roofTop=texRoof(true); tex.wood=texWood(); tex.ok=true;
  }
  function blit(img,c,r){ ctx.drawImage(img, X(c*T), Y(r*T), S(T)+1, S(T)+1); }

  // ── Sky: dusk gradient, slow swirls, stars, drifting clouds, birds, far hills
  function sky(){
    const g=ctx.createLinearGradient(0,Y(0),0,Y(30*T));
    g.addColorStop(0,P.skyTop); g.addColorStop(0.45,P.skyMid); g.addColorStop(0.85,P.skyLow); g.addColorStop(1,P.skyGlow);
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    const horizon=Y((MV_BETA.sky+13)*T);
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
  function bed(x,floor,w,blanket){
    rect(x,floor-20,w,14,P.wood); rect(x,floor-34,8,34,P.woodD); rect(x+w-8,floor-26,8,26,P.woodD);
    rect(x+8,floor-28,w-16,10,blanket); rect(x+10,floor-34,22,8,'#efe2c8');
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
    bed(C(7),loft,150,'#5a6aa8'); bed(C(17),loft,140,'#a85a6a');
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
    drawTextC('AWDJOO',X(x),Y(floor-67),'#c8e8a8',1); drawTextC('POP. ∞',X(x),Y(floor-56),'#c8e8a8',1); }
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
  function crystal(k){
    const bob=Math.sin(fr*0.06+(k.bob||0))*3;
    const x=X(k.x), y=Y(k.y)+bob, s=S(13);
    glow(k.x,k.y+bob/Z,44,0.35+0.1*Math.sin(fr*0.08),'rgba(120,230,255,');
    ctx.fillStyle='#7fe8ff'; ctx.strokeStyle='#103040'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(x, y-s); ctx.lineTo(x+s*0.7, y); ctx.lineTo(x, y+s); ctx.lineTo(x-s*0.7, y); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle='#ffffff'; ctx.beginPath(); ctx.moveTo(x, y-s*0.6); ctx.lineTo(x+s*0.3, y); ctx.stroke();
  }
  // A wooden crate with a paper label showing the jack inside (all male plugs).
  const ITEM_NAMES=['TRS','RCA','XLR','MAG'];
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
    if(typeof drawConnectorTip==='function') drawConnectorTip(idx===3?-14:-16,0,0,0,idx,enh);
    ctx.restore();
    // name under the crate
    if(!noName) drawTextC(ITEM_NAMES[idx]||'?', X(cx), Y(bottom+3), enh?'#7dffcf':'#ffe8b0', 1);
    // a shine sweeps across now and then so it reads as a pickup
    const t=((fr+idx*40)%150)/150;
    if(t<0.25){ ctx.save(); ctx.globalAlpha=0.35*(1-Math.abs(t*8-1)); ctx.fillStyle='#fff';
      ctx.beginPath(); const sxp=x+t*4*(w+20)-10; ctx.moveTo(X(sxp),Y(y)); ctx.lineTo(X(sxp+8),Y(y)); ctx.lineTo(X(sxp-4),Y(y+h)); ctx.lineTo(X(sxp-12),Y(y+h)); ctx.fill(); ctx.restore(); }
    if(enh) glow(cx,y+h/2,40,0.3,'rgba(80,255,150,');
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
    }
    for(const rm of B.rooms) if(inView(rm.x,rm.y,rm.w,rm.h)){ if(rm.style==='home') familyHome(rm); else laituHome(rm); }
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
        ctx.closePath(); ctx.clip(); ctx.drawImage(tex.dirt[(c*5+r)&7],x,y,z,z); ctx.restore();
        ctx.strokeStyle=P.grass; ctx.lineWidth=S(5); ctx.beginPath();
        if(t===SR){ ctx.moveTo(x,y+z); ctx.lineTo(x+z,y); } else { ctx.moveTo(x,y); ctx.lineTo(x+z,y+z); } ctx.stroke();
        continue;
      }
      if(s===1){ blit(top?tex.roofTop:tex.roof,c,r); continue; }
      if(s===2){ blit(tex.brick[r&1],c,r); continue; }
      if(s===3){ blit(tex.wood,c,r); continue; }
      blit(tex.dirt[(c*5+r*3)&7],c,r);
      const depth=r-(B.surfRow[c]||r);
      if(depth>1){ ctx.fillStyle='rgba(20,8,16,'+Math.min(0.45,depth*0.035)+')'; ctx.fillRect(X(c*T),Y(r*T),S(T)+1,S(T)+1); }
      if(top&&r<=(B.sky+21)){ rect(c*T,r*T,T,6,P.grass); rect(c*T,r*T+5,T,2,P.grassD); flowers(c,r); }
    }
    for(const d of B.decor){
      if(d.kind==='attic') atticWindow(d.x, d.y+12);
      else if(d.kind==='lamp') lampPost(d.x, d.y);
      else if(d.kind==='sign') sign(d.x, d.y);
    }
    fireflies(B);
    for(const l of B.labels) drawText(l.text, X(l.x), Y(l.y), '#f0d8a8', 1);
    choirTick(B);
  }

  function itemCrateScreen(idx,cx,bottom,noName){
    Z=sw(1000)/1000;
    const ox=typeof _mapEdScreenOx==='function'?_mapEdScreenOx():0;
    itemCrate(idx, (cx-ox)/Z+_rcamX, bottom/Z+_rcamY, false, noName);
  }
  window.MV_BETA_DECOR={P, world, itemCrateScreen, sky, seed, crystal, itemCrate, glow, teardrop, choirLevel:()=>MV_BETA.choirLevel||0};
})();
