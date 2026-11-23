// beta_envdepth.js — atmospheric depth + foreground framing (Paulo 2026-11-23).
// Adds: (1) a stage-tinted haze band and soft light shafts between the far
// backdrop and the play layer, (2) a parallax foreground silhouette in front of
// the cast. Fixed counts, camera-culled, no per-frame allocations. No assets.
(function(){
  'use strict';
  const HASH=(n)=>{ const x=Math.sin(n*127.1)*43758.5453; return x-Math.floor(x); };
  function tint(){
    const id=(window.MV_BETA&&MV_BETA.stageId)||'1.1';
    if(id==='1.2') return {h:[104,74,142], shaft:[150,190,255], ground:[28,18,46], mote:[170,220,255]};
    if(id==='1.3') return {h:[36,96,116], shaft:[120,220,240], ground:[14,28,40], mote:[150,235,255]};
    return {h:[34,86,66], shaft:[255,206,140], ground:[16,38,30], mote:[210,240,190]};
  }

  // Soft atmospheric band + two slow shafts. Called from drawParallax() after layers.
  function haze(){
    if(typeof W==='undefined'||typeof H==='undefined') return;
    const t=tint(), a=(typeof _gameState!=='undefined'&&_gameState!=='game')?0:1;
    if(!a) return;
    ctx.save();
    ctx.globalCompositeOperation='source-over';
    const y0=Math.round(H*0.24), y1=Math.round(H*0.78);
    const g=ctx.createLinearGradient(0,y0,0,y1);
    const c=t.h;
    g.addColorStop(0,'rgba('+c[0]+','+c[1]+','+c[2]+',0)');
    g.addColorStop(0.5,'rgba('+c[0]+','+c[1]+','+c[2]+',0.18)');
    g.addColorStop(1,'rgba('+c[0]+','+c[1]+','+c[2]+',0)');
    ctx.fillStyle=g; ctx.fillRect(0,y0,W,y1-y0);
    // two drifting shafts from upper right, very low alpha
    ctx.globalCompositeOperation='lighter';
    const s=t.shaft, drift=Math.sin(fr*0.004)*30;
    for(let k=0;k<2;k++){
      const x=W*0.72+k*W*0.16+drift, top=0, bot=Math.round(H*0.68), wdt=34+k*18;
      const sg=ctx.createLinearGradient(x,top,x-wdt*1.6,bot);
      sg.addColorStop(0,'rgba('+s[0]+','+s[1]+','+s[2]+',0.055)');
      sg.addColorStop(1,'rgba('+s[0]+','+s[1]+','+s[2]+',0)');
      ctx.fillStyle=sg;
      ctx.beginPath(); ctx.moveTo(x,top); ctx.lineTo(x+wdt,top);
      ctx.lineTo(x-wdt*1.6+wdt,bot); ctx.lineTo(x-wdt*1.6,bot); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // Soil depth — drawn right after the backdrop, before platforms and the cast.
  // A gentle darkening with depth plus embedded pebbles/roots breaks up the flat field.
  function soil(){
    if(typeof W==='undefined'||typeof H==='undefined') return;
    if(typeof _gameState!=='undefined'&&_gameState!=='game') return;
    const t=tint(), g=t.ground, cx=(typeof camX!=='undefined'?camX:0);
    ctx.save();
    const y0=Math.round(H*0.38);
    const sg=ctx.createLinearGradient(0,y0,0,H);
    sg.addColorStop(0,'rgba('+g[0]+','+g[1]+','+g[2]+',0)');
    sg.addColorStop(1,'rgba('+g[0]+','+g[1]+','+g[2]+',0.20)');
    ctx.fillStyle=sg; ctx.fillRect(0,y0,W,H-y0);
    // embedded pebbles + short roots, parallax with the world, bounded and culled
    const off=Math.round(-cx*0.55)%W;
    for(let i=0;i<34;i++){
      const x=((i*97+off)%(W+20))-10, y=y0+HASH(i*13)*(H-y0);
      if(y<y0+8) continue;
      const s=1+HASH(i*17)*2|0;
      ctx.fillStyle='rgba('+Math.max(0,g[0]-12)+','+Math.max(0,g[1]-10)+','+Math.max(0,g[2]-8)+',0.30)';
      ctx.fillRect(x,y,s,s>2?1:2);
    }
    for(let i=0;i<7;i++){
      const x=((i*211+off)%(W+40))-20, y=y0+40+HASH(i*5)*(H-y0-50);
      ctx.strokeStyle='rgba('+Math.max(0,g[0]-18)+','+Math.max(0,g[1]-16)+','+Math.max(0,g[2]-12)+',0.22)';
      ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+3,y+4); ctx.lineTo(x+1,y+9); ctx.stroke();
    }
    ctx.restore();
  }

  // Foreground silhouettes in front of the cast: a scrolling bottom-edge fringe,
  // sparse tufts and a few drifting motes. Called from drawFgLampGlow().
  function foreground(){
    if(typeof W==='undefined'||typeof H==='undefined') return;
    if(typeof _gameState!=='undefined'&&_gameState!=='game') return;
    const t=tint(), cx=(typeof camX!=='undefined'?camX:0), g=t.ground, m=t.mote;
    ctx.save();
    // bottom fringe — scrolls faster than the world (1.55x) for depth
    const off=Math.round(-cx*1.55);
    ctx.fillStyle='rgba('+g[0]+','+g[1]+','+g[2]+',0.72)';
    ctx.fillRect(0,H-11,W,11);
    for(let i=0;i<44;i++){
      const sx0=((i*37+off)% (W+40))-20;
      const hgt=4+Math.round(HASH(i*3)*9);
      ctx.fillRect(sx0,H-7-hgt,2,hgt);
      if(i%4===0) ctx.fillRect(sx0-2,H-7-hgt+2,6,2);
    }
    // sparse foreground tufts (parallax 1.35x)
    const off2=Math.round(-cx*1.35);
    ctx.fillStyle='rgba('+g[0]+','+g[1]+','+g[2]+',0.42)';
    for(let i=0;i<12;i++){
      const x=((i*113+off2)%(W+60))-30, y=H-18-Math.round(HASH(i*7)*10);
      for(let k=-2;k<=2;k++) ctx.fillRect(x+k*3,y+Math.abs(k),2,6-Math.abs(k));
    }
    // drifting motes in the lower middle, bounded and culled
    ctx.fillStyle='rgba('+m[0]+','+m[1]+','+m[2]+',0.30)';
    for(let i=0;i<10;i++){
      const x=((i*149+off2*0.5)%(W+40))-20;
      const y=H*0.55+HASH(i*11)*H*0.38+Math.sin(fr*0.018+i)*6;
      ctx.fillRect(x|0,y|0,1.5,1.5);
    }
    ctx.restore();
  }

  window.MV_ENVDEPTH={haze,soil,foreground};
})();
