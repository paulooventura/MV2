#!/usr/bin/env node
/**
 * Jump apex test (T187, Paulo's air jump). No browser, no audio.
 * Loads claude/js/physics.js in a sandbox and flies the real jumpHoldKick()
 * with the same per-frame order as main.js (kick, then gravity), in open air.
 *
 * Paulo (Oct 22 / 26 / 27): a mid-air tap stops the fall; the longer jump is held,
 * the higher the air jump; a full second of hold = a full jump, not more.
 * Exit 0 = pass, 1 = fail.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const src = readFileSync(join(ROOT, 'claude/js/physics.js'), 'utf8');
const stub = new Proxy(function () {}, { get: () => stub, apply: () => stub, construct: () => stub });
const ctx = vm.createContext({ window: {}, document: stub, navigator: {}, console, Math, performance: { now: () => 0 } });
vm.runInContext(src + '\n;globalThis.__J={GRAV,JI,JMH,AIR_JUMP_HOLD,jumpHoldKick};', ctx);
const { GRAV, JI, JMH, AIR_JUMP_HOLD, jumpHoldKick } = ctx.__J;

// Rise in px above the start for a jump held `hold` frames (main.js order: start, kick, gravity).
function apex({ air, hold, vy0 = 0 }) {
  const pl = { vy: vy0, jf: 0, _airBoost: 0, _airStall: 0 };
  if (air) { pl._airBoost = 1; pl._airStall = 1; pl.vy = pl.vy > 0 ? 0 : pl.vy; pl.jf = AIR_JUMP_HOLD; }
  else { pl.vy = JI; pl.jf = JMH; }
  let y = 0, top = 0, stallVy = null;
  for (let f = 0; f < 600; f++) {
    const held = f < hold;
    const stall = !!pl._airStall; pl._airStall = 0;
    if (held && pl.jf > 0 && !stall) jumpHoldKick(pl);
    else if (!stall && !held) { pl.jf = 0; pl._airBoost = 0; }
    if (stall) stallVy = pl.vy;
    else pl.vy = Math.min(pl.vy + (held && pl.jf > 0 && pl.vy < 0 ? GRAV * 0.38 : GRAV), 14);
    y += pl.vy; top = Math.min(top, y);
    if (pl.vy > 0 && f > 1 && !held) break;
  }
  return { rise: -top, stallVy };
}

const groundTap = apex({ air: false, hold: 1 }).rise;
const groundFull = apex({ air: false, hold: 999 }).rise;
const tap = apex({ air: true, hold: 1, vy0: 9 });
const half = apex({ air: true, hold: 30, vy0: 9 }).rise;
const full = apex({ air: true, hold: 60, vy0: 9 }).rise;
const over = apex({ air: true, hold: 999, vy0: 9 }).rise;
const steps = [1, 10, 20, 30, 40, 50, 60].map((h) => apex({ air: true, hold: h, vy0: 9 }).rise);

const r = (n) => Math.round(n);
console.log(`ground jump: tap ${r(groundTap)}px, full hold ${r(groundFull)}px`);
console.log(`air jump: tap ${r(tap.rise)}px (fall ${9} -> ${tap.stallVy}), 0.5 s ${r(half)}px, 1 s ${r(full)}px, held on ${r(over)}px`);
console.log('air jump by hold frames 1/10/20/30/40/50/60:', steps.map(r).join(' / '));

const fails = [];
if (!(groundTap < groundFull * 0.5)) fails.push('ground tap should be well under a full ground jump');
if (tap.stallVy !== 0) fails.push('air tap must stop the fall (vy 0), got ' + tap.stallVy);
if (tap.rise > 2) fails.push('air tap should only stall, rose ' + r(tap.rise) + 'px');
for (let i = 1; i < steps.length; i++) if (!(steps[i] > steps[i - 1])) fails.push('air jump height must grow with hold time');
if (!(half > full * 0.45 && half < full * 0.85)) fails.push('0.5 s hold should land between a tap and a full air jump');
if (Math.abs(full - groundFull) > groundFull * 0.1) fails.push(`1 s air jump ${r(full)}px should match a full ground jump ${r(groundFull)}px (±10%)`);
if (over > groundFull * 1.1) fails.push('holding past 1 s must not climb past a full jump');

if (fails.length) { console.error('FAIL jump apex:\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('PASS jump apex');
