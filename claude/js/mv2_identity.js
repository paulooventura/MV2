/* ============================================================
   mv2_identity.js — online co-op identity (Build 443 / T639).

   Warm Shadow: names are local/session nicknames only — never force a
   real name. Crayon colours come from Monika's house palette (not cyber mint).

   Seats 1–2: Mind & Venture (first two heroes).
   Seats 3–5: a basic colour + session name + hat. The colour replaces
   the hero's own purple or red on the sprite itself, and on the hat.
   ============================================================ */
(function(){
  'use strict';

  var MAX_PEERS=5;

  // Paulo: the basic colours. Mind starts purple, Venture starts red.
  // A pick paints the sprite's own coloured parts. It is not a square on top.
  var CRAYONS=[
    {id:'purple', name:'PURPLE', hex:'#7A3CD0', dark:'#2E0E5A', mid:'#7A3CD0', light:'#C08CFF', glow:'170,110,255'},
    {id:'red',    name:'RED',    hex:'#D42030', dark:'#5A0812', mid:'#C81C2C', light:'#FF6A72', glow:'255,70,90'},
    {id:'yellow', name:'YELLOW', hex:'#E6C020', dark:'#6A4E08', mid:'#E6C020', light:'#FFE98A', glow:'255,220,80'},
    {id:'blue',   name:'BLUE',   hex:'#2F6FE0', dark:'#0C2460', mid:'#2F6FE0', light:'#8CB4FF', glow:'80,140,255'},
    {id:'green',  name:'GREEN',  hex:'#2EAE4A', dark:'#0C4018', mid:'#2EAE4A', light:'#8AE8A0', glow:'60,220,100'},
    {id:'orange', name:'ORANGE', hex:'#F07818', dark:'#6A2808', mid:'#F07818', light:'#FFB060', glow:'255,140,40'},
    {id:'black',  name:'BLACK',  hex:'#16161C', dark:'#050507', mid:'#2A2A32', light:'#8A8E98', glow:'160,164,176'},
    {id:'white',  name:'WHITE',  hex:'#F2F2F2', dark:'#8A8A92', mid:'#E4E4EA', light:'#FFFFFF', glow:'230,230,240'}
  ];

  // Existing hero hat art (render.js): gaucho = Mind wide brim (drawLogoHat),
  // cap = Venture black backwards baseball cap.
  var HATS=[
    {id:'gaucho', name:'GAUCHO',  sub:'WIDE BRIM'},
    {id:'cap',    name:'BASEBALL CAP', sub:'BACKWARDS'}
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
    var o={name:'', color:'', hat:'', hatMatch:false};
    try{
      var n=localStorage.getItem('mv2.netNick'); if(n) o.name=cleanName(n);
      var c=localStorage.getItem('mv2.netColor'); if(c&&crayonById(c).id===c) o.color=c;
      var h=localStorage.getItem('mv2.netHat'); if(h&&hatById(h).id===h) o.hat=h;
      var m=localStorage.getItem('mv2.netHatMatch'); if(m==='1'||m==='0') o.hatMatch=(m==='1');
    }catch(e){}
    return o;
  }
  function saveLocal(o){
    try{
      if(o&&o.name!=null) localStorage.setItem('mv2.netNick', cleanName(o.name));
      if(o&&o.color) localStorage.setItem('mv2.netColor', crayonById(o.color).id);
      if(o&&o.hat) localStorage.setItem('mv2.netHat', hatById(o.hat).id);
      localStorage.setItem('mv2.netHatMatch', o&&o.hatMatch?'1':'0');
    }catch(e){}
  }

  function applyToActor(actor, id){
    if(!actor||!id) return actor;
    actor._netName=cleanName(id.name)||'';
    actor._netColorId=crayonById(id.color).id;
    actor._netColor=crayonById(id.color).hex;
    actor._netHat=hatById(id.hat).id;
    actor.hatStyle=actor._netHat;
    actor._netHatMatch=!!id.hatMatch;
    if(id.hero==='mind'||id.hero==='venture') actor.hero=id.hero;
    return actor;
  }

  function packId(id){
    id=id||{};
    return {
      nm:cleanName(id.name)||'',
      col:crayonById(id.color).id,
      hat:hatById(id.hat||(id.hero==='venture'?'cap':'gaucho')).id,
      hm:id.hatMatch?1:0,
      hero:(id.hero==='venture')?'venture':'mind'
    };
  }
  function unpackId(pk){
    if(!pk||typeof pk!=='object') return {name:'', color:'blue', hat:'gaucho', hero:'mind'};
    return {
      name:cleanName(pk.nm||pk.name||''),
      color:crayonById(pk.col||pk.color).id,
      hat:hatById(pk.hat).id,
      hatMatch:!!(pk.hm||pk.hatMatch),
      hero:(pk.hero==='venture'||pk.h==='venture')?'venture':'mind'
    };
  }

  function ownColor(pl){ return pl&&pl.hero==='venture'?'red':'purple'; }
  // Mind in purple and Venture in red keep the drawn art. Any other pick
  // is handed to the sprite (wheel, bulb, glove, rim, hat). No rectangle.
  function spriteTakesColor(pl){
    return !!(pl&&pl._netColorId&&pl._netColorId!==ownColor(pl));
  }
  function tone(pl){
    if(!pl||!pl._netColorId) return null;
    var c=crayonById(pl._netColorId);
    if(!c||!c.dark) return null;
    return {id:c.id, hex:c.hex, dark:c.dark, mid:c.mid, light:c.light, glow:c.glow};
  }
  function parseHex(h){
    h=String(h||'').replace('#','');
    if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return [parseInt(h.slice(0,2),16)||0, parseInt(h.slice(2,4),16)||0, parseInt(h.slice(4,6),16)||0];
  }
  var _rc=null, _rcCtx=null;
  function recolorDraw(pl, drawFn){
    if(!spriteTakesColor(pl)||typeof ctx==='undefined'||typeof sx!=='function'){ drawFn(); return; }
    var w=typeof SW!=='undefined'?SW:64, feet=typeof FEET_OFF!=='undefined'?FEET_OFF:88;
    var lx=sx(pl.x)-48, ty=sy(pl.y-36)-12, rx=sx(pl.x+w)+48, by=sy(pl.y+feet)+14;
    var main=ctx;
    var m=main.getTransform?main.getTransform():{a:1,b:0,c:0,d:1,e:0,f:0};
    function dx(x,y){ return m.a*x+m.c*y+m.e; }
    function dy(x,y){ return m.b*x+m.d*y+m.f; }
    var xs=[dx(lx,ty),dx(rx,ty),dx(lx,by),dx(rx,by)];
    var ys=[dy(lx,ty),dy(rx,ty),dy(lx,by),dy(rx,by)];
    var x0=Math.max(0, Math.floor(Math.min(xs[0],xs[1],xs[2],xs[3])));
    var y0=Math.max(0, Math.floor(Math.min(ys[0],ys[1],ys[2],ys[3])));
    var x1=Math.min(main.canvas.width, Math.ceil(Math.max(xs[0],xs[1],xs[2],xs[3])));
    var y1=Math.min(main.canvas.height, Math.ceil(Math.max(ys[0],ys[1],ys[2],ys[3])));
    var ww=x1-x0, hh=y1-y0;
    if(ww<8||hh<8||ww>520||hh>520){ drawFn(); return; }
    // Paint the sprite on a small canvas. Reading the main picture back
    // every frame stalls the phone GPU and the frame rate falls over.
    if(!_rc){ _rc=document.createElement('canvas'); _rcCtx=_rc.getContext('2d',{willReadFrequently:true}); }
    if(!_rcCtx){ drawFn(); return; }
    _rc.width=ww; _rc.height=hh;
    _rcCtx.setTransform(m.a,m.b,m.c,m.d,m.e-x0,m.f-y0);
    _rcCtx.imageSmoothingEnabled=true;
    ctx=_rcCtx;
    try{ drawFn(); }
    finally{ ctx=main; }
    var after;
    try{ after=_rcCtx.getImageData(0,0,ww,hh); }catch(e){ main.save(); main.setTransform(1,0,0,1,0,0); main.drawImage(_rc,x0,y0); main.restore(); return; }
    var a=after.data, t=parseHex(pl._netColor);
    var id=pl._netColorId;
    var tl=Math.max(28, 0.299*t[0]+0.587*t[1]+0.114*t[2]);
    for(var i=0;i<a.length;i+=4){
      if(a[i+3]<12) continue;
      var r=a[i], g=a[i+1], bl=a[i+2];
      var max=r>g?(r>bl?r:bl):(g>bl?g:bl), min=r<g?(r<bl?r:bl):(g<bl?g:bl);
      var sat=max<1?0:(max-min)/max;
      var lum=(0.299*r+0.587*g+0.114*bl)/255;
      if(sat<0.16&&lum<0.42) continue;
      var nr,ng,nb;
      if(id==='black'){
        var k0=0.08+lum*0.22;
        nr=r*k0; ng=g*k0; nb=bl*k0;
      }else if(id==='white'){
        nr=210+r*0.18; ng=210+g*0.18; nb=210+bl*0.18;
      }else{
        var strength=sat>0.2?0.94:(lum>0.5?0.8:0.35);
        var k=Math.max(0.15, Math.min(1.8, (lum*255)/tl));
        nr=r*(1-strength)+t[0]*k*strength;
        ng=g*(1-strength)+t[1]*k*strength;
        nb=bl*(1-strength)+t[2]*k*strength;
      }
      a[i]=nr<0?0:nr>255?255:nr|0;
      a[i+1]=ng<0?0:ng>255?255:ng|0;
      a[i+2]=nb<0?0:nb>255?255:nb|0;
    }
    try{ _rcCtx.putImageData(after,0,0); }catch(e){}
    main.save();
    main.setTransform(1,0,0,1,0,0);
    main.imageSmoothingEnabled=false;
    main.drawImage(_rc,x0,y0);
    main.restore();
  }

  // Nameplate above a hero (session nick only).
  function drawNameplate(pl){
    if(!pl||!pl._netName||typeof ctx==='undefined'||typeof sx!=='function') return;
    var w=typeof SW!=='undefined'?SW:64;
    var x=sx(pl.x+w*0.5), y=sy(pl.y)-36;
    var col=pl._netColor||'#C9A24A';
    ctx.save();
    ctx.font='14px "MV Pixel",ui-monospace,Consolas,monospace';
    ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillStyle='rgba(28,26,25,0.72)';
    if(pl._npFor!==pl._netName){ pl._npW=ctx.measureText(pl._netName).width; pl._npFor=pl._netName; }   // measure once per name, not per frame
    var tw=pl._npW;
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
    var c=parse(hex), black=[12,10,14], paper=[244,244,244];
    return {
      col:mix(black,c,0.82),
      inner:mix(black,c,0.55),
      hi:mix(c,paper,0.45)
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
    spriteTakesColor:spriteTakesColor, tone:tone, recolorDraw:recolorDraw, drawNameplate:drawNameplate, hatColors:hatColors
  };
})();
