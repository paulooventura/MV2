// ============================================================
//  beta_sky.js — the stage backdrop in the look of the title / story art
//  (Paulo, Oct 22: "less flat, more rich")
//
//  Painted as pixel art at 1/3 scale into cached strips and blitted with
//  nearest-neighbour, so it reads as chunky pixels like the key art:
//   - a dithered night gradient with thick swirling Van Gogh tendrils made
//     of pixel strokes, stars and four-point sparkles (twinkling), a big moon
//     on stages that have one;
//   - far mountains with a ridge of pines;
//   - a town strip: gabled houses with chimneys and lit windows, utility
//     poles and their sagging wires;
//  each layer with its own parallax. After the world is drawn: a colour
//  grade for the stage and a vignette (the art's dark corners).
//  Themes per stage (1.1 = the title's green night, 1.2 = the violet moon
//  night of "Deep Waters").
// ============================================================
(function(){
  'use strict';
  const PXS=3;                                       // one art pixel = 3 screen pixels
  const THEMES={
    '1.1':{bands:['#04140e','#082318','#0d3222','#14402a','#1d5233','#2a6a3c'], swirl:'#245e3a', swirlHi:'#4c9a5c', star:'#d8ffb8',
           far:'#0b2a1c', farHi:'#14402a', pine:'#071c12', town:'#0d2a1b', roof:'#143a25', win:'#ffd36a', winDim:'#c08a30', pole:'#041009',
           grade:'rgba(40,120,70,0.10)', vig:0.55, moon:null, glow:'rgba(120,230,140,'},
    '1.2':{bands:['#0a0620','#140b34','#1e1048','#2a165c','#3a1e70','#4f2a82'], swirl:'#3e2a86', swirlHi:'#6f58c8', star:'#f2e8ff',
           far:'#1a1040', farHi:'#2a1a5a', pine:'#0e0828', town:'#181040', roof:'#221656', win:'#ffcf6a', winDim:'#b07a2a', pole:'#08051a',
           grade:'rgba(90,60,170,0.12)', vig:0.6, moon:{x:0.62,y:0.18,r:34,col:'#e6d8ff',edge:'#9a86d8'}, glow:'rgba(170,140,255,'},
  };
  THEMES.default=THEMES['1.1'];
  const cache={};
  const hash=(a,b)=>{ let h=(a*374761393+b*668265263)|0; h=(h^(h>>>13))*1274126177|0; return ((h^(h>>>16))>>>0)/4294967295; };
  function mk(w,h,fn){ const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); g.imageSmoothingEnabled=false; fn(g,w,h); return c; }
  const BAYER=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
  function hex(c){ const n=parseInt(c.slice(1),16); return [n>>16&255,n>>8&255,n&255]; }

  // ── the sky strip: gradient bands with ordered dither, swirls, stars ──
  function skyTex(th){
    const w=Math.ceil(1024/PXS)*2, h=Math.ceil(768/PXS);
    return mk(w,h,(g)=>{
      const img=g.createImageData(w,h), d=img.data, B=th.bands.map(hex), n=B.length;
      for(let y=0;y<h;y++){
        const t=y/(h-1)*(n-1), i0=Math.floor(t), f=t-i0;
        for(let x=0;x<w;x++){
          const k=(f*16>BAYER[y&3][x&3])?Math.min(n-1,i0+1):i0, c=B[k], o=(y*w+x)*4;
          d[o]=c[0]; d[o+1]=c[1]; d[o+2]=c[2]; d[o+3]=255;
        }
      }
      g.putImageData(img,0,0);
      // swirls: spirals and long curling tendrils, drawn as pixel strokes (wrapped so the strip tiles)
      const dot=(x,y,col,s)=>{ g.fillStyle=col; for(const dx of [0,-w,w]) g.fillRect(Math.round(x+dx),Math.round(y),s,s); };
      for(let i=0;i<16;i++){
        const cx=hash(i,11)*w, cy=12+hash(i,12)*h*0.62, R=10+hash(i,13)*26, turns=1.4+hash(i,14)*1.4, dir=hash(i,15)<0.5?1:-1;
        const steps=Math.round(turns*R*5);
        for(let k=0;k<steps;k++){
          const t=k/steps, a=dir*t*turns*Math.PI*2, r=R*(1-t*0.85);
          const x=cx+Math.cos(a)*r, y=cy+Math.sin(a)*r*0.8;
          dot(x,y,(k%5===0)?th.swirlHi:th.swirl,k%3===0?2:1);
        }
        // a tendril trailing out of each spiral
        const len=30+hash(i,16)*70, ang0=hash(i,17)*Math.PI*2;
        for(let k=0;k<len;k++){ const t=k/len, x=cx+Math.cos(ang0)*R+k*Math.cos(ang0+Math.sin(t*3)*0.9)*1.1, y=cy+Math.sin(ang0)*R*0.8+k*Math.sin(ang0+Math.sin(t*3)*0.9)*0.6; dot(x,y,k%4?th.swirl:th.swirlHi,1); }
      }
      // little curl strokes everywhere (the brushwork)
      for(let i=0;i<120;i++){ const x=hash(i,21)*w, y=hash(i,22)*h*0.7, a=hash(i,23)*6.28, L=4+hash(i,24)*8; for(let k=0;k<L;k++) dot(x+Math.cos(a+k*0.25)*k*0.9,y+Math.sin(a+k*0.25)*k*0.6,th.swirl,1); }
      // stars
      for(let i=0;i<90;i++){ const x=hash(i,31)*w, y=hash(i,32)*h*0.75; dot(x,y,th.star,1); }
    });
  }
  // ── far mountains + a ridge of pines ──
  function farTex(th){
    const w=Math.ceil(1024/PXS)*3, h=110;
    return mk(w,h,(g)=>{
      const ridge=x=>h*0.38+Math.sin(x*0.011)*18+Math.sin(x*0.027+1.3)*9+Math.sin(x*0.071+0.4)*3;
      for(let x=0;x<w;x++){ const y=Math.round(ridge(x)); g.fillStyle=th.far; g.fillRect(x,y,1,h-y); g.fillStyle=th.farHi; if(Math.sin(x*0.011)>0.3) g.fillRect(x,y,1,2); }
      // a second, nearer ridge
      const r2=x=>h*0.6+Math.sin(x*0.017+2)*10+Math.sin(x*0.05)*4;
      for(let x=0;x<w;x++){ const y=Math.round(r2(x)); g.fillStyle=th.pine; g.fillRect(x,y,1,h-y); }
      // pines along it
      for(let i=0;i<Math.floor(w/5);i++){
        const x=i*5+Math.floor(hash(i,41)*4), base=Math.round(r2(x))+1, ht=8+Math.floor(hash(i,42)*14);
        g.fillStyle=th.pine;
        for(let k=0;k<ht;k++){ const half=Math.floor((k/ht)*4)+((k%3===0)?1:0); g.fillRect(x-half,base-ht+k,half*2+1,1); }
      }
    });
  }
  // ── the town strip: houses, lit windows, chimneys, poles ──
  function townTex(th){
    const w=Math.ceil(1024/PXS)*3, h=90;
    return mk(w,h,(g)=>{
      let x=0, i=0; const poles=[];
      while(x<w){
        const bw=18+Math.floor(hash(i,51)*22), bh=14+Math.floor(hash(i,52)*22), gap=2+Math.floor(hash(i,53)*10), base=h;
        const top=base-bh, roofH=6+Math.floor(hash(i,54)*7);
        g.fillStyle=th.town; g.fillRect(x,top,bw,bh);
        g.fillStyle=th.roof; for(let k=0;k<roofH;k++){ const inset=Math.round((k/roofH)*bw*0.5); g.fillRect(x-1+inset,top-roofH+k,bw+2-inset*2,1); }
        if(hash(i,55)<0.5){ const cxh=x+Math.floor(bw*0.7); g.fillStyle=th.town; g.fillRect(cxh,top-roofH-4,3,roofH); }
        // windows: warm squares, some dark
        for(let wy=top+3;wy<base-4;wy+=7) for(let wx=x+3;wx<x+bw-4;wx+=6){
          const r=hash(wx*7+i,wy*3); if(r<0.62) continue;
          g.fillStyle=r>0.86?th.win:th.winDim; g.fillRect(wx,wy,2,3);
        }
        if(hash(i,56)<0.35) poles.push(x+bw+Math.floor(gap/2));
        x+=bw+gap; i++;
      }
      // utility poles + wires (sagging between them)
      for(let k=0;k<poles.length;k++){
        const px=poles[k], top=h-58; g.fillStyle=th.pole; g.fillRect(px,top,2,58); g.fillRect(px-5,top+3,12,1); g.fillRect(px-4,top+7,10,1);
        const nx=poles[k+1]; if(nx==null) continue;
        for(const off of [3,7]) for(let xx=px;xx<=nx;xx++){ const t=(xx-px)/Math.max(1,nx-px), sag=Math.sin(t*Math.PI)*6; g.fillRect(xx,Math.round(top+off+sag),1,1); }
      }
    });
  }
  function get(id){
    const th=THEMES[id]||THEMES.default;
    if(!cache[id]) cache[id]={th, sky:skyTex(th), far:farTex(th), town:townTex(th)};
    return cache[id];
  }
  function tile(img,offX,y,scale){
    const w=img.width*scale, h=img.height*scale; let x=-(((offX%w)+w)%w);
    for(;x<W;x+=w) ctx.drawImage(img,Math.round(x),Math.round(y),Math.round(w),Math.round(h));
  }
  // drawn in place of the old sky (beta_decor world() calls this first)
  function draw(B,horizonPx){
    const L=get(B.stageId||'default'), th=L.th;
    const cx=typeof camX==='number'?camX:0;
    const horizon=horizonPx;
    ctx.save(); ctx.imageSmoothingEnabled=false;
    // the sky fills the screen; it drifts very slowly and moves a touch with the camera
    const skyY=Math.min(0,Math.max(H-L.sky.height*PXS,horizon-L.sky.height*PXS*0.82));
    ctx.fillStyle=th.bands[0]; ctx.fillRect(0,0,W,H);
    tile(L.sky,cx*0.03+fr*0.06,skyY,PXS);
    if(skyY+L.sky.height*PXS<H){ ctx.fillStyle=th.bands[th.bands.length-1]; ctx.fillRect(0,skyY+L.sky.height*PXS,W,H); }
    // twinkling stars and four-point sparkles on top
    for(let i=0;i<26;i++){
      const x=((hash(i,61)*W*2-cx*0.03-fr*0.06)%W+W)%W, y=skyY+hash(i,62)*L.sky.height*PXS*0.6;
      const tw=Math.max(0,Math.sin(fr*0.04+i*2.3)); if(tw<0.2) continue;
      ctx.fillStyle=th.star; ctx.globalAlpha=tw;
      const s=i%4===0?2:1; ctx.fillRect(x-PXS*s,y,PXS*(2*s+1),PXS); ctx.fillRect(x,y-PXS*s,PXS,PXS*(2*s+1));
    }
    ctx.globalAlpha=1;
    // the moon
    if(th.moon){
      const m=th.moon, mx=W*m.x-cx*0.01, my=skyY+L.sky.height*PXS*m.y, R=m.r*PXS/1.5;
      const g=ctx.createRadialGradient(mx,my,R*0.6,mx,my,R*2.6); g.addColorStop(0,th.glow+'0.35)'); g.addColorStop(1,th.glow+'0)');
      ctx.fillStyle=g; ctx.fillRect(mx-R*2.6,my-R*2.6,R*5.2,R*5.2);
      ctx.fillStyle=m.edge; ctx.beginPath(); ctx.arc(mx,my,R,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=m.col; ctx.beginPath(); ctx.arc(mx-PXS,my-PXS,R-PXS*2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(120,100,180,0.35)'; for(const [ox,oy,rr] of [[-0.3,-0.2,0.18],[0.25,0.1,0.12],[-0.05,0.35,0.1],[0.35,-0.35,0.08]]){ ctx.beginPath(); ctx.arc(mx+ox*R,my+oy*R,rr*R,0,Math.PI*2); ctx.fill(); }
    }
    // horizon glow, then far mountains, then the town
    const hg=ctx.createLinearGradient(0,horizon-140,0,horizon+20); hg.addColorStop(0,th.glow+'0)'); hg.addColorStop(1,th.glow+'0.18)');
    ctx.fillStyle=hg; ctx.fillRect(0,horizon-140,W,160);
    tile(L.far,cx*0.12,horizon-L.far.height*PXS+40,PXS);
    tile(L.town,cx*0.3,horizon-L.town.height*PXS+70,PXS);
    ctx.fillStyle=th.town; ctx.fillRect(0,horizon+70,W,Math.max(0,H-horizon-70));
    ctx.restore();
    return true;
  }
  // after the world: the stage's colour grade and the art's dark vignette
  function post(B){
    const th=(THEMES[B.stageId]||THEMES.default);
    ctx.save();
    ctx.globalCompositeOperation='soft-light'; ctx.fillStyle=th.grade.replace(/[\d.]+\)$/,'0.35)'); ctx.fillRect(0,0,W,H);
    ctx.globalCompositeOperation='source-over';
    const v=ctx.createRadialGradient(W/2,H*0.52,Math.min(W,H)*0.38,W/2,H*0.52,Math.max(W,H)*0.78);
    v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,4,2,'+th.vig+')');
    ctx.fillStyle=v; ctx.fillRect(0,0,W,H);
    ctx.restore();
  }
  window.MV_SKY={draw, post, THEMES};
  // the grade + vignette go over the world and the characters (screen space, after the zoom ends), under the HUD
  const _dmg=window.drawDamageOverlay;
  window.drawDamageOverlay=function(){
    try{ if(window.MV_BETA&&MV_BETA.on) post(MV_BETA); }catch(e){}
    return _dmg?_dmg.apply(this,arguments):undefined;
  };
})();
