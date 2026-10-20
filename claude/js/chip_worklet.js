// ============================================================
//  chip_worklet.js — the sound chips, sample by sample (AudioWorklet)
//
//  mode 'snes' — Sony SPC700 / S-DSP:
//    · everything is resampled to the DSP's 32 000 Hz;
//    · it goes through BRR, the SNES sample format: blocks of 16 samples,
//      each stored as 4-bit numbers with a shift and a prediction filter —
//      the source of the SNES's soft grit on quiet sounds;
//    · it plays back through the DSP's 4-point Gaussian interpolation, which
//      rounds off the top end (the famous "muffled" SNES warmth).
//  mode 'md' — Yamaha YM2612 DAC (Mega Drive / Genesis):
//    · sample-and-hold at the DAC's rate with no interpolation (bright,
//      aliased highs), 8-bit steps;
//    · the "ladder effect": the DAC's discrete output stage jumps across zero,
//      so quiet signals pick up crunchy crossover distortion.
//    (the Model 1 output filter and the rest run as WebAudio nodes after this)
//  mode 'off' — straight through.
//  Message: {mode, rate} (rate = DAC rate for 'md').
// ============================================================
class MVChip extends AudioWorkletProcessor{
  constructor(){
    super();
    this.mode='off'; this.mdRate=22050;
    this.ch=[0,1].map(()=>this.fresh());
    this.port.onmessage=e=>{ const d=e.data||{}; if(d.mode&&d.mode!==this.mode){ this.mode=d.mode; this.ch=[0,1].map(()=>this.fresh()); } if(d.rate) this.mdRate=d.rate; };
    // SNES Gaussian interpolation: the DSP's 512-entry table, approximated by
    // the 4-tap Gaussian it was built from (σ ≈ 0.62 samples)
    this.g=new Float32Array(4*256);
    for(let f=0;f<256;f++){
      const t=f/256; let sum=0; const w=[];
      for(let k=0;k<4;k++){ const d=(k-1)-t; const v=Math.exp(-(d*d)/(2*0.62*0.62)); w.push(v); sum+=v; }
      for(let k=0;k<4;k++) this.g[f*4+k]=w[k]/sum;
    }
  }
  fresh(){ return {t:0, prev:0, lp:0, blk:new Float32Array(16), bn:0, h1:0, h2:0, q:[0,0,0,0], qr:0, hold:0, ht:0}; }

  // BRR: 16 samples → 4-bit residues, picking the filter (0-2) and shift that
  // fit best — encoded and decoded right here (no allocations in the loop)
  brr(c){
    const blk=c.blk, tmp=this.tmp||(this.tmp=new Float32Array(16)), best=this.best||(this.best=new Float32Array(16));
    let bestErr=1e18, bh1=c.h1, bh2=c.h2;
    for(let filt=0;filt<3;filt++){
      // guess the shift from the open-loop residual, then try it and the next one up
      let mx=0, o1=c.h1, o2=c.h2;
      for(let i=0;i<16;i++){ const x=blk[i]*32767, pred=filt===0?0:filt===1?o1*0.9375:o1*1.90625-o2*0.9375; const r=Math.abs(x-pred); if(r>mx) mx=r; o2=o1; o1=x; }
      let s0=0; while(s0<12&&mx/(1<<s0)>7.5) s0++;
      for(let sh=Math.max(0,s0-1);sh<=Math.min(12,s0+1);sh++){
        let h1=c.h1, h2=c.h2, err=0, i=0; const m=1<<sh;
        for(;i<16;i++){
          const x=blk[i]*32767;
          const pred=filt===0?0:filt===1?h1*0.9375:h1*1.90625-h2*0.9375;
          let r=Math.round((x-pred)/m); if(r<-8) r=-8; else if(r>7) r=7;
          let y=pred+r*m; if(y<-32768) y=-32768; else if(y>32767) y=32767;
          tmp[i]=y; const e=x-y; err+=e*e; h2=h1; h1=y;
          if(err>=bestErr) break;
        }
        if(i===16&&err<bestErr){ bestErr=err; best.set(tmp); bh1=h1; bh2=h2; }
      }
    }
    c.h1=bh1; c.h2=bh2;
    for(let i=0;i<16;i++) c.q.push(best[i]/32768);
  }
  process(inputs, outputs){
    const inp=inputs[0], out=outputs[0];
    if(!out||!out.length) return true;
    const n=out[0].length;
    if(!inp||!inp.length||this.mode==='off'){
      for(let k=0;k<out.length;k++){ const src=inp&&inp[Math.min(k,inp.length-1)]; if(src) out[k].set(src); else out[k].fill(0); }
      return true;
    }
    const sr=sampleRate;
    for(let k=0;k<out.length;k++){
      const src=inp[Math.min(k,inp.length-1)], dst=out[k], c=this.ch[k]||(this.ch[k]=this.fresh());
      if(!src){ dst.fill(0); continue; }
      if(this.mode==='snes'){
        const R=32000, step=R/sr, aa=1-Math.exp(-2*Math.PI*14000/sr);
        for(let i=0;i<n;i++){
          const x=src[i];
          c.lp+=aa*(x-c.lp);                              // anti-alias before 32 kHz
          // resample to 32 kHz (linear between input samples)
          c.t+=step;
          while(c.t>=1){
            c.t-=1;
            const frac=1-c.t/step; const v=c.prev+(c.lp-c.prev)*Math.max(0,Math.min(1,frac));
            c.blk[c.bn++]=v;
            if(c.bn===16){ this.brr(c); c.bn=0; }
          }
          c.prev=c.lp;
          // play back through the Gaussian interpolator at 32 kHz
          if(c.q.length<24){ dst[i]=0; continue; }
          c.qr+=step;
          while(c.qr>=1){ c.q.shift(); c.qr-=1; }
          const f=Math.min(255,(c.qr*256)|0), g=this.g, q=c.q;
          dst[i]=q[0]*g[f*4]+q[1]*g[f*4+1]+q[2]*g[f*4+2]+q[3]*g[f*4+3];
          if(c.q.length>64) c.q.splice(0,c.q.length-40);   // never drift behind
        }
      }else{                                              // 'md'
        const step=this.mdRate/sr, L=1/127;
        for(let i=0;i<n;i++){
          c.ht+=step;
          if(c.ht>=1){                                    // a new DAC sample: 8-bit, no smoothing
            c.ht-=Math.floor(c.ht);
            let v=Math.max(-1,Math.min(1,src[i]));
            let q=Math.round(v*127)*L;
            if(q!==0) q+=(q>0?1:-1)*L*1.6;                  // ladder effect: a jump across zero
            c.hold=q;
          }
          dst[i]=c.hold;                                  // zero-order hold
        }
      }
    }
    return true;
  }
}
registerProcessor('mv-chip', MVChip);
