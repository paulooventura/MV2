// ============================================================
//  beta_mirror.js — enemy D, the player mirror (Paulo, Oct 21)
//
//  Looks like MIND but menacing (his hat and speaker body, a red wheel and a
//  red, pulsing eye), carries the same four jacks and does what MIND does:
//  punches, TRS shots, the RCA rope, XLR and MAG, jumps. It is the old rival
//  AI (enemies.js _updateMindEnemy) with stage rules on top:
//   - it hunts only once it has seen MIND ('!'), loses him after a while
//     out of sight ('?') and goes back to patrolling its stretch;
//   - it shuts down like the other enemies (greyed out, no sign): back up in about two seconds,
//     off for good after three shutdowns, or at once in water;
//   - it never spawns minions (the old rival did).
// ============================================================
(function(){
  'use strict';
  const B=window.MV_BETA; if(!B) return;
  const T=32, LOSE_FR=110, REBOOT_MS=700, DOWNS=3;

  B.mkMirror=function(cx,feet,range){
    const e=_mkMindEnemy('square',cx,feet,{campaignAi:true, kit:[0,1,2,3], mn:Math.floor(cx-range), mx:Math.floor(cx+range)});
    e.mirror=true; e._awdjooKeep=true; e._betaEnemy='mirror';
    e.minionCd=1e9; e._downs=0; e._seenT=0; e.aware=false; e.mark=null;
    return e;
  };

  // no minions from the mirror
  const _spawn=window._tickRivalMinionSpawn;
  if(typeof _spawn==='function') window._tickRivalMinionSpawn=function(e){ if(e&&e.mirror) return; return _spawn.apply(this,arguments); };

  // sees MIND: on screen and a clear line between them
  function sees(e){
    if(typeof _enemyLineClear==='function'&&!_enemyLineClear(e)) return false;
    const vx0=typeof _rcamX==='number'?_rcamX:camX, vy0=typeof _rcamY==='number'?_rcamY:camY;
    const vw=typeof camViewW==='function'?camViewW():W, vh=typeof camViewH==='function'?camViewH():H;
    return e.x+e.w>vx0-T&&e.x<vx0+vw+T&&e.y+e.h>vy0-T&&e.y<vy0+vh+T;
  }
  // patrol only: walk its stretch, no items, no chasing
  function patrol(e){
    const ex0=e.x;
    e.xlrOn=false; e.magOn=false; if(e.hook) e.hook.st='idle';
    if(Math.abs(e.vx||0)<0.12) e.vx=(e.spd||1)*(e.dir||1)*0.8;
    if(e.x<=e.mn||e.x+e.w>=e.mx){ e.dir=-(e.dir||1); e.vx=(e.spd||1)*e.dir*0.8; }
    e.fc=e.vx>0; e.aimDX+=((e.fc?1:-1)-e.aimDX)*0.1; e.aimDY*=0.9;
    e.pupilX+=((e.fc?3:-3)-e.pupilX)*0.1; e.pupilY*=0.9;
    if(e.og&&typeof _enemyNeedStepJump==='function'&&_enemyNeedStepJump(e)&&typeof _enemyStartJump==='function') _enemyStartJump(e,18);
    if((e.jf||0)>0){ e.vy=Math.max((e.vy||0)-(typeof JHH==='undefined'?0.4:JHH),typeof JMX==='undefined'?-11:JMX); e.jf--; }
    e.vy=Math.min((e.vy||0)+GRAV*0.55,11);
    _applyMindEnemyPhysics(e);
    e.x=Math.max(e.mn,Math.min(e.mx-e.w,e.x));
    if(e.og){ const edx=e.x-ex0; if(Math.abs(edx)>=0.01) e.wheelAngle=(e.wheelAngle||0)+edx/WHEEL_R; }
    e._armPose=computeConnectorArmPose(e);
  }
  const _upd=window._updateMindEnemy;
  if(typeof _upd==='function') window._updateMindEnemy=function(e){
    if(!B.on||!e||!e.mirror) return _upd.apply(this,arguments);
    if(sees(e)){
      e._seenT=LOSE_FR;
      if(!e.aware){ e.aware=true; e.mark={c:'!',t:0}; try{ sfx('enemy_alert'); }catch(_e){} }
    }else if(e._seenT>0&&--e._seenT===0&&e.aware){
      e.aware=false; e.mark={c:'?',t:0}; try{ sfx('enemy_huh'); }catch(_e){}
    }
    window._mirrorActing=e;
    try{ if(e.aware) return _upd.apply(this,arguments); patrol(e); } finally{ window._mirrorActing=null; }
  };

  // Paulo (Oct 21): when D hits MIND, the jack he has in hand is knocked loose. It
  // flies off and lies there like an item out of a crate; until he picks it up again
  // he can't use it (it's gone from the top bar too).
  const _hit=window.applyPlayerHit;
  if(typeof _hit==='function') window.applyPlayerHit=function(){
    const src=window._mirrorActing||(window._hitShotSrc&&window._hitShotSrc.mirror?window._hitShotSrc:null);
    const hp0=p?p.hp:0, inv0=p?(p.inv||0):0;
    const r=_hit.apply(this,arguments);
    if(B.on&&src&&p&&(p.hp<hp0||(p.inv||0)>inv0&&p.hp<=hp0)) knockItem(src);
    return r;
  };
  let lastKnock=-999, lastLevel=null;
  const lost=new Set();                                   // knocked loose and not picked up yet
  // leaving or restarting the stage with a jack still lying there gives it back
  // (the loose one goes with the old stage)
  function lostTick(){
    for(const i of [...lost]) if(_itemUnlocked(i)) lost.delete(i);
    if(B.level!==lastLevel){ if(lastLevel) for(const i of lost) _unlockedMask|=ITEM_UNLOCK_BITS[i]; lost.clear(); lastLevel=B.level; }
  }
  function knockItem(e){
    if(fr-lastKnock<90) return;
    const idx=typeof ITEM!=='undefined'?ITEM:-1;
    if(idx<0||idx>3||typeof _itemUnlocked!=='function'||!_itemUnlocked(idx)) return;
    if(typeof ITEM_UNLOCK_BITS==='undefined'||typeof ITEM_DROPS==='undefined') return;
    lastKnock=fr;
    if(idx===1&&p.hook&&p.hook.st!=='idle'&&typeof _detachPlayerRope==='function') _detachPlayerRope(p.hook);
    p.xlrOn=false; p.magOn=false; p.laserCharging=false; p.laserCharge=0;
    _unlockedMask&=~ITEM_UNLOCK_BITS[idx];
    const enh=typeof _itemEnhanced!=='undefined'&&!!_itemEnhanced[idx];
    // hold the next jack he still has (top bar order), or nothing
    let next=-1; for(const i of [2,1,0,3]) if(_itemUnlocked(i)){ next=i; break; }
    ITEM=next;
    const cx=p.x+SW/2, cy=p.y+FEET_OFF-50, dir=Math.sign(cx-(e.x+(e.w||SW)/2))||1;
    const d={item:idx, enhanced:enh, x:cx-16, y:cy-16, w:32, h:32, got:false, bob:0, _knocked:true,
      _box:{hp:0, broken:true, shake:0, glow:0, item:{x:cx, y:cy, vx:dir*(3+Math.random()*1.5), vy:-6, rot:0, vr:dir*0.3, og:false, noPick:45}}};
    ITEM_DROPS.push(d); lost.add(idx);
    try{ sfx('item_clink'); sfx('enemy_alert'); }catch(_e){}
    for(let k=0;k<12;k++){ const a=Math.random()*Math.PI*2; PFXS.push({x:cx,y:cy,vx:Math.cos(a)*3,vy:Math.sin(a)*3-1,life:16,maxLife:16,r:2,col:'#ffd070'}); }
    const names=['TRS','RCA','XLR','MAG'];
    if(typeof uiShowToast==='function') uiShowToast('D KNOCKED YOUR '+names[idx]+' LOOSE - GRAB IT BACK!');
  }

  // shutdowns: quick reboot, three strikes, water is final
  B.mirrorTick=function(){
    if(!B.on) return;
    if(typeof ITEM_UNLOCK_BITS!=='undefined') lostTick();
    for(const e of ENEMS){
      if(!e.mirror) continue;
      if(e.mark&&++e.mark.t>60) e.mark=null;
      if(e._wasAlive&&!e.alive){ e._downs++; e.aware=false; e._seenT=0; if(e._downs>=DOWNS) e._stayDown=true; }
      if(e._permOff) e._stayDown=true;
      if(e._mindOff==='cooldown') e._cooldownEnd=Math.min(e._cooldownEnd||0,Date.now()+REBOOT_MS);
      e._wasAlive=e.alive;
    }
  };

  // the '!' / '?' over its head
  const _draw=window.drawMindEnemy;
  // Shut down it just goes grey, like the other enemies (Paulo, Oct 21: no OFF sign over its head)
  if(typeof _draw==='function') window.drawMindEnemy=function(e){
    if(!e||!e.mirror) return _draw.apply(this,arguments);
    const off=!e.alive;
    window._mirrorHat=true; window._mindOffNoLabel=off; window._hatDirOverride=e.fc?1:-1;
    ctx.save();
    if(off){ ctx.filter='grayscale(1) brightness(0.72) contrast(0.9)'; ctx.globalAlpha*=0.9; }
    try{ _draw.apply(this,arguments); } finally{ ctx.restore(); window._mirrorHat=false; window._mindOffNoLabel=false; window._hatDirOverride=0; }
    if(B.drawEnemyMark&&e.mark) B.drawEnemyMark({mark:e.mark, alive:e.alive, x:e.x, y:e.y+FEET_OFF-STAND_H-WHEEL_R-30, w:SW});
  };
})();
