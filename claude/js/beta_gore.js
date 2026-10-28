// ============================================================
//  beta_gore.js — blood only while FILTER is GORE
//  The tank is painted blood red in render.js. Here the juice
//  leaks, and hits throw it onto the stage.
// ============================================================
(function(){
  'use strict';
  const drops=[], stains=[], glass=[];
  let stage=null, burstN=0, burstT=0, splashN=0;
  function rideGore(){
    const L=window.MV_LIFT;
    return L?Math.max(0,Math.min(1,-(L.pull||0))):0;
  }
  function rideInk(){
    const L=window.MV_LIFT;
    return L?Math.max(0,Math.min(1,L.pull||0)):0;
  }
  // Full gore is 33 floors down. A chosen GORE filter fades as the ride climbs.
  function goreAmt(){
    const base=(window.MV_CONSOLE&&MV_CONSOLE.mode==='gore')?1:0;
    return Math.max(0,Math.min(1,Math.max(base*(1-rideInk()), rideGore())));
  }
  function gore(){ return goreAmt()>0.04; }
  function playing(){ return gore()&&typeof _gameState!=='undefined'&&_gameState==='game'; }
  function spray(x,y,n,bias){
    if(!playing()||!isFinite(x)||!isFinite(y)) return;
    const scale=goreAmt();
    if(scale<0.98) n=Math.max(n>1?1:n, Math.round(n*scale));
    const base=bias==null?-Math.PI/2:bias;
    for(let i=0;i<n;i++){
      const a=base+(Math.random()-0.5)*2.4;
      const sp=2.2+Math.random()*7.5;
      const chunk=i%7===0;
      drops.push({x,y,px:x,py:y,vx:Math.cos(a)*sp*(chunk?0.7:1),vy:Math.sin(a)*sp-1.4,r:(chunk?3.2:1.1)+Math.random()*(chunk?3.4:2.2),t:0,max:(chunk?40:18)+Math.random()*24|0,chunk});
    }
    if(n>=8){ splashN+=n; burstN++; burstT=22; }
    if(drops.length>520) drops.splice(0,drops.length-520);
  }
  // A pile of hits in the same moment throws blood on the glass.
  function screenBurst(hits){
    if(typeof W!=='number'||typeof H!=='number') return;
    const count=4+Math.min(10,hits*2);
    for(let k=0;k<count;k++){
      glass.push({
        x:18+Math.random()*(W-36),
        y:12+Math.random()*H*0.62,
        r:14+Math.random()*42,
        a:0.42+Math.random()*0.38,
        rot:Math.random()*6,
        drip:0,
        dripMax:50+Math.random()*110,
        life:1,
        fade:0.0022+Math.random()*0.0016
      });
    }
    if(glass.length>24) glass.splice(0,glass.length-24);
  }
  function splashSfx(amount){
    try{
      const a=typeof ga==='function'?ga():null; if(!a||a.state!=='running') return;
      const sv=Math.max(0,Math.min(1,(typeof OPT!=='undefined'&&OPT.sfxVol!=null)?OPT.sfxVol:1));
      if(sv<=0.001) return;
      const t=a.currentTime;
      const big=Math.max(0,Math.min(1,(amount-20)/120));
      const nbuf=a.createBuffer(1,a.sampleRate*0.4|0,a.sampleRate), d=nbuf.getChannelData(0);
      for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
      const src=a.createBufferSource(); src.buffer=nbuf;
      const bp=a.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=900+big*700; bp.Q.value=0.7;
      const hp=a.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=280;
      const g=a.createGain();
      g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime((0.16+0.22*big)*sv,t+0.012);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.16+big*0.12);
      src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(a.destination);
      src.start(t); src.stop(t+0.35);
      const dropsN=2+(big*3)|0;
      for(let i=0;i<dropsN;i++){
        const o=a.createOscillator(), og=a.createGain();
        o.type='sine'; o.frequency.setValueAtTime(420+Math.random()*380,t+0.02+i*0.03);
        o.frequency.exponentialRampToValueAtTime(140+Math.random()*80,t+0.1+i*0.03);
        og.gain.setValueAtTime(0.0001,t+0.02+i*0.03);
        og.gain.exponentialRampToValueAtTime((0.05+big*0.04)*sv,t+0.028+i*0.03);
        og.gain.exponentialRampToValueAtTime(0.0001,t+0.09+i*0.03);
        o.connect(og); og.connect(a.destination);
        o.start(t+0.02+i*0.03); o.stop(t+0.14+i*0.03);
      }
    }catch(e){}
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
    if(stains.length>220) stains.splice(0,stains.length-220);
  }
  function tick(){
    const id=window.MV_BETA&&MV_BETA.stageId;
    if(id!==stage){ stage=id; drops.length=0; stains.length=0; glass.length=0; burstN=0; splashN=0; }
    if(!playing()){ drops.length=0; splashN=0; burstN=0; if(!gore()){ stains.length=0; glass.length=0; } return; }
    const deep=goreAmt()>=0.55;
    if(deep&&splashN>=90) screenBurst(4);
    if(splashN>0){ splashSfx(splashN); splashN=0; }
    if(burstT>0) burstT--; else burstN=0;
    if(deep&&burstN>=3){ screenBurst(burstN); burstN=0; burstT=0; }
    else if(!deep){ burstN=0; burstT=0; }
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
    for(let i=glass.length-1;i>=0;i--){
      const s=glass[i];
      s.life-=s.fade;
      if(s.drip<s.dripMax) s.drip+=0.55+s.r*0.012;
      if(s.life<=0){ glass.splice(i,1); continue; }
      const a=s.a*s.life;
      ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(s.rot);
      ctx.fillStyle='rgba(90,0,12,'+a.toFixed(3)+')';
      ctx.beginPath(); ctx.ellipse(0,0,s.r,s.r*0.42,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(150,4,16,'+(a*0.75).toFixed(3)+')';
      ctx.beginPath(); ctx.ellipse(s.r*0.15,-s.r*0.05,s.r*0.45,s.r*0.22,0.4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(110,0,14,'+(a*0.9).toFixed(3)+')';
      ctx.fillRect(-1.1,s.r*0.15,2.2,s.drip);
      ctx.beginPath(); ctx.ellipse(0,s.r*0.15+s.drip,2.4+s.r*0.04,3.2,0,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }
  function metal(name, amt){
    try{
      const a=typeof ga==='function'?ga():null; if(!a) return;
      const t=a.currentTime, sv=Math.max(0,Math.min(1,(typeof OPT!=='undefined'&&OPT.sfxVol!=null)?OPT.sfxVol:1));
      const hit=/hit|punch|land|stomp|hurt|shut|enemy/.test(name||'');
      const freqs=hit?[146,220,311,466]:[98,147,220];
      freqs.forEach((f,i)=>{
        const o=a.createOscillator(), g=a.createGain();
        o.type=i%2?'triangle':'square'; o.frequency.value=f;
        const loud=Math.max(0.15,Math.min(1,amt==null?1:amt));
        g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime((hit?0.05:0.025)*sv*loud,t+0.008);
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
    spray(x,y,56,Math.PI/2);
  });
  if(typeof window.sfx==='function'&&!window.sfx._goreMetal){
    const origSfx=window.sfx;
    const wrapped=function(t){
      const r=origSfx.apply(this,arguments);
      const gAmt=goreAmt();
      if(gAmt>0.12&&typeof _gameState!=='undefined'&&_gameState==='game'&&/hit|punch|land|stomp|hurt|shut|enemy|jump/.test(t||'')) metal(t,gAmt);
      return r;
    };
    wrapped._goreMetal=true; window.sfx=wrapped;
  }
  hook('_damageEnemy',function(e){
    if(!e) return;
    const dir=(typeof p!=='undefined'&&p&&p.fc)?0:Math.PI;
    spray((e.x||0)+(e.w||32)*0.5, (e.y||0)+(e.h||32)*0.4, e.hp<=0?84:40, dir);
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
  // darken the picture. Panels stay dark. Bright greens (words, juice) stay hot.
  v=pow(v,1.18)*0.78;
  h=mix(h,0.0,g);
  s=mix(s,max(s,0.9),g);
  float hot=smoothstep(0.42,0.78,k.z);
  v=mix(v*0.62, min(1.0,k.z*1.05+0.02), hot);
  v=mix(v, mix(v, min(1.0,k.z), hot), g);
  vec3 o=hsv2rgb(vec3(h,s,v));
  // words were green. They have to stay lighter than the panel or the menu is a red box.
  float ink=g*smoothstep(0.5,0.86,k.z);
  o=mix(o, vec3(1.0,0.93,0.9)*(0.82+0.18*k.z), ink);
  vec2 px=3.0/res;
  float glow=greenAmt(texture2D(tex,uv+vec2(px.x,0.0)).rgb)*step(0.45,texture2D(tex,uv+vec2(px.x,0.0)).g);
  glow+=greenAmt(texture2D(tex,uv-vec2(px.x,0.0)).rgb);
  glow*=(1.0-ink);
  o+=vec3(0.45,0.02,0.03)*glow*0.05;
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
    const amt=goreAmt();
    if(!cv||amt<0.015||!initGL()){
      if(oc.style.display!=='none') oc.style.display='none';
      return;
    }
    syncBox();
    oc.style.opacity=amt.toFixed(3);
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
