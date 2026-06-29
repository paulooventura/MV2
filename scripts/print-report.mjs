#!/usr/bin/env node
import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

const p = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'test-results', 'latest.json');
try {
  const j = JSON.parse(await readFile(p, 'utf8'));
  console.log(JSON.stringify(j, null, 2));
  process.exit(j._verdict === 'PASS' ? 0 : 1);
} catch {
  console.error('No test-results/latest.json — run: npm run selftest');
  process.exit(2);
}
