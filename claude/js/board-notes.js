// board-notes.js - shared comment boxes for all MV2 control-board entries.
// A note is a mission: {text, files:[{name,path}], status:pending|wip|done, updated}.
// Stored in claude/board-notes.json by the local server (localStorage fallback).
// Files are attached per note and saved under claude/assets/note-files/.
(function(){
  'use strict';
  const KEY='mv2.board.notes';
  const data={};
  const boxes=[];
  let timers={};

  function local(){ try{ return JSON.parse(localStorage.getItem(KEY)||'{}'); }catch(e){ return {}; } }
  function saveLocal(){ try{ localStorage.setItem(KEY,JSON.stringify(data)); }catch(e){} }
  function init(){
    if(location.protocol==='http:'&&fetch){
      return fetch('/api/comments',{cache:'no-store'}).then(r=>r.json()).then(j=>{
        Object.assign(data, local(), (j&&j.ok&&j.comments)?j.comments:{});
        boxes.forEach(b=>b.refresh());
        return data;
      }).catch(()=>{ Object.assign(data,local()); boxes.forEach(b=>b.refresh()); return data; });
    }
    Object.assign(data,local()); return Promise.resolve(data);
  }
  function entry(k){
    let v=data[k];
    if(typeof v==='string') v={text:v,files:[],status:'pending'};
    return v||{text:'',files:[],status:''};
  }
  function get(k){ return entry(k).text||''; }
  function post(k){
    if(location.protocol!=='http:'||!fetch)return;
    clearTimeout(timers[k]);
    timers[k]=setTimeout(()=>{
      fetch('/api/comments',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({key:k,text:get(k)})}).catch(()=>{});
    },400);
  }
  function set(k,v){
    const e=entry(k); e.text=String(v||'');
    if(e.text.trim()&&!e.status)e.status='pending';
    if(!e.text.trim()&&!(e.files&&e.files.length)){ delete data[k]; }
    else { e.updated=new Date().toISOString().slice(0,19).replace('T',' '); data[k]=e; }
    saveLocal(); post(k);
  }
  function attach(k,file,cb){
    const rd=new FileReader();
    rd.onload=()=>{
      const body={key:k,filename:file.name,type:file.type,data:String(rd.result).split(',')[1]||''};
      fetch('/api/note-file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
        .then(r=>r.json()).then(j=>{
          if(!j.ok)throw new Error(j.error||'upload failed');
          const e=entry(k); e.files=e.files||[];
          e.files.push({name:file.name,path:j.path});
          e.status='pending'; data[k]=e; saveLocal();
          post(k); cb&&cb(null,e);
        }).catch(err=>cb&&cb(err));
    };
    rd.readAsDataURL(file);
  }

  const css=document.createElement('style');
  css.textContent=
    '.bn-wrap{margin-top:7px;border-top:1px dotted var(--mica);padding-top:6px}'+
    '.bn-wrap label.bn-lab{display:block;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--mica);margin-bottom:3px}'+
    '.bn-state{font-size:9px;margin-left:5px;color:var(--mica)}'+
    '.bn-state.pending{color:var(--verm);font-weight:bold}.bn-state.wip{color:var(--gold);font-weight:bold}.bn-state.done{color:var(--celadon)}'+
    '.bn-box{width:100%;min-height:42px;resize:vertical;font-family:inherit;font-size:10.5px;line-height:1.35;'+
      'border:1px solid var(--mica);background:#fffdf6;padding:5px 6px;color:var(--sumi);border-radius:2px}'+
    '.bn-box:focus{outline:none;border-color:var(--indigo);background:#fff}'+
    '.bn-box:not(:placeholder-shown){background:#fff8e8}'+
    '.bn-files{margin-top:4px;display:flex;flex-wrap:wrap;gap:4px}'+
    '.bn-files a{font-size:10px;color:var(--indigo);text-decoration:none;border:1px solid var(--mica);padding:2px 5px;background:#fff}'+
    '.bn-filelabel{display:inline-block;font-size:9px;color:var(--indigo);border:1px dashed var(--indigo);padding:2px 6px;cursor:pointer}'+
    '.bn-foot{display:flex;gap:6px;align-items:center;margin-top:4px}';
  document.head.appendChild(css);

  function box(key){
    const wrap=document.createElement('div');wrap.className='bn-wrap';
    const lab=document.createElement('label');lab.className='bn-lab';
    const ta=document.createElement('textarea');
    ta.className='bn-box';ta.placeholder='Note the change you want…';ta.rows=2;ta.value=get(key);
    const state=document.createElement('span');state.className='bn-state';lab.append(document.createTextNode('NOTE '),state);
    ta.addEventListener('input',()=>{
      set(key,ta.value);
      state.className='bn-state pending';state.textContent='mission queued';
      clearTimeout(ta._t);ta._t=setTimeout(()=>{const e=entry(key);state.textContent=e.status==='done'?'done ✓':e.status==='wip'?'working…':'mission queued';},500);
    });
    const foot=document.createElement('div');foot.className='bn-foot';
    const fl=document.createElement('label');fl.className='bn-filelabel';fl.textContent='+ attach file';
    const fi=document.createElement('input');fi.type='file';fi.multiple=true;fi.style.display='none';fl.append(fi);
    const hint=document.createElement('span');hint.style.cssText='font-size:9px;color:var(--mica)';
    fi.onchange=()=>{
      const files=[...(fi.files||[])];if(!files.length)return;
      hint.textContent='uploading…';let left=files.length;
      files.forEach(f=>attach(key,f,(err)=>{
        if(err)hint.textContent='ERROR: '+err.message;
        else if(!--left){hint.textContent='attached ✓';renderFiles(key,filesWrap);post(key);}
      }));
    };
    foot.append(fl,hint);
    const filesWrap=document.createElement('div');filesWrap.className='bn-files';
    wrap.append(lab,ta,foot,filesWrap);
    function refreshState(){const s=entry(key).status;state.className='bn-state '+(s||'');
      state.textContent=s==='done'?'done ✓':s==='wip'?'working…':s==='pending'?'mission queued':'';}
    function refresh(){ta.value=get(key);renderFiles(key,filesWrap);refreshState();}
    boxes.push({key,refresh});
    refresh();
    return wrap;
  }
  function renderFiles(key,wrap){
    wrap.innerHTML='';
    (entry(key).files||[]).forEach(f=>{
      const a=document.createElement('a');a.href=f.path;a.target='_blank';a.textContent='📎 '+f.name;wrap.append(a);
    });
  }

  window.BoardNotes={data,init,get,entry,set,attach,box,refresh:renderFiles};
  init();
})();
