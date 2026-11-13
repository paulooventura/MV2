// ============================================================
//  beta_doors.js — 1.1's doors, trap doors, the hidden attic and the Knowl tree's glow
//  (Paulo, Nov 13)
//
//   - Laitu's house gets a door in its left and right openings, our home one on its right side:
//     punch one and it swings open (away from you), creaking, a puff of dust.
//   - The pre-basement under the kitchen: a door on its right (where the purple blocks were) and,
//     in its floor, a trap door of two leaves that sits shut. Three punches, or one loaded punch,
//     and it pops: the left leaf drops away down-left, the right one down-right. Below it the shaft
//     is cave, not brick, and near the Knowl tree the cave is alive: glowing roots, hanging vines
//     with luminous tips, flowers that pulse, motes rising off the tree.
//   - The attic: hidden inside the roof, the roof drawn over it until you climb in. A hatch in the
//     bedroom ceiling (a shelf under it to reach it) pops UP after three punches or one loaded one.
//     Up there: crates of old house things, and one crate with an extra life in it.
//
//  Doors and hatches are cells of the typed grid set SOLID while shut (js/collision_grid.js).
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B) return;
  const T=32;
  const S={lv:null, doors:[], traps:[], crates:[], life:null, attic:null, found:false, reveal:0, puffs:[]};
  window.MV_DOORS=S;
  const on=()=>B.on&&B.stageId==='1.1'&&typeof gridSet==='function'&&typeof MV_GRID!=='undefined'&&MV_GRID&&MV_GRID.ready;
  const hash=(a,b)=>{ let h=(a*374761393+b*668265263)|0; h=(h^(h>>>13))*1274126177|0; return ((h^(h>>>16))>>>0)/4294967295; };

  // ── sounds (synth: a wooden creak, a thud, a knock) ──
  function ac(){ try{ return typeof ga==='function'?ga():null; }catch(e){ return null; } }
  function vol(){ try{ return Math.max(0,Math.min(1,OPT.sfxVol!=null?OPT.sfxVol:1)); }catch(e){ return 1; } }
  function creak(len){
    const a=ac(); if(!a||a.state!=='running') return; const t=a.currentTime, d=len||0.5;
    const o=a.createOscillator(), lfo=a.createOscillator(), lg=a.createGain(), bp=a.createBiquadFilter(), g=a.createGain();
    o.type='sawtooth'; o.frequency.setValueAtTime(140,t); o.frequency.linearRampToValueAtTime(95,t+d);
    lfo.frequency.value=28; lg.gain.value=30; lfo.connect(lg); lg.connect(o.frequency);
    bp.type='bandpass'; bp.frequency.value=900; bp.Q.value=3;
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.09*vol(),t+0.04); g.gain.setValueAtTime(0.09*vol(),t+d*0.7); g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.connect(bp); bp.connect(g); g.connect(a.destination); o.start(t); lfo.start(t); o.stop(t+d+0.05); lfo.stop(t+d+0.05);
  }
  function thud(k){
    const a=ac(); if(!a||a.state!=='running') return; const t=a.currentTime;
    const o=a.createOscillator(), g=a.createGain(); o.type='sine'; o.frequency.setValueAtTime(150*k,t); o.frequency.exponentialRampToValueAtTime(55,t+0.16);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.35*vol(),t+0.005); g.gain.exponentialRampToValueAtTime(0.0001,t+0.2);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t+0.22);
    const n=a.createBufferSource(), b=a.createBuffer(1,Math.round(a.sampleRate*0.08),a.sampleRate), dd=b.getChannelData(0); for(let i=0;i<dd.length;i++) dd[i]=(Math.random()*2-1)*Math.pow(1-i/dd.length,3);
    const lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1600; const ng=a.createGain(); ng.gain.value=0.25*vol(); n.buffer=b; n.connect(lp); lp.connect(ng); ng.connect(a.destination); n.start(t);
  }
  function chime(){
    const a=ac(); if(!a||a.state!=='running') return; const t=a.currentTime;
    [784,988,1175,1568].forEach((f,i)=>{ const o=a.createOscillator(), g=a.createGain(); o.type='triangle'; o.frequency.value=f; g.gain.setValueAtTime(0.0001,t+i*0.09); g.gain.exponentialRampToValueAtTime(0.08*vol(),t+i*0.09+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+i*0.09+0.9); o.connect(g); g.connect(a.destination); o.start(t+i*0.09); o.stop(t+i*0.09+1); });
  }
  function dust(x,y,n,col){ for(let k=0;k<n;k++){ const a=Math.random()*Math.PI*2, s=0.6+Math.random()*2.2; PFXS.push({x:x+(Math.random()-0.5)*20,y:y+(Math.random()-0.5)*20,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:18+(Math.random()*14|0),maxLife:32,r:2+Math.random()*2,col:col||(Math.random()<0.5?'#8a7058':'#b09878')}); } }

  // ── the layout (1.1, grid cells) ──
  function build(){
    S.doors=[
      {id:'home',   c:30, r0:29, r1:31},
      {id:'laituL', c:56, r0:23, r1:25},
      {id:'laituR', c:74, r0:23, r1:25},
      {id:'pre',    c:12, r0:34, r1:37},
    ].map(d=>Object.assign(d,{st:'shut', t:0, side:1}));
    S.traps=[
      {id:'basement', r:38, c0:1, c1:6, dir:'down', hits:0},
      {id:'attic',    r:18, c0:15, c1:17, dir:'up',  hits:0},
    ].map(d=>Object.assign(d,{st:'shut', t:0}));
    // the attic: rows 13-17 inside the roof — its floor is the bedroom's ceiling (row 18), one block thick
    // (Paulo, Nov 13: "looks crammed, make its floor lower")
    S.attic={cells:[], x0:5*T, x1:26*T, y0:12*T, y1:18*T};
    const carve=[[12,13,17],[13,12,18],[14,10,20],[15,9,21],[16,7,23],[17,5,25]];   // (build 408) the ridge one row taller: MIND stands upright under it
    for(const [r,a,b] of carve) for(let c=a;c<=b;c++) S.attic.cells.push([c,r]);
    S.crates=[
      {c:6.4,  r:18, stuff:'books'}, {c:7.5, r:18, stuff:'pots'}, {c:7.0, r:17.15, stuff:'teddy', small:true}, {c:9.6, r:18, stuff:'books'},
      {c:12.4, r:18, stuff:'spoons'}, {c:20.4, r:18, stuff:'life', hp:1}, {c:22.0, r:18, stuff:'lamp'}, {c:21.3, r:17.15, stuff:'books', small:true}, {c:23.6, r:18, stuff:'pots'},
    ].map(k=>Object.assign(k,{broken:false, shake:0, hp:k.stuff==='life'?1:2}));
    S.junk=[];
    S.life=null; S.found=!!B._atticFound; S.reveal=S.found?1:0; S.puffs=[];
  }
  function apply(){
    if(typeof MV_GRID_SOLID==='undefined') return;
    const body=c=>{ if(!p) return false; const x0=p.x+SW*0.2, x1=p.x+SW*0.8, y1=p.y+FEET_OFF, y0=y1-100; return true&&{x0,x1,y0,y1}; };
    const hitsBody=(c,r)=>{ const b=body(); return b&&c*T<b.x1&&(c+1)*T>b.x0&&r*T<b.y1&&(r+1)*T>b.y0; };
    for(const d of S.doors){ let blocked=false; for(let r=d.r0;r<=d.r1;r++) if(hitsBody(d.c,r)) blocked=true;
      if(blocked){ d.st='open'; d.t=99; continue; }
      for(let r=d.r0;r<=d.r1;r++) gridSet(d.c,r,MV_GRID_SOLID); }
    for(const t of S.traps) for(let c=t.c0;c<=t.c1;c++) gridSet(c,t.r,MV_GRID_SOLID);
    for(const [c,r] of S.attic.cells) gridSet(c,r,MV_GRID_AIR);
    for(let c=13;c<=17;c++){ gridSet(c,11,MV_GRID_SOLID); try{ if(B.level&&B.level.cells&&B.level.cells[11]) B.level.cells[11][c]=1; if(B.skin&&B.skin[11]) B.skin[11][c]=1; }catch(e){} }   // the new ridge cap (drawn as roof)
    // a shelf in the bedroom under the attic hatch (a one-way plank you can stand on)
    for(let c=13;c<=19;c++) if(gridCell(c,22)===MV_GRID_AIR) gridSet(c,22,MV_GRID_ONEWAY);
    // the shaft under the trap door is cave, not cellar brick
    if(B.skin) for(let r=39;r<=57;r++) for(let c=1;c<=29;c++) if(B.skin[r]&&B.skin[r][c]===4) B.skin[r][c]=5;   // the shaft and the tree's chamber
    if(typeof gridYCacheClear==='function') try{ gridYCacheClear(); }catch(e){}
  }

  // the attic is carved in the grid, not in the level's collision segments that measureHeadroom reads (they still
  // have the old roof): inside it, the room over his head is measured on the grid (the real ceiling, slopes too)
  S.headroom=function(pl,orig){
    if(!on()||!S.attic||!pl) return orig(pl);
    const cx=pl.x+SW/2, feet=pl.y+FEET_OFF; if(cx<S.attic.x0||cx>S.attic.x1||feet<S.attic.y0||feet>S.attic.y1+T) return orig(pl);
    const body=playerCoreHB(pl), top=body.y; let gap=999;
    for(const dx of [-16,0,16]) for(let y=top;y>top-200;y-=2){ if(gridWorldSolid(cx+dx,y)){ gap=Math.min(gap,top-y); break; } }
    return gap;
  };
  // ── punches (render.js asks here when a fist lands) ──
  S.fist=function(wx,wy,wr,charged){
    if(!on()) return false;
    for(const d of S.doors){ if(d.st!=='shut') continue;
      if(wx>d.c*T-wr-6&&wx<(d.c+1)*T+wr+6&&wy>d.r0*T-wr&&wy<(d.r1+1)*T+wr){
        d.st='opening'; d.t=0; d.side=(p&&p.x+SW/2<d.c*T+T/2)?1:-1;     // it swings away from you
        thud(1); creak(0.55); dust(d.c*T+T/2,(d.r0+d.r1+1)*T/2,10); B.shake=Math.max(B.shake||0,4); B.doorsOpened=(B.doorsOpened|0)+1; return true; } }
    for(const t of S.traps){ if(t.st!=='shut') continue;
      const x0=t.c0*T, x1=(t.c1+1)*T, y0=t.r*T, y1=(t.r+1)*T;
      if(wx>x0-wr&&wx<x1+wr&&wy>y0-wr-18&&wy<y1+wr+18){
        t.hits+=charged?3:1; t.shake=10; thud(t.hits>=3?1.3:1); dust((x0+x1)/2,t.dir==='down'?y0:y1,6);
        if(t.hits>=3){ t.st='opening'; t.t=0; creak(0.35); B.shake=Math.max(B.shake||0,7); B.trapsOpened=(B.trapsOpened|0)+1; dust((x0+x1)/2,(y0+y1)/2,18,'#6a5038'); }
        return true; } }
    // (Paulo, Nov 13) the crates break to a punch at chest height (two hits; one, loaded), their planks fly and
    // what was in them tumbles out onto the floor; the life crate's 1UP pops out of it
    for(const k of S.crates){ if(k.broken||!S.found) continue;
      const kx=k.c*T, ky=k.r*T, w=k.small?22:28, h=k.small?18:24;
      if(wx>kx-wr-8&&wx<kx+w+wr+8&&wy>ky-h-70&&wy<ky+wr){
        k.shake=8; thud(1.6); k.hp-=charged?2:1;
        if(k.hp<=0){ k.broken=true; dust(kx+w/2,ky-h/2,16,'#a07040'); try{ sfx('omniblock_break'); }catch(e){}
          for(let i=0;i<5;i++) S.junk.push({kind:'plank', x:kx+w/2, y:ky-h/2, vx:(Math.random()-0.5)*5, vy:-2-Math.random()*3, rot:Math.random()*6, vr:(Math.random()-0.5)*0.4, floor:ky});
          if(k.stuff==='life'){ S.life={x:kx+w/2, y:ky-h/2, t:0, got:false}; try{ sfx('item_clink'); }catch(e){} }
          else S.junk.push({kind:k.stuff, x:kx+w/2, y:ky-h, vx:(Math.random()-0.5)*3, vy:-3.5, rot:0, vr:(Math.random()-0.5)*0.25, floor:ky}); }
        return true; } }
    return false;
  };

  // ── per frame ──
  function tick(){
    if(!on()){ if(S.lv&&!B.on) S.lv=null; return; }
    if(S.lv!==B.level){ S.lv=B.level; build(); apply(); }
    for(const d of S.doors) if(d.st==='opening'){ d.t++; if(d.t===8) for(let r=d.r0;r<=d.r1;r++) gridSet(d.c,r,MV_GRID_AIR); if(d.t>=26){ d.st='open'; thud(0.8); } }
    for(const t of S.traps){
      if(t.shake>0) t.shake--;
      if(t.st==='opening'){ t.t++; if(t.t===4) for(let c=t.c0;c<=t.c1;c++){ gridSet(c,t.r,MV_GRID_AIR); if(t.id==='attic') gridSet(c,t.r-1,MV_GRID_AIR); } if(t.t>=22){ t.st='open'; thud(0.7); } } }
    for(const k of S.crates) if(k.shake>0) k.shake--;
    for(const j of S.junk||[]){ if(j.rest) continue; j.vy+=0.35; j.x+=j.vx; j.y+=j.vy; j.rot+=j.vr; j.vx*=0.98;
      if(j.y>=j.floor-3){ j.y=j.floor-3; if(Math.abs(j.vy)>1.5){ j.vy*=-0.35; j.vx*=0.6; j.vr*=0.5; } else { j.vy=0; j.vx*=0.7; if(Math.abs(j.vx)<0.1){ j.rest=true; j.rot=Math.round(j.rot/(Math.PI/2))*(Math.PI/2); } } } }
    // the attic shows itself when you're in it
    if(p&&!S.found){ const cx=p.x+SW/2, cy=p.y+FEET_OFF-40; if(cx>S.attic.x0&&cx<S.attic.x1&&cy>S.attic.y0&&cy<S.attic.y1+T){ S.found=true; B._atticFound=true; chime(); try{ uiShowToast('A SECRET ATTIC!'); }catch(e){} } }
    if(S.found&&S.reveal<1) S.reveal=Math.min(1,S.reveal+1/30);
    // the extra life
    const L=S.life;
    if(L&&!L.got){ L.t++; if(p&&Math.hypot(p.x+SW/2-L.x,p.y+FEET_OFF-50-L.y)<46&&L.t>20){ L.got=true; B._atticLife=true; B.lives=(B.lives|0)+1; if(B.showLives) B.showLives(false);
      try{ sfx('item_get'); }catch(e){} try{ uiShowToast('EXTRA LIFE!'); }catch(e){} dust(L.x,L.y,20,'#ffd060'); } }
  }
  const _up=window.update;
  window.update=function(){ const r=_up.apply(this,arguments); try{ tick(); }catch(e){ console.warn('doors',e); } return r; };
  // a new run gives the attic's life back; a restart of the stage keeps it taken
  { const nr=B.newRun; if(typeof nr==='function') B.newRun=function(){ B._atticLife=false; B._atticFound=false; return nr.apply(this,arguments); }; }

  // ── drawing (beta_decor world() calls S.over after the tiles: behind the characters) ──
  const X=x=>sx(x), Y=y=>sy(y), W2=v=>v<0?-sw(-v):sw(v);       // (sw() clamps to >=1: signed here)
  function plank(x,y,w,h,base,dark){ ctx.fillStyle=base; ctx.fillRect(X(x),Y(y),W2(w),W2(h)); ctx.fillStyle=dark; for(let yy=0;yy<h;yy+=10) ctx.fillRect(X(x),Y(y+yy),W2(w),Math.max(1,W2(1))); }
  function drawDoor(d){
    const x=d.c*T, y=d.r0*T, h=(d.r1-d.r0+1)*T;
    const k=d.st==='shut'?0:d.st==='open'?1:Math.min(1,d.t/26), e=1-Math.pow(1-k,3), ang=e*Math.PI*0.47;
    const wv=Math.max(5,T*Math.cos(ang)), hingeX=d.side>0?x+T:x, px=d.side>0?hingeX-wv:hingeX;   // swings away from you, hinged on the far edge
    ctx.save();
    ctx.fillStyle='rgba(10,6,4,0.75)'; ctx.fillRect(X(x),Y(y),W2(T),W2(h));                          // the dark doorway behind it
    ctx.fillStyle='#3a2414'; ctx.fillRect(X(x-2),Y(y-4),W2(T+4),W2(5));                                 // the lintel
    const shade=0.75+0.25*Math.cos(ang);
    plank(px,y+2,wv,h-2,'rgb('+Math.round(122*shade)+','+Math.round(78*shade)+','+Math.round(44*shade)+')','rgba(40,22,10,0.55)');
    ctx.strokeStyle='#2a160a'; ctx.lineWidth=Math.max(1,W2(2)); ctx.strokeRect(X(px),Y(y+2),W2(wv),W2(h-2));
    if(wv>12){ ctx.fillStyle='#d8b060'; ctx.beginPath(); ctx.arc(X(d.side>0?px+5:px+wv-5),Y(y+h*0.55),Math.max(1.5,W2(2.6)),0,Math.PI*2); ctx.fill();   // the handle
      ctx.fillStyle='rgba(255,210,140,0.55)'; ctx.fillRect(X(px+wv*0.25),Y(y+12),W2(wv*0.5),W2(16)); }                                                  // a little window
    for(const yy of [y+14,y+h-16]){ ctx.fillStyle='#1c120a'; ctx.fillRect(X(d.side>0?hingeX-6:hingeX),Y(yy),W2(6),W2(4)); }                           // hinges
    ctx.restore();
  }
  function drawTrap(t){
    const x0=t.c0*T, x1=(t.c1+1)*T, y=t.r*T, w=x1-x0, half=w/2, sh=t.shake>0?(Math.random()-0.5)*3:0;
    const k=t.st==='shut'?0:t.st==='open'?1:Math.min(1,t.t/22), e=k<1?1-Math.pow(1-k,2):1;
    const down=t.dir==='down';
    ctx.save();
    if(k>0){ const two=t.id==='attic'; ctx.fillStyle='rgba(6,4,2,0.85)'; ctx.fillRect(X(x0),Y(y-(two?T:0)),W2(w),W2(two?2*T:T)); }   // the hole (the attic's goes through the roof floor too)
    // two leaves: each turns on its outer hinge, the left one away down-left (or up-left), the right one down-right
    for(const s of [-1,1]){
      const hx=s<0?x0:x1, ang=e*Math.PI*0.5*(down?1:-1);
      ctx.save(); ctx.translate(X(hx),Y(y+(down?2:T-2))+sh); ctx.rotate(s<0?ang:-ang);
      // (Paulo, Nov 13: two leaves facing each other) each leaf stops 2 px short of the middle: a dark seam between them
      const lw=half-2, lx=s<0?0:-lw;
      ctx.fillStyle=s<0?'#7a4e2c':'#845632'; ctx.fillRect(W2(lx),W2(-7),W2(lw),W2(14));
      ctx.fillStyle='rgba(30,16,6,0.6)'; for(let q=10;q<lw;q+=16) ctx.fillRect(W2(lx+q),W2(-7),Math.max(1,W2(1.5)),W2(14));
      ctx.fillStyle='#2a1a0c'; ctx.fillRect(W2(lx),W2(-7),W2(lw),Math.max(1,W2(2))); ctx.fillRect(W2(lx),W2(5),W2(lw),Math.max(1,W2(2)));
      ctx.strokeStyle='#1a0e06'; ctx.lineWidth=Math.max(1,W2(2)); ctx.strokeRect(W2(lx),W2(-7),W2(lw),W2(14));
      ctx.fillStyle='#3a3430'; ctx.fillRect(W2(s<0?0:-16),W2(-8),W2(16),W2(16));                                          // the hinge plate at its outer end
      ctx.fillStyle='#8a8070'; ctx.beginPath(); ctx.arc(W2(s<0?5:-5),0,Math.max(1.5,W2(2.5)),0,Math.PI*2); ctx.fill();
      const rx=s<0?lw-9:-lw+9;                                                                                        // an iron ring handle by the seam
      ctx.strokeStyle='#c8a050'; ctx.lineWidth=Math.max(1,W2(2)); ctx.beginPath(); ctx.arc(W2(rx),W2(down?3:-3),Math.max(2,W2(4)),0,Math.PI*2); ctx.stroke();
      ctx.restore();
    }
    if(k===0){ ctx.fillStyle='#0a0603'; ctx.fillRect(X(x0+half-2),Y(y+(down?-5:T-9)),W2(4),W2(14)); }                   // the seam where the two leaves meet
    if(t.st==='shut'&&t.hits>0){ ctx.fillStyle='rgba(255,230,180,0.5)'; for(let i=0;i<t.hits;i++) ctx.fillRect(X(x0+half-12+i*10),Y(y+(down?-4:T)),W2(6),W2(3)); }   // cracks: how many hits so far
    ctx.restore();
  }
  function stuffAt(kind,tx,ty){
    if(kind==='books'){ for(const [o,c] of [[-8,'#a03030'],[-3,'#3060a0'],[2,'#c09030'],[7,'#407040']]){ ctx.fillStyle=c; ctx.fillRect(X(tx+o),Y(ty-9),W2(4),W2(9)); } }
    else if(kind==='pots'){ ctx.fillStyle='#606870'; ctx.beginPath(); ctx.arc(X(tx),Y(ty-3),W2(7),Math.PI,0); ctx.fill(); ctx.fillRect(X(tx+6),Y(ty-6),W2(8),W2(2)); }
    else if(kind==='spoons'){ ctx.strokeStyle='#c8ccd4'; ctx.lineWidth=Math.max(1,W2(1.5)); for(const o of [-5,0,5]){ ctx.beginPath(); ctx.moveTo(X(tx+o),Y(ty)); ctx.lineTo(X(tx+o+o*0.4),Y(ty-12)); ctx.stroke(); } }
    else if(kind==='teddy'){ ctx.fillStyle='#a0703c'; ctx.beginPath(); ctx.arc(X(tx),Y(ty-6),W2(6),0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(X(tx-5),Y(ty-11),W2(2.5),0,Math.PI*2); ctx.arc(X(tx+5),Y(ty-11),W2(2.5),0,Math.PI*2); ctx.fill(); }
    else if(kind==='lamp'){ ctx.fillStyle='#d8c070'; ctx.fillRect(X(tx-2),Y(ty-14),W2(4),W2(14)); ctx.fillStyle='#e8d8a0'; ctx.beginPath(); ctx.moveTo(X(tx-7),Y(ty-14)); ctx.lineTo(X(tx+7),Y(ty-14)); ctx.lineTo(X(tx+4),Y(ty-22)); ctx.lineTo(X(tx-4),Y(ty-22)); ctx.fill(); }
    else if(kind==='plank'){ ctx.fillStyle='#8a5a30'; ctx.fillRect(X(tx-8),Y(ty-2),W2(16),W2(4)); }
  }
  function drawJunk(){ for(const j of S.junk||[]){ ctx.save(); ctx.translate(X(j.x),Y(j.y)); ctx.rotate(j.rot); ctx.translate(-X(j.x),-Y(j.y)); stuffAt(j.kind,j.x,j.y+3); ctx.restore(); } }
  function crate(k){
    const w=k.small?22:28, h=k.small?18:24, x=k.c*T+(k.shake>0?(Math.random()-0.5)*2:0), y=k.r*T-h;
    if(k.broken){ ctx.fillStyle='#6a4426'; for(let i=0;i<4;i++) ctx.fillRect(X(x+i*8),Y(k.r*T-4-(i%2)*2),W2(9),W2(3)); return; }
    ctx.fillStyle='#8a5a30'; ctx.fillRect(X(x),Y(y),W2(w),W2(h)); ctx.fillStyle='#5a3418'; ctx.fillRect(X(x),Y(y+h/2-1),W2(w),W2(2)); ctx.strokeStyle='#3a200c'; ctx.lineWidth=Math.max(1,W2(1.5)); ctx.strokeRect(X(x),Y(y),W2(w),W2(h));
    ctx.beginPath(); ctx.moveTo(X(x),Y(y)); ctx.lineTo(X(x+w),Y(y+h)); ctx.stroke();
    // what's poking out of it
    const tx=x+w/2, ty=y;
    if(k.stuff==='books'){ for(const [o,c] of [[-8,'#a03030'],[-3,'#3060a0'],[2,'#c09030'],[7,'#407040']]){ ctx.fillStyle=c; ctx.fillRect(X(tx+o),Y(ty-9),W2(4),W2(9)); } }
    else if(k.stuff==='pots'){ ctx.fillStyle='#606870'; ctx.beginPath(); ctx.arc(X(tx),Y(ty-3),W2(7),Math.PI,0); ctx.fill(); ctx.fillRect(X(tx+6),Y(ty-6),W2(8),W2(2)); }
    else if(k.stuff==='spoons'){ ctx.strokeStyle='#c8ccd4'; ctx.lineWidth=Math.max(1,W2(1.5)); for(const o of [-5,0,5]){ ctx.beginPath(); ctx.moveTo(X(tx+o),Y(ty)); ctx.lineTo(X(tx+o+o*0.4),Y(ty-12)); ctx.stroke(); } }
    else if(k.stuff==='teddy'){ ctx.fillStyle='#a0703c'; ctx.beginPath(); ctx.arc(X(tx),Y(ty-6),W2(6),0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(X(tx-5),Y(ty-11),W2(2.5),0,Math.PI*2); ctx.arc(X(tx+5),Y(ty-11),W2(2.5),0,Math.PI*2); ctx.fill(); }
    else if(k.stuff==='lamp'){ ctx.fillStyle='#d8c070'; ctx.fillRect(X(tx-2),Y(ty-14),W2(4),W2(14)); ctx.fillStyle='#e8d8a0'; ctx.beginPath(); ctx.moveTo(X(tx-7),Y(ty-14)); ctx.lineTo(X(tx+7),Y(ty-14)); ctx.lineTo(X(tx+4),Y(ty-22)); ctx.lineTo(X(tx-4),Y(ty-22)); ctx.fill(); }
    else if(k.stuff==='life'){ const g=0.4+0.3*Math.sin(fr*0.12); ctx.fillStyle='rgba(255,210,90,'+g+')'; for(let i=0;i<3;i++) ctx.fillRect(X(x+4+i*8),Y(y+h/2-3),W2(3),W2(2)); }   // light through the slats
  }
  function drawAttic(){
    const a=S.reveal; if(a<=0) return;
    ctx.save(); ctx.globalAlpha=a;
    for(const [c,r] of S.attic.cells){
      ctx.fillStyle=(c+r)%2?'#3a2618':'#33200f'; ctx.fillRect(X(c*T),Y(r*T),W2(T)+1,W2(T)+1);
      ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(X(c*T),Y(r*T+T-3),W2(T)+1,W2(3)); }
    // rafters along the slopes and the ridge beam
    ctx.strokeStyle='#22140a'; ctx.lineWidth=W2(6);
    ctx.beginPath(); ctx.moveTo(X(5*T),Y(18*T)); ctx.lineTo(X(15.5*T),Y(13*T)); ctx.lineTo(X(26*T),Y(18*T)); ctx.stroke();
    for(const c of [9,12,19,22]){ ctx.lineWidth=W2(4); ctx.beginPath(); ctx.moveTo(X(c*T),Y(13.5*T+Math.abs(c-15.5)*T*0.25)); ctx.lineTo(X(c*T),Y(18*T)); ctx.stroke(); }
    // a lantern hanging from the ridge, and its warm light
    const lx=15.5*T, ly=14.3*T, fl=0.85+0.15*Math.sin(fr*0.21)*Math.sin(fr*0.07);
    const g=ctx.createRadialGradient(X(lx),Y(ly),2,X(lx),Y(ly),W2(190)); g.addColorStop(0,'rgba(255,200,120,'+(0.35*fl)+')'); g.addColorStop(1,'rgba(255,200,120,0)');
    ctx.fillStyle=g; ctx.fillRect(X(lx-200),Y(ly-200),W2(400),W2(400));
    ctx.strokeStyle='#100804'; ctx.lineWidth=Math.max(1,W2(1)); ctx.beginPath(); ctx.moveTo(X(lx),Y(13*T)); ctx.lineTo(X(lx),Y(ly-6)); ctx.stroke();
    ctx.fillStyle='#ffd88a'; ctx.fillRect(X(lx-4),Y(ly-6),W2(8),W2(10));
    // cobwebs in the corners
    ctx.strokeStyle='rgba(220,220,230,0.35)'; ctx.lineWidth=Math.max(1,W2(0.8));
    for(const [cx,cy,s] of [[9.3*T,15.2*T,1],[21.7*T,15.2*T,-1]]){ for(let i=0;i<4;i++){ ctx.beginPath(); ctx.moveTo(X(cx),Y(cy)); ctx.lineTo(X(cx+s*(10+i*6)),Y(cy+18-i*4)); ctx.stroke(); } }
    for(const k of S.crates) crate(k);
    drawJunk();
    // dust motes in the lantern light
    for(let i=0;i<18;i++){ const t=(fr*0.004+hash(i,7))%1, mx=6.5*T+hash(i,8)*18*T+Math.sin(fr*0.01+i)*8, my=17.8*T-t*4.4*T; ctx.fillStyle='rgba(255,230,190,'+(0.5*(1-Math.abs(t-0.5)*2))+')'; ctx.fillRect(X(mx),Y(my),W2(2),W2(2)); }
    ctx.restore();
    // the extra life: a little battery-heart, bobbing in its glow
    const L=S.life; if(L&&!L.got){ const bob=Math.sin(fr*0.1)*4, x=X(L.x), y=Y(L.y-10+bob), r=W2(11);
      const gg=ctx.createRadialGradient(x,y,2,x,y,r*3.4); gg.addColorStop(0,'rgba(255,90,120,0.5)'); gg.addColorStop(1,'rgba(255,90,120,0)'); ctx.fillStyle=gg; ctx.fillRect(x-r*3.4,y-r*3.4,r*6.8,r*6.8);
      ctx.fillStyle='#ff4a6a'; ctx.beginPath(); ctx.moveTo(x,y+r); ctx.bezierCurveTo(x-r*1.6,y-r*0.2,x-r*0.7,y-r*1.4,x,y-r*0.5); ctx.bezierCurveTo(x+r*0.7,y-r*1.4,x+r*1.6,y-r*0.2,x,y+r); ctx.fill();
      ctx.fillStyle='#ffffff'; ctx.fillRect(x-W2(1),y-W2(4),W2(2),W2(6)); ctx.fillRect(x-W2(3),y-W2(2),W2(6),W2(2));
      if(typeof drawTextC==='function'&&L.t<200) drawTextC('1UP',x,y-r*2.4,'#ffe0e8',2); }
  }
  // the bedroom shelf under the hatch
  function drawShelf(){
    const y=22*T; ctx.fillStyle='#6a4024'; ctx.fillRect(X(13*T),Y(y),W2(7*T),W2(8)); ctx.fillStyle='#8a5a34'; ctx.fillRect(X(13*T),Y(y),W2(7*T),W2(3));
    for(const c of [13.4,19.4]){ ctx.fillStyle='#3a2414'; ctx.beginPath(); ctx.moveTo(X(c*T),Y(y+8)); ctx.lineTo(X(c*T+14),Y(y+8)); ctx.lineTo(X(c*T),Y(y+22)); ctx.fill(); }
    const books=[['#a03030',14],['#3060a0',12],['#c09030',15],['#406a40',11],['#7a3a7a',13]];
    let bx=14.2*T; for(const [c,h] of books){ ctx.fillStyle=c; ctx.fillRect(X(bx),Y(y-h),W2(6),W2(h)); bx+=8; }
    ctx.fillStyle='#c8b090'; ctx.beginPath(); ctx.arc(X(18.3*T),Y(y-6),W2(6),0,Math.PI*2); ctx.fill();   // a globe on the shelf
  }
  // the life around the Knowl tree: roots of light, vines from the cave roof, flowers, rising motes
  function treeLife(){
    const tree=(B.decor||[]).find(d=>d.kind==='tree'); if(!tree) return;
    const tx=tree.x+T/2, ty=tree.y, pulse=0.5+0.5*Math.sin(fr*0.05);
    if(typeof inView==='function'&&false) return;
    ctx.save(); ctx.globalCompositeOperation='lighter';
    // roots of light running out from the trunk along the floor and up the walls
    for(let i=0;i<9;i++){
      const dir=i%2?1:-1, len=(4+hash(i,1)*7)*T, up=hash(i,2)*2.5*T, ph=(fr*0.012+hash(i,3))%1;
      ctx.strokeStyle='rgba(120,255,200,'+(0.18+0.12*pulse)+')'; ctx.lineWidth=W2(3+hash(i,4)*3);
      ctx.beginPath(); ctx.moveTo(X(tx),Y(ty-4)); ctx.quadraticCurveTo(X(tx+dir*len*0.5),Y(ty-2+hash(i,5)*8),X(tx+dir*len),Y(ty-4-up)); ctx.stroke();
      const qx=tx+dir*len*ph, qy=ty-4-up*ph*ph;                                                         // a pulse of light travelling out along it
      const g=ctx.createRadialGradient(X(qx),Y(qy),0,X(qx),Y(qy),W2(14)); g.addColorStop(0,'rgba(190,255,220,0.7)'); g.addColorStop(1,'rgba(190,255,220,0)'); ctx.fillStyle=g; ctx.fillRect(X(qx-14),Y(qy-14),W2(28),W2(28));
    }
    ctx.globalCompositeOperation='source-over';
    // vines hanging from the cave's roof over the tree, glowing at the tips
    for(let i=0;i<22;i++){
      const vx=tx+(hash(i,11)-0.5)*20*T; let c=Math.floor(vx/T), r=Math.floor((ty-3*T)/T), k=0;
      while(r>34&&!(typeof gridSolid==='function'&&gridSolid(c,r-1))&&k<20){ r--; k++; }
      if(k>=20) continue;
      const top=r*T, len=40+hash(i,12)*120, sway=Math.sin(fr*0.02+i)*6;
      ctx.strokeStyle='#2a6a3a'; ctx.lineWidth=W2(2.2); ctx.beginPath(); ctx.moveTo(X(vx),Y(top)); ctx.quadraticCurveTo(X(vx+sway*0.5),Y(top+len*0.5),X(vx+sway),Y(top+len)); ctx.stroke();
      for(let q=12;q<len;q+=14){ const lx=vx+sway*(q/len); ctx.fillStyle=q%28?'#3a8a4a':'#4aa85a'; ctx.fillRect(X(lx+(q%28?2:-6)),Y(top+q),W2(5),W2(3)); }
      const glow=0.5+0.5*Math.sin(fr*0.07+i*1.7); ctx.fillStyle='rgba(150,255,210,'+(0.5+0.5*glow)+')'; ctx.beginPath(); ctx.arc(X(vx+sway),Y(top+len+3),W2(2.5+glow*1.5),0,Math.PI*2); ctx.fill();
    }
    // flowers and glowing moss on the floor round the tree
    for(let i=0;i<26;i++){ const fx=tx+(hash(i,21)-0.5)*22*T, b=0.5+0.5*Math.sin(fr*0.06+i*2.1);
      ctx.fillStyle='#2e6a3a'; ctx.fillRect(X(fx),Y(ty-8),W2(2),W2(8));
      ctx.fillStyle=i%3?'rgba(140,255,200,'+(0.55+0.4*b)+')':'rgba(255,190,240,'+(0.55+0.4*b)+')'; ctx.beginPath(); ctx.arc(X(fx+1),Y(ty-9),W2(2.5+b),0,Math.PI*2); ctx.fill(); }
    // life motes rising off the tree
    for(let i=0;i<30;i++){ const t=(fr*0.003+hash(i,31))%1, mx=tx+(hash(i,32)-0.5)*14*T+Math.sin(fr*0.02+i)*14, my=ty-t*14*T;
      ctx.fillStyle='rgba(170,255,220,'+(0.65*Math.sin(t*Math.PI))+')'; ctx.fillRect(X(mx),Y(my),W2(2.5),W2(2.5)); }
    ctx.restore();
  }
  S.over=function(){
    if(!on()||S.lv!==B.level) return;
    try{ treeLife(); }catch(e){}
    try{ drawShelf(); }catch(e){}
    for(const t of S.traps) if(t.id!=='attic'||S.reveal<1||t.st!=='shut') drawTrap(t);
    try{ drawAttic(); }catch(e){}
    for(const d of S.doors) drawDoor(d);
  };
})();
