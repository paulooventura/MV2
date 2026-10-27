// ============================================================
//  ink_vinyl.js — lab H · "Ink & Vinyl"
//
//  Paulo, Oct 23 2026: artwork0199 (MIND as an Edo woodblock print) is the
//  look for the whole game — "every pixel, every word, every colour, every
//  sound has to resonate with this video". Art bible:
//  https://claude.ai/artifact/5SXjuCifasvByVpC1uEV1C
//
//  This runs the live game (claude/ build) untouched and finishes each frame
//  like a print. Live game: Options → CONSOLE → D · INK & VINYL (console16
//  mode 'ink'). Lab H (ink-vinyl.html, window.MV_INK) forces it on.
//
//  PICTURE (one WebGL pass over #c; #c keeps all input):
//   · the world becomes washi paper and diluted sumi: luminance → 5 wash
//     tones, auto-exposed per scene so the paper always dominates;
//   · brush outlines from the frame's own edges, wobbled by paper fibre;
//   · colour lives only in the machine: purple / magenta, red, gold, jade
//     and Knowl cyan survive (MIND, Venture, jacks, Knowls, HUD bars);
//   · HP lost ages the print (colour bleaches, ink fades, paper yellows)
//     instead of the console bit-crush; a hit ages it hard for a moment.
//  SOUND (layered on the game's own SFX and OST, nothing replaced):
//   · vinyl crackle bed; woodblock on landing / confirm; koto pluck on
//     Knowls; koto bend when the RCA bites; vinyl scratch on the throw;
//     seal stamp on gates / unlocks; paper crumple on a hit.
//  WORDS: a few lines reworded for the print ("THE PRINT IS LOST").
// ============================================================
(function(){
  'use strict';
  const cv=document.getElementById('c');
  if(!cv) return;

  const INK={on:true, gl:null, age:0, lo:0.05, hi:0.6, frames:0};
  window.MV_INK_API=INK;
  // live game: Options → CONSOLE → D · INK & VINYL (MV_CONSOLE.mode 'ink'); lab H forces it on
  const forced=!!window.MV_INK;
  function liftInk(){ const L=window.MV_LIFT; return (L&&L.pull>0.08)?Math.min(1,L.pull):0; }
  function active(){
    const L=window.MV_LIFT;
    if(L&&L.pull<-0.08) return false;
    return forced||!!(window.MV_CONSOLE&&MV_CONSOLE.mode==='ink')||liftInk()>0;
  }
  function enabled(){ return INK.on&&active(); }
  INK.active=active; INK.enabled=enabled;

  // ── overlay canvas ─────────────────────────────────────────────
  const oc=document.createElement('canvas');
  oc.className='mv-ink';
  oc.setAttribute('aria-hidden','true');
  oc.style.cssText='position:absolute;pointer-events:none;z-index:6;image-rendering:auto;display:none;';
  function mount(){
    const par=cv.parentNode; if(!par) return;
    if(getComputedStyle(par).position==='static') par.style.position='relative';
    par.appendChild(oc);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
  function syncBox(){
    if(oc.width!==cv.width||oc.height!==cv.height){ oc.width=cv.width; oc.height=cv.height; }
    const l=cv.offsetLeft+'px', t=cv.offsetTop+'px', w=cv.clientWidth+'px', h=cv.clientHeight+'px';
    if(oc.style.left!==l) oc.style.left=l; if(oc.style.top!==t) oc.style.top=t;
    if(oc.style.width!==w) oc.style.width=w; if(oc.style.height!==h) oc.style.height=h;
  }

  // ── GL (built the first time the print is switched on) ────────
  let gl=null,tex=null,wtex=null,U=null,glState=0;   // 0 untried · 1 ready · -1 unavailable
  function initGL(){
    if(glState) return glState>0;
    glState=-1;
  gl=oc.getContext('webgl',{alpha:false,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:false});
  if(!gl){ console.warn('MV ink: no WebGL — Ink & Vinyl shows the plain picture'); return false; }
  const VS='attribute vec2 p; varying vec2 uv; void main(){ uv=p*.5+.5; gl_Position=vec4(p,0.,1.); }';
  const FS=`precision mediump float;
  uniform sampler2D t; uniform sampler2D wt; uniform float wok; uniform float menu;
  uniform vec2 res; uniform float lo, hi, age, time;
  varying vec2 uv;
  const vec3 PAPER=vec3(.914,.847,.765);   // washi  #E9D8C3
  const vec3 SHADE=vec3(.863,.776,.675);   // shade  #DCC6AC
  const vec3 AGED =vec3(.922,.816,.690);   // aged   #EBD0B0
  const vec3 W40  =vec3(.486,.443,.400);   // wash 40
  const vec3 W70  =vec3(.227,.208,.188);   // wash 70
  const vec3 SUMI =vec3(.043,.051,.059);   // sumi
  float lum(vec3 c){ return dot(c,vec3(.299,.587,.114)); }
  float L(vec2 o){ return lum(texture2D(wt,uv+o/res).rgb); }
  vec3 hsv(vec3 c){ vec4 K=vec4(0.,-1./3.,2./3.,-1.); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
    vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y);
    return vec3(abs(q.z+(q.w-q.y)/(6.*d+1e-6)),d/(q.x+1e-6),q.x); }
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y); }
  float band(float h,float a,float b){ return step(a,h)*step(h,b); }
  // colour lives in the machine: which hues survive the print
  float living(vec3 k){
    float h=k.x*360., s=k.y, v=k.z;
    float m=0.;
    m=max(m,band(h,255.,338.));                                  // Mind purple / magenta coils
    m=max(m,(step(h,14.)+step(346.,h))*step(.55,s)*step(.35,v)); // Venture red, MAG, HP bar
    m=max(m,band(h,36.,64.)*step(.62,v)*step(.55,s));            // gold TRS, brass, windows
    m=max(m,band(h,14.,36.)*step(.75,v)*step(.70,s));            // RCA orange
    m=max(m,band(h,88.,170.)*step(.66,v)*step(.50,s));           // jade: Knowl tank, PWR, enhanced veins
    m=max(m,band(h,170.,200.)*step(.70,v)*step(.45,s));          // Knowl cyan glow
    return clamp(m,0.,1.)*smoothstep(.30,.48,s)*smoothstep(.16,.30,v);
  }
  void main(){
    vec2 fc=gl_FragCoord.xy;
    vec3 fin=texture2D(t,uv).rgb;                 // the finished frame (world + HUD)
    vec3 c=texture2D(wt,uv).rgb;                  // the world alone (same as fin when wok=0)
    vec3 paper=mix(PAPER,AGED,age), shade=mix(SHADE,AGED*.94,age);
    if(menu>.5){                                  // menus / title / story: a moon-paper duotone, words stay legible
      vec3 k0=hsv(fin); float l0=lum(fin), liv0=living(k0);
      vec3 duo=mix(SUMI,mix(vec3(.83,.835,.855),paper,.35),smoothstep(.02,.85,pow(l0,.8)));
      vec3 o0=mix(duo,mix(fin,fin*paper*1.08,.2),liv0*.9);
      o0*=.96+.04*hash(floor(fc));
      gl_FragColor=vec4(o0,1.); return;
    }
    float hud=wok>.5?step(.035,length(fin-c)):0.;
    // brush outline: sobel at 1.5 px, the threshold wobbles with the paper fibre
    float o=1.5;
    float a=L(vec2(-o,o)),b=L(vec2(0.,o)),d=L(vec2(o,o)),e=L(vec2(-o,0.)),f=L(vec2(o,0.)),g=L(vec2(-o,-o)),h=L(vec2(0.,-o)),i=L(vec2(o,-o));
    float gx=(d+2.*f+i)-(a+2.*e+g), gy=(a+2.*b+d)-(g+2.*h+i);
    float edge=sqrt(gx*gx+gy*gy);
    float fib=vnoise(fc*vec2(.06,.9)), grit=vnoise(fc*.45);
    // tone: auto-exposed luminance into five washes
    float soft=(a+b+d+e+f+g+h+i+lum(c)*4.)/12.;   // tone from a softened sample: glows and dithers don't speckle
    float y=clamp((soft-lo)/max(.06,hi-lo),0.,1.);
    // five washes with short soft edges: flat like a block print, no speckle at the seams
    vec3 tone=SUMI;
    tone=mix(tone,W70,smoothstep(.11,.17,y));
    tone=mix(tone,mix(paper,W40,.70),smoothstep(.27,.33,y));
    tone=mix(tone,mix(shade,W40,.28),smoothstep(.43,.49,y));
    tone=mix(tone,shade,smoothstep(.61,.67,y));
    tone=mix(tone,paper,smoothstep(.76,.82,y));
    tone*=.985+.03*fib;                           // the wash soaks unevenly into the fibre
    // the machine keeps its colour (bleaches as the print ages)
    vec3 k=hsv(c); float liv=living(k);
    vec3 grey=vec3(lum(c));
    vec3 lc=mix(c, mix(grey,paper,.45)+(c-grey)*.30, age*.9);
    lc=mix(lc, lc*paper*1.08, .18);                              // printed on washi, not glowing on glass
    vec3 col=mix(tone,lc,liv);
    // ink lines (fade toward wash 70 when old)
    float ink=smoothstep(.12+grit*.07,.32,edge)*(1.-liv*.55);
    col=mix(col, mix(SUMI,W70,age*.8), ink*.88);
    // paper grain + fibres
    float gr=.955+.045*hash(floor(fc)) ; gr*=.975+.025*fib;
    col*=mix(gr,1.,liv*.6);
    // faint print margin
    vec2 q=uv*2.-1.; float vig=smoothstep(1.25,.75,length(q*vec2(.92,1.)));
    col=mix(col*vec3(.96,.93,.88),col,vig);
    // HUD / dialogue drawn over the world: its own colours, panels in sumi, printed on the paper
    float hl=lum(fin);
    vec3 hc=mix(fin, mix(SUMI,W70,.25), smoothstep(.16,.02,hl)*.85);
    hc=mix(hc, hc*paper*1.1, .12);
    col=mix(col,hc,hud);
    gl_FragColor=vec4(col,1.);
  }`;
  function sh(type,src){ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){ console.error('MV ink shader',gl.getShaderInfoLog(s)); return null; } return s; }
  const vs=sh(gl.VERTEX_SHADER,VS), fs=sh(gl.FRAGMENT_SHADER,FS);
  if(!vs||!fs) return false;
  const pr=gl.createProgram(); gl.attachShader(pr,vs); gl.attachShader(pr,fs); gl.linkProgram(pr);
  if(!gl.getProgramParameter(pr,gl.LINK_STATUS)){ console.error('MV ink link',gl.getProgramInfoLog(pr)); return false; }
  gl.useProgram(pr);
  const buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const ap=gl.getAttribLocation(pr,'p'); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap,2,gl.FLOAT,false,0,0);
  tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  U={}; ['t','wt','wok','menu','res','lo','hi','age','time'].forEach(n=>U[n]=gl.getUniformLocation(pr,n));
  gl.uniform1i(U.t,0); gl.uniform1i(U.wt,1);
  wtex=gl.createTexture(); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,wtex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.activeTexture(gl.TEXTURE0);
    glState=1; INK.gl=gl; return true;
  }
  // the world, captured the moment the HUD starts (same seam console16.js uses)
  const wc=document.createElement('canvas'), wg=wc.getContext('2d');
  let worldOk=false, inGameFrame=false;
  function snapWorld(){
    if(!inGameFrame||worldOk||!enabled()) return;
    if(wc.width!==cv.width||wc.height!==cv.height){ wc.width=cv.width; wc.height=cv.height; }
    wg.globalCompositeOperation='copy'; wg.drawImage(cv,0,0); worldOk=true;
  }
  // the console's darkening + bit-crush damage overlay is swapped for the ageing print (shader)
  const _dmg=window.drawDamageOverlay, _atm=window.drawAtmosphere;
  window.drawDamageOverlay=function(){ if(enabled()) return; if(typeof _dmg==='function') return _dmg.apply(this,arguments); };
  // the glass-TV vignette would read as HUD to the layer mask; the print has its own margin
  window.drawAtmosphere=function(){ if(enabled()) return; if(typeof _atm==='function') return _atm.apply(this,arguments); };
  for(const name of ['drawDamageOverlay','drawItemTutorial','drawHUD']){
    const orig=window[name]; if(typeof orig!=='function') continue;
    window[name]=function(){ snapWorld(); return orig.apply(this,arguments); };
  }

  // ── auto-exposure: the paper always wins ──────────────────────
  const ex=document.createElement('canvas'); ex.width=48; ex.height=36;
  const eg=ex.getContext('2d',{willReadFrequently:true});
  function expose(){
    try{
      eg.drawImage(cv,0,0,ex.width,ex.height);
      const d=eg.getImageData(0,0,ex.width,ex.height).data, n=d.length/4, Ls=new Float32Array(n);
      for(let k=0,j=0;k<d.length;k+=4,j++) Ls[j]=(d[k]*.299+d[k+1]*.587+d[k+2]*.114)/255;
      Ls.sort();
      const lo=Ls[Math.floor(n*0.06)], hi=Math.max(lo+0.08,Ls[Math.floor(n*0.62)]);   // the brighter ~40% of the frame reads as paper
      INK.lo+=(lo-INK.lo)*0.25; INK.hi+=(hi-INK.hi)*0.25;
    }catch(e){}
  }

  // ── print age from HP (replaces the console bit-crush) ─────────
  let lastHp=null, jolt=0;
  function ageTarget(){
    const gs=typeof _gameState!=='undefined'?_gameState:'';
    if(gs!=='game'||typeof p==='undefined'||!p){ lastHp=null; jolt=0; return 0; }
    if(typeof _shutdownTimer!=='undefined'&&_shutdownTimer>0) return 1;
    if(lastHp!=null&&p.hp<lastHp) jolt=26;
    lastHp=p.hp; if(jolt>0) jolt--;
    const hp=Math.max(0,Math.min(1,(p.hp||0)/(p.maxHp||100)));
    return Math.min(1,Math.max((1-hp)*0.85, jolt/26));
  }

  function render(){
    if(!enabled()||!initGL()){
      if(oc.style.display!=='none') oc.style.display='none';
      if(A&&A.bed&&A.bed.g.gain.value) A.bed.g.gain.value=0;
      return;
    }
    const L=window.MV_LIFT, pull=L?L.pull:0;
    const baseInk=forced||!!(window.MV_CONSOLE&&MV_CONSOLE.mode==='ink');
    const amt=pull<=-0.08?0:(baseInk?1:Math.min(1,Math.max(0,pull)));
    oc.style.opacity=amt.toFixed(3);
    if(oc.style.display==='none') oc.style.display='';
    if(amt>0.12){ try{ bed(); }catch(e){} }
    if(A&&A.bed&&A.bed.g) A.bed.g.gain.value=0.22*amt;
    syncBox();
    if((INK.frames++&7)===0) expose();
    const at=ageTarget(); INK.age+=(at-INK.age)*(at>INK.age?0.35:0.06);
    gl.viewport(0,0,oc.width,oc.height);
    gl.bindTexture(gl.TEXTURE_2D,tex);
    try{ gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,cv); }catch(e){ return; }
    const menu=!inGameFrame;
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,wtex);
    try{ gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,(worldOk&&!menu)?wc:cv); }catch(e){}
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(U.wok,(worldOk&&!menu)?1:0); gl.uniform1f(U.menu,menu?1:0);
    gl.uniform2f(U.res,cv.width,cv.height); gl.uniform1f(U.lo,INK.lo); gl.uniform1f(U.hi,INK.hi);
    gl.uniform1f(U.age,INK.age); gl.uniform1f(U.time,performance.now()/1000);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }

  // after everything else wrapped draw (console16, crt_room), finish the frame
  function hookDraw(){
    const _draw=window.draw;
    if(typeof _draw!=='function'){ setTimeout(hookDraw,50); return; }
    window.draw=function(){
      worldOk=false; inGameFrame=(typeof _gameState!=='undefined'&&_gameState==='game'&&!(window.MV_BETA&&MV_BETA.loading));
      try{ return _draw.apply(this,arguments); } finally{ try{ render(); }catch(e){ console.warn('MV ink',e); } }
    };
  }
  hookDraw();

  // ── words for the print ────────────────────────────────────────
  const WORDS={
    'SYSTEM SHUTDOWN':'THE PRINT IS LOST',
    'REBOOTING...':'PULLING A NEW PRINT...',
    'GAME OVER':'THE INK HAS DRIED',
    'TAB TO RETRY':'TAB TO PULL A NEW PRINT',
    'NO CONTINUES LEFT':'NO PAPER LEFT',
    'SUMMIT!':'SEALED.',
    'TO PROCEED':'TO OPEN THE ARCH',
    'PRESS START':'PRESS START TO PULL THE PRINT'
  };
  const sub=s=>{
    if(typeof s!=='string') return s;
    const L=window.MV_LIFT, pull=L?L.pull:0;
    const base=forced||!!(window.MV_CONSOLE&&MV_CONSOLE.mode==='ink');
    if(pull<-0.08||!(base||pull>0.75)) return s;
    const r=WORDS[s]; return r!==undefined?r:s;
  };
  for(const name of ['drawText','textW']){
    const orig=window[name]; if(typeof orig!=='function') continue;
    window[name]=function(s){ const a=Array.prototype.slice.call(arguments); a[0]=sub(s); return orig.apply(this,a); };
  }

  // ── sound: layered on the game's own SFX ──────────────────────
  let A=null;
  function actx(){ try{ if(typeof _audioUnlocked!=='undefined'&&!_audioUnlocked) return null; const a=(typeof ga==='function')?ga():null; return a||null; }catch(e){ return null; } }
  function vol(){ try{ return Math.max(0,Math.min(1,(typeof OPT!=='undefined'&&OPT.sfxVol!=null)?OPT.sfxVol:1)); }catch(e){ return 1; } }
  function setup(a){
    if(A&&A.a===a) return A;
    const out=a.createGain(); out.gain.value=0.55; out.connect(a.destination);
    const nb=a.createBuffer(1,a.sampleRate*1,a.sampleRate), nd=nb.getChannelData(0); for(let k=0;k<nd.length;k++) nd[k]=Math.random()*2-1;
    A={a,out,nb,bed:null};
    return A;
  }
  function bed(){
    const a=actx(); if(!a) return; setup(a);
    if(A.bed) return;
    const len=a.sampleRate*4, b=a.createBuffer(1,len,a.sampleRate), d=b.getChannelData(0);
    for(let k=0;k<len;k++){ d[k]=(Math.random()*2-1)*0.008; if(Math.random()<0.0007) d[k]+=(Math.random()*2-1)*0.45; }
    const s=a.createBufferSource(); s.buffer=b; s.loop=true;
    const hp=a.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=1000;
    const g=a.createGain(); g.gain.value=0.22;
    s.connect(hp); hp.connect(g); g.connect(A.out); s.start();
    A.bed={s,g};
  }
  const N=(a,dur)=>{ const s=a.createBufferSource(); s.buffer=A.nb; s.loop=true; s.start(a.currentTime); s.stop(a.currentTime+dur+0.05); return s; };
  function env(a,node,peak,t0,att,dec){ const g=a.createGain(); g.gain.setValueAtTime(0.0001,t0); g.gain.linearRampToValueAtTime(peak*vol(),t0+att); g.gain.exponentialRampToValueAtTime(0.0001,t0+att+dec); node.connect(g); g.connect(A.out); return g; }
  const L={
    woodblock(v){ const a=actx(); if(!a) return; setup(a); const t=a.currentTime;
      const o=a.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(1650,t); o.frequency.exponentialRampToValueAtTime(1100,t+.05); env(a,o,.28*(v||1),t,.002,.07); o.start(t); o.stop(t+.1);
      const n=N(a,.05), bp=a.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=2600; bp.Q.value=4; n.connect(bp); env(a,bp,.2*(v||1),t,.002,.04); },
    koto(f,bend,v){ const a=actx(); if(!a) return; setup(a); const t=a.currentTime;
      [1,2.01,3.02].forEach((m,i)=>{ const o=a.createOscillator(); o.type=i?'sine':'triangle';
        o.frequency.setValueAtTime(f*m*1.006,t); o.frequency.exponentialRampToValueAtTime(f*m*(bend||1),t+(bend?.32:.05));
        const lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.setValueAtTime(4200,t); lp.frequency.exponentialRampToValueAtTime(800,t+.6);
        o.connect(lp); env(a,lp,(v||.22)/(i*1.8+1),t,.004,1.0-i*.3); o.start(t); o.stop(t+1.1); }); },
    scratch(){ const a=actx(); if(!a) return; setup(a); const t=a.currentTime;
      const n=N(a,.25), bp=a.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=6;
      bp.frequency.setValueAtTime(600,t); bp.frequency.exponentialRampToValueAtTime(2800,t+.09); bp.frequency.exponentialRampToValueAtTime(500,t+.2);
      n.connect(bp); env(a,bp,.32,t,.03,.19); },
    paper(dur,v,f){ const a=actx(); if(!a) return; setup(a); const t=a.currentTime;
      const n=N(a,dur), bp=a.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=.8; bp.frequency.setValueAtTime(f||3000,t); bp.frequency.linearRampToValueAtTime((f||3000)*.45,t+dur);
      n.connect(bp); env(a,bp,v||.14,t,dur*.3,dur*.7); },
    stamp(){ const a=actx(); if(!a) return; setup(a); const t=a.currentTime;
      const o=a.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(120,t); o.frequency.exponentialRampToValueAtTime(46,t+.18); env(a,o,.5,t,.003,.3); o.start(t); o.stop(t+.35);
      L.paper(.08,.16); setTimeout(()=>L.paper(.3,.08),220); }
  };
  INK.sound=L;
  const IN_SCALE=[293.66,311.13,392,440,466.16,587.33];   // In scale on D
  let knowlStep=0, lastLand=0;
  const LAYER={
    land(){ const n=performance.now(); if(n-lastLand<120) return; lastLand=n; L.woodblock(.8); },
    confirm(){ L.woodblock(1); },
    menu(){ L.paper(.07,.06,3600); },
    knowl_pickup(){ L.koto(IN_SCALE[(knowlStep++)%6]*2,0,.24); },
    knowl_seed(){ L.koto(IN_SCALE[(knowlStep++)%6],0,.2); },
    seeds_all(){ [0,2,3,5].forEach((n,i)=>setTimeout(()=>L.koto(IN_SCALE[n]*2,0,.22),i*110)); },
    hook(){ L.scratch(); },
    hook_latch(){ L.koto(220,1.12,.2); },
    grap_attach(){ L.koto(220,1.12,.2); },
    player_hit(){ L.paper(.28,.2,1400); },
    hurt(){ L.paper(.28,.2,1400); },
    gate(){ L.stamp(); },
    unlock(){ L.stamp(); },
    enemy_dead(){ L.stamp(); },
    shutdown(){ L.paper(.6,.2,900); }
  };
  function hookSfx(){
    const orig=window.sfx; if(typeof orig!=='function'){ setTimeout(hookSfx,100); return; }
    window.sfx=function(t){ const r=orig.apply(this,arguments); try{ if(enabled()){ bed(); const f=LAYER[t]; if(f) f(); } }catch(e){} return r; };
  }
  // sfxAt resolves sfx through the global at call time, so one wrapper covers both
  if(document.readyState==='complete') hookSfx(); else window.addEventListener('load',hookSfx);
  // start the crackle with the first input after the game unlocks audio
  ['keydown','pointerdown','touchstart'].forEach(ev=>addEventListener(ev,()=>{ setTimeout(()=>{ try{ if(enabled()) bed(); }catch(e){} },60); },{passive:true}));
  INK.toggle=function(){ INK.on=!INK.on; };
  // I: flip the print on/off to compare with the live look
  addEventListener('keydown',e=>{ if(e.code==='KeyI'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&active()) INK.toggle(); });
})();
