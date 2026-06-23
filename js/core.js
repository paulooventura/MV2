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
const W = 1024, H = 768;
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

const FONT3=(()=>{const raw={A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',K:'101101110101101',L:'100100100100111',M:'101111111101101',N:'110101101101101',O:'010101101101010',P:'110101110100100',Q:'010101101110011',R:'110101110110101',S:'011100010001110',T:'111010010010010',U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',Z:'111001010100111',0:'111101101101111',1:'010110010010111',2:'111001111100111',3:'111001111001111',4:'101101111001001',5:'111100111001111',6:'111100111101111',7:'111001001010010',8:'111101111101111',9:'111101111001111',' ':'000000000000000','.':'000000000000010',',':'000000000010100','!':'010010010000010','?':'110001010000010',':':'000010000010000',';':'000010000010100','-':'000000111000000','+':'000010111010000','/':'001001010100100','\'':'010010000000000','"':'101101000000000','(':'001010010010001',')':'100010010010100','&':'010101010101011','%':'101001010100101','>':'100010001010100','<':'001010100010001','=':'000111000111000','*':'000101010101000','_':'000000000000111','#':'101111101111101'};const f={};for(const k in raw){const bits=raw[k],px=[];for(let i=0;i<15;i++)if(bits[i]==='1')px.push([i%3,(i/3)|0]);f[k]=px;}return f;})();
function drawText(s,x,y,col,scl=1){ s=String(s).toUpperCase(); x|=0;y|=0; ctx.fillStyle=col; for(let i=0;i<s.length;i++){const px=FONT3[s[i]]||FONT3['.'];const gx=x+i*4*scl;for(const[cx2,cy2]of px)ctx.fillRect(gx+cx2*scl,y+cy2*scl,scl,scl);} }
function textW(s,scl=1){ return String(s).length*4*scl-scl; }
function drawTextC(s,cx,y,col,scl=1){ drawText(s,Math.round(cx-textW(s,scl)/2),y,col,scl); }
function drawTextR(s,rx,y,col,scl=1){ drawText(s,Math.round(rx-textW(s,scl)),y,col,scl); }
function wrapBitmapText(text,maxW,scl=1){ const words=String(text).toUpperCase().split(' ');const lines=[];let cur='';for(const w of words){const test=cur?(cur+' '+w):w;if(textW(test,scl)<=maxW)cur=test;else{if(cur)lines.push(cur);cur=w;}}if(cur)lines.push(cur);return lines; }
function wrapBitmapBlocks(blocks,maxW,scl=1){ const out=[];for(const b of blocks)wrapBitmapText(b,maxW,scl).forEach(l=>out.push(l));return out; }
