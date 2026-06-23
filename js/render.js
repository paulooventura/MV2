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
  ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
  ctx.fillStyle='#14101c';ctx.fill();
  // Knobby off-road tread blocks (rotate with wheel)
  ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);
  const nTread=12;
  for(let i=0;i<nTread;i++){
    const a=i*(Math.PI*2/nTread);
    const tx=Math.cos(a)*R*0.82, ty=Math.sin(a)*R*0.82;
    if(pal.tread){
      ctx.fillStyle=i%2?'#143820':'#1a5030';
      ctx.fillRect(tx-2.5,ty-3.5,5,7);
      ctx.fillStyle='#0a2818';
      ctx.fillRect(tx-1.5,ty-2.5,3,5);
    }else{
      ctx.fillStyle=i%2?'#1c1824':'#242030';
      ctx.fillRect(tx-2.5,ty-3.5,5,7);
      ctx.fillStyle='#0a0810';
      ctx.fillRect(tx-1.5,ty-2.5,3,5);
    }
  }
  ctx.restore();
  ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
  ctx.strokeStyle='#0a0810';ctx.lineWidth=4;ctx.stroke();
  for(let b=0;b<3;b++){
    const bAngle=angle+b*(Math.PI*2/3);
    ctx.save();ctx.translate(cx,cy);ctx.rotate(bAngle);
    ctx.beginPath();
    ctx.moveTo(2,-2);
    ctx.bezierCurveTo(spR*0.3,-spR*0.5,spR*0.7,-spR*0.9,spR*0.88,-spR*0.25);
    ctx.bezierCurveTo(spR*0.9,0,spR*0.6,spR*0.3,2,2);
    ctx.closePath();ctx.fillStyle=pal.b1;ctx.fill();
    ctx.beginPath();
    ctx.moveTo(3,-3);
    ctx.bezierCurveTo(spR*0.25,-spR*0.4,spR*0.55,-spR*0.75,spR*0.72,-spR*0.2);
    ctx.bezierCurveTo(spR*0.75,-spR*0.05,spR*0.5,spR*0.18,3,1);
    ctx.closePath();ctx.fillStyle=pal.b2;ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4,-4);
    ctx.bezierCurveTo(spR*0.2,-spR*0.35,spR*0.45,-spR*0.6,spR*0.6,-spR*0.18);
    ctx.strokeStyle=pal.b3;ctx.lineWidth=1.5;ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();ctx.arc(cx,cy,spR*0.28,0,Math.PI*2);
  ctx.fillStyle='#080612';ctx.fill();
  if(!isFinite(cx)||!isFinite(cy)) return;
  const g=ctx.createRadialGradient(cx-2,cy-2,0,cx,cy,spR*0.28);
  g.addColorStop(0,'#d0d4dc');g.addColorStop(0.5,'#9098a8');g.addColorStop(1,'#505060');
  ctx.beginPath();ctx.arc(cx,cy,spR*0.28,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
  ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);
  ctx.strokeStyle=pal.spin;ctx.lineWidth=1.5;
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2;
    ctx.beginPath();ctx.moveTo(Math.cos(a)*spR*0.3,Math.sin(a)*spR*0.3);
    ctx.lineTo(Math.cos(a)*spR*0.88,Math.sin(a)*spR*0.88);ctx.stroke();
  }
  ctx.restore();
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
  ctx.beginPath();ctx.arc(cx,cy,2.5,0,Math.PI*2);ctx.fillStyle='#1a1428';ctx.fill();
  ctx.beginPath();ctx.arc(cx-0.7,cy-0.7,1,0,Math.PI*2);ctx.fillStyle='#a0a4b0';ctx.fill();
  ctx.restore();
}
function drawHostileWheel(cx,cy,angle){
  drawWheel(cx,cy,angle,{_wheelHostile:true,hero:'venture',vx:0,wallGrip:0,duckCharge:0,runRamp:0,duckBoostReady:false});
}

/* -- HS8 Body â€” shaded studio monitor cabinet -- */
function drawBody(bx,by,facing,ca2=0,status=null){
  const bw=52,bh=42;
  const x=bx-bw/2,y=by;
  const isVenture=p.hero==='venture';
  const faceDark=isVenture?'#180808':'#0c0c18';
  const faceMid=isVenture?'#220e0e':'#0e0e1c';
  ctx.fillStyle=faceDark;ctx.fillRect(x,y,bw,bh);
  ctx.fillStyle=faceMid;ctx.fillRect(x+1,y+1,bw-2,bh-2);
  const scx=x+(facing?bw*0.38:bw*0.62),scy=y+bh*0.56;
  for(let r=18;r>1;r-=4){
    ctx.beginPath();ctx.arc(scx,scy,r,0,Math.PI*2);
    ctx.fillStyle='rgba(5,5,14,0.95)';ctx.fill();
    ctx.strokeStyle='rgba(25,25,42,0.8)';ctx.lineWidth=0.5;ctx.stroke();
  }
  ctx.beginPath();ctx.arc(scx,scy,5,0,Math.PI*2);ctx.fillStyle='#181828';ctx.fill();
  ctx.beginPath();ctx.arc(scx,scy,2,0,Math.PI*2);ctx.fillStyle='#202034';ctx.fill();
  const tx=x+(facing?bw*0.72:bw*0.28),ty=y+bh*0.22;
  ctx.beginPath();ctx.arc(tx,ty,5,0,Math.PI*2);ctx.fillStyle='#080814';ctx.fill();
  ctx.beginPath();ctx.arc(tx,ty,3,0,Math.PI*2);ctx.fillStyle='#0d0d1e';ctx.fill();
  ctx.beginPath();ctx.arc(tx,ty,1.5,0,Math.PI*2);ctx.fillStyle='#141428';ctx.fill();
  const hpx=x+(facing?bw-10:2),hpy=y+3,hpw=6,hph=bh-6;
  ctx.fillStyle='#03030a';ctx.fillRect(hpx,hpy,hpw,hph);
  const maxHp=status?(status.mhp||1):(p.maxHp||PLAYER_MAX_HP);
  const hp=status?(status.hp||0):(p.hp||0);
  const liveFrac=maxHp>0?Math.max(0,Math.min(1,hp/maxHp)):0;
  const filH=Math.max(0,Math.floor((hph-2)*liveFrac));
  const hcol=liveFrac>0.6?'#00bb44':liveFrac>0.35?'#ffaa00':'#ff2200';
  if(liveFrac<=0.35&&fr%16<8)ctx.fillStyle='#ff6666';else ctx.fillStyle=hcol;
  ctx.fillRect(hpx+1,hpy+1+(hph-2-filH),hpw-2,filH);
  const lifeSegs=status?Math.max(1,Math.ceil(maxHp/PLAYER_HIT_DMG)):MAXLIVES;
  for(let i=1;i<lifeSegs;i++){ctx.fillStyle='#03030a';ctx.fillRect(hpx+1,hpy+1+Math.floor((hph-2)*i/lifeSegs),hpw-2,1);}
  ctx.fillStyle='#06060e';ctx.fillRect(hpx+1,hpy-2,hpw-2,3);
  const dotOff=status&&status.off;
  const dotX=x+(facing?4:bw-4),dotY=y+bh-4;
  if(dotOff){
    ctx.beginPath();ctx.arc(dotX,dotY,2.5,0,Math.PI*2);ctx.fillStyle='#880000';ctx.fill();
    ctx.beginPath();ctx.arc(dotX,dotY,1.5,0,Math.PI*2);
    ctx.fillStyle='#ff3333';ctx.globalAlpha=0.75;ctx.fill();ctx.globalAlpha=1;
  }else{
    ctx.beginPath();ctx.arc(dotX,dotY,2.5,0,Math.PI*2);ctx.fillStyle='#00cc44';ctx.fill();
    ctx.beginPath();ctx.arc(dotX,dotY,1.5,0,Math.PI*2);
    ctx.fillStyle='#00ff66';ctx.globalAlpha=0.6;ctx.fill();ctx.globalAlpha=1;
  }
}

function _drawMindWideHat(cx,drawY,R,hatTX,hatTY){
  const tx=Math.round((hatTX||0)*12);
  const ty=Math.round((hatTY||0)*9);
  const hatBrimY=drawY-R+2+ty, crownH=9, hatTopY=hatBrimY-crownH;
  ctx.fillStyle='#020202';ctx.fillRect(cx-10+tx,hatTopY+1,21,crownH);
  ctx.fillStyle='#060608';ctx.fillRect(cx-10+tx,hatTopY,19,crownH);
  ctx.fillStyle='#0d0d10';ctx.fillRect(cx+7+tx,hatTopY+1,2,crownH-1);
  ctx.fillStyle='#0a0a0c';ctx.fillRect(cx-9+tx,hatTopY,17,2);
  ctx.fillStyle='#181818';ctx.fillRect(cx-8+tx,hatTopY,15,1);
  ctx.fillStyle='#030304';ctx.fillRect(cx-10+tx,hatBrimY-2,19,3);
  ctx.fillStyle='#161618';ctx.fillRect(cx-9+tx,hatBrimY-2,17,1);
  const brimL=cx-28+tx,brimR=cx+30+tx,brimH=6;
  ctx.fillStyle='rgba(0,0,0,0.65)';ctx.fillRect(brimL+1,hatBrimY+4,brimR-brimL-1,3);
  ctx.fillStyle='#060608';ctx.fillRect(brimL,hatBrimY,brimR-brimL,brimH);
  ctx.fillStyle='#0e0e11';ctx.fillRect(brimL,hatBrimY,brimR-brimL,2);
  ctx.fillStyle='#181818';ctx.fillRect(brimL,hatBrimY,brimR-brimL,1);
  ctx.fillStyle='#040404';ctx.fillRect(brimL,hatBrimY+3,brimR-brimL,2);
  ctx.fillStyle='#040405';ctx.fillRect(brimL,hatBrimY+1,3,brimH-2);
  ctx.fillStyle='#0c0c0e';ctx.fillRect(brimR-4,hatBrimY+1,4,brimH-2);
}
function _drawVentureCap(cx,drawY,R,hatTX,hatTY){
  const tx=Math.round((hatTX||0)*12);
  const ty=Math.round((hatTY||0)*9);
  const brimY=drawY-R+4+ty;
  ctx.fillStyle='#080808';ctx.beginPath();ctx.roundRect(cx-14+tx,brimY-10,28,12,4);ctx.fill();
  ctx.fillStyle='#581018';ctx.fillRect(cx-12+tx,brimY-8,24,8);
  ctx.fillStyle='#a83040';ctx.fillRect(cx-11+tx,brimY-7,22,4);
  ctx.fillStyle='#d85868';ctx.fillRect(cx-8+tx,brimY-8,10,2);
  ctx.fillStyle='#300810';ctx.fillRect(cx-18+tx,brimY+1,36,4);
  ctx.fillStyle='#581018';ctx.fillRect(cx-16+tx,brimY+2,32,2);
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
  ctx.beginPath();ctx.ellipse(cx,drawY,R+3,R+4,0,0,Math.PI*2);ctx.fillStyle='rgba(20,20,10,0.4)';ctx.fill();
  ctx.beginPath();ctx.ellipse(cx,drawY,R,R+2,0,0,Math.PI*2);ctx.fillStyle='#141410';ctx.fill();
  ctx.beginPath();ctx.ellipse(cx,drawY,R-2,R,0,0,Math.PI*2);ctx.fillStyle='#100e0c';ctx.fill();
  let scleraCol=hostile?'#e87878':'#d0d4dc';
  if(lampReady&&!hostile) scleraCol=`rgb(${200+Math.round(Math.sin(fr*0.2)*30)},255,${210+Math.round(Math.sin(fr*0.17)*25)})`;
  let irisCol=hostile?'#882018':'#2a4888';
  let irisDark=hostile?'#5a1010':'#18306a';
  if(!hostile&&cg>0.05){
    const g=cg;
    irisCol=_mixHex('#2a4888','#28a050',g);
    irisDark=_mixHex('#18306a','#184820',g);
    if(lampReady){ irisCol='#38c868'; irisDark='#1a6838'; }
  }
  ctx.beginPath();ctx.ellipse(cx,drawY+2,10,9,0,0,Math.PI*2);ctx.fillStyle=scleraCol;ctx.fill();
  ctx.beginPath();ctx.ellipse(cx,drawY+2,6,6,0,0,Math.PI*2);ctx.fillStyle=irisCol;ctx.fill();
  ctx.beginPath();ctx.ellipse(cx,drawY+2,5,5,0,0,Math.PI*2);ctx.fillStyle=irisDark;ctx.fill();
  ctx.beginPath();ctx.ellipse(cx,drawY+2,5.5,5.5,0,0,Math.PI*2);
  ctx.strokeStyle=hostile?'#cc4040':(cg>0.05?'#48c878':'#3a5aaa');ctx.lineWidth=1;ctx.stroke();
  const px=cx+pupilX,py=drawY+2+pupilY;
  ctx.beginPath();ctx.arc(px,py,3.5,0,Math.PI*2);ctx.fillStyle='#03030e';ctx.fill();
  ctx.beginPath();ctx.arc(px-1.2,py-1.2,1.4,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.9)';ctx.fill();
  ctx.beginPath();ctx.ellipse(cx-7,drawY-8,7,9,0,0,Math.PI*2);ctx.fillStyle='rgba(24,22,14,0.45)';ctx.fill();
  const baseY=drawY+R+1;
  ctx.fillStyle='#7a8290';ctx.fillRect(cx-12,baseY,24,6);
  ctx.fillStyle='#8a929e';ctx.fillRect(cx-11,baseY+1,22,4);
  for(let i=0;i<3;i++){ctx.fillStyle='#4e5660';ctx.fillRect(cx-12,baseY+1.5+i*1.5,24,0.8);}
  ctx.fillStyle='#5a6270';ctx.fillRect(cx-14,baseY+5,28,4);
  ctx.fillStyle='#6a7280';ctx.fillRect(cx-13,baseY+6,26,2.5);
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
  const col=toTip?'#66bbff':'#dd88ff';
  const core=toTip?'#aaddff':'#f0b8ff';
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

/* -- Connector shapes at arm tip (vector TRS / RCA / XLR / MAG) -- */
function drawConnectorTip(cx,cy,aimAngle,flash,itemOverride){
  const itemIdx=itemOverride!=null?itemOverride:ITEM;
  ctx.save();ctx.translate(cx,cy);
  ctx.rotate(aimAngle);
  const ff=flash/9;

  if(itemIdx===0){
    // â”€â”€ TRS 1/4" JACK â€” black barrel + metal shaft + conical tip â”€â”€
    ctx.fillStyle='#111116';ctx.beginPath();ctx.roundRect(-10,-7,12,14,3);ctx.fill();
    ctx.fillStyle='#1b1b22';ctx.fillRect(-9,-6,10,4);
    for(let r=0;r<4;r++){ctx.fillStyle='#0b0b10';ctx.fillRect(-8+r*2,-2,1,4);}
    ctx.fillStyle='#17171d';ctx.beginPath();ctx.roundRect(0,-6,14,12,3);ctx.fill();
    ctx.fillStyle='#252530';ctx.fillRect(1,-5,12,3);
    ctx.fillStyle='#0e0e14';ctx.fillRect(2,2,10,2);
    ctx.fillStyle='#9aa2b2';ctx.fillRect(13,-4,11,8);
    ctx.fillStyle='#c7cfdd';ctx.fillRect(13,-4,11,2.5);
    ctx.fillStyle='#757f91';ctx.fillRect(13,2,11,1.6);
    ctx.fillStyle='#0a0a0f';ctx.fillRect(24,-4.5,3.2,9);
    ctx.fillStyle='#aab3c2';ctx.fillRect(27,-3.7,8,7.4);
    ctx.fillStyle='#d4dbe7';ctx.fillRect(27,-3.7,8,2.1);
    ctx.fillStyle='#0a0a0f';ctx.fillRect(35,-4.2,2.8,8.4);
    ctx.fillStyle='#b6bfcd';ctx.fillRect(37,-3,6.4,6);
    ctx.fillStyle='#e0e6f0';ctx.fillRect(37,-3,6.4,1.7);
    ctx.fillStyle='#bcc5d3';
    ctx.beginPath();ctx.moveTo(43.4,-3.2);ctx.lineTo(49.2,0);ctx.lineTo(43.4,3.2);ctx.closePath();ctx.fill();
    ctx.fillStyle='#f0f4fb';
    ctx.beginPath();ctx.moveTo(43.8,-1.4);ctx.lineTo(47.4,0);ctx.lineTo(43.8,1.4);ctx.closePath();ctx.fill();
    if(ff>0){ctx.globalAlpha=ff*0.85;ctx.fillStyle='#ccddff';ctx.beginPath();ctx.arc(47,0,8+ff*7,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
    if(p.laserCharging&&p.laserCharge>0){
      const cf=p.laserCharge/40;
      const pulse=0.7+0.3*Math.sin(fr*0.55+cf*8);
      ctx.globalAlpha=cf*pulse*0.82;
      ctx.fillStyle=cf>0.55?'#ffffff':'#bb55ff';
      ctx.beginPath();ctx.arc(47,0,5+cf*15,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=cf*pulse;
      ctx.strokeStyle='#cc88ff';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(47,0,9+cf*11,0,Math.PI*2);ctx.stroke();
      for(let i=0;i<3;i++){
        const a=fr*0.15+i*(Math.PI*2/3);
        const r=8+cf*10;
        ctx.globalAlpha=cf*0.7;ctx.fillStyle='#dd88ff';
        ctx.beginPath();ctx.arc(47+Math.cos(a)*r,Math.sin(a)*r,1.5,0,Math.PI*2);ctx.fill();
      }
      ctx.globalAlpha=1;
    }

  }else if(itemIdx===1){
    // â”€â”€ RCA PHONO PLUG â€” molded sleeve + metal collar + center pin â”€â”€
    const isVenture=p.hero==='venture';
    const rcaDark=isVenture?'#7a130d':'#4a1a72';
    const rcaMain=isVenture?'#c81812':'#7c35cc';
    const rcaHi=isVenture?'#ea2b20':'#a766ee';
    const rcaShadow=isVenture?'#9a100d':'#5a2899';
    const rcaRib=isVenture?'#ad1711':'#6a30b0';
    ctx.fillStyle=rcaDark;ctx.beginPath();ctx.roundRect(-10,-6,9,12,2);ctx.fill();
    ctx.fillStyle=rcaMain;ctx.beginPath();ctx.roundRect(-2,-7,25,14,4);ctx.fill();
    ctx.fillStyle=rcaHi;ctx.beginPath();ctx.roundRect(-1,-6,22,5,3);ctx.fill();
    ctx.fillStyle=rcaShadow;ctx.fillRect(5,2,12,3);
    ctx.fillStyle=rcaRib;
    for(let r=0;r<3;r++)ctx.fillRect(2+r*4,-1,2,2);
    ctx.fillStyle='#b8bec8';ctx.fillRect(22,-5,8,10);
    ctx.fillStyle='#d9dee6';ctx.fillRect(22,-5,8,3);
    ctx.fillStyle='#8f96a2';ctx.fillRect(22,2,8,3);
    ctx.fillStyle='#101018';ctx.fillRect(28,-4,4,8);
    const pinX=31,pinLen=10;
    ctx.fillStyle='#c69226';ctx.fillRect(pinX,-1.6,pinLen,3.2);
    ctx.fillStyle='#e2b64a';ctx.fillRect(pinX,-1.6,pinLen,1.1);
    ctx.fillStyle='#9a6f16';ctx.fillRect(pinX,0.5,pinLen,0.9);
    ctx.beginPath();ctx.arc(pinX+pinLen,0,1.6,0,Math.PI*2);ctx.fillStyle='#d4a63b';ctx.fill();
    ctx.beginPath();ctx.arc(pinX+pinLen-0.6,-0.5,0.7,0,Math.PI*2);ctx.fillStyle='#f0d78f';ctx.fill();
    if(ff>0){ctx.globalAlpha=ff*0.85;ctx.fillStyle='#ff6633';ctx.beginPath();ctx.arc(pinX+pinLen,0,6+ff*6,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}

  }else if(itemIdx===2){
    // â”€â”€ XLR â€” black sleeve + silver barrel + recessed 3-pin face â”€â”€
    ctx.fillStyle='#101116';ctx.beginPath();ctx.roundRect(-10,-8,16,16,4);ctx.fill();
    ctx.fillStyle='#1a1c22';ctx.fillRect(-9,-7,14,5);
    for(let i=0;i<5;i++){ctx.fillStyle='#0a0b10';ctx.fillRect(-8+i*2,-1,1,4);}
    ctx.fillStyle='#2a2b30';ctx.beginPath();ctx.roundRect(4,-8,5,16,2);ctx.fill();
    const fx=28;
    ctx.fillStyle='#aeb3bc';ctx.fillRect(8,-8,20,16);
    ctx.fillStyle='#d8dde4';ctx.fillRect(8,-8,20,3.2);
    ctx.fillStyle='#8a909a';ctx.fillRect(8,4.8,20,3.2);
    ctx.fillStyle='rgba(255,255,255,0.14)';
    for(let i=0;i<12;i++)ctx.fillRect(10+i%6*3,-5+(i/6|0)*5,1,1);
    const faceR=8;
    ctx.beginPath();ctx.arc(fx,0,faceR,0,Math.PI*2);ctx.fillStyle='#c2c7cf';ctx.fill();
    ctx.beginPath();ctx.arc(fx,0,faceR-1.1,0,Math.PI*2);ctx.fillStyle='#50545d';ctx.fill();
    ctx.beginPath();ctx.arc(fx,0,faceR-2.1,0,Math.PI*2);ctx.fillStyle='#15171d';ctx.fill();
    [[fx,-2.9],[fx-2.6,2.3],[fx+2.6,2.3]].forEach(([px,py2])=>{
      ctx.beginPath();ctx.arc(px,py2,1.5,0,Math.PI*2);ctx.fillStyle='#aab0ba';ctx.fill();
      ctx.beginPath();ctx.arc(px-0.4,py2-0.4,0.55,0,Math.PI*2);ctx.fillStyle='#eef2f8';ctx.fill();
    });
    ctx.fillStyle='rgba(220,226,236,0.65)';ctx.fillRect(23,-6,3,1);
    if(p.xlrOn){
      const pulse=0.5+0.5*Math.sin(fr*0.32);
      ctx.globalAlpha=0.45*pulse;
      for(let i=0;i<4;i++){
        const t=((fr*0.18+i*0.22)%1);
        const ex=-8+t*(fx+8);
        ctx.strokeStyle='#88ccff';ctx.lineWidth=1.6;
        ctx.beginPath();ctx.moveTo(ex,Math.sin(fr*0.25+i*1.2)*1.8);
        ctx.lineTo(ex+7,Math.sin(fr*0.25+i*1.2+0.4)*1);ctx.stroke();
      }
      ctx.globalAlpha=pulse*0.55;
      for(let i=0;i<3;i++){
        const wave=((fr*0.1+i*0.28)%1);
        ctx.strokeStyle='#aaddff';ctx.lineWidth=1.2;
        ctx.beginPath();ctx.arc(fx,0,faceR+2+wave*10,-0.55,0.55);ctx.stroke();
      }
      ctx.globalAlpha=1;
    }
    if(ff>0){ctx.globalAlpha=ff*0.85;ctx.fillStyle='#4466ff';ctx.beginPath();ctx.arc(fx,0,faceR+ff*8,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}

  }else{
    // â”€â”€ MAGNET â€” sideways U (chrome horseshoe, opening toward aim) â”€â”€
    const halfG=7, prongL=24, w=7;
    ctx.lineCap='round';
    ctx.lineJoin='round';
    ctx.lineWidth=w;
    ctx.strokeStyle='#7f8796';
    ctx.beginPath();
    ctx.moveTo(prongL, -halfG);
    ctx.lineTo(0, -halfG);
    ctx.arc(0, 0, halfG, -Math.PI/2, Math.PI/2, true);
    ctx.lineTo(prongL, halfG);
    ctx.stroke();
    ctx.lineWidth=2.2;
    ctx.strokeStyle='rgba(220,228,240,0.55)';
    ctx.beginPath();
    ctx.moveTo(prongL-1, -halfG+1.2);
    ctx.lineTo(2, -halfG+1.2);
    ctx.stroke();
    [[prongL,-halfG],[prongL,halfG]].forEach(([tx,ty])=>{
      ctx.beginPath();ctx.arc(tx,ty,w*0.52,0,Math.PI*2);
      ctx.fillStyle='#b9c1cf';ctx.fill();
      ctx.beginPath();ctx.arc(tx-0.8,ty-0.8,w*0.22,0,Math.PI*2);
      ctx.fillStyle='#eef2f8';ctx.fill();
    });
  }
  ctx.restore();
}

/* -- Boxing glove arm (right) --
   Rendering uses vector connector art; the punch hit-check below runs in
   WORLD coordinates with the exact original reach values. */
function drawGloveArm(sxp,syp,facing,shWX,shWY,hidden){
  const isVenture=p.hero==='venture';
  const armCol1=isVenture?C.MAROON:C.PURPLE_D;
  const armCol2=isVenture?C.RED_D:C.INDIGO;
  const punching   = p.pt > 0;
  const charging   = p.pCharging;
  const chargeFrac = Math.min((p.pCharge||0)/28, 1);
  const recoilFrac = p._pRecoil>0?(p._pRecoil/10):0;
  const snapFrac   = punching ? (1 - p.pt/10) : (recoilFrac>0 ? -recoilFrac*0.5 : 0);
  const fwdDir     = facing ? 1 : -1;

  // â”€â”€ Two fixed segments for the L (world units) â”€â”€â”€â”€â”€â”€â”€
  const seg1Len = 14;
  const guardFwd = 12;
  const isChargedHook = (p.pCharge||0)>20 || (punching && p.pCd>4);
  const punchFwd = isChargedHook ? 58 : 28;
  const armShine=isVenture?'rgba(200,80,80,0.15)':'rgba(120,80,200,0.15)';

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
    const armLen = guardFwd + snapFrac*(punchFwd - guardFwd);
    const punchAngle = Math.atan2(p.aimDY, p.aimDX);
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
      const _charged=(p.pCharge||0)>20;
      let _hit=false;

      // Breakable walls
      for(const bw of BWALLS){
        if(bw.hp<=0)continue;
        if(_wx+_wr>bw.x&&_wx-_wr<bw.x+bw.w&&_wy+_wr>bw.y&&_wy-_wr<bw.y+bw.h){
          p._hitDone=true;_hit=true;
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
            p._hitDone=true;_hit=true;
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
            p._hitDone=true;_hit=true;
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
          p._hitDone=true;_hit=true;
          const _charged=(p.pCharge||0)>20||(p.pCd>4);
          if(_enemyRebootInterruptable(e)){
            _tryInterruptMindReboot(e);
          }else if(_enemyCombatActive(e)){
            const _kbScale=_charged?1.35:1;
            _damageEnemy(e,_charged?ENM_DMG.punchCharged:ENM_DMG.punch,p.fistWX||p.x+SW/2,p.fistWY||p.y+FEET_OFF,_kbScale);
          }
          _applyPunchImpact(p,e,punchAngle,{charged:_charged});
          p._pRecoil=_charged?14:10;
          sfx('hit');
        }
      }
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
  ctx.fillStyle='#0b0b10';
  ctx.beginPath();ctx.roundRect(0,-gh/2,gw,gh,6);ctx.fill();
  ctx.fillStyle=isVenture?'#280810':'#161618';
  ctx.beginPath();ctx.roundRect(1,-gh/2+1,gw-2,gh-2,5);ctx.fill();
  ctx.fillStyle='#0e0e16';
  ctx.beginPath();ctx.arc(gw/2,0,gh/2+2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=isVenture?'#581018':'#161618';
  ctx.beginPath();ctx.arc(gw/2,0,gh/2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.06)';
  ctx.beginPath();ctx.arc(gw/2-3,-3,gh/4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#080812';
  ctx.beginPath();ctx.roundRect(-5,-4,8,8,3);ctx.fill();
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
  const walkBob=(!onRope&&p.og&&Math.abs(p.vx)>0.5&&p.landF<=0)?Math.sin(fr*0.28+p.x*0.015)*0.45:0;
  const idleSway=0;
  const suspDrop=onRope?0:(p.landF>0?suspC*SUSP_TRAVEL*0.55:0);
  const bodyCompress=onRope?0:landEase*(0.32+landAmp*0.68)*11-walkBob-idleSway+suspDrop;
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
  const wWcx=p.x+SW/2, wWcy=p.y+FEET_OFF-WHEEL_R-2;
  const standBodyCY=p.y+FEET_OFF-STAND_H-WHEEL_R+10;
  const duckBodyBottom=wWcy+WHEEL_R*0.5;
  const duckBodyCY=duckBodyBottom-BODY_H;
  const bodyCY=standBodyCY+visualCa2*(duckBodyCY-standBodyCY)+bodyCompress;
  const bodyTop=bodyCY;
  const shoulderY=bodyTop+BODY_H*0.22;
  const bodyLeft=wWcx-BODY_W/2, bodyRight=wWcx+BODY_W/2;
  const glovShoulderWX=fc?bodyRight:bodyLeft;

  const pose=p._armPose||computeConnectorArmPose(p);
  p.tipWorldX=pose.tipX; p.tipWorldY=pose.tipY;
  const {armA0,armA1,useElbow,aimAngle:ca}=pose;

  // Invincibility â€” authentic sprite flicker (punch hit-check still runs)
  const flicker=(p.flashF>0&&Math.floor(p.flashF/2)%2===1);

  // â”€â”€ Screen coords â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const wcx=sx(wWcx), wcy=sy(wWcy);
  const bTopS=sy(bodyTop);
  const shY=sy(shoulderY);
  const glovShX=sx(glovShoulderWX);
  const connShX=sx(pose.connShX), connShY=sy(pose.connShY);
  const tipX=sx(pose.tipX), tipY=sy(pose.tipY);
  const elbowX=sx(pose.elbowX), elbowY=sy(pose.elbowY);

  // 1. SHADOW + WHEEL + FORK â€” behind everything
  if(!flicker){
    drawCharShadow(wcx,wcy);
    drawWheel(wcx,wcy,p.wheelAngle,p);
  }

  // 2. GLOVE ARM â€” behind body box; always runs the punch hit logic
  drawGloveArm(glovShX,shY,fc,glovShoulderWX,shoulderY,flicker);
  if(flicker) return;

  // 3. HEAD â€” tucked in box when ducking; tiny peek when spring/wall charge ready
  const chargeInfo=_playerChargeInfo(p);
  const springReady=!!p.duckBoostReady;
  const wallReady=p.wallGrip>0&&!!p._wallChargeReady;
  const headPop=springReady||wallReady;
  let headTuckVis=onRope?visualCa2:Math.max(visualCa2,p._autoHeadTuck||0);
  const headR=Math.round(14-headTuckVis*3);
  const standHeadCY=bodyTop-18;
  const shellHeadCY=bodyTop+headR*1.05;
  let headCY=standHeadCY+headTuckVis*(shellHeadCY-standHeadCY);
  let peekAmt=0;
  if(headPop){
    const peekLift=(springReady?5:4)+Math.sin(fr*0.22)*1.1;
    headCY-=peekLift;
    peekAmt=0.22+Math.sin(fr*0.18)*0.05;
  }
  drawHead(wcx,sy(headCY),p.pupilX,p.pupilY,headTuckVis,p.hero,peekAmt,chargeInfo,hatTX,hatTY,landHeadTuck,false);

  // 4. BODY BOX â€” in front of glove arm + head
  drawBody(wcx,bTopS,fc,0);

  // 5. CONNECTOR ARM â€” in front of body
  const isVenture=p.hero==='venture';
  const _armDark=isVenture?C.MAROON:C.PURPLE_D;
  const _armMain=isVenture?C.RED_D:C.INDIGO;
  const _armGlow=isVenture?'rgba(210,90,110,0.18)':'rgba(120,80,200,0.15)';
  const coilFlow=(ITEM===2&&p.xlrOn)?2:(ITEM===3&&p.magOn)?3:0;
  if(useElbow){
    drawCoil(connShX,connShY,armA0,Math.hypot(elbowX-connShX,elbowY-connShY),_armDark,_armMain,_armGlow,coilFlow);
    drawCoil(elbowX,elbowY,armA1,Math.hypot(tipX-elbowX,tipY-elbowY),_armDark,_armMain,_armGlow,coilFlow);
    drawConnectorTip(tipX,tipY,armA1,p.flashF);
  }else{
    drawCoil(connShX,connShY,ca,Math.hypot(tipX-connShX,tipY-connShY),_armDark,_armMain,_armGlow,coilFlow);
    drawConnectorTip(tipX,tipY,ca,p.flashF);
  }
  if(coilFlow){
    const tw=connectorTipWorld(ITEM);
    drawArmEnergyFlow(connShX,connShY,elbowX,elbowY,sx(tw.x),sy(tw.y),useElbow,coilFlow);
  }
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

/* â”€â”€ PARALLAX BACKDROP â€” SMS style â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Flat sky + image layers per assets/backgrounds/README.md
   (layer1..layer6, missing files are skipped). Source PNGs are
   downscaled to framebuffer height and quantized to the SMS
   palette at load time â€” no asset files are modified. */
const BG_DEFAULT_SET='beastlands';
const BG_LAYER_FILES=[
  {file:1,speed:0.05},{file:2,speed:0.15},{file:3,speed:0.30},
  {file:4,speed:0.50},{file:5,speed:0.65},{file:6,speed:0.80}
];
const BG_SKY_FALLBACK=C.NAVY;
let _bgSet=BG_DEFAULT_SET;
const _bgCache={};
function _loadBgSet(name){
  if(!name||_bgCache[name])return;
  const set={layers:[]};
  _bgCache[name]=set;
  for(const def of BG_LAYER_FILES){
    const slot={img:null,speed:def.speed};
    const img=new Image();
    img.onload=()=>{
      // Native SMS height, width tiled in 256px strips for seamless scroll.
      const th=H;
      const rawW=Math.max(W,Math.round(img.width*(th/img.height)));
      const tw=Math.ceil(rawW/W)*W;
      slot.img=smsProcessPainted(img,tw,th);
    };
    img.src='assets/backgrounds/'+name+'/layer'+def.file+'.png';
    set.layers.push(slot);
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
      const h=(12+((x*13+ridge*47+(fr>>4))%20))*sh;
      ctx.fillRect(x,base-h,1,h);
    }
  }
}
function drawParallax(){
  drawSkyBands();
  const set=_bgCache[_bgSet];
  if(!set)return;
  // vertical scroll fraction through the level (0 = top, 1 = bottom)
  const vh=camViewH();
  const t=WH>vh?Math.max(0,Math.min(1,camY/(WH-vh))):0;
  for(const L of set.layers){
    if(!L.img)continue;
    const w=L.img.width,h=L.img.height;
    if(w<8)continue;
    const y=((-(h-H)*t)|0);
    let x=-(Math.floor(camX*L.speed/SMS_SCALE)%w);
    if(x>0)x-=w;
    for(;x<W;x+=w)blitImg(L.img,0,0,w,h,x|0,y,w,h);
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


const BWALL_BOUNCE=0.44, BWALL_WALL_BOUNCE=0.38;

function _damageBwall(bw,kind,fx){
  if(!bw||bw.hp<=0) return;
  fx=fx||{};
  if(_isRedBwall(bw)){
    const pct=typeof kind==='string'?(RED_BWALL_DMG[kind]||0):kind;
    if(pct<=0) return;
    bw.hp=Math.max(0,bw.hp-pct);
    bw.cracked=bw.hp<bw.maxHp;
    if(bw.movable){
      _wakeBwall(bw);
      if(fx.vx!=null) bw.vx=(bw.vx||0)+fx.vx;
      if(fx.vy!=null) bw.vy=(bw.vy||0)+fx.vy;
    }
    if(fx.shakeX) bw.shakeX=fx.shakeX;
    if(fx.shakeY) bw.shakeY=fx.shakeY;
    spawnDebris(bw,4+Math.ceil(pct/15));
    sfx('hit');
    if(bw.hp<=0){bw._destroyFr=fr;spawnDebris(bw,22);sfx('stomp');}
    return;
  }
  const dmg=typeof kind==='number'?kind:(kind==='punchCharged'?2:1);
  bw.hp=Math.max(0,bw.hp-dmg);
  bw.cracked=true;
  if(fx.shakeX) bw.shakeX=fx.shakeX;
  if(fx.shakeY) bw.shakeY=fx.shakeY;
  spawnDebris(bw,4+dmg*2);
  sfx('hit');
  if(bw.hp<=0){bw._destroyFr=fr;spawnDebris(bw,18);sfx('stomp');}
}
function _bwallApplyImpact(bw, speed){
  if(speed<BWALL_IMPACT_DMG) return;
  if((bw._impactCd||0)>0) return;
  bw._impactCd=14;
  bw.shakeX=(Math.random()-0.5)*5;
  bw.shakeY=-2;
  if(bw.movable) return;
  const dmg=speed>=BWALL_IMPACT_HARD?2:1;
  bw.hp=Math.max(0,bw.hp-dmg);
  bw.cracked=true;
  spawnDebris(bw,4+dmg*3);
  sfx('hit');
  if(bw.hp<=0){bw._destroyFr=fr;spawnDebris(bw,18);sfx('stomp');}
}
function _bwallMovedFromHome(bw){
  if(bw.homeX==null||bw.homeY==null) return false;
  return Math.abs(bw.x-bw.homeX)>4||Math.abs(bw.y-bw.homeY)>4;
}
function _wakeBwall(bw){
  if(!bw||!bw.movable||bw.hp<=0) return;
  bw._awake=true;
  bw.og=false;
}

function spawnDebris(bw, count){
  if(!bw.debris)bw.debris=[];
  for(let i=0;i<count;i++){
    const angle=Math.random()*Math.PI*2;
    const spd=2+Math.random()*5;
    bw.debris.push({
      x:bw.x+Math.random()*bw.w,
      y:bw.y+Math.random()*bw.h,
      vx:Math.cos(angle)*spd,
      vy:Math.sin(angle)*spd-2,
      rot:Math.random()*Math.PI*2,
      rotSpd:(Math.random()-0.5)*0.3,
      w:4+Math.random()*10,
      h:4+Math.random()*8,
      life:40+Math.random()*30,
      maxLife:70,
      col:`hsl(${20+Math.random()*20},${40+Math.random()*20}%,${30+Math.random()*20}%)`
    });
  }
}

function _bwallSolids(skip){
  const out=TR.map(_normPlat);
  for(const bw of BWALLS){
    if(bw===skip||bw.hp<=0) continue;
    out.push({x:bw.x,y:bw.y,w:bw.w,h:bw.h,tp:'solid'});
  }
  return out;
}

function _sanitizeBwall(bw){
  if(!bw) return;
  if(!isFinite(bw.x)||!isFinite(bw.y)){
    bw.x=bw.homeX??0; bw.y=bw.homeY??0;
    bw.vx=0; bw.vy=0; bw._awake=false;
  }
  if(!isFinite(bw.vx)) bw.vx=0;
  if(!isFinite(bw.vy)) bw.vy=0;
  bw.vx=Math.max(-8,Math.min(8,bw.vx));
  bw.vy=Math.max(-10,Math.min(10,bw.vy));
  if(isFinite(bw.w)&&isFinite(bw.h)){
    bw.x=Math.max(0,Math.min(Math.max(0,WW-bw.w),bw.x));
    bw.y=Math.max(-bw.h,Math.min(Math.max(0,WH-bw.h),bw.y));
  }
}
function _resolveBwallAgainstSolids(bw,solids,prevY){
  const prevBottom=prevY!=null?prevY+bw.h:bw.y+bw.h;
  for(let pass=0;pass<10;pass++){
    let any=false;
    for(const q of solids){
      if(!ov(bw.x,bw.y,bw.w,bw.h,q.x,q.y,q.w,q.h)) continue;
      const overlapX=Math.min(bw.x+bw.w,q.x+q.w)-Math.max(bw.x,q.x);
      const overlapY=Math.min(bw.y+bw.h,q.y+q.h)-Math.max(bw.y,q.y);
      if(overlapX<=0||overlapY<=0) continue;
      const blockBottom=bw.y+bw.h;
      const onTop=bw.vy>=0&&prevBottom<=q.y+6&&blockBottom>q.y&&bw.y<q.y+q.h*0.6;
      if(onTop){
        bw.y=q.y-bw.h; bw.vy=0; bw.og=true; any=true;
      }else if(overlapX<overlapY){
        bw.x=bw.x+bw.w/2<q.x+q.w/2?q.x-bw.w:q.x+q.w;
        bw.vx=0; any=true;
      }else if(bw.vy<0&&bw.y+bw.h/2<q.y+q.h/2){
        bw.y=q.y+q.h; bw.vy=0; any=true;
      }else{
        bw.y=q.y-bw.h; bw.vy=0; bw.og=true; any=true;
      }
    }
    if(!any) break;
  }
}
function _carryPlayersOnBwall(bw,dx,dy){
  if(!dx&&!dy) return;
  const riders=[p,p2].filter(Boolean);
  for(const pl of riders){
    if(!_playerStandingOnPlat(pl,bw)) continue;
    pl.x+=dx; pl.y+=dy;
    pl.x=Math.max(0,Math.min(WW-SW,pl.x));
  }
}
function updateBWalls(){
  for(const bw of BWALLS){
    if(!bw.debris) bw.debris=[];
    _sanitizeBwall(bw);
    if(bw.movable&&bw.hp>0){
      if(!bw._awake){
        bw.x=bw.homeX??bw.x; bw.y=bw.homeY??bw.y;
        bw.vx=0; bw.vy=0;
      }else{
        const prevX=bw.x, prevY=bw.y;
        bw.vy=Math.min((bw.vy||0)+GRAV*0.7,10);
        bw.vx=(bw.vx||0)*(bw.og?0.86:0.96);
        const solids=_bwallSolids(bw);
        bw.x+=bw.vx;
        _resolveBwallAgainstSolids(bw,solids,prevY);
        const yBefore=bw.y;
        bw.y+=bw.vy;
        _resolveBwallAgainstSolids(bw,solids,yBefore);
        _resolveBwallAgainstSolids(bw,solids,bw.y);
        if(bw.y+bw.h>WH){bw.y=WH-bw.h;bw.vy=0;bw.og=true;}
        _carryPlayersOnBwall(bw,bw.x-prevX,bw.y-prevY);
        if(bw.homeX!=null&&Math.abs(bw.x-bw.homeX)<3&&Math.abs(bw.y-bw.homeY)<3
          &&Math.abs(bw.vx)<0.15&&Math.abs(bw.vy)<0.15&&bw.og
          &&!_bwallOverlapsPlayer(bw,p)&&!(p2&&_bwallOverlapsPlayer(bw,p2))){
          bw._awake=false;
          bw.x=bw.homeX; bw.y=bw.homeY;
          bw.vx=0; bw.vy=0;
        }
      }
    }
    if(bw.shakeX){bw.shakeX*=0.6;bw.shakeY*=0.6;if(Math.abs(bw.shakeX)<0.3){bw.shakeX=0;bw.shakeY=0;}}
    for(let i=bw.debris.length-1;i>=0;i--){
      const d=bw.debris[i];
      d.x+=d.vx;d.y+=d.vy;
      d.vy+=0.18;d.vx*=0.96;
      d.rot+=d.rotSpd;
      d.life--;
      if(d.y>WH||d.life<=0) bw.debris.splice(i,1);
    }
    if(bw.hp<=0&&bw._destroyFr!=null&&fr-bw._destroyFr>22) bw.debris.length=0;
  }
}

function drawBreakWall(bw){
  if(!bw||!isFinite(bw.x)||!isFinite(bw.y)||!isFinite(bw.w)||!isFinite(bw.h)) return;
  // Debris â€” 1â€“2px chunks, flicker out instead of fading
  if(bw.debris && !(bw.hp<=0 && bw._destroyFr!=null && fr-bw._destroyFr>22)){
    for(const d of bw.debris){
      const t=d.life/d.maxLife;
      if(t<0.4&&(fr&1))continue; // end-of-life flicker
      ctx.fillStyle=d.col;
      const dw=Math.max(1,sw(d.w));
      ctx.fillRect(sx(d.x),sy(d.y),dw,dw);
    }
  }
  if(bw.hp<=0) return;

  const bx=sx(bw.x+(bw.shakeX||0)), by=sy(bw.y+(bw.shakeY||0));
  const bws=sw(bw.w), bhs=sw(bw.h);
  const frac=bw.maxHp>0?bw.hp/bw.maxHp:1;
  const useTile=!!(bw.tileGid&&_tmjDraw&&_tmjLookupGid(bw.tileGid));
  const isRed=_isRedBwall(bw);
  const recentHit=(bw.shakeX||bw.shakeY)&&(fr&1)===0;

  if(useTile){
    const {tw,th,sc}=_tmjDraw;
    const animGid=typeof _tmjOmniblockAnimGid==='function'?_tmjOmniblockAnimGid(bw.tileGid):bw.tileGid;
    _drawTmjTileGid(animGid,bx,by,tw,th,sc);
    if(recentHit){ctx.fillStyle=C.WHITE;ctx.fillRect(bx,by,bws,1);ctx.fillRect(bx,by+bhs-1,bws,1);}
    if(frac>=0.99) return;
  }else if(isRed){
    const tws=_tmjDraw?(_tmjDraw.tw*_tmjDraw.sc):bw.w;
    const ths=_tmjDraw?(_tmjDraw.th*_tmjDraw.sc):bw.h;
    const rw=sw(Math.max(bw.w,tws)), rh=sw(Math.max(bw.h,ths));
    ctx.fillStyle=recentHit?C.WHITE:C.MAROON;ctx.fillRect(bx,by,rw,rh);
    ctx.fillStyle=recentHit?C.PINK:C.RED;ctx.fillRect(bx+1,by+1,rw-2,rh-2);
    ctx.fillStyle=C.RED_L;ctx.fillRect(bx+1,by+1,rw-2,1);
    if(frac>=0.99) return;
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
}
function drawCrate(c){
  const bx=sx(c.x),by=sy(c.y);
  const cw=sw(c.w),ch=sw(c.h);
  ctx.fillStyle=C.BROWN_D;ctx.fillRect(bx,by,cw,ch);
  ctx.fillStyle=C.BROWN;ctx.fillRect(bx+1,by+1,cw-2,ch-2);
  ctx.fillStyle=C.TAN;ctx.fillRect(bx+1,by+1,cw-2,1);
  ctx.fillStyle=C.GOLD_D;ctx.fillRect(bx+1,by+ch-2,cw-2,1);
  pxLine(bx+1,by+1,bx+cw-2,by+ch-2,C.MAROON);
  pxLine(bx+cw-2,by+1,bx+1,by+ch-2,C.MAROON);
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
  const wWcx=e.x+SW/2, wWcy=e.y+FEET_OFF-WHEEL_R-2;
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
    if(shutT>0.2&&fr%12<8){
      drawText('SHUTDOWN',wcx-28,headCY-22,C.PURPLE_L);
    }
  }
  if(settled||shutT>0.65){
    if(e._mindOff==='rebooting'){
      drawText('BOOT',wcx-10,headCY-50,C.PURPLE_L);
    }else if(e._mindOff==='cooldown'){
      ctx.fillStyle=C.BLACK;
      ctx.fillRect(wcx-12,headCY-28,24,9);
      drawText('OFF',wcx-8,headCY-26,C.LILAC);
      const secs=Math.max(1,Math.ceil((e._cooldownEnd-Date.now())/1000));
      drawText(String(secs),wcx-4,headCY-40,C.YELLOW);
    }else{
      ctx.fillStyle=C.BLACK;
      ctx.fillRect(wcx-12,headCY-28,24,9);
      drawText('OFF',wcx-8,headCY-26,C.LILAC);
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
  const wWcx=e.x+SW/2, wWcy=e.y+FEET_OFF-WHEEL_R-2;
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
  const _eh=p.hero; p.hero='venture';
  drawBody(wcx,bTopS,fc,0,{hp:e.hp,mhp:e.mhp,off:false});
  p.hero=_eh;
  const armDark=C.MAROON, armMain=C.RED_D;
  const eItem=e.item!=null?e.item:0;
  if(e.hook&&e.hook.st!=='idle'&&eItem===1){
    const hk=e.hook;
    const nx=sx(pose.noseX), ny=sy(pose.noseY);
    const tx=hk.st==='on'?sx(hk.ax):sx(hk.ex+Math.cos(ca)*hk.len*0.55);
    const ty=hk.st==='on'?sy(hk.ay):sy(hk.ey+Math.sin(ca)*hk.len*0.55);
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
  const labelX=bx+ew/2-8, labelY=by-10;
  ctx.fillStyle=C.BLACK;
  ctx.fillRect(labelX-4,labelY-2,24,10);
  drawText('OFF',labelX,labelY,C.LILAC);
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
  const boxW=Math.min(W-16,200), boxH=18+t.lines.length*8;
  const bx=(W-boxW)>>1, by=H-boxH-10;
  ctx.fillStyle=C.BLACK;ctx.fillRect(bx,by,boxW,boxH);
  ctx.fillStyle=C.GREEN;
  ctx.fillRect(bx,by,boxW,1);ctx.fillRect(bx,by+boxH-1,boxW,1);
  ctx.fillRect(bx,by,1,boxH);ctx.fillRect(bx+boxW-1,by,1,boxH);
  drawTextC(t.title,bx+(boxW>>1),by+4,C.GREEN_L);
  let ly=by+13;
  for(const line of t.lines){
    drawTextC(line,bx+(boxW>>1),ly,C.MINT);
    ly+=8;
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
function computeConnectorArmPose(pl=p){
  const ca2=pl.crouchAmt, fc=pl.fc;
  const px=pl.x, py=pl.y;
  const wcy=py+FEET_OFF-WHEEL_R-2;
  const standBodyCY=py+FEET_OFF-STAND_H-WHEEL_R+10;
  const duckBodyCY=(wcy+WHEEL_R*0.5)-BODY_H;
  const bodyCY=standBodyCY+ca2*(duckBodyCY-standBodyCY);
  const bodyCX=px+SW/2;
  const bodyTop=bodyCY;
  const shoulderY=bodyTop+BODY_H*0.22;
  const connShoulderX=fc?bodyCX-BODY_W/2:bodyCX+BODY_W/2;
  const hookOn=pl.hook&&pl.hook.st!=='idle';
  const cptY=pl.y+FEET_OFF-STAND_H*0.5;
  const rawAngle=hookOn
    ? Math.atan2((pl.hook.st==='on'?pl.hook.ay:pl.hook.ey)-cptY,(pl.hook.st==='on'?pl.hook.ax:pl.hook.ex)-(pl.x+SW/2))
    : Math.atan2(pl.aimDY,pl.aimDX);
  const duckAngle=fc?0:Math.PI;
  const aimDuckBlend=pl.og?ca2:0; // air duck tucks body but must not lock aim horizontal
  const recoilMax=pl._lastRecoilMax||14;
  const _rf=pl.fireRecoil>0?pl.fireRecoil/recoilMax:0;
  const recoilSnap=recoilMax>=18?1.25:1;
  const recoilTilt=-_rf*0.14*recoilSnap;
  const ca=rawAngle*(1-aimDuckBlend*0.85)+duckAngle*(aimDuckBlend*0.85)+recoilTilt;
  const aimLen=Math.max(6,AIM_LEN-_rf*11*recoilSnap);
  const _nudge=_rf*3*recoilSnap;
  const connShX=connShoulderX-Math.cos(ca)*_nudge*(fc?1:-1);
  const connShY=shoulderY-Math.sin(ca)*_nudge;
  let noseX,noseY,tipX,tipY,useElbow=false,elbowX=0,elbowY=0,armA0=ca,armA1=ca,armL0=aimLen,armL1=0;

  if(hookOn){
    const hx=pl.hook.st==='on'?pl.hook.ax:pl.hook.ex;
    const hy=pl.hook.st==='on'?pl.hook.ay:pl.hook.ey;
    let dx=hx-connShX, dy=hy-connShY, dd=Math.hypot(dx,dy)||1;
    let ux=dx/dd, uy=dy/dd;
    const pxn=-uy, pyn=ux;
    const speed=Math.hypot(pl.vx||0,pl.vy||0);
    const bend=7+Math.min(12,speed*0.7)+(pl.hook.st==='ext'?2:0);
    const bendSign=(fc?1:-1)*((dy>=0)?1:-1);
    elbowX=connShX+ux*aimLen*0.52+pxn*bend*bendSign;
    elbowY=connShY+uy*aimLen*0.52+pyn*bend*bendSign;
    armA0=Math.atan2(elbowY-connShY,elbowX-connShX);
    armL0=Math.max(5,Math.hypot(elbowX-connShX,elbowY-connShY));
    const fdx=hx-elbowX, fdy=hy-elbowY, fdd=Math.hypot(fdx,fdy)||1;
    const foreReach=Math.min(fdd,Math.max(8,aimLen*0.58));
    tipX=elbowX+fdx/fdd*foreReach;
    tipY=elbowY+fdy/fdd*foreReach;
    armA1=Math.atan2(tipY-elbowY,tipX-elbowX);
    armL1=Math.max(5,Math.hypot(tipX-elbowX,tipY-elbowY));
    noseX=tipX+Math.cos(armA1)*RCA_NOSE_LEN;
    noseY=tipY+Math.sin(armA1)*RCA_NOSE_LEN;
    const noseClamped=_clampSegFrom(tipX,tipY,noseX,noseY);
    noseX=noseClamped.x; noseY=noseClamped.y;
    useElbow=true;
  }else{
    tipX=connShX+Math.cos(ca)*aimLen;
    tipY=connShY+Math.sin(ca)*aimLen;
    noseX=tipX+Math.cos(ca)*RCA_NOSE_LEN;
    noseY=tipY+Math.sin(ca)*RCA_NOSE_LEN;
    const noseClamped=_clampSegFrom(tipX,tipY,noseX,noseY);
    noseX=noseClamped.x; noseY=noseClamped.y;
    if(Math.hypot(noseX-tipX,noseY-tipY)>0.5){
      const nd=Math.hypot(noseX-tipX,noseY-tipY)||1;
      tipX=noseX-Math.cos(ca)*Math.min(RCA_NOSE_LEN,nd);
      tipY=noseY-Math.sin(ca)*Math.min(RCA_NOSE_LEN,nd);
    }
    armA1=ca;
  }
  return {connShX,connShY,elbowX,elbowY,tipX,tipY,armA0,armA1,armL0,armL1,useElbow,noseX,noseY,aimAngle:useElbow?armA1:ca};
}

function connectorTipWorld(itemOverride=ITEM){
  const pose=computeConnectorArmPose();
  if(itemOverride===1) return {x:pose.noseX,y:pose.noseY};
  const a=pose.aimAngle;
  return {x:pose.tipX+Math.cos(a)*47,y:pose.tipY+Math.sin(a)*47};
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
    for(let i=0;i<5;i++){
      const t=((fr*0.11+i*0.17)%1);
      const px=tx+(ax-tx)*t,py=ty+(ay-ty)*t;
      ctx.globalAlpha=pulse*0.55;
      ctx.fillStyle='#ee99ff';ctx.beginPath();ctx.arc(px,py,2,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#dd88ff';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+(ax-px)*0.12,py+(ay-py)*0.12);ctx.stroke();
    }
    ctx.globalAlpha=1;
  }
  // â”€â”€ LASER SHOTS â€” fast plasma bolts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const _allShots=(p2&&p2.shots&&_playerCount===2)?p.shots.concat(p2.shots):p.shots;
  for(const s of _allShots){
    const bx=sx(s.x),by=sy(s.y);
    if(bx<-24||bx>W+24||by<-24||by>H+24)continue;
    const isVenture=s.owner==='venture';
    const charged=s.charged||false;
    const isEnemy=s.owner==='enemy'||s.col==='#ff3355'||s.col==='#ff5533';
    const core=isEnemy?'#ffeedd':(isVenture?'#ffe0e8':'#f0e0ff');
    const mid=isEnemy?'#ff6644':(isVenture?'#ff4466':'#bb55ff');
    const glow=isEnemy?'#ff8844':(isVenture?'#ff2244':'#7722cc');
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
    const spdFac=Math.min(1,sp/16);
    const trailLen=(charged?34:20)*spdFac;
    const headLen=(charged?10:6)*Math.max(0.45,spdFac);
    const pulse=0.72+0.28*Math.sin(fr*0.55+(s.born||0)*0.4);
    const vis=Math.max(0.25,spdFac);
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
      ctx.strokeStyle=isVenture?'#ff88aa':'#cc88ff';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(bx+ux*3,by+uy*3,7+Math.sin(fr*0.35)*2,0,Math.PI*2);ctx.stroke();
    }else{
      ctx.globalAlpha=0.45;
      ctx.strokeStyle=mid;ctx.lineWidth=1;
      for(let k=1;k<=3;k++){
        ctx.beginPath();ctx.moveTo(bx-ux*k*4,by-uy*k*4);ctx.lineTo(bx-ux*(k*4-1.5),by-uy*(k*4-1.5));ctx.stroke();
      }
    }
    ctx.globalAlpha=1;
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
    ctx.fillStyle='#ff66ff';
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
  if(p.hook.st!=='idle'){
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
    const bx=sx(_ap.noseX), by=sy(_ap.noseY);
    if(p.hook.st==='ext'){
      ctx.strokeStyle=_ropeDash;ctx.lineWidth=3;ctx.setLineDash([5,3]);
      ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(sx(p.hook.ex),sy(p.hook.ey));ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();ctx.arc(sx(p.hook.ex),sy(p.hook.ey),5,0,Math.PI*2);
      ctx.fillStyle=_ropeGlow;ctx.fill();
      ctx.beginPath();ctx.arc(sx(p.hook.ex),sy(p.hook.ey),3,0,Math.PI*2);
      ctx.fillStyle='#ffffff';ctx.globalAlpha=0.8;ctx.fill();ctx.globalAlpha=1;
    }else{
      const end=ropePlayerEndWorld();
      const path=p.hook._path||_ropePathPts(p.hook,end.x,end.y);
      const vr=p.hook.vr;
      const wpts=(vr&&vr.length>2?vr:path).map(pt=>({x:sx(pt.x),y:sy(pt.y)}));
      ctx.lineCap='round';ctx.lineJoin='round';
      const layers=[{c:_ropeDark,w:7},{c:_ropeMain,w:5},{c:_ropeHigh,w:2}];
      for(const L of layers){
        ctx.strokeStyle=L.c;ctx.lineWidth=L.w;
        ctx.beginPath();ctx.moveTo(wpts[0].x,wpts[0].y);
        for(let i=1;i<wpts.length;i++) ctx.lineTo(wpts[i].x,wpts[i].y);
        ctx.stroke();
      }
      for(let i=0;i<wpts.length-1;i+=2){
        const a=wpts[i], b=wpts[Math.min(i+1,wpts.length-1)];
        const rx=(a.x+b.x)*0.5, ry=(a.y+b.y)*0.5;
        if(i%3===0){
          ctx.beginPath();ctx.arc(rx,ry,1.5,0,Math.PI*2);
          ctx.fillStyle=(i%6===0)?_ropeDotA:_ropeDotB;ctx.fill();
        }
      }
      const ax=wpts[0].x, ay=wpts[0].y;
      ctx.beginPath();ctx.arc(ax,ay,5,0,Math.PI*2);ctx.fillStyle=_ropeAnchorA;ctx.fill();
      ctx.beginPath();ctx.arc(ax,ay,3,0,Math.PI*2);ctx.fillStyle=_ropeAnchorB;ctx.fill();
    }
  }
}
