// GORE metal look: headless checks (no browser). node scripts/gore-look-check.mjs
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const src = readFileSync(join(ROOT, 'claude/js/gore_metal.js'), 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

function load(search, mode, reduced) {
  const win = {
    location: { search }, MV_CONSOLE: { mode },
    matchMedia: () => ({ matches: !!reduced }),
    performance: { now: () => 1000 },
    document: { fonts: null, querySelector: () => null },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(src, win);
  return win;
}

const off = load('', 'ink');
ok(off.MV_GORE_FX && off.MV_GORE_FX.uniforms() === null, 'other filters get no metal grade');
const st = load('?selftest=1&ci=1', 'gore');
ok(st.MV_GORE_FX.uniforms() === null, 'selftest / ci force the look off');
const g = load('', 'gore');
const u = g.MV_GORE_FX.uniforms();
ok(u && u.metal === 1, 'GORE turns the metal grade on');
ok(g.MV_GORE_FX.FLASH_MIN_MS >= 1000 / 3, 'red flash capped under 3 per second (' + g.MV_GORE_FX.FLASH_MIN_MS + ' ms apart)');
ok(g.MV_GORE_FX.canFlash(1e9) === true, 'flash allowed after the gap');
const calm = load('', 'gore', true);
const cu = calm.MV_GORE_FX.uniforms();
ok(cu.flash === 0 && cu.beat === 0.4, 'reduced motion: no flash, steady vignette');
ok(!/#fff(?:fff)?['"]/i.test(src), 'no white flashes in the metal look');

console.log(fails ? `GORE look check: ${fails} failed` : 'GORE look check: all green');
process.exit(fails ? 1 : 0);
