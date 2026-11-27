// art-tiles.js — Tilesets tab of the Art Board (Paulo 2026-11-27: "give me an optimal UI to visualize our
// tilesets, and figure out ways to edit, and enhance it"). Everything works on one in-memory copy of the sheet;
// "Use in game" sends it through the Art Board's sprite swap (/api/sprite), so originals are never overwritten.
(function(){
'use strict';
const $=id=>document.getElementById(id);
const SETS=[
  {live:true,path:'assets/tilesets-live/live-tiles.json',name:'THE GAME\'S OWN TILES (what you see in play)',tw:32,th:32,cols:12},
  {path:'assets/tiles/tiles-1-1.png',name:'Stage 1.1 suburb',tw:16,th:16,names:['grass','grass mid','slope L','slope R','','','soil','soil dark','curb','walk','road','dash','fence','hedge','drive','roof','roof teal','cream wall','coral wall','sky wall','window','door','garage','porch','mailbox','planter','sea','trunk','fronds','hibiscus']},
  {path:'assets/home baked sprites/material/MV2 tilesheet.png',name:'Awdjoo tilesheet (Tiled)',tw:8,th:8,cols:12,count:144,gid:'MV2 tilesheet.tsx'},
  {path:'assets/home baked sprites/material/spawn spots.png',name:'Spawn spots (Tiled)',tw:8,th:8,cols:8,count:64,gid:'spawn spots.tsx'},
  {path:'assets/home baked sprites/material/omniblock.png',name:'Omniblock (Tiled)',tw:8,th:8,cols:5,count:5,gid:'omniblock.tsx'},
  {path:'assets/Awdjoo/MV2 tilesheet.png',name:'Awdjoo tilesheet (copy)',tw:8,th:8,cols:12,count:144}
];
const S={set:null,orig:null,ts:null,sel:0,undo:[],zoom:4,tool:'pen',col:'#7b4bd6',room:null,view:'map',ab:false};
let SPR={};

/* ---------- helpers ---------- */
function canvas(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }
function ctx(c){ const x=c.getContext('2d',{willReadFrequently:true}); x.imageSmoothingEnabled=false; return x; }
function cols(){ return S.set.cols||Math.max(1,Math.floor(S.ts.width/S.set.tw)); }
function count(){ return S.set.count||cols()*Math.floor(S.ts.height/S.set.th); }
function tileXY(i){ const c=cols(); return [(i%c)*S.set.tw,Math.floor(i/c)*S.set.th]; }
function push(){ S.undo.push(ctx(S.ts).getImageData(0,0,S.ts.width,S.ts.height)); if(S.undo.length>80)S.undo.shift(); }
function undo(){ if(S.undo.length){ ctx(S.ts).putImageData(S.undo.pop(),0,0); all(); } }
function hex(c){ return [1,3,5].map(i=>parseInt(c.slice(i,i+2),16)); }
function toHex(r,g,b){ return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,v|0)).toString(16).padStart(2,'0')).join(''); }
function msg(t,cls){ const m=$('tsMsg'); m.textContent=t; m.className='msg '+(cls||''); }

/* ---------- load ---------- */
/* the live set: one 32px tile per code-drawn texture, captured from the running game (scripts/capture-live-tiles.mjs) */
let SKINS={};
function pickLive(){
  $('tsRecap').classList.remove('hidden');
  fetch(S.set.path+'?t='+Date.now()).then(r=>r.json()).then(j=>{
    const L=j.tiles||[], tw=32, cl=S.set.cols, rows=Math.ceil(L.length/cl);
    S.live=L; S.set=Object.assign({},S.set,{count:L.length,names:L.map(t=>t.name+(t.skin?'':' (view only)'))});
    S.orig=canvas(cl*tw,rows*tw); S.ts=canvas(cl*tw,rows*tw); let left=L.length;
    const done=()=>{ if(--left) return; S.zoom=Math.max(1,Math.min(4,Math.floor(Math.max(300,$('tsSheet').parentElement.clientWidth-4)/S.ts.width)));
      $('tsZoom').value=S.zoom; $('tsTw').value=tw; $('tsTh').value=tw; S.view='room'; document.querySelector('input[name=tsView][value=room]').checked=true;
      document.querySelector('input[name=tsView][value=map]').disabled=true; S.room=null; all(); palette();
      const n=Object.keys(SKINS).length; msg('Captured from the running game '+(j.at||'').slice(0,16).replace('T',' ')+'. '+(n?n+' tile(s) carry your skin in the game now.':'No skins yet: the game draws these in code.')); };
    L.forEach((t,i)=>{ const x=(i%cl)*tw, y=Math.floor(i/cl)*tw, a=new Image();
      a.onload=()=>{ ctx(S.orig).drawImage(a,x,y); ctx(S.ts).drawImage(a,x,y);
        if(SKINS[t.name]){ const b=new Image(); b.onload=()=>{ const g=ctx(S.ts); g.clearRect(x,y,tw,tw); g.drawImage(b,x,y,tw,tw); done(); }; b.onerror=done; b.src=encodeURI(SKINS[t.name].path)+'?t='+Date.now(); }
        else done(); };
      a.onerror=done; a.src=encodeURI(t.file)+'?t='+Date.now(); });
  }).catch(()=>msg('No captured tiles yet. Press "Recapture from the game".','err'));
}
function useLive(){
  // send every edited tile that the game can skin; tiles put back to the captured look lose their skin
  const send={}, drop=[], keep=[]; let viewOnly=0;
  S.live.forEach((t,i)=>{ const [x,y]=tileXY(i), a=ctx(S.ts).getImageData(x,y,32,32).data, b=ctx(S.orig).getImageData(x,y,32,32).data;
    let same=true; for(let k=0;k<a.length;k++) if(a[k]!==b[k]){ same=false; break; }
    if(!t.skin){ if(!same) viewOnly++; return; }
    if(same){ if(SKINS[t.name]) drop.push(t.name); return; }
    const c=canvas(32,32); ctx(c).drawImage(S.ts,x,y,32,32,0,0,32,32); send[t.name]=c.toDataURL('image/png').split(',')[1]; keep.push(t.name); });
  msg('Saving '+keep.length+' tile(s)…');
  const post=(u,b)=>fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json());
  (drop.length?post('/api/tile-skin-reset',{names:drop}):Promise.resolve({ok:true,skins:SKINS}))
    .then(j=>{ SKINS=j.skins||SKINS; return keep.length?post('/api/tile-skin',{skins:send}):j; })
    .then(j=>{ if(!j.ok) throw new Error(j.error||'not saved'); SKINS=j.skins||SKINS;
      msg((keep.length?keep.length+' tile(s) now drawn with your version in the game: '+keep.slice(0,6).join(', ')+(keep.length>6?'…':'')+'. ':'')+(drop.length?drop.length+' back to the original. ':'')
        +(viewOnly?viewOnly+' tower tile(s) are view-only (the towers build tiles by position): use "Ask" below for those. ':'')+'Reload the game (Ctrl+F5) to see it.','ok'); })
    .catch(e=>msg('Not saved: '+e.message,'err'));
}
function pick(i){
  S.set=SETS[i]; S.sel=0; S.undo=[]; $('tsRecap').classList.toggle('hidden',!S.set.live);
  if(S.set.live) return pickLive();
  const im=new Image(); im.onload=()=>{
    S.orig=canvas(im.naturalWidth,im.naturalHeight); ctx(S.orig).drawImage(im,0,0);
    S.ts=canvas(im.naturalWidth,im.naturalHeight); ctx(S.ts).drawImage(im,0,0);
    const room=Math.max(300,($('tsSheet').parentElement.clientWidth||600)-4);   // fit the sheet to its panel
    S.zoom=Math.max(2,Math.min(12,Math.floor(room/im.naturalWidth)));
    const mapOk=!!S.set.gid; document.querySelector('input[name=tsView][value=map]').disabled=!mapOk;
    if(!mapOk){ S.view='room'; document.querySelector('input[name=tsView][value=room]').checked=true; }
    $('tsZoom').value=S.zoom; $('tsTw').value=S.set.tw; $('tsTh').value=S.set.th;
    S.room=null; all(); palette();
    msg(SPR[S.set.path]?'Showing the swapped version that is in the game now ('+SPR[S.set.path].path.split('/').pop()+').':'Original tileset loaded.');
  };
  const p=SPR[S.set.path]?SPR[S.set.path].path:S.set.path;
  im.src=encodeURI(p)+'?t='+Date.now();
}

/* ---------- the sheet grid ---------- */
function drawSheet(){
  const z=S.zoom, src=S.ab?S.orig:S.ts, c=$('tsSheet'), x=ctx(c), tw=S.set.tw, th=S.set.th, n=count(), cl=cols();
  c.width=src.width*z; c.height=src.height*z; x.drawImage(src,0,0,src.width*z,src.height*z);
  x.strokeStyle='rgba(28,25,23,.35)'; x.lineWidth=1;
  for(let i=0;i<=cl;i++){ x.beginPath(); x.moveTo(i*tw*z+.5,0); x.lineTo(i*tw*z+.5,c.height); x.stroke(); }
  for(let j=0;j*th<=src.height;j++){ x.beginPath(); x.moveTo(0,j*th*z+.5); x.lineTo(c.width,j*th*z+.5); x.stroke(); }
  if($('tsNums').checked&&tw*z>=20){ x.font=Math.max(8,Math.min(11,tw*z/3))+'px monospace'; x.textBaseline='top';
    for(let i=0;i<n;i++){ const [tx,ty]=tileXY(i); x.fillStyle='rgba(0,0,0,.55)'; x.fillRect(tx*z+1,ty*z+1,(String(i).length*6)+3,11); x.fillStyle='#fff'; x.fillText(i,tx*z+2,ty*z+2); } }
  const [sx,sy]=tileXY(S.sel); x.strokeStyle='#c9962f'; x.lineWidth=3; x.strokeRect(sx*z+1.5,sy*z+1.5,tw*z-3,th*z-3);
  const nm=(S.set.names||[])[S.sel]; $('tsSelInfo').textContent='Tile #'+S.sel+(nm?' · '+nm:'')+' · '+tw+'×'+th+' px';
}
function sheetClick(e){
  const r=e.target.getBoundingClientRect(), z=S.zoom, px=(e.clientX-r.left)/z, py=(e.clientY-r.top)/z;
  const i=Math.floor(py/S.set.th)*cols()+Math.floor(px/S.set.tw); if(i>=0&&i<count()){ S.sel=i; drawSheet(); drawTile(); drawSeams(); }
}

/* ---------- single tile editor + seam check ---------- */
function drawTile(){
  const c=$('tsTile'), tw=S.set.tw, th=S.set.th, z=Math.max(8,Math.floor(256/Math.max(tw,th))), x=ctx(c), [sx,sy]=tileXY(S.sel);
  c.width=tw*z; c.height=th*z; c._z=z; x.clearRect(0,0,c.width,c.height); x.drawImage(S.ts,sx,sy,tw,th,0,0,tw*z,th*z);
  x.strokeStyle='rgba(28,25,23,.18)'; for(let i=1;i<tw;i++){x.beginPath();x.moveTo(i*z+.5,0);x.lineTo(i*z+.5,c.height);x.stroke();}
  for(let j=1;j<th;j++){x.beginPath();x.moveTo(0,j*z+.5);x.lineTo(c.width,j*z+.5);x.stroke();}
}
function drawSeams(){
  const c=$('tsSeam'), tw=S.set.tw, th=S.set.th, z=Math.max(3,Math.floor(132/Math.max(tw,th))), x=ctx(c), [sx,sy]=tileXY(S.sel);
  c.width=tw*3*z; c.height=th*3*z; x.clearRect(0,0,c.width,c.height);
  for(let j=0;j<3;j++)for(let i=0;i<3;i++) x.drawImage(S.ts,sx,sy,tw,th,i*tw*z,j*th*z,tw*z,th*z);
  // seam score: how different the touching edges are (0 = seamless)
  const d=ctx(S.ts).getImageData(sx,sy,tw,th).data, px=(a,b)=>((b*tw+a)*4);
  let h=0,v=0; for(let j=0;j<th;j++){ const a=px(0,j),b=px(tw-1,j); h+=Math.abs(d[a]-d[b])+Math.abs(d[a+1]-d[b+1])+Math.abs(d[a+2]-d[b+2]); }
  for(let i=0;i<tw;i++){ const a=px(i,0),b=px(i,th-1); v+=Math.abs(d[a]-d[b])+Math.abs(d[a+1]-d[b+1])+Math.abs(d[a+2]-d[b+2]); }
  const sc=v=>Math.round(100-Math.min(100,v/(3*255*Math.max(tw,th))*100*2.2));
  $('tsSeamInfo').textContent='Repeat check: side-to-side '+sc(h)+'% · top-to-bottom '+sc(v)+'% match (100% = no visible seam)';
}
function tilePaint(e,first){
  const c=$('tsTile'), r=c.getBoundingClientRect(), z=c._z, px=Math.floor((e.clientX-r.left)/z), py=Math.floor((e.clientY-r.top)/z);
  if(px<0||py<0||px>=S.set.tw||py>=S.set.th) return; const [sx,sy]=tileXY(S.sel), X=sx+px, Y=sy+py, x=ctx(S.ts);
  if(first&&S.tool!=='pick') push();
  if(S.tool==='pick'){ const d=x.getImageData(X,Y,1,1).data; S.col=toHex(d[0],d[1],d[2]); $('tsCol').value=S.col; return; }
  if(S.tool==='erase') x.clearRect(X,Y,1,1);
  else if(S.tool==='pen'){ x.fillStyle=S.col; x.fillRect(X,Y,1,1); }
  else if(S.tool==='fill') flood(X,Y,sx,sy);
  all(true);
}
function flood(X,Y,sx,sy){
  const tw=S.set.tw, th=S.set.th, x=ctx(S.ts), im=x.getImageData(sx,sy,tw,th), d=im.data, [r,g,b]=hex(S.col), i0=((Y-sy)*tw+(X-sx))*4, t=[d[i0],d[i0+1],d[i0+2],d[i0+3]];
  if(t[0]===r&&t[1]===g&&t[2]===b&&t[3]===255) return; const st=[[X-sx,Y-sy]];
  while(st.length){ const [a,c]=st.pop(); if(a<0||c<0||a>=tw||c>=th) continue; const i=(c*tw+a)*4;
    if(d[i]!==t[0]||d[i+1]!==t[1]||d[i+2]!==t[2]||d[i+3]!==t[3]) continue; d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=255; st.push([a+1,c],[a-1,c],[a,c+1],[a,c-1]); }
  x.putImageData(im,sx,sy);
}
function tileOp(op){
  const tw=S.set.tw, th=S.set.th, [sx,sy]=tileXY(S.sel), x=ctx(S.ts), t=canvas(tw,th), tx=ctx(t); tx.drawImage(S.ts,sx,sy,tw,th,0,0,tw,th); push();
  x.clearRect(sx,sy,tw,th); x.save(); x.translate(sx+tw/2,sy+th/2);
  if(op==='flipH') x.scale(-1,1); if(op==='flipV') x.scale(1,-1); if(op==='rot'&&tw===th) x.rotate(Math.PI/2);
  x.drawImage(t,-tw/2,-th/2); x.restore();
  if(op==='orig'){ x.clearRect(sx,sy,tw,th); x.drawImage(S.orig,sx,sy,tw,th,sx,sy,tw,th); }
  all();
}

/* ---------- palette: click a colour, pick a new one, every pixel of it changes ---------- */
function palette(){
  const d=ctx(S.ts).getImageData(0,0,S.ts.width,S.ts.height).data, n={};
  for(let i=0;i<d.length;i+=4){ if(d[i+3]<128) continue; const k=toHex(d[i],d[i+1],d[i+2]); n[k]=(n[k]||0)+1; }
  const top=Object.keys(n).sort((a,b)=>n[b]-n[a]).slice(0,64);
  $('tsPal').innerHTML=top.map(c=>'<i style="background:'+c+'" data-c="'+c+'" title="'+c+' · '+n[c]+' px. Click to paint with it; Shift+click to swap it everywhere"></i>').join('');
  $('tsPalInfo').textContent=Object.keys(n).length+' colours in this sheet';
}
function remap(from,to){
  const [a,b,c]=hex(from), [r,g,bl]=hex(to), x=ctx(S.ts), im=x.getImageData(0,0,S.ts.width,S.ts.height), d=im.data; push();
  for(let i=0;i<d.length;i+=4) if(d[i+3]>=128&&d[i]===a&&d[i+1]===b&&d[i+2]===c){ d[i]=r; d[i+1]=g; d[i+2]=bl; }
  x.putImageData(im,0,0); all(); palette();
}

/* ---------- whole-sheet enhance ---------- */
function rgb2hsl(r,g,b){ r/=255;g/=255;b/=255; const M=Math.max(r,g,b),m=Math.min(r,g,b),l=(M+m)/2; let h=0,s=0;
  if(M!==m){ const d=M-m; s=l>.5?d/(2-M-m):d/(M+m); h=M===r?(g-b)/d+(g<b?6:0):M===g?(b-r)/d+2:(r-g)/d+4; h/=6; } return [h,s,l]; }
function hsl2rgb(h,s,l){ if(!s) return [l*255,l*255,l*255]; const f=(p,q,t)=>{ if(t<0)t+=1; if(t>1)t-=1; return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p; };
  const q=l<.5?l*(1+s):l+s-l*s, p=2*l-q; return [f(p,q,h+1/3)*255,f(p,q,h)*255,f(p,q,h-1/3)*255]; }
function eachPixel(fn){ const x=ctx(S.ts), im=x.getImageData(0,0,S.ts.width,S.ts.height), d=im.data; push();
  for(let i=0;i<d.length;i+=4){ if(d[i+3]===0) continue; const o=fn(d[i],d[i+1],d[i+2],(i/4)%S.ts.width,Math.floor(i/4/S.ts.width)); if(o){ d[i]=o[0];d[i+1]=o[1];d[i+2]=o[2]; } }
  x.putImageData(im,0,0); }
const FX={
  color(){ const hs=+$('fxHue').value/360, sa=+$('fxSat').value/100, li=+$('fxLight').value/100, co=+$('fxCon').value/100;
    eachPixel((r,g,b)=>{ let [h,s,l]=rgb2hsl(r,g,b); h=(h+hs+1)%1; s=Math.max(0,Math.min(1,s*sa)); l=Math.max(0,Math.min(1,(l-.5)*co+.5+li-1)); return hsl2rgb(h,s,l); }); },
  posterize(){ const n=Math.max(2,+$('fxLevels').value), q=v=>Math.round(Math.round(v/255*(n-1))/(n-1)*255); eachPixel((r,g,b)=>[q(r),q(g),q(b)]); },
  outline(){ // 1-px dark rim where a tile's art meets transparency, kept inside each tile
    const w=S.ts.width,h=S.ts.height,x=ctx(S.ts),im=x.getImageData(0,0,w,h),d=im.data,src=new Uint8ClampedArray(d),[r,g,b]=hex($('fxOutCol').value),tw=S.set.tw,th=S.set.th; push();
    const a=(X,Y)=>src[(Y*w+X)*4+3];
    for(let Y=0;Y<h;Y++)for(let X=0;X<w;X++){ if(a(X,Y)>0) continue; const tx=X%tw,ty=Y%th;
      if((tx>0&&a(X-1,Y)>0)||(tx<tw-1&&X+1<w&&a(X+1,Y)>0)||(ty>0&&a(X,Y-1)>0)||(ty<th-1&&Y+1<h&&a(X,Y+1)>0)){ const i=(Y*w+X)*4; d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=255; } }
    x.putImageData(im,0,0); },
  bevel(){ // light from the top-left: highlight the top/left edge of each tile's art, shade the bottom/right
    const tw=S.set.tw,th=S.set.th,k=+$('fxBevel').value/100,w=S.ts.width,src=ctx(S.ts).getImageData(0,0,w,S.ts.height).data,a=(X,Y)=>X<0||Y<0||X>=w||Y>=S.ts.height?0:src[(Y*w+X)*4+3];
    eachPixel((r,g,b,X,Y)=>{ const tx=X%tw,ty=Y%th, top=ty===0||a(X,Y-1)===0, left=tx===0||a(X-1,Y)===0, bot=ty===th-1||a(X,Y+1)===0, right=tx===tw-1||a(X+1,Y)===0;
      const m=(top||left)?1+k:(bot||right)?1-k*0.8:1; return m===1?null:[r*m+(m>1?18*k:0),g*m+(m>1?18*k:0),b*m+(m>1?18*k:0)]; }); },
  texture(){ // tiny ordered dither so flat fills get some grain; same pattern every run (no random)
    const k=+$('fxGrain').value, B=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
    eachPixel((r,g,b,X,Y)=>{ const v=(B[Y%4][X%4]/15-.5)*k; return [r+v,g+v,b+v]; }); }
};
function epx2(src){ // Scale2x/EPX: doubles pixel art without blur and smooths diagonal stair-steps
  const w=src.width,h=src.height,s=ctx(src).getImageData(0,0,w,h).data,o=canvas(w*2,h*2),ox=ctx(o),im=ox.createImageData(w*2,h*2),d=im.data;
  const P=(x,y)=>{ x=Math.max(0,Math.min(w-1,x)); y=Math.max(0,Math.min(h-1,y)); const i=(y*w+x)*4; return s[i]+','+s[i+1]+','+s[i+2]+','+s[i+3]; };
  const put=(x,y,c)=>{ const v=c.split(','),i=(y*w*2+x)*4; d[i]=+v[0];d[i+1]=+v[1];d[i+2]=+v[2];d[i+3]=+v[3]; };
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){ const p=P(x,y),A=P(x,y-1),B=P(x+1,y),C=P(x-1,y),D=P(x,y+1);
    put(2*x,2*y,(C===A&&C!==D&&A!==B)?A:p); put(2*x+1,2*y,(A===B&&A!==C&&B!==D)?B:p);
    put(2*x,2*y+1,(D===C&&D!==B&&C!==A)?C:p); put(2*x+1,2*y+1,(B===D&&B!==A&&D!==C)?D:p); }
  ox.putImageData(im,0,0); return o;
}

/* ---------- in context: the real Awdjoo map, or a test room you paint ---------- */
function drawContext(){
  const c=$('tsCtx'), x=ctx(c);
  if(S.view==='map'&&S.set.gid&&window.MV_STAGE0_MAP){
    const M=window.MV_STAGE0_MAP, tw=M.tilewidth, th=M.tileheight, z=+$('tsCtxZoom').value, fg=(M.tilesets.find(t=>t.source===S.set.gid)||{}).firstgid;
    c.width=M.width*tw*z; c.height=M.height*th*z; x.fillStyle='#1f2540'; x.fillRect(0,0,c.width,c.height);
    const sheets=[{src:'MV2 tilesheet.tsx',cols:12},{src:'spawn spots.tsx',cols:8},{src:'omniblock.tsx',cols:5}];
    M.layers.filter(l=>l.type==='tilelayer'&&l.visible!==false).forEach(l=>l.data.forEach((g,k)=>{ if(!g) return; g&=0x1fffffff;
      const ts=[...M.tilesets].sort((a,b)=>b.firstgid-a.firstgid).find(t=>g>=t.firstgid); if(!ts) return;
      if(ts.source!==S.set.gid){ return; } const i=g-ts.firstgid, cl=cols(), sx=(i%cl)*tw, sy=Math.floor(i/cl)*th;
      x.drawImage(S.ts,sx,sy,tw,th,(k%M.width)*tw*z,Math.floor(k/M.width)*th*z,tw*z,th*z); }));
    $('tsCtxInfo').textContent='The real Awdjoo stage ('+M.width+'×'+M.height+' tiles), drawn with this sheet as you edit it. Only tiles from this sheet are drawn.'+(fg?'':' (This sheet is not used by the map.)');
    return;
  }
  // test room: paint with the selected tile; right-click erases
  const W=24,H=12,tw=S.set.tw,th=S.set.th,z=Math.max(2,Math.floor(36/Math.max(tw,th)));
  if(!S.room||S.room.w!==W){ S.room={w:W,h:H,cells:new Array(W*H).fill(-1)}; for(let i=0;i<W;i++){ S.room.cells[(H-2)*W+i]=0; S.room.cells[(H-1)*W+i]=Math.min(count()-1,S.set.names?6:12); } }
  c.width=W*tw*z; c.height=H*th*z; x.fillStyle='#9cc7e6'; x.fillRect(0,0,c.width,c.height);
  S.room.cells.forEach((t,k)=>{ if(t<0) return; const [sx,sy]=tileXY(t); x.drawImage(S.ts,sx,sy,tw,th,(k%W)*tw*z,Math.floor(k/W)*th*z,tw*z,th*z); });
  x.strokeStyle='rgba(255,255,255,.18)'; for(let i=1;i<W;i++){x.beginPath();x.moveTo(i*tw*z+.5,0);x.lineTo(i*tw*z+.5,c.height);x.stroke();}
  c._z=z; $('tsCtxInfo').textContent='Test room: click or drag to place tile #'+S.sel+', right-click to erase. Builds how tiles sit next to each other.';
}
function roomPaint(e){
  if(S.view==='map'&&S.set.gid) return; const c=$('tsCtx'), r=c.getBoundingClientRect(), z=c._z, k=Math.floor((e.clientY-r.top)/(S.set.th*z))*S.room.w+Math.floor((e.clientX-r.left)/(S.set.tw*z));
  if(k<0||k>=S.room.cells.length) return; S.room.cells[k]=(e.buttons===2||e.button===2)?-1:S.sel; drawContext();
}

function all(light){ drawSheet(); drawTile(); drawSeams(); if(!light||$('tsLive').checked) drawContext(); }

/* ---------- save ---------- */
function useInGame(){
  if(S.set.live) return useLive();
  msg('Saving…');
  fetch('/api/sprite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:S.set.path,how:'tileset',data:S.ts.toDataURL('image/png').split(',')[1]})})
    .then(r=>r.json()).then(j=>{ if(!j.ok) throw new Error(j.error||'not saved'); SPR[S.set.path]={path:j.replacement};
      msg('In the game now (reload it with Ctrl+F5). The original file is untouched; "Put original back" undoes it.','ok'); })
    .catch(e=>msg('Not saved: '+e.message,'err'));
}
function resetGame(){
  if(S.set.live) return fetch('/api/tile-skin-reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({all:true})})
    .then(r=>r.json()).then(j=>{ if(j.ok){ SKINS={}; pick(0); msg('Every level tile is back to the original drawing.','ok'); } });
  fetch('/api/sprite-reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:S.set.path})})
    .then(r=>r.json()).then(j=>{ if(j.ok){ delete SPR[S.set.path]; pick(SETS.indexOf(S.set)); msg('Original is back in the game.','ok'); } });
}
function saveFile(c,name){ c.toBlob(b=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=name; a.click(); }); }

/* ---------- wire up ---------- */
function init(){
  $('tsSets').innerHTML=SETS.map((s,i)=>'<option value="'+i+'">'+s.name+' · '+s.path.split('/').pop()+'</option>').join('');
  $('tsSets').onchange=()=>pick(+$('tsSets').value);
  $('tsZoom').oninput=()=>{ S.zoom=+$('tsZoom').value; drawSheet(); };
  $('tsTw').onchange=$('tsTh').onchange=()=>{ S.set=Object.assign({},S.set,{tw:+$('tsTw').value,th:+$('tsTh').value,cols:0,count:0}); S.sel=0; S.room=null; all(); };
  $('tsNums').onchange=drawSheet; $('tsAB').onclick=()=>{ S.ab=!S.ab; $('tsAB').textContent=S.ab?'Showing ORIGINAL · click for yours':'Compare with original'; drawSheet(); };
  $('tsSheet').onclick=sheetClick;
  let down=false; const t=$('tsTile');
  t.onpointerdown=e=>{ down=true; t.setPointerCapture(e.pointerId); tilePaint(e,true); }; t.onpointermove=e=>{ if(down) tilePaint(e,false); }; t.onpointerup=()=>{ down=false; drawContext(); palette(); };
  document.querySelectorAll('input[name=tsTool]').forEach(r=>r.onchange=()=>S.tool=r.value);
  $('tsCol').oninput=()=>S.col=$('tsCol').value;
  $('tsPal').onclick=e=>{ const i=e.target.closest('i'); if(!i) return;
    if(e.shiftKey){ const to=prompt('Swap '+i.dataset.c+' for which colour? (#rrggbb)',S.col)||S.col; /* prompt is blocked in some viewers: fall back to the pen colour */ remap(i.dataset.c,/^#[0-9a-f]{6}$/i.test(to)?to:S.col); msg('Swapped '+i.dataset.c+' everywhere.','ok'); }
    else { S.col=i.dataset.c; $('tsCol').value=S.col; } };
  ['flipH','flipV','rot','orig'].forEach(op=>$('tsOp_'+op).onclick=()=>tileOp(op));
  $('tsUndo').onclick=undo; document.addEventListener('keydown',e=>{ if(!$('v-tiles').classList.contains('hidden')&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){ e.preventDefault(); undo(); } });
  Object.keys(FX).forEach(k=>$('fx_'+k).onclick=()=>{ FX[k](); all(); palette(); msg('Applied: '+$('fx_'+k).textContent+'. Undo (Ctrl+Z) or Compare with original to check it.'); });
  $('fx_epx').onclick=()=>{ const o=epx2(S.ts); saveFile(o,S.set.path.split('/').pop().replace(/\.png$/i,'')+'@2x.png'); msg('Saved a 2× version (sharp Scale2x). The game uses the original size, so this is for higher-res art or a reference.','ok'); };
  $('tsUse').onclick=useInGame; $('tsReset').onclick=resetGame; $('tsSave').onclick=()=>saveFile(S.ts,S.set.path.split('/').pop());
  $('tsReload').onclick=()=>pick(SETS.indexOf(S.set));
  document.querySelectorAll('input[name=tsView]').forEach(r=>r.onchange=()=>{ S.view=r.value; drawContext(); });
  $('tsCtxZoom').oninput=drawContext; $('tsLive').onchange=drawContext;
  const cx=$('tsCtx'); cx.oncontextmenu=e=>e.preventDefault(); cx.onpointerdown=e=>{ cx._d=true; roomPaint(e); }; cx.onpointermove=e=>{ if(cx._d) roomPaint(e); }; cx.onpointerup=()=>cx._d=false;
  if(window.BoardNotes&&BoardNotes.box) $('tsAsk').appendChild(BoardNotes.box('art:tilesets'));
  $('tsRecap').onclick=()=>{ msg('Opening the game in a hidden, muted browser to capture its tiles (about 20 s)…');
    fetch('/api/capture-tiles',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.json())
      .then(j=>{ if(!j.ok) throw new Error((j.error||j.log||'').slice(-200)); pick(0); }).catch(e=>msg('Capture failed: '+e.message,'err')); };
  (location.protocol==='http:'?fetch('/api/art-index',{cache:'no-store'}).then(r=>r.json()).then(j=>{ SPR=j.sprites||{}; SKINS=j.skins||{}; }).catch(()=>{}):Promise.resolve()).then(()=>pick(0));
}
window.MV_ArtTiles={init};
})();
