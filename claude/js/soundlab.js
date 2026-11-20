// ============================================================
//  soundlab.js - the player's post-game Sound Lab.
//  Unlock: finishing the story sets mv2.soundlab.unlocked.
//  Recordings live in IndexedDB on THIS browser/device only.
//  On every load they become blob: object URLs and are registered
//  as SFX replacements, so the game plays them like built-in sounds.
//  No server, no cloud, no account. Paulo can export/import a pack.
// ============================================================
(function(){
  'use strict';
  const KEY='mv2.soundlab.unlocked';
  const DB='mv2-soundlab', STORE='recordings', VER=1;

  window.MV_SOUNDLAB_UNLOCKED=function(){
    try{ return localStorage.getItem(KEY)==='1'; }catch(e){ return false; }
  };
  window.MV_SOUNDLAB_UNLOCK=function(){
    try{ localStorage.setItem(KEY,'1'); }catch(e){}
  };

  function openDB(){
    return new Promise((resolve,reject)=>{
      let req;
      try{ req=indexedDB.open(DB,VER); }catch(e){ reject(e); return; }
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }
  function tx(mode,fn){
    return openDB().then(db=>new Promise((resolve,reject)=>{
      const t=db.transaction(STORE,mode), q=t.objectStore(STORE);
      let out;
      try{ out=fn(q); }catch(e){ reject(e); return; }
      t.oncomplete=()=>resolve(out&&out.result!==undefined?out.result:out);
      t.onerror=()=>reject(t.error);
    }));
  }

  window.MV_SOUNDLAB_DB={
    save:(name,blob)=>tx('readwrite',q=>q.put({name,blob,at:new Date().toISOString()},name)),
    all:()=>tx('readonly',q=>q.getAll()),
    remove:name=>tx('readwrite',q=>q.delete(name)),
    clear:()=>tx('readwrite',q=>q.clear())
  };

  // Restore on every game load: stored blobs -> object URLs -> engine replacements.
  const urls={};
  window.MV_SOUNDLAB_RESTORE=function(){
    if(!window.MV_SOUNDLAB_UNLOCKED()) return Promise.resolve(0);
    return window.MV_SOUNDLAB_DB.all().then(rows=>{
      let n=0;
      (rows||[]).forEach(r=>{
        if(!r||!r.name||!r.blob) return;
        try{
          const url=URL.createObjectURL(r.blob);
          urls[r.name]=url;
          if(window.MV_SFX_SET_REPLACEMENT) window.MV_SFX_SET_REPLACEMENT(r.name,url);
          n++;
        }catch(e){}
      });
      return n;
    }).catch(()=>0);
  };
  window.MV_SOUNDLAB_URLS=urls;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>window.MV_SOUNDLAB_RESTORE());
  else window.MV_SOUNDLAB_RESTORE();
})();
