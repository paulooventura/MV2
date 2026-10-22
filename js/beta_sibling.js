// ============================================================
//  beta_sibling.js — the sibling who shadows you (Paulo, Oct 22)
//
//  "we should be able to choose if we wanna go solo, or have our sibling
//   shadowing us, and assisting. The AI on the support character has to be
//   really clever, and non invasive."
//
//  Chosen on the character select (SOLO / SIBLING SHADOWS YOU, ↑↓ there).
//  How the sibling behaves:
//   · It walks YOUR path, a beat behind (a trail of where you've been — so it
//     never gets stuck, never needs its own pathfinding, and goes wherever you
//     went: ledges, water, ropes). When you stop it stops a little behind you,
//     never in front, never on top of you. It's a ghost to everything: it
//     doesn't push you, block enemies, move blocks, take seeds, crystals,
//     crates or items, open arches or trip anything.
//   · Lost (a respawn, a stage change, a long fall) it blinks back beside you.
//   · It watches for trouble: the enemy that is coming for YOU (closest to you,
//     heading your way, in clear line of sight) — its eye follows it, and it
//     fires bolts from its jack at it. Assist, not steal: a bolt never takes an
//     enemy's last bit of power unless that enemy is right on top of you or
//     you're hurting (HP under 40%) — then it finishes it. It never fires
//     through rock, never across you, and slows down when nothing's urgent.
//   · Can't be hurt (enemies pass through it); it never costs you anything.
//  Oct 22 (later): it RESONATES with you — when you start breaking blocks it
//  joins in on the block you're working on — and it is always proactive about
//  threats: any enemy near you gets attacked at full strength, and it moves to
//  your side facing the danger (when there's floor there) to cover you.
//  SOLO: the other sibling stays home — it potters around the house like Laitu
//  does in hers (walks the floor it's on, stops, looks at you when you're near).
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B) return;
  const KEY='mv2.sibling';
  const read=()=>{ try{ const v=localStorage.getItem(KEY); return v==null?true:v==='1'; }catch(e){ return true; } };
  let on=read();
  let ff=(()=>{ try{ return localStorage.getItem(KEY+'.ff')==='1'; }catch(e){ return false; } })();
  window.MV_SIBLING={ get on(){ return on; }, set on(v){ on=!!v; try{ localStorage.setItem(KEY,on?'1':'0'); }catch(e){} }, toggle(){ this.on=!on; },
    get ff(){ return ff; }, set ff(v){ ff=!!v; try{ localStorage.setItem(KEY+'.ff',ff?'1':'0'); }catch(e){} },   // friendly fire
    state:()=>S, npc:()=>npc&&npc.s };
  const labOk=()=>!window.MV_BETA_LAB||/[?&]sib=1/.test(location.search);
  const DELAY=24, KEEP=220, MIN_GAP=62, LOST=560;
  let S=null, trail=[], bolts=[], lastLevel=null, lastHero=null;

  function active2(){ return B.on&&B.level&&typeof p!=='undefined'&&p&&_gameState==='game'&&!B.trans&&!B.results; }
  function active(){ return on&&labOk()&&B.on&&B.level&&typeof p!=='undefined'&&p&&_gameState==='game'&&!B.trans&&!B.results&&!(typeof _paused!=='undefined'&&_paused); }
  function spawn(){
    S=mkP(); S._aiCompanion=true; S._betaSib=true;
    S.hero=p.hero==='venture'?'mind':'venture';
    S.x=p.x-(p.fc?1:-1)*MIN_GAP; S.y=p.y; S.fc=p.fc; S.og=true; S.hp=S.maxHp;
    S._shotCd=40; trail.length=0; bolts.length=0; S._blink=12;
    lastLevel=B.level; lastHero=p.hero;
  }
  const centre=pl=>({x:pl.x+SW/2, y:pl.y+FEET_OFF-STAND_H*0.45});
  function clearLine(x0,y0,x1,y1){
    const n=Math.ceil(Math.hypot(x1-x0,y1-y0)/14);
    for(let i=1;i<n;i++){ const t=i/n; if(typeof gridWorldSolid==='function'&&gridWorldSolid(x0+(x1-x0)*t,y0+(y1-y0)*t)) return false; }
    return true;
  }
  // the enemy that matters to YOU: alive, visible, nearest you (and closing in counts double)
  function pickThreat(){
    const P=centre(p), me=centre(S); let best=null, bs=1e9;
    for(const e of (typeof ENEMS!=='undefined'?ENEMS:[])){
      if(!e||!e.alive||e._hidden||e._betaHeld||e._spawnFx>0) continue;
      const ex=e.x+(e.w||0)/2, ey=e.y+(e.h||0)/2, dP=Math.hypot(ex-P.x,ey-P.y);
      if(dP>360) continue;
      const closing=((P.x-ex)*(e.vx||0)+(P.y-ey)*(e.vy||0))>0;
      const score=dP*(closing?0.6:1);
      if(score<bs&&clearLine(me.x,me.y-6,ex,ey)){ bs=score; best={e,ex,ey,dP}; }
    }
    return best;
  }
  function follow(){
    // record where YOU have been (only when you move, so standing still parks the sibling)
    const last=trail[trail.length-1];
    if(!last||Math.hypot(p.x-last.x,p.y-last.y)>1.2) trail.push({x:p.x,y:p.y,fc:p.fc,og:!!p.og,ca:p.crouchAmt||0});
    if(trail.length>KEEP) trail.splice(0,trail.length-KEEP);
    // the point a beat behind on your path; never closer than MIN_GAP to you
    let i=Math.max(0,trail.length-1-DELAY);
    while(i>0&&Math.hypot(trail[i].x-p.x,trail[i].y-p.y)<MIN_GAP) i--;
    let T=trail[i];
    if(!T||Math.hypot(T.x-p.x,T.y-p.y)<MIN_GAP*0.8){                // no path behind you yet: just beside you, on your back side
      const bx=p.x-(p.fc?1:-1)*MIN_GAP;
      T={x:(typeof gridWorldSolid==='function'&&gridWorldSolid(bx+SW/2,p.y+FEET_OFF-30))?p.x:bx, y:p.y, fc:p.fc, og:!!p.og, ca:p.crouchAmt||0};
    }
    const cov=coverSpot(S._threat);
    if(cov) T={x:cov.x,y:cov.y,fc:S._threat.ex>cov.x+SW/2,og:true,ca:0};
    const x0=S.x, y0=S.y;
    if(Math.hypot(S.x-p.x,S.y-p.y)>LOST||B.level!==lastLevel||(last&&Math.hypot(p.x-last.x,p.y-last.y)>LOST)){   // lost: a respawn, a stage change, a teleport
      trail.length=0; trail.push({x:p.x,y:p.y,fc:p.fc,og:!!p.og,ca:0}); lastLevel=B.level;
      blinkTo({x:p.x-(p.fc?1:-1)*MIN_GAP,y:p.y}); return;
    }
    // Paulo (Oct 22): "it should be able to float around JUST to be around us — using its items".
    // You're on the move or in the air: it hovers at your back shoulder on its XLR (jack down,
    // air pushing out of it), out of your way — never in front of you or in your line of aim,
    // never inside a wall. You stop on the ground: it settles on the floor behind you.
    const rope=p.hook&&p.hook.st==='on';
    const settle=!cov&&p.og&&Math.abs(p.vx||0)<1.2&&!rope;
    if(!cov&&!settle){
      const back=p.fc?-1:1, bob=Math.sin(fr*0.06)*5;
      const cand=[[back*74,-54+bob],[back*60,-92+bob],[-back*74,-62+bob],[0,-118+bob]];
      const ax=p.aimDX||0, ay=p.aimDY||0, al=Math.hypot(ax,ay)||1;
      for(const [ox,oy] of cand){
        const hx=p.x+ox, hy=p.y+oy, d=Math.hypot(ox,oy)||1;
        if(((ox*ax+oy*ay)/(d*al))>0.55&&(p.xlrOn||p.magOn||p.laserCharging||(p.hook&&p.hook.st!=='idle'))) continue;   // not in your line of fire
        if(typeof gridWorldSolid==='function'&&(gridWorldSolid(hx+SW/2,hy+FEET_OFF-20)||gridWorldSolid(hx+SW/2,hy+FEET_OFF-70)||gridWorldSolid(hx+SW/2,hy+FEET_OFF-110))) continue;   // not in rock
        T={x:hx,y:hy,fc:p.fc,og:false,ca:0}; break;
      }
    }
    const kk=S._catch>0?0.03:0.075+Math.min(0.17,Math.hypot(T.x-S.x,T.y-S.y)/900);   // stiffer the further behind it falls (it keeps up when you're fast)
    S._hvx=(S._hvx||0)*0.8+(T.x-S.x)*kk;
    S._hvy=(S._hvy||0)*0.8+(T.y-S.y)*kk;
    if(S._catch>0) S._catch--;
    if(T.og&&Math.hypot(T.x-S.x,T.y-S.y)<6){ S.x=T.x; S.y=T.y; S._hvx=S._hvy=0; }
    else{ S.x+=S._hvx; S.y+=S._hvy; }
    S.vx=S.x-x0; S.vy=S.y-y0; S.crouchAmt=(S.crouchAmt||0)+((T.ca||0)-(S.crouchAmt||0))*0.3;
    // in the air when there's no floor right under its wheel
    const feet=S.y+FEET_OFF, floor=typeof gridWorldSolid==='function'&&(gridWorldSolid(S.x+SW/2,feet+3)||gridWorldSolid(S.x+SW/2,feet+12));
    S.og=!!(T.og&&floor); S._flying=!S.og&&!rope;
    if(Math.abs(S.vx)>0.25) S.fc=S.vx>0; else if(Math.abs(S.vx)<0.05) S.fc=p.x+SW/2>S.x+SW/2;   // idle: it faces you
    if(S._flying){
      S.wheelAngle=(S.wheelAngle||0)+0.25*(S.fc?1:-1);
      if(!(S._shootT>0)&&!S._threat){ S.aimDX+=(S.vx*0.05-S.aimDX)*0.25; S.aimDY+=(1-S.aimDY)*0.25; }   // the jack points down: the XLR holds it up
      if(fr%3===0){ const tp=tipOf(S); PFXS.push({x:tp.x+(Math.random()-0.5)*6,y:tp.y+4,vx:(Math.random()-0.5)*1.2-S.vx*0.3,vy:2.2+Math.random()*1.6,life:12,maxLife:12,r:2.2,col:'#aaddff'}); }
    }else S.wheelAngle=(S.wheelAngle||0)+S.vx/WHEEL_R;
  }
  function blinkTo(T){
    for(let k=0;k<10;k++) PFXS.push({x:S.x+SW/2+(Math.random()-0.5)*30,y:S.y+FEET_OFF-40+(Math.random()-0.5)*40,vx:(Math.random()-0.5)*2,vy:-Math.random()*2,life:14,maxLife:14,r:2,col:S.hero==='venture'?'#ff6a7a':'#c49aff'});
    S.x=T.x; S.y=T.y; S._blink=12;
  }
  function assist(){
    const t=pickThreat(), me=centre(S); S._threat=t;
    S._shotCd=(S._shotCd||0)-1;
    if(!t){ S.aimDX+=((S.fc?1:-1)-S.aimDX)*0.2; S.aimDY*=0.8; S.pupilX=(S.pupilX||0)*0.8; S.pupilY=(S.pupilY||0)*0.8; helpBlock(null); return; }
    const dx=t.ex-me.x, dy=t.ey-me.y, d=Math.hypot(dx,dy)||1;
    S.aimDX+=(dx/d-S.aimDX)*0.35; S.aimDY+=(dy/d-S.aimDY)*0.35;
    if(Math.abs(dx)>6) S.fc=dx>0;
    if(S._shotCd>0) return;
    // never across you: skip the shot if you're between it and the target
    const P=centre(p), seg=((P.x-me.x)*dx+(P.y-me.y)*dy)/(d*d);
    if(seg>0&&seg<1&&Math.hypot(me.x+dx*seg-P.x,me.y+dy*seg-P.y)<26){ S._shotCd=8; return; }
    const urgent=t.dP<140||(p.hp||0)<(p.maxHp||100)*0.5;
    S._shotCd=urgent?14:24;
    const sp=11, tp=tipOf(S); S._shootT=40;
    bolts.push({x:tp.x,y:tp.y,vx:dx/d*sp,vy:dy/d*sp,e:t.e,life:50,urgent});
    for(let k=0;k<5;k++) PFXS.push({x:tp.x,y:tp.y,vx:dx/d*2+(Math.random()-0.5)*2,vy:dy/d*2+(Math.random()-0.5)*2,life:8,maxLife:8,r:1.8,col:S.hero==='venture'?'#ffb0b8':'#e0c8ff'});   // the muzzle flash at its jack
    S.fireRecoil=5; S.fireRecoilA=Math.atan2(dy,dx);
    try{ sfx('laser',S.hero==='venture'?1.25:1.4); }catch(e){}
  }
  function boltsTick(){
    for(let i=bolts.length-1;i>=0;i--){
      const b=bolts[i]; b.life--;
      const e=b.e;
      if(e&&e.alive){ const ex=e.x+(e.w||0)/2, ey=e.y+(e.h||0)/2, d=Math.hypot(ex-b.x,ey-b.y)||1; b.vx+=((ex-b.x)/d*10-b.vx)*0.12; b.vy+=((ey-b.y)/d*10-b.vy)*0.12; }   // a gentle homing
      b.x+=b.vx; b.y+=b.vy;
      if(b.bw){
        const w=b.bw; if(w.hp>0&&b.x>=w.x-2&&b.x<=w.x+(w.w||32)+2&&b.y>=w.y-2&&b.y<=w.y+(w.h||32)+2){
          sibHitFr=fr; if(typeof _damageBwall==='function') _damageBwall(w,'punch',{shakeX:Math.sign(b.vx)*2,shakeY:Math.sign(b.vy)*2}); fizz(b,true); bolts.splice(i,1); continue; }
        const cx=w.x+(w.w||32)/2, cy=w.y+(w.h||32)/2, d=Math.hypot(cx-b.x,cy-b.y)||1; b.vx+=((cx-b.x)/d*11-b.vx)*0.2; b.vy+=((cy-b.y)/d*11-b.vy)*0.2;
      }
      if(b.life<=0||(!b.bw&&typeof gridWorldSolid==='function'&&gridWorldSolid(b.x,b.y))){ fizz(b); bolts.splice(i,1); continue; }
      for(const en of (typeof ENEMS!=='undefined'?ENEMS:[])){
        if(!en||!en.alive||en._hidden) continue;
        if(b.x>=en.x&&b.x<=en.x+(en.w||0)&&b.y>=en.y&&b.y<=en.y+(en.h||0)){
          const dmg=b.urgent?12:9;                                       // always for real: it protects you
          if(typeof _damageEnemy==='function') _damageEnemy(en,dmg,b.x-b.vx*3,b.y-b.vy*3,0.45);
          fizz(b,true); bolts.splice(i,1); break;
        }
      }
    }
  }
  // ── resonance: the block you're breaking ──
  let sibHitFr=-99, blockT=null; const hpSeen=new WeakMap();
  function watchBlocks(){
    const P=centre(p);
    for(const w of (typeof BWALLS!=='undefined'?BWALLS:[])){
      if(!w) continue; const was=hpSeen.get(w); hpSeen.set(w,w.hp);
      if(was==null||w.hp>=was||w.hp<=0||fr-sibHitFr<3) continue;
      if(w.only==='push'||w.only==='pull'||w._carried||w._fly) continue;
      if(Math.hypot(w.x+(w.w||32)/2-P.x,w.y+(w.h||32)/2-P.y)<260) blockT={w,t:fr};   // you just hit it: help
    }
    if(blockT&&(blockT.w.hp<=0||fr-blockT.t>240)) blockT=null;               // broken, or you've moved on
  }
  function helpBlock(threat){
    if(threat||!blockT||S._shotCd>0) return;
    const w=blockT.w, me=centre(S), cx=w.x+(w.w||32)/2, cy=w.y+(w.h||32)/2;
    if(w.only==='laser') return;                                              // TRS-only blocks are yours
    const dx=cx-me.x, dy=cy-me.y, d=Math.hypot(dx,dy)||1; if(d>320) return;
    S.aimDX=dx/d; S.aimDY=dy/d; if(Math.abs(dx)>6) S.fc=dx>0;
    const tp=tipOf(S); S._shootT=40;
    S._shotCd=22; bolts.push({x:tp.x,y:tp.y,vx:dx/d*11,vy:dy/d*11,bw:w,life:45});
    S.fireRecoil=5; try{ sfx('laser',S.hero==='venture'?1.3:1.45); }catch(e){}
  }
  // ── cover: step to your side that faces the danger, when there's floor there ──
  function coverSpot(t){
    if(!t||!p.og||typeof gridWorldSolid!=='function') return null;
    const side=t.ex>p.x+SW/2?1:-1, x=p.x+side*58, feet=p.y+FEET_OFF;
    if(gridWorldSolid(x+SW/2,feet-30)||gridWorldSolid(x+SW/2,feet-60)) return null;            // a wall there
    if(!gridWorldSolid(x+SW/2,feet+4)&&!gridWorldSolid(x+SW/2,feet+20)) return null;            // no floor there
    return {x, y:p.y};
  }

  // ── SOLO: the other sibling at home, pottering about like Laitu ──
  let npc=null;
  function npcSpawn(){
    const home=(B.rooms||[]).find(r=>r.style==='home'); if(!home||typeof gridWorldSolid!=='function') return null;
    // the upper floor of the house (the bedroom): the first floor down from the room's top
    const floorAt=x=>{ for(let y=home.y+40;y<home.y+home.h+40;y+=4){ if(gridWorldSolid(x,y)) return y; } return null; };
    const mid=home.x+home.w*0.55, fy=floorAt(mid); if(fy==null) return null;
    let x0=mid, x1=mid;
    while(x0>home.x+40&&floorAt(x0-8)===fy&&!gridWorldSolid(x0-8,fy-40)) x0-=8;
    while(x1<home.x+home.w-40&&floorAt(x1+8)===fy&&!gridWorldSolid(x1+8,fy-40)) x1+=8;
    const s2=mkP(); s2._aiCompanion=true; s2._betaSib=true; s2.hero=p.hero==='venture'?'mind':'venture';
    s2.x=mid-SW/2; s2.y=fy-FEET_OFF; s2.og=true; s2.hp=s2.maxHp; s2.fc=Math.random()<0.5;
    return {s:s2, fy, minX:x0+10-SW/2, maxX:x1-10-SW/2, tx:null, wait:60, level:B.level};
  }
  function npcTick(){
    if(!npc||npc.level!==B.level||npc.s.hero===p.hero){ npc=npcSpawn(); if(!npc) return; }
    const s2=npc.s; s2.hp=s2.maxHp; const x0=s2.x;
    if(s2.flashF>0) s2.flashF--;
    if(typeof _updateBattleEye==='function') _updateBattleEye(s2);
    interact(s2);
    if(s2._downT>0){ s2._downT--; s2.crouchAmt=Math.min(1,(s2.crouchAmt||0)+0.1); if(s2.free>0) bodyPhysics(s2); if(s2._downT===0) s2.crouchAmt=0; return; }
    if(s2.free>0){ bodyPhysics(s2); npc.tx=null; npc.wait=40; return; }
    // walking: keep to the floor it stands on (turn at an edge or a wall)
    if(npc.tx!=null&&typeof gridWorldSolid==='function'){ const dir=Math.sign(npc.tx-s2.x)||1, fx=s2.x+SW/2+dir*26, feet=s2.y+FEET_OFF;
      if(!gridWorldSolid(fx,feet+6)||gridWorldSolid(fx,feet-36)){ npc.tx=null; npc.wait=60+Math.random()*120|0; } }
    if(!(npc.minX<npc.maxX)||Math.abs((s2.x)-(npc.minX+npc.maxX)/2)>400){ npc.minX=s2.x-160; npc.maxX=s2.x+160; }
    const P=centre(p), me=centre(s2), near=Math.hypot(P.x-me.x,P.y-me.y)<260;
    if(npc.wait>0){ npc.wait--; if(near) s2.fc=P.x>me.x; }
    else{
      if(npc.tx==null) npc.tx=npc.minX+Math.random()*(npc.maxX-npc.minX);
      const dx=npc.tx-s2.x;
      if(Math.abs(dx)<3){ npc.tx=null; npc.wait=90+Math.random()*200|0; }
      else{ s2.x+=Math.sign(dx)*Math.min(1.3,Math.abs(dx)); s2.fc=dx>0; }
    }
    if(typeof _movePlayerWithColl==='function'){ const nx=s2.x; s2.x=x0; s2.vy=Math.min((s2.vy||0)+GRAV,14); _movePlayerWithColl(s2,nx-x0,s2.vy); if(s2.og) s2.vy=0; }   // a body on the floor
    s2.vx=s2.x-x0; s2.wheelAngle=(s2.wheelAngle||0)+s2.vx/WHEEL_R;
    const dxp=P.x-me.x, dyp=P.y-me.y, dl=Math.hypot(dxp,dyp)||1;
    if(near&&!(typeof ENEMS!=='undefined'&&ENEMS.some(e=>e&&e.alive&&Math.hypot(e.x-s2.x,e.y-s2.y)<520))){ s2.pupilX=dxp/dl*2.5; s2.pupilY=dyp/dl*2; }   // it looks at you
    s2.aimDX=s2.fc?1:-1; s2.aimDY=0.4;
  }
  // ── its body has mass (Paulo, Oct 22): you can punch it, blow it away with the XLR, pull it
  //    with the MAG, shove it with your weight or land on it. Friendly fire ON also hurts it
  //    (it can be knocked out for a few seconds); OFF it just gets moved.
  function knock(b,vx,vy,kind,dmg){
    b.vx=vx; b.vy=vy; b.og=false; b.free=Math.max(b.free||0,46); b._prevLandFeet=b.y+FEET_OFF;
    if(ff&&dmg>0&&!(b._downT>0)){
      b.sibHp=(b.sibHp==null?100:b.sibHp)-dmg; b.flashF=14;
      try{ sfx('player_hit',1.35); }catch(e){}
      if(b.sibHp<=0){ b._downT=240; b.sibHp=100; try{ sfx('enemy_shut',1.2); }catch(e){} }
    }else if(kind!=='bump'){ try{ sfx('hit',1.5); }catch(e){} }
  }
  function interact(b){
    const c=centre(b), P=centre(p), dx=c.x-P.x, dy=c.y-P.y, d=Math.hypot(dx,dy)||1;
    const ax=p.aimDX||0, ay=p.aimDY||0, al=Math.hypot(ax,ay)||1, ux=ax/al, uy=ay/al, dot=(dx*ux+dy*uy)/d;
    // a punch
    if(p.pt>0){ if(!b._pHit){ const rx=P.x+ux*44, ry=P.y+uy*44; if(Math.hypot(c.x-rx,c.y-ry)<50){ b._pHit=true; const k=(p.pCharge||0)>20||p.pCd>4?1.6:1; knock(b,ux*7.5*k,uy*5*k-3.5,'punch',k>1?22:12); } } }
    else b._pHit=false;
    // the XLR blows it away; the MAG pulls it in
    if(p.xlrOn&&ITEM===2&&d<170&&dot>0.6){ const f=(1-d/170)*1.5; b.vx=(b.vx||0)+ux*f; b.vy=(b.vy||0)+uy*f-0.25; if(!(b.free>0)) knock(b,b.vx,b.vy,'xlr',0); b.free=Math.max(b.free,24); if(ff&&fr%10===0) knock(b,b.vx,b.vy,'xlr',3); }
    if(p.magOn&&ITEM===3&&d<190&&d>64&&dot>0.55){ const f=(1-d/190)*1.2; b.vx=(b.vx||0)-ux*f; b.vy=(b.vy||0)-uy*f-0.3; if(!(b.free>0)) knock(b,b.vx,b.vy,'mag',0); b.free=Math.max(b.free,24); }
    // your weight: land on it, or roll into it
    if(Math.abs(dx)<SW*0.75&&Math.abs((b.y)-(p.y))<70){
      if((p.vy||0)>3&&p.y+FEET_OFF<b.y+FEET_OFF-36){ p.vy=-7; p.og=false; knock(b,Math.sign(dx||1)*2.5,2,'stomp',10); }
      else if(Math.abs(p.vx||0)>0.6&&Math.sign(p.vx)===Math.sign(dx||p.vx)){ const push=p.vx*0.85+Math.sign(dx||p.vx)*0.8; if(!(b.free>0)||Math.abs(b.vx||0)<Math.abs(push)) knock(b,push,b.og?-0.6:(b.vy||0),'bump',0); }
    }
  }
  function bodyPhysics(b){
    b.vy=Math.min((b.vy||0)+GRAV,14);
    b.vx*=b.og?0.84:0.985;
    if(typeof _movePlayerWithColl==='function') _movePlayerWithColl(b,b.vx,b.vy); else { b.x+=b.vx; b.y+=b.vy; }
    if(b.og&&b.vy>0) b.vy=0;
    b.wheelAngle=(b.wheelAngle||0)+b.vx/WHEEL_R;
    b.free-=(b.og&&Math.abs(b.vx)<0.4)?3:1;
  }
  // the jack's tip, where its shots come from (the arm points where it aims)
  function tipOf(b){
    try{ const pose=computeConnectorArmPose(b), a=Math.atan2(b.aimDY||0,b.aimDX||(b.fc?1:-1));
      if(pose&&isFinite(pose.tipX)) return {x:pose.tipX+Math.cos(a)*30, y:pose.tipY+Math.sin(a)*30}; }catch(e){}
    const c=centre(b); return {x:c.x+(b.fc?36:-36), y:c.y-6};
  }
  function fizz(b,hit){ const c=S&&S.hero==='venture'?'#ff8a96':'#d8b4ff'; for(let k=0;k<(hit?8:4);k++) PFXS.push({x:b.x,y:b.y,vx:(Math.random()-0.5)*3,vy:(Math.random()-0.5)*3,life:10,maxLife:10,r:1.6,col:c}); }

  const _upd=window.updateKnowls;
  window.updateKnowls=function(){
    const r=_upd.apply(this,arguments);
    try{
      if(!B.on||!labOk()){ S=null; npc=null; return r; }
      if(!on){ S=null; if(active2()) npcTick(); return r; }
      npc=null;
      if(!active()) return r;
      if(!S||p.hero===S.hero) spawn();
      S.hp=S.maxHp;
      if(S._blink>0) S._blink--;
      if(S.fireRecoil>0) S.fireRecoil--;
      if(S.flashF>0) S.flashF--;
      if(S._shootT>0) S._shootT--;
      if(typeof _updateBattleEye==='function') _updateBattleEye(S);   // its eye: looks at the nearest enemy, squints, gets mad — like yours
      interact(S);
      if(S._downT>0){ S._downT--; S.crouchAmt=Math.min(1,(S.crouchAmt||0)+0.1); if(S.free>0) bodyPhysics(S); if(S._downT===0){ S.crouchAmt=0; S._blink=12; } boltsTick(); return r; }   // knocked out (friendly fire): back in a few seconds
      watchBlocks();
      if(S.free>0){ bodyPhysics(S); assist(); boltsTick(); S._catch=30; return r; }      // moved by you: it lands, then rides back to your trail
      assist(); follow(); boltsTick();
    }catch(e){ console.warn('sibling',e); }
    return r;
  };
  // drawn in the world, behind MIND (beta_level's world overlay runs before the characters)
  const _hud=window.drawLdtkLabHud;
  window.drawLdtkLabHud=function(){
    const r=_hud.apply(this,arguments);
    const who=S&&active()?S:(npc&&!on&&active2()?npc.s:null);
    if(!who) return r;
    try{
      // the bolts
      ctx.save(); ctx.globalCompositeOperation='lighter';
      for(const b of bolts){ if(!S) break; const c=S.hero==='venture'?'255,90,110':'190,140,255'; ctx.strokeStyle='rgba('+c+',0.85)'; ctx.lineWidth=sw(4); ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(sx(b.x-b.vx*1.6),sy(b.y-b.vy*1.6)); ctx.lineTo(sx(b.x),sy(b.y)); ctx.stroke();
        ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(sx(b.x),sy(b.y),Math.max(1.5,sw(2.5)),0,Math.PI*2); ctx.fill(); }
      ctx.restore();
      // the sibling itself: a touch see-through while it blinks in, never the focus
      const keep={rc:B.ropeClip, mp:B.magPark, it:ITEM};
      const swing=who===S&&p.hook&&p.hook.st==='on';
      const show=who!==S?-1:(S._shootT>0?0:swing?1:S._flying?2:(ITEM>=0?ITEM:0));   // its XLR while it hovers       // home: empty-handed · with you: your item, the TRS while it shoots
      B.ropeClip=null; B.magPark=null; ITEM=show;
      if(swing){                                                              // it swings with you: its own line to the same anchor
        const h=p.hook, P=h.pivots&&h.pivots.length?h.pivots[h.pivots.length-1]:{x:h.ax,y:h.ay};
        let n; try{ const ps=computeConnectorArmPose(S); n={x:ps.noseX,y:ps.noseY}; }catch(e){ n=centre(S); }
        if(n&&isFinite(n.x)){ ctx.save(); ctx.lineCap='round'; ctx.globalAlpha=0.85;
          ctx.strokeStyle='#120a1c'; ctx.lineWidth=Math.max(2,sw(5)); ctx.beginPath(); ctx.moveTo(sx(n.x),sy(n.y)); ctx.lineTo(sx(P.x),sy(P.y)); ctx.stroke();
          ctx.strokeStyle=S.hero==='venture'?'#c03048':'#7a3cc8'; ctx.lineWidth=Math.max(1,sw(3)); ctx.beginPath(); ctx.moveTo(sx(n.x),sy(n.y)); ctx.lineTo(sx(P.x),sy(P.y)); ctx.stroke(); ctx.restore(); }
      }
      try{
        who._armPose=computeConnectorArmPose(who);
        ctx.save(); ctx.globalAlpha=who===S&&S._blink>0?0.4+0.05*(12-S._blink):(who===S?0.92:1);
        try{ drawCharacterFor(who); } finally{ ctx.restore(); }
      } finally{ B.ropeClip=keep.rc; B.magPark=keep.mp; ITEM=keep.it; }   // your item, rope and magnet are always handed back
    }catch(e){ console.warn('sibling draw',e); }
    return r;
  };
})();
