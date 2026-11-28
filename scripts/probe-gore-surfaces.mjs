// Muted headless probe (Paulo, Nov 27): blood on 1.1's ramps follows the diagonal; blood on a door moves with the door.
// node scripts/probe-gore-surfaces.mjs [outPrefix]   (exit 0 = PASS; writes <outPrefix>-ramp.png, -ramp-collision.png, -door-shut.png, -door-open.png)
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root=process.cwd(), port=8825, out=process.argv[2]||'gore';
const types={'.html':'text/html','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.css':'text/css'};
const srv=http.createServer((q,r)=>{ let p=decodeURIComponent(q.url.split('?')[0]); if(p.endsWith('/')) p+='index.html'; const f=path.join(root,p); fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);r.end();return;} r.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'}); r.end(d); }); }).listen(port);
const b=await chromium.launch({args:['--mute-audio']});
const pg=await b.newPage({viewport:{width:1024,height:768}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.addInitScript(()=>{ try{ localStorage.setItem('mv2.gore','1'); localStorage.setItem('mv2.spill','blood'); localStorage.setItem('mv2.console','gore'); localStorage.setItem('mv_story_intro_seen','1'); }catch(e){} });
await pg.goto(`http://127.0.0.1:${port}/index.html?tv=0&_=${Date.now()}`,{waitUntil:'domcontentloaded'});
await pg.waitForFunction(()=>typeof startBetaLab==='function'&&window.MV_BLOOD,null,{timeout:30000});
await pg.evaluate(async()=>{ try{ MV_SIBLING.on=false; }catch(e){} await startBetaLab('1.1',0,{fresh:true}); });
await pg.waitForFunction(()=>MV_BETA.on&&MV_BETA.stageId==='1.1'&&!MV_BETA.loading&&_gameState==='game'&&MV_GRID.ready&&p&&window.MV_DOORS&&MV_DOORS.doors&&MV_DOORS.doors.length,null,{timeout:30000});
await pg.evaluate(()=>{ ENEMS.length=0; window.applyPlayerHit=function(){}; });
await pg.waitForTimeout(1500);
const wait=ms=>pg.waitForTimeout(ms);
// pick the ramp nearest the start: an exposed slope cell run (open air above)
const ramp=await pg.evaluate(()=>{
  const T=MV_GRID.tile, out=[]; const px=p.x+SW/2, py=p.y+FEET_OFF;
  for(let r=1;r<MV_GRID.rows;r++) for(let c=0;c<MV_GRID.cols;c++){ if(!gridIsSlope(c,r)) continue; if(gridSolid(c,r-1)||gridIsSlope(c,r-1)) continue;
    out.push({c,r,k:gridSlopeKind(c,r),d:Math.hypot(c*T-px,r*T-py)}); }
  out.sort((a,b)=>a.d-b.d); return {cells:out.slice(0,40), T, start:{x:px,y:py}};
});
// group the nearest cell's run (same kind, diagonal neighbours)
const c0=ramp.cells[0]; const run=ramp.cells.filter(q=>q.k===c0.k&&Math.abs((q.c-c0.c)-(c0.k==='L'?(q.r-c0.r):-(q.r-c0.r)))<1&&Math.abs(q.c-c0.c)<=6);
run.sort((a,b)=>a.c-b.c);
console.log('ramp run', JSON.stringify(run.map(q=>[q.c,q.r,q.k])));
const mid=run[Math.floor(run.length/2)], T=ramp.T;
// park MIND away from the ramp so he doesn't stand in it, camera on the ramp
const setCam=async(wx,wy)=>pg.evaluate(([wx,wy])=>{ window.__camHold=[wx,wy]; },[wx,wy]);
await pg.evaluate(()=>{ const T=MV_GRID.tile; p.x=95*T-SW/2; p.y=32*T-FEET_OFF; p.vx=0; p.vy=0; });
await wait(600);
const shot=async(name)=>pg.screenshot({path:`${out}-${name}.png`});
// spray onto the ramp from above, several bursts along it
await pg.evaluate(([cells,T])=>{ for(const q of cells){ const x=q.c*T+T/2, y=q.r*T-40; window.MV_BLOOD.spray(x,y,22,Math.PI/2); } },[run,T]);
await wait(7000);
const measure=()=>pg.evaluate(()=>{
  const D=window.MV_BLOOD&&MV_BLOOD._dbg?MV_BLOOD._dbg():null;
  return D?D.slopeCheck():{note:'no _dbg (before build)', state:MV_BLOOD.state()};
});
const slope=await measure(); console.log('slope', JSON.stringify(slope));
// move the player near the ramp for the screenshot (camera follows him)
await pg.evaluate(()=>{ const T=MV_GRID.tile; p.x=89*T-SW/2; p.y=32*T-FEET_OFF; p.vx=0; p.vy=0; });
await wait(900);
await shot('ramp');
// overlay: draw the collision diagonal over the ramp art (red), to compare with the grass edge
await pg.evaluate(()=>{ window.__ovl=true; const _d=window.draw; window.draw=function(){ const r=_d.apply(this,arguments); try{ if(!window.__ovl) return r; if(typeof _worldZoomBegin==='function') _worldZoomBegin();
  const T=MV_GRID.tile; ctx.save(); ctx.strokeStyle='#00ffff'; ctx.lineWidth=2;
  for(let rr=0;rr<MV_GRID.rows;rr++) for(let cc=0;cc<MV_GRID.cols;cc++){ if(!gridIsSlope(cc,rr)) continue; const s=gridSlopeAt(cc,rr); if(!s) continue; ctx.beginPath(); ctx.moveTo(sx(s.x1),sy(s.y1)); ctx.lineTo(sx(s.x2),sy(s.y2)); ctx.stroke(); }
  ctx.restore(); if(typeof _worldZoomEnd==='function') _worldZoomEnd(); }catch(e){ console.warn(e); } return r; }; });
await wait(300); await shot('ramp-collision'); await pg.evaluate(()=>{ window.__ovl=false; });
// door: the home door (c30, rows 29-31). Stand to its left, blood on its face, then open it.
const door=await pg.evaluate(()=>{ const d=MV_DOORS.doors.find(q=>q.id==='home'); return {c:d.c,r0:d.r0,r1:d.r1,st:d.st}; });
await pg.evaluate(([d,T])=>{ p.x=d.c*T-SW/2-90; p.y=(d.r1+1)*T-FEET_OFF; p.vx=0; p.vy=0; },[door,T]);
await wait(800);
await pg.evaluate(([d,T])=>{ for(let k=0;k<4;k++) MV_BLOOD.spray(d.c*T-24,(d.r0+0.8+k*0.5)*T,26,0); },[door,T]);
await wait(3500);
const doorBefore=await pg.evaluate(()=>MV_BLOOD._dbg?MV_BLOOD._dbg().doorCheck('home'):null);
await shot('door-shut');
await pg.evaluate(([d,T])=>{ MV_DOORS.fist(d.c*T+4,(d.r0+1.5)*T,10,false); },[door,T]);
await wait(1500);
const doorAfter=await pg.evaluate(()=>MV_BLOOD._dbg?MV_BLOOD._dbg().doorCheck('home'):null);
await shot('door-open');
console.log('door', JSON.stringify({door, st:await pg.evaluate(()=>MV_DOORS.doors.find(q=>q.id==='home').st), doorBefore, doorAfter}));
console.log('errs', JSON.stringify(errs.slice(0,5)));
const fails=[];
if(!slope.runs) fails.push('no smear on the ramp');
if(slope.runMaxErr>2) fails.push('smear off the slope surface by '+slope.runMaxErr+'px');
if(slope.stairPools) fails.push(slope.stairPools+' flat pools stair-stepped on the ramp');
if(slope.rampWallStains) fails.push(slope.rampWallStains+' wall runs on ramp steps');
if(!doorBefore||!doorBefore.n) fails.push('no blood held by the door');
else{ const [a,b2]=doorAfter.leaf; const off=doorAfter.now.filter(x=>x<a-3||x>b2+3); if(off.length) fails.push(off.length+' door stains left behind the leaf'); }
if(errs.length) fails.push('page errors');
console.log(fails.length?'GORE SURFACES FAIL: '+fails.join('; '):'GORE SURFACES PASS');
process.exitCode=fails.length?1:0;
await b.close(); srv.close();
