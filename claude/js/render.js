// ============================================================
//  Mind & Venture — render.js
//  Character/world canvas drawing, sprites, FX, enemies on screen.
// ============================================================

/* -- Wheel -- */
/* â”€â”€ CHARACTER SPRITES â€” built once at init, blitted per frame â”€â”€ */
// Rotate a sprite by 90Â° steps (SMS-style pre-rotated frames).
function rotSpr(spr,quads){
  quads=((quads%4)+4)%4;
  if(!quads)return spr;
  const w=spr.width,h=spr.height;
  const c=document.createElement('canvas');
  c.width=(quads%2)?h:w;c.height=(quads%2)?w:h;
  const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  g.translate(c.width/2,c.height/2);g.rotate(quads*Math.PI/2);
  g.drawImage(spr,-w/2,-h/2);
  return c;
}
// 10Ã—10 wheel â€” layered tire, blade, hub with rim highlight.
function _mkWheelFrames(tire,blade,hub,rim){
  const frames=[];
  for(let f=0;f<6;f++){
    const c=document.createElement('canvas');c.width=10;c.height=10;
    const g=c.getContext('2d');g.imageSmoothingEnabled=false;
    for(let y=0;y<10;y++)for(let x=0;x<10;x++){
      const dx=x-4.5,dy=y-4.5,d=Math.sqrt(dx*dx+dy*dy);
      if(d<=4.9&&d>=3.4){g.fillStyle=tire;g.fillRect(x,y,1,1);}
      if(d<=3.3&&d>=2.8){g.fillStyle=rim||C.GREY;g.fillRect(x,y,1,1);}
    }
    const a0=f*(Math.PI*2/3)/6;
    g.fillStyle=blade;
    for(let b=0;b<3;b++){
      const a=a0+b*Math.PI*2/3;
      for(let r=1;r<=3.1;r+=0.45){
        const x=Math.round(4+Math.cos(a)*r),y=Math.round(4+Math.sin(a)*r);
        g.fillRect(x,y,1,1);
      }
    }
    g.fillStyle=hub;g.fillRect(4,4,2,2);
    g.fillStyle=C.WHITE;g.fillRect(4,4,1,1);
    g.fillStyle=C.GREY_D;g.fillRect(5,5,1,1);
    frames.push(c);
  }
  return frames;
}
const WHEEL_SPR={
  mind:_mkWheelFrames(C.GREY_D,C.INDIGO,C.GREY,C.SILVER),
  venture:_mkWheelFrames(C.GREY_D,C.RED_D,C.GREY,C.TAN),
  hostile:_mkWheelFrames(C.GREY_D,C.RED,C.GREY,C.RED_L),
  charged:_mkWheelFrames(C.GREEN_D,C.TEAL,C.GREY,C.MINT),
  ready:_mkWheelFrames(C.GREEN,C.TEAL_L,C.WHITE,C.MINT),
};
function drawEnemyBodyShape(bx,by,facing,shape){
  const cx=(bx|0), cy=(by|0);
  const shad=C.MAROON, mid=C.RED_D, face=C.RED, hi=C.RED_L, edge=C.BLACK;
  if(shape==='ball'){
    for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){
      const d=Math.hypot(dx,dy);
      if(d>5.2) continue;
      ctx.fillStyle=d>4.6?edge:d>3.6?(dx+dy<-1?shad:mid):face;
      ctx.fillRect(cx+dx,cy+dy,1,1);
    }
    ctx.fillStyle=hi;ctx.fillRect(cx+(facing?2:-2),cy-3,1,2);
    ctx.fillStyle=C.GREY_D;ctx.fillRect(cx-1,cy+3,2,1);
  }else if(shape==='square'){
    ctx.fillStyle=edge;ctx.fillRect(cx-5,cy-4,11,10);
    ctx.fillStyle=shad;ctx.fillRect(cx-4,cy-3,9,8);
    ctx.fillStyle=mid;ctx.fillRect(cx-3,cy-2,7,6);
    ctx.fillStyle=face;
    const fx=facing?cx:cx-2;
    ctx.fillRect(fx,cy-2,7,6);
    ctx.fillStyle=hi;ctx.fillRect(facing?cx+3:cx-3,cy-1,1,4);
    ctx.fillStyle=C.GREY;ctx.fillRect(cx-3,cy-2,7,1);
  }else if(shape==='triangle'){
    for(let row=0;row<9;row++){
      const half=row<2?1:row<4?2:row<6?3:row<8?4:5;
      const y=cy-4+row;
      for(let dx=-half;dx<=half;dx++){
        const t=row/8;
        ctx.fillStyle=row===0||Math.abs(dx)===half?edge:t<0.35?mid:t<0.7?face:shad;
        ctx.fillRect(cx+dx,y,1,1);
      }
    }
    ctx.fillStyle=hi;ctx.fillRect(cx+(facing?1:-1),cy-2,1,2);
  }else{
    const pts=[[0,-5],[2,-1],[5,-1],[2,1],[3,5],[0,2],[-3,5],[-2,1],[-5,-1],[-2,-1]];
    ctx.fillStyle=edge;
    for(const [dx,dy] of pts) ctx.fillRect(cx+dx,cy+dy,1,1);
    for(const [dx,dy] of pts){
      if(dy<=0){ctx.fillStyle=face;ctx.fillRect(cx+dx,cy+dy,1,1);}
    }
    ctx.fillStyle=mid;
    ctx.fillRect(cx,cy,1,1);ctx.fillRect(cx-1,cy+1,3,1);
    ctx.fillStyle=hi;ctx.fillRect(cx,cy-2,1,1);
    if((fr&3)===0){ctx.fillStyle=C.YELLOW;ctx.fillRect(cx+(facing?3:-3),cy,1,1);}
  }
}
function drawMindGloveArm(e,sxp,syp,facing,hidden){
  const armCol1=C.MAROON, armCol2=C.RED_D;
  const punching=e.pt>0;
  const snapFrac=punching?(1-e.pt/10):0;
  const fwdDir=facing?1:-1;
  const seg1Len=14, guardFwd=12, punchFwd=30;
  if(!punching){
    const s1=Math.round(seg1Len/SMS_SCALE);
    if(!hidden) drawCoil(sxp,syp,Math.PI/2,s1,armCol1,armCol2);
    const ex=sxp, ey=syp+s1;
    const s2=Math.max(1,Math.round(guardFwd/SMS_SCALE));
    if(!hidden) drawCoil(ex,ey,facing?0:Math.PI,s2,armCol1,armCol2);
    if(!hidden) drawFist(ex+fwdDir*s2,ey,facing,false,0,false,0);
  }else{
    const armLen=guardFwd+snapFrac*(punchFwd-guardFwd);
    const punchAngle=Math.atan2(e.aimDY,e.aimDX);
    if(!hidden) drawCoil(sxp,syp,punchAngle,armLen/SMS_SCALE,armCol1,armCol2);
    if(!hidden) drawFist(sxp+Math.cos(punchAngle)*armLen/SMS_SCALE,syp+Math.sin(punchAngle)*armLen/SMS_SCALE,facing,false,0,true,snapFrac);
  }
}
function _mindEnemyEnergy(e){
  if(e.pt>0) return 0.9;
  if(e.xlrOn||e.magOn) return 0.82+Math.sin(fr*0.22)*0.12;
  if(e.hook&&e.hook.st!=='idle') return 0.72;
  if(e.flashF>0) return 0.75;
  if(e.laserCd>0&&e.laserCd<22) return 1-e.laserCd/22;
  const pd=Math.hypot(p.x+SW/2-(e.x+SW/2),p.y+FEET_OFF-(e.y+FEET_OFF))||1;
  return pd<420?0.4+Math.sin(fr*0.13+e.x*0.02)*0.35:0.12;
}
function drawCharShadow(cx,cy){
  ctx.fillStyle='rgba(0,0,0,0.35)';
  ctx.beginPath();ctx.ellipse(cx,cy+8,18,6,0,0,Math.PI*2);ctx.fill();
}
function _wheelPalette(pl){
  const ch=_playerChargeInfo(pl);
  const {chargeFrac,ready,springReady,wallReady}=ch;
  if(pl._wheelHostile) return {b1:'#660018',b2:'#aa0028',b3:'#dd2244',spin:'rgba(200,40,60,0.6)',tread:false};
  if(ready&&(springReady||wallReady)) return {b1:'#0a3818',b2:'#22c060',b3:'#7affa8',spin:'rgba(48,255,120,0.7)',tread:true};
  if(ready) return {b1:'#184820',b2:'#28a050',b3:'#58e878',spin:'rgba(40,200,80,0.55)',tread:true};
  if(chargeFrac>0.04){
    const t=Math.min(1,chargeFrac);
    if(pl.hero==='venture'){
      return {
        b1:_mixHex('#661018','#184838',t),
        b2:_mixHex('#aa2030','#28a088',t),
        b3:_mixHex('#dd4050','#58d0b0',t),
        spin:`rgba(${Math.round(200+t*-160)},${Math.round(60+t*120)},${Math.round(80+t*80)},${0.35+t*0.2})`,
        tread:t>0.35
      };
    }
    return {
      b1:_mixHex('#3d0066','#184838',t),
      b2:_mixHex('#6600aa','#28a088',t),
      b3:_mixHex('#9922dd','#58d0b0',t),
      spin:`rgba(${Math.round(120+t*-80)},${Math.round(60+t*120)},${Math.round(200+t*-40)},${0.35+t*0.25})`,
      tread:t>0.35
    };
  }
  if(pl.hero==='venture') return {b1:'#661018',b2:'#aa2030',b3:'#dd4050',spin:'rgba(200,60,80,0.5)',tread:false};
  return {b1:'#3d0066',b2:'#6600aa',b3:'#9922dd',spin:'rgba(120,60,200,0.6)',tread:false};
}
function _mixHex(a,b,t){
  const p=(h)=>parseInt(h.slice(1),16);
  const c0=p(a),c1=p(b);
  const ch=(i)=>((c0>>i&255)+((c1>>i&255)-(c0>>i&255))*t)|0;
  return '#'+[16,8,0].map(i=>ch(i).toString(16).padStart(2,'0')).join('');
}
function drawWheel(cx,cy,angle,plRef){
  const pl=plRef||p;
  const R=WHEEL_R, spR=R-4;
  const pal=_wheelPalette(pl);
  const chReady=!!pl.duckBoostReady||!!pl._wallChargeReady;
  const tilt=pl.suspTilt||0;
  ctx.save();ctx.translate(cx,cy);ctx.rotate(tilt);
  ctx.translate(-cx,-cy);
  // ── build 227: a dirt-bike wheel kit (Paulo: "badass dirtbike tire/wheel kit… cool/techy, hype") ──
  // knobby tire (rigid knobs; only the contact knobs flatten a hair), anodized rim, crossed
  // spokes, a drilled disc brake and a glowing motor hub with an LED ring
  const isVen=pl.hero==='venture'&&!pl._wheelHostile, hostile=!!pl._wheelHostile;
  const ano=hostile?'#8a1420':isVen?'#b0242e':'#7a2cc8', anoHi=hostile?'#e04050':isVen?'#ff5a5a':'#b884ff';
  const led=pal.tread?pal.b3:(hostile?'#ff4050':isVen?'#ff6a5a':'#5cffa0');
  const flat=Math.max(0,Math.min(2,(pl._tireSq||0)*0.35));       // contact patch: a hair, not jelly
  const rimR=R-6;
  // tire carcass
  ctx.beginPath();ctx.arc(cx,cy,R-1,0,Math.PI*2);ctx.fillStyle='#0d0c10';ctx.fill();
  // knobs: big square blocks standing proud of the carcass, staggered rows, turning with the wheel
  ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);
  const nK=14;
  for(let i=0;i<nK;i++){
    const a=i*(Math.PI*2/nK);
    ctx.save();ctx.rotate(a);
    const off=(i&1)?-1.2:1.2, kw=5.2, kh=3.6;
    ctx.fillStyle='#2a2830';ctx.fillRect(R-kh-0.5,off-kw/2,kh+1.5,kw);
    ctx.fillStyle='#4a4856';ctx.fillRect(R-kh+0.5,off-kw/2,1.2,kw);           // lit leading edge
    ctx.restore();
  }
  ctx.restore();
  // contact flat: shave the knobs at the ground under load
  if(flat>0.15&&pl.og){ ctx.fillStyle='rgba(0,0,0,0)'; ctx.save(); ctx.globalCompositeOperation='destination-out'; ctx.fillRect(cx-R-3,cy+R+1.2-flat,2*R+6,4); ctx.restore(); }
  // sidewall + sheen
  ctx.beginPath();ctx.arc(cx,cy,R-2.5,0,Math.PI*2);ctx.strokeStyle='#18171d';ctx.lineWidth=3;ctx.stroke();
  ctx.beginPath();ctx.arc(cx,cy,R-2.5,Math.PI*1.08,Math.PI*1.55);ctx.strokeStyle='rgba(170,175,200,0.32)';ctx.lineWidth=1.5;ctx.stroke();
  // a hot tire (XLR burnout, beta_feel.js): the rubber glows orange from the tread in
  const heat=Math.max(0,Math.min(1,pl._tireHeat||0));
  if(heat>0.04){
    ctx.save(); ctx.globalCompositeOperation='lighter';
    ctx.beginPath();ctx.arc(cx,cy,R-1.5,0,Math.PI*2);ctx.strokeStyle=`rgba(255,${Math.round(120-60*heat)},30,${(0.15+0.5*heat).toFixed(2)})`;ctx.lineWidth=3+2*heat;ctx.stroke();
    ctx.beginPath();ctx.arc(cx,cy+R*0.55,R*0.9,Math.PI*0.2,Math.PI*0.8);ctx.strokeStyle=`rgba(255,200,90,${(0.35*heat).toFixed(2)})`;ctx.lineWidth=2;ctx.stroke();   // hottest at the contact
    ctx.restore();
  }
  // anodized rim
  ctx.beginPath();ctx.arc(cx,cy,rimR,0,Math.PI*2);ctx.strokeStyle=ano;ctx.lineWidth=2.6;ctx.stroke();
  ctx.beginPath();ctx.arc(cx,cy,rimR,Math.PI*1.05,Math.PI*1.6);ctx.strokeStyle=anoHi;ctx.lineWidth=1.2;ctx.stroke();
  ctx.beginPath();ctx.arc(cx,cy,rimR-1.6,0,Math.PI*2);ctx.fillStyle='#07060b';ctx.fill();
  // crossed spokes
  ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);
  ctx.strokeStyle='rgba(190,196,214,0.85)';ctx.lineWidth=0.8;
  for(let i=0;i<16;i++){
    const a=i*Math.PI/8, h=(i&1)?0.5:-0.5;
    ctx.beginPath();ctx.moveTo(Math.cos(a+h)*4.5,Math.sin(a+h)*4.5);ctx.lineTo(Math.cos(a)*(rimR-1.6),Math.sin(a)*(rimR-1.6));ctx.stroke();
  }
  // drilled disc brake
  ctx.beginPath();ctx.arc(0,0,7.5,0,Math.PI*2);ctx.fillStyle='#9aa0ae';ctx.fill();
  ctx.beginPath();ctx.arc(0,0,7.5,0,Math.PI*2);ctx.strokeStyle='#5a6070';ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle='#3a3e4a';
  for(let i=0;i<6;i++){ const a=i*Math.PI/3+0.3; ctx.fillRect(Math.cos(a)*5.4-0.8,Math.sin(a)*5.4-0.8,1.6,1.6); }
  ctx.restore();
  // motor hub + LED ring (pulses with speed, spins its light)
  const spd=Math.min(1,Math.abs(pl.vx||0)/8);
  ctx.beginPath();ctx.arc(cx,cy,4.2,0,Math.PI*2);ctx.fillStyle='#14121c';ctx.fill();
  ctx.save();ctx.globalAlpha=0.45+0.45*spd;ctx.strokeStyle=led;ctx.lineWidth=1.6;
  ctx.beginPath();ctx.arc(cx,cy,3.4,angle*1.5,angle*1.5+Math.PI*1.3);ctx.stroke();ctx.restore();
  ctx.beginPath();ctx.arc(cx,cy,1.4,0,Math.PI*2);ctx.fillStyle=(pl===p&&typeof isSprintHeld==='function'&&isSprintHeld())?'#3dff7a':'#c8ccd8';ctx.fill();
  if(!pl.xlrOn&&!pl.magOn&&Math.abs(pl.vx||0)>2){
    ctx.beginPath();ctx.arc(cx,cy,R+2,0,Math.PI*2);
    ctx.strokeStyle=pal.b3;ctx.globalAlpha=0.35;ctx.lineWidth=3;ctx.stroke();ctx.globalAlpha=1;
  }
  if(pl.wallGrip>0&&!pl.xlrOn&&!pl.magOn){
    if(pl._wallChargeReady){
      const pulse=0.55+Math.sin(fr*0.26)*0.45;
      ctx.beginPath();ctx.arc(cx,cy,R+5,0,Math.PI*2);
      ctx.strokeStyle=`rgba(48,255,112,${pulse})`;
      ctx.lineWidth=4;ctx.stroke();
      ctx.beginPath();ctx.arc(cx,cy,R+9,0,Math.PI*2);
      ctx.strokeStyle=`rgba(48,255,112,${pulse*0.35})`;
      ctx.lineWidth=2;ctx.stroke();
      if(fr%3<2){
        ctx.fillStyle='rgba(80,255,140,0.9)';
        const spx=cx+(pl.wallDir<0?-(R+4):R+4);
        ctx.fillRect(spx-1,cy-2,2,2);ctx.fillRect(spx-1,cy+2,2,2);
      }
    }else{
      const gf=pl.wallGrip/90, held=1-gf;
      const gr=Math.round(80+held*175), gg=Math.round(220-held*220), gb=20;
      ctx.beginPath();ctx.arc(cx,cy,R+4,0,Math.PI*2);
      ctx.strokeStyle=`rgba(${gr},${gg},${gb},${0.5+held*0.5})`;
      ctx.lineWidth=2+held*4;ctx.stroke();
      ctx.beginPath();ctx.arc(cx,cy,R+7+held*4,0,Math.PI*2);
      ctx.strokeStyle=`rgba(${gr},${gg},${gb},${held*0.4})`;
      ctx.lineWidth=2;ctx.stroke();
      if(fr%3<2){
        ctx.fillStyle=`rgba(${gr},${gg},${gb},0.85)`;
        const spx=cx+(pl.wallDir<0?-(R+4):R+4);
        ctx.fillRect(spx-1,cy-2,2,2);ctx.fillRect(spx-1,cy+2,2,2);
        if(held>0.5) ctx.fillRect(spx-1,cy,2,2);
      }
    }
  }else if(chReady){
    const pulse=0.5+Math.sin(fr*0.24)*0.5;
    ctx.beginPath();ctx.arc(cx,cy,R+4,0,Math.PI*2);
    ctx.strokeStyle=`rgba(48,255,112,${pulse})`;
    ctx.lineWidth=3+Math.sin(fr*0.18);ctx.stroke();
  }
  ctx.restore();
}
// the suspension kit between the speaker and the wheel (build 227): an upside-down fork leg
// over the axle, a coil-over shock behind it, and the speaker's cable plugged into the hub
function drawWheelKit(cx,cy,bodyBot,fc,pl){
  const gap=cy-bodyBot; if(!(gap>5)) return;                     // crouched: the kit folds away under the box
  const isVen=pl.hero==='venture', back=fc?-1:1;
  const ano='#15151a', anoHi=isVen?'#ff5a5a':'#b884ff', spring='#e8b440';   // black fork, gold suspension (Oct 22 key art)
  const comp=Math.max(0,Math.min(1,(pl.suspComp||0)));
  ctx.save(); ctx.lineCap='round';
  // coil-over shock: from the box's back corner down to the axle
  const sx0=cx+back*15, sy0=bodyBot-2, ex=cx+back*2, ey=cy-1;
  const L=Math.hypot(ex-sx0,ey-sy0), ang=Math.atan2(ey-sy0,ex-sx0);
  ctx.translate(sx0,sy0); ctx.rotate(ang);
  ctx.fillStyle='#2a2a34'; ctx.fillRect(0,-3,L*0.45,6);                                   // body
  ctx.fillStyle='#d8dce6'; ctx.fillRect(L*0.45,-1.2,L*0.55,2.4);                          // chrome shaft
  ctx.strokeStyle=spring; ctx.lineWidth=1.6;                                              // the spring, tighter as it compresses
  const coils=6, cl=L*(0.86-comp*0.18);
  ctx.beginPath(); for(let i=0;i<=coils*8;i++){ const t=i/(coils*8), x=2+t*cl, y=Math.sin(t*coils*Math.PI*2)*3.6; i?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.stroke();
  ctx.fillStyle=ano; ctx.fillRect(-2,-4,4,8); ctx.fillRect(L-2,-3,4,6);                    // clevises
  ctx.restore(); ctx.save(); ctx.lineCap='round';
  // the fork leg: fat anodized upper tube out of the box, chrome stanchion into the axle
  const fx=cx+(fc?3:-3), upLen=Math.max(4,gap*0.55);
  ctx.fillStyle=ano; ctx.fillRect(fx-3.5,bodyBot-3,7,upLen+3);
  ctx.fillStyle=anoHi; ctx.fillRect(fx-3.5,bodyBot-3,1.5,upLen+3);
  ctx.fillStyle='#1a1a22'; ctx.fillRect(fx-4,bodyBot+upLen-1,8,2);                          // seal
  ctx.fillStyle='#d8a030'; ctx.fillRect(fx-2.2,bodyBot+upLen,4.4,gap-upLen);               // gold stanchion
  ctx.fillStyle='rgba(255,240,180,0.85)'; ctx.fillRect(fx-1.6,bodyBot+upLen,1,gap-upLen);
  ctx.fillStyle='#2a2a34'; ctx.beginPath(); ctx.arc(fx,cy,3.2,0,Math.PI*2); ctx.fill();      // axle clamp
  ctx.fillStyle='#c8ccd8'; ctx.beginPath(); ctx.arc(fx,cy,1.3,0,Math.PI*2); ctx.fill();
  // the speaker's cable into the hub motor, with a live glow
  const jx=cx-back*20, jy=bodyBot-3, sag=6+Math.sin(fr*0.08)*1.2;
  ctx.strokeStyle='#0a0a10'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(jx,jy); ctx.bezierCurveTo(jx-back*4,jy+sag+6,cx-back*8,cy+2,cx-back*3,cy); ctx.stroke();
  ctx.strokeStyle=isVen?'rgba(255,90,90,0.65)':'rgba(120,255,160,0.6)'; ctx.lineWidth=1;
  ctx.setLineDash([2,3]); ctx.lineDashOffset=-fr*0.4*(Math.abs(pl.vx||0)>0.3?Math.sign(pl.vx):0.3);
  ctx.beginPath(); ctx.moveTo(jx,jy); ctx.bezierCurveTo(jx-back*4,jy+sag+6,cx-back*8,cy+2,cx-back*3,cy); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle='#c8a040'; ctx.fillRect(jx-2,jy-3,4,4);                                     // gold jack on the cabinet
  ctx.restore();
}
function drawHostileWheel(cx,cy,angle){
  drawWheel(cx,cy,angle,{_wheelHostile:true,hero:'venture',vx:0,wallGrip:0,duckCharge:0,runRamp:0,duckBoostReady:false});
}

/* -- HS8 Body â€” shaded studio monitor cabinet -- */
function drawBody(bx,by,facing,ca2=0,status=null){
  // Paulo (Oct 22, the key art): a black cabinet, a THICK vinyl record sitting on top of it
  // (the arms come out of chrome orbs on its edges, the bulb screws into its centre), and the
  // glowing green Knowl tank built into the back of the box — its level is MIND's HP.
  facing=!facing;   // the speaker faces the way MIND is heading
  const bw=52,bh=42, x=bx-bw/2, y=by;
  const isVenture=p.hero==='venture';
  const top=y+10;                                   // the cabinet's face starts under the record
  // cabinet
  ctx.fillStyle='#030304'; ctx.fillRect(x-1,top-1,bw+2,bh-top+y+2);
  const g=ctx.createLinearGradient(0,top,0,y+bh); g.addColorStop(0,'#1a1a1f'); g.addColorStop(1,'#08080a');
  ctx.fillStyle=g; ctx.fillRect(x,top,bw,y+bh-top);
  ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=1; ctx.strokeRect(x+2.5,top+2.5,bw-5,y+bh-top-5);
  // the woofer
  const scx=x+(facing?bw*0.42:bw*0.58), scy=top+(y+bh-top)*0.52, wr=13;
  ctx.beginPath();ctx.arc(scx,scy,wr+1.5,0,Math.PI*2);ctx.fillStyle='#000';ctx.fill();
  ctx.beginPath();ctx.arc(scx,scy,wr,0,Math.PI*2);ctx.fillStyle='#16161c';ctx.fill();
  const cg=ctx.createRadialGradient(scx-3,scy-3,1,scx,scy,wr-2.5); cg.addColorStop(0,'#3a3a46'); cg.addColorStop(1,'#0b0b0f');
  ctx.beginPath();ctx.arc(scx,scy,wr-2.5,0,Math.PI*2);ctx.fillStyle=cg;ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.5)';ctx.lineWidth=0.6; for(const r of [8,5.5]){ ctx.beginPath();ctx.arc(scx,scy,r,0,Math.PI*2);ctx.stroke(); }
  ctx.beginPath();ctx.arc(scx,scy,3.6,0,Math.PI*2);ctx.fillStyle='#050507';ctx.fill();
  ctx.beginPath();ctx.arc(scx-1.2,scy-1.2,1.2,0,Math.PI*2);ctx.fillStyle='rgba(220,220,255,0.35)';ctx.fill();
  ctx.beginPath();ctx.arc(scx,scy,wr+0.5,Math.PI*1.05,Math.PI*1.6);ctx.strokeStyle=isVenture?'rgba(255,110,110,0.45)':'rgba(170,140,255,0.45)';ctx.lineWidth=1.2;ctx.stroke();
  if((p._dblJumpFx||0)>0){ const f=p._dblJumpFx/14; ctx.save(); ctx.strokeStyle=`rgba(${isVenture?'255,150,170':'200,160,255'},${f.toFixed(2)})`; ctx.lineWidth=2; for(const k of [0,6]){ ctx.beginPath(); ctx.arc(scx,scy,wr+1+(1-f)*16+k,0,Math.PI*2); ctx.stroke(); } ctx.restore(); }   // the woofer's kick (double jump)
  // corner screws
  ctx.fillStyle='#4a4e58'; for(const [sx2,sy2] of [[x+4,top+4],[x+bw-4,top+4],[x+4,y+bh-4],[x+bw-4,y+bh-4]]){ if((facing&&sx2<x+bw/2&&sy2>top+8)||(!facing&&sx2>x+bw/2&&sy2>top+8)) continue; ctx.beginPath();ctx.arc(sx2,sy2,1.3,0,Math.PI*2);ctx.fill(); }
  // rim light (the key art's coloured edge light) and a shadowed bottom
  ctx.fillStyle=isVenture?'rgba(255,70,80,0.5)':'rgba(150,100,255,0.5)'; ctx.fillRect(facing?x+bw-1.5:x,top,1.5,y+bh-top);
  ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(x+1,y+bh-1.5,bw-2,1.5);
  // the Knowl tank in the back: glass, glowing green liquid (10% air at full HP), bubbles
  const maxHp=status?(status.mhp||1):(p.maxHp||PLAYER_MAX_HP);
  const hp=status?(status.hp||0):(p.hp||0);
  const liveFrac=maxHp>0?Math.max(0,Math.min(1,hp/maxHp)):0;
  const tw=9, tx0=facing?x+bw-tw-2:x+2, ty0=top+3, th=y+bh-top-7;
  const liq=th*0.9*liveFrac, ly=ty0+th-liq;
  const gore=!!(window.MV_CONSOLE&&MV_CONSOLE.mode==='gore');
  const low=liveFrac<=0.35, lc=gore?'#9a0014':(low&&fr%16<8?'#ff5a5a':(liveFrac>0.6?'#3dff7a':liveFrac>0.35?'#c8ff3a':'#ff9a2a'));
  ctx.fillStyle='#000'; ctx.fillRect(tx0-1,ty0-1,tw+2,th+2);
  ctx.fillStyle=gore?'#1a0608':'#0a1a10'; ctx.fillRect(tx0,ty0,tw,th);
  if(liq>0){
    const halo=ctx.createRadialGradient(tx0+tw/2,ly+liq/2,1,tx0+tw/2,ly+liq/2,14+liq*0.4);
    halo.addColorStop(0,gore?'rgba(180,0,16,0.42)':'rgba(80,255,130,0.28)'); halo.addColorStop(1,gore?'rgba(180,0,16,0)':'rgba(80,255,130,0)');
    if(!low||gore){ ctx.fillStyle=halo; ctx.fillRect(tx0-14,ly-10,tw+28,liq+20); }
    const lg=ctx.createLinearGradient(0,ly,0,ly+liq);
    lg.addColorStop(0,gore?'#ff3a44': '#d8ff9a'); lg.addColorStop(0.2,lc); lg.addColorStop(1,gore?'#3a0008':(low?'#7a1010':'#0e9a3a'));
    ctx.fillStyle=lg; ctx.fillRect(tx0,ly,tw,liq);
    ctx.fillStyle=gore?'rgba(255,210,210,0.8)':'rgba(255,255,255,0.75)'; ctx.fillRect(tx0,ly,tw,1);
    for(let i=0;i<3;i++){ const bt=((fr*0.6+i*13)%Math.max(4,liq)); ctx.fillStyle=gore?'rgba(255,180,180,0.75)':'rgba(230,255,230,0.7)'; ctx.fillRect(tx0+2+((i*3)%5),ly+liq-bt,1.2,1.2); }
  }
  ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.fillRect(tx0+1,ty0+1,1.2,th-2);              // the glass
  const lifeSegs=status?Math.max(1,Math.ceil(maxHp/PLAYER_HIT_DMG)):MAXLIVES;
  for(let i=1;i<lifeSegs;i++){ ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(tx0,ty0+Math.floor(th*i/lifeSegs),tw,1); }
  // power dot
  const dotOff=status&&status.off;
  const dotX=x+(facing?5:bw-5),dotY=y+bh-5;
  ctx.beginPath();ctx.arc(dotX,dotY,2.2,0,Math.PI*2);ctx.fillStyle=dotOff?'#880000':'#00cc44';ctx.fill();
  ctx.beginPath();ctx.arc(dotX,dotY,1.3,0,Math.PI*2);ctx.fillStyle=dotOff?'#ff3333':'#7dff9a';ctx.fill();
  // the thick record on top: a black slab with grooves, wider than the box, a sheen on its face
  const rx0=x-3, rw=bw+6, ry0=y, rh=12;
  ctx.fillStyle='#000'; ctx.fillRect(rx0-1,ry0-1,rw+2,rh+2);
  const rg=ctx.createLinearGradient(0,ry0,0,ry0+rh); rg.addColorStop(0,'#2a2a32'); rg.addColorStop(0.25,'#111116'); rg.addColorStop(1,'#060608');
  ctx.fillStyle=rg; ctx.fillRect(rx0,ry0,rw,rh);
  ctx.fillStyle='rgba(255,255,255,0.07)'; for(let k=ry0+3;k<ry0+rh;k+=2) ctx.fillRect(rx0+1,k,rw-2,0.6);
  ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.fillRect(rx0+2,ry0,rw-4,1);
  ctx.fillStyle=isVenture?'rgba(255,80,90,0.35)':'rgba(170,120,255,0.35)'; ctx.fillRect(facing?rx0+rw-10:rx0+4,ry0+1,6,0.8);   // a coloured glint
  // chrome orbs on the record's edges (the shoulder sockets)
  for(const ox of [rx0-1,rx0+rw+1]){
    const og=ctx.createRadialGradient(ox-1.5,ry0+4.5,0.5,ox,ry0+6,5); og.addColorStop(0,'#ffffff'); og.addColorStop(0.4,'#b8bec8'); og.addColorStop(1,'#2a2e36');
    ctx.beginPath(); ctx.arc(ox,ry0+6,4.6,0,Math.PI*2); ctx.fillStyle='#000'; ctx.fill();
    ctx.beginPath(); ctx.arc(ox,ry0+6,3.8,0,Math.PI*2); ctx.fillStyle=og; ctx.fill();
  }
  // the Isolator (Paulo, Oct 22): a glossy orange rubber skin over the speaker box only —
  // the arms, the wheel and the head stay outside it
  if(!status&&window.MV_BETA&&MV_BETA.on&&MV_BETA.hasIsolator&&!p._betaSib&&!p._aiCompanion){
    const wet=MV_BETA.mindWet||0, a=0.3+0.25*wet+0.06*Math.sin(fr*0.12);
    const ix=x-3, iy=top-3, iw=bw+6, ih=y+bh-top+6;
    ctx.save();
    ctx.fillStyle='rgba(255,150,60,'+(a*0.5).toFixed(3)+')'; ctx.strokeStyle='rgba(255,185,105,'+Math.min(1,a+0.25).toFixed(3)+')'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.roundRect(ix,iy,iw,ih,7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle='rgba(255,240,210,'+(0.4+0.3*wet).toFixed(3)+')'; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.moveTo(ix+5,iy+ih-8); ctx.lineTo(ix+5,iy+8); ctx.quadraticCurveTo(ix+5,iy+4,ix+10,iy+4); ctx.stroke();   // a glint down one edge
    ctx.restore();
  }
}

function _drawHatCrown(cx,hatTopY,hatBrimY,tx,crownH){
  ctx.fillStyle='#020202';ctx.fillRect(cx-10+tx,hatTopY+1,21,crownH);
  ctx.fillStyle='#060608';ctx.fillRect(cx-10+tx,hatTopY,19,crownH);
  ctx.fillStyle='#0d0d10';ctx.fillRect(cx+7+tx,hatTopY+1,2,crownH-1);
  ctx.fillStyle='#0a0a0c';ctx.fillRect(cx-9+tx,hatTopY,17,2);
  ctx.fillStyle='#181818';ctx.fillRect(cx-8+tx,hatTopY,15,1);
  ctx.fillStyle='#030304';ctx.fillRect(cx-10+tx,hatBrimY-2,19,3);
  ctx.fillStyle='#161618';ctx.fillRect(cx-9+tx,hatBrimY-2,17,1);
}
function _drawHatBrim(brimL,brimR,hatBrimY,brimH){
  ctx.fillStyle='rgba(0,0,0,0.65)';ctx.fillRect(brimL+1,hatBrimY+4,brimR-brimL-1,3);
  ctx.fillStyle='#060608';ctx.fillRect(brimL,hatBrimY,brimR-brimL,brimH);
  ctx.fillStyle='#0e0e11';ctx.fillRect(brimL,hatBrimY,brimR-brimL,2);
  ctx.fillStyle='#181818';ctx.fillRect(brimL,hatBrimY,brimR-brimL,1);
  ctx.fillStyle='#040404';ctx.fillRect(brimL,hatBrimY+3,brimR-brimL,2);
  ctx.fillStyle='#040405';ctx.fillRect(brimL,hatBrimY+1,3,brimH-2);
  ctx.fillStyle='#0c0c0e';ctx.fillRect(brimR-4,hatBrimY+1,4,brimH-2);
}
// Paulo (Oct 21): MIND's hat is his logo — a long flat brim with slanted ends,
// a squared crown with a window cut in it (chamfered top-left / bottom-right),
// and the little spike under the brim at the crown's back wall. Units below
// are the logo's, as fractions of the brim width (origin: brim top, centre).
// dir: 1 = as drawn (MIND facing right), -1 mirrored. opt.front=false leaves
// the front brim off (Venture: a backwards cap).
function drawLogoHat(cx,brimY,Wd,dir,opt){
  opt=opt||{}; dir=dir<0?-1:1;
  const front=opt.front!==false;
  const X=u=>cx+dir*u*Wd;
  const brimT=opt.brimT||Math.max(3.5,0.0305*Wd), wall=opt.wall||Math.max(2.6,0.028*Wd), sl=Math.max(2,0.026*Wd);
  const crownH=opt.crownH||0.205*Wd, cL=-0.2127, cR=0.2134, chf=Math.max(1,0.013*Wd);
  const col=opt.col||'#050507', inner=opt.inner||'#1a1820', hi=opt.hi||'#4a4656';
  ctx.save();
  // shadow under the brim on the bulb
  if(!opt.noShadow){ const e0=X(-0.42), e1=X(front?0.42:cR); ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(Math.min(e0,e1),brimY+brimT,Math.abs(e1-e0),2.5); }
  // the brim: a parallelogram (top edge shifted toward the front)
  const bL=-0.5, bR=front?0.5:cR;
  ctx.fillStyle=col; ctx.beginPath();
  ctx.moveTo(X(bL)+dir*sl,brimY); ctx.lineTo(X(bR),brimY); ctx.lineTo(front?X(bR)-dir*sl:X(bR),brimY+brimT); ctx.lineTo(X(bL),brimY+brimT); ctx.closePath(); ctx.fill();
  // the spike under the brim, below the crown's back wall
  const sT=brimY+brimT-0.5, sB=brimY+brimT+Math.max(3,0.07*Wd);
  ctx.beginPath(); ctx.moveTo(X(-0.207),sT); ctx.lineTo(X(-0.148),sT); ctx.lineTo(X(-0.168),sB); ctx.lineTo(X(-0.181),sB); ctx.closePath(); ctx.fill();
  // the crown
  const top=brimY-crownH;
  ctx.beginPath(); ctx.moveTo(X(cL),brimY+0.5); ctx.lineTo(X(cL),top+chf); ctx.lineTo(X(cL)+dir*chf,top); ctx.lineTo(X(cR)-dir*chf,top); ctx.lineTo(X(cR),top+chf); ctx.lineTo(X(cR),brimY+0.5); ctx.closePath(); ctx.fill();
  // its window (open at the bottom onto the brim), chamfered top-left and bottom-right
  const iL=X(cL)+dir*wall, iR=X(cR)-dir*wall, iT=top+wall, k1=Math.max(2,0.06*Wd), k2=Math.max(2,0.05*Wd);
  ctx.fillStyle=inner; ctx.beginPath();
  ctx.moveTo(iL,brimY); ctx.lineTo(iL,iT+k1); ctx.lineTo(iL+dir*k1,iT); ctx.lineTo(iR,iT); ctx.lineTo(iR,brimY-k2); ctx.lineTo(iR-dir*k2,brimY); ctx.closePath(); ctx.fill();
  // a thin edge light around the whole silhouette so the black reads on a dark world (and on the bulb)
  ctx.strokeStyle=hi; ctx.lineWidth=1; ctx.lineJoin='miter';
  ctx.beginPath(); ctx.moveTo(X(cL),brimY); ctx.lineTo(X(cL),top+chf); ctx.lineTo(X(cL)+dir*chf,top); ctx.lineTo(X(cR)-dir*chf,top); ctx.lineTo(X(cR),top+chf); ctx.lineTo(X(cR),brimY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X(cL),brimY); ctx.lineTo(X(bL)+dir*sl,brimY); ctx.lineTo(X(bL),brimY+brimT); ctx.lineTo(X(-0.207),brimY+brimT);
  ctx.lineTo(X(-0.181),sB); ctx.lineTo(X(-0.168),sB); ctx.lineTo(X(-0.148),brimY+brimT);
  ctx.lineTo(front?X(bR)-dir*sl:X(bR),brimY+brimT); ctx.lineTo(X(bR),brimY); ctx.lineTo(X(cR),brimY); ctx.stroke();
  ctx.strokeStyle=hi; ctx.globalAlpha=0.7; ctx.beginPath();
  ctx.moveTo(iL,brimY); ctx.lineTo(iL,iT+k1); ctx.lineTo(iL+dir*k1,iT); ctx.lineTo(iR,iT); ctx.lineTo(iR,brimY-k2); ctx.lineTo(iR-dir*k2,brimY); ctx.stroke(); ctx.globalAlpha=1;
  ctx.restore();
}
function _hatDir(){ return (typeof p!=='undefined'&&p&&p.fc===false)?-1:1; }
function _drawMindWideHat(cx,drawY,R,hatTX,hatTY){
  const tx=Math.round((hatTX||0)*12);
  const ty=Math.round((hatTY||0)*9);
  const hatBrimY=drawY-R+3+ty;
  drawLogoHat(cx+tx,hatBrimY,80,window._hatDirOverride||_hatDir(),{crownH:15});   // the key art's wide flat brim
}
function _drawVentureCap(cx,drawY,R,hatTX,hatTY){
  const tx=Math.round((hatTX||0)*12);
  const ty=Math.round((hatTY||0)*9);
  const hatBrimY=drawY-R+3+ty;
  // Paulo (Oct 22, the key art): a red baseball cap worn backwards — the bill points behind him
  const dir=window._hatDirOverride||_hatDir(), X=u=>cx+tx+dir*u, by=hatBrimY+1;
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(cx+tx-15,by+1,30,2.5);
  // the bill, behind
  ctx.fillStyle='#000'; ctx.beginPath(); ctx.moveTo(X(-10),by-3); ctx.lineTo(X(-29),by+1); ctx.lineTo(X(-28),by+3.5); ctx.lineTo(X(-9),by+1); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#b01828'; ctx.beginPath(); ctx.moveTo(X(-10),by-2.2); ctx.lineTo(X(-27.5),by+1.2); ctx.lineTo(X(-26.8),by+2.6); ctx.lineTo(X(-9.5),by+0.2); ctx.closePath(); ctx.fill();
  // the crown (a dome)
  ctx.fillStyle='#000'; ctx.beginPath(); ctx.moveTo(X(-16),by+1); ctx.quadraticCurveTo(X(-15),by-17,X(0),by-17); ctx.quadraticCurveTo(X(15),by-17,X(16),by+1); ctx.closePath(); ctx.fill();
  const g=ctx.createLinearGradient(X(-12),by-15,X(12),by); g.addColorStop(0,'#ff4a52'); g.addColorStop(0.55,'#d01e2e'); g.addColorStop(1,'#7a0a16');
  ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(X(-14.5),by); ctx.quadraticCurveTo(X(-13.5),by-15.5,X(0),by-15.5); ctx.quadraticCurveTo(X(13.5),by-15.5,X(14.5),by); ctx.closePath(); ctx.fill();
  // panel seams, the button, the strap opening at the front (the cap's back) with its snaps
  ctx.strokeStyle='rgba(60,0,8,0.6)'; ctx.lineWidth=0.8; ctx.beginPath(); ctx.moveTo(X(0),by-15.5); ctx.quadraticCurveTo(X(-6),by-8,X(-6),by); ctx.moveTo(X(0),by-15.5); ctx.quadraticCurveTo(X(6),by-8,X(6),by); ctx.stroke();
  ctx.fillStyle='#ff6a72'; ctx.fillRect(X(0)-1.5,by-17,3,2);
  ctx.fillStyle='#14060a'; ctx.beginPath(); ctx.moveTo(X(5),by); ctx.quadraticCurveTo(X(9),by-7,X(13.5),by-5); ctx.lineTo(X(14),by); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#e0e0e8'; for(const u of [6.5,9,11.5]) ctx.fillRect(X(u)-0.5,by-1.2,1,1);
  ctx.fillStyle='rgba(255,200,200,0.45)'; ctx.fillRect(X(-9),by-12,dir*6,1.2);
  ctx.restore();
}

/* -- Lightbulb head â€” glass, iris, wide hat -- */
function drawHead(cx,cy,pupilX,pupilY,ca2=0,hero='mind',peek=0,charge=null,hatTX=0,hatTY=0,landTuck=0,unifiedHat=false,hostile=false){
  cx|=0;
  const drawY=(cy|0)-Math.round(peek*11);
  const R=Math.round(14-ca2*3-landTuck*2);
  const ch=charge||{chargeFrac:0,ready:false};
  const cg=Math.max(0,Math.min(1,ch.chargeFrac||0));
  const lampReady=!!ch.ready;
  const pulse=hostile?0.55+Math.sin(fr*0.14)*0.45:0;
  if(hostile&&pulse>0.25){
    ctx.beginPath();ctx.ellipse(cx,drawY,R+4+pulse*5,R+5+pulse*6,0,0,Math.PI*2);
    ctx.fillStyle=pulse>0.7?'rgba(255,80,60,0.45)':'rgba(255,120,60,0.28)';
    ctx.fill();
  }
  if(lampReady&&!hostile){
    const lp=0.55+Math.sin(fr*0.2)*0.25;
    ctx.beginPath();ctx.ellipse(cx,drawY+1,11,10,0,0,Math.PI*2);
    ctx.fillStyle=`rgba(220,255,230,${0.22+lp*0.35})`;
    ctx.fill();
  }
  const isVen=!hostile&&hero==='venture';
  // pass 4 (Oct 22): the glowing green glass bulb of the key art (the mirror enemy keeps dark red glass)
  if(isFinite(cx)&&isFinite(drawY)){
    // Paulo (Oct 22, the key art): clear glass with a violet (MIND) / rose (VENTURE) glow
    const gl=hostile?['rgba(255,70,50,','#3a1210','#200808','#5a1a14']:isVen?['rgba(255,70,90,','#f0c8d4','#9a5a70','#4a1a2a']:['rgba(170,110,255,','#e2d6ff','#8a70c8','#3a2a6a'];
    const halo=ctx.createRadialGradient(cx,drawY,R*0.6,cx,drawY,R+9);
    halo.addColorStop(0,gl[0]+(hostile?0.0:0.30)+')'); halo.addColorStop(1,gl[0]+'0)');
    ctx.fillStyle=halo; ctx.beginPath(); ctx.ellipse(cx,drawY,R+9,R+10,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath();ctx.ellipse(cx,drawY,R+1.5,R+3.5,0,0,Math.PI*2);ctx.fillStyle=hostile?'rgba(4,14,8,0.85)':'rgba(6,4,14,0.85)';ctx.fill();   // dark outline
    const bg=ctx.createRadialGradient(cx-R*0.3,drawY-R*0.35,1,cx,drawY+1,R+2);
    bg.addColorStop(0,gl[1]); bg.addColorStop(0.55,gl[2]); bg.addColorStop(1,gl[3]);
    ctx.beginPath();ctx.ellipse(cx,drawY,R,R+2,0,0,Math.PI*2);ctx.fillStyle=bg;ctx.fill();
    // filament glow ring behind the eye
    ctx.beginPath();ctx.ellipse(cx,drawY+2,11.5,10.5,0,0,Math.PI*2);ctx.fillStyle=hostile?'rgba(255,90,60,0.18)':isVen?'rgba(255,120,140,0.3)':'rgba(190,150,255,0.32)';ctx.fill();
  }

  let scleraCol=hostile?'#e87878':(isVen?'#e8d0d0':'#d0d4dc');
  if(lampReady&&!hostile) scleraCol=`rgb(${200+Math.round(Math.sin(fr*0.2)*30)},255,${210+Math.round(Math.sin(fr*0.17)*25)})`;
  let irisCol=hostile?'#882018':(isVen?'#e02a3c':'#9a4cff');
  let irisDark=hostile?'#5a1010':(isVen?'#6a0a18':'#4a1a9a');
  if(!hostile&&cg>0.05){
    const g=cg;
    irisCol=_mixHex(isVen?'#e02a3c':'#9a4cff','#28a050',g);
    irisDark=_mixHex(isVen?'#6a0a18':'#4a1a9a','#184820',g);
    if(lampReady){ irisCol='#38c868'; irisDark='#1a6838'; }
  }
  // Paulo (Oct 21): hurt, the eye goes red and veiny — more the lower his HP.
  // GORE: already mad, even at full health.
  const goreFace=!!(window.MV_CONSOLE&&MV_CONSOLE.mode==='gore');
  let hd=!hostile?Math.min(1,window._mindHeadDmg||0):0;
  if(goreFace){ hd=Math.max(hd,hostile?0.7:0.9); scleraCol='#f4c8c8'; irisCol='#b00018'; irisDark='#3a0008'; }
  if(hd>0.02) scleraCol=_mixHex(scleraCol.charAt(0)==='#'?scleraCol:'#d0d4dc','#e86a6a',Math.min(1,hd*0.9));
  const eyeRy=goreFace?5.4:9;
  ctx.beginPath();ctx.ellipse(cx,drawY+2,10,eyeRy,0,0,Math.PI*2);ctx.fillStyle=scleraCol;ctx.fill();
  if(hd>0.08){
    const n=Math.round(2+hd*9);
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx,drawY+2,10,9,0,0,Math.PI*2); ctx.clip();
    ctx.strokeStyle='rgba(150,10,20,'+(0.45+0.5*hd).toFixed(2)+')'; ctx.lineCap='round';
    for(let i=0;i<n;i++){
      const a=i/n*Math.PI*2+0.4, r0=9.5, r1=5.2+((i*37)%5)*0.3;
      ctx.lineWidth=i%3===0?1.1:0.7;
      ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*r0,drawY+2+Math.sin(a)*r0*0.9);
      const mx=cx+Math.cos(a+0.25*((i%2)?1:-1))*(r0+r1)/2, my=drawY+2+Math.sin(a+0.25*((i%2)?1:-1))*(r0+r1)/2*0.9;
      ctx.lineTo(mx,my); ctx.lineTo(cx+Math.cos(a)*r1,drawY+2+Math.sin(a)*r1*0.9);
      if(i%3===0){ ctx.moveTo(mx,my); ctx.lineTo(mx+Math.cos(a+1.3)*1.8,my+Math.sin(a+1.3)*1.8); }   // a branch
      ctx.stroke();
    }
    if(hd>0.6){ const g=ctx.createRadialGradient(cx,drawY+2,4,cx,drawY+2,10); g.addColorStop(0,'rgba(200,20,30,0)'); g.addColorStop(1,'rgba(200,20,30,'+(0.35*(hd-0.6)/0.4).toFixed(2)+')'); ctx.fillStyle=g; ctx.fillRect(cx-11,drawY-8,22,20); }
    ctx.restore();
  }
  const iRy=goreFace?3.2:6, iDy=goreFace?3.4:5;
  ctx.beginPath();ctx.ellipse(cx,drawY+3,6,iRy,0,0,Math.PI*2);ctx.fillStyle=irisCol;ctx.fill();
  ctx.beginPath();ctx.ellipse(cx,drawY+3,5,iDy,0,0,Math.PI*2);ctx.fillStyle=irisDark;ctx.fill();
  if(goreFace){
    ctx.strokeStyle='#1a0608'; ctx.lineWidth=1.6; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(cx-9,drawY-eyeRy-1); ctx.lineTo(cx-1,drawY-eyeRy+2); ctx.moveTo(cx+9,drawY-eyeRy-1); ctx.lineTo(cx+1,drawY-eyeRy+2); ctx.stroke();
  }
  ctx.beginPath();ctx.ellipse(cx,drawY+2,5.5,5.5,0,0,Math.PI*2);
  ctx.strokeStyle=goreFace?'#ff3040':(hostile?'#cc4040':(cg>0.05?'#48c878':(isVen?'#ff6a7a':'#c49aff')));ctx.lineWidth=1;ctx.stroke();
  const px=cx+pupilX,py=drawY+2+pupilY;
  ctx.beginPath();ctx.arc(px,py,3.5,0,Math.PI*2);ctx.fillStyle='#03030e';ctx.fill();
  ctx.beginPath();ctx.arc(px-1.2,py-1.2,1.4,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.9)';ctx.fill();
  // glass specular: a bright crescent top-left and a pixel glint
  ctx.save(); ctx.beginPath(); ctx.ellipse(cx,drawY,R,R+2,0,0,Math.PI*2); ctx.clip();
  ctx.strokeStyle=hostile?'rgba(255,200,190,0.35)':'rgba(230,255,235,0.55)'; ctx.lineWidth=2; ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(cx,drawY,R-2.5,Math.PI*1.08,Math.PI*1.42); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.fillRect(cx-R*0.62,drawY-R*0.55,2,2);
  ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(cx,drawY+1,R-1,Math.PI*0.1,Math.PI*0.6); ctx.stroke();
  ctx.restore();
  // ...and the glass bulb cracks: more cracks for every bit of HP lost (fixed paths, no flicker)
  if(hd>0.15){
    const CR=[[[-0.9,-0.5],[-0.45,-0.2],[-0.55,0.15],[-0.2,0.35]],[[0.75,-0.75],[0.4,-0.35],[0.55,-0.05]],[[0.95,0.2],[0.55,0.3],[0.45,0.65],[0.15,0.8]],
              [[-0.3,-1],[-0.15,-0.6],[0.1,-0.55],[0.05,-0.25]],[[-0.95,0.45],[-0.6,0.55],[-0.5,0.9]],[[0.2,1],[0.35,0.7],[0.7,0.6]],[[-0.6,-0.85],[-0.35,-0.75],[-0.4,-0.45]]];
    const k=Math.min(CR.length,Math.ceil((hd-0.15)/0.85*CR.length));
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx,drawY,R,R+2,0,0,Math.PI*2); ctx.clip(); ctx.lineJoin='round'; ctx.lineCap='round';
    for(let i=0;i<k;i++){
      const pts=CR[i].map(q=>[cx+q[0]*R,drawY+q[1]*(R+2)]);
      for(const [col,w,o] of [['rgba(0,0,0,0.55)',2,0.6],['rgba(225,235,255,0.85)',0.9,0]]){
        ctx.strokeStyle=col; ctx.lineWidth=w; ctx.beginPath(); ctx.moveTo(pts[0][0]+o,pts[0][1]+o); for(let j=1;j<pts.length;j++) ctx.lineTo(pts[j][0]+o,pts[j][1]+o); ctx.stroke();
      }
    }
    ctx.restore();
  }
  // Paulo (Oct 22): the eye finds the nearest enemy. Closer = a higher bottom lid.
  // Danger in the radius pulls the top lid down, slanted, so a hard fight looks angry.
  if(!hostile&&p&&((p._eyeBot||0)>0.03||(p._eyeTop||0)>0.03)){
    const bot=Math.max(0,Math.min(1,p._eyeBot||0)), top=Math.max(0,Math.min(1,p._eyeTop||0));
    const slant=Math.max(-1,Math.min(1,p._eyeSlant||0));
    const ey=drawY+2, rx=10, ry=9, tan=Math.tan(Math.max(-0.8,Math.min(0.8,slant))*0.42);
    const fill=isVen?'#14060a':'#0c0618', rim=isVen?'#c46070':'#9a7ae0';
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx,ey,rx,ry,0,0,Math.PI*2); ctx.clip();
    const edge=(yL,yR)=>{ ctx.strokeStyle=rim; ctx.lineWidth=1.3; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(cx-rx+1,yL); ctx.lineTo(cx+rx-1,yR); ctx.stroke(); };
    if(top>0.03){
      const mid=ey-ry+top*ry*0.6, yL=mid+(-rx)*tan, yR=mid+rx*tan;   // never shut: a slit stays open over the pupil
      ctx.beginPath(); ctx.moveTo(cx-rx-2,ey-ry-8); ctx.lineTo(cx+rx+2,ey-ry-8); ctx.lineTo(cx+rx+2,yR); ctx.lineTo(cx-rx-2,yL); ctx.closePath();
      ctx.fillStyle=fill; ctx.fill(); edge(yL,yR);
    }
    if(bot>0.03){
      const mid=ey+ry-bot*ry*0.5, yL=mid-(-rx)*tan*0.3, yR=mid-rx*tan*0.3;   // the lower lid rises flatter (the squint), the top one carries the anger
      ctx.beginPath(); ctx.moveTo(cx-rx-2,ey+ry+8); ctx.lineTo(cx+rx+2,ey+ry+8); ctx.lineTo(cx+rx+2,yR); ctx.lineTo(cx-rx-2,yL); ctx.closePath();
      ctx.fillStyle=fill; ctx.fill(); edge(yL,yR);
    }
    ctx.restore();
  }
  const baseY=drawY+R+1;
  ctx.fillStyle='#7a8290';ctx.fillRect(cx-12,baseY,24,6);
  ctx.fillStyle='#8a929e';ctx.fillRect(cx-11,baseY+1,22,4);
  for(let i=0;i<3;i++){ctx.fillStyle='#4e5660';ctx.fillRect(cx-12,baseY+1.5+i*1.5,24,0.8);}
  ctx.fillStyle='#5a6270';ctx.fillRect(cx-14,baseY+5,28,4);
  ctx.fillStyle='#6a7280';ctx.fillRect(cx-13,baseY+6,26,2.5);
  if(hostile&&window._mirrorHat) _drawMindWideHat(cx,drawY,R,0,0);   // the mirror enemy wears MIND's own hat
  if(!hostile){
    const htx=unifiedHat?0:hatTX, hty=unifiedHat?0:hatTY;
    if(hero==='venture') _drawVentureCap(cx,drawY,R,htx,hty);
    else _drawMindWideHat(cx,drawY,R,htx,hty);
  }
}

/* Energy packets along shoulder â†’ elbow â†’ tip (push=outward, pull=inward). */
function drawArmEnergyFlow(x0,y0,x1,y1,x2,y2,useElbow,mode){
  if(!mode) return;
  const pts=useElbow?[{x:x0,y:y0},{x:x1,y:y1},{x:x2,y:y2}]:[{x:x0,y:y0},{x:x2,y:y2}];
  const segs=[]; let total=0;
  for(let i=0;i<pts.length-1;i++){
    const len=Math.hypot(pts[i+1].x-pts[i].x,pts[i+1].y-pts[i].y);
    segs.push({a:pts[i],b:pts[i+1],len,off:total});
    total+=len;
  }
  if(total<4) return;
  const toTip=mode===2;
  const isVen=p&&p.hero==='venture';
  const col=toTip?'#66bbff':(isVen?'#ff6688':'#dd88ff');
  const core=toTip?'#aaddff':(isVen?'#ffb0b8':'#f0b8ff');
  const pulse=0.45+0.55*Math.sin(fr*0.3);
  ctx.save();
  ctx.globalAlpha=0.22*pulse;
  ctx.strokeStyle=core;ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
  for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
  ctx.stroke();
  const n=8;
  for(let i=0;i<n;i++){
    let dist=((fr*0.085+i/n)*(toTip?1:-1)*total)%total;
    if(dist<0) dist+=total;
    for(const s of segs){
      if(dist<s.off||dist>=s.off+s.len) continue;
      const t=(dist-s.off)/s.len;
      const px=s.a.x+(s.b.x-s.a.x)*t, py=s.a.y+(s.b.y-s.a.y)*t;
      const ang=Math.atan2(s.b.y-s.a.y,s.b.x-s.a.x);
      const alpha=(0.4+0.6*Math.sin(fr*0.38+i*1.15))*pulse;
      ctx.globalAlpha=alpha;
      ctx.fillStyle=core;
      ctx.beginPath();ctx.arc(px,py,2.8,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=alpha*0.5;
      ctx.strokeStyle=col;ctx.lineWidth=2;
      const tl=toTip?14:-14;
      ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+Math.cos(ang)*tl,py+Math.sin(ang)*tl);ctx.stroke();
      break;
    }
  }
  ctx.globalAlpha=1;ctx.restore();
}

/* -- Coiled cable â€” curved bezier coils -- */
// The jack arm as a coiled spring (Paulo's RCA sketches, Oct 21): a fixed number of
// turns, so a short arm is tight loops and a stretched one pulls the loops open.
function drawSpringCoil(sx0,sy0,angle,len,col1,col2){
  if(len<1) return;
  const N=5, b=6, a=len/(2*Math.PI*N), steps=N*14;
  ctx.save(); ctx.translate(sx0,sy0); ctx.rotate(angle); ctx.lineCap='round'; ctx.lineJoin='round';
  const path=()=>{ ctx.beginPath(); for(let i=0;i<=steps;i++){ const th=i/steps*N*2*Math.PI, x=a*th+b*(Math.cos(th)-1)*0.8, y=b*Math.sin(th); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); } };
  path(); ctx.strokeStyle=col1; ctx.lineWidth=6; ctx.stroke();
  path(); ctx.strokeStyle=col2; ctx.lineWidth=3.2; ctx.stroke();
  ctx.restore();
}
function drawCoil(sx0,sy0,angle,len,col1,col2,shine,flowMode=0){
  if(len<1) return;
  const shineCol=shine||'rgba(120,80,200,0.15)';
  ctx.save();ctx.translate(sx0,sy0);ctx.rotate(angle);
  const n=4,sl=len/n;
  for(let i=0;i<n;i++){
    const cx2=i*sl+sl/2;
    ctx.beginPath();ctx.arc(cx2,0,6,Math.PI,0,i%2===0);
    ctx.strokeStyle=col1;ctx.lineWidth=10;ctx.stroke();
    ctx.beginPath();ctx.arc(cx2,0,6,Math.PI,0,i%2===0);
    ctx.strokeStyle=col2;ctx.lineWidth=6;ctx.stroke();
    ctx.beginPath();ctx.arc(cx2+(i%2===0?-2:2),i%2===0?-3:3,4,Math.PI,0,i%2===0);
    ctx.strokeStyle=shineCol;ctx.lineWidth=1.5;ctx.stroke();
  }
  if(flowMode===2||flowMode===3){
    const toTip=flowMode===2;
    const dormCol=toTip?'#5599dd':'#bb77ee';
    const hotCol=toTip?'#88ddff':'#ee99ff';
    for(let i=0;i<n;i++){
      const cx2=i*sl+sl/2;
      const wob=Math.sin(fr*0.19+cx2*0.11+i)*2.2;
      const pulse=0.28+0.22*Math.sin(fr*0.24+i*0.9);
      ctx.globalAlpha=pulse;
      ctx.strokeStyle=dormCol;ctx.lineWidth=2.8;
      ctx.beginPath();ctx.arc(cx2,wob,8,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=pulse*0.65;ctx.strokeStyle=hotCol;ctx.lineWidth=1.4;
      ctx.beginPath();ctx.arc(cx2,wob,5,0,Math.PI*2);ctx.stroke();
    }
    for(let i=0;i<6;i++){
      const phase=((fr*0.09+i*0.17)%1);
      const t=toTip?phase:(1-phase);
      const px=t*len;
      const pulse=0.5+0.5*Math.sin(fr*0.35+i*1.1);
      ctx.globalAlpha=0.4+pulse*0.5;
      ctx.fillStyle=hotCol;
      ctx.beginPath();ctx.arc(px,0,3,0,Math.PI*2);ctx.fill();
      const trail=toTip?12:-12;
      ctx.globalAlpha*=0.55;ctx.strokeStyle=toTip?'#66bbff':'#dd88ff';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(px,0);ctx.lineTo(px+trail,0);ctx.stroke();
    }
    ctx.globalAlpha=1;
  }
  ctx.restore();
}

/* -- Connector shapes at arm tip (sketch: purple cable, gold/chrome, red mag) -- */
function _connPx(x,y,w,h,col){ ctx.fillStyle=col; ctx.fillRect(x,y,w,h); }
function _connOval(x,y,rx,ry,col){ ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=col;ctx.fill(); }
function _drawGreenVeins(veins){
  const pulse=0.5+0.5*Math.sin(fr*0.28);
  const flow=(fr*0.42)%1;
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  ctx.lineCap='round';ctx.lineJoin='round';
  for(let v=0;v<veins.length;v++){
    const pts=veins[v];
    if(!pts||pts.length<2) continue;
    ctx.strokeStyle='#2ee86a';
    ctx.lineWidth=1.15;
    ctx.globalAlpha=0.28+pulse*0.42;
    ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);
    for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]);
    ctx.stroke();
    ctx.strokeStyle='#b6ffd0';
    ctx.lineWidth=0.55;
    ctx.globalAlpha=0.45+pulse*0.4;
    ctx.stroke();
    const t=(flow+v*0.34)%1;
    const seg=Math.min(pts.length-2,Math.floor(t*(pts.length-1)));
    const u=t*(pts.length-1)-seg;
    const vx=pts[seg][0]+(pts[seg+1][0]-pts[seg][0])*u;
    const vy=pts[seg][1]+(pts[seg+1][1]-pts[seg][1])*u;
    ctx.globalAlpha=0.85;
    ctx.fillStyle='#3dff88';
    ctx.beginPath();ctx.arc(vx,vy,2.0,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=0.95;
    ctx.fillStyle='#e8ffe8';
    ctx.beginPath();ctx.arc(vx,vy,1.0,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
function _itemTipEnhanced(itemIdx, override){
  if(override!=null) return !!override;
  return typeof _itemEnhanced!=='undefined'&&!!_itemEnhanced[itemIdx];
}
function drawConnectorTip(cx,cy,aimAngle,flash,itemOverride,enhancedOverride){
  const itemIdx=itemOverride!=null?itemOverride:ITEM;
  const enh=_itemTipEnhanced(itemIdx, enhancedOverride);
  const sc=typeof _itemArtScale==='function'?_itemArtScale(itemIdx):1;
  ctx.save();ctx.translate(cx,cy);
  ctx.rotate(aimAngle);
  ctx.scale(sc,sc);
  const ff=flash/9;

  if(itemIdx===0){
    // TRS: black/grey barrel, gold contacts (standard + enhanced)
    _connPx(-20,-3,10,6,'#101012');
    _connPx(-20,-2,10,2,'#2a2a30');
    _connPx(-10,-5,12,10,'#0c0c10');
    _connPx(-9,-4,11,3,'#2a2a32');
    _connPx(-8,2,9,2,'#08080c');
    _connPx(2,-4,17,8,'#3a3a42');
    _connPx(2,-4,17,2,'#6a6a74');
    _connPx(2,2,17,2,'#1c1c22');
    _connPx(19,-3.6,8,7.2,'#c9a227');
    _connPx(19,-3.6,8,2,'#f3dc9a');
    _connPx(27,-4.2,2.4,8.4,'#0a0a0f');
    _connPx(29.4,-3.2,7,6.4,'#d4aa40');
    _connPx(29.4,-3.2,7,1.8,'#fff0b8');
    _connPx(36.4,-4.2,2.4,8.4,'#0a0a0f');
    _connPx(38.8,-2.8,6,5.6,'#e2b64a');
    ctx.beginPath();ctx.moveTo(44.8,-3);ctx.lineTo(51.5,0);ctx.lineTo(44.8,3);ctx.closePath();
    ctx.fillStyle='#e2b64a';ctx.fill();
    ctx.fillStyle='#fff6c8';ctx.fillRect(45.5,-1.2,4,1.4);
    if(enh){
      _drawGreenVeins([
        [[-16,-1.2],[-8,-0.4],[2,1.2],[12,-1.0],[22,0.8],[32,-0.6],[44,0.4],[50.5,0]],
        [[-14,1.6],[-6,0.4],[4,2.0],[14,0.2],[24,1.8],[34,0.4],[46,-0.6]],
        [[-10,-2.2],[0,-0.8],[10,1.4],[20,-1.8],[30,1.0],[40,-0.8],[49,0.3]],
      ]);
    }
    if(ff>0){ctx.globalAlpha=ff*0.85;ctx.fillStyle=enh?'#66ff99':'#ffe080';ctx.beginPath();ctx.arc(50,0,8+ff*7,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
    if(p&&p.laserCharging&&p.laserCharge>0&&(itemOverride==null||itemOverride===ITEM)){
      const cMax=(typeof _itemEnhanced!=='undefined'&&_itemEnhanced[0])?22:40;
      const cf=p.laserCharge/cMax;
      const pulse=0.7+0.3*Math.sin(fr*0.55+cf*8);
      const isVen=p.hero==='venture';
      ctx.globalAlpha=cf*pulse*0.82;
      ctx.fillStyle=cf>0.55?'#ffffff':(isVen?'#ff4466':'#bb55ff');
      ctx.beginPath();ctx.arc(50,0,5+cf*15,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=cf*pulse;
      ctx.strokeStyle=isVen?'#ff88aa':'#cc88ff';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(50,0,9+cf*11,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=1;
    }

  }else if(itemIdx===1){
    // RCA: housing reads at TRS scale; gold pin is the tell
    _connPx(-18,-4,12,8,'#1a1a20');
    _connPx(-18,-2,12,2,'#3a3a42');
    _connPx(-6,-9,24,18,'#2c2c32');
    _connPx(-5,-8,22,4,'#4a4a54');
    _connPx(-5,5,22,3,'#141418');
    for(let r=0;r<5;r++) _connPx(-4+r*4.2,-9,1.5,18,'#121216');
    _connPx(18,-8,10,16,'#5a5e66');
    _connPx(18,-8,10,4,'#8a8e96');
    _connPx(18,4,10,4,'#2a2e34');
    _connPx(20,-4,6,8,'#1a1c22');
    _connPx(28,-2.4,16,4.8,'#d4aa40');
    _connPx(28,-2.4,16,1.6,'#fff0b8');
    ctx.beginPath();ctx.arc(44.5,0,2.6,0,Math.PI*2);ctx.fillStyle='#e2b64a';ctx.fill();
    if(enh){
      _drawGreenVeins([
        [[-14,-0.8],[-2,1.4],[10,-1.2],[22,1.0],[34,-0.4],[44,0.2]],
        [[-12,2.4],[0,0.4],[12,2.6],[24,0.6],[36,1.2],[43,0.4]],
        [[-10,-3.0],[4,0.8],[16,-2.0],[28,1.0],[40,-0.6],[44.5,0]],
      ]);
    }
    if(ff>0){ctx.globalAlpha=ff*0.85;ctx.fillStyle=enh?'#66ff99':'#c8c8d0';ctx.beginPath();ctx.arc(44,0,8+ff*7,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}

  }else if(itemIdx===2){
    // XLR male plug, side view: rubber boot → black grip barrel → round silver
    // shell whose rounded nose hides the three pins (only their tips peek out).
    const rr=(x,y,w,h,r,fill)=>{ ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fillStyle=fill; ctx.fill(); };
    // boot (tapers into the coil)
    ctx.beginPath(); ctx.moveTo(-20,-3.5); ctx.lineTo(-6,-6.5); ctx.lineTo(-6,6.5); ctx.lineTo(-20,3.5); ctx.closePath(); ctx.fillStyle='#101012'; ctx.fill();
    for(let i=0;i<4;i++) _connPx(-17+i*3.2,-4.5+i*0.5,1,9-i*1,'#1e1e24');
    // grip barrel with a soft highlight
    const gb=ctx.createLinearGradient(0,-8,0,8); gb.addColorStop(0,'#5a5e68'); gb.addColorStop(0.3,'#30343c'); gb.addColorStop(1,'#14161a');
    rr(-7,-8,27,16,4,gb);
    for(let k=0;k<5;k++) _connPx(-3+k*4.2,-7.4,1.1,14.8,'rgba(0,0,0,0.35)');
    rr(4,-9.6,9,3,1.4,'#8a8e96');                    // latch button
    _connPx(5,-9.6,7,1,'#c8ccd4');
    // round silver shell
    const sg=ctx.createLinearGradient(0,-8.5,0,8.5); sg.addColorStop(0,'#f0f2f6'); sg.addColorStop(0.35,'#b8bcc6'); sg.addColorStop(0.7,'#7a7e88'); sg.addColorStop(1,'#4a4e56');
    rr(18,-8.5,26,17,[2,8,8,2],sg);
    ctx.strokeStyle='rgba(30,32,40,0.6)'; ctx.lineWidth=0.8; ctx.beginPath(); ctx.moveTo(21,-8); ctx.lineTo(21,8); ctx.stroke();
    // the open front: a dark mouth, rounded, with the three pin tips
    ctx.beginPath(); ctx.ellipse(43,0,2.2,6.4,0,0,Math.PI*2); ctx.fillStyle='#16181e'; ctx.fill();
    const fx=43;
    [[-3.4],[0],[3.4]].forEach(([py2])=>{ ctx.beginPath(); ctx.arc(44.2,py2,1.05,0,Math.PI*2); ctx.fillStyle='#e8d8a0'; ctx.fill(); });
    _connPx(24,-6.8,16,1.2,'rgba(255,255,255,0.55)');   // shine
    if(enh){
      _drawGreenVeins([
        [[-16,-1.0],[-6,1.2],[4,-1.4],[14,1.0],[24,-0.6],[34,0.8],[fx,0]],
        [[-14,2.0],[-4,-0.4],[8,2.4],[18,0.2],[28,1.6],[fx,-2.8]],
        [[-10,-3.2],[2,0.6],[12,-2.2],[22,1.4],[32,-1.0],[fx,3.2]],
      ]);
    }
    if(p&&p.xlrOn&&(itemOverride==null||itemOverride===ITEM)){
      const pulse=0.5+0.5*Math.sin(fr*0.32);
      ctx.globalAlpha=pulse*0.55;
      for(let i=0;i<3;i++){
        const wave=((fr*0.1+i*0.28)%1);
        ctx.strokeStyle='#aaddff';ctx.lineWidth=1.2;
        ctx.beginPath();ctx.ellipse(fx,0,6+wave*7,8+wave*5,0,-0.55,0.55);ctx.stroke();
      }
      ctx.globalAlpha=1;
    }
    if(ff>0){ctx.globalAlpha=ff*0.85;ctx.fillStyle='#4466ff';ctx.beginPath();ctx.ellipse(fx,0,6+ff*4,8+ff*5,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}

  }else{
    // MAG — black/grey horseshoe, silver poles
    const halfG=7, prongL=24, w=enh?8:7;
    ctx.lineCap='round';ctx.lineJoin='round';
    ctx.lineWidth=w+2;
    ctx.strokeStyle='#121214';
    ctx.beginPath();
    ctx.moveTo(prongL, -halfG); ctx.lineTo(0, -halfG);
    ctx.arc(0, 0, halfG, -Math.PI/2, Math.PI/2, true);
    ctx.lineTo(prongL, halfG); ctx.stroke();
    ctx.lineWidth=w;
    ctx.strokeStyle='#3a3a42';
    ctx.beginPath();
    ctx.moveTo(prongL-2, -halfG); ctx.lineTo(1, -halfG);
    ctx.arc(0, 0, halfG, -Math.PI/2, Math.PI/2, true);
    ctx.lineTo(prongL-2, halfG); ctx.stroke();
    ctx.lineWidth=2.4;
    ctx.strokeStyle='#7a7e86';
    ctx.beginPath();
    ctx.moveTo(prongL-4, -halfG+1.4); ctx.lineTo(4, -halfG+1.4); ctx.stroke();
    [[prongL,-halfG],[prongL,halfG]].forEach(([tx,ty])=>{
      ctx.fillStyle='#6a6e76';ctx.fillRect(tx-2,ty-4,8,8);
      ctx.fillStyle='#b0b4bc';ctx.fillRect(tx-1,ty-4,8,3);
      ctx.fillStyle='#2a2e34';ctx.fillRect(tx-1,ty+2,8,2);
    });
    if(enh){
      _drawGreenVeins([
        [[prongL-2,-halfG],[-1,-halfG],[-halfG,0],[-1,halfG],[prongL-2,halfG]],
        [[prongL-6,-halfG+2],[2,-halfG+2],[-halfG+3,0],[2,halfG-2],[prongL-6,halfG-2]],
      ]);
    }
  }
  ctx.restore();
}

// Paulo (Oct 21): a punch only lands if nothing solid is between MIND's shoulder
// and the target. The segment is sampled; a solid cell inside the target's own
// box (a cube's own cell) doesn't count as a wall.
function _punchReach(x0,y0,x1,y1,box){
  if(typeof gridWorldSolid!=='function') return true;
  const n=Math.max(2,Math.ceil(Math.hypot(x1-x0,y1-y0)/6));
  for(let i=1;i<=n;i++){
    const x=x0+(x1-x0)*i/n, y=y0+(y1-y0)*i/n;
    if(box&&x>=box.x-1&&x<=box.x+box.w+1&&y>=box.y-1&&y<=box.y+box.h+1) return true;   // reached the target first
    if(gridWorldSolid(x,y)) return false;
  }
  return true;
}
/* -- Boxing glove arm (right) --
   Rendering uses vector connector art; the punch hit-check below runs in
   WORLD coordinates with the exact original reach values. */
function drawGloveArm(sxp,syp,facing,shWX,shWY,hidden){
  // Paulo (Oct 21): the glove never goes into a wall — the guard tucks toward the body if
  // its fist would be in rock (punches are stopped at the wall below)
  if(typeof _armSolid==='function'&&!(p.pt>0)){
    const fd=facing?1:-1, fx=shWX+fd*22, fy=shWY+14;
    if(_armSolid(fx,fy)||_armSolid(fx+fd*8,fy)) facing=!facing;
  }
  const isVenture=p.hero==='venture';
  const armCol1=isVenture?C.MAROON:C.PURPLE_D;
  const armCol2=isVenture?C.RED_D:C.INDIGO;
  const punching   = p.pt > 0;
  const charging   = p.pCharging;
  const HP = typeof _heroPunch==='function' ? _heroPunch(p) : {dmg:15,reach:28,loadF:20,loadDmg:35,loadReach:58};
  const chargeFrac = Math.min((p.pCharge||0)/HP.loadF, 1);
  const recoilFrac = p._pRecoil>0?(p._pRecoil/10):0;
  const snapFrac   = punching ? (1 - p.pt/10) : (recoilFrac>0 ? -recoilFrac*0.5 : 0);
  const fwdDir     = facing ? 1 : -1;

  // â”€â”€ Two fixed segments for the L (world units) â”€â”€â”€â”€â”€â”€â”€
  const seg1Len = 14;
  const guardFwd = 12;
  const isChargedHook = (p.pCharge||0)>HP.loadF || (punching && p.pCd>4);
  const punchFwd = isChargedHook ? HP.loadReach : HP.reach;
  const armShine=isVenture?'rgba(200,80,80,0.15)':'rgba(120,80,200,0.15)';
  // Paulo (Oct 22): switching items while hooked, this hand pulls the RCA off the other arm
  // and plugs it into the top back of the box, elbow arched up over the head (beta_feel.js)
  const GR=(!punching&&!hidden&&window.MV_BETA&&MV_BETA.gloveReach)?MV_BETA.gloveReach(shWX,shWY):null;
  if(GR){
    const exs=sx(GR.ex), eys=sy(GR.ey), hxs=sx(GR.hx), hys=sy(GR.hy);
    drawCoil(sxp,syp,Math.atan2(eys-syp,exs-sxp),Math.hypot(exs-sxp,eys-syp),armCol1,armCol2,armShine);
    drawCoil(exs,eys,Math.atan2(hys-eys,hxs-exs),Math.hypot(hxs-exs,hys-eys),armCol1,armCol2,armShine);
    drawFist(hxs,hys,hxs>=sxp,false,0,false,0);
    return;
  }

  if(!punching){
    // â”€â”€ GUARD POSE â€” hard L shape â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const s1=Math.round(seg1Len/SMS_SCALE);
    if(!hidden) drawCoil(sxp, syp, Math.PI/2, s1, armCol1, armCol2, armShine);
    const ex = sxp;
    const ey = syp + s1;
    // compress seg2 while charging
    const seg2Len = charging
      ? Math.max(2, guardFwd - chargeFrac*12)
      : guardFwd;
    const s2=Math.max(1,Math.round(seg2Len/SMS_SCALE));
    if(!hidden && seg2Len > 2)
      drawCoil(ex, ey, facing?0:Math.PI, s2, armCol1, armCol2, armShine);
    if(!hidden) drawFist(ex + fwdDir*s2, ey, facing, charging, chargeFrac, false, 0);

  } else {
    // â”€â”€ PUNCH â€” extends in AIM direction (8-way like items) â”€â”€
    let armLen = guardFwd + snapFrac*(punchFwd - guardFwd);
    let punchAngle = Math.atan2(p.aimDY, p.aimDX);
    const _grounded=p.og||(typeof _playerOnGround==='function'&&_playerOnGround(p));
    const _straightDown=_grounded&&p.aimDY>0.75&&Math.abs(p.aimDX)<0.35;
    const _diagDown=_grounded&&!_straightDown&&p.aimDY>0.4&&Math.abs(p.aimDX)>=0.35;
    const _downPunch=_straightDown;
    if(_diagDown) armLen=Math.max(armLen, guardFwd+snapFrac*((isChargedHook?84:68)-guardFwd));
    if(_downPunch){
      const _fx=p.x+SW/2, _fy=p.y+FEET_OFF+6;
      punchAngle=Math.atan2(_fy-shWY,_fx-shWX);
      armLen=Math.max(armLen,Math.hypot(_fx-shWX,_fy-shWY));
    }else if(typeof _armSolid==='function'){                       // the fist stops at the wall's face
      const _wx0=p.x+SW/2, _feet=p.y+FEET_OFF;
      for(let d=6; d<=armLen+10; d+=3){
        const _hx=shWX+Math.cos(punchAngle)*d, _hy=shWY+Math.sin(punchAngle)*d;
        if(!_armSolid(_hx,_hy)) continue;
        // the floor under the wheel is what he is standing on, not a wall in the way
        if(_diagDown&&Math.abs(_hx-_wx0)<22&&_hy>_feet-10) continue;
        armLen=Math.max(12,Math.min(armLen,d-8)); break;
      }
    }
    if(!hidden) drawCoil(sxp, syp, punchAngle, armLen/SMS_SCALE, armCol1, armCol2, armShine);
    // Fist pos in WORLD units = shoulder + arm in punch direction
    p.fistWX = shWX + Math.cos(punchAngle) * armLen;
    p.fistWY = shWY + Math.sin(punchAngle) * armLen;
    p.fistSX = sxp + Math.cos(punchAngle) * armLen/SMS_SCALE;
    p.fistSY = syp + Math.sin(punchAngle) * armLen/SMS_SCALE;
    const gx = p.fistSX;
    const gy = p.fistSY;
    if(!p._hitDone){
      const _wx=p.fistWX,_wy=p.fistWY,_wr=12;
      const _charged=(p.pCharge||0)>HP.loadF;
      let _hit=false, _hitKind='';

      // Down, on the ground: the fist lands on the omniblock under the wheel, or on the floor.
      if(_downPunch){
        const _cx=p.x+SW/2, _feet=p.y+FEET_OFF;
        let _stood=null;
        for(const bw of BWALLS){
          if(!bw||bw.hp<=0) continue;
          if(_cx>bw.x-6&&_cx<bw.x+bw.w+6&&_feet>=bw.y-12&&_feet<=bw.y+16){ _stood=bw; break; }
        }
        if(_stood){
          p._hitDone=true;_hit=true;_hitKind='block';
          if(_stood.only==='laser'&&typeof _shockFromBlock==='function'){
            _hitKind='zap'; _shockFromBlock(_stood,_charged?'punchLoaded':'punch',Math.PI/2);
            p._pRecoil=12;
          }else if(_charged&&typeof _isRedBwall==='function'&&_isRedBwall(_stood)&&!_stood.only){
            const cx0=_stood.x+_stood.w/2, cy0=_stood.y+_stood.h/2;
            for(const o of BWALLS){
              if(o===_stood||o.hp<=0||o.only) continue;
              if(Math.abs(o.x+o.w/2-cx0)<=_stood.w*1.5&&Math.abs(o.y+o.h/2-cy0)<=_stood.h*1.5)
                _damageBwall(o,'punch',{shakeX:Math.sign(o.x-_stood.x)*3,shakeY:3});
            }
            _damageBwall(_stood,(_stood.hp||1)+1,{shakeX:0,shakeY:6});
          }else{
            _damageBwall(_stood,_charged?'punchCharged':'punch',{shakeX:0,shakeY:_charged?6:4,vy:_stood.movable?(_charged?4:2.2):0});
          }
          if(_hitKind==='block'){ spawnDebris(_stood,10); p._pRecoil=10; }
          p.vy=-(_charged?4.2:2.6); p.og=false; p._groundHold=0;
        }else if(typeof _punchCrates==='function'&&_punchCrates(_cx,_feet+4,12,Math.PI/2,_charged,shWX,shWY)){
          p._hitDone=true;_hit=true;_hitKind='crate'; p._pRecoil=8;
          p.vy=-(_charged?3.6:2.2); p.og=false; p._groundHold=0;
        }else{
          let _floor=typeof gridWorldSolid==='function'&&(gridWorldSolid(_cx,_feet+4)||gridWorldSolid(_cx,_feet+12));
          if(!_floor&&typeof gridIsSlope==='function'&&typeof MV_GRID!=='undefined'&&MV_GRID){
            const _t=MV_GRID.tile||32, _c=Math.floor(_cx/_t), _r=Math.floor((_feet+4)/_t);
            if(gridIsSlope(_c,_r)){
              const _sy=typeof gridSlopeY==='function'?gridSlopeY(_c,_r,_cx):null;
              _floor=_sy!=null&&_feet+6>=_sy;
            }
          }
          if(_floor){
            p._hitDone=true;_hit=true;_hitKind='wall';
            p.vy=-(_charged?3.6:2.2); p.og=false; p._groundHold=0;
            p._pRecoil=8;
            try{ sfx('hit'); }catch(e){}
            if(typeof spawnHitBurst==='function') spawnHitBurst(_cx,_feet,0,1,'#c8b8a0',7);
          }
        }
      }

      // Item boxes first (beta_crates.js): wood breaks, the loose item gets knocked around
      if(!_hit&&typeof _punchCrates==='function'&&_punchCrates(_wx,_wy,_wr,punchAngle,_charged,shWX,shWY)){
        p._hitDone=true;_hit=true;_hitKind='crate';p._pRecoil=8;
      }
      // Breakable walls
      if(!_hit) for(const bw of BWALLS){
        if(bw.hp<=0)continue;
        if(_wx+_wr>bw.x&&_wx-_wr<bw.x+bw.w&&_wy+_wr>bw.y&&_wy-_wr<bw.y+bw.h){
          // Paulo (Oct 21): no punching through a wall into the block behind it
          if(!_punchReach(shWX,shWY,_wx,_wy,bw)) continue;
          p._hitDone=true;_hit=true;_hitKind='block';
          // the yellow cage block is live: punching it shocks MIND (beta_impact.js), no crumbs
          if(bw.only==='laser'&&typeof _shockFromBlock==='function'){
            _hitKind='zap'; _shockFromBlock(bw,_charged?'punchLoaded':'punch',punchAngle);
            p._pRecoil=12; break;
          }
          // Paulo: a loaded punch smashes the whole omni block and cracks the ones around it
          if(_charged&&typeof _isRedBwall==='function'&&_isRedBwall(bw)&&!bw.only){
            const cx0=bw.x+bw.w/2, cy0=bw.y+bw.h/2;
            for(const o of BWALLS){
              if(o===bw||o.hp<=0||o.only) continue;
              if(Math.abs(o.x+o.w/2-cx0)<=bw.w*1.5&&Math.abs(o.y+o.h/2-cy0)<=bw.h*1.5)
                _damageBwall(o,'punch',{shakeX:Math.sign(o.x-bw.x)*3,shakeY:Math.sign(o.y-bw.y)*3});
            }
            _damageBwall(bw,(bw.hp||1)+1,{shakeX:Math.cos(punchAngle)*6,shakeY:Math.sin(punchAngle)*6});
          }else
          _damageBwall(bw,_charged?'punchCharged':'punch',{
            shakeX:Math.cos(punchAngle)*4,shakeY:Math.sin(punchAngle)*4,
            vx:bw.movable?Math.cos(punchAngle)*(_charged?8:5):0,
            vy:bw.movable?Math.sin(punchAngle)*(_charged?6:3.5):0
          });
          spawnDebris(bw,10);p._pRecoil=10;
          p.vx-=Math.cos(punchAngle)*(_charged?4:2.5);
          p.vy-=Math.sin(punchAngle)*(_charged?2:1);
          break;
        }
      }
      // Solid walls â€” blocked, recoil back
      if(!_hit){
        for(const pl of allP()){
          if(pl.tp!=='solid')continue;
          if(_wx+_wr>pl.x&&_wx-_wr<pl.x+pl.w&&_wy+_wr>pl.y&&_wy-_wr<pl.y+pl.h){
            p._hitDone=true;_hit=true;_hitKind='wall';
            p.vx-=Math.cos(punchAngle)*(_charged?3.5:2);
            p.vy-=Math.sin(punchAngle)*(_charged?2:1);
            p._pRecoil=8;sfx('hit');break;
          }
        }
      }
      // Crates â€” knocked back
      if(!_hit){
        for(const c of CRATES){
          if(_wx+_wr>c.x&&_wx-_wr<c.x+c.w&&_wy+_wr>c.y&&_wy-_wr<c.y+c.h){
            p._hitDone=true;_hit=true;_hitKind='crate';
            c.vx+=Math.cos(punchAngle)*(_charged?14:8)*(1+p.momentum*0.8);
            c.vy+=Math.sin(punchAngle)*(_charged?10:6);
            p.vx-=Math.cos(punchAngle)*1.5;
            p._pRecoil=6;sfx('hit');break;
          }
        }
      }
      // Enemies â€” core body hitbox only
      for(const e of ENEMS){
        if(!_enemyPunchable(e)) continue;
        const eh=_enemyItemHB(e);
        if(eh.w<=0||eh.h<=0) continue;
        const fistW=26,fistH=26;
        if(_fistHitsHB(_wx-fistW*0.5,_wy-fistH*0.5,fistW,fistH,eh)){
          if(!_punchReach(shWX,shWY,_wx,_wy,eh)) continue;           // a wall between them
          p._hitDone=true;_hit=true;_hitKind='enemy';
          const _charged=(p.pCharge||0)>HP.loadF||(p.pCd>4);
          if(_enemyRebootInterruptable(e)){
            _tryInterruptMindReboot(e);
          }else if(_enemyCombatActive(e)){
            const _kbScale=_charged?1.35:1;
            _damageEnemy(e,_charged?HP.loadDmg:HP.dmg,p.fistWX||p.x+SW/2,p.fistWY||p.y+FEET_OFF,_kbScale);
          }
          _applyPunchImpact(p,e,punchAngle,{charged:_charged});
          p._pRecoil=_charged?14:10;
          sfx('hit');
        }
      }
      // Paulo (Oct 20): a punch that lands should look and sound like it (beta_impact.js)
      if(_hit&&typeof _punchConnect==='function') try{ _punchConnect(_wx,_wy,punchAngle,_charged,_hitKind); }catch(e){}
    }
    if(!hidden) drawFist(gx, gy, facing, false, 0, true, snapFrac);
  }
}

/* -- Boxing glove fist â€” rounded vector glove -- */
function drawFist(gx, gy, facing, charging, chargeFrac, punching, snapFrac){
  p.fistSX=gx; p.fistSY=gy;
  const isVenture=p.hero==='venture';
  const gw=18, gh=14;
  ctx.save();
  ctx.translate(gx, gy);
  if(!facing) ctx.scale(-1,1);
  if(punching) ctx.scale(1+snapFrac*0.1,1+snapFrac*0.1);
  // Paulo (Oct 22, the key art): a purple leather glove for MIND, a red one for VENTURE
  const gL=isVenture?['#ff6a72','#c81c2c','#5a0812']:['#c08cff','#7a3cd0','#2e0e5a'];
  ctx.fillStyle='#050507';
  ctx.beginPath();ctx.roundRect(-1,-gh/2-1,gw+2,gh+2,7);ctx.fill();
  ctx.beginPath();ctx.arc(gw/2,0,gh/2+3,0,Math.PI*2);ctx.fill();
  const lg=ctx.createRadialGradient(gw/2-3,-3,1,gw/2,0,gh/2+3);
  lg.addColorStop(0,gL[0]); lg.addColorStop(0.45,gL[1]); lg.addColorStop(1,gL[2]);
  ctx.fillStyle=lg;
  ctx.beginPath();ctx.roundRect(0,-gh/2,gw,gh,6);ctx.fill();
  ctx.beginPath();ctx.arc(gw/2,0,gh/2+2,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.45)';ctx.lineWidth=0.8;ctx.beginPath();ctx.arc(gw/2+2,1,4,Math.PI*0.6,Math.PI*1.6);ctx.stroke();   // the thumb
  ctx.fillStyle='rgba(255,255,255,0.35)';
  ctx.beginPath();ctx.ellipse(gw/2-3,-4,3,1.6,-0.4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#050507';ctx.beginPath();ctx.roundRect(-6,-5,8,10,2);ctx.fill();          // the cuff
  ctx.fillStyle=gL[2];ctx.beginPath();ctx.roundRect(-5,-4,6,8,2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.25)';ctx.fillRect(-4,-3,4,1);
  if(charging&&chargeFrac>0.25){
    ctx.globalAlpha=chargeFrac*0.6;
    ctx.fillStyle=chargeFrac>0.8?'#ffffff':(isVenture?'#ff8888':'#cc88ff');
    ctx.beginPath();ctx.arc(gw/2,0,8+chargeFrac*10,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
  }
  if(punching&&snapFrac>0.85){
    ctx.fillStyle=C.WHITE;
    ctx.beginPath();ctx.arc(gw/2+(facing?6:-6),0,2,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}

/* -- Full character draw â€” MV2 vector composition -- */
function drawCharacter(){
  if(!isFinite(p.x)||!isFinite(p.y))return;
  const fc=p.fc;
  const ca2=p.crouchAmt;
  const onRope=p.hook.st==='on';
  const landAmp=p._landAmp||0;
  const landDur=10+landAmp*22;
  const landRaw=p.landF>0?Math.min(1,p.landF/landDur):0;
  const landEase=landRaw*landRaw*(3-2*landRaw);
  const suspC=p.suspComp||0;
  const walkBob=(!onRope&&p.og&&!p._onSlope&&Math.abs(p.vx)>0.5&&p.landF<=0)?Math.sin(fr*0.28+p.x*0.015)*0.45:0;
  const idleSway=0;
  const suspDrop=onRope?0:suspC*SUSP_TRAVEL;
  // the cabinet rides the fork. suspComp dips it on a landing and lifts it on the rebound; the wheel stays put
  const forkDip=onRope?0:Math.max(-2,Math.min(10,((p._tireSq||0)-TIRE_LOAD_SQ)*1.6));
  const bodyCompress=onRope?0:suspDrop+forkDip-walkBob-idleSway;
  const landHeadTuck=onRope?0:landEase;
  let hatTX=0, hatTY=0;
  if(!onRope&&p.jumpTiltF>0){
    const t=Math.min(1,p.jumpTiltF/24)*0.78;
    const dx=p._jumpHatDX!=null?p._jumpHatDX:(Math.abs(p.vx)>0.2?Math.sign(p.vx):(fc?1:-1));
    const dy=p._jumpHatDY!=null?p._jumpHatDY:(p.vy<-0.3?-0.9:(p.vy>0.4?0.45:-0.65));
    hatTX=dx*t;
    hatTY=dy*t;
  }
  const visualCa2=ca2;

  // â”€â”€ WORLD-SPACE anatomy (identical formulas to the original) â”€â”€
  const wWcx=p.x+SW/2, wWcy=p.y+FEET_OFF-WHEEL_R;
  const standBodyCY=p.y+FEET_OFF-STAND_H-WHEEL_R+10;
  const duckBodyBottom=wWcy+WHEEL_R*0.5;
  const duckBodyCY=duckBodyBottom-BODY_H;
  // Super jump loaded: sit the cabinet up out of the full tuck and let it
  // ride a slow sine. The wheel stays on the ground. Hitbox is unchanged.
  const duckDrop=Math.max(0,duckBodyCY-standBodyCY);
  const bob=Math.sin(fr*0.046)*3.2;
  const floatY=(p._springFloat||0)*(duckDrop*0.32+6+bob);
  const bodyCY=standBodyCY+visualCa2*(duckBodyCY-standBodyCY)+bodyCompress-floatY;
  const bodyTop=bodyCY;
  const shoulderY=bodyTop+BODY_H*0.22;
  const bodyLeft=wWcx-BODY_W/2, bodyRight=wWcx+BODY_W/2;
  const pose=p._armPose||computeConnectorArmPose(p);
  // the glove rides the same disc as the jack arm (player.js computeConnectorArmPose)
  const glovShoulderWX=pose.gloveShX!=null?pose.gloveShX:(fc?bodyRight:bodyLeft);
  p.tipWorldX=pose.tipX; p.tipWorldY=pose.tipY;
  const {armA0,armA1,useElbow,aimAngle:ca}=pose;

  // Invincibility â€” authentic sprite flicker (punch hit-check still runs)
  const flicker=(p.flashF>0&&Math.floor(p.flashF/2)%2===1);

  // â”€â”€ Screen coords â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const wcx=sx(wWcx), wcy=sy(wWcy);
  const bTopS=sy(bodyTop);
  const shY=sy(shoulderY);
  const glovShX=sx(glovShoulderWX);
  const connShX=sx(pose.connShX), connShY=sy(pose.connShY-floatY);
  const tipX=sx(pose.tipX), tipY=sy(pose.tipY-floatY);
  const elbowX=sx(pose.elbowX), elbowY=sy(pose.elbowY-floatY);
  ctx.save();

  // 1. SHADOW + WHEEL + FORK â€” behind everything
  if(!flicker) drawCharShadow(wcx,wcy);
  // Paulo's sketch: hanging on the rope MIND tilts with the swing, round his body's centre
  if(pose.tilt){ const tx=sx(pose.tiltCX), ty=sy(pose.tiltCY); ctx.translate(tx,ty); ctx.rotate(pose.tilt); ctx.translate(-tx,-ty); }
  if(!flicker) drawWheel(wcx,wcy,p.wheelAngle,p);
  if(!flicker) drawWheelKit(wcx,wcy,sy(bodyTop+BODY_H),fc,p);

  // 2. GLOVE ARM â€” behind body box; always runs the punch hit logic
  drawGloveArm(glovShX,shY,fc,glovShoulderWX,shoulderY,flicker);
  if(flicker){ ctx.restore(); return; }

  const drawConnArm=()=>{
  const isVenture=p.hero==='venture';
  const _armDark=isVenture?C.MAROON:C.PURPLE_D;
  const _armMain=isVenture?C.RED_D:C.INDIGO;
  const _armGlow=isVenture?'rgba(210,90,110,0.18)':'rgba(120,80,200,0.15)';
  const held=typeof _heldItemFor==='function'?_heldItemFor(p):ITEM;
  const _plugging=(window.MV_BETA&&MV_BETA.ropeClip&&MV_BETA.ropeClip.toBody&&MV_BETA.ropeClip.grab!==false)||(held===1&&p.hook&&p.hook.st==='on'&&p.hook._plugged);   // the RCA is (being) plugged into the back
  const coilFlow=(held===2&&p.xlrOn)?2:(held===3&&p.magOn)?3:0;
  if(useElbow){
    drawCoil(connShX,connShY,armA0,Math.hypot(elbowX-connShX,elbowY-connShY),_armDark,_armMain,_armGlow,coilFlow);
    if(p.hook&&p.hook.st==='on'&&held===1&&!p.hook._plugged) drawSpringCoil(elbowX,elbowY,armA1,Math.hypot(tipX-elbowX,tipY-elbowY),_armDark,_armMain);
    else drawCoil(elbowX,elbowY,armA1,Math.hypot(tipX-elbowX,tipY-elbowY),_armDark,_armMain,_armGlow,coilFlow);
    if(held>=0&&!_plugging) drawConnectorTip(tipX,tipY,armA1,p.flashF,held);
  }else{
    drawCoil(connShX,connShY,ca,Math.hypot(tipX-connShX,tipY-connShY),_armDark,_armMain,_armGlow,coilFlow);
    if(held>=0&&!_plugging) drawConnectorTip(tipX,tipY,ca,p.flashF,held);
  }
  if(coilFlow){
    const tw=connectorTipWorld(held);
    drawArmEnergyFlow(connShX,connShY,elbowX,elbowY,sx(tw.x),sy(tw.y),useElbow,coilFlow);
  }
  };
  // 3. HEAD â€” tucked in box when ducking; tiny peek when spring/wall charge ready
  const chargeInfo=_playerChargeInfo(p);
  const springReady=!!p.duckBoostReady;
  const wallReady=p.wallGrip>0&&!!p._wallChargeReady;
  const headPop=springReady||wallReady;
  let headTuckVis=onRope?visualCa2:Math.max(visualCa2,p._autoHeadTuck||0);
  if((p._springFloat||0)>0) headTuckVis*=1-(p._springFloat||0)*0.28;
  const headR=Math.round(14-headTuckVis*3);
  const standHeadCY=bodyTop-21;                       // the bulb screws into the thick record on top (Oct 22 key art)
  const shellHeadCY=bodyTop+headR*1.05;
  let headCY=standHeadCY+headTuckVis*(shellHeadCY-standHeadCY);
  let peekAmt=0;
  if(headPop){
    const peekLift=(springReady?5:4)+Math.sin(fr*0.22)*1.1;
    headCY-=peekLift;
    peekAmt=0.22+Math.sin(fr*0.18)*0.05;
  }
  window._mindHeadDmg=Math.max(0,Math.min(1,1-(p.hp||0)/(p.maxHp||100)))+((typeof _shutdownTimer!=='undefined'&&_shutdownTimer>0)?1:0);
  drawHead(wcx,sy(headCY),p.pupilX,p.pupilY,headTuckVis,p.hero,peekAmt,chargeInfo,hatTX,hatTY,landHeadTuck,false);
  window._mindHeadDmg=0;

  // 4. BODY BOX â€” in front of glove arm + head
  drawBody(wcx,bTopS,fc,0);

  // 5. CONNECTOR ARM — in front of body (it rides the disc to the side facing the rope)
  drawConnArm();
  ctx.restore();
}
function drawCharacterFor(pl){
  const oldP=p;
  p=pl;
  try{drawCharacter();}finally{p=oldP;}
}

/* â”€â”€ Draw world â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function drawBGParticles(){
  // â”€â”€ Sea-breeze streams â€” dotted falling pixel columns â”€â”€
  for(const st of STREAMS){
    const bx=sx(st.x), by=sy(st.y);
    if(bx<-8||bx>W+8) continue;
    ctx.fillStyle=C.TEAL_L;
    for(let i=0;i<st.pts.length;i+=3){
      const pt=st.pts[i];
      if(!pt)continue;
      if(((i+(fr>>2))%6)<3)continue; // sparse animated dashes
      ctx.fillRect(bx+Math.round(pt.ox/SMS_SCALE),by+Math.round(pt.oy/SMS_SCALE),1,1);
    }
  }
  // â”€â”€ Pollen / foam motes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  for(const d of DRIPS){
    const bx=sx(d.x), by=sy(d.y);
    if(bx<-4||bx>W+4) continue;
    if(d.active){
      ctx.fillStyle=C.SAND;
      ctx.fillRect(bx,by,1,2);
    } else if(d.splashF>0&&(fr&1)===0){
      const s=Math.round(d.splashF/SMS_SCALE)+1;
      ctx.fillStyle=C.SKY_L;
      ctx.fillRect(bx-s,by,1,1);ctx.fillRect(bx+s,by,1,1);ctx.fillRect(bx,by-s,1,1);
    }
  }
  // â”€â”€ Floating critters â€” 5Ã—3 two-frame flappers â”€â”€â”€â”€â”€â”€â”€â”€â”€
  for(const bat of BATS){
    const bx=sx(bat.x), by=sy(bat.y);
    if(bx<-8||bx>W+8||by<-8||by>H+8) continue;
    const up=Math.sin(bat.wingPhase)>0;
    ctx.fillStyle=C.STEEL;
    ctx.fillRect(bx-1,by,3,1);
    ctx.fillStyle=C.GLOW_L;
    if(up){ctx.fillRect(bx-2,by-1,1,1);ctx.fillRect(bx+2,by-1,1,1);}
    else{ctx.fillRect(bx-2,by+1,1,1);ctx.fillRect(bx+2,by+1,1,1);}
  }
}

/* -- PARALLAX BACKDROP --
   Flat sky + image layers per assets/backgrounds/README.md
   (layer1..layer6, missing files are skipped). */
const BG_DEFAULT_SET='awdjoo';
const BG_LAYER_FILES=[
  {file:1,speed:0.018,drift:0.010,yMul:0.08,haze:0},
  {file:2,speed:0.07,drift:0,yMul:0.20,haze:0.07},
  {file:3,speed:0.15,drift:0,yMul:0.42,haze:0.045},
  {file:4,speed:0.36,drift:0,yMul:0.82,haze:0}
];
let _bgSet=BG_DEFAULT_SET;
const _bgCache={};
let _bgLife=null,_bgBirds=null,_bgClouds=null,_bgCloudSheet=null,_bgLights=null;
function _prepBgImg(img){
  const th=img.height===H?H:H;
  const rawW=img.height===H?img.width:Math.max(W,Math.round(img.width*(th/img.height)));
  const tw=Math.ceil(rawW/W)*W;
  return smsProcessPainted(img,tw,th);
}
function _loadBgSet(name){
  if(!name||_bgCache[name])return;
  const set={layers:[]};
  _bgCache[name]=set;
  for(const def of BG_LAYER_FILES){
    const slot={img:null,speed:def.speed,drift:def.drift||0,yMul:def.yMul==null?1:def.yMul,haze:def.haze||0};
    const img=new Image();
    img.onload=()=>{ slot.img=_prepBgImg(img); };
    img.onerror=()=>{};
    img.src='assets/backgrounds/'+name+'/layer'+def.file+'.png';
    set.layers.push(slot);
  }
  if(name==='awdjoo'){
    const sheet=new Image();
    sheet.onload=()=>{ _bgCloudSheet=sheet; };
    sheet.src='assets/backgrounds/awdjoo/clouds.png';
    fetch('assets/backgrounds/awdjoo/life.json').then(r=>r.ok?r.json():null).then(d=>{
      _bgLife=d||{}; _bgBirds=null; _bgClouds=null; _bgLights=null;
    }).catch(()=>{_bgLife={};});
  }
}
function setBgSet(name){_bgSet=name;_loadBgSet(name);}
_loadBgSet(_bgSet);
function drawSkyBands(){
  const sh=H/192;
  const bands=[[0,40*sh,C.VOID],[40*sh,72*sh,C.SHADE],[72*sh,108*sh,C.NAVY],[108*sh,140*sh,C.SKY],[140*sh,168*sh,C.SKY_L],[168*sh,H,C.TEAL_D]];
  for(const [y0,y1,col] of bands){ctx.fillStyle=col;ctx.fillRect(0,y0,W,y1-y0);}
  for(let ridge=0;ridge<3;ridge++){
    const base=H-24*sh-ridge*18*sh,col=[C.SHADE,C.NAVY,C.INDIGO][ridge];
    ctx.fillStyle=col;
    for(let x=0;x<W;x++){
      const hh=(12+((x*13+ridge*47+(fr>>4))%20))*sh;
      ctx.fillRect(x,base-hh,1,hh);
    }
  }
}
function drawAwdjooSky(){
  const bands=[[0,0.18,'#8ea4c8'],[0.18,0.36,'#b8b4dc'],[0.36,0.52,'#d8cee8'],[0.52,0.70,'#e4d8ec'],[0.70,1,'#c8c0d8']];
  for(const [a,b,col] of bands){ctx.fillStyle=col;ctx.fillRect(0,(a*H)|0,W,Math.ceil((b-a)*H));}
}
function _bgScrollX(speed,drift,w){
  return -(((camX*speed+fr*(drift||0))%w)+w)%w;
}
function _blitBg(img,x,y){
  if(!img) return;
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(img,x|0,y|0);
}
function _awdjooHaze(a){
  if(a<=0) return;
  ctx.fillStyle='rgba(196,186,220,'+a+')';
  ctx.fillRect(0,0,W,H);
}
function _ensureBgLife(){
  if(_bgBirds) return;
  _bgBirds=[];
  for(let i=0;i<11;i++){
    _bgBirds.push({
      x:(i*197)%2100, y:48+(i*41)%170, vx:0.14+(i%4)*0.05,
      amp:2+(i%4), phase:i*1.3, z:i%3===0?0.03:0.07,
    });
  }
  _bgClouds=((_bgLife&&_bgLife.clouds)||[]).map((c,i)=>({
    sx:c.sx|0, sy:c.sy|0, w:c.w|0, h:c.h|0,
    x:(c.ox||0)*W_OUT_BG+(i*180), y:20+(c.oy||0)*160,
    vx:c.vx||0.045, z:c.depth||0.04,
  }));
  if(!_bgClouds.length){
    for(let i=0;i<5;i++) _bgClouds.push({sx:-1,x:i*360,y:24+(i*31)%70,w:90,h:22,vx:0.03+(i%3)*0.015,z:0.03});
  }
  const raw=(_bgLife&&_bgLife.lights)||[];
  const seen=new Set();
  _bgLights=[];
  for(const L of raw){
    const k=((L.x*48)|0)+','+((L.y*36)|0);
    if(seen.has(k)) continue;
    seen.add(k);
    _bgLights.push(L);
  }
}
const W_OUT_BG=2048;
function _drawBgBird(x,y,up,far){
  ctx.fillStyle=far?'#3a3048':'#1a1424';
  ctx.fillRect(x,y,4,1);
  if(up){ctx.fillRect(x-3,y-2,3,1);ctx.fillRect(x+4,y-2,3,1);}
  else{ctx.fillRect(x-3,y+1,3,1);ctx.fillRect(x+4,y+1,3,1);}
}
function _drawDitherCloud(x,y,w,h){
  const hi='#efe6f6', mid='#d4c8e4', lo='#b8acc8';
  ctx.fillStyle=hi; ctx.fillRect(x+10,y,w-20,h-4);
  ctx.fillRect(x+w*0.28,y-5,w*0.38,7);
  ctx.fillStyle=mid; ctx.fillRect(x,y+5,w,h-8);
  ctx.fillStyle=lo;
  for(let i=0;i<w;i+=2) ctx.fillRect(x+i,y+h-3+(i&2?1:0),1,2);
}
function drawBgAir(t){
  if(_bgSet!=='awdjoo') return;
  _ensureBgLife();
  const skyY=((-(80)*t)|0);
  for(const c of _bgClouds){
    const wrap=W+220;
    const cx=(((c.x+fr*c.vx-camX*c.z)%wrap)+wrap)%wrap-110;
    const cy=c.y+skyY;
    if(_bgCloudSheet&&c.sx>=0){
      ctx.imageSmoothingEnabled=false;
      ctx.globalAlpha=0.86;
      ctx.drawImage(_bgCloudSheet,c.sx,c.sy,c.w,c.h,cx|0,cy|0,c.w,c.h);
      ctx.globalAlpha=1;
    }else _drawDitherCloud(cx|0,cy|0,c.w||80,c.h||20);
  }
  for(const b of _bgBirds){
    b.x+=b.vx;
    if(b.x>2200) b.x=-30;
    const sx2=((b.x-camX*b.z)%(W+70))-35;
    const sy2=b.y+Math.sin(fr*0.035+b.phase)*b.amp+skyY*0.4;
    if(sx2<-12||sx2>W+12||sy2>H*0.52) continue;
    _drawBgBird(sx2|0,sy2|0,Math.sin(fr*0.22+b.phase)>0,b.z<0.05);
  }
}
function drawBgTownLights(midX,midY){
  if(_bgSet!=='awdjoo'||!_bgLights||!_bgLights.length) return;
  const lw=_bgCache.awdjoo&&_bgCache.awdjoo.layers[2]&&_bgCache.awdjoo.layers[2].img?_bgCache.awdjoo.layers[2].img.width:W_OUT_BG;
  for(const L of _bgLights){
    if(((fr>>3)+((L.x*40)|0))%11>2) continue;
    const lx=(((L.x*lw)+midX)%lw+lw)%lw;
    if(lx<0||lx>W) continue;
    const ly=(L.y*H)+midY;
    if(ly<H*0.22||ly>H*0.82) continue;
    ctx.fillStyle=L.c==='cyan'?((fr&8)?'#b8f0ff':'#68d0e8'):((fr&8)?C.SAND:C.YELLOW);
    ctx.fillRect(lx|0,ly|0,2,2);
  }
}
function drawParallax(){
  if(_bgSet==='awdjoo') drawAwdjooSky();
  else drawSkyBands();
  const set=_bgCache[_bgSet];
  if(!set)return;
  const vh=camViewH();
  const t=WH>vh?Math.max(0,Math.min(1,camY/(WH-vh))):0;
  for(let i=0;i<set.layers.length;i++){
    const L=set.layers[i];
    if(!L.img)continue;
    const w=L.img.width,h=L.img.height;
    if(w<8)continue;
    const yMul=L.yMul==null?1:L.yMul;
    const y=((-(h-H)*t*yMul)|0);
    let x=_bgScrollX(L.speed,L.drift,w);
    for(let xx=x;xx<W;xx+=w) _blitBg(L.img,xx,y);
    if(i===0) drawBgAir(t);
    if(i===2) drawBgTownLights(x,y);
    if(L.haze) _awdjooHaze(L.haze);
  }
}

function drawPlat(pl){
  const bx=sx(pl.x),by=sy(pl.y),pw=sw(pl.w),ph=sw(pl.h);
  if(bx>W+8||bx+pw<-8||by>H+8||by+ph<-8)return;
  if(pl.tp==='solid'){
    // Keep world bounds collidable but invisible (avoids corner artifact boxes).
    if((pl.x===0&&pl.w<=24&&pl.h>=WH*0.5)||
       (pl.x>=WW-28&&pl.w<=24&&pl.h>=WH*0.5)||
       (pl.y===0&&pl.h<=24&&pl.w>=WW*0.5)) return;
    ctx.fillStyle=C.BROWN;ctx.fillRect(bx,by,pw,ph);
    ctx.fillStyle=C.TAN;ctx.fillRect(bx,by,pw,1);
    // brick joints
    ctx.fillStyle=C.MAROON;
    for(let yy=4;yy<ph;yy+=4)ctx.fillRect(bx,by+yy,pw,1);
    for(let yy=1;yy<ph;yy+=4){
      const off=((yy>>2)&1)?4:0;
      for(let xx=off;xx<pw;xx+=8)ctx.fillRect(bx+xx,by+yy,1,3);
    }
  }else if(pl.tp==='oneway'){
    ctx.fillStyle=C.STEEL;ctx.fillRect(bx,by,pw,ph);
    ctx.fillStyle=C.SKY_L;ctx.fillRect(bx,by,pw,1);
    ctx.fillStyle=C.SKY;
    for(let xx=2;xx<pw-1;xx+=4)ctx.fillRect(bx+xx,by+1,2,1);
  }else if(pl.tp==='ceil'){
    ctx.fillStyle=C.PURPLE_D;ctx.fillRect(bx,by,pw,ph);
    for(let i=0;i<pw;i+=3){
      ctx.fillStyle=((i/3)|0)%2===0?C.VIOLET:C.PURPLE_D;
      ctx.fillRect(bx+i,by+ph-2,2,2);
    }
  }
}

function drawAwdjooIsland(a){
  const bx=sx(a.x),by=sy(a.y),pw=sw(a.w),ph=sw(a.h);
  if(bx>W+8||bx+pw<-8||by>H+8||by+ph<-8) return;
  ctx.fillStyle=C.BROWN_D; ctx.fillRect(bx,by,pw,ph);
  ctx.fillStyle=C.BROWN; ctx.fillRect(bx,by+3,pw,ph-3);
  ctx.fillStyle=C.TAN; ctx.fillRect(bx+1,by+5,pw-2,2);
  ctx.fillStyle=C.GREEN_D; ctx.fillRect(bx,by,pw,4);
  ctx.fillStyle=C.GREEN; ctx.fillRect(bx+1,by,pw-2,3);
  ctx.fillStyle=C.GREEN_L; ctx.fillRect(bx+3,by,pw-6,2);
  ctx.fillStyle=C.BROWN_D;
  for(let i=10;i<pw-8;i+=16) ctx.fillRect(bx+i,by+ph-7,4,3);
  const cxm=bx+(pw>>1), cym=by+(ph>>1)+2;
  ctx.fillStyle=C.SAND;
  if((a.dx||0)>0.2){
    ctx.fillRect(cxm-1,cym-2,1,1);ctx.fillRect(cxm,cym-1,1,1);
    ctx.fillRect(cxm+1,cym,1,1);ctx.fillRect(cxm,cym+1,1,1);ctx.fillRect(cxm-1,cym+2,1,1);
  }else if((a.dx||0)<-0.2){
    ctx.fillRect(cxm+1,cym-2,1,1);ctx.fillRect(cxm,cym-1,1,1);
    ctx.fillRect(cxm-1,cym,1,1);ctx.fillRect(cxm,cym+1,1,1);ctx.fillRect(cxm+1,cym+2,1,1);
  }
}

function drawCampaignPlats(){
  if(typeof APLAT==='undefined') return;
  for(const a of APLAT){
    if(a&&a._awdjooIsland) drawAwdjooIsland(a);
  }
  if(typeof MPLAT==='undefined') return;
  for(const m of MPLAT){
    if(m&&m._awdjooIsland) drawMovPlat(m);
  }
}

function drawMovPlat(m){
  const bx=sx(m.x),by=sy(m.y),pw=sw(m.w),ph=sw(m.h);
  ctx.fillStyle=C.CYAN_D;ctx.fillRect(bx,by,pw,ph);
  ctx.fillStyle=C.CYAN;ctx.fillRect(bx,by,pw,1);
  // rivets
  ctx.fillStyle=C.NAVY;
  ctx.fillRect(bx+1,by+ph-2,1,1);ctx.fillRect(bx+pw-2,by+ph-2,1,1);
  // direction arrow (pixel chevron)
  const cxm=bx+(pw>>1), cym=by+(ph>>1);
  ctx.fillStyle=C.SKY_L;
  if(m.vx>0.2){
    ctx.fillRect(cxm-1,cym-2,1,1);ctx.fillRect(cxm,cym-1,1,1);
    ctx.fillRect(cxm+1,cym,1,1);ctx.fillRect(cxm,cym+1,1,1);ctx.fillRect(cxm-1,cym+2,1,1);
  }else if(m.vx<-0.2){
    ctx.fillRect(cxm+1,cym-2,1,1);ctx.fillRect(cxm,cym-1,1,1);
    ctx.fillRect(cxm-1,cym,1,1);ctx.fillRect(cxm,cym+1,1,1);ctx.fillRect(cxm+1,cym+2,1,1);
  }else{
    ctx.fillRect(cxm-2,cym,1,1);ctx.fillRect(cxm+2,cym,1,1);
  }
}


function drawBreakWall(bw){
  if(!bw||!isFinite(bw.x)||!isFinite(bw.y)||!isFinite(bw.w)||!isFinite(bw.h)) return;
  // Debris: chunky shards that tumble, bounce, roll and pile up, then fade
  if(bw.debris&&bw.debris.length){
    for(const d of bw.debris){
      const t=d.life/d.maxLife, a=t<0.25?t/0.25:1;
      const cx=sx(d.x+d.w/2), cy=sy(d.y+d.h/2), r=Math.max(1.5,sw(Math.max(d.w,d.h)*0.55)), n=d.sides||4;
      ctx.save(); ctx.globalAlpha=a; ctx.translate(cx,cy); ctx.rotate(d.rot||0);
      ctx.beginPath();
      for(let k=0;k<n;k++){ const an=k/n*Math.PI*2, rr=r*(0.75+0.25*((k*7+n)%3)/2); k?ctx.lineTo(Math.cos(an)*rr,Math.sin(an)*rr):ctx.moveTo(Math.cos(an)*rr,Math.sin(an)*rr); }
      ctx.closePath(); ctx.fillStyle=d.col; ctx.fill();
      ctx.strokeStyle='rgba(210,150,255,0.55)'; ctx.lineWidth=Math.max(1,r*0.25); ctx.stroke();      // a bright chipped edge
      ctx.fillStyle='rgba(255,230,255,0.35)'; ctx.fillRect(-r*0.5,-r*0.5,r*0.45,r*0.35);
      ctx.restore();
    }
  }
  if(bw.hp<=0) return;

  const rot=bw.rot||0;
  const bx0=sx(bw.x+(bw.shakeX||0)), by0=sy(bw.y+(bw.shakeY||0));
  const bws=sw(bw.w), bhs=sw(bw.h);
  ctx.save();
  if(rot){
    ctx.translate(bx0+bws*0.5, by0+bhs*0.5);
    ctx.rotate(rot);
    ctx.translate(-bws*0.5, -bhs*0.5);
  }
  const bx=rot?0:bx0, by=rot?0:by0;
  const frac=bw.maxHp>0?bw.hp/bw.maxHp:1;
  const useTile=!!(bw.tileGid&&_tmjDraw&&_tmjLookupGid(bw.tileGid));
  const isRed=_isRedBwall(bw);
  const recentHit=(bw.shakeX||bw.shakeY)&&(fr&1)===0;

  if(useTile){
    const {tw,th,sc}=_tmjDraw;
    const animGid=typeof _tmjOmniblockAnimGid==='function'?_tmjOmniblockAnimGid(bw.tileGid):bw.tileGid;
    _drawTmjTileGid(animGid,bx,by,tw,th,sc);
    if(recentHit||(bw.hitGlow||0)>0){
      const g=Math.min(1,((bw.hitGlow||0)/16)*0.55+(recentHit?0.25:0));
      ctx.fillStyle=`rgba(244,236,255,${g})`;
      ctx.fillRect(bx,by,bws,bhs);
    }
    if(frac>=0.99){ ctx.restore(); return; }
  }else if(isRed){
    const tws=_tmjDraw?(_tmjDraw.tw*_tmjDraw.sc):bw.w;
    const ths=_tmjDraw?(_tmjDraw.th*_tmjDraw.sc):bw.h;
    const rw=sw(Math.max(bw.w,tws)), rh=sw(Math.max(bw.h,ths));
    ctx.fillStyle=recentHit?C.WHITE:C.MAROON;ctx.fillRect(bx,by,rw,rh);
    ctx.fillStyle=recentHit?C.PINK:C.RED;ctx.fillRect(bx+1,by+1,rw-2,rh-2);
    ctx.fillStyle=C.RED_L;ctx.fillRect(bx+1,by+1,rw-2,1);
    if(frac>=0.99){ ctx.restore(); return; }
  }else{
    // Brick block â€” palette shifts duller as it takes damage
    const main=frac>0.66?C.BROWN:frac>0.33?C.BROWN_D:C.GREY_D;
    ctx.fillStyle=C.BLACK;ctx.fillRect(bx,by,bws,bhs);
    ctx.fillStyle=recentHit?C.WHITE:main;ctx.fillRect(bx+1,by+1,bws-2,bhs-2);
    ctx.fillStyle=C.TAN;ctx.fillRect(bx+1,by+1,bws-2,1);
    ctx.fillStyle=C.BLACK;
    for(let yy=4;yy<bhs-1;yy+=4){
      ctx.fillRect(bx+1,by+yy,bws-2,1);
      for(let xx=2+((yy>>2)&1)*3;xx<bws-1;xx+=6)ctx.fillRect(bx+xx,by+yy-3,1,3);
    }
  }

  // Crack pixels â€” deterministic, grow with damage
  const dmg=bw.maxHp-bw.hp;
  if(dmg>0){
    for(let c2=0;c2<dmg;c2++){
      const s1=(bw.x*7+bw.y*11+c2*37)%997/997;
      const s2=(bw.x*13+bw.y*5+c2*53)%983/983;
      const s3=(bw.x*17+bw.y*19+c2*61)%991/991;
      const cx0=(bx+s1*bws)|0, cy0=(by+s2*bhs)|0;
      pxLine(cx0,cy0,(cx0+((s3-0.5)*bws*0.6))|0,(cy0+((s1-0.3)*bhs*0.5))|0,C.BLACK);
      pxLine(cx0,cy0,(cx0+((s2-0.5)*bws*0.3))|0,(cy0-(s3*bhs*0.3))|0,C.BLACK);
    }
  }

  // Label + HP pips (non-red breakables only)
  if(!isRed){
    if(bw.label)drawTextC(bw.label,bx+bws/2,by-7,C.SAND);
    for(let i=0;i<bw.maxHp;i++){
      ctx.fillStyle=i<bw.hp?C.ORANGE:C.BLACK;
      ctx.fillRect(bx+1+i*3,by+bhs+1,2,2);
    }
  }
  ctx.restore();
}
function drawCrate(c){
  const rot=c.rot||0;
  const bx0=sx(c.x), by0=sy(c.y);
  const cw=sw(c.w), ch=sw(c.h);
  ctx.save();
  if(rot){
    ctx.translate(bx0+cw*0.5, by0+ch*0.5);
    ctx.rotate(rot);
    ctx.translate(-cw*0.5, -ch*0.5);
  }
  const bx=rot?0:bx0, by=rot?0:by0;
  ctx.fillStyle=C.BROWN_D;ctx.fillRect(bx,by,cw,ch);
  ctx.fillStyle=C.BROWN;ctx.fillRect(bx+1,by+1,cw-2,ch-2);
  ctx.fillStyle=C.TAN;ctx.fillRect(bx+1,by+1,cw-2,1);
  ctx.fillStyle=C.GOLD_D;ctx.fillRect(bx+1,by+ch-2,cw-2,1);
  pxLine(bx+1,by+1,bx+cw-2,by+ch-2,C.MAROON);
  pxLine(bx+cw-2,by+1,bx+1,by+ch-2,C.MAROON);
  ctx.restore();
}

/* â”€â”€ ENEMY SPRITES â€” shaded silhouettes â”€â”€ */
const _ENM_PAL={
  o:C.BLACK,d:C.RED_D,m:C.RED,l:C.RED_L,h:C.PINK,
  k:C.VOID,y:C.YELLOW,a:C.ORANGE,
  n:C.NAVY,b:C.BLUE,B:C.BLUE_L,c:C.CYAN,t:C.TEAL_L,
  p:C.PURPLE_D,P:C.VIOLET,e:C.GLOW,s:C.STEEL,g:C.GREY,
};
function _mkEnmFrames(framesRows){
  return framesRows.map(rows=>{
    const s=mkSpr(rows,_ENM_PAL);
    return {spr:s,white:whiteSpr(s)};
  });
}
const ENM_SPR={
  circle:_mkEnmFrames([[
    '....oooo....',
    '...oddddo...',
    '..odmmmmdo..',
    '.odmmmmmdo..',
    'odmyaamyamdo',
    'odmkkkmkkmdo',
    'odmmmmmmmmdo',
    'odmhhhhhmdo.',
    '..odmmmmdo..',
    '...oddddo...',
    '....oooo....',
  ],[
    '....oooo....',
    '...oddddo...',
    '..odmmmmdo..',
    '.odmmmmmdo..',
    'odmyaamyamdo',
    'odmkkkmkkmdo',
    'odmmmmmmmmdo',
    'odmmhhhhmmdo',
    '..odmmmmdo..',
    '...oddddo...',
    '....oooo....',
  ]]),
  square:_mkEnmFrames([[
    'ooooooooooooo',
    'obbbbbbbbbbbo',
    'oblllllllllbo',
    'oblccccccclbo',
    'oblccctccclbo',
    'oblccctccclbo',
    'oblccccccclbo',
    'oblllllllllbo',
    'obbbbbbbbbbbo',
    'ooooooooooooo',
  ]]),
  flyer:_mkEnmFrames([[
    'p..........p',
    'pp..PtP..pp',
    '.pp.PPP.pp.',
    '..ppPPPpp..',
    '...pPePp...',
    '...pPPPp...',
    '....PPP....',
    '...........',
  ],[
    '...........',
    '....PtP....',
    '...pPPPp...',
    '.ppPPPPPpp.',
    'pp.pPePp.pp',
    'p..pPPPp..p',
    '....PPP....',
    '...........',
  ]]),
};
function _drawMindEnemyOff(e){
  if(!isFinite(e.x)||!isFinite(e.y)) return;
  const bx=sx(e.x), by=sy(e.y);
  if(bx>W+80||bx+sw(SW)<-80||by>H+80) return;
  const shutAnim=e.shutF>0;
  const shutT=shutAnim?1-e.shutF/ENEMY_SHUTDOWN_FRAMES:1;
  const settled=!!e._shutSettled;
  const slump=settled?0.92:0.55+shutT*0.35;
  const lean=e._shutLean||(e.fc?0.14:-0.14);
  const fc=e.fc;
  const ca2=slump;
  const wWcx=e.x+SW/2, wWcy=e.y+FEET_OFF-WHEEL_R;
  const standBodyCY=e.y+FEET_OFF-STAND_H-WHEEL_R+10;
  const duckBodyBottom=wWcy+WHEEL_R*0.5;
  const duckBodyCY=duckBodyBottom-BODY_H;
  const bodyCY=standBodyCY+ca2*(duckBodyCY-standBodyCY);
  const bodyTop=bodyCY;
  const shoulderY=bodyTop+BODY_H*0.22;
  const glovShoulderWX=fc?wWcx+BODY_W/2:wWcx-BODY_W/2;
  const wcx=sx(wWcx), wcy=sy(wWcy);
  const bTopS=sy(bodyTop);
  const shY=sy(shoulderY);
  const glovShX=sx(glovShoulderWX);
  const headCY=bTopS-18;
  drawCharShadow(wcx,wcy);
  ctx.save();
  ctx.translate(wcx,wcy);
  ctx.rotate(lean*(settled?1:0.4+shutT*0.6));
  ctx.translate(-wcx,-wcy);
  drawHostileWheel(wcx,wcy,e.wheelAngle||0);
  drawMindGloveArm(e,glovShX,shY,fc,false);
  const _eh=p.hero;
  p.hero='venture';
  drawHead(wcx,headCY,0,0,ca2,'venture',0,null,0,0,0,false,true);
  const eyeY=headCY+2;
  ctx.strokeStyle='#aa3030';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(wcx-5,eyeY-3);ctx.lineTo(wcx-1,eyeY+1);ctx.stroke();
  ctx.beginPath();ctx.moveTo(wcx-1,eyeY-3);ctx.lineTo(wcx-5,eyeY+1);ctx.stroke();
  ctx.beginPath();ctx.moveTo(wcx+1,eyeY-3);ctx.lineTo(wcx+5,eyeY+1);ctx.stroke();
  ctx.beginPath();ctx.moveTo(wcx+5,eyeY-3);ctx.lineTo(wcx+1,eyeY+1);ctx.stroke();
  drawBody(wcx,bTopS,fc,ca2,{hp:e.hp,mhp:e.mhp,off:true});
  p.hero=_eh;
  ctx.restore();
  if(shutAnim){
    const sparkN=3+Math.floor(shutT*4);
    for(let i=0;i<sparkN;i++){
      const a=fr*0.4+i*1.4;
      const px=wcx+Math.cos(a)*10, py=headCY+Math.sin(a*1.3)*8;
      ctx.fillStyle=fr%4?C.PURPLE_L:C.LILAC;
      ctx.fillRect(px,py,2,2);
    }
    if(shutT>0.2&&fr%12<8&&!window._mindOffNoLabel){
      drawTextC('SHUTDOWN',wcx,headCY-22,C.PURPLE_L,1);
    }
  }
  if((settled||shutT>0.65)&&!window._mindOffNoLabel){
    if(e._mindOff==='rebooting'){
      drawTextC('BOOT',wcx,headCY-50,C.PURPLE_L,1);
    }else if(e._mindOff==='cooldown'){
      ctx.fillStyle=C.BLACK;
      ctx.fillRect(wcx-16,headCY-28,32,12);
      drawTextC('OFF',wcx,headCY-26,C.LILAC,1);
      const secs=Math.max(1,Math.ceil((e._cooldownEnd-Date.now())/1000));
      drawTextC(String(secs),wcx,headCY-40,C.YELLOW,1);
    }else{
      ctx.fillStyle=C.BLACK;
      ctx.fillRect(wcx-16,headCY-28,32,12);
      drawTextC('OFF',wcx,headCY-26,C.LILAC,1);
    }
  }
}
function drawMindEnemy(e){
  if(!e.mind) return;
  if(!e.alive){
    _drawMindEnemyOff(e);
    return;
  }
  if(!isFinite(e.x)||!isFinite(e.y)) return;
  const bx=sx(e.x), by=sy(e.y);
  if(bx>W+80||bx+sw(SW)<-80||by>H+80) return;
  const fc=e.fc;
  const wWcx=e.x+SW/2, wWcy=e.y+FEET_OFF-WHEEL_R;
  const bodyCY=e.y+FEET_OFF-STAND_H-WHEEL_R+10;
  const bodyTop=bodyCY;
  const shoulderY=bodyTop+BODY_H*0.22;
  const glovShoulderWX=fc?wWcx+BODY_W/2:wWcx-BODY_W/2;
  const pose=e._armPose||computeConnectorArmPose(e);
  const {armA0,armA1,useElbow,aimAngle:ca}=pose;
  const flicker=(e.hitF>0&&e.hitF>8&&Math.floor(e.hitF/3)%2===1);
  const wcx=sx(wWcx), wcy=sy(wWcy);
  const bTopS=sy(bodyTop);
  const shY=sy(shoulderY);
  const glovShX=sx(glovShoulderWX);
  const connShX=sx(pose.connShX), connShY=sy(pose.connShY);
  const tipX=sx(pose.tipX), tipY=sy(pose.tipY);
  const elbowX=sx(pose.elbowX), elbowY=sy(pose.elbowY);
  if(!flicker){drawCharShadow(wcx,wcy);drawHostileWheel(wcx,wcy,e.wheelAngle);}
  drawMindGloveArm(e,glovShX,shY,fc,flicker);
  if(flicker) return;
  drawHead(wcx,sy(bodyTop-18),e.pupilX,e.pupilY,0,'venture',0,null,0,0,0,false,true);
  const _eh=p.hero; p.hero=e.mirror?'mind':'venture';
  drawBody(wcx,bTopS,fc,0,{hp:e.hp,mhp:e.mhp,off:false});
  p.hero=_eh;
  const armDark=C.MAROON, armMain=C.RED_D;
  const eItem=e.item!=null?e.item:0;
  if(e.hook&&e.hook.st!=='idle'&&eItem===1){
    const hk=e.hook;
    const nx=sx(pose.noseX), ny=sy(pose.noseY);
    const tx=hk.st==='on'?sx(hk.ax):sx(hk.ex);
    const ty=hk.st==='on'?sy(hk.ay):sy(hk.ey);
    ctx.strokeStyle='rgba(180,120,60,0.85)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(nx,ny);ctx.lineTo(tx,ty);ctx.stroke();
  }
  if(e.xlrOn&&eItem===2&&fr%8<5){
    const pr=sw(20+(fr%10));
    ctx.strokeStyle='rgba(80,180,255,0.4)';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(tipX,tipY,pr,ca-0.55,ca+0.55);ctx.stroke();
  }
  if(e.magOn&&eItem===3&&fr%6<4){
    ctx.strokeStyle='rgba(255,120,200,0.45)';ctx.lineWidth=1;
    for(let i=0;i<3;i++){
      const a=ca+0.25+i*0.32;
      ctx.beginPath();ctx.arc(tipX,tipY,sw(14+i*7),a,a+0.55);ctx.stroke();
    }
  }
  if(e.pt<=0){
    if(useElbow){
      drawCoil(connShX,connShY,armA0,Math.hypot(elbowX-connShX,elbowY-connShY),armDark,armMain);
      drawCoil(elbowX,elbowY,armA1,Math.hypot(tipX-elbowX,tipY-elbowY),armDark,armMain);
      drawConnectorTip(tipX,tipY,armA1,e.flashF||0,eItem);
    }else{
      drawCoil(connShX,connShY,ca,Math.hypot(tipX-connShX,tipY-connShY),armDark,armMain);
      drawConnectorTip(tipX,tipY,ca,e.flashF||0,eItem);
    }
  }
}
function _drawMinionOff(e){
  const bx=sx(e.x), by=sy(e.y);
  const ew=sw(e.w), eh=sw(e.h);
  if(bx>W+16||bx+ew<-16||by>H+16) return;
  const shutAnim=e.shutF>0;
  const shutT=shutAnim?1-e.shutF/ENEMY_SHUTDOWN_FRAMES:1;
  const settled=!!e._shutSettled;
  const lean=e._shutLean||(e.dir>0?0.12:-0.12);
  const bob=settled?0:Math.round(Math.sin(fr*0.2)*2);
  const MINION_SPR_SCALE=2.6;
  const _blitScaledSpr=(spr,dx,dy,alpha)=>{
    const dw=Math.max(ew*0.9,sw(spr.width*MINION_SPR_SCALE));
    const dh=Math.max(eh*0.9,sw(spr.height*MINION_SPR_SCALE));
    const ox=dx+((ew-dw)>>1), oy=dy+((eh-dh)>>1)+bob;
    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.translate(ox+dw/2,oy+dh);
    ctx.rotate(lean*(settled?1:0.5+shutT*0.5));
    ctx.translate(-(ox+dw/2),-(oy+dh));
    ctx.drawImage(spr,0,0,spr.width,spr.height,ox,oy,dw,dh);
    ctx.restore();
  };
  let spr;
  if(e.type==='circle'){
    const fi=Math.floor(e.x/14)%2;
    spr=ENM_SPR.circle[((fi%2)+2)%2].spr;
  }else if(e.type==='flyer'){
    spr=ENM_SPR.flyer[Math.floor(fr*0.18+e.x*0.02)%2].spr;
  }else{
    spr=ENM_SPR.square[0].spr;
  }
  const alpha=settled?0.72:0.45+shutT*0.35;
  _blitScaledSpr(spr,bx,by,alpha);
  if(shutAnim){
    for(let i=0;i<3;i++){
      const a=fr*0.5+i*2;
      ctx.fillStyle=fr%4?C.PURPLE_L:C.LILAC;
      ctx.fillRect(bx+ew/2+Math.cos(a)*8,by+eh*0.35+Math.sin(a)*6,2,2);
    }
  }
  const labelX=bx+ew/2, labelY=by-12;
  ctx.fillStyle=C.BLACK;
  ctx.fillRect(labelX-16,labelY-2,32,12);
  drawTextC('OFF',labelX,labelY,C.LILAC,1);
}
function _drawSignolProcedural(cx,cy,r,charging,eyesClosed,rollAngle){
  ctx.save();
  ctx.translate(cx,cy);
  if(rollAngle) ctx.rotate(rollAngle);
  if(charging){
    const pulse=1+Math.sin(fr*0.28)*0.07;
    ctx.scale(pulse,pulse);
  }
  const rr=sw(r);
  ctx.fillStyle=C.MAROON;
  ctx.beginPath();ctx.arc(0,0,rr+1,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=C.RED_D;
  ctx.beginPath();ctx.arc(0,0,rr,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=C.RED;
  ctx.beginPath();ctx.arc(-rr*0.12,-rr*0.08,rr*0.72,0,Math.PI*2);ctx.fill();
  if(!eyesClosed){
    ctx.fillStyle=C.WHITE;
    ctx.fillRect(-rr*0.42,-rr*0.12,rr*0.28,rr*0.22);
    ctx.fillRect(rr*0.14,-rr*0.12,rr*0.28,rr*0.22);
    ctx.fillStyle=C.BLACK;
    ctx.fillRect(-rr*0.28,-rr*0.02,rr*0.08,rr*0.12);
    ctx.fillRect(rr*0.28,-rr*0.02,rr*0.08,rr*0.12);
  }else{
    ctx.strokeStyle=C.MAROON;ctx.lineWidth=Math.max(1,rr*0.1);
    ctx.beginPath();
    ctx.moveTo(-rr*0.4,-rr*0.05);ctx.lineTo(-rr*0.12,-rr*0.05);
    ctx.moveTo(rr*0.12,-rr*0.05);ctx.lineTo(rr*0.4,-rr*0.05);
    ctx.stroke();
  }
  ctx.restore();
}
function drawSignol(e){
  if(!e.alive||e.signolState==='dead') return;
  const sc=_signolCenter(e);
  const cx=sx(sc.cx), cy=sy(sc.cy);
  const r=sw(e.r);
  if(cx>W+r*2||cx<-r*2||cy>H+r*2) return;
  const charging=e.signolState==='charge';
  const eyesClosed=charging;
  const rollAngle=e.signolState==='roll'?(e.wheelAngle||0):0;
  const fl=e.hitF>0&&fr%4<2;
  if(SIGNOL_SPR.ready&&SIGNOL_SPR.img&&!fl){
    const sz=r*2+2;
    const fw=SIGNOL_SPR.fw||16, fh=SIGNOL_SPR.fh||16;
    const frames=Math.max(1,SIGNOL_SPR.frames||1);
    const cols=Math.max(1,SIGNOL_SPR.cols||frames);
    const fi=Math.floor(fr/8)%frames;
    const sx0=(fi%cols)*fw, sy0=Math.floor(fi/cols)*fh;
    ctx.save();
    ctx.translate(cx,cy);
    if(rollAngle) ctx.rotate(rollAngle);
    if(charging) ctx.scale(1+Math.sin(fr*0.28)*0.08,1+Math.sin(fr*0.28)*0.08);
    ctx.drawImage(SIGNOL_SPR.img,sx0,sy0,fw,fh,-sz*0.5,-sz*0.5,sz,sz);
    if(eyesClosed){
      ctx.fillStyle='rgba(80,10,10,0.75)';
      ctx.fillRect(-sz*0.22,-sz*0.08,sz*0.16,sz*0.06);
      ctx.fillRect(sz*0.06,-sz*0.08,sz*0.16,sz*0.06);
    }
    ctx.restore();
  }else{
    _drawSignolProcedural(cx,cy,e.r,charging,eyesClosed||fl,rollAngle);
  }
  if(charging){
    const t=1-(e.chargeT||0)/SIGNOL_CHARGE_FR;
    ctx.strokeStyle=`rgba(255,${120+Math.floor(t*100)},40,${0.35+t*0.45})`;
    ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(cx,cy,r+4+Math.sin(fr*0.4)*2,0,Math.PI*2);ctx.stroke();
  }
}
function drawEnemy(e){
  if(e.mind) return;
  if(e.type==='signol'){ drawSignol(e); return; }
  if(!e.alive){
    _drawMinionOff(e);
    return;
  }
  const bx=sx(e.x), by=sy(e.y);
  const ew=sw(e.w), eh=sw(e.h);
  if(bx>W+16||bx+ew<-16||by>H+16)return;
  const fl=e.hitF>0&&fr%4<2;
  const bob=Math.round(Math.sin(fr*0.14+e.x*0.04));
  const MINION_SPR_SCALE=2.6;
  const _blitScaledSpr=(spr,dx,dy)=>{
    const dw=Math.max(ew*0.9,sw(spr.width*MINION_SPR_SCALE));
    const dh=Math.max(eh*0.9,sw(spr.height*MINION_SPR_SCALE));
    const ox=dx+((ew-dw)>>1), oy=dy+((eh-dh)>>1);
    ctx.drawImage(spr,0,0,spr.width,spr.height,ox,oy,dw,dh);
  };

  if(e.type==='circle'){
    // â”€â”€ CIRCLE ENEMY â€” rolling grenadier â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const fi=Math.floor(e.x/14)%2;
    const f=ENM_SPR.circle[((fi%2)+2)%2];
    const spr=fl?f.white:f.spr;
    _blitScaledSpr(spr,bx,by+((eh-spr.height)>>1)+bob);
    // Grenades
    for(const g of e.grenades){
      const gx2=sx(g.x),gy2=sy(g.y);
      if(g.exploded){
        if(g.explodeF<12&&(fr&1)===0){
          const er=1+Math.round(g.explodeF/12*5);
          ctx.fillStyle=g.explodeF<6?C.YELLOW:C.ORANGE;
          ctx.fillRect(gx2-er,gy2,er*2,1);ctx.fillRect(gx2,gy2-er,1,er*2);
          ctx.fillRect(gx2-(er>>1),gy2-(er>>1),er,er);
        }
      } else {
        ctx.fillStyle=C.GREY_D;ctx.fillRect(gx2-1,gy2-1,3,3);
        ctx.fillStyle=C.GREY;ctx.fillRect(gx2,gy2,1,1);
        ctx.fillStyle=C.ORANGE;ctx.fillRect(gx2,gy2-2,1,1);
        if(g.life>60&&fr%4<2){ctx.fillStyle=C.YELLOW;ctx.fillRect(gx2,gy2-3,1,1);}
      }
    }

  } else if(e.type==='flyer'){
    // â”€â”€ FLYER ENEMY â€” swooping bat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const fi=Math.floor(fr*0.18+e.x*0.02)%2;
    const f=ENM_SPR.flyer[fi];
    const spr=fl?f.white:f.spr;
    _blitScaledSpr(spr,bx,by+((eh-spr.height)>>1)+bob);

  } else {
    // â”€â”€ SQUARE ENEMY â€” laser shooter / jumper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const f=ENM_SPR.square[0];
    const spr=fl?f.white:f.spr;
    _blitScaledSpr(spr,bx,by+bob);
    // Scanner eye on facing side
    if(!fl){
      const eyeX=e.dir>0?bx+ew-4:bx+1;
      const midY=by+bob+((eh>>1));
      ctx.fillStyle=C.TEAL;ctx.fillRect(eyeX,midY-1,3,2);
      ctx.fillStyle=C.GLOW_L;ctx.fillRect(eyeX+1,midY,1,1);
    }
    // Feet â€” 2-frame shuffle
    const ft=Math.floor(fr*0.12+e.x*0.01)%2;
    ctx.fillStyle=C.NAVY;
    ctx.fillRect(bx+1+(ft?2:0),by+11+bob,2,2);
    ctx.fillRect(bx+ew-3-(ft?2:0),by+11+bob,2,2);
  }
}

function _scanCandleLights(tmjMap){
  _candleLights=[];
  const tw=tmjMap.tilewidth||8, th=tmjMap.tileheight||8;
  const mw=tmjMap.width|0, mh=tmjMap.height|0, sc=TILED_WORLD_SCALE;
  const pushLight=(data)=>{
    if(!data) return;
    for(let row=0;row<mh;row++){
      for(let col=0;col<mw;col++){
        const gid=_tmjGid(data[row*mw+col]);
        if(!gid) continue;
        const tid=gid-1;
        if(!TMJ_CANDLE_TIDS.has(tid)&&!TMJ_LAMP_GLOW_TIDS.has(tid)) continue;
        _candleLights.push({
          x:(col*tw+tw*0.5)*sc,
          y:(row*th+th*0.5)*sc,
          hot:tid>=1706||TMJ_LAMP_GLOW_TIDS.has(tid),
          fg:TMJ_LAMP_GLOW_TIDS.has(tid)
        });
      }
    }
  };
  const canvasLayer=(tmjMap.layers||[]).find(l=>l.type==='tilelayer'&&l.data&&l.name==='canvas')
    ||(tmjMap.layers||[]).find(l=>l.type==='tilelayer'&&l.data);
  pushLight(canvasLayer&&canvasLayer.data);
  const fgLayer=(tmjMap.layers||[]).find(l=>l.type==='tilelayer'&&l.data&&String(l.name||'').toLowerCase()==='foreground');
  pushLight(fgLayer&&fgLayer.data);
}
function drawCandleLights(){
  if(!_candleLights.length) return;
  for(const c of _candleLights){
    if(c.fg) continue;
    const bx=sx(c.x), by=sy(c.y);
    if(bx<-24||bx>W+24||by<-24||by>H+24) continue;
    const seed=(c.x*13+c.y*7)|0;
    const f2=((fr+seed)>>3)&1;
    const r=c.hot?6:4;
    // Soft pixel halo rings (no dither blocks)
    for(let ring=r;ring>=1;ring--){
      ctx.fillStyle=ring>3?(f2?C.ORANGE:C.GOLD_D):ring>1?C.SAND:C.YELLOW;
      ctx.fillRect(bx-ring,by,1,1);ctx.fillRect(bx+ring,by,1,1);
      ctx.fillRect(bx,by-ring,1,1);ctx.fillRect(bx,by+ring,1,1);
      ctx.fillRect(bx-ring+1,by-1,1,1);ctx.fillRect(bx+ring-1,by+1,1,1);
    }
    if(c.hot){
      ctx.fillStyle=f2?C.YELLOW:C.SAND;
      ctx.fillRect(bx,by-2,1,2);
      ctx.fillStyle=C.WHITE;
      ctx.fillRect(bx,by-1+f2,1,1);
    }
  }
}
function drawFgLampGlow(){
  if(!_candleLights.length) return;
  for(const c of _candleLights){
    if(!c.fg) continue;
    const bx=sx(c.x), by=sy(c.y);
    if(bx<-32||bx>W+32||by<-32||by>H+32) continue;
    const seed=(c.x*13+c.y*7)|0;
    const f2=((fr+seed)>>3)&1;
    const r=8;
    ctx.globalAlpha=0.55;
    ctx.fillStyle=f2?'rgba(255,210,120,0.35)':'rgba(255,180,80,0.28)';
    ctx.beginPath();ctx.arc(bx,by-2,r,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
    for(let ring=r;ring>=3;ring-=2){
      ctx.fillStyle=ring>6?(f2?C.ORANGE:C.GOLD_D):C.YELLOW;
      ctx.fillRect(bx-ring,by-1,1,1);ctx.fillRect(bx+ring,by-1,1,1);
      ctx.fillRect(bx,by-1-ring,1,1);ctx.fillRect(bx,by-1+ring,1,1);
    }
    ctx.fillStyle=f2?C.YELLOW:C.SAND;
    ctx.fillRect(bx,by-3,1,2);
    ctx.fillStyle=C.WHITE;
    ctx.fillRect(bx,by-2+f2,1,1);
  }
}

/* KNOWL DROPLET — 7×9 sprite, 2 frames */
let KNOWL_SPR=null;
function _getKnowlSpr(){
  if(!KNOWL_SPR){
    const pal={o:C.GREEN_D,g:C.GREEN,G:C.GREEN_L,W:C.WHITE,m:C.MINT,t:C.TEAL_L,h:C.LIME};
  const a=mkSpr([
    '...o...',
    '..og...',
    '..ogG..',
    '.ogGGg.',
    '.ogWGg.',
    'ogGGGgo',
    'ogGGGgo',
    '.ogGGg.',
    '..ogg..',
  ],pal);
  const b=mkSpr([
    '...o...',
    '..og...',
    '..ogG..',
    '.ogGGg.',
    '.ogGWg.',
    'ogGGGgo',
    'ogGtGgo',
    '.ogGGg.',
    '..ogg..',
  ],pal);
    KNOWL_SPR=[a,b];
  }
  return KNOWL_SPR;
}
function drawKnowl(){
  const spr=_getKnowlSpr();
  for(const k of KDROP){
    if(k.got)continue;
    const bx=sx(k.x),by=sy(k.y);
    if(bx<-10||bx>W+10||by<-10||by>H+10)continue;
    const bob=Math.round(Math.sin(fr*0.07+(k.bob||0))*1.5);
    const cy=by+bob;
    blit(spr[(fr>>4)&1],bx-3,cy-4);
    // Sparkle halo â€” gentle pulse
    const spark=(fr+((k.bob*7)|0))%32;
    if(spark<10){
      ctx.fillStyle=spark<5?C.WHITE:C.TEAL_L;
      ctx.fillRect(bx-6,cy-4,1,1);
      ctx.fillRect(bx+6,cy+3,1,1);
      ctx.fillRect(bx,cy-7,1,1);
    }
    // MAG tug stretch
    const tug=Math.hypot(k.px||0,k.py||0);
    if(tug>2){
      const tx=sx(p.x+SW/2), ty=sy(p.y+FEET_OFF-STAND_H*0.5);
      ctx.fillStyle=C.LILAC;
      pxLine(bx,cy,tx,ty,C.LILAC,1);
    }
  }
}

function _ktFill(x,y,w,h,col){
  ctx.fillStyle=col;
  ctx.fillRect(x,y,w,h);
}
function drawKnowlTree(){
  if(!_knowlTreeZone) return;
  const feetY=_knowlTreeZone.feetY!=null?_knowlTreeZone.feetY:_knowlTreeZone.y+72;
  const cx=_knowlTreeZone.x;
  const bx=sx(cx), by=sy(feetY);
  if(bx<-90||bx>W+90||by<-40||by>H+140) return;
  const u=Math.max(1, sw(2));
  const px=(ox,oy,w,h,col)=>_ktFill(bx+ox*u, by+oy*u, w*u, h*u, col);
  px(-7,0,3,2,C.BROWN_D); px(4,0,3,2,C.BROWN_D);
  px(-5,-1,2,2,C.BROWN); px(3,-1,2,2,C.BROWN);
  px(-3,-22,6,22,C.BROWN_D);
  px(-2,-22,4,21,C.BROWN);
  px(-1,-21,1,18,C.TAN);
  px(1,-20,1,8,C.BROWN_D);
  px(-2,-8,1,3,C.BROWN_D);
  px(-14,-36,28,16,C.GREEN_D);
  px(-12,-40,24,12,C.GREEN);
  px(-10,-44,20,10,C.GREEN_L);
  px(-8,-47,16,7,C.MINT);
  px(-16,-32,8,10,C.GREEN_D);
  px(8,-33,8,10,C.GREEN_D);
  px(-15,-34,7,8,C.GREEN);
  px(8,-35,7,8,C.GREEN);
  px(-6,-42,5,4,C.LIME);
  px(2,-43,4,3,C.MINT);
  px(-9,-45,3,2,C.LIME);
  px(5,-46,2,2,'#d8f090');
  const glow=(fr&1)?C.TEAL_L:C.CYAN;
  px(-8,-28,2,2,C.GREEN_D);
  px(-8,-26,3,3,C.TEAL_L);
  px(-7,-25,1,1,C.WHITE);
  px(6,-29,2,2,C.GREEN_D);
  px(6,-27,3,3,glow);
  px(7,-26,1,1,C.WHITE);
  px(0,-30,2,2,C.GREEN_D);
  px(0,-28,3,3,C.MINT);
  px(1,-27,1,1,C.WHITE);
  if(fr%20<14){
    px(-11,-41,1,1,C.WHITE);
    px(9,-39,1,1,C.LIME);
    px(1,-48,1,1,C.TEAL_L);
  }
}

function drawKnowlTreeAura(){
  if(!_knowlTreeZone) return;
  const tx=sx(_knowlTreeZone.x), ty=sy(_knowlTreeZone.y);
  if(tx<-40||ty<-40||tx>W+40||ty>H+40) return;
  // Sparse rotating ring of green pixels marks the zone
  const r=sw(_knowlTreeZone.r);
  ctx.fillStyle=(fr&1)?C.TEAL_L:C.GLOW_L;
  for(let i=0;i<12;i++){
    const a=fr*0.02+i*(Math.PI/6);
    ctx.fillRect(tx+Math.round(Math.cos(a)*r),ty+Math.round(Math.sin(a)*r),1,1);
  }
  if(_nearKnowlTree(p)&&fr%18<9){
    drawTextC('KNOWL TREE: 2X RESTORE',tx,ty-r-8,C.TEAL_L);
  }
}

function drawItemDrops(){
  if(typeof ITEM_DROPS==='undefined'||!ITEM_DROPS.length) return;
  const names=typeof INAMES!=='undefined'?INAMES:['TRS','RCA','XLR','MEG'];
  const cols=typeof ICOLS!=='undefined'?ICOLS:['#d4aa40','#e87820','#c8cdd4','#e02028'];
  for(const d of ITEM_DROPS){
    if(d.got) continue;
    const bob=Math.sin((d.bob||0))*3;
    const dw=Math.max(sw(d.w),16), dh=Math.max(sw(d.h),16);
    const dx=sx(d.x), dy=sy(d.y+bob);
    if(dx>W+28||dy>H+28||dx+dw<-28||dy+dh<-28) continue;
    const enh=!!d.enhanced;
    const cx=dx+dw*0.5, cy=dy+dh*0.46;
    ctx.fillStyle='#08060e';
    ctx.fillRect(dx-1,dy+dh-3,dw+2,4);
    ctx.fillStyle='#121018';
    ctx.fillRect(dx,dy,dw,dh);
    ctx.fillStyle=enh?'#16301c':'#2a2438';
    ctx.fillRect(dx+2,dy+2,dw-4,dh-4);
    ctx.fillStyle=enh?'#3dff88':'#6a5a88';
    ctx.fillRect(dx+2,dy+2,dw-4,2);
    ctx.fillStyle='#0a0814';
    ctx.fillRect(dx+2,dy+dh-4,dw-4,2);
    ctx.fillStyle=enh?'#245830':'#3a3050';
    for(let yy=8;yy<dh-6;yy+=6) ctx.fillRect(dx+3,dy+yy,dw-6,1);
    if(enh){
      const pulse=0.16+0.14*Math.sin(fr*0.14+d.item);
      ctx.globalAlpha=pulse;
      ctx.fillStyle='#3dff88';
      ctx.fillRect(dx+3,dy+3,dw-6,dh-6);
      ctx.globalAlpha=1;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx+4, dy+4, dw-8, dh-10);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.scale(0.40, 0.40);
    drawConnectorTip(0,0,-0.55,enh?4:0,d.item,enh);
    ctx.restore();
    const tag=enh?(names[d.item]||'?')+'+':(names[d.item]||'?');
    drawTextC(tag,cx,dy+dh+2,enh?'#e2b64a':(cols[d.item]||C.WHITE),1);
  }
}
// RCA rope tip: a strong magnet puck on the end of the cord (Paulo, Oct 20).
// ang points from the tip back along the cord. Latched: it clamps flat and its field pulses.
// RCA rope (Paulo's sketch, Oct 21): the cord lives coiled on a spool inside the jack; the
// tip is a strong magnet BALL. ang points from the tip back along the cord.
function _drawRopeMagnetTip(x,y,ang,latched,glow){
  const r=Math.max(4,7/(typeof SMS_SCALE!=='undefined'?SMS_SCALE:1));
  ctx.save(); ctx.translate(x,y);
  if(latched){                                            // the field pulsing round the ball where it holds
    const pulse=0.5+0.5*Math.sin(fr*0.25);
    ctx.strokeStyle=glow; ctx.lineWidth=1.5;
    for(let k=1;k<=2;k++){ ctx.globalAlpha=(0.5-k*0.15)*(0.6+0.4*pulse); ctx.beginPath(); ctx.arc(0,0,r*(1.25+k*0.5+pulse*0.2),0,Math.PI*2); ctx.stroke(); }
    ctx.globalAlpha=1;
  }
  ctx.fillStyle='#2a2830'; ctx.fillRect(Math.cos(ang)*r*0.6-2,Math.sin(ang)*r*0.6-2,4,4);   // the collar where the cord goes in
  const g=ctx.createRadialGradient(-r*0.35,-r*0.4,r*0.15,0,0,r);
  g.addColorStop(0,'#f4f2fa'); g.addColorStop(0.35,'#a8a6b8'); g.addColorStop(1,'#3a3846');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#18161e'; ctx.lineWidth=1.2; ctx.stroke();
  ctx.restore();
}
// The jack end (Paulo, Oct 21): no spool showing — the cord just comes out of the
// jack's tip, from inside it: a small dark mouth where it goes in.
function _drawRopeSpool(x,y,h,col,glow,ang){
  const sc=typeof SMS_SCALE!=='undefined'?SMS_SCALE:1, r=Math.max(2.2,3.2/sc);
  ctx.save(); ctx.fillStyle='rgba(12,8,18,0.9)'; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); ctx.restore();
}
// a braided cord: two strands of short alternating ticks that run along it as it reels
function _drawRopeBraid(wpts,phase,colA,colB){
  ctx.save(); ctx.lineCap='butt'; ctx.lineWidth=3;
  for(const [col,off] of [[colA,0],[colB,4]]){
    ctx.setLineDash([3,5]); ctx.lineDashOffset=-phase+off;
    ctx.strokeStyle=col; ctx.beginPath(); ctx.moveTo(wpts[wpts.length-1].x,wpts[wpts.length-1].y);
    for(let i=wpts.length-2;i>=0;i--) ctx.lineTo(wpts[i].x,wpts[i].y);
    ctx.stroke();
  }
  ctx.restore();
}
function drawRopePickup(){
  if(!_mapRopePickup||_mapRopePickup.got) return;
  const r=_mapRopePickup;
  const rw=Math.max(sw(r.w),24), rh=Math.max(sw(r.h),24);
  const rx=sx(r.x), ry=sy(r.y), cx2=rx+(rw>>1), cy2=ry+(rh>>1)+Math.sin(fr*0.08)*2;
  if(rx>W+20||ry>H+20||rx+rw<-20||ry+rh<-20) return;
  if(fr%16<12){
    ctx.fillStyle=C.ORANGE;
    ctx.fillRect(rx,ry,rw,1);ctx.fillRect(rx,ry+rh-1,rw,1);
    ctx.fillRect(rx,ry,1,rh);ctx.fillRect(rx+rw-1,ry,1,rh);
  }
  drawConnectorTip(cx2,cy2,Math.PI*0.5,fr%18<9?6:0,1);
}

function drawRopePickupAnim(){
  if(!_ropePickupAnim) return;
  const a=_ropePickupAnim, prog=Math.min(1,a.t/48);
  const tx=p.x+SW*0.5, ty=p.y+FEET_OFF-STAND_H*0.45;
  const px=a.sx+(tx-a.sx)*prog, py=a.sy+(ty-a.sy)*prog-Math.sin(prog*Math.PI)*28;
  const bx=sx(px), by=sy(py);
  if((fr&1)===0) pxLine(sx(a.sx),sy(a.sy),bx,by,C.RED_L);
  ctx.fillStyle=C.ORANGE;ctx.fillRect(bx-1,by-1,3,3);
  ctx.fillStyle=C.SAND;ctx.fillRect(bx-1,by-1,1,1);
}

function drawItemTutorial(){
  if(!_itemTutorial) return;
  const t=_itemTutorial;
  // Flicker in/out instead of alpha fades
  if(t.t<24&&(fr&1)) return;
  if(t.t>t.maxT-40&&(fr&1)) return;
  const boxW=Math.min(W-24,420), boxH=28+t.lines.length*20;
  const bx=(W-boxW)>>1, by=H-boxH-16;
  ctx.fillStyle=C.BLACK;ctx.fillRect(bx,by,boxW,boxH);
  ctx.fillStyle=C.GREEN;
  ctx.fillRect(bx,by,boxW,2);ctx.fillRect(bx,by+boxH-2,boxW,2);
  ctx.fillRect(bx,by,2,boxH);ctx.fillRect(bx+boxW-2,by,2,boxH);
  drawTextC(t.title,bx+(boxW>>1),by+6,C.GREEN_L,2);
  let ly=by+28;
  for(const line of t.lines){
    drawTextC(line,bx+(boxW>>1),ly,C.MINT,2);
    ly+=20;
  }
}


function _clampSegFrom(shX,shY,tx,ty){
  let minT=1;
  for(const pl of allP()){
    if(pl.tp!=='solid'&&pl.tp!=='ceil')continue;
    const hit=segHit(shX,shY,tx,ty,pl);
    if(!hit)continue;
    const segLen=Math.hypot(tx-shX,ty-shY)||1;
    const t=Math.hypot(hit.tx-shX,hit.ty-shY)/segLen;
    if(t<minT)minT=t;
  }
  if(minT>=1) return {x:tx,y:ty};
  const pull=Math.max(0,minT-0.03);
  return {x:shX+(tx-shX)*pull,y:shY+(ty-shY)*pull};
}

// Single source of truth for connector arm + RCA nose (world coords).
// computeConnectorArmPose lives in player.js (one copy: the down-use pose and the duck blend are there)

function connectorTipWorld(itemOverride=ITEM){
  const pose=computeConnectorArmPose();
  if(itemOverride===1) return {x:pose.noseX,y:pose.noseY};
  const a=pose.aimAngle;
  const sc=typeof _itemArtScale==='function'?_itemArtScale(itemOverride):1;
  const reach=(itemOverride===2?42:itemOverride===0?50:40)*sc;
  return {x:pose.tipX+Math.cos(a)*reach,y:pose.tipY+Math.sin(a)*reach};
}
// Dotted pixel line (every `gap`-th pixel) â€” SMS dash effect.
function pxDots(x0,y0,x1,y1,col,gap=3,phase=0){
  const dx=x1-x0,dy=y1-y0;
  const len=Math.max(1,Math.round(Math.hypot(dx,dy)));
  ctx.fillStyle=col;
  for(let i=phase%gap;i<=len;i+=gap){
    ctx.fillRect(Math.round(x0+dx*i/len),Math.round(y0+dy*i/len),1,1);
  }
}
function drawFX(){
  // â”€â”€ XLR push stream â€” energy shoulder â†’ jack tip â”€â”€
  if(ITEM===2&&p.xlrOn){
    const pose=p._armPose||computeConnectorArmPose(p);
    const ax=sx(pose.connShX),ay=sy(pose.connShY);
    const tipW=connectorTipWorld(2);
    const tx=sx(tipW.x),ty=sy(tipW.y);
    const aa=pose.aimAngle;
    const pulse=0.4+0.6*Math.sin(fr*0.3);
    for(let i=0;i<5;i++){
      const t=((fr*0.1+i*0.18)%1);
      const px=ax+(tx-ax)*t,py=ay+(ty-ay)*t;
      ctx.globalAlpha=pulse*(0.4+0.35*Math.sin(fr*0.4+i));
      ctx.fillStyle='#88ccff';ctx.beginPath();ctx.arc(px,py,2.2,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#66bbff';ctx.lineWidth=1.6;
      ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+Math.cos(aa)*8,py+Math.sin(aa)*8);ctx.stroke();
    }
    for(let i=0;i<3;i++){
      const wave=((fr*0.09+i*0.22)%1);
      const r=6+wave*34;
      ctx.globalAlpha=(1-wave)*pulse*0.55;
      ctx.strokeStyle='#66bbff';ctx.lineWidth=2.2-wave;
      ctx.beginPath();ctx.arc(tx,ty,r,aa-0.42,aa+0.42);ctx.stroke();
    }
    ctx.globalAlpha=pulse*0.35;ctx.strokeStyle='#aaddff';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(tx,ty);ctx.stroke();
    ctx.globalAlpha=1;
  }
  // â”€â”€ MAG pull stream â€” energy tip â†’ shoulder â”€â”€
  if(ITEM===3&&p.magOn){
    const pose=p._armPose||computeConnectorArmPose(p);
    const ax=sx(pose.connShX),ay=sy(pose.connShY),tx=sx(pose.tipX),ty=sy(pose.tipY);
    const pulse=0.4+0.6*Math.sin(fr*0.25);
    const magCol=p.hero==='venture'?'#ff6688':'#ee99ff';
    const magStroke=p.hero==='venture'?'#ff3344':'#dd88ff';
    for(let i=0;i<5;i++){
      const t=((fr*0.11+i*0.17)%1);
      const px=tx+(ax-tx)*t,py=ty+(ay-ty)*t;
      ctx.globalAlpha=pulse*0.55;
      ctx.fillStyle=magCol;ctx.beginPath();ctx.arc(px,py,2,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=magStroke;ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+(ax-px)*0.12,py+(ay-py)*0.12);ctx.stroke();
    }
    ctx.globalAlpha=1;
  }
  // â”€â”€ LASER SHOTS â€” fast plasma bolts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const _allShots=(p2&&p2.shots)?p.shots.concat(p2.shots):p.shots;
  const _laserList=_allShots.concat((typeof ESHOTS!=='undefined'?ESHOTS:[]).filter(s=>s&&s.type==='laser'));
  for(const s of _laserList){
    const bx=sx(s.x),by=sy(s.y);
    if(bx<-24||bx>W+24||by<-24||by>H+24)continue;
    const isVenture=s.owner==='venture';
    const charged=s.charged||false;
    const isEnemy=s.owner==='enemy'||s.col==='#ff4400'||s.col==='#ff3355'||s.col==='#ff5533';
    const enhShot=!!s.enhanced&&!isEnemy;
    const core=isEnemy?'#ffe8e0':(enhShot?(isVenture?'#ffe8e0':'#ffe8ff'):(isVenture?'#ffe0e8':'#f0e0ff'));
    const mid=isEnemy?'#ff3333':(enhShot?(isVenture?'#ff2244':'#c040ff'):(isVenture?'#ff4466':'#bb55ff'));
    const glow=isEnemy?'#cc1111':(enhShot?(isVenture?'#8a0018':'#4a0080'):(isVenture?'#ff2244':'#7722cc'));
    if(s._fizzle){
      const t=s._fizzle/16;
      const shimmer=0.35+0.65*Math.abs(Math.sin(fr*0.85+(s.born||0)*0.5));
      const ring=10+(1-t)*14;
      for(let i=0;i<10;i++){
        const ang=fr*0.18+i*(Math.PI*2/10);
        const px=bx+Math.cos(ang)*ring, py=by+Math.sin(ang)*ring;
        ctx.globalAlpha=t*shimmer*0.75;
        ctx.fillStyle=i%2?mid:core;
        ctx.beginPath();ctx.arc(px,py,1.2+t*2.2,0,Math.PI*2);ctx.fill();
      }
      ctx.globalAlpha=t*shimmer*0.55;
      ctx.strokeStyle=glow;ctx.lineWidth=1.5+t*3;
      ctx.beginPath();ctx.arc(bx,by,ring*0.55,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=t*shimmer;
      ctx.fillStyle='#ffffff';
      ctx.beginPath();ctx.arc(bx,by,2+t*4,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;
      continue;
    }
    const sp=Math.hypot(s.vx,s.vy)||1;
    const ux=s.vx/sp,uy=s.vy/sp;
    const spdFac=isEnemy?1:Math.min(1,sp/16);
    const trailLen=(charged?34:20)*Math.max(isEnemy?0.95:0.7,spdFac)*(enhShot?2.15:1);
    const headLen=(charged?10:6)*Math.max(0.7,spdFac);
    const pulse=0.72+0.28*Math.sin(fr*0.55+(s.born||0)*0.4);
    const vis=isEnemy?1:Math.max(0.45,spdFac);
    ctx.lineCap='round';
    ctx.globalAlpha=0.28*pulse*vis;
    ctx.strokeStyle=glow;ctx.lineWidth=charged?18:9;
    ctx.beginPath();ctx.moveTo(bx-ux*trailLen,by-uy*trailLen);ctx.lineTo(bx+ux*headLen,by+uy*headLen);ctx.stroke();
    ctx.globalAlpha=0.62*pulse*vis;
    ctx.strokeStyle=mid;ctx.lineWidth=charged?8:3.5;
    ctx.beginPath();ctx.moveTo(bx-ux*(trailLen*0.72),by-uy*(trailLen*0.72));ctx.lineTo(bx+ux*headLen,by+uy*headLen);ctx.stroke();
    ctx.globalAlpha=0.95*vis;
    ctx.strokeStyle=core;ctx.lineWidth=charged?4:1.8;
    ctx.beginPath();ctx.moveTo(bx-ux*(trailLen*0.35),by-uy*(trailLen*0.35));ctx.lineTo(bx+ux*headLen,by+uy*headLen);ctx.stroke();
    ctx.fillStyle='#ffffff';
    ctx.beginPath();ctx.arc(bx+ux*2,by+uy*2,charged?3.2:1.6,0,Math.PI*2);ctx.fill();
    if(charged){
      ctx.globalAlpha=0.35+0.25*Math.sin(fr*0.8);
      ctx.strokeStyle=enhShot?(isVenture?'#ff88aa':'#e080ff'):(isVenture?'#ff88aa':'#cc88ff');ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(bx+ux*3,by+uy*3,7+Math.sin(fr*0.35)*2,0,Math.PI*2);ctx.stroke();
    }else{
      ctx.globalAlpha=0.45;
      ctx.strokeStyle=mid;ctx.lineWidth=1;
      for(let k=1;k<=3;k++){
        ctx.beginPath();ctx.moveTo(bx-ux*k*4,by-uy*k*4);ctx.lineTo(bx-ux*(k*4-1.5),by-uy*(k*4-1.5));ctx.stroke();
      }
    }
    ctx.globalAlpha=1;
    if(enhShot&&s.tracer&&s.tracer.length>1){
      ctx.lineCap='round';
      const tr=s.tracer;
      for(let i=1;i<tr.length;i++){
        const a=i/(tr.length-1);
        ctx.globalAlpha=a*0.72;
        ctx.strokeStyle=i>tr.length-4?(isVenture?'#ffc0c8':'#e8b8ff'):(isVenture?'#c01830':'#7a20d8');
        ctx.lineWidth=1.1+a*3.4;
        ctx.beginPath();
        ctx.moveTo(sx(tr[i-1].x),sy(tr[i-1].y));
        ctx.lineTo(sx(tr[i].x),sy(tr[i].y));
        ctx.stroke();
      }
      ctx.globalAlpha=1;
    }
  }
  if(typeof TRS_FLAMES!=='undefined'&&TRS_FLAMES.length){
    for(const f of TRS_FLAMES){
      const bx=sx(f.x),by=sy(f.y);
      if(bx<-28||bx>W+28||by<-28||by>H+28) continue;
      const t=Math.max(0,f.life/f.maxLife);
      const flick=0.7+0.3*Math.sin(fr*0.55+(f.born||0));
      const h=14+flick*9;
      const ven=f.hero==='venture';
      const glow=ven?'#8a1020':'#4a148c';
      const outer=ven?'#ff2244':'#9b30ff';
      const mid=ven?'#ff6680':'#c060ff';
      const core=ven?'#ffe0e4':'#f0d8ff';
      ctx.globalAlpha=0.32*t;
      ctx.fillStyle=glow;
      ctx.beginPath();ctx.ellipse(bx,by+3,12*t,5.2,0,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=0.88*t*flick;
      ctx.fillStyle=outer;
      ctx.beginPath();ctx.moveTo(bx-6.4,by+3);ctx.lineTo(bx,by-h);ctx.lineTo(bx+6.4,by+3);ctx.closePath();ctx.fill();
      ctx.globalAlpha=0.95*t;
      ctx.fillStyle=mid;
      ctx.beginPath();ctx.moveTo(bx-3.4,by+2);ctx.lineTo(bx,by-h*0.68);ctx.lineTo(bx+3.4,by+2);ctx.closePath();ctx.fill();
      ctx.fillStyle=core;
      ctx.fillRect(bx-1.0,by-h*0.32,2.0,h*0.48);
      if(f.sparks){
        for(const sp of f.sparks){
          const a=Math.max(0,sp.life/34);
          ctx.globalAlpha=a*t*0.9;
          ctx.fillStyle=sp.life>10?outer:core;
          ctx.beginPath();ctx.arc(sx(sp.x),sy(sp.y),sp.r*a,0,Math.PI*2);ctx.fill();
        }
      }
      ctx.globalAlpha=1;
    }
  }
  // â”€â”€ XLR pulses â€” expanding arc waves from jack tip â”€â”€
  for(const pu of p.pulses){
    const bx=sx(pu.x),by=sy(pu.y);
    const frac=pu.r/pu.maxR,spread=Math.PI*0.44;
    ctx.globalAlpha=(1-frac)*0.55;
    ctx.strokeStyle='#4488ff';ctx.lineWidth=3-frac*2;
    ctx.beginPath();ctx.arc(bx,by,pu.r,pu.a-spread,pu.a+spread);ctx.stroke();
    ctx.lineWidth=1;ctx.strokeStyle='#88bbff';
    ctx.beginPath();ctx.arc(bx,by,pu.r*0.65,pu.a-spread*0.7,pu.a+spread*0.7);ctx.stroke();
    ctx.globalAlpha=1;
  }
  // â”€â”€ Mag particles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  for(const m of p.magPts){
    ctx.globalAlpha=m.life/18*0.6;
    ctx.fillStyle=p.hero==='venture'?'#ff6688':'#ff66ff';
    ctx.fillRect(sx(m.x)-1,sy(m.y)-1,3,3);
    ctx.globalAlpha=1;
  }
  // â”€â”€ Wheel smoke puffs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if(p.smoke){
    for(const sm of p.smoke){
      const t=sm.life/sm.maxLife;
      ctx.globalAlpha=t*0.55;
      ctx.fillStyle=`rgba(200,200,220,${t*0.6})`;
      ctx.beginPath();ctx.arc(sx(sm.x),sy(sm.y),sm.r*(1.5-t*0.5),0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
  }
  // â”€â”€ Hook cable â€” braided cord from RCA pin tip â”€â”€â”€â”€â”€â”€â”€â”€â”€
  drawHookCable();
}
// the RCA cord of whoever `p` is (the companion draws its own through drawCharacterFor-style swaps)
function drawHookCable(){
  if(!p.hook||p.hook.st==='idle') return;
  {
    const _isVenture=p.hero==='venture';
    const _ropeDash=_isVenture?'#aa3348':'#8833cc';
    const _ropeGlow=_isVenture?'#ee8899':'#cc66ff';
    const _ropeDark=_isVenture?'#3a0d14':'#2a0050';
    const _ropeMain=_isVenture?'#8f1f35':'#6600bb';
    const _ropeHigh=_isVenture?'#df6a84':'#aa44ff';
    const _ropeDotA=_isVenture?'#f0a5b2':'#cc88ff';
    const _ropeDotB=_isVenture?'#7a2638':'#5500aa';
    const _ropeAnchorA=_isVenture?'#a03f54':'#8833cc';
    const _ropeAnchorB=_isVenture?'#e3a3ae':'#cc88ff';
    const _ap=p._armPose||computeConnectorArmPose(p);
    // the rope's drawn end: the RCA in MIND's hand, the clip on his disc (another item out),
    // or the plug on its way between them (beta_feel ropeClip animation)
    const _clipQ=window.MV_BETA&&MV_BETA.ropeClipPoint?MV_BETA.ropeClipPoint():null;
    const _onBody=p.hook.st==='on'&&typeof _ropeInHand==='function'&&!_ropeInHand()&&typeof hookAttachWorld==='function';
    // plugged into the upper back: the pin points into the body, the cord leaves the boot
    let _plug=null, _wn;
    if(_clipQ||_onBody){
      const tip=_clipQ||hookAttachWorld();
      const seat=p.fc?0.55:Math.PI-0.55;                       // in from behind, angled down into the back's top corner
      const into=(_clipQ&&_clipQ.ang!=null)?_clipQ.ang*(1-_clipQ.k)+seat*_clipQ.k:seat;
      const sc=0.7, pin=44.5*sc, boot=18*sc;
      const ox=tip.x-Math.cos(into)*pin, oy=tip.y-Math.sin(into)*pin;
      _plug={ox,oy,ang:into,tx:tip.x,ty:tip.y};
      _wn={x:ox-Math.cos(into)*boot, y:oy-Math.sin(into)*boot};
    }else _wn=_ap.worldNose||{x:_ap.noseX,y:_ap.noseY};
    const bx=sx(_wn.x), by=sy(_wn.y);
    if(p.hook.st==='ext'){
      const ex=sx(p.hook.ex), ey=sy(p.hook.ey);
      ctx.lineCap='round';
      ctx.strokeStyle=_ropeDark;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(ex,ey);ctx.stroke();
      ctx.strokeStyle=_ropeMain;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(ex,ey);ctx.stroke();
      p.hook._flyPh=(p.hook._flyPh||0)+6;                    // the cord streams off the spool
      _drawRopeBraid([{x:ex,y:ey},{x:bx,y:by}],p.hook._flyPh,_ropeDotA,_ropeDark);
      _drawRopeMagnetTip(ex,ey,Math.atan2(by-ey,bx-ex),false,_ropeGlow);
      p.hook._spoolA=(p.hook._spoolA||0)+0.6;               // the spool spins as the cord pays out
      _drawRopeSpool(bx,by,p.hook,_ropeMain,_ropeGlow,Math.atan2(ey-by,ex-bx));
    }else if(p._jackOnSurface&&!_onBody&&!_clipQ){
      // Paulo's sketch (Oct 21): reeled in close, the jack's magnet tip sits right on the
      // wall / floor / ceiling and the coil arm holds MIND to it — no cord showing
      _drawRopeMagnetTip(bx,by,Math.atan2(sy(_ap.tipY)-by,sx(_ap.tipX)-bx),true,_ropeGlow);
    }else{
      const end=ropePlayerEndWorld();
      const taut0=p.hook._path||_ropePathPts(p.hook,end.x,end.y);
      // the cord ends in the jack you see — set before the cord is shaped, so its rock
      // collision covers the last stretch too
      const taut=taut0.slice(); if(taut.length) taut[taut.length-1]={x:_wn.x,y:_wn.y};
      const path=typeof _ropeSlackDrawPts==='function'?_ropeSlackDrawPts(taut,p.hook.rl):taut;
      const wpts=path.map(pt=>({x:sx(pt.x),y:sy(pt.y)}));
      ctx.lineCap='round';ctx.lineJoin='round';
      // pulled straight under MIND's weight the cord draws thinner, with a bright strain line (Oct 22)
      const _taut=path===taut;
      const layers=_taut?[{c:_ropeDark,w:6},{c:_ropeMain,w:4},{c:_ropeHigh,w:2},{c:'rgba(255,255,255,0.55)',w:1}]
                        :[{c:_ropeDark,w:7},{c:_ropeMain,w:5},{c:_ropeHigh,w:2}];
      for(const L of layers){
        ctx.strokeStyle=L.c;ctx.lineWidth=L.w;
        ctx.beginPath();ctx.moveTo(wpts[0].x,wpts[0].y);
        if(wpts.length<3){ for(let i=1;i<wpts.length;i++) ctx.lineTo(wpts[i].x,wpts[i].y); }
        else{                                   // a smooth curve through the rope points (no zig-zag)
          for(let i=1;i<wpts.length-1;i++) ctx.quadraticCurveTo(wpts[i].x,wpts[i].y,(wpts[i].x+wpts[i+1].x)/2,(wpts[i].y+wpts[i+1].y)/2);
          ctx.lineTo(wpts[wpts.length-1].x,wpts[wpts.length-1].y);
        }
        ctx.stroke();
      }
      // braid marks that travel along the cord: they run toward the jack while
      // reeling in and away from it while paying out slack (Paulo, Oct 20)
      _drawRopeBraid(wpts,(p.hook._reelPhase||0)/SMS_SCALE,_ropeDotA,_ropeDark);
      const ax=wpts[0].x, ay=wpts[0].y, nb=wpts[Math.min(1,wpts.length-1)];
      _drawRopeMagnetTip(ax,ay,Math.atan2(nb.y-ay,nb.x-ax),true,_ropeGlow);
      const pe=wpts[Math.max(0,wpts.length-2)];
      if(_plug){                                              // RCA pin seating in the socket between the shoulders
        const sock=sx(_plug.tx), soy=sy(_plug.ty);
        ctx.save(); ctx.fillStyle='#12141c'; ctx.beginPath(); ctx.ellipse(sock,soy,5,3.5,0,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='#6a7080'; ctx.lineWidth=1.5; ctx.stroke(); ctx.restore();
        ctx.save(); ctx.translate(sx(_plug.ox),sy(_plug.oy)); ctx.scale(0.7,0.7);
        if(typeof drawConnectorTip==='function') drawConnectorTip(0,0,_plug.ang,0,1,false);
        ctx.restore();
      }
      if(!_plug) _drawRopeSpool(bx,by,p.hook,_ropeMain,_ropeGlow,Math.atan2(pe.y-by,pe.x-bx));
    }
  }
}
