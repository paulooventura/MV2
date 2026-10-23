// ============================================================
//  beta_city.js — Awdjoo Town 1.3 as a skyscraper site (Paulo, Oct 22:
//  "imagine 1.3 being a skyscraper site… 3 buildings that raise to the sky:
//  the one on the left is residential, the one in the middle commercial, the
//  one on the right high tech; the save-state area is hidden inside it,
//  through a secret entrance on the bottom right; the moving platforms on the
//  left resemble elevators, in a residential area")
//
//  Skins (from scripts/build-awdjoo-1-3.py):
//    solid  7 residential facade · 8 commercial glass · 9 high-tech panels
//    air   10 the apartments' halls (+ elevator shafts) · 11 offices · 12 the vault
//  Tiles are painted once into small cached canvases (a few variants each, picked
//  by position so the facades line up into floors and bays) and blitted.
//  Also: elevator cabs for the vertical platforms in the residential tower, a
//  construction-hoist cage for the ones outside, the lobby, and the vault's
//  cover — the high-tech wall stays painted over the vault until MIND finds the
//  door (or is inside).
// ============================================================
(function(){
  'use strict';
  const T=32, PX=32;
  const cache={};
  function mk(key,fn){ if(cache[key]) return cache[key]; const c=document.createElement('canvas'); c.width=PX; c.height=PX; const g=c.getContext('2d'); g.imageSmoothingEnabled=false; fn(g); return cache[key]=c; }
  const R=(g,x,y,w,h,col)=>{ g.fillStyle=col; g.fillRect(x,y,w,h); };
  const hsh=(a,b)=>{ let h=(a*374761393+b*668265263)|0; h=(h^(h>>>13))*1274126177|0; return ((h^(h>>>16))>>>0)/4294967295; };

  // ── solid facades ──
  // residential: warm stucco + brick bands; a window every 3 columns on every 3rd row, a balcony rail under it
  function resi(c,r,top){
    const bx=((c%3)+3)%3, fy=((r%3)+3)%3, lit=hsh(c/3|0,r/3|0)>0.45;
    return mk('resi'+bx+fy+(lit?1:0)+(top?1:0),g=>{
      R(g,0,0,32,32,'#b07a5e'); for(let y=0;y<32;y+=8) R(g,0,y,32,1,'rgba(90,50,40,0.25)');
      if(fy===2) R(g,0,26,32,6,'#8a5644');                                            // the floor band
      if(fy===1&&bx===1){ R(g,3,3,26,23,'#3a2a2a'); R(g,5,5,22,19,lit?'#ffcf7a':'#3a4660'); if(lit) R(g,5,5,22,6,'#ffe2a8'); R(g,15,5,2,19,'#3a2a2a'); R(g,2,26,28,3,'#e0d0c0'); }   // window + sill
      if(fy===2&&bx===1){ R(g,0,20,32,2,'#2a2228'); for(let k=1;k<32;k+=5) R(g,k,20,1,8,'#2a2228'); }   // balcony rail
      if(top){ R(g,0,0,32,6,'#d8b8a0'); R(g,0,6,32,2,'#7a4a3a'); }                    // the parapet
    });
  }
  // commercial: a blue glass curtain wall, mullions on the tile edges, the sky in it, some offices lit
  function comm(c,r,top){
    const lit=hsh(c,r)>0.8, band=((r%4)+4)%4===3;
    return mk('comm'+(lit?1:0)+(band?1:0)+(top?1:0)+(c&1),g=>{
      const gr=g.createLinearGradient(0,0,32,32); gr.addColorStop(0,'#3a6890'); gr.addColorStop(0.5,'#5a8ab0'); gr.addColorStop(1,'#2a4a6a');
      g.fillStyle=gr; g.fillRect(0,0,32,32);
      if(lit){ R(g,2,2,28,28,'rgba(255,230,160,0.55)'); R(g,4,20,12,6,'rgba(40,40,60,0.5)'); }
      R(g,0,0,32,2,'#1a2838'); R(g,0,0,2,32,'#1a2838');                               // mullions
      if(band) R(g,0,24,32,8,'#22323f');                                               // the floor slab
      g.fillStyle='rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(4+(c&1)*6,30); g.lineTo(14+(c&1)*6,2); g.lineTo(18+(c&1)*6,2); g.lineTo(8+(c&1)*6,30); g.fill();   // a sky glint
      if(top){ R(g,0,0,32,5,'#c0d0dc'); R(g,0,5,32,1,'#1a2838'); }
    });
  }
  // high tech: graphite panels, cyan neon seams, a status light here and there
  function tech(c,r,top){
    const seam=((r%2)+2)%2===0, dot=hsh(c,r)>0.86, ph=(c+r)&1;
    return mk('tech'+(seam?1:0)+(dot?1:0)+(top?1:0)+ph,g=>{
      R(g,0,0,32,32,'#232a34'); R(g,1,1,30,30,ph?'#2a323e':'#262e38');
      R(g,0,0,32,1,'#141a22'); R(g,0,0,1,32,'#141a22');
      if(seam){ R(g,0,31,32,1,'rgba(80,230,255,0.75)'); R(g,0,30,32,1,'rgba(80,230,255,0.2)'); }
      R(g,6,6,20,2,'rgba(150,170,190,0.15)');
      if(dot){ R(g,24,8,3,3,'#40ffd0'); R(g,23,7,5,5,'rgba(64,255,208,0.25)'); }
      if(top){ R(g,0,0,32,4,'#8ae8ff'); R(g,0,4,32,2,'#141a22'); }
    });
  }
  // ── interiors (air) ──
  const SHAFTS=[[8,10],[19,21],[12,17]];                    // the residential tower's elevator shafts (cols)
  function inShaft(c){ return SHAFTS.some(([a,b])=>c>=a&&c<=b); }
  function inResi(c,r){
    if(inShaft(c)){
      const edge=SHAFTS.find(([a,b])=>c===a||c===b), side=edge?(c===edge[0]?0:1):-1;
      return mk('shaft'+side+(((r%4)+4)%4===0?1:0),g=>{
        R(g,0,0,32,32,'#1c1618'); if(((r%4)+4)%4===0) R(g,0,14,32,3,'#2c2224');       // a floor beam crossing the shaft
        if(side===0) R(g,1,0,4,32,'#5a5a62'); if(side===1) R(g,27,0,4,32,'#5a5a62');  // the guide rails
        if(side>=0) R(g,side?28:2,0,1,32,'#8a8a92');
      });
    }
    const fy=((r%7)+7)%7, door=((c%6)+6)%6===3&&fy>=3, lamp=((c%6)+6)%6===0&&fy===2;
    return mk('hall'+fy+(door?1:0)+(lamp?1:0)+(c&1),g=>{
      R(g,0,0,32,32,'#4a3430'); for(let x=(c&1)*4;x<32;x+=8) R(g,x,0,1,32,'rgba(255,220,200,0.06)');   // wallpaper
      if(fy===6) { R(g,0,22,32,10,'#2a1c18'); R(g,0,22,32,2,'#6a4a3a'); }              // wainscot + floor line
      if(door){ R(g,6,0,20,32,'#6a3a24'); R(g,8,2,16,30,'#7a4a2c'); R(g,21,16,2,2,'#e0c070'); if(fy===3) R(g,12,4,8,4,'#d8c8a8'); }   // an apartment door (number plate)
      if(lamp){ R(g,13,10,6,6,'#ffd98a'); g.fillStyle='rgba(255,210,140,0.18)'; g.beginPath(); g.arc(16,14,14,0,Math.PI*2); g.fill(); }
    });
  }
  function inComm(c,r){
    const fy=((r%6)+6)%6, win=((c%4)+4)%4!==0&&fy>=1&&fy<=3;
    return mk('office'+fy+(win?1:0)+(c%4===2?1:0),g=>{
      R(g,0,0,32,32,'#2c3846'); if(win){ R(g,0,0,32,32,'#4a6a88'); for(let y=2;y<32;y+=4) R(g,0,y,32,1,'rgba(20,30,40,0.5)'); }   // blinds
      if(fy===5){ R(g,0,24,32,8,'#1c242e'); R(g,0,24,32,2,'#7a8a9a'); }
      if(fy===4&&c%4===2){ R(g,4,8,24,4,'#5a4a3a'); R(g,6,12,2,12,'#3a3028'); R(g,24,12,2,12,'#3a3028'); R(g,10,2,10,6,'#141820'); R(g,11,3,8,4,'#5ae0ff'); }   // a desk + a monitor
    });
  }
  function inTech(c,r){
    const rack=((c%3)+3)%3===1, ph=(r&3);
    return mk('vault'+(rack?1:0)+ph,g=>{
      R(g,0,0,32,32,'#0e141c');
      for(let k=0;k<3;k++){ R(g,0,6+k*10+ph*2,32,1,'rgba(80,230,255,0.12)'); }        // circuit traces
      if(rack){ R(g,4,0,24,32,'#161e28'); for(let y=2;y<32;y+=6){ R(g,6,y,20,4,'#1e2834'); R(g,22,y+1,2,2,(y+ph*6)%12<6?'#40ffd0':'#ff4060'); } }   // server racks
    });
  }

  // ── what beta_decor's world() asks for ──
  window.MV_CITY={
    img(c,r,s,top){ return s===7?resi(c,r,top):s===8?comm(c,r,top):s===9?tech(c,r,top):null; },
    solid(c,r,s,top){ const img=s===7?resi(c,r,top):s===8?comm(c,r,top):s===9?tech(c,r,top):null; if(!img) return false; ctx.drawImage(img,sx(c*T),sy(r*T),sw(T)+1,sw(T)+1); return true; },
    air(c,r,s){ const img=s===10?inResi(c,r):s===11?inComm(c,r):s===12?inTech(c,r):null; if(!img) return false; ctx.drawImage(img,sx(c*T),sy(r*T),sw(T)+1,sw(T)+1); return true; },
    // the vertical platforms: elevator cabs inside the residential tower, a hoist cage outside
    platform(m){
      const B=window.MV_BETA; if(!B||B.stageId!=='1.3'||!m.vert) return false;
      const x=sx(m.x), y=sy(m.y), w=sw(m.w), cabH=sw(4*T-6);
      if(m.x<23*T){
        // the cable up to the top of the shaft
        ctx.strokeStyle='#8a8a92'; ctx.lineWidth=Math.max(1,sw(1.5)); ctx.beginPath(); ctx.moveTo(x+w/2,y-cabH); ctx.lineTo(x+w/2,sy(2*T)); ctx.stroke();
        // the cab: a lit box with a frame, open doors (you step in and out of it)
        const g=ctx.createLinearGradient(0,y-cabH,0,y); g.addColorStop(0,'rgba(255,220,160,0.20)'); g.addColorStop(1,'rgba(255,200,140,0.08)');
        ctx.fillStyle=g; ctx.fillRect(x,y-cabH,w,cabH);
        ctx.fillStyle='#4a4048'; ctx.fillRect(x,y-cabH,w,sw(6)); ctx.fillRect(x,y-cabH,sw(3),cabH); ctx.fillRect(x+w-sw(3),y-cabH,sw(3),cabH);
        ctx.fillStyle='#ffe0a0'; ctx.fillRect(x+w/2-sw(5),y-cabH+sw(6),sw(10),sw(2));                        // the ceiling light
        ctx.fillStyle=m.loop?(m.dir>0?'#ff7060':'#60ff90'):'#c070ff'; ctx.fillRect(x+w-sw(10),y-cabH+sw(10),sw(4),sw(4));   // ▲ / ▼ lamp
        ctx.fillStyle='#2a2428'; ctx.fillRect(x-sw(2),y,w+sw(4),sw(10)); ctx.fillStyle='#8a7a6a'; ctx.fillRect(x-sw(2),y,w+sw(4),sw(3));   // the floor
      }else{
        ctx.fillStyle='#d8a020'; ctx.fillRect(x-sw(2),y,w+sw(4),sw(8));
        ctx.fillStyle='#2a2a2e'; for(let k=0;k<w;k+=sw(8)) ctx.fillRect(x+k,y+sw(2),sw(4),sw(4));               // hazard stripes
        ctx.strokeStyle='rgba(216,160,32,0.7)'; ctx.lineWidth=Math.max(1,sw(2)); ctx.strokeRect(x,y-sw(3*T),w,sw(3*T));   // the cage
        ctx.strokeStyle='#8a8a92'; ctx.lineWidth=Math.max(1,sw(1.5)); ctx.beginPath(); ctx.moveTo(x+w/2,y-sw(3*T)); ctx.lineTo(x+w/2,sy(2*T)); ctx.stroke();
      }
      return true;
    },
    // after the tiles: the lobby, and the vault's cover
    over(B){
      if(B.stageId!=='1.3') return;
      for(const d of B.decor){
        if(d.kind==='lobby') lobby(d);
      }
    },
  };
  function lobby(d){
    const x=d.x, y=d.y, w=d.w, h=d.h, f=y+h;                 // the residential tower's lobby
    const rr=(a,b,c2,e,col)=>{ ctx.fillStyle=col; ctx.fillRect(sx(a),sy(b),sw(c2),sw(e)); };
    rr(x+w*0.5,f-3.6*T,1.6*T,3.6*T,'#5a5a62'); rr(x+w*0.5+4,f-3.6*T+4,0.75*T,3.6*T-4,'#8a8a92'); rr(x+w*0.5+0.8*T+4,f-3.6*T+4,0.75*T,3.6*T-4,'#8a8a92');   // elevator doors
    rr(x+w*0.5+0.6*T,f-4.1*T,0.4*T,0.3*T,'#ffcf7a');
    for(let k=0;k<6;k++) rr(x+w*0.12+(k%3)*0.45*T,f-2.6*T+(k/3|0)*0.4*T,0.38*T,0.3*T,'#7a6a4a');   // mailboxes
    if(typeof drawTextC==='function'){ ctx.save(); (window.MV_BETA&&MV_BETA.wtext?MV_BETA.wtext:(fn,...a)=>fn(...a))(drawTextC,'RESIDENCIAL AWDJOO',sx(x+w/2),sy(y+0.4*T),'#ffd8a8',1); ctx.restore(); }
  }
  // the vault's cover goes over the pickups inside it too (drawn after the knowls, before the characters)
  const _hud=window.drawLdtkLabHud;
  window.drawLdtkLabHud=function(){
    const r=_hud?_hud.apply(this,arguments):undefined;
    try{ const B=window.MV_BETA; if(B&&B.on&&B.stageId==='1.3') for(const d of B.decor) if(d.kind==='vault') vaultCover(B,d); }catch(e){}
    return r;
  };
  let reveal=0;
  function vaultCover(B,d){
    if(typeof p==='undefined'||!p) return;
    const px=p.x+SW/2, py=p.y+FEET_OFF-40;
    const inside=px>d.x-T&&px<d.x+d.w+T*2&&py>d.y&&py<d.y+d.h+T;
    reveal+=((inside?1:0)-reveal)*0.08;
    if(reveal>0.98) return;
    ctx.save(); ctx.globalAlpha=1-reveal;
    const lv=B.level, c0=Math.floor(d.x/T), c1=Math.floor((d.x+d.w)/T)-1, r0=Math.floor(d.y/T), r1=Math.floor((d.y+d.h)/T)-1;
    for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++){ if(lv.cells[r]&&!lv.cells[r][c]) ctx.drawImage(tech(c,r,false),sx(c*T),sy(r*T),sw(T)+1,sw(T)+1); }
    ctx.restore();
  }
})();
