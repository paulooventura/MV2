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

  // ── solid facades (Paulo, Oct 22: "a cool, futuristic commercial / residential hub") ──
  const LIT=(a,b)=>{ const h=hsh(a,b); return h<0.42?'warm':h<0.6?'cool':'dark'; };
  // residential: white cladding, ribbon windows over glass balconies with planters, an amber LED
  // strip along every floor slab — a 3x3 module: rows 0-1 window + balcony, row 2 the slab
  function resi(c,r,top){
    const bx=((c%3)+3)%3, fy=((r%3)+3)%3, lit=LIT(Math.floor(c/3),Math.floor(r/3));
    return mk('R'+bx+fy+lit+(top?1:0),g=>{
      R(g,0,0,32,32,'#ddd6c8'); R(g,0,0,32,1,'rgba(255,255,255,0.35)'); if(bx===0) R(g,0,0,1,32,'#b8b0a2');
      if(fy===0||fy===1){
        const y0=fy===0?7:0, y1=fy===0?32:20;
        const gr=g.createLinearGradient(0,fy===0?7:-25,0,fy===0?52:20);
        if(lit==='warm'){ gr.addColorStop(0,'#ffe2a8'); gr.addColorStop(1,'#f0a860'); }
        else if(lit==='cool'){ gr.addColorStop(0,'#bfe8ff'); gr.addColorStop(1,'#5a9ad8'); }
        else { gr.addColorStop(0,'#3a4a62'); gr.addColorStop(1,'#1e2636'); }
        g.fillStyle=gr; g.fillRect(bx===0?3:0,y0,bx===2?29:32,y1-y0);
        if(bx===0) R(g,0,y0,3,y1-y0,'#2a2e36'); if(bx===2) R(g,29,y0,3,y1-y0,'#2a2e36');
        if(fy===0) R(g,0,5,32,2,'#2a2e36');                                               // the window head
        if(lit==='dark'){ g.fillStyle='rgba(255,255,255,0.14)'; g.beginPath(); g.moveTo(4+bx*3,y1); g.lineTo(14+bx*3,y0); g.lineTo(19+bx*3,y0); g.lineTo(9+bx*3,y1); g.fill(); }
        if(lit!=='dark'&&fy===0&&bx===1){ R(g,12,10,8,3,'rgba(60,40,30,0.35)'); R(g,15,13,2,10,'rgba(60,40,30,0.3)'); }   // a lamp inside
        if(fy===1){                                                                        // the glass balcony + planter
          R(g,0,20,32,10,'rgba(210,240,255,0.32)'); R(g,0,19,32,1,'#f4fbff'); R(g,0,29,32,1,'rgba(120,150,170,0.6)');
          R(g,2,24,28,6,'#5a4c40'); R(g,2,24,28,1,'#7a6a5a');
          for(let k=0;k<6;k++){ const lx=3+k*5+(c&1)*2; R(g,lx,20-(k%2),4,4,k%2?'#4aa860':'#6cc878'); R(g,lx+1,18-(k%3),2,3,'#3a8a4a'); }
        }
      } else {                                                                             // the slab
        R(g,0,0,32,32,'#cfc7b8'); R(g,0,0,32,3,'rgba(40,30,20,0.25)');
        R(g,0,4,32,2,'#ffc070'); R(g,0,3,32,1,'rgba(255,192,112,0.4)'); R(g,0,6,32,2,'rgba(255,192,112,0.18)');
        R(g,0,26,32,1,'rgba(120,110,96,0.5)');
      }
      if(top){ R(g,0,0,32,6,'#f4efe4'); R(g,0,6,32,2,'#ffc070'); R(g,0,8,32,2,'rgba(255,192,112,0.25)'); }
    });
  }
  // commercial: a dark teal curtain wall — chrome mullions, spandrels with a cyan neon line at
  // every floor, offices lit floor by floor, and one long diagonal sky reflection that runs across
  // the whole facade (its phase comes from the tile's place, so it lines up tile to tile)
  function comm(c,r,top){
    const bx=c&1, fy=((r%4)+4)%4, ph=(((c-r)%10)+10)%10, lit=LIT(Math.floor(c/3),Math.floor(r/4));
    return mk('C'+bx+fy+ph+lit+(top?1:0),g=>{
      const gr=g.createLinearGradient(0,0,0,32); gr.addColorStop(0,'#16405e'); gr.addColorStop(1,'#0e2a42');
      g.fillStyle=gr; g.fillRect(0,0,32,32);
      if((fy===1||fy===2)&&lit!=='dark'){                                                  // an office floor, lit
        R(g,0,0,32,32,lit==='warm'?'rgba(255,214,150,0.30)':'rgba(120,230,255,0.22)');
        if(fy===1) R(g,0,2,32,2,lit==='warm'?'rgba(255,244,220,0.85)':'rgba(200,250,255,0.8)');   // ceiling light strip
        if(fy===2){ R(g,4+bx*6,20,12,8,'rgba(10,20,30,0.55)'); R(g,6+bx*6,14,6,6,lit==='warm'?'rgba(40,30,30,0.45)':'rgba(90,240,255,0.7)'); }
      }
      for(const k of [-1,0,1]){ const d0=320*k-ph*32;                                       // the diagonal reflection
        g.fillStyle='rgba(200,240,255,0.13)'; g.beginPath(); g.moveTo(d0,0); g.lineTo(d0+90,0); g.lineTo(d0+122,32); g.lineTo(d0+32,32); g.fill();
        g.fillStyle='rgba(255,255,255,0.10)'; g.beginPath(); g.moveTo(d0+20,0); g.lineTo(d0+34,0); g.lineTo(d0+66,32); g.lineTo(d0+52,32); g.fill(); }
      if(fy===3){ R(g,0,16,32,16,'#0a1a28'); R(g,0,16,32,2,'#6ef4ff'); R(g,0,15,32,1,'rgba(110,244,255,0.35)'); R(g,0,18,32,2,'rgba(110,244,255,0.18)'); }   // spandrel + neon
      if(bx===0){ R(g,0,0,2,32,'#0a141e'); R(g,2,0,1,32,'rgba(170,220,255,0.45)'); }       // mullion (chrome edge)
      if(top){ R(g,0,0,32,4,'#c8f4ff'); R(g,0,4,32,2,'#6ef4ff'); R(g,0,6,32,3,'rgba(110,244,255,0.22)'); }
    });
  }
  // high tech: graphite panels with circuit traces, a cyan seam every second row, light bars
  function tech(c,r,top){
    const seam=((r%2)+2)%2===0, bar=((c%4)+4)%4===0, dot=hsh(c,r)>0.86, ph=(c+r)&1, tr=((c*3+r*5)%4+4)%4;
    return mk('T'+(seam?1:0)+(bar?1:0)+(dot?1:0)+(top?1:0)+ph+tr,g=>{
      R(g,0,0,32,32,'#1c222c'); R(g,1,1,30,30,ph?'#232a36':'#202732');
      R(g,0,0,32,1,'#10141a'); R(g,0,0,1,32,'#10141a');
      g.strokeStyle='rgba(80,230,255,0.16)'; g.lineWidth=1; g.beginPath();                  // circuit traces
      g.moveTo(4,6+tr*5); g.lineTo(14,6+tr*5); g.lineTo(18,10+tr*5); g.lineTo(28,10+tr*5); g.moveTo(8,30); g.lineTo(8,22-tr*2); g.lineTo(12,18-tr*2); g.stroke();
      R(g,13,5+tr*5,2,2,'rgba(80,230,255,0.4)');
      if(bar){ R(g,13,0,6,32,'#121820'); R(g,15,0,2,32,'rgba(90,240,255,0.65)'); R(g,14,0,4,32,'rgba(90,240,255,0.12)'); }
      if(seam){ R(g,0,31,32,1,'rgba(80,230,255,0.8)'); R(g,0,29,32,2,'rgba(80,230,255,0.15)'); }
      if(dot){ R(g,24,8,3,3,ph?'#ff40c0':'#40ffd0'); R(g,23,7,5,5,ph?'rgba(255,64,192,0.25)':'rgba(64,255,208,0.25)'); }
      if(top){ R(g,0,0,32,3,'#bff8ff'); R(g,0,3,32,2,'#40e8ff'); R(g,0,5,32,3,'rgba(64,232,255,0.2)'); }
    });
  }
  // ── interiors (air) ──
  const SHAFTS=[[8,10],[19,21],[12,17]];                    // the residential tower's elevator shafts (cols)
  function inShaft(c){ return SHAFTS.some(([a,b])=>c>=a&&c<=b); }
  function inResi(c,r){
    if(inShaft(c)){
      const edge=SHAFTS.find(([a,b])=>c===a||c===b), side=edge?(c===edge[0]?0:1):-1, beam=((r%4)+4)%4===0;
      return mk('S'+side+(beam?1:0),g=>{
        R(g,0,0,32,32,'#14161c'); R(g,0,0,32,32,'rgba(60,80,120,0.12)');
        if(beam){ R(g,0,14,32,3,'#22262e'); R(g,0,14,32,1,'rgba(110,244,255,0.35)'); }      // a floor beam with a light line
        if(side===0){ R(g,1,0,4,32,'#6a707c'); R(g,2,0,1,32,'#d0d8e4'); } if(side===1){ R(g,27,0,4,32,'#6a707c'); R(g,29,0,1,32,'#d0d8e4'); }   // chrome guide rails
      });
    }
    const fy=((r%7)+7)%7, door=((c%6)+6)%6===3&&fy>=3, lamp=((c%6)+6)%6===0&&fy===2;
    return mk('H'+fy+(door?1:0)+(lamp?1:0)+(c&1),g=>{
      R(g,0,0,32,32,'#2c2a30'); for(let x=(c&1)*4;x<32;x+=8) R(g,x,0,1,32,'rgba(255,240,220,0.05)');
      if(fy===0){ R(g,0,0,32,3,'#1c1a20'); R(g,0,3,32,1,'#ffc070'); R(g,0,4,32,4,'rgba(255,192,112,0.12)'); }   // cove light at the ceiling
      if(fy===6){ R(g,0,24,32,8,'#1a181c'); R(g,0,24,32,1,'rgba(255,192,112,0.5)'); }
      if(door){ R(g,6,0,20,32,'#3a3e48'); R(g,8,0,7,32,'#4a505c'); R(g,17,0,7,32,'#4a505c'); R(g,15,0,2,32,'#1a1c22');   // a sliding door
        if(fy===3){ R(g,10,6,12,5,'#0e1418'); R(g,11,7,10,3,'#6ef4ff'); } }                  // its LED number
      if(lamp){ R(g,12,10,8,3,'#ffe0b0'); g.fillStyle='rgba(255,210,150,0.14)'; g.beginPath(); g.arc(16,14,14,0,Math.PI*2); g.fill(); }
    });
  }
  function inComm(c,r){
    const fy=((r%6)+6)%6, part=((c%5)+5)%5===0, desk=((c%4)+4)%4===2&&fy===4;
    return mk('O'+fy+(part?1:0)+(desk?1:0)+(c&1),g=>{
      R(g,0,0,32,32,'#122030'); if(fy===0){ R(g,0,0,32,2,'#0a141e'); R(g,0,2,32,1,'rgba(200,250,255,0.6)'); R(g,0,3,32,5,'rgba(120,230,255,0.07)'); }
      if(fy>=1&&fy<=4){ R(g,0,0,32,32,'rgba(60,140,190,0.10)'); if(fy===2) for(let x=(c&1)*6;x<32;x+=12) R(g,x,4,6,10,'rgba(160,220,255,0.12)'); }   // the city through the far glass
      if(part){ R(g,14,0,3,32,'rgba(170,220,255,0.18)'); R(g,15,0,1,32,'rgba(220,245,255,0.35)'); }   // glass partition
      if(fy===5){ R(g,0,24,32,8,'#0a121c'); R(g,0,24,32,1,'rgba(110,244,255,0.45)'); }
      if(desk){ R(g,4,14,24,3,'#d8dee6'); R(g,6,17,2,10,'#8a929e'); R(g,24,17,2,10,'#8a929e');
        R(g,10,2,12,9,'rgba(90,240,255,0.25)'); R(g,11,3,10,7,'rgba(90,240,255,0.55)'); R(g,12,4,5,1,'#e8ffff'); R(g,12,6,7,1,'#bff8ff'); }   // a desk + holo screen
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

  // ── the towers going on up behind their summits (air: you can't touch them) ──
  // the same facade, pushed back into the dusk: darker, hazier, fewer lights
  const far=new Map();
  function farOf(base,veil){ let c=far.get(base); if(c) return c; c=document.createElement('canvas'); c.width=PX; c.height=PX; const g=c.getContext('2d');
    g.drawImage(base,0,0); g.fillStyle=veil; g.fillRect(0,0,32,32); far.set(base,c); return c; }
  function farComm(c,r){ return farOf(comm(c,r,false),'rgba(26,14,40,0.64)'); }
  function farTech(c,r){ return farOf(tech(c,r,false),'rgba(18,10,32,0.6)'); }

  // ── what beta_decor's world() asks for ──
  window.MV_CITY={
    img(c,r,s,top){ return s===7?resi(c,r,top):s===8?comm(c,r,top):s===9?tech(c,r,top):null; },
    solid(c,r,s,top){ const img=s===7?resi(c,r,top):s===8?comm(c,r,top):s===9?tech(c,r,top):null; if(!img) return false; ctx.drawImage(img,sx(c*T),sy(r*T),sw(T)+1,sw(T)+1); return true; },
    air(c,r,s){
      if(s===13||s===14){ ctx.drawImage(s===13?farComm(c,r):farTech(c,r),sx(c*T),sy(r*T),sw(T)+1,sw(T)+1); return true; }
      const img=s===10?inResi(c,r):s===11?inComm(c,r):s===12?inTech(c,r):null; if(!img) return false; ctx.drawImage(img,sx(c*T),sy(r*T),sw(T)+1,sw(T)+1); return true; },
    // the vertical platforms: elevator cabs inside the residential tower, a hoist cage outside
    platform(m){
      const B=window.MV_BETA; if(!B||B.stageId!=='1.3'||!m.vert) return false;
      const x=sx(m.x), y=sy(m.y), w=sw(m.w), cabH=sw(4*T-6);
      if(m.x<23*T){
        // the cable up to the top of the shaft
        ctx.strokeStyle='#8a8a92'; ctx.lineWidth=Math.max(1,sw(1.5)); ctx.beginPath(); ctx.moveTo(x+w/2,y-cabH); ctx.lineTo(x+w/2,sy(m.clipT!=null?m.clipT:2*T)); ctx.stroke();
        // the cab: a lit box with a frame, open doors (you step in and out of it)
        const g=ctx.createLinearGradient(0,y-cabH,0,y); g.addColorStop(0,'rgba(255,220,160,0.20)'); g.addColorStop(1,'rgba(255,200,140,0.08)');
        ctx.fillStyle=g; ctx.fillRect(x,y-cabH,w,cabH);
        const door=Math.max(0,Math.min(1,m.door||0));
        if(door>0.02){
          const pw=Math.max(sw(2),(w*0.5)*door);
          ctx.fillStyle='#8e96a2';
          ctx.fillRect(x,y-cabH+sw(6),pw,cabH-sw(10));
          ctx.fillRect(x+w-pw,y-cabH+sw(6),pw,cabH-sw(10));
          ctx.fillStyle='#d5dbe4';
          ctx.fillRect(x+pw-sw(2),y-cabH+sw(6),sw(2),cabH-sw(10));
          ctx.fillRect(x+w-pw,y-cabH+sw(6),sw(2),cabH-sw(10));
        }
        ctx.fillStyle='#4a4048'; ctx.fillRect(x,y-cabH,w,sw(6)); ctx.fillRect(x,y-cabH,sw(3),cabH); ctx.fillRect(x+w-sw(3),y-cabH,sw(3),cabH);
        ctx.fillStyle='#ffe0a0'; ctx.fillRect(x+w/2-sw(5),y-cabH+sw(6),sw(10),sw(2));                        // the ceiling light
        ctx.fillStyle=m.loop?(m.dir>0?'#ff7060':'#60ff90'):'#c070ff'; ctx.fillRect(x+w-sw(10),y-cabH+sw(10),sw(4),sw(4));   // ▲ / ▼ lamp
        ctx.fillStyle='#2a2428'; ctx.fillRect(x-sw(2),y,w+sw(4),sw(10)); ctx.fillStyle='#8a7a6a'; ctx.fillRect(x-sw(2),y,w+sw(4),sw(3));   // the floor
      }else{
        ctx.fillStyle='#d8a020'; ctx.fillRect(x-sw(2),y,w+sw(4),sw(8));
        ctx.fillStyle='#2a2a2e'; for(let k=0;k<w;k+=sw(8)) ctx.fillRect(x+k,y+sw(2),sw(4),sw(4));               // hazard stripes
        ctx.strokeStyle='rgba(216,160,32,0.7)'; ctx.lineWidth=Math.max(1,sw(2)); ctx.strokeRect(x,y-sw(3*T),w,sw(3*T));   // the cage
        if(m.locked){ ctx.fillStyle='rgba(8,6,10,0.9)'; ctx.fillRect(x+sw(2),y-sw(3*T),w-sw(4),sw(3*T)-sw(4)); ctx.fillStyle='#120e12'; ctx.fillRect(x,y-sw(3*T)-sw(4),w,sw(8)); }
        ctx.strokeStyle='#8a8a92'; ctx.lineWidth=Math.max(1,sw(1.5)); ctx.beginPath(); ctx.moveTo(x+w/2,y-sw(3*T)); ctx.lineTo(x+w/2,sy(m.clipT!=null?m.clipT:2*T)); ctx.stroke();
      }
      return true;
    },
    // after the tiles: the lobby, and the vault's cover
    over(B){
      if(B.stageId!=='1.3') return;
      for(const d of B.decor){
        if(d.kind==='lobby') lobby(d);
        else if(d.kind==='cube') cube(d);
      }
      sky(B);
    },
  };
  // the sky islands between the belts: cubes in oblique view, like the sheet — a square front face,
  // the top and the right side receding up-right (matches the collision silhouette from the builder)
  function cube(d){
    const s=(d.cs||5)*T, k=(d.cd||2)*T, x=d.x, y=d.y+k;
    const P=(pts,fill)=>{ ctx.beginPath(); pts.forEach(([a,b],i)=>i?ctx.lineTo(sx(a),sy(b)):ctx.moveTo(sx(a),sy(b))); ctx.closePath(); ctx.fillStyle=fill; ctx.fill(); };
    // top face
    const gt=ctx.createLinearGradient(sx(x),sy(y-k),sx(x+s+k),sy(y)); gt.addColorStop(0,'#e8d4c0'); gt.addColorStop(1,'#c8a890');
    P([[x,y],[x+k,y-k],[x+s+k,y-k],[x+s,y]],gt);
    // right side (in shade)
    P([[x+s,y],[x+s+k,y-k],[x+s+k,y+s-k],[x+s,y+s]],'#6a4a3c');
    // front face
    const gf=ctx.createLinearGradient(0,sy(y),0,sy(y+s)); gf.addColorStop(0,'#b88a6c'); gf.addColorStop(1,'#8a6050');
    P([[x,y],[x+s,y],[x+s,y+s],[x,y+s]],gf);
    // a panel grid on the faces, so it reads as a solid block
    ctx.strokeStyle='rgba(60,36,28,0.35)'; ctx.lineWidth=Math.max(1,sw(1));
    for(let i=1;i<(d.cs||5);i++){ const t=i*T; ctx.beginPath(); ctx.moveTo(sx(x+t),sy(y)); ctx.lineTo(sx(x+t),sy(y+s)); ctx.moveTo(sx(x),sy(y+t)); ctx.lineTo(sx(x+s),sy(y+t)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx(x+s),sy(y+t)); ctx.lineTo(sx(x+s+k),sy(y+t-k)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(sx(x+t),sy(y)); ctx.lineTo(sx(x+t+k),sy(y-k)); ctx.stroke(); }
    // the edges: dark outline, a lit rim along the front-top edge
    ctx.strokeStyle='#2a1a16'; ctx.lineWidth=Math.max(1,sw(2)); ctx.beginPath();
    [[x,y],[x+k,y-k],[x+s+k,y-k],[x+s+k,y+s-k],[x+s,y+s],[x,y+s],[x,y]].forEach(([a,b],i)=>i?ctx.lineTo(sx(a),sy(b)):ctx.moveTo(sx(a),sy(b)));
    ctx.moveTo(sx(x+s),sy(y)); ctx.lineTo(sx(x+s+k),sy(y-k)); ctx.moveTo(sx(x+s),sy(y)); ctx.lineTo(sx(x+s),sy(y+s)); ctx.stroke();
    ctx.strokeStyle='rgba(255,240,220,0.8)'; ctx.lineWidth=Math.max(1,sw(1.5)); ctx.beginPath(); ctx.moveTo(sx(x+2),sy(y+1)); ctx.lineTo(sx(x+s-1),sy(y+1)); ctx.stroke();
    // its shadow cast on the shaft wall behind, below
    ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fillRect(sx(x+k*0.5),sy(y+s),sw(s),sw(k*0.6));
  }
  // ── up in the open sky over the towers: holo billboards on the background towers, hover-cars ──
  const TX=(fn,...a)=>(window.MV_BETA&&MV_BETA.wtext?MV_BETA.wtext:(f,...b)=>f(...b))(fn,...a);
  function board(c0,r0,cw,rh,col,glow,lines){
    const x=c0*T, y=r0*T, w=cw*T, h=rh*T, fl=Math.sin(fr*0.21+c0)>0.96?0.35:1;          // a flicker now and then
    ctx.save(); ctx.globalAlpha=0.85*fl;
    ctx.fillStyle='rgba(6,10,20,0.55)'; ctx.fillRect(sx(x),sy(y),sw(w),sw(h));
    ctx.strokeStyle=col; ctx.lineWidth=Math.max(1,sw(2)); ctx.strokeRect(sx(x)+1,sy(y)+1,sw(w)-2,sw(h)-2);
    ctx.fillStyle=glow; ctx.fillRect(sx(x),sy(y),sw(w),sw(h));
    for(let k=0;k<h;k+=6){ ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.fillRect(sx(x),sy(y+k+((fr*0.6)%6)),sw(w),1); }   // scanlines
    if(typeof drawTextC==='function') lines.forEach((L,i)=>TX(drawTextC,L[0],sx(x+w/2),sy(y+h*(i+1)/(lines.length+1))-6,L[1],L[2]||1));
    ctx.restore();
  }
  const cars=[{y:2.2,s:2.4,o:0,col:'#ff5ab4'},{y:4.1,s:-1.7,o:900,col:'#6ef4ff'},{y:1.2,s:1.2,o:1700,col:'#ffd070'}];
  function sky(B){
    if(B.stageId!=='1.3') return;
    board(23.4,1.5,5,8,'#ff5ab4','rgba(255,90,180,0.10)',[['AWDJOO','#ff9ad0',2],['MALL','#ffd0e8',1],['24/7','#6ef4ff',1]]);
    board(40,1,8,4.5,'#6ef4ff','rgba(110,244,255,0.10)',[['MV LABS','#bff8ff',2],['MIND · VENTURE','#6ef4ff',1]]);
    const x0=23*T, x1=91*T, span=x1-x0;
    for(const c of cars){ const t=((fr*c.s+c.o)%span+span)%span, x=c.s>0?x0+t:x1-t, y=c.y*T;
      const X=sx(x), Y=sy(y), d=c.s>0?1:-1;
      ctx.fillStyle='rgba(255,255,255,0.10)'; ctx.fillRect(X-d*sw(60),Y+sw(3),d*sw(60),sw(2));                      // light trail
      ctx.fillStyle='#1a1e28'; ctx.fillRect(X-sw(14),Y,sw(28),sw(7)); ctx.fillStyle='#2e3442'; ctx.fillRect(X-sw(9),Y-sw(4),sw(16),sw(5));
      ctx.fillStyle='rgba(160,220,255,0.7)'; ctx.fillRect(X-sw(7),Y-sw(3),sw(12),sw(3));
      ctx.fillStyle='#fff6d8'; ctx.fillRect(X+d*sw(12)-(d<0?sw(3):0),Y+sw(1),sw(3),sw(3));                          // headlight
      ctx.fillStyle=c.col; ctx.fillRect(X-sw(12),Y+sw(7),sw(24),sw(1.5));                                          // under-glow
    }
  }
  function lobby(d){
    const x=d.x, y=d.y, w=d.w, h=d.h, f=y+h;                 // the residential tower's lobby
    const rr=(a,b,c2,e,col)=>{ ctx.fillStyle=col; ctx.fillRect(sx(a),sy(b),sw(c2),sw(e)); };
    rr(x+w*0.5,f-3.6*T,1.6*T,3.6*T,'#5a5a62'); rr(x+w*0.5+4,f-3.6*T+4,0.75*T,3.6*T-4,'#8a8a92'); rr(x+w*0.5+0.8*T+4,f-3.6*T+4,0.75*T,3.6*T-4,'#8a8a92');   // elevator doors
    rr(x+w*0.5+0.6*T,f-4.1*T,0.4*T,0.3*T,'#ffcf7a');
    for(let k=0;k<6;k++) rr(x+w*0.12+(k%3)*0.45*T,f-2.6*T+(k/3|0)*0.4*T,0.38*T,0.3*T,'#7a6a4a');   // mailboxes
    if(typeof drawTextC==='function'){ ctx.save(); (window.MV_BETA&&MV_BETA.wtext?MV_BETA.wtext:(fn,...a)=>fn(...a))(drawTextC,'RESIDENCIAL AWDJOO',sx(x+w/2),sy(y+0.4*T),'#ffd8a8',1); ctx.restore(); }
  }
  // the secret rooms (the vault, the knife's chamber): their walls are painted back over them —
  // the doorway too — until MIND has actually gone in (his centre past the door columns, inside
  // the room). Found once, they stay open. Drawn after the pickups so it hides them as well.
  const _hud=window.drawLdtkLabHud;
  window.drawLdtkLabHud=function(){
    const r=_hud?_hud.apply(this,arguments):undefined;
    try{ const B=window.MV_BETA; if(B&&B.on&&B.stageId==='1.3') for(const d of B.decor) if(d.kind==='vault'||d.kind==='secret') cover(B,d); }catch(e){}
    return r;
  };
  const reveal={};
  function cover(B,d){
    if(typeof p==='undefined'||!p) return;
    if(!B._secrets||B._secrets.lv!==B.level) B._secrets={lv:B.level};          // a fresh stage: nothing found yet
    const key=d.kind+d.x, px=p.x+SW/2, py=p.y+FEET_OFF-40, inner=d.x+d.w-(d.door||0)*T;
    if(px>d.x&&px<inner&&py>d.y&&py<d.y+d.h) B._secrets[key]=true;
    const want=B._secrets[key]?1:0; reveal[key]=(reveal[key]||0)+(want-(reveal[key]||0))*0.06;
    if(want&&reveal[key]>0.98) return;
    ctx.save(); ctx.globalAlpha=1-(reveal[key]||0);
    const lv=B.level, c0=Math.floor(d.x/T), c1=Math.floor((d.x+d.w)/T)-1, r0=Math.floor(d.y/T), r1=Math.floor((d.y+d.h)/T)-1, D=window.MV_BETA_DECOR;
    for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++){ if(!lv.cells[r]||lv.cells[r][c]) continue;
      const im=d.kind==='vault'?tech(c,r,false):(D&&D.solidTex?D.solidTex(c,r,B.skin?B.skin[r][c]:2):null);
      if(im) ctx.drawImage(im,sx(c*T),sy(r*T),sw(T)+1,sw(T)+1); }
    ctx.restore();
  }
})();
