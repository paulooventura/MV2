#!/usr/bin/env node
/** Re-run selftest whenever game JS changes (dev watch loop). Ctrl+C to stop. */
import { spawn } from 'child_process';
import { watch } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const WATCH = ['js', 'index.html'];
let timer = null, running = false;

function run(){
  if(running) return;
  running = true;
  console.log('\n--- MV watch: running selftest ---\n');
  const p = spawn(process.platform==='win32'?'npm.cmd':'npm', ['run', 'selftest:quick'], {
    cwd: ROOT, stdio: 'inherit', shell: true,
  });
  p.on('close', (code) => {
    running = false;
    console.log('\n--- watch exit', code, '---\n');
  });
}

function schedule(){
  clearTimeout(timer);
  timer = setTimeout(run, 800);
}

console.log('MV selftest watch — editing js/ or index.html re-runs tests');
run();
for(const dir of WATCH){
  watch(join(ROOT, dir), { recursive: dir === 'js' }, () => schedule());
}
