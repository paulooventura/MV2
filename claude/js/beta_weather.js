// ============================================================
//  beta_weather.js — the water cycle (Paulo, Oct 22: "if we turn too much
//  water [to vapor] eventually it should rain… the cloud system resonating
//  with the liquid water / heat")
//
//  Water the TRS boils away doesn't vanish: it goes up as vapor (beta_water
//  F.vapor). The vapor builds clouds over the stage — the night sky dims and
//  a cloud deck rolls in, thicker the more there is. Past a threshold it
//  rains: real drops (beta_water B.drops) fall from above the screen wherever
//  the air is open to the sky, land on roofs, ground and pools, and flow like
//  any other water — so the vapor comes back as water. Heavy rain flashes
//  lightning with far thunder. It rains until the clouds have given their
//  water back.
//  Sound: rain hiss heard from MIND's spot — full outside, a dull drum on the
//  roof indoors, a far rumble in caves (beta_spatial env).
// ============================================================
(function(){
  'use strict';
  const RAIN_START=9.0, RAIN_STOP=2.0, DROP_M=0.012, MAX_DROPS_FR=2;   // Paulo (Oct 22): more water to form, slower to fall, less present
  const BREW=420;                                       // ~7 s of a heavy sky before the first drop
  const W0={cloud:0, rain:0, raining:false, flash:0, thunderT:0, brew:0};
  const S=W0;
  const sv=()=>{ try{ return Math.max(0,Math.min(1,OPT.sfxVol!=null?OPT.sfxVol:1)); }catch(e){ return 1; } };
  const solidAt=(x,y)=>{ try{ return typeof gridWorldSolid==='function'&&gridWorldSolid(x,y); }catch(e){ return false; } };

  function tick(){
    const B=window.MV_BETA; if(!B||!B.on||typeof B.vaporNow!=='function') return;
    if(_gameState!=='game'||(typeof _paused!=='undefined'&&_paused)||B.popup||B.loading){ audioTick(); return; }
    const v=B.vaporNow();
    // clouds follow the vapor (slowly), rain starts past the threshold and stops when it's spent
    const cloudT=Math.min(1,v/(RAIN_START*2.2));
    S.cloud+=(cloudT-S.cloud)*0.005;
    S.brew=v>=RAIN_START?S.brew+1:Math.max(0,S.brew-2);
    if(!S.raining&&S.brew>=BREW) S.raining=true;
    if(S.raining&&v<=RAIN_STOP){ S.raining=false; S.brew=0; }
    const rainT=S.raining?Math.min(1,0.35+v/(RAIN_START*3)):0;
    S.rain+=(rainT-S.rain)*(rainT>S.rain?0.006:0.02);
    if(S.rain>0.02&&typeof camX==='number'){
      // drops from just above the view, only where the air above is open
      const z=(typeof camZoom==='number'&&camZoom)||1, vw=W/z, n=Math.round(MAX_DROPS_FR*S.rain);
      for(let i=0;i<n;i++){
        const x=camX-60+Math.random()*(vw+120), y=camY-30-Math.random()*40;
        if(x<4||(typeof WW==='number'&&x>WW-4)||solidAt(x,y)||(B.underRoof&&B.underRoof(x,y))) continue;   // inside the world only, never under a roof
        const m=B.vaporTake(DROP_M); if(m<=0) break;
        B.drops.push({x, y, vx:-0.6-Math.random()*0.5, vy:7+Math.random()*3, m, rain:true});
      }
      if(S.rain>0.8&&--S.thunderT<=0){ S.thunderT=600+Math.random()*900; S.flash=1; setTimeout(thunder,400+Math.random()*1600); }
    }
    if(S.flash>0) S.flash*=0.86;
    audioTick();
  }
  // ── drawing: a cloud deck over the sky (called by beta_sky after the sky), lightning over all ──
  function sky(horizon){
    if(S.cloud<0.02) return;
    ctx.save();
    ctx.fillStyle='rgba(6,10,14,'+(0.72*S.cloud).toFixed(3)+')'; ctx.fillRect(0,0,W,H);      // the night dims
    const cx=typeof camX==='number'?camX:0, t=(typeof fr==='number'?fr:0);
    for(let i=0;i<22;i++){                                 // rolling cloud banks, pixel-chunky
      const w=220+((i*97)%180), h=60+((i*53)%60), x=((i*233-cx*0.05-t*0.25*(1+(i%3)*0.3))%(W+400)+W+400)%(W+400)-200, y=(i%6)*Math.max(30,(horizon-140)/6)+((i*29)%30)-20;
      ctx.fillStyle='rgba('+(24+i%3*6)+','+(34+i%3*6)+','+(40+i%3*6)+','+Math.min(0.95,1.1*S.cloud).toFixed(3)+')';
      for(let k=0;k<5;k++){ const bx=x+k*w/5, bh=h*(0.6+0.4*Math.sin(k*1.7+i)); ctx.fillRect(Math.round(bx/3)*3,Math.round((y+h-bh)/3)*3,Math.ceil(w/5/3)*3+3,Math.round(bh/3)*3); }
    }
    if(S.flash>0.05){ ctx.fillStyle='rgba(200,220,255,'+(0.35*S.flash).toFixed(3)+')'; ctx.fillRect(0,0,W,horizon+80); }
    ctx.restore();
  }
  function post(){
    if(S.rain<0.02&&S.flash<0.05) return;
    ctx.save();
    if(S.rain>0.02){                                      // fine streaks over everything outside (the drops themselves are real)
      const E=window.MV_SPATIAL&&MV_SPATIAL.env, out=E?Math.max(0,1-E.inside)*Math.min(1,E.sky*1.6):1;
      if(out>0.05){ ctx.save();
        const B=window.MV_BETA, cut=new Path2D(); cut.rect(-10,-10,W+20,H+20); let any=false;      // houses keep the streaks out
        for(const r of ((B&&B.rooms)||[]).concat(((B&&B.decor)||[]).filter(d=>d.kind==='houseInside'))){ const x0=sx(r.x), y0=sy(r.y), x1=sx(r.x+r.w), y1=sy(r.y+r.h); if(x1<0||x0>W||y1<0||y0>H) continue; cut.rect(x0,y0,x1-x0,y1-y0); any=true; }
        if(any) ctx.clip(cut,'evenodd');
        ctx.strokeStyle='rgba(190,210,225,'+(0.09*S.rain*out).toFixed(3)+')'; ctx.lineWidth=1; ctx.beginPath();
        const n=Math.round(45*S.rain*out), t=fr||0;
        for(let i=0;i<n;i++){ const x=((i*137+t*9)%(W+60))-30, y=((i*311+t*23)%(H+40))-20; ctx.moveTo(x,y); ctx.lineTo(x-4,y+14); }
        ctx.stroke(); ctx.restore(); }
    }
    if(S.flash>0.05){ ctx.fillStyle='rgba(220,235,255,'+(0.18*S.flash).toFixed(3)+')'; ctx.fillRect(0,0,W,H); }
    ctx.restore();
  }
  // ── sound ──
  let A=null, N=null;
  function ac(){ try{ return (typeof _audioUnlocked!=='undefined'&&_audioUnlocked&&typeof ga==='function')?ga():null; }catch(e){ return null; } }
  function build(a){
    const len=a.sampleRate*2, buf=a.createBuffer(2,len,a.sampleRate);
    for(let c=0;c<2;c++){ const d=buf.getChannelData(c); let b=0; for(let i=0;i<len;i++){ const w=Math.random()*2-1; b=0.9*b+0.1*w; d[i]=w*0.5+b; } }
    const src=a.createBufferSource(); src.buffer=buf; src.loop=true;
    const hp=a.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=400;
    const lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=7000;
    const g=a.createGain(); g.gain.value=0;
    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(a.destination); src.start();
    return {g,lp};
  }
  function audioTick(){
    const a=ac(); if(!a||a.state!=='running') return;
    if(a!==A){ A=a; N=build(a); }
    const B=window.MV_BETA, live=B&&B.on&&_gameState==='game'&&!(typeof _paused!=='undefined'&&_paused);
    const E=window.MV_SPATIAL&&MV_SPATIAL.env;
    const inside=E?E.inside:0, under=E?E.under:0, sky=E?E.sky:1;
    const exp=Math.max(0.12,Math.min(1,sky*1.4))*(1-0.55*inside)*(1-0.8*under);
    const t=a.currentTime;
    N.g.gain.setTargetAtTime(live?0.08*S.rain*exp*sv():0,t,0.5);
    N.lp.frequency.setTargetAtTime(inside>0.5?900:under>0.5?500:7000*(0.5+0.5*sky),t,0.4);   // on the roof / through rock: dull
  }
  function thunder(){
    const a=ac(); if(!a||a.state!=='running') return;
    const t=a.currentTime, len=a.sampleRate*3, buf=a.createBuffer(1,len,a.sampleRate), d=buf.getChannelData(0); let b=0;
    for(let i=0;i<len;i++){ b=0.995*b+0.005*(Math.random()*2-1); d[i]=b*8*Math.pow(1-i/len,1.5)*(i<a.sampleRate*0.05?i/(a.sampleRate*0.05):1); }
    const s=a.createBufferSource(); s.buffer=buf; const lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=220; const g=a.createGain();
    const E=window.MV_SPATIAL&&MV_SPATIAL.env; g.gain.value=0.5*sv()*(E?(1-0.5*E.inside)*(1-0.6*E.under):1);
    s.connect(lp); lp.connect(g); g.connect(a.destination); s.start(t); s.stop(t+3);
  }
  setInterval(()=>{ try{ tick(); }catch(e){} },16);
  window.MV_WEATHER={state:S, sky, post};
})();
