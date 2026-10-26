// ============================================================
//  beta_gore.js — blood only while FILTER is GORE
//  The tank is painted blood red in render.js. Here the juice
//  leaks, and hits throw it onto the stage.
// ============================================================
(function(){
  'use strict';
  const drops=[], stains=[];
  let stage=null;
  function gore(){ return !!(window.MV_CONSOLE&&MV_CONSOLE.mode==='gore'); }
  function playing(){ return gore()&&typeof _gameState!=='undefined'&&_gameState==='game'; }
  function spray(x,y,n,bias){
    if(!playing()||!isFinite(x)||!isFinite(y)) return;
    const base=bias==null?-Math.PI/2:bias;
    for(let i=0;i<n;i++){
      const a=base+(Math.random()-0.5)*1.7;
      const sp=1.4+Math.random()*4.2;
      drops.push({x,y,px:x,py:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-0.8,r:1.4+Math.random()*2.6,t:0,max:26+Math.random()*22|0});
    }
    if(drops.length>180) drops.splice(0,drops.length-180);
  }
  function hitFloor(x,y){
    try{
      if(typeof gridSolid!=='function'||typeof MV_GRID==='undefined'||!MV_GRID||!MV_GRID.tile) return false;
      const t=MV_GRID.tile;
      return gridSolid(Math.floor(x/t), Math.floor(y/t));
    }catch(e){ return false; }
  }
  function splat(x,y,r){
    stains.push({x,y,r:r*1.8+Math.random()*4,a:0.45+Math.random()*0.4,rot:Math.random()*Math.PI});
    if(stains.length>90) stains.splice(0,stains.length-90);
  }
  function tick(){
    const id=window.MV_BETA&&MV_BETA.stageId;
    if(id!==stage){ stage=id; drops.length=0; stains.length=0; }
    if(!playing()){ drops.length=0; if(!gore()) stains.length=0; return; }
    if(typeof p!=='undefined'&&p&&typeof fr==='number'&&fr%8===0){
      const x=p.x+(typeof SW==='number'?SW:40)*0.5, y=p.y+(typeof FEET_OFF==='number'?FEET_OFF:48)-22;
      spray(x+(p.fc?8:-8), y, 1, Math.PI/2);
    }
    for(let i=drops.length-1;i>=0;i--){
      const d=drops[i];
      d.px=d.x; d.py=d.y;
      d.vy+=0.32; d.x+=d.vx; d.y+=d.vy; d.vx*=0.985; d.t++;
      if(d.t>4&&hitFloor(d.x,d.y+2)){ splat(d.px,d.py,d.r); drops.splice(i,1); continue; }
      if(d.t>=d.max){ splat(d.x,d.y,d.r); drops.splice(i,1); }
    }
  }
  function drawBlood(){
    if(!playing()||typeof sx!=='function') return;
    if(typeof _worldZoomBegin==='function') _worldZoomBegin();
    for(const s of stains){
      ctx.save();
      ctx.translate(sx(s.x),sy(s.y)); ctx.rotate(s.rot);
      ctx.fillStyle='rgba(120,0,12,'+s.a.toFixed(2)+')';
      ctx.beginPath(); ctx.ellipse(0,0,sw(s.r),sw(s.r*0.55),0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(70,0,8,'+(s.a*0.7).toFixed(2)+')';
      ctx.beginPath(); ctx.ellipse(sw(s.r*0.3),sw(1),sw(s.r*0.35),sw(s.r*0.2),0.4,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
    ctx.lineCap='round';
    for(const d of drops){
      ctx.strokeStyle=d.r>2.4?'#6e0010':'#c4001c';
      ctx.lineWidth=Math.max(1,sw(d.r*0.7));
      ctx.beginPath(); ctx.moveTo(sx(d.px),sy(d.py)); ctx.lineTo(sx(d.x),sy(d.y)); ctx.stroke();
      ctx.fillStyle='#8f0014';
      ctx.beginPath(); ctx.arc(sx(d.x),sy(d.y),Math.max(1,sw(d.r*0.45)),0,Math.PI*2); ctx.fill();
    }
    if(typeof _worldZoomEnd==='function') _worldZoomEnd();
  }
  function hook(name,fn){
    const orig=window[name];
    if(typeof orig!=='function'||orig._goreBlood) return;
    const w=function(){ const r=orig.apply(this,arguments); try{ fn.apply(this,arguments); }catch(e){} return r; };
    w._goreBlood=true; window[name]=w;
  }
  hook('applyPlayerHit',function(){
    if(typeof p==='undefined'||!p) return;
    const x=p.x+(typeof SW==='number'?SW:40)*0.5, y=p.y+(typeof FEET_OFF==='number'?FEET_OFF:48)-26;
    spray(x,y,16,Math.PI/2);
  });
  hook('_damageEnemy',function(e){
    if(!e) return;
    spray((e.x||0)+(e.w||32)*0.5, (e.y||0)+(e.h||32)*0.4, e.hp<=0?18:8, -Math.PI/2);
  });
  const _draw=window.draw, _update=window.update;
  window.update=function(){
    const r=_update?_update.apply(this,arguments):undefined;
    tick();
    return r;
  };
  window.draw=function(){
    if(_draw) _draw.apply(this,arguments);
    if(typeof ctx!=='undefined') drawBlood();
  };
})();
