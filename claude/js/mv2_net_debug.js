/* ============================================================
   mv2_net_debug.js — small read-only online diagnostic overlay.

   Shows what the room actually sees: seat/link state, packet counters,
   world/hit events, and the local touch/key input bits. Used to find out
   where online co-op stops working on a phone. No behaviour is changed.

   Load after mv2_net.js / player.js. No keys needed — visible while linked.
   ============================================================ */
(function(){
  'use strict';
  var NET=window.MV_NET;
  if(!NET) return;
  var el=null;

  function css(){
    if(document.getElementById('mvNetDiagCss')) return;
    var s=document.createElement('style'); s.id='mvNetDiagCss';
    s.textContent='#mvNetDiag{position:fixed;left:4px;top:4px;z-index:99999;'+
      'background:rgba(2,4,10,.86);color:#9fe8ff;border:1px solid #2b6b8f;border-radius:4px;'+
      'padding:5px 7px;font:10px/1.35 ui-monospace,Consolas,monospace;white-space:pre;'+
      'pointer-events:none;text-shadow:0 1px 2px #000;max-width:62vw;overflow:hidden}';
    document.head.appendChild(s);
  }
  function actor(which){
    try{ return which==='p2'?(typeof p2!=='undefined'?p2:null):(typeof p!=='undefined'?p:null); }
    catch(e){ return null; }
  }
  function playerCount(){ try{ return typeof _playerCount!=='undefined'?_playerCount:null; }catch(e){ return null; } }
  function gameState(){ try{ return typeof _gameState!=='undefined'?_gameState:''; }catch(e){ return ''; } }
  function ago(t){ return t?(Math.round((Date.now()-t)/100)/10)+'s':'-'; }
  function bit(name){ try{ return (K[name]?1:0)+(Kj[name]?2:0); }catch(e){ return '?'; } }

  function render(){
    if(!el){
      css();
      el=document.createElement('div'); el.id='mvNetDiag';
      document.body.appendChild(el);
    }
    var s=NET.status(), d=NET.diag?NET.diag():{};
    var held='';
    try{ held=(window.MV_TOUCH&&MV_TOUCH.held)?MV_TOUCH.held.join(','):''; }catch(e){}
    var nh=held||'-';
    var p=actor('p'), p2=actor('p2'), cnt=playerCount(), gs=gameState();
    var lines=[
      'NET '+(s.role||'-')+' seat '+(function(){ try{ return NET.seat(); }catch(e){ return '?'; } })()+
        ' '+(s.status||'-')+' peers '+(s.peers||0)+'/'+s.maxPeers+' '+(s.code||''),
      'phase '+(s.phase||'-')+' game '+(gs||'-')+' players '+(cnt==null?'?':cnt),
      'pkt in '+d.pktIn+' out '+d.pktOut+' last '+d.lastType+' '+ago(d.lastTypeAt),
      'pose in '+d.poseIn+' out '+d.poseOut+'  world in '+d.worldIn+' out '+d.worldOut+
        '  hit in '+d.hitIn+' out '+d.hitOut,
      'input K/Kj  jump '+bit('Space')+' select '+bit('KeyE')+' use '+bit('KeyQ')+' punch '+bit('KeyF'),
      'touch held '+nh,
      'hero '+(p&&p.hero||'-')+' x '+Math.round(p&&p.x||0)+' y '+Math.round(p&&p.y||0)+
        ' hp '+Math.round(p&&p.hp||0)+' pt '+(p&&p.pt||0)+' punch '+(p&&p.pCharging?'Y':'n'),
      'puppet '+(p2&&p2._netSeat!=null?p2._netSeat:'-')+' extras '+
        (function(){ try{ return NET.extras().length; }catch(e){ return '?'; } })()
    ];
    var txt=lines.join('\n');
    if(el.textContent!==txt) el.textContent=txt;
  }
  setInterval(render,250);
  render();
})();
