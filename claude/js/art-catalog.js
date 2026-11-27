// art-catalog.js — Catalog tab of the Art Board (Paulo 2026-11-27: "we also need the characters, objects, foes,
// everything accounted for. That way we can specify what needs to be changed" + "the worlds collision map perspective").
// Reads claude/assets/catalog/catalog.json, written by scripts/capture-catalog.mjs from the running game.
(function(){
'use strict';
const $=id=>document.getElementById(id);
let CAT=null, stage=0, filter='all', HB={};
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
        '<div class="hbRow">Collision box '+(editable?'<input type="number" class="hbW" min="8" max="400"> × <input type="number" class="hbH" min="8" max="400"> px <button class="btn hbSave">Save</button>'+(ov?' <button class="btn hbReset">Original</button>':''):'<b>'+it.w+'×'+it.h+'</b> px <span class="sub">(view only'+(it.kind==='hero'?': the heroes share one body box, changing it changes how they move':': blocks sit on the tile grid')+')</span>')+'</div><div class="msg hbMsg"></div>';
      const hw=card.querySelector('.hbWrap'); hw.appendChild(im);
      const box=document.createElement('div'); box.className='hb'+(editable?' edit':''); hw.appendChild(box);
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
      im.onload=()=>{ place(); if(blank(im)){ const w=document.createElement('div'); w.className='tag unused'; w.textContent='not on screen at capture'; card.querySelector('.meta').prepend(w); } };
      new ResizeObserver(place).observe(im);
      const key='cat:'+S.id.replace('.','-')+':'+it.kind+':'+String(it.name).replace(/[^A-Za-z0-9_ .\-]/g,'_').slice(0,60);
      if(window.BoardNotes&&BoardNotes.box) card.appendChild(BoardNotes.box(key));
      wrap.appendChild(card);
    });
  });
}
function load(){
  return fetch('/api/art-index',{cache:'no-store'}).then(r=>r.json()).then(j=>{ HB=j.hitboxes||{}; }).catch(()=>{})
    .then(()=>fetch('assets/catalog/catalog.json?t='+Date.now())).then(r=>r.json()).then(j=>{ CAT=j; render(); })
    .catch(()=>{ $('catInfo').textContent='No catalog yet. Press "Recapture from the game".'; });
}
function init(){
  $('catStages').onclick=e=>{ const b=e.target.closest('button'); if(b){ stage=+b.dataset.i; render(); } };
  $('catFilter').onchange=()=>{ filter=$('catFilter').value; render(); };
  $('catRecap').onclick=()=>{ $('catInfo').textContent='Playing through all three stages in a hidden, muted browser (about a minute)…';
    fetch('/api/capture-catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.json())
      .then(j=>{ if(!j.ok) throw new Error((j.error||j.log||'').slice(-200)); load(); }).catch(e=>{ $('catInfo').textContent='Capture failed: '+e.message; }); };
  $('catBoxes').onchange=()=>document.querySelectorAll('.hb').forEach(b=>b.hidden=!$('catBoxes').checked);
  $('catMapZoom').oninput=()=>{ $('catMap').style.width=($('catMapZoom').value*100)+'%'; };
  load();
}
window.MV_ArtCatalog={init};
})();
