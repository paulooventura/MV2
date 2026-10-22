// ============================================================
//  beta_weather.js — the water cycle as a threat (Paulo, Oct 22, build 265)
//
//  Water the TRS boils away doesn't vanish: it goes up as vapor (beta_water
//  F.vapor) and the sky answers to how much is up there and how fast it went:
//
//   a little vapor      → a HAZE: the night goes milky, the stars and moon soften
//   ~ the 1.2 bottom-left pool's worth (RAIN_START)
//                       → the STORM BREWS for 30 s: clouds roll in, the night darkens,
//                         thunder grumbles far off and builds (the charge growing),
//                         sheet lightning flickers in the clouds — then it RAINS
//   more on top (the bottom-right room too, STRIKE_START)
//                       → LIGHTNING STRIKES: random bolts, mostly on the high places
//                         (and on MIND when he's charged). Each one is telegraphed by a
//                         crackle on the spot ~1 s before. A hit takes a big bite of HP.
//                         Out in that rain MIND builds up STATIC (the rain's electricity):
//                         fully charged, he draws the next bolt. Cover (a roof, a cave)
//                         drains it; the Isolator keeps it off — and takes a bolt for him,
//                         but the bolt knocks it off.
//
//  More vapor → more rain (and longer). Boil a lot AT ONCE and the rain comes
//  down as a torrent; a slow trickle of steam makes gentler rain. The rain falls
//  as real drops (beta_water B.drops) so the vapor comes back as water, and the
//  sky clears again once the clouds have given it back.
//
//  Light and sound follow the sky: haze milks the view, the storm darkens and
//  cools it, lightning lights everything; crickets fall quiet and the wind picks
//  up (beta_ambience reads MV_WEATHER.state), rain hiss grows to a roar.
// ============================================================
(function(){
  'use strict';
  const HAZE_MIN=10, HAZE_FULL=220;          // vapor units (a full fluid cell = 1; the 1.2 bottom-left pool holds ~500)
  const RAIN_START=360, RAIN_STOP=70;
  const STRIKE_START=560, STRIKE_STOP=430;
  const BREW=1800;                            // 30 s of a gathering storm before the first drop
  const S={vapor:0, haze:0, cloud:0, charge:0, rain:0, raining:false, brew:0, flash:0, sheet:0,
    rate:0, burst:0, storm:0, strikes:false, rumbleT:120, strikeT:300, bolt:null, tele:null, static:0, lastV:0, taken:0};
  const sv=()=>{ try{ return Math.max(0,Math.min(1,OPT.sfxVol!=null?OPT.sfxVol:1)); }catch(e){ return 1; } };
  const solidAt=(x,y)=>{ try{ return typeof gridWorldSolid==='function'&&gridWorldSolid(x,y); }catch(e){ return false; } };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  // the sky over x: the first solid thing from the top of the world down (null: open all the way)
  function skyHit(x){ const H0=typeof WH==='number'?WH:2400; for(let y=0;y<H0;y+=8) if(solidAt(x,y)) return y; return null; }
  function openAbove(x,y){ for(let yy=y;yy>0;yy-=10) if(solidAt(x,yy)) return false; const B=window.MV_BETA; return !(B&&B.underRoof&&B.underRoof(x,y)); }
  function mindTop(){ return {x:p.x+SW/2, y:p.y+FEET_OFF-STAND_H-WHEEL_R}; }

  function tick(){
    const B=window.MV_BETA; if(!B||!B.on||typeof B.vaporNow!=='function') return;
    if(B.vaporTake&&!B.vaporTake._wx){ const o=B.vaporTake; B.vaporTake=function(n){ const t=o(n); S.taken+=t; return t; }; B.vaporTake._wx=true; }
    if(_gameState!=='game'||(typeof _paused!=='undefined'&&_paused)||B.popup||B.loading){ audioTick(); return; }
    const v=B.vaporNow(); S.vapor=v;
    // how FAST it went up: vapor gained per frame (rain taken back out doesn't count against it)
    const gain=Math.max(0,v-S.lastV+S.taken); S.lastV=v; S.taken=0;
    S.rate=S.rate*0.99+gain*0.01;                                  // ~1.5 s average
    S.burst=Math.max(S.burst*0.9995,clamp(S.rate/0.22,0,1));        // remembered for a while (a big boil-off makes a torrent later)
    // haze: any vapor at all
    S.haze+=(clamp((v-HAZE_MIN)/(HAZE_FULL-HAZE_MIN),0,1)-S.haze)*0.01;
    // the storm brews past RAIN_START, then rains until it's given back
    if(v>=RAIN_START&&!S.raining) S.brew++; else if(!S.raining) S.brew=Math.max(0,S.brew-3);
    S.charge=S.raining?Math.max(S.charge*0.999,clamp(v/STRIKE_START,0.5,1)):clamp(S.brew/BREW,0,1);
    if(!S.raining&&S.brew>=BREW){ S.raining=true; S.brew=0; }
    if(S.raining&&v<=RAIN_STOP){ S.raining=false; S.brew=0; }
    const cloudT=Math.max(clamp(v/RAIN_START,0,1)*0.6, S.raining?1:S.charge);
    S.cloud+=(cloudT-S.cloud)*0.004;
    // rain intensity: how much is up there, and how fast it went up (up to 1.5 = a torrent)
    const rainT=S.raining?clamp(0.3+0.5*(v-RAIN_STOP)/(STRIKE_START)+0.7*S.burst,0.25,1.5):0;
    S.rain+=(rainT-S.rain)*(rainT>S.rain?0.004:0.012);
    // lightning strikes when there's plenty more up there
    if(S.raining&&v>=STRIKE_START) S.strikes=true; else if(!S.raining||v<STRIKE_STOP) S.strikes=false;
    S.storm=Math.max(S.charge*0.8,S.rain>0.02?Math.min(1,0.5+S.rain*0.4):0, S.strikes?1:0);
    // the drops: from just above the view, only where the air above is open
    if(S.rain>0.02&&typeof camX==='number'){
      const z=(typeof camZoom==='number'&&camZoom)||1, vw=W/z, n=Math.round(1+3.5*S.rain*S.rain), m=0.01+0.006*S.rain;
      for(let i=0;i<n;i++){
        if(Math.random()>Math.min(1,S.rain*1.4)) continue;
        const x=camX-60+Math.random()*(vw+120), y=camY-30-Math.random()*40;
        if(x<4||(typeof WW==='number'&&x>WW-4)||solidAt(x,y)||(B.underRoof&&B.underRoof(x,y))) continue;   // inside the world only, never under a roof
        const t=B.vaporTake(m); if(t<=0) break;
        B.drops.push({x, y, vx:-0.6-Math.random()*0.5-S.rain*0.8, vy:7+Math.random()*3+S.rain*2, m:t, rain:true});
      }
    }
    // thunder while it brews (and through the storm): far grumbles, nearer and more often as the charge builds
    if(S.charge>0.15||S.rain>0.1){
      if(--S.rumbleT<=0){
        const k=Math.max(S.charge,S.storm);
        S.rumbleT=Math.round((900-650*k)*(0.6+Math.random()*0.8));
        if(k>0.45&&Math.random()<k) S.sheet=0.6+0.4*Math.random();     // sheet lightning in the clouds
        setTimeout(()=>thunder(0.25+0.6*k,(Math.random()*2-1)*0.7,false),300+Math.random()*1800*(1-k));
      }
    }
    staticTick(B);
    strikeTick(B);
    if(S.flash>0) S.flash*=0.84;
    if(S.sheet>0) S.sheet*=0.9;
    audioTick();
  }

  // ── the rain's electricity: static builds on MIND out in a lightning storm ──
  function staticTick(B){
    if(!p) return;
    const E=window.MV_SPATIAL&&MV_SPATIAL.env, t=mindTop();
    const exposed=S.strikes&&!B.hasIsolator&&(E?(E.inside<0.3&&E.under<0.3):true)&&openAbove(t.x,t.y-10);
    if(exposed) S.static=Math.min(1,S.static+0.0016*(0.6+S.rain*0.6));     // ~10 s in the open, faster in a torrent
    else S.static=Math.max(0,S.static-(B.hasIsolator?0.02:0.006));
    if(S.static>0.25&&Math.random()<S.static*0.5){ const a=Math.random()*Math.PI*2, r=18+Math.random()*26;
      PFXS.push({x:t.x+Math.cos(a)*r,y:t.y+30+Math.sin(a)*r*1.3,vx:(Math.random()-0.5)*1.5,vy:-Math.random()*1.2,life:6+Math.random()*6|0,maxLife:12,r:1.4,col:Math.random()<0.5?'#e8f4ff':'#9ad8ff'}); }
    if(S.static>0.4&&Math.random()<S.static*0.08) crackle(0.15+0.35*S.static);
    if(S.static>=1&&!S.tele){ aimStrike(t.x,t.y,true); S.static=0.6; }    // fully charged: he draws the bolt
  }

  // ── lightning strikes ──
  function aimStrike(x,y,onMind){
    S.tele={x,y,t:0,dur:onMind?42:62,onMind:!!onMind};
  }
  function pickTarget(){
    const z=(typeof camZoom==='number'&&camZoom)||1, vw=W/z, vh=H/z, c=[];
    for(let i=0;i<16;i++){
      const x=camX-80+Math.random()*(vw+160); if(x<8||(typeof WW==='number'&&x>WW-8)) continue;
      const y=skyHit(x); if(y==null||y<camY-260||y>camY+vh) continue;
      const B=window.MV_BETA; if(B&&B.underRoof&&B.underRoof(x,y-6)) continue;
      c.push({x,y,w:0});
    }
    if(!c.length) return null;
    const top=Math.min(...c.map(o=>o.y));
    for(const o of c) o.w=Math.exp(-(o.y-top)/80);                 // the high places draw it
    if(p){ const t=mindTop(); if(openAbove(t.x,t.y-10)&&t.y<camY+vh){ c.push({x:t.x,y:t.y,w:Math.exp(-(t.y-top)/80)*(0.4+2*S.static),mind:true}); } }
    let tot=c.reduce((a,o)=>a+o.w,0), r=Math.random()*tot;
    for(const o of c){ r-=o.w; if(r<=0) return o; }
    return c[0];
  }
  function strikeTick(B){
    if(S.strikes&&!S.tele&&--S.strikeT<=0){
      const k=clamp((S.vapor-STRIKE_START)/300,0,1);
      S.strikeT=Math.round((420-250*k)*(0.6+Math.random()*0.8));   // every ~3–7 s, more often with more vapor up there
      const t=pickTarget(); if(t) aimStrike(t.x,t.y,!!t.mind); else { S.sheet=1; setTimeout(()=>thunder(0.7,(Math.random()*2-1)*0.8,false),500); }
    }
    const T=S.tele;
    if(T){
      T.t++;
      if(T.onMind&&p){ const m=mindTop(); T.x+=(m.x-T.x)*0.08; T.y=m.y; }    // a charged MIND: it follows him (move!)
      if(T.t%3===0) for(let k=0;k<2;k++) PFXS.push({x:T.x+(Math.random()-0.5)*26,y:T.y-Math.random()*8,vx:(Math.random()-0.5)*1.2,vy:-1-Math.random()*2.5,life:8+Math.random()*8|0,maxLife:16,r:1.6,col:Math.random()<0.5?'#ffffff':'#a8d8ff'});
      if(T.t%9===0) crackle(0.25+0.6*T.t/T.dur);
      if(T.t>=T.dur){ strike(B,T.x,T.y); S.tele=null; }
    }
    if(S.bolt&&--S.bolt.life<=0) S.bolt=null;
  }
  function strike(B,x,y){
    // the bolt: jagged, from above the view to the spot, with a couple of branches
    const top=(typeof camY==='number'?camY:y-500)-80, pts=[{x:x+(Math.random()-0.5)*120,y:top}], seg=14;
    for(let i=1;i<seg;i++){ const t=i/seg; pts.push({x:pts[0].x+(x-pts[0].x)*t+(Math.random()-0.5)*46*(1-t*0.6), y:top+(y-top)*t}); }
    pts.push({x,y});
    const br=[]; for(let k=0;k<2;k++){ const j=3+((Math.random()*(seg-6))|0), b=[pts[j]]; let bx=pts[j].x, by=pts[j].y, dir=Math.random()<0.5?-1:1; for(let n=0;n<5;n++){ bx+=dir*(10+Math.random()*22); by+=14+Math.random()*20; b.push({x:bx,y:by}); } br.push(b); }
    S.bolt={pts,br,life:14}; S.flash=1;
    for(let k=0;k<26;k++){ const a=-Math.PI*Math.random(), s=2+Math.random()*5; PFXS.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:12+Math.random()*14|0,maxLife:26,r:1.6+Math.random()*1.6,col:Math.random()<0.4?'#ffffff':(Math.random()<0.5?'#bfe6ff':'#fff2a0')}); }
    // the sound: the crack right away, the roll after
    thunder(1.1,clamp((x-(p?p.x+SW/2:x))/600,-0.9,0.9),true);
    // water it hits goes live
    if(B.strikeWater) B.strikeWater(x,y+6);
    // MIND
    if(p&&!(typeof _shutdownTimer!=='undefined'&&_shutdownTimer>0)){
      const c={x:p.x+SW/2, y:p.y+FEET_OFF-STAND_H*0.5}, d=Math.hypot(c.x-x,(c.y-y)*0.7);
      if(d<110){
        if(B.hasIsolator&&B.knockIsolator){ B.knockIsolator(Math.sign(c.x-x)||1,'bolt'); p.vy=Math.min(p.vy||0,-5); }
        else{
          const dmg=Math.round(62*(1-0.55*clamp((d-30)/80,0,1)));      // a direct hit: ~60 HP
          S.static=0;
          if(typeof applyPlayerHit==='function') applyPlayerHit((Math.sign(c.x-x)||1)*6,-7,dmg);
          if(B) B.shortT=40;
          try{ if(typeof uiShowToast==='function'&&!S._toldBolt){ S._toldBolt=true; uiShowToast('STRUCK BY LIGHTNING! STAY LOW, GET UNDER COVER'); } }catch(e){}
        }
      }
    }
    // enemies near it get fried too
    for(const e of (typeof ENEMS!=='undefined'?ENEMS:[])){ if(!e||!e.alive) continue; const d=Math.hypot(e.x+e.w/2-x,(e.y+e.h/2-y)*0.7); if(d<100&&typeof _damageEnemy==='function') try{ _damageEnemy(e,40,x,y,1.4); }catch(er){} }
  }

  // ── drawing: the cloud deck (beta_sky, after the sky) ──
  function sky(horizon){
    if(S.cloud<0.02&&S.haze<0.02&&S.sheet<0.05&&S.flash<0.05) return;
    ctx.save();
    if(S.haze>0.02){ const g=ctx.createLinearGradient(0,0,0,horizon+120); g.addColorStop(0,'rgba(120,130,150,'+(0.18*S.haze).toFixed(3)+')'); g.addColorStop(1,'rgba(150,158,172,'+(0.32*S.haze).toFixed(3)+')'); ctx.fillStyle=g; ctx.fillRect(0,0,W,horizon+120); }   // the night goes milky
    if(S.cloud>0.02){
      ctx.fillStyle='rgba(6,9,14,'+(0.78*S.cloud).toFixed(3)+')'; ctx.fillRect(0,0,W,H);      // the night dims
      const cx=typeof camX==='number'?camX:0, t=(typeof fr==='number'?fr:0), wind=1+S.storm*1.5;
      for(let i=0;i<24;i++){                               // rolling cloud banks, pixel-chunky
        const w=220+((i*97)%180), h=60+((i*53)%60), x=((i*233-cx*0.05-t*0.25*wind*(1+(i%3)*0.3))%(W+400)+W+400)%(W+400)-200, y=(i%6)*Math.max(30,(horizon-140)/6)+((i*29)%30)-20;
        const lit=S.sheet>0.05&&(i%4===((t>>3)%4))?S.sheet:0;
        const c=22+i%3*6+lit*120;
        ctx.fillStyle='rgba('+(c|0)+','+((c+10)|0)+','+((c+18+lit*30)|0)+','+Math.min(0.96,1.15*S.cloud).toFixed(3)+')';
        for(let k=0;k<5;k++){ const bx=x+k*w/5, bh=h*(0.6+0.4*Math.sin(k*1.7+i)); ctx.fillRect(Math.round(bx/3)*3,Math.round((y+h-bh)/3)*3,Math.ceil(w/5/3)*3+3,Math.round(bh/3)*3); }
      }
    }
    const fl=Math.max(S.flash,S.sheet*0.5);
    if(fl>0.05){ ctx.fillStyle='rgba(200,220,255,'+(0.4*fl).toFixed(3)+')'; ctx.fillRect(0,0,W,horizon+80); }
    ctx.restore();
  }
  // ── over the world: haze, storm light, rain streaks, the warning crackle, the bolt, the flash ──
  function post(){
    const any=S.haze>0.02||S.storm>0.02||S.rain>0.02||S.flash>0.05||S.tele||S.bolt;
    if(!any) return;
    ctx.save();
    const E=window.MV_SPATIAL&&MV_SPATIAL.env, out=E?Math.max(0,1-E.inside)*Math.min(1,E.sky*1.6+0.2):1;
    // light: haze lifts the blacks and softens; the storm darkens and cools
    if(S.haze>0.02){ ctx.fillStyle='rgba(140,150,168,'+(0.10*S.haze*(0.4+0.6*out)).toFixed(3)+')'; ctx.fillRect(0,0,W,H); }
    if(S.storm>0.02){ ctx.fillStyle='rgba(8,14,30,'+(0.26*S.storm*(0.5+0.5*out)).toFixed(3)+')'; ctx.fillRect(0,0,W,H); }
    if(S.rain>0.02&&out>0.05){                            // fine streaks over everything outside (the drops themselves are real)
      ctx.save();
      const B=window.MV_BETA, cut=new Path2D(); cut.rect(-10,-10,W+20,H+20); let anyR=false;      // houses keep the streaks out
      for(const r of ((B&&B.rooms)||[]).concat(((B&&B.decor)||[]).filter(d=>d.kind==='houseInside'))){ const x0=sx(r.x), y0=sy(r.y), x1=sx(r.x+r.w), y1=sy(r.y+r.h); if(x1<0||x0>W||y1<0||y0>H) continue; cut.rect(x0,y0,x1-x0,y1-y0); anyR=true; }
      if(anyR) ctx.clip(cut,'evenodd');
      const k=Math.min(1.5,S.rain), slant=4+k*6, len=14+k*10;
      ctx.strokeStyle='rgba(190,210,225,'+(Math.min(0.2,0.08*k)*out).toFixed(3)+')'; ctx.lineWidth=1; ctx.beginPath();
      const n=Math.round(40*k*k*out), t=fr||0;
      for(let i=0;i<n;i++){ const x=((i*137+t*(9+k*4))%(W+60))-30, y=((i*311+t*(23+k*8))%(H+40))-20; ctx.moveTo(x,y); ctx.lineTo(x-slant,y+len); }
      ctx.stroke();
      if(k>1.05){ ctx.fillStyle='rgba(170,185,200,'+(0.07*(k-1)*out).toFixed(3)+')'; ctx.fillRect(0,0,W,H); }   // a torrent: a grey wall of water
      ctx.restore();
    }
    // the warning: a flicker of current down to the spot it's going to hit
    if(S.tele){
      const T=S.tele, k=T.t/T.dur, x=sx(T.x), y=sy(T.y);
      ctx.save(); ctx.globalCompositeOperation='lighter';
      const g=ctx.createRadialGradient(x,y,2,x,y,sw(46+30*k)); g.addColorStop(0,'rgba(200,230,255,'+(0.25+0.45*k).toFixed(3)+')'); g.addColorStop(1,'rgba(120,170,255,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,sw(46+30*k),0,Math.PI*2); ctx.fill();
      if((fr>>1)%(k>0.7?1:3)===0){ ctx.strokeStyle='rgba(220,240,255,'+(0.18+0.5*k).toFixed(3)+')'; ctx.lineWidth=1.5; ctx.beginPath(); let xx=x+(Math.random()-0.5)*40, yy=0; ctx.moveTo(xx,yy); while(yy<y){ yy+=30+Math.random()*30; xx+=(Math.random()-0.5)*26; ctx.lineTo(yy>y?x:xx,Math.min(y,yy)); } ctx.stroke(); }
      ctx.restore();
    }
    // the bolt itself
    if(S.bolt){
      const b=S.bolt, a=b.life/14;
      ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.lineCap='round'; ctx.lineJoin='round';
      const path=(pts)=>{ ctx.beginPath(); ctx.moveTo(sx(pts[0].x),sy(pts[0].y)); for(const q of pts) ctx.lineTo(sx(q.x),sy(q.y)); ctx.stroke(); };
      ctx.strokeStyle='rgba(120,170,255,'+(0.45*a).toFixed(3)+')'; ctx.lineWidth=sw(14); path(b.pts);
      ctx.strokeStyle='rgba(200,225,255,'+(0.8*a).toFixed(3)+')'; ctx.lineWidth=sw(5); path(b.pts); for(const br of b.br){ ctx.lineWidth=sw(2.5); path(br); }
      ctx.strokeStyle='rgba(255,255,255,'+a.toFixed(3)+')'; ctx.lineWidth=sw(2); path(b.pts);
      const e=b.pts[b.pts.length-1], gx=sx(e.x), gy=sy(e.y), g=ctx.createRadialGradient(gx,gy,2,gx,gy,sw(90)); g.addColorStop(0,'rgba(255,255,255,'+(0.8*a).toFixed(3)+')'); g.addColorStop(1,'rgba(150,190,255,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(gx,gy,sw(90),0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
    if(S.flash>0.05){ ctx.fillStyle='rgba(225,238,255,'+(0.32*S.flash).toFixed(3)+')'; ctx.fillRect(0,0,W,H); }
    ctx.restore();
  }

  // ── sound ──
  let A=null, N=null;
  function ac(){ try{ return (typeof _audioUnlocked!=='undefined'&&_audioUnlocked&&typeof ga==='function')?ga():null; }catch(e){ return null; } }
  function noise(a,secs,brown){ const len=a.sampleRate*secs, buf=a.createBuffer(2,len,a.sampleRate);
    for(let c=0;c<2;c++){ const d=buf.getChannelData(c); let b=0; for(let i=0;i<len;i++){ const w=Math.random()*2-1; b=brown?0.985*b+0.015*w:0.9*b+0.1*w; d[i]=brown?b*6:w*0.5+b; } } return buf; }
  function build(a){
    const mk=(buf)=>{ const s=a.createBufferSource(); s.buffer=buf; s.loop=true; s.start(); return s; };
    // the rain hiss
    const src=mk(noise(a,2,false));
    const hp=a.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=400;
    const lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=7000;
    const g=a.createGain(); g.gain.value=0;
    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(a.destination);
    // the torrent's roar (low, heavy)
    const r=mk(noise(a,3,true)); const rlp=a.createBiquadFilter(); rlp.type='lowpass'; rlp.frequency.value=380; const rg=a.createGain(); rg.gain.value=0;
    r.connect(rlp); rlp.connect(rg); rg.connect(a.destination);
    // the haze: a soft, airless hush (a breath of filtered noise)
    const hz=mk(noise(a,2,true)); const hbp=a.createBiquadFilter(); hbp.type='bandpass'; hbp.frequency.value=900; hbp.Q.value=0.5; const hg=a.createGain(); hg.gain.value=0;
    hz.connect(hbp); hbp.connect(hg); hg.connect(a.destination);
    return {g,lp,rg,rlp,hg};
  }
  function audioTick(){
    const a=ac(); if(!a||a.state!=='running') return;
    if(a!==A){ A=a; N=build(a); }
    const B=window.MV_BETA, live=B&&B.on&&_gameState==='game'&&!(typeof _paused!=='undefined'&&_paused);
    const E=window.MV_SPATIAL&&MV_SPATIAL.env;
    const inside=E?E.inside:0, under=E?E.under:0, sky=E?E.sky:1;
    const exp=Math.max(0.12,Math.min(1,sky*1.4))*(1-0.55*inside)*(1-0.8*under);
    const t=a.currentTime, k=Math.min(1.5,S.rain);
    N.g.gain.setTargetAtTime(live?0.075*k*exp*sv():0,t,0.5);
    N.lp.frequency.setTargetAtTime(inside>0.5?900:under>0.5?500:(5000+2500*Math.min(1,k))*(0.5+0.5*sky),t,0.4);   // on the roof / through rock: dull
    N.rg.gain.setTargetAtTime(live?0.12*Math.max(0,k-0.7)*exp*sv():0,t,0.6);
    N.hg.gain.setTargetAtTime(live?0.012*S.haze*(1-Math.min(1,k))*(1-0.6*inside)*sv():0,t,1.0);
  }
  // thunder: far = a low roll; close = a crack first, then the roll
  function thunder(k,pan,close){
    const a=ac(); if(!a||a.state!=='running') return;
    const t=a.currentTime, E=window.MV_SPATIAL&&MV_SPATIAL.env, wall=E?(1-0.5*E.inside)*(1-0.6*E.under):1;
    const out=a.createStereoPanner?a.createStereoPanner():a.createGain(); if(out.pan) out.pan.value=pan||0; out.connect(a.destination);
    const len=a.sampleRate*4, buf=a.createBuffer(1,len,a.sampleRate), d=buf.getChannelData(0); let b=0;
    const att=a.sampleRate*(close?0.004:0.25);
    for(let i=0;i<len;i++){ b=0.995*b+0.005*(Math.random()*2-1); const env=Math.pow(1-i/len,1.6)*(i<att?i/att:1)*(1+0.5*Math.sin(i/a.sampleRate*7+Math.random()*0.2)); d[i]=b*8*env; }
    const s=a.createBufferSource(); s.buffer=buf; const lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=close?320:150+80*k; const g=a.createGain();
    g.gain.value=(close?0.75:0.45*k)*sv()*wall;
    s.connect(lp); lp.connect(g); g.connect(out); s.start(t); s.stop(t+4);
    if(close){                                            // the crack
      const cl=a.sampleRate*0.6, cb=a.createBuffer(1,cl,a.sampleRate), cd=cb.getChannelData(0);
      for(let i=0;i<cl;i++) cd[i]=(Math.random()*2-1)*Math.pow(1-i/cl,5)*(Math.random()<0.3?1.6:1);
      const cs=a.createBufferSource(); cs.buffer=cb; const hp=a.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=900; const cg=a.createGain(); cg.gain.value=0.5*sv()*wall;
      cs.connect(hp); hp.connect(cg); cg.connect(out); cs.start(t); cs.stop(t+0.6);
    }
  }
  // the crackle of charge building (on a spot about to be hit, or on a charged MIND)
  let lastCr=0;
  function crackle(k){
    const a=ac(); if(!a||a.state!=='running') return;
    const t=a.currentTime; if(t-lastCr<0.05) return; lastCr=t;
    const n=Math.round(a.sampleRate*0.09), buf=a.createBuffer(1,n,a.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=Math.random()<0.08?(Math.random()*2-1):0;
    const s=a.createBufferSource(); s.buffer=buf; const hp=a.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=2500; const g=a.createGain(); g.gain.value=0.22*k*sv();
    s.connect(hp); hp.connect(g); g.connect(a.destination); s.start(t);
  }
  // runs on the game's own frames (so 30 s is 1800 game frames, paused is paused); the sound keeps
  // following between frames (pause, menus) on a timer
  let lastFrame=-1;
  const _uk=window.updateKnowls;
  window.updateKnowls=function(){ const r=_uk.apply(this,arguments); try{ if(fr!==lastFrame){ lastFrame=fr; tick(); } }catch(e){ console.warn('weather',e); } return r; };
  setInterval(()=>{ try{ if(typeof _gameState!=='undefined'&&(_gameState!=='game'||(typeof _paused!=='undefined'&&_paused))) audioTick(); }catch(e){} },100);
  window.MV_WEATHER={state:S, sky, post, _strikeAt:(x,y,m)=>aimStrike(x,y,m), K:{HAZE_MIN,HAZE_FULL,RAIN_START,RAIN_STOP,STRIKE_START,STRIKE_STOP,BREW}};
})();
