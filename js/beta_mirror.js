// ============================================================
//  beta_mirror.js — enemy D, the player mirror (Paulo, Oct 21)
//
//  Looks like MIND but menacing (his hat and speaker body, a red wheel and a
//  red, pulsing eye), carries the same four jacks and does what MIND does:
//  punches, TRS shots, the RCA rope, XLR and MAG, jumps. It is the old rival
//  AI (enemies.js _updateMindEnemy) with stage rules on top:
//   - it hunts only once it has seen MIND ('!'), loses him after a while
//     out of sight ('?') and goes back to patrolling its stretch;
//   - it shuts down like the other enemies: back up in about two seconds,
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
    if(e.aware) return _upd.apply(this,arguments);
    patrol(e);
  };

  // shutdowns: quick reboot, three strikes, water is final
  B.mirrorTick=function(){
    if(!B.on) return;
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
  if(typeof _draw==='function') window.drawMindEnemy=function(e){
    if(!e||!e.mirror) return _draw.apply(this,arguments);
    window._mirrorHat=true;
    try{ _draw.apply(this,arguments); } finally{ window._mirrorHat=false; }
    if(B.drawEnemyMark&&e.mark) B.drawEnemyMark({mark:e.mark, alive:e.alive, x:e.x, y:e.y+FEET_OFF-STAND_H-WHEEL_R-30, w:SW});
  };
})();
