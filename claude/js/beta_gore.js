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
    stains.push({x,y,r:1.1+Math.random()*1.6,a:0.35+Math.random()*0.3,rot:Math.random()*Math.PI,drip:8+Math.random()*18,bits:2+Math.random()*3|0});
    if(stains.length>90) stains.splice(0,stains.length-90);
  }
  function tick(){
    const id=window.MV_BETA&&MV_BETA.stageId;
    if(id!==stage){ stage=id; drops.length=0; stains.length=0; }
    if(!playing()){ drops.length=0; if(!gore()) stains.length=0; return; }
    if(typeof p!=='undefined'&&p&&typeof fr==='number'&&fr%36===0&&Math.abs(p.vx||0)>0.4){
      const x=p.x+(typeof SW==='number'?SW:40)*0.5, y=p.y+(typeof FEET_OFF==='number'?FEET_OFF:48)-8;
      spray(x+(p.fc?6:-6), y, 1, Math.PI/2+0.2);
    }
    for(let i=drops.length-1;i>=0;i--){
      const d=drops[i];
      d.px=d.x; d.py=d.y;
      d.vy+=0.32; d.x+=d.vx; d.y+=d.vy; d.vx*=0.985; d.t++;
      if(d.t>4&&hitFloor(d.x,d.y+2)){ splat(d.px,d.py,d.r*0.4); drops.splice(i,1); continue; }
      if(d.t>=d.max){ splat(d.x,d.y,d.r*0.45); drops.splice(i,1); }
    }
  }
  function drawBlood(){
    if(!playing()||typeof sx!=='function') return;
    if(typeof _worldZoomBegin==='function') _worldZoomBegin();
    for(const s of stains){
      if(s.drip>0){ s.y+=0.35; s.drip--; }
      ctx.save();
      ctx.translate(sx(s.x),sy(s.y)); ctx.rotate(s.rot);
      for(let b=0;b<(s.bits||3);b++){
        const ox=((b*5)%7)-3, oy=((b*3)%5)-1;
        ctx.fillStyle='rgba('+(90+b*20)+',0,10,'+s.a.toFixed(2)+')';
        ctx.beginPath(); ctx.arc(sw(ox),sw(oy+ (s.drip?0:b)),Math.max(1,sw(s.r*(0.7+b*0.15))),0,Math.PI*2); ctx.fill();
      }
      if(s.drip>0){ ctx.fillStyle='rgba(120,0,12,'+s.a.toFixed(2)+')'; ctx.fillRect(-0.6,0,1.2,sw(3)); }
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
    const g=ctx.createRadialGradient(W/2,H/2,H*0.2,W/2,H/2,H*0.72);
    const breath=0.45+0.08*Math.sin((typeof fr==='number'?fr:0)*0.04);
    g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(40,0,8,'+breath.toFixed(2)+')');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  }
  function metal(name){
    try{
      const a=typeof ga==='function'?ga():null; if(!a) return;
      const t=a.currentTime, sv=Math.max(0,Math.min(1,(typeof OPT!=='undefined'&&OPT.sfxVol!=null)?OPT.sfxVol:1));
      const hit=/hit|punch|land|stomp|hurt|shut|enemy/.test(name||'');
      const freqs=hit?[146,220,311,466]:[98,147,220];
      freqs.forEach((f,i)=>{
        const o=a.createOscillator(), g=a.createGain();
        o.type=i%2?'triangle':'square'; o.frequency.value=f;
        g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime((hit?0.05:0.025)*sv,t+0.008);
        g.gain.exponentialRampToValueAtTime(0.0001,t+(hit?0.22:0.45));
        o.connect(g); g.connect(a.destination); o.start(t); o.stop(t+0.5);
      });
    }catch(e){}
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
  if(typeof window.sfx==='function'&&!window.sfx._goreMetal){
    const origSfx=window.sfx;
    const wrapped=function(t){
      const r=origSfx.apply(this,arguments);
      if(gore()&&typeof _gameState!=='undefined'&&_gameState==='game') metal(t);
      return r;
    };
    wrapped._goreMetal=true; window.sfx=wrapped;
  }
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

  // Greens become bright glowing red. Every other hue is pulled toward
  // that red so the whole picture sits in the same key. Gore only.
  const cv=document.getElementById('c');
  const oc=document.createElement('canvas');
  oc.className='mv-gore-grade';
  oc.setAttribute('aria-hidden','true');
  oc.style.cssText='position:absolute;pointer-events:none;z-index:8;display:none;';
  function mount(){
    if(!cv||!cv.parentNode) return;
    const par=cv.parentNode;
    if(getComputedStyle(par).position==='static') par.style.position='relative';
    if(!oc.parentNode) par.appendChild(oc);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
  function syncBox(){
    if(!cv) return;
    if(oc.width!==cv.width||oc.height!==cv.height){ oc.width=cv.width; oc.height=cv.height; }
    oc.style.left=cv.offsetLeft+'px'; oc.style.top=cv.offsetTop+'px';
    oc.style.width=cv.clientWidth+'px'; oc.style.height=cv.clientHeight+'px';
  }
  let gl=null, prog=null, buf=null, tex=null, U=null, glState=0;
  function initGL(){
    if(glState) return glState>0;
    glState=-1;
    mount();
    gl=oc.getContext('webgl',{alpha:false,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:false});
    if(!gl) return false;
    const VS='attribute vec2 p; varying vec2 uv; void main(){ uv=p*0.5+0.5; gl_Position=vec4(p,0.0,1.0); }';
    const FS=`precision mediump float;
uniform sampler2D tex; uniform vec2 res; varying vec2 uv;
vec3 rgb2hsv(vec3 c){
  vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0);
  vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
  vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
  float d=q.x-min(q.w,q.y); float e=1.0e-10;
  return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)), d/(q.x+e), q.x);
}
vec3 hsv2rgb(vec3 c){
  vec3 p=abs(fract(c.xxx+vec3(0.0,2.0/3.0,1.0/3.0))*6.0-3.0);
  return c.z*mix(vec3(1.0), clamp(p-1.0,0.0,1.0), c.y);
}
float greenAmt(vec3 c){
  vec3 k=rgb2hsv(c);
  float band=smoothstep(0.10,0.18,k.x)*smoothstep(0.52,0.44,k.x);
  return band*smoothstep(0.10,0.28,k.y);
}
void main(){
  vec3 c=texture2D(tex,uv).rgb;
  vec3 k=rgb2hsv(c);
  float signedH=k.x>0.5?k.x-1.0:k.x;
  float h=fract(signedH*0.38);
  float s=min(1.0,k.y*1.08);
  float v=k.z;
  float g=greenAmt(c);
  h=mix(h,0.0,g);
  s=mix(s,1.0,g);
  v=mix(v,min(1.0,v*1.28+0.14),g);
  vec3 o=hsv2rgb(vec3(h,s,v));
  vec2 px=6.0/res;
  float glow=greenAmt(texture2D(tex,uv+vec2(px.x,0.0)).rgb);
  glow+=greenAmt(texture2D(tex,uv-vec2(px.x,0.0)).rgb);
  glow+=greenAmt(texture2D(tex,uv+vec2(0.0,px.y)).rgb);
  glow+=greenAmt(texture2D(tex,uv-vec2(0.0,px.y)).rgb);
  glow+=greenAmt(texture2D(tex,uv+px).rgb)*0.7;
  glow+=greenAmt(texture2D(tex,uv-px).rgb)*0.7;
  o+=vec3(1.0,0.05,0.07)*(glow*0.16+g*0.45);
  gl_FragColor=vec4(min(o,1.0),1.0);
}`;
    function sh(type,src){
      const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){ console.error('MV gore grade',gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    const vs=sh(gl.VERTEX_SHADER,VS), fs=sh(gl.FRAGMENT_SHADER,FS);
    if(!vs||!fs) return false;
    prog=gl.createProgram(); gl.attachShader(prog,vs); gl.attachShader(prog,fs); gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS)){ console.error('MV gore grade link',gl.getProgramInfoLog(prog)); return false; }
    gl.useProgram(prog);
    buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buf);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const ap=gl.getAttribLocation(prog,'p'); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap,2,gl.FLOAT,false,0,0);
    tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    U={tex:gl.getUniformLocation(prog,'tex'), res:gl.getUniformLocation(prog,'res')};
    gl.uniform1i(U.tex,0);
    glState=1; return true;
  }
  function grade(){
    if(!cv||!gore()||!initGL()){
      if(oc.style.display!=='none') oc.style.display='none';
      return;
    }
    syncBox();
    if(oc.style.display==='none') oc.style.display='';
    gl.viewport(0,0,oc.width,oc.height);
    gl.bindTexture(gl.TEXTURE_2D,tex);
    try{ gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,cv); }catch(e){ return; }
    gl.uniform2f(U.res,cv.width,cv.height);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
  function hookGrade(){
    const prev=window.draw;
    if(typeof prev!=='function'){ setTimeout(hookGrade,30); return; }
    if(prev._goreGrade) return;
    const wrapped=function(){
      const r=prev.apply(this,arguments);
      try{ grade(); }catch(e){}
      return r;
    };
    wrapped._goreGrade=true;
    window.draw=wrapped;
  }
  setTimeout(hookGrade,0);
})();
