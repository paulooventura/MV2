// ============================================================
//  Mind & Venture — core.js
//  Canvas, palette, sprite engine, bitmap font.
//  Must load before render.js / ui.js drawing code.
// ============================================================

const MV2_VISUAL = true;
const cv = document.getElementById('c');
if (!cv || typeof cv.getContext !== 'function') {
  throw new Error('Canvas #c missing — open index.html from the Mind and Venture folder (double-click PLAY.bat or index.html)');
}
const ctx = cv.getContext('2d');
if (!ctx) throw new Error('Could not create 2d canvas context');
// Phones get a wider picture (same height, more level to the sides) so it fills the screen.
const W = Math.max(1024, Math.min(1856, (window.MV_VIEW_W | 0) || 1024)), H = 768;
if (cv.width !== W) cv.width = W;
const SMS_SCALE = 1;

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r){
    r = Math.min(r, w/2, h/2);
    this.beginPath();
    this.moveTo(x+r,y); this.lineTo(x+w-r,y);
    this.arcTo(x+w,y,x+w,y+r,r); this.lineTo(x+w,y+h-r);
    this.arcTo(x+w,y+h,x+w-r,y+h,r); this.lineTo(x+r,y+h);
    this.arcTo(x,y+h,x,y+h-r,r); this.lineTo(x,y+r);
    this.arcTo(x,y,x+r,y,r); this.closePath();
  };
}
ctx.imageSmoothingEnabled = true;
cv.setAttribute('tabindex','0'); cv.focus();

const C = {
  BLACK:'#0a0814', WHITE:'#eee8ff',
  GREY_D:'#282030', GREY:'#504858', SILVER:'#908898',
  NAVY:'#141028', BLUE:'#204070', BLUE_L:'#4088b0', SKY:'#3888a0', SKY_L:'#68b8d0',
  CYAN:'#40b8b8', CYAN_D:'#207070', STEEL:'#384868',
  GREEN_D:'#143820', GREEN:'#309050', GREEN_L:'#58c070', MINT:'#88e0b0', LIME:'#a8e848',
  RED_D:'#581018', RED:'#a83040', RED_L:'#d85868', PINK:'#e89098', MAROON:'#300810',
  ORANGE:'#c86820', BROWN:'#583020', BROWN_D:'#281408', TAN:'#987048', SAND:'#d8b060',
  PURPLE_D:'#201038', INDIGO:'#382870', PURPLE:'#6840a0', PURPLE_L:'#9870d0', LILAC:'#c8a0e8', VIOLET:'#502878',
  YELLOW:'#d8a828', GOLD:'#a87828', DUSK:'#405878',
  VOID:'#060410', SHADE:'#100818', TEAL:'#28a098', TEAL_L:'#58d0c0', TEAL_D:'#186058',
  GLOW:'#e878f0', GLOW_L:'#f0a8f8',
};
const _ART_RGB_PAL = (()=>{
  const seen=new Set(), p=[];
  const add = hex => {
    if (seen.has(hex)) return; seen.add(hex);
    p.push([parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]);
  };
  Object.values(C).forEach(add);
  ['#122040','#183050','#286878','#4898a8','#78c8d8','#a83898','#c858b0','#38c8b0','#78e8d8','#f8d878'].forEach(add);
  return p;
})();
function _smsNearestRGB(r,g,b){ let best=0,bd=1e9; for(let i=0;i<_ART_RGB_PAL.length;i++){const pr=_ART_RGB_PAL[i][0],pg=_ART_RGB_PAL[i][1],pb=_ART_RGB_PAL[i][2];const d=(r-pr)**2*0.30+(g-pg)**2*0.59+(b-pb)**2*0.11;if(d<bd){bd=d;best=i;}} return _ART_RGB_PAL[best]; }
function _isPalettePixel(r,g,b){ for(const p of _ART_RGB_PAL){if(p[0]===r&&p[1]===g&&p[2]===b)return true;} return false; }
function _smsSnapImageData(id){ const d=id.data; for(let i=0;i<d.length;i+=4){if(d[i+3]<128){d[i+3]=0;continue;} const r=d[i],g=d[i+1],b=d[i+2]; if(_isPalettePixel(r,g,b)){d[i+3]=255;continue;} const s=_smsNearestRGB(r,g,b);d[i]=s[0];d[i+1]=s[1];d[i+2]=s[2];d[i+3]=255;} return id; }
function _offCanvas(w,h){ const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.imageSmoothingEnabled=false;return{c,g}; }
function smsDownscaleNN(img,tw,th){ let w=img.width,h=img.height,cur=img; while(w>tw*2||h>th*2){const nw=Math.max(tw,w>>1),nh=Math.max(th,h>>1);const{c,g}=_offCanvas(nw,nh);g.drawImage(cur,0,0,w,h,0,0,nw,nh);w=nw;h=nh;cur=c;} if(w!==tw||h!==th){const{c,g}=_offCanvas(tw,th);g.drawImage(cur,0,0,w,h,0,0,tw,th);return c;} if(cur===img){const{c,g}=_offCanvas(w,h);g.drawImage(img,0,0);return c;} return cur; }
function smsProcessPixelArt(img,dw,dh){ const tw=dw||img.width,th=dh||img.height; const c=(tw===img.width&&th===img.height)?(()=>{const o=_offCanvas(tw,th);o.g.drawImage(img,0,0);return o.c;})():smsDownscaleNN(img,tw,th); if(!MV2_VISUAL){try{const g=c.getContext('2d');g.putImageData(_smsSnapImageData(g.getImageData(0,0,c.width,c.height)),0,0);}catch(e){}} return c; }
function smsProcessPainted(img,dw,dh){ const c=smsDownscaleNN(img,dw||img.width,dh||img.height); if(!MV2_VISUAL){try{const g=c.getContext('2d');g.putImageData(_smsSnapImageData(g.getImageData(0,0,c.width,c.height)),0,0);}catch(e){}} return c; }
function smsQuantizeImage(img,dw,dh,smooth){ return smooth?smsProcessPainted(img,dw||img.width,dh||img.height):smsProcessPixelArt(img,dw||img.width,dh||img.height); }
function smsHexQ(r,g,b){ const s=_smsNearestRGB(r,g,b); const h=v=>('0'+v.toString(16)).slice(-2); return '#'+h(s[0])+h(s[1])+h(s[2]); }

function mkSpr(rows,pal){ const h=rows.length,w=rows[0].length; const c=document.createElement('canvas');c.width=w;c.height=h; const g=c.getContext('2d');g.imageSmoothingEnabled=false; for(let y=0;y<h;y++){const r=rows[y];for(let x=0;x<w;x++){const ch=r[x];if(ch==='.'||ch===' ')continue;g.fillStyle=pal[ch]||'#ff00ff';g.fillRect(x,y,1,1);}} return c; }
function flipSpr(spr){ const c=document.createElement('canvas');c.width=spr.width;c.height=spr.height; const g=c.getContext('2d');g.imageSmoothingEnabled=false; g.translate(spr.width,0);g.scale(-1,1);g.drawImage(spr,0,0); return c; }
function whiteSpr(spr){ const c=document.createElement('canvas');c.width=spr.width;c.height=spr.height; const g=c.getContext('2d');g.imageSmoothingEnabled=false; g.drawImage(spr,0,0); g.globalCompositeOperation='source-in'; g.fillStyle='#ffffff';g.fillRect(0,0,c.width,c.height); return c; }
function blitImg(src,sx0,sy0,sw0,sh0,dx,dy,dw,dh){ ctx.imageSmoothingEnabled=false; const bleed=dw>1&&dh>1?1:0; ctx.drawImage(src,sx0,sy0,sw0,sh0,dx|0,dy|0,dw+bleed,dh+bleed); }
const _chromaTileCache={}; let _chromaCanvasBlocked=false;
function blitImgChroma(src,sx0,sy0,sw0,sh0,dx,dy,dw,dh,thresh=246){ if(_chromaCanvasBlocked){blitImg(src,sx0,sy0,sw0,sh0,dx,dy,dw,dh);return;} const key=src.src+'|'+sx0+'|'+sy0+'|'+sw0+'|'+sh0+'|'+thresh; let sheet=_chromaTileCache[key]; if(!sheet){try{const c=document.createElement('canvas');c.width=sw0;c.height=sh0;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(src,sx0,sy0,sw0,sh0,0,0,sw0,sh0);const img=g.getImageData(0,0,sw0,sh0);const d=img.data;for(let i=0;i<d.length;i+=4){if(d[i]>=thresh&&d[i+1]>=thresh&&d[i+2]>=thresh)d[i+3]=0;}g.putImageData(img,0,0);sheet=c;_chromaTileCache[key]=sheet;}catch(err){_chromaCanvasBlocked=true;blitImg(src,sx0,sy0,sw0,sh0,dx,dy,dw,dh);return;}} blitImg(sheet,0,0,sw0,sh0,dx,dy,dw,dh); }
function blit(spr,x,y){ ctx.imageSmoothingEnabled=false; ctx.drawImage(spr,x|0,y|0); }
function blitFlip(spr,x,y,flip){ if(!flip){blit(spr,x,y);return;} ctx.imageSmoothingEnabled=false; ctx.save();ctx.translate((x|0)+spr.width,y|0);ctx.scale(-1,1);ctx.drawImage(spr,0,0);ctx.restore(); }
function pxLine(x0,y0,x1,y1,col,th=1){ x0|=0;y0|=0;x1|=0;y1|=0; const dx=Math.abs(x1-x0),dy=Math.abs(y1-y0),sxp=x0<x1?1:-1,syp=y0<y1?1:-1; let err=dx-dy,n=0; ctx.fillStyle=col; while(n++<512){ctx.fillRect(x0,y0,th,th);if(x0===x1&&y0===y1)break;const e2=err*2;if(e2>-dy){err-=dy;x0+=sxp;}if(e2<dx){err+=dx;y0+=syp;}} }
const _ditherPats={};
function _ditherPat(col,ph){ const key=col+'|'+ph; let pat=_ditherPats[key]; if(!pat){const c=document.createElement('canvas');c.width=2;c.height=2;const g=c.getContext('2d');g.fillStyle=col;if(ph){g.fillRect(1,0,1,1);g.fillRect(0,1,1,1);}else{g.fillRect(0,0,1,1);g.fillRect(1,1,1,1);}pat=_ditherPats[key]=ctx.createPattern(c,'repeat');} return pat; }
function ditherRect(x,y,w,h,col,phase=0){ x|=0;y|=0;w|=0;h|=0; if(w<=0||h<=0)return; ctx.fillStyle=_ditherPat(col,phase&1); ctx.fillRect(x,y,w,h); }

// SNES Mode-1 tile font: 8x8 cells, integer scale, 1px drop shadow.
const FONT_CELL=8;
const FONT_SHADOW='#08060c';
const FONT8=(()=>{
  const hex={
    A:'3C66667E66666600',B:'7C66667C66667C00',C:'3C66606060663C00',D:'786C6666666C7800',
    E:'7E60607C60607E00',F:'7E60607C60606000',G:'3C66606E66663E00',H:'6666667E66666600',
    I:'3C18181818183C00',J:'1E0C0C0C0C6C3800',K:'666C7870786C6600',L:'6060606060607E00',
    M:'63777F6B63636300',N:'66767E7E6E666600',O:'3C66666666663C00',P:'7C66667C60606000',
    Q:'3C666666666C3600',R:'7C66667C786C6600',S:'3C66603C06663C00',T:'7E18181818181800',
    U:'6666666666663C00',V:'66666666663C1800',W:'6363636B7F776300',X:'66663C183C666600',
    Y:'6666663C18181800',Z:'7E060C1830607E00',
    0:'3C666E7666663C00',1:'1838181818183C00',2:'3C66060C18307E00',3:'3C66061C06663C00',
    4:'0C1C3C6C7E0C0C00',5:'7E607C0606663C00',6:'3C66607C66663C00',7:'7E060C1830303000',
    8:'3C66663C66663C00',9:'3C66663E06663C00',
    ' ':'0000000000000000','.':'0000000000181800',',':'0000000018181000','!':'1818181800181800',
    '?':'3C66060C18001800',':':'0000181800181800',';':'0000181800181000','-':'0000007E00000000',
    '+':'000018187E181800','/':'0002060C18306000','\\':'006030180C060200','\'':'1818100000000000',
    '"':'6666240000000000','(':'0C18181818180C00',')':'3018181818183000','&':'3C66603C6E663B00',
    '%':'62640C1830264600','>':'30180C060C183000','<':'0C18306030180C00','=':'00007E007E000000',
    '*':'00663CFF3C660000','_':'0000000000007E00','#':'24667E667E662400','^':'183C660000000000',
  };
  const f={};
  for(const k in hex){
    const h=hex[k], px=[];
    for(let y=0;y<8;y++){
      const row=parseInt(h.slice(y*2,y*2+2),16);
      for(let x=0;x<8;x++) if(row&(0x80>>x)) px.push([x,y]);
    }
    f[k]=px;
  }
  return f;
})();
function _fontNorm(s){
  return String(s).toUpperCase()
    .replace(/[—–]/g,'-').replace(/[·•]/g,'*').replace(/×/g,'X')
    .replace(/→/g,'>').replace(/←/g,'<').replace(/↑/g,'^').replace(/↓/g,'V');
}
function textAdv(scl=2){ return FONT_CELL*((scl|0)||1); }
function textH(scl=2){ return FONT_CELL*((scl|0)||1); }

// ── MV2 16-bit type ─────────────────────────────────────────────
// Smooth faces bundled in assets/fonts (SIL OFL): Exo 2 Black Italic for
// big titles (the chrome-logo look of 16-bit title screens) and Nunito
// ExtraBold for menus, HUD and dialogue. Drawn with a vertical colour ramp,
// a dark outline, a soft drop shadow and, on titles, a glow. Same API and
// box as the old 8x8 font (y = top of an 8*scl cell); the bitmap font is
// the fallback until the faces load.
const UI_FACES=[['MV Title','assets/fonts/exo2-900i.woff2',{weight:'900',style:'italic'}],
                ['MV Sans','assets/fonts/nunito-800.woff2',{weight:'800'}],
                ['MV Sans','assets/fonts/nunito-700.woff2',{weight:'700'}]];
let _uiFontReady=false;
(function _loadUiFont(){
  try{
    if(typeof FontFace==='undefined'||!document.fonts) return;
    Promise.all(UI_FACES.map(([fam,url,d])=>new FontFace(fam,'url('+url+') format("woff2")',d).load().then(f=>document.fonts.add(f))))
      .then(()=>{ _uiFontReady=true; _uiTwCache.clear(); }).catch(()=>{});
  }catch(e){}
})();
const _uiTwCache=new Map();
function _uiFontSpec(scl){
  if(scl>=3) return 'italic 900 '+Math.round(10.5*scl)+'px "MV Title", "MV Sans", system-ui, sans-serif';
  return (scl>=2?'800 ':'700 ')+Math.round(scl>=2?10*scl:12)+'px "MV Sans", system-ui, sans-serif';
}
function _uiRGB(col){
  if(typeof col!=='string') return null;
  let m=/^#([0-9a-f]{3})$/i.exec(col); if(m){ const h=m[1]; return [parseInt(h[0]+h[0],16),parseInt(h[1]+h[1],16),parseInt(h[2]+h[2],16)]; }
  m=/^#([0-9a-f]{6})/i.exec(col); if(m) return [parseInt(m[1].slice(0,2),16),parseInt(m[1].slice(2,4),16),parseInt(m[1].slice(4,6),16)];
  m=/^rgba?\(([^)]+)\)/i.exec(col); if(m){ const v=m[1].split(',').map(Number); return [v[0],v[1],v[2]]; }
  return null;
}
function _uiMix(rgb,to,k){ return 'rgb('+rgb.map((v,i)=>Math.round(v+(to[i]-v)*k)).join(',')+')'; }
function textW(s,scl=2){
  scl=(scl|0)||1;
  s=_uiFontReady?String(s).toUpperCase():_fontNorm(s);
  if(!s.length) return 0;
  if(!_uiFontReady) return s.length*textAdv(scl);
  const key=scl+'|'+s; let w=_uiTwCache.get(key);
  if(w==null){ ctx.save(); ctx.font=_uiFontSpec(scl); w=Math.ceil(ctx.measureText(s).width); ctx.restore(); if(_uiTwCache.size>3000) _uiTwCache.clear(); _uiTwCache.set(key,w); }
  return w;
}
function _drawText16(s,x,y,col,scl){
  const rgb=_uiRGB(col);
  const base=y+7*scl;                         // the old font's glyphs sat 7 rows tall in an 8-row cell
  ctx.save();
  ctx.font=_uiFontSpec(scl); ctx.textBaseline='alphabetic'; ctx.textAlign='left';
  const a=ctx.globalAlpha;
  if(scl>=2){
    const dark=rgb?_uiMix(rgb,[6,3,14],0.86):'#06030e';
    ctx.globalAlpha=a*0.55; ctx.fillStyle='#000'; ctx.fillText(s,x+scl*0.9,base+scl*1.1);   // drop shadow
    ctx.globalAlpha=a;
    ctx.lineJoin='round'; ctx.lineWidth=Math.max(2.5,scl*1.35); ctx.strokeStyle=dark; ctx.strokeText(s,x,base);
    let fill=col;
    if(rgb){ const g=ctx.createLinearGradient(0,base-8*scl,0,base+scl); g.addColorStop(0,_uiMix(rgb,[255,255,255],0.62)); g.addColorStop(0.5,_uiMix(rgb,[255,255,255],0.12)); g.addColorStop(1,_uiMix(rgb,[0,0,0],0.28)); fill=g; }
    if(scl>=3&&rgb){ ctx.shadowColor='rgba('+rgb.join(',')+',0.55)'; ctx.shadowBlur=6*scl; }
    ctx.fillStyle=fill; ctx.fillText(s,x,base);
    ctx.shadowBlur=0;
    if(scl>=3){ ctx.globalAlpha=a*0.5; ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.save(); ctx.beginPath(); ctx.rect(x-2,base-7*scl,textW(s,scl)+4,scl*2.2); ctx.clip(); ctx.fillText(s,x,base); ctx.restore(); }   // a chrome glint on the top edge
  }else{
    ctx.globalAlpha=a*0.85; ctx.fillStyle='#05030c'; ctx.fillText(s,x+1,base+1);
    ctx.globalAlpha=a; ctx.fillStyle=col; ctx.fillText(s,x,base);
  }
  ctx.restore();
}

// ── MV2 16-bit UI kit: rounded glass panels, glossy bars, pills ───
function uiRound(x,y,w,h,r){ ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(x,y,w,h,r); else ctx.rect(x,y,w,h); }
function uiPanel(x,y,w,h,opts={}){
  const r=opts.r!=null?opts.r:Math.min(12,h/3), sel=!!opts.sel, dim=!!opts.locked;
  const accent=opts.accent||(sel?'#f0d070':'#8a74d8');
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,0.55)'; ctx.shadowBlur=opts.flat?0:14; ctx.shadowOffsetY=opts.flat?0:4;
  const g=ctx.createLinearGradient(0,y,0,y+h);
  if(dim){ g.addColorStop(0,'rgba(30,22,40,0.94)'); g.addColorStop(1,'rgba(14,10,20,0.94)'); }
  else if(sel){ g.addColorStop(0,'rgba(74,40,140,0.96)'); g.addColorStop(0.55,'rgba(40,18,92,0.96)'); g.addColorStop(1,'rgba(22,10,54,0.96)'); }
  else{ g.addColorStop(0,'rgba(36,24,78,'+(opts.alpha||0.92)+')'); g.addColorStop(1,'rgba(10,6,28,'+(opts.alpha||0.92)+')'); }
  uiRound(x,y,w,h,r); ctx.fillStyle=g; ctx.fill();
  ctx.shadowBlur=0; ctx.shadowOffsetY=0;
  // gold / lilac bevel: bright outer line, darker inner line
  ctx.lineWidth=2; ctx.strokeStyle=dim?'#4a4058':accent; uiRound(x+1,y+1,w-2,h-2,r); ctx.stroke();
  ctx.lineWidth=1; ctx.strokeStyle='rgba(0,0,0,0.55)'; uiRound(x+3.5,y+3.5,w-7,h-7,Math.max(2,r-3)); ctx.stroke();
  // glass sheen on the top third
  const sh=ctx.createLinearGradient(0,y,0,y+h*0.45); sh.addColorStop(0,'rgba(255,255,255,'+(sel?0.18:0.1)+')'); sh.addColorStop(1,'rgba(255,255,255,0)');
  uiRound(x+3,y+3,w-6,h*0.45,Math.max(2,r-3)); ctx.fillStyle=sh; ctx.fill();
  if(sel&&!dim){ const t=(fr%120)/120; const gx=x+t*(w+80)-40; const gl=ctx.createLinearGradient(gx-30,0,gx+30,0);
    gl.addColorStop(0,'rgba(255,248,210,0)'); gl.addColorStop(0.5,'rgba(255,248,210,0.22)'); gl.addColorStop(1,'rgba(255,248,210,0)');
    ctx.save(); uiRound(x+2,y+2,w-4,h-4,r); ctx.clip(); ctx.fillStyle=gl; ctx.fillRect(x,y,w,h); ctx.restore(); }
  ctx.restore();
}
// a glossy capsule meter; segs>0 draws tick marks; colB = colour at the full end
function uiBar(x,y,w,h,frac,colA,colB,segs=0,opts={}){
  frac=Math.max(0,Math.min(1,frac||0));
  ctx.save();
  uiRound(x-1,y-1,w+2,h+2,(h+2)/2); ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fill();
  uiRound(x,y,w,h,h/2); ctx.fillStyle='rgba(30,22,48,0.95)'; ctx.fill();
  if(frac>0){
    const fw=Math.max(h,w*frac);
    const g=ctx.createLinearGradient(x,0,x+w,0); g.addColorStop(0,colA); g.addColorStop(1,colB||colA);
    ctx.save(); uiRound(x,y,w,h,h/2); ctx.clip();
    ctx.fillStyle=g; ctx.fillRect(x,y,fw,h);
    const hl=ctx.createLinearGradient(0,y,0,y+h); hl.addColorStop(0,'rgba(255,255,255,0.55)'); hl.addColorStop(0.45,'rgba(255,255,255,0.08)'); hl.addColorStop(1,'rgba(0,0,0,0.25)');
    ctx.fillStyle=hl; ctx.fillRect(x,y,fw,h);
    if(opts.pulse){ ctx.fillStyle='rgba(255,255,255,'+(0.18*(0.5+0.5*Math.sin(fr*0.25)))+')'; ctx.fillRect(x,y,fw,h); }
    ctx.restore();
  }
  if(segs>1){ ctx.fillStyle='rgba(6,3,14,0.55)'; for(let i=1;i<segs;i++) ctx.fillRect(Math.round(x+w*i/segs),y+1,1,h-2); }
  ctx.lineWidth=1; ctx.strokeStyle='rgba(255,255,255,0.18)'; uiRound(x+0.5,y+0.5,w-1,h-1,h/2); ctx.stroke();
  ctx.restore();
}
function uiPill(x,y,w,h,opts={}){
  ctx.save();
  const on=!!opts.on, col=opts.col||'#8a74d8';
  const g=ctx.createLinearGradient(0,y,0,y+h);
  g.addColorStop(0,on?'rgba(70,44,130,0.95)':'rgba(30,22,52,0.85)'); g.addColorStop(1,on?'rgba(26,12,60,0.95)':'rgba(12,8,26,0.85)');
  uiRound(x,y,w,h,h/2); ctx.fillStyle=g; ctx.fill();
  ctx.lineWidth=on?2:1; ctx.strokeStyle=on?col:'rgba(140,120,200,0.45)'; uiRound(x+0.5,y+0.5,w-1,h-1,h/2); ctx.stroke();
  if(on){ ctx.shadowColor=col; ctx.shadowBlur=10; ctx.strokeStyle=col; ctx.globalAlpha=0.5; uiRound(x+0.5,y+0.5,w-1,h-1,h/2); ctx.stroke(); }
  ctx.restore();
}

// A 16-bit title logo: chrome ramp (sky / white horizon / violet / gold),
// thick dark outline, gold rim, glow and a light sweep every few seconds.
function uiLogo(text,cx,y,px,opts={}){
  ctx.save();
  ctx.font='italic 900 '+px+'px "MV Title", "MV Sans", system-ui, sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  if(ctx.letterSpacing!==undefined) ctx.letterSpacing=(opts.track!=null?opts.track:px*0.02)+'px';
  const base=y+px*0.78, top=base-px*0.74;
  const w=ctx.measureText(text).width;
  // depth: a stacked extrusion down-right
  for(let i=Math.ceil(px*0.09);i>0;i--){ ctx.fillStyle=i===1?'#1a0838':'#0b0420'; ctx.fillText(text,cx+i*0.6,base+i); }
  ctx.lineJoin='round';
  ctx.lineWidth=px*0.16; ctx.strokeStyle='#07020f'; ctx.strokeText(text,cx,base);
  ctx.lineWidth=px*0.075; ctx.strokeStyle=opts.rim||'#f6c94a'; ctx.strokeText(text,cx,base);
  const g=ctx.createLinearGradient(0,top,0,base+px*0.06);
  const pal=opts.pal||['#e8f6ff','#9fd4ff','#ffffff','#7b4fd8','#c58cff','#ffe39a'];
  g.addColorStop(0,pal[0]); g.addColorStop(0.36,pal[1]); g.addColorStop(0.5,pal[2]); g.addColorStop(0.52,pal[3]); g.addColorStop(0.8,pal[4]); g.addColorStop(1,pal[5]);
  ctx.shadowColor=opts.glow||'rgba(160,120,255,0.75)'; ctx.shadowBlur=px*0.35;
  ctx.fillStyle=g; ctx.fillText(text,cx,base);
  ctx.shadowBlur=0;
  // light sweep
  const per=opts.sweep||240, t=((typeof fr!=='undefined'?fr:0)%per)/per;
  if(t<0.35){
    const k=t/0.35, sx0=cx-w/2-px+k*(w+px*2);
    ctx.save(); ctx.globalCompositeOperation='source-atop';
    const sg=ctx.createLinearGradient(sx0-px*0.5,0,sx0+px*0.5,0);
    sg.addColorStop(0,'rgba(255,255,255,0)'); sg.addColorStop(0.5,'rgba(255,255,255,0.85)'); sg.addColorStop(1,'rgba(255,255,255,0)');
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(sx0-px*0.5,top-px*0.2,px,px*1.3); ctx.clip();
    ctx.globalAlpha=0.75*Math.sin(k*Math.PI); ctx.fillStyle=sg; ctx.fillText(text,cx,base); ctx.restore();
  }
  ctx.restore();
  return w;
}
// soft glowing star / sparkle
function uiSparkle(x,y,r,col='#fff',a=1){
  ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=col;
  ctx.beginPath(); ctx.moveTo(x,y-r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.quadraticCurveTo(x,y,x,y+r); ctx.quadraticCurveTo(x,y,x-r,y); ctx.quadraticCurveTo(x,y,x,y-r); ctx.fill();
  const g=ctx.createRadialGradient(x,y,0,x,y,r*0.9); g.addColorStop(0,'rgba(255,255,255,0.8)'); g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r*0.9,0,Math.PI*2); ctx.fill(); ctx.restore();
}
// a little gold cursor that bobs (replaces the '>' glyph)
function uiCursor(x,y,s=10){
  const b=Math.sin((typeof fr!=='undefined'?fr:0)*0.18)*3;
  ctx.save(); ctx.translate(x+b,y);
  ctx.beginPath(); ctx.moveTo(-s*0.6,-s*0.75); ctx.lineTo(s*0.75,0); ctx.lineTo(-s*0.6,s*0.75); ctx.closePath();
  const g=ctx.createLinearGradient(0,-s,0,s); g.addColorStop(0,'#fff6c8'); g.addColorStop(0.5,'#f6c94a'); g.addColorStop(1,'#b07818');
  ctx.shadowColor='rgba(246,201,74,0.8)'; ctx.shadowBlur=8; ctx.fillStyle=g; ctx.fill();
  ctx.shadowBlur=0; ctx.lineWidth=1.5; ctx.strokeStyle='#3a2006'; ctx.stroke(); ctx.restore();
}

function _blitFontGlyph(px,gx,y,scl,col){
  ctx.fillStyle=col;
  for(const[cx2,cy2] of px) ctx.fillRect(gx+cx2*scl,y+cy2*scl,scl,scl);
}
function drawText(s,x,y,col,scl=2){
  if(_uiFontReady){ _drawText16(String(s).toUpperCase(),x,y,col,(scl|0)||1); return; }
  s=_fontNorm(s); x|=0; y|=0; scl=(scl|0)||1;
  const adv=FONT_CELL*scl;
  for(let i=0;i<s.length;i++){
    const px=FONT8[s[i]]||FONT8['.'];
    const gx=x+i*adv;
    if(scl>=2) _blitFontGlyph(px,gx+scl,y+scl,scl,FONT_SHADOW);
    else _blitFontGlyph(px,gx+1,y+1,scl,FONT_SHADOW);
    _blitFontGlyph(px,gx,y,scl,col);
  }
}
function drawTextC(s,cx,y,col,scl=2){ drawText(s,Math.round(cx-textW(s,scl)/2),y,col,scl); }
function drawTextR(s,rx,y,col,scl=2){ drawText(s,Math.round(rx-textW(s,scl)),y,col,scl); }
function wrapBitmapText(text,maxW,scl=2){ const words=_fontNorm(text).split(' ');const lines=[];let cur='';for(const w of words){const test=cur?(cur+' '+w):w;if(textW(test,scl)<=maxW)cur=test;else{if(cur)lines.push(cur);cur=w;}}if(cur)lines.push(cur);return lines; }
function wrapBitmapBlocks(blocks,maxW,scl=2){ const out=[];for(const b of blocks)wrapBitmapText(b,maxW,scl).forEach(l=>out.push(l));return out; }
