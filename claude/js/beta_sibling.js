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
  B.platRiders=()=>{ const o=[]; if(S) o.push(S); if(npc&&npc.s) o.push(npc.s); return o; };
  const labOk=()=>!window.MV_BETA_LAB||/[?&]sib=1/.test(location.search);
  const DELAY=24, KEEP=220, MIN_GAP=62, LOST=560;
  let S=null, trail=[], bolts=[], lastLevel=null, lastHero=null;

  function active2(){ return B.on&&B.level&&typeof p!=='undefined'&&p&&_gameState==='game'&&!B.trans&&!B.results; }
  function active(){ return on&&labOk()&&B.on&&B.level&&typeof p!=='undefined'&&p&&_gameState==='game'&&!B.trans&&!B.results&&!(typeof _paused!=='undefined'&&_paused); }
  function spawn(){
    S=mkP(); S._aiCompanion=true; S._betaSib=true;
    S.hero=p.hero==='venture'?'mind':'venture';
    S.x=p.x-(p.fc?1:-1)*MIN_GAP; S.y=p.y; S.fc=p.fc; S.og=true; S.hp=S.maxHp;
    S._shotCd=40; S._sideT=0; S._fcT=0; S._stuck=0; S._fly=false; S._side=null; S.vx=0; S.vy=0; trail.length=0; bolts.length=0; S._blink=12;
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
    const cov=coverSpot(S._threat);
    if(Math.hypot(S.x-p.x,S.y-p.y)>LOST||B.level!==lastLevel||(last&&Math.hypot(p.x-last.x,p.y-last.y)>LOST)||(S._stuck||0)>150){   // lost: a respawn, a stage change, a teleport, or really stuck
      trail.length=0; trail.push({x:p.x,y:p.y,fc:p.fc,og:!!p.og,ca:0}); lastLevel=B.level;
      blinkTo({x:p.x-(p.fc?1:-1)*MIN_GAP,y:p.y}); S.vx=S.vy=S._hvx=S._hvy=0; S._stuck=0; S._fly=false; return;
    }
    // Paulo (Oct 22, build 264): "more serene, grounded, less glitchy". It rides the ground with real
    // physics — eases up to a spot behind you, eases to a stop, hops ledges and walls — and only takes
    // to the air on its XLR when it has to (you're on the rope, high above it, far off, or it's stuck),
    // gliding smoothly and landing again as soon as it can. The side it keeps changes only after you've
    // faced the other way for a while, so turning around doesn't send it darting across.
    const solid=(x,y)=>typeof gridWorldSolid==='function'&&gridWorldSolid(x,y);
    const want=p.fc?-1:1;
    if(S._side==null) S._side=want;
    if(want!==S._side){ if(++S._sideT>50){ S._side=want; S._sideT=0; } } else S._sideT=0;
    const rope=p.hook&&p.hook.st==='on';
    const dxP=p.x-S.x, dyP=p.y-S.y;                                   // dyP < 0: you're above it
    const needFly=rope||dyP<-150||Math.abs(dxP)>340||(S._stuck||0)>40;
    if(!S._fly&&needFly&&!cov){ S._fly=true; S._flyT=0; S._hvx=S.vx||0; S._hvy=Math.min(0,S.vy||0); S._stuck=0; }
    const x0=S.x, y0=S.y;
    if(S._fly){
      S._flyT++;
      const groundOk=p.og&&!rope&&Math.abs(dyP)<110&&Math.abs(dxP)<220;
      if(groundOk&&S._flyT>40){ S._fly=false; S.vx=S._hvx*0.6; S.vy=Math.max(0,S._hvy); }
    }
    if(S._fly){
      // the slot: your back shoulder, a little above; up over your head if that's in rock
      const bob=Math.sin(fr*0.035)*3;
      let tx=p.x+S._side*72, ty=p.y-64+bob;
      if(solid(tx+SW/2,ty+FEET_OFF-20)||solid(tx+SW/2,ty+FEET_OFF-90)){ tx=p.x+S._side*30; ty=p.y-112+bob; }
      const cap=Math.max(7,Math.hypot(p.vx||0,p.vy||0)+3);
      S._hvx=S._hvx*0.86+(tx-S.x)*0.014; S._hvy=S._hvy*0.86+(ty-S.y)*0.014;
      const sp=Math.hypot(S._hvx,S._hvy); if(sp>cap){ S._hvx*=cap/sp; S._hvy*=cap/sp; }
      const before=Math.hypot(tx-S.x,ty-S.y);
      if(typeof _movePlayerWithColl==='function') _movePlayerWithColl(S,S._hvx,S._hvy); else { S.x+=S._hvx; S.y+=S._hvy; }
      S.og=false; S.vx=S.x-x0; S.vy=S.y-y0;
      if(before>160&&Math.hypot(S.vx,S.vy)<0.4) S._stuck=(S._stuck||0)+1; else S._stuck=Math.max(0,(S._stuck||0)-2);
      S._flying=true;
      S.fc=Math.abs(S.vx)>1.2?S.vx>0:p.fc;
      S.wheelAngle=(S.wheelAngle||0)+0.12*(S.fc?1:-1);
      if(!(S._shootT>0)&&!S._threat){ S.aimDX+=(S.vx*0.04-S.aimDX)*0.12; S.aimDY+=(1-S.aimDY)*0.12; }   // the jack points down: the XLR holds it up
      if(fr%5===0){ const tp=tipOf(S); PFXS.push({x:tp.x+(Math.random()-0.5)*4,y:tp.y+4,vx:(Math.random()-0.5)*0.8-S.vx*0.2,vy:1.6+Math.random(),life:12,maxLife:12,r:2,col:'#aaddff'}); }
      return;
    }
    // ── on the ground ──
    S._flying=false;
    let tx=cov?cov.x:p.x+S._side*70;
    if(solid(tx+SW/2,p.y+FEET_OFF-30)||solid(tx+SW/2,p.y+FEET_OFF-60)) tx=p.x+S._side*34;   // a wall there: tuck in closer
    const pm=B.ridePlat;                                              // you're on a moving platform: its spot is on it too
    if(pm&&!cov){ const lo=pm.x-SW/2+6, hi=pm.x+pm.w-SW/2-6; tx=Math.max(lo,Math.min(hi,tx)); if(Math.abs(tx-p.x)<40) tx=p.x+(tx>=p.x?40:-40); tx=Math.max(lo,Math.min(hi,tx)); }
    const dx=tx-S.x, adx=Math.abs(dx), dead=16, dir=Math.sign(dx);
    const maxV=Math.max(3,Math.abs(p.vx||0)+1.2);
    if(adx>dead){
      S.vx=(S.vx||0)+dir*Math.min(0.42,0.1+adx/260);
      const vStop=Math.sqrt(2*0.32*(adx-dead))+0.4;                   // brake in time: eases to a stop on its mark
      if(Math.sign(S.vx)===dir&&Math.abs(S.vx)>vStop) S.vx=dir*vStop;
      if(Math.sign(S.vx)!==dir) S.vx*=0.8;
    }else S.vx=(S.vx||0)*(S.og?0.75:0.97);
    S.vx=Math.max(-maxV-(S.og?0:1.5),Math.min(maxV+(S.og?0:1.5),S.vx));
    const feet=S.y+FEET_OFF;
    if(S.og){
      const ax=S.x+SW/2+dir*(SW/2+10);
      const wall=adx>dead&&(solid(ax,feet-24)||solid(ax,feet-52));
      const ledge=dyP<-48&&Math.abs(dxP)<150&&p.og;                    // you're up a step: hop up after you
      // a gap ahead (no floor under the next stretch) with somewhere to land at about this height: leap it
      let gap=false;
      if(adx>40&&Math.abs(S.vx)>1.2){ const fx=S.x+SW/2+dir*(SW/2+18); let floorAhead=false; for(let yy=feet+4;yy<feet+90;yy+=12) if(solid(fx,yy)){ floorAhead=true; break; }
        if(!floorAhead&&dyP<40) gap=true; }
      const ontoPlat=pm&&S._ridePlat!==pm&&dyP<-20&&Math.abs(dxP)<170;   // hop onto the platform you're riding
      if(wall||ledge||gap||ontoPlat){ S.vy=-10.8; S.og=false; if(gap||ontoPlat) S.vx=dir*Math.max(Math.abs(S.vx),3.2); }
    }
    S.vy=Math.min((S.vy||0)+GRAV,13);
    if(typeof _movePlayerWithColl==='function') _movePlayerWithColl(S,S.vx,S.vy); else { S.x+=S.vx; S.y+=S.vy; }
    if(S.og&&S.vy>0) S.vy=0;
    const moved=S.x-x0;
    if(adx>60&&Math.abs(moved)<0.25) S._stuck=(S._stuck||0)+1; else S._stuck=Math.max(0,(S._stuck||0)-2);
    S.crouchAmt=(S.crouchAmt||0)+(((cov?0:(p.crouchAmt||0)))-(S.crouchAmt||0))*0.2;
    S.wheelAngle=(S.wheelAngle||0)+moved/WHEEL_R;
    // facing: with its motion when it's really moving, otherwise the way you face — and no flicker
    const wantFc=Math.abs(S.vx)>0.9?S.vx>0:(S._threat?S._threat.ex>S.x+SW/2:p.fc);
    if(wantFc!==S.fc){ if(++S._fcT>8){ S.fc=wantFc; S._fcT=0; } } else S._fcT=0;
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
    const sp=11, tp=tipOf(S); if(!clearLine(me.x,me.y-6,tp.x,tp.y)){ S._shotCd=8; return; }   // the jack's tip is past a wall: no shot
    S._shootT=40;
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
      const hitRock=(x,y)=>{ if(typeof gridWorldSolid!=='function'||!gridWorldSolid(x,y)) return false; const w=b.bw; return !(w&&x>=w.x-2&&x<=w.x+(w.w||32)+2&&y>=w.y-2&&y<=w.y+(w.h||32)+2); };
      if(hitRock(b.x+b.vx*0.5,b.y+b.vy*0.5)){ b.x+=b.vx*0.5; b.y+=b.vy*0.5; fizz(b); bolts.splice(i,1); continue; }   // never through a wall (Paulo, Oct 22)
      b.x+=b.vx; b.y+=b.vy;
      if(b.bw){
        const w=b.bw; if(w.hp>0&&b.x>=w.x-2&&b.x<=w.x+(w.w||32)+2&&b.y>=w.y-2&&b.y<=w.y+(w.h||32)+2){
          sibHitFr=fr; if(typeof _damageBwall==='function') _damageBwall(w,'punch',{shakeX:Math.sign(b.vx)*2,shakeY:Math.sign(b.vy)*2}); fizz(b,true); bolts.splice(i,1); continue; }
        const cx=w.x+(w.w||32)/2, cy=w.y+(w.h||32)/2, d=Math.hypot(cx-b.x,cy-b.y)||1; b.vx+=((cx-b.x)/d*11-b.vx)*0.2; b.vy+=((cy-b.y)/d*11-b.vy)*0.2;
      }
      if(b.life<=0||hitRock(b.x,b.y)){ fizz(b); bolts.splice(i,1); continue; }
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
    { const n=Math.ceil(Math.max(0,d-26)/12); for(let k=1;k<n;k++){ const x=me.x+dx/d*k*12, y=me.y-6+dy/d*k*12; if(typeof gridWorldSolid==='function'&&gridWorldSolid(x,y)&&!(x>=w.x&&x<=w.x+(w.w||32)&&y>=w.y&&y<=w.y+(w.h||32))) return; } }   // a wall in between: not its shot
    S.aimDX=dx/d; S.aimDY=dy/d; if(Math.abs(dx)>6) S.fc=dx>0;
    const tp=tipOf(S); if(!clearLine(me.x,me.y-6,tp.x,tp.y)) return;
    S._shootT=40;
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
    if(s2._madT>0){ madTick(s2); return; }
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
    if(!ff&&kind==='punch') tease(b);
  }
  // Friendly fire off: three connecting punches inside 5 seconds and they snap,
  // turn, and throw one loaded punch back. That one does hurt.
  function tease(b){
    if(b._madT>0) return;
    if(!b._tease) b._tease=[];
    b._tease.push(fr);
    b._tease=b._tease.filter(t=>fr-t<=300);
    if(b._tease.length<3) return;
    b._tease.length=0;
    b._madT=34; b._madHit=false; b.free=0;
    b.vx*=0.15; b.vy=Math.min(b.vy||0,-1.5);
    const name=b.hero==='venture'?'VENTURE':'MIND';
    try{ if(typeof uiShowToast==='function') uiShowToast(name+' SNAPS'); }catch(e){}
    try{ sfx('punch_heavy',0.85); }catch(e){}
  }
  function madTick(b){
    if(!(b._madT>0)) return;
    b._madT--; b.free=0;
    const c=centre(b), P=centre(p);
    const dx=P.x-c.x, dy=P.y-c.y, d=Math.hypot(dx,dy)||1;
    const ux=dx/d, uy=dy/d, dir=dx>=0?1:-1;
    b.fc=dx>=0; b.aimDX=ux; b.aimDY=Math.max(-0.4,Math.min(0.45,uy));
    b.tAimDX=b.aimDX; b.tAimDY=b.aimDY;
    if(b._madT>12){
      b.pCharging=true; b.pCharge=Math.min(28,(34-b._madT)*2); b.pt=0;
      b.crouchAmt=Math.min(0.8,(b.crouchAmt||0)+0.14);
      b.vx=d>52?dir*Math.min(5.2,1.3+d*0.018):dir*0.4;
      b.vy=Math.min((b.vy||0)+GRAV,12);
      if(b.og&&d>78&&d<220){ b.vy=-7.2; b.og=false; }
    }else{
      b.pCharging=false; b.pCharge=28; b.pt=Math.max(1,b._madT);
      b.crouchAmt=Math.max(0,(b.crouchAmt||0)-0.22);
      b.vx=dir*1.6; b.vy=Math.min((b.vy||0)+GRAV*0.35,8);
      if(!b._madHit&&b.pt<=4&&d<112){
        b._madHit=true;
        try{ applyPlayerHit(ux*7, Math.min(-3.2, uy*4-2), 28); }catch(e){}
        try{ sfx('punch_hit_heavy'); }catch(e){}
        for(let i=0;i<10;i++) PFXS.push({x:P.x+(Math.random()-0.5)*16,y:P.y+(Math.random()-0.5)*16,vx:ux*(2+Math.random()*4),vy:uy*2-Math.random()*2,life:12,maxLife:12,r:2.2,col:i%2?'#ffe0a0':'#ff8866'});
      }
    }
    if(typeof _movePlayerWithColl==='function') _movePlayerWithColl(b,b.vx,b.vy||0); else { b.x+=b.vx; b.y+=b.vy; }
    if(b.og&&b.vy>0) b.vy=0;
    b.wheelAngle=(b.wheelAngle||0)+(b.vx||0)/(typeof WHEEL_R!=='undefined'?WHEEL_R:20);
    if(b._madT<=0){ b.pt=0; b.pCharge=0; b.pCharging=false; b.crouchAmt=0; }
  }
  function interact(b){
    if(b._madT>0) return;
    const c=centre(b), P=centre(p), dx=c.x-P.x, dy=c.y-P.y, d=Math.hypot(dx,dy)||1;
    const ax=p.aimDX||0, ay=p.aimDY||0, al=Math.hypot(ax,ay)||1, ux=ax/al, uy=ay/al, dot=(dx*ux+dy*uy)/d;
    if(!clearLine(P.x,P.y,c.x,c.y)) return;                       // nothing (punch, air, magnet, weight) reaches it through a wall
    // a punch
    if(p.pt>0){ if(!b._pHit){ const rx=P.x+ux*52, ry=P.y+uy*52; if(Math.hypot(c.x-rx,c.y-ry)<64||(Math.abs(dx)<SW&&Math.abs(dy)<70&&dot>0.2)){ b._pHit=true; const k=(p.pCharge||0)>20||p.pCd>4?1.6:1; knock(b,ux*7.5*k,uy*5*k-3.5,'punch',k>1?22:12); } } }
    else b._pHit=false;
    // the XLR blows it away; the MAG pulls it in
    if(p.xlrOn&&ITEM===2&&d<170&&dot>0.6){ const f=(1-d/170)*1.5; b.vx=(b.vx||0)+ux*f; b.vy=(b.vy||0)+uy*f-0.25; if(!(b.free>0)) knock(b,b.vx,b.vy,'xlr',0); b.free=Math.max(b.free,24); if(ff&&fr%10===0) knock(b,b.vx,b.vy,'xlr',3); }
    if(p.magOn&&ITEM===3&&d<190&&d>64&&dot>0.55){ const f=(1-d/190)*1.2; b.vx=(b.vx||0)-ux*f; b.vy=(b.vy||0)-uy*f-0.3; if(!(b.free>0)) knock(b,b.vx,b.vy,'mag',0); b.free=Math.max(b.free,24); }
    // your weight: land on it, or roll into it
    if(Math.abs(dx)<SW*0.75&&Math.abs((b.y)-(p.y))<70){
      if((p.vy||0)>3&&p.y+FEET_OFF<b.y+FEET_OFF-36){ p.vy=-7; p.og=false; knock(b,Math.sign(dx||1)*2.5,2,'stomp',10); }
      else if(Math.abs(p.vx||0)>(b._aiCompanion?6:4.5)&&Math.sign(p.vx)===Math.sign(dx||p.vx)){ const push=p.vx*0.85+Math.sign(dx||p.vx)*0.8; if(!(b.free>0)||Math.abs(b.vx||0)<Math.abs(push)) knock(b,push,b.og?-0.6:(b.vy||0),'bump',0); }   // only a real ram shoves the companion (walking past it doesn't)
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
      if(S._madT>0){ madTick(S); boltsTick(); return r; }
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
      const show=who._madT>0?-1:(who!==S?-1:(S._shootT>0?0:swing?1:S._flying?2:(ITEM>=0?ITEM:0)));   // a loaded punch is bare fists; otherwise its jack
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
