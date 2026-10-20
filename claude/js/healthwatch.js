// ============================================================
//  healthwatch.js — lightweight always-on glitch sentinel
//  Runs cheap checks every ~45 logic frames while in-game.
//  window.__MV_HEALTH holds the rolling issue log for agents.
// ============================================================
(function(){
  const CAP=32, INTERVAL=45;
  let issues=[], checks=0, lastTick=0;

  function rec(type, extra){
    const s={type, f:(typeof fr!=='undefined'?fr:0), t:Date.now()};
    if(extra) for(const k in extra) s[k]=extra[k];
    issues.push(s);
    if(issues.length>CAP) issues.shift();
  }

  function tick(){
    if(typeof _gameState==='undefined'||_gameState!=='game'||!p) return;
    if(typeof fr==='undefined'||(fr%INTERVAL)!==0) return;
    checks++;
    lastTick=Date.now();
    const FO=(typeof FEET_OFF!=='undefined'?FEET_OFF:88);
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.vx)||!Number.isFinite(p.vy)){
      if(typeof _sanitizeActorVel==='function') _sanitizeActorVel(p);
      rec('nonFinite');
    }
    if(typeof WH!=='undefined'&&p.y+FO>WH+240) rec('fellOut');
    if((p._grindF||0)>=4) rec('pushGrind',{grindF:p._grindF});
  }

  window.__MV_HEALTH={
    tick, get issues(){ return issues.slice(); }, get checks(){ return checks; },
    get lastTick(){ return lastTick; },
    clear(){ issues.length=0; },
    summary(){
      const c={};
      for(const i of issues) c[i.type]=(c[i.type]||0)+1;
      return c;
    }
  };
})();
