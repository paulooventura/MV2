// art-catalog.js — Catalog tab of the Art Board (Paulo 2026-11-27: "we also need the characters, objects, foes,
// everything accounted for. That way we can specify what needs to be changed" + "the worlds collision map perspective").
// Reads claude/assets/catalog/catalog.json, written by scripts/capture-catalog.mjs from the running game.
(function(){
'use strict';
const $=id=>document.getElementById(id);
let CAT=null, stage=0, filter='all', HB={}, HS={};
// ── hit shapes (hitshapes.js): every foe's outline and each hero's five parts, drawn over the cut-out and editable ──
const PART_COL={wheel:'#ffd84a', body:'#5affc8', head:'#b48cff', glove:'#ff6a8a', plug:'#58b4ff'};
const PART_NAME={wheel:'wheel', body:'body (speaker)', head:'head (bulb, record, hat)', glove:'glove hand', plug:'plug hand'};
const FOE_COL='#ff4a5a';
const NS='http://www.w3.org/2000/svg';
function svgEl(tag,attr){ const e=document.createElementNS(NS,tag); for(const k in attr) e.setAttribute(k,attr[k]); return e; }
// foe outline definition (box fractions about the box centre, spun about pv) <-> cut-out px
function foePose(it){ const sh=it.shape, [bx,by,bw,bh]=it.box, k=sh.k||1, pv=sh.pv||[0,0];
  return {w:bw,h:bh,pv,rot:sh.rot||0,px:bx+bw/2+pv[0]*bw,py:by+bh/2-(sh.lift||0)*k+pv[1]*bh}; }
function foeT(P,lx,ly){ const c=Math.cos(P.rot), s=Math.sin(P.rot), ux=(lx-P.pv[0])*P.w, uy=(ly-P.pv[1])*P.h; return [P.px+ux*c-uy*s, P.py+ux*s+uy*c]; }
function foeInv(P,X,Y){ const c=Math.cos(P.rot), s=Math.sin(P.rot), ux=X-P.px, uy=Y-P.py; return [+(((ux*c+uy*s)/P.w)+P.pv[0]).toFixed(4), +(((-ux*s+uy*c)/P.h)+P.pv[1]).toFixed(4)]; }
function foeDef(it){ const ov=HS[it.name]; return JSON.parse(JSON.stringify(ov&&ov.parts?{parts:ov.parts}:{parts:it.shape.parts})); }
function heroOv(it){ const ov=HS[it.name]||{}, o={}; for(const k in PART_COL) o[k]=Object.assign({dx:0,dy:0,s:1},ov[k]||{}); return o; }
// the shape in cut-out px: [{k:'c',x,y,r,id}|{k:'p',v,id}, ...]
function shapePx(it,def){
  const sh=it.shape; if(!sh) return null;
  if(sh.hero){ const k=sh.k||1, [bx,by]=it.box, ov=def||heroOv(it);
    return sh.parts.map(q=>{ const o=ov[q.id]||{dx:0,dy:0,s:1}, s=o.s>0?o.s:1, ox=bx+q.o[0]*k, oy=by+q.o[1]*k, dx=(o.dx||0)*sh.fd*k, dy=(o.dy||0)*k;
      const T=(x,y)=>[ox+(bx+x*k-ox)*s+dx, oy+(by+y*k-oy)*s+dy];
      if(q.k==='c'){ const c=T(q.x,q.y); return {k:'c',x:c[0],y:c[1],r:q.r*k*s,id:q.id}; }
      return {k:'p',v:q.v.map(a=>T(a[0],a[1])),id:q.id}; }); }
  const P=foePose(it), d=def||foeDef(it);
  return d.parts.map((q,i)=>{ if(q.k==='c'){ const c=foeT(P,q.x,q.y); return {k:'c',x:c[0],y:c[1],r:q.r*P.w,id:q.id||('part'+i)}; }
    return {k:'p',v:q.v.map(a=>foeT(P,a[0],a[1])),id:q.id||('part'+i)}; });
}
function drawShapes(svg,parts,hero,sw){
  for(const q of parts){ const col=hero?(PART_COL[q.id]||'#fff'):FOE_COL;
    const a={fill:col,'fill-opacity':.16,stroke:col,'stroke-width':sw||1.4,'vector-effect':'non-scaling-stroke'};
    svg.appendChild(q.k==='c'?svgEl('circle',Object.assign({cx:q.x,cy:q.y,r:q.r},a)):svgEl('polygon',Object.assign({points:q.v.map(p=>p.join(',')).join(' ')},a))); }
}
function hsLegend(it){
  if(!it.shape) return '';
  if(it.shape.hero) return '<div class="hsLegend">'+it.shape.parts.map(q=>'<span><i style="background:'+PART_COL[q.id]+'"></i>'+PART_NAME[q.id]+'</span>').join('')+'</div>';
  const p=foeDef(it).parts, nC=p.filter(q=>q.k==='c').length, poly=p.filter(q=>q.k==='p');
  const txt=poly.map(q=>q.v.length===3?'triangle':q.v.length===4?'4-point outline':q.v.length+'-point outline').concat(nC?[nC===1?'circle':nC+' circles']:[]).join(' + ');
  return '<div class="hsLegend"><span><i style="background:'+FOE_COL+'"></i>'+txt+'</span></div>';
}
// the editor: the cut-out big; drag points, circle centres and rims (foes), or whole parts and their size knob (heroes)
function openEditor(it,img,onSaved){
  const old=document.getElementById('hsEd'); if(old) old.remove();
  const nw=img.naturalWidth, nh=img.naturalHeight, Z=Math.max(2,Math.min(6,Math.floor(Math.min(700/nw,560/nh))));
  const hero=!!it.shape.hero;
  let def=hero?heroOv(it):foeDef(it), sel=null;
  const ed=document.createElement('div'); ed.id='hsEd';
  ed.innerHTML='<div class="box"><b>'+nice(it.name)+'</b> · hit shape <div class="sub">'+(hero?'Drag a part to move it, its knob to resize it. Hits use these parts; walls and floors still use the body box (dotted).':'Drag the white points: outline corners, a circle\'s centre, its yellow rim knob. Click a corner, then add or remove a point after it.')+'</div>'+
    '<div class="hsHost" style="margin:8px 0"></div><div class="row">'+(hero?'':'<button class="btn" data-a="add">+ point after selected</button><button class="btn" data-a="del">− selected point</button>')+
    '<button class="btn" data-a="save">Save</button><button class="btn" data-a="orig">Original</button><button class="btn" data-a="close">Close</button></div><div class="msg"></div></div>';
  document.body.appendChild(ed);
  const host=ed.querySelector('.hsHost'), msg=ed.querySelector('.msg');
  const svg=svgEl('svg',{viewBox:'0 0 '+nw+' '+nh,width:nw*Z,height:nh*Z});
  host.appendChild(svg);
  const toPx=ev=>{ const r=svg.getBoundingClientRect(); return [(ev.clientX-r.left)*nw/r.width,(ev.clientY-r.top)*nh/r.height]; };
  const drag=(el,move,start)=>{ el.classList.add('hd'); el.style.pointerEvents='all';
    el.onpointerdown=ev=>{ ev.preventDefault(); ev.stopPropagation(); const p0=toPx(ev); if(start) start(p0);
      const mv=e2=>{ move(toPx(e2),p0); paint(); }, up=()=>{ window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',up); paint(); };
      window.addEventListener('pointermove',mv); window.addEventListener('pointerup',up); }; };
  const knob=(x,y,col)=>svgEl('circle',{cx:x,cy:y,r:Math.max(1.6,6/Z),fill:col||'#fff',stroke:'#111','stroke-width':1,'vector-effect':'non-scaling-stroke'});
  function paint(){
    svg.innerHTML=''; svg.appendChild(svgEl('image',{href:img.src,x:0,y:0,width:nw,height:nh,style:'image-rendering:pixelated'}));
    const [bx,by,bw,bh]=it.box; svg.appendChild(svgEl('rect',{x:bx,y:by,width:bw,height:bh,fill:'none',stroke:'#3cff8a','stroke-dasharray':'3 3','stroke-width':1,'vector-effect':'non-scaling-stroke',opacity:.6}));
    const parts=shapePx(it,def); drawShapes(svg,parts,hero,2);
    if(hero){
      const k=it.shape.k||1, fd=it.shape.fd||1;
      parts.forEach(q=>{ const o=def[q.id];
        const b=q.k==='c'?{x:q.x-q.r,y:q.y-q.r,w:2*q.r,h:2*q.r}:(()=>{ const xs=q.v.map(a=>a[0]), ys=q.v.map(a=>a[1]), x=Math.min(...xs), y=Math.min(...ys); return {x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y}; })();
        const hit=q.k==='c'?svgEl('circle',{cx:q.x,cy:q.y,r:q.r,fill:'transparent'}):svgEl('polygon',{points:q.v.map(p=>p.join(',')).join(' '),fill:'transparent'});
        svg.appendChild(hit); let d0;
        drag(hit,(p,s)=>{ o.dx=+(d0.dx+(p[0]-s[0])/k*fd).toFixed(1); o.dy=+(d0.dy+(p[1]-s[1])/k).toFixed(1); },()=>{ d0={dx:o.dx,dy:o.dy}; });
        const t=svgEl('text',{x:b.x+b.w+1.5,y:b.y+3,fill:PART_COL[q.id],'font-size':Math.max(3.5,11/Z),'font-family':'monospace','paint-order':'stroke',stroke:'#000','stroke-width':0.6});
        t.textContent=q.id+(o.s!==1?' ×'+(+o.s).toFixed(2):''); svg.appendChild(t);
        const kn=knob(b.x+b.w,b.y+b.h,PART_COL[q.id]); svg.appendChild(kn);
        const cx=b.x+b.w/2, cy=b.y+b.h/2; let s0, r0;
        drag(kn,p=>{ const r=Math.hypot(p[0]-cx,p[1]-cy); o.s=+Math.max(0.25,Math.min(4,s0*r/r0)).toFixed(3); },p=>{ s0=o.s; r0=Math.max(1,Math.hypot(p[0]-cx,p[1]-cy)); });
      });
      return;
    }
    const P=foePose(it);
    def.parts.forEach((q,pi)=>{
      if(q.k==='c'){ const c=foeT(P,q.x,q.y), R=q.r*P.w;
        const kc=knob(c[0],c[1]); svg.appendChild(kc); drag(kc,p=>{ const l=foeInv(P,p[0],p[1]); q.x=l[0]; q.y=l[1]; });
        const kr=knob(c[0]+R,c[1],'#ffd84a'); svg.appendChild(kr); drag(kr,p=>{ const cc=foeT(P,q.x,q.y); q.r=+Math.max(0.02,Math.hypot(p[0]-cc[0],p[1]-cc[1])/P.w).toFixed(4); });
        return; }
      q.v.forEach((a,vi)=>{ const w=foeT(P,a[0],a[1]), kn=knob(w[0],w[1],sel&&sel[0]===pi&&sel[1]===vi?'#ffd84a':'#fff'); svg.appendChild(kn);
        drag(kn,p=>{ const l=foeInv(P,p[0],p[1]); a[0]=l[0]; a[1]=l[1]; },()=>{ sel=[pi,vi]; }); });
    });
  }
  paint();
  const post=b=>fetch('/api/hitshape',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json());
  const fail=e=>{ msg.className='msg err'; msg.textContent='Not saved: '+e.message; };
  ed.onclick=ev=>{ const a=ev.target.dataset&&ev.target.dataset.a; if(!a){ if(ev.target===ed) ed.remove(); return; }
    if(a==='close') return ed.remove();
    if(a==='add'||a==='del'){ if(!sel){ msg.className='msg err'; msg.textContent='Click a corner first.'; return; } const v=def.parts[sel[0]].v;
      if(a==='add'){ const i=sel[1], j=(i+1)%v.length; v.splice(i+1,0,[+((v[i][0]+v[j][0])/2).toFixed(4),+((v[i][1]+v[j][1])/2).toFixed(4)]); sel=[sel[0],i+1]; }
      else if(v.length>3){ v.splice(sel[1],1); sel=null; } else { msg.className='msg err'; msg.textContent='An outline needs at least 3 points.'; }
      return paint(); }
    if(a==='orig') return post({type:it.name,reset:true}).then(j=>{ if(!j.ok) throw new Error(j.error); HS=j.hitshapes; def=hero?heroOv(it):foeDef(it); paint(); msg.className='msg ok'; msg.textContent='Back to the outline the game draws.'; onSaved(); }).catch(fail);
    if(a==='save') return post({type:it.name,shape:hero?def:{parts:def.parts}}).then(j=>{ if(!j.ok) throw new Error(j.error); HS=j.hitshapes; msg.className='msg ok'; msg.textContent='Saved. Every '+nice(it.name)+' now hits with this shape (reload the game to feel it).'; onSaved(); }).catch(fail);
  };
}

const KIND={hero:'Characters',foe:'Foes',object:'Objects & pickups'};
const NAMES={b_circle:'Circle foe',b_tri:'Triangle foe',b_square:'Square foe',square:'Square (wheel rider)',b_cube:'Cube (glass)',b_eye:'Eye foe',b_boss:'Heptagon boss',
  savePt:'Save point',knifePickup:'Knife pickup',isoPickup:'Isolator pickup',gate:'Stage gate',laitu:'Laitu','knowl shell':'Knowl shell',mind:'MIND',venture:'VENTURE'};
function nice(n){ return NAMES[n]||n.replace(/\s*·\s*#[0-9a-f]{6}$/i,'').replace(/^BLOCK$/,'Block (plain)').replace(/^PUSH$/,'Push block').replace(/^PULL$/,'Pull block').replace(/^LASER$/,'Laser block'); }
function blank(img){ // a cut-out with almost no variation = the thing was not on screen at capture time
  try{ const c=document.createElement('canvas'); c.width=c.height=16; const x=c.getContext('2d'); x.drawImage(img,0,0,16,16); const d=x.getImageData(0,0,16,16).data; let mn=765,mx=0;
    for(let i=0;i<d.length;i+=4){ const s=d[i]+d[i+1]+d[i+2]; if(s<mn)mn=s; if(s>mx)mx=s; } return mx-mn<40; }catch(e){ return false; } }

function render(){
  if(!CAT){ return; }
  const S=CAT.stages[stage];
  $('catStages').innerHTML=CAT.stages.map((s,i)=>'<button class="'+(i===stage?'on':'')+'" data-i="'+i+'">Stage '+s.id+'</button>').join('');
  $('catInfo').textContent='Captured from build '+CAT.build+' · '+(CAT.at||'').slice(0,16).replace('T',' ')+' · stage '+S.id+' is '+S.cols+'×'+S.rows+' tiles of '+S.tile+' px';
  $('catMap').src=S.collision+'?t='+Date.now();
  const c=S.counts||{};
  $('catCounts').innerHTML='<span><i style="background:#8c8f99"></i>solid '+c.solid+'</span><span><i style="background:#3fd0ff;height:3px"></i>one-way (from above) '+c.oneway+'</span>'+
    '<span><i style="background:#ff9a3c"></i>breakable '+c.destructible+'</span><span><i style="background:#6ad06a"></i>slopes '+c.slopes+'</span>'+
    '<span><i style="border:2px solid #ff4a5a"></i>foes</span><span><i style="border:2px solid #ffd84a"></i>blocks</span><span><i style="border:2px solid #5affc8"></i>knowl shells</span><span><i style="border:2px solid #b48cff"></i>hero start</span>';
  const items=S.items.filter(it=>filter==='all'||it.kind===filter);
  const groups={}; items.forEach(it=>(groups[it.kind]=groups[it.kind]||[]).push(it));
  const host=$('catGrid'); host.innerHTML='';
  Object.keys(KIND).filter(k=>groups[k]).forEach(k=>{
    const h=document.createElement('div'); h.className='grp'; h.textContent=KIND[k]+' · '+groups[k].length; host.appendChild(h);
    const wrap=document.createElement('div'); wrap.className='catRow'; host.appendChild(wrap);
    groups[k].forEach(it=>{
      const card=document.createElement('div'); card.className='catCard';
      const im=new Image(); im.src=it.img+'?t='+Date.now(); im.alt=it.name;
      const meta=[it.count>1?it.count+' in this stage':'1 in this stage', it.w&&it.h?it.w+'×'+it.h+' px':'', it.hp?'HP '+it.hp:'', it.at?'at tile '+it.at.join(', '):''].filter(Boolean).join(' · ');
      const editable=it.kind==='foe'&&/^b_[a-z]+$/.test(it.name), ov=HB[it.name];
      card.innerHTML='<div class="catImg"><div class="hbWrap"></div></div><div class="nm">'+nice(it.name)+'</div><div class="meta">'+meta+'<br><code>'+it.name+'</code></div>'+
        (it.shape?'<div class="hbRow"><b>Hit shape</b> '+(it.shape.hero?'· 5 parts':'· its outline')+' <button class="btn hsEdit">Edit shape</button>'+(HS[it.name]?' <span class="sub">(edited)</span>':'')+hsLegend(it)+'</div>':'')+
        '<div class="hbRow">'+(it.shape?'Body box (walls and floors) ':'Collision box ')+(editable?'<input type="number" class="hbW" min="8" max="400"> × <input type="number" class="hbH" min="8" max="400"> px <button class="btn hbSave">Save</button>'+(ov?' <button class="btn hbReset">Original</button>':''):'<b>'+it.w+'×'+it.h+'</b> px <span class="sub">(view only'+(it.kind==='hero'?': the heroes share one body box, changing it changes how they move':': blocks sit on the tile grid')+')</span>')+'</div><div class="msg hbMsg"></div>';
      const hw=card.querySelector('.hbWrap'); hw.appendChild(im);
      const box=document.createElement('div'); box.className='hb'+(editable?' edit':'')+(it.shape?' faint':''); hw.appendChild(box);
      let svg=null;
      const paintShape=()=>{ if(!it.shape||!im.naturalWidth) return; if(svg) svg.remove(); svg=svgEl('svg',{class:'hsSvg hb',viewBox:'0 0 '+im.naturalWidth+' '+im.naturalHeight,preserveAspectRatio:'none'});
        drawShapes(svg,shapePx(it),!!it.shape.hero,1.4); svg.style.display=$('catBoxes').checked?'':'none'; hw.appendChild(svg); };
      if(it.shape){ const eb=card.querySelector('.hsEdit'); if(eb) eb.onclick=()=>openEditor(it,im,()=>{ paintShape(); }); }
      const orig={w:it.w,h:it.h}, cur={w:ov?ov.w:it.w,h:ov?ov.h:it.h};
      const place=()=>{ if(!it.box||!im.naturalWidth) return; const k=im.clientWidth/im.naturalWidth, [bx,by,bw,bh]=it.box, sw=bw/orig.w, sh=bh/orig.h;
        const w=cur.w*sw, h=cur.h*sh, x=bx+(bw-w)/2, y=by+(bh-h);   // feet and centre stay where the game keeps them
        Object.assign(box.style,{left:(x*k)+'px',top:(y*k)+'px',width:(w*k)+'px',height:(h*k)+'px'}); box.title=cur.w+'×'+cur.h+' px'+(ov?' (edited; original '+orig.w+'×'+orig.h+')':''); box.hidden=!$('catBoxes').checked; };
      if(editable){ const iw=card.querySelector('.hbW'), ih=card.querySelector('.hbH'), m=card.querySelector('.hbMsg'); iw.value=cur.w; ih.value=cur.h;
        iw.oninput=ih.oninput=()=>{ cur.w=+iw.value||cur.w; cur.h=+ih.value||cur.h; place(); };
        // drag the box's top or sides to resize it (feet stay on the ground)
        box.onpointerdown=e=>{ e.preventDefault(); box.setPointerCapture(e.pointerId); const k=im.clientWidth/im.naturalWidth, sx0=e.clientX, sy0=e.clientY, w0=cur.w, h0=cur.h, s=it.box[2]/orig.w;
          box.onpointermove=ev=>{ cur.w=Math.max(8,Math.round(w0+2*(Math.abs(ev.clientX-sx0)*Math.sign(ev.clientX-sx0)*(e.offsetX<box.clientWidth/2?-1:1))/k/s)); cur.h=Math.max(8,Math.round(h0-(ev.clientY-sy0)/k/s)); iw.value=cur.w; ih.value=cur.h; place(); }; };
        box.onpointerup=()=>{ box.onpointermove=null; };
        const post=b=>fetch('/api/hitbox',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json());
        card.querySelector('.hbSave').onclick=()=>post({type:it.name,w:cur.w,h:cur.h}).then(j=>{ if(!j.ok) throw new Error(j.error); HB=j.hitboxes; m.className='msg ok';
          m.textContent='Every '+nice(it.name)+' is now '+cur.w+'×'+cur.h+' in the game (feet and centre kept). Reload the game to feel it.'; }).catch(e=>{ m.className='msg err'; m.textContent='Not saved: '+e.message; });
        const rb=card.querySelector('.hbReset'); if(rb) rb.onclick=()=>post({type:it.name,reset:true}).then(j=>{ HB=j.hitboxes; cur.w=orig.w; cur.h=orig.h; iw.value=cur.w; ih.value=cur.h; place(); m.className='msg ok'; m.textContent='Back to the original '+orig.w+'×'+orig.h+'.'; });
      }
      im.onload=()=>{ place(); paintShape(); if(blank(im)){ const w=document.createElement('div'); w.className='tag unused'; w.textContent='not on screen at capture'; card.querySelector('.meta').prepend(w); } };
      new ResizeObserver(place).observe(im);
      const key='cat:'+S.id.replace('.','-')+':'+it.kind+':'+String(it.name).replace(/[^A-Za-z0-9_ .\-]/g,'_').slice(0,60);
      if(window.BoardNotes&&BoardNotes.box) card.appendChild(BoardNotes.box(key));
      wrap.appendChild(card);
    });
  });
}
function load(){
  return fetch('/api/art-index',{cache:'no-store'}).then(r=>r.json()).then(j=>{ HB=j.hitboxes||{}; HS=j.hitshapes||{}; }).catch(()=>{})
    .then(()=>fetch('assets/catalog/catalog.json?t='+Date.now())).then(r=>r.json()).then(j=>{ CAT=j; render(); })
    .catch(()=>{ $('catInfo').textContent='No catalog yet. Press "Recapture from the game".'; });
}
function init(){
  $('catStages').onclick=e=>{ const b=e.target.closest('button'); if(b){ stage=+b.dataset.i; render(); } };
  $('catFilter').onchange=()=>{ filter=$('catFilter').value; render(); };
  $('catRecap').onclick=()=>{ $('catInfo').textContent='Playing through all three stages in a hidden, muted browser (about a minute)…';
    fetch('/api/capture-catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.json())
      .then(j=>{ if(!j.ok) throw new Error((j.error||j.log||'').slice(-200)); load(); }).catch(e=>{ $('catInfo').textContent='Capture failed: '+e.message; }); };
  $('catBoxes').onchange=()=>document.querySelectorAll('.hb').forEach(b=>{ if(b.tagName.toLowerCase()==='svg') b.style.display=$('catBoxes').checked?'':'none'; else b.hidden=!$('catBoxes').checked; });
  $('catMapZoom').oninput=()=>{ $('catMap').style.width=($('catMapZoom').value*100)+'%'; };
  load();
}
window.MV_ArtCatalog={init};
})();
