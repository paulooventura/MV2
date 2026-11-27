// art-catalog.js — Catalog tab of the Art Board (Paulo 2026-11-27: "we also need the characters, objects, foes,
// everything accounted for. That way we can specify what needs to be changed" + "the worlds collision map perspective").
// Reads claude/assets/catalog/catalog.json, written by scripts/capture-catalog.mjs from the running game.
(function(){
'use strict';
const $=id=>document.getElementById(id);
let CAT=null, stage=0, filter='all';
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
      card.innerHTML='<div class="catImg"></div><div class="nm">'+nice(it.name)+'</div><div class="meta">'+meta+'<br><code>'+it.name+'</code></div>';
      card.querySelector('.catImg').appendChild(im);
      im.onload=()=>{ if(blank(im)){ const w=document.createElement('div'); w.className='tag unused'; w.textContent='not on screen at capture'; card.querySelector('.meta').prepend(w); } };
      const key='cat:'+S.id.replace('.','-')+':'+it.kind+':'+String(it.name).replace(/[^A-Za-z0-9_ .\-]/g,'_').slice(0,60);
      if(window.BoardNotes&&BoardNotes.box) card.appendChild(BoardNotes.box(key));
      wrap.appendChild(card);
    });
  });
}
function load(){
  return fetch('assets/catalog/catalog.json?t='+Date.now()).then(r=>r.json()).then(j=>{ CAT=j; render(); })
    .catch(()=>{ $('catInfo').textContent='No catalog yet. Press "Recapture from the game".'; });
}
function init(){
  $('catStages').onclick=e=>{ const b=e.target.closest('button'); if(b){ stage=+b.dataset.i; render(); } };
  $('catFilter').onchange=()=>{ filter=$('catFilter').value; render(); };
  $('catRecap').onclick=()=>{ $('catInfo').textContent='Playing through all three stages in a hidden, muted browser (about a minute)…';
    fetch('/api/capture-catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.json())
      .then(j=>{ if(!j.ok) throw new Error((j.error||j.log||'').slice(-200)); load(); }).catch(e=>{ $('catInfo').textContent='Capture failed: '+e.message; }); };
  $('catMapZoom').oninput=()=>{ $('catMap').style.width=($('catMapZoom').value*100)+'%'; };
  load();
}
window.MV_ArtCatalog={init};
})();
