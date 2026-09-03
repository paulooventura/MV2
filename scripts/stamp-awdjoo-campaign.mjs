#!/usr/bin/env node
/** Stamp Awdjoo campaign floors + knowl seeds. Source of truth: assets/Awdjoo/Awdjoo.json */
import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JSON_PATH = join(ROOT, 'assets', 'Awdjoo', 'Awdjoo.json');
const TMX_PATH = join(ROOT, 'assets', 'Awdjoo', 'Awdjoo.tmx');

const W = 100, H = 100;
const GRASS_CYCLE = [39, 40, 41, 42];
const DIRT_CYCLE = [5, 6, 17, 18];
const KNOWL_GID = 170;
const MIND_GID = 223;
const PLAYER_GID = 169;

function idx(c, r) { return r * W + c; }

function layer(map, name) {
  const l = map.layers.find((x) => String(x.name).toLowerCase() === name.toLowerCase());
  if (!l || !l.data) throw new Error('Missing tile layer: ' + name);
  return l;
}

function stampGrass(grass, dirt, c0, c1, row, holes) {
  const skip = new Set(holes || []);
  for (let c = c0; c <= c1; c++) {
    const i = idx(c, row);
    if (skip.has(c)) {
      grass.data[i] = 0;
      continue;
    }
    grass.data[i] = GRASS_CYCLE[c % GRASS_CYCLE.length];
    dirt.data[i] = 0;
    const under = idx(c, row + 1);
    if (row + 1 < H && !grass.data[under] && !dirt.data[under]) {
      dirt.data[under] = DIRT_CYCLE[c % DIRT_CYCLE.length];
    }
  }
}

function stampKnowl(spawns, c, r) {
  const i = idx(c, r);
  if (!spawns.data[i]) spawns.data[i] = KNOWL_GID;
}

function csvLayer(data) {
  const lines = [];
  for (let r = 0; r < H; r++) {
    lines.push(data.slice(r * W, r * W + W).join(',') + (r === H - 1 ? '' : ','));
  }
  return lines.join('\n');
}

function replaceTmxLayer(tmx, name, data) {
  const re = new RegExp(
    `(<layer\\b[^>]*\\bname="${name}"[^>]*>\\s*<data encoding="csv">)([\\s\\S]*?)(</data>)`,
    'i',
  );
  if (!re.test(tmx)) throw new Error('TMX layer not found: ' + name);
  return tmx.replace(re, `$1\n${csvLayer(data)}\n  $3`);
}

const map = JSON.parse(await readFile(JSON_PATH, 'utf8'));
const dirt = layer(map, 'Dirt stuf');
const grass = layer(map, 'grass stuff');
const spawns = layer(map, 'spawns');

// House 2 street floor — hole at cols 30-31 drops to the basement RCA.
stampGrass(grass, dirt, 29, 38, 73, [30, 31]);
// Stand beside the hole, not in it.
spawns.data[idx(31, 72)] = 0;
spawns.data[idx(32, 72)] = PLAYER_GID;
const spawnOg = map.layers.find((x) => x.type === 'objectgroup' && String(x.name).toLowerCase() === 'spawns');
if (spawnOg) {
  const o = (spawnOg.objects || []).find((x) => x.id === 15);
  if (o) { o.x = 256; o.y = 576; }
}
// Basement slab under RCA (object 16 @ col 30 / row 85).
stampGrass(grass, dirt, 29, 38, 87);
// Street / house floors east to House 5 exit (col 97).
stampGrass(grass, dirt, 39, 40, 73);
stampGrass(grass, dirt, 42, 58, 73);
stampGrass(grass, dirt, 61, 67, 73);
stampGrass(grass, dirt, 69, 74, 73);
stampGrass(grass, dirt, 76, 84, 73);
stampGrass(grass, dirt, 86, 98, 73);

// Knowl seeds mark the campaign path (story: town → exit).
for (const [c, r] of [
  [33, 72],
  [36, 72],
  [32, 86],
  [45, 72],
  [55, 72],
  [64, 72],
  [80, 72],
  [90, 72],
  [96, 72],
]) stampKnowl(spawns, c, r);

// One street mind-enemy so the town is not empty. Skip if a spawn already sits there.
if (!spawns.data[idx(50, 72)]) spawns.data[idx(50, 72)] = MIND_GID;

await writeFile(JSON_PATH, JSON.stringify(map, null, 1).replace(/\n/g, '\n') + '\n', 'utf8');

let tmx = await readFile(TMX_PATH, 'utf8');
tmx = replaceTmxLayer(tmx, 'Dirt stuf', dirt.data);
tmx = replaceTmxLayer(tmx, 'grass stuff', grass.data);
tmx = replaceTmxLayer(tmx, 'spawns', spawns.data);
await writeFile(TMX_PATH, tmx, 'utf8');

execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(ROOT, 'sync-awdjoo-map.ps1')], {
  cwd: ROOT,
  stdio: 'inherit',
});
console.log('Stamped Awdjoo campaign floors + knowls. KNOWL gid', KNOWL_GID);
