// ============================================================
//  crt_room.js — the tube-TV picture for MV2
//
//  No props, no room: the picture itself does the work. A WebGL pass on top
//  of the game canvas gives it the feel of a 16-bit console on a tube TV:
//  curved glass, scanlines, an aperture-grille mask, bloom, a little colour
//  fringe at the edges and the power-on flash. The page around the screen
//  picks up a faint glow from the colours on screen.
//
//  The game itself is untouched: #c keeps drawing as before and keeps all
//  mouse / touch / key input (the CRT layer ignores the pointer). Phones in
//  play mode, headless test browsers and ?tv=0 get the plain canvas.
//  The CRT button under the screen (or localStorage mv2.tv=off) switches it off.
// ============================================================
(function(){
  'use strict';
  const q=(()=>{ try{ return new URLSearchParams(location.search); }catch(e){ return new URLSearchParams(''); } })();
  const forced=q.get('tv');
  const store={ get(){ try{ return localStorage.getItem('mv2.tv'); }catch(e){ return null; } }, set(v){ try{ localStorage.setItem('mv2.tv',v); }catch(e){} } };
  function wanted(){
    if(forced==='0') return false;
    if(forced==='1'||forced==='gl') return true;
    if(navigator.webdriver) return false;                      // selftest / referee browsers
    return store.get()!=='off';
  }
  const isPhone=()=>document.documentElement.classList.contains('phone-play');

  const CSS=`
  html.mv-tv-on body{background:radial-gradient(ellipse 60% 50% at 50% 45%, rgb(var(--tvglow,90 70 160) / .14), transparent 72%), #04020a;}
  .mv-room{position:relative;width:min(100%,1100px,calc((100vh - 24px) * 1.3));margin:4px auto 0;display:flex;flex-direction:column;align-items:center;}
  .mv-screen{position:relative;width:100%;border-radius:4%/5.3%;overflow:hidden;background:#000;line-height:0;
      box-shadow:0 0 0 2px #000, 0 0 70px 4px rgb(var(--tvglow,90 70 160) / .22);}
  html.mv-tv-on .mv-screen #gameWrap{display:block!important;max-width:none!important;width:100%;}
  html.mv-tv-on .mv-screen canvas#c{display:block;width:100%!important;max-width:none!important;height:auto;border:none!important;}
  .mv-crt{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2}
  .mv-scan{position:absolute;inset:0;pointer-events:none;z-index:2;mix-blend-mode:multiply;
      background:repeating-linear-gradient(180deg,rgba(0,0,0,0) 0 1px,rgba(0,0,0,.28) 1px 2px),
                 radial-gradient(ellipse at 50% 50%,transparent 60%,rgba(0,0,0,.55) 100%);}
  html.mv-tv-on .mv-screen:has(.mv-scan) canvas#c{filter:saturate(1.15) contrast(1.06) brightness(1.06)}
  .mv-glass{position:absolute;inset:0;pointer-events:none;z-index:3;border-radius:inherit;
      background:radial-gradient(ellipse 85% 60% at 28% 12%,rgba(255,255,255,.06),transparent 55%);
      box-shadow:inset 0 0 60px rgba(0,0,0,.5), inset 0 0 6px rgba(0,0,0,.9);}
  .mv-tvbtn{all:unset;cursor:pointer;margin:8px auto 0;font:700 11px/1 system-ui,sans-serif;letter-spacing:.14em;color:#c8b8ff;
      padding:6px 12px;border-radius:8px;background:#140c24;border:1px solid #3a2878}
  .mv-tvbtn:focus-visible{outline:2px solid #f0d070;outline-offset:2px}
  `;

  // ── WebGL CRT pass ──────────────────────────────────────────────
  const VS=`attribute vec2 p; varying vec2 uv; void main(){ uv=p*.5+.5; gl_Position=vec4(p,0.,1.); }`;
  const FS=`precision mediump float;
  uniform sampler2D t; uniform vec2 src; uniform float time; uniform float on;
  varying vec2 uv;
  vec2 curve(vec2 p){ p=p*2.-1.; vec2 o=abs(p.yx)/vec2(5.2,4.2); p+=p*o*o; return p*.5+.5; }
  void main(){
    vec2 q=curve(uv);
    // power-on: the picture opens from a bright line
    float oy=clamp(on*1.6,0.004,1.), ox=clamp(on*6.,0.02,1.);
    q=(q-.5)/vec2(ox,oy)+.5;
    if(q.x<0.||q.x>1.||q.y<0.||q.y>1.){ gl_FragColor=vec4(0.,0.,0.,1.); return; }
    vec2 d=q-.5; float r=dot(d,d);
    float ca=.0016*r*4.;
    vec3 c=vec3(texture2D(t,q+vec2(ca,0.)).r, texture2D(t,q).g, texture2D(t,q-vec2(ca,0.)).b);
    // bloom: a cheap ring of taps, only the bright part glows
    vec2 px=1./src; vec3 b=vec3(0.);
    b+=texture2D(t,q+px*vec2( 3., 0.)).rgb; b+=texture2D(t,q+px*vec2(-3., 0.)).rgb;
    b+=texture2D(t,q+px*vec2( 0., 3.)).rgb; b+=texture2D(t,q+px*vec2( 0.,-3.)).rgb;
    b+=texture2D(t,q+px*vec2( 5., 5.)).rgb; b+=texture2D(t,q+px*vec2(-5., 5.)).rgb;
    b+=texture2D(t,q+px*vec2( 5.,-5.)).rgb; b+=texture2D(t,q+px*vec2(-5.,-5.)).rgb;
    b/=8.;
    c+=max(b-.42,0.)*.55+b*.06;
    // scanlines (one every 2 source rows, like a 384-line set) that bloom thinner on bright rows
    float lum=dot(c,vec3(.3,.59,.11));
    float sl=sin(q.y*src.y*1.5708); sl*=sl;
    c*=mix(1.-.34*(1.-lum*.6),1.04,sl);
    // aperture grille
    float m=mod(gl_FragCoord.x,3.);
    vec3 mask=vec3(.9); if(m<1.) mask.r=1.06; else if(m<2.) mask.g=1.06; else mask.b=1.06;
    c*=mask;
    // vignette + soft tube edge
    float v=16.*q.x*q.y*(1.-q.x)*(1.-q.y); c*=pow(clamp(v,0.,1.),.22);
    c*=1.+.01*sin(time*120.)+.006*sin(q.y*6.-time*2.);
    c=pow(c,vec3(.94))*1.06;
    c+=vec3(1.,.98,1.)*(1.-smoothstep(0.,.5,on))*1.4*(1.-smoothstep(0.,.02,abs(uv.y-.5)));   // the line flash
    gl_FragColor=vec4(c,1.);
  }`;
  function makeGL(cv){
    const gl=cv.getContext('webgl',{alpha:false,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:false});
    if(!gl) return null;
    try{ const e=gl.getExtension('WEBGL_debug_renderer_info'); const rn=e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
      if(/swiftshader|llvmpipe|software|basic render/i.test(String(rn))&&forced!=='gl') return null; }catch(e){}   // no GPU: the CSS look is kinder
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
    return {gl, u:{src:gl.getUniformLocation(pr,'src'), time:gl.getUniformLocation(pr,'time'), on:gl.getUniformLocation(pr,'on')}};
  }

  let S=null;          // live state while the TV is on
  function build(){
    const game=document.getElementById('c'); if(!game) return null;
    const wrap=document.getElementById('gameWrap')||game;
    const room=document.createElement('div'); room.className='mv-room';
    room.innerHTML='<div class="mv-screen"><div class="mv-glass"></div></div><button class="mv-tvbtn" type="button" title="Switch the tube-TV look off">CRT ON</button>';
    const marker=document.createComment('mv-tv'); wrap.parentNode.insertBefore(marker,wrap);
    marker.parentNode.insertBefore(room,marker);
    const screen=room.querySelector('.mv-screen');
    screen.insertBefore(wrap,screen.firstChild);
    room.querySelector('.mv-tvbtn').addEventListener('click',()=>{ store.set('off'); disable(); game.focus&&game.focus(); });
    const cv=document.createElement('canvas'); cv.className='mv-crt'; cv.setAttribute('aria-hidden','true');
    screen.insertBefore(cv,screen.querySelector('.mv-glass'));
    let G=null; try{ G=makeGL(cv); }catch(e){ console.warn('MV TV: CRT shader off',e); G=null; }
    if(!G){ cv.remove(); const sc=document.createElement('div'); sc.className='mv-scan'; screen.insertBefore(sc,screen.querySelector('.mv-glass')); }
    return {room, marker, wrap, game, cv, G, t0:performance.now(), raf:0, glowAt:0, small:null};
  }
  function frame(now){
    if(!S) return;
    S.raf=requestAnimationFrame(frame);
    const {G,cv,game}=S;
    if(G){
      const r=cv.getBoundingClientRect(), dpr=Math.min(2,window.devicePixelRatio||1);
      const w=Math.max(2,Math.round(r.width*dpr)), h=Math.max(2,Math.round(r.height*dpr));
      if(cv.width!==w||cv.height!==h){ cv.width=w; cv.height=h; }
      const gl=G.gl; gl.viewport(0,0,w,h);
      try{ gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,game); }catch(e){ return; }
      const t=(now-S.t0)/1000;
      gl.uniform2f(G.u.src,game.width,game.height); gl.uniform1f(G.u.time,t); gl.uniform1f(G.u.on,Math.min(1,Math.max(0,(t-0.15)/0.7)));
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      const dt=now-(S.last||now); S.last=now;
      if(dt>0&&dt<1000){ S.slow=(S.slow||0)*0.95+(dt>34?1:0)*0.05; if(t>3&&S.slow>0.6){ console.warn('MV TV: shader too slow here, using the light CRT look'); cv.remove(); S.G=null; const sc=document.createElement('div'); sc.className='mv-scan'; const scr=S.room.querySelector('.mv-screen'); scr.insertBefore(sc,scr.querySelector('.mv-glass')); } }
    }
    // the room picks up the colour on screen, a few times a second
    if(now-S.glowAt>180){
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
  function enable(){
    if(S||isPhone()) return;
    if(!document.querySelector('style[data-mv-tv]')){ const st=document.createElement('style'); st.setAttribute('data-mv-tv',''); st.textContent=CSS; document.head.appendChild(st); }
    S=build(); if(!S) return;
    document.documentElement.classList.add('mv-tv-on');
    S.raf=requestAnimationFrame(frame);
    if(offBtn) offBtn.remove(), offBtn=null;
  }
  let offBtn=null;
  function disable(){
    if(!S) return;
    cancelAnimationFrame(S.raf);
    S.marker.parentNode.insertBefore(S.wrap,S.marker); S.marker.remove(); S.room.remove();
    document.documentElement.classList.remove('mv-tv-on');
    S=null;
    if(!isPhone()&&!offBtn){
      offBtn=document.createElement('button'); offBtn.type='button'; offBtn.textContent='CRT OFF'; offBtn.title='Switch the tube-TV look back on';
      offBtn.style.cssText='margin:6px auto;display:block;font:700 12px/1 system-ui,sans-serif;letter-spacing:.14em;padding:8px 14px;border-radius:8px;cursor:pointer;color:#f0d070;background:#1a1028;border:1px solid #7868c0';
      offBtn.addEventListener('click',()=>{ store.set('on'); enable(); });
      const w=document.getElementById('gameWrap')||document.getElementById('c'); w.parentNode.insertBefore(offBtn,w.nextSibling);
    }
  }
  function boot(){
    if(wanted()) enable();
    // a phone switching into play mode gets the plain canvas
    try{ new MutationObserver(()=>{ if(isPhone()&&S) disable(); }).observe(document.documentElement,{attributes:true,attributeFilter:['class']}); }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.MV_TV={enable, disable, get on(){ return !!S; }};
})();
