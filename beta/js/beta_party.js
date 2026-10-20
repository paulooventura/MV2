// ============================================================
//  beta_party.js — who plays: 1P with the sibling as a Sonic-2-style
//  partner, 2P CO-OP, or 2P VS (local; online is "coming soon").
//  · Every stage spawns both siblings side by side (B.onPlayersSpawn).
//  · 1P: the sibling follows, mirrors jumps (full hold), fights, grabs
//    seeds / crates, and flies back in from above when left behind.
//  · P2: arrows move, ↑ jumps (hold = higher), Numpad1 item (+ run),
//    Numpad0 run, Numpad2 punch, Numpad3 next item — or a 2nd controller
//    (A jump · X item/run · Y punch · B item · LB down · START pause).
//    P2 has its own item; the jacks unlocked are shared.
//  · VS: shots, punches, stomps and XLR/MAG hit the rival. 0 HP = that
//    sibling shuts down for a few seconds, then reboots (no lives lost).
//    Each shutdown dealt and each first-to-the-arch scores a point.
// ============================================================
(function(){
  if(!window.MV_BETA_LAB) return;
  const MODES=['solo','coop','vs'];
  const qm=(location.search.match(/[?&]party=(\w+)/)||[])[1];
  const P=window.MV_PARTY={mode:(MODES.includes(qm)||qm==='none')?qm:'solo', hero:'mind', score:[0,0], farT:0, archDone:false};
  P.idx=()=>Math.max(0,MODES.indexOf(P.mode));
  P.fromSelect=()=>{ P.mode=MODES[_playModeIdx]||'solo'; P.hero=_heroChoice==='venture'?'venture':'mind'; P.score=[0,0]; };
  P.save=()=>({mode:P.mode, hero:P.hero});
  P.load=s=>{ if(!s) return; if(MODES.includes(s.mode)) P.mode=s.mode; if(s.hero==='mind'||s.hero==='venture') P.hero=s.hero; };

  const OFF_T=150, VS_SHOT=10, VS_HIT=20, ITEM_NAMES=['TRS','RCA','XLR','MAG'];
  const NAME=pl=>pl&&pl.hero==='venture'?'VENTURE':'MIND';
  const other=h=>h==='mind'?'venture':'mind';
  const clamp=(v,a,b)=>v<a?a:v>b?b:v;
  const say=t=>{ if(typeof uiShowToast==='function') uiShowToast(t); };
  const snd=(n,a)=>{ try{ sfx(n,a); }catch(e){} };
  const B=()=>window.MV_BETA;
  const firstItem=()=>{ const i=[1,2,3,0].find(i=>_unlockedMask&(1<<i)); return i==null?-1:i; };
  const nextItem=cur=>{ for(let k=1;k<=4;k++){ const c=((cur<0?0:cur)+k)%4; if(_unlockedMask&(1<<c)) return c; } return cur; };
  const center=pl=>({x:pl.x+SW*0.5, y:pl.y+FEET_OFF-STAND_H*0.5});
  const withItem=(it,fn)=>{ const keep=ITEM; ITEM=it; try{ return fn(); } finally{ ITEM=keep; } };
  const burst=(x,y,col,n)=>{ for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2, s=1.5+Math.random()*3.5;
    PFXS.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,life:16+Math.random()*12|0,maxLife:28,r:2+Math.random()*3,col}); } };

  // ── Stage spawn: both siblings, side by side ───────────────────
  function spawn(){
    if(!p) return;
    _heroChoice=P.hero; p.hero=P.hero; p._offT=0; p._flyIn=false; p._pvpInv=0;
    P.farT=0; P.archDone=false;
    if(P.mode==='none'){ _playerCount=1; p2=null; return; }
    _playerCount=P.mode==='solo'?1:2;
    p2=mkP(); p2.hero=other(P.hero); p2._aiCompanion=P.mode==='solo';
    p2.x=p.x+(P.mode==='vs'?56:36); p2.y=p.y; p2.vx=0; p2.vy=0; p2.og=true; p2.fc=false;
    p2.hp=p2.maxHp||PLAYER_MAX_HP; p2._offT=0; p2._flyIn=false; p2._pvpInv=0; p2.item=firstItem();
  }
  (function hook(){ if(window.MV_BETA) MV_BETA.onPlayersSpawn=spawn; else requestAnimationFrame(hook); })();

  // ── Shut down / reboot (VS knockouts and P2 in co-op) ───────────
  function shutDown(t,by){
    t._offT=OFF_T; t.hp=0; _syncLivesFromHp(t); t.vx*=0.3; t._jf=0;
    if(by&&P.mode==='vs'){ P.score[by===p?0:1]++; say(NAME(by)+' SHUT '+NAME(t)+' DOWN'); }
    else say(NAME(t)+' SHUT DOWN - REBOOTING');
    snd('shutdown');
  }
  function reboot(t){
    t._offT=0; t.hp=t.maxHp||PLAYER_MAX_HP; _syncLivesFromHp(t); t._pvpInv=90; t.flashF=Math.max(t.flashF||0,16);
    burst(t.x+SW/2,t.y+FEET_OFF-STAND_H*0.5,'#c9a0ff',14); snd('chargeReady');
  }
  function hurt(t,a,dmg,kx,ky){
    if(!t||t._offT>0||t._flyIn||(t._pvpInv||0)>0) return false;
    if(t===p&&_shutdownTimer>0) return false;
    t.hp=Math.max(0,(t.hp||0)-dmg); _syncLivesFromHp(t);
    t._pvpInv=30; t.flashF=Math.max(t.flashF||0,12);
    t.vx=clamp(kx,-9,9); t.vy=Math.min(t.vy||0,ky); t.og=false;
    if(t===p&&B().stats) B().stats.hits++;
    if(t.hp<=0) shutDown(t,a);
    else snd('player_hit',typeof _hitSfxPitch==='function'?_hitSfxPitch(t.hp,t.maxHp||PLAYER_MAX_HP):undefined);
    return true;
  }

  // ── Fly back in from above (the partner never just pops in) ─────
  function flyTick(q,lead){
    if(!q._flyIn){
      q._flyIn=true; q._flyT=0; q._jf=0;
      q.x=lead.x-(lead.fc?90:-90); q.y=Math.min(lead.y,camY)-140; q.vx=0; q.vy=0; q.og=false;
      if(q.hook&&q.hook.st!=='idle') q.hook.st='idle';
    }
    q._flyT++;
    const tx=lead.x-(lead.fc?48:-48), ty=lead.y, dx=tx-q.x, dy=ty-q.y;
    q.vx=clamp(dx*0.12,-12,12); q.vy=clamp(dy*0.08,-6,7);
    q.x+=q.vx; q.y+=q.vy; q.og=false;
    if(dx>2) q.fc=true; else if(dx<-2) q.fc=false;
    if((Math.abs(dx)<26&&Math.abs(dy)<20&&lead.og)||q._flyT>300){ q._flyIn=false; q.vy=0; q.vx=(lead.vx||0)*0.5; q.x=tx; q.y=ty; }
  }
  function offTick(q){
    q._offT--; q.vx*=0.85; q.vy=Math.min((q.vy||0)+GRAV,14);
    if(q!==p) _movePlayerWithColl(q,q.vx,q.vy);
    if(q._offT<=0) reboot(q);
  }

  // ── 1P partner: Sonic 2's Tails, but it's the other sibling ─────
  const _ai=window._updateCompanionAI;
  window._updateCompanionAI=function(){
    if(!p2||!p) return;
    if(p2._offT>0){ _coopRollX0=p2.x; _coopRollY0=p2.y; offTick(p2); return; }
    const far=Math.abs(p.x-p2.x)>320||Math.abs(p.y-p2.y)>260||p2.y>WH+40;
    if(p2._flyIn||far){ _coopRollX0=p2.x; _coopRollY0=p2.y; flyTick(p2,p); return; }
    const was=!!p2.og;
    const r=_ai.apply(this,arguments);
    if(was&&!p2.og&&p2.vy<0) p2._jf=JMH;              // a full held jump, so it clears real ledges
    if(p2._jf>0&&p2.vy<0){ p2.vy=Math.max(p2.vy-JHH-GRAV*0.62,JMX); p2._jf--; } else p2._jf=0;
    return r;
  };
  const _fight=window._companionFight;
  window._companionFight=function(threat,help){
    if(_unlockedMask&1) return _fight.apply(this,arguments);   // TRS: shoots like before
    if(!p2||!threat) return;                                    // no TRS yet: walks up and punches
    const me=center(p2), ex=threat.x+threat.w*0.5, ey=threat.y+threat.h*0.5;
    p2._aiPunchCd=(p2._aiPunchCd||0)-1;
    if(Math.hypot(ex-me.x,ey-me.y)<64&&p2._aiPunchCd<=0){
      p2.fc=ex>me.x; p2.pt=6; p2._aiPunchCd=26; snd('punch');
      if(_enemyCombatActive(threat)) _damageEnemy(threat,ENM_DMG.punch,p2.x+SW/2,p2.y+FEET_OFF,1.05);
    }
  };

  // ── P2 (co-op / VS): own item, run, held jump, 2nd controller ───
  const pad2={prev:{}};
  const PAD_MAP=[[0,'ArrowUp'],[2,'Numpad1'],[3,'Numpad2'],[1,'Numpad3'],[4,'ArrowDown'],[5,'Numpad0']];
  function pollPad2(){
    if(_playerCount!==2||!navigator.getGamepads) return;
    const list=[...navigator.getGamepads()].filter(g=>g&&g.connected);
    if(list.length<2) return;
    if(GP.pad&&GP.pad.index!==list[0].index) GP.pad=list[0];    // first controller = P1, second = P2
    const g=list[1], b=i=>!!(g.buttons[i]&&g.buttons[i].pressed), ax=g.axes[0]||0;
    const st={ArrowLeft:ax<-0.5||b(14), ArrowRight:ax>0.5||b(15)};
    for(const [i,c] of PAD_MAP) st[c]=b(i);
    for(const c in st){
      if(st[c]&&!pad2.prev[c]){ K2[c]=true; Kj2[c]=true; }
      else if(!st[c]&&pad2.prev[c]) K2[c]=false;
      pad2.prev[c]=st[c];
    }
    if(b(9)&&!pad2.prev.start) Kj.Escape=true;
    pad2.prev.start=b(9);
  }
  function forceOn(a,t,it){
    if(!t||t._offT>0||t._flyIn) return;
    const ca=center(a), ct=center(t), dx=ct.x-ca.x, dy=ct.y-ca.y, d=Math.hypot(dx,dy)||1, range=it===2?155:190;
    if(d>range) return;
    const s=Math.pow(1-d/range,1.3)*(it===2?1.9:1.6)*(it===2?1:-1);
    t.vx=clamp(t.vx+dx/d*s,-12,12); t.vy=clamp(t.vy+dy/d*s*0.5-(it===2?0.15:0),-9,12);
  }
  window.updateCoopPlayer2=function(){
    if(!p2) return;
    _coopRollX0=p2.x; _coopRollY0=p2.y;
    if(p2._offT>0){ offTick(p2); return; }
    if(p2._flyIn){ flyTick(p2,p); return; }
    const dir=(K2.ArrowRight?1:0)-(K2.ArrowLeft?1:0);
    const run=!!(dir&&(K2.Numpad0||K2.Numpad1));
    const cap=run?MOVE_RUN:MOVE_WALK*MOVE_PEAK, acc=run?MOVE_RUN_ACCEL:MOVE_ACCEL;
    if(dir){
      if(p2.og&&p2.vx*dir<0) p2.vx*=0.82;
      p2.vx+=dir*acc;
      if(Math.abs(p2.vx)>cap) p2.vx=Math.sign(p2.vx)*Math.max(cap,Math.abs(p2.vx)-0.3);
      p2.fc=dir>0;
    }else{ p2.vx*=p2.og?MOVE_STOP:AIR_DRIFT; if(Math.abs(p2.vx)<0.15) p2.vx=0; }
    p2.aimDX=p2.fc?1:-1; p2.aimDY=0; p2.tAimDX=p2.aimDX; p2.tAimDY=0;
    if(Kj2.ArrowUp&&p2.og){ p2.vy=JI; p2._jf=JMH; p2.og=false; snd('jump_reg'); }
    const holdJ=!!K2.ArrowUp&&p2._jf>0&&p2.vy<0;
    if(holdJ){ p2.vy=Math.max(p2.vy-JHH,JMX); p2._jf--; } else if(!K2.ArrowUp) p2._jf=0;

    if(!(p2.item>=0&&(_unlockedMask&(1<<p2.item)))) p2.item=firstItem();
    if(Kj2.Numpad3&&p2.item>=0){ p2.item=nextItem(p2.item); p2._itemNoteT=70; }
    const it=p2.item;
    if(Kj2.Numpad1&&(it===0||it===1)){
      withItem(it,()=>withPlayerContext(p2,()=>fireItem(false)));
      if(p2.shots&&p2.shots.length){ p.shots.push(...p2.shots); p2.shots.length=0; }
    }
    if(K2.Numpad1&&(it===2||it===3)){
      const ca=center(p2), range=it===2?155:190, fdir=p2.fc?1:-1;
      for(const e of ENEMS){ if(!_enemyBodyPresent(e)) continue; const hb=_enemyItemHB(e), dx=hb.x+hb.w/2-ca.x, dy=hb.y+hb.h/2-ca.y, d=Math.hypot(dx,dy)||1; if(d>range) continue;
        const s=Math.pow(1-d/range,1.4)*2.1; if(it===2) _applyItemForceToEnemy(e,fdir*s,dy/d*0.15); else _applyItemForceToEnemy(e,-dx/d*s,-dy/d*s); }
      for(const c of CRATES){ const dx=c.x+c.w/2-ca.x, dy=c.y+c.h/2-ca.y, d=Math.hypot(dx,dy)||1; if(d>range) continue;
        const s=Math.pow(1-d/range,1.3)*1.9; if(it===2){ c.vx+=fdir*s; c.vy+=dy/d*0.12; } else { c.vx-=dx/d*s; c.vy-=dy/d*s; } }
      if(it===3) for(const k of KDROP){ if(k.got) continue; const dx=ca.x-k.x, dy=ca.y-k.y, d=Math.hypot(dx,dy)||1; if(d>range) continue;
        const s=Math.pow(1-d/range,1.25)*1.8; k.vx=(k.vx||0)+dx/d*s; k.vy=(k.vy||0)+dy/d*s; }
      if(P.mode==='vs') forceOn(p2,p,it);
    }
    if(Kj2.Numpad2){
      p2.pt=6; snd('punch');
      const fx=p2.x+SW/2+(p2.fc?AIM_LEN:-AIM_LEN), fy=p2.y+20, fr4=10;
      let hitAny=false;
      for(const e of ENEMS){
        if(!_enemyPunchable(e)||!ov(fx-fr4,fy-fr4,fr4*2,fr4*2,e.x,e.y,e.w,e.h)) continue;
        if(_enemyRebootInterruptable(e)) _tryInterruptMindReboot(e);
        else if(_enemyCombatActive(e)) _damageEnemy(e,ENM_DMG.punch,p2.x+SW/2,p2.y+FEET_OFF,1.05);
        else _nudgeEnemyBody(e,(p2.fc?1:-1)*4,0);
        hitAny=true;
      }
      for(const bw of BWALLS){
        if(bw.hp<=0||!ov(fx-fr4,fy-fr4,fr4*2,fr4*2,bw.x,bw.y,bw.w,bw.h)) continue;
        _damageBwall(bw,'punch',{shakeX:(p2.fc?1:-1)*4,shakeY:-2,vx:bw.movable?(p2.fc?6:-6):0,vy:bw.movable?-2:0});
        spawnDebris(bw,8); hitAny=true;
      }
      if(P.mode==='vs'){ const h=playerCoreHB(p); if(ov(fx-18,p2.y,36,FEET_OFF,h.x,h.y,h.w,h.h)&&hurt(p,p2,VS_HIT,(p2.fc?1:-1)*7,-4)) hitAny=true; }
      if(hitAny) p2.vx+=(p2.fc?-1:1)*1.2;
    }
    withItem(it,()=>withPlayerContext(p2,()=>{ if(p2.hook&&p2.hook.st!=='idle') updateHook(); }));
    if(p2.hook&&p2.hook.st==='on') return;
    p2.vy=Math.min(p2.vy+(holdJ?GRAV*0.38:GRAV),14);
    _movePlayerWithColl(p2,p2.vx,p2.vy);
    if(p2.y<20){ p2.y=20; p2.vy=Math.max(0,p2.vy); }
    if(p2.y>WH+60){ flyTick(p2,p); return; }
    if(p2.inv>0) p2.inv--;
    const hc=playerCoreHB(p2);
    for(const e of ENEMS){
      if(!_enemyCombatActive(e)||p2.inv>0||!ov(hc.x,hc.y,hc.w,hc.h,e.x,e.y,e.w,e.h)) continue;
      p2.hp=Math.max(0,(p2.hp||PLAYER_MAX_HP)-PLAYER_HIT_DMG); _syncLivesFromHp(p2); p2.inv=80;
      const k=_knockVecFrom(p2.x+SW/2,p2.y+FEET_OFF-STAND_H*0.45,e.x+e.w/2,e.y+e.h/2,KB_PLAYER_H*0.9,KB_PLAYER_V*0.9);
      p2.vx=clamp((p2.vx||0)*0.38+k.x,-5,5); p2.vy=clamp(Math.min(p2.vy||0,0.4)+k.y,-3,1);
      snd('hurt',_hitSfxPitch(p2.hp,p2.maxHp||PLAYER_MAX_HP));
      if(p2.hp<=0) shutDown(p2,null);
      break;
    }
  };

  // ── VS: shots, punches, stomps, XLR/MAG between the siblings ─────
  function vsTick(){
    if(!p2) return;
    for(let i=p.shots.length-1;i>=0;i--){
      const s=p.shots[i], t=s.owner===p.hero?p2:(s.owner===p2.hero?p:null);
      if(!t) continue;
      const h=playerCoreHB(t);
      if(!ov(s.x-6,s.y-6,12,12,h.x,h.y,h.w,h.h)) continue;
      if(hurt(t,t===p?p2:p,VS_SHOT,Math.sign(s.vx||1)*4,-2.5)){ spawnHitBurst(s.x,s.y,s.vx,s.vy,'#ff6080',10); p.shots.splice(i,1); }
    }
    if(p.pt>0&&!p._pvpPunch&&!p._offT){
      p._pvpPunch=true;
      const fx=p.x+SW/2+(p.fc?AIM_LEN:-AIM_LEN), h=playerCoreHB(p2);
      if(ov(fx-18,p.y,36,FEET_OFF,h.x,h.y,h.w,h.h)) hurt(p2,p,p.pt>=7?VS_HIT+10:VS_HIT,(p.fc?1:-1)*7,-4);
    }else if(p.pt<=0) p._pvpPunch=false;
    for(const [a,t] of [[p,p2],[p2,p]]){
      if(a._offT||a._flyIn||a.og||a.vy<=1.5) continue;
      const h=playerCoreHB(t), feet=a.y+FEET_OFF, fL=a.x+FEET_L, fR=fL+FEET_W;
      if(feet>=h.y-4&&feet<=h.y+18&&fR>h.x+4&&fL<h.x+h.w-4&&hurt(t,a,VS_HIT,(a.vx||0)*0.5,1)){ a.vy=-9; a.og=false; }
    }
    if(!p._offT&&(ITEM===2||ITEM===3)&&_bindDown('swap')&&!(typeof _runOnly!=='undefined'&&_runOnly)&&(p.itemStamina||0)>0) forceOn(p,p2,ITEM);
  }

  // ── Keep the pair on one screen: whoever is behind catches up ────
  function leash(){
    if(!p2||P.mode==='solo'||p2._flyIn||p2._offT||p._offT) return;
    const far=Math.abs(p.x-p2.x)>camViewW()*0.82||Math.abs(p.y-p2.y)>camViewH()*0.8;
    P.farT=far?P.farT+1:0;
    if(P.farT<45) return;
    P.farT=0;
    const g=B().gate, gx=g?g.x+g.w/2:p.x;
    if(Math.abs(p2.x-gx)>=Math.abs(p.x-gx)) flyTick(p2,p);
    else{
      burst(p.x+SW/2,p.y+FEET_OFF-STAND_H*0.5,'#c9a0ff',10);
      p.x=p2.x-(p2.fc?48:-48); p.y=p2.y; p.vx=0; p.vy=0;
      if(p.hook&&p.hook.st!=='idle') p.hook.st='idle';
      burst(p.x+SW/2,p.y+FEET_OFF-STAND_H*0.5,'#c9a0ff',10);
    }
  }

  // ── A shut-down P1 can't act; enemies leave a downed / flying one alone ──
  function blankP1(){ for(const k in K) if(k!=='Escape'&&k!=='Tab') K[k]=false; for(const k in Kj) if(k!=='Escape'&&k!=='Tab') delete Kj[k]; }
  const _rg=window.readGamepad;
  window.readGamepad=function(){ const r=_rg.apply(this,arguments); if(p&&p._offT>0&&_gameState==='game') blankP1(); return r; };
  const _hit=window.applyPlayerHit;
  window.applyPlayerHit=function(){ if(p&&(p._offT>0||p._flyIn)) return; return _hit.apply(this,arguments); };

  const live=()=>{ const b=B(); return b&&b.on&&_gameState==='game'&&!_paused&&p&&!b.popup&&!b.results&&!b.trans&&!win&&!_gameOver; };
  const _upd=window.update;
  window.update=function(){
    const b=B(), on=live();
    if(on){ pollPad2(); if(p._offT>0) blankP1(); }
    const r=_upd.apply(this,arguments);
    if(on&&p){
      if(p._offT>0){ p._offT--; p.vx*=0.8; if(p._offT<=0) reboot(p); }
      for(const q of [p,p2]) if(q&&q._pvpInv>0) q._pvpInv--;
      if(p2&&p2._itemNoteT>0) p2._itemNoteT--;
      if(P.mode==='vs') vsTick();
      leash();
    }
    if(b&&b.on&&P.mode==='vs'&&b.cleared&&b.archBy&&!P.archDone){
      P.archDone=true; P.score[b.archBy-1]++;
      say(NAME(b.archBy===1?p:p2)+' REACHED THE ARCH FIRST');
    }
    return r;
  };

  // ── Draw: rotor while flying in, OFF + reboot bar, P1/P2 tags, VS score ──
  const _dc=window.drawCharacter;
  window.drawCharacter=function(){
    const q=p, b=B();
    if(!q||!b||!b.on) return _dc.apply(this,arguments);
    const off=q._offT>0;
    if(off&&fr%8<3) return;                         // powered off: dim flicker (no canvas filter — keeps FPS)
    try{ return _dc.apply(this,arguments); }
    finally{
      const cx=sx(q.x+SW/2), top=sy(q.y+FEET_OFF-STAND_H)-34;
      if(q._flyIn){
        const w=6+Math.abs(Math.cos(fr*0.7))*26;
        ctx.fillStyle='#3a2a50'; ctx.fillRect(cx-1,top+4,3,12);
        ctx.fillStyle=q.hero==='venture'?'#ff9fb0':'#c9a0ff'; ctx.fillRect(Math.round(cx-w),top,Math.round(w*2),4);
      }
      if(off){
        if(fr%30<20) drawTextC('OFF',cx,top-14,C.RED_L,2);
        ctx.fillStyle='#000'; ctx.fillRect(cx-22,top+2,44,6);
        ctx.fillStyle=C.PURPLE_L; ctx.fillRect(cx-21,top+3,Math.round(42*(1-q._offT/OFF_T)),4);
      }else if(_playerCount===2&&!q._flyIn){
        drawTextC(q===p2?'P2':'P1',cx,top-6,q===p2?C.PINK:C.SKY_L,2);
        if(q===p2&&q._itemNoteT>0&&q.item>=0) drawTextC(ITEM_NAMES[q.item],cx,top-24,C.SAND,2);
      }
    }
  };
  const _draw=window.draw;
  window.draw=function(){
    const r=_draw.apply(this,arguments);
    const b=B();
    if(b&&b.on&&_gameState==='game'&&P.mode==='vs'&&p2){
      const t='P1 '+NAME(p)+' '+P.score[0]+'   VS   '+P.score[1]+' '+NAME(p2)+' P2', w=t.length*12+28;
      ctx.fillStyle='rgba(0,0,0,0.72)'; ctx.fillRect(Math.round(W/2-w/2),6,w,26);
      drawTextC(t,W/2,12,C.WHITE,2);
    }
    return r;
  };
})();
