// ============================================================
//  Mind & Venture — beta signal
//  One row per event, about the game, never about the player.
//  The publishable key may ship: the table accepts inserts only.
//  Silent on localhost, ?debug=1, and ?selftest. Failures never
//  touch the frame.
// ============================================================
(function(){
  if(window.MV_SIGNAL) return;
  const URL='https://uxrrdwnfngdgxxtshhxp.supabase.co';
  const KEY='sb_publishable_9pdwzMyec6xLB9-xWf7qBQ_p3aSigxn';
  const MAX=80;

  function quiet(){
    try{
      const h=location.hostname;
      if(h==='localhost'||h==='127.0.0.1'||h==='::1'||h==='[::1]') return true;
      const q=location.search||'';
      if(/(?:^|[?&])debug=1(?:&|$)/.test(q)) return true;
      if(/(?:^|[?&])selftest(?:=|&|$)/.test(q)) return true;
    }catch(e){ return true; }
    return false;
  }
  const QUIET=quiet();

  function rid(){
    const a=new Uint8Array(8);
    try{ crypto.getRandomValues(a); }
    catch(e){ for(let i=0;i<a.length;i++) a[i]=Math.floor(Math.random()*256); }
    let s='';
    for(let i=0;i<a.length;i++) s+=a[i].toString(16).padStart(2,'0');
    return s;
  }
  const runId=rid();
  const q=[];
  let used=0, posts=0;
  const reached={}, deaths={}, stuckOnce={}, seenCrash={};
  let cur=null;   // {id, cleared, quit, wasShut}

  function stage(){
    try{
      if(cur&&cur.id) return String(cur.id).slice(0,16);
      const B=window.MV_BETA;
      if(B&&B.on&&B.stageId) return String(B.stageId).slice(0,16);
    }catch(e){}
    return '';
  }
  function secs(){
    try{
      const st=window.MV_BETA&&MV_BETA.stats;
      const n=st&&st.frames?Math.round(st.frames/60):0;
      return Math.max(0,Math.min(86400,n|0));
    }catch(e){ return 0; }
  }
  function clip(s,n){
    return String(s==null?'':s).replace(/[\u0000-\u001f]+/g,' ').trim().slice(0,n);
  }
  function enqueue(kind, value, detail){
    if(QUIET||used>=MAX) return false;
    const row={
      run_id:runId,
      build:clip(window.MV_BUILD||'0',16)||'0',
      kind:kind,
      stage:stage(),
      value:Math.max(0,Math.min(86400,value|0)),
      detail:clip(detail,300)
    };
    if((kind==='crash'||kind==='note')&&!row.detail) return false;
    q.push(row); used++;
    return true;
  }
  function flush(keep){
    if(QUIET||!q.length) return;
    const rows=q.splice(0,q.length);
    for(let i=0;i<rows.length;i++){
      try{
        posts++;
        fetch(URL+'/rest/v1/mv2_signal',{
          method:'POST', keepalive:!!keep,
          headers:{apikey:KEY,'Content-Type':'application/json',Prefer:'return=minimal'},
          body:JSON.stringify(rows[i])
        }).catch(function(){});
      }catch(e){}
    }
  }

  function markQuit(){
    if(!cur||cur.cleared||cur.quit) return;
    enqueue('quit', secs(), '');
    cur.quit=true;
  }
  function abandon(){
    markQuit();
    cur=null;
    flush(true);
  }
  function begin(){
    const B=window.MV_BETA;
    const id=B&&B.on&&B.stageId?String(B.stageId):'';
    if(!id) return;
    if(cur&&cur.id===id&&!cur.quit) return;
    cur={id:id, cleared:false, quit:false, wasShut:false};
    if(!reached[id]){ reached[id]=1; enqueue('reach',0,''); }
  }
  function watch(){
    const B=window.MV_BETA;
    if(!B||!B.on||!cur) return;
    if(B.cleared&&!cur.cleared){ cur.cleared=true; enqueue('clear', secs(), ''); }
    let shut=false;
    try{ shut=typeof _shutdownTimer!=='undefined'&&_shutdownTimer>0; }catch(e){}
    if(shut&&!cur.wasShut&&!cur.cleared){
      deaths[cur.id]=(deaths[cur.id]||0)+1;
      if(deaths[cur.id]>=3&&!stuckOnce[cur.id]){
        stuckOnce[cur.id]=1;
        enqueue('stuck', deaths[cur.id], '');
      }
    }
    cur.wasShut=shut;
  }

  function arm(){
    if(arm.done||typeof window.startBetaLab!=='function') return;
    arm.done=1;
    const orig=window.startBetaLab;
    window.startBetaLab=function(){
      try{ abandon(); }catch(e){}
      const ret=orig.apply(this, arguments);
      Promise.resolve(ret).then(function(){ try{ begin(); }catch(e){} }).catch(function(){});
      return ret;
    };
    const B=window.MV_BETA;
    if(B&&typeof B.quitToTitle==='function'){
      const q0=B.quitToTitle;
      B.quitToTitle=function(){
        try{ abandon(); }catch(e){}
        return q0.apply(this, arguments);
      };
    }
    if(typeof window.update==='function'){
      const up=window.update;
      window.update=function(){
        const r=up.apply(this, arguments);
        try{ watch(); }catch(e){}
        return r;
      };
    }
  }
  arm();
  if(!arm.done) window.addEventListener('load', arm);

  window.addEventListener('error', function(e){
    try{
      const msg=e&&e.message?e.message:'error';
      const stack=e&&e.error&&e.error.stack?e.error.stack:'';
      const line=(String(stack).split('\n').map(function(s){return s.trim();}).filter(Boolean)[1])||'';
      const detail=clip(msg+(line?' | '+line:''),300);
      if(!detail||seenCrash[detail]) return;
      seenCrash[detail]=1;
      enqueue('crash', 0, detail);
    }catch(err){}
  });
  window.addEventListener('unhandledrejection', function(e){
    try{
      const reason=e&&e.reason;
      const msg=reason&&reason.message?reason.message:String(reason||'rejection');
      const stack=reason&&reason.stack?reason.stack:'';
      const line=(String(stack).split('\n').map(function(s){return s.trim();}).filter(Boolean)[1])||'';
      const detail=clip(msg+(line?' | '+line:''),300);
      if(!detail||seenCrash[detail]) return;
      seenCrash[detail]=1;
      enqueue('crash', 0, detail);
    }catch(err){}
  });

  setInterval(function(){ try{ flush(false); }catch(e){} }, 20000);
  function hide(){ try{ markQuit(); flush(true); }catch(e){} }
  window.addEventListener('pagehide', hide);
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState==='hidden') hide();
  });

  // ── Leave a note (pause menu + title Options) ───────────────
  let box=null, field=null, thanks=null, buttons=null, openNote=false, typed=false;
  function ensure(){
    if(box) return;
    box=document.createElement('div');
    box.setAttribute('role','dialog');
    box.style.cssText='position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:80;width:min(440px,92vw);padding:22px 22px 18px;background:#12081c;border:2px solid #ffe39a;border-radius:16px;color:#f4ecff;font:16px/1.3 system-ui,sans-serif;box-shadow:0 16px 50px rgba(0,0,0,.55)';
    const title=document.createElement('div');
    title.textContent='Leave a note';
    title.style.cssText='font-weight:700;letter-spacing:.04em;margin-bottom:10px;color:#ffe39a';
    field=document.createElement('input');
    field.type='text'; field.maxLength=300; field.autocomplete='off'; field.spellcheck=false;
    field.setAttribute('aria-label','Leave a note');
    field.placeholder='One line for the people making the game';
    field.style.cssText='width:100%;box-sizing:border-box;font-size:16px;padding:10px 12px;border-radius:10px;border:1px solid #6a5888;background:#1c1030;color:#fff';
    buttons=document.createElement('div');
    buttons.style.cssText='display:flex;gap:10px;margin-top:12px';
    const sendBtn=document.createElement('button');
    sendBtn.type='button'; sendBtn.textContent='Send';
    const backBtn=document.createElement('button');
    backBtn.type='button'; backBtn.textContent='Back';
    [sendBtn, backBtn].forEach(function(b){
      b.style.cssText='flex:1;font-size:16px;padding:10px 0;border-radius:10px;border:0;background:#2a1848;color:#ffe39a;cursor:pointer';
    });
    thanks=document.createElement('div');
    thanks.textContent='Got it, thank you';
    thanks.style.cssText='display:none;text-align:center;padding:28px 8px;font-size:20px;color:#ffe39a';
    buttons.appendChild(sendBtn); buttons.appendChild(backBtn);
    box.appendChild(title); box.appendChild(field); box.appendChild(buttons); box.appendChild(thanks);
    box.addEventListener('click', function(e){ e.stopPropagation(); });
    box.addEventListener('touchstart', function(e){ e.stopPropagation(); }, {passive:true});
    field.addEventListener('keydown', function(e){
      typed=true; e.stopPropagation();
      if(e.key==='Enter'){ e.preventDefault(); send(); }
      else if(e.key==='Escape'){ e.preventDefault(); close(); }
    });
    sendBtn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); send(); });
    backBtn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); close(); });
    document.body.appendChild(box);
    box.hidden=true;
  }
  function open(){
    ensure();
    openNote=true; typed=false; send.done=false;
    thanks.style.display='none';
    field.style.display=''; buttons.style.display='flex';
    field.value=''; box.hidden=false;
    try{ field.focus(); }catch(e){}
  }
  function close(){
    openNote=false;
    if(box) box.hidden=true;
  }
  function send(){
    if(!field||send.done) return;
    const text=clip(field.value,300);
    if(!text) return;
    send.done=true;
    field.value='';
    enqueue('note', 0, text);
    flush(true);
    field.style.display='none';
    buttons.style.display='none';
    thanks.style.display='block';
    setTimeout(close, 1200);
  }
  function pad(ev){
    if(!openNote) return;
    const back=ev?!!ev.back:(typeof Kj!=='undefined'&&(Kj['Escape']||(Kj['KeyE']&&!(typeof K!=='undefined'&&K['KeyE_kb']))));
    const ok=ev?!!ev.confirm:(typeof Kj!=='undefined'&&(Kj['Space']||Kj['Enter']||Kj['NumpadEnter']));
    if(back){ close(); return; }
    if(ok&&!typed) send();
    typed=false;
  }

  window.MV_SIGNAL={
    open:open, close:close, pad:pad,
    blocking:function(){ return openNote; },
    quiet:function(){ return QUIET; },
    posts:function(){ return posts; },
    queued:function(){ return q.length; }
  };
})();
