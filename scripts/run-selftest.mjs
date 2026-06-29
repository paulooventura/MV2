#!/usr/bin/env node
/**
 * Headless MV self-test — no browser, no copy-paste.
 * Starts a local static server, runs the in-game bot, writes
 * test-results/latest.json, exits 0 on pass / 1 on fail.
 */
import { createServer } from 'http';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'test-results');
const PORT = Number(process.env.MV_TEST_PORT || 8765);
const QUICK = process.argv.includes('--quick');
const TIMEOUT_MS = QUICK ? 75000 : 130000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.wav': 'audio/wav',
  '.webmanifest': 'application/manifest+json',
  '.bat': 'text/plain',
  '.ps1': 'text/plain',
};

function startServer(port) {
  return new Promise((resolve, reject) => {
    const srv = createServer(async (req, res) => {
      try {
        let path = decodeURIComponent((req.url || '/').split('?')[0]);
        if (path === '/') path = '/index.html';
        const file = join(ROOT, path.replace(/^\//, '').replace(/\.\./g, ''));
        const data = await readFile(file);
        const ext = extname(file);
        res.writeHead(200, {
          'Content-Type': MIME[ext] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    srv.on('error', reject);
    srv.listen(port, '127.0.0.1', () => resolve({ srv, port }));
  });
}

function evaluatePass(report) {
  const counts = report.violationCounts || {};
  const issues = Object.entries(counts).filter(([, n]) => n > 0);
  const idle = report.idleMaxDevPx ?? 0;
  const failReasons = [];
  if (issues.length) failReasons.push('violations: ' + issues.map(([k, n]) => k + '=' + n).join(', '));
  if (idle > 1) failReasons.push('idle jitter ' + idle + 'px');
  if (counts.demoTooFewKnowls) failReasons.push('demo knowls missing');
  if (counts.demoTooFewEnemies) failReasons.push('demo enemies missing');
  if (counts.rcaMissing) failReasons.push('RCA pickup missing at boot');
  if (counts.spawnNotHouse2) failReasons.push('spawn not in house 2');
  if (counts.basementUnreachable) failReasons.push('bot did not reach basement RCA zone');
  if (counts.omniblockCorner) failReasons.push('wedged at house-2 omniblock corner');
  if (counts.airLaunch) failReasons.push('unexpected air launch on flat floor');
  if (counts.groundSnap) failReasons.push('large ground Y snap');
  const health = report.health || {};
  if ((health.nonFinite || 0) + (health.fellOut || 0) > 0) {
    failReasons.push('healthwatch: ' + JSON.stringify(health));
  }
  return { pass: failReasons.length === 0, failReasons, issues };
}

async function main() {
  let bound = null;
  for (const port of [PORT, 8766, 8767, 8770]) {
    try {
      bound = await startServer(port);
      break;
    } catch (e) {
      if (port === 8770) throw e;
    }
  }
  const { srv, port } = bound;
  let report = null;
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__MV_FORCE_SELFTEST = true;
      try { sessionStorage.setItem('mv_selftest', '1'); } catch (e) {}
    });

    page.on('console', (msg) => {
      const t = msg.text();
      if (t.startsWith('MV_SELFTEST_REPORT ')) {
        try {
          report = JSON.parse(t.slice('MV_SELFTEST_REPORT '.length));
        } catch (e) {
          console.error('Failed to parse report:', e.message);
        }
      }
    });

    const url = `http://127.0.0.1:${port}/index.html?selftest=1&ci=1${QUICK ? '&quick=1' : ''}&_=${Date.now()}`;
    console.log('MV selftest:', url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    page.setDefaultTimeout(TIMEOUT_MS);

    await page.waitForFunction(() => window.__MV_SELFTEST_DONE === true, { timeout: TIMEOUT_MS });

    if (!report && await page.evaluate(() => window.__mvReport)) {
      report = await page.evaluate(() => window.__mvReport);
    }
    if (!report) throw new Error('Test finished but no MV_SELFTEST_REPORT was captured');

    const verdict = evaluatePass(report);
    report._verdict = verdict.pass ? 'PASS' : 'FAIL';
    report._failReasons = verdict.failReasons;
    report._ranAt = new Date().toISOString();
    report._mode = QUICK ? 'quick' : 'full';

    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(join(OUT_DIR, 'latest.json'), JSON.stringify(report, null, 2));
    const summary = [
      'MV SELF-TEST ' + report._verdict + '  build ' + (report.build || '?'),
      'logic ' + report.logicHz + 'Hz · render ' + report.renderHz + 'Hz · ' + report.durationS + 's',
      'idle wobble max ' + report.idleMaxDevPx + 'px · slowFrames ' + (report.perf?.slowFrames ?? '?'),
      verdict.issues.length ? 'issues: ' + verdict.issues.map(([k, n]) => k + '=' + n).join(', ') : 'issues: none',
      verdict.failReasons.length ? 'fail: ' + verdict.failReasons.join('; ') : '',
      'full report: test-results/latest.json',
    ].filter(Boolean).join('\n');
    await writeFile(join(OUT_DIR, 'summary.txt'), summary + '\n');

    console.log('\n' + summary + '\n');
    process.exitCode = verdict.pass ? 0 : 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise((r) => srv.close(r));
  }
}

main().catch((err) => {
  console.error('MV selftest runner failed:', err.message);
  process.exitCode = 2;
});
