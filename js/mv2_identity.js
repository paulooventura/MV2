/* ============================================================
   mv2_identity.js — online co-op identity (Build 443 / T639).

   Warm Shadow: names are local/session nicknames only — never force a
   real name. Crayon colours come from Monika's house palette (not cyber mint).

   Seats 1–2: Mind & Venture (first two heroes).
   Seats 3–5: crayon colour + session name + hat pick; colour tints the
   hero, held jacks/HUD accents, and resonates into the chosen hat.
   ============================================================ */
(function(){
  'use strict';

  var MAX_PEERS=5;

  // Monika house crayons (staging/art-direction/palette.json mid+accent) —
  // woodblock-friendly, no signal neon / cyber mint.
  var CRAYONS=[
    {id:'prussian', name:'PRUSSIAN', hex:'#23466B'},
    {id:'beni',     name:'BENI',     hex:'#E8A8A0'},
    {id:'kihada',   name:'KIHADA',   hex:'#D8B04A'},
    {id:'plum',     name:'PLUM',     hex:'#7A4E6B'},
    {id:'celadon',  name:'CELADON',  hex:'#A8BFA0'},
    {id:'vermilion',name:'VERMILION',hex:'#D9472B'},
    {id:'gold',     name:'GOLD',     hex:'#C9A24A'},
    {id:'murasaki', name:'MURASAKI', hex:'#5B2A8C'},
    {id:'indigo',   name:'INDIGO',   hex:'#8FA8C0'},
    {id:'blood',    name:'BLOOD',    hex:'#9E1B1B'}
  ];

  // Existing hero hat art (render.js): gaucho = Mind wide brim (drawLogoHat),
  // cap = Venture black backwards baseball cap.
  var HATS=[
    {id:'gaucho', name:'GAUCHO',  sub:'WIDE BRIM'},
    {id:'cap',    name:'BACK CAP',sub:'BLACK BILL'}
  ];

  function crayonById(id){
    for(var i=0;i<CRAYONS.length;i++) if(CRAYONS[i].id===id) return CRAYONS[i];
    return CRAYONS[0];
  }
  function hatById(id){
    for(var i=0;i<HATS.length;i++) if(HATS[i].id===id) return HATS[i];
    return HATS[0];
  }
  function seatKind(seat){
    seat=seat|0;
    if(seat<=0) return 'mind';
    if(seat===1) return 'venture';
    return 'guest';
  }
  function defaultHeroForSeat(seat){
    var k=seatKind(seat);
    return k==='guest'?'mind':k;
  }
  function needsCrayon(seat){ return (seat|0)>=2; }

  function cleanName(s){
    s=String(s==null?'':s).replace(/[^\w\s\-'.]/g,'').replace(/\s+/g,' ').trim();
    if(s.length>12) s=s.slice(0,12);
    return s;
  }
  function defaultName(seat){
    seat=seat|0;
    if(seat<=0) return 'MIND';
    if(seat===1) return 'VENTURE';
    return 'RIDER '+(seat+1);
  }

  function loadLocal(){
    var o={name:'', color:'prussian', hat:'gaucho'};
    try{
      var n=localStorage.getItem('mv2.netNick'); if(n) o.name=cleanName(n);
      var c=localStorage.getItem('mv2.netColor'); if(c&&crayonById(c).id===c) o.color=c;
      var h=localStorage.getItem('mv2.netHat'); if(h&&hatById(h).id===h) o.hat=h;
    }catch(e){}
    return o;
  }
  function saveLocal(o){
    try{
      if(o&&o.name!=null) localStorage.setItem('mv2.netNick', cleanName(o.name));
      if(o&&o.color) localStorage.setItem('mv2.netColor', crayonById(o.color).id);
      if(o&&o.hat) localStorage.setItem('mv2.netHat', hatById(o.hat).id);
    }catch(e){}
  }

  function applyToActor(actor, id){
    if(!actor||!id) return actor;
    actor._netName=cleanName(id.name)||'';
    actor._netColorId=crayonById(id.color).id;
    actor._netColor=crayonById(id.color).hex;
    actor._netHat=hatById(id.hat).id;
    actor.hatStyle=actor._netHat;
    if(id.hero==='mind'||id.hero==='venture') actor.hero=id.hero;
    return actor;
  }

  function packId(id){
    id=id||{};
    return {
      nm:cleanName(id.name)||'',
      col:crayonById(id.color).id,
      hat:hatById(id.hat).id,
      hero:(id.hero==='venture')?'venture':'mind'
    };
  }
  function unpackId(pk){
    if(!pk||typeof pk!=='object') return {name:'', color:'prussian', hat:'gaucho', hero:'mind'};
    return {
      name:cleanName(pk.nm||pk.name||''),
      color:crayonById(pk.col||pk.color).id,
      hat:hatById(pk.hat).id,
      hero:(pk.hero==='venture'||pk.h==='venture')?'venture':'mind'
    };
  }

  // Soft multiply wash in crayon over an approx screen AABB (hero + held gear).
  function tintActorAabb(pl, pad){
    if(!pl||!pl._netColor||typeof ctx==='undefined'||typeof sx!=='function') return;
    pad=pad==null?10:pad;
    var w=typeof SW!=='undefined'?SW:64, feet=typeof FEET_OFF!=='undefined'?FEET_OFF:88;
    var x0=sx(pl.x)-pad, y0=sy(pl.y-12)-pad;
    var ww=sw(w)+pad*2, hh=sw(feet+8)+pad*2;
    ctx.save();
    ctx.globalCompositeOperation='source-atop';
    ctx.globalAlpha=0.28;
    ctx.fillStyle=pl._netColor;
    ctx.fillRect(x0,y0,ww,hh);
    ctx.restore();
  }

  // Nameplate above a hero (session nick only).
  function drawNameplate(pl){
    if(!pl||!pl._netName||typeof ctx==='undefined'||typeof sx!=='function') return;
    var w=typeof SW!=='undefined'?SW:64;
    var x=sx(pl.x+w*0.5), y=sy(pl.y)-8;
    var col=pl._netColor||'#C9A24A';
    ctx.save();
    ctx.font='14px "MV Pixel",ui-monospace,Consolas,monospace';
    ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillStyle='rgba(28,26,25,0.72)';
    var tw=ctx.measureText(pl._netName).width;
    ctx.fillRect(x-tw/2-5,y-16,tw+10,16);
    ctx.fillStyle=col;
    ctx.fillText(pl._netName,x,y-2);
    ctx.restore();
  }

  // Hat colours that lean toward the crayon (gaucho uses drawLogoHat opt.col).
  function hatColors(hex){
    hex=hex||'#1C1A19';
    function parse(h){
      h=String(h||'').replace('#','');
      if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      return [parseInt(h.slice(0,2),16)||0, parseInt(h.slice(2,4),16)||0, parseInt(h.slice(4,6),16)||0];
    }
    function mix(a,b,t){
      return '#'+[0,1,2].map(function(i){
        var v=Math.round(a[i]*(1-t)+b[i]*t);
        return ('0'+Math.max(0,Math.min(255,v)).toString(16)).slice(-2);
      }).join('');
    }
    var c=parse(hex), black=[12,10,14], paper=[239,230,210];
    return {
      col:mix(black,c,0.55),
      inner:mix(black,c,0.25),
      hi:mix(c,paper,0.35)
    };
  }

  window.MV_IDENTITY={
    MAX_PEERS:MAX_PEERS,
    CRAYONS:CRAYONS, HATS:HATS,
    crayonById:crayonById, hatById:hatById,
    seatKind:seatKind, defaultHeroForSeat:defaultHeroForSeat, needsCrayon:needsCrayon,
    cleanName:cleanName, defaultName:defaultName,
    loadLocal:loadLocal, saveLocal:saveLocal,
    applyToActor:applyToActor, packId:packId, unpackId:unpackId,
    tintActorAabb:tintActorAabb, drawNameplate:drawNameplate, hatColors:hatColors
  };
})();
