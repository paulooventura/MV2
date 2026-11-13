// Steps for scripts/probe-lift.mjs: ride both 1.3 elevator shafts (claude/js/beta_lift.js).
const sleep=(pg,ms)=>pg.waitForTimeout(ms);
export default async ({pg,out})=>{
  const ev=(f,a)=>pg.evaluate(f,a);
  const st=()=>ev(()=>{ const L=MV_LIFT, cab=L.cab||L.hold;
    return {px:Math.round(p.x),vx:+(p.vx||0).toFixed(2),feet:Math.round(p.y+FEET_OFF),og:p.og,sealed:L.sealed,hold:!!L.hold,near:L.near,
      cab:cab?{y:Math.round(cab.y),ph:cab.phase,door:+(cab.door||0).toFixed(2)}:null, hp:Math.round(p.hp)}; });
  const results=[]; const check=(n,ok,i)=>{ results.push([n,!!ok]); console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(i)); };
  const surf=(col,row)=>ev(([c,r])=>{ for(const s of (MV_LIFT.shafts||[])) if(s.street!=null&&c*32>=s.x0-32&&c*32<=s.x1+32&&r*32>=s.street) return s.street; while(gridSolid(c,r-1)) r--; return r*32; },[col,row]);
  const place=async(x,feet)=>{ await ev(([x,f])=>{ p.x=x; p.y=f-FEET_OFF; p.vx=0; p.vy=0; p.og=true; },[x,feet]); await sleep(pg,350); };
  const openCabY=X=>ev(x=>{ const m=MV_BETA.platforms.find(q=>q.x===x&&q.phase==='open'); return m?Math.round(m.y):null; },X);
  const waitOpen=async(X,ms)=>{ const t=Date.now(); while(Date.now()-t<ms){ const y=await openCabY(X); const s=await st(); if(y!=null&&(!s.cab||s.cab.door<0.15)) return y; await sleep(pg,100); } return null; };
  const walk=async(key,cond,arg,ms=3000)=>{ await pg.keyboard.down(key); const t=Date.now(); while(Date.now()-t<ms){ if(await ev(cond,arg)) break; await sleep(pg,25);} await pg.keyboard.up(key); await sleep(pg,400); };
  const FLOORS=[64,54,44,34,23,14];   // build 404: (about) ten rows apart
  // tripwire: any sudden lift of MIND (>20 px in one write) while he's in a car, with who did it
  await ev(()=>{ let _y=p.y; window._MV_JUMPS=[]; Object.defineProperty(p,'y',{configurable:true,get(){return _y;},set(v){
    if(_y-v>20&&(MV_LIFT.sealed||MV_LIFT.hold)&&_MV_JUMPS.length<5) _MV_JUMPS.push({fr,from:Math.round(_y),to:Math.round(v),st:new Error().stack.split('\n').slice(2,6).map(s=>s.trim().replace(/https?:\/\/[^/]+\//,'')).join(' < ')});
    _y=v; }}); });
  for(const [shaft,col] of [['left',8],['right',19]]){
    const X=col*32, inCab=x=>p.x+SW/2>=x+40;
    const street=await surf(col,64);
    await place(X-80,street);
    check(shaft+': CALL prompt next to the shaft',(await st()).near,await st());
    await pg.keyboard.press('KeyF');
    let y=await waitOpen(X,9000);
    check(shaft+': the called car opens at the street',y!=null&&Math.abs(y-street)<3,{y,street});
    await walk('KeyD',inCab,X);
    // ride pressed to the car's right wall: over the left shaft's street ramp (the worst spot)
    await pg.keyboard.down('KeyD'); await sleep(pg,500); await pg.keyboard.up('KeyD'); await sleep(pg,200);
    let s=await st(); check(shaft+': boarded, doors shut',s.sealed&&s.cab&&s.cab.ph==='shut',s);
    await sleep(pg,500); s=await st(); check(shaft+': walking into the wall builds no speed',Math.abs(s.vx)<0.5,s);
    if(shaft==='left') await pg.screenshot({path:`${out}/left-in.png`});
    for(let k=1;k<FLOORS.length;k++){
      const from=(await st()).feet;
      await pg.keyboard.press('ArrowUp'); await sleep(pg,300);
      s=await st(); check(`${shaft}: carried up toward floor ${k+1}`,s.sealed&&s.cab&&Math.abs(s.feet-s.cab.y)<3&&s.feet<from-10,s);
      const want=await surf(col,FLOORS[k]); y=await waitOpen(X,9000); s=await st();
      check(`${shaft}: doors open on floor ${k+1} with MIND inside`,y!=null&&Math.abs(y-want)<3&&Math.abs(s.feet-want)<3,{y,want,s});
    }
    // one floor down and back up
    await pg.keyboard.press('ArrowDown'); await sleep(pg,300);
    s=await st(); check(shaft+': carried down toward floor 5',s.sealed&&s.cab&&Math.abs(s.feet-s.cab.y)<3,s);
    y=await waitOpen(X,9000); s=await st();
    check(shaft+': doors open on floor 5',y!=null&&Math.abs(s.feet-(await surf(col,FLOORS[4])))<3,{y,s});
    await pg.keyboard.press('ArrowUp'); await sleep(pg,300);
    y=await waitOpen(X,9000); s=await st();
    check(shaft+': back on floor 6',y!=null&&Math.abs(s.feet-(await surf(col,FLOORS[5])))<3,{y,s});
    // Paulo, Nov 11 (T455): up from the 6th the car goes on over the top and comes round to the
    // street, MIND inside it (it used to leave him at the top of the level)
    await pg.keyboard.press('ArrowUp'); await sleep(pg,300);
    s=await st(); check(shaft+': up past the 6th: carried on, sealed',s.sealed&&s.cab&&Math.abs(s.feet-s.cab.y)<3,s);
    y=await waitOpen(X,15000); s=await st();
    check(shaft+': round to the street, MIND inside',y!=null&&Math.abs(s.feet-street)<3&&s.hp>0,{y,street,s});
    await walk('KeyA',x=>p.x+SW/2<x-30,X);
    s=await st(); check(shaft+': steps back out onto the street',!s.sealed&&!s.hold&&s.og&&Math.abs(s.feet-street)<3,s);
    await sleep(pg,1200);
    const loop=await ev(x=>MV_BETA.platforms.filter(q=>q.x===x).every(q=>!q.phase||q.phase==='run'),X);
    check(shaft+': the shaft goes back to its loop once MIND leaves',loop,null);
  }
  for(const j of await ev(()=>window._MV_JUMPS||[])) console.log('JUMP',JSON.stringify(j));
  const bad=results.filter(r=>!r[1]).length; console.log(`\n${results.length-bad}/${results.length} passed`);
  return bad?1:0;
};
