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
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B) return;
  const KEY='mv2.sibling';
  const read=()=>{ try{ const v=localStorage.getItem(KEY); return v==null?true:v==='1'; }catch(e){ return true; } };
  let on=read();
  window.MV_SIBLING={ get on(){ return on; }, set on(v){ on=!!v; try{ localStorage.setItem(KEY,on?'1':'0'); }catch(e){} }, toggle(){ this.on=!on; }, state:()=>S };
  const labOk=()=>!window.MV_BETA_LAB||/[?&]sib=1/.test(location.search);
  const DELAY=24, KEEP=220, MIN_GAP=62, LOST=560;
  let S=null, trail=[], bolts=[], lastLevel=null, lastHero=null;

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
      if(dP>300) continue;
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
    const x0=S.x, y0=S.y;
    if(Math.hypot(S.x-p.x,S.y-p.y)>LOST||B.level!==lastLevel||(last&&Math.hypot(p.x-last.x,p.y-last.y)>LOST)){   // lost: a respawn, a stage change, a teleport
      trail.length=0; trail.push({x:p.x,y:p.y,fc:p.fc,og:!!p.og,ca:0}); lastLevel=B.level;
      blinkTo({x:p.x-(p.fc?1:-1)*MIN_GAP,y:p.y}); return;
    }
    S.x+=(T.x-S.x)*0.32; S.y+=(T.y-S.y)*0.32;
    S.vx=S.x-x0; S.vy=S.y-y0; S.og=T.og; S.crouchAmt=(S.crouchAmt||0)+((T.ca||0)-(S.crouchAmt||0))*0.3;
    if(Math.abs(S.vx)>0.25) S.fc=S.vx>0; else if(Math.abs(S.vx)<0.05) S.fc=p.x+SW/2>S.x+SW/2;   // idle: it faces you
    S.wheelAngle=(S.wheelAngle||0)+S.vx/WHEEL_R;
  }
  function blinkTo(T){
    for(let k=0;k<10;k++) PFXS.push({x:S.x+SW/2+(Math.random()-0.5)*30,y:S.y+FEET_OFF-40+(Math.random()-0.5)*40,vx:(Math.random()-0.5)*2,vy:-Math.random()*2,life:14,maxLife:14,r:2,col:S.hero==='venture'?'#ff6a7a':'#c49aff'});
    S.x=T.x; S.y=T.y; S._blink=12;
  }
  function assist(){
    const t=pickThreat(), me=centre(S);
    S._shotCd=(S._shotCd||0)-1;
    if(!t){ S.aimDX+=((S.fc?1:-1)-S.aimDX)*0.2; S.aimDY*=0.8; S.pupilX=(S.pupilX||0)*0.8; S.pupilY=(S.pupilY||0)*0.8; return; }
    const dx=t.ex-me.x, dy=t.ey-me.y, d=Math.hypot(dx,dy)||1;
    S.aimDX+=(dx/d-S.aimDX)*0.35; S.aimDY+=(dy/d-S.aimDY)*0.35;
    S.pupilX=dx/d*2.5; S.pupilY=dy/d*2.5;
    if(Math.abs(dx)>6) S.fc=dx>0;
    if(S._shotCd>0) return;
    // never across you: skip the shot if you're between it and the target
    const P=centre(p), seg=((P.x-me.x)*dx+(P.y-me.y)*dy)/(d*d);
    if(seg>0&&seg<1&&Math.hypot(me.x+dx*seg-P.x,me.y+dy*seg-P.y)<26){ S._shotCd=8; return; }
    const urgent=t.dP<110||(p.hp||0)<(p.maxHp||100)*0.4;
    S._shotCd=urgent?26:48;
    const sp=10; bolts.push({x:me.x+dx/d*30,y:me.y-6+dy/d*30,vx:dx/d*sp,vy:dy/d*sp,e:t.e,life:50,urgent});
    S.fireRecoil=5; S.fireRecoilA=Math.atan2(dy,dx);
    try{ sfx('laser',S.hero==='venture'?1.25:1.4); }catch(e){}
  }
  function boltsTick(){
    for(let i=bolts.length-1;i>=0;i--){
      const b=bolts[i]; b.life--;
      const e=b.e;
      if(e&&e.alive){ const ex=e.x+(e.w||0)/2, ey=e.y+(e.h||0)/2, d=Math.hypot(ex-b.x,ey-b.y)||1; b.vx+=((ex-b.x)/d*10-b.vx)*0.12; b.vy+=((ey-b.y)/d*10-b.vy)*0.12; }   // a gentle homing
      b.x+=b.vx; b.y+=b.vy;
      if(b.life<=0||(typeof gridWorldSolid==='function'&&gridWorldSolid(b.x,b.y))){ fizz(b); bolts.splice(i,1); continue; }
      for(const en of (typeof ENEMS!=='undefined'?ENEMS:[])){
        if(!en||!en.alive||en._hidden) continue;
        if(b.x>=en.x&&b.x<=en.x+(en.w||0)&&b.y>=en.y&&b.y<=en.y+(en.h||0)){
          let dmg=8;
          const P=centre(p), near=Math.hypot(en.x+(en.w||0)/2-P.x,en.y+(en.h||0)/2-P.y)<110, hurt=(p.hp||0)<(p.maxHp||100)*0.4;
          if(!near&&!hurt) dmg=Math.min(dmg,Math.max(0,(en.hp||0)-1));         // softens it up — the knockdown is yours
          if(dmg>0&&typeof _damageEnemy==='function') _damageEnemy(en,dmg,b.x-b.vx*3,b.y-b.vy*3,0.35);
          else en.hitF=Math.max(en.hitF||0,6);
          fizz(b,true); bolts.splice(i,1); break;
        }
      }
    }
  }
  function fizz(b,hit){ const c=S&&S.hero==='venture'?'#ff8a96':'#d8b4ff'; for(let k=0;k<(hit?8:4);k++) PFXS.push({x:b.x,y:b.y,vx:(Math.random()-0.5)*3,vy:(Math.random()-0.5)*3,life:10,maxLife:10,r:1.6,col:c}); }

  const _upd=window.updateKnowls;
  window.updateKnowls=function(){
    const r=_upd.apply(this,arguments);
    try{
      if(!active()){ if(!(on&&labOk())||!B.on) S=null; return r; }
      if(!S||p.hero===S.hero) spawn();
      S.hp=S.maxHp;
      if(S._blink>0) S._blink--;
      if(S.fireRecoil>0) S.fireRecoil--;
      follow(); assist(); boltsTick();
    }catch(e){ console.warn('sibling',e); }
    return r;
  };
  // drawn in the world, behind MIND (beta_level's world overlay runs before the characters)
  const _hud=window.drawLdtkLabHud;
  window.drawLdtkLabHud=function(){
    const r=_hud.apply(this,arguments);
    if(!S||!active()) return r;
    try{
      // the bolts
      ctx.save(); ctx.globalCompositeOperation='lighter';
      for(const b of bolts){ const c=S.hero==='venture'?'255,90,110':'190,140,255'; ctx.strokeStyle='rgba('+c+',0.85)'; ctx.lineWidth=sw(4); ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(sx(b.x-b.vx*1.6),sy(b.y-b.vy*1.6)); ctx.lineTo(sx(b.x),sy(b.y)); ctx.stroke();
        ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(sx(b.x),sy(b.y),Math.max(1.5,sw(2.5)),0,Math.PI*2); ctx.fill(); }
      ctx.restore();
      // the sibling itself: a touch see-through while it blinks in, never the focus
      const keep={rc:B.ropeClip, mp:B.magPark, it:ITEM};
      B.ropeClip=null; B.magPark=null; ITEM=0;
      try{
        S._armPose=computeConnectorArmPose(S);
        ctx.save(); ctx.globalAlpha=S._blink>0?0.4+0.05*(12-S._blink):0.92;
        try{ drawCharacterFor(S); } finally{ ctx.restore(); }
      } finally{ B.ropeClip=keep.rc; B.magPark=keep.mp; ITEM=keep.it; }   // your item, rope and magnet are always handed back
    }catch(e){ console.warn('sibling draw',e); }
    return r;
  };
})();
