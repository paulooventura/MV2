// ============================================================
//  engine_worklet.js — the combustion core of Mind's engine (AudioWorklet)
//
//  Not oscillators: a crank turns, cylinders fire on their angles, each firing
//  is a pressure pulse (a sharp knock with turbulence) pushed into two exhaust
//  pipes (one per bank) — waveguides that ring at their length — and out of a
//  tailpipe filter that opens with throttle. The firing pattern morphs with
//  RPM: a cross-plane V8 at low revs (uneven per bank → the burble), an even
//  V12 up high (the scream). Backfires are big pulses into both pipes.
//  Messages: {rpm, thr, load} each frame, {bang:n} for backfires.
// ============================================================
class MVEngine extends AudioWorkletProcessor{
  constructor(){
    super();
    this.rpm=620; this.tRpm=620; this.thr=0; this.tThr=0; this.load=0; this.tLoad=0;
    this.rev=0;                                     // crank position in revolutions (a 4-stroke cycle is 2)
    this.exc=[0,0]; this.bang=0; this.bx=[0,0];
    const mk=(n)=>({buf:new Float32Array(4096), i:0, lp:0, n});
    this.pipe=[mk(0),mk(0)];
    this.tp=[{x1:0,x2:0,y1:0,y2:0},{x1:0,x2:0,y1:0,y2:0}];    // tailpipe biquads
    this.dc=[{x:0,y:0},{x:0,y:0}];
    this.noise=0; this.seed=12345;
    // V8 cross-plane: 8 fires per cycle at 90°, bank order L R L L R L R R
    this.v8=[0,1,0,0,1,0,1,1];
    this.port.onmessage=(e)=>{ const d=e.data||{}; if(d.rpm!=null) this.tRpm=d.rpm; if(d.thr!=null) this.tThr=d.thr; if(d.load!=null) this.tLoad=d.load; if(d.bang) this.bang+=d.bang; };
  }
  rnd(){ this.seed=(this.seed*1664525+1013904223)>>>0; return this.seed/4294967296; }
  biquadLP(s,x,f,q){                                 // a tiny RBJ low-pass, coefficients per block
    const c=this.coef; const y=c.b0*x+c.b1*s.x1+c.b2*s.x2-c.a1*s.y1-c.a2*s.y2;
    s.x2=s.x1; s.x1=x; s.y2=s.y1; s.y1=y; return y;
  }
  setLP(f,q){
    const w=2*Math.PI*Math.min(f,sampleRate*0.45)/sampleRate, al=Math.sin(w)/(2*q), cw=Math.cos(w), a0=1+al;
    this.coef={b0:(1-cw)/2/a0, b1:(1-cw)/a0, b2:(1-cw)/2/a0, a1:-2*cw/a0, a2:(1-al)/a0};
  }
  process(_in,outs){
    const out=outs[0], L=out[0], R=out[1]||out[0], N=L.length, sr=sampleRate;
    // per block: smooth controls, tune pipes and the tailpipe
    this.rpm+=(this.tRpm-this.rpm)*0.18; this.thr+=(this.tThr-this.thr)*0.2; this.load+=(this.tLoad-this.load)*0.2;
    const rpm=this.rpm, thr=this.thr, red=13500, r=Math.max(0,Math.min(1,(rpm-620)/(red-620)));
    const v12=Math.max(0,Math.min(1,(rpm-3800)/3800)); const w12=v12*v12*(3-2*v12);
    const pipeHz=[68+r*150, 73+r*160];             // primaries "shorten" as it climbs; long and deep at idle (the purr)
    this.pipe[0].n=Math.max(16,Math.round(sr/pipeHz[0])); this.pipe[1].n=Math.max(16,Math.round(sr/pipeHz[1]));
    const fb=0.5+0.28*thr-0.12*r+0.14*(1-r)*(1-thr);   // how hard the pipe rings (a warm ring at idle)
    const loopLP=0.32+0.5*r+0.15*thr;                 // the brightness inside the pipe
    this.setLP(420+thr*(1800+6500*r)+r*2400, 0.9);
    const decay=Math.exp(-1/(sr*(0.0012+0.0022*(1-thr)+0.0035*(1-r)*(1-thr))));   // a firing's pulse length (fatter at idle)
    const bdecay=Math.exp(-1/(sr*0.012));
    const dRev=rpm/60/sr;
    for(let s=0;s<N;s++){
      const r0=this.rev, r1=r0+dRev; this.rev=r1>=2?r1-2:r1;
      // which cylinders fired between r0 and r1 (angles in revs, cycle = 2)
      // V8 (8 per cycle) and V12 (12 per cycle) trains, cross-faded by RPM
      for(let k=0;k<8;k++){ const a=k*0.25; if(crossed(r0,r1,a)){ const amp=(1-w12)*(0.62+0.38*thr)*(0.8+0.4*this.rnd()); this.exc[this.v8[k]]+=amp*1.3; } }
      for(let k=0;k<12;k++){ const a=k/6; if(crossed(r0,r1,a)){ const amp=w12*(0.45+0.55*thr)*(0.9+0.2*this.rnd()); this.exc[k&1]+=amp; } }
      if(this.bang>0){ this.bx[0]+=3.2*this.bang; this.bx[1]+=3.0*this.bang; this.bang=0; }
      this.noise=this.rnd()*2-1;
      let o0=0,o1=0;
      for(let b=0;b<2;b++){
        const e=this.exc[b]; this.exc[b]*=decay;
        const bb=this.bx[b]; this.bx[b]*=bdecay;                     // a backfire: a longer, rougher blast
        const x=e*(0.55+0.45*this.noise*(b?-1:1))+bb*(0.3+0.7*Math.abs(this.noise));   // the pulse with turbulence
        const p=this.pipe[b], j=(p.i-p.n+4096)&4095, y=p.buf[j];
        p.lp+=((x+y*fb)-p.lp)*loopLP;                              // the ring, damped inside the pipe
        p.buf[p.i]=p.lp; p.i=(p.i+1)&4095;
        let v=x*0.6+y;
        v=this.biquadLP(this.tp[b],v);
        const d=this.dc[b]; const hp=v-d.x+0.995*d.y; d.x=v; d.y=hp;   // DC out
        if(b) o1=hp; else o0=hp;
      }
      const g=0.55;
      L[s]=Math.tanh((o0+0.35*o1)*g*(1.9+0.8*thr))*0.8;
      R[s]=Math.tanh((o1+0.35*o0)*g*(1.9+0.8*thr))*0.8;
    }
    return true;
  }
}
function crossed(r0,r1,a){                          // did the crank pass angle a (0..2) this sample?
  if(r1<2) return a>r0&&a<=r1;
  return a>r0||a<=r1-2;
}
registerProcessor('mv-engine',MVEngine);
