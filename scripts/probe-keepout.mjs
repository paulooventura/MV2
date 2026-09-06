import { readFileSync } from 'fs';

const src = readFileSync(new URL('../assets/Awdjoo/Awdjoo.json', import.meta.url), 'utf8');
const m = JSON.parse(src);

const polys = [];
for (const L of m.layers) {
  if (L.type !== 'objectgroup' || !/keep\s*out/i.test(L.name)) continue;
  for (const o of L.objects || []) {
    if (!o.polygon) continue;
    polys.push({ id: o.id, pts: o.polygon.map((p) => [(o.x + p.x) / 8, (o.y + p.y) / 8]) });
  }
}
const area = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
};
const inside = (pts, x, y) => {
  let n = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) n = !n;
  }
  return n;
};

for (const p of polys) console.log('poly', p.id, 'pts', p.pts.length, 'signedArea', area(p.pts).toFixed(1));

const probes = {
  'sky (50,20)': [50.5, 20.5],
  'right sky (80,30)': [80.5, 30.5],
  'house interior (31,72)': [31.5, 72.5],
  'house room low (34,79)': [34.5, 79.5],
  'below house floor (34,84) ': [34.5, 84.5],
  'basement RCA (30,85)': [30.5, 85.5],
  'left ground below (5,80)': [5.5, 80.5],
  'above left ground (5,60)': [5.5, 60.5],
  'air above slope (24,70)': [24.5, 70.5],
  'under slope (22,74)': [22.5, 74.5],
  'island interior (20,11)': [20.5, 11.5],
  'island outside (30,11)': [30.5, 11.5],
  'deep rock (50,95)': [50.5, 95.5],
  'door cell (28,73)': [28.5, 73.5],
  'floor under door (28,77)': [28.5, 77.5],
};
console.log('\n(IN = inside polygon)');
for (const [k, [x, y]] of Object.entries(probes)) {
  console.log(k.padEnd(28), polys.map((p) => p.id + ':' + (inside(p.pts, x, y) ? 'IN ' : 'out')).join('  '));
}

console.log('\nHouse entrance pocket — solid poly 9 vs air poly 24 (S=solid, a=air, ?=disagree)');
const p9 = polys.find((p) => p.id === 9), p24 = polys.find((p) => p.id === 24);
process.stdout.write('      ' + Array.from({ length: 16 }, (_, i) => String((20 + i) % 10)).join('') + '\n');
for (let r = 66; r <= 78; r++) {
  let line = String(r).padStart(5) + ' ';
  for (let c = 20; c <= 35; c++) {
    const s9 = inside(p9.pts, c + 0.5, r + 0.5);
    const s24 = inside(p24.pts, c + 0.5, r + 0.5);
    line += s9 === s24 ? '?' : s9 ? 'S' : 'a';
  }
  console.log(line);
}
