// ============================================================
//  crt_room.js — the display: console video out + the tube TV
//
//  One WebGL pass draws the game canvas (#c) to the screen the way the
//  console and its TV would:
//   · console video (console16.js picks the mode): the text layer on the
//     console's double-resolution grid, its colour depth (SNES 15-bit,
//     Mega Drive 9-bit through its non-linear DAC with ordered dithering),
//     its brightness/palette fades;
//   · the tube TV (CRT on): curved glass, 224 scanlines, composite blur that
//     melts the Mega Drive dithering the way real TVs did, the Model 1
//     "jailbars", aperture-grille mask, bloom, power-on flash.
//  #c keeps all input (this layer ignores the pointer).
//
//  No GPU (software GL), phones in play mode or ?tv=0: no WebGL layer;
//  console16.js then does a lighter version of the console pass itself.
//  The CRT button under the screen (or localStorage mv2.tv=off) switches the
//  TV part off; the console part follows the Options menu.
// ============================================================
(function(){
  'use strict';
  const q=(()=>{ try{ return new URLSearchParams(location.search); }catch(e){ return new URLSearchParams(''); } })();
  const forced=q.get('tv');
  const store={ get(){ try{ return localStorage.getItem('mv2.tv'); }catch(e){ return null; } }, set(v){ try{ localStorage.setItem('mv2.tv',v); }catch(e){} } };
  // no choice saved yet: the TV comes with the console look (A/B); POSH is clean
  const consoleSaved=(()=>{ try{ return q.get('console')||localStorage.getItem('mv2.console'); }catch(e){ return null; } })();
  let crtOn=forced==='0'?false:(forced==='1'||forced==='gl')?true:store.get()?store.get()!=='off':(consoleSaved==='snes'||consoleSaved==='md');
  const isPhone=()=>document.documentElement.classList.contains('phone-play');

  const CSS=`
  html.mv-tv-on body{background:radial-gradient(ellipse 60% 50% at 50% 45%, rgb(var(--tvglow,90 70 160) / .14), transparent 72%), #04020a;}
  .mv-room{position:relative;width:min(100%,1100px,calc((100vh - 24px) * 1.3));margin:4px auto 0;display:flex;flex-direction:column;align-items:center;}
  .mv-screen{position:relative;width:100%;overflow:hidden;background:#000;line-height:0;}
  html.mv-tv-on .mv-screen{border-radius:4%/5.3%;box-shadow:0 0 0 2px #000, 0 0 70px 4px rgb(var(--tvglow,90 70 160) / .22);}
  .mv-screen #gameWrap{display:block!important;max-width:none!important;width:100%;}
  .mv-screen canvas#c{display:block;width:100%!important;max-width:none!important;height:auto;border:none!important;}
  .mv-crt{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2}
  .mv-scan{position:absolute;inset:0;pointer-events:none;z-index:2;display:none;
      background:repeating-linear-gradient(180deg,rgba(0,0,0,0) 0 1.7px,rgba(0,0,0,.3) 1.7px 3.4px),
                 radial-gradient(ellipse at 50% 50%,transparent 60%,rgba(0,0,0,.55) 100%);}
  html.mv-tv-on .mv-screen.no-gl .mv-scan{display:block}
  .mv-glass{position:absolute;inset:0;pointer-events:none;z-index:3;border-radius:inherit;display:none;
      background:radial-gradient(ellipse 85% 60% at 28% 12%,rgba(255,255,255,.06),transparent 55%);
      box-shadow:inset 0 0 60px rgba(0,0,0,.5), inset 0 0 6px rgba(0,0,0,.9);}
  html.mv-tv-on .mv-glass{display:block}
  .mv-tvbtn{all:unset;cursor:pointer;font:700 11px/1 system-ui,sans-serif;letter-spacing:.12em;
      padding:6px 10px;border-radius:8px;border:1px solid #3a2878;color:#9c8cc8;background:#120a22}
  .mv-tvbtn[aria-pressed="true"]{color:#ffe39a;border-color:#f0d070;background:#2a1650}
  .mv-tvbtn:focus-visible,.mv-console-bar button:focus-visible{outline:2px solid #f0d070;outline-offset:2px}
  `;

  const VS=`attribute vec2 p; varying vec2 uv; void main(){ uv=p*.5+.5; gl_Position=vec4(p,0.,1.); }`;
  const FS=`precision highp float;
  uniform sampler2D t; uniform vec2 src; uniform float time; uniform float on;
  uniform float crt; uniform float pal; uniform vec2 grid; uniform float fade;
  varying vec2 uv;
  vec2 curve(vec2 p){ p=p*2.-1.; vec2 o=abs(p.yx)/vec2(5.2,4.2); p+=p*o*o; return p*.5+.5; }
  float bayer2(vec2 a){ a=floor(a); return fract(dot(a,vec2(.5,a.y*.75))); }
  float bayer4(vec2 a){ return bayer2(.5*a)*.25+bayer2(a); }
  float dac(float x){                       // Mega Drive 3-bit DAC, measured levels
    float r=0.;
    r=x>26.?52.:r; r=x>69.5?87.:r; r=x>101.5?116.:r; r=x>130.?144.:r; r=x>158.?172.:r; r=x>189.?206.:r; r=x>230.5?255.:r;
    return r/255.;
  }
  vec3 pix(vec2 q){
    vec2 g=(floor(q*grid)+.5)/grid;
    vec3 c=texture2D(t,g).rgb*(1.-fade);
    if(pal<1.5) return floor(c*31.+.5)/31.;                       // SNES: 15-bit colour
    vec3 x=c*255.+(bayer4(floor(q*grid*.5))-.47)*24.;              // MD: dither on console pixels
    return vec3(dac(x.r),dac(x.g),dac(x.b));
  }
  vec3 toYIQ(vec3 c){ return vec3(dot(c,vec3(.299,.587,.114)), dot(c,vec3(.596,-.274,-.322)), dot(c,vec3(.211,-.523,.312))); }
  vec3 toRGB(vec3 y){ return vec3(y.x+.956*y.y+.621*y.z, y.x-.272*y.y-.647*y.z, y.x-1.106*y.y+1.703*y.z); }
  void main(){
    vec2 q=crt>.5?curve(uv):uv;
    if(crt>.5){ float oy=clamp(on*1.6,.004,1.), ox=clamp(on*6.,.02,1.); q=(q-.5)/vec2(ox,oy)+.5; }
    if(q.x<0.||q.x>1.||q.y<0.||q.y>1.){ gl_FragColor=vec4(0.,0.,0.,1.); return; }
    vec3 c;
    if(pal>.5){
      float px=1./grid.x;
      if(crt>.5){
        // NTSC composite: brightness (Y) keeps more detail than colour (I/Q),
        // which bleeds across several pixels; fine luma detail leaks into the
        // colour carrier as rainbow / dot crawl (strong on the Mega Drive,
        // whose dithering the TV melts into new colours).
        float cp=2./grid.x;                                        // one console pixel
        bool md=pal>1.5;
        vec3 s0=toYIQ(pix(q)), sl=toYIQ(pix(q-vec2(cp,0.))), sr=toYIQ(pix(q+vec2(cp,0.)));
        vec3 sl2=toYIQ(pix(q-vec2(2.*cp,0.))), sr2=toYIQ(pix(q+vec2(2.*cp,0.)));
        float Y=md? s0.x*.5+(sl.x+sr.x)*.25 : s0.x*.72+(sl.x+sr.x)*.14;   // MD's faster pixel clock blurs more
        vec2 IQ=(s0.yz*3.+(sl.yz+sr.yz)*2.+(sl2.yz+sr2.yz))/9.;
        if(md){ vec3 l3=toYIQ(pix(q-vec2(3.*cp,0.))), r3=toYIQ(pix(q+vec2(3.*cp,0.))); IQ=(IQ*9.+(l3.yz+r3.yz)*1.5)/12.; }
        float hf=(sr.x-sl.x);                                       // luma edges / dither
        float ph=floor(q.x*grid.x*.5)*1.5708+floor(time*60.)*3.14159;
        float art=(md?.42:.12)*hf;
        IQ+=vec2(cos(ph),sin(ph))*art;
        c=clamp(toRGB(vec3(Y,IQ)),0.,1.);
      }else c=pix(q);
    }else{
      vec2 d=q-.5; float ca=crt>.5?.0064*dot(d,d):0.;
      c=vec3(texture2D(t,q+vec2(ca,0.)).r, texture2D(t,q).g, texture2D(t,q-vec2(ca,0.)).b)*(1.-fade);
    }
    if(crt>.5){
      vec2 px=1./src; vec3 b=vec3(0.);
      b+=texture2D(t,q+px*vec2( 4., 0.)).rgb; b+=texture2D(t,q+px*vec2(-4., 0.)).rgb;
      b+=texture2D(t,q+px*vec2( 0., 4.)).rgb; b+=texture2D(t,q+px*vec2( 0.,-4.)).rgb;
      b+=texture2D(t,q+px*vec2( 7., 6.)).rgb; b+=texture2D(t,q+px*vec2(-7., 6.)).rgb;
      b+=texture2D(t,q+px*vec2( 7.,-6.)).rgb; b+=texture2D(t,q+px*vec2(-7.,-6.)).rgb;
      b*=(1.-fade)/8.;
      c+=max(b-.42,0.)*.55+b*.05;
      float lines=pal>.5?224.:384.;
      float lum=dot(c,vec3(.3,.59,.11));
      float sl=sin(q.y*lines*3.14159); sl*=sl;
      c*=mix(1.-.42*(1.-lum*.55),1.06,sl);
      if(pal>1.5) c*=1.+.022*sin(q.x*320.*1.5708);                 // Model 1 jailbars
      float m=mod(gl_FragCoord.x,3.);
      vec3 mask=vec3(.9); if(m<1.) mask.r=1.06; else if(m<2.) mask.g=1.06; else mask.b=1.06;
      c*=mask;
      float v=16.*q.x*q.y*(1.-q.x)*(1.-q.y); c*=pow(clamp(v,0.,1.),.22);
      c*=1.+.01*sin(time*120.)+.006*sin(q.y*6.-time*2.);
      c=pow(max(c,0.),vec3(.94))*1.06;
      c+=vec3(1.,.98,1.)*(1.-smoothstep(0.,.5,on))*1.4*(1.-smoothstep(0.,.02,abs(uv.y-.5)));
    }
    gl_FragColor=vec4(c,1.);
  }`;
  function makeGL(cv){
    const gl=cv.getContext('webgl',{alpha:false,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:false});
    if(!gl) return null;
    try{ const e=gl.getExtension('WEBGL_debug_renderer_info'); const rn=e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
      if(/swiftshader|llvmpipe|software|basic render/i.test(String(rn))&&forced!=='gl') return null; }catch(e){}
    const sh=(type,src)=>{ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr=gl.createProgram(); gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS)); gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS)); gl.linkProgram(pr);
    if(!gl.getProgramParameter(pr,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buf);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const loc=gl.getAttribLocation(pr,'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    const tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    const U=n=>gl.getUniformLocation(pr,n);
    return {gl, u:{src:U('src'), time:U('time'), on:U('on'), crt:U('crt'), pal:U('pal'), grid:U('grid'), fade:U('fade')}};
  }

  let S=null;
  function consoleMode(){ const C=window.MV_CONSOLE; return C&&C.MODES&&C.MODES[C.mode]?C.mode:'off'; }
  function build(){
    const game=document.getElementById('c'); if(!game) return null;
    const wrap=document.getElementById('gameWrap')||game;
    const room=document.createElement('div'); room.className='mv-room';
    room.innerHTML='<div class="mv-screen"><div class="mv-scan"></div><div class="mv-glass"></div></div>';
    const marker=document.createComment('mv-tv'); wrap.parentNode.insertBefore(marker,wrap);
    marker.parentNode.insertBefore(room,marker);
    const screen=room.querySelector('.mv-screen');
    screen.insertBefore(wrap,screen.firstChild);
    const cv=document.createElement('canvas'); cv.className='mv-crt'; cv.setAttribute('aria-hidden','true');
    screen.insertBefore(cv,screen.querySelector('.mv-scan'));
    let G=null; try{ G=makeGL(cv); }catch(e){ console.warn('MV display: shader off',e); G=null; }
    if(!G){ cv.remove(); screen.classList.add('no-gl'); }
    return {room, screen, game, cv, G, t0:performance.now(), raf:0, glowAt:0};
  }
  function dropGL(why){
    if(!S||!S.G) return;
    console.warn('MV display: '+why+' — using the light version');
    S.cv.remove(); S.G=null; S.screen.classList.add('no-gl');
  }
  function frame(now){
    if(!S) return;
    S.raf=requestAnimationFrame(frame);
    const {G,cv,game}=S;
    const cm=consoleMode(), C=window.MV_CONSOLE;
    const need=crtOn||cm!=='off';
    if(G){
      cv.style.display=need?'':'none';
      if(need){
        const r=cv.getBoundingClientRect(), dpr=Math.min(2,window.devicePixelRatio||1);
        const w=Math.max(2,Math.round(r.width*dpr)), h=Math.max(2,Math.round(r.height*dpr));
        if(cv.width!==w||cv.height!==h){ cv.width=w; cv.height=h; }
        const gl=G.gl; gl.viewport(0,0,w,h);
        try{ gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,game); }catch(e){ return; }
        const t=(now-S.t0)/1000, M=cm!=='off'?C.MODES[cm]:null;
        gl.uniform2f(G.u.src,game.width,game.height); gl.uniform1f(G.u.time,t);
        gl.uniform1f(G.u.on,crtOn?Math.min(1,Math.max(0,(t-0.15)/0.7)):1);
        gl.uniform1f(G.u.crt,crtOn?1:0); gl.uniform1f(G.u.pal,cm==='snes'?1:cm==='md'?2:0);
        gl.uniform2f(G.u.grid,M?M.hw:1024,M?M.hh:768);
        gl.uniform1f(G.u.fade,C&&C.fadeStep?C.fadeStep:0);
        gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
        const dt=now-(S.last||now); S.last=now;
        if(dt>0&&dt<1000){ S.slow=(S.slow||0)*0.95+(dt>34?1:0)*0.05; if(t>3&&S.slow>0.6&&forced!=='gl') dropGL('display shader too slow here'); }
      }
    }
    if(crtOn&&now-S.glowAt>180){                    // the page around the set picks up the screen's colour
      S.glowAt=now;
      try{
        if(!S.small){ S.small=document.createElement('canvas'); S.small.width=8; S.small.height=6; S.sctx=S.small.getContext('2d',{willReadFrequently:true}); }
        S.sctx.drawImage(game,0,0,8,6); const d=S.sctx.getImageData(0,0,8,6).data;
        let r=0,g=0,b=0; for(let i=0;i<d.length;i+=4){ r+=d[i]; g+=d[i+1]; b+=d[i+2]; }
        const n=d.length/4, k=1.6; r=Math.min(255,r/n*k+20); g=Math.min(255,g/n*k+14); b=Math.min(255,b/n*k+30);
        const cur=S.glow||[r,g,b]; S.glow=cur.map((v,i)=>v+([r,g,b][i]-v)*0.35);
        document.documentElement.style.setProperty('--tvglow',S.glow.map(Math.round).join(' '));
      }catch(e){}
    }
  }
  function setCrt(v){
    crtOn=!!v; store.set(crtOn?'on':'off');
    document.documentElement.classList.toggle('mv-tv-on',crtOn&&!!S);
    if(S) S.t0=performance.now();
    document.querySelectorAll('.mv-tvbtn').forEach(b=>{ b.setAttribute('aria-pressed',crtOn); b.textContent=crtOn?'CRT TV: ON':'CRT TV: OFF'; });
  }
  function boot(){
    if(!document.querySelector('style[data-mv-tv]')){ const st=document.createElement('style'); st.setAttribute('data-mv-tv',''); st.textContent=CSS; document.head.appendChild(st); }
    if(forced!=='0'&&!isPhone()){ S=build(); if(S) S.raf=requestAnimationFrame(frame); }
    setCrt(crtOn);
    try{ new MutationObserver(()=>{ if(isPhone()&&S&&S.G) dropGL('phone play mode'); }).observe(document.documentElement,{attributes:true,attributeFilter:['class']}); }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.MV_TV={
    get on(){ return crtOn; }, set on(v){ setCrt(v); },
    get gl(){ return !!(S&&S.G); },                // console16 leaves palette + text layer to the shader
    toggle(){ setCrt(!crtOn); }
  };
})();
