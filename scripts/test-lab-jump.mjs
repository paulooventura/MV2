/**
 * Automated Test Lab jump check.
 * Starts a local static server, loads ?testlabci=1, reads window.__MV_TESTLAB_CI__.
 *
 * Usage: node scripts/test-lab-jump.mjs
 * Exit 0 = jump OK, 1 = fail.
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8777;
const URL = `http://127.0.0.1:${PORT}/?testlabci=1&b=ci`;

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['--yes', 'serve', '-p', String(PORT), '-l', String(PORT)], {
      cwd: root,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let ready = false;
    const onData = (buf) => {
      const s = String(buf);
      if (!ready && /accepting|serving|listen/i.test(s)) {
        ready = true;
        resolve(proc);
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('error', reject);
    setTimeout(() => {
      if (!ready) resolve(proc);
    }, 12000);
  });
}

async function runWithPuppeteer() {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'load', timeout: 45000 });
    await page.waitForFunction(() => window.__MV_TESTLAB_CI__, { timeout: 45000 });
    return await page.evaluate(() => window.__MV_TESTLAB_CI__);
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('MV Test Lab jump CI —', root);
  const server = await startServer();
  await wait(1500);
  let result;
  try {
    result = await runWithPuppeteer();
  } catch (err) {
    console.error('Puppeteer run failed:', err.message || err);
    console.error('Install Chrome via: npx puppeteer browsers install chrome');
    process.exit(2);
  } finally {
    server.kill('SIGTERM');
  }
  console.log('MV_TESTLAB_CI', JSON.stringify(result, null, 2));
  if (!result.ok) {
    console.error('FAIL: player did not leave the floor (lift px =', result.lift, ')');
    process.exit(1);
  }
  console.log('PASS: Test Lab jump left the floor by', result.lift, 'px');
  process.exit(0);
}

main();
