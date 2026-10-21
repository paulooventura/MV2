// ============================================================
//  beta_crates.js — item boxes you have to break open (Paulo, Oct 21)
//
//  Every item box (the XLR / MAG / TRS drops, the RCA crate, the Isolator)
//  is a crate of wooden pallets. Punch it (or shoot it with the TRS) until
//  it breaks: planks and splinters fly and the item drops out loose. The
//  item is not collected by breaking the box — it is a little physical
//  object: the hit that breaks the box pops it out (harder hit, farther),
//  more punches knock it around, and MIND picks it up by touching it.
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B) return;
  const T=32;
  const on=()=>B.on&&typeof p!=='undefined'&&p&&_gameState==='game';
  const S=(n,v)=>{ try{ sfx(n,v); }catch(e){} };
  const CR={HP:100, PUNCH:34, PUNCH_LOADED:100, LASER:50, LASER_LOADED:100, W:46, H:40,
            GRAV:0.45, BOUNCE:0.35, FRIC:0.82, KNOCK:5.5, KNOCK_LOADED:10};
  B.CRATE=CR;

  // the crate sources, normalized: {o, idx, enh, cx, bottom}
  function list(){
    const out=[];
    if(typeof ITEM_DROPS!=='undefined') for(const d of ITEM_DROPS) if(!d.got) out.push({o:d, idx:d.item, enh:!!d.enhanced, cx:d.x+d.w/2, bottom:d.y+d.h});
    const r=typeof _mapRopePickup!=='undefined'?_mapRopePickup:null;
    if(r&&!r.got&&!(typeof _itemUnlocked==='function'&&_itemUnlocked(1))) out.push({o:r, idx:1, enh:false, cx:r.x+r.w/2, bottom:r.y+r.h});
    const iso=B.isoPickup; if(iso&&!iso.got) out.push({o:iso, idx:4, enh:false, cx:iso.x, bottom:iso.y});
    return out;
  }
  function box(c){
    if(!c.o._box) c.o._box={hp:CR.HP, broken:false, shake:0, glow:0, item:null};
    return c.o._box;
  }
  const rectOf=c=>({x:c.cx-CR.W/2, y:c.bottom-CR.H, w:CR.W, h:CR.H});
  B.crateList=list;

  // where the loose item can be picked up (null while it's still boxed)
  B.crateRect=function(o){
    if(!B.on) return null;
    const b=o&&o._box;
    if(!b||!b.broken||!b.item) return null;
    const it=b.item; if(it.noPick>0) return null;                // just knocked loose: it flies first
    return {x:it.x-18, y:it.y-14, w:36, h:28};
  };
  B.crateLocked=o=>B.on&&!(o&&o._box&&o._box.broken);

  // ── the world the loose item bounces around in ──────────────────
  function solid(x,y){
    if(typeof gridWorldSolid!=='function') return false;
    if(gridWorldSolid(x,y)) return true;
    const c=Math.floor(x/T), r=Math.floor(y/T);
    if(typeof gridIsSlope==='function'&&gridIsSlope(c,r)){ const sy0=gridSlopeY(c,r,x); return sy0!=null&&y>=sy0; }
    if(typeof gridCell==='function'&&typeof MV_GRID_ONEWAY!=='undefined'&&gridCell(c,r)===MV_GRID_ONEWAY) return (y-r*T)<6;
    return false;
  }
  function itemTick(it){
    if(it.noPick>0) it.noPick--;
    const wet=B.inWater&&B.inWater(it.x,it.y);
    it.vy=Math.min(it.vy+(wet?0.08:CR.GRAV),wet?1.2:12);
    // horizontal
    const nx=it.x+it.vx;
    if(solid(nx+Math.sign(it.vx||1)*16,it.y-4)){ it.vx*=-0.4; if(Math.abs(it.vx)>1.5) S('wood_tap'); } else it.x=nx;
    // vertical
    const ny=it.y+it.vy;
    if(it.vy>0&&solid(it.x,ny+10)){
      let y=ny; for(let k=0;k<24&&solid(it.x,y+10);k++) y-=1;
      it.y=y;
      if(it.vy>2.5){ it.vy*=-CR.BOUNCE; S('item_clink'); it.vr*=0.6; }
      else{ it.vy=0; it.og=true; }
      it.vx*=CR.FRIC; it.vr=it.vx*0.06;
      if(Math.abs(it.vx)<0.05) it.vx=0;
    }else if(it.vy<0&&solid(it.x,ny-12)){ it.vy=0.5; }
    else{ it.y=ny; it.og=false; }
    it.rot+=it.vr;
    if(it.og){ const tgt=Math.round(it.rot/Math.PI)*Math.PI; it.rot+=(tgt-it.rot)*0.15; }   // settles flat
  }

  // ── wood: planks and splinters ──────────────────────────────────
  const chips=[];
  const WOOD=['#5a3418','#7a4a22','#a06a38','#b47a40','#c88a4a','#3a200c'];
  function splinter(x,y,n,force,ang){
    for(let i=0;i<n;i++){
      const a=(ang!=null&&Math.random()<0.6?ang+(Math.random()-0.5)*1.6:Math.random()*Math.PI*2), s=(1.5+Math.random()*4)*force;
      const plank=Math.random()<0.35;
      chips.push({x:x+(Math.random()-0.5)*30, y:y+(Math.random()-0.5)*26, vx:Math.cos(a)*s, vy:Math.sin(a)*s-2.5*force,
        w:plank?14+Math.random()*12:3+Math.random()*5, h:plank?4+Math.random()*2:2+Math.random()*3,
        rot:Math.random()*6.3, vr:(Math.random()-0.5)*0.4, life:170+Math.random()*90|0, t:0,
        col:WOOD[(Math.random()*WOOD.length)|0], og:false});
    }
    if(chips.length>260) chips.splice(0,chips.length-260);
  }
  function chipTick(){
    for(let i=chips.length-1;i>=0;i--){
      const c=chips[i];
      if(++c.t>c.life){ chips.splice(i,1); continue; }
      c.vy=Math.min(c.vy+0.4,11);
      const nx=c.x+c.vx; if(solid(nx,c.y)){ c.vx*=-0.35; } else c.x=nx;
      const ny=c.y+c.vy;
      if(c.vy>0&&solid(c.x,ny+c.h/2)){ c.vy=c.vy>2?-c.vy*0.3:0; c.vx*=0.7; c.vr*=0.5; c.og=true;
        const tgt=Math.round(c.rot/Math.PI)*Math.PI; c.rot+=(tgt-c.rot)*0.3; }
      else{ c.y=ny; c.og=false; c.rot+=c.vr; }
    }
  }

  // ── damage ──────────────────────────────────────────────────────
  // amount: hit points taken off; ang/force: the direction and strength of the hit
  function damage(c,amount,ang,force,kind){
    const b=box(c);
    if(b.broken){                                   // it's the loose item that got hit
      const it=b.item; if(!it) return;
      it.noPick=Math.max(it.noPick||0,18);
      it.vx+=Math.cos(ang)*force; it.vy+=Math.sin(ang)*force-2.5-force*0.25; it.vr+=(Math.cos(ang)>=0?1:-1)*0.25*force/5; it.og=false;
      S('item_clink'); return;
    }
    b.hp=Math.max(0,b.hp-amount); b.glow=14; b.shake=Math.min(8,3+amount/12);
    const R=rectOf(c);
    splinter(c.cx,R.y+R.h/2,3+Math.round(amount/12),0.7,ang);
    if(b.hp>0){ S('wood_hit'); return; }
    // broken: the box falls apart and the item pops out — the harder the hit, the farther
    b.broken=true;
    splinter(c.cx,R.y+R.h/2,26,1.15,ang);
    S('wood_break'); S('ping');
    if(B.shake!=null) B.shake=Math.max(B.shake||0,4);
    const over=force;                                    // the strength of the breaking hit
    b.item={x:c.cx, y:c.bottom-CR.H/2, vx:Math.cos(ang)*over*0.75, vy:-3-Math.max(0,-Math.sin(ang))*over*0.6-over*0.15,
            rot:0, vr:(Math.cos(ang)>=0?1:-1)*0.12*(1+over/5), og:false, noPick:32};
    if(B.crateCells&&c.o._cell) B.crateCells.delete(c.o._cell);   // it no longer holds up a cube
  }
  B.damageCrate=damage;

  // the punch (render.js): returns true when it hit a box or a loose item
  window._punchCrates=function(wx,wy,wr,ang,charged,shX,shY){
    if(!on()) return false;
    for(const c of list()){
      const b=box(c);
      let hx,hy,hw,hh;
      // a straight punch is at shoulder height: let it reach down onto a low box / an item on the floor
      if(b.broken&&b.item){ hx=b.item.x-20; hy=b.item.y-50; hw=40; hh=64; }
      else{ const R=rectOf(c); hx=R.x; hy=R.y-34; hw=R.w; hh=R.h+34; }
      if(!(wx+wr>hx&&wx-wr<hx+hw&&wy+wr>hy&&wy-wr<hy+hh)) continue;
      // Paulo (Oct 21): never through a wall — the line from the shoulder must reach the REAL box
      // (not the generous punch area), so a crate walled in by blocks can't be hit until they're gone
      const real=b.broken&&b.item?{x:b.item.x-18,y:b.item.y-14,w:36,h:28}:rectOf(c);
      const tx=Math.max(real.x,Math.min(real.x+real.w,wx)), ty=Math.max(real.y,Math.min(real.y+real.h,wy));
      if(typeof _punchReach==='function'&&shX!=null&&!_punchReach(shX,shY,tx,ty,real)) continue;
      damage(c, charged?CR.PUNCH_LOADED:CR.PUNCH, ang, charged?CR.KNOCK_LOADED:CR.KNOCK, 'punch');
      return true;
    }
    return false;
  };

  function tick(){
    if(!on()) return;
    chipTick();
    const L=list();
    for(const c of L){
      const b=c.o._box; if(!b) continue;
      if(b.shake>0) b.shake*=0.75;
      if(b.glow>0) b.glow--;
      if(b.broken&&b.item) itemTick(b.item);
    }
    // a picked-up item / a regrown isolator crate starts over as a fresh box
    const iso=B.isoPickup; if(iso&&iso.got) iso._box=null;
    if(typeof ITEM_DROPS!=='undefined') for(const d of ITEM_DROPS) if(d.got) d._box=null;
    // TRS shots break boxes too (and knock the loose item)
    const shots=(p&&p.shots)||[];
    for(let i=shots.length-1;i>=0;i--){
      const s=shots[i]; if(!s||s._fizzle) continue;
      for(const c of L){
        const b=box(c), R=b.broken&&b.item?{x:b.item.x-18,y:b.item.y-14,w:36,h:28}:rectOf(c);
        if(s.x>R.x&&s.x<R.x+R.w&&s.y>R.y&&s.y<R.y+R.h){
          damage(c, s.charged?CR.LASER_LOADED:CR.LASER, Math.atan2(s.vy||0,s.vx||1), s.charged?8:5, 'laser');
          try{ if(typeof spawnHitBurst==='function') spawnHitBurst(s.x,s.y,s.vx,s.vy,'#ffcc66',10); }catch(e){}
          shots.splice(i,1); break;
        }
      }
    }
  }
  B.crateTick=tick;

  // ── drawing ─────────────────────────────────────────────────────
  // A crate of wooden pallets: dark frame, slats with gaps, nail heads.
  function drawPallet(c){
    const b=box(c), R=rectOf(c), dmg=1-b.hp/CR.HP;
    const jx=b.shake>0.3?(Math.random()-0.5)*b.shake:0, jy=b.shake>0.3?(Math.random()-0.5)*b.shake*0.5:0;
    const X=v=>sx(v+jx), Y=v=>sy(v+jy), Wd=v=>sw(v);
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(sx(c.cx),sy(c.bottom),sw(24),sw(3),0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#2a1608'; ctx.fillRect(X(R.x+3),Y(R.y+3),Wd(R.w-6),Wd(R.h-6));               // dark inside (seen through the gaps)
    // horizontal slats with gaps
    const slats=4, sh=(R.h-4)/slats;
    for(let i=0;i<slats;i++){
      const y=R.y+2+i*sh, broken=dmg>0.35&&i===1||dmg>0.65&&i===3;
      ctx.fillStyle=i%2?'#a06a38':'#b47a40';
      if(broken){ ctx.fillRect(X(R.x+2),Y(y),Wd(R.w*0.45),Wd(sh-3)); ctx.fillRect(X(R.x+R.w*0.62),Y(y+1),Wd(R.w*0.36),Wd(sh-3)); }
      else ctx.fillRect(X(R.x+2),Y(y),Wd(R.w-4),Wd(sh-3));
      ctx.fillStyle='rgba(255,230,180,0.25)'; ctx.fillRect(X(R.x+2),Y(y),Wd(R.w-4),Wd(1.2));
      ctx.fillStyle='rgba(60,30,10,0.35)'; for(let g=0;g<3;g++) ctx.fillRect(X(R.x+6+g*13+(i*5)%9),Y(y+sh*0.45),Wd(6),Wd(0.8));   // grain
    }
    // uprights + diagonal brace (pallet frame)
    ctx.fillStyle='#6a3e1a';
    ctx.fillRect(X(R.x),Y(R.y),Wd(5),Wd(R.h)); ctx.fillRect(X(R.x+R.w-5),Y(R.y),Wd(5),Wd(R.h)); ctx.fillRect(X(R.x+R.w/2-2.5),Y(R.y),Wd(5),Wd(R.h));
    ctx.fillRect(X(R.x),Y(R.y),Wd(R.w),Wd(3)); ctx.fillRect(X(R.x),Y(R.y+R.h-3),Wd(R.w),Wd(3));
    ctx.fillStyle='#c8ccd4'; for(const [ox,oy] of [[2.5,2],[R.w-2.5,2],[2.5,R.h-2],[R.w-2.5,R.h-2],[R.w/2,R.h/2]]){ ctx.beginPath(); ctx.arc(X(R.x+ox),Y(R.y+oy),Wd(1.3),0,Math.PI*2); ctx.fill(); }
    // cracks as it takes damage
    if(dmg>0.05){
      ctx.strokeStyle='rgba(20,8,0,0.85)'; ctx.lineWidth=Wd(1.4);
      ctx.beginPath(); ctx.moveTo(X(R.x+10),Y(R.y+6)); ctx.lineTo(X(R.x+18),Y(R.y+16)); ctx.lineTo(X(R.x+14),Y(R.y+26));
      if(dmg>0.4){ ctx.moveTo(X(R.x+30),Y(R.y+4)); ctx.lineTo(X(R.x+26),Y(R.y+18)); ctx.lineTo(X(R.x+36),Y(R.y+30)); }
      ctx.stroke();
    }
    if(b.glow>0){ ctx.fillStyle='rgba(255,240,210,'+(b.glow/14*0.35).toFixed(3)+')'; ctx.fillRect(X(R.x),Y(R.y),Wd(R.w),Wd(R.h)); }
    ctx.restore();
  }
  // the loose item: the jack itself (or the Isolator ring), glowing so it reads as a pickup
  const NAMES=['TRS','RCA','XLR','MAG','ISOLATOR'];
  function drawItem(c){
    const it=box(c).item; if(!it) return;
    const D=window.MV_BETA_DECOR;
    if(D&&D.glow) D.glow(it.x,it.y,40,0.3+0.1*Math.sin(fr*0.1),c.idx===4?'rgba(255,150,60,':c.enh?'rgba(80,255,150,':'rgba(255,230,160,');
    ctx.save(); ctx.translate(sx(it.x),sy(it.y)); ctx.rotate(it.rot);
    if(c.idx===4){ if(D&&D.isolatorIcon) D.isolatorIcon(0,0,0.55*sw(10)/10); }
    else{ const k=0.7*sw(10)/10; ctx.scale(k,k); if(typeof drawConnectorTip==='function') drawConnectorTip(c.idx===3?-14:-16,0,0,0,c.idx,c.enh); }
    ctx.restore();
    if(it.og) (B.wtext||((f,...a)=>f(...a)))(drawTextC, NAMES[c.idx]||'?', sx(it.x), sy(it.y+16), c.enh?'#7dffcf':'#ffe8b0', 1);
  }
  B.drawCrate=function(o){
    const c=list().find(q=>q.o===o); if(!c) return;
    if(box(c).broken) drawItem(c); else drawPallet(c);
  };
  B.drawCrateChips=function(){
    if(!on()||!chips.length) return;
    ctx.save();
    for(const c of chips){
      const a=Math.min(1,(c.life-c.t)/40);
      ctx.globalAlpha=a; ctx.fillStyle=c.col;
      ctx.save(); ctx.translate(sx(c.x),sy(c.y)); ctx.rotate(c.rot); ctx.fillRect(-sw(c.w)/2,-sw(c.h)/2,sw(c.w),sw(c.h));
      ctx.fillStyle='rgba(255,230,180,0.3)'; ctx.fillRect(-sw(c.w)/2,-sw(c.h)/2,sw(c.w),Math.max(1,sw(c.h)*0.3)); ctx.restore();
    }
    ctx.restore();
  };
})();
