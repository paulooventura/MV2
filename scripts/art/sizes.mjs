// node scripts/art/sizes.mjs <dir> : PNG sizes from the IHDR header
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
const walk = (d) => readdirSync(d).flatMap((n) => { const f = join(d, n); return statSync(f).isDirectory() ? walk(f) : [f]; });
for (const f of walk(process.argv[2]).filter((f) => /\.png$/i.test(f))) {
  const b = readFileSync(f); if (b.length < 24) continue;
  console.log(f.replace(/\\/g, '/'), b.readUInt32BE(16) + 'x' + b.readUInt32BE(20));
}
