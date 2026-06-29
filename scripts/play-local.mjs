#!/usr/bin/env node
/** Local play server — fresh files every load (no file:// cache traps). */
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PORT = Number(process.env.MV_PLAY_PORT || 8765);
const BUILD = process.env.MV_BUILD || '93';
// Single query param only — ampersands break Windows cmd "start".
const url = `http://127.0.0.1:${PORT}/index.html?b=${BUILD}-${Date.now()}`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.wav': 'audio/wav',
  '.webmanifest': 'application/manifest+json',
};

function openBrowser(target) {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', target], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  spawn('xdg-open', [target], { detached: true, stdio: 'ignore' }).unref();
}

const srv = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent((req.url || '/').split('?')[0]);
    if (path === '/') path = '/index.html';
    const file = join(ROOT, path.replace(/^\//, '').replace(/\.\./g, ''));
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

srv.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use (server already running?).`);
    console.error('Opening browser to existing server...');
    openBrowser(`http://127.0.0.1:${PORT}/index.html?b=${BUILD}-${Date.now()}`);
    process.exit(1);
  }
  throw err;
});

srv.listen(PORT, '127.0.0.1', () => {
  console.log(`Server ready on port ${PORT}`);
  console.log(url);
  openBrowser(url);
});
